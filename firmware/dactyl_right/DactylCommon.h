#pragma once
/*
 * DactylCommon.h — gemeinsame Definitionen beider Hälften: Aktionscodes, Combo- und Key-Pair-Typen.
 * Vor den Keymaps und vor DactylLogic.h einbinden.
 */
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include "DactylMatrixConstants.h"
#include "DactylKeycodes.h" // KEY_*-Codes der Alternate-Repeat-Tabelle

// Einschwingzeit des Matrix-Treibers in Mikrosekunden (Row/Col auf LOW treiben, Pegel stabilisieren)
#define MATRIX_SETTLE_US 10

// Matrix-Test (Löttester, TEST_MATRIX 1|0): nur im RAM, Standard aus. Er endet beim Deep Sleep, beim Wechsel des
// Config Mode und bei einer getrennten BLE-Verbindung. matrixTestUsb = der Befehl kam per USB-Serial an dieser Hälfte;
// dann schreibt die linke Hälfte MATRIX_RAW selbst auf Serial, sonst schickt sie es per ESP-NOW an den Master.
// Ausgabe nur über USB-Serial, nie über BLE.
inline volatile bool matrixTestMode = false;
inline volatile bool matrixTestUsb = false;
inline void matrixTestSet(bool on, bool viaUsb = false) {
  // Reihenfolge: der Wi-Fi-Task (linke Hälfte) schreibt, loop() liest. Beim Einschalten zuerst den Weg, beim
  // Ausschalten zuerst den Schalter, damit loop() nie "an" mit dem Weg des vorigen Laufs sieht.
  if (on) {
    matrixTestUsb = viaUsb;
    matrixTestMode = true;
  } else {
    matrixTestMode = false;
    matrixTestUsb = false;
  }
}
// Takt für Pakete des Masters an die linke Hälfte (verirrtes "aus" und Auffrischen von "ein"): true = jetzt senden.
// "aus" geht höchstens je MATRIX_TEST_STRAY_OFF_MS raus, wenn ein MATRIX_RAW bei ausgeschaltetem Test eintrifft.
#define MATRIX_TEST_STRAY_OFF_MS 1000
// Der Master wiederholt "ein" bei laufendem Test, solange der Link steht (verlorenes TEST_MATRIX 1): idempotent
#define MATRIX_TEST_REFRESH_MS 2000
inline bool matrixTestPaceDue(unsigned long &lastSentMs, bool &everSent, unsigned long nowMs,
                                  unsigned long intervalMs = MATRIX_TEST_STRAY_OFF_MS) {
  if (everSent && (unsigned long)(nowMs - lastSentMs) < intervalMs) return false;
  everSent = true;
  lastSentMs = nowMs;
  return true;
}
// Auffrischen von "ein" an die linke Hälfte: nur bei laufendem Test und stehendem Link, alle MATRIX_TEST_REFRESH_MS.
// everSent wird bei ausgeschaltetem Test zurückgesetzt, damit der nächste Test sofort sendet.
inline bool matrixTestRefreshDue(bool testOn, bool linkUp, unsigned long &lastSentMs, bool &everSent, unsigned long nowMs) {
  if (!testOn) {
    everSent = false;
    return false;
  }
  return linkUp && matrixTestPaceDue(lastSentMs, everSent, nowMs, MATRIX_TEST_REFRESH_MS);
}
// Zeile "MATRIX_RAW:<Seite>,<Zeile>,<Spalte>,<1|0>" (1 = gedrückt) ohne Zeilenende; Rückgabe wie snprintf
inline int matrixRawFormat(char *buf, size_t size, char side, uint8_t row, uint8_t col, bool down) {
  return snprintf(buf, size, "MATRIX_RAW:%c,%u,%u,%d", side, (unsigned)row, (unsigned)col, down ? 1 : 0);
}

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
#define ACT_MEDIA_BRIGHTNESS_UP   0x128
#define ACT_MEDIA_BRIGHTNESS_DOWN 0x129
#define ACT_MEDIA_MISSION_CONTROL 0x12A
#define ACT_MEDIA_LAUNCHPAD       0x12B
#define ACT_MEDIA_FIRST           ACT_MEDIA_PLAY_PAUSE
#define ACT_MEDIA_LAST            ACT_MEDIA_LAUNCHPAD

