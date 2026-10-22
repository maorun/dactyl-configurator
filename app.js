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
  { group: "Maus-Aktionen", keys: [
    { code: "MOUSE_LEFT", label: "🖱️ Linksklick (Left Click)", char: "" },
    { code: "MOUSE_RIGHT", label: "🖱️ Rechtsklick (Right Click)", char: "" },
    { code: "MOUSE_MIDDLE", label: "🖱️ Mittelklick (Middle Click)", char: "" },
    { code: "MOUSE_WHEEL_UP", label: "🖱️ Mausrad Hoch (Scroll Up)", char: "" },
    { code: "MOUSE_WHEEL_DOWN", label: "🖱️ Mausrad Runter (Scroll Down)", char: "" }
  ]},
  { group: "Layer Umschalter", keys: [
    { code: "LAYER_UP", label: "⬆️ Layer +1 Hoch (Nächste Ebene)", char: "" },
    { code: "LAYER_DOWN", label: "⬇️ Layer -1 Runter (Vorherige Ebene)", char: "" },
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
  "MOD_LCTRL": 0x80,
  "MOD_LSHIFT": 0x81,
  "MOD_LALT": 0x82,
  "MOD_LGUI": 0x83,
  "MOD_RCTRL": 0x84,
  "MOD_RSHIFT": 0x85,
  "MOD_RALT": 0x86,
  "MOD_RGUI": 0x87,

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

  // Layer switches (0x100..0x107, 0x110..0x117, 0x118..0x119)
  "MO_0": 0x100, "MO_1": 0x101, "MO_2": 0x102, "MO_3": 0x103, "MO_4": 0x104,
  "MO_5": 0x105, "MO_6": 0x106, "MO_7": 0x107,
  "TG_0": 0x110, "TG_1": 0x111, "TG_2": 0x112, "TG_3": 0x113, "TG_4": 0x114,
  "TG_5": 0x115, "TG_6": 0x116, "TG_7": 0x117,
  "LAYER_UP": 0x118,
  "LAYER_DOWN": 0x119,

  // Mouse Actions (0x130..0x134)
  "MOUSE_LEFT": 0x130,
  "MOUSE_RIGHT": 0x131,
  "MOUSE_MIDDLE": 0x132,
  "MOUSE_WHEEL_UP": 0x133,
  "MOUSE_WHEEL_DOWN": 0x134,
  "ACT_MOUSE_LEFT": 0x130,
  "ACT_MOUSE_RIGHT": 0x131,
  "ACT_MOUSE_MIDDLE": 0x132,
  "ACT_MOUSE_WHEEL_UP": 0x133,
  "ACT_MOUSE_WHEEL_DOWN": 0x134
};

function actionCodeToNumeric(code) {
  if (!code || code === "NONE") return 0;
  if (ACTION_TO_NUMERIC[code] !== undefined) {
    return ACTION_TO_NUMERIC[code];
  }
  // Single-character ASCII (z.B. 'a', '1', '~', '@')
  if (code.length === 1) {
    const c = code.charCodeAt(0);
    if (c >= 32 && c <= 126) return c;
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

  // Numeric fallback KEY_\d+ (Finding #15)
  if (code.startsWith("KEY_")) {
    const num = parseInt(code.substring(4), 10);
    if (!isNaN(num) && num >= 0 && num <= 0xFFFF) return num;
  }
  return 0;
}
const actionToNumeric = actionCodeToNumeric;

// Tap- und Halte-Code einer Taste für SET_K/SET_KEY. Hold ohne Tap wirkt wie eine normale Taste.
function keyToNumericActions(k) {
  const tap = (k && k.tap && k.tap !== "NONE") ? k.tap : "NONE";
  const hold = (k && k.hold && k.hold !== "NONE") ? k.hold : "NONE";
  if (tap === "NONE") return { tapCode: actionCodeToNumeric(hold), holdCode: 0 };
  return { tapCode: actionCodeToNumeric(tap), holdCode: actionCodeToNumeric(hold) };
}

function findDefinitionByCode(numericCode) {
  if (!numericCode || numericCode === 0) return { label: "---", tap: "NONE" };
  for (const [key, num] of Object.entries(ACTION_TO_NUMERIC)) {
    if (num === numericCode) {
      let lbl = key.replace("KEY_", "").replace("ACT_", "");
      if (key === "ACT_MAC_GLOBE" || key === "MAC_GLOBE") lbl = "Globe";
      else if (key === "LAYER_UP") lbl = "Layer ▲";
      else if (key === "LAYER_DOWN") lbl = "Layer ▼";
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

  // Printable ASCII fallback (Finding #15)
  if (numericCode >= 32 && numericCode <= 126) {
    const ch = String.fromCharCode(numericCode);
    return { label: ch, tap: ch };
  }
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

// Matrix- und Firmware-Grenzen (identisch zu dactyl_right.ino / server.py)
const NUM_LAYERS = 8;
const NUM_ROWS = 6;
const NUM_COLS = 7;
const MAX_COMBOS = 16;
const MAX_NAME_LENGTH = 31;
const SETTINGS_RANGES = {
  debounceMs: [1, 50, 5],
  comboTimeoutMs: [10, 200, 40],
  standbyTimeoutMinutes: [0, 120, 5],
  sleepTimeoutMinutes: [0, 240, 60]
};
const COMBO_BEHAVIORS = ["KEY_PRESS", "MODIFIER_HOLD", "LAYER_TOGGLE"];

// Physisch nicht vorhandene Positionen (R4C0 im Fingerbereich, R5C5 im Daumen-Cluster)
function isPhysicalKey(r, c) {
  return !(r === 4 && c === 0) && !(r === 5 && c === 5);
}

function isValidIndex(value, max) {
  return Number.isInteger(value) && value >= 0 && value < max;
}

// Entfernt Steuerzeichen (z. B. Zeilenumbrüche = Befehlsinjektion über Serial), Quotes & Backslashes
function sanitizeCommandText(value, fallback = "") {
  const cleaned = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f"\\]/g, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return cleaned || fallback;
}

function clampSetting(field, value) {
  const [lo, hi, def] = SETTINGS_RANGES[field];
  const n = Number(value);
  if (!Number.isInteger(n)) return def;
  return Math.min(hi, Math.max(lo, n));
}

function normalizeKeyCell(cell) {
  if (!cell || typeof cell !== "object") return { label: "---", tap: "NONE", hold: "NONE" };
  return {
    label: typeof cell.label === "string" ? cell.label.slice(0, 16) : "",
    tap: typeof cell.tap === "string" ? cell.tap : "NONE",
    hold: typeof cell.hold === "string" ? cell.hold : "NONE"
  };
}

// Prüft eine importierte oder vom Server geladene Konfiguration und wirft bei ungültiger Struktur
function validateConfigShape(cfg) {
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) throw new Error("Konfiguration muss ein Objekt sein.");
  if (!Array.isArray(cfg.layers) || cfg.layers.length === 0 || cfg.layers.length > NUM_LAYERS) {
    throw new Error(`'layers' muss 1..${NUM_LAYERS} Ebenen enthalten.`);
  }
  cfg.layers.forEach((layer, l) => {
    if (!Array.isArray(layer) || layer.length > NUM_ROWS || layer.some(row => !Array.isArray(row) || row.length > NUM_COLS)) {
      throw new Error(`Ebene ${l} hat keine gültige ${NUM_ROWS}x${NUM_COLS}-Matrix.`);
    }
  });
  if (cfg.combos !== undefined) {
    if (!Array.isArray(cfg.combos) || cfg.combos.length > MAX_COMBOS) throw new Error(`'combos' muss eine Liste mit maximal ${MAX_COMBOS} Einträgen sein.`);
    cfg.combos.forEach((cb, i) => {
      const ok = cb && typeof cb === "object" && cb.key1 && cb.key2 &&
        isValidIndex(cb.key1.r, NUM_ROWS) && isValidIndex(cb.key1.c, NUM_COLS) &&
        isValidIndex(cb.key2.r, NUM_ROWS) && isValidIndex(cb.key2.c, NUM_COLS);
      if (!ok) throw new Error(`Combo ${i + 1} hat ungültige Tasten (key1/key2).`);
    });
  }
  if (cfg.layerNames !== undefined && !Array.isArray(cfg.layerNames)) throw new Error("'layerNames' muss eine Liste sein.");
  if (cfg.settings !== undefined && (typeof cfg.settings !== "object" || cfg.settings === null)) throw new Error("'settings' muss ein Objekt sein.");
}

// Normalisiert importierte oder vom Server geladene Konfigurationen (nach validateConfigShape)
function normalizeConfig(cfg) {
  if (!cfg || typeof cfg !== "object") cfg = {};
  cfg.layers = Array.isArray(cfg.layers)
    ? cfg.layers.slice(0, NUM_LAYERS).map(layer => Array.isArray(layer)
      ? layer.slice(0, NUM_ROWS).map(row => Array.isArray(row) ? row.slice(0, NUM_COLS).map(normalizeKeyCell) : [])
      : [])
    : [];
  cfg.combos = Array.isArray(cfg.combos)
    ? cfg.combos.filter(cb => cb && cb.key1 && cb.key2 &&
        isValidIndex(cb.key1.r, NUM_ROWS) && isValidIndex(cb.key1.c, NUM_COLS) &&
        isValidIndex(cb.key2.r, NUM_ROWS) && isValidIndex(cb.key2.c, NUM_COLS)).slice(0, MAX_COMBOS)
    : [];
  const names = Array.isArray(cfg.layerNames) ? cfg.layerNames : [];
  cfg.layerNames = DEFAULT_LAYER_NAMES.map((def, i) => sanitizeCommandText(names[i], def));
  const s = (cfg.settings && typeof cfg.settings === "object") ? cfg.settings : {};
  cfg.settings = {
    deviceName: sanitizeCommandText(s.deviceName, "Dactyl Keyboard"),
    debounceMs: clampSetting("debounceMs", s.debounceMs ?? 5),
    comboTimeoutMs: clampSetting("comboTimeoutMs", s.comboTimeoutMs ?? 40),
    standbyTimeoutMinutes: clampSetting("standbyTimeoutMinutes", s.standbyTimeoutMinutes ?? 5),
    sleepTimeoutMinutes: clampSetting("sleepTimeoutMinutes", s.sleepTimeoutMinutes ?? 60)
  };
  return cfg;
}

// State
let currentConfig = normalizeConfig(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
let activeLayerIndex = 0;
let activeHandView = "right"; // "right", "left", "both"
let thumbClusterFormat = "2x3"; // "2x3" or "3x2"
let selectedKey = null; // { r, c, side, isThumb }
let serialPort = null;
let serialReader = null;
let serialReadPromise = null;
let keepReading = true;

// Web Bluetooth & Auto-Sync State
let bleDevice = null;
let bleServer = null;
let bleConfigChar = null;
let isConfigModeActive = false;
let isAutoSyncing = false;
let isConnectingBle = false;
let pendingSyncCount = 0;
let pendingChanges = [];
const watchedBleDevices = new Set();
const knownBleDevices = [];
let bleAutoPollTimer = null;

let lastBleDisconnectTime = 0;
let bleWriteQueue = Promise.resolve();

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
  initModernBleAutoSync();
});

function updateConfigModeUI(active, syncing = false) {
  isConfigModeActive = active;
  isAutoSyncing = syncing;

  const pill = document.getElementById("configModeStatusPill");
  const pillIcon = document.getElementById("configModeIcon");
  const pillText = document.getElementById("configModeText");
  const card = document.getElementById("configModeGuideCard");
  const badge = document.getElementById("configModeStateBadge");
  const btnExit = document.getElementById("btnExitConfigBanner");

  if (pill) {
    pill.className = "config-mode-pill " + (syncing ? "mode-syncing" : (active ? "mode-config" : "mode-normal"));
  }
  if (pillIcon) {
    pillIcon.textContent = syncing ? "🔄" : (active ? "⚡" : "⌨️");
  }
  if (pillText) {
    pillText.textContent = syncing
      ? "Übertrage auf Dactyl..."
      : (active ? "KONFIG-MODUS AKTIV" : "Mac-Tastatur");
  }

  if (card) {
    card.classList.toggle("is-config-active", active || syncing);
    card.classList.toggle("has-pending-sync", !active && !syncing && pendingSyncCount > 0);
  }
  if (badge) {
    if (syncing) {
      badge.className = "config-state-badge state-syncing";
      badge.textContent = "🔄 Übertrage auf ESP32...";
    } else if (active) {
      badge.className = "config-state-badge state-config";
      badge.textContent = "⚡ KONFIG-MODUS AKTIV";
    } else {
      badge.className = "config-state-badge state-normal";
      badge.textContent = "⌨️ Mac-Tastaturmodus aktiv";
    }
  }
  if (btnExit) {
    btnExit.style.display = (active && !syncing) ? "inline-flex" : "none";
  }
}

function renderPendingSyncUI() {
  pendingSyncCount = pendingChanges.length;
  const badge = document.getElementById("pendingSyncBadge");
  const card = document.getElementById("configModeGuideCard");
  const toggleBtn = document.getElementById("btnTogglePendingDrawer");
  const drawer = document.getElementById("pendingChangesDrawer");
  const list = document.getElementById("pendingChangesList");
  const countBadge = document.getElementById("pendingChangesCountBadge");

  if (card && !isConfigModeActive) {
    card.classList.toggle("has-pending-sync", pendingSyncCount > 0);
  }

  if (badge) {
    if (pendingSyncCount > 0) {
      badge.className = "pending-sync-badge pending";
      badge.textContent = `⏳ ${pendingSyncCount} Änderung${pendingSyncCount === 1 ? "" : "en"} vorgemerkt (warte auf Combo)`;
      badge.title = "Klicken, um die Details der vorgemerkten Änderungen anzuzeigen.";
      badge.style.display = "inline-flex";
      badge.style.cursor = "pointer";
    } else {
      badge.className = "pending-sync-badge synced";
      badge.textContent = "✓ Alle Einstellungen synchron";
      badge.title = "Alle Einstellungen sind synchron.";
      badge.style.display = "inline-flex";
      badge.style.cursor = "default";
    }
  }

  if (toggleBtn) {
    if (pendingSyncCount > 0) {
      toggleBtn.style.display = "inline-flex";
      const isExpanded = drawer && drawer.style.display !== "none";
      toggleBtn.textContent = isExpanded ? "📋 Details verbergen ▴" : "📋 Details anzeigen ▾";
    } else {
      toggleBtn.style.display = "none";
    }
  }

  if (countBadge) {
    countBadge.textContent = String(pendingSyncCount);
  }

  if (drawer && pendingSyncCount === 0) {
    drawer.style.display = "none";
  }

  if (list) {
    list.innerHTML = "";
    if (pendingSyncCount === 0) {
      const emptyLi = document.createElement("li");
      emptyLi.className = "pending-change-item empty";
      emptyLi.textContent = "Keine ausstehenden Änderungen.";
      list.appendChild(emptyLi);
    } else {
      pendingChanges.forEach((chg) => {
        const li = document.createElement("li");
        li.className = "pending-change-item";

        const iconMap = {
          key: "⌨️",
          layer_name: "✏️",
          preset: "🎨",
          settings: "⚙️",
          combo_add: "⚡",
          combo_del: "🗑️",
          import: "📁"
        };
        const icon = iconMap[chg.type] || "📝";

        const mainDiv = document.createElement("div");
        mainDiv.className = "pending-change-main";

        const titleDiv = document.createElement("div");
        titleDiv.className = "pending-change-title";

        const iconSpan = document.createElement("span");
        iconSpan.textContent = icon;
        const textSpan = document.createElement("span");
        textSpan.textContent = chg.title || "Änderung";
        const timeSpan = document.createElement("span");
        timeSpan.className = "pending-change-time";
        timeSpan.textContent = chg.time || "";

        titleDiv.appendChild(iconSpan);
        titleDiv.appendChild(textSpan);
        titleDiv.appendChild(timeSpan);
        mainDiv.appendChild(titleDiv);

        if (chg.description) {
          const descDiv = document.createElement("div");
          descDiv.className = "pending-change-desc";
          descDiv.textContent = chg.description;
          mainDiv.appendChild(descDiv);
        }

        li.appendChild(mainDiv);

        if (typeof chg.revert === "function") {
          const undoBtn = document.createElement("button");
          undoBtn.className = "btn btn-outline btn-xs btn-undo-change";
          undoBtn.textContent = "↩️ Rückgängig";
          undoBtn.title = "Diese Änderung rückgängig machen";
          undoBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            undoPendingChange(chg.id);
          });
          li.appendChild(undoBtn);
        }

        list.appendChild(li);
      });
    }
  }
}

function togglePendingChangesDrawer() {
  const drawer = document.getElementById("pendingChangesDrawer");
  const toggleBtn = document.getElementById("btnTogglePendingDrawer");
  if (!drawer) return;
  const isHidden = (drawer.style.display === "none" || !drawer.style.display);
  drawer.style.display = isHidden ? "block" : "none";
  if (toggleBtn) {
    toggleBtn.textContent = isHidden ? "📋 Details verbergen ▴" : "📋 Details anzeigen ▾";
  }
}

function undoPendingChange(id) {
  const idx = pendingChanges.findIndex(c => c.id === id);
  if (idx === -1) return;
  const change = pendingChanges[idx];
  // Snapshot-Reverts (Import, Preset, Einstellungen) stellen ganze Bereiche wieder her und würden spätere
  // Änderungen überschreiben, deren Datensätze dann veraltet wären: nur als jüngste Änderung zulassen.
  if (change.snapshot && idx !== pendingChanges.length - 1) {
    showToast("↩️ Bitte zuerst die neueren Änderungen rückgängig machen.", 5000);
    return;
  }
  if (typeof change.revert === "function") {
    try {
      change.revert();
    } catch (err) {
      console.error("Fehler beim Rückgängigmachen der Änderung:", err);
    }
  }
  pendingChanges.splice(idx, 1);
  if (pendingChanges.length === 0) {
    clearPendingSync();
  } else {
    renderPendingSyncUI();
  }
  showToast(`↩️ Änderung rückgängig gemacht: ${change.title}`);
}

function discardAllPendingChanges() {
  if (pendingChanges.length === 0) return;
  const count = pendingChanges.length;
  if (!confirm(`Möchtest du wirklich alle ${count} vorgemerkten Änderungen verwerfen und rückgängig machen?`)) {
    return;
  }
  for (let i = pendingChanges.length - 1; i >= 0; i--) {
    const chg = pendingChanges[i];
    if (typeof chg.revert === "function") {
      try {
        chg.revert();
      } catch (err) {
        console.error("Fehler beim Verwerfen der Änderung:", err);
      }
    }
  }
  clearPendingSync();
  showToast(`🗑️ ${count} vorgemerkte Änderung${count === 1 ? "" : "en"} verworfen.`);
}

function markPendingSync(changeOrSummary = "") {
  let changeObj;
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (typeof changeOrSummary === "string") {
    changeObj = {
      id: "chg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      time: nowStr,
      type: "general",
      title: changeOrSummary || "Änderung",
      description: "",
      revert: null
    };
  } else if (typeof changeOrSummary === "object" && changeOrSummary !== null) {
    changeObj = {
      id: changeOrSummary.id || ("chg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5)),
      time: nowStr,
      type: changeOrSummary.type || "general",
      title: changeOrSummary.title || "Änderung",
      description: changeOrSummary.description || "",
      revert: changeOrSummary.revert || null,
      snapshot: !!changeOrSummary.snapshot
    };
  }
  if (changeObj) {
    pendingChanges.push(changeObj);
  }
  renderPendingSyncUI();

  const titleText = changeObj ? changeObj.title : "";
  const suffix = titleText ? ` (${titleText})` : "";
  showToast(`💾 Vorgemerkt${suffix}! Halte R4C5 + R0C0 (0.5s) an der Tastatur zum automatischen Übertragen.`);
}

function clearPendingSync() {
  pendingChanges = [];
  pendingSyncCount = 0;
  renderPendingSyncUI();
  const drawer = document.getElementById("pendingChangesDrawer");
  if (drawer) drawer.style.display = "none";
  const card = document.getElementById("configModeGuideCard");
  if (card) card.classList.remove("has-pending-sync");
}

async function loadSavedConfigFromServer() {
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const data = await res.json();
      if (data && data.layers && data.layers.length > 0) {
        try {
          validateConfigShape(data);
        } catch (validationErr) {
          showToast(`⚠️ Gespeicherte Konfiguration ungültig (${validationErr.message}). Standard wird verwendet.`, 7000);
          return;
        }
        // "source" ist Server-Metadatum ("user" = lokale Config, "default" = versionierte Vorlage), kein Config-Feld
        const { source, ...cfg } = data;
        currentConfig = normalizeConfig(cfg);
        applySettingsToInputs(currentConfig.settings);
        renderLayerButtons();
        renderMatrix();
        renderCombosTable();
        showToast(source === "default" ? "Standard-Vorlage geladen (noch keine eigene Konfiguration gespeichert)." : "Gespeicherte Konfiguration geladen!");
      }
    }
  } catch (e) {
    console.warn("Could not load config from server:", e);
  }
}

