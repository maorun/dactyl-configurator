#pragma once
/*
 * DactylKeyOverride.h — Tasten-Überschreibungen: Modifier + Taste ergibt eine andere Taste.
 *
 * Beispiel: Shift + Backspace sendet Delete ohne Shift. Die Tabelle gilt nur auf dem Master
 * (SplitArbitratedKeyboard, DactylSplitHid.h), weil nur dort die Modifier beider Hälften sichtbar sind.
 * Keine Arduino- oder ESP-IDF-Abhängigkeit.
 */
#include <stdint.h>

#define MAX_KEY_OVERRIDES 16

// Modifier-Klassen (links oder rechts): Bit 0 Ctrl, Bit 1 Shift, Bit 2 Alt, Bit 3 GUI
#define KEY_OVERRIDE_MOD_CTRL  1
#define KEY_OVERRIDE_MOD_SHIFT 2
#define KEY_OVERRIDE_MOD_ALT   4
#define KEY_OVERRIDE_MOD_GUI   8
#define KEY_OVERRIDE_MOD_ALL   15

struct KeyOverride {
  uint8_t mods;        // 1..15: alle diese Klassen müssen gehalten sein
  uint8_t key;         // gedrückte Taste (Tastatur-Code 1..255, kein Modifier)
  uint8_t replacement; // gesendete Taste (Tastatur-Code 1..255, kein Modifier)
};

// Modifier-Codes 0x80..0x87 (Ctrl, Shift, Alt, GUI links, dann rechts)
inline bool keyOverrideIsModifierCode(uint8_t code) { return code >= 0x80 && code <= 0x87; }

// Klasse (1, 2, 4 oder 8) eines Modifier-Codes; 0 für jede andere Taste
inline uint8_t keyOverrideClassOfCode(uint8_t code) {
  return keyOverrideIsModifierCode(code) ? (uint8_t)(1u << ((code - 0x80) & 3)) : 0;
}

// Klassen-Maske (4 Bit) -> Modifier-Code-Maske (Bit i = Code 0x80 + i), links und rechts
inline uint8_t keyOverrideCodesOfClasses(uint8_t classes) {
  uint8_t m = (uint8_t)(classes & KEY_OVERRIDE_MOD_ALL);
  return (uint8_t)(m | (m << 4));
}

// Modifier-Code-Maske -> Klassen-Maske
inline uint8_t keyOverrideClassesOfCodes(uint8_t codes) {
  return (uint8_t)((codes | (codes >> 4)) & KEY_OVERRIDE_MOD_ALL);
}

inline bool keyOverrideValid(int mods, int key, int replacement) {
  return mods >= 1 && mods <= KEY_OVERRIDE_MOD_ALL &&
         key >= 1 && key <= 0xFF && !keyOverrideIsModifierCode((uint8_t)key) &&
         replacement >= 1 && replacement <= 0xFF && !keyOverrideIsModifierCode((uint8_t)replacement);
}

inline uint8_t keyOverrideBitCount(uint8_t v) {
  uint8_t n = 0;
  for (; v; v >>= 1) n += v & 1;
  return n;
}

// Treffer für key bei den gehaltenen Klassen. Mehrere Treffer: die meisten geforderten Modifier gewinnen
// (Shift + Ctrl vor Shift), bei Gleichstand der frühere Eintrag.
inline const KeyOverride *keyOverrideFind(const KeyOverride *table, uint8_t count, uint8_t heldClasses, uint8_t key) {
  const KeyOverride *best = nullptr;
  for (uint8_t i = 0; i < count; i++) {
    const KeyOverride &o = table[i];
    if (o.key != key || o.mods == 0 || (o.mods & ~heldClasses) != 0) continue;
    if (!best || keyOverrideBitCount(o.mods) > keyOverrideBitCount(best->mods)) best = &o;
  }
  return best;
}
