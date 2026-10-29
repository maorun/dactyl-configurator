#include "ArduinoMock.h"
#include <cassert>
#include <iostream>

// Proxy-Test der linken Hälfte: echte DactylLogic.h + DactylSplitKeyboard (wie in dactyl_left.ino).
// Jeder HID-Aufruf der Logik muss als SplitHidEvent in der Sendewarteschlange landen.
#define CONFIG_MODE_MAGIC 0xDAC7CF60UL
#define CONFIG_COMBO_R1 0
#define CONFIG_COMBO_C1 5
#define CONFIG_COMBO_R2 4
#define CONFIG_COMBO_C2 0
#define DEFAULT_DEVICE_NAME "Dactyl Links"
#define CONFIG_BLE_NAME "Dactyl Config L"
#define DEVICE_SIDE "L"
#define KEYMAP_DEFAULTS_ID 0UL

#include "../dactyl_right/DactylCommon.h"
#include "../dactyl_left/DactylLeftLogic.h"
#include "../dactyl_left/DactylSplitKeyboard.h"

#define NUM_ROWS LEFT_NUM_ROWS
#define NUM_COLS LEFT_NUM_COLS

static SplitSendQueue sendQueue;
static DactylSplitKeyboard bleKeyboard(sendQueue);

static ComboRuntime comboRuntime[MAX_COMBOS];
static uint16_t KEYMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
static uint16_t HOLDMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
static uint16_t DTAPMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
static String layerNames[NUM_LAYERS] = {
  "Base", "Nav & Pfeile", "Symbole", "Numpad", "Function", "Media", "Shortcuts", "Custom"
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

static String deviceName = DEFAULT_DEVICE_NAME;
static uint8_t debounceMs = 5;
static uint16_t comboTimeoutMs = 40;
static uint16_t tappingTermMs = 200;
static uint32_t standbyTimeoutMinutes = 5;
static uint32_t deepSleepTimeoutMinutes = 60;

static uint8_t numCombos = 0;
static KeyCombo userCombos[MAX_COMBOS];
static uint8_t numKeyPairs = 0;
static KeyPair userKeyPairs[MAX_KEY_PAIRS];
static uint8_t numMacros = 0;
static uint8_t macroLengths[MAX_MACROS] = {0};
static MacroStep userMacros[MAX_MACROS][MAX_MACRO_STEPS];

static SemaphoreHandle_t configMutex = xSemaphoreCreateMutex();
static Preferences preferences;
static BLECharacteristic mockChar;
static BLECharacteristic* pConfigCharacteristic = &mockChar;

void handleConfigCommand(String cmd, bool fromBle = false);
void sendConfigNotification(String msg, bool addDelay = false);

// Wie dactyl_left.ino: Makro-Schritte warten auf freien Platz in der Sendewarteschlange
#define MACRO_OUTPUT_READY() queueHasRoomForMacro(sendQueue)
#include "../dactyl_right/DactylLogic.h"

static int testsRun = 0;
static int testsPassed = 0;

static void resetState() {
  for (int l = 0; l < NUM_LAYERS; l++) {
    momentaryLayers[l] = toggleLayers[l] = false;
    for (int r = 0; r < NUM_ROWS; r++)
      for (int c = 0; c < NUM_COLS; c++) KEYMAP[l][r][c] = HOLDMAP[l][r][c] = DTAPMAP[l][r][c] = 0;
  }
  for (int r = 0; r < NUM_ROWS; r++)
    for (int c = 0; c < NUM_COLS; c++) {
      keyState[r][c] = keySentToHost[r][c] = false;
      pressedAction[r][c] = 0;
      keyPressTime[r][c] = 0;
    }
  resetTapHold();
  resetDoubleTap();
  numCombos = 0;
  numKeyPairs = 0;
  numMacros = 0;
  for (int i = 0; i < MAX_MACROS; i++) macroLengths[i] = 0;
  macroRun = {};
  isConfigMode = false;
  setMillis(1000);
  // Gehaltene Eingaben des vorigen Tests vergessen; Master hat einmal bestätigt: Proxy meldet "verbunden".
  // Die Warteschlange erst danach leeren (onSendResult kann nach einem Zeitsprung RELEASE_ALL einreihen).
  bleKeyboard.releaseAll();
  bleKeyboard.onSendResult(true, millis());
  queueReset(sendQueue);
  Serial.clear();
}

#define TEST(name) void name(); \
  struct Runner_##name { Runner_##name() { \
    testsRun++; \
    std::cout << "[ RUN      ] " << #name << std::endl; \
    resetState(); \
    name(); \
    testsPassed++; \
    std::cout << "[       OK ] " << #name << std::endl; \
  } } instance_##name; \
  void name()