function applySettingsToInputs(settings) {
  if (!settings) return;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = String(v); };
  setVal("deviceNameInput", settings.deviceName);
  setVal("debounceInput", settings.debounceMs);
  setVal("comboTimeoutInput", settings.comboTimeoutMs);
  setVal("standbyTimeoutSelect", settings.standbyTimeoutMinutes);
  setVal("sleepTimeoutSelect", settings.sleepTimeoutMinutes);
}

// Saves werden seriell ausgeführt: ein später eintreffender älterer POST kann neuere Daten nicht überschreiben
let serverSaveQueue = Promise.resolve(true);
function saveConfigToServer() {
  const snapshot = JSON.stringify(currentConfig);
  const run = async () => {
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: snapshot
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { msg = (await res.json()).error || msg; } catch (_) {}
        showToast(`⚠️ Konfiguration konnte nicht gespeichert werden: ${msg}`, 6000);
        return false;
      }
      return true;
    } catch (e) {
      console.warn("Could not auto-save config to server:", e);
      showToast("⚠️ Server nicht erreichbar: Konfiguration nicht gespeichert.", 6000);
      return false;
    }
  };
  serverSaveQueue = serverSaveQueue.then(run, run);
  return serverSaveQueue;
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
  const newName = sanitizeCommandText(input.value);
  if (!newName) {
    showToast("Bitte gib einen Namen für die Ebene ein.");
    return;
  }
  if (!currentConfig.layerNames) {
    currentConfig.layerNames = [...DEFAULT_LAYER_NAMES];
  }
  const targetLayer = activeLayerIndex;
  const oldName = currentConfig.layerNames[targetLayer] || `Layer ${targetLayer}`;
  currentConfig.layerNames[targetLayer] = newName;
  renderLayerButtons();

  const changeRecord = {
    type: "layer_name",
    title: `Ebene ${targetLayer} umbenannt`,
    description: `"${oldName}" ➔ "${newName}"`,
    revert: () => {
      if (currentConfig.layerNames) {
        currentConfig.layerNames[targetLayer] = oldName;
        renderLayerButtons();
        saveConfigToServer();
      }
    }
  };

  // An ESP32 per Bluetooth oder USB senden (bei Fehler als ausstehend vormerken)
  const ok = await sendDeviceCommand(`SET_NAME ${targetLayer} ${newName}`);
  if (ok) {
    showToast(`Ebene ${targetLayer} in "${newName}" umbenannt!`);
  } else {
    markPendingSync(changeRecord);
  }

  saveConfigToServer();
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
        const oldLayer0 = JSON.parse(JSON.stringify(currentConfig.layers[0]));
        currentConfig.layers[0] = JSON.parse(JSON.stringify(PRESETS[presetKey].layers[0]));
        renderMatrix();
        saveConfigToServer();
        // Immer vormerken: das Preset wird mit dem nächsten Sync (Combo oder "Schreiben") übertragen
        markPendingSync({
          type: "preset",
          snapshot: true,
          title: `Layout-Preset angewendet`,
          description: `${PRESETS[presetKey].name} (Ebene 0)`,
          revert: () => {
            currentConfig.layers[0] = oldLayer0;
            renderMatrix();
            if (selectedKey && activeLayerIndex === 0) updateInspector(selectedKey.r, selectedKey.c);
            saveConfigToServer();
          }
        });
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

  // Bluetooth Permission Check & Open Config Buttons
  const btnCheckBtPermission = document.getElementById("btnCheckBtPermission");
  if (btnCheckBtPermission) {
    btnCheckBtPermission.addEventListener("click", checkBluetoothPermission);
  }

  const btnOpenBtSettings = document.getElementById("btnOpenBtSettings");
  if (btnOpenBtSettings) {
    btnOpenBtSettings.addEventListener("click", openMacBluetoothSettings);
  }

  const btnSettingsOpenBtConfig = document.getElementById("btnSettingsOpenBtConfig");
  if (btnSettingsOpenBtConfig) {
    btnSettingsOpenBtConfig.addEventListener("click", openMacBluetoothSettings);
  }

  // Initial State: Zeige Berechtigungsprüfung oder den Live-Sync-Button falls bereits verifiziert
  if (isBtPermissionVerified()) {
    setBtPermissionUIState("granted");
  } else {
    setBtPermissionUIState("unverified");
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

  // Banner Exit Config Mode Button
  const btnExitConfigBanner = document.getElementById("btnExitConfigBanner");
  if (btnExitConfigBanner) {
    btnExitConfigBanner.addEventListener("click", async () => {
      if (bleConfigChar) {
        await disconnectBle();
      } else if (serialPort && serialPort.writable) {
        // UI wechselt erst über "OK EXIT_CONFIG" / "MODE:KEYBOARD" vom Gerät (handleSerialLine)
        const ack = waitForAck("EXIT_CONFIG", 1500);
        if (!(await sendSerialCommand("EXIT_CONFIG"))) {
          resolveAcksForLine("ERR SEND EXIT_CONFIG");
        }
        if ((await ack) !== true) {
          showToast("⚠️ EXIT_CONFIG wurde von der Tastatur nicht bestätigt.", 6000);
        }
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

// Alte Configs speichern Modifier-Halte-Aktionen als MOD_*; im Dropdown entsprechen sie den KEY_*-Modifiern
const LEGACY_HOLD_CODES = {
  MOD_LCTRL: "KEY_LEFT_CTRL", MOD_LSHIFT: "KEY_LEFT_SHIFT", MOD_LALT: "KEY_LEFT_ALT", MOD_LGUI: "KEY_LEFT_GUI",
  MOD_RCTRL: "KEY_RIGHT_CTRL", MOD_RSHIFT: "KEY_RIGHT_SHIFT", MOD_RALT: "KEY_RIGHT_ALT", MOD_RGUI: "KEY_RIGHT_GUI"
};

function normalizeHoldCode(code) {
  return LEGACY_HOLD_CODES[code] || code || "NONE";
}

// Kurze Unterbeschriftung der Halte-Aktion auf der Keycap (max. 6 Zeichen)
const HOLD_SUBLABEL_SHORT = {
  KEY_LEFT_CTRL: "Ctrl", KEY_RIGHT_CTRL: "Ctrl", KEY_LEFT_SHIFT: "Shift", KEY_RIGHT_SHIFT: "Shift",
  KEY_LEFT_ALT: "Alt", KEY_RIGHT_ALT: "Alt", KEY_LEFT_GUI: "Cmd", KEY_RIGHT_GUI: "Cmd",
  LAYER_UP: "L+1", LAYER_DOWN: "L-1", MAC_GLOBE: "Globe"
};

function holdSublabel(code) {
  const c = normalizeHoldCode(code);
  if (HOLD_SUBLABEL_SHORT[c]) return HOLD_SUBLABEL_SHORT[c];
  let m = /^MO_(\d)$/.exec(c);
  if (m) return `L${m[1]}`;
  m = /^TG_(\d)$/.exec(c);
  if (m) return `TG${m[1]}`;
  return c.replace(/^(KEY_|MEDIA_|MOUSE_)/, "").slice(0, 6);
}

function fillKeycodeSelect(select, { holdMode = false } = {}) {
  select.innerHTML = "";
  if (holdMode) {
    // Halte-Aktion: jede Aktion ist erlaubt (Tap A / Halten B, Modifier, Layer, Media, Maus)
    const none = document.createElement("option");
    none.value = "NONE";
    none.textContent = "-- Keine (Nur Einzeltaste) --";
    select.appendChild(none);
  }
  KEYCODES.forEach(group => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.group;
    group.keys.forEach(k => {
      if (holdMode && k.code === "NONE") return; // "Keine" steht bereits oben
      const opt = document.createElement("option");
      opt.value = k.code;
      opt.textContent = holdMode ? `Halten = ${k.label} (${k.code})` : `${k.label} (${k.code})`;
      optgroup.appendChild(opt);
    });
    select.appendChild(optgroup);
  });
}

function populateKeycodeSelects() {
  fillKeycodeSelect(document.getElementById("primaryActionSelect"));
  fillKeycodeSelect(document.getElementById("comboActionSelect"));
  fillKeycodeSelect(document.getElementById("holdActionSelect"), { holdMode: true });
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
    const isComboKey = currentConfig.combos.some(combo => combo.key1 && combo.key2 &&
      ((combo.key1.r === r && combo.key1.c === c) || (combo.key2.r === r && combo.key2.c === c))
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
    sublabelEl.textContent = holdSublabel(keyData.hold);
    sublabelEl.title = `Halten = ${keyData.hold}`;
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

// Setzt den Tasten-Inspektor in den Ausgangszustand zurück (keine Taste gewählt, keine Markierung)
function clearKeySelection() {
  if (!selectedKey) return;
  selectedKey = null;
  renderMatrix();
  document.getElementById("inspectorBody").style.display = "none";
  document.getElementById("inspectorPlaceholder").style.display = "";
  document.getElementById("selectedKeyCoords").textContent = "Keine Taste gewählt";
  const btnClear = document.getElementById("btnClearKeySelection");
  if (btnClear) btnClear.style.display = "none";
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
  const btnClear = document.getElementById("btnClearKeySelection");
  if (btnClear) btnClear.style.display = "inline-flex";

  const isThumb = (r === 5 || (r === 2 && c === 6));
  coordsBadge.textContent = `Zeile ${r}, Spalte ${c} ${isThumb ? '(Daumenbereich)' : ''}`;

  const layer = currentConfig.layers[activeLayerIndex] || currentConfig.layers[0];
  const keyData = (layer[r] && layer[r][c]) ? layer[r][c] : { label: "", tap: "NONE", hold: "NONE" };

  labelInput.value = keyData.label || "";
  primarySelect.value = keyData.tap || "KEY_SPACE";
  // Zuvor angehängte Optionen für unbekannte Codes entfernen (sonst sammeln sie sich pro Tastenwahl an)
  holdSelect.querySelectorAll("option[data-unknown-hold]").forEach(o => o.remove());
  holdSelect.value = normalizeHoldCode(keyData.hold);
  // Unbekannter Code (z. B. aus einem Import): nicht still auf "Keine" fallen, sondern anzeigen
  if (holdSelect.value !== normalizeHoldCode(keyData.hold)) {
    const opt = document.createElement("option");
    opt.dataset.unknownHold = "true";
    opt.value = keyData.hold;
    opt.textContent = `Halten = ${keyData.hold}`;
    holdSelect.appendChild(opt);
    holdSelect.value = keyData.hold;
  }
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
    }[combo.behavior] || combo.behavior || "";

    const td1 = document.createElement("td");
    const badge1 = document.createElement("span");
    badge1.className = "combo-key-badge";
    badge1.textContent = (combo.key1 && combo.key1.label) || `R${combo.key1?.r ?? 0}C${combo.key1?.c ?? 0}`;
    td1.appendChild(badge1);

    const tdPlus = document.createElement("td");
    const plusStrong = document.createElement("strong");
    plusStrong.textContent = "+";
    tdPlus.appendChild(plusStrong);

    const td2 = document.createElement("td");
    const badge2 = document.createElement("span");
    badge2.className = "combo-key-badge";
    badge2.textContent = (combo.key2 && combo.key2.label) || `R${combo.key2?.r ?? 0}C${combo.key2?.c ?? 0}`;
    td2.appendChild(badge2);

    const tdAction = document.createElement("td");
    const actStrong = document.createElement("strong");
    actStrong.textContent = combo.actionLabel || combo.action || "";
    tdAction.appendChild(actStrong);

    const tdBehavior = document.createElement("td");
    const behSpan = document.createElement("span");
    behSpan.style.color = "#94a3b8";
    behSpan.style.fontSize = "0.85rem";
    behSpan.textContent = String(behaviorName);
    tdBehavior.appendChild(behSpan);

    const tdDel = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-danger btn-sm";
    delBtn.textContent = "Löschen";
    delBtn.addEventListener("click", () => deleteCombo(combo.id));
    tdDel.appendChild(delBtn);

    tr.appendChild(td1);
    tr.appendChild(tdPlus);
    tr.appendChild(td2);
    tr.appendChild(tdAction);
    tr.appendChild(tdBehavior);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });
}

window.deleteCombo = function(id) {
  const deletedCombo = currentConfig.combos ? currentConfig.combos.find(c => c.id === id) : null;
  currentConfig.combos = currentConfig.combos.filter(c => c.id !== id);
  renderCombosTable();
  renderMatrix();
  saveConfigToServer();
  if (deletedCombo) {
    markPendingSync({
      type: "combo_del",
      title: `Combo-Chord gelöscht`,
      description: deletedCombo.name || "Combo",
      revert: () => {
        if (!currentConfig.combos) currentConfig.combos = [];
        if (!currentConfig.combos.some(c => c.id === deletedCombo.id) && currentConfig.combos.length < MAX_COMBOS) {
          currentConfig.combos.push(deletedCombo);
        }
        renderCombosTable();
        renderMatrix();
        saveConfigToServer();
      }
    });
  }
};

function setupEventListeners() {
  // Tasten-Inspektor zurücksetzen: Button im Header oder Esc (außerhalb von Eingabefeldern)
  document.getElementById("btnClearKeySelection").addEventListener("click", clearKeySelection);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && selectedKey && !isEditableTarget(e.target)) clearKeySelection();
  });

  // Apply key inspector changes
  document.getElementById("btnApplyKey").addEventListener("click", async () => {
    if (!selectedKey) return;
    const { r, c } = selectedKey;

    while (currentConfig.layers.length <= activeLayerIndex) {
      currentConfig.layers.push(JSON.parse(JSON.stringify(currentConfig.layers[0])));
    }

    const targetLayer = activeLayerIndex;
    const layer = currentConfig.layers[targetLayer];
    if (!layer[r]) layer[r] = [];

    const labelInput = document.getElementById("keyLabelInput");
    const primarySelect = document.getElementById("primaryActionSelect");
    const holdSelect = document.getElementById("holdActionSelect");

    const label = labelInput.value.trim() || primarySelect.options[primarySelect.selectedIndex].text.split(" ")[0];
    const tap = primarySelect.value;
    const hold = holdSelect.value;
    if (!isPhysicalKey(r, c)) {
      showToast(`R${r}C${c} existiert physisch nicht.`);
      return;
    }

    const oldKey = JSON.parse(JSON.stringify(layer[r][c] || { label: "---", tap: "NONE", hold: "NONE" }));
    const layerName = (currentConfig.layerNames && currentConfig.layerNames[targetLayer]) || `Layer ${targetLayer}`;
    const oldDesc = oldKey.label || (oldKey.tap && oldKey.tap !== "NONE" ? oldKey.tap : "---");
    const newDesc = label || (tap && tap !== "NONE" ? tap : (hold || "---"));

    layer[r][c] = { label, tap, hold };
    renderMatrix();

    const { tapCode, holdCode } = keyToNumericActions(layer[r][c]);

    const changeRecord = {
      type: "key",
      title: `Taste [R${r}, C${c}] (${layerName})`,
      description: `${oldDesc} ➔ ${newDesc}`,
      revert: () => {
        if (currentConfig.layers[targetLayer] && currentConfig.layers[targetLayer][r]) {
          currentConfig.layers[targetLayer][r][c] = oldKey;
          renderMatrix();
          if (selectedKey && selectedKey.r === r && selectedKey.c === c && activeLayerIndex === targetLayer) {
            updateInspector(r, c);
          }
          saveConfigToServer();
        }
      }
    };

    // SET_KEY <l> <r> <c> <tap> <hold>: Firmware antwortet mit OK SET_KEY bzw. ERR (Toast im Notification-Handler)
    const sent = await sendDeviceCommand(`SET_KEY ${targetLayer} ${r} ${c} ${tapCode} ${holdCode}`);
    if (sent) {
      showToast(`⚡ An Dactyl übertragen: [R${r}, C${c}] = ${label}`);
    } else {
      markPendingSync(changeRecord);
    }

    saveConfigToServer();
  });

  // Pending Changes Drawer Event Listeners
  const pendingBadge = document.getElementById("pendingSyncBadge");
  if (pendingBadge) {
    pendingBadge.addEventListener("click", () => {
      if (pendingChanges.length > 0) {
        togglePendingChangesDrawer();
      }
    });
  }
  const btnToggleDrawer = document.getElementById("btnTogglePendingDrawer");
  if (btnToggleDrawer) {
    btnToggleDrawer.addEventListener("click", togglePendingChangesDrawer);
  }
  const btnDiscardAll = document.getElementById("btnDiscardAllPending");
  if (btnDiscardAll) {
    btnDiscardAll.addEventListener("click", discardAllPendingChanges);
  }

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
    if (currentConfig.combos.length >= MAX_COMBOS) {
      alert(`Maximal ${MAX_COMBOS} Combos werden von der Firmware unterstützt.`);
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
    saveConfigToServer();

    markPendingSync({
      type: "combo_add",
      title: `Combo-Chord hinzugefügt`,
      description: newCombo.name,
      revert: () => {
        currentConfig.combos = currentConfig.combos.filter(c => c.id !== newCombo.id);
        renderCombosTable();
        renderMatrix();
        saveConfigToServer();
      }
    });
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
        // Vollständig validieren, BEVOR der Zustand ersetzt oder auf dem Server gespeichert wird
        validateConfigShape(parsed);
        if (!confirm(`Konfiguration aus "${file.name || "Backup"}" importieren? Die aktuelle Belegung wird ersetzt (Rückgängig über die vorgemerkten Änderungen).`)) {
          return;
        }
        const oldConfig = JSON.parse(JSON.stringify(currentConfig));
        currentConfig = normalizeConfig(parsed);
        renderLayerButtons();
        renderMatrix();
        renderCombosTable();
        if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
        saveConfigToServer();
        markPendingSync({
          type: "import",
          snapshot: true,
          title: "JSON-Konfiguration importiert",
          description: `${file.name || "Backup"} geladen`,
          revert: () => {
            currentConfig = oldConfig;
            renderLayerButtons();
            renderMatrix();
            renderCombosTable();
            if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
            saveConfigToServer();
          }
        });
      } catch (err) {
        alert("Ungültige JSON-Datei: " + err.message);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  });

  const btnWrite = document.getElementById("btnWriteConfig");
  if (btnWrite) btnWrite.addEventListener("click", () => writeConfigToESP32({ autoDisconnectAfter: false }));
  const btnRead = document.getElementById("btnReadConfig");
  if (btnRead) btnRead.addEventListener("click", readConfigFromESP32);

  const btnSaveToDactyl = document.getElementById("btnSaveToDactyl");
  if (btnSaveToDactyl) {
    btnSaveToDactyl.addEventListener("click", saveAndFlashToDactyl);
  }

  const btnSaveSettings = document.getElementById("btnSaveSettings");
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener("click", async () => {
      // Werte auf die Firmware-Bereiche begrenzen (Firmware lehnt Werte außerhalb mit ERR ARGS ab)
      const devName = sanitizeCommandText(document.getElementById("deviceNameInput")?.value, "Dactyl Keyboard");
      const debounce = clampSetting("debounceMs", parseInt(document.getElementById("debounceInput")?.value, 10));
      const comboTimeout = clampSetting("comboTimeoutMs", parseInt(document.getElementById("comboTimeoutInput")?.value, 10));
      const standbyMinutes = clampSetting("standbyTimeoutMinutes", parseInt(document.getElementById("standbyTimeoutSelect")?.value, 10));
      const sleepMinutes = clampSetting("sleepTimeoutMinutes", parseInt(document.getElementById("sleepTimeoutSelect")?.value, 10));
      const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
      setVal("deviceNameInput", devName);
      setVal("debounceInput", debounce);
      setVal("comboTimeoutInput", comboTimeout);

      const oldSettings = JSON.parse(JSON.stringify(currentConfig.settings || {}));

      currentConfig.settings = {
        deviceName: devName,
        debounceMs: debounce,
        comboTimeoutMs: comboTimeout,
        standbyTimeoutMinutes: standbyMinutes,
        sleepTimeoutMinutes: sleepMinutes
      };

      saveConfigToServer();

      const changeRecord = {
        type: "settings",
        snapshot: true,
        title: `Einstellungen & Timeouts`,
        description: `Standby: ${standbyMinutes}m, Sleep: ${sleepMinutes}m, Name: "${devName}"`,
        revert: () => {
          currentConfig.settings = oldSettings;
          applySettingsToInputs(oldSettings);
          saveConfigToServer();
        }
      };

      if (isDeviceConnected()) {
        const cmds = [
          `SET_STANDBY ${standbyMinutes}`,
          `SET_SLEEP ${sleepMinutes}`,
          `SET_DEV_NAME ${devName}`,
          `SET_DEBOUNCE ${debounce}`,
          `SET_COMBO_TIMEOUT ${comboTimeout}`
        ];
        let allOk = true;
        for (const cmd of cmds) {
          if (!(await sendDeviceCommand(cmd))) { allOk = false; break; }
        }
        if (allOk) {
          showToast("✅ Device-Einstellungen & Timeouts an ESP32 übertragen!");
        } else {
          markPendingSync(changeRecord);
        }
      } else {
        markPendingSync(changeRecord);
      }
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

    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (res.ok && data.success) {
      if (hadSerial) {
        try {
          await new Promise(r => setTimeout(r, 1200)); // ESP32 Reboot nach Flashen abwarten
          // Ohne User-Geste ist requestPort() nicht erlaubt: bereits freigegebenen Port wiederverwenden
          await connectSerial({ reuseGrantedPort: true });
          if (serialPort && serialPort.writable) {
            if (currentConfig.settings) {
              const sb = currentConfig.settings.standbyTimeoutMinutes ?? 5;
              const sl = currentConfig.settings.sleepTimeoutMinutes ?? 60;
              await sendSerialCommand(`SET_STANDBY ${sb}`);
              await sendSerialCommand(`SET_SLEEP ${sl}`);
            }
            for (let l = 0; l < currentConfig.layerNames.length; l++) {
              await sendSerialCommand(`SET_NAME ${l} ${sanitizeCommandText(currentConfig.layerNames[l], DEFAULT_LAYER_NAMES[l])}`);
            }
          }
        } catch (reconnectErr) {
          console.warn("Serial reconnect nach Flashen fehlgeschlagen:", reconnectErr);
        }
      }
      clearPendingSync();
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
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      if (!isPhysicalKey(r, c)) continue;
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
// Web Bluetooth Permission Management & Live-Sync Flow
// =============================================================================

function isBtPermissionVerified() {
  return localStorage.getItem("dactyl_bt_permission_verified") === "true";
}

function setBtPermissionUIState(state) {
  // state: 'unverified' | 'denied' | 'granted'
  const btnCheck = document.getElementById("btnCheckBtPermission");
  const btnConfig = document.getElementById("btnOpenBtSettings");
  const btnSync = document.getElementById("btnConnectBle");

  if (state === "granted") {
    if (btnCheck) btnCheck.style.display = "none";
    if (btnConfig) btnConfig.style.display = "none";
    if (btnSync) btnSync.style.display = "inline-flex";
  } else if (state === "denied") {
    if (btnCheck) {
      btnCheck.style.display = "inline-flex";
      btnCheck.innerHTML = `<span class="btn-icon">🔄</span> Erneut prüfen`;
      btnCheck.title = "Klicke hier, nachdem du 'Dactyl Configurator' in den macOS Systemeinstellungen aktiviert hast";
    }
    if (btnConfig) btnConfig.style.display = "inline-flex";
    if (btnSync) btnSync.style.display = "none";
  } else {
    // unverified (default)
    if (btnCheck) {
      btnCheck.style.display = "inline-flex";
      btnCheck.innerHTML = `<span class="btn-icon">🔒</span> Bluetooth prüfen`;
      btnCheck.title = "Prüft die macOS Bluetooth-Berechtigung für diese App und schaltet den Live-Sync-Button frei";
    }
    if (btnConfig) btnConfig.style.display = "none";
    if (btnSync) btnSync.style.display = "none";
  }
}

async function openMacBluetoothSettings() {
  showToast("⚙️ Öffne macOS Systemeinstellungen...");
  try {
    const res = await fetch("/api/open_bluetooth_settings", { method: "POST" });
    if (res.ok) {
      showToast("⚙️ Systemeinstellungen geöffnet! Aktiviere 'Dactyl Configurator' unter Bluetooth und klicke anschließend auf 'Erneut prüfen'.", 8000);
      return;
    }
  } catch (e) {
    console.warn("Server open_bluetooth_settings failed, falling back to direct URL:", e);
  }
  window.open("x-apple.systempreferences:com.apple.preference.security?Privacy_Bluetooth");
  showToast("⚙️ Systemeinstellungen geöffnet! Aktiviere 'Dactyl Configurator' unter Bluetooth und klicke anschließend auf 'Erneut prüfen'.", 8000);
}

async function checkBluetoothPermission() {
  if (!("bluetooth" in navigator)) {
    alert("Web Bluetooth wird von deinem Browser oder dieser Electron-App nicht unterstützt.");
    return;
  }

  const btnCheck = document.getElementById("btnCheckBtPermission");
  if (btnCheck) btnCheck.innerHTML = `<span class="btn-icon">⏳</span> Prüfe...`;

  showToast("🔍 Prüfe Bluetooth-Berechtigung (bitte eventuelle Systemabfrage erlauben)...");

  try {
    const dev = await navigator.bluetooth.requestDevice({
      filters: [
        { name: "Dactyl Config" },
        { namePrefix: "Dactyl Config" },
        { services: [CONFIG_SERVICE_UUID] },
        { name: "Dactyl Keyboard" },
        { namePrefix: "Dactyl" }
      ],
      optionalServices: [CONFIG_SERVICE_UUID]
    });

    localStorage.setItem("dactyl_bt_permission_verified", "true");
    setBtPermissionUIState("granted");
    showToast("✅ Bluetooth-Berechtigung erteilt! Verbinde direkt mit Dactyl Config...");
    registerPermittedBleDevice(dev);
    await connectToBleDevice(dev, false);
  } catch (err) {
    console.warn("Bluetooth permission check result:", err);
    const msg = (err.message || "").toLowerCase();

    if (msg.includes("denied") || msg.includes("permission") || msg.includes("scan for bluetooth devices")) {
      // macOS OS-level TCC or user explicitly denied
      localStorage.removeItem("dactyl_bt_permission_verified");
      setBtPermissionUIState("denied");
      showToast("❌ macOS verwehrt Bluetooth-Zugriff! Klicke auf 'macOS Bluetooth-Freigabe öffnen'.", 7000);
    } else if (err.name === "NotFoundError") {
      // Scan lief (Berechtigung vorhanden), aber kein Gerät gewählt/gefunden
      localStorage.setItem("dactyl_bt_permission_verified", "true");
      setBtPermissionUIState("granted");
      showToast("✅ Bluetooth-Berechtigung aktiv! 'Bluetooth Live-Sync' ist jetzt bereit.", 4000);
    } else {
      // Adapter aus, nicht unterstützt o. ä.: Berechtigung NICHT als erteilt markieren
      setBtPermissionUIState("unverified");
      showToast("⚠️ Bluetooth nicht verfügbar: " + (err.message || err.name), 6000);
    }
  }
}

// =============================================================================
// Web Bluetooth Live-Sync & Modern Auto-Sync (getDevices + watchAdvertisements)
// =============================================================================

async function initModernBleAutoSync() {
  if (!("bluetooth" in navigator) || typeof navigator.bluetooth.getDevices !== "function") {
    console.log("[BLE Auto-Sync] navigator.bluetooth.getDevices() nicht verfügbar.");
    return;
  }

  try {
    const devices = await navigator.bluetooth.getDevices();
    for (const dev of devices) {
      registerPermittedBleDevice(dev);
    }
    if (devices.length > 0) {
      console.log(`[BLE Auto-Sync] ${devices.length} autorisierte(s) Bluetooth-Gerät(e) überwacht.`);
    }
  } catch (e) {
    console.warn("[BLE Auto-Sync] Fehler bei getDevices():", e);
  }

  if (!bleAutoPollTimer) {
    bleAutoPollTimer = setInterval(async () => {
      if (bleConfigChar || isConnectingBle || isAutoSyncing || knownBleDevices.length === 0) return;
      for (const dev of knownBleDevices) {
        // Nur für das Config-Profil ("Dactyl Config") im Hintergrund prüfen
        if (dev.name && !dev.name.includes("Config") && knownBleDevices.length > 1) continue;
        try {
          if (typeof dev.watchAdvertisements === "function" && !dev.watchingAdvertisements) {
            await dev.watchAdvertisements();
          }
        } catch (err) {
          // Ignorieren, falls bereits aktiv oder nicht unterstützt
        }
      }
    }, 3000);
  }
}

function registerPermittedBleDevice(dev) {
  if (!dev) return;
  if (!knownBleDevices.some(d => d.id === dev.id)) {
    knownBleDevices.push(dev);
  }
  if (watchedBleDevices.has(dev.id)) return;
  watchedBleDevices.add(dev.id);

  dev.addEventListener("advertisementreceived", async (event) => {
    const eventName = event.name || "";
    const hasConfigUuid = Array.isArray(event.uuids) && event.uuids.some(u => u.toLowerCase() === CONFIG_SERVICE_UUID.toLowerCase());
    const isConfigAdv = eventName.includes("Config") || hasConfigUuid;
    if (!isConfigAdv) return;
    if (Date.now() - lastBleDisconnectTime < 2500) return;
    console.log(`[BLE Auto-Sync] Advertisement empfangen (Name: '${eventName}', RSSI: ${event.rssi})`);
    if (bleConfigChar || isConnectingBle) return;
    await connectToBleDevice(dev, true);
  });

  if (typeof dev.watchAdvertisements === "function") {
    dev.watchAdvertisements().then(() => {
      console.log(`[BLE Auto-Sync] watchAdvertisements() aktiv für '${dev.name || dev.id}'`);
    }).catch((err) => {
      console.warn(`[BLE Auto-Sync] watchAdvertisements() Hinweis für '${dev.name || dev.id}':`, err.message);
    });
  }
}

async function connectToBleDevice(device, isAutoTriggered = false) {
  if (!device || bleConfigChar || isConnectingBle) return;
  isConnectingBle = true;

  try {
    bleDevice = device;
    bleDevice.removeEventListener("gattserverdisconnected", onBleDisconnected);
    bleDevice.addEventListener("gattserverdisconnected", onBleDisconnected);

    if (isAutoTriggered) {
      showToast("⚡ 'Dactyl Config' erkannt! Verbinde automatisch...");
    } else {
      showToast("Verbinde mit Dactyl Bluetooth GATT Server...");
    }

    bleServer = await bleDevice.gatt.connect();
    const service = await bleServer.getPrimaryService(CONFIG_SERVICE_UUID);
    const char = await service.getCharacteristic(CONFIG_CHARACTERISTIC_UUID);

    await char.startNotifications();
    char.removeEventListener("characteristicvaluechanged", handleBleNotification);
    char.addEventListener("characteristicvaluechanged", handleBleNotification);
    bleConfigChar = char;

    updateBleUI(true, bleDevice.name || "Dactyl Config");
    updateConfigModeUI(true, false);

    const autoSyncChk = document.getElementById("chkAutoSyncOnCombo");
    const shouldOneShotAutoSync = autoSyncChk && autoSyncChk.checked;

    if (shouldOneShotAutoSync) {
      // One-Shot Auto-Sync: Konfiguration übertragen, danach automatisch trennen & zurück zur Mac-Tastatur!
      await new Promise(r => setTimeout(r, 120));
      await writeConfigToESP32({ autoDisconnectAfter: true });
    } else {
      showToast("⚡ Konfig-Modus verbunden! Live-Remapping aktiv.");
      setTimeout(async () => {
        if (!bleConfigChar) return;
        if (pendingSyncCount > 0) {
          await writeConfigToESP32({ autoDisconnectAfter: false });
        } else {
          await sendBleCommand("GET_NAMES");
          await sendBleCommand("GET_INFO");
        }
      }, 180);
    }
  } catch (err) {
    console.warn("BLE connection attempt failed:", err);
    bleConfigChar = null;
    bleServer = null;
    if (bleDevice && bleDevice.gatt && bleDevice.gatt.connected) {
      try {
        bleDevice.gatt.disconnect();
      } catch (_) {}
    }
    updateBleUI(false);
    updateConfigModeUI(false, false);
    if (!isAutoTriggered) {
      showToast("Bluetooth-Fehler: " + err.message);
    }
  } finally {
    isConnectingBle = false;
  }
}

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
    // Falls die Tastatur per USB verbunden ist und noch nicht im Config-Modus ist, können wir sie direkt per ENTER_CONFIG umschalten
    if (serialPort && serialPort.writable && !isConfigModeActive) {
      await sendSerialCommand("ENTER_CONFIG");
      await new Promise(r => setTimeout(r, 350));
    }

    showToast("Suche nach 'Dactyl Config' (R4C5 + R0C0 für 0.5s gedrückt halten)...");
    const selectedDevice = await navigator.bluetooth.requestDevice({
      filters: [
        { name: "Dactyl Config" },
        { namePrefix: "Dactyl Config" },
        { services: [CONFIG_SERVICE_UUID] },
        { name: "Dactyl Keyboard" },
        { namePrefix: "Dactyl" }
      ],
      optionalServices: [CONFIG_SERVICE_UUID]
    });

    registerPermittedBleDevice(selectedDevice);
    await connectToBleDevice(selectedDevice, false);

  } catch (err) {
    console.error("BLE requestDevice error:", err);
    updateBleUI(false);
    const msg = (err.message || "").toLowerCase();
    if (msg.includes("denied") || msg.includes("permission") || msg.includes("scan for bluetooth devices")) {
      localStorage.removeItem("dactyl_bt_permission_verified");
      setBtPermissionUIState("denied");
      showToast("❌ macOS verwehrt Bluetooth-Zugriff! Klicke auf 'macOS Bluetooth-Freigabe öffnen'.", 7000);
    } else if (err.name === "NotFoundError") {
      showToast("⚠️ Kein 'Dactyl Config' gefunden (" + (err.message || "Timeout") + "). Halte R4C5 + R0C0 für 0.5s auf der Tastatur gedrückt!");
    } else {
      showToast("Bluetooth-Fehler: " + err.message);
    }
  }
}

// Sendet EXIT_CONFIG und trennt. Rückgabe: true, wenn die Tastatur den Befehl bestätigt hat.
async function disconnectBle() {
  lastBleDisconnectTime = Date.now();
  let exitConfirmed = false;
  if (bleConfigChar) {
    exitConfirmed = (await sendBleCommandAwait("EXIT_CONFIG", "EXIT_CONFIG", 1500)) === true;
  }
  const dev = bleDevice;
  if (dev && dev.gatt.connected) {
    dev.gatt.disconnect(); // löst gattserverdisconnected -> onBleDisconnected aus
  }
  onBleDisconnected();
  if (!exitConfirmed) {
    showToast("⚠️ EXIT_CONFIG nicht bestätigt: Die Tastatur kehrt spätestens nach 3 Min automatisch in den Tastaturmodus zurück.", 7000);
  }
  return exitConfirmed;
}

function onBleDisconnected() {
  lastBleDisconnectTime = Date.now();
  // Idempotent: manuelles Trennen und das gattserverdisconnected-Event rufen diese Funktion beide auf
  if (!bleDevice && !bleConfigChar && !bleServer) return;
  if (bleDevice) bleDevice.removeEventListener("gattserverdisconnected", onBleDisconnected);
  if (bleConfigChar) bleConfigChar.removeEventListener("characteristicvaluechanged", handleBleNotification);
  rejectAllPendingAcks("Bluetooth-Verbindung getrennt");
  bleConfigChar = null;
  bleServer = null;
  bleDevice = null;
  updateBleUI(false);
  updateConfigModeUI(false, false);
  showToast("⌨️ Konfig-Modus beendet -> Tastatur wieder mit Mac verbunden.");
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
      btn.title = "Einmalig koppeln oder manuell verbinden (R4C5 + R0C0 für 0.5s gedrückt halten)";
    }
  }

  if (btPill) {
    if (connected) {
      btPill.className = "bluetooth-status-pill connected";
      if (nameText) nameText.textContent = devName || "Dactyl Config";
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

function sendBleCommand(cmd) {
  if (!bleConfigChar) return Promise.resolve(false);
  const runWrite = async () => {
    if (!bleConfigChar) return false;
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(cmd + "\n");
      if (bleConfigChar.writeValueWithResponse) {
        await bleConfigChar.writeValueWithResponse(data);
      } else {
        await bleConfigChar.writeValue(data);
      }
      console.log("[BLE SENT]", cmd);
      return true;
    } catch (e) {
      console.warn("BLE send error:", cmd, e);
      return false;
    }
  };
  const p = bleWriteQueue.then(runWrite, runWrite);
  bleWriteQueue = p.then(() => {}, () => {});
  return p;
}

// -----------------------------------------------------------------------------
// Firmware-Bestätigungen (OK <CMD> / ERR ...): Erfolg erst nach Antwort der Tastatur
// -----------------------------------------------------------------------------
const pendingAcks = [];

// Wartet auf "OK <okPrefix>" bzw. ein ERR für diesen Befehl. Löst mit true (OK), false (ERR) oder null (Timeout) auf.
function waitForAck(okPrefix, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const entry = { okPrefix, resolve, timer: null };
    entry.timer = setTimeout(() => {
      const i = pendingAcks.indexOf(entry);
      if (i !== -1) pendingAcks.splice(i, 1);
      resolve(null);
    }, timeoutMs);
    pendingAcks.push(entry);
  });
}

