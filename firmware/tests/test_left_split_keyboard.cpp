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

#ifndef NUM_ROWS
#define NUM_ROWS LEFT_NUM_ROWS
#endif
#ifndef NUM_COLS
#define NUM_COLS LEFT_NUM_COLS
#endif

static SplitSendQueue sendQueue;
static DactylSplitKeyboard bleKeyboard(sendQueue);

static ComboRuntime comboRuntime[MAX_COMBOS];
static uint16_t KEYMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
static uint16_t HOLDMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
static uint16_t DTAPMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
static uint16_t TAPTERMMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
static uint16_t HOLDFLAVORMAP[NUM_LAYERS][NUM_ROWS][NUM_COLS] = {{{0}}};
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
static uint16_t quickTapMs = 0;
static uint16_t requirePriorIdleMs = 0;
static uint8_t chordalHold = 0;
static uint64_t chordalHoldExclusions = 0;
static uint8_t retroTap = 0;
static uint8_t numWordLayer = 1;
static uint8_t bootLayer = 0;
static uint8_t autoShift = 0;
static uint16_t autoShiftMs = 175;
static uint8_t holdTapMode = 0;
static uint8_t triLayerRules[6] = {0, 0, 0, 0, 0, 0};
static uint8_t numTriLayers = 0;
static uint8_t capsLedEnabled = 0;
static uint32_t standbyTimeoutMinutes = 5;
static uint32_t deepSleepTimeoutMinutes = 60;

static uint8_t numCombos = 0;
static KeyCombo userCombos[MAX_COMBOS];
static uint8_t numKeyPairs = 0;
static uint8_t numAltRepeats = 0;
static AltRepeatPair userAltRepeats[MAX_ALT_REPEATS];
static KeyPair userKeyPairs[MAX_KEY_PAIRS];
static uint8_t numLeaderSeqs = 0;
static LeaderSeq userLeaderSeqs[MAX_LEADER_SEQS];
static uint16_t leaderTimeoutMs = 1000;
static uint16_t oneShotTimeoutMs = 0;
static uint16_t layerTimeoutMs = 0;
static uint8_t autoMouseLayer = AUTO_MOUSE_LAYER_OFF;
static uint16_t mouseTimeoutMs = MOUSE_TIMEOUT_DEFAULT_MS;
static uint8_t numMacros = 0;
static uint8_t macroLengths[MAX_MACROS] = {0};
static bool userMacroRepeat[MAX_MACROS] = {false};
static MacroStep userMacros[MAX_MACROS][MAX_MACRO_STEPS];

static SemaphoreHandle_t configMutex = xSemaphoreCreateMutex();
static Preferences preferences;
static BLECharacteristic mockChar;
static BLECharacteristic* pConfigCharacteristic = &mockChar;
[[maybe_unused]] static BLECharacteristic* pOtaCharacteristic = &mockChar;

void handleConfigCommand(String cmd, bool fromBle = false);
void sendConfigNotification(String msg, bool addDelay = false);

// Wie dactyl_left.ino: Makro-Schritte warten auf freien Platz in der Sendewarteschlange
#define MACRO_OUTPUT_READY() queueHasRoomForMacro(sendQueue)
// Wie dactyl_left.ino: TAP_PENDING 0 direkt hinter jedem nachgeholten Tipp
static SplitTapPendingReporter tapPendingReporter = {};
static void onDoubleTapFlushed();
#define DOUBLE_TAP_FLUSHED() onDoubleTapFlushed()
#include "../dactyl_right/DactylLogic.h"

static void onDoubleTapFlushed() {
  queueTapPendingIfChanged(sendQueue, tapPendingReporter, !isConfigMode && bleKeyboard.isConnected(),
                           anyDoubleTapWaiting());
}

static int testsRun = 0;
static int testsPassed = 0;

static void resetState() {
  for (int r = 0; r < NUM_ROWS; r++)
    for (int c = 0; c < NUM_COLS; c++) comboPressLayer1[r][c] = 0;
  for (int l = 0; l < NUM_LAYERS; l++) {
    momentaryLayers[l] = toggleLayers[l] = false;
    for (int r = 0; r < NUM_ROWS; r++)
      for (int c = 0; c < NUM_COLS; c++) KEYMAP[l][r][c] = HOLDMAP[l][r][c] = DTAPMAP[l][r][c] = TAPTERMMAP[l][r][c] = 0;
  }
  for (int r = 0; r < NUM_ROWS; r++)
    for (int c = 0; c < NUM_COLS; c++) {
      keyState[r][c] = keySentToHost[r][c] = false;
      pressedAction[r][c] = 0;
      keyPressTime[r][c] = 0;
    }
  resetTapHold();
  resetDoubleTap();
  tapPendingReporter = {};
  numCombos = 0;
  numKeyPairs = 0;
  numLeaderSeqs = 0;
  leaderReset();
  for (int r = 0; r < NUM_ROWS; r++) for (int c = 0; c < NUM_COLS; c++) leaderConsumed[r][c] = leaderBuffered[r][c] = keyLockBuffered[r][c] = false;
  numMacros = 0;
  for (int i = 0; i < MAX_MACROS; i++) { macroLengths[i] = 0; userMacroRepeat[i] = false; }
  macroRun = {};
  lastRepeatAction = 0;
  for (int r = 0; r < NUM_ROWS; r++)
    for (int c = 0; c < NUM_COLS; c++) { repeatResolved[r][c] = 0; repeatRemote[r][c] = false; }
  isConfigMode = false;
  autoMouseLayer = AUTO_MOUSE_LAYER_OFF;
  mouseTimeoutMs = MOUSE_TIMEOUT_DEFAULT_MS;
  autoMouseOn = false;
  autoMouseLastMs = 0;
  setMillis(1000);
  // Gehaltene Eingaben des vorigen Tests vergessen; Master hat einmal bestätigt: Proxy meldet "verbunden".
  // Die Warteschlange erst danach leeren (onSendResult kann nach einem Zeitsprung RELEASE_ALL einreihen).
  bleKeyboard.releaseAll();
  bleKeyboard.resetQuietStandby();
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
  // Ein Druck einer physischen Taste trägt arg 1 (sperrbar für KEY_LOCK); die Tests unten prüfen arg gezielt
  bool lockableOp = op == SPLIT_OP_KEY_PRESS || op == SPLIT_OP_MOUSE_PRESS;
  bool argOk = ev.arg == arg || (lockableOp && arg == 0 && ev.arg == 1);
  return ev.op == op && ev.code == code && argOk;
}

static void tap(uint8_t r, uint8_t c) {
  keyState[r][c] = true;
  onMatrixKeyChange(r, c, true);
  advanceMillis(20);
  keyState[r][c] = false;
  onMatrixKeyChange(r, c, false);
}

