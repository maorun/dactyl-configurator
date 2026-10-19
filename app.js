// =============================================================================
// Dactyl Keyboard Configurator — Client Application
// =============================================================================

const KEYCODES = [
  { group: "Buchstaben", keys: [
    { code: "KEY_A", label: "A", char: "a" }, { code: "KEY_B", label: "B", char: "b" },
    { code: "KEY_C", label: "C", char: "c" }, { code: "KEY_D", label: "D", char: "d" },
    { code: "KEY_E", label: "E", char: "e" }, { code: "KEY_F", label: "F", char: "f" },
    { code: "KEY_G", label: "G", char: "g" }, { code: "KEY_H", label: "H", char: "h" },
    { code: "KEY_I", label: "I", char: "i" }, { code: "KEY_J", label: "J", char: "j" },
    { code: "KEY_K", label: "K", char: "k" }, { code: "KEY_L", label: "L", char: "l" },
    { code: "KEY_M", label: "M", char: "m" }, { code: "KEY_N", label: "N", char: "n" },
    { code: "KEY_O", label: "O", char: "o" }, { code: "KEY_P", label: "P", char: "p" },
    { code: "KEY_Q", label: "Q", char: "q" }, { code: "KEY_R", label: "R", char: "r" },
    { code: "KEY_S", label: "S", char: "s" }, { code: "KEY_T", label: "T", char: "t" },
    { code: "KEY_U", label: "U", char: "u" }, { code: "KEY_V", label: "V", char: "v" },
    { code: "KEY_W", label: "W", char: "w" }, { code: "KEY_X", label: "X", char: "x" },
    { code: "KEY_Y", label: "Y", char: "y" }, { code: "KEY_Z", label: "Z", char: "z" },
    { code: "KEY_LEFT_BRACKET", label: "Ü (Ger)", char: "ü" },
    { code: "KEY_SEMICOLON", label: "Ö (Ger)", char: "ö" },
    { code: "KEY_QUOTE", label: "Ä (Ger)", char: "ä" },
    { code: "KEY_MINUS", label: "ß (Ger)", char: "ß" }
  ]},
  { group: "Zahlen & Symbole", keys: [
    { code: "KEY_1", label: "1", char: "1" }, { code: "KEY_2", label: "2", char: "2" },
    { code: "KEY_3", label: "3", char: "3" }, { code: "KEY_4", label: "4", char: "4" },
    { code: "KEY_5", label: "5", char: "5" }, { code: "KEY_6", label: "6", char: "6" },
    { code: "KEY_7", label: "7", char: "7" }, { code: "KEY_8", label: "8", char: "8" },
    { code: "KEY_9", label: "9", char: "9" }, { code: "KEY_0", label: "0", char: "0" },
    { code: "KEY_MINUS", label: "-", char: "-" }, { code: "KEY_EQUAL", label: "=", char: "=" },
    { code: "KEY_LEFT_BRACKET", label: "[", char: "[" }, { code: "KEY_RIGHT_BRACKET", label: "]", char: "]" },
    { code: "KEY_BACKSLASH", label: "\\", char: "\\" }, { code: "KEY_SEMICOLON", label: ";", char: ";" },
    { code: "KEY_QUOTE", label: "'", char: "'" }, { code: "KEY_GRAVE", label: "`", char: "`" },
    { code: "KEY_COMMA", label: ",", char: "," }, { code: "KEY_PERIOD", label: ".", char: "." },
    { code: "KEY_SLASH", label: "/", char: "/" }
  ]},
  { group: "Steuerung & Navigation", keys: [
    { code: "KEY_SPACE", label: "Space", char: " " },
    { code: "KEY_RETURN", label: "Enter", char: "\n" },
    { code: "KEY_ESC", label: "Escape", char: "" },
    { code: "KEY_BACKSPACE", label: "Backspace", char: "" },
    { code: "KEY_TAB", label: "Tab", char: "\t" },
    { code: "KEY_DELETE", label: "Delete", char: "" },
    { code: "KEY_UP_ARROW", label: "↑ Oben", char: "" },
    { code: "KEY_DOWN_ARROW", label: "↓ Unten", char: "" },
    { code: "KEY_LEFT_ARROW", label: "← Links", char: "" },
    { code: "KEY_RIGHT_ARROW", label: "→ Rechts", char: "" },
    { code: "KEY_PAGE_UP", label: "Bild ↑", char: "" },
    { code: "KEY_PAGE_DOWN", label: "Bild ↓", char: "" },
    { code: "KEY_HOME", label: "Pos 1", char: "" },
    { code: "KEY_END", label: "Ende", char: "" }
  ]},
  { group: "Modifier Tasten", keys: [
    { code: "KEY_LEFT_CTRL", label: "Strg (Links)", char: "" },
    { code: "KEY_LEFT_SHIFT", label: "Umschalt (Links)", char: "" },
    { code: "KEY_LEFT_ALT", label: "Alt/Option (Links)", char: "" },
    { code: "KEY_LEFT_GUI", label: "Cmd/Win (Links)", char: "" },
    { code: "KEY_RIGHT_CTRL", label: "Strg (Rechts)", char: "" },
    { code: "KEY_RIGHT_SHIFT", label: "Umschalt (Rechts)", char: "" },
    { code: "KEY_RIGHT_ALT", label: "Alt/Option (Rechts)", char: "" },
    { code: "KEY_RIGHT_GUI", label: "Cmd/Win (Rechts)", char: "" }
  ]},
  { group: "Funktionstasten (F1 bis F12)", keys: [
    { code: "KEY_F1", label: "F1", char: "" }, { code: "KEY_F2", label: "F2", char: "" },
    { code: "KEY_F3", label: "F3", char: "" }, { code: "KEY_F4", label: "F4", char: "" },
    { code: "KEY_F5", label: "F5", char: "" }, { code: "KEY_F6", label: "F6", char: "" },
    { code: "KEY_F7", label: "F7", char: "" }, { code: "KEY_F8", label: "F8", char: "" },
    { code: "KEY_F9", label: "F9", char: "" }, { code: "KEY_F10", label: "F10", char: "" },
    { code: "KEY_F11", label: "F11", char: "" }, { code: "KEY_F12", label: "F12", char: "" },
    { code: "KEY_F13", label: "F13", char: "" }, { code: "KEY_F14", label: "F14", char: "" },
    { code: "KEY_F15", label: "F15", char: "" }, { code: "KEY_F16", label: "F16", char: "" },
    { code: "KEY_F17", label: "F17", char: "" }, { code: "KEY_F18", label: "F18", char: "" },
    { code: "KEY_F19", label: "F19", char: "" }, { code: "KEY_F20", label: "F20", char: "" },
    { code: "KEY_F21", label: "F21", char: "" }, { code: "KEY_F22", label: "F22", char: "" },
    { code: "KEY_F23", label: "F23", char: "" }, { code: "KEY_F24", label: "F24", char: "" }
  ]},
  { group: "Ziffernblock (Numpad)", keys: [
    { code: "KEY_NUM_0", label: "Numpad 0", char: "0" },
    { code: "KEY_NUM_1", label: "Numpad 1", char: "1" },
    { code: "KEY_NUM_2", label: "Numpad 2", char: "2" },
    { code: "KEY_NUM_3", label: "Numpad 3", char: "3" },
    { code: "KEY_NUM_4", label: "Numpad 4", char: "4" },
    { code: "KEY_NUM_5", label: "Numpad 5", char: "5" },
    { code: "KEY_NUM_6", label: "Numpad 6", char: "6" },
    { code: "KEY_NUM_7", label: "Numpad 7", char: "7" },
    { code: "KEY_NUM_8", label: "Numpad 8", char: "8" },
    { code: "KEY_NUM_9", label: "Numpad 9", char: "9" },
    { code: "KEY_NUM_PLUS", label: "Numpad +", char: "+" },
    { code: "KEY_NUM_MINUS", label: "Numpad -", char: "-" },
    { code: "KEY_NUM_ASTERISK", label: "Numpad *", char: "*" },
    { code: "KEY_NUM_SLASH", label: "Numpad /", char: "/" },
    { code: "KEY_NUM_ENTER", label: "Numpad Enter", char: "\n" },
    { code: "KEY_NUM_PERIOD", label: "Numpad . / ,", char: "." }
  ]},
  { group: "Media & Lautstärke", keys: [
    { code: "MEDIA_PLAY_PAUSE", label: "⏯ Play / Pause", char: "" },
    { code: "MEDIA_MUTE", label: "🔇 Stumm (Mute)", char: "" },
    { code: "MEDIA_VOLUME_UP", label: "🔊 Lauter (Vol +)", char: "" },
    { code: "MEDIA_VOLUME_DOWN", label: "🔉 Leiser (Vol -)", char: "" },
    { code: "MEDIA_NEXT_TRACK", label: "⏭ Nächster Titel (Next)", char: "" },
    { code: "MEDIA_PREVIOUS_TRACK", label: "⏮ Vorheriger Titel (Prev)", char: "" },
    { code: "MEDIA_STOP", label: "⏹ Stop", char: "" }
  ]},
  { group: "Erweiterte Steuerung & System", keys: [
    { code: "MAC_GLOBE", label: "🌐 Mac Fn / Globus-Taste (Emoji & Sprache)", char: "" },
    { code: "KEY_CAPS_LOCK", label: "⇪ Caps Lock (Großschrift)", char: "" },
    { code: "KEY_INSERT", label: "Einfügen (Insert)", char: "" },
    { code: "KEY_PRTSC", label: "Drucken (Print Screen)", char: "" },
    { code: "NONE", label: "--- Keine Belegung (Transparent)", char: "" }
  ]},
  { group: "Layer Umschalter", keys: [
    { code: "MO_0", label: "Momentary Layer 0 (Base)", char: "" },
    { code: "MO_1", label: "Momentary Layer 1", char: "" },
    { code: "MO_2", label: "Momentary Layer 2", char: "" },
    { code: "MO_3", label: "Momentary Layer 3", char: "" },
    { code: "MO_4", label: "Momentary Layer 4", char: "" },
    { code: "MO_5", label: "Momentary Layer 5", char: "" },
    { code: "MO_6", label: "Momentary Layer 6", char: "" },
    { code: "MO_7", label: "Momentary Layer 7", char: "" },
    { code: "TG_0", label: "Toggle Layer 0 (Zurück zur Base)", char: "" },
    { code: "TG_1", label: "Toggle Layer 1", char: "" },
    { code: "TG_2", label: "Toggle Layer 2", char: "" },
    { code: "TG_3", label: "Toggle Layer 3", char: "" },
    { code: "TG_4", label: "Toggle Layer 4", char: "" },
    { code: "TG_5", label: "Toggle Layer 5", char: "" },
    { code: "TG_6", label: "Toggle Layer 6", char: "" },
    { code: "TG_7", label: "Toggle Layer 7", char: "" }
  ]}
];

