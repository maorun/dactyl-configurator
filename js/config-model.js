// =============================================================================
// Config-Modell (ohne DOM)
// =============================================================================
// Standard-Config, Grenzen, Validierung, Normalisierung, Matrix-Test und Tipp-Statistik.

// Matrix- und Firmware-Grenzen (identisch zu dactyl_right.ino / server.py)
const NUM_LAYERS = 8;
const NUM_ROWS = 6;
const NUM_COLS = 7;
const MAX_COMBOS = 16;
const MAX_NAME_LENGTH = 31;
const DEFAULT_HOLD_TAP_MODE = 0;
const SETTINGS_RANGES = {
  debounceMs: [1, 50, 5],
  comboTimeoutMs: [10, 200, 40],
  tappingTermMs: [100, 500, 200],
  holdTapMode: [0, 2, 0],
  standbyTimeoutMinutes: [0, 120, 5],
  sleepTimeoutMinutes: [0, 240, 60]
};
const COMBO_BEHAVIORS = ["KEY_PRESS", "MODIFIER_HOLD", "LAYER_TOGGLE"];

// Seitenprofile (fehlende Tasten, Daumen, Config-Combo, Leitungen) liegen in js/side-profiles.js
const SIDE_PROFILES = Dactyl.SIDE_PROFILES;

// Physisch vorhandene Position der Hälfte (rechts fehlen R4C0 und R5C5, links R4C5 und R5C0)
function isPhysicalKey(r, c, profile) {
  return Dactyl.isPhysicalKey(profile, r, c);
}

function isValidIndex(value, max) {
  return Number.isInteger(value) && value >= 0 && value < max;
}

// Tatsächlich verlötete Schalter: Finger 5x6 und Daumenzeile, ohne die fehlenden Positionen der Hälfte
function isWiredSwitch(r, c, profile) {
  return Dactyl.isWiredSwitch(profile, r, c);
}

// Pfeiltasten im Editor: nächste Taste in der Richtung. Finger-Matrix nach Zeile/Spalte (fehlende Tasten
// werden übersprungen), Daumen-Cluster nach seinem Raster (thumbDefs). Am Rand eines Bereichs bleibt die Auswahl.
const KEY_NAV_STEPS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
const FINGER_NAV_ROWS = 5;
const FINGER_NAV_COLS = 6;

function thumbGridCell(def) {
  const [start, span] = String(def.row).split("/").map(s => s.trim());
  const rowStart = parseInt(start, 10);
  const rowSpan = span ? parseInt(span.replace("span", ""), 10) : 1;
  return { col: parseInt(def.col, 10), rowStart, rowEnd: rowStart + rowSpan - 1 };
}

function moveKeySelection(r, c, direction, profile) {
  const step = KEY_NAV_STEPS[direction];
  const stay = { r, c, isThumb: r >= FINGER_NAV_ROWS };
  if (!step || !profile) return stay;
  if (r < FINGER_NAV_ROWS) {
    let nr = r + step[0], nc = c + step[1];
    while (nr >= 0 && nr < FINGER_NAV_ROWS && nc >= 0 && nc < FINGER_NAV_COLS) {
      if (isPhysicalKey(nr, nc, profile)) return { r: nr, c: nc, isThumb: false };
      nr += step[0];
      nc += step[1];
    }
    return stay;
  }
  const defs = profile.thumbDefs.map(def => ({ def, cell: thumbGridCell(def) }));
  const current = defs.find(d => d.def.r === r && d.def.c === c);
  if (!current) return stay;
  const cur = current.cell;
  let candidates;
  if (step[1] !== 0) {
    // Nachbarspalte, deren Zeilen sich mit der aktuellen Taste überschneiden; die oberste zuerst
    candidates = defs.filter(d => d.cell.col === cur.col + step[1] &&
      d.cell.rowStart <= cur.rowEnd && d.cell.rowEnd >= cur.rowStart)
      .sort((a, b) => a.cell.rowStart - b.cell.rowStart);
  } else {
    // Gleiche Spalte, nächste Taste darüber oder darunter
    candidates = defs.filter(d => d.cell.col === cur.col &&
      (step[0] < 0 ? d.cell.rowEnd < cur.rowStart : d.cell.rowStart > cur.rowEnd))
      .sort((a, b) => step[0] < 0 ? b.cell.rowEnd - a.cell.rowEnd : a.cell.rowStart - b.cell.rowStart);
  }
  return candidates.length ? { r: candidates[0].def.r, c: candidates[0].def.c, isThumb: true } : stay;
}

const ARROW_KEY_DIRECTIONS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

// Matrix-Test (Löt-Tester) einer Hälfte; Leitungen laut Profil (AGENTS.md / docs/lolin32_lite_wiring.svg)
// Ein Druck so kurz nach dem Loslassen derselben Taste ist kein Tippen mehr, sondern Prellen des Schalters
const MATRIX_BOUNCE_MS = 30;

function createMatrixTest(profile) {
  return { tested: new Set(), profile, bounces: new Map(), lastRelease: new Map(), lastT: null };
}

function markMatrixKeyTested(test, r, c) {
  if (!isValidIndex(r, NUM_ROWS) || !isValidIndex(c, NUM_COLS) || !isWiredSwitch(r, c, test.profile)) return false;
  const id = `${r}_${c}`;
  if (test.tested.has(id)) return false;
  test.tested.add(id);
  return true;
}

// MATRIX:-Zeile der Firmware: reines Matrix-Ereignis, auch für Tasten ohne Aktion.
// Rückgabe { r, c, pressed } oder null; mit der Scan-Zeit "t" (32 Bit, ms) auch { t }. Eine Zeile älterer Firmware
// hat kein "t", ein ungültiges "t" lässt die Zeile gelten, ohne Zeit (kein Prell-Ergebnis).
function parseMatrixLine(line) {
  if (typeof line !== "string" || !line.startsWith("MATRIX:")) return null;
  let evt;
  try {
    evt = JSON.parse(line.substring(7));
  } catch (_) {
    return null;
  }
  if (!evt || typeof evt !== "object") return null;
  if (!isValidIndex(evt.r, NUM_ROWS) || !isValidIndex(evt.c, NUM_COLS)) return null;
  if (evt.pressed !== 0 && evt.pressed !== 1) return null;
  const parsed = { r: evt.r, c: evt.c, pressed: evt.pressed === 1 };
  if (Number.isInteger(evt.t) && evt.t >= 0 && evt.t <= 0xFFFFFFFF) parsed.t = evt.t;
  return parsed;
}

// Prellen einer Taste: ein Druck höchstens MATRIX_BOUNCE_MS nach dem Loslassen derselben Taste (Scan-Zeit "t").
// Der Abstand wird modulo 2^32 gebildet, weil millis() nach etwa 49 Tagen überläuft. Ohne "t" (ältere Firmware,
// SPLIT_KEY vom Master) gibt es kein Ergebnis. Rückgabe true, wenn dieses Ereignis ein Prellen war.
// Springt die Zeit zurück (Abstand modulo 2^32 größer als 2^31), hat die Tastatur neu gestartet (millis() beginnt
// bei 0): die gemerkten Loslass-Zeiten stammen dann aus dem alten Lauf und werden verworfen. Ein Überlauf nach
// 2^32 ms ist ein kleiner Schritt vorwärts und löscht nichts. Der Rücksprung erkennt einen Neustart erst am
// ersten Ereignis danach; liegt dieses höchstens 30 ms nach der alten Loslass-Zeit derselben Taste, bleibt ein
// falscher Treffer möglich. Deshalb setzt die App den Zustand zusätzlich bei DEVICE_INFO und MODE: zurück
// (resetMatrixBounceState).
function recordMatrixBounce(test, r, c, pressed, t) {
  if (!isValidIndex(r, NUM_ROWS) || !isValidIndex(c, NUM_COLS) || !isWiredSwitch(r, c, test.profile)) return false;
  if (!Number.isInteger(t)) return false;
  if (test.lastT !== null && ((t - test.lastT) >>> 0) > 0x80000000) test.lastRelease.clear();
  test.lastT = t;
  const id = `${r}_${c}`;
  if (!pressed) {
    test.lastRelease.set(id, t);
    return false;
  }
  if (!test.lastRelease.has(id)) return false;
  const gap = (t - test.lastRelease.get(id)) >>> 0;
  test.lastRelease.delete(id);
  if (gap > MATRIX_BOUNCE_MS) return false;
  test.bounces.set(id, (test.bounces.get(id) || 0) + 1);
  return true;
}

// Vergisst die Loslass-Zeiten (Neustart, neue Verbindung, anderes Board). Die gezählten Treffer bleiben.
function resetMatrixBounceState(test) {
  test.lastRelease.clear();
  test.lastT = null;
}

// Fortschritt und verdächtige Leitungen: Zeile/Spalte ohne erkannte Taste, obwohl andere Tasten funktionieren
function summarizeMatrixTest(test) {
  const rowHits = new Array(NUM_ROWS).fill(0);
  const colHits = new Array(NUM_COLS).fill(0);
  let total = 0;
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      if (!isWiredSwitch(r, c, test.profile)) continue;
      total++;
      if (test.tested.has(`${r}_${c}`)) { rowHits[r]++; colHits[c]++; }
    }
  }
  const tested = test.tested.size;
  const suspectRows = tested ? rowHits.map((n, r) => n === 0 ? r : -1).filter(r => r >= 0) : [];
  const suspectCols = tested ? colHits.map((n, c) => n === 0 ? c : -1).filter(c => c >= 0) : [];
  // Prellende Tasten mit Zähler, sortiert nach Zeile und Spalte
  const bouncingKeys = [];
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      const count = test.bounces.get(`${r}_${c}`);
      if (count) bouncingKeys.push({ r, c, count });
    }
  }
  return { tested, total, suspectRows, suspectCols, bouncingKeys };
}

// Entfernt Steuerzeichen (z. B. Zeilenumbrüche = Befehlsinjektion über Serial), Quotes & Backslashes
function sanitizeCommandText(value, fallback = "") {
  const cleaned = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f"\\]/g, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return cleaned || fallback;
}

