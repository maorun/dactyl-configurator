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
  void leftMediaPress(uint32_t b) override { log.push_back("mp" + std::to_string(b)); }
  void leftMediaRelease(uint32_t b) override { log.push_back("mr" + std::to_string(b)); }
  void leftMousePress(uint8_t b) override { log.push_back("bp" + std::to_string(b)); }
  void leftMouseRelease(uint8_t b) override { log.push_back("br" + std::to_string(b)); }
  void leftMouseClick(uint8_t b) override { log.push_back("bc" + std::to_string(b)); }
  void leftMouseScroll(int8_t s) override { log.push_back("sc" + std::to_string(s)); }
  void leftMousePan(int8_t s) override { log.push_back("pn" + std::to_string(s)); }
  void leftMouseMove(int8_t x, int8_t y) override { log.push_back("mm" + std::to_string(x) + "," + std::to_string(y)); }
  void leftOneShotPress(uint8_t m) override { log.push_back("op" + std::to_string(m)); }
  void leftOneShotRelease(uint8_t m, bool arm) override { log.push_back((arm ? "or" : "ox") + std::to_string(m)); }
  void leftCapsWordToggle() override { log.push_back("cw"); }
  void leftSentenceCaseToggle() override { log.push_back("sc"); }
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
    makeSplitHidEvent(SPLIT_OP_SENTENCE_CASE_TOGGLE),
    makeSplitLayerEvent(0x02, 0x08, false),
    makeSplitLayerEvent(0x02, 0x08, true, 1), // links setzt nach eigener Toggle-Änderung
    makeSplitHidEvent(SPLIT_OP_FW_VERSION, 0xFFFF),
    makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 1),
    makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 0),
    makeSplitHidEvent(SPLIT_OP_REPEAT, 1, 1),
    makeSplitHidEvent(SPLIT_OP_REPEAT, 0, 1),
    makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 1),
    makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 0),
    makeSplitHidEvent(SPLIT_OP_HOLD_RESOLVE),
    makeSplitHidEvent(SPLIT_OP_MOUSE_MOVE, 0xFF, 5),   // x = 5, y = -1
    makeSplitOslEvent(0x04, 0x02),                     // One-Shot-Ebene 2 vorgemerkt, Ebene 1 des Empfängers verbraucht
    makeSplitHidEvent(SPLIT_OP_KEY_LOCK),
    makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a', 1),     // sperrbarer Tastendruck
    makeSplitHidEvent(SPLIT_OP_MOUSE_PRESS, 1, 1),     // sperrbarer Mausdruck
    makeSplitMouseSpeedEvent(2),                       // MOUSE_FAST gehalten
  };
  // Alle Ops links -> Master (LAYER_STATE als REPORT und SET, TAP_PENDING, REPEAT und HOLD_PENDING mit 1 und 0);
  // ACTIVITY, TAP_FLUSH, REPEAT_RUN, SLEEP und MASTER_PRESS sind die einzigen Ops nur der Rückrichtung. Jede dieser fünf
  // fehlt, vier Ops stehen doppelt, KEY_PRESS und MOUSE_PRESS kommen zusätzlich mit arg 1 vor: SPLIT_OP_COUNT - 5 + 4 + 2.
  assert(sizeof(ok) / sizeof(ok[0]) == SPLIT_OP_COUNT - 5 + 4 + 2);
  for (uint8_t op = 0; op < SPLIT_OP_COUNT; op++) {
    if (op == SPLIT_OP_ACTIVITY || op == SPLIT_OP_TAP_FLUSH || op == SPLIT_OP_REPEAT_RUN || op == SPLIT_OP_SLEEP || op == SPLIT_OP_MASTER_PRESS) continue;
    bool seen = false;
    for (const SplitHidEvent &ev : ok) if (ev.op == op) seen = true;
    assert(seen); // jede Op links -> Master kommt vor: ein neuer Op-Wert ohne Eintrag fällt auf
  }
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
    makeSplitHidEvent(SPLIT_OP_MOUSE_SCROLL, 1, 0),       // Pan ohne Schritt
    makeSplitHidEvent(SPLIT_OP_MOUSE_SCROLL, 2, 1),       // nur Mausrad (0) und Pan (1)
    makeSplitHidEvent(SPLIT_OP_MEDIA_PRESS, 1, 0x10),     // Bits über 19
    makeSplitHidEvent(SPLIT_OP_MEDIA_RELEASE, 1, -1),
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
    makeSplitHidEvent(SPLIT_OP_SENTENCE_CASE_TOGGLE, 1),
    makeSplitHidEvent(SPLIT_OP_SENTENCE_CASE_TOGGLE, 0, 1),
    makeSplitHidEvent(SPLIT_OP_KEY_LOCK, 1),
    makeSplitHidEvent(SPLIT_OP_KEY_LOCK, 0, 1),
    makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a', 2),       // arg nur 0 oder 1
    makeSplitHidEvent(SPLIT_OP_MOUSE_PRESS, 1, 2),
    makeSplitHidEvent(SPLIT_OP_MOUSE_RELEASE, 1, 1),
    makeSplitHidEvent(SPLIT_OP_LAYER_STATE, 0x0100, 0),  // REPORT ohne Toggle-Bits
    makeSplitHidEvent(SPLIT_OP_LAYER_STATE, 0x0100, 1),  // Ebene 0 rastet nie ein
    makeSplitHidEvent(SPLIT_OP_LAYER_STATE, 0, -1),      // Master-Form kommt nie von links
    makeSplitHidEvent(SPLIT_OP_FW_VERSION, 0),           // 0 = unbekannt, nie gesendet
    makeSplitHidEvent(SPLIT_OP_FW_VERSION, 1, 1),
    makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 2),
    makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 1, 1),
    makeSplitHidEvent(SPLIT_OP_TAP_FLUSH),               // nur Master -> links
    makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 2),         // nur 0 oder 1
    makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 1, 1),
    makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 0, -1),
    makeSplitHidEvent(SPLIT_OP_HOLD_RESOLVE, 1),         // ohne Werte
    makeSplitHidEvent(SPLIT_OP_HOLD_RESOLVE, 0, 1),
    makeSplitHidEvent(SPLIT_OP_REPEAT, 1),               // Taste ohne Nummer
    makeSplitHidEvent(SPLIT_OP_REPEAT, 2, 1),            // Notiz mit Nummer
    makeSplitHidEvent(SPLIT_OP_REPEAT, 4),
    makeSplitRepeatRun(true, 1),                         // nur Master -> links
    makeSplitHidEvent(SPLIT_OP_MOUSE_MOVE, 0, 0),         // keine Bewegung
    makeSplitHidEvent(SPLIT_OP_MOUSE_MOVE, 0x100, 1),     // y außerhalb int8
    makeSplitHidEvent(SPLIT_OP_MOUSE_MOVE, 0, -128),      // -128 ist ungültig
    makeSplitHidEvent(SPLIT_OP_MOUSE_MOVE, 0x80, 1),      // y = -128
    makeSplitHidEvent(SPLIT_OP_SLEEP),                    // nur Master -> links
    makeSplitHidEvent(SPLIT_OP_SLEEP, 1),
    makeSplitHidEvent(SPLIT_OP_SLEEP, 0, 1),
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
  const uint8_t globe[3] = {0, 4, 0};
  assert(splitMediaBits(globe) == 0x0400);
  uint8_t r[3];
  splitMediaReport(0x0408, r);
  assert(r[0] == 0x08 && r[1] == 0x04 && r[2] == 0);
  // Die Bits 16..19 (Helligkeit, Mission Control, Launchpad) laufen über arg
  const uint8_t launch[3] = {0, 0, 8};
  assert(splitMediaBits(launch) == 0x80000);
  SplitHidEvent ev = makeSplitMediaEvent(SPLIT_OP_MEDIA_PRESS, 0x80008);
  assert(ev.code == 0x0008 && ev.arg == 8 && isValidSplitHidEvent(ev) && splitMediaEventBits(ev) == 0x80008);
  splitMediaReport(0x80008, r);
  assert(r[0] == 0x08 && r[1] == 0 && r[2] == 0x08);
  // Bits über 19 und negative arg sind ungültig
  assert(!isValidSplitHidEvent(makeSplitHidEvent(SPLIT_OP_MEDIA_PRESS, 1, 0x10)));
  assert(!isValidSplitHidEvent(makeSplitHidEvent(SPLIT_OP_MEDIA_PRESS, 1, -1)));
  assert(!isValidSplitHidEvent(makeSplitHidEvent(SPLIT_OP_MEDIA_PRESS, 0, 0)));
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

TEST(test_new_system_keys_and_pan_reach_the_master_sink) {
  // 20-Bit-Maske: code = Bits 0..15, arg = Bits 16..19
  assert(splitApplyHidEvent(held, makeSplitMediaEvent(SPLIT_OP_MEDIA_PRESS, 0x80400), 0, sink));
  assert(!splitApplyHidEvent(held, makeSplitMediaEvent(SPLIT_OP_MEDIA_PRESS, 0x80400), 0, sink)); // Duplikat
  assert(held.set.media == 0x80400);
  assert(splitApplyHidEvent(held, makeSplitMediaEvent(SPLIT_OP_MEDIA_RELEASE, 0x80000), 0, sink));
  assert(held.set.media == 0x00400);
  assert(splitApplyHidEvent(held, makeSplitHidEvent(SPLIT_OP_MOUSE_SCROLL, 1, -2), 0, sink));
  assert(splitApplyHidEvent(held, makeSplitHidEvent(SPLIT_OP_MOUSE_SCROLL, 0, 2), 0, sink));
  assert((L() == std::vector<std::string>{"mp525312", "mr524288", "pn-2", "sc2"}));
  // Link-Ausfall löst alle Bits einzeln
  splitReleaseHeld(held, sink);
  assert(L().back() == "mr1024" && held.set.media == 0);
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
  size_t press(const uint8_t k[3]) { log.push_back("MP" + std::to_string(splitMediaBits(k))); return 1; }
  size_t release(const uint8_t k[3]) { log.push_back("MR" + std::to_string(splitMediaBits(k))); return 1; }
  void mousePress(uint8_t b) { log.push_back("BP" + std::to_string(b)); }
  void mouseRelease(uint8_t b) { log.push_back("BR" + std::to_string(b)); }
  void mouseClick(uint8_t b) { log.push_back("BC" + std::to_string(b)); }
  void mouseScroll(int8_t s) { log.push_back("SC" + std::to_string(s)); }
  void mousePan(int8_t s) { log.push_back("PN" + std::to_string(s)); }
  void mouseMove(int8_t x, int8_t y) { log.push_back("MM" + std::to_string(x) + "," + std::to_string(y)); }
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
  const uint8_t vol[3] = {0x20, 0, 0};
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

TEST(test_quiet_standby_and_refresh_intervals) {
  // Quiet standby nur wenn im Standby, keine lokale Taste und keine MO-Ebenen gehalten werden
  assert(!splitQuietStandby(false, false, 0, 0));
  assert(!splitQuietStandby(true, true, 0, 0));
  assert(!splitQuietStandby(true, false, 0x02, 0));
  assert(!splitQuietStandby(true, false, 0, 0x04));
  assert(splitQuietStandby(true, false, 0, 0));

  // Intervalle im aktiven Betrieb vs. quiet standby
  assert(splitRefreshIntervalMs(false) == SPLIT_LAYER_REFRESH_MS);
  assert(splitRefreshIntervalMs(true) == SPLIT_STANDBY_REFRESH_MS);
  assert(splitTimeoutIntervalMs(false) == SPLIT_LINK_TIMEOUT_MS);
  assert(splitTimeoutIntervalMs(true) == SPLIT_STANDBY_TIMEOUT_MS);
}

TEST(test_layer_sync_quiet_standby_refresh_interval) {
  SplitLayerSync s;
  splitLayerReset(s, 0);
  SplitHidEvent ev;

  // Erstes Paket
  assert(splitLayerTake(s, 0, 0, false, 100, true, ev, splitRefreshIntervalMs(false)));

  // Im quiet standby: nach 1000 ms noch nicht fällig, erst nach 5000 ms
  assert(!splitLayerTake(s, 0, 0, false, 100 + SPLIT_LAYER_REFRESH_MS, true, ev, splitRefreshIntervalMs(true)));
  assert(!splitLayerTake(s, 0, 0, false, 100 + SPLIT_STANDBY_REFRESH_MS - 1, true, ev, splitRefreshIntervalMs(true)));
  assert(splitLayerTake(s, 0, 0, false, 100 + SPLIT_STANDBY_REFRESH_MS, true, ev, splitRefreshIntervalMs(true)));

  // Sobald quiet standby endet (z. B. Taste/MO-Ebene oder Standby beendet): sofort nach >= 1000 ms fällig
  assert(!splitLayerTake(s, 0, 0, false, 100 + SPLIT_STANDBY_REFRESH_MS + 500, true, ev, splitRefreshIntervalMs(false)));
  assert(splitLayerTake(s, 0, 0, false, 100 + SPLIT_STANDBY_REFRESH_MS + SPLIT_LAYER_REFRESH_MS, true, ev, splitRefreshIntervalMs(false)));
}

TEST(test_link_timeout_with_standby_timeout) {
  SplitLeftHeld h;
  splitHeldReset(h);
  RecordingSink s;

  // Paket empfangen bei t = 1000
  splitApplyHidEvent(h, makeSplitHidEvent(SPLIT_OP_HEARTBEAT), 1000, s);
  assert(h.linkUp);

  // Mit Standby-Timeout (12000 ms): nach 3000 ms noch nicht getrennt
  assert(!splitCheckLinkTimeout(h, 1000 + SPLIT_LINK_TIMEOUT_MS, s, SPLIT_STANDBY_TIMEOUT_MS));
  assert(!splitCheckLinkTimeout(h, 1000 + SPLIT_STANDBY_TIMEOUT_MS - 1, s, SPLIT_STANDBY_TIMEOUT_MS));
  assert(splitCheckLinkTimeout(h, 1000 + SPLIT_STANDBY_TIMEOUT_MS, s, SPLIT_STANDBY_TIMEOUT_MS));
  assert(!h.linkUp);
}

TEST(test_master_standby_exit_grace_period) {
  // Wenn im Standby: grace ist immer aktiv
  assert(splitStandbyGraceActive(true, 1000, 1000));
  assert(splitStandbyGraceActive(true, 1000, 5000));

  // Beim Aufwachen bei t=5000 (lastStandbyMs = 5000):
  // Innerhalb von 3000 ms Grace Period bleibt splitStandbyGraceActive true
  assert(splitStandbyGraceActive(false, 5000, 5000));
  assert(splitStandbyGraceActive(false, 5000, 5000 + SPLIT_LINK_TIMEOUT_MS - 1));

  // Nach 3000 ms fällt die Grace Period ab
  assert(!splitStandbyGraceActive(false, 5000, 5000 + SPLIT_LINK_TIMEOUT_MS));
  assert(!splitStandbyGraceActive(false, 0, 5000));
}

TEST(test_sleep_packet_accepts_only_master_sleep_without_args) {
  assert(SPLIT_OP_SLEEP == 26); // append-only: Nummer nie ändern
  SplitHidEvent out;
  assert(parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_SLEEP), out) && out.op == SPLIT_OP_SLEEP);
  assert(!parseMaster(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_SLEEP), out));
  assert(!parseMaster(nullptr, makeSplitHidEvent(SPLIT_OP_SLEEP), out));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_SLEEP), out, 3));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_SLEEP), out, 5));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_SLEEP, 1), out));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_SLEEP, 0, 1), out));
}

