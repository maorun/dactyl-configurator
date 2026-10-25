// =============================================================================
// Keycodes, Presets und Action-Codes
// =============================================================================
// Keycode-Liste, Layout-Presets, Action-Code-Tabellen, Tastenpaare und Sonderzeichen (macOS US).

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
    { code: "UMLAUT_AE", label: "ä", char: "ä" }, { code: "UMLAUT_OE", label: "ö", char: "ö" },
    { code: "UMLAUT_UE", label: "ü", char: "ü" }, { code: "UMLAUT_AE_UPPER", label: "Ä", char: "Ä" },
    { code: "UMLAUT_OE_UPPER", label: "Ö", char: "Ö" }, { code: "UMLAUT_UE_UPPER", label: "Ü", char: "Ü" },
    { code: "UMLAUT_SZ", label: "ß", char: "ß" }
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
    { code: "KEY_END", label: "Ende", char: "" },
    { code: "KEY_NON_US_BACKSLASH", label: "ISO-Taste (§ ±)", char: "§" }
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

  // ISO-Taste zwischen linkem Shift und Z (HID 0x64)
  "KEY_NON_US_BACKSLASH": 0xEC,

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

  // Umlaute für das macOS-Layout "U.S." (0x150..0x156): Tottaste Alt + u, dann Vokal; ß = Alt + s
  "UMLAUT_AE": 0x150, "UMLAUT_OE": 0x151, "UMLAUT_UE": 0x152,
  "UMLAUT_AE_UPPER": 0x153, "UMLAUT_OE_UPPER": 0x154, "UMLAUT_UE_UPPER": 0x155,
  "UMLAUT_SZ": 0x156,

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

// Beschriftung der Umlaut-Aktionen (Keycap, GET_CONFIG-Rückweg)
const UMLAUT_LABELS = {
  UMLAUT_AE: "ä", UMLAUT_OE: "ö", UMLAUT_UE: "ü", UMLAUT_AE_UPPER: "Ä", UMLAUT_OE_UPPER: "Ö", UMLAUT_UE_UPPER: "Ü", UMLAUT_SZ: "ß"
};

// Tastenpaar PAIR_<n>: eine Taste drückt zwei Tasten gleichzeitig (Index in currentConfig.keyPairs)
const ACT_KEY_PAIR_BASE = 0x140;
const MAX_KEY_PAIRS = 16;

function pairIndexFromCode(code) {
  const m = /^PAIR_(\d{1,2})$/.exec(String(code || ""));
  if (!m) return -1;
  const idx = Number(m[1]);
  return idx < MAX_KEY_PAIRS ? idx : -1;
}

// Sonderzeichen für das macOS-Layout "U.S.". Die Firmware sendet US-HID-Codes, macOS gibt sie unverändert aus.
// code = ASCII-Zeichen (Shift implizit, dactylAsciiToHid) oder Tastencode,
// pair = Option-Zeichen als Tastenpaar (die App legt das Paar beim Übernehmen an oder nutzt ein gleiches).
const DE_MAC_CHARS = [
  { char: "!", name: "Ausrufezeichen", hint: "Shift + 1", code: "!" },
  { char: "@", name: "At-Zeichen", hint: "Shift + 2", code: "@" },
  { char: "#", name: "Raute", hint: "Shift + 3", code: "#" },
  { char: "$", name: "Dollar", hint: "Shift + 4", code: "$" },
  { char: "%", name: "Prozent", hint: "Shift + 5", code: "%" },
  { char: "^", name: "Zirkumflex", hint: "Shift + 6", code: "^" },
  { char: "&", name: "Und-Zeichen", hint: "Shift + 7", code: "&" },
  { char: "*", name: "Stern", hint: "Shift + 8", code: "*" },
  { char: "(", name: "Klammer auf", hint: "Shift + 9", code: "(" },
  { char: ")", name: "Klammer zu", hint: "Shift + 0", code: ")" },
  { char: "_", name: "Unterstrich", hint: "Shift + -", code: "_" },
  { char: "+", name: "Plus", hint: "Shift + =", code: "+" },
  { char: "{", name: "Geschweifte Klammer auf", hint: "Shift + [", code: "{" },
  { char: "}", name: "Geschweifte Klammer zu", hint: "Shift + ]", code: "}" },
  { char: "|", name: "Senkrechter Strich", hint: "Shift + \\", code: "|" },
  { char: ":", name: "Doppelpunkt", hint: "Shift + ;", code: ":" },
  { char: "\"", name: "Anführungszeichen", hint: "Shift + '", code: "\"" },
  { char: "~", name: "Tilde", hint: "Shift + `", code: "~" },
  { char: "<", name: "Kleiner als", hint: "Shift + ,", code: "<" },
  { char: ">", name: "Größer als", hint: "Shift + .", code: ">" },
  { char: "?", name: "Fragezeichen", hint: "Shift + /", code: "?" },
  { char: "§", name: "Paragraf", hint: "ISO-Taste", code: "KEY_NON_US_BACKSLASH" },
  { char: "°", name: "Grad", hint: "Alt + Shift + 8", pair: { first: "KEY_LEFT_ALT", second: "*" } },
  { char: "€", name: "Euro", hint: "Alt + Shift + 2", pair: { first: "KEY_LEFT_ALT", second: "@" } },
  { char: "´", name: "Akut (Tottaste, danach Leertaste)", hint: "Alt + E", pair: { first: "KEY_LEFT_ALT", second: "KEY_E" } }
];