TEST(test_auto_mouse_on_left_half_activates_expires_and_reports_layer) {
  KEYMAP[0][2][1] = ACT_MOUSE_LEFT;
  tap(2, 1);                                    // ohne Einstellung bleibt die Ebene aus
  assert(!autoMouseOn);
  drain();
  autoMouseLayer = 3;
  mouseTimeoutMs = 200;
  tap(2, 1);
  assert(autoMouseOn && getActiveLayer() == 3);
  assert((localMomentaryLayerMask() & (1u << 3)) != 0);   // die Ebene geht als MO-Ebene an den Master
  autoMouseExpire(millis() + 100);
  assert(autoMouseOn);
  autoMouseExpire(millis() + 400);
  assert(!autoMouseOn && getActiveLayer() == 0);
  autoMouseNote(millis());
  oslClearAll();                                // RELEASE_ALL, Link-Ausfall, Standby-Pfad
  assert(!autoMouseOn);
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
  uint32_t mute = splitMediaBits(KEY_MEDIA_MUTE);
  assert(is(ev[2], SPLIT_OP_MEDIA_PRESS, mute) && is(ev[3], SPLIT_OP_MEDIA_RELEASE, mute));
  assert(is(ev[4], SPLIT_OP_MOUSE_PRESS, MOUSE_BUTTON_LEFT) && is(ev[5], SPLIT_OP_MOUSE_RELEASE, MOUSE_BUTTON_LEFT));
  assert(ev[6].op == SPLIT_OP_MOUSE_SCROLL && ev[6].arg < 0);
  assert(ev.size() == 7);
}

TEST(test_key_pair_with_globe_is_forwarded) {
  numKeyPairs = 1;
  userKeyPairs[0] = { ACT_MAC_GLOBE, KEY_LEFT_SHIFT };
  KEYMAP[0][1][1] = ACT_KEY_PAIR_BASE + 0;
  tap(1, 1);
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 4);
  for (const SplitHidEvent &e : ev) assert(isValidSplitHidEvent(e));
  assert(is(ev[0], SPLIT_OP_MEDIA_PRESS, 0x0400));
  assert(is(ev[1], SPLIT_OP_KEY_PRESS, KEY_LEFT_SHIFT));
  assert(is(ev[2], SPLIT_OP_KEY_RELEASE, KEY_LEFT_SHIFT));
  assert(is(ev[3], SPLIT_OP_MEDIA_RELEASE, 0x0400));
}

TEST(test_mouse_move_is_forwarded_as_move_event) {
  bleKeyboard.mouseMove(3, -2);
  bleKeyboard.mouseMove(0, 0);      // keine Bewegung: nichts senden
  bleKeyboard.mouseMove(-128, 1);   // ungültiger Wert: nichts senden
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 1);
  assert(isValidSplitHidEvent(ev[0]));
  assert(ev[0].op == SPLIT_OP_MOUSE_MOVE && ev[0].arg == 3 && (int8_t)ev[0].code == -2);
}

TEST(test_mouse_move_never_takes_the_reserved_queue_room) {
  // 100 Schritte pro Sekunde dürfen dem Release einer Taste nie den Platz in der Warteschlange nehmen
  for (int i = 0; i < SPLIT_QUEUE_SIZE * 2; i++) bleKeyboard.mouseMove(1, 0);
  assert(sendQueue.count <= SPLIT_DIAG_QUEUE_LIMIT);
  assert(bleKeyboard.droppedEvents() == 0);
  bleKeyboard.press((uint8_t)'a');
  bleKeyboard.release((uint8_t)'a');
  assert(sendQueue.count <= SPLIT_DIAG_QUEUE_LIMIT + 2);
  drain();
}

TEST(test_one_shot_actions_never_use_write_or_click_ops) {
  bleKeyboard.write((uint8_t)'a');
  bleKeyboard.write(KEY_MEDIA_VOLUME_UP);
  bleKeyboard.mouseClick(MOUSE_BUTTON_RIGHT);
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 6);
  assert(is(ev[0], SPLIT_OP_KEY_PRESS, 'a') && is(ev[1], SPLIT_OP_KEY_RELEASE, 'a'));
  uint32_t vol = splitMediaBits(KEY_MEDIA_VOLUME_UP);
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

TEST(test_left_sends_new_system_keys_and_pan_over_the_wire) {
  bleKeyboard.write(KEY_MEDIA_LAUNCHPAD);
  bleKeyboard.mousePan(-2);
  bleKeyboard.mousePan(0);
  bleKeyboard.mouseScroll(3);
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 4);
  for (const SplitHidEvent &e : ev) assert(isValidSplitHidEvent(e));
  // Launchpad ist Bit 19: code trägt die Bits 0..15 (0), arg die Bits 16..19 (8)
  assert(ev[0].op == SPLIT_OP_MEDIA_PRESS && ev[0].code == 0 && ev[0].arg == 8);
  assert(ev[1].op == SPLIT_OP_MEDIA_RELEASE && ev[1].code == 0 && ev[1].arg == 8);
  // Pan: SCROLL mit code 1; Mausrad: code 0
  assert(ev[2].op == SPLIT_OP_MOUSE_SCROLL && ev[2].code == 1 && ev[2].arg == -2);
  assert(ev[3].op == SPLIT_OP_MOUSE_SCROLL && ev[3].code == 0 && ev[3].arg == 3);
  // Eine gehaltene neue Taste blockiert ein Tippen darauf wie bei den bisherigen
  bleKeyboard.press(KEY_MEDIA_BRIGHTNESS_UP);
  drain();
  assert(bleKeyboard.write(KEY_MEDIA_BRIGHTNESS_UP) == 0);
  bleKeyboard.release(KEY_MEDIA_BRIGHTNESS_UP);
  std::vector<SplitHidEvent> rel = drain();
  assert(rel.size() == 1 && rel[0].op == SPLIT_OP_MEDIA_RELEASE && rel[0].code == 0 && rel[0].arg == 1);
}

TEST(test_zero_codes_are_not_sent) {
  assert(bleKeyboard.press((uint8_t)0) == 0);
  bleKeyboard.mouseScroll(0);
  bleKeyboard.mousePress(0);
  assert(drain().empty());
}