// Presets
const PRESETS = {
  de_qwertz: {
    name: "Deutsch QWERTZ (macOS)",
    layers: [
      // Layer 0: Base
      [
        // Row 0: Zahlenreihe (6 Tasten: Col 0..5)
        [ { tap: "KEY_6", label: "6", hold: "NONE" }, { tap: "KEY_7", label: "7", hold: "NONE" }, { tap: "KEY_8", label: "8", hold: "NONE" }, { tap: "KEY_9", label: "9", hold: "NONE" }, { tap: "KEY_0", label: "0", hold: "NONE" }, { tap: "KEY_MINUS", label: "ß", hold: "NONE" } ],
        // Row 1: Obere Reihe (6 Tasten: Col 0..5)
        [ { tap: "KEY_Z", label: "Z", hold: "NONE" }, { tap: "KEY_U", label: "U", hold: "NONE" }, { tap: "KEY_I", label: "I", hold: "NONE" }, { tap: "KEY_O", label: "O", hold: "NONE" }, { tap: "KEY_P", label: "P", hold: "NONE" }, { tap: "KEY_LEFT_BRACKET", label: "Ü", hold: "NONE" } ],
        // Row 2: Home Row (Col 0..5 Finger, Col 6 ist Daumen R2C6)
        [ { tap: "KEY_H", label: "H", hold: "NONE" }, { tap: "KEY_J", label: "J", hold: "NONE" }, { tap: "KEY_K", label: "K", hold: "NONE" }, { tap: "KEY_L", label: "L", hold: "NONE" }, { tap: "KEY_SEMICOLON", label: "Ö", hold: "NONE" }, { tap: "KEY_QUOTE", label: "Ä", hold: "NONE" }, { tap: "KEY_DELETE", label: "Entf", hold: "NONE" } ],
        // Row 3: Untere Reihe (6 Tasten: Col 0..5)
        [ { tap: "KEY_N", label: "N", hold: "NONE" }, { tap: "KEY_M", label: "M", hold: "NONE" }, { tap: "KEY_COMMA", label: ",", hold: "NONE" }, { tap: "KEY_PERIOD", label: ".", hold: "NONE" }, { tap: "KEY_SLASH", label: "-", hold: "NONE" }, { tap: "KEY_RIGHT_SHIFT", label: "Shift", hold: "NONE" } ],
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
        [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_1", label: "1", hold: "NONE" }, { tap: "KEY_2", label: "2", hold: "NONE" }, { tap: "KEY_3", label: "3", hold: "NONE" }, { tap: "KEY_EQUAL", label: "+", hold: "NONE" }, { tap: "KEY_RIGHT_SHIFT", label: "Shift", hold: "NONE" } ],
        [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_0", label: "0", hold: "NONE" }, { tap: "KEY_PERIOD", label: ".", hold: "NONE" }, { tap: "KEY_COMMA", label: ",", hold: "NONE" }, { tap: "KEY_RETURN", label: "Enter", hold: "NONE" }, { tap: "KEY_RIGHT_ALT", label: "Alt", hold: "NONE" } ],
        [ { tap: "KEY_LEFT_GUI", label: "Cmd", hold: "NONE" }, { tap: "KEY_LEFT_ALT", label: "Alt", hold: "NONE" }, { tap: "KEY_RETURN", label: "Enter (2U)", hold: "NONE" }, { tap: "KEY_SPACE", label: "Space (2U)", hold: "NONE" }, { tap: "KEY_TAB", label: "Tab", hold: "NONE" }, { tap: "KEY_BACKSPACE", label: "Bksp", hold: "NONE" }, { tap: "KEY_ESC", label: "Esc", hold: "NONE" } ]
      ],
      // Layer 3: Numpad
      [
        [ { tap: "KEY_6", label: "6", hold: "NONE" }, { tap: "KEY_7", label: "7", hold: "NONE" }, { tap: "KEY_8", label: "8", hold: "NONE" }, { tap: "KEY_9", label: "9", hold: "NONE" }, { tap: "KEY_0", label: "0", hold: "NONE" }, { tap: "KEY_EQUAL", label: "=", hold: "NONE" } ],
        [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_7", label: "7", hold: "NONE" }, { tap: "KEY_8", label: "8", hold: "NONE" }, { tap: "KEY_9", label: "9", hold: "NONE" }, { tap: "KEY_SLASH", label: "/", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" } ],
        [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_4", label: "4", hold: "NONE" }, { tap: "KEY_5", label: "5", hold: "NONE" }, { tap: "KEY_6", label: "6", hold: "NONE" }, { tap: "KEY_MINUS", label: "-", hold: "NONE" }, { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_DELETE", label: "Entf", hold: "NONE" } ],
        [ { tap: "NONE", label: "---", hold: "NONE" }, { tap: "KEY_1", label: "1", hold: "NONE" }, { tap: "KEY_2", label: "2", hold: "NONE" }, { tap: "KEY_3", label: "3", hold: "NONE" }, { tap: "KEY_EQUAL", label: "+", hold: "NONE" }, { tap: "KEY_RIGHT_SHIFT", label: "Shift", hold: "NONE" } ],
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

// Standard Layer-Namen (Layer 0 bis 7)
const DEFAULT_LAYER_NAMES = [
  "Base", "Nav & Pfeile", "Symbole", "Numpad",
  "Function", "Media", "Shortcuts", "Custom"
];

// BLE GATT Service & Characteristic UUIDs
const CONFIG_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CONFIG_CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

// Action Code to Numeric uint16 mapping for Firmware NVS
const ACTION_TO_NUMERIC = {
  "NONE": 0,
  "": 0,
  // Modifiers
  "KEY_LEFT_CTRL": 0x80, // 128
  "KEY_LEFT_SHIFT": 0x81, // 129
  "KEY_LEFT_ALT": 0x82, // 130
  "KEY_LEFT_GUI": 0x83, // 131
  "KEY_RIGHT_CTRL": 0x84, // 132
  "KEY_RIGHT_SHIFT": 0x85, // 133
  "KEY_RIGHT_ALT": 0x86, // 134
  "KEY_RIGHT_GUI": 0x87, // 135

  // System & Control
  "KEY_RETURN": 0xB0, // 176
  "KEY_ESC": 0xB1, // 177
  "KEY_BACKSPACE": 0xB2, // 178
  "KEY_TAB": 0xB3, // 179
  "KEY_CAPS_LOCK": 0xC1, // 193
  "KEY_DELETE": 0xD4, // 212
  "KEY_INSERT": 0xD1, // 209
  "KEY_PAGE_UP": 0xD3, // 211
  "KEY_PAGE_DOWN": 0xD6, // 214
  "KEY_HOME": 0xD2, // 210
  "KEY_END": 0xD5, // 213

  // Arrows
  "KEY_UP_ARROW": 0xDA, // 218
  "KEY_DOWN_ARROW": 0xD9, // 217
  "KEY_LEFT_ARROW": 0xD8, // 216
  "KEY_RIGHT_ARROW": 0xD7, // 215

  "KEY_PRTSC": 0xCE, // 206

  // Function Keys F1..F12 (0xC2..0xCD) & F13..F24 (0xF0..0xFB)
  "KEY_F1": 0xC2, "KEY_F2": 0xC3, "KEY_F3": 0xC4, "KEY_F4": 0xC5,
  "KEY_F5": 0xC6, "KEY_F6": 0xC7, "KEY_F7": 0xC8, "KEY_F8": 0xC9,
  "KEY_F9": 0xCA, "KEY_F10": 0xCB, "KEY_F11": 0xCC, "KEY_F12": 0xCD,
  "KEY_F13": 0xF0, "KEY_F14": 0xF1, "KEY_F15": 0xF2, "KEY_F16": 0xF3,
  "KEY_F17": 0xF4, "KEY_F18": 0xF5, "KEY_F19": 0xF6, "KEY_F20": 0xF7,
  "KEY_F21": 0xF8, "KEY_F22": 0xF9, "KEY_F23": 0xFA, "KEY_F24": 0xFB,

  // Numpad Keys
  "KEY_NUM_0": 0xEA, "KEY_NUM_1": 0xE1, "KEY_NUM_2": 0xE2, "KEY_NUM_3": 0xE3,
  "KEY_NUM_4": 0xE4, "KEY_NUM_5": 0xE5, "KEY_NUM_6": 0xE6, "KEY_NUM_7": 0xE7,
  "KEY_NUM_8": 0xE8, "KEY_NUM_9": 0xE9,
  "KEY_NUM_SLASH": 0xDC, "KEY_NUM_ASTERISK": 0xDD, "KEY_NUM_MINUS": 0xDE,
  "KEY_NUM_PLUS": 0xDF, "KEY_NUM_ENTER": 0xE0, "KEY_NUM_PERIOD": 0xEB,

  // Media Keys (0x120..0x126)
  "MEDIA_PLAY_PAUSE": 0x120,
  "MEDIA_MUTE": 0x121,
  "MEDIA_VOLUME_UP": 0x122,
  "MEDIA_VOLUME_DOWN": 0x123,
  "MEDIA_NEXT_TRACK": 0x124,
  "MEDIA_PREVIOUS_TRACK": 0x125,
  "MEDIA_STOP": 0x126,
  "MAC_GLOBE": 0x127,

  // Layer switches (0x100..0x107 and 0x110..0x117)
  "MO_0": 0x100, "MO_1": 0x101, "MO_2": 0x102, "MO_3": 0x103, "MO_4": 0x104,
  "MO_5": 0x105, "MO_6": 0x106, "MO_7": 0x107,
  "TG_0": 0x110, "TG_1": 0x111, "TG_2": 0x112, "TG_3": 0x113, "TG_4": 0x114,
  "TG_5": 0x115, "TG_6": 0x116, "TG_7": 0x117
};

function actionCodeToNumeric(code) {
  if (!code || code === "NONE") return 0;
  if (ACTION_TO_NUMERIC[code] !== undefined) {
    return ACTION_TO_NUMERIC[code];
  }
  // Check KEY_A..KEY_Z -> 'a'..'z'
  if (code.startsWith("KEY_") && code.length === 5 && code[4] >= 'A' && code[4] <= 'Z') {
    return code[4].toLowerCase().charCodeAt(0);
  }
  // Check KEY_0..KEY_9 -> '0'..'9'
  if (code.startsWith("KEY_") && code.length === 5 && code[4] >= '0' && code[4] <= '9') {
    return code[4].charCodeAt(0);
  }
  // Punctuation
  const punct = {
    "KEY_SPACE": 32,
    "KEY_MINUS": 45,
    "KEY_EQUAL": 61,
    "KEY_LEFT_BRACKET": 91,
    "KEY_RIGHT_BRACKET": 93,
    "KEY_BACKSLASH": 92,
    "KEY_SEMICOLON": 59,
    "KEY_QUOTE": 39,
    "KEY_GRAVE": 96,
    "KEY_COMMA": 44,
    "KEY_PERIOD": 46,
    "KEY_SLASH": 47
  };
  if (punct[code] !== undefined) return punct[code];
  return 0;
}
const actionToNumeric = actionCodeToNumeric;

function findDefinitionByCode(numericCode) {
  if (!numericCode || numericCode === 0) return { label: "---", tap: "NONE" };
  for (const [key, num] of Object.entries(ACTION_TO_NUMERIC)) {
    if (num === numericCode) {
      let lbl = key.replace("KEY_", "").replace("ACT_", "");
      if (key === "ACT_MAC_GLOBE") lbl = "Globe";
      return { label: lbl, tap: key };
    }
  }
  if (numericCode >= 97 && numericCode <= 122) {
    const ch = String.fromCharCode(numericCode).toUpperCase();
    return { label: ch, tap: `KEY_${ch}` };
  }
  if (numericCode >= 48 && numericCode <= 57) {
    const ch = String.fromCharCode(numericCode);
    return { label: ch, tap: `KEY_${ch}` };
  }
  const punctRev = {
    32: { label: "Space", tap: "KEY_SPACE" },
    45: { label: "-", tap: "KEY_MINUS" },
    61: { label: "=", tap: "KEY_EQUAL" },
    91: { label: "[", tap: "KEY_LEFT_BRACKET" },
    93: { label: "]", tap: "KEY_RIGHT_BRACKET" },
    92: { label: "\\", tap: "KEY_BACKSLASH" },
    59: { label: ";", tap: "KEY_SEMICOLON" },
    39: { label: "'", tap: "KEY_QUOTE" },
    96: { label: "`", tap: "KEY_GRAVE" },
    44: { label: ",", tap: "KEY_COMMA" },
    46: { label: ".", tap: "KEY_PERIOD" },
    47: { label: "/", tap: "KEY_SLASH" }
  };
  if (punctRev[numericCode]) return punctRev[numericCode];
  return { label: `Key ${numericCode}`, tap: `KEY_${numericCode}` };
}

// Standard-Konfiguration
const DEFAULT_CONFIG = {
  settings: {
    deviceName: "Dactyl Keyboard",
    debounceMs: 5,
    comboTimeoutMs: 40
  },
  layerNames: [...DEFAULT_LAYER_NAMES],
  layers: PRESETS.de_qwertz.layers,
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
};

// State
let currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let activeLayerIndex = 0;
let activeHandView = "right"; // "right", "left", "both"
let thumbClusterFormat = "2x3"; // "2x3" or "3x2"
let selectedKey = null; // { r, c, side, isThumb }
let serialPort = null;
let serialReader = null;
let serialReadPromise = null;
let keepReading = true;

// Web Bluetooth State
let bleDevice = null;
let bleServer = null;
let bleConfigChar = null;

// Active pressed keys set: stores strings like "R_2_1"
const activePressedKeys = new Set();

// Initialisierung
document.addEventListener("DOMContentLoaded", () => {
  initUI();
  populateKeycodeSelects();
  renderLayerButtons();
  renderMatrix();
  renderCombosTable();
  setupEventListeners();
  setupBrowserKeyboardHooks();
  loadSavedConfigFromServer();
});

async function loadSavedConfigFromServer() {
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const data = await res.json();
      if (data && data.layers && data.layers.length > 0) {
        currentConfig = data;
        if (!currentConfig.layerNames || !Array.isArray(currentConfig.layerNames)) {
          currentConfig.layerNames = [...DEFAULT_LAYER_NAMES];
        }
        if (currentConfig.settings) {
          if (currentConfig.settings.deviceName) {
            const el = document.getElementById("deviceNameInput");
            if (el) el.value = currentConfig.settings.deviceName;
          }
          if (currentConfig.settings.debounceMs) {
            const el = document.getElementById("debounceInput");
            if (el) el.value = currentConfig.settings.debounceMs;
          }
          if (currentConfig.settings.comboTimeoutMs) {
            const el = document.getElementById("comboTimeoutInput");
            if (el) el.value = currentConfig.settings.comboTimeoutMs;
          }
          if (currentConfig.settings.standbyTimeoutMinutes !== undefined) {
            const el = document.getElementById("standbyTimeoutSelect");
            if (el) el.value = String(currentConfig.settings.standbyTimeoutMinutes);
          }
          if (currentConfig.settings.sleepTimeoutMinutes !== undefined) {
            const el = document.getElementById("sleepTimeoutSelect");
            if (el) el.value = String(currentConfig.settings.sleepTimeoutMinutes);
          }
        }
        renderLayerButtons();
        renderMatrix();
        renderCombosTable();
        showToast("Gespeicherte Konfiguration geladen!");
      }
    }
  } catch (e) {
    console.warn("Could not load config from server:", e);
  }
}

async function saveConfigToServer() {
  try {
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentConfig)
    });
  } catch (e) {
    console.warn("Could not auto-save config to server:", e);
  }
}