// Tri-Layer-Regeln bereinigen (wie server.py validate_tri_layers): höchstens 2, Ebenen 1..7, a != b, Ziel weder a noch b
const MAX_TRI_LAYER_RULES = 2;
function normalizeTriLayers(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const rule of value) {
    if (out.length >= MAX_TRI_LAYER_RULES) break;
    if (!rule || typeof rule !== "object") continue;
    const { a, b, target } = rule;
    if (![a, b, target].every(n => Number.isInteger(n) && n >= 1 && n < NUM_LAYERS)) continue;
    if (a === b || target === a || target === b) continue;
    out.push({ a, b, target });
  }
  return out;
}

function clampSetting(field, value) {
  const [lo, hi, def] = SETTINGS_RANGES[field];
  const n = Number(value);
  if (!Number.isInteger(n)) return def;
  return Math.min(hi, Math.max(lo, n));
}

function normalizeKeyCell(cell) {
  if (!cell || typeof cell !== "object") return { label: "---", tap: "NONE", hold: "NONE", dtap: "NONE" };
  return {
    label: typeof cell.label === "string" ? cell.label.slice(0, 16) : "",
    tap: typeof cell.tap === "string" ? cell.tap : "NONE",
    hold: typeof cell.hold === "string" ? cell.hold : "NONE",
    dtap: typeof cell.dtap === "string" ? cell.dtap : "NONE"
  };
}

// Ein Tastenpaar-Mitglied ist eine normale Taste, ein Modifier, eine Mediataste, Mac Globe oder eine Mausaktion
function isKeyPairMember(code) {
  if (typeof code !== "string" || pairIndexFromCode(code) >= 0 || macroIndexFromCode(code) >= 0) return false;
  const n = actionCodeToNumeric(code);
  return (n >= 1 && n <= 0xFF) || (n >= 0x120 && n <= 0x127) || (n >= 0x130 && n <= 0x134);
}

// Eine Standard-Taste oder ein Modifier (Code 1..255, für Makro-Schritte und Überschreibungen)
function isStandardKeyOrModifier(code) {
  if (typeof code !== "string" || pairIndexFromCode(code) >= 0 || macroIndexFromCode(code) >= 0) return false;
  const n = actionCodeToNumeric(code);
  return n >= 1 && n <= 0xFF;
}

// Eine Überschreibung braucht mindestens einen Modifier (ctrl, shift, alt, gui) ohne Wiederholung sowie eine Taste und
// einen Ersatz, die weder Modifier noch Layer-, Paar- oder Makro-Codes sind (wie server.py und die Firmware)
function isModifierKeyCode(code) {
  const n = actionCodeToNumeric(code);
  return n >= 0x80 && n <= 0x87;
}

function isKeyOverrideMember(code) {
  return isStandardKeyOrModifier(code) && !isModifierKeyCode(code);
}

function isValidKeyOverride(o) {
  return !!o && typeof o === "object" && Array.isArray(o.mods) && o.mods.length > 0 &&
    o.mods.every(m => typeof m === "string" && Object.prototype.hasOwnProperty.call(KEY_OVERRIDE_MODS, m)) &&
    new Set(o.mods).size === o.mods.length && isKeyOverrideMember(o.key) && isKeyOverrideMember(o.replacement);
}

// Modifier einer Überschreibung als Bitmaske (1..15) und in fester Reihenfolge
function keyOverrideModsValue(mods) {
  return (mods || []).reduce((v, m) => v | (KEY_OVERRIDE_MODS[m] || 0), 0);
}

function normalizeKeyOverride(o) {
  const value = keyOverrideModsValue(o.mods);
  return {
    mods: Object.keys(KEY_OVERRIDE_MODS).filter(m => value & KEY_OVERRIDE_MODS[m]),
    key: o.key,
    replacement: o.replacement
  };
}

// Anzeigename, z. B. "Shift + Bksp → Entf"
function keyOverrideLabel(o, labelFor) {
  if (!o) return "?";
  return `${o.mods.map(m => KEY_OVERRIDE_MOD_LABELS[m]).join(" + ")} + ${labelFor(o.key)} → ${labelFor(o.replacement)}`;
}

// true, wenn eine Taste einer Ebene PAIR_<idx> als Tap, Halten oder Doppel-Tipp nutzt.
// Alte Zellen im String-Format ("PAIR_2") zählen als Tap-Aktion.
function isKeyPairUsed(layers, idx) {
  const code = `PAIR_${idx}`;
  const uses = k => (typeof k === "string" ? k === code : !!k && (k.tap === code || k.hold === code || k.dtap === code));
  return (layers || []).some(layer => (layer || []).some(row => (row || []).some(uses)));
}

// Löschen eines Tastenpaars als reine Funktion: used = Tasten oder Combos nutzen das Paar (Nachfrage),
// next = neuer Zustand (removeKeyPairAt), old = Kopie des alten Zustands für den Revert. null = ungültiger Index.
function planKeyPairDeletion(config, idx) {
  const next = removeKeyPairAt(config, idx);
  if (!next) return null;
  const code = `PAIR_${idx}`;
  const used = isKeyPairUsed(config.layers, idx) || (config.combos || []).some(cb => cb && cb.action === code);
  const old = JSON.parse(JSON.stringify({ keyPairs: config.keyPairs, layers: config.layers || [], combos: config.combos || [] }));
  return { used, next, old, removed: { ...config.keyPairs[idx] }, shiftsFollowing: idx < config.keyPairs.length - 1 };
}

// Entfernt das Tastenpaar idx und nummeriert die Verweise neu: PAIR_idx wird "NONE", PAIR_n mit n > idx
// wird PAIR_(n-1). Gilt für Tap, Halten und Doppel-Tipp aller Ebenen sowie für Combo-Aktionen.
// Ändert nichts in-place; liefert { keyPairs, layers, combos } oder null bei ungültigem Index.
function removeKeyPairAt(config, idx) {
  const pairs = (config && config.keyPairs) || [];
  if (!isValidIndex(idx, pairs.length)) return null;
  const remap = code => {
    const n = pairIndexFromCode(code);
    if (n < 0 || n < idx) return code;
    return n === idx ? "NONE" : `PAIR_${n - 1}`;
  };
  const layers = JSON.parse(JSON.stringify(config.layers || []));
  layers.forEach(layer => (layer || []).forEach(row => (row || []).forEach((k, c) => {
    if (typeof k === "string") row[c] = remap(k);
    else if (k && typeof k === "object") ["tap", "hold", "dtap"].forEach(f => { if (f in k) k[f] = remap(k[f]); });
  })));
  const combos = JSON.parse(JSON.stringify(config.combos || [])).map(cb => (cb && "action" in cb ? { ...cb, action: remap(cb.action) } : cb));
  return { keyPairs: pairs.filter((_, i) => i !== idx).map(p => ({ ...p })), layers, combos };
}

// Hängt die beim Übernehmen neu angelegten Paare an pairs an; liefert den Index des ersten neuen Paars
function appendResolvedPairs(pairs, added) {
  const firstIdx = pairs.length;
  added.forEach(pair => pairs.push({ ...pair }));
  return firstIdx;
}

// Revert einer Tastenänderung: entfernt die mitangelegten Paare, solange sie am Ende stehen und keine
// Taste sie nutzt (layers enthält die Taste bereits im alten Zustand). Liefert die Anzahl entfernter Paare.
function revertResolvedPairs(pairs, layers, firstIdx, count) {
  let removed = 0;
  for (let i = firstIdx + count - 1; i >= firstIdx; i--) {
    if (pairs.length !== i + 1 || isKeyPairUsed(layers, i)) break;
    pairs.pop();
    removed++;
  }
  return removed;
}

// Makro-Schritt wie in server.py/Firmware: tap/down/up mit Tastatur-Code 1..255, pause mit ms 1..MACRO_MAX_PAUSE_MS
function isValidMacroStep(step) {
  if (!step || typeof step !== "object" || !Object.prototype.hasOwnProperty.call(MACRO_STEP_TYPES, step.type)) return false;
  if (step.type === "pause") return Number.isInteger(step.ms) && step.ms >= 1 && step.ms <= MACRO_MAX_PAUSE_MS;
  return isStandardKeyOrModifier(step.code);
}

function isValidMacro(macro) {
  return !!macro && typeof macro === "object" && Array.isArray(macro.steps) &&
    macro.steps.length <= MAX_MACRO_STEPS && macro.steps.every(isValidMacroStep);
}

// Text als Makro: Zeichen -> Schritte für das macOS-Layout "U.S." (reine Funktion, ohne DOM).
// Kleinbuchstaben, Ziffern und unverschobene Zeichen sind ein tap; Großbuchstaben und Shift-Zeichen setzen Shift
// per down/up (aufeinanderfolgende Shift-Zeichen teilen sich ein Paar). Umlaute und ß senden die Dead-Key-Folge
// Alt + u (ß: Alt + s), danach den Vokal. Option-Zeichen (° € ´) und alle anderen Zeichen sind nicht konvertierbar.
const MACRO_TEXT_SHIFT_CHARS = {
  "!": "KEY_1", "@": "KEY_2", "#": "KEY_3", "$": "KEY_4", "%": "KEY_5", "^": "KEY_6", "&": "KEY_7", "*": "KEY_8",
  "(": "KEY_9", ")": "KEY_0", "_": "KEY_MINUS", "+": "KEY_EQUAL", "{": "KEY_LEFT_BRACKET", "}": "KEY_RIGHT_BRACKET",
  "|": "KEY_BACKSLASH", ":": "KEY_SEMICOLON", "\"": "KEY_QUOTE", "~": "KEY_GRAVE", "<": "KEY_COMMA", ">": "KEY_PERIOD",
  "?": "KEY_SLASH"
};
const MACRO_TEXT_UMLAUTS = { "ä": "a", "ö": "o", "ü": "u", "Ä": "A", "Ö": "O", "Ü": "U" };

