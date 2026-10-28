#include <cassert>
#include <iostream>

// Die getestete Logik stammt unverändert aus firmware/dactyl_left/DactylLeftLogic.h.
#include "../dactyl_left/DactylLeftLogic.h"

static int testsRun = 0;
static int testsPassed = 0;

#define TEST(name) void name(); \
  struct Runner_##name { Runner_##name() { \
    testsRun++; \
    std::cout << "[ RUN      ] " << #name << std::endl; \
    resetLeftKeys(); \
    name(); \
    testsPassed++; \
    std::cout << "[       OK ] " << #name << std::endl; \
  } } instance_##name; \
  void name()

TEST(test_split_event_layout) {
  SplitHidEvent ev = makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 0x81, 0);
  const uint8_t *b = reinterpret_cast<const uint8_t *>(&ev);
  assert(sizeof(ev) == 4);
  assert(b[0] == SPLIT_OP_KEY_PRESS);
  assert(b[1] == 0);
  assert(b[2] == 0x81); // Little Endian: code low byte zuerst
  assert(b[3] == 0);
}

TEST(test_press_reported_after_debounce) {
  assert(!updateLeftKey(1, 2, true, 100));
  assert(!updateLeftKey(1, 2, true, 104));
  assert(updateLeftKey(1, 2, true, 105));
  assert(leftKeys[1][2].stable);
  // Gehaltene Taste meldet kein weiteres Ereignis
  assert(!updateLeftKey(1, 2, true, 200));
}

TEST(test_release_reported_after_debounce) {
  updateLeftKey(0, 0, true, 0);
  assert(updateLeftKey(0, 0, true, 5));
  assert(!updateLeftKey(0, 0, false, 10));
  assert(updateLeftKey(0, 0, false, 15));
  assert(!leftKeys[0][0].stable);
}

TEST(test_bounce_restarts_window) {
  assert(!updateLeftKey(3, 4, true, 0));
  assert(!updateLeftKey(3, 4, false, 2));
  assert(!updateLeftKey(3, 4, true, 3));
  assert(!updateLeftKey(3, 4, true, 7));
  assert(updateLeftKey(3, 4, true, 8));
}

TEST(test_short_glitch_is_ignored) {
  assert(!updateLeftKey(2, 2, true, 0));
  assert(!updateLeftKey(2, 2, false, 3));
  assert(!updateLeftKey(2, 2, false, 50));
  assert(!leftKeys[2][2].stable);
}

TEST(test_keys_are_independent) {
  updateLeftKey(0, 1, true, 0);
  updateLeftKey(0, 2, false, 0);
  assert(updateLeftKey(0, 1, true, 5));
  assert(!updateLeftKey(0, 2, false, 5));
  assert(!leftKeys[0][2].stable);
}

TEST(test_debounce_across_millis_wrap) {
  const unsigned long nearWrap = ~0UL - 2;
  assert(!updateLeftKey(4, 1, true, nearWrap));
  assert(!updateLeftKey(4, 1, true, nearWrap + 4)); // 4 ms vergangen, nach dem Überlauf
  assert(updateLeftKey(4, 1, true, nearWrap + 5));
}

TEST(test_debounce_uses_configured_time) {
  assert(!updateLeftKey(1, 1, true, 0, 20));
  assert(!updateLeftKey(1, 1, true, 19, 20));
  assert(updateLeftKey(1, 1, true, 20, 20));
}

TEST(test_out_of_range_is_rejected) {
  assert(!updateLeftKey(-1, 0, true, 0));
  assert(!updateLeftKey(LEFT_NUM_ROWS, 0, true, 10));
  assert(!updateLeftKey(0, LEFT_NUM_COLS, true, 10));
}

TEST(test_pins_are_safe_and_unique) {
  // Strapping-Pins, Onboard-LED (22) und Input-only-Pins (34..39, ohne Pull-up) sind ausgeschlossen
  const uint8_t forbidden[] = {0, 2, 5, 12, 15, 22, 34, 35, 36, 39};
  uint8_t all[LEFT_NUM_ROWS + LEFT_NUM_COLS];
  int n = 0;
  for (int r = 0; r < LEFT_NUM_ROWS; r++) all[n++] = LEFT_ROW_PINS[r];
  for (int c = 0; c < LEFT_NUM_COLS; c++) all[n++] = LEFT_COL_PINS[c];
  for (int i = 0; i < n; i++) {
    for (uint8_t f : forbidden) assert(all[i] != f);
    for (int j = i + 1; j < n; j++) assert(all[i] != all[j]);
  }
}

