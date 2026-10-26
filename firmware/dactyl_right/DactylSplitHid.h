#pragma once
/*
 * DactylSplitHid.h — ESP-NOW-Protokoll zwischen linker Hälfte (Sender) und rechter Hälfte (Master).
 *
 * Die linke Hälfte löst Layer, Tap-Hold, Combos und Key-Pairs selbst auf (DactylLogic.h) und sendet
 * nur fertige HID-Operationen. Der Master führt sie auf seiner BLE-HID-Verbindung zum Mac aus.
 *
 * Eingebunden von firmware/dactyl_left/dactyl_left.ino, firmware/dactyl_right/dactyl_right.ino und
 * den Host-Tests (firmware/tests/test_split_hid.cpp). Keine Arduino- oder ESP-IDF-Abhängigkeit.
 */
#include <stdint.h>
#include <string.h>
#include "DactylKeycodes.h" // dactylAsciiToHid, KEY_LEFT_SHIFT (implizites Shift großer/gesetzter Zeichen)

#define SPLIT_ESPNOW_CHANNEL 1

// Wi-Fi-STA-MAC (= Basis-MAC) beider Hälften
static const uint8_t SPLIT_MASTER_MAC[6] = {0x2E, 0xBC, 0xBB, 0x81, 0x61, 0xA6};
static const uint8_t SPLIT_LEFT_MAC[6] = {0x2E, 0xBC, 0xBB, 0x81, 0x61, 0xB0};

// HID-Operationen. Neue Werte nur anhängen, damit gemischte Firmwarestände sich verstehen.
enum SplitHidOp : uint8_t {
  SPLIT_OP_HEARTBEAT = 0,     // Lebenszeichen (1 s), sonst ohne Wirkung
  SPLIT_OP_KEY_PRESS = 1,     // code = Tastatur-Code 1..255 (ASCII, Modifier, Sondertaste)
  SPLIT_OP_KEY_RELEASE = 2,
  SPLIT_OP_KEY_WRITE = 3,     // press + release
  SPLIT_OP_RELEASE_ALL = 4,   // löst alles, was die linke Hälfte gedrückt hält
  SPLIT_OP_MEDIA_PRESS = 5,   // code = 16-Bit-Media-Bitmaske (MediaKeyReport: low = [0], high = [1])
  SPLIT_OP_MEDIA_RELEASE = 6,
  SPLIT_OP_MEDIA_WRITE = 7,
  SPLIT_OP_MOUSE_PRESS = 8,   // code = Maus-Buttonmaske (1..7)
  SPLIT_OP_MOUSE_RELEASE = 9,
  SPLIT_OP_MOUSE_CLICK = 10,
  SPLIT_OP_MOUSE_SCROLL = 11, // arg = Scrollschritte (int8, ungleich 0)
  SPLIT_OP_ACTIVITY = 12,     // nur Master -> links: Tippen am Master, setzt den Inaktivitäts-Timer links zurück
  SPLIT_OP_KEY_EVENT = 13,    // Diagnose: Matrix-Position links (splitKeyEventCode), ohne HID-Wirkung
  SPLIT_OP_COUNT = 14
};

struct __attribute__((packed)) SplitHidEvent {
  uint8_t op;
  int8_t arg;
  uint16_t code;
};
static_assert(sizeof(SplitHidEvent) == 4, "SplitHidEvent muss 4 Byte groß sein");

inline SplitHidEvent makeSplitHidEvent(uint8_t op, uint16_t code = 0, int8_t arg = 0) {
  SplitHidEvent ev;
  ev.op = op;
  ev.arg = arg;
  ev.code = code;
  return ev;
}

// Matrix-Ereignis der linken Hälfte für den Live-Monitor der App. code: Bit 15 = gedrückt,
// Bits 8..10 = aktive Ebene beim Ereignis, Bits 4..6 = Zeile, Bits 0..2 = Spalte; alle übrigen Bits 0.
#define SPLIT_KEY_EVENT_ROWS 6
#define SPLIT_KEY_EVENT_COLS 7
#define SPLIT_KEY_EVENT_MASK 0x8777