function resolveAcksForLine(line) {
  if (!line.startsWith("OK ") && !line.startsWith("ERR ")) return;
  const isOk = line.startsWith("OK ");
  for (let i = 0; i < pendingAcks.length; i++) {
    const entry = pendingAcks[i];
    // OK <CMD> ... bzw. ERR <GRUND> <CMD>... (ERR BUSY/ARGS/NVS/UNKNOWN enthalten den Befehlsnamen)
    const matches = isOk ? line.startsWith(`OK ${entry.okPrefix}`) : line.includes(entry.okPrefix);
    if (matches) {
      clearTimeout(entry.timer);
      pendingAcks.splice(i, 1);
      entry.resolve(isOk);
      return;
    }
  }
}

function rejectAllPendingAcks(reason) {
  while (pendingAcks.length) {
    const entry = pendingAcks.shift();
    clearTimeout(entry.timer);
    console.warn("Bestätigung verworfen:", entry.okPrefix, reason);
    entry.resolve(false);
  }
}

async function sendBleCommandAwait(cmd, okPrefix, timeoutMs) {
  const ack = waitForAck(okPrefix, timeoutMs);
  const sent = await sendBleCommand(cmd);
  if (!sent) {
    resolveAcksForLine(`ERR SEND ${okPrefix}`);
    return false;
  }
  return ack;
}

