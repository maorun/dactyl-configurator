#pragma once
#include "DactylCommon.h"
#include "DactylLeader.h"
#include "DactylBleHost.h"

/*
 * =============================================================================
 * Dactyl Firmware — Gemeinsame Logik (Layer, Tap-Hold, Combos, Konfig-Befehle, NVS)
 * =============================================================================
 * Wird sowohl von dactyl_right.ino als auch von firmware/tests/test_firmware_logic.cpp
 * eingebunden, damit die Unit-Tests exakt den Produktionscode prüfen.
 *
 * Die einbindende Übersetzungseinheit muss VOR dem #include deklarieren:
 *   NUM_LAYERS, NUM_ROWS, NUM_COLS, MAX_COMBOS, CONFIG_MODE_MAGIC,
 *   KeyCombo, ComboRuntime, comboRuntime[], userCombos[], numCombos,
 *   KEYMAP[][][], HOLDMAP[][][], DTAPMAP[][][], TAPTERMMAP[][][], layerNames[],
 *   MAX_KEY_PAIRS, ACT_KEY_PAIR_BASE, KeyPair, userKeyPairs[], numKeyPairs,
 *   nur Master (DACTYL_KEY_OVERRIDES): KeyOverride, userKeyOverrides[], numKeyOverrides (DactylKeyOverride.h),
 *   MAX_ALT_REPEATS, AltRepeatPair, userAltRepeats[], numAltRepeats (eigene Alternate-Repeat-Paare),
 *   MAX_LEADER_SEQS, LeaderSeq, userLeaderSeqs[], numLeaderSeqs, leaderTimeoutMs (Leader-Folgen, DactylLeader.h),
 *   MAX_MACROS, MAX_MACRO_STEPS, ACT_MACRO_BASE, MacroStep, userMacros[][], macroLengths[], userMacroRepeat[], numMacros,
 *   momentaryLayers[], toggleLayers[], keyState[][], pressedAction[][],
 *   (remoteMomentaryLayers definiert diese Datei: MO-Ebenen der anderen Hälfte)
 *   keyPressTime[][], keySentToHost[][],
 *   isConfigMode, enterConfigRequested, exitConfigRequested, lastActivityTime,
 *   configMutex, preferences, pConfigCharacteristic, bleKeyboard,
 *   triLayerRules[6], numTriLayers (Tri-Layer-Regeln, Settings-Block),
 *   capsLedEnabled (Setting: Onboard-LED zeigt Caps Lock; nur der Master wertet es aus),
 *   deviceName, debounceMs, comboTimeoutMs, tappingTermMs, quickTapMs, requirePriorIdleMs, chordalHold, retroTap, numWordLayer, autoShift, autoShiftMs, oneShotTimeoutMs, layerTimeoutMs, standbyTimeoutMinutes, deepSleepTimeoutMinutes,
 *   void handleConfigCommand(String, bool = false);
 *   void sendConfigNotification(String, bool = false);
 */

#include "DactylMatrixConstants.h"

// Physische Config-Mode-Combo (500 ms halten). Rechts: R0C0 + R4C5; links gespiegelt: R0C5 + R4C0
#ifndef CONFIG_COMBO_R1
#define CONFIG_COMBO_R1 RIGHT_CONFIG_COMBO_R1
#define CONFIG_COMBO_C1 RIGHT_CONFIG_COMBO_C1
#define CONFIG_COMBO_R2 RIGHT_CONFIG_COMBO_R2
#define CONFIG_COMBO_C2 RIGHT_CONFIG_COMBO_C2
#endif

// Gerätename ohne NVS-Eintrag und BLE-Name im Config Mode
#ifndef DEFAULT_DEVICE_NAME
#define DEFAULT_DEVICE_NAME "Dactyl Keyboard"
#endif
#ifndef CONFIG_BLE_NAME
#define CONFIG_BLE_NAME "Dactyl Config"
#endif
// Hälfte in DEVICE_INFO ("R" oder "L"): App und Server erkennen damit das Board am Port
#ifndef DEVICE_SIDE
#define DEVICE_SIDE "R"
#endif
// Firmwarestand in DEVICE_INFO ("fw"). Der Master definiert DEVICE_INFO_LEFT_FW() vor dem #include
// (splitLeftFwStatus: > 0 Stand, 0 unbekannt, -1 linke Firmware ohne Version); nur dann enthält DEVICE_INFO
// "left_fw".
#include "DactylVersion.h"
#include "DactylHostLeds.h"
#include "DactylDebounce.h"
#ifdef ARDUINO
#include <Update.h>
#include <esp_ota_ops.h>
#endif
#include "DactylOtaVerify.h"

#if __has_include("DactylOtaKey.h")
#include "DactylOtaKey.h"
#elif __has_include("../dactyl_right/DactylOtaKey.h")
#include "../dactyl_right/DactylOtaKey.h"
#endif

#ifndef DACTYL_OTA_KEY_PRESENT
#ifdef ARDUINO
#error "DactylOtaKey.h fehlt. Erzeuge die Datei mit: python3 scripts/generate-ota-key.py --if-missing"
#else
#define DACTYL_OTA_KEY_PRESENT 1
static const uint8_t DACTYL_OTA_PUBLIC_KEY[32] = {
  0xe7,0xe4,0x4f,0xa1,0xd0,0x29,0xc1,0x28,0x4d,0xd8,0xf4,0x08,0xee,0xd0,0x2a,0xa9,
  0x66,0x8f,0xe3,0x38,0x5e,0xe5,0x4f,0xc1,0x47,0xf9,0x20,0x07,0xd3,0x16,0xf6,0x73
};
#endif
#endif

// -----------------------------------------------------------------------------
// BLE OTA Firmware Update
// -----------------------------------------------------------------------------
static bool otaInProgress = false;
static size_t otaExpectedSize = 0;
static size_t otaWrittenBytes = 0;
static uint16_t otaNextSeq = 0;
static uint8_t otaExpectedSig[64] = {0};
static unsigned long lastOtaChunkTime = 0;
static DactylOtaVerifier otaVerifier;

void resetOtaState() {
  if (otaInProgress) {
    Update.abort();
  }
  otaInProgress = false;
  otaExpectedSize = 0;
  otaWrittenBytes = 0;
  otaNextSeq = 0;
  memset(otaExpectedSig, 0, sizeof(otaExpectedSig));
  lastOtaChunkTime = 0;
}

void handleOtaChunk(const uint8_t *data, size_t len) {
  if (!otaInProgress) {
    sendConfigNotification("OTA_ERR:NOT_IN_PROGRESS");
    return;
  }
  if (len < 2) {
    sendConfigNotification("OTA_ERR:CHUNK_TOO_SHORT");
    return;
  }
  uint16_t seq = (uint16_t)data[0] | ((uint16_t)data[1] << 8);
  if (seq != otaNextSeq) {
    Update.abort();
    otaInProgress = false;
    sendConfigNotification("OTA_ERR:SEQ_MISMATCH " + String(seq) + " expected " + String(otaNextSeq));
    return;
  }
  size_t payloadLen = len - 2;
  if (otaWrittenBytes + payloadLen > otaExpectedSize) {
    Update.abort();
    otaInProgress = false;
    sendConfigNotification("OTA_ERR:SIZE_EXCEEDED");
    return;
  }
  if (payloadLen > 0) {
    size_t written = Update.write(const_cast<uint8_t*>(data + 2), payloadLen);
    if (written != payloadLen) {
      Update.abort();
      otaInProgress = false;
      sendConfigNotification("OTA_ERR:WRITE_FAILED");
      return;
    }
    otaVerifier.update(data + 2, payloadLen);
    otaWrittenBytes += payloadLen;
  }
  otaNextSeq++;
  lastOtaChunkTime = millis();
  lastActivityTime = millis();

  if ((otaNextSeq % 16 == 0) || (otaWrittenBytes == otaExpectedSize)) {
    sendConfigNotification("OTA_ACK:" + String(seq) + ":" + String(otaWrittenBytes));
  }
}

void processOtaTimeout() {
  if (otaInProgress) {
    if (millis() - lastOtaChunkTime >= 15000) {
      Update.abort();
      otaInProgress = false;
      sendConfigNotification("OTA_ERR:TIMEOUT");
    }
  }
}

// Standardwert des Tapping-Terms (Mod-Tap und Tap-Dance) ohne NVS-Eintrag; zur Laufzeit gilt tappingTermMs
#ifndef TAPPING_TERM_MS
#define TAPPING_TERM_MS 200
#endif
#define TAPPING_TERM_MIN_MS 100
#define TAPPING_TERM_MAX_MS 500
// Quick-Tap-Term (Mod-Tap): 0 = aus; sonst gilt ein erneuter Druck derselben Mod-Tap-Taste innerhalb dieser Zeit
// nach ihrem Tipp sofort als gehaltener Tipp (der Host wiederholt das Zeichen)
#define QUICK_TAP_MAX_MS 500
// Hold nur nach einer Tipp-Pause (requirePriorIdleMs): 0 = aus; sonst gilt eine Mod-Tap-Taste, die weniger als diese Zeit
// nach dem letzten Tastendruck gedrückt wird, sofort als Tipp. Layer-Tap mit MO_n ist ausgenommen.
#define PRIOR_IDLE_MAX_MS 500
// Opposite-Hand-Regel (chordalHold): 0 = aus, 1 = an. Die Daumenreihe (letzte Matrixzeile) ist ausgenommen.
#define CHORDAL_THUMB_ROW (NUM_ROWS - 1)
// Auto Shift (autoShift): 0 = aus, 1 = alle Zeichentasten, 2 = Ziffern und Symbole, 3 = nur Buchstaben, 4 = nur Symbole. Eine Zeichentaste ohne Halte-Aktion sendet das umgeschaltete Zeichen, wenn sie
// länger als autoShiftMs gehalten wird. Standardwert des Zeitlimits ohne NVS-Eintrag: AUTO_SHIFT_DEFAULT_MS.
#define AUTO_SHIFT_MAX_MODE 4
#define AUTO_SHIFT_MIN_MS 50
#define AUTO_SHIFT_MAX_MS 500
#define AUTO_SHIFT_DEFAULT_MS 175
// Eigener Tapping-Term je Taste (TAPTERMMAP, je Ebene): 0 = Wert der Hälfte (tappingTermMs)

// -----------------------------------------------------------------------------
// Layer-Auflösung
// -----------------------------------------------------------------------------
// Von der anderen Hälfte gehaltene MO-Ebenen (Bit i = Ebene i, SPLIT_OP_LAYER_STATE). Ein MO auf einer
// Hälfte aktiviert die Ebene auf beiden; die TG-Ebenen gleichen die Hälften direkt in toggleLayers[] ab.
uint8_t remoteMomentaryLayers = 0;

// One-Shot-Ebenen (ACT_OSL_BASE + n). Bit n = Ebene n.
// oslArmed: von dieser Hälfte vorgemerkt; remoteOslArmed: von der anderen Hälfte vorgemerkt (SPLIT_OP_OSL).
// oslHeld: OSL-Tasten dieser Hälfte, die gerade gehalten werden; oslUsed: davon die Tasten, während deren Halten
// eine andere Taste dieser Hälfte kam (Halten statt Tippen, kein Vormerken beim Loslassen).
// oslUsedToSend: von dieser Hälfte verbrauchte Vormerkungen der anderen Hälfte, die noch zu melden sind.
uint8_t oslArmed = 0;
uint8_t remoteOslArmed = 0;
uint8_t oslHeld = 0;
uint8_t oslUsed = 0;
uint8_t oslUsedToSend = 0;
uint8_t remoteOslIgnore = 0;
unsigned long remoteOslIgnoreMs = 0;
unsigned long oslPressTime[NUM_LAYERS] = {};
uint16_t oslTerm[NUM_LAYERS] = {};
unsigned long remoteOslRxMs = 0;
uint8_t oslSeenArmed = 0;     // oslArmed beim letzten oslExpireLocal(): ein anderer Wert startet die Frist neu
unsigned long oslArmedMs = 0;

bool isOslAction(uint16_t a) {
  return a >= ACT_OSL_BASE && a < ACT_OSL_BASE + NUM_OSL_ACTIONS;
}

// Tri-Layer: bis zu TRI_LAYER_MAX_RULES Regeln {a, b, target} (je drei Bytes in triLayerRules[]).
// Sind die Ebenen a und b aktiv (MO lokal, MO der anderen Hälfte oder TG), gilt auch die Ebene target.
#define TRI_LAYER_MAX_RULES 2
#define TRI_LAYER_RULE_BYTES 3

// Eine Regel ist gültig, wenn a, b und target Ebenen 1..7 sind, a != b und target weder a noch b ist
bool isValidTriLayerRule(int a, int b, int t) {
  if (a < 1 || b < 1 || t < 1 || a >= NUM_LAYERS || b >= NUM_LAYERS || t >= NUM_LAYERS) return false;
  if (a > 7 || b > 7 || t > 7) return false;
  return a != b && t != a && t != b;
}

uint8_t getActiveLayer() {
  // Momentary Layer 0 zwingt temporär Base-Layer, auch von der anderen Hälfte
  // Vorgemerkte und gehaltene One-Shot-Ebenen gelten wie MO-Ebenen (oslHeld getrennt von momentaryLayers: eine gehaltene
  // MO_n auf derselben Ebene bleibt beim Loslassen der OSL-Taste erhalten)
  uint8_t armed = (uint8_t)(oslArmed | remoteOslArmed | oslHeld);
  if (momentaryLayers[0] || (remoteMomentaryLayers & 1) || (armed & 1)) return 0;
  uint8_t active = 0;
  for (int l = 1; l < NUM_LAYERS && l < 8; l++) {
    if (momentaryLayers[l] || toggleLayers[l] || (remoteMomentaryLayers & (1u << l)) || (armed & (1u << l))) active |= (uint8_t)(1u << l);
  }
  // Tri-Layer-Regeln einmal auswerten (keine Kaskade): das Ziel gilt zusätzlich zu a und b
  uint8_t withTri = active;
  for (int i = 0; i < numTriLayers && i < TRI_LAYER_MAX_RULES; i++) {
    uint8_t a = triLayerRules[i * TRI_LAYER_RULE_BYTES], b = triLayerRules[i * TRI_LAYER_RULE_BYTES + 1];
    uint8_t t = triLayerRules[i * TRI_LAYER_RULE_BYTES + 2];
    if (isValidTriLayerRule(a, b, t) && (active & (1u << a)) && (active & (1u << b))) withTri |= (uint8_t)(1u << t);
  }
  for (int l = NUM_LAYERS - 1; l > 0; l--) {
    if (l < 8 && (withTri & (1u << l))) return l;
  }
  return 0;
}

// Ebene, auf der eine Taste gedrückt wurde (Combo-Ebenenmaske), als Ebene + 1; 0 = kein Druck vermerkt, dann gilt
// die aktive Ebene. Der Wert bleibt vom Druck bis zum Ende der Loslass-Behandlung stehen, damit eine Ebene, die
// zwischen Druck und Loslassen wechselt, die Puffer-Entscheidung (gesendet oder Combo-Kandidat) nicht ändert.
#define COMBO_NVS_VERSION       2
#define COMBO_NVS_RECORD_BYTES  12
#define COMBO_NVS_LEGACY_BYTES  8

// Ein Druck, der in deferredQueue wartet, hat noch keinen Eintrag: er wird beim Abspielen mit der dann aktiven
// Ebene aufgelöst (wie seine Tastenbelegung), bis dahin gilt die aktive Ebene.
uint8_t comboPressLayer1[NUM_ROWS][NUM_COLS] = {};

uint8_t comboLayerForKey(uint8_t r, uint8_t c) {
  if (comboPressLayer1[r][c] > 0) return (uint8_t)(comboPressLayer1[r][c] - 1);
  return getActiveLayer();
}

// true, wenn die Combo i auf der Ebene gilt (Bit der Ebene in layerMask)
bool comboAppliesOnLayer(uint8_t i, uint8_t layer) {
  return layer < 8 && ((userCombos[i].layerMask >> layer) & 1);
}

// true, wenn die Combo eine dritte Taste hat
bool comboHasThirdKey(uint8_t i) {
  return userCombos[i].r3 != COMBO_NO_KEY && userCombos[i].c3 != COMBO_NO_KEY;
}

// true, wenn (r, c) eine der Tasten der Combo i ist (zwei oder drei Tasten)
bool comboContainsKey(uint8_t i, uint8_t r, uint8_t c) {
  const KeyCombo &cb = userCombos[i];
  return (cb.r1 == r && cb.c1 == c) || (cb.r2 == r && cb.c2 == c) || (comboHasThirdKey(i) && cb.r3 == r && cb.c3 == c);
}

// Zeitfenster der Combo i in ms: eigenes Fenster oder das globale comboTimeoutMs (windowMs = 0)
unsigned long comboWindowMs(uint8_t i) {
  return userCombos[i].windowMs ? userCombos[i].windowMs : comboTimeoutMs;
}

// Wartezeit, bis eine gepufferte Taste (r, c) als Einzeltaste ausgeht: das größte Fenster der Combos, die auf der
// Ebene des Drucks gelten und die Taste enthalten. Ohne solche Combo gilt comboTimeoutMs.
unsigned long comboBufferMs(uint8_t r, uint8_t c) {
  uint8_t layer = comboLayerForKey(r, c);
  unsigned long ms = 0;
  for (uint8_t i = 0; i < numCombos; i++) {
    if (comboContainsKey(i, r, c) && comboAppliesOnLayer(i, layer) && comboWindowMs(i) > ms) ms = comboWindowMs(i);
  }
  return ms ? ms : comboTimeoutMs;
}

// true, wenn zwei Druckzeitpunkte höchstens window ms auseinander liegen (Überlauf-sicher)
static inline bool comboTimesWithin(unsigned long t1, unsigned long t2, unsigned long window) {
  return (unsigned long)(t1 - t2) <= window || (unsigned long)(t2 - t1) <= window;
}

// true, wenn alle Tasten der Combo i gedrückt sind und paarweise im Fenster der Combo gedrückt wurden
bool comboKeysInWindow(uint8_t i) {
  const KeyCombo &cb = userCombos[i];
  unsigned long w = comboWindowMs(i);
  unsigned long t1 = keyPressTime[cb.r1][cb.c1], t2 = keyPressTime[cb.r2][cb.c2];
  if (!comboTimesWithin(t1, t2, w)) return false;
  if (!comboHasThirdKey(i)) return true;
  unsigned long t3 = keyPressTime[cb.r3][cb.c3];
  return comboTimesWithin(t1, t3, w) && comboTimesWithin(t2, t3, w);
}

// true, wenn alle Tasten der Combo i gerade gedrückt sind
bool comboAllPressed(uint8_t i) {
  const KeyCombo &cb = userCombos[i];
  return keyState[cb.r1][cb.c1] && keyState[cb.r2][cb.c2] && (!comboHasThirdKey(i) || keyState[cb.r3][cb.c3]);
}

// true, wenn alle Tasten der Combo i auf einer Ebene der Maske gedrückt wurden: nur dann wurden sie gepuffert
bool comboOnMaskLayers(uint8_t i) {
  const KeyCombo &cb = userCombos[i];
  return comboAppliesOnLayer(i, comboLayerForKey(cb.r1, cb.c1)) && comboAppliesOnLayer(i, comboLayerForKey(cb.r2, cb.c2)) &&
         (!comboHasThirdKey(i) || comboAppliesOnLayer(i, comboLayerForKey(cb.r3, cb.c3)));
}

// Eigene MO-Ebenen und eingerastete Ebenen als Bitmaske für den Layer-Abgleich
uint8_t localMomentaryLayerMask() {
  uint8_t m = 0;
  for (int l = 0; l < NUM_LAYERS && l < 8; l++) if (momentaryLayers[l]) m |= (uint8_t)(1u << l);
  return (uint8_t)(m | oslHeld);   // eine gehaltene OSL-Taste wirkt auf der anderen Hälfte wie MO_n
}
uint8_t toggleLayerMask() {
  uint8_t m = 0;
  for (int l = 1; l < NUM_LAYERS && l < 8; l++) if (toggleLayers[l]) m |= (uint8_t)(1u << l);
  return m;
}

// Layer-Zustand der anderen Hälfte übernehmen: ihre MO-Ebenen, mit setToggles auch die TG-Ebenen.
// Meldet einen Wechsel der aktiven Ebene als LAYER-Zeile (die App folgt ihr). Liefert true bei Wechsel.
bool applyRemoteLayerState(uint8_t momentary, bool setToggles, uint8_t toggles) {
  uint8_t before = getActiveLayer();
  remoteMomentaryLayers = momentary;
  if (setToggles) {
    for (int l = 1; l < NUM_LAYERS && l < 8; l++) toggleLayers[l] = (toggles >> l) & 1;
  }
  uint8_t after = getActiveLayer();
  if (after == before) return false;
  Serial.printf("LAYER: SPLIT -> Layer %d\n", after);
  return true;
}

// -----------------------------------------------------------------------------
// Num Word (ACT_NUM_WORD)
// -----------------------------------------------------------------------------
// Tippen rastet die Ebene numWordLayer (1..7; 0 = Num Word ohne Wirkung) als TG-Ebene ein. Sie bleibt, solange die gedrückten
// Tasten dieser Hälfte Ziffern, Zahlzeichen (. , - + * / =), Modifier, Ziffernblock- oder Ebenen-Tasten sind; jeder solche
// Druck startet die Frist von NUM_WORD_IDLE_MS neu. Die erste andere Taste oder die Frist beendet Num Word. Die Ebene
// gleicht der Layer-Abgleich wie jede TG-Ebene mit der anderen Hälfte ab.
bool numWordActive = false;
uint8_t numWordOn = 0;            // die von Num Word eingerastete Ebene (gilt nur bei numWordActive)
unsigned long numWordLastMs = 0;

// true für Aktionen, die Num Word offen lassen
bool isNumWordKeepAction(uint16_t a) {
  if (a == 0) return true;   // transparent und leer
  if (a <= 0xFF) {
    if (a >= '0' && a <= '9') return true;
    if (a == '.' || a == ',' || a == '-' || a == '+' || a == '*' || a == '/' || a == '=') return true;
    if (a >= KEY_LEFT_CTRL && a <= KEY_RIGHT_GUI) return true;
    return a >= KEY_NUM_SLASH && a <= KEY_NUM_PERIOD;
  }
  if (a >= 0x100 && a <= 0x119) return true;                       // MO_n, TG_n, LAYER_UP, LAYER_DOWN
  return a == ACT_LAYER_LOCK || isOslAction(a) || a == ACT_NUM_WORD;
}

void numWordStop() {
  if (!numWordActive) return;
  uint8_t before = getActiveLayer();
  numWordActive = false;
  if (numWordOn > 0 && numWordOn < NUM_LAYERS) toggleLayers[numWordOn] = false;
  uint8_t after = getActiveLayer();
  if (after != before) Serial.printf("LAYER: NUM_WORD aus -> Layer %d\n", after);
}

// Druck von ACT_NUM_WORD: ein ruhender Zustand schaltet ein, ein aktiver aus
void numWordPress(unsigned long now) {
  if (numWordActive) {
    numWordStop();
    return;
  }
  if (numWordLayer == 0 || numWordLayer >= NUM_LAYERS) return;
  uint8_t before = getActiveLayer();
  numWordOn = numWordLayer;
  toggleLayers[numWordOn] = true;
  numWordActive = true;
  numWordLastMs = now;
  uint8_t after = getActiveLayer();
  if (after != before) Serial.printf("LAYER: NUM_WORD an -> Layer %d\n", after);
}

// Ein Tastendruck dieser Hälfte (a, b, c = aufgelöste Tipp-, Halte- und Doppel-Tipp-Aktion). Der Aufrufer hat die Ebene der
// Taste schon aufgelöst; die Taste selbst läuft noch auf der Num-Word-Ebene.
// Liefert true, wenn dieser Druck Num Word beendet hat: der Aufrufer löst die Taste dann auf der neuen Ebene neu auf
bool numWordNoteKeyPress(uint16_t a, uint16_t b, uint16_t c, unsigned long now) {
  if (!numWordActive) return false;
  // Eine von Hand gelöste Ebene (TG, Layer Lock, layerTimeoutMs) beendet Num Word ohne weitere Wirkung
  if (!toggleLayers[numWordOn]) { numWordActive = false; return false; }
  if (a == ACT_NUM_WORD || b == ACT_NUM_WORD || c == ACT_NUM_WORD) return false;   // numWordPress entscheidet
  if (isNumWordKeepAction(a) && isNumWordKeepAction(b) && isNumWordKeepAction(c)) {
    numWordLastMs = now;
    return false;
  }
  numWordStop();
  return true;
}

// Aufruf in loop(): ohne Tastendruck für NUM_WORD_IDLE_MS endet Num Word
void numWordExpire(unsigned long now) {
  if (!numWordActive) return;
  if (!toggleLayers[numWordOn]) { numWordActive = false; return; }
  if ((unsigned long)(now - numWordLastMs) >= NUM_WORD_IDLE_MS) numWordStop();
}

// -----------------------------------------------------------------------------
// One-Shot-Ebene (OSL_0 .. OSL_7)
// -----------------------------------------------------------------------------
// Tippen merkt die Ebene für den nächsten Tastendruck beider Hälften vor; danach ist sie gelöst. Ein zweites Tippen
// nimmt die Vormerkung zurück. Halten (länger als der Tapping-Term oder mit einer Taste dazwischen) wirkt wie MO_n und
// merkt nichts vor. Jede Hälfte führt ihre eigenen Vormerkungen (oslArmed) und spiegelt die der anderen (remoteOslArmed,
// SPLIT_OP_OSL). Verbraucht diese Hälfte eine Vormerkung der anderen, meldet sie das (oslUsedToSend), damit die Ebene
// nur einmal gilt. Die Zeitgrenzen gelten für das Spiegelbild: es verfällt ohne Paket und ein verbrauchtes Bit bleibt
// bis zur Bestätigung (Bit 0 im Zustand des Besitzers) oder OSL_IGNORE_MS gesperrt, sonst setzte ein altes Auffrischen
// es wieder.
#ifndef OSL_REMOTE_TIMEOUT_MS
#define OSL_REMOTE_TIMEOUT_MS 3000
#endif
#define OSL_IGNORE_MS 500

inline uint8_t oslBit(uint16_t action) { return (uint8_t)(1u << (action - ACT_OSL_BASE)); }

void oslAnnounce(uint8_t before) {
  uint8_t after = getActiveLayer();
  if (after != before) Serial.printf("LAYER: OSL -> Layer %d\n", after);
}

// Taste mit OSL gedrückt: die Ebene gilt wie bei MO_n, solange die Taste gehalten wird
// pressTime: Zeitpunkt des physischen Drucks der Taste (0 = unbekannt, dann jetzt). Eine OSL-Aktion, die erst nach
// dem Tapping-Term als Halte-Aktion aufgelöst wird, gilt so beim Loslassen als gehalten und merkt nichts vor.
// term: Tapping-Term der Taste (effectiveTapTerm, TAPTERMMAP); der Aufrufer löst ihn auf.
void oslPress(uint16_t action, unsigned long pressTime, uint16_t term) {
  uint8_t n = (uint8_t)(action - ACT_OSL_BASE), bit = oslBit(action);
  oslHeld |= bit;
  oslUsed &= (uint8_t)~bit;
  oslPressTime[n] = pressTime ? pressTime : millis();
  oslTerm[n] = term;
}

// Taste mit OSL losgelassen: ein kurzes Tippen ohne Taste dazwischen merkt vor oder nimmt zurück
void oslRelease(uint16_t action) {
  uint8_t n = (uint8_t)(action - ACT_OSL_BASE), bit = oslBit(action);
  uint8_t before = getActiveLayer();
  oslHeld &= (uint8_t)~bit;
  bool used = (oslUsed & bit) != 0;
  oslUsed &= (uint8_t)~bit;
  if (used || (unsigned long)(millis() - oslPressTime[n]) >= oslTerm[n]) {
    oslAnnounce(before);
    return;
  }
  oslArmed ^= bit;
  oslAnnounce(before);
}

// Ein Tastendruck (a, b, c = Tipp-, Halte- und Doppel-Tipp-Aktion der Taste) verbraucht die Vormerkungen beider Hälften.
// Eine OSL-Taste verbraucht nichts. Der Aufrufer hat die Ebene der Taste schon aufgelöst.
void oslNoteKeyPress(uint16_t a, uint16_t b, uint16_t c) {
  if (isOslAction(a) || isOslAction(b) || isOslAction(c)) return;
  oslUsed |= oslHeld;
  // Hält die andere Hälfte eine Ebene (MO oder OSL), meldet dieser Druck sie ihr als benutzt: eine gehaltene OSL-Taste dort
  // merkt beim Loslassen nichts vor (schneller Akkord über beide Hälften innerhalb des Tapping-Terms)
  if (remoteMomentaryLayers) {
    oslUsedToSend |= remoteMomentaryLayers;
    remoteOslIgnoreMs = millis();
  }
  if (!(oslArmed | remoteOslArmed)) return;
  uint8_t before = getActiveLayer();
  oslArmed = 0;
  if (remoteOslArmed) {
    oslUsedToSend |= remoteOslArmed;
    remoteOslIgnore |= remoteOslArmed;
    remoteOslIgnoreMs = millis();
    remoteOslArmed = 0;
  }
  oslAnnounce(before);
}

// SPLIT_OP_OSL (Zustand): die Vormerkungen der anderen Hälfte
void applyRemoteOslState(uint8_t armed, unsigned long now) {
  uint8_t before = getActiveLayer();
  remoteOslIgnore &= armed;
  oslUsedToSend &= armed;
  remoteOslArmed = (uint8_t)(armed & ~remoteOslIgnore);
  remoteOslRxMs = now;
  oslAnnounce(before);
}

// SPLIT_OP_OSL (verbraucht): die andere Hälfte hat Vormerkungen dieser Hälfte verbraucht
void applyRemoteOslUsed(uint8_t mask) {
  uint8_t before = getActiveLayer();
  oslUsed |= (uint8_t)(mask & oslHeld);   // die andere Hälfte hat getippt, während die OSL-Taste hier gehalten wird
  oslArmed &= (uint8_t)~mask;
  oslAnnounce(before);
}

// Ohne Paket der anderen Hälfte verfällt ihr Spiegelbild (Hälfte aus, Deep Sleep oder Funkausfall)
void oslExpireRemote(unsigned long now) {
  if ((remoteOslIgnore || oslUsedToSend) && (unsigned long)(now - remoteOslIgnoreMs) >= OSL_IGNORE_MS) {
    remoteOslIgnore = 0;
    oslUsedToSend = 0;
  }
  if (remoteOslArmed && (unsigned long)(now - remoteOslRxMs) >= OSL_REMOTE_TIMEOUT_MS) {
    uint8_t before = getActiveLayer();
    remoteOslArmed = 0;
    oslAnnounce(before);
  }
}

// oneShotTimeoutMs (0 = aus): eine eigene Vormerkung ohne verbrauchenden Druck verfällt nach dieser Zeit. Jede Änderung von
// oslArmed startet die Frist neu. Das Spiegelbild der anderen Hälfte verfällt dort selbst und meldet das per SPLIT_OP_OSL.
void oslExpireLocal(unsigned long now) {
  if (oslArmed != oslSeenArmed) {
    oslSeenArmed = oslArmed;
    oslArmedMs = now;
    return;
  }
  if (oneShotTimeoutMs == 0 || oslArmed == 0 || (unsigned long)(now - oslArmedMs) < oneShotTimeoutMs) return;
  uint8_t before = getActiveLayer();
  oslArmed = oslSeenArmed = 0;
  oslAnnounce(before);
}

// Spiegelbild der anderen Hälfte löschen (Link-Ausfall, RELEASE_ALL der anderen Hälfte)
void oslClearRemote() {
  uint8_t before = getActiveLayer();
  remoteOslArmed = 0;
  remoteOslIgnore = 0;
  oslUsedToSend = 0;
  oslAnnounce(before);
}

// Leader (ACT_LEADER): laufende Erfassung und die Tasten, die sie verbraucht hat. Eine verbrauchte Taste sendet weder beim
// Drücken noch beim Loslassen etwas; ihr Merker gilt bis zum physischen Loslassen.
static LeaderState leaderState;
bool leaderConsumed[NUM_ROWS][NUM_COLS];
// Leader-Taste als Combo-Kandidat: die Erfassung beginnt erst, wenn keine Combo sie verbraucht (Loslassen oder Combo-Fenster)
bool leaderBuffered[NUM_ROWS][NUM_COLS];
// Key-Lock-Taste als Combo-Kandidat: die Vormerkung beginnt erst, wenn keine Combo sie verbraucht (Loslassen oder Combo-Fenster)
bool keyLockBuffered[NUM_ROWS][NUM_COLS];

void leaderReset() { leaderState.reset(); }

// Alle gesperrten Eingaben lösen und die Vormerkung löschen (Standby); RELEASE_ALL, Link-Ausfall, Host-Verlust
// und Config Mode erledigen das in SplitArbitratedKeyboard selbst
void keyLockReleaseAll() { bleKeyboard.keyLockReleaseAll(); }