TEST(test_disconnected_deep_sleep_timeout) {
  SplitDisconnectedSleep s;
  splitDisconnectedSleepReset(s);
  const unsigned long t0 = 1000;
  // Erster Durchlauf ohne Host startet das Trennfenster, löst aber noch keinen Deep Sleep aus
  assert(!splitDisconnectedDeepSleepDue(s, false, false, false, 60, t0, t0));
  assert(s.wasDisconnected && s.disconnectedSinceMs == t0);
  // Kurz vor Ablauf von SPLIT_DISCONNECTED_DEEP_SLEEP_MS (3 Min): noch nicht fällig
  assert(!splitDisconnectedDeepSleepDue(s, false, false, false, 60, t0, t0 + SPLIT_DISCONNECTED_DEEP_SLEEP_MS));
  // Nach Ablauf von SPLIT_DISCONNECTED_DEEP_SLEEP_MS ohne Host und außerhalb des Config Mode: fällig
  assert(splitDisconnectedDeepSleepDue(s, false, false, false, 60, t0, t0 + SPLIT_DISCONNECTED_DEEP_SLEEP_MS + 1));

  // Gehaltene Taste verhindert das Einschlafen, bis sie losgelassen wird und die Inaktivität abgelaufen ist
  assert(!splitDisconnectedDeepSleepDue(s, false, false, true, 60, t0, t0 + SPLIT_DISCONNECTED_DEEP_SLEEP_MS + 10));

  // Im Config Mode und bei bestehender Host-Verbindung niemals fällig; setzt das Trennfenster zurück
  assert(!splitDisconnectedDeepSleepDue(s, true, false, false, 60, t0, t0 + SPLIT_DISCONNECTED_DEEP_SLEEP_MS + 10));
  assert(!s.wasDisconnected);
  assert(!splitDisconnectedDeepSleepDue(s, false, false, false, 60, t0, t0 + SPLIT_DISCONNECTED_DEEP_SLEEP_MS + 20));
  assert(s.wasDisconnected && s.disconnectedSinceMs == t0 + SPLIT_DISCONNECTED_DEEP_SLEEP_MS + 20);
  assert(!splitDisconnectedDeepSleepDue(s, false, true, false, 60, t0, t0 + 2 * SPLIT_DISCONNECTED_DEEP_SLEEP_MS + 30));
  assert(!s.wasDisconnected);

  // Nach einem Verbindungsabbruch zählt die Trennzeit neu, auch wenn lastActivityMs schon lange zurückliegt
  const unsigned long disconnectAt = 500000;
  assert(!splitDisconnectedDeepSleepDue(s, false, false, false, 60, t0, disconnectAt));
  assert(!splitDisconnectedDeepSleepDue(s, false, false, false, 60, t0, disconnectAt + SPLIT_DISCONNECTED_DEEP_SLEEP_MS));
  assert(splitDisconnectedDeepSleepDue(s, false, false, false, 60, t0, disconnectAt + SPLIT_DISCONNECTED_DEEP_SLEEP_MS + 1));

  // Lokale Aktivität während getrennter Verbindung verschiebt den Timeout ebenfalls um volle 3 Minuten
  const unsigned long activityAt = disconnectAt + SPLIT_DISCONNECTED_DEEP_SLEEP_MS - 500;
  assert(!splitDisconnectedDeepSleepDue(s, false, false, false, 60, activityAt, disconnectAt + SPLIT_DISCONNECTED_DEEP_SLEEP_MS + 10));
  assert(!splitDisconnectedDeepSleepDue(s, false, false, false, 60, activityAt, activityAt + SPLIT_DISCONNECTED_DEEP_SLEEP_MS));
  assert(splitDisconnectedDeepSleepDue(s, false, false, false, 60, activityAt, activityAt + SPLIT_DISCONNECTED_DEEP_SLEEP_MS + 1));

  // Ist deepSleepTimeoutMinutes = 0 (Deep Sleep deaktiviert), löst auch der getrennte Timeout nicht aus
  assert(!splitDisconnectedDeepSleepDue(s, false, false, false, 0, t0, activityAt + 2 * SPLIT_DISCONNECTED_DEEP_SLEEP_MS));
  assert(!s.wasDisconnected);

  // Ist deepSleepTimeoutMinutes kleiner als 3 Minuten (z. B. 1 Min), gilt die kürzere konfigurierte Schwelle
  splitDisconnectedSleepReset(s);
  assert(!splitDisconnectedDeepSleepDue(s, false, false, false, 1, t0, t0));
  assert(!splitDisconnectedDeepSleepDue(s, false, false, false, 1, t0, t0 + 60000UL));
  assert(splitDisconnectedDeepSleepDue(s, false, false, false, 1, t0, t0 + 60001UL));

  // Korrekte Auswertung über den millis()-Überlauf hinweg
  splitDisconnectedSleepReset(s);
  const unsigned long nearWrap = ~0UL - 1000;
  assert(!splitDisconnectedDeepSleepDue(s, false, false, false, 60, nearWrap, nearWrap));
  assert(!splitDisconnectedDeepSleepDue(s, false, false, false, 60, nearWrap, nearWrap + SPLIT_DISCONNECTED_DEEP_SLEEP_MS));
  assert(splitDisconnectedDeepSleepDue(s, false, false, false, 60, nearWrap, nearWrap + SPLIT_DISCONNECTED_DEEP_SLEEP_MS + 1));
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

TEST(test_sentence_case_shifts_letter_after_sentence_end) {
  Kbd k;
  left(k, SPLIT_OP_SENTENCE_CASE_TOGGLE);
  assert(k.oneShot.sentenceCase);
  k.write((uint8_t)'a');
  left(k, SPLIT_OP_KEY_WRITE, '.'); // linke Hälfte
  k.write((uint8_t)' ');
  k.log.clear();
  left(k, SPLIT_OP_KEY_WRITE, 'b');
  assert((k.log == Log{"BEGIN", "P129", "P98", "END", "BEGIN", "R129", "END", "R98"}));
  k.log.clear();
  k.write((uint8_t)'c'); // nur ein Buchstabe
  assert((k.log == Log{"P99", "R99"}));
}

TEST(test_sentence_case_accepts_all_enders_and_several_spaces) {
  for (char e : {'.', '!', '?'}) {
    Kbd k;
    k.sentenceCaseToggle();
    k.write((uint8_t)e);
    k.write((uint8_t)' ');
    k.write((uint8_t)' ');
    k.log.clear();
    k.write((uint8_t)'x');
    assert((k.log == Log{"BEGIN", "P129", "P120", "END", "BEGIN", "R129", "END", "R120"}));
  }
}

TEST(test_sentence_case_needs_space_and_toggles_off) {
  Kbd k;
  k.sentenceCaseToggle();
  k.write((uint8_t)'.');
  k.log.clear();
  k.write((uint8_t)'b'); // ohne Leertaste
  assert((k.log == Log{"P98", "R98"}));
  k.write((uint8_t)' ');  // Leertaste ohne Satzende
  k.log.clear();
  k.write((uint8_t)'b');
  assert((k.log == Log{"P98", "R98"}));
  k.write((uint8_t)'.');
  k.write((uint8_t)' ');
  k.sentenceCaseToggle(); // aus
  assert(!k.oneShot.sentenceCase);
  k.log.clear();
  k.write((uint8_t)'b');
  assert((k.log == Log{"P98", "R98"}));
}

TEST(test_sentence_case_is_cancelled_by_digit_arrow_backspace) {
  const uint8_t cancel[] = {(uint8_t)'1', (uint8_t)KEY_LEFT_ARROW, (uint8_t)KEY_BACKSPACE, (uint8_t)KEY_RETURN, (uint8_t)'A'};
  for (uint8_t c : cancel) {
    Kbd k;
    k.sentenceCaseToggle();
    k.write((uint8_t)'?');
    k.write((uint8_t)' ');
    k.write(c);
    k.log.clear();
    k.write((uint8_t)'b');
    assert((k.log == Log{"P98", "R98"}));
  }
}

TEST(test_sentence_case_ignores_modifiers_and_host_loss_keeps_the_mode) {
  Kbd k;
  k.sentenceCaseToggle();
  k.write((uint8_t)'.');
  k.write((uint8_t)' ');
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.release((uint8_t)KEY_LEFT_SHIFT);
  k.log.clear();
  k.write((uint8_t)'b');
  assert((k.log == Log{"BEGIN", "P129", "P98", "END", "BEGIN", "R129", "END", "R98"}));
  k.write((uint8_t)'.');
  k.write((uint8_t)' ');
  k.splitResetForHostLoss(); // der Modus bleibt, die Vormerkung fällt weg
  assert(k.oneShot.sentenceCase && k.oneShot.sentenceStage == 0);
  k.log.clear();
  k.write((uint8_t)'b');
  assert((k.log == Log{"P98", "R98"}));
}

TEST(test_sentence_case_skips_shortcuts_and_shifted_period) {
  Kbd k;
  k.sentenceCaseToggle();
  k.write((uint8_t)'.');
  k.write((uint8_t)' ');
  k.press((uint8_t)KEY_LEFT_GUI);
  k.log.clear();
  k.write((uint8_t)'a'); // Cmd+A bleibt Cmd+A
  assert((k.log == Log{"P97", "R97"}));
  k.release((uint8_t)KEY_LEFT_GUI);
  k.log.clear();
  k.write((uint8_t)'b'); // die Vormerkung ist weg
  assert((k.log == Log{"P98", "R98"}));
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.write((uint8_t)'.'); // '>' ist kein Satzende
  k.release((uint8_t)KEY_LEFT_SHIFT);
  k.write((uint8_t)' ');
  k.log.clear();
  k.write((uint8_t)'b');
  assert((k.log == Log{"P98", "R98"}));
}

TEST(test_sentence_case_is_cancelled_by_media_and_mouse) {
  Kbd k;
  k.sentenceCaseToggle();
  k.write((uint8_t)'.');
  k.write((uint8_t)' ');
  k.mouseClick(1);
  k.log.clear();
  k.write((uint8_t)'b');
  assert((k.log == Log{"P98", "R98"}));
  k.write((uint8_t)'.');
  k.write((uint8_t)' ');
  MediaKeyReport vol = {0x04, 0};
  k.write(vol);
  k.log.clear();
  k.write((uint8_t)'b');
  assert((k.log == Log{"P98", "R98"}));
}

TEST(test_sentence_case_counts_shifted_slash_and_one_as_sentence_end) {
  Kbd k;
  k.sentenceCaseToggle();
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.write((uint8_t)'/'); // Umschalt + '/' = '?'
  k.release((uint8_t)KEY_LEFT_SHIFT);
  k.write((uint8_t)' ');
  k.log.clear();
  k.write((uint8_t)'b');
  assert((k.log == Log{"BEGIN", "P129", "P98", "END", "BEGIN", "R129", "END", "R98"}));
  k.write((uint8_t)' ');
  k.write((uint8_t)'/'); // ohne Umschalt kein Satzende
  k.write((uint8_t)' ');
  k.log.clear();
  k.write((uint8_t)'b');
  assert((k.log == Log{"P98", "R98"}));
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.write((uint8_t)'1'); // Umschalt + '1' = '!'
  k.release((uint8_t)KEY_LEFT_SHIFT);
  k.write((uint8_t)' ');
  k.log.clear();
  k.write((uint8_t)'b');
  assert((k.log == Log{"BEGIN", "P129", "P98", "END", "BEGIN", "R129", "END", "R98"}));
}

TEST(test_caps_word_toggle_is_not_retried) {
  assert(!splitEventRetryable(makeSplitHidEvent(SPLIT_OP_CAPS_WORD_TOGGLE)));
  assert(!splitEventRetryable(makeSplitHidEvent(SPLIT_OP_SENTENCE_CASE_TOGGLE)));
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
  assert(std::string(buf) == "{\"up\":0,\"ms\":0,\"ever\":0,\"losses\":0,\"rx_dropped\":0,\"key_dropped\":0,\"rssi\":null,\"rssi_min\":null}");
  h.everUp = true;
  h.linkUp = true;
  h.linkChangedMs = 1000;
  h.linkLosses = 2;
  h.rxDropped = 3;
  h.keyDropped = 4;
  splitLeftLinkJson(buf, sizeof(buf), h, 3500);
  assert(std::string(buf) == "{\"up\":1,\"ms\":2500,\"ever\":1,\"losses\":2,\"rx_dropped\":3,\"key_dropped\":4,\"rssi\":null,\"rssi_min\":null}");
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

TEST(test_rssi_average_minimum_and_json) {
  char buf[200];
  SplitLeftHeld h = {};
  // Ohne Paket: null, auch nach ungültigen Werten (0 dBm und darüber, unter -127 sind keine Messung)
  splitNoteRssi(h, 5);
  splitNoteRssi(h, -128);
  assert(!h.rssiValid);
  splitLeftLinkJson(buf, sizeof(buf), h, 0);
  assert(std::string(buf).find("\"rssi\":null,\"rssi_min\":null}") != std::string::npos);
  // Das erste Paket setzt Durchschnitt und Minimum
  splitNoteRssi(h, -60);
  assert(h.rssiValid && splitRssiAvg(h) == -60 && h.rssiMin == -60);
  // Reihe: der Durchschnitt folgt träge, das Minimum hält den schlechtesten Wert
  const int series[] = {-60, -60, -90, -60, -60, -60, -60, -60};
  for (int v : series) splitNoteRssi(h, v);
  assert(h.rssiMin == -90);
  int avg = splitRssiAvg(h);
  assert(avg < -60 && avg > -75);
  // Dauerhaft schwaches Signal zieht den Durchschnitt unter -80, das Minimum bleibt der schlechteste Wert
  for (int i = 0; i < 100; i++) splitNoteRssi(h, -85);
  assert(splitRssiAvg(h) == -85 && h.rssiMin == -90);
  splitLeftLinkJson(buf, sizeof(buf), h, 0);
  assert(std::string(buf) == "{\"up\":0,\"ms\":0,\"ever\":0,\"losses\":0,\"rx_dropped\":0,\"key_dropped\":0,\"rssi\":-85,\"rssi_min\":-90}");
  // Größte Zahlen, längster Wert (-127) und größte Zähler passen in den Puffer der Firmware (160 Bytes)
  SplitLeftHeld m = {};
  splitNoteRssi(m, -127);
  m.linkLosses = m.rxDropped = m.keyDropped = 0xFFFFFFFFu;
  m.everUp = true;
  char small[160];
  int n = splitLeftLinkJson(small, sizeof(small), m, 0x7FFFFFFFUL);
  assert(n > 0 && n < (int)sizeof(small) && small[n - 1] == '}');
  assert(std::string(small).find("\"rssi\":-127,\"rssi_min\":-127}") != std::string::npos);
  // Ein Reset (setupSplitReceiver) löscht die Messung
  splitHeldReset(h);
  assert(!h.rssiValid);
  // Negative Rundung: -85.5 -> -86 (zur größeren Beträgen), nicht Richtung null
  SplitLeftHeld r = {};
  r.rssiAvg16 = -85 * 16 - 8;
  assert(splitRssiAvg(r) == -86);
}

TEST(test_link_report_includes_signal_changes_throttled) {
  SplitLeftHeld h = {};
  SplitLinkReporter r = {};
  h.linkUp = true;
  assert(splitLinkReportDue(r, h, 0));              // erster Bericht, noch ohne Messung
  assert(!splitLinkReportDue(r, h, 5000));
  splitNoteRssi(h, -60);
  assert(!splitLinkReportDue(r, h, 500));           // Messung beginnt, aber höchstens alle SPLIT_LINK_REPORT_MS
  assert(splitLinkReportDue(r, h, 1500));
  assert(!splitLinkReportDue(r, h, 9000));          // nichts geändert
  splitNoteRssi(h, -62);                            // neues Minimum
  assert(splitLinkReportDue(r, h, 10000));          // letzter Bericht lange her: sofort fällig
  splitNoteRssi(h, -64);                            // noch ein neues Minimum, direkt nach dem Bericht
  assert(!splitLinkReportDue(r, h, 10500));         // gedrosselt
  assert(splitLinkReportDue(r, h, 11000));
  for (int i = 0; i < 100; i++) splitNoteRssi(h, -64);
  assert(splitLinkReportDue(r, h, 20000));          // Durchschnitt mehr als 3 dBm weg vom gemeldeten Wert
  splitNoteRssi(h, -63);                            // Schwankung um 1 dBm, Minimum gleich
  assert(!splitLinkReportDue(r, h, 40000));
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
  assert(SPLIT_OP_TAP_PENDING == 19 && SPLIT_OP_TAP_FLUSH == 20);
  assert(SPLIT_OP_REPEAT == 21 && SPLIT_OP_REPEAT_RUN == 22);
  assert(SPLIT_OP_HOLD_PENDING == 23 && SPLIT_OP_HOLD_RESOLVE == 24 && SPLIT_OP_MOUSE_MOVE == 25);
  assert(SPLIT_OP_SLEEP == 26 && SPLIT_OP_OSL == 27 && SPLIT_OP_KEY_LOCK == 28 && SPLIT_OP_MASTER_PRESS == 29 && SPLIT_OP_SENTENCE_CASE_TOGGLE == 30 && SPLIT_OP_COUNT == 32 && SPLIT_OP_MOUSE_SPEED == 31);
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
                           SPLIT_OP_ONE_SHOT_PRESS, SPLIT_OP_CAPS_WORD_TOGGLE, SPLIT_OP_SENTENCE_CASE_TOGGLE};
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

// -----------------------------------------------------------------------------
// Repeat über beide Hälften (REPEAT, REPEAT_RUN)
// -----------------------------------------------------------------------------
TEST(test_repeat_ops_are_appended_and_directional) {
  SplitHidEvent out;
  assert(SPLIT_OP_REPEAT == 21 && SPLIT_OP_REPEAT_RUN == 22);
  // REPEAT als Taste: code 0/1 mit Nummer 1..127
  assert(parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_REPEAT, 1, 5), out));
  assert(parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_REPEAT, 0, 127), out));
  assert(!parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_REPEAT, 1, 0), out));    // ohne Nummer
  assert(!parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_REPEAT, 1, -1), out));
  // REPEAT als Notiz: code 2 oder 3 ohne Nummer
  assert(parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_REPEAT, 2), out));
  assert(parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_REPEAT, 3), out));
  assert(!parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_REPEAT, 2, 1), out));
  assert(!parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_REPEAT, 5), out));
  assert(!parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_REPEAT, 4), out));          // ALT_REPEAT ohne Nummer
  // REPEAT_RUN: nur Master -> links, mit Nummer 1..127
  assert(!parse(SPLIT_LEFT_MAC, makeSplitRepeatRun(true, 5), out));
  assert(parseMaster(SPLIT_MASTER_MAC, makeSplitRepeatRun(true, 5), out) && out.op == SPLIT_OP_REPEAT_RUN);
  assert(parseMaster(SPLIT_MASTER_MAC, makeSplitRepeatRun(false, 127), out));
  assert(!parseMaster(SPLIT_LEFT_MAC, makeSplitRepeatRun(true, 5), out));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_REPEAT_RUN, 1, 0), out));   // ohne Nummer
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_REPEAT_RUN, 3, 3), out));   // code > 2
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_REPEAT_RUN, 2, 0), out));   // ALT_REPEAT ohne Nummer
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_REPEAT_RUN, 1, -3), out));  // negative Nummer
}