// Deep-Sleep-Wakeup läuft über Ext1 auf den Spalten: jede Spalte muss ein RTC-GPIO sein
TEST(test_columns_are_rtc_wakeup_capable) {
  for (int c = 0; c < LEFT_NUM_COLS; c++) assert(isRtcGpio(LEFT_COL_PINS[c]));
  assert(!isRtcGpio(23) && !isRtcGpio(19) && !isRtcGpio(18) && !isRtcGpio(17) && !isRtcGpio(16));
  assert(isRtcGpio(4) && isRtcGpio(32) && isRtcGpio(39));
}

// Lötbelegung links (Spalten auf RTC-Pins für den Deep-Sleep-Wakeup)
TEST(test_pin_mapping_matches_wiring) {
  // Zeilen: Gelb, Orange, Grün, Braun, Blau, Lila
  const uint8_t rows[LEFT_NUM_ROWS] = {23, 19, 18, 17, 16, 4};
  // Spalten: Lila, Braun, Grün, Orange, Gelb, Rot, Blau
  const uint8_t cols[LEFT_NUM_COLS] = {13, 14, 27, 26, 33, 32, 25};
  for (int r = 0; r < LEFT_NUM_ROWS; r++) assert(LEFT_ROW_PINS[r] == rows[r]);
  for (int c = 0; c < LEFT_NUM_COLS; c++) assert(LEFT_COL_PINS[c] == cols[c]);
}

TEST(test_master_mac) {
  const uint8_t expected[6] = {0x2E, 0xBC, 0xBB, 0x81, 0x61, 0xA6};
  for (int i = 0; i < 6; i++) assert(SPLIT_MASTER_MAC[i] == expected[i]);
}

TEST(test_left_base_mac) {
  const uint8_t expected[6] = {0x2E, 0xBC, 0xBB, 0x81, 0x61, 0xB0};
  for (int i = 0; i < 6; i++) assert(LEFT_BASE_MAC[i] == expected[i]);
  // Basis-MAC muss eine Unicast-Adresse sein (Bit 0 im ersten Byte = 0)
  assert((LEFT_BASE_MAC[0] & 0x01) == 0);
}

static SplitSendQueue q;

// Eindeutiger Tastatur-Code (1..255) pro Matrixposition für die Warteschlangen-Tests
static uint16_t keyCode(int r, int c) { return (uint16_t)(1 + r * 7 + c); }

TEST(test_queue_delivers_in_order) {
  queueReset(q);
  assert(queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, keyCode(0, 1))));
  assert(queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_RELEASE, keyCode(0, 1))));
  SplitHidEvent ev;
  assert(queueNextToSend(q, 0, ev));
  assert(ev.op == SPLIT_OP_KEY_PRESS);
  // Solange ein Paket unterwegs ist, startet kein zweites
  assert(!queueNextToSend(q, 1, ev));
  assert(queueOnSendResult(q, true, 1) == SEND_DELIVERED);
  // Nach einer Zustellung gibt es keine Wartezeit
  assert(queueNextToSend(q, 1, ev));
  assert(ev.op == SPLIT_OP_KEY_RELEASE);
  assert(queueOnSendResult(q, true, 2) == SEND_DELIVERED);
  assert(q.count == 0);
  assert(!queueNextToSend(q, 3, ev));
}

TEST(test_queue_retries_same_event_then_drops) {
  queueReset(q);
  queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_RELEASE, keyCode(2, 3)));
  queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, keyCode(4, 5)));
  SplitHidEvent ev;
  unsigned long now = 0;
  for (int i = 0; i < ESPNOW_MAX_RETRIES; i++) {
    assert(queueNextToSend(q, now, ev));
    assert(ev.code == keyCode(2, 3));
    assert(queueOnSendResult(q, false, now) == SEND_RETRY);
    now += ESPNOW_RETRY_DELAY_MS;
  }
  assert(queueNextToSend(q, now, ev));
  assert(ev.code == keyCode(2, 3));
  assert(queueOnSendResult(q, false, now) == SEND_DROPPED);
  // Das nächste Paket startet sofort und mit frischem Versuchszähler
  assert(queueNextToSend(q, now, ev));
  assert(ev.code == keyCode(4, 5));
  assert(q.attempts == 0);
  assert(queueOnSendResult(q, false, now) == SEND_RETRY);
}