// Swap hands (ACT_SWAP_HANDS): gehaltene Taste, Vormerkung für den nächsten Druck und Einrastung.
// swapMirrorCol() ist eine Involution: Fingerzeilen c -> FINGER_COLS - 1 - c, Daumenreihe nach Tabelle.
uint8_t swapHeldKeys = 0;
bool swapKeyDown[NUM_ROWS][NUM_COLS] = {};
bool swapArmed = false;
bool swapLocked = false;
bool swapUsedInHold = false;
unsigned long swapLastTapMs = 0;
bool swapLastTapValid = false;
// Zeit des Matrix-Ereignisses (Scan-Zeit, auch beim Nachspielen); 0 = keine, dann gilt millis()
unsigned long swapEventMs = 0;

// Ein Druck einer anderen Taste verbraucht die Vormerkung, unterbricht das Doppel-Tippen und macht das Halten zum Nicht-Tipp
inline void swapNoteKeyPress();

inline bool swapActive() { return swapHeldKeys > 0 || swapArmed || swapLocked; }

inline uint8_t swapMirrorCol(uint8_t r, uint8_t c) {
  static const uint8_t thumbMirror[7] = SWAP_THUMB_MIRROR;
  if (r >= FINGER_ROWS) return c < 7 ? thumbMirror[c] : c;
  return c < FINGER_COLS ? (uint8_t)(FINGER_COLS - 1 - c) : c;
}

inline void swapNoteKeyPress() {
  swapArmed = false;
  swapLastTapValid = false;
  if (swapHeldKeys > 0) swapUsedInHold = true;
}

void swapClearAll() {
  swapHeldKeys = 0;
  for (int r = 0; r < NUM_ROWS; r++)
    for (int c = 0; c < NUM_COLS; c++) swapKeyDown[r][c] = false;
  swapArmed = swapLocked = swapUsedInHold = swapLastTapValid = false;
  swapLastTapMs = 0;
  swapEventMs = 0;
}

// Alle Vormerkungen löschen (RELEASE_ALL, Link-Ausfall, Verlust des Hosts, Config Mode)
void oslClearAll() {
  swapClearAll();
  numWordStop();
  // Die Leader-Erfassung endet an denselben Stellen
  leaderReset();
  uint8_t before = getActiveLayer();
  oslArmed = 0;
  // Die Vormerkungen der anderen Hälfte meldet diese Hälfte als verbraucht: sonst setzte deren Auffrischen sie wieder
  oslUsedToSend = remoteOslArmed;
  remoteOslIgnore = remoteOslArmed;
  remoteOslIgnoreMs = millis();
  remoteOslArmed = 0;
  oslAnnounce(before);
}

// Ermittelt Tap-, Halte- und Doppel-Tipp-Aktion einer Taste inkl. transparentem Fallback auf Layer 0.
// Transparent ist eine Taste nur, wenn alle drei Aktionen 0 sind. Eine Taste nur mit Halte-Aktion
// (Tap = 0) verhält sich wie eine normale Taste. Doppel-Tipp ohne Tap-Aktion bleibt ohne Wirkung.
void resolveKeyActions(uint8_t layer, uint8_t r, uint8_t c, uint16_t &tapAct, uint16_t &holdAct, uint16_t &dtapAct) {
  tapAct = KEYMAP[layer][r][c];
  holdAct = HOLDMAP[layer][r][c];
  dtapAct = DTAPMAP[layer][r][c];
  if (tapAct == 0 && holdAct == 0 && dtapAct == 0) {
    tapAct = KEYMAP[0][r][c];
    holdAct = HOLDMAP[0][r][c];
    dtapAct = DTAPMAP[0][r][c];
  }
  if (tapAct == 0) dtapAct = 0;
  if (tapAct == 0 && holdAct != 0) {
    tapAct = holdAct;
    holdAct = 0;
  }
}

void resolveKeyActions(uint8_t layer, uint8_t r, uint8_t c, uint16_t &tapAct, uint16_t &holdAct) {
  uint16_t dtapAct;
  resolveKeyActions(layer, r, c, tapAct, holdAct, dtapAct);
}

// Eigener Tapping-Term der Taste auf der aktiven Ebene (0 = Wert der Hälfte). Gleiche Auflösung wie
// resolveKeyActions: eine Taste ohne jede Aktion auf der Ebene erbt Aktionen und Term von Ebene 0.
uint16_t resolveKeyTapTerm(uint8_t layer, uint8_t r, uint8_t c) {
  if (layer > 0 && KEYMAP[layer][r][c] == 0 && HOLDMAP[layer][r][c] == 0 && DTAPMAP[layer][r][c] == 0) layer = 0;
  return TAPTERMMAP[layer][r][c];
}

// Gültiger Wert für TAPTERMMAP: 0 (Wert der Hälfte) oder TAPPING_TERM_MIN_MS..TAPPING_TERM_MAX_MS
bool isValidKeyTapTerm(int ms) {
  return ms == 0 || (ms >= TAPPING_TERM_MIN_MS && ms <= TAPPING_TERM_MAX_MS);
}

// Eine der beiden Tasten der physischen Config-Combo (rechts R0C0/R4C5, links R0C5/R4C0)
bool isConfigComboKey(uint8_t r, uint8_t c) {
  return (r == CONFIG_COMBO_R1 && c == CONFIG_COMBO_C1) || (r == CONFIG_COMBO_R2 && c == CONFIG_COMBO_C2);
}

// Solange beide Config-Combo-Tasten gehalten werden, senden diese beiden Tasten nichts an den Host
bool isConfigComboSuppressed(uint8_t r, uint8_t c) {
  return keyState[CONFIG_COMBO_R1][CONFIG_COMBO_C1] && keyState[CONFIG_COMBO_R2][CONFIG_COMBO_C2] &&
    ((r == CONFIG_COMBO_R1 && c == CONFIG_COMBO_C1) || (r == CONFIG_COMBO_R2 && c == CONFIG_COMBO_C2));
}

bool isComboCandidateKey(uint8_t r, uint8_t c);
bool wasComboRecentlyActive(uint8_t r, uint8_t c);

// Consumer-Aktion (Media, Globe, Helligkeit, Mission Control, Launchpad) und Maus-Rad-Aktion
inline bool isMediaAction(uint16_t a) { return a >= ACT_MEDIA_FIRST && a <= ACT_MEDIA_LAST; }
inline bool isWheelPanAction(uint16_t a) { return a == ACT_MOUSE_WHEEL_LEFT || a == ACT_MOUSE_WHEEL_RIGHT; }
// Klick-, Rad- und Pan-Aktionen der Maus (ohne Bewegung)
inline bool isMouseKeyAction(uint16_t a) {
  return (a >= ACT_MOUSE_LEFT && a <= ACT_MOUSE_WHEEL_DOWN) || isWheelPanAction(a);
}
inline bool isWheelAction(uint16_t a) {
  return a == ACT_MOUSE_WHEEL_UP || a == ACT_MOUSE_WHEEL_DOWN || isWheelPanAction(a);
}

// Der Consumer-Report zur Aktion oder nullptr
const uint8_t *mediaKeyForAction(uint16_t a) {
  switch (a) {
    case ACT_MEDIA_PLAY_PAUSE: return KEY_MEDIA_PLAY_PAUSE;
    case ACT_MEDIA_MUTE: return KEY_MEDIA_MUTE;
    case ACT_MEDIA_VOLUME_UP: return KEY_MEDIA_VOLUME_UP;
    case ACT_MEDIA_VOLUME_DOWN: return KEY_MEDIA_VOLUME_DOWN;
    case ACT_MEDIA_NEXT_TRACK: return KEY_MEDIA_NEXT_TRACK;
    case ACT_MEDIA_PREVIOUS_TRACK: return KEY_MEDIA_PREVIOUS_TRACK;
    case ACT_MEDIA_STOP: return KEY_MEDIA_STOP;
    case ACT_MAC_GLOBE: return KEY_MEDIA_GLOBE;
    case ACT_MEDIA_BRIGHTNESS_UP: return KEY_MEDIA_BRIGHTNESS_UP;
    case ACT_MEDIA_BRIGHTNESS_DOWN: return KEY_MEDIA_BRIGHTNESS_DOWN;
    case ACT_MEDIA_MISSION_CONTROL: return KEY_MEDIA_MISSION_CONTROL;
    case ACT_MEDIA_LAUNCHPAD: return KEY_MEDIA_LAUNCHPAD;
    default: return nullptr;
  }
}

// Ein Schritt in Richtung der Rad-Aktion (Hoch/Rechts positiv)
void wheelSend(uint16_t a, int8_t step) {
  if (a == ACT_MOUSE_WHEEL_UP) bleKeyboard.mouseScroll(step);
  else if (a == ACT_MOUSE_WHEEL_DOWN) bleKeyboard.mouseScroll(-step);
  else if (a == ACT_MOUSE_WHEEL_RIGHT) bleKeyboard.mousePan(step);
  else if (a == ACT_MOUSE_WHEEL_LEFT) bleKeyboard.mousePan(-step);
}

// -----------------------------------------------------------------------------
// Tastenpaare (ACT_KEY_PAIR_BASE + Index): eine Taste drückt zwei Tasten gleichzeitig
// -----------------------------------------------------------------------------
bool isKeyPairAction(uint16_t action) {
  return action >= ACT_KEY_PAIR_BASE && action < ACT_KEY_PAIR_BASE + MAX_KEY_PAIRS;
}

bool isValidKeyPairMemberCode(uint16_t code) {
  return (code >= 1 && code <= 0xFF) ||
         isMediaAction(code) || isMouseKeyAction(code);
}

// Liefert das Paar zur Aktion oder nullptr, wenn der Index nicht (mehr) belegt ist
const KeyPair* keyPairForAction(uint16_t action) {
  if (!isKeyPairAction(action)) return nullptr;
  uint8_t idx = action - ACT_KEY_PAIR_BASE;
  if (idx >= numKeyPairs || userKeyPairs[idx].first == 0 || userKeyPairs[idx].second == 0) return nullptr;
  return &userKeyPairs[idx];
}

void pressKeyPairMember(uint16_t code) {
  if (code >= 1 && code <= 0xFF) {
    bleKeyboard.press((uint8_t)code);
  } else if (const uint8_t *media = mediaKeyForAction(code)) {
    bleKeyboard.press(media);
  } else if (isMouseKeyAction(code)) {
    if (code == ACT_MOUSE_LEFT) bleKeyboard.mousePress(MOUSE_BUTTON_LEFT);
    else if (code == ACT_MOUSE_RIGHT) bleKeyboard.mousePress(MOUSE_BUTTON_RIGHT);
    else if (code == ACT_MOUSE_MIDDLE) bleKeyboard.mousePress(MOUSE_BUTTON_MIDDLE);
    else wheelSend(code, 1);
  }
}

void releaseKeyPairMember(uint16_t code) {
  if (code >= 1 && code <= 0xFF) {
    bleKeyboard.release((uint8_t)code);
  } else if (const uint8_t *media = mediaKeyForAction(code)) {
    bleKeyboard.release(media);
  } else if (code >= ACT_MOUSE_LEFT && code <= ACT_MOUSE_MIDDLE) {
    if (code == ACT_MOUSE_LEFT) bleKeyboard.mouseRelease(MOUSE_BUTTON_LEFT);
    else if (code == ACT_MOUSE_RIGHT) bleKeyboard.mouseRelease(MOUSE_BUTTON_RIGHT);
    else bleKeyboard.mouseRelease(MOUSE_BUTTON_MIDDLE);
  }
}

// Erste Taste zuerst drücken (z. B. Shift vor "."), dann die zweite
bool pressKeyPair(uint16_t action) {
  const KeyPair* p = keyPairForAction(action);
  if (!p) return false;
  pressKeyPairMember(p->first);
  pressKeyPairMember(p->second);
  return true;
}

// In umgekehrter Reihenfolge loslassen, damit kein Zeichen ohne Modifier ankommt
void releaseKeyPair(uint16_t action) {
  const KeyPair* p = keyPairForAction(action);
  if (!p) return;
  releaseKeyPairMember(p->second);
  releaseKeyPairMember(p->first);
}

void tapKeyPair(uint16_t action) {
  if (!pressKeyPair(action)) return;
  delay(5);
  releaseKeyPair(action);
}

void releaseHeldKeyPairs();

// -----------------------------------------------------------------------------
// Umlaute (ACT_UMLAUT_BASE + Index): Zeichenfolge für das macOS-Layout "U.S."
// -----------------------------------------------------------------------------
bool isUmlautAction(uint16_t action) {
  return action >= ACT_UMLAUT_BASE && action < ACT_UMLAUT_BASE + NUM_UMLAUT_ACTIONS;
}

// true, wenn (r, c) zu einer aktiven Combo gehört: deren Tasten sind verbraucht (releaseAll), ihre
// pressedAction ist nicht am Host gedrückt
bool isActiveComboMember(uint8_t r, uint8_t c) {
  for (uint8_t i = 0; i < numCombos; i++) {
    if (!comboRuntime[i].active) continue;
    if (comboContainsKey(i, r, c)) return true;
  }
  return false;
}

// Bitmaske der Modifier (Bit i = Code 0x80 + i), die diese Hälfte gerade am Host hält: Tasten, Tastenpaare
// und Combos mit MODIFIER_HOLD. Große und gesetzte ASCII-Zeichen ('A', '!') halten implizit das linke Shift.
uint8_t heldModifierMask() {
  uint8_t mask = 0;
  auto add = [&mask](uint16_t code) {
    if (code >= KEY_LEFT_CTRL && code <= KEY_RIGHT_GUI) mask |= (uint8_t)(1 << (code - KEY_LEFT_CTRL));
    else if (code > 0 && code < 0x80 && (dactylAsciiToHid((uint8_t)code) & DACTYL_ASCII_SHIFT))
      mask |= (uint8_t)(1 << (KEY_LEFT_SHIFT - KEY_LEFT_CTRL));
  };
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      if (!keySentToHost[r][c] || isActiveComboMember(r, c) || leaderConsumed[r][c]) continue;   // eine verbrauchte Leader-Taste hält am Host nichts
      uint16_t act = pressedAction[r][c];
      const KeyPair* p = keyPairForAction(act);
      if (p) {
        add(p->first);
        add(p->second);
      } else {
        add(act);
      }
    }
  }
  for (uint8_t i = 0; i < numCombos; i++) {
    if (comboRuntime[i].active && userCombos[i].behavior == 1) add(userCombos[i].action);
  }
  return mask;
}

// Tottaste Alt + u, danach der Vokal; Großbuchstaben über das ASCII-Zeichen (Shift implizit). ß = Alt + s.
// Gehaltene Modifier (z. B. Shift) werden vorher gelöst und danach wiederhergestellt: sonst käme Alt + Shift + u
// an, und das Release der Folge löste ein gehaltenes Alt.
void sendUmlaut(uint16_t action) {
  static const char vowels[NUM_UMLAUT_ACTIONS] = { 'a', 'o', 'u', 'A', 'O', 'U', 0 };
  if (!isUmlautAction(action)) return;
  char vowel = vowels[action - ACT_UMLAUT_BASE];
  uint8_t held = heldModifierMask();
  for (uint8_t i = 0; i < 8; i++) {
    if (held & (1 << i)) bleKeyboard.release((uint8_t)(KEY_LEFT_CTRL + i));
  }
  bleKeyboard.press(KEY_LEFT_ALT);
  bleKeyboard.press(vowel ? 'u' : 's');
  delay(5);
  bleKeyboard.release(vowel ? 'u' : 's');
  bleKeyboard.release(KEY_LEFT_ALT);
  if (vowel) {
    delay(5);
    bleKeyboard.press(vowel);
    delay(5);
    bleKeyboard.release(vowel);
  }
  for (uint8_t i = 0; i < 8; i++) {
    if (held & (1 << i)) bleKeyboard.press((uint8_t)(KEY_LEFT_CTRL + i));
  }
}

// -----------------------------------------------------------------------------
// One-Shot-Modifier und Caps Word: den Zustand führt der Master (DactylOneShot.h, SplitArbitratedKeyboard)
// -----------------------------------------------------------------------------
// Caps Word als Combo-Kandidat: Druck mit Host gepuffert, Umschalten steht aus (Loslassen oder Combo-Fenster)
bool capsWordBuffered[NUM_ROWS][NUM_COLS] = {};

bool isOneShotAction(uint16_t action) {
  return action >= ACT_ONE_SHOT_BASE && action < ACT_ONE_SHOT_BASE + NUM_ONE_SHOT_ACTIONS;
}

uint8_t oneShotMaskForAction(uint16_t action) {
  return isOneShotAction(action) ? (uint8_t)(1u << (action - ACT_ONE_SHOT_BASE)) : 0;
}

// -----------------------------------------------------------------------------
// Makros (ACT_MACRO_BASE + Index): nicht blockierende Folge aus TAP, DOWN, UP und PAUSE
// -----------------------------------------------------------------------------
// Darf der nächste Makro-Schritt ein HID-Ereignis erzeugen? Die linke Hälfte prüft hier den Platz in der
// Sendewarteschlange: ein Makro wartet, statt Ereignisse an einer vollen Warteschlange zu verlieren.
#ifndef MACRO_OUTPUT_READY
#define MACRO_OUTPUT_READY() true
#endif
// Nach jedem nachgeholten Einzel-Tipp (flushDoubleTap). Links: TAP_PENDING 0 sofort hinter den Tipp einreihen,
// vor die HID-Ereignisse der Taste, die den Tipp ausgelöst hat (DactylSplitHid.h)
#ifndef DOUBLE_TAP_FLUSHED
#define DOUBLE_TAP_FLUSHED()
#endif
// Repeat (ACT_REPEAT, ACT_ALT_REPEAT) über beide Hälften. REPEAT_REMOTE_PRESS(r, c, alt) liefert true, wenn die andere Hälfte die
// Wiederholung ausführt (oder, links, der Master entscheidet); REPEAT_REMOTE_RELEASE(r, c) löst sie.
// REPEAT_RECORDED() läuft nach jeder aufgezeichneten Aktion dieser Hälfte (Master: "rechts war zuletzt";
// links: Notiz an den Master, dass links zuletzt eine Aktion aufgezeichnet hat).
#ifndef REPEAT_REMOTE_PRESS
#define REPEAT_REMOTE_PRESS(r, c, alt) false
#endif
#ifndef REPEAT_REMOTE_RELEASE
#define REPEAT_REMOTE_RELEASE(r, c)
#endif
#ifndef REPEAT_RECORDED
#define REPEAT_RECORDED()
#endif
// Vor einer Änderung der Paar-Tabelle: ein Paar lösen, das eine Wiederholung der anderen Hälfte hält
#ifndef REPEAT_RELEASE_HELD_PAIRS
#define REPEAT_RELEASE_HELD_PAIRS()
#endif
// Abstand zwischen zwei HID-Ereignissen eines Makros (z. B. Drücken und Loslassen eines TAP)
#define MACRO_STEP_GAP_MS 5

struct MacroRun {
  bool active;
  uint8_t index;
  uint8_t step;            // nächster Schritt in userMacros[index]
  uint16_t tapCode;        // != 0: TAP gedrückt, sein Loslassen steht aus (Tastencode 1..255 oder Consumer-Aktion)
  uint8_t numHeld;
  uint16_t held[MAX_MACRO_STEPS]; // mit DOWN gedrückte Codes, das Makro-Ende lässt sie los
  unsigned long stepTime;  // Zeitpunkt des letzten Schritts
  unsigned long waitMs;    // Wartezeit ab stepTime bis zum nächsten Schritt
  bool repeat;             // Wiederholen, solange die auslösende Taste (repeatR, repeatC) gehalten wird
  uint8_t repeatR;
  uint8_t repeatC;
};
MacroRun macroRun = {};
#define MACRO_NO_KEY 0xFF

bool isMacroAction(uint16_t action) {
  return action >= ACT_MACRO_BASE && action < ACT_MACRO_BASE + MAX_MACROS;
}

// true, wenn der Schritt gültig ist: TAP/DOWN/UP mit Code 1..255 und ms 0 oder mit Code 0 und einer Consumer-Aktion
// (Media, Globe, Helligkeit, Mission Control, Launchpad) in ms; PAUSE mit Code 0 und ms 1..MACRO_MAX_PAUSE_MS
bool isValidMacroStep(int type, int code, int ms) {
  if (type == MACRO_STEP_TAP || type == MACRO_STEP_DOWN || type == MACRO_STEP_UP) {
    if (code == 0) return ms >= ACT_MEDIA_FIRST && ms <= ACT_MEDIA_LAST && mediaKeyForAction((uint16_t)ms) != nullptr;
    return code >= 1 && code <= 0xFF && ms == 0;
  }
  if (type == MACRO_STEP_PAUSE) return code == 0 && ms >= 1 && ms <= MACRO_MAX_PAUSE_MS;
  return false;
}

// Liefert den Index zur Aktion oder -1, wenn der Index nicht belegt oder das Makro leer ist
int macroIndexForAction(uint16_t action) {
  if (!isMacroAction(action)) return -1;
  uint8_t idx = action - ACT_MACRO_BASE;
  if (idx >= numMacros || macroLengths[idx] == 0) return -1;
  return idx;
}

// Der Code, den ein Makro-Schritt drückt: Tastencode 1..255 oder die Consumer-Aktion
uint16_t macroStepCode(const MacroStep &st) { return st.code ? st.code : st.ms; }

void macroPressCode(uint16_t code) {
  if (code <= 0xFF) bleKeyboard.press((uint8_t)code);
  else if (const uint8_t *media = mediaKeyForAction(code)) bleKeyboard.press(media);
}

void macroReleaseCode(uint16_t code) {
  if (code <= 0xFF) bleKeyboard.release((uint8_t)code);
  else if (const uint8_t *media = mediaKeyForAction(code)) bleKeyboard.release(media);
}

// Beendet ein laufendes Makro. releaseKeys: offene Codes loslassen; false, wenn der Aufrufer danach
// ohnehin releaseAll() sendet.
void stopMacro(bool releaseKeys) {
  if (!macroRun.active) return;
  if (releaseKeys && !isConfigMode && bleKeyboard.isConnected()) {
    if (macroRun.tapCode) macroReleaseCode(macroRun.tapCode);
    while (macroRun.numHeld > 0) macroReleaseCode(macroRun.held[--macroRun.numHeld]);
  }
  macroRun = {};
}

void macroTick(unsigned long now);
bool macroRunStep(const MacroStep &st);

// Der Slot des dynamischen Makros (nur Master, DACTYL_DYNAMIC_MACRO) läuft mit dem Index DM_SLOT_INDEX durch dieselbe Engine
#define DM_SLOT_INDEX 0xFF
uint8_t macroLengthOf(uint8_t idx) {
#ifdef DACTYL_DYNAMIC_MACRO
  if (idx == DM_SLOT_INDEX) return bleKeyboard.dynMacro.length;
#endif
  return macroLengths[idx];
}
const MacroStep &macroStepOf(uint8_t idx, uint8_t step) {
#ifdef DACTYL_DYNAMIC_MACRO
  if (idx == DM_SLOT_INDEX) return bleKeyboard.dynMacro.steps[step];
#endif
  return userMacros[idx][step];
}

// Startet das Makro. Ein laufendes Makro läuft zu Ende: ein weiterer Start während des Laufs entfällt.
// Mit gesetzter Wiederholung (userMacroRepeat) und einer Taste (r, c) läuft es von vorn, solange die Taste gehalten wird.
bool startMacro(uint16_t action, unsigned long now, uint8_t r = MACRO_NO_KEY, uint8_t c = MACRO_NO_KEY) {
  if (macroRun.active || isConfigMode || !bleKeyboard.isConnected()) return false;
  int idx = macroIndexForAction(action);
  if (idx < 0) return false;
  macroRun = {};
  macroRun.active = true;
  macroRun.index = (uint8_t)idx;
  // Nur bei noch gehaltener Taste: ein Tipp (Mod-Tap, Doppel-Tipp, Auto Shift) startet erst nach dem Loslassen
  if (userMacroRepeat[idx] && r < NUM_ROWS && c < NUM_COLS && keyState[r][c]) {
    macroRun.repeat = true;
    macroRun.repeatR = r;
    macroRun.repeatC = c;
  }
  macroRun.stepTime = now;
  // Erster Schritt sofort, die weiteren aus processDeferredKeys()
  macroTick(now);
  return true;
}

// Dynamisches Makro (DM_REC, DM_PLAY): nur der Master hat den Slot. Auf der linken Hälfte tun beide Aktionen nichts.
// DM_REC schaltet die Aufnahme um; DM_PLAY beendet eine laufende Aufnahme (ohne abzuspielen, damit das Abspielen
// nicht in den Slot läuft) oder spielt den Slot ab. Während des Abspielens startet keine neue Aufnahme.
void dynamicMacroPress(uint16_t action, unsigned long now) {
#ifdef DACTYL_DYNAMIC_MACRO
  DynamicMacro &dm = bleKeyboard.dynMacro;
  if (isConfigMode || !bleKeyboard.isConnected()) return;
  if (action == ACT_DM_REC) {
    if (dm.recording) dm.stopRecording();
    else if (!macroRun.active) dm.startRecording();  // ein laufendes Makro würde sonst mit aufgenommen
  } else if (action == ACT_DM_PLAY) {
    if (dm.recording) {
      dm.stopRecording();
    } else if (dm.length > 0 && !macroRun.active) {
      macroRun = {};
      macroRun.active = true;
      macroRun.index = DM_SLOT_INDEX;
      macroRun.stepTime = now;
      macroTick(now);
    }
  }
#else
  (void)action;
  (void)now;
#endif
}

// Slot und Aufnahme verwerfen (Config Mode, Neustart); ein laufendes Abspielen endet vorher mit stopMacro
// Stand beim nächsten Durchlauf erneut melden (GET_INFO): eine App, die sich während der Aufnahme verbindet, sieht sie
void dynamicMacroResend() {
#ifdef DACTYL_DYNAMIC_MACRO
  bleKeyboard.dynMacro.reported = -1;
#endif
}

void dynamicMacroReset() {
#ifdef DACTYL_DYNAMIC_MACRO
  bleKeyboard.dynMacro.clear();
#endif
}

// BLE-Host-Slot (ACT_HOST_1 .. ACT_HOST_3, nur Master): aktiver Slot 1..3 (NVS "ble_host", Standard 1).
// Der Wechsel gibt zuerst alle Tasten frei und meldet den Wunsch; dactyl_right.ino speichert den Slot und startet BLE
// mit der Adresse des Slots neu. Im Config Mode und ohne Mac passiert nichts (wie bei den anderen Host-Aktionen).
void resetMouseMove();
uint8_t bleHostSlot = BLE_HOST_DEFAULT;
volatile uint8_t bleHostSwitchRequested = 0;   // 0 = keiner, sonst der Zielslot

void bleHostSwitchPress(uint16_t action) {
#ifdef DACTYL_BLE_HOST
  // Auch ohne Mac-Verbindung: ein verlorener Host darf den Wechsel zu einem anderen nicht sperren
  if (isConfigMode || !isBleHostAction(action)) return;
  uint8_t slot = (uint8_t)(action - ACT_HOST_BASE + 1);
  Serial.printf("BLE-Host-Slot %u angefordert (aktiv: %u)\n", slot, bleHostSlot);
  stopMacro(false);
  dynamicMacroReset();
  resetMouseMove();
  oslClearAll();
  bleKeyboard.releaseAll();
  if (slot == bleHostSlot) return;                // gleicher Slot: nur freigeben, kein Neustart
  bleHostSwitchRequested = slot;
#else
  (void)action;   // die linke Hälfte hat keinen Host-Slot
#endif
}

bool saveBleHostToNVS(uint8_t slot) {
  if (!isValidBleHostSlot(slot)) return false;
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUChar("ble_host", slot) > 0;
  preferences.end();
  if (ok) bleHostSlot = slot;
  else sendConfigNotification("ERR NVS BLE_HOST");
  Serial.printf("NVS: BLE-Host-Slot %s: %u\n", ok ? "gespeichert" : "FEHLER", slot);
  return ok;
}

// Liest den Slot beim Start; fehlender oder ungültiger Wert = Slot 1
void loadBleHostFromNVS() {
  bleHostSlot = BLE_HOST_DEFAULT;
  if (!preferences.begin("dactyl", false)) return;
  if (preferences.isKey("ble_host")) {
    uint8_t v = preferences.getUChar("ble_host", BLE_HOST_DEFAULT);
    if (isValidBleHostSlot(v)) bleHostSlot = v;
  }
  preferences.end();
}

// Im Hauptdurchlauf: neue Zeile "DM_REC:0|1" auf USB-Serial (nie über BLE), wenn sich der Aufnahmestand ändert
void dynamicMacroService() {
#ifdef DACTYL_DYNAMIC_MACRO
  // Ohne Mac oder im Config Mode erreicht keine Taste den HID-Pfad: die Aufnahme endet, statt veraltet zu bleiben
  if (bleKeyboard.dynMacro.recording && (isConfigMode || !bleKeyboard.isConnected())) bleKeyboard.dynMacro.stopRecording();
  char line[16];
  if (dynamicMacroTakeLine(bleKeyboard.dynMacro, line, sizeof(line))) Serial.println(line);
#endif
}

// Höchstens ein HID-Ereignis pro Aufruf; Wartezeiten blockieren loop() nicht
void macroTick(unsigned long now) {
  if (!macroRun.active) return;
  // Wie bei allen Tasten: ohne Host sendet die Hälfte nichts, auch kein Loslassen
  if (isConfigMode || !bleKeyboard.isConnected()) {
    macroRun = {};
    return;
  }
  // Taste losgelassen: das Makro endet sofort, mit DOWN gedrückte Codes und ein offener TAP werden losgelassen
  if (macroRun.repeat && !keyState[macroRun.repeatR][macroRun.repeatC]) {
    stopMacro(true);
    return;
  }
  if ((unsigned long)(now - macroRun.stepTime) < macroRun.waitMs) return;
  if (!MACRO_OUTPUT_READY()) return;
  // Ein laufendes Makro gilt als Aktivität: Standby (langsamer Scan) darf seine Schritte nicht verzögern
  lastActivityTime = now;
  macroRun.stepTime = now;
  macroRun.waitMs = MACRO_STEP_GAP_MS;
  bool pausing = false;
  if (macroRun.tapCode) {
    macroReleaseCode(macroRun.tapCode);
    macroRun.tapCode = 0;
  } else if (macroRun.step >= macroLengthOf(macroRun.index)) {
    // Ende: mit DOWN gedrückte Codes in umgekehrter Reihenfolge loslassen, einen pro Aufruf
    if (macroRun.numHeld > 0) macroReleaseCode(macroRun.held[--macroRun.numHeld]);
  } else {
    pausing = macroRunStep(macroStepOf(macroRun.index, macroRun.step++));
  }
  // Nichts mehr offen: sofort beenden, damit ein neuer Druck das Makro ohne Verzögerung startet.
  // Eine Pause als letzter Schritt läuft erst ab; das Ende folgt im ersten Aufruf danach.
  if (!pausing && macroRun.step >= macroLengthOf(macroRun.index) && !macroRun.tapCode && macroRun.numHeld == 0) {
    if (macroRun.repeat && keyState[macroRun.repeatR][macroRun.repeatC]) {
      macroRun.step = 0;                  // Taste noch gehalten: nächster Durchlauf nach der Schrittpause
      macroRun.waitMs = MACRO_STEP_GAP_MS;
    } else {
      macroRun = {};
    }
  }
}

// Führt einen Schritt aus (höchstens ein HID-Ereignis). true = PAUSE, das Makro wartet jetzt.
bool macroRunStep(const MacroStep &st) {
  if (!isValidMacroStep(st.type, st.code, st.ms)) {
    // Ungültiger Schritt (z. B. aus einem fremden Codegen): überspringen
    macroRun.waitMs = 0;
    return false;
  }
  uint16_t code = macroStepCode(st);
  if (st.type == MACRO_STEP_TAP) {
    macroPressCode(code);
    macroRun.tapCode = code;
  } else if (st.type == MACRO_STEP_DOWN) {
    bool already = false;
    for (uint8_t i = 0; i < macroRun.numHeld; i++) already = already || macroRun.held[i] == code;
    macroPressCode(code);
    if (!already && macroRun.numHeld < MAX_MACRO_STEPS) macroRun.held[macroRun.numHeld++] = code;
  } else if (st.type == MACRO_STEP_UP) {
    macroReleaseCode(code);
    for (uint8_t i = 0; i < macroRun.numHeld; i++) {
      if (macroRun.held[i] != code) continue;
      for (uint8_t j = i + 1; j < macroRun.numHeld; j++) macroRun.held[j - 1] = macroRun.held[j];
      macroRun.numHeld--;
      break;
    }
  } else {
    macroRun.waitMs = st.ms;
    return true;
  }
  return false;
}

// -----------------------------------------------------------------------------
// Mausbewegung (ACT_MOUSE_UP .. ACT_MOUSE_RIGHT_MOVE)
// -----------------------------------------------------------------------------
// Eine gehaltene Bewegungstaste schickt alle MOUSE_MOVE_INTERVAL_MS einen Schritt. Der Schritt wächst mit der
// Haltezeit von 1 bis MOUSE_MOVE_MAX_STEP und fällt beim Loslassen sofort auf 0. Mehrere Tasten summieren sich.
// Bewegung ist keine Repeat-Aktion und kein Combo-Ziel.
#define MOUSE_MOVE_INTERVAL_MS 10
#define MOUSE_MOVE_ACCEL_MS    80
#define MOUSE_MOVE_MAX_STEP    16