TEST(test_left_note_sets_and_clears_the_left_as_last_flag) {
  assert(!held.repeatLastLeft);
  splitNoteLeftRx(held, makeSplitHidEvent(SPLIT_OP_REPEAT, 2), 100);
  assert(held.repeatLastLeft);
  // Ein Tastendruck ohne Notiz ändert das Merkmal nicht (kein Raten aus HID-Operationen)
  held.repeatLastLeft = false;
  apply(SPLIT_OP_KEY_PRESS, 'a');
  assert(!held.repeatLastLeft);
  splitNoteLeftRx(held, makeSplitHidEvent(SPLIT_OP_REPEAT, 2), 200);
  splitNoteLeftRx(held, makeSplitHidEvent(SPLIT_OP_REPEAT, 3), 300);   // Neustart links: nichts aufgezeichnet
  assert(!held.repeatLastLeft);
  // Eine Taste (code 0/1) ändert das Merkmal nicht
  splitNoteLeftRx(held, makeSplitHidEvent(SPLIT_OP_REPEAT, 2), 400);
  splitNoteLeftRx(held, makeSplitHidEvent(SPLIT_OP_REPEAT, 1, 3), 500);
  assert(held.repeatLastLeft);
}

TEST(test_right_repeat_goes_left_only_when_left_acted_last) {
  SplitRepeatSender s;
  splitRepeatSenderReset(s, 0);
  SplitHidEvent run;
  held.linkUp = true;
  assert(!splitRepeatRightPress(held, s, run, 100));           // nichts passiert: rechts wiederholt lokal
  held.repeatLastLeft = true;
  assert(splitRepeatRightPress(held, s, run, 100));
  assert(run.op == SPLIT_OP_REPEAT_RUN && run.code == 1 && run.arg == 1);
  SplitHidEvent run2;
  assert(splitRepeatRightPress(held, s, run2, 100) && run2.arg == 2);   // jedes Drücken hat eine neue Nummer
  held.linkUp = false;
  assert(!splitRepeatRightPress(held, s, run, 100));           // ohne Link bleibt es lokal
}

TEST(test_repeat_sequence_stays_within_one_to_127) {
  SplitRepeatSender s;
  splitRepeatSenderReset(s, 126);
  assert(splitRepeatNextSeq(s) == 127);
  assert(splitRepeatNextSeq(s) == 1);
  // Ein zufälliger Startwert (esp_random) bleibt im Bereich 1..127, auch bei 0 und 127
  for (unsigned seed : {0u, 127u, 254u, 255u}) {
    splitRepeatSenderReset(s, (uint8_t)seed);
    uint8_t n = splitRepeatNextSeq(s);
    assert(n >= 1 && n <= 127);
  }
}

static SplitHidEvent keyEv(bool down, int8_t seq) { return makeSplitHidEvent(SPLIT_OP_REPEAT, down ? 1 : 0, seq); }

TEST(test_left_repeat_key_runs_right_when_right_acted_last) {
  SplitRepeatSender s;
  splitRepeatSenderReset(s, 0);
  held.linkUp = true;
  SplitHidEvent run = {};
  SplitRepeatEnd old;
  assert(splitRepeatLeftKey(held, keyEv(true, 4), s, run, old, 100) == SPLIT_REPEAT_STEP_LOCAL_PRESS);
  // Retry-Duplikat des Drückens (gleiche Nummer) ändert nichts
  assert(splitRepeatLeftKey(held, keyEv(true, 4), s, run, old, 100) == SPLIT_REPEAT_STEP_NONE);
  // Ein Loslassen mit fremder Nummer ändert nichts
  assert(splitRepeatLeftKey(held, keyEv(false, 9), s, run, old, 100) == SPLIT_REPEAT_STEP_NONE);
  assert(splitRepeatLeftKey(held, keyEv(false, 4), s, run, old, 100) == SPLIT_REPEAT_STEP_LOCAL_RELEASE);
  assert(splitRepeatLeftKey(held, keyEv(false, 4), s, run, old, 100) == SPLIT_REPEAT_STEP_NONE);   // Duplikat
}

TEST(test_left_repeat_key_sends_the_run_back_when_left_acted_last) {
  SplitRepeatSender s;
  splitRepeatSenderReset(s, 0);
  held.linkUp = true;
  held.repeatLastLeft = true;
  SplitHidEvent run = {};
  SplitRepeatEnd old;
  assert(splitRepeatLeftKey(held, keyEv(true, 7), s, run, old, 100) == SPLIT_REPEAT_STEP_SEND);
  assert(run.op == SPLIT_OP_REPEAT_RUN && run.code == 1 && run.arg == 1);
  assert(s.open && s.openSeq == 1);                           // die Auffrischung läuft
  assert(splitRepeatLeftKey(held, keyEv(true, 7), s, run, old, 100) == SPLIT_REPEAT_STEP_NONE);
  assert(splitRepeatLeftKey(held, keyEv(false, 7), s, run, old, 100) == SPLIT_REPEAT_STEP_SEND);
  assert(run.code == 0 && run.arg == 1);                       // Loslassen trägt die Nummer des Drückens
  assert(!s.open);                                            // keine Auffrischung nach dem Loslassen
}

TEST(test_left_repeat_new_press_replaces_an_open_key_whose_release_was_lost) {
  SplitRepeatSender s;
  splitRepeatSenderReset(s, 0);
  held.linkUp = true;
  SplitHidEvent run = {};
  SplitRepeatEnd old;
  // Rechts hält die Wiederholung, das Loslassen geht verloren, ein neues Drücken kommt
  assert(splitRepeatLeftKey(held, keyEv(true, 1), s, run, old, 100) == SPLIT_REPEAT_STEP_LOCAL_PRESS);
  held.repeatReqAction = 'q';
  assert(splitRepeatLeftKey(held, keyEv(true, 2), s, run, old, 200) == SPLIT_REPEAT_STEP_LOCAL_PRESS);
  assert(old.rightAction == 'q' && !old.sendRun);             // die alte Wiederholung wird gelöst
  // Links hält die Wiederholung: die alte REPEAT_RUN-Taste bekommt ihr Loslassen
  held.repeatLastLeft = true;
  splitRepeatLeftKey(held, keyEv(false, 2), s, run, old, 300);
  assert(splitRepeatLeftKey(held, keyEv(true, 3), s, run, old, 400) == SPLIT_REPEAT_STEP_SEND);
  uint8_t firstSeq = (uint8_t)run.arg;
  assert(splitRepeatLeftKey(held, keyEv(true, 4), s, run, old, 500) == SPLIT_REPEAT_STEP_SEND);
  assert(old.sendRun && old.run.code == 0 && old.run.arg == (int8_t)firstSeq);
  assert(run.code == 1 && (uint8_t)run.arg != firstSeq);
}

TEST(test_left_repeat_cancel_ends_both_kinds_of_repeat_once) {
  SplitRepeatSender s;
  splitRepeatSenderReset(s, 0);
  held.linkUp = true;
  SplitHidEvent run = {};
  SplitRepeatEnd old;
  splitRepeatLeftKey(held, keyEv(true, 1), s, run, old, 100);
  held.repeatReqAction = 'q';
  SplitRepeatEnd e = splitRepeatLeftCancel(held, s);
  assert(e.rightAction == 'q' && !e.sendRun);
  e = splitRepeatLeftCancel(held, s);
  assert(e.rightAction == 0 && !e.sendRun);                    // genau einmal
  assert(splitRepeatLeftKey(held, keyEv(false, 1), s, run, old, 100) == SPLIT_REPEAT_STEP_NONE);
  // Links wiederholt: das Beenden sendet das Loslassen mit der Nummer des Drückens
  held.repeatLastLeft = true;
  splitRepeatLeftKey(held, keyEv(true, 5), s, run, old, 200);
  uint8_t seq = (uint8_t)run.arg;
  e = splitRepeatLeftCancel(held, s);
  assert(!e.rightAction && e.sendRun && e.run.code == 0 && (uint8_t)e.run.arg == seq);
  assert(!s.open);
}

TEST(test_repeat_sender_copies_each_packet_twice_and_refreshes_an_open_press) {
  SplitRepeatSender s;
  splitRepeatSenderReset(s, 0);
  SplitHidEvent ev = makeSplitRepeatRun(false, 9), out;
  splitRepeatSchedule(s, ev, 1000);
  assert(!splitRepeatDue(s, 1000 + SPLIT_REPEAT_COPY_MS - 1, out));
  assert(splitRepeatDue(s, 1000 + SPLIT_REPEAT_COPY_MS, out));
  assert(out.op == SPLIT_OP_REPEAT_RUN && out.arg == 9 && out.code == 0);
  assert(!splitRepeatDue(s, 1000 + SPLIT_REPEAT_COPY2_MS - 1, out));
  assert(splitRepeatDue(s, 1000 + SPLIT_REPEAT_COPY2_MS, out));
  assert(!splitRepeatDue(s, 5000, out));                       // genau zwei Kopien
  // Ein überlaufender Speicher verwirft neue Pakete, ohne ältere zu zerstören
  for (int i = 0; i < SPLIT_REPEAT_PENDING; i++) splitRepeatSchedule(s, makeSplitRepeatRun(true, 1 + i), 2000);
  assert(s.count == SPLIT_REPEAT_PENDING);
  assert(splitRepeatDue(s, 3000, out) && out.arg == 1);
  // Offenes Drücken: Auffrischung mit derselben Nummer, alle SPLIT_REPEAT_REFRESH_MS
  SplitRepeatSender t;
  splitRepeatSenderReset(t, 0);
  splitRepeatOpen(t, 6, 10000);
  assert(!splitRepeatRefresh(t, 10000 + SPLIT_REPEAT_REFRESH_MS - 1, out));
  assert(splitRepeatRefresh(t, 10000 + SPLIT_REPEAT_REFRESH_MS, out) && out.code == 1 && out.arg == 6);
  assert(!splitRepeatRefresh(t, 10000 + SPLIT_REPEAT_REFRESH_MS + 1, out));
  splitRepeatClose(t, 5);                                      // fremde Nummer schließt nichts
  assert(t.open);
  splitRepeatClose(t, 6);
  assert(!splitRepeatRefresh(t, 99999, out));
}

TEST(test_left_run_ignores_duplicates_and_stale_releases) {
  SplitRepeatRun r = {};
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(true, 4), 100) == SPLIT_REPEAT_RUN_PRESS);
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(true, 4), 130) == SPLIT_REPEAT_RUN_NONE);      // Kopie
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(false, 3), 140) == SPLIT_REPEAT_RUN_NONE);     // fremde Nummer
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(false, 4), 150) == SPLIT_REPEAT_RUN_RELEASE);
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(false, 4), 160) == SPLIT_REPEAT_RUN_NONE);     // Duplikat
  // Eine späte Kopie des alten Drückens startet nichts mehr
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(true, 4), 200) == SPLIT_REPEAT_RUN_NONE);
  // Ein neues Drücken ersetzt einen Lauf, dessen Loslassen verloren ging
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(true, 5), 300) == SPLIT_REPEAT_RUN_PRESS);
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(true, 6), 310) == SPLIT_REPEAT_RUN_PRESS);
  assert(splitRepeatRunStep(r, makeSplitHidEvent(SPLIT_OP_HEARTBEAT), 320) == SPLIT_REPEAT_RUN_NONE);
}

struct FakeRepeatEnv {
  uint16_t last = 'a';
  std::vector<std::string> log;
  uint16_t lastAction() { return last; }
  // Eigene Paare vor der festen Tabelle, wie altRepeatResolve() in DactylLogic.h
  AltRepeatPair custom[MAX_ALT_REPEATS] = {};
  uint8_t numCustom = 0;
  uint16_t altAction(uint16_t a) {
    uint16_t c = altRepeatCustom(custom, numCustom, a);
    return c ? c : altRepeatAction(a);
  }
  void press(uint16_t a) { log.push_back("P" + std::to_string(a)); }
  void release(uint16_t a) { log.push_back("R" + std::to_string(a)); }
  void localPress(uint16_t a) { press(a); }
  void localRelease(uint16_t a) { release(a); }
  std::vector<SplitHidEvent> sent;
  void sendRun(const SplitHidEvent &e) { sent.push_back(e); }
};

TEST(test_alt_repeat_custom_pair_applies_on_the_master_local_press) {
  FakeRepeatEnv env;
  env.last = 'e';
  env.custom[0] = { 'e', 'u' };
  env.numCustom = 1;
  SplitLeftHeld held = {};
  SplitRepeatSender s = {};
  splitRepeatMasterEvent(held, s, makeSplitHidEvent(SPLIT_OP_REPEAT, SPLIT_REPEAT_CODE_ALT_PRESS, 3), 100, env);
  assert(env.log.size() == 1 && env.log[0] == "P" + std::to_string('u'));
  // Ohne eigenes Paar gilt die feste Tabelle weiter
  FakeRepeatEnv plain;
  plain.last = KEY_LEFT_ARROW;
  SplitLeftHeld held2 = {};
  SplitRepeatSender s2 = {};
  splitRepeatMasterEvent(held2, s2, makeSplitHidEvent(SPLIT_OP_REPEAT, SPLIT_REPEAT_CODE_ALT_PRESS, 3), 100, plain);
  assert(plain.log.size() == 1 && plain.log[0] == "P" + std::to_string(KEY_RIGHT_ARROW));
}

TEST(test_alt_repeat_custom_pair_applies_on_the_left_run) {
  FakeRepeatEnv env;
  env.last = 'e';
  env.custom[0] = { 'e', 'u' };
  env.numCustom = 1;
  SplitRepeatRun r = {};
  splitRepeatLeftRunEvent(r, makeSplitRepeatRun(true, 4, true), 1000, env);
  assert(env.log.size() == 1 && env.log[0] == "P" + std::to_string('u'));
  splitRepeatLeftRunEvent(r, makeSplitRepeatRun(false, 4), 1010, env);
  assert(env.log.size() == 2 && env.log[1] == "R" + std::to_string('u'));
}

TEST(test_left_run_timeout_releases_a_held_repeat_without_refresh) {
  SplitRepeatRun r = {};
  FakeRepeatEnv env;
  splitRepeatLeftRunEvent(r, makeSplitRepeatRun(true, 4), 1000, env);
  assert((env.log == std::vector<std::string>{"P97"}));
  // Die Auffrischung des Masters hält den Lauf am Leben
  splitRepeatLeftRunEvent(r, makeSplitRepeatRun(true, 4), 1000 + SPLIT_REPEAT_RUN_TIMEOUT_MS - 1, env);
  splitRepeatLeftRunTick(r, 1000 + SPLIT_REPEAT_RUN_TIMEOUT_MS + 5, env);
  assert(env.log.size() == 1 && r.active);
  // Ohne Auffrischung endet er: die Taste bleibt nicht dauerhaft gehalten
  splitRepeatLeftRunTick(r, 1000 + 2 * SPLIT_REPEAT_RUN_TIMEOUT_MS, env);
  assert((env.log == std::vector<std::string>{"P97", "R97"}) && !r.active);
  splitRepeatLeftRunTick(r, 99999, env);
  assert(env.log.size() == 2);                                 // genau einmal
}

TEST(test_left_run_new_press_releases_the_old_action_first) {
  SplitRepeatRun r = {};
  FakeRepeatEnv env;
  splitRepeatLeftRunEvent(r, makeSplitRepeatRun(true, 4), 100, env);
  env.last = 'b';
  splitRepeatLeftRunEvent(r, makeSplitRepeatRun(true, 5), 200, env);
  assert((env.log == std::vector<std::string>{"P97", "R97", "P98"}));
  splitRepeatLeftRunEvent(r, makeSplitRepeatRun(false, 5), 300, env);
  assert(env.log.back() == "R98");
  // Ohne aufgezeichnete Aktion drückt und löst ein Lauf nichts
  env.log.clear();
  env.last = 0;
  splitRepeatLeftRunEvent(r, makeSplitRepeatRun(true, 6), 400, env);
  splitRepeatLeftRunEvent(r, makeSplitRepeatRun(false, 6), 410, env);
  assert(env.log.empty());
}