#define ACT_MOUSE_LEFT           0x130
#define ACT_MOUSE_RIGHT          0x131
#define ACT_MOUSE_MIDDLE         0x132
#define ACT_MOUSE_WHEEL_UP       0x133
#define ACT_MOUSE_WHEEL_DOWN     0x134
// Mausbewegung: solange die Taste gehalten wird, bewegt sich der Zeiger mit wachsender Geschwindigkeit
#define ACT_MOUSE_UP             0x135
#define ACT_MOUSE_DOWN           0x136
#define ACT_MOUSE_LEFT_MOVE      0x137
#define ACT_MOUSE_RIGHT_MOVE     0x138
#define ACT_MOUSE_WHEEL_LEFT     0x139
#define ACT_MOUSE_WHEEL_RIGHT    0x13A
// Mauspräzision: solange MOUSE_SLOW gehalten wird, bewegt sich der Zeiger mit Schritt 1; solange MOUSE_FAST gehalten
// wird, mit dem Höchstschritt ab dem ersten Takt. Beide oder keine gehalten: normale Beschleunigung. Wirkt über beide Hälften.
#define ACT_MOUSE_SLOW           0x13B
#define ACT_MOUSE_FAST           0x13C

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
// Repeat: wiederholt die zuletzt ausgeführte Aktion beider Hälften (nicht Layer-Aktionen, nicht sich selbst)
#define ACT_REPEAT               0x169
// Layer lock: rastet die höchste gehaltene MO-Ebene (eigene oder der anderen Hälfte) als TG-Ebene ein;
// ein zweiter Druck oder ein Druck ohne gehaltene MO-Ebene löst die Einrastung
#define ACT_LAYER_LOCK           0x16A
// Alternate repeat: wiederholt das Gegenteil der zuletzt ausgeführten Aktion (Links <-> Rechts, Hoch <-> Runter, ...);
// ohne Gegenteil sendet die Taste nichts. Gehaltene Modifier bleiben wirksam.
#define ACT_ALT_REPEAT           0x16B
// Dynamisches Makro (nur Master): DM_REC startet und beendet die Aufnahme der Tastendrücke beider Hälften in einen
// RAM-Slot (höchstens MAX_MACRO_STEPS Schritte), DM_PLAY spielt ihn mit der Makro-Engine ab (DactylDynamicMacro.h)
#define ACT_DM_REC               0x16C
#define ACT_DM_PLAY              0x16D
// Leader-Taste: danach sammelt die Hälfte bis zu LEADER_MAX_KEYS Tasten (Zeitlimit leaderTimeoutMs je Taste); eine passende
// Folge aus userLeaderSeqs[] führt ihre Aktion aus, ohne Treffer passiert nichts. Die Tasten der Folge senden nichts.
#define ACT_LEADER               0x16E
// Key lock: die nächste gedrückte Taste, Medientaste oder Maustaste beider Hälften bleibt nach dem Loslassen gedrückt;
// ein zweiter Druck derselben Eingabe löst sie (DactylKeyLock.h). Ebenen-Tasten, KEY_LOCK selbst und Makros sperrt sie nicht.
#define ACT_KEY_LOCK             0x16F
// One-Shot-Ebene (OSL_0 .. OSL_7): Tippen merkt die Ebene für den nächsten Tastendruck beider Hälften vor, danach
// ist sie wieder gelöst; ein zweites Tippen nimmt die Vormerkung zurück; Halten wirkt wie MO_n und merkt nichts vor
#define ACT_OSL_BASE             0x180
#define NUM_OSL_ACTIONS          8
// BLE-Host-Slot wechseln (HOST_1 .. HOST_3, nur Master): gibt alle Tasten frei, speichert den Slot im NVS und startet
// BLE mit der statischen Random-Adresse des Slots neu (DactylBleHost.h). 0x170..0x17F gehören den Makros.
#define ACT_HOST_BASE            0x188
#define NUM_HOST_ACTIONS         3
// Swap hands: Halten spiegelt die Tastensuche dieser Hälfte (Fingerspalte c -> FINGER_COLS - 1 - c, Daumentasten gespiegelt),
// Tippen merkt den Wechsel für den nächsten Tastendruck vor, Doppel-Tippen rastet ihn bis zum nächsten Tippen ein
#define ACT_SWAP_HANDS           0x18B
// Satzanfang groß: schaltet um; solange aktiv, bekommt der erste Kleinbuchstabe nach '.', '!' oder '?' und Leertaste(n)
// Umschalt (DactylOneShot.h, Zustand auf dem Master für beide Hälften)
#define ACT_SENTENCE_CASE        0x18C
// Num Word: Tippen schaltet die Ebene numWordLayer ein; sie bleibt, solange Ziffern, Zahlzeichen, Modifier und Ebenen-Tasten
// folgen, und endet bei der ersten anderen Taste oder nach NUM_WORD_IDLE_MS ohne Tastendruck; ein zweites Tippen beendet sie
#define ACT_NUM_WORD             0x18D
#define NUM_WORD_IDLE_MS         5000
// Tapping-Term-Tasten: ein Tipp ändert tappingTermMs der Hälfte um TT_STEP_MS (RAM); beide Tasten zusammen für TT_SAVE_HOLD_MS
// gehalten speichern den Wert im NVS
#define ACT_TT_UP                0x18E
#define ACT_TT_DOWN              0x18F
#define TT_STEP_MS               10
#define TT_SAVE_HOLD_MS          1000
// Keep-awake: Tippen schaltet auf dem Master um; solange aktiv, schickt er alle KEEP_AWAKE_INTERVAL_MS einen Mausschritt von
// +1 und -1 Pixel, wenn der Mac verbunden und der Config Mode aus ist. Ein Tastendruck beider Hälften startet die Frist neu
#define ACT_KEEP_AWAKE           0x190
#define KEEP_AWAKE_INTERVAL_MS   60000
// Deep-sleep key: Ein Druck außerhalb des Config Mode merkt den Schlaf vor. Der Schlaf beginnt erst, wenn an dieser Hälfte keine
// Taste mehr gehalten ist, sonst weckt die gehaltene Taste das Board sofort wieder (ESP_EXT1_WAKEUP_ANY_HIGH)
#define ACT_DEEP_SLEEP           0x191
// Clear-state key: ein Druck beendet Makros, Mausbewegung, Ebenen-Einrastungen und alle Modi (Caps Word, Num Word, Swap hands ...)
#define ACT_CLEAR_STATE          0x192