TEST(test_scroll_is_not_retried) {
  // Ein doppelt zugestelltes Scroll-Paket scrollte doppelt: Scrollen wird nie wiederholt
  queueReset(q);
  queuePush(q, makeSplitHidEvent(SPLIT_OP_MOUSE_SCROLL, 0, -1));
  queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, keyCode(0, 0)));
  SplitHidEvent ev;
  assert(queueNextToSend(q, 0, ev) && ev.op == SPLIT_OP_MOUSE_SCROLL);
  assert(queueOnSendResult(q, false, 0) == SEND_DROPPED);
  assert(queueNextToSend(q, 0, ev) && ev.op == SPLIT_OP_KEY_PRESS);
  // Alle anderen Ops bleiben wiederholbar (idempotent auf dem Master)
  for (uint8_t op = 0; op < SPLIT_OP_COUNT; op++) {
    bool expected = op != SPLIT_OP_MOUSE_SCROLL && op != SPLIT_OP_KEY_EVENT && op != SPLIT_OP_CAPS_WORD_TOGGLE;
    assert(splitEventRetryable(makeSplitHidEvent(op, 1)) == expected);
  }
}

TEST(test_key_event_is_not_retried) {
  // Ein doppelt zugestelltes Matrix-Ereignis zählte in Heatmap und Statistik doppelt
  queueReset(q);
  queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_EVENT, splitKeyEventCode(0, 0, true, 0)));
  SplitHidEvent ev;
  assert(queueNextToSend(q, 0, ev) && ev.op == SPLIT_OP_KEY_EVENT);
  assert(queueOnSendResult(q, false, 0) == SEND_DROPPED);
  assert(q.count == 0);
}

TEST(test_diagnostic_events_keep_room_for_hid_events) {
  queueReset(q);
  SplitHidEvent diag = makeSplitHidEvent(SPLIT_OP_KEY_EVENT, splitKeyEventCode(0, 0, true, 0));
  for (int i = 0; i < SPLIT_DIAG_QUEUE_LIMIT; i++) assert(queuePushDiagnostic(q, diag));
  assert(!queuePushDiagnostic(q, diag));
  // HID-Ereignisse füllen den Rest der Warteschlange
  for (int i = SPLIT_DIAG_QUEUE_LIMIT; i < SPLIT_QUEUE_SIZE; i++) {
    assert(queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a')));
  }
  assert(q.count == SPLIT_QUEUE_SIZE);
}

TEST(test_retry_waits_for_delay) {
  queueReset(q);
  queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, keyCode(1, 1)));
  SplitHidEvent ev;
  assert(queueNextToSend(q, 100, ev));
  // esp_now_send meldet einen Fehler (z. B. ESP_ERR_ESPNOW_NO_MEM)
  assert(queueOnSendResult(q, false, 100) == SEND_RETRY);
  assert(!queueNextToSend(q, 100, ev));
  assert(!queueNextToSend(q, 100 + ESPNOW_RETRY_DELAY_MS - 1, ev));
  assert(queueNextToSend(q, 100 + ESPNOW_RETRY_DELAY_MS, ev));
}

TEST(test_retry_delay_across_millis_wrap) {
  queueReset(q);
  queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, keyCode(1, 1)));
  SplitHidEvent ev;
  const unsigned long nearWrap = ~0UL - 10;
  assert(queueNextToSend(q, nearWrap, ev));
  assert(queueOnSendResult(q, false, nearWrap) == SEND_RETRY);
  assert(!queueNextToSend(q, nearWrap + 5, ev));
  assert(!queueNextToSend(q, nearWrap + ESPNOW_RETRY_DELAY_MS - 1, ev));
  assert(queueNextToSend(q, nearWrap + ESPNOW_RETRY_DELAY_MS, ev));
}