TEST(test_left_rejects_caps_led_command) {
  Serial.clear();
  mockChar.value.clear();
  handleConfigCommand("SET_CAPS_LED 1", false);
  assert(mockChar.value.rfind("ERR UNKNOWN", 0) == 0);
  assert(capsLedEnabled == 0);
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
      // Die linke Hälfte hat keinen Host: weder Zustand noch Setting
      assert(l.find("host_leds") == std::string::npos && l.find("caps_led") == std::string::npos);
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

TEST(test_clear_state_key_is_forwarded_to_the_master) {
  KEYMAP[0][5][1] = ACT_CLEAR_STATE;
  tap(5, 1);
  std::vector<SplitHidEvent> ev = drain();
  for (const SplitHidEvent &e : ev) assert(isValidSplitHidEvent(e));
  assert(ev.size() == 2 && is(ev[0], SPLIT_OP_RELEASE_ALL, 0) && is(ev[1], SPLIT_OP_CLEAR_STATE, 0));
}

TEST(test_sentence_case_toggle_is_forwarded) {
  KEYMAP[0][5][1] = ACT_SENTENCE_CASE;
  tap(5, 1);
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 1 && isValidSplitHidEvent(ev[0]) && is(ev[0], SPLIT_OP_SENTENCE_CASE_TOGGLE, 0));
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

// Wiederholendes Makro auf der linken Hälfte: läuft von vorn, solange die Taste gehalten wird, und endet beim Loslassen
TEST(test_repeating_macro_runs_while_key_held_and_stops_on_release) {
  handleConfigCommand("ADD_MACRO 1", false);
  handleConfigCommand("ADD_MACRO_STEP 1 97 0", false);
  KEYMAP[0][2][1] = ACT_MACRO_BASE + 0;
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  std::vector<SplitHidEvent> all;
  for (int i = 0; i < 300; i++) {
    advanceMillis(1);
    processDeferredKeys(millis());
    std::vector<SplitHidEvent> ev = drain();
    all.insert(all.end(), ev.begin(), ev.end());
  }
  assert(macroRun.active && all.size() >= 8);          // mehrere Durchläufe
  keyState[2][1] = false;
  onMatrixKeyChange(2, 1, false);
  for (int i = 0; i < 50; i++) {
    advanceMillis(1);
    processDeferredKeys(millis());
    std::vector<SplitHidEvent> ev = drain();
    all.insert(all.end(), ev.begin(), ev.end());
  }
  assert(!macroRun.active);
  int presses = 0, releases = 0;
  for (const SplitHidEvent &e : all) { presses += is(e, SPLIT_OP_KEY_PRESS, 'a'); releases += is(e, SPLIT_OP_KEY_RELEASE, 'a'); }
  assert(presses == releases && presses >= 4);         // kein Code bleibt gedrückt
}

// Wie loop() in dactyl_left.ino (serviceTapPending): TAP_FLUSH des Masters sendet den wartenden Tipp, danach
// meldet TAP_PENDING 0. Der Tipp steht in der Warteschlange vor der 0: der Master führt ihn zuerst aus.
TEST(test_master_tap_flush_sends_waiting_tap_before_pending_zero) {
  KEYMAP[0][2][1] = 'j';
  DTAPMAP[0][2][1] = KEY_ESC;
  SplitTapPendingReporter &rep = tapPendingReporter;
  volatile bool flushRequested = false;
  tap(2, 1);
  serviceTapPending(sendQueue, rep, flushRequested, bleKeyboard.isConnected(), flushAllDoubleTaps, anyDoubleTapWaiting);
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 1 && is(ev[0], SPLIT_OP_TAP_PENDING, 1));
  // Ohne Anforderung wartet der Tipp weiter
  serviceTapPending(sendQueue, rep, flushRequested, bleKeyboard.isConnected(), flushAllDoubleTaps, anyDoubleTapWaiting);
  assert(drain().empty() && anyDoubleTapWaiting());
  advanceMillis(10);
  flushRequested = true;  // onEspNowRecv: SPLIT_OP_TAP_FLUSH
  serviceTapPending(sendQueue, rep, flushRequested, bleKeyboard.isConnected(), flushAllDoubleTaps, anyDoubleTapWaiting);
  assert(!flushRequested);
  ev = drain();
  assert(ev.size() == 3);
  assert(is(ev[0], SPLIT_OP_KEY_PRESS, 'j') && is(ev[1], SPLIT_OP_KEY_RELEASE, 'j'));
  assert(is(ev[2], SPLIT_OP_TAP_PENDING, 0));
}

// Eine linke Taste nach dem wartenden Tipp: TAP_PENDING 0 steht zwischen dem Tipp und der neuen Taste. Der Master
// lässt seine zurückgehaltenen Tasten so vor der neuen Taste laufen, aber nach dem Tipp.
TEST(test_left_key_after_waiting_tap_reports_pending_zero_before_its_press) {
  KEYMAP[0][2][1] = 'j';
  DTAPMAP[0][2][1] = KEY_ESC;
  KEYMAP[0][2][2] = 'k';
  tap(2, 1);
  queueTapPendingIfChanged(sendQueue, tapPendingReporter, true, anyDoubleTapWaiting());
  assert(drain().size() == 1);
  advanceMillis(10);
  keyState[2][2] = true;
  onMatrixKeyChange(2, 2, true);
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 4);
  assert(is(ev[0], SPLIT_OP_KEY_PRESS, 'j') && is(ev[1], SPLIT_OP_KEY_RELEASE, 'j'));
  assert(is(ev[2], SPLIT_OP_TAP_PENDING, 0) && is(ev[3], SPLIT_OP_KEY_PRESS, 'k'));
}

TEST(test_tap_pending_reset_after_espnow_setup) {
  SplitTapPendingReporter rep = {true};
  volatile bool flushRequested = true;
  tapPendingReset(rep, flushRequested);
  assert(!rep.reported && !flushRequested);
}

// -----------------------------------------------------------------------------
// Repeat-Taste links (SPLIT_OP_REPEAT, leftRepeatPress / leftRepeatRelease / Notiz)
// -----------------------------------------------------------------------------
static LeftRepeatLink repeatLink;

TEST(test_left_alt_repeat_key_queues_the_alt_press_code) {
  repeatLink = {};
  assert(leftRepeatPress(repeatLink, sendQueue, 2, 3, true));
  assert(leftRepeatPress(repeatLink, sendQueue, 4, 1));
  leftRepeatRelease(repeatLink, sendQueue, 2, 3, []() {});
  auto ev = drain();
  assert(ev.size() == 3);
  assert(ev[0].op == SPLIT_OP_REPEAT && ev[0].code == SPLIT_REPEAT_CODE_ALT_PRESS && ev[0].arg == 1);
  assert(ev[1].op == SPLIT_OP_REPEAT && ev[1].code == 1 && ev[1].arg == 2);   // Repeat bleibt code 1
  assert(ev[2].code == 0 && ev[2].arg == 1);                                  // Loslassen wie bei Repeat
}

