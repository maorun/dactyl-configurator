#pragma once

/*
 * =============================================================================
 * Dactyl Firmware — Gemeinsame Logik (Layer, Tap-Hold, Combos, Konfig-Befehle, NVS)
 * =============================================================================
 * Wird sowohl von dactyl_right.ino als auch von firmware/tests/test_firmware_logic.cpp
 * eingebunden, damit die Unit-Tests exakt den Produktionscode prüfen.
 *
 * Die einbindende Übersetzungseinheit muss VOR dem #include deklarieren:
 *   NUM_LAYERS, NUM_ROWS, NUM_COLS, MAX_COMBOS, CONFIG_MODE_MAGIC,
 *   KeyCombo, ComboRuntime, comboRuntime[], userCombos[], numCombos,
 *   KEYMAP[][][], HOLDMAP[][][], layerNames[],
 *   momentaryLayers[], toggleLayers[], keyState[][], pressedAction[][],
 *   keyPressTime[][], keySentToHost[][],
 *   isConfigMode, enterConfigRequested, exitConfigRequested, lastActivityTime,
 *   configMutex, preferences, pConfigCharacteristic, bleKeyboard,
 *   deviceName, debounceMs, comboTimeoutMs, standbyTimeoutMinutes, deepSleepTimeoutMinutes,
 *   void handleConfigCommand(String, bool = false);
 *   void sendConfigNotification(String, bool = false);
 */

// Maximale Haltezeit für ein Tap bei Mod-Tap-Tasten (Tap-Aktion + Halte-Aktion)
#ifndef TAPPING_TERM_MS
#define TAPPING_TERM_MS 200
#endif

// -----------------------------------------------------------------------------
// Layer-Auflösung
// -----------------------------------------------------------------------------
uint8_t getActiveLayer() {
  if (momentaryLayers[0]) return 0; // Momentary Layer 0 zwingt temporär Base-Layer
  for (int l = NUM_LAYERS - 1; l > 0; l--) {
    if (momentaryLayers[l] || toggleLayers[l]) return l;
  }
  return 0;
}

// Ermittelt Tap- und Halte-Aktion einer Taste inkl. transparentem Fallback auf Layer 0.
// Eine Taste nur mit Halte-Aktion (Tap = 0) verhält sich wie eine normale Taste.
void resolveKeyActions(uint8_t layer, uint8_t r, uint8_t c, uint16_t &tapAct, uint16_t &holdAct) {
  tapAct = KEYMAP[layer][r][c];
  holdAct = HOLDMAP[layer][r][c];
  if (tapAct == 0 && holdAct == 0) {
    tapAct = KEYMAP[0][r][c];
    holdAct = HOLDMAP[0][r][c];
  }
  if (tapAct == 0 && holdAct != 0) {
    tapAct = holdAct;
    holdAct = 0;
  }
}

// Solange beide Config-Combo-Tasten gehalten werden, senden diese beiden Tasten nichts an den Host
bool isConfigComboSuppressed(uint8_t r, uint8_t c) {
  return keyState[0][0] && keyState[4][5] && ((r == 0 && c == 0) || (r == 4 && c == 5));
}

bool isComboCandidateKey(uint8_t r, uint8_t c);
bool wasComboRecentlyActive(uint8_t r, uint8_t c);

