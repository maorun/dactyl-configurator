#include <cassert>
#include <iostream>
#include <string>
#include <vector>

// Getestete Logik unverändert aus firmware/dactyl_right/DactylSplitHid.h (beide Hälften)
#include "../dactyl_right/DactylSplitHid.h"

// Testschlüssel statt DactylSplitKey.h (nicht versioniert): DactylSplitCrypto.h bindet die Datei dann nicht ein
#define DACTYL_SPLIT_KEY_PRESENT 1
static const uint8_t SPLIT_ESPNOW_PMK[16] = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16};
static const uint8_t SPLIT_ESPNOW_LMK[16] = {21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36};
#include "../dactyl_right/DactylSplitCrypto.h"

static int testsRun = 0;
static int testsPassed = 0;

// Protokolliert jede HID-Ausgabe des Masters
struct RecordingSink : SplitHidSink {
  std::vector<std::string> log;
  void leftKeyPress(uint8_t c) override { log.push_back("kp" + std::to_string(c)); }
  void leftKeyRelease(uint8_t c) override { log.push_back("kr" + std::to_string(c)); }
  void leftMediaPress(uint16_t b) override { log.push_back("mp" + std::to_string(b)); }
  void leftMediaRelease(uint16_t b) override { log.push_back("mr" + std::to_string(b)); }
  void leftMousePress(uint8_t b) override { log.push_back("bp" + std::to_string(b)); }
  void leftMouseRelease(uint8_t b) override { log.push_back("br" + std::to_string(b)); }
  void leftMouseClick(uint8_t b) override { log.push_back("bc" + std::to_string(b)); }
  void leftMouseScroll(int8_t s) override { log.push_back("sc" + std::to_string(s)); }
  void leftOneShotPress(uint8_t m) override { log.push_back("op" + std::to_string(m)); }
  void leftOneShotRelease(uint8_t m, bool arm) override { log.push_back((arm ? "or" : "ox") + std::to_string(m)); }
  void leftCapsWordToggle() override { log.push_back("cw"); }
};

static SplitLeftHeld held;
static RecordingSink sink;
static SplitRxQueue rxq;

#define TEST(name) void name(); \
  struct Runner_##name { Runner_##name() { \
    testsRun++; \
    std::cout << "[ RUN      ] " << #name << std::endl; \
    splitHeldReset(held); \
    sink.log.clear(); \
    splitRxReset(rxq); \
    name(); \
    testsPassed++; \
    std::cout << "[       OK ] " << #name << std::endl; \
  } } instance_##name; \
  void name()

static bool parse(const uint8_t *mac, SplitHidEvent ev, SplitHidEvent &out) {
  return parseSplitHidPacket(mac, reinterpret_cast<const uint8_t *>(&ev), sizeof(ev), out);
}

static bool apply(uint8_t op, uint16_t code = 0, int8_t arg = 0, unsigned long now = 0) {
  return splitApplyHidEvent(held, makeSplitHidEvent(op, code, arg), now, sink);
}

static const std::vector<std::string> &L() { return sink.log; }

// -----------------------------------------------------------------------------
// Paketprüfung
// -----------------------------------------------------------------------------
TEST(test_layout_is_4_bytes_little_endian) {
  SplitHidEvent ev = makeSplitHidEvent(SPLIT_OP_MEDIA_PRESS, 0x0400, 0);
  const uint8_t *b = reinterpret_cast<const uint8_t *>(&ev);
  assert(sizeof(ev) == 4);
  assert(b[0] == SPLIT_OP_MEDIA_PRESS && b[1] == 0 && b[2] == 0x00 && b[3] == 0x04);
}

TEST(test_valid_event_per_op) {
  SplitHidEvent out;
  const SplitHidEvent ok[] = {
    makeSplitHidEvent(SPLIT_OP_HEARTBEAT),
    makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a'),
    makeSplitHidEvent(SPLIT_OP_KEY_RELEASE, 0xFF),
    makeSplitHidEvent(SPLIT_OP_KEY_WRITE, 1),
    makeSplitHidEvent(SPLIT_OP_RELEASE_ALL),
    makeSplitHidEvent(SPLIT_OP_MEDIA_PRESS, 0x0400),
    makeSplitHidEvent(SPLIT_OP_MEDIA_RELEASE, 0x0400),
    makeSplitHidEvent(SPLIT_OP_MEDIA_WRITE, 8),
    makeSplitHidEvent(SPLIT_OP_MOUSE_PRESS, 1),
    makeSplitHidEvent(SPLIT_OP_MOUSE_RELEASE, 7),
    makeSplitHidEvent(SPLIT_OP_MOUSE_CLICK, 4),
    makeSplitHidEvent(SPLIT_OP_MOUSE_SCROLL, 0, -1),
    makeSplitHidEvent(SPLIT_OP_KEY_EVENT, splitKeyEventCode(5, 6, true, 7)),
    makeSplitHidEvent(SPLIT_OP_ONE_SHOT_PRESS, 0x02),
    makeSplitHidEvent(SPLIT_OP_ONE_SHOT_RELEASE, 0xFF),
    makeSplitHidEvent(SPLIT_OP_CAPS_WORD_TOGGLE),
    makeSplitLayerEvent(0x02, 0x08, false),
    makeSplitLayerEvent(0x02, 0x08, true, 1), // links setzt nach eigener Toggle-Änderung
    makeSplitHidEvent(SPLIT_OP_FW_VERSION, 0xFFFF),
    makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 1),
    makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 0),
  };
  // Alle Ops links -> Master (LAYER_STATE als REPORT und SET, TAP_PENDING mit 1 und 0); ACTIVITY und
  // TAP_FLUSH sind die einzigen Ops nur der Rückrichtung
  assert(sizeof(ok) / sizeof(ok[0]) == SPLIT_OP_COUNT);
  for (const SplitHidEvent &ev : ok) assert(parse(SPLIT_LEFT_MAC, ev, out) && out.op == ev.op);
}

TEST(test_invalid_values_are_rejected) {
  SplitHidEvent out;
  const SplitHidEvent bad[] = {
    makeSplitHidEvent(SPLIT_OP_HEARTBEAT, 1),
    makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 0),
    makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 0x100),
    makeSplitHidEvent(SPLIT_OP_KEY_RELEASE, 'a', 1),
    makeSplitHidEvent(SPLIT_OP_RELEASE_ALL, 0, 1),
    makeSplitHidEvent(SPLIT_OP_MEDIA_PRESS, 0),
    makeSplitHidEvent(SPLIT_OP_MOUSE_PRESS, 0),
    makeSplitHidEvent(SPLIT_OP_MOUSE_CLICK, 8),
    makeSplitHidEvent(SPLIT_OP_MOUSE_SCROLL, 0, 0),
    makeSplitHidEvent(SPLIT_OP_MOUSE_SCROLL, 1, 1),
    makeSplitHidEvent(SPLIT_OP_ACTIVITY), // nur Master -> links, der Master führt sie nie aus
    makeSplitHidEvent(SPLIT_OP_KEY_EVENT, splitKeyEventCode(6, 0, true, 0)), // Zeile 6 existiert nicht
    makeSplitHidEvent(SPLIT_OP_KEY_EVENT, splitKeyEventCode(0, 7, true, 0)), // Spalte 7 existiert nicht
    makeSplitHidEvent(SPLIT_OP_KEY_EVENT, 0x0008),                           // Bit außerhalb der Maske
    makeSplitHidEvent(SPLIT_OP_KEY_EVENT, 0, 1),
    makeSplitHidEvent(SPLIT_OP_ONE_SHOT_PRESS, 0),
    makeSplitHidEvent(SPLIT_OP_ONE_SHOT_PRESS, 0x100),
    makeSplitHidEvent(SPLIT_OP_ONE_SHOT_RELEASE, 2, 1),
    makeSplitHidEvent(SPLIT_OP_CAPS_WORD_TOGGLE, 1),
    makeSplitHidEvent(SPLIT_OP_CAPS_WORD_TOGGLE, 0, 1),
    makeSplitHidEvent(SPLIT_OP_LAYER_STATE, 0x0100, 0),  // REPORT ohne Toggle-Bits
    makeSplitHidEvent(SPLIT_OP_LAYER_STATE, 0x0100, 1),  // Ebene 0 rastet nie ein
    makeSplitHidEvent(SPLIT_OP_LAYER_STATE, 0, -1),      // Master-Form kommt nie von links
    makeSplitHidEvent(SPLIT_OP_FW_VERSION, 0),           // 0 = unbekannt, nie gesendet
    makeSplitHidEvent(SPLIT_OP_FW_VERSION, 1, 1),
    makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 2),
    makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 1, 1),
    makeSplitHidEvent(SPLIT_OP_TAP_FLUSH),               // nur Master -> links
    makeSplitHidEvent(SPLIT_OP_COUNT),
    makeSplitHidEvent(0xFF),
  };
  for (const SplitHidEvent &ev : bad) assert(!parse(SPLIT_LEFT_MAC, ev, out));
}

TEST(test_foreign_sender_and_length_are_rejected) {
  SplitHidEvent out;
  SplitHidEvent ev = makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a');
  assert(!parse(SPLIT_MASTER_MAC, ev, out));
  assert(!parse(nullptr, ev, out));
  const uint8_t *data = reinterpret_cast<const uint8_t *>(&ev);
  assert(!parseSplitHidPacket(SPLIT_LEFT_MAC, data, 3, out));
  assert(!parseSplitHidPacket(SPLIT_LEFT_MAC, data, 5, out));
  assert(!parseSplitHidPacket(SPLIT_LEFT_MAC, data, -1, out));
  assert(!parseSplitHidPacket(SPLIT_LEFT_MAC, nullptr, 4, out));
}

TEST(test_media_report_roundtrip) {
  const uint8_t globe[2] = {0, 4};
  assert(splitMediaBits(globe) == 0x0400);
  uint8_t r[2];
  splitMediaReport(0x0408, r);
  assert(r[0] == 0x08 && r[1] == 0x04);
}

// -----------------------------------------------------------------------------
// Master: Zustand, Duplikate, Timeout
// -----------------------------------------------------------------------------
TEST(test_press_release_is_idempotent) {
  assert(apply(SPLIT_OP_KEY_PRESS, 0x81));
  assert(!apply(SPLIT_OP_KEY_PRESS, 0x81)); // Retry-Duplikat
  assert(splitHeldKey(held, 0x81));
  assert(apply(SPLIT_OP_KEY_RELEASE, 0x81));
  assert(!apply(SPLIT_OP_KEY_RELEASE, 0x81));
  assert((L() == std::vector<std::string>{"kp129", "kr129"}));
}

TEST(test_release_without_press_sends_nothing) {
  assert(!apply(SPLIT_OP_KEY_RELEASE, 'a'));
  assert(!apply(SPLIT_OP_MEDIA_RELEASE, 8));
  assert(!apply(SPLIT_OP_MOUSE_RELEASE, 1));
  assert(L().empty());
}

TEST(test_write_does_not_release_held_key) {
  apply(SPLIT_OP_KEY_PRESS, 'a');
  assert(!apply(SPLIT_OP_KEY_WRITE, 'a'));
  assert(apply(SPLIT_OP_KEY_WRITE, 'b'));
  assert((L() == std::vector<std::string>{"kp97", "kp98", "kr98"}));
  assert(splitHeldKey(held, 'a'));
}

TEST(test_media_and_mouse_tracking) {
  assert(apply(SPLIT_OP_MEDIA_PRESS, 0x0400));
  assert(!apply(SPLIT_OP_MEDIA_PRESS, 0x0400));
  assert(apply(SPLIT_OP_MEDIA_WRITE, 0x0008));
  assert(!apply(SPLIT_OP_MEDIA_WRITE, 0x0400));
  assert(apply(SPLIT_OP_MOUSE_PRESS, 1));
  assert(!apply(SPLIT_OP_MOUSE_CLICK, 1));
  assert(apply(SPLIT_OP_MOUSE_CLICK, 2));
  assert(apply(SPLIT_OP_MOUSE_SCROLL, 0, -3));
  assert(apply(SPLIT_OP_MOUSE_SCROLL, 0, -3)); // Scrollen ist eine Bewegung, kein Zustand
  assert((L() == std::vector<std::string>{"mp1024", "mp8", "mr8", "bp1", "bc2", "sc-3", "sc-3"}));
  assert(held.set.media == 0x0400 && held.set.mouse == 1);
}

TEST(test_release_all_releases_only_left_held_inputs) {
  apply(SPLIT_OP_KEY_PRESS, 0x81);
  apply(SPLIT_OP_KEY_PRESS, 'q');
  apply(SPLIT_OP_MEDIA_PRESS, 0x0400);
  apply(SPLIT_OP_MOUSE_PRESS, 4);
  sink.log.clear();
  assert(apply(SPLIT_OP_RELEASE_ALL));
  assert((L() == std::vector<std::string>{"kr113", "kr129", "mr1024", "br4"}));
  assert(!splitHeldAny(held));
  assert(!apply(SPLIT_OP_RELEASE_ALL)); // nichts mehr gehalten
}

