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
#define SPLIT_STANDBY_LINK_DOWN_MS 11000

class DactylSplitKeyboard {
public:
  explicit DactylSplitKeyboard(SplitSendQueue &queue) : q(queue) {}

  void setQuietStandby(bool quiet, unsigned long nowMs = 0) {
    unsigned long now = nowMs ? nowMs : millis();
    if (quiet) {
      lastQuietMs = now;
      hadQuietStandby = true;
    } else if (quietStandby) {
      lastQuietMs = now;
    }
    quietStandby = quiet;
  }

  void resetQuietStandby() {
    quietStandby = false;
    hadQuietStandby = false;
    lastQuietMs = 0;
  }

  unsigned long linkDownMs(unsigned long nowMs) const {
    if (quietStandby || (hadQuietStandby && (nowMs - lastQuietMs) < SPLIT_LINK_DOWN_MS)) {
      return SPLIT_STANDBY_LINK_DOWN_MS;
    }
    return SPLIT_LINK_DOWN_MS;
  }

  // Vom Sende-Ergebnis in loop() aufgerufen.
  // Während eines Ausfalls (isConnected() false) sendet DactylLogic.h kein Loslassen. Der Master löst linke
  // Eingaben aber erst nach SPLIT_LINK_TIMEOUT_MS (3 s) > SPLIT_LINK_DOWN_MS (2 s). Kehrt der Link in dieser
  // Lücke zurück, hielte der Master eine schon losgelassene Taste: RELEASE_ALL gleicht beide Seiten ab.
  void onSendResult(bool success, unsigned long nowMs) {
    if (!success) return;
    unsigned long timeout = linkDownMs(nowMs);
    bool wasDown = everAcked && (nowMs - lastAckMs) >= timeout;
    lastAckMs = nowMs;
    everAcked = true;
    if (wasDown) releaseAll();
  }

  // Wie bei BLE: ohne erreichbaren Master gehen keine Tasten verloren in einer Warteschlange,
  // sondern DactylLogic.h sendet erst gar nicht (gleiches Verhalten wie ein getrennter Mac).
  bool isConnected(unsigned long nowMs) const {
    return everAcked && (nowMs - lastAckMs) < linkDownMs(nowMs);
  }

  bool isConnected() const {
    return isConnected(millis());
  }

  // Einmal-Aktionen (write, mouseClick) gehen als PRESS + RELEASE an den Master: ein Retry stellt ein Paket
  // evtl. doppelt zu, PRESS und RELEASE sind dort idempotent, *_WRITE und MOUSE_CLICK nicht.
  // held spiegelt, was diese Hälfte gedrückt hat; eine Einmal-Aktion auf gehaltener Eingabe entfällt
  // (wie KEY_WRITE/MOUSE_CLICK auf dem Master), sonst löste ihr RELEASE die gehaltene Eingabe.
  size_t press(uint8_t k) {
    if (k) splitSetKey(held, k, true);
    return push(SPLIT_OP_KEY_PRESS, k);
  }
  // Taste, die KEY_LOCK sperren darf: der Master wertet arg 1 aus (DactylKeyLock.h)
  size_t pressLockable(uint8_t k) {
    if (k) splitSetKey(held, k, true);
    return k && pushEvent(makeSplitHidEvent(SPLIT_OP_KEY_PRESS, k, 1)) ? 1 : 0;
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
    uint32_t bits = splitMediaBits(k);
    held.media |= bits;
    return pushMedia(SPLIT_OP_MEDIA_PRESS, bits);
  }
  size_t release(const MediaKeyReport k) {
    uint32_t bits = splitMediaBits(k);
    held.media &= ~bits;
    return pushMedia(SPLIT_OP_MEDIA_RELEASE, bits);
  }
  size_t write(const MediaKeyReport k) {
    uint32_t bits = splitMediaBits(k);
    if (bits == 0 || (bits & held.media)) return 0;
    size_t n = pushMedia(SPLIT_OP_MEDIA_PRESS, bits);
    pushMedia(SPLIT_OP_MEDIA_RELEASE, bits);
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
  void mousePressLockable(uint8_t b) {
    held.mouse |= b;
    if (b) pushEvent(makeSplitHidEvent(SPLIT_OP_MOUSE_PRESS, b, 1));
  }
  void mouseClick(uint8_t b) {
    if (b == 0 || (b & held.mouse)) return;
    pushEvent(makeSplitHidEvent(SPLIT_OP_MOUSE_PRESS, b, 1));
    push(SPLIT_OP_MOUSE_RELEASE, b);
  }
  void mouseScroll(int8_t wheel) {
    if (wheel != 0) pushEvent(makeSplitHidEvent(SPLIT_OP_MOUSE_SCROLL, 0, wheel));
  }
  void mousePan(int8_t pan) {
    if (pan != 0) pushEvent(makeSplitHidEvent(SPLIT_OP_MOUSE_SCROLL, 1, pan));
  }

  void mouseMove(int8_t x, int8_t y) {
    // Wie ein Diagnose-Ereignis: höchstens halbe Warteschlange, damit 100 Schritte/s einem Release nie den Platz
    // nehmen. Ein verworfener Schritt ist harmlos und zählt nicht als verlorenes Ereignis.
    if ((x != 0 || y != 0) && x != -128 && y != -128) {
      queuePushDiagnostic(q, makeSplitHidEvent(SPLIT_OP_MOUSE_MOVE, (uint8_t)y, x));
    }
  }

  // One-Shot-Modifier und Caps Word: den Zustand führt der Master
  void oneShotPress(uint8_t mask) {
    held.oneShot |= mask;
    push(SPLIT_OP_ONE_SHOT_PRESS, mask);
  }
  void oneShotRelease(uint8_t mask) {
    held.oneShot &= (uint8_t)~mask;
    push(SPLIT_OP_ONE_SHOT_RELEASE, mask);
  }
  void capsWordToggle() { pushEvent(makeSplitHidEvent(SPLIT_OP_CAPS_WORD_TOGGLE)); }
  void sentenceCaseToggle() { pushEvent(makeSplitHidEvent(SPLIT_OP_SENTENCE_CASE_TOGGLE)); }

  // Key lock: der Master führt Vormerkung und gesperrte Eingaben beider Hälften
  void keyLockArm() { pushEvent(makeSplitHidEvent(SPLIT_OP_KEY_LOCK)); }
  void keyLockReleaseAll() {}   // gesperrte Eingaben liegen auf dem Master; er löst sie bei Link-Ausfall und Standby

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
  bool quietStandby = false;
  unsigned long lastQuietMs = 0;
  bool hadQuietStandby = false;

  size_t pushMedia(uint8_t op, uint32_t bits) {
    if (bits == 0) return 0;
    return pushEvent(makeSplitMediaEvent(op, bits)) ? 1 : 0;
  }

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