// -----------------------------------------------------------------------------
// Aktionen ausführen (Tastendruck / Loslassen einer aufgelösten Aktion)
// -----------------------------------------------------------------------------
void dispatchPress(uint8_t r, uint8_t c, uint16_t action, uint8_t currentLayer) {
  pressedAction[r][c] = action;

  if (action >= 0x100 && action <= 0x107) {
    uint8_t l = action - 0x100;
    if (l < NUM_LAYERS) momentaryLayers[l] = true;
    uint8_t newL = getActiveLayer();
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"MO_%d\",\"code\":%d,\"layer\":%d,\"target_layer\":%d}", r, c, l, action, currentLayer, newL);
    sendConfigNotification(String(buf));
    Serial.printf("LAYER: MO(%d) aktiv -> Layer %d\n", l, newL);
  } else if (action >= 0x110 && action <= 0x117) {
    uint8_t l = action - 0x110;
    if (l == 0) {
      // TG_0 setzt alle getoggelten Ebenen zurück und wechselt fest auf Layer 0
      for (int i = 1; i < NUM_LAYERS; i++) toggleLayers[i] = false;
    } else if (l < NUM_LAYERS) {
      toggleLayers[l] = !toggleLayers[l];
    }
    uint8_t newL = getActiveLayer();
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"TG_%d\",\"code\":%d,\"layer\":%d,\"target_layer\":%d}", r, c, l, action, currentLayer, newL);
    sendConfigNotification(String(buf));
    Serial.printf("LAYER: TG(%d) -> Layer %d\n", l, newL);
  } else if (action == ACT_LAYER_UP || action == ACT_LAYER_DOWN) {
    uint8_t targetL = (action == ACT_LAYER_UP)
      ? ((currentLayer + 1) % NUM_LAYERS)
      : ((currentLayer == 0) ? (NUM_LAYERS - 1) : (currentLayer - 1));
    for (int i = 1; i < NUM_LAYERS; i++) toggleLayers[i] = false;
    if (targetL > 0 && targetL < NUM_LAYERS) {
      toggleLayers[targetL] = true;
    }
    uint8_t newL = getActiveLayer();
    const char* actName = (action == ACT_LAYER_UP) ? "LAYER_UP" : "LAYER_DOWN";
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"%s\",\"code\":%d,\"layer\":%d,\"target_layer\":%d}", r, c, actName, action, currentLayer, newL);
    sendConfigNotification(String(buf));
    Serial.printf("LAYER: %s -> Layer %d\n", actName, newL);
  } else if (action >= 0x120 && action <= 0x127) {
    const char* mediaName = "MEDIA";
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (action == 0x120) { mediaName = "Play/Pause"; bleKeyboard.write(KEY_MEDIA_PLAY_PAUSE); }
      else if (action == 0x121) { mediaName = "Mute"; bleKeyboard.write(KEY_MEDIA_MUTE); }
      else if (action == 0x122) { mediaName = "Vol+"; bleKeyboard.write(KEY_MEDIA_VOLUME_UP); }
      else if (action == 0x123) { mediaName = "Vol-"; bleKeyboard.write(KEY_MEDIA_VOLUME_DOWN); }
      else if (action == 0x124) { mediaName = "Next"; bleKeyboard.write(KEY_MEDIA_NEXT_TRACK); }
      else if (action == 0x125) { mediaName = "Prev"; bleKeyboard.write(KEY_MEDIA_PREVIOUS_TRACK); }
      else if (action == 0x126) { mediaName = "Stop"; bleKeyboard.write(KEY_MEDIA_STOP); }
      else if (action == 0x127) { mediaName = "Mac Globe (Fn)"; bleKeyboard.press(KEY_MEDIA_GLOBE); }
    }
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"%s\",\"code\":%d,\"layer\":%d}", r, c, mediaName, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("Media-Taste gedrückt: [R%d, C%d] (L%d) -> %s (0x%02X)\n", r, c, currentLayer, mediaName, action);
  } else if (action >= 0x130 && action <= 0x134) {
    const char* mouseName = "MOUSE";
    if (action == 0x130) mouseName = "Linksklick";
    else if (action == 0x131) mouseName = "Rechtsklick";
    else if (action == 0x132) mouseName = "Mittelklick";
    else if (action == 0x133) mouseName = "Mausrad Hoch";
    else if (action == 0x134) mouseName = "Mausrad Runter";

    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"%s\",\"code\":%d,\"layer\":%d}", r, c, mouseName, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("Maus-Aktion gedrückt: [R%d, C%d] (L%d) -> %s (0x%02X)\n", r, c, currentLayer, mouseName, action);

    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (!isComboCandidateKey(r, c) && !isConfigComboSuppressed(r, c)) {
        if (action == 0x130) bleKeyboard.mousePress(MOUSE_BUTTON_LEFT);
        else if (action == 0x131) bleKeyboard.mousePress(MOUSE_BUTTON_RIGHT);
        else if (action == 0x132) bleKeyboard.mousePress(MOUSE_BUTTON_MIDDLE);
        else if (action == 0x133) bleKeyboard.mouseScroll(1);
        else if (action == 0x134) bleKeyboard.mouseScroll(-1);
        keySentToHost[r][c] = true;
      }
    }
  } else if (action > 0 && action <= 0xFF) {
    String keyLabel = "";
    if (action >= 'a' && action <= 'z') keyLabel = String((char)toupper(action));
    else if (action >= 32 && action <= 126 && action != '"' && action != '\\') keyLabel = String((char)action);
    else if (action >= KEY_F1 && action <= KEY_F12) keyLabel = "F" + String(action - KEY_F1 + 1);
    else if (action >= KEY_F13 && action <= KEY_F24) keyLabel = "F" + String(action - KEY_F13 + 13);
    else if (action == KEY_RETURN) keyLabel = "Enter";
    else if (action == KEY_ESC) keyLabel = "Esc";
    else if (action == KEY_BACKSPACE) keyLabel = "Bksp";
    else if (action == KEY_TAB) keyLabel = "Tab";
    else if (action == KEY_DELETE) keyLabel = "Del";
    else if (action == KEY_CAPS_LOCK) keyLabel = "Caps";
    else if (action == KEY_INSERT) keyLabel = "Ins";
    else if (action == KEY_PRTSC) keyLabel = "PrtSc";
    else if (action == KEY_UP_ARROW) keyLabel = "Up";
    else if (action == KEY_DOWN_ARROW) keyLabel = "Down";
    else if (action == KEY_LEFT_ARROW) keyLabel = "Left";
    else if (action == KEY_RIGHT_ARROW) keyLabel = "Right";
    else if (action >= KEY_NUM_1 && action <= KEY_NUM_9) keyLabel = "Num" + String(action - KEY_NUM_1 + 1);
    else if (action == KEY_NUM_0) keyLabel = "Num0";
    else keyLabel = "Key" + String(action);

    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"%s\",\"code\":%d,\"layer\":%d}", r, c, keyLabel.c_str(), action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("Taste gedrückt: [R%d, C%d] (L%d) -> '%s' (0x%02X)\n", r, c, currentLayer, keyLabel.c_str(), action);
    if (!isConfigMode && bleKeyboard.isConnected()) {
      // Wenn die Taste Teil einer definierten Combo ist, puffern wir das Senden um comboTimeoutMs,
      // damit beim Drücken des Chords (z. B. J+K) kein Buchstabe vorab gesendet wird!
      if (!isComboCandidateKey(r, c) && !isConfigComboSuppressed(r, c)) {
        bleKeyboard.press((uint8_t)action);
        keySentToHost[r][c] = true;
      }
    }
  }
}

void dispatchRelease(uint8_t r, uint8_t c, uint16_t action) {
  pressedAction[r][c] = 0;

  if (action >= 0x100 && action <= 0x107) {
    uint8_t l = action - 0x100;
    if (l < NUM_LAYERS) momentaryLayers[l] = false;
    Serial.printf("LAYER: MO(%d) gelöst -> Layer %d\n", l, getActiveLayer());
  } else if (action >= 0x120 && action <= 0x127) {
    if (!isConfigMode && action == 0x127 && bleKeyboard.isConnected()) {
      bleKeyboard.release(KEY_MEDIA_GLOBE);
    }
  } else if (action >= 0x130 && action <= 0x134) {
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (keySentToHost[r][c]) {
        if (action == 0x130) bleKeyboard.mouseRelease(MOUSE_BUTTON_LEFT);
        else if (action == 0x131) bleKeyboard.mouseRelease(MOUSE_BUTTON_RIGHT);
        else if (action == 0x132) bleKeyboard.mouseRelease(MOUSE_BUTTON_MIDDLE);
        keySentToHost[r][c] = false;
      } else if (!wasComboRecentlyActive(r, c) && !(r == 0 && c == 0) && !(r == 4 && c == 5)) {
        // Wenn die Taste vor Ablauf des Combo-Timeouts losgelassen wurde (schneller Einzeltipp)
        if (action == 0x130) bleKeyboard.mouseClick(MOUSE_BUTTON_LEFT);
        else if (action == 0x131) bleKeyboard.mouseClick(MOUSE_BUTTON_RIGHT);
        else if (action == 0x132) bleKeyboard.mouseClick(MOUSE_BUTTON_MIDDLE);
        else if (action == 0x133) bleKeyboard.mouseScroll(1);
        else if (action == 0x134) bleKeyboard.mouseScroll(-1);
      }
    }
  } else if (action > 0 && action <= 0xFF) {
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (keySentToHost[r][c]) {
        bleKeyboard.release((uint8_t)action);
        keySentToHost[r][c] = false;
      } else if (!wasComboRecentlyActive(r, c) && !(r == 0 && c == 0) && !(r == 4 && c == 5)) {
        // Wenn die Taste vor Ablauf des Combo-Timeouts losgelassen wurde (schneller Einzeltipp)
        // UND nicht gerade Teil einer ausgelösten Combo war:
        bleKeyboard.press((uint8_t)action);
        delay(5);
        bleKeyboard.release((uint8_t)action);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Tap-Hold (Mod-Tap / Layer-Tap)
// -----------------------------------------------------------------------------
struct TapHoldKey {
  bool pending;      // Gedrückt, Tap oder Hold noch nicht entschieden
  bool holdActive;   // Halte-Aktion ist aktiv
  uint16_t tapAction;
  uint16_t holdAction;
  uint8_t layer;
  unsigned long pressTime;
};
TapHoldKey tapHold[NUM_ROWS][NUM_COLS];

void resetTapHold() {
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      tapHold[r][c] = { false, false, 0, 0, 0, 0 };
    }
  }
}