function isDeviceConnected() {
  return !!bleConfigChar || !!(serialPort && serialPort.writable);
}

// Sendet einen Befehl über die aktive Verbindung (BLE bevorzugt). Rückgabe: true bei erfolgreichem Senden.
async function sendDeviceCommand(cmd) {
  if (bleConfigChar) return sendBleCommand(cmd);
  if (serialPort && serialPort.writable) return sendSerialCommand(cmd);
  return false;
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

function onSerialPortDisconnected(event) {
  if (serialPort && event && event.target === serialPort) {
    showToast("🔌 USB-Verbindung zum ESP32 getrennt.");
    disconnectSerial();
  }
}

let serialTransition = Promise.resolve();

// connectSerial/disconnectSerial laufen nacheinander, damit ein Verbinden nie in ein laufendes Trennen fällt
function connectSerial(options = {}) {
  const run = () => connectSerialNow(options);
  serialTransition = serialTransition.then(run, run);
  return serialTransition;
}

function disconnectSerial() {
  const run = () => disconnectSerialNow();
  serialTransition = serialTransition.then(run, run);
  return serialTransition;
}

async function connectSerialNow(options = {}) {
  if (!("serial" in navigator)) {
    alert("WebSerial wird von deinem Browser nicht unterstützt. Bitte benutze Google Chrome, Microsoft Edge, Arc oder Opera.");
    return;
  }
  if (serialPort) return; // bereits verbunden

  let port = null;
  try {
    if (options.reuseGrantedPort && typeof navigator.serial.getPorts === "function") {
      const granted = await navigator.serial.getPorts();
      port = granted[0] || null;
      if (!port) throw new Error("Kein bereits freigegebener USB-Port gefunden. Bitte manuell verbinden.");
    } else {
      port = await navigator.serial.requestPort();
    }
    await port.open({ baudRate: 115200 });
    // Erst nach erfolgreichem open() als aktive Verbindung übernehmen
    serialPort = port;
    serialPort.addEventListener("disconnect", onSerialPortDisconnected);

    keepReading = true;
    updateConnectionUI(true, "ESP32 (USB 115200 Baud)");
    showToast("Erfolgreich mit ESP32 verbunden!");

    // Start read loop
    serialReadPromise = startSerialReadLoop(port);

    // Query device info
    setTimeout(() => {
      sendSerialCommand("GET_INFO");
    }, 300);

  } catch (err) {
    console.error("Serial connection error:", err);
    if (port && port !== serialPort) {
      try { await port.close(); } catch (_) {}
    }
    serialPort = null;
    updateConnectionUI(false, "Verbindung fehlgeschlagen");
    showToast("Verbindung abgebrochen oder Fehler: " + err.message);
  }
}

async function disconnectSerialNow() {
  if (!serialPort && !serialReadPromise) return;
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
    const port = serialPort;
    serialPort = null;
    port.removeEventListener("disconnect", onSerialPortDisconnected);
    try {
      await port.close();
    } catch(e) {
      console.warn("Serial close warning:", e);
    }
  }
  if (!bleConfigChar) rejectAllPendingAcks("USB-Verbindung getrennt");
  serialReader = null;
  updateConnectionUI(false, "Nicht verbunden");
  showToast("ESP32 getrennt.");
}