TEST(test_heartbeat_keeps_link_without_output) {
  assert(!apply(SPLIT_OP_HEARTBEAT, 0, 0, 500));
  assert(L().empty());
  assert(held.linkUp && held.lastRxMs == 500);
}

TEST(test_link_timeout_releases_held_inputs_once) {
  apply(SPLIT_OP_KEY_PRESS, 0x81, 0, 1000);
  sink.log.clear();
  assert(!splitCheckLinkTimeout(held, 1000 + SPLIT_LINK_TIMEOUT_MS - 1, sink));
  assert(splitCheckLinkTimeout(held, 1000 + SPLIT_LINK_TIMEOUT_MS, sink));
  assert((L() == std::vector<std::string>{"kr129"}));
  assert(!held.linkUp);
  assert(!splitCheckLinkTimeout(held, 1000 + 2 * SPLIT_LINK_TIMEOUT_MS, sink));
  assert(L().size() == 1);
}

TEST(test_heartbeat_prevents_timeout) {
  apply(SPLIT_OP_KEY_PRESS, 'a', 0, 0);
  for (unsigned long t = 1000; t <= 10000; t += 1000) {
    apply(SPLIT_OP_HEARTBEAT, 0, 0, t);
    assert(!splitCheckLinkTimeout(held, t + 500, sink));
  }
  assert(splitHeldKey(held, 'a'));
}

TEST(test_link_timeout_across_millis_wrap) {
  const unsigned long nearWrap = ~0UL - 100;
  apply(SPLIT_OP_KEY_PRESS, 'a', 0, nearWrap);
  assert(!splitCheckLinkTimeout(held, nearWrap + 200, sink));
  assert(splitCheckLinkTimeout(held, nearWrap + SPLIT_LINK_TIMEOUT_MS, sink));
}

TEST(test_no_timeout_before_first_packet) {
  assert(!splitCheckLinkTimeout(held, 100000, sink));
  assert(L().empty());
}

// -----------------------------------------------------------------------------
// Empfangsring
// -----------------------------------------------------------------------------
TEST(test_rx_queue_fifo_full_and_wrap) {
  SplitHidEvent out;
  assert(!splitRxPop(rxq, out));
  for (int i = 0; i < SPLIT_RX_QUEUE_SIZE; i++) assert(splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 1 + i)));
  assert(!splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 200)));
  assert(rxq.dropped == 1);
  for (int i = 0; i < SPLIT_RX_QUEUE_SIZE; i++) assert(splitRxPop(rxq, out) && out.code == 1 + i);
  rxq.head = rxq.tail = 0xFFFFFFF0u;
  for (int i = 0; i < 40; i++) {
    assert(splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 1 + i)));
    assert(splitRxPop(rxq, out) && out.code == 1 + i);
  }
}

// -----------------------------------------------------------------------------
// Master: gemeinsamer Report (SplitArbitratedKeyboard) und Empfangssteuerung (splitProcessRx)
// -----------------------------------------------------------------------------
// Test-Double der BLE-HID-Klasse: protokolliert jeden Report-Aufruf
struct FakeHid {
  std::vector<std::string> log;
  bool batching = false;
  FakeHid(const char * = "", const char * = "", int = 0) {}
  size_t press(uint8_t k) { log.push_back("P" + std::to_string(k)); return 1; }
  size_t release(uint8_t k) { log.push_back("R" + std::to_string(k)); return 1; }
  size_t press(const uint8_t k[2]) { log.push_back("MP" + std::to_string(splitMediaBits(k))); return 1; }
  size_t release(const uint8_t k[2]) { log.push_back("MR" + std::to_string(splitMediaBits(k))); return 1; }
  void mousePress(uint8_t b) { log.push_back("BP" + std::to_string(b)); }
  void mouseRelease(uint8_t b) { log.push_back("BR" + std::to_string(b)); }
  void mouseClick(uint8_t b) { log.push_back("BC" + std::to_string(b)); }
  void mouseScroll(int8_t s) { log.push_back("SC" + std::to_string(s)); }
  void releaseAll() { log.push_back("ALL"); }
  void beginReportBatch() { batching = true; log.push_back("BEGIN"); }
  void endReportBatch() { batching = false; log.push_back("END"); }
};

typedef SplitArbitratedKeyboard<FakeHid> Kbd;
typedef std::vector<std::string> Log;

static void left(Kbd &k, uint8_t op, uint16_t code = 0, int8_t arg = 0, unsigned long now = 0) {
  splitApplyHidEvent(k.splitLeft, makeSplitHidEvent(op, code, arg), now, k);
}

TEST(test_right_release_keeps_key_held_by_left) {
  Kbd k("Dactyl Keyboard", "Dactyl DIY", 100);
  left(k, SPLIT_OP_KEY_PRESS, 0x81);  // linkes Shift
  k.press((uint8_t)0x81);             // rechtes Shift
  k.release((uint8_t)0x81);           // rechts los: links hält noch
  assert((k.log == Log{"P129", "P129"}));
  left(k, SPLIT_OP_KEY_RELEASE, 0x81);
  assert((k.log == Log{"P129", "P129", "R129"}));
}

TEST(test_right_shifted_char_keeps_left_shift) {
  // Links hält Shift, rechts tippt 'A': das Release von 'A' löscht im Report das Shift-Bit
  Kbd k;
  left(k, SPLIT_OP_KEY_PRESS, KEY_LEFT_SHIFT);
  k.write((uint8_t)'A');
  assert((k.log == Log{"P129", "P65", "BEGIN", "R65", "P129", "END"}));
}

TEST(test_left_shifted_char_keeps_right_shift) {
  Kbd k;
  k.press((uint8_t)KEY_LEFT_SHIFT);
  left(k, SPLIT_OP_KEY_WRITE, '!');
  assert((k.log == Log{"P129", "P33", "BEGIN", "R33", "P129", "END"}));
  // Auch ein linkes RELEASE nach PRESS (Einmal-Aktion als Paar) stellt Shift wieder her
  k.log.clear();
  left(k, SPLIT_OP_KEY_PRESS, 'A');
  left(k, SPLIT_OP_KEY_RELEASE, 'A');
  assert((k.log == Log{"P65", "BEGIN", "R65", "P129", "END"}));
}

TEST(test_shifted_char_held_by_other_half_keeps_shift) {
  // Die andere Hälfte hält ein gesetztes Zeichen ('!'): ihr implizites Shift bleibt erhalten
  Kbd k;
  left(k, SPLIT_OP_KEY_PRESS, '!');
  k.write((uint8_t)'A');
  assert((k.log == Log{"P33", "P65", "BEGIN", "R65", "P129", "END"}));
}

TEST(test_shift_release_keeps_shift_for_held_shifted_char) {
  // Spiegelfall: eine Hälfte hält 'A', die andere lässt Shift los. Das gehaltene 'A' muss groß bleiben.
  Kbd k;
  left(k, SPLIT_OP_KEY_PRESS, 'A');
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.release((uint8_t)KEY_LEFT_SHIFT);
  assert((k.log == Log{"P65", "P129"}));
  Kbd k2;
  k2.press((uint8_t)'A');
  left(k2, SPLIT_OP_KEY_PRESS, KEY_LEFT_SHIFT);
  left(k2, SPLIT_OP_KEY_RELEASE, KEY_LEFT_SHIFT);
  assert((k2.log == Log{"P65", "P129"}));
  // Ohne gesetztes Zeichen der anderen Hälfte wird Shift normal gelöst
  k2.release((uint8_t)'A');
  left(k2, SPLIT_OP_KEY_PRESS, KEY_LEFT_SHIFT);
  left(k2, SPLIT_OP_KEY_RELEASE, KEY_LEFT_SHIFT);
  assert(k2.log.back() == "R129");
}

TEST(test_release_without_shift_need_is_plain) {
  Kbd k;
  k.write((uint8_t)'A');                // niemand sonst hält Shift
  left(k, SPLIT_OP_KEY_PRESS, KEY_LEFT_SHIFT);
  k.write((uint8_t)'a');                // kleines 'a' löscht kein Shift
  left(k, SPLIT_OP_KEY_PRESS, KEY_RIGHT_SHIFT);
  assert((k.log == Log{"P65", "R65", "P129", "P97", "R97", "P133"}));
  // Nur linkes Shift-Bit betroffen: rechtes Shift (0x85) allein braucht keine Wiederherstellung
  Kbd k2;
  left(k2, SPLIT_OP_KEY_PRESS, KEY_RIGHT_SHIFT);
  k2.write((uint8_t)'A');
  assert((k2.log == Log{"P133", "P65", "R65"}));
}

TEST(test_left_release_keeps_key_held_by_right) {
  Kbd k;
  k.press((uint8_t)'a');
  left(k, SPLIT_OP_KEY_PRESS, 'a');
  left(k, SPLIT_OP_KEY_RELEASE, 'a');
  assert((k.log == Log{"P97", "P97"}));
  k.release((uint8_t)'a');
  assert(k.log.back() == "R97");
}

TEST(test_media_and_mouse_arbitration) {
  Kbd k;
  const uint8_t vol[2] = {0x20, 0};
  left(k, SPLIT_OP_MEDIA_PRESS, 0x0020);
  k.press(vol);
  k.release(vol);                     // links hält die Media-Taste
  k.mousePress(1);
  left(k, SPLIT_OP_MOUSE_PRESS, 1);
  left(k, SPLIT_OP_MOUSE_RELEASE, 1); // rechts hält den Button
  k.mouseClick(2);
  left(k, SPLIT_OP_MOUSE_PRESS, 2);
  k.mouseClick(2);                    // Klick würde den linken Button lösen
  assert((k.log == Log{"MP32", "MP32", "BP1", "BP1", "BC2", "BP2"}));
  k.mouseRelease(1);
  assert(k.log.back() == "BR1");
}

TEST(test_right_release_all_keeps_left_inputs_in_one_batch) {
  Kbd k;
  left(k, SPLIT_OP_KEY_PRESS, 0x81);
  left(k, SPLIT_OP_MEDIA_PRESS, 0x0400);
  left(k, SPLIT_OP_MOUSE_PRESS, 4);
  k.press((uint8_t)'x');
  k.log.clear();
  k.releaseAll();
  assert((k.log == Log{"BEGIN", "ALL", "P129", "MP1024", "BP4", "END"}));
  assert(!splitSetAny(k.rightHeld()));
  assert(splitHeldKey(k.splitLeft, 0x81));
}

TEST(test_right_release_all_without_left_inputs_is_plain) {
  Kbd k;
  k.press((uint8_t)'x');
  k.log.clear();
  k.releaseAll();
  assert((k.log == Log{"ALL"}));
}

TEST(test_host_loss_resets_both_halves) {
  Kbd k;
  left(k, SPLIT_OP_KEY_PRESS, 'q');
  k.press((uint8_t)'x');
  k.log.clear();
  k.splitResetForHostLoss();
  assert((k.log == Log{"ALL"}));
  assert(!splitHeldAny(k.splitLeft) && !splitSetAny(k.rightHeld()));
  // Nach dem Reset löst ein spätes Release nichts mehr aus
  left(k, SPLIT_OP_KEY_RELEASE, 'q');
  assert(k.log.size() == 1);
}

static std::vector<uint16_t> appliedCodes;
static void recordApplied(const SplitHidEvent &ev) { appliedCodes.push_back(ev.code); }

TEST(test_process_rx_applies_events_when_host_ready) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  appliedCodes.clear();
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a'));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a')); // Retry-Duplikat
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, recordApplied);
  assert(rep.applied == 1 && !rep.hostLost && !rep.overflow && !rep.linkLost);
  assert((appliedCodes == std::vector<uint16_t>{'a'}));
  assert((k.log == Log{"P97"}));
  assert(hostWas && k.splitLeft.linkUp && k.splitLeft.lastRxMs == 100);
}

TEST(test_key_event_code_round_trip) {
  uint16_t code = splitKeyEventCode(3, 5, true, 2);
  assert(splitKeyEventRow(code) == 3 && splitKeyEventCol(code) == 5);
  assert(splitKeyEventLayer(code) == 2 && splitKeyEventPressed(code));
  code = splitKeyEventCode(5, 0, false, 0);
  assert(code == 0x0050 && !splitKeyEventPressed(code));
}

static std::vector<uint16_t> keyEventCodes;
static void recordKeyEvent(const SplitHidEvent &ev) { keyEventCodes.push_back(ev.code); }

