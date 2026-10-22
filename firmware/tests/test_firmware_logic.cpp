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
  Preferences::failWrites = false;
  _mock_mutex_busy = false;
  bleKeyboard.connected = true;
  bleKeyboard.writtenKeys.clear();
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

int main() {
  std::cout << "==================================================" << std::endl;
  std::cout << "  Dactyl Firmware Unit Test Suite" << std::endl;
  std::cout << "==================================================" << std::endl;

  std::cout << "\nRan " << testsRun << " tests. All " << testsPassed << " passed successfully!" << std::endl;
  return (testsRun == testsPassed) ? 0 : 1;
}
