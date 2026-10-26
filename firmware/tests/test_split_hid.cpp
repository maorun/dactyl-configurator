#include <cassert>
#include <iostream>
#include <string>
#include <vector>

// Getestete Logik unverändert aus firmware/dactyl_right/DactylSplitHid.h (beide Hälften)
#include "../dactyl_right/DactylSplitHid.h"

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
  };
  // Alle Ops links -> Master; ACTIVITY ist die einzige Op der Rückrichtung
  assert(sizeof(ok) / sizeof(ok[0]) == SPLIT_OP_COUNT - 1);
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
static bool parseActivity(const uint8_t *mac, SplitHidEvent ev, int len = (int)sizeof(SplitHidEvent)) {
  return parseSplitActivityPacket(mac, reinterpret_cast<const uint8_t *>(&ev), len);
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
  assert(!parseSplitActivityPacket(SPLIT_MASTER_MAC, nullptr, 4));
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

int main() {
  std::cout << "==================================================" << std::endl;
  std::cout << "  Dactyl Split HID Protocol Test Suite" << std::endl;
  std::cout << "==================================================" << std::endl;

  std::cout << "\nRan " << testsRun << " tests. All " << testsPassed << " passed successfully!" << std::endl;
  return (testsRun == testsPassed) ? 0 : 1;
}