TEST(test_process_rx_reports_key_events_without_hid_effect) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  appliedCodes.clear();
  keyEventCodes.clear();
  uint16_t down = splitKeyEventCode(1, 2, true, 0);
  uint16_t up = splitKeyEventCode(1, 2, false, 0);
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a'));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_EVENT, down));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_EVENT, up));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, recordApplied, recordKeyEvent);
  // Nur das HID-Ereignis zählt als ausgeführt; das Matrix-Ereignis erzeugt keine HID-Ausgabe
  assert(rep.applied == 1);
  // Beide Matrix-Ereignisse zählen als Aktivität (Master bleibt bei linken Tasten mit Aktion 0 wach)
  assert(rep.keyEvents == 2);
  assert((appliedCodes == std::vector<uint16_t>{'a'}));
  assert((keyEventCodes == std::vector<uint16_t>{down, up}));
  assert((k.log == Log{"P97"}));
}

TEST(test_process_rx_reports_key_events_without_host) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  keyEventCodes.clear();
  uint16_t down = splitKeyEventCode(0, 0, true, 1);
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_EVENT, down));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, false, 500, nullptr, recordKeyEvent);
  // Diagnose läuft auch ohne Mac (z. B. beim Löten); der Link gilt als lebendig
  assert(rep.applied == 0 && rep.keyEvents == 1);
  assert((keyEventCodes == std::vector<uint16_t>{down}));
  assert(k.log.empty());
  assert(k.splitLeft.linkUp && k.splitLeft.lastRxMs == 500);
}

TEST(test_process_rx_limits_key_events_per_call) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  appliedCodes.clear();
  keyEventCodes.clear();
  for (int i = 0; i < SPLIT_KEY_EVENTS_PER_RX + 4; i++) {
    splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_EVENT, splitKeyEventCode(0, 0, (i & 1) == 0, 0)));
  }
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a'));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, recordApplied, recordKeyEvent);
  // Überzählige Diagnose-Ereignisse entfallen; das HID-Ereignis dahinter läuft trotzdem
  assert(keyEventCodes.size() == SPLIT_KEY_EVENTS_PER_RX);
  // Überzählige Ereignisse werden gezählt (Sammelzeile), die Aktivität zählt jedes Ereignis
  assert(rep.keyEventsDropped == 4);
  assert(rep.keyEvents == SPLIT_KEY_EVENTS_PER_RX + 4);
  assert(rep.applied == 1 && (k.log == Log{"P97"}));
  SplitHidEvent out;
  assert(!splitRxPop(rxq, out));
}

TEST(test_process_rx_without_host_keeps_link_but_sends_nothing) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a'));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, false, 500, nullptr);
  assert(rep.applied == 0 && !rep.hostLost);
  assert(k.log.empty());
  assert(!splitHeldAny(k.splitLeft));
  assert(k.splitLeft.linkUp && k.splitLeft.lastRxMs == 500);
  SplitHidEvent out;
  assert(!splitRxPop(rxq, out)); // Ring trotzdem geleert
}

TEST(test_process_rx_host_loss_transition_resets_once) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 0x81));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 0, nullptr);
  k.press((uint8_t)'x');
  k.log.clear();
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, false, 10, nullptr);
  assert(rep.hostLost);
  assert((k.log == Log{"ALL"}));
  assert(!splitHeldAny(k.splitLeft) && !splitSetAny(k.rightHeld()));
  rep = splitProcessRx(k, rxq, droppedSeen, hostWas, false, 20, nullptr);
  assert(!rep.hostLost && k.log.size() == 1); // nur beim Übergang
}

TEST(test_process_rx_overflow_releases_left_inputs) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = true;
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'q'));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 0, nullptr);
  k.press((uint8_t)'x');
  for (int i = 0; i < SPLIT_RX_QUEUE_SIZE + 1; i++) splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  assert(rxq.dropped == 1);
  k.log.clear();
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 10, nullptr);
  assert(rep.overflow);
  assert((k.log == Log{"R113"}));          // nur die linke Taste, rechtes 'x' bleibt
  assert(splitSetHasKey(k.rightHeld(), 'x'));
  assert(droppedSeen == 1);
  rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 20, nullptr);
  assert(!rep.overflow);                    // gleicher Zähler: keine zweite Meldung
}

TEST(test_process_rx_overflow_releases_after_draining) {
  // Ein PRESS liegt vor dem verworfenen Paket (dessen RELEASE) im Ring: nach dem Abarbeiten darf nichts hängen
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = true;
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'q'));
  for (int i = 1; i < SPLIT_RX_QUEUE_SIZE; i++) splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  assert(!splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_RELEASE, 'q'))); // RELEASE geht verloren
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 10, nullptr);
  assert(rep.overflow);
  assert((k.log == Log{"P113", "R113"}));
  assert(!splitHeldAny(k.splitLeft));
}

TEST(test_process_rx_link_timeout_releases_left_inputs) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = true;
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'q'));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 1000, nullptr);
  k.log.clear();
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 1000 + SPLIT_LINK_TIMEOUT_MS, nullptr);
  assert(rep.linkLost);
  assert((k.log == Log{"R113"}));
}

// -----------------------------------------------------------------------------
// Rückrichtung Master -> links (ACTIVITY)
// -----------------------------------------------------------------------------
// Wie onEspNowRecv in dactyl_left.ino: parseSplitMasterPacket, danach die Op ACTIVITY
static bool parseActivity(const uint8_t *mac, SplitHidEvent ev, int len = (int)sizeof(SplitHidEvent)) {
  SplitHidEvent out;
  return parseSplitMasterPacket(mac, reinterpret_cast<const uint8_t *>(&ev), len, out) && out.op == SPLIT_OP_ACTIVITY;
}

TEST(test_activity_packet_accepts_only_master_activity) {
  assert(SPLIT_OP_ACTIVITY == 12); // append-only: Nummer nie ändern
  assert(parseActivity(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_ACTIVITY)));
  assert(!parseActivity(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_ACTIVITY)));
  assert(!parseActivity(nullptr, makeSplitHidEvent(SPLIT_OP_ACTIVITY)));
  assert(!parseActivity(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_ACTIVITY), 3));
  assert(!parseActivity(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_ACTIVITY), 5));
  assert(!parseActivity(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_ACTIVITY, 1)));
  assert(!parseActivity(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_ACTIVITY, 0, 1)));
  assert(!parseActivity(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_HEARTBEAT)));
  assert(!parseActivity(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a')));
  assert(!parseActivity(SPLIT_MASTER_MAC, makeSplitHidEvent(0xFF)));
  SplitHidEvent out;
  assert(!parseSplitMasterPacket(SPLIT_MASTER_MAC, nullptr, 4, out));
}

// -----------------------------------------------------------------------------
// Layer-Abgleich (LAYER_STATE)
// -----------------------------------------------------------------------------
static bool parseMaster(const uint8_t *mac, SplitHidEvent ev, SplitHidEvent &out, int len = (int)sizeof(SplitHidEvent)) {
  return parseSplitMasterPacket(mac, reinterpret_cast<const uint8_t *>(&ev), len, out);
}

TEST(test_layer_event_encoding) {
  assert(SPLIT_OP_LAYER_STATE == 17); // append-only: Nummer nie ändern
  SplitHidEvent set = makeSplitLayerEvent(0x82, 0x0B, true, 5);
  // Bit 0 der Toggles (Ebene 0) entfällt; arg = Nummer des SET
  assert(set.code == (0x82 | (0x0A << 8)) && set.arg == 5);
  assert(splitLayerMomentary(set) == 0x82 && splitLayerToggles(set) == 0x0A && splitLayerIsSet(set));
  assert(!splitLayerFromMaster(set) && splitLayerSeq(set) == 5);
  // REPORT trägt keine Toggles
  SplitHidEvent rep = makeSplitLayerEvent(0x04, 0x0A, false);
  assert(rep.code == 0x04 && rep.arg == 0 && !splitLayerIsSet(rep) && splitLayerToggles(rep) == 0);
  // Master: arg < 0, zurückgemeldete Nummer in den Bits 0..6 (auch 0 = noch keine)
  SplitHidEvent m = makeSplitMasterLayerEvent(0x02, 0x0C, 127);
  assert(m.arg < 0 && splitLayerFromMaster(m) && splitLayerIsSet(m) && splitLayerSeq(m) == 127);
  assert(splitLayerToggles(m) == 0x0C && splitLayerMomentary(m) == 0x02);
  SplitHidEvent m0 = makeSplitMasterLayerEvent(0, 0, 0);
  assert(m0.arg < 0 && splitLayerSeq(m0) == 0);
}

TEST(test_master_packet_accepts_activity_and_master_layer_only) {
  SplitHidEvent out;
  assert(parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_ACTIVITY), out) && out.op == SPLIT_OP_ACTIVITY);
  SplitHidEvent m = makeSplitMasterLayerEvent(0x02, 0x04, 9);
  assert(parseMaster(SPLIT_MASTER_MAC, m, out) && out.code == m.code && out.arg == m.arg);
  // Linke Formen (REPORT, SET) kommen nie vom Master
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitLayerEvent(0x02, 0, false), out));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitLayerEvent(0x02, 0x04, true, 3), out));
  assert(!parseMaster(SPLIT_LEFT_MAC, m, out));
  assert(!parseMaster(nullptr, m, out));
  assert(!parseMaster(SPLIT_MASTER_MAC, m, out, 3));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_LAYER_STATE, 0x0100, -128), out));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_ACTIVITY, 1), out));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a'), out));
  assert(!parseSplitMasterPacket(SPLIT_MASTER_MAC, nullptr, 4, out));
  // Der Master nimmt kein Master-Paket an (arg < 0 von links ist ungültig)
  SplitHidEvent tmp;
  assert(!parse(SPLIT_LEFT_MAC, m, tmp));
}

TEST(test_layer_sync_left_sends_changes_and_set_until_echo) {
  SplitLayerSync s;
  splitLayerReset(s, 10);
  SplitHidEvent ev;
  // Erstes Paket nach dem Start meldet nur: die Toggles führt der Master
  assert(splitLayerTake(s, 0, 0x04, false, 100, true, ev) && !splitLayerIsSet(ev));
  assert(!splitLayerTake(s, 0, 0x04, false, 101, true, ev));
  // MO-Änderung: sofort, als REPORT, auch ohne Erlaubnis zum Auffrischen
  assert(splitLayerTake(s, 0x02, 0x04, false, 102, false, ev) && !splitLayerIsSet(ev) && splitLayerMomentary(ev) == 0x02);
  // Eigene Toggle-Änderung: SET mit neuer Nummer (Startwert 10 -> 11), offen bis zur Rückmeldung
  assert(splitLayerTake(s, 0x02, 0x0C, false, 103, false, ev) && splitLayerIsSet(ev) && splitLayerToggles(ev) == 0x0C);
  assert(splitLayerSeq(ev) == 11 && s.setPending);
  // Links wiederholt nicht selbst (die Sendewarteschlange hat einen Retry)
  assert(!splitLayerTake(s, 0x02, 0x0C, false, 103 + SPLIT_LAYER_REPEAT_MS, false, ev));
  // Ein Master-Paket ohne diese Nummer gilt nicht, auch mit gleichen Toggles (älteres Paket)
  assert(!splitLayerAcceptMasterToggles(s, makeSplitMasterLayerEvent(0, 0x0C, 10), 150));
  assert(!splitLayerAcceptMasterToggles(s, makeSplitMasterLayerEvent(0, 0x04, 0), 151));
  // Auffrischen nur, wenn erlaubt; mit offenem SET weiter als SET mit derselben Nummer
  assert(!splitLayerTake(s, 0x02, 0x0C, false, 103 + SPLIT_LAYER_REFRESH_MS, false, ev));
  assert(splitLayerTake(s, 0x02, 0x0C, false, 103 + SPLIT_LAYER_REFRESH_MS, true, ev) && splitLayerSeq(ev) == 11);
  // Rückmeldung der Nummer schließt das SET ab; das Auffrischen meldet danach nur
  assert(splitLayerAcceptMasterToggles(s, makeSplitMasterLayerEvent(0, 0x0C, 11), 1200));
  assert(!s.setPending);
  assert(splitLayerAcceptMasterToggles(s, makeSplitMasterLayerEvent(0, 0x10, 11), 1201));
  assert(splitLayerTake(s, 0x02, 0x0C, false, 103 + 2 * SPLIT_LAYER_REFRESH_MS, true, ev) && !splitLayerIsSet(ev));
  // Übernommene Toggles des Masters gelten als gesendet: kein Echo
  splitLayerNoteAdoptedToggles(s, 0x10);
  assert(!splitLayerTake(s, 0x02, 0x10, false, 104 + 2 * SPLIT_LAYER_REFRESH_MS, false, ev));
}