function macroTextKeyFor(ch) {
  // Zeichen -> { code, shift } oder null
  if (Object.prototype.hasOwnProperty.call(MACRO_TEXT_SHIFT_CHARS, ch)) return { code: MACRO_TEXT_SHIFT_CHARS[ch], shift: true };
  if (ch >= "A" && ch <= "Z") return { code: `KEY_${ch}`, shift: true };
  for (const group of KEYCODES) {
    const key = group.keys.find(k => k.char === ch && k.char !== "" && /^KEY_/.test(k.code));
    if (key) return { code: key.code, shift: false };
  }
  return null;
}

// Ergebnis: { steps, count, unsupported (eindeutige Zeichen), tooLong (count > maxSteps) }
function textToMacroSteps(text, maxSteps = MAX_MACRO_STEPS) {
  const steps = [];
  const unsupported = [];
  let shiftDown = false;
  const releaseShift = () => {
    if (shiftDown) steps.push({ type: "up", code: "KEY_LEFT_SHIFT" });
    shiftDown = false;
  };
  const tap = (code, shift) => {
    if (shift && !shiftDown) steps.push({ type: "down", code: "KEY_LEFT_SHIFT" });
    if (!shift) releaseShift();
    shiftDown = shift;
    steps.push({ type: "tap", code });
  };
  for (const ch of String(text == null ? "" : text).normalize("NFC")) {
    if (ch === "\n" || ch === "\r") {
      tap("KEY_RETURN", false);
      continue;
    }
    if (ch === "ß" || Object.prototype.hasOwnProperty.call(MACRO_TEXT_UMLAUTS, ch)) {
      releaseShift();
      steps.push({ type: "down", code: "KEY_LEFT_ALT" }, { type: "tap", code: ch === "ß" ? "KEY_S" : "KEY_U" },
        { type: "up", code: "KEY_LEFT_ALT" });
      if (ch !== "ß") {
        const vowel = MACRO_TEXT_UMLAUTS[ch];
        tap(`KEY_${vowel.toUpperCase()}`, vowel !== vowel.toLowerCase());
      }
      continue;
    }
    const key = macroTextKeyFor(ch);
    if (!key) {
      if (!unsupported.includes(ch)) unsupported.push(ch);
      continue;
    }
    tap(key.code, key.shift);
  }
  releaseShift();
  return { steps, count: steps.length, unsupported, tooLong: steps.length > maxSteps };
}

// Schritt in die gespeicherte Form bringen (nur die Felder seines Typs)
function normalizeMacroStep(step) {
  return step.type === "pause" ? { type: "pause", ms: step.ms } : { type: step.type, code: step.code };
}

// Firmware-Befehle eines Makros: ADD_MACRO, dann je Schritt ADD_MACRO_STEP <typ> <code> <ms>
function macroCommands(macro) {
  return ["ADD_MACRO", ...macro.steps.map(st => st.type === "pause"
    ? `ADD_MACRO_STEP ${MACRO_STEP_TYPES.pause} 0 ${st.ms}`
    : `ADD_MACRO_STEP ${MACRO_STEP_TYPES[st.type]} ${actionCodeToNumeric(st.code)} 0`)];
}

// Zielindex beim Speichern aus dem Makro-Editor: -1 = neues Makro (wird angehängt), sonst ein vorhandener Index.
// null = Speichern nicht erlaubt (Liste voll, oder der Index gehört nicht mehr zur Liste, z. B. nach einem Wechsel
// der Hälfte). Verhindert, dass ein Entwurf ein falsches Makro überschreibt oder Lücken in der Liste erzeugt.
function macroSaveIndex(macros, editIndex) {
  const list = Array.isArray(macros) ? macros : [];
  if (editIndex === -1) return list.length < MAX_MACROS ? list.length : null;
  return isValidIndex(editIndex, list.length) ? editIndex : null;
}

// true, wenn eine Taste einer Ebene MACRO_<idx> als Tap, Halten oder Doppel-Tipp nutzt
function isMacroUsed(layers, idx) {
  const code = `MACRO_${idx}`;
  const uses = k => (typeof k === "string" ? k === code : !!k && (k.tap === code || k.hold === code || k.dtap === code));
  return (layers || []).some(layer => (layer || []).some(row => (row || []).some(uses)));
}

// Wendet remap(code, pos) auf jeden Aktions-Code aller Ebenen an (Kopie). pos = { l, r, c, field };
// field null = Zelle als reiner Code-String.
function remapLayerCodes(layers, remap) {
  const next = JSON.parse(JSON.stringify(layers || []));
  next.forEach((layer, l) => (layer || []).forEach((row, r) => (row || []).forEach((k, c) => {
    if (typeof k === "string") row[c] = remap(k, { l, r, c, field: null });
    else if (k && typeof k === "object") ["tap", "hold", "dtap"].forEach(f => { if (f in k) k[f] = remap(k[f], { l, r, c, field: f }); });
  })));
  return next;
}

// Entfernt das Makro idx und nummeriert die Verweise neu (wie removeKeyPairAt). Combos nutzen keine Makros.
// Ändert nichts in-place; liefert { macros, layers, cleared } oder null bei ungültigem Index.
// cleared: Positionen, deren Verweis auf das Makro geleert wurde (für restoreMacroAt).
function removeMacroAt(config, idx) {
  const macros = (config && config.macros) || [];
  if (!isValidIndex(idx, macros.length)) return null;
  const cleared = [];
  const layers = remapLayerCodes(config.layers, (code, pos) => {
    const n = macroIndexFromCode(code);
    if (n < 0 || n < idx) return code;
    if (n > idx) return `MACRO_${n - 1}`;
    cleared.push(pos);
    return "NONE";
  });
  return { macros: JSON.parse(JSON.stringify(macros.filter((_, i) => i !== idx))), layers, cleared };
}

// Rückgängig zu removeMacroAt auf dem aktuellen Stand: fügt das Makro wieder bei idx ein, rückt höhere Verweise
// zurück und setzt nur die geleerten Positionen wieder, die noch leer sind. Spätere Tastenänderungen bleiben.
function restoreMacroAt(config, idx, macro, cleared) {
  const macros = JSON.parse(JSON.stringify((config && config.macros) || []));
  if (!Number.isInteger(idx) || idx < 0 || idx > macros.length || macros.length >= MAX_MACROS) return null;
  macros.splice(idx, 0, JSON.parse(JSON.stringify(macro)));
  const wasCleared = new Set((cleared || []).map(p => `${p.l},${p.r},${p.c},${p.field}`));
  const layers = remapLayerCodes(config.layers, (code, pos) => {
    const n = macroIndexFromCode(code);
    if (n >= idx) return `MACRO_${n + 1}`;
    if (n < 0 && (code === "NONE" || code === "") && wasCleared.has(`${pos.l},${pos.r},${pos.c},${pos.field}`)) return `MACRO_${idx}`;
    return code;
  });
  return { macros, layers };
}

// Anzeigename eines Tastenpaars, z. B. "Umschalt (Links) + ."
function keyPairLabel(pair, labelFor) {
  if (!pair) return "?";
  return `${labelFor(pair.first)} + ${labelFor(pair.second)}`;
}

// Ältere Configs: Combos mit MODIFIER_HOLD und One-Shot- oder Caps-Word-Aktion sandten nie etwas. Sie werden
// zu KEY_PRESS (wie migrate_config in server.py), statt die ganze Config ungültig zu machen. Ändert cfg in-place.
function migrateConfig(cfg) {
  if (!cfg || typeof cfg !== "object" || !Array.isArray(cfg.combos)) return cfg;
  cfg.combos = cfg.combos.map(cb => (cb && cb.behavior === "MODIFIER_HOLD" && isOneShotOrCapsWordCode(cb.action))
    ? { ...cb, behavior: "KEY_PRESS" } : cb);
  return cfg;
}

// Prüft eine importierte oder vom Server geladene Konfiguration und wirft bei ungültiger Struktur.
// profile: Hälfte, für die die Config bestimmt ist (fehlende Tasten und Combos, wie server.py)
function validateConfigShape(cfg, profile) {
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) throw new Error("Konfiguration muss ein Objekt sein.");
  migrateConfig(cfg);
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
  if (cfg.keyPairs !== undefined) {
    if (!Array.isArray(cfg.keyPairs) || cfg.keyPairs.length > MAX_KEY_PAIRS) {
      throw new Error(`'keyPairs' muss eine Liste mit maximal ${MAX_KEY_PAIRS} Einträgen sein.`);
    }
    cfg.keyPairs.forEach((p, i) => {
      if (!p || typeof p !== "object" || !isKeyPairMember(p.first) || !isKeyPairMember(p.second)) {
        throw new Error(`Tastenpaar ${i} braucht zwei gültige Tasten (first/second).`);
      }
    });
  }
  if (cfg.keyOverrides !== undefined) {
    if (!Array.isArray(cfg.keyOverrides) || cfg.keyOverrides.length > MAX_KEY_OVERRIDES) {
      throw new Error(`'keyOverrides' muss eine Liste mit maximal ${MAX_KEY_OVERRIDES} Einträgen sein.`);
    }
    if (cfg.keyOverrides.length > 0 && profile && !profile.master) {
      throw new Error(`Tasten-Überschreibungen gelten nur für die ${Dactyl.SIDE_PROFILES[Dactyl.getMasterSide()].label} (Master).`);
    }
    cfg.keyOverrides.forEach((o, i) => {
      if (!isValidKeyOverride(o)) {
        throw new Error(`Tasten-Überschreibung ${i} braucht Modifier (ctrl, shift, alt, gui) und zwei normale Tasten (key, replacement).`);
      }
    });
  }
  if (cfg.macros !== undefined) {
    if (!Array.isArray(cfg.macros) || cfg.macros.length > MAX_MACROS) {
      throw new Error(`'macros' muss eine Liste mit maximal ${MAX_MACROS} Einträgen sein.`);
    }
    cfg.macros.forEach((m, i) => {
      if (!isValidMacro(m)) {
        throw new Error(`Makro ${i} ist ungültig (max. ${MAX_MACRO_STEPS} Schritte; tap/down/up mit normaler Taste, pause 1..${MACRO_MAX_PAUSE_MS} ms).`);
      }
    });
  }
  if ((cfg.combos || []).some(cb => cb && macroIndexFromCode(cb.action) >= 0)) throw new Error("Combos unterstützen keine Makros.");
  if ((cfg.combos || []).some(cb => cb && isMouseMoveCode(cb.action))) throw new Error("Combos unterstützen keine Mausbewegung.");
  if (cfg.layerNames !== undefined && !Array.isArray(cfg.layerNames)) throw new Error("'layerNames' muss eine Liste sein.");
  if (cfg.settings !== undefined && (typeof cfg.settings !== "object" || cfg.settings === null)) throw new Error("'settings' muss ein Objekt sein.");
  const absent = Dactyl.absentKeyViolations(profile, cfg);
  if (absent.length) throw new Error(`Diese Tasten gibt es auf der ${profile.label} nicht: ${absent.join(", ")}`);
}

