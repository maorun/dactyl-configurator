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
 *   KEYMAP[][][], HOLDMAP[][][], DTAPMAP[][][], layerNames[],
 *   MAX_KEY_PAIRS, ACT_KEY_PAIR_BASE, KeyPair, userKeyPairs[], numKeyPairs,
 *   momentaryLayers[], toggleLayers[], keyState[][], pressedAction[][],
 *   keyPressTime[][], keySentToHost[][],
 *   isConfigMode, enterConfigRequested, exitConfigRequested, lastActivityTime,
 *   configMutex, preferences, pConfigCharacteristic, bleKeyboard,
 *   deviceName, debounceMs, comboTimeoutMs, tappingTermMs, standbyTimeoutMinutes, deepSleepTimeoutMinutes,
 *   void handleConfigCommand(String, bool = false);
 *   void sendConfigNotification(String, bool = false);
 */

// Physische Config-Mode-Combo (500 ms halten). Rechts: R0C0 + R4C5; links gespiegelt: R0C5 + R4C0
#ifndef CONFIG_COMBO_R1
#define CONFIG_COMBO_R1 0
#define CONFIG_COMBO_C1 0
#define CONFIG_COMBO_R2 4
#define CONFIG_COMBO_C2 5
#endif

// Gerätename ohne NVS-Eintrag und BLE-Name im Config Mode
#ifndef DEFAULT_DEVICE_NAME
#define DEFAULT_DEVICE_NAME "Dactyl Keyboard"
#endif
#ifndef CONFIG_BLE_NAME
#define CONFIG_BLE_NAME "Dactyl Config"
#endif
// Hälfte in DEVICE_INFO ("R" oder "L"): App und Server erkennen damit das Board am Port
#ifndef DEVICE_SIDE
#define DEVICE_SIDE "R"
#endif

// Standardwert des Tapping-Terms (Mod-Tap und Tap-Dance) ohne NVS-Eintrag; zur Laufzeit gilt tappingTermMs
#ifndef TAPPING_TERM_MS
#define TAPPING_TERM_MS 200
#endif
#define TAPPING_TERM_MIN_MS 100
#define TAPPING_TERM_MAX_MS 500

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

// Ermittelt Tap-, Halte- und Doppel-Tipp-Aktion einer Taste inkl. transparentem Fallback auf Layer 0.
// Transparent ist eine Taste nur, wenn alle drei Aktionen 0 sind. Eine Taste nur mit Halte-Aktion
// (Tap = 0) verhält sich wie eine normale Taste. Doppel-Tipp ohne Tap-Aktion bleibt ohne Wirkung.
void resolveKeyActions(uint8_t layer, uint8_t r, uint8_t c, uint16_t &tapAct, uint16_t &holdAct, uint16_t &dtapAct) {
  tapAct = KEYMAP[layer][r][c];
  holdAct = HOLDMAP[layer][r][c];
  dtapAct = DTAPMAP[layer][r][c];
  if (tapAct == 0 && holdAct == 0 && dtapAct == 0) {
    tapAct = KEYMAP[0][r][c];
    holdAct = HOLDMAP[0][r][c];
    dtapAct = DTAPMAP[0][r][c];
  }
  if (tapAct == 0) dtapAct = 0;
  if (tapAct == 0 && holdAct != 0) {
    tapAct = holdAct;
    holdAct = 0;
  }
}

void resolveKeyActions(uint8_t layer, uint8_t r, uint8_t c, uint16_t &tapAct, uint16_t &holdAct) {
  uint16_t dtapAct;
  resolveKeyActions(layer, r, c, tapAct, holdAct, dtapAct);
}

// Eine der beiden Tasten der physischen Config-Combo (rechts R0C0/R4C5, links R0C5/R4C0)
bool isConfigComboKey(uint8_t r, uint8_t c) {
  return (r == CONFIG_COMBO_R1 && c == CONFIG_COMBO_C1) || (r == CONFIG_COMBO_R2 && c == CONFIG_COMBO_C2);
}

// Solange beide Config-Combo-Tasten gehalten werden, senden diese beiden Tasten nichts an den Host
bool isConfigComboSuppressed(uint8_t r, uint8_t c) {
  return keyState[CONFIG_COMBO_R1][CONFIG_COMBO_C1] && keyState[CONFIG_COMBO_R2][CONFIG_COMBO_C2] &&
    ((r == CONFIG_COMBO_R1 && c == CONFIG_COMBO_C1) || (r == CONFIG_COMBO_R2 && c == CONFIG_COMBO_C2));
}

bool isComboCandidateKey(uint8_t r, uint8_t c);
bool wasComboRecentlyActive(uint8_t r, uint8_t c);

