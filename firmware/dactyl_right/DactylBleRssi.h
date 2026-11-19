#pragma once
/*
 * DactylBleRssi.h — Signalstärke der BLE-Verbindung zum Mac (RSSI in dBm), nur auf dem Master.
 * loop() fragt alle BLE_RSSI_INTERVAL_MS per esp_ble_gap_read_rssi() ab; das Ergebnis kommt als GAP-Event
 * ESP_GAP_BLE_READ_RSSI_COMPLETE_EVT im BLE-Task und landet über bleRssiOnResult() in diesem Zustand.
 * Die Funktionen haben keine Arduino- oder BLE-Abhängigkeit, damit die Host-Tests sie wie die Firmware ausführen.
 * Die Zeile "BLE_RSSI:<dBm>" geht nur über USB-Serial, nie über BLE. "BLE_RSSI:none" meldet, dass kein Wert mehr gilt.
 * Aufgabenteilung: bleRssiOnResult() läuft im BLE-Task und schreibt rssi, valid und seq. loop() schreibt pending,
 * requested und printedSeq und setzt valid in bleRssiReset(). Die Felder sind einzelne Bytes ohne gemeinsame Invariante;
 * ein Wettlauf zwischen Reset und Ergebnis kostet höchstens eine Zeile mehr oder weniger, nie einen falschen Wert
 * auf einer neuen Verbindung (pending schützt davor).
 */
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

#define BLE_RSSI_INTERVAL_MS 2000UL  // Abstand zwischen zwei Abfragen
#define BLE_RSSI_UNREADABLE 127      // Controller-Wert, wenn die RSSI nicht lesbar ist
#define BLE_RSSI_MIN_DBM (-127)

struct BleRssiState {
  volatile int8_t rssi = 0;       // zuletzt gelesener Wert in dBm
  volatile bool valid = false;    // true, sobald ein lesbarer Wert dieser Verbindung vorliegt
  volatile uint8_t seq = 0;       // zählt jedes neue Ergebnis (Überlauf ist gewollt)
  uint8_t printedSeq = 0;         // Stand von seq, den loop() zuletzt ausgegeben hat
  unsigned long lastRequestMs = 0;
  bool requested = false;         // mindestens eine Abfrage dieser Verbindung gesendet
  volatile bool noneDue = false;  // der Wert fiel weg (Fehlschlag): loop() meldet einmal "none"
  volatile bool pending = false;  // eine Abfrage wartet auf ihr Ergebnis; ohne sie zählt ein Ergebnis nicht
};

// Ergebnis des Controllers (BLE-Task). status 0 = ESP_BT_STATUS_SUCCESS. Nicht lesbare Werte (127) und
// Werte außerhalb von -127..20 dBm zählen nicht. Rückgabe true, wenn der Wert übernommen wurde.
inline bool bleRssiOnResult(BleRssiState &st, int status, int rssi) {
  if (!st.pending) return false;  // spätes Ergebnis einer beendeten Verbindung
  st.pending = false;
  if (status != 0 || rssi == BLE_RSSI_UNREADABLE || rssi < BLE_RSSI_MIN_DBM || rssi > 20) {
    // Nicht lesbar: der alte Wert gilt nicht weiter. Die App erfährt es einmal über "BLE_RSSI:none".
    if (st.valid) {
      st.valid = false;
      st.noneDue = true;
    }
    return false;
  }
  st.rssi = (int8_t)rssi;
  st.valid = true;
  st.seq = (uint8_t)(st.seq + 1);
  return true;
}

// Verbindung beendet: kein Wert gilt mehr, die nächste Verbindung fragt sofort ab
inline void bleRssiReset(BleRssiState &st) {
  st.pending = false;
  st.valid = false;
  st.noneDue = false;
  st.requested = false;
  st.printedSeq = st.seq;
}

// Gilt die Verbindung für die RSSI-Abfrage? Nur mit Mac-Verbindung und außerhalb des Config Mode.
inline bool bleRssiLinkActive(bool configMode, bool connected) {
  return !configMode && connected;
}

// Ist eine neue Abfrage fällig? Die erste einer Verbindung sofort, danach alle BLE_RSSI_INTERVAL_MS.
// Der Aufrufer meldet über bleRssiRequestSent(), dass er sie gesendet hat.
inline bool bleRssiRequestDue(const BleRssiState &st, unsigned long now) {
  return !st.requested || (now - st.lastRequestMs) >= BLE_RSSI_INTERVAL_MS;
}

inline void bleRssiRequestSent(BleRssiState &st, unsigned long now) {
  st.requested = true;
  st.lastRequestMs = now;
}

// Zeile "BLE_RSSI:<dBm>", wenn ein neues Ergebnis vorliegt; Rückgabe false ohne neuen Wert
inline bool bleRssiTakeLine(BleRssiState &st, char *buf, size_t size) {
  if (!st.valid || st.printedSeq == st.seq) return false;
  st.printedSeq = st.seq;
  int n = snprintf(buf, size, "BLE_RSSI:%d", (int)st.rssi);
  return n > 0 && (size_t)n < size;
}