// Ebenen-Werkzeuge: Kopieren, Tauschen und Leeren ganzer Ebenen (liefert neue Ebenen-Liste, ändert nichts in-place)
function transparentLayer() {
  return Array.from({ length: NUM_ROWS }, () =>
    Array.from({ length: NUM_COLS }, () => ({ label: "---", tap: "NONE", hold: "NONE", dtap: "NONE" })));
}

function applyLayerOperation(layers, op, source, target) {
  if (!Array.isArray(layers) || !isValidIndex(source, NUM_LAYERS)) return null;
  const next = JSON.parse(JSON.stringify(layers));
  while (next.length < NUM_LAYERS) next.push(transparentLayer());
  if (op === "clear") {
    next[source] = transparentLayer();
    return next;
  }
  if (!isValidIndex(target, NUM_LAYERS) || target === source) return null;
  if (op === "copy") {
    next[target] = JSON.parse(JSON.stringify(next[source]));
  } else if (op === "swap") {
    [next[source], next[target]] = [next[target], next[source]];
  } else {
    return null;
  }
  return next;
}

// Ein Snapshot (Preset, Import, Ebenen-Werkzeug) ersetzt ganze Bereiche: ältere Änderungen davor und der
// Snapshot selbst (falls nicht der jüngste) dürfen nicht einzeln rückgängig gemacht werden.
function isUndoBlocked(changes, idx) {
  if (!Array.isArray(changes) || !isValidIndex(idx, changes.length)) return true;
  return changes.slice(idx + 1).some(c => c && c.snapshot) || (!!changes[idx].snapshot && idx !== changes.length - 1);
}

// Normalisiert importierte oder vom Server geladene Konfigurationen (nach validateConfigShape).
// profile liefert den Gerätenamen ohne Eintrag ("Dactyl Keyboard" rechts, "Dactyl Links" links).
function normalizeConfig(cfg, profile) {
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
  cfg.keyPairs = Array.isArray(cfg.keyPairs)
    ? cfg.keyPairs.filter(p => p && isKeyPairMember(p.first) && isKeyPairMember(p.second))
        .slice(0, MAX_KEY_PAIRS).map(p => ({ first: p.first, second: p.second }))
    : [];
  // Nur der Master trägt Überschreibungen; die Liste der anderen Hälfte bleibt leer
  cfg.keyOverrides = Array.isArray(cfg.keyOverrides) && profile && profile.master
    ? cfg.keyOverrides.filter(isValidKeyOverride).slice(0, MAX_KEY_OVERRIDES).map(normalizeKeyOverride)
    : [];
  // Ein ungültiges Makro wird leer, nicht entfernt: MACRO_<n> verweist per Index, die Indizes bleiben gleich
  cfg.macros = Array.isArray(cfg.macros)
    ? cfg.macros.slice(0, MAX_MACROS).map((m, i) => ({
        name: sanitizeCommandText(m && m.name, `Makro ${i}`),
        steps: isValidMacro(m) ? m.steps.map(normalizeMacroStep) : []
      }))
    : [];
  const names = Array.isArray(cfg.layerNames) ? cfg.layerNames : [];
  cfg.layerNames = DEFAULT_LAYER_NAMES.map((def, i) => sanitizeCommandText(names[i], def));
  const s = (cfg.settings && typeof cfg.settings === "object") ? cfg.settings : {};
  cfg.settings = {
    deviceName: sanitizeCommandText(s.deviceName, profile.deviceName),
    debounceMs: clampSetting("debounceMs", s.debounceMs ?? 5),
    comboTimeoutMs: clampSetting("comboTimeoutMs", s.comboTimeoutMs ?? 40),
    tappingTermMs: clampSetting("tappingTermMs", s.tappingTermMs ?? 200),
    holdTapMode: clampSetting("holdTapMode", s.holdTapMode ?? 0),
    triLayers: normalizeTriLayers(s.triLayers),
    standbyTimeoutMinutes: clampSetting("standbyTimeoutMinutes", s.standbyTimeoutMinutes ?? 5),
    sleepTimeoutMinutes: clampSetting("sleepTimeoutMinutes", s.sleepTimeoutMinutes ?? 60)
  };
  return cfg;
}

// Tipp-Statistik für Heatmap & WPM (DOM-frei, Zählung nur physischer Tasten der Hälfte aus profile)
const WPM_WINDOW_MS = 60000;
const CHARS_PER_WORD = 5;
const HEAT_LEVELS = 5;

// Zähler je Taste aus gespeicherten Daten, nur physische Tasten der Hälfte
function sanitizeKeyCounts(counts, profile) {
  const out = {};
  let total = 0;
  if (counts && typeof counts === "object" && !Array.isArray(counts)) {
    for (const [id, n] of Object.entries(counts)) {
      const m = /^(\d+)_(\d+)$/.exec(id);
      if (!m || !Number.isSafeInteger(n) || n <= 0) continue;
      const r = Number(m[1]), c = Number(m[2]);
      if (!isValidIndex(r, NUM_ROWS) || !isValidIndex(c, NUM_COLS) || !isPhysicalKey(r, c, profile)) continue;
      out[`${r}_${c}`] = n;
      total += n;
    }
  }
  return { counts: out, total };
}

// stored: { "r_c": n, layers: { "<ebene>": { "r_c": n } } }. Die Gesamtzähler bleiben oben, so liest eine
// ältere App-Version sie weiter (sie verwirft den Schlüssel "layers"); die alte Form hat nur "r_c"-Schlüssel.
function createTypingStats(stored, profile) {
  const base = sanitizeKeyCounts(stored, profile);
  const stats = { counts: base.counts, total: base.total, layerCounts: [], recent: [], profile };
  for (let l = 0; l < NUM_LAYERS; l++) stats.layerCounts.push({});
  const layers = stored && typeof stored === "object" && !Array.isArray(stored)
    && Object.prototype.hasOwnProperty.call(stored, "layers") ? stored.layers : null;
  if (layers && typeof layers === "object" && !Array.isArray(layers)) {
    for (const [key, counts] of Object.entries(layers)) {
      if (!/^\d+$/.test(key) || !isValidIndex(Number(key), NUM_LAYERS)) continue;
      stats.layerCounts[Number(key)] = sanitizeKeyCounts(counts, profile).counts;
    }
  }
  return stats;
}

// Speicherform für localStorage (createTypingStats liest sie wieder)
function serializeTypingStats(stats) {
  const layers = {};
  stats.layerCounts.forEach((counts, l) => {
    if (Object.keys(counts).length) layers[l] = counts;
  });
  return { ...stats.counts, layers };
}

// layer: Ebene beim Drücken (KEY_PRESS / SPLIT_KEY); ohne gültige Ebene zählt die Taste nur gesamt
function recordKeyPress(stats, r, c, nowMs, layer) {
  if (!isValidIndex(r, NUM_ROWS) || !isValidIndex(c, NUM_COLS) || !isPhysicalKey(r, c, stats.profile)) return false;
  const id = `${r}_${c}`;
  stats.counts[id] = (stats.counts[id] || 0) + 1;
  stats.total++;
  if (isValidIndex(layer, NUM_LAYERS)) {
    const layerCounts = stats.layerCounts[layer];
    layerCounts[id] = (layerCounts[id] || 0) + 1;
  }
  stats.recent.push(nowMs);
  pruneRecentPresses(stats, nowMs);
  return true;
}

// Zähler für die Heatmap: alle Ebenen (layer null) oder nur eine Ebene
function heatmapCounts(stats, layer) {
  return isValidIndex(layer, NUM_LAYERS) ? stats.layerCounts[layer] : stats.counts;
}

function pruneRecentPresses(stats, nowMs) {
  let drop = 0;
  while (drop < stats.recent.length && nowMs - stats.recent[drop] >= WPM_WINDOW_MS) drop++;
  if (drop) stats.recent.splice(0, drop);
}

// Wörter pro Minute über das gleitende Fenster der letzten 60 s (5 Anschläge = 1 Wort)
function computeWpm(stats, nowMs) {
  pruneRecentPresses(stats, nowMs);
  return Math.round(stats.recent.length / CHARS_PER_WORD * (60000 / WPM_WINDOW_MS));
}

// Heat-Stufe 0 (nie gedrückt) bis HEAT_LEVELS (häufigste Taste)
function heatLevel(count, maxCount) {
  if (!count || !maxCount) return 0;
  return Math.max(1, Math.ceil(count / maxCount * HEAT_LEVELS));
}

function maxKeyCount(stats, layer = null) {
  let max = 0;
  for (const n of Object.values(heatmapCounts(stats, layer))) if (n > max) max = n;
  return max;
}

