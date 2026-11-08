#include "ArduinoMock.h"
#include <cassert>
#include <iostream>
#include <fstream>
#include <iterator>

// Firmware-Definitionen, die DactylLogic.h von der einbindenden Übersetzungseinheit erwartet.
// Die getestete Logik selbst stammt unverändert aus firmware/dactyl_right/DactylLogic.h.
#define NUM_LAYERS 8
#define NUM_ROWS 6
#define NUM_COLS 7

#include "../dactyl_right/DactylCommon.h"
#include "../dactyl_right/DactylHostLeds.h"

#define CONFIG_MODE_MAGIC 0xDAC7CF60UL
// Im Test änderbar, um einen Flash aus der App (ID != 0) zu simulieren
static uint32_t testDefaultsId = 0;
#define KEYMAP_DEFAULTS_ID testDefaultsId

static ComboRuntime comboRuntime[MAX_COMBOS];

static uint16_t KEYMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
static uint16_t HOLDMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
static uint16_t DTAPMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
static uint16_t TAPTERMMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
static uint16_t HOLDFLAVORMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
static String layerNames[NUM_LAYERS] = {
  "Base", "Nav & Pfeile", "Symbole", "Numpad",
  "Function", "Media", "Shortcuts", "Custom"
};
static bool momentaryLayers[NUM_LAYERS] = {false};
static bool toggleLayers[NUM_LAYERS] = {false};
static bool keyState[NUM_ROWS][NUM_COLS] = {{false}};
static uint16_t pressedAction[NUM_ROWS][NUM_COLS] = {{0}};
static unsigned long keyPressTime[NUM_ROWS][NUM_COLS] = {{0}};
static bool keySentToHost[NUM_ROWS][NUM_COLS] = {{false}};

static volatile bool isConfigMode = false;
static volatile bool enterConfigRequested = false;
static volatile bool exitConfigRequested = false;
static unsigned long lastActivityTime = 0;

static String deviceName = "Dactyl Keyboard";
static uint8_t debounceMs = 5;
static uint16_t comboTimeoutMs = 40;
static uint16_t tappingTermMs = 200;
static uint16_t quickTapMs = 0;
static uint16_t requirePriorIdleMs = 0;
static uint8_t chordalHold = 0;
static uint8_t retroTap = 0;
static uint8_t numWordLayer = 1;
static uint8_t bootLayer = 0;
static uint8_t autoShift = 0;
static uint16_t autoShiftMs = 175;
static uint16_t leaderTimeoutMs = 1000;
static uint16_t oneShotTimeoutMs = 0;
static uint16_t layerTimeoutMs = 0;
static uint8_t holdTapMode = 0;
static uint8_t triLayerRules[6] = {0, 0, 0, 0, 0, 0};
static uint8_t capsLedEnabled = 0;
static HostLedsState testHostLeds;
#define DEVICE_INFO_HOST_LEDS_BITS() testHostLeds.bits
static uint8_t numTriLayers = 0;
static uint32_t standbyTimeoutMinutes = 5;
static uint32_t deepSleepTimeoutMinutes = 60;

static uint8_t numCombos = 0;
static KeyCombo userCombos[MAX_COMBOS];

// Umlaut-Aktion (wie DactylCommon.h)
#define NUM_UMLAUT_ACTIONS   7
// One-Shot-Modifier und Caps Word (wie DactylCommon.h)
#define NUM_ONE_SHOT_ACTIONS 8

static uint8_t numKeyPairs = 0;
static uint8_t numAltRepeats = 0;
static AltRepeatPair userAltRepeats[MAX_ALT_REPEATS];
static KeyPair userKeyPairs[MAX_KEY_PAIRS];

static uint8_t numLeaderSeqs = 0;
static LeaderSeq userLeaderSeqs[MAX_LEADER_SEQS];

// Tasten-Überschreibungen (nur der Master, wie dactyl_right.ino)
#define DACTYL_KEY_OVERRIDES
// Dynamisches Makro (nur der Master, wie dactyl_right.ino)
#define DACTYL_DYNAMIC_MACRO
// BLE-Host-Slots (nur der Master, wie dactyl_right.ino)
#define DACTYL_BLE_HOST
#include "../dactyl_right/DactylKeyOverride.h"
static uint8_t numKeyOverrides = 0;
static KeyOverride userKeyOverrides[MAX_KEY_OVERRIDES];

static uint8_t numMacros = 0;
static uint8_t macroLengths[MAX_MACROS] = {0};
static bool userMacroRepeat[MAX_MACROS] = {false};
static MacroStep userMacros[MAX_MACROS][MAX_MACRO_STEPS];

static SemaphoreHandle_t configMutex = xSemaphoreCreateMutex();
static Preferences preferences;
static BLECharacteristic mockChar;
static BLECharacteristic* pConfigCharacteristic = &mockChar;
[[maybe_unused]] static BLECharacteristic* pOtaCharacteristic = &mockChar;
static BleKeyboard bleKeyboard("Dactyl Keyboard", "Dactyl DIY", 100);

void handleConfigCommand(String cmd, bool fromBle = false);
void sendConfigNotification(String msg, bool addDelay = false);

// Wie dactyl_right.ino: DEVICE_INFO meldet den Stand der linken Hälfte (splitLeftFwStatus)
static long testLeftFw = 0;
#define DEVICE_INFO_LEFT_FW() testLeftFw
// ... und die Link-Statistik (splitLeftLinkJson; das Format prüft test_split_hid.cpp)
static const char *testLeftLink = "{\"up\":1,\"ms\":1234,\"ever\":1,\"losses\":2,\"rx_dropped\":3,\"key_dropped\":4,\"rssi\":-61,\"rssi_min\":-70}";
#define DEVICE_INFO_LEFT_LINK(buf, size) snprintf(buf, size, "%s", testLeftLink)

// Wie dactyl_left.ino: GET_DIAG meldet Füllstand und Verluste der Sendewarteschlange der linken Hälfte
static uint32_t testSqMax = 0, testSqDrop = 0;
#define DIAG_SEND_QUEUE_MAX() testSqMax
#define DIAG_SEND_QUEUE_DROPPED() testSqDrop

// Repeat über beide Hälften: die Hooks rufen den Test ein, damit der Pfad zur anderen Hälfte prüfbar ist
static bool testRemoteTakesRepeat = false;
static std::vector<std::string> testRemoteCalls;
static int testRecorded = 0;
static int testPairReleases = 0;
static bool testRemotePress(uint8_t r, uint8_t c, bool alt) {
  if (!testRemoteTakesRepeat) return false;
  testRemoteCalls.push_back(std::string(alt ? "alt" : "press") + std::to_string(r) + std::to_string(c));
  return true;
}
static void testRemoteRelease(uint8_t r, uint8_t c) {
  testRemoteCalls.push_back("release" + std::to_string(r) + std::to_string(c));
}
#define REPEAT_REMOTE_PRESS(r, c, alt) testRemotePress(r, c, alt)
#define REPEAT_REMOTE_RELEASE(r, c) testRemoteRelease(r, c)
#define REPEAT_RECORDED() (testRecorded++)
#define REPEAT_RELEASE_HELD_PAIRS() (testPairReleases++)
#include "../dactyl_right/DactylLogic.h"

// ======================================================================// TEST SUITE ASSERTIONS
// =============================================================================
static int testsRun = 0;
static int testsPassed = 0;

#define TEST(name) void name(); \
  struct Runner_##name { Runner_##name() { \
    testsRun++; \
    std::cout << "[ RUN      ] " << #name << std::endl; \
    name(); \
    testsPassed++; \
    std::cout << "[       OK ] " << #name << std::endl; \
  } } instance_##name; \
  void name()

// Reset mock state before tests
void resetState() {
  swapClearAll();
  remoteMomentaryLayers = 0;
  oslArmed = remoteOslArmed = oslHeld = oslUsed = oslUsedToSend = remoteOslIgnore = 0;
  for (int l = 0; l < NUM_LAYERS; l++) { oslTerm[l] = 0; oslPressTime[l] = 0; }
  remoteOslIgnoreMs = remoteOslRxMs = 0;
  for (int l = 0; l < NUM_LAYERS; l++) {
    momentaryLayers[l] = false;
    toggleLayers[l] = false;
    for (int r = 0; r < NUM_ROWS; r++) {
      for (int c = 0; c < NUM_COLS; c++) {
        KEYMAP[l][r][c] = 0;
        keyState[r][c] = false;
        pressedAction[r][c] = 0;
        keyPressTime[r][c] = 0;
        keySentToHost[r][c] = false;
      }
    }
  }
  for (int i = 0; i < MAX_COMBOS; i++) {
    comboRuntime[i].active = false;
    comboRuntime[i].lastReleaseTime = 0;
  }
  for (int l = 0; l < NUM_LAYERS; l++)
    for (int r = 0; r < NUM_ROWS; r++)
      for (int c = 0; c < NUM_COLS; c++) { HOLDMAP[l][r][c] = 0; DTAPMAP[l][r][c] = 0; TAPTERMMAP[l][r][c] = 0; HOLDFLAVORMAP[l][r][c] = 0; }
  resetTapHold();
  resetMouseMove();
  resetDoubleTap();
  for (int r = 0; r < NUM_ROWS; r++) for (int c = 0; c < NUM_COLS; c++) capsWordBuffered[r][c] = false;
  numCombos = 0;
  for (int r = 0; r < NUM_ROWS; r++) for (int c = 0; c < NUM_COLS; c++) comboPressLayer1[r][c] = 0;
  numKeyPairs = 0;
  for (int i = 0; i < MAX_KEY_PAIRS; i++) userKeyPairs[i] = { 0, 0 };
  numAltRepeats = 0;
  for (int i = 0; i < MAX_ALT_REPEATS; i++) userAltRepeats[i] = { 0, 0 };
  numLeaderSeqs = 0;
  for (int i = 0; i < MAX_LEADER_SEQS; i++) userLeaderSeqs[i] = { { 0, 0, 0, 0 }, 0 };
  leaderTimeoutMs = 1000;
  oneShotTimeoutMs = 0;
  layerTimeoutMs = 0;
  layerLockedMask = 0;
  layerTimeoutSeenSeq = retroPressSeq;
  layerTimeoutSeenMask = 0;
  layerTimeoutStampMs = 0;
  oslSeenArmed = 0;
  oslArmedMs = 0;
  leaderReset();
  for (int r = 0; r < NUM_ROWS; r++) for (int c = 0; c < NUM_COLS; c++) leaderConsumed[r][c] = leaderBuffered[r][c] = false;
  numKeyOverrides = 0;
  for (int i = 0; i < MAX_KEY_OVERRIDES; i++) userKeyOverrides[i] = { 0, 0, 0, KEY_OVERRIDE_ALL_LAYERS };
  numMacros = 0;
  for (int i = 0; i < MAX_MACROS; i++) { macroLengths[i] = 0; userMacroRepeat[i] = false; }
  macroRun = {};
  bleKeyboard.dynMacro = DynamicMacro();
  lastRepeatAction = 0;
  testRemoteTakesRepeat = false;
  testRemoteCalls.clear();
  testRecorded = 0;
  testPairReleases = 0;
  for (int r = 0; r < NUM_ROWS; r++)
    for (int c = 0; c < NUM_COLS; c++) { repeatResolved[r][c] = 0; repeatRemote[r][c] = false; }
  // Globale Settings und NVS-Mock zurücksetzen, damit Tests unabhängig von ihrer Reihenfolge sind
  comboTimeoutMs = 40;
  tappingTermMs = 200;
  quickTapMs = 0;
  requirePriorIdleMs = 0;
  chordalHold = 0;
  retroTap = 0;
  numWordLayer = 1;
  bootLayer = 0;
  numWordActive = false;
  ttReset();
  autoShift = 0;
  autoShiftMs = 175;
  tapTermsCompiledIn = false;
  holdFlavorsCompiledIn = false;
  holdTapMode = 0;
  numTriLayers = 0;
  memset(triLayerRules, 0, sizeof(triLayerRules));
  capsLedEnabled = 0;
  testHostLeds = HostLedsState();
  debounceMs = 5;
  resetMatrixDebounce();
  standbyTimeoutMinutes = 5;
  deepSleepTimeoutMinutes = 60;
  deviceName = "Dactyl Keyboard";
  {
    const String defaultNames[NUM_LAYERS] = { "Base", "Nav & Pfeile", "Symbole", "Numpad", "Function", "Media", "Shortcuts", "Custom" };
    for (int l = 0; l < NUM_LAYERS; l++) layerNames[l] = defaultNames[l];
  }
  Preferences::strStore.clear();
  Preferences::uintStore.clear();
  Preferences::bytesStore.clear();
  testDefaultsId = 0;
  Preferences::failWrites = false;
  Preferences::failBytesKey.clear();
  Preferences::failUCharKey.clear();
  _mock_mutex_busy = false;
  bleKeyboard.connected = true;
  bleKeyboard.writtenKeys.clear();
  bleKeyboard.pressHistory.clear();
  bleKeyboard.keyEvents.clear();
  bleKeyboard.oneShotEvents.clear();
  isConfigMode = false;
  enterConfigRequested = false;
  exitConfigRequested = false;
  mockChar.notifications.clear();
  Serial.clear();
  bleKeyboard.releaseAll();
  resetOtaState();
}

// -----------------------------------------------------------------------------
// Test 1: Layer Resolution & Navigation
// -----------------------------------------------------------------------------
TEST(test_layer_resolution_and_navigation) {
  resetState();

  // 1. Base layer is 0 by default
  assert(getActiveLayer() == 0);

  // 2. Momentary layer activation
  momentaryLayers[1] = true;
  assert(getActiveLayer() == 1);
  momentaryLayers[2] = true;
  assert(getActiveLayer() == 2); // highest active momentary wins
  momentaryLayers[2] = false;
  assert(getActiveLayer() == 1);
  momentaryLayers[1] = false;
  assert(getActiveLayer() == 0);

  // 3. Toggle layers
  toggleLayers[3] = true;
  assert(getActiveLayer() == 3);
  momentaryLayers[2] = true;
  assert(getActiveLayer() == 3); // Höchste aktive Ebene gewinnt (Toggle 3 > Momentary 2)
  momentaryLayers[5] = true;
  assert(getActiveLayer() == 5); // Höhere Momentary-Ebene überdeckt Toggle 3
  momentaryLayers[5] = false;
  momentaryLayers[2] = false;
  assert(getActiveLayer() == 3);

  // MO_0 erzwingt temporär Layer 0, auch wenn Ebenen getoggelt sind
  momentaryLayers[0] = true;
  assert(getActiveLayer() == 0);
  momentaryLayers[0] = false;
  assert(getActiveLayer() == 3);

  // 4. TG_0 resets all toggles
  for (int i = 1; i < NUM_LAYERS; i++) toggleLayers[i] = false;
  assert(getActiveLayer() == 0);

  // 5. LAYER_DOWN wrap 0 -> 7 (Produktions-Dispatch)
  dispatchPress(0, 0, ACT_LAYER_DOWN, getActiveLayer());
  assert(getActiveLayer() == 7);

  // 6. LAYER_UP wrap 7 -> 0
  dispatchPress(0, 0, ACT_LAYER_UP, getActiveLayer());
  assert(getActiveLayer() == 0);
}

// -----------------------------------------------------------------------------
// Test 2: Security - BLE Command Rejection in Normal Mode (Finding #1)
// -----------------------------------------------------------------------------
TEST(test_security_ble_command_rejection) {
  resetState();
  isConfigMode = false;

  // Attempting to write a key over BLE while in normal keyboard mode MUST fail
  handleConfigCommand("SET_KEY 0 0 0 42", true);
  assert(KEYMAP[0][0][0] == 0); // Not modified!
  assert(mockChar.notifications.empty());

  // Attempting to reset config over BLE in normal mode MUST fail
  Preferences prefs;
  prefs.putString("test", "val");
  handleConfigCommand("RESET_CONFIG", true);
  assert(prefs.isKey("test")); // NVS not wiped!

  // In normal mode, ENTER_CONFIG and GET_INFO over BLE MUST be permitted
  handleConfigCommand("GET_INFO", true);
  assert(!mockChar.notifications.empty());
  assert(mockChar.value.find("DEVICE_INFO:") != std::string::npos);
  assert(mockChar.value.find("\"side\":\"R\"") != std::string::npos);
  assert(mockChar.value.find("\"fw\":" + std::to_string(DACTYL_FW_VERSION) + ",") != std::string::npos);
  // Master-Build: left_fw und left_link am Ende, die Zeile endet mit der schließenden Klammer
  std::string linkTail = std::string(",\"left_link\":") + testLeftLink + "}";
  for (long v : {0L, -1L, 65535L}) {
    testLeftFw = v;
    handleConfigCommand("GET_INFO", true);
    std::string tail = ",\"left_fw\":" + std::to_string(v) + linkTail;
    assert(mockChar.value.size() > tail.size());
    assert(mockChar.value.compare(mockChar.value.size() - tail.size(), tail.size(), tail) == 0);
    assert(mockChar.value.find("\"config_mode\":false,\"left_fw\"") != std::string::npos);
  }
  // Ein langer Gerätename schneidet die Zeile nicht ab
  String savedName = deviceName;
  deviceName = "1234567890123456789012345678901";
  testLeftFw = -1;
  handleConfigCommand("GET_INFO", true);
  assert(mockChar.value.find("\"left_fw\":-1" + linkTail) != std::string::npos);
  // Größte Zahlen in left_link (je 10 Stellen) mit langem Namen: gültig abgeschlossen, im Puffer (768) und
  // unter dem BLE-Attributlimit (512)
  testLeftLink = "{\"up\":1,\"ms\":4294967295,\"ever\":1,\"losses\":4294967295,\"rx_dropped\":4294967295,\"key_dropped\":4294967295,\"rssi\":-127,\"rssi_min\":-127}";
  testLeftFw = 65535;
  oneShotTimeoutMs = 10000;                    // größtes "ot"-Feld
  handleConfigCommand("GET_INFO", true);
  oneShotTimeoutMs = 0;
  std::string maxTail = std::string(",\"left_fw\":65535,\"left_link\":") + testLeftLink + "}";
  assert(mockChar.value.size() < 512 && mockChar.value.size() > maxTail.size());
  assert(mockChar.value.compare(mockChar.value.size() - maxTail.size(), maxTail.size(), maxTail) == 0);
  testLeftLink = "null";                       // Config Mode oder ESP-NOW nicht gestartet (deviceInfoLeftLink)
  handleConfigCommand("GET_INFO", true);
  assert(mockChar.value.find(",\"left_link\":null}") != std::string::npos);
  testLeftLink = "{\"up\":1,\"ms\":1234,\"ever\":1,\"losses\":2,\"rx_dropped\":3,\"key_dropped\":4,\"rssi\":-61,\"rssi_min\":-70}";
  deviceName = savedName;
  testLeftFw = 0;

  // ENTER_CONFIG über BLE ist im Tastaturmodus abgelehnt: Config-Modus nur physisch oder per USB
  handleConfigCommand("ENTER_CONFIG", true);
  assert(enterConfigRequested == false);
  handleConfigCommand("ENTER_CONFIG", false);
  assert(enterConfigRequested == true);

  // In config mode, SET_KEY over BLE MUST succeed
  isConfigMode = true;
  handleConfigCommand("SET_KEY 0 0 0 42", true);
  assert(KEYMAP[0][0][0] == 42);

  // Commands via USB Serial (fromBle = false) are ALWAYS permitted
  isConfigMode = false;
  handleConfigCommand("SET_KEY 0 0 0 99", false);
  assert(KEYMAP[0][0][0] == 99);
}

// -----------------------------------------------------------------------------
// Test 3: Security - BLE Keystroke Notification Suppression (Finding #1)
// -----------------------------------------------------------------------------
TEST(test_security_ble_notification_suppression) {
  resetState();
  isConfigMode = false;

  // In normal mode, sending KEY_PRESS/KEY_RELEASE must NOT notify BLE subscribers
  mockChar.notifications.clear();
  sendConfigNotification("KEY_PRESS:{\"r\":1,\"c\":1,\"key\":\"A\"}");
  assert(mockChar.notifications.empty()); // Blocked!

  sendConfigNotification("KEY_RELEASE:{\"r\":1,\"c\":1}");
  assert(mockChar.notifications.empty()); // Blocked!

  // Non-keystroke notifications (e.g. MODE:CONFIG, DEVICE_INFO) MUST still notify
  sendConfigNotification("MODE:CONFIG");
  assert(mockChar.notifications.size() == 1);
  assert(mockChar.notifications[0] == "MODE:CONFIG");

  // In Config Mode, live monitor keystrokes MUST be notified to configurator app
  isConfigMode = true;
  sendConfigNotification("KEY_PRESS:{\"r\":1,\"c\":1,\"key\":\"A\"}");
  assert(mockChar.notifications.size() == 2);
  assert(mockChar.notifications[1] == "KEY_PRESS:{\"r\":1,\"c\":1,\"key\":\"A\"}");
}

// -----------------------------------------------------------------------------
// Test 3a: Reines Matrix-Ereignis auch für Tasten ohne Aktion (Matrix-Test)
// -----------------------------------------------------------------------------
static size_t countOutput(const std::string& line) {
  size_t n = 0;
  for (const auto& l : Serial.outputLines) if (l == line) n++;
  return n;
}

static bool hasOutputPrefix(const std::string& prefix) {
  for (const auto& l : Serial.outputLines) if (l.rfind(prefix, 0) == 0) return true;
  return false;
}

// -----------------------------------------------------------------------------
// Test 3b: Layer-Abgleich beider Hälften (MO und TG der anderen Hälfte)
// -----------------------------------------------------------------------------
TEST(test_remote_momentary_layer_activates_layer_here) {
  resetState();
  KEYMAP[0][2][1] = 'j';
  KEYMAP[1][2][1] = KEY_LEFT_ARROW;
  // MO_1 der anderen Hälfte: eine Taste dieser Hälfte sendet die Belegung von Ebene 1
  assert(applyRemoteLayerState(0x02, false, 0));
  assert(getActiveLayer() == 1);
  assert(countOutput("LAYER: SPLIT -> Layer 1\n") == 1);
  bleKeyboard.pressHistory.clear();
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  assert(!bleKeyboard.pressHistory.empty() && bleKeyboard.pressHistory.back() == KEY_LEFT_ARROW);
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  // Loslassen der anderen Hälfte: zurück auf Ebene 0
  assert(applyRemoteLayerState(0, false, 0));
  assert(getActiveLayer() == 0);
  // Gleicher Zustand meldet keinen Wechsel
  Serial.clear();
  assert(!applyRemoteLayerState(0, false, 0));
  assert(!hasOutputPrefix("LAYER:"));
  // Entferntes MO_0 erzwingt Ebene 0 wie ein eigenes
  toggleLayers[3] = true;
  applyRemoteLayerState(0x01, false, 0);
  assert(getActiveLayer() == 0);
  applyRemoteLayerState(0, false, 0);
  assert(getActiveLayer() == 3);
}

TEST(test_remote_toggle_state_replaces_local_toggles) {
  resetState();
  toggleLayers[2] = true;
  // SET der anderen Hälfte: Ebene 3 eingerastet, Ebene 2 nicht mehr; Bit 0 (Ebene 0) rastet nie ein
  assert(applyRemoteLayerState(0, true, (1 << 3) | 1));
  assert(!toggleLayers[0] && !toggleLayers[2] && toggleLayers[3]);
  assert(getActiveLayer() == 3);
  assert(toggleLayerMask() == (1 << 3));
  // Ohne SET bleiben die Toggles unverändert
  applyRemoteLayerState(0, false, 0);
  assert(toggleLayers[3]);
}

TEST(test_local_layer_masks_follow_mo_and_tg_keys) {
  resetState();
  KEYMAP[0][5][0] = ACT_MO_2;
  KEYMAP[0][5][1] = ACT_TG_1;
  keyState[5][0] = true;
  onMatrixKeyChange(5, 0, true);
  assert(localMomentaryLayerMask() == (1 << 2));
  keyState[5][1] = true;
  onMatrixKeyChange(5, 1, true);
  keyState[5][1] = false;
  onMatrixKeyChange(5, 1, false);
  // TG_1 auf Ebene 0 gedrückt, aber Ebene 2 ist aktiv: Taste ist dort transparent (Ebene 0)
  assert(toggleLayerMask() == (1 << 1));
  keyState[5][0] = false;
  onMatrixKeyChange(5, 0, false);
  assert(localMomentaryLayerMask() == 0);
  // Entfernte MO-Ebenen zählen nicht als eigene (kein Echo an die andere Hälfte)
  applyRemoteLayerState(0x08, false, 0);
  assert(localMomentaryLayerMask() == 0);
}

TEST(test_layer_navigation_and_combo_toggle_change_toggle_mask) {
  resetState();
  KEYMAP[0][5][0] = ACT_LAYER_UP;
  KEYMAP[2][5][0] = ACT_LAYER_UP;
  keyState[5][0] = true;
  onMatrixKeyChange(5, 0, true);
  keyState[5][0] = false;
  onMatrixKeyChange(5, 0, false);
  assert(toggleLayerMask() == (1 << 1));
  KEYMAP[1][5][1] = ACT_LAYER_DOWN;
  keyState[5][1] = true;
  onMatrixKeyChange(5, 1, true);
  keyState[5][1] = false;
  onMatrixKeyChange(5, 1, false);
  assert(toggleLayerMask() == 0);
  // Combo LAYER_TOGGLE schreibt toggleLayers[] und geht damit in den Abgleich
  numCombos = 1;
  userCombos[0] = { 2, 1, 2, 2, 2, (uint16_t)ACT_TG_1 + 2 }; // Ebene 3
  KEYMAP[0][2][1] = 'j';
  KEYMAP[0][2][2] = 'k';
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  keyState[2][2] = true;
  onMatrixKeyChange(2, 2, true);
  checkUserCombos();
  assert(toggleLayerMask() == (1 << 3));
  keyState[2][1] = keyState[2][2] = false;
  onMatrixKeyChange(2, 1, false);
  onMatrixKeyChange(2, 2, false);
  checkUserCombos();
}

static void pressKey(int r, int c, bool down) {
  keyState[r][c] = down;
  onMatrixKeyChange(r, c, down);
}

TEST(test_layer_lock_locks_held_mo_layer_and_second_press_releases) {
  resetState();
  KEYMAP[0][5][0] = ACT_MO_3;
  KEYMAP[3][5][1] = ACT_LAYER_LOCK;
  pressKey(5, 0, true);
  assert(getActiveLayer() == 3);
  pressKey(5, 1, true);
  pressKey(5, 1, false);
  pressKey(5, 0, false);
  // MO_3 ist gelöst, die Ebene bleibt eingerastet und geht in den Abgleich
  assert(getActiveLayer() == 3 && toggleLayers[3] && toggleLayerMask() == (1 << 3));
  // Zweiter Druck ohne gehaltene MO-Ebene gibt die Ebene frei
  pressKey(5, 1, true);
  pressKey(5, 1, false);
  assert(getActiveLayer() == 0 && toggleLayerMask() == 0);
}

TEST(test_layer_lock_without_mo_clears_locked_layers_and_locks_highest_mo) {
  resetState();
  toggleLayers[2] = true;
  momentaryLayers[1] = true;
  momentaryLayers[4] = true;
  dispatchPress(0, 0, ACT_LAYER_LOCK, getActiveLayer());
  // Höchste gehaltene MO-Ebene (4) rastet ein, Ebene 2 bleibt
  assert(toggleLayers[4] && toggleLayers[2] && !toggleLayers[1]);
  momentaryLayers[1] = momentaryLayers[4] = false;
  dispatchPress(0, 0, ACT_LAYER_LOCK, getActiveLayer());
  assert(toggleLayerMask() == 0 && getActiveLayer() == 0);
}

TEST(test_layer_lock_uses_mo_layer_of_other_half) {
  resetState();
  applyRemoteLayerState(1 << 2, false, 0);
  dispatchPress(0, 0, ACT_LAYER_LOCK, getActiveLayer());
  applyRemoteLayerState(0, false, 0);
  assert(toggleLayerMask() == (1 << 2) && getActiveLayer() == 2);
}

TEST(test_layer_lock_as_hold_action_and_combo_action) {
  resetState();
  // Combo mit Verhalten KEY_PRESS und der Aktion LAYER_LOCK
  momentaryLayers[3] = true;
  numCombos = 1;
  userCombos[0] = { 2, 1, 2, 2, 0, (uint16_t)ACT_LAYER_LOCK };
  KEYMAP[0][2][1] = 'j';
  KEYMAP[0][2][2] = 'k';
  pressKey(2, 1, true);
  pressKey(2, 2, true);
  checkUserCombos();
  assert(toggleLayers[3]);
  pressKey(2, 1, false);
  pressKey(2, 2, false);
  checkUserCombos();
  momentaryLayers[3] = false;
  assert(getActiveLayer() == 3);
}

TEST(test_layer_lock_as_hold_and_double_tap_action) {
  resetState();
  KEYMAP[0][5][0] = ACT_MO_3;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = ACT_LAYER_LOCK;
  setMillis(1000);
  pressKey(5, 0, true);
  pressKey(2, 1, true);
  setMillis(1000 + TAPPING_TERM_MS + 10);
  processDeferredKeys(millis());           // Halten: LAYER_LOCK rastet die gehaltene MO-Ebene 3 ein
  pressKey(2, 1, false);
  pressKey(5, 0, false);
  assert(toggleLayerMask() == (1 << 3) && getActiveLayer() == 3);
  HOLDMAP[0][2][1] = 0;
  resetState();
  KEYMAP[0][5][0] = ACT_MO_3;
  KEYMAP[3][2][2] = 'x';
  DTAPMAP[3][2][2] = ACT_LAYER_LOCK;
  pressKey(5, 0, true);
  setMillis(1000);
  pressKey(2, 2, true);
  setMillis(1020);
  pressKey(2, 2, false);
  setMillis(1050);
  pressKey(2, 2, true);                    // zweiter Tipp: Doppel-Tipp-Aktion
  pressKey(2, 2, false);
  pressKey(5, 0, false);
  assert(toggleLayerMask() == (1 << 3));
  DTAPMAP[3][2][2] = 0;
}

TEST(test_add_combo_accepts_layer_lock_only_as_key_press) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 0 2 1 0 362", false);
  assert(numCombos == 1);
  handleConfigCommand("ADD_COMBO 2 0 2 1 1 362", false);
  handleConfigCommand("ADD_COMBO 2 0 2 1 2 362", false);
  assert(numCombos == 1);
}

TEST(test_layer_lock_is_not_repeatable) {
  assert(!isRepeatableAction(ACT_LAYER_LOCK));
}

TEST(test_layer_up_steps_from_shared_layer_with_remote_mo) {
  resetState();
  KEYMAP[2][5][0] = ACT_LAYER_UP;
  // Die andere Hälfte hält MO_2: LAYER_UP dieser Hälfte schaltet von der gemeinsamen Ebene 2 auf 3
  applyRemoteLayerState(1 << 2, false, 0);
  assert(getActiveLayer() == 2);
  keyState[5][0] = true;
  onMatrixKeyChange(5, 0, true);
  keyState[5][0] = false;
  onMatrixKeyChange(5, 0, false);
  assert(toggleLayerMask() == (1 << 3) && getActiveLayer() == 3);
  // Loslassen der anderen Hälfte: die eingerastete Ebene 3 bleibt
  applyRemoteLayerState(0, false, 0);
  assert(getActiveLayer() == 3);
}

TEST(test_matrix_event_for_key_without_action) {
  resetState();
  for (int l = 0; l < NUM_LAYERS; l++) { KEYMAP[l][2][1] = 0; HOLDMAP[l][2][1] = 0; DTAPMAP[l][2][1] = 0; }
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  setMillis(1050);
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert(countOutput("MATRIX:{\"r\":2,\"c\":1,\"pressed\":1,\"t\":1000}") == 1);
  assert(countOutput("MATRIX:{\"r\":2,\"c\":1,\"pressed\":0,\"t\":1050}") == 1);
  assert(!hasOutputPrefix("KEY_PRESS:")); // Aktion 0 sendet weiterhin kein KEY_PRESS
  assert(bleKeyboard.pressHistory.empty());
}

// Die MATRIX:-Zeile kommt nach den HID-Ereignissen der Taste, damit sie den Tastendruck nicht verzögert
TEST(test_matrix_event_after_hid_press) {
  resetState();
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = 0;
  DTAPMAP[0][2][1] = 0;
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  assert(!bleKeyboard.pressHistory.empty());
  assert(!Serial.outputLines.empty());
  assert(Serial.outputLines.back() == "MATRIX:{\"r\":2,\"c\":1,\"pressed\":1,\"t\":1000}");
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert(Serial.outputLines.back() == "MATRIX:{\"r\":2,\"c\":1,\"pressed\":0,\"t\":1000}");
}

// MATRIX: geht nur auf USB-Serial, auch im Config-Modus nie als BLE-Notification
TEST(test_matrix_event_never_over_ble) {
  for (int mode = 0; mode < 2; mode++) {
    resetState();
    isConfigMode = (mode == 1);
    KEYMAP[0][2][1] = 0;
    HOLDMAP[0][2][1] = 0;
    DTAPMAP[0][2][1] = 0;
    setMillis(1000);
    keyState[2][1] = true;
    onMatrixKeyChange(2, 1, true);
    keyState[2][1] = false;
    onMatrixKeyChange(2, 1, false);
    assert(countOutput("MATRIX:{\"r\":2,\"c\":1,\"pressed\":1,\"t\":1000}") == 1);
    for (const auto& n : mockChar.notifications) assert(n.rfind("MATRIX:", 0) != 0);
  }
  isConfigMode = false;
}

TEST(test_matrix_event_on_physical_change_for_tap_hold_key) {
  resetState();
  KEYMAP[0][5][3] = ' ';
  HOLDMAP[0][5][3] = KEY_LEFT_CTRL;
  setMillis(1000);
  keyState[5][3] = true;
  onMatrixKeyChange(5, 3, true);
  // Die Tap-Hold-Entscheidung ist offen, das Matrix-Ereignis kommt trotzdem sofort
  assert(countOutput("MATRIX:{\"r\":5,\"c\":3,\"pressed\":1,\"t\":1000}") == 1);
  assert(!hasOutputPrefix("KEY_PRESS:"));
  setMillis(1050);
  keyState[5][3] = false;
  onMatrixKeyChange(5, 3, false);
  assert(countOutput("MATRIX:{\"r\":5,\"c\":3,\"pressed\":0,\"t\":1050}") == 1);
  HOLDMAP[0][5][3] = 0;
}

// "t" ist die Scan-Zeit der Änderung (atMs), nicht der Zeitpunkt der Ausgabe: der Master führt eine zurückgehaltene
// Taste später aus. Die App erkennt Prellen nur mit der echten Scan-Zeit.
TEST(test_matrix_event_reports_scan_time_not_print_time) {
  resetState();
  KEYMAP[0][2][1] = 0;
  HOLDMAP[0][2][1] = 0;
  DTAPMAP[0][2][1] = 0;
  setMillis(5000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true, 4321);
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false, 4330);
  assert(countOutput("MATRIX:{\"r\":2,\"c\":1,\"pressed\":1,\"t\":4321}") == 1);
  assert(countOutput("MATRIX:{\"r\":2,\"c\":1,\"pressed\":0,\"t\":4330}") == 1);
}

// millis() läuft nach etwa 49 Tagen über 32 Bit: die längste Zeile (R5C6, t = 4294967295, 47 Zeichen) passt in den Puffer
TEST(test_matrix_event_longest_line_fits_buffer) {
  resetState();
  KEYMAP[0][5][4] = 0;
  HOLDMAP[0][5][4] = 0;
  DTAPMAP[0][5][4] = 0;
  keyState[5][4] = true;
  onMatrixKeyChange(5, 4, true, 4294967295UL);
  assert(countOutput("MATRIX:{\"r\":5,\"c\":4,\"pressed\":1,\"t\":4294967295}") == 1);
}

// -----------------------------------------------------------------------------
// Test 4: Hardware Config Combo Immediate Release (Finding #11)
// -----------------------------------------------------------------------------
TEST(test_config_combo_immediate_release) {
  resetState();
  isConfigMode = false;

  // Simulate pressing R0C0 ('6')
  keyState[0][0] = true;
  bleKeyboard.press((uint8_t)'6');
  assert(bleKeyboard.pressedKeys.size() == 1);
  assert(bleKeyboard.pressedKeys[0] == '6');

  // Simulate pressing R4C5 (Right Alt) while R0C0 is held
  keyState[4][5] = true;

  // Combo detection logic:
  static unsigned long comboStartTime = 0;
  if (keyState[0][0] && keyState[4][5]) {
    if (comboStartTime == 0) {
      comboStartTime = millis();
      // Item 11: releaseAll() immediately so macOS doesn't repeat '666...'
      if (!isConfigMode && bleKeyboard.isConnected()) {
        bleKeyboard.releaseAll();
      }
    }
  }

  // Verification: All pressed keys on macOS are immediately released!
  assert(bleKeyboard.pressedKeys.empty());

  // Produktions-Dispatch: während beide gehalten sind, wird R0C0 nicht an den Host gesendet
  assert(isConfigComboSuppressed(0, 0));
  assert(isConfigComboSuppressed(4, 5));
  assert(!isConfigComboSuppressed(1, 1));
  dispatchPress(0, 0, '6', 0);
  assert(bleKeyboard.pressedKeys.empty()); // Keystroke suppressed!
}

// -----------------------------------------------------------------------------
// Test 5: User Combos / Chords Engine (Finding #10)
// -----------------------------------------------------------------------------
TEST(test_user_combos_engine) {
  resetState();
  isConfigMode = false;
  comboTimeoutMs = 40;

  // 1. Add Chord 1: R2C1 (J) + R2C2 (K) -> KEY_ESC (KEY_PRESS, behavior 0)
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false); // 177 = 0xB1 (KEY_ESC)
  // 2. Add Chord 2: R2C1 (J) + R2C3 (L) -> KEY_LEFT_CTRL (MODIFIER_HOLD, behavior 1)
  handleConfigCommand("ADD_COMBO 2 1 2 3 1 128", false); // 128 = 0x80 (KEY_LEFT_CTRL)
  assert(numCombos == 2);

  // Fall A: Schnelles Nacheinandertippen (Rollover, Zeitdifferenz > comboTimeoutMs)
  setMillis(1000);
  keyState[2][1] = true;
  keyPressTime[2][1] = 1000;
  checkUserCombos();
  assert(!comboRuntime[0].active);

  // K wird 60ms später gedrückt (60ms > 40ms) -> Darf KEINE Combo auslösen!
  setMillis(1060);
  keyState[2][2] = true;
  keyPressTime[2][2] = 1060;
  checkUserCombos();
  assert(comboRuntime[0].active == false);
  assert(bleKeyboard.writtenKeys.empty()); // Keine Escape gesendet!

  // Tasten loslassen
  keyState[2][1] = false;
  keyState[2][2] = false;
  checkUserCombos();

  // Fall B: Fast zeitgleicher Akkord (Zeitdifferenz <= 40ms)
  setMillis(2000);
  keyState[2][1] = true;
  keyPressTime[2][1] = 2000;
  keyState[2][2] = true;
  keyPressTime[2][2] = 2020; // 20ms Differenz <= 40ms
  checkUserCombos();
  assert(comboRuntime[0].active == true);
  assert(bleKeyboard.writtenKeys.size() == 1);
  assert(bleKeyboard.writtenKeys[0] == KEY_ESC);
  assert(wasComboRecentlyActive(2, 1) == true);
  assert(wasComboRecentlyActive(2, 2) == true);
  assert(keySentToHost[2][1] == true); // Lingering-Schutz aktiv!
  assert(keySentToHost[2][2] == true);

  // Release K -> Deaktiviert Chord 1, Grace-Period bleibt aktiv
  keyState[2][2] = false;
  checkUserCombos();
  assert(comboRuntime[0].active == false);
  assert(wasComboRecentlyActive(2, 1) == true); // Immer noch in 300ms Grace Period

  // Nach 350ms ist Grace-Period abgelaufen
  advanceMillis(350);
  assert(wasComboRecentlyActive(2, 1) == false);

  // Fall B2 (Finding Cycle 2): Neuer legitimer Tastendruck von J 100ms nach Chord-Release
  // darf NICHT von der Grace-Period unterdrückt werden!
  setMillis(2400); // comboRuntime[0].lastReleaseTime war ~2020
  keyPressTime[2][1] = 2400; // Neuer Anschlag nach Release
  assert(wasComboRecentlyActive(2, 1) == false); // Nicht blockiert!
  assert(isComboCandidateKey(2, 1) == true);
  assert(isComboCandidateKey(2, 2) == true);
  assert(isComboCandidateKey(0, 0) == false);

  // Fall C: Modifier Hold Chord (J + L)
  setMillis(4000);
  keyState[2][1] = true;
  keyPressTime[2][1] = 4000;
  keyState[2][3] = true;
  keyPressTime[2][3] = 4015; // 15ms Diff
  checkUserCombos();
  assert(comboRuntime[1].active == true);
  assert(bleKeyboard.pressedKeys.size() == 1);
  assert(bleKeyboard.pressedKeys[0] == KEY_LEFT_CTRL);

  // Release J -> Releases Ctrl Modifier
  keyState[2][1] = false;
  checkUserCombos();
  assert(comboRuntime[1].active == false);
  assert(bleKeyboard.pressedKeys.empty());
}

// -----------------------------------------------------------------------------
// Test 6: Settings, Debounce & Device Name Persistence (Finding #10)
// -----------------------------------------------------------------------------
TEST(test_settings_and_nvs) {
  resetState();

  handleConfigCommand("SET_DEV_NAME Custom Dactyl", false);
  assert(deviceName == "Custom Dactyl");

  handleConfigCommand("SET_DEBOUNCE 12", false);
  assert(debounceMs == 12);

  handleConfigCommand("SET_COMBO_TIMEOUT 55", false);
  assert(comboTimeoutMs == 55);

  handleConfigCommand("SET_STANDBY 10", false);
  assert(standbyTimeoutMinutes == 10);

  handleConfigCommand("SET_SLEEP 45", false);
  assert(deepSleepTimeoutMinutes == 45);

  // Verify GET_INFO outputs updated settings in JSON
  mockChar.notifications.clear();
  handleConfigCommand("GET_INFO", false);
  assert(!mockChar.notifications.empty());
  std::string info = mockChar.value;
  assert(info.find("\"name\":\"Custom Dactyl\"") != std::string::npos);
  assert(info.find("\"debounce_ms\":12") != std::string::npos);
  assert(info.find("\"combo_timeout_ms\":55") != std::string::npos);
  assert(info.find("\"standby_timeout\":10") != std::string::npos);
  assert(info.find("\"sleep_timeout\":45") != std::string::npos);
}

// -----------------------------------------------------------------------------
// Test 7: Non-blocking Serial Accumulator & Batch Transfer (Finding #2 & #13)
// -----------------------------------------------------------------------------
TEST(test_serial_accumulator_drain) {
  resetState();

  // Feed fragmented chunks into serial stream
  Serial.feed("SET_K 0 1 ");
  Serial.feed("2 45\r\nSET_K 0 ");
  Serial.feed("1 3 46\n");

  static String serialRxBuf = "";
  while (Serial.available()) {
    feedSerialChar((char)Serial.read(), serialRxBuf);
  }

  assert(KEYMAP[0][1][2] == 45);
  assert(KEYMAP[0][1][3] == 46);

  // Test batch stream of 336 commands (full 8-layer x 42 keys sync)
  std::string batch = "";
  for (int l = 0; l < 8; l++) {
    for (int r = 0; r < 6; r++) {
      for (int c = 0; c < 7; c++) {
        batch += "SET_K " + std::to_string(l) + " " + std::to_string(r) + " " + std::to_string(c) + " " + std::to_string(l * 100 + r * 10 + c) + "\n";
      }
    }
  }
  batch += "SAVE_NVS\n";
  Serial.feed(batch);

  while (Serial.available()) {
    feedSerialChar((char)Serial.read(), serialRxBuf);
  }

  // Verify all 336 keys arrived accurately
  for (int l = 0; l < 8; l++) {
    for (int r = 0; r < 6; r++) {
      for (int c = 0; c < 7; c++) {
        uint16_t expected = l * 100 + r * 10 + c;
        assert(KEYMAP[l][r][c] == expected);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Test 8: Isolated Config Mode Boot via RTC Magic Flag (BLE Bond Protection)
// -----------------------------------------------------------------------------
TEST(test_rtc_config_mode_boot_isolation) {
  resetState();
  uint32_t rtcConfigModeMagic = 0;

  // 1. Cold boot (ESP_RST_POWERON) even with garbage/magic in RTC RAM must boot into Normal Keyboard Mode
  rtcConfigModeMagic = CONFIG_MODE_MAGIC;
  esp_reset_reason_t reason = ESP_RST_POWERON;
  bool bootIntoConfig = shouldBootIntoConfigMode(reason, rtcConfigModeMagic);
  rtcConfigModeMagic = 0;
  isConfigMode = bootIntoConfig;
  assert(isConfigMode == false);
  assert(rtcConfigModeMagic == 0);

  // 2. enterConfigMode() sets rtcConfigModeMagic = CONFIG_MODE_MAGIC and triggers ESP_RST_SW
  rtcConfigModeMagic = CONFIG_MODE_MAGIC;
  reason = ESP_RST_SW;
  bootIntoConfig = shouldBootIntoConfigMode(reason, rtcConfigModeMagic);
  rtcConfigModeMagic = 0; // Cleared immediately on boot so subsequent resets return to Keyboard Mode
  isConfigMode = bootIntoConfig;
  assert(isConfigMode == true);
  assert(rtcConfigModeMagic == 0);

  // 3. Subsequent software reset (exitConfigMode or crash) boots back into Normal Keyboard Mode
  reason = ESP_RST_SW;
  bootIntoConfig = shouldBootIntoConfigMode(reason, rtcConfigModeMagic);
  isConfigMode = bootIntoConfig;
  assert(isConfigMode == false);
}

// -----------------------------------------------------------------------------
// Test 9: Simulated Mouse Actions and Combos
// -----------------------------------------------------------------------------
TEST(test_mouse_actions_and_combos) {
  resetState();

  // 1. ADD_COMBO for Left Click (J+K -> ACT_MOUSE_LEFT, behavior 0 = KEY_PRESS)
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 304", false); // 0x130 = 304 (ACT_MOUSE_LEFT)
  assert(numCombos == 1);
  assert(userCombos[0].action == ACT_MOUSE_LEFT);

  // 2. ADD_COMBO for Scroll Up (J+L -> ACT_MOUSE_WHEEL_UP, behavior 0)
  handleConfigCommand("ADD_COMBO 2 1 2 3 0 307", false); // 0x133 = 307 (ACT_MOUSE_WHEEL_UP)
  assert(numCombos == 2);
  assert(userCombos[1].action == ACT_MOUSE_WHEEL_UP);

  // 3. ADD_COMBO for Right Click Hold (J+M -> ACT_MOUSE_RIGHT, behavior 1 = MODIFIER_HOLD)
  handleConfigCommand("ADD_COMBO 2 1 2 4 1 305", false); // 0x131 = 305 (ACT_MOUSE_RIGHT)
  assert(numCombos == 3);
  assert(userCombos[2].action == ACT_MOUSE_RIGHT);

  // Trigger Combo 0: Left Click
  setMillis(1000);
  keyState[2][1] = true;
  keyPressTime[2][1] = 1000;
  keyState[2][2] = true;
  keyPressTime[2][2] = 1010;
  checkUserCombos();
  assert(comboRuntime[0].active == true);
  assert(bleKeyboard.clickedMouseButtons.size() == 1);
  assert(bleKeyboard.clickedMouseButtons[0] == MOUSE_BUTTON_LEFT);

  // Release Combo 0
  keyState[2][1] = false;
  keyState[2][2] = false;
  checkUserCombos();
  assert(comboRuntime[0].active == false);

  // Trigger Combo 1: Wheel Up
  setMillis(2000);
  keyState[2][1] = true;
  keyPressTime[2][1] = 2000;
  keyState[2][3] = true;
  keyPressTime[2][3] = 2015;
  checkUserCombos();
  assert(comboRuntime[1].active == true);
  assert(bleKeyboard.mouseScrolls.size() == 1);
  assert(bleKeyboard.mouseScrolls[0] == 1);

  // Release Combo 1
  keyState[2][1] = false;
  keyState[2][3] = false;
  checkUserCombos();
  assert(comboRuntime[1].active == false);

  // Trigger Combo 2: Right Click Hold
  setMillis(3000);
  keyState[2][1] = true;
  keyPressTime[2][1] = 3000;
  keyState[2][4] = true;
  keyPressTime[2][4] = 2995;
  checkUserCombos();
  assert(comboRuntime[2].active == true);
  assert((bleKeyboard.mouseButtons & MOUSE_BUTTON_RIGHT) != 0);

  // Release Combo 2
  keyState[2][1] = false;
  keyState[2][4] = false;
  checkUserCombos();
  assert(comboRuntime[2].active == false);
  assert((bleKeyboard.mouseButtons & MOUSE_BUTTON_RIGHT) == 0);
}

// -----------------------------------------------------------------------------
// Test 10: NVS-Schreibfehler werden als ERR gemeldet statt als OK
// -----------------------------------------------------------------------------
TEST(test_nvs_write_failure_reports_error) {
  resetState();
  Preferences::failWrites = true;

  mockChar.notifications.clear();
  handleConfigCommand("SAVE_NVS", false);
  assert(mockChar.value == "ERR NVS SAVE_NVS");

  handleConfigCommand("SET_KEY 0 0 0 42", false);
  assert(mockChar.value == "ERR NVS SET_KEY");

  handleConfigCommand("SAVE_COMBOS", false);
  assert(mockChar.value == "ERR NVS SAVE_COMBOS");

  handleConfigCommand("SET_DEV_NAME Broken", false);
  assert(mockChar.value == "ERR NVS SET_DEV_NAME");

  // ERR enthält den Layer-Index, auf den die App-Bestätigung ("SET_NAME <l>") wartet
  handleConfigCommand("SET_NAME 3 Broken", false);
  assert(mockChar.value == "ERR NVS SET_NAME 3");
  assert(layerNames[3] == "Numpad");
  assert(deviceName != "Broken"); // RAM-Zustand bleibt beim Fehler unverändert

  Preferences::failWrites = false;
  handleConfigCommand("SAVE_NVS", false);
  assert(mockChar.value == "OK SAVE_NVS");

  // Leere Combo-Liste ist kein Fehler
  handleConfigCommand("CLEAR_COMBOS", false);
  handleConfigCommand("SAVE_COMBOS", false);
  assert(mockChar.value == "OK SAVE_COMBOS");
}

// -----------------------------------------------------------------------------
// Test 11: Busy-Mutex und ungültige Argumente werden gemeldet
// -----------------------------------------------------------------------------
TEST(test_busy_and_invalid_args_report_error) {
  resetState();
  _mock_mutex_busy = true;
  handleConfigCommand("SET_K 0 0 0 42", false);
  assert(KEYMAP[0][0][0] == 0);
  assert(mockChar.value == "ERR BUSY SET_K 0 0 0 42");
  _mock_mutex_busy = false;

  handleConfigCommand("SET_K 9 0 0 42", false);
  assert(mockChar.value == "ERR ARGS SET_K 9 0 0 42");
  handleConfigCommand("SET_DEBOUNCE 99", false);
  assert(mockChar.value == "ERR ARGS SET_DEBOUNCE 99");
  handleConfigCommand("ADD_COMBO 2 1 2 2 7 177", false);
  assert(mockChar.value == "ERR ARGS ADD_COMBO 2 1 2 2 7 177");
  assert(numCombos == 0);
}

// -----------------------------------------------------------------------------
// Test 12: Mod-Tap (Tap-Aktion + Halte-Aktion) über SET_K / SET_KEY
// -----------------------------------------------------------------------------
TEST(test_mod_tap_tap_and_hold) {
  resetState();
  // R5C3: Tap = Space, Hold = Left Ctrl
  handleConfigCommand("SET_K 0 5 3 32 128", false);
  assert(KEYMAP[0][5][3] == ' ');
  assert(HOLDMAP[0][5][3] == KEY_LEFT_CTRL);
  // SET_K ohne Hold-Argument bleibt kompatibel und löscht die Halte-Aktion
  HOLDMAP[0][2][0] = KEY_LEFT_ALT;
  handleConfigCommand("SET_K 0 2 0 104", false);
  assert(HOLDMAP[0][2][0] == 0);

  // Fall A: Kurzer Tap (< TAPPING_TERM_MS) sendet Space als Press + Release
  setMillis(1000);
  keyState[5][3] = true;
  onMatrixKeyChange(5, 3, true);
  assert(bleKeyboard.pressedKeys.empty()); // Noch unentschieden
  setMillis(1100);
  processDeferredKeys(millis());
  assert(bleKeyboard.pressedKeys.empty());
  keyState[5][3] = false;
  onMatrixKeyChange(5, 3, false);
  assert(bleKeyboard.pressedKeys.empty()); // Space gedrückt und wieder losgelassen
  assert(tapHold[5][3].pending == false);

  // Fall B: Halten >= TAPPING_TERM_MS aktiviert Ctrl, Loslassen sendet kein Space
  setMillis(2000);
  keyState[5][3] = true;
  onMatrixKeyChange(5, 3, true);
  setMillis(2000 + TAPPING_TERM_MS);
  processDeferredKeys(millis());
  assert(bleKeyboard.pressedKeys.size() == 1);
  assert(bleKeyboard.pressedKeys[0] == KEY_LEFT_CTRL);
  keyState[5][3] = false;
  onMatrixKeyChange(5, 3, false);
  assert(bleKeyboard.pressedKeys.empty());

  // Fall C: Andere Taste innerhalb des Tapping-Terms entscheidet sofort Hold (Ctrl + H)
  KEYMAP[0][2][0] = 'h';
  setMillis(3000);
  keyState[5][3] = true;
  onMatrixKeyChange(5, 3, true);
  setMillis(3050);
  keyState[2][0] = true;
  onMatrixKeyChange(2, 0, true);
  assert(bleKeyboard.pressedKeys.size() == 2);
  assert(bleKeyboard.pressedKeys[0] == KEY_LEFT_CTRL);
  assert(bleKeyboard.pressedKeys[1] == 'h');
  keyState[2][0] = false;
  onMatrixKeyChange(2, 0, false);
  keyState[5][3] = false;
  onMatrixKeyChange(5, 3, false);
  assert(bleKeyboard.pressedKeys.empty());

  // Fall D: Layer-Tap (Tap = Esc, Hold = MO_1)
  handleConfigCommand("SET_K 0 5 6 177 257", false);
  setMillis(4000);
  keyState[5][6] = true;
  onMatrixKeyChange(5, 6, true);
  setMillis(4000 + TAPPING_TERM_MS);
  processDeferredKeys(millis());
  assert(getActiveLayer() == 1);
  keyState[5][6] = false;
  onMatrixKeyChange(5, 6, false);
  assert(getActiveLayer() == 0);

  // GET_CONFIG liefert die Halte-Aktionen als HOLD_DATA
  mockChar.notifications.clear();
  handleConfigCommand("GET_CONFIG", false);
  bool foundHold = false;
  for (const auto& n : mockChar.notifications) {
    if (n.rfind("HOLD_DATA:{\"l\":0,", 0) == 0 && n.find("128") != std::string::npos) foundHold = true;
  }
  assert(foundHold);
  assert(mockChar.notifications.back() == "CONFIG_SYNC_DONE");
}

// -----------------------------------------------------------------------------
// GET_CONFIG liefert Combos, Tastenpaare und Makros
// -----------------------------------------------------------------------------
TEST(test_get_config_sends_combos_pairs_macros) {
  resetState();
  loadKeymapFromNVS();
  handleConfigCommand("CLEAR_COMBOS", false);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
  handleConfigCommand("CLEAR_PAIRS", false);
  handleConfigCommand("ADD_PAIR 130 46", false);
  handleConfigCommand("CLEAR_MACROS", false);
  handleConfigCommand("ADD_MACRO", false);
  handleConfigCommand("ADD_MACRO_STEP 1 97 0", false);
  handleConfigCommand("ADD_MACRO_STEP 4 0 250", false);
  handleConfigCommand("ADD_MACRO", false);

  mockChar.notifications.clear();
  handleConfigCommand("GET_CONFIG", false);
  bool cc = false, combo = false, pc = false, pair = false, count = false, macro0 = false, macro1 = false;
  for (const auto& n : mockChar.notifications) {
    if (n == "COMBO_COUNT:1") cc = true;
    if (n == "COMBO_DATA:{\"o\":0,\"e\":[[2,1,2,2,0,177,255]]}") combo = true;
    if (n == "PAIR_COUNT:1") pc = true;
    if (n == "PAIR_DATA:{\"o\":0,\"e\":[[130,46]]}") pair = true;
    if (n == "MACRO_COUNT:2") count = true;
    if (n == "MACRO_DATA:{\"i\":0,\"n\":2,\"o\":0,\"s\":[[1,97,0],[4,0,250]]}") macro0 = true;
    if (n == "MACRO_DATA:{\"i\":1,\"n\":0,\"o\":0,\"s\":[]}") macro1 = true;
  }
  assert(cc && combo && pc && pair && count && macro0 && macro1);
  assert(mockChar.notifications.back() == "CONFIG_SYNC_DONE");

  // Leere Listen: nur die Zähler
  handleConfigCommand("CLEAR_COMBOS", false);
  handleConfigCommand("CLEAR_PAIRS", false);
  handleConfigCommand("CLEAR_MACROS", false);
  mockChar.notifications.clear();
  handleConfigCommand("GET_CONFIG", false);
  bool empty = false, noData = true;
  for (const auto& n : mockChar.notifications) {
    if (n == "COMBO_COUNT:0") empty = true;
    if (n.rfind("COMBO_DATA", 0) == 0 || n.rfind("PAIR_DATA", 0) == 0 || n.rfind("MACRO_DATA", 0) == 0) noData = false;
  }
  assert(empty && noData);
}

// Größter Fall: 16 Combos, 16 Tastenpaare, 16 Makros zu 32 Schritten. Jede Zeile bleibt kurz, nichts geht verloren.
TEST(test_get_config_lines_stay_short_at_maximum) {
  resetState();
  loadKeymapFromNVS();
  handleConfigCommand("CLEAR_COMBOS", false);
  for (int i = 0; i < 16; i++) handleConfigCommand("ADD_COMBO 5 6 4 5 2 65535", false);
  handleConfigCommand("CLEAR_PAIRS", false);
  for (int i = 0; i < 16; i++) handleConfigCommand("ADD_PAIR 255 255", false);
  handleConfigCommand("CLEAR_MACROS", false);
  for (int i = 0; i < 16; i++) {
    handleConfigCommand("ADD_MACRO", false);
    for (int j = 0; j < 32; j++) handleConfigCommand("ADD_MACRO_STEP 4 0 5000", false);
  }
  for (int i = 0; i < 16; i++) userMacroRepeat[i] = true;   // "r":1 verlängert jede Zeile
  assert(numCombos == 16 && numKeyPairs == 16 && numMacros == 16);

  mockChar.notifications.clear();
  handleConfigCommand("GET_CONFIG", false);
  size_t longest = 0;
  int comboEntries = 0, pairEntries = 0, steps = 0;
  auto countOf = [](const std::string& n, const std::string& needle) {
    int c = 0;
    for (size_t p = n.find(needle); p != std::string::npos; p = n.find(needle, p + 1)) c++;
    return c;
  };
  for (const auto& n : mockChar.notifications) {
    if (n.rfind("LAYER_DATA", 0) == 0 || n.rfind("HOLD_DATA", 0) == 0 || n.rfind("DTAP_DATA", 0) == 0 || n.rfind("TERM_DATA", 0) == 0) continue;
    if (n.size() > longest) longest = n.size();
    if (n.rfind("COMBO_DATA", 0) == 0) comboEntries += countOf(n, "],[") + 1;
    if (n.rfind("PAIR_DATA", 0) == 0) pairEntries += countOf(n, "],[") + 1;
    if (n.rfind("MACRO_DATA", 0) == 0) steps += countOf(n, "],[") + 1;
  }
  assert(longest > 0 && longest <= 160);
  assert(comboEntries == 16 && pairEntries == 16 && steps == 16 * 32);
}

// -----------------------------------------------------------------------------
// Test 12b: Media-Keys & Mac Globe (Consumer-Report-Bits aus DactylKeycodes.h)
// -----------------------------------------------------------------------------
TEST(test_media_and_globe_keys) {
  resetState();
  // Globe = Bit 10 (AC Next Keyboard Layout Select 0x029D im Report-Descriptor)
  assert(mediaBits(KEY_MEDIA_GLOBE) == 0x0400);
  assert(mediaBits(KEY_MEDIA_PLAY_PAUSE) == 0x0008);

  KEYMAP[0][1][1] = 0x127; // MAC_GLOBE
  keyState[1][1] = true;
  onMatrixKeyChange(1, 1, true);
  assert(bleKeyboard.pressedMediaKeys.size() == 1);
  assert(bleKeyboard.pressedMediaKeys[0] == 0x0400);
  keyState[1][1] = false;
  onMatrixKeyChange(1, 1, false);
  assert(bleKeyboard.pressedMediaKeys.empty()); // Globe wird beim Loslassen freigegeben

  KEYMAP[0][1][2] = 0x120; // MEDIA_PLAY_PAUSE
  keyState[1][2] = true;
  onMatrixKeyChange(1, 2, true);
  assert(bleKeyboard.writtenMediaKeys.size() == 1);
  assert(bleKeyboard.writtenMediaKeys[0] == 0x0008);
  keyState[1][2] = false;
  onMatrixKeyChange(1, 2, false);
}

// -----------------------------------------------------------------------------
// Test 13: Transparente Taste mit Halte-Aktion fällt auf Layer 0 zurück
// -----------------------------------------------------------------------------
TEST(test_resolve_key_actions_fallback) {
  resetState();
  KEYMAP[0][1][1] = 'u';
  HOLDMAP[0][1][1] = KEY_LEFT_SHIFT;
  uint16_t tap, hold;
  resolveKeyActions(2, 1, 1, tap, hold);
  assert(tap == 'u' && hold == KEY_LEFT_SHIFT);

  // Nur Halte-Aktion ohne Tap verhält sich wie eine normale Taste
  HOLDMAP[3][1][1] = KEY_LEFT_ALT;
  resolveKeyActions(3, 1, 1, tap, hold);
  assert(tap == KEY_LEFT_ALT && hold == 0);
}

// -----------------------------------------------------------------------------
// Test 14: Release nach Ablauf des Tapping-Terms ohne vorherigen Tick ist Hold, kein Tap
// -----------------------------------------------------------------------------
TEST(test_tap_hold_release_after_term_is_hold) {
  resetState();
  KEYMAP[0][5][3] = ' ';
  HOLDMAP[0][5][3] = KEY_LEFT_CTRL;
  setMillis(1000);
  keyState[5][3] = true;
  onMatrixKeyChange(5, 3, true);
  setMillis(1190);
  processDeferredKeys(millis()); // letzter Tick vor dem Tapping-Term
  assert(bleKeyboard.pressedKeys.empty());
  // Release wird im nächsten Scan (210 ms) vor processDeferredKeys() verarbeitet
  setMillis(1210);
  keyState[5][3] = false;
  onMatrixKeyChange(5, 3, false);
  assert(bleKeyboard.writtenKeys.empty());
  assert(bleKeyboard.pressedKeys.empty()); // Ctrl gedrückt und wieder losgelassen, kein Space
  for (const auto& n : Serial.outputLines) {
    assert(n.find("\"key\":\" \"") == std::string::npos); // kein Space-KEY_PRESS
  }
}

// -----------------------------------------------------------------------------
// Test 15: Erzwungener Hold einer Combo-Kandidatentaste erreicht den Host vor der Folgetaste
// -----------------------------------------------------------------------------
TEST(test_forced_hold_on_combo_candidate_reaches_host_first) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false); // J + K -> Esc
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;                      // J: Tap j / Hold Ctrl
  KEYMAP[0][2][0] = 'h';                                 // H: kein Combo-Kandidat
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  setMillis(1020); // innerhalb comboTimeoutMs (40 ms)
  keyState[2][0] = true;
  onMatrixKeyChange(2, 0, true);
  assert(bleKeyboard.pressedKeys.size() == 2);
  assert(bleKeyboard.pressedKeys[0] == KEY_LEFT_CTRL); // Modifier zuerst
  assert(bleKeyboard.pressedKeys[1] == 'h');
  keyState[2][0] = false;
  onMatrixKeyChange(2, 0, false);
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.pressedKeys.empty());
}

// -----------------------------------------------------------------------------
// Test 16: Eine ausgelöste Combo verwirft die Mod-Tap-Entscheidung ihrer Tasten
// -----------------------------------------------------------------------------
TEST(test_combo_cancels_member_tap_hold) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false); // J + K -> Esc
  KEYMAP[0][2][1] = 'j';
  KEYMAP[0][2][2] = 'k';
  HOLDMAP[0][2][2] = 0x101;                              // K: Hold MO_1
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  setMillis(1010);
  keyState[2][2] = true;
  onMatrixKeyChange(2, 2, true);
  checkUserCombos();
  assert(comboRuntime[0].active);
  assert(bleKeyboard.writtenKeys.size() == 1 && bleKeyboard.writtenKeys[0] == KEY_ESC);
  // Beide Tasten 200 ms weiter halten: Layer 1 darf NICHT aktiv werden
  setMillis(1000 + TAPPING_TERM_MS + 20);
  processDeferredKeys(millis());
  assert(getActiveLayer() == 0);
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  keyState[2][2] = false;
  onMatrixKeyChange(2, 2, false);
  checkUserCombos();
  assert(getActiveLayer() == 0);
  assert(bleKeyboard.writtenKeys.size() == 1); // keine zusätzliche Einzeltaste
  assert(bleKeyboard.pressedKeys.empty());
}

// -----------------------------------------------------------------------------
// Test 17: Gespeicherte leere Combo-Liste überlebt den Neustart
// -----------------------------------------------------------------------------
TEST(test_empty_combo_list_persists_across_reboot) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
  handleConfigCommand("SAVE_COMBOS", false);
  handleConfigCommand("CLEAR_COMBOS", false);
  handleConfigCommand("SAVE_COMBOS", false);
  assert(mockChar.value == "OK SAVE_COMBOS");
  // Neustart simulieren: einkompilierte Default-Combo ist wieder im RAM
  numCombos = 1;
  loadKeymapFromNVS();
  assert(numCombos == 0);
}

// -----------------------------------------------------------------------------
// Test 18: Keyboard-Report-Descriptor deckt alle gesendeten Usages ab (inkl. F13..F24)
// -----------------------------------------------------------------------------
// Liefert den Data-Wert des n-ten Vorkommens eines 1-Byte-Items im Keyboard-Collection-Abschnitt
// Liefert den Data-Wert des ersten 1-Byte-Items `prefix` im Key-Array der Keyboard-Collection.
// Das Key-Array beginnt semantisch mit REPORT_COUNT(6) (6 Scancodes) und endet mit dem INPUT-Item.
static int keyArrayDescriptorItem(uint8_t prefix) {
  bool inKeyArray = false;
  for (size_t i = 0; i + 1 < sizeof(_compositeReportDescriptor); i++) {
    uint8_t b = _compositeReportDescriptor[i];
    uint8_t data = _compositeReportDescriptor[i + 1];
    if (b == END_COLLECTION(0)) break; // Ende der Keyboard-Collection
    if (b == REPORT_COUNT(1) && data == 0x06) inKeyArray = true;
    else if (inKeyArray && b == prefix) return data;
    else if (inKeyArray && b == HIDINPUT(1)) break;
    if ((b & 0x03) == 1) i++; // 1-Byte-Item: Datenbyte überspringen
  }
  return -1;
}

TEST(test_keyboard_descriptor_covers_f13_to_f24) {
  int logicalMax = keyArrayDescriptorItem(LOGICAL_MAXIMUM(1));
  int usageMax = keyArrayDescriptorItem(USAGE_MAXIMUM(1));
  assert(logicalMax >= 0 && usageMax >= 0); // Key-Array gefunden
  // press() sendet Sondertasten als Usage (code - 136); F24 = 0xFB -> 0x73
  int highestUsage = KEY_F24 - 136;
  assert(highestUsage == 0x73);
  assert(logicalMax >= highestUsage);
  assert(usageMax >= highestUsage);
  // Auch alle anderen Sondertasten bis 0xFB liegen im Bereich
  assert(KEY_F13 - 136 == 0x68);
  // ISO-Taste (< > auf deutschem macOS): 0xEC -> Usage 0x64
  assert(KEY_NON_US_BACKSLASH - 136 == 0x64);
  assert(logicalMax >= KEY_NON_US_BACKSLASH - 136);
}

// -----------------------------------------------------------------------------
// Test 19: Erzwungener Hold einer Combo-Taste sendet kein Modifier-Tippen, wenn die Combo gewinnt
// -----------------------------------------------------------------------------
TEST(test_forced_hold_does_not_leak_modifier_when_combo_fires) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false); // J + K -> Esc
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;                      // J: Tap j / Hold Ctrl
  KEYMAP[0][2][2] = 'k';
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  setMillis(1015);
  keyState[2][2] = true;
  onMatrixKeyChange(2, 2, true); // erzwingt J-Hold, Partner K ist im Combo-Fenster gedrückt
  checkUserCombos();
  assert(comboRuntime[0].active);
  assert(bleKeyboard.writtenKeys.size() == 1 && bleKeyboard.writtenKeys[0] == KEY_ESC);
  for (uint8_t k : bleKeyboard.pressHistory) assert(k != KEY_LEFT_CTRL); // kein verirrtes Ctrl
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  keyState[2][2] = false;
  onMatrixKeyChange(2, 2, false);
  checkUserCombos();
  assert(bleKeyboard.pressedKeys.empty());
}

// -----------------------------------------------------------------------------
// Test 20: Combo nimmt eine bereits aktive Halte-Aktion (MO-Layer) eines Mitglieds zurück
// -----------------------------------------------------------------------------
TEST(test_combo_unwinds_active_member_hold) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false); // J + K -> Esc
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = 0x101;                              // J: Hold MO_1
  KEYMAP[0][2][2] = 'k';
  KEYMAP[0][2][0] = 'h';
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  setMillis(1010);
  keyState[2][0] = true;
  onMatrixKeyChange(2, 0, true);            // H erzwingt J-Hold -> Layer 1 aktiv
  assert(getActiveLayer() == 1);
  assert(tapHold[2][1].holdActive);
  setMillis(1030);
  keyState[2][2] = true;
  onMatrixKeyChange(2, 2, true);
  checkUserCombos();                        // J + K innerhalb 40 ms -> Combo gewinnt
  assert(comboRuntime[0].active);
  assert(!tapHold[2][1].holdActive);
  assert(getActiveLayer() == 0);            // MO_1 zurückgenommen
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert(getActiveLayer() == 0);
}

// -----------------------------------------------------------------------------
// Test 21: Erzwungener Maus-Hold einer Combo-Kandidatentaste wird gedrückt und wieder gelöst
// -----------------------------------------------------------------------------
TEST(test_forced_mouse_hold_on_combo_candidate) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false); // J + K -> Esc
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = ACT_MOUSE_LEFT;                     // J: Hold Linksklick
  KEYMAP[0][2][0] = 'h';
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  setMillis(1020);
  keyState[2][0] = true;
  onMatrixKeyChange(2, 0, true);
  assert((bleKeyboard.mouseButtons & MOUSE_BUTTON_LEFT) != 0);
  keyState[2][0] = false;
  onMatrixKeyChange(2, 0, false);
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert((bleKeyboard.mouseButtons & MOUSE_BUTTON_LEFT) == 0);
  assert(bleKeyboard.clickedMouseButtons.empty()); // kein zusätzlicher Klick beim Loslassen
}

// -----------------------------------------------------------------------------
// Test 22: Combo-Partner außerhalb des Combo-Fensters: erzwungener Hold geht sofort an den Host
// -----------------------------------------------------------------------------
TEST(test_forced_hold_with_partner_outside_window_reaches_host) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false); // J + K -> Esc
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;                      // J: Tap j / Hold Ctrl
  KEYMAP[0][2][2] = 'k';
  KEYMAP[0][2][0] = 'h';
  setMillis(1000);
  keyState[2][2] = true;                                 // Partner K zuerst (gehalten)
  onMatrixKeyChange(2, 2, true);
  setMillis(1100);                                       // J 100 ms später: außerhalb 40 ms
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  setMillis(1110);
  keyState[2][0] = true;
  onMatrixKeyChange(2, 0, true);                         // H erzwingt J-Hold
  checkUserCombos();
  assert(!comboRuntime[0].active);                       // keine Combo
  bool ctrlBeforeH = false;
  for (size_t i = 0; i < bleKeyboard.pressHistory.size(); i++) {
    if (bleKeyboard.pressHistory[i] == KEY_LEFT_CTRL) { ctrlBeforeH = true; break; }
    assert(bleKeyboard.pressHistory[i] != 'h');          // H darf nicht vor Ctrl kommen
  }
  assert(ctrlBeforeH);
}

// -----------------------------------------------------------------------------
// Test 23: Partner im Fenster gedrückt und vor checkUserCombos() gelöst: Hold erreicht den Host
// -----------------------------------------------------------------------------
TEST(test_forced_hold_partner_released_before_combo_check) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false); // J + K -> Esc
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;                      // J: Tap j / Hold Ctrl
  KEYMAP[0][2][2] = 'k';
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  setMillis(1015);
  keyState[2][2] = true;
  onMatrixKeyChange(2, 2, true);                         // erzwingt J-Hold, Partner im Fenster
  keyState[2][2] = false;
  onMatrixKeyChange(2, 2, false);                        // K im selben Scan wieder gelöst
  checkUserCombos();
  assert(!comboRuntime[0].active);                       // Combo greift nicht
  // Spätestens nach comboTimeoutMs sendet processDeferredKeys() die gepufferte Halte-Aktion
  setMillis(1000 + 40 + 5);
  processDeferredKeys(millis());
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == KEY_LEFT_CTRL);
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.pressedKeys.empty());               // Ctrl wird beim Loslassen gelöst
}

// -----------------------------------------------------------------------------
// Test 24: Beliebige Halte-Aktion: Tap A / Halten B
// -----------------------------------------------------------------------------
TEST(test_tap_a_hold_b) {
  resetState();
  handleConfigCommand("SET_K 0 1 1 97 98", false); // Tap 'a' / Hold 'b'
  // Tap
  setMillis(1000);
  keyState[1][1] = true;
  onMatrixKeyChange(1, 1, true);
  setMillis(1050);
  keyState[1][1] = false;
  onMatrixKeyChange(1, 1, false);
  assert(bleKeyboard.pressHistory.size() == 1 && bleKeyboard.pressHistory[0] == 'a');
  // Hold
  setMillis(2000);
  keyState[1][1] = true;
  onMatrixKeyChange(1, 1, true);
  setMillis(2000 + TAPPING_TERM_MS);
  processDeferredKeys(millis());
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == 'b');
  keyState[1][1] = false;
  onMatrixKeyChange(1, 1, false);
  assert(bleKeyboard.pressedKeys.empty());
  assert(bleKeyboard.pressHistory.size() == 2 && bleKeyboard.pressHistory[1] == 'b'); // kein 'a' beim Hold
}

// -----------------------------------------------------------------------------
// Test 25: Reiner Firmware-Flash (gleiche Defaults) behält die Nutzer-Belegung im NVS
// -----------------------------------------------------------------------------
TEST(test_reflash_with_same_defaults_keeps_user_keymap) {
  resetState();
  KEYMAP[0][1][1] = 'u';                      // einkompilierter Default
  loadKeymapFromNVS();                        // erster Start: Defaults -> NVS
  assert(KEYMAP[0][1][1] == 'u');
  handleConfigCommand("SET_KEY 0 1 1 98 99", false); // Nutzer: Tap b / Hold c
  assert(mockChar.value.rfind("OK SET_KEY", 0) == 0);

  // Neustart nach Flash mit unveränderten Defaults (anderer Build-Zeitpunkt egal)
  KEYMAP[0][1][1] = 'u';
  HOLDMAP[0][1][1] = 0;
  loadKeymapFromNVS();
  assert(KEYMAP[0][1][1] == 'b');             // Nutzer-Belegung bleibt
  assert(HOLDMAP[0][1][1] == 'c');
}

// -----------------------------------------------------------------------------
// Test 26: Neue Default-Belegung (Flash aus der App) überschreibt das NVS bewusst
// -----------------------------------------------------------------------------
TEST(test_flash_with_new_defaults_overwrites_keymap) {
  resetState();
  KEYMAP[0][1][1] = 'u';
  loadKeymapFromNVS();
  handleConfigCommand("SET_KEY 0 1 1 98 0", false);

  // "Auf Dactyl flashen": App-Belegung wird als neue Defaults mit neuer ID einkompiliert
  testDefaultsId = 0xBEEF;
  KEYMAP[0][1][1] = 'x';
  HOLDMAP[0][1][1] = KEY_LEFT_ALT;
  loadKeymapFromNVS();
  assert(KEYMAP[0][1][1] == 'x');
  assert(HOLDMAP[0][1][1] == KEY_LEFT_ALT);
  uint32_t fp = keymapDefaultsFingerprint();
  assert(Preferences::uintStore["defaults_fp"] == fp);
  assert(Preferences::uintStore["applied_id"] == 0xBEEF);
  // NVS enthält jetzt die neue Belegung (nächster Start ohne Änderung lädt sie)
  KEYMAP[0][1][1] = 'x';
  HOLDMAP[0][1][1] = KEY_LEFT_ALT;
  loadKeymapFromNVS();
  assert(KEYMAP[0][1][1] == 'x' && HOLDMAP[0][1][1] == KEY_LEFT_ALT);
}

// -----------------------------------------------------------------------------
// Test 26a: Flash aus dem Repository (ID 0) ersetzt nie eine App-Belegung, auch nicht bei anderen Defaults
// -----------------------------------------------------------------------------
TEST(test_repository_flash_id_zero_keeps_app_layout) {
  resetState();
  testDefaultsId = 0xBEEF;                    // Zustand nach "Auf Dactyl flashen"
  KEYMAP[0][1][1] = 'x';
  HOLDMAP[0][1][1] = KEY_LEFT_ALT;
  loadKeymapFromNVS();
  handleConfigCommand("ADD_PAIR 129 46", false);
  handleConfigCommand("SAVE_PAIRS", false);
  assert(Preferences::uintStore["applied_id"] == 0xBEEF);

  // Flash aus dem Repository: ID 0 und andere Defaults
  testDefaultsId = 0;
  KEYMAP[0][1][1] = 'r';
  HOLDMAP[0][1][1] = 0;
  numKeyPairs = 0;
  loadKeymapFromNVS();
  assert(KEYMAP[0][1][1] == 'x');
  assert(HOLDMAP[0][1][1] == KEY_LEFT_ALT);
  assert(preferences.isKey("num_pairs"));
  assert(Preferences::uintStore["applied_id"] == 0xBEEF);
  assert(numKeyPairs == 1);
}

// -----------------------------------------------------------------------------
// Test 26a2: Neue Nicht-Null-ID wirkt einmal; ein BLE-Edit bleibt beim zweiten Start mit gleicher ID
// -----------------------------------------------------------------------------
TEST(test_new_nonzero_id_applies_once) {
  resetState();
  testDefaultsId = 0xBEEF;
  KEYMAP[0][1][1] = 'x';
  loadKeymapFromNVS();
  assert(KEYMAP[0][1][1] == 'x');
  handleConfigCommand("SET_KEY 0 1 1 98 0", false);   // Edit nach dem Flash
  KEYMAP[0][1][1] = 'x';                              // Neustart, gleiche ID
  loadKeymapFromNVS();
  assert(KEYMAP[0][1][1] == 'b');
  testDefaultsId = 0xCAFE;                            // nächster App-Flash
  KEYMAP[0][1][1] = 'y';
  loadKeymapFromNVS();
  assert(KEYMAP[0][1][1] == 'y');
  assert(Preferences::uintStore["applied_id"] == 0xCAFE);
}

// -----------------------------------------------------------------------------
// Test 26a3: Gerät aus der Firmware vor "applied_id" (defaults_fp ohne applied_id)
// -----------------------------------------------------------------------------
TEST(test_legacy_device_without_applied_id) {
  // ID 0: Keymap bleibt, auch bei anderen Defaults; applied_id wird nicht angelegt
  resetState();
  KEYMAP[0][1][1] = 'u';
  loadKeymapFromNVS();
  handleConfigCommand("SET_KEY 0 1 1 98 0", false);
  preferences.begin("dactyl", false);
  preferences.remove("applied_id");
  preferences.end();
  KEYMAP[0][1][1] = 'r';                       // andere Repository-Defaults
  loadKeymapFromNVS();
  assert(KEYMAP[0][1][1] == 'b');
  assert(!preferences.isKey("applied_id"));

  // Gleiche Nicht-Null-ID wie der gespeicherte Fingerprint: Keymap bleibt, applied_id wird nachgetragen
  resetState();
  testDefaultsId = 0xBEEF;
  KEYMAP[0][1][1] = 'x';
  loadKeymapFromNVS();
  handleConfigCommand("SET_KEY 0 1 1 98 0", false);
  preferences.begin("dactyl", false);
  preferences.remove("applied_id");
  preferences.end();
  KEYMAP[0][1][1] = 'x';
  loadKeymapFromNVS();
  assert(KEYMAP[0][1][1] == 'b');
  assert(Preferences::uintStore["applied_id"] == 0xBEEF);

  // Andere Nicht-Null-ID: neue Defaults gelten einmal
  preferences.begin("dactyl", false);
  preferences.remove("applied_id");
  preferences.end();
  testDefaultsId = 0xCAFE;
  KEYMAP[0][1][1] = 'y';
  loadKeymapFromNVS();
  assert(KEYMAP[0][1][1] == 'y');
  assert(Preferences::uintStore["applied_id"] == 0xCAFE);
}

// -----------------------------------------------------------------------------
// Test 26a4: RESET_CONFIG entfernt applied_id; ein fehlgeschlagenes Schreiben wird beim nächsten Start wiederholt
// -----------------------------------------------------------------------------
TEST(test_reset_config_clears_applied_id_and_failed_write_retries) {
  resetState();
  testDefaultsId = 0xBEEF;
  KEYMAP[0][1][1] = 'x';
  loadKeymapFromNVS();
  assert(Preferences::uintStore["applied_id"] == 0xBEEF);
  handleConfigCommand("RESET_CONFIG", false);
  assert(!preferences.isKey("applied_id"));
  KEYMAP[0][1][1] = 'x';
  loadKeymapFromNVS();                         // erster Start nach RESET: Defaults, ID wird gespeichert
  assert(Preferences::uintStore["applied_id"] == 0xBEEF);

  // Neue ID, Schreiben schlägt fehl: applied_id bleibt alt, Wiederholung beim nächsten Start
  testDefaultsId = 0xCAFE;
  KEYMAP[0][1][1] = 'y';
  Preferences::failWrites = true;
  loadKeymapFromNVS();
  Preferences::failWrites = false;
  assert(Preferences::uintStore["applied_id"] == 0xBEEF);
  KEYMAP[0][1][1] = 'y';
  loadKeymapFromNVS();
  assert(KEYMAP[0][1][1] == 'y');
  assert(Preferences::uintStore["applied_id"] == 0xCAFE);
}

// Test 26a5: Schlägt nur das Schreiben von applied_id fehl, bleibt defaults_fp alt und der nächste Start wiederholt
TEST(test_failed_applied_id_write_is_retried) {
  resetState();
  testDefaultsId = 0xBEEF;
  KEYMAP[0][1][1] = 'x';
  loadKeymapFromNVS();
  uint32_t oldFp = Preferences::uintStore["defaults_fp"];
  testDefaultsId = 0xCAFE;
  KEYMAP[0][1][1] = 'y';
  Preferences::failUIntKey = "applied_id";
  loadKeymapFromNVS();
  Preferences::failUIntKey.clear();
  assert(Preferences::uintStore["defaults_fp"] == oldFp);
  assert(Preferences::uintStore["applied_id"] == 0xBEEF);
  KEYMAP[0][1][1] = 'y';
  loadKeymapFromNVS();
  assert(Preferences::uintStore["applied_id"] == 0xCAFE);
  assert(Preferences::uintStore["defaults_fp"] == keymapDefaultsFingerprint());
}

// -----------------------------------------------------------------------------
// Test 26b: Flash aus der App mit UNVERÄNDERTER Belegung überschreibt Geräte-Änderungen trotzdem
// -----------------------------------------------------------------------------
TEST(test_app_flash_with_same_layout_overwrites_device_edits) {
  resetState();
  KEYMAP[0][1][1] = 'u';
  loadKeymapFromNVS();
  handleConfigCommand("SET_KEY 0 1 1 98 0", false); // Änderung direkt auf dem Gerät
  // Flash aus der App: gleiche Belegung, aber neue Kennung
  testDefaultsId = 0x1234;
  KEYMAP[0][1][1] = 'u';
  loadKeymapFromNVS();
  assert(KEYMAP[0][1][1] == 'u');
}

// -----------------------------------------------------------------------------
// Test 26c: Fehlgeschlagenes Schreiben der Defaults speichert keinen Fingerprint (Retry beim nächsten Start)
// -----------------------------------------------------------------------------
TEST(test_failed_defaults_write_is_retried) {
  resetState();
  KEYMAP[0][1][1] = 'u';
  Preferences::failWrites = true;
  loadKeymapFromNVS();
  assert(!preferences.isKey("defaults_fp"));
  Preferences::failWrites = false;
  loadKeymapFromNVS();
  assert(preferences.isKey("defaults_fp"));
  assert(preferences.getBytesLength("keymap") == sizeof(KEYMAP));
}

// -----------------------------------------------------------------------------
// Test 26e: Keymap geschrieben, Holdmap fehlgeschlagen: kein Fingerprint, Holdmap beim nächsten Start ergänzt
// -----------------------------------------------------------------------------
TEST(test_partial_defaults_write_retries_holdmap) {
  resetState();
  HOLDMAP[0][1][1] = KEY_LEFT_ALT;
  Preferences::failBytesKey = "holdmap";
  loadKeymapFromNVS();
  assert(preferences.getBytesLength("keymap") == sizeof(KEYMAP));
  assert(!preferences.isKey("holdmap"));
  assert(!preferences.isKey("defaults_fp"));

  Preferences::failBytesKey.clear();
  HOLDMAP[0][1][1] = KEY_LEFT_ALT;            // Neustart: einkompilierte Defaults im RAM
  loadKeymapFromNVS();
  assert(preferences.getBytesLength("holdmap") == sizeof(HOLDMAP));
  assert(Preferences::uintStore["defaults_fp"] == keymapDefaultsFingerprint());
  assert(HOLDMAP[0][1][1] == KEY_LEFT_ALT);
}

// -----------------------------------------------------------------------------
// Test 26f: Erhaltene Keymap ohne Holdmap, Ergänzen schlägt fehl: kein Fingerprint, Keymap bleibt, Retry
// -----------------------------------------------------------------------------
TEST(test_failed_holdmap_fill_keeps_keymap_and_retries) {
  resetState();
  uint16_t userMap[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
  userMap[0][2][2] = 'q';
  preferences.putBytes("keymap", userMap, sizeof(userMap)); // älteres Schema: keine Holdmap, kein Fingerprint
  HOLDMAP[0][2][2] = KEY_LEFT_ALT;
  Preferences::failBytesKey = "holdmap";
  loadKeymapFromNVS();
  assert(KEYMAP[0][2][2] == 'q');
  assert(!preferences.isKey("holdmap"));
  assert(!preferences.isKey("defaults_fp"));

  Preferences::failBytesKey.clear();
  KEYMAP[0][2][2] = 'k';                      // Neustart: einkompilierte Defaults im RAM
  uint32_t fp = keymapDefaultsFingerprint();  // vor dem Laden: Fingerprint der einkompilierten Defaults
  loadKeymapFromNVS();
  assert(KEYMAP[0][2][2] == 'q');
  assert(preferences.getBytesLength("holdmap") == sizeof(HOLDMAP));
  assert(Preferences::uintStore["defaults_fp"] == fp);
}

// -----------------------------------------------------------------------------
// Test 26d: RESET_CONFIG + Neustart stellt die einkompilierten Defaults wieder her
// -----------------------------------------------------------------------------
TEST(test_reset_config_restores_defaults_after_reboot) {
  resetState();
  KEYMAP[0][1][1] = 'u';
  loadKeymapFromNVS();
  handleConfigCommand("SET_KEY 0 1 1 98 0", false);
  handleConfigCommand("RESET_CONFIG", false);
  assert(mockChar.value == "OK RESET_CONFIG");
  KEYMAP[0][1][1] = 'u';                      // Neustart: einkompilierte Defaults im RAM
  loadKeymapFromNVS();
  assert(KEYMAP[0][1][1] == 'u');
  assert(preferences.isKey("keymap") && preferences.isKey("defaults_fp"));
}

// -----------------------------------------------------------------------------
// Test 27: Migration vom alten fw_build-Schema behält die Nutzer-Belegung
// -----------------------------------------------------------------------------
TEST(test_migration_from_fw_build_keeps_user_keymap) {
  resetState();
  // Zustand einer älteren Firmware: keymap + fw_build, kein defaults_fp
  uint16_t userMap[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
  userMap[0][2][2] = 'q';
  preferences.putBytes("keymap", userMap, sizeof(userMap));
  preferences.putString("fw_build", "Oct 21 2026 10:00:00");

  KEYMAP[0][2][2] = 'k';                      // neue Firmware mit anderem Default
  loadKeymapFromNVS();
  assert(KEYMAP[0][2][2] == 'q');             // Nutzer-Belegung bleibt
  assert(preferences.isKey("defaults_fp"));
  assert(!preferences.isKey("fw_build"));
}

// -----------------------------------------------------------------------------
// Test 27b: Migration vom fw_build-Schema mit einem Flash aus der App übernimmt die App-Belegung
// -----------------------------------------------------------------------------
TEST(test_migration_with_app_flash_uses_new_defaults) {
  resetState();
  uint16_t userMap[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
  userMap[0][2][2] = 'q';
  preferences.putBytes("keymap", userMap, sizeof(userMap));
  preferences.putString("fw_build", "Oct 21 2026 10:00:00");

  testDefaultsId = 0xBEEF;                    // "Auf Dactyl flashen" aus der App
  KEYMAP[0][2][2] = 'k';
  loadKeymapFromNVS();
  assert(KEYMAP[0][2][2] == 'k');
  assert(!preferences.isKey("fw_build"));
}

// -----------------------------------------------------------------------------
// Test 28: Tastenpaar drückt beide Tasten in Reihenfolge und lässt sie umgekehrt los
// -----------------------------------------------------------------------------
TEST(test_key_pair_press_and_release_order) {
  resetState();
  handleConfigCommand("ADD_PAIR 129 46", false);      // Shift + "."
  assert(mockChar.value == "OK ADD_PAIR 0");
  KEYMAP[0][2][1] = ACT_KEY_PAIR_BASE + 0;

  setMillis(1000);
  onMatrixKeyChange(2, 1, true);
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == 129 && bleKeyboard.pressHistory[1] == 46);
  assert(bleKeyboard.pressedKeys.size() == 2);
  assert(keySentToHost[2][1]);

  setMillis(1100);
  onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.pressedKeys.empty());
  assert(!keySentToHost[2][1]);
}

// -----------------------------------------------------------------------------
// Test 28b: Tastenpaar als Halte-Aktion (Mod-Tap) und nicht belegter Index
// -----------------------------------------------------------------------------
TEST(test_key_pair_as_hold_action_and_unknown_index) {
  resetState();
  handleConfigCommand("ADD_PAIR 128 99", false);      // Ctrl + "c"
  KEYMAP[0][2][2] = 'k';
  HOLDMAP[0][2][2] = ACT_KEY_PAIR_BASE + 0;

  setMillis(1000);
  onMatrixKeyChange(2, 2, true);
  setMillis(1000 + TAPPING_TERM_MS);
  processDeferredKeys(1000 + TAPPING_TERM_MS);
  assert(bleKeyboard.pressedKeys.size() == 2);
  assert(bleKeyboard.pressHistory[0] == 128 && bleKeyboard.pressHistory[1] == 99);
  setMillis(1300);
  onMatrixKeyChange(2, 2, false);
  assert(bleKeyboard.pressedKeys.empty());

  // Index 5 ist nicht belegt: kein Tastendruck, kein Absturz
  resetState();
  KEYMAP[0][1][1] = ACT_KEY_PAIR_BASE + 5;
  setMillis(2000);
  onMatrixKeyChange(1, 1, true);
  setMillis(2050);
  onMatrixKeyChange(1, 1, false);
  assert(bleKeyboard.pressHistory.empty());
}

// -----------------------------------------------------------------------------
// Test 28c: ADD_PAIR validiert Argumente und die Obergrenze
// -----------------------------------------------------------------------------
TEST(test_add_pair_validation) {
  resetState();
  handleConfigCommand("ADD_PAIR 0 46", false);
  assert(mockChar.value == "ERR ARGS ADD_PAIR 0 46");
  handleConfigCommand("ADD_PAIR 129 256", false);
  assert(mockChar.value == "ERR ARGS ADD_PAIR 129 256");
  handleConfigCommand("ADD_PAIR 129", false);
  assert(mockChar.value == "ERR ARGS ADD_PAIR 129");
  handleConfigCommand("ADD_PAIR 129 46 7", false);
  assert(mockChar.value == "ERR ARGS ADD_PAIR 129 46 7");
  // Globe, Media und Maus sind gültige Mitglieder
  handleConfigCommand("ADD_PAIR 295 129", false); // Globe + Shift
  assert(mockChar.value == "OK ADD_PAIR 0");
  handleConfigCommand("ADD_PAIR 288 129", false); // Play/Pause + Shift
  assert(mockChar.value == "OK ADD_PAIR 1");
  handleConfigCommand("ADD_PAIR 304 129", false); // Left Click + Shift
  assert(mockChar.value == "OK ADD_PAIR 2");
  handleConfigCommand("CLEAR_PAIRS", false);
  assert(numKeyPairs == 0);
  for (int i = 0; i < MAX_KEY_PAIRS; i++) handleConfigCommand("ADD_PAIR 129 46", false);
  assert(numKeyPairs == MAX_KEY_PAIRS);
  handleConfigCommand("ADD_PAIR 129 46", false);
  assert(mockChar.value == "ERR ARGS ADD_PAIR 129 46");
  handleConfigCommand("CLEAR_PAIRS", false);
  assert(mockChar.value == "OK CLEAR_PAIRS" && numKeyPairs == 0);
}

// -----------------------------------------------------------------------------
// Test 28c2: Tastenpaar mit Mac Globe (Fn) und Maustaste
// -----------------------------------------------------------------------------
TEST(test_key_pair_with_globe_and_mouse) {
  resetState();
  handleConfigCommand("ADD_PAIR 295 129", false); // Globe + Shift
  assert(mockChar.value == "OK ADD_PAIR 0");
  handleConfigCommand("ADD_PAIR 304 129", false); // Left Click + Shift
  assert(mockChar.value == "OK ADD_PAIR 1");

  KEYMAP[0][2][1] = ACT_KEY_PAIR_BASE + 0;
  KEYMAP[0][2][2] = ACT_KEY_PAIR_BASE + 1;

  // Globe + Shift drücken
  setMillis(1000);
  onMatrixKeyChange(2, 1, true);
  assert(mediaBits(KEY_MEDIA_GLOBE) == 0x0400);
  assert(std::find(bleKeyboard.pressedMediaKeys.begin(), bleKeyboard.pressedMediaKeys.end(), 0x0400) != bleKeyboard.pressedMediaKeys.end());
  assert(std::find(bleKeyboard.pressedKeys.begin(), bleKeyboard.pressedKeys.end(), 129) != bleKeyboard.pressedKeys.end());

  // Loslassen
  setMillis(1100);
  onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.pressedMediaKeys.empty());
  assert(bleKeyboard.pressedKeys.empty());

  // Maus Linksklick + Shift drücken
  setMillis(1200);
  onMatrixKeyChange(2, 2, true);
  assert((bleKeyboard.mouseButtons & MOUSE_BUTTON_LEFT) != 0);
  assert(std::find(bleKeyboard.pressedKeys.begin(), bleKeyboard.pressedKeys.end(), 129) != bleKeyboard.pressedKeys.end());

  // Loslassen
  setMillis(1300);
  onMatrixKeyChange(2, 2, false);
  assert(bleKeyboard.mouseButtons == 0);
  assert(bleKeyboard.pressedKeys.empty());
}

// -----------------------------------------------------------------------------
// Test 28c3: Migration von altem 2-Byte-Format in NVS
// -----------------------------------------------------------------------------
TEST(test_key_pair_nvs_legacy_migration) {
  resetState();
  uint8_t legacy[2][2] = { { 129, 46 }, { 131, 52 } };
  preferences.putUChar("num_pairs", 2);
  preferences.putBytes("pairs_data", legacy, sizeof(legacy));

  // Altes NVS-Format: 8 Bytes je Combo (r1, c1, r2, c2, behavior, Padding, action als 16 Bit little endian)
  const uint8_t testCombo[8] = { 2, 1, 2, 2, 0, 0, 'x', 0 };
  preferences.putUChar("num_combos", 1);
  preferences.putBytes("combos_data", testCombo, sizeof(testCombo));

  numKeyPairs = 0;
  numCombos = 0;
  userKeyPairs[0] = { 0, 0 };
  userKeyPairs[1] = { 0, 0 };
  loadKeymapFromNVS();
  assert(numKeyPairs == 2);
  assert(userKeyPairs[0].first == 129 && userKeyPairs[0].second == 46);
  assert(userKeyPairs[1].first == 131 && userKeyPairs[1].second == 52);
  assert(preferences.getBytesLength("pairs_data") == 2 * sizeof(KeyPair));
  assert(numCombos == 1 && userCombos[0].action == 'x');
}

// -----------------------------------------------------------------------------
// Test 28d: SAVE_PAIRS persistiert die Liste, auch eine leere Liste überschreibt die Defaults
// -----------------------------------------------------------------------------
TEST(test_key_pairs_persist_in_nvs) {
  resetState();
  handleConfigCommand("ADD_PAIR 129 46", false);
  handleConfigCommand("ADD_PAIR 131 52", false);
  handleConfigCommand("SAVE_PAIRS", false);
  assert(mockChar.value == "OK SAVE_PAIRS");

  // Neustart: RAM leer, NVS lädt die Paare
  numKeyPairs = 0;
  userKeyPairs[0] = { 0, 0 };
  userKeyPairs[1] = { 0, 0 };
  loadKeymapFromNVS();
  assert(numKeyPairs == 2);
  assert(userKeyPairs[1].first == 131 && userKeyPairs[1].second == 52);

  // Leere Liste gespeichert: einkompilierte Paare gelten beim nächsten Start nicht mehr
  handleConfigCommand("CLEAR_PAIRS", false);
  handleConfigCommand("SAVE_PAIRS", false);
  assert(mockChar.value == "OK SAVE_PAIRS");
  numKeyPairs = 1;
  userKeyPairs[0] = { 129, 46 };
  loadKeymapFromNVS();
  assert(numKeyPairs == 0);
}

// -----------------------------------------------------------------------------
// Tasten-Überschreibungen: Befehle, NVS und GET_CONFIG
// -----------------------------------------------------------------------------
TEST(test_key_override_commands_validate_arguments) {
  resetState();
  handleConfigCommand("CLEAR_OVERRIDES", false);
  assert(mockChar.value == "OK CLEAR_OVERRIDES");
  handleConfigCommand("ADD_OVERRIDE 2 178 212", false);  // Shift + Backspace -> Delete
  assert(mockChar.value == "OK ADD_OVERRIDE 0");
  assert(numKeyOverrides == 1 && userKeyOverrides[0].mods == 2 && userKeyOverrides[0].key == 178 && userKeyOverrides[0].replacement == 212);
  const char* bad[] = {
    "ADD_OVERRIDE 0 178 212",     // keine Modifier-Klasse
    "ADD_OVERRIDE 16 178 212",    // Klasse außerhalb
    "ADD_OVERRIDE 2 0 212",       // Taste 0
    "ADD_OVERRIDE 2 178 0",       // Ersatz 0
    "ADD_OVERRIDE 2 256 212",     // zu groß
    "ADD_OVERRIDE 2 129 212",     // Modifier als Taste
    "ADD_OVERRIDE 2 178 129",     // Modifier als Ersatz
    "ADD_OVERRIDE 2 178",         // zu wenig Argumente
    "ADD_OVERRIDE 2 178 212 1 1", // zu viele Argumente
  };
  for (const char* cmd : bad) {
    handleConfigCommand(cmd, false);
    assert(mockChar.value == std::string("ERR ARGS ") + cmd);
  }
  assert(numKeyOverrides == 1);
  // Obergrenze
  for (int i = 1; i < MAX_KEY_OVERRIDES; i++) handleConfigCommand("ADD_OVERRIDE 2 178 212", false);
  assert(numKeyOverrides == MAX_KEY_OVERRIDES);
  handleConfigCommand("ADD_OVERRIDE 2 178 212", false);
  assert(mockChar.value == "ERR ARGS ADD_OVERRIDE 2 178 212");
}

TEST(test_key_overrides_persist_in_nvs) {
  resetState();
  handleConfigCommand("ADD_OVERRIDE 2 178 212", false);
  handleConfigCommand("ADD_OVERRIDE 9 97 98", false);
  handleConfigCommand("SAVE_OVERRIDES", false);
  assert(mockChar.value == "OK SAVE_OVERRIDES");

  // Neustart: RAM leer, NVS lädt die Liste
  numKeyOverrides = 0;
  userKeyOverrides[0] = { 0, 0, 0, KEY_OVERRIDE_ALL_LAYERS };
  userKeyOverrides[1] = { 0, 0, 0, KEY_OVERRIDE_ALL_LAYERS };
  loadKeymapFromNVS();
  assert(numKeyOverrides == 2);
  assert(userKeyOverrides[1].mods == 9 && userKeyOverrides[1].key == 97 && userKeyOverrides[1].replacement == 98);

  // Leere Liste gespeichert: die einkompilierte Liste gilt beim nächsten Start nicht mehr
  handleConfigCommand("CLEAR_OVERRIDES", false);
  handleConfigCommand("SAVE_OVERRIDES", false);
  assert(mockChar.value == "OK SAVE_OVERRIDES");
  numKeyOverrides = 1;
  userKeyOverrides[0] = { 2, 178, 212, KEY_OVERRIDE_ALL_LAYERS };
  loadKeymapFromNVS();
  assert(numKeyOverrides == 0);
}

TEST(test_key_overrides_in_nvs_with_invalid_entry_are_ignored) {
  resetState();
  // Beschädigte NVS-Daten: eine Überschreibung mit Modifier als Taste
  const uint8_t broken[4] = { 2, 129, 212, 0xFF };
  preferences.begin("dactyl", false);
  preferences.putUChar("num_ovr", 1);
  preferences.putBytes("ovr_v2", broken, sizeof(broken));
  preferences.end();
  numKeyOverrides = 0;
  loadKeymapFromNVS();
  assert(numKeyOverrides == 0);
}

TEST(test_key_overrides_failed_data_write_keeps_old_count_and_reports_error) {
  resetState();
  handleConfigCommand("ADD_OVERRIDE 2 178 212", false);
  handleConfigCommand("SAVE_OVERRIDES", false);
  assert(mockChar.value == "OK SAVE_OVERRIDES");
  // Die Daten schlagen fehl: die Anzahl darf nicht zu neuen Daten passen, der Fehler wird gemeldet
  handleConfigCommand("ADD_OVERRIDE 9 97 98", false);
  Preferences::failBytesKey = "ovr_v2";
  handleConfigCommand("SAVE_OVERRIDES", false);
  Preferences::failBytesKey = "";
  assert(mockChar.value == "ERR NVS SAVE_OVERRIDES");
  numKeyOverrides = 0;
  loadKeymapFromNVS();
  assert(numKeyOverrides == 1 && userKeyOverrides[0].key == 178);
}

TEST(test_get_config_sends_key_overrides) {
  resetState();
  loadKeymapFromNVS();
  handleConfigCommand("CLEAR_OVERRIDES", false);
  handleConfigCommand("ADD_OVERRIDE 2 178 212", false);
  mockChar.notifications.clear();
  handleConfigCommand("GET_CONFIG", false);
  bool count = false, data = false;
  for (const auto& n : mockChar.notifications) {
    if (n == "OVERRIDE_COUNT:1") count = true;
    if (n == "OVERRIDE_DATA:{\"o\":0,\"e\":[[2,178,212,255]]}") data = true;
  }
  assert(count && data);

  // Größter Fall: jede Zeile bleibt kurz, nichts geht verloren
  handleConfigCommand("CLEAR_OVERRIDES", false);
  for (int i = 0; i < MAX_KEY_OVERRIDES; i++) handleConfigCommand("ADD_OVERRIDE 15 255 255", false);
  mockChar.notifications.clear();
  handleConfigCommand("GET_CONFIG", false);
  size_t longest = 0;
  int entries = 0;
  for (const auto& n : mockChar.notifications) {
    if (n.rfind("OVERRIDE_DATA", 0) != 0) continue;
    if (n.size() > longest) longest = n.size();
    for (size_t p = n.find("],["); p != std::string::npos; p = n.find("],[", p + 1)) entries++;
    entries++;
  }
  assert(longest > 0 && longest <= 160);
  assert(entries == MAX_KEY_OVERRIDES);
}

TEST(test_key_override_layer_mask_command_and_nvs) {
  resetState();
  handleConfigCommand("CLEAR_OVERRIDES", false);
  handleConfigCommand("ADD_OVERRIDE 2 178 212 1", false);  // nur Ebene 0
  assert(mockChar.value == "OK ADD_OVERRIDE 0");
  assert(userKeyOverrides[0].layerMask == 1);
  handleConfigCommand("ADD_OVERRIDE 2 178 212", false);    // ohne Maske: alle Ebenen
  assert(userKeyOverrides[1].layerMask == KEY_OVERRIDE_ALL_LAYERS);
  const char* bad[] = { "ADD_OVERRIDE 2 178 212 0", "ADD_OVERRIDE 2 178 212 256", "ADD_OVERRIDE 2 178 212 -1",
                        "ADD_OVERRIDE 2 178 212 1 9" };
  for (const char* b : bad) {
    handleConfigCommand(b, false);
    assert(mockChar.value == std::string("ERR ARGS ") + b);
  }
  assert(numKeyOverrides == 2);
  handleConfigCommand("SAVE_OVERRIDES", false);
  assert(mockChar.value == "OK SAVE_OVERRIDES");
  assert(preferences.isKey("ovr_v2") && !preferences.isKey("ovr_data"));
  numKeyOverrides = 0;
  loadKeymapFromNVS();
  assert(numKeyOverrides == 2 && userKeyOverrides[0].layerMask == 1 && userKeyOverrides[1].layerMask == KEY_OVERRIDE_ALL_LAYERS);
  mockChar.notifications.clear();
  handleConfigCommand("GET_CONFIG", false);
  bool data = false;
  for (const auto& n : mockChar.notifications) {
    if (n == "OVERRIDE_DATA:{\"o\":0,\"e\":[[2,178,212,1],[2,178,212,255]]}") data = true;
  }
  assert(data);
}

TEST(test_key_overrides_legacy_nvs_format_loads_for_all_layers) {
  resetState();
  // Altes Format ovr_data: 3 Bytes je Eintrag, ohne Ebenenmaske
  const uint8_t legacy[6] = { 2, 178, 212, 9, 97, 98 };
  preferences.begin("dactyl", false);
  preferences.putUChar("num_ovr", 2);
  preferences.putBytes("ovr_data", legacy, sizeof(legacy));
  preferences.end();
  numKeyOverrides = 0;
  loadKeymapFromNVS();
  assert(numKeyOverrides == 2);
  assert(userKeyOverrides[0].mods == 2 && userKeyOverrides[0].key == 178 && userKeyOverrides[0].replacement == 212);
  assert(userKeyOverrides[0].layerMask == KEY_OVERRIDE_ALL_LAYERS && userKeyOverrides[1].layerMask == KEY_OVERRIDE_ALL_LAYERS);
  assert(userKeyOverrides[1].mods == 9 && userKeyOverrides[1].key == 97 && userKeyOverrides[1].replacement == 98);
  // Ein ungültiger Maskenwert im neuen Format verwirft die Liste
  const uint8_t badMask[4] = { 2, 178, 212, 0 };
  preferences.begin("dactyl", false);
  preferences.putUChar("num_ovr", 1);
  preferences.putBytes("ovr_v2", badMask, sizeof(badMask));
  preferences.end();
  numKeyOverrides = 0;
  loadKeymapFromNVS();
  assert(numKeyOverrides == 0);
}

TEST(test_new_app_defaults_remove_stored_key_overrides) {
  resetState();
  handleConfigCommand("ADD_OVERRIDE 2 178 212", false);
  handleConfigCommand("SAVE_OVERRIDES", false);
  handleConfigCommand("SAVE_NVS", false);
  // Ein Flash aus der App (ID != 0) bringt die Überschreibungen mit: die gespeicherte Liste fällt weg
  testDefaultsId = 12345;
  numKeyOverrides = 0;
  loadKeymapFromNVS();
  assert(!preferences.isKey("num_ovr") && !preferences.isKey("ovr_v2") && !preferences.isKey("ovr_data"));
  testDefaultsId = 0;
}

// -----------------------------------------------------------------------------
// Test 28e: Tastenpaar als Combo-Kandidat (schneller Tipp und verzögertes Senden)
// -----------------------------------------------------------------------------
TEST(test_key_pair_as_combo_candidate) {
  resetState();
  handleConfigCommand("ADD_PAIR 129 46", false);
  KEYMAP[0][2][1] = ACT_KEY_PAIR_BASE + 0;
  KEYMAP[0][2][2] = 'k';
  numCombos = 1;
  userCombos[0] = { 2, 1, 2, 2, 0, KEY_ESC };

  // Schneller Tipp innerhalb des Combo-Fensters: Paar wird beim Loslassen getippt
  setMillis(1000);
  onMatrixKeyChange(2, 1, true);
  assert(bleKeyboard.pressHistory.empty());
  setMillis(1010);
  onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == 129 && bleKeyboard.pressHistory[1] == 46);
  assert(bleKeyboard.pressedKeys.empty());

  // Halten über das Combo-Fenster hinaus: processDeferredKeys drückt das Paar, Loslassen gibt es frei
  bleKeyboard.pressHistory.clear();
  setMillis(3000);
  keyState[2][1] = true;                         // wie der Matrix-Scan in loop()
  onMatrixKeyChange(2, 1, true);
  setMillis(3000 + comboTimeoutMs);
  processDeferredKeys(3000 + comboTimeoutMs);
  assert(bleKeyboard.pressedKeys.size() == 2);
  assert(keySentToHost[2][1]);
  setMillis(3200);
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.pressedKeys.empty());
}

// -----------------------------------------------------------------------------
// Test 28f: CLEAR_PAIRS während ein Paar gehalten wird lässt keine Taste hängen
// -----------------------------------------------------------------------------
TEST(test_clear_pairs_releases_held_pair) {
  resetState();
  handleConfigCommand("ADD_PAIR 129 46", false);
  KEYMAP[0][2][1] = ACT_KEY_PAIR_BASE + 0;
  setMillis(1000);
  onMatrixKeyChange(2, 1, true);
  assert(bleKeyboard.pressedKeys.size() == 2);

  handleConfigCommand("CLEAR_PAIRS", false);
  handleConfigCommand("ADD_PAIR 131 97", false);   // neues Paar 0 mit anderen Tasten
  assert(bleKeyboard.pressedKeys.empty());

  bleKeyboard.pressHistory.clear();
  setMillis(1100);
  onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.pressedKeys.empty());
  assert(bleKeyboard.pressHistory.empty());         // kein nachträglicher Tipp mit dem neuen Paar
}

// -----------------------------------------------------------------------------
// Test 28g: Neue App-Belegung verwirft alte Tastenpaare aus dem NVS
// -----------------------------------------------------------------------------
TEST(test_app_flash_discards_stored_key_pairs) {
  resetState();
  handleConfigCommand("ADD_PAIR 129 46", false);
  handleConfigCommand("SAVE_PAIRS", false);
  loadKeymapFromNVS();                              // Fingerprint der aktuellen Defaults speichern

  // Flash aus der App: neue Defaults-ID, neue einkompilierte Paare
  testDefaultsId = 0xBEEF;
  numKeyPairs = 1;
  userKeyPairs[0] = { 131, 97 };
  loadKeymapFromNVS();
  assert(numKeyPairs == 1);
  assert(userKeyPairs[0].first == 131 && userKeyPairs[0].second == 97);
  assert(!preferences.isKey("num_pairs"));

  // Reiner Firmware-Flash (gleiche Defaults): gespeicherte Paare bleiben erhalten
  handleConfigCommand("CLEAR_PAIRS", false);
  handleConfigCommand("ADD_PAIR 128 99", false);
  handleConfigCommand("SAVE_PAIRS", false);
  userKeyPairs[0] = { 131, 97 };
  loadKeymapFromNVS();
  assert(userKeyPairs[0].first == 128 && userKeyPairs[0].second == 99);
}

// -----------------------------------------------------------------------------
// Doppel-Tipp (Tap-Dance): Hilfsfunktionen
// -----------------------------------------------------------------------------
static void tapKeyAt(uint8_t r, uint8_t c, unsigned long downAt, unsigned long upAt) {
  setMillis(downAt);
  keyState[r][c] = true;
  onMatrixKeyChange(r, c, true);
  setMillis(upAt);
  keyState[r][c] = false;
  onMatrixKeyChange(r, c, false);
}

static size_t countPresses(uint8_t key) {
  size_t n = 0;
  for (uint8_t k : bleKeyboard.pressHistory) if (k == key) n++;
  return n;
}

// -----------------------------------------------------------------------------
// Test 40: Einzel-Tipp einer Doppel-Tipp-Taste wird erst nach dem Tapping-Term gesendet
// -----------------------------------------------------------------------------
TEST(test_double_tap_single_tap_sent_after_window) {
  resetState();
  handleConfigCommand("SET_K 0 2 1 106 0 177", false); // J: Tap = j, Doppel-Tipp = Esc
  assert(DTAPMAP[0][2][1] == KEY_ESC);
  tapKeyAt(2, 1, 1000, 1050);
  assert(bleKeyboard.pressHistory.empty());            // wartet auf zweiten Tipp
  setMillis(1050 + TAPPING_TERM_MS - 1);
  processDeferredKeys(millis());
  assert(bleKeyboard.pressHistory.empty());
  setMillis(1050 + TAPPING_TERM_MS);
  processDeferredKeys(millis());
  assert(countPresses('j') == 1);
  assert(countPresses(KEY_ESC) == 0);
  assert(bleKeyboard.pressedKeys.empty());
  assert(!doubleTap[2][1].waiting);
}

// -----------------------------------------------------------------------------
// Test 41: Zwei Tipps innerhalb des Tapping-Terms senden nur die Doppel-Tipp-Aktion
// -----------------------------------------------------------------------------
TEST(test_double_tap_sends_dtap_action) {
  resetState();
  handleConfigCommand("SET_K 0 2 1 106 0 177", false);
  tapKeyAt(2, 1, 1000, 1050);
  setMillis(1100);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == KEY_ESC); // gehalten
  setMillis(1500);
  processDeferredKeys(millis());                       // langes Halten wird nicht zu Hold oder Tap
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.pressedKeys.empty());
  setMillis(2000);
  processDeferredKeys(millis());
  assert(countPresses(KEY_ESC) == 1);
  assert(countPresses('j') == 0);
  assert(!doubleTap[2][1].active && !doubleTap[2][1].waiting);
}

// -----------------------------------------------------------------------------
// Test 42: Eine andere Taste sendet den wartenden Tipp vorher (Zeichenreihenfolge bleibt)
// -----------------------------------------------------------------------------
TEST(test_double_tap_flushed_before_other_key) {
  resetState();
  handleConfigCommand("SET_K 0 2 1 106 0 177", false);
  KEYMAP[0][2][0] = 'h';
  tapKeyAt(2, 1, 1000, 1050);
  tapKeyAt(2, 0, 1080, 1120);
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == 'j');
  assert(bleKeyboard.pressHistory[1] == 'h');
  assert(bleKeyboard.pressedKeys.empty());
}

// -----------------------------------------------------------------------------
// Test 42a: Ein Druck der anderen Hälfte sendet den wartenden Tipp vorher (flushAllDoubleTaps)
// -----------------------------------------------------------------------------
TEST(test_double_tap_flush_all_for_other_half) {
  resetState();
  handleConfigCommand("SET_K 0 2 1 106 0 177", false);
  assert(!anyDoubleTapWaiting());
  tapKeyAt(2, 1, 1000, 1050);
  assert(anyDoubleTapWaiting() && bleKeyboard.pressHistory.empty());
  setMillis(1080);
  flushAllDoubleTaps();
  assert(countPresses('j') == 1 && bleKeyboard.pressedKeys.empty());
  assert(!anyDoubleTapWaiting() && !doubleTap[2][1].waiting);
  // Das Fenster ist zu: der Tick sendet nichts mehr
  setMillis(2000);
  processDeferredKeys(millis());
  assert(countPresses('j') == 1 && countPresses(KEY_ESC) == 0);
}

// -----------------------------------------------------------------------------
// Test 42b: Eine später ausgeführte Änderung (Master, SplitLocalDefer) zählt ab ihrer Scan-Zeit
// -----------------------------------------------------------------------------
TEST(test_replayed_press_keeps_scan_time_for_tapping_term) {
  resetState();
  handleConfigCommand("SET_K 0 2 1 106 128 0", false); // J: Tap j, Hold Ctrl
  setMillis(1040);                                     // 40 ms zurückgehalten
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1000 + TAPPING_TERM_MS + 10);              // ab der Scan-Zeit länger als der Tapping-Term
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert(countPresses(KEY_LEFT_CTRL) == 1 && countPresses('j') == 0);
}

// -----------------------------------------------------------------------------
// Test 43: Zweiter Druck nach Ablauf des Fensters, aber vor dem Tick: zwei Einzel-Tipps
// -----------------------------------------------------------------------------
TEST(test_double_tap_late_second_press_is_two_taps) {
  resetState();
  handleConfigCommand("SET_K 0 2 1 106 0 177", false);
  tapKeyAt(2, 1, 1000, 1050);
  tapKeyAt(2, 1, 1050 + TAPPING_TERM_MS, 1050 + TAPPING_TERM_MS + 40);
  assert(countPresses('j') == 1);                      // erster Tipp nachgeholt, zweiter wartet
  assert(doubleTap[2][1].waiting);
  setMillis(2000);
  processDeferredKeys(millis());
  assert(countPresses('j') == 2);
  assert(countPresses(KEY_ESC) == 0);
}

// -----------------------------------------------------------------------------
// Test 44: Tap, Halten und Doppel-Tipp auf derselben Taste
// -----------------------------------------------------------------------------
TEST(test_double_tap_with_hold_action) {
  resetState();
  handleConfigCommand("SET_K 0 2 1 106 128 177", false); // J: Tap j, Hold Ctrl, Doppel-Tipp Esc
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  setMillis(1000 + TAPPING_TERM_MS);
  processDeferredKeys(millis());
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == KEY_LEFT_CTRL);
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.pressedKeys.empty());
  assert(!doubleTap[2][1].waiting);                    // Hold startet kein Doppel-Tipp-Fenster
  setMillis(2000);
  processDeferredKeys(millis());
  assert(countPresses('j') == 0);
}

// -----------------------------------------------------------------------------
// Test 45: Doppel-Tipp-Taste ohne Halte-Aktion verhält sich beim Halten wie eine normale Taste
// -----------------------------------------------------------------------------
TEST(test_double_tap_without_hold_holds_tap_action) {
  resetState();
  handleConfigCommand("SET_K 0 2 1 106 0 177", false);
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  setMillis(1000 + TAPPING_TERM_MS);
  processDeferredKeys(millis());
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == 'j');
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.pressedKeys.empty());
  assert(!doubleTap[2][1].waiting);
}

// -----------------------------------------------------------------------------
// Test 46: Doppel-Tipp ohne Tap-Aktion bleibt wirkungslos, Transparenz berücksichtigt alle drei Aktionen
// -----------------------------------------------------------------------------
TEST(test_double_tap_resolve_actions) {
  resetState();
  uint16_t tap, hold, dtap;
  DTAPMAP[1][2][1] = KEY_ESC;                          // Layer 1: nur Doppel-Tipp, kein Tap
  KEYMAP[0][2][1] = 'j';
  resolveKeyActions(1, 2, 1, tap, hold, dtap);
  assert(tap == 0 && hold == 0 && dtap == 0);          // nicht transparent, ohne Wirkung
  HOLDMAP[1][2][1] = KEY_LEFT_CTRL;                    // Hold ohne Tap: normale Taste, kein Doppel-Tipp
  resolveKeyActions(1, 2, 1, tap, hold, dtap);
  assert(tap == KEY_LEFT_CTRL && hold == 0 && dtap == 0);
  DTAPMAP[0][2][1] = KEY_TAB;
  resolveKeyActions(2, 2, 1, tap, hold, dtap);         // Layer 2 leer: Fallback auf Layer 0
  assert(tap == 'j' && hold == 0 && dtap == KEY_TAB);
}

// -----------------------------------------------------------------------------
// Test 47: Taste ohne Doppel-Tipp-Aktion sendet weiterhin sofort
// -----------------------------------------------------------------------------
TEST(test_key_without_double_tap_is_immediate) {
  resetState();
  handleConfigCommand("SET_K 0 2 1 106 0 0", false);
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == 'j');
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert(!doubleTap[2][1].waiting);
}

// -----------------------------------------------------------------------------
// Test 48: Combo aus zwei Doppel-Tipp-Tasten sendet weder Einzel- noch Doppel-Tipp
// -----------------------------------------------------------------------------
TEST(test_combo_cancels_double_tap_keys) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false); // J + K -> Esc
  handleConfigCommand("SET_K 0 2 1 106 0 9", false);     // J: Doppel-Tipp Tab
  handleConfigCommand("SET_K 0 2 2 107 0 9", false);     // K: Doppel-Tipp Tab
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  setMillis(1010);
  keyState[2][2] = true;
  onMatrixKeyChange(2, 2, true);
  checkUserCombos();
  assert(comboRuntime[0].active);
  setMillis(1050);
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  keyState[2][2] = false;
  onMatrixKeyChange(2, 2, false);
  checkUserCombos();
  setMillis(1600);
  processDeferredKeys(millis());
  assert(countPresses('j') == 0 && countPresses('k') == 0 && countPresses(KEY_TAB) == 0);
  assert(!doubleTap[2][1].waiting && !doubleTap[2][2].waiting);
}

// -----------------------------------------------------------------------------
// Test 48b: Combo nimmt eine aktive (zweiter Tipp, gehalten) Doppel-Tipp-Aktion zurück
// -----------------------------------------------------------------------------
TEST(test_combo_cancels_active_double_tap) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 120", false); // J + K -> x
  handleConfigCommand("SET_K 0 2 1 106 0 257", false);   // J: Doppel-Tipp MO_1
  KEYMAP[0][2][2] = 'k';
  tapKeyAt(2, 1, 1000, 1050);
  setMillis(1100);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);            // zweiter Tipp: MO_1 aktiv
  assert(doubleTap[2][1].active);
  assert(getActiveLayer() == 1);
  setMillis(1110);
  keyState[2][2] = true;
  onMatrixKeyChange(2, 2, true);
  checkUserCombos();                        // J + K innerhalb 40 ms -> Combo gewinnt
  assert(comboRuntime[0].active);
  assert(!doubleTap[2][1].active);
  assert(getActiveLayer() == 0);            // MO_1 zurückgenommen
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert(getActiveLayer() == 0);
}

// -----------------------------------------------------------------------------
// Test 49: SET_KEY / GET_CONFIG übertragen die Doppel-Tipp-Aktion, SAVE_NVS speichert sie
// -----------------------------------------------------------------------------
TEST(test_double_tap_commands_and_persistence) {
  resetState();
  loadKeymapFromNVS();
  handleConfigCommand("SET_KEY 1 2 1 106 128 177", false);
  assert(mockChar.value == "OK SET_KEY 1 2 1 106 128 177");
  assert(DTAPMAP[1][2][1] == KEY_ESC);
  handleConfigCommand("SET_KEY 1 2 1 106 128", false); // ohne dtap: Doppel-Tipp wird gelöscht
  assert(DTAPMAP[1][2][1] == 0);
  handleConfigCommand("SET_K 1 2 1 106 128 177 5", false);
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0);    // zu viele Argumente
  handleConfigCommand("SET_K 1 2 1 106 128 65536", false);
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
  handleConfigCommand("SET_K 1 2 1 106 128 177", false);
  handleConfigCommand("SAVE_NVS", false);
  assert(mockChar.value == "OK SAVE_NVS");

  mockChar.notifications.clear();
  handleConfigCommand("GET_CONFIG", false);
  bool foundDtap = false;
  for (const auto& n : mockChar.notifications) {
    if (n.rfind("DTAP_DATA:{\"l\":1,", 0) == 0 && n.find("[0,177,0,0,0,0,0]") != std::string::npos) foundDtap = true;
  }
  assert(foundDtap);
  assert(mockChar.notifications.back() == "CONFIG_SYNC_DONE");

  KEYMAP[1][2][1] = 0;                                  // Neustart: einkompilierte Defaults im RAM
  HOLDMAP[1][2][1] = 0;
  DTAPMAP[1][2][1] = 0;
  loadKeymapFromNVS();                                  // gleiche Defaults: NVS-Belegung bleibt
  assert(DTAPMAP[1][2][1] == KEY_ESC);
}

// -----------------------------------------------------------------------------
// Test 50: Update von Firmware ohne Doppel-Tipp behält die Belegung und ergänzt die dtapmap
// -----------------------------------------------------------------------------
TEST(test_update_without_dtapmap_keeps_keymap) {
  resetState();
  // Zustand der Vorgänger-Firmware: keymap + holdmap + defaults_fp über KEYMAP, HOLDMAP und ID
  uint16_t userMap[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
  userMap[0][2][2] = 'q';
  preferences.putBytes("keymap", userMap, sizeof(userMap));
  preferences.putBytes("holdmap", HOLDMAP, sizeof(HOLDMAP));
  uint32_t h = 2166136261u;
  const uint32_t id = 0;
  const uint8_t* parts[3] = { (const uint8_t*)KEYMAP, (const uint8_t*)HOLDMAP, (const uint8_t*)&id };
  const size_t sizes[3] = { sizeof(KEYMAP), sizeof(HOLDMAP), sizeof(id) };
  for (int p = 0; p < 3; p++)
    for (size_t i = 0; i < sizes[p]; i++) { h ^= parts[p][i]; h *= 16777619u; }
  preferences.putUInt("defaults_fp", h);

  loadKeymapFromNVS();
  assert(KEYMAP[0][2][2] == 'q');                      // Belegung des Nutzers bleibt erhalten
  assert(preferences.getBytesLength("dtapmap") == sizeof(DTAPMAP));
  assert(Preferences::uintStore["defaults_fp"] == h);

  // Eine belegte DTAPMAP verändert den Fingerprint: neue App-Defaults werden übernommen
  DTAPMAP[0][2][2] = KEY_ESC;
  assert(keymapDefaultsFingerprint() != h);
}

// -----------------------------------------------------------------------------
// Umlaut-Aktion: Tottaste Alt + u, danach der Vokal; ß = Alt + s; einmal pro Tastendruck
// -----------------------------------------------------------------------------
TEST(test_umlaut_action_sends_dead_key_sequence) {
  resetState();
  KEYMAP[0][2][4] = ACT_UMLAUT_OE;
  setMillis(1000);
  onMatrixKeyChange(2, 4, true);
  std::vector<uint8_t> expected = { KEY_LEFT_ALT, 'u', 'o' };
  assert(bleKeyboard.pressHistory == expected);
  assert(bleKeyboard.pressedKeys.empty());            // alles wieder losgelassen
  setMillis(1100);
  onMatrixKeyChange(2, 4, false);
  assert(bleKeyboard.pressHistory == expected);       // Loslassen sendet nichts nach

  // Großbuchstabe: der Vokal kommt als 'U' (Shift implizit über dactylAsciiToHid)
  resetState();
  KEYMAP[0][1][5] = ACT_UMLAUT_UE_UPPER;
  onMatrixKeyChange(1, 5, true);
  expected = { KEY_LEFT_ALT, 'u', 'U' };
  assert(bleKeyboard.pressHistory == expected);
  onMatrixKeyChange(1, 5, false);

  // ß ist Alt + s ohne Vokal
  resetState();
  KEYMAP[0][0][5] = ACT_UMLAUT_SZ;
  onMatrixKeyChange(0, 5, true);
  expected = { KEY_LEFT_ALT, 's' };
  assert(bleKeyboard.pressHistory == expected);
  assert(bleKeyboard.pressedKeys.empty());
  onMatrixKeyChange(0, 5, false);

  // Codes außerhalb des Bereichs sind keine Umlaute
  assert(isUmlautAction(ACT_UMLAUT_SZ) && !isUmlautAction(ACT_UMLAUT_BASE + NUM_UMLAUT_ACTIONS));
  assert(!isUmlautAction(ACT_KEY_PAIR_BASE + 15));
}

TEST(test_umlaut_action_as_hold_and_combo_candidate) {
  // Halte-Aktion: nach TAPPING_TERM_MS genau einmal gesendet
  resetState();
  KEYMAP[0][2][3] = 'l';
  HOLDMAP[0][2][3] = ACT_UMLAUT_AE;
  setMillis(1000);
  onMatrixKeyChange(2, 3, true);
  setMillis(1000 + TAPPING_TERM_MS);
  processDeferredKeys(1000 + TAPPING_TERM_MS);
  std::vector<uint8_t> expected = { KEY_LEFT_ALT, 'u', 'a' };
  assert(bleKeyboard.pressHistory == expected);
  setMillis(1500);
  onMatrixKeyChange(2, 3, false);
  assert(bleKeyboard.pressHistory == expected);

  // Combo-Kandidat: schneller Tipp sendet beim Loslassen
  resetState();
  KEYMAP[0][2][1] = ACT_UMLAUT_OE;
  KEYMAP[0][2][2] = 'k';
  numCombos = 1;
  userCombos[0] = { 2, 1, 2, 2, 0, KEY_ESC };
  setMillis(2000);
  onMatrixKeyChange(2, 1, true);
  assert(bleKeyboard.pressHistory.empty());
  setMillis(2010);
  onMatrixKeyChange(2, 1, false);
  expected = { KEY_LEFT_ALT, 'u', 'o' };
  assert(bleKeyboard.pressHistory == expected);

  // Combo-Kandidat gehalten: processDeferredKeys sendet einmal, Loslassen nichts mehr
  bleKeyboard.pressHistory.clear();
  setMillis(3000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  setMillis(3000 + comboTimeoutMs);
  processDeferredKeys(3000 + comboTimeoutMs);
  assert(bleKeyboard.pressHistory == expected);
  setMillis(3300);
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.pressHistory == expected);

  // Combo-Aktion KEY_PRESS mit Umlaut
  resetState();
  KEYMAP[0][2][1] = 'j';
  KEYMAP[0][2][2] = 'k';
  numCombos = 1;
  userCombos[0] = { 2, 1, 2, 2, 0, ACT_UMLAUT_SZ };
  setMillis(4000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true);
  checkUserCombos();
  expected = { KEY_LEFT_ALT, 's' };
  assert(bleKeyboard.pressHistory == expected);
}

// Gehaltene Modifier: vor der Folge gelöst, danach wiederhergestellt (kein Alt + Shift + u, Alt bleibt gehalten)
TEST(test_umlaut_releases_and_restores_held_modifiers) {
  resetState();
  KEYMAP[0][3][5] = KEY_LEFT_SHIFT;
  KEYMAP[0][2][4] = ACT_UMLAUT_OE;
  setMillis(1000);
  keyState[3][5] = true; onMatrixKeyChange(3, 5, true);
  bleKeyboard.keyEvents.clear();
  setMillis(1100);
  keyState[2][4] = true; onMatrixKeyChange(2, 4, true);
  std::vector<int> expected = { -KEY_LEFT_SHIFT, KEY_LEFT_ALT, 'u', -'u', -KEY_LEFT_ALT, 'o', -'o', KEY_LEFT_SHIFT };
  assert(bleKeyboard.keyEvents == expected);
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == KEY_LEFT_SHIFT);
  keyState[2][4] = false; onMatrixKeyChange(2, 4, false);
  keyState[3][5] = false; onMatrixKeyChange(3, 5, false);
  assert(bleKeyboard.pressedKeys.empty());

  // Gehaltenes Alt bleibt nach der Folge gedrückt
  resetState();
  KEYMAP[0][4][5] = KEY_LEFT_ALT;
  KEYMAP[0][0][5] = ACT_UMLAUT_SZ;
  keyState[4][5] = true; onMatrixKeyChange(4, 5, true);
  bleKeyboard.keyEvents.clear();
  keyState[0][5] = true; onMatrixKeyChange(0, 5, true);
  expected = { -KEY_LEFT_ALT, KEY_LEFT_ALT, 's', -'s', -KEY_LEFT_ALT, KEY_LEFT_ALT };
  assert(bleKeyboard.keyEvents == expected);
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == KEY_LEFT_ALT);

  // Ein Tastenpaar mit Modifier zählt ebenfalls als gehalten
  resetState();
  numKeyPairs = 1;
  userKeyPairs[0] = { KEY_LEFT_GUI, 'c' };
  KEYMAP[0][3][0] = ACT_KEY_PAIR_BASE;
  KEYMAP[0][2][5] = ACT_UMLAUT_AE;
  keyState[3][0] = true; onMatrixKeyChange(3, 0, true);
  bleKeyboard.keyEvents.clear();
  keyState[2][5] = true; onMatrixKeyChange(2, 5, true);
  assert(bleKeyboard.keyEvents.front() == -KEY_LEFT_GUI && bleKeyboard.keyEvents.back() == KEY_LEFT_GUI);

  // Ein gehaltenes Zeichen mit implizitem Shift ('A') zählt als gehaltenes Shift
  resetState();
  KEYMAP[0][2][0] = 'A';
  KEYMAP[0][2][4] = ACT_UMLAUT_OE;
  keyState[2][0] = true; onMatrixKeyChange(2, 0, true);
  bleKeyboard.keyEvents.clear();
  keyState[2][4] = true; onMatrixKeyChange(2, 4, true);
  expected = { -KEY_LEFT_SHIFT, KEY_LEFT_ALT, 'u', -'u', -KEY_LEFT_ALT, 'o', -'o', KEY_LEFT_SHIFT };
  assert(bleKeyboard.keyEvents == expected);

  // Ohne gehaltene Modifier bleibt die Folge unverändert
  resetState();
  KEYMAP[0][2][4] = ACT_UMLAUT_OE;
  onMatrixKeyChange(2, 4, true);
  expected = { KEY_LEFT_ALT, 'u', -'u', -KEY_LEFT_ALT, 'o', -'o' };
  assert(bleKeyboard.keyEvents == expected);
}

// Umlaut während einer aktiven Combo: MODIFIER_HOLD hält seinen Modifier und wird wiederhergestellt;
// die verbrauchten Combo-Tasten (releaseAll) zählen nicht als gehalten
TEST(test_umlaut_during_active_combo) {
  resetState();
  KEYMAP[0][2][1] = 'j';
  KEYMAP[0][2][2] = 'k';
  KEYMAP[0][2][4] = ACT_UMLAUT_OE;
  numCombos = 1;
  userCombos[0] = { 2, 1, 2, 2, 1, KEY_LEFT_CTRL }; // MODIFIER_HOLD Ctrl
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true);
  checkUserCombos();
  assert(comboRuntime[0].active);
  bleKeyboard.keyEvents.clear();
  setMillis(1100);
  keyState[2][4] = true; onMatrixKeyChange(2, 4, true);
  std::vector<int> expected = { -KEY_LEFT_CTRL, KEY_LEFT_ALT, 'u', -'u', -KEY_LEFT_ALT, 'o', -'o', KEY_LEFT_CTRL };
  assert(bleKeyboard.keyEvents == expected);
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == KEY_LEFT_CTRL);

  // KEY_PRESS-Combo aus zwei Shift-Tasten: nach releaseAll() ist kein Shift am Host, die Folge stellt keins her
  resetState();
  KEYMAP[0][3][4] = KEY_LEFT_SHIFT;
  KEYMAP[0][3][5] = KEY_LEFT_SHIFT;
  KEYMAP[0][2][4] = ACT_UMLAUT_OE;
  numCombos = 1;
  userCombos[0] = { 3, 4, 3, 5, 0, KEY_ESC };
  setMillis(2000);
  keyState[3][4] = true; onMatrixKeyChange(3, 4, true);
  keyState[3][5] = true; onMatrixKeyChange(3, 5, true);
  checkUserCombos();
  assert(comboRuntime[0].active && keySentToHost[3][4] && keySentToHost[3][5]);
  bleKeyboard.keyEvents.clear();
  setMillis(2100);
  keyState[2][4] = true; onMatrixKeyChange(2, 4, true);
  expected = { KEY_LEFT_ALT, 'u', -'u', -KEY_LEFT_ALT, 'o', -'o' };
  assert(bleKeyboard.keyEvents == expected);
  assert(bleKeyboard.pressedKeys.empty());
}

// Umlaut als Doppel-Tipp-Aktion und als Halten, das der Druck einer anderen Taste erzwingt
TEST(test_umlaut_as_double_tap_and_forced_hold) {
  resetState();
  KEYMAP[0][2][4] = ';';
  DTAPMAP[0][2][4] = ACT_UMLAUT_OE;
  tapKeyAt(2, 4, 1000, 1050);
  assert(bleKeyboard.pressHistory.empty());            // erster Tipp wartet auf das Fenster
  setMillis(1100);
  keyState[2][4] = true; onMatrixKeyChange(2, 4, true);
  std::vector<uint8_t> expected = { KEY_LEFT_ALT, 'u', 'o' };
  assert(bleKeyboard.pressHistory == expected);
  assert(bleKeyboard.pressedKeys.empty());
  setMillis(1300);
  keyState[2][4] = false; onMatrixKeyChange(2, 4, false);
  setMillis(2000);
  processDeferredKeys(millis());
  assert(bleKeyboard.pressHistory == expected);       // kein Tap ';' und keine zweite Folge
  assert(countPresses(';') == 0);

  // Erzwungenes Halten: eine andere Taste entscheidet die Taste sofort als Halten
  resetState();
  KEYMAP[0][2][3] = 'l';
  HOLDMAP[0][2][3] = ACT_UMLAUT_AE;
  KEYMAP[0][2][0] = 'h';
  setMillis(1000);
  keyState[2][3] = true; onMatrixKeyChange(2, 3, true);
  setMillis(1050);
  keyState[2][0] = true; onMatrixKeyChange(2, 0, true);
  expected = { KEY_LEFT_ALT, 'u', 'a', 'h' };
  assert(bleKeyboard.pressHistory == expected);       // Folge vor der abhängigen Taste
  keyState[2][0] = false; onMatrixKeyChange(2, 0, false);
  setMillis(1500);
  processDeferredKeys(millis());
  keyState[2][3] = false; onMatrixKeyChange(2, 3, false);
  assert(bleKeyboard.pressHistory == expected);       // kein Tap 'l', keine zweite Folge
  assert(bleKeyboard.pressedKeys.empty());
}

// -----------------------------------------------------------------------------
// Konfigurierbarer Tapping-Term: SET_TAPPING_TERM, NVS, GET_INFO, Mod-Tap und Doppel-Tipp
// -----------------------------------------------------------------------------
TEST(test_configurable_tapping_term) {
  resetState();
  handleConfigCommand("SET_TAPPING_TERM 99", false);
  assert(mockChar.value == "ERR ARGS SET_TAPPING_TERM 99");
  handleConfigCommand("SET_TAPPING_TERM 501", false);
  assert(mockChar.value == "ERR ARGS SET_TAPPING_TERM 501");
  assert(tappingTermMs == 200);

  handleConfigCommand("SET_TAPPING_TERM 300", false);
  assert(mockChar.value == "OK SET_TAPPING_TERM 300");
  assert(tappingTermMs == 300);
  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.find("\"tapping_term_ms\":300") != std::string::npos);

  // Neustart simulieren: der gespeicherte Wert überschreibt den einkompilierten
  tappingTermMs = 200;
  loadKeymapFromNVS();
  assert(tappingTermMs == 300);

  // Mod-Tap: Halten über 200 ms bleibt bei 300 ms noch unentschieden, Loslassen sendet den Tap
  handleConfigCommand("SET_K 0 5 3 32 128", false); // Tap = Space, Hold = Left Ctrl
  bleKeyboard.pressHistory.clear();
  setMillis(1000);
  keyState[5][3] = true;
  onMatrixKeyChange(5, 3, true);
  setMillis(1250);
  processDeferredKeys(millis());
  assert(bleKeyboard.pressHistory.empty());
  keyState[5][3] = false;
  onMatrixKeyChange(5, 3, false);
  assert(countPresses(' ') == 1);
  assert(countPresses(KEY_LEFT_CTRL) == 0);
  // Ab 300 ms entscheidet die Taste als Hold
  setMillis(2000);
  keyState[5][3] = true;
  onMatrixKeyChange(5, 3, true);
  setMillis(2300);
  processDeferredKeys(millis());
  assert(countPresses(KEY_LEFT_CTRL) == 1);
  keyState[5][3] = false;
  onMatrixKeyChange(5, 3, false);

  // Doppel-Tipp: zweiter Tipp nach 250 ms liegt im 300-ms-Fenster
  handleConfigCommand("SET_K 0 2 1 106 0 177", false); // J: Tap = j, Doppel-Tipp = Esc
  bleKeyboard.pressHistory.clear();
  tapKeyAt(2, 1, 3000, 3050);
  tapKeyAt(2, 1, 3300, 3350);
  assert(countPresses(KEY_ESC) == 1);
  assert(countPresses('j') == 0);
}

// Grenzen des Tapping-Terms: 100 und 500 sind gültig, ein gespeicherter Wert außerhalb gilt nicht
TEST(test_tapping_term_bounds_and_stored_out_of_range) {
  resetState();
  handleConfigCommand("SET_TAPPING_TERM 100", false);
  assert(mockChar.value == "OK SET_TAPPING_TERM 100");
  assert(tappingTermMs == 100);
  handleConfigCommand("SET_TAPPING_TERM 500", false);
  assert(mockChar.value == "OK SET_TAPPING_TERM 500");
  assert(tappingTermMs == 500);

  // Ein gespeicherter Wert außerhalb des Bereichs (alte oder defekte NVS) lässt den Standardwert stehen
  resetState();
  Preferences::uintStore["tap_term"] = 50;
  assert(preferences.isKey("tap_term") && preferences.getUShort("tap_term", 0) == 50);
  tappingTermMs = 300; // ein angewendeter Wert 50 wäre sichtbar, ein ungeprüfter Rückfall ebenso
  loadKeymapFromNVS();
  assert(tappingTermMs == 300);
  Preferences::uintStore["tap_term"] = 501;
  loadKeymapFromNVS();
  assert(tappingTermMs == 300);
  // Gegenprobe: ein gültiger gespeicherter Wert wird übernommen
  Preferences::uintStore["tap_term"] = 450;
  loadKeymapFromNVS();
  assert(tappingTermMs == 450);
}

// -----------------------------------------------------------------------------
// Tapping-Term je Taste (TAPTERMMAP, SET_KT): 0 = Wert der Hälfte
// -----------------------------------------------------------------------------
TEST(test_tapping_term_per_key_resolution) {
  resetState();
  // Zwei gleiche Mod-Tap-Tasten; nur J hat einen eigenen Term von 300 ms, die Hälfte hat 200 ms
  handleConfigCommand("SET_K 0 2 1 106 128", false);   // J: Tap j, Hold Left Ctrl
  handleConfigCommand("SET_K 0 2 2 107 129", false);   // K: Tap k, Hold Left Shift
  handleConfigCommand("SET_KT 0 2 1 300", false);
  assert(TAPTERMMAP[0][2][1] == 300 && TAPTERMMAP[0][2][2] == 0);
  bleKeyboard.pressHistory.clear();

  // J: bei 250 ms noch unentschieden, Loslassen ergibt einen Tap
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  setMillis(1250);
  processDeferredKeys(millis());
  assert(countPresses(KEY_LEFT_CTRL) == 0);
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert(countPresses('j') == 1);
  assert(countPresses(KEY_LEFT_CTRL) == 0);

  // K ohne eigenen Wert: nach 250 ms (> 200 ms der Hälfte) ist es ein Hold
  setMillis(2000);
  keyState[2][2] = true;
  onMatrixKeyChange(2, 2, true);
  setMillis(2250);
  processDeferredKeys(millis());
  assert(countPresses(KEY_LEFT_SHIFT) == 1);
  keyState[2][2] = false;
  onMatrixKeyChange(2, 2, false);
  assert(countPresses('k') == 0);

  // J erreicht den eigenen Term von 300 ms und wird Hold
  setMillis(3000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  setMillis(3300);
  processDeferredKeys(millis());
  assert(countPresses(KEY_LEFT_CTRL) == 1);
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);

  // Das Loslassen allein (ohne Tick) entscheidet nach dem eigenen Term ebenfalls als Hold
  resetState();
  handleConfigCommand("SET_K 0 2 1 106 128", false);
  handleConfigCommand("SET_KT 0 2 1 300", false);
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  setMillis(1299);
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert(countPresses('j') == 1 && countPresses(KEY_LEFT_CTRL) == 0);
}

TEST(test_tapping_term_per_key_double_tap_window) {
  resetState();
  handleConfigCommand("SET_K 0 2 1 106 0 177", false); // J: Tap j, Doppel-Tipp Esc
  handleConfigCommand("SET_KT 0 2 1 400", false);
  bleKeyboard.pressHistory.clear();
  // Zweiter Tipp 350 ms nach dem ersten Loslassen: im Fenster von 400 ms, außerhalb von 200 ms
  tapKeyAt(2, 1, 1000, 1050);
  tapKeyAt(2, 1, 1400, 1450);
  assert(countPresses(KEY_ESC) == 1);
  assert(countPresses('j') == 0);

  // Ohne eigenen Wert gilt der Wert der Hälfte: derselbe Abstand ergibt zwei Einzel-Tipps
  resetState();
  handleConfigCommand("SET_K 0 2 1 106 0 177", false);
  bleKeyboard.pressHistory.clear();
  tapKeyAt(2, 1, 1000, 1050);
  tapKeyAt(2, 1, 1400, 1450);
  setMillis(2000);
  processDeferredKeys(millis());
  assert(countPresses(KEY_ESC) == 0);
  assert(countPresses('j') == 2);
}

TEST(test_tapping_term_per_key_commands_and_nvs) {
  resetState();
  handleConfigCommand("SET_KT 0 2 1 99", false);
  assert(mockChar.value == "ERR ARGS SET_KT 0 2 1 99");
  handleConfigCommand("SET_KT 0 2 1 501", false);
  assert(mockChar.value == "ERR ARGS SET_KT 0 2 1 501");
  handleConfigCommand("SET_KT 8 2 1 300", false);
  assert(mockChar.value == "ERR ARGS SET_KT 8 2 1 300");
  handleConfigCommand("SET_KT 0 2 1 300 7", false);
  assert(mockChar.value == "ERR ARGS SET_KT 0 2 1 300 7");
  assert(TAPTERMMAP[0][2][1] == 0);
  handleConfigCommand("SET_KT 0 2 1 100", false);
  handleConfigCommand("SET_KT 1 3 4 500", false);
  assert(TAPTERMMAP[0][2][1] == 100 && TAPTERMMAP[1][3][4] == 500);

  // GET_CONFIG meldet die Werte je Ebene
  mockChar.notifications.clear();
  handleConfigCommand("GET_CONFIG", false);
  bool foundL0 = false, foundL1 = false;
  for (const auto& n : mockChar.notifications) {
    if (n.rfind("TERM_DATA:{\"l\":0,", 0) == 0 && n.find("[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,100,0,") != std::string::npos) foundL0 = true;
    if (n.rfind("TERM_DATA:{\"l\":1,", 0) == 0 && n.find("[0,0,0,0,500,0,0]") != std::string::npos) foundL1 = true;
  }
  assert(foundL0 && foundL1);

  // Ohne SAVE_NVS bleibt der NVS leer; danach überlebt der Wert einen Neustart
  assert(!preferences.isKey("tapterms"));
  handleConfigCommand("SAVE_NVS", false);
  assert(mockChar.value == "OK SAVE_NVS");
  assert(preferences.getBytesLength("tapterms") == sizeof(TAPTERMMAP));
  memset(TAPTERMMAP, 0, sizeof(TAPTERMMAP));
  loadKeymapFromNVS();
  assert(TAPTERMMAP[0][2][1] == 100 && TAPTERMMAP[1][3][4] == 500);

  // CLEAR_TAP_TERMS + SAVE_NVS entfernt den Schlüssel: danach gilt überall der Wert der Hälfte
  handleConfigCommand("CLEAR_TAP_TERMS", false);
  assert(mockChar.value == "OK CLEAR_TAP_TERMS");
  assert(TAPTERMMAP[0][2][1] == 0);
  handleConfigCommand("SAVE_NVS", false);
  assert(!preferences.isKey("tapterms"));
  loadKeymapFromNVS();
  assert(TAPTERMMAP[0][2][1] == 0);

  // Ungültiger gespeicherter Wert zählt als 0, ein fehlender Schlüssel lässt alles beim Alten
  std::vector<uint8_t> raw(sizeof(TAPTERMMAP), 0);
  uint16_t bad = 50, good = 250;
  memcpy(raw.data(), &bad, sizeof(bad));
  memcpy(raw.data() + sizeof(uint16_t), &good, sizeof(good));
  Preferences::bytesStore["tapterms"] = raw;
  loadKeymapFromNVS();
  assert(TAPTERMMAP[0][0][0] == 0 && TAPTERMMAP[0][0][1] == 250);
}

// Einkompilierte Terme dürfen nach CLEAR_TAP_TERMS + SAVE_NVS nicht beim nächsten Start zurückkommen
TEST(test_tapping_term_per_key_cleared_compiled_in_terms_stay_cleared) {
  resetState();
  TAPTERMMAP[0][2][1] = 300;                 // einkompilierter Wert (Flash aus dem Repository)
  loadKeymapFromNVS();                       // erster Start: Defaults landen im NVS
  assert(TAPTERMMAP[0][2][1] == 300);
  handleConfigCommand("CLEAR_TAP_TERMS", false);
  handleConfigCommand("SAVE_NVS", false);
  assert(mockChar.value == "OK SAVE_NVS");
  assert(preferences.isKey("tapterms"));     // Null-Blob statt fehlendem Schlüssel
  // Neustart: die Firmware trägt wieder den einkompilierten Wert, der NVS hat Vorrang
  TAPTERMMAP[0][2][1] = 300;
  tapTermsCompiledIn = false;
  loadKeymapFromNVS();
  assert(TAPTERMMAP[0][2][1] == 0);
  assert(!anyKeyTapTerm());
}

// Eine transparente Taste auf Ebene 1 erbt den Term von Ebene 0 wie ihre Aktionen
TEST(test_tapping_term_per_key_transparent_key_inherits_layer0_term) {
  resetState();
  handleConfigCommand("SET_K 0 2 1 106 128", false);   // Ebene 0: J, Hold Ctrl
  handleConfigCommand("SET_KT 0 2 1 300", false);
  handleConfigCommand("SET_K 1 2 1 0", false);         // Ebene 1: transparent
  assert(resolveKeyTapTerm(1, 2, 1) == 300);
  assert(resolveKeyTapTerm(0, 2, 1) == 300);
  handleConfigCommand("SET_K 1 2 1 107", false);       // Ebene 1: eigene Taste, kein eigener Term
  assert(resolveKeyTapTerm(1, 2, 1) == 0);
}

TEST(test_tapping_term_per_key_fingerprint_and_defaults) {
  resetState();
  uint32_t base = keymapDefaultsFingerprint();
  TAPTERMMAP[0][2][1] = 300;
  assert(keymapDefaultsFingerprint() != base);          // belegte Terme gehören zur Belegung
  TAPTERMMAP[0][2][1] = 0;
  assert(keymapDefaultsFingerprint() == base);          // leer = Fingerprint der Firmware davor

  // Ein Flash aus der App (ID != 0) ersetzt gespeicherte Terme durch die einkompilierten
  resetState();
  TAPTERMMAP[0][2][1] = 300;
  handleConfigCommand("SAVE_NVS", false);
  memset(TAPTERMMAP, 0, sizeof(TAPTERMMAP));
  testDefaultsId = 77;
  loadKeymapFromNVS();
  assert(TAPTERMMAP[0][2][1] == 0);
  assert(!preferences.isKey("tapterms"));
  testDefaultsId = 0;
}


// -----------------------------------------------------------------------------
// One-Shot-Modifier und Caps Word: DactylLogic.h meldet Drücken/Loslassen an den Master-Zustand
// -----------------------------------------------------------------------------
TEST(test_one_shot_key_reports_press_and_release) {
  resetState();
  KEYMAP[0][5][1] = ACT_OSM_LSHIFT;
  KEYMAP[0][5][2] = ACT_OSM_LCTRL;
  tapKeyAt(5, 1, 1000, 1050);
  tapKeyAt(5, 2, 1100, 1150);
  assert((bleKeyboard.oneShotEvents == std::vector<int>{2, -2, 1, -1}));
  assert(bleKeyboard.pressHistory.empty()); // kein normaler Tastendruck
  bool sawName = false;
  for (const std::string &n : Serial.outputLines) sawName = sawName || n.find("\"key\":\"OSM Ctrl\"") != std::string::npos;
  assert(sawName);
}

TEST(test_umlaut_ae_during_caps_word_sends_plain_sequence_and_keeps_caps_word) {
  // Schutztest: der Master gibt dem Vokal Shift und beendet Caps Word nicht (test_split_hid.cpp, dort auch der Ablauf
  // nach CAPS_WORD_IDLE_MS); die Logik sendet weder Shift noch ein Umschalten
  resetState();
  KEYMAP[0][5][1] = ACT_CAPS_WORD;
  KEYMAP[0][2][4] = ACT_UMLAUT_AE;
  tapKeyAt(5, 1, 1000, 1050);
  bleKeyboard.pressHistory.clear();
  tapKeyAt(2, 4, 1100, 1150);
  std::vector<uint8_t> expected = { KEY_LEFT_ALT, 'u', 'a' };
  assert(bleKeyboard.pressHistory == expected);
  assert((bleKeyboard.oneShotEvents == std::vector<int>{0}));   // nur das erste Umschalten
}

TEST(test_caps_word_key_toggles_once_per_press) {
  resetState();
  KEYMAP[0][5][1] = ACT_CAPS_WORD;
  tapKeyAt(5, 1, 1000, 1050);
  assert((bleKeyboard.oneShotEvents == std::vector<int>{0}));
}

TEST(test_sentence_case_key_toggles_once_per_press) {
  resetState();
  KEYMAP[0][5][1] = ACT_SENTENCE_CASE;
  tapKeyAt(5, 1, 1000, 1050);
  assert((bleKeyboard.oneShotEvents == std::vector<int>{BleKeyboard::SENTENCE_CASE_EVENT}));
}

TEST(test_one_shot_as_hold_action_and_combo_action) {
  resetState();
  // Mod-Tap: Tap = 'f', Halten = One-Shot-Shift (wirkt beim Halten wie Shift auf dem Master)
  KEYMAP[0][2][1] = 'f';
  HOLDMAP[0][2][1] = ACT_OSM_LSHIFT;
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  setMillis(1000 + TAPPING_TERM_MS + 1);
  processDeferredKeys(millis());
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  assert((bleKeyboard.oneShotEvents == std::vector<int>{2, -2}));
  // Combo mit KEY_PRESS-Aktion One-Shot-Ctrl: Press + Release (tippen)
  bleKeyboard.oneShotEvents.clear();
  handleConfigCommand("CLEAR_COMBOS", false);
  handleConfigCommand("ADD_COMBO 1 1 1 2 0 352", false); // 352 = 0x160 (ACT_OSM_LCTRL)
  KEYMAP[0][1][1] = 'w';
  KEYMAP[0][1][2] = 'e';
  setMillis(2000);
  keyState[1][1] = true;
  onMatrixKeyChange(1, 1, true);
  keyState[1][2] = true;
  onMatrixKeyChange(1, 2, true);
  checkUserCombos();
  assert((bleKeyboard.oneShotEvents == std::vector<int>{1, -1}));
}

TEST(test_one_shot_not_sent_without_host_or_in_config_mode) {
  resetState();
  KEYMAP[0][5][1] = ACT_OSM_LSHIFT;
  isConfigMode = true;
  tapKeyAt(5, 1, 1000, 1050);
  isConfigMode = false;
  bleKeyboard.connected = false;
  tapKeyAt(5, 1, 1100, 1150);
  bleKeyboard.connected = true;
  assert(bleKeyboard.oneShotEvents.empty());
}

// -----------------------------------------------------------------------------
// Makros: nicht blockierende Folge aus TAP, DOWN, UP und PAUSE
// -----------------------------------------------------------------------------
// Ruft processDeferredKeys() in 1-ms-Schritten bis einschließlich untilMs auf (wie loop())
static void runTicks(unsigned long untilMs) {
  while (millis() < untilMs) {
    advanceMillis(1);
    processDeferredKeys(millis());
  }
}

// Makro 0 aus Befehlen: Cmd drücken, 'c' tippen, Cmd loslassen, 100 ms Pause, 'v' tippen
static void addCopyPasteMacro() {
  handleConfigCommand("ADD_MACRO", false);
  assert(mockChar.value == "OK ADD_MACRO 0");
  handleConfigCommand("ADD_MACRO_STEP 2 131 0", false);   // DOWN Cmd
  handleConfigCommand("ADD_MACRO_STEP 1 99 0", false);    // TAP 'c'
  handleConfigCommand("ADD_MACRO_STEP 3 131 0", false);   // UP Cmd
  handleConfigCommand("ADD_MACRO_STEP 4 0 100", false);   // PAUSE 100 ms
  handleConfigCommand("ADD_MACRO_STEP 1 118 0", false);   // TAP 'v'
  assert(mockChar.value == "OK ADD_MACRO_STEP 0 4");
  assert(numMacros == 1 && macroLengths[0] == 5);
}

TEST(test_macro_plays_steps_without_blocking) {
  resetState();
  addCopyPasteMacro();
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;

  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  // Der Druck sendet nur den ersten Schritt sofort; der Rest folgt aus processDeferredKeys()
  std::vector<int> expected = { 131 };
  assert(bleKeyboard.keyEvents == expected);
  assert(macroRun.active);

  runTicks(1004);
  assert(bleKeyboard.keyEvents == expected);           // MACRO_STEP_GAP_MS zwischen zwei Ereignissen
  runTicks(1005);
  expected = { 131, 'c' };
  assert(bleKeyboard.keyEvents == expected);
  runTicks(1015);
  expected = { 131, 'c', -'c', -131 };
  assert(bleKeyboard.keyEvents == expected);
  // Pause: 100 ms nach dem PAUSE-Schritt kommt 'v'
  runTicks(1100);
  assert(bleKeyboard.keyEvents == expected);
  runTicks(1125);
  expected = { 131, 'c', -'c', -131, 'v', -'v' };
  assert(bleKeyboard.keyEvents == expected);
  assert(!macroRun.active);
  assert(bleKeyboard.pressedKeys.empty());

  // Das Loslassen der Taste sendet nichts
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  runTicks(1200);
  assert(bleKeyboard.keyEvents == expected);
}

TEST(test_macro_releases_held_codes_at_end_and_ignores_restart) {
  resetState();
  handleConfigCommand("ADD_MACRO", false);
  handleConfigCommand("ADD_MACRO_STEP 2 129 0", false);   // DOWN Shift, ohne UP
  handleConfigCommand("ADD_MACRO_STEP 4 0 200", false);
  handleConfigCommand("ADD_MACRO_STEP 1 97 0", false);
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;

  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  runTicks(1050);
  // Zweiter Druck während des Laufs: wird ignoriert, das Makro startet nicht neu
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  runTicks(1400);
  std::vector<int> expected = { 129, 'a', -'a', -129 };
  assert(bleKeyboard.keyEvents == expected);           // Shift wird am Ende losgelassen, nur ein Lauf
  assert(!macroRun.active);
  assert(bleKeyboard.pressedKeys.empty());

  // Nach dem Ende startet ein neuer Druck das Makro wieder
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  runTicks(1800);
  assert(bleKeyboard.keyEvents.size() == 8);
}

TEST(test_macro_as_hold_and_double_tap_action) {
  resetState();
  handleConfigCommand("ADD_MACRO", false);
  handleConfigCommand("ADD_MACRO_STEP 1 120 0", false);   // TAP 'x'
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = ACT_MACRO_BASE + 0;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  runTicks(1300);                                       // Tapping-Term abgelaufen: Halten startet das Makro
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  runTicks(1400);
  std::vector<int> expected = { 'x', -'x' };
  assert(bleKeyboard.keyEvents == expected);           // kein Tap 'j'

  resetState();
  handleConfigCommand("ADD_MACRO", false);
  handleConfigCommand("ADD_MACRO_STEP 1 120 0", false);
  KEYMAP[0][2][4] = 'l';
  DTAPMAP[0][2][4] = ACT_MACRO_BASE + 0;
  tapKeyAt(2, 4, 1000, 1050);
  setMillis(1100);
  keyState[2][4] = true; onMatrixKeyChange(2, 4, true);
  keyState[2][4] = false; onMatrixKeyChange(2, 4, false);
  runTicks(1600);
  assert(bleKeyboard.keyEvents == expected);           // Doppel-Tipp startet das Makro, kein 'l'
}

TEST(test_macro_unknown_or_empty_index_sends_nothing) {
  resetState();
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 3;                 // nicht belegt
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  runTicks(1100);
  handleConfigCommand("ADD_MACRO", false);              // leeres Makro 0
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  runTicks(1200);
  assert(bleKeyboard.keyEvents.empty());
  assert(!macroRun.active);
}

TEST(test_macro_cancel_paths_release_codes) {
  // CLEAR_MACROS beendet ein laufendes Makro und lässt seine Codes los
  resetState();
  handleConfigCommand("ADD_MACRO", false);
  handleConfigCommand("ADD_MACRO_STEP 2 130 0", false);   // DOWN Alt
  handleConfigCommand("ADD_MACRO_STEP 4 0 1000", false);
  handleConfigCommand("ADD_MACRO_STEP 1 97 0", false);
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  runTicks(1100);
  handleConfigCommand("CLEAR_MACROS", false);
  assert(mockChar.value == "OK CLEAR_MACROS");
  assert(!macroRun.active && numMacros == 0);
  std::vector<int> expected = { 130, -130 };
  assert(bleKeyboard.keyEvents == expected);
  runTicks(2200);
  assert(bleKeyboard.keyEvents == expected);           // kein 'a' mehr

  // Verbindungsverlust: das Makro endet ohne weitere Ereignisse
  resetState();
  handleConfigCommand("ADD_MACRO", false);
  handleConfigCommand("ADD_MACRO_STEP 1 97 0", false);
  handleConfigCommand("ADD_MACRO_STEP 4 0 500", false);
  handleConfigCommand("ADD_MACRO_STEP 1 98 0", false);
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  runTicks(1100);
  bleKeyboard.connected = false;
  runTicks(1200);
  assert(!macroRun.active);
  bleKeyboard.connected = true;
  runTicks(1800);
  expected = { 'a', -'a' };
  assert(bleKeyboard.keyEvents == expected);

  // Eine ausgelöste Combo beendet das Makro (releaseAll löst seine Codes)
  resetState();
  handleConfigCommand("ADD_MACRO", false);
  handleConfigCommand("ADD_MACRO_STEP 2 129 0", false);
  handleConfigCommand("ADD_MACRO_STEP 4 0 1000", false);
  handleConfigCommand("ADD_MACRO_STEP 1 97 0", false);
  KEYMAP[0][3][1] = ACT_MACRO_BASE + 0;
  KEYMAP[0][2][1] = 'j';
  KEYMAP[0][2][2] = 'k';
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
  setMillis(1000);
  keyState[3][1] = true; onMatrixKeyChange(3, 1, true);
  keyState[3][1] = false; onMatrixKeyChange(3, 1, false);
  runTicks(1100);
  assert(macroRun.active);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true);
  checkUserCombos();
  assert(!macroRun.active);
  assert(bleKeyboard.pressedKeys.empty());
  runTicks(2500);
  assert(countPresses('a') == 0);
}

TEST(test_macro_commands_validate_arguments) {
  resetState();
  handleConfigCommand("ADD_MACRO_STEP 1 97 0", false);
  assert(mockChar.value == "ERR ARGS ADD_MACRO_STEP 1 97 0");  // kein Makro vorhanden
  handleConfigCommand("ADD_MACRO", false);
  const char* bad[] = {
    "ADD_MACRO_STEP 1 0 0", "ADD_MACRO_STEP 1 256 0", "ADD_MACRO_STEP 1 97 5",
    "ADD_MACRO_STEP 4 0 0", "ADD_MACRO_STEP 4 0 5001", "ADD_MACRO_STEP 4 97 100",
    "ADD_MACRO_STEP 5 97 0", "ADD_MACRO_STEP 0 97 0", "ADD_MACRO_STEP 1 97 0 9", "ADD_MACRO_STEP 1 97",
  };
  for (const char* cmd : bad) {
    handleConfigCommand(cmd, false);
    assert(mockChar.value == std::string("ERR ARGS ") + cmd);
  }
  assert(macroLengths[0] == 0);
  handleConfigCommand("ADD_MACRO_STEP 4 0 5000", false);
  assert(mockChar.value == "OK ADD_MACRO_STEP 0 0");
  for (int i = 1; i < MAX_MACRO_STEPS; i++) handleConfigCommand("ADD_MACRO_STEP 1 97 0", false);
  assert(macroLengths[0] == MAX_MACRO_STEPS);
  handleConfigCommand("ADD_MACRO_STEP 1 97 0", false);
  assert(mockChar.value == "ERR ARGS ADD_MACRO_STEP 1 97 0");  // max. 32 Schritte

  for (int i = 1; i < MAX_MACROS; i++) handleConfigCommand("ADD_MACRO", false);
  assert(mockChar.value == "OK ADD_MACRO 15");
  handleConfigCommand("ADD_MACRO", false);
  assert(mockChar.value == "ERR ARGS ADD_MACRO");                // max. 16 Makros

  // Combos unterstützen keine Makros
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 368", false);
  assert(mockChar.value == "ERR ARGS ADD_COMBO 2 1 2 2 0 368");
  assert(numCombos == 0);
}

TEST(test_macros_persist_compact_in_nvs) {
  resetState();
  addCopyPasteMacro();
  handleConfigCommand("ADD_MACRO", false);              // leeres Makro 1
  handleConfigCommand("ADD_MACRO", false);
  handleConfigCommand("ADD_MACRO_STEP 1 120 0", false); // Makro 2
  handleConfigCommand("SAVE_MACROS", false);
  assert(mockChar.value == "OK SAVE_MACROS");
  // Nur die belegten Schritte: 6 Schritte à 4 Byte, nicht das volle Array
  assert(preferences.getBytesLength("macros_data") == 6 * sizeof(MacroStep));
  assert(preferences.getBytesLength("macro_lens") == 3);

  // Neustart: RAM leer, NVS lädt die Makros
  numMacros = 0;
  for (int i = 0; i < MAX_MACROS; i++) macroLengths[i] = 0;
  userMacros[2][0] = { 0, 0, 0 };
  loadKeymapFromNVS();
  assert(numMacros == 3);
  assert(macroLengths[0] == 5 && macroLengths[1] == 0 && macroLengths[2] == 1);
  assert(userMacros[0][3].type == MACRO_STEP_PAUSE && userMacros[0][3].ms == 100);
  assert(userMacros[2][0].type == MACRO_STEP_TAP && userMacros[2][0].code == 120);

  // Defekte Daten (Länge passt nicht): die einkompilierten Makros bleiben
  Preferences::bytesStore["macros_data"].resize(5 * sizeof(MacroStep));
  numMacros = 1;
  macroLengths[0] = 1;
  macroLengths[2] = 0;
  loadKeymapFromNVS();
  assert(numMacros == 1 && macroLengths[0] == 1);

  // Leere Liste gespeichert: überschreibt die einkompilierten Makros
  handleConfigCommand("CLEAR_MACROS", false);
  handleConfigCommand("SAVE_MACROS", false);
  assert(mockChar.value == "OK SAVE_MACROS");
  assert(!preferences.isKey("macros_data") && !preferences.isKey("macro_lens"));
  numMacros = 2;
  macroLengths[0] = 1;
  loadKeymapFromNVS();
  assert(numMacros == 0);
}

TEST(test_app_flash_discards_stored_macros) {
  resetState();
  addCopyPasteMacro();
  handleConfigCommand("SAVE_MACROS", false);
  loadKeymapFromNVS();                                  // Fingerprint der aktuellen Defaults speichern
  testDefaultsId = 0xBEEF;                              // Flash aus der App mit einkompiliertem Makro
  numMacros = 1;
  macroLengths[0] = 1;
  userMacros[0][0] = { MACRO_STEP_TAP, 'z', 0 };
  loadKeymapFromNVS();
  assert(numMacros == 1 && macroLengths[0] == 1 && userMacros[0][0].code == 'z');
  assert(!preferences.isKey("num_macros") && !preferences.isKey("macros_data"));
}


// -----------------------------------------------------------------------------
// LOW-Sammellauf: Makro-Grenzfälle, Caps Word als Combo-Kandidat, gehaltene One-Shot-Tasten
// -----------------------------------------------------------------------------
TEST(test_macro_pause_as_last_step_keeps_macro_running) {
  resetState();
  handleConfigCommand("ADD_MACRO", false);
  handleConfigCommand("ADD_MACRO_STEP 1 97 0", false);    // TAP 'a'
  handleConfigCommand("ADD_MACRO_STEP 4 0 300", false);   // PAUSE 300 ms am Ende
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  runTicks(1100);
  // Die Pause läuft noch: das Makro ist aktiv, ein neuer Druck startet nichts
  assert(macroRun.active);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  std::vector<int> expected = { 'a', -'a' };
  assert(bleKeyboard.keyEvents == expected);
  runTicks(1320);
  assert(!macroRun.active);                              // Pause abgelaufen
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.keyEvents.size() == 3);             // neuer Lauf beginnt mit 'a'
}

TEST(test_running_macro_counts_as_activity) {
  resetState();
  handleConfigCommand("ADD_MACRO", false);
  handleConfigCommand("ADD_MACRO_STEP 4 0 5000", false);
  handleConfigCommand("ADD_MACRO_STEP 1 97 0", false);
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  lastActivityTime = 0;
  runTicks(6010);
  // Der Schritt nach der Pause setzt den Inaktivitäts-Timer zurück
  assert(lastActivityTime >= 6000);
}

TEST(test_save_macros_writes_count_last) {
  resetState();
  addCopyPasteMacro();
  handleConfigCommand("SAVE_MACROS", false);
  assert(mockChar.value == "OK SAVE_MACROS");
  assert(preferences.getUChar("num_macros", 0) == 1);
  // Neue Liste mit gleicher Anzahl und Länge (5 Schritte), aber das Schreiben der Daten scheitert
  handleConfigCommand("CLEAR_MACROS", false);
  handleConfigCommand("ADD_MACRO", false);
  for (int i = 0; i < 5; i++) handleConfigCommand("ADD_MACRO_STEP 1 120 0", false);
  Preferences::failBytesKey = "macros_data";
  handleConfigCommand("SAVE_MACROS", false);
  assert(mockChar.value == "ERR NVS SAVE_MACROS");
  // Ohne num_macros lädt der Start die einkompilierten Makros statt einer Mischung aus alt und neu
  assert(!preferences.isKey("num_macros"));
  Preferences::failBytesKey.clear();
  numMacros = 1;
  macroLengths[0] = 1;
  userMacros[0][0] = { MACRO_STEP_TAP, 'z', 0 };
  loadKeymapFromNVS();
  // Ohne die Reihenfolge lüde der Start die alten Daten (DOWN Cmd) unter der alten Anzahl
  assert(numMacros == 1 && macroLengths[0] == 1 && userMacros[0][0].code == 'z');
}

TEST(test_macro_live_edit_stops_running_macro) {
  for (int variant = 0; variant < 2; variant++) {
    resetState();
    handleConfigCommand("ADD_MACRO", false);
    handleConfigCommand("ADD_MACRO_STEP 2 129 0", false); // DOWN Shift
    handleConfigCommand("ADD_MACRO_STEP 4 0 1000", false);
    handleConfigCommand("ADD_MACRO_STEP 1 97 0", false);
    KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
    setMillis(1000);
    keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
    runTicks(1100);
    assert(macroRun.active);
    handleConfigCommand(variant == 0 ? "ADD_MACRO" : "ADD_MACRO_STEP 1 98 0", false);
    assert(!macroRun.active);
    std::vector<int> expected = { 129, -129 };            // Shift losgelassen, kein 'a' und kein 'b'
    runTicks(2500);
    assert(bleKeyboard.keyEvents == expected);
  }
}

TEST(test_macro_key_as_buffered_combo_candidate) {
  resetState();
  handleConfigCommand("ADD_MACRO", false);
  handleConfigCommand("ADD_MACRO_STEP 1 120 0", false);   // TAP 'x'
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
  KEYMAP[0][2][2] = 'k';
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  assert(!macroRun.active && bleKeyboard.keyEvents.empty()); // gepuffert
  runTicks(1000 + comboTimeoutMs);
  std::vector<int> expected = { 'x' };
  assert(bleKeyboard.keyEvents == expected);              // Combo-Fenster abgelaufen: Makro startet
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  runTicks(1200);
  expected = { 'x', -'x' };
  assert(bleKeyboard.keyEvents == expected);              // das Loslassen startet nicht erneut
}

TEST(test_macros_invalid_nvs_shapes_are_ignored) {
  resetState();
  // macro_lens hat eine falsche Länge
  Preferences::uintStore["num_macros"] = 2;
  Preferences::bytesStore["macro_lens"] = { 1 };
  Preferences::bytesStore["macros_data"] = std::vector<uint8_t>(sizeof(MacroStep), 0);
  numMacros = 1; macroLengths[0] = 1; userMacros[0][0] = { MACRO_STEP_TAP, 'z', 0 };
  loadKeymapFromNVS();
  assert(numMacros == 1 && macroLengths[0] == 1 && userMacros[0][0].code == 'z');
  // Eine Länge über MAX_MACRO_STEPS
  Preferences::uintStore["num_macros"] = 1;
  Preferences::bytesStore["macro_lens"] = { MAX_MACRO_STEPS + 1 };
  Preferences::bytesStore["macros_data"] = std::vector<uint8_t>((MAX_MACRO_STEPS + 1) * sizeof(MacroStep), 0);
  loadKeymapFromNVS();
  assert(numMacros == 1 && macroLengths[0] == 1 && userMacros[0][0].code == 'z');
  // Mehr Makros als MAX_MACROS
  Preferences::uintStore["num_macros"] = MAX_MACROS + 1;
  loadKeymapFromNVS();
  assert(numMacros == 1);
}

// Dokumentierte Grenze: ein UP-Schritt löst den Modifier am Host, auch wenn der Nutzer ihn physisch hält
TEST(test_macro_up_releases_physically_held_modifier) {
  resetState();
  handleConfigCommand("ADD_MACRO", false);
  handleConfigCommand("ADD_MACRO_STEP 3 129 0", false);   // UP Shift
  KEYMAP[0][3][0] = KEY_LEFT_SHIFT;
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
  setMillis(1000);
  keyState[3][0] = true; onMatrixKeyChange(3, 0, true);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  std::vector<int> expected = { KEY_LEFT_SHIFT, -KEY_LEFT_SHIFT };
  assert(bleKeyboard.keyEvents == expected);
  assert(bleKeyboard.pressedKeys.empty());
  assert(keySentToHost[3][0]);                            // die Taste gilt weiter als gehalten
}

// -----------------------------------------------------------------------------
// Makro wiederholen, solange die Taste gehalten wird (ADD_MACRO 1, userMacroRepeat)
// -----------------------------------------------------------------------------
static void addRepeatTapMacro(int repeat) {
  handleConfigCommand(repeat ? "ADD_MACRO 1" : "ADD_MACRO 0", false);
  handleConfigCommand("ADD_MACRO_STEP 1 120 0", false);   // TAP 'x'
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
}

static int countEvents(int ev) {
  int n = 0;
  for (int e : bleKeyboard.keyEvents) n += e == ev;
  return n;
}

TEST(test_macro_repeat_runs_multiple_passes_while_held) {
  resetState();
  addRepeatTapMacro(1);
  assert(mockChar.value == "OK ADD_MACRO_STEP 0 0");
  assert(userMacroRepeat[0]);
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  runTicks(1200);
  assert(macroRun.active && macroRun.repeat);
  assert(countEvents('x') >= 5);                          // mehrere Durchläufe
  assert(countEvents('x') == countEvents(-'x') || countEvents('x') == countEvents(-'x') + 1);
}

TEST(test_macro_repeat_stops_cleanly_on_release) {
  resetState();
  handleConfigCommand("ADD_MACRO 1", false);
  handleConfigCommand("ADD_MACRO_STEP 2 131 0", false);   // DOWN Cmd
  handleConfigCommand("ADD_MACRO_STEP 1 120 0", false);   // TAP 'x'
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  runTicks(1008);                                         // Cmd gedrückt, 'x' offen
  assert(macroRun.active);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  runTicks(1010);
  assert(!macroRun.active);
  assert(bleKeyboard.pressedKeys.empty());                // alle Codes losgelassen
  size_t n = bleKeyboard.keyEvents.size();
  runTicks(1300);
  assert(bleKeyboard.keyEvents.size() == n);              // danach läuft nichts mehr
}

TEST(test_macro_without_repeat_flag_plays_single_pass) {
  resetState();
  addRepeatTapMacro(0);
  assert(!userMacroRepeat[0]);
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  runTicks(1300);                                         // Taste bleibt gehalten
  assert(!macroRun.active);
  assert(countEvents('x') == 1 && countEvents(-'x') == 1);
  // ADD_MACRO ohne Argument = ein Durchlauf
  handleConfigCommand("ADD_MACRO", false);
  assert(!userMacroRepeat[1]);
}

TEST(test_macro_repeat_as_tap_of_hold_and_double_tap_key_plays_once) {
  // Mod-Tap: der Tipp löst erst beim Loslassen aus; die Taste ist dann nicht mehr gehalten, das Makro läuft einmal
  resetState();
  addRepeatTapMacro(1);
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
  HOLDMAP[0][2][1] = KEY_LEFT_SHIFT;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  advanceMillis(50);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  runTicks(1400);
  assert(!macroRun.active);
  assert(countEvents('x') == 1 && countEvents(-'x') == 1);

  // Doppel-Tipp: dieselbe Regel
  resetState();
  addRepeatTapMacro(1);
  KEYMAP[0][2][4] = 'l';
  DTAPMAP[0][2][4] = ACT_MACRO_BASE + 0;
  tapKeyAt(2, 4, 1000, 1050);
  setMillis(1100);
  keyState[2][4] = true; onMatrixKeyChange(2, 4, true);
  keyState[2][4] = false; onMatrixKeyChange(2, 4, false);
  runTicks(1600);
  assert(!macroRun.active);
  assert(countEvents('x') == 1 && countEvents(-'x') == 1);
}

TEST(test_macro_repeat_survives_layer_change_and_second_macro_key) {
  resetState();
  addRepeatTapMacro(1);
  handleConfigCommand("ADD_MACRO 0", false);
  handleConfigCommand("ADD_MACRO_STEP 1 121 0", false);   // Makro 1: TAP 'y'
  KEYMAP[0][2][2] = ACT_MACRO_BASE + 1;
  KEYMAP[0][3][0] = ACT_TG_BASE + 1;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  runTicks(1100);
  int before = countEvents('x');
  // Ebenenwechsel mitten im Lauf: die Taste bleibt gehalten, die Durchläufe gehen weiter
  keyState[3][0] = true; onMatrixKeyChange(3, 0, true);
  keyState[3][0] = false; onMatrixKeyChange(3, 0, false);
  // Zweite Makro-Taste während des Laufs: der Start entfällt, der Lauf bleibt ununterbrochen
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false);
  runTicks(1250);
  assert(macroRun.active && macroRun.repeat && macroRun.index == 0);
  assert(countEvents('x') > before && countEvents('y') == 0);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  runTicks(1260);
  assert(!macroRun.active && bleKeyboard.pressedKeys.empty());
}

TEST(test_macro_repeat_with_trailing_pause_restarts) {
  resetState();
  handleConfigCommand("ADD_MACRO 1", false);
  handleConfigCommand("ADD_MACRO_STEP 1 120 0", false);   // TAP 'x'
  handleConfigCommand("ADD_MACRO_STEP 4 0 20", false);    // PAUSE 20 ms als letzter Schritt
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  runTicks(1300);
  assert(macroRun.active && countEvents('x') >= 5);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  runTicks(1310);
  assert(!macroRun.active && bleKeyboard.pressedKeys.empty());
}

TEST(test_macro_repeat_stops_on_release_all_and_host_loss) {
  resetState();
  addRepeatTapMacro(1);
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  runTicks(1050);
  assert(macroRun.active);
  stopMacro(false);                                       // RELEASE_ALL-Pfad
  bleKeyboard.releaseAll();
  size_t n = bleKeyboard.keyEvents.size();
  runTicks(1200);
  assert(!macroRun.active && bleKeyboard.keyEvents.size() == n);   // Taste noch gehalten, kein Neustart

  resetState();
  addRepeatTapMacro(1);
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  runTicks(1050);
  assert(macroRun.active);
  bleKeyboard.connected = false;                          // Host verloren
  runTicks(1060);
  assert(!macroRun.active);
}

TEST(test_macro_repeat_flag_args_and_nvs) {
  resetState();
  handleConfigCommand("ADD_MACRO 2", false);
  assert(mockChar.value == "ERR ARGS ADD_MACRO 2" && numMacros == 0);
  handleConfigCommand("ADD_MACRO 1 1", false);
  assert(mockChar.value == "ERR ARGS ADD_MACRO 1 1" && numMacros == 0);
  handleConfigCommand("ADD_MACRO 99999999999999999999", false);
  assert(mockChar.value == "ERR ARGS ADD_MACRO 99999999999999999999" && numMacros == 0);
  handleConfigCommand("ADD_MACRO 01", false);
  assert(mockChar.value == "ERR ARGS ADD_MACRO 01" && numMacros == 0);
  handleConfigCommand("ADD_MACRO 1", false);
  assert(mockChar.value == "OK ADD_MACRO 0");
  handleConfigCommand("ADD_MACRO 0", false);
  handleConfigCommand("ADD_MACRO 1", false);
  handleConfigCommand("SAVE_MACROS", false);
  assert(mockChar.value == "OK SAVE_MACROS");
  assert(preferences.getBytesLength("macro_rep") == 3);
  for (int i = 0; i < MAX_MACROS; i++) userMacroRepeat[i] = false;
  numMacros = 0;
  loadKeymapFromNVS();
  assert(numMacros == 3 && userMacroRepeat[0] && !userMacroRepeat[1] && userMacroRepeat[2]);
  // Ohne Schlüssel (älterer Stand): kein Makro wiederholt
  Preferences::bytesStore.erase("macro_rep");
  loadKeymapFromNVS();
  assert(numMacros == 3 && !userMacroRepeat[0] && !userMacroRepeat[2]);
  handleConfigCommand("CLEAR_MACROS", false);
  assert(!userMacroRepeat[0]);
}

TEST(test_caps_word_combo_candidate_is_buffered) {
  // Ausgelöste Combo: Caps Word schaltet nicht um
  resetState();
  KEYMAP[0][2][1] = ACT_CAPS_WORD;
  KEYMAP[0][2][2] = 'k';
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  assert(bleKeyboard.oneShotEvents.empty());
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true);
  checkUserCombos();
  setMillis(1100);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false);
  checkUserCombos();
  runTicks(1300);
  assert(bleKeyboard.oneShotEvents.empty());

  // Schneller Einzeltipp: das Loslassen schaltet genau einmal um
  resetState();
  KEYMAP[0][2][1] = ACT_CAPS_WORD;
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
  tapKeyAt(2, 1, 1000, 1010);
  runTicks(1200);
  assert((bleKeyboard.oneShotEvents == std::vector<int>{0}));

  // Gehalten über das Combo-Fenster: processDeferredKeys schaltet um, das Loslassen nicht noch einmal
  resetState();
  KEYMAP[0][2][1] = ACT_CAPS_WORD;
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  runTicks(1000 + comboTimeoutMs);
  assert((bleKeyboard.oneShotEvents == std::vector<int>{0}));
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  assert((bleKeyboard.oneShotEvents == std::vector<int>{0}));

  // Halte-Aktion Caps Word als Combo-Kandidat: die Hold-Entscheidung schaltet einmal um
  resetState();
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = ACT_CAPS_WORD;
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  runTicks(1000 + TAPPING_TERM_MS + 1);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  runTicks(1500);
  assert((bleKeyboard.oneShotEvents == std::vector<int>{0}));
}

TEST(test_caps_word_press_without_host_does_not_toggle_on_release) {
  resetState();
  KEYMAP[0][2][1] = ACT_CAPS_WORD;                         // kein Combo-Kandidat
  bleKeyboard.connected = false;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  bleKeyboard.connected = true;                           // Host kommt zurück, bevor die Taste losgelassen wird
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.oneShotEvents.empty());
}

TEST(test_caps_word_combo_candidate_pressed_without_host_does_not_toggle) {
  resetState();
  KEYMAP[0][2][1] = ACT_CAPS_WORD;
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);   // Kandidat
  bleKeyboard.connected = false;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  bleKeyboard.connected = true;
  // Weder das Combo-Fenster noch das Loslassen schalten um
  runTicks(1000 + comboTimeoutMs + 5);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.oneShotEvents.empty());
  // Gegenprobe mit Host: schneller Tipp schaltet genau einmal um
  tapKeyAt(2, 1, 2000, 2010);
  assert((bleKeyboard.oneShotEvents == std::vector<int>{0}));
}

TEST(test_caps_word_hold_combo_candidate_without_host_does_not_toggle) {
  // Mod-Tap-Taste, Halten = Caps Word, Combo-Kandidat: dispatchPress der Hold-Aktion läuft ohne Host,
  // der Host kommt zurück, bevor das Combo-Fenster die gepufferte Aktion nachsendet
  resetState();
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = ACT_CAPS_WORD;
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  bleKeyboard.connected = false;
  setMillis(1000 + TAPPING_TERM_MS + 1);
  processDeferredKeys(millis());
  bleKeyboard.connected = true;
  runTicks(1500);
  assert(bleKeyboard.oneShotEvents.empty());

  // Gegenprobe mit Host: die Hold-Entscheidung schaltet genau einmal um, das Loslassen nicht noch einmal
  resetState();
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = ACT_CAPS_WORD;
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  runTicks(1000 + TAPPING_TERM_MS + 1);
  assert((bleKeyboard.oneShotEvents == std::vector<int>{0}));
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  assert((bleKeyboard.oneShotEvents == std::vector<int>{0}));
}

TEST(test_new_press_clears_stale_caps_word_flag) {
  resetState();
  KEYMAP[0][2][1] = 'a';
  capsWordBuffered[2][1] = true;                          // Rest eines früheren Drucks
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  assert(!capsWordBuffered[2][1]);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
}

TEST(test_invalid_macro_commands_keep_running_macro) {
  resetState();
  handleConfigCommand("ADD_MACRO", false);
  handleConfigCommand("ADD_MACRO_STEP 4 0 1000", false);
  handleConfigCommand("ADD_MACRO_STEP 1 97 0", false);
  for (int i = 1; i < MAX_MACROS; i++) handleConfigCommand("ADD_MACRO", false);
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  assert(macroRun.active);
  handleConfigCommand("ADD_MACRO_STEP 1 0 0", false);     // ungültiger Code
  assert(mockChar.value == "ERR ARGS ADD_MACRO_STEP 1 0 0");
  handleConfigCommand("ADD_MACRO", false);                // Liste voll
  assert(mockChar.value == "ERR ARGS ADD_MACRO");
  assert(macroRun.active);
  runTicks(2100);
  assert(countPresses('a') == 1);                         // das Makro lief zu Ende
}

// Gehaltene One-Shot-Tasten zählen nicht in heldModifierMask: das Umlaut löst und drückt keinen Modifier
TEST(test_umlaut_while_one_shot_key_held_sends_plain_sequence) {
  resetState();
  KEYMAP[0][5][1] = ACT_OSM_LSHIFT;
  KEYMAP[0][2][4] = ACT_UMLAUT_AE;
  setMillis(1000);
  keyState[5][1] = true; onMatrixKeyChange(5, 1, true);
  assert(heldModifierMask() == 0);
  keyState[2][4] = true; onMatrixKeyChange(2, 4, true);
  std::vector<int> expected = { KEY_LEFT_ALT, 'u', -'u', -KEY_LEFT_ALT, 'a', -'a' };
  assert(bleKeyboard.keyEvents == expected);
  assert((bleKeyboard.oneShotEvents == std::vector<int>{2}));
}

// -----------------------------------------------------------------------------
// Repeat (ACT_REPEAT): die zuletzt ausgeführte Aktion noch einmal
// -----------------------------------------------------------------------------
static void pressKey(uint8_t r, uint8_t c) { keyState[r][c] = true; onMatrixKeyChange(r, c, true); }
static void releaseKey(uint8_t r, uint8_t c) { keyState[r][c] = false; onMatrixKeyChange(r, c, false); }

TEST(test_repeat_after_macro_plays_the_same_macro) {
  resetState();
  addCopyPasteMacro();
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
  KEYMAP[0][2][2] = ACT_REPEAT;

  setMillis(1000);
  pressKey(2, 1);
  releaseKey(2, 1);
  runTicks(1200);
  std::vector<int> once = { 131, 'c', -'c', -131, 'v', -'v' };
  assert(bleKeyboard.keyEvents == once);

  bleKeyboard.keyEvents.clear();
  pressKey(2, 2);
  releaseKey(2, 2);
  runTicks(1400);
  assert(bleKeyboard.keyEvents == once);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_repeat_before_any_action_sends_nothing) {
  resetState();
  KEYMAP[0][2][2] = ACT_REPEAT;
  pressKey(2, 2);
  releaseKey(2, 2);
  assert(bleKeyboard.keyEvents.empty());
}

TEST(test_held_repeat_holds_the_last_key_until_release) {
  resetState();
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][2] = ACT_REPEAT;
  pressKey(2, 1);
  releaseKey(2, 1);
  bleKeyboard.keyEvents.clear();

  pressKey(2, 2);
  std::vector<int> expected = { 'a' };
  assert(bleKeyboard.keyEvents == expected);
  assert(bleKeyboard.pressedKeys.size() == 1);
  // Eine Taste dazwischen ändert nichts am Loslassen von Repeat
  KEYMAP[0][2][3] = 'b';
  pressKey(2, 3);
  releaseKey(2, 3);
  releaseKey(2, 2);
  assert(bleKeyboard.pressedKeys.empty());
  assert(bleKeyboard.keyEvents.back() == -'a');
}

TEST(test_repeat_repeats_the_newest_action_not_itself) {
  resetState();
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][2] = 'b';
  KEYMAP[0][2][3] = ACT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  tapKeyAt(2, 3, 1100, 1120);  // wiederholt 'a'
  tapKeyAt(2, 3, 1200, 1220);  // wiederholt wieder 'a', nicht Repeat
  tapKeyAt(2, 2, 1300, 1320);
  tapKeyAt(2, 3, 1400, 1420);  // wiederholt 'b'
  assert(countPresses('a') == 3);
  assert(countPresses('b') == 2);
}

TEST(test_repeat_ignores_layer_actions_and_lone_modifiers) {
  resetState();
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][2] = ACT_REPEAT;
  KEYMAP[0][2][3] = ACT_TG_1;
  KEYMAP[0][2][4] = ACT_MO_1;
  KEYMAP[0][2][5] = KEY_LEFT_SHIFT;
  tapKeyAt(2, 1, 1000, 1020);
  tapKeyAt(2, 3, 1100, 1120);
  tapKeyAt(2, 4, 1200, 1220);
  tapKeyAt(2, 5, 1300, 1320);
  toggleLayers[1] = false;
  bleKeyboard.keyEvents.clear();
  tapKeyAt(2, 2, 1400, 1420);
  assert(countPresses('a') == 2);
  assert(countPresses(KEY_LEFT_SHIFT) == 1); // nur der eigene Tipp, keine Wiederholung
}

TEST(test_repeat_repeats_key_pair_umlaut_media_and_mouse) {
  resetState();
  numKeyPairs = 1;
  userKeyPairs[0].first = KEY_LEFT_ALT;
  userKeyPairs[0].second = '*';
  KEYMAP[0][2][1] = ACT_KEY_PAIR_BASE;
  KEYMAP[0][2][2] = ACT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  bleKeyboard.keyEvents.clear();
  pressKey(2, 2);
  std::vector<int> pairDown = { KEY_LEFT_ALT, '*' };
  assert(bleKeyboard.keyEvents == pairDown);
  releaseKey(2, 2);
  std::vector<int> pairAll = { KEY_LEFT_ALT, '*', -'*', -KEY_LEFT_ALT };
  assert(bleKeyboard.keyEvents == pairAll);

  resetState();
  KEYMAP[0][2][1] = ACT_UMLAUT_AE;
  KEYMAP[0][2][2] = ACT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  std::vector<int> first = bleKeyboard.keyEvents;
  assert(!first.empty());
  bleKeyboard.keyEvents.clear();
  tapKeyAt(2, 2, 1100, 1120);
  assert(bleKeyboard.keyEvents == first);

  resetState();
  KEYMAP[0][2][1] = 0x122; // Vol+
  KEYMAP[0][2][2] = ACT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  assert(bleKeyboard.writtenMediaKeys.size() == 1);
  tapKeyAt(2, 2, 1100, 1120);
  assert(bleKeyboard.writtenMediaKeys.size() == 2);
  assert(bleKeyboard.writtenMediaKeys[0] == bleKeyboard.writtenMediaKeys[1]);

  resetState();
  KEYMAP[0][2][1] = 0x131; // Rechtsklick
  KEYMAP[0][2][2] = ACT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  bleKeyboard.clickedMouseButtons.clear();
  pressKey(2, 2);
  assert(bleKeyboard.mouseButtons == MOUSE_BUTTON_RIGHT);
  releaseKey(2, 2);
  assert(bleKeyboard.mouseButtons == 0);
}

TEST(test_repeat_repeats_one_shot_and_caps_word) {
  resetState();
  KEYMAP[0][2][1] = ACT_OSM_LSHIFT;
  KEYMAP[0][2][2] = ACT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  bleKeyboard.oneShotEvents.clear();
  pressKey(2, 2);
  releaseKey(2, 2);
  std::vector<int> expected = { 2, -2 };
  assert(bleKeyboard.oneShotEvents == expected);

  resetState();
  KEYMAP[0][2][1] = ACT_CAPS_WORD;
  KEYMAP[0][2][2] = ACT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  bleKeyboard.oneShotEvents.clear();
  tapKeyAt(2, 2, 1100, 1120);
  assert(bleKeyboard.oneShotEvents == std::vector<int>{0});
}

TEST(test_repeat_as_hold_and_double_tap_action_releases_the_resolved_action) {
  resetState();
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][2] = 'x';
  HOLDMAP[0][2][2] = ACT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  bleKeyboard.keyEvents.clear();

  setMillis(2000);
  pressKey(2, 2);
  runTicks(2000 + TAPPING_TERM_MS + 10);
  assert(countPresses('a') == 2);       // Halten wiederholt 'a'
  assert(countPresses('x') == 0);
  releaseKey(2, 2);
  assert(bleKeyboard.pressedKeys.empty());

  resetState();
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][2] = 'x';
  DTAPMAP[0][2][2] = ACT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  setMillis(2000);
  pressKey(2, 2);
  releaseKey(2, 2);
  setMillis(2050);
  pressKey(2, 2);                        // zweiter Tipp: Doppel-Tipp-Aktion wiederholt 'a'
  assert(countPresses('a') == 2);
  releaseKey(2, 2);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_repeat_repeats_a_combo_action) {
  resetState();
  KEYMAP[0][2][2] = ACT_REPEAT;
  handleConfigCommand("ADD_COMBO 2 0 2 1 0 122", false); // KEY_PRESS 'z'
  assert(numCombos == 1);
  setMillis(1000);
  pressKey(2, 0);
  pressKey(2, 1);
  checkUserCombos();
  releaseKey(2, 0);
  releaseKey(2, 1);
  setMillis(2000);
  bleKeyboard.keyEvents.clear();
  bleKeyboard.writtenKeys.clear();
  tapKeyAt(2, 2, 2000, 2020);
  assert(bleKeyboard.keyEvents.size() == 2 && bleKeyboard.keyEvents[0] == 'z');
}

TEST(test_add_combo_accepts_repeat_only_as_key_press) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 0 2 1 0 361", false);
  assert(numCombos == 1);
  handleConfigCommand("ADD_COMBO 2 0 2 1 1 361", false);   // MODIFIER_HOLD
  assert(numCombos == 1);
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
}

TEST(test_repeat_without_host_sends_nothing_and_keeps_the_record) {
  resetState();
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][2] = ACT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  bleKeyboard.connected = false;
  bleKeyboard.keyEvents.clear();
  tapKeyAt(2, 2, 1100, 1120);
  assert(bleKeyboard.keyEvents.empty());
  bleKeyboard.connected = true;
  assert(lastRepeatAction == 'a');
}

TEST(test_repeat_remote_hook_hands_the_repeat_to_the_other_half) {
  resetState();
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][2] = ACT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  bleKeyboard.keyEvents.clear();
  testRemoteTakesRepeat = true;
  pressKey(2, 2);
  assert(bleKeyboard.keyEvents.empty());                       // die andere Hälfte führt aus, diese sendet nichts
  assert((testRemoteCalls == std::vector<std::string>{"press22"}));
  releaseKey(2, 2);
  assert((testRemoteCalls == std::vector<std::string>{"press22", "release22"}));
  assert(bleKeyboard.keyEvents.empty());
}

TEST(test_remote_repeat_is_released_even_without_host_or_after_a_combo) {
  resetState();
  KEYMAP[0][2][2] = ACT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  KEYMAP[0][2][1] = 'a';
  tapKeyAt(2, 1, 1030, 1050);
  testRemoteTakesRepeat = true;
  pressKey(2, 2);
  assert((testRemoteCalls == std::vector<std::string>{"press22"}));
  // Mac weg, bevor die Taste losgelassen wird: die andere Hälfte muss trotzdem ihr Loslassen bekommen
  bleKeyboard.setDisconnected();
  releaseKey(2, 2);
  assert((testRemoteCalls == std::vector<std::string>{"press22", "release22"}));
  bleKeyboard.connected = true;
  // Eine Combo verbraucht die Taste mitten im Halten: cancelTapHoldForCombo löst die Wiederholung
  testRemoteCalls.clear();
  HOLDMAP[0][2][3] = ACT_REPEAT;
  KEYMAP[0][2][3] = 'x';
  handleConfigCommand("ADD_COMBO 2 3 2 4 0 122", false);
  setMillis(3000);
  pressKey(2, 3);
  runTicks(3000 + TAPPING_TERM_MS + 10);                       // Halten gilt: REPEAT läuft
  assert((testRemoteCalls == std::vector<std::string>{"press23"}));
  // Eine Combo verbraucht die Taste (checkUserCombos ruft diesen Abbruch auf): die Wiederholung endet
  cancelTapHoldForCombo(2, 3);
  assert(testRemoteCalls.size() == 2 && testRemoteCalls[1] == "release23");
  assert(!repeatRemote[2][3]);
}

TEST(test_combo_member_keys_are_not_recorded_as_the_last_action) {
  resetState();
  KEYMAP[0][2][0] = 'a';           // Mitglied der Combo, wird nie einzeln gesendet
  KEYMAP[0][2][1] = 'b';           // Mitglied der Combo
  KEYMAP[0][2][2] = 'c';           // normale Taste davor
  KEYMAP[0][2][3] = ACT_REPEAT;
  tapKeyAt(2, 2, 1000, 1020);      // letzte echte Aktion: 'c'
  handleConfigCommand("ADD_COMBO 2 0 2 1 0 361", false);   // Combo: KEY_PRESS REPEAT
  assert(numCombos == 1);
  bleKeyboard.keyEvents.clear();
  setMillis(2000);
  pressKey(2, 0);
  pressKey(2, 1);
  checkUserCombos();
  // Die Combo wiederholt 'c', nicht ihre eigene Mitgliedstaste 'a' oder 'b'
  assert(countPresses('c') == 2);
  assert(countPresses('a') == 0 && countPresses('b') == 0);
  assert(lastRepeatAction == 'c');
  releaseKey(2, 0);
  releaseKey(2, 1);
}

TEST(test_layer_toggle_combo_leaves_the_last_action_unchanged) {
  resetState();
  KEYMAP[0][2][0] = 'a';
  KEYMAP[0][2][1] = 'b';
  KEYMAP[0][2][2] = 'c';
  tapKeyAt(2, 2, 1000, 1020);
  int before = testRecorded;
  handleConfigCommand("ADD_COMBO 2 0 2 1 2 1", false);     // LAYER_TOGGLE auf Ebene 1
  setMillis(2000);
  pressKey(2, 0);
  pressKey(2, 1);
  checkUserCombos();
  assert(lastRepeatAction == 'c');
  assert(testRecorded == before);                          // weder die Combo noch ihre Mitglieder zählen
  releaseKey(2, 0);
  releaseKey(2, 1);
}

TEST(test_buffered_combo_candidate_records_when_it_is_sent) {
  resetState();
  KEYMAP[0][2][0] = 'a';
  KEYMAP[0][2][1] = 'b';
  handleConfigCommand("ADD_COMBO 2 0 2 1 0 122", false);
  setMillis(1000);
  pressKey(2, 0);                                          // Kandidat: noch nichts gesendet, nichts aufgezeichnet
  assert(lastRepeatAction == 0);
  runTicks(1000 + comboTimeoutMs + 5);                     // Combo-Fenster abgelaufen: 'a' geht raus
  assert(lastRepeatAction == 'a');
  releaseKey(2, 0);
  // Ein schneller Tipp (Release im Fenster) sendet beim Loslassen und zählt dann
  resetState();
  KEYMAP[0][2][0] = 'a';
  handleConfigCommand("ADD_COMBO 2 0 2 1 0 122", false);
  tapKeyAt(2, 0, 5000, 5010);
  assert(lastRepeatAction == 'a');
}

TEST(test_actions_without_host_are_not_recorded) {
  resetState();
  KEYMAP[0][2][1] = 'a';
  bleKeyboard.setDisconnected();
  tapKeyAt(2, 1, 1000, 1020);
  assert(lastRepeatAction == 0 && testRecorded == 0);
  bleKeyboard.connected = true;
  tapKeyAt(2, 1, 1100, 1120);
  assert(lastRepeatAction == 'a' && testRecorded >= 1);
}

TEST(test_clear_pairs_during_held_repeat_releases_the_pair) {
  resetState();
  numKeyPairs = 1;
  userKeyPairs[0].first = KEY_LEFT_ALT;
  userKeyPairs[0].second = '*';
  KEYMAP[0][2][1] = ACT_KEY_PAIR_BASE;
  KEYMAP[0][2][2] = ACT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  pressKey(2, 2);
  assert(bleKeyboard.pressedKeys.size() == 2);
  handleConfigCommand("CLEAR_PAIRS", false);
  assert(bleKeyboard.pressedKeys.empty());                 // das Paar ist gelöst, bevor die Tabelle sich ändert
  assert(testPairReleases >= 1);
  releaseKey(2, 2);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_config_combo_keys_are_not_recorded) {
  resetState();
  KEYMAP[0][0][0] = 'x';                                   // erste Config-Combo-Taste (rechts R0C0)
  KEYMAP[0][4][5] = 'y';                                   // zweite (R4C5)
  KEYMAP[0][2][1] = 'a';
  tapKeyAt(2, 1, 1000, 1020);
  setMillis(2000);
  pressKey(0, 0);                                          // wird aufgezeichnet: die andere Taste fehlt noch
  assert(lastRepeatAction == 'x');
  lastRepeatAction = 'a';
  pressKey(4, 5);                                          // beide gehalten: diese Taste geht nicht an den Host
  assert(isConfigComboSuppressed(4, 5));
  assert(lastRepeatAction == 'a');
  releaseKey(4, 5);
  releaseKey(0, 0);
}


TEST(test_one_shot_candidate_is_recorded_unless_a_combo_consumed_it) {
  resetState();
  KEYMAP[0][2][0] = ACT_OSM_LSHIFT;
  handleConfigCommand("ADD_COMBO 2 0 2 1 0 122", false);   // die One-Shot-Taste ist ein Combo-Kandidat
  tapKeyAt(2, 0, 1000, 1020);
  assert(lastRepeatAction == ACT_OSM_LSHIFT);
  // Löst die Combo aus, verbraucht sie die Taste: nichts wird aufgezeichnet
  resetState();
  KEYMAP[0][2][0] = ACT_OSM_LSHIFT;
  KEYMAP[0][2][1] = 'b';
  handleConfigCommand("ADD_COMBO 2 0 2 1 0 122", false);
  setMillis(2000);
  pressKey(2, 0);
  pressKey(2, 1);
  checkUserCombos();
  releaseKey(2, 0);
  releaseKey(2, 1);
  assert(lastRepeatAction == 'z');                         // nur die Aktion der Combo zählt
}


// -----------------------------------------------------------------------------
// Mod-Tap über beide Hälften, Master-Seite: ein Druck der linken Hälfte entscheidet offene Mod-Tap-Tasten als Halten
// (resolveAllPendingTapHoldsAsHold, anyTapHoldPending)
// -----------------------------------------------------------------------------
TEST(test_cross_half_press_decides_open_mod_tap_key_as_hold_layer) {
  resetState();
  // Rechts R5C0: Tap = Delete, Hold = MO_1. Die linke Taste meldet sich, bevor der Tapping-Term abläuft.
  KEYMAP[0][5][0] = KEY_DELETE;
  HOLDMAP[0][5][0] = ACT_MO_1;
  setMillis(1000);
  keyState[5][0] = true;
  onMatrixKeyChange(5, 0, true);
  assert(anyTapHoldPending() && getActiveLayer() == 0);
  assert(bleKeyboard.pressHistory.empty());                  // unentschieden: nichts am Host
  // Ein Druck der anderen Hälfte (onSplitBeforeLeftPress): vor ihm entscheiden
  setMillis(1030);
  resolveAllPendingTapHoldsAsHold();
  assert(!anyTapHoldPending());
  assert(getActiveLayer() == 1 && momentaryLayers[1]);       // die linke Taste sieht Ebene 1
  assert(bleKeyboard.pressHistory.empty());                  // auch jetzt kein Delete: der Tipp entfällt
  // Loslassen nach der Entscheidung: kein nachträglicher Tipp (Delete)
  setMillis(1200);
  keyState[5][0] = false;
  onMatrixKeyChange(5, 0, false);
  assert(bleKeyboard.pressHistory.empty());
  assert(getActiveLayer() == 0 && !momentaryLayers[1]);
}

TEST(test_cross_half_press_without_hold_action_changes_nothing) {
  resetState();
  KEYMAP[0][2][1] = 'j';
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  assert(!anyTapHoldPending());
  resolveAllPendingTapHoldsAsHold();                          // nichts offen
  assert(getActiveLayer() == 0);
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == 'j');
}

TEST(test_cross_half_press_decides_every_open_key_not_only_one) {
  resetState();
  // Zwei offene Mod-Tap-Tasten (Ctrl und Layer): beide gelten als Halten
  KEYMAP[0][5][3] = ' ';
  HOLDMAP[0][5][3] = KEY_LEFT_CTRL;
  KEYMAP[0][5][0] = KEY_DELETE;
  HOLDMAP[0][5][0] = ACT_MO_2;
  setMillis(1000);
  keyState[5][3] = true;
  onMatrixKeyChange(5, 3, true);
  setMillis(1010);
  keyState[5][0] = true;                                      // die zweite Taste entscheidet die erste schon
  onMatrixKeyChange(5, 0, true);
  assert(tapHold[5][3].holdActive && tapHold[5][0].pending);   // eine ist offen
  assert(anyTapHoldPending());
  setMillis(1020);
  resolveAllPendingTapHoldsAsHold();
  assert(!anyTapHoldPending() && tapHold[5][0].holdActive);
  assert(getActiveLayer() == 2);
}

TEST(test_cross_half_resolve_after_tap_decision_is_a_noop) {
  resetState();
  // Die Taste ist schon als Tipp entschieden (schnell losgelassen): ein späteres HOLD_RESOLVE ändert nichts
  KEYMAP[0][5][0] = KEY_DELETE;
  HOLDMAP[0][5][0] = ACT_MO_1;
  setMillis(1000);
  keyState[5][0] = true;
  onMatrixKeyChange(5, 0, true);
  setMillis(1050);
  keyState[5][0] = false;
  onMatrixKeyChange(5, 0, false);
  assert(!anyTapHoldPending());
  size_t history = bleKeyboard.pressHistory.size();
  resolveAllPendingTapHoldsAsHold();
  assert(bleKeyboard.pressHistory.size() == history && getActiveLayer() == 0);
}

TEST(test_cross_half_resolve_is_idempotent) {
  resetState();
  KEYMAP[0][5][0] = KEY_DELETE;
  HOLDMAP[0][5][0] = ACT_MO_1;
  setMillis(1000);
  keyState[5][0] = true;
  onMatrixKeyChange(5, 0, true);
  resolveAllPendingTapHoldsAsHold();
  resolveAllPendingTapHoldsAsHold();                          // ein Retry-Duplikat von HOLD_RESOLVE
  assert(getActiveLayer() == 1 && !anyTapHoldPending() && bleKeyboard.pressHistory.empty());
}

TEST(test_cross_half_combo_clears_pending_state) {
  resetState();
  // Eine Combo verbraucht die Taste: kein offener Zustand bleibt, der die andere Hälfte bremst
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  setMillis(1000);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  assert(anyTapHoldPending());
  cancelTapHoldForCombo(2, 1);
  assert(!anyTapHoldPending());
}

// -----------------------------------------------------------------------------
// Mausbewegung: gehaltene Taste bewegt den Zeiger mit wachsender Geschwindigkeit
// -----------------------------------------------------------------------------
TEST(test_mouse_move_accelerates_while_held_and_stops_at_release) {
  resetState();
  KEYMAP[0][2][1] = ACT_MOUSE_RIGHT_MOVE;
  KEYMAP[0][2][2] = ACT_MOUSE_UP;
  setMillis(1000);
  applyMatrixKeyChange(2, 1, true, 1000);
  assert(bleKeyboard.mouseMoves.empty());
  processDeferredKeys(1010);
  processDeferredKeys(1100);
  processDeferredKeys(1500);
  processDeferredKeys(2500);
  assert(bleKeyboard.mouseMoves.size() == 4);
  assert(bleKeyboard.mouseMoves[0].first == 1 && bleKeyboard.mouseMoves[0].second == 0);
  // wächst mit der Haltezeit und endet bei MOUSE_MOVE_MAX_STEP
  assert(bleKeyboard.mouseMoves[1].first > bleKeyboard.mouseMoves[0].first);
  assert(bleKeyboard.mouseMoves[2].first > bleKeyboard.mouseMoves[1].first);
  assert(bleKeyboard.mouseMoves[3].first == MOUSE_MOVE_MAX_STEP);
  // Loslassen stoppt sofort
  applyMatrixKeyChange(2, 1, false, 2600);
  size_t n = bleKeyboard.mouseMoves.size();
  processDeferredKeys(2700);
  processDeferredKeys(3000);
  assert(bleKeyboard.mouseMoves.size() == n);
  // Neue Bewegung startet wieder bei Schritt 1; zwei Tasten summieren sich
  setMillis(3000);
  applyMatrixKeyChange(2, 1, true, 3000);
  applyMatrixKeyChange(2, 2, true, 3000);
  processDeferredKeys(3010);
  assert(bleKeyboard.mouseMoves.back().first == 1 && bleKeyboard.mouseMoves.back().second == -1);
}

TEST(test_mouse_move_sends_nothing_without_host_and_keeps_no_state_in_standing_keys) {
  resetState();
  KEYMAP[0][2][1] = ACT_MOUSE_DOWN;
  bleKeyboard.mouseMoves.clear();
  bleKeyboard.connected = false;
  setMillis(1000);
  applyMatrixKeyChange(2, 1, true, 1000);
  processDeferredKeys(1100);
  assert(bleKeyboard.mouseMoves.empty());
  applyMatrixKeyChange(2, 1, false, 1200);
  bleKeyboard.connected = true;
  processDeferredKeys(1300);
  assert(bleKeyboard.mouseMoves.empty());
}

TEST(test_mouse_move_key_in_combo_does_not_move) {
  resetState();
  KEYMAP[0][2][1] = ACT_MOUSE_LEFT_MOVE;
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 97", false);
  bleKeyboard.mouseMoves.clear();
  setMillis(1000);
  applyMatrixKeyChange(2, 1, true, 1000);
  applyMatrixKeyChange(2, 2, true, 1010);
  checkUserCombos();
  processDeferredKeys(1100);
  processDeferredKeys(1500);
  assert(bleKeyboard.mouseMoves.empty());
}

TEST(test_mouse_move_is_not_repeatable) {
  assert(!isRepeatableAction(ACT_MOUSE_UP));
}

TEST(test_add_combo_rejects_mouse_move) {
  resetState();
  for (int act = ACT_MOUSE_UP; act <= ACT_MOUSE_RIGHT_MOVE; act++) {
    handleConfigCommand("ADD_COMBO 2 1 2 2 0 " + String(act), false);
    assert(numCombos == 0);
  }
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 " + String(ACT_MOUSE_WHEEL_UP), false);
  assert(numCombos == 1);
}

// Mod-Tap: Halten löst die Bewegung aus, Loslassen beendet sie; ein Tipp bewegt nichts
TEST(test_mouse_move_as_hold_action_moves_and_stops) {
  resetState();
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = ACT_MOUSE_DOWN;
  bleKeyboard.mouseMoves.clear();
  setMillis(1000);
  keyState[2][1] = true;
  applyMatrixKeyChange(2, 1, true, 1000);
  processDeferredKeys(1100);
  assert(bleKeyboard.mouseMoves.empty());          // noch im Tapping-Term
  setMillis(1300);
  processDeferredKeys(1300);                       // Tapping-Term abgelaufen: Halten gilt
  processDeferredKeys(1400);
  assert(!bleKeyboard.mouseMoves.empty());
  assert(bleKeyboard.mouseMoves.back().first == 0 && bleKeyboard.mouseMoves.back().second > 0);
  keyState[2][1] = false;
  applyMatrixKeyChange(2, 1, false, 1450);
  size_t n = bleKeyboard.mouseMoves.size();
  processDeferredKeys(1600);
  assert(bleKeyboard.mouseMoves.size() == n);
}

// Ein Layer-Wechsel zwischen Drücken und Loslassen lässt die Bewegung nicht hängen (Release folgt pressedAction)
TEST(test_mouse_move_release_after_layer_change_stops_movement) {
  resetState();
  KEYMAP[0][2][1] = ACT_MOUSE_LEFT_MOVE;
  KEYMAP[1][2][1] = 'b';
  setMillis(1000);
  keyState[2][1] = true;
  applyMatrixKeyChange(2, 1, true, 1000);
  processDeferredKeys(1010);
  assert(bleKeyboard.mouseMoves.size() == 1);
  toggleLayers[1] = true;
  keyState[2][1] = false;
  applyMatrixKeyChange(2, 1, false, 1100);
  size_t n = bleKeyboard.mouseMoves.size();
  processDeferredKeys(1200);
  assert(bleKeyboard.mouseMoves.size() == n);
  assert(!mouseMoveActive[2][1]);
}

// Host-Verlust mitten im Halten: nichts wird gesendet, nach dem Wiederverbinden beginnt die Beschleunigung neu
TEST(test_mouse_move_host_loss_restarts_acceleration) {
  resetState();
  KEYMAP[0][2][1] = ACT_MOUSE_RIGHT_MOVE;
  setMillis(1000);
  keyState[2][1] = true;
  applyMatrixKeyChange(2, 1, true, 1000);
  processDeferredKeys(2500);
  assert(bleKeyboard.mouseMoves.back().first == MOUSE_MOVE_MAX_STEP);
  bleKeyboard.mouseMoves.clear();
  bleKeyboard.connected = false;
  processDeferredKeys(3000);
  processDeferredKeys(4000);
  assert(bleKeyboard.mouseMoves.empty());
  bleKeyboard.connected = true;
  processDeferredKeys(4010);
  processDeferredKeys(4020);
  assert(!bleKeyboard.mouseMoves.empty());
  assert(bleKeyboard.mouseMoves.front().first == 1);
  keyState[2][1] = false;
  applyMatrixKeyChange(2, 1, false, 4100);
}

// -----------------------------------------------------------------------------
// BLE Connection Parameters & Standby Power Saving
// -----------------------------------------------------------------------------

TEST(test_ble_conn_params_apple_guidelines_compliance) {
  // Apple Accessory Design Guidelines for BLE:
  // 1. Interval Max * (Slave Latency + 1) <= 2 s
  // 2. Interval Min >= 15 ms OR Interval Min in {7.5 ms, 11.25 ms, 15 ms, ...}
  // 3. (Interval Min + 15 ms <= Interval Max) OR (Interval Min == Interval Max)
  // 4. Slave Latency <= 30
  // 5. connSupervisionTimeout <= 6 s (600 in 10 ms units)
  // 6. Interval Max * (Slave Latency + 1) * 3 < connSupervisionTimeout
  const BleConnParams active = bleConnParamsForStandby(false);
  const BleConnParams standby = bleConnParamsForStandby(true);

  // Active Profile: Fast typing response
  assert(active.min_int == 6);      // 7.5 ms
  assert(active.max_int == 18);     // 22.5 ms (min + 15 ms <= max for Apple guidelines)
  assert(active.latency == 0);      // No latency during active typing
  assert(active.timeout == 400);    // 4000 ms

  double activeMaxMs = active.max_int * 1.25;
  double activeEffMs = activeMaxMs * (active.latency + 1);
  double activeTimeoutMs = active.timeout * 10.0;
  assert(activeEffMs <= 2000.0);
  assert(active.latency <= 30);
  assert(activeTimeoutMs <= 6000.0);
  assert(activeEffMs * 3.0 < activeTimeoutMs);
  assert(active.min_int == active.max_int || active.min_int * 1.25 + 15.0 <= activeMaxMs);

  // Standby Profile: Skip up to 20 connection intervals when idle (~315..630 ms)
  assert(standby.min_int == 12);    // 15 ms
  assert(standby.max_int == 24);    // 30 ms
  assert(standby.latency == 20);    // Skips up to 20 empty intervals
  assert(standby.timeout == 400);   // 4000 ms

  double standbyMaxMs = standby.max_int * 1.25;
  double standbyEffMs = standbyMaxMs * (standby.latency + 1); // 30 ms * 21 = 630 ms
  double standbyTimeoutMs = standby.timeout * 10.0;           // 4000 ms
  assert(standbyEffMs <= 2000.0);
  assert(standby.latency <= 30);
  assert(standbyTimeoutMs <= 6000.0);
  assert(standbyEffMs * 3.0 < standbyTimeoutMs);              // 1890 ms < 4000 ms
  assert(standby.min_int * 1.25 + 15.0 <= standbyMaxMs);     // 15 ms + 15 ms <= 30 ms
}

TEST(test_ble_conn_param_tracker_transitions) {
  BleConnParamTracker tracker;
  bleConnInitTracker(tracker);
  assert(!tracker.hasPeer);
  assert(!tracker.inStandby);
  assert(!tracker.appliedValid);

  BleConnParams req = {};
  // 1. Changing standby before any peer is connected does not emit request
  assert(!bleConnTrackStandby(tracker, true, req));
  assert(tracker.inStandby == true);

  // 2. Peer connects while in standby -> immediately requests standby parameters
  uint8_t mac[6] = {0x11, 0x22, 0x33, 0x44, 0x55, 0x66};
  assert(bleConnTrackConnect(tracker, mac, req));
  assert(tracker.hasPeer);
  assert(req.latency == BLE_CONN_STANDBY_LATENCY);
  bleConnTrackResult(tracker, req, true);
  assert(tracker.appliedValid);

  // 3. Repeated standby call with identical parameters -> suppressed
  assert(!bleConnTrackStandby(tracker, true, req));

  // 4. Exit standby -> requests active parameters
  assert(bleConnTrackStandby(tracker, false, req));
  assert(req.latency == BLE_CONN_ACTIVE_LATENCY);
  bleConnTrackResult(tracker, req, true);

  // 5. Repeated active call -> suppressed
  assert(!bleConnTrackStandby(tracker, false, req));

  // 6. Disconnect clears peer and applied state
  bleConnTrackDisconnect(tracker);
  assert(!tracker.hasPeer);
  assert(!tracker.appliedValid);

  // 7. Reconnect -> requests active parameters again
  assert(bleConnTrackConnect(tracker, mac, req));
  assert(req.latency == BLE_CONN_ACTIVE_LATENCY);
}

TEST(test_ble_keyboard_standby_mode_requests) {
  BleKeyboard mockKbd("Test", "Dactyl", 100);
  mockKbd.disconnectPeer();
  mockKbd.connParamRequests.clear();

  // No requests when disconnected
  mockKbd.setStandbyMode(true);
  assert(mockKbd.connParamRequests.empty());

  // Connect peer -> requests standby profile because standby was set
  mockKbd.connectPeer();
  assert(mockKbd.connParamRequests.size() == 1);
  assert(mockKbd.connParamRequests.back().latency == BLE_CONN_STANDBY_LATENCY);

  // Return to active mode
  mockKbd.setStandbyMode(false);
  assert(mockKbd.connParamRequests.size() == 2);
  assert(mockKbd.connParamRequests.back().latency == BLE_CONN_ACTIVE_LATENCY);

  // Transition back to standby
  mockKbd.setStandbyMode(true);
  assert(mockKbd.connParamRequests.size() == 3);
  assert(mockKbd.connParamRequests.back().latency == BLE_CONN_STANDBY_LATENCY);

  // Redundant transition does not send duplicate request
  mockKbd.setStandbyMode(true);
  assert(mockKbd.connParamRequests.size() == 3);
}

TEST(test_ble_conn_param_retry_on_failure) {
  BleKeyboard mockKbd("Test", "Dactyl", 100);
  mockKbd.connectPeer();
  mockKbd.connParamRequests.clear();

  // Simulate GAP update failure during standby transition
  mockKbd.failConnUpdate = true;
  mockKbd.setStandbyMode(true);
  assert(mockKbd.connParamRequests.size() == 1);
  assert(!bleConnParamsEqual(mockKbd.connTracker.applied, bleConnParamsForStandby(true)));

  // Because previous attempt failed, next attempt retries instead of suppressing
  mockKbd.failConnUpdate = false;
  mockKbd.setStandbyMode(true);
  assert(mockKbd.connParamRequests.size() == 2);
  assert(bleConnParamsEqual(mockKbd.connTracker.applied, bleConnParamsForStandby(true)));

  // Now that it succeeded, next call is suppressed
  mockKbd.setStandbyMode(true);
  assert(mockKbd.connParamRequests.size() == 2);
}

TEST(test_hold_tap_mode_hold_on_other_key_press) {
  resetState();
  holdTapMode = 0; // HOLD_MODE_OTHER_KEY_PRESS
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'b';

  // Rolled typing: A down -> B down -> A up -> B up (all within tapping term)
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000); // Mod-Tap A down
  setMillis(1050);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1050); // B down
  setMillis(1080);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1080); // A up
  setMillis(1120);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1120); // B up

  // In Mode 0: B down immediately forced A to Hold (Ctrl + B)
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == KEY_LEFT_CTRL);
  assert(bleKeyboard.pressHistory[1] == 'b');
}


// Hold-Tap-Variante je Taste (HOLDFLAVORMAP, SET_KF): 0 = holdTapMode der Hälfte, 1..3 = fester Modus
// Rollen A down, B down, A up, B up: Modus 0 ergibt Ctrl + B, Permissive und Tap Preferred ergeben a, b.
static void holdFlavorRoll(uint8_t keyRow, uint8_t keyCol) {
  setMillis(1000);
  keyState[keyRow][keyCol] = true; onMatrixKeyChange(keyRow, keyCol, true, 1000);
  setMillis(1050);
  keyState[2][5] = true; onMatrixKeyChange(2, 5, true, 1050);
  setMillis(1080);
  keyState[keyRow][keyCol] = false; onMatrixKeyChange(keyRow, keyCol, false, 1080);
  setMillis(1120);
  keyState[2][5] = false; onMatrixKeyChange(2, 5, false, 1120);
}

TEST(test_hold_flavor_per_key_overrides_only_that_key) {
  resetState();
  holdTapMode = 0;                       // Hälfte: sofort bei zweiter Taste
  KEYMAP[0][2][1] = 'a'; HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'c'; HOLDMAP[0][2][2] = KEY_LEFT_CTRL;
  KEYMAP[0][2][5] = 'b';
  handleConfigCommand("SET_KF 0 2 1 2", false);   // nur R2C1: Permissive (Modus 1 + 1)
  assert(HOLDFLAVORMAP[0][2][1] == 2 && HOLDFLAVORMAP[0][2][2] == 0);

  holdFlavorRoll(2, 1);                  // R2C1 mit eigener Variante: Rollen ergibt a, b
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == 'a' && bleKeyboard.pressHistory[1] == 'b');

  resetState();
  holdTapMode = 0;
  KEYMAP[0][2][1] = 'a'; HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'c'; HOLDMAP[0][2][2] = KEY_LEFT_CTRL;
  KEYMAP[0][2][5] = 'b';
  handleConfigCommand("SET_KF 0 2 1 2", false);
  holdFlavorRoll(2, 2);                  // R2C2 ohne Variante bleibt beim Modus der Hälfte: Ctrl + b
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == KEY_LEFT_CTRL && bleKeyboard.pressHistory[1] == 'b');
}

TEST(test_hold_flavor_per_key_overrides_half_mode_both_ways) {
  // Hälfte Permissive, Taste auf "sofort bei zweiter Taste" (Wert 1): nur diese Taste wird Ctrl
  resetState();
  holdTapMode = 1;
  KEYMAP[0][2][1] = 'a'; HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'c'; HOLDMAP[0][2][2] = KEY_LEFT_CTRL;
  KEYMAP[0][2][5] = 'b';
  handleConfigCommand("SET_KF 0 2 1 1", false);
  holdFlavorRoll(2, 1);
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == KEY_LEFT_CTRL && bleKeyboard.pressHistory[1] == 'b');

  resetState();
  holdTapMode = 1;
  KEYMAP[0][2][1] = 'a'; HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'c'; HOLDMAP[0][2][2] = KEY_LEFT_CTRL;
  KEYMAP[0][2][5] = 'b';
  handleConfigCommand("SET_KF 0 2 1 1", false);
  holdFlavorRoll(2, 2);                  // Taste ohne Variante: Permissive der Hälfte, Rollen ergibt a/c, b
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == 'c' && bleKeyboard.pressHistory[1] == 'b');
}

TEST(test_hold_flavor_per_key_tap_preferred_buffers_next_key) {
  // Hälfte "sofort", Taste Tap Preferred (Wert 3): der nächste Druck wird gepuffert, Rollen ergibt a, b
  resetState();
  holdTapMode = 0;
  KEYMAP[0][2][1] = 'a'; HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][5] = 'b';
  handleConfigCommand("SET_KF 0 2 1 3", false);
  holdFlavorRoll(2, 1);
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == 'a' && bleKeyboard.pressHistory[1] == 'b');
}

TEST(test_hold_flavor_per_key_mixed_pending_keys_resolve_by_own_mode) {
  // Zwei offene Tasten: R2C1 Modus 0 (Hälfte), R2C2 Tap Preferred. Ein Druck löst nur R2C1 als Hold.
  resetState();
  holdTapMode = 0;
  KEYMAP[0][2][1] = 'a'; HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'c'; HOLDMAP[0][2][2] = KEY_LEFT_SHIFT;
  KEYMAP[0][2][5] = 'b';
  handleConfigCommand("SET_KF 0 2 2 3", false);
  setMillis(1000);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1000);   // Tap Preferred, offen
  setMillis(1010);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1010);   // wird gepuffert, solange R2C2 offen ist
  assert(tapHold[2][2].pending);
  setMillis(1500);                                              // Tapping-Term abgelaufen: R2C2 wird Hold
  tapHoldTick(1500);
  assert(tapHold[2][2].holdActive);
}

TEST(test_hold_flavor_per_key_release_path_uses_key_mode) {
  // Hälfte Modus 0, Taste Permissive: verschachteltes Drücken und Loslassen von B entscheidet A als Hold
  resetState();
  holdTapMode = 0;
  KEYMAP[0][2][1] = 'a'; HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][5] = 'b';
  handleConfigCommand("SET_KF 0 2 1 2", false);
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1050);
  keyState[2][5] = true; onMatrixKeyChange(2, 5, true, 1050);
  assert(tapHold[2][1].pending);                                // Modus 0 hätte A schon als Hold entschieden
  setMillis(1080);
  keyState[2][5] = false; onMatrixKeyChange(2, 5, false, 1080); // volles Paar: A wird Hold
  assert(tapHold[2][1].holdActive);
}

TEST(test_hold_flavor_per_key_commands_and_nvs) {
  resetState();
  assert(isValidKeyHoldFlavor(0) && isValidKeyHoldFlavor(HOLD_FLAVOR_MAX));
  assert(!isValidKeyHoldFlavor(HOLD_FLAVOR_MAX + 1) && !isValidKeyHoldFlavor(-1));
  handleConfigCommand("SET_KF 0 2 1 4", false);
  assert(mockChar.value == "ERR ARGS SET_KF 0 2 1 4");
  handleConfigCommand("SET_KF 8 2 1 1", false);
  assert(mockChar.value == "ERR ARGS SET_KF 8 2 1 1");
  handleConfigCommand("SET_KF 0 2 1 1 7", false);
  assert(mockChar.value == "ERR ARGS SET_KF 0 2 1 1 7");
  assert(HOLDFLAVORMAP[0][2][1] == 0);
  handleConfigCommand("SET_KF 0 2 1 2", false);
  handleConfigCommand("SET_KF 1 3 4 3", false);
  assert(HOLDFLAVORMAP[0][2][1] == 2 && HOLDFLAVORMAP[1][3][4] == 3);

  // GET_CONFIG meldet die Werte je Ebene
  mockChar.notifications.clear();
  handleConfigCommand("GET_CONFIG", false);
  bool foundL0 = false, foundL1 = false;
  for (const auto& n : mockChar.notifications) {
    if (n.rfind("FLAVOR_DATA:{\"l\":0,", 0) == 0 && n.find("[0,2,0,0,0,0,0]") != std::string::npos) foundL0 = true;
    if (n.rfind("FLAVOR_DATA:{\"l\":1,", 0) == 0 && n.find("[0,0,0,0,3,0,0]") != std::string::npos) foundL1 = true;
  }
  assert(foundL0 && foundL1);

  // Ohne SAVE_NVS bleibt der NVS leer; danach überlebt der Wert einen Neustart
  assert(!preferences.isKey("holdflv"));
  handleConfigCommand("SAVE_NVS", false);
  assert(mockChar.value == "OK SAVE_NVS");
  assert(preferences.getBytesLength("holdflv") == sizeof(HOLDFLAVORMAP));
  memset(HOLDFLAVORMAP, 0, sizeof(HOLDFLAVORMAP));
  loadKeymapFromNVS();
  assert(HOLDFLAVORMAP[0][2][1] == 2 && HOLDFLAVORMAP[1][3][4] == 3);

  // CLEAR_HOLD_FLAVORS + SAVE_NVS entfernt den Schlüssel
  handleConfigCommand("CLEAR_HOLD_FLAVORS", false);
  assert(mockChar.value == "OK CLEAR_HOLD_FLAVORS");
  assert(HOLDFLAVORMAP[0][2][1] == 0);
  handleConfigCommand("SAVE_NVS", false);
  assert(!preferences.isKey("holdflv"));
  loadKeymapFromNVS();
  assert(HOLDFLAVORMAP[0][2][1] == 0);

  // Ungültiger gespeicherter Wert zählt als 0
  std::vector<uint8_t> raw(sizeof(HOLDFLAVORMAP), 0);
  uint16_t bad = 9, good = 2;
  memcpy(raw.data(), &bad, sizeof(bad));
  memcpy(raw.data() + sizeof(uint16_t), &good, sizeof(good));
  Preferences::bytesStore["holdflv"] = raw;
  loadKeymapFromNVS();
  assert(HOLDFLAVORMAP[0][0][0] == 0 && HOLDFLAVORMAP[0][0][1] == 2);
}

TEST(test_hold_flavor_per_key_cleared_compiled_in_stay_cleared_and_fingerprint) {
  resetState();
  uint32_t base = keymapDefaultsFingerprint();
  HOLDFLAVORMAP[0][2][1] = 2;
  assert(keymapDefaultsFingerprint() != base);
  HOLDFLAVORMAP[0][2][1] = 0;
  assert(keymapDefaultsFingerprint() == base);          // leer = Fingerprint der Firmware davor

  HOLDFLAVORMAP[0][2][1] = 2;                           // einkompilierter Wert
  loadKeymapFromNVS();
  handleConfigCommand("CLEAR_HOLD_FLAVORS", false);
  handleConfigCommand("SAVE_NVS", false);
  assert(preferences.isKey("holdflv"));                 // Null-Blob statt fehlendem Schlüssel
  HOLDFLAVORMAP[0][2][1] = 2;
  holdFlavorsCompiledIn = false;
  loadKeymapFromNVS();
  assert(HOLDFLAVORMAP[0][2][1] == 0 && !anyKeyHoldFlavor());
}

TEST(test_hold_flavor_per_key_transparent_key_inherits_layer0_flavor) {
  resetState();
  handleConfigCommand("SET_K 0 2 1 106 0 0", false);
  handleConfigCommand("SET_K 0 2 1 97 128 0", false);
  handleConfigCommand("SET_KF 0 2 1 2", false);
  assert(resolveKeyHoldFlavor(0, 2, 1) == 2);
  assert(resolveKeyHoldFlavor(1, 2, 1) == 2);           // Ebene 1 leer: erbt von Ebene 0
  handleConfigCommand("SET_K 1 2 1 107", false);
  assert(resolveKeyHoldFlavor(1, 2, 1) == 0);
}

TEST(test_hold_tap_mode_permissive_hold) {
  resetState();
  holdTapMode = 1; // HOLD_MODE_PERMISSIVE
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'b';

  // Fall 1: Rolled typing: A down -> B down -> A up (< tappingTermMs) -> B up
  // Weil A vor dem Loslassen von B losgelassen wurde, entscheidet A als Tap ('a')!
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1050);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1050);
  setMillis(1080);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1080);
  setMillis(1120);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1120);

  // Erwartet: Tap 'a', dann Tap 'b' (kein Ctrl!)
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == 'a');
  assert(bleKeyboard.pressHistory[1] == 'b');

  // Fall 2: Verschachteltes Press-Release: A down -> B down -> B up (< tappingTermMs) -> A up
  // Weil B während A vollständig gedrückt und losgelassen wurde, entscheidet A als Hold (Ctrl + B)!
  resetState();
  holdTapMode = 1;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'b';

  setMillis(2000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 2000);
  setMillis(2050);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 2050);
  setMillis(2080);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 2080);
  setMillis(2150);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 2150);

  // Erwartet: Ctrl down, dann 'b' down, dann 'b' up, dann Ctrl up
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == KEY_LEFT_CTRL);
  assert(bleKeyboard.pressHistory[1] == 'b');
}

TEST(test_hold_tap_mode_tap_preferred) {
  resetState();
  holdTapMode = 2; // HOLD_MODE_TAP_PREFERRED
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'b';

  // Fall 1: Verschachteltes Press-Release innerhalb des Tapping-Terms:
  // A down -> B down -> B up -> A up (alles vor tappingTermMs 200ms)
  // In tap-preferred löst andere Taste vor Term NIE Hold aus -> Tap 'a' und Tap 'b'!
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1050);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1050);
  setMillis(1080);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1080);
  setMillis(1120);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1120);

  // Erwartet: 'a' gefolgt von 'b' (kein Ctrl!)
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == 'a');
  assert(bleKeyboard.pressHistory[1] == 'b');

  // Fall 2: Halten über Tapping-Term hinaus:
  // A down bei 2000, B down bei 2050, B up bei 2080.
  // Zeit läuft ab (2200 >= 2000 + 200). Jetzt entscheidet A als Hold (Ctrl)!
  resetState();
  holdTapMode = 2;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'b';

  setMillis(2000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 2000);
  setMillis(2050);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 2050);
  setMillis(2080);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 2080);

  // Vor Ablauf noch nichts gesendet
  assert(bleKeyboard.pressHistory.empty());

  // Nach Zeitablauf wird A zu Ctrl und die gepufferten B-Events laufen unter Ctrl
  setMillis(2200);
  processDeferredKeys(2200);
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == KEY_LEFT_CTRL);
  assert(bleKeyboard.pressHistory[1] == 'b');

  setMillis(2300);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 2300);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_hold_tap_mode_commands_and_nvs) {
  resetState();
  handleConfigCommand("SET_HOLD_MODE 1", false);
  assert(mockChar.value == "OK SET_HOLD_MODE 1");
  assert(holdTapMode == 1);

  handleConfigCommand("SET_HOLD_MODE 2", false);
  assert(mockChar.value == "OK SET_HOLD_MODE 2");
  assert(holdTapMode == 2);

  handleConfigCommand("SET_HOLD_MODE 0", false);
  assert(mockChar.value == "OK SET_HOLD_MODE 0");
  assert(holdTapMode == 0);

  handleConfigCommand("SET_HOLD_MODE 3", false);
  assert(mockChar.value == "ERR ARGS SET_HOLD_MODE 3");
  assert(holdTapMode == 0);

  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.find("\"hold_tap_mode\":0") != std::string::npos);

  Preferences::uintStore["hold_mode"] = 1;
  loadKeymapFromNVS();
  assert(holdTapMode == 1);
}

// Quick-Tap: erneuter Druck derselben Mod-Tap-Taste kurz nach ihrem Tipp gilt als gehaltener Tipp
TEST(test_quick_tap_holds_tap_action) {
  resetState();
  quickTapMs = 150;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  tapKeyAt(2, 1, 1000, 1040);                 // Tipp: 'a'
  assert(countPresses('a') == 1);
  setMillis(1100);                            // 60 ms nach dem Tipp (< quickTapMs)
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  assert(countPresses('a') == 2);             // sofort gedrückt, ohne Wartezeit
  setMillis(1500);                            // Halten über den Tapping-Term: keine Halte-Aktion
  processDeferredKeys(millis());
  assert(countPresses(KEY_LEFT_CTRL) == 0);
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == 'a');
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_quick_tap_after_window_gives_hold) {
  resetState();
  quickTapMs = 150;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  tapKeyAt(2, 1, 1000, 1040);
  setMillis(1300);                            // 260 ms nach dem Tipp (>= quickTapMs)
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  assert(countPresses('a') == 1);             // noch unentschieden
  setMillis(1550);
  processDeferredKeys(millis());
  assert(countPresses(KEY_LEFT_CTRL) == 1);
  assert(countPresses('a') == 1);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
}

TEST(test_quick_tap_zero_keeps_old_behavior) {
  resetState();
  quickTapMs = 0;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  tapKeyAt(2, 1, 1000, 1040);
  setMillis(1100);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  assert(countPresses('a') == 1);             // wartet auf die Entscheidung
  setMillis(1400);
  processDeferredKeys(millis());
  assert(countPresses(KEY_LEFT_CTRL) == 1);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
}

TEST(test_quick_tap_other_key_in_between_cancels) {
  resetState();
  quickTapMs = 300;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'b';
  tapKeyAt(2, 1, 1000, 1040);
  tapKeyAt(2, 2, 1060, 1080);                 // andere Taste dazwischen
  setMillis(1120);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  assert(countPresses('a') == 1);             // kein Quick-Tap
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
}

TEST(test_quick_tap_window_boundary) {
  resetState();
  quickTapMs = 150;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  tapKeyAt(2, 1, 1000, 1040);
  setMillis(1189);                            // 149 ms nach dem Tipp: noch im Fenster
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  assert(countPresses('a') == 2);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  // Das Loslassen des gehaltenen Tipps startet ein neues Fenster; genau quickTapMs danach gilt es nicht mehr
  setMillis(1189);
  setMillis(1339);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  assert(countPresses('a') == 2);             // wartet wieder auf die Entscheidung
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
}

TEST(test_quick_tap_ignores_double_tap_and_plain_keys) {
  resetState();
  quickTapMs = 300;
  // Taste mit Doppel-Tipp-Aktion: Tap-Dance bleibt
  handleConfigCommand("SET_K 0 2 1 106 17 177", false); // Tap j, Hold Ctrl, Doppel-Tipp Esc
  bleKeyboard.pressHistory.clear();
  tapKeyAt(2, 1, 1000, 1040);
  tapKeyAt(2, 1, 1100, 1140);
  assert(countPresses(KEY_ESC) == 1);
  assert(countPresses('j') == 0);
  // Taste ohne Halte-Aktion: normales Verhalten
  KEYMAP[0][2][2] = 'b';
  HOLDMAP[0][2][2] = 0;
  bleKeyboard.pressHistory.clear();
  tapKeyAt(2, 2, 2000, 2040);
  tapKeyAt(2, 2, 2100, 2140);
  assert(countPresses('b') == 2);
}

TEST(test_quick_tap_reset_and_layer_change_while_held) {
  resetState();
  quickTapMs = 200;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  tapKeyAt(2, 1, 1000, 1040);
  setMillis(1100);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  assert(quickTapHeld[2][1]);
  resetTapHold();                              // Reset während des Haltens
  assert(!quickTapHeld[2][1] && !quickTapValid[2][1]);
  setMillis(1200);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  assert(!quickTapHeld[2][1]);
  // Ebenenwechsel vor dem Loslassen: das Loslassen gibt die gedrückte Aktion frei
  resetState();
  quickTapMs = 200;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  tapKeyAt(2, 1, 1000, 1040);
  setMillis(1100);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  toggleLayers[1] = true;
  setMillis(1200);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  toggleLayers[1] = false;
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_quick_tap_with_pending_mod_tap_in_tap_preferred_mode) {
  resetState();
  quickTapMs = 300;
  holdTapMode = 2; // HOLD_MODE_TAP_PREFERRED: Druck wird gepuffert, solange eine andere Mod-Tap-Taste wartet
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'b';
  HOLDMAP[0][2][2] = KEY_LEFT_SHIFT;
  tapKeyAt(2, 1, 1000, 1040);
  setMillis(1100);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1100);   // B wartet
  setMillis(1120);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1120);   // A erneut: gepuffert
  setMillis(1140);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1140); // B Tipp
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1160);
  processDeferredKeys(millis());
  assert(countPresses(KEY_LEFT_CTRL) == 0);
  assert(countPresses('b') == 1);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_quick_tap_command_nvs_and_info) {
  resetState();
  handleConfigCommand("SET_QUICK_TAP 501", false);
  assert(mockChar.value == "ERR ARGS SET_QUICK_TAP 501");
  handleConfigCommand("SET_QUICK_TAP -1", false);
  assert(mockChar.value == "ERR ARGS SET_QUICK_TAP -1");
  handleConfigCommand("SET_QUICK_TAP abc", false);
  assert(mockChar.value == "ERR ARGS SET_QUICK_TAP abc");
  assert(quickTapMs == 0);
  handleConfigCommand("SET_QUICK_TAP 500", false);
  assert(mockChar.value == "OK SET_QUICK_TAP 500");
  handleConfigCommand("SET_QUICK_TAP 120", false);
  assert(mockChar.value == "OK SET_QUICK_TAP 120");
  assert(quickTapMs == 120);
  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.find("\"qt\":120") != std::string::npos);
  quickTapMs = 0;
  loadKeymapFromNVS();
  assert(quickTapMs == 120);
  Preferences::uintStore["quick_tap"] = 900;  // außerhalb des Bereichs
  quickTapMs = 0;
  loadKeymapFromNVS();
  assert(quickTapMs == 0);
  handleConfigCommand("SET_QUICK_TAP 0", false);
  assert(mockChar.value == "OK SET_QUICK_TAP 0");
}

// Opposite-Hand-Regel (chordalHold): Mod-Tap-Taste offen + Taste derselben Hälfte -> Tipp, dann die zweite Taste
TEST(test_chordal_hold_same_half_resolves_tap) {
  resetState();
  chordalHold = 1;
  holdTapMode = 0; // ohne chordalHold wäre das Ctrl + B
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'b';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1050);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1050);
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == 'a');   // Tipp zuerst
  assert(bleKeyboard.pressHistory[1] == 'b');   // dann die zweite Taste
  assert(countPresses(KEY_LEFT_CTRL) == 0);
  assert(!anyTapHoldPending());
  setMillis(1080);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1080);
  setMillis(1120);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1120);
  assert(bleKeyboard.pressedKeys.empty());
  assert(countPresses('a') == 1 && countPresses('b') == 1);
}

// Retro Tap: Halten über den Tapping-Term ohne weiteren Tastendruck, Loslassen sendet den Tipp nach
TEST(test_retro_tap_sends_tap_on_release_after_hold) {
  resetState();
  retroTap = 1;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1300);
  tapHoldTick(1300);
  assert(countPresses(KEY_LEFT_CTRL) == 1);
  setMillis(1500);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1500);
  assert(countPresses('a') == 1);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_retro_tap_off_sends_nothing_on_release) {
  resetState();
  retroTap = 0;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1300);
  tapHoldTick(1300);
  setMillis(1500);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1500);
  assert(countPresses('a') == 0);
}

TEST(test_retro_tap_cancelled_by_key_press_during_hold) {
  resetState();
  retroTap = 1;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'b';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1300);
  tapHoldTick(1300);
  setMillis(1350);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1350);
  setMillis(1400);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1400);
  setMillis(1500);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1500);
  assert(countPresses('b') == 1);
  assert(countPresses('a') == 0);
}

TEST(test_retro_tap_cancelled_by_press_of_other_half) {
  resetState();
  retroTap = 1;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1300);
  tapHoldTick(1300);
  notePriorKeyPress(1350); // Druck der anderen Hälfte
  setMillis(1500);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1500);
  assert(countPresses('a') == 0);
}

// Retro Tap: Ausnahmen (Halte-Aktion gleich Tipp, Doppel-Tipp, ohne Tipp-Aktion) senden nichts nach; Layer-Tap MO_n sendet den Tipp nach
TEST(test_retro_tap_exception_hold_equals_tap) {
  resetState();
  retroTap = 1;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = 'a';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1300);
  tapHoldTick(1300);
  size_t n = countPresses('a');
  setMillis(1500);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1500);
  assert(countPresses('a') == n); // kein zusätzlicher Tipp
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_retro_tap_exception_double_tap_key) {
  resetState();
  retroTap = 1;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  DTAPMAP[0][2][1] = 'd';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1300);
  tapHoldTick(1300);
  setMillis(1500);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1500);
  assert(countPresses('a') == 0);
}

TEST(test_retro_tap_exception_tap_action_zero) {
  resetState();
  retroTap = 1;
  KEYMAP[0][2][1] = 0;
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1300);
  tapHoldTick(1300);
  assert(countPresses(KEY_LEFT_CTRL) == 1);
  size_t before = bleKeyboard.pressHistory.size();
  setMillis(1500);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1500);
  assert(bleKeyboard.pressHistory.size() == before);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_retro_tap_layer_tap_mo_sends_tap) {
  resetState();
  retroTap = 1;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = ACT_MO_2;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1300);
  tapHoldTick(1300);
  assert(getActiveLayer() == 2);
  setMillis(1500);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1500);
  assert(getActiveLayer() == 0);
  assert(countPresses('a') == 1);
  assert(bleKeyboard.pressedKeys.empty());
}

// Retro Tap: der nachgesendete Tipp verbraucht eine vorgemerkte One-Shot-Ebene wie jeder Tastendruck
TEST(test_retro_tap_consumes_one_shot_layer_mark) {
  resetState();
  retroTap = 1;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1300);
  tapHoldTick(1300);
  oslHeld = 1 << 2;
  oslUsed = 0;
  setMillis(1500);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1500);
  assert(countPresses('a') == 1);
  assert((oslUsed & (1 << 2)) != 0);
}

// SET_RETRO_TAP: Argumente, NVS-Roundtrip und rt in DEVICE_INFO
TEST(test_set_retro_tap_args_nvs_and_device_info) {
  resetState();
  handleConfigCommand("SET_RETRO_TAP 2", false);
  assert(mockChar.value == "ERR ARGS SET_RETRO_TAP 2");
  handleConfigCommand("SET_RETRO_TAP -1", false);
  assert(mockChar.value == "ERR ARGS SET_RETRO_TAP -1");
  handleConfigCommand("SET_RETRO_TAP abc", false);
  assert(mockChar.value == "ERR ARGS SET_RETRO_TAP abc");
  assert(retroTap == 0);
  handleConfigCommand("SET_RETRO_TAP 1", false);
  assert(mockChar.value == "OK SET_RETRO_TAP 1");
  assert(retroTap == 1);
  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.find("\"rt\":1,") != std::string::npos);
  // NVS-Roundtrip: Neustart liest den gespeicherten Wert
  retroTap = 0;
  loadKeymapFromNVS();
  assert(retroTap == 1);
  handleConfigCommand("SET_RETRO_TAP 0", false);
  assert(mockChar.value == "OK SET_RETRO_TAP 0");
  retroTap = 1;
  loadKeymapFromNVS();
  assert(retroTap == 0);
  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.find("\"rt\":0,") != std::string::npos);
  // Ungültiger NVS-Wert wird ignoriert
  preferences.begin("dactyl", false);
  preferences.putUChar("retro_tap", 7);
  preferences.end();
  retroTap = 0;
  loadKeymapFromNVS();
  assert(retroTap == 0);
}

TEST(test_chordal_hold_applies_in_every_hold_tap_mode) {
  for (uint8_t mode = 0; mode <= 2; mode++) {
    resetState();
    chordalHold = 1;
    holdTapMode = mode;
    KEYMAP[0][2][1] = 'a';
    HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
    KEYMAP[0][2][2] = 'b';
    setMillis(1000);
    keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
    setMillis(1050);
    keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1050);
    assert(bleKeyboard.pressHistory.size() == 2);
    assert(bleKeyboard.pressHistory[0] == 'a' && bleKeyboard.pressHistory[1] == 'b');
    assert(countPresses(KEY_LEFT_CTRL) == 0);
    keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1080);
    keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1120);
    assert(bleKeyboard.pressedKeys.empty());
  }
}

TEST(test_chordal_hold_off_keeps_hold_tap_mode_decision) {
  resetState();
  chordalHold = 0;
  holdTapMode = 0;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'b';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1050);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1050);
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == KEY_LEFT_CTRL && bleKeyboard.pressHistory[1] == 'b');
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1080);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1120);
}

// Die Daumenreihe behält die Entscheidung von holdTapMode: als Mod-Tap-Taste und als zweite Taste
TEST(test_chordal_hold_thumb_row_keeps_hold_tap_mode_decision) {
  resetState();
  chordalHold = 1;
  holdTapMode = 0;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][5][3] = ' ';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1050);
  keyState[5][3] = true; onMatrixKeyChange(5, 3, true, 1050);   // Daumentaste als zweite Taste
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == KEY_LEFT_CTRL && bleKeyboard.pressHistory[1] == ' ');
  keyState[5][3] = false; onMatrixKeyChange(5, 3, false, 1100);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1120);

  resetState();
  chordalHold = 1;
  holdTapMode = 0;
  KEYMAP[0][5][3] = ' ';
  HOLDMAP[0][5][3] = KEY_LEFT_SHIFT;           // Mod-Tap-Taste im Daumencluster
  KEYMAP[0][2][2] = 'b';
  setMillis(2000);
  keyState[5][3] = true; onMatrixKeyChange(5, 3, true, 2000);
  setMillis(2050);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 2050);
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == KEY_LEFT_SHIFT && bleKeyboard.pressHistory[1] == 'b');
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 2100);
  keyState[5][3] = false; onMatrixKeyChange(5, 3, false, 2120);
}

// Layer-Tap mit MO_n behält sein Verhalten: die Ebene wirkt auf die zweite Taste
TEST(test_chordal_hold_layer_tap_unchanged) {
  resetState();
  chordalHold = 1;
  holdTapMode = 0;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = ACT_MO_BASE + 1;
  KEYMAP[0][2][2] = 'b';
  KEYMAP[1][2][2] = 'x';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1050);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1050);
  assert(countPresses('a') == 0);
  assert(countPresses('x') == 1 && countPresses('b') == 0);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1100);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1120);
}

// Eine Mod-Tap-Taste, die die Halte-Zeit erreicht hat, ist schon Hold: die Regel ändert sie nicht
TEST(test_chordal_hold_decided_hold_stays_hold) {
  resetState();
  chordalHold = 1;
  holdTapMode = 0;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'c';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1300);
  processDeferredKeys(millis());               // Tapping-Term abgelaufen: Hold
  setMillis(1350);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1350);
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == KEY_LEFT_CTRL && bleKeyboard.pressHistory[1] == 'c');
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1400);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1420);
}

// Taste mit Doppel-Tipp-Aktion behält Tap-Dance
TEST(test_chordal_hold_double_tap_key_unchanged) {
  resetState();
  chordalHold = 1;
  holdTapMode = 0;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  DTAPMAP[0][2][1] = 'z';
  KEYMAP[0][2][2] = 'b';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1050);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1050);
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == KEY_LEFT_CTRL && bleKeyboard.pressHistory[1] == 'b');
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1100);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1120);
}

// Combo-Partner im Fenster: checkUserCombos() löst die Combo aus, der Tipp der Mod-Tap-Taste darf nicht vorher raus
TEST(test_chordal_hold_combo_partner_in_window_keeps_combo) {
  resetState();
  chordalHold = 1;
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false); // J + K -> Esc
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'k';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1010);                                      // innerhalb comboTimeoutMs (40 ms)
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1010);
  checkUserCombos();
  assert(comboRuntime[0].active);
  assert(countPresses('j') == 0);                       // kein Tipp vor der Combo
  assert(bleKeyboard.writtenKeys.size() == 1 && bleKeyboard.writtenKeys[0] == KEY_ESC);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1100);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1120);
  checkUserCombos();
  assert(bleKeyboard.pressedKeys.empty());
  assert(countPresses('j') == 0 && countPresses('k') == 0);
}

// Modi 1 und 2 puffern die zweite Taste: ihr Zeitstempel darf danach keine Combo mit der offenen Taste bilden
TEST(test_chordal_hold_buffered_key_keeps_no_stale_press_time) {
  for (uint8_t mode = 1; mode <= 2; mode++) {
    resetState();
    chordalHold = 1;
    holdTapMode = mode;
    handleConfigCommand("ADD_COMBO 4 1 2 2 0 177", false);   // Layer-Taste (4,1) + K -> Esc
    KEYMAP[0][4][1] = 'l';
    HOLDMAP[0][4][1] = ACT_MO_BASE + 1;                      // Layer-Tap: von der Regel ausgenommen, bleibt offen
    KEYMAP[0][2][2] = 'k';
    setMillis(1000);
    keyState[4][1] = true; onMatrixKeyChange(4, 1, true, 1000);
    keyPressTime[2][2] = 0;
    comboPressLayer1[2][2] = 0;
    setMillis(1010);
    keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1010);   // wird gepuffert
    assert(anyTapHoldPending());
    assert(keyPressTime[2][2] == 0 && comboPressLayer1[2][2] == 0);   // Zeit und Ebene unverändert
    keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1050);
    keyState[4][1] = false; onMatrixKeyChange(4, 1, false, 1060);
    checkUserCombos();
    assert(!comboRuntime[0].active);                             // keine Combo aus der gepufferten Taste
    assert(bleKeyboard.writtenKeys.empty());
  }
}

// Mod-Tap-Taste ist selbst Combo-Kandidat, die zweite Taste ist kein Partner: die Regel entscheidet sie als Tipp
TEST(test_chordal_hold_combo_candidate_with_non_partner_key) {
  resetState();
  chordalHold = 1;
  holdTapMode = 0;
  handleConfigCommand("ADD_COMBO 2 1 2 3 0 177", false); // J + L -> Esc
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'k';                                 // kein Partner der Combo
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1050);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1050);
  checkUserCombos();
  assert(!comboRuntime[0].active);
  assert(countPresses(KEY_LEFT_CTRL) == 0);
  assert(countPresses('j') == 1 && countPresses('k') == 1);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1080);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1120);
  assert(bleKeyboard.pressedKeys.empty());
}

// Hat die offene Taste den Tapping-Term erreicht (Tick lief noch nicht), bleibt sie Hold
TEST(test_chordal_hold_term_reached_stays_hold) {
  resetState();
  chordalHold = 1;
  holdTapMode = 0;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'c';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1000 + TAPPING_TERM_MS + 10);                    // kein processDeferredKeys: die Taste ist noch offen
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1000 + TAPPING_TERM_MS + 10);
  assert(countPresses('a') == 0);
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == KEY_LEFT_CTRL && bleKeyboard.pressHistory[1] == 'c');
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1300);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1320);
}

// Zweite Taste ist selbst eine Mod-Tap-Taste: die erste tippt, die zweite öffnet ihre eigene Entscheidung
TEST(test_chordal_hold_second_key_is_mod_tap) {
  for (uint8_t mode = 0; mode <= 2; mode++) {
    resetState();
    chordalHold = 1;
    holdTapMode = mode;
    KEYMAP[0][2][1] = 'a';
    HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
    KEYMAP[0][2][2] = 's';
    HOLDMAP[0][2][2] = KEY_LEFT_SHIFT;
    setMillis(1000);
    keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
    setMillis(1050);
    keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1050);
    assert(countPresses('a') == 1 && countPresses(KEY_LEFT_CTRL) == 0);   // erste Taste: Tipp
    assert(tapHold[2][2].pending);                                         // zweite Taste: eigene offene Entscheidung
    setMillis(1300);
    processDeferredKeys(millis());                                         // Tapping-Term der zweiten Taste: Hold
    assert(countPresses(KEY_LEFT_SHIFT) == 1 && countPresses('s') == 0);
    keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1320);
    keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1340);
    assert(bleKeyboard.pressedKeys.empty());
  }
}

// Das Combo-Fenster gilt in allen drei Modi: das Ergebnis ist mit und ohne chordalHold gleich
// (Modi 1 und 2 puffern die zweite Taste schon ohne die Regel; dort löst die Combo wie bisher aus oder nicht)
TEST(test_chordal_hold_combo_partner_in_window_all_modes) {
  for (uint8_t mode = 0; mode <= 2; mode++) {
    bool activeOf[2] = {false, false};
    std::vector<uint8_t> historyOf[2];
    for (uint8_t on = 0; on <= 1; on++) {
      resetState();
      chordalHold = on;
      holdTapMode = mode;
      handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
      KEYMAP[0][2][1] = 'j';
      HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
      KEYMAP[0][2][2] = 'k';
      setMillis(1000);
      keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
      setMillis(1010);
      keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1010);
      checkUserCombos();
      activeOf[on] = comboRuntime[0].active;
      keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1100);
      keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1120);
      checkUserCombos();
      processDeferredKeys(millis());
      for (auto h : bleKeyboard.pressHistory) historyOf[on].push_back((uint8_t)h);
      assert(bleKeyboard.pressedKeys.empty());
    }
    assert(activeOf[0] == activeOf[1]);
    assert(historyOf[0] == historyOf[1]);
    if (mode == 0) assert(activeOf[1]);               // Modus 0: die Combo löst aus, kein Tipp davor
  }
}

// Außerhalb des Combo-Fensters gilt die Regel: Tipp, dann die zweite Taste
TEST(test_chordal_hold_combo_partner_outside_window_resolves_tap) {
  resetState();
  chordalHold = 1;
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'k';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1100);                                      // 100 ms > comboTimeoutMs
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1100);
  checkUserCombos();
  assert(!comboRuntime[0].active);
  assert(countPresses('j') == 1 && countPresses(KEY_LEFT_CTRL) == 0);   // Tipp sofort; k ist Combo-Kandidat und folgt beim Loslassen
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1150);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1160);
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == 'j' && bleKeyboard.pressHistory[1] == 'k');
  assert(bleKeyboard.pressedKeys.empty());
}

// Zwei gepufferte Drücke derselben Hälfte hinter einer offenen Layer-Taste (Modus 1 und 2): die Regel gilt beim Abspielen
TEST(test_chordal_hold_replayed_same_half_presses_resolve_tap) {
  for (uint8_t mode = 1; mode <= 2; mode++) {
    resetState();
    chordalHold = 1;
    holdTapMode = mode;
    KEYMAP[0][4][1] = 'l';
    HOLDMAP[0][4][1] = ACT_MO_BASE + 1;                 // Layer-Tap: von der Regel ausgenommen
    KEYMAP[0][2][1] = 'a';
    HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
    KEYMAP[0][2][2] = 'b';
    setMillis(1000);
    keyState[4][1] = true; onMatrixKeyChange(4, 1, true, 1000);
    setMillis(1020);
    keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1020);   // gepuffert
    setMillis(1040);
    keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1040);   // gepuffert
    setMillis(1060);
    keyState[4][1] = false; onMatrixKeyChange(4, 1, false, 1060); // Layer-Tap als Tipp: Queue läuft ab
    assert(countPresses(KEY_LEFT_CTRL) == 0);
    assert(countPresses('a') == 1 && countPresses('b') == 1);
    size_t ia = 0, ib = 0;
    for (size_t i = 0; i < bleKeyboard.pressHistory.size(); i++) {
      if (bleKeyboard.pressHistory[i] == 'a') ia = i;
      if (bleKeyboard.pressHistory[i] == 'b') ib = i;
    }
    assert(ia < ib);                                    // Reihenfolge bleibt
    keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1100);
    keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1120);
    assert(bleKeyboard.pressedKeys.empty());
  }
}

// Die Daumenreihe behält die Entscheidung von holdTapMode auch in den Modi 1 und 2
TEST(test_chordal_hold_thumb_row_in_buffered_modes) {
  for (uint8_t mode = 1; mode <= 2; mode++) {
    resetState();
    chordalHold = 1;
    holdTapMode = mode;
    KEYMAP[0][2][1] = 'a';
    HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
    KEYMAP[0][5][3] = ' ';
    setMillis(1000);
    keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
    setMillis(1050);
    keyState[5][3] = true; onMatrixKeyChange(5, 3, true, 1050);
    assert(countPresses('a') == 0);                     // nicht per Regel entschieden: bleibt offen / gepuffert
    assert(anyTapHoldPending());
    keyState[5][3] = false; onMatrixKeyChange(5, 3, false, 1080);
    keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1100);
  }
}

// GET_INFO bleibt mit dem längsten Gerätenamen und dem neuen Feld gültiges JSON (Puffer nicht abgeschnitten)
TEST(test_chordal_hold_device_info_fits_with_longest_name) {
  resetState();
  deviceName = String("0123456789012345678901234567890");   // 31 Zeichen
  chordalHold = 1;
  handleConfigCommand("GET_INFO", false);
  const std::string &v = mockChar.value;
  assert(v.rfind("DEVICE_INFO:{", 0) == 0);
  assert(v.back() == '}');
  assert(v.find("\"chordal_hold\":1") != std::string::npos);
  assert(v.find("\"config_mode\":") != std::string::npos);
  deviceName = DEFAULT_DEVICE_NAME;
}

// Guard-Test: Ein Druck der anderen Hälfte läuft über HOLD_RESOLVE (resolveAllPendingTapHoldsAsHold, nicht über die
// Regel) und entscheidet offene Mod-Tap-Tasten als Hold, mit und ohne chordalHold. Der Test besteht auch ohne die
// Funktion; er schützt davor, dass die Regel diesen Pfad später ändert.
TEST(test_chordal_hold_other_half_resolves_hold) {
  for (uint8_t on = 0; on <= 1; on++) {
    resetState();
    chordalHold = on;
    holdTapMode = 0;
    KEYMAP[0][2][1] = 'a';
    HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
    setMillis(1000);
    keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
    assert(anyTapHoldPending());
    resolveAllPendingTapHoldsAsHold();
    assert(!anyTapHoldPending());
    assert(countPresses(KEY_LEFT_CTRL) == 1 && countPresses('a') == 0);
    keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1100);
    assert(bleKeyboard.pressedKeys.empty());
  }
}

TEST(test_chordal_hold_command_nvs_and_info) {
  resetState();
  handleConfigCommand("SET_CHORDAL_HOLD 2", false);
  assert(mockChar.value == "ERR ARGS SET_CHORDAL_HOLD 2");
  handleConfigCommand("SET_CHORDAL_HOLD abc", false);
  assert(mockChar.value == "ERR ARGS SET_CHORDAL_HOLD abc");
  handleConfigCommand("SET_CHORDAL_HOLD -1", false);
  assert(mockChar.value == "ERR ARGS SET_CHORDAL_HOLD -1");
  assert(chordalHold == 0);
  handleConfigCommand("SET_CHORDAL_HOLD 1", false);
  assert(mockChar.value == "OK SET_CHORDAL_HOLD 1");
  assert(chordalHold == 1);
  handleConfigCommand("SET_CHORDAL_HOLD 0", false);
  handleConfigCommand("SET_CHORDAL_HOLD   1  ", false);   // Leerzeichen um den Wert
  assert(mockChar.value == "OK SET_CHORDAL_HOLD 1");
  assert(chordalHold == 1);
  handleConfigCommand("SET_CHORDAL_HOLD ", false);        // ohne Wert
  assert(mockChar.value.rfind("ERR", 0) == 0);
  assert(chordalHold == 1);
  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.find("\"chordal_hold\":1") != std::string::npos);
  chordalHold = 0;
  Serial.outputLines.clear();
  loadKeymapFromNVS();
  assert(chordalHold == 1);
  bool logged = false;                                    // das Boot-Log nennt den geladenen Wert
  for (const auto& l : Serial.outputLines) logged = logged || l.find("ChordalHold=1") != std::string::npos;
  assert(logged);
  Preferences::uintStore["chordal"] = 7;      // außerhalb des Bereichs
  chordalHold = 0;
  loadKeymapFromNVS();
  assert(chordalHold == 0);
  handleConfigCommand("SET_CHORDAL_HOLD 0", false);
  assert(mockChar.value == "OK SET_CHORDAL_HOLD 0");
  assert(chordalHold == 0);
  // Schreibfehler: Antwort ERR NVS, der Wert bleibt unverändert
  Preferences::failUCharKey = "chordal";
  handleConfigCommand("SET_CHORDAL_HOLD 1", false);
  assert(mockChar.value == "ERR NVS SET_CHORDAL_HOLD");
  assert(chordalHold == 0);
  Preferences::failUCharKey = "";
}

// Tri-Layer: sind die Ebenen a und b aktiv, gilt die Ebene target
TEST(test_tri_layer_local_and_remote) {
  resetState();
  handleConfigCommand("SET_TRI_LAYER 1 2 3", false);
  assert(mockChar.value == "OK SET_TRI_LAYER 1");
  assert(numTriLayers == 1);
  // MO_1 rechts und MO_2 von der linken Hälfte -> Ebene 3
  momentaryLayers[1] = true;
  assert(getActiveLayer() == 1);
  assert(applyRemoteLayerState(0x04, false, 0));
  assert(getActiveLayer() == 3);
  // Beide lokal
  applyRemoteLayerState(0, false, 0);
  momentaryLayers[2] = true;
  assert(getActiveLayer() == 3);
  // Eine Ebene losgelassen -> Regel inaktiv
  momentaryLayers[1] = false;
  assert(getActiveLayer() == 2);
  momentaryLayers[2] = false;
  // Mit eingerasteter Ebene und MO der anderen Hälfte
  toggleLayers[1] = true;
  applyRemoteLayerState(0x04, false, 0);
  assert(getActiveLayer() == 3);
  toggleLayers[1] = false;
  applyRemoteLayerState(0, false, 0);
  // MO_0 zwingt weiterhin Ebene 0
  momentaryLayers[1] = momentaryLayers[2] = momentaryLayers[0] = true;
  assert(getActiveLayer() == 0);
  momentaryLayers[0] = momentaryLayers[1] = momentaryLayers[2] = false;
  // Ohne Regel bleibt es bei der höchsten Ebene
  handleConfigCommand("SET_TRI_LAYER -", false);
  assert(mockChar.value == "OK SET_TRI_LAYER 0");
  momentaryLayers[1] = momentaryLayers[2] = true;
  assert(getActiveLayer() == 2);
  momentaryLayers[1] = momentaryLayers[2] = false;
}

TEST(test_tri_layer_two_rules_and_no_cascade) {
  resetState();
  handleConfigCommand("SET_TRI_LAYER 1 2 3 4 5 6", false);
  assert(mockChar.value == "OK SET_TRI_LAYER 2");
  momentaryLayers[4] = momentaryLayers[5] = true;
  assert(getActiveLayer() == 6);
  momentaryLayers[4] = momentaryLayers[5] = false;
  // Keine Kaskade: Ziel 3 von Regel 1 löst Regel 2 (3 + 5) nicht aus
  handleConfigCommand("SET_TRI_LAYER 1 2 3 3 5 6", false);
  momentaryLayers[1] = momentaryLayers[2] = momentaryLayers[5] = true;
  assert(getActiveLayer() == 5);
  momentaryLayers[1] = momentaryLayers[2] = momentaryLayers[5] = false;
}

TEST(test_tri_layer_command_validation_and_nvs) {
  resetState();
  const char* bad[] = {"SET_TRI_LAYER 1 2", "SET_TRI_LAYER 1 1 3", "SET_TRI_LAYER 1 2 1",
                       "SET_TRI_LAYER 0 2 3", "SET_TRI_LAYER 1 2 8", "SET_TRI_LAYER 1 2 3 4 5 6 7 1 2",
                       "SET_TRI_LAYER a b c", "SET_TRI_LAYER 1 2 3 4"};
  for (const char* c : bad) {
    handleConfigCommand(c, false);
    assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
    assert(numTriLayers == 0);
  }
  handleConfigCommand("SET_TRI_LAYER 1 2 3", false);
  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.find("\"tri_layer\":[[1,2,3]]") != std::string::npos);
  // Neustart: NVS-Werte werden geladen
  numTriLayers = 0;
  memset(triLayerRules, 0, sizeof(triLayerRules));
  loadKeymapFromNVS();
  assert(numTriLayers == 1 && triLayerRules[0] == 1 && triLayerRules[1] == 2 && triLayerRules[2] == 3);
  // Ungültige gespeicherte Regel wird ignoriert
  numTriLayers = 0;
  Preferences::uintStore["tri_n"] = 1;
  uint8_t badRule[3] = {2, 2, 3};
  preferences.putBytes("tri_data", badRule, 3);
  loadKeymapFromNVS();
  assert(numTriLayers == 0);
  // Gespeicherte leere Liste überschreibt die einkompilierte
  numTriLayers = 1;
  Preferences::uintStore["tri_n"] = 0;
  loadKeymapFromNVS();
  assert(numTriLayers == 0);
  // Schreibfehler: RAM bleibt unverändert
  Preferences::failBytesKey = "tri_data";
  handleConfigCommand("SET_TRI_LAYER 2 3 4", false);
  Preferences::failBytesKey = "";
  assert(mockChar.value == "ERR NVS SET_TRI_LAYER");
  assert(numTriLayers == 0);
  // Schlägt nur das Schreiben von tri_n fehl, bleibt der alte NVS-Stand gültig (kein stiller Rückfall)
  handleConfigCommand("SET_TRI_LAYER 1 2 3", false);
  assert(numTriLayers == 1);
  Preferences::failUCharKey = "tri_n";
  handleConfigCommand("SET_TRI_LAYER 4 5 6 1 2 3", false);
  Preferences::failUCharKey = "";
  assert(mockChar.value == "ERR NVS SET_TRI_LAYER");
  assert(numTriLayers == 1 && triLayerRules[0] == 1);
  numTriLayers = 0;
  memset(triLayerRules, 0, sizeof(triLayerRules));
  loadKeymapFromNVS();
  assert(numTriLayers == 1 && triLayerRules[0] == 1 && triLayerRules[1] == 2 && triLayerRules[2] == 3);
}

// =============================================================================
// PLAN 4: BLE OTA UPDATE TESTS
// =============================================================================

static const uint8_t OTA_TEST_PUB[32] = {
  0xe7,0xe4,0x4f,0xa1,0xd0,0x29,0xc1,0x28,0x4d,0xd8,0xf4,0x08,0xee,0xd0,0x2a,0xa9,
  0x66,0x8f,0xe3,0x38,0x5e,0xe5,0x4f,0xc1,0x47,0xf9,0x20,0x07,0xd3,0x16,0xf6,0x73
};
static const uint8_t OTA_TEST_SIG[64] = {
  0x3c,0x68,0xef,0x0f,0x05,0xb5,0x5d,0x56,0x0e,0xc9,0x44,0xe4,0xef,0x33,0xfe,0x7e,
  0xf9,0xe9,0x8b,0x43,0x8c,0xeb,0xa5,0x5f,0x22,0x3a,0x2a,0x4f,0x8f,0x2c,0x91,0xd2,
  0x3e,0x07,0x1a,0xd6,0xbb,0xa0,0x9f,0xce,0x4d,0x24,0xe9,0xd1,0x48,0x0a,0xb1,0x3a,
  0x48,0x8f,0x8d,0x73,0x21,0x82,0x45,0x1c,0x0c,0xc2,0x2c,0x2a,0xbc,0xfc,0x2e,0x0e
};
static const uint8_t OTA_TEST_MSG[] = {
  0x48,0x65,0x6c,0x6c,0x6f,0x20,0x4f,0x54,0x41,0x20,0x77,0x6f,0x72,0x6c,0x64,0x21,
  0x20,0x54,0x68,0x69,0x73,0x20,0x69,0x73,0x20,0x61,0x20,0x74,0x65,0x73,0x74,0x20,
  0x66,0x69,0x72,0x6d,0x77,0x61,0x72,0x65,0x20,0x62,0x69,0x6e,0x61,0x72,0x79,0x20,
  0x73,0x74,0x72,0x65,0x61,0x6d,0x2e
};
static const size_t OTA_TEST_MSG_LEN = 55;

static std::string hexEncode(const uint8_t *data, size_t len) {
  static const char hexChars[] = "0123456789abcdef";
  std::string s;
  s.reserve(len * 2);
  for (size_t i = 0; i < len; i++) {
    s.push_back(hexChars[(data[i] >> 4) & 0x0f]);
    s.push_back(hexChars[data[i] & 0x0f]);
  }
  return s;
}

#include "../dactyl_right/DactylOtaVerify.h"


TEST(test_ota_ed25519_signature_verification) {
  // Test valid signature
  bool ok = dactyl_ota_verify(OTA_TEST_PUB, OTA_TEST_SIG, OTA_TEST_MSG, OTA_TEST_MSG_LEN);
  assert(ok);

  // Test manipulated message byte
  uint8_t bad_msg[OTA_TEST_MSG_LEN];
  memcpy(bad_msg, OTA_TEST_MSG, OTA_TEST_MSG_LEN);
  bad_msg[0] ^= 1;
  assert(!dactyl_ota_verify(OTA_TEST_PUB, OTA_TEST_SIG, bad_msg, OTA_TEST_MSG_LEN));

  // Test manipulated signature byte
  uint8_t bad_sig[64];
  memcpy(bad_sig, OTA_TEST_SIG, 64);
  bad_sig[63] ^= 1;
  assert(!dactyl_ota_verify(OTA_TEST_PUB, bad_sig, OTA_TEST_MSG, OTA_TEST_MSG_LEN));
}

TEST(test_ota_state_machine_begin_and_abort) {
  resetState();
  isConfigMode = true;
  mockChar.value = "";
  mockChar.notifications.clear();

  std::string sigHex = hexEncode(OTA_TEST_SIG, 64);
  handleConfigCommand(String(("OTA_BEGIN 1024 " + sigHex).c_str()), true);
  assert(mockChar.value == "OTA_READY");

  handleConfigCommand("OTA_ABORT", true);
  assert(mockChar.value == "OTA_ABORTED");
}

TEST(test_ota_state_machine_chunk_sequences) {
  resetState();
  isConfigMode = true;
  mockChar.value = "";
  mockChar.notifications.clear();

  std::string sigHex = hexEncode(OTA_TEST_SIG, 64);
  handleConfigCommand(String(("OTA_BEGIN 400 " + sigHex).c_str()), true);
  assert(mockChar.value == "OTA_READY");

  // Send chunk seq 0 (2 header bytes + 200 payload bytes)
  uint8_t chunk0[202];
  chunk0[0] = 0x00; chunk0[1] = 0x00; // seq = 0
  memset(chunk0 + 2, 0x41, 200);
  handleOtaChunk(chunk0, sizeof(chunk0));

  // Send chunk seq 2 (skipped seq 1!) -> sequence mismatch
  uint8_t chunk2[202];
  chunk2[0] = 0x02; chunk2[1] = 0x00; // seq = 2
  memset(chunk2 + 2, 0x42, 200);
  handleOtaChunk(chunk2, sizeof(chunk2));
  assert(mockChar.value.rfind("OTA_ERR:SEQ_MISMATCH", 0) == 0);
}

TEST(test_ota_state_machine_invalid_signature_at_end) {
  resetState();
  isConfigMode = true;
  mockChar.value = "";
  mockChar.notifications.clear();

  // Begin with invalid signature
  uint8_t bad_sig[64];
  memcpy(bad_sig, OTA_TEST_SIG, 64);
  bad_sig[0] ^= 0x55;
  std::string badSigHex = hexEncode(bad_sig, 64);

  handleConfigCommand(String(("OTA_BEGIN 100 " + badSigHex).c_str()), true);
  assert(mockChar.value == "OTA_READY");

  // Send chunk 0 with 100 bytes
  uint8_t chunk[102];
  chunk[0] = 0; chunk[1] = 0;
  memset(chunk + 2, 0xAA, 100);
  handleOtaChunk(chunk, sizeof(chunk));

  handleConfigCommand("OTA_END", true);
  assert(mockChar.value.rfind("OTA_ERR:SIGNATURE_INVALID", 0) == 0);
}

TEST(test_ota_timeout_and_config_mode_pause) {
  resetState();
  isConfigMode = true;
  mockChar.value = "";
  mockChar.notifications.clear();

  std::string sigHex = hexEncode(OTA_TEST_SIG, 64);
  handleConfigCommand(String(("OTA_BEGIN 1024 " + sigHex).c_str()), true);
  assert(mockChar.value == "OTA_READY");

  // Advance time by 10s -> still within 15s chunk timeout
  advanceMillis(10000);
  processOtaTimeout();
  assert(mockChar.value == "OTA_READY");

  // Advance time by another 6s (total 16s without chunk) -> chunk timeout triggers abort
  advanceMillis(6000);
  processOtaTimeout();
  assert(mockChar.value == "OTA_ERR:TIMEOUT");
}

TEST(test_ota_rejected_outside_config_mode) {
  resetState();
  isConfigMode = false;
  mockChar.value = "";
  mockChar.notifications.clear();

  std::string sigHex = hexEncode(OTA_TEST_SIG, 64);
  handleConfigCommand(String(("OTA_BEGIN 1024 " + sigHex).c_str()), true);
  assert(mockChar.value.rfind("OTA_ERR:NOT_CONFIG_MODE", 0) == 0);
}

TEST(test_ota_16_chunk_acknowledgement_boundary) {
  resetState();
  isConfigMode = true;
  mockChar.value = "";
  mockChar.notifications.clear();

  // 17 chunks of 100 bytes = 1700 bytes
  std::string sigHex = hexEncode(OTA_TEST_SIG, 64);
  handleConfigCommand(String(("OTA_BEGIN 1700 " + sigHex).c_str()), true);
  assert(mockChar.value == "OTA_READY");
  mockChar.notifications.clear();

  // Send chunks 0 to 14 (15 chunks) -> no ACK yet
  uint8_t chunk[102];
  memset(chunk + 2, 0x11, 100);
  for (uint16_t seq = 0; seq < 15; seq++) {
    chunk[0] = (uint8_t)(seq & 0xFF);
    chunk[1] = (uint8_t)((seq >> 8) & 0xFF);
    handleOtaChunk(chunk, sizeof(chunk));
    assert(mockChar.notifications.empty());
  }

  // Send chunk 15 (16th chunk) -> triggers OTA_ACK:15:1600
  chunk[0] = 15;
  chunk[1] = 0;
  handleOtaChunk(chunk, sizeof(chunk));
  assert(mockChar.notifications.size() == 1);
  assert(mockChar.notifications[0] == "OTA_ACK:15:1600");
  mockChar.notifications.clear();

  // Send chunk 16 (17th chunk, final chunk) -> triggers OTA_ACK:16:1700 because written == expected
  chunk[0] = 16;
  chunk[1] = 0;
  handleOtaChunk(chunk, sizeof(chunk));
  assert(mockChar.notifications.size() == 1);
  assert(mockChar.notifications[0] == "OTA_ACK:16:1700");
}

TEST(test_ota_blocks_non_ota_commands) {
  resetState();
  isConfigMode = true;
  mockChar.value = "";
  mockChar.notifications.clear();

  std::string sigHex = hexEncode(OTA_TEST_SIG, 64);
  handleConfigCommand(String(("OTA_BEGIN 1024 " + sigHex).c_str()), true);
  assert(mockChar.value == "OTA_READY");

  // Non-OTA command during OTA should be rejected
  handleConfigCommand("GET_CONFIG", true);
  assert(mockChar.value == "ERR BUSY OTA_IN_PROGRESS");

  handleConfigCommand("SET_NAME TestDactyl", true);
  assert(mockChar.value == "ERR BUSY OTA_IN_PROGRESS");

  // OTA_ABORT is allowed
  handleConfigCommand("OTA_ABORT", true);
  assert(mockChar.value == "OTA_ABORTED");

  // After abort, normal commands work again
  handleConfigCommand("GET_CONFIG", true);
  assert(mockChar.value != "ERR BUSY OTA_IN_PROGRESS");
}

// -----------------------------------------------------------------------------
// GET_DIAG: Reset-Grund, Laufzeit, Heap und längster loop()-Durchlauf
// -----------------------------------------------------------------------------
TEST(test_get_diag_json_and_reset_reason_mapping) {
  resetState();
  struct { esp_reset_reason_t r; const char* name; } expected[] = {
    {ESP_RST_UNKNOWN, "unknown"}, {ESP_RST_POWERON, "power_on"}, {ESP_RST_EXT, "external"},
    {ESP_RST_SW, "software"}, {ESP_RST_PANIC, "panic"}, {ESP_RST_INT_WDT, "int_wdt"},
    {ESP_RST_TASK_WDT, "task_wdt"}, {ESP_RST_WDT, "wdt"}, {ESP_RST_DEEPSLEEP, "deep_sleep"},
    {ESP_RST_BROWNOUT, "brownout"}, {ESP_RST_SDIO, "sdio"}, {ESP_RST_USB, "usb"},
    {ESP_RST_JTAG, "jtag"}, {ESP_RST_EFUSE, "efuse"}, {ESP_RST_PWR_GLITCH, "pwr_glitch"},
    {ESP_RST_CPU_LOCKUP, "cpu_lockup"},
  };
  for (auto& e : expected) assert(std::string(resetReasonName(e.r)) == e.name);
  // Unbekannter Zahlenwert: sicherer Name, kein JSON-Bruch
  assert(std::string(resetReasonName((esp_reset_reason_t)99)) == "unknown");

  assert(buildDiagLine(ESP_RST_TASK_WDT, 12, 3, 4, 5).c_str() == std::string(
    "DIAG:{\"reset\":\"task_wdt\",\"uptime_s\":12,\"heap_free\":3,\"heap_min\":4,\"loop_max_us\":5}"));
  // Größte Werte passen in den Puffer und bleiben gültig abgeschlossen
  std::string big = buildDiagLine(ESP_RST_CPU_LOCKUP, 4294967295u, 4294967295u, 4294967295u, 4294967295u).c_str();
  assert(big.size() < 159 && big.back() == '}' && big.find("\"loop_max_us\":4294967295}") != std::string::npos);

  // Linke Hälfte: Warteschlangenwerte am Ende; ohne Angabe bleibt die Zeile des Masters unverändert
  assert(buildDiagLine(ESP_RST_TASK_WDT, 12, 3, 4, 5, true, 64, 1).c_str() == std::string(
    "DIAG:{\"reset\":\"task_wdt\",\"uptime_s\":12,\"heap_free\":3,\"heap_min\":4,\"loop_max_us\":5,\"sq_max\":64,\"sq_drop\":1}"));
  std::string bigQ = buildDiagLine(ESP_RST_CPU_LOCKUP, 4294967295u, 4294967295u, 4294967295u, 4294967295u, true, 4294967295u, 4294967295u).c_str();
  assert(bigQ.size() < 223 && bigQ.back() == '}' && bigQ.find("\"sq_drop\":4294967295}") != std::string::npos);

  // Befehl über USB-Serial
  diagBootReason = ESP_RST_BROWNOUT;
  diagLoopMaxUs = 0;
  diagNoteLoopUs(700);
  diagNoteLoopUs(200);                      // kleinerer Wert senkt das Maximum nicht
  _mock_heap_free = 111; _mock_heap_min = 99;
  testSqMax = 64; testSqDrop = 1;
  setMillis(5000);
  mockChar.notifications.clear();
  handleConfigCommand("GET_DIAG", false);
  // Das Makro DIAG_SEND_QUEUE_* (nur die linke Hälfte) hängt die Warteschlangenwerte an
  assert(mockChar.value == "DIAG:{\"reset\":\"brownout\",\"uptime_s\":5,\"heap_free\":111,\"heap_min\":99,\"loop_max_us\":700,\"sq_max\":64,\"sq_drop\":1}");
}

TEST(test_get_diag_ble_rejected_in_keyboard_mode) {
  resetState();
  isConfigMode = false;
  mockChar.notifications.clear();
  mockChar.value.clear();
  handleConfigCommand("GET_DIAG", true);
  assert(mockChar.notifications.size() == 1);
  assert(mockChar.value == "ERR FORBIDDEN GET_DIAG");
  // Config-Modus: über BLE erlaubt
  isConfigMode = true;
  handleConfigCommand("GET_DIAG", true);
  assert(mockChar.value.rfind("DIAG:{", 0) == 0);
  isConfigMode = false;
}

// =============================================================================
// Host-LEDs (Num/Caps/Scroll Lock) und Caps-Lock-LED
// =============================================================================
static void feedLedReport(uint8_t b) { hostLedsOnReport(testHostLeds, &b, 1); }

TEST(test_host_leds_report_stores_state_and_prints_line) {
  resetState();
  Serial.clear();
  feedLedReport(0x02);  // Caps Lock
  assert(testHostLeds.bits == HOST_LED_CAPS);
  hostLedsService(testHostLeds);
  assert(Serial.outputLines.size() == 1);
  assert(Serial.outputLines[0] == "HOST_LEDS:{\"num\":0,\"caps\":1,\"scroll\":0}");
  // Ohne Änderung keine weitere Zeile
  hostLedsService(testHostLeds);
  feedLedReport(0x02);
  hostLedsService(testHostLeds);
  assert(Serial.outputLines.size() == 1);
  // Alle drei Bits; die oberen Bits (Compose, Kana) zählen nicht
  feedLedReport(0xFF);
  assert(testHostLeds.bits == 0x07);
  hostLedsService(testHostLeds);
  assert(Serial.outputLines.back() == "HOST_LEDS:{\"num\":1,\"caps\":1,\"scroll\":1}");
  // Ein leerer Report ändert nichts
  assert(!hostLedsOnReport(testHostLeds, nullptr, 0));
  uint8_t none = 0;
  assert(!hostLedsOnReport(testHostLeds, &none, 0));
  assert(testHostLeds.bits == 0x07);
}

TEST(test_host_leds_two_changes_between_loops_print_latest) {
  resetState();
  Serial.clear();
  feedLedReport(0x02);
  feedLedReport(0x00);   // zurück auf den Ausgangswert vor der Ausgabe: eine Zeile mit dem neuen Stand
  hostLedsService(testHostLeds);
  assert(Serial.outputLines.size() == 1);
  assert(Serial.outputLines[0] == "HOST_LEDS:{\"num\":0,\"caps\":0,\"scroll\":0}");
}

TEST(test_host_leds_line_uses_the_given_snapshot) {
  resetState();
  feedLedReport(0x02);
  char line[64];
  assert(hostLedsTakeLine(testHostLeds, 0x01, line, sizeof(line)));
  assert(std::string(line) == "HOST_LEDS:{\"num\":1,\"caps\":0,\"scroll\":0}");
  assert(!hostLedsTakeLine(testHostLeds, 0x01, line, sizeof(line)));
}

TEST(test_host_leds_disconnect_clears_state) {
  resetState();
  feedLedReport(0x02);
  hostLedsReset(testHostLeds);
  assert(testHostLeds.bits == 0);
  Serial.clear();
  hostLedsService(testHostLeds);
  assert(Serial.outputLines.back() == "HOST_LEDS:{\"num\":0,\"caps\":0,\"scroll\":0}");
}

TEST(test_host_leds_device_info_field) {
  resetState();
  feedLedReport(0x02);
  mockChar.notifications.clear();
  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.find("\"host_leds\":{\"num\":0,\"caps\":1,\"scroll\":0},\"caps_led\":0") != std::string::npos);
  assert(mockChar.value.back() == '}');
}

TEST(test_caps_led_setting_command_and_nvs) {
  resetState();
  handleConfigCommand("SET_CAPS_LED 1", false);
  assert(mockChar.value == "OK SET_CAPS_LED 1");
  assert(capsLedEnabled == 1);
  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.find("\"caps_led\":1") != std::string::npos);
  capsLedEnabled = 0;
  loadKeymapFromNVS();
  assert(capsLedEnabled == 1);
  const char* bad[] = {"SET_CAPS_LED 2", "SET_CAPS_LED", "SET_CAPS_LED x", "SET_CAPS_LED -1"};
  for (const char* b : bad) {
    handleConfigCommand(b, false);
    assert(mockChar.value.rfind("ERR", 0) == 0);
  }
  assert(capsLedEnabled == 1);
  // NVS-Fehler: RAM-Stand bleibt
  Preferences::failUCharKey = "caps_led";
  handleConfigCommand("SET_CAPS_LED 0", false);
  assert(mockChar.value == "ERR NVS SET_CAPS_LED");
  assert(capsLedEnabled == 1);
}

TEST(test_host_leds_state_hidden_from_keyboard_mode_ble) {
  resetState();
  feedLedReport(0x02);
  isConfigMode = false;
  handleConfigCommand("GET_INFO", true);
  assert(mockChar.value.find("DEVICE_INFO:") != std::string::npos);
  assert(mockChar.value.find("host_leds") == std::string::npos && mockChar.value.find("caps_led") == std::string::npos);
  handleConfigCommand("GET_INFO", false);   // USB
  assert(mockChar.value.find("\"host_leds\":{\"num\":0,\"caps\":1") != std::string::npos);
  isConfigMode = true;                      // Config Mode über BLE
  handleConfigCommand("GET_INFO", true);
  assert(mockChar.value.find("\"host_leds\"") != std::string::npos);
  isConfigMode = false;
}

TEST(test_caps_led_pin_follows_caps_lock_only_when_enabled) {
  resetState();
  _mock_pin_state[HOST_LED_PIN] = 1;
  feedLedReport(0x02);
  capsLedEnabled = 0;
  hostLedsService(testHostLeds);
  assert(_mock_pin_state[HOST_LED_PIN] == 1);       // Setting aus: LED bleibt aus
  capsLedEnabled = 1;
  hostLedsService(testHostLeds);
  assert(_mock_pin_state[HOST_LED_PIN] == 0);       // aktiv LOW: LED an
  feedLedReport(0x01);                              // nur Num Lock
  hostLedsService(testHostLeds);
  assert(_mock_pin_state[HOST_LED_PIN] == 1);
  feedLedReport(0x03);
  hostLedsService(testHostLeds);
  assert(_mock_pin_state[HOST_LED_PIN] == 0);
  capsLedEnabled = 0;                               // Setting aus bei Caps Lock: LED löschen
  hostLedsService(testHostLeds);
  assert(_mock_pin_state[HOST_LED_PIN] == 1);
}

TEST(test_host_leds_ble_composite_wired_to_core) {
  // Die BLE-Klasse darf nur den Kern aufrufen (onWrite läuft im BLE-Task)
  std::ifstream f(std::string(__FILE__).substr(0, std::string(__FILE__).rfind('/')) + "/../dactyl_right/DactylBleComposite.h");
  std::string src((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
  assert(src.find("hostLedsOnReport(hostLeds, me->getData(), me->getLength());") != std::string::npos);
  assert(src.find("hostLedsReset(hostLeds);") != std::string::npos);
  assert(src.find("void onWrite(BLECharacteristic* me) override {}") == std::string::npos);
}

// -----------------------------------------------------------------------------
// Combos je Ebene: Ebenenmaske (ADD_COMBO, NVS, GET_CONFIG)
// -----------------------------------------------------------------------------
TEST(test_combo_layer_mask_limits_buffering_and_trigger) {
  resetState();
  comboTimeoutMs = 40;
  KEYMAP[0][2][1] = 'j';
  KEYMAP[0][2][2] = 'k';
  KEYMAP[2][2][1] = 'x';
  KEYMAP[2][2][2] = 'y';
  toggleLayers[2] = false;
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 1", false);   // J + K -> Esc, nur Ebene 0 (Maske 0x01)
  assert(mockChar.value == "OK ADD_COMBO 0");
  assert(userCombos[0].layerMask == 0x01);

  // Ebene 0: die Combo löst aus, die Tasten werden gepuffert
  setMillis(1000);
  pressKey(2, 1);
  assert(isComboCandidateKey(2, 1));
  assert(bleKeyboard.pressedKeys.empty());                 // gepuffert: noch nichts gesendet
  setMillis(1010);
  pressKey(2, 2);
  checkUserCombos();
  assert(comboRuntime[0].active);
  assert(bleKeyboard.writtenKeys.size() == 1 && bleKeyboard.writtenKeys[0] == KEY_ESC);
  releaseKey(2, 1);
  releaseKey(2, 2);
  checkUserCombos();
  bleKeyboard.writtenKeys.clear();

  // Ebene 2: außerhalb der Maske, die Taste sendet sofort und löst keine Combo aus
  advanceMillis(1000);
  toggleLayers[2] = true;
  assert(getActiveLayer() == 2);
  assert(!isComboCandidateKey(2, 1));
  pressKey(2, 1);
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == 'x'); // ohne Combo-Verzögerung
  advanceMillis(10);
  pressKey(2, 2);
  checkUserCombos();
  assert(!comboRuntime[0].active);
  assert(bleKeyboard.writtenKeys.empty());
  assert(bleKeyboard.pressedKeys.size() == 2);
  releaseKey(2, 1);
  releaseKey(2, 2);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_combo_layer_mask_uses_the_layer_of_the_press) {
  resetState();
  comboTimeoutMs = 40;
  KEYMAP[0][2][1] = 'j';
  KEYMAP[2][2][1] = 'x';
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 1", false);
  // Gedrückt auf Ebene 0 (gepuffert), die Ebene wechselt vor dem Loslassen: der Druck bleibt ein Kandidat
  setMillis(1000);
  pressKey(2, 1);
  toggleLayers[2] = true;
  assert(isComboCandidateKey(2, 1));
  releaseKey(2, 1);
  assert(countPresses('j') == 1);                          // schneller Tipp: wird beim Loslassen gesendet
  assert(countPresses('x') == 0);
  assert(!isComboCandidateKey(2, 1));                      // nach dem Loslassen zählt wieder die aktive Ebene
}

TEST(test_combo_layer_mask_follows_the_tri_layer_target) {
  resetState();
  comboTimeoutMs = 40;
  KEYMAP[0][2][1] = 'j';
  KEYMAP[3][2][1] = 'z';
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 7", false); // Ebenen 0..2
  numTriLayers = 1;
  triLayerRules[0] = 1; triLayerRules[1] = 2; triLayerRules[2] = 3;
  momentaryLayers[1] = true;
  assert(getActiveLayer() == 1);
  assert(isComboCandidateKey(2, 1));                       // Ebene 1 liegt in der Maske
  momentaryLayers[2] = true;
  assert(getActiveLayer() == 3);                           // Tri-Layer-Ziel
  assert(!isComboCandidateKey(2, 1));                      // Ebene 3 liegt außerhalb der Maske
  pressKey(2, 1);
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == 'z');
  releaseKey(2, 1);
  numTriLayers = 0;
}

TEST(test_add_combo_layer_mask_arguments) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);   // ohne Maske: alle Ebenen
  assert(mockChar.value == "OK ADD_COMBO 0" && userCombos[0].layerMask == 0xFF);
  handleConfigCommand("ADD_COMBO 2 1 2 3 0 177 5", false);
  assert(mockChar.value == "OK ADD_COMBO 1" && userCombos[1].layerMask == 5);
  handleConfigCommand("ADD_COMBO 2 1 2 4 0 177 0", false); // Maske 0: nie gültig
  assert(mockChar.value == "ERR ARGS ADD_COMBO 2 1 2 4 0 177 0");
  handleConfigCommand("ADD_COMBO 2 1 2 4 0 177 256", false);
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
  handleConfigCommand("ADD_COMBO 2 1 2 4 0 177 1 9", false); // zu viele Werte
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
  assert(numCombos == 2);
}

TEST(test_combo_layer_mask_persists_and_is_reported) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 1", false);
  handleConfigCommand("ADD_COMBO 3 1 3 2 1 128 6", false);
  handleConfigCommand("SAVE_COMBOS", false);
  assert(mockChar.value == "OK SAVE_COMBOS");
  assert(preferences.isKey("combos_v2") && !preferences.isKey("combos_data"));
  assert(preferences.getBytesLength("combos_v2") == 2 + 2 * COMBO_NVS_RECORD_BYTES);

  numCombos = 0;
  userCombos[0] = KeyCombo{};
  userCombos[1] = KeyCombo{};
  loadKeymapFromNVS();
  assert(numCombos == 2);
  assert(userCombos[0].layerMask == 1 && userCombos[0].action == 177 && userCombos[0].r1 == 2 && userCombos[0].c2 == 2);
  assert(userCombos[1].layerMask == 6 && userCombos[1].behavior == 1 && userCombos[1].action == 128);

  mockChar.notifications.clear();
  handleConfigCommand("GET_CONFIG", false);
  bool data = false;
  for (const auto& n : mockChar.notifications) {
    if (n == "COMBO_DATA:{\"o\":0,\"e\":[[2,1,2,2,0,177,1],[3,1,3,2,1,128,6]]}") data = true;
  }
  assert(data);
}

TEST(test_combo_nvs_legacy_format_loads_with_all_layers) {
  resetState();
  // Altes Format: 8 Bytes je Combo (Padding vor der 16-Bit-Aktion)
  const uint8_t legacy[16] = { 2, 1, 2, 2, 0, 0, 177, 0,   3, 1, 3, 2, 1, 0, 128, 0 };
  preferences.putUChar("num_combos", 2);
  preferences.putBytes("combos_data", legacy, sizeof(legacy));
  loadKeymapFromNVS();
  assert(numCombos == 2);
  assert(userCombos[0].layerMask == 0xFF && userCombos[1].layerMask == 0xFF);
  assert(userCombos[0].action == 177 && userCombos[1].action == 128 && userCombos[1].behavior == 1);
  // Beim Speichern wandert die Liste ins neue Format; das alte verschwindet
  handleConfigCommand("SAVE_COMBOS", false);
  assert(preferences.isKey("combos_v2") && !preferences.isKey("combos_data"));
  numCombos = 0;
  loadKeymapFromNVS();
  assert(numCombos == 2 && userCombos[1].action == 128 && userCombos[1].layerMask == 0xFF);
}

TEST(test_combo_nvs_rejects_unknown_version_or_size) {
  resetState();
  uint8_t bad[2 + COMBO_NVS_RECORD_BYTES] = { 99, COMBO_NVS_RECORD_BYTES, 2, 1, 2, 2, 0, 177, 0, 1 };
  preferences.putUChar("num_combos", 1);
  preferences.putBytes("combos_v2", bad, sizeof(bad));
  numCombos = 0;
  loadKeymapFromNVS();
  assert(numCombos == 0);                                  // unbekannte Version: nicht übernommen
  bad[0] = COMBO_NVS_VERSION;
  preferences.putBytes("combos_v2", bad, sizeof(bad) - 1);
  loadKeymapFromNVS();
  assert(numCombos == 0);                                  // falsche Länge
}

TEST(test_combo_save_failure_keeps_the_old_format_and_count) {
  resetState();
  // Zustand eines Geräts mit altem Format
  const uint8_t legacy[8] = { 2, 1, 2, 2, 0, 0, 177, 0 };
  preferences.putUChar("num_combos", 1);
  preferences.putBytes("combos_data", legacy, sizeof(legacy));
  loadKeymapFromNVS();
  assert(numCombos == 1 && userCombos[0].layerMask == 0xFF);
  handleConfigCommand("ADD_COMBO 3 1 3 2 0 128 2", false);
  // Das neue Blob schlägt fehl (NVS voll): altes Blob und Zähler bleiben gültig
  Preferences::failBytesKey = "combos_v2";
  handleConfigCommand("SAVE_COMBOS", false);
  Preferences::failBytesKey.clear();
  assert(mockChar.value == "ERR NVS SAVE_COMBOS");
  assert(preferences.isKey("combos_data") && preferences.getUChar("num_combos", 0) == 1);
  numCombos = 0;
  loadKeymapFromNVS();
  assert(numCombos == 1 && userCombos[0].action == 177);
}

TEST(test_combo_load_falls_back_to_old_format_when_v2_is_unusable) {
  resetState();
  const uint8_t legacy[8] = { 2, 1, 2, 2, 0, 0, 177, 0 };
  preferences.putUChar("num_combos", 1);
  preferences.putBytes("combos_data", legacy, sizeof(legacy));
  uint8_t bad[2 + COMBO_NVS_RECORD_BYTES] = { 99, COMBO_NVS_RECORD_BYTES };
  preferences.putBytes("combos_v2", bad, sizeof(bad));
  loadKeymapFromNVS();
  assert(numCombos == 1 && userCombos[0].action == 177 && userCombos[0].layerMask == 0xFF);
}

TEST(test_add_combo_rejects_a_non_numeric_mask) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 abc", false);
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0 && numCombos == 0);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 3x", false);
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0 && numCombos == 0);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 3 ", false);
  assert(numCombos == 1 && userCombos[0].layerMask == 3);
}

TEST(test_combo_layer_mask_holds_for_a_late_double_tap_flush) {
  resetState();
  comboTimeoutMs = 40;
  KEYMAP[0][2][1] = 'j';
  DTAPMAP[0][2][1] = 'd';
  KEYMAP[2][2][1] = 'x';
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 1", false);   // nur Ebene 0
  // Erster Tipp auf Ebene 0 wartet auf einen zweiten; die Ebene wechselt, dann wird der Tipp nachgeholt
  tapKeyAt(2, 1, 1000, 1020);
  assert(bleKeyboard.pressedKeys.empty());
  toggleLayers[2] = true;
  assert(getActiveLayer() == 2);
  runTicks(1020 + tappingTermMs + 5);
  // Die Ausgabe ist in beiden Zweigen gleich (gepuffert oder sofort); geprüft wird der Zustand nach dem Nachholen
  assert(countPresses('j') == 1);
  assert(countPresses('x') == 0);
  assert(comboPressLayer1[2][1] == 0);                      // der Wert des Nachholens bleibt nicht stehen
}

TEST(test_combo_save_failure_after_the_blob_loads_the_new_combos) {
  resetState();
  const uint8_t legacy[8] = { 2, 1, 2, 2, 0, 0, 177, 0 };
  preferences.putUChar("num_combos", 1);
  preferences.putBytes("combos_data", legacy, sizeof(legacy));
  loadKeymapFromNVS();
  handleConfigCommand("ADD_COMBO 3 1 3 2 0 128 2", false);
  // Der Zähler schlägt nach dem neuen Blob fehl: das alte Blob bleibt stehen, das neue ist vollständig.
  // Das Laden nimmt die Anzahl aus dem neuen Blob, die Combos der Speicherung gehen nicht verloren.
  Preferences::failUCharKey = "num_combos";
  handleConfigCommand("SAVE_COMBOS", false);
  Preferences::failUCharKey.clear();
  assert(mockChar.value == "ERR NVS SAVE_COMBOS");
  assert(!preferences.isKey("combos_data"));                // das alte Blob ist vor dem Zähler entfernt
  numCombos = 0;
  loadKeymapFromNVS();
  assert(numCombos == 2 && userCombos[0].action == 177 && userCombos[0].layerMask == 0xFF);
  assert(userCombos[1].action == 128 && userCombos[1].layerMask == 2);
  // Gelingt das Speichern danach, gilt das neue Format und das alte Blob verschwindet
  handleConfigCommand("SAVE_COMBOS", false);
  assert(mockChar.value == "OK SAVE_COMBOS" && !preferences.isKey("combos_data"));
  numCombos = 0;
  loadKeymapFromNVS();
  assert(numCombos == 2 && userCombos[1].layerMask == 2);
}

TEST(test_combo_save_over_a_v2_blob_survives_a_failed_count_write) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 1", false);
  handleConfigCommand("SAVE_COMBOS", false);               // v2 mit einer Combo, Zähler 1
  assert(mockChar.value == "OK SAVE_COMBOS");
  handleConfigCommand("ADD_COMBO 3 1 3 2 0 128 2", false);
  // Der Zähler schlägt nach dem neuen Blob (2 Combos) fehl: der alte Zähler 1 passt nicht zur Länge
  Preferences::failUCharKey = "num_combos";
  handleConfigCommand("SAVE_COMBOS", false);
  Preferences::failUCharKey.clear();
  assert(mockChar.value == "ERR NVS SAVE_COMBOS");
  assert(preferences.getUChar("num_combos", 0) == 1);
  numCombos = 0;
  loadKeymapFromNVS();
  assert(numCombos == 2);                                  // keine Rückkehr zu den einkompilierten Combos
  assert(userCombos[0].layerMask == 1 && userCombos[1].layerMask == 2 && userCombos[1].action == 128);
}

TEST(test_combo_downgrade_edit_upgrade_keeps_the_newer_old_format) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 1", false);
  handleConfigCommand("SAVE_COMBOS", false);               // Stand der neuen Firmware: v2 mit einer Combo
  // Eine ältere Firmware schreibt danach ihr Format (zwei Combos, ohne Maske) und lässt combos_v2 stehen
  const uint8_t older[16] = { 2, 1, 2, 2, 0, 0, 177, 0,   4, 1, 4, 2, 0, 0, 120, 0 };
  preferences.putUChar("num_combos", 2);
  preferences.putBytes("combos_data", older, sizeof(older));
  numCombos = 0;
  loadKeymapFromNVS();
  assert(numCombos == 2 && userCombos[1].action == 120 && userCombos[1].layerMask == 0xFF);
}

TEST(test_empty_combo_save_with_failed_count_keeps_the_blobs) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 1", false);
  handleConfigCommand("SAVE_COMBOS", false);
  handleConfigCommand("CLEAR_COMBOS", false);
  Preferences::failUCharKey = "num_combos";
  handleConfigCommand("SAVE_COMBOS", false);
  Preferences::failUCharKey.clear();
  assert(mockChar.value == "ERR NVS SAVE_COMBOS");
  assert(preferences.isKey("combos_v2"));                  // der Zähler blieb 1: die Combo geht nicht verloren
  numCombos = 0;
  loadKeymapFromNVS();
  assert(numCombos == 1 && userCombos[0].layerMask == 1);
}

// -----------------------------------------------------------------------------
// Combos mit dritter Taste und eigenem Fenster (ADD_COMBO, NVS, GET_CONFIG)
// -----------------------------------------------------------------------------
static void setUpThreeKeyKeymap() {
  KEYMAP[0][2][1] = 'j';
  KEYMAP[0][2][2] = 'k';
  KEYMAP[0][2][3] = 'l';
}

TEST(test_three_key_combo_fires_when_all_keys_arrive_in_the_window) {
  resetState();
  comboTimeoutMs = 40;
  setUpThreeKeyKeymap();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 2 3 0", false);   // J + K + L -> Esc
  assert(mockChar.value == "OK ADD_COMBO 0");
  assert(userCombos[0].r3 == 2 && userCombos[0].c3 == 3 && userCombos[0].windowMs == 0);

  setMillis(1000);
  pressKey(2, 1);
  setMillis(1010);
  pressKey(2, 2);
  checkUserCombos();
  assert(!comboRuntime[0].active);                           // zwei von drei Tasten lösen nichts aus
  assert(bleKeyboard.writtenKeys.empty() && bleKeyboard.pressedKeys.empty());   // beide bleiben gepuffert
  setMillis(1025);
  pressKey(2, 3);
  checkUserCombos();
  assert(comboRuntime[0].active);
  assert(bleKeyboard.writtenKeys.size() == 1 && bleKeyboard.writtenKeys[0] == KEY_ESC);
  assert(bleKeyboard.pressedKeys.empty());                   // keine Einzeltaste ging vorher oder nachher raus
  releaseKey(2, 3);                                          // eine Taste los: die Combo endet
  checkUserCombos();
  assert(!comboRuntime[0].active);
  releaseKey(2, 1);
  releaseKey(2, 2);
  checkUserCombos();
  assert(bleKeyboard.pressedKeys.empty() && bleKeyboard.writtenKeys.size() == 1);
}

TEST(test_three_key_combo_does_not_fire_when_one_key_comes_late) {
  resetState();
  comboTimeoutMs = 40;
  setUpThreeKeyKeymap();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 2 3 0", false);
  setMillis(1000);
  pressKey(2, 1);
  setMillis(1010);
  pressKey(2, 2);
  setMillis(1060);                                           // 60 ms nach der ersten Taste: außerhalb von 40 ms
  pressKey(2, 3);
  checkUserCombos();
  assert(!comboRuntime[0].active);
  assert(bleKeyboard.writtenKeys.empty());
  releaseKey(2, 1);
  releaseKey(2, 2);
  releaseKey(2, 3);
  checkUserCombos();
  assert(!comboRuntime[0].active);
}

TEST(test_three_key_combo_window_covers_all_pairs_not_only_neighbours) {
  resetState();
  comboTimeoutMs = 40;
  setUpThreeKeyKeymap();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 2 3 0", false);
  setMillis(1000);
  pressKey(2, 1);
  setMillis(1030);
  pressKey(2, 2);
  setMillis(1060);                                           // jedes Nachbarpaar liegt im Fenster, J und L nicht
  pressKey(2, 3);
  checkUserCombos();
  assert(!comboRuntime[0].active);
}

TEST(test_two_key_combo_with_a_custom_window) {
  resetState();
  comboTimeoutMs = 40;
  setUpThreeKeyKeymap();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 255 255 120", false);   // J + K, Fenster 120 ms
  assert(mockChar.value == "OK ADD_COMBO 0");
  assert(userCombos[0].r3 == COMBO_NO_KEY && userCombos[0].windowMs == 120);

  // 100 ms Abstand: nur das eigene Fenster erlaubt die Combo
  setMillis(1000);
  pressKey(2, 1);
  setMillis(1100);
  pressKey(2, 2);
  checkUserCombos();
  assert(comboRuntime[0].active);
  assert(bleKeyboard.writtenKeys.size() == 1 && bleKeyboard.writtenKeys[0] == KEY_ESC);
  releaseKey(2, 1);
  releaseKey(2, 2);
  checkUserCombos();
  bleKeyboard.writtenKeys.clear();

  // 130 ms Abstand: außerhalb des eigenen Fensters
  advanceMillis(1000);
  pressKey(2, 1);
  advanceMillis(130);
  pressKey(2, 2);
  checkUserCombos();
  assert(!comboRuntime[0].active);
}

TEST(test_combo_window_sets_the_buffer_time_of_a_candidate) {
  resetState();
  comboTimeoutMs = 40;
  setUpThreeKeyKeymap();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 255 255 120", false);
  setMillis(1000);
  pressKey(2, 1);
  assert(bleKeyboard.pressedKeys.empty());
  setMillis(1060);                                           // das globale Fenster (40 ms) ist abgelaufen
  processDeferredKeys(1060);
  assert(bleKeyboard.pressedKeys.empty());                   // die Taste wartet das eigene Fenster ab
  setMillis(1125);
  processDeferredKeys(1125);
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == 'j');
}

TEST(test_combo_without_window_keeps_the_global_timeout) {
  resetState();
  comboTimeoutMs = 40;
  setUpThreeKeyKeymap();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
  assert(userCombos[0].windowMs == 0 && userCombos[0].r3 == COMBO_NO_KEY && userCombos[0].c3 == COMBO_NO_KEY);
  setMillis(1000);
  pressKey(2, 1);
  setMillis(1045);
  processDeferredKeys(1045);
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == 'j');
}

TEST(test_third_key_is_buffered_as_a_combo_candidate) {
  resetState();
  setUpThreeKeyKeymap();
  assert(!isComboCandidateKey(2, 3));
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 2 3 0", false);
  assert(isComboCandidateKey(2, 3));
  setMillis(1000);
  pressKey(2, 3);
  assert(bleKeyboard.pressedKeys.empty());                   // gepuffert, nicht sofort gesendet
}

TEST(test_add_combo_third_key_and_window_arguments) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 2", false);            // nur eine Koordinate
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 9 3 0", false);        // Zeile außerhalb der Matrix
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 2 9 0", false);        // Spalte außerhalb der Matrix
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 2 1 0", false);        // dritte Taste = erste Taste
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 2 3 501", false);      // Fenster über dem Höchstwert
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 2 3 9", false);        // Fenster unter dem Mindestwert
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 255 255 1", false);
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 255 3 0", false);      // nur eine Koordinate ist 255
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 2 3 0 7", false);      // zu viele Werte
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 0 2 3 0", false);          // Maske 0
  assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
  assert(numCombos == 0);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 2 3 10", false);       // Mindestwert ist erlaubt
  assert(mockChar.value == "OK ADD_COMBO 0" && userCombos[0].windowMs == 10);
  handleConfigCommand("CLEAR_COMBOS", false);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 2 3 500", false);      // Höchstwert ist erlaubt
  assert(mockChar.value == "OK ADD_COMBO 0" && userCombos[0].windowMs == 500);
  handleConfigCommand("ADD_COMBO 3 1 3 2 0 177 3", false);                // nur Maske wie bisher
  assert(mockChar.value == "OK ADD_COMBO 1" && userCombos[1].r3 == COMBO_NO_KEY && userCombos[1].windowMs == 0);
  handleConfigCommand("ADD_COMBO 4 1 4 2 0 177 255 4 3", false);          // dritte Taste ohne Fenster: globales Fenster
  assert(mockChar.value == "OK ADD_COMBO 2" && userCombos[2].r3 == 4 && userCombos[2].c3 == 3 && userCombos[2].windowMs == 0);
}

TEST(test_combo_third_key_and_window_persist_and_are_reported) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 2 3 90", false);       // drei Tasten, Fenster 90 ms
  handleConfigCommand("ADD_COMBO 3 1 3 2 1 128", false);                  // zwei Tasten, globales Fenster
  handleConfigCommand("ADD_COMBO 4 1 4 2 0 97 5 255 255 300", false);     // zwei Tasten, Fenster 300 ms, Maske 5
  handleConfigCommand("SAVE_COMBOS", false);
  assert(mockChar.value == "OK SAVE_COMBOS");

  numCombos = 0;
  for (int i = 0; i < 3; i++) userCombos[i] = KeyCombo{};
  loadKeymapFromNVS();
  assert(numCombos == 3);
  assert(userCombos[0].r3 == 2 && userCombos[0].c3 == 3 && userCombos[0].windowMs == 90 && userCombos[0].layerMask == 0xFF);
  assert(userCombos[1].r3 == COMBO_NO_KEY && userCombos[1].c3 == COMBO_NO_KEY && userCombos[1].windowMs == 0);
  assert(userCombos[2].r3 == COMBO_NO_KEY && userCombos[2].windowMs == 300 && userCombos[2].layerMask == 5);

  mockChar.notifications.clear();
  handleConfigCommand("GET_CONFIG", false);
  bool data = false;
  for (const auto& n : mockChar.notifications) {
    if (n == "COMBO_DATA:{\"o\":0,\"e\":[[2,1,2,2,0,177,255,2,3,90],[3,1,3,2,1,128,255],[4,1,4,2,0,97,5,255,255,300]]}") data = true;
  }
  assert(data);
}

TEST(test_combo_nvs_v2_record_without_new_fields_loads_as_before) {
  resetState();
  // Blob wie ihn die Firmware vor Stand 24 schrieb: r3/c3 = 0xFF, Fenster 0
  const uint8_t blob[2 + COMBO_NVS_RECORD_BYTES] = { COMBO_NVS_VERSION, COMBO_NVS_RECORD_BYTES,
                                                     2, 1, 2, 2, 0, 177, 0, 0x06, 0xFF, 0xFF, 0, 0 };
  preferences.putUChar("num_combos", 1);
  preferences.putBytes("combos_v2", blob, sizeof(blob));
  loadKeymapFromNVS();
  assert(numCombos == 1);
  assert(userCombos[0].layerMask == 6 && userCombos[0].r3 == COMBO_NO_KEY && userCombos[0].c3 == COMBO_NO_KEY && userCombos[0].windowMs == 0);
}

TEST(test_combo_nvs_ignores_an_invalid_third_key_or_window) {
  resetState();
  const uint8_t blob[2 + COMBO_NVS_RECORD_BYTES] = { COMBO_NVS_VERSION, COMBO_NVS_RECORD_BYTES,
                                                     2, 1, 2, 2, 0, 177, 0, 0xFF, 99, 99, 0xFF, 0xFF };
  preferences.putUChar("num_combos", 1);
  preferences.putBytes("combos_v2", blob, sizeof(blob));
  loadKeymapFromNVS();
  assert(numCombos == 1);
  assert(userCombos[0].r3 == COMBO_NO_KEY && userCombos[0].c3 == COMBO_NO_KEY);   // keine Taste außerhalb der Matrix
  assert(userCombos[0].windowMs == 0);                                            // Fenster über dem Höchstwert entfällt

  // Dritte Taste gleich Taste 1 oder 2, und ein Fenster unter dem Mindestwert, entfallen ebenfalls
  const uint8_t dup[2 + 3 * COMBO_NVS_RECORD_BYTES] = { COMBO_NVS_VERSION, COMBO_NVS_RECORD_BYTES,
      2, 1, 2, 2, 0, 177, 0, 0xFF, 2, 1, 0, 0,
      2, 1, 2, 2, 0, 177, 0, 0xFF, 2, 2, 0, 0,
      2, 1, 2, 2, 0, 177, 0, 0xFF, 0xFF, 0xFF, 9, 0 };
  numCombos = 0;
  preferences.putUChar("num_combos", 3);
  preferences.putBytes("combos_v2", dup, sizeof(dup));
  loadKeymapFromNVS();
  assert(numCombos == 3);
  for (int i = 0; i < 3; i++) assert(userCombos[i].r3 == COMBO_NO_KEY && userCombos[i].c3 == COMBO_NO_KEY && userCombos[i].windowMs == 0);
}

// Eine Combo mit drei Tasten, die erst zwei Tasten hat, hält die Mod-Tap-Entscheidung zurück (sonst ginge Ctrl vorab raus)
TEST(test_pending_three_key_combo_holds_back_the_mod_tap_hold) {
  resetState();
  comboTimeoutMs = 40;
  chordalHold = 0;
  setUpThreeKeyKeymap();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 2 3 0", false);   // J + K + L -> Esc
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;                                  // J: Tap j / Hold Ctrl
  setMillis(1000);
  pressKey(2, 1);
  setMillis(1010);
  pressKey(2, 2);
  // Das Tapping-Term-Ende von J fällt in die Wartezeit auf L: Ctrl darf nicht vorab am Host ankommen
  setMillis(1020);
  activateTapHoldAsHold(2, 1);
  assert(hasPressedComboPartnerInWindow(2, 1));
  assert(bleKeyboard.pressedKeys.empty() && !keySentToHost[2][1]);
  setMillis(1030);
  pressKey(2, 3);
  checkUserCombos();
  assert(comboRuntime[0].active);
  assert(bleKeyboard.writtenKeys.size() == 1 && bleKeyboard.writtenKeys[0] == KEY_ESC);
  assert(bleKeyboard.pressHistory.empty());                          // Ctrl erscheint nie als einzelner Druck
}

TEST(test_pending_three_key_combo_ends_with_the_window) {
  resetState();
  comboTimeoutMs = 40;
  setUpThreeKeyKeymap();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 2 3 0", false);
  setMillis(1000);
  pressKey(2, 1);
  setMillis(1010);
  pressKey(2, 2);
  setMillis(1039);
  assert(hasPressedComboPartnerInWindow(2, 1));                      // die dritte Taste kann noch im Fenster eintreffen
  setMillis(1041);
  assert(!hasPressedComboPartnerInWindow(2, 1));                     // Fenster abgelaufen: nichts wartet mehr
  // Eine Combo mit zwei Tasten wartet nicht auf eine dritte
  resetState();
  comboTimeoutMs = 40;
  setUpThreeKeyKeymap();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
  setMillis(1000);
  pressKey(2, 1);
  assert(!hasPressedComboPartnerInWindow(2, 1));
}

TEST(test_combo_nvs_legacy_format_has_no_third_key_and_no_window) {
  resetState();
  const uint8_t legacy[8] = { 2, 1, 2, 2, 0, 0, 177, 0 };
  preferences.putUChar("num_combos", 1);
  preferences.putBytes("combos_data", legacy, sizeof(legacy));
  loadKeymapFromNVS();
  assert(numCombos == 1 && userCombos[0].r3 == COMBO_NO_KEY && userCombos[0].c3 == COMBO_NO_KEY && userCombos[0].windowMs == 0);
}

TEST(test_three_key_combo_consumes_all_three_keys_for_chordal_hold) {
  resetState();
  comboTimeoutMs = 40;
  setUpThreeKeyKeymap();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177 255 2 3 0", false);
  assert(wasComboRecentlyActive(2, 3) == false);
  setMillis(1000);
  pressKey(2, 1);
  pressKey(2, 2);
  pressKey(2, 3);
  checkUserCombos();
  assert(comboRuntime[0].active);
  assert(wasComboRecentlyActive(2, 3));                      // die dritte Taste gehört zur aktiven Combo
  assert(keySentToHost[2][3]);
}

// -----------------------------------------------------------------------------
// One-Shot-Ebene (OSL_0 .. OSL_7)
// -----------------------------------------------------------------------------
static void tapOsl(int r, int c) {
  setMillis(1000);
  pressKey(r, c, true);
  setMillis(1050);
  pressKey(r, c, false);
}

TEST(test_osl_tap_arms_layer_for_one_key_press_then_releases) {
  resetState();
  KEYMAP[0][5][0] = ACT_OSL_BASE + 2;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[2][2][1] = 'x';
  tapOsl(5, 0);
  // Die Ebene ist vorgemerkt, die Taste selbst ist gelöst
  assert(oslArmed == (1 << 2) && oslHeld == 0 && !momentaryLayers[2] && getActiveLayer() == 2);
  // Der nächste Druck löst die Aktion der Ebene 2 aus und verbraucht die Vormerkung
  pressKey(2, 1, true);
  assert(pressedAction[2][1] == 'x');
  assert(oslArmed == 0 && getActiveLayer() == 0);
  pressKey(2, 1, false);
  // Der übernächste Druck läuft wieder auf Ebene 0
  pressKey(2, 1, true);
  assert(pressedAction[2][1] == 'a');
  pressKey(2, 1, false);
}

TEST(test_osl_expires_after_timeout_without_key) {
  resetState();
  oneShotTimeoutMs = 1500;
  KEYMAP[0][5][0] = ACT_OSL_BASE + 2;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[2][2][1] = 'x';
  tapOsl(5, 0);
  oslExpireLocal(1100); // stempelt die Vormerkung
  assert(oslArmed == (1 << 2));
  oslExpireLocal(2599);
  assert(oslArmed == (1 << 2)); // 1500 ms noch nicht erreicht
  oslExpireLocal(2600);
  assert(oslArmed == 0 && getActiveLayer() == 0);
  setMillis(2800);
  pressKey(2, 1, true);
  assert(pressedAction[2][1] == 'a');
  pressKey(2, 1, false);
}

TEST(test_osl_never_expires_when_timeout_is_zero) {
  resetState();
  KEYMAP[0][5][0] = ACT_OSL_BASE + 2;
  tapOsl(5, 0);
  oslExpireLocal(1100);
  oslExpireLocal(900000);
  assert(oslArmed == (1 << 2) && getActiveLayer() == 2);
}

TEST(test_osl_timeout_survives_millis_wrap) {
  resetState();
  oneShotTimeoutMs = 1500;
  KEYMAP[0][5][0] = ACT_OSL_BASE + 2;
  tapOsl(5, 0);
  oslExpireLocal(0xFFFFFF00UL);  // stempelt kurz vor dem Überlauf
  oslExpireLocal(0xFFFFFF00UL + 1000UL);
  assert(oslArmed == (1 << 2));
  oslExpireLocal((unsigned long)(0xFFFFFF00UL + 1600UL));  // nach dem Überlauf
  assert(oslArmed == 0);
}

TEST(test_osl_consumed_before_timeout_stays_consumed) {
  resetState();
  oneShotTimeoutMs = 1500;
  KEYMAP[0][5][0] = ACT_OSL_BASE + 2;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[2][2][1] = 'x';
  tapOsl(5, 0);
  oslExpireLocal(1100);
  pressKey(2, 1, true);
  assert(pressedAction[2][1] == 'x' && oslArmed == 0);
  pressKey(2, 1, false);
  oslExpireLocal(5000);
  assert(oslArmed == 0 && getActiveLayer() == 0);
}

TEST(test_osl_layer_holds_for_the_whole_key_press_even_after_consumption) {
  resetState();
  KEYMAP[0][5][0] = ACT_OSL_BASE + 3;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[3][2][1] = 'y';
  tapOsl(5, 0);
  pressKey(2, 1, true);
  // Loslassen nach dem Verbrauch löst genau die Aktion, die gedrückt wurde (Ebene 3), nicht die der Ebene 0
  pressKey(2, 1, false);
  assert(pressedAction[2][1] == 0 && getActiveLayer() == 0);
}

TEST(test_osl_second_tap_disarms_the_layer) {
  resetState();
  KEYMAP[0][5][0] = ACT_OSL_BASE + 2;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[2][2][1] = 'x';
  tapOsl(5, 0);
  assert(oslArmed == (1 << 2));
  tapOsl(5, 0);
  assert(oslArmed == 0 && getActiveLayer() == 0);
  pressKey(2, 1, true);
  assert(pressedAction[2][1] == 'a');
  pressKey(2, 1, false);
}

TEST(test_osl_hold_acts_like_mo_and_arms_nothing) {
  resetState();
  KEYMAP[0][5][0] = ACT_OSL_BASE + 2;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[2][2][1] = 'x';
  setMillis(1000);
  pressKey(5, 0, true);
  // Während des Haltens gilt die Ebene wie bei MO_2
  assert(getActiveLayer() == 2 && oslHeld == (1 << 2) && localMomentaryLayerMask() == (1 << 2));
  pressKey(2, 1, true);
  assert(pressedAction[2][1] == 'x');
  pressKey(2, 1, false);
  assert(getActiveLayer() == 2);   // weiter gehalten
  pressKey(5, 0, false);
  // Loslassen nach einer Taste dazwischen merkt nichts vor
  assert(oslArmed == 0 && getActiveLayer() == 0 && oslHeld == 0 && localMomentaryLayerMask() == 0);
}

TEST(test_osl_long_hold_without_other_key_arms_nothing) {
  resetState();
  KEYMAP[0][5][0] = ACT_OSL_BASE + 2;
  setMillis(1000);
  pressKey(5, 0, true);
  setMillis(1000 + tappingTermMs + 50);
  pressKey(5, 0, false);
  assert(oslArmed == 0 && getActiveLayer() == 0);
}

TEST(test_osl_armed_layer_is_used_by_a_key_of_the_other_half) {
  resetState();
  KEYMAP[0][5][0] = ACT_OSL_BASE + 2;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[2][2][1] = 'x';
  // Die andere Hälfte merkt Ebene 2 vor: diese Hälfte spiegelt sie und löst die Aktion der Ebene aus
  applyRemoteOslState(1 << 2, millis());
  assert(getActiveLayer() == 2);
  pressKey(2, 1, true);
  assert(pressedAction[2][1] == 'x');
  // Die Vormerkung der anderen Hälfte ist verbraucht und wird gemeldet (Bits 8..15 im Paket)
  assert(remoteOslArmed == 0 && oslUsedToSend == (1 << 2) && getActiveLayer() == 0);
  pressKey(2, 1, false);
  // Ein spätes Auffrischen der anderen Hälfte setzt die verbrauchte Ebene nicht wieder
  applyRemoteOslState(1 << 2, millis() + 10);
  assert(remoteOslArmed == 0 && getActiveLayer() == 0);
  // Nach der Bestätigung (Bit weg im Stand der anderen Hälfte) ist die Sperre aufgehoben
  applyRemoteOslState(0, millis() + 20);
  assert(oslUsedToSend == 0);
  applyRemoteOslState(1 << 2, millis() + 30);
  assert(getActiveLayer() == 2);
}

TEST(test_osl_local_armed_layer_is_consumed_by_the_other_half_report) {
  resetState();
  KEYMAP[0][5][0] = ACT_OSL_BASE + 2;
  tapOsl(5, 0);
  assert(oslArmed == (1 << 2));
  // Die andere Hälfte meldet, dass ihr Tastendruck die Ebene verbraucht hat: die Vormerkung ist weg
  applyRemoteOslUsed(1 << 2);
  assert(oslArmed == 0 && getActiveLayer() == 0);
}

TEST(test_osl_osl_key_press_does_not_consume_and_other_osl_stacks) {
  resetState();
  KEYMAP[0][5][0] = ACT_OSL_BASE + 2;
  KEYMAP[0][5][1] = ACT_OSL_BASE + 3;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[3][2][1] = 'z';
  tapOsl(5, 0);
  tapOsl(5, 1);
  // Beide Ebenen sind vorgemerkt, die höhere gewinnt
  assert(oslArmed == ((1 << 2) | (1 << 3)) && getActiveLayer() == 3);
  pressKey(2, 1, true);
  assert(pressedAction[2][1] == 'z' && oslArmed == 0);
  pressKey(2, 1, false);
}

TEST(test_osl_osl_0_forces_the_base_layer) {
  resetState();
  KEYMAP[0][5][0] = ACT_OSL_BASE + 0;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[2][2][1] = 'x';
  toggleLayers[2] = true;
  assert(getActiveLayer() == 2);
  tapOsl(5, 0);
  assert(getActiveLayer() == 0);
  pressKey(2, 1, true);
  assert(pressedAction[2][1] == 'a');
  pressKey(2, 1, false);
  assert(getActiveLayer() == 2);   // die Einrastung bleibt
}

TEST(test_osl_clear_after_link_timeout_and_release_all) {
  resetState();
  KEYMAP[0][5][0] = ACT_OSL_BASE + 2;
  // Vormerkung der anderen Hälfte verfällt ohne Paket
  applyRemoteOslState(1 << 2, 1000);
  assert(getActiveLayer() == 2);
  oslExpireRemote(1000 + OSL_REMOTE_TIMEOUT_MS - 1);
  assert(getActiveLayer() == 2);
  oslExpireRemote(1000 + OSL_REMOTE_TIMEOUT_MS);
  assert(remoteOslArmed == 0 && getActiveLayer() == 0);
  // Eigene Vormerkung und die gespiegelte fallen bei Link-Verlust, RELEASE_ALL und Host-Verlust (oslClearAll)
  tapOsl(5, 0);
  applyRemoteOslState(1 << 4, millis());
  assert(oslArmed == (1 << 2) && remoteOslArmed == (1 << 4));
  oslClearAll();
  assert(oslArmed == 0 && remoteOslArmed == 0 && getActiveLayer() == 0);
  // Die verlorene Vormerkung der anderen Hälfte wird als verbraucht gemeldet, damit sie dort auch fällt
  assert(oslUsedToSend == (1 << 4));
  // Ihr Auffrischen vor der Bestätigung setzt sie nicht wieder
  applyRemoteOslState(1 << 4, millis() + 5);
  assert(getActiveLayer() == 0);
}

TEST(test_osl_in_hold_and_double_tap_slot) {
  resetState();
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = ACT_OSL_BASE + 2;
  KEYMAP[2][2][2] = 'x';
  KEYMAP[0][2][2] = 'b';
  setMillis(1000);
  pressKey(2, 1, true);
  setMillis(1000 + tappingTermMs + 10);
  processDeferredKeys(millis());   // Halten: die Taste hält OSL_2 wie MO_2
  assert(getActiveLayer() == 2);
  pressKey(2, 1, false);
  assert(getActiveLayer() == 0 && oslArmed == 0);
}

TEST(test_osl_add_combo_rejects_osl_actions) {
  resetState();
  // Eine Combo-Aktion läuft nicht über dispatchPress: OSL bliebe dort wirkungslos, also lehnt ADD_COMBO sie ab
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 386", false);   // ACT_OSL_BASE + 2
  assert(mockChar.value == "ERR ARGS ADD_COMBO 2 1 2 2 0 386" && numCombos == 0);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 128", false);   // normale Aktion bleibt erlaubt
  assert(numCombos == 1);
}

TEST(test_osl_release_keeps_a_held_mo_on_the_same_layer) {
  resetState();
  KEYMAP[0][5][0] = ACT_OSL_BASE + 2;
  KEYMAP[0][5][1] = ACT_MO_2;
  setMillis(1000);
  pressKey(5, 1, true);
  pressKey(5, 0, true);
  setMillis(1400);
  pressKey(5, 0, false);
  // Die OSL-Taste war lange gehalten (kein Vormerken); MO_2 hält die Ebene weiter
  assert(oslArmed == 0 && momentaryLayers[2] && getActiveLayer() == 2);
  pressKey(5, 1, false);
  assert(getActiveLayer() == 0);
}

TEST(test_osl_uses_the_tapping_term_of_the_key) {
  resetState();
  KEYMAP[0][5][0] = ACT_OSL_BASE + 2;
  tappingTermMs = 200;
  TAPTERMMAP[0][5][0] = 400;   // eigener, längerer Term: ein Druck von 300 ms ist noch ein Tipp
  setMillis(1000);
  pressKey(5, 0, true);
  setMillis(1300);
  pressKey(5, 0, false);
  assert(oslArmed == (1 << 2));
  tapOsl(5, 0);                // zweites Tippen nimmt die Vormerkung zurück
  assert(oslArmed == 0);
  TAPTERMMAP[0][5][0] = 100;   // kürzerer Term: 150 ms sind schon Halten
  setMillis(2000);
  pressKey(5, 0, true);
  setMillis(2150);
  pressKey(5, 0, false);
  assert(oslArmed == 0);
  TAPTERMMAP[0][5][0] = 0;
}

TEST(test_osl_held_key_counts_as_layer_lock_mo_layer) {
  resetState();
  KEYMAP[0][5][0] = ACT_OSL_BASE + 3;
  setMillis(1000);
  pressKey(5, 0, true);
  dispatchPress(0, 0, ACT_LAYER_LOCK, getActiveLayer());
  assert(toggleLayers[3]);
  pressKey(5, 0, false);
}

TEST(test_osl_chord_with_a_key_of_the_other_half_arms_nothing) {
  resetState();
  KEYMAP[0][5][0] = ACT_OSL_BASE + 2;
  setMillis(1000);
  pressKey(5, 0, true);
  // Die andere Hälfte tippt innerhalb des Tapping-Terms und meldet die Ebene als benutzt
  applyRemoteOslUsed(1 << 2);
  setMillis(1060);
  pressKey(5, 0, false);
  assert(oslArmed == 0 && getActiveLayer() == 0);
}

TEST(test_osl_key_press_reports_layers_held_by_the_other_half_as_used) {
  resetState();
  KEYMAP[0][2][1] = 'a';
  applyRemoteLayerState(1 << 3, false, 0);   // die andere Hälfte hält Ebene 3 (MO oder OSL)
  pressKey(2, 1, true);
  assert(oslUsedToSend == (1 << 3));
  pressKey(2, 1, false);
}

TEST(test_osl_action_range_is_distinct_from_other_ranges) {
  assert(ACT_OSL_BASE == 0x180 && NUM_OSL_ACTIONS == 8);
  assert(isOslAction(0x180) && isOslAction(0x187) && !isOslAction(0x188) && !isOslAction(0x17F));
  assert(ACT_OSL_BASE > ACT_MACRO_BASE + MAX_MACROS - 1);
}

// Hold nur nach einer Tipp-Pause (requirePriorIdleMs): Mod-Tap kurz nach dem letzten Tastendruck ist sofort ein Tipp
TEST(test_prior_idle_press_within_window_resolves_tap) {
  resetState();
  requirePriorIdleMs = 150;
  KEYMAP[0][2][2] = 'b';
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  tapKeyAt(2, 2, 1000, 1040);                 // vorheriger Tastendruck
  setMillis(1100);                            // 100 ms nach dem Druck (< requirePriorIdleMs)
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1100);
  assert(countPresses('a') == 1);             // sofort Tipp, ohne Wartezeit
  setMillis(1500);                            // Halten über den Tapping-Term: keine Halte-Aktion
  processDeferredKeys(millis());
  assert(countPresses(KEY_LEFT_CTRL) == 0);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1500);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_prior_idle_window_boundary) {
  resetState();
  requirePriorIdleMs = 150;
  KEYMAP[0][2][2] = 'b';
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  tapKeyAt(2, 2, 1000, 1040);                 // Druck bei 1000
  setMillis(1149);                            // 149 ms: innerhalb
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1149);
  assert(countPresses('a') == 1);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1160);
  resetState();
  requirePriorIdleMs = 150;
  KEYMAP[0][2][2] = 'b';
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  tapKeyAt(2, 2, 1000, 1040);
  setMillis(1150);                            // genau requirePriorIdleMs: nicht mehr innerhalb
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1150);
  assert(countPresses('a') == 0);             // unentschieden
  setMillis(1400);
  processDeferredKeys(millis());
  assert(countPresses(KEY_LEFT_CTRL) == 1);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1450);
}

TEST(test_prior_idle_longer_pause_gives_normal_hold) {
  resetState();
  requirePriorIdleMs = 150;
  KEYMAP[0][2][2] = 'b';
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  tapKeyAt(2, 2, 1000, 1040);
  setMillis(1500);                            // 500 ms Pause
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1500);
  assert(countPresses('a') == 0);             // noch unentschieden
  setMillis(1750);
  processDeferredKeys(millis());
  assert(countPresses(KEY_LEFT_CTRL) == 1);   // normaler Hold nach dem Tapping-Term
  assert(countPresses('a') == 0);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1800);
}

TEST(test_prior_idle_key_of_other_half_counts) {
  resetState();
  requirePriorIdleMs = 150;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  notePriorKeyPress(1050);                    // Druck der anderen Hälfte (Split-Ereignis)
  setMillis(1100);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1100);
  assert(countPresses('a') == 1);             // Tipp sofort
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1120);
  // Ohne die Meldung der anderen Hälfte bleibt die Taste unentschieden
  resetState();
  requirePriorIdleMs = 150;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  setMillis(1100);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1100);
  assert(countPresses('a') == 0);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1120);
}

TEST(test_prior_idle_zero_keeps_old_behavior) {
  resetState();
  requirePriorIdleMs = 0;
  KEYMAP[0][2][2] = 'b';
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  tapKeyAt(2, 2, 1000, 1040);
  setMillis(1050);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1050);
  assert(countPresses('a') == 0);             // unentschieden wie zuvor
  setMillis(1300);
  processDeferredKeys(millis());
  assert(countPresses(KEY_LEFT_CTRL) == 1);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1350);
}

TEST(test_prior_idle_layer_tap_and_double_tap_are_exempt) {
  resetState();
  requirePriorIdleMs = 150;
  KEYMAP[0][2][2] = 'b';
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = ACT_MO_BASE + 1;         // Layer-Tap: behält die Entscheidung
  tapKeyAt(2, 2, 1000, 1040);
  setMillis(1100);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1100);
  assert(countPresses('a') == 0);             // unentschieden
  setMillis(1350);
  processDeferredKeys(millis());
  assert(getActiveLayer() == 1);              // Hold
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1400);
  // Taste mit Doppel-Tipp-Aktion
  resetState();
  requirePriorIdleMs = 150;
  KEYMAP[0][2][2] = 'b';
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  DTAPMAP[0][2][1] = 'd';
  tapKeyAt(2, 2, 1000, 1040);
  setMillis(1100);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1100);
  assert(tapHold[2][1].pending);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1120);
}

TEST(test_prior_idle_later_press_and_wrap_do_not_count) {
  resetState();
  requirePriorIdleMs = 150;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  // Ein Druck, der nach der Scan-Zeit der Taste vermerkt wurde (zurückgehaltene Taste läuft später), zählt nicht
  notePriorKeyPress(1100);
  assert(!priorKeyRecent(1050));
  assert(priorKeyRecent(1100) && priorKeyRecent(1249) && !priorKeyRecent(1250));
  // Ein älterer Zeitpunkt überschreibt einen neueren nicht
  notePriorKeyPress(1000);
  assert(priorKeyRecent(1249));
  // Nach über 24 Tagen ohne Druck wird die 32-Bit-Differenz negativ: kein "kurz davor"
  resetTapHold();
  notePriorKeyPress(1000);
  assert(!priorKeyRecent(1000UL + 0x80000000UL + 5UL));
  // Zeitumbruch von millis(): der Abstand bleibt richtig
  resetTapHold();
  notePriorKeyPress(0xFFFFFFF0UL);
  assert(priorKeyRecent(0x10UL) && !priorKeyRecent(0xFFFFFFF0UL + 150UL));
  // Zurückgehaltene Taste: Scan-Zeit 1050, der Druck der anderen Hälfte kam später (1100): die Taste bleibt unentschieden
  resetState();
  requirePriorIdleMs = 150;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  notePriorKeyPress(1100);
  setMillis(1120);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1050);
  assert(countPresses('a') == 0);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1130);
}

TEST(test_prior_idle_reset_clears_last_press) {
  resetState();
  requirePriorIdleMs = 150;
  notePriorKeyPress(1000);
  resetTapHold();
  assert(!priorKeyValid && !priorKeyRecent(1010));
}

TEST(test_prior_idle_command_nvs_and_info) {
  resetState();
  handleConfigCommand("SET_PRIOR_IDLE 501", false);
  assert(mockChar.value == "ERR ARGS SET_PRIOR_IDLE 501");
  handleConfigCommand("SET_PRIOR_IDLE -1", false);
  assert(mockChar.value == "ERR ARGS SET_PRIOR_IDLE -1");
  handleConfigCommand("SET_PRIOR_IDLE abc", false);
  assert(mockChar.value == "ERR ARGS SET_PRIOR_IDLE abc");
  assert(requirePriorIdleMs == 0);
  handleConfigCommand("SET_PRIOR_IDLE 500", false);
  assert(mockChar.value == "OK SET_PRIOR_IDLE 500");
  handleConfigCommand("SET_PRIOR_IDLE 120", false);
  assert(mockChar.value == "OK SET_PRIOR_IDLE 120");
  assert(requirePriorIdleMs == 120);
  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.find("\"pi\":120") != std::string::npos);
  requirePriorIdleMs = 0;
  loadKeymapFromNVS();
  assert(requirePriorIdleMs == 120);
  Preferences::uintStore["prior_idle"] = 900;  // außerhalb des Bereichs
  requirePriorIdleMs = 0;
  loadKeymapFromNVS();
  assert(requirePriorIdleMs == 0);
  handleConfigCommand("SET_PRIOR_IDLE 0", false);
  assert(mockChar.value == "OK SET_PRIOR_IDLE 0");
}

// -----------------------------------------------------------------------------
// Alternate repeat (ACT_ALT_REPEAT): das Gegenteil der letzten Aktion
// -----------------------------------------------------------------------------
struct DefaultAltPair { uint16_t a, b; };
static const DefaultAltPair ALT_REPEAT_TABLE[] = {
  {KEY_LEFT_ARROW, KEY_RIGHT_ARROW}, {KEY_UP_ARROW, KEY_DOWN_ARROW}, {KEY_PAGE_UP, KEY_PAGE_DOWN},
  {KEY_HOME, KEY_END}, {KEY_BACKSPACE, KEY_DELETE}, {0x133, 0x134}, {0x122, 0x123}, {0x124, 0x125},
};

// Wie oft hat die Aktion den Host erreicht (Taste, Medientaste oder Scrollschritt)?
static size_t altRepeatOutputs(uint16_t a) {
  size_t n = 0;
  if (a == 0x133 || a == 0x134) {
    for (int8_t s : bleKeyboard.mouseScrolls) if (s == (a == 0x133 ? 1 : -1)) n++;
  } else if (a >= 0x120 && a <= 0x127) {
    static const MediaKeyReport *const MEDIA[] = {&KEY_MEDIA_PLAY_PAUSE, &KEY_MEDIA_MUTE, &KEY_MEDIA_VOLUME_UP,
      &KEY_MEDIA_VOLUME_DOWN, &KEY_MEDIA_NEXT_TRACK, &KEY_MEDIA_PREVIOUS_TRACK};
    uint16_t bits = mediaBits(*MEDIA[a - 0x120]);
    for (uint16_t m : bleKeyboard.writtenMediaKeys) if (m == bits) n++;
  } else {
    n = countPresses((uint8_t)a);
  }
  return n;
}

TEST(test_alt_repeat_action_table_is_symmetric) {
  for (const auto &p : ALT_REPEAT_TABLE) {
    assert(altRepeatAction(p.a) == p.b);
    assert(altRepeatAction(p.b) == p.a);
  }
  for (uint16_t none : std::initializer_list<uint16_t>{0, 'a', KEY_RETURN, 0x120, 0x121, 0x130, ACT_REPEAT, ACT_ALT_REPEAT, 0x100}) {
    assert(altRepeatAction(none) == 0);
  }
  assert(ACT_ALT_REPEAT == 0x16B && isRepeatKeyAction(ACT_ALT_REPEAT) && isRepeatKeyAction(ACT_REPEAT));
}

TEST(test_alt_repeat_sends_the_opposite_for_each_pair_in_both_directions) {
  for (const auto &p : ALT_REPEAT_TABLE) {
    for (int dir = 0; dir < 2; dir++) {
      uint16_t first = dir ? p.b : p.a;
      uint16_t opposite = dir ? p.a : p.b;
      resetState();
      KEYMAP[0][2][1] = first;
      KEYMAP[0][2][2] = ACT_ALT_REPEAT;
      tapKeyAt(2, 1, 1000, 1020);
      assert(altRepeatOutputs(opposite) == 0);
      tapKeyAt(2, 2, 1100, 1120);
      assert(altRepeatOutputs(opposite) == 1);
      assert(altRepeatOutputs(first) == 1);                      // die erste Aktion wurde nicht wiederholt
      assert(lastRepeatAction == first);                          // ALT_REPEAT zeichnet nichts auf
      assert(bleKeyboard.pressedKeys.empty());
    }
  }
}

TEST(test_alt_repeat_without_opposite_or_without_action_sends_nothing) {
  resetState();
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][2] = ACT_ALT_REPEAT;
  tapKeyAt(2, 2, 900, 920);                                       // noch keine Aktion
  assert(bleKeyboard.keyEvents.empty());
  tapKeyAt(2, 1, 1000, 1020);
  bleKeyboard.keyEvents.clear();
  tapKeyAt(2, 2, 1100, 1120);                                     // 'a' hat kein Gegenteil
  assert(bleKeyboard.keyEvents.empty() && bleKeyboard.pressedKeys.empty());
  assert(bleKeyboard.writtenMediaKeys.empty() && bleKeyboard.mouseScrolls.empty());
}

TEST(test_alt_repeat_twice_goes_back_and_forth_from_the_last_real_action) {
  resetState();
  KEYMAP[0][2][1] = KEY_LEFT_ARROW;
  KEYMAP[0][2][2] = ACT_ALT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  tapKeyAt(2, 2, 1100, 1120);
  tapKeyAt(2, 2, 1200, 1220);
  assert(countPresses(KEY_LEFT_ARROW) == 1);
  assert(countPresses(KEY_RIGHT_ARROW) == 2);                     // beide Male das Gegenteil der echten Aktion
}

TEST(test_custom_alt_repeat_pair_sends_the_alt_key) {
  resetState();
  handleConfigCommand("ADD_ALT_REPEAT 101 117", false);           // e -> u
  assert(mockChar.value == "OK ADD_ALT_REPEAT 0" && numAltRepeats == 1);
  KEYMAP[0][2][1] = 'e';
  KEYMAP[0][2][2] = ACT_ALT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  bleKeyboard.keyEvents.clear();
  pressKey(2, 2);
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == 'u');
  releaseKey(2, 2);
  assert(bleKeyboard.pressedKeys.empty());
  assert(lastRepeatAction == 'e');                                // ALT_REPEAT zeichnet nichts auf
}

TEST(test_custom_alt_repeat_pair_is_directed) {
  resetState();
  handleConfigCommand("ADD_ALT_REPEAT 101 117", false);
  assert(altRepeatResolve('e') == 'u' && altRepeatResolve('u') == 0);
}

TEST(test_custom_alt_repeat_is_checked_before_the_default_table) {
  resetState();
  assert(altRepeatResolve(KEY_LEFT_ARROW) == KEY_RIGHT_ARROW);
  handleConfigCommand("ADD_ALT_REPEAT 216 10", false);            // Left Arrow (0xD8) -> Zeilenumbruch
  assert(altRepeatResolve(KEY_LEFT_ARROW) == 10);
  assert(altRepeatResolve(KEY_RIGHT_ARROW) == KEY_LEFT_ARROW);    // die feste Tabelle gilt weiter für den Rest
  assert(altRepeatResolve(KEY_UP_ARROW) == KEY_DOWN_ARROW);
  handleConfigCommand("CLEAR_ALT_REPEATS", false);
  assert(altRepeatResolve(KEY_LEFT_ARROW) == KEY_RIGHT_ARROW);
}

TEST(test_alt_repeat_commands_validate_and_clear) {
  resetState();
  handleConfigCommand("ADD_ALT_REPEAT 0 5", false);
  assert(mockChar.value == "ERR ARGS ADD_ALT_REPEAT 0 5");
  handleConfigCommand("ADD_ALT_REPEAT 5 256", false);
  assert(mockChar.value == "ERR ARGS ADD_ALT_REPEAT 5 256");
  handleConfigCommand("ADD_ALT_REPEAT 7 7", false);
  assert(mockChar.value == "ERR ARGS ADD_ALT_REPEAT 7 7" && numAltRepeats == 0);
  handleConfigCommand("ADD_ALT_REPEAT 5 6 7", false);
  assert(mockChar.value == "ERR ARGS ADD_ALT_REPEAT 5 6 7");
  handleConfigCommand("ADD_ALT_REPEAT 5", false);
  assert(mockChar.value == "ERR ARGS ADD_ALT_REPEAT 5");
  handleConfigCommand("ADD_ALT_REPEAT 101 117", false);
  handleConfigCommand("ADD_ALT_REPEAT 101 118", false);          // derselbe Auslöser
  assert(mockChar.value == "ERR ARGS ADD_ALT_REPEAT 101 118" && numAltRepeats == 1);
  handleConfigCommand("CLEAR_ALT_REPEATS", false);
  assert(mockChar.value == "OK CLEAR_ALT_REPEATS" && numAltRepeats == 0);
  for (int i = 0; i < MAX_ALT_REPEATS; i++) handleConfigCommand((std::string("ADD_ALT_REPEAT ") + std::to_string(33 + i) + " 65").c_str(), false);
  assert(numAltRepeats == MAX_ALT_REPEATS);
  handleConfigCommand("ADD_ALT_REPEAT 120 65", false);
  assert(mockChar.value == "ERR ARGS ADD_ALT_REPEAT 120 65" && numAltRepeats == MAX_ALT_REPEATS);
}

TEST(test_alt_repeats_persist_in_nvs) {
  resetState();
  handleConfigCommand("ADD_ALT_REPEAT 101 117", false);
  handleConfigCommand("ADD_ALT_REPEAT 105 111", false);
  handleConfigCommand("SAVE_ALT_REPEATS", false);
  assert(mockChar.value == "OK SAVE_ALT_REPEATS");
  numAltRepeats = 0;
  userAltRepeats[0] = { 0, 0 };
  userAltRepeats[1] = { 0, 0 };
  loadKeymapFromNVS();
  assert(numAltRepeats == 2);
  assert(userAltRepeats[0].key == 101 && userAltRepeats[0].alt == 117 && userAltRepeats[1].key == 105 && userAltRepeats[1].alt == 111);
  // Leere Liste gespeichert: die einkompilierte Liste gilt beim nächsten Start nicht mehr
  handleConfigCommand("CLEAR_ALT_REPEATS", false);
  handleConfigCommand("SAVE_ALT_REPEATS", false);
  numAltRepeats = 1;
  userAltRepeats[0] = { 120, 121 };
  loadKeymapFromNVS();
  assert(numAltRepeats == 0);
  // Anzahl und Daten passen nicht: die einkompilierte Liste bleibt
  preferences.putUChar("num_altrep", 3);
  preferences.putBytes("altrep_data", userAltRepeats, sizeof(AltRepeatPair));
  numAltRepeats = 1;
  userAltRepeats[0] = { 120, 121 };
  loadKeymapFromNVS();
  assert(numAltRepeats == 1 && userAltRepeats[0].key == 120);
}

TEST(test_app_flash_discards_stored_alt_repeats) {
  resetState();
  handleConfigCommand("ADD_ALT_REPEAT 101 117", false);
  handleConfigCommand("SAVE_ALT_REPEATS", false);
  loadKeymapFromNVS();
  assert(preferences.isKey("num_altrep") && preferences.isKey("altrep_data"));
  testDefaultsId = 0xBEEF;
  numAltRepeats = 1;
  userAltRepeats[0] = { 98, 99 };
  loadKeymapFromNVS();
  assert(numAltRepeats == 1 && userAltRepeats[0].key == 98 && userAltRepeats[0].alt == 99);
  assert(!preferences.isKey("num_altrep") && !preferences.isKey("altrep_data"));
}

TEST(test_alt_repeats_get_config_sends_the_list) {
  resetState();
  loadKeymapFromNVS();
  handleConfigCommand("CLEAR_ALT_REPEATS", false);
  handleConfigCommand("ADD_ALT_REPEAT 101 117", false);
  handleConfigCommand("ADD_ALT_REPEAT 105 111", false);
  mockChar.notifications.clear();
  handleConfigCommand("GET_CONFIG", false);
  bool count = false, data = false;
  for (const auto &n : mockChar.notifications) {
    if (n == "ALTREP_COUNT:2") count = true;
    if (n == "ALTREP_DATA:{\"o\":0,\"e\":[[101,117],[105,111]]}") data = true;
  }
  assert(count && data);
}

TEST(test_alt_repeat_keeps_held_modifiers_applied) {
  resetState();
  KEYMAP[0][2][1] = KEY_LEFT_ARROW;
  KEYMAP[0][2][2] = KEY_LEFT_GUI;
  KEYMAP[0][2][3] = ACT_ALT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  pressKey(2, 2);                                                 // Cmd halten
  setMillis(1100);
  pressKey(2, 3);
  assert(bleKeyboard.pressedKeys.size() == 2);                    // Cmd + Rechts gleichzeitig
  assert(std::find(bleKeyboard.pressedKeys.begin(), bleKeyboard.pressedKeys.end(), KEY_LEFT_GUI) != bleKeyboard.pressedKeys.end());
  assert(std::find(bleKeyboard.pressedKeys.begin(), bleKeyboard.pressedKeys.end(), KEY_RIGHT_ARROW) != bleKeyboard.pressedKeys.end());
  releaseKey(2, 3);
  releaseKey(2, 2);
  assert(bleKeyboard.pressedKeys.empty());
  assert(lastRepeatAction == KEY_LEFT_ARROW);                     // das gehaltene Cmd änderte die letzte Aktion nicht
}

TEST(test_alt_repeat_key_hands_over_to_the_other_half_with_the_alt_flag) {
  resetState();
  KEYMAP[0][2][2] = ACT_ALT_REPEAT;
  KEYMAP[0][2][3] = ACT_REPEAT;
  testRemoteTakesRepeat = true;
  testRemoteCalls.clear();
  tapKeyAt(2, 2, 1000, 1020);
  tapKeyAt(2, 3, 1100, 1120);
  assert((testRemoteCalls == std::vector<std::string>{"alt22", "release22", "press23", "release23"}));
  assert(bleKeyboard.keyEvents.empty());                          // die andere Hälfte führt aus, lokal geschieht nichts
  testRemoteTakesRepeat = false;
}

TEST(test_alt_repeat_runs_locally_when_the_other_half_does_not_take_it) {
  resetState();
  KEYMAP[0][2][1] = KEY_LEFT_ARROW;
  KEYMAP[0][2][2] = ACT_ALT_REPEAT;
  testRemoteTakesRepeat = false;
  testRemoteCalls.clear();
  tapKeyAt(2, 1, 1000, 1020);
  tapKeyAt(2, 2, 1100, 1120);
  assert(testRemoteCalls.empty());                                // der Hook lehnte ab und merkte sich nichts
  assert(countPresses(KEY_RIGHT_ARROW) == 1);
}

TEST(test_alt_repeat_as_combo_action_sends_the_opposite) {
  resetState();
  KEYMAP[0][2][0] = 'a';
  KEYMAP[0][2][1] = 'b';
  KEYMAP[0][2][2] = KEY_UP_ARROW;
  tapKeyAt(2, 2, 1000, 1020);
  handleConfigCommand("ADD_COMBO 2 0 2 1 0 363", false);          // KEY_PRESS ALT_REPEAT
  assert(numCombos == 1);
  setMillis(2000);
  pressKey(2, 0);
  pressKey(2, 1);
  checkUserCombos();
  assert(countPresses(KEY_DOWN_ARROW) == 1);                      // das Gegenteil der letzten Aktion
  assert(countPresses('a') == 0 && countPresses('b') == 0);
  assert(lastRepeatAction == KEY_UP_ARROW);
  releaseKey(2, 0);
  releaseKey(2, 1);
}

TEST(test_alt_repeat_as_hold_action_sends_the_opposite_while_held) {
  resetState();
  KEYMAP[0][2][1] = KEY_PAGE_UP;
  KEYMAP[0][2][2] = 'x';
  HOLDMAP[0][2][2] = ACT_ALT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  setMillis(3000);
  pressKey(2, 2);
  runTicks(3000 + TAPPING_TERM_MS + 10);                          // Halten gilt
  assert(countPresses(KEY_PAGE_DOWN) == 1);
  assert(countPresses('x') == 0);
  releaseKey(2, 2);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_alt_repeat_as_double_tap_action_sends_the_opposite) {
  resetState();
  KEYMAP[0][2][1] = KEY_HOME;
  KEYMAP[0][2][2] = 'x';
  DTAPMAP[0][2][2] = ACT_ALT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  setMillis(2000);
  pressKey(2, 2);
  releaseKey(2, 2);
  setMillis(2050);
  pressKey(2, 2);                                                 // zweiter Tipp
  assert(countPresses(KEY_END) == 1);
  releaseKey(2, 2);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_clear_pairs_during_held_alt_repeat_keeps_the_key_state_clean) {
  resetState();
  KEYMAP[0][2][1] = KEY_DELETE;
  KEYMAP[0][2][2] = ACT_ALT_REPEAT;
  tapKeyAt(2, 1, 1000, 1020);
  pressKey(2, 2);
  assert(bleKeyboard.pressedKeys.size() == 1);                    // Backspace gehalten
  handleConfigCommand("CLEAR_PAIRS", false);
  releaseKey(2, 2);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_alt_repeat_is_no_combo_hold_action) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 0 2 1 1 363", false);          // MODIFIER_HOLD mit ALT_REPEAT
  assert(numCombos == 0);
  handleConfigCommand("ADD_COMBO 2 0 2 1 0 363", false);          // KEY_PRESS ist erlaubt
  assert(numCombos == 1);
}


// -----------------------------------------------------------------------------
// Dynamisches Makro (DM_REC, DM_PLAY): Aufnahme im RAM des Masters
// -----------------------------------------------------------------------------
static void dmTap(uint8_t r, uint8_t c) { pressKey(r, c); releaseKey(r, c); }
static int dmSerialCount(const char *line) {
  int n = 0;
  for (const auto &l : Serial.outputLines) if (l == line) n++;
  return n;
}
static void dmMapKeys() {
  KEYMAP[0][0][0] = ACT_DM_REC;
  KEYMAP[0][0][1] = ACT_DM_PLAY;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][2] = 'b';
}

TEST(test_dynamic_macro_records_and_plays_back) {
  resetState();
  dmMapKeys();
  setMillis(1000);
  dmTap(0, 0);                                    // DM_REC: Aufnahme an
  assert(bleKeyboard.dynMacro.recording);
  dmTap(2, 1);
  dmTap(2, 2);
  dmTap(0, 0);                                    // DM_REC: Aufnahme aus
  assert(!bleKeyboard.dynMacro.recording);
  const DynamicMacro &dm = bleKeyboard.dynMacro;
  assert(dm.length == 4);
  assert(dm.steps[0].type == MACRO_STEP_DOWN && dm.steps[0].code == 'a');
  assert(dm.steps[1].type == MACRO_STEP_UP && dm.steps[1].code == 'a');
  assert(dm.steps[2].type == MACRO_STEP_DOWN && dm.steps[2].code == 'b');
  assert(dm.steps[3].type == MACRO_STEP_UP && dm.steps[3].code == 'b');

  bleKeyboard.keyEvents.clear();
  setMillis(2000);
  dmTap(0, 1);                                    // DM_PLAY
  runTicks(2200);
  std::vector<int> expected = { 'a', -'a', 'b', -'b' };
  assert(bleKeyboard.keyEvents == expected);
  assert(!macroRun.active && bleKeyboard.pressedKeys.empty());
  assert(dm.length == 4);                         // das Abspielen verändert den Slot nicht

  // Eine zweite Wiedergabe liefert dieselbe Folge
  bleKeyboard.keyEvents.clear();
  setMillis(3000);
  dmTap(0, 1);
  runTicks(3200);
  assert(bleKeyboard.keyEvents == expected);
}

TEST(test_dynamic_macro_reports_recording_state_on_serial) {
  resetState();
  dmMapKeys();
  setMillis(1000);
  dynamicMacroService();
  assert(dmSerialCount("DM_REC:0") == 0 && dmSerialCount("DM_REC:1") == 0);   // Ruhestand: keine Zeile beim Start
  dmTap(0, 0);
  dynamicMacroService();
  dynamicMacroService();
  assert(dmSerialCount("DM_REC:1") == 1);          // eine Zeile je Änderung, keine Wiederholung
  dmTap(0, 0);
  dynamicMacroService();
  assert(dmSerialCount("DM_REC:0") == 1);
  // Nie über BLE: keine Benachrichtigung enthält die Zeile
  for (const auto &n : mockChar.notifications) assert(n.find("DM_REC:") == std::string::npos);
}

TEST(test_dynamic_macro_stops_at_step_limit) {
  resetState();
  dmMapKeys();
  setMillis(1000);
  dmTap(0, 0);
  dynamicMacroService();
  assert(dmSerialCount("DM_REC:1") == 1);
  for (int i = 0; i < 20; i++) dmTap(2, 1);       // 40 Schritte, nur 32 passen
  const DynamicMacro &dm = bleKeyboard.dynMacro;
  assert(dm.length == MAX_MACRO_STEPS);
  assert(!dm.recording);                          // am Limit endet die Aufnahme
  dynamicMacroService();
  assert(dmSerialCount("DM_REC:0") == 1);         // die App sieht das Ende am Limit
  dmTap(2, 1);
  assert(dm.length == MAX_MACRO_STEPS);

  // Der volle Slot lässt sich abspielen
  bleKeyboard.keyEvents.clear();
  setMillis(2000);
  dmTap(0, 1);
  runTicks(4000);
  assert(bleKeyboard.keyEvents.size() == MAX_MACRO_STEPS);
}

TEST(test_dynamic_macro_does_not_record_its_own_keys) {
  resetState();
  dmMapKeys();
  setMillis(1000);
  dmTap(0, 0);
  dmTap(0, 1);                                    // DM_PLAY während der Aufnahme beendet sie, ohne abzuspielen
  assert(!bleKeyboard.dynMacro.recording);
  assert(bleKeyboard.dynMacro.length == 0);
  assert(!macroRun.active);
  assert(bleKeyboard.keyEvents.empty());

  // Aufnahme mit Tasten dazwischen: weder DM_REC noch DM_PLAY landen im Slot
  dmTap(0, 0);
  dmTap(2, 1);
  dmTap(0, 0);
  const DynamicMacro &dm = bleKeyboard.dynMacro;
  assert(dm.length == 2);
  for (int i = 0; i < dm.length; i++) assert(dm.steps[i].code == 'a');

  // Eine neue Aufnahme ersetzt den Slot
  dmTap(0, 0);
  dmTap(2, 2);
  dmTap(0, 0);
  assert(dm.length == 2 && dm.steps[0].code == 'b');

  // DM_PLAY mit leerem Slot sendet nichts
  resetState();
  dmMapKeys();
  setMillis(1000);
  dmTap(0, 1);
  runTicks(1100);
  assert(bleKeyboard.keyEvents.empty());
}

TEST(test_dynamic_macro_slot_is_ram_only_and_cleared) {
  resetState();
  dmMapKeys();
  setMillis(1000);
  dmTap(0, 0);
  dmTap(2, 1);
  dmTap(0, 0);
  assert(bleKeyboard.dynMacro.length == 2);
  // Nicht in GET_CONFIG, nicht im NVS
  mockChar.notifications.clear();
  handleConfigCommand("GET_CONFIG", false);
  for (const auto &n : mockChar.notifications) assert(n.find("DM_") == std::string::npos && n.find("MACRO_DATA:{\"i\":0") == std::string::npos);
  assert(Preferences::bytesStore.find("macros") == Preferences::bytesStore.end() || Preferences::bytesStore["macros"].empty());
  // Config Mode und Neustart (neuer Zustand) leeren den Slot
  dynamicMacroReset();
  assert(bleKeyboard.dynMacro.length == 0 && !bleKeyboard.dynMacro.recording);
  DynamicMacro fresh;                             // Zustand nach einem Neustart
  assert(fresh.length == 0 && !fresh.recording);

  // Aufnahme läuft, dann Reset: die Aufnahme endet ohne Rest
  dmTap(0, 0);
  dmTap(2, 1);
  dynamicMacroReset();
  assert(!bleKeyboard.dynMacro.recording && bleKeyboard.dynMacro.length == 0);
  dmTap(2, 1);
  assert(bleKeyboard.dynMacro.length == 0);
}

TEST(test_dynamic_macro_needs_host_and_ignores_config_mode) {
  resetState();
  dmMapKeys();
  setMillis(1000);
  bleKeyboard.connected = false;
  dmTap(0, 0);                                    // ohne Mac geschieht nichts
  assert(!bleKeyboard.dynMacro.recording);
  bleKeyboard.connected = true;
  isConfigMode = true;
  dmTap(0, 0);
  assert(!bleKeyboard.dynMacro.recording);
  isConfigMode = false;
}

TEST(test_dynamic_macro_keys_as_hold_and_double_tap_action) {
  resetState();
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = ACT_DM_REC;
  setMillis(1000);
  pressKey(2, 1);
  setMillis(1300);                                // Tapping-Term überschritten: Hold löst DM_REC aus
  processDeferredKeys(1300);
  assert(bleKeyboard.dynMacro.recording);
  releaseKey(2, 1);
  assert(bleKeyboard.dynMacro.recording);         // Loslassen beendet nichts
}

TEST(test_dynamic_macro_is_no_combo_action) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 0 2 1 0 364", false);   // ACT_DM_REC
  assert(numCombos == 0);
  handleConfigCommand("ADD_COMBO 2 0 2 1 0 365", false);   // ACT_DM_PLAY
  assert(numCombos == 0);
}

TEST(test_dynamic_macro_release_all_closes_open_keys) {
  resetState();
  setMillis(1000);
  bleKeyboard.dynMacro.startRecording();
  bleKeyboard.press((uint8_t)'a');
  bleKeyboard.releaseAll();                       // z. B. Combo: alle Tasten gelöst
  const DynamicMacro &dm = bleKeyboard.dynMacro;
  assert(dm.length == 2 && dm.steps[1].type == MACRO_STEP_UP && dm.steps[1].code == 'a');
  bleKeyboard.press((uint8_t)'a');                // derselbe Code ist wieder aufnehmbar
  assert(dm.length == 3);
}


TEST(test_dynamic_macro_stop_keeps_key_held_across_it_open) {
  resetState();
  dmMapKeys();
  setMillis(1000);
  dmTap(0, 0);
  pressKey(2, 1);                                 // 'a' gedrückt, DOWN aufgenommen
  dmTap(0, 0);                                    // Aufnahme endet bei gehaltener Taste
  releaseKey(2, 1);                               // dieses Loslassen gehört nicht mehr in den Slot
  const DynamicMacro &dm = bleKeyboard.dynMacro;
  assert(dm.length == 1 && dm.steps[0].type == MACRO_STEP_DOWN && dm.steps[0].code == 'a');
  assert(dmSerialCount("DM_REC:1") == 0);          // keine der DM-Tasten erscheint im Slot
  for (int i = 0; i < dm.length; i++) assert(dm.steps[i].code != 0 && dm.steps[i].code < 0xB0);
  // Das Abspielen lässt das offene DOWN am Ende los
  bleKeyboard.keyEvents.clear();
  setMillis(2000);
  dmTap(0, 1);
  runTicks(2200);
  std::vector<int> expected = { 'a', -'a' };
  assert(bleKeyboard.keyEvents == expected);
}

TEST(test_dynamic_macro_as_double_tap_action) {
  resetState();
  KEYMAP[0][2][4] = 'l';
  DTAPMAP[0][2][4] = ACT_DM_REC;
  tapKeyAt(2, 4, 1000, 1050);
  setMillis(1100);
  keyState[2][4] = true; onMatrixKeyChange(2, 4, true);
  keyState[2][4] = false; onMatrixKeyChange(2, 4, false);
  runTicks(1600);
  assert(bleKeyboard.dynMacro.recording);          // Doppel-Tipp startet die Aufnahme
  assert(bleKeyboard.keyEvents.empty());           // kein Tap 'l'
}

TEST(test_dynamic_macro_key_as_buffered_combo_candidate) {
  resetState();
  KEYMAP[0][2][1] = ACT_DM_REC;
  KEYMAP[0][2][2] = 'k';
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  assert(!bleKeyboard.dynMacro.recording);         // gepuffert
  runTicks(1000 + comboTimeoutMs);
  assert(bleKeyboard.dynMacro.recording);          // Combo-Fenster abgelaufen: Aktion läuft
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  runTicks(1200);
  assert(bleKeyboard.dynMacro.recording);          // das Loslassen schaltet nicht erneut um

  // Schnelles Loslassen vor dem Ablauf des Fensters führt die Aktion einmal aus
  resetState();
  KEYMAP[0][2][1] = ACT_DM_REC;
  KEYMAP[0][2][2] = 'k';
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  setMillis(1010);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.dynMacro.recording);
}

TEST(test_dynamic_macro_does_not_start_while_a_macro_runs) {
  resetState();
  dmMapKeys();
  KEYMAP[0][2][3] = ACT_MACRO_BASE + 0;
  handleConfigCommand("ADD_MACRO", false);
  handleConfigCommand("ADD_MACRO_STEP 1 120 0", false);   // TAP 'x'
  handleConfigCommand("ADD_MACRO_STEP 4 0 500", false);
  handleConfigCommand("ADD_MACRO_STEP 1 121 0", false);   // TAP 'y'
  setMillis(1000);
  dmTap(2, 3);                                    // Benutzer-Makro läuft (Pause)
  assert(macroRun.active);
  dmTap(0, 0);                                    // DM_REC darf nicht aufnehmen
  assert(!bleKeyboard.dynMacro.recording);
  runTicks(1700);
  assert(bleKeyboard.dynMacro.length == 0);       // die Tasten des Makros stehen nicht im Slot
  dmTap(0, 1);                                    // DM_PLAY mit leerem Slot
  assert(!macroRun.active && bleKeyboard.keyEvents.size() == 4);
}

TEST(test_dynamic_macro_playback_stops_in_config_mode_and_ends_recording_without_host) {
  resetState();
  dmMapKeys();
  setMillis(1000);
  dmTap(0, 0);
  dmTap(2, 1);
  dmTap(2, 2);
  dmTap(0, 0);
  assert(bleKeyboard.dynMacro.length == 4);
  bleKeyboard.keyEvents.clear();
  setMillis(2000);
  dmTap(0, 1);
  assert(macroRun.active && macroRun.index == DM_SLOT_INDEX);
  // Config Mode während des Abspielens: wie enterConfigMode() endet das Makro und der Slot ist leer
  stopMacro(false);
  dynamicMacroReset();
  assert(!macroRun.active && bleKeyboard.dynMacro.length == 0);
  size_t n = bleKeyboard.keyEvents.size();
  runTicks(2300);
  assert(bleKeyboard.keyEvents.size() == n);       // kein Schritt läuft nach

  // Aufnahme endet, wenn der Mac fehlt oder der Config Mode beginnt
  resetState();
  dmMapKeys();
  setMillis(1000);
  dmTap(0, 0);
  assert(bleKeyboard.dynMacro.recording);
  bleKeyboard.connected = false;
  dynamicMacroService();
  assert(!bleKeyboard.dynMacro.recording);
  bleKeyboard.connected = true;
  dmTap(0, 0);
  isConfigMode = true;
  dynamicMacroService();
  assert(!bleKeyboard.dynMacro.recording);
  isConfigMode = false;
}

TEST(test_dynamic_macro_get_info_reports_the_state_again) {
  resetState();
  dmMapKeys();
  setMillis(1000);
  dmTap(0, 0);
  dynamicMacroService();
  assert(dmSerialCount("DM_REC:1") == 1);
  dynamicMacroService();
  assert(dmSerialCount("DM_REC:1") == 1);
  handleConfigCommand("GET_INFO", false);          // neue Verbindung der App
  dynamicMacroService();
  assert(dmSerialCount("DM_REC:1") == 2);
}


// -----------------------------------------------------------------------------
// Leader-Folgen (ACT_LEADER)
// -----------------------------------------------------------------------------
static void leaderMapKeys() {
  KEYMAP[0][0][0] = ACT_LEADER;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][2] = 'b';
  KEYMAP[0][2][3] = 'c';
}
static void leaderAddSeq(uint16_t action, std::initializer_list<uint8_t> keys) {
  LeaderSeq s = { { 0, 0, 0, 0 }, action };
  int i = 0;
  for (uint8_t k : keys) s.keys[i++] = k;
  userLeaderSeqs[numLeaderSeqs++] = s;
}
static int leaderWrites(uint8_t code) {
  return (int)std::count(bleKeyboard.writtenKeys.begin(), bleKeyboard.writtenKeys.end(), code);
}
static bool leaderNoOtherKeys() {
  return bleKeyboard.pressedKeys.empty() && bleKeyboard.pressHistory.empty();
}

TEST(test_leader_matching_sequence_runs_its_action_and_sends_no_sequence_key) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a', 'b' });
  setMillis(1000);
  dmTap(0, 0);                                    // Leader
  assert(leaderNoOtherKeys() && bleKeyboard.writtenKeys.empty());   // die Leader-Taste sendet nichts
  setMillis(1100);
  dmTap(2, 1);                                    // a
  assert(leaderNoOtherKeys() && bleKeyboard.writtenKeys.empty());   // noch unvollständig
  setMillis(1200);
  dmTap(2, 2);                                    // b: die Folge ist vollständig
  assert(leaderWrites('z') == 1);
  assert(leaderNoOtherKeys());                    // weder a noch b erreichten den Host
  assert(bleKeyboard.pressedKeys.empty());        // nach der Folge ist alles losgelassen
  assert(!leaderState.active);
  // Danach tippen die Tasten wieder normal
  setMillis(1500);
  dmTap(2, 1);
  assert(std::count(bleKeyboard.pressHistory.begin(), bleKeyboard.pressHistory.end(), 'a') == 1);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_leader_sequence_key_held_across_the_match_sends_nothing_on_release) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a' });
  setMillis(1000);
  dmTap(0, 0);
  pressKey(2, 1);                                 // a gedrückt: Folge vollständig, Aktion läuft
  assert(leaderWrites('z') == 1);
  setMillis(1300);
  releaseKey(2, 1);                               // Loslassen sendet nichts und lässt nichts hängen
  assert(leaderNoOtherKeys() && bleKeyboard.pressedKeys.empty());
  assert(!leaderConsumed[2][1]);
}

TEST(test_leader_timeout_sends_nothing) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a', 'b' });
  setMillis(1000);
  dmTap(0, 0);
  setMillis(1100);
  dmTap(2, 1);                                    // a: Teilfolge
  assert(leaderState.active);
  runTicks(1100 + 999);
  assert(leaderState.active);                     // das Zeitlimit zählt ab der letzten Taste
  runTicks(1100 + 1001);
  assert(!leaderState.active);
  assert(bleKeyboard.writtenKeys.empty() && leaderNoOtherKeys());   // nichts gesendet, auch a nicht
  // Eine spätere Taste tippt normal
  dmTap(2, 2);
  assert(std::count(bleKeyboard.pressHistory.begin(), bleKeyboard.pressHistory.end(), 'b') == 1);
}

TEST(test_leader_timeout_without_any_key_ends_silently) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a' });
  setMillis(1000);
  dmTap(0, 0);
  runTicks(2100);
  assert(!leaderState.active);
  assert(bleKeyboard.writtenKeys.empty() && leaderNoOtherKeys());
  dmTap(2, 1);                                    // jetzt eine normale Taste
  assert(leaderWrites('z') == 0);
  assert(std::count(bleKeyboard.pressHistory.begin(), bleKeyboard.pressHistory.end(), 'a') == 1);
}

TEST(test_leader_timeout_follows_the_setting) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a', 'b' });
  leaderTimeoutMs = 300;
  setMillis(1000);
  dmTap(0, 0);
  runTicks(1299);
  assert(leaderState.active);
  runTicks(1301);
  assert(!leaderState.active);
}

TEST(test_leader_sequence_without_match_sends_nothing) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a', 'b' });
  setMillis(1000);
  dmTap(0, 0);
  setMillis(1100);
  dmTap(2, 3);                                    // c: keine Folge beginnt damit
  assert(!leaderState.active);
  assert(bleKeyboard.writtenKeys.empty() && leaderNoOtherKeys());
  // Auch ein falscher zweiter Schritt sendet nichts
  setMillis(1500);
  dmTap(0, 0);
  dmTap(2, 1);                                    // a
  dmTap(2, 3);                                    // c statt b
  assert(!leaderState.active);
  assert(bleKeyboard.writtenKeys.empty() && leaderNoOtherKeys());
  // Die Erfassung ist beendet: die nächste Taste tippt normal
  setMillis(2000);
  dmTap(2, 2);
  assert(std::count(bleKeyboard.pressHistory.begin(), bleKeyboard.pressHistory.end(), 'b') == 1);
}

TEST(test_leader_releases_all_keys_after_the_sequence) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a', 'b' });
  setMillis(1000);
  dmTap(0, 0);
  pressKey(2, 1);                                 // a und b werden gleichzeitig gehalten
  pressKey(2, 2);
  assert(leaderWrites('z') == 1);
  releaseKey(2, 2);
  releaseKey(2, 1);
  assert(bleKeyboard.pressedKeys.empty());
  assert(leaderNoOtherKeys());
  for (int r = 0; r < NUM_ROWS; r++)
    for (int c = 0; c < NUM_COLS; c++) assert(!keySentToHost[r][c] && !leaderConsumed[r][c]);
}

TEST(test_leader_runs_key_pair_and_macro_actions) {
  resetState();
  leaderMapKeys();
  userKeyPairs[0] = { KEY_LEFT_SHIFT, '1' };
  numKeyPairs = 1;
  numMacros = 1;
  macroLengths[0] = 2;
  userMacros[0][0] = { MACRO_STEP_TAP, 'q', 0 };
  userMacros[0][1] = { MACRO_STEP_TAP, 'r', 0 };
  leaderAddSeq(ACT_KEY_PAIR_BASE + 0, { 'a' });
  leaderAddSeq(ACT_MACRO_BASE + 0, { 'b' });
  setMillis(1000);
  dmTap(0, 0);
  dmTap(2, 1);                                    // Paar: Shift + 1 als Tipp
  assert(std::count(bleKeyboard.pressHistory.begin(), bleKeyboard.pressHistory.end(), '1') == 1);
  assert(bleKeyboard.pressedKeys.empty());
  bleKeyboard.pressHistory.clear();
  setMillis(1500);
  dmTap(0, 0);
  dmTap(2, 2);                                    // Makro q, r
  runTicks(1800);
  assert(std::count(bleKeyboard.pressHistory.begin(), bleKeyboard.pressHistory.end(), 'q') == 1);
  assert(std::count(bleKeyboard.pressHistory.begin(), bleKeyboard.pressHistory.end(), 'r') == 1);
  assert(std::count(bleKeyboard.pressHistory.begin(), bleKeyboard.pressHistory.end(), 'a') == 0);
  assert(std::count(bleKeyboard.pressHistory.begin(), bleKeyboard.pressHistory.end(), 'b') == 0);
  assert(bleKeyboard.pressedKeys.empty() && !macroRun.active);
}

TEST(test_leader_prefix_sequence_waits_and_runs_when_the_time_expires) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('x', { 'a' });
  leaderAddSeq('y', { 'a', 'b' });
  setMillis(1000);
  dmTap(0, 0);
  setMillis(1100);
  dmTap(2, 1);                                    // a: "x" passt, "y" ist noch möglich
  assert(leaderState.active && bleKeyboard.writtenKeys.empty());
  runTicks(1100 + 1001);
  assert(leaderWrites('x') == 1 && leaderWrites('y') == 0);
  assert(!leaderState.active && leaderNoOtherKeys());

  // Die längere Folge gewinnt, wenn die zweite Taste rechtzeitig kommt
  bleKeyboard.writtenKeys.clear();
  setMillis(4000);
  dmTap(0, 0);
  dmTap(2, 1);
  setMillis(4200);
  dmTap(2, 2);
  assert(leaderWrites('y') == 1 && leaderWrites('x') == 0);
}

TEST(test_leader_runs_a_four_key_sequence_and_stops_at_the_limit) {
  resetState();
  leaderMapKeys();
  KEYMAP[0][2][4] = 'd';
  KEYMAP[0][2][5] = 'e';
  leaderAddSeq('z', { 'a', 'b', 'c', 'd' });
  setMillis(1000);
  dmTap(0, 0);
  dmTap(2, 1); dmTap(2, 2); dmTap(2, 3);
  assert(leaderState.active && leaderState.count == 3);
  dmTap(2, 4);
  assert(leaderWrites('z') == 1 && !leaderState.active && leaderNoOtherKeys());
  // Die fünfte Taste gehört nicht mehr zur Folge
  dmTap(2, 5);
  assert(std::count(bleKeyboard.pressHistory.begin(), bleKeyboard.pressHistory.end(), 'e') == 1);
}

TEST(test_leader_does_nothing_without_host_or_in_config_mode) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a' });
  bleKeyboard.connected = false;
  dmTap(0, 0);
  assert(!leaderState.active);
  bleKeyboard.connected = true;
  isConfigMode = true;
  dmTap(0, 0);
  assert(!leaderState.active);
  isConfigMode = false;
  // Host fällt während der Erfassung weg: nichts wird ausgeführt
  dmTap(0, 0);
  assert(leaderState.active);
  bleKeyboard.connected = false;
  dmTap(2, 1);
  bleKeyboard.connected = true;
  assert(leaderWrites('z') == 0 && leaderNoOtherKeys());
}

TEST(test_leader_capture_ends_with_release_all_state) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a', 'b' });
  dmTap(0, 0);
  dmTap(2, 1);
  assert(leaderState.active);
  oslClearAll();                                  // Host-Verlust, Link-Ausfall, Config Mode
  assert(!leaderState.active);
  dmTap(2, 2);
  assert(leaderWrites('z') == 0);
  assert(std::count(bleKeyboard.pressHistory.begin(), bleKeyboard.pressHistory.end(), 'b') == 1);
}

TEST(test_leader_ignores_layer_keys_and_modifiers_during_capture) {
  resetState();
  leaderMapKeys();
  KEYMAP[0][3][0] = ACT_MO_1;
  KEYMAP[1][2][1] = 'a';
  KEYMAP[0][3][1] = KEY_LEFT_SHIFT;
  leaderAddSeq('z', { 'a' });
  setMillis(1000);
  dmTap(0, 0);
  pressKey(3, 0);                                 // MO_1 halten: die Erfassung läuft weiter
  assert(leaderState.active && getActiveLayer() == 1);
  dmTap(2, 1);                                    // a auf Ebene 1
  releaseKey(3, 0);
  assert(leaderWrites('z') == 1 && leaderNoOtherKeys());
  // Ein Modifier ist nie Teil einer Folge
  dmTap(0, 0);
  pressKey(3, 1);
  assert(leaderState.active);
  releaseKey(3, 1);
  dmTap(2, 1);
  assert(leaderWrites('z') == 2);
}

TEST(test_leader_does_not_trigger_a_combo_from_consumed_keys) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a', 'b' });
  numCombos = 1;
  userCombos[0] = { 2, 1, 2, 2, 0, (uint16_t)KEY_ESC };
  setMillis(1000);
  dmTap(0, 0);
  pressKey(2, 1);
  setMillis(1010);
  pressKey(2, 2);                                 // innerhalb des Combo-Fensters
  checkUserCombos();
  assert(!comboRuntime[0].active);
  releaseKey(2, 2);
  releaseKey(2, 1);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_leader_commands_validate_and_report) {
  resetState();
  handleConfigCommand("CLEAR_LEADER", false);
  assert(mockChar.value == "OK CLEAR_LEADER");
  handleConfigCommand("ADD_LEADER 122 97 98", false);
  assert(mockChar.value == "OK ADD_LEADER 0");
  handleConfigCommand("ADD_LEADER 320 99", false);          // Paar 0
  assert(mockChar.value == "OK ADD_LEADER 1");
  handleConfigCommand("ADD_LEADER 368 100 101 102 103", false);   // Makro 0, vier Tasten
  assert(mockChar.value == "OK ADD_LEADER 2");
  assert(numLeaderSeqs == 3);
  assert(userLeaderSeqs[0].keys[0] == 97 && userLeaderSeqs[0].keys[1] == 98 && userLeaderSeqs[0].keys[2] == 0);
  assert(userLeaderSeqs[2].keys[3] == 103 && userLeaderSeqs[2].action == 368);
  // Ungültig: Duplikat, Modifier, fünf Tasten, Aktion ohne Tasten, ungültige Aktion, Layer-Aktion, Zusatzwert
  const char *bad[] = {
    "ADD_LEADER 65 97 98", "ADD_LEADER 122 128 98", "ADD_LEADER 122 97 98 99 100 101", "ADD_LEADER 122",
    "ADD_LEADER 256 97", "ADD_LEADER 0 97", "ADD_LEADER 256 99", "ADD_LEADER 122 0", "ADD_LEADER 122 97 0 98",
    "ADD_LEADER 122 300", "ADD_LEADER 336 101", "ADD_LEADER 122 101 x",
  };
  for (const char *c : bad) {
    handleConfigCommand(c, false);
    assert(mockChar.value == std::string("ERR ARGS ") + c);
  }
  assert(numLeaderSeqs == 3);
  // Obergrenze
  handleConfigCommand("CLEAR_LEADER", false);
  for (int i = 0; i < MAX_LEADER_SEQS; i++) handleConfigCommand((std::string("ADD_LEADER 122 ") + std::to_string(33 + i)).c_str(), false);
  assert(numLeaderSeqs == MAX_LEADER_SEQS);
  handleConfigCommand("ADD_LEADER 122 120", false);
  assert(mockChar.value == "ERR ARGS ADD_LEADER 122 120");
}

TEST(test_leader_sequences_persist_in_nvs) {
  resetState();
  loadKeymapFromNVS();
  handleConfigCommand("CLEAR_LEADER", false);
  handleConfigCommand("ADD_LEADER 122 97 98", false);
  handleConfigCommand("ADD_LEADER 368 99", false);
  handleConfigCommand("SAVE_LEADER", false);
  assert(mockChar.value == "OK SAVE_LEADER");
  assert(Preferences::bytesStore.count("leader_data") && preferences.isKey("num_leader"));
  numLeaderSeqs = 0;
  for (int i = 0; i < MAX_LEADER_SEQS; i++) userLeaderSeqs[i] = { { 0, 0, 0, 0 }, 0 };
  loadKeymapFromNVS();
  assert(numLeaderSeqs == 2);
  assert(userLeaderSeqs[0].action == 122 && userLeaderSeqs[0].keys[0] == 97 && userLeaderSeqs[0].keys[1] == 98);
  assert(userLeaderSeqs[1].action == 368 && userLeaderSeqs[1].keys[0] == 99);

  // Eine leere gespeicherte Liste überschreibt die einkompilierte
  handleConfigCommand("CLEAR_LEADER", false);
  handleConfigCommand("SAVE_LEADER", false);
  assert(mockChar.value == "OK SAVE_LEADER");
  numLeaderSeqs = 1;
  userLeaderSeqs[0] = { { 97, 0, 0, 0 }, 122 };
  loadKeymapFromNVS();
  assert(numLeaderSeqs == 0);

  // Beschädigte Daten (ungültige Folge) ersetzen die einkompilierte Liste nicht
  preferences.begin("dactyl", false);
  LeaderSeq broken[1] = { { { 128, 0, 0, 0 }, 122 } };
  preferences.putBytes("leader_data", broken, sizeof(broken));
  preferences.putUChar("num_leader", 1);
  preferences.end();
  numLeaderSeqs = 0;
  loadKeymapFromNVS();
  assert(numLeaderSeqs == 0);
}

TEST(test_leader_nvs_write_failure_is_reported) {
  resetState();
  handleConfigCommand("ADD_LEADER 122 97", false);
  Preferences::failBytesKey = "leader_data";
  handleConfigCommand("SAVE_LEADER", false);
  assert(mockChar.value == "ERR NVS SAVE_LEADER");
  assert(!preferences.isKey("num_leader"));       // die Anzahl bleibt ohne Daten unverändert
  Preferences::failBytesKey.clear();
}

TEST(test_app_flash_discards_stored_leader_sequences) {
  resetState();
  handleConfigCommand("ADD_LEADER 122 97", false);
  handleConfigCommand("SAVE_LEADER", false);
  loadKeymapFromNVS();
  testDefaultsId = 0xBEEF;
  numLeaderSeqs = 1;
  userLeaderSeqs[0] = { { 98, 0, 0, 0 }, 121 };
  loadKeymapFromNVS();
  assert(numLeaderSeqs == 1 && userLeaderSeqs[0].keys[0] == 98 && userLeaderSeqs[0].action == 121);
  assert(!preferences.isKey("num_leader"));
}

TEST(test_leader_get_config_sends_the_list) {
  resetState();
  loadKeymapFromNVS();
  handleConfigCommand("CLEAR_LEADER", false);
  handleConfigCommand("ADD_LEADER 122 97 98", false);
  handleConfigCommand("ADD_LEADER 368 99", false);
  mockChar.notifications.clear();
  handleConfigCommand("GET_CONFIG", false);
  bool count = false, data = false;
  for (const auto &n : mockChar.notifications) {
    if (n == "LEADER_COUNT:2") count = true;
    if (n == "LEADER_DATA:{\"o\":0,\"e\":[[122,97,98,0,0],[368,99,0,0,0]]}") data = true;
  }
  assert(count && data);
  // Liste mit mehr als einer Zeile: alle Einträge kommen genau einmal an
  handleConfigCommand("CLEAR_LEADER", false);
  for (int i = 0; i < MAX_LEADER_SEQS; i++) handleConfigCommand((std::string("ADD_LEADER 122 ") + std::to_string(33 + i)).c_str(), false);
  mockChar.notifications.clear();
  handleConfigCommand("GET_CONFIG", false);
  int lines = 0, entries = 0;
  for (const auto &n : mockChar.notifications) {
    if (n.rfind("LEADER_DATA", 0) == 0) { lines++; entries += (int)std::count(n.begin(), n.end(), '[') - 1; }
  }
  assert(lines == MAX_LEADER_SEQS / GET_CONFIG_LEADER_PER_LINE && entries == MAX_LEADER_SEQS);
  for (const auto &n : mockChar.notifications) if (n.rfind("LEADER_DATA", 0) == 0) assert(n.size() <= 150);
}

TEST(test_leader_timeout_command_and_device_info) {
  resetState();
  handleConfigCommand("SET_LEADER_TIMEOUT 1500", false);
  assert(mockChar.value == "OK SET_LEADER_TIMEOUT 1500" && leaderTimeoutMs == 1500);
  assert(Preferences::uintStore.count("leader_to") || preferences.isKey("leader_to"));
  const char *bad[] = { "SET_LEADER_TIMEOUT 99", "SET_LEADER_TIMEOUT 5001", "SET_LEADER_TIMEOUT x", "SET_LEADER_TIMEOUT -5", "SET_LEADER_TIMEOUT 12345", "SET_LEADER_TIMEOUT 1e3" };
  for (const char *c : bad) {
    handleConfigCommand(c, false);
    assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
  }
  assert(leaderTimeoutMs == 1500);
  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.find("\"ld\":1500") != std::string::npos);
  leaderTimeoutMs = 1000;
  loadKeymapFromNVS();
  assert(leaderTimeoutMs == 1500);                // aus dem NVS geladen
  // Längster Gerätename: DEVICE_INFO bleibt gültiges JSON
  deviceName = String("0123456789012345678901234567890");
  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.back() == '}' && mockChar.value.find("\"config_mode\":") != std::string::npos);
  deviceName = DEFAULT_DEVICE_NAME;
}

TEST(test_one_shot_timeout_command_and_device_info) {
  resetState();
  handleConfigCommand("SET_ONESHOT_TIMEOUT 1500", false);
  assert(mockChar.value == "OK SET_ONESHOT_TIMEOUT 1500" && oneShotTimeoutMs == 1500);
  handleConfigCommand("SET_ONESHOT_TIMEOUT 0", false);
  assert(mockChar.value == "OK SET_ONESHOT_TIMEOUT 0" && oneShotTimeoutMs == 0);
  handleConfigCommand("SET_ONESHOT_TIMEOUT 500", false);
  handleConfigCommand("SET_ONESHOT_TIMEOUT 10000", false);
  assert(mockChar.value == "OK SET_ONESHOT_TIMEOUT 10000" && oneShotTimeoutMs == 10000);
  const char *bad[] = { "SET_ONESHOT_TIMEOUT 1", "SET_ONESHOT_TIMEOUT 499", "SET_ONESHOT_TIMEOUT 10001", "SET_ONESHOT_TIMEOUT x", "SET_ONESHOT_TIMEOUT -5", "SET_ONESHOT_TIMEOUT 1e3", "SET_ONESHOT_TIMEOUT 123456" };
  for (const char *c : bad) {
    handleConfigCommand(c, false);
    assert(mockChar.value.rfind("ERR ARGS", 0) == 0);
  }
  assert(oneShotTimeoutMs == 10000);
  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.find("\"ot\":10000") != std::string::npos);
  oneShotTimeoutMs = 0;
  loadKeymapFromNVS();
  assert(oneShotTimeoutMs == 10000);              // aus dem NVS geladen
}

TEST(test_layer_timeout_clears_toggled_layer_after_idle_time) {
  resetState();
  layerTimeoutMs = 2000;
  toggleLayers[2] = true;
  layerTimeoutExpire(1000);                       // stempelt
  layerTimeoutExpire(2999);
  assert(getActiveLayer() == 2);
  layerTimeoutExpire(3000);
  assert(getActiveLayer() == 0 && toggleLayerMask() == 0);
}

TEST(test_layer_timeout_restarts_on_key_press_of_either_half) {
  resetState();
  layerTimeoutMs = 2000;
  toggleLayers[2] = true;
  layerTimeoutExpire(1000);
  notePriorKeyPress(2500);                        // Druck einer Hälfte
  layerTimeoutExpire(2500);                       // stempelt neu
  layerTimeoutExpire(4499);
  assert(getActiveLayer() == 2);
  layerTimeoutExpire(4500);
  assert(getActiveLayer() == 0);
}

TEST(test_layer_timeout_off_and_lock_and_mo_unaffected) {
  resetState();
  toggleLayers[2] = true;                         // layerTimeoutMs == 0: aus
  layerTimeoutExpire(0);
  layerTimeoutExpire(900000);
  assert(getActiveLayer() == 2);
  resetState();
  layerTimeoutMs = 1000;
  KEYMAP[0][5][0] = ACT_MO_3;
  KEYMAP[3][5][1] = ACT_LAYER_LOCK;
  pressKey(5, 0, true);
  pressKey(5, 1, true);
  pressKey(5, 1, false);
  pressKey(5, 0, false);
  assert(toggleLayers[3] && layerLockedMask == (1 << 3));
  layerTimeoutExpire(10000);
  layerTimeoutExpire(50000);
  assert(getActiveLayer() == 3);                  // Layer lock bleibt
  resetState();
  layerTimeoutMs = 1000;
  momentaryLayers[2] = true;                      // MO_n bleibt
  layerTimeoutExpire(0);
  layerTimeoutExpire(50000);
  assert(getActiveLayer() == 2);
}

TEST(test_layer_timeout_waits_while_a_key_is_held) {
  resetState();
  layerTimeoutMs = 1000;
  toggleLayers[2] = true;
  layerTimeoutExpire(0);
  keyState[0][0] = true;                          // gehaltene Taste
  layerTimeoutExpire(5000);
  layerTimeoutExpire(50000);
  assert(getActiveLayer() == 2);
  keyState[0][0] = false;
  layerTimeoutExpire(50100);                      // Frist zählt vom letzten Tick mit gehaltener Taste (50000)
  layerTimeoutExpire(50999);
  assert(getActiveLayer() == 2);
  layerTimeoutExpire(51000);
  assert(getActiveLayer() == 0);
}

TEST(test_layer_timeout_enabling_counts_from_the_change) {
  resetState();
  toggleLayers[2] = true;
  layerTimeoutExpire(1000);                       // Einstellung aus: stempelt nur
  layerTimeoutExpire(900000);
  handleConfigCommand("SET_LAYER_TIMEOUT 2000", false);
  layerTimeoutExpire(900100);                     // stempelt neu
  layerTimeoutExpire(901000);
  assert(getActiveLayer() == 2);                  // lange Ruhe vor dem Einschalten löst nichts sofort
  layerTimeoutExpire(902100);
  assert(getActiveLayer() == 0);
}

TEST(test_layer_timeout_command_nvs_and_device_info) {
  resetState();
  handleConfigCommand("SET_LAYER_TIMEOUT 5000", false);
  assert(mockChar.value == "OK SET_LAYER_TIMEOUT 5000" && layerTimeoutMs == 5000);
  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.find("\"lt\":5000") != std::string::npos);
  layerTimeoutMs = 0;
  loadKeymapFromNVS();
  assert(layerTimeoutMs == 5000);
  handleConfigCommand("SET_LAYER_TIMEOUT 0", false);
  assert(mockChar.value == "OK SET_LAYER_TIMEOUT 0" && layerTimeoutMs == 0);
  handleConfigCommand("SET_LAYER_TIMEOUT 60000", false);
  assert(layerTimeoutMs == 60000);
  const char *bad[] = { "SET_LAYER_TIMEOUT 1", "SET_LAYER_TIMEOUT 999", "SET_LAYER_TIMEOUT 60001", "SET_LAYER_TIMEOUT x", "SET_LAYER_TIMEOUT -5", "SET_LAYER_TIMEOUT 123456" };
  for (const char *c : bad) {
    handleConfigCommand(c, false);
    assert(mockChar.value.rfind("ERR ARGS", 0) == 0 && layerTimeoutMs == 60000);
  }
  layerTimeoutMs = 7000;
  Preferences::uintStore["layer_to"] = 500;       // ungültig im NVS
  loadKeymapFromNVS();
  assert(layerTimeoutMs == 7000);
}

TEST(test_one_shot_timeout_nvs_rejects_invalid_values) {
  resetState();
  oneShotTimeoutMs = 1500;
  const uint32_t bad[] = { 1, 499, 10001, 65535 };
  for (uint32_t v : bad) {
    Preferences::uintStore["osm_to"] = v;
    loadKeymapFromNVS();
    assert(oneShotTimeoutMs == 1500);           // ungültiger Wert ändert nichts
  }
  Preferences::uintStore["osm_to"] = 0;
  loadKeymapFromNVS();
  assert(oneShotTimeoutMs == 0);
}

TEST(test_leader_is_no_combo_action) {
  resetState();
  handleConfigCommand("CLEAR_COMBOS", false);
  handleConfigCommand("ADD_COMBO 2 0 2 1 0 366", false);   // ACT_LEADER
  assert(mockChar.value == "ERR ARGS ADD_COMBO 2 0 2 1 0 366" && numCombos == 0);
  handleConfigCommand("ADD_COMBO 2 0 2 1 1 366", false);
  assert(numCombos == 0);
}

TEST(test_leader_clear_command_ends_a_running_capture) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a', 'b' });
  dmTap(0, 0);
  dmTap(2, 1);
  handleConfigCommand("CLEAR_LEADER", false);
  assert(!leaderState.active && numLeaderSeqs == 0);
}

TEST(test_leader_validation_helpers) {
  assert(leaderKeyCodeValid('a') && leaderKeyCodeValid(255) && leaderKeyCodeValid(1));
  assert(!leaderKeyCodeValid(0) && !leaderKeyCodeValid(256) && !leaderKeyCodeValid(0x80) && !leaderKeyCodeValid(0x87));
  assert(leaderKeyCodeValid(0x88));
  assert(leaderActionValid(ACT_KEY_PAIR_BASE) && leaderActionValid(ACT_KEY_PAIR_BASE + 15) && !leaderActionValid(ACT_KEY_PAIR_BASE + 16));
  assert(leaderActionValid(ACT_MACRO_BASE) && leaderActionValid(ACT_MACRO_BASE + 15) && !leaderActionValid(ACT_MACRO_BASE + 16));
  assert(!leaderActionValid(ACT_MO_1) && !leaderActionValid(ACT_LEADER));
  uint8_t gap[4] = { 97, 0, 98, 0 };
  assert(leaderKeyCount(gap) == 0);
  uint8_t ok[4] = { 97, 98, 0, 0 };
  assert(leaderKeyCount(ok) == 2);
  uint8_t full[4] = { 1, 2, 3, 4 };
  assert(leaderKeyCount(full) == 4);
}


TEST(test_leader_as_combo_candidate_starts_only_without_a_combo) {
  resetState();
  leaderMapKeys();
  KEYMAP[0][0][0] = 0;
  KEYMAP[0][1][0] = ACT_LEADER;   // R0C0 ist die Config-Combo-Taste
  leaderAddSeq('z', { 'a' });
  numCombos = 1;
  userCombos[0] = { 1, 0, 2, 1, 0, (uint16_t)KEY_ESC };   // Leader-Taste + a als Combo
  setMillis(1000);
  pressKey(1, 0);
  setMillis(1010);
  pressKey(2, 1);
  checkUserCombos();
  assert(comboRuntime[0].active);
  assert(!leaderState.active);                    // die Combo hat die Leader-Taste verbraucht
  releaseKey(2, 1);
  releaseKey(1, 0);
  setMillis(2000);
  dmTap(2, 2);                                    // die nächste Taste tippt normal und wird nicht verschluckt
  assert(std::count(bleKeyboard.pressHistory.begin(), bleKeyboard.pressHistory.end(), 'b') == 1);

  // Ohne Combo: schneller Tipp beginnt die Erfassung beim Loslassen
  resetState();
  leaderMapKeys();
  KEYMAP[0][0][0] = 0;
  KEYMAP[0][1][0] = ACT_LEADER;   // R0C0 ist die Config-Combo-Taste
  leaderAddSeq('z', { 'a' });
  numCombos = 1;
  userCombos[0] = { 1, 0, 2, 3, 0, (uint16_t)KEY_ESC };
  setMillis(1000);
  pressKey(1, 0);
  assert(!leaderState.active);                    // gepuffert
  setMillis(1020);
  releaseKey(1, 0);
  assert(leaderState.active);
  dmTap(2, 1);
  assert(leaderWrites('z') == 1);

  // Nach dem Combo-Fenster beginnt die Erfassung ohne Loslassen
  resetState();
  leaderMapKeys();
  KEYMAP[0][0][0] = 0;
  KEYMAP[0][1][0] = ACT_LEADER;   // R0C0 ist die Config-Combo-Taste
  leaderAddSeq('z', { 'a' });
  numCombos = 1;
  userCombos[0] = { 1, 0, 2, 3, 0, (uint16_t)KEY_ESC };
  setMillis(1000);
  pressKey(1, 0);
  runTicks(1000 + comboTimeoutMs + 5);
  assert(leaderState.active);
  releaseKey(1, 0);
  assert(leaderState.active);                     // das Loslassen beendet die Erfassung nicht
  dmTap(2, 1);
  assert(leaderWrites('z') == 1);
}

TEST(test_leader_consumed_third_combo_key_blocks_a_three_key_combo) {
  resetState();
  leaderMapKeys();
  KEYMAP[0][2][4] = 'd';
  leaderAddSeq('z', { 'd' });
  numCombos = 1;
  userCombos[0] = { 2, 1, 2, 2, 0, (uint16_t)KEY_ESC };
  userCombos[0].r3 = 2; userCombos[0].c3 = 4;
  setMillis(1000);
  dmTap(0, 0);
  pressKey(2, 4);                                 // d wird als dritte Combo-Taste verbraucht
  pressKey(2, 1);
  pressKey(2, 2);
  checkUserCombos();
  assert(!comboRuntime[0].active);
}

TEST(test_leader_capture_aborts_on_actions_with_host_output) {
  resetState();
  leaderMapKeys();
  userKeyPairs[0] = { KEY_LEFT_SHIFT, '1' };
  numKeyPairs = 1;
  KEYMAP[0][3][0] = ACT_KEY_PAIR_BASE;
  KEYMAP[0][3][1] = ACT_REPEAT;
  KEYMAP[0][3][2] = ACT_CAPS_WORD;
  KEYMAP[0][3][3] = ACT_LEADER;
  leaderAddSeq('z', { 'a' });
  const uint8_t keys[][2] = { {3, 0}, {3, 1}, {3, 2} };
  for (const auto &k : keys) {
    setMillis(1000);
    leaderReset();
    dmTap(0, 0);
    assert(leaderState.active);
    pressKey(k[0], k[1]);
    releaseKey(k[0], k[1]);
    assert(!leaderState.active);                  // Aktion mit Ausgabe: die Erfassung endet
    bleKeyboard.writtenKeys.clear();
    dmTap(2, 1);
    assert(leaderWrites('z') == 0);               // 'a' ist wieder eine normale Taste
  }
  // Eine zweite Leader-Taste beginnt die Erfassung neu
  leaderReset();
  dmTap(0, 0);
  dmTap(2, 2);                                    // b: keine Folge, Erfassung endet
  dmTap(0, 0);
  pressKey(3, 3);
  releaseKey(3, 3);
  assert(leaderState.active && leaderState.count == 0);
}

TEST(test_leader_hold_resolved_leader_key_starts_the_capture) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a' });
  KEYMAP[0][3][0] = 'q';
  HOLDMAP[0][3][0] = ACT_LEADER;
  setMillis(1000);
  pressKey(3, 0);
  runTicks(1000 + tappingTermMs + 5);
  assert(leaderState.active);
  releaseKey(3, 0);
  assert(leaderState.active);
  assert(std::count(bleKeyboard.pressHistory.begin(), bleKeyboard.pressHistory.end(), 'q') == 0);
  dmTap(2, 1);
  assert(leaderWrites('z') == 1);
}

TEST(test_leader_hold_on_a_combo_candidate_key_starts_the_capture_when_the_hold_resolves) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a' });
  KEYMAP[0][3][0] = 'q';
  HOLDMAP[0][3][0] = ACT_LEADER;
  numCombos = 1;
  userCombos[0] = { 3, 0, 3, 5, 0, (uint16_t)KEY_ESC };   // R3C0 ist ein Combo-Kandidat
  setMillis(1000);
  pressKey(3, 0);
  runTicks(1000 + tappingTermMs + 5);
  assert(leaderState.active);
  releaseKey(3, 0);
  dmTap(2, 1);
  assert(leaderWrites('z') == 1);
}

TEST(test_leader_consumed_shifted_key_is_no_held_modifier_for_umlauts) {
  resetState();
  leaderMapKeys();
  KEYMAP[0][2][1] = '!';                          // eine Taste, die Shift braucht
  KEYMAP[0][2][4] = ACT_UMLAUT_AE;
  leaderAddSeq('z', { '!', 'b' });
  setMillis(1000);
  dmTap(0, 0);
  pressKey(2, 1);                                 // verbraucht und noch gehalten
  assert(heldModifierMask() == 0);
  bleKeyboard.keyEvents.clear();
  pressKey(2, 4);                                 // Umlaut bricht die Erfassung ab und läuft ohne Shift
  for (int e : bleKeyboard.keyEvents) assert(e != KEY_LEFT_SHIFT && e != -KEY_LEFT_SHIFT);
  releaseKey(2, 4);
  releaseKey(2, 1);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_leader_deferred_key_uses_its_press_time_for_the_timeout) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a' });
  setMillis(1000);
  dmTap(0, 0);
  // Der Druck liegt im Zeitlimit, wird aber erst spät ausgeführt (Deferred Queue): er zählt trotzdem
  keyPressTime[2][1] = 1900;
  keyState[2][1] = true;
  setMillis(2500);
  dispatchPress(2, 1, 'a', 0);
  assert(leaderWrites('z') == 1);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_leader_consumed_key_still_reports_a_press_to_the_app) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a', 'b' });
  dmTap(0, 0);
  Serial.clear();
  pressKey(2, 1);
  bool seen = false;   // USB-Serial; über BLE geht KEY_PRESS im Tastaturmodus nie (Keylogger-Schutz)
  for (const auto &l : Serial.outputLines) if (l.rfind("KEY_PRESS:", 0) == 0 && l.find("\"r\":2,\"c\":1") != std::string::npos) seen = true;
  assert(seen);
  releaseKey(2, 1);
}

TEST(test_leader_timeout_uses_a_signed_32_bit_difference) {
  LeaderState st;
  st.start(5000);
  assert(!st.timedOut(4990, 1000));                // Start nach dem Zeitpunkt now: nicht abgelaufen
  assert(!st.timedOut(5999, 1000) && st.timedOut(6000, 1000));
  st.start(0xFFFFFF00UL);                          // Überlauf von millis()
  assert(!st.timedOut(0xFFFFFF00UL + 500UL, 1000));
  assert(st.timedOut((0xFFFFFF00UL + 1000UL) & 0xFFFFFFFFUL, 1000));
  st.reset();
  assert(!st.timedOut(99999, 1));                  // ohne Erfassung nie
}

TEST(test_leader_hold_resolve_after_the_tick_does_not_end_the_capture) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a' });
  KEYMAP[0][3][0] = 'q';
  HOLDMAP[0][3][0] = ACT_LEADER;
  setMillis(1000);
  pressKey(3, 0);
  // Der Tick läuft mit einer Zeit vor dem Start der Erfassung (Hold-Entscheidung innerhalb desselben Durchlaufs)
  setMillis(1000 + tappingTermMs + 5);
  processDeferredKeys(1000);
  processDeferredKeys(millis());
  assert(leaderState.active);
}

TEST(test_leader_capture_survives_while_a_mod_tap_key_waits) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a' });
  KEYMAP[0][3][1] = 'm';
  HOLDMAP[0][3][1] = KEY_LEFT_SHIFT;
  tappingTermMs = 3000;                            // länger als das Leader-Zeitlimit
  setMillis(1000);
  dmTap(0, 0);
  pressKey(3, 1);                                  // Mod-Tap wartet auf seine Entscheidung
  assert(anyTapHoldPending());
  setMillis(2500);                                 // Leader-Zeitlimit (1000 ms) überschritten
  processDeferredKeys(millis());
  assert(leaderState.active);                      // die wartende Taste hält die Erfassung offen
  releaseKey(3, 1);
  tappingTermMs = 200;
}

TEST(test_leader_stale_zero_press_time_does_not_expire_the_capture) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a' });
  setMillis(5000);
  dmTap(0, 0);
  keyPressTime[2][1] = 0;                          // keine Anschlagzeit (z. B. Nachholen eines Tipps)
  keyState[2][1] = true;
  dispatchPress(2, 1, 'a', 0);
  assert(leaderWrites('z') == 1);
}

TEST(test_leader_consumed_key_press_never_goes_over_ble_in_keyboard_mode) {
  resetState();
  leaderMapKeys();
  leaderAddSeq('z', { 'a', 'b' });
  dmTap(0, 0);
  mockChar.notifications.clear();
  pressKey(2, 1);
  releaseKey(2, 1);
  for (const auto &n : mockChar.notifications) {
    assert(n.rfind("KEY_PRESS", 0) != 0 && n.rfind("KEY_RELEASE", 0) != 0);
  }
}

TEST(test_leader_consumes_an_armed_one_shot_layer_like_any_key) {
  resetState();
  leaderMapKeys();
  KEYMAP[0][5][0] = ACT_OSL_BASE + 2;
  leaderAddSeq('z', { 'a' });
  tapOsl(5, 0);
  assert(oslArmed == (1 << 2));
  dmTap(0, 0);                                    // die Leader-Taste ist der nächste Druck: sie verbraucht die Vormerkung
  assert(oslArmed == 0 && getActiveLayer() == 0);
  dmTap(2, 1);
  assert(leaderWrites('z') == 1);
}

TEST(test_leader_partial_nvs_data_keeps_the_compiled_in_list) {
  resetState();
  loadKeymapFromNVS();
  handleConfigCommand("ADD_LEADER 122 97", false);
  handleConfigCommand("SAVE_LEADER", false);
  // Anzahl 2, aber Daten für eine Folge: die gespeicherte Liste wird verworfen und das Protokoll meldet es
  preferences.begin("dactyl", false);
  preferences.putUChar("num_leader", 2);
  preferences.end();
  numLeaderSeqs = 1;
  userLeaderSeqs[0] = { { 98, 0, 0, 0 }, 121 };
  Serial.clear();
  loadKeymapFromNVS();
  assert(numLeaderSeqs == 1 && userLeaderSeqs[0].keys[0] == 98);
  bool logged = false;
  for (const auto &l : Serial.outputLines) if (l.find("Leader-Folgen unvollständig") != std::string::npos) logged = true;
  assert(logged);
}

TEST(test_eager_debounce_reports_press_in_first_pass) {
  resetState();
  assert(debouncedMatrixKey(2, 3, true, 1000));        // first pass, no wait
  assert(debouncedMatrixKey(2, 3, true, 1001));
}

TEST(test_eager_debounce_bouncing_gives_one_press_and_one_release) {
  resetState();
  debounceMs = 5;
  const bool samples[] = {1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
                          0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
  int presses = 0, releases = 0;
  bool before = false;
  for (unsigned long t = 0; t < sizeof(samples); t++) {
    bool now = debouncedMatrixKey(1, 1, samples[t], 2000 + t);
    if (now && !before) presses++;
    if (!now && before) releases++;
    before = now;
  }
  assert(presses == 1);
  assert(releases == 1);
}

TEST(test_eager_debounce_release_waits_for_debounce_ms) {
  resetState();
  debounceMs = 8;
  assert(debouncedMatrixKey(0, 1, true, 3000));
  assert(debouncedMatrixKey(0, 1, false, 3010));       // open window starts
  assert(debouncedMatrixKey(0, 1, false, 3017));
  assert(!debouncedMatrixKey(0, 1, false, 3018));
}

TEST(test_eager_debounce_keys_are_independent) {
  resetState();
  assert(debouncedMatrixKey(0, 0, true, 4000));
  assert(debouncedMatrixKey(0, 1, true, 4001));
  assert(!debouncedMatrixKey(0, 2, false, 4001));
}

TEST(test_eager_debounce_survives_millis_wrap) {
  resetState();
  debounceMs = 5;
  const unsigned long nearWrap = ~0UL - 2;
  assert(debouncedMatrixKey(3, 2, true, nearWrap));
  assert(debouncedMatrixKey(3, 2, false, nearWrap + 6));   // open window starts after the wrap
  assert(debouncedMatrixKey(3, 2, false, nearWrap + 10));
  assert(!debouncedMatrixKey(3, 2, false, nearWrap + 11));
}

TEST(test_eager_debounce_short_open_glitch_keeps_key_pressed) {
  resetState();
  debounceMs = 5;
  assert(debouncedMatrixKey(4, 4, true, 5000));
  assert(debouncedMatrixKey(4, 4, false, 5010));
  assert(debouncedMatrixKey(4, 4, true, 5012));            // contact closes again: candidate lapses
  assert(debouncedMatrixKey(4, 4, false, 5014));
  assert(debouncedMatrixKey(4, 4, false, 5018));           // only 4 ms open since 5014
}

TEST(test_eager_debounce_key_reset_clears_one_key) {
  resetState();
  assert(debouncedMatrixKey(0, 0, true, 6000));
  assert(debouncedMatrixKey(4, 5, true, 6000));
  resetMatrixDebounceKey(0, 0);
  assert(!debouncedMatrixKey(0, 0, false, 6001));          // reset key reports open at once
  assert(debouncedMatrixKey(4, 5, true, 6001));            // other key keeps its state
}


// Auto Shift: kurzer Tipp 'a', langes Halten 'A', Taste mit Halte-Aktion, Reihenfolge beim schnellen Rollen
TEST(test_auto_shift_short_tap_sends_plain_character) {
  resetState();
  autoShift = 1;
  KEYMAP[0][2][1] = 'a';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1100);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1100);
  assert(bleKeyboard.pressHistory.size() == 1 && bleKeyboard.pressHistory[0] == 'a');
  assert(bleKeyboard.pressedKeys.empty());
}

// Auto Shift Zeichenklassen: Rückgabe = erstes gesendetes Zeichen nach langem Halten (0 = nichts)
static uint16_t autoShiftHeldChar(uint8_t mode, uint16_t key) {
  resetState();
  autoShift = mode;
  KEYMAP[0][2][1] = key;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1200); processDeferredKeys(1200);
  uint16_t sent = bleKeyboard.pressHistory.empty() ? 0 : bleKeyboard.pressHistory[0];
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1300);
  return sent;
}

TEST(test_auto_shift_mode_1_shifts_all_classes) {
  assert(autoShiftHeldChar(1, 'a') == 'A');
  assert(autoShiftHeldChar(1, '1') == '!');
  assert(autoShiftHeldChar(1, ';') == ':');
}

TEST(test_auto_shift_mode_2_digits_and_symbols_only) {
  assert(autoShiftHeldChar(2, 'a') == 'a');
  assert(autoShiftHeldChar(2, '1') == '!');
  assert(autoShiftHeldChar(2, '-') == '_');
}

TEST(test_auto_shift_mode_3_letters_only) {
  assert(autoShiftHeldChar(3, 'a') == 'A');
  assert(autoShiftHeldChar(3, '1') == '1');
  assert(autoShiftHeldChar(3, ';') == ';');
}

TEST(test_auto_shift_mode_4_symbols_only) {
  assert(autoShiftHeldChar(4, 'a') == 'a');
  assert(autoShiftHeldChar(4, '1') == '1');
  assert(autoShiftHeldChar(4, '0') == '0');
  assert(autoShiftHeldChar(4, ';') == ':');
  assert(autoShiftHeldChar(4, '/') == '?');
}

TEST(test_auto_shift_mode_class_filter_waits_not_at_all) {
  // Gefilterte Taste sendet sofort beim Drücken, ohne Wartezeit
  resetState();
  autoShift = 2;
  KEYMAP[0][2][1] = 'a';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  assert(bleKeyboard.pressHistory.size() == 1 && bleKeyboard.pressHistory[0] == 'a');
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1050);
}

TEST(test_auto_shift_long_hold_sends_shifted_character) {
  resetState();
  autoShift = 1;
  KEYMAP[0][2][1] = 'a';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  assert(bleKeyboard.pressHistory.empty());           // vor dem Zeitlimit geht nichts raus
  setMillis(1174); processDeferredKeys(1174);
  assert(bleKeyboard.pressHistory.empty());
  setMillis(1175); processDeferredKeys(1175);
  assert(bleKeyboard.pressHistory.size() == 1 && bleKeyboard.pressHistory[0] == 'A');
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1300);
  assert(bleKeyboard.pressHistory.size() == 1);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_auto_shift_release_after_term_before_tick_sends_shifted) {
  resetState();
  autoShift = 1;
  KEYMAP[0][2][1] = '1';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1200);   // Tick lief noch nicht
  assert(bleKeyboard.pressHistory.size() == 1 && bleKeyboard.pressHistory[0] == '!');
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_auto_shift_off_by_default_keeps_plain_character) {
  resetState();
  KEYMAP[0][2][1] = 'a';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  assert(bleKeyboard.pressHistory.size() == 1 && bleKeyboard.pressHistory[0] == 'a');   // sofort, ohne Wartezeit
  setMillis(1500); processDeferredKeys(1500);
  assert(bleKeyboard.pressHistory.size() == 1);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1600);
}

TEST(test_auto_shift_key_with_hold_action_is_unchanged) {
  resetState();
  autoShift = 1;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1250); processDeferredKeys(1250);
  assert(countPresses(KEY_LEFT_CTRL) == 1);            // Mod-Tap entscheidet Hold
  assert(countPresses('A') == 0 && countPresses('a') == 0);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1300);
  // Kurzer Tipp bleibt ein normaler Tipp 'a'
  bleKeyboard.pressHistory.clear();
  setMillis(2000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 2000);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 2050);
  assert(bleKeyboard.pressHistory.size() == 1 && bleKeyboard.pressHistory[0] == 'a');
}

TEST(test_auto_shift_modifier_and_layer_keys_are_unchanged) {
  resetState();
  autoShift = 1;
  KEYMAP[0][2][1] = KEY_LEFT_SHIFT;
  KEYMAP[0][2][2] = ACT_MO_BASE + 1;
  KEYMAP[0][2][3] = ' ';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  assert(countPresses(KEY_LEFT_SHIFT) == 1);          // sofort, ohne Wartezeit
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1000);
  assert(getActiveLayer() == 1);                      // Layer-Taste wirkt sofort
  keyState[2][3] = true; onMatrixKeyChange(2, 3, true, 1000);   // Leerzeichen hat kein umgeschaltetes Zeichen
  assert(countPresses(' ') == 1);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1400);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1400);
  keyState[2][3] = false; onMatrixKeyChange(2, 3, false, 1400);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_auto_shift_fast_roll_keeps_character_order) {
  resetState();
  autoShift = 1;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][2] = 'b';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1060);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1060);   // zweite Taste, bevor 'a' losgelassen ist
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1090);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1120);
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == 'a' && bleKeyboard.pressHistory[1] == 'b');
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_auto_shift_fast_roll_second_key_held_long_is_shifted) {
  resetState();
  autoShift = 1;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][2] = 'b';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1060);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1060);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1090);
  setMillis(1300); processDeferredKeys(1300);
  assert(bleKeyboard.pressHistory.size() == 2);
  assert(bleKeyboard.pressHistory[0] == 'a' && bleKeyboard.pressHistory[1] == 'B');
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1400);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_auto_shift_custom_term_and_symbols) {
  resetState();
  autoShift = 1;
  autoShiftMs = 300;
  KEYMAP[0][2][1] = ';';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1250); processDeferredKeys(1250);
  assert(bleKeyboard.pressHistory.empty());
  setMillis(1300); processDeferredKeys(1300);
  assert(bleKeyboard.pressHistory.size() == 1 && bleKeyboard.pressHistory[0] == ':');
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1400);
}

TEST(test_auto_shift_mapping_covers_letters_digits_and_symbols) {
  assert(autoShiftedAscii('a') == 'A' && autoShiftedAscii('z') == 'Z');
  assert(autoShiftedAscii('1') == '!' && autoShiftedAscii('9') == '(' && autoShiftedAscii('0') == ')');
  assert(autoShiftedAscii('-') == '_' && autoShiftedAscii('=') == '+' && autoShiftedAscii('/') == '?');
  assert(autoShiftedAscii('\'') == '"' && autoShiftedAscii('\\') == '|' && autoShiftedAscii('`') == '~');
  assert(autoShiftedAscii('A') == 0 && autoShiftedAscii('!') == 0 && autoShiftedAscii(' ') == 0);
  assert(autoShiftedAscii(KEY_LEFT_SHIFT) == 0 && autoShiftedAscii(0) == 0);
}

TEST(test_auto_shift_combo_partner_keeps_combo) {
  resetState();
  autoShift = 1;
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false);
  KEYMAP[0][2][1] = 'j';
  KEYMAP[0][2][2] = 'k';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  setMillis(1010);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1010);
  checkUserCombos();
  assert(comboRuntime[0].active);                     // die Combo löst aus
  assert(countPresses('j') == 0 && countPresses('k') == 0 && countPresses('J') == 0 && countPresses('K') == 0);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1100);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1120);
  checkUserCombos();
  processDeferredKeys(2000);
  assert(countPresses('J') == 0 && countPresses('K') == 0);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_auto_shift_pending_key_counts_as_waiting_tap_for_other_half) {
  resetState();
  autoShift = 1;
  KEYMAP[0][2][1] = 'a';
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  assert(anyDoubleTapWaiting());                      // links: TAP_PENDING 1; Master: Druck der anderen Hälfte wartet
  flushAllDoubleTaps();                               // Druck der anderen Hälfte: wartende Taste geht als Tipp raus
  assert(!anyDoubleTapWaiting());
  assert(bleKeyboard.pressHistory.size() == 1 && bleKeyboard.pressHistory[0] == 'a');
  setMillis(1400); processDeferredKeys(1400);
  assert(bleKeyboard.pressHistory.size() == 1);       // kein zweites, umgeschaltetes Zeichen
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1500);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_auto_shift_held_modifier_or_shift_disables_it) {
  resetState();
  autoShift = 1;
  KEYMAP[0][2][0] = KEY_LEFT_GUI;
  KEYMAP[0][2][1] = 'z';
  setMillis(1000);
  keyState[2][0] = true; onMatrixKeyChange(2, 0, true, 1000);
  setMillis(1050);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1050);
  assert(countPresses('z') == 1);                     // Cmd+Z: sofort, ohne Wartezeit
  setMillis(1400); processDeferredKeys(1400);
  assert(countPresses('Z') == 0 && countPresses('z') == 1);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1450);
  keyState[2][0] = false; onMatrixKeyChange(2, 0, false, 1500);
  assert(bleKeyboard.pressedKeys.empty());
  // Gehaltenes Shift: kein zweites Shift durch Auto Shift
  resetState();
  autoShift = 1;
  KEYMAP[0][2][0] = KEY_LEFT_SHIFT;
  KEYMAP[0][2][1] = 'a';
  setMillis(1000);
  keyState[2][0] = true; onMatrixKeyChange(2, 0, true, 1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1010);
  assert(countPresses('a') == 1);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1500);
  keyState[2][0] = false; onMatrixKeyChange(2, 0, false, 1510);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_auto_shift_with_mod_tap_in_every_hold_tap_mode_and_chordal) {
  for (uint8_t mode = 0; mode <= 2; mode++) {
    for (uint8_t chordal = 0; chordal <= 1; chordal++) {
      resetState();
      autoShift = 1;
      holdTapMode = mode;
      chordalHold = chordal;
      KEYMAP[0][2][1] = 'a';
      HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
      KEYMAP[0][2][2] = 'b';
      setMillis(1000);
      keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
      setMillis(1050);
      keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1050);
      setMillis(1150);
      keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1150);   // 'b' kürzer als das Zeitlimit gehalten
      setMillis(1300); processDeferredKeys(1300);
      keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1340);
      processDeferredKeys(1400);
      // Das gepufferte 'b' ist nicht umgeschaltet, kein hängender Druck
      assert(countPresses('b') == 1);
      assert(countPresses('B') == 0);
      assert(bleKeyboard.pressedKeys.empty());
    }
  }
}

TEST(test_auto_shift_keeps_layer_of_the_press) {
  resetState();
  autoShift = 1;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[1][2][1] = 'x';
  KEYMAP[0][2][2] = ACT_MO_BASE + 1;
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  keyState[2][2] = true; onMatrixKeyChange(2, 2, true, 1010);   // Ebene 1 aktiv, während 'a' wartet
  setMillis(1300); processDeferredKeys(1300);
  assert(countPresses('A') == 1 || countPresses('a') == 1);     // die Ebene des Drucks gilt, nicht 'x'
  assert(countPresses('x') == 0 && countPresses('X') == 0);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1400);
  keyState[2][2] = false; onMatrixKeyChange(2, 2, false, 1410);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_auto_shift_is_off_during_leader_capture) {
  resetState();
  autoShift = 1;
  KEYMAP[0][2][1] = 'a';
  leaderState.start(1000);
  setMillis(1000);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true, 1000);
  assert(!anyDoubleTapWaiting());                     // kein Warten: die Leader-Erfassung sieht 'a' sofort
  setMillis(1400); processDeferredKeys(1400);
  assert(countPresses('A') == 0);
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false, 1450);
}

TEST(test_auto_shift_command_nvs_and_info) {
  resetState();
  handleConfigCommand("SET_AUTO_SHIFT 5", false);
  assert(mockChar.value == "ERR ARGS SET_AUTO_SHIFT 5");
  handleConfigCommand("SET_AUTO_SHIFT 12", false);
  assert(mockChar.value == "ERR ARGS SET_AUTO_SHIFT 12");
  handleConfigCommand("SET_AUTO_SHIFT 4", false);
  assert(mockChar.value == "OK SET_AUTO_SHIFT 4" && autoShift == 4);
  handleConfigCommand("SET_AUTO_SHIFT 1", false);
  assert(mockChar.value == "OK SET_AUTO_SHIFT 1");
  assert(autoShift == 1);
  handleConfigCommand("SET_AUTO_SHIFT_TERM 49", false);
  assert(mockChar.value == "ERR ARGS SET_AUTO_SHIFT_TERM 49");
  handleConfigCommand("SET_AUTO_SHIFT_TERM 501", false);
  assert(mockChar.value == "ERR ARGS SET_AUTO_SHIFT_TERM 501");
  handleConfigCommand("SET_AUTO_SHIFT_TERM abc", false);
  assert(mockChar.value == "ERR ARGS SET_AUTO_SHIFT_TERM abc");
  assert(autoShiftMs == 175);
  handleConfigCommand("SET_AUTO_SHIFT_TERM 220", false);
  assert(mockChar.value == "OK SET_AUTO_SHIFT_TERM 220");
  assert(autoShiftMs == 220);
  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.find("\"as\":1") != std::string::npos);
  assert(mockChar.value.find("\"at\":220") != std::string::npos);
  autoShift = 0; autoShiftMs = 175;
  loadKeymapFromNVS();
  assert(autoShift == 1 && autoShiftMs == 220);
  Preferences::uintStore["auto_shift"] = 5;           // außerhalb des Bereichs
  autoShift = 0;
  loadKeymapFromNVS();
  assert(autoShift == 0);
  Preferences::uintStore["auto_shift_ms"] = 9999;     // außerhalb des Bereichs
  autoShiftMs = 175;
  loadKeymapFromNVS();
  assert(autoShiftMs == 175);
}


// -----------------------------------------------------------------------------
// HID-Reports: horizontales Scrollen (AC Pan) und macOS-Systemtasten (24-Bit-Consumer-Report)
// -----------------------------------------------------------------------------
// Liefert die Items ab dem Report-ID-Item `reportId` bis zum Ende der umgebenden Application-Collection
// (Mouse: einschließlich der Physical-Collection). Items werden mit Präfix und Datenbytes zurückgegeben.
static std::vector<uint8_t> descriptorSection(uint8_t reportId) {
  std::vector<uint8_t> out;
  const uint8_t *d = _compositeReportDescriptor;
  size_t n = sizeof(_compositeReportDescriptor);
  bool in = false;
  int depth = 0;
  for (size_t i = 0; i < n;) {
    uint8_t b = d[i];
    size_t len = (b & 0x03) == 3 ? 4 : (b & 0x03);
    if (b == REPORT_ID(1) && d[i + 1] == reportId) in = true;
    if (in && b == END_COLLECTION(0) && depth-- <= 0) break;
    if (b == COLLECTION(1) && in) depth++;
    if (in) out.insert(out.end(), d + i, d + i + 1 + len);
    i += 1 + len;
  }
  return out;
}

static bool containsBytes(const std::vector<uint8_t> &hay, std::initializer_list<uint8_t> needle) {
  return std::search(hay.begin(), hay.end(), needle.begin(), needle.end()) != hay.end();
}

TEST(test_consumer_descriptor_is_24_bit_with_new_system_usages) {
  std::vector<uint8_t> sec = descriptorSection(MEDIA_KEYS_ID);
  assert(!sec.empty());
  // 20 Usages einzeln, dazu 4 Bit Padding: der Report ist 24 Bit breit
  assert(containsBytes(sec, {REPORT_COUNT(1), 0x14}));
  assert(containsBytes(sec, {REPORT_SIZE(1), 0x04}));
  assert(MEDIA_REPORT_SIZE == 3);
  assert(sizeof(MediaKeyReport) == 3);
  // Item für Item zählen, damit Datenbytes nicht als Präfix gelten
  size_t usages = 0;
  for (size_t i = 0; i < sec.size();) {
    uint8_t b = sec[i];
    if (b == USAGE(1) || b == USAGE(2)) usages++;
    i += 1 + ((b & 0x03) == 3 ? 4 : (b & 0x03));
  }
  assert(usages == 20);
  // Reihenfolge = Bitposition: bisherige 16 Usages zuerst, danach die vier neuen
  assert(containsBytes(sec, {USAGE(2), 0x8A, 0x01, USAGE(1), 0x6F, USAGE(1), 0x70,
                              USAGE(2), 0x9F, 0x02, USAGE(2), 0xA2, 0x02, HIDINPUT(1), 0x02}));
  // Das Padding folgt als Konstante
  assert(containsBytes(sec, {REPORT_COUNT(1), 0x01, REPORT_SIZE(1), 0x04, HIDINPUT(1), 0x01}));
}

TEST(test_consumer_bits_of_new_keys_and_existing_keys_keep_theirs) {
  // Bestehende Tasten behalten ihre Bits
  assert(mediaBits(KEY_MEDIA_NEXT_TRACK) == 0x000001);
  assert(mediaBits(KEY_MEDIA_PREVIOUS_TRACK) == 0x000002);
  assert(mediaBits(KEY_MEDIA_STOP) == 0x000004);
  assert(mediaBits(KEY_MEDIA_PLAY_PAUSE) == 0x000008);
  assert(mediaBits(KEY_MEDIA_MUTE) == 0x000010);
  assert(mediaBits(KEY_MEDIA_VOLUME_UP) == 0x000020);
  assert(mediaBits(KEY_MEDIA_VOLUME_DOWN) == 0x000040);
  assert(mediaBits(KEY_MEDIA_GLOBE) == 0x000400);
  // Neue Tasten belegen die Bits 16..19
  assert(mediaBits(KEY_MEDIA_BRIGHTNESS_UP) == 0x010000);
  assert(mediaBits(KEY_MEDIA_BRIGHTNESS_DOWN) == 0x020000);
  assert(mediaBits(KEY_MEDIA_MISSION_CONTROL) == 0x040000);
  assert(mediaBits(KEY_MEDIA_LAUNCHPAD) == 0x080000);
  // Report-Bytes: Byte 2 trägt die neuen Bits, die Padding-Bits bleiben 0
  uint8_t r[MEDIA_REPORT_SIZE];
  dactylBuildMediaReport(r, 0x0F0400 | 0xF00000);
  assert(r[0] == 0x00 && r[1] == 0x04 && r[2] == 0x0F);
  dactylBuildMediaReport(r, mediaBits(KEY_MEDIA_BRIGHTNESS_UP));
  assert(r[0] == 0 && r[1] == 0 && r[2] == 0x01);
  dactylBuildMediaReport(r, mediaBits(KEY_MEDIA_LAUNCHPAD));
  assert(r[0] == 0 && r[1] == 0 && r[2] == 0x08);
  // Die vier Tasten und Globe sind verschieden
  uint32_t all = 0;
  const MediaKeyReport *keys[] = {&KEY_MEDIA_NEXT_TRACK, &KEY_MEDIA_PREVIOUS_TRACK, &KEY_MEDIA_STOP, &KEY_MEDIA_PLAY_PAUSE,
    &KEY_MEDIA_MUTE, &KEY_MEDIA_VOLUME_UP, &KEY_MEDIA_VOLUME_DOWN, &KEY_MEDIA_GLOBE, &KEY_MEDIA_BRIGHTNESS_UP,
    &KEY_MEDIA_BRIGHTNESS_DOWN, &KEY_MEDIA_MISSION_CONTROL, &KEY_MEDIA_LAUNCHPAD};
  for (const MediaKeyReport *k : keys) { assert((all & mediaBits(*k)) == 0); all |= mediaBits(*k); }
}

TEST(test_system_keys_send_their_consumer_report) {
  resetState();
  const struct { uint16_t act; const uint8_t *key; } cases[] = {
    {ACT_MEDIA_BRIGHTNESS_UP, KEY_MEDIA_BRIGHTNESS_UP}, {ACT_MEDIA_BRIGHTNESS_DOWN, KEY_MEDIA_BRIGHTNESS_DOWN},
    {ACT_MEDIA_MISSION_CONTROL, KEY_MEDIA_MISSION_CONTROL}, {ACT_MEDIA_LAUNCHPAD, KEY_MEDIA_LAUNCHPAD},
  };
  for (auto &cs : cases) {
    bleKeyboard.releaseAll();
    KEYMAP[0][2][1] = cs.act;
    setMillis(1000);
    onMatrixKeyChange(2, 1, true);
    assert(bleKeyboard.writtenMediaKeys.size() == 1 && bleKeyboard.writtenMediaKeys[0] == mediaBits(cs.key));
    onMatrixKeyChange(2, 1, false);
  }
  assert(ACT_MEDIA_BRIGHTNESS_UP == 0x128 && ACT_MEDIA_BRIGHTNESS_DOWN == 0x129);
  assert(ACT_MEDIA_MISSION_CONTROL == 0x12A && ACT_MEDIA_LAUNCHPAD == 0x12B);
  // Ohne Host sendet die Taste nichts
  bleKeyboard.releaseAll();
  bleKeyboard.connected = false;
  KEYMAP[0][2][1] = ACT_MEDIA_LAUNCHPAD;
  onMatrixKeyChange(2, 1, true);
  onMatrixKeyChange(2, 1, false);
  bleKeyboard.connected = true;
  assert(bleKeyboard.writtenMediaKeys.empty());
}

TEST(test_key_pairs_accept_new_system_and_pan_codes) {
  resetState();
  assert(isValidKeyPairMemberCode(ACT_MEDIA_BRIGHTNESS_UP) && isValidKeyPairMemberCode(ACT_MEDIA_BRIGHTNESS_DOWN));
  assert(isValidKeyPairMemberCode(ACT_MEDIA_MISSION_CONTROL) && isValidKeyPairMemberCode(ACT_MEDIA_LAUNCHPAD));
  assert(isValidKeyPairMemberCode(ACT_MOUSE_WHEEL_LEFT) && isValidKeyPairMemberCode(ACT_MOUSE_WHEEL_RIGHT));
  assert(!isValidKeyPairMemberCode(0x12C) && !isValidKeyPairMemberCode(0x13B));
  handleConfigCommand("ADD_PAIR 129 298", false); // Shift + Mission Control (0x12A)
  assert(mockChar.value == "OK ADD_PAIR 0");
  handleConfigCommand("ADD_PAIR 299 296", false); // Launchpad (0x12B) + Helligkeit + (0x128)
  assert(mockChar.value == "OK ADD_PAIR 1");
  handleConfigCommand("ADD_PAIR 128 313", false); // Ctrl + Pan links (0x139)
  assert(mockChar.value == "OK ADD_PAIR 2");
  handleConfigCommand("ADD_PAIR 128 300", false); // 0x12C ist keine Aktion
  assert(mockChar.value == "ERR ARGS ADD_PAIR 128 300");

  KEYMAP[0][2][1] = ACT_KEY_PAIR_BASE + 0;
  KEYMAP[0][2][2] = ACT_KEY_PAIR_BASE + 1;
  KEYMAP[0][2][3] = ACT_KEY_PAIR_BASE + 2;
  setMillis(1000);
  onMatrixKeyChange(2, 1, true);
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == 129);
  assert(bleKeyboard.pressedMediaKeys.size() == 1 && bleKeyboard.pressedMediaKeys[0] == mediaBits(KEY_MEDIA_MISSION_CONTROL));
  onMatrixKeyChange(2, 1, false);
  assert(bleKeyboard.pressedKeys.empty() && bleKeyboard.pressedMediaKeys.empty());

  onMatrixKeyChange(2, 2, true);
  assert(bleKeyboard.pressedMediaKeys.size() == 2);
  assert(bleKeyboard.pressedMediaKeys[0] == mediaBits(KEY_MEDIA_LAUNCHPAD));
  assert(bleKeyboard.pressedMediaKeys[1] == mediaBits(KEY_MEDIA_BRIGHTNESS_UP));
  onMatrixKeyChange(2, 2, false);
  assert(bleKeyboard.pressedMediaKeys.empty());

  onMatrixKeyChange(2, 3, true);
  assert(bleKeyboard.pressedKeys.size() == 1 && bleKeyboard.pressedKeys[0] == 128);
  assert(bleKeyboard.mousePans.size() == 1 && bleKeyboard.mousePans[0] == -1);
  onMatrixKeyChange(2, 3, false);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_macros_accept_system_keys_as_steps) {
  resetState();
  // Consumer-Aktion: code 0, Aktion in ms
  assert(isValidMacroStep(MACRO_STEP_TAP, 0, ACT_MEDIA_MISSION_CONTROL));
  assert(isValidMacroStep(MACRO_STEP_DOWN, 0, ACT_MEDIA_BRIGHTNESS_UP));
  assert(isValidMacroStep(MACRO_STEP_UP, 0, ACT_MEDIA_LAUNCHPAD));
  assert(isValidMacroStep(MACRO_STEP_TAP, 0, ACT_MAC_GLOBE));
  assert(!isValidMacroStep(MACRO_STEP_TAP, 0, 0));
  assert(!isValidMacroStep(MACRO_STEP_TAP, 0, 0x12C));
  assert(!isValidMacroStep(MACRO_STEP_TAP, 0, ACT_MOUSE_LEFT));
  assert(!isValidMacroStep(MACRO_STEP_TAP, 97, ACT_MEDIA_LAUNCHPAD));  // Tastencode und Aktion nie zusammen
  assert(!isValidMacroStep(MACRO_STEP_PAUSE, 0, 0));
  handleConfigCommand("ADD_MACRO", false);
  handleConfigCommand("ADD_MACRO_STEP 1 0 298", false); // TAP Mission Control
  assert(mockChar.value == "OK ADD_MACRO_STEP 0 0");
  handleConfigCommand("ADD_MACRO_STEP 2 0 296", false); // DOWN Helligkeit +
  handleConfigCommand("ADD_MACRO_STEP 4 0 20", false);
  handleConfigCommand("ADD_MACRO_STEP 3 0 296", false); // UP Helligkeit +
  assert(mockChar.value == "OK ADD_MACRO_STEP 0 3");
  handleConfigCommand("ADD_MACRO_STEP 1 0 300", false);
  assert(mockChar.value == "ERR ARGS ADD_MACRO_STEP 1 0 300");

  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
  setMillis(1000);
  onMatrixKeyChange(2, 1, true);
  unsigned long t = 1000;
  for (int i = 0; i < 40; i++) { t += 10; setMillis(t); processDeferredKeys(t); }
  onMatrixKeyChange(2, 1, false);
  // TAP: Druck und Loslassen; DOWN/UP desgleichen; nichts bleibt gedrückt
  assert(bleKeyboard.pressedMediaKeys.empty());
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_macro_stop_releases_held_system_key) {
  resetState();
  handleConfigCommand("ADD_MACRO", false);
  handleConfigCommand("ADD_MACRO_STEP 2 0 299", false); // DOWN Launchpad
  handleConfigCommand("ADD_MACRO_STEP 4 0 1000", false);
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
  setMillis(1000);
  onMatrixKeyChange(2, 1, true);
  assert(macroRun.active);
  assert(bleKeyboard.pressedMediaKeys.size() == 1 && bleKeyboard.pressedMediaKeys[0] == mediaBits(KEY_MEDIA_LAUNCHPAD));
  stopMacro(true);
  assert(bleKeyboard.pressedMediaKeys.empty());
}

TEST(test_mouse_descriptor_has_ac_pan_and_report_bytes) {
  std::vector<uint8_t> sec = descriptorSection(MOUSE_ID);
  assert(!sec.empty());
  // AC Pan (0x0238) auf der Consumer-Seite, ein Byte relativ, nach X, Y und Wheel
  assert(containsBytes(sec, {USAGE(1), 0x38, LOGICAL_MINIMUM(1), 0x81, LOGICAL_MAXIMUM(1), 0x7F, REPORT_SIZE(1), 0x08,
                             REPORT_COUNT(1), 0x03, HIDINPUT(1), 0x06, USAGE_PAGE(1), 0x0C, USAGE(2), 0x38, 0x02,
                             LOGICAL_MINIMUM(1), 0x81, LOGICAL_MAXIMUM(1), 0x7F, REPORT_SIZE(1), 0x08,
                             REPORT_COUNT(1), 0x01, HIDINPUT(1), 0x06}));
  assert(MOUSE_REPORT_SIZE == 5);
  uint8_t m[MOUSE_REPORT_SIZE];
  dactylBuildMouseReport(m, 0x05, 3, -4, 1, 0);
  assert(m[0] == 0x05 && m[1] == 3 && m[2] == 0xFC && m[3] == 1 && m[4] == 0);
  dactylBuildMouseReport(m, 0, 0, 0, 0, 1);  // Pan rechts
  assert(m[0] == 0 && m[1] == 0 && m[2] == 0 && m[3] == 0 && m[4] == 1);
  dactylBuildMouseReport(m, 0, 0, 0, 0, -1); // Pan links
  assert(m[4] == 0xFF && m[3] == 0);
}

TEST(test_wheel_left_right_send_a_pan_step_at_press) {
  resetState();
  KEYMAP[0][2][1] = ACT_MOUSE_WHEEL_LEFT;
  KEYMAP[0][2][2] = ACT_MOUSE_WHEEL_RIGHT;
  assert(ACT_MOUSE_WHEEL_LEFT == 0x139 && ACT_MOUSE_WHEEL_RIGHT == 0x13A);
  setMillis(1000);
  onMatrixKeyChange(2, 1, true);
  assert(bleKeyboard.mousePans.size() == 1 && bleKeyboard.mousePans[0] == -1);
  assert(bleKeyboard.mouseScrolls.empty());
  onMatrixKeyChange(2, 1, false);
  onMatrixKeyChange(2, 2, true);
  assert(bleKeyboard.mousePans.size() == 2 && bleKeyboard.mousePans[1] == 1);
  onMatrixKeyChange(2, 2, false);
  assert(bleKeyboard.mousePans.size() == 2 && bleKeyboard.mouseScrolls.empty());
}

TEST(test_held_wheel_key_repeats_with_acceleration_and_stops_at_release) {
  resetState();
  KEYMAP[0][2][1] = ACT_MOUSE_WHEEL_UP;
  KEYMAP[0][2][2] = ACT_MOUSE_WHEEL_RIGHT;
  setMillis(1000);
  applyMatrixKeyChange(2, 1, true, 1000);
  assert(bleKeyboard.mouseScrolls.size() == 1 && bleKeyboard.mouseScrolls[0] == 1);
  // Vor Ablauf der Verzögerung wiederholt nichts
  processDeferredKeys(1000 + WHEEL_REPEAT_DELAY_MS - 10);
  assert(bleKeyboard.mouseScrolls.size() == 1);
  processDeferredKeys(1000 + WHEEL_REPEAT_DELAY_MS);
  assert(bleKeyboard.mouseScrolls.size() == 2 && bleKeyboard.mouseScrolls[1] == 1);
  // Der Abstand zwischen zwei Schritten ist WHEEL_REPEAT_INTERVAL_MS
  processDeferredKeys(1000 + WHEEL_REPEAT_DELAY_MS + WHEEL_REPEAT_INTERVAL_MS - 1);
  assert(bleKeyboard.mouseScrolls.size() == 2);
  processDeferredKeys(1000 + WHEEL_REPEAT_DELAY_MS + WHEEL_REPEAT_INTERVAL_MS);
  assert(bleKeyboard.mouseScrolls.size() == 3);
  // Der Schritt wächst mit der Haltezeit und endet bei WHEEL_MAX_STEP
  processDeferredKeys(1000 + WHEEL_REPEAT_DELAY_MS + WHEEL_ACCEL_MS);
  assert(bleKeyboard.mouseScrolls.back() == 2);
  processDeferredKeys(1000 + WHEEL_REPEAT_DELAY_MS + 3 * WHEEL_ACCEL_MS);
  assert(bleKeyboard.mouseScrolls.back() == 4);
  processDeferredKeys(1000 + WHEEL_REPEAT_DELAY_MS + 100 * WHEEL_ACCEL_MS);
  assert(bleKeyboard.mouseScrolls.back() == WHEEL_MAX_STEP);
  assert(bleKeyboard.mousePans.empty());
  // Loslassen stoppt sofort
  applyMatrixKeyChange(2, 1, false, 60000);
  size_t n = bleKeyboard.mouseScrolls.size();
  processDeferredKeys(61000);
  processDeferredKeys(62000);
  assert(bleKeyboard.mouseScrolls.size() == n);
  // Pan wiederholt wie das Mausrad, in seine Richtung
  bleKeyboard.mousePans.clear();
  setMillis(70000);
  applyMatrixKeyChange(2, 2, true, 70000);
  assert(bleKeyboard.mousePans.size() == 1 && bleKeyboard.mousePans[0] == 1);
  processDeferredKeys(70000 + WHEEL_REPEAT_DELAY_MS);
  processDeferredKeys(70000 + WHEEL_REPEAT_DELAY_MS + WHEEL_ACCEL_MS);
  assert(bleKeyboard.mousePans.size() == 3 && bleKeyboard.mousePans[1] == 1 && bleKeyboard.mousePans[2] == 2);
  applyMatrixKeyChange(2, 2, false, 71000);
  n = bleKeyboard.mousePans.size();
  processDeferredKeys(72000);
  assert(bleKeyboard.mousePans.size() == n);
}

TEST(test_wheel_stepFor_is_monotonic_and_capped) {
  assert(wheelStepFor(0) == 1);
  assert(wheelStepFor(WHEEL_REPEAT_DELAY_MS) == 1);
  int8_t last = 1;
  for (unsigned long ms = 0; ms < 20000; ms += 50) {
    int8_t st = wheelStepFor(ms);
    assert(st >= last && st >= 1 && st <= WHEEL_MAX_STEP);
    last = st;
  }
  assert(wheelStepFor(100000) == WHEEL_MAX_STEP);
}

TEST(test_held_wheel_key_pauses_without_host_and_restarts_acceleration) {
  resetState();
  KEYMAP[0][2][1] = ACT_MOUSE_WHEEL_DOWN;
  setMillis(1000);
  applyMatrixKeyChange(2, 1, true, 1000);
  processDeferredKeys(1000 + WHEEL_REPEAT_DELAY_MS + 5 * WHEEL_ACCEL_MS);
  assert(bleKeyboard.mouseScrolls.back() == 6 * -1 || bleKeyboard.mouseScrolls.back() <= -1);
  bleKeyboard.mouseScrolls.clear();
  bleKeyboard.connected = false;
  processDeferredKeys(10000);
  processDeferredKeys(11000);
  assert(bleKeyboard.mouseScrolls.empty());
  bleKeyboard.connected = true;
  processDeferredKeys(11010);
  assert(bleKeyboard.mouseScrolls.empty()); // Verzögerung beginnt neu
  processDeferredKeys(11010 + WHEEL_REPEAT_DELAY_MS + 50);
  assert(bleKeyboard.mouseScrolls.size() == 1 && bleKeyboard.mouseScrolls[0] == -1);
  applyMatrixKeyChange(2, 1, false, 12000);
}

TEST(test_wheel_hold_is_cleared_by_reset_and_by_combo) {
  resetState();
  KEYMAP[0][2][1] = ACT_MOUSE_WHEEL_LEFT;
  setMillis(1000);
  applyMatrixKeyChange(2, 1, true, 1000);
  assert(wheelActive[2][1]);
  resetMouseMove();
  assert(!wheelActive[2][1]);
  bleKeyboard.mousePans.clear();
  processDeferredKeys(5000);
  assert(bleKeyboard.mousePans.empty());
}

TEST(test_wheel_and_system_keys_are_repeatable_and_have_alt_repeat) {
  assert(isRepeatableAction(ACT_MOUSE_WHEEL_LEFT) && isRepeatableAction(ACT_MOUSE_WHEEL_RIGHT));
  assert(isRepeatableAction(ACT_MEDIA_BRIGHTNESS_UP) && isRepeatableAction(ACT_MEDIA_LAUNCHPAD));
  assert(altRepeatAction(ACT_MOUSE_WHEEL_LEFT) == ACT_MOUSE_WHEEL_RIGHT);
  assert(altRepeatAction(ACT_MOUSE_WHEEL_RIGHT) == ACT_MOUSE_WHEEL_LEFT);
  assert(altRepeatAction(ACT_MEDIA_BRIGHTNESS_UP) == ACT_MEDIA_BRIGHTNESS_DOWN);
  assert(altRepeatAction(ACT_MEDIA_BRIGHTNESS_DOWN) == ACT_MEDIA_BRIGHTNESS_UP);
  assert(altRepeatAction(ACT_MEDIA_MISSION_CONTROL) == 0);
  resetState();
  KEYMAP[0][2][1] = ACT_MEDIA_MISSION_CONTROL;
  setMillis(1000);
  onMatrixKeyChange(2, 1, true);
  onMatrixKeyChange(2, 1, false);
  bleKeyboard.writtenMediaKeys.clear();
  repeatPress(lastRepeatAction);
  assert(bleKeyboard.writtenMediaKeys.size() == 1 && bleKeyboard.writtenMediaKeys[0] == mediaBits(KEY_MEDIA_MISSION_CONTROL));
  bleKeyboard.mousePans.clear();
  repeatPress(ACT_MOUSE_WHEEL_LEFT);
  assert(bleKeyboard.mousePans.size() == 1 && bleKeyboard.mousePans[0] == -1);
}

TEST(test_wheel_key_as_hold_action_repeats_and_stops_at_release) {
  resetState();
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = ACT_MOUSE_WHEEL_RIGHT;
  setMillis(1000);
  applyMatrixKeyChange(2, 1, true, 1000);
  processDeferredKeys(1000 + 400);              // über dem Tapping-Term: die Halte-Aktion greift
  assert(!bleKeyboard.mousePans.empty() && bleKeyboard.mousePans[0] == 1);
  size_t n = bleKeyboard.mousePans.size();
  processDeferredKeys(1000 + 400 + WHEEL_REPEAT_DELAY_MS + WHEEL_REPEAT_INTERVAL_MS);
  assert(bleKeyboard.mousePans.size() > n);
  applyMatrixKeyChange(2, 1, false, 3000);
  n = bleKeyboard.mousePans.size();
  processDeferredKeys(4000);
  assert(bleKeyboard.mousePans.size() == n);
  assert(!wheelActive[2][1]);
  assert(bleKeyboard.mouseScrolls.empty());
}

TEST(test_fw_version_increased_for_report_map_change) {
  assert(DACTYL_FW_VERSION >= 28);
}

// -----------------------------------------------------------------------------
// Key lock (ACT_KEY_LOCK)
// -----------------------------------------------------------------------------
static void klTap(uint8_t r, uint8_t c) { pressKey(r, c); releaseKey(r, c); }

TEST(test_key_lock_keeps_mouse_button_held_and_second_press_releases) {
  resetState();
  KEYMAP[0][0][0] = ACT_KEY_LOCK;
  KEYMAP[0][2][1] = ACT_MOUSE_LEFT;
  klTap(0, 0);                                           // vormerken, sendet nichts
  assert(bleKeyboard.mouseButtons == 0 && bleKeyboard.pressedKeys.empty() && bleKeyboard.pressHistory.empty());
  pressKey(2, 1);
  assert(bleKeyboard.mouseButtons == MOUSE_BUTTON_LEFT);
  releaseKey(2, 1);
  assert(bleKeyboard.mouseButtons == MOUSE_BUTTON_LEFT); // gesperrt: bleibt nach dem Loslassen gehalten
  pressKey(2, 1);                                        // zweiter Druck löst
  assert(bleKeyboard.mouseButtons == 0);
  releaseKey(2, 1);
  assert(bleKeyboard.mouseButtons == 0);
  // Danach wirkt die Taste wieder normal und die Vormerkung ist verbraucht
  pressKey(2, 1);
  assert(bleKeyboard.mouseButtons == MOUSE_BUTTON_LEFT);
  releaseKey(2, 1);
  assert(bleKeyboard.mouseButtons == 0);
}

TEST(test_key_lock_keeps_key_held_across_halves_and_second_press_releases) {
  resetState();
  KEYMAP[0][0][0] = ACT_KEY_LOCK;
  KEYMAP[0][2][1] = KEY_LEFT_SHIFT;
  KEYMAP[0][2][2] = 'a';
  klTap(0, 0);
  pressKey(2, 1);
  releaseKey(2, 1);
  assert(std::count(bleKeyboard.pressedKeys.begin(), bleKeyboard.pressedKeys.end(), KEY_LEFT_SHIFT) == 1);
  klTap(2, 2);                                            // die nächste Taste ist nicht gesperrt
  assert(std::count(bleKeyboard.pressedKeys.begin(), bleKeyboard.pressedKeys.end(), 'a') == 0);
  pressKey(2, 1);                                         // zweiter Druck
  releaseKey(2, 1);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_key_lock_locks_only_the_next_input) {
  resetState();
  KEYMAP[0][0][0] = ACT_KEY_LOCK;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][2] = 'b';
  klTap(0, 0);
  pressKey(2, 1);
  pressKey(2, 2);
  releaseKey(2, 2);
  releaseKey(2, 1);
  assert(std::count(bleKeyboard.pressedKeys.begin(), bleKeyboard.pressedKeys.end(), 'a') == 1);
  assert(std::count(bleKeyboard.pressedKeys.begin(), bleKeyboard.pressedKeys.end(), 'b') == 0);
}

TEST(test_key_lock_does_not_lock_layer_keys_itself_or_macros) {
  resetState();
  KEYMAP[0][0][0] = ACT_KEY_LOCK;
  KEYMAP[0][1][0] = ACT_MO_1;
  KEYMAP[0][1][1] = ACT_KEY_LOCK;
  klTap(0, 0);
  pressKey(1, 0);                                         // Ebene: nicht gesperrt, die Vormerkung bleibt
  assert(getActiveLayer() == 1);
  releaseKey(1, 0);
  assert(getActiveLayer() == 0);                          // Ebene wieder gelöst
  klTap(1, 1);                                            // KEY_LOCK selbst sperrt sich nicht
  KEYMAP[0][2][1] = ACT_MOUSE_LEFT;
  pressKey(2, 1);
  releaseKey(2, 1);
  assert(bleKeyboard.mouseButtons == MOUSE_BUTTON_LEFT);  // die Vormerkung galt noch für die nächste echte Eingabe
  // Makro: seine Schritte sind nicht gesperrt
  resetState();
  KEYMAP[0][0][0] = ACT_KEY_LOCK;
  KEYMAP[0][2][1] = ACT_MACRO_BASE;
  userMacros[0][0] = { MACRO_STEP_TAP, 'x', 0 };
  macroLengths[0] = 1;
  numMacros = 1;
  setMillis(1000);
  klTap(0, 0);
  pressKey(2, 1);
  releaseKey(2, 1);
  for (int i = 0; i < 6; i++) { setMillis(1000 + 50 * (i + 1)); macroTick(millis()); }
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_key_lock_is_released_by_release_all_and_host_loss) {
  resetState();
  KEYMAP[0][0][0] = ACT_KEY_LOCK;
  KEYMAP[0][2][1] = ACT_MOUSE_LEFT;
  klTap(0, 0);
  klTap(2, 1);
  assert(bleKeyboard.mouseButtons == MOUSE_BUTTON_LEFT);
  bleKeyboard.releaseAll();
  assert(bleKeyboard.mouseButtons == 0);
  klTap(2, 1);                                            // die Sperre ist weg, die Vormerkung auch
  assert(bleKeyboard.mouseButtons == 0);
}

TEST(test_key_lock_is_released_by_standby_and_release_all) {
  resetState();
  KEYMAP[0][0][0] = ACT_KEY_LOCK;
  KEYMAP[0][2][1] = 'a';
  klTap(0, 0);
  klTap(2, 1);
  assert(std::count(bleKeyboard.pressedKeys.begin(), bleKeyboard.pressedKeys.end(), 'a') == 1);
  keyLockReleaseAll();                                    // Standby
  assert(bleKeyboard.pressedKeys.empty());
  klTap(0, 0);
  klTap(2, 1);
  assert(bleKeyboard.pressedKeys.size() == 1);
  bleKeyboard.releaseAll();                               // Config Mode ruft releaseAll() (dactyl_right.ino)
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_key_lock_without_host_arms_nothing) {
  resetState();
  KEYMAP[0][0][0] = ACT_KEY_LOCK;
  KEYMAP[0][2][1] = 'a';
  bleKeyboard.connected = false;
  klTap(0, 0);
  bleKeyboard.connected = true;
  klTap(2, 1);
  assert(bleKeyboard.pressedKeys.empty());                // normaler Tipp, nichts gesperrt
}

TEST(test_key_lock_is_no_combo_action_and_not_repeatable) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 0 2 1 0 367", false);  // ACT_KEY_LOCK
  assert(numCombos == 0);
  assert(!isRepeatableAction(ACT_KEY_LOCK));
}

TEST(test_key_lock_as_combo_candidate_arms_only_on_quick_tap) {
  resetState();
  numCombos = 1;
  userCombos[0] = { 2, 1, 2, 2, 0, (uint16_t)'x' };
  KEYMAP[0][2][1] = ACT_KEY_LOCK;
  KEYMAP[0][2][2] = 'k';
  KEYMAP[0][3][0] = ACT_MOUSE_LEFT;
  setMillis(1000);
  pressKey(2, 1, true);
  pressKey(2, 2, true);
  checkUserCombos();                                      // die Combo verbraucht beide Tasten
  pressKey(2, 1, false);
  pressKey(2, 2, false);
  checkUserCombos();
  numCombos = 0;
  setMillis(2000);
  pressKey(3, 0, true);
  pressKey(3, 0, false);
  assert(bleKeyboard.mouseButtons == 0);                  // keine Vormerkung zurückgeblieben
}

// -----------------------------------------------------------------------------
// BLE-Host-Slots (ACT_HOST_1 .. ACT_HOST_3)
// -----------------------------------------------------------------------------
TEST(test_ble_host_address_per_slot_is_static_random_and_distinct) {
  const uint8_t base[6] = {0x2E, 0xBC, 0xBB, 0x81, 0x61, 0xA8};
  uint8_t a[BLE_HOST_SLOTS + 1][6];
  for (int s = 1; s <= BLE_HOST_SLOTS; s++) {
    assert(bleHostAddress(base, s, a[s]));
    assert((a[s][0] & 0xC0) == 0xC0);                       // statische Random-Adresse: oberste Bits 11b
    uint8_t again[6];
    assert(bleHostAddress(base, s, again) && memcmp(again, a[s], 6) == 0);   // deterministisch
  }
  for (int i = 1; i <= BLE_HOST_SLOTS; i++)
    for (int j = i + 1; j <= BLE_HOST_SLOTS; j++) assert(memcmp(a[i], a[j], 6) != 0);
  // Die Adresse des Config Mode (DactylConfigBle.h) fällt mit keinem Slot zusammen
  uint8_t cfgAddr[6];
  memcpy(cfgAddr, base, 6);
  cfgAddr[0] |= 0xC0; cfgAddr[5] |= 0xC0; cfgAddr[4] ^= 0x55;
  for (int s = 1; s <= BLE_HOST_SLOTS; s++) assert(memcmp(cfgAddr, a[s], 6) != 0);
  uint8_t bad[6];
  assert(!bleHostAddress(base, 0, bad) && !bleHostAddress(base, BLE_HOST_SLOTS + 1, bad));
}

TEST(test_ble_host_slot_persists_in_nvs_and_defaults_to_one) {
  resetState();
  loadBleHostFromNVS();
  assert(bleHostSlot == 1);                                   // ohne Schlüssel Slot 1
  assert(saveBleHostToNVS(3));
  assert(Preferences::uintStore["ble_host"] == 3);
  bleHostSlot = 1;
  loadBleHostFromNVS();
  assert(bleHostSlot == 3);
  Preferences::uintStore["ble_host"] = 9;                     // ungültiger Wert fällt auf Slot 1 zurück
  loadBleHostFromNVS();
  assert(bleHostSlot == 1);
  assert(!saveBleHostToNVS(0) && !saveBleHostToNVS(4));
  Preferences::failWrites = true;
  bleHostSlot = 2;
  assert(!saveBleHostToNVS(3) && bleHostSlot == 2);           // Schreibfehler ändert den Stand nicht
  Preferences::failWrites = false;
}

TEST(test_ble_host_action_releases_all_keys_and_requests_switch) {
  resetState();
  bleHostSlot = 1;
  bleHostSwitchRequested = 0;
  KEYMAP[0][0][0] = 'a';
  KEYMAP[0][0][1] = ACT_HOST_BASE + 1;                        // HOST_2
  pressKey(0, 0);
  assert(!bleKeyboard.pressedKeys.empty());
  pressKey(0, 1);
  assert(bleKeyboard.pressedKeys.empty());                    // alles freigegeben
  assert(bleHostSwitchRequested == 2);
  releaseKey(0, 1);
  releaseKey(0, 0);
  assert(bleKeyboard.pressedKeys.empty());
  assert(bleHostSwitchRequested == 2);
}

TEST(test_ble_host_action_for_active_slot_only_releases) {
  resetState();
  bleHostSlot = 2;
  bleHostSwitchRequested = 0;
  KEYMAP[0][0][1] = ACT_HOST_BASE + 1;
  pressKey(0, 1);
  releaseKey(0, 1);
  assert(bleHostSwitchRequested == 0);                        // kein Neustart für den aktiven Slot
}

TEST(test_ble_host_action_does_nothing_in_config_mode_or_without_host) {
  resetState();
  bleHostSlot = 1;
  bleHostSwitchRequested = 0;
  KEYMAP[0][0][1] = ACT_HOST_BASE + 2;
  isConfigMode = true;
  pressKey(0, 1); releaseKey(0, 1);
  assert(bleHostSwitchRequested == 0);
  isConfigMode = false;
  bleKeyboard.connected = true;
}

TEST(test_ble_host_action_switches_without_mac_connection) {
  resetState();
  bleHostSlot = 1;
  bleHostSwitchRequested = 0;
  KEYMAP[0][0][1] = ACT_HOST_BASE + 2;
  bleKeyboard.connected = false;                              // verlorener Host darf den Wechsel nicht sperren
  pressKey(0, 1); releaseKey(0, 1);
  assert(bleHostSwitchRequested == 3);
  bleKeyboard.connected = true;
  bleHostSwitchRequested = 0;
}

TEST(test_ble_host_action_as_hold_and_double_tap_action) {
  resetState();
  bleHostSlot = 1;
  bleHostSwitchRequested = 0;
  KEYMAP[0][2][1] = 'a';
  HOLDMAP[0][2][1] = ACT_HOST_BASE + 1;
  setMillis(1000);
  pressKey(2, 1, true);
  setMillis(1000 + tappingTermMs + 10);
  processDeferredKeys(millis());                              // Halten löst HOST_2 aus
  assert(bleHostSwitchRequested == 2);
  pressKey(2, 1, false);
  bleHostSwitchRequested = 0;
}

TEST(test_ble_host_action_as_double_tap_action) {
  resetState();
  bleHostSlot = 1;
  bleHostSwitchRequested = 0;
  KEYMAP[0][2][2] = 'x';
  DTAPMAP[0][2][2] = ACT_HOST_BASE + 2;
  setMillis(1000);
  pressKey(2, 2, true);
  setMillis(1020);
  pressKey(2, 2, false);
  setMillis(1050);
  pressKey(2, 2, true);                                       // zweiter Tipp: Doppel-Tipp-Aktion
  pressKey(2, 2, false);
  assert(bleHostSwitchRequested == 3);
  DTAPMAP[0][2][2] = 0;
  bleHostSwitchRequested = 0;
}

TEST(test_ble_host_nvs_failure_reports_error) {
  resetState();
  mockChar.notifications.clear();
  Preferences::failWrites = true;
  bleHostSlot = 1;
  assert(!saveBleHostToNVS(2));
  bool err = false;
  for (const auto &n : mockChar.notifications) if (n == "ERR NVS BLE_HOST") err = true;
  assert(err);
  Preferences::failWrites = false;
}

TEST(test_ble_host_action_codes_and_combo_rejection) {
  assert(ACT_HOST_BASE > ACT_MACRO_BASE + MAX_MACROS - 1 && ACT_HOST_BASE != ACT_OSL_BASE);
  assert(isBleHostAction(ACT_HOST_BASE) && isBleHostAction(ACT_HOST_BASE + 2) && !isBleHostAction(ACT_HOST_BASE + 3));
  resetState();
  handleConfigCommand("CLEAR_COMBOS", false);
  mockChar.notifications.clear();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 392", false);      // ACT_HOST_BASE
  assert(numCombos == 0);
}

TEST(test_ble_host_slot_in_device_info) {
  resetState();
  bleHostSlot = 3;
  mockChar.notifications.clear();
  handleConfigCommand("GET_INFO", true);
  bool sawSlot = false;
  for (const auto &n : mockChar.notifications) if (n == "BLE_HOST:3") sawSlot = true;
  assert(sawSlot);
  assert(mockChar.value.find("DEVICE_INFO:") == 0);          // DEVICE_INFO bleibt die letzte Zeile
  assert(DACTYL_FW_VERSION >= 30);
}

// Swap hands (ACT_SWAP_HANDS): Halten spiegelt die Tastensuche, Tippen merkt vor, Doppel-Tippen rastet ein
static void shTap(uint8_t r, uint8_t c, unsigned long at) {
  setMillis(at);
  pressKey(r, c);
  setMillis(at + 20);
  releaseKey(r, c);
}

TEST(test_swap_hands_mirror_is_an_involution) {
  assert(ACT_SWAP_HANDS > ACT_HOST_BASE + NUM_HOST_ACTIONS - 1 && ACT_SWAP_HANDS < 0x190);
  for (uint8_t r = 0; r < NUM_ROWS; r++)
    for (uint8_t c = 0; c < NUM_COLS; c++) assert(swapMirrorCol(r, swapMirrorCol(r, c)) == c);
  assert(swapMirrorCol(2, 0) == FINGER_COLS - 1 && swapMirrorCol(2, FINGER_COLS - 1) == 0);
  assert(swapMirrorCol(5, 0) == 3 && swapMirrorCol(5, 6) == 2);
}

TEST(test_swap_hands_hold_mirrors_lookup_and_release_is_clean) {
  resetState();
  KEYMAP[0][5][0] = ACT_SWAP_HANDS;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][4] = 'b';
  setMillis(1000);
  pressKey(5, 0);                                  // halten
  pressKey(2, 1);
  assert(pressedAction[2][1] == 'b');              // gespiegelte Spalte 1 -> 4
  assert(std::count(bleKeyboard.pressedKeys.begin(), bleKeyboard.pressedKeys.end(), 'b') == 1);
  setMillis(1500);
  releaseKey(5, 0);                                // SWAP_HANDS zuerst loslassen, die Taste bleibt gehalten
  assert(!swapActive());
  releaseKey(2, 1);                                // das Loslassen trifft weiter 'b', nicht 'a'
  assert(bleKeyboard.pressedKeys.empty());
  pressKey(2, 1);                                  // ohne Wechsel gilt wieder 'a'
  assert(pressedAction[2][1] == 'a');
  releaseKey(2, 1);
  assert(bleKeyboard.pressedKeys.empty());
  assert(swapHeldKeys == 0 && !swapArmed && !swapLocked);
}

TEST(test_swap_hands_hold_mirrors_thumb_keys) {
  resetState();
  KEYMAP[0][0][0] = ACT_SWAP_HANDS;
  KEYMAP[0][5][3] = ' ';
  KEYMAP[0][5][0] = 'x';
  setMillis(1000);
  pressKey(0, 0);
  pressKey(5, 3);                                  // Daumen 3 -> 0
  assert(pressedAction[5][3] == 'x');
  releaseKey(5, 3);
  releaseKey(0, 0);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_swap_hands_tap_arms_one_shot_for_next_press_only) {
  resetState();
  KEYMAP[0][5][0] = ACT_SWAP_HANDS;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][4] = 'b';
  shTap(5, 0, 1000);
  assert(swapArmed && !swapLocked);
  assert(bleKeyboard.pressedKeys.empty() && bleKeyboard.pressHistory.empty());   // der Tipp sendet nichts
  setMillis(2000);
  pressKey(2, 1);
  assert(pressedAction[2][1] == 'b' && !swapArmed);
  releaseKey(2, 1);
  pressKey(2, 1);                                  // verbraucht: wieder 'a'
  assert(pressedAction[2][1] == 'a');
  releaseKey(2, 1);
}

TEST(test_swap_hands_double_tap_toggles_until_tapped_again) {
  resetState();
  KEYMAP[0][5][0] = ACT_SWAP_HANDS;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][4] = 'b';
  shTap(5, 0, 1000);
  shTap(5, 0, 1000 + 20 + 50);                     // zweiter Tipp im Tapping-Term
  assert(swapLocked && !swapArmed);
  for (int i = 0; i < 2; i++) {                    // bleibt über mehrere Drücke
    setMillis(3000 + i * 100);
    pressKey(2, 1);
    assert(pressedAction[2][1] == 'b' && swapLocked);
    releaseKey(2, 1);
  }
  shTap(5, 0, 5000);                               // ein Tipp löst die Einrastung
  assert(!swapLocked && !swapArmed);
  setMillis(6000);
  pressKey(2, 1);
  assert(pressedAction[2][1] == 'a');
  releaseKey(2, 1);
}

TEST(test_swap_hands_slow_second_tap_arms_again_instead_of_locking) {
  resetState();
  KEYMAP[0][5][0] = ACT_SWAP_HANDS;
  shTap(5, 0, 1000);
  shTap(5, 0, 1000 + tappingTermMs + 500);
  assert(swapArmed && !swapLocked);
}

TEST(test_swap_hands_hold_with_key_press_is_no_tap) {
  resetState();
  KEYMAP[0][5][0] = ACT_SWAP_HANDS;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][4] = 'b';
  setMillis(1000);
  pressKey(5, 0);
  setMillis(1010);
  pressKey(2, 1);
  releaseKey(2, 1);
  setMillis(1030);
  releaseKey(5, 0);                                // kurz, aber eine Taste dazwischen: kein Vormerken
  assert(!swapActive());
}

TEST(test_swap_hands_is_cleared_by_reset_triggers) {
  resetState();
  KEYMAP[0][5][0] = ACT_SWAP_HANDS;
  // Einrastung und Vormerkung: oslClearAll() deckt Host-Verlust, Link-Ausfall, RELEASE_ALL und Config Mode ab
  shTap(5, 0, 1000);
  shTap(5, 0, 1070);
  assert(swapLocked);
  oslClearAll();
  assert(!swapActive());
  shTap(5, 0, 2000);
  assert(swapArmed);
  oslClearAll();
  assert(!swapActive());
  // Gehaltene SWAP_HANDS-Taste (Standby): swapClearAll()
  setMillis(3000);
  pressKey(5, 0);
  assert(swapActive());
  swapClearAll();
  assert(!swapActive());
  releaseKey(5, 0);                                // das Loslassen nach dem Löschen vormerkt nichts
  assert(!swapActive());
}

TEST(test_swap_hands_without_host_arms_nothing_in_config_mode) {
  resetState();
  KEYMAP[0][5][0] = ACT_SWAP_HANDS;
  isConfigMode = true;
  shTap(5, 0, 1000);
  assert(!swapActive());
  isConfigMode = false;
}

TEST(test_swap_hands_is_no_combo_action) {
  resetState();
  handleConfigCommand("CLEAR_COMBOS", false);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 395", false);      // ACT_SWAP_HANDS = 0x18B
  assert(numCombos == 0);
  assert(DACTYL_FW_VERSION >= 32);
}

TEST(test_swap_hands_left_thumb_table_is_an_involution_without_missing_key) {
  static const uint8_t left[7] = SWAP_THUMB_MIRROR_LEFT;
  static const uint8_t right[7] = SWAP_THUMB_MIRROR_RIGHT;
  for (int c = 0; c < 7; c++) { assert(left[left[c]] == c); assert(right[right[c]] == c); }
  assert(left[0] == 0);                            // links fehlt R5C0: es bleibt an seinem Platz
  assert(right[5] == 5);                           // rechts fehlt R5C5: es bleibt an seinem Platz
}

TEST(test_swap_hands_key_does_not_swap_after_combo_consumed_it) {
  resetState();
  KEYMAP[0][5][0] = ACT_SWAP_HANDS;
  userCombos[0] = { 5, 0, 2, 1, 0, 'z' };
  numCombos = 1;
  comboRuntime[0] = {};
  setMillis(1000);
  pressKey(5, 0);
  setMillis(1010);
  pressKey(2, 1);
  checkUserCombos();                               // Combo löst aus
  assert(comboRuntime[0].active);
  setMillis(1030);
  releaseKey(2, 1);
  releaseKey(5, 0);
  checkUserCombos();
  assert(!swapArmed && !swapLocked);               // der kurze Druck zählt nach einer Combo nicht als Tipp
  numCombos = 0;
}

TEST(test_swap_hands_real_release_all_path_clears_state) {
  resetState();
  KEYMAP[0][5][0] = ACT_SWAP_HANDS;
  shTap(5, 0, 1000);
  assert(swapArmed);
  // Host-Verlust und Config Mode rufen oslClearAll() (dactyl_right.ino); der Standby ruft swapClearAll()
  oslClearAll();
  assert(!swapActive());
  shTap(5, 0, 2000);
  shTap(5, 0, 2070);
  assert(swapLocked);
  swapClearAll();
  assert(!swapActive());
}

TEST(test_swap_hands_tap_key_tap_does_not_lock) {
  resetState();
  KEYMAP[0][5][0] = ACT_SWAP_HANDS;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][4] = 'b';
  shTap(5, 0, 1000);
  shTap(2, 1, 1030);                               // verbraucht die Vormerkung
  assert(!swapArmed);
  shTap(5, 0, 1060);                               // innerhalb des Tapping-Terms nach dem ersten Tipp
  assert(!swapLocked && swapArmed);                // vormerken, nicht einrasten
}

TEST(test_swap_hands_mirrored_swap_key_still_consumes_armed_swap) {
  resetState();
  KEYMAP[0][5][0] = ACT_SWAP_HANDS;
  KEYMAP[0][2][4] = ACT_SWAP_HANDS;                // die gespiegelte Zelle der Taste R2C1 ist SWAP_HANDS
  KEYMAP[0][2][1] = 'a';
  shTap(5, 0, 1000);
  assert(swapArmed);
  setMillis(1500);
  pressKey(2, 1);                                  // gespiegelt = SWAP_HANDS (Spalte 4): verbraucht die Vormerkung
  assert(!swapArmed);
  releaseKey(2, 1);
}

// -----------------------------------------------------------------------------
// Mauspräzision: MOUSE_SLOW (Schritt 1) und MOUSE_FAST (Höchstschritt ab dem ersten Takt)
// -----------------------------------------------------------------------------
TEST(test_mouse_slow_caps_step_at_one_for_one_second) {
  resetState();
  KEYMAP[0][2][1] = ACT_MOUSE_RIGHT_MOVE;
  KEYMAP[0][2][2] = ACT_MOUSE_SLOW;
  assert(ACT_MOUSE_SLOW == 0x13B && ACT_MOUSE_FAST == 0x13C);
  setMillis(1000);
  applyMatrixKeyChange(2, 2, true, 1000);
  applyMatrixKeyChange(2, 1, true, 1000);
  for (unsigned long t = 1010; t <= 2000; t += 10) processDeferredKeys(t);
  assert(bleKeyboard.mouseMoves.size() > 50);
  for (auto &m : bleKeyboard.mouseMoves) assert(m.first == 1 && m.second == 0);
  // Die Taste selbst bewegt nichts und sendet nichts an den Host
  assert(bleKeyboard.mouseScrolls.empty());
}

TEST(test_mouse_fast_uses_max_step_from_first_tick) {
  resetState();
  KEYMAP[0][2][1] = ACT_MOUSE_RIGHT_MOVE;
  KEYMAP[0][2][2] = ACT_MOUSE_FAST;
  setMillis(1000);
  applyMatrixKeyChange(2, 2, true, 1000);
  applyMatrixKeyChange(2, 1, true, 1000);
  processDeferredKeys(1010);
  assert(bleKeyboard.mouseMoves.size() == 1 && bleKeyboard.mouseMoves[0].first == MOUSE_MOVE_MAX_STEP);
}

TEST(test_mouse_slow_and_fast_together_or_released_use_normal_acceleration) {
  resetState();
  KEYMAP[0][2][1] = ACT_MOUSE_RIGHT_MOVE;
  KEYMAP[0][2][2] = ACT_MOUSE_SLOW;
  KEYMAP[0][2][3] = ACT_MOUSE_FAST;
  setMillis(1000);
  applyMatrixKeyChange(2, 1, true, 1000);
  applyMatrixKeyChange(2, 2, true, 1000);
  applyMatrixKeyChange(2, 3, true, 1000);
  processDeferredKeys(1010);
  assert(bleKeyboard.mouseMoves.back().first == 1);          // beide: normal, die Haltezeit ist noch kurz
  processDeferredKeys(1500);
  assert(bleKeyboard.mouseMoves.back().first > 1);           // beide: die Beschleunigung wirkt
  applyMatrixKeyChange(2, 3, false, 1510);                   // nur MOUSE_SLOW bleibt
  processDeferredKeys(1520);
  assert(bleKeyboard.mouseMoves.back().first == 1);
  applyMatrixKeyChange(2, 2, false, 1530);                   // keine mehr: die Haltezeit der Bewegung zählt weiter
  processDeferredKeys(1540);
  assert(bleKeyboard.mouseMoves.back().first > 1);
}

TEST(test_mouse_slow_caps_held_wheel_step) {
  resetState();
  KEYMAP[0][2][1] = ACT_MOUSE_WHEEL_UP;
  KEYMAP[0][2][2] = ACT_MOUSE_SLOW;
  setMillis(1000);
  applyMatrixKeyChange(2, 1, true, 1000);
  processDeferredKeys(1000 + WHEEL_REPEAT_DELAY_MS + 3 * WHEEL_ACCEL_MS);
  assert(bleKeyboard.mouseScrolls.back() > 1);               // ohne MOUSE_SLOW wächst der Schritt
  applyMatrixKeyChange(2, 2, true, 3000);
  size_t n = bleKeyboard.mouseScrolls.size();
  processDeferredKeys(3000 + WHEEL_REPEAT_INTERVAL_MS);
  assert(bleKeyboard.mouseScrolls.size() > n && bleKeyboard.mouseScrolls.back() == 1);
}

TEST(test_mouse_speed_of_other_half_applies_and_expires) {
  resetState();
  KEYMAP[0][2][1] = ACT_MOUSE_RIGHT_MOVE;
  setMillis(1000);
  applyRemoteMouseSpeed(2, 1000);                            // die andere Hälfte hält MOUSE_FAST
  applyMatrixKeyChange(2, 1, true, 1000);
  processDeferredKeys(1010);
  assert(bleKeyboard.mouseMoves.back().first == MOUSE_MOVE_MAX_STEP);
  applyRemoteMouseSpeed(1, 1020);                            // jetzt MOUSE_SLOW
  processDeferredKeys(1030);
  assert(bleKeyboard.mouseMoves.back().first == 1);
  // Ohne Paket verfällt das Tempo der anderen Hälfte
  processDeferredKeys(1020 + MOUSE_SPEED_REMOTE_TIMEOUT_MS - 10);
  assert(bleKeyboard.mouseMoves.back().first == 1);
  processDeferredKeys(1020 + MOUSE_SPEED_REMOTE_TIMEOUT_MS + 10);
  assert(remoteMouseSpeed == 0 && bleKeyboard.mouseMoves.back().first > 1);
}

TEST(test_reset_mouse_move_clears_remote_mouse_speed) {
  resetState();
  applyRemoteMouseSpeed(1, 1000);
  assert(remoteMouseSpeed == 1);
  resetMouseMove();
  assert(remoteMouseSpeed == 0);
}

TEST(test_mouse_speed_keys_are_not_combo_targets_and_report_local_mask) {
  resetState();
  assert(isMouseMoveAction(ACT_MOUSE_SLOW) && isMouseMoveAction(ACT_MOUSE_FAST));
  assert(!isRepeatableAction(ACT_MOUSE_SLOW) && !isRepeatableAction(ACT_MOUSE_FAST));
  KEYMAP[0][2][1] = ACT_MOUSE_SLOW;
  KEYMAP[0][2][2] = ACT_MOUSE_FAST;
  setMillis(1000);
  assert(localMouseSpeedMask() == 0);
  applyMatrixKeyChange(2, 1, true, 1000);
  assert(localMouseSpeedMask() == 1);
  applyMatrixKeyChange(2, 2, true, 1000);
  assert(localMouseSpeedMask() == 3 && effectiveMouseSpeed(1000) == 0);
  applyMatrixKeyChange(2, 1, false, 1100);
  applyMatrixKeyChange(2, 2, false, 1100);
  assert(localMouseSpeedMask() == 0);
}

// Num Word (ACT_NUM_WORD): Tippen rastet numWordLayer ein; Ziffern, Zahlzeichen, Modifier und Ebenen-Tasten halten sie offen
static void nwSetup() {
  resetState();
  KEYMAP[0][5][0] = ACT_NUM_WORD;
  KEYMAP[1][2][1] = '1';
  KEYMAP[1][2][2] = '2';
  KEYMAP[1][2][3] = KEY_LEFT_SHIFT;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][2] = 'b';
  KEYMAP[1][3][1] = '.';
}

TEST(test_num_word_digits_from_layer_space_from_layer_zero) {
  assert(ACT_NUM_WORD == 0x18D && ACT_NUM_WORD > ACT_SENTENCE_CASE);
  nwSetup();
  KEYMAP[0][3][3] = ' ';
  KEYMAP[1][3][3] = 'q';           // Ebene 1 belegt die Stelle mit einem Buchstaben: Space kommt trotzdem von Ebene 0
  setMillis(1000); pressKey(5, 0, true); pressKey(5, 0, false);
  assert(numWordActive && getActiveLayer() == 1);
  setMillis(1100); pressKey(2, 1, true); pressKey(2, 1, false);   // '1' von der Ebene (Ebene 0 hat 'a')
  setMillis(1200); pressKey(2, 2, true); pressKey(2, 2, false);   // '2' von der Ebene (Ebene 0 hat 'b')
  assert(countPresses('1') == 1 && countPresses('2') == 1 && countPresses('a') == 0 && countPresses('b') == 0);
  assert(numWordActive && getActiveLayer() == 1);
  setMillis(1300); pressKey(3, 3, true);                          // beendet Num Word und gilt auf Ebene 0
  assert(!numWordActive && getActiveLayer() == 0);
  assert(countPresses(' ') == 1 && countPresses('q') == 0 && pressedAction[3][3] == ' ');
  pressKey(3, 3, false);
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_num_word_symbols_modifiers_and_layer_keys_keep_it_open) {
  nwSetup();
  KEYMAP[1][4][0] = ACT_MO_BASE + 2;
  setMillis(1000); pressKey(5, 0, true); pressKey(5, 0, false);
  setMillis(1100); pressKey(3, 1, true); pressKey(3, 1, false);   // '.'
  assert(numWordActive);
  setMillis(1200); pressKey(2, 3, true);                          // Shift
  assert(numWordActive);
  pressKey(2, 3, false);
  setMillis(1300); pressKey(4, 0, true); pressKey(4, 0, false);   // Ebenen-Taste
  assert(numWordActive);
  for (char ch : {',', '-', '+', '*', '/', '='}) {
    nwSetup();
    KEYMAP[1][3][1] = (uint16_t)ch;
    setMillis(1000); pressKey(5, 0, true); pressKey(5, 0, false);
    setMillis(1100); pressKey(3, 1, true); pressKey(3, 1, false);
    assert(numWordActive);
  }
}

TEST(test_num_word_idle_timer_resets_and_expires) {
  nwSetup();
  setMillis(1000); pressKey(5, 0, true); pressKey(5, 0, false);
  setMillis(5900); pressKey(2, 1, true); pressKey(2, 1, false);   // Ziffer startet die Frist neu
  setMillis(10800); numWordExpire(10800);
  assert(numWordActive);                                          // 4900 ms seit der Ziffer
  setMillis(10950); numWordExpire(10950);
  assert(!numWordActive && getActiveLayer() == 0);                // 5050 ms ohne Taste
}

TEST(test_num_word_second_tap_ends_and_layer_zero_setting_does_nothing) {
  nwSetup();
  setMillis(1000); pressKey(5, 0, true); pressKey(5, 0, false);
  assert(numWordActive);
  setMillis(1100); pressKey(5, 0, true); pressKey(5, 0, false);
  assert(!numWordActive && getActiveLayer() == 0);
  numWordLayer = 0;
  setMillis(1200); pressKey(5, 0, true); pressKey(5, 0, false);
  assert(!numWordActive && getActiveLayer() == 0);
  numWordLayer = 3;
  setMillis(1300); pressKey(5, 0, true); pressKey(5, 0, false);
  assert(numWordActive && getActiveLayer() == 3);
}

TEST(test_num_word_stops_on_release_all_and_manual_layer_change) {
  nwSetup();
  setMillis(1000); pressKey(5, 0, true); pressKey(5, 0, false);
  oslClearAll();
  assert(!numWordActive && getActiveLayer() == 0);
  setMillis(2000); pressKey(5, 0, true); pressKey(5, 0, false);
  toggleLayers[1] = false;                                        // Ebene von Hand gelöst
  setMillis(2100); pressKey(2, 1, true); pressKey(2, 1, false);
  assert(!numWordActive);
}

// Boot layer: bootLayer rastet die Ebene beim Start ein; TG_0 löst sie
TEST(test_boot_layer_applies_at_boot_and_tg0_clears_it) {
  resetState();
  applyBootLayer();
  assert(getActiveLayer() == 0);                   // bootLayer 0: keine Wirkung
  bootLayer = 3;
  applyBootLayer();
  assert(getActiveLayer() == 3 && toggleLayers[3] && (layerLockedMask & (1u << 3)));
  layerTimeoutMs = 1000;                           // der Rückfall lässt die Start-Ebene stehen
  setMillis(0); layerTimeoutExpire(0);
  setMillis(5000); layerTimeoutExpire(5000);
  assert(getActiveLayer() == 3);
  KEYMAP[3][2][2] = ACT_TG_BASE;
  setMillis(100); pressKey(2, 2, true); pressKey(2, 2, false);
  assert(getActiveLayer() == 0 && !toggleLayers[3]);
}

TEST(test_set_boot_layer_args_nvs_and_device_info) {
  resetState();
  for (const char* bad : {"SET_BOOT_LAYER 8", "SET_BOOT_LAYER -1", "SET_BOOT_LAYER abc", "SET_BOOT_LAYER 12"}) {
    handleConfigCommand(bad, false);
    assert(mockChar.value == std::string("ERR ARGS ") + bad);
  }
  assert(bootLayer == 0);
  handleConfigCommand("SET_BOOT_LAYER 3", false);
  assert(mockChar.value == "OK SET_BOOT_LAYER 3" && bootLayer == 3);
  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.find("\"bl\":3,") != std::string::npos && mockChar.value.size() < 512);
  bootLayer = 0;
  loadKeymapFromNVS();
  assert(bootLayer == 3);
  preferences.begin("dactyl", false);
  preferences.putUChar("boot_layer", 9);
  preferences.end();
  bootLayer = 0;
  loadKeymapFromNVS();
  assert(bootLayer == 0);
}

TEST(test_set_num_word_layer_args_nvs_and_device_info) {
  resetState();
  for (const char* bad : {"SET_NUM_WORD_LAYER 8", "SET_NUM_WORD_LAYER -1", "SET_NUM_WORD_LAYER abc", "SET_NUM_WORD_LAYER 12"}) {
    handleConfigCommand(bad, false);
    assert(mockChar.value == std::string("ERR ARGS ") + bad);
  }
  assert(numWordLayer == 1);
  handleConfigCommand("SET_NUM_WORD_LAYER 3", false);
  assert(mockChar.value == "OK SET_NUM_WORD_LAYER 3" && numWordLayer == 3);
  handleConfigCommand("GET_INFO", false);
  assert(mockChar.value.find("\"nwl\":3,") != std::string::npos && mockChar.value.size() < 512);
  numWordLayer = 1;
  loadKeymapFromNVS();
  assert(numWordLayer == 3);
  preferences.begin("dactyl", false);
  preferences.putUChar("nw_layer", 9);
  preferences.end();
  numWordLayer = 1;
  loadKeymapFromNVS();
  assert(numWordLayer == 1);
}

TEST(test_num_word_is_no_combo_action) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 397", false);          // ACT_NUM_WORD = 0x18D
  assert(numCombos == 0);
}

// Tapping-Term-Tasten (ACT_TT_UP, ACT_TT_DOWN): Tipp ändert tappingTermMs im RAM, beide lange gehalten speichern im NVS
static void ttSetup() {
  resetState();
  KEYMAP[0][5][0] = ACT_TT_UP;
  KEYMAP[0][5][1] = ACT_TT_DOWN;
  tappingTermMs = 200;
}

TEST(test_tt_keys_tap_changes_ram_and_reboot_restores_nvs) {
  assert(ACT_TT_UP == 0x18E && ACT_TT_DOWN == 0x18F && ACT_TT_UP > ACT_NUM_WORD);
  ttSetup();
  assert(saveTappingTermToNVS(200));
  setMillis(1000); pressKey(5, 0, true); setMillis(1050); pressKey(5, 0, false);
  setMillis(1100); pressKey(5, 0, true); setMillis(1150); pressKey(5, 0, false);
  assert(tappingTermMs == 220);
  setMillis(1200); pressKey(5, 1, true); setMillis(1250); pressKey(5, 1, false);
  assert(tappingTermMs == 210);
  assert(bleKeyboard.pressedKeys.empty());
  loadKeymapFromNVS();                              // Neustart ohne Speichern
  assert(tappingTermMs == 200);
}

TEST(test_tt_keys_clamp_to_range) {
  ttSetup();
  tappingTermMs = 495;
  for (int i = 0; i < 3; i++) { setMillis(1000 + i * 100); pressKey(5, 0, true); pressKey(5, 0, false); }
  assert(tappingTermMs == 500);
  tappingTermMs = 105;
  for (int i = 0; i < 3; i++) { setMillis(2000 + i * 100); pressKey(5, 1, true); pressKey(5, 1, false); }
  assert(tappingTermMs == 100);
}

TEST(test_tt_keys_long_press_of_both_saves_to_nvs) {
  ttSetup();
  assert(saveTappingTermToNVS(200));
  setMillis(1000); pressKey(5, 0, true); pressKey(5, 0, false);
  setMillis(1100); pressKey(5, 0, true); pressKey(5, 0, false);
  assert(tappingTermMs == 220);
  setMillis(2000); pressKey(5, 0, true); pressKey(5, 1, true);
  setMillis(2900); ttExpire(2900);                  // noch nicht lange genug
  loadKeymapFromNVS();
  assert(tappingTermMs == 200);
  tappingTermMs = 220;
  setMillis(3050); ttExpire(3050);                  // 1050 ms: speichert
  tappingTermMs = 300;
  loadKeymapFromNVS();
  assert(tappingTermMs == 220);
  pressKey(5, 0, false); pressKey(5, 1, false);
  assert(tappingTermMs == 220);                     // Loslassen nach dem Doppeldruck ist kein Tipp
  setMillis(4000); pressKey(5, 1, true); pressKey(5, 1, false);
  assert(tappingTermMs == 210);
}

TEST(test_tt_keys_are_no_combo_action) {
  resetState();
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 398", false);          // ACT_TT_UP = 0x18E
  assert(numCombos == 0);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 399", false);          // ACT_TT_DOWN = 0x18F
  assert(numCombos == 0);
}

TEST(test_tt_keys_reset_on_release_all_and_abort_leader) {
  ttSetup();
  setMillis(1000); pressKey(5, 0, true); pressKey(5, 1, true);
  assert(ttChord && ttUpHeld && ttDownHeld);
  oslClearAll();                                    // RELEASE_ALL, Link- oder Host-Verlust
  assert(!ttChord && !ttUpHeld && !ttDownHeld);
  setMillis(1100); pressKey(5, 0, false); pressKey(5, 1, false);
  assert(tappingTermMs == 200);                     // spätes Loslassen ändert nichts
  setMillis(3000); ttExpire(3000);
  // Leader-Erfassung endet an einer TT-Taste
  leaderMapKeys();
  KEYMAP[0][2][3] = ACT_TT_UP;
  setMillis(4000); dmTap(0, 0);
  assert(leaderState.active);
  setMillis(4100); dmTap(2, 3);
  assert(!leaderState.active && leaderNoOtherKeys());
}

TEST(test_tt_keys_repeated_chord_saves_again_while_one_key_stays_held) {
  ttSetup();
  assert(saveTappingTermToNVS(200));
  setMillis(1000); pressKey(5, 0, true); pressKey(5, 1, true);
  setMillis(2100); ttExpire(2100);                  // erster Speichervorgang: 200
  setMillis(2200); pressKey(5, 1, false);           // Chord bleibt, solange eine Taste gehalten wird
  assert(tappingTermMs == 200);
  tappingTermMs = 240;
  setMillis(2300); pressKey(5, 1, true);            // zweiter Druck: neuer Chord
  setMillis(2400); ttExpire(2400);
  tappingTermMs = 300;
  loadKeymapFromNVS();
  assert(tappingTermMs == 200);                     // noch keine 1000 ms
  tappingTermMs = 240;
  setMillis(3400); ttExpire(3400);
  tappingTermMs = 300;
  loadKeymapFromNVS();
  assert(tappingTermMs == 240);
}

TEST(test_tt_keys_keep_num_word_open) {
  ttSetup();
  KEYMAP[0][2][3] = ACT_NUM_WORD;
  setMillis(1000); pressKey(2, 3, true); pressKey(2, 3, false);
  assert(numWordActive);
  KEYMAP[1][5][0] = ACT_TT_UP;
  setMillis(1100); pressKey(5, 0, true); pressKey(5, 0, false);
  assert(numWordActive && tappingTermMs == 210);
}

// Keep-awake (ACT_KEEP_AWAKE): alle 60 s ein Mausschritt +1 / -1, Tastendruck startet die Frist neu, Standby und RELEASE_ALL beenden
static void keepAwakeSetup() {
  resetState();
  keepAwakeStop();
  KEYMAP[0][5][0] = ACT_KEEP_AWAKE;
  bleKeyboard.mouseMoves.clear();
}

static void keepAwakeToggleOn(unsigned long t) { setMillis(t); pressKey(5, 0, true); setMillis(t + 20); pressKey(5, 0, false); }

TEST(test_keep_awake_sends_opposite_mouse_steps_every_60s) {
  assert(ACT_KEEP_AWAKE == 0x190 && ACT_KEEP_AWAKE > ACT_TT_DOWN && KEEP_AWAKE_INTERVAL_MS == 60000);
  keepAwakeSetup();
  keepAwakeToggleOn(1000);
  assert(keepAwakeActive && bleKeyboard.pressedKeys.empty());
  keepAwakeTick(30000);
  assert(bleKeyboard.mouseMoves.empty());
  keepAwakeTick(61000);
  assert(bleKeyboard.mouseMoves.size() == 2);
  assert(bleKeyboard.mouseMoves[0].first == 1 && bleKeyboard.mouseMoves[1].first == -1);
  keepAwakeTick(100000);
  assert(bleKeyboard.mouseMoves.size() == 2);
  keepAwakeTick(121000);
  assert(bleKeyboard.mouseMoves.size() == 4);
  keepAwakeToggleOn(122000);                         // zweites Tippen schaltet aus
  assert(!keepAwakeActive);
  keepAwakeTick(300000);
  assert(bleKeyboard.mouseMoves.size() == 4);
}

TEST(test_keep_awake_key_press_resets_timer) {
  keepAwakeSetup();
  KEYMAP[0][5][1] = 'a';
  keepAwakeToggleOn(1000);
  setMillis(50000); pressKey(5, 1, true); pressKey(5, 1, false);
  keepAwakeTick(61000);                              // 60 s nach dem Einschalten, aber nur 11 s nach der Taste
  assert(bleKeyboard.mouseMoves.empty());
  keepAwakeTick(110500);
  assert(bleKeyboard.mouseMoves.size() == 2);
  notePriorKeyPress(120000);                         // Druck der anderen Hälfte
  keepAwakeTick(170000);
  assert(bleKeyboard.mouseMoves.size() == 2);
  keepAwakeTick(180100);
  assert(bleKeyboard.mouseMoves.size() == 4);
}

TEST(test_keep_awake_stops_on_release_all_standby_host_loss_and_config_mode) {
  keepAwakeSetup();
  keepAwakeToggleOn(1000);
  oslClearAll();                                     // RELEASE_ALL, Link-Ausfall, Verlust des Hosts
  assert(!keepAwakeActive);
  keepAwakeTick(100000);
  assert(bleKeyboard.mouseMoves.empty());
  keepAwakeToggleOn(2000);
  bleKeyboard.setDisconnected();                     // ohne Mac: nichts senden, Zustand endet
  keepAwakeTick(100000);
  assert(!keepAwakeActive && bleKeyboard.mouseMoves.empty());
  keepAwakeSetup();
  keepAwakeToggleOn(3000);
  isConfigMode = true;
  keepAwakeTick(100000);
  assert(!keepAwakeActive && bleKeyboard.mouseMoves.empty());
  isConfigMode = false;
  keepAwakeSetup();
  keepAwakeToggleOn(4000);
  keepAwakeStop();                                   // enterStandby() in dactyl_right.ino
  keepAwakeTick(100000);
  assert(bleKeyboard.mouseMoves.empty());
}

TEST(test_keep_awake_toggles_as_tap_of_hold_and_double_tap_keys_and_ignores_config_mode) {
  keepAwakeSetup();
  HOLDMAP[0][5][0] = KEY_LEFT_SHIFT;                 // Mod-Tap: der Tipp ist KEEP_AWAKE
  setMillis(1000); pressKey(5, 0, true); setMillis(1050); pressKey(5, 0, false);
  assert(keepAwakeActive);
  keepAwakeSetup();
  handleConfigCommand("SET_K 0 5 0 400 0 120", false);   // Tipp KEEP_AWAKE, Doppel-Tipp 'x'
  setMillis(1000); keyState[5][0] = true; onMatrixKeyChange(5, 0, true);
  setMillis(1030); keyState[5][0] = false; onMatrixKeyChange(5, 0, false);
  setMillis(1400); doubleTapTick(1400);
  assert(keepAwakeActive);
  keepAwakeSetup();
  isConfigMode = true;
  keepAwakeToggleOn(1000);
  assert(!keepAwakeActive);
  isConfigMode = false;
  bleKeyboard.setDisconnected();
  keepAwakeToggleOn(2000);
  assert(!keepAwakeActive);                          // ohne Mac schaltet der Tipp nicht ein
}

TEST(test_keep_awake_is_no_combo_action_and_keeps_num_word) {
  keepAwakeSetup();
  handleConfigCommand("CLEAR_COMBOS", false);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 400", false);   // ACT_KEEP_AWAKE = 0x190
  assert(numCombos == 0);
  assert(isNumWordKeepAction(ACT_KEEP_AWAKE));
}

// Deep-sleep key (ACT_DEEP_SLEEP): Schlaf erst nach dem Loslassen aller Tasten, Config Mode verwirft die Anforderung
static bool anyHeldForTest() {
  for (int r = 0; r < NUM_ROWS; r++)
    for (int c = 0; c < NUM_COLS; c++)
      if (keyState[r][c]) return true;
  return false;
}

TEST(test_deep_sleep_key_waits_for_release_then_fires_once) {
  assert(ACT_DEEP_SLEEP == 0x191 && ACT_DEEP_SLEEP > ACT_KEEP_AWAKE);
  resetState();
  deepSleepClear();
  KEYMAP[0][5][0] = ACT_DEEP_SLEEP;
  setMillis(1000); pressKey(5, 0, true);
  assert(deepSleepRequested);
  assert(!deepSleepKeyDue(false, anyHeldForTest()));   // Taste gehalten: kein Schlaf
  assert(deepSleepRequested);
  pressKey(5, 0, false);
  assert(!anyHeldForTest());
  assert(!deepSleepKeyDue(false, true));               // die Rohmatrix (rawKeyState des Sketches) hält noch
  assert(deepSleepKeyDue(false, anyHeldForTest()));    // alles losgelassen
  assert(!deepSleepKeyDue(false, false));              // nur einmal
  assert(bleKeyboard.pressedKeys.empty());
}

TEST(test_deep_sleep_key_is_cancelled_or_ignored_in_config_mode) {
  resetState();
  deepSleepClear();
  KEYMAP[0][5][0] = ACT_DEEP_SLEEP;
  isConfigMode = true;
  setMillis(1000); pressKey(5, 0, true); pressKey(5, 0, false);
  assert(!deepSleepRequested);                         // im Config Mode ohne Wirkung
  isConfigMode = false;
  pressKey(5, 0, true); pressKey(5, 0, false);
  assert(deepSleepRequested);
  isConfigMode = true;                                 // Config Mode verwirft die Anforderung
  assert(!deepSleepKeyDue(true, false));
  assert(!deepSleepRequested);
  isConfigMode = false;
  assert(!deepSleepKeyDue(false, false));
  pressKey(5, 0, true); pressKey(5, 0, false);
  deepSleepClear();                                    // enterConfigMode() ruft dies auf
  assert(!deepSleepKeyDue(false, false));
}

TEST(test_deep_sleep_key_is_no_combo_action) {
  resetState();
  handleConfigCommand("CLEAR_COMBOS", false);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 401", false);   // ACT_DEEP_SLEEP = 0x191
  assert(numCombos == 0);
}

TEST(test_deep_sleep_key_keeps_num_word_and_ends_a_leader_capture) {
  resetState();
  deepSleepClear();
  assert(isNumWordKeepAction(ACT_DEEP_SLEEP));
  leaderMapKeys();
  KEYMAP[0][3][0] = ACT_DEEP_SLEEP;
  setMillis(1000);
  dmTap(0, 0);                                    // Leader startet die Erfassung
  assert(leaderState.active);
  setMillis(1100);
  dmTap(3, 0);                                    // Deep Sleep bricht sie ab und merkt den Schlaf vor
  assert(!leaderState.active && deepSleepRequested);
  assert(bleKeyboard.pressedKeys.empty() && bleKeyboard.writtenKeys.empty());
  deepSleepClear();
}

TEST(test_deep_sleep_key_as_mod_tap_tap_arms_sleep) {
  resetState();
  deepSleepClear();
  KEYMAP[0][3][0] = ACT_DEEP_SLEEP;
  HOLDMAP[0][3][0] = KEY_LEFT_SHIFT;
  setMillis(1000); pressKey(3, 0, true);
  setMillis(1050); pressKey(3, 0, false);          // kurz: Tap
  setMillis(1500); doubleTapTick(1500);
  assert(deepSleepRequested);
  deepSleepClear();
}

// Clear-state key (ACT_CLEAR_STATE): ein Druck setzt Ebenen und alle Modi zurück
TEST(test_clear_state_key_resets_layers_and_all_modes) {
  assert(ACT_CLEAR_STATE == 0x192 && ACT_CLEAR_STATE > ACT_DEEP_SLEEP && DACTYL_FW_VERSION >= 49);
  nwSetup();
  uint8_t mirror = swapMirrorCol(5, 4);
  KEYMAP[0][5][4] = ACT_CLEAR_STATE;
  KEYMAP[0][5][mirror] = ACT_CLEAR_STATE;          // Swap hands spiegelt die Suche: beide Stellen belegt
  setMillis(1000);
  toggleLayers[3] = true;                           // TG-Ebene
  toggleLayers[5] = true; layerLockedMask = (uint8_t)(1u << 5);   // LAYER_LOCK-Ebene
  numWordPress(1000);                               // Num Word rastet Ebene 1 ein
  swapLocked = true;
  oslArmed = 0x04;
  keepAwakeActive = true;
  leaderState.start(1000);
  bleKeyboard.oneShotEvents.clear();
  macroRun.active = true;
  mouseMoveActive[2][2] = true;
  assert(getActiveLayer() != 0);
  setMillis(2000); pressKey(5, 4, true); pressKey(5, 4, false);
  assert(getActiveLayer() == 0);
  for (int l = 1; l < NUM_LAYERS; l++) assert(!toggleLayers[l]);
  assert(layerLockedMask == 0 && !numWordActive && !swapLocked && !swapActive());
  assert(oslArmed == 0 && !keepAwakeActive && !leaderState.active);
  assert(!macroRun.active && !mouseMoveActive[2][2]);
  assert((bleKeyboard.oneShotEvents == std::vector<int>{BleKeyboard::CLEAR_STATE_EVENT}));
  assert(bleKeyboard.pressedKeys.empty() && bleKeyboard.writtenKeys.empty());
}

TEST(test_clear_state_key_releases_held_keys_and_is_no_combo_action) {
  resetState();
  KEYMAP[0][5][4] = ACT_CLEAR_STATE;
  KEYMAP[0][2][1] = 'a';
  setMillis(1000); pressKey(2, 1, true);
  assert(!bleKeyboard.pressedKeys.empty());
  setMillis(1100); pressKey(5, 4, true); pressKey(5, 4, false);
  assert(bleKeyboard.pressedKeys.empty());          // releaseAll
  handleConfigCommand("CLEAR_COMBOS", false);
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 402", false);   // ACT_CLEAR_STATE = 0x192
  assert(numCombos == 0);
  assert(isNumWordKeepAction(ACT_CLEAR_STATE));
}

int main() {
  std::cout << "==================================================" << std::endl;
  std::cout << "  Dactyl Firmware Unit Test Suite" << std::endl;
  std::cout << "==================================================" << std::endl;

  std::cout << "\nRan " << testsRun << " tests. All " << testsPassed << " passed successfully!" << std::endl;
  return (testsRun == testsPassed) ? 0 : 1;
}
