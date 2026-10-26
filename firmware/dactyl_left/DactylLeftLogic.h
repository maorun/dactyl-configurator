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
#include "../dactyl_right/DactylSplitHid.h"

#define LEFT_NUM_ROWS 6
#define LEFT_NUM_COLS 7
#define LEFT_DEBOUNCE_MS 5

// Zeilen von oben nach unten: Gelb, Orange, Grün, Braun, Blau, Lila (Daumen)
static const uint8_t LEFT_ROW_PINS[LEFT_NUM_ROWS] = {23, 19, 18, 17, 16, 4};

// Spalten von links (außen) nach rechts (innen): Lila, Braun, Grün, Orange, Gelb, Rot, Blau (nur Daumen)
static const uint8_t LEFT_COL_PINS[LEFT_NUM_COLS] = {13, 14, 27, 26, 33, 32, 25};

// RTC-fähige GPIOs des ESP32 (nur diese können per Ext1 aus dem Deep Sleep wecken)
inline bool isRtcGpio(uint8_t gpio) {
  static const uint8_t rtc[] = {0, 2, 4, 12, 13, 14, 15, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39};
  for (uint8_t g : rtc) if (g == gpio) return true;
  return false;
}

// Feste Basis-MAC der linken Hälfte (Wi-Fi-STA-MAC = Basis-MAC)
#define LEFT_BASE_MAC SPLIT_LEFT_MAC

struct DebouncedKey {
  bool stable;
  bool lastRaw;
  unsigned long lastChangeMs;
};

static DebouncedKey leftKeys[LEFT_NUM_ROWS][LEFT_NUM_COLS] = {};

void resetLeftKeys() {
  for (int r = 0; r < LEFT_NUM_ROWS; r++) {
    for (int c = 0; c < LEFT_NUM_COLS; c++) {
      leftKeys[r][c] = {false, false, 0};
    }
  }
}

// Liefert true, wenn der Rohwert debounceMsArg lang stabil ist und vom gemeldeten Zustand abweicht.
// Der neue Zustand steht danach in leftKeys[r][c].stable. Die Firmware übergibt debounceMs (NVS-Setting).
bool updateLeftKey(int r, int c, bool rawPressed, unsigned long nowMs, unsigned long debounceMsArg = LEFT_DEBOUNCE_MS) {
  if (r < 0 || r >= LEFT_NUM_ROWS || c < 0 || c >= LEFT_NUM_COLS) return false;
  DebouncedKey &k = leftKeys[r][c];
  if (rawPressed != k.lastRaw) {
    k.lastRaw = rawPressed;
    k.lastChangeMs = nowMs;
    return false;
  }
  if (rawPressed != k.stable && (nowMs - k.lastChangeMs) >= debounceMsArg) {
    k.stable = rawPressed;
    return true;
  }
  return false;
}

// Sendewarteschlange: genau ein Paket ist unterwegs. Ein fehlgeschlagenes Paket wird bis zu
// ESPNOW_MAX_RETRIES-mal wiederholt, bevor es verworfen wird. Die Reihenfolge bleibt erhalten,
// damit ein UP nie vor seinem DOWN ankommt.
#define SPLIT_QUEUE_SIZE 64
#define ESPNOW_MAX_RETRIES 3
// Fehlt der Sende-Callback so lange, gilt das Paket als fehlgeschlagen
#define ESPNOW_SEND_TIMEOUT_MS 200
// Wartezeit vor einem Retry, damit ein voller Wi-Fi-Puffer (ESP_ERR_ESPNOW_NO_MEM) frei wird
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
};

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
  if (q.count >= SPLIT_QUEUE_SIZE) return false;
  q.items[(q.head + q.count) % SPLIT_QUEUE_SIZE] = ev;
  q.count++;
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

// Matrix-Position für den Live-Monitor am Master einreihen, nach den HID-Ereignissen der Taste.
// Ohne Link sendet die Hälfte nichts (wie DactylLogic.h ohne Master). Ein Ereignis, das die
// Warteschlangen-Grenze verwirft, zählt droppedCount. Rückgabe: true = eingereiht.
bool queueKeyEventDiagnostic(SplitSendQueue &q, bool linkUp, const SplitHidEvent &ev, uint32_t &droppedCount) {
  if (!linkUp) return false;
  if (queuePushDiagnostic(q, ev)) return true;
  droppedCount++;
  return false;
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
// Ein verworfenes Diagnose-Paket (KEY_EVENT) zählt nicht: es wird nie wiederholt und ist kein HID-Verlust.
void restartGuardOnOutcome(EspNowRestartGuard &g, SendOutcome outcome, unsigned long nowMs,
                           uint8_t op = SPLIT_OP_HEARTBEAT) {
  if (outcome == SEND_DELIVERED) {
    g.consecutiveDrops = 0;
    g.restartsWithoutDelivery = 0;
  } else if (outcome == SEND_DROPPED && op != SPLIT_OP_KEY_EVENT) {
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