function renderLayerButtons() {
  const container = document.getElementById("layerButtons");
  if (!container) return;
  container.innerHTML = "";

  const names = currentConfig.layerNames || DEFAULT_LAYER_NAMES;
  for (let i = 0; i < 8; i++) {
    const btn = document.createElement("button");
    btn.className = "layer-btn" + (i === activeLayerIndex ? " active" : "");
    btn.dataset.layer = i;
    const name = names[i] || `Layer ${i}`;
    btn.textContent = `L${i}: ${name}`;
    btn.addEventListener("click", () => {
      document.querySelectorAll(".layer-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeLayerIndex = i;
      updateLayerNameInput();
      renderMatrix();
      if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
    });
    container.appendChild(btn);
  }
  updateLayerNameInput();
}

function updateLayerNameInput() {
  const input = document.getElementById("layerNameInput");
  if (!input) return;
  const names = currentConfig.layerNames || DEFAULT_LAYER_NAMES;
  input.value = names[activeLayerIndex] || `Layer ${activeLayerIndex}`;
}

async function renameActiveLayer() {
  const input = document.getElementById("layerNameInput");
  if (!input) return;
  const newName = input.value.trim();
  if (!newName) {
    showToast("Bitte gib einen Namen für die Ebene ein.");
    return;
  }
  if (!currentConfig.layerNames) {
    currentConfig.layerNames = [...DEFAULT_LAYER_NAMES];
  }
  currentConfig.layerNames[activeLayerIndex] = newName;
  renderLayerButtons();

  // An ESP32 per Bluetooth oder USB senden
  if (bleConfigChar) {
    await sendBleCommand(`SET_NAME ${activeLayerIndex} ${newName}`);
  } else if (serialPort && serialPort.writable) {
    await sendSerialCommand(`SET_NAME ${activeLayerIndex} ${newName}`);
  }

  saveConfigToServer();
  showToast(`Ebene ${activeLayerIndex} in "${newName}" umbenannt!`);
}

function initUI() {
  // Tab Buttons
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  // Hand Switcher Buttons
  document.querySelectorAll(".hand-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".hand-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeHandView = btn.dataset.hand;
      renderMatrix();
      showToast(`Ansicht: ${btn.textContent}`);
    });
  });

  // Apply Layout Preset Button
  const btnPreset = document.getElementById("btnApplyPreset");
  if (btnPreset) {
    btnPreset.addEventListener("click", () => {
      const presetKey = document.getElementById("layoutPresetSelect").value;
      if (PRESETS[presetKey]) {
        currentConfig.layers[0] = JSON.parse(JSON.stringify(PRESETS[presetKey].layers[0]));
        renderMatrix();
        showToast(`Preset '${PRESETS[presetKey].name}' angewendet!`);
      }
    });
  }

  // Connect Serial Button (USB Monitor)
  const btnConnect = document.getElementById("btnConnect");
  if (btnConnect) {
    btnConnect.addEventListener("click", () => {
      if (serialPort) {
        disconnectSerial();
      } else {
        connectSerial();
      }
    });
  }

  // Connect Web Bluetooth Button (Wireless Live-Sync)
  const btnConnectBle = document.getElementById("btnConnectBle");
  if (btnConnectBle) {
    btnConnectBle.addEventListener("click", () => {
      if (bleConfigChar) {
        disconnectBle();
      } else {
        connectBle();
      }
    });
  }

  // Layer Rename Button & Input (Enter Key)
  const btnRename = document.getElementById("btnRenameLayer");
  if (btnRename) {
    btnRename.addEventListener("click", renameActiveLayer);
  }
  const inputRename = document.getElementById("layerNameInput");
  if (inputRename) {
    inputRename.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        renameActiveLayer();
      }
    });
  }
}

function populateKeycodeSelects() {
  const primarySelect = document.getElementById("primaryActionSelect");
  const comboActionSelect = document.getElementById("comboActionSelect");
  primarySelect.innerHTML = "";
  comboActionSelect.innerHTML = "";

  KEYCODES.forEach(group => {
    const optgroup1 = document.createElement("optgroup");
    optgroup1.label = group.group;
    const optgroup2 = document.createElement("optgroup");
    optgroup2.label = group.group;

    group.keys.forEach(k => {
      const opt1 = document.createElement("option");
      opt1.value = k.code;
      opt1.textContent = `${k.label} (${k.code})`;
      optgroup1.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = k.code;
      opt2.textContent = `${k.label} (${k.code})`;
      optgroup2.appendChild(opt2);
    });

    primarySelect.appendChild(optgroup1);
    comboActionSelect.appendChild(optgroup2);
  });
}

const LEFT_HAND_DEFAULT = [
  [ { tap: "KEY_ESC", label: "Esc" }, { tap: "KEY_1", label: "1" }, { tap: "KEY_2", label: "2" }, { tap: "KEY_3", label: "3" }, { tap: "KEY_4", label: "4" }, { tap: "KEY_5", label: "5" }, { tap: "KEY_GRAVE", label: "^" } ],
  [ { tap: "KEY_TAB", label: "Tab" }, { tap: "KEY_Q", label: "Q" }, { tap: "KEY_W", label: "W" }, { tap: "KEY_E", label: "E" }, { tap: "KEY_R", label: "R" }, { tap: "KEY_T", label: "T" }, { tap: "NONE", label: "-" } ],
  [ { tap: "KEY_LEFT_CTRL", label: "Ctrl" }, { tap: "KEY_A", label: "A" }, { tap: "KEY_S", label: "S" }, { tap: "KEY_D", label: "D" }, { tap: "KEY_F", label: "F" }, { tap: "KEY_G", label: "G" }, { tap: "NONE", label: "-" } ],
  [ { tap: "KEY_LEFT_SHIFT", label: "Shift" }, { tap: "KEY_GRAVE", label: "<" }, { tap: "KEY_Y", label: "Y" }, { tap: "KEY_X", label: "X" }, { tap: "KEY_C", label: "C" }, { tap: "KEY_V", label: "V" }, { tap: "KEY_B", label: "B" } ],
  [ { tap: "KEY_LEFT_GUI", label: "Cmd" }, { tap: "KEY_LEFT_ALT", label: "Alt" }, { tap: "MO_1", label: "Nav" }, { tap: "KEY_SPACE", label: "Space" }, { tap: "KEY_RETURN", label: "Enter" }, { tap: "NONE", label: "-" }, { tap: "NONE", label: "-" } ],
  [ { tap: "KEY_SPACE", label: "Space" }, { tap: "KEY_RETURN", label: "Enter" }, { tap: "KEY_TAB", label: "Tab" }, { tap: "KEY_BACKSPACE", label: "Bksp" }, { tap: "KEY_ESC", label: "Esc" }, { tap: "KEY_SPACE", label: "Space" }, { tap: "KEY_SPACE", label: "Space" } ]
];