bool isMouseSpeedAction(uint16_t a) { return a == ACT_MOUSE_SLOW || a == ACT_MOUSE_FAST; }
// MOUSE_SLOW und MOUSE_FAST laufen wie die Bewegungstasten (gehalten, kein Combo-Ziel, nicht wiederholbar), bewegen aber nichts
bool isMouseMoveAction(uint16_t a) { return (a >= ACT_MOUSE_UP && a <= ACT_MOUSE_RIGHT_MOVE) || isMouseSpeedAction(a); }

bool mouseMoveActive[NUM_ROWS][NUM_COLS] = {};
uint16_t mouseMoveAction[NUM_ROWS][NUM_COLS] = {};
unsigned long mouseMoveStartMs[NUM_ROWS][NUM_COLS] = {};
unsigned long mouseMoveLastMs = 0;

void mouseMoveStart(uint8_t r, uint8_t c, uint16_t action, unsigned long now) {
  if (mouseMoveActive[r][c]) return;
  mouseMoveActive[r][c] = true;
  mouseMoveAction[r][c] = action;
  mouseMoveStartMs[r][c] = now;
  mouseMoveLastMs = now;
}

void mouseMoveStop(uint8_t r, uint8_t c) { mouseMoveActive[r][c] = false; }

// Mauspräzision: Bit 0 = MOUSE_SLOW gehalten, Bit 1 = MOUSE_FAST gehalten. Die eigene Maske folgt den gehaltenen Tasten,
// die der anderen Hälfte kommt mit SPLIT_OP_MOUSE_SPEED und verfällt ohne Paket nach MOUSE_SPEED_REMOTE_TIMEOUT_MS.
#ifndef MOUSE_SPEED_REMOTE_TIMEOUT_MS
#define MOUSE_SPEED_REMOTE_TIMEOUT_MS 3000
#endif
uint8_t remoteMouseSpeed = 0;
unsigned long remoteMouseSpeedRxMs = 0;

uint8_t localMouseSpeedMask() {
  uint8_t mask = 0;
  for (int r = 0; r < NUM_ROWS; r++)
    for (int c = 0; c < NUM_COLS; c++)
      if (mouseMoveActive[r][c]) {
        if (mouseMoveAction[r][c] == ACT_MOUSE_SLOW) mask |= 1;
        else if (mouseMoveAction[r][c] == ACT_MOUSE_FAST) mask |= 2;
      }
  return mask;
}

void applyRemoteMouseSpeed(uint8_t mask, unsigned long now) {
  remoteMouseSpeed = (uint8_t)(mask & 3);
  remoteMouseSpeedRxMs = now;
}

// Wirksame Maske beider Hälften; 1 = nur langsam, 2 = nur schnell, sonst (0 oder 3) normale Beschleunigung
uint8_t effectiveMouseSpeed(unsigned long now) {
  if (remoteMouseSpeed && (unsigned long)(now - remoteMouseSpeedRxMs) >= MOUSE_SPEED_REMOTE_TIMEOUT_MS) remoteMouseSpeed = 0;
  uint8_t mask = (uint8_t)(localMouseSpeedMask() | remoteMouseSpeed);
  return mask == 3 ? 0 : mask;
}

// Gehaltene Rad-Taste (Hoch, Runter, Links, Rechts): der erste Schritt geht beim Drücken, nach WHEEL_REPEAT_DELAY_MS
// folgt alle WHEEL_REPEAT_INTERVAL_MS ein Schritt. Der Schritt wächst mit der Haltezeit von 1 bis WHEEL_MAX_STEP.
#define WHEEL_REPEAT_DELAY_MS    300
#define WHEEL_REPEAT_INTERVAL_MS 40
#define WHEEL_ACCEL_MS           400
#define WHEEL_MAX_STEP           8

bool wheelActive[NUM_ROWS][NUM_COLS] = {};
uint16_t wheelAction[NUM_ROWS][NUM_COLS] = {};
unsigned long wheelStartMs[NUM_ROWS][NUM_COLS] = {};
unsigned long wheelLastMs[NUM_ROWS][NUM_COLS] = {};

void wheelHoldStart(uint8_t r, uint8_t c, uint16_t action, unsigned long now) {
  if (wheelActive[r][c]) return;
  wheelActive[r][c] = true;
  wheelAction[r][c] = action;
  wheelStartMs[r][c] = now;
  wheelLastMs[r][c] = now;
}

void wheelHoldStop(uint8_t r, uint8_t c) { wheelActive[r][c] = false; }

int8_t wheelStepFor(unsigned long heldMs) {
  unsigned long extra = heldMs > WHEEL_REPEAT_DELAY_MS ? heldMs - WHEEL_REPEAT_DELAY_MS : 0;
  unsigned long step = 1 + extra / WHEEL_ACCEL_MS;
  return (int8_t)(step > WHEEL_MAX_STEP ? WHEEL_MAX_STEP : step);
}

void wheelHoldTick(unsigned long now) {
  bool slow = false, evaluated = false;
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      if (!wheelActive[r][c]) continue;
      // Ohne Host oder im Config Mode ruht die Taste; die Beschleunigung beginnt danach neu
      if (isConfigMode || !bleKeyboard.isConnected()) {
        wheelStartMs[r][c] = now;
        wheelLastMs[r][c] = now;
        continue;
      }
      unsigned long held = (unsigned long)(now - wheelStartMs[r][c]);
      if (held < WHEEL_REPEAT_DELAY_MS || (unsigned long)(now - wheelLastMs[r][c]) < WHEEL_REPEAT_INTERVAL_MS) continue;
      wheelLastMs[r][c] = now;
      if (!evaluated) { slow = effectiveMouseSpeed(now) == 1; evaluated = true; }
      wheelSend(wheelAction[r][c], slow ? 1 : wheelStepFor(held));
    }
  }
}

void resetMouseMove() {
  for (int r = 0; r < NUM_ROWS; r++) for (int c = 0; c < NUM_COLS; c++) { mouseMoveActive[r][c] = false; wheelActive[r][c] = false; }
  remoteMouseSpeed = 0;
}

int8_t mouseMoveStepFor(unsigned long heldMs) {
  unsigned long step = 1 + heldMs / MOUSE_MOVE_ACCEL_MS;
  return (int8_t)(step > MOUSE_MOVE_MAX_STEP ? MOUSE_MOVE_MAX_STEP : step);
}

void mouseMoveTick(unsigned long now) {
  bool any = false;
  for (int r = 0; r < NUM_ROWS && !any; r++)
    for (int c = 0; c < NUM_COLS; c++)
      if (mouseMoveActive[r][c]) { any = true; break; }
  if (!any) return;
  // Ohne Host oder im Config Mode bewegt sich nichts; die Tasten bleiben aktiv bis zum Loslassen. Die
  // Beschleunigung beginnt danach neu, sonst springt der Zeiger nach dem Wiederverbinden auf den vollen Schritt.
  if (isConfigMode || !bleKeyboard.isConnected()) {
    for (int r = 0; r < NUM_ROWS; r++)
      for (int c = 0; c < NUM_COLS; c++)
        if (mouseMoveActive[r][c]) mouseMoveStartMs[r][c] = now;
    mouseMoveLastMs = now;
    return;
  }
  if ((unsigned long)(now - mouseMoveLastMs) < MOUSE_MOVE_INTERVAL_MS) return;
  mouseMoveLastMs = now;
  uint8_t speed = effectiveMouseSpeed(now);
  int x = 0, y = 0;
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      if (!mouseMoveActive[r][c]) continue;
      int step = speed == 1 ? 1 : speed == 2 ? MOUSE_MOVE_MAX_STEP : mouseMoveStepFor((unsigned long)(now - mouseMoveStartMs[r][c]));
      switch (mouseMoveAction[r][c]) {
        case ACT_MOUSE_UP: y -= step; break;
        case ACT_MOUSE_DOWN: y += step; break;
        case ACT_MOUSE_LEFT_MOVE: x -= step; break;
        case ACT_MOUSE_RIGHT_MOVE: x += step; break;
      }
    }
  }
  if (x > 127) x = 127;
  if (x < -127) x = -127;
  if (y > 127) y = 127;
  if (y < -127) y = -127;
  if (x != 0 || y != 0) bleKeyboard.mouseMove((int8_t)x, (int8_t)y);
}

// -----------------------------------------------------------------------------
// Repeat (ACT_REPEAT): die zuletzt ausgeführte Aktion noch einmal
// -----------------------------------------------------------------------------
// Aufgezeichnet wird die aufgelöste Aktion (nicht die Matrix-Position): Zeichen, Medien, Maus, Tastenpaare,
// Umlaute, Makros, One-Shot, Caps Word und Combo-Aktionen. Nicht aufgezeichnet werden Layer-Aktionen, reine
// Modifier (sonst wiederholte "Shift halten" nur Shift) und REPEAT selbst.
uint16_t lastRepeatAction = 0;
// Je Taste: die beim Drücken aufgelöste Aktion und ob die andere Hälfte sie ausführt
uint16_t repeatResolved[NUM_ROWS][NUM_COLS] = {};
bool repeatRemote[NUM_ROWS][NUM_COLS] = {};

// Umschalter für Texthilfen im Master-Zustand: Caps Word und Satzanfang groß
bool isTextToggleAction(uint16_t a) { return a == ACT_CAPS_WORD || a == ACT_SENTENCE_CASE; }
void sendTextToggle(uint16_t a) {
  if (a == ACT_SENTENCE_CASE) bleKeyboard.sentenceCaseToggle();
  else bleKeyboard.capsWordToggle();
}

bool isRepeatableAction(uint16_t a) {
  if (a == 0 || isRepeatKeyAction(a)) return false;
  if (a <= 0xFF) return a < KEY_LEFT_CTRL || a > KEY_RIGHT_GUI;
  if (isMediaAction(a) || isMouseKeyAction(a)) return true;
  return isKeyPairAction(a) || isMacroAction(a) || isUmlautAction(a) || isOneShotAction(a) || isTextToggleAction(a);
}

void recordRepeatAction(uint16_t a) {
  // Eine Aktion zählt nur, wenn sie den Host erreicht: ohne Mac oder im Config Mode ist nichts passiert
  if (isConfigMode || !bleKeyboard.isConnected()) return;
  if (!isRepeatableAction(a)) return;
  lastRepeatAction = a;
  REPEAT_RECORDED();
}

// Die Wiederholung drücken. Aufrufer prüfen Host und Config Mode nicht: hier wird beides geprüft.
void repeatPress(uint16_t a) {
  if (isConfigMode || !bleKeyboard.isConnected()) return;
  if (isMediaAction(a)) {
    if (a == ACT_MAC_GLOBE) bleKeyboard.press(KEY_MEDIA_GLOBE);
    else bleKeyboard.write(mediaKeyForAction(a));
  } else if (isMouseKeyAction(a)) {
    if (a == 0x130) bleKeyboard.mousePress(MOUSE_BUTTON_LEFT);
    else if (a == 0x131) bleKeyboard.mousePress(MOUSE_BUTTON_RIGHT);
    else if (a == 0x132) bleKeyboard.mousePress(MOUSE_BUTTON_MIDDLE);
    else wheelSend(a, 1);
  } else if (isKeyPairAction(a)) {
    pressKeyPair(a);
  } else if (isMacroAction(a)) {
    startMacro(a, millis());
  } else if (isUmlautAction(a)) {
    sendUmlaut(a);
  } else if (isOneShotAction(a)) {
    bleKeyboard.oneShotPress(oneShotMaskForAction(a));
  } else if (isTextToggleAction(a)) {
    sendTextToggle(a);
  } else if (a > 0 && a <= 0xFF) {
    bleKeyboard.press((uint8_t)a);
  }
}

// Die Wiederholung loslassen (Einmal-Aktionen wie Medien, Umlaute, Makros und Scrollen haben nichts zu lösen)
void repeatRelease(uint16_t a) {
  if (isConfigMode || !bleKeyboard.isConnected()) return;
  if (a == 0x127) {
    bleKeyboard.release(KEY_MEDIA_GLOBE);
  } else if (a >= 0x130 && a <= 0x132) {
    if (a == 0x130) bleKeyboard.mouseRelease(MOUSE_BUTTON_LEFT);
    else if (a == 0x131) bleKeyboard.mouseRelease(MOUSE_BUTTON_RIGHT);
    else bleKeyboard.mouseRelease(MOUSE_BUTTON_MIDDLE);
  } else if (isKeyPairAction(a)) {
    releaseKeyPair(a);
  } else if (isOneShotAction(a)) {
    bleKeyboard.oneShotRelease(oneShotMaskForAction(a));
  } else if (a > 0 && a <= 0xFF) {
    bleKeyboard.release((uint8_t)a);
  }
}

// Alternate repeat: eigene Paare zuerst, dann die feste Tabelle
inline uint16_t altRepeatResolve(uint16_t a) {
  uint16_t custom = altRepeatCustom(userAltRepeats, numAltRepeats, a);
  return custom ? custom : altRepeatAction(a);
}

// REPEAT-Taste (r, c) drückt: die andere Hälfte führt aus (Hook) oder diese Hälfte wiederholt ihre Aktion
// alt (ALT_REPEAT): das Gegenteil der letzten Aktion; ohne Gegenteil geschieht nichts
bool repeatStartAt(uint8_t r, uint8_t c, bool alt = false) {
  repeatResolved[r][c] = 0;
  repeatRemote[r][c] = false;
  if (REPEAT_REMOTE_PRESS(r, c, alt)) {
    repeatRemote[r][c] = true;
    return true;
  }
  uint16_t a = alt ? altRepeatResolve(lastRepeatAction) : lastRepeatAction;
  if (a == 0) return false;
  repeatResolved[r][c] = a;
  repeatPress(a);
  return true;
}

void repeatStopAt(uint8_t r, uint8_t c) {
  if (repeatRemote[r][c]) {
    repeatRemote[r][c] = false;
    REPEAT_REMOTE_RELEASE(r, c);
  } else if (repeatResolved[r][c]) {
    repeatRelease(repeatResolved[r][c]);
  }
  repeatResolved[r][c] = 0;
}

// -----------------------------------------------------------------------------
// Aktionen ausführen (Tastendruck / Loslassen einer aufgelösten Aktion)
// -----------------------------------------------------------------------------
// Layer lock (ACT_LAYER_LOCK): die höchste gehaltene MO-Ebene (lokal oder von der anderen Hälfte) wird zur
// TG-Ebene; ist sie schon eingerastet, löst der Druck sie. Ohne gehaltene MO-Ebene löst der Druck alle
// eingerasteten Ebenen. Gibt die neue aktive Ebene zurück. Die TG-Ebenen gleicht der Layer-Abgleich ab.
uint8_t layerLockedMask = 0;   // von LAYER_LOCK eingerastete Ebenen (Bit n = Ebene n): layerTimeoutMs lässt sie stehen
uint8_t applyLayerLock() {
  int held = 0;
  for (int l = NUM_LAYERS - 1; l > 0; l--) {
    if (l < 8 && (momentaryLayers[l] || (remoteMomentaryLayers & (1u << l)) || (oslHeld & (1u << l)))) { held = l; break; }
  }
  if (held > 0) {
    toggleLayers[held] = !toggleLayers[held];
    if (toggleLayers[held]) layerLockedMask |= (uint8_t)(1u << held);
    else layerLockedMask &= (uint8_t)~(1u << held);
  } else {
    for (int i = 1; i < NUM_LAYERS; i++) toggleLayers[i] = false;
    layerLockedMask = 0;
  }
  return getActiveLayer();
}

// -----------------------------------------------------------------------------
// Leader-Folgen (ACT_LEADER): nach der Leader-Taste sammelt die Hälfte bis zu LEADER_MAX_KEYS Tasten
// -----------------------------------------------------------------------------
static inline unsigned long effectiveLeaderTimeout() {
  return leaderTimeoutMs != 0 ? leaderTimeoutMs : LEADER_TIMEOUT_DEFAULT_MS;
}

// Die Aktion einer passenden Folge ausführen: Tastencode (Tipp), Tastenpaar (Tipp) oder Makro
void leaderRunAction(uint16_t action) {
  if (isConfigMode || !bleKeyboard.isConnected()) return;
  if (isKeyPairAction(action)) tapKeyPair(action);
  else if (isMacroAction(action)) startMacro(action, millis());
  else if (leaderKeyCodeValid(action)) bleKeyboard.write((uint8_t)action);
}

// Zeit abgelaufen: eine Folge, die genau den erfassten Tasten entspricht (und länger weitergehen könnte), läuft jetzt;
// sonst passiert nichts. Die Erfassung endet in jedem Fall.
void leaderExpire(unsigned long now) {
  if (!leaderState.timedOut(now, effectiveLeaderTimeout())) return;
  int idx = leaderState.count > 0 ? leaderFindExact(userLeaderSeqs, numLeaderSeqs, leaderState.keys, leaderState.count) : -1;
  uint16_t act = idx >= 0 ? userLeaderSeqs[idx].action : 0;
  leaderState.reset();
  if (act != 0) leaderRunAction(act);
}

bool anyTapHoldPending();
bool anyDoubleTapWaiting();
bool deferredKeysWaiting();

// Solange eine Taste auf ihre Entscheidung wartet (Mod-Tap, Doppel-Tipp, Warteschlange), läuft die Erfassung nicht ab:
// die wartende Taste wurde rechtzeitig gedrückt und läuft später mit ihrer Anschlagzeit (leaderConsumeKey)
void leaderTick(unsigned long now) {
  if (leaderState.active && !anyTapHoldPending() && !anyDoubleTapWaiting() && !deferredKeysWaiting()) leaderExpire(now);
}

// true, wenn die Taste von der Erfassung verbraucht wurde: sie sendet nichts. Layer-, Medien- und Modifier-Tasten laufen
// durch und beenden die Erfassung nicht (z. B. eine Ebene halten, auf der die Folge liegt).
bool leaderConsumeKey(uint8_t r, uint8_t c, uint16_t action) {
  if (!leaderState.active) return false;
  // Zeit des Anschlags, nicht der Ausführung: eine zurückgehaltene Taste (Deferred Queue) läuft später, ihr Abstand gilt
  unsigned long now = keyPressTime[r][c];
  if ((long)(now - leaderState.lastAt) < 0) now = leaderState.lastAt;
  leaderExpire(now);
  if (!leaderState.active) return false;
  if (!leaderKeyCodeValid(action)) {
    // Aktionen mit eigener Ausgabe an den Host (Tastenpaar, Makro, Umlaut, Repeat, dynamisches Makro, One-Shot, Caps Word,
    // eine weitere Leader-Taste) brechen die Erfassung ab; Ebenen-, Modifier-, Medien- und Maustasten laufen durch
    if (isKeyPairAction(action) || isMacroAction(action) || isUmlautAction(action) || isRepeatKeyAction(action) ||
        isDynamicMacroAction(action) || isOneShotAction(action) || isTextToggleAction(action) || action == ACT_LEADER ||
        action == ACT_KEY_LOCK || action == ACT_SWAP_HANDS || action == ACT_NUM_WORD || isBleHostAction(action)) {
      leaderState.reset();
    }
    return false;
  }
  int idx = -1;
  LeaderResult res = leaderCapture(leaderState, userLeaderSeqs, numLeaderSeqs, (uint8_t)action, now, idx);
  leaderConsumed[r][c] = true;
  keySentToHost[r][c] = true;   // ein Combo-Kandidat sendet die Taste nach dem Combo-Fenster nicht nachträglich
  if (res == LEADER_MATCH) {
    uint16_t act = userLeaderSeqs[idx].action;
    leaderState.reset();
    leaderRunAction(act);
  } else if (res == LEADER_ABORT) {
    leaderState.reset();
  }
  return true;
}

static inline uint16_t effectiveTapTerm(uint16_t keyTerm);
// Drücken: die Taste hält den Wechsel, solange sie gedrückt ist (Config Mode: wirkungslos)
void swapHandsPress(uint8_t r, uint8_t c) {
  if (isConfigMode || swapKeyDown[r][c]) return;
  swapKeyDown[r][c] = true;
  swapHeldKeys++;
  swapUsedInHold = false;
}

// Loslassen: ohne anderen Tastendruck dazwischen und innerhalb des Tapping-Terms ist es ein Tipp. Ein Tipp löst eine
// Einrastung, sonst merkt er den Wechsel für den nächsten Druck vor; ein zweiter Tipp im Tapping-Term rastet ihn ein.
void swapHandsRelease(uint8_t r, uint8_t c, unsigned long now) {
  if (!swapKeyDown[r][c]) return;
  // Eine Combo hat die Taste verbraucht oder sie gehört zur Config-Combo: kein Tipp
  bool consumed = wasComboRecentlyActive(r, c) || isConfigComboKey(r, c);
  swapKeyDown[r][c] = false;
  if (swapHeldKeys > 0) swapHeldKeys--;
  bool isTap = !consumed && !swapUsedInHold && swapHeldKeys == 0 && keyPressTime[r][c] != 0 &&
               (unsigned long)(now - keyPressTime[r][c]) < effectiveTapTerm(0);
  if (!isTap) return;
  if (swapLocked) {
    swapLocked = swapArmed = swapLastTapValid = false;
  } else if (swapLastTapValid && (unsigned long)(now - swapLastTapMs) < effectiveTapTerm(0)) {
    swapLocked = true;
    swapArmed = swapLastTapValid = false;
  } else {
    swapArmed = true;
    swapLastTapValid = true;
    swapLastTapMs = now;
  }
}

void dispatchPress(uint8_t r, uint8_t c, uint16_t action, uint8_t currentLayer) {
  pressedAction[r][c] = action;
  // Ein Merker ohne Loslassen (Combo, RELEASE_ALL) darf das Loslassen dieses Drucks nicht verschlucken
  leaderConsumed[r][c] = false;
  leaderBuffered[r][c] = false;
  keyLockBuffered[r][c] = false;
  // Leader: eine Taste der laufenden Erfassung sendet nichts und zählt nicht für Repeat
  if (leaderConsumeKey(r, c, action)) {
    // Nur die Anzeige: die Live-Ansicht sieht den Druck wie sein KEY_RELEASE; an den Host geht nichts
    char lbuf[128];
    snprintf(lbuf, sizeof(lbuf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"Leader-Folge\",\"code\":%d,\"layer\":%d}", r, c, action, currentLayer);
    sendConfigNotification(String(lbuf));
    return;
  }
  // Ein Combo-Kandidat zählt erst, wenn seine Aktion gesendet wird (Release, Combo-Fenster, Halte-Entscheidung):
  // eine Combo verbraucht beide Tasten, ihre Einzelaktionen laufen nie
  // Solange beide Config-Combo-Tasten gehalten werden, geht von diesen Tasten nichts an den Host
  if (!isComboCandidateKey(r, c) && !isConfigComboSuppressed(r, c)) recordRepeatAction(action);

  if (action >= 0x100 && action <= 0x107) {
    uint8_t l = action - 0x100;
    if (l < NUM_LAYERS) momentaryLayers[l] = true;
    uint8_t newL = getActiveLayer();
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"MO_%d\",\"code\":%d,\"layer\":%d,\"target_layer\":%d}", r, c, l, action, currentLayer, newL);
    sendConfigNotification(String(buf));
    Serial.printf("LAYER: MO(%d) aktiv -> Layer %d\n", l, newL);
  } else if (action >= 0x110 && action <= 0x117) {
    uint8_t l = action - 0x110;
    if (l == 0) {
      // TG_0 setzt alle getoggelten Ebenen zurück und wechselt fest auf Layer 0
      for (int i = 1; i < NUM_LAYERS; i++) toggleLayers[i] = false;
    } else if (l < NUM_LAYERS) {
      toggleLayers[l] = !toggleLayers[l];
    }
    uint8_t newL = getActiveLayer();
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"TG_%d\",\"code\":%d,\"layer\":%d,\"target_layer\":%d}", r, c, l, action, currentLayer, newL);
    sendConfigNotification(String(buf));
    Serial.printf("LAYER: TG(%d) -> Layer %d\n", l, newL);
  } else if (action == ACT_LAYER_UP || action == ACT_LAYER_DOWN) {
    uint8_t targetL = (action == ACT_LAYER_UP)
      ? ((currentLayer + 1) % NUM_LAYERS)
      : ((currentLayer == 0) ? (NUM_LAYERS - 1) : (currentLayer - 1));
    for (int i = 1; i < NUM_LAYERS; i++) toggleLayers[i] = false;
    if (targetL > 0 && targetL < NUM_LAYERS) {
      toggleLayers[targetL] = true;
    }
    uint8_t newL = getActiveLayer();
    const char* actName = (action == ACT_LAYER_UP) ? "LAYER_UP" : "LAYER_DOWN";
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"%s\",\"code\":%d,\"layer\":%d,\"target_layer\":%d}", r, c, actName, action, currentLayer, newL);
    sendConfigNotification(String(buf));
    Serial.printf("LAYER: %s -> Layer %d\n", actName, newL);
  } else if (isOslAction(action)) {
    oslPress(action, keyPressTime[r][c], effectiveTapTerm(resolveKeyTapTerm(currentLayer, r, c)));
    uint8_t newL = getActiveLayer();
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"OSL_%d\",\"code\":%d,\"layer\":%d,\"target_layer\":%d}", r, c, action - ACT_OSL_BASE, action, currentLayer, newL);
    sendConfigNotification(String(buf));
    Serial.printf("LAYER: OSL(%d) gedrückt -> Layer %d\n", action - ACT_OSL_BASE, newL);
  } else if (action == ACT_NUM_WORD) {
    // Combo-Kandidaten sind ausgeschlossen (ADD_COMBO lehnt die Aktion ab): der Druck wirkt sofort
    numWordPress(keyPressTime[r][c] ? keyPressTime[r][c] : millis());
    uint8_t newL = getActiveLayer();
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"NUM_WORD\",\"code\":%d,\"layer\":%d,\"target_layer\":%d}", r, c, action, currentLayer, newL);
    sendConfigNotification(String(buf));
  } else if (action == ACT_LAYER_LOCK) {
    uint8_t newL = applyLayerLock();
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"LAYER_LOCK\",\"code\":%d,\"layer\":%d,\"target_layer\":%d}", r, c, action, currentLayer, newL);
    sendConfigNotification(String(buf));
    Serial.printf("LAYER: LAYER_LOCK -> Layer %d\n", newL);
  } else if (isMediaAction(action)) {
    static const char* const mediaNames[] = {"Play/Pause", "Mute", "Vol+", "Vol-", "Next", "Prev", "Stop", "Mac Globe (Fn)",
                                             "Helligkeit +", "Helligkeit -", "Mission Control", "Launchpad"};
    const char* mediaName = mediaNames[action - ACT_MEDIA_FIRST];
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (action == ACT_MAC_GLOBE) bleKeyboard.press(KEY_MEDIA_GLOBE);
      else bleKeyboard.write(mediaKeyForAction(action));
    }
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"%s\",\"code\":%d,\"layer\":%d}", r, c, mediaName, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("Media-Taste gedrückt: [R%d, C%d] (L%d) -> %s (0x%02X)\n", r, c, currentLayer, mediaName, action);
  } else if (isMouseKeyAction(action)) {
    const char* mouseName = "MOUSE";
    if (action == 0x130) mouseName = "Linksklick";
    else if (action == 0x131) mouseName = "Rechtsklick";
    else if (action == 0x132) mouseName = "Mittelklick";
    else if (action == 0x133) mouseName = "Mausrad Hoch";
    else if (action == 0x134) mouseName = "Mausrad Runter";
    else if (action == ACT_MOUSE_WHEEL_LEFT) mouseName = "Mausrad Links";
    else if (action == ACT_MOUSE_WHEEL_RIGHT) mouseName = "Mausrad Rechts";

    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"%s\",\"code\":%d,\"layer\":%d}", r, c, mouseName, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("Maus-Aktion gedrückt: [R%d, C%d] (L%d) -> %s (0x%02X)\n", r, c, currentLayer, mouseName, action);

    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (!isComboCandidateKey(r, c) && !isConfigComboSuppressed(r, c)) {
        if (action == 0x130) bleKeyboard.mousePressLockable(MOUSE_BUTTON_LEFT);
        else if (action == 0x131) bleKeyboard.mousePressLockable(MOUSE_BUTTON_RIGHT);
        else if (action == 0x132) bleKeyboard.mousePressLockable(MOUSE_BUTTON_MIDDLE);
        else { wheelSend(action, 1); wheelHoldStart(r, c, action, millis()); }
        keySentToHost[r][c] = true;
      }
    }
  } else if (isMouseMoveAction(action)) {
    static const char* const moveNames[4] = {"Maus Hoch", "Maus Runter", "Maus Links", "Maus Rechts"};
    const char* moveName = action == ACT_MOUSE_SLOW ? "Maus langsam" : action == ACT_MOUSE_FAST ? "Maus schnell" : moveNames[action - ACT_MOUSE_UP];
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"%s\",\"code\":%d,\"layer\":%d}", r, c, moveName, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("Mausbewegung gedrückt: [R%d, C%d] (L%d) -> %s (0x%02X)\n", r, c, currentLayer, moveName, action);
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (!isComboCandidateKey(r, c) && !isConfigComboSuppressed(r, c)) {
        mouseMoveStart(r, c, action, millis());
        keySentToHost[r][c] = true;
      }
    }
  } else if (isKeyPairAction(action)) {
    uint8_t idx = action - ACT_KEY_PAIR_BASE;
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"Paar %d\",\"code\":%d,\"layer\":%d}", r, c, idx, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("Tastenpaar gedrückt: [R%d, C%d] (L%d) -> Paar %d\n", r, c, currentLayer, idx);
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (!isComboCandidateKey(r, c) && !isConfigComboSuppressed(r, c)) {
        if (pressKeyPair(action)) keySentToHost[r][c] = true;
      }
    }
  } else if (isMacroAction(action)) {
    uint8_t idx = action - ACT_MACRO_BASE;
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"Makro %d\",\"code\":%d,\"layer\":%d}", r, c, idx, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("Makro gedrückt: [R%d, C%d] (L%d) -> Makro %d\n", r, c, currentLayer, idx);
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (!isComboCandidateKey(r, c) && !isConfigComboSuppressed(r, c)) {
        // Auch ein ignorierter Start (Makro läuft schon) verbraucht die Taste: das Loslassen startet nichts
        startMacro(action, millis(), r, c);
        keySentToHost[r][c] = true;
      }
    }
  } else if (action == ACT_SWAP_HANDS) {
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"Swap Hands\",\"code\":%d,\"layer\":%d}", r, c, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("Swap Hands gedrückt: [R%d, C%d] (L%d)\n", r, c, currentLayer);
    swapHandsPress(r, c);
    keySentToHost[r][c] = true;
  } else if (action == ACT_KEY_LOCK) {
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"Key Lock\",\"code\":%d,\"layer\":%d}", r, c, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("Key Lock gedrückt: [R%d, C%d] (L%d)\n", r, c, currentLayer);
    // Die Taste sendet nichts; ohne Mac oder im Config Mode merkt sie nichts vor.
    // Als Combo-Kandidat gepuffert: eine ausgelöste Combo darf keine Vormerkung zurücklassen
    if (!isConfigMode && bleKeyboard.isConnected() && !isConfigComboSuppressed(r, c)) {
      if (isComboCandidateKey(r, c)) keyLockBuffered[r][c] = true;
      else { bleKeyboard.keyLockArm(); keySentToHost[r][c] = true; }
    }
  } else if (action == ACT_LEADER) {
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"Leader\",\"code\":%d,\"layer\":%d}", r, c, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("Leader gedrückt: [R%d, C%d] (L%d)\n", r, c, currentLayer);
    // Die Taste sendet nichts; ohne Mac oder im Config Mode beginnt keine Erfassung
    if (!isConfigMode && bleKeyboard.isConnected() && !isConfigComboSuppressed(r, c)) {
      // Als Combo-Kandidat gepuffert: eine ausgelöste Combo darf keine Erfassung zurücklassen, die die nächste Taste verschluckt
      if (isComboCandidateKey(r, c)) leaderBuffered[r][c] = true;
      else { leaderState.start(millis()); keySentToHost[r][c] = true; }
    }
#ifdef DACTYL_BLE_HOST
  } else if (isBleHostAction(action)) {
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"Host %d\",\"code\":%d,\"layer\":%d}", r, c, action - ACT_HOST_BASE + 1, action, currentLayer);
    sendConfigNotification(String(buf));
    if (!isConfigMode && !isComboCandidateKey(r, c) && !isConfigComboSuppressed(r, c)) {
      bleHostSwitchPress(action);
      keySentToHost[r][c] = true;
    }