// =============================================================================
// Layout-Diff vor dem Sync (lokale Belegung gegen GET_CONFIG des Geräts)
// =============================================================================
// GET_CONFIG liefert Ebenen-Namen, Tasten (Tap, Halten, Doppel-Tipp), Combos, Tastenpaare und Makros.
// Firmware vor Stand 5 sendet die drei Listen nicht (Zustand "absent"); fehlt oder bricht eine Zeile (Zustand
// "incomplete"), vergleicht der Diff sie ebenfalls nicht. Die Listen kommen in kurzen Blöcken mit Offset.

function createDeviceSnapshot() {
  return {
    names: null, tap: [], hold: [], dtap: [],
    counts: { combos: null, pairs: null, macros: null, overrides: null }, combos: [], pairs: [], macros: [], overrides: [], macroLens: [], listsBroken: false
  };
}

const COMBO_BEHAVIOR_CODES = { KEY_PRESS: 0, MODIFIER_HOLD: 1, LAYER_TOGGLE: 2 };

const LIST_COUNT_MAX = { "COMBO_COUNT:": MAX_COMBOS, "PAIR_COUNT:": MAX_KEY_PAIRS, "MACRO_COUNT:": MAX_MACROS, "OVERRIDE_COUNT:": MAX_KEY_OVERRIDES };
const LIST_DATA_PREFIXES = ["COMBO_DATA:", "PAIR_DATA:", "MACRO_DATA:", "OVERRIDE_DATA:"];

// Übernimmt eine Zeile ..._COUNT: oder ..._DATA: in den Snapshot. Gibt true zurück, wenn die Zeile eine dieser
// Arten ist (auch bei ungültigem Inhalt: verbraucht, der Snapshot gilt dann als unvollständig).
function captureListLine(snapshot, line) {
  const prefix = line.substring(0, line.indexOf(":") + 1);
  if (!LIST_COUNT_MAX[prefix] && !LIST_DATA_PREFIXES.includes(prefix)) return false;
  const body = line.substring(prefix.length);
  const nums = (a, n, ok) => Array.isArray(a) && a.length === n && a.every(v => Number.isInteger(v) && v >= 0 && v <= 0xFFFF) && (!ok || ok(a));
  const fail = () => { snapshot.listsBroken = true; return true; };
  try {
    if (LIST_COUNT_MAX[prefix] !== undefined) {
      const n = /^\d{1,3}$/.test(body) ? Number(body) : -1;
      if (n < 0 || n > LIST_COUNT_MAX[prefix]) return fail();
      const kind = { "COMBO_COUNT:": "combos", "PAIR_COUNT:": "pairs", "MACRO_COUNT:": "macros", "OVERRIDE_COUNT:": "overrides" }[prefix];
      snapshot.counts[kind] = n;
      snapshot[kind] = [];
      if (kind === "macros") snapshot.macroLens = [];
      return true;
    }
    const data = JSON.parse(body);
    if (!data || typeof data !== "object") return fail();
    if (prefix === "MACRO_DATA:") {
      const count = snapshot.counts.macros;
      if (count === null || !isValidIndex(data.i, count) || !Number.isInteger(data.n) || data.n < 0 || data.n > MAX_MACRO_STEPS ||
          !Array.isArray(data.s) || !data.s.every(e => nums(e, 3, t => t[0] >= 1 && t[0] <= 4))) return fail();
      if (snapshot.macroLens[data.i] === undefined) { snapshot.macroLens[data.i] = data.n; snapshot.macros[data.i] = []; }
      const steps = snapshot.macros[data.i];
      if (snapshot.macroLens[data.i] !== data.n || data.o !== steps.length || steps.length + data.s.length > data.n) return fail();
      steps.push(...data.s);
      return true;
    }
    const isCombo = prefix === "COMBO_DATA:";
    const isOverride = prefix === "OVERRIDE_DATA:";
    const kind = isCombo ? "combos" : isOverride ? "overrides" : "pairs";
    const count = snapshot.counts[kind];
    const list = snapshot[kind];
    if (count === null || data.o !== list.length || !Array.isArray(data.e) || list.length + data.e.length > count ||
        !data.e.every(e => isCombo ? nums(e, 6, t => t[4] <= 2) : isOverride ? nums(e, 3, t => t[0] >= 1 && t[0] <= 15) : nums(e, 2))) return fail();
    list.push(...data.e);
  } catch (_) { return fail(); }
  return true;
}

// "absent": das Gerät sendet keine Listen (Firmware vor Stand 5). "complete": alle Listen vollständig gelesen.
// "incomplete": Listen begonnen, aber eine Zeile fehlt oder war ungültig.
function snapshotListsState(snapshot) {
  if (!snapshot) return "absent";
  const c = snapshot.counts;
  const none = c.combos === null && c.pairs === null && c.macros === null && c.overrides === null;
  if (none && !snapshot.listsBroken) return "absent";
  if (snapshot.listsBroken || c.combos === null || c.pairs === null || c.macros === null) return "incomplete";
  if (snapshot.combos.length !== c.combos || snapshot.pairs.length !== c.pairs) return "incomplete";
  // Die Überschreibungen sendet nur der Master ab Stand 7: ohne Zähler gibt es nichts zu vergleichen,
  // ein begonnener Block muss vollständig sein
  if (c.overrides !== null && snapshot.overrides.length !== c.overrides) return "incomplete";
  for (let i = 0; i < c.macros; i++) {
    if (snapshot.macroLens[i] === undefined || snapshot.macros[i].length !== snapshot.macroLens[i]) return "incomplete";
  }
  return "complete";
}

function snapshotListsKnown(snapshot) {
  return snapshotListsState(snapshot) === "complete";
}

// Lokale Listen als Zahlen-Tupel, so wie die Firmware sie sendet
function localComboTuples(cfg) {
  return (cfg.combos || []).slice(0, MAX_COMBOS).map(cb => [cb.key1.r, cb.key1.c, cb.key2.r, cb.key2.c,
    COMBO_BEHAVIOR_CODES[cb.behavior] ?? 0, actionCodeToNumeric(cb.action)]);
}

function localPairTuples(cfg) {
  return (cfg.keyPairs || []).slice(0, MAX_KEY_PAIRS).map(p => [actionCodeToNumeric(p.first), actionCodeToNumeric(p.second)]);
}

function localOverrideTuples(cfg) {
  return (cfg.keyOverrides || []).slice(0, MAX_KEY_OVERRIDES).map(o => [keyOverrideModsValue(o.mods), actionCodeToNumeric(o.key), actionCodeToNumeric(o.replacement)]);
}

function localMacroSteps(cfg) {
  return (cfg.macros || []).slice(0, MAX_MACROS).map(m => m.steps.map(st => st.type === "pause"
    ? [MACRO_STEP_TYPES.pause, 0, st.ms]
    : [MACRO_STEP_TYPES[st.type], actionCodeToNumeric(st.code), 0]));
}

const MACRO_STEP_NAMES = { 1: "Tippen", 2: "Drücken", 3: "Loslassen", 4: "Pause" };

function describeComboTuple(t) {
  const behavior = ["", " (Modifier halten)", " (Ebene umschalten)"][t[4]] || "";
  return `R${t[0]}C${t[1]} + R${t[2]}C${t[3]} → ${findDefinitionByCode(t[5]).label}${behavior}`;
}

function describePairTuple(t) {
  return `${findDefinitionByCode(t[0]).label} + ${findDefinitionByCode(t[1]).label}`;
}

function describeOverrideTuple(t) {
  const mods = Object.keys(KEY_OVERRIDE_MODS).filter(m => t[0] & KEY_OVERRIDE_MODS[m]).map(m => KEY_OVERRIDE_MOD_LABELS[m]).join(" + ");
  return `${mods} + ${findDefinitionByCode(t[1]).label} → ${findDefinitionByCode(t[2]).label}`;
}

function describeMacroSteps(steps) {
  if (!steps) return "—";
  if (steps.length === 0) return "leer";
  return steps.map(st => st[0] === 4 ? `Pause ${st[2]} ms` : `${MACRO_STEP_NAMES[st[0]] || "?"} ${findDefinitionByCode(st[1]).label}`).join(", ");
}

// Speichert eine Matrix aus GET_CONFIG als Zahlencodes. Gibt true zurück, wenn übernommen.
function captureMatrixData(snapshot, field, data) {
  if (!snapshot || !["tap", "hold", "dtap"].includes(field)) return false;
  if (!data || !isValidIndex(data.l, NUM_LAYERS) || !Array.isArray(data.k)) return false;
  const matrix = [];
  for (let r = 0; r < NUM_ROWS; r++) {
    const row = Array.isArray(data.k[r]) ? data.k[r] : [];
    matrix.push([]);
    for (let c = 0; c < NUM_COLS; c++) {
      const code = row[c];
      matrix[r].push(Number.isInteger(code) && code >= 0 && code <= 0xFFFF ? code : 0);
    }
  }
  snapshot[field][data.l] = matrix;
  return true;
}

function isDeviceSnapshotComplete(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.names)) return false;
  for (let l = 0; l < NUM_LAYERS; l++) {
    if (!snapshot.tap[l] || !snapshot.hold[l] || !snapshot.dtap[l]) return false;
  }
  return true;
}

// Gleiche Regel wie keyToNumericActions: Halten ohne Tap wirkt als Tap, Doppel-Tipp braucht einen Tap
function normalizeDeviceActions(tapCode, holdCode, dtapCode) {
  if (!tapCode) return { tapCode: holdCode || 0, holdCode: 0, dtapCode: 0 };
  return { tapCode, holdCode: holdCode || 0, dtapCode: dtapCode || 0 };
}