// -----------------------------------------------------------------------------
// Alternate repeat (ACT_ALT_REPEAT) über beide Hälften
// -----------------------------------------------------------------------------
TEST(test_alt_repeat_packets_are_valid_and_directional) {
  SplitHidEvent out;
  assert(SPLIT_REPEAT_CODE_ALT_PRESS == 4 && SPLIT_REPEAT_RUN_CODE_ALT_PRESS == 2);
  assert(parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_REPEAT, SPLIT_REPEAT_CODE_ALT_PRESS, 5), out));
  assert(!parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_REPEAT, SPLIT_REPEAT_CODE_ALT_PRESS, 0), out));
  assert(!parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_REPEAT, SPLIT_REPEAT_CODE_ALT_PRESS, -1), out));
  assert(parseMaster(SPLIT_MASTER_MAC, makeSplitRepeatRun(true, 5, true), out) && out.code == 2);
  assert(!parse(SPLIT_LEFT_MAC, makeSplitRepeatRun(true, 5, true), out));   // nur Master -> links
  assert(makeSplitRepeatRun(true, 5).code == 1 && makeSplitRepeatRun(false, 5, true).code == 0);
}

TEST(test_alt_repeat_key_right_with_left_last_sends_alt_run) {
  SplitLeftHeld held = {};
  SplitRepeatSender s;
  splitRepeatSenderReset(s, 0);
  SplitHidEvent run;
  assert(!splitRepeatRightPress(held, s, run, 100, true));        // nichts links aufgezeichnet
  held.linkUp = true;
  held.repeatLastLeft = true;
  assert(splitRepeatRightPress(held, s, run, 100, true));
  assert(run.op == SPLIT_OP_REPEAT_RUN && run.code == SPLIT_REPEAT_RUN_CODE_ALT_PRESS && run.arg == 1);
  assert(splitRepeatRightPress(held, s, run, 100) && run.code == 1);   // Repeat bleibt unverändert
}

TEST(test_alt_repeat_refresh_keeps_the_alt_flag_for_both_key_halves) {
  // Rechte ALT-Taste: die Auffrischung trägt code 2, damit eine Hälfte ohne das erste Paket nicht REPEAT startet
  SplitLeftHeld held = {};
  held.linkUp = true;
  held.repeatLastLeft = true;
  SplitRepeatSender s;
  splitRepeatSenderReset(s, 0);
  SplitHidEvent run, out;
  assert(splitRepeatRightPress(held, s, run, 100, true));
  assert(splitRepeatRefresh(s, 100 + SPLIT_REPEAT_REFRESH_MS, out));
  assert(out.code == SPLIT_REPEAT_RUN_CODE_ALT_PRESS && out.arg == run.arg);
  // Danach eine normale Repeat-Taste: die Auffrischung fällt auf code 1 zurück
  splitRepeatClose(s, (uint8_t)run.arg);
  assert(splitRepeatRightPress(held, s, run, 5000));
  assert(splitRepeatRefresh(s, 5000 + SPLIT_REPEAT_REFRESH_MS, out) && out.code == 1);
  // Linke ALT-Taste, links zuletzt: die Auffrischung trägt ebenfalls code 2
  SplitLeftHeld h2 = {};
  h2.linkUp = true;
  h2.repeatLastLeft = true;
  SplitRepeatSender s2;
  splitRepeatSenderReset(s2, 0);
  SplitRepeatEnd old;
  assert(splitRepeatLeftKey(h2, makeSplitHidEvent(SPLIT_OP_REPEAT, SPLIT_REPEAT_CODE_ALT_PRESS, 3), s2, run, old, 100) == SPLIT_REPEAT_STEP_SEND);
  assert(splitRepeatRefresh(s2, 100 + SPLIT_REPEAT_REFRESH_MS, out) && out.code == SPLIT_REPEAT_RUN_CODE_ALT_PRESS);
  // Ein Lauf ohne erstes Paket: die Auffrischung mit code 2 startet das Gegenteil, nicht die Aktion selbst
  SplitRepeatRun r = {};
  FakeRepeatEnv env;
  env.last = KEY_LEFT_ARROW;
  splitRepeatLeftRunEvent(r, out, 2000, env);
  assert((env.log == std::vector<std::string>{"P" + std::to_string(KEY_RIGHT_ARROW)}));
}

TEST(test_alt_repeat_key_left_after_right_key_runs_the_opposite_on_the_master) {
  SplitLeftHeld held = {};
  held.linkUp = true;
  SplitRepeatSender s;
  splitRepeatSenderReset(s, 0);
  FakeRepeatEnv env;
  env.last = KEY_LEFT_ARROW;                                       // rechts war zuletzt: Pfeil links
  splitRepeatMasterEvent(held, s, makeSplitHidEvent(SPLIT_OP_REPEAT, SPLIT_REPEAT_CODE_ALT_PRESS, 3), 100, env);
  assert((env.log == std::vector<std::string>{"P" + std::to_string(KEY_RIGHT_ARROW)}));
  splitRepeatMasterEvent(held, s, makeSplitHidEvent(SPLIT_OP_REPEAT, SPLIT_REPEAT_CODE_ALT_PRESS, 3), 110, env);  // Retry
  assert(env.log.size() == 1);
  splitRepeatMasterEvent(held, s, makeSplitHidEvent(SPLIT_OP_REPEAT, 0, 3), 120, env);
  assert((env.log == std::vector<std::string>{"P" + std::to_string(KEY_RIGHT_ARROW), "R" + std::to_string(KEY_RIGHT_ARROW)}));
}

TEST(test_alt_repeat_key_left_without_opposite_does_nothing_on_the_master) {
  SplitLeftHeld held = {};
  held.linkUp = true;
  SplitRepeatSender s;
  splitRepeatSenderReset(s, 0);
  FakeRepeatEnv env;
  env.last = 'a';
  splitRepeatMasterEvent(held, s, makeSplitHidEvent(SPLIT_OP_REPEAT, SPLIT_REPEAT_CODE_ALT_PRESS, 3), 100, env);
  splitRepeatMasterEvent(held, s, makeSplitHidEvent(SPLIT_OP_REPEAT, 0, 3), 120, env);
  assert(env.log.empty());
}

TEST(test_alt_repeat_key_left_with_left_last_forwards_alt_run) {
  SplitLeftHeld held = {};
  held.linkUp = true;
  held.repeatLastLeft = true;
  SplitRepeatSender s;
  splitRepeatSenderReset(s, 0);
  FakeRepeatEnv env;
  splitRepeatMasterEvent(held, s, makeSplitHidEvent(SPLIT_OP_REPEAT, SPLIT_REPEAT_CODE_ALT_PRESS, 3), 100, env);
  assert(env.log.empty() && env.sent.size() == 1);
  assert(env.sent[0].op == SPLIT_OP_REPEAT_RUN && env.sent[0].code == SPLIT_REPEAT_RUN_CODE_ALT_PRESS);
}

TEST(test_alt_run_on_the_left_half_presses_the_opposite_of_its_last_action) {
  SplitRepeatRun r = {};
  FakeRepeatEnv env;
  env.last = KEY_UP_ARROW;
  splitRepeatLeftRunEvent(r, makeSplitRepeatRun(true, 4, true), 1000, env);
  assert((env.log == std::vector<std::string>{"P" + std::to_string(KEY_DOWN_ARROW)}));
  splitRepeatLeftRunEvent(r, makeSplitRepeatRun(false, 4), 1010, env);   // Loslassen löst das Gegenteil
  assert((env.log == std::vector<std::string>{"P" + std::to_string(KEY_DOWN_ARROW), "R" + std::to_string(KEY_DOWN_ARROW)}));
  // Ohne Gegenteil bleibt links alles still
  FakeRepeatEnv env2;
  SplitRepeatRun r2 = {};
  env2.last = 'a';
  splitRepeatLeftRunEvent(r2, makeSplitRepeatRun(true, 7, true), 2000, env2);
  splitRepeatLeftRunEvent(r2, makeSplitRepeatRun(false, 7), 2010, env2);
  assert(env2.log.empty());
}

TEST(test_master_event_runs_the_right_action_and_releases_it_with_the_key) {
  SplitRepeatSender s;
  splitRepeatSenderReset(s, 0);
  held.linkUp = true;
  FakeRepeatEnv env;
  splitRepeatMasterEvent(held, s, keyEv(true, 3), 100, env);
  splitRepeatMasterEvent(held, s, keyEv(true, 3), 110, env);   // Retry-Duplikat
  assert((env.log == std::vector<std::string>{"P97"}));
  splitRepeatMasterEvent(held, s, keyEv(false, 3), 120, env);
  assert((env.log == std::vector<std::string>{"P97", "R97"}));
  // RELEASE_ALL beendet eine offene Taste genau einmal
  env.log.clear();
  splitRepeatMasterEvent(held, s, keyEv(true, 4), 200, env);
  splitRepeatMasterEvent(held, s, makeSplitHidEvent(SPLIT_OP_RELEASE_ALL), 210, env);
  splitRepeatMasterEvent(held, s, makeSplitHidEvent(SPLIT_OP_RELEASE_ALL), 220, env);
  assert((env.log == std::vector<std::string>{"P97", "R97"}));
  // Links war zuletzt: das Drücken geht als REPEAT_RUN zurück, das Loslassen ebenso
  env.log.clear();
  held.repeatLastLeft = true;
  splitRepeatMasterEvent(held, s, keyEv(true, 5), 300, env);
  splitRepeatMasterEvent(held, s, keyEv(false, 5), 310, env);
  assert(env.log.empty() && env.sent.size() == 2);
  assert(env.sent[0].code == 1 && env.sent[1].code == 0 && env.sent[0].arg == env.sent[1].arg);
}

TEST(test_deferred_repeat_end_survives_a_busy_mutex) {
  SplitRepeatDeferred d = {};
  splitRepeatDefer(d, keyEv(true, 1));                         // ein Drücken wird nie vorgemerkt
  assert(!d.valid);
  splitRepeatDefer(d, keyEv(false, 1));
  assert(d.valid && d.ev.code == 0);
  splitRepeatDefer(d, makeSplitHidEvent(SPLIT_OP_RELEASE_ALL));
  assert(d.ev.op == SPLIT_OP_RELEASE_ALL);                     // RELEASE_ALL gilt mehr als ein einzelnes Loslassen
  splitRepeatDefer(d, keyEv(false, 2));
  assert(d.ev.op == SPLIT_OP_RELEASE_ALL);
}

static int repeatCalls = 0;
static std::vector<uint16_t> repeatCodes;
static void recordRepeat(const SplitHidEvent &ev) { repeatCalls++; repeatCodes.push_back(ev.op * 10 + ev.code); }

TEST(test_process_rx_hands_repeat_to_the_master_callback) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  appliedCodes.clear();
  repeatCalls = 0;
  repeatCodes.clear();
  splitRxPush(rxq, keyEv(true, 1));
  splitRxPush(rxq, keyEv(false, 1));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, recordApplied, nullptr, nullptr,
                                     nullptr, recordRepeat);
  assert(repeatCalls == 2 && rep.applied == 2);
  assert((repeatCodes == std::vector<uint16_t>{SPLIT_OP_REPEAT * 10 + 1, SPLIT_OP_REPEAT * 10}));
  assert(k.log.empty());                                       // REPEAT hat selbst keine HID-Wirkung
}

TEST(test_process_rx_note_needs_no_host_and_is_not_an_action) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  repeatCalls = 0;
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_REPEAT, 2));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, false, 100, nullptr, nullptr, nullptr,
                                     nullptr, recordRepeat);
  assert(k.splitLeft.repeatLastLeft && k.splitLeft.linkUp);
  assert(repeatCalls == 0 && rep.applied == 0);                // eine Notiz ist keine Ausführung und kein Callback
}

TEST(test_process_rx_repeat_press_flushes_waiting_taps_first) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  static int order;
  static int beforeAt, repeatAt;
  order = beforeAt = repeatAt = 0;
  splitRxPush(rxq, keyEv(true, 1));
  splitRxPush(rxq, keyEv(false, 1));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, nullptr, nullptr, nullptr,
                 [](const SplitHidEvent &) { beforeAt = ++order; }, [](const SplitHidEvent &ev) {
                   if (ev.code == 1) repeatAt = ++order;
                 });
  assert(beforeAt == 1 && repeatAt == 2);                      // nur vor dem Drücken, nicht vor dem Loslassen
}

TEST(test_process_rx_without_host_ignores_repeat_keys) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  repeatCalls = 0;
  splitRxPush(rxq, keyEv(true, 1));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, false, 100, nullptr, nullptr, nullptr,
                                     nullptr, recordRepeat);
  assert(repeatCalls == 0 && rep.applied == 0);
  assert(k.splitLeft.linkUp);                                  // der Link lebt trotzdem
}

TEST(test_process_rx_release_all_ends_an_open_repeat) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  repeatCodes.clear();
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_RELEASE_ALL));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, nullptr, nullptr, nullptr, nullptr, recordRepeat);
  assert((repeatCodes == std::vector<uint16_t>{SPLIT_OP_RELEASE_ALL * 10}));
}

TEST(test_left_reboot_note_clears_the_flag_without_a_link_timeout) {
  // Die linke Hälfte startet schneller neu als SPLIT_LINK_TIMEOUT_MS: ihre Notiz code 3 setzt das Merkmal zurück
  held.linkUp = true;
  held.lastRxMs = 1000;
  held.repeatLastLeft = true;
  splitNoteLeftRx(held, makeSplitHidEvent(SPLIT_OP_REPEAT, 3), 1500);
  assert(!held.repeatLastLeft);
  // Ein Link-Ausfall allein ändert nichts: die linke Hälfte behält ihre Aktion
  held.repeatLastLeft = true;
  assert(splitCheckLinkTimeout(held, 1500 + SPLIT_LINK_TIMEOUT_MS, sink));
  assert(held.repeatLastLeft);
  // Das Zurücksetzen des Masters löscht alles
  held.repeatReq = SPLIT_REPEAT_REQ_RIGHT;
  splitHeldReset(held);
  assert(held.repeatReq == SPLIT_REPEAT_REQ_NONE && !held.repeatLastLeft);
}

TEST(test_left_run_ignores_a_late_copy_of_an_older_press) {
  SplitRepeatRun r = {};
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(true, 4), 100) == SPLIT_REPEAT_RUN_PRESS);
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(false, 4), 110) == SPLIT_REPEAT_RUN_RELEASE);
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(true, 5), 120) == SPLIT_REPEAT_RUN_PRESS);
  // Die Kopie des Drückens 4 trifft 30 ms später ein, während Lauf 5 offen ist: sie schneidet ihn nicht ab
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(true, 4), 130) == SPLIT_REPEAT_RUN_NONE);
  assert(r.active && r.seq == 5);
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(false, 5), 140) == SPLIT_REPEAT_RUN_RELEASE);
  // Auch nach dem Loslassen von 5 startet die späte Kopie von 4 nichts
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(true, 4), 150) == SPLIT_REPEAT_RUN_NONE);
}

TEST(test_repeat_sequence_order_wraps_at_127) {
  assert(splitRepeatSeqNewer(2, 1) && !splitRepeatSeqNewer(1, 2));
  assert(splitRepeatSeqNewer(1, 127));              // Umlauf: 1 folgt auf 127
  assert(!splitRepeatSeqNewer(127, 1));
  assert(!splitRepeatSeqNewer(5, 5));
  SplitRepeatRun r = {};
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(true, 127), 100) == SPLIT_REPEAT_RUN_PRESS);
  splitRepeatRunStep(r, makeSplitRepeatRun(false, 127), 110);
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(true, 1), 120) == SPLIT_REPEAT_RUN_PRESS);
}

TEST(test_left_run_accepts_any_number_after_a_quiet_period) {
  // Der Master startet neu: seine Nummern beginnen zufällig, auch "älter" als die letzte bekannte Nummer
  SplitRepeatRun r = {};
  splitRepeatRunStep(r, makeSplitRepeatRun(true, 100), 100);
  splitRepeatRunStep(r, makeSplitRepeatRun(false, 100), 110);
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(true, 90), 120) == SPLIT_REPEAT_RUN_NONE);   // älter, Ruhe zu kurz
  assert(splitRepeatRunStep(r, makeSplitRepeatRun(true, 90), 100 + SPLIT_REPEAT_STALE_MS) == SPLIT_REPEAT_RUN_PRESS);
}