TEST(test_layer_sync_quick_on_off_toggle_needs_newest_echo) {
  SplitLayerSync s;
  splitLayerReset(s, 0);
  SplitHidEvent ev;
  splitLayerTake(s, 0, 0, false, 0, true, ev);
  // TG_1 an, gleich wieder aus: zwei SET mit Nummern 1 und 2
  assert(splitLayerTake(s, 0, 0x02, false, 10, false, ev) && splitLayerSeq(ev) == 1);
  assert(splitLayerTake(s, 0, 0x00, false, 20, false, ev) && splitLayerSeq(ev) == 2);
  // Ein älteres Master-Paket mit Toggles 0 (gleich dem Endstand) schließt das SET nicht
  assert(!splitLayerAcceptMasterToggles(s, makeSplitMasterLayerEvent(0, 0x00, 0), 25));
  // Die Rückmeldung von SET 1 auch nicht (Master noch auf Zwischenstand)
  assert(!splitLayerAcceptMasterToggles(s, makeSplitMasterLayerEvent(0, 0x02, 1), 30));
  assert(splitLayerAcceptMasterToggles(s, makeSplitMasterLayerEvent(0, 0x00, 2), 40));
}

TEST(test_layer_sync_seq_wraps_inside_1_to_127) {
  SplitLayerSync s;
  splitLayerReset(s, 126);
  SplitHidEvent ev;
  splitLayerTake(s, 0, 0, false, 0, true, ev);
  assert(splitLayerTake(s, 0, 0x02, false, 1, false, ev) && splitLayerSeq(ev) == 127 && ev.arg == 127);
  assert(splitLayerTake(s, 0, 0x00, false, 2, false, ev) && splitLayerSeq(ev) == 1 && ev.arg == 1);
  assert(isValidSplitLayerEvent(ev));
}

TEST(test_layer_sync_force_keeps_toggle_change_as_set) {
  SplitLayerSync s;
  splitLayerReset(s, 0);
  SplitHidEvent ev;
  splitLayerTake(s, 0, 0, false, 100, true, ev);
  // restartEspNow ohne offenes SET; ein Toggle im nächsten Durchlauf geht trotzdem als SET raus
  splitLayerForce(s, 200);
  assert(splitLayerTake(s, 0, 0x02, false, 201, false, ev) && splitLayerIsSet(ev) && splitLayerToggles(ev) == 0x02);
  // Ohne Änderung sendet Force einmal sofort (REPORT ohne offenes SET erst nach der Rückmeldung)
  assert(splitLayerAcceptMasterToggles(s, makeSplitMasterLayerEvent(0, 0x02, splitLayerSeq(ev)), 210));
  splitLayerForce(s, 300);
  assert(splitLayerTake(s, 0, 0x02, false, 301, false, ev) && !splitLayerIsSet(ev));
  assert(!splitLayerTake(s, 0, 0x02, false, 302, false, ev));
}

TEST(test_layer_sync_pending_set_survives_espnow_restart) {
  SplitLayerSync s;
  SplitRemoteLayers r;
  SplitLayerMailbox mb = {};
  uint32_t seen = 0;
  splitLayerReset(s, 0);
  splitRemoteLayersReset(r);
  SplitHidEvent ev;
  splitLayerTake(s, 0, 0, false, 100, true, ev);
  // Toggle während eines Ausfalls: SET liegt offen
  assert(splitLayerTake(s, 0, 0x02, false, 110, false, ev) && splitLayerIsSet(ev));
  uint8_t seq = splitLayerSeq(ev);
  // Ein Master-Paket von vor dem Neustart liegt noch im Briefkasten, eine MO-Ebene des Masters gilt
  splitLayerMailboxPut(mb, makeSplitMasterLayerEvent(0x04, 0x00, 0));
  splitRemoteLayersApply(r, makeSplitMasterLayerEvent(0x04, 0, 0), 120);
  // restartEspNow (splitLayerLeftRestart): sofort neu senden, SET bleibt offen, Altes wird verworfen
  splitLayerLeftRestart(s, r, mb, seen, 5000);
  assert(r.momentary == 0);
  SplitHidEvent stale;
  assert(!splitLayerMailboxTake(mb, seen, stale));
  assert(splitLayerTake(s, 0, 0x02, false, 5000, false, ev) && splitLayerIsSet(ev) && splitLayerSeq(ev) == seq);
  // Die Frist beginnt mit dem Neustart neu
  assert(!splitLayerAcceptMasterToggles(s, makeSplitMasterLayerEvent(0, 0, 0), 5000 + SPLIT_LAYER_SET_TIMEOUT_MS - 1));
  // Ein Paket nach dem Neustart kommt an
  splitLayerMailboxPut(mb, makeSplitMasterLayerEvent(0, 0x02, seq));
  assert(splitLayerMailboxTake(mb, seen, stale) && splitLayerSeq(stale) == seq);
}

TEST(test_layer_sync_pending_set_expires_when_master_never_confirms) {
  SplitLayerSync s;
  splitLayerReset(s, 0);
  SplitHidEvent ev;
  splitLayerTake(s, 0, 0, false, 100, true, ev);
  assert(splitLayerTake(s, 0, 0x02, false, 200, false, ev) && splitLayerIsSet(ev));
  // Rückmeldung verloren, der Master ändert seine Toggles: nach der Frist gilt sein Stand links
  assert(!splitLayerAcceptMasterToggles(s, makeSplitMasterLayerEvent(0, 0x08, 0), 200 + SPLIT_LAYER_SET_TIMEOUT_MS - 1));
  assert(splitLayerAcceptMasterToggles(s, makeSplitMasterLayerEvent(0, 0x08, 0), 200 + SPLIT_LAYER_SET_TIMEOUT_MS));
  splitLayerNoteAdoptedToggles(s, 0x08);
  // Das Auffrischen meldet danach nur (kein SET mit dem alten Stand)
  assert(splitLayerTake(s, 0, 0x08, false, 200 + SPLIT_LAYER_SET_TIMEOUT_MS + SPLIT_LAYER_REFRESH_MS, true, ev));
  assert(!splitLayerIsSet(ev));
}

TEST(test_layer_send_failure_keeps_pending_set_and_retries) {
  SplitLayerSync s;
  splitLayerReset(s, 0);
  std::vector<SplitHidEvent> sent;
  bool accept = true;
  auto send = [&](const SplitHidEvent &ev) { if (accept) sent.push_back(ev); return accept; };
  assert(splitLayerSendIfDue(s, 0, 0, false, 100, true, send));
  // Volle Warteschlange beim eigenen Toggle: nichts gesendet, aber das SET bleibt offen
  accept = false;
  assert(!splitLayerSendIfDue(s, 0, 0x02, false, 110, false, send));
  assert(s.setPending && s.setSeq == 1);
  // Ein Master-Paket mit altem Stand dazwischen überschreibt den eigenen Toggle nicht
  assert(!splitLayerAcceptMasterToggles(s, makeSplitMasterLayerEvent(0, 0, 0), 111));
  // Nächster Durchlauf: das SET geht raus
  accept = true;
  assert(splitLayerSendIfDue(s, 0, 0x02, false, 112, false, send));
  assert(sent.size() == 2 && splitLayerIsSet(sent[1]) && splitLayerToggles(sent[1]) == 0x02);
  // Dieselbe Nummer wie beim gescheiterten Versuch; ihre Rückmeldung schließt das SET
  assert(s.setPending && splitLayerSeq(sent[1]) == 1 && s.setSeq == 1);
  // Master: ein Sendefehler stellt den Stand her, der nächste Aufruf sendet die Änderung erneut
  SplitLayerSync m;
  splitLayerReset(m);
  sent.clear();
  assert(splitLayerSendIfDue(m, 0, 0, true, 0, true, send));
  accept = false;
  assert(!splitLayerSendIfDue(m, 0x02, 0, true, 50, false, send));
  accept = true;
  assert(splitLayerSendIfDue(m, 0x02, 0, true, 51, false, send));
  assert(sent.size() == 2 && splitLayerMomentary(sent[1]) == 0x02 && splitLayerFromMaster(sent[1]));
}

TEST(test_layer_unsent_set_is_dropped_when_toggle_reverts) {
  SplitLayerSync s;
  splitLayerReset(s, 0);
  std::vector<SplitHidEvent> sent;
  bool accept = true;
  auto send = [&](const SplitHidEvent &ev) { if (accept) sent.push_back(ev); return accept; };
  assert(splitLayerSendIfDue(s, 0, 0x08, false, 100, true, send));
  // TG_1 an, Warteschlange voll: SET offen, nie gesendet
  accept = false;
  assert(!splitLayerSendIfDue(s, 0, 0x0A, false, 110, false, send));
  assert(s.setPending && s.setUnsent);
  // TG_1 wieder aus, bevor das SET raus ist: kein SET mit dem alten Stand, Master-Toggles gelten wieder
  accept = true;
  assert(!splitLayerSendIfDue(s, 0, 0x08, false, 120, false, send));
  assert(!s.setPending && !s.setUnsent);
  assert(splitLayerAcceptMasterToggles(s, makeSplitMasterLayerEvent(0, 0x18, 0), 121));
  // Auffrischen meldet nur
  assert(splitLayerSendIfDue(s, 0, 0x08, false, 100 + SPLIT_LAYER_REFRESH_MS, true, send));
  assert(!splitLayerIsSet(sent.back()));
  // Ein gesendetes SET ohne Rückmeldung bleibt offen, auch wenn ein neueres SET nie rausgeht: ein älteres
  // Master-Paket nähme sonst den gesendeten Stand zurück
  assert(splitLayerSendIfDue(s, 0, 0x0A, false, 2000, false, send) && splitLayerIsSet(sent.back()));
  assert(s.setPending && !s.setUnsent);
  accept = false;
  uint8_t sentSeq = splitLayerSeq(sent.back());
  assert(!splitLayerSendIfDue(s, 0, 0x08, false, 2010, false, send));
  assert(s.setPending && !s.setUnsent && s.setSeq == sentSeq);
  // Zurück auf den gesendeten Stand: nichts zu senden, ein älteres Master-Paket gilt nicht
  assert(!splitLayerSendIfDue(s, 0, 0x0A, false, 2020, false, send));
  assert(!splitLayerAcceptMasterToggles(s, makeSplitMasterLayerEvent(0, 0x08, 0), 2021));
  // Die Rückmeldung der gesendeten Nummer schließt das SET
  assert(splitLayerAcceptMasterToggles(s, makeSplitMasterLayerEvent(0, 0x0A, sentSeq), 2022) && !s.setPending);
}

TEST(test_layer_release_event_drops_only_momentary_layers) {
  SplitLayerSync s;
  splitLayerReset(s, 0);
  s.echoSeq = 7;
  SplitHidEvent master = splitLayerReleaseEvent(s, 0x0A, true);
  assert(splitLayerMomentary(master) == 0 && splitLayerFromMaster(master) && splitLayerToggles(master) == 0x0A);
  assert(splitLayerSeq(master) == 7 && isValidSplitMasterLayerEvent(master));
  // Links ohne offenes SET: REPORT
  SplitHidEvent left = splitLayerReleaseEvent(s, 0x0A, false);
  assert(splitLayerMomentary(left) == 0 && !splitLayerIsSet(left) && isValidSplitHidEvent(left));
  // Links mit offenem SET: das SET geht mit (Toggle kurz vor Config Mode oder Deep Sleep)
  SplitHidEvent ev;
  splitLayerTake(s, 0x04, 0, false, 0, true, ev);
  splitLayerTake(s, 0x04, 0x02, false, 10, false, ev);
  SplitHidEvent leftSet = splitLayerReleaseEvent(s, 0x02, false);
  assert(splitLayerMomentary(leftSet) == 0 && splitLayerIsSet(leftSet) && splitLayerToggles(leftSet) == 0x02);
  assert(splitLayerSeq(leftSet) == s.setSeq && isValidSplitHidEvent(leftSet));
  // Am Empfänger gelten danach keine entfernten MO-Ebenen mehr
  SplitRemoteLayers r;
  splitRemoteLayersReset(r);
  splitRemoteLayersApply(r, makeSplitLayerEvent(0x04, 0, false), 10);
  splitRemoteLayersApply(r, left, 20);
  assert(r.momentary == 0);
}

TEST(test_master_after_rx_forces_send_and_clears_remote_layers) {
  SplitLayerSync s;
  SplitRemoteLayers r;
  splitLayerReset(s);
  splitRemoteLayersReset(r);
  SplitHidEvent ev;
  splitLayerTake(s, 0, 0, true, 0, true, ev);
  splitLayerTake(s, 0, 0, true, SPLIT_LAYER_REPEAT_MS, false, ev);
  assert(!splitLayerTake(s, 0, 0, true, 100, false, ev));
  // Link-Aufbau: sofort senden
  assert(!splitLayerMasterAfterRx(s, r, false, true, false, 200));
  assert(splitLayerTake(s, 0, 0, true, 200, false, ev));
  // Ohne gehaltene Ebene: nichts zu tun
  assert(!splitLayerMasterAfterRx(s, r, true, false, true, 300));
  splitRemoteLayersApply(r, makeSplitLayerEvent(0x02, 0, false), 1000);
  assert(!splitLayerMasterAfterRx(s, r, true, true, false, 1001));
  // Link-Ausfall löst sofort, ohne auf den Verfall zu warten
  assert(splitLayerMasterAfterRx(s, r, true, false, true, 1002) && r.momentary == 0);
  // Verfall ohne Link-Ausfall
  splitRemoteLayersApply(r, makeSplitLayerEvent(0x02, 0, false), 2000);
  assert(splitLayerMasterAfterRx(s, r, true, true, false, 2000 + SPLIT_LAYER_REMOTE_TIMEOUT_MS) && r.momentary == 0);
}