// Tap-Toggle-Ebene: halten = MO_n, zweimal schnell tippen = TG_n (0x193 .. 0x19A für Ebene 0..7)
#define ACT_TT_BASE              0x193
#define NUM_TT_ACTIONS           8
inline bool isTapToggleAction(uint16_t a) { return a >= ACT_TT_BASE && a < ACT_TT_BASE + NUM_TT_ACTIONS; }
inline uint8_t tapToggleLayer(uint16_t a) { return (uint8_t)(a - ACT_TT_BASE); }

#define NUM_LAYERS 8

#define MAX_COMBOS 16

// Combo-Definition im RAM. Das alte NVS-Format ("combos_data") hat je Combo 8 Bytes
// (r1, c1, r2, c2, behavior, 1 Byte Padding, action als 16 Bit little endian); das neue Format "combos_v2" steht in DactylLogic.h (COMBO_NVS_*).
// layerMask: Bit i = die Combo gilt auf Ebene i. Standard alle Ebenen (0xFF). Ein Druck außerhalb der Maske
// wird nicht gepuffert, die Combo löst dort nie aus.
// Dritte Taste (r3, c3): 0xFF/0xFF = keine, die Combo hat zwei Tasten. windowMs: eigenes Zeitfenster in ms,
// 0 = globales comboTimeoutMs. Bei drei Tasten müssen alle Drücke in dieses Fenster fallen (spätester minus frühester).
#define COMBO_ALL_LAYERS 0xFF
#define COMBO_NO_KEY     0xFF
#define COMBO_WINDOW_MIN 10
#define COMBO_WINDOW_MAX 500
struct KeyCombo {
  uint8_t r1, c1;
  uint8_t r2, c2;
  uint8_t behavior; // 0 = KEY_PRESS, 1 = MODIFIER_HOLD, 2 = LAYER_TOGGLE
  uint16_t action;
  uint8_t layerMask = COMBO_ALL_LAYERS;
  uint8_t r3 = COMBO_NO_KEY, c3 = COMBO_NO_KEY;
  uint16_t windowMs = 0;
};