// Unterschiede pro physischer Taste und pro Ebenen-Name. device/local = { tapCode, holdCode, dtapCode }.
function diffKeymap(cfg, snapshot, profile) {
  const keys = [];
  const names = [];
  for (let l = 0; l < NUM_LAYERS; l++) {
    const layer = (cfg.layers && cfg.layers[l]) || [];
    for (let r = 0; r < NUM_ROWS; r++) {
      for (let c = 0; c < NUM_COLS; c++) {
        if (!isPhysicalKey(r, c, profile)) continue;
        const local = keyToNumericActions((layer[r] || [])[c]);
        const device = normalizeDeviceActions(snapshot.tap[l][r][c], snapshot.hold[l][r][c], snapshot.dtap[l][r][c]);
        if (local.tapCode !== device.tapCode || local.holdCode !== device.holdCode || local.dtapCode !== device.dtapCode) {
          keys.push({ l, r, c, device, local });
        }
      }
    }
    const localName = sanitizeCommandText(cfg.layerNames && cfg.layerNames[l], DEFAULT_LAYER_NAMES[l]);
    const deviceName = sanitizeCommandText(snapshot.names[l], DEFAULT_LAYER_NAMES[l]);
    if (localName !== deviceName) names.push({ l, device: deviceName, local: localName });
  }
  return { keys, names, lists: diffLists(cfg, snapshot) };
}

// Unterschiede bei Combos, Tastenpaaren und Makros, jeweils je Index in der Reihenfolge der Liste (die Firmware
// prüft Combos in dieser Reihenfolge). Zeilen { where, device, local }. state = "absent" oder "incomplete":
// nichts wird verglichen.
function diffLists(cfg, snapshot) {
  const state = snapshotListsState(snapshot);
  const out = { known: state === "complete", state, combos: [], pairs: [], overrides: [], macros: [] };
  if (!out.known) return out;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const compare = (target, label, device, local, describe) => {
    for (let i = 0; i < Math.max(device.length, local.length); i++) {
      if (!same(device[i], local[i])) {
        target.push({ where: `${label} ${i}`, device: device[i] ? describe(device[i]) : "—", local: local[i] ? describe(local[i]) : "—" });
      }
    }
  };
  compare(out.combos, "Combo", snapshot.combos, localComboTuples(cfg), describeComboTuple);
  compare(out.pairs, "Paar", snapshot.pairs, localPairTuples(cfg), describePairTuple);
  // Nur wenn das Gerät Überschreibungen meldet (Master ab Stand 7); sonst gibt es nichts zu vergleichen
  if (snapshot.counts.overrides !== null) compare(out.overrides, "Überschreibung", snapshot.overrides, localOverrideTuples(cfg), describeOverrideTuple);
  const deviceMacros = Array.from({ length: snapshot.counts.macros }, (_, i) => snapshot.macros[i]);
  compare(out.macros, "Makro", deviceMacros, localMacroSteps(cfg), describeMacroSteps);
  return out;
}

// Kurztext einer Tastenbelegung, z. B. "A · Halten: LEFT_CTRL · 2×: B"
function describeKeyActions(actions) {
  if (!actions.tapCode) return "—";
  let text = findDefinitionByCode(actions.tapCode).label;
  if (actions.holdCode) text += ` · Halten: ${findDefinitionByCode(actions.holdCode).label}`;
  if (actions.dtapCode) text += ` · 2×: ${findDefinitionByCode(actions.dtapCode).label}`;
  return text;
}

// =============================================================================
// Layout-Profile: benannte Kopien der Config einer Hälfte (/api/profiles?side=L|R)
// =============================================================================
const MAX_LAYOUT_PROFILES = 32;

// Namen ohne Groß-/Kleinschreibung vergleichen wie str.casefold() in server.py: toUpperCase faltet "ß" zu
// "SS", toLowerCase danach gleicht die übrigen Fälle an ("Straße" = "STRASSE"). Zeichenweise, damit kein
// Kontext (End-Sigma) mitspielt. Zwei Zeichen weichen sonst ab: "ẞ" bleibt bei toUpperCase stehen (casefold:
// "ss"), und "ı" würde zu "i" (casefold lässt es stehen).
function layoutProfileNameKey(name) {
  return Array.from(String(name), ch => {
    if (ch === "ẞ") return "ss";
    if (ch === "ı") return ch;
    return ch.toUpperCase().toLowerCase();
  }).join("");
}

function findLayoutProfileIndex(profiles, name) {
  const key = layoutProfileNameKey(name);
  return profiles.findIndex(p => layoutProfileNameKey(p.name) === key);
}

// Wie sanitize_name in server.py: nur druckbare Zeichen (str.isprintable), ohne Quotes und Backslashes,
// höchstens 31 Code Points. Erst kürzen, dann trimmen: so bleibt kein Leerzeichen am Ende, und der Server
// erhält den Namen unverändert. Sonst lehnt er die ganze Liste ab.
function sanitizeLayoutProfileName(value) {
  const printable = String(value ?? "").replace(/[\p{C}\p{Zl}\p{Zp}"\\]|(?! )\p{Zs}/gu, "").trim();
  return Array.from(printable).slice(0, MAX_NAME_LENGTH).join("").trim();
}

// Neue Liste mit dem gespeicherten Profil; ein gleichnamiges Profil wird an seiner Stelle ersetzt.
// Rückgabe { profiles, replaced }. Ohne Namen oder bei voller Liste: Fehler.
function upsertLayoutProfile(profiles, name, config, savedAt) {
  const clean = sanitizeLayoutProfileName(name);
  if (!clean) throw new Error("Profilname fehlt.");
  const entry = { name: clean, savedAt, config: JSON.parse(JSON.stringify(config)) };
  const idx = findLayoutProfileIndex(profiles, clean);
  if (idx >= 0) return { profiles: profiles.map((p, i) => i === idx ? entry : p), replaced: true };
  if (profiles.length >= MAX_LAYOUT_PROFILES) throw new Error(`Maximal ${MAX_LAYOUT_PROFILES} Profile pro Hälfte.`);
  return { profiles: [...profiles, entry], replaced: false };
}

function removeLayoutProfile(profiles, name) {
  const idx = findLayoutProfileIndex(profiles, name);
  return idx < 0 ? profiles : profiles.filter((_, i) => i !== idx);
}

// =============================================================================
// Layout-Prüfung (DOM-frei): Belegungen ohne Wirkung, Ebenen ohne Weg hinein oder hinaus
// =============================================================================

// Tap, Halten und Doppel-Tipp einer Zelle; "NONE" steht für keine Aktion (auch "", "0" und fehlende Werte)
function lintCellActions(cell) {
  const norm = v => (typeof v === "string" && v !== "" && v !== "0") ? v : "NONE";
  if (typeof cell === "string") return { tap: norm(cell), hold: "NONE", dtap: "NONE" };
  const c = cell && typeof cell === "object" ? cell : {};
  return { tap: norm(c.tap), hold: norm(c.hold), dtap: norm(c.dtap) };
}

function lintHasAction(a) {
  return a.tap !== "NONE" || a.hold !== "NONE" || a.dtap !== "NONE";
}

function lintCellAt(cfg, layer, r, c) {
  const row = cfg.layers && cfg.layers[layer] && cfg.layers[layer][r];
  return lintCellActions(row && row[c]);
}

// Tap, Halten und Doppel-Tipp einer Taste auf der aktiven Ebene. Wie resolveKeyActions in der Firmware:
// eine Taste ohne jede Aktion fällt auf Ebene 0 zurück, eine Halte-Aktion ohne Tap wirkt wie ein Tap,
// ein Doppel-Tipp ohne Tap bleibt ohne Wirkung.
function lintResolvedCell(cfg, layer, r, c) {
  let a = lintCellAt(cfg, layer, r, c);
  if (layer > 0 && !lintHasAction(a)) a = lintCellAt(cfg, 0, r, c);
  if (a.tap === "NONE") return { tap: a.hold, hold: "NONE", dtap: "NONE" };
  return a;
}

// Alle Aktionen, die diese aufgelöste Taste auslösen kann
function lintEffectiveActions(cfg, layer, r, c) {
  const a = lintResolvedCell(cfg, layer, r, c);
  return [a.tap, a.hold, a.dtap].filter(x => x !== "NONE");
}

// MO_n / TG_n / LAYER_UP / LAYER_DOWN (auch als Firmware-Name ACT_...); sonst null
function lintLayerAction(code) {
  const name = String(code || "").replace(/^ACT_/, "");
  const m = /^(MO|TG)_([0-7])$/.exec(name);
  if (m) return { kind: m[1], layer: Number(m[2]) };
  if (name === "LAYER_UP" || name === "LAYER_DOWN") return { kind: name };
  return null;
}

// Eine Combo kann nur auslösen, wenn beide Tasten an der Hälfte existieren
function lintComboCanFire(cb, profile) {
  return !!cb && typeof cb === "object" && !!cb.key1 && !!cb.key2 &&
    isWiredSwitch(cb.key1.r, cb.key1.c, profile) && isWiredSwitch(cb.key2.r, cb.key2.c, profile);
}

function lintLayerName(layers) {
  return (layers.length === 1 ? "Ebene " : "Ebenen ") + layers.join(", ");
}

function lintOnLayers(layers) {
  return layers.length === NUM_LAYERS ? "auf allen Ebenen" : "auf " + lintLayerName(layers);
}

// Eine Ebene hat eigene Belegung, wenn eine vorhandene Taste dort etwas anderes tut als auf Ebene 0
function lintLayerHasOwnContent(cfg, profile, layer) {
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      if (!isWiredSwitch(r, c, profile)) continue;
      const own = lintCellAt(cfg, layer, r, c);
      if (!lintHasAction(own)) continue;
      const base = lintCellAt(cfg, 0, r, c);
      if (own.tap !== base.tap || own.hold !== base.hold || own.dtap !== base.dtap) return true;
    }
  }
  return false;
}

// Entfernt die Aktionen einer Taste, die es an der Hälfte nicht gibt, auf den genannten Ebenen (Knopf "Entfernen"
// in der Layout-Prüfung). Ändert cfg nicht. Rückgabe { layers: neue Ebenen, old: [{ l, cell }] mit den alten Zellen
// für das Rückgängig } oder null, wenn die Position doch existiert oder ungültig ist (kein Löschen einer echten Taste).
function clearAbsentKeyActions(cfg, profile, r, c, layerList) {
  if (!cfg || !Array.isArray(cfg.layers) || !isValidIndex(r, NUM_ROWS) || !isValidIndex(c, NUM_COLS)) return null;
  if (isWiredSwitch(r, c, profile) || !Array.isArray(layerList)) return null;
  const layers = JSON.parse(JSON.stringify(cfg.layers));
  const old = [];
  for (const l of layerList) {
    if (!isValidIndex(l, layers.length) || !Array.isArray(layers[l]) || !Array.isArray(layers[l][r])) continue;
    const cell = layers[l][r][c];
    if (!lintHasAction(lintCellActions(cell))) continue;
    old.push({ l, cell: JSON.parse(JSON.stringify(cell)) });
    layers[l][r][c] = { label: "---", tap: "NONE", hold: "NONE", dtap: "NONE" };
  }
  return old.length ? { layers, old } : null;
}

