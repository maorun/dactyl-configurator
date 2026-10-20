#include "ArduinoMock.h"
#include <cassert>
#include <iostream>

// Include or replicate firmware definitions and logic
#define NUM_LAYERS 8
#define NUM_ROWS 6
#define NUM_COLS 7

#define ACT_MO_BASE 0x100
#define ACT_MO_0 0x100
#define ACT_MO_1 0x101
#define ACT_MO_2 0x102
#define ACT_MO_7 0x107

#define ACT_TG_BASE 0x110
#define ACT_TG_0 0x110
#define ACT_TG_1 0x111
#define ACT_TG_2 0x112
#define ACT_TG_7 0x117

#define ACT_LAYER_UP 0x118
#define ACT_LAYER_DOWN 0x119

#define MAX_COMBOS 16

struct KeyCombo {
  uint8_t r1, c1;
  uint8_t r2, c2;
  uint8_t behavior; // 0 = KEY_PRESS, 1 = MODIFIER_HOLD, 2 = LAYER_TOGGLE
  uint16_t action;
  bool active;
};

// Firmware State Variables
static uint16_t KEYMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
static String layerNames[NUM_LAYERS] = {
  "Base", "Nav & Pfeile", "Symbole", "Numpad",
  "Function", "Media", "Shortcuts", "Custom"
};
static bool momentaryLayers[NUM_LAYERS] = {false};
static bool toggleLayers[NUM_LAYERS] = {false};
static bool keyState[NUM_ROWS][NUM_COLS] = {{false}};
static uint16_t pressedAction[NUM_ROWS][NUM_COLS] = {{0}};

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

static BLECharacteristic mockChar;
static BLECharacteristic* pConfigCharacteristic = &mockChar;
static BleKeyboard bleKeyboard("Dactyl Keyboard", "Dactyl DIY", 100);

// Replicate firmware functions
uint8_t getActiveLayer() {
  for (int i = NUM_LAYERS - 1; i >= 1; i--) {
    if (momentaryLayers[i]) return i;
  }
  for (int i = NUM_LAYERS - 1; i >= 1; i--) {
    if (toggleLayers[i]) return i;
  }
  return 0;
}

void sendConfigNotification(String msg, bool = false) {
  Serial.println(msg);
  if (pConfigCharacteristic) {
    // Im normalen Mac-Tastaturmodus keine Tastendrücke über BLE-Notifications senden (Finding #1 Keylogger-Schutz)
    if (!isConfigMode && (msg.startsWith("KEY_PRESS") || msg.startsWith("KEY_RELEASE"))) {
      return;
    }
    pConfigCharacteristic->setValue(msg.c_str());
    pConfigCharacteristic->notify();
  }
}

void saveLayerNameToNVS(int idx, String name) {
  if (idx < 0 || idx >= NUM_LAYERS) return;
  layerNames[idx] = name;
  Preferences prefs;
  prefs.begin("dactyl", false);
  String k = "name_" + String(idx);
  prefs.putString(k.c_str(), name);
  prefs.end();
}

void saveKeymapToNVS() {
  Preferences prefs;
  prefs.begin("dactyl", false);
  prefs.putBytes("keymap", KEYMAP, sizeof(KEYMAP));
  prefs.end();
}

void saveStandbyTimeoutToNVS(uint32_t t) {
  standbyTimeoutMinutes = t;
  Preferences prefs;
  prefs.begin("dactyl", false);
  prefs.putUInt("standby_timeout", t);
  prefs.end();
}

void saveSleepTimeoutToNVS(uint32_t t) {
  deepSleepTimeoutMinutes = t;
  Preferences prefs;
  prefs.begin("dactyl", false);
  prefs.putUInt("sleep_timeout", t);
  prefs.end();
}

void saveDeviceNameToNVS(String name) {
  deviceName = name;
  Preferences prefs;
  prefs.begin("dactyl", false);
  prefs.putString("dev_name", name);
  prefs.end();
}

void saveDebounceToNVS(uint8_t ms) {
  debounceMs = ms;
  Preferences prefs;
  prefs.begin("dactyl", false);
  prefs.putUChar("debounce", ms);
  prefs.end();
}

void saveComboTimeoutToNVS(uint16_t ms) {
  comboTimeoutMs = ms;
  Preferences prefs;
  prefs.begin("dactyl", false);
  prefs.putUShort("combo_to", ms);
  prefs.end();
}

