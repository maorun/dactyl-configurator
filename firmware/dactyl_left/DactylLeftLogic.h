#pragma once
/*
 * DactylLeftLogic.h — hardwareunabhängige Logik der linken Hälfte (Matrix, Entprellung, Sendewarteschlange).
 *
 * Wird von dactyl_left.ino und firmware/tests/test_left_logic.cpp eingebunden,
 * damit die Unit-Tests den Produktionscode ausführen.
 *
 * Verdrahtung links: Dioden an den Spalten, Kathode (schwarzer Ring) zum Spaltendraht.
 * Scan: eine Spalte auf LOW treiben, Zeilen mit INPUT_PULLUP lesen.
 * Deep Sleep: Zeilen auf HIGH halten, Spalten als RTC-Pulldown, Ext1 ANY_HIGH auf den Spalten.
 * Deshalb liegen alle Spalten auf RTC-fähigen GPIOs.
 */
#include <stdint.h>
#include "../dactyl_right/DactylMatrixConstants.h"
#include "../dactyl_right/DactylSplitHid.h"
#include "../dactyl_right/DactylDebounce.h"

#define LEFT_DEBOUNCE_MS 5

// RTC-fähige GPIOs des ESP32 (nur diese können per Ext1 aus dem Deep Sleep wecken)
inline bool isRtcGpio(uint8_t gpio) {
  static const uint8_t rtc[] = {0, 2, 4, 12, 13, 14, 15, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39};
  for (uint8_t g : rtc) if (g == gpio) return true;
  return false;
}

// Feste Basis-MAC der linken Hälfte (Wi-Fi-STA-MAC = Basis-MAC)
#define LEFT_BASE_MAC SPLIT_LEFT_MAC

static EagerDebounceKey leftKeys[LEFT_NUM_ROWS][LEFT_NUM_COLS] = {};

void resetLeftKeys() {
  for (int r = 0; r < LEFT_NUM_ROWS; r++) {
    for (int c = 0; c < LEFT_NUM_COLS; c++) eagerDebounceReset(leftKeys[r][c]);
  }
}

// Eager debounce (DactylDebounce.h): a press is reported at once, a release after debounceMsArg of open contact.
// Liefert true, wenn sich der gemeldete Zustand ändert. Der neue Zustand steht danach in leftKeys[r][c].stable.
bool updateLeftKey(int r, int c, bool rawPressed, unsigned long nowMs, unsigned long debounceMsArg = LEFT_DEBOUNCE_MS) {
  if (r < 0 || r >= LEFT_NUM_ROWS || c < 0 || c >= LEFT_NUM_COLS) return false;
  EagerDebounceKey &k = leftKeys[r][c];
  bool before = k.stable;
  return eagerDebounceUpdate(k, rawPressed, nowMs, debounceMsArg) != before;
}

// Sendewarteschlange: genau ein Paket ist unterwegs. Ein fehlgeschlagenes Paket wird bis zu
// ESPNOW_MAX_RETRIES-mal wiederholt, bevor es verworfen wird. Die Reihenfolge bleibt erhalten,
// damit ein UP nie vor seinem DOWN ankommt.
#define SPLIT_QUEUE_SIZE 64
#define ESPNOW_MAX_RETRIES 5
// Fehlt der Sende-Callback so lange, gilt das Paket als fehlgeschlagen
#define ESPNOW_SEND_TIMEOUT_MS 200
// Wartezeit vor einem Retry, damit ein voller Wi-Fi-Puffer (ESP_ERR_ESPNOW_NO_MEM) frei wird
// und die Versuche das 40-ms-Aufwachfenster im 100-ms-Intervall sicher treffen
#define ESPNOW_RETRY_DELAY_MS 30

enum SendOutcome { SEND_DELIVERED = 0, SEND_RETRY = 1, SEND_DROPPED = 2 };