TEST(test_master_takes_a_pair_held_for_a_left_repeat_key_once) {
  SplitRepeatSender s;
  splitRepeatSenderReset(s, 0);
  held.linkUp = true;
  FakeRepeatEnv env;
  env.last = 0x140;                                        // ein Tastenpaar
  splitRepeatMasterEvent(held, s, keyEv(true, 3), 100, env);
  auto isPair = [](uint16_t a) { return a >= 0x140 && a < 0x150; };
  assert(splitRepeatTakeHeldPair(held, isPair) == 0x140);  // CLEAR_PAIRS löst es vor der Änderung der Tabelle
  assert(splitRepeatTakeHeldPair(held, isPair) == 0);
  // Das spätere Loslassen löst dann nichts mehr doppelt
  env.log.clear();
  splitRepeatMasterEvent(held, s, keyEv(false, 3), 120, env);
  assert(env.log.empty());
  // Eine andere Aktion ist kein Paar
  env.last = 'a';
  splitRepeatMasterEvent(held, s, keyEv(true, 4), 200, env);
  assert(splitRepeatTakeHeldPair(held, isPair) == 0);
}


TEST(test_second_deferred_release_of_another_key_ends_everything) {
  SplitRepeatDeferred d = {};
  splitRepeatDefer(d, keyEv(false, 5));
  splitRepeatDefer(d, keyEv(false, 5));                    // dasselbe Loslassen (Retry): bleibt
  assert(d.valid && d.ev.op == SPLIT_OP_REPEAT && d.ev.arg == 5);
  splitRepeatDefer(d, keyEv(false, 6));                    // anderes Loslassen: nichts darf verloren gehen
  assert(d.valid && d.ev.op == SPLIT_OP_RELEASE_ALL);
}

TEST(test_deliver_runs_the_pending_end_first_and_defers_when_busy) {
  SplitRepeatDeferred d = {};
  std::vector<std::string> order;
  bool busy = true;
  auto apply = [&](const SplitHidEvent &ev) {
    if (busy) return false;
    order.push_back(ev.op == SPLIT_OP_RELEASE_ALL ? "ALL" : (ev.code ? "P" : "R") + std::to_string(ev.arg));
    return true;
  };
  assert(!splitRepeatDeliver(d, keyEv(false, 5), apply));  // Mutex belegt: vorgemerkt
  assert(d.valid && order.empty());
  assert(!splitRepeatDeliver(d, keyEv(true, 6), apply));   // ein Drücken geht dann verloren, nicht das Loslassen
  assert(d.valid && d.ev.arg == 5);
  busy = false;
  assert(splitRepeatDeliver(d, keyEv(true, 7), apply));    // frei: das ältere Ende zuerst, dann das neue Ereignis
  assert((order == std::vector<std::string>{"R5", "P7"}));
  assert(!d.valid);
}

TEST(test_process_rx_cancels_an_open_repeat_on_link_loss_overflow_and_host_loss) {
  // Link-Ausfall
  {
    Kbd k;
    uint32_t droppedSeen = 0;
    bool hostWas = true;
    k.splitLeft.linkUp = true;
    k.splitLeft.lastRxMs = 1000;
    repeatCodes.clear();
    splitProcessRx(k, rxq, droppedSeen, hostWas, true, 1000 + SPLIT_LINK_TIMEOUT_MS, nullptr, nullptr, nullptr,
                   nullptr, recordRepeat);
    assert((repeatCodes == std::vector<uint16_t>{SPLIT_OP_RELEASE_ALL * 10}));
  }
  // Mac getrennt
  {
    Kbd k;
    uint32_t droppedSeen = 0;
    bool hostWas = true;
    repeatCodes.clear();
    splitProcessRx(k, rxq, droppedSeen, hostWas, false, 100, nullptr, nullptr, nullptr, nullptr, recordRepeat);
    assert((repeatCodes == std::vector<uint16_t>{SPLIT_OP_RELEASE_ALL * 10}));
  }
  // Voller Empfangsring
  {
    Kbd k;
    uint32_t droppedSeen = 0;
    bool hostWas = true;
    repeatCodes.clear();
    rxq.dropped = 1;
    splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, nullptr, nullptr, nullptr, nullptr, recordRepeat);
    assert((repeatCodes == std::vector<uint16_t>{SPLIT_OP_RELEASE_ALL * 10}));
  }
  // Ohne Ausnahme: nichts zu beenden
  splitRxReset(rxq);
  {
    Kbd k;
    uint32_t droppedSeen = 0;
    bool hostWas = true;
    repeatCodes.clear();
    splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, nullptr, nullptr, nullptr, nullptr, recordRepeat);
    assert(repeatCodes.empty());
  }
}



// -----------------------------------------------------------------------------
// Mod-Tap über beide Hälften (HOLD_PENDING, HOLD_RESOLVE)
// -----------------------------------------------------------------------------
TEST(test_hold_ops_are_directional_and_range_checked) {
  SplitHidEvent out;
  // HOLD_PENDING: beide Richtungen, code 0/1, ohne arg
  assert(parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 1), out) && out.op == SPLIT_OP_HOLD_PENDING);
  assert(parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 0), out));
  assert(parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 1), out) && out.code == 1);
  assert(parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 0), out));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 2), out));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 1, 1), out));
  // HOLD_RESOLVE: beide Richtungen, ohne Werte
  assert(parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_HOLD_RESOLVE), out) && out.op == SPLIT_OP_HOLD_RESOLVE);
  assert(parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_HOLD_RESOLVE), out) && out.op == SPLIT_OP_HOLD_RESOLVE);
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_HOLD_RESOLVE, 1), out));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_HOLD_RESOLVE, 0, 1), out));
  // Falscher Absender: das Master-Paket von der linken MAC und umgekehrt
  assert(!parseMaster(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_HOLD_RESOLVE), out));
  assert(!parse(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 1), out));
  // Ein HOLD-Paket hat keine HID-Wirkung und ist kein Druck
  assert(!splitIsPressOp(SPLIT_OP_HOLD_PENDING) && !splitIsPressOp(SPLIT_OP_HOLD_RESOLVE));
  // Wiederholbar: ein Duplikat ändert nichts (Zustand, nicht Ereignis)
  assert(splitEventRetryable(makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 1)));
  assert(splitEventRetryable(makeSplitHidEvent(SPLIT_OP_HOLD_RESOLVE)));
}

TEST(test_left_hold_pending_from_rx_without_host_and_without_activity) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 1));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, false, 1000, nullptr);
  assert(rep.applied == 0 && k.log.empty());      // keine HID-Wirkung, keine Aktivität
  assert(splitLeftHoldPending(k.splitLeft, 1000));
  assert(splitLeftHolds(k.splitLeft, 1000));
  // 0 löscht die Meldung
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 0));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 1010, nullptr);
  assert(!splitLeftHoldPending(k.splitLeft, 1010) && !splitLeftHolds(k.splitLeft, 1010));
}

TEST(test_left_hold_pending_expires_and_clears_on_link_loss) {
  SplitLeftHeld h;
  splitHeldReset(h);
  splitNoteLeftRx(h, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 1), 1000);
  assert(splitLeftHoldPending(h, 1000 + SPLIT_HOLD_PENDING_MAX_MS - 1));
  assert(!splitLeftHoldPending(h, 1000 + SPLIT_HOLD_PENDING_MAX_MS));      // eine verlorene 0 bremst nicht dauerhaft
  assert(SPLIT_HOLD_PENDING_MAX_MS > 500);                                 // länger als der größte Tapping-Term
  // Überlauf von millis()
  splitNoteLeftRx(h, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 1), 0xFFFFFF00UL);
  assert(splitLeftHoldPending(h, 0xFFFFFF00UL + 300));
  // Link-Ausfall löscht die Meldung
  RecordingSink s;
  assert(splitCheckLinkTimeout(h, 0xFFFFFF00UL + SPLIT_LINK_TIMEOUT_MS, s));
  assert(!h.holdPending && !splitLeftHoldPending(h, 0xFFFFFF00UL + SPLIT_LINK_TIMEOUT_MS));
  // Ein neuer Link beginnt ohne Meldung
  h.holdPending = true;
  splitNoteLeftRx(h, makeSplitHidEvent(SPLIT_OP_HEARTBEAT), 5000);
  assert(!splitLeftHoldPending(h, 5000));
  // Ohne Link gilt keine Meldung
  splitHeldReset(h);
  h.holdPending = true;
  h.holdPendingMs = 100;
  assert(!splitLeftHoldPending(h, 100));
}

TEST(test_tap_and_hold_pending_are_independent_but_share_the_hold_back) {
  SplitLeftHeld h;
  splitHeldReset(h);
  splitNoteLeftRx(h, makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 1), 1000);
  assert(splitLeftTapPending(h, 1000) && !splitLeftHoldPending(h, 1000) && splitLeftHolds(h, 1000));
  splitNoteLeftRx(h, makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 0), 1010);
  assert(!splitLeftHolds(h, 1010));
  splitNoteLeftRx(h, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 1), 1020);
  assert(!splitLeftTapPending(h, 1020) && splitLeftHoldPending(h, 1020) && splitLeftHolds(h, 1020));
  // Beide gleichzeitig: erst wenn beide 0 melden, löst sich das Zurückhalten
  splitNoteLeftRx(h, makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 1), 1030);
  splitNoteLeftRx(h, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 0), 1040);
  assert(splitLeftHolds(h, 1040));
  splitNoteLeftRx(h, makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 0), 1050);
  assert(!splitLeftHolds(h, 1050));
}

TEST(test_hold_reporter_reports_changes_once_and_retries_a_failed_send) {
  SplitHoldReporter rep = {};
  std::vector<SplitHidEvent> sent;
  bool ok = true;
  auto send = [&](const SplitHidEvent &ev) { if (ok) sent.push_back(ev); return ok; };
  // Nichts offen und nichts gemeldet: kein Paket
  assert(!splitHoldReportIfChanged(rep, true, false, send) && sent.empty());
  // Offen: 1 genau einmal
  assert(splitHoldReportIfChanged(rep, true, true, send));
  assert(!splitHoldReportIfChanged(rep, true, true, send));
  assert(sent.size() == 1 && sent[0].op == SPLIT_OP_HOLD_PENDING && sent[0].code == 1);
  // Entschieden: 0 genau einmal
  assert(splitHoldReportIfChanged(rep, true, false, send));
  assert(!splitHoldReportIfChanged(rep, true, false, send));
  assert(sent.size() == 2 && sent[1].code == 0);
  // Ein Sendefehler gilt nicht als gemeldet: der nächste Durchlauf versucht es erneut
  ok = false;
  assert(!splitHoldReportIfChanged(rep, true, true, send) && !rep.reported);
  ok = true;
  assert(splitHoldReportIfChanged(rep, true, true, send) && rep.reported);
  // Ohne Link gilt nichts als gemeldet: nach dem Link-Aufbau wird ein offener Zustand neu gemeldet
  size_t before = sent.size();
  assert(!splitHoldReportIfChanged(rep, false, true, send) && !rep.reported && sent.size() == before);
  assert(splitHoldReportIfChanged(rep, true, true, send) && sent.size() == before + 1);
}

// Ablauf am Master, Richtung links -> Master: links hält MO_1 unentschieden (HOLD_PENDING 1). Eine Master-Taste X wird
// zurückgehalten und löst HOLD_RESOLVE aus. Die linke Hälfte entscheidet, meldet die Ebene (LAYER_STATE) und HOLD_PENDING 0;
// erst dann führt der Master X aus, und X sieht die neue Ebene.
static unsigned rxLayerSeen = 0;
static void rxLayerSeenCount(const SplitHidEvent &) { rxLayerSeen++; }

TEST(test_left_hold_pending_holds_master_key_until_layer_and_zero_arrive) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  rxOrder.clear();
  splitDeferReset(rxDefer);
  rxLayerSeen = 0;
  // Links meldet eine unentschiedene Mod-Tap-Taste
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 1));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, rxAppliedCode);
  assert(splitLeftHolds(k.splitLeft, 105));
  // Master-Taste X: zurückgehalten, HOLD_RESOLVE wird angefordert (genau einmal)
  splitDeferApplyOrHold(rxDefer, 2, 2, true, splitLeftHolds(k.splitLeft, 105), 105, rxDeferApply);
  assert(rxOrder.empty() && rxDefer.count == 1);
  assert(splitDeferTakeFlushRequest(rxDefer) && !splitDeferTakeFlushRequest(rxDefer));
  // Noch keine Entscheidung und die Zeitgrenze nicht erreicht: X wartet
  assert(!splitDeferReplayDue(rxDefer, splitLeftHolds(k.splitLeft, 110), 110));
  // Links entscheidet: erst die Ebene, dann HOLD_PENDING 0. Beide gehen in dieser Reihenfolge durch den Ring.
  splitRxPush(rxq, makeSplitLayerEvent(0x02, 0, false));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 0));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 112, rxAppliedCode, nullptr, rxLayerSeenCount);
  assert(rxLayerSeen == 1);                                     // die Ebene ist übernommen, bevor X läuft
  assert(!splitLeftHolds(k.splitLeft, 112));
  assert(splitDeferReplayDue(rxDefer, splitLeftHolds(k.splitLeft, 112), 112));
  splitDeferReplay(rxDefer, rxDeferApply);
  assert((rxOrder == std::vector<std::string>{"local-d22"}));
}

TEST(test_hold_resolve_from_left_calls_hook_only_with_host) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  static unsigned resolves;
  resolves = 0;
  auto onResolve = [](const SplitHidEvent &) { resolves++; };
  // Mit Host: der Hook läuft (der Master entscheidet seine offenen Mod-Tap-Tasten)
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HOLD_RESOLVE));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, nullptr, nullptr, nullptr, nullptr,
                                     nullptr, onResolve);
  assert(resolves == 1 && rep.applied == 0 && k.log.empty());   // keine HID-Ausgabe, keine Aktivität
  assert(k.splitLeft.linkUp);                                     // das Paket hält den Link
  // Ohne Host gibt es nichts zu entscheiden
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HOLD_RESOLVE));
  splitProcessRx(k, rxq, droppedSeen, hostWas, false, 200, nullptr, nullptr, nullptr, nullptr, nullptr, onResolve);
  assert(resolves == 1 && k.splitLeft.linkUp);
  // Mehrere HOLD_RESOLVE in einem Durchlauf rufen den Hook je Paket (er ist idempotent)
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HOLD_RESOLVE));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HOLD_RESOLVE));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 300, nullptr, nullptr, nullptr, nullptr, nullptr, onResolve);
  assert(resolves == 3);
}

TEST(test_hold_pending_and_resolve_do_not_count_as_left_key_or_trigger_before_left_press) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  rxOrder.clear();
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 1));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HOLD_RESOLVE));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 0));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, recordAppliedOrder, nullptr, nullptr,
                                     recordBeforePress);
  assert(rxOrder.empty() && rep.applied == 0 && rep.keyEvents == 0);
}

// -----------------------------------------------------------------------------
// Mod-Tap über beide Hälften: Befunde aus dem Review (Reihenfolge, Loslassen, Replay vor dem linken Druck)
// -----------------------------------------------------------------------------
TEST(test_resolve_request_only_for_a_held_press) {
  SplitLocalDefer d;
  splitDeferReset(d);
  // Nur ein Loslassen zurückgehalten (Überlappen: a drücken, Mod-Tap drücken, a loslassen): kein HOLD_RESOLVE
  assert(splitDeferPush(d, 1, 1, false, 100));
  assert(!splitDeferHasPress(d));
  assert(!splitDeferTakeResolveRequest(d));
  assert(splitDeferTakeFlushRequest(d));                 // TAP_FLUSH bleibt unabhängig davon möglich
  // Kommt ein Drücken dazu, fordert die Runde HOLD_RESOLVE genau einmal an
  assert(splitDeferPush(d, 2, 2, true, 110));
  assert(splitDeferHasPress(d));
  assert(splitDeferTakeResolveRequest(d) && !splitDeferTakeResolveRequest(d));
  // Beide Anforderungen sind getrennt: HOLD_RESOLVE verbraucht TAP_FLUSH nicht
  splitDeferReset(d);
  assert(splitDeferPush(d, 3, 3, true, 200));
  assert(splitDeferTakeResolveRequest(d));
  assert(splitDeferTakeFlushRequest(d));
  // Eine neue Runde setzt beide zurück
  SplitDeferredKey k;
  while (splitDeferPop(d, k)) {}
  assert(splitDeferPush(d, 4, 4, true, 300));
  assert(splitDeferTakeResolveRequest(d) && splitDeferTakeFlushRequest(d));
  // Nach einem Fehlschlag beim Senden fordert die nächste Runde HOLD_RESOLVE erneut an
  splitDeferRequestResolveAgain(d);
  assert(splitDeferTakeResolveRequest(d));
  // Ohne zurückgehaltene Änderung gibt es nichts anzufordern
  while (splitDeferPop(d, k)) {}
  assert(!splitDeferTakeResolveRequest(d));

  // Hold-Tap-Modi: HOLD_MODE_TAP_PREFERRED fordert HOLD_RESOLVE nie an
  splitDeferReset(d);
  assert(splitDeferPush(d, 2, 2, true, 400));
  assert(splitDeferPush(d, 2, 2, false, 420));
  assert(!splitDeferTakeResolveRequest(d, HOLD_MODE_TAP_PREFERRED));

  // HOLD_MODE_PERMISSIVE: nur Drücken reicht noch nicht
  splitDeferReset(d);
  assert(splitDeferPush(d, 2, 2, true, 500));
  assert(!splitDeferTakeResolveRequest(d, HOLD_MODE_PERMISSIVE));
  // Erst nach dem Loslassen der gleichen Taste liegt ein verschachteltes Paar vor
  assert(splitDeferPush(d, 2, 2, false, 520));
  assert(splitDeferTakeResolveRequest(d, HOLD_MODE_PERMISSIVE));
  assert(!splitDeferTakeResolveRequest(d, HOLD_MODE_PERMISSIVE));
}