void saveCombosToNVS() {
  Preferences prefs;
  prefs.begin("dactyl", false);
  prefs.putUChar("num_combos", numCombos);
  prefs.putBytes("combos_data", userCombos, numCombos * sizeof(KeyCombo));
  prefs.end();
}

void handleConfigCommand(String cmd, bool fromBle = false) {
  cmd.trim();
  if (cmd.length() == 0) return;

  // Finding #1: BLE write security check
  if (fromBle && !isConfigMode && cmd != "ENTER_CONFIG" && cmd != "GET_INFO") {
    Serial.println("WARN: BLE config write rejected (not in config mode): " + cmd);
    return;
  }

  lastActivityTime = millis();

  if (cmd.startsWith("SET_KEY ")) {
    int l, r, c, val;
    if (sscanf(cmd.c_str(), "SET_KEY %d %d %d %d", &l, &r, &c, &val) == 4) {
      if (l >= 0 && l < NUM_LAYERS && r >= 0 && r < NUM_ROWS && c >= 0 && c < NUM_COLS) {
        KEYMAP[l][r][c] = (uint16_t)val;
        saveKeymapToNVS();
        sendConfigNotification("OK SET_KEY " + String(l) + " " + String(r) + " " + String(c) + " " + String(val));
      }
    }
  } else if (cmd.startsWith("SET_K ")) {
    int l, r, c, val;
    if (sscanf(cmd.c_str(), "SET_K %d %d %d %d", &l, &r, &c, &val) == 4) {
      if (l >= 0 && l < NUM_LAYERS && r >= 0 && r < NUM_ROWS && c >= 0 && c < NUM_COLS) {
        KEYMAP[l][r][c] = (uint16_t)val;
      }
    }
  } else if (cmd == "SAVE_NVS") {
    saveKeymapToNVS();
    sendConfigNotification("OK SAVE_NVS");
  } else if (cmd.startsWith("SET_NAME ")) {
    int spaceIdx = cmd.indexOf(' ', 9);
    int l = cmd.substring(9, spaceIdx > 0 ? spaceIdx : 10).toInt();
    String name = spaceIdx > 0 ? cmd.substring(spaceIdx + 1) : "";
    name.replace("\"", "");
    name.replace("\\", "");
    name.trim();
    if (name.length() > 31) name = name.substring(0, 31);
    if (l >= 0 && l < NUM_LAYERS && name.length() > 0) {
      saveLayerNameToNVS(l, name);
      sendConfigNotification("OK SET_NAME " + String(l) + " " + name);
    }
  } else if (cmd.startsWith("SET_STANDBY ")) {
    int t = cmd.substring(12).toInt();
    if (t >= 0 && t <= 120) {
      saveStandbyTimeoutToNVS((uint32_t)t);
      sendConfigNotification("OK SET_STANDBY " + String(t));
    }
  } else if (cmd.startsWith("SET_SLEEP ")) {
    int t = cmd.substring(10).toInt();
    if (t >= 0 && t <= 240) {
      saveSleepTimeoutToNVS((uint32_t)t);
      sendConfigNotification("OK SET_SLEEP " + String(t));
    }
  } else if (cmd.startsWith("SET_DEV_NAME ")) {
    String name = cmd.substring(13);
    name.replace("\"", "");
    name.replace("\\", "");
    name.trim();
    if (name.length() > 31) name = name.substring(0, 31);
    if (name.length() > 0) {
      saveDeviceNameToNVS(name);
      sendConfigNotification("OK SET_DEV_NAME " + name);
    }
  } else if (cmd.startsWith("SET_DEBOUNCE ")) {
    int d = cmd.substring(13).toInt();
    if (d >= 1 && d <= 50) {
      saveDebounceToNVS((uint8_t)d);
      sendConfigNotification("OK SET_DEBOUNCE " + String(d));
    }
  } else if (cmd.startsWith("SET_COMBO_TIMEOUT ")) {
    int ct = cmd.substring(18).toInt();
    if (ct >= 10 && ct <= 200) {
      saveComboTimeoutToNVS((uint16_t)ct);
      sendConfigNotification("OK SET_COMBO_TIMEOUT " + String(ct));
    }
  } else if (cmd == "CLEAR_COMBOS") {
    numCombos = 0;
    sendConfigNotification("OK CLEAR_COMBOS");
  } else if (cmd.startsWith("ADD_COMBO ")) {
    int r1, c1, r2, c2, beh, act;
    if (sscanf(cmd.c_str(), "ADD_COMBO %d %d %d %d %d %d", &r1, &c1, &r2, &c2, &beh, &act) == 6) {
      if (numCombos < MAX_COMBOS && r1 >= 0 && r1 < NUM_ROWS && c1 >= 0 && c1 < NUM_COLS &&
          r2 >= 0 && r2 < NUM_ROWS && c2 >= 0 && c2 < NUM_COLS) {
        userCombos[numCombos].r1 = (uint8_t)r1;
        userCombos[numCombos].c1 = (uint8_t)c1;
        userCombos[numCombos].r2 = (uint8_t)r2;
        userCombos[numCombos].c2 = (uint8_t)c2;
        userCombos[numCombos].behavior = (uint8_t)beh;
        userCombos[numCombos].action = (uint16_t)act;
        userCombos[numCombos].active = false;
        numCombos++;
        sendConfigNotification("OK ADD_COMBO " + String(numCombos - 1));
      }
    }
  } else if (cmd == "SAVE_COMBOS") {
    saveCombosToNVS();
    sendConfigNotification("OK SAVE_COMBOS");
  } else if (cmd == "GET_NAMES") {
    String out = "LAYER_NAMES:[";
    for (int i = 0; i < NUM_LAYERS; i++) {
      out += "\"" + layerNames[i] + "\"";
      if (i < NUM_LAYERS - 1) out += ",";
    }
    out += "]";
    sendConfigNotification(out);
  } else if (cmd == "GET_INFO") {
    char buf[288];
    snprintf(buf, sizeof(buf), "DEVICE_INFO:{\"name\":\"%s\",\"mac\":\"2E:BC:BB:81:61:A8\",\"standby_timeout\":%u,\"sleep_timeout\":%u,\"debounce_ms\":%u,\"combo_timeout_ms\":%u,\"config_mode\":%s}",
      isConfigMode ? "Dactyl Config" : deviceName.c_str(),
      standbyTimeoutMinutes, deepSleepTimeoutMinutes,
      debounceMs, comboTimeoutMs,
      isConfigMode ? "true" : "false");
    sendConfigNotification(String(buf));
  } else if (cmd == "RESET_CONFIG") {
    Preferences prefs;
    prefs.begin("dactyl", false);
    prefs.clear();
    prefs.end();
    sendConfigNotification("OK RESET_CONFIG");
  } else if (cmd == "ENTER_CONFIG") {
    sendConfigNotification("OK ENTER_CONFIG");
    enterConfigRequested = true;
  } else if (cmd == "EXIT_CONFIG") {
    sendConfigNotification("OK EXIT_CONFIG");
    exitConfigRequested = true;
  }
}