inline uint16_t splitKeyEventCode(uint8_t row, uint8_t col, bool pressed, uint8_t layer) {
  return (uint16_t)((pressed ? 0x8000 : 0) | ((layer & 7) << 8) | ((row & 7) << 4) | (col & 7));
}
inline uint8_t splitKeyEventRow(uint16_t code) { return (uint8_t)((code >> 4) & 7); }
inline uint8_t splitKeyEventCol(uint16_t code) { return (uint8_t)(code & 7); }
inline uint8_t splitKeyEventLayer(uint16_t code) { return (uint8_t)((code >> 8) & 7); }
inline bool splitKeyEventPressed(uint16_t code) { return (code & 0x8000) != 0; }

// Wertebereich je Operation prüfen. Ungültige Pakete führt der Master nie aus.
inline bool isValidSplitHidEvent(const SplitHidEvent &ev) {
  switch (ev.op) {
    case SPLIT_OP_HEARTBEAT:
    case SPLIT_OP_RELEASE_ALL:
      return ev.code == 0 && ev.arg == 0;
    case SPLIT_OP_KEY_PRESS:
    case SPLIT_OP_KEY_RELEASE:
    case SPLIT_OP_KEY_WRITE:
      return ev.code >= 1 && ev.code <= 0xFF && ev.arg == 0;
    case SPLIT_OP_MEDIA_PRESS:
    case SPLIT_OP_MEDIA_RELEASE:
    case SPLIT_OP_MEDIA_WRITE:
      return ev.code != 0 && ev.arg == 0;
    case SPLIT_OP_MOUSE_PRESS:
    case SPLIT_OP_MOUSE_RELEASE:
    case SPLIT_OP_MOUSE_CLICK:
      return ev.code >= 1 && ev.code <= 0x07 && ev.arg == 0;
    case SPLIT_OP_MOUSE_SCROLL:
      return ev.code == 0 && ev.arg != 0;
    case SPLIT_OP_KEY_EVENT:
      return ev.arg == 0 && (ev.code & (uint16_t)~SPLIT_KEY_EVENT_MASK) == 0 &&
             splitKeyEventRow(ev.code) < SPLIT_KEY_EVENT_ROWS && splitKeyEventCol(ev.code) < SPLIT_KEY_EVENT_COLS;
    default:
      return false;
  }
}

// Prüft Absender, Länge und Inhalt eines empfangenen Pakets. Nur ein gültiges Paket landet in out.
inline bool parseSplitHidPacket(const uint8_t *srcMac, const uint8_t *data, int len, SplitHidEvent &out) {
  if (srcMac == nullptr || data == nullptr) return false;
  if (memcmp(srcMac, SPLIT_LEFT_MAC, sizeof(SPLIT_LEFT_MAC)) != 0) return false;
  if (len != (int)sizeof(SplitHidEvent)) return false;
  SplitHidEvent ev;
  memcpy(&ev, data, sizeof(ev));
  if (!isValidSplitHidEvent(ev)) return false;
  out = ev;
  return true;
}

// -----------------------------------------------------------------------------
// Rückrichtung Master -> links: Aktivität für synchronisierte Inaktivitäts-Timer
// -----------------------------------------------------------------------------
// Der Master meldet eigenes Tippen höchstens alle SPLIT_ACTIVITY_INTERVAL_MS. Links setzt ein gültiges
// ACTIVITY-Paket den Timer für Standby und Deep Sleep zurück, ohne HID-Wirkung. Kein Retry: Ein verlorenes
// Paket verschiebt das Einschlafen nur um ein Intervall.
#define SPLIT_ACTIVITY_INTERVAL_MS 10000

// Prüft ein Paket an die linke Hälfte: nur vom Master, nur ACTIVITY ohne Werte
inline bool parseSplitActivityPacket(const uint8_t *srcMac, const uint8_t *data, int len) {
  if (srcMac == nullptr || data == nullptr) return false;
  if (memcmp(srcMac, SPLIT_MASTER_MAC, sizeof(SPLIT_MASTER_MAC)) != 0) return false;
  if (len != (int)sizeof(SplitHidEvent)) return false;
  SplitHidEvent ev;
  memcpy(&ev, data, sizeof(ev));
  return ev.op == SPLIT_OP_ACTIVITY && ev.code == 0 && ev.arg == 0;
}