// Liest alle eingereihten Ereignisse (ohne Senden) in Reihenfolge
static std::vector<SplitHidEvent> drain() {
  std::vector<SplitHidEvent> out;
  for (uint8_t i = 0; i < sendQueue.count; i++) out.push_back(sendQueue.items[(sendQueue.head + i) % SPLIT_QUEUE_SIZE]);
  queueReset(sendQueue);
  return out;
}

static bool is(const SplitHidEvent &ev, uint8_t op, uint16_t code, int8_t arg = 0) {
  return ev.op == op && ev.code == code && ev.arg == arg;
}

static void tap(uint8_t r, uint8_t c) {
  keyState[r][c] = true;
  onMatrixKeyChange(r, c, true);
  advanceMillis(20);
  keyState[r][c] = false;
  onMatrixKeyChange(r, c, false);
}

TEST(test_plain_key_press_and_release) {
  KEYMAP[0][2][1] = 'a';
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 2);
  assert(is(ev[0], SPLIT_OP_KEY_PRESS, 'a'));
  assert(is(ev[1], SPLIT_OP_KEY_RELEASE, 'a'));
  for (const SplitHidEvent &e : ev) assert(isValidSplitHidEvent(e));
}

TEST(test_momentary_layer_changes_sent_code) {
  KEYMAP[0][4][4] = ACT_MO_1;
  KEYMAP[0][1][1] = 'q';
  KEYMAP[1][1][1] = KEY_F1;
  keyState[4][4] = true;
  onMatrixKeyChange(4, 4, true);
  tap(1, 1);
  keyState[4][4] = false;
  onMatrixKeyChange(4, 4, false);
  tap(1, 1);
  std::vector<SplitHidEvent> ev = drain();
  // Layer-Taste selbst sendet nichts an den Host
  assert(ev.size() == 4);
  assert(is(ev[0], SPLIT_OP_KEY_PRESS, KEY_F1) && is(ev[1], SPLIT_OP_KEY_RELEASE, KEY_F1));
  assert(is(ev[2], SPLIT_OP_KEY_PRESS, 'q') && is(ev[3], SPLIT_OP_KEY_RELEASE, 'q'));
}

TEST(test_mod_tap_hold_sends_modifier) {
  KEYMAP[0][3][0] = 'z';
  HOLDMAP[0][3][0] = KEY_LEFT_SHIFT;
  keyState[3][0] = true;
  onMatrixKeyChange(3, 0, true);
  advanceMillis(TAPPING_TERM_MS + 5);
  processDeferredKeys(millis());
  keyState[3][0] = false;
  onMatrixKeyChange(3, 0, false);
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 2);
  assert(is(ev[0], SPLIT_OP_KEY_PRESS, KEY_LEFT_SHIFT));
  assert(is(ev[1], SPLIT_OP_KEY_RELEASE, KEY_LEFT_SHIFT));
}

TEST(test_mod_tap_tap_sends_tap_action) {
  KEYMAP[0][3][0] = 'z';
  HOLDMAP[0][3][0] = KEY_LEFT_SHIFT;
  tap(3, 0);
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 2);
  assert(is(ev[0], SPLIT_OP_KEY_PRESS, 'z') && is(ev[1], SPLIT_OP_KEY_RELEASE, 'z'));
}

TEST(test_media_globe_and_mouse_are_forwarded) {
  KEYMAP[0][0][1] = ACT_MAC_GLOBE;
  KEYMAP[0][0][2] = ACT_MEDIA_MUTE;
  KEYMAP[0][0][3] = ACT_MOUSE_LEFT;
  KEYMAP[0][0][4] = ACT_MOUSE_WHEEL_DOWN;
  tap(0, 1);
  tap(0, 2);
  tap(0, 3);
  tap(0, 4);
  std::vector<SplitHidEvent> ev = drain();
  for (const SplitHidEvent &e : ev) assert(isValidSplitHidEvent(e));
  assert(is(ev[0], SPLIT_OP_MEDIA_PRESS, 0x0400) && is(ev[1], SPLIT_OP_MEDIA_RELEASE, 0x0400));
  // Einmal-Aktionen kommen als PRESS + RELEASE (idempotent bei Retry-Duplikaten), nie als *_WRITE/CLICK
  uint16_t mute = splitMediaBits(KEY_MEDIA_MUTE);
  assert(is(ev[2], SPLIT_OP_MEDIA_PRESS, mute) && is(ev[3], SPLIT_OP_MEDIA_RELEASE, mute));
  assert(is(ev[4], SPLIT_OP_MOUSE_PRESS, MOUSE_BUTTON_LEFT) && is(ev[5], SPLIT_OP_MOUSE_RELEASE, MOUSE_BUTTON_LEFT));
  assert(ev[6].op == SPLIT_OP_MOUSE_SCROLL && ev[6].arg < 0);
  assert(ev.size() == 7);
}

