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

// Umlaut-Aktion für das macOS-Layout "U.S.": Tottaste Alt + u, danach der Vokal (ä ö ü Ä Ö Ü); ß = Alt + s
#define ACT_UMLAUT_BASE          0x150
#define ACT_UMLAUT_AE            0x150
#define ACT_UMLAUT_OE            0x151
#define ACT_UMLAUT_UE            0x152
#define ACT_UMLAUT_AE_UPPER      0x153
#define ACT_UMLAUT_OE_UPPER      0x154
#define ACT_UMLAUT_UE_UPPER      0x155
#define ACT_UMLAUT_SZ            0x156
#define NUM_UMLAUT_ACTIONS       7

// One-Shot-Modifier: Tippen gibt den Modifier nur der nächsten Taste (beider Hälften) mit; Halten wirkt wie
// ein normaler Modifier. Bit i der Maske = Code KEY_LEFT_CTRL + i. Der Master führt den Zustand.
#define ACT_ONE_SHOT_BASE        0x160
#define ACT_OSM_LCTRL            0x160
#define ACT_OSM_LSHIFT           0x161
#define ACT_OSM_LALT             0x162
#define ACT_OSM_LGUI             0x163
#define ACT_OSM_RCTRL            0x164
#define ACT_OSM_RSHIFT           0x165
#define ACT_OSM_RALT             0x166
#define ACT_OSM_RGUI             0x167
#define NUM_ONE_SHOT_ACTIONS     8
// Caps Word: Buchstaben groß, bis eine Taste außer Buchstabe, Ziffer, -, _, Backspace, Delete kommt
#define ACT_CAPS_WORD            0x168

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

// Makro: eine Taste spielt eine Folge aus Tippen, Drücken, Loslassen und Pausen ab; Index in userMacros[]
#define ACT_MACRO_BASE           0x170
#define MAX_MACROS               16
#define MAX_MACRO_STEPS          32
#define MACRO_MAX_PAUSE_MS       5000

#define MACRO_STEP_TAP           1   // Code drücken und im nächsten Schritt loslassen
#define MACRO_STEP_DOWN          2   // Code drücken (bleibt bis UP oder Makro-Ende gedrückt)
#define MACRO_STEP_UP            3   // Code loslassen
#define MACRO_STEP_PAUSE         4   // ms warten

// Makro-Schritt (exakt 4 Bytes, NVS-Format): Code 0x01..0xFF für TAP/DOWN/UP, ms 1..MACRO_MAX_PAUSE_MS für PAUSE
struct MacroStep {
  uint8_t type;
  uint8_t code;
  uint16_t ms;
};