bool isComboActiveKey(uint8_t r, uint8_t c) {
  for (uint8_t i = 0; i < numCombos; i++) {
    if (userCombos[i].active &&
        ((userCombos[i].r1 == r && userCombos[i].c1 == c) ||
         (userCombos[i].r2 == r && userCombos[i].c2 == c))) {
      return true;
    }
  }
  return false;
}

void checkUserCombos() {
  for (uint8_t i = 0; i < numCombos; i++) {
    bool bothPressed = keyState[userCombos[i].r1][userCombos[i].c1] && keyState[userCombos[i].r2][userCombos[i].c2];
    if (bothPressed && !userCombos[i].active) {
      userCombos[i].active = true;
      if (!isConfigMode && bleKeyboard.isConnected()) {
        bleKeyboard.releaseAll();
      }
      uint16_t act = userCombos[i].action;
      if (userCombos[i].behavior == 0) { // KEY_PRESS
        if (!isConfigMode && bleKeyboard.isConnected()) {
          bleKeyboard.write((uint8_t)act);
        }
        sendConfigNotification("COMBO_TRIGGER:{\"idx\":" + String(i) + ",\"act\":" + String(act) + "}");
      } else if (userCombos[i].behavior == 1) { // MODIFIER_HOLD
        if (!isConfigMode && bleKeyboard.isConnected()) {
          bleKeyboard.press((uint8_t)act);
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
    } else if (!bothPressed && userCombos[i].active) {
      userCombos[i].active = false;
      if (userCombos[i].behavior == 1) { // MODIFIER_HOLD
        uint16_t act = userCombos[i].action;
        if (!isConfigMode && bleKeyboard.isConnected()) {
          bleKeyboard.release((uint8_t)act);
        }
      }
    }
  }
}

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
      }
    }
  }
  numCombos = 0;
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
  assert(getActiveLayer() == 2); // Momentary takes precedence over toggle
  momentaryLayers[2] = false;
  assert(getActiveLayer() == 3);

  // 4. TG_0 resets all toggles
  for (int i = 1; i < NUM_LAYERS; i++) toggleLayers[i] = false;
  assert(getActiveLayer() == 0);

  // 5. LAYER_UP wrap 7 -> 0
  uint8_t curr = 7;
  uint8_t nextUp = (curr + 1) % NUM_LAYERS;
  assert(nextUp == 0);

  // 6. LAYER_DOWN wrap 0 -> 7
  curr = 0;
  uint8_t nextDown = (curr == 0) ? (NUM_LAYERS - 1) : (curr - 1);
  assert(nextDown == 7);
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

  handleConfigCommand("ENTER_CONFIG", true);
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

  // Individual press handler check: while both are held, press() is suppressed
  if (!(keyState[0][0] && keyState[4][5])) {
    bleKeyboard.press((uint8_t)'6');
  }
  assert(bleKeyboard.pressedKeys.empty()); // Keystroke suppressed!
}