TEST(test_one_shot_actions_never_use_write_or_click_ops) {
  bleKeyboard.write((uint8_t)'a');
  bleKeyboard.write(KEY_MEDIA_VOLUME_UP);
  bleKeyboard.mouseClick(MOUSE_BUTTON_RIGHT);
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 6);
  assert(is(ev[0], SPLIT_OP_KEY_PRESS, 'a') && is(ev[1], SPLIT_OP_KEY_RELEASE, 'a'));
  uint16_t vol = splitMediaBits(KEY_MEDIA_VOLUME_UP);
  assert(is(ev[2], SPLIT_OP_MEDIA_PRESS, vol) && is(ev[3], SPLIT_OP_MEDIA_RELEASE, vol));
  assert(is(ev[4], SPLIT_OP_MOUSE_PRESS, MOUSE_BUTTON_RIGHT) && is(ev[5], SPLIT_OP_MOUSE_RELEASE, MOUSE_BUTTON_RIGHT));
}

TEST(test_one_shot_on_held_input_keeps_it_held) {
  // Wie KEY_WRITE/MOUSE_CLICK auf dem Master: ein Tippen löst eine gehaltene Eingabe nicht
  bleKeyboard.press((uint8_t)KEY_LEFT_SHIFT);
  bleKeyboard.mousePress(MOUSE_BUTTON_LEFT);
  bleKeyboard.press(KEY_MEDIA_MUTE);
  drain();
  assert(bleKeyboard.write((uint8_t)KEY_LEFT_SHIFT) == 0);
  bleKeyboard.mouseClick(MOUSE_BUTTON_LEFT);
  assert(bleKeyboard.write(KEY_MEDIA_MUTE) == 0);
  assert(drain().empty());
  bleKeyboard.release((uint8_t)KEY_LEFT_SHIFT);
  drain();
  assert(bleKeyboard.write((uint8_t)KEY_LEFT_SHIFT) == 1);
  assert(drain().size() == 2);
  bleKeyboard.releaseAll(); // vergisst alle gehaltenen Eingaben
  drain();
  bleKeyboard.mouseClick(MOUSE_BUTTON_LEFT);
  assert(drain().size() == 2);
}

TEST(test_link_recovery_sends_release_all) {
  // Ausfall länger als SPLIT_LINK_DOWN_MS: DactylLogic.h sendet kein Loslassen. Der Master hält die Taste
  // noch bis SPLIT_LINK_TIMEOUT_MS. Kommt der Link vorher zurück, gleicht RELEASE_ALL beide Seiten ab.
  KEYMAP[0][2][1] = 'a';
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  drain();
  advanceMillis(SPLIT_LINK_DOWN_MS + 200);
  assert(!bleKeyboard.isConnected());
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false); // Loslassen geht verloren
  assert(drain().empty());
  assert(SPLIT_LINK_DOWN_MS + 200 < SPLIT_LINK_TIMEOUT_MS);
  bleKeyboard.onSendResult(true, millis()); // Heartbeat kommt wieder durch
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 1 && is(ev[0], SPLIT_OP_RELEASE_ALL, 0));
  // Danach kein weiteres RELEASE_ALL bei normalem Betrieb
  advanceMillis(500);
  bleKeyboard.onSendResult(true, millis());
  assert(drain().empty());
}

TEST(test_first_ack_on_fresh_proxy_sends_no_release_all) {
  // Frischer Proxy ohne jede Bestätigung (wie nach dem Booten): die erste Bestätigung ist kein Wiederaufbau
  SplitSendQueue freshQueue;
  queueReset(freshQueue);
  DactylSplitKeyboard fresh(freshQueue);
  setMillis(SPLIT_LINK_DOWN_MS * 10);
  assert(!fresh.isConnected());
  fresh.onSendResult(true, millis());
  assert(fresh.isConnected());
  assert(freshQueue.count == 0);
}