function updateBatteryUI(battery, voltage) {
  // Akkumessung deaktiviert (LOLIN32 Lite besitzt keinen internen Spannungsteiler)
}

function resetBatteryUI() {
  // Akkumessung deaktiviert
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

// Serielle Schreibvorgänge werden serialisiert (nur ein Writer-Lock gleichzeitig). Rückgabe: true bei Erfolg.
let serialWriteQueue = Promise.resolve();
function sendSerialCommand(cmd) {
  const run = async () => {
    if (!serialPort || !serialPort.writable) return false;
    let writer = null;
    try {
      writer = serialPort.writable.getWriter();
      await writer.write(new TextEncoder().encode(cmd + "\n"));
      return true;
    } catch (e) {
      console.warn("Failed to send command to ESP32:", cmd, e);
      return false;
    } finally {
      // Lock immer freigeben, sonst schlagen alle späteren Schreibvorgänge fehl
      if (writer) {
        try { writer.releaseLock(); } catch (_) {}
      }
    }
  };
  const p = serialWriteQueue.then(run, run);
  serialWriteQueue = p.then(() => {}, () => {});
  return p;
}

// Der Read-Loop ist an "seinen" Port gebunden: ein späteres connectSerial() kann ihn nicht wiederbeleben,
// und sein finally gibt nur den eigenen Reader frei.
async function startSerialReadLoop(port) {
  const decoder = new TextDecoder();
  let buffer = "";
  let reader = null;

  try {
    reader = port.readable.getReader();
    serialReader = reader;
    while (serialPort === port && keepReading) {
      const { value, done } = await reader.read();
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
    if (keepReading && serialPort === port) {
      console.warn("Serial read loop error:", err);
    }
  } finally {
    if (reader) {
      try { reader.releaseLock(); } catch(e) {}
    }
    if (serialReader === reader) serialReader = null;
  }
}

function handleSerialLine(line) {
  if (!line) return;

  // Bestätigungen/Fehler zuerst an wartende Sync-Schritte weiterreichen
  resolveAcksForLine(line);
  if (line.startsWith("ERR ")) {
    console.warn("[ESP32 ERR]", line);
    if (!isAutoSyncing) showToast(`⚠️ Tastatur meldet Fehler: ${line}`, 6000);
    return;
  }

  // 0. Konfig-Modus Status-Events
  if (line === "MODE:CONFIG" || line.startsWith("OK ENTER_CONFIG")) {
    updateConfigModeUI(true, isAutoSyncing);
    showToast("⚡ Tastatur ist jetzt im KONFIG-MODUS ('Dactyl Config')!");
    return;
  }
  if (line === "MODE:KEYBOARD" || line.startsWith("OK EXIT_CONFIG")) {
    updateConfigModeUI(false, false);
    showToast("⌨️ Tastaturmodus aktiv! Verbunden mit macOS.");
    return;
  }
  if (line.startsWith("STATUS:")) {
    if (line.includes("ConfigMode=1")) {
      updateConfigModeUI(true, isAutoSyncing);
    } else if (line.includes("ConfigMode=0") && !bleConfigChar) {
      updateConfigModeUI(false, false);
    }
    return;
  }

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

      if (info.config_mode !== undefined) {
        updateConfigModeUI(!!info.config_mode, isAutoSyncing);
      }
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
      if (info.debounce_ms !== undefined) {
        const debInput = document.getElementById("debounceInput");
        if (debInput) debInput.value = String(info.debounce_ms);
        if (currentConfig.settings) currentConfig.settings.debounceMs = info.debounce_ms;
      }
      if (info.combo_timeout_ms !== undefined) {
        const ctInput = document.getElementById("comboTimeoutInput");
        if (ctInput) ctInput.value = String(info.combo_timeout_ms);
        if (currentConfig.settings) currentConfig.settings.comboTimeoutMs = info.combo_timeout_ms;
      }
      if (info.name && !info.name.includes("Config")) {
        const devNameInput = document.getElementById("deviceNameInput");
        if (devNameInput) devNameInput.value = info.name;
        if (currentConfig.settings) currentConfig.settings.deviceName = info.name;
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
      if (!isValidIndex(evt.r, NUM_ROWS) || !isValidIndex(evt.c, NUM_COLS)) return;
      const pressedLayer = isValidIndex(evt.layer, NUM_LAYERS) ? evt.layer : undefined;
      if (isValidIndex(evt.target_layer, NUM_LAYERS) && evt.target_layer !== activeLayerIndex) {
        switchLayerUI(evt.target_layer);
      }
      triggerVisualKeyPress(evt.r, evt.c, typeof evt.key === "string" ? evt.key : "", "R", pressedLayer);
    } catch (e) {
      console.warn("Failed to parse KEY_PRESS:", e, line);
    }
  }

  // 3. Taste losgelassen (Key Release Event)
  else if (line.startsWith("KEY_RELEASE:")) {
    try {
      const evt = JSON.parse(line.substring(12));
      if (!isValidIndex(evt.r, NUM_ROWS) || !isValidIndex(evt.c, NUM_COLS)) return;
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
  else if (line.startsWith("LAYER_DATA:") || line.startsWith("HOLD_DATA:")) {
    const isHold = line.startsWith("HOLD_DATA:");
    try {
      const data = JSON.parse(line.substring(isHold ? 10 : 11));
      // Gerätedaten nur innerhalb der Matrixgrenzen übernehmen (kein "__proto__", keine Sparse-Arrays)
      if (isValidIndex(data.l, NUM_LAYERS) && Array.isArray(data.k)) {
        while (currentConfig.layers.length <= data.l) currentConfig.layers.push([]);
        const layer = currentConfig.layers[data.l];
        for (let r = 0; r < Math.min(data.k.length, NUM_ROWS); r++) {
          if (!Array.isArray(data.k[r])) continue;
          if (!Array.isArray(layer[r])) layer[r] = [];
          for (let c = 0; c < Math.min(data.k[r].length, NUM_COLS); c++) {
            const code = data.k[r][c];
            if (!Number.isInteger(code) || code < 0 || code > 0xFFFF) continue;
            const def = findDefinitionByCode(code);
            if (isHold) {
              if (!layer[r][c]) layer[r][c] = { label: "---", tap: "NONE", hold: "NONE" };
              layer[r][c].hold = code === 0 ? "NONE" : def.tap;
            } else {
              layer[r][c] = { label: def.label, tap: def.tap, hold: "NONE" };
            }
          }
        }
        renderMatrix();
      }
    } catch (e) {
      console.warn("Failed to parse LAYER_DATA/HOLD_DATA:", e, line);
    }
  } else if (line.startsWith("CONFIG_SYNC_DONE")) {
    clearPendingSync();
    saveConfigToServer();
    showToast("✅ Tastaturbelegung vollständig vom ESP32 synchronisiert!");
  }

  // 6. Layer-Namen von Firmware synchronisieren
  else if (line.startsWith("LAYER_NAMES:")) {
    try {
      const names = JSON.parse(line.substring(12));
      if (Array.isArray(names) && names.length > 0) {
        currentConfig.layerNames = DEFAULT_LAYER_NAMES.map((def, i) => sanitizeCommandText(names[i], def));
        renderLayerButtons();
        saveConfigToServer();
        showToast("Ebenen-Namen von Tastatur synchronisiert!");
      }
    } catch (e) {
      console.warn("Failed to parse LAYER_NAMES:", e, line);
    }
  }

  // 7. Bestätigung von Konfigurations-Befehlen
  // Ausstehende Änderungen werden NICHT hier verworfen, sondern erst nach vollständig bestätigtem Sync
  // (writeConfigToESP32), damit ein Fehler in der Combo-Phase den Änderungsverlauf nicht löscht.
  else if (line.startsWith("OK SET_KEY")) {
    if (!isAutoSyncing) showToast("✅ Taste im ESP32 NVS gespeichert!");
  } else if (line.startsWith("OK SAVE_NVS")) {
    if (!isAutoSyncing) showToast("✅ Tastenbelegung dauerhaft im ESP32 NVS gespeichert!");
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
  if (!isValidIndex(layerIdx, NUM_LAYERS) || layerIdx === activeLayerIndex) return;
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

// Beim keydown aufgelöste Taste je event.code, damit keyup dieselbe Taste loslässt
// (auch wenn sich die gehaltene Ebene zwischenzeitlich geändert hat)
const browserHeldKeys = new Map();

function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function setupBrowserKeyboardHooks() {
  const releaseHeld = (code) => {
    const held = browserHeldKeys.get(code);
    if (!held) return;
    browserHeldKeys.delete(code);
    if (held.trigger) {
      triggerVisualKeyRelease(held.trigger.r, held.trigger.c, "R");
    }
    triggerVisualKeyRelease(held.matched.r, held.matched.c, "R");
  };

  window.addEventListener("keydown", (e) => {
    // Beim Tippen in Eingabefeldern (Namen, Zahlen) keine Tastenvisualisierung auslösen
    if (isEditableTarget(e.target)) return;
    if (e.repeat) return;
    // Veralteter Eintrag ohne keyup (z. B. nach Cmd-Kombination): erst freigeben, dann neu drücken
    if (browserHeldKeys.has(e.code)) releaseHeld(e.code);

    const matched = resolveKeyFromEvent(e);
    if (matched) {
      let trigger = null;
      // If key is on another layer, also highlight the MO key on layer 0!
      if (matched.layer !== undefined && matched.layer > 0) {
        trigger = findLayerTriggerKey(matched.layer);
        if (trigger) {
          triggerVisualKeyPress(trigger.r, trigger.c, trigger.label, "R", 0);
        }
      }
      browserHeldKeys.set(e.code, { matched, trigger });
      triggerVisualKeyPress(matched.r, matched.c, matched.label, "R", matched.layer);
    }
  });

  window.addEventListener("keyup", (e) => {
    releaseHeld(e.code);
    // macOS sendet für Tasten, die bei gehaltener Cmd-Taste losgelassen werden, kein keyup:
    // beim Loslassen von Cmd alle noch gehaltenen Einträge freigeben
    if (e.key === "Meta") {
      for (const code of [...browserHeldKeys.keys()]) releaseHeld(code);
    }
  });

  // Fokusverlust (z. B. Cmd+Tab): gehaltene Tasten zurücksetzen, sonst bleibt die Anzeige hängen
  window.addEventListener("blur", () => {
    for (const code of [...browserHeldKeys.keys()]) releaseHeld(code);
  });
}

// =============================================================================
// Configuration Read/Write
// =============================================================================

async function writeConfigToESP32(options = {}) {
  const autoDisconnectAfter = !!(options && options.autoDisconnectAfter);

  if (!bleConfigChar && (!serialPort || !serialPort.writable)) {
    alert("Keine Verbindung zum ESP32 aktiv! Halte R4C5 + R0C0 für 0.5s an der Tastatur gedrückt oder verbinde USB.");
    return;
  }
  if (isAutoSyncing) return;

  const progressWrap = document.getElementById("autoSyncProgressWrap");
  const progressBar = document.getElementById("autoSyncProgressBar");
  if (progressWrap) progressWrap.style.display = "block";
  if (progressBar) progressBar.style.width = "2%";

  const previousConfigMode = isConfigModeActive;
  updateConfigModeUI(bleConfigChar ? true : previousConfigMode, true);
  showToast("🔄 Übertrage Konfiguration an Dactyl ESP32 NVS...");

  // Änderungen, die während des Syncs neu vorgemerkt werden, dürfen am Ende nicht mit verworfen werden
  const syncedChangeIds = new Set(pendingChanges.map(c => c.id));
  let syncSucceeded = false;
  let completedSteps = 0;

  try {
    // Fehler bei SET_K (ungültige Argumente, belegter Mutex) meldet die Firmware asynchron als ERR
    let batchError = null;
    const errWatcher = (okPrefix) => waitForAck(okPrefix, 60000).then(ok => { if (ok === false && !batchError) batchError = okPrefix; });

    const sendCmd = async (cmd) => {
      let ok = false;
      if (bleConfigChar) {
        ok = await sendBleCommand(cmd);
        if (!ok) throw new Error(`BLE-Übertragung unterbrochen (${cmd})`);
      } else if (serialPort && serialPort.writable) {
        ok = await sendSerialCommand(cmd);
        if (!ok) throw new Error(`USB-Übertragung fehlgeschlagen (${cmd})`);
        // Pacing für USB-Serial Übertragung
        if (completedSteps % 16 === 0) {
          await new Promise(r => setTimeout(r, 4));
        }
      } else {
        throw new Error("Verbindung zum ESP32 unterbrochen");
      }
    };

    // Sendet einen Befehl und wartet auf "OK <prefix>" der Firmware (ERR oder Timeout = Fehler)
    const sendConfirmed = async (cmd, okPrefix, timeoutMs = 3000) => {
      const ack = waitForAck(okPrefix, timeoutMs);
      try {
        await sendCmd(cmd);
      } catch (e) {
        resolveAcksForLine(`ERR SEND ${okPrefix}`);
        throw e;
      }
      if ((await ack) !== true) throw new Error(`Tastatur hat ${okPrefix} nicht bestätigt`);
    };

    const totalLayers = Math.min(currentConfig.layers.length, NUM_LAYERS);
    const totalCombos = Array.isArray(currentConfig.combos) ? currentConfig.combos.length : 0;
    const totalSteps = NUM_LAYERS + (totalLayers * NUM_ROWS * NUM_COLS) + totalCombos + 8;
    const updateProgress = () => {
      completedSteps++;
      if (progressBar) {
        const pct = Math.min(100, Math.round((completedSteps / totalSteps) * 100));
        progressBar.style.width = `${pct}%`;
      }
    };

    const s = currentConfig.settings || {};
    await sendConfirmed(`SET_STANDBY ${clampSetting("standbyTimeoutMinutes", s.standbyTimeoutMinutes ?? 5)}`, "SET_STANDBY");
    updateProgress();
    await sendConfirmed(`SET_SLEEP ${clampSetting("sleepTimeoutMinutes", s.sleepTimeoutMinutes ?? 60)}`, "SET_SLEEP");
    updateProgress();
    await sendConfirmed(`SET_DEV_NAME ${sanitizeCommandText(s.deviceName, "Dactyl Keyboard")}`, "SET_DEV_NAME");
    updateProgress();
    await sendConfirmed(`SET_DEBOUNCE ${clampSetting("debounceMs", s.debounceMs ?? 5)}`, "SET_DEBOUNCE");
    updateProgress();
    await sendConfirmed(`SET_COMBO_TIMEOUT ${clampSetting("comboTimeoutMs", s.comboTimeoutMs ?? 40)}`, "SET_COMBO_TIMEOUT");
    updateProgress();

    for (let l = 0; l < NUM_LAYERS; l++) {
      const name = sanitizeCommandText(currentConfig.layerNames[l], DEFAULT_LAYER_NAMES[l]);
      await sendConfirmed(`SET_NAME ${l} ${name}`, `SET_NAME ${l}`);
      updateProgress();
    }

    // Schnelles RAM-Update für alle Tasten via SET_K (ohne OK) + einmaliges, bestätigtes SAVE_NVS
    const setKErr = errWatcher("SET_K");
    for (let l = 0; l < totalLayers; l++) {
      const layer = currentConfig.layers[l] || [];
      for (let r = 0; r < NUM_ROWS; r++) {
        const row = layer[r] || [];
        for (let c = 0; c < NUM_COLS; c++) {
          const { tapCode, holdCode } = keyToNumericActions(row[c]);
          await sendCmd(`SET_K ${l} ${r} ${c} ${tapCode} ${holdCode}`);
          updateProgress();
        }
      }
    }

    await sendConfirmed("SAVE_NVS", "SAVE_NVS", 5000);
    if (batchError) throw new Error("Tastatur hat mindestens ein SET_K abgelehnt");
    // Watcher für SET_K-Fehler beenden (kein ERR eingetroffen)
    resolveAcksForLine("OK SET_K");
    await setKErr;
    updateProgress();

    // Combos synchronisieren
    await sendConfirmed("CLEAR_COMBOS", "CLEAR_COMBOS");
    const bMap = { "KEY_PRESS": 0, "MODIFIER_HOLD": 1, "LAYER_TOGGLE": 2 };
    for (const cb of currentConfig.combos.slice(0, MAX_COMBOS)) {
      const bCode = bMap[cb.behavior] ?? 0;
      const actCode = actionCodeToNumeric(cb.action);
      await sendConfirmed(`ADD_COMBO ${cb.key1.r} ${cb.key1.c} ${cb.key2.r} ${cb.key2.c} ${bCode} ${actCode}`, "ADD_COMBO");
      updateProgress();
    }
    await sendConfirmed("SAVE_COMBOS", "SAVE_COMBOS", 5000);
    updateProgress();

    // Nur die tatsächlich übertragenen Änderungen verwerfen
    pendingChanges = pendingChanges.filter(c => !syncedChangeIds.has(c.id));
    if (pendingChanges.length === 0) clearPendingSync(); else renderPendingSyncUI();
    syncSucceeded = true;
  } catch (err) {
    console.error("Write config error:", err);
    rejectAllPendingAcks("Sync abgebrochen");
    showToast("Fehler beim Übertragen der Konfiguration: " + err.message + " (Änderungen bleiben vorgemerkt)", 7000);
  } finally {
    isAutoSyncing = false;
    // One-Shot: Tastatur IMMER zurück in den Mac-Modus schicken, auch nach einem Fehler
    if (autoDisconnectAfter && bleConfigChar) {
      await new Promise(r => setTimeout(r, 150));
      const exited = await disconnectBle();
      if (syncSucceeded && exited) {
        showToast("✅ Automatisch synchronisiert & getrennt! Tastatur ist wieder mit deinem Mac verbunden.");
      }
    } else {
      updateConfigModeUI(bleConfigChar ? true : previousConfigMode, false);
      if (syncSucceeded) showToast("✅ Vollständige Konfiguration im ESP32 NVS gespeichert!");
    }
    setTimeout(() => {
      if (progressWrap) progressWrap.style.display = "none";
      if (progressBar) progressBar.style.width = "0%";
    }, 600);
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

let toastTimer = null;
function showToast(msg, durationMs = 2800) {
  const toast = document.getElementById("toastNotification");
  if (!toast) return;
  toast.textContent = msg;
  toast.className = "toast show";
  // Älteren Timer verwerfen, damit er die neue Meldung nicht vorzeitig ausblendet
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = "toast";
    toastTimer = null;
  }, durationMs);
}