struct SplitSendQueue {
  SplitHidEvent items[SPLIT_QUEUE_SIZE];
  uint8_t head;
  uint8_t count;
  uint8_t attempts;
  bool inFlight;
  unsigned long sentAtMs;
  // Retry erst ab diesem Zeitpunkt (nur gültig, wenn attempts > 0)
  unsigned long retryAtMs;
  // Callback-Zählerstand, den der Callback des laufenden Pakets erreicht. Beim Senden gilt:
  // erwartet = beobachteter Zählerstand + 1. Ein später Callback, der vor dem Retry eintrifft,
  // und ein ganz fehlender Callback verschieben die Zuordnung deshalb nicht dauerhaft.
  uint32_t expectedSeq;
  // Diagnose (GET_DIAG sq_max, sq_drop): höchster Füllstand und verworfene Ereignisse seit dem Start.
  // dropped zählt abgelehnte queuePush-Aufrufe (Versuche): Sender, die bei voller Warteschlange im nächsten
  // Durchlauf erneut einreihen, zählen mehrfach. Ein Wert über 0 zeigt, dass die Warteschlange voll war.
  // queueReset() lässt beide stehen, auch beim ESP-NOW-Neustart.
  uint8_t highWater = 0;
  uint32_t dropped = 0;
};

inline unsigned long leftLoopDelayMs(bool isStandby, const SplitSendQueue &q) {
  return (isStandby && q.count == 0) ? 40UL : 1UL;
}

void queueReset(SplitSendQueue &q) {
  q.head = 0;
  q.count = 0;
  q.attempts = 0;
  q.inFlight = false;
  q.sentAtMs = 0;
  q.retryAtMs = 0;
  q.expectedSeq = 0;
}

// Nach erfolgreichem esp_now_send aufrufen, mit dem vor dem Senden gelesenen Callback-Zählerstand
void queueMarkSent(SplitSendQueue &q, uint32_t callbackSeqBeforeSend) {
  q.expectedSeq = callbackSeqBeforeSend + 1;
}

// true, wenn der Callback-Zählerstand callbackSeq das laufende Paket abschließt
bool queueCallbackIsCurrent(const SplitSendQueue &q, uint32_t callbackSeq) {
  return q.inFlight && callbackSeq == q.expectedSeq;
}

// false, wenn die Warteschlange voll ist (das Ereignis wird dann nicht eingereiht)
bool queuePush(SplitSendQueue &q, const SplitHidEvent &ev) {
  if (q.count >= SPLIT_QUEUE_SIZE) {
    q.dropped++;
    return false;
  }
  q.items[(q.head + q.count) % SPLIT_QUEUE_SIZE] = ev;
  q.count++;
  if (q.count > q.highWater) q.highWater = q.count;
  return true;
}

// Diagnose-Ereignisse (KEY_EVENT) belegen höchstens die erste Hälfte der Warteschlange, damit sie
// nie den Platz für HID-Ereignisse verbrauchen. false = nicht eingereiht.
#define SPLIT_DIAG_QUEUE_LIMIT (SPLIT_QUEUE_SIZE / 2)
bool queuePushDiagnostic(SplitSendQueue &q, const SplitHidEvent &ev) {
  if (q.count >= SPLIT_DIAG_QUEUE_LIMIT) return false;
  return queuePush(q, ev);
}

// Ein Makro-Schritt reiht höchstens ein Ereignis ein und wartet, solange weniger als MACRO_QUEUE_RESERVE
// Plätze frei sind: die Tasten des Users verlieren so nie ihren Platz an ein langes Makro.
#define MACRO_QUEUE_RESERVE 16
bool queueHasRoomForMacro(const SplitSendQueue &q) {
  return q.count + MACRO_QUEUE_RESERVE < SPLIT_QUEUE_SIZE;
}

// Ereignis einreihen, das nicht verloren gehen darf (Layer-Release vor Config Mode und Deep Sleep). Eine
// volle Warteschlange wird erst mit drain() geleert (sendet die älteren Ereignisse, z. B. RELEASE_ALL).
// false nur, wenn auch danach kein Platz ist.
template <class DrainFn>
bool queuePushAfterDrain(SplitSendQueue &q, const SplitHidEvent &ev, DrainFn drain) {
  // Der erste Versuch zählt nicht als verworfen: nach drain() kommt das Ereignis meist noch hinein
  if (q.count < SPLIT_QUEUE_SIZE) return queuePush(q, ev);
  drain();
  return queuePush(q, ev);
}