TEST(test_left_repeat_key_queues_numbered_press_and_release) {
  repeatLink = {};
  assert(leftRepeatPress(repeatLink, sendQueue, 2, 3));
  assert(leftRepeatPress(repeatLink, sendQueue, 4, 1));
  leftRepeatRelease(repeatLink, sendQueue, 2, 3, []() {});
  leftRepeatRelease(repeatLink, sendQueue, 2, 3, []() {});          // zweites Loslassen sendet nichts
  leftRepeatRelease(repeatLink, sendQueue, 4, 1, []() {});
  auto ev = drain();
  assert(ev.size() == 4);
  assert(ev[0].op == SPLIT_OP_REPEAT && ev[0].code == 1 && ev[0].arg == 1);
  assert(ev[1].op == SPLIT_OP_REPEAT && ev[1].code == 1 && ev[1].arg == 2);
  assert(ev[2].code == 0 && ev[2].arg == 1);                        // Loslassen trägt die Nummer des Drückens
  assert(ev[3].code == 0 && ev[3].arg == 2);
}

TEST(test_left_repeat_numbers_stay_within_one_to_127) {
  repeatLink = {};
  repeatLink.counter = 126;
  leftRepeatPress(repeatLink, sendQueue, 0, 0);
  leftRepeatPress(repeatLink, sendQueue, 0, 1);
  auto ev = drain();
  assert(ev[0].arg == 127 && ev[1].arg == 1);
}

TEST(test_left_repeat_release_drains_a_full_queue_first) {
  repeatLink = {};
  leftRepeatPress(repeatLink, sendQueue, 1, 1);
  queueReset(sendQueue);                                           // Nummer bleibt, Warteschlange ist leer
  for (int i = 0; i < SPLIT_QUEUE_SIZE; i++) queuePush(sendQueue, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  assert(sendQueue.count == SPLIT_QUEUE_SIZE);
  int drained = 0;
  leftRepeatRelease(repeatLink, sendQueue, 1, 1, [&]() { drained++; queueReset(sendQueue); });
  assert(drained == 1);                                            // das Loslassen leert die Warteschlange und geht raus
  auto ev = drain();
  assert(ev.size() == 1 && ev[0].op == SPLIT_OP_REPEAT && ev[0].code == 0);
}

TEST(test_left_repeat_press_on_a_full_queue_forgets_the_number) {
  repeatLink = {};
  for (int i = 0; i < SPLIT_QUEUE_SIZE; i++) queuePush(sendQueue, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  assert(leftRepeatPress(repeatLink, sendQueue, 1, 1));            // die Taste gilt als übergeben
  assert(repeatLink.keySeq[1][1] == 0);                            // aber ohne Nummer: kein Loslassen ohne Drücken
  int drained = 0;
  leftRepeatRelease(repeatLink, sendQueue, 1, 1, [&]() { drained++; });
  assert(drained == 0);
}

TEST(test_left_repeat_note_waits_for_room_and_is_never_dropped) {
  repeatLink = {};
  leftRepeatNoteRecorded(repeatLink);
  for (int i = 0; i < SPLIT_QUEUE_SIZE; i++) queuePush(sendQueue, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  leftRepeatServiceNote(repeatLink, sendQueue, 1000);
  assert(repeatLink.noteDue);                                      // keine Platz: die Notiz bleibt vorgemerkt
  queueReset(sendQueue);
  leftRepeatServiceNote(repeatLink, sendQueue, 1010);
  assert(!repeatLink.noteDue);
  auto ev = drain();
  assert(ev.size() == 1 && ev[0].op == SPLIT_OP_REPEAT && ev[0].code == 2 && ev[0].arg == 0);
  leftRepeatServiceNote(repeatLink, sendQueue, 1020);              // genau eine Notiz je Aufzeichnung
  assert(sendQueue.count == 0);
}

TEST(test_left_repeat_note_is_resent_while_an_action_is_recorded) {
  repeatLink = {};
  leftRepeatNoteRecorded(repeatLink);
  leftRepeatServiceNote(repeatLink, sendQueue, 1000);
  drain();
  // Kein Paket vor Ablauf des Abstands
  leftRepeatServiceNote(repeatLink, sendQueue, 1000 + LEFT_REPEAT_NOTE_EVERY_MS - 1);
  assert(sendQueue.count == 0);
  // Danach wieder: ein neu gestarteter Master oder ein verlorenes Paket lernt den Stand doch noch
  leftRepeatServiceNote(repeatLink, sendQueue, 1000 + LEFT_REPEAT_NOTE_EVERY_MS);
  auto ev = drain();
  assert(ev.size() == 1 && ev[0].op == SPLIT_OP_REPEAT && ev[0].code == 2);
  // Ohne aufgezeichnete Aktion links gibt es nichts zu wiederholen
  repeatLink = {};
  leftRepeatServiceNote(repeatLink, sendQueue, 99999);
  assert(sendQueue.count == 0);
}


// -----------------------------------------------------------------------------
// Mod-Tap über beide Hälften, linke Seite (HOLD_PENDING melden, HOLD_RESOLVE beantworten, Tasten zurückhalten)
// -----------------------------------------------------------------------------
static void queueLayerState() {
  // Wie queueSplitLayerStateIfDue in dactyl_left.ino: ein geänderter Layer-Zustand geht in die Warteschlange
  static SplitLayerSync sync;
  static bool init = false;
  if (!init) { splitLayerReset(sync, 1); init = true; }
  splitLayerSendIfDue(sync, localMomentaryLayerMask(), toggleLayerMask(), false, millis(), true,
                      [](const SplitHidEvent &ev) { return queuePush(sendQueue, ev); });
}

TEST(test_layer_timeout_clear_reaches_the_layer_sync_of_the_master) {
  layerTimeoutMs = 1000;
  toggleLayers[2] = true;
  SplitLayerSync sync;
  splitLayerReset(sync);
  std::vector<SplitHidEvent> sent;
  auto send = [&](const SplitHidEvent &ev) { sent.push_back(ev); return true; };
  splitLayerSendIfDue(sync, localMomentaryLayerMask(), toggleLayerMask(), true, 0, true, send);
  layerTimeoutExpire(0);
  layerTimeoutExpire(1000);
  assert(toggleLayerMask() == 0);
  sent.clear();
  assert(splitLayerSendIfDue(sync, localMomentaryLayerMask(), toggleLayerMask(), true, 1001, false, send));
  assert(sent.size() == 1 && sent[0].op == SPLIT_OP_LAYER_STATE && splitLayerToggles(sent[0]) == 0);
}

TEST(test_left_layer_lock_reaches_master_through_layer_state) {
  KEYMAP[0][5][1] = ACT_MO_3;
  KEYMAP[3][2][2] = ACT_LAYER_LOCK;
  queueLayerState();              // Ausgangszustand melden, damit die Änderung als SET geht
  drain();
  keyState[5][1] = true;
  onMatrixKeyChange(5, 1, true);
  tap(2, 2);
  keyState[5][1] = false;
  onMatrixKeyChange(5, 1, false);
  queueLayerState();
  std::vector<SplitHidEvent> ev = drain();
  assert(!ev.empty() && ev.back().op == SPLIT_OP_LAYER_STATE);
  assert(splitLayerMomentary(ev.back()) == 0 && splitLayerIsSet(ev.back()) && (splitLayerToggles(ev.back()) & (1 << 3)));
  assert(getActiveLayer() == 3);
}

TEST(test_left_reports_open_mod_tap_key_and_zero_after_decision) {
  KEYMAP[0][5][1] = KEY_DELETE;
  HOLDMAP[0][5][1] = ACT_MO_1;
  SplitHoldReporter rep = {};
  auto send = [](const SplitHidEvent &ev) { return queuePush(sendQueue, ev); };
  // Nichts offen: kein Paket
  splitHoldReportIfChanged(rep, true, anyTapHoldPending(), send);
  assert(drain().empty());
  // Taste gedrückt, noch unentschieden: HOLD_PENDING 1, genau einmal
  keyState[5][1] = true;
  onMatrixKeyChange(5, 1, true);
  assert(anyTapHoldPending());
  splitHoldReportIfChanged(rep, true, anyTapHoldPending(), send);
  splitHoldReportIfChanged(rep, true, anyTapHoldPending(), send);
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 1 && is(ev[0], SPLIT_OP_HOLD_PENDING, 1));
  // Tapping-Term abgelaufen: entschieden als Halten, HOLD_PENDING 0
  advanceMillis(TAPPING_TERM_MS + 5);
  processDeferredKeys(millis());
  assert(!anyTapHoldPending());
  splitHoldReportIfChanged(rep, true, anyTapHoldPending(), send);
  ev = drain();
  assert(ev.size() == 1 && is(ev[0], SPLIT_OP_HOLD_PENDING, 0));
}

TEST(test_left_hold_resolve_decides_open_key_as_hold_and_reports_layer_before_zero) {
  // Wie in der Schleife von dactyl_left.ino: HOLD_RESOLVE entscheiden, dann Layer-Zustand, dann HOLD_PENDING
  KEYMAP[0][5][1] = KEY_DELETE;
  HOLDMAP[0][5][1] = ACT_MO_1;
  KEYMAP[1][2][2] = KEY_F2;
  SplitHoldReporter rep = {};
  auto send = [](const SplitHidEvent &ev) { return queuePush(sendQueue, ev); };
  keyState[5][1] = true;
  onMatrixKeyChange(5, 1, true);
  splitHoldReportIfChanged(rep, true, anyTapHoldPending(), send);
  queueLayerState();              // Ausgangszustand (Ebene 0) wird einmal gemeldet
  drain();
  assert(getActiveLayer() == 0);
  // Der Master hält X zurück und sendet HOLD_RESOLVE; links entscheidet sofort, ohne den Tapping-Term abzuwarten
  advanceMillis(10);
  resolveAllPendingTapHoldsAsHold();
  assert(!anyTapHoldPending() && getActiveLayer() == 1 && momentaryLayers[1]);
  queueLayerState();
  splitHoldReportIfChanged(rep, true, anyTapHoldPending(), send);
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 2);
  assert(ev[0].op == SPLIT_OP_LAYER_STATE && splitLayerMomentary(ev[0]) == 0x02);   // MO_1 gehalten
  assert(is(ev[1], SPLIT_OP_HOLD_PENDING, 0));                                        // erst danach "entschieden"
  // Die Taste hat die Halte-Aktion gewählt und nichts an den Host gesendet (eine Layer-Taste sendet keinen Code)
  assert(pressedAction[5][1] == ACT_MO_1);
  // Ein späterer linker Druck sieht die Ebene 1
  tap(2, 2);
  ev = drain();
  assert(ev.size() == 2 && is(ev[0], SPLIT_OP_KEY_PRESS, KEY_F2) && is(ev[1], SPLIT_OP_KEY_RELEASE, KEY_F2));
}

TEST(test_left_hold_resolve_without_open_key_changes_nothing) {
  KEYMAP[0][2][1] = 'a';
  resolveAllPendingTapHoldsAsHold();
  assert(!anyTapHoldPending() && drain().empty() && getActiveLayer() == 0);
  // Eine Taste ohne Halte-Aktion ist nie unentschieden
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  assert(!anyTapHoldPending());
}

TEST(test_left_open_mod_tap_key_resolved_as_tap_when_released_in_time) {
  // Ohne Druck der anderen Hälfte bleibt ein schneller Tipp ein Tipp (kein Verhalten ändert sich ohne HOLD_RESOLVE)
  KEYMAP[0][5][1] = KEY_DELETE;
  HOLDMAP[0][5][1] = ACT_MO_1;
  tap(5, 1);
  assert(!anyTapHoldPending());
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 2 && is(ev[0], SPLIT_OP_KEY_PRESS, KEY_DELETE) && is(ev[1], SPLIT_OP_KEY_RELEASE, KEY_DELETE));
}

