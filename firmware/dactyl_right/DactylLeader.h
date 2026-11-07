#pragma once
/*
 * DactylLeader.h — Leader-Folgen (ACT_LEADER): reine Logik ohne Arduino- und BLE-Abhängigkeit.
 * Jede Hälfte hat eigene Folgen und sammelt nur die Tasten der eigenen Hälfte. DactylLogic.h bindet die
 * Taste, die Zeitüberwachung, die Befehle und den NVS-Speicher an diese Funktionen.
 */
#include <stddef.h>
#include <stdint.h>
#include "DactylCommon.h"  // LeaderSeq, LEADER_MAX_KEYS, MAX_LEADER_SEQS, ACT_KEY_PAIR_BASE, ACT_MACRO_BASE

// Tastencode einer Folge oder Aktion: 1..255 ohne Modifier (0x80..0x87)
inline bool leaderKeyCodeValid(int code) {
  return code >= 1 && code <= 0xFF && !(code >= 0x80 && code <= 0x87);
}

// Aktion einer Folge: Tastencode, Tastenpaar (PAIR_n) oder Makro (MACRO_n)
inline bool leaderActionValid(int action) {
  return leaderKeyCodeValid(action) ||
         (action >= ACT_KEY_PAIR_BASE && action < ACT_KEY_PAIR_BASE + 16) ||
         (action >= ACT_MACRO_BASE && action < ACT_MACRO_BASE + 16);
}

// Zahl der belegten Tasten (die belegten stehen vorn); 0 = ungültig (leer, Lücke oder ungültiger Code)
inline uint8_t leaderKeyCount(const uint8_t *keys) {
  uint8_t n = 0;
  while (n < LEADER_MAX_KEYS && keys[n] != 0) {
    if (!leaderKeyCodeValid(keys[n])) return 0;
    n++;
  }
  for (uint8_t i = n; i < LEADER_MAX_KEYS; i++) if (keys[i] != 0) return 0;
  return n;
}

inline bool leaderSeqValid(const LeaderSeq &s) {
  return leaderKeyCount(s.keys) > 0 && leaderActionValid(s.action);
}

// Beginnt die Folge s mit den count Tasten in keys? exact: die Folge ist genau diese Tasten.
inline bool leaderSeqStartsWith(const LeaderSeq &s, const uint8_t *keys, uint8_t count, bool exact) {
  uint8_t n = leaderKeyCount(s.keys);
  if (n < count || (exact && n != count)) return false;
  for (uint8_t i = 0; i < count; i++) if (s.keys[i] != keys[i]) return false;
  return true;
}

// Index der Folge, die genau diese Tasten hat, oder -1
inline int leaderFindExact(const LeaderSeq *seqs, uint8_t num, const uint8_t *keys, uint8_t count) {
  for (uint8_t i = 0; i < num; i++) if (leaderSeqStartsWith(seqs[i], keys, count, true)) return i;
  return -1;
}

// Gibt es eine Folge, die mit diesen Tasten beginnt und länger ist?
inline bool leaderHasLonger(const LeaderSeq *seqs, uint8_t num, const uint8_t *keys, uint8_t count) {
  for (uint8_t i = 0; i < num; i++) {
    if (leaderSeqStartsWith(seqs[i], keys, count, false) && leaderKeyCount(seqs[i].keys) > count) return true;
  }
  return false;
}

// Zustand der laufenden Erfassung (nur RAM)
struct LeaderState {
  bool active = false;
  uint8_t count = 0;
  uint8_t keys[LEADER_MAX_KEYS] = {};
  unsigned long lastAt = 0;  // Leader-Taste oder zuletzt erfasste Taste

  void reset() { *this = LeaderState(); }
  void start(unsigned long now) { reset(); active = true; lastAt = now; }
  // 32-Bit-Differenz mit Vorzeichen: ein Zeitpunkt nach now (Start mit späterem millis() innerhalb desselben Durchlaufs,
  // Zurückgehaltene Taste) gilt als nicht abgelaufen und überlebt den Überlauf von millis()
  bool timedOut(unsigned long now, unsigned long timeoutMs) const {
    int32_t since = (int32_t)(uint32_t)(now - lastAt);
    return active && since >= 0 && (uint32_t)since >= (uint32_t)timeoutMs;
  }
};

enum LeaderResult : uint8_t {
  LEADER_WAIT = 0,   // weitere Tasten möglich
  LEADER_MATCH = 1,  // die Folge ist vollständig und eindeutig: Aktion ausführen
  LEADER_ABORT = 2   // keine Folge passt mehr: nichts senden
};

// Eine Taste erfassen und über den weiteren Ablauf entscheiden. matchIdx: Index der passenden Folge bei LEADER_MATCH.
inline LeaderResult leaderCapture(LeaderState &st, const LeaderSeq *seqs, uint8_t num, uint8_t key, unsigned long now, int &matchIdx) {
  matchIdx = -1;
  if (!st.active || st.count >= LEADER_MAX_KEYS) return LEADER_ABORT;
  st.keys[st.count++] = key;
  st.lastAt = now;
  int exact = leaderFindExact(seqs, num, st.keys, st.count);
  bool longer = st.count < LEADER_MAX_KEYS && leaderHasLonger(seqs, num, st.keys, st.count);
  if (exact >= 0 && !longer) { matchIdx = exact; return LEADER_MATCH; }
  if (longer) return LEADER_WAIT;
  return LEADER_ABORT;
}