// Drosselung auf dem Master. Eine Taste innerhalb des Intervalls bleibt vorgemerkt und geht nach seinem
// Ablauf raus, damit die letzte Aktivität die linke Hälfte erreicht.
struct SplitActivityThrottle {
  bool pending;
  bool sentOnce;
  unsigned long lastSentMs;
};

inline void splitActivityReset(SplitActivityThrottle &t) {
  memset(&t, 0, sizeof(t));
}

inline void splitActivityNote(SplitActivityThrottle &t) {
  t.pending = true;
}

// Liefert true, wenn jetzt ein ACTIVITY-Paket zu senden ist (und merkt den Versand vor)
inline bool splitActivityTake(SplitActivityThrottle &t, unsigned long nowMs) {
  if (!t.pending) return false;
  if (t.sentOnce && (nowMs - t.lastSentMs) < SPLIT_ACTIVITY_INTERVAL_MS) return false;
  t.pending = false;
  t.sentOnce = true;
  t.lastSentMs = nowMs;
  return true;
}

// Scrollen hat keinen Zustand: ein doppelt zugestelltes Retry-Paket scrollte doppelt. Ein verlorener
// Scrollschritt ist harmloser, deshalb wiederholt die linke Hälfte MOUSE_SCROLL nicht. Ein doppeltes
// KEY_EVENT zählte in Heatmap und Statistik doppelt; ein verlorenes kostet nur eine Anzeige.
inline bool splitEventRetryable(const SplitHidEvent &ev) {
  return ev.op != SPLIT_OP_MOUSE_SCROLL && ev.op != SPLIT_OP_KEY_EVENT;
}

inline uint16_t splitMediaBits(const uint8_t report[2]) {
  return (uint16_t)(report[0] | (report[1] << 8));
}

inline void splitMediaReport(uint16_t bits, uint8_t report[2]) {
  report[0] = (uint8_t)(bits & 0xFF);
  report[1] = (uint8_t)(bits >> 8);
}

// -----------------------------------------------------------------------------
// Master: Zustand der gehaltenen Eingaben je Hälfte
// -----------------------------------------------------------------------------
// Ein Retry der linken Seite kann ein Paket doppelt zustellen; ein Press setzt nur den Zustand, ein Release
// löst nur Gedrücktes. Bleiben die Pakete SPLIT_LINK_TIMEOUT_MS lang aus, löst der Master genau die linken
// Eingaben (keine hängende Taste bei Funkausfall).
#define SPLIT_LINK_TIMEOUT_MS 3000

struct SplitHeldSet {
  uint8_t keys[32];     // Bitfeld für Tastatur-Codes 0..255
  uint16_t media;       // Media-Bitmaske
  uint8_t mouse;        // Maus-Buttons
};

inline void splitSetClear(SplitHeldSet &s) {
  memset(&s, 0, sizeof(s));
}

inline bool splitSetHasKey(const SplitHeldSet &s, uint8_t code) {
  return (s.keys[code >> 3] >> (code & 7)) & 1;
}

inline void splitSetKey(SplitHeldSet &s, uint8_t code, bool held) {
  uint8_t bit = (uint8_t)(1u << (code & 7));
  if (held) s.keys[code >> 3] |= bit;
  else s.keys[code >> 3] &= (uint8_t)~bit;
}

inline bool splitSetAny(const SplitHeldSet &s) {
  for (uint8_t b : s.keys) if (b) return true;
  return s.media != 0 || s.mouse != 0;
}

struct SplitLeftHeld {
  SplitHeldSet set;
  unsigned long lastRxMs;
  bool linkUp;
};

inline void splitHeldReset(SplitLeftHeld &h) {
  memset(&h, 0, sizeof(h));
}

inline bool splitHeldKey(const SplitLeftHeld &h, uint8_t code) {
  return splitSetHasKey(h.set, code);
}

inline bool splitHeldAny(const SplitLeftHeld &h) {
  return splitSetAny(h.set);
}