// -----------------------------------------------------------------------------
// Repeat-Taste links (SPLIT_OP_REPEAT)
// -----------------------------------------------------------------------------
// Die linke Hälfte führt eine Wiederholung nie selbst aus, wenn ihre Repeat-Taste gedrückt wird: der Master
// entscheidet (DactylSplitHid.h). Jede Taste trägt eine Nummer 1..127; Drücken und Loslassen tragen sie, ein
// Retry-Duplikat ändert am Master nichts. Die Notiz "links hat eine Aktion aufgezeichnet" (code 2) wird
// vorgemerkt und gesendet, sobald die Warteschlange Platz hat; sie geht nie verloren.
// Die Notiz wird zusätzlich alle LEFT_REPEAT_NOTE_EVERY_MS wiederholt, solange links eine Aktion aufgezeichnet ist:
// ein neu gestarteter Master (Ende des Config Mode) oder ein nach allen Retries verlorenes Paket kennt sie sonst nie.
#define LEFT_REPEAT_NOTE_EVERY_MS 5000
struct LeftRepeatLink {
  uint8_t keySeq[LEFT_NUM_ROWS][LEFT_NUM_COLS];
  uint8_t counter;
  bool noteDue;
  bool haveAction;           // links ist eine Aktion aufgezeichnet
  unsigned long lastNoteMs;  // Zeit der letzten gesendeten Notiz
};

// Eine volle Warteschlange verwirft das Drücken (der Master hört nichts). Rückgabe immer true: die Taste gilt als
// übergeben, sonst wiederholte die linke Hälfte lokal eine Aktion, obwohl rechts zuletzt gehandelt hat.
inline bool leftRepeatPress(LeftRepeatLink &l, SplitSendQueue &q, uint8_t r, uint8_t c, bool alt = false) {
  l.counter = (uint8_t)((l.counter % 127) + 1);
  l.keySeq[r][c] = l.counter;
  if (!queuePush(q, makeSplitHidEvent(SPLIT_OP_REPEAT, alt ? SPLIT_REPEAT_CODE_ALT_PRESS : 1, (int8_t)l.counter))) l.keySeq[r][c] = 0;
  return true;
}

// Ein Loslassen ist wichtiger als ein Diagnose-Ereignis: bei voller Warteschlange erst senden (drain), dann einreihen
template <class DrainFn>
inline void leftRepeatRelease(LeftRepeatLink &l, SplitSendQueue &q, uint8_t r, uint8_t c, DrainFn drain) {
  uint8_t seq = l.keySeq[r][c];
  if (seq == 0) return;
  l.keySeq[r][c] = 0;
  queuePushAfterDrain(q, makeSplitHidEvent(SPLIT_OP_REPEAT, 0, (int8_t)seq), drain);
}

inline void leftRepeatNoteRecorded(LeftRepeatLink &l) {
  l.noteDue = true;
  l.haveAction = true;
}

// Je loop()-Durchlauf: eine vorgemerkte oder fällige Notiz einreihen, wenn Platz ist
inline void leftRepeatServiceNote(LeftRepeatLink &l, SplitSendQueue &q, unsigned long nowMs) {
  if (!l.noteDue && l.haveAction && (unsigned long)(nowMs - l.lastNoteMs) >= LEFT_REPEAT_NOTE_EVERY_MS) l.noteDue = true;
  if (l.noteDue && queuePush(q, makeSplitHidEvent(SPLIT_OP_REPEAT, 2))) {
    l.noteDue = false;
    l.lastNoteMs = nowMs;
  }
}

// Matrix-Position für den Live-Monitor am Master einreihen, nach den HID-Ereignissen der Taste.
// Ohne Link sendet die Hälfte nichts (wie DactylLogic.h ohne Master). Ein Ereignis, das die
// Warteschlangen-Grenze verwirft, zählt droppedCount. Rückgabe: true = eingereiht.
bool queueKeyEventDiagnostic(SplitSendQueue &q, bool linkUp, const SplitHidEvent &ev, uint32_t &droppedCount) {
  if (!linkUp) return false;
  if (queuePushDiagnostic(q, ev)) return true;
  droppedCount++;
  return false;
}