// Prüft die Konfigurationen beider Hälften gemeinsam, weil sie die aktive Ebene teilen (Layer-Abgleich).
// configs: { [side]: config }, profiles: SIDE_PROFILES, labelFor: Anzeigename eines Tastencodes (für Tastenpaare).
// Rückgabe: Liste { level: "warn" | "info", side: Hälfte oder null (beide), code, message }, Warnungen zuerst.
// Die Prüfung ändert nichts und blockiert nichts.
function lintLayouts(configs, profiles, labelFor = code => code) {
  const out = [];
  // extra: Zusatzfelder des Befunds (z. B. Position und Ebenen für den Knopf "Entfernen")
  const add = (level, side, code, message, extra) => out.push({ level, side, code, message, ...extra });
  const sides = Object.keys(configs || {}).filter(s => configs[s] && profiles && profiles[s]);

  // 1. Aktion auf einer Taste, die es an der Hälfte nicht gibt (auch außerhalb der Matrix, z. B. R2C6)
  for (const side of sides) {
    const found = new Map();
    for (let l = 0; l < NUM_LAYERS; l++) {
      for (let r = 0; r < NUM_ROWS; r++) {
        for (let c = 0; c < NUM_COLS; c++) {
          if (isWiredSwitch(r, c, profiles[side]) || !lintHasAction(lintCellAt(configs[side], l, r, c))) continue;
          const id = `R${r}C${c}`;
          if (!found.has(id)) found.set(id, { r, c, layers: [] });
          found.get(id).layers.push(l);
        }
      }
    }
    for (const [id, { r, c, layers }] of found) {
      // r, c und layers gehören zum Knopf "Entfernen" (clearAbsentKeyActions)
      add("warn", side, "absent-key-action",
        `Taste ${id} hat ${lintOnLayers(layers)} eine Aktion, aber diese Taste gibt es nicht. Die Aktion hat keine Wirkung.`,
        { r, c, layers });
    }
  }

  // 2. Ebenen-Graph: Ebenen-Aktionen je Ebene (beide Hälften), Einrast-Combos (Verhalten "Layer umschalten")
  const onLayer = Array.from({ length: NUM_LAYERS }, () => []);
  for (const side of sides) {
    for (let l = 0; l < NUM_LAYERS; l++) {
      for (let r = 0; r < NUM_ROWS; r++) {
        for (let c = 0; c < NUM_COLS; c++) {
          if (!isWiredSwitch(r, c, profiles[side])) continue;
          for (const code of lintEffectiveActions(configs[side], l, r, c)) {
            const a = lintLayerAction(code);
            if (a) onLayer[l].push(a);
          }
        }
      }
    }
  }
  // Wie die Firmware: Ebene = Aktionscode & 7 (0 löscht alle eingerasteten Ebenen). Combos gelten auf jeder Ebene.
  const comboToggles = new Set();
  for (const side of sides) {
    for (const cb of Array.isArray(configs[side].combos) ? configs[side].combos : []) {
      // Eine Combo auf einer fehlenden Taste löst nie aus und ist kein Weg; ein Nicht-String als Aktion (Import) auch nicht
      if (cb && cb.behavior === "LAYER_TOGGLE" && typeof cb.action === "string" && lintComboCanFire(cb, profiles[side])) {
        // Auch die Firmware-Schreibweise ACT_TG_n (wie bei den Tasten); actionCodeToNumeric kennt sie nicht
        const toggle = lintLayerAction(cb.action);
        comboToggles.add(toggle && toggle.layer !== undefined ? toggle.layer : actionCodeToNumeric(cb.action) & 7);
      }
    }
  }
  // Erreichbare Ebenen mit den Tri-Layer-Regeln aus triRules (jede Regel gilt nur auf der Hälfte, die sie hält)
  const computeReach = triRules => {
    const reach = new Set([0]);
    const lock = new Set();   // Ebenen, die sich einrasten lassen (TG, LAYER_UP/DOWN, Combo)
    for (const n of comboToggles) {
      if (n > 0) { reach.add(n); lock.add(n); }
    }
    for (let grew = true; grew;) {
      grew = false;
      for (const l of [...reach]) {
        for (const a of onLayer[l]) {
          let target = -1;
          let locks = false;
          if (a.kind === "MO") target = a.layer;
          else if (a.kind === "TG") { target = a.layer; locks = true; }
          else if (a.kind === "LAYER_UP") { target = (l + 1) % NUM_LAYERS; locks = true; }
          else if (a.kind === "LAYER_DOWN") { target = (l + NUM_LAYERS - 1) % NUM_LAYERS; locks = true; }
          if (target < 0) continue;
          if (locks && target > 0) lock.add(target);
          if (!reach.has(target)) { reach.add(target); grew = true; }
        }
      }
      // Tri-Layer: das Ziel ist erreichbar, sobald a und b erreichbar sind (a und b dürfen auf verschiedenen Hälften liegen)
      for (const { a, b, target } of triRules) {
        if (reach.has(a) && reach.has(b) && !reach.has(target)) { reach.add(target); grew = true; }
      }
    }
    return { reach, lock };
  };
  const triOf = side => normalizeTriLayers(configs[side].settings && configs[side].settings.triLayers);
  const { reach: reachable, lock: lockable } = computeReach(sides.flatMap(triOf));
  // Die Firmware wertet nur die Regeln der eigenen Hälfte aus: eine Ebene mit Belegung auf einer Hälfte
  // braucht dort einen Weg hinein
  const reachableOn = new Map(sides.map(side => [side, computeReach(triOf(side)).reach]));

  const unreachable = [];
  for (let n = 1; n < NUM_LAYERS; n++) {
    if (!reachable.has(n) && sides.some(s => lintLayerHasOwnContent(configs[s], profiles[s], n))) unreachable.push(n);
  }
  // Tri-Layer-Ziel mit Belegung auf einer Hälfte, die die Regel nicht hält: dort wird das Ziel nie aktiv
  for (const side of sides) {
    const missing = [...new Set(sides.flatMap(triOf).map(r => r.target))]
      .filter(n => reachable.has(n) && !reachableOn.get(side).has(n) && lintLayerHasOwnContent(configs[side], profiles[side], n))
      .sort((a, b) => a - b);
    if (missing.length) {
      add("warn", side, "tri-layer-other-half",
        `${lintLayerName(missing)} wird nur durch eine Tri-Layer-Regel der anderen Hälfte erreicht. Setze dieselbe Regel auch an dieser Hälfte.`);
    }
  }
  if (unreachable.length) {
    add("warn", null, "layer-unreachable",
      `${lintLayerName(unreachable)} ${unreachable.length === 1 ? "hat" : "haben"} eigene Belegung, aber keine Taste und keine Combo führt dorthin.`);
  }

  // Einrastbare Ebene ohne Rückweg: TG der Ebene oder TG_0, LAYER_UP/DOWN auf der Ebene oder eine Einrast-Combo
  const trapped = [...lockable].sort((a, b) => a - b).filter(n =>
    !comboToggles.has(n) && !comboToggles.has(0) &&
    !onLayer[n].some(a => (a.kind === "TG" && (a.layer === n || a.layer === 0)) || a.kind === "LAYER_UP" || a.kind === "LAYER_DOWN"));
  if (trapped.length) {
    add("warn", null, "layer-trap",
      `${lintLayerName(trapped)} ${trapped.length === 1 ? "lässt" : "lassen"} sich einrasten, aber dort gibt es keine Taste zurück ` +
      "(TG der Ebene, TG_0, LAYER_UP, LAYER_DOWN oder eine Combo \"Layer umschalten\").");
  }

  // 3. Je Hälfte: ungenutzte Tastenpaare und Makros, doppelte Combos, Combo-Tasten mit Halte- oder Doppel-Tipp-Aktion
  for (const side of sides) {
    const cfg = configs[side];
    const combos = Array.isArray(cfg.combos) ? cfg.combos : [];
    (Array.isArray(cfg.keyPairs) ? cfg.keyPairs : []).forEach((pair, i) => {
      if (isKeyPairUsed(cfg.layers, i) || combos.some(cb => cb && cb.action === `PAIR_${i}`)) return;
      add("info", side, "pair-unused", `Tastenpaar ${i} (${keyPairLabel(pair, labelFor)}) wird nirgends verwendet.`);
    });
    (Array.isArray(cfg.macros) ? cfg.macros : []).forEach((macro, i) => {
      if (isMacroUsed(cfg.layers, i)) return;
      const name = macro && typeof macro.name === "string" && macro.name ? macro.name : "ohne Name";
      add("info", side, "macro-unused", `Makro ${i} (${name}) wird nirgends verwendet.`);
    });
    const seen = new Map();
    combos.forEach((cb, i) => {
      // Nur Combos, die auslösen können: Koordinaten als Text ("2") oder fehlende Tasten sind keine Dopplung
      if (!lintComboCanFire(cb, profiles[side])) return;
      const ids = [`${cb.key1.r}_${cb.key1.c}`, `${cb.key2.r}_${cb.key2.c}`].sort().join("|");
      if (seen.has(ids)) {
        add("warn", side, "combo-duplicate", `Combo ${seen.get(ids) + 1} und Combo ${i + 1} nutzen dieselben zwei Tasten. Beide lösen gleichzeitig aus.`);
      } else {
        seen.set(ids, i);
      }
    });
    combos.forEach((cb, i) => {
      // Eine Taste, die es an der Hälfte nicht gibt, meldet schon "absent-key-action"; die Combo löst nie aus
      if (!lintComboCanFire(cb, profiles[side])) return;
      for (const key of [cb.key1, cb.key2]) {
        const layers = [];
        for (let l = 0; l < NUM_LAYERS; l++) {
          // Mit dem Rückfall auf Ebene 0 wie die Firmware: eine transparente Taste erbt dort Halten und Doppel-Tipp
          const a = lintResolvedCell(cfg, l, key.r, key.c);
          if (a.tap !== "NONE" && (a.hold !== "NONE" || a.dtap !== "NONE")) layers.push(l);
        }
        if (layers.length) {
          add("info", side, "combo-hold-cancelled",
            `Taste R${key.r}C${key.c} ist Teil von Combo ${i + 1} und hat ${lintOnLayers(layers)} eine Halte- oder Doppel-Tipp-Aktion. ` +
            "Löst die Combo aus, bricht sie diese Aktion ab.");
        }
      }
    });
  }

  return [...out.filter(f => f.level === "warn"), ...out.filter(f => f.level !== "warn")];
}