TEST(test_master_receive_echoes_left_set_seq) {
  SplitLayerSync s;
  SplitRemoteLayers r;
  splitLayerReset(s);
  splitRemoteLayersReset(r);
  SplitHidEvent ev;
  splitLayerTake(s, 0, 0x08, true, 0, true, ev);
  splitLayerTake(s, 0, 0x08, true, SPLIT_LAYER_REPEAT_MS, false, ev);
  // REPORT: nur MO, keine Toggles, keine neue Rückmeldung
  assert(!splitLayerMasterReceive(s, r, makeSplitLayerEvent(0x04, 0, false), 100));
  assert(r.momentary == 0x04 && s.echoSeq == 0);
  assert(!splitLayerTake(s, 0, 0x08, true, 101, false, ev));
  // SET: Toggles gelten, die Nummer geht sofort zurück (auch bei gleichen Toggles)
  assert(splitLayerMasterReceive(s, r, makeSplitLayerEvent(0x04, 0x08, true, 42), 110));
  assert(splitLayerTake(s, 0, 0x08, true, 111, false, ev) && splitLayerSeq(ev) == 42);
}

// Beide Hälften gekoppelt mit den Produktionsfunktionen von dactyl_left.ino (splitLayerLeftReceive) und
// dactyl_right.ino (splitLayerMasterReceive); der Toggle-Zustand je Hälfte steht für toggleLayers[]
struct LayerPeer {
  SplitLayerSync sync;
  SplitRemoteLayers remote;
  uint8_t mo;
  uint8_t tg;
};

static void leftReceives(LayerPeer &left, const SplitHidEvent &ev, unsigned long now) {
  if (splitLayerLeftReceive(left.sync, left.remote, ev, now)) left.tg = splitLayerToggles(ev);
}

static void masterReceives(LayerPeer &master, const SplitHidEvent &ev, unsigned long now) {
  if (splitLayerMasterReceive(master.sync, master.remote, ev, now)) master.tg = splitLayerToggles(ev);
}

TEST(test_layer_sync_both_halves_converge_after_simultaneous_toggles) {
  LayerPeer m = {}, l = {};
  splitLayerReset(m.sync);
  splitLayerReset(l.sync, 0);
  splitRemoteLayersReset(m.remote);
  splitRemoteLayersReset(l.remote);
  SplitHidEvent ev;
  // Start: Master hat TG_3 eingerastet, links übernimmt es (erstes Paket links ist REPORT)
  m.tg = 0x08;
  assert(splitLayerTake(l.sync, l.mo, l.tg, false, 0, true, ev) && !splitLayerIsSet(ev));
  masterReceives(m, ev, 0);
  assert(m.tg == 0x08);
  assert(splitLayerTake(m.sync, m.mo, m.tg, true, 0, true, ev));
  leftReceives(l, ev, 0);
  assert(l.tg == 0x08);
  // Gleichzeitig: Master schaltet TG_1 dazu, links TG_2; das Master-Paket kreuzt das linke SET
  m.tg = 0x0A;
  l.tg = 0x0C;
  SplitHidEvent fromMaster, fromLeft;
  assert(splitLayerTake(m.sync, m.mo, m.tg, true, 10, false, fromMaster));
  assert(splitLayerTake(l.sync, l.mo, l.tg, false, 10, false, fromLeft) && splitLayerIsSet(fromLeft));
  leftReceives(l, fromMaster, 15); // älteres Master-Paket: verworfen
  assert(l.tg == 0x0C);
  masterReceives(m, fromLeft, 15);
  assert(m.tg == 0x0C);
  // Die Wiederholung des Masters trägt den alten Stand und die alte Rückmeldung: verworfen
  // (sie kommt vor der Antwort auf das SET, weil der Master die Rückmeldung im nächsten Paket sendet)
  assert(splitLayerTake(m.sync, m.mo, m.tg, true, 40, false, ev));
  leftReceives(l, ev, 40);
  // Das Paket mit der Rückmeldung schließt das SET; beide Hälften haben denselben Stand
  assert(l.tg == 0x0C && !l.sync.setPending && splitLayerSeq(ev) == splitLayerSeq(fromLeft));
  // Danach übernimmt links wieder jede Änderung des Masters
  m.tg = 0x00;
  assert(splitLayerTake(m.sync, m.mo, m.tg, true, 100, false, ev));
  leftReceives(l, ev, 100);
  assert(l.tg == 0x00);
  // MO links wirkt am Master, MO am Master wirkt links
  l.mo = 0x04;
  assert(splitLayerTake(l.sync, l.mo, l.tg, false, 200, false, ev) && !splitLayerIsSet(ev));
  masterReceives(m, ev, 200);
  assert(m.remote.momentary == 0x04 && m.tg == 0x00);
  m.mo = 0x02;
  assert(splitLayerTake(m.sync, m.mo, m.tg, true, 210, false, ev));
  leftReceives(l, ev, 210);
  assert(l.remote.momentary == 0x02);
}

static std::vector<SplitHidEvent> layerEventsForOrder;
static void recordLayerForOrder(const SplitHidEvent &ev) { layerEventsForOrder.push_back(ev); }

TEST(test_master_ignores_duplicate_left_set_after_own_toggle) {
  LayerPeer m = {};
  splitLayerReset(m.sync);
  splitRemoteLayersReset(m.remote);
  SplitHidEvent ev;
  splitLayerTake(m.sync, 0, 0, true, 0, true, ev);
  // Links SET 5 mit TG_1: der Master übernimmt es und meldet 5 zurück
  SplitHidEvent set5 = makeSplitLayerEvent(0, 0x02, true, 5);
  masterReceives(m, set5, 10);
  assert(m.tg == 0x02);
  // Danach rastet der Master selbst TG_2 ein
  m.tg = 0x06;
  assert(splitLayerTake(m.sync, 0, m.tg, true, 20, false, ev) && splitLayerSeq(ev) == 5);
  // Retry oder Auffrischen von SET 5 trifft spät ein: der Master-Toggle bleibt
  masterReceives(m, set5, 30);
  assert(m.tg == 0x06);
  // Ein neues SET der linken Hälfte gilt
  masterReceives(m, makeSplitLayerEvent(0, 0x00, true, 6), 40);
  assert(m.tg == 0x00);
}

TEST(test_master_accepts_left_set_with_old_number_after_left_report) {
  LayerPeer m = {};
  splitLayerReset(m.sync);
  splitRemoteLayersReset(m.remote);
  masterReceives(m, makeSplitLayerEvent(0, 0x02, true, 9), 10);
  assert(m.sync.echoSeq == 9);
  // Linke Hälfte startet neu: ihr erstes Paket ist ein REPORT, ihr nächstes SET trägt zufällig wieder die 9
  masterReceives(m, makeSplitLayerEvent(0, 0, false), 9000);
  assert(m.sync.echoSeq == 0);
  masterReceives(m, makeSplitLayerEvent(0, 0x08, true, 9), 9001);
  assert(m.tg == 0x08 && m.sync.echoSeq == 9);
}

TEST(test_master_echoes_first_left_set_after_link_up_in_firmware_order) {
  // Wie processSplitEvents: splitProcessRx (onLayer -> splitLayerMasterReceive), danach splitLayerMasterAfterRx
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  LayerPeer m = {};
  splitLayerReset(m.sync);
  splitRemoteLayersReset(m.remote);
  SplitHidEvent ev;
  layerEventsForOrder.clear();
  // Link ist unten; das erste Paket nach dem Aufbau ist ein SET (Toggle links während des Ausfalls)
  bool linkWasUp = k.splitLeft.linkUp;
  assert(!linkWasUp);
  splitRxPush(rxq, makeSplitLayerEvent(0, 0x04, true, 33));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 500, nullptr, nullptr, recordLayerForOrder);
  for (const SplitHidEvent &e : layerEventsForOrder) masterReceives(m, e, 500);
  splitLayerMasterAfterRx(m.sync, m.remote, linkWasUp, k.splitLeft.linkUp, rep.linkLost, 500);
  assert(m.tg == 0x04);
  // Das nächste Master-Paket meldet die 33 zurück
  assert(splitLayerTake(m.sync, 0, m.tg, true, 500, false, ev) && splitLayerSeq(ev) == 33);
  // Ein Auffrischen mit derselben Nummer nimmt einen späteren Master-Toggle nicht zurück
  m.tg = 0x0C;
  masterReceives(m, makeSplitLayerEvent(0, 0x04, true, 33), 1500);
  assert(m.tg == 0x0C);
}

TEST(test_layer_sync_restore_resends_same_set) {
  SplitLayerSync s;
  splitLayerReset(s, 0);
  SplitHidEvent ev;
  splitLayerTake(s, 0, 0, false, 100, true, ev);
  // Der Aufrufer stellt den Stand vor splitLayerTake wieder her: dasselbe Paket kommt erneut
  SplitLayerSync before = s;
  assert(splitLayerTake(s, 0, 0x02, false, 110, false, ev) && splitLayerIsSet(ev));
  s = before;
  assert(splitLayerTake(s, 0, 0x02, false, 111, false, ev) && splitLayerIsSet(ev) && splitLayerToggles(ev) == 0x02);
}

TEST(test_layer_sync_master_always_sets_and_repeats_changes) {
  SplitLayerSync s;
  splitLayerReset(s);
  SplitHidEvent ev;
  assert(splitLayerTake(s, 0, 0, true, 100, true, ev) && splitLayerFromMaster(ev));
  // Wiederholung einer Änderung nach SPLIT_LAYER_REPEAT_MS (kein Retry auf dem Master)
  assert(!splitLayerTake(s, 0, 0, true, 100 + SPLIT_LAYER_REPEAT_MS - 1, false, ev));
  assert(splitLayerTake(s, 0, 0, true, 100 + SPLIT_LAYER_REPEAT_MS, false, ev) && splitLayerFromMaster(ev));
  // Nur eine Wiederholung
  assert(!splitLayerTake(s, 0, 0, true, 200, false, ev));
  assert(splitLayerTake(s, 0x02, 0, true, 300, false, ev) && splitLayerMomentary(ev) == 0x02);
  assert(splitLayerTake(s, 0x02, 0, true, 300 + SPLIT_LAYER_REPEAT_MS, false, ev));
  // Auffrischen jede Sekunde, ohne Wiederholung
  assert(splitLayerTake(s, 0x02, 0, true, 330 + SPLIT_LAYER_REFRESH_MS, true, ev));
  assert(!splitLayerTake(s, 0x02, 0, true, 330 + SPLIT_LAYER_REFRESH_MS + SPLIT_LAYER_REPEAT_MS, true, ev));
  // Force: nach Link-Aufbau sofort senden
  splitLayerForce(s, 1400);
  assert(splitLayerTake(s, 0x02, 0, true, 1400, false, ev));
}

TEST(test_remote_layers_expire_without_packets) {
  SplitRemoteLayers r;
  splitRemoteLayersReset(r);
  assert(!splitRemoteLayersExpire(r, 100000));
  splitRemoteLayersApply(r, makeSplitLayerEvent(0x02, 0, false), 1000);
  assert(r.momentary == 0x02);
  assert(!splitRemoteLayersExpire(r, 1000 + SPLIT_LAYER_REMOTE_TIMEOUT_MS - 1));
  assert(splitRemoteLayersExpire(r, 1000 + SPLIT_LAYER_REMOTE_TIMEOUT_MS) && r.momentary == 0);
  assert(!splitRemoteLayersExpire(r, 1000 + 2 * SPLIT_LAYER_REMOTE_TIMEOUT_MS));
}

TEST(test_layer_mailbox_keeps_newest_packet) {
  SplitLayerMailbox m = {};
  uint32_t seen = 0;
  SplitHidEvent out;
  assert(!splitLayerMailboxTake(m, seen, out));
  splitLayerMailboxPut(m, makeSplitMasterLayerEvent(0x02, 0, 0));
  splitLayerMailboxPut(m, makeSplitMasterLayerEvent(0x04, 0x08, 3));
  assert(splitLayerMailboxTake(m, seen, out));
  assert(out.op == SPLIT_OP_LAYER_STATE && splitLayerMomentary(out) == 0x04 && splitLayerToggles(out) == 0x08);
  assert(splitLayerFromMaster(out) && splitLayerSeq(out) == 3);
  assert(!splitLayerMailboxTake(m, seen, out));
}

