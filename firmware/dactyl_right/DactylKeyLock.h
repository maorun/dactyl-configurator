#pragma once
/*
 * DactylKeyLock.h — Key lock (ACT_KEY_LOCK), Zustand auf dem Master (beide Hälften).
 *
 * KEY_LOCK merkt vor (armed). Die nächste gedrückte Eingabe beider Hälften (Taste, Medientaste, Maustaste) bleibt
 * nach dem Loslassen der physischen Taste im Report gedrückt. Ein zweiter Druck derselben Eingabe löst sie.
 * Eingaben sind Ids: Tastencodes 0..255, Maus-Buttons 256..258 (Bit 0..2). Medientasten sperrt sie nicht.
 * Keine Arduino- oder BLE-Abhängigkeit, damit die Host-Tests den Produktionscode ausführen.
 */
#include <stdint.h>
#include <string.h>

#define KEY_LOCK_IDS 259
#define KEY_LOCK_MOUSE_BASE 256

// Zustand je Eingabe
enum KeyLockSlot : uint8_t {
  KL_FREE = 0,     // nicht gesperrt
  KL_HELD = 1,     // gesperrt, die physische Taste ist noch gedrückt
  KL_ON = 2,       // gesperrt, die physische Taste ist losgelassen: die Eingabe bleibt im Report
  KL_SWALLOW = 3   // der zweite Druck hat die Eingabe gelöst: sein Loslassen sendet nichts mehr
};

enum KeyLockPress : uint8_t {
  KL_PRESS_NORMAL = 0,  // normal drücken
  KL_PRESS_UNLOCK = 1   // die gesperrte Eingabe jetzt lösen, der Druck sendet nichts
};

struct KeyLockState {
  bool armed;
  uint8_t slot[KEY_LOCK_IDS];
};

inline void klReset(KeyLockState &s) {
  memset(&s, 0, sizeof(s));
}

inline void klArm(KeyLockState &s) {
  s.armed = true;
}

// Druck der Eingabe id. Ist KEY_LOCK vorgemerkt, wird sie gesperrt (die Vormerkung ist danach verbraucht).
inline KeyLockPress klOnPress(KeyLockState &s, uint16_t id) {
  if (id >= KEY_LOCK_IDS) return KL_PRESS_NORMAL;
  if (s.slot[id] == KL_ON) {
    s.slot[id] = KL_SWALLOW;
    return KL_PRESS_UNLOCK;
  }
  if (s.slot[id] == KL_SWALLOW) s.slot[id] = KL_FREE;
  if (s.slot[id] == KL_FREE && s.armed) {
    s.armed = false;
    s.slot[id] = KL_HELD;
  }
  return KL_PRESS_NORMAL;
}

// Loslassen der Eingabe id. true = nichts senden (gesperrt, oder der zweite Druck hat sie schon gelöst).
inline bool klOnRelease(KeyLockState &s, uint16_t id) {
  if (id >= KEY_LOCK_IDS) return false;
  switch (s.slot[id]) {
    case KL_HELD:
      s.slot[id] = KL_ON;
      return true;
    case KL_ON:
      return true;
    case KL_SWALLOW:
      s.slot[id] = KL_FREE;
      return true;
    default:
      return false;
  }
}