#endif
  } else if (isDynamicMacroAction(action)) {
    const char* dmName = action == ACT_DM_REC ? "DM Rec" : "DM Play";
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"%s\",\"code\":%d,\"layer\":%d}", r, c, dmName, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("%s gedrückt: [R%d, C%d] (L%d)\n", dmName, r, c, currentLayer);
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (!isComboCandidateKey(r, c) && !isConfigComboSuppressed(r, c)) {
        dynamicMacroPress(action, millis());
        keySentToHost[r][c] = true;
      }
    }
  } else if (isUmlautAction(action)) {
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"Umlaut %d\",\"code\":%d,\"layer\":%d}", r, c, action - ACT_UMLAUT_BASE, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("Umlaut gedrückt: [R%d, C%d] (L%d) -> 0x%03X\n", r, c, currentLayer, action);
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (!isComboCandidateKey(r, c) && !isConfigComboSuppressed(r, c)) {
        sendUmlaut(action);
        keySentToHost[r][c] = true;
      }
    }
  } else if (isRepeatKeyAction(action)) {
    repeatResolved[r][c] = 0;
    repeatRemote[r][c] = false;
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"Repeat\",\"code\":%d,\"layer\":%d}", r, c, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("Repeat gedrückt: [R%d, C%d] (L%d)\n", r, c, currentLayer);
    // Als Combo-Kandidat gepuffert wie eine normale Taste: eine ausgelöste Combo verbraucht den Druck
    if (!isConfigMode && bleKeyboard.isConnected() && !isConfigComboSuppressed(r, c) && !isComboCandidateKey(r, c)) {
      repeatStartAt(r, c, action == ACT_ALT_REPEAT);
      keySentToHost[r][c] = true;
    }
  } else if (isOneShotAction(action) || isTextToggleAction(action)) {
    static const char* const osmNames[NUM_ONE_SHOT_ACTIONS] = {
      "OSM Ctrl", "OSM Shift", "OSM Alt", "OSM Cmd", "OSM RCtrl", "OSM RShift", "OSM RAlt", "OSM RCmd"
    };
    const char* name = action == ACT_SENTENCE_CASE ? "Sentence Case" : action == ACT_CAPS_WORD ? "Caps Word" : osmNames[action - ACT_ONE_SHOT_BASE];
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"%s\",\"code\":%d,\"layer\":%d}", r, c, name, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("%s gedrückt: [R%d, C%d] (L%d)\n", name, r, c, currentLayer);
    // Caps Word als Combo-Kandidat wird gepuffert: eine ausgelöste Combo schaltet es sonst bleibend um.
    // One-Shot-Tasten senden sofort; releaseAll() einer Combo lässt sie ohne Vormerken los.
    capsWordBuffered[r][c] = false;
    if (!isConfigMode && bleKeyboard.isConnected() && !isConfigComboSuppressed(r, c)) {
      if (isTextToggleAction(action) && isComboCandidateKey(r, c)) {
        // Gepuffert: nur ein Druck mit Host darf beim Loslassen oder nach dem Combo-Fenster umschalten
        capsWordBuffered[r][c] = true;
      } else {
        if (isTextToggleAction(action)) sendTextToggle(action);
        else bleKeyboard.oneShotPress(oneShotMaskForAction(action));
        keySentToHost[r][c] = true;
      }
    }
  } else if (action > 0 && action <= 0xFF) {
    String keyLabel = "";
    if (action >= 'a' && action <= 'z') keyLabel = String((char)toupper(action));
    else if (action >= 32 && action <= 126 && action != '"' && action != '\\') keyLabel = String((char)action);
    else if (action >= KEY_F1 && action <= KEY_F12) keyLabel = "F" + String(action - KEY_F1 + 1);
    else if (action >= KEY_F13 && action <= KEY_F24) keyLabel = "F" + String(action - KEY_F13 + 13);
    else if (action == KEY_RETURN) keyLabel = "Enter";
    else if (action == KEY_ESC) keyLabel = "Esc";
    else if (action == KEY_BACKSPACE) keyLabel = "Bksp";
    else if (action == KEY_TAB) keyLabel = "Tab";
    else if (action == KEY_DELETE) keyLabel = "Del";
    else if (action == KEY_CAPS_LOCK) keyLabel = "Caps";
    else if (action == KEY_INSERT) keyLabel = "Ins";
    else if (action == KEY_PRTSC) keyLabel = "PrtSc";
    else if (action == KEY_UP_ARROW) keyLabel = "Up";
    else if (action == KEY_DOWN_ARROW) keyLabel = "Down";
    else if (action == KEY_LEFT_ARROW) keyLabel = "Left";
    else if (action == KEY_RIGHT_ARROW) keyLabel = "Right";
    else if (action >= KEY_NUM_1 && action <= KEY_NUM_9) keyLabel = "Num" + String(action - KEY_NUM_1 + 1);
    else if (action == KEY_NUM_0) keyLabel = "Num0";
    else keyLabel = "Key" + String(action);

    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"%s\",\"code\":%d,\"layer\":%d}", r, c, keyLabel.c_str(), action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("Taste gedrückt: [R%d, C%d] (L%d) -> '%s' (0x%02X)\n", r, c, currentLayer, keyLabel.c_str(), action);
    if (!isConfigMode && bleKeyboard.isConnected()) {
      // Wenn die Taste Teil einer definierten Combo ist, puffern wir das Senden um comboTimeoutMs,
      // damit beim Drücken des Chords (z. B. J+K) kein Buchstabe vorab gesendet wird!
      if (!isComboCandidateKey(r, c) && !isConfigComboSuppressed(r, c)) {
        bleKeyboard.pressLockable((uint8_t)action);
        keySentToHost[r][c] = true;
      }
    }
  }
}

void dispatchRelease(uint8_t r, uint8_t c, uint16_t action) {
  pressedAction[r][c] = 0;
  // Eine von Leader verbrauchte Taste sendet auch beim Loslassen nichts
  if (leaderConsumed[r][c]) {
    leaderConsumed[r][c] = false;
    keySentToHost[r][c] = false;
    return;
  }
  // Ein Combo-Kandidat, der nie gesendet wurde, sendet beim schnellen Loslassen seine Aktion (Einzeltipp).
  // Erst jetzt zählt sie für Repeat; eine ausgelöste Combo verbraucht beide Tasten und zählt nie.
  if (!keySentToHost[r][c] && isComboCandidateKey(r, c) && !wasComboRecentlyActive(r, c) && !isConfigComboKey(r, c)) {
    recordRepeatAction(action);
  }

  if (action >= 0x100 && action <= 0x107) {
    uint8_t l = action - 0x100;
    if (l < NUM_LAYERS) momentaryLayers[l] = false;
    Serial.printf("LAYER: MO(%d) gelöst -> Layer %d\n", l, getActiveLayer());
  } else if (isOslAction(action)) {
    oslRelease(action);
  } else if (isMediaAction(action)) {
    if (!isConfigMode && action == ACT_MAC_GLOBE && bleKeyboard.isConnected()) {
      bleKeyboard.release(KEY_MEDIA_GLOBE);
    }
  } else if (isMouseKeyAction(action)) {
    // Das Halten einer Rad-Taste endet beim Loslassen, auch nach Host-Verlust
    wheelHoldStop(r, c);
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (keySentToHost[r][c]) {
        if (action == 0x130) bleKeyboard.mouseRelease(MOUSE_BUTTON_LEFT);
        else if (action == 0x131) bleKeyboard.mouseRelease(MOUSE_BUTTON_RIGHT);
        else if (action == 0x132) bleKeyboard.mouseRelease(MOUSE_BUTTON_MIDDLE);
        keySentToHost[r][c] = false;
      } else if (!wasComboRecentlyActive(r, c) && !isConfigComboKey(r, c)) {
        // Wenn die Taste vor Ablauf des Combo-Timeouts losgelassen wurde (schneller Einzeltipp)
        if (action == 0x130) bleKeyboard.mouseClick(MOUSE_BUTTON_LEFT);
        else if (action == 0x131) bleKeyboard.mouseClick(MOUSE_BUTTON_RIGHT);
        else if (action == 0x132) bleKeyboard.mouseClick(MOUSE_BUTTON_MIDDLE);
        else wheelSend(action, 1);
      }
    }
  } else if (isMouseMoveAction(action)) {
    // Die Bewegung endet beim Loslassen, auch nach Host-Verlust; ein nie gesendeter Druck (Combo-Kandidat) tippt nichts
    mouseMoveStop(r, c);
    keySentToHost[r][c] = false;
  } else if (isRepeatKeyAction(action)) {
    if (repeatRemote[r][c] || repeatResolved[r][c]) {
      // Eine laufende Wiederholung endet immer, auch nach Host-Verlust oder einer Combo (die anderen Hälfte
      // läuft sonst weiter); repeatRelease prüft den Host selbst
      repeatStopAt(r, c);
      keySentToHost[r][c] = false;
    } else if (keySentToHost[r][c]) {
      keySentToHost[r][c] = false;
    } else if (!isConfigMode && bleKeyboard.isConnected() && !wasComboRecentlyActive(r, c) && !isConfigComboKey(r, c)) {
      // Schneller Einzeltipp vor Ablauf des Combo-Timeouts
      if (repeatStartAt(r, c, action == ACT_ALT_REPEAT)) {
        delay(5);
        repeatStopAt(r, c);
      }
    }
  } else if (isOneShotAction(action)) {
    if (keySentToHost[r][c]) {
      if (bleKeyboard.isConnected()) bleKeyboard.oneShotRelease(oneShotMaskForAction(action));
      keySentToHost[r][c] = false;
      // Eine One-Shot-Taste sendet sofort, auch als Combo-Kandidat: sie zählt, wenn keine Combo sie verbraucht hat
      if (isComboCandidateKey(r, c) && !wasComboRecentlyActive(r, c)) recordRepeatAction(action);
    }
  } else if (isTextToggleAction(action)) {
    // Nur ein gepufferter Combo-Kandidat schaltet jetzt um (schneller Einzeltipp)
    // Ein Druck ohne Host (keySentToHost false, kein Combo-Kandidat) schaltet beim Loslassen nichts um
    if (keySentToHost[r][c]) {
      keySentToHost[r][c] = false;
    } else if (!isConfigMode && bleKeyboard.isConnected() && capsWordBuffered[r][c] &&
               !wasComboRecentlyActive(r, c) && !isConfigComboKey(r, c)) {
      sendTextToggle(action);
    }
    capsWordBuffered[r][c] = false;
  } else if (isUmlautAction(action)) {
    // Die Folge ist beim Drücken schon vollständig gesendet; nur ein gepufferter Combo-Kandidat sendet jetzt
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (keySentToHost[r][c]) {
        keySentToHost[r][c] = false;
      } else if (!wasComboRecentlyActive(r, c) && !isConfigComboKey(r, c)) {
        sendUmlaut(action);
      }
    }
  } else if (action == ACT_SWAP_HANDS) {
    keySentToHost[r][c] = false;
    swapHandsRelease(r, c, swapEventMs != 0 ? swapEventMs : millis());
  } else if (action == ACT_KEY_LOCK) {
    // Die Vormerkung begann beim Drücken; nur ein gepufferter Combo-Kandidat (schneller Einzeltipp) merkt sie jetzt vor
    if (keySentToHost[r][c]) {
      keySentToHost[r][c] = false;
    } else if (keyLockBuffered[r][c] && !isConfigMode && bleKeyboard.isConnected() && !wasComboRecentlyActive(r, c) && !isConfigComboKey(r, c)) {
      bleKeyboard.keyLockArm();
    }
    keyLockBuffered[r][c] = false;
  } else if (action == ACT_LEADER) {
    // Die Erfassung begann beim Drücken; nur ein gepufferter Combo-Kandidat (schneller Einzeltipp) beginnt sie jetzt
    if (keySentToHost[r][c]) {
      keySentToHost[r][c] = false;
    } else if (leaderBuffered[r][c] && !isConfigMode && bleKeyboard.isConnected() && !wasComboRecentlyActive(r, c) && !isConfigComboKey(r, c)) {
      leaderState.start(millis());
    }
    leaderBuffered[r][c] = false;
  } else if (isBleHostAction(action)) {
    if (keySentToHost[r][c]) {
      keySentToHost[r][c] = false;
    } else if (!isConfigMode && !wasComboRecentlyActive(r, c) && !isConfigComboKey(r, c)) {
      bleHostSwitchPress(action);
    }
  } else if (isDynamicMacroAction(action)) {
    // Die Aktion lief schon beim Drücken; nur ein gepufferter Combo-Kandidat führt sie jetzt aus
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (keySentToHost[r][c]) {
        keySentToHost[r][c] = false;
      } else if (!wasComboRecentlyActive(r, c) && !isConfigComboKey(r, c)) {
        dynamicMacroPress(action, millis());
      }
    }
  } else if (isMacroAction(action)) {
    // Das Makro läuft unabhängig vom Halten der Taste; nur ein gepufferter Combo-Kandidat startet jetzt
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (keySentToHost[r][c]) {
        keySentToHost[r][c] = false;
      } else if (!wasComboRecentlyActive(r, c) && !isConfigComboKey(r, c)) {
        startMacro(action, millis());
      }
    }
  } else if (isKeyPairAction(action)) {
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (keySentToHost[r][c]) {
        releaseKeyPair(action);
        keySentToHost[r][c] = false;
      } else if (!wasComboRecentlyActive(r, c) && !isConfigComboKey(r, c)) {
        // Schneller Einzeltipp vor Ablauf des Combo-Timeouts
        tapKeyPair(action);
      }
    }
  } else if (action > 0 && action <= 0xFF) {
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (keySentToHost[r][c]) {
        bleKeyboard.release((uint8_t)action);
        keySentToHost[r][c] = false;
      } else if (!wasComboRecentlyActive(r, c) && !isConfigComboKey(r, c)) {
        // Wenn die Taste vor Ablauf des Combo-Timeouts losgelassen wurde (schneller Einzeltipp)
        // UND nicht gerade Teil einer ausgelösten Combo war:
        bleKeyboard.pressLockable((uint8_t)action);
        delay(5);
        bleKeyboard.release((uint8_t)action);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Tap-Hold (Mod-Tap / Layer-Tap) & Event-Pufferung für Rolled / Permissive Typing
// -----------------------------------------------------------------------------
struct DeferredKeyEvent {
  uint8_t row;
  uint8_t col;
  bool pressed;
  unsigned long time;
};

#define MAX_DEFERRED_KEYS 8

struct DeferredKeyQueue {
  DeferredKeyEvent items[MAX_DEFERRED_KEYS];
  uint8_t head = 0;
  uint8_t count = 0;
};

static DeferredKeyQueue deferredQueue;
static bool isReplayingDeferredQueue = false;

inline void resetDeferredQueue() {
  deferredQueue.head = 0;
  deferredQueue.count = 0;
  isReplayingDeferredQueue = false;
}

inline bool deferredQueueHasPress(uint8_t r, uint8_t c) {
  for (uint8_t i = 0; i < deferredQueue.count; i++) {
    uint8_t idx = (deferredQueue.head + i) % MAX_DEFERRED_KEYS;
    if (deferredQueue.items[idx].row == r &&
        deferredQueue.items[idx].col == c &&
        deferredQueue.items[idx].pressed) {
      return true;
    }
  }
  return false;
}

inline bool deferredQueuePush(uint8_t r, uint8_t c, bool pressed, unsigned long time) {
  if (deferredQueue.count >= MAX_DEFERRED_KEYS) return false;
  uint8_t idx = (deferredQueue.head + deferredQueue.count) % MAX_DEFERRED_KEYS;
  deferredQueue.items[idx] = { r, c, pressed, time };
  deferredQueue.count++;
  return true;
}

inline bool deferredQueuePop(DeferredKeyEvent &out) {
  if (deferredQueue.count == 0) return false;
  out = deferredQueue.items[deferredQueue.head];
  deferredQueue.head = (deferredQueue.head + 1) % MAX_DEFERRED_KEYS;
  deferredQueue.count--;
  return true;
}

void applyMatrixKeyChange(uint8_t r, uint8_t c, bool isPressed, unsigned long now);

// Eager debounce per key (DactylDebounce.h): the press passes in the first pass, the release after debounceMs.
// Returns the reported state of the key. The matrix scan compares it with rawKeyState.
EagerDebounceKey matrixDebounce[NUM_ROWS][NUM_COLS] = {};
bool debouncedMatrixKey(uint8_t r, uint8_t c, bool rawPressed, unsigned long nowMs) {
  return eagerDebounceUpdate(matrixDebounce[r][c], rawPressed, nowMs, debounceMs);
}
// Clears the debounce state of one key (config combo reset).
void resetMatrixDebounceKey(uint8_t r, uint8_t c) {
  eagerDebounceReset(matrixDebounce[r][c]);
}
// Clears the debounce state of every key (config mode change, tests).
void resetMatrixDebounce() {
  for (int r = 0; r < NUM_ROWS; r++)
    for (int c = 0; c < NUM_COLS; c++) eagerDebounceReset(matrixDebounce[r][c]);
}
void replayDeferredQueue();
bool anyTapHoldPending();
bool deferredKeysWaiting() { return deferredQueue.count > 0; }

// Auto Shift: das umgeschaltete ASCII-Zeichen (US-Layout) einer unumgeschalteten Zeichentaste, sonst 0
// (Leerzeichen, schon umgeschaltete Zeichen und alles außerhalb von 0x21..0x7E)
static inline uint16_t autoShiftedAscii(uint16_t c) {
  if (c >= 'a' && c <= 'z') return (uint16_t)(c - 'a' + 'A');
  if (c >= '1' && c <= '9') return (uint16_t)("!@#$%^&*("[c - '1']);
  switch (c) {
    case '0': return ')';
    case '-': return '_';
    case '=': return '+';
    case '[': return '{';
    case ']': return '}';
    case '\\': return '|';
    case ';': return ':';
    case '\'': return '"';
    case '`': return '~';
    case ',': return '<';
    case '.': return '>';
    case '/': return '?';
    default: return 0;
  }
}

// Auto Shift: Zeichenklasse des Modus (1 = alle, 2 = Ziffern und Symbole, 3 = Buchstaben, 4 = Symbole); 0 = aus
static inline bool autoShiftModeAllows(uint8_t mode, uint16_t c) {
  bool letter = c >= 'a' && c <= 'z';
  bool digit = c >= '0' && c <= '9';
  switch (mode) {
    case 1: return true;
    case 2: return !letter;
    case 3: return letter;
    case 4: return !letter && !digit;
    default: return false;
  }
}

// Auto Shift: Taste wartet auf das Zeitlimit; ein Loslassen oder eine andere Taste davor macht sie zum normalen Tipp
struct AutoShiftKey {
  bool pending;
  uint16_t tapAction;
  uint16_t shiftedAction;
  uint8_t layer;
  unsigned long pressTime;
};
AutoShiftKey autoShiftKeys[NUM_ROWS][NUM_COLS];

struct TapHoldKey {
  bool pending;      // Gedrückt, Tap oder Hold noch nicht entschieden
  bool holdActive;   // Halte-Aktion ist aktiv
  uint16_t tapAction;
  uint16_t holdAction;
  uint8_t layer;
  unsigned long pressTime;
  uint16_t term;     // Eigener Tapping-Term dieser Taste (0 = tappingTermMs der Hälfte)
  uint32_t retroSeq; // retroPressSeq beim Druck: gleicher Wert beim Loslassen = kein Tastendruck dazwischen (retroTap)
};
TapHoldKey tapHold[NUM_ROWS][NUM_COLS];
// Quick-Tap: Zeitpunkt des letzten Tipps (Loslassen) je Mod-Tap-Taste; nur der Tipp der zuletzt gedrückten Taste zählt
bool quickTapValid[NUM_ROWS][NUM_COLS];
unsigned long quickTapAt[NUM_ROWS][NUM_COLS];
bool quickTapHeld[NUM_ROWS][NUM_COLS];   // Der laufende Druck gilt als gehaltener Tipp
// Hold nur nach einer Tipp-Pause: Zeitpunkt des letzten Tastendrucks einer der beiden Hälften
bool priorKeyValid = false;
unsigned long priorKeyAt = 0;

// Zähler aller Tastendrücke beider Hälften (retroTap): ein Druck zwischen Halten und Loslassen bricht den Retro-Tipp ab
uint32_t retroPressSeq = 0;

// Einen Tastendruck vormerken (eigene Matrix oder Meldung der anderen Hälfte). Ein späterer Zeitpunkt gewinnt.
void notePriorKeyPress(unsigned long at) {
  retroPressSeq++;
  if (!priorKeyValid || (int32_t)(uint32_t)(at - priorKeyAt) > 0) priorKeyAt = at;
  priorKeyValid = true;
}

// layerTimeoutMs (0 = aus): ohne Tastendruck beider Hälften für diese Zeit fallen alle per TG_n eingerasteten Ebenen
// zurück. Von LAYER_LOCK eingerastete Ebenen (layerLockedMask) und MO_n bleiben. Ein Tastendruck (retroPressSeq) oder
// eine Änderung der eingerasteten Ebenen startet die Frist neu. Aufruf in loop() mit millis().
uint32_t layerTimeoutSeenSeq = 0;
uint8_t layerTimeoutSeenMask = 0;
unsigned long layerTimeoutStampMs = 0;
void layerTimeoutExpire(unsigned long now) {
  layerLockedMask &= toggleLayerMask();   // eine gelöste Ebene ist nicht mehr eingerastet
  uint8_t mask = (uint8_t)(toggleLayerMask() & ~layerLockedMask);
  bool keyHeld = false;   // eine gehaltene Taste (z. B. Mausbewegung) hält die Ebene: die Frist läuft erst nach dem Loslassen
  for (int r = 0; r < NUM_ROWS && !keyHeld; r++) for (int c = 0; c < NUM_COLS; c++) if (keyState[r][c]) { keyHeld = true; break; }
  if (keyHeld || retroPressSeq != layerTimeoutSeenSeq || mask != layerTimeoutSeenMask) {
    layerTimeoutSeenSeq = retroPressSeq;
    layerTimeoutSeenMask = mask;
    layerTimeoutStampMs = now;
    return;
  }
  if (layerTimeoutMs == 0 || mask == 0 || (unsigned long)(now - layerTimeoutStampMs) < layerTimeoutMs) return;
  uint8_t before = getActiveLayer();
  for (int l = 1; l < NUM_LAYERS && l < 8; l++) if (mask & (1u << l)) toggleLayers[l] = false;
  layerTimeoutSeenMask = 0;
  uint8_t after = getActiveLayer();
  if (after != before) Serial.printf("LAYER: TIMEOUT -> Layer %d\n", after);
}

// true, wenn ein Druck zur Zeit now weniger als requirePriorIdleMs nach dem letzten Tastendruck liegt.
// Nur ein Tastendruck vor oder zur Zeit now zählt: ein zurückgehaltener Druck, der später mit seiner Scan-Zeit läuft,
// darf einen späteren Druck der anderen Hälfte nicht als "davor" sehen. 32-Bit-Differenz: nach über 24 Tagen ohne
// Tastendruck wird sie negativ und gilt nicht als kurz davor.
bool priorKeyRecent(unsigned long now) {
  if (requirePriorIdleMs == 0 || !priorKeyValid) return false;
  int32_t since = (int32_t)(uint32_t)(now - priorKeyAt);
  return since >= 0 && since < (int32_t)requirePriorIdleMs;
}

// Wirksamer Tapping-Term: der eigene Wert der Taste, sonst der Wert der Hälfte
static inline uint16_t effectiveTapTerm(uint16_t keyTerm) {
  return keyTerm != 0 ? keyTerm : tappingTermMs;
}

void resetTapHold() {
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      tapHold[r][c] = { false, false, 0, 0, 0, 0, 0, 0 };
      quickTapValid[r][c] = false;
      quickTapAt[r][c] = 0;
      quickTapHeld[r][c] = false;
      autoShiftKeys[r][c] = { false, 0, 0, 0, 0 };
    }
  }
  priorKeyValid = false;
  priorKeyAt = 0;
  resetDeferredQueue();
}

void tapHoldOnPress(uint8_t r, uint8_t c, uint16_t tapAct, uint16_t holdAct, uint8_t layer, unsigned long now, uint16_t term = 0) {
  tapHold[r][c] = { true, false, tapAct, holdAct, layer, now, term, retroPressSeq };
}

// -----------------------------------------------------------------------------
// Doppel-Tipp (Tap-Dance): zweiter Tipp innerhalb von TAPPING_TERM_MS nach dem ersten Loslassen
// -----------------------------------------------------------------------------
// Ein erster Tipp einer Taste mit Doppel-Tipp-Aktion wird zurückgehalten (waiting). Kommt der zweite
// Druck rechtzeitig, löst er die Doppel-Tipp-Aktion aus (active, solange gehalten). Sonst wird der
// erste Tipp nachträglich als normaler Tipp gesendet: nach Ablauf des Fensters oder sofort, wenn eine
// andere Taste gedrückt wird (Reihenfolge der Zeichen bleibt erhalten).
struct DoubleTapKey {
  bool waiting;          // Erster Tipp losgelassen, wartet auf zweiten Druck
  bool active;           // Doppel-Tipp-Aktion ist gedrückt
  uint16_t tapAction;    // Aufgeschobener Einzel-Tipp
  uint16_t dtapAction;
  uint8_t layer;
  unsigned long pressTime;     // Anschlag des ersten Tipps (für die Combo-Grace-Prüfung beim Nachholen)
  unsigned long releaseTime;
  uint16_t term;               // Eigener Tapping-Term der Taste (0 = Wert der Hälfte), gilt auch für das Fenster
};
DoubleTapKey doubleTap[NUM_ROWS][NUM_COLS];
// Beim Anschlag aufgelöste Doppel-Tipp-Aktion (ein Layer-Wechsel während des Haltens ändert sie nicht)
uint16_t tapHoldDtap[NUM_ROWS][NUM_COLS];

void resetDoubleTap() {
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      doubleTap[r][c] = { false, false, 0, 0, 0, 0, 0, 0 };
      tapHoldDtap[r][c] = 0;
    }
  }
}

void sendKeyReleaseNotification(uint8_t r, uint8_t c) {
  char buf[64];
  snprintf(buf, sizeof(buf), "KEY_RELEASE:{\"r\":%d,\"c\":%d}", r, c);
  sendConfigNotification(String(buf));
}

// Wartenden Einzel-Tipp jetzt als normalen Tipp senden
void flushDoubleTap(uint8_t r, uint8_t c) {
  DoubleTapKey &d = doubleTap[r][c];
  if (!d.waiting) return;
  d.waiting = false;
  // Der Tipp gehört zum ersten Anschlag: dessen Zeitstempel für wasComboRecentlyActive() herstellen
  unsigned long savedPressTime = keyPressTime[r][c];
  keyPressTime[r][c] = d.pressTime;
  // Die Combo-Ebenenmaske gilt für die Ebene des ersten Anschlags, nicht für die Ebene beim Nachholen
  uint8_t savedPressLayer = comboPressLayer1[r][c];
  comboPressLayer1[r][c] = (uint8_t)(d.layer + 1);
  dispatchPress(r, c, d.tapAction, d.layer);
  dispatchRelease(r, c, d.tapAction);
  comboPressLayer1[r][c] = savedPressLayer;
  keyPressTime[r][c] = savedPressTime;
  // Die UI hat KEY_RELEASE schon beim Loslassen erhalten; nach dem späten KEY_PRESS erneut senden
  sendKeyReleaseNotification(r, c);
  DOUBLE_TAP_FLUSHED();
}

// Eine andere Taste wird gedrückt: wartende Einzel-Tipps vorher senden
void flushDoubleTapsExcept(uint8_t exceptR, uint8_t exceptC) {
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      if (r == exceptR && c == exceptC) continue;
      flushDoubleTap(r, c);
    }
  }
}

// Ein Tastendruck der anderen Hälfte: alle wartenden Einzel-Tipps vorher senden (Master: vor einem linken
// Druck aus splitProcessRx; links: auf SPLIT_OP_TAP_FLUSH des Masters)
// Eine wartende Auto-Shift-Taste (autoShiftKeys) zählt wie ein wartender Tipp: sie geht als normaler Tipp vor der Taste der anderen Hälfte raus.
void autoShiftFlushExcept(uint8_t exceptR, uint8_t exceptC);
void flushAllDoubleTaps() {
  autoShiftFlushExcept(NUM_ROWS, NUM_COLS);
  flushDoubleTapsExcept(NUM_ROWS, NUM_COLS);
}

// true, wenn ein Einzel-Tipp auf einen möglichen zweiten Tipp wartet (links: SPLIT_OP_TAP_PENDING)
bool anyDoubleTapWaiting() {
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      if (doubleTap[r][c].waiting || autoShiftKeys[r][c].pending) return true;
    }
  }
  return false;
}

void doubleTapTick(unsigned long now) {
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      if (doubleTap[r][c].waiting && (unsigned long)(now - doubleTap[r][c].releaseTime) >= effectiveTapTerm(doubleTap[r][c].term)) {
        flushDoubleTap(r, c);
      }
    }
  }
}

// true, wenn eine Combo mit drei Tasten erst zwei gedrückte Tasten hat (darunter (r, c)), beide im Fenster und
// auf der Maske, und die dritte Taste noch im Fenster ab dem ersten Druck eintreffen kann.
bool hasPendingThreeKeyCombo(uint8_t i, uint8_t r, uint8_t c) {
  if (!comboHasThirdKey(i) || comboAllPressed(i) || !keyState[r][c]) return false;
  const KeyCombo &cb = userCombos[i];
  const uint8_t rs[3] = { cb.r1, cb.r2, cb.r3 }, cs[3] = { cb.c1, cb.c2, cb.c3 };
  unsigned long window = comboWindowMs(i), now = millis(), first = 0;
  int pressed = 0;
  for (int k = 0; k < 3; k++) {
    if (!keyState[rs[k]][cs[k]]) continue;
    if (!comboAppliesOnLayer(i, comboLayerForKey(rs[k], cs[k]))) return false;
    unsigned long t = keyPressTime[rs[k]][cs[k]];
    // Alle gedrückten Tasten liegen paarweise im Fenster; first = der älteste Druck (Abstand zu now am größten)
    for (int j = 0; j < k; j++) {
      if (keyState[rs[j]][cs[j]] && !comboTimesWithin(t, keyPressTime[rs[j]][cs[j]], window)) return false;
    }
    if (pressed == 0 || (unsigned long)(now - t) > (unsigned long)(now - first)) first = t;
    pressed++;
  }
  return pressed == 2 && (unsigned long)(now - first) < window;
}

// true, wenn (r, c) mit bereits gedrückten Partnertasten innerhalb des Fensters der Combo eine Combo bildet
// (bei drei Tasten müssen beide Partner gedrückt sein) oder eine Combo mit drei Tasten noch auf die dritte Taste wartet.
// Eine vollständige Combo wird im selben Scan von checkUserCombos() ausgelöst.
bool hasPressedComboPartnerInWindow(uint8_t r, uint8_t c) {
  for (uint8_t i = 0; i < numCombos; i++) {
    if (!comboContainsKey(i, r, c)) continue;
    if (hasPendingThreeKeyCombo(i, r, c)) return true;
    if (!comboAllPressed(i) || !comboOnMaskLayers(i) || !comboKeysInWindow(i)) continue;
    return true;
  }
  return false;
}

void activateTapHoldAsHold(uint8_t r, uint8_t c) {
  TapHoldKey &k = tapHold[r][c];
  if (!k.pending) return;
  k.pending = false;
  k.holdActive = true;
  // Taste nur mit Doppel-Tipp-Aktion (ohne Halte-Aktion): Halten drückt die Tap-Aktion wie eine normale Taste
  if (k.holdAction == 0) k.holdAction = k.tapAction;
  dispatchPress(r, c, k.holdAction, k.layer);
  // Die Hold-Entscheidung ist endgültig: eine als Combo-Kandidat gepufferte Halte-Aktion
  // (z. B. Ctrl) sofort an den Host senden, damit sie VOR der abhängigen Taste ankommt.
  // Ausnahme: Der Combo-Partner ist im Combo-Fenster gedrückt. Dann gewinnt die Combo im selben Scan,
  // und ein vorab gesendetes Ctrl würde durch releaseAll() als einzelnes Ctrl-Tippen am Host ankommen.
  if (!keySentToHost[r][c] && !isConfigMode && bleKeyboard.isConnected() && !isConfigComboSuppressed(r, c) &&
      !hasPressedComboPartnerInWindow(r, c)) {
    uint16_t act = k.holdAction;
    if (isComboCandidateKey(r, c)) recordRepeatAction(act);
    if (act > 0 && act <= 0xFF) {
      bleKeyboard.pressLockable((uint8_t)act);
      keySentToHost[r][c] = true;
    } else if (isKeyPairAction(act)) {
      if (pressKeyPair(act)) keySentToHost[r][c] = true;
    } else if (isUmlautAction(act)) {
      sendUmlaut(act);
      keySentToHost[r][c] = true;
    } else if (isMacroAction(act)) {
      startMacro(act, millis(), r, c);
      keySentToHost[r][c] = true;
    } else if (isBleHostAction(act)) {
      bleHostSwitchPress(act);
      keySentToHost[r][c] = true;
    } else if (isDynamicMacroAction(act)) {
      dynamicMacroPress(act, millis());
      keySentToHost[r][c] = true;
    } else if (act == ACT_KEY_LOCK) {
      if (keyLockBuffered[r][c]) bleKeyboard.keyLockArm();
      keyLockBuffered[r][c] = false;
      keySentToHost[r][c] = true;
    } else if (act == ACT_LEADER) {
      if (leaderBuffered[r][c]) leaderState.start(millis());
      leaderBuffered[r][c] = false;
      keySentToHost[r][c] = true;
    } else if (isRepeatKeyAction(act)) {
      repeatStartAt(r, c, act == ACT_ALT_REPEAT);
      keySentToHost[r][c] = true;
    } else if (isTextToggleAction(act)) {
      // dispatchPress hat den Druck nur mit Host gepuffert; ohne ihn schaltet die Hold-Entscheidung nichts um
      if (capsWordBuffered[r][c]) sendTextToggle(act);
      capsWordBuffered[r][c] = false;
      keySentToHost[r][c] = true;
    } else if (act >= 0x130 && act <= 0x132) {
      if (act == 0x130) bleKeyboard.mousePressLockable(MOUSE_BUTTON_LEFT);
      else if (act == 0x131) bleKeyboard.mousePressLockable(MOUSE_BUTTON_RIGHT);
      else bleKeyboard.mousePressLockable(MOUSE_BUTTON_MIDDLE);
      keySentToHost[r][c] = true;
    } else if (isWheelAction(act)) {
      wheelSend(act, 1);
      wheelHoldStart(r, c, act, millis());
      keySentToHost[r][c] = true;
    } else if (isMouseMoveAction(act)) {
      mouseMoveStart(r, c, act, millis());
      keySentToHost[r][c] = true;
    }
  }
}