TEST(test_layer_mailbox_rejects_torn_read) {
  SplitLayerMailbox m = {};
  uint32_t seen = 0;
  SplitHidEvent out;
  splitLayerMailboxPut(m, makeSplitMasterLayerEvent(0x02, 0, 0));
  // Schreiben läuft (ungerade Nummer): kein Lesen, der nächste Durchlauf liest
  m.seq = m.seq + 1;
  m.code = 0x0404;
  assert(!splitLayerMailboxTake(m, seen, out));
  assert(seen == 0);
  m.arg = (int8_t)0x80;
  m.seq = m.seq + 1;
  assert(splitLayerMailboxTake(m, seen, out) && out.code == 0x0404);
  // Verwerfen übergeht alles Eingetroffene
  splitLayerMailboxPut(m, makeSplitMasterLayerEvent(0x01, 0, 0));
  splitLayerMailboxDiscard(m, seen);
  assert(!splitLayerMailboxTake(m, seen, out));
}

static std::vector<uint16_t> layerCodes;
static void recordLayer(const SplitHidEvent &ev) { layerCodes.push_back(ev.code); }

TEST(test_process_rx_hands_layer_state_over_without_host_and_activity) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  layerCodes.clear();
  SplitHidEvent ev = makeSplitLayerEvent(0x02, 0, false);
  splitRxPush(rxq, ev);
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, false, 700, nullptr, nullptr, recordLayer);
  // Ohne HID-Wirkung, auch ohne Mac; kein Aktivitäts-Zähler (das Auffrischen hielte den Master wach)
  assert((layerCodes == std::vector<uint16_t>{ev.code}));
  assert(rep.applied == 0 && rep.keyEvents == 0 && k.log.empty());
  assert(k.splitLeft.linkUp && k.splitLeft.lastRxMs == 700);
}

static std::vector<SplitHidEvent> layerEvents;
static void recordLayerEvent(const SplitHidEvent &ev) { layerEvents.push_back(ev); }

TEST(test_process_rx_hands_over_newest_layer_packet_once) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  layerEvents.clear();
  // Eine Flut (gefälschte linke MAC) und ein SET am Ende, dazwischen ein HID-Ereignis
  for (int i = 0; i < 10; i++) splitRxPush(rxq, makeSplitLayerEvent((uint8_t)(1 << (i % 8)), 0, false));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a'));
  SplitHidEvent set = makeSplitLayerEvent(0x04, 0x08, true, 3);
  splitRxPush(rxq, set);
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, nullptr, nullptr, recordLayerEvent);
  // Nur das neueste Paket, einmal; das HID-Ereignis läuft unverändert
  assert(layerEvents.size() == 1 && layerEvents[0].code == set.code && layerEvents[0].arg == set.arg);
  assert(rep.applied == 1 && (k.log == Log{"P97"}));
  // Ohne Layer-Paket kein Aufruf
  layerEvents.clear();
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 200, nullptr, nullptr, recordLayerEvent);
  assert(layerEvents.empty());
}

TEST(test_process_rx_link_loss_clears_remote_layers_via_master_after_rx) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  LayerPeer m = {};
  splitLayerReset(m.sync);
  splitRemoteLayersReset(m.remote);
  layerEvents.clear();
  bool linkWasUp = k.splitLeft.linkUp;
  splitRxPush(rxq, makeSplitLayerEvent(0x02, 0, false));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 1000, nullptr, nullptr, recordLayerEvent);
  for (const SplitHidEvent &ev : layerEvents) masterReceives(m, ev, 1000);
  assert(!splitLayerMasterAfterRx(m.sync, m.remote, linkWasUp, k.splitLeft.linkUp, rep.linkLost, 1000));
  assert(m.remote.momentary == 0x02 && m.sync.forceSend);
  // Keine Pakete mehr: Link-Ausfall nach SPLIT_LINK_TIMEOUT_MS löst die linke MO-Ebene
  linkWasUp = k.splitLeft.linkUp;
  rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 1000 + SPLIT_LINK_TIMEOUT_MS, nullptr, nullptr, recordLayerEvent);
  assert(rep.linkLost);
  assert(splitLayerMasterAfterRx(m.sync, m.remote, linkWasUp, k.splitLeft.linkUp, rep.linkLost, 1000 + SPLIT_LINK_TIMEOUT_MS));
  assert(m.remote.momentary == 0);
}

TEST(test_activity_throttle_sends_first_note_immediately) {
  SplitActivityThrottle t;
  splitActivityReset(t);
  assert(!splitActivityTake(t, 0)); // ohne Tippen kein Paket
  splitActivityNote(t);
  assert(splitActivityTake(t, 5));
  assert(!splitActivityTake(t, 6)); // vorgemerktes Tippen ist verbraucht
}

TEST(test_activity_throttle_limits_rate_and_keeps_last_note) {
  SplitActivityThrottle t;
  splitActivityReset(t);
  splitActivityNote(t);
  assert(splitActivityTake(t, 1000));
  splitActivityNote(t);
  assert(!splitActivityTake(t, 1000 + SPLIT_ACTIVITY_INTERVAL_MS - 1));
  // Das Tippen im Intervall geht nach dessen Ablauf raus, auch ohne neuen Tastendruck
  assert(splitActivityTake(t, 1000 + SPLIT_ACTIVITY_INTERVAL_MS));
  assert(!splitActivityTake(t, 1000 + 3 * SPLIT_ACTIVITY_INTERVAL_MS));
}

TEST(test_activity_send_failure_keeps_note) {
  SplitActivityThrottle t;
  splitActivityReset(t);
  splitActivityNote(t);
  assert(splitActivityTake(t, 1000));
  splitActivitySendResult(t, false);
  // Kein neuer Tastendruck nötig: nach dem Intervall geht das Paket erneut raus
  assert(!splitActivityTake(t, 1000 + SPLIT_ACTIVITY_INTERVAL_MS - 1));
  assert(splitActivityTake(t, 1000 + SPLIT_ACTIVITY_INTERVAL_MS));
  splitActivitySendResult(t, true);
  assert(!splitActivityTake(t, 1000 + 3 * SPLIT_ACTIVITY_INTERVAL_MS));
}

TEST(test_local_key_change_notes_activity) {
  SplitActivityThrottle t;
  splitActivityReset(t);
  unsigned long last = 0;
  splitNoteLocalKeyChange(t, 4242, last);
  assert(last == 4242);
  assert(splitActivityTake(t, 4242));
}

TEST(test_activity_throttle_survives_millis_wrap) {
  SplitActivityThrottle t;
  splitActivityReset(t);
  unsigned long start = (unsigned long)-1 - 100;
  splitActivityNote(t);
  assert(splitActivityTake(t, start));
  splitActivityNote(t);
  assert(!splitActivityTake(t, start + 200)); // Überlauf: 200 ms später, nicht ein Intervall
  assert(splitActivityTake(t, start + SPLIT_ACTIVITY_INTERVAL_MS));
}


// -----------------------------------------------------------------------------
// One-Shot-Modifier und Caps Word (Zustand auf dem Master, beide Hälften)
// -----------------------------------------------------------------------------
static const uint8_t OS_SHIFT = 0x02; // Bit von KEY_LEFT_SHIFT
static const uint8_t OS_CTRL = 0x01;

TEST(test_one_shot_tap_applies_to_next_key_only) {
  Kbd k;
  k.oneShotPress(OS_SHIFT);
  k.oneShotRelease(OS_SHIFT);
  assert(k.log.empty()); // Tippen allein sendet nichts
  k.press((uint8_t)'a');
  k.release((uint8_t)'a');
  // Shift im selben Report wie 'a', im nächsten Report wieder gelöst
  assert((k.log == Log{"BEGIN", "P129", "P97", "END", "BEGIN", "R129", "END", "R97"}));
  k.log.clear();
  k.press((uint8_t)'b');
  assert((k.log == Log{"P98"}));
}

TEST(test_one_shot_left_tap_shifts_right_key) {
  // One-Shot-Shift am linken Daumen, Buchstabe rechts
  Kbd k;
  left(k, SPLIT_OP_ONE_SHOT_PRESS, OS_SHIFT);
  left(k, SPLIT_OP_ONE_SHOT_RELEASE, OS_SHIFT);
  assert(k.log.empty());
  k.press((uint8_t)'a');
  assert((k.log == Log{"BEGIN", "P129", "P97", "END", "BEGIN", "R129", "END"}));
}

TEST(test_one_shot_right_tap_shifts_left_key) {
  Kbd k;
  k.oneShotPress(OS_CTRL);
  k.oneShotRelease(OS_CTRL);
  left(k, SPLIT_OP_KEY_PRESS, 'c');
  assert((k.log == Log{"BEGIN", "P128", "P99", "END", "BEGIN", "R128", "END"}));
  k.log.clear();
  left(k, SPLIT_OP_KEY_PRESS, 'v');
  assert((k.log == Log{"P118"}));
}

TEST(test_one_shot_held_acts_as_modifier_and_does_not_arm) {
  Kbd k;
  k.oneShotPress(OS_SHIFT);
  k.press((uint8_t)'a');
  k.press((uint8_t)'b');
  k.oneShotRelease(OS_SHIFT);
  // Jeder Druck während des Haltens bekommt Shift
  assert((k.log == Log{"BEGIN", "P129", "P97", "END", "BEGIN", "R129", "END",
                       "BEGIN", "P129", "P98", "END", "BEGIN", "R129", "END"}));
  k.log.clear();
  k.press((uint8_t)'c'); // nach dem Loslassen nichts vorgemerkt
  assert((k.log == Log{"P99"}));
}

TEST(test_one_shot_second_tap_cancels) {
  Kbd k;
  for (int i = 0; i < 2; i++) {
    k.oneShotPress(OS_SHIFT);
    k.oneShotRelease(OS_SHIFT);
  }
  k.press((uint8_t)'a');
  assert((k.log == Log{"P97"}));
}

TEST(test_one_shot_stacks_modifiers) {
  Kbd k;
  k.oneShotPress(OS_CTRL);
  k.oneShotRelease(OS_CTRL);
  left(k, SPLIT_OP_ONE_SHOT_PRESS, OS_SHIFT);
  left(k, SPLIT_OP_ONE_SHOT_RELEASE, OS_SHIFT);
  k.press((uint8_t)'t');
  assert((k.log == Log{"BEGIN", "P128", "P129", "P116", "END", "BEGIN", "R128", "R129", "END"}));
}

TEST(test_one_shot_modifier_key_does_not_consume) {
  // Ein normaler Modifier (z. B. Cmd) zwischen One-Shot und Taste verbraucht die Vormerkung nicht
  Kbd k;
  k.oneShotPress(OS_SHIFT);
  k.oneShotRelease(OS_SHIFT);
  k.press((uint8_t)KEY_LEFT_GUI);
  k.press((uint8_t)'z');
  assert((k.log == Log{"P131", "BEGIN", "P129", "P122", "END", "BEGIN", "R129", "END"}));
}

TEST(test_one_shot_skips_modifier_already_in_report) {
  Kbd k;
  left(k, SPLIT_OP_KEY_PRESS, KEY_LEFT_SHIFT);
  k.oneShotPress(OS_SHIFT);
  k.oneShotRelease(OS_SHIFT);
  k.log.clear();
  k.press((uint8_t)'a');
  // Shift ist schon im Report (links gehalten): kein zusätzliches Press/Release, das es lösen würde
  assert((k.log == Log{"P97"}));
}

TEST(test_one_shot_shift_with_umlaut_dead_key) {
  // Umlaut-Folge: Alt + u (Tottaste), dann 'a'. Die Tottaste verbraucht nichts, der Vokal bekommt Shift (Ä)
  Kbd k;
  k.oneShotPress(OS_SHIFT);
  k.oneShotRelease(OS_SHIFT);
  k.press((uint8_t)KEY_LEFT_ALT);
  k.press((uint8_t)'u');
  k.release((uint8_t)'u');
  k.release((uint8_t)KEY_LEFT_ALT);
  k.log.clear();
  k.press((uint8_t)'a');
  assert((k.log == Log{"BEGIN", "P129", "P97", "END", "BEGIN", "R129", "END"}));
}

TEST(test_one_shot_applies_to_mouse_click) {
  Kbd k;
  k.oneShotPress(OS_CTRL);
  k.oneShotRelease(OS_CTRL);
  k.mouseClick(1);
  assert((k.log == Log{"BEGIN", "P128", "BC1", "END", "BEGIN", "R128", "END"}));
  k.log.clear();
  k.mouseClick(1);
  assert((k.log == Log{"BC1"}));
}

TEST(test_one_shot_release_all_and_link_loss_do_not_arm) {
  Kbd k;
  // Rechts: Combo (releaseAll) während One-Shot gehalten
  k.oneShotPress(OS_SHIFT);
  k.releaseAll();
  k.oneShotRelease(OS_SHIFT);
  // Links: Link-Ausfall während gehalten
  left(k, SPLIT_OP_ONE_SHOT_PRESS, OS_CTRL, 0, 0);
  assert(splitCheckLinkTimeout(k.splitLeft, SPLIT_LINK_TIMEOUT_MS, k));
  k.log.clear();
  k.press((uint8_t)'a');
  assert((k.log == Log{"P97"}));
  assert(k.oneShot.armed == 0);
}

