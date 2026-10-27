// =============================================================================
// Profil der rechten Hand (Master: BLE-HID zum Mac, ESP-NOW-Empfänger)
// =============================================================================
// Alles, was nur die rechte Hälfte betrifft: Standard-Config, Layout-Presets und die Scancode-Tabelle
// des Live-Monitors. Pins, Namen und Combo prüft tests/test_side_profiles.js gegen die Firmware.
(function (root) {
  "use strict";

  // Layout-Presets (Belegungen der rechten Hand, nur Ebene 0 wird angewendet)
  const presets = {
    de_qwertz: {
      name: "Deutsch QWERTZ (macOS US-Layout)",
      layers: [
        // Layer 0: Base
        [
          // Row 0: Zahlenreihe (6 Tasten: Col 0..5)
          [ { tap: "KEY_6", label: "6", hold: "NONE" }, { tap: "KEY_7", label: "7", hold: "NONE" }, { tap: "KEY_8", label: "8", hold: "NONE" }, { tap: "KEY_9", label: "9", hold: "NONE" }, { tap: "KEY_0", label: "0", hold: "NONE" }, { tap: "UMLAUT_SZ", label: "ß", hold: "NONE" } ],
          // Row 1: Obere Reihe (6 Tasten: Col 0..5)
          [ { tap: "KEY_Z", label: "Z", hold: "NONE" }, { tap: "KEY_U", label: "U", hold: "NONE" }, { tap: "KEY_I", label: "I", hold: "NONE" }, { tap: "KEY_O", label: "O", hold: "NONE" }, { tap: "KEY_P", label: "P", hold: "NONE" }, { tap: "UMLAUT_UE", label: "ü", hold: "NONE" } ],
          // Row 2: Home Row (Col 0..5 Finger, Col 6 ist Daumen R2C6)
          [ { tap: "KEY_H", label: "H", hold: "NONE" }, { tap: "KEY_J", label: "J", hold: "NONE" }, { tap: "KEY_K", label: "K", hold: "NONE" }, { tap: "KEY_L", label: "L", hold: "NONE" }, { tap: "UMLAUT_OE", label: "ö", hold: "NONE" }, { tap: "UMLAUT_AE", label: "ä", hold: "NONE" }, { tap: "KEY_DELETE", label: "Entf", hold: "NONE" } ],
          // Row 3: Untere Reihe (6 Tasten: Col 0..5)
          [ { tap: "KEY_N", label: "N", hold: "NONE" }, { tap: "KEY_M", label: "M", hold: "NONE" }, { tap: "KEY_COMMA", label: ",", hold: "NONE" }, { tap: "KEY_PERIOD", label: ".", hold: "NONE" }, { tap: "KEY_MINUS", label: "-", hold: "NONE" }, { tap: "KEY_RIGHT_SHIFT", label: "Shift", hold: "NONE" } ],
          // Row 4: Pfeile & Modifier (Col 0 existiert nicht, Col 1..5)
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_LEFT_ARROW", label: "←", hold: "NONE" }, { tap: "KEY_DOWN_ARROW", label: "↓", hold: "NONE" }, { tap: "KEY_UP_ARROW", label: "↑", hold: "NONE" }, { tap: "KEY_RIGHT_ARROW", label: "→", hold: "NONE" }, { tap: "KEY_RIGHT_ALT", label: "Alt", hold: "NONE" } ],
          // Row 5: Thumb Cluster (Alle Daumentasten auf Row 5 / Lila!)
          [ { tap: "KEY_LEFT_GUI", label: "Cmd", hold: "NONE" }, { tap: "KEY_LEFT_ALT", label: "Alt", hold: "NONE" }, { tap: "KEY_RETURN", label: "Enter (2U)", hold: "NONE" }, { tap: "KEY_SPACE", label: "Space (2U)", hold: "NONE" }, { tap: "KEY_TAB", label: "Tab", hold: "NONE" }, { tap: "KEY_BACKSPACE", label: "Bksp", hold: "NONE" }, { tap: "KEY_ESC", label: "Esc", hold: "NONE" } ]
        ],
        // Layer 1: Nav & Pfeile
        [
          [ { tap: "KEY_F6", label: "F6", hold: "NONE" }, { tap: "KEY_F7", label: "F7", hold: "NONE" }, { tap: "KEY_F8", label: "F8", hold: "NONE" }, { tap: "KEY_F9", label: "F9", hold: "NONE" }, { tap: "KEY_F10", label: "F10", hold: "NONE" }, { tap: "KEY_F11", label: "F11", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_HOME", label: "Pos 1", hold: "NONE" }, { tap: "KEY_UP_ARROW", label: "↑", hold: "NONE" }, { tap: "KEY_END", label: "Ende", hold: "NONE" }, { tap: "KEY_PAGE_UP", label: "Bild ↑", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_LEFT_ARROW", label: "←", hold: "NONE" }, { tap: "KEY_DOWN_ARROW", label: "↓", hold: "NONE" }, { tap: "KEY_RIGHT_ARROW", label: "→", hold: "NONE" }, { tap: "KEY_PAGE_DOWN", label: "Bild ↓", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_DELETE", label: "Entf", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_RIGHT_SHIFT", label: "Shift", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_LEFT_ARROW", label: "←", hold: "NONE" }, { tap: "KEY_DOWN_ARROW", label: "↓", hold: "NONE" }, { tap: "KEY_UP_ARROW", label: "↑", hold: "NONE" }, { tap: "KEY_RIGHT_ARROW", label: "→", hold: "NONE" }, { tap: "KEY_RIGHT_ALT", label: "Alt", hold: "NONE" } ],
          [ { tap: "KEY_LEFT_GUI", label: "Cmd", hold: "NONE" }, { tap: "KEY_LEFT_ALT", label: "Alt", hold: "NONE" }, { tap: "KEY_RETURN", label: "Enter (2U)", hold: "NONE" }, { tap: "KEY_SPACE", label: "Space (2U)", hold: "NONE" }, { tap: "KEY_TAB", label: "Tab", hold: "NONE" }, { tap: "KEY_BACKSPACE", label: "Bksp", hold: "NONE" }, { tap: "KEY_ESC", label: "Esc", hold: "NONE" } ]
        ],
        // Layer 2: Symbole & Zahlen (Numpad)
        [
          [ { tap: "KEY_6", label: "6", hold: "NONE" }, { tap: "KEY_7", label: "7", hold: "NONE" }, { tap: "KEY_8", label: "8", hold: "NONE" }, { tap: "KEY_9", label: "9", hold: "NONE" }, { tap: "KEY_0", label: "0", hold: "NONE" }, { tap: "KEY_EQUAL", label: "=", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_7", label: "7", hold: "NONE" }, { tap: "KEY_8", label: "8", hold: "NONE" }, { tap: "KEY_9", label: "9", hold: "NONE" }, { tap: "KEY_SLASH", label: "/", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_4", label: "4", hold: "NONE" }, { tap: "KEY_5", label: "5", hold: "NONE" }, { tap: "KEY_6", label: "6", hold: "NONE" }, { tap: "KEY_MINUS", label: "-", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_DELETE", label: "Entf", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_1", label: "1", hold: "NONE" }, { tap: "KEY_2", label: "2", hold: "NONE" }, { tap: "KEY_3", label: "3", hold: "NONE" }, { tap: "+", label: "+", hold: "NONE" }, { tap: "KEY_RIGHT_SHIFT", label: "Shift", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_0", label: "0", hold: "NONE" }, { tap: "KEY_PERIOD", label: ".", hold: "NONE" }, { tap: "KEY_COMMA", label: ",", hold: "NONE" }, { tap: "KEY_RETURN", label: "Enter", hold: "NONE" }, { tap: "KEY_RIGHT_ALT", label: "Alt", hold: "NONE" } ],
          [ { tap: "KEY_LEFT_GUI", label: "Cmd", hold: "NONE" }, { tap: "KEY_LEFT_ALT", label: "Alt", hold: "NONE" }, { tap: "KEY_RETURN", label: "Enter (2U)", hold: "NONE" }, { tap: "KEY_SPACE", label: "Space (2U)", hold: "NONE" }, { tap: "KEY_TAB", label: "Tab", hold: "NONE" }, { tap: "KEY_BACKSPACE", label: "Bksp", hold: "NONE" }, { tap: "KEY_ESC", label: "Esc", hold: "NONE" } ]
        ],
        // Layer 3: Numpad
        [
          [ { tap: "KEY_6", label: "6", hold: "NONE" }, { tap: "KEY_7", label: "7", hold: "NONE" }, { tap: "KEY_8", label: "8", hold: "NONE" }, { tap: "KEY_9", label: "9", hold: "NONE" }, { tap: "KEY_0", label: "0", hold: "NONE" }, { tap: "KEY_EQUAL", label: "=", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_7", label: "7", hold: "NONE" }, { tap: "KEY_8", label: "8", hold: "NONE" }, { tap: "KEY_9", label: "9", hold: "NONE" }, { tap: "KEY_SLASH", label: "/", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_4", label: "4", hold: "NONE" }, { tap: "KEY_5", label: "5", hold: "NONE" }, { tap: "KEY_6", label: "6", hold: "NONE" }, { tap: "KEY_MINUS", label: "-", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_DELETE", label: "Entf", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_1", label: "1", hold: "NONE" }, { tap: "KEY_2", label: "2", hold: "NONE" }, { tap: "KEY_3", label: "3", hold: "NONE" }, { tap: "+", label: "+", hold: "NONE" }, { tap: "KEY_RIGHT_SHIFT", label: "Shift", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_0", label: "0", hold: "NONE" }, { tap: "KEY_PERIOD", label: ".", hold: "NONE" }, { tap: "KEY_COMMA", label: ",", hold: "NONE" }, { tap: "KEY_RETURN", label: "Enter", hold: "NONE" }, { tap: "KEY_RIGHT_ALT", label: "Alt", hold: "NONE" } ],
          [ { tap: "KEY_LEFT_GUI", label: "Cmd", hold: "NONE" }, { tap: "KEY_LEFT_ALT", label: "Alt", hold: "NONE" }, { tap: "KEY_RETURN", label: "Enter (2U)", hold: "NONE" }, { tap: "KEY_SPACE", label: "Space (2U)", hold: "NONE" }, { tap: "KEY_TAB", label: "Tab", hold: "NONE" }, { tap: "KEY_BACKSPACE", label: "Bksp", hold: "NONE" }, { tap: "KEY_ESC", label: "Esc", hold: "NONE" } ]
        ],
        // Layer 4: Function (F1..F12)
        [
          [ { tap: "KEY_F1", label: "F1", hold: "NONE" }, { tap: "KEY_F2", label: "F2", hold: "NONE" }, { tap: "KEY_F3", label: "F3", hold: "NONE" }, { tap: "KEY_F4", label: "F4", hold: "NONE" }, { tap: "KEY_F5", label: "F5", hold: "NONE" }, { tap: "KEY_F6", label: "F6", hold: "NONE" } ],
          [ { tap: "KEY_F7", label: "F7", hold: "NONE" }, { tap: "KEY_F8", label: "F8", hold: "NONE" }, { tap: "KEY_F9", label: "F9", hold: "NONE" }, { tap: "KEY_F10", label: "F10", hold: "NONE" }, { tap: "KEY_F11", label: "F11", hold: "NONE" }, { tap: "KEY_F12", label: "F12", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_DELETE", label: "Entf", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_RIGHT_SHIFT", label: "Shift", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" } ],
          [ { tap: "KEY_LEFT_GUI", label: "Cmd", hold: "NONE" }, { tap: "KEY_LEFT_ALT", label: "Alt", hold: "NONE" }, { tap: "KEY_RETURN", label: "Enter (2U)", hold: "NONE" }, { tap: "KEY_SPACE", label: "Space (2U)", hold: "NONE" }, { tap: "KEY_TAB", label: "Tab", hold: "NONE" }, { tap: "KEY_BACKSPACE", label: "Bksp", hold: "NONE" }, { tap: "KEY_ESC", label: "Esc", hold: "NONE" } ]
        ],
        // Layer 5: Media & Audio
        [
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_UP_ARROW", label: "Vol +", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_LEFT_ARROW", label: "Prev", hold: "NONE" }, { tap: "KEY_DOWN_ARROW", label: "Vol -", hold: "NONE" }, { tap: "KEY_RIGHT_ARROW", label: "Next", hold: "NONE" }, { tap: "KEY_SPACE", label: "Play/Pause", hold: "NONE" }, { tap: "NONE", label: "Mute", hold: "NONE" }, { tap: "KEY_DELETE", label: "Entf", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_RIGHT_SHIFT", label: "Shift", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" } ],
          [ { tap: "KEY_LEFT_GUI", label: "Cmd", hold: "NONE" }, { tap: "KEY_LEFT_ALT", label: "Alt", hold: "NONE" }, { tap: "KEY_RETURN", label: "Enter (2U)", hold: "NONE" }, { tap: "KEY_SPACE", label: "Space (2U)", hold: "NONE" }, { tap: "KEY_TAB", label: "Tab", hold: "NONE" }, { tap: "KEY_BACKSPACE", label: "Bksp", hold: "NONE" }, { tap: "KEY_ESC", label: "Esc", hold: "NONE" } ]
        ],
        // Layer 6: Shortcuts
        [
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_DELETE", label: "Entf", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_RIGHT_SHIFT", label: "Shift", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" } ],
          [ { tap: "KEY_LEFT_GUI", label: "Cmd", hold: "NONE" }, { tap: "KEY_LEFT_ALT", label: "Alt", hold: "NONE" }, { tap: "KEY_RETURN", label: "Enter (2U)", hold: "NONE" }, { tap: "KEY_SPACE", label: "Space (2U)", hold: "NONE" }, { tap: "KEY_TAB", label: "Tab", hold: "NONE" }, { tap: "KEY_BACKSPACE", label: "Bksp", hold: "NONE" }, { tap: "KEY_ESC", label: "Esc", hold: "NONE" } ]
        ],
        // Layer 7: Custom / Gaming
        [
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_DELETE", label: "Entf", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_RIGHT_SHIFT", label: "Shift", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" } ],
          [ { tap: "KEY_LEFT_GUI", label: "Cmd", hold: "NONE" }, { tap: "KEY_LEFT_ALT", label: "Alt", hold: "NONE" }, { tap: "KEY_RETURN", label: "Enter (2U)", hold: "NONE" }, { tap: "KEY_SPACE", label: "Space (2U)", hold: "NONE" }, { tap: "KEY_TAB", label: "Tab", hold: "NONE" }, { tap: "KEY_BACKSPACE", label: "Bksp", hold: "NONE" }, { tap: "KEY_ESC", label: "Esc", hold: "NONE" } ]
        ]
      ]
    },
    us_qwerty: {
      name: "US QWERTY",
      layers: [
        [
          [ { tap: "KEY_6", label: "6", hold: "NONE" }, { tap: "KEY_7", label: "7", hold: "NONE" }, { tap: "KEY_8", label: "8", hold: "NONE" }, { tap: "KEY_9", label: "9", hold: "NONE" }, { tap: "KEY_0", label: "0", hold: "NONE" }, { tap: "KEY_MINUS", label: "-", hold: "NONE" } ],
          [ { tap: "KEY_Y", label: "Y", hold: "NONE" }, { tap: "KEY_U", label: "U", hold: "NONE" }, { tap: "KEY_I", label: "I", hold: "NONE" }, { tap: "KEY_O", label: "O", hold: "NONE" }, { tap: "KEY_P", label: "P", hold: "NONE" }, { tap: "KEY_LEFT_BRACKET", label: "[", hold: "NONE" } ],
          [ { tap: "KEY_H", label: "H", hold: "NONE" }, { tap: "KEY_J", label: "J", hold: "NONE" }, { tap: "KEY_K", label: "K", hold: "NONE" }, { tap: "KEY_L", label: "L", hold: "NONE" }, { tap: "KEY_SEMICOLON", label: ";", hold: "NONE" }, { tap: "KEY_QUOTE", label: "'", hold: "NONE" }, { tap: "KEY_DELETE", label: "Del", hold: "NONE" } ],
          [ { tap: "KEY_N", label: "N", hold: "NONE" }, { tap: "KEY_M", label: "M", hold: "NONE" }, { tap: "KEY_COMMA", label: ",", hold: "NONE" }, { tap: "KEY_PERIOD", label: ".", hold: "NONE" }, { tap: "KEY_SLASH", label: "/", hold: "NONE" }, { tap: "KEY_RIGHT_SHIFT", label: "Shift", hold: "NONE" } ],
          [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_LEFT_ARROW", label: "←", hold: "NONE" }, { tap: "KEY_DOWN_ARROW", label: "↓", hold: "NONE" }, { tap: "KEY_UP_ARROW", label: "↑", hold: "NONE" }, { tap: "KEY_RIGHT_ARROW", label: "→", hold: "NONE" }, { tap: "KEY_RIGHT_ALT", label: "Alt", hold: "NONE" } ],
          [ { tap: "KEY_LEFT_GUI", label: "Cmd", hold: "NONE" }, { tap: "KEY_LEFT_ALT", label: "Alt", hold: "NONE" }, { tap: "KEY_RETURN", label: "Enter (2U)", hold: "NONE" }, { tap: "KEY_SPACE", label: "Space (2U)", hold: "NONE" }, { tap: "KEY_TAB", label: "Tab", hold: "NONE" }, { tap: "KEY_BACKSPACE", label: "Bksp", hold: "NONE" }, { tap: "KEY_ESC", label: "Esc", hold: "NONE" } ]
        ]
      ]
    }
  };

  // Physische Scancode-Zuordnung der rechten Hand (Fallback des Live-Monitors, immer Ebene 0)
  const scancodeMap = {
    // Row 0: Zahlenreihe (6 Tasten: Col 0..5)
    "Digit6": { r: 0, c: 0, label: "6" },
    "Digit7": { r: 0, c: 1, label: "7" },
    "Digit8": { r: 0, c: 2, label: "8" },
    "Digit9": { r: 0, c: 3, label: "9" },
    "Digit0": { r: 0, c: 4, label: "0" },
    "Minus":  { r: 0, c: 5, label: "-" },

    // Row 1: QWERTY / QWERTZ (6 Tasten: Col 0..5)
    "KeyZ": { r: 1, c: 0, label: "Z" },
    "KeyY": { r: 1, c: 0, label: "Y" },
    "KeyU": { r: 1, c: 1, label: "U" },
    "KeyI": { r: 1, c: 2, label: "I" },
    "KeyO": { r: 1, c: 3, label: "O" },
    "KeyP": { r: 1, c: 4, label: "P" },
    "BracketLeft":  { r: 1, c: 5, label: "[" },

    // Row 2: Home Row (Col 0..5 Finger, Col 6 ist Daumentaste R2C6)
    "KeyH": { r: 2, c: 0, label: "H" },
    "KeyJ": { r: 2, c: 1, label: "J" },
    "KeyK": { r: 2, c: 2, label: "K" },
    "KeyL": { r: 2, c: 3, label: "L" },
    "Semicolon": { r: 2, c: 4, label: ";" },
    "Quote":     { r: 2, c: 5, label: "'" },

    // Row 3: Bottom Row (6 Tasten: Col 0..5)
    "KeyN": { r: 3, c: 0, label: "N" },
    "KeyM": { r: 3, c: 1, label: "M" },
    "Comma":  { r: 3, c: 2, label: "," },
    "Period": { r: 3, c: 3, label: "." },
    "Slash":  { r: 3, c: 4, label: "/" },
    "ShiftRight": { r: 3, c: 5, label: "Shift" },

    // Row 4: Navigation / Mods (R4C0 existiert nicht, Tasten sind Col 1..5)
    "ArrowLeft":  { r: 4, c: 1, label: "←" },
    "ArrowDown":  { r: 4, c: 2, label: "↓" },
    "ArrowUp":    { r: 4, c: 3, label: "↑" },
    "ArrowRight": { r: 4, c: 4, label: "→" },
    "AltRight":   { r: 4, c: 5, label: "Alt" },

    // Daumen-Cluster (Alle an Lila / Row 5):
    // R5C0: Oben mitte (über R5C3)
    "MetaRight":  { r: 5, c: 0, label: "Cmd" },
    "MetaLeft":   { r: 5, c: 0, label: "Cmd" },
    // R5C1: Ganz oben links (Rot + Lila)
    "AltLeft":    { r: 5, c: 1, label: "Alt (Rot)" },
    // R5C6: Mitte links (Gelb + Lila)
    "Escape":     { r: 5, c: 6, label: "Esc (Gelb)" },
    // R5C4: Daumentaste Unten links
    "Tab":        { r: 5, c: 4, label: "Tab" },
    // R5C3: 2U Daumentaste Mitte
    "Space":      { r: 5, c: 3, label: "Space (2U)" },
    // R5C2: 2U Daumentaste Rechts
    "Enter":      { r: 5, c: 2, label: "Enter (2U)" },
    "NumpadEnter": { r: 5, c: 2, label: "Enter (2U)" }
  };

  root.Dactyl.registerSideProfile({
    id: "R",
    // Master: hält die BLE-HID-Verbindung zum Mac; Firmware ohne DEVICE_INFO.side ist immer der Master
    master: true,
    label: "Rechte Hand",
    bleName: "Dactyl Config",
    deviceName: "Dactyl Keyboard",
    configCombo: [{ r: 0, c: 0 }, { r: 4, c: 5 }],
    comboLabel: "R4C5 + R0C0",
    absentKeys: ["4_0", "5_5"],
    // Die rechte Vorlage hat auf R5C5 historisch eine Aktion; sie bleibt ohne Wirkung (wie server.py)
    strictAbsentKeys: false,
    presets,
    scancodeMap,
    // Ansicht: Knopf data-hand, CSS-Klasse der Matrix, Position in der Split-Ansicht (links = 0)
    handView: "right",
    cssClass: "right-half",
    displayOrder: 1,
    exportPrefix: "",
    // Rechte Hand: Daumen-Cluster links neben dem Finger-Cluster
    thumbsFirst: true,
    thumbDefs: [
      { r: 5, c: 6, col: "1", row: "1", isTall: false, defaultLabel: "Esc" },
      { r: 5, c: 0, col: "2", row: "1", isTall: false, defaultLabel: "Cmd" },
      { r: 5, c: 1, col: "1", row: "2", isTall: false, defaultLabel: "Alt" },
      { r: 5, c: 4, col: "1", row: "3", isTall: false, defaultLabel: "Tab" },
      { r: 5, c: 3, col: "2", row: "2 / span 2", isTall: true, defaultLabel: "Space (2U)" },
      { r: 5, c: 2, col: "3", row: "2 / span 2", isTall: true, defaultLabel: "Enter (2U)" }
    ],
    rowWires: [
      { gpio: 13, color: "Gelb" }, { gpio: 14, color: "Orange" }, { gpio: 27, color: "Grün" },
      { gpio: 26, color: "Braun" }, { gpio: 33, color: "Blau" }, { gpio: 32, color: "Lila" }
    ],
    colWires: [
      { gpio: 23, color: "Gelb" }, { gpio: 19, color: "Orange" }, { gpio: 18, color: "Grün" },
      { gpio: 17, color: "Braun" }, { gpio: 16, color: "Blau" }, { gpio: 4, color: "Lila" },
      { gpio: 25, color: "Rot" }
    ],
    diodeHint: "Dioden: Kathode zur Zeile",
    // Hinweis zum Standby-Timeout (README "Power Management": Schätzung nach ESP32-Datenblatt)
    standbyHint: "Drosselt die CPU auf 80 MHz und verlangsamt den Matrix-Scan. Spart laut Datenblatt (CPU ohne Funk) ca. 10–37 mA (Schätzung, nicht gemessen); der Funk bleibt an, die Tastatur tippt bei Berührung sofort weiter.",
    heatmapStorageKey: "dactyl_key_heatmap_v1",
    // Ebenennamen und fehlende Einstellungen ergänzt normalizeConfig
    defaultConfig: {
      settings: { deviceName: "Dactyl Keyboard", debounceMs: 5, comboTimeoutMs: 40 },
      // Eigene Kopie, damit eine Änderung der Standard-Config das Preset nicht verändert
      layers: JSON.parse(JSON.stringify(presets.de_qwertz.layers)),
      combos: [
        {
          id: "combo-1",
          name: "J + K -> Escape",
          key1: { r: 2, c: 1, label: "J" },
          key2: { r: 2, c: 2, label: "K" },
          behavior: "KEY_PRESS",
          action: "KEY_ESC",
          actionLabel: "Escape"
        },
        {
          id: "combo-2",
          name: "J + L -> Ctrl (Modifier Hold)",
          key1: { r: 2, c: 1, label: "J" },
          key2: { r: 2, c: 3, label: "L" },
          behavior: "MODIFIER_HOLD",
          action: "KEY_LEFT_CTRL",
          actionLabel: "Strg / Control"
        }
      ]
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