TEST(test_left_hold_pending_does_not_hold_master_keys_behind_a_left_press) {
  // Master-Taste X wurde zuerst gedrückt und zurückgehalten, weil links eine Mod-Tap-Taste offen ist. Ein späterer linker
  // Druck Y ist ein anderer Druck als der Tipp von TAP_PENDING: X läuft zuerst (Reihenfolge der Anschläge).
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  rxOrder.clear();
  splitDeferReset(rxDefer);
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HOLD_PENDING, 1));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, rxAppliedCode);
  splitDeferApplyOrHold(rxDefer, 2, 2, true, splitLeftHolds(k.splitLeft, 105), 105, rxDeferApply);
  assert(rxDefer.count == 1);
  // Der Master-Weg (onSplitBeforeLeftPress) übergibt nur das Merkmal "wartender linker Tipp"
  splitBeforeLeftPress(rxDefer, splitLeftTapPending(k.splitLeft, 110), rxDeferApply, [] {});
  assert((rxOrder == std::vector<std::string>{"local-d22"}) && rxDefer.count == 0);
  // Wartet dagegen ein linker Tipp (TAP_PENDING), bleibt X hinter ihm zurück
  rxOrder.clear();
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_TAP_PENDING, 1));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 120, rxAppliedCode);
  splitDeferApplyOrHold(rxDefer, 3, 3, true, splitLeftHolds(k.splitLeft, 125), 125, rxDeferApply);
  splitBeforeLeftPress(rxDefer, splitLeftTapPending(k.splitLeft, 126), rxDeferApply, [] {});
  assert(rxOrder.empty() && rxDefer.count == 1);
}

TEST(test_layer_and_hold_zero_are_sent_together_the_zero_waits_for_the_layer) {
  SplitLayerSync layer;
  splitLayerReset(layer);
  SplitHoldReporter rep = {};
  std::vector<std::string> sent;
  bool layerOk = true;
  uint8_t mo = 0;
  auto sendLayer = [&] {
    splitLayerSendIfDue(layer, mo, 0, true, 1000, true, [&](const SplitHidEvent &ev) {
      if (!layerOk) return false;
      sent.push_back("layer" + std::to_string(splitLayerMomentary(ev)));
      return true;
    });
  };
  auto sendHold = [&](const SplitHidEvent &ev) { sent.push_back("hold" + std::to_string(ev.code)); return true; };
  // Eine offene Mod-Tap-Taste: die 1 geht sofort raus (sie braucht keine Ebene)
  splitSendLayerThenHold(layer, rep, true, true, mo, 0, sendLayer, sendHold);
  assert(sent.back() == "hold1");
  // Entschieden: MO_1 gilt. Geht das Layer-Paket nicht raus, geht auch die 0 nicht raus
  sent.clear();
  mo = 0x02;
  layerOk = false;
  splitSendLayerThenHold(layer, rep, true, false, mo, 0, sendLayer, sendHold);
  assert(sent.empty() && rep.reported);                   // die 1 gilt weiter als gemeldet, die 0 wartet
  // Nächster Durchlauf, das Senden gelingt: erst die Ebene, dann die 0
  layerOk = true;
  splitSendLayerThenHold(layer, rep, true, false, mo, 0, sendLayer, sendHold);
  assert((sent == std::vector<std::string>{"layer2", "hold0"}) && !rep.reported);
  // Ohne Änderung der Ebene (Entscheidung ohne Layer-Taste) geht die 0 sofort
  sent.clear();
  splitSendLayerThenHold(layer, rep, true, true, mo, 0, sendLayer, sendHold);
  sent.clear();
  splitSendLayerThenHold(layer, rep, true, false, mo, 0, sendLayer, sendHold);
  assert((sent == std::vector<std::string>{"hold0"}));
}

TEST(test_layer_in_sync_tracks_the_last_sent_state) {
  SplitLayerSync layer;
  splitLayerReset(layer);
  assert(!splitLayerInSync(layer, 0, 0));                 // nichts gesendet
  splitLayerSendIfDue(layer, 0x02, 0x08, true, 1000, true, [](const SplitHidEvent &) { return true; });
  assert(splitLayerInSync(layer, 0x02, 0x08));
  assert(splitLayerInSync(layer, 0x02, 0x09));            // Bit 0 (Ebene 0) rastet nie ein und zählt nicht
  assert(!splitLayerInSync(layer, 0x04, 0x08));
  assert(!splitLayerInSync(layer, 0x02, 0x00));
  // Ein gescheiterter Versand ändert den gesendeten Stand nicht
  splitLayerSendIfDue(layer, 0x04, 0x08, true, 2000, true, [](const SplitHidEvent &) { return false; });
  assert(!splitLayerInSync(layer, 0x04, 0x08) && splitLayerInSync(layer, 0x02, 0x08));
}

TEST(test_master_hold_zero_seen_means_the_layer_is_already_in_the_mailbox) {
  // Reihenfolge am Master -> links: Layer-Paket (Briefkasten), dann HOLD_PENDING 0 (Stand). Der Empfangs-Callback legt
  // beide in dieser Reihenfolge ab. Wer die 0 sieht, findet die Ebene im Briefkasten: die linke Schleife liest den Stand
  // vor dem Übernehmen der Ebene (leftReplayHeld) und läuft deshalb nie mit der 0 und der alten Ebene.
  SplitLayerMailbox box = {};
  uint32_t seen = 0;
  bool holdPending = true;
  // Callback 1: Layer-Paket, Callback 2: HOLD_PENDING 0
  splitLayerMailboxPut(box, makeSplitMasterLayerEvent(0x02, 0, 0));
  holdPending = false;
  // loop(): erst den Stand lesen, dann die Ebene nehmen
  bool zeroSeen = !holdPending;
  SplitHidEvent ev;
  bool took = splitLayerMailboxTake(box, seen, ev);
  assert(zeroSeen && took && splitLayerMomentary(ev) == 0x02);
  assert(!splitLayerMailboxTake(box, seen, ev));          // ein zweites Lesen ohne neues Paket liefert nichts
}

// -----------------------------------------------------------------------------
// Mod-Tap über beide Hälften: Befunde aus Zyklus 2 (Loslassen vor der Entscheidung)
// -----------------------------------------------------------------------------
TEST(test_held_release_runs_before_the_decision_so_a_released_mod_tap_key_stays_a_tap) {
  SplitLocalDefer d;
  splitDeferReset(d);
  deferLog.clear();
  // Die Hälfte hält: Loslassen der Mod-Tap-Taste (1,1) und danach ein Drücken (2,2)
  assert(splitDeferPush(d, 1, 1, false, 100));
  assert(splitDeferPush(d, 2, 2, true, 110));
  splitDeferReplayReleasesThenResolve(d, deferApply, [] { deferLog.push_back("resolve"); });
  // Das Loslassen lief vor der Entscheidung; das Drücken bleibt für den Aufrufer (es läuft danach, mit der neuen Ebene)
  assert((deferLog == std::vector<std::string>{"u11", "resolve"}) && d.count == 1);
  SplitDeferredKey k;
  assert(splitDeferPop(d, k) && k.pressed && k.r == 2 && k.c == 2);
}

TEST(test_resolve_without_any_held_release_runs_immediately_and_keeps_the_presses) {
  SplitLocalDefer d;
  splitDeferReset(d);
  deferLog.clear();
  // Leerer Puffer: nur entscheiden
  splitDeferReplayReleasesThenResolve(d, deferApply, [] { deferLog.push_back("resolve"); });
  assert((deferLog == std::vector<std::string>{"resolve"}) && d.count == 0);
  // Drücken zuerst: nichts davor, die Reihenfolge der Drücken und Loslassen danach bleibt
  deferLog.clear();
  assert(splitDeferPush(d, 3, 3, true, 200));
  assert(splitDeferPush(d, 4, 4, false, 210));
  splitDeferReplayReleasesThenResolve(d, deferApply, [] { deferLog.push_back("resolve"); });
  assert((deferLog == std::vector<std::string>{"resolve"}) && d.count == 2);
  SplitDeferredKey k;
  assert(splitDeferPop(d, k) && k.pressed && k.r == 3);
  assert(splitDeferPop(d, k) && !k.pressed && k.r == 4);
}

TEST(test_several_held_releases_before_the_first_press_all_run_in_order) {
  SplitLocalDefer d;
  splitDeferReset(d);
  deferLog.clear();
  assert(splitDeferPush(d, 1, 1, false, 100));
  assert(splitDeferPush(d, 1, 2, false, 105));
  assert(splitDeferPush(d, 2, 2, true, 110));
  assert(splitDeferPush(d, 1, 3, false, 115));            // nach dem Drücken: bleibt zurück
  splitDeferReplayReleasesThenResolve(d, deferApply, [] { deferLog.push_back("resolve"); });
  assert((deferLog == std::vector<std::string>{"u11", "u12", "resolve"}) && d.count == 2);
  // Die Scan-Zeit jeder ausgeführten Änderung bleibt erhalten
  assert(deferTimes.size() >= 2 && deferTimes[deferTimes.size() - 2] == 100 && deferTimes.back() == 105);
}

TEST(test_mouse_move_reaches_sink_without_state_and_is_not_retried) {
  Kbd k;
  left(k, SPLIT_OP_MOUSE_MOVE, 0xFE, 3);  // x = 3, y = -2
  assert((k.log == Log{"MM3,-2"}));
  assert(!splitSetAny(k.splitLeft.set));
  assert(!splitEventRetryable(makeSplitHidEvent(SPLIT_OP_MOUSE_MOVE, 1, 1)));
  assert(!splitIsPressOp(SPLIT_OP_MOUSE_MOVE));
}

// --- Tasten-Überschreibungen (DactylKeyOverride.h): Modifier + Taste ergibt eine andere Taste ---
static KeyOverride ovrTable[MAX_KEY_OVERRIDES];
static uint8_t ovrCount = 0;

static void ovrSetup(Kbd &k, std::initializer_list<KeyOverride> entries) {
  ovrCount = 0;
  for (const KeyOverride &o : entries) ovrTable[ovrCount++] = o;
  k.setKeyOverrides(ovrTable, &ovrCount);
}

TEST(test_override_shift_backspace_sends_delete_without_shift) {
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}});
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.log.clear();
  k.press((uint8_t)KEY_BACKSPACE);
  // Shift wird gelöst, Delete gedrückt, alles in einem Report
  assert((k.log == Log{"BEGIN", "R129", "P" + std::to_string(KEY_DELETE), "END"}));
  k.log.clear();
  k.release((uint8_t)KEY_BACKSPACE);
  // Delete los, das noch gehaltene Shift kommt zurück
  assert((k.log == Log{"BEGIN", "R" + std::to_string(KEY_DELETE), "P129", "END"}));
}

TEST(test_override_backspace_alone_is_unchanged) {
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}});
  k.press((uint8_t)KEY_BACKSPACE);
  k.release((uint8_t)KEY_BACKSPACE);
  assert((k.log == Log{"P" + std::to_string(KEY_BACKSPACE), "R" + std::to_string(KEY_BACKSPACE)}));
}

TEST(test_override_other_key_with_shift_is_unchanged) {
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}});
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.log.clear();
  k.press((uint8_t)'a');
  assert((k.log == Log{"P97"}));
}

TEST(test_override_right_shift_counts_and_is_restored) {
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}});
  k.press((uint8_t)KEY_RIGHT_SHIFT);
  k.log.clear();
  k.press((uint8_t)KEY_BACKSPACE);
  assert((k.log == Log{"BEGIN", "R133", "P" + std::to_string(KEY_DELETE), "END"}));
  k.log.clear();
  k.release((uint8_t)KEY_BACKSPACE);
  assert((k.log == Log{"BEGIN", "R" + std::to_string(KEY_DELETE), "P133", "END"}));
}

TEST(test_override_shift_released_before_key_is_not_restored) {
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}});
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.press((uint8_t)KEY_BACKSPACE);
  k.release((uint8_t)KEY_LEFT_SHIFT);
  k.log.clear();
  k.release((uint8_t)KEY_BACKSPACE);
  // Shift ist schon los: nur Delete löst, kein hängendes Shift
  assert((k.log == Log{"BEGIN", "R" + std::to_string(KEY_DELETE), "END"}));
}

TEST(test_override_ignores_modifier_not_required) {
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}});
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.press((uint8_t)KEY_LEFT_CTRL);
  k.log.clear();
  k.press((uint8_t)KEY_BACKSPACE);
  // Nur die geforderte Klasse (Shift) wird gelöst, Ctrl bleibt im Report
  assert((k.log == Log{"BEGIN", "R129", "P" + std::to_string(KEY_DELETE), "END"}));
}

TEST(test_override_most_specific_entry_wins) {
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, 'a', 'b'}, {KEY_OVERRIDE_MOD_SHIFT | KEY_OVERRIDE_MOD_CTRL, 'a', 'c'}});
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.press((uint8_t)KEY_LEFT_CTRL);
  k.log.clear();
  k.press((uint8_t)'a');
  assert((k.log == Log{"BEGIN", "R128", "R129", "P99", "END"}));
}

TEST(test_override_works_across_halves) {
  // Shift links, Backspace rechts
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}});
  left(k, SPLIT_OP_KEY_PRESS, KEY_LEFT_SHIFT);
  k.log.clear();
  k.press((uint8_t)KEY_BACKSPACE);
  assert((k.log == Log{"BEGIN", "R129", "P" + std::to_string(KEY_DELETE), "END"}));
  k.release((uint8_t)KEY_BACKSPACE);
  assert(k.log.back() == "END");
  // Shift rechts, Backspace links
  Kbd k2;
  ovrSetup(k2, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}});
  k2.press((uint8_t)KEY_RIGHT_SHIFT);
  k2.log.clear();
  left(k2, SPLIT_OP_KEY_PRESS, KEY_BACKSPACE);
  assert((k2.log == Log{"BEGIN", "R133", "P" + std::to_string(KEY_DELETE), "END"}));
  k2.log.clear();
  left(k2, SPLIT_OP_KEY_RELEASE, KEY_BACKSPACE);
  assert((k2.log == Log{"BEGIN", "R" + std::to_string(KEY_DELETE), "P133", "END"}));
}

TEST(test_override_left_key_survives_right_release_all) {
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}});
  k.press((uint8_t)KEY_RIGHT_SHIFT);
  left(k, SPLIT_OP_KEY_PRESS, KEY_BACKSPACE);
  k.log.clear();
  k.releaseAll();
  // Die linke Taste bleibt als Ersatztaste gedrückt, ohne das gelöste Shift
  assert(k.log.size() >= 3 && k.log.front() == "BEGIN" && k.log.back() == "END");
  bool pressedDelete = false, pressedBackspace = false;
  for (const std::string &e : k.log) {
    if (e == "P" + std::to_string(KEY_DELETE)) pressedDelete = true;
    if (e == "P" + std::to_string(KEY_BACKSPACE)) pressedBackspace = true;
  }
  assert(pressedDelete && !pressedBackspace);
}

TEST(test_override_host_loss_clears_state) {
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}});
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.press((uint8_t)KEY_BACKSPACE);
  k.splitResetForHostLoss();
  k.log.clear();
  // Nach dem Neustart des Zustands wirkt ein Loslassen nicht mehr als Überschreibung
  k.release((uint8_t)KEY_BACKSPACE);
  assert((k.log == Log{"R" + std::to_string(KEY_BACKSPACE)}));
}

TEST(test_override_without_table_changes_nothing) {
  Kbd k;
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.log.clear();
  k.press((uint8_t)KEY_BACKSPACE);
  assert((k.log == Log{"P" + std::to_string(KEY_BACKSPACE)}));
}

TEST(test_override_replacement_held_by_both_halves_releases_last) {
  // Beide Hälften drücken Backspace mit Shift: beide senden Delete. Das erste Loslassen hält Delete.
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}});
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.press((uint8_t)KEY_BACKSPACE);
  left(k, SPLIT_OP_KEY_PRESS, KEY_BACKSPACE);
  k.log.clear();
  left(k, SPLIT_OP_KEY_RELEASE, KEY_BACKSPACE);
  const std::string del = "R" + std::to_string(KEY_DELETE);
  for (const std::string &e : k.log) assert(e != del);
  k.log.clear();
  k.release((uint8_t)KEY_BACKSPACE);
  bool released = false;
  for (const std::string &e : k.log) if (e == del) released = true;
  assert(released);
}