// -----------------------------------------------------------------------------
// Tastenpaare (ACT_KEY_PAIR_BASE + Index): eine Taste drückt zwei Tasten gleichzeitig
// -----------------------------------------------------------------------------
bool isKeyPairAction(uint16_t action) {
  return action >= ACT_KEY_PAIR_BASE && action < ACT_KEY_PAIR_BASE + MAX_KEY_PAIRS;
}

// Liefert das Paar zur Aktion oder nullptr, wenn der Index nicht (mehr) belegt ist
const KeyPair* keyPairForAction(uint16_t action) {
  if (!isKeyPairAction(action)) return nullptr;
  uint8_t idx = action - ACT_KEY_PAIR_BASE;
  if (idx >= numKeyPairs || userKeyPairs[idx].first == 0 || userKeyPairs[idx].second == 0) return nullptr;
  return &userKeyPairs[idx];
}

// Erste Taste zuerst drücken (z. B. Shift vor "."), dann die zweite
bool pressKeyPair(uint16_t action) {
  const KeyPair* p = keyPairForAction(action);
  if (!p) return false;
  bleKeyboard.press(p->first);
  bleKeyboard.press(p->second);
  return true;
}

// In umgekehrter Reihenfolge loslassen, damit kein Zeichen ohne Modifier ankommt
void releaseKeyPair(uint16_t action) {
  const KeyPair* p = keyPairForAction(action);
  if (!p) return;
  bleKeyboard.release(p->second);
  bleKeyboard.release(p->first);
}

void tapKeyPair(uint16_t action) {
  if (!pressKeyPair(action)) return;
  delay(5);
  releaseKeyPair(action);
}

void releaseHeldKeyPairs();

// -----------------------------------------------------------------------------
// Umlaute (ACT_UMLAUT_BASE + Index): Zeichenfolge für das macOS-Layout "U.S."
// -----------------------------------------------------------------------------
bool isUmlautAction(uint16_t action) {
  return action >= ACT_UMLAUT_BASE && action < ACT_UMLAUT_BASE + NUM_UMLAUT_ACTIONS;
}

// true, wenn (r, c) zu einer aktiven Combo gehört: deren Tasten sind verbraucht (releaseAll), ihre
// pressedAction ist nicht am Host gedrückt
bool isActiveComboMember(uint8_t r, uint8_t c) {
  for (uint8_t i = 0; i < numCombos; i++) {
    if (!comboRuntime[i].active) continue;
    if ((userCombos[i].r1 == r && userCombos[i].c1 == c) || (userCombos[i].r2 == r && userCombos[i].c2 == c)) return true;
  }
  return false;
}

// Bitmaske der Modifier (Bit i = Code 0x80 + i), die diese Hälfte gerade am Host hält: Tasten, Tastenpaare
// und Combos mit MODIFIER_HOLD. Große und gesetzte ASCII-Zeichen ('A', '!') halten implizit das linke Shift.
uint8_t heldModifierMask() {
  uint8_t mask = 0;
  auto add = [&mask](uint16_t code) {
    if (code >= KEY_LEFT_CTRL && code <= KEY_RIGHT_GUI) mask |= (uint8_t)(1 << (code - KEY_LEFT_CTRL));
    else if (code > 0 && code < 0x80 && (dactylAsciiToHid((uint8_t)code) & DACTYL_ASCII_SHIFT))
      mask |= (uint8_t)(1 << (KEY_LEFT_SHIFT - KEY_LEFT_CTRL));
  };
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      if (!keySentToHost[r][c] || isActiveComboMember(r, c)) continue;
      uint16_t act = pressedAction[r][c];
      const KeyPair* p = keyPairForAction(act);
      if (p) {
        add(p->first);
        add(p->second);
      } else {
        add(act);
      }
    }
  }
  for (uint8_t i = 0; i < numCombos; i++) {
    if (comboRuntime[i].active && userCombos[i].behavior == 1) add(userCombos[i].action);
  }
  return mask;
}

