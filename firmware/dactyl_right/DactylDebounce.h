// Eager debounce per key. Shared by both halves (DactylLogic.h, DactylLeftLogic.h).
// A press is reported in the first pass that sees it. The key then ignores all changes for debounceMs.
// A release is reported after the key stayed open for debounceMs without a break.
#pragma once

struct EagerDebounceKey {
  bool stable;              // reported state
  bool open;                // a release candidate is running
  unsigned long pressMs;    // time of the reported press
  unsigned long openMs;     // start of the release candidate
};

inline void eagerDebounceReset(EagerDebounceKey &k) {
  k.stable = false;
  k.open = false;
  k.pressMs = 0;
  k.openMs = 0;
}

// Returns the reported state of the key after this sample.
inline bool eagerDebounceUpdate(EagerDebounceKey &k, bool rawPressed, unsigned long nowMs, unsigned long debounceMs) {
  if (!k.stable) {
    if (rawPressed) {
      k.stable = true;
      k.open = false;
      k.pressMs = nowMs;
    }
    return k.stable;
  }
  if ((nowMs - k.pressMs) < debounceMs) return true; // bounce window after the press
  if (rawPressed) {
    k.open = false;
    return true;
  }
  if (!k.open) {
    k.open = true;
    k.openMs = nowMs;
  }
  if ((nowMs - k.openMs) >= debounceMs) {
    k.stable = false;
    k.open = false;
  }
  return k.stable;
}