function renderMatrix() {
  const container = document.getElementById("matrixGrid");
  container.innerHTML = "";

  const layer = currentConfig.layers[activeLayerIndex] || currentConfig.layers[0];

  if (activeHandView === "both") {
    const splitWrapper = document.createElement("div");
    splitWrapper.style.display = "flex";
    splitWrapper.style.gap = "36px";
    splitWrapper.style.justifyContent = "center";
    splitWrapper.style.flexWrap = "wrap";

    const leftCol = document.createElement("div");
    leftCol.innerHTML = "<h4 style='margin-bottom: 12px; color: #94a3b8; text-align: center;'>Linke Hand</h4>";
    leftCol.appendChild(createHalfMatrix(LEFT_HAND_DEFAULT, "L"));

    const rightCol = document.createElement("div");
    rightCol.innerHTML = "<h4 style='margin-bottom: 12px; color: #10b981; text-align: center;'>Rechte Hand (Aktiv & Verbunden)</h4>";
    rightCol.appendChild(createHalfMatrix(layer, "R"));

    splitWrapper.appendChild(leftCol);
    splitWrapper.appendChild(rightCol);
    container.appendChild(splitWrapper);
  } else if (activeHandView === "left") {
    container.appendChild(createHalfMatrix(LEFT_HAND_DEFAULT, "L"));
  } else {
    container.appendChild(createHalfMatrix(layer, "R"));
  }
}

function createHalfMatrix(matrixData, side) {
  const halfEl = document.createElement("div");
  halfEl.className = "matrix-half " + (side === "L" ? "left-half" : "right-half");

  // 1. FINGER-MATRIX (Reihen 0 bis 4 = 5 Fingerreihen mit je 6 Spalten 0..5)
  const fingerMatrixEl = document.createElement("div");
  fingerMatrixEl.className = "finger-matrix";

  for (let r = 0; r < 5; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "matrix-row";
    rowEl.dataset.row = r;

    for (let c = 0; c < 6; c++) {
      // Row 4 Column 0 existiert physisch nicht -> Unsichtbarer Platzhalter für Spalten-Stagger
      if (r === 4 && c === 0) {
        const spacer = document.createElement("div");
        spacer.className = "key-cap key-cap-spacer";
        rowEl.appendChild(spacer);
        continue;
      }

      const keyData = (matrixData[r] && matrixData[r][c]) ? matrixData[r][c] : { label: "?", tap: "NONE", hold: "NONE" };
      const keyEl = createKeycapElement(r, c, side, keyData, false);
      rowEl.appendChild(keyEl);
    }
    fingerMatrixEl.appendChild(rowEl);
  }

  // 2. DEDIZIERTER DAUMEN-CLUSTER (Dactyl Manuform Custom Layout: 6 Tasten)
  const thumbCard = document.createElement("div");
  thumbCard.className = "thumb-cluster-card";

  const thumbHeader = document.createElement("div");
  thumbHeader.className = "thumb-header";
  thumbHeader.innerHTML = `
    <span class="thumb-title">👑 Dactyl Daumen-Cluster</span>
    <span class="thumb-badge">${side === "R" ? "Rechte Hand (6 Tasten)" : "Linke Hand"}</span>
  `;
  thumbCard.appendChild(thumbHeader);

  const thumbGrid = document.createElement("div");
  thumbGrid.className = "thumb-dactyl-grid";

  // Definition der Daumentasten nach Benutzervorgabe (Alle an Lila / Row 5):
  // - Ganz oben links: R5C6
  // - Oben mitte:      R5C0 (über R5C3)
  // - Mitte links:     R5C1 (unter ganz oben links)
  // - Unten links:     R5C4 (unter R5C1)
  // - Mitte 2U:        R5C3 (2U hoch, links neben R5C2)
  // - Rechts 2U:       R5C2 (2U hoch, ganz rechts)
  const thumbDefs = [
    { r: 5, c: 6, sub: 0, col: "1", row: "1", isTall: false, defaultLabel: "Esc" },
    { r: 5, c: 0, sub: 0, col: "2", row: "1", isTall: false, defaultLabel: "Cmd" },
    { r: 5, c: 1, sub: 0, col: "1", row: "2", isTall: false, defaultLabel: "Alt" },
    { r: 5, c: 4, sub: 0, col: "1", row: "3", isTall: false, defaultLabel: "Tab" },
    { r: 5, c: 3, sub: 0, col: "2", row: "2 / span 2", isTall: true, defaultLabel: "Space (2U)" },
    { r: 5, c: 2, sub: 0, col: "3", row: "2 / span 2", isTall: true, defaultLabel: "Enter (2U)" }
  ];

  thumbDefs.forEach(def => {
    let keyData = (matrixData[def.r] && matrixData[def.r][def.c])
      ? matrixData[def.r][def.c]
      : { label: def.defaultLabel, tap: "KEY_SPACE", hold: "NONE" };

    const keyEl = createKeycapElement(def.r, def.c, side, keyData, true);
    keyEl.style.gridColumn = def.col;
    keyEl.style.gridRow = def.row;
    if (def.isTall) {
      keyEl.classList.add("is-tall-2u");
    }
    if (def.sub > 0) {
      keyEl.dataset.thumbSub = def.sub;
      const posSpan = keyEl.querySelector(".key-pos");
      if (posSpan) posSpan.textContent = `R${def.r}C${def.c} (#${def.sub})`;
    }
    thumbGrid.appendChild(keyEl);
  });

  thumbCard.appendChild(thumbGrid);

  if (side === "R") {
    // Rechte Hand: Daumen-Cluster links neben dem Finger-Cluster
    halfEl.appendChild(thumbCard);
    halfEl.appendChild(fingerMatrixEl);
  } else {
    // Linke Hand: Finger-Cluster links, Daumen-Cluster rechts
    halfEl.appendChild(fingerMatrixEl);
    halfEl.appendChild(thumbCard);
  }

  return halfEl;
}

function createKeycapElement(r, c, side, keyData, isThumb = false) {
  const keyEl = document.createElement("div");
  keyEl.className = "key-cap";
  keyEl.dataset.row = r;
  keyEl.dataset.col = c;
  keyEl.dataset.side = side;
  keyEl.dataset.isThumb = isThumb ? "true" : "false";

  // Check if currently selected
  if (side === "R" && selectedKey && selectedKey.r === r && selectedKey.c === c) {
    keyEl.classList.add("selected");
  }

  // Check if key is currently physically held down
  if (activePressedKeys.has(`${side}_${r}_${c}`)) {
    keyEl.classList.add("is-pressed");
  }

  // Check if part of an active combo
  if (side === "R") {
    const isComboKey = currentConfig.combos.some(combo => 
      (combo.key1.r === r && combo.key1.c === c) || (combo.key2.r === r && combo.key2.c === c)
    );
    if (isComboKey) {
      keyEl.classList.add("has-combo");
    }
  }

  const labelEl = document.createElement("span");
  labelEl.className = "key-label";
  labelEl.textContent = keyData.label || (keyData.tap ? keyData.tap.replace("KEY_", "") : "");
  keyEl.appendChild(labelEl);

  if (keyData.hold && keyData.hold !== "NONE") {
    const sublabelEl = document.createElement("span");
    sublabelEl.className = "key-sublabel";
    sublabelEl.textContent = keyData.hold.replace("MOD_", "").replace("MO_", "L");
    keyEl.appendChild(sublabelEl);
  }

  const posEl = document.createElement("span");
  posEl.className = "key-pos";
  posEl.textContent = `${side} R${r}C${c}`;
  keyEl.appendChild(posEl);

  // Highlight hardware combo keys for wireless Bluetooth Config Mode
  if (side === "R" && ((r === 0 && c === 0) || (r === 4 && c === 5))) {
    keyEl.classList.add("is-config-combo-key");
    keyEl.title = "⚡ Bluetooth Config Combo: Halte R4C5 + R0C0 für 0.5s gedrückt!";
    const cfgBadge = document.createElement("span");
    cfgBadge.className = "config-combo-badge";
    cfgBadge.textContent = "CFG";
    keyEl.appendChild(cfgBadge);
  }

  keyEl.addEventListener("click", () => {
    if (side === "R") {
      selectKey(r, c, side, isThumb);
    } else {
      showToast("Linke Hand wird aktiv, sobald der zweite ESP32 gekoppelt ist!");
    }
  });

  return keyEl;
}

function selectKey(r, c, side = "R", isThumb = false) {
  selectedKey = { r, c, side, isThumb };
  renderMatrix();
  updateInspector(r, c);
}

function updateInspector(r, c) {
  const inspectorBody = document.getElementById("inspectorBody");
  const inspectorPlaceholder = document.getElementById("inspectorPlaceholder");
  const coordsBadge = document.getElementById("selectedKeyCoords");
  const labelInput = document.getElementById("keyLabelInput");
  const primarySelect = document.getElementById("primaryActionSelect");
  const holdSelect = document.getElementById("holdActionSelect");

  inspectorPlaceholder.style.display = "none";
  inspectorBody.style.display = "block";

  const isThumb = (r === 5 || (r === 2 && c === 6));
  coordsBadge.textContent = `Zeile ${r}, Spalte ${c} ${isThumb ? '(Daumenbereich)' : ''}`;

  const layer = currentConfig.layers[activeLayerIndex] || currentConfig.layers[0];
  const keyData = (layer[r] && layer[r][c]) ? layer[r][c] : { label: "", tap: "NONE", hold: "NONE" };

  labelInput.value = keyData.label || "";
  primarySelect.value = keyData.tap || "KEY_SPACE";
  holdSelect.value = keyData.hold || "NONE";
}