// Vor einer Änderung der Paar-Tabelle: an den Host gesendete Paare mit der noch gültigen Tabelle loslassen.
// Sonst bleibt eine Taste am Host hängen, weil das spätere Release die geänderte Tabelle liest.
// Die Taste gilt danach als verbraucht: ihr physisches Loslassen sendet nichts mehr.
void releaseHeldKeyPairs() {
  REPEAT_RELEASE_HELD_PAIRS();
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      // Ein Paar, das REPEAT hält: pressedAction ist ACT_REPEAT, das Paar steht in repeatResolved
      if (isRepeatKeyAction(pressedAction[r][c]) && isKeyPairAction(repeatResolved[r][c])) {
        if (bleKeyboard.isConnected()) releaseKeyPair(repeatResolved[r][c]);
        repeatResolved[r][c] = 0;
        keySentToHost[r][c] = false;
        pressedAction[r][c] = 0;
        tapHold[r][c].holdActive = false;
        doubleTap[r][c].active = false;
        continue;
      }
      if (!keySentToHost[r][c] || !isKeyPairAction(pressedAction[r][c])) continue;
      if (bleKeyboard.isConnected()) releaseKeyPair(pressedAction[r][c]);
      keySentToHost[r][c] = false;
      pressedAction[r][c] = 0;
      tapHold[r][c].holdActive = false;
      doubleTap[r][c].active = false;
    }
  }
}

// Eine Combo hat die Taste verbraucht: offene Tap-Hold-Entscheidung verwerfen und eine bereits
// aktive Halte-Aktion zurücknehmen, damit die Einzelaktion nicht zusätzlich zur Combo wirkt.
void cancelTapHoldForCombo(uint8_t r, uint8_t c) {
  TapHoldKey &k = tapHold[r][c];
  if (k.holdActive) {
    k.holdActive = false;
    // Combo hat bereits releaseAll() gesendet; nur den Layer-/Aktionszustand zurücksetzen
    keySentToHost[r][c] = false;
    dispatchRelease(r, c, k.holdAction);
  }
  k.pending = false;
  autoShiftKeys[r][c].pending = false;
  DoubleTapKey &d = doubleTap[r][c];
  if (d.active) {
    d.active = false;
    keySentToHost[r][c] = false;
    dispatchRelease(r, c, d.dtapAction);
  }
  if (!anyTapHoldPending() && deferredQueue.count > 0) {
    replayDeferredQueue();
  }
}

// Eine andere Taste wurde gedrückt, während Mod-Tap-Tasten noch unentschieden sind:
// Diese werden sofort zu Hold (z. B. Strg halten + C tippen innerhalb des Tapping-Terms).
void resolvePendingTapHoldsAsHold(uint8_t exceptR, uint8_t exceptC) {
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      if (r == exceptR && c == exceptC) continue;
      if (tapHold[r][c].pending) activateTapHoldAsHold(r, c);
    }
  }
}

// Opposite-Hand-Regel (chordalHold): Ein Druck (r, c) derselben Hälfte entscheidet offene Mod-Tap-Tasten sofort als Tipp.
// Ausgenommen sind die Daumenreihe (gedrückte Taste und Mod-Tap-Taste), Layer-Tap mit MO_n und Tasten mit Doppel-Tipp-Aktion:
// sie behalten die Entscheidung von holdTapMode. Ein Druck der anderen Hälfte läuft nicht hierüber (HOLD_RESOLVE).
void resolvePendingTapHoldsAsTapSameHalf(uint8_t r, uint8_t c, unsigned long now) {
  if (!chordalHold || r >= CHORDAL_THUMB_ROW) return;
  // Zeit und Ebene des Drucks gelten nur für diese Prüfung (Combo-Fenster). Der Aufrufer kann den Druck danach noch
  // puffern: dann dürfen beide Werte nicht bleiben, sonst paart checkUserCombos() die gepufferte Taste mit der offenen.
  unsigned long savedTime = keyPressTime[r][c];
  uint8_t savedLayer = comboPressLayer1[r][c];
  keyPressTime[r][c] = now;
  comboPressLayer1[r][c] = (uint8_t)(getActiveLayer() + 1);
  for (int pr = 0; pr < CHORDAL_THUMB_ROW; pr++) {
    for (int pc = 0; pc < NUM_COLS; pc++) {
      if (pr == r && pc == c) continue;
      TapHoldKey &k = tapHold[pr][pc];
      if (!k.pending || tapHoldDtap[pr][pc] != 0 || k.tapAction == 0) continue;
      // Tapping-Term schon erreicht (Tick lief noch nicht): die Taste ist Hold, die Regel ändert das nicht
      if ((unsigned long)(now - k.pressTime) >= effectiveTapTerm(k.term)) continue;
      if (k.holdAction >= ACT_MO_BASE && k.holdAction < ACT_MO_BASE + NUM_LAYERS) continue;
      // Beide Tasten bilden eine Combo im Fenster: checkUserCombos() löst sie im selben Scan aus; der Tipp darf nicht vorher raus
      if (hasPressedComboPartnerInWindow(pr, pc)) continue;
      k.pending = false;
      dispatchPress(pr, pc, k.tapAction, k.layer);
      dispatchRelease(pr, pc, k.tapAction);
    }
  }
  keyPressTime[r][c] = savedTime;
  comboPressLayer1[r][c] = savedLayer;
}

// true, wenn eine Mod-Tap-Taste noch unentschieden ist (links und rechts: SPLIT_OP_HOLD_PENDING an die andere Hälfte)
bool anyTapHoldPending() {
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      if (tapHold[r][c].pending) return true;
    }
  }
  return false;
}

// Ein Druck der anderen Hälfte (SPLIT_OP_HOLD_RESOLVE, Master: vor einem linken Druck): alle offenen Mod-Tap-Tasten
// als Halten entscheiden. Eine Layer-Taste setzt dabei ihre Ebene; der Aufrufer meldet sie danach (LAYER_STATE).
void resolveAllPendingTapHoldsAsHold() {
  resolvePendingTapHoldsAsHold(NUM_ROWS, NUM_COLS);
}

// Während einer wartenden Mod-Tap-Taste gepufferte Tastenereignisse abspielen
void replayDeferredQueue() {
  if (isReplayingDeferredQueue) return;
  isReplayingDeferredQueue = true;
  while (deferredQueue.count > 0) {
    if (anyTapHoldPending()) {
      // chordalHold: ein gepufferter Druck derselben Hälfte entscheidet die offene Mod-Tap-Taste als Tipp
      const DeferredKeyEvent &next = deferredQueue.items[deferredQueue.head];
      if (!chordalHold || !next.pressed) break;
      resolvePendingTapHoldsAsTapSameHalf(next.row, next.col, next.time);
      if (anyTapHoldPending()) break;
    }
    DeferredKeyEvent ev;
    if (!deferredQueuePop(ev)) break;
    applyMatrixKeyChange(ev.row, ev.col, ev.pressed, ev.time);
  }
  isReplayingDeferredQueue = false;
}

// Gibt true zurück, wenn die Taste vom Tap-Hold-Automaten behandelt wurde.
// dtapAct != 0: ein Tipp wird nicht sofort gesendet, sondern wartet auf einen möglichen zweiten Tipp.
bool tapHoldOnRelease(uint8_t r, uint8_t c, unsigned long now, uint16_t dtapAct = 0) {
  TapHoldKey &k = tapHold[r][c];
  // Release wird vor dem Tick verarbeitet: Tapping-Term hier erneut prüfen,
  // sonst würde ein Halten über tappingTermMs noch als Tap gewertet.
  if (k.pending && (unsigned long)(now - k.pressTime) >= effectiveTapTerm(k.term)) {
    activateTapHoldAsHold(r, c);
  }
  if (k.pending) {
    k.pending = false;
    if (dtapAct != 0) {
      doubleTap[r][c] = { true, false, k.tapAction, dtapAct, k.layer, k.pressTime, now, k.term };
      if (!anyTapHoldPending() && deferredQueue.count > 0) replayDeferredQueue();
      return true;
    }
    dispatchPress(r, c, k.tapAction, k.layer);
    dispatchRelease(r, c, k.tapAction);
    if (quickTapMs > 0) {
      quickTapValid[r][c] = true;
      quickTapAt[r][c] = now;
    }
    if (!anyTapHoldPending() && deferredQueue.count > 0) replayDeferredQueue();
    return true;
  }
  if (k.holdActive) {
    k.holdActive = false;
    dispatchRelease(r, c, k.holdAction);
    // retroTap: Halten ohne Tastendruck beider Hälften dazwischen sendet beim Loslassen den Tipp nach.
    // Ausgenommen: Tasten mit Doppel-Tipp-Aktion und Tasten ohne eigene Halte-Aktion (Halten war schon der Tipp).
    if (retroTap && k.retroSeq == retroPressSeq && tapHoldDtap[r][c] == 0 && k.tapAction != 0 && k.holdAction != k.tapAction) {
      oslNoteKeyPress(k.tapAction, 0, 0);
      dispatchPress(r, c, k.tapAction, k.layer);
      dispatchRelease(r, c, k.tapAction);
    }
    if (!anyTapHoldPending() && deferredQueue.count > 0) replayDeferredQueue();
    return true;
  }
  return false;
}

void tapHoldTick(unsigned long now) {
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      if (tapHold[r][c].pending && (unsigned long)(now - tapHold[r][c].pressTime) >= effectiveTapTerm(tapHold[r][c].term)) {
        activateTapHoldAsHold(r, c);
      }
    }
  }
  if (!anyTapHoldPending() && deferredQueue.count > 0) {
    replayDeferredQueue();
  }
}

// -----------------------------------------------------------------------------
// Matrix-Ereignisse (vom Scan in loop() aufgerufen)
// -----------------------------------------------------------------------------
// Auto Shift: wartende Taste jetzt senden, mit dem umgeschalteten Zeichen (shifted) oder als normaler Tipp-Druck.
// Der Druck bleibt gehalten; das Loslassen läuft über pressedAction.
void autoShiftFire(uint8_t r, uint8_t c, bool shifted) {
  AutoShiftKey &k = autoShiftKeys[r][c];
  if (!k.pending) return;
  k.pending = false;
  dispatchPress(r, c, shifted ? k.shiftedAction : k.tapAction, k.layer);
}

// Eine andere Taste wird gedrückt: wartende Auto-Shift-Tasten vorher als Tipp senden (Reihenfolge der Zeichen bleibt)
void autoShiftFlushExcept(uint8_t exceptR, uint8_t exceptC) {
  for (int r = 0; r < NUM_ROWS; r++)
    for (int c = 0; c < NUM_COLS; c++)
      if (!(r == exceptR && c == exceptC) && autoShiftKeys[r][c].pending) autoShiftFire(r, c, false);
}

void autoShiftTick(unsigned long now) {
  for (int r = 0; r < NUM_ROWS; r++)
    for (int c = 0; c < NUM_COLS; c++)
      if (autoShiftKeys[r][c].pending && (unsigned long)(now - autoShiftKeys[r][c].pressTime) >= autoShiftMs) autoShiftFire(r, c, true);
}

// now: Zeitpunkt des Anschlags. Der Master führt eine zurückgehaltene Änderung später aus (SplitLocalDefer) und
// gibt ihre Scan-Zeit mit, damit Tapping-Term und Combo-Fenster die echten Abstände sehen.
void applyMatrixKeyChangeImpl(uint8_t r, uint8_t c, bool isPressed, unsigned long now) {
  if (isPressed) {
    // chordalHold: offene Mod-Tap-Tasten derselben Hälfte sofort als Tipp entscheiden, vor der Entscheidung von holdTapMode
    if (chordalHold && !isReplayingDeferredQueue && anyTapHoldPending()) {
      resolvePendingTapHoldsAsTapSameHalf(r, c, now);
      if (!anyTapHoldPending() && deferredQueue.count > 0) replayDeferredQueue();
    }
    // In permissiveHold oder tapPreferred nachfolgende Tastendrücke puffern, solange eine Mod-Tap-Taste wartet
    if (holdTapMode != HOLD_MODE_OTHER_KEY_PRESS && !isReplayingDeferredQueue && anyTapHoldPending()) {
      if (deferredQueuePush(r, c, true, now)) {
        return;
      }
      resolveAllPendingTapHoldsAsHold();
      replayDeferredQueue();
    }
    // Wartende Einzel-Tipps und Auto-Shift-Tasten anderer Tasten zuerst senden, damit die Reihenfolge der Zeichen stimmt
    autoShiftFlushExcept(r, c);
    flushDoubleTapsExcept(r, c);
    DoubleTapKey &d = doubleTap[r][c];
    bool isSecondTap = d.waiting && (unsigned long)(now - d.releaseTime) < effectiveTapTerm(d.term);
    // Fenster abgelaufen, aber noch kein Tick: ersten Tipp vor dem neuen Anschlag nachholen
    if (!isSecondTap) flushDoubleTap(r, c);
    keyPressTime[r][c] = now;
    keySentToHost[r][c] = false;
    capsWordBuffered[r][c] = false;
    // Hold nur nach einer Tipp-Pause: Abstand zum letzten Druck beider Hälften vor dem Vormerken dieses Drucks prüfen
    bool priorRecent = priorKeyRecent(now);
    notePriorKeyPress(now);
    // Modus 0 (holdOnOtherKeyPress): Ein weiterer Tastendruck entscheidet offene Mod-Tap-Tasten sofort als Hold
    if (holdTapMode == HOLD_MODE_OTHER_KEY_PRESS) {
      resolvePendingTapHoldsAsHold(r, c);
    }
    uint8_t layer = getActiveLayer();
    comboPressLayer1[r][c] = (uint8_t)(layer + 1);
    if (isSecondTap) {
      d.waiting = false;
      d.active = true;
      swapNoteKeyPress();                        // auch dieser Druck verbraucht die Vormerkung
      oslNoteKeyPress(d.dtapAction, 0, 0);
      numWordNoteKeyPress(d.dtapAction, 0, 0, now);   // die Doppel-Tipp-Aktion steht schon fest
      dispatchPress(r, c, d.dtapAction, layer);
      return;
    }
    uint16_t tapAct, holdAct, dtapAct;
    resolveKeyActions(layer, r, c, tapAct, holdAct, dtapAct);
    // Num Word: eine Taste, die keine Zahl ist, beendet es und gilt auf der Ebene darunter
    if (numWordNoteKeyPress(tapAct, holdAct, dtapAct, now)) {
      layer = getActiveLayer();
      comboPressLayer1[r][c] = (uint8_t)(layer + 1);
      resolveKeyActions(layer, r, c, tapAct, holdAct, dtapAct);
    }
    // Swap hands: bei aktivem Wechsel gilt die gespiegelte Taste. Eine SWAP_HANDS-Taste bleibt an ihrem Platz,
    // sonst ließe sich eine Einrastung nicht lösen. Das Loslassen liest pressedAction[r][c] und bleibt sauber.
    bool isSwapKey = tapAct == ACT_SWAP_HANDS || holdAct == ACT_SWAP_HANDS;
    if (swapActive() && !isSwapKey) {
      resolveKeyActions(layer, r, swapMirrorCol(r, c), tapAct, holdAct, dtapAct);
    }
    if (!isSwapKey) swapNoteKeyPress();
    // Dieser Druck verbraucht eine vorgemerkte One-Shot-Ebene (die Ebene der Taste ist schon aufgelöst)
    oslNoteKeyPress(tapAct, holdAct, dtapAct);
    // Quick-Tap: derselbe Mod-Tap-Druck kurz nach seinem Tipp gilt sofort als gehaltener Tipp.
    // Ein Druck einer anderen Taste verwirft den Merker (nur ein ununterbrochener Tipp-Druck zählt).
    bool quickTap = quickTapMs > 0 && quickTapValid[r][c] && holdAct != 0 && dtapAct == 0 && tapAct != 0 &&
                    (unsigned long)(now - quickTapAt[r][c]) < quickTapMs;
    for (int qr = 0; qr < NUM_ROWS; qr++)
      for (int qc = 0; qc < NUM_COLS; qc++)
        if (qr != r || qc != c) quickTapValid[qr][qc] = false;
    quickTapValid[r][c] = false;
    if (quickTap) {
      quickTapHeld[r][c] = true;
      tapHoldDtap[r][c] = 0;
      dispatchPress(r, c, tapAct, layer);
      return;
    }
    // Hold nur nach einer Tipp-Pause: ein Mod-Tap-Druck kurz nach dem letzten Tastendruck (beider Hälften) ist sofort ein
    // Tipp. Layer-Tap mit MO_n und Tasten mit Doppel-Tipp-Aktion behalten ihre Entscheidung.
    bool priorIdleTap = holdAct != 0 && dtapAct == 0 && tapAct != 0 &&
                        !(holdAct >= ACT_MO_BASE && holdAct < ACT_MO_BASE + NUM_LAYERS) && priorRecent;
    if (priorIdleTap) {
      tapHoldDtap[r][c] = 0;
      dispatchPress(r, c, tapAct, layer);
      return;
    }
    if (holdAct != 0 || dtapAct != 0) {
      tapHoldOnPress(r, c, tapAct, holdAct, layer, now, resolveKeyTapTerm(layer, r, c));
      tapHoldDtap[r][c] = dtapAct;
    } else if (autoShift && autoShiftedAscii(tapAct) != 0 && autoShiftModeAllows(autoShift, tapAct) && !leaderState.active && heldModifierMask() == 0) {
      // Auto Shift (nicht bei gehaltenem Modifikator dieser Hälfte, z. B. Cmd+Z, und nicht in einer Leader-Erfassung): erst nach dem Zeitlimit oder beim Loslassen entscheiden; Tasten mit Halte- oder Doppel-Tipp-Aktion,
      // Modifikatoren und Layer-Tasten (kein ASCII-Zeichen) laufen nie hierher
      autoShiftKeys[r][c] = { true, tapAct, autoShiftedAscii(tapAct), layer, now };
    } else {
      dispatchPress(r, c, tapAct, layer);
    }
  } else {
    // Wenn eine andere Taste losgelassen wird, während eine Mod-Tap-Taste wartet:
    if (holdTapMode != HOLD_MODE_OTHER_KEY_PRESS && !isReplayingDeferredQueue && anyTapHoldPending() && !tapHold[r][c].pending) {
      if (deferredQueueHasPress(r, c)) {
        if (holdTapMode == HOLD_MODE_PERMISSIVE) {
          // Permissive Hold: verschachteltes Press-Release-Paar innerhalb des Fensters -> Mod-Tap sofort Hold
          resolveAllPendingTapHoldsAsHold();
          deferredQueuePush(r, c, false, now);
          replayDeferredQueue();
          return;
        } else if (holdTapMode == HOLD_MODE_TAP_PREFERRED) {
          // Tap Preferred: Loslassen vor Ablauf des Tapping-Terms löst keinen Hold aus -> Release puffern
          if (deferredQueuePush(r, c, false, now)) {
            return;
          }
          resolveAllPendingTapHoldsAsHold();
          replayDeferredQueue();
        }
      }
    }
    DoubleTapKey &d = doubleTap[r][c];
    if (quickTapHeld[r][c]) {
      // Gehaltener Quick-Tap endet: der nächste Druck kann wieder ein Quick-Tap sein
      quickTapHeld[r][c] = false;
      if (quickTapMs > 0) { quickTapValid[r][c] = true; quickTapAt[r][c] = now; }
      dispatchRelease(r, c, pressedAction[r][c]);
    } else if (autoShiftKeys[r][c].pending) {
      // Loslassen: nach dem Zeitlimit das umgeschaltete Zeichen, sonst ein normaler Tipp
      bool shifted = (unsigned long)(now - autoShiftKeys[r][c].pressTime) >= autoShiftMs;
      autoShiftFire(r, c, shifted);
      dispatchRelease(r, c, pressedAction[r][c]);
    } else if (d.active) {
      d.active = false;
      dispatchRelease(r, c, d.dtapAction);
    } else if (!tapHoldOnRelease(r, c, now, tapHoldDtap[r][c])) {
      dispatchRelease(r, c, pressedAction[r][c]);
    }
    tapHoldDtap[r][c] = 0;
    // KEY_RELEASE erst nach einem eventuellen Tap-KEY_PRESS senden, damit die UI nicht hängen bleibt
    sendKeyReleaseNotification(r, c);

    // keyPressTime erst NACH wasComboRecentlyActive auf 0 setzen,
    // damit der echte Anschlag-Zeitstempel für den Grace-Period-Check erhalten bleibt!
    keyPressTime[r][c] = 0;
    comboPressLayer1[r][c] = 0;
  }
}

// Setzt die Scan-Zeit des Ereignisses für Swap hands (Tipp-Erkennung beim nachgespielten Loslassen)
void applyMatrixKeyChange(uint8_t r, uint8_t c, bool isPressed, unsigned long now) {
  unsigned long outer = swapEventMs;           // das Nachspielen ruft diese Funktion verschachtelt auf
  swapEventMs = now;
  applyMatrixKeyChangeImpl(r, c, isPressed, now);
  swapEventMs = outer;
}

void onMatrixKeyChange(uint8_t r, uint8_t c, bool isPressed, unsigned long atMs) {
  applyMatrixKeyChange(r, c, isPressed, atMs);
  // Reines Matrix-Ereignis für die Diagnose (Matrix-Test), unabhängig von Belegung, Ebene und Tap-Hold.
  // Erst nach den HID-Ereignissen senden: die serielle Ausgabe verzögert den Tastendruck nicht.
  // Nur USB-Serial, nie BLE: kein Keylogger-Kanal und keine zusätzliche Last neben den Sync-Acks.
  // "t" = Scan-Zeit der Änderung (32 Bit, millis()): die App erkennt daran Prellen (Druck kurz nach dem Loslassen)
  char matrixBuf[64];
  snprintf(matrixBuf, sizeof(matrixBuf), "MATRIX:{\"r\":%d,\"c\":%d,\"pressed\":%d,\"t\":%lu}", r, c, isPressed ? 1 : 0,
    (unsigned long)(uint32_t)atMs);
  Serial.println(matrixBuf);
}

void onMatrixKeyChange(uint8_t r, uint8_t c, bool isPressed) {
  onMatrixKeyChange(r, c, isPressed, millis());
}

// Zeitgesteuerte Entscheidungen: Mod-Tap Tapping-Term, gepufferte Combo-Kandidaten und laufende Makros
void processDeferredKeys(unsigned long now) {
  tapHoldTick(now);
  autoShiftTick(now);
  doubleTapTick(now);
  leaderTick(now);

  // Gepufferte Combo-Kandidaten senden, falls Zeitfenster (comboTimeoutMs) ohne zweiten Tastendruck abgelaufen ist
  if (!isConfigMode && bleKeyboard.isConnected()) {
    for (int r = 0; r < NUM_ROWS; r++) {
      for (int c = 0; c < NUM_COLS; c++) {
        if (keyState[r][c] && !keySentToHost[r][c] && isComboCandidateKey(r, c)) {
          if ((unsigned long)(now - keyPressTime[r][c]) >= comboBufferMs(r, c)) {
            uint16_t act = pressedAction[r][c];
            recordRepeatAction(act);
            if (act > 0 && act <= 0xFF) {
              bleKeyboard.pressLockable((uint8_t)act);
              keySentToHost[r][c] = true;
            } else if (isKeyPairAction(act)) {
              if (pressKeyPair(act)) keySentToHost[r][c] = true;
            } else if (isUmlautAction(act)) {
              sendUmlaut(act);
              keySentToHost[r][c] = true;
            } else if (isMacroAction(act)) {
              startMacro(act, now, r, c);
              keySentToHost[r][c] = true;
            } else if (isBleHostAction(act)) {
              bleHostSwitchPress(act);
              keySentToHost[r][c] = true;
            } else if (isDynamicMacroAction(act)) {
              dynamicMacroPress(act, now);
              keySentToHost[r][c] = true;
            } else if (act == ACT_KEY_LOCK) {
              if (keyLockBuffered[r][c]) bleKeyboard.keyLockArm();
              keyLockBuffered[r][c] = false;
              keySentToHost[r][c] = true;
            } else if (act == ACT_LEADER) {
              if (leaderBuffered[r][c]) leaderState.start(now);
              leaderBuffered[r][c] = false;
              keySentToHost[r][c] = true;
            } else if (isRepeatKeyAction(act)) {
              repeatStartAt(r, c, act == ACT_ALT_REPEAT);
              keySentToHost[r][c] = true;
            } else if (isTextToggleAction(act)) {
              if (capsWordBuffered[r][c]) sendTextToggle(act);
              capsWordBuffered[r][c] = false;
              keySentToHost[r][c] = true;
            } else if (isMouseKeyAction(act)) {
              if (act == 0x130) bleKeyboard.mousePressLockable(MOUSE_BUTTON_LEFT);
              else if (act == 0x131) bleKeyboard.mousePressLockable(MOUSE_BUTTON_RIGHT);
              else if (act == 0x132) bleKeyboard.mousePressLockable(MOUSE_BUTTON_MIDDLE);
              else { wheelSend(act, 1); wheelHoldStart(r, c, act, now); }
              keySentToHost[r][c] = true;
            } else if (isMouseMoveAction(act)) {
              mouseMoveStart(r, c, act, now);
              keySentToHost[r][c] = true;
            }
          }
        }
      }
    }
  }
  macroTick(now);
  mouseMoveTick(now);
  wheelHoldTick(now);
}

// -----------------------------------------------------------------------------
// Boot-Modus & Serial
// -----------------------------------------------------------------------------
// Nur ein gezielter Soft-Reboot mit gesetztem RTC-Magic startet im isolierten Config-Modus
bool shouldBootIntoConfigMode(esp_reset_reason_t reason, uint32_t magic) {
  return reason == ESP_RST_SW && magic == CONFIG_MODE_MAGIC;
}

// Nicht-blockierender Zeilenpuffer für USB-Serial-Befehle
void feedSerialChar(char ch, String &buf) {
  if (ch == '\n') {
    handleConfigCommand(buf, false);
    buf = "";
  } else if (ch != '\r') {
    if (buf.length() < 256) {
      buf += ch;
    }
  }
}

// -----------------------------------------------------------------------------
// NVS-Persistenz (alle Schreibfunktionen melden Erfolg zurück)
// -----------------------------------------------------------------------------
// true, wenn mindestens eine Taste einen eigenen Tapping-Term hat
bool anyKeyTapTerm() {
  for (int l = 0; l < NUM_LAYERS; l++)
    for (int r = 0; r < NUM_ROWS; r++)
      for (int c = 0; c < NUM_COLS; c++)
        if (TAPTERMMAP[l][r][c] != 0) return true;
  return false;
}

// true, wenn die einkompilierten Defaults eigene Terme tragen (gesetzt am Anfang von loadKeymapFromNVS,
// bevor der NVS TAPTERMMAP überschreibt)
bool tapTermsCompiledIn = false;

// Schreibt TAPTERMMAP in den geöffneten Namespace "dactyl". Ohne eigene Werte entfällt der Schlüssel
// "tapterms": ein fehlender Schlüssel heißt "einkompilierte Werte" (altes Verhalten). Tragen die
// einkompilierten Defaults selbst Terme, speichert ein leeres TAPTERMMAP einen Null-Blob, sonst
// kämen die einkompilierten Terme beim nächsten Start zurück.
bool writeTapTermsToOpenNVS() {
  if (!anyKeyTapTerm() && !tapTermsCompiledIn) {
    if (preferences.isKey("tapterms")) preferences.remove("tapterms");
    return true;
  }
  return preferences.putBytes("tapterms", TAPTERMMAP, sizeof(TAPTERMMAP)) == sizeof(TAPTERMMAP);
}

bool saveKeymapToNVS() {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putBytes("keymap", KEYMAP, sizeof(KEYMAP)) == sizeof(KEYMAP);
  ok = (preferences.putBytes("holdmap", HOLDMAP, sizeof(HOLDMAP)) == sizeof(HOLDMAP)) && ok;
  ok = (preferences.putBytes("dtapmap", DTAPMAP, sizeof(DTAPMAP)) == sizeof(DTAPMAP)) && ok;
  ok = writeTapTermsToOpenNVS() && ok;
  preferences.end();
  Serial.println(ok ? "NVS: Keymap gespeichert." : "NVS: FEHLER beim Speichern der Keymap!");
  return ok;
}

// FNV-1a-Prüfsumme über die EINKOMPILIERTEN Defaults (KEYMAP + HOLDMAP vor dem NVS-Laden) und
// KEYMAP_DEFAULTS_ID. Die ID ist im Repository 0; "Auf Dactyl flashen" (server.py) setzt bei jedem Flash
// aus der App eine neue ID. Ein Flash aus der App übernimmt so immer die App-Belegung, ein Flash aus
// dem Repository (ID 0) behält die Belegung im NVS (loadKeymapFromNVS vergleicht die ID, nicht den Fingerprint).
// DTAPMAP zählt nur mit, wenn sie belegt ist: eine leere DTAPMAP ergibt den Fingerprint älterer Firmware,
// sonst würde das erste Update auf diese Firmware die gespeicherte Belegung überschreiben.
uint32_t keymapDefaultsFingerprint() {
  uint32_t h = 2166136261u;
  const uint32_t id = KEYMAP_DEFAULTS_ID;
  bool hasDtap = false;
  const uint8_t* dtapBytes = (const uint8_t*)DTAPMAP;
  for (size_t i = 0; i < sizeof(DTAPMAP); i++) {
    if (dtapBytes[i] != 0) { hasDtap = true; break; }
  }
  // TAPTERMMAP zählt wie DTAPMAP nur mit, wenn sie belegt ist (Fingerprint älterer Firmware bleibt gleich)
  const uint8_t* parts[5] = { (const uint8_t*)KEYMAP, (const uint8_t*)HOLDMAP, dtapBytes, (const uint8_t*)&id, (const uint8_t*)TAPTERMMAP };
  const size_t sizes[5] = { sizeof(KEYMAP), sizeof(HOLDMAP), hasDtap ? sizeof(DTAPMAP) : 0, sizeof(id), anyKeyTapTerm() ? sizeof(TAPTERMMAP) : 0 };
  for (int p = 0; p < 5; p++) {
    for (size_t i = 0; i < sizes[p]; i++) {
      h ^= parts[p][i];
      h *= 16777619u;
    }
  }
  return h;
}