TEST(test_left_combo_consumes_open_key_and_clears_pending) {
  // Eine Combo verbraucht beide Tasten: die Mod-Tap-Entscheidung entfällt, HOLD_PENDING 0 folgt
  KEYMAP[0][2][1] = 'j';
  HOLDMAP[0][2][1] = KEY_LEFT_CTRL;
  KEYMAP[0][2][2] = 'k';
  cancelTapHoldForCombo(2, 1);
  keyState[2][1] = true;
  onMatrixKeyChange(2, 1, true);
  assert(anyTapHoldPending());
  cancelTapHoldForCombo(2, 1);
  assert(!anyTapHoldPending());
}

// Zurückhalten links: der Master meldet eine offene Mod-Tap-Taste, eine eigene Änderung wartet auf seine Entscheidung
static std::vector<std::string> leftDeferLog;
static void leftDeferApply(uint8_t r, uint8_t c, bool pressed, unsigned long) {
  leftDeferLog.push_back(std::string(pressed ? "d" : "u") + std::to_string(r) + std::to_string(c));
}

TEST(test_left_key_is_held_back_while_master_hold_is_pending_and_requests_resolve_once) {
  MasterHoldState m = {};
  SplitLocalDefer d;
  splitDeferReset(d);
  leftDeferLog.clear();
  unsigned long now = millis();
  // Ohne Meldung des Masters: sofort ausführen
  splitDeferApplyOrHold(d, 1, 1, true, masterHoldPending(m, now), now, leftDeferApply);
  assert((leftDeferLog == std::vector<std::string>{"d11"}) && d.count == 0);
  // Der Master meldet eine offene Taste: die nächste Änderung wartet
  masterHoldNote(m, true, now);
  splitDeferApplyOrHold(d, 2, 2, true, masterHoldPending(m, now), now, leftDeferApply);
  splitDeferApplyOrHold(d, 2, 2, false, masterHoldPending(m, now), now + 5, leftDeferApply);   // hinter der älteren
  assert(leftDeferLog.size() == 1 && d.count == 2);
  assert(splitDeferTakeResolveRequest(d) && !splitDeferTakeResolveRequest(d));                // HOLD_RESOLVE einmal
  assert(!splitDeferReplayDue(d, masterHoldPending(m, now + 10), now + 10));
  // Der Master meldet 0: beide Änderungen laufen in ihrer Reihenfolge
  masterHoldNote(m, false, now + 20);
  assert(splitDeferReplayDue(d, masterHoldPending(m, now + 20), now + 20));
  splitDeferReplay(d, leftDeferApply);
  assert((leftDeferLog == std::vector<std::string>{"d11", "d22", "u22"}) && d.count == 0);
}