// Matrix-Test (TEST_MATRIX): eine Schalteränderung dieser Hälfte melden. Direkt per USB-Serial (usb), sonst als
// SPLIT_OP_MATRIX_RAW an den Master (nur bei Link; höchstens die halbe Warteschlange wie jede Diagnose). Nie über BLE.
// Rückgabe: true = ausgegeben oder eingereiht.
template <class EmitFn>
bool leftMatrixTestReport(bool testOn, bool usb, SplitSendQueue &q, bool linkUp, uint32_t &droppedCount,
                          uint8_t row, uint8_t col, bool down, EmitFn emit) {
  if (!testOn) return false;
  if (usb) {
    emit(row, col, down);
    return true;
  }
  return queueKeyEventDiagnostic(q, linkUp, makeSplitHidEvent(SPLIT_OP_MATRIX_RAW, splitKeyEventCode(row, col, down, 0)),
                                 droppedCount);
}

// Lebenszeichen an den Master, einmal pro Intervall. counter zählt die Intervalle: bei 0 geht
// SPLIT_OP_FW_VERSION raus (wie ein Diagnose-Ereignis, höchstens halbe Warteschlange, damit es auch beim Tippen
// ankommt; sonst bleibt counter 0 bis zum nächsten Intervall), sonst HEARTBEAT nur bei leerer Warteschlange.
// Ein Master ohne FW_VERSION verwirft das Paket; die Heartbeats dazwischen halten den Link.
// Rückgabe: true = eingereiht.
#define HEARTBEAT_INTERVAL_MS 1000

bool queueHeartbeat(SplitSendQueue &q, uint8_t &counter) {
  if (counter == 0) {
    if (!queuePushDiagnostic(q, makeSplitHidEvent(SPLIT_OP_FW_VERSION, (uint16_t)DACTYL_FW_VERSION))) return false;
    counter = 1;
    return true;
  }
  counter = (uint8_t)((counter + 1) % SPLIT_FW_VERSION_EVERY);
  return q.count == 0 && queuePush(q, makeSplitHidEvent(SPLIT_OP_HEARTBEAT));
}

// Lebenszeichen nach Ablauf von intervalMs abschicken.
// Gibt true zurück, wenn das Intervall erreicht war und queueHeartbeat erfolgreich war.
inline bool queueHeartbeatIfDue(SplitSendQueue &q, uint8_t &counter, unsigned long &lastSendMs, unsigned long nowMs,
                                unsigned long intervalMs = HEARTBEAT_INTERVAL_MS) {
  if (lastSendMs != 0 && (nowMs - lastSendMs) < intervalMs) return false;
  lastSendMs = nowMs;
  return queueHeartbeat(q, counter);
}

// Doppel-Tipp-Zustand an den Master (SPLIT_OP_TAP_PENDING): 1, solange ein Einzel-Tipp auf den zweiten Tipp
// wartet, sonst 0. Nur bei einer Änderung; reported ändert sich erst nach dem Einreihen, eine volle
// Warteschlange meldet also im nächsten Durchlauf erneut. Ohne Link gilt nichts als gemeldet: der Master löscht
// die Meldung bei einem neuen Link, ein noch wartender Tipp wird danach neu gemeldet. Hinter den HID-Ereignissen
// des Tipps eingereiht: der Master führt den Tipp aus, bevor er die 0 sieht. setupEspNow setzt reported zurück.
struct SplitTapPendingReporter {
  bool reported;
};

bool queueTapPendingIfChanged(SplitSendQueue &q, SplitTapPendingReporter &rep, bool linkUp, bool waiting) {
  if (!linkUp) {
    rep.reported = false;
    return false;
  }
  if (waiting == rep.reported) return false;
  if (!queuePush(q, makeSplitHidEvent(SPLIT_OP_TAP_PENDING, waiting ? 1 : 0))) return false;
  rep.reported = waiting;
  return true;
}

// Nach setupEspNow: nichts gilt als gemeldet, eine alte Anforderung des Masters entfällt
inline void tapPendingReset(SplitTapPendingReporter &rep, volatile bool &flushRequested) {
  rep.reported = false;
  flushRequested = false;
}

// Je loop()-Durchlauf nach dem Matrix-Scan: eine Anforderung des Masters (SPLIT_OP_TAP_FLUSH) sendet die wartenden
// Einzel-Tipps (flush, DactylLogic.h flushAllDoubleTaps), danach den geänderten Zustand (waiting =
// anyDoubleTapWaiting). Die HID-Ereignisse des Tipps stehen so vor TAP_PENDING 0.
template <class FlushFn, class WaitingFn>
void serviceTapPending(SplitSendQueue &q, SplitTapPendingReporter &rep, volatile bool &flushRequested, bool linkUp,
                       FlushFn flush, WaitingFn waiting) {
  if (flushRequested) {
    flushRequested = false;
    flush();
  }
  queueTapPendingIfChanged(q, rep, linkUp, waiting());
}