TEST(test_queue_retry_then_success) {
  queueReset(q);
  queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, keyCode(1, 1)));
  SplitHidEvent ev;
  queueNextToSend(q, 0, ev);
  assert(queueOnSendResult(q, false, 0) == SEND_RETRY);
  assert(queueNextToSend(q, ESPNOW_RETRY_DELAY_MS, ev));
  assert(queueOnSendResult(q, true, ESPNOW_RETRY_DELAY_MS) == SEND_DELIVERED);
  assert(q.count == 0);
  assert(q.attempts == 0);
}

TEST(test_queue_full_rejects_push) {
  queueReset(q);
  for (int i = 0; i < SPLIT_QUEUE_SIZE; i++) assert(queuePush(q, makeSplitHidEvent(((i % 2) ? SPLIT_OP_KEY_PRESS : SPLIT_OP_KEY_RELEASE), keyCode(0, 0))));
  assert(!queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, keyCode(5, 6))));
  assert(q.count == SPLIT_QUEUE_SIZE);
}

TEST(test_queue_wraps_ring_buffer) {
  queueReset(q);
  SplitHidEvent ev;
  for (int i = 0; i < SPLIT_QUEUE_SIZE + 5; i++) {
    assert(queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, keyCode(i % 6, i % 7))));
    assert(queueNextToSend(q, 0, ev));
    assert(ev.code == keyCode(i % 6, i % 7));
    assert(queueOnSendResult(q, true, 0) == SEND_DELIVERED);
  }
}

TEST(test_queue_timeout) {
  queueReset(q);
  queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, keyCode(0, 0)));
  SplitHidEvent ev;
  assert(!queueTimedOut(q, 1000));
  queueNextToSend(q, 1000, ev);
  assert(!queueTimedOut(q, 1000 + ESPNOW_SEND_TIMEOUT_MS - 1));
  assert(queueTimedOut(q, 1000 + ESPNOW_SEND_TIMEOUT_MS));
}

TEST(test_queue_result_without_send_is_ignored) {
  queueReset(q);
  queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, keyCode(0, 0)));
  assert(queueOnSendResult(q, false, 0) == SEND_DELIVERED);
  assert(q.count == 1);
  assert(q.attempts == 0);
}

// Simuliert den Callback-Zähler der Firmware (callbackSeq in dactyl_left.ino)
TEST(test_late_callback_before_retry_is_absorbed) {
  queueReset(q);
  queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_RELEASE, keyCode(3, 3)));
  SplitHidEvent ev;
  uint32_t cb = 7;
  // Erstes Paket: Callback bleibt bis zum Timeout aus
  queueNextToSend(q, 0, ev);
  queueMarkSent(q, cb);
  assert(!queueCallbackIsCurrent(q, cb));
  assert(queueTimedOut(q, ESPNOW_SEND_TIMEOUT_MS));
  assert(queueOnSendResult(q, false, ESPNOW_SEND_TIMEOUT_MS) == SEND_RETRY);
  // Der späte Callback des ersten Pakets trifft in der Retry-Wartezeit ein
  cb++;
  assert(!queueCallbackIsCurrent(q, cb));
  // Retry: der erwartete Zählerstand baut auf dem aktuellen Stand auf
  unsigned long t = ESPNOW_SEND_TIMEOUT_MS + ESPNOW_RETRY_DELAY_MS;
  assert(queueNextToSend(q, t, ev));
  queueMarkSent(q, cb);
  assert(!queueCallbackIsCurrent(q, cb));
  cb++;
  assert(queueCallbackIsCurrent(q, cb));
  assert(queueOnSendResult(q, true, t) == SEND_DELIVERED);
  // Ohne laufendes Paket gehört kein Callback dazu
  assert(!queueCallbackIsCurrent(q, cb));
}

TEST(test_missing_callback_does_not_shift_matching) {
  queueReset(q);
  queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, keyCode(0, 0)));
  queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_RELEASE, keyCode(0, 0)));
  SplitHidEvent ev;
  uint32_t cb = 0;
  unsigned long t = 0;
  // Erstes Ereignis: kein einziger Callback, alle Versuche laufen in den Timeout
  for (int i = 0; i <= ESPNOW_MAX_RETRIES; i++) {
    assert(queueNextToSend(q, t, ev));
    assert(ev.op == SPLIT_OP_KEY_PRESS);
    queueMarkSent(q, cb);
    t += ESPNOW_SEND_TIMEOUT_MS;
    assert(queueTimedOut(q, t));
    queueOnSendResult(q, false, t);
    t += ESPNOW_RETRY_DELAY_MS;
  }
  assert(q.count == 1);
  // Zweites Ereignis: sein Callback wird wieder korrekt zugeordnet
  assert(queueNextToSend(q, t, ev));
  assert(ev.op == SPLIT_OP_KEY_RELEASE);
  queueMarkSent(q, cb);
  cb++;
  assert(queueCallbackIsCurrent(q, cb));
  assert(queueOnSendResult(q, true, t) == SEND_DELIVERED);
  assert(q.count == 0);
}

