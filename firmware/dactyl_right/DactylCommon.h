#pragma once
/*
 * DactylCommon.h — gemeinsame Definitionen beider Hälften: Aktionscodes, Combo- und Key-Pair-Typen.
 * Vor den Keymaps und vor DactylLogic.h einbinden.
 */

// Layer Action Codes (Values >= 0x100)
#define ACT_MO_BASE 0x100
#define ACT_MO_0  0x100
#define ACT_MO_1  0x101
#define ACT_MO_2  0x102
#define ACT_MO_3  0x103
#define ACT_MO_4  0x104
#define ACT_MO_5  0x105
#define ACT_MO_6  0x106
#define ACT_MO_7  0x107

#define ACT_TG_BASE 0x110
#define ACT_TG_0  0x110
#define ACT_TG_1  0x111
#define ACT_TG_2  0x112
#define ACT_TG_3  0x113
#define ACT_TG_4  0x114
#define ACT_TG_5  0x115
#define ACT_TG_6  0x116
#define ACT_TG_7  0x117
#define ACT_LAYER_UP   0x118
#define ACT_LAYER_DOWN 0x119

#define ACT_MEDIA_PLAY_PAUSE     0x120
#define ACT_MEDIA_MUTE           0x121
#define ACT_MEDIA_VOLUME_UP      0x122
#define ACT_MEDIA_VOLUME_DOWN    0x123
#define ACT_MEDIA_NEXT_TRACK     0x124
#define ACT_MEDIA_PREVIOUS_TRACK 0x125
#define ACT_MEDIA_STOP           0x126
#define ACT_MAC_GLOBE            0x127

#define ACT_MOUSE_LEFT           0x130
#define ACT_MOUSE_RIGHT          0x131
#define ACT_MOUSE_MIDDLE         0x132
#define ACT_MOUSE_WHEEL_UP       0x133
#define ACT_MOUSE_WHEEL_DOWN     0x134

// Tastenpaar: eine Taste drückt zwei Tasten gleichzeitig (z. B. Shift + .); Index in userKeyPairs[]
#define ACT_KEY_PAIR_BASE        0x140

#define NUM_LAYERS 8

#define MAX_COMBOS 16

// Reine NVS-persistierte Combo-Definition (exakt 6 Bytes, kompatibel mit bisherigen NVS-Daten)
struct KeyCombo {
  uint8_t r1, c1;
  uint8_t r2, c2;
  uint8_t behavior; // 0 = KEY_PRESS, 1 = MODIFIER_HOLD, 2 = LAYER_TOGGLE
  uint16_t action;
};

// Separater flüchtiger Runtime-Zustand für Tasten-Chording
struct ComboRuntime {
  bool active;
  unsigned long lastReleaseTime;
};

#define MAX_KEY_PAIRS 16

// Tastenpaar (exakt 2 Bytes): beide Tasten sind Tastatur-Codes 0x01..0xFF (ASCII, Modifier, Sondertasten)
struct KeyPair {
  uint8_t first;
  uint8_t second;
};