// -----------------------------------------------------------------------------
// Mod-Tap über beide Hälften, linke Seite (SPLIT_OP_HOLD_PENDING, SPLIT_OP_HOLD_RESOLVE)
// -----------------------------------------------------------------------------
// Der Master meldet HOLD_PENDING 1, solange bei ihm eine Mod-Tap-Taste unentschieden ist. Links hält dann die eigene
// Matrix-Änderung zurück (SplitLocalDefer, derselbe Puffer wie am Master), sendet einmal HOLD_RESOLVE und führt die
// Änderung aus, sobald der Master 0 meldet (nach der neuen Ebene) oder nach SPLIT_TAP_FLUSH_TIMEOUT_MS.
// Die Meldung des Masters kommt vom Wi-Fi-Task (volatile Variablen); loop() liest sie.
struct MasterHoldState {
  volatile bool pending;
  volatile unsigned long sinceMs;
};

// Meldung des Masters übernehmen (Empfangs-Callback). Ein neuer Link oder ein Neustart setzt sie zurück.
inline void masterHoldNote(MasterHoldState &m, bool pending, unsigned long nowMs) {
  m.sinceMs = nowMs;
  // Die Ebene des Masters liegt schon im Briefkasten (der Master sendet sie vor der 0): erst danach den Stand freigeben
  __atomic_thread_fence(__ATOMIC_SEQ_CST);
  m.pending = pending;
}

inline void masterHoldReset(MasterHoldState &m) {
  m.pending = false;
  m.sinceMs = 0;
}

inline bool masterHoldPending(const MasterHoldState &m, unsigned long nowMs) {
  bool pending = m.pending;
  __atomic_thread_fence(__ATOMIC_SEQ_CST);
  return splitHoldPendingValid(pending, m.sinceMs, nowMs);
}

// Druck einer Mod-Tap-Taste am Master (HOLD_PENDING 1) für "Hold nur nach einer Tipp-Pause" (requirePriorIdleMs):
// der Empfangs-Callback schreibt die Zeit vor dem Flag, loop() liest das Flag und danach die Zeit. Ein Paket zwischen
// beiden Lesevorgängen liefert höchstens eine neuere Zeit und ein zweites Flag (dieselbe Taste, ohne Folge).
struct MasterPriorPress {
  volatile bool seen;
  volatile unsigned long ms;
};

inline void masterPriorPressNote(MasterPriorPress &m, unsigned long nowMs) {
  m.ms = nowMs;
  __atomic_thread_fence(__ATOMIC_SEQ_CST);
  m.seen = true;
}

// true und die Zeit des Drucks, wenn seit dem letzten Aufruf einer eintraf
inline bool masterPriorPressTake(MasterPriorPress &m, unsigned long &outMs) {
  if (!m.seen) return false;
  m.seen = false;
  __atomic_thread_fence(__ATOMIC_SEQ_CST);
  outMs = m.ms;
  return true;
}

// Zurückgehaltene linke Änderungen ausführen, in der Reihenfolge, die den Zustand des Masters nicht überholt:
// 1. Den Stand "Master wartet" zuerst lesen. Meldet er 0, kam die Ebene des Masters schon vorher im Briefkasten an
//    (der Master sendet die Ebene vor der 0).
// 2. Danach die Ebene übernehmen (takeLayer). Würde die Ebene nach dem Lesen der 0 übernommen, liefe die Taste noch auf
//    der alten Ebene.
// 3. Erst dann ausführen: bei gemeldeter 0 sofort, sonst nach SPLIT_TAP_FLUSH_TIMEOUT_MS.
template <class MasterHoldsFn, class TakeLayerFn, class ApplyFn>
inline void leftReplayHeld(SplitLocalDefer &d, unsigned long nowMs, MasterHoldsFn masterHolds, TakeLayerFn takeLayer,
                           ApplyFn apply) {
  bool holds = masterHolds();
  takeLayer();
  if (splitDeferReplayDue(d, holds, nowMs)) splitDeferReplay(d, apply);
}