TEST(test_left_held_back_key_runs_after_the_time_limit_without_a_zero) {
  MasterHoldState m = {};
  SplitLocalDefer d;
  splitDeferReset(d);
  leftDeferLog.clear();
  unsigned long now = millis();
  masterHoldNote(m, true, now);
  splitDeferApplyOrHold(d, 3, 3, true, masterHoldPending(m, now), now, leftDeferApply);
  assert(!splitDeferReplayDue(d, masterHoldPending(m, now + SPLIT_TAP_FLUSH_TIMEOUT_MS - 1), now + SPLIT_TAP_FLUSH_TIMEOUT_MS - 1));
  assert(splitDeferReplayDue(d, masterHoldPending(m, now + SPLIT_TAP_FLUSH_TIMEOUT_MS), now + SPLIT_TAP_FLUSH_TIMEOUT_MS));
}

TEST(test_master_hold_note_expires_and_reset_clears_it) {
  MasterHoldState m = {};
  masterHoldNote(m, true, 1000);
  assert(masterHoldPending(m, 1000 + SPLIT_HOLD_PENDING_MAX_MS - 1));
  assert(!masterHoldPending(m, 1000 + SPLIT_HOLD_PENDING_MAX_MS));       // eine verlorene 0 bremst nicht dauerhaft
  masterHoldNote(m, true, 0xFFFFFF00UL);
  assert(masterHoldPending(m, 0xFFFFFF00UL + 300));                       // Überlauf von millis()
  masterHoldReset(m);
  assert(!masterHoldPending(m, 0xFFFFFF00UL + 300));
  masterHoldNote(m, false, 5000);
  assert(!masterHoldPending(m, 5000));
}

TEST(test_hold_reporter_without_link_reports_again_after_link_returns) {
  SplitHoldReporter rep = {};
  auto send = [](const SplitHidEvent &ev) { return queuePush(sendQueue, ev); };
  KEYMAP[0][5][1] = KEY_DELETE;
  HOLDMAP[0][5][1] = ACT_MO_1;
  keyState[5][1] = true;
  onMatrixKeyChange(5, 1, true);
  splitHoldReportIfChanged(rep, true, anyTapHoldPending(), send);
  assert(drain().size() == 1);
  // Link weg: nichts gilt als gemeldet, nichts wird gesendet
  splitHoldReportIfChanged(rep, false, anyTapHoldPending(), send);
  assert(drain().empty() && !rep.reported);
  // Link zurück, Taste noch offen: neu melden
  splitHoldReportIfChanged(rep, true, anyTapHoldPending(), send);
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 1 && is(ev[0], SPLIT_OP_HOLD_PENDING, 1));
}

TEST(test_hold_reporter_retries_when_the_queue_is_full) {
  SplitHoldReporter rep = {};
  auto send = [](const SplitHidEvent &ev) { return queuePush(sendQueue, ev); };
  for (int i = 0; i < SPLIT_QUEUE_SIZE; i++) assert(queuePush(sendQueue, makeSplitHidEvent(SPLIT_OP_HEARTBEAT)));
  assert(!splitHoldReportIfChanged(rep, true, true, send) && !rep.reported);   // voll: nicht gemeldet
  queueReset(sendQueue);
  assert(splitHoldReportIfChanged(rep, true, true, send) && rep.reported);      // nächster Durchlauf
  assert(drain().size() == 1);
}

// -----------------------------------------------------------------------------
// Linke Schleife: zurückgehaltene Taste läuft erst nach der Ebene des Masters (leftReplayHeld, HIGH-Befund)
// -----------------------------------------------------------------------------
TEST(test_left_replay_takes_the_master_layer_before_running_the_held_key) {
  KEYMAP[0][2][2] = 'q';
  KEYMAP[1][2][2] = KEY_F2;
  MasterHoldState m = {};
  SplitLocalDefer d;
  splitDeferReset(d);
  unsigned long now = millis();
  // Der Master meldet eine offene Mod-Tap-Taste; die linke Taste (R2C2) wird zurückgehalten
  masterHoldNote(m, true, now);
  splitDeferApplyOrHold(d, 2, 2, true, masterHoldPending(m, now), now, [](uint8_t, uint8_t, bool, unsigned long) {});
  assert(d.count == 1);
  // Der Master entscheidet: erst die Ebene (Briefkasten), dann HOLD_PENDING 0. Der Briefkasten ist noch nicht gelesen.
  static bool layerTaken;
  layerTaken = false;
  masterHoldNote(m, false, now + 5);
  leftReplayHeld(d, now + 6, [&] { return masterHoldPending(m, now + 6); },
                 [&] { layerTaken = true; momentaryLayers[1] = true; },
                 [](uint8_t r, uint8_t c, bool pressed, unsigned long atMs) {
                   keyState[r][c] = pressed;
                   onMatrixKeyChange(r, c, pressed, atMs);
                 });
  assert(layerTaken && d.count == 0);
  // Die Taste lief auf Ebene 1: F2, nicht 'q'
  std::vector<SplitHidEvent> ev = drain();
  assert(!ev.empty() && is(ev[0], SPLIT_OP_KEY_PRESS, KEY_F2));
  keyState[2][2] = false;
  onMatrixKeyChange(2, 2, false);
  momentaryLayers[1] = false;
}