TEST(test_first_ack_and_short_gap_send_no_release_all) {
  advanceMillis(SPLIT_LINK_DOWN_MS - 1);
  bleKeyboard.onSendResult(true, millis());
  assert(drain().empty());
  bleKeyboard.onSendResult(false, millis() + SPLIT_LINK_DOWN_MS * 3);
  assert(drain().empty());
}

TEST(test_disconnected_master_sends_nothing) {
  KEYMAP[0][2][1] = 'a';
  advanceMillis(SPLIT_LINK_DOWN_MS);
  assert(!bleKeyboard.isConnected());
  tap(2, 1);
  assert(drain().empty());
}

TEST(test_link_state_follows_send_results) {
  assert(bleKeyboard.isConnected());
  advanceMillis(SPLIT_LINK_DOWN_MS - 1);
  assert(bleKeyboard.isConnected());
  advanceMillis(1);
  assert(!bleKeyboard.isConnected());
  bleKeyboard.onSendResult(false, millis());
  assert(!bleKeyboard.isConnected());
  bleKeyboard.onSendResult(true, millis());
  assert(bleKeyboard.isConnected());
}

TEST(test_config_combo_is_mirrored_and_suppressed) {
  KEYMAP[0][0][5] = '5';
  KEYMAP[0][4][0] = KEY_LEFT_CTRL;
  keyState[0][5] = true;
  keyState[4][0] = true;
  assert(isConfigComboSuppressed(0, 5));
  assert(isConfigComboSuppressed(4, 0));
  assert(!isConfigComboSuppressed(0, 0));
  assert(!isConfigComboSuppressed(4, 5));
}

TEST(test_queue_full_counts_dropped_events) {
  for (int i = 0; i < SPLIT_QUEUE_SIZE; i++) assert(bleKeyboard.press((uint8_t)('a' + (i % 26))) == 1);
  uint32_t before = bleKeyboard.droppedEvents();
  assert(bleKeyboard.press('z') == 0);
  bleKeyboard.releaseAll();
  assert(bleKeyboard.droppedEvents() == before + 2);
}

TEST(test_zero_codes_are_not_sent) {
  assert(bleKeyboard.press((uint8_t)0) == 0);
  bleKeyboard.mouseScroll(0);
  bleKeyboard.mousePress(0);
  assert(drain().empty());
}

TEST(test_get_info_reports_left_names) {
  handleConfigCommand("GET_INFO", false);
  bool found = false;
  for (const std::string &l : Serial.outputLines) {
    if (l.find("DEVICE_INFO:") == 0) {
      found = true;
      assert(l.find("\"name\":\"Dactyl Links\"") != std::string::npos);
      assert(l.find("\"side\":\"L\"") != std::string::npos);
      assert(l.find("\"fw\":" + std::to_string(DACTYL_FW_VERSION) + ",") != std::string::npos);
      assert(l.find("left_fw") == std::string::npos);
    }
  }
  assert(found);
  Serial.clear();
  isConfigMode = true;
  handleConfigCommand("GET_INFO", false);
  assert(Serial.outputLines.back().find("\"name\":\"Dactyl Config L\"") != std::string::npos);
}

// Umlaut auf der linken Hälfte: die Tottaste geht als einzelne PRESS/RELEASE-Ereignisse in Reihenfolge an den
// Master (jedes Ereignis ist dort ein eigener HID-Report); ein gehaltenes Shift wird gelöst und wiederhergestellt
TEST(test_umlaut_sequence_is_queued_in_order) {
  KEYMAP[0][2][4] = ACT_UMLAUT_OE;
  KEYMAP[0][3][0] = KEY_LEFT_SHIFT;
  keyState[3][0] = true;
  onMatrixKeyChange(3, 0, true);
  drain();
  keyState[2][4] = true;
  onMatrixKeyChange(2, 4, true);
  std::vector<SplitHidEvent> ev = drain();
  const uint8_t P = SPLIT_OP_KEY_PRESS, R = SPLIT_OP_KEY_RELEASE;
  const SplitHidEvent expected[] = {
    { R, 0, KEY_LEFT_SHIFT }, { P, 0, KEY_LEFT_ALT }, { P, 0, 'u' }, { R, 0, 'u' }, { R, 0, KEY_LEFT_ALT },
    { P, 0, 'o' }, { R, 0, 'o' }, { P, 0, KEY_LEFT_SHIFT }
  };
  assert(ev.size() == sizeof(expected) / sizeof(expected[0]));
  for (size_t i = 0; i < ev.size(); i++) {
    assert(is(ev[i], expected[i].op, expected[i].code));
    assert(splitEventRetryable(ev[i]));                // PRESS/RELEASE sind idempotent und dürfen wiederholt werden
  }
  keyState[2][4] = false;
  onMatrixKeyChange(2, 4, false);
  assert(drain().empty());                              // das Loslassen sendet nichts nach
}