// Op des Pakets am Kopf der Warteschlange (vor queueOnSendResult lesen), HEARTBEAT bei leerer Warteschlange
uint8_t queueHeadOp(const SplitSendQueue &q) {
  return q.count ? q.items[q.head].op : (uint8_t)SPLIT_OP_HEARTBEAT;
}

// Liefert das nächste zu sendende Paket, wenn keines unterwegs ist und keine Retry-Wartezeit läuft
bool queueNextToSend(SplitSendQueue &q, unsigned long nowMs, SplitHidEvent &out) {
  if (q.inFlight || q.count == 0) return false;
  if (q.attempts > 0 && (long)(nowMs - q.retryAtMs) < 0) return false;
  out = q.items[q.head];
  q.inFlight = true;
  q.sentAtMs = nowMs;
  return true;
}

bool queueTimedOut(const SplitSendQueue &q, unsigned long nowMs) {
  return q.inFlight && (nowMs - q.sentAtMs) >= ESPNOW_SEND_TIMEOUT_MS;
}

// Verarbeitet das Ergebnis des laufenden Pakets (Callback, Sendefehler oder Timeout)
SendOutcome queueOnSendResult(SplitSendQueue &q, bool success, unsigned long nowMs) {
  if (!q.inFlight || q.count == 0) return SEND_DELIVERED;
  q.inFlight = false;
  if (!success && q.attempts < ESPNOW_MAX_RETRIES && splitEventRetryable(q.items[q.head])) {
    q.attempts++;
    q.retryAtMs = nowMs + ESPNOW_RETRY_DELAY_MS;
    return SEND_RETRY;
  }
  q.head = (q.head + 1) % SPLIT_QUEUE_SIZE;
  q.count--;
  q.attempts = 0;
  return success ? SEND_DELIVERED : SEND_DROPPED;
}

// ESP-NOW-Neustart nach wiederholten Sendefehlern. Absicherung für einen Zustand, in dem jeder Versand
// scheitert, obwohl der Master erreichbar ist; erst ein Neustart des Funk-Stacks stellt den Link her.
// Auslöser: ESPNOW_RESTART_DROPS verworfene Ereignisse in Folge und Link seit ESPNOW_RESTART_DOWN_MS unten.
// Danach höchstens ein Neustart pro Backoff, damit kein Neustart-Kreislauf entsteht. Der Backoff beginnt bei
// ESPNOW_RESTART_BACKOFF_MS und verdoppelt sich mit jedem Neustart ohne Zustellung bis
// ESPNOW_RESTART_BACKOFF_MAX_MS (Master aus oder im Deep Sleep: jeder Neustart kostet Strom und blockiert loop()).
#define ESPNOW_RESTART_DROPS 5
#define ESPNOW_RESTART_DOWN_MS 5000
#define ESPNOW_RESTART_BACKOFF_MS 30000UL
#define ESPNOW_RESTART_BACKOFF_MAX_MS 480000UL

struct EspNowRestartGuard {
  uint8_t consecutiveDrops;
  // Zeitpunkt des ersten verworfenen Ereignisses nach dem letzten bestätigten Versand
  unsigned long linkDownSinceMs;
  unsigned long lastRestartMs;
  bool everRestarted;
  // Neustarts seit der letzten Zustellung (bestimmt den Backoff)
  uint8_t restartsWithoutDelivery;
};

void restartGuardReset(EspNowRestartGuard &g) {
  g.consecutiveDrops = 0;
  g.linkDownSinceMs = 0;
  g.lastRestartMs = 0;
  g.everRestarted = false;
  g.restartsWithoutDelivery = 0;
}

// Mit jedem Ergebnis aus queueOnSendResult aufrufen; op = Op des Pakets (queueHeadOp vor queueOnSendResult).
// Ein verworfenes Diagnose-Paket (KEY_EVENT, MATRIX_RAW) zählt nicht: es wird nie wiederholt und ist kein HID-Verlust.
void restartGuardOnOutcome(EspNowRestartGuard &g, SendOutcome outcome, unsigned long nowMs,
                           uint8_t op = SPLIT_OP_HEARTBEAT) {
  if (outcome == SEND_DELIVERED) {
    g.consecutiveDrops = 0;
    g.restartsWithoutDelivery = 0;
  } else if (outcome == SEND_DROPPED && op != SPLIT_OP_KEY_EVENT && op != SPLIT_OP_MATRIX_RAW) {
    if (g.consecutiveDrops == 0) g.linkDownSinceMs = nowMs;
    if (g.consecutiveDrops < 255) g.consecutiveDrops++;
  }
}