// Tottaste Alt + u, danach der Vokal; Großbuchstaben über das ASCII-Zeichen (Shift implizit). ß = Alt + s.
// Gehaltene Modifier (z. B. Shift) werden vorher gelöst und danach wiederhergestellt: sonst käme Alt + Shift + u
// an, und das Release der Folge löste ein gehaltenes Alt.
void sendUmlaut(uint16_t action) {
  static const char vowels[NUM_UMLAUT_ACTIONS] = { 'a', 'o', 'u', 'A', 'O', 'U', 0 };
  if (!isUmlautAction(action)) return;
  char vowel = vowels[action - ACT_UMLAUT_BASE];
  uint8_t held = heldModifierMask();
  for (uint8_t i = 0; i < 8; i++) {
    if (held & (1 << i)) bleKeyboard.release((uint8_t)(KEY_LEFT_CTRL + i));
  }
  bleKeyboard.press(KEY_LEFT_ALT);
  bleKeyboard.press(vowel ? 'u' : 's');
  delay(5);
  bleKeyboard.release(vowel ? 'u' : 's');
  bleKeyboard.release(KEY_LEFT_ALT);
  if (vowel) {
    delay(5);
    bleKeyboard.press(vowel);
    delay(5);
    bleKeyboard.release(vowel);
  }
  for (uint8_t i = 0; i < 8; i++) {
    if (held & (1 << i)) bleKeyboard.press((uint8_t)(KEY_LEFT_CTRL + i));
  }
}

// -----------------------------------------------------------------------------
// One-Shot-Modifier und Caps Word: den Zustand führt der Master (DactylOneShot.h, SplitArbitratedKeyboard)
// -----------------------------------------------------------------------------
bool isOneShotAction(uint16_t action) {
  return action >= ACT_ONE_SHOT_BASE && action < ACT_ONE_SHOT_BASE + NUM_ONE_SHOT_ACTIONS;
}

