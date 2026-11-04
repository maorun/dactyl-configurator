#include "ArduinoMock.h"
#include <cassert>
#include <iostream>

// Firmware-Definitionen, die DactylLogic.h von der einbindenden Übersetzungseinheit erwartet.
// Die getestete Logik selbst stammt unverändert aus firmware/dactyl_right/DactylLogic.h.
#define NUM_LAYERS 8
#define NUM_ROWS 6
#define NUM_COLS 7

#include "../dactyl_right/DactylCommon.h"

#define CONFIG_MODE_MAGIC 0xDAC7CF60UL
// Im Test änderbar, um einen Flash aus der App (ID != 0) zu simulieren
static uint32_t testDefaultsId = 0;
#define KEYMAP_DEFAULTS_ID testDefaultsId

static ComboRuntime comboRuntime[MAX_COMBOS];

static uint16_t KEYMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
static uint16_t HOLDMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
static uint16_t DTAPMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
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
static uint8_t holdTapMode = 0;
static uint8_t triLayerRules[6] = {0, 0, 0, 0, 0, 0};
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
static KeyPair userKeyPairs[MAX_KEY_PAIRS];

// Tasten-Überschreibungen (nur der Master, wie dactyl_right.ino)
#define DACTYL_KEY_OVERRIDES
#include "../dactyl_right/DactylKeyOverride.h"
static uint8_t numKeyOverrides = 0;
static KeyOverride userKeyOverrides[MAX_KEY_OVERRIDES];

static uint8_t numMacros = 0;
static uint8_t macroLengths[MAX_MACROS] = {0};
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
static const char *testLeftLink = "{\"up\":1,\"ms\":1234,\"ever\":1,\"losses\":2,\"rx_dropped\":3,\"key_dropped\":4}";
#define DEVICE_INFO_LEFT_LINK(buf, size) snprintf(buf, size, "%s", testLeftLink)

// Repeat über beide Hälften: die Hooks rufen den Test ein, damit der Pfad zur anderen Hälfte prüfbar ist
static bool testRemoteTakesRepeat = false;
static std::vector<std::string> testRemoteCalls;
static int testRecorded = 0;
static int testPairReleases = 0;
static bool testRemotePress(uint8_t r, uint8_t c) {
  if (!testRemoteTakesRepeat) return false;
  testRemoteCalls.push_back("press" + std::to_string(r) + std::to_string(c));
  return true;
}
static void testRemoteRelease(uint8_t r, uint8_t c) {
  testRemoteCalls.push_back("release" + std::to_string(r) + std::to_string(c));
}
#define REPEAT_REMOTE_PRESS(r, c) testRemotePress(r, c)
#define REPEAT_REMOTE_RELEASE(r, c) testRemoteRelease(r, c)
#define REPEAT_RECORDED() (testRecorded++)
#define REPEAT_RELEASE_HELD_PAIRS() (testPairReleases++)
#include "../dactyl_right/DactylLogic.h"