TEST(test_override_replacement_also_typed_by_other_half_stays_held) {
  // Links hält Delete selbst, rechts erzeugt Shift+Backspace dasselbe Delete: das Loslassen rechts löst es nicht
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}});
  left(k, SPLIT_OP_KEY_PRESS, KEY_DELETE);
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.press((uint8_t)KEY_BACKSPACE);
  k.log.clear();
  k.release((uint8_t)KEY_BACKSPACE);
  for (const std::string &e : k.log) assert(e != "R" + std::to_string(KEY_DELETE));
}

TEST(test_override_shifted_replacement_gives_shift_back) {
  // Das Loslassen von 'A' löscht im Report das Shift-Bit: das gehaltene Shift kommt zurück
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, 'A'}});
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.press((uint8_t)KEY_BACKSPACE);
  k.log.clear();
  k.release((uint8_t)KEY_BACKSPACE);
  assert((k.log == Log{"BEGIN", "R65", "P129", "END"}));
}

TEST(test_override_link_timeout_releases_left_override) {
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}});
  k.press((uint8_t)KEY_RIGHT_SHIFT);
  left(k, SPLIT_OP_KEY_PRESS, KEY_BACKSPACE, 0, 1000);
  k.log.clear();
  assert(splitCheckLinkTimeout(k.splitLeft, 1000 + SPLIT_LINK_TIMEOUT_MS, k));
  bool released = false;
  for (const std::string &e : k.log) if (e == "R" + std::to_string(KEY_DELETE)) released = true;
  assert(released);
  // Danach wirkt kein Zustand mehr nach: dieselbe Taste tippt wieder normal
  k.log.clear();
  left(k, SPLIT_OP_HEARTBEAT, 0, 0, 2000 + SPLIT_LINK_TIMEOUT_MS);
  left(k, SPLIT_OP_KEY_WRITE, 'a', 0, 2000 + SPLIT_LINK_TIMEOUT_MS);
  bool typedA = false;
  for (const std::string &e : k.log) if (e == "P97") typedA = true;
  assert(typedA);
}

TEST(test_override_applies_one_shot_to_the_replacement) {
  // Ein vorgemerktes One-Shot-Ctrl gilt für die gesendete Ersatztaste und ist danach verbraucht
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}});
  k.oneShotPress(OS_CTRL);
  k.oneShotRelease(OS_CTRL);
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.log.clear();
  k.press((uint8_t)KEY_BACKSPACE);
  assert((k.log == Log{"BEGIN", "P128", "R129", "P" + std::to_string(KEY_DELETE), "END", "BEGIN", "R128", "END"}));
  // Verbraucht: der nächste Druck bekommt kein Ctrl mehr
  k.release((uint8_t)KEY_BACKSPACE);
  k.log.clear();
  k.press((uint8_t)'a');
  assert((k.log == Log{"P97"}));
}

TEST(test_override_shifted_replacement_keeps_shift_for_shifted_char_of_other_half) {
  // Links hält '!' (implizites Shift). Das Loslassen der Ersatztaste 'A' löscht das Shift-Bit: es kommt zurück.
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_CTRL, KEY_BACKSPACE, 'A'}});
  left(k, SPLIT_OP_KEY_PRESS, '!');
  k.press((uint8_t)KEY_LEFT_CTRL);
  k.press((uint8_t)KEY_BACKSPACE);
  k.log.clear();
  k.release((uint8_t)KEY_BACKSPACE);
  bool shiftBack = false;
  for (const std::string &e : k.log) if (e == "P129") shiftBack = true;
  assert(shiftBack);
}

TEST(test_override_second_press_without_release_leaves_nothing_stuck) {
  // Doppelter Druck derselben Taste (verlorenes Loslassen): die alte Ersatztaste wird gelöst
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}});
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.press((uint8_t)KEY_BACKSPACE);
  k.press((uint8_t)KEY_BACKSPACE);
  k.release((uint8_t)KEY_BACKSPACE);
  int pressed = 0, released = 0;
  const std::string del = std::to_string(KEY_DELETE);
  for (const std::string &e : k.log) {
    if (e == "P" + del) pressed++;
    if (e == "R" + del) released++;
  }
  assert(pressed == 2 && released == 2);
}

TEST(test_override_plain_key_held_then_override_does_not_stick) {
  // Backspace läuft ohne Shift, dann folgt Shift und ein erneuter Druck: die schon gedrückte Taste wird gelöst
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}});
  k.press((uint8_t)KEY_BACKSPACE);
  k.press((uint8_t)KEY_LEFT_SHIFT);
  k.log.clear();
  k.press((uint8_t)KEY_BACKSPACE);
  bool plainReleased = false;
  for (const std::string &e : k.log) if (e == "R" + std::to_string(KEY_BACKSPACE)) plainReleased = true;
  assert(plainReleased);
}

TEST(test_override_two_overrides_restore_shared_modifier_after_the_last_release) {
  Kbd k;
  ovrSetup(k, {{KEY_OVERRIDE_MOD_SHIFT, KEY_BACKSPACE, KEY_DELETE}, {KEY_OVERRIDE_MOD_SHIFT, 'a', 'b'}});
  for (int order = 0; order < 2; order++) {
    k.press((uint8_t)KEY_LEFT_SHIFT);
    k.press((uint8_t)KEY_BACKSPACE);
    k.press((uint8_t)'a');
    k.log.clear();
    k.release((uint8_t)(order ? 'a' : KEY_BACKSPACE));
    for (const std::string &e : k.log) assert(e != "P129");  // noch eine Überschreibung aktiv: Shift bleibt gelöst
    k.log.clear();
    k.release((uint8_t)(order ? KEY_BACKSPACE : 'a'));
    int back = 0;
    for (const std::string &e : k.log) if (e == "P129") back++;
    assert(back == 1);                                      // nach der letzten kommt Shift genau einmal zurück
    k.release((uint8_t)KEY_LEFT_SHIFT);
    k.log.clear();
  }
}

TEST(test_override_validation) {
  assert(keyOverrideValid(2, KEY_BACKSPACE, KEY_DELETE));
  assert(!keyOverrideValid(0, 'a', 'b'));
  assert(!keyOverrideValid(16, 'a', 'b'));
  assert(!keyOverrideValid(2, 0, 'b'));
  assert(!keyOverrideValid(2, 'a', 0));
  assert(!keyOverrideValid(2, 256, 'b'));
  assert(!keyOverrideValid(2, KEY_LEFT_SHIFT, 'b'));  // Modifier als Taste
  assert(!keyOverrideValid(2, 'a', KEY_LEFT_CTRL));   // Modifier als Ersatz
  assert(keyOverrideClassOfCode(KEY_LEFT_SHIFT) == KEY_OVERRIDE_MOD_SHIFT);
  assert(keyOverrideClassOfCode(KEY_RIGHT_SHIFT) == KEY_OVERRIDE_MOD_SHIFT);
  assert(keyOverrideClassOfCode(KEY_RIGHT_GUI) == KEY_OVERRIDE_MOD_GUI);
  assert(keyOverrideClassOfCode('a') == 0);
}

TEST(test_espnow_wake_window_constants_and_logic) {
  assert(SPLIT_ESPNOW_WAKE_INTERVAL_MS == 100);
  assert(SPLIT_ESPNOW_WAKE_WINDOW_ACTIVE_MS == 100);
  assert(SPLIT_ESPNOW_WAKE_WINDOW_STANDBY_MS == 40);

  assert(splitEspNowWakeWindowMs(false) == 100);
  assert(splitEspNowWakeWindowMs(true) == 40);

  SplitWakeWindowState state;
  splitWakeWindowReset(state);
  assert(!state.initialized);
  assert(state.appliedWindowMs == 0);

  int applyCalls = 0;
  uint16_t lastApplied = 0;
  auto mockApply = [&](uint16_t w) {
    applyCalls++;
    lastApplied = w;
    return true;
  };

  // Nicht bereit: keine Ausführung
  assert(!splitWakeWindowUpdateIfNeeded(state, false, false, mockApply));
  assert(applyCalls == 0);

  // Initialisieren mit active (standby = false)
  assert(splitWakeWindowUpdateIfNeeded(state, true, false, mockApply));
  assert(applyCalls == 1);
  assert(lastApplied == 100);
  assert(state.initialized);
  assert(state.appliedWindowMs == 100);

  // Gleicher Zustand: kein zweiter Aufruf
  assert(!splitWakeWindowUpdateIfNeeded(state, true, false, mockApply));
  assert(applyCalls == 1);

  // Wechsel in Standby (standby = true)
  assert(splitWakeWindowUpdateIfNeeded(state, true, true, mockApply));
  assert(applyCalls == 2);
  assert(lastApplied == 40);
  assert(state.appliedWindowMs == 40);

  // Fehlgeschlagene Zuweisung setzt Zustand nicht
  auto failApply = [](uint16_t) { return false; };
  assert(!splitWakeWindowUpdateIfNeeded(state, true, false, failApply));
  assert(state.appliedWindowMs == 40);

  // Nach Reset: erneuter Aufruf ausgeführt
  splitWakeWindowReset(state);
  assert(splitWakeWindowUpdateIfNeeded(state, true, true, mockApply));
  assert(applyCalls == 3);
  assert(lastApplied == 40);
}

// -----------------------------------------------------------------------------
// One-Shot-Ebenen (SPLIT_OP_OSL)
// -----------------------------------------------------------------------------
TEST(test_osl_packet_round_trip_and_validation) {
  SplitHidEvent out;
  SplitHidEvent ev = makeSplitOslEvent(0x04, 0x02);
  assert(ev.op == SPLIT_OP_OSL && ev.arg == 0);
  assert(splitOslArmed(ev) == 0x04 && splitOslUsed(ev) == 0x02);
  assert(parse(SPLIT_LEFT_MAC, ev, out) && out.code == ev.code);
  // Ein Wert in arg ist ungültig
  assert(!parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_OSL, 1, 1), out));
  // Der Master darf OSL an die linke Hälfte senden, ein fremder Absender nicht
  assert(parseSplitMasterPacket(SPLIT_MASTER_MAC, reinterpret_cast<const uint8_t *>(&ev), 4, out) && out.op == SPLIT_OP_OSL);
  uint8_t other[6] = {1, 2, 3, 4, 5, 6};
  assert(!parseSplitMasterPacket(other, reinterpret_cast<const uint8_t *>(&ev), 4, out));
  assert(!parse(other, ev, out));
}

// -----------------------------------------------------------------------------
// Mauspräzision (SPLIT_OP_MOUSE_SPEED)
// -----------------------------------------------------------------------------
TEST(test_mouse_speed_packet_round_trip_and_validation) {
  SplitHidEvent out;
  for (uint8_t mask = 0; mask <= 3; mask++) {
    SplitHidEvent ev = makeSplitMouseSpeedEvent(mask);
    assert(ev.op == SPLIT_OP_MOUSE_SPEED && ev.arg == 0 && ev.code == mask);
    assert(parse(SPLIT_LEFT_MAC, ev, out) && out.code == mask);
    assert(parseSplitMasterPacket(SPLIT_MASTER_MAC, reinterpret_cast<const uint8_t *>(&ev), 4, out) && out.op == SPLIT_OP_MOUSE_SPEED);
  }
  // Bits über 1, ein Wert in arg und fremde Absender sind ungültig
  SplitHidEvent bad = makeSplitHidEvent(SPLIT_OP_MOUSE_SPEED, 4, 0);
  assert(!parse(SPLIT_LEFT_MAC, bad, out));
  assert(!parseSplitMasterPacket(SPLIT_MASTER_MAC, reinterpret_cast<const uint8_t *>(&bad), 4, out));
  assert(!parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_MOUSE_SPEED, 1, 1), out));
  SplitHidEvent ok = makeSplitMouseSpeedEvent(1);
  uint8_t other[6] = {1, 2, 3, 4, 5, 6};
  assert(!parseSplitMasterPacket(other, reinterpret_cast<const uint8_t *>(&ok), 4, out));
  assert(!splitIsPressOp(SPLIT_OP_MOUSE_SPEED) && splitEventRetryable(ok));
}

TEST(test_mouse_speed_sync_sends_on_change_and_refreshes_while_held) {
  SplitMouseSpeedSync s;
  splitMouseSpeedReset(s);
  int sent = 0;
  SplitHidEvent last = {};
  auto send = [&](const SplitHidEvent &ev) { sent++; last = ev; return true; };
  assert(!splitMouseSpeedSendIfDue(s, 0, 1000, true, send) && sent == 0);
  assert(splitMouseSpeedSendIfDue(s, 1, 1000, true, send) && sent == 1 && last.code == 1);
  // Zweite Kopie nach SPLIT_LAYER_REPEAT_MS, danach nur das Auffrischen
  assert(!splitMouseSpeedSendIfDue(s, 1, 1000 + SPLIT_LAYER_REPEAT_MS - 1, true, send));
  assert(splitMouseSpeedSendIfDue(s, 1, 1000 + SPLIT_LAYER_REPEAT_MS, true, send) && sent == 2);
  sent = 1;
  assert(!splitMouseSpeedSendIfDue(s, 1, 1500, true, send));
  assert(splitMouseSpeedSendIfDue(s, 1, 1000 + SPLIT_LAYER_REPEAT_MS + SPLIT_LAYER_REFRESH_MS, true, send) && sent == 2);
  assert(!splitMouseSpeedSendIfDue(s, 1, 5000, false, send) && sent == 2);   // Link weg: kein Auffrischen
  assert(splitMouseSpeedSendIfDue(s, 0, 5001, true, send) && sent == 3 && last.code == 0);
  // Auch das Loslassen bekommt eine zweite Kopie
  assert(splitMouseSpeedSendIfDue(s, 0, 5001 + SPLIT_LAYER_REPEAT_MS, true, send) && sent == 4 && last.code == 0);
  assert(!splitMouseSpeedSendIfDue(s, 0, 9000, true, send));
  sent = 3;
  // Fehlschlag: der nächste Aufruf sendet neu
  assert(!splitMouseSpeedSendIfDue(s, 2, 9001, true, [](const SplitHidEvent &) { return false; }));
  assert(splitMouseSpeedSendIfDue(s, 2, 9002, true, send) && sent == 4 && last.code == 2);
}

static int speedCalls = 0;
static SplitHidEvent speedLast = {};
static void recordSpeed(const SplitHidEvent &ev) { speedCalls++; speedLast = ev; }

TEST(test_process_rx_hands_over_mouse_speed_without_hid_effect_and_clears_on_link_loss) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  speedCalls = 0;
  splitRxPush(rxq, makeSplitMouseSpeedEvent(1));
  splitRxPush(rxq, makeSplitMouseSpeedEvent(2));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, false, 100, nullptr, nullptr, nullptr, nullptr,
                                     nullptr, nullptr, SPLIT_LINK_TIMEOUT_MS, nullptr, recordSpeed);
  assert(speedCalls == 1 && speedLast.code == 2);
  assert(rep.applied == 0 && rep.keyEvents == 0 && k.log.empty());
  // Ausfall des Links: das Tempo der linken Hälfte wird gelöscht
  speedCalls = 0;
  rep = splitProcessRx(k, rxq, droppedSeen, hostWas, false, 100 + SPLIT_LINK_TIMEOUT_MS + 1, nullptr, nullptr, nullptr,
                       nullptr, nullptr, nullptr, SPLIT_LINK_TIMEOUT_MS, nullptr, recordSpeed);
  assert(rep.linkLost && speedCalls == 1 && speedLast.code == 0);
  // RELEASE_ALL der linken Hälfte löscht das Spiegelbild; ein älteres Paket derselben Runde hebt das Löschen nicht auf
  speedCalls = 0;
  speedLast = makeSplitMouseSpeedEvent(3);
  splitRxPush(rxq, makeSplitMouseSpeedEvent(1));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_RELEASE_ALL));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 20000, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
                 SPLIT_LINK_TIMEOUT_MS, nullptr, recordSpeed);
  assert(speedCalls == 1 && speedLast.code == 0);
  // Host-Verlust
  speedCalls = 0;
  speedLast = makeSplitMouseSpeedEvent(3);
  rep = splitProcessRx(k, rxq, droppedSeen, hostWas, false, 20100, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
                       SPLIT_LINK_TIMEOUT_MS, nullptr, recordSpeed);
  assert(rep.hostLost && speedCalls >= 1 && speedLast.code == 0);
  // Überlauf des Empfangsrings
  hostWas = true;
  speedCalls = 0;
  speedLast = makeSplitMouseSpeedEvent(3);
  for (int i = 0; i < SPLIT_RX_QUEUE_SIZE + 2; i++) splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 20200, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
                       SPLIT_LINK_TIMEOUT_MS, nullptr, recordSpeed);
  assert(rep.overflow && speedCalls >= 1 && speedLast.code == 0);
}

TEST(test_osl_is_no_hid_press_op_and_is_retried) {
  assert(!splitIsPressOp(SPLIT_OP_OSL));
  assert(splitEventRetryable(makeSplitOslEvent(1, 0)));
}