// Separater flüchtiger Runtime-Zustand für Tasten-Chording
struct ComboRuntime {
  bool active;
  unsigned long lastReleaseTime;
};

#define MAX_KEY_PAIRS 16

// Tastenpaar (exakt 4 Bytes): beide Tasten sind HID-Codes (Standard-Tasten 0x01..0xFF, Media 0x120..0x12B, Maus 0x130..0x134, Pan 0x139..0x13A)
struct KeyPair {
  uint16_t first;
  uint16_t second;
};

#define MAX_LEADER_SEQS  16
#define LEADER_MAX_KEYS  4
#define LEADER_TIMEOUT_MIN_MS 100
#define LEADER_TIMEOUT_MAX_MS 5000
#define LEADER_TIMEOUT_DEFAULT_MS 1000

// Zeitlimit für vorgemerkte One-Shot-Modifier und -Ebenen (oneShotTimeoutMs): 0 = aus, sonst 500..10000 ms
#define ONE_SHOT_TIMEOUT_MIN_MS 500
#define ONE_SHOT_TIMEOUT_MAX_MS 10000

// Auto-Mouse-Ebene (autoMouseLayer): 0..7 = Ebene, 0xFF = aus. mouseTimeoutMs: Frist ohne Mausaktion, 100..2000 ms
#define AUTO_MOUSE_LAYER_OFF 0xFF
#define MOUSE_TIMEOUT_MIN_MS 100
#define MOUSE_TIMEOUT_MAX_MS 2000
#define MOUSE_TIMEOUT_DEFAULT_MS 500

// Zeitlimit für per TG_n eingerastete Ebenen (layerTimeoutMs): 0 = aus, sonst 1000..60000 ms
#define LAYER_TIMEOUT_MIN_MS 1000
#define LAYER_TIMEOUT_MAX_MS 60000

// Leader-Folge (exakt 6 Bytes, NVS-Format): keys = Tastencodes 1..255 ohne Modifier, ungenutzte Plätze 0 (die belegten
// stehen vorn); action = Tastencode 1..255 ohne Modifier, Tastenpaar (ACT_KEY_PAIR_BASE + n) oder Makro (ACT_MACRO_BASE + n)
struct LeaderSeq {
  uint8_t keys[LEADER_MAX_KEYS];
  uint16_t action;
};
static_assert(sizeof(LeaderSeq) == 6, "LeaderSeq ist das 6-Byte-NVS-Format");

// Makro: eine Taste spielt eine Folge aus Tippen, Drücken, Loslassen und Pausen ab; Index in userMacros[]
#define ACT_MACRO_BASE           0x170
#define MAX_MACROS               16
#define MAX_MACRO_STEPS          32
#define MACRO_MAX_PAUSE_MS       5000