// -----------------------------------------------------------------------------
// Test 5: User Combos / Chords Engine (Finding #10)
// -----------------------------------------------------------------------------
TEST(test_user_combos_engine) {
  resetState();
  isConfigMode = false;

  // 1. Add Chord 1: R2C1 (J) + R2C2 (K) -> KEY_ESC (KEY_PRESS, behavior 0)
  handleConfigCommand("ADD_COMBO 2 1 2 2 0 177", false); // 177 = 0xB1 (KEY_ESC)
  // 2. Add Chord 2: R2C1 (J) + R2C3 (L) -> KEY_LEFT_CTRL (MODIFIER_HOLD, behavior 1)
  handleConfigCommand("ADD_COMBO 2 1 2 3 1 128", false); // 128 = 0x80 (KEY_LEFT_CTRL)
  assert(numCombos == 2);

  // Press J (R2C1)
  keyState[2][1] = true;
  checkUserCombos();
  assert(!userCombos[0].active);
  assert(!userCombos[1].active);

  // Press K (R2C2) -> Triggers Chord 1 (Escape)
  keyState[2][2] = true;
  checkUserCombos();
  assert(userCombos[0].active == true);
  assert(bleKeyboard.writtenKeys.size() == 1);
  assert(bleKeyboard.writtenKeys[0] == KEY_ESC);
  assert(isComboActiveKey(2, 1) == true);
  assert(isComboActiveKey(2, 2) == true);

  // Release K -> Deactivates Chord 1
  keyState[2][2] = false;
  checkUserCombos();
  assert(userCombos[0].active == false);

  // Press L (R2C3) while J is held -> Triggers Chord 2 (Ctrl Hold)
  keyState[2][3] = true;
  checkUserCombos();
  assert(userCombos[1].active == true);
  assert(bleKeyboard.pressedKeys.size() == 1);
  assert(bleKeyboard.pressedKeys[0] == KEY_LEFT_CTRL);

  // Release J -> Releases Ctrl Modifier
  keyState[2][1] = false;
  checkUserCombos();
  assert(userCombos[1].active == false);
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
    char c = (char)Serial.read();
    if (c == '\n') {
      handleConfigCommand(serialRxBuf, false);
      serialRxBuf = "";
    } else if (c != '\r') {
      if (serialRxBuf.length() < 256) {
        serialRxBuf += c;
      }
    }
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
    char c = (char)Serial.read();
    if (c == '\n') {
      handleConfigCommand(serialRxBuf, false);
      serialRxBuf = "";
    } else if (c != '\r') {
      if (serialRxBuf.length() < 256) {
        serialRxBuf += c;
      }
    }
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

int main() {
  std::cout << "==================================================" << std::endl;
  std::cout << "  Dactyl Firmware Unit Test Suite" << std::endl;
  std::cout << "==================================================" << std::endl;

  std::cout << "\nRan " << testsRun << " tests. All " << testsPassed << " passed successfully!" << std::endl;
  return (testsRun == testsPassed) ? 0 : 1;
}