function renderCombosTable() {
  const tbody = document.getElementById("combosTableBody");
  const emptyState = document.getElementById("emptyCombosState");
  tbody.innerHTML = "";

  if (currentConfig.combos.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  currentConfig.combos.forEach((combo) => {
    const tr = document.createElement("tr");

    const behaviorName = {
      "MODIFIER_HOLD": "Modifier Hold (z.B. Strg/Alt halten)",
      "KEY_PRESS": "Einzeltaste senden (z.B. Escape/Enter)",
      "LAYER_TOGGLE": "Layer Umschalten"
    }[combo.behavior] || combo.behavior;

    tr.innerHTML = `
      <td><span class="combo-key-badge">${combo.key1.label || `R${combo.key1.r}C${combo.key1.c}`}</span></td>
      <td><strong>+</strong></td>
      <td><span class="combo-key-badge">${combo.key2.label || `R${combo.key2.r}C${combo.key2.c}`}</span></td>
      <td><strong>${combo.actionLabel || combo.action}</strong></td>
      <td><span style="color: #94a3b8; font-size: 0.85rem;">${behaviorName}</span></td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteCombo('${combo.id}')">Löschen</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.deleteCombo = function(id) {
  currentConfig.combos = currentConfig.combos.filter(c => c.id !== id);
  renderCombosTable();
  renderMatrix();
  showToast("Combo gelöscht!");
};

function setupEventListeners() {
  // Apply key inspector changes
  document.getElementById("btnApplyKey").addEventListener("click", async () => {
    if (!selectedKey) return;
    const { r, c } = selectedKey;

    while (currentConfig.layers.length <= activeLayerIndex) {
      currentConfig.layers.push(JSON.parse(JSON.stringify(currentConfig.layers[0])));
    }

    const layer = currentConfig.layers[activeLayerIndex];
    if (!layer[r]) layer[r] = [];

    const labelInput = document.getElementById("keyLabelInput");
    const primarySelect = document.getElementById("primaryActionSelect");
    const holdSelect = document.getElementById("holdActionSelect");

    const label = labelInput.value.trim() || primarySelect.options[primarySelect.selectedIndex].text.split(" ")[0];
    const tap = primarySelect.value;
    const hold = holdSelect.value;

    layer[r][c] = { label, tap, hold };
    renderMatrix();

    const numericCode = actionCodeToNumeric(tap);

    if (bleConfigChar) {
      await sendBleCommand(`SET_KEY ${activeLayerIndex} ${r} ${c} ${numericCode}`);
      showToast(`⚡ Per Bluetooth an Dactyl übertragen: [R${r}, C${c}] = ${label} (NVS gespeichert)`);
    } else if (serialPort && serialPort.writable) {
      await sendSerialCommand(`SET_KEY ${activeLayerIndex} ${r} ${c} ${numericCode}`);
      showToast(`🔌 Per USB an Dactyl übertragen: [R${r}, C${c}] = ${label} (NVS gespeichert)`);
    } else {
      showToast(`⚠️ Im Browser gespeichert! Tastatur ist nicht live verbunden. Klicke 'Auf Dactyl flashen' oder verbinde USB / Bluetooth.`);
      alert("Hinweis: Die Änderung ist aktuell nur im Browser gespeichert!\n\nDeine Tastatur ist weder per '⚡ Bluetooth Live-Sync' noch per '🔌 USB Live-Monitor' verbunden.\n\nUm die Belegung auf den ESP32 zu übertragen:\n• Klicke oben auf '💾 Auf Dactyl flashen' (wenn per USB angesteckt),\n• ODER verbinde dich oben mit '⚡ Bluetooth Live-Sync' bzw. '🔌 USB Live-Monitor'.");
    }

    saveConfigToServer();
  });

  // Combo Modal Events
  const comboModal = document.getElementById("comboModal");
  document.getElementById("btnOpenAddComboModal").addEventListener("click", () => {
    populateComboKeyDropdowns();
    comboModal.style.display = "flex";
  });
  document.getElementById("btnCloseComboModal").addEventListener("click", () => {
    comboModal.style.display = "none";
  });
  document.getElementById("btnCancelCombo").addEventListener("click", () => {
    comboModal.style.display = "none";
  });

  document.getElementById("btnSaveCombo").addEventListener("click", () => {
    const k1Val = document.getElementById("comboKey1Select").value.split(",");
    const k2Val = document.getElementById("comboKey2Select").value.split(",");
    const behavior = document.getElementById("comboBehaviorSelect").value;
    const actionSelect = document.getElementById("comboActionSelect");
    const action = actionSelect.value;
    const actionLabel = actionSelect.options[actionSelect.selectedIndex].text;

    if (k1Val[0] === k2Val[0] && k1Val[1] === k2Val[1]) {
      alert("Taste 1 und Taste 2 dürfen nicht identisch sein!");
      return;
    }

    const r1 = parseInt(k1Val[0], 10), c1 = parseInt(k1Val[1], 10);
    const r2 = parseInt(k2Val[0], 10), c2 = parseInt(k2Val[1], 10);

    const layer = currentConfig.layers[0];
    const lbl1 = (layer[r1] && layer[r1][c1]) ? layer[r1][c1].label : `R${r1}C${c1}`;
    const lbl2 = (layer[r2] && layer[r2][c2]) ? layer[r2][c2].label : `R${r2}C${c2}`;

    const newCombo = {
      id: "combo-" + Date.now(),
      name: `${lbl1} + ${lbl2} -> ${actionLabel}`,
      key1: { r: r1, c: c1, label: lbl1 },
      key2: { r: r2, c: c2, label: lbl2 },
      behavior,
      action,
      actionLabel
    };

    currentConfig.combos.push(newCombo);
    comboModal.style.display = "none";
    renderCombosTable();
    renderMatrix();
    showToast("Neuer Combo-Chord angelegt!");
  });

  // JSON Import & Export
  document.getElementById("btnExportJson").addEventListener("click", () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentConfig, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `dactyl_config_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
  });

  document.getElementById("btnImportJson").addEventListener("click", () => {
    document.getElementById("fileInput").click();
  });

  document.getElementById("fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.layers) {
          currentConfig = parsed;
          renderMatrix();
          renderCombosTable();
          showToast("Konfiguration erfolgreich geladen!");
        }
      } catch (err) {
        alert("Ungültige JSON-Datei: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  const btnWrite = document.getElementById("btnWriteConfig");
  if (btnWrite) btnWrite.addEventListener("click", writeConfigToESP32);
  const btnRead = document.getElementById("btnReadConfig");
  if (btnRead) btnRead.addEventListener("click", readConfigFromESP32);

  const btnSaveToDactyl = document.getElementById("btnSaveToDactyl");
  if (btnSaveToDactyl) {
    btnSaveToDactyl.addEventListener("click", saveAndFlashToDactyl);
  }

  const btnSaveSettings = document.getElementById("btnSaveSettings");
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener("click", async () => {
      const devName = document.getElementById("deviceNameInput")?.value || "Dactyl Keyboard";
      const debounce = parseInt(document.getElementById("debounceInput")?.value, 10) || 5;
      const comboTimeout = parseInt(document.getElementById("comboTimeoutInput")?.value, 10) || 40;
      const standbyTimeoutVal = parseInt(document.getElementById("standbyTimeoutSelect")?.value, 10);
      const standbyMinutes = isNaN(standbyTimeoutVal) ? 5 : standbyTimeoutVal;
      const sleepTimeoutVal = parseInt(document.getElementById("sleepTimeoutSelect")?.value, 10);
      const sleepMinutes = isNaN(sleepTimeoutVal) ? 60 : sleepTimeoutVal;

      currentConfig.settings = {
        deviceName: devName,
        debounceMs: debounce,
        comboTimeoutMs: comboTimeout,
        standbyTimeoutMinutes: standbyMinutes,
        sleepTimeoutMinutes: sleepMinutes,
        batteryPin: 35
      };

      if (bleConfigChar) {
        await sendBleCommand(`SET_STANDBY ${standbyMinutes}`);
        await sendBleCommand(`SET_SLEEP ${sleepMinutes}`);
      } else if (serialPort && serialPort.writable) {
        await sendSerialCommand(`SET_STANDBY ${standbyMinutes}`);
        await sendSerialCommand(`SET_SLEEP ${sleepMinutes}`);
      }

      saveConfigToServer();
      showToast("✅ Device-Einstellungen & Timeouts (Standby & Deep Sleep) gespeichert!");
    });
  }
}

async function saveAndFlashToDactyl() {
  const btn = document.getElementById("btnSaveToDactyl");
  if (!btn) return;

  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-icon">⏳</span> Flashe ESP32... (ca. 15s)`;

  const hadSerial = !!serialPort;
  if (hadSerial) {
    showToast("Trenne USB-Monitor kurz fürs Flashen...");
    await disconnectSerial();
    await new Promise(r => setTimeout(r, 150));
  }

  showToast("Kompiliere & Flashe Firmware auf Dactyl... Bitte warten.");

  try {
    const res = await fetch("/api/save_and_flash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentConfig)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast("✅ Erfolgreich auf Dactyl geflasht!");
      alert("✅ Erfolgreich auf Dactyl gespeichert!\n\nDie Firmware wurde aktualisiert. Die Tastatur verbindet sich jetzt mit deiner neuen Tastenbelegung neu per Bluetooth.");
    } else {
      const errMsg = data.error || (data.stage ? `Fehler in Phase '${data.stage}'` : "Unbekannter Fehler");
      showToast("❌ Fehler beim Flashen!");
      alert("Fehler beim Flashen auf den ESP32:\n\n" + errMsg);
    }
  } catch (err) {
    console.error("Flash error:", err);
    showToast("❌ Server nicht erreichbar!");
    alert("Netzwerkfehler: Konnte /api/save_and_flash nicht erreichen.\nLäuft python3 server.py?");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function populateComboKeyDropdowns() {
  const s1 = document.getElementById("comboKey1Select");
  const s2 = document.getElementById("comboKey2Select");
  s1.innerHTML = "";
  s2.innerHTML = "";

  const layer = currentConfig.layers[0];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const k = layer[r] && layer[r][c];
      const lbl = k ? k.label : `R${r}C${c}`;
      const isThumb = (r === 5);
      const optText = `[R${r}, C${c}] ${lbl} ${isThumb ? '(Daumen)' : ''}`;

      const o1 = document.createElement("option");
      o1.value = `${r},${c}`;
      o1.textContent = optText;
      s1.appendChild(o1);

      const o2 = document.createElement("option");
      o2.value = `${r},${c}`;
      o2.textContent = optText;
      s2.appendChild(o2);
    }
  }

  s1.value = "2,1"; // J
  s2.value = "2,2"; // K
}

// =============================================================================
// Web Bluetooth Live-Sync (Wireless Remapping & Real-time Key Monitoring)
// =============================================================================

async function connectBle() {
  if (!("bluetooth" in navigator)) {
    alert("Web Bluetooth wird von deinem Browser nicht unterstützt oder ist nicht aktiviert.\n\nBitte benutze Google Chrome, Microsoft Edge, Arc oder Opera und stelle sicher, dass Bluetooth am Mac aktiviert ist.");
    return;
  }

  if (bleConfigChar) {
    disconnectBle();
    return;
  }

  try {
    showToast("Suche nach 'Dactyl Config' (R4C5 + R0C0 für 0.5s gedrückt halten)...");
    try {
      bleDevice = await navigator.bluetooth.requestDevice({
        filters: [
          { name: "Dactyl Config" },
          { namePrefix: "Dactyl Config" },
          { services: [CONFIG_SERVICE_UUID] },
          { name: "Dactyl Keyboard" },
          { namePrefix: "Dactyl" }
        ],
        optionalServices: [CONFIG_SERVICE_UUID]
      });
    } catch (filterErr) {
      if (filterErr.name === "NotFoundError" && !filterErr.message.toLowerCase().includes("cancelled") && !filterErr.message.toLowerCase().includes("aborted")) {
        console.log("Filter match failed, trying acceptAllDevices fallback...");
        bleDevice = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [CONFIG_SERVICE_UUID]
        });
      } else {
        throw filterErr;
      }
    }

    bleDevice.addEventListener("gattserverdisconnected", onBleDisconnected);

    showToast("Verbinde mit Dactyl Bluetooth GATT Server...");
    bleServer = await bleDevice.gatt.connect();

    const service = await bleServer.getPrimaryService(CONFIG_SERVICE_UUID);
    bleConfigChar = await service.getCharacteristic(CONFIG_CHARACTERISTIC_UUID);

    await bleConfigChar.startNotifications();
    bleConfigChar.addEventListener("characteristicvaluechanged", handleBleNotification);

    updateBleUI(true, bleDevice.name || "Dactyl Config");
    showToast("⚡ Drahtloser Live-Sync aktiv! Remapping in <0.1s bereit.");

    // Query layer names & info from ESP32
    setTimeout(async () => {
      await sendBleCommand("GET_NAMES");
      await sendBleCommand("GET_INFO");
    }, 200);

  } catch (err) {
    console.error("BLE connection error:", err);
    updateBleUI(false);
    if (err.name === "NotFoundError") {
      showToast("⚠️ Kein 'Dactyl Config' gefunden. Halte R4C5 + R0C0 für 0.5s auf der Tastatur gedrückt!");
    } else {
      showToast("Bluetooth-Fehler: " + err.message);
    }
  }
}