TEST(test_one_shot_left_press_retry_is_idempotent) {
  Kbd k;
  left(k, SPLIT_OP_ONE_SHOT_PRESS, OS_SHIFT);
  left(k, SPLIT_OP_ONE_SHOT_PRESS, OS_SHIFT); // Retry-Duplikat
  left(k, SPLIT_OP_ONE_SHOT_RELEASE, OS_SHIFT);
  left(k, SPLIT_OP_ONE_SHOT_RELEASE, OS_SHIFT); // Retry-Duplikat
  assert(k.oneShot.armed == OS_SHIFT);
}

TEST(test_host_loss_clears_one_shot_and_caps_word) {
  Kbd k;
  k.oneShotPress(OS_SHIFT);
  k.oneShotRelease(OS_SHIFT);
  k.capsWordToggle();
  k.splitResetForHostLoss();
  k.log.clear();
  k.press((uint8_t)'a');
  assert((k.log == Log{"P97"}));
}

TEST(test_caps_word_shifts_letters_until_word_ends) {
  Kbd k;
  left(k, SPLIT_OP_CAPS_WORD_TOGGLE);
  k.write((uint8_t)'a');
  left(k, SPLIT_OP_KEY_WRITE, 'b');
  k.write((uint8_t)'-');
  k.write((uint8_t)'1');
  k.write((uint8_t)KEY_BACKSPACE);
  assert(k.oneShot.capsWord);
  k.log.clear();
  k.write((uint8_t)' '); // Leertaste beendet Caps Word
  assert(!k.oneShot.capsWord);
  assert((k.log == Log{"P32", "R32"}));
  k.log.clear();
  k.write((uint8_t)'c');
  assert((k.log == Log{"P99", "R99"}));
}

TEST(test_caps_word_letter_report) {
  Kbd k;
  k.capsWordToggle();
  k.write((uint8_t)'a');
  assert((k.log == Log{"BEGIN", "P129", "P97", "END", "BEGIN", "R129", "END", "R97"}));
  k.log.clear();
  k.write((uint8_t)'1'); // Ziffern bleiben ungeshiftet und lassen Caps Word an
  assert((k.log == Log{"P49", "R49"}) && k.oneShot.capsWord);
}

TEST(test_caps_word_toggle_off_and_modifier_keeps_it) {
  Kbd k;
  k.capsWordToggle();
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.release((uint8_t)KEY_LEFT_SHIFT);
  assert(k.oneShot.capsWord);
  k.capsWordToggle();
  k.log.clear();
  k.write((uint8_t)'a');
  assert((k.log == Log{"P97", "R97"}));
}

TEST(test_caps_word_toggle_is_not_retried) {
  assert(!splitEventRetryable(makeSplitHidEvent(SPLIT_OP_CAPS_WORD_TOGGLE)));
  assert(splitEventRetryable(makeSplitHidEvent(SPLIT_OP_ONE_SHOT_PRESS, 2)));
  assert(splitEventRetryable(makeSplitHidEvent(SPLIT_OP_ONE_SHOT_RELEASE, 2)));
}

// -----------------------------------------------------------------------------
// Verschlüsselte Strecke (DactylSplitCrypto.h)
// -----------------------------------------------------------------------------

TEST(test_split_peer_is_encrypted_with_lmk) {
  bool encrypt = false;
  uint8_t lmk[SPLIT_ESPNOW_KEY_LEN] = {};
  splitPeerSetEncryption(encrypt, lmk);
  assert(encrypt);
  assert(memcmp(lmk, SPLIT_ESPNOW_LMK, SPLIT_ESPNOW_KEY_LEN) == 0);
  // Der LMK ist nicht die PMK (sonst wäre der verschlüsselte Austausch des LMK wirkungslos)
  assert(memcmp(lmk, SPLIT_ESPNOW_PMK, SPLIT_ESPNOW_KEY_LEN) != 0);
}

// -----------------------------------------------------------------------------
// Firmwarestand der linken Hälfte (SPLIT_OP_FW_VERSION)
// -----------------------------------------------------------------------------

TEST(test_fw_version_op_is_valid_only_with_version) {
  assert(SPLIT_OP_FW_VERSION == 18); // nur anhängen, nie umnummerieren
  assert(isValidSplitHidEvent(makeSplitHidEvent(SPLIT_OP_FW_VERSION, DACTYL_FW_VERSION)));
  assert(!isValidSplitHidEvent(makeSplitHidEvent(SPLIT_OP_FW_VERSION, 0)));
  assert(!isValidSplitHidEvent(makeSplitHidEvent(SPLIT_OP_FW_VERSION, 1, 1)));
  // Nur links -> Master: die linke Hälfte nimmt das Paket vom Master nicht an
  SplitHidEvent ev = makeSplitHidEvent(SPLIT_OP_FW_VERSION, 1), out;
  assert(!parseSplitMasterPacket(SPLIT_MASTER_MAC, (const uint8_t *)&ev, sizeof(ev), out));
}

TEST(test_process_rx_records_left_fw_without_host_and_without_activity) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_FW_VERSION, 7));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, false, 100, nullptr);
  assert(k.splitLeft.fw == 7 && splitLeftFwStatus(k.splitLeft, 100) == 7);
  assert(rep.applied == 0 && rep.keyEvents == 0 && k.log.empty());
  assert(k.splitLeft.linkUp && k.splitLeft.lastRxMs == 100);
  // Mit Host ebenfalls ohne HID-Wirkung
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_FW_VERSION, 8));
  rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 200, nullptr);
  assert(rep.applied == 0 && k.log.empty() && k.splitLeft.fw == 8);
}

TEST(test_left_fw_status_detects_old_left_firmware) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  assert(splitLeftFwStatus(k.splitLeft, 0) == 0); // kein Link
  // Linke Firmware ohne FW_VERSION: nur Heartbeats
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 1000, nullptr);
  assert(splitLeftFwStatus(k.splitLeft, 1000 + SPLIT_FW_DETECT_MS - 1) == 0);
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 1000 + SPLIT_FW_DETECT_MS - 1, nullptr);
  assert(splitLeftFwStatus(k.splitLeft, 1000 + SPLIT_FW_DETECT_MS) == -1);
  // BLE-Task liest millis() vor einem neueren fwSinceMs aus loop(): kein falsches "alt"
  SplitLeftHeld fresh = {};
  fresh.linkUp = true;
  fresh.fwSinceMs = 5000;
  assert(splitLeftFwStatus(fresh, 4999) == 0);
  // Fenster > zwei Abstände der Versionsmeldungen (+ 1 s Phase des Heartbeats): eine verlorene Meldung
  // ergibt kein falsches "alt"
  assert(SPLIT_FW_DETECT_MS > (2 * SPLIT_FW_VERSION_EVERY + 1) * 1000UL);
}

TEST(test_new_link_resets_left_fw) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_FW_VERSION, 3));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, nullptr);
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100 + SPLIT_LINK_TIMEOUT_MS, nullptr);
  assert(rep.linkLost && splitLeftFwStatus(k.splitLeft, 100 + SPLIT_LINK_TIMEOUT_MS) == 0);
  // Linke Hälfte mit älterer Firmware neu geflasht: der alte Stand gilt nicht weiter
  unsigned long t = 20000;
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_RELEASE_ALL));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, t, nullptr);
  assert(k.splitLeft.fw == 0 && splitLeftFwStatus(k.splitLeft, t) == 0);
  assert(splitLeftFwStatus(k.splitLeft, t + SPLIT_FW_DETECT_MS) == -1);
}

TEST(test_combo_release_all_keeps_left_fw) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_FW_VERSION, 4));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_RELEASE_ALL)); // Combo links: releaseAll() bei laufendem Link
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, nullptr);
  assert(splitLeftFwStatus(k.splitLeft, 100) == 4);
}

TEST(test_link_stats_track_changes_losses_and_drops) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = true;
  assert(!k.splitLeft.everUp && k.splitLeft.linkLosses == 0);
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 500, nullptr);
  assert(k.splitLeft.everUp && k.splitLeft.linkChangedMs == 500);
  // Weitere Pakete ändern den Zeitpunkt des Wechsels nicht
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 900, nullptr);
  assert(k.splitLeft.linkChangedMs == 500 && k.splitLeft.linkLosses == 0);
  // Link-Timeout
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 900 + SPLIT_LINK_TIMEOUT_MS, nullptr);
  assert(rep.linkLost && !k.splitLeft.linkUp);
  // Der Link ist seit dem letzten Paket weg (900), nicht erst seit der Erkennung nach dem Timeout
  assert(k.splitLeft.linkLosses == 1 && k.splitLeft.linkChangedMs == 900);
  assert(k.splitLeft.everUp);
  // Zweiter Aufbau und zweiter Ausfall
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 10000, nullptr);
  assert(k.splitLeft.linkUp && k.splitLeft.linkChangedMs == 10000);
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 10000 + SPLIT_LINK_TIMEOUT_MS, nullptr);
  assert(k.splitLeft.linkLosses == 2);
  // Ring-Überlauf: verworfene Pakete summieren sich
  for (int i = 0; i < SPLIT_RX_QUEUE_SIZE + 3; i++) splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 20000, nullptr);
  assert(k.splitLeft.rxDropped == 3);
  for (int i = 0; i < SPLIT_RX_QUEUE_SIZE + 2; i++) splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 20100, nullptr);
  assert(k.splitLeft.rxDropped == 5);
}

TEST(test_link_stats_count_dropped_key_events) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  appliedCodes.clear();
  keyEventCodes.clear();
  for (int i = 0; i < SPLIT_KEY_EVENTS_PER_RX + 4; i++) {
    splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_EVENT, splitKeyEventCode(0, 0, (i & 1) == 0, 0)));
  }
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, nullptr, recordKeyEvent);
  assert(k.splitLeft.keyDropped == 4);
}

TEST(test_link_stats_counter_saturates) {
  uint32_t c = 0xFFFFFFFEu;
  splitCountAdd(c, 1);
  assert(c == 0xFFFFFFFFu);
  splitCountAdd(c, 5);
  assert(c == 0xFFFFFFFFu);
}

TEST(test_left_link_json_reports_state_and_clamps_time) {
  char buf[160];
  SplitLeftHeld h = {};
  splitLeftLinkJson(buf, sizeof(buf), h, 5000);
  assert(std::string(buf) == "{\"up\":0,\"ms\":0,\"ever\":0,\"losses\":0,\"rx_dropped\":0,\"key_dropped\":0}");
  h.everUp = true;
  h.linkUp = true;
  h.linkChangedMs = 1000;
  h.linkLosses = 2;
  h.rxDropped = 3;
  h.keyDropped = 4;
  splitLeftLinkJson(buf, sizeof(buf), h, 3500);
  assert(std::string(buf) == "{\"up\":1,\"ms\":2500,\"ever\":1,\"losses\":2,\"rx_dropped\":3,\"key_dropped\":4}");
  // BLE-Task liest millis() vor einem neueren linkChangedMs aus loop(): 0 statt einer riesigen Zahl
  splitLeftLinkJson(buf, sizeof(buf), h, 999);
  assert(std::string(buf).find("\"ms\":0,") != std::string::npos);
  // Ein Link, der länger als 2^31 ms (24,8 Tage) getrennt ist, zeigt sein volles Alter, nicht 0
  h.linkChangedMs = 1000;
  splitLeftLinkJson(buf, sizeof(buf), h, 1000UL + 0x90000000UL);
  assert(std::string(buf).find("\"ms\":2415919104,") != std::string::npos);
  // Millis-Überlauf: das Alter bleibt richtig
  h.linkChangedMs = ~0UL - 255; // wie test_link_timeout_across_millis_wrap: unabhängig von der Breite von unsigned long
  splitLeftLinkJson(buf, sizeof(buf), h, 256UL);
  assert(std::string(buf).find("\"ms\":512,") != std::string::npos);
  // Größte Zahlen passen in den Puffer der Firmware (160 Bytes) und bleiben gültig abgeschlossen
  h.linkLosses = h.rxDropped = h.keyDropped = 0xFFFFFFFFu;
  h.linkChangedMs = 0;
  int n = splitLeftLinkJson(buf, sizeof(buf), h, 0x7FFFFFFFUL);
  assert(n > 0 && n < (int)sizeof(buf) && buf[n - 1] == '}');
}

