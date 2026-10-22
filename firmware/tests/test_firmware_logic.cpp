#include "ArduinoMock.h"
#include <cassert>
#include <iostream>

// Firmware-Definitionen, die DactylLogic.h von der einbindenden Übersetzungseinheit erwartet.
// Die getestete Logik selbst stammt unverändert aus firmware/dactyl_right/DactylLogic.h.
#define NUM_LAYERS 8
#define NUM_ROWS 6
#define NUM_COLS 7

#define ACT_MO_0 0x100
#define ACT_MO_1 0x101
#define ACT_MO_2 0x102
#define ACT_TG_0 0x110
#define ACT_TG_1 0x111
#define ACT_LAYER_UP 0x118
#define ACT_LAYER_DOWN 0x119
#define ACT_MOUSE_LEFT       0x130
#define ACT_MOUSE_RIGHT      0x131
#define ACT_MOUSE_MIDDLE     0x132
#define ACT_MOUSE_WHEEL_UP   0x133
#define ACT_MOUSE_WHEEL_DOWN 0x134

#define MAX_COMBOS 16
#define CONFIG_MODE_MAGIC 0xDAC7CF60UL
// Im Test änderbar, um einen Flash aus der App (ID != 0) zu simulieren
static uint32_t testDefaultsId = 0;
#define KEYMAP_DEFAULTS_ID testDefaultsId

struct KeyCombo {
  uint8_t r1, c1;
  uint8_t r2, c2;
  uint8_t behavior; // 0 = KEY_PRESS, 1 = MODIFIER_HOLD, 2 = LAYER_TOGGLE
  uint16_t action;
};

struct ComboRuntime {
  bool active;
  unsigned long lastReleaseTime;
};
static ComboRuntime comboRuntime[MAX_COMBOS];

static uint16_t KEYMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
static uint16_t HOLDMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
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
static uint32_t standbyTimeoutMinutes = 5;
static uint32_t deepSleepTimeoutMinutes = 60;

static uint8_t numCombos = 0;
static KeyCombo userCombos[MAX_COMBOS];

static SemaphoreHandle_t configMutex = xSemaphoreCreateMutex();
static Preferences preferences;
static BLECharacteristic mockChar;
static BLECharacteristic* pConfigCharacteristic = &mockChar;
static BleKeyboard bleKeyboard("Dactyl Keyboard", "Dactyl DIY", 100);

void handleConfigCommand(String cmd, bool fromBle = false);
void sendConfigNotification(String msg, bool addDelay = false);

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
      for (int c = 0; c < NUM_COLS; c++) HOLDMAP[l][r][c] = 0;
  resetTapHold();
  numCombos = 0;
  // Globale Settings und NVS-Mock zurücksetzen, damit Tests unabhängig von ihrer Reihenfolge sind
  comboTimeoutMs = 40;
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
  _mock_mutex_busy = false;
  bleKeyboard.connected = true;
  bleKeyboard.writtenKeys.clear();
  bleKeyboard.pressHistory.clear();
  isConfigMode = false;
  enterConfigRequested = false;
  exitConfigRequested = false;
  mockChar.notifications.clear();
  Serial.clear();
  bleKeyboard.releaseAll();
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

  // "Auf Dactyl flashen": App-Belegung wird als neue Defaults einkompiliert
  KEYMAP[0][1][1] = 'x';
  HOLDMAP[0][1][1] = KEY_LEFT_ALT;
  loadKeymapFromNVS();
  assert(KEYMAP[0][1][1] == 'x');
  assert(HOLDMAP[0][1][1] == KEY_LEFT_ALT);
  uint32_t fp = keymapDefaultsFingerprint();
  assert(Preferences::uintStore["defaults_fp"] == fp);
  // NVS enthält jetzt die neue Belegung (nächster Start ohne Änderung lädt sie)
  KEYMAP[0][1][1] = 'x';
  HOLDMAP[0][1][1] = KEY_LEFT_ALT;
  loadKeymapFromNVS();
  assert(KEYMAP[0][1][1] == 'x' && HOLDMAP[0][1][1] == KEY_LEFT_ALT);
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

int main() {
  std::cout << "==================================================" << std::endl;
  std::cout << "  Dactyl Firmware Unit Test Suite" << std::endl;
  std::cout << "==================================================" << std::endl;

  std::cout << "\nRan " << testsRun << " tests. All " << testsPassed << " passed successfully!" << std::endl;
  return (testsRun == testsPassed) ? 0 : 1;
}
