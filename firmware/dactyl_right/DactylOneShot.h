#pragma once
/*
 * DactylOneShot.h — One-Shot-Modifier und Caps Word, Zustand auf dem Master (beide Hälften).
 *
 * Beide Hälften melden ihre One-Shot- und Caps-Word-Tasten an den Master (rechts direkt, links über
 * SPLIT_OP_ONE_SHOT_* / SPLIT_OP_CAPS_WORD_*). SplitArbitratedKeyboard fragt vor jedem Tasten- oder
 * Maus-Druck, welche Modifier es diesem Druck mitgeben soll, und sendet sie im selben Report. Im nächsten
 * Report sind sie wieder gelöst: eine folgende Taste (auch bei überlappendem Tippen) bekommt sie nicht.
 *
 * Regeln:
 * - Tippen einer One-Shot-Taste ohne andere Taste dazwischen merkt den Modifier für den nächsten Druck vor.
 *   Ein zweites Tippen nimmt die Vormerkung zurück.
 * - Halten wirkt wie ein normaler Modifier: jeder Druck während des Haltens bekommt ihn. Danach ist nichts
 *   vorgemerkt.
 * - Caps Word: Buchstaben und '-' bekommen Shift. Ziffern, '_', Backspace, Delete und Modifier lassen Caps
 *   Word an; jede andere Taste beendet es. Die Caps-Word-Taste schaltet um.
 * - Ein Druck, während Alt im Report ist (Tottaste eines Umlauts, Tastenpaar mit Alt), verbraucht nichts und
 *   ändert Caps Word nicht. So wird bei vorgemerktem Shift aus der Umlaut-Folge Alt + u, 'a' ein Ä.
 *
 * Keine Arduino-Abhängigkeit (Host-Tests: firmware/tests/test_split_hid.cpp).
 */
#include <stdint.h>
#include "DactylKeycodes.h"

// Bit i = Modifier-Code KEY_LEFT_CTRL + i
#define ONE_SHOT_SHIFT_BIT ((uint8_t)(1u << (KEY_LEFT_SHIFT - KEY_LEFT_CTRL)))

struct OneShotState {
  uint8_t armed;   // vorgemerkt für den nächsten Druck
  uint8_t used;    // gehaltene Bits, während deren Halten eine andere Taste kam (kein Vormerken beim Loslassen)
  uint8_t cancel;  // beim Drücken war das Bit vorgemerkt: Loslassen merkt es nicht erneut vor
  bool capsWord;
};

inline void oneShotReset(OneShotState &s) {
  s.armed = s.used = s.cancel = 0;
  s.capsWord = false;
}

inline void oneShotKeyDown(OneShotState &s, uint8_t mask) {
  s.cancel |= (uint8_t)(s.armed & mask);
  s.armed &= (uint8_t)~mask;
  s.used &= (uint8_t)~mask;
}

// arm = false: Loslassen ohne Wirkung (Link-Ausfall, RELEASE_ALL)
inline void oneShotKeyUp(OneShotState &s, uint8_t mask, bool arm) {
  if (arm) s.armed |= (uint8_t)(mask & ~s.used & ~s.cancel);
  s.used &= (uint8_t)~mask;
  s.cancel &= (uint8_t)~mask;
}

inline bool isModifierCode(uint8_t code) {
  return code >= KEY_LEFT_CTRL && code <= KEY_RIGHT_GUI;
}

inline bool capsWordShifts(uint8_t code) {
  return (code >= 'a' && code <= 'z') || code == '-';
}

inline bool capsWordContinues(uint8_t code) {
  return (code >= 'A' && code <= 'Z') || (code >= '0' && code <= '9') || code == '_' ||
         code == KEY_BACKSPACE || code == KEY_DELETE;
}

// held = gehaltene One-Shot-Bits beider Hälften. Liefert die Modifier für einen Druck und verbraucht
// die Vormerkung.
inline uint8_t oneShotModsForInput(OneShotState &s, uint8_t held, bool altInReport) {
  if (altInReport) return 0;
  uint8_t mods = (uint8_t)(held | s.armed);
  s.used |= held;
  s.armed = 0;
  return mods;
}

inline uint8_t oneShotModsForKey(OneShotState &s, uint8_t held, uint8_t code, bool altInReport) {
  if (isModifierCode(code) || altInReport) return 0;
  uint8_t mods = oneShotModsForInput(s, held, false);
  if (s.capsWord) {
    if (capsWordShifts(code)) mods |= ONE_SHOT_SHIFT_BIT;
    else if (!capsWordContinues(code)) s.capsWord = false;
  }
  return mods;
}