TEST(test_left_replay_does_not_run_while_the_master_still_waits_but_takes_the_layer) {
  MasterHoldState m = {};
  SplitLocalDefer d;
  splitDeferReset(d);
  unsigned long now = millis();
  masterHoldNote(m, true, now);
  splitDeferApplyOrHold(d, 2, 2, true, masterHoldPending(m, now), now, [](uint8_t, uint8_t, bool, unsigned long) {});
  static int layerCalls, applied;
  layerCalls = applied = 0;
  // Vor der Zeitgrenze und ohne 0: die Ebene wird übernommen (der Briefkasten leert sich), die Taste wartet
  leftReplayHeld(d, now + 10, [&] { return masterHoldPending(m, now + 10); }, [&] { layerCalls++; },
                 [](uint8_t, uint8_t, bool, unsigned long) { applied++; });
  assert(layerCalls == 1 && applied == 0 && d.count == 1);
  // Nach der Zeitgrenze läuft sie auch ohne 0
  leftReplayHeld(d, now + SPLIT_TAP_FLUSH_TIMEOUT_MS, [&] { return masterHoldPending(m, now + SPLIT_TAP_FLUSH_TIMEOUT_MS); },
                 [&] { layerCalls++; }, [](uint8_t, uint8_t, bool, unsigned long) { applied++; });
  assert(layerCalls == 2 && applied == 1 && d.count == 0);
  // Ohne zurückgehaltene Änderung passiert nichts außer dem Übernehmen der Ebene
  leftReplayHeld(d, now + 100, [&] { return false; }, [&] { layerCalls++; }, [](uint8_t, uint8_t, bool, unsigned long) { applied++; });
  assert(layerCalls == 3 && applied == 1);
}

TEST(test_left_resolve_request_only_for_a_held_press) {
  SplitLocalDefer d;
  splitDeferReset(d);
  // Wie in dactyl_left.ino: HOLD_RESOLVE nur, wenn eine zurückgehaltene Änderung ein Drücken ist
  assert(splitDeferPush(d, 1, 1, false, 100));          // Loslassen zuerst (Überlappen)
  assert(!splitDeferTakeResolveRequest(d));
  assert(splitDeferPush(d, 2, 2, true, 110));
  assert(splitDeferTakeResolveRequest(d));
  // Eine volle Warteschlange: der Aufrufer fordert erneut an, die nächste Runde sendet es
  splitDeferRequestResolveAgain(d);
  for (int i = 0; i < SPLIT_QUEUE_SIZE; i++) assert(queuePush(sendQueue, makeSplitHidEvent(SPLIT_OP_HEARTBEAT)));
  assert(splitDeferTakeResolveRequest(d));
  assert(!queuePush(sendQueue, makeSplitHidEvent(SPLIT_OP_HOLD_RESOLVE)));
  splitDeferRequestResolveAgain(d);
  queueReset(sendQueue);
  assert(splitDeferTakeResolveRequest(d) && queuePush(sendQueue, makeSplitHidEvent(SPLIT_OP_HOLD_RESOLVE)));
}

TEST(test_master_hold_note_state_is_read_before_the_time) {
  // Der Empfangs-Callback schreibt die Zeit vor dem Stand; loop() liest den Stand vor der Zeit: nie ein neuer Stand mit
  // alter Zeit. Nach 0 und danach 1 mit neuer Zeit gilt die neue Meldung.
  MasterHoldState m = {};
  masterHoldNote(m, true, 1000);
  assert(masterHoldPending(m, 1100));
  masterHoldNote(m, false, 1200);
  assert(!masterHoldPending(m, 1210));
  masterHoldNote(m, true, 5000);
  assert(masterHoldPending(m, 5100) && !masterHoldPending(m, 5000 + SPLIT_HOLD_PENDING_MAX_MS));
}

TEST(test_split_keyboard_quiet_standby_link_down_timeout) {
  // Im aktiven Modus: Link fällt nach SPLIT_LINK_DOWN_MS (2000 ms) ab
  assert(bleKeyboard.isConnected());
  advanceMillis(SPLIT_LINK_DOWN_MS - 1);
  assert(bleKeyboard.isConnected());
  advanceMillis(1);
  assert(!bleKeyboard.isConnected());

  // Link wiederherstellen
  bleKeyboard.onSendResult(true, millis());
  assert(bleKeyboard.isConnected());

  // In den Quiet Standby wechseln
  bleKeyboard.setQuietStandby(true, millis());
  // Nach 2000 ms bleibt der Link weiterhin verbunden
  advanceMillis(SPLIT_LINK_DOWN_MS);
  assert(bleKeyboard.isConnected());

  // Nach 5000 ms (ein Standby-Heartbeat-Intervall) weiterhin verbunden
  advanceMillis(SPLIT_STANDBY_REFRESH_MS - SPLIT_LINK_DOWN_MS);
  assert(bleKeyboard.isConnected());

  // Erst nach SPLIT_STANDBY_LINK_DOWN_MS (11000 ms) fällt der Link ab
  setMillis(100000);
  bleKeyboard.onSendResult(true, millis());
  drain();
  assert(bleKeyboard.isConnected());
  advanceMillis(SPLIT_STANDBY_LINK_DOWN_MS - 1);
  assert(bleKeyboard.isConnected());
  advanceMillis(1);
  assert(!bleKeyboard.isConnected());
}

TEST(test_split_keyboard_standby_exit_grace_period) {
  setMillis(50000);
  bleKeyboard.onSendResult(true, millis());
  drain();
  bleKeyboard.setQuietStandby(true, millis());

  // 4500 ms vergehen im Quiet Standby (vor dem nächsten 5000 ms Heartbeat)
  advanceMillis(4500);
  assert(bleKeyboard.isConnected());

  // Tastendruck beendet Quiet Standby: Grace Period greift sofort
  bleKeyboard.setQuietStandby(false, millis());
  assert(bleKeyboard.isConnected());

  // Wiederholte Aufrufe während des Tippens in loop() dürfen lastQuietMs nicht überschreiben
  advanceMillis(1000);
  bleKeyboard.setQuietStandby(false, millis());
  assert(bleKeyboard.isConnected());

  // Noch innerhalb der 2000 ms Grace Period (1999 ms seit Standby-Ende)
  advanceMillis(999);
  assert(bleKeyboard.isConnected());

  // Nach Ablauf der 2000 ms Grace Period (2001 ms seit Standby-Ende) verfällt der Link
  advanceMillis(2);
  bleKeyboard.setQuietStandby(false, millis());
  assert(!bleKeyboard.isConnected());

  // Sobald neues Ack eintrifft, wird der Link reaktiviert und schickt RELEASE_ALL
  bleKeyboard.onSendResult(true, millis());
  assert(bleKeyboard.isConnected());
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 1 && is(ev[0], SPLIT_OP_RELEASE_ALL, 0));
}