// =============================================================================
// TEST SUITE ASSERTIONS
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
  remoteMomentaryLayers = 0;
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
      for (int c = 0; c < NUM_COLS; c++) { HOLDMAP[l][r][c] = 0; DTAPMAP[l][r][c] = 0; }
  resetTapHold();
  resetMouseMove();
  resetDoubleTap();
  for (int r = 0; r < NUM_ROWS; r++) for (int c = 0; c < NUM_COLS; c++) capsWordBuffered[r][c] = false;
  numCombos = 0;
  numKeyPairs = 0;
  for (int i = 0; i < MAX_KEY_PAIRS; i++) userKeyPairs[i] = { 0, 0 };
  numKeyOverrides = 0;
  for (int i = 0; i < MAX_KEY_OVERRIDES; i++) userKeyOverrides[i] = { 0, 0, 0 };
  numMacros = 0;
  for (int i = 0; i < MAX_MACROS; i++) macroLengths[i] = 0;
  macroRun = {};
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
  holdTapMode = 0;
  numTriLayers = 0;
  memset(triLayerRules, 0, sizeof(triLayerRules));
  debounceMs = 5;
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
  // Größte Zahlen in left_link (je 10 Stellen) mit langem Namen: gültig abgeschlossen, im Puffer (448) und
  // unter dem BLE-Attributlimit (512)
  testLeftLink = "{\"up\":1,\"ms\":4294967295,\"ever\":1,\"losses\":4294967295,\"rx_dropped\":4294967295,\"key_dropped\":4294967295}";
  testLeftFw = 65535;
  handleConfigCommand("GET_INFO", true);
  std::string maxTail = std::string(",\"left_fw\":65535,\"left_link\":") + testLeftLink + "}";
  assert(mockChar.value.size() < 448 && mockChar.value.size() > maxTail.size());
  assert(mockChar.value.compare(mockChar.value.size() - maxTail.size(), maxTail.size(), maxTail) == 0);
  testLeftLink = "null";                       // Config Mode oder ESP-NOW nicht gestartet (deviceInfoLeftLink)
  handleConfigCommand("GET_INFO", true);
  assert(mockChar.value.find(",\"left_link\":null}") != std::string::npos);
  testLeftLink = "{\"up\":1,\"ms\":1234,\"ever\":1,\"losses\":2,\"rx_dropped\":3,\"key_dropped\":4}";
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
    if (n == "COMBO_DATA:{\"o\":0,\"e\":[[2,1,2,2,0,177]]}") combo = true;
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
    if (n.rfind("LAYER_DATA", 0) == 0 || n.rfind("HOLD_DATA", 0) == 0 || n.rfind("DTAP_DATA", 0) == 0) continue;
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

  KeyCombo testCombo = { 2, 1, 2, 2, 0, 'x' };
  preferences.putUChar("num_combos", 1);
  preferences.putBytes("combos_data", &testCombo, sizeof(KeyCombo));

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
    "ADD_OVERRIDE 2 178 212 1",   // zu viele Argumente
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
  userKeyOverrides[0] = { 0, 0, 0 };
  userKeyOverrides[1] = { 0, 0, 0 };
  loadKeymapFromNVS();
  assert(numKeyOverrides == 2);
  assert(userKeyOverrides[1].mods == 9 && userKeyOverrides[1].key == 97 && userKeyOverrides[1].replacement == 98);

  // Leere Liste gespeichert: die einkompilierte Liste gilt beim nächsten Start nicht mehr
  handleConfigCommand("CLEAR_OVERRIDES", false);
  handleConfigCommand("SAVE_OVERRIDES", false);
  assert(mockChar.value == "OK SAVE_OVERRIDES");
  numKeyOverrides = 1;
  userKeyOverrides[0] = { 2, 178, 212 };
  loadKeymapFromNVS();
  assert(numKeyOverrides == 0);
}

TEST(test_key_overrides_in_nvs_with_invalid_entry_are_ignored) {
  resetState();
  // Beschädigte NVS-Daten: eine Überschreibung mit Modifier als Taste
  KeyOverride broken[1] = {{ 2, 129, 212 }};
  preferences.begin("dactyl", false);
  preferences.putUChar("num_ovr", 1);
  preferences.putBytes("ovr_data", broken, sizeof(broken));
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
  Preferences::failBytesKey = "ovr_data";
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
    if (n == "OVERRIDE_DATA:{\"o\":0,\"e\":[[2,178,212]]}") data = true;
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

TEST(test_new_app_defaults_remove_stored_key_overrides) {
  resetState();
  handleConfigCommand("ADD_OVERRIDE 2 178 212", false);
  handleConfigCommand("SAVE_OVERRIDES", false);
  handleConfigCommand("SAVE_NVS", false);
  // Ein Flash aus der App (ID != 0) bringt die Überschreibungen mit: die gespeicherte Liste fällt weg
  testDefaultsId = 12345;
  numKeyOverrides = 0;
  loadKeymapFromNVS();
  assert(!preferences.isKey("num_ovr") && !preferences.isKey("ovr_data"));
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

TEST(test_caps_word_key_toggles_once_per_press) {
  resetState();
  KEYMAP[0][5][1] = ACT_CAPS_WORD;
  tapKeyAt(5, 1, 1000, 1050);
  assert((bleKeyboard.oneShotEvents == std::vector<int>{0}));
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

  // Befehl über USB-Serial
  diagBootReason = ESP_RST_BROWNOUT;
  diagLoopMaxUs = 0;
  diagNoteLoopUs(700);
  diagNoteLoopUs(200);                      // kleinerer Wert senkt das Maximum nicht
  _mock_heap_free = 111; _mock_heap_min = 99;
  setMillis(5000);
  mockChar.notifications.clear();
  handleConfigCommand("GET_DIAG", false);
  assert(mockChar.value == "DIAG:{\"reset\":\"brownout\",\"uptime_s\":5,\"heap_free\":111,\"heap_min\":99,\"loop_max_us\":700}");
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


int main() {
  std::cout << "==================================================" << std::endl;
  std::cout << "  Dactyl Firmware Unit Test Suite" << std::endl;
  std::cout << "==================================================" << std::endl;

  std::cout << "\nRan " << testsRun << " tests. All " << testsPassed << " passed successfully!" << std::endl;
  return (testsRun == testsPassed) ? 0 : 1;
}
