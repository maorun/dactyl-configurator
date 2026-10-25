// =============================================================================
// Direct Bluetooth Keyboard Hooks (macOS HID Keydown / Keyup in Browser)
// =============================================================================

const ACTION_CODE_TO_EVENT_CODES = {
  "KEY_A": ["KeyA"], "KEY_B": ["KeyB"], "KEY_C": ["KeyC"], "KEY_D": ["KeyD"],
  "KEY_E": ["KeyE"], "KEY_F": ["KeyF"], "KEY_G": ["KeyG"], "KEY_H": ["KeyH"],
  "KEY_I": ["KeyI"], "KEY_J": ["KeyJ"], "KEY_K": ["KeyK"], "KEY_L": ["KeyL"],
  "KEY_M": ["KeyM"], "KEY_N": ["KeyN"], "KEY_O": ["KeyO"], "KEY_P": ["KeyP"],
  "KEY_Q": ["KeyQ"], "KEY_R": ["KeyR"], "KEY_S": ["KeyS"], "KEY_T": ["KeyT"],
  "KEY_U": ["KeyU"], "KEY_V": ["KeyV"], "KEY_W": ["KeyW"], "KEY_X": ["KeyX"],
  "KEY_Y": ["KeyY"], "KEY_Z": ["KeyZ"],
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
  // Umlaute: die Tottaste Alt + u (ß: Alt + s) kommt mit gehaltenem Alt an
  "UMLAUT_AE": ["KeyU"], "UMLAUT_OE": ["KeyU"], "UMLAUT_UE": ["KeyU"],
  "UMLAUT_AE_UPPER": ["KeyU"], "UMLAUT_OE_UPPER": ["KeyU"], "UMLAUT_UE_UPPER": ["KeyU"],
  "UMLAUT_SZ": ["KeyS"],
};

// Sucht in einer Ebene die Taste, deren Tap-Aktion den Browser-Code eventCode erzeugt.
// Mit gehaltenem Alt haben Umlaut-Tasten Vorrang (Tottaste); ohne Alt treffen Umlaute nicht.
function findKeyForEventCode(layer, eventCode, altKey) {
  const passes = altKey ? [true, false] : [false];
  for (const umlautPass of passes) {
    for (let r = 0; r < NUM_ROWS; r++) {
      for (let c = 0; c < NUM_COLS; c++) {
        const k = layer && layer[r] && layer[r][c];
        if (!k || !k.tap || k.tap === "NONE") continue;
        if (k.tap.startsWith("UMLAUT_") !== umlautPass) continue;
        const matchingCodes = ACTION_CODE_TO_EVENT_CODES[k.tap];
        if (matchingCodes && matchingCodes.includes(eventCode)) return { r, c, key: k };
      }
    }
  }
  return null;
}

function getHeldKeyboardLayer() {
  const base = currentConfig.layers[0];
  if (!base) return 0;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      if (activePressedKeys.has(`${editSide}_${r}_${c}`)) {
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
    const hit = findKeyForEventCode(kbLayer, e.code, e.altKey);
    if (hit) return { r: hit.r, c: hit.c, label: hit.key.label || e.key, layer: kbLayerIdx };
  }

  // 2. Falls ein Layer gehalten war aber die Taste nicht belegt ist: Fallback auf Base Layer (Layer 0)
  if (kbLayerIdx !== 0) {
    const hit = findKeyForEventCode(currentConfig.layers[0], e.code, e.altKey);
    if (hit) return { r: hit.r, c: hit.c, label: hit.key.label || e.key, layer: 0 };
  }

  // 3. Fallback auf die physische Scancode-Tabelle des Profils (nur mit Tabelle, immer Layer 0)
  const scancodeMap = activeProfile().scancodeMap;
  if (scancodeMap && scancodeMap[e.code]) {
    return { ...scancodeMap[e.code], layer: 0 };
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
      if (k && [k.tap, k.hold, k.dtap].some(a => a === moCode || a === tgCode)) {
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
      triggerVisualKeyRelease(held.trigger.r, held.trigger.c, held.side);
    }
    triggerVisualKeyRelease(held.matched.r, held.matched.c, held.side);
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
          triggerVisualKeyPress(trigger.r, trigger.c, trigger.label, editSide, 0);
        }
      }
      browserHeldKeys.set(e.code, { matched, trigger, side: editSide });
      triggerVisualKeyPress(matched.r, matched.c, matched.label, editSide, matched.layer);
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