// Auswahlwert eines Option-Zeichens; wird beim Übernehmen in PAIR_<n> aufgelöst und nie gespeichert
function charPairCode(index) {
  return `CHAR_PAIR_${index}`;
}

function charPairIndexFromCode(code) {
  const m = /^CHAR_PAIR_(\d{1,2})$/.exec(String(code || ""));
  if (!m) return -1;
  const idx = Number(m[1]);
  return idx < DE_MAC_CHARS.length && DE_MAC_CHARS[idx].pair ? idx : -1;
}

// Index eines gleichen Tastenpaars (gleiche Zahlencodes, gleiche Reihenfolge) oder -1
function findKeyPairIndex(pairs, pair) {
  const first = actionCodeToNumeric(pair.first);
  const second = actionCodeToNumeric(pair.second);
  return (pairs || []).findIndex(p => p && actionCodeToNumeric(p.first) === first && actionCodeToNumeric(p.second) === second);
}

// Deutsches Zeichen zu einem Einzelcode (z. B. ">" -> ":"), sonst null
function deMacCharForCode(code) {
  const entry = DE_MAC_CHARS.find(e => e.code === code);
  return entry ? entry.char : null;
}

// Löst CHAR_PAIR_<i> in Tap/Halten/Doppel-Tipp zu PAIR_<n> auf: ein gleiches Paar wird wiederverwendet,
// sonst angehängt. Ändert pairs nicht; added = neu anzuhängende Paare in Reihenfolge. null = kein Platz.
function resolveCharPairActions(actions, pairs, max = MAX_KEY_PAIRS) {
  const all = [...(pairs || [])];
  const added = [];
  const resolved = {};
  for (const [field, code] of Object.entries(actions)) {
    const charIdx = charPairIndexFromCode(code);
    if (charIdx < 0) {
      resolved[field] = code;
      continue;
    }
    const pair = DE_MAC_CHARS[charIdx].pair;
    let idx = findKeyPairIndex(all, pair);
    if (idx < 0) {
      if (all.length >= max) return null;
      all.push({ ...pair });
      added.push({ ...pair });
      idx = all.length - 1;
    }
    resolved[field] = `PAIR_${idx}`;
  }
  return { actions: resolved, added };
}

// Suchfeld der Aktions-Auswahl: Teilstring ohne Groß-/Kleinschreibung, leere Suche trifft alles
function keycodeOptionMatches(text, query) {
  const q = String(query || "").trim().toLowerCase();
  return q === "" || String(text || "").toLowerCase().includes(q);
}