void loadKeymapFromNVS() {
  tapTermsCompiledIn = anyKeyTapTerm();
  preferences.begin("dactyl", false);
  uint32_t defaultsHash = keymapDefaultsFingerprint();
  bool hasStoredHash = preferences.isKey("defaults_fp");
  uint32_t storedHash = hasStoredHash ? preferences.getUInt("defaults_fp", 0) : 0;
  bool hasKeymap = preferences.isKey("keymap") && preferences.getBytesLength("keymap") == sizeof(KEYMAP);

  // Angewendete ID (NVS-Key "applied_id"): die letzte Nicht-Null-ID, deren Defaults dieses Gerät übernommen hat.
  bool hasAppliedId = preferences.isKey("applied_id");
  uint32_t appliedId = hasAppliedId ? preferences.getUInt("applied_id", 0) : 0;

  // Defaults übernehmen bei: erstem Start / nach RESET_CONFIG (keine Keymap) oder einer neuen Nicht-Null-ID
  // (Flash aus der App). ID 0 (Flash aus dem Repository) ersetzt nie eine vorhandene Keymap, auch nicht
  // bei geänderten Repository-Defaults. Ohne "applied_id" (Firmware davor) gilt der alte Fingerprint-Vergleich
  // bzw. die fw_build-Migration (ID != 0).
  bool useDefaults = !hasKeymap;
  if (hasKeymap && KEYMAP_DEFAULTS_ID != 0) {
    useDefaults = hasAppliedId ? appliedId != (uint32_t)KEYMAP_DEFAULTS_ID
                               : (hasStoredHash ? storedHash != defaultsHash : true);
  }

  if (useDefaults) {
    Serial.printf("NVS: Neue Default-Belegung (0x%08X). Synchronisiere NVS mit Firmware-Defaults.\n", (unsigned)defaultsHash);
    bool ok = preferences.putBytes("keymap", KEYMAP, sizeof(KEYMAP)) == sizeof(KEYMAP);
    ok = (preferences.putBytes("holdmap", HOLDMAP, sizeof(HOLDMAP)) == sizeof(HOLDMAP)) && ok;
    ok = (preferences.putBytes("dtapmap", DTAPMAP, sizeof(DTAPMAP)) == sizeof(DTAPMAP)) && ok;
    // Eigene Tapping-Terme gehören zur Belegung: gespeicherte durch die einkompilierten ersetzen
    ok = writeTapTermsToOpenNVS() && ok;
    // Neue App-Belegung über einer gespeicherten Keymap: sie verweist auf die einkompilierten Tastenpaare (PAIR_n),
    // alte Paare aus dem NVS daher verwerfen. Ohne Keymap (erster Start) gibt es nichts zu ersetzen.
    if (hasKeymap) {
      preferences.remove("num_pairs");
      preferences.remove("pairs_data");
#ifdef DACTYL_KEY_OVERRIDES
      // Überschreibungen kommen mit der App-Belegung mit: die einkompilierte Liste ersetzt die gespeicherte
      preferences.remove("num_ovr");
      preferences.remove("ovr_data");
      preferences.remove("ovr_v2");
#endif
      // Leader-Folgen verweisen auf Tastenpaare und Makros: die einkompilierte Liste ersetzt die gespeicherte
      preferences.remove("num_leader");
      preferences.remove("num_altrep");
      preferences.remove("altrep_data");
      preferences.remove("leader_data");
      // Makros ebenso: MACRO_n verweist auf die einkompilierten Makros
      preferences.remove("num_macros");
      preferences.remove("macro_lens");
      preferences.remove("macro_rep");
      preferences.remove("macros_data");
    }
    // Fingerprint zuletzt und nur nach vollständigem Schreiben: sonst beim nächsten Start erneut versuchen
    // Angewendete ID vor dem Fingerprint schreiben: schlägt sie fehl, wiederholt der nächste Start das Übernehmen
    if (KEYMAP_DEFAULTS_ID != 0) {
      ok = (preferences.putUInt("applied_id", (uint32_t)KEYMAP_DEFAULTS_ID) == sizeof(uint32_t)) && ok;
    } else {
      preferences.remove("applied_id");
    }
    if (ok) {
      preferences.putUInt("defaults_fp", defaultsHash);
      preferences.remove("fw_build");
    } else {
      Serial.println("NVS: FEHLER beim Schreiben der Defaults, Wiederholung beim nächsten Start.");
    }
  } else {
    // Gleiche Defaults (reiner Firmware-Flash) oder Migration ohne App-Flash:
    // die im NVS gespeicherte Belegung des Nutzers bleibt erhalten.
    bool hasHoldmap = preferences.isKey("holdmap") && preferences.getBytesLength("holdmap") == sizeof(HOLDMAP);
    // Fehlende Holdmap (älteres Schema oder abgebrochenes Schreiben) mit den einkompilierten Defaults ergänzen
    bool holdmapOk = hasHoldmap || preferences.putBytes("holdmap", HOLDMAP, sizeof(HOLDMAP)) == sizeof(HOLDMAP);
    // Fehlende Doppel-Tipp-Belegung (Firmware vor Tap-Dance) ebenso mit den einkompilierten Defaults ergänzen
    bool hasDtapmap = preferences.isKey("dtapmap") && preferences.getBytesLength("dtapmap") == sizeof(DTAPMAP);
    bool dtapmapOk = hasDtapmap || preferences.putBytes("dtapmap", DTAPMAP, sizeof(DTAPMAP)) == sizeof(DTAPMAP);
    if (!hasStoredHash && holdmapOk && dtapmapOk) {
      preferences.putUInt("defaults_fp", defaultsHash);
      preferences.remove("fw_build");
    }
    // Gleiche ID wie die gespeicherte Belegung (Firmware davor ohne "applied_id"): ID nachtragen
    if (KEYMAP_DEFAULTS_ID != 0 && !hasAppliedId && hasStoredHash && storedHash == defaultsHash) {
      preferences.putUInt("applied_id", (uint32_t)KEYMAP_DEFAULTS_ID);
    }
    preferences.getBytes("keymap", KEYMAP, sizeof(KEYMAP));
    Serial.println("NVS: Gespeicherte Keymap geladen.");
    if (hasHoldmap) {
      preferences.getBytes("holdmap", HOLDMAP, sizeof(HOLDMAP));
    }
    if (hasDtapmap) {
      preferences.getBytes("dtapmap", DTAPMAP, sizeof(DTAPMAP));
    }
    // Eigene Tapping-Terme: fehlender Schlüssel = einkompilierte Werte; ungültige Werte zählen als 0
    if (preferences.isKey("tapterms") && preferences.getBytesLength("tapterms") == sizeof(TAPTERMMAP)) {
      preferences.getBytes("tapterms", TAPTERMMAP, sizeof(TAPTERMMAP));
      for (int l = 0; l < NUM_LAYERS; l++)
        for (int r = 0; r < NUM_ROWS; r++)
          for (int c = 0; c < NUM_COLS; c++)
            if (!isValidKeyTapTerm(TAPTERMMAP[l][r][c])) TAPTERMMAP[l][r][c] = 0;
    }
  }
  for (int i = 0; i < NUM_LAYERS; i++) {
    String k = "name_" + String(i);
    if (preferences.isKey(k.c_str())) {
      layerNames[i] = preferences.getString(k.c_str());
      Serial.printf("NVS: Layer %d Name geladen: %s\n", i, layerNames[i].c_str());
    }
  }
  standbyTimeoutMinutes = preferences.isKey("standby_timeout") ? preferences.getUInt("standby_timeout", 5) : 5;
  deepSleepTimeoutMinutes = preferences.isKey("sleep_timeout") ? preferences.getUInt("sleep_timeout", 60) : 60;
  if (preferences.isKey("dev_name")) {
    deviceName = preferences.getString("dev_name", DEFAULT_DEVICE_NAME);
  }
  if (preferences.isKey("debounce")) {
    debounceMs = preferences.getUChar("debounce", 5);
  }
  if (preferences.isKey("combo_to")) {
    comboTimeoutMs = preferences.getUShort("combo_to", 40);
  }
  if (preferences.isKey("tap_term")) {
    uint16_t tt = preferences.getUShort("tap_term", TAPPING_TERM_MS);
    if (tt >= TAPPING_TERM_MIN_MS && tt <= TAPPING_TERM_MAX_MS) tappingTermMs = tt;
  }
  if (preferences.isKey("quick_tap")) {
    uint16_t qt = preferences.getUShort("quick_tap", 0);
    if (qt <= QUICK_TAP_MAX_MS) quickTapMs = qt;
  }
  if (preferences.isKey("leader_to")) {
    uint16_t lt = preferences.getUShort("leader_to", LEADER_TIMEOUT_DEFAULT_MS);
    if (lt >= LEADER_TIMEOUT_MIN_MS && lt <= LEADER_TIMEOUT_MAX_MS) leaderTimeoutMs = lt;
  }
  if (preferences.isKey("osm_to")) {
    uint16_t ot = preferences.getUShort("osm_to", 0);
    if (ot == 0 || (ot >= ONE_SHOT_TIMEOUT_MIN_MS && ot <= ONE_SHOT_TIMEOUT_MAX_MS)) oneShotTimeoutMs = ot;
  }
  if (preferences.isKey("layer_to")) {
    uint16_t lt = preferences.getUShort("layer_to", 0);
    if (lt == 0 || (lt >= LAYER_TIMEOUT_MIN_MS && lt <= LAYER_TIMEOUT_MAX_MS)) layerTimeoutMs = lt;
  }
  if (preferences.isKey("prior_idle")) {
    uint16_t pi = preferences.getUShort("prior_idle", 0);
    if (pi <= PRIOR_IDLE_MAX_MS) requirePriorIdleMs = pi;
  }
  if (preferences.isKey("chordal")) {
    uint8_t ch = preferences.getUChar("chordal", 0);
    if (ch <= 1) chordalHold = ch;
  }
  if (preferences.isKey("retro_tap")) {
    uint8_t rt = preferences.getUChar("retro_tap", 0);
    if (rt <= 1) retroTap = rt;
  }
  if (preferences.isKey("nw_layer")) {
    uint8_t nw = preferences.getUChar("nw_layer", 1);
    if (nw < NUM_LAYERS) numWordLayer = nw;
  }
  if (preferences.isKey("auto_shift")) {
    uint8_t as = preferences.getUChar("auto_shift", 0);
    if (as <= AUTO_SHIFT_MAX_MODE) autoShift = as;
  }
  if (preferences.isKey("auto_shift_ms")) {
    uint16_t am = preferences.getUShort("auto_shift_ms", AUTO_SHIFT_DEFAULT_MS);
    if (am >= AUTO_SHIFT_MIN_MS && am <= AUTO_SHIFT_MAX_MS) autoShiftMs = am;
  }
  if (preferences.isKey("hold_mode")) {
    uint8_t hm = preferences.getUChar("hold_mode", 0);
    if (hm <= HOLD_MODE_TAP_PREFERRED) holdTapMode = hm;
  }
  // Tri-Layer: gespeicherte Regeln (auch leer nach SET_TRI_LAYER -) überschreiben die einkompilierten
  if (preferences.isKey("tri_n")) {
    uint8_t n = preferences.getUChar("tri_n", 0);
    size_t want = (size_t)n * TRI_LAYER_RULE_BYTES;
    if (n == 0) {
      numTriLayers = 0;
    } else if (n <= TRI_LAYER_MAX_RULES && preferences.getBytesLength("tri_data") == want) {
      uint8_t tmp[TRI_LAYER_MAX_RULES * TRI_LAYER_RULE_BYTES];
      preferences.getBytes("tri_data", tmp, want);
      bool valid = true;
      for (int i = 0; i < n; i++) {
        if (!isValidTriLayerRule(tmp[i * 3], tmp[i * 3 + 1], tmp[i * 3 + 2])) valid = false;
      }
      if (valid) {
        memcpy(triLayerRules, tmp, want);
        numTriLayers = n;
      }
    }
  }
  // Caps-Lock-LED: gespeicherter Wert überschreibt den einkompilierten
  if (preferences.isKey("caps_led")) {
    uint8_t cl = preferences.getUChar("caps_led", 0);
    if (cl <= 1) capsLedEnabled = cl;
  }
  // Tastenpaare: gespeicherte Liste (auch leer nach CLEAR_PAIRS + SAVE_PAIRS) überschreibt die einkompilierte
  if (preferences.isKey("num_pairs")) {
    uint8_t n = preferences.getUChar("num_pairs", 0);
    if (n == 0) {
      numKeyPairs = 0;
    } else if (n <= MAX_KEY_PAIRS && preferences.isKey("pairs_data")) {
      size_t byteLen = preferences.getBytesLength("pairs_data");
      if (byteLen == n * sizeof(KeyPair)) {
        preferences.getBytes("pairs_data", userKeyPairs, n * sizeof(KeyPair));
        numKeyPairs = n;
      } else if (byteLen == n * 2) {
        uint8_t oldPairs[MAX_KEY_PAIRS][2];
        preferences.getBytes("pairs_data", oldPairs, byteLen);
        for (uint8_t i = 0; i < n; i++) {
          userKeyPairs[i].first = oldPairs[i][0];
          userKeyPairs[i].second = oldPairs[i][1];
        }
        numKeyPairs = n;
        preferences.putBytes("pairs_data", userKeyPairs, n * sizeof(KeyPair));
      }
    }
    Serial.printf("NVS: %d Tastenpaare geladen.\n", numKeyPairs);
  }
#ifdef DACTYL_KEY_OVERRIDES
  // Tasten-Überschreibungen: gespeicherte Liste (auch leer nach CLEAR_OVERRIDES + SAVE_OVERRIDES) überschreibt die einkompilierte
  if (preferences.isKey("num_ovr")) {
    uint8_t n = preferences.getUChar("num_ovr", 0);
    if (n == 0) {
      numKeyOverrides = 0;
    } else if (n <= MAX_KEY_OVERRIDES && preferences.isKey("ovr_v2") &&
               preferences.getBytesLength("ovr_v2") == n * KEY_OVERRIDE_NVS_RECORD_BYTES) {
      // ovr_v2: je Eintrag mods, key, replacement, layerMask
      uint8_t raw[MAX_KEY_OVERRIDES * KEY_OVERRIDE_NVS_RECORD_BYTES];
      preferences.getBytes("ovr_v2", raw, n * KEY_OVERRIDE_NVS_RECORD_BYTES);
      KeyOverride loaded[MAX_KEY_OVERRIDES];
      uint8_t valid = 1;
      for (uint8_t i = 0; i < n; i++) {
        const uint8_t *r = raw + i * KEY_OVERRIDE_NVS_RECORD_BYTES;
        loaded[i].mods = r[0]; loaded[i].key = r[1]; loaded[i].replacement = r[2]; loaded[i].layerMask = r[3];
        valid &= keyOverrideValid(r[0], r[1], r[2], r[3]);
      }
      if (valid) {
        memcpy(userKeyOverrides, loaded, n * sizeof(KeyOverride));
        numKeyOverrides = n;
      }
    } else if (n <= MAX_KEY_OVERRIDES && preferences.isKey("ovr_data") &&
               preferences.getBytesLength("ovr_data") == n * KEY_OVERRIDE_NVS_LEGACY_BYTES) {
      // Altes Format ohne Ebenenmaske: gilt auf allen Ebenen
      uint8_t raw[MAX_KEY_OVERRIDES * KEY_OVERRIDE_NVS_LEGACY_BYTES];
      preferences.getBytes("ovr_data", raw, n * KEY_OVERRIDE_NVS_LEGACY_BYTES);
      KeyOverride loaded[MAX_KEY_OVERRIDES];
      uint8_t valid = 1;
      for (uint8_t i = 0; i < n; i++) {
        const uint8_t *r = raw + i * KEY_OVERRIDE_NVS_LEGACY_BYTES;
        loaded[i].mods = r[0]; loaded[i].key = r[1]; loaded[i].replacement = r[2]; loaded[i].layerMask = KEY_OVERRIDE_ALL_LAYERS;
        valid &= keyOverrideValid(r[0], r[1], r[2]);
      }
      if (valid) {
        memcpy(userKeyOverrides, loaded, n * sizeof(KeyOverride));
        numKeyOverrides = n;
      }
    }
    Serial.printf("NVS: %d Tasten-Überschreibungen geladen.\n", numKeyOverrides);
  }
#endif
  // Eigene Alternate-Repeat-Paare: gespeicherte Liste (auch leer nach CLEAR_ALT_REPEATS + SAVE_ALT_REPEATS) überschreibt die einkompilierte
  if (preferences.isKey("num_altrep")) {
    uint8_t n = preferences.getUChar("num_altrep", 0);
    if (n == 0) {
      numAltRepeats = 0;
    } else if (n <= MAX_ALT_REPEATS && preferences.isKey("altrep_data") &&
               preferences.getBytesLength("altrep_data") == n * sizeof(AltRepeatPair)) {
      AltRepeatPair loaded[MAX_ALT_REPEATS];
      preferences.getBytes("altrep_data", loaded, n * sizeof(AltRepeatPair));
      bool valid = true;
      for (uint8_t i = 0; i < n; i++) valid = valid && loaded[i].key != 0 && loaded[i].alt != 0;
      if (valid) {
        memcpy(userAltRepeats, loaded, n * sizeof(AltRepeatPair));
        numAltRepeats = n;
        Serial.printf("NVS: %d Alt-Repeat-Paare geladen.\n", numAltRepeats);
      } else {
        Serial.println("NVS: Alt-Repeat-Paare ungültig, die einkompilierte Liste bleibt.");
      }
    } else {
      Serial.println("NVS: Alt-Repeat-Paare unvollständig (Anzahl und Daten passen nicht), die einkompilierte Liste bleibt.");
    }
  }
  // Leader-Folgen: gespeicherte Liste (auch leer nach CLEAR_LEADER + SAVE_LEADER) überschreibt die einkompilierte
  if (preferences.isKey("num_leader")) {
    uint8_t n = preferences.getUChar("num_leader", 0);
    if (n == 0) {
      numLeaderSeqs = 0;
    } else if (n <= MAX_LEADER_SEQS && preferences.isKey("leader_data") &&
               preferences.getBytesLength("leader_data") == n * sizeof(LeaderSeq)) {
      LeaderSeq loaded[MAX_LEADER_SEQS];
      preferences.getBytes("leader_data", loaded, n * sizeof(LeaderSeq));
      bool valid = true;
      for (uint8_t i = 0; i < n; i++) valid = valid && leaderSeqValid(loaded[i]);
      if (valid) {
        memcpy(userLeaderSeqs, loaded, n * sizeof(LeaderSeq));
        numLeaderSeqs = n;
        Serial.printf("NVS: %d Leader-Folgen geladen.\n", numLeaderSeqs);
      } else {
        Serial.println("NVS: Leader-Folgen ungültig, die einkompilierte Liste bleibt.");
      }
    } else {
      Serial.println("NVS: Leader-Folgen unvollständig (Anzahl und Daten passen nicht), die einkompilierte Liste bleibt.");
    }
  }
  // Makros: gespeicherte Liste (auch leer nach CLEAR_MACROS + SAVE_MACROS) überschreibt die einkompilierte.
  // macros_data enthält nur die belegten Schritte hintereinander, macro_lens die Länge jedes Makros.
  if (preferences.isKey("num_macros")) {
    uint8_t n = preferences.getUChar("num_macros", 0);
    uint8_t lens[MAX_MACROS] = {0};
    bool valid = n <= MAX_MACROS;
    size_t total = 0;
    if (valid && n > 0) {
      valid = preferences.isKey("macro_lens") && preferences.getBytesLength("macro_lens") == n &&
              preferences.getBytes("macro_lens", lens, n) == n;
      for (int i = 0; valid && i < n; i++) {
        valid = lens[i] <= MAX_MACRO_STEPS;
        total += lens[i];
      }
      size_t bytes = total * sizeof(MacroStep);
      if (valid && bytes > 0) {
        valid = preferences.isKey("macros_data") && preferences.getBytesLength("macros_data") == bytes;
      } else if (valid) {
        valid = !preferences.isKey("macros_data");
      }
    }
    if (valid) {
      static MacroStep packed[MAX_MACROS * MAX_MACRO_STEPS];
      if (total > 0) preferences.getBytes("macros_data", packed, total * sizeof(MacroStep));
      size_t pos = 0;
      for (int i = 0; i < MAX_MACROS; i++) {
        macroLengths[i] = i < n ? lens[i] : 0;
        for (int j = 0; j < macroLengths[i]; j++) userMacros[i][j] = packed[pos++];
      }
      numMacros = n;
      // Wiederholen-Flags (ab Stand 39); fehlt der Schlüssel (älterer Stand), läuft kein Makro wiederholt
      uint8_t rep[MAX_MACROS] = {0};
      bool repOk = n > 0 && preferences.isKey("macro_rep") && preferences.getBytesLength("macro_rep") == n &&
                   preferences.getBytes("macro_rep", rep, n) == n;
      for (int i = 0; i < MAX_MACROS; i++) userMacroRepeat[i] = repOk && i < n && rep[i] == 1;
    }
    Serial.printf("NVS: %d Makros geladen.\n", numMacros);
  }
  if (preferences.isKey("num_combos")) {
    uint8_t n = preferences.getUChar("num_combos", 0);
    if (n == 0) {
      // Gespeicherte leere Liste (CLEAR_COMBOS + SAVE_COMBOS) überschreibt die einkompilierten Combos
      numCombos = 0;
      Serial.println("NVS: 0 Combos geladen.");
    } else if (n <= MAX_COMBOS) {
      bool loaded = false;
      // Ein gültiges altes Blob (Länge passt zu num_combos) gewinnt vor combos_v2. Beide Blobs liegen nur vor, wenn
      // ein Speichern vor dem Entfernen des alten Blobs scheiterte (der alte Stand gilt) oder eine ältere Firmware
      // danach geschrieben hat (deren Stand ist der neuere). SAVE_COMBOS entfernt das alte Blob vor dem Zähler.
      if (preferences.isKey("combos_data") && preferences.getBytesLength("combos_data") == n * COMBO_NVS_LEGACY_BYTES) {
        // Altes Format: 8 Bytes je Combo (sizeof des alten KeyCombo: r1, c1, r2, c2, behavior, 1 Byte Padding,
        // action 16 Bit), ohne Ebenenmaske. Die Combo gilt auf allen Ebenen.
        uint8_t legacy[MAX_COMBOS * COMBO_NVS_LEGACY_BYTES];
        size_t sz = n * COMBO_NVS_LEGACY_BYTES;
        if (preferences.getBytes("combos_data", legacy, sz) == sz) {
          numCombos = n;
          for (int i = 0; i < n; i++) {
            const uint8_t *rec = legacy + i * COMBO_NVS_LEGACY_BYTES;
            userCombos[i].r1 = rec[0];
            userCombos[i].c1 = rec[1];
            userCombos[i].r2 = rec[2];
            userCombos[i].c2 = rec[3];
            userCombos[i].behavior = rec[4];
            userCombos[i].action = (uint16_t)(rec[6] | (rec[7] << 8));
            userCombos[i].layerMask = COMBO_ALL_LAYERS;
            userCombos[i].r3 = COMBO_NO_KEY;
            userCombos[i].c3 = COMBO_NO_KEY;
            userCombos[i].windowMs = 0;
          }
          loaded = true;
          Serial.printf("NVS: %d Combos geladen.\n", numCombos);
        }
      }
      if (!loaded && preferences.isKey("combos_v2")) {
        // Neues Format: Kopf (Version, Satzlänge) und je Combo ein Satz fester Länge (siehe COMBO_NVS_*).
        // Die Anzahl folgt aus der Länge des Blobs, nicht aus num_combos: nach einem unterbrochenen Speichern
        // (Blob geschrieben, Zähler nicht) passt der alte Zähler nicht, das Blob ist aber vollständig.
        uint8_t buf[2 + MAX_COMBOS * COMBO_NVS_RECORD_BYTES];
        size_t sz = preferences.getBytesLength("combos_v2");
        size_t blobCount = sz >= 2 ? (sz - 2) / COMBO_NVS_RECORD_BYTES : 0;
        if (sz >= 2 + COMBO_NVS_RECORD_BYTES && (sz - 2) % COMBO_NVS_RECORD_BYTES == 0 && blobCount <= MAX_COMBOS &&
            preferences.getBytes("combos_v2", buf, sz) == sz && buf[0] == COMBO_NVS_VERSION && buf[1] == COMBO_NVS_RECORD_BYTES) {
          numCombos = (uint8_t)blobCount;
          for (int i = 0; i < (int)blobCount; i++) {
            const uint8_t *rec = buf + 2 + i * COMBO_NVS_RECORD_BYTES;
            userCombos[i].r1 = rec[0];
            userCombos[i].c1 = rec[1];
            userCombos[i].r2 = rec[2];
            userCombos[i].c2 = rec[3];
            userCombos[i].behavior = rec[4];
            userCombos[i].action = (uint16_t)(rec[5] | (rec[6] << 8));
            userCombos[i].layerMask = rec[7] ? rec[7] : COMBO_ALL_LAYERS;
            // Dritte Taste: gültig nur als Paar innerhalb der Matrix, sonst keine. Fenster 0 = comboTimeoutMs.
            bool thirdOk = rec[8] < NUM_ROWS && rec[9] < NUM_COLS &&
                           !(rec[8] == rec[0] && rec[9] == rec[1]) && !(rec[8] == rec[2] && rec[9] == rec[3]);
            userCombos[i].r3 = thirdOk ? rec[8] : COMBO_NO_KEY;
            userCombos[i].c3 = thirdOk ? rec[9] : COMBO_NO_KEY;
            uint16_t w = (uint16_t)(rec[10] | (rec[11] << 8));
            userCombos[i].windowMs = (w >= COMBO_WINDOW_MIN && w <= COMBO_WINDOW_MAX) ? w : 0;
          }
          loaded = true;
          Serial.printf("NVS: %d Combos geladen (v2).\n", numCombos);
        }
      }
      if (loaded) {
        for (int i = 0; i < MAX_COMBOS; i++) {
          comboRuntime[i].active = false;
          comboRuntime[i].lastReleaseTime = 0;
        }
      }
    }
  }
  Serial.printf("NVS: Timeouts & Settings geladen: Standby=%u Min, DeepSleep=%u Min, Debounce=%u ms, ComboTO=%u ms, TappingTerm=%u ms, HoldMode=%u, ChordalHold=%u, Name='%s'\n",
    standbyTimeoutMinutes, deepSleepTimeoutMinutes, debounceMs, comboTimeoutMs, tappingTermMs, holdTapMode, (unsigned)chordalHold, deviceName.c_str());
  preferences.end();
}

bool saveStandbyTimeoutToNVS(uint32_t timeout) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUInt("standby_timeout", timeout) > 0;
  preferences.end();
  if (ok) standbyTimeoutMinutes = timeout;
  Serial.printf("NVS: Standby-Timeout %s: %u Min\n", ok ? "gespeichert" : "FEHLER", timeout);
  return ok;
}

bool saveSleepTimeoutToNVS(uint32_t timeout) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUInt("sleep_timeout", timeout) > 0;
  preferences.end();
  if (ok) deepSleepTimeoutMinutes = timeout;
  Serial.printf("NVS: Deep-Sleep-Timeout %s: %u Min\n", ok ? "gespeichert" : "FEHLER", timeout);
  return ok;
}

bool saveDeviceNameToNVS(String name) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putString("dev_name", name) == name.length();
  preferences.end();
  if (ok) deviceName = name;
  Serial.printf("NVS: Gerätename %s: %s\n", ok ? "gespeichert" : "FEHLER", name.c_str());
  return ok;
}

bool saveDebounceToNVS(uint8_t ms) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUChar("debounce", ms) > 0;
  preferences.end();
  if (ok) debounceMs = ms;
  Serial.printf("NVS: Debounce %s: %u ms\n", ok ? "gespeichert" : "FEHLER", ms);
  return ok;
}

bool saveComboTimeoutToNVS(uint16_t ms) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUShort("combo_to", ms) > 0;
  preferences.end();
  if (ok) comboTimeoutMs = ms;
  Serial.printf("NVS: Combo-Timeout %s: %u ms\n", ok ? "gespeichert" : "FEHLER", ms);
  return ok;
}

bool saveTappingTermToNVS(uint16_t ms) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUShort("tap_term", ms) > 0;
  preferences.end();
  if (ok) tappingTermMs = ms;
  Serial.printf("NVS: Tapping-Term %s: %u ms\n", ok ? "gespeichert" : "FEHLER", ms);
  return ok;
}

// Schreibt die Tri-Layer-Regeln; die RAM-Werte ändern sich nur nach erfolgreichem Schreiben
bool saveTriLayerToNVS(const uint8_t* rules, uint8_t n) {
  if (n > TRI_LAYER_MAX_RULES) return false;
  if (!preferences.begin("dactyl", false)) return false;
  // Vorherigen Stand merken: schlägt der zweite Schreibvorgang fehl, stellt der Rückbau ihn wieder her
  bool hadN = preferences.isKey("tri_n");
  uint8_t oldData[TRI_LAYER_MAX_RULES * TRI_LAYER_RULE_BYTES];
  size_t oldLen = preferences.getBytesLength("tri_data");
  if (oldLen > sizeof(oldData)) oldLen = 0;
  if (oldLen > 0) preferences.getBytes("tri_data", oldData, oldLen);
  bool ok = true;
  if (n > 0) ok = preferences.putBytes("tri_data", rules, (size_t)n * TRI_LAYER_RULE_BYTES) > 0;
  if (ok) ok = preferences.putUChar("tri_n", n) > 0;
  if (!ok && n > 0 && oldLen > 0) preferences.putBytes("tri_data", oldData, oldLen);
  if (!ok && !hadN) preferences.remove("tri_data");
  preferences.end();
  if (ok) {
    memcpy(triLayerRules, rules, (size_t)n * TRI_LAYER_RULE_BYTES);
    numTriLayers = n;
  }
  Serial.printf("NVS: Tri-Layer %s: %u Regeln\n", ok ? "gespeichert" : "FEHLER", n);
  return ok;
}

bool saveNumWordLayerToNVS(uint8_t layer) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUChar("nw_layer", layer) > 0;
  preferences.end();
  if (ok) numWordLayer = layer;
  Serial.printf("NVS: Num-Word-Ebene %s: %u\n", ok ? "gespeichert" : "FEHLER", layer);
  return ok;
}

bool saveRetroTapToNVS(uint8_t on) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUChar("retro_tap", on) > 0;
  preferences.end();
  if (ok) retroTap = on;
  Serial.printf("NVS: Retro-Tap %s: %u\n", ok ? "gespeichert" : "FEHLER", on);
  return ok;
}

bool saveChordalHoldToNVS(uint8_t on) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUChar("chordal", on) > 0;
  preferences.end();
  if (ok) chordalHold = on;
  Serial.printf("NVS: Chordal-Hold %s: %u\n", ok ? "gespeichert" : "FEHLER", on);
  return ok;
}

bool saveAutoShiftToNVS(uint8_t on) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUChar("auto_shift", on) > 0;
  preferences.end();
  if (ok) autoShift = on;
  Serial.printf("NVS: Auto Shift %s: %u\n", ok ? "gespeichert" : "FEHLER", on);
  return ok;
}

bool saveAutoShiftMsToNVS(uint16_t ms) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUShort("auto_shift_ms", ms) > 0;
  preferences.end();
  if (ok) autoShiftMs = ms;
  Serial.printf("NVS: Auto-Shift-Zeitlimit %s: %u ms\n", ok ? "gespeichert" : "FEHLER", ms);
  return ok;
}

bool saveRequirePriorIdleToNVS(uint16_t ms) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUShort("prior_idle", ms) > 0;
  preferences.end();
  if (ok) requirePriorIdleMs = ms;
  Serial.printf("NVS: Hold nach Tipp-Pause %s: %u ms\n", ok ? "gespeichert" : "FEHLER", ms);
  return ok;
}

bool saveLeaderTimeoutToNVS(uint16_t ms) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUShort("leader_to", ms) > 0;
  preferences.end();
  if (ok) leaderTimeoutMs = ms;
  Serial.printf("NVS: Leader-Zeitlimit %s: %u ms\n", ok ? "gespeichert" : "FEHLER", ms);
  return ok;
}

bool saveOneShotTimeoutToNVS(uint16_t ms) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUShort("osm_to", ms) > 0;
  preferences.end();
  if (ok) oneShotTimeoutMs = ms;
  Serial.printf("NVS: One-Shot-Zeitlimit %s: %u ms\n", ok ? "gespeichert" : "FEHLER", ms);
  return ok;
}

bool saveLayerTimeoutToNVS(uint16_t ms) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUShort("layer_to", ms) > 0;
  preferences.end();
  if (ok) {
    layerTimeoutMs = ms;
    layerTimeoutSeenMask = 0xFF;   // erzwingt einen neuen Stempel: die Frist zählt ab der Änderung, nicht ab dem letzten Druck
  }
  Serial.printf("NVS: Ebenen-Zeitlimit %s: %u ms\n", ok ? "gespeichert" : "FEHLER", ms);
  return ok;
}

bool saveQuickTapToNVS(uint16_t ms) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUShort("quick_tap", ms) > 0;
  preferences.end();
  if (ok) quickTapMs = ms;
  Serial.printf("NVS: Quick-Tap %s: %u ms\n", ok ? "gespeichert" : "FEHLER", ms);
  return ok;
}

// Host-LEDs im Hauptdurchlauf: neue Zeile "HOST_LEDS:{...}" auf USB-Serial (nie über BLE) und Onboard-LED
// (GPIO 22) nach Setting. Ohne Setting bleibt der Pin unberührt.
inline void hostLedsService(HostLedsState &st) {
  static int8_t lastLevel = -1;
  char line[64];
  const uint8_t bits = st.bits;  // einmal lesen: Zeile und LED zeigen denselben Stand
  if (hostLedsTakeLine(st, bits, line, sizeof(line))) Serial.println(line);
  uint8_t level = hostLedPinLevel(bits, capsLedEnabled != 0);
  if (!capsLedEnabled) {
    if (lastLevel == 0) { digitalWrite(HOST_LED_PIN, 1); lastLevel = 1; }  // Setting aus: LED löschen
    return;
  }
  if (lastLevel != (int8_t)level) {
    pinMode(HOST_LED_PIN, OUTPUT);
    digitalWrite(HOST_LED_PIN, level);
    lastLevel = (int8_t)level;
  }
}

bool saveCapsLedToNVS(uint8_t on) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUChar("caps_led", on) > 0;
  preferences.end();
  if (ok) capsLedEnabled = on;
  Serial.printf("NVS: Caps-Lock-LED %s: %u\n", ok ? "gespeichert" : "FEHLER", on);
  return ok;
}

bool saveHoldTapModeToNVS(uint8_t mode) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUChar("hold_mode", mode) > 0;
  preferences.end();
  if (ok) holdTapMode = mode;
  Serial.printf("NVS: Mod-Tap-Modus %s: %u\n", ok ? "gespeichert" : "FEHLER", mode);
  return ok;
}