// One-Shot-Modifier und Caps Word gehen als eigene Ops an den Master, der den Zustand führt
TEST(test_one_shot_and_caps_word_are_forwarded) {
  KEYMAP[0][5][1] = ACT_OSM_LSHIFT;
  KEYMAP[0][5][2] = ACT_CAPS_WORD;
  tap(5, 1);
  tap(5, 2);
  std::vector<SplitHidEvent> ev = drain();
  for (const SplitHidEvent &e : ev) assert(isValidSplitHidEvent(e));
  assert(ev.size() == 3);
  assert(is(ev[0], SPLIT_OP_ONE_SHOT_PRESS, 0x02) && is(ev[1], SPLIT_OP_ONE_SHOT_RELEASE, 0x02));
  assert(is(ev[2], SPLIT_OP_CAPS_WORD_TOGGLE, 0));
}

// RELEASE_ALL löst eine gehaltene One-Shot-Taste auf dem Master (splitReleaseHeld, ohne Vormerken)
TEST(test_one_shot_held_is_released_by_release_all) {
  KEYMAP[0][5][1] = ACT_OSM_LCTRL;
  keyState[5][1] = true;
  onMatrixKeyChange(5, 1, true);
  bleKeyboard.releaseAll();
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 2);
  assert(is(ev[0], SPLIT_OP_ONE_SHOT_PRESS, 0x01) && is(ev[1], SPLIT_OP_RELEASE_ALL, 0));
}
// Ein langes Makro reiht nur bei freiem Platz ein: es wartet an einer fast vollen Warteschlange, statt
// Ereignisse zu verwerfen, und lässt MACRO_QUEUE_RESERVE Plätze für die Tasten des Users frei.
TEST(test_macro_waits_for_send_queue_room) {
  handleConfigCommand("ADD_MACRO", false);
  for (int i = 0; i < MAX_MACRO_STEPS; i++) handleConfigCommand("ADD_MACRO_STEP 1 97 0", false);
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
  uint32_t droppedBefore = bleKeyboard.droppedEvents();
  // Warteschlange bis knapp vor die Reserve füllen (z. B. ein hängender Versand)
  while (queueHasRoomForMacro(sendQueue)) queuePush(sendQueue, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  uint8_t filled = sendQueue.count;
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  for (int i = 0; i < 200; i++) {
    advanceMillis(1);
    processDeferredKeys(millis());
  }
  assert(sendQueue.count == filled);                    // kein Makro-Ereignis, aber das Makro läuft weiter
  assert(macroRun.active && macroRun.step == 0);
  assert(bleKeyboard.droppedEvents() == droppedBefore);

  // Der Master holt Pakete ab: das Makro setzt fort und verliert keinen Schritt
  queueReset(sendQueue);
  std::vector<SplitHidEvent> all;
  for (int i = 0; i < 2000 && macroRun.active; i++) {
    advanceMillis(1);
    processDeferredKeys(millis());
    std::vector<SplitHidEvent> ev = drain();
    all.insert(all.end(), ev.begin(), ev.end());
  }
  assert(!macroRun.active);
  assert(all.size() == 2 * MAX_MACRO_STEPS);
  for (size_t i = 0; i < all.size(); i += 2) {
    assert(is(all[i], SPLIT_OP_KEY_PRESS, 'a') && is(all[i + 1], SPLIT_OP_KEY_RELEASE, 'a'));
  }
  assert(bleKeyboard.droppedEvents() == droppedBefore);
}

int main() {
  std::cout << "==================================================" << std::endl;
  std::cout << "  Dactyl Left Split-Keyboard Proxy Test Suite" << std::endl;
  std::cout << "==================================================" << std::endl;

  std::cout << "\nRan " << testsRun << " tests. All " << testsPassed << " passed successfully!" << std::endl;
  return (testsRun == testsPassed) ? 0 : 1;
}