function actionCodeToNumeric(code) {
  if (!code || code === "NONE") return 0;
  if (ACTION_TO_NUMERIC[code] !== undefined) {
    return ACTION_TO_NUMERIC[code];
  }
  const pairIdx = pairIndexFromCode(code);
  if (pairIdx >= 0) return ACT_KEY_PAIR_BASE + pairIdx;
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

// Tap-, Halte- und Doppel-Tipp-Code einer Taste für SET_K/SET_KEY. Hold ohne Tap wirkt wie eine normale
// Taste, Doppel-Tipp ohne Tap bleibt ohne Wirkung (wie in Firmware und server.py).
function keyToNumericActions(k) {
  const tap = (k && k.tap && k.tap !== "NONE") ? k.tap : "NONE";
  const hold = (k && k.hold && k.hold !== "NONE") ? k.hold : "NONE";
  const dtap = (k && k.dtap && k.dtap !== "NONE") ? k.dtap : "NONE";
  if (tap === "NONE") return { tapCode: actionCodeToNumeric(hold), holdCode: 0, dtapCode: 0 };
  return { tapCode: actionCodeToNumeric(tap), holdCode: actionCodeToNumeric(hold), dtapCode: actionCodeToNumeric(dtap) };
}

// GET_CONFIG sendet pro Ebene LAYER_DATA (Tap), HOLD_DATA (Halten) und DTAP_DATA (Doppel-Tipp)
const MATRIX_DATA_FIELDS = { "LAYER_DATA:": "tap", "HOLD_DATA:": "hold", "DTAP_DATA:": "dtap" };

// Übernimmt eine Matrix aus GET_CONFIG in layers. LAYER_DATA setzt die Taste neu (Halten und
// Doppel-Tipp folgen danach), HOLD_DATA/DTAP_DATA setzen nur ihr Feld. Gerätedaten nur innerhalb der
// Matrixgrenzen übernehmen (kein "__proto__", keine Sparse-Arrays). Gibt true zurück, wenn übernommen.
function applyMatrixData(layers, field, data) {
  if (!field || !data || !isValidIndex(data.l, NUM_LAYERS) || !Array.isArray(data.k)) return false;
  while (layers.length <= data.l) layers.push([]);
  const layer = layers[data.l];
  for (let r = 0; r < Math.min(data.k.length, NUM_ROWS); r++) {
    if (!Array.isArray(data.k[r])) continue;
    if (!Array.isArray(layer[r])) layer[r] = [];
    for (let c = 0; c < Math.min(data.k[r].length, NUM_COLS); c++) {
      const code = data.k[r][c];
      if (!Number.isInteger(code) || code < 0 || code > 0xFFFF) continue;
      const def = findDefinitionByCode(code);
      if (field === "tap") {
        layer[r][c] = { label: def.label, tap: def.tap, hold: "NONE", dtap: "NONE" };
      } else {
        if (!layer[r][c]) layer[r][c] = { label: "---", tap: "NONE", hold: "NONE", dtap: "NONE" };
        layer[r][c][field] = code === 0 ? "NONE" : def.tap;
      }
    }
  }
  return true;
}

function findDefinitionByCode(numericCode) {
  if (!numericCode || numericCode === 0) return { label: "---", tap: "NONE" };
  if (numericCode >= ACT_KEY_PAIR_BASE && numericCode < ACT_KEY_PAIR_BASE + MAX_KEY_PAIRS) {
    const idx = numericCode - ACT_KEY_PAIR_BASE;
    return { label: `Paar ${idx}`, tap: `PAIR_${idx}` };
  }
  for (const [key, num] of Object.entries(ACTION_TO_NUMERIC)) {
    if (num === numericCode) {
      let lbl = key.replace("KEY_", "").replace("ACT_", "");
      if (key === "ACT_MAC_GLOBE" || key === "MAC_GLOBE") lbl = "Globe";
      else if (key === "LAYER_UP") lbl = "Layer ▲";
      else if (key === "LAYER_DOWN") lbl = "Layer ▼";
      else if (key === "KEY_NON_US_BACKSLASH") lbl = "§";
      else if (UMLAUT_LABELS[key]) lbl = UMLAUT_LABELS[key];
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
    return { label: deMacCharForCode(ch) || ch, tap: ch };
  }
  return { label: `Key ${numericCode}`, tap: `KEY_${numericCode}` };
}