TEST(test_callback_counter_wrap) {
  queueReset(q);
  queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, keyCode(0, 0)));
  SplitHidEvent ev;
  uint32_t cb = 0xFFFFFFFFu;
  queueNextToSend(q, 0, ev);
  queueMarkSent(q, cb);
  cb++;
  assert(cb == 0);
  assert(queueCallbackIsCurrent(q, cb));
}

// Liefert n verworfene Ereignisse im Abstand stepMs ab startMs; Rückgabe: Zeitpunkt des letzten
static unsigned long dropEvents(EspNowRestartGuard &g, int n, unsigned long startMs, unsigned long stepMs) {
  unsigned long t = startMs;
  for (int i = 0; i < n; i++) {
    if (i > 0) t += stepMs;
    restartGuardOnOutcome(g, SEND_DROPPED, t);
  }
  return t;
}

TEST(test_restart_needs_drop_threshold_and_down_time) {
  EspNowRestartGuard g;
  restartGuardReset(g);
  unsigned long t = dropEvents(g, ESPNOW_RESTART_DROPS - 1, 1000, 2000);
  // Genug Ausfallzeit, aber ein verworfenes Ereignis zu wenig
  assert(!shouldRestartEspNow(g, t + ESPNOW_RESTART_DOWN_MS, true));
  restartGuardOnOutcome(g, SEND_DROPPED, t + 1);
  assert(shouldRestartEspNow(g, t + 1, true));

  // Genug Ereignisse, aber der Link ist erst kurz unten
  restartGuardReset(g);
  t = dropEvents(g, ESPNOW_RESTART_DROPS, 1000, 100);
  assert(!shouldRestartEspNow(g, 1000 + ESPNOW_RESTART_DOWN_MS - 1, true));
  assert(shouldRestartEspNow(g, 1000 + ESPNOW_RESTART_DOWN_MS, true));
}

TEST(test_restart_counter_resets_after_delivery) {
  EspNowRestartGuard g;
  restartGuardReset(g);
  unsigned long t = dropEvents(g, ESPNOW_RESTART_DROPS - 1, 0, 1000);
  restartGuardOnOutcome(g, SEND_DELIVERED, t + 1);
  // Ein Retry ist kein verworfenes Ereignis
  restartGuardOnOutcome(g, SEND_RETRY, t + 2);
  t = dropEvents(g, ESPNOW_RESTART_DROPS - 1, t + 1000, 1000);
  assert(!shouldRestartEspNow(g, t + ESPNOW_RESTART_DOWN_MS, true));
  // Die Ausfallzeit zählt ab dem ersten Drop nach der Zustellung
  restartGuardOnOutcome(g, SEND_DROPPED, t + 1);
  assert(!shouldRestartEspNow(g, t + 1, true));
}

TEST(test_restart_backoff) {
  EspNowRestartGuard g;
  restartGuardReset(g);
  unsigned long t = dropEvents(g, ESPNOW_RESTART_DROPS, 0, 1000) + ESPNOW_RESTART_DOWN_MS;
  assert(shouldRestartEspNow(g, t, true));
  restartGuardOnRestart(g, t);
  assert(!shouldRestartEspNow(g, t, true));
  // Der Link bleibt unten: Schwelle und Ausfallzeit sind wieder erreicht, der Backoff läuft noch
  unsigned long t2 = dropEvents(g, ESPNOW_RESTART_DROPS, t + 1000, 1000) + ESPNOW_RESTART_DOWN_MS;
  assert(t2 - t < ESPNOW_RESTART_BACKOFF_MS);
  assert(!shouldRestartEspNow(g, t2, true));
  assert(!shouldRestartEspNow(g, t + ESPNOW_RESTART_BACKOFF_MS - 1, true));
  assert(shouldRestartEspNow(g, t + ESPNOW_RESTART_BACKOFF_MS, true));
}