uint8_t oneShotMaskForAction(uint16_t action) {
  return isOneShotAction(action) ? (uint8_t)(1u << (action - ACT_ONE_SHOT_BASE)) : 0;
}

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
  } else if (isKeyPairAction(action)) {
    uint8_t idx = action - ACT_KEY_PAIR_BASE;
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"Paar %d\",\"code\":%d,\"layer\":%d}", r, c, idx, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("Tastenpaar gedrückt: [R%d, C%d] (L%d) -> Paar %d\n", r, c, currentLayer, idx);
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (!isComboCandidateKey(r, c) && !isConfigComboSuppressed(r, c)) {
        if (pressKeyPair(action)) keySentToHost[r][c] = true;
      }
    }
  } else if (isUmlautAction(action)) {
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"Umlaut %d\",\"code\":%d,\"layer\":%d}", r, c, action - ACT_UMLAUT_BASE, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("Umlaut gedrückt: [R%d, C%d] (L%d) -> 0x%03X\n", r, c, currentLayer, action);
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (!isComboCandidateKey(r, c) && !isConfigComboSuppressed(r, c)) {
        sendUmlaut(action);
        keySentToHost[r][c] = true;
      }
    }
  } else if (isOneShotAction(action) || action == ACT_CAPS_WORD) {
    static const char* const osmNames[NUM_ONE_SHOT_ACTIONS] = {
      "OSM Ctrl", "OSM Shift", "OSM Alt", "OSM Cmd", "OSM RCtrl", "OSM RShift", "OSM RAlt", "OSM RCmd"
    };
    const char* name = action == ACT_CAPS_WORD ? "Caps Word" : osmNames[action - ACT_ONE_SHOT_BASE];
    char buf[128];
    snprintf(buf, sizeof(buf), "KEY_PRESS:{\"r\":%d,\"c\":%d,\"key\":\"%s\",\"code\":%d,\"layer\":%d}", r, c, name, action, currentLayer);
    sendConfigNotification(String(buf));
    Serial.printf("%s gedrückt: [R%d, C%d] (L%d)\n", name, r, c, currentLayer);
    if (!isConfigMode && bleKeyboard.isConnected() && !isConfigComboSuppressed(r, c)) {
      if (action == ACT_CAPS_WORD) bleKeyboard.capsWordToggle();
      else bleKeyboard.oneShotPress(oneShotMaskForAction(action));
      keySentToHost[r][c] = true;
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
      } else if (!wasComboRecentlyActive(r, c) && !isConfigComboKey(r, c)) {
        // Wenn die Taste vor Ablauf des Combo-Timeouts losgelassen wurde (schneller Einzeltipp)
        if (action == 0x130) bleKeyboard.mouseClick(MOUSE_BUTTON_LEFT);
        else if (action == 0x131) bleKeyboard.mouseClick(MOUSE_BUTTON_RIGHT);
        else if (action == 0x132) bleKeyboard.mouseClick(MOUSE_BUTTON_MIDDLE);
        else if (action == 0x133) bleKeyboard.mouseScroll(1);
        else if (action == 0x134) bleKeyboard.mouseScroll(-1);
      }
    }
  } else if (isOneShotAction(action)) {
    if (keySentToHost[r][c]) {
      if (bleKeyboard.isConnected()) bleKeyboard.oneShotRelease(oneShotMaskForAction(action));
      keySentToHost[r][c] = false;
    }
  } else if (action == ACT_CAPS_WORD) {
    keySentToHost[r][c] = false;
  } else if (isUmlautAction(action)) {
    // Die Folge ist beim Drücken schon vollständig gesendet; nur ein gepufferter Combo-Kandidat sendet jetzt
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (keySentToHost[r][c]) {
        keySentToHost[r][c] = false;
      } else if (!wasComboRecentlyActive(r, c) && !isConfigComboKey(r, c)) {
        sendUmlaut(action);
      }
    }
  } else if (isKeyPairAction(action)) {
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (keySentToHost[r][c]) {
        releaseKeyPair(action);
        keySentToHost[r][c] = false;
      } else if (!wasComboRecentlyActive(r, c) && !isConfigComboKey(r, c)) {
        // Schneller Einzeltipp vor Ablauf des Combo-Timeouts
        tapKeyPair(action);
      }
    }
  } else if (action > 0 && action <= 0xFF) {
    if (!isConfigMode && bleKeyboard.isConnected()) {
      if (keySentToHost[r][c]) {
        bleKeyboard.release((uint8_t)action);
        keySentToHost[r][c] = false;
      } else if (!wasComboRecentlyActive(r, c) && !isConfigComboKey(r, c)) {
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

// -----------------------------------------------------------------------------
// Doppel-Tipp (Tap-Dance): zweiter Tipp innerhalb von TAPPING_TERM_MS nach dem ersten Loslassen
// -----------------------------------------------------------------------------
// Ein erster Tipp einer Taste mit Doppel-Tipp-Aktion wird zurückgehalten (waiting). Kommt der zweite
// Druck rechtzeitig, löst er die Doppel-Tipp-Aktion aus (active, solange gehalten). Sonst wird der
// erste Tipp nachträglich als normaler Tipp gesendet: nach Ablauf des Fensters oder sofort, wenn eine
// andere Taste gedrückt wird (Reihenfolge der Zeichen bleibt erhalten).
struct DoubleTapKey {
  bool waiting;          // Erster Tipp losgelassen, wartet auf zweiten Druck
  bool active;           // Doppel-Tipp-Aktion ist gedrückt
  uint16_t tapAction;    // Aufgeschobener Einzel-Tipp
  uint16_t dtapAction;
  uint8_t layer;
  unsigned long pressTime;     // Anschlag des ersten Tipps (für die Combo-Grace-Prüfung beim Nachholen)
  unsigned long releaseTime;
};
DoubleTapKey doubleTap[NUM_ROWS][NUM_COLS];
// Beim Anschlag aufgelöste Doppel-Tipp-Aktion (ein Layer-Wechsel während des Haltens ändert sie nicht)
uint16_t tapHoldDtap[NUM_ROWS][NUM_COLS];

void resetDoubleTap() {
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      doubleTap[r][c] = { false, false, 0, 0, 0, 0, 0 };
      tapHoldDtap[r][c] = 0;
    }
  }
}

void sendKeyReleaseNotification(uint8_t r, uint8_t c) {
  char buf[64];
  snprintf(buf, sizeof(buf), "KEY_RELEASE:{\"r\":%d,\"c\":%d}", r, c);
  sendConfigNotification(String(buf));
}

// Wartenden Einzel-Tipp jetzt als normalen Tipp senden
void flushDoubleTap(uint8_t r, uint8_t c) {
  DoubleTapKey &d = doubleTap[r][c];
  if (!d.waiting) return;
  d.waiting = false;
  // Der Tipp gehört zum ersten Anschlag: dessen Zeitstempel für wasComboRecentlyActive() herstellen
  unsigned long savedPressTime = keyPressTime[r][c];
  keyPressTime[r][c] = d.pressTime;
  dispatchPress(r, c, d.tapAction, d.layer);
  dispatchRelease(r, c, d.tapAction);
  keyPressTime[r][c] = savedPressTime;
  // Die UI hat KEY_RELEASE schon beim Loslassen erhalten; nach dem späten KEY_PRESS erneut senden
  sendKeyReleaseNotification(r, c);
}

// Eine andere Taste wird gedrückt: wartende Einzel-Tipps vorher senden
void flushDoubleTapsExcept(uint8_t exceptR, uint8_t exceptC) {
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      if (r == exceptR && c == exceptC) continue;
      flushDoubleTap(r, c);
    }
  }
}