// Aktueller Backoff: ESPNOW_RESTART_BACKOFF_MS, verdoppelt je weiterem Neustart ohne Zustellung
unsigned long restartBackoffMs(const EspNowRestartGuard &g) {
  unsigned long ms = ESPNOW_RESTART_BACKOFF_MS;
  for (uint8_t i = 1; i < g.restartsWithoutDelivery && ms < ESPNOW_RESTART_BACKOFF_MAX_MS; i++) ms *= 2;
  return ms < ESPNOW_RESTART_BACKOFF_MAX_MS ? ms : ESPNOW_RESTART_BACKOFF_MAX_MS;
}

// Neustart nur im Tastaturmodus mit laufendem ESP-NOW und nicht während der Deep-Sleep-Vorbereitung
bool espNowRestartAllowed(bool configMode, bool deepSleepPending, bool espNowReady) {
  return !configMode && !deepSleepPending && espNowReady;
}

// allowed: Ergebnis von espNowRestartAllowed
bool shouldRestartEspNow(const EspNowRestartGuard &g, unsigned long nowMs, bool allowed) {
  if (!allowed || g.consecutiveDrops < ESPNOW_RESTART_DROPS) return false;
  if (nowMs - g.linkDownSinceMs < ESPNOW_RESTART_DOWN_MS) return false;
  return !g.everRestarted || (nowMs - g.lastRestartMs) >= restartBackoffMs(g);
}

// Nach dem Neustart aufrufen: Fehlerzählung beginnt von vorn, der Backoff läuft ab nowMs
void restartGuardOnRestart(EspNowRestartGuard &g, unsigned long nowMs) {
  g.consecutiveDrops = 0;
  g.lastRestartMs = nowMs;
  g.everRestarted = true;
  if (g.restartsWithoutDelivery < 255) g.restartsWithoutDelivery++;
}

// SPLIT_OP_ACTIVITY vom Master (Flag aus dem Empfangs-Callback) als eigene Aktivität übernehmen.
// Rückgabe: true, wenn ein Paket eingetroffen ist; der Aufrufer beendet dann den Standby.
bool consumeMasterActivity(volatile bool &received, unsigned long nowMs, unsigned long &lastActivityMs) {
  if (!received) return false;
  received = false;
  lastActivityMs = nowMs;
  return true;
}

// SPLIT_OP_SLEEP vom Master (Flag aus dem Empfangs-Callback) prüfen und verbrauchen.
// Der Master sendet das Signal unmittelbar vor seinem eigenen enterDeepSleep(). Im Config Mode und solange
// lokal eine Taste gedrückt ist, wird die Anforderung verworfen (Tippen hat Vorrang).
inline bool consumeMasterSleepRequest(volatile bool &sleepRequested, bool configMode, bool anyKeyHeld) {
  if (!sleepRequested) return false;
  sleepRequested = false;
  return !configMode && !anyKeyHeld;
}

// Fehlgeschlagener ESP-NOW-Start beim Booten: höchstens ESPNOW_BOOT_RETRIES Board-Neustarts in Folge, dann läuft
// die Hälfte ohne ESP-NOW weiter (Config Mode und USB bleiben erreichbar, keine Neustart-Schleife, die den Akku
// leert). rtcState liegt in RTC_NOINIT und gilt nur nach einem Software-Reset (sonst Zufallswert).
// Rückgabe: true = jetzt neu starten.
#define ESPNOW_BOOT_RETRIES 3
#define ESPNOW_BOOT_RETRY_MAGIC 0xE5B0A000UL

inline bool espNowBootRetryAllowed(uint32_t &rtcState, bool softwareReset) {
  uint32_t count = (softwareReset && (rtcState & 0xFFFFFF00UL) == ESPNOW_BOOT_RETRY_MAGIC) ? (rtcState & 0xFF) : 0;
  if (count >= ESPNOW_BOOT_RETRIES) {
    rtcState = 0;
    return false;
  }
  rtcState = ESPNOW_BOOT_RETRY_MAGIC | (count + 1);
  return true;
}