// NVS-Format der Combos ("combos_v2"): 2 Bytes Kopf (COMBO_NVS_VERSION, COMBO_NVS_RECORD_BYTES), danach je Combo ein
// Satz fester Länge:
//   0 r1, 1 c1, 2 r2, 3 c2, 4 behavior, 5..6 action (little endian), 7 layerMask (Bit i = Ebene i),
//   8 r3, 9 c3 (dritte Taste, 0xFF = keine), 10..11 eigenes Fenster in ms (little endian, 0 = comboTimeoutMs)
// Das alte Format ("combos_data") hat 8 Bytes je Combo (Padding vor action) und bleibt lesbar (Ebenenmaske = alle Ebenen).
bool saveCombosToNVS() {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = true;
  if (numCombos > 0) {
    uint8_t buf[2 + MAX_COMBOS * COMBO_NVS_RECORD_BYTES];
    size_t len = 2 + (size_t)numCombos * COMBO_NVS_RECORD_BYTES;
    buf[0] = COMBO_NVS_VERSION;
    buf[1] = COMBO_NVS_RECORD_BYTES;
    for (int i = 0; i < numCombos; i++) {
      uint8_t *rec = buf + 2 + i * COMBO_NVS_RECORD_BYTES;
      rec[0] = userCombos[i].r1;
      rec[1] = userCombos[i].c1;
      rec[2] = userCombos[i].r2;
      rec[3] = userCombos[i].c2;
      rec[4] = userCombos[i].behavior;
      rec[5] = (uint8_t)(userCombos[i].action & 0xFF);
      rec[6] = (uint8_t)(userCombos[i].action >> 8);
      rec[7] = userCombos[i].layerMask;
      rec[8] = userCombos[i].r3;
      rec[9] = userCombos[i].c3;
      rec[10] = (uint8_t)(userCombos[i].windowMs & 0xFF);
      rec[11] = (uint8_t)(userCombos[i].windowMs >> 8);
    }
    // Reihenfolge: neues Blob, altes Blob entfernen, Zähler. Das Laden nimmt die Anzahl aus der Länge des neuen
    // Blobs und bevorzugt ein gültiges altes Blob. Zwischenstände: nach dem Blob gilt noch der alte Stand; nach dem
    // Entfernen gilt das neue Blob (auch mit altem Zähler); ein Fehler davor lässt den alten Stand unverändert.
    ok = (preferences.putBytes("combos_v2", buf, len) == len);
    if (ok && preferences.isKey("combos_data")) ok = preferences.remove("combos_data");
    if (ok) ok = preferences.putUChar("num_combos", numCombos) > 0;
  } else {
    // Leere Liste: zuerst der Zähler 0 (er entscheidet beim Laden), die Blobs nur nach Erfolg entfernen
    ok = preferences.putUChar("num_combos", 0) > 0;
    if (ok) {
      preferences.remove("combos_v2");
      if (preferences.isKey("combos_data")) preferences.remove("combos_data");
    }
  }
  preferences.end();
  Serial.printf("NVS: %d Combos %s.\n", numCombos, ok ? "gespeichert" : "FEHLER beim Speichern");
  return ok;
}

bool saveAltRepeatsToNVS() {
  if (!preferences.begin("dactyl", false)) return false;
  // Daten zuerst, Anzahl zuletzt: ein Fehler beim Schreiben der Daten lässt die alte Anzahl nicht mit neuen Daten stehen
  bool ok = true;
  size_t len = numAltRepeats * sizeof(AltRepeatPair);
  if (len > 0) {
    ok = preferences.putBytes("altrep_data", userAltRepeats, len) == len;
  } else {
    preferences.remove("altrep_data");
  }
  if (ok) ok = preferences.putUChar("num_altrep", numAltRepeats) > 0;
  preferences.end();
  Serial.printf("NVS: %d Alt-Repeat-Paare %s.\n", numAltRepeats, ok ? "gespeichert" : "FEHLER beim Speichern");
  return ok;
}

bool saveLeaderSeqsToNVS() {
  if (!preferences.begin("dactyl", false)) return false;
  // Daten zuerst, Anzahl zuletzt: ein Fehler beim Schreiben der Daten lässt die alte Anzahl nicht mit neuen Daten stehen
  bool ok = true;
  size_t len = numLeaderSeqs * sizeof(LeaderSeq);
  if (len > 0) {
    ok = preferences.putBytes("leader_data", userLeaderSeqs, len) == len;
  } else {
    preferences.remove("leader_data");
  }
  if (ok) ok = preferences.putUChar("num_leader", numLeaderSeqs) > 0;
  preferences.end();
  Serial.printf("NVS: %d Leader-Folgen %s.\n", numLeaderSeqs, ok ? "gespeichert" : "FEHLER beim Speichern");
  return ok;
}

bool saveKeyPairsToNVS() {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUChar("num_pairs", numKeyPairs) > 0;
  size_t len = numKeyPairs * sizeof(KeyPair);
  // Leere Liste: putBytes mit Länge 0 meldet 0 Bytes, das ist kein Fehler
  if (len > 0) {
    ok = (preferences.putBytes("pairs_data", userKeyPairs, len) == len) && ok;
  } else {
    preferences.remove("pairs_data");
  }
  preferences.end();
  Serial.printf("NVS: %d Tastenpaare %s.\n", numKeyPairs, ok ? "gespeichert" : "FEHLER beim Speichern");
  return ok;
}

#ifdef DACTYL_KEY_OVERRIDES
bool saveKeyOverridesToNVS() {
  if (!preferences.begin("dactyl", false)) return false;
  // Daten zuerst, Anzahl zuletzt: ein Fehler beim Schreiben der Daten lässt die alte Anzahl nicht mit neuen Daten stehen
  bool ok = true;
  size_t len = numKeyOverrides * KEY_OVERRIDE_NVS_RECORD_BYTES;
  // Leere Liste: putBytes mit Länge 0 meldet 0 Bytes, das ist kein Fehler
  if (len > 0) {
    uint8_t raw[MAX_KEY_OVERRIDES * KEY_OVERRIDE_NVS_RECORD_BYTES];
    for (uint8_t i = 0; i < numKeyOverrides; i++) {
      uint8_t *r = raw + i * KEY_OVERRIDE_NVS_RECORD_BYTES;
      r[0] = userKeyOverrides[i].mods; r[1] = userKeyOverrides[i].key;
      r[2] = userKeyOverrides[i].replacement; r[3] = userKeyOverrides[i].layerMask;
    }
    ok = preferences.putBytes("ovr_v2", raw, len) == len;
  } else {
    preferences.remove("ovr_v2");
  }
  // Das alte Format entfällt: ovr_v2 ersetzt es
  if (ok) preferences.remove("ovr_data");
  if (ok) ok = preferences.putUChar("num_ovr", numKeyOverrides) > 0;
  preferences.end();
  Serial.printf("NVS: %d Tasten-Überschreibungen %s.\n", numKeyOverrides, ok ? "gespeichert" : "FEHLER beim Speichern");
  return ok;
}
#endif

// Nur die belegten Schritte speichern (kompakt), nicht das volle Array: spart NVS-Einträge
bool saveMacrosToNVS() {
  if (!preferences.begin("dactyl", false)) return false;
  static MacroStep packed[MAX_MACROS * MAX_MACRO_STEPS];
  size_t total = 0;
  for (int i = 0; i < numMacros; i++) {
    for (int j = 0; j < macroLengths[i]; j++) packed[total++] = userMacros[i][j];
  }
  // num_macros zuerst entfernen und zuletzt schreiben: ein Abbruch dazwischen lädt beim Start die
  // einkompilierten Makros, nie eine Mischung aus alter Anzahl und neuen Längen oder Daten
  preferences.remove("num_macros");
  bool ok = true;
  // Leere Daten: putBytes mit Länge 0 meldet 0 Bytes, deshalb den Schlüssel entfernen
  if (numMacros > 0) {
    ok = preferences.putBytes("macro_lens", macroLengths, numMacros) == numMacros;
  } else {
    preferences.remove("macro_lens");
  }
  size_t bytes = total * sizeof(MacroStep);
  if (bytes > 0) {
    ok = (preferences.putBytes("macros_data", packed, bytes) == bytes) && ok;
  } else {
    preferences.remove("macros_data");
  }
  if (numMacros > 0) {
    uint8_t rep[MAX_MACROS] = {0};
    for (int i = 0; i < numMacros; i++) rep[i] = userMacroRepeat[i] ? 1 : 0;
    ok = (preferences.putBytes("macro_rep", rep, numMacros) == numMacros) && ok;
  } else {
    preferences.remove("macro_rep");
  }
  if (ok) ok = preferences.putUChar("num_macros", numMacros) > 0;
  preferences.end();
  Serial.printf("NVS: %d Makros %s.\n", numMacros, ok ? "gespeichert" : "FEHLER beim Speichern");
  return ok;
}

bool saveLayerNameToNVS(int idx, String name) {
  if (idx < 0 || idx >= NUM_LAYERS) return false;
  if (!preferences.begin("dactyl", false)) return false;
  String k = "name_" + String(idx);
  bool ok = preferences.putString(k.c_str(), name) == name.length();
  preferences.end();
  if (ok) layerNames[idx] = name;
  Serial.printf("NVS: Layer %d Name %s: %s\n", idx, ok ? "gespeichert" : "FEHLER", name.c_str());
  return ok;
}

// -----------------------------------------------------------------------------
// Konfigurations-Benachrichtigungen & Befehle (USB-Serial und BLE GATT)
// -----------------------------------------------------------------------------
void sendConfigNotification(String msg, bool addDelay) {
  Serial.println(msg);
  if (pConfigCharacteristic) {
    // Im normalen Mac-Tastaturmodus keine Tastendrücke über BLE-Notifications senden (Keylogger-Schutz)
    if (!isConfigMode && (msg.startsWith("KEY_PRESS") || msg.startsWith("KEY_RELEASE"))) {
      return;
    }
    pConfigCharacteristic->setValue(msg.c_str());
    pConfigCharacteristic->notify();
    if (addDelay) {
      delay(15);
    }
  }
}

// Bereinigt Namen für NVS, C++-Codegen und JSON-Ausgabe
String sanitizeConfigName(String name) {
  name.replace("\"", "");
  name.replace("\\", "");
  name.trim();
  if (name.length() > 31) name = name.substring(0, 31);
  return name;
}

void sendMatrixData(const char* prefix, uint16_t (*matrix)[NUM_ROWS][NUM_COLS], int l) {
  String out = String(prefix) + "{\"l\":" + String(l) + ",\"k\":[";
  for (int r = 0; r < NUM_ROWS; r++) {
    out += "[";
    for (int c = 0; c < NUM_COLS; c++) {
      out += String(matrix[l][r][c]);
      if (c < NUM_COLS - 1) out += ",";
    }
    out += "]";
    if (r < NUM_ROWS - 1) out += ",";
  }
  out += "]}";
  sendConfigNotification(out, true);
}

// GET_CONFIG: Combos, Tastenpaare und Makros in kurzen Blöcken (je Zeile höchstens ~150 Zeichen, damit sie in eine
// BLE-Benachrichtigung bei kleiner MTU passt). Jede Liste beginnt mit ..._COUNT:<n>; ..._DATA trägt den Offset "o".
// Ein Makro sendet "n" (Schrittzahl) in jedem Block; ein leeres Makro sendet einen Block ohne Schritte.
#define GET_CONFIG_COMBOS_PER_LINE 3
#define GET_CONFIG_PAIRS_PER_LINE  8
#define GET_CONFIG_OVERRIDES_PER_LINE 6
#define GET_CONFIG_LEADER_PER_LINE 4
#define GET_CONFIG_ALTREP_PER_LINE 8
#define GET_CONFIG_STEPS_PER_LINE  8
void sendCombosPairsMacros() {
  sendConfigNotification("COMBO_COUNT:" + String(numCombos), true);
  for (int o = 0; o < numCombos; o += GET_CONFIG_COMBOS_PER_LINE) {
    String out = "COMBO_DATA:{\"o\":" + String(o) + ",\"e\":[";
    for (int i = o; i < numCombos && i < o + GET_CONFIG_COMBOS_PER_LINE; i++) {
      const KeyCombo &cb = userCombos[i];
      out += String(i > o ? "," : "") + "[" + cb.r1 + "," + cb.c1 + "," + cb.r2 + "," + cb.c2 + "," + cb.behavior + "," + cb.action + "," + cb.layerMask;
      // Dritte Taste und Fenster nur bei einer Combo, die sie nutzt: alle anderen Einträge bleiben bei sieben Werten
      if (comboHasThirdKey(i) || cb.windowMs) out += String(",") + cb.r3 + "," + cb.c3 + "," + cb.windowMs;
      out += "]";
    }
    sendConfigNotification(out + "]}", true);
  }
  sendConfigNotification("PAIR_COUNT:" + String(numKeyPairs), true);
  for (int o = 0; o < numKeyPairs; o += GET_CONFIG_PAIRS_PER_LINE) {
    String out = "PAIR_DATA:{\"o\":" + String(o) + ",\"e\":[";
    for (int i = o; i < numKeyPairs && i < o + GET_CONFIG_PAIRS_PER_LINE; i++) {
      out += String(i > o ? "," : "") + "[" + userKeyPairs[i].first + "," + userKeyPairs[i].second + "]";
    }
    sendConfigNotification(out + "]}", true);
  }
#ifdef DACTYL_KEY_OVERRIDES
  sendConfigNotification("OVERRIDE_COUNT:" + String(numKeyOverrides), true);
  for (int o = 0; o < numKeyOverrides; o += GET_CONFIG_OVERRIDES_PER_LINE) {
    String out = "OVERRIDE_DATA:{\"o\":" + String(o) + ",\"e\":[";
    for (int i = o; i < numKeyOverrides && i < o + GET_CONFIG_OVERRIDES_PER_LINE; i++) {
      out += String(i > o ? "," : "") + "[" + userKeyOverrides[i].mods + "," + userKeyOverrides[i].key + "," + userKeyOverrides[i].replacement + "," + userKeyOverrides[i].layerMask + "]";
    }
    sendConfigNotification(out + "]}", true);
  }
#endif
  sendConfigNotification("LEADER_COUNT:" + String(numLeaderSeqs), true);
  for (int o = 0; o < numLeaderSeqs; o += GET_CONFIG_LEADER_PER_LINE) {
    String out = "LEADER_DATA:{\"o\":" + String(o) + ",\"e\":[";
    for (int i = o; i < numLeaderSeqs && i < o + GET_CONFIG_LEADER_PER_LINE; i++) {
      const LeaderSeq &ls = userLeaderSeqs[i];
      out += String(i > o ? "," : "") + "[" + ls.action;
      for (int k = 0; k < LEADER_MAX_KEYS; k++) out += String(",") + ls.keys[k];
      out += "]";
    }
    sendConfigNotification(out + "]}", true);
  }
  sendConfigNotification("ALTREP_COUNT:" + String(numAltRepeats), true);
  for (int o = 0; o < numAltRepeats; o += GET_CONFIG_ALTREP_PER_LINE) {
    String out = "ALTREP_DATA:{\"o\":" + String(o) + ",\"e\":[";
    for (int i = o; i < numAltRepeats && i < o + GET_CONFIG_ALTREP_PER_LINE; i++) {
      out += String(i > o ? "," : "") + "[" + userAltRepeats[i].key + "," + userAltRepeats[i].alt + "]";
    }
    sendConfigNotification(out + "]}", true);
  }
  sendConfigNotification("MACRO_COUNT:" + String(numMacros), true);
  for (int i = 0; i < numMacros; i++) {
    int n = macroLengths[i];
    for (int o = 0; o == 0 || o < n; o += GET_CONFIG_STEPS_PER_LINE) {
      String out = "MACRO_DATA:{\"i\":" + String(i) + ",\"n\":" + String(n) + ",\"o\":" + String(o) + (userMacroRepeat[i] ? ",\"r\":1" : "") + ",\"s\":[";
      for (int j = o; j < n && j < o + GET_CONFIG_STEPS_PER_LINE; j++) {
        const MacroStep &st = userMacros[i][j];
        out += String(j > o ? "," : "") + "[" + st.type + "," + st.code + "," + st.ms + "]";
      }
      sendConfigNotification(out + "]}", true);
    }
  }
}

// Parst "<CMD> l r c tap [hold [dtap]]". Fehlende Werte werden auf 0 gesetzt, überzählige abgelehnt.
// fmt endet mit " %c", damit ein siebter Wert erkannt wird.
bool parseKeyCommand(const String &cmd, const char *fmt, int &l, int &r, int &c, int &tap, int &hold, int &dtap) {
  hold = 0;
  dtap = 0;
  char extra;
  int n = sscanf(cmd.c_str(), fmt, &l, &r, &c, &tap, &hold, &dtap, &extra);
  if (n < 4 || n > 6) return false;
  return l >= 0 && l < NUM_LAYERS && r >= 0 && r < NUM_ROWS && c >= 0 && c < NUM_COLS &&
         tap >= 0 && tap <= 0xFFFF && hold >= 0 && hold <= 0xFFFF && dtap >= 0 && dtap <= 0xFFFF;
}

// -----------------------------------------------------------------------------
// Diagnose (GET_DIAG)
// -----------------------------------------------------------------------------
// Reset-Grund des letzten Starts; das Setup setzt ihn aus esp_reset_reason()
static volatile esp_reset_reason_t diagBootReason = ESP_RST_UNKNOWN;
// Längster loop()-Durchlauf seit dem Start in Mikrosekunden, ohne das absichtliche delay() am Ende
// (ein Schreiber: loop(); der BLE-Task liest nur)
static volatile uint32_t diagLoopMaxUs = 0;

void diagNoteLoopUs(uint32_t us) {
  if (us > diagLoopMaxUs) diagLoopMaxUs = us;
}

// Reiner Name des Reset-Grunds (JSON-sicher). Die App wertet die Namen "power_on", "deep_sleep" und
// "software" als normal; jeder andere Name erhält eine Markierung.
const char* resetReasonName(esp_reset_reason_t reason) {
  switch (reason) {
    case ESP_RST_POWERON: return "power_on";
    case ESP_RST_EXT: return "external";
    case ESP_RST_SW: return "software";
    case ESP_RST_PANIC: return "panic";
    case ESP_RST_INT_WDT: return "int_wdt";
    case ESP_RST_TASK_WDT: return "task_wdt";
    case ESP_RST_WDT: return "wdt";
    case ESP_RST_DEEPSLEEP: return "deep_sleep";
    case ESP_RST_BROWNOUT: return "brownout";
    case ESP_RST_SDIO: return "sdio";
    case ESP_RST_USB: return "usb";
    case ESP_RST_JTAG: return "jtag";
    case ESP_RST_EFUSE: return "efuse";
    case ESP_RST_PWR_GLITCH: return "pwr_glitch";
    case ESP_RST_CPU_LOCKUP: return "cpu_lockup";
    default: return "unknown";
  }
}

// DIAG:{"reset":"<Grund>","uptime_s":n,"heap_free":n,"heap_min":n,"loop_max_us":n[,"sq_max":n,"sq_drop":n]}
// sq_max und sq_drop (Sendewarteschlange) meldet nur die linke Hälfte (DIAG_SEND_QUEUE_MAX / DIAG_SEND_QUEUE_DROPPED)
String buildDiagLine(esp_reset_reason_t reason, uint32_t uptimeS, uint32_t heapFree, uint32_t heapMin, uint32_t loopMaxUs,
                     bool withQueue = false, uint32_t sqMax = 0, uint32_t sqDrop = 0) {
  char buf[224];
  int n = snprintf(buf, sizeof(buf), "DIAG:{\"reset\":\"%s\",\"uptime_s\":%lu,\"heap_free\":%lu,\"heap_min\":%lu,\"loop_max_us\":%lu",
    resetReasonName(reason), (unsigned long)uptimeS, (unsigned long)heapFree, (unsigned long)heapMin, (unsigned long)loopMaxUs);
  if (withQueue) n += snprintf(buf + n, sizeof(buf) - n, ",\"sq_max\":%lu,\"sq_drop\":%lu", (unsigned long)sqMax, (unsigned long)sqDrop);
  snprintf(buf + n, sizeof(buf) - n, "}");
  return String(buf);
}