// HID-Ausgabe, die der Master für jede Operation der linken Hälfte ausführt
struct SplitHidSink {
  virtual void leftKeyPress(uint8_t code) = 0;
  virtual void leftKeyRelease(uint8_t code) = 0;
  virtual void leftMediaPress(uint16_t bits) = 0;
  virtual void leftMediaRelease(uint16_t bits) = 0;
  virtual void leftMousePress(uint8_t buttons) = 0;
  virtual void leftMouseRelease(uint8_t buttons) = 0;
  virtual void leftMouseClick(uint8_t buttons) = 0;
  virtual void leftMouseScroll(int8_t steps) = 0;
  virtual ~SplitHidSink() {}
};

// Löst alles, was die linke Hälfte gedrückt hält, und nur das
inline void splitReleaseHeld(SplitLeftHeld &h, SplitHidSink &sink) {
  SplitHeldSet held = h.set;
  splitSetClear(h.set);
  for (int code = 1; code < 256; code++) {
    if (splitSetHasKey(held, (uint8_t)code)) sink.leftKeyRelease((uint8_t)code);
  }
  for (int bit = 0; bit < 16; bit++) {
    if (held.media & (1u << bit)) sink.leftMediaRelease((uint16_t)(1u << bit));
  }
  if (held.mouse) sink.leftMouseRelease(held.mouse);
}

// Führt ein bereits geprüftes Ereignis aus. Liefert true, wenn eine HID-Ausgabe erfolgte.
// Der Zustand wird vor dem Aufruf der Senke aktualisiert, damit die Senke den neuen Besitz sieht.
inline bool splitApplyHidEvent(SplitLeftHeld &h, const SplitHidEvent &ev, unsigned long nowMs, SplitHidSink &sink) {
  h.lastRxMs = nowMs;
  h.linkUp = true;
  SplitHeldSet &s = h.set;
  uint8_t code8 = (uint8_t)ev.code;
  switch (ev.op) {
    case SPLIT_OP_HEARTBEAT:
      return false;
    case SPLIT_OP_KEY_PRESS:
      if (splitSetHasKey(s, code8)) return false;
      splitSetKey(s, code8, true);
      sink.leftKeyPress(code8);
      return true;
    case SPLIT_OP_KEY_RELEASE:
      if (!splitSetHasKey(s, code8)) return false;
      splitSetKey(s, code8, false);
      sink.leftKeyRelease(code8);
      return true;
    case SPLIT_OP_KEY_WRITE:
      // Ein bereits gehaltener Code wird nicht getippt, sonst löste das Release die gehaltene Taste
      if (splitSetHasKey(s, code8)) return false;
      sink.leftKeyPress(code8);
      sink.leftKeyRelease(code8);
      return true;
    case SPLIT_OP_RELEASE_ALL:
      if (!splitSetAny(s)) return false;
      splitReleaseHeld(h, sink);
      return true;
    case SPLIT_OP_MEDIA_PRESS: {
      uint16_t add = ev.code & (uint16_t)~s.media;
      if (!add) return false;
      s.media |= add;
      sink.leftMediaPress(add);
      return true;
    }
    case SPLIT_OP_MEDIA_RELEASE: {
      uint16_t rel = ev.code & s.media;
      if (!rel) return false;
      s.media &= (uint16_t)~rel;
      sink.leftMediaRelease(rel);
      return true;
    }
    case SPLIT_OP_MEDIA_WRITE:
      if (ev.code & s.media) return false;
      sink.leftMediaPress(ev.code);
      sink.leftMediaRelease(ev.code);
      return true;
    case SPLIT_OP_MOUSE_PRESS: {
      uint8_t add = (uint8_t)(code8 & ~s.mouse);
      if (!add) return false;
      s.mouse |= add;
      sink.leftMousePress(add);
      return true;
    }
    case SPLIT_OP_MOUSE_RELEASE: {
      uint8_t rel = (uint8_t)(code8 & s.mouse);
      if (!rel) return false;
      s.mouse &= (uint8_t)~rel;
      sink.leftMouseRelease(rel);
      return true;
    }
    case SPLIT_OP_MOUSE_CLICK:
      if (code8 & s.mouse) return false;
      sink.leftMouseClick(code8);
      return true;
    case SPLIT_OP_MOUSE_SCROLL:
      sink.leftMouseScroll(ev.arg);
      return true;
    default:
      return false;
  }
}