TEST(test_link_report_sends_changes_at_once_and_throttles_counters) {
  SplitLinkReporter r = {};
  SplitLeftHeld h = {};
  assert(splitLinkReportDue(r, h, 0));            // erste Meldung: Link ab, nie verbunden
  assert(!splitLinkReportDue(r, h, 10));          // nichts geändert
  h.linkUp = true;
  assert(splitLinkReportDue(r, h, 20));           // Wechsel sofort, auch innerhalb des Intervalls
  h.rxDropped = 1;
  assert(!splitLinkReportDue(r, h, 30));          // Zähler: gedrosselt
  assert(!splitLinkReportDue(r, h, 20 + SPLIT_LINK_REPORT_MS - 1));
  assert(splitLinkReportDue(r, h, 20 + SPLIT_LINK_REPORT_MS));
  assert(!splitLinkReportDue(r, h, 20 + 3 * SPLIT_LINK_REPORT_MS)); // gemeldet, nichts Neues
  h.linkUp = false;
  h.linkLosses = 1;
  assert(splitLinkReportDue(r, h, 20 + 3 * SPLIT_LINK_REPORT_MS + 1)); // Wechsel sofort
  // Überlauf von millis(): Intervall bleibt richtig
  SplitLinkReporter w = {};
  SplitLeftHeld g = {};
  g.linkUp = true;
  assert(splitLinkReportDue(w, g, 0xFFFFFF00UL));
  g.keyDropped = 2;
  assert(!splitLinkReportDue(w, g, 0xFFFFFF00UL + 500));
  assert(splitLinkReportDue(w, g, 0xFFFFFF00UL + SPLIT_LINK_REPORT_MS));
}

// -----------------------------------------------------------------------------
// Doppel-Tipp über beide Hälften (TAP_PENDING, TAP_FLUSH, onBeforeLeftPress, SplitLocalDefer)
// -----------------------------------------------------------------------------
TEST(test_tap_ops_are_appended) {
  assert(SPLIT_OP_TAP_PENDING == 19 && SPLIT_OP_TAP_FLUSH == 20 && SPLIT_OP_COUNT == 21);
}

TEST(test_tap_flush_accepted_only_from_master_without_values) {
  SplitHidEvent out;
  assert(parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_TAP_FLUSH), out) && out.op == SPLIT_OP_TAP_FLUSH);
  assert(!parseMaster(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_TAP_FLUSH), out));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_TAP_FLUSH, 1), out));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_TAP_FLUSH, 0, 1), out));
  // TAP_PENDING geht nur links -> Master
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 1), out));
}

static std::vector<std::string> rxOrder;
static void recordBeforePress(const SplitHidEvent &ev) { rxOrder.push_back("before" + std::to_string(ev.op)); }
static void recordAppliedOrder(const SplitHidEvent &ev) { rxOrder.push_back("applied" + std::to_string(ev.op)); }

TEST(test_process_rx_calls_before_left_press_before_each_press) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  rxOrder.clear();
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a'));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_RELEASE, 'a'));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_MOUSE_CLICK, 1));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 1));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, recordAppliedOrder, nullptr, nullptr, recordBeforePress);
  // Der Master sendet seine wartenden Tipps vor dem linken Druck; Release, Heartbeat und Meldungen nicht
  assert((rxOrder == std::vector<std::string>{"before1", "applied1", "applied2", "before10", "applied10"}));
  assert(k.splitLeft.tapPending);
}

TEST(test_process_rx_skips_before_left_press_without_host) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  rxOrder.clear();
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a'));
  splitProcessRx(k, rxq, droppedSeen, hostWas, false, 100, recordAppliedOrder, nullptr, nullptr, recordBeforePress);
  assert(rxOrder.empty());
}

TEST(test_press_ops_for_before_left_press) {
  const uint8_t press[] = {SPLIT_OP_KEY_PRESS, SPLIT_OP_KEY_WRITE, SPLIT_OP_MEDIA_PRESS, SPLIT_OP_MEDIA_WRITE,
                           SPLIT_OP_MOUSE_PRESS, SPLIT_OP_MOUSE_CLICK, SPLIT_OP_MOUSE_SCROLL,
                           SPLIT_OP_ONE_SHOT_PRESS, SPLIT_OP_CAPS_WORD_TOGGLE};
  for (uint8_t op = 0; op < SPLIT_OP_COUNT; op++) {
    bool expected = false;
    for (uint8_t p : press) if (p == op) expected = true;
    assert(splitIsPressOp(op) == expected);
  }
}

TEST(test_left_tap_pending_from_rx_without_host_and_without_activity) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 1));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, false, 1000, nullptr);
  assert(rep.applied == 0 && rep.keyEvents == 0 && k.log.empty());
  assert(splitLeftTapPending(k.splitLeft, 1000));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 0));
  rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 1010, nullptr);
  assert(rep.applied == 0 && k.log.empty() && !splitLeftTapPending(k.splitLeft, 1010));
}

TEST(test_left_tap_pending_expires_and_clears_on_link_change) {
  SplitLeftHeld h = {};
  splitNoteLeftRx(h, makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 1), 1000);
  assert(splitLeftTapPending(h, 1000 + SPLIT_TAP_PENDING_MAX_MS - 1));
  // Eine verlorene 0 bremst den Master nicht dauerhaft
  assert(!splitLeftTapPending(h, 1000 + SPLIT_TAP_PENDING_MAX_MS));
  // Überlauf von millis()
  splitNoteLeftRx(h, makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 1), 0xFFFFFF00UL);
  assert(splitLeftTapPending(h, 0xFFFFFF00UL + 300));
  // Link-Ausfall löscht die Meldung
  RecordingSink s;
  assert(splitCheckLinkTimeout(h, 0xFFFFFF00UL + SPLIT_LINK_TIMEOUT_MS, s));
  assert(!h.tapPending && !splitLeftTapPending(h, 0xFFFFFF00UL + SPLIT_LINK_TIMEOUT_MS));
  // Ein neuer Link beginnt ohne Meldung, auch wenn tapPending noch gesetzt wäre
  h.tapPending = true;
  splitNoteLeftRx(h, makeSplitHidEvent(SPLIT_OP_HEARTBEAT), 5000);
  assert(!splitLeftTapPending(h, 5000));
}

TEST(test_local_defer_holds_until_left_tap_sent) {
  SplitLocalDefer d;
  splitDeferReset(d);
  assert(!splitDeferShouldHold(d, false));       // ohne wartenden linken Tipp: sofort ausführen
  assert(splitDeferShouldHold(d, true));
  assert(splitDeferPush(d, 2, 1, true, 1000));
  assert(splitDeferPush(d, 2, 1, false, 1020));
  assert(splitDeferShouldHold(d, false));        // ältere Änderungen warten: die neue überholt sie nicht
  // TAP_FLUSH genau einmal je Runde
  assert(splitDeferTakeFlushRequest(d));
  assert(!splitDeferTakeFlushRequest(d));
  assert(!splitDeferReplayDue(d, true, 1000 + SPLIT_TAP_FLUSH_TIMEOUT_MS - 1));
  assert(splitDeferReplayDue(d, false, 1001));    // links meldet 0: sofort
  assert(splitDeferReplayDue(d, true, 1000 + SPLIT_TAP_FLUSH_TIMEOUT_MS)); // Zeitgrenze
  SplitDeferredKey k;
  assert(splitDeferPop(d, k) && k.r == 2 && k.c == 1 && k.pressed);
  assert(splitDeferPop(d, k) && !k.pressed);
  assert(!splitDeferPop(d, k));
  assert(!splitDeferReplayDue(d, false, 2000));
  // Neue Runde: neue Zeitgrenze und neue Anforderung
  assert(splitDeferPush(d, 0, 0, true, 3000));
  assert(splitDeferTakeFlushRequest(d));
  assert(!splitDeferReplayDue(d, true, 3000 + SPLIT_TAP_FLUSH_TIMEOUT_MS - 1));
}

static std::vector<std::string> deferLog;
static std::vector<unsigned long> deferTimes;
static void deferApply(uint8_t r, uint8_t c, bool pressed, unsigned long atMs) {
  deferLog.push_back(std::string(pressed ? "d" : "u") + std::to_string(r) + std::to_string(c));
  deferTimes.push_back(atMs);
}
static void deferFlush() { deferLog.push_back("flush"); }

TEST(test_defer_apply_or_hold_and_replay_order) {
  SplitLocalDefer d;
  splitDeferReset(d);
  deferLog.clear();
  deferTimes.clear();
  splitDeferApplyOrHold(d, 1, 1, true, false, 100, deferApply);   // ohne linken Tipp: sofort
  assert((deferLog == std::vector<std::string>{"d11"}));
  splitDeferApplyOrHold(d, 2, 2, true, true, 110, deferApply);    // zurückgehalten
  splitDeferApplyOrHold(d, 2, 2, false, false, 120, deferApply);  // hinter der älteren Änderung
  assert(deferLog.size() == 1 && d.count == 2);
  splitDeferReplay(d, deferApply);
  assert((deferLog == std::vector<std::string>{"d11", "d22", "u22"}) && d.count == 0);
  // Jede Änderung behält ihre Scan-Zeit (Tapping-Term und Combo-Fenster)
  assert((deferTimes == std::vector<unsigned long>{100, 110, 120}));
}

TEST(test_defer_full_buffer_applies_oldest_first) {
  SplitLocalDefer d;
  splitDeferReset(d);
  deferLog.clear();
  for (int i = 0; i < SPLIT_DEFER_SIZE; i++) splitDeferApplyOrHold(d, 0, (uint8_t)(i % 7), true, true, 100, deferApply);
  assert(deferLog.empty());
  splitDeferApplyOrHold(d, 5, 6, true, true, 100, deferApply);
  assert(deferLog.size() == SPLIT_DEFER_SIZE + 1 && deferLog.front() == "d00" && deferLog.back() == "d56");
  assert(d.count == 0);
}

TEST(test_before_left_press_replays_only_without_left_tap_pending) {
  SplitLocalDefer d;
  splitDeferReset(d);
  deferLog.clear();
  splitDeferApplyOrHold(d, 3, 4, true, true, 100, deferApply);
  splitBeforeLeftPress(d, true, deferApply, deferFlush);          // nachgeholter linker Tipp: X bleibt zurück
  assert((deferLog == std::vector<std::string>{"flush"}) && d.count == 1);
  splitBeforeLeftPress(d, false, deferApply, deferFlush);         // späterer linker Druck: X zuerst
  assert((deferLog == std::vector<std::string>{"flush", "d34", "flush"}) && d.count == 0);
}

// Ablauf am Master: linker Tipp A wartet (TAP_PENDING 1), Master-Taste X wird zurückgehalten. Die Antwort auf
// TAP_FLUSH bringt A (Press, Release), dann TAP_PENDING 0, dann einen späteren linken Druck Y.
// Am Mac: A, dann X, dann Y.
static SplitLocalDefer rxDefer;
static Kbd *rxKbd = nullptr;
static void rxDeferApply(uint8_t r, uint8_t c, bool pressed, unsigned long) {
  rxOrder.push_back(std::string(pressed ? "local-d" : "local-u") + std::to_string(r) + std::to_string(c));
}
static void rxBeforePress(const SplitHidEvent &) {
  splitBeforeLeftPress(rxDefer, splitLeftTapPending(rxKbd->splitLeft, 120), rxDeferApply, [] {});
}
static void rxAppliedCode(const SplitHidEvent &ev) {
  rxOrder.push_back("left-" + std::to_string(ev.op) + ":" + std::to_string(ev.code));
}

TEST(test_process_rx_sends_flushed_left_tap_before_held_master_key) {
  Kbd k;
  rxKbd = &k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  rxOrder.clear();
  splitDeferReset(rxDefer);
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 1));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, rxAppliedCode, nullptr, nullptr, rxBeforePress);
  splitDeferApplyOrHold(rxDefer, 2, 2, true, splitLeftTapPending(k.splitLeft, 105), 105, rxDeferApply);
  assert(rxOrder.empty() && rxDefer.count == 1);
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a'));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_RELEASE, 'a'));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 0));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'y'));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 120, rxAppliedCode, nullptr, nullptr, rxBeforePress);
  assert((rxOrder == std::vector<std::string>{"left-1:97", "left-2:97", "local-d22", "left-1:121"}));
  assert(rxDefer.count == 0);
}

TEST(test_local_defer_full_buffer_rejects) {
  SplitLocalDefer d;
  splitDeferReset(d);
  for (int i = 0; i < SPLIT_DEFER_SIZE; i++) assert(splitDeferPush(d, 0, (uint8_t)(i % 7), (i & 1) == 0, 100));
  assert(!splitDeferPush(d, 1, 1, true, 100));
  SplitDeferredKey k;
  assert(splitDeferPop(d, k) && k.c == 0 && k.pressed); // Reihenfolge bleibt
}

int main() {
  std::cout << "==================================================" << std::endl;
  std::cout << "  Dactyl Split HID Protocol Test Suite" << std::endl;
  std::cout << "==================================================" << std::endl;

  std::cout << "\nRan " << testsRun << " tests. All " << testsPassed << " passed successfully!" << std::endl;
  return (testsRun == testsPassed) ? 0 : 1;
}