async function disconnectBle() {
  if (bleConfigChar) {
    try {
      await sendBleCommand("EXIT_CONFIG");
      await new Promise(r => setTimeout(r, 60));
    } catch (e) {
      console.warn("Error sending EXIT_CONFIG:", e);
    }
  }
  if (bleDevice && bleDevice.gatt.connected) {
    bleDevice.gatt.disconnect();
  }
  onBleDisconnected();
}

function onBleDisconnected() {
  bleConfigChar = null;
  bleServer = null;
  bleDevice = null;
  updateBleUI(false);
  showToast("Drahtloser Live-Sync getrennt -> Tastaturmodus aktiv.");
}

function updateBleUI(connected, devName) {
  const btn = document.getElementById("btnConnectBle");
  const btPill = document.getElementById("btStatusPill");
  const nameText = document.getElementById("btDeviceNameText");

  if (btn) {
    if (connected) {
      btn.innerHTML = `<span class="btn-icon">⚡</span> Verbunden (Trennen & Tastatur starten)`;
      btn.classList.add("btn-primary");
      btn.classList.remove("btn-outline");
      btn.style.borderColor = "#10b981";
      btn.style.color = "#ffffff";
      btn.title = "Drahtlosen Config-Modus beenden und Tastatur für macOS starten";
    } else {
      btn.innerHTML = `<span class="btn-icon">⚡</span> Bluetooth Live-Sync`;
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-outline");
      btn.style.borderColor = "#3b82f6";
      btn.style.color = "#93c5fd";
      btn.title = "Drahtlos per Web-Bluetooth verbinden: Halte vorher R4C5 + R0C0 für 0.5s gedrückt!";
    }
  }

  if (btPill) {
    if (connected) {
      btPill.className = "bluetooth-status-pill connected";
      if (nameText) nameText.textContent = devName || "Dactyl Keyboard";
    } else if (!serialPort || !serialPort.readable) {
      btPill.className = "bluetooth-status-pill disconnected";
      if (nameText) nameText.textContent = "Nicht verbunden";
      resetBatteryUI();
    }
  }

  const btnRead = document.getElementById("btnReadConfig");
  const btnWrite = document.getElementById("btnWriteConfig");
  const isOnline = connected || (!!serialPort && serialPort.writable);
  if (btnRead) btnRead.disabled = !isOnline;
  if (btnWrite) btnWrite.disabled = !isOnline;
}

async function sendBleCommand(cmd) {
  if (!bleConfigChar) return;
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(cmd + "\n");
    if (bleConfigChar.writeValueWithResponse) {
      await bleConfigChar.writeValueWithResponse(data);
    } else {
      await bleConfigChar.writeValue(data);
    }
    console.log("[BLE SENT]", cmd);
  } catch (e) {
    console.warn("BLE send error:", cmd, e);
  }
}

function handleBleNotification(event) {
  const decoder = new TextDecoder();
  const raw = decoder.decode(event.target.value);
  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      console.log("[BLE RECV]", trimmed);
      handleSerialLine(trimmed);
    }
  }
}

// =============================================================================
// WebSerial Communication (Re-engineered: No stream locking bugs!)
// =============================================================================

async function connectSerial() {
  if (!("serial" in navigator)) {
    alert("WebSerial wird von deinem Browser nicht unterstützt. Bitte benutze Google Chrome, Microsoft Edge, Arc oder Opera.");
    return;
  }

  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 115200 });

    keepReading = true;
    updateConnectionUI(true, "ESP32 (USB 115200 Baud)");
    showToast("Erfolgreich mit ESP32 verbunden!");

    // Start read loop
    serialReadPromise = startSerialReadLoop();

    // Query device info
    setTimeout(() => {
      sendSerialCommand("GET_INFO");
    }, 300);

  } catch (err) {
    console.error("Serial connection error:", err);
    updateConnectionUI(false, "Verbindung fehlgeschlagen");
    showToast("Verbindung abgebrochen oder Fehler: " + err.message);
  }
}

async function disconnectSerial() {
  keepReading = false;
  if (serialReader) {
    try {
      await serialReader.cancel();
    } catch(e) {}
  }
  if (serialReadPromise) {
    try {
      await serialReadPromise;
    } catch(e) {}
    serialReadPromise = null;
  }
  if (serialPort) {
    try {
      await serialPort.close();
    } catch(e) {
      console.warn("Serial close warning:", e);
    }
    serialPort = null;
  }
  serialReader = null;
  updateConnectionUI(false, "Nicht verbunden");
  showToast("ESP32 getrennt.");
}

function updateBatteryUI(battery, voltage) {
  const pill = document.getElementById("batteryStatusPill");
  const pctText = document.getElementById("batPercentageText");
  const voltText = document.getElementById("batVoltageText");
  const icon = document.getElementById("batIcon");
  const setPct = document.getElementById("settingsBatPct");
  const setVolt = document.getElementById("settingsBatVolt");
  const setStatus = document.getElementById("settingsBatStatus");

  const v = typeof voltage === "number" ? voltage : parseFloat(voltage) || 0;
  const b = typeof battery === "number" ? battery : parseInt(battery, 10) || 0;

  const isUsb = (v < 1.0);
  const displayPct = isUsb ? 100 : Math.min(100, Math.max(0, b));

  if (pctText) pctText.textContent = isUsb ? "USB" : `${displayPct}%`;
  if (voltText) voltText.textContent = isUsb ? "(5V USB)" : `(${v.toFixed(2)} V)`;
  if (icon) icon.textContent = isUsb ? "🔌" : (displayPct < 20 ? "🪫" : "🔋");

  if (pill) {
    pill.className = "battery-status-pill";
    if (isUsb || displayPct >= 40) {
      pill.classList.add("good");
    } else if (displayPct >= 20) {
      pill.classList.add("low");
    } else {
      pill.classList.add("critical");
    }
  }

  if (setPct) setPct.textContent = isUsb ? "100% (USB-Power)" : `${displayPct}%`;
  if (setVolt) setVolt.textContent = isUsb ? "USB / 5V (Kein LiPo an Pin 35)" : `${v.toFixed(2)} V`;
  if (setStatus) {
    if (isUsb) {
      setStatus.textContent = "USB-Betrieb (Kein LiPo-Akku an Pin 35 erkannt)";
    } else if (displayPct > 90) {
      setStatus.textContent = "Voll geladen (~4.2V)";
    } else if (displayPct >= 20) {
      setStatus.textContent = "Normaler Akkubetrieb";
    } else {
      setStatus.textContent = "⚠️ Akku fast leer (<3.4V)! Bitte per USB laden.";
    }
  }
}

function resetBatteryUI() {
  const pill = document.getElementById("batteryStatusPill");
  const pctText = document.getElementById("batPercentageText");
  const voltText = document.getElementById("batVoltageText");
  const icon = document.getElementById("batIcon");
  const setPct = document.getElementById("settingsBatPct");
  const setVolt = document.getElementById("settingsBatVolt");
  const setStatus = document.getElementById("settingsBatStatus");

  if (pill) pill.className = "battery-status-pill";
  if (pctText) pctText.textContent = "--%";
  if (voltText) voltText.textContent = "(-- V)";
  if (icon) icon.textContent = "🔋";
  if (setPct) setPct.textContent = "--%";
  if (setVolt) setVolt.textContent = "-- V";
  if (setStatus) setStatus.textContent = "Warte auf Verbindung...";
}

function updateConnectionUI(connected, text) {
  const btnConnect = document.getElementById("btnConnect");
  const btnRead = document.getElementById("btnReadConfig");
  const btnWrite = document.getElementById("btnWriteConfig");
  const btPill = document.getElementById("btStatusPill");
  const nameText = document.getElementById("btDeviceNameText");

  if (btnConnect) {
    btnConnect.innerHTML = connected
      ? `<span class="btn-icon">🔌</span> USB Verbunden (Trennen)`
      : `<span class="btn-icon">🔌</span> USB Live-Monitor`;
  }

  if (connected) {
    if (btPill) btPill.className = "bluetooth-status-pill connected";
    if (nameText) nameText.textContent = text || "ESP32 (USB)";
  } else if (!bleConfigChar) {
    if (btPill) btPill.className = "bluetooth-status-pill disconnected";
    if (nameText) nameText.textContent = "Nicht verbunden";
    resetBatteryUI();
  }

  const isOnline = connected || !!bleConfigChar;
  if (btnRead) btnRead.disabled = !isOnline;
  if (btnWrite) btnWrite.disabled = !isOnline;
}

async function sendSerialCommand(cmd) {
  if (!serialPort || !serialPort.writable) return;
  try {
    const writer = serialPort.writable.getWriter();
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(cmd + "\n"));
    writer.releaseLock();
  } catch (e) {
    console.warn("Failed to send command to ESP32:", cmd, e);
  }
}

async function startSerialReadLoop() {
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    serialReader = serialPort.readable.getReader();
    while (serialPort && keepReading) {
      const { value, done } = await serialReader.read();
      if (done) break;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // unvollständige Zeile behalten
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            console.log("[ESP32 SERIAL RECV]", trimmed);
            handleSerialLine(trimmed);
          }
        }
      }
    }
  } catch (err) {
    if (keepReading) {
      console.warn("Serial read loop error:", err);
    }
  } finally {
    if (serialReader) {
      try { serialReader.releaseLock(); } catch(e) {}
      serialReader = null;
    }
  }
}

