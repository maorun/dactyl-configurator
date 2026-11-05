#pragma once
/*
 * DactylHostLeds.h — LED-Zustand des Hosts (Num Lock, Caps Lock, Scroll Lock).
 * Der Host schreibt den Output-Report der Tastatur (Report-ID 1, ein Byte, Bits 0..2). Die Funktionen hier
 * haben keine Arduino- oder BLE-Abhängigkeit, damit die Host-Tests sie wie die Firmware ausführen.
 * onWrite (BLE-Task) ruft nur hostLedsOnReport(); loop() druckt die Zeile (hostLedsTakeLine) und schaltet die LED.
 */
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

#define HOST_LED_NUM 0x01
#define HOST_LED_CAPS 0x02
#define HOST_LED_SCROLL 0x04
#define HOST_LED_MASK 0x07

struct HostLedsState {
  volatile uint8_t bits = 0;  // zuletzt gemeldete LED-Bits des Hosts
  volatile uint8_t seq = 0;   // zählt jede Änderung von bits (Überlauf ist gewollt)
  uint8_t printedSeq = 0;     // Stand von seq, den loop() zuletzt ausgegeben hat
};

// Output-Report des Hosts übernehmen. Rückgabe true, wenn sich der Zustand ändert. Ein leerer Report ändert nichts.
inline bool hostLedsOnReport(HostLedsState &st, const uint8_t *data, size_t len) {
  if (!data || len < 1) return false;
  uint8_t b = data[0] & HOST_LED_MASK;
  if (b == st.bits) return false;
  st.bits = b;
  st.seq = (uint8_t)(st.seq + 1);
  return true;
}

// Host getrennt: keine LED gilt mehr
inline void hostLedsReset(HostLedsState &st) {
  if (st.bits == 0) return;
  st.bits = 0;
  st.seq = (uint8_t)(st.seq + 1);
}

// {"num":0|1,"caps":0|1,"scroll":0|1}; Rückgabe wie snprintf
inline int hostLedsJson(char *buf, size_t size, uint8_t bits) {
  return snprintf(buf, size, "{\"num\":%d,\"caps\":%d,\"scroll\":%d}", (bits & HOST_LED_NUM) ? 1 : 0,
                  (bits & HOST_LED_CAPS) ? 1 : 0, (bits & HOST_LED_SCROLL) ? 1 : 0);
}

// Zeile "HOST_LEDS:{...}" für USB-Serial, wenn sich der Zustand seit der letzten Ausgabe geändert hat
// bits: Momentaufnahme von st.bits, die der Aufrufer auch für die LED nutzt (ein Lesen, kein Auseinanderlaufen)
inline bool hostLedsTakeLine(HostLedsState &st, uint8_t bits, char *buf, size_t size) {
  if (st.printedSeq == st.seq) return false;
  st.printedSeq = st.seq;
  int n = snprintf(buf, size, "HOST_LEDS:");
  if (n < 0 || (size_t)n >= size) return false;
  hostLedsJson(buf + n, size - (size_t)n, bits);
  return true;
}

// Onboard-LED (GPIO 22, aktiv LOW beim LOLIN32 Lite): an, solange Caps Lock gilt und das Setting aktiv ist.
// Rückgabe: Pegel für digitalWrite.
#define HOST_LED_PIN 22
inline uint8_t hostLedPinLevel(uint8_t bits, bool enabled) {
  bool on = enabled && (bits & HOST_LED_CAPS);
  return on ? 0 : 1;
}
