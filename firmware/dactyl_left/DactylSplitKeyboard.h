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

  // Vom Sende-Ergebnis in loop() aufgerufen
  void onSendResult(bool success, unsigned long nowMs) {
    if (success) {
      lastAckMs = nowMs;
      everAcked = true;
    }
  }

  // Wie bei BLE: ohne erreichbaren Master gehen keine Tasten verloren in einer Warteschlange,
  // sondern DactylLogic.h sendet erst gar nicht (gleiches Verhalten wie ein getrennter Mac).
  bool isConnected() const {
    return everAcked && (millis() - lastAckMs) < SPLIT_LINK_DOWN_MS;
  }

  size_t press(uint8_t k) { return push(SPLIT_OP_KEY_PRESS, k); }
  size_t release(uint8_t k) { return push(SPLIT_OP_KEY_RELEASE, k); }
  size_t write(uint8_t k) { return push(SPLIT_OP_KEY_WRITE, k); }

  size_t press(const MediaKeyReport k) { return push(SPLIT_OP_MEDIA_PRESS, splitMediaBits(k)); }
  size_t release(const MediaKeyReport k) { return push(SPLIT_OP_MEDIA_RELEASE, splitMediaBits(k)); }
  size_t write(const MediaKeyReport k) { return push(SPLIT_OP_MEDIA_WRITE, splitMediaBits(k)); }

  void mousePress(uint8_t b) { push(SPLIT_OP_MOUSE_PRESS, b); }
  void mouseRelease(uint8_t b) { push(SPLIT_OP_MOUSE_RELEASE, b); }
  void mouseClick(uint8_t b) { push(SPLIT_OP_MOUSE_CLICK, b); }
  void mouseScroll(int8_t wheel) {
    if (wheel != 0) pushEvent(makeSplitHidEvent(SPLIT_OP_MOUSE_SCROLL, 0, wheel));
  }

  void releaseAll() { pushEvent(makeSplitHidEvent(SPLIT_OP_RELEASE_ALL)); }

  // Anzahl der Ereignisse, die eine volle Warteschlange verworfen hat
  uint32_t droppedEvents() const { return dropped; }

private:
  SplitSendQueue &q;
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
