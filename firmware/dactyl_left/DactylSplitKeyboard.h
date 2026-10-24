#pragma once
/*
 * DactylSplitKeyboard.h — "bleKeyboard" der linken Hälfte.
 *
 * Bietet die Methoden, die DactylLogic.h auf bleKeyboard aufruft, und reiht jeden Aufruf als
 * SplitHidEvent in die Sendewarteschlange (DactylLeftLogic.h). Die rechte Hälfte führt die
 * Ereignisse auf ihrer BLE-HID-Verbindung zum Mac aus.
 *
 * Benötigt vorher: MediaKeyReport (DactylKeycodes.h), SplitHidEvent (DactylSplitHid.h),
 * SplitSendQueue + queuePush (DactylLeftLogic.h) und millis().
 */

// Ohne erfolgreichen Sende-Callback so lange gilt der Master als nicht erreichbar
#define SPLIT_LINK_DOWN_MS 2000

class DactylSplitKeyboard {
public:
  explicit DactylSplitKeyboard(SplitSendQueue &queue) : q(queue) {}

  // Vom Sende-Ergebnis in loop() aufgerufen.
  // Während eines Ausfalls (isConnected() false) sendet DactylLogic.h kein Loslassen. Der Master löst linke
  // Eingaben aber erst nach SPLIT_LINK_TIMEOUT_MS (3 s) > SPLIT_LINK_DOWN_MS (2 s). Kehrt der Link in dieser
  // Lücke zurück, hielte der Master eine schon losgelassene Taste: RELEASE_ALL gleicht beide Seiten ab.
  void onSendResult(bool success, unsigned long nowMs) {
    if (!success) return;
    bool wasDown = everAcked && (nowMs - lastAckMs) >= SPLIT_LINK_DOWN_MS;
    lastAckMs = nowMs;
    everAcked = true;
    if (wasDown) releaseAll();
  }

  // Wie bei BLE: ohne erreichbaren Master gehen keine Tasten verloren in einer Warteschlange,
  // sondern DactylLogic.h sendet erst gar nicht (gleiches Verhalten wie ein getrennter Mac).
  bool isConnected() const {
    return everAcked && (millis() - lastAckMs) < SPLIT_LINK_DOWN_MS;
  }

  // Einmal-Aktionen (write, mouseClick) gehen als PRESS + RELEASE an den Master: ein Retry stellt ein Paket
  // evtl. doppelt zu, PRESS und RELEASE sind dort idempotent, *_WRITE und MOUSE_CLICK nicht.
  // held spiegelt, was diese Hälfte gedrückt hat; eine Einmal-Aktion auf gehaltener Eingabe entfällt
  // (wie KEY_WRITE/MOUSE_CLICK auf dem Master), sonst löste ihr RELEASE die gehaltene Eingabe.
  size_t press(uint8_t k) {
    if (k) splitSetKey(held, k, true);
    return push(SPLIT_OP_KEY_PRESS, k);
  }
  size_t release(uint8_t k) {
    if (k) splitSetKey(held, k, false);
    return push(SPLIT_OP_KEY_RELEASE, k);
  }
  size_t write(uint8_t k) {
    if (k == 0 || splitSetHasKey(held, k)) return 0;
    size_t n = push(SPLIT_OP_KEY_PRESS, k);
    push(SPLIT_OP_KEY_RELEASE, k);
    return n;
  }

  size_t press(const MediaKeyReport k) {
    held.media |= splitMediaBits(k);
    return push(SPLIT_OP_MEDIA_PRESS, splitMediaBits(k));
  }
  size_t release(const MediaKeyReport k) {
    held.media &= (uint16_t)~splitMediaBits(k);
    return push(SPLIT_OP_MEDIA_RELEASE, splitMediaBits(k));
  }
  size_t write(const MediaKeyReport k) {
    uint16_t bits = splitMediaBits(k);
    if (bits == 0 || (bits & held.media)) return 0;
    size_t n = push(SPLIT_OP_MEDIA_PRESS, bits);
    push(SPLIT_OP_MEDIA_RELEASE, bits);
    return n;
  }

  void mousePress(uint8_t b) {
    held.mouse |= b;
    push(SPLIT_OP_MOUSE_PRESS, b);
  }
  void mouseRelease(uint8_t b) {
    held.mouse &= (uint8_t)~b;
    push(SPLIT_OP_MOUSE_RELEASE, b);
  }
  void mouseClick(uint8_t b) {
    if (b == 0 || (b & held.mouse)) return;
    push(SPLIT_OP_MOUSE_PRESS, b);
    push(SPLIT_OP_MOUSE_RELEASE, b);
  }
  void mouseScroll(int8_t wheel) {
    if (wheel != 0) pushEvent(makeSplitHidEvent(SPLIT_OP_MOUSE_SCROLL, 0, wheel));
  }

  void releaseAll() {
    splitSetClear(held);
    pushEvent(makeSplitHidEvent(SPLIT_OP_RELEASE_ALL));
  }

  // Anzahl der Ereignisse, die eine volle Warteschlange verworfen hat
  uint32_t droppedEvents() const { return dropped; }

private:
  SplitSendQueue &q;
  SplitHeldSet held = {};
  unsigned long lastAckMs = 0;
  bool everAcked = false;
  uint32_t dropped = 0;

  size_t push(uint8_t op, uint16_t code) {
    if (code == 0) return 0;
    return pushEvent(makeSplitHidEvent(op, code)) ? 1 : 0;
  }

  bool pushEvent(const SplitHidEvent &ev) {
    if (queuePush(q, ev)) return true;
    dropped++;
    return false;
  }
};