// Regelmäßig aus loop() aufrufen. Liefert true, wenn der Link gerade ausgefallen ist.
inline bool splitCheckLinkTimeout(SplitLeftHeld &h, unsigned long nowMs, SplitHidSink &sink) {
  if (!h.linkUp || (nowMs - h.lastRxMs) < SPLIT_LINK_TIMEOUT_MS) return false;
  h.linkUp = false;
  splitReleaseHeld(h, sink);
  return true;
}

// -----------------------------------------------------------------------------
// Master: gemeinsamer HID-Report mit Besitz pro Hälfte
// -----------------------------------------------------------------------------
// Beide Hälften teilen sich einen HID-Report. Eine Eingabe wird dort erst gelöst, wenn keine Hälfte sie
// mehr hält; releaseAll() der rechten Seite lässt linke Eingaben gedrückt (ein Report, kein kurzes Loslassen).
//
// Hid ist die BLE-HID-Klasse (DactylBleComposite) oder ein Test-Double. Benötigt: press/release/write für
// uint8_t und const uint8_t[2], mousePress, mouseRelease, mouseClick, mouseScroll, releaseAll,
// beginReportBatch und endReportBatch (Reports sammeln und einmal senden).
// Rechte Seite: DactylLogic.h ruft press/release/write/releaseAll/mouse* auf. Linke Seite: SplitHidSink.
template <class Hid>
class SplitArbitratedKeyboard : public Hid, public SplitHidSink {
public:
  using Hid::Hid;

  // Gehaltene Eingaben der linken Hälfte inkl. Link-Zustand (für splitApplyHidEvent)
  SplitLeftHeld splitLeft = {};

  // --- Rechte Hälfte (DactylLogic.h) ---
  size_t press(uint8_t k) {
    splitSetKey(right, k, true);
    return Hid::press(k);
  }
  size_t release(uint8_t k) {
    splitSetKey(right, k, false);
    if (splitSetHasKey(splitLeft.set, k)) return 1;
    return releaseKeepingShift(k, splitLeft.set);
  }
  size_t write(uint8_t k) {
    size_t p = press(k);
    release(k);
    return p;
  }
  size_t press(const uint8_t k[2]) {
    right.media |= splitMediaBits(k);
    return Hid::press(k);
  }
  size_t release(const uint8_t k[2]) {
    uint16_t bits = splitMediaBits(k);
    right.media &= (uint16_t)~bits;
    uint16_t rel = bits & (uint16_t)~splitLeft.set.media;
    if (!rel) return 1;
    uint8_t r[2];
    splitMediaReport(rel, r);
    return Hid::release(r);
  }
  size_t write(const uint8_t k[2]) {
    size_t p = press(k);
    release(k);
    return p;
  }
  void mousePress(uint8_t b) {
    right.mouse |= b;
    Hid::mousePress(b);
  }
  void mouseRelease(uint8_t b) {
    right.mouse &= (uint8_t)~b;
    uint8_t rel = (uint8_t)(b & ~splitLeft.set.mouse);
    if (rel) Hid::mouseRelease(rel);
  }
  void mouseClick(uint8_t b) {
    // Ein Klick löste einen von der anderen Hälfte gehaltenen Button
    if (b & splitLeft.set.mouse) return;
    Hid::mouseClick(b);
  }
  void releaseAll() {
    splitSetClear(right);
    if (!splitSetAny(splitLeft.set)) {
      Hid::releaseAll();
      return;
    }
    Hid::beginReportBatch();
    Hid::releaseAll();
    pressSet(splitLeft.set);
    Hid::endReportBatch();
  }

  // Ohne Host (Mac getrennt) alle Zustände und den Report leeren. Physisch gehaltene Tasten müssen danach
  // neu gedrückt werden; das verhindert hängende Tasten nach dem Wiederverbinden.
  void splitResetForHostLoss() {
    splitSetClear(right);
    splitSetClear(splitLeft.set);
    Hid::releaseAll();
  }

  const SplitHeldSet &rightHeld() const { return right; }

