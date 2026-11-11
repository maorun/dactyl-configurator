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
#define KEY_OVERRIDE_STRICT    16 // Bit 4 in mods: nur diese Modifier dürfen gehalten sein (kein Bit im Format ändert sich)
#define KEY_OVERRIDE_MODS_FLAGS 31 // Klassen-Bits plus Strict
#define KEY_OVERRIDE_ALL_LAYERS 0xFF
#define KEY_OVERRIDE_NVS_RECORD_BYTES 4 // ovr_v2: mods, key, replacement, layerMask
#define KEY_OVERRIDE_NVS_LEGACY_BYTES 3 // ovr_data: ohne Ebenenmaske

struct KeyOverride {
  uint8_t mods;        // 1..15 (+16 = strikt): alle diese Klassen müssen gehalten sein; strikt: keine anderen
  uint8_t key;         // gedrückte Taste (Tastatur-Code 1..255, kein Modifier)
  uint8_t replacement; // gesendete Taste (Tastatur-Code 1..255, kein Modifier)
  uint8_t layerMask = KEY_OVERRIDE_ALL_LAYERS; // Bit i = die Überschreibung gilt auf Ebene i (1..255)
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

inline bool keyOverrideValid(int mods, int key, int replacement, int layerMask = KEY_OVERRIDE_ALL_LAYERS) {
  return layerMask >= 1 && layerMask <= KEY_OVERRIDE_ALL_LAYERS && mods >= 1 && mods <= KEY_OVERRIDE_MODS_FLAGS && (mods & KEY_OVERRIDE_MOD_ALL) != 0 &&
         key >= 1 && key <= 0xFF && !keyOverrideIsModifierCode((uint8_t)key) &&
         replacement >= 1 && replacement <= 0xFF && !keyOverrideIsModifierCode((uint8_t)replacement);
}

inline uint8_t keyOverrideBitCount(uint8_t v) {
  uint8_t n = 0;
  for (; v; v >>= 1) n += v & 1;
  return n;
}

// Treffer für key bei den gehaltenen Klassen auf der aktiven Ebene. Mehrere Treffer: die meisten geforderten Modifier gewinnen
// (Shift + Ctrl vor Shift), bei Gleichstand der frühere Eintrag.
inline const KeyOverride *keyOverrideFind(const KeyOverride *table, uint8_t count, uint8_t heldClasses, uint8_t key, uint8_t layer = 0) {
  const KeyOverride *best = nullptr;
  for (uint8_t i = 0; i < count; i++) {
    const KeyOverride &o = table[i];
    uint8_t classes = (uint8_t)(o.mods & KEY_OVERRIDE_MOD_ALL);
    if (o.key != key || classes == 0 || (classes & ~heldClasses) != 0) continue;
    if ((o.mods & KEY_OVERRIDE_STRICT) && (heldClasses & ~classes & KEY_OVERRIDE_MOD_ALL) != 0) continue;
    if (layer > 7 || !((o.layerMask >> layer) & 1)) continue;
    if (!best || keyOverrideBitCount(classes) > keyOverrideBitCount(best->mods & KEY_OVERRIDE_MOD_ALL)) best = &o;
  }
  return best;
}
