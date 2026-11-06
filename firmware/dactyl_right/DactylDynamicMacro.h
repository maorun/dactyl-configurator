#pragma once
/*
 * DactylDynamicMacro.h — Aufnahme eines dynamischen Makros auf dem Master (ACT_DM_REC, ACT_DM_PLAY).
 * Der Slot liegt nur im RAM: ein Neustart, Deep Sleep und der Config Mode leeren ihn, GET_CONFIG sendet ihn nie
 * (er kann ein Passwort enthalten). SplitArbitratedKeyboard (DactylSplitHid.h) ruft noteDown/noteUp für jeden
 * Tastencode beider Hälften auf; die Makro-Engine (DactylLogic.h) spielt die Schritte ab.
 * Keine Arduino- oder BLE-Abhängigkeit, damit die Host-Tests den Produktionscode ausführen.
 */
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include "DactylCommon.h"  // MacroStep, MAX_MACRO_STEPS, MACRO_STEP_DOWN, MACRO_STEP_UP

struct DynamicMacro {
  MacroStep steps[MAX_MACRO_STEPS] = {};
  uint8_t length = 0;
  bool recording = false;
  int8_t reported = 0;       // zuletzt auf USB-Serial gemeldeter Stand (0/1); -1 = beim nächsten Durchlauf melden
  uint8_t down[32] = {};     // Bitmenge: Codes mit aufgezeichnetem DOWN und noch ohne UP

  bool isDown(uint8_t code) const { return (down[code >> 3] >> (code & 7)) & 1; }
  void setDown(uint8_t code, bool on) {
    if (on) down[code >> 3] |= (uint8_t)(1u << (code & 7));
    else down[code >> 3] &= (uint8_t)~(1u << (code & 7));
  }
  void clearHeld() { for (uint8_t &b : down) b = 0; }

  // Alles verwerfen (Neustart-Zustand): Aufnahme aus, Slot leer
  void clear() {
    recording = false;
    length = 0;
    clearHeld();
  }

  // Neue Aufnahme: der alte Slot geht verloren
  void startRecording() {
    length = 0;
    clearHeld();
    recording = true;
  }
  void stopRecording() { recording = false; }

  // Alle Tasten sind gelöst (releaseAll, Host-Verlust): jedes offene DOWN bekommt sein UP, außer der Code ist noch
  // gehalten (stillHeld liefert true). Sonst bliebe ein DOWN ohne UP und der Code ließe sich nicht mehr aufnehmen.
  template <class Held>
  void noteReleaseAll(Held stillHeld) {
    if (!recording) { clearHeld(); return; }
    for (int code = 1; code <= 0xFF; code++) {
      if (isDown((uint8_t)code) && !stillHeld((uint8_t)code)) noteUp((uint8_t)code);
    }
  }

  // Taste gedrückt. Ein Code, der schon gedrückt aufgezeichnet ist (z. B. dasselbe Shift auf beiden Hälften),
  // zählt nicht doppelt.
  void noteDown(uint8_t code) {
    if (!recording || code == 0 || isDown(code)) return;
    setDown(code, true);
    push(MACRO_STEP_DOWN, code);
  }
  // Taste losgelassen, nachdem keine Hälfte sie mehr hält. Eine Taste, die schon vor der Aufnahme gehalten war,
  // hat kein DOWN und erzeugt kein UP.
  void noteUp(uint8_t code) {
    if (!recording || code == 0 || !isDown(code)) return;
    setDown(code, false);
    push(MACRO_STEP_UP, code);
  }

private:
  // Am Limit endet die Aufnahme; ein offenes DOWN löst die Makro-Engine am Ende des Abspielens
  void push(uint8_t type, uint8_t code) {
    if (length >= MAX_MACRO_STEPS) { recording = false; return; }
    steps[length++] = { type, code, 0 };
    if (length >= MAX_MACRO_STEPS) recording = false;
  }
};

// Zeile "DM_REC:0|1" für USB-Serial (nie über BLE), wenn sich der Aufnahmestand seit der letzten Meldung geändert hat
inline bool dynamicMacroTakeLine(DynamicMacro &d, char *buf, size_t size) {
  int8_t now = d.recording ? 1 : 0;
  if (d.reported == now) return false;
  d.reported = now;
  snprintf(buf, size, "DM_REC:%d", now);
  return true;
}