// Die linke Hälfte nutzt dieselbe Regel: Taste derselben Hälfte -> Tipp, Daumenreihe (Zeile 5) -> holdTapMode
TEST(test_chordal_hold_on_left_half) {
  chordalHold = 1;
  holdTapMode = 0;
  KEYMAP[0][3][0] = 'z';
  HOLDMAP[0][3][0] = KEY_LEFT_SHIFT;
  KEYMAP[0][2][1] = 'a';
  keyState[3][0] = true; onMatrixKeyChange(3, 0, true);
  advanceMillis(20);
  keyState[2][1] = true; onMatrixKeyChange(2, 1, true);
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() >= 3);
  assert(is(ev[0], SPLIT_OP_KEY_PRESS, 'z') && is(ev[1], SPLIT_OP_KEY_RELEASE, 'z') && is(ev[2], SPLIT_OP_KEY_PRESS, 'a'));
  keyState[2][1] = false; onMatrixKeyChange(2, 1, false);
  keyState[3][0] = false; onMatrixKeyChange(3, 0, false);
  drain();

  KEYMAP[0][3][0] = 'z';
  HOLDMAP[0][3][0] = KEY_LEFT_SHIFT;
  KEYMAP[0][5][3] = ' ';
  keyState[3][0] = true; onMatrixKeyChange(3, 0, true);
  advanceMillis(20);
  keyState[5][3] = true; onMatrixKeyChange(5, 3, true);   // Daumenreihe: Hold
  ev = drain();
  assert(ev.size() >= 2);
  assert(is(ev[0], SPLIT_OP_KEY_PRESS, KEY_LEFT_SHIFT) && is(ev[1], SPLIT_OP_KEY_PRESS, ' '));
  keyState[5][3] = false; onMatrixKeyChange(5, 3, false);
  keyState[3][0] = false; onMatrixKeyChange(3, 0, false);
  drain();
  chordalHold = 0;
}

// Leader auf der linken Hälfte: die Folge läuft als normale Tastenoperation zum Master, die Folgentasten senden nichts
TEST(test_leader_on_left_half_sends_only_the_action) {
  KEYMAP[0][1][0] = ACT_LEADER;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][2] = 'b';
  userLeaderSeqs[0] = { { 'a', 'b', 0, 0 }, 'z' };
  numLeaderSeqs = 1;
  tap(1, 0);
  assert(drain().empty());                        // die Leader-Taste sendet nichts
  tap(2, 1);
  tap(2, 2);
  std::vector<SplitHidEvent> ev = drain();
  bool z = false, other = false;
  for (const auto &e : ev) {
    if (e.code == 'z') z = true;
    else if ((e.op == SPLIT_OP_KEY_PRESS || e.op == SPLIT_OP_KEY_WRITE) && (e.code == 'a' || e.code == 'b')) other = true;
  }
  assert(z && !other);
  // Ohne Treffer sendet die Hälfte nichts, danach tippt a normal
  tap(1, 0);
  tap(2, 2);
  assert(drain().empty());
  tap(2, 1);
  assert(!drain().empty());
  leaderReset();
}

// Übergabe der Master-Druckzeit vom Empfangs-Callback an loop()
TEST(test_master_prior_press_handoff) {
  MasterPriorPress m = {};
  unsigned long ms = 0;
  assert(!masterPriorPressTake(m, ms));        // nichts empfangen
  masterPriorPressNote(m, 1234);
  assert(masterPriorPressTake(m, ms) && ms == 1234);
  assert(!masterPriorPressTake(m, ms));        // verbraucht
  masterPriorPressNote(m, 2000);
  masterPriorPressNote(m, 2100);               // zwei Pakete vor dem Lesen: die neuere Zeit gilt
  assert(masterPriorPressTake(m, ms) && ms == 2100);
}

// MASTER_PRESS (Master -> links) setzt die Druckzeit wie HOLD_PENDING 1: Hold nur nach einer Tipp-Pause
TEST(test_master_press_note_counts_as_prior_press) {
  MasterPriorPress m = {};
  unsigned long ms = 0;
  masterPriorPressNote(m, 500);
  assert(masterPriorPressTake(m, ms) && ms == 500);
  uint32_t seq = retroPressSeq;
  notePriorKeyPress(ms);
  assert(retroPressSeq == seq + 1);            // bricht einen offenen Retro-Tipp ab
}

// Hold nur nach einer Tipp-Pause auf der linken Hälfte: ein Druck der anderen Hälfte (Meldung des Masters) zählt
TEST(test_prior_idle_on_left_half_counts_master_press) {
  requirePriorIdleMs = 150;
  KEYMAP[0][3][0] = 'z';
  HOLDMAP[0][3][0] = KEY_LEFT_SHIFT;
  unsigned long t = millis();
  notePriorKeyPress(t);                       // Master-Taste kurz davor
  advanceMillis(60);
  keyState[3][0] = true; onMatrixKeyChange(3, 0, true);
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() >= 1 && is(ev[0], SPLIT_OP_KEY_PRESS, 'z'));   // sofort Tipp
  keyState[3][0] = false; onMatrixKeyChange(3, 0, false);
  drain();
  // Längere Pause: Taste bleibt unentschieden
  advanceMillis(400);
  keyState[3][0] = true; onMatrixKeyChange(3, 0, true);
  ev = drain();
  assert(ev.empty());
  keyState[3][0] = false; onMatrixKeyChange(3, 0, false);
  drain();
  requirePriorIdleMs = 0;
}

TEST(test_left_key_lock_sends_arm_and_lockable_presses) {
  KEYMAP[0][0][0] = ACT_KEY_LOCK;
  KEYMAP[0][2][1] = 'a';
  KEYMAP[0][2][2] = ACT_MOUSE_LEFT;
  KEYMAP[0][2][3] = ACT_MACRO_BASE;
  tap(0, 0);
  tap(2, 1);
  tap(2, 2);
  std::vector<SplitHidEvent> ev = drain();
  assert(ev.size() == 5);
  assert(ev[0].op == SPLIT_OP_KEY_LOCK && ev[0].code == 0 && ev[0].arg == 0);
  assert(ev[1].op == SPLIT_OP_KEY_PRESS && ev[1].code == 'a' && ev[1].arg == 1);
  assert(ev[2].op == SPLIT_OP_KEY_RELEASE && ev[2].code == 'a');
  assert(ev[3].op == SPLIT_OP_MOUSE_PRESS && ev[3].code == MOUSE_BUTTON_LEFT && ev[3].arg == 1);
  assert(ev[4].op == SPLIT_OP_MOUSE_RELEASE);
  for (const SplitHidEvent &e : ev) assert(isValidSplitHidEvent(e));
}

TEST(test_left_key_lock_without_master_arms_nothing) {
  KEYMAP[0][0][0] = ACT_KEY_LOCK;
  setMillis(millis() + SPLIT_LINK_DOWN_MS * 3);   // kein Sende-Ergebnis mehr: der Master gilt als weg
  assert(!bleKeyboard.isConnected());
  tap(0, 0);
  assert(drain().empty());
}

int main() {
  std::cout << "==================================================" << std::endl;
  std::cout << "  Dactyl Left Split-Keyboard Proxy Test Suite" << std::endl;
  std::cout << "==================================================" << std::endl;

  std::cout << "\nRan " << testsRun << " tests. All " << testsPassed << " passed successfully!" << std::endl;
  return (testsRun == testsPassed) ? 0 : 1;
}