  // --- Linke Hälfte (SplitHidSink, Zustand ist vorher aktualisiert) ---
  void leftKeyPress(uint8_t code) override { Hid::press(code); }
  void leftKeyRelease(uint8_t code) override {
    if (!splitSetHasKey(right, code)) releaseKeepingShift(code, right);
  }
  void leftMediaPress(uint16_t bits) override {
    uint8_t r[2];
    splitMediaReport(bits, r);
    Hid::press(r);
  }
  void leftMediaRelease(uint16_t bits) override {
    uint16_t rel = bits & (uint16_t)~right.media;
    if (!rel) return;
    uint8_t r[2];
    splitMediaReport(rel, r);
    Hid::release(r);
  }
  void leftMousePress(uint8_t b) override { Hid::mousePress(b); }
  void leftMouseRelease(uint8_t b) override {
    uint8_t rel = (uint8_t)(b & ~right.mouse);
    if (rel) Hid::mouseRelease(rel);
  }
  void leftMouseClick(uint8_t b) override {
    if (b & right.mouse) return;
    Hid::mouseClick(b);
  }
  void leftMouseScroll(int8_t steps) override { Hid::mouseScroll(steps); }

private:
  SplitHeldSet right = {};

  // Große und gesetzte ASCII-Zeichen ('A', '!') drücken implizit Shift; ihr Release löscht im Report das
  // Shift-Bit (DactylBleComposite::release), auch wenn die andere Hälfte Shift noch braucht.
  static bool impliesShift(uint8_t code) {
    return code < 0x80 && (dactylAsciiToHid(code) & DACTYL_ASCII_SHIFT);
  }
  static bool needsShift(const SplitHeldSet &s) {
    if (splitSetHasKey(s, KEY_LEFT_SHIFT)) return true;
    for (int code = 1; code < 0x80; code++) {
      if (splitSetHasKey(s, (uint8_t)code) && impliesShift((uint8_t)code)) return true;
    }
    return false;
  }
  // Release, das ein von other gehaltenes Shift erhält: linkes Shift bleibt im Report, solange other ein
  // gesetztes Zeichen hält; ein gesetztes Zeichen stellt Shift in demselben Report wieder her.
  size_t releaseKeepingShift(uint8_t code, const SplitHeldSet &other) {
    if (code == KEY_LEFT_SHIFT && needsShift(other)) return 1;
    if (!impliesShift(code) || !needsShift(other)) return Hid::release(code);
    Hid::beginReportBatch();
    size_t n = Hid::release(code);
    Hid::press(KEY_LEFT_SHIFT);
    Hid::endReportBatch();
    return n;
  }

  void pressSet(const SplitHeldSet &s) {
    for (int code = 1; code < 256; code++) {
      if (splitSetHasKey(s, (uint8_t)code)) Hid::press((uint8_t)code);
    }
    if (s.media) {
      uint8_t r[2];
      splitMediaReport(s.media, r);
      Hid::press(r);
    }
    if (s.mouse) Hid::mousePress(s.mouse);
  }
};

// -----------------------------------------------------------------------------
// Empfangsring Wi-Fi-Task -> loop() (Single Producer, Single Consumer)
// -----------------------------------------------------------------------------
#define SPLIT_RX_QUEUE_SIZE 64 // Zweierpotenz, damit der Index-Überlauf korrekt bleibt

struct SplitRxQueue {
  SplitHidEvent items[SPLIT_RX_QUEUE_SIZE];
  volatile uint32_t head; // schreibt nur der Wi-Fi-Task
  volatile uint32_t tail; // schreibt nur loop()
  volatile uint32_t dropped;
};
static_assert((SPLIT_RX_QUEUE_SIZE & (SPLIT_RX_QUEUE_SIZE - 1)) == 0, "SPLIT_RX_QUEUE_SIZE muss eine Zweierpotenz sein");

inline void splitRxReset(SplitRxQueue &q) {
  q.head = 0;
  q.tail = 0;
  q.dropped = 0;
}

inline bool splitRxPush(SplitRxQueue &q, const SplitHidEvent &ev) {
  uint32_t head = q.head;
  if (head - q.tail >= SPLIT_RX_QUEUE_SIZE) {
    q.dropped = q.dropped + 1;
    return false;
  }
  q.items[head % SPLIT_RX_QUEUE_SIZE] = ev;
  __atomic_thread_fence(__ATOMIC_RELEASE);
  q.head = head + 1;
  return true;
}