function handleSerialLine(line) {
  if (!line) return;

  // 1. Device Info (Bluetooth Name, MAC, etc.)
  if (line.startsWith("DEVICE_INFO:")) {
    try {
      const info = JSON.parse(line.substring(12));
      const pill = document.getElementById("btStatusPill");
      const nameText = document.getElementById("btDeviceNameText");
      const statusText = document.getElementById("statusText");

      const devName = info.name || "Dactyl Keyboard";
      if (pill) {
        pill.classList.remove("disconnected");
        pill.classList.add("connected");
      }
      if (nameText) nameText.textContent = devName;
      if (statusText) statusText.textContent = `Verbunden: ${devName}`;

      if (info.battery !== undefined) {
        updateBatteryUI(info.battery, info.voltage);
      }
      if (info.standby_timeout !== undefined) {
        const standbySelect = document.getElementById("standbyTimeoutSelect");
        if (standbySelect) standbySelect.value = String(info.standby_timeout);
        if (currentConfig.settings) {
          currentConfig.settings.standbyTimeoutMinutes = info.standby_timeout;
        }
      }
      if (info.sleep_timeout !== undefined) {
        const sleepSelect = document.getElementById("sleepTimeoutSelect");
        if (sleepSelect) sleepSelect.value = String(info.sleep_timeout);
        if (currentConfig.settings) {
          currentConfig.settings.sleepTimeoutMinutes = info.sleep_timeout;
        }
      }
      showToast(`Tastatur erkannt: ${devName}`);
    } catch (e) {
      console.warn("Failed to parse DEVICE_INFO:", e, line);
    }
  }

  // 2. Taste gedrückt (Key Press Event)
  else if (line.startsWith("KEY_PRESS:")) {
    try {
      const evt = JSON.parse(line.substring(10));
      if (evt.target_layer !== undefined && evt.target_layer !== activeLayerIndex) {
        switchLayerUI(evt.target_layer);
      }
      triggerVisualKeyPress(evt.r, evt.c, evt.key, "R", evt.layer);
    } catch (e) {
      console.warn("Failed to parse KEY_PRESS:", e, line);
    }
  }

  // 3. Taste losgelassen (Key Release Event)
  else if (line.startsWith("KEY_RELEASE:")) {
    try {
      const evt = JSON.parse(line.substring(12));
      triggerVisualKeyRelease(evt.r, evt.c, "R");
    } catch (e) {
      console.warn("Failed to parse KEY_RELEASE:", e, line);
    }
  }

  // 4. Layer Umschaltung aus Firmware
  else if (line.startsWith("LAYER:")) {
    const match = line.match(/Layer\s*(\d+)/i);
    if (match) {
      const l = parseInt(match[1], 10);
      switchLayerUI(l);
    }
  }

  // 5. Layer-Daten (Tastenbelegung) von Firmware synchronisieren (GET_CONFIG)
  else if (line.startsWith("LAYER_DATA:")) {
    try {
      const data = JSON.parse(line.substring(11));
      if (data.l !== undefined && Array.isArray(data.k)) {
        if (!currentConfig.layers[data.l]) currentConfig.layers[data.l] = [];
        for (let r = 0; r < data.k.length; r++) {
          if (!currentConfig.layers[data.l][r]) currentConfig.layers[data.l][r] = [];
          for (let c = 0; c < data.k[r].length; c++) {
            const code = data.k[r][c];
            const def = findDefinitionByCode(code);
            currentConfig.layers[data.l][r][c] = {
              label: def.label,
              tap: def.tap,
              hold: "NONE"
            };
          }
        }
        renderMatrix();
      }
    } catch (e) {
      console.warn("Failed to parse LAYER_DATA:", e, line);
    }
  } else if (line.startsWith("CONFIG_SYNC_DONE")) {
    saveConfigToServer();
    showToast("✅ Tastaturbelegung vollständig vom ESP32 synchronisiert!");
  }

  // 6. Layer-Namen von Firmware synchronisieren
  else if (line.startsWith("LAYER_NAMES:")) {
    try {
      const names = JSON.parse(line.substring(12));
      if (Array.isArray(names) && names.length > 0) {
        currentConfig.layerNames = names;
        renderLayerButtons();
        saveConfigToServer();
        showToast("Ebenen-Namen von Tastatur synchronisiert!");
      }
    } catch (e) {
      console.warn("Failed to parse LAYER_NAMES:", e, line);
    }
  }

  // 7. Bestätigung von Konfigurations-Befehlen
  else if (line.startsWith("OK SET_KEY")) {
    showToast("✅ Taste im ESP32 NVS gespeichert!");
  } else if (line.startsWith("OK SET_NAME")) {
    showToast("✅ Ebenen-Name im ESP32 NVS gespeichert!");
  } else if (line.startsWith("OK SET_STANDBY")) {
    const parts = line.split(" ");
    const mins = parts[2] || "5";
    showToast(`✅ Standby-Timeout im ESP32 NVS auf ${mins} Min gesetzt!`);
  } else if (line.startsWith("OK SET_SLEEP")) {
    const parts = line.split(" ");
    const mins = parts[2] || "60";
    showToast(`✅ Deep-Sleep-Timeout im ESP32 NVS auf ${mins} Min gesetzt!`);
  } else if (line.startsWith("OK EXIT_CONFIG")) {
    showToast("✅ Tastaturmodus wiederhergestellt! macOS verbindet sich automatisch.");
  } else if (line.startsWith("SLEEP_STARTING")) {
    showToast("💤 Tastatur geht in Deep Sleep (Stromsparmodus)... Beliebige Taste drücken zum Aufwecken!", 6000);
    resetBatteryUI();
    const btPill = document.getElementById("btStatusPill");
    const nameText = document.getElementById("btDeviceNameText");
    if (btPill) btPill.className = "bluetooth-status-pill disconnected";
    if (nameText) nameText.textContent = "Deep Sleep (Standby)";
  }
}

function switchLayerUI(layerIdx) {
  if (layerIdx === activeLayerIndex || layerIdx < 0 || layerIdx >= currentConfig.layers.length) return;
  document.querySelectorAll(".layer-btn").forEach(b => {
    if (parseInt(b.dataset.layer, 10) === layerIdx) {
      b.classList.add("active");
    } else {
      b.classList.remove("active");
    }
  });
  activeLayerIndex = layerIdx;
  updateLayerNameInput();
  renderMatrix();
  if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
}

// =============================================================================
// Live Keystroke Visualizer & Combo Detection
// =============================================================================

function triggerVisualKeyPress(r, c, keyLabel, side = "R", pressedLayer = undefined) {
  const keyId = `${side}_${r}_${c}`;
  activePressedKeys.add(keyId);

  // NUR hervorheben, wenn die gedrückte Taste auch zur aktuell angezeigten Ebene gehört!
  const isCurrentLayer = (pressedLayer === undefined || pressedLayer === activeLayerIndex);

  if (isCurrentLayer) {
    const selector = side ? `.key-cap[data-row="${r}"][data-col="${c}"][data-side="${side}"]`
                          : `.key-cap[data-row="${r}"][data-col="${c}"]`;
    let keyEls = document.querySelectorAll(selector);
    if (keyEls.length === 0) {
      keyEls = document.querySelectorAll(`.key-cap[data-row="${r}"][data-col="${c}"]`);
    }

    keyEls.forEach(el => {
      el.classList.add("is-pressed");
    });
  }

  // Determine key label to show
  let displayChar = keyLabel;
  if (!displayChar || displayChar === " " || displayChar === "?") {
    const sourceLayer = (pressedLayer !== undefined && currentConfig.layers[pressedLayer])
      ? currentConfig.layers[pressedLayer]
      : (currentConfig.layers[activeLayerIndex] || currentConfig.layers[0]);
    if (sourceLayer && sourceLayer[r] && sourceLayer[r][c]) {
      displayChar = sourceLayer[r][c].label || (sourceLayer[r][c].tap ? sourceLayer[r][c].tap.replace("KEY_", "") : "");
    }
  }
  if (!displayChar) displayChar = `R${r}C${c}`;

  const isThumb = (r === 5);
  const locationLabel = isThumb ? `Daumen-Cluster [R${r}, C${c}]` : `Finger [R${r}, C${c}]`;

  // 2. Update Live Monitor HUD
  const activeKeyBadge = document.getElementById("liveActiveKey");
  const activeCoordsBadge = document.getElementById("liveActiveCoords");
  const historyContainer = document.getElementById("liveKeyHistory");

  activeKeyBadge.textContent = displayChar;

  if (isCurrentLayer) {
    activeCoordsBadge.textContent = `${side === "R" ? "Rechte Hand" : "Linke Hand"} ${locationLabel}`;
  } else {
    const layerNames = currentConfig.layerNames || DEFAULT_LAYER_NAMES;
    const pressedName = layerNames[pressedLayer] || `Layer ${pressedLayer}`;
    activeCoordsBadge.textContent = `${side === "R" ? "Rechte Hand" : "Linke Hand"} ${locationLabel} (Ebene ${pressedLayer}: ${pressedName}) [Ansicht: L${activeLayerIndex}]`;
  }

  // 3. Prüfe ob ein Combo / Chord aktiv ausgelöst wurde!
  checkActiveCombos();

  // 4. Add to live ticker stream
  const placeholder = historyContainer.querySelector(".placeholder");
  if (placeholder) placeholder.remove();

  const pill = document.createElement("span");
  pill.className = "stream-pill";
  if (isThumb) {
    pill.style.borderColor = "#6366f1";
    pill.style.color = "#c7d2fe";
  }
  if (!isCurrentLayer) {
    pill.style.opacity = "0.75";
    pill.style.borderStyle = "dashed";
    pill.textContent = `${displayChar} (L${pressedLayer} R${r}C${c})`;
  } else {
    pill.textContent = `${displayChar} (${side} R${r}C${c})`;
  }
  historyContainer.prepend(pill);

  while (historyContainer.children.length > 12) {
    historyContainer.removeChild(historyContainer.lastChild);
  }
}

function triggerVisualKeyRelease(r, c, side = "R") {
  const keyId = `${side}_${r}_${c}`;
  activePressedKeys.delete(keyId);

  const selector = side ? `.key-cap[data-row="${r}"][data-col="${c}"][data-side="${side}"]`
                        : `.key-cap[data-row="${r}"][data-col="${c}"]`;
  let keyEls = document.querySelectorAll(selector);
  if (keyEls.length === 0) {
    keyEls = document.querySelectorAll(`.key-cap[data-row="${r}"][data-col="${c}"]`);
  }

  keyEls.forEach(el => {
    el.classList.remove("is-pressed");
  });

  checkActiveCombos();

  setTimeout(() => {
    if (activePressedKeys.size === 0) {
      document.getElementById("liveActiveKey").textContent = "-";
      document.getElementById("liveActiveCoords").textContent = "Bereit";
      hideComboAlert();
    }
  }, 100);
}

function checkActiveCombos() {
  for (const combo of currentConfig.combos) {
    const k1Id = `R_${combo.key1.r}_${combo.key1.c}`;
    const k2Id = `R_${combo.key2.r}_${combo.key2.c}`;
    if (activePressedKeys.has(k1Id) && activePressedKeys.has(k2Id)) {
      showComboAlert(combo);
      return;
    }
  }
  hideComboAlert();
}

function showComboAlert(combo) {
  const alertEl = document.getElementById("comboActiveAlert");
  const textEl = document.getElementById("comboActiveText");
  if (alertEl && textEl) {
    textEl.textContent = `COMBO AKTIV: ${combo.key1.label} + ${combo.key2.label} ➔ ${combo.actionLabel || combo.action}`;
    alertEl.style.display = "inline-flex";
  }
}

function hideComboAlert() {
  const alertEl = document.getElementById("comboActiveAlert");
  if (alertEl) {
    alertEl.style.display = "none";
  }
}

// =============================================================================
// Direct Bluetooth Keyboard Hooks (macOS HID Keydown / Keyup in Browser)
// =============================================================================