// =============================================================================
// Ebenen-Übersicht (DOM-frei): 8 Ebenen nebeneinander mit Transparenz & Konflikten
// =============================================================================

function buildLayerOverview(cfg, profile) {
  cfg = (cfg && typeof cfg === "object") ? cfg : {};
  profile = profile || (typeof Dactyl !== "undefined" && Dactyl.SIDE_PROFILES ? Dactyl.SIDE_PROFILES[Dactyl.getMasterSide()] : null);
  const layers = (cfg && Array.isArray(cfg.layers)) ? cfg.layers : [];
  const layerNames = (cfg && Array.isArray(cfg.layerNames)) ? cfg.layerNames : DEFAULT_LAYER_NAMES;
  const result = [];

  // Layer-0-Trigger (z.B. MO_1, MO_2...) ermitteln für verdeckte Tasten (trigger-shadowed)
  const layer0Triggers = new Map();
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      if (!isPhysicalKey(r, c, profile)) continue;
      const c0 = lintCellAt(cfg, 0, r, c);
      for (const act of [c0.tap, c0.hold]) {
        const la = lintLayerAction(act);
        if (la && la.kind === "MO" && isValidIndex(la.layer, NUM_LAYERS) && la.layer > 0) {
          layer0Triggers.set(`${r}_${c}`, la.layer);
        }
      }
    }
  }

  for (let l = 0; l < NUM_LAYERS; l++) {
    const name = sanitizeCommandText(layerNames[l], DEFAULT_LAYER_NAMES[l] || `Layer ${l}`);
    const rows = [];
    let transparentCount = 0;
    let ownCount = 0;
    let conflictCount = 0;

    const cellEntries = [];

    const inspectKey = (r, c, isThumb) => {
      const exists = isPhysicalKey(r, c, profile);
      if (!exists) {
        return {
          r, c, isThumb, exists: false, transparent: false, empty: true,
          hasOwn: false, conflict: false, conflictReason: "", label: "",
          tap: "NONE", hold: "NONE", dtap: "NONE", inheritedLabel: ""
        };
      }
      const own = lintCellAt(cfg, l, r, c);
      const hasOwn = lintHasAction(own);
      const base = lintCellAt(cfg, 0, r, c);
      const baseHas = lintHasAction(base);
      const rawCell = (layers[l] && layers[l][r] && layers[l][r][c]) || {};
      const baseRawCell = (layers[0] && layers[0][r] && layers[0][r][c]) || {};

      const ownLabel = typeof rawCell.label === "string" && rawCell.label ? rawCell.label : (own.tap !== "NONE" ? own.tap.replace(/^KEY_/, "") : "");
      const baseLabel = typeof baseRawCell.label === "string" && baseRawCell.label ? baseRawCell.label : (base.tap !== "NONE" ? base.tap.replace(/^KEY_/, "") : "");

      let transparent = false;
      let label = ownLabel;
      let inheritedLabel = "";

      if (l === 0) {
        transparent = false;
        label = ownLabel || (hasOwn ? (own.tap !== "NONE" ? own.tap.replace(/^KEY_/, "") : "•") : "---");
        if (hasOwn) ownCount++;
      } else {
        if (!hasOwn) {
          transparent = true;
          transparentCount++;
          inheritedLabel = baseLabel || (baseHas ? (base.tap !== "NONE" ? base.tap.replace(/^KEY_/, "") : "•") : "---");
          label = inheritedLabel;
        } else {
          ownCount++;
        }
      }

      const item = {
        r, c, isThumb, exists: true,
        transparent,
        empty: !hasOwn && (!transparent || !baseHas),
        hasOwn,
        label,
        ownLabel,
        inheritedLabel,
        tap: own.tap,
        hold: own.hold,
        dtap: own.dtap,
        conflict: false,
        conflictReason: ""
      };
      cellEntries.push(item);
      return item;
    };

    // Finger-Matrix 5x6
    for (let r = 0; r < FINGER_NAV_ROWS; r++) {
      const row = [];
      for (let c = 0; c < FINGER_NAV_COLS; c++) {
        row.push(inspectKey(r, c, false));
      }
      rows.push(row);
    }

    // Daumen-Cluster
    const thumbDefs = (profile && Array.isArray(profile.thumbDefs)) ? profile.thumbDefs : [];
    const thumbs = thumbDefs.map(def => inspectKey(def.r, def.c, true));

    // Konflikte prüfen
    // 1. trigger-shadowed: Taste auf Ebene 0 schaltet per MO_l auf Ebene l, aber dieselbe Taste hat eigene Belegung auf l
    for (const item of cellEntries) {
      const trigTarget = layer0Triggers.get(`${item.r}_${item.c}`);
      if (trigTarget === l && item.hasOwn) {
        item.conflict = true;
        item.conflictReason = `Taste auf Ebene 0 schaltet per MO_${l} auf diese Ebene, verdeckt eigene Belegung auf Ebene ${l}.`;
        conflictCount++;
      }
    }

    // 2. duplicate-action: zwei oder mehr physische Tasten auf Ebene l haben denselben non-modifier tap-Code
    const tapMap = new Map();
    for (const item of cellEntries) {
      if (!item.hasOwn || item.tap === "NONE") continue;
      if (isModifierKeyCode(item.tap)) continue;
      if (!tapMap.has(item.tap)) tapMap.set(item.tap, []);
      tapMap.get(item.tap).push(item);
    }
    for (const [tapCode, items] of tapMap.entries()) {
      if (items.length > 1) {
        for (const item of items) {
          if (!item.conflict) conflictCount++;
          item.conflict = true;
          const def = findDefinitionByCode(actionCodeToNumeric(tapCode));
          const actName = def.label || tapCode;
          item.conflictReason = item.conflictReason
            ? `${item.conflictReason} Doppelte Belegung: ${actName}.`
            : `Doppelte Belegung auf Ebene ${l}: ${actName} (${items.length}× vergeben).`;
        }
      }
    }

    result.push({
      layer: l,
      name,
      rows,
      thumbs,
      transparentCount,
      ownCount,
      conflictCount
    });
  }

  return result;
}

// =============================================================================
// Spickzettel (DOM-frei): benutzte Ebenen beider Hälften mit Tipp-, Halte- und Doppel-Tipp-Beschriftung
// =============================================================================

// configs: { <Hälfte>: Config }, profiles: { <Hälfte>: Profil }, labelFor: Code -> Beschriftung,
// sideOrder: Reihenfolge der Hälften auf dem Blatt (Standard: Reihenfolge von configs).
// Eine Ebene ohne eigene Taste auf jeder Hälfte fehlt; Ebene 0 zählt wie jede andere.
// name: Ebenenname der ersten Hälfte in sideOrder (beide Hälften teilen die Ebene).
// Auf einer Ebene > 0 trägt eine Taste ohne eigene Aktion transparent: true und die Beschriftung von Ebene 0.
function buildLayerSheet(configs, profiles, labelFor, sideOrder) {
  const label = typeof labelFor === "function" ? labelFor : (code => code);
  const nice = code => (code && code !== "NONE") ? String(label(code)) : "";
  const sides = (Array.isArray(sideOrder) ? sideOrder : Object.keys(configs || {}))
    .filter(side => configs && configs[side] && profiles && profiles[side]);
  const overviews = {};
  for (const side of sides) overviews[side] = buildLayerOverview(configs[side], profiles[side]);

  const sheetKey = key => {
    if (!key.exists) return { r: key.r, c: key.c, isThumb: key.isThumb, exists: false, transparent: false, tap: "", hold: "", dtap: "" };
    if (key.transparent) {
      return { r: key.r, c: key.c, isThumb: key.isThumb, exists: true, transparent: true, tap: (key.inheritedLabel === "---" || key.inheritedLabel === "•") ? "" : key.inheritedLabel, hold: "", dtap: "" };
    }
    // Eigene Beschriftung der Taste gewinnt; sonst die Beschriftung des Codes wie bei Halten und Doppel-Tipp
    const custom = key.ownLabel && key.ownLabel !== String(key.tap).replace(/^KEY_/, "");
    return {
      r: key.r, c: key.c, isThumb: key.isThumb, exists: true, transparent: false,
      tap: custom ? key.ownLabel : nice(key.tap), hold: nice(key.hold), dtap: nice(key.dtap)
    };
  };

  const layers = [];
  for (let l = 0; l < NUM_LAYERS; l++) {
    const halves = [];
    let own = 0;
    for (const side of sides) {
      const data = overviews[side][l];
      own += data.ownCount;
      halves.push({ side, label: profiles[side].label, rows: data.rows.map(row => row.map(sheetKey)), thumbs: data.thumbs.map(sheetKey), ownCount: data.ownCount });
    }
    if (own === 0) continue;
    layers.push({ layer: l, name: overviews[sides[0]][l].name, halves });
  }
  return { sides, layers };
}