inline bool splitRxPop(SplitRxQueue &q, SplitHidEvent &out) {
  uint32_t tail = q.tail;
  if (q.head == tail) return false;
  __atomic_thread_fence(__ATOMIC_ACQUIRE);
  out = q.items[tail % SPLIT_RX_QUEUE_SIZE];
  __atomic_thread_fence(__ATOMIC_RELEASE);
  q.tail = tail + 1;
  return true;
}

// -----------------------------------------------------------------------------
// Master: Empfangssteuerung (aus loop() aufgerufen)
// -----------------------------------------------------------------------------
struct SplitRxReport {
  uint8_t applied;      // ausgeführte Ereignisse (für Aktivität und Ausgabe)
  bool linkLost;        // Link gerade ausgefallen, linke Eingaben gelöst
  bool overflow;        // Empfangsring war voll, linke Eingaben gelöst
  bool hostLost;        // Mac-Verbindung gerade verloren, alle Eingaben gelöst
};

// Ein Ereignis wird je ausgeführter HID-Operation gemeldet (Ausgabe/Aktivität in der Firmware)
typedef void (*SplitRxAppliedFn)(const SplitHidEvent &ev);

// Arbeitet den Empfangsring ab. hostReady = Mac verbunden und nicht im Config Mode.
// - Ohne Host wird nichts ausgeführt; der Link gilt trotzdem als lebendig. Beim Übergang
//   "Host bereit -> nicht bereit" werden alle Zustände geleert (keine hängende Taste nach Reconnect).
// - Ein neu verworfenes Paket (voller Ring) kann ein Release gewesen sein: alle linken Eingaben lösen.
// - KEY_EVENT ist reine Diagnose: onKeyEvent meldet es auch ohne Host, es zählt nicht als ausgeführt.
//   Höchstens SPLIT_KEY_EVENTS_PER_RX pro Aufruf: Jede Serial-Zeile blockiert loop(), eine Flut mit gefälschter
//   linker MAC soll das Tippen am Master nicht bremsen. Normales Tippen bleibt weit darunter.
#define SPLIT_KEY_EVENTS_PER_RX 8
template <class Kbd>
SplitRxReport splitProcessRx(Kbd &kbd, SplitRxQueue &q, uint32_t &droppedSeen, bool &hostWasReady,
                             bool hostReady, unsigned long nowMs, SplitRxAppliedFn onApplied,
                             SplitRxAppliedFn onKeyEvent = nullptr) {
  SplitRxReport rep = {0, false, false, false};
  if (!hostReady && hostWasReady) {
    kbd.splitResetForHostLoss();
    rep.hostLost = true;
  }
  hostWasReady = hostReady;

  // Zählerstand vor dem Abarbeiten lesen. Gelöst wird erst danach: Ein PRESS, der vor dem verworfenen
  // Paket im Ring lag, liefe sonst nach dem Lösen und bliebe gedrückt.
  uint32_t dropped = q.dropped;

  SplitHidEvent ev;
  uint8_t keyEvents = 0;
  while (splitRxPop(q, ev)) {
    if (ev.op == SPLIT_OP_KEY_EVENT) {
      kbd.splitLeft.lastRxMs = nowMs;
      kbd.splitLeft.linkUp = true;
      if (onKeyEvent && keyEvents < SPLIT_KEY_EVENTS_PER_RX) {
        keyEvents++;
        onKeyEvent(ev);
      }
      continue;
    }
    if (!hostReady) {
      kbd.splitLeft.lastRxMs = nowMs;
      kbd.splitLeft.linkUp = true;
      continue;
    }
    if (!splitApplyHidEvent(kbd.splitLeft, ev, nowMs, kbd)) continue;
    if (rep.applied < 255) rep.applied++;
    if (onApplied) onApplied(ev);
  }

  // Ein verworfenes Paket kann ein Release gewesen sein: Gedrücktes ist nicht mehr verlässlich
  if (dropped != droppedSeen) {
    droppedSeen = dropped;
    rep.overflow = true;
    if (hostReady) splitReleaseHeld(kbd.splitLeft, kbd);
  }
  if (splitCheckLinkTimeout(kbd.splitLeft, nowMs, kbd)) rep.linkLost = true;
  return rep;
}