// Precise physical scancode mapping for the Right Hand
const SCANCODE_MAP_RIGHT = {
  // Row 0: Zahlenreihe (6 Tasten: Col 0..5)
  "Digit6": { r: 0, c: 0, label: "6" },
  "Digit7": { r: 0, c: 1, label: "7" },
  "Digit8": { r: 0, c: 2, label: "8" },
  "Digit9": { r: 0, c: 3, label: "9" },
  "Digit0": { r: 0, c: 4, label: "0" },
  "Minus":  { r: 0, c: 5, label: "ß" },

  // Row 1: QWERTY / QWERTZ (6 Tasten: Col 0..5)
  "KeyZ": { r: 1, c: 0, label: "Z" },
  "KeyY": { r: 1, c: 0, label: "Y" },
  "KeyU": { r: 1, c: 1, label: "U" },
  "KeyI": { r: 1, c: 2, label: "I" },
  "KeyO": { r: 1, c: 3, label: "O" },
  "KeyP": { r: 1, c: 4, label: "P" },
  "BracketLeft":  { r: 1, c: 5, label: "Ü" },

  // Row 2: Home Row (Col 0..5 Finger, Col 6 ist Daumentaste R2C6)
  "KeyH": { r: 2, c: 0, label: "H" },
  "KeyJ": { r: 2, c: 1, label: "J" },
  "KeyK": { r: 2, c: 2, label: "K" },
  "KeyL": { r: 2, c: 3, label: "L" },
  "Semicolon": { r: 2, c: 4, label: "Ö" },
  "Quote":     { r: 2, c: 5, label: "Ä" },

  // Row 3: Bottom Row (6 Tasten: Col 0..5)
  "KeyN": { r: 3, c: 0, label: "N" },
  "KeyM": { r: 3, c: 1, label: "M" },
  "Comma":  { r: 3, c: 2, label: "," },
  "Period": { r: 3, c: 3, label: "." },
  "Slash":  { r: 3, c: 4, label: "-" },
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

const ACTION_CODE_TO_EVENT_CODES = {
  "KEY_A": ["KeyA"], "KEY_B": ["KeyB"], "KEY_C": ["KeyC"], "KEY_D": ["KeyD"],
  "KEY_E": ["KeyE"], "KEY_F": ["KeyF"], "KEY_G": ["KeyG"], "KEY_H": ["KeyH"],
  "KEY_I": ["KeyI"], "KEY_J": ["KeyJ"], "KEY_K": ["KeyK"], "KEY_L": ["KeyL"],
  "KEY_M": ["KeyM"], "KEY_N": ["KeyN"], "KEY_O": ["KeyO"], "KEY_P": ["KeyP"],
  "KEY_Q": ["KeyQ"], "KEY_R": ["KeyR"], "KEY_S": ["KeyS"], "KEY_T": ["KeyT"],
  "KEY_U": ["KeyU"], "KEY_V": ["KeyV"], "KEY_W": ["KeyW"], "KEY_X": ["KeyX"],
  "KEY_Y": ["KeyY", "KeyZ"], "KEY_Z": ["KeyZ", "KeyY"],
  "KEY_1": ["Digit1"], "KEY_2": ["Digit2"], "KEY_3": ["Digit3"], "KEY_4": ["Digit4"],
  "KEY_5": ["Digit5"], "KEY_6": ["Digit6"], "KEY_7": ["Digit7"], "KEY_8": ["Digit8"],
  "KEY_9": ["Digit9"], "KEY_0": ["Digit0"],
  "KEY_MINUS": ["Minus"],
  "KEY_EQUAL": ["Equal"],
  "KEY_LEFT_BRACKET": ["BracketLeft"],
  "KEY_RIGHT_BRACKET": ["BracketRight"],
  "KEY_BACKSLASH": ["Backslash"],
  "KEY_SEMICOLON": ["Semicolon"],
  "KEY_QUOTE": ["Quote"],
  "KEY_GRAVE": ["Backquote"],
  "KEY_COMMA": ["Comma"],
  "KEY_PERIOD": ["Period"],
  "KEY_SLASH": ["Slash"],
  "KEY_SPACE": ["Space"],
  "KEY_RETURN": ["Enter", "NumpadEnter"],
  "KEY_ESC": ["Escape"],
  "KEY_BACKSPACE": ["Backspace"],
  "KEY_TAB": ["Tab"],
  "KEY_DELETE": ["Delete"],
  "KEY_UP_ARROW": ["ArrowUp"],
  "KEY_DOWN_ARROW": ["ArrowDown"],
  "KEY_LEFT_ARROW": ["ArrowLeft"],
  "KEY_RIGHT_ARROW": ["ArrowRight"],
  "KEY_PAGE_UP": ["PageUp"],
  "KEY_PAGE_DOWN": ["PageDown"],
  "KEY_HOME": ["Home"],
  "KEY_END": ["End"],
  "KEY_LEFT_CTRL": ["ControlLeft"],
  "KEY_LEFT_SHIFT": ["ShiftLeft"],
  "KEY_LEFT_ALT": ["AltLeft"],
  "KEY_LEFT_GUI": ["MetaLeft", "MetaRight"],
  "KEY_RIGHT_CTRL": ["ControlRight"],
  "KEY_RIGHT_SHIFT": ["ShiftRight"],
  "KEY_RIGHT_ALT": ["AltRight"],
  "KEY_RIGHT_GUI": ["MetaRight", "MetaLeft"],
};

function getHeldKeyboardLayer() {
  const base = currentConfig.layers[0];
  if (!base) return 0;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      if (activePressedKeys.has(`R_${r}_${c}`)) {
        const k = base[r] && base[r][c];
        if (k && k.tap && k.tap.startsWith("MO_")) {
          const l = parseInt(k.tap.replace("MO_", ""), 10);
          if (!isNaN(l) && l > 0 && l < 8) return l;
        }
        if (k && k.hold && k.hold.startsWith("MO_")) {
          const l = parseInt(k.hold.replace("MO_", ""), 10);
          if (!isNaN(l) && l > 0 && l < 8) return l;
        }
      }
    }
  }
  return 0;
}

function resolveKeyFromEvent(e) {
  // 1. Physische Tastatur-Ebene ermitteln (0 oder gehaltene MO_x Ebene)
  const kbLayerIdx = getHeldKeyboardLayer();
  const kbLayer = currentConfig.layers[kbLayerIdx] || currentConfig.layers[0];

  if (kbLayer) {
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        const k = kbLayer[r] && kbLayer[r][c];
        if (k && k.tap && k.tap !== "NONE") {
          const matchingCodes = ACTION_CODE_TO_EVENT_CODES[k.tap];
          if (matchingCodes && matchingCodes.includes(e.code)) {
            return { r, c, label: k.label || e.key, layer: kbLayerIdx };
          }
        }
      }
    }
  }

  // 2. Falls ein Layer gehalten war aber die Taste nicht belegt ist: Fallback auf Base Layer (Layer 0)
  if (kbLayerIdx !== 0) {
    const base = currentConfig.layers[0];
    if (base) {
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 7; c++) {
          const k = base[r] && base[r][c];
          if (k && k.tap && k.tap !== "NONE") {
            const matchingCodes = ACTION_CODE_TO_EVENT_CODES[k.tap];
            if (matchingCodes && matchingCodes.includes(e.code)) {
              return { r, c, label: k.label || e.key, layer: 0 };
            }
          }
        }
      }
    }
  }

  // 3. Fallback auf physische Scancode-Tabelle (immer Layer 0)
  if (SCANCODE_MAP_RIGHT[e.code]) {
    return { ...SCANCODE_MAP_RIGHT[e.code], layer: 0 };
  }

  return null;
}

// Find key on Layer 0 that triggers targetLayer (MO_1..7)
function findLayerTriggerKey(targetLayer) {
  if (!targetLayer || targetLayer <= 0) return null;
  const base = currentConfig.layers[0];
  if (!base) return null;
  const moCode = `MO_${targetLayer}`;
  const tgCode = `TG_${targetLayer}`;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const k = base[r] && base[r][c];
      if (k && (k.tap === moCode || k.hold === moCode || k.tap === tgCode || k.hold === tgCode)) {
        return { r, c, label: k.label || moCode };
      }
    }
  }
  return null;
}

function setupBrowserKeyboardHooks() {
  window.addEventListener("keydown", (e) => {
    // If user is editing a label inside an input, do not block typing
    if (e.target.tagName === "INPUT" && (e.target.id === "keyLabelInput" || e.target.id === "layerNameInput" || e.target.type === "text")) return;

    const matched = resolveKeyFromEvent(e);
    if (matched) {
      // If key is on another layer, also highlight the MO key on layer 0!
      if (matched.layer !== undefined && matched.layer > 0) {
        const trigger = findLayerTriggerKey(matched.layer);
        if (trigger) {
          triggerVisualKeyPress(trigger.r, trigger.c, trigger.label, "R", 0);
        }
      }
      triggerVisualKeyPress(matched.r, matched.c, matched.label, "R", matched.layer);
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.target.tagName === "INPUT" && (e.target.id === "keyLabelInput" || e.target.id === "layerNameInput" || e.target.type === "text")) return;

    const matched = resolveKeyFromEvent(e);
    if (matched) {
      if (matched.layer !== undefined && matched.layer > 0) {
        const trigger = findLayerTriggerKey(matched.layer);
        if (trigger) {
          triggerVisualKeyRelease(trigger.r, trigger.c, "R", 0);
        }
      }
      triggerVisualKeyRelease(matched.r, matched.c, "R", matched.layer);
    }
  });
}

// =============================================================================
// Configuration Read/Write
// =============================================================================

async function writeConfigToESP32() {
  if (!bleConfigChar && (!serialPort || !serialPort.writable)) {
    alert("Keine Verbindung zum ESP32 aktiv! Bitte verbinde erst Bluetooth Live-Sync oder USB Live-Monitor.");
    return;
  }

  showToast("Übertrage vollständige Konfiguration an ESP32 NVS...");
  try {
    for (let l = 0; l < currentConfig.layerNames.length; l++) {
      const cmd = `SET_NAME ${l} ${currentConfig.layerNames[l]}`;
      if (bleConfigChar) await sendBleCommand(cmd);
      else await sendSerialCommand(cmd);
      await new Promise(r => setTimeout(r, 20));
    }
    for (let l = 0; l < currentConfig.layers.length; l++) {
      const layer = currentConfig.layers[l];
      for (let r = 0; r < layer.length; r++) {
        for (let c = 0; c < layer[r].length; c++) {
          const k = layer[r][c];
          const num = actionCodeToNumeric(k.tap || "NONE");
          const cmd = `SET_KEY ${l} ${r} ${c} ${num}`;
          if (bleConfigChar) await sendBleCommand(cmd);
          else await sendSerialCommand(cmd);
          await new Promise(r => setTimeout(r, 15));
        }
      }
    }
    showToast("✅ Vollständige Konfiguration im ESP32 NVS gespeichert!");
  } catch (err) {
    console.error("Write config error:", err);
    showToast("Fehler beim Übertragen der Konfiguration!");
  }
}

async function readConfigFromESP32() {
  if (bleConfigChar) {
    await sendBleCommand("GET_CONFIG");
    showToast("Konfigurations-Anfrage per Bluetooth an ESP32 gesendet...");
  } else if (serialPort && serialPort.writable) {
    await sendSerialCommand("GET_CONFIG");
    showToast("Konfigurations-Anfrage per USB an ESP32 gesendet...");
  } else {
    alert("Keine Verbindung zum ESP32 aktiv! Bitte verbinde erst Bluetooth Live-Sync oder USB Live-Monitor.");
  }
}

function showToast(msg) {
  const toast = document.getElementById("toastNotification");
  if (!toast) return;
  toast.textContent = msg;
  toast.className = "toast show";
  setTimeout(() => {
    toast.className = "toast";
  }, 2800);
}