void handleConfigCommand(String cmd, bool fromBle) {
  cmd.trim();
  if (cmd.length() == 0) return;

  // Über BLE ist im normalen Tastaturmodus nur GET_INFO erlaubt. Der Config-Modus wird ausschließlich
  // physisch (Config-Combo CONFIG_COMBO_*) oder per USB-Serial (ENTER_CONFIG) aktiviert.
  if (fromBle && !isConfigMode && cmd != "GET_INFO") {
    if (cmd.startsWith("OTA_")) {
      sendConfigNotification("OTA_ERR:NOT_CONFIG_MODE");
    }
    // Diagnosewerte (Laufzeit, Heap) gibt es über BLE nur im Config-Modus
    if (cmd == "GET_DIAG") {
      sendConfigNotification("ERR FORBIDDEN GET_DIAG");
    }
    Serial.println("WARN: BLE-Befehl abgelehnt (nicht im Config-Modus): " + cmd);
    return;
  }

  if (otaInProgress && !cmd.startsWith("OTA_")) {
    sendConfigNotification("ERR BUSY OTA_IN_PROGRESS");
    return;
  }

  lastActivityTime = millis();

  bool mutexTaken = false;
  if (configMutex) {
    mutexTaken = (xSemaphoreTake(configMutex, pdMS_TO_TICKS(100)) == pdTRUE);
    if (!mutexTaken) {
      Serial.println("WARN: configMutex busy, skipping command: " + cmd);
      sendConfigNotification("ERR BUSY " + cmd);
      return;
    }
  }

  if (cmd.startsWith("OTA_BEGIN ")) {
    if (!isConfigMode) {
      sendConfigNotification("OTA_ERR:NOT_CONFIG_MODE");
    } else {
      int firstSpace = cmd.indexOf(' ', 10);
      if (firstSpace < 0) {
        sendConfigNotification("OTA_ERR:ARGS");
      } else {
        long long sz = cmd.substring(10, firstSpace).toInt();
        if (sz <= 0 || sz > 1900000) {
          sendConfigNotification("OTA_ERR:SIZE_INVALID");
        } else {
          String sigHex = cmd.substring(firstSpace + 1);
          sigHex.trim();
          if (sigHex.length() != 128) {
            sendConfigNotification("OTA_ERR:SIG_FORMAT");
          } else {
            uint8_t sigBytes[64];
            bool hexOk = true;
            for (int i = 0; i < 64; i++) {
              char c1 = sigHex.charAt(i * 2);
              char c2 = sigHex.charAt(i * 2 + 1);
              int v1 = (c1 >= '0' && c1 <= '9') ? (c1 - '0') :
                       (c1 >= 'a' && c1 <= 'f') ? (c1 - 'a' + 10) :
                       (c1 >= 'A' && c1 <= 'F') ? (c1 - 'A' + 10) : -1;
              int v2 = (c2 >= '0' && c2 <= '9') ? (c2 - '0') :
                       (c2 >= 'a' && c2 <= 'f') ? (c2 - 'a' + 10) :
                       (c2 >= 'A' && c2 <= 'F') ? (c2 - 'A' + 10) : -1;
              if (v1 < 0 || v2 < 0) { hexOk = false; break; }
              sigBytes[i] = (uint8_t)((v1 << 4) | v2);
            }
            if (!hexOk) {
              sendConfigNotification("OTA_ERR:SIG_FORMAT");
            } else {
              if (otaInProgress) {
                Update.abort();
                otaInProgress = false;
              }
              if (!Update.begin((size_t)sz, U_FLASH)) {
                sendConfigNotification("OTA_ERR:UPDATE_BEGIN_FAILED");
              } else if (!otaVerifier.init(DACTYL_OTA_PUBLIC_KEY, sigBytes, (size_t)sz)) {
                Update.abort();
                sendConfigNotification("OTA_ERR:VERIFIER_INIT_FAILED");
              } else {
                otaExpectedSize = (size_t)sz;
                otaWrittenBytes = 0;
                otaNextSeq = 0;
                memcpy(otaExpectedSig, sigBytes, 64);
                otaInProgress = true;
                lastOtaChunkTime = millis();
                sendConfigNotification("OTA_READY");
              }
            }
          }
        }
      }
    }
  } else if (cmd == "OTA_END") {
    if (!otaInProgress) {
      sendConfigNotification("OTA_ERR:NOT_IN_PROGRESS");
    } else if (otaWrittenBytes != otaExpectedSize) {
      Update.abort();
      otaInProgress = false;
      sendConfigNotification("OTA_ERR:INCOMPLETE");
    } else if (!otaVerifier.verify()) {
      Update.abort();
      otaInProgress = false;
      sendConfigNotification("OTA_ERR:SIGNATURE_INVALID");
    } else if (!Update.end(true)) {
      otaInProgress = false;
      sendConfigNotification("OTA_ERR:UPDATE_END_FAILED");
    } else {
      otaInProgress = false;
      sendConfigNotification("OTA_OK");
#ifdef ARDUINO
      delay(200);
      ESP.restart();
#endif
    }
  } else if (cmd == "OTA_ABORT") {
    if (otaInProgress) {
      Update.abort();
      otaInProgress = false;
    }
    sendConfigNotification("OTA_ABORTED");
  } else if (cmd.startsWith("SET_KEY ")) {
    int l, r, c, val, hold, dtap;
    if (parseKeyCommand(cmd, "SET_KEY %d %d %d %d %d %d %c", l, r, c, val, hold, dtap)) {
      KEYMAP[l][r][c] = (uint16_t)val;
      HOLDMAP[l][r][c] = (uint16_t)hold;
      DTAPMAP[l][r][c] = (uint16_t)dtap;
      if (saveKeymapToNVS()) {
        sendConfigNotification("OK SET_KEY " + String(l) + " " + String(r) + " " + String(c) + " " + String(val) + " " + String(hold) + " " + String(dtap));
      } else {
        sendConfigNotification("ERR NVS SET_KEY");
      }
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_K ")) {
    // Schnelles RAM-Update für Batch-Sync (NVS wird am Ende einmalig mit SAVE_NVS geschrieben)
    int l, r, c, val, hold, dtap;
    if (parseKeyCommand(cmd, "SET_K %d %d %d %d %d %d %c", l, r, c, val, hold, dtap)) {
      KEYMAP[l][r][c] = (uint16_t)val;
      HOLDMAP[l][r][c] = (uint16_t)hold;
      DTAPMAP[l][r][c] = (uint16_t)dtap;
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd == "CLEAR_TAP_TERMS") {
    // RAM: alle eigenen Tapping-Terme löschen (der volle Sync sendet danach SET_KT je Taste, SAVE_NVS speichert)
    memset(TAPTERMMAP, 0, sizeof(TAPTERMMAP));
    sendConfigNotification("OK CLEAR_TAP_TERMS");
  } else if (cmd.startsWith("SET_KT ")) {
    // "SET_KT <l> <r> <c> <ms>": eigener Tapping-Term einer Taste (RAM, wie SET_K ohne OK; 0 = Wert der Hälfte,
    // sonst 100..500). SAVE_NVS schreibt ihn.
    int l, r, c, ms;
    char extra;
    if (sscanf(cmd.c_str(), "SET_KT %d %d %d %d %c", &l, &r, &c, &ms, &extra) == 4 &&
        l >= 0 && l < NUM_LAYERS && r >= 0 && r < NUM_ROWS && c >= 0 && c < NUM_COLS && isValidKeyTapTerm(ms)) {
      TAPTERMMAP[l][r][c] = (uint16_t)ms;  // wie SET_K: keine Bestätigung, nur ERR
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd == "SAVE_NVS") {
    sendConfigNotification(saveKeymapToNVS() ? "OK SAVE_NVS" : "ERR NVS SAVE_NVS");
  } else if (cmd.startsWith("SET_NAME ")) {
    int spaceIdx = cmd.indexOf(' ', 9);
    int l = cmd.substring(9, spaceIdx > 0 ? spaceIdx : 10).toInt();
    String name = sanitizeConfigName(spaceIdx > 0 ? cmd.substring(spaceIdx + 1) : "");
    if (l >= 0 && l < NUM_LAYERS && name.length() > 0) {
      if (saveLayerNameToNVS(l, name)) {
        sendConfigNotification("OK SET_NAME " + String(l) + " " + name);
      } else {
        // Layer-Index mitsenden: die App wartet auf "SET_NAME <l>" (OK und ERR)
        sendConfigNotification("ERR NVS SET_NAME " + String(l));
      }
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_STANDBY ")) {
    int t = cmd.substring(12).toInt();
    if (t >= 0 && t <= 120) {
      sendConfigNotification(saveStandbyTimeoutToNVS((uint32_t)t) ? "OK SET_STANDBY " + String(t) : String("ERR NVS SET_STANDBY"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_SLEEP ")) {
    int t = cmd.substring(10).toInt();
    if (t >= 0 && t <= 240) {
      sendConfigNotification(saveSleepTimeoutToNVS((uint32_t)t) ? "OK SET_SLEEP " + String(t) : String("ERR NVS SET_SLEEP"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_DEV_NAME ")) {
    String name = sanitizeConfigName(cmd.substring(13));
    if (name.length() > 0) {
      sendConfigNotification(saveDeviceNameToNVS(name) ? "OK SET_DEV_NAME " + name : String("ERR NVS SET_DEV_NAME"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_DEBOUNCE ")) {
    int d = cmd.substring(13).toInt();
    if (d >= 1 && d <= 50) {
      sendConfigNotification(saveDebounceToNVS((uint8_t)d) ? "OK SET_DEBOUNCE " + String(d) : String("ERR NVS SET_DEBOUNCE"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_COMBO_TIMEOUT ")) {
    int ct = cmd.substring(18).toInt();
    if (ct >= 10 && ct <= 200) {
      sendConfigNotification(saveComboTimeoutToNVS((uint16_t)ct) ? "OK SET_COMBO_TIMEOUT " + String(ct) : String("ERR NVS SET_COMBO_TIMEOUT"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_TAPPING_TERM ")) {
    int tt = cmd.substring(17).toInt();
    if (tt >= TAPPING_TERM_MIN_MS && tt <= TAPPING_TERM_MAX_MS) {
      sendConfigNotification(saveTappingTermToNVS((uint16_t)tt) ? "OK SET_TAPPING_TERM " + String(tt) : String("ERR NVS SET_TAPPING_TERM"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_TRI_LAYER ")) {
    // "SET_TRI_LAYER -" löscht alle Regeln; sonst ein oder zwei Regeln "a b target" (Ebenen 1..7)
    String arg = cmd.substring(14);
    arg.trim();
    uint8_t rules[TRI_LAYER_MAX_RULES * TRI_LAYER_RULE_BYTES];
    int count = 0;
    bool valid = true;
    if (arg != "-") {
      int vals[TRI_LAYER_MAX_RULES * TRI_LAYER_RULE_BYTES + 1];
      int nv = 0;
      int pos = 0;
      while (valid && pos < (int)arg.length()) {
        while (pos < (int)arg.length() && arg.charAt(pos) == ' ') pos++;
        if (pos >= (int)arg.length()) break;
        int end = pos;
        while (end < (int)arg.length() && arg.charAt(end) != ' ') end++;
        String tok = arg.substring(pos, end);
        if (nv >= TRI_LAYER_MAX_RULES * TRI_LAYER_RULE_BYTES || tok.length() != 1 || tok.charAt(0) < '0' || tok.charAt(0) > '9') {
          valid = false;
        } else {
          vals[nv++] = tok.charAt(0) - '0';
        }
        pos = end;
      }
      if (nv == 0 || nv % TRI_LAYER_RULE_BYTES != 0) valid = false;
      for (int i = 0; valid && i + 2 < nv; i += 3) {
        if (!isValidTriLayerRule(vals[i], vals[i + 1], vals[i + 2])) valid = false;
        rules[count * 3] = (uint8_t)vals[i];
        rules[count * 3 + 1] = (uint8_t)vals[i + 1];
        rules[count * 3 + 2] = (uint8_t)vals[i + 2];
        count++;
      }
    }
    if (valid) {
      sendConfigNotification(saveTriLayerToNVS(rules, (uint8_t)count) ? "OK SET_TRI_LAYER " + String(count) : String("ERR NVS SET_TRI_LAYER"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_CHORDAL_HOLD ")) {
    String arg = cmd.substring(17);
    arg.trim();
    if (arg == "0" || arg == "1") {
      sendConfigNotification(saveChordalHoldToNVS(arg == "1" ? 1 : 0) ? "OK SET_CHORDAL_HOLD " + arg : String("ERR NVS SET_CHORDAL_HOLD"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_RETRO_TAP ")) {
    String arg = cmd.substring(14);
    arg.trim();
    if (arg == "0" || arg == "1") {
      sendConfigNotification(saveRetroTapToNVS(arg == "1" ? 1 : 0) ? "OK SET_RETRO_TAP " + arg : String("ERR NVS SET_RETRO_TAP"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_NUM_WORD_LAYER ")) {
    String arg = cmd.substring(19);
    arg.trim();
    if (arg.length() == 1 && arg.charAt(0) >= '0' && arg.charAt(0) <= '7') {
      sendConfigNotification(saveNumWordLayerToNVS((uint8_t)(arg.charAt(0) - '0')) ? "OK SET_NUM_WORD_LAYER " + arg : String("ERR NVS SET_NUM_WORD_LAYER"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_AUTO_SHIFT ")) {
    String arg = cmd.substring(15);
    arg.trim();
    if (arg.length() == 1 && arg.charAt(0) >= '0' && arg.charAt(0) <= '0' + AUTO_SHIFT_MAX_MODE) {
      sendConfigNotification(saveAutoShiftToNVS((uint8_t)(arg.charAt(0) - '0')) ? "OK SET_AUTO_SHIFT " + arg : String("ERR NVS SET_AUTO_SHIFT"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_AUTO_SHIFT_TERM ")) {
    String arg = cmd.substring(20);
    arg.trim();
    bool digits = arg.length() > 0 && arg.length() <= 3;
    for (unsigned i = 0; digits && i < arg.length(); i++) digits = arg.charAt(i) >= '0' && arg.charAt(i) <= '9';
    int am = digits ? arg.toInt() : -1;
    if (digits && am >= AUTO_SHIFT_MIN_MS && am <= AUTO_SHIFT_MAX_MS) {
      sendConfigNotification(saveAutoShiftMsToNVS((uint16_t)am) ? "OK SET_AUTO_SHIFT_TERM " + String(am) : String("ERR NVS SET_AUTO_SHIFT_TERM"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_QUICK_TAP ")) {
    int qt = cmd.substring(14).toInt();
    String arg = cmd.substring(14);
    arg.trim();
    bool digits = arg.length() > 0 && arg.length() <= 3;
    for (unsigned i = 0; digits && i < arg.length(); i++) digits = arg.charAt(i) >= '0' && arg.charAt(i) <= '9';
    if (digits && qt >= 0 && qt <= QUICK_TAP_MAX_MS) {
      sendConfigNotification(saveQuickTapToNVS((uint16_t)qt) ? "OK SET_QUICK_TAP " + String(qt) : String("ERR NVS SET_QUICK_TAP"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_PRIOR_IDLE ")) {
    int pi = cmd.substring(15).toInt();
    String arg = cmd.substring(15);
    arg.trim();
    bool digits = arg.length() > 0 && arg.length() <= 3;
    for (unsigned i = 0; digits && i < arg.length(); i++) digits = arg.charAt(i) >= '0' && arg.charAt(i) <= '9';
    if (digits && pi >= 0 && pi <= PRIOR_IDLE_MAX_MS) {
      sendConfigNotification(saveRequirePriorIdleToNVS((uint16_t)pi) ? "OK SET_PRIOR_IDLE " + String(pi) : String("ERR NVS SET_PRIOR_IDLE"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
#ifdef DEVICE_INFO_HOST_LEDS_BITS
  } else if (cmd.startsWith("SET_CAPS_LED ")) {
    String arg = cmd.substring(13);
    arg.trim();
    if (arg == "0" || arg == "1") {
      sendConfigNotification(saveCapsLedToNVS(arg == "1" ? 1 : 0) ? "OK SET_CAPS_LED " + arg : String("ERR NVS SET_CAPS_LED"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
#endif
  } else if (cmd.startsWith("SET_HOLD_MODE ")) {
    int hm = cmd.substring(14).toInt();
    if (hm >= 0 && hm <= 2) {
      sendConfigNotification(saveHoldTapModeToNVS((uint8_t)hm) ? "OK SET_HOLD_MODE " + String(hm) : String("ERR NVS SET_HOLD_MODE"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd == "CLEAR_COMBOS") {
    numCombos = 0;
    sendConfigNotification("OK CLEAR_COMBOS");
  } else if (cmd.startsWith("ADD_COMBO ")) {
    int r1, c1, r2, c2, beh, act;
    int mask = COMBO_ALL_LAYERS;
    int r3 = COMBO_NO_KEY, c3 = COMBO_NO_KEY, windowMs = 0;
    // Sechs Werte sind Pflicht. Danach folgen optional: Ebenenmaske (1..255), dritte Taste (r3 c3, beide 255 = keine)
    // und Fenster in ms (0 oder COMBO_WINDOW_MIN..COMBO_WINDOW_MAX, 0 = comboTimeoutMs). Erlaubt sind 0, 1, 3 oder 4 Zusatzwerte; ohne Maske
    // gilt die Combo auf allen Ebenen. Jeder weitere oder nicht numerische Rest ist ein Fehler.
    int consumed = -1;
    bool parsed = sscanf(cmd.c_str(), "ADD_COMBO %d %d %d %d %d %d%n", &r1, &c1, &r2, &c2, &beh, &act, &consumed) == 6 &&
                  consumed > 0;
    if (parsed) {
      long extra[4];
      int nExtra = 0;
      const char *rest = cmd.c_str() + consumed;
      while (parsed) {
        while (*rest == ' ') rest++;
        if (*rest == '\0') break;
        char *end = nullptr;
        long v = strtol(rest, &end, 10);
        parsed = end != rest && end && (*end == ' ' || *end == '\0') && nExtra < 4 && v >= 0 && v <= 0xFFFF;
        if (!parsed) break;
        extra[nExtra++] = v;
        rest = end;
      }
      parsed = parsed && (nExtra <= 1 || nExtra >= 3);
      if (parsed && nExtra >= 1) {
        parsed = extra[0] >= 1 && extra[0] <= 0xFF;
        mask = (int)extra[0];
      }
      if (parsed && nExtra >= 3) {
        r3 = (int)extra[1];
        c3 = (int)extra[2];
        bool none = r3 == COMBO_NO_KEY && c3 == COMBO_NO_KEY;
        bool inMatrix = r3 < NUM_ROWS && c3 < NUM_COLS;
        parsed = none || (inMatrix && !(r3 == r1 && c3 == c1) && !(r3 == r2 && c3 == c2));
      }
      if (parsed && nExtra == 4) {
        windowMs = (int)extra[3];
        parsed = windowMs == 0 || (windowMs >= COMBO_WINDOW_MIN && windowMs <= COMBO_WINDOW_MAX);
      }
    }
    if (parsed &&
        mask >= 1 && mask <= 0xFF &&
        numCombos < MAX_COMBOS && r1 >= 0 && r1 < NUM_ROWS && c1 >= 0 && c1 < NUM_COLS &&
        r2 >= 0 && r2 < NUM_ROWS && c2 >= 0 && c2 < NUM_COLS &&
        beh >= 0 && beh <= 2 && act >= 0 && act <= 0xFFFF && !isMacroAction((uint16_t)act) && !isDynamicMacroAction((uint16_t)act) &&
        !isMouseMoveAction((uint16_t)act) && !isOslAction((uint16_t)act) && act != ACT_LEADER && act != ACT_KEY_LOCK && act != ACT_SWAP_HANDS && act != ACT_NUM_WORD && !isBleHostAction((uint16_t)act) &&
        !(beh != 0 && (isRepeatKeyAction((uint16_t)act) || act == ACT_LAYER_LOCK))) {
      userCombos[numCombos].r1 = (uint8_t)r1;
      userCombos[numCombos].c1 = (uint8_t)c1;
      userCombos[numCombos].r2 = (uint8_t)r2;
      userCombos[numCombos].c2 = (uint8_t)c2;
      userCombos[numCombos].behavior = (uint8_t)beh;
      userCombos[numCombos].action = (uint16_t)act;
      userCombos[numCombos].layerMask = (uint8_t)mask;
      userCombos[numCombos].r3 = (uint8_t)r3;
      userCombos[numCombos].c3 = (uint8_t)c3;
      userCombos[numCombos].windowMs = (uint16_t)windowMs;
      comboRuntime[numCombos].active = false;
      comboRuntime[numCombos].lastReleaseTime = 0;
      numCombos++;
      sendConfigNotification("OK ADD_COMBO " + String(numCombos - 1));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd == "SAVE_COMBOS") {
    sendConfigNotification(saveCombosToNVS() ? "OK SAVE_COMBOS" : "ERR NVS SAVE_COMBOS");
  } else if (cmd == "CLEAR_PAIRS") {
    releaseHeldKeyPairs();
    numKeyPairs = 0;
    sendConfigNotification("OK CLEAR_PAIRS");
  } else if (cmd.startsWith("ADD_PAIR ")) {
    // ADD_PAIR <erste> <zweite>: Tastatur- oder HID-Codes (1..255, Media 0x120..0x12B, Maus 0x130..0x134, Pan 0x139..0x13A)
    int first, second;
    char extra;
    if (sscanf(cmd.c_str(), "ADD_PAIR %d %d %c", &first, &second, &extra) == 2 &&
        numKeyPairs < MAX_KEY_PAIRS && isValidKeyPairMemberCode((uint16_t)first) && isValidKeyPairMemberCode((uint16_t)second)) {
      userKeyPairs[numKeyPairs].first = (uint16_t)first;
      userKeyPairs[numKeyPairs].second = (uint16_t)second;
      numKeyPairs++;
      sendConfigNotification("OK ADD_PAIR " + String(numKeyPairs - 1));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd == "SAVE_PAIRS") {
    sendConfigNotification(saveKeyPairsToNVS() ? "OK SAVE_PAIRS" : "ERR NVS SAVE_PAIRS");
#ifdef DACTYL_KEY_OVERRIDES
  } else if (cmd == "CLEAR_OVERRIDES") {
    numKeyOverrides = 0;
    sendConfigNotification("OK CLEAR_OVERRIDES");
  } else if (cmd.startsWith("ADD_OVERRIDE ")) {
    // ADD_OVERRIDE <Modifier-Klassen 1..15> <Taste> <Ersatz> [<Ebenenmaske 1..255>]: Tasten 1..255, keine Modifier; wird als nächster Index angehängt
    int mods, key, repl;
    char extra;
    int mask = KEY_OVERRIDE_ALL_LAYERS;
    int parsed = sscanf(cmd.c_str(), "ADD_OVERRIDE %d %d %d %d %c", &mods, &key, &repl, &mask, &extra);
    if ((parsed == 3 || parsed == 4) && numKeyOverrides < MAX_KEY_OVERRIDES && keyOverrideValid(mods, key, repl, mask)) {
      userKeyOverrides[numKeyOverrides].mods = (uint8_t)mods;
      userKeyOverrides[numKeyOverrides].key = (uint8_t)key;
      userKeyOverrides[numKeyOverrides].replacement = (uint8_t)repl;
      userKeyOverrides[numKeyOverrides].layerMask = (uint8_t)mask;
      numKeyOverrides++;
      sendConfigNotification("OK ADD_OVERRIDE " + String(numKeyOverrides - 1));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd == "SAVE_OVERRIDES") {
    sendConfigNotification(saveKeyOverridesToNVS() ? "OK SAVE_OVERRIDES" : "ERR NVS SAVE_OVERRIDES");
#endif
  } else if (cmd == "CLEAR_ALT_REPEATS") {
    numAltRepeats = 0;
    sendConfigNotification("OK CLEAR_ALT_REPEATS");
  } else if (cmd.startsWith("ADD_ALT_REPEAT ")) {
    // ADD_ALT_REPEAT <Taste> <Alt>: Tastaturcodes 1..255, Taste != Alt; gerichtet; derselbe Auslöser nur einmal (der erste Eintrag gilt)
    int key, alt;
    char extra;
    if (sscanf(cmd.c_str(), "ADD_ALT_REPEAT %d %d %c", &key, &alt, &extra) == 2 && numAltRepeats < MAX_ALT_REPEATS &&
        key >= 1 && key <= 255 && alt >= 1 && alt <= 255 && key != alt && altRepeatCustom(userAltRepeats, numAltRepeats, (uint16_t)key) == 0) {
      userAltRepeats[numAltRepeats].key = (uint8_t)key;
      userAltRepeats[numAltRepeats].alt = (uint8_t)alt;
      numAltRepeats++;
      sendConfigNotification("OK ADD_ALT_REPEAT " + String(numAltRepeats - 1));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd == "SAVE_ALT_REPEATS") {
    sendConfigNotification(saveAltRepeatsToNVS() ? "OK SAVE_ALT_REPEATS" : "ERR NVS SAVE_ALT_REPEATS");
  } else if (cmd == "CLEAR_LEADER") {
    leaderReset();
    numLeaderSeqs = 0;
    sendConfigNotification("OK CLEAR_LEADER");
  } else if (cmd.startsWith("ADD_LEADER ")) {
    // ADD_LEADER <Aktion> <Taste1> [<Taste2> [<Taste3> [<Taste4>]]>]: Tasten 1..255 ohne Modifier; Aktion Taste, PAIR_n oder MACRO_n.
    // Zwei Folgen mit denselben Tasten sind ungültig; wird als nächster Index angehängt.
    // Strenger Parser: jedes Token ist eine Dezimalzahl bis 5 Stellen, sonst ungültig (sscanf übersieht nachgestellten Text)
    int v[1 + LEADER_MAX_KEYS];
    int n = 0;
    bool ok = true;
    {
      const char *p = cmd.c_str() + 11;
      while (ok && *p) {
        if (*p == ' ') { p++; continue; }
        int digits = 0, val = 0;
        while (*p >= '0' && *p <= '9' && digits < 6) { val = val * 10 + (*p - '0'); p++; digits++; }
        if (digits == 0 || digits > 5 || (*p != 0 && *p != ' ') || n >= 1 + LEADER_MAX_KEYS) ok = false;
        else v[n++] = val;
      }
    }
    LeaderSeq seq = { { 0, 0, 0, 0 }, 0 };
    ok = ok && n >= 2 && numLeaderSeqs < MAX_LEADER_SEQS && leaderActionValid(v[0]);
    for (int i = 1; ok && i < n; i++) {
      if (!leaderKeyCodeValid(v[i])) ok = false;
      else seq.keys[i - 1] = (uint8_t)v[i];
    }
    if (ok && leaderFindExact(userLeaderSeqs, numLeaderSeqs, seq.keys, (uint8_t)(n - 1)) >= 0) ok = false;
    if (ok) {
      seq.action = (uint16_t)v[0];
      userLeaderSeqs[numLeaderSeqs++] = seq;
      sendConfigNotification("OK ADD_LEADER " + String(numLeaderSeqs - 1));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd == "SAVE_LEADER") {
    sendConfigNotification(saveLeaderSeqsToNVS() ? "OK SAVE_LEADER" : "ERR NVS SAVE_LEADER");
  } else if (cmd.startsWith("SET_LEADER_TIMEOUT ")) {
    int lt = cmd.substring(19).toInt();
    String arg = cmd.substring(19);
    arg.trim();
    bool digits = arg.length() > 0 && arg.length() <= 4;
    for (unsigned i = 0; digits && i < arg.length(); i++) digits = arg.charAt(i) >= '0' && arg.charAt(i) <= '9';
    if (digits && lt >= LEADER_TIMEOUT_MIN_MS && lt <= LEADER_TIMEOUT_MAX_MS) {
      sendConfigNotification(saveLeaderTimeoutToNVS((uint16_t)lt) ? "OK SET_LEADER_TIMEOUT " + String(lt) : String("ERR NVS SET_LEADER_TIMEOUT"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_ONESHOT_TIMEOUT ")) {
    int ot = cmd.substring(20).toInt();
    String arg = cmd.substring(20);
    arg.trim();
    bool digits = arg.length() > 0 && arg.length() <= 5;
    for (unsigned i = 0; digits && i < arg.length(); i++) digits = arg.charAt(i) >= '0' && arg.charAt(i) <= '9';
    if (digits && (ot == 0 || (ot >= ONE_SHOT_TIMEOUT_MIN_MS && ot <= ONE_SHOT_TIMEOUT_MAX_MS))) {
      sendConfigNotification(saveOneShotTimeoutToNVS((uint16_t)ot) ? "OK SET_ONESHOT_TIMEOUT " + String(ot) : String("ERR NVS SET_ONESHOT_TIMEOUT"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_LAYER_TIMEOUT ")) {
    int lt = cmd.substring(18).toInt();
    String arg = cmd.substring(18);
    arg.trim();
    bool digits = arg.length() > 0 && arg.length() <= 5;
    for (unsigned i = 0; digits && i < arg.length(); i++) digits = arg.charAt(i) >= '0' && arg.charAt(i) <= '9';
    if (digits && (lt == 0 || (lt >= LAYER_TIMEOUT_MIN_MS && lt <= LAYER_TIMEOUT_MAX_MS))) {
      sendConfigNotification(saveLayerTimeoutToNVS((uint16_t)lt) ? "OK SET_LAYER_TIMEOUT " + String(lt) : String("ERR NVS SET_LAYER_TIMEOUT"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd == "CLEAR_MACROS") {
    stopMacro(true);
    numMacros = 0;
    for (int i = 0; i < MAX_MACROS; i++) { macroLengths[i] = 0; userMacroRepeat[i] = false; }
    sendConfigNotification("OK CLEAR_MACROS");
  } else if (cmd == "ADD_MACRO" || cmd.startsWith("ADD_MACRO ")) {
    // ADD_MACRO [0|1] hängt ein leeres Makro an (1 = wiederholen, solange die Taste gehalten wird);
    // ADD_MACRO_STEP füllt es. Ein laufendes Makro endet: die Liste ändert sich.
    // Genau ein Zeichen als Argument: kein Parser mit Überlauf bei langen Zahlen
    bool argsOk = cmd == "ADD_MACRO" || cmd == "ADD_MACRO 0" || cmd == "ADD_MACRO 1";
    int rep = cmd == "ADD_MACRO 1" ? 1 : 0;
    if (argsOk && numMacros < MAX_MACROS) {
      stopMacro(true);
      macroLengths[numMacros] = 0;
      userMacroRepeat[numMacros] = rep == 1;
      numMacros++;
      sendConfigNotification("OK ADD_MACRO " + String(numMacros - 1));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("ADD_MACRO_STEP ")) {
    // ADD_MACRO_STEP <typ> <code> <ms> an das letzte Makro: ein Schritt pro Befehl (Zeilen max. 256 Zeichen)
    int type, code, ms;
    char extra;
    uint8_t idx = numMacros > 0 ? numMacros - 1 : 0;
    if (sscanf(cmd.c_str(), "ADD_MACRO_STEP %d %d %d %c", &type, &code, &ms, &extra) == 3 &&
        numMacros > 0 && macroLengths[idx] < MAX_MACRO_STEPS && isValidMacroStep(type, code, ms)) {
      // Ein laufendes Makro endet, bevor sich seine Schritte ändern
      stopMacro(true);
      userMacros[idx][macroLengths[idx]] = { (uint8_t)type, (uint8_t)code, (uint16_t)ms };
      macroLengths[idx]++;
      sendConfigNotification("OK ADD_MACRO_STEP " + String(idx) + " " + String(macroLengths[idx] - 1));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd == "SAVE_MACROS") {
    sendConfigNotification(saveMacrosToNVS() ? "OK SAVE_MACROS" : "ERR NVS SAVE_MACROS");
  } else if (cmd == "GET_NAMES" || cmd == "GET_CONFIG") {
    String out = "LAYER_NAMES:[";
    for (int i = 0; i < NUM_LAYERS; i++) {
      out += "\"" + layerNames[i] + "\"";
      if (i < NUM_LAYERS - 1) out += ",";
    }
    out += "]";
    sendConfigNotification(out);

    if (cmd == "GET_CONFIG") {
      for (int l = 0; l < NUM_LAYERS; l++) {
        sendMatrixData("LAYER_DATA:", KEYMAP, l);
        sendMatrixData("HOLD_DATA:", HOLDMAP, l);
        sendMatrixData("DTAP_DATA:", DTAPMAP, l);
        // Eigene Tapping-Terme je Taste in ms (0 = Wert der Hälfte); Firmware davor sendet keine TERM_DATA-Zeile
        sendMatrixData("TERM_DATA:", TAPTERMMAP, l);
      }
      sendCombosPairsMacros();
      sendConfigNotification("CONFIG_SYNC_DONE", true);
    }
  } else if (cmd == "GET_INFO") {
    dynamicMacroResend();
    uint8_t m[6];
    esp_read_mac(m, ESP_MAC_BT);
    // Tri-Layer-Regeln als Liste [[a,b,target],...]
    char triJson[48] = "[";
    {
      size_t tn = 1;
      for (int i = 0; i < numTriLayers && i < TRI_LAYER_MAX_RULES; i++) {
        tn += snprintf(triJson + tn, sizeof(triJson) - tn, "%s[%u,%u,%u]", i ? "," : "", (unsigned)triLayerRules[i * 3], (unsigned)triLayerRules[i * 3 + 1], (unsigned)triLayerRules[i * 3 + 2]);
      }
      snprintf(triJson + tn, sizeof(triJson) - tn, "]");
    }
    // Nur der Master hat einen Host: LED-Zustand ("host_leds") und Setting der Onboard-LED ("caps_led")
    char hostJson[96] = "";
#ifdef DEVICE_INFO_HOST_LEDS_BITS
    // Im Tastaturmodus liest ein naher BLE-Client nur GET_INFO: den Zustand der Host-LEDs nicht preisgeben
    if (!fromBle || isConfigMode) {
      size_t hn = (size_t)snprintf(hostJson, sizeof(hostJson), ",\"host_leds\":");
      hn += (size_t)hostLedsJson(hostJson + hn, sizeof(hostJson) - hn, (uint8_t)DEVICE_INFO_HOST_LEDS_BITS());
      snprintf(hostJson + hn, sizeof(hostJson) - hn, ",\"caps_led\":%u", (unsigned)capsLedEnabled);
    }
#endif
#ifdef DACTYL_BLE_HOST
    // Eigene Zeile vor DEVICE_INFO: die Zeile hat nur wenige Bytes Reserve unter dem BLE-Attributlimit (512)
    sendConfigNotification("BLE_HOST:" + String((int)bleHostSlot));
#endif
    char buf[768];
    int n = snprintf(buf, sizeof(buf), "DEVICE_INFO:{\"name\":\"%s\",\"side\":\"" DEVICE_SIDE "\",\"fw\":%u,\"mac\":\"%02X:%02X:%02X:%02X:%02X:%02X\",\"standby_timeout\":%u,\"sleep_timeout\":%u,\"debounce_ms\":%u,\"combo_timeout_ms\":%u,\"tapping_term_ms\":%u,\"hold_tap_mode\":%u,\"quick_tap_ms\":%u,\"pi\":%u,\"chordal_hold\":%u,\"rt\":%u,\"nwl\":%u,\"as\":%u,\"at\":%u,\"ld\":%u,\"ot\":%u,\"lt\":%u,\"tri_layer\":%s%s,\"config_mode\":%s",
      isConfigMode ? CONFIG_BLE_NAME : deviceName.c_str(), (unsigned)DACTYL_FW_VERSION,
      m[0], m[1], m[2], m[3], m[4], m[5],
      (unsigned)standbyTimeoutMinutes, (unsigned)deepSleepTimeoutMinutes,
      (unsigned)debounceMs, (unsigned)comboTimeoutMs, (unsigned)tappingTermMs,
      (unsigned)holdTapMode, (unsigned)quickTapMs, (unsigned)requirePriorIdleMs, (unsigned)chordalHold, (unsigned)retroTap, (unsigned)numWordLayer, (unsigned)autoShift, (unsigned)autoShiftMs, (unsigned)leaderTimeoutMs, (unsigned)oneShotTimeoutMs, (unsigned)layerTimeoutMs, triJson, hostJson,
      isConfigMode ? "true" : "false");
    if (n < 0 || n >= (int)sizeof(buf)) n = (int)sizeof(buf) - 1;
#ifdef DEVICE_INFO_LEFT_FW
    n += snprintf(buf + n, sizeof(buf) - n, ",\"left_fw\":%ld", (long)DEVICE_INFO_LEFT_FW());
    if (n >= (int)sizeof(buf)) n = (int)sizeof(buf) - 1;
#endif
#ifdef DEVICE_INFO_LEFT_LINK
    n += snprintf(buf + n, sizeof(buf) - n, ",\"left_link\":");
    if (n >= (int)sizeof(buf)) n = (int)sizeof(buf) - 1;
    n += DEVICE_INFO_LEFT_LINK(buf + n, sizeof(buf) - n);
    if (n >= (int)sizeof(buf)) n = (int)sizeof(buf) - 1;
#endif
    snprintf(buf + n, sizeof(buf) - n, "}");
    sendConfigNotification(String(buf));
  } else if (cmd == "GET_DIAG") {
    // Über BLE im Tastaturmodus schon oben abgelehnt; hier: USB-Serial und Config-Modus
    sendConfigNotification(buildDiagLine((esp_reset_reason_t)diagBootReason, (uint32_t)(esp_timer_get_time() / 1000000LL),
      (uint32_t)ESP.getFreeHeap(), (uint32_t)ESP.getMinFreeHeap(), diagLoopMaxUs
#ifdef DIAG_SEND_QUEUE_MAX
      , true, (uint32_t)DIAG_SEND_QUEUE_MAX(), (uint32_t)DIAG_SEND_QUEUE_DROPPED()
#endif
      ));
  } else if (cmd == "RESET_CONFIG") {
    bool ok = preferences.begin("dactyl", false) && preferences.clear();
    preferences.end();
    sendConfigNotification(ok ? "OK RESET_CONFIG" : "ERR NVS RESET_CONFIG");
  } else if (cmd == "ENTER_CONFIG") {
    sendConfigNotification("OK ENTER_CONFIG");
    enterConfigRequested = true;
  } else if (cmd == "EXIT_CONFIG") {
    sendConfigNotification("OK EXIT_CONFIG");
    exitConfigRequested = true;
  } else {
    sendConfigNotification("ERR UNKNOWN " + cmd);
  }

  if (mutexTaken) xSemaphoreGive(configMutex);
}

// -----------------------------------------------------------------------------
// Benutzerdefinierte Combos / Chords
// -----------------------------------------------------------------------------
bool wasComboRecentlyActive(uint8_t r, uint8_t c) {
  unsigned long now = millis();
  for (uint8_t i = 0; i < numCombos; i++) {
    if (comboContainsKey(i, r, c)) {
      if (comboRuntime[i].active) return true;
      if (comboRuntime[i].lastReleaseTime > 0 && ((unsigned long)(now - comboRuntime[i].lastReleaseTime) < 300)) {
        // Nur unterdrücken, wenn der Tastendruck VOR oder WÄHREND des Chords gestartet wurde.
        // Ein NEUER Tastendruck nach dem Chord ist legitim und wird nicht blockiert!
        // Vorzeichenbehafteter Cast für sichere Rollover-Differenz:
        if ((long)(keyPressTime[r][c] - comboRuntime[i].lastReleaseTime) <= 0) {
          return true;
        }
      }
    }
  }
  return false;
}

// Ein Combo-Kandidat wird gepuffert. Das gilt nur, wenn eine Combo mit der Taste auf der Ebene des Drucks gilt:
// eine Taste außerhalb der Ebenenmaske sendet sofort, ohne Combo-Verzögerung.
bool isComboCandidateKey(uint8_t r, uint8_t c) {
  uint8_t layer = comboLayerForKey(r, c);
  for (uint8_t i = 0; i < numCombos; i++) {
    if (comboContainsKey(i, r, c)) {
      if (comboAppliesOnLayer(i, layer)) return true;
    }
  }
  return false;
}

void checkUserCombos() {
  unsigned long now = millis();
  for (uint8_t i = 0; i < numCombos; i++) {
    uint8_t r1 = userCombos[i].r1;
    uint8_t c1 = userCombos[i].c1;
    uint8_t r2 = userCombos[i].r2;
    uint8_t c2 = userCombos[i].c2;

    bool bothPressed = comboAllPressed(i);
    if (bothPressed && !comboRuntime[i].active && !leaderConsumed[r1][c1] && !leaderConsumed[r2][c2] &&
        !(comboHasThirdKey(i) && leaderConsumed[userCombos[i].r3][userCombos[i].c3])) {
      // Alle Tasten müssen innerhalb des Fensters der Combo (windowMs oder comboTimeoutMs) gedrückt worden sein!
      // Wenn eine Taste schon lange gehalten wurde und man dann schnell tippt, ist es KEINE Combo!
      bool inWindow = comboKeysInWindow(i);
      // Alle Tasten müssen auf einer Ebene der Maske gedrückt worden sein: nur dann wurden sie gepuffert
      bool onMaskLayers = comboOnMaskLayers(i);

      if (inWindow && onMaskLayers) {
        comboRuntime[i].active = true;
        // Die Combo verbraucht beide Tasten: deren Mod-Tap-Entscheidung darf nicht mehr greifen
        cancelTapHoldForCombo(r1, c1);
        cancelTapHoldForCombo(r2, c2);
        if (comboHasThirdKey(i)) cancelTapHoldForCombo(userCombos[i].r3, userCombos[i].c3);
        // Beide Tasten als an Host gesendet markieren, damit lingernde Tasten nach dem Chord
        // nicht nach Ablauf der 300ms Grace Period versehentlich als Einzeltaste nachfeuern!
        keySentToHost[r1][c1] = true;
        keySentToHost[r2][c2] = true;
        mouseMoveStop(r1, c1);
        mouseMoveStop(r2, c2);
        wheelHoldStop(r1, c1);
        wheelHoldStop(r2, c2);
        if (comboHasThirdKey(i)) {
          keySentToHost[userCombos[i].r3][userCombos[i].c3] = true;
          mouseMoveStop(userCombos[i].r3, userCombos[i].c3);
          wheelHoldStop(userCombos[i].r3, userCombos[i].c3);
        }

        // Sofort Einzeltasten auf Mac loslassen, damit der Combo-Chord die Einzeltasten überschreibt.
        // releaseAll() löst auch die Codes eines laufenden Makros; das Makro endet hier.
        stopMacro(false);
        if (!isConfigMode && bleKeyboard.isConnected()) {
          bleKeyboard.releaseAll();
        }
        uint16_t act = userCombos[i].action;
        if (userCombos[i].behavior != 2) recordRepeatAction(act);
        if (userCombos[i].behavior == 0 && act == ACT_LAYER_LOCK) { // KEY_PRESS: Layer lock braucht keinen Host
          applyLayerLock();
          sendConfigNotification("COMBO_TRIGGER:{\"idx\":" + String(i) + ",\"act\":" + String(act) + "}");
        } else if (userCombos[i].behavior == 0) { // KEY_PRESS
          if (!isConfigMode && bleKeyboard.isConnected()) {
            if (isMediaAction(act)) {
              if (act == ACT_MAC_GLOBE) { bleKeyboard.press(KEY_MEDIA_GLOBE); delay(10); bleKeyboard.release(KEY_MEDIA_GLOBE); }
              else bleKeyboard.write(mediaKeyForAction(act));
            } else if (isMouseKeyAction(act)) {
              if (act == 0x130) bleKeyboard.mouseClick(MOUSE_BUTTON_LEFT);
              else if (act == 0x131) bleKeyboard.mouseClick(MOUSE_BUTTON_RIGHT);
              else if (act == 0x132) bleKeyboard.mouseClick(MOUSE_BUTTON_MIDDLE);
              else wheelSend(act, 1);
            } else if (isUmlautAction(act)) {
              sendUmlaut(act);
            } else if (isOneShotAction(act)) {
              bleKeyboard.oneShotPress(oneShotMaskForAction(act));
              bleKeyboard.oneShotRelease(oneShotMaskForAction(act));
            } else if (isTextToggleAction(act)) {
              sendTextToggle(act);
            } else if (isRepeatKeyAction(act)) {
              // Wie ein Tipp der ersten Combo-Taste
              if (repeatStartAt(r1, c1, act == ACT_ALT_REPEAT)) {
                delay(5);
                repeatStopAt(r1, c1);
              }
            } else if (act <= 0xFF) {
              bleKeyboard.write((uint8_t)act);
            }
          }
          sendConfigNotification("COMBO_TRIGGER:{\"idx\":" + String(i) + ",\"act\":" + String(act) + "}");
        } else if (userCombos[i].behavior == 1) { // MODIFIER_HOLD
          if (!isConfigMode && bleKeyboard.isConnected()) {
            if (act >= 0x130 && act <= 0x132) {
              if (act == 0x130) bleKeyboard.mousePress(MOUSE_BUTTON_LEFT);
              else if (act == 0x131) bleKeyboard.mousePress(MOUSE_BUTTON_RIGHT);
              else if (act == 0x132) bleKeyboard.mousePress(MOUSE_BUTTON_MIDDLE);
            } else if (act <= 0xFF) {
              bleKeyboard.press((uint8_t)act);
            }
          }
          sendConfigNotification("COMBO_TRIGGER:{\"idx\":" + String(i) + ",\"act\":" + String(act) + "}");
        } else if (userCombos[i].behavior == 2) { // LAYER_TOGGLE
          uint8_t l = act & 0x07;
          if (l == 0) {
            for (int j = 1; j < NUM_LAYERS; j++) toggleLayers[j] = false;
          } else if (l < NUM_LAYERS) {
            toggleLayers[l] = !toggleLayers[l];
          }
          sendConfigNotification("COMBO_TRIGGER:{\"idx\":" + String(i) + ",\"act\":" + String(act) + "}");
        }
      }
    } else if (!bothPressed && comboRuntime[i].active) {
      comboRuntime[i].active = false;
      comboRuntime[i].lastReleaseTime = now;
      if (userCombos[i].behavior == 1) { // MODIFIER_HOLD
        uint16_t act = userCombos[i].action;
        if (!isConfigMode && bleKeyboard.isConnected()) {
          if (act >= 0x130 && act <= 0x132) {
            if (act == 0x130) bleKeyboard.mouseRelease(MOUSE_BUTTON_LEFT);
            else if (act == 0x131) bleKeyboard.mouseRelease(MOUSE_BUTTON_RIGHT);
            else if (act == 0x132) bleKeyboard.mouseRelease(MOUSE_BUTTON_MIDDLE);
          } else if (act <= 0xFF) {
            bleKeyboard.release((uint8_t)act);
          }
        }
      }
    }
  }
}