void tapHoldOnPress(uint8_t r, uint8_t c, uint16_t tapAct, uint16_t holdAct, uint8_t layer, unsigned long now) {
  tapHold[r][c] = { true, false, tapAct, holdAct, layer, now };
}

// true, wenn (r, c) mit einer bereits gedrückten Partnertaste innerhalb von comboTimeoutMs eine Combo bildet.
// Diese Combo wird im selben Scan von checkUserCombos() ausgelöst.
bool hasPressedComboPartnerInWindow(uint8_t r, uint8_t c) {
  for (uint8_t i = 0; i < numCombos; i++) {
    uint8_t pr, pc;
    if (userCombos[i].r1 == r && userCombos[i].c1 == c) { pr = userCombos[i].r2; pc = userCombos[i].c2; }
    else if (userCombos[i].r2 == r && userCombos[i].c2 == c) { pr = userCombos[i].r1; pc = userCombos[i].c1; }
    else continue;
    if (!keyState[pr][pc]) continue;
    unsigned long t1 = keyPressTime[r][c];
    unsigned long t2 = keyPressTime[pr][pc];
    if ((unsigned long)(t1 - t2) <= comboTimeoutMs || (unsigned long)(t2 - t1) <= comboTimeoutMs) return true;
  }
  return false;
}

void activateTapHoldAsHold(uint8_t r, uint8_t c) {
  TapHoldKey &k = tapHold[r][c];
  if (!k.pending) return;
  k.pending = false;
  k.holdActive = true;
  dispatchPress(r, c, k.holdAction, k.layer);
  // Die Hold-Entscheidung ist endgültig: eine als Combo-Kandidat gepufferte Halte-Aktion
  // (z. B. Ctrl) sofort an den Host senden, damit sie VOR der abhängigen Taste ankommt.
  // Ausnahme: Der Combo-Partner ist im Combo-Fenster gedrückt. Dann gewinnt die Combo im selben Scan,
  // und ein vorab gesendetes Ctrl würde durch releaseAll() als einzelnes Ctrl-Tippen am Host ankommen.
  if (!keySentToHost[r][c] && !isConfigMode && bleKeyboard.isConnected() && !isConfigComboSuppressed(r, c) &&
      !hasPressedComboPartnerInWindow(r, c)) {
    uint16_t act = k.holdAction;
    if (act > 0 && act <= 0xFF) {
      bleKeyboard.press((uint8_t)act);
      keySentToHost[r][c] = true;
    } else if (act >= 0x130 && act <= 0x132) {
      if (act == 0x130) bleKeyboard.mousePress(MOUSE_BUTTON_LEFT);
      else if (act == 0x131) bleKeyboard.mousePress(MOUSE_BUTTON_RIGHT);
      else bleKeyboard.mousePress(MOUSE_BUTTON_MIDDLE);
      keySentToHost[r][c] = true;
    }
  }
}

// Eine Combo hat die Taste verbraucht: offene Tap-Hold-Entscheidung verwerfen und eine bereits
// aktive Halte-Aktion zurücknehmen, damit die Einzelaktion nicht zusätzlich zur Combo wirkt.
void cancelTapHoldForCombo(uint8_t r, uint8_t c) {
  TapHoldKey &k = tapHold[r][c];
  if (k.holdActive) {
    k.holdActive = false;
    // Combo hat bereits releaseAll() gesendet; nur den Layer-/Aktionszustand zurücksetzen
    keySentToHost[r][c] = false;
    dispatchRelease(r, c, k.holdAction);
  }
  k.pending = false;
}

// Eine andere Taste wurde gedrückt, während Mod-Tap-Tasten noch unentschieden sind:
// Diese werden sofort zu Hold (z. B. Strg halten + C tippen innerhalb des Tapping-Terms).
void resolvePendingTapHoldsAsHold(uint8_t exceptR, uint8_t exceptC) {
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      if (r == exceptR && c == exceptC) continue;
      if (tapHold[r][c].pending) activateTapHoldAsHold(r, c);
    }
  }
}

// Gibt true zurück, wenn die Taste vom Tap-Hold-Automaten behandelt wurde
bool tapHoldOnRelease(uint8_t r, uint8_t c, unsigned long now) {
  TapHoldKey &k = tapHold[r][c];
  // Release wird vor dem Tick verarbeitet: Tapping-Term hier erneut prüfen,
  // sonst würde ein Halten über TAPPING_TERM_MS noch als Tap gewertet.
  if (k.pending && (unsigned long)(now - k.pressTime) >= TAPPING_TERM_MS) {
    activateTapHoldAsHold(r, c);
  }
  if (k.pending) {
    k.pending = false;
    dispatchPress(r, c, k.tapAction, k.layer);
    dispatchRelease(r, c, k.tapAction);
    return true;
  }
  if (k.holdActive) {
    k.holdActive = false;
    dispatchRelease(r, c, k.holdAction);
    return true;
  }
  return false;
}