#define MACRO_STEP_TAP           1   // Code drücken und im nächsten Schritt loslassen
#define MACRO_STEP_DOWN          2   // Code drücken (bleibt bis UP oder Makro-Ende gedrückt)
#define MACRO_STEP_UP            3   // Code loslassen
#define MACRO_STEP_PAUSE         4   // ms warten

// Makro-Schritt (exakt 4 Bytes, NVS-Format): Code 0x01..0xFF für TAP/DOWN/UP, ms 1..MACRO_MAX_PAUSE_MS für PAUSE.
// Eine Consumer-Aktion (ACT_MEDIA_FIRST..ACT_MEDIA_LAST) steht bei TAP/DOWN/UP mit code 0 und der Aktion in ms.
struct MacroStep {
  uint8_t type;
  uint8_t code;
  uint16_t ms;
};

// Mod-Tap-Entscheidungsmodi bei überlappendem Tippen (Home-Row Mods)
enum HoldTapMode : uint8_t {
  HOLD_MODE_OTHER_KEY_PRESS = 0, // Sofort Hold bei zweiter Taste
  HOLD_MODE_PERMISSIVE = 1,      // Hold nur bei verschachteltem Press+Release vor Tapping-Term
  HOLD_MODE_TAP_PREFERRED = 2    // Hold nur nach Ablauf des Tapping-Terms
};
#define DEFAULT_HOLD_TAP_MODE HOLD_MODE_OTHER_KEY_PRESS

// Eigene Alternate-Repeat-Paare (userAltRepeats): key -> alt, Tastaturcodes 1..255, gerichtet (e -> u sagt nichts über u -> e)
#define MAX_ALT_REPEATS 16
struct AltRepeatPair {
  uint8_t key;
  uint8_t alt;
};
static_assert(sizeof(AltRepeatPair) == 2, "AltRepeatPair ist das 2-Byte-NVS-Format");

// Alt-Aktion aus der eigenen Tabelle; 0 = kein Eintrag für a. Der erste Eintrag mit key == a gewinnt.
inline uint16_t altRepeatCustom(const AltRepeatPair *table, uint8_t count, uint16_t a) {
  if (a == 0 || a > 0xFF) return 0;
  for (uint8_t i = 0; i < count; i++) {
    if (table[i].key == a) return table[i].alt;
  }
  return 0;
}

// Alternate repeat: das Gegenteil einer Aktion; 0 = die Aktion hat keins (die Taste sendet dann nichts)
// Die feste Tabelle; eigene Paare prüft altRepeatResolve() in DactylLogic.h zuerst.
inline uint16_t altRepeatAction(uint16_t a) {
  static const uint16_t PAIRS[][2] = {
    {KEY_LEFT_ARROW, KEY_RIGHT_ARROW}, {KEY_UP_ARROW, KEY_DOWN_ARROW},
    {KEY_PAGE_UP, KEY_PAGE_DOWN}, {KEY_HOME, KEY_END}, {KEY_BACKSPACE, KEY_DELETE},
    {0x133, 0x134},  // Scroll up <-> down
    {ACT_MOUSE_WHEEL_LEFT, ACT_MOUSE_WHEEL_RIGHT},  // Pan left <-> right
    {ACT_MEDIA_BRIGHTNESS_UP, ACT_MEDIA_BRIGHTNESS_DOWN},  // Brightness up <-> down
    {0x122, 0x123},  // Volume up <-> down
    {0x124, 0x125},  // Next <-> previous track
  };
  for (const auto &p : PAIRS) {
    if (a == p[0]) return p[1];
    if (a == p[1]) return p[0];
  }
  return 0;
}

inline bool isRepeatKeyAction(uint16_t a) { return a == ACT_REPEAT || a == ACT_ALT_REPEAT; }
inline bool isBleHostAction(uint16_t a) { return a >= ACT_HOST_BASE && a < ACT_HOST_BASE + NUM_HOST_ACTIONS; }
inline bool isDynamicMacroAction(uint16_t a) { return a == ACT_DM_REC || a == ACT_DM_PLAY; }