TEST(test_restart_not_allowed_in_config_mode_or_sleep) {
  EspNowRestartGuard g;
  restartGuardReset(g);
  unsigned long t = dropEvents(g, ESPNOW_RESTART_DROPS, 0, 1000) + ESPNOW_RESTART_DOWN_MS;
  assert(!shouldRestartEspNow(g, t, false));
  assert(shouldRestartEspNow(g, t, true));
}

TEST(test_restart_across_millis_wrap) {
  EspNowRestartGuard g;
  restartGuardReset(g);
  const unsigned long nearWrap = ~0UL - 1000;
  unsigned long t = dropEvents(g, ESPNOW_RESTART_DROPS, nearWrap, 10);
  assert(!shouldRestartEspNow(g, t, true));
  assert(shouldRestartEspNow(g, nearWrap + ESPNOW_RESTART_DOWN_MS, true));
}

TEST(test_restart_gate_blocks_config_mode_sleep_and_missing_espnow) {
  assert(espNowRestartAllowed(false, false, true));
  assert(!espNowRestartAllowed(true, false, true));   // Config Mode
  assert(!espNowRestartAllowed(false, true, true));   // Deep-Sleep-Vorbereitung
  assert(!espNowRestartAllowed(false, false, false)); // ESP-NOW nicht bereit
  EspNowRestartGuard g;
  restartGuardReset(g);
  unsigned long t = dropEvents(g, ESPNOW_RESTART_DROPS, 0, 1000) + ESPNOW_RESTART_DOWN_MS;
  assert(!shouldRestartEspNow(g, t, espNowRestartAllowed(true, false, true)));
  assert(shouldRestartEspNow(g, t, espNowRestartAllowed(false, false, true)));
}

TEST(test_dropped_key_event_does_not_count_for_restart) {
  EspNowRestartGuard g;
  restartGuardReset(g);
  for (int i = 0; i < ESPNOW_RESTART_DROPS * 2; i++) {
    restartGuardOnOutcome(g, SEND_DROPPED, (unsigned long)i * 1000, SPLIT_OP_KEY_EVENT);
  }
  assert(g.consecutiveDrops == 0);
  assert(!shouldRestartEspNow(g, 100000, true));
  // HID-Verluste zählen weiter
  restartGuardOnOutcome(g, SEND_DROPPED, 100000, SPLIT_OP_KEY_RELEASE);
  assert(g.consecutiveDrops == 1);

  // queueHeadOp liefert die Op des Pakets, dessen Ergebnis gleich verbucht wird
  SplitSendQueue q;
  queueReset(q);
  assert(queueHeadOp(q) == SPLIT_OP_HEARTBEAT);
  queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_EVENT, splitKeyEventCode(1, 2, true, 0)));
  queuePush(q, makeSplitHidEvent(SPLIT_OP_KEY_PRESS, 'a'));
  assert(queueHeadOp(q) == SPLIT_OP_KEY_EVENT);
}

TEST(test_restart_backoff_grows_without_delivery) {
  EspNowRestartGuard g;
  restartGuardReset(g);
  unsigned long t = dropEvents(g, ESPNOW_RESTART_DROPS, 0, 1000) + ESPNOW_RESTART_DOWN_MS;
  unsigned long expected = ESPNOW_RESTART_BACKOFF_MS;
  for (int i = 0; i < 6; i++) {
    assert(shouldRestartEspNow(g, t, true));
    restartGuardOnRestart(g, t);
    assert(restartBackoffMs(g) == expected);
    dropEvents(g, ESPNOW_RESTART_DROPS, t + 1, 1);
    assert(!shouldRestartEspNow(g, t + expected - 1, true));
    t += expected;
    expected = expected * 2 < ESPNOW_RESTART_BACKOFF_MAX_MS ? expected * 2 : ESPNOW_RESTART_BACKOFF_MAX_MS;
  }
  assert(restartBackoffMs(g) == ESPNOW_RESTART_BACKOFF_MAX_MS);
  // Eine Zustellung setzt den Backoff zurück
  restartGuardOnOutcome(g, SEND_DELIVERED, t);
  assert(restartBackoffMs(g) == ESPNOW_RESTART_BACKOFF_MS);
}