void tapHoldTick(unsigned long now) {
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      if (tapHold[r][c].pending && (unsigned long)(now - tapHold[r][c].pressTime) >= TAPPING_TERM_MS) {
        activateTapHoldAsHold(r, c);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Matrix-Ereignisse (vom Scan in loop() aufgerufen)
// -----------------------------------------------------------------------------
void onMatrixKeyChange(uint8_t r, uint8_t c, bool isPressed) {
  unsigned long now = millis();
  if (isPressed) {
    keyPressTime[r][c] = now;
    keySentToHost[r][c] = false;
    // Ein weiterer Tastendruck entscheidet offene Mod-Tap-Tasten sofort als Hold
    resolvePendingTapHoldsAsHold(r, c);
    uint8_t layer = getActiveLayer();
    uint16_t tapAct, holdAct;
    resolveKeyActions(layer, r, c, tapAct, holdAct);
    if (holdAct != 0) {
      tapHoldOnPress(r, c, tapAct, holdAct, layer, now);
    } else {
      dispatchPress(r, c, tapAct, layer);
    }
  } else {
    if (!tapHoldOnRelease(r, c, now)) {
      dispatchRelease(r, c, pressedAction[r][c]);
    }
    // KEY_RELEASE erst nach einem eventuellen Tap-KEY_PRESS senden, damit die UI nicht hängen bleibt
    char buf[64];
    snprintf(buf, sizeof(buf), "KEY_RELEASE:{\"r\":%d,\"c\":%d}", r, c);
    sendConfigNotification(String(buf));

    // keyPressTime erst NACH wasComboRecentlyActive auf 0 setzen,
    // damit der echte Anschlag-Zeitstempel für den Grace-Period-Check erhalten bleibt!
    keyPressTime[r][c] = 0;
  }
}

// Zeitgesteuerte Entscheidungen: Mod-Tap Tapping-Term und gepufferte Combo-Kandidaten
void processDeferredKeys(unsigned long now) {
  tapHoldTick(now);

  // Gepufferte Combo-Kandidaten senden, falls Zeitfenster (comboTimeoutMs) ohne zweiten Tastendruck abgelaufen ist
  if (!isConfigMode && bleKeyboard.isConnected()) {
    for (int r = 0; r < NUM_ROWS; r++) {
      for (int c = 0; c < NUM_COLS; c++) {
        if (keyState[r][c] && !keySentToHost[r][c] && isComboCandidateKey(r, c)) {
          if ((unsigned long)(now - keyPressTime[r][c]) >= comboTimeoutMs) {
            uint16_t act = pressedAction[r][c];
            if (act > 0 && act <= 0xFF) {
              bleKeyboard.press((uint8_t)act);
              keySentToHost[r][c] = true;
            } else if (act >= 0x130 && act <= 0x134) {
              if (act == 0x130) bleKeyboard.mousePress(MOUSE_BUTTON_LEFT);
              else if (act == 0x131) bleKeyboard.mousePress(MOUSE_BUTTON_RIGHT);
              else if (act == 0x132) bleKeyboard.mousePress(MOUSE_BUTTON_MIDDLE);
              else if (act == 0x133) bleKeyboard.mouseScroll(1);
              else if (act == 0x134) bleKeyboard.mouseScroll(-1);
              keySentToHost[r][c] = true;
            }
          }
        }
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Boot-Modus & Serial
// -----------------------------------------------------------------------------
// Nur ein gezielter Soft-Reboot mit gesetztem RTC-Magic startet im isolierten Config-Modus
bool shouldBootIntoConfigMode(esp_reset_reason_t reason, uint32_t magic) {
  return reason == ESP_RST_SW && magic == CONFIG_MODE_MAGIC;
}

// Nicht-blockierender Zeilenpuffer für USB-Serial-Befehle
void feedSerialChar(char ch, String &buf) {
  if (ch == '\n') {
    handleConfigCommand(buf, false);
    buf = "";
  } else if (ch != '\r') {
    if (buf.length() < 256) {
      buf += ch;
    }
  }
}

// -----------------------------------------------------------------------------
// NVS-Persistenz (alle Schreibfunktionen melden Erfolg zurück)
// -----------------------------------------------------------------------------
bool saveKeymapToNVS() {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putBytes("keymap", KEYMAP, sizeof(KEYMAP)) == sizeof(KEYMAP);
  ok = (preferences.putBytes("holdmap", HOLDMAP, sizeof(HOLDMAP)) == sizeof(HOLDMAP)) && ok;
  preferences.end();
  Serial.println(ok ? "NVS: Keymap gespeichert." : "NVS: FEHLER beim Speichern der Keymap!");
  return ok;
}

// FNV-1a-Prüfsumme über die EINKOMPILIERTEN Defaults (KEYMAP + HOLDMAP vor dem NVS-Laden) und
// KEYMAP_DEFAULTS_ID. Die ID ist im Repository 0; "Auf Dactyl flashen" (server.py) setzt bei jedem Flash
// aus der App eine neue ID. Ein Flash aus der App übernimmt so immer die App-Belegung, ein reiner
// Firmware-Flash aus dem Repository (gleiche Defaults, gleiche ID) behält die Belegung im NVS.
uint32_t keymapDefaultsFingerprint() {
  uint32_t h = 2166136261u;
  const uint32_t id = KEYMAP_DEFAULTS_ID;
  const uint8_t* parts[3] = { (const uint8_t*)KEYMAP, (const uint8_t*)HOLDMAP, (const uint8_t*)&id };
  const size_t sizes[3] = { sizeof(KEYMAP), sizeof(HOLDMAP), sizeof(id) };
  for (int p = 0; p < 3; p++) {
    for (size_t i = 0; i < sizes[p]; i++) {
      h ^= parts[p][i];
      h *= 16777619u;
    }
  }
  return h;
}

void loadKeymapFromNVS() {
  preferences.begin("dactyl", false);
  uint32_t defaultsHash = keymapDefaultsFingerprint();
  bool hasStoredHash = preferences.isKey("defaults_fp");
  uint32_t storedHash = hasStoredHash ? preferences.getUInt("defaults_fp", 0) : 0;
  bool hasKeymap = preferences.isKey("keymap") && preferences.getBytesLength("keymap") == sizeof(KEYMAP);

  // Defaults übernehmen bei: erstem Start / nach RESET_CONFIG (keine Keymap), neuer Belegung aus der App
  // (anderer Fingerprint) oder Migration vom alten fw_build-Schema mit einem Flash aus der App (ID != 0).
  bool useDefaults = !hasKeymap || (hasStoredHash ? storedHash != defaultsHash : KEYMAP_DEFAULTS_ID != 0);

  if (useDefaults) {
    Serial.printf("NVS: Neue Default-Belegung (0x%08X). Synchronisiere NVS mit Firmware-Defaults.\n", (unsigned)defaultsHash);
    bool ok = preferences.putBytes("keymap", KEYMAP, sizeof(KEYMAP)) == sizeof(KEYMAP);
    ok = (preferences.putBytes("holdmap", HOLDMAP, sizeof(HOLDMAP)) == sizeof(HOLDMAP)) && ok;
    // Fingerprint zuletzt und nur nach vollständigem Schreiben: sonst beim nächsten Start erneut versuchen
    if (ok) {
      preferences.putUInt("defaults_fp", defaultsHash);
      preferences.remove("fw_build");
    } else {
      Serial.println("NVS: FEHLER beim Schreiben der Defaults, Wiederholung beim nächsten Start.");
    }
  } else {
    // Gleiche Defaults (reiner Firmware-Flash) oder Migration ohne App-Flash:
    // die im NVS gespeicherte Belegung des Nutzers bleibt erhalten.
    bool hasHoldmap = preferences.isKey("holdmap") && preferences.getBytesLength("holdmap") == sizeof(HOLDMAP);
    // Fehlende Holdmap (älteres Schema oder abgebrochenes Schreiben) mit den einkompilierten Defaults ergänzen
    bool holdmapOk = hasHoldmap || preferences.putBytes("holdmap", HOLDMAP, sizeof(HOLDMAP)) == sizeof(HOLDMAP);
    if (!hasStoredHash && holdmapOk) {
      preferences.putUInt("defaults_fp", defaultsHash);
      preferences.remove("fw_build");
    }
    preferences.getBytes("keymap", KEYMAP, sizeof(KEYMAP));
    Serial.println("NVS: Gespeicherte Keymap geladen.");
    if (hasHoldmap) {
      preferences.getBytes("holdmap", HOLDMAP, sizeof(HOLDMAP));
    }
  }
  for (int i = 0; i < NUM_LAYERS; i++) {
    String k = "name_" + String(i);
    if (preferences.isKey(k.c_str())) {
      layerNames[i] = preferences.getString(k.c_str());
      Serial.printf("NVS: Layer %d Name geladen: %s\n", i, layerNames[i].c_str());
    }
  }
  standbyTimeoutMinutes = preferences.isKey("standby_timeout") ? preferences.getUInt("standby_timeout", 5) : 5;
  deepSleepTimeoutMinutes = preferences.isKey("sleep_timeout") ? preferences.getUInt("sleep_timeout", 60) : 60;
  if (preferences.isKey("dev_name")) {
    deviceName = preferences.getString("dev_name", "Dactyl Keyboard");
  }
  if (preferences.isKey("debounce")) {
    debounceMs = preferences.getUChar("debounce", 5);
  }
  if (preferences.isKey("combo_to")) {
    comboTimeoutMs = preferences.getUShort("combo_to", 40);
  }
  if (preferences.isKey("num_combos")) {
    uint8_t n = preferences.getUChar("num_combos", 0);
    if (n == 0) {
      // Gespeicherte leere Liste (CLEAR_COMBOS + SAVE_COMBOS) überschreibt die einkompilierten Combos
      numCombos = 0;
      Serial.println("NVS: 0 Combos geladen.");
    } else if (n <= MAX_COMBOS && preferences.isKey("combos_data")) {
      size_t sz = preferences.getBytesLength("combos_data");
      if (sz == n * sizeof(KeyCombo)) {
        numCombos = n;
        preferences.getBytes("combos_data", userCombos, sz);
        for (int i = 0; i < MAX_COMBOS; i++) {
          comboRuntime[i].active = false;
          comboRuntime[i].lastReleaseTime = 0;
        }
        Serial.printf("NVS: %d Combos geladen.\n", numCombos);
      }
    }
  }
  Serial.printf("NVS: Timeouts & Settings geladen: Standby=%u Min, DeepSleep=%u Min, Debounce=%u ms, ComboTO=%u ms, Name='%s'\n",
    standbyTimeoutMinutes, deepSleepTimeoutMinutes, debounceMs, comboTimeoutMs, deviceName.c_str());
  preferences.end();
}

bool saveStandbyTimeoutToNVS(uint32_t timeout) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUInt("standby_timeout", timeout) > 0;
  preferences.end();
  if (ok) standbyTimeoutMinutes = timeout;
  Serial.printf("NVS: Standby-Timeout %s: %u Min\n", ok ? "gespeichert" : "FEHLER", timeout);
  return ok;
}

bool saveSleepTimeoutToNVS(uint32_t timeout) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUInt("sleep_timeout", timeout) > 0;
  preferences.end();
  if (ok) deepSleepTimeoutMinutes = timeout;
  Serial.printf("NVS: Deep-Sleep-Timeout %s: %u Min\n", ok ? "gespeichert" : "FEHLER", timeout);
  return ok;
}

bool saveDeviceNameToNVS(String name) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putString("dev_name", name) == name.length();
  preferences.end();
  if (ok) deviceName = name;
  Serial.printf("NVS: Gerätename %s: %s\n", ok ? "gespeichert" : "FEHLER", name.c_str());
  return ok;
}

bool saveDebounceToNVS(uint8_t ms) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUChar("debounce", ms) > 0;
  preferences.end();
  if (ok) debounceMs = ms;
  Serial.printf("NVS: Debounce %s: %u ms\n", ok ? "gespeichert" : "FEHLER", ms);
  return ok;
}

bool saveComboTimeoutToNVS(uint16_t ms) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUShort("combo_to", ms) > 0;
  preferences.end();
  if (ok) comboTimeoutMs = ms;
  Serial.printf("NVS: Combo-Timeout %s: %u ms\n", ok ? "gespeichert" : "FEHLER", ms);
  return ok;
}

bool saveCombosToNVS() {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUChar("num_combos", numCombos) > 0;
  size_t len = numCombos * sizeof(KeyCombo);
  // Leere Combo-Liste: putBytes mit Länge 0 meldet 0 Bytes, das ist kein Fehler
  if (len > 0) {
    ok = (preferences.putBytes("combos_data", userCombos, len) == len) && ok;
  } else {
    preferences.remove("combos_data");
  }
  preferences.end();
  Serial.printf("NVS: %d Combos %s.\n", numCombos, ok ? "gespeichert" : "FEHLER beim Speichern");
  return ok;
}

bool saveLayerNameToNVS(int idx, String name) {
  if (idx < 0 || idx >= NUM_LAYERS) return false;
  if (!preferences.begin("dactyl", false)) return false;
  String k = "name_" + String(idx);
  bool ok = preferences.putString(k.c_str(), name) == name.length();
  preferences.end();
  if (ok) layerNames[idx] = name;
  Serial.printf("NVS: Layer %d Name %s: %s\n", idx, ok ? "gespeichert" : "FEHLER", name.c_str());
  return ok;
}

// -----------------------------------------------------------------------------
// Konfigurations-Benachrichtigungen & Befehle (USB-Serial und BLE GATT)
// -----------------------------------------------------------------------------
void sendConfigNotification(String msg, bool addDelay) {
  Serial.println(msg);
  if (pConfigCharacteristic) {
    // Im normalen Mac-Tastaturmodus keine Tastendrücke über BLE-Notifications senden (Keylogger-Schutz)
    if (!isConfigMode && (msg.startsWith("KEY_PRESS") || msg.startsWith("KEY_RELEASE"))) {
      return;
    }
    pConfigCharacteristic->setValue(msg.c_str());
    pConfigCharacteristic->notify();
    if (addDelay) {
      delay(15);
    }
  }
}

// Bereinigt Namen für NVS, C++-Codegen und JSON-Ausgabe
String sanitizeConfigName(String name) {
  name.replace("\"", "");
  name.replace("\\", "");
  name.trim();
  if (name.length() > 31) name = name.substring(0, 31);
  return name;
}

void sendMatrixData(const char* prefix, uint16_t (*matrix)[NUM_ROWS][NUM_COLS], int l) {
  String out = String(prefix) + "{\"l\":" + String(l) + ",\"k\":[";
  for (int r = 0; r < NUM_ROWS; r++) {
    out += "[";
    for (int c = 0; c < NUM_COLS; c++) {
      out += String(matrix[l][r][c]);
      if (c < NUM_COLS - 1) out += ",";
    }
    out += "]";
    if (r < NUM_ROWS - 1) out += ",";
  }
  out += "]}";
  sendConfigNotification(out, true);
}

// Parst "<CMD> l r c tap [hold]". Fehlt hold, wird es auf 0 gesetzt.
bool parseKeyCommand(const String &cmd, const char *fmt, int &l, int &r, int &c, int &tap, int &hold) {
  hold = 0;
  int n = sscanf(cmd.c_str(), fmt, &l, &r, &c, &tap, &hold);
  if (n != 4 && n != 5) return false;
  return l >= 0 && l < NUM_LAYERS && r >= 0 && r < NUM_ROWS && c >= 0 && c < NUM_COLS &&
         tap >= 0 && tap <= 0xFFFF && hold >= 0 && hold <= 0xFFFF;
}

void handleConfigCommand(String cmd, bool fromBle) {
  cmd.trim();
  if (cmd.length() == 0) return;

  // Über BLE ist im normalen Tastaturmodus nur GET_INFO erlaubt. Der Config-Modus wird ausschließlich
  // physisch (R4C5 + R0C0) oder per USB-Serial (ENTER_CONFIG) aktiviert.
  if (fromBle && !isConfigMode && cmd != "GET_INFO") {
    Serial.println("WARN: BLE-Befehl abgelehnt (nicht im Config-Modus): " + cmd);
    return;
  }

  lastActivityTime = millis();

  bool mutexTaken = false;
  if (configMutex) {
    mutexTaken = (xSemaphoreTake(configMutex, pdMS_TO_TICKS(100)) == pdTRUE);
    if (!mutexTaken) {
      Serial.println("WARN: configMutex busy, skipping command: " + cmd);
      sendConfigNotification("ERR BUSY " + cmd);
      return;
    }
  }

  if (cmd.startsWith("SET_KEY ")) {
    int l, r, c, val, hold;
    if (parseKeyCommand(cmd, "SET_KEY %d %d %d %d %d", l, r, c, val, hold)) {
      KEYMAP[l][r][c] = (uint16_t)val;
      HOLDMAP[l][r][c] = (uint16_t)hold;
      if (saveKeymapToNVS()) {
        sendConfigNotification("OK SET_KEY " + String(l) + " " + String(r) + " " + String(c) + " " + String(val) + " " + String(hold));
      } else {
        sendConfigNotification("ERR NVS SET_KEY");
      }
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_K ")) {
    // Schnelles RAM-Update für Batch-Sync (NVS wird am Ende einmalig mit SAVE_NVS geschrieben)
    int l, r, c, val, hold;
    if (parseKeyCommand(cmd, "SET_K %d %d %d %d %d", l, r, c, val, hold)) {
      KEYMAP[l][r][c] = (uint16_t)val;
      HOLDMAP[l][r][c] = (uint16_t)hold;
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd == "SAVE_NVS") {
    sendConfigNotification(saveKeymapToNVS() ? "OK SAVE_NVS" : "ERR NVS SAVE_NVS");
  } else if (cmd.startsWith("SET_NAME ")) {
    int spaceIdx = cmd.indexOf(' ', 9);
    int l = cmd.substring(9, spaceIdx > 0 ? spaceIdx : 10).toInt();
    String name = sanitizeConfigName(spaceIdx > 0 ? cmd.substring(spaceIdx + 1) : "");
    if (l >= 0 && l < NUM_LAYERS && name.length() > 0) {
      if (saveLayerNameToNVS(l, name)) {
        sendConfigNotification("OK SET_NAME " + String(l) + " " + name);
      } else {
        // Layer-Index mitsenden: die App wartet auf "SET_NAME <l>" (OK und ERR)
        sendConfigNotification("ERR NVS SET_NAME " + String(l));
      }
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_STANDBY ")) {
    int t = cmd.substring(12).toInt();
    if (t >= 0 && t <= 120) {
      sendConfigNotification(saveStandbyTimeoutToNVS((uint32_t)t) ? "OK SET_STANDBY " + String(t) : String("ERR NVS SET_STANDBY"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_SLEEP ")) {
    int t = cmd.substring(10).toInt();
    if (t >= 0 && t <= 240) {
      sendConfigNotification(saveSleepTimeoutToNVS((uint32_t)t) ? "OK SET_SLEEP " + String(t) : String("ERR NVS SET_SLEEP"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_DEV_NAME ")) {
    String name = sanitizeConfigName(cmd.substring(13));
    if (name.length() > 0) {
      sendConfigNotification(saveDeviceNameToNVS(name) ? "OK SET_DEV_NAME " + name : String("ERR NVS SET_DEV_NAME"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_DEBOUNCE ")) {
    int d = cmd.substring(13).toInt();
    if (d >= 1 && d <= 50) {
      sendConfigNotification(saveDebounceToNVS((uint8_t)d) ? "OK SET_DEBOUNCE " + String(d) : String("ERR NVS SET_DEBOUNCE"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_COMBO_TIMEOUT ")) {
    int ct = cmd.substring(18).toInt();
    if (ct >= 10 && ct <= 200) {
      sendConfigNotification(saveComboTimeoutToNVS((uint16_t)ct) ? "OK SET_COMBO_TIMEOUT " + String(ct) : String("ERR NVS SET_COMBO_TIMEOUT"));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd == "CLEAR_COMBOS") {
    numCombos = 0;
    sendConfigNotification("OK CLEAR_COMBOS");
  } else if (cmd.startsWith("ADD_COMBO ")) {
    int r1, c1, r2, c2, beh, act;
    if (sscanf(cmd.c_str(), "ADD_COMBO %d %d %d %d %d %d", &r1, &c1, &r2, &c2, &beh, &act) == 6 &&
        numCombos < MAX_COMBOS && r1 >= 0 && r1 < NUM_ROWS && c1 >= 0 && c1 < NUM_COLS &&
        r2 >= 0 && r2 < NUM_ROWS && c2 >= 0 && c2 < NUM_COLS &&
        beh >= 0 && beh <= 2 && act >= 0 && act <= 0xFFFF) {
      userCombos[numCombos].r1 = (uint8_t)r1;
      userCombos[numCombos].c1 = (uint8_t)c1;
      userCombos[numCombos].r2 = (uint8_t)r2;
      userCombos[numCombos].c2 = (uint8_t)c2;
      userCombos[numCombos].behavior = (uint8_t)beh;
      userCombos[numCombos].action = (uint16_t)act;
      comboRuntime[numCombos].active = false;
      comboRuntime[numCombos].lastReleaseTime = 0;
      numCombos++;
      sendConfigNotification("OK ADD_COMBO " + String(numCombos - 1));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd == "SAVE_COMBOS") {
    sendConfigNotification(saveCombosToNVS() ? "OK SAVE_COMBOS" : "ERR NVS SAVE_COMBOS");
  } else if (cmd == "GET_NAMES" || cmd == "GET_CONFIG") {
    String out = "LAYER_NAMES:[";
    for (int i = 0; i < NUM_LAYERS; i++) {
      out += "\"" + layerNames[i] + "\"";
      if (i < NUM_LAYERS - 1) out += ",";
    }
    out += "]";
    sendConfigNotification(out);

    if (cmd == "GET_CONFIG") {
      for (int l = 0; l < NUM_LAYERS; l++) {
        sendMatrixData("LAYER_DATA:", KEYMAP, l);
        sendMatrixData("HOLD_DATA:", HOLDMAP, l);
      }
      sendConfigNotification("CONFIG_SYNC_DONE", true);
    }
  } else if (cmd == "GET_INFO") {
    uint8_t m[6];
    esp_read_mac(m, ESP_MAC_BT);
    char buf[288];
    snprintf(buf, sizeof(buf), "DEVICE_INFO:{\"name\":\"%s\",\"mac\":\"%02X:%02X:%02X:%02X:%02X:%02X\",\"standby_timeout\":%u,\"sleep_timeout\":%u,\"debounce_ms\":%u,\"combo_timeout_ms\":%u,\"config_mode\":%s}",
      isConfigMode ? "Dactyl Config" : deviceName.c_str(),
      m[0], m[1], m[2], m[3], m[4], m[5],
      (unsigned)standbyTimeoutMinutes, (unsigned)deepSleepTimeoutMinutes,
      (unsigned)debounceMs, (unsigned)comboTimeoutMs,
      isConfigMode ? "true" : "false");
    sendConfigNotification(String(buf));
  } else if (cmd == "RESET_CONFIG") {
    bool ok = preferences.begin("dactyl", false) && preferences.clear();
    preferences.end();
    sendConfigNotification(ok ? "OK RESET_CONFIG" : "ERR NVS RESET_CONFIG");
  } else if (cmd == "ENTER_CONFIG") {
    sendConfigNotification("OK ENTER_CONFIG");
    enterConfigRequested = true;
  } else if (cmd == "EXIT_CONFIG") {
    sendConfigNotification("OK EXIT_CONFIG");
    exitConfigRequested = true;
  } else {
    sendConfigNotification("ERR UNKNOWN " + cmd);
  }

  if (mutexTaken) xSemaphoreGive(configMutex);
}

// -----------------------------------------------------------------------------
// Benutzerdefinierte Combos / Chords
// -----------------------------------------------------------------------------
bool wasComboRecentlyActive(uint8_t r, uint8_t c) {
  unsigned long now = millis();
  for (uint8_t i = 0; i < numCombos; i++) {
    if ((userCombos[i].r1 == r && userCombos[i].c1 == c) ||
        (userCombos[i].r2 == r && userCombos[i].c2 == c)) {
      if (comboRuntime[i].active) return true;
      if (comboRuntime[i].lastReleaseTime > 0 && ((unsigned long)(now - comboRuntime[i].lastReleaseTime) < 300)) {
        // Nur unterdrücken, wenn der Tastendruck VOR oder WÄHREND des Chords gestartet wurde.
        // Ein NEUER Tastendruck nach dem Chord ist legitim und wird nicht blockiert!
        // Vorzeichenbehafteter Cast für sichere Rollover-Differenz:
        if ((long)(keyPressTime[r][c] - comboRuntime[i].lastReleaseTime) <= 0) {
          return true;
        }
      }
    }
  }
  return false;
}

bool isComboCandidateKey(uint8_t r, uint8_t c) {
  for (uint8_t i = 0; i < numCombos; i++) {
    if ((userCombos[i].r1 == r && userCombos[i].c1 == c) ||
        (userCombos[i].r2 == r && userCombos[i].c2 == c)) {
      return true;
    }
  }
  return false;
}

void checkUserCombos() {
  unsigned long now = millis();
  for (uint8_t i = 0; i < numCombos; i++) {
    uint8_t r1 = userCombos[i].r1;
    uint8_t c1 = userCombos[i].c1;
    uint8_t r2 = userCombos[i].r2;
    uint8_t c2 = userCombos[i].c2;

    bool bothPressed = keyState[r1][c1] && keyState[r2][c2];
    if (bothPressed && !comboRuntime[i].active) {
      // Beide Tasten müssen innerhalb des konfigurierbaren comboTimeoutMs gedrückt worden sein!
      // Wenn eine Taste schon lange gehalten wurde und man dann schnell tippt, ist es KEINE Combo!
      unsigned long t1 = keyPressTime[r1][c1];
      unsigned long t2 = keyPressTime[r2][c2];
      bool inWindow = ((unsigned long)(t1 - t2) <= comboTimeoutMs) || ((unsigned long)(t2 - t1) <= comboTimeoutMs);

      if (inWindow) {
        comboRuntime[i].active = true;
        // Die Combo verbraucht beide Tasten: deren Mod-Tap-Entscheidung darf nicht mehr greifen
        cancelTapHoldForCombo(r1, c1);
        cancelTapHoldForCombo(r2, c2);
        // Beide Tasten als an Host gesendet markieren, damit lingernde Tasten nach dem Chord
        // nicht nach Ablauf der 300ms Grace Period versehentlich als Einzeltaste nachfeuern!
        keySentToHost[r1][c1] = true;
        keySentToHost[r2][c2] = true;

        // Sofort Einzeltasten auf Mac loslassen, damit der Combo-Chord die Einzeltasten überschreibt
        if (!isConfigMode && bleKeyboard.isConnected()) {
          bleKeyboard.releaseAll();
        }
        uint16_t act = userCombos[i].action;
        if (userCombos[i].behavior == 0) { // KEY_PRESS
          if (!isConfigMode && bleKeyboard.isConnected()) {
            if (act >= 0x120 && act <= 0x127) {
              if (act == 0x120) bleKeyboard.write(KEY_MEDIA_PLAY_PAUSE);
              else if (act == 0x121) bleKeyboard.write(KEY_MEDIA_MUTE);
              else if (act == 0x122) bleKeyboard.write(KEY_MEDIA_VOLUME_UP);
              else if (act == 0x123) bleKeyboard.write(KEY_MEDIA_VOLUME_DOWN);
              else if (act == 0x124) bleKeyboard.write(KEY_MEDIA_NEXT_TRACK);
              else if (act == 0x125) bleKeyboard.write(KEY_MEDIA_PREVIOUS_TRACK);
              else if (act == 0x126) bleKeyboard.write(KEY_MEDIA_STOP);
              else if (act == 0x127) { bleKeyboard.press(KEY_MEDIA_GLOBE); delay(10); bleKeyboard.release(KEY_MEDIA_GLOBE); }
            } else if (act >= 0x130 && act <= 0x134) {
              if (act == 0x130) bleKeyboard.mouseClick(MOUSE_BUTTON_LEFT);
              else if (act == 0x131) bleKeyboard.mouseClick(MOUSE_BUTTON_RIGHT);
              else if (act == 0x132) bleKeyboard.mouseClick(MOUSE_BUTTON_MIDDLE);
              else if (act == 0x133) bleKeyboard.mouseScroll(1);
              else if (act == 0x134) bleKeyboard.mouseScroll(-1);
            } else if (act <= 0xFF) {
              bleKeyboard.write((uint8_t)act);
            }
          }
          sendConfigNotification("COMBO_TRIGGER:{\"idx\":" + String(i) + ",\"act\":" + String(act) + "}");
        } else if (userCombos[i].behavior == 1) { // MODIFIER_HOLD
          if (!isConfigMode && bleKeyboard.isConnected()) {
            if (act >= 0x130 && act <= 0x132) {
              if (act == 0x130) bleKeyboard.mousePress(MOUSE_BUTTON_LEFT);
              else if (act == 0x131) bleKeyboard.mousePress(MOUSE_BUTTON_RIGHT);
              else if (act == 0x132) bleKeyboard.mousePress(MOUSE_BUTTON_MIDDLE);
            } else if (act <= 0xFF) {
              bleKeyboard.press((uint8_t)act);
            }
          }
          sendConfigNotification("COMBO_TRIGGER:{\"idx\":" + String(i) + ",\"act\":" + String(act) + "}");
        } else if (userCombos[i].behavior == 2) { // LAYER_TOGGLE
          uint8_t l = act & 0x07;
          if (l == 0) {
            for (int j = 1; j < NUM_LAYERS; j++) toggleLayers[j] = false;
          } else if (l < NUM_LAYERS) {
            toggleLayers[l] = !toggleLayers[l];
          }
          sendConfigNotification("COMBO_TRIGGER:{\"idx\":" + String(i) + ",\"act\":" + String(act) + "}");
        }
      }
    } else if (!bothPressed && comboRuntime[i].active) {
      comboRuntime[i].active = false;
      comboRuntime[i].lastReleaseTime = now;
      if (userCombos[i].behavior == 1) { // MODIFIER_HOLD
        uint16_t act = userCombos[i].action;
        if (!isConfigMode && bleKeyboard.isConnected()) {
          if (act >= 0x130 && act <= 0x132) {
            if (act == 0x130) bleKeyboard.mouseRelease(MOUSE_BUTTON_LEFT);
            else if (act == 0x131) bleKeyboard.mouseRelease(MOUSE_BUTTON_RIGHT);
            else if (act == 0x132) bleKeyboard.mouseRelease(MOUSE_BUTTON_MIDDLE);
          } else if (act <= 0xFF) {
            bleKeyboard.release((uint8_t)act);
          }
        }
      }
    }
  }
}