void doubleTapTick(unsigned long now) {
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      if (doubleTap[r][c].waiting && (unsigned long)(now - doubleTap[r][c].releaseTime) >= tappingTermMs) {
        flushDoubleTap(r, c);
      }
    }
  }
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
  // Taste nur mit Doppel-Tipp-Aktion (ohne Halte-Aktion): Halten drückt die Tap-Aktion wie eine normale Taste
  if (k.holdAction == 0) k.holdAction = k.tapAction;
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
    } else if (isKeyPairAction(act)) {
      if (pressKeyPair(act)) keySentToHost[r][c] = true;
    } else if (isUmlautAction(act)) {
      sendUmlaut(act);
      keySentToHost[r][c] = true;
    } else if (act >= 0x130 && act <= 0x132) {
      if (act == 0x130) bleKeyboard.mousePress(MOUSE_BUTTON_LEFT);
      else if (act == 0x131) bleKeyboard.mousePress(MOUSE_BUTTON_RIGHT);
      else bleKeyboard.mousePress(MOUSE_BUTTON_MIDDLE);
      keySentToHost[r][c] = true;
    }
  }
}

// Vor einer Änderung der Paar-Tabelle: an den Host gesendete Paare mit der noch gültigen Tabelle loslassen.
// Sonst bleibt eine Taste am Host hängen, weil das spätere Release die geänderte Tabelle liest.
// Die Taste gilt danach als verbraucht: ihr physisches Loslassen sendet nichts mehr.
void releaseHeldKeyPairs() {
  for (int r = 0; r < NUM_ROWS; r++) {
    for (int c = 0; c < NUM_COLS; c++) {
      if (!keySentToHost[r][c] || !isKeyPairAction(pressedAction[r][c])) continue;
      if (bleKeyboard.isConnected()) releaseKeyPair(pressedAction[r][c]);
      keySentToHost[r][c] = false;
      pressedAction[r][c] = 0;
      tapHold[r][c].holdActive = false;
      doubleTap[r][c].active = false;
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
  DoubleTapKey &d = doubleTap[r][c];
  if (d.active) {
    d.active = false;
    keySentToHost[r][c] = false;
    dispatchRelease(r, c, d.dtapAction);
  }
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

// Gibt true zurück, wenn die Taste vom Tap-Hold-Automaten behandelt wurde.
// dtapAct != 0: ein Tipp wird nicht sofort gesendet, sondern wartet auf einen möglichen zweiten Tipp.
bool tapHoldOnRelease(uint8_t r, uint8_t c, unsigned long now, uint16_t dtapAct = 0) {
  TapHoldKey &k = tapHold[r][c];
  // Release wird vor dem Tick verarbeitet: Tapping-Term hier erneut prüfen,
  // sonst würde ein Halten über tappingTermMs noch als Tap gewertet.
  if (k.pending && (unsigned long)(now - k.pressTime) >= tappingTermMs) {
    activateTapHoldAsHold(r, c);
  }
  if (k.pending) {
    k.pending = false;
    if (dtapAct != 0) {
      doubleTap[r][c] = { true, false, k.tapAction, dtapAct, k.layer, k.pressTime, now };
      return true;
    }
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
      if (tapHold[r][c].pending && (unsigned long)(now - tapHold[r][c].pressTime) >= tappingTermMs) {
        activateTapHoldAsHold(r, c);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Matrix-Ereignisse (vom Scan in loop() aufgerufen)
// -----------------------------------------------------------------------------
void applyMatrixKeyChange(uint8_t r, uint8_t c, bool isPressed) {
  unsigned long now = millis();
  if (isPressed) {
    // Wartende Einzel-Tipps anderer Tasten zuerst senden, damit die Reihenfolge der Zeichen stimmt
    flushDoubleTapsExcept(r, c);
    DoubleTapKey &d = doubleTap[r][c];
    bool isSecondTap = d.waiting && (unsigned long)(now - d.releaseTime) < tappingTermMs;
    // Fenster abgelaufen, aber noch kein Tick: ersten Tipp vor dem neuen Anschlag nachholen
    if (!isSecondTap) flushDoubleTap(r, c);
    keyPressTime[r][c] = now;
    keySentToHost[r][c] = false;
    // Ein weiterer Tastendruck entscheidet offene Mod-Tap-Tasten sofort als Hold
    resolvePendingTapHoldsAsHold(r, c);
    uint8_t layer = getActiveLayer();
    if (isSecondTap) {
      d.waiting = false;
      d.active = true;
      dispatchPress(r, c, d.dtapAction, layer);
      return;
    }
    uint16_t tapAct, holdAct, dtapAct;
    resolveKeyActions(layer, r, c, tapAct, holdAct, dtapAct);
    if (holdAct != 0 || dtapAct != 0) {
      tapHoldOnPress(r, c, tapAct, holdAct, layer, now);
      tapHoldDtap[r][c] = dtapAct;
    } else {
      dispatchPress(r, c, tapAct, layer);
    }
  } else {
    DoubleTapKey &d = doubleTap[r][c];
    if (d.active) {
      d.active = false;
      dispatchRelease(r, c, d.dtapAction);
    } else if (!tapHoldOnRelease(r, c, now, tapHoldDtap[r][c])) {
      dispatchRelease(r, c, pressedAction[r][c]);
    }
    tapHoldDtap[r][c] = 0;
    // KEY_RELEASE erst nach einem eventuellen Tap-KEY_PRESS senden, damit die UI nicht hängen bleibt
    sendKeyReleaseNotification(r, c);

    // keyPressTime erst NACH wasComboRecentlyActive auf 0 setzen,
    // damit der echte Anschlag-Zeitstempel für den Grace-Period-Check erhalten bleibt!
    keyPressTime[r][c] = 0;
  }
}

void onMatrixKeyChange(uint8_t r, uint8_t c, bool isPressed) {
  applyMatrixKeyChange(r, c, isPressed);
  // Reines Matrix-Ereignis für die Diagnose (Matrix-Test), unabhängig von Belegung, Ebene und Tap-Hold.
  // Erst nach den HID-Ereignissen senden: die serielle Ausgabe verzögert den Tastendruck nicht.
  // Nur USB-Serial, nie BLE: kein Keylogger-Kanal und keine zusätzliche Last neben den Sync-Acks.
  char matrixBuf[48];
  snprintf(matrixBuf, sizeof(matrixBuf), "MATRIX:{\"r\":%d,\"c\":%d,\"pressed\":%d}", r, c, isPressed ? 1 : 0);
  Serial.println(matrixBuf);
}

// Zeitgesteuerte Entscheidungen: Mod-Tap Tapping-Term und gepufferte Combo-Kandidaten
void processDeferredKeys(unsigned long now) {
  tapHoldTick(now);
  doubleTapTick(now);

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
            } else if (isKeyPairAction(act)) {
              if (pressKeyPair(act)) keySentToHost[r][c] = true;
            } else if (isUmlautAction(act)) {
              sendUmlaut(act);
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
  ok = (preferences.putBytes("dtapmap", DTAPMAP, sizeof(DTAPMAP)) == sizeof(DTAPMAP)) && ok;
  preferences.end();
  Serial.println(ok ? "NVS: Keymap gespeichert." : "NVS: FEHLER beim Speichern der Keymap!");
  return ok;
}

// FNV-1a-Prüfsumme über die EINKOMPILIERTEN Defaults (KEYMAP + HOLDMAP vor dem NVS-Laden) und
// KEYMAP_DEFAULTS_ID. Die ID ist im Repository 0; "Auf Dactyl flashen" (server.py) setzt bei jedem Flash
// aus der App eine neue ID. Ein Flash aus der App übernimmt so immer die App-Belegung, ein reiner
// Firmware-Flash aus dem Repository (gleiche Defaults, gleiche ID) behält die Belegung im NVS.
// DTAPMAP zählt nur mit, wenn sie belegt ist: eine leere DTAPMAP ergibt den Fingerprint älterer Firmware,
// sonst würde das erste Update auf diese Firmware die gespeicherte Belegung überschreiben.
uint32_t keymapDefaultsFingerprint() {
  uint32_t h = 2166136261u;
  const uint32_t id = KEYMAP_DEFAULTS_ID;
  bool hasDtap = false;
  const uint8_t* dtapBytes = (const uint8_t*)DTAPMAP;
  for (size_t i = 0; i < sizeof(DTAPMAP); i++) {
    if (dtapBytes[i] != 0) { hasDtap = true; break; }
  }
  const uint8_t* parts[4] = { (const uint8_t*)KEYMAP, (const uint8_t*)HOLDMAP, dtapBytes, (const uint8_t*)&id };
  const size_t sizes[4] = { sizeof(KEYMAP), sizeof(HOLDMAP), hasDtap ? sizeof(DTAPMAP) : 0, sizeof(id) };
  for (int p = 0; p < 4; p++) {
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
    ok = (preferences.putBytes("dtapmap", DTAPMAP, sizeof(DTAPMAP)) == sizeof(DTAPMAP)) && ok;
    // Neue App-Belegung über einer gespeicherten Keymap: sie verweist auf die einkompilierten Tastenpaare (PAIR_n),
    // alte Paare aus dem NVS daher verwerfen. Ohne Keymap (erster Start) gibt es nichts zu ersetzen.
    if (hasKeymap) {
      preferences.remove("num_pairs");
      preferences.remove("pairs_data");
    }
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
    // Fehlende Doppel-Tipp-Belegung (Firmware vor Tap-Dance) ebenso mit den einkompilierten Defaults ergänzen
    bool hasDtapmap = preferences.isKey("dtapmap") && preferences.getBytesLength("dtapmap") == sizeof(DTAPMAP);
    bool dtapmapOk = hasDtapmap || preferences.putBytes("dtapmap", DTAPMAP, sizeof(DTAPMAP)) == sizeof(DTAPMAP);
    if (!hasStoredHash && holdmapOk && dtapmapOk) {
      preferences.putUInt("defaults_fp", defaultsHash);
      preferences.remove("fw_build");
    }
    preferences.getBytes("keymap", KEYMAP, sizeof(KEYMAP));
    Serial.println("NVS: Gespeicherte Keymap geladen.");
    if (hasHoldmap) {
      preferences.getBytes("holdmap", HOLDMAP, sizeof(HOLDMAP));
    }
    if (hasDtapmap) {
      preferences.getBytes("dtapmap", DTAPMAP, sizeof(DTAPMAP));
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
    deviceName = preferences.getString("dev_name", DEFAULT_DEVICE_NAME);
  }
  if (preferences.isKey("debounce")) {
    debounceMs = preferences.getUChar("debounce", 5);
  }
  if (preferences.isKey("combo_to")) {
    comboTimeoutMs = preferences.getUShort("combo_to", 40);
  }
  if (preferences.isKey("tap_term")) {
    uint16_t tt = preferences.getUShort("tap_term", TAPPING_TERM_MS);
    if (tt >= TAPPING_TERM_MIN_MS && tt <= TAPPING_TERM_MAX_MS) tappingTermMs = tt;
  }
  // Tastenpaare: gespeicherte Liste (auch leer nach CLEAR_PAIRS + SAVE_PAIRS) überschreibt die einkompilierte
  if (preferences.isKey("num_pairs")) {
    uint8_t n = preferences.getUChar("num_pairs", 0);
    if (n == 0) {
      numKeyPairs = 0;
    } else if (n <= MAX_KEY_PAIRS && preferences.isKey("pairs_data") &&
               preferences.getBytesLength("pairs_data") == n * sizeof(KeyPair)) {
      preferences.getBytes("pairs_data", userKeyPairs, n * sizeof(KeyPair));
      numKeyPairs = n;
    }
    Serial.printf("NVS: %d Tastenpaare geladen.\n", numKeyPairs);
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
  Serial.printf("NVS: Timeouts & Settings geladen: Standby=%u Min, DeepSleep=%u Min, Debounce=%u ms, ComboTO=%u ms, TappingTerm=%u ms, Name='%s'\n",
    standbyTimeoutMinutes, deepSleepTimeoutMinutes, debounceMs, comboTimeoutMs, tappingTermMs, deviceName.c_str());
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

bool saveTappingTermToNVS(uint16_t ms) {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUShort("tap_term", ms) > 0;
  preferences.end();
  if (ok) tappingTermMs = ms;
  Serial.printf("NVS: Tapping-Term %s: %u ms\n", ok ? "gespeichert" : "FEHLER", ms);
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

bool saveKeyPairsToNVS() {
  if (!preferences.begin("dactyl", false)) return false;
  bool ok = preferences.putUChar("num_pairs", numKeyPairs) > 0;
  size_t len = numKeyPairs * sizeof(KeyPair);
  // Leere Liste: putBytes mit Länge 0 meldet 0 Bytes, das ist kein Fehler
  if (len > 0) {
    ok = (preferences.putBytes("pairs_data", userKeyPairs, len) == len) && ok;
  } else {
    preferences.remove("pairs_data");
  }
  preferences.end();
  Serial.printf("NVS: %d Tastenpaare %s.\n", numKeyPairs, ok ? "gespeichert" : "FEHLER beim Speichern");
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

// Parst "<CMD> l r c tap [hold [dtap]]". Fehlende Werte werden auf 0 gesetzt, überzählige abgelehnt.
// fmt endet mit " %c", damit ein siebter Wert erkannt wird.
bool parseKeyCommand(const String &cmd, const char *fmt, int &l, int &r, int &c, int &tap, int &hold, int &dtap) {
  hold = 0;
  dtap = 0;
  char extra;
  int n = sscanf(cmd.c_str(), fmt, &l, &r, &c, &tap, &hold, &dtap, &extra);
  if (n < 4 || n > 6) return false;
  return l >= 0 && l < NUM_LAYERS && r >= 0 && r < NUM_ROWS && c >= 0 && c < NUM_COLS &&
         tap >= 0 && tap <= 0xFFFF && hold >= 0 && hold <= 0xFFFF && dtap >= 0 && dtap <= 0xFFFF;
}

void handleConfigCommand(String cmd, bool fromBle) {
  cmd.trim();
  if (cmd.length() == 0) return;

  // Über BLE ist im normalen Tastaturmodus nur GET_INFO erlaubt. Der Config-Modus wird ausschließlich
  // physisch (Config-Combo CONFIG_COMBO_*) oder per USB-Serial (ENTER_CONFIG) aktiviert.
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
    int l, r, c, val, hold, dtap;
    if (parseKeyCommand(cmd, "SET_KEY %d %d %d %d %d %d %c", l, r, c, val, hold, dtap)) {
      KEYMAP[l][r][c] = (uint16_t)val;
      HOLDMAP[l][r][c] = (uint16_t)hold;
      DTAPMAP[l][r][c] = (uint16_t)dtap;
      if (saveKeymapToNVS()) {
        sendConfigNotification("OK SET_KEY " + String(l) + " " + String(r) + " " + String(c) + " " + String(val) + " " + String(hold) + " " + String(dtap));
      } else {
        sendConfigNotification("ERR NVS SET_KEY");
      }
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd.startsWith("SET_K ")) {
    // Schnelles RAM-Update für Batch-Sync (NVS wird am Ende einmalig mit SAVE_NVS geschrieben)
    int l, r, c, val, hold, dtap;
    if (parseKeyCommand(cmd, "SET_K %d %d %d %d %d %d %c", l, r, c, val, hold, dtap)) {
      KEYMAP[l][r][c] = (uint16_t)val;
      HOLDMAP[l][r][c] = (uint16_t)hold;
      DTAPMAP[l][r][c] = (uint16_t)dtap;
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
  } else if (cmd.startsWith("SET_TAPPING_TERM ")) {
    int tt = cmd.substring(17).toInt();
    if (tt >= TAPPING_TERM_MIN_MS && tt <= TAPPING_TERM_MAX_MS) {
      sendConfigNotification(saveTappingTermToNVS((uint16_t)tt) ? "OK SET_TAPPING_TERM " + String(tt) : String("ERR NVS SET_TAPPING_TERM"));
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
  } else if (cmd == "CLEAR_PAIRS") {
    releaseHeldKeyPairs();
    numKeyPairs = 0;
    sendConfigNotification("OK CLEAR_PAIRS");
  } else if (cmd.startsWith("ADD_PAIR ")) {
    // ADD_PAIR <erste> <zweite>: beide Tastatur-Codes 1..255, wird als nächster Index angehängt
    int first, second;
    char extra;
    if (sscanf(cmd.c_str(), "ADD_PAIR %d %d %c", &first, &second, &extra) == 2 &&
        numKeyPairs < MAX_KEY_PAIRS && first >= 1 && first <= 0xFF && second >= 1 && second <= 0xFF) {
      userKeyPairs[numKeyPairs].first = (uint8_t)first;
      userKeyPairs[numKeyPairs].second = (uint8_t)second;
      numKeyPairs++;
      sendConfigNotification("OK ADD_PAIR " + String(numKeyPairs - 1));
    } else {
      sendConfigNotification("ERR ARGS " + cmd);
    }
  } else if (cmd == "SAVE_PAIRS") {
    sendConfigNotification(saveKeyPairsToNVS() ? "OK SAVE_PAIRS" : "ERR NVS SAVE_PAIRS");
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
        sendMatrixData("DTAP_DATA:", DTAPMAP, l);
      }
      sendConfigNotification("CONFIG_SYNC_DONE", true);
    }
  } else if (cmd == "GET_INFO") {
    uint8_t m[6];
    esp_read_mac(m, ESP_MAC_BT);
    char buf[288];
    snprintf(buf, sizeof(buf), "DEVICE_INFO:{\"name\":\"%s\",\"side\":\"" DEVICE_SIDE "\",\"mac\":\"%02X:%02X:%02X:%02X:%02X:%02X\",\"standby_timeout\":%u,\"sleep_timeout\":%u,\"debounce_ms\":%u,\"combo_timeout_ms\":%u,\"tapping_term_ms\":%u,\"config_mode\":%s}",
      isConfigMode ? CONFIG_BLE_NAME : deviceName.c_str(),
      m[0], m[1], m[2], m[3], m[4], m[5],
      (unsigned)standbyTimeoutMinutes, (unsigned)deepSleepTimeoutMinutes,
      (unsigned)debounceMs, (unsigned)comboTimeoutMs, (unsigned)tappingTermMs,
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
            } else if (isUmlautAction(act)) {
              sendUmlaut(act);
            } else if (isOneShotAction(act)) {
              bleKeyboard.oneShotPress(oneShotMaskForAction(act));
              bleKeyboard.oneShotRelease(oneShotMaskForAction(act));
            } else if (act == ACT_CAPS_WORD) {
              bleKeyboard.capsWordToggle();
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