TEST(test_master_activity_resets_inactivity_timer) {
  volatile bool received = false;
  unsigned long last = 100;
  assert(!consumeMasterActivity(received, 5000, last));
  assert(last == 100);
  received = true;
  assert(consumeMasterActivity(received, 5000, last));
  assert(last == 5000 && !received);
  assert(!consumeMasterActivity(received, 6000, last));
  assert(last == 5000);
}

TEST(test_key_event_diagnostic_needs_link_and_counts_drops) {
  SplitSendQueue q;
  queueReset(q);
  uint32_t dropped = 0;
  SplitHidEvent ev = makeSplitHidEvent(SPLIT_OP_KEY_EVENT, splitKeyEventCode(2, 3, true, 1));
  // Ohne Link: nichts eingereiht, kein Verlust gezählt
  assert(!queueKeyEventDiagnostic(q, false, ev, dropped));
  assert(q.count == 0 && dropped == 0);
  for (int i = 0; i < SPLIT_DIAG_QUEUE_LIMIT; i++) assert(queueKeyEventDiagnostic(q, true, ev, dropped));
  assert(q.count == SPLIT_DIAG_QUEUE_LIMIT && dropped == 0);
  // Grenze erreicht: verworfen und gezählt
  assert(!queueKeyEventDiagnostic(q, true, ev, dropped));
  assert(!queueKeyEventDiagnostic(q, true, ev, dropped));
  assert(q.count == SPLIT_DIAG_QUEUE_LIMIT && dropped == 2);
}

TEST(test_queue_push_after_drain_makes_room) {
  SplitSendQueue q;
  queueReset(q);
  SplitHidEvent ev = makeSplitHidEvent(SPLIT_OP_LAYER_STATE);
  // Mit Platz: direkt eingereiht, ohne zu leeren
  int drains = 0;
  assert(queuePushAfterDrain(q, ev, [&] { drains++; }) && drains == 0 && q.count == 1);
  // Volle Warteschlange: erst leeren, dann einreihen
  while (queuePush(q, makeSplitHidEvent(SPLIT_OP_HEARTBEAT))) {}
  assert(q.count == SPLIT_QUEUE_SIZE);
  assert(queuePushAfterDrain(q, ev, [&] { drains++; queueReset(q); }));
  assert(drains == 1 && q.count == 1 && q.items[q.head].op == SPLIT_OP_LAYER_STATE);
  // Leeren ohne Erfolg: false, kein Überlauf
  while (queuePush(q, makeSplitHidEvent(SPLIT_OP_HEARTBEAT))) {}
  assert(!queuePushAfterDrain(q, ev, [&] { drains++; }) && drains == 2 && q.count == SPLIT_QUEUE_SIZE);
}

TEST(test_espnow_boot_retry_stops_after_limit) {
  uint32_t rtc = 0x12345678; // Kaltstart: RTC_NOINIT enthält einen Zufallswert
  assert(espNowBootRetryAllowed(rtc, false));
  assert(espNowBootRetryAllowed(rtc, true));
  assert(espNowBootRetryAllowed(rtc, true));
  // Nach ESPNOW_BOOT_RETRIES Neustarts in Folge: kein weiterer Neustart (keine Schleife)
  assert(!espNowBootRetryAllowed(rtc, true));
  assert(rtc == 0);
  // Ein Kaltstart (Einschalten, Reset-Taste) zählt neu, auch mit gültigem Zählerstand
  rtc = ESPNOW_BOOT_RETRY_MAGIC | ESPNOW_BOOT_RETRIES;
  assert(espNowBootRetryAllowed(rtc, false));
  assert(rtc == (ESPNOW_BOOT_RETRY_MAGIC | 1));
  // Zählerstand über der Grenze (beschädigtes Byte): kein Neustart
  rtc = ESPNOW_BOOT_RETRY_MAGIC | 0xFF;
  assert(!espNowBootRetryAllowed(rtc, true));
  assert(rtc == 0);
}

int main() {
  std::cout << "==================================================" << std::endl;
  std::cout << "  Dactyl Left Firmware Unit Test Suite" << std::endl;
  std::cout << "==================================================" << std::endl;

  std::cout << "\nRan " << testsRun << " tests. All " << testsPassed << " passed successfully!" << std::endl;
  return (testsRun == testsPassed) ? 0 : 1;
}