TEST(test_osl_send_only_on_change_and_while_armed) {
  SplitOslSync s;
  splitOslReset(s);
  int sent = 0;
  SplitHidEvent last = {};
  auto send = [&](const SplitHidEvent &ev) { sent++; last = ev; return true; };
  // Nichts vorgemerkt, nichts gesendet
  assert(!splitOslSendIfDue(s, 0, 0, 1000, true, send) && sent == 0);
  // Änderung: sofort
  assert(splitOslSendIfDue(s, 0x04, 0, 1000, true, send) && sent == 1 && splitOslArmed(last) == 0x04);
  // Unverändert: erst nach dem Auffrischen
  assert(!splitOslSendIfDue(s, 0x04, 0, 1500, true, send));
  assert(splitOslSendIfDue(s, 0x04, 0, 1000 + SPLIT_LAYER_REFRESH_MS, true, send) && sent == 2);
  // Ohne Link kein Auffrischen
  assert(!splitOslSendIfDue(s, 0x04, 0, 5000, false, send));
  // Zurücknehmen ist eine Änderung (Stand 0 geht raus)
  assert(splitOslSendIfDue(s, 0, 0, 5001, true, send) && sent == 3 && last.code == 0);
  assert(!splitOslSendIfDue(s, 0, 0, 9000, true, send));
  // Verbrauchte Vormerkung wiederholt schneller (verlorenes Paket)
  assert(splitOslSendIfDue(s, 0, 0x08, 9001, true, send) && splitOslUsed(last) == 0x08);
  assert(!splitOslSendIfDue(s, 0, 0x08, 9001 + SPLIT_OSL_USED_REPEAT_MS - 1, true, send));
  assert(splitOslSendIfDue(s, 0, 0x08, 9001 + SPLIT_OSL_USED_REPEAT_MS, true, send));
}

TEST(test_osl_failed_send_is_retried_next_round) {
  SplitOslSync s;
  splitOslReset(s);
  assert(!splitOslSendIfDue(s, 0x02, 0, 1000, true, [](const SplitHidEvent &) { return false; }));
  int sent = 0;
  assert(splitOslSendIfDue(s, 0x02, 0, 1001, true, [&](const SplitHidEvent &) { sent++; return true; }) && sent == 1);
}

static int oslCalls = 0;
static SplitHidEvent oslLast = {};
static void recordOsl(const SplitHidEvent &ev) { oslCalls++; oslLast = ev; }

TEST(test_process_rx_hands_over_osl_without_hid_effect_or_activity) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  oslCalls = 0;
  splitRxPush(rxq, makeSplitOslEvent(0x04, 0));
  splitRxPush(rxq, makeSplitOslEvent(0x08, 0));
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, false, 100, nullptr, nullptr, nullptr, nullptr,
                                     nullptr, nullptr, SPLIT_LINK_TIMEOUT_MS, recordOsl);
  // Auch ohne Host; nur das neueste Paket gilt, keine Aktivität, keine HID-Ausgabe
  assert(oslCalls == 1 && splitOslArmed(oslLast) == 0x08);
  assert(rep.applied == 0 && rep.keyEvents == 0 && k.log.empty());
  assert(k.splitLeft.linkUp && k.splitLeft.lastRxMs == 100);
}

TEST(test_process_rx_clears_osl_on_link_loss_host_loss_and_release_all) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  oslCalls = 0;
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a'));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
                 SPLIT_LINK_TIMEOUT_MS, recordOsl);
  assert(oslCalls == 0);
  // RELEASE_ALL der linken Hälfte löscht ihre Vormerkungen
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_RELEASE_ALL));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 200, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
                 SPLIT_LINK_TIMEOUT_MS, recordOsl);
  assert(oslCalls == 1 && oslLast.code == 0);
  // Link-Timeout: Spiegelbild fällt
  oslCalls = 0;
  SplitRxReport rep = splitProcessRx(k, rxq, droppedSeen, hostWas, true, 200 + SPLIT_LINK_TIMEOUT_MS, nullptr,
                                     nullptr, nullptr, nullptr, nullptr, nullptr, SPLIT_LINK_TIMEOUT_MS, recordOsl);
  assert(rep.linkLost && oslCalls == 1 && oslLast.code == 0);
  // Host-Verlust
  oslCalls = 0;
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 10000, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
                 SPLIT_LINK_TIMEOUT_MS, recordOsl);
  oslCalls = 0;
  rep = splitProcessRx(k, rxq, droppedSeen, hostWas, false, 10100, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
                       SPLIT_LINK_TIMEOUT_MS, recordOsl);
  assert(rep.hostLost && oslCalls >= 1 && oslLast.code == 0);
}

TEST(test_process_rx_release_all_after_osl_in_the_same_round_keeps_the_clear) {
  Kbd k;
  uint32_t droppedSeen = 0;
  bool hostWas = false;
  oslCalls = 0;
  oslLast = makeSplitOslEvent(0xFF, 0);
  splitRxPush(rxq, makeSplitOslEvent(0x04, 0));
  splitRxPush(rxq, makeSplitHidEvent(SPLIT_OP_RELEASE_ALL));
  splitProcessRx(k, rxq, droppedSeen, hostWas, true, 100, nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
                 SPLIT_LINK_TIMEOUT_MS, recordOsl);
  // Das letzte Ereignis an die Firmware ist das Löschen, nicht das ältere Paket mit Ebene 2
  assert(oslCalls == 1 && oslLast.code == 0);
}


// Dynamisches Makro: der Master nimmt die Tasten beider Hälften auf (DactylDynamicMacro.h)
TEST(test_dynamic_macro_records_both_halves) {
  Kbd k("Dactyl Keyboard", "Dactyl DIY", 100);
  k.dynMacro.startRecording();
  left(k, SPLIT_OP_KEY_PRESS, 'a');
  k.press((uint8_t)'b');
  left(k, SPLIT_OP_KEY_RELEASE, 'a');
  k.release((uint8_t)'b');
  const DynamicMacro &dm = k.dynMacro;
  assert(dm.length == 4);
  assert(dm.steps[0].type == MACRO_STEP_DOWN && dm.steps[0].code == 'a');
  assert(dm.steps[1].type == MACRO_STEP_DOWN && dm.steps[1].code == 'b');
  assert(dm.steps[2].type == MACRO_STEP_UP && dm.steps[2].code == 'a');
  assert(dm.steps[3].type == MACRO_STEP_UP && dm.steps[3].code == 'b');
}

TEST(test_dynamic_macro_same_code_on_both_halves_counts_once) {
  Kbd k("Dactyl Keyboard", "Dactyl DIY", 100);
  k.dynMacro.startRecording();
  left(k, SPLIT_OP_KEY_PRESS, 0x81);              // Shift links
  k.press((uint8_t)0x81);                         // Shift rechts
  left(k, SPLIT_OP_KEY_RELEASE, 0x81);            // rechts hält noch: kein UP
  assert(k.dynMacro.length == 1);
  k.release((uint8_t)0x81);                       // jetzt hält keine Hälfte mehr
  assert(k.dynMacro.length == 2 && k.dynMacro.steps[1].type == MACRO_STEP_UP);
}

TEST(test_dynamic_macro_ignores_keys_without_recording) {
  Kbd k("Dactyl Keyboard", "Dactyl DIY", 100);
  left(k, SPLIT_OP_KEY_PRESS, 'a');
  k.press((uint8_t)'b');
  assert(k.dynMacro.length == 0);
  // Eine Taste, die schon vor der Aufnahme gehalten wird, erzeugt kein UP
  k.dynMacro.startRecording();
  left(k, SPLIT_OP_KEY_RELEASE, 'a');
  k.release((uint8_t)'b');
  assert(k.dynMacro.length == 0);
}

TEST(test_dynamic_macro_left_write_and_host_loss) {
  Kbd k("Dactyl Keyboard", "Dactyl DIY", 100);
  k.dynMacro.startRecording();
  left(k, SPLIT_OP_KEY_WRITE, 'x');
  assert(k.dynMacro.length == 2);
  left(k, SPLIT_OP_KEY_PRESS, 'y');
  k.splitResetForHostLoss();                      // Mac weg: offene Tasten schließen, Aufnahme endet
  assert(!k.dynMacro.recording);
  assert(k.dynMacro.length == 4 && k.dynMacro.steps[3].type == MACRO_STEP_UP && k.dynMacro.steps[3].code == 'y');
}

TEST(test_dynamic_macro_release_all_keeps_left_held_key_open) {
  Kbd k("Dactyl Keyboard", "Dactyl DIY", 100);
  k.dynMacro.startRecording();
  left(k, SPLIT_OP_KEY_PRESS, 'l');
  k.press((uint8_t)'r');
  k.releaseAll();                                 // rechts los, links hält 'l' weiter
  assert(k.dynMacro.length == 3 && k.dynMacro.steps[2].code == 'r' && k.dynMacro.steps[2].type == MACRO_STEP_UP);
  left(k, SPLIT_OP_KEY_RELEASE, 'l');
  assert(k.dynMacro.length == 4 && k.dynMacro.steps[3].code == 'l');
}

// -----------------------------------------------------------------------------
// Key lock (SPLIT_OP_KEY_LOCK, DactylKeyLock.h)
// -----------------------------------------------------------------------------
TEST(test_key_lock_left_mouse_button_stays_held_and_second_press_releases) {
  Kbd k;
  left(k, SPLIT_OP_KEY_LOCK);
  left(k, SPLIT_OP_MOUSE_PRESS, 1, 1);
  left(k, SPLIT_OP_MOUSE_RELEASE, 1);
  assert((k.log == Log{"BP1"}));            // das Loslassen erreicht den Report nicht
  left(k, SPLIT_OP_MOUSE_PRESS, 1, 1);      // zweiter Druck löst
  assert((k.log == Log{"BP1", "BR1"}));
  left(k, SPLIT_OP_MOUSE_RELEASE, 1);
  assert((k.log == Log{"BP1", "BR1"}));
  left(k, SPLIT_OP_MOUSE_PRESS, 1, 1);      // wieder normal, nichts vorgemerkt
  left(k, SPLIT_OP_MOUSE_RELEASE, 1);
  assert((k.log == Log{"BP1", "BR1", "BP1", "BR1"}));
}

TEST(test_key_lock_right_arm_locks_left_key_and_right_key) {
  Kbd k;
  k.keyLockArm();
  left(k, SPLIT_OP_KEY_PRESS, 'a', 1);
  left(k, SPLIT_OP_KEY_RELEASE, 'a');
  assert((k.log == Log{"P97"}));
  k.pressLockable((uint8_t)'a');            // rechts: zweiter Druck löst
  assert((k.log == Log{"P97", "R97"}));
  k.release((uint8_t)'a');
  assert((k.log == Log{"P97", "R97"}));
  // rechts sperren, links lösen
  Kbd r;
  r.keyLockArm();
  r.pressLockable((uint8_t)'b');
  r.release((uint8_t)'b');
  assert((r.log == Log{"P98"}));
  left(r, SPLIT_OP_KEY_PRESS, 'b', 1);
  assert((r.log == Log{"P98", "R98"}));
  left(r, SPLIT_OP_KEY_RELEASE, 'b');
  assert((r.log == Log{"P98", "R98"}));
}

TEST(test_key_lock_press_without_lock_arg_is_not_locked) {
  Kbd k;
  left(k, SPLIT_OP_KEY_LOCK);
  left(k, SPLIT_OP_KEY_PRESS, 'a', 0);      // arg 0 = Makro oder Tastenpaar: nie gesperrt
  left(k, SPLIT_OP_KEY_RELEASE, 'a');
  assert((k.log == Log{"P97", "R97"}));
  left(k, SPLIT_OP_KEY_PRESS, 'b', 1);      // die Vormerkung gilt noch
  left(k, SPLIT_OP_KEY_RELEASE, 'b');
  assert((k.log == Log{"P97", "R97", "P98"}));
}

TEST(test_key_lock_is_released_after_link_timeout) {
  Kbd k;
  left(k, SPLIT_OP_KEY_LOCK, 0, 0, 100);
  left(k, SPLIT_OP_MOUSE_PRESS, 1, 1, 100);
  left(k, SPLIT_OP_MOUSE_RELEASE, 1, 0, 100);
  assert((k.log == Log{"BP1"}));
  bool lost = splitCheckLinkTimeout(k.splitLeft, 100 + SPLIT_LINK_TIMEOUT_MS + 1, k);
  assert(lost);
  assert((k.log == Log{"BP1", "BR1"}));      // der Link-Ausfall löst die gesperrte Taste
  // Danach wirkt die Taste wieder normal
  left(k, SPLIT_OP_MOUSE_PRESS, 1, 0, 5000);
  left(k, SPLIT_OP_MOUSE_RELEASE, 1, 0, 5000);
  assert((k.log == Log{"BP1", "BR1", "BP1", "BR1"}));
}

TEST(test_key_lock_is_released_after_link_timeout_keeping_other_half_input) {
  Kbd k;
  k.press((uint8_t)'q');                    // rechts gehalten
  left(k, SPLIT_OP_KEY_LOCK, 0, 0, 100);
  left(k, SPLIT_OP_KEY_PRESS, 'q', 1, 100);  // links derselbe Code: gesperrt
  left(k, SPLIT_OP_KEY_RELEASE, 'q', 0, 100);
  k.log.clear();
  splitCheckLinkTimeout(k.splitLeft, 100 + SPLIT_LINK_TIMEOUT_MS + 1, k);
  for (const std::string &l : k.log) assert(l != "R113");   // rechts hält 'q' noch
}

TEST(test_key_lock_release_all_of_left_releases_locked_inputs) {
  Kbd k;
  left(k, SPLIT_OP_KEY_LOCK);
  left(k, SPLIT_OP_KEY_PRESS, 'a', 1);
  left(k, SPLIT_OP_KEY_RELEASE, 'a');
  left(k, SPLIT_OP_RELEASE_ALL);
  assert((k.log == Log{"P97", "R97"}));
}

TEST(test_key_lock_host_loss_and_right_release_all_clear_locks) {
  Kbd k;
  k.keyLockArm();
  k.pressLockable((uint8_t)'a');
  k.release((uint8_t)'a');
  k.splitResetForHostLoss();
  assert((k.log == Log{"P97", "ALL"}));
  k.log.clear();
  k.press((uint8_t)'a');                    // nach dem Verlust ist nichts mehr gesperrt
  k.release((uint8_t)'a');
  assert((k.log == Log{"P97", "R97"}));
  Kbd r;
  r.keyLockArm();
  r.releaseAll();                           // auch die Vormerkung entfällt
  r.press((uint8_t)'a');
  r.release((uint8_t)'a');
  assert((r.log == Log{"ALL", "P97", "R97"}));
}

TEST(test_key_lock_release_all_by_standby_keeps_physically_held_input) {
  Kbd k;
  k.keyLockArm();
  k.pressLockable((uint8_t)'a');
  k.release((uint8_t)'a');                  // gesperrt
  k.press((uint8_t)'b');                    // physisch gehalten, nicht gesperrt
  k.keyLockReleaseAll();
  assert((k.log == Log{"P97", "P98", "R97"}));
}

TEST(test_key_lock_is_not_retried_and_lockable_ops_are_validated) {
  assert(splitEventRetryable(makeSplitHidEvent(SPLIT_OP_KEY_LOCK)));   // Vormerken ist idempotent
  SplitHidEvent out;
  assert(parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_KEY_LOCK), out));
  assert(!parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_KEY_LOCK, 0, 1), out));
  assert(!splitIsPressOp(SPLIT_OP_KEY_LOCK));
}

TEST(test_master_press_packet_accepts_only_master_without_args) {
  assert(SPLIT_OP_MASTER_PRESS == 29); // append-only: Nummer nie ändern
  SplitHidEvent out;
  assert(parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_MASTER_PRESS), out) && out.op == SPLIT_OP_MASTER_PRESS);
  assert(!parseMaster(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_MASTER_PRESS), out));
  assert(!parseMaster(nullptr, makeSplitHidEvent(SPLIT_OP_MASTER_PRESS), out));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_MASTER_PRESS), out, 3));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_MASTER_PRESS), out, 5));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_MASTER_PRESS, 1), out));
  assert(!parseMaster(SPLIT_MASTER_MAC, makeSplitHidEvent(SPLIT_OP_MASTER_PRESS, 0, 1), out));
  // Die linke Hälfte sendet kein MASTER_PRESS an den Master; es ist kein Druck-Op
  assert(!parse(SPLIT_LEFT_MAC, makeSplitHidEvent(SPLIT_OP_MASTER_PRESS), out));
  assert(!splitIsPressOp(SPLIT_OP_MASTER_PRESS));
}

int main() {
  std::cout << "==================================================" << std::endl;
  std::cout << "  Dactyl Split HID Protocol Test Suite" << std::endl;
  std::cout << "==================================================" << std::endl;

  std::cout << "\nRan " << testsRun << " tests. All " << testsPassed << " passed successfully!" << std::endl;
  return (testsRun == testsPassed) ? 0 : 1;
}

