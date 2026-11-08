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
// Namen der eigenen Hold-Tap-Varianten je Taste (Index = Wert von holdFlavor, 0 = Wert der Hälfte)
const HOLD_FLAVOR_LABELS = ["Wert der Hälfte", "Sofort bei zweiter Taste", "Permissive Hold", "Tap Preferred"];
const SETTINGS_RANGES = {
  debounceMs: [1, 50, 5],
  comboTimeoutMs: [10, 200, 40],
  tappingTermMs: [100, 500, 200],
  holdTapMode: [0, 2, 0],
  quickTapMs: [0, 500, 0],
  leaderTimeoutMs: [100, 5000, 1000],
  oneShotTimeoutMs: [0, 10000, 0],  // 0 = aus, sonst 500..10000 (kleinere Werte werden 500)
  layerTimeoutMs: [0, 60000, 0],    // 0 = aus, sonst 1000..60000 (kleinere Werte werden 1000)
  requirePriorIdleMs: [0, 500, 0],
  chordalHold: [0, 1, 0],
  retroTap: [0, 1, 0],
  numWordLayer: [0, 7, 1],
  bootLayer: [0, 7, 0],
  autoShift: [0, 4, 0],
  autoShiftMs: [50, 500, 175],
  capsLed: [0, 1, 0],
  standbyTimeoutMinutes: [0, 120, 5],
  sleepTimeoutMinutes: [0, 240, 60]
};
const COMBO_BEHAVIORS = ["KEY_PRESS", "MODIFIER_HOLD", "LAYER_TOGGLE"];
// Ebenenmaske einer Combo: Bit i = die Combo gilt auf Ebene i. Fehlt das Feld, gilt sie auf allen Ebenen.
const COMBO_ALL_LAYERS = 0xFF;
// Eigenes Zeitfenster einer Combo in ms; fehlt das Feld, gilt comboTimeoutMs. Dritte Taste: optionales Feld key3.
const COMBO_WINDOW_MIN = 10;
const COMBO_WINDOW_MAX = 500;
const COMBO_NO_KEY = 0xFF;

function isValidComboLayerMask(v) {
  return Number.isInteger(v) && v >= 1 && v <= COMBO_ALL_LAYERS;
}

// Maske einer Combo (fehlend oder ungültig = alle Ebenen)
function comboLayerMask(cb) {
  return cb && isValidComboLayerMask(cb.layerMask) ? cb.layerMask : COMBO_ALL_LAYERS;
}

function isValidComboWindow(v) {
  return Number.isInteger(v) && v >= COMBO_WINDOW_MIN && v <= COMBO_WINDOW_MAX;
}

// Eigenes Fenster einer Combo in ms (fehlend oder ungültig = 0, also comboTimeoutMs)
function comboWindowMs(cb) {
  return cb && isValidComboWindow(cb.windowMs) ? cb.windowMs : 0;
}

function isValidComboKey(key) {
  return !!key && typeof key === "object" && isValidIndex(key.r, NUM_ROWS) && isValidIndex(key.c, NUM_COLS);
}

// Dritte Taste der Combo (fehlend oder ungültig = keine)
function comboThirdKey(cb) {
  return cb && isValidComboKey(cb.key3) ? cb.key3 : null;
}

// Tasten der Combo als Liste: zwei oder drei
function comboKeys(cb) {
  const third = comboThirdKey(cb);
  return third ? [cb.key1, cb.key2, third] : [cb.key1, cb.key2];
}

// Ebenen der Maske als aufsteigende Liste, z. B. 0b101 -> [0, 2]
function comboMaskLayers(mask) {
  const out = [];
  for (let l = 0; l < NUM_LAYERS; l++) if ((mask >> l) & 1) out.push(l);
  return out;
}

// true, wenn die Combo auf der Ebene gilt
function comboAppliesOnLayer(cb, layer) {
  return ((comboLayerMask(cb) >> layer) & 1) === 1;
}

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

// Tapping-Term-Assistent: wertet MATRIX:-Ereignisse { r, c, pressed, t } einer Hälfte aus (Scan-Zeit t in ms, 32 Bit).
// Gültig ist nur ein vollständiges Paar Druck + Loslassen derselben Taste; ein Loslassen ohne Druck und ein Druck,
// auf den ohne Loslassen ein zweiter Druck folgt, zählen als unvollständig (incomplete) und fließen nirgends ein.
// Ein Druck ohne Loslassen am Ende der Aufnahme zählt ebenfalls als unvollständig. Überlappungen, Wiederholungen und
// Anschlagabstände brauchen je TIMING_MIN_PAIRS Werte, sonst fehlt die Einstellung.
const TIMING_MIN_HOLDS = 20;
const TIMING_MARGIN_MS = 30;
const TIMING_MIN_PAIRS = 10;          // Mindestzahl je Messgröße außer den Haltezeiten (sonst fehlt der Wert)
const TIMING_MAX_ROLL_MS = 300;       // eine länger gehaltene Taste (Shift) ist keine Überlappung beim Tippen
const TIMING_MAX_HOLD_MS = 500;    // längere Haltezeiten (Shift, Daumentasten, Pause) sind kein Tipp und werden verworfen
const TIMING_MAX_REPEAT_MS = 300;  // größere Abstände derselben Taste sind keine Doppelanschläge

// Perzentil mit linearer Interpolation; p in 0..1, leere Liste ergibt null
function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const pos = Math.min(1, Math.max(0, p)) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function computeTimingRecommendations(samples) {
  const holds = [];
  const rolls = [];
  const presses = [];
  const sameKeyGaps = [];
  let incomplete = 0;
  const open = new Map();
  const lastRelease = new Map();
  const lastHold = new Map();   // id -> { press, index } der zuletzt gezählten Haltezeit, für das Zusammenfassen von Prellen
  let prevT = null;
  let base = 0;
  let lastPress = null;
  for (const e of Array.isArray(samples) ? samples : []) {
    if (!e || !isValidIndex(e.r, NUM_ROWS) || !isValidIndex(e.c, NUM_COLS) || !Number.isInteger(e.t) || e.t < 0 || e.t > 0xFFFFFFFF) {
      incomplete++;
      continue;
    }
    // Zeit aufrollen (Überlauf von millis() nach 2^32 ms); ein Rücksprung (Neustart) trennt die Aufnahme
    if (prevT !== null) {
      const step = (e.t - prevT) >>> 0;
      if (step > 0x80000000) { incomplete += open.size; open.clear(); lastRelease.clear(); lastHold.clear(); lastPress = null; base = 0; prevT = null; }
      else base += step;
    }
    if (prevT === null) base = e.t;
    prevT = e.t;
    const t = base;
    const id = `${e.r}_${e.c}`;
    if (e.pressed === true || e.pressed === 1) {
      // Prellen: ein Druck höchstens MATRIX_BOUNCE_MS nach dem Loslassen setzt dieselbe Haltezeit fort
      const held = lastHold.get(id);
      if (held && lastRelease.get(id) !== undefined && t - lastRelease.get(id) <= MATRIX_BOUNCE_MS && holds.length === held.index + 1) {
        holds.pop();
        open.set(id, held.press);
        lastHold.delete(id);
        lastRelease.delete(id);
        continue;
      }
      if (open.has(id)) { incomplete++; open.delete(id); }
      if (lastPress !== null) presses.push(t - lastPress.t);
      for (const [oid, ot] of open) if (oid !== id && t - ot <= TIMING_MAX_ROLL_MS) rolls.push(t - ot);
      if (lastRelease.has(id) && t - lastRelease.get(id) <= TIMING_MAX_REPEAT_MS) sameKeyGaps.push(t - lastRelease.get(id));
      open.set(id, t);
      lastPress = { t };
    } else if (e.pressed === false || e.pressed === 0) {
      if (!open.has(id)) { incomplete++; continue; }
      const hold = t - open.get(id);
      open.delete(id);
      lastRelease.set(id, t);
      if (hold >= 0 && hold <= TIMING_MAX_HOLD_MS) { lastHold.set(id, { press: t - hold, index: holds.length }); holds.push(hold); } else incomplete++;
    } else {
      incomplete++;
    }
  }
  incomplete += open.size;
  const stats = {
    holds: holds.length, rolls: rolls.length, incomplete,
    holdP95: percentile(holds, 0.95),
    rollP5: rolls.length >= TIMING_MIN_PAIRS ? percentile(rolls, 0.05) : null,
    sameKeyP5: sameKeyGaps.length >= TIMING_MIN_PAIRS ? percentile(sameKeyGaps, 0.05) : null,
    pressGapP10: presses.length >= TIMING_MIN_PAIRS ? percentile(presses, 0.1) : null
  };
  if (holds.length < TIMING_MIN_HOLDS) return { enough: false, stats, settings: {} };
  const settings = { tappingTermMs: clampSetting("tappingTermMs", Math.round(stats.holdP95 + TIMING_MARGIN_MS)) };
  if (stats.rollP5 !== null) settings.comboTimeoutMs = clampSetting("comboTimeoutMs", Math.round(stats.rollP5 / 2));
  if (stats.sameKeyP5 !== null) settings.quickTapMs = clampSetting("quickTapMs", Math.round(stats.sameKeyP5));
  if (stats.pressGapP10 !== null) settings.requirePriorIdleMs = clampSetting("requirePriorIdleMs", Math.round(stats.pressGapP10));
  return { enough: true, stats, settings };
}

// Tastenaufnahme: ein Druck auf der Tastatur füllt den nächsten freien Platz eines Editors (Combo, Leader).
// Zustandsautomat ohne DOM. Dieselbe Taste meldet MATRIX:, KEY_PRESS und SPLIT_KEY; eine gehaltene Taste zählt darum
// nur einmal, bis ihr Loslassen kommt. Ein Druck der anderen Hälfte ändert nichts.
// Ein verlorenes Loslassen (Verbindungsabbruch) sperrt die Taste höchstens KEY_CAPTURE_HELD_MS.
const KEY_CAPTURE_HELD_MS = 1000;

function createKeyCapture() {
  return { active: false, side: null, max: 0, allowRepeat: false, resolve: null, slots: [], held: new Map() };
}

// side: bearbeitete Hälfte; max: Zahl der Plätze; allowRepeat: dieselbe Taste darf nach dem Loslassen nochmal
// (Leader-Folge); resolve(r, c): Wert für den Platz oder null, wenn die Taste hier nicht verwendbar ist
function keyCaptureStart(cap, { side, max, allowRepeat = false, resolve }) {
  cap.active = true;
  cap.side = side;
  cap.max = max;
  cap.allowRepeat = allowRepeat;
  cap.resolve = resolve;
  cap.slots = [];
  cap.held = new Map();
  return cap;
}

function keyCaptureStop(cap) {
  cap.active = false;
  cap.held = new Map();
  return cap;
}

// evt: { side, r, c, pressed, at }; at (ms) ist optional. Rückgabe { accepted, reason, index, value }; reason nennt den Grund einer Ablehnung.
function keyCaptureFeed(cap, evt) {
  if (!cap.active) return { accepted: false, reason: "inactive" };
  if (evt.side !== cap.side) return { accepted: false, reason: "wrong-side" };
  if (!isValidIndex(evt.r, NUM_ROWS) || !isValidIndex(evt.c, NUM_COLS)) return { accepted: false, reason: "invalid" };
  const id = `${evt.r},${evt.c}`;
  if (!evt.pressed) {
    cap.held.delete(id);
    return { accepted: false, reason: "release" };
  }
  const now = Number.isFinite(evt.at) ? evt.at : Date.now();
  if (cap.held.has(id) && now - cap.held.get(id) < KEY_CAPTURE_HELD_MS) return { accepted: false, reason: "held" };
  cap.held.set(id, now);
  if (!isPhysicalKey(evt.r, evt.c, SIDE_PROFILES[cap.side])) return { accepted: false, reason: "not-physical" };
  if (cap.slots.length >= cap.max) return { accepted: false, reason: "full" };
  if (!cap.allowRepeat && cap.slots.some(slot => slot.id === id)) return { accepted: false, reason: "duplicate" };
  const value = cap.resolve ? cap.resolve(evt.r, evt.c) : id;
  if (value === null || value === undefined) return { accepted: false, reason: "unusable" };
  cap.slots.push({ id, value });
  return { accepted: true, index: cap.slots.length - 1, value };
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
  if (field === "oneShotTimeoutMs" && n > 0 && n < 500) return 500;
  if (field === "layerTimeoutMs" && n > 0 && n < 1000) return 1000;
  return Math.min(hi, Math.max(lo, n));
}

function normalizeKeyCell(cell) {
  if (!cell || typeof cell !== "object") return { label: "---", tap: "NONE", hold: "NONE", dtap: "NONE" };
  return {
    label: typeof cell.label === "string" ? cell.label.slice(0, 16) : "",
    tap: typeof cell.tap === "string" ? cell.tap : "NONE",
    hold: typeof cell.hold === "string" ? cell.hold : "NONE",
    dtap: typeof cell.dtap === "string" ? cell.dtap : "NONE",
    // Eigener Tapping-Term in ms (100..500); ohne gültigen Wert fehlt das Feld (= Wert der Hälfte)
    ...(Number.isInteger(cell.tapTerm) && cell.tapTerm >= 100 && cell.tapTerm <= 500 ? { tapTerm: cell.tapTerm } : {}),
    // Eigene Hold-Tap-Variante (1..3 = Modus + 1); ohne gültigen Wert fehlt das Feld (= holdTapMode der Hälfte)
    ...(Number.isInteger(cell.holdFlavor) && cell.holdFlavor >= 1 && cell.holdFlavor <= HOLD_FLAVOR_MAX ? { holdFlavor: cell.holdFlavor } : {})
  };
}

// Consumer-Aktion (Media, Globe, Helligkeit, Mission Control, Launchpad): Aktionscode 0x120..0x12B
function isConsumerActionNumber(n) {
  return Number.isInteger(n) && n >= 0x120 && n <= 0x12B;
}

// Ein Tastenpaar-Mitglied ist eine normale Taste, ein Modifier, eine Consumer-Taste (Media, Globe, Systemtasten)
// oder eine Mausaktion (Klick, Rad, Pan)
function isKeyPairMember(code) {
  if (typeof code !== "string" || pairIndexFromCode(code) >= 0 || macroIndexFromCode(code) >= 0) return false;
  const n = actionCodeToNumeric(code);
  return (n >= 1 && n <= 0xFF) || isConsumerActionNumber(n) || (n >= 0x130 && n <= 0x134) || n === 0x139 || n === 0x13A;
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
    new Set(o.mods).size === o.mods.length && isKeyOverrideMember(o.key) && isKeyOverrideMember(o.replacement) &&
    (o.layerMask === undefined || o.layerMask === null || isValidComboLayerMask(o.layerMask));
}

// Modifier einer Überschreibung als Bitmaske (1..15) und in fester Reihenfolge
function keyOverrideModsValue(mods) {
  return (mods || []).reduce((v, m) => v | (KEY_OVERRIDE_MODS[m] || 0), 0);
}

function normalizeKeyOverride(o) {
  const value = keyOverrideModsValue(o.mods);
  const out = {
    mods: Object.keys(KEY_OVERRIDE_MODS).filter(m => value & KEY_OVERRIDE_MODS[m]),
    key: o.key,
    replacement: o.replacement
  };
  // Die Maske für alle Ebenen steht nicht in der Datei (Standard)
  if (isValidComboLayerMask(o.layerMask) && o.layerMask !== COMBO_ALL_LAYERS) out.layerMask = o.layerMask;
  return out;
}

// Maske einer Überschreibung (fehlend oder ungültig = alle Ebenen)
function keyOverrideLayerMask(o) {
  return o && isValidComboLayerMask(o.layerMask) ? o.layerMask : COMBO_ALL_LAYERS;
}

// "Ebene 0, 2" oder "" bei allen Ebenen
function keyOverrideLayerSuffix(mask) {
  if (mask === COMBO_ALL_LAYERS) return "";
  const layers = [];
  for (let i = 0; i < 8; i++) if (mask & (1 << i)) layers.push(i);
  return ` (Ebene ${layers.join(", ")})`;
}

// Anzeigename, z. B. "Shift + Bksp → Entf"
function keyOverrideLabel(o, labelFor) {
  if (!o) return "?";
  return `${o.mods.map(m => KEY_OVERRIDE_MOD_LABELS[m]).join(" + ")} + ${labelFor(o.key)} → ${labelFor(o.replacement)}${keyOverrideLayerSuffix(keyOverrideLayerMask(o))}`;
}

// Leader-Sequenz { keys: [1..4 Tasten], action }: Tasten 1..255 ohne Modifier; Aktion eine solche Taste, ein Tastenpaar
// (PAIR_n) oder ein Makro (MACRO_n). Wie server.py und die Firmware.
function isLeaderKey(code) {
  return isStandardKeyOrModifier(code) && !isModifierKeyCode(code);
}

function isLeaderAction(code) {
  return isLeaderKey(code) || pairIndexFromCode(code) >= 0 || macroIndexFromCode(code) >= 0;
}

// Alternate-Repeat-Paar { key, alt }: Tastaturcodes 1..255 (Modifier erlaubt), gerichtet, key != alt (wie Firmware und server.py)
function isValidAltRepeat(e) {
  return !!e && typeof e === "object" && isStandardKeyOrModifier(e.key) && isStandardKeyOrModifier(e.alt) &&
    actionCodeToNumeric(e.key) !== actionCodeToNumeric(e.alt);
}

// true, wenn zwei Paare der Liste denselben Auslöser haben
function hasDuplicateAltRepeat(list) {
  const seen = new Set();
  for (const e of list) {
    const id = actionCodeToNumeric(e.key);
    if (seen.has(id)) return true;
    seen.add(id);
  }
  return false;
}

function normalizeAltRepeat(e) {
  return { key: e.key, alt: e.alt };
}

function isValidLeaderSequence(q) {
  return !!q && typeof q === "object" && Array.isArray(q.keys) && q.keys.length >= 1 && q.keys.length <= LEADER_MAX_KEYS &&
    q.keys.every(isLeaderKey) && isLeaderAction(q.action);
}

// Tasten einer Sequenz als vier Zahlen, ungenutzte Plätze 0 (wie die Firmware)
function leaderKeyNumbers(keys) {
  const out = (keys || []).slice(0, LEADER_MAX_KEYS).map(actionCodeToNumeric);
  while (out.length < LEADER_MAX_KEYS) out.push(0);
  return out;
}

// true, wenn zwei Sequenzen der Liste dieselben Tasten haben
function hasDuplicateLeaderSequence(list) {
  const seen = new Set();
  for (const q of list) {
    const id = leaderKeyNumbers(q.keys).join(",");
    if (seen.has(id)) return true;
    seen.add(id);
  }
  return false;
}

function normalizeLeaderSequence(q) {
  return { keys: q.keys.slice(0, LEADER_MAX_KEYS), action: q.action };
}

// Anzeigename, z. B. "A, B → Makro 0"
function leaderSequenceLabel(q, labelFor) {
  if (!q) return "?";
  return `${q.keys.map(labelFor).join(", ")} → ${labelFor(q.action)}`;
}

// true, wenn eine Leader-Sequenz die Aktion code (z. B. PAIR_2, MACRO_1) ausführt
function isLeaderActionUsed(sequences, code) {
  return (sequences || []).some(q => q && q.action === code);
}

// Leader-Aktionen nach dem Löschen von Paar oder Makro idx (prefix "PAIR_" oder "MACRO_"): Sequenzen auf idx entfallen,
// höhere Verweise rücken auf. Liefert { sequences, removed: [{ index, seq }] } (Kopie, ändert nichts in-place).
function remapLeaderSequences(sequences, prefix, idx) {
  const re = new RegExp(`^${prefix}(\\d{1,2})$`);
  const out = [];
  const removed = [];
  (sequences || []).forEach((q, index) => {
    const m = q && typeof q.action === "string" ? re.exec(q.action) : null;
    const n = m ? Number(m[1]) : -1;
    if (n === idx) { removed.push({ index, seq: JSON.parse(JSON.stringify(q)) }); return; }
    out.push(n > idx ? { ...q, keys: q.keys.slice(), action: `${prefix}${n - 1}` } : JSON.parse(JSON.stringify(q)));
  });
  return { sequences: out, removed };
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
  const used = isKeyPairUsed(config.layers, idx) || (config.combos || []).some(cb => cb && cb.action === code) ||
    isLeaderActionUsed(config.leaderSequences, code);
  const old = JSON.parse(JSON.stringify({ keyPairs: config.keyPairs, layers: config.layers || [], combos: config.combos || [],
    leaderSequences: config.leaderSequences || [] }));
  return { used, next, old, removed: { ...config.keyPairs[idx] }, shiftsFollowing: idx < config.keyPairs.length - 1 };
}

// Entfernt das Tastenpaar idx und nummeriert die Verweise neu: PAIR_idx wird "NONE", PAIR_n mit n > idx
// wird PAIR_(n-1). Gilt für Tap, Halten und Doppel-Tipp aller Ebenen sowie für Combo-Aktionen.
// Leader-Sequenzen mit dem gelöschten Paar entfallen, höhere Verweise rücken auf.
// Ändert nichts in-place; liefert { keyPairs, layers, combos, leaderSequences } oder null bei ungültigem Index.
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
  const leaderSequences = remapLeaderSequences(config.leaderSequences, "PAIR_", idx).sequences;
  return { keyPairs: pairs.filter((_, i) => i !== idx).map(p => ({ ...p })), layers, combos, leaderSequences };
}

// Hängt die beim Übernehmen neu angelegten Paare an pairs an; liefert den Index des ersten neuen Paars
function appendResolvedPairs(pairs, added) {
  const firstIdx = pairs.length;
  added.forEach(pair => pairs.push({ ...pair }));
  return firstIdx;
}

// Revert einer Tastenänderung: entfernt die mitangelegten Paare, solange sie am Ende stehen und keine
// Taste sie nutzt (layers enthält die Taste bereits im alten Zustand). Liefert die Anzahl entfernter Paare.
// sequences: Leader-Sequenzen; ein Paar, das eine Sequenz ausführt, bleibt ebenfalls stehen.
function revertResolvedPairs(pairs, layers, firstIdx, count, sequences) {
  let removed = 0;
  for (let i = firstIdx + count - 1; i >= firstIdx; i--) {
    if (pairs.length !== i + 1 || isKeyPairUsed(layers, i) || isLeaderActionUsed(sequences, `PAIR_${i}`)) break;
    pairs.pop();
    removed++;
  }
  return removed;
}

// Makro-Schritt wie in server.py/Firmware: tap/down/up mit Tastatur-Code 1..255 oder einer Consumer-Taste (Media, Globe,
// Systemtasten), pause mit ms 1..MACRO_MAX_PAUSE_MS
function isValidMacroStep(step) {
  if (!step || typeof step !== "object" || !Object.prototype.hasOwnProperty.call(MACRO_STEP_TYPES, step.type)) return false;
  if (step.type === "pause") return Number.isInteger(step.ms) && step.ms >= 1 && step.ms <= MACRO_MAX_PAUSE_MS;
  return isStandardKeyOrModifier(step.code) || isMacroConsumerCode(step.code);
}

// Eine Consumer-Taste als Makro-Schritt (kein Pair-, Makro- oder Layer-Code)
function isMacroConsumerCode(code) {
  if (typeof code !== "string" || pairIndexFromCode(code) >= 0 || macroIndexFromCode(code) >= 0) return false;
  return isConsumerActionNumber(actionCodeToNumeric(code));
}

// Firmware-Triple [typ, code, ms] eines tap/down/up-Schritts: eine Consumer-Taste steht als code 0 mit der Aktion in ms
function macroStepTuple(step) {
  if (step.type === "pause") return [MACRO_STEP_TYPES.pause, 0, step.ms];
  const n = actionCodeToNumeric(step.code);
  return isConsumerActionNumber(n) ? [MACRO_STEP_TYPES[step.type], 0, n] : [MACRO_STEP_TYPES[step.type], n, 0];
}

// Der Aktionscode eines Triples aus dem Gerät (Umkehrung von macroStepTuple)
function macroTupleActionNumber(st) {
  return st[1] === 0 ? st[2] : st[1];
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

// Exportdatei eines einzelnen Makros: Name, Wiederholen-Flag und Schritte (ohne Slot, ohne Verweise von Tasten)
const MACRO_EXPORT_FORMAT = "dactyl-macro";
const MACRO_EXPORT_VERSION = 1;

function buildMacroExport(macro) {
  const out = { format: MACRO_EXPORT_FORMAT, version: MACRO_EXPORT_VERSION, name: sanitizeCommandText(macro.name, "Makro"),
    steps: macro.steps.map(normalizeMacroStep) };
  if (macro.repeat === true) out.repeat = true;
  return out;
}

// Prüft eine Makro-Exportdatei und ordnet das Makro dem ersten freien Slot zu (ohne die Liste zu ändern).
// Ergebnis: { ok: true, index, macro } oder { ok: false, error }
function parseMacroImport(jsonStr, existingMacros) {
  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    return { ok: false, error: "Die Datei ist kein gültiges JSON." };
  }
  if (!data || typeof data !== "object" || Array.isArray(data) || data.format !== MACRO_EXPORT_FORMAT || data.version !== MACRO_EXPORT_VERSION) {
    return { ok: false, error: "Die Datei ist kein Makro-Export dieser App." };
  }
  if (!Array.isArray(data.steps) || !data.steps.length) return { ok: false, error: "Das Makro braucht mindestens einen Schritt." };
  if (data.steps.length > MAX_MACRO_STEPS) return { ok: false, error: `Ein Makro hat maximal ${MAX_MACRO_STEPS} Schritte (Datei: ${data.steps.length}).` };
  if (!data.steps.every(isValidMacroStep)) {
    return { ok: false, error: `Das Makro enthält ungültige Schritte (tap/down/up mit normaler Taste, pause 1..${MACRO_MAX_PAUSE_MS} ms).` };
  }
  const index = macroSaveIndex(existingMacros, -1);
  if (index === null) return { ok: false, error: `Alle ${MAX_MACROS} Makro-Plätze sind belegt.` };
  const macro = { name: sanitizeCommandText(data.name, `Makro ${index}`), steps: data.steps.map(normalizeMacroStep) };
  if (data.repeat === true) macro.repeat = true;
  return { ok: true, index, macro };
}

// Makro-Vorlagen: fertige Schrittfolgen für das macOS-Layout "U.S." (Text über textToMacroSteps, danach Cursor-Tasten).
// build() liefert frische Schritte (höchstens MAX_MACRO_STEPS), damit keine Vorlage geteilt oder verändert wird.
function macroPresetSteps(text, cursorKeys = []) {
  return [...textToMacroSteps(text).steps, ...cursorKeys.map(code => ({ type: "tap", code }))];
}

const MACRO_PRESETS = {
  git_status: { name: "git status", build: () => macroPresetSteps("git status") },
  git_commit: { name: "git commit", build: () => macroPresetSteps("git commit -m \"\"", ["KEY_LEFT_ARROW"]) },
  git_push: { name: "git push", build: () => macroPresetSteps("git push") },
  arrow_function: { name: "Arrow function", build: () => macroPresetSteps("() => {}", ["KEY_LEFT_ARROW"]) },
  markdown_link: { name: "Markdown-Link", build: () => macroPresetSteps("[]()", ["KEY_LEFT_ARROW", "KEY_LEFT_ARROW", "KEY_LEFT_ARROW"]) },
  code_block: { name: "Codeblock", build: () => macroPresetSteps("```\n\n```", ["KEY_UP_ARROW"]) },
  console_log: { name: "console.log", build: () => macroPresetSteps("console.log()", ["KEY_LEFT_ARROW"]) }
};

// Setzt die Vorlage in Slot slotIndex (0..macros.length; macros.length hängt ein neues Makro an, höchstens MAX_MACROS).
// Ändert nichts in-place; liefert die neue Makro-Liste oder null bei ungültiger Vorlage, ungültigem Slot oder ungültiger Liste.
// Ein vorhandenes Makro behält Name und Wiederholen-Flag nicht: die Vorlage ersetzt es ganz.
function applyMacroPreset(presetKey, slotIndex, macros) {
  if (typeof presetKey !== "string" || !Object.prototype.hasOwnProperty.call(MACRO_PRESETS, presetKey)) return null;
  if (!Array.isArray(macros) || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > macros.length || slotIndex >= MAX_MACROS) return null;
  const preset = MACRO_PRESETS[presetKey];
  const macro = { name: sanitizeCommandText(preset.name, `Makro ${slotIndex}`), steps: preset.build() };
  if (!isValidMacro(macro) || !macro.steps.length) return null;
  const next = JSON.parse(JSON.stringify(macros));
  next[slotIndex] = macro;
  return next;
}

// Firmware-Befehle eines Makros: ADD_MACRO [1], dann je Schritt ADD_MACRO_STEP <typ> <code> <ms>.
// Das Argument 1 (Wiederholen, solange die Taste gehalten wird) steht nur bei gesetztem Flag: ältere Firmware kennt es nicht.
function macroCommands(macro) {
  return [macro.repeat === true ? "ADD_MACRO 1" : "ADD_MACRO", ...macro.steps.map(st => `ADD_MACRO_STEP ${macroStepTuple(st).join(" ")}`)];
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
function isMacroUsed(layers, idx, sequences) {
  const code = `MACRO_${idx}`;
  if (isLeaderActionUsed(sequences, code)) return true;
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
// Leader-Sequenzen mit dem Makro entfallen (leaderRemoved, für restoreMacroAt), höhere Verweise rücken auf.
// Ändert nichts in-place; liefert { macros, layers, cleared, leaderSequences, leaderRemoved } oder null bei ungültigem Index.
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
  const leader = remapLeaderSequences(config.leaderSequences, "MACRO_", idx);
  return { macros: JSON.parse(JSON.stringify(macros.filter((_, i) => i !== idx))), layers, cleared,
    leaderSequences: leader.sequences, leaderRemoved: leader.removed };
}

// Rückgängig zu removeMacroAt auf dem aktuellen Stand: fügt das Makro wieder bei idx ein, rückt höhere Verweise
// zurück und setzt nur die geleerten Positionen wieder, die noch leer sind. Spätere Tastenänderungen bleiben.
// leaderRemoved: die mit dem Makro entfallenen Leader-Sequenzen ({ index, seq }); sie kommen an ihre Stelle zurück.
function restoreMacroAt(config, idx, macro, cleared, leaderRemoved) {
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
  const sequences = JSON.parse(JSON.stringify((config && config.leaderSequences) || [])).map(q => {
    const n = macroIndexFromCode(q.action);
    return n >= idx ? { ...q, action: `MACRO_${n + 1}` } : q;
  });
  for (const { index, seq } of (leaderRemoved || [])) {
    if (sequences.length < MAX_LEADER_SEQS) sequences.splice(Math.min(index, sequences.length), 0, JSON.parse(JSON.stringify(seq)));
  }
  return { macros, layers, leaderSequences: sequences };
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
      if (cb.layerMask !== undefined && cb.layerMask !== null && !isValidComboLayerMask(cb.layerMask)) {
        throw new Error(`Combo ${i + 1} hat eine ungültige Ebenenmaske (1..${COMBO_ALL_LAYERS} erwartet).`);
      }
      if (cb.key3 !== undefined && cb.key3 !== null) {
        if (!isValidComboKey(cb.key3)) throw new Error(`Combo ${i + 1} hat eine ungültige dritte Taste (key3).`);
        const same = k => k.r === cb.key3.r && k.c === cb.key3.c;
        if (same(cb.key1) || same(cb.key2)) throw new Error(`Combo ${i + 1}: Die dritte Taste muss sich von den ersten beiden unterscheiden.`);
      }
      if (cb.windowMs !== undefined && cb.windowMs !== null && !isValidComboWindow(cb.windowMs)) {
        throw new Error(`Combo ${i + 1} hat ein ungültiges Zeitfenster (${COMBO_WINDOW_MIN}..${COMBO_WINDOW_MAX} ms erwartet).`);
      }
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
  if (cfg.leaderSequences !== undefined) {
    if (!Array.isArray(cfg.leaderSequences) || cfg.leaderSequences.length > MAX_LEADER_SEQS) {
      throw new Error(`'leaderSequences' muss eine Liste mit maximal ${MAX_LEADER_SEQS} Einträgen sein.`);
    }
    cfg.leaderSequences.forEach((q, i) => {
      if (!isValidLeaderSequence(q)) {
        throw new Error(`Leader-Sequenz ${i} braucht 1..${LEADER_MAX_KEYS} normale Tasten (keys) und eine Aktion (Taste, Tastenpaar oder Makro).`);
      }
    });
    if (hasDuplicateLeaderSequence(cfg.leaderSequences)) throw new Error("Zwei Leader-Sequenzen haben dieselben Tasten.");
  }
  if (cfg.altRepeats !== undefined) {
    if (!Array.isArray(cfg.altRepeats) || cfg.altRepeats.length > MAX_ALT_REPEATS) {
      throw new Error(`'altRepeats' muss eine Liste mit maximal ${MAX_ALT_REPEATS} Einträgen sein.`);
    }
    cfg.altRepeats.forEach((e, i) => {
      if (!isValidAltRepeat(e)) throw new Error(`Alt-Repeat-Paar ${i} braucht zwei Tasten (key, alt) mit Codes 1..255.`);
    });
    if (hasDuplicateAltRepeat(cfg.altRepeats)) throw new Error("Zwei Alt-Repeat-Paare haben dieselbe Taste.");
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
  if ((cfg.combos || []).some(cb => cb && isOslCode(cb.action))) throw new Error("Combos unterstützen keine One-Shot-Ebene.");
  if ((cfg.combos || []).some(cb => cb && isDynamicMacroCode(cb.action))) throw new Error("Combos unterstützen keine dynamischen Makros.");
  if ((cfg.combos || []).some(cb => cb && isLeaderCode(cb.action))) throw new Error("Combos unterstützen kein Leader.");
  if ((cfg.combos || []).some(cb => cb && isKeyLockCode(cb.action))) throw new Error("Combos unterstützen kein Key Lock.");
  if ((cfg.combos || []).some(cb => cb && isSwapHandsCode(cb.action))) throw new Error("Combos unterstützen kein Swap Hands.");
  if ((cfg.combos || []).some(cb => cb && isNumWordCode(cb.action))) throw new Error("Combos unterstützen kein Num Word.");
  if ((cfg.combos || []).some(cb => cb && isTtCode(cb.action))) throw new Error("Combos unterstützen keine Tapping-Term-Tasten.");
  if ((cfg.combos || []).some(cb => cb && isKeepAwakeCode(cb.action))) throw new Error("Combos unterstützen kein Keep-awake.");
  if ((cfg.combos || []).some(cb => cb && isBleHostCode(cb.action))) throw new Error("Combos unterstützen keine BLE-Host-Slots.");
  // Den Slot hat nur der Master: auf der anderen Hälfte tun DM_REC und DM_PLAY nichts (wie validate_config in server.py)
  if (profile && !profile.master && Array.isArray(cfg.layers) &&
      cfg.layers.some(layer => Array.isArray(layer) && layer.some(row => Array.isArray(row) && row.some(cell => {
        const actions = typeof cell === "string" ? [cell] : (cell && typeof cell === "object" ? [cell.tap, cell.hold, cell.dtap] : []);
        return actions.some(isDynamicMacroCode);
      })))) {
    throw new Error(`Dynamische Makros (DM_REC, DM_PLAY) gelten nur für die ${Dactyl.SIDE_PROFILES[Dactyl.getMasterSide()].label} (Master).`);
  }
  // Auch den Host-Slot hat nur der Master (wie validate_config in server.py)
  if (profile && !profile.master && Array.isArray(cfg.layers) &&
      cfg.layers.some(layer => Array.isArray(layer) && layer.some(row => Array.isArray(row) && row.some(cell => {
        const actions = typeof cell === "string" ? [cell] : (cell && typeof cell === "object" ? [cell.tap, cell.hold, cell.dtap] : []);
        return actions.some(isBleHostCode);
      })))) {
    throw new Error(`BLE-Host-Slots (HOST_1 .. HOST_3) gelten nur für die ${Dactyl.SIDE_PROFILES[Dactyl.getMasterSide()].label} (Master).`);
  }
  if (profile && !profile.master && Array.isArray(cfg.layers) &&
      cfg.layers.some(layer => Array.isArray(layer) && layer.some(row => Array.isArray(row) && row.some(cell => {
        const actions = typeof cell === "string" ? [cell] : (cell && typeof cell === "object" ? [cell.tap, cell.hold, cell.dtap] : []);
        return actions.some(isKeepAwakeCode);
      })))) {
    throw new Error(`Keep-awake (KEEP_AWAKE) gilt nur für die ${Dactyl.SIDE_PROFILES[Dactyl.getMasterSide()].label} (Master).`);
  }
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

// Tauscht zwei Zellen einer Ebene (Ziehen einer Taste auf eine andere). Gibt eine neue Ebene zurück;
// null bei ungültigen Koordinaten oder gleicher Zelle. Die Eingabe bleibt unverändert.
function swapLayerKeys(layer, r1, c1, r2, c2) {
  if (!Array.isArray(layer)) return null;
  if (!isValidIndex(r1, NUM_ROWS) || !isValidIndex(r2, NUM_ROWS)) return null;
  if (!isValidIndex(c1, NUM_COLS) || !isValidIndex(c2, NUM_COLS)) return null;
  if (r1 === r2 && c1 === c2) return null;
  const next = JSON.parse(JSON.stringify(layer));
  while (next.length < NUM_ROWS) next.push([]);
  for (const r of [r1, r2]) {
    while (next[r].length < NUM_COLS) next[r].push({ label: "---", tap: "NONE", hold: "NONE", dtap: "NONE" });
  }
  [next[r1][c1], next[r2][c2]] = [next[r2][c2], next[r1][c1]];
  return next;
}

// Nutzlast eines Tasten-Ziehens ("<Hälfte>:<Zeile>:<Spalte>"); null bei jedem anderen Text
function parseKeyDragPayload(text) {
  const m = /^([A-Za-z]+):(\d+):(\d+)$/.exec(String(text || ""));
  return m ? { side: m[1], r: Number(m[2]), c: Number(m[3]) } : null;
}

// Neue Position einer Auswahl, nachdem zwei Zellen getauscht wurden: nur die beiden Zellen wandern
function swappedSelectionPosition(pos, r1, c1, r2, c2) {
  if (!pos) return pos;
  if (pos.r === r1 && pos.c === c1) return { ...pos, r: r2, c: c2 };
  if (pos.r === r2 && pos.c === c2) return { ...pos, r: r1, c: c1 };
  return pos;
}

// Links/rechts-Paare, die beim Spiegeln einer Ebene die Seite wechseln
const MIRROR_CODE_PAIRS = [
  ["KEY_LEFT_CTRL", "KEY_RIGHT_CTRL"], ["KEY_LEFT_SHIFT", "KEY_RIGHT_SHIFT"],
  ["KEY_LEFT_ALT", "KEY_RIGHT_ALT"], ["KEY_LEFT_GUI", "KEY_RIGHT_GUI"],
  ["KEY_LEFT_ARROW", "KEY_RIGHT_ARROW"], ["KEY_LEFT_BRACKET", "KEY_RIGHT_BRACKET"],
  ["OSM_LCTRL", "OSM_RCTRL"], ["OSM_LSHIFT", "OSM_RSHIFT"], ["OSM_LALT", "OSM_RALT"], ["OSM_LGUI", "OSM_RGUI"],
  ["MOUSE_LEFT_MOVE", "MOUSE_RIGHT_MOVE"], ["MOUSE_WHEEL_LEFT", "MOUSE_WHEEL_RIGHT"]
];
const MIRROR_CODE_MAP = (() => {
  const map = {};
  for (const [a, b] of MIRROR_CODE_PAIRS) { map[a] = b; map[b] = a; }
  return map;
})();

function mirrorActionCode(code) {
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(MIRROR_CODE_MAP, code) ? MIRROR_CODE_MAP[code] : code;
}

// Gespiegelte Position einer Taste: Finger-Spalte c -> 5 - c, Daumentasten nach Raster (thumbDefs, Spalte g -> 4 - g)
function mirrorKeyPosition(r, c, srcProfile, dstProfile) {
  if (r < 5) return c < 6 ? { r, c: 5 - c } : null;
  const src = srcProfile.thumbDefs.find(t => t.r === r && t.c === c);
  if (!src) return null;
  const dst = dstProfile.thumbDefs.find(t => t.row === src.row && Number(t.col) === 4 - Number(src.col));
  return dst ? { r: dst.r, c: dst.c } : null;
}

// Spiegelt eine Ebene der Hälfte srcProfile auf die andere Hälfte dstProfile. Gibt eine neue Ebene zurück
// (nicht belegte Zielpositionen transparent); fehlende Tasten beider Hälften werden übersprungen. PAIR_n und MACRO_n
// entfallen (Listen je Hälfte), ebenso Master-Aktionen (HOST_n, DM_REC, DM_PLAY) auf einer Zielhälfte ohne Master.
function mirrorLayerAcrossSides(layer, srcProfile, dstProfile) {
  if (!Array.isArray(layer) || !srcProfile || !dstProfile || srcProfile === dstProfile) return null;
  const next = transparentLayer();
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      if (!isPhysicalKey(r, c, srcProfile)) continue;
      const pos = mirrorKeyPosition(r, c, srcProfile, dstProfile);
      if (!pos || !isPhysicalKey(pos.r, pos.c, dstProfile)) continue;
      const cell = layer[r] && layer[r][c];
      if (!cell || typeof cell !== "object") continue;
      const out = JSON.parse(JSON.stringify(normalizeKeyCell(cell)));
      const originalTap = out.tap;
      for (const field of ["tap", "hold", "dtap"]) {
        out[field] = mirrorActionCode(out[field]);
        // Tastenpaare und Makros sind Listen je Hälfte: der Index würde auf der Zielhälfte etwas anderes meinen
        if (pairIndexFromCode(out[field]) >= 0 || macroIndexFromCode(out[field]) >= 0) out[field] = "NONE";
        // Host-Slots und dynamische Makros hat nur der Master; die andere Hälfte lehnt sie ab
        if (!dstProfile.master && (isBleHostCode(out[field]) || isKeepAwakeCode(out[field]) || isDynamicMacroCode(out[field]))) out[field] = "NONE";
      }
      if (out.tap !== originalTap) {
        const def = findDefinitionByCode(actionCodeToNumeric(out.tap));
        out.label = (def && def.tap !== "NONE" ? def.label : out.tap.replace("KEY_", "")).slice(0, 16);
      }
      next[pos.r][pos.c] = out;
    }
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
        // Eine ungültige Maske wird zu "alle Ebenen"; die Maske für alle Ebenen steht nicht in der Datei.
        // Eine ungültige oder doppelte dritte Taste und ein ungültiges Fenster entfallen (zwei Tasten, globales Fenster).
        .map(cb => {
          const { layerMask, key3, windowMs, ...rest } = cb;
          const out = isValidComboLayerMask(layerMask) && layerMask !== COMBO_ALL_LAYERS ? { ...rest, layerMask } : rest;
          const distinct = isValidComboKey(key3) && !(key3.r === cb.key1.r && key3.c === cb.key1.c) &&
            !(key3.r === cb.key2.r && key3.c === cb.key2.c);
          if (distinct) out.key3 = key3;
          if (isValidComboWindow(windowMs)) out.windowMs = windowMs;
          return out;
        })
    : [];
  cfg.keyPairs = Array.isArray(cfg.keyPairs)
    ? cfg.keyPairs.filter(p => p && isKeyPairMember(p.first) && isKeyPairMember(p.second))
        .slice(0, MAX_KEY_PAIRS).map(p => ({ first: p.first, second: p.second }))
    : [];
  // Nur der Master trägt Überschreibungen; die Liste der anderen Hälfte bleibt leer
  cfg.keyOverrides = Array.isArray(cfg.keyOverrides) && profile && profile.master
    ? cfg.keyOverrides.filter(isValidKeyOverride).slice(0, MAX_KEY_OVERRIDES).map(normalizeKeyOverride)
    : [];
  // Ungültige oder doppelte Sequenzen entfallen (der erste Eintrag mit denselben Tasten gewinnt)
  const leaderList = [];
  for (const q of Array.isArray(cfg.leaderSequences) ? cfg.leaderSequences : []) {
    if (!isValidLeaderSequence(q) || leaderList.length >= MAX_LEADER_SEQS) continue;
    if (!hasDuplicateLeaderSequence([...leaderList, q])) leaderList.push(normalizeLeaderSequence(q));
  }
  cfg.leaderSequences = leaderList;
  // Ungültige oder doppelte Alt-Repeat-Paare entfallen (das erste mit derselben Taste gewinnt)
  const altList = [];
  for (const e of Array.isArray(cfg.altRepeats) ? cfg.altRepeats : []) {
    if (!isValidAltRepeat(e) || altList.length >= MAX_ALT_REPEATS) continue;
    if (!hasDuplicateAltRepeat([...altList, e])) altList.push(normalizeAltRepeat(e));
  }
  cfg.altRepeats = altList;
  // Ein ungültiges Makro wird leer, nicht entfernt: MACRO_<n> verweist per Index, die Indizes bleiben gleich
  cfg.macros = Array.isArray(cfg.macros)
    ? cfg.macros.slice(0, MAX_MACROS).map((m, i) => ({
        name: sanitizeCommandText(m && m.name, `Makro ${i}`),
        steps: isValidMacro(m) ? m.steps.map(normalizeMacroStep) : [],
        // Das Feld steht nur bei gesetztem Flag: Makros ohne Wiederholung behalten ihre Form
        ...(isValidMacro(m) && m.repeat === true ? { repeat: true } : {})
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
    quickTapMs: clampSetting("quickTapMs", s.quickTapMs ?? 0),
    leaderTimeoutMs: clampSetting("leaderTimeoutMs", s.leaderTimeoutMs ?? 1000),
    oneShotTimeoutMs: clampSetting("oneShotTimeoutMs", s.oneShotTimeoutMs ?? 0),
    layerTimeoutMs: clampSetting("layerTimeoutMs", s.layerTimeoutMs ?? 0),
    requirePriorIdleMs: clampSetting("requirePriorIdleMs", s.requirePriorIdleMs ?? 0),
    chordalHold: clampSetting("chordalHold", s.chordalHold ?? 0),
    retroTap: clampSetting("retroTap", s.retroTap ?? 0),
    numWordLayer: clampSetting("numWordLayer", s.numWordLayer ?? 1),
    bootLayer: clampSetting("bootLayer", s.bootLayer ?? 0),
    autoShift: clampSetting("autoShift", s.autoShift ?? 0),
    autoShiftMs: clampSetting("autoShiftMs", s.autoShiftMs ?? 175),
    triLayers: normalizeTriLayers(s.triLayers),
    capsLed: clampSetting("capsLed", s.capsLed ?? 0),
    standbyTimeoutMinutes: clampSetting("standbyTimeoutMinutes", s.standbyTimeoutMinutes ?? 5),
    sleepTimeoutMinutes: clampSetting("sleepTimeoutMinutes", s.sleepTimeoutMinutes ?? 60)
  };
  return cfg;
}

// Tipp-Statistik für Heatmap & WPM (DOM-frei, Zählung nur physischer Tasten der Hälfte aus profile)
const WPM_WINDOW_MS = 60000;
const CHARS_PER_WORD = 5;
const HEAT_LEVELS = 5;

// Finger der Hände von außen nach innen, danach der Daumen (Reihenfolge der Anzeige)
const FINGER_IDS = ["pinky", "ring", "middle", "index", "thumb"];
const FINGER_LABELS = { pinky: "Kleiner Finger", ring: "Ringfinger", middle: "Mittelfinger", index: "Zeigefinger", thumb: "Daumen" };
const SAME_FINGER_TOP = 5;
// Größter Abstand zweier Anschläge, der noch eine Folge ergibt; nach einer längeren Pause beginnt eine neue
const SAME_FINGER_MAX_GAP_MS = 1000;
// Ein Backspace korrigiert die Taste davor nur innerhalb dieses Fensters
const CORRECTION_WINDOW_MS = 1500;
// Eine Taste braucht so viele Anschläge, bevor ihr Korrekturanteil zählt (1 von 1 wäre sonst 100 %)
const CORRECTION_MIN_PRESSES = 5;
const CORRECTION_TOP = 5;

// Finger der Taste: Daumenzeile (Zeile 5) und Spalte 6 sind der Daumen, sonst gilt profile.fingerCols
function fingerOfKey(r, c, profile) {
  if (!profile || !isValidIndex(r, NUM_ROWS) || !isValidIndex(c, NUM_COLS) || !isPhysicalKey(r, c, profile)) return null;
  if (r >= NUM_ROWS - 1 || c >= NUM_COLS - 1) return "thumb";
  const finger = Array.isArray(profile.fingerCols) ? profile.fingerCols[c] : null;
  return FINGER_IDS.includes(finger) ? finger : null;
}

// Eine Folge zählt nur für zwei verschiedene Tasten desselben Fingers; der Daumen ist ausgenommen
// (Space und Backspace nacheinander sind normal). Die Folge ist ungerichtet: "a|b" mit a < b.
function sameFingerPairKey(idA, idB, profile) {
  const parse = id => {
    const m = /^(\d+)_(\d+)$/.exec(id);
    return m ? [Number(m[1]), Number(m[2])] : null;
  };
  const a = parse(idA), b = parse(idB);
  if (!a || !b || idA === idB) return null;
  const finger = fingerOfKey(a[0], a[1], profile);
  if (!finger || finger === "thumb" || finger !== fingerOfKey(b[0], b[1], profile)) return null;
  const order = (a[0] - b[0]) || (a[1] - b[1]);
  return order < 0 ? `${idA}|${idB}` : `${idB}|${idA}`;
}

// Folgen aus gespeicherten Daten: nur gültige, ungerichtete Paare verschiedener Tasten eines Fingers
function sanitizeSameFinger(stored, profile) {
  const pairs = {};
  let total = 0;
  const src = stored && typeof stored === "object" && !Array.isArray(stored)
    && Object.prototype.hasOwnProperty.call(stored, "sameFinger") ? stored.sameFinger : null;
  const raw = src && typeof src === "object" && !Array.isArray(src)
    && src.pairs && typeof src.pairs === "object" && !Array.isArray(src.pairs) ? src.pairs : null;
  if (raw) {
    for (const [key, n] of Object.entries(raw)) {
      const m = /^(\d+_\d+)\|(\d+_\d+)$/.exec(key);
      if (!m || !Number.isSafeInteger(n) || n <= 0 || sameFingerPairKey(m[1], m[2], profile) !== key) continue;
      pairs[key] = n;
      total += n;
    }
  }
  return { pairs, total };
}

// Ungerichtetes Paar zweier verschiedener Tasten, kleinere Position zuerst ("r_c|r_c"); null bei gleicher Taste
function bigramPairKey(idA, idB) {
  if (idA === idB) return null;
  const pos = id => id.split("_").map(Number);
  const [a, b] = pos(idA), [c, d] = pos(idB);
  return ((a - c) || (b - d)) < 0 ? `${idA}|${idB}` : `${idB}|${idA}`;
}

// Bigramme aus gespeicherten Daten: nur gültige, geordnete Paare physischer Tasten
function sanitizeBigrams(stored, profile) {
  const pairs = {};
  const src = stored && typeof stored === "object" && !Array.isArray(stored)
    && Object.prototype.hasOwnProperty.call(stored, "bigrams") ? stored.bigrams : null;
  if (src && typeof src === "object" && !Array.isArray(src)) {
    for (const [key, n] of Object.entries(src)) {
      const m = /^(\d+_\d+)\|(\d+_\d+)$/.exec(key);
      if (!m || !Number.isSafeInteger(n) || n <= 0 || bigramPairKey(m[1], m[2]) !== key) continue;
      const ok = id => { const [r, c] = id.split("_").map(Number); return isValidIndex(r, NUM_ROWS) && isValidIndex(c, NUM_COLS) && isPhysicalKey(r, c, profile); };
      if (ok(m[1]) && ok(m[2])) pairs[key] = n;
    }
  }
  return pairs;
}

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

// stored: { "r_c": n, layers: { "<ebene>": { "r_c": n } }, sameFinger: { pairs: { "r_c|r_c": n } } }. Die
// Gesamtzähler bleiben oben, so liest eine ältere App-Version sie weiter (sie verwirft die Schlüssel "layers"
// und "sameFinger"); die alte Form hat nur "r_c"-Schlüssel, dann sind die Folgen leer.
function createTypingStats(stored, profile) {
  const base = sanitizeKeyCounts(stored, profile);
  const same = sanitizeSameFinger(stored, profile);
  const hasCorrections = stored && typeof stored === "object" && !Array.isArray(stored)
    && Object.prototype.hasOwnProperty.call(stored, "corrections");
  const corrections = sanitizeKeyCounts(hasCorrections ? stored.corrections : null, profile);
  const stats = {
    counts: base.counts, total: base.total, layerCounts: [], recent: [], profile,
    sameFingerPairs: same.pairs, sameFingerTotal: same.total, lastKeyId: null, lastKeyMs: 0,
    corrections: corrections.counts, lastTypedId: null, lastTypedMs: 0,
    bigrams: sanitizeBigrams(stored, profile), lastBigramId: null, lastBigramMs: 0
  };
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
  const out = { ...stats.counts, layers };
  if (stats.sameFingerTotal > 0) out.sameFinger = { pairs: { ...stats.sameFingerPairs } };
  if (Object.keys(stats.corrections).length) out.corrections = { ...stats.corrections };
  if (Object.keys(stats.bigrams).length) out.bigrams = { ...stats.bigrams };
  return out;
}

// layer: Ebene beim Drücken (KEY_PRESS / SPLIT_KEY); ohne gültige Ebene zählt die Taste nur gesamt
// role (keyPressRole): "backspace" zählt als Korrektur der Taste davor (gleiche Hälfte, höchstens
// CORRECTION_WINDOW_MS früher); danach gibt es keine Taste davor mehr, ein gehaltener Backspace korrigiert einmal.
// "silent" (Modifier, Ebenen-Taste, keine Belegung) ändert die Taste davor nicht; sonst gilt die Taste als getippt.
function recordKeyPress(stats, r, c, nowMs, layer, role = "typed") {
  if (!isValidIndex(r, NUM_ROWS) || !isValidIndex(c, NUM_COLS) || !isPhysicalKey(r, c, stats.profile)) return false;
  const id = `${r}_${c}`;
  stats.counts[id] = (stats.counts[id] || 0) + 1;
  stats.total++;
  const withinGap = !(nowMs - stats.lastKeyMs > SAME_FINGER_MAX_GAP_MS); // ohne Zeitstempel zählt die Folge
  const pairKey = stats.lastKeyId && withinGap ? sameFingerPairKey(stats.lastKeyId, id, stats.profile) : null;
  if (pairKey) {
    stats.sameFingerPairs[pairKey] = (stats.sameFingerPairs[pairKey] || 0) + 1;
    stats.sameFingerTotal++;
  }
  // Bigramm: zwei getippte Tasten der Hälfte nacheinander auf Ebene 0 (jede Folge, auch über Finger hinweg).
  // Modifier, Ebenen-Tasten, Backspace und Tasten anderer Ebenen bilden kein Bigramm und beenden die Folge.
  const onBase = role === "typed" && (!isValidIndex(layer, NUM_LAYERS) || layer === 0);
  const bigramKey = onBase && stats.lastBigramId && !(nowMs - stats.lastBigramMs > SAME_FINGER_MAX_GAP_MS)
    ? bigramPairKey(stats.lastBigramId, id) : null;
  if (bigramKey) stats.bigrams[bigramKey] = (stats.bigrams[bigramKey] || 0) + 1;
  if (role !== "silent") { stats.lastBigramId = onBase ? id : null; stats.lastBigramMs = nowMs; }
  stats.lastKeyId = id;
  stats.lastKeyMs = nowMs;
  if (role === "backspace") {
    if (stats.lastTypedId && !(nowMs - stats.lastTypedMs > CORRECTION_WINDOW_MS)) {
      stats.corrections[stats.lastTypedId] = (stats.corrections[stats.lastTypedId] || 0) + 1;
    }
    stats.lastTypedId = null;
  } else if (role !== "silent") {
    stats.lastTypedId = id;
    stats.lastTypedMs = nowMs;
  }
  if (isValidIndex(layer, NUM_LAYERS)) {
    const layerCounts = stats.layerCounts[layer];
    layerCounts[id] = (layerCounts[id] || 0) + 1;
  }
  stats.recent.push(nowMs);
  pruneRecentPresses(stats, nowMs);
  return true;
}

// Anschläge und Anteil je Finger der Hälfte (Reihenfolge FINGER_IDS); der Anteil bezieht sich auf die Hälfte
function fingerLoad(stats) {
  const counts = Object.fromEntries(FINGER_IDS.map(f => [f, 0]));
  for (const [id, n] of Object.entries(stats.counts)) {
    const [r, c] = id.split("_").map(Number);
    const finger = fingerOfKey(r, c, stats.profile);
    if (finger) counts[finger] += n;
  }
  return FINGER_IDS.map(finger => ({
    finger, count: counts[finger], share: stats.total ? counts[finger] / stats.total : 0
  }));
}

// Anteil jeder Hälfte an allen Anschlägen; entries: [{ side, stats }]
function halfLoad(entries) {
  const sum = entries.reduce((acc, e) => acc + e.stats.total, 0);
  return entries.map(e => ({ side: e.side, count: e.stats.total, share: sum ? e.stats.total / sum : 0 }));
}

// Die häufigsten Folgen zweier Tasten eines Fingers: [{ a, b, count }], absteigend, bei Gleichstand nach Schlüssel
function topSameFingerPairs(stats, limit = SAME_FINGER_TOP) {
  return Object.entries(stats.sameFingerPairs)
    .sort((x, y) => (y[1] - x[1]) || (x[0] < y[0] ? -1 : 1))
    .slice(0, limit)
    .map(([key, count]) => {
      const [a, b] = key.split("|");
      return { a, b, count };
    });
}

const ERGONOMIC_SWAP_LIMIT = 5;
const ERGONOMIC_HOME_ROW = 2;
const ERGONOMIC_EASY_FINGERS = ["index", "middle", "ring"];

// Tausch-Vorschläge für Ebene 0 aus der Heatmap: häufige Tasten auf anstrengenden Plätzen (kleiner Finger außen,
// obere Reihe, Taste einer häufigen Folge desselben Fingers) tauschen mit seltenen Tasten der Grundreihe unter
// Zeige-, Mittel- oder Ringfinger. Nur einfache Tasten ohne Halte- und Doppel-Tipp-Aktion zählen; Modifier,
// Layer-Tasten, Makros, Paare und fehlende Tasten bleiben unberührt. Jede Position kommt höchstens einmal vor.
// exclude (Set von "r_c"): Positionen, die schon getauscht wurden; ihre Zähler gehören noch zur alten Taste.
// Liefert höchstens min(limit, ERGONOMIC_SWAP_LIMIT) Einträge { from, to, fromCount, toCount, reason }, größter Gewinn zuerst.
function suggestErgonomicSwaps(stats, config, profile, limit = ERGONOMIC_SWAP_LIMIT, exclude = null) {
  if (!stats || !stats.counts || !config || !profile) return [];
  // Zähler der Ebene 0, sobald es welche gibt (ältere Daten kennen nur die Gesamtzähler)
  const layer0 = Array.isArray(stats.layerCounts) ? stats.layerCounts[0] : null;
  const counts = layer0 && Object.keys(layer0).length ? layer0 : stats.counts;
  const cells = [];
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      const finger = fingerOfKey(r, c, profile);
      if (!finger || (exclude && exclude.has(`${r}_${c}`))) continue;
      const a = lintCellAt(config, 0, r, c);
      if (!isStandardKeyOrModifier(a.tap) || isModifierKeyCode(a.tap) || a.hold !== "NONE" || a.dtap !== "NONE") continue;
      cells.push({ r, c, finger, count: counts[`${r}_${c}`] || 0 });
    }
  }
  const pairKeys = new Set();
  for (const p of topSameFingerPairs(stats)) { pairKeys.add(p.a); pairKeys.add(p.b); }
  const reasonOf = k => {
    if (k.r === ERGONOMIC_HOME_ROW && ERGONOMIC_EASY_FINGERS.includes(k.finger)) return null; // schon gut platziert
    if (k.finger === "pinky") return "Kleiner Finger";
    if (k.r === 0) return "Obere Reihe";
    return pairKeys.has(`${k.r}_${k.c}`) ? "Häufige Folge desselben Fingers" : null;
  };
  const high = cells.map(k => ({ ...k, reason: reasonOf(k) })).filter(k => k.reason && k.count > 0)
    .sort((x, y) => (y.count - x.count) || (x.r - y.r) || (x.c - y.c));
  const low = cells.filter(k => k.r === ERGONOMIC_HOME_ROW && ERGONOMIC_EASY_FINGERS.includes(k.finger))
    .sort((x, y) => (x.count - y.count) || (x.c - y.c));
  const used = new Set();
  const swaps = [];
  for (const h of high) {
    if (swaps.length >= Math.min(limit, ERGONOMIC_SWAP_LIMIT)) break;
    if (used.has(`${h.r}_${h.c}`)) continue;
    const t = low.find(l => !used.has(`${l.r}_${l.c}`) && l.count < h.count);
    if (!t) continue;
    used.add(`${h.r}_${h.c}`);
    used.add(`${t.r}_${t.c}`);
    swaps.push({ from: { r: h.r, c: h.c }, to: { r: t.r, c: t.c }, fromCount: h.count, toCount: t.count, reason: h.reason });
  }
  return swaps;
}

const COMBO_SUGGESTION_LIMIT = 5;

// Zwei Tasten der Finger-Matrix liegen nebeneinander (auch diagonal); die Daumenzeile zählt nicht
function areAdjacentFingerKeys(a, b) {
  return a.r < 5 && b.r < 5 && Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)) === 1;
}

// Combo-Vorschläge aus den häufigsten Bigrammen: Paare benachbarter Tasten, die noch keine Combo nutzt (egal
// welche Ebene, egal ob als Paar einer Drei-Tasten-Combo) und deren Tasten auf Ebene 0 eine Aktion tragen.
// Liefert höchstens min(limit, COMBO_SUGGESTION_LIMIT) Einträge { a, b, count } mit a, b = { r, c }, häufigste zuerst.
function suggestCombos(stats, config, profile, limit = COMBO_SUGGESTION_LIMIT) {
  if (!stats || !stats.bigrams || !config || !profile) return [];
  const used = new Set();
  for (const cb of Array.isArray(config.combos) ? config.combos : []) {
    const keys = comboKeys(cb).filter(isValidComboKey).map(k => `${k.r}_${k.c}`);
    for (const x of keys) for (const y of keys) if (x !== y) used.add(`${x}|${y}`);
  }
  const posOf = id => { const [r, c] = id.split("_").map(Number); return { r, c }; };
  return Object.entries(stats.bigrams)
    .sort((x, y) => (y[1] - x[1]) || (x[0] < y[0] ? -1 : 1))
    .map(([key, count]) => { const [ia, ib] = key.split("|"); return { ia, ib, a: posOf(ia), b: posOf(ib), count }; })
    .filter(p => areAdjacentFingerKeys(p.a, p.b)
      && !used.has(`${p.ia}|${p.ib}`)
      && lintCellAt(config, 0, p.a.r, p.a.c).tap !== "NONE" && lintCellAt(config, 0, p.b.r, p.b.c).tap !== "NONE")
    .slice(0, Math.min(limit, COMBO_SUGGESTION_LIMIT))
    .map(p => ({ a: p.a, b: p.b, count: p.count }));
}

// Alt-Repeat-Paare aus den häufigsten Folgen eines Fingers: je Folge a|b die Richtungen a → b und b → a, damit die
// Alt-Repeat-Taste (eines anderen Fingers) die zweite Taste der Folge ersetzt. Tasten kommen aus der Tap-Aktion der
// Ebene 0 (normale Taste oder Modifier, 1..255). Vorhandene Auslöser, doppelte und ungültige Richtungen entfallen,
// die Liste bleibt unter MAX_ALT_REPEATS. Ändert cfg nicht; liefert nur die neuen Einträge.
function altRepeatsFromSameFingerPairs(cfg, pairs) {
  const existing = Array.isArray(cfg && cfg.altRepeats) ? cfg.altRepeats : [];
  const taken = new Set(existing.filter(isValidAltRepeat).map(e => actionCodeToNumeric(e.key)));
  const added = [];
  const tapAt = id => {
    const [r, c] = id.split("_").map(Number);
    return isValidIndex(r, NUM_ROWS) && isValidIndex(c, NUM_COLS) ? lintCellAt(cfg, 0, r, c).tap : "NONE";
  };
  for (const p of pairs || []) {
    const a = tapAt(p.a);
    const b = tapAt(p.b);
    if (!isStandardKeyOrModifier(a) || !isStandardKeyOrModifier(b) || a === b) continue;
    for (const [key, alt] of [[a, b], [b, a]]) {
      const n = actionCodeToNumeric(key);
      if (taken.has(n) || existing.length + added.length >= MAX_ALT_REPEATS) continue;
      taken.add(n);
      added.push({ key, alt });
    }
  }
  return added;
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

// CSV-Feld: Anführungszeichen bei Trennzeichen; ein Text von mehr als einem Zeichen mit Anfang = + - @ oder Tab
// bekommt ein ', damit eine Tabellenkalkulation das Feld nicht als Formel liest (ein einzelnes Zeichen bleibt)
function heatmapCsvField(value) {
  let text = String(value === undefined || value === null ? "" : value).replace(/[\r\n]+/g, " ");
  if (text.length > 1 && /^[=+\-@\t]/.test(text)) text = `'${text}`;
  return /[",;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// CSV der Tipp-Statistik: eine Zeile je gezählter Taste. heatmapData: [{ side, stats }], config: { <Hälfte>: Config }
// (nur für das Label der Ebene 0). Spalten: half,row,column,label,total,layer_0..layer_7,corrections. Die Datei hat
// nur Zähler: keinen Text, keine Zeit eines Anschlags und keine Folge von Tasten (kein Bigramm, keine
// Same-Finger-Paare). Ungültige oder leere Eingabe gibt null zurück; Zeilenende ist CRLF (RFC 4180).
function buildHeatmapCsv(heatmapData, config) {
  if (!Array.isArray(heatmapData) || !heatmapData.length) return null;
  const header = ["half", "row", "column", "layer_0_label", "total"];
  for (let l = 0; l < NUM_LAYERS; l++) header.push(`layer_${l}`);
  header.push("corrections");
  const rows = [];
  for (const entry of heatmapData) {
    const stats = entry && entry.stats;
    if (!entry || typeof entry.side !== "string" || !stats || typeof stats.counts !== "object" || stats.counts === null
      || !Array.isArray(stats.layerCounts)) return null;
    const layer0 = config && config[entry.side] && Array.isArray(config[entry.side].layers) ? config[entry.side].layers[0] : null;
    const corrections = stats.corrections && typeof stats.corrections === "object" ? stats.corrections : {};
    const ids = new Set([...Object.keys(stats.counts), ...Object.keys(corrections)]);
    const positions = [];
    for (const id of ids) {
      const m = /^(\d+)_(\d+)$/.exec(id);
      if (!m) continue;
      const r = Number(m[1]), c = Number(m[2]);
      if (!isValidIndex(r, NUM_ROWS) || !isValidIndex(c, NUM_COLS)) continue;
      positions.push({ id, r, c });
    }
    positions.sort((a, b) => (a.r - b.r) || (a.c - b.c));
    for (const { id, r, c } of positions) {
      const cell = layer0 && layer0[r] ? layer0[r][c] : null;
      const label = cell && typeof cell.label === "string" ? cell.label : "";
      const num = n => (Number.isSafeInteger(n) && n > 0 ? n : 0);
      const fields = [entry.side, r, c, label, num(stats.counts[id])];
      for (let l = 0; l < NUM_LAYERS; l++) fields.push(num(stats.layerCounts[l] && stats.layerCounts[l][id]));
      fields.push(num(corrections[id]));
      rows.push(fields.map(heatmapCsvField).join(","));
    }
  }
  return [header.join(","), ...rows].join("\r\n") + "\r\n";
}

// Rolle einer Aktion für recordKeyPress: Backspace, ohne Zeichen (keine Belegung, Modifier, Ebenen- und
// One-Shot-Tasten) oder getippt
function keyPressRole(tap) {
  if (tap === "KEY_BACKSPACE") return "backspace";
  const n = actionCodeToNumeric(tap);
  const silent = n === 0 || (n >= 0x80 && n <= 0x87) || (n >= 0x100 && n <= 0x119) || (n >= 0x160 && n <= 0x167)
    || (n >= 0x180 && n <= 0x190);
  return silent ? "silent" : "typed";
}

// Korrekturanteil je Taste: Korrekturen / Anschläge (alle Ebenen); Tasten unter CORRECTION_MIN_PRESSES
// Anschlägen fehlen. Liefert { shares: { "r_c": anteil }, max }.
function correctionShares(stats) {
  const shares = {};
  let max = 0;
  for (const [id, n] of Object.entries(stats.corrections)) {
    const presses = stats.counts[id] || 0;
    if (presses < CORRECTION_MIN_PRESSES) continue;
    const share = Math.min(1, n / presses);
    shares[id] = share;
    if (share > max) max = share;
  }
  return { shares, max };
}

// Die Tasten mit dem höchsten Korrekturanteil: [{ id, corrections, presses, share }], absteigend, bei Gleichstand nach Schlüssel
function topCorrectedKeys(stats, limit = CORRECTION_TOP) {
  return Object.entries(correctionShares(stats).shares)
    .sort((x, y) => (y[1] - x[1]) || (x[0] < y[0] ? -1 : 1))
    .slice(0, limit)
    .map(([id, share]) => ({ id, corrections: stats.corrections[id], presses: stats.counts[id], share }));
}

// =============================================================================
// Layout-Diff vor dem Sync (lokale Belegung gegen GET_CONFIG des Geräts)
// =============================================================================
// GET_CONFIG liefert Ebenen-Namen, Tasten (Tap, Halten, Doppel-Tipp), Combos, Tastenpaare und Makros.
// Firmware vor Stand 5 sendet die drei Listen nicht (Zustand "absent"); fehlt oder bricht eine Zeile (Zustand
// "incomplete"), vergleicht der Diff sie ebenfalls nicht. Die Listen kommen in kurzen Blöcken mit Offset.

function createDeviceSnapshot() {
  return {
    names: null, tap: [], hold: [], dtap: [], term: [], flavor: [],
    counts: { combos: null, pairs: null, macros: null, overrides: null, leader: null, altrep: null }, combos: [], pairs: [], macros: [], overrides: [], leader: [], altrep: [], macroLens: [], macroRep: [], listsBroken: false,
    // DEVICE_INFO der Hälfte (nur beim Laden der kompletten Config gelesen), sonst null
    info: null
  };
}

const COMBO_BEHAVIOR_CODES = { KEY_PRESS: 0, MODIFIER_HOLD: 1, LAYER_TOGGLE: 2 };

const LIST_COUNT_MAX = { "COMBO_COUNT:": MAX_COMBOS, "PAIR_COUNT:": MAX_KEY_PAIRS, "MACRO_COUNT:": MAX_MACROS, "OVERRIDE_COUNT:": MAX_KEY_OVERRIDES, "LEADER_COUNT:": MAX_LEADER_SEQS, "ALTREP_COUNT:": MAX_ALT_REPEATS };
const LIST_DATA_PREFIXES = ["COMBO_DATA:", "PAIR_DATA:", "MACRO_DATA:", "OVERRIDE_DATA:", "LEADER_DATA:", "ALTREP_DATA:"];

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
      const kind = { "COMBO_COUNT:": "combos", "PAIR_COUNT:": "pairs", "MACRO_COUNT:": "macros", "OVERRIDE_COUNT:": "overrides", "LEADER_COUNT:": "leader", "ALTREP_COUNT:": "altrep" }[prefix];
      snapshot.counts[kind] = n;
      snapshot[kind] = [];
      if (kind === "macros") { snapshot.macroLens = []; snapshot.macroRep = []; }
      return true;
    }
    const data = JSON.parse(body);
    if (!data || typeof data !== "object") return fail();
    if (prefix === "MACRO_DATA:") {
      const count = snapshot.counts.macros;
      if (count === null || !isValidIndex(data.i, count) || !Number.isInteger(data.n) || data.n < 0 || data.n > MAX_MACRO_STEPS ||
          !Array.isArray(data.s) || !data.s.every(e => nums(e, 3, t => t[0] >= 1 && t[0] <= 4)) ||
          (data.r !== undefined && data.r !== 1)) return fail();
      if (snapshot.macroLens[data.i] === undefined) { snapshot.macroLens[data.i] = data.n; snapshot.macros[data.i] = []; snapshot.macroRep[data.i] = data.r === 1; }
      const steps = snapshot.macros[data.i];
      if (snapshot.macroLens[data.i] !== data.n || data.o !== steps.length || steps.length + data.s.length > data.n) return fail();
      steps.push(...data.s);
      return true;
    }
    const isCombo = prefix === "COMBO_DATA:";
    const isOverride = prefix === "OVERRIDE_DATA:";
    const isLeader = prefix === "LEADER_DATA:";
    const isAltRepeat = prefix === "ALTREP_DATA:";
    const kind = isCombo ? "combos" : isOverride ? "overrides" : isLeader ? "leader" : isAltRepeat ? "altrep" : "pairs";
    const count = snapshot.counts[kind];
    const list = snapshot[kind];
    if (count === null || data.o !== list.length || !Array.isArray(data.e) || list.length + data.e.length > count ||
        !data.e.every(e => isCombo ? (nums(e, 6, t => t[4] <= 2) || nums(e, 7, t => t[4] <= 2 && isValidComboLayerMask(t[6])) ||
            nums(e, 10, t => t[4] <= 2 && isValidComboLayerMask(t[6]) && isDeviceComboThirdAndWindow(t)))
          : isOverride ? (nums(e, 3, t => t[0] >= 1 && t[0] <= 15) || nums(e, 4, t => t[0] >= 1 && t[0] <= 15 && isValidComboLayerMask(t[3])))
          : isLeader ? nums(e, 5, isDeviceLeaderTuple) : isAltRepeat ? nums(e, 2, t => t[0] >= 1 && t[0] <= 0xFF && t[1] >= 1 && t[1] <= 0xFF) : nums(e, 2))) return fail();
    // Firmware vor der Ebenenmaske sendet 6 Werte je Combo (alle Ebenen), vor Stand 24 sieben (zwei Tasten, globales
    // Fenster). Alle Einträge werden auf zehn Werte ergänzt: ..., Maske, r3, c3, Fenster.
    list.push(...(isCombo ? data.e.map(e => [...e, ...[COMBO_ALL_LAYERS, COMBO_NO_KEY, COMBO_NO_KEY, 0].slice(e.length - 6)])
      : isOverride ? data.e.map(e => e.length === 3 ? [...e, COMBO_ALL_LAYERS] : e) : data.e));
  } catch (_) { return fail(); }
  return true;
}

// Leader-Eintrag vom Gerät: [Aktion, k1..k4]; Tasten 1..255 ohne Modifier, nach der ersten leeren Stelle nur Nullen
function isDeviceLeaderTuple(t) {
  const code = n => (n >= 0x80 && n <= 0x87) ? false : (n >= 1 && n <= 0xFF);
  const actionOk = code(t[0]) || (t[0] >= ACT_KEY_PAIR_BASE && t[0] < ACT_KEY_PAIR_BASE + MAX_KEY_PAIRS) ||
    (t[0] >= ACT_MACRO_BASE && t[0] < ACT_MACRO_BASE + MAX_MACROS);
  if (!actionOk || !code(t[1])) return false;
  let ended = false;
  for (let i = 2; i <= LEADER_MAX_KEYS; i++) {
    if (t[i] === 0) { ended = true; continue; }
    if (ended || !code(t[i])) return false;
  }
  return true;
}

// "absent": das Gerät sendet keine Listen (Firmware vor Stand 5). "complete": alle Listen vollständig gelesen.
// "incomplete": Listen begonnen, aber eine Zeile fehlt oder war ungültig.
// Dritte Taste und Fenster eines Combo-Eintrags vom Gerät: keine Taste (255, 255) oder eine Taste in der Matrix, Fenster 0..500
function isDeviceComboThirdAndWindow(t) {
  const none = t[7] === COMBO_NO_KEY && t[8] === COMBO_NO_KEY;
  return (none || (t[7] < NUM_ROWS && t[8] < NUM_COLS)) && t[9] <= COMBO_WINDOW_MAX;
}

function snapshotListsState(snapshot) {
  if (!snapshot) return "absent";
  const c = snapshot.counts;
  const none = c.combos === null && c.pairs === null && c.macros === null && c.overrides === null && c.leader === null && c.altrep === null;
  if (none && !snapshot.listsBroken) return "absent";
  if (snapshot.listsBroken || c.combos === null || c.pairs === null || c.macros === null) return "incomplete";
  if (snapshot.combos.length !== c.combos || snapshot.pairs.length !== c.pairs) return "incomplete";
  // Die Überschreibungen sendet nur der Master ab Stand 7: ohne Zähler gibt es nichts zu vergleichen,
  // ein begonnener Block muss vollständig sein
  if (c.overrides !== null && snapshot.overrides.length !== c.overrides) return "incomplete";
  // Die Leader-Sequenzen senden beide Hälften ab Stand 26; Firmware davor sendet keinen Zähler
  if (c.leader !== null && snapshot.leader.length !== c.leader) return "incomplete";
  // Die Alt-Repeat-Paare senden beide Hälften ab Stand 34
  if (c.altrep !== null && snapshot.altrep.length !== c.altrep) return "incomplete";
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
  return (cfg.combos || []).slice(0, MAX_COMBOS).map(cb => {
    const third = comboThirdKey(cb);
    return [cb.key1.r, cb.key1.c, cb.key2.r, cb.key2.c, COMBO_BEHAVIOR_CODES[cb.behavior] ?? 0, actionCodeToNumeric(cb.action),
      comboLayerMask(cb), third ? third.r : COMBO_NO_KEY, third ? third.c : COMBO_NO_KEY, comboWindowMs(cb)];
  });
}

function localPairTuples(cfg) {
  return (cfg.keyPairs || []).slice(0, MAX_KEY_PAIRS).map(p => [actionCodeToNumeric(p.first), actionCodeToNumeric(p.second)]);
}

function localOverrideTuples(cfg) {
  return (cfg.keyOverrides || []).slice(0, MAX_KEY_OVERRIDES).map(o => [keyOverrideModsValue(o.mods), actionCodeToNumeric(o.key), actionCodeToNumeric(o.replacement), keyOverrideLayerMask(o)]);
}

function localAltRepeatTuples(cfg) {
  return (cfg.altRepeats || []).slice(0, MAX_ALT_REPEATS).map(e => [actionCodeToNumeric(e.key), actionCodeToNumeric(e.alt)]);
}

function describeAltRepeatTuple(t) {
  return `${findDefinitionByCode(t[0]).label} → ${findDefinitionByCode(t[1]).label}`;
}

function localLeaderTuples(cfg) {
  return (cfg.leaderSequences || []).slice(0, MAX_LEADER_SEQS).map(q => [actionCodeToNumeric(q.action), ...leaderKeyNumbers(q.keys)]);
}

function localMacroSteps(cfg) {
  return (cfg.macros || []).slice(0, MAX_MACROS).map(m => m.steps.map(macroStepTuple));
}

const MACRO_STEP_NAMES = { 1: "Tippen", 2: "Drücken", 3: "Loslassen", 4: "Pause" };

function describeComboTuple(t) {
  const behavior = ["", " (Modifier halten)", " (Ebene umschalten)"][t[4]] || "";
  const mask = t[6] === undefined ? COMBO_ALL_LAYERS : t[6];
  const layers = mask === COMBO_ALL_LAYERS ? "" : ` (${comboMaskLayers(mask).length === 1 ? "Ebene" : "Ebenen"} ${comboMaskLayers(mask).join(", ")})`;
  const third = t[7] !== undefined && t[7] !== COMBO_NO_KEY && t[8] !== COMBO_NO_KEY ? ` + R${t[7]}C${t[8]}` : "";
  const window = t[9] ? ` (Fenster ${t[9]} ms)` : "";
  return `R${t[0]}C${t[1]} + R${t[2]}C${t[3]}${third} → ${findDefinitionByCode(t[5]).label}${behavior}${layers}${window}`;
}

function describePairTuple(t) {
  return `${findDefinitionByCode(t[0]).label} + ${findDefinitionByCode(t[1]).label}`;
}

function describeOverrideTuple(t) {
  const mods = Object.keys(KEY_OVERRIDE_MODS).filter(m => t[0] & KEY_OVERRIDE_MODS[m]).map(m => KEY_OVERRIDE_MOD_LABELS[m]).join(" + ");
  return `${mods} + ${findDefinitionByCode(t[1]).label} → ${findDefinitionByCode(t[2]).label}${keyOverrideLayerSuffix(t[3])}`;
}

function describeLeaderTuple(t) {
  const keys = t.slice(1).filter(n => n > 0).map(n => findDefinitionByCode(n).label).join(", ");
  return `${keys} → ${findDefinitionByCode(t[0]).label}`;
}

function describeMacroSteps(steps) {
  if (!steps) return "—";
  if (steps.length === 0) return "leer";
  return steps.map(st => st[0] === 4 ? `Pause ${st[2]} ms` : `${MACRO_STEP_NAMES[st[0]] || "?"} ${findDefinitionByCode(st[1]).label}`).join(", ");
}

// Speichert eine Matrix aus GET_CONFIG als Zahlencodes. Gibt true zurück, wenn übernommen.
function captureMatrixData(snapshot, field, data) {
  if (!snapshot || !["tap", "hold", "dtap", "term", "flavor"].includes(field)) return false;
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
        // Eigener Tapping-Term: nur vergleichen, wenn das Gerät TERM_DATA meldet (Firmware davor kennt ihn nicht)
        if (snapshot.term && snapshot.term[l]) {
          local.tapTerm = keyTapTerm((layer[r] || [])[c]);
          device.tapTerm = device.holdCode || device.dtapCode ? (snapshot.term[l][r][c] || 0) : 0;
        }
        // Eigene Hold-Tap-Variante: ebenso nur mit FLAVOR_DATA (Firmware davor kennt sie nicht)
        if (snapshot.flavor && snapshot.flavor[l]) {
          local.holdFlavor = keyHoldFlavor((layer[r] || [])[c]);
          device.holdFlavor = device.holdCode || device.dtapCode ? (snapshot.flavor[l][r][c] || 0) : 0;
        }
        if (local.tapCode !== device.tapCode || local.holdCode !== device.holdCode || local.dtapCode !== device.dtapCode ||
            (local.tapTerm || 0) !== (device.tapTerm || 0) || (local.holdFlavor || 0) !== (device.holdFlavor || 0)) {
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

// Banner "Gerät weicht ab" nach dem Verbinden: zeigt sich nur ohne vorgemerkte Änderung der Hälfte und bei
// mindestens einem Unterschied (Taste, Ebenen-Name oder Liste). Rückgabe { show, count }; startet keinen Sync.
function staleLayoutState(cfg, snapshot, profile, pendingCount) {
  if (pendingCount > 0 || !snapshot || !isDeviceSnapshotComplete(snapshot)) return { show: false, count: 0 };
  const diff = diffKeymap(cfg, snapshot, profile);
  const lists = diff.lists || {};
  const listCount = ["combos", "pairs", "overrides", "leader", "altrep", "macros"]
    .reduce((n, key) => n + (lists[key] || []).length, 0);
  const count = diff.keys.length + diff.names.length + listCount;
  return { show: count > 0, count };
}

// Unterschiede bei Combos, Tastenpaaren und Makros, jeweils je Index in der Reihenfolge der Liste (die Firmware
// prüft Combos in dieser Reihenfolge). Zeilen { where, device, local }. state = "absent" oder "incomplete":
// nichts wird verglichen.
function diffLists(cfg, snapshot) {
  const state = snapshotListsState(snapshot);
  const out = { known: state === "complete", state, combos: [], pairs: [], overrides: [], leader: [], altrep: [], macros: [] };
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
  // Nur wenn das Gerät Leader-Sequenzen meldet (ab Stand 26)
  if (snapshot.counts.leader !== null) compare(out.leader, "Leader", snapshot.leader, localLeaderTuples(cfg), describeLeaderTuple);
  // Nur wenn das Gerät Alt-Repeat-Paare meldet (ab Stand 34)
  if (snapshot.counts.altrep !== null) compare(out.altrep, "Alt-Repeat", snapshot.altrep, localAltRepeatTuples(cfg), describeAltRepeatTuple);
  // Schritte und Wiederholen-Flag zusammen vergleichen (Stand 39)
  const deviceMacros = Array.from({ length: snapshot.counts.macros }, (_, i) => snapshot.macros[i] && { steps: snapshot.macros[i], repeat: snapshot.macroRep[i] === true });
  const localMacros = localMacroSteps(cfg).map((steps, i) => ({ steps, repeat: cfg.macros[i].repeat === true }));
  compare(out.macros, "Makro", deviceMacros, localMacros, m => (m.repeat ? "↻ " : "") + describeMacroSteps(m.steps));
  return out;
}

// Einstellungen aus DEVICE_INFO; fehlende Felder behalten den Wert aus base (Firmware ohne das Feld)
function settingsFromDeviceInfo(info, base) {
  const out = { ...(base || {}) };
  if (!info || typeof info !== "object") return out;
  const map = {
    standby_timeout: "standbyTimeoutMinutes", sleep_timeout: "sleepTimeoutMinutes", debounce_ms: "debounceMs",
    combo_timeout_ms: "comboTimeoutMs", tapping_term_ms: "tappingTermMs", hold_tap_mode: "holdTapMode",
    quick_tap_ms: "quickTapMs", qt: "quickTapMs", leader_timeout_ms: "leaderTimeoutMs", ld: "leaderTimeoutMs", lt: "layerTimeoutMs", require_prior_idle_ms: "requirePriorIdleMs", pi: "requirePriorIdleMs", chordal_hold: "chordalHold", rt: "retroTap", nwl: "numWordLayer", bl: "bootLayer", ot: "oneShotTimeoutMs",
    as: "autoShift", at: "autoShiftMs"
  };
  for (const [key, field] of Object.entries(map)) if (info[key] !== undefined) out[field] = info[key];
  if (Array.isArray(info.tri_layer)) {
    out.triLayers = info.tri_layer.map(r => Array.isArray(r) ? { a: r[0], b: r[1], target: r[2] } : null);
  }
  if (info.caps_led === 0 || info.caps_led === 1) out.capsLed = info.caps_led;
  const name = deviceNameFromInfo(info);
  if (name) out.deviceName = name;
  return out;
}

// Gerätename aus DEVICE_INFO; im Config-Modus meldet das Gerät den Config-Namen ("Dactyl Config"):
// config_mode entscheidet, sonst der Name. Leer, wenn kein echter Gerätename vorliegt.
function deviceNameFromInfo(info) {
  if (!info || typeof info.name !== "string" || !info.name) return "";
  const inConfigMode = info.config_mode !== undefined ? !!info.config_mode : info.name.includes("Config");
  return inConfigMode ? "" : info.name;
}

// Unterschiede der Einstellungen (Gerät gegen lokal) als Zeilen { where, device, local } für den Diff-Dialog
function diffSettings(deviceSettings, localSettings) {
  const rows = [];
  const text = v => typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
  const keys = new Set([...Object.keys(deviceSettings || {}), ...Object.keys(localSettings || {})]);
  for (const key of keys) {
    const d = (deviceSettings || {})[key];
    const l = (localSettings || {})[key];
    if (JSON.stringify(d) !== JSON.stringify(l)) rows.push({ where: `Einstellung ${key}:`, device: text(d), local: text(l) });
  }
  return rows;
}

// Baut aus dem GET_CONFIG-Snapshot einer Hälfte eine vollständige Config (Tasten, Ebenen-Namen, Combos,
// Tastenpaare, Überschreibungen, Makros und Einstellungen aus DEVICE_INFO). baseCfg liefert nur Einstellungen,
// die das Gerät nicht meldet. Rückgabe: { config } oder { error }; bei jedem Fehler entsteht keine Config.
function buildConfigFromSnapshot(snapshot, baseCfg, profile) {
  if (!isDeviceSnapshotComplete(snapshot)) return { error: "Die Belegung kam unvollständig an." };
  const state = snapshotListsState(snapshot);
  if (state === "absent") return { error: "Die Firmware dieser Hälfte sendet keine Combos, Tastenpaare und Makros: Hälfte flashen." };
  if (state !== "complete") return { error: "Combos, Tastenpaare oder Makros kamen unvollständig oder ungültig an." };
  if (!snapshot.info) return { error: "Die Geräte-Informationen (DEVICE_INFO) fehlen." };
  const tapOf = code => findDefinitionByCode(code).tap;
  const layers = Array.from({ length: NUM_LAYERS }, () => transparentLayer());
  for (let l = 0; l < NUM_LAYERS; l++) {
    for (const field of ["tap", "hold", "dtap", "term", "flavor"]) {
      if ((field === "term" || field === "flavor") && !snapshot[field][l]) continue;
      applyMatrixData(layers, field, { l, k: snapshot[field][l] });
    }
  }
  const stepNames = Object.fromEntries(Object.entries(MACRO_STEP_TYPES).map(([name, id]) => [id, name]));
  const layer0 = layers[0];
  const cellLabel = (r, c) => (layer0[r] && layer0[r][c] && layer0[r][c].label) || `R${r}C${c}`;
  const cfg = {
    layers,
    layerNames: snapshot.names.slice(0, NUM_LAYERS),
    combos: snapshot.combos.map((t, i) => {
      const action = tapOf(t[5]);
      const actionLabel = findDefinitionByCode(t[5]).label;
      const combo = {
        id: `combo-${i + 1}`,
        name: `${cellLabel(t[0], t[1])} + ${cellLabel(t[2], t[3])} -> ${actionLabel}`,
        key1: { r: t[0], c: t[1], label: cellLabel(t[0], t[1]) },
        key2: { r: t[2], c: t[3], label: cellLabel(t[2], t[3]) },
        behavior: COMBO_BEHAVIORS[t[4]],
        action,
        actionLabel
      };
      if (t[6] !== COMBO_ALL_LAYERS) combo.layerMask = t[6];
      return combo;
    }),
    keyPairs: snapshot.pairs.map(t => ({ first: tapOf(t[0]), second: tapOf(t[1]) })),
    // Ohne OVERRIDE_COUNT (linke Hälfte oder Master vor Stand 7) kennt das Gerät keine Überschreibungen: die lokalen bleiben
    keyOverrides: snapshot.counts.overrides === null
      ? JSON.parse(JSON.stringify((baseCfg && baseCfg.keyOverrides) || []))
      : snapshot.overrides.map(t => ({
          mods: Object.keys(KEY_OVERRIDE_MODS).filter(m => t[0] & KEY_OVERRIDE_MODS[m]), key: tapOf(t[1]), replacement: tapOf(t[2]),
          ...(t[3] !== COMBO_ALL_LAYERS ? { layerMask: t[3] } : {})
        })),
    // Ohne LEADER_COUNT (Firmware vor Stand 26) bleiben die lokalen Sequenzen
    leaderSequences: snapshot.counts.leader === null
      ? JSON.parse(JSON.stringify((baseCfg && baseCfg.leaderSequences) || []))
      : snapshot.leader.map(t => ({ keys: t.slice(1).filter(n => n > 0).map(tapOf), action: tapOf(t[0]) })),
    // Ohne ALTREP_COUNT (Firmware vor Stand 34) bleiben die lokalen Paare
    altRepeats: snapshot.counts.altrep === null
      ? JSON.parse(JSON.stringify((baseCfg && baseCfg.altRepeats) || []))
      : snapshot.altrep.map(t => ({ key: tapOf(t[0]), alt: tapOf(t[1]) })),
    macros: Array.from({ length: snapshot.counts.macros }, (_, i) => ({
      name: `Makro ${i}`,
      ...(snapshot.macroRep[i] === true ? { repeat: true } : {}),
      steps: snapshot.macros[i].map(st => st[0] === MACRO_STEP_TYPES.pause
        ? { type: "pause", ms: st[2] } : { type: stepNames[st[0]], code: tapOf(macroTupleActionNumber(st)) })
    })),
    settings: settingsFromDeviceInfo(snapshot.info, baseCfg && baseCfg.settings)
  };
  // Das Gerät speichert keine Combo-Namen: ein lokaler Combo mit gleichem Index und gleichen Werten behält Id und Namen
  const localCombos = (baseCfg && Array.isArray(baseCfg.combos)) ? baseCfg.combos : [];
  const localTuples = baseCfg ? localComboTuples(baseCfg) : [];
  cfg.combos.forEach((cb, i) => {
    const local = localCombos[i];
    if (local && JSON.stringify(localTuples[i]) === JSON.stringify(snapshot.combos[i])) {
      cb.id = local.id; cb.name = local.name; cb.key1 = { ...cb.key1, label: local.key1.label }; cb.key2 = { ...cb.key2, label: local.key2.label };
      if (local.actionLabel) cb.actionLabel = local.actionLabel;
    }
  });
  // Das Gerät speichert keine Makro-Namen: der lokale Name bleibt, wenn das lokale Makro mit gleichem Index dieselben Schritte hat
  const localMacros = (baseCfg && Array.isArray(baseCfg.macros)) ? baseCfg.macros : [];
  cfg.macros.forEach((m, i) => {
    const local = localMacros[i];
    if (local && isValidMacro(local) && JSON.stringify(local.steps.map(normalizeMacroStep)) === JSON.stringify(m.steps)) {
      m.name = local.name;
    }
  });
  try {
    validateConfigShape(cfg, profile);
    return { config: normalizeConfig(cfg, profile) };
  } catch (e) {
    return { error: `Die Gerätedaten sind ungültig: ${e.message}` };
  }
}

// Kurztext einer Tastenbelegung, z. B. "A · Halten: LEFT_CTRL · 2×: B"
function describeKeyActions(actions) {
  if (!actions.tapCode) return "—";
  let text = findDefinitionByCode(actions.tapCode).label;
  if (actions.holdCode) text += ` · Halten: ${findDefinitionByCode(actions.holdCode).label}`;
  if (actions.dtapCode) text += ` · 2×: ${findDefinitionByCode(actions.dtapCode).label}`;
  if (actions.tapTerm) text += ` · Term: ${actions.tapTerm} ms`;
  if (actions.holdFlavor) text += ` · Variante: ${HOLD_FLAVOR_LABELS[actions.holdFlavor]}`;
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

// Sendet die Aktion den Tastencode key? Direkt, über ein Tastenpaar PAIR_n oder über einen Makro-Schritt
// Umlaut-Aktionen senden die tote Taste Alt + u (ß: Alt + s) und danach den Vokal
const LINT_UMLAUT_KEYS = {
  UMLAUT_AE: ["KEY_U", "KEY_A"], UMLAUT_OE: ["KEY_U", "KEY_O"], UMLAUT_UE: ["KEY_U", "KEY_U"],
  UMLAUT_AE_UPPER: ["KEY_U", "KEY_A"], UMLAUT_OE_UPPER: ["KEY_U", "KEY_O"], UMLAUT_UE_UPPER: ["KEY_U", "KEY_U"],
  UMLAUT_SZ: ["KEY_S"]
};

// Zwei Schreibweisen derselben Taste ("a" und KEY_A) gelten als gleich
function lintSameKey(a, b) {
  return typeof a === "string" && typeof b === "string" && (a === b || (actionCodeToNumeric(a) !== 0 && actionCodeToNumeric(a) === actionCodeToNumeric(b)));
}

function lintActionSends(cfg, action, key) {
  if (lintSameKey(action, key)) return true;
  if (LINT_UMLAUT_KEYS[action]) return LINT_UMLAUT_KEYS[action].some(k => lintSameKey(k, key));
  const pairIdx = pairIndexFromCode(action);
  if (pairIdx >= 0) {
    const pair = Array.isArray(cfg.keyPairs) ? cfg.keyPairs[pairIdx] : null;
    return !!pair && (lintSameKey(pair.first, key) || lintSameKey(pair.second, key));
  }
  const macroIdx = macroIndexFromCode(action);
  if (macroIdx >= 0) {
    const macro = Array.isArray(cfg.macros) ? cfg.macros[macroIdx] : null;
    return !!macro && Array.isArray(macro.steps) && macro.steps.some(st => st && st.type !== "pause" && lintSameKey(st.code, key));
  }
  return false;
}

// Eine Überschreibung (Liste des Masters, gilt für beide Hälften) kann nur auslösen, wenn auf einer Ebene ihrer
// Maske eine Taste einer Hälfte oder eine Combo den Code sendet: als Tap, Halten, Doppel-Tipp, Tastenpaar oder Makro
function lintOverrideKeyMapped(configs, sides, profiles, o) {
  const mask = keyOverrideLayerMask(o);
  for (const side of sides) {
    const cfg = configs[side];
    for (let l = 0; l < NUM_LAYERS; l++) {
      if (!((mask >> l) & 1)) continue;
      for (let r = 0; r < NUM_ROWS; r++) {
        for (let c = 0; c < NUM_COLS; c++) {
          if (isWiredSwitch(r, c, profiles[side]) && lintEffectiveActions(cfg, l, r, c).some(a => lintActionSends(cfg, a, o.key))) return true;
        }
      }
    }
    const combos = Array.isArray(cfg.combos) ? cfg.combos : [];
    if (combos.some(cb => lintComboCanFire(cb, profiles[side]) && (comboLayerMask(cb) & mask) !== 0 &&
      typeof cb.action === "string" && lintActionSends(cfg, cb.action, o.key))) return true;
    const seqs = Array.isArray(cfg.leaderSequences) ? cfg.leaderSequences : [];
    if (seqs.some(q => q && typeof q.action === "string" && lintActionSends(cfg, q.action, o.key))) return true;
  }
  return false;
}

// Alle Aktionen, die diese aufgelöste Taste auslösen kann
function lintEffectiveActions(cfg, layer, r, c) {
  const a = lintResolvedCell(cfg, layer, r, c);
  return [a.tap, a.hold, a.dtap].filter(x => x !== "NONE");
}

// MO_n / TG_n / OSL_n / LAYER_UP / LAYER_DOWN / LAYER_LOCK (auch als Firmware-Name ACT_...); sonst null
function lintLayerAction(code) {
  const name = String(code || "").replace(/^ACT_/, "");
  const m = /^(MO|TG|OSL)_([0-7])$/.exec(name);
  if (m) return { kind: m[1], layer: Number(m[2]) };
  if (name === "LAYER_UP" || name === "LAYER_DOWN" || name === "LAYER_LOCK") return { kind: name };
  return null;
}

// Eine Combo kann nur auslösen, wenn beide Tasten an der Hälfte existieren
function lintComboCanFire(cb, profile) {
  return !!cb && typeof cb === "object" && !!cb.key1 && !!cb.key2 &&
    comboKeys(cb).every(k => isWiredSwitch(k.r, k.c, profile));
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

// Fundstellen einer Aktion in der Config einer Hälfte (reine Funktion, ohne DOM). Ein Treffer ist eine Taste
// (layer, r, c, slot tap/hold/dtap), eine Combo, ein Tastenpaar (member first/second), eine Überschreibung
// (role key/replacement) oder ein Makro-Schritt. Transparente Tasten ("NONE", "", "0") zählen nie.
// side wird unverändert in jeden Treffer übernommen (null = unbekannt).
function findActionUsages(config, code, side = null) {
  const hits = [];
  if (!config || typeof config !== "object" || typeof code !== "string" || code === "" || code === "0" || code === "NONE") return hits;
  const layers = Array.isArray(config.layers) ? config.layers : [];
  layers.forEach((layer, l) => (Array.isArray(layer) ? layer : []).forEach((row, r) => (Array.isArray(row) ? row : []).forEach((_, c) => {
    const a = lintCellActions(row[c]);
    for (const slot of ["tap", "hold", "dtap"]) {
      // Alte Configs speichern Modifier-Aktionen für Halten und Doppel-Tipp als MOD_*; sie zählen wie die KEY_*-Modifier
      const value = slot !== "tap" ? normalizeHoldCode(a[slot]) : a[slot];
      if (value === code) hits.push({ kind: "key", side, layer: l, r, c, slot });
    }
  })));
  (Array.isArray(config.combos) ? config.combos : []).forEach((cb, index) => {
    if (cb && cb.action === code) hits.push({ kind: "combo", side, index, id: cb.id, name: cb.name || "" });
  });
  (Array.isArray(config.keyPairs) ? config.keyPairs : []).forEach((p, index) => {
    if (!p) return;
    for (const member of ["first", "second"]) {
      if (p[member] === code) hits.push({ kind: "pair", side, index, member });
    }
  });
  (Array.isArray(config.keyOverrides) ? config.keyOverrides : []).forEach((o, index) => {
    if (!o) return;
    for (const role of ["key", "replacement"]) {
      if (o[role] === code) hits.push({ kind: "override", side, index, role });
    }
  });
  (Array.isArray(config.leaderSequences) ? config.leaderSequences : []).forEach((q, index) => {
    if (!q) return;
    if (Array.isArray(q.keys) && q.keys.includes(code)) hits.push({ kind: "leader", side, index, role: "key" });
    if (q.action === code) hits.push({ kind: "leader", side, index, role: "action" });
  });
  (Array.isArray(config.macros) ? config.macros : []).forEach((m, macro) => {
    (m && Array.isArray(m.steps) ? m.steps : []).forEach((st, step) => {
      if (st && st.type !== "pause" && st.code === code) hits.push({ kind: "macro", side, macro, step, type: st.type });
    });
  });
  return hits;
}

// Wie findActionUsages für mehrere Hälften: configs = { [side]: config }; Treffer in der Reihenfolge von sides
// CHAR_PAIR_<i> (Zeichen mit Tastenpaar) steht in keiner Config: es wird je Hälfte zum gleichen gespeicherten
// Paar PAIR_<n> aufgelöst. Ohne gespeichertes Paar gibt es keinen Treffer.
function findActionUsagesForSides(configs, code, sides = Object.keys(configs || {})) {
  const charIdx = charPairIndexFromCode(code);
  return sides.flatMap(side => {
    const config = configs && configs[side];
    if (charIdx < 0) return findActionUsages(config, code, side);
    // Dasselbe Paar kann mehrfach gespeichert sein: jeder Index zählt
    const target = actionCodeToNumeric(DE_MAC_CHARS[charIdx].pair.first) + "," + actionCodeToNumeric(DE_MAC_CHARS[charIdx].pair.second);
    return ((config && config.keyPairs) || []).flatMap((p, n) => (p && actionCodeToNumeric(p.first) + "," + actionCodeToNumeric(p.second) === target
      ? findActionUsages(config, `PAIR_${n}`, side) : []));
  });
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
  // Wie die Firmware: Ebene = Aktionscode & 7 (0 löscht alle eingerasteten Ebenen). Eine Combo gilt nur auf den Ebenen
  // ihrer Maske (Standard: alle).
  const comboToggles = [];   // { target, mask }
  for (const side of sides) {
    for (const cb of Array.isArray(configs[side].combos) ? configs[side].combos : []) {
      // Eine Combo auf einer fehlenden Taste löst nie aus und ist kein Weg; ein Nicht-String als Aktion (Import) auch nicht
      if (cb && cb.behavior === "LAYER_TOGGLE" && typeof cb.action === "string" && lintComboCanFire(cb, profiles[side])) {
        // Auch die Firmware-Schreibweise ACT_TG_n (wie bei den Tasten); actionCodeToNumeric kennt sie nicht
        const toggle = lintLayerAction(cb.action);
        comboToggles.push({
          target: toggle && toggle.layer !== undefined ? toggle.layer : actionCodeToNumeric(cb.action) & 7,
          mask: comboLayerMask(cb)
        });
      }
    }
  }
  // Erreichbare Ebenen mit den Tri-Layer-Regeln aus triRules (jede Regel gilt nur auf der Hälfte, die sie hält)
  const computeReach = triRules => {
    const reach = new Set([0]);
    const lock = new Set();   // Ebenen, die sich einrasten lassen (TG, LAYER_UP/DOWN, Combo)
    for (let grew = true; grew;) {
      grew = false;
      for (const l of [...reach]) {
        // Einrast-Combos, die auf Ebene l gelten
        for (const { target, mask } of comboToggles) {
          if (target > 0 && ((mask >> l) & 1)) {
            lock.add(target);
            if (!reach.has(target)) { reach.add(target); grew = true; }
          }
        }
        for (const a of onLayer[l]) {
          let target = -1;
          let locks = false;
          // OSL wirkt wie MO_n, nur für den nächsten Tastendruck: die Ebene ist erreichbar, rastet aber nicht ein
          if (a.kind === "MO" || a.kind === "OSL") target = a.layer;
          else if (a.kind === "TG") { target = a.layer; locks = true; }
          else if (a.kind === "LAYER_UP") { target = (l + 1) % NUM_LAYERS; locks = true; }
          else if (a.kind === "LAYER_DOWN") { target = (l + NUM_LAYERS - 1) % NUM_LAYERS; locks = true; }
          // LAYER_LOCK auf Ebene l rastet die gehaltene MO-Ebene ein (Ebene l, wenn sie per MO aktiv ist)
          else if (a.kind === "LAYER_LOCK" && l > 0) { target = l; locks = true; }
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
    // Rückweg per Combo: eine Combo auf Ebene n, die n oder alle Ebenen (0) umschaltet
    !comboToggles.some(t => (t.target === n || t.target === 0) && ((t.mask >> n) & 1)) &&
    !onLayer[n].some(a => (a.kind === "TG" && (a.layer === n || a.layer === 0)) || a.kind === "LAYER_UP" || a.kind === "LAYER_DOWN" || a.kind === "LAYER_LOCK"));
  if (trapped.length) {
    add("warn", null, "layer-trap",
      `${lintLayerName(trapped)} ${trapped.length === 1 ? "lässt" : "lassen"} sich einrasten, aber dort gibt es keine Taste zurück ` +
      "(TG der Ebene, TG_0, LAYER_UP, LAYER_DOWN, LAYER_LOCK oder eine Combo \"Layer umschalten\").");
  }

  // 3. Je Hälfte: ungenutzte Tastenpaare und Makros, doppelte Combos, Combo-Tasten mit Halte- oder Doppel-Tipp-Aktion
  for (const side of sides) {
    const cfg = configs[side];
    const combos = Array.isArray(cfg.combos) ? cfg.combos : [];
    (Array.isArray(cfg.keyPairs) ? cfg.keyPairs : []).forEach((pair, i) => {
      if (isKeyPairUsed(cfg.layers, i) || combos.some(cb => cb && cb.action === `PAIR_${i}`) || isLeaderActionUsed(cfg.leaderSequences, `PAIR_${i}`)) return;
      add("info", side, "pair-unused", `Tastenpaar ${i} (${keyPairLabel(pair, labelFor)}) wird nirgends verwendet.`);
    });
    (Array.isArray(cfg.macros) ? cfg.macros : []).forEach((macro, i) => {
      if (isMacroUsed(cfg.layers, i, cfg.leaderSequences)) return;
      const name = macro && typeof macro.name === "string" && macro.name ? macro.name : "ohne Name";
      add("info", side, "macro-unused", `Makro ${i} (${name}) wird nirgends verwendet.`);
    });
    // Eine Leader-Sequenz mit einem nicht definierten Paar oder Makro sendet nichts
    (Array.isArray(cfg.leaderSequences) ? cfg.leaderSequences : []).forEach((q, i) => {
      if (!q || typeof q.action !== "string") return;
      const pairIdx = pairIndexFromCode(q.action);
      const macroIdx = macroIndexFromCode(q.action);
      const missing = pairIdx >= 0 ? pairIdx >= (cfg.keyPairs || []).length : macroIdx >= 0 && macroIdx >= (cfg.macros || []).length;
      if (missing) add("warn", side, "leader-undefined-target", `Leader-Sequenz ${i} führt ${q.action} aus, aber dieses ${pairIdx >= 0 ? "Tastenpaar" : "Makro"} gibt es nicht. Die Sequenz sendet nichts.`);
    });
    // Zwei Combos über dieselben Tasten sind nur ein Fehler, wenn ihre Ebenenmasken sich überlappen
    const seen = new Map();
    combos.forEach((cb, i) => {
      // Nur Combos, die auslösen können: Koordinaten als Text ("2") oder fehlende Tasten sind keine Dopplung
      if (!lintComboCanFire(cb, profiles[side])) return;
      const ids = comboKeys(cb).map(k => `${k.r}_${k.c}`).sort().join("|");
      const earlier = (seen.get(ids) || []).find(e => (e.mask & comboLayerMask(cb)) !== 0);
      if (earlier) {
        add("warn", side, "combo-duplicate", `Combo ${earlier.index + 1} und Combo ${i + 1} nutzen dieselben ${comboKeys(cb).length === 3 ? "drei" : "zwei"} Tasten. Beide lösen gleichzeitig aus.`,
          { combo: i });
      } else {
        if (!seen.has(ids)) seen.set(ids, []);
        seen.get(ids).push({ index: i, mask: comboLayerMask(cb) });
      }
    });
    // Eine Combo mit zwei Tasten, die in einer Combo mit drei Tasten enthalten ist, löst vorab aus: beide Combos feuern
    combos.forEach((three, j) => {
      if (!lintComboCanFire(three, profiles[side]) || comboKeys(three).length !== 3) return;
      const ids3 = comboKeys(three).map(k => `${k.r}_${k.c}`);
      combos.forEach((two, i) => {
        if (i === j || !lintComboCanFire(two, profiles[side]) || comboKeys(two).length !== 2) return;
        if ((comboLayerMask(two) & comboLayerMask(three)) === 0) return;
        if (!comboKeys(two).every(k => ids3.includes(`${k.r}_${k.c}`))) return;
        add("warn", side, "combo-subset",
          `Combo ${i + 1} nutzt zwei Tasten von Combo ${j + 1}. Beide lösen aus, wenn alle drei Tasten im Fenster gedrückt werden.`,
          { combo: i });
      });
    });
    combos.forEach((cb, i) => {
      // Eine Taste, die es an der Hälfte nicht gibt, meldet schon "absent-key-action"; die Combo löst nie aus
      if (!lintComboCanFire(cb, profiles[side])) return;
      for (const key of comboKeys(cb)) {
        const layers = [];
        const holdLayers = [];
        for (let l = 0; l < NUM_LAYERS; l++) {
          // Nur auf Ebenen der Maske hält die Combo die Taste zurück
          if (!comboAppliesOnLayer(cb, l)) continue;
          // Mit dem Rückfall auf Ebene 0 wie die Firmware: eine transparente Taste erbt dort Halten und Doppel-Tipp
          const a = lintResolvedCell(cfg, l, key.r, key.c);
          if (a.tap !== "NONE" && (a.hold !== "NONE" || a.dtap !== "NONE")) layers.push(l);
          if (a.tap !== "NONE" && a.hold !== "NONE") holdLayers.push(l);
        }
        if (layers.length) {
          // Eine Halte-Aktion (Mod-Tap) in einer Combo ist ein Fehler im Layout; nur ein Doppel-Tipp bleibt ein Hinweis
          add(holdLayers.length ? "warn" : "info", side, "combo-hold-cancelled",
            `Taste R${key.r}C${key.c} ist Teil von Combo ${i + 1} und hat ${lintOnLayers(layers)} eine Halte- oder Doppel-Tipp-Aktion. ` +
            "Löst die Combo aus, bricht sie diese Aktion ab.", { combo: i });
        }
      }
    });
    // Eine Überschreibung, deren Taste auf keiner Ebene der Maske von einer Hälfte gesendet wird, löst nie aus
    (Array.isArray(cfg.keyOverrides) ? cfg.keyOverrides : []).forEach((o, i) => {
      if (!o || typeof o.key !== "string" || lintOverrideKeyMapped(configs, sides, profiles, o)) return;
      add("warn", side, "override-key-unmapped",
        `Überschreibung ${i} (${keyOverrideLabel(o, labelFor)}): Keine Taste, kein Tastenpaar und kein Makro sendet ${labelFor(o.key)}${keyOverrideLayerSuffix(keyOverrideLayerMask(o)) || " auf einer Ebene"}. Die Überschreibung löst nie aus.`,
        { override: i });
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

// =============================================================================
// Übungsmodus (DOM-frei): Zeichen -> Taste, Übungssitzung, Wortliste aus der Heatmap
// =============================================================================

const PRACTICE_MAX_CHARS = 500;
// Shift-Zeichen -> Zeichen der Taste ohne Shift (US-Layout)
const PRACTICE_SHIFT_BASE = {
  "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
  "_": "-", "+": "=", "{": "[", "}": "]", "|": "\\", ":": ";", "\"": "'", "~": "`", "<": ",", ">": ".", "?": "/"
};
const PRACTICE_SHIFT_CODES = ["KEY_LEFT_SHIFT", "KEY_RIGHT_SHIFT", "OSM_LSHIFT", "OSM_RSHIFT"];

// Mögliche Wege, ein Zeichen zu tippen: { code, shift } (Tastencode) oder { pair } (Tastenpaar), beste zuerst
function practiceCandidates(ch) {
  const out = [];
  for (const group of KEYCODES) {
    const k = group.keys.find(key => key.char === ch && ch !== "");
    if (k) out.push({ code: k.code, shift: false });
  }
  if (/^[A-Z]$/.test(ch)) out.push({ code: `KEY_${ch}`, shift: true });
  const base = PRACTICE_SHIFT_BASE[ch];
  if (base) {
    for (const group of KEYCODES) {
      const k = group.keys.find(key => key.char === base);
      if (k) out.push({ code: k.code, shift: true });
    }
  }
  const mac = DE_MAC_CHARS.find(e => e.char === ch);
  if (mac && mac.code) out.push({ code: mac.code, shift: false });
  if (mac && mac.pair) out.push({ pair: mac.pair, shift: false });
  if (ch.length === 1 && ch >= " " && ch <= "~") out.push({ code: ch, shift: false });
  return out;
}

// Taste (Hälfte, Zeile, Spalte, Ebene), deren Tap oder Halten das Prädikat erfüllt; Ebene 0 zuerst
// Mit collect (Array) werden alle Treffer gesammelt, der erste bleibt der Rückgabewert
function practiceFindKey(configs, profiles, sides, layers, test, collect) {
  let first = null;
  for (const l of layers) {
    for (const side of sides) {
      const grid = configs[side] && configs[side].layers && configs[side].layers[l];
      if (!grid) continue;
      for (let r = 0; r < NUM_ROWS; r++) {
        for (let c = 0; c < NUM_COLS; c++) {
          const cell = grid[r] && grid[r][c];
          if (cell && isPhysicalKey(r, c, profiles[side]) && test(cell, side, r, c, l)) {
            const hit = { side, r, c, layer: l };
            if (!collect) return hit;
            collect.push(hit);
            first = first || hit;
          }
        }
      }
    }
  }
  return first;
}

function practiceSameCode(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a === "NONE" || b === "NONE") return false;
  if (a === b) return true;
  const na = actionCodeToNumeric(a);
  return na > 0 && na === actionCodeToNumeric(b);
}

// Taste für ein Zeichen: { char, side, r, c, layer, shift, layerKey, shiftKey } oder null (keine Position).
// Bevorzugt die niedrigste Ebene, dann ohne Shift. Eine Ebene > 0 braucht eine MO_n-Taste (TG_n wird nie ausgeschaltet), Shift eine Shift-Taste.
function findCharPosition(ch, configs, profiles, sideOrder) {
  const sides = (Array.isArray(sideOrder) ? sideOrder : Object.keys(configs || {}))
    .filter(side => configs && configs[side] && profiles && profiles[side]);
  let best = null;
  for (const cand of practiceCandidates(ch)) {
    for (let l = 0; l < NUM_LAYERS; l++) {
      const hit = practiceFindKey(configs, profiles, sides, [l], cell => {
        if (cand.pair) {
          return false;
        }
        return practiceSameCode(cell.tap, cand.code);
      }) || (cand.pair ? practiceFindPairKey(configs, profiles, sides, l, cand.pair) : null);
      if (!hit) continue;
      let layerKey = null;
      if (l > 0) {
        layerKey = practiceFindKey(configs, profiles, sides, [0, ...Array.from({ length: NUM_LAYERS }, (_, i) => i).filter(i => i > 0 && i !== l)],
          cell => cell.tap === `MO_${l}` || cell.hold === `MO_${l}`);
        if (!layerKey) continue;
      }
      let shiftKey = null;
      const shiftAlternatives = [];
      if (cand.shift) {
        // Eine Shift-Taste von Ebene 0 wirkt auf Ebene l nur, wenn ihre Zelle dort transparent (NONE) ist
        shiftKey = practiceFindKey(configs, profiles, sides, l === 0 ? [0] : [l, 0],
          (cell, side, r, c, layer) => (PRACTICE_SHIFT_CODES.includes(cell.tap) || PRACTICE_SHIFT_CODES.includes(cell.hold))
            && (layer === l || (configs[side].layers[l][r][c] || {}).tap === "NONE"), shiftAlternatives);
        if (!shiftKey) continue;
      }
      const score = (l * 2 + (cand.shift ? 1 : 0));
      if (!best || score < best.score) {
        best = { score, pos: { char: ch, side: hit.side, r: hit.r, c: hit.c, layer: l, shift: !!cand.shift, layerKey, shiftKey, shiftAlternatives } };
      }
    }
  }
  return best ? best.pos : null;
}

function practiceFindPairKey(configs, profiles, sides, layer, pair) {
  for (const side of sides) {
    const idx = findKeyPairIndex(configs[side].keyPairs, pair);
    if (idx < 0) continue;
    const hit = practiceFindKey(configs, profiles, [side], [layer], cell => cell.tap === `PAIR_${idx}`);
    if (hit) return hit;
  }
  return null;
}

// Text -> Übungsschritte. Whitespace wird zu einem Leerzeichen, der Text auf PRACTICE_MAX_CHARS gekürzt.
// missing: Zeichen ohne Tastenposition (einmalig, in Reihenfolge); sie sind nicht in steps.
function buildPracticeSteps(text, configs, profiles, sideOrder) {
  const clean = [...String(text || "").replace(/\s+/g, " ").trim()].slice(0, PRACTICE_MAX_CHARS);
  const cache = new Map();
  const steps = [];
  const missing = [];
  for (const ch of clean) {
    if (!cache.has(ch)) cache.set(ch, findCharPosition(ch, configs, profiles, sideOrder));
    const pos = cache.get(ch);
    if (pos) steps.push(pos);
    else if (!missing.includes(ch)) missing.push(ch);
  }
  return { steps, missing };
}

function createPracticeSession(steps) {
  return { steps: steps.slice(), index: 0, correct: 0, errors: {}, errorTotal: 0, startMs: null, lastMs: null, finished: false };
}

function practiceKeyId(side, r, c) {
  return `${side}_${r}_${c}`;
}

// Tastendruck der Hardware. Rückgabe: "correct", "error", "helper" (Shift-/Ebenentaste des Schritts) oder "ignored".
// Ein Fehler zählt auf der erwarteten Taste. layer: Ebene beim Drücken (undefined = unbekannt).
function practiceKeyPress(session, side, r, c, layer, nowMs) {
  if (session.finished) return "ignored";
  const step = session.steps[session.index];
  if (!step) return "ignored";
  const id = practiceKeyId(side, r, c);
  const targetId = practiceKeyId(step.side, step.r, step.c);
  // Eine Hilfstaste liegt auf einer anderen Ebene als das Ziel; dieselbe Position auf der Zielebene bleibt das Ziel
  const targetWins = id === targetId && (layer === step.layer || !Number.isInteger(layer));
  if (!targetWins) {
    for (const helper of [step.layerKey, step.shiftKey, ...(step.shiftAlternatives || [])]) {
      if (helper && practiceKeyId(helper.side, helper.r, helper.c) === id) return "helper";
    }
  }
  if (session.startMs === null) session.startMs = nowMs;
  const layerOk = !Number.isInteger(layer) || layer === step.layer;
  if (id === targetId && layerOk) {
    session.correct++;
    session.index++;
    session.lastMs = nowMs;
    if (session.index >= session.steps.length) session.finished = true;
    return "correct";
  }
  const expected = targetId;
  session.errors[expected] = (session.errors[expected] || 0) + 1;
  session.errorTotal++;
  return "error";
}

// Tempo in Wörtern pro Minute (5 Zeichen = 1 Wort) von der ersten Taste bis zum letzten richtigen Zeichen, Genauigkeit in %
function practiceSpeed(session) {
  const elapsedMs = session.startMs !== null && session.lastMs !== null ? session.lastMs - session.startMs : 0;
  const wpm = elapsedMs > 0 ? Math.round(session.correct / CHARS_PER_WORD / (elapsedMs / 60000)) : 0;
  const presses = session.correct + session.errorTotal;
  return { wpm, elapsedMs, accuracy: presses ? Math.round(session.correct / presses * 100) : 100 };
}

// Das Zeichen, das ein Tastencode tippt (druckbar, ohne Leerzeichen), sonst ""
function practiceCharForCode(code) {
  if (typeof code !== "string" || code === "NONE") return "";
  for (const group of KEYCODES) {
    const k = group.keys.find(key => key.code === code);
    if (k) return k.char && k.char.trim() ? k.char : "";
  }
  const mac = deMacCharForCode(code);
  if (mac) return mac;
  return code.length === 1 && code > " " && code <= "~" ? code : "";
}

// Übungstext aus den häufigsten Tasten der Heatmap. sources: [{ config, stats }]. Zählt je Ebene den Tap der Taste
// (ohne eigene Belegung gilt Ebene 0). Der Text besteht aus Dreier-Gruppen der häufigsten Zeichen, immer gleich für gleiche Daten.
function practiceTextFromHeatmap(sources, keyCount = 8, wordCount = 12) {
  const totals = new Map();
  for (const { config, stats } of sources || []) {
    if (!config || !stats) continue;
    stats.layerCounts.forEach((counts, l) => {
      for (const [id, n] of Object.entries(counts)) {
        const [r, c] = id.split("_").map(Number);
        const own = config.layers && config.layers[l] && config.layers[l][r] && config.layers[l][r][c];
        const base = config.layers && config.layers[0] && config.layers[0][r] && config.layers[0][r][c];
        const ch = practiceCharForCode(own && own.tap !== "NONE" ? own.tap : (base && base.tap));
        if (ch) totals.set(ch, (totals.get(ch) || 0) + n);
      }
    });
  }
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, keyCount).map(e => e[0]);
  if (!top.length) return "";
  const words = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(top[i % top.length] + top[(i + 1) % top.length] + top[(i * 2 + 1) % top.length]);
  }
  return words.join(" ");
}

// Fester Übungstext, wenn die Statistik keine Schwächen zeigt
const PRACTICE_FIXED_TEXT = "the quick brown fox jumps over the lazy dog";
const DRILL_PAIR_LIMIT = 3;
const DRILL_RANK_STEP = 8;

// Das Zeichen der Taste "r_c" auf Ebene 0 der Config, sonst ""; Positionen ohne Taste geben "".
function practiceCharForKeyId(config, id) {
  const [r, c] = String(id).split("_").map(Number);
  const cell = config && config.layers && config.layers[0] && config.layers[0][r] && config.layers[0][r][c];
  return cell ? practiceCharForCode(cell.tap) : "";
}

// Übungstext für schwache Tasten. sources: [{ config, stats }]. Die Tasten mit dem höchsten Korrekturanteil
// (topCorrectedKeys) kommen nach Rang gestuft vor, der erste Rang am häufigsten (Gewicht je Rang um DRILL_RANK_STEP
// kleiner). Dazu kommen die häufigsten Folgen desselben Fingers (topSameFingerPairs) als Wörter
// "ab ba". Nur Tasten mit Zeichen auf Ebene 0 zählen (die Statistik zählt je Position, nicht je Ebene).
// Die Paar-Wörter behalten ihren Platz: die Tastenwörter werden als ganze Wörter gekürzt. Ohne Schwächen gilt fallback. Deterministisch.
function practiceDrillText(sources, fallback = PRACTICE_FIXED_TEXT) {
  const weak = new Map();
  const pairWords = [];
  for (const { config, stats } of sources || []) {
    if (!config || !stats) continue;
    for (const k of topCorrectedKeys(stats)) {
      const ch = practiceCharForKeyId(config, k.id);
      if (ch) weak.set(ch, Math.max(weak.get(ch) || 0, k.share));
    }
    for (const p of topSameFingerPairs(stats, DRILL_PAIR_LIMIT)) {
      const a = practiceCharForKeyId(config, p.a);
      const b = practiceCharForKeyId(config, p.b);
      if (a && b && a !== b) pairWords.push(a + b, b + a);
    }
  }
  if (!weak.size) return fallback;
  const ranked = [...weak.entries()].sort((x, y) => (y[1] - x[1]) || (x[0] < y[0] ? -1 : 1)).map(e => e[0]);
  const left = ranked.map((ch, i) => [ch, (ranked.length - i) * DRILL_RANK_STEP]);
  const pool = [];
  while (left.some(e => e[1] > 0)) {
    for (const e of left) if (e[1] > 0) { pool.push(e[0]); e[1]--; }
  }
  const pairText = pairWords.join(" ");
  const budget = PRACTICE_MAX_CHARS - (pairText ? pairText.length + 1 : 0);
  const words = [];
  let used = 0;
  for (let i = 0; i < pool.length; i += 3) {
    const word = pool.slice(i, i + 3).join("");
    if (used + word.length + (words.length ? 1 : 0) > budget) break;
    used += word.length + (words.length ? 1 : 0);
    words.push(word);
  }
  return [...words, ...(pairText ? [pairText] : [])].join(" ").slice(0, PRACTICE_MAX_CHARS);
}

// Beide Hälften in einer Datei: { bundleVersion: 1, sides: { R: ..., L: ... } }. configs: Config je Hälfte;
// jede Hälfte der Profile muss vorhanden sein, sonst ein Fehler (kein halbes Bündel).
const DUAL_BUNDLE_VERSION = 1;

function buildDualSideBundle(configs, profiles) {
  const sides = {};
  for (const side of Object.keys(profiles || {})) {
    if (!configs || !configs[side]) throw new Error(`Konfiguration der Hälfte ${side} fehlt.`);
    sides[side] = JSON.parse(JSON.stringify(configs[side]));
  }
  if (Object.keys(sides).length === 0) throw new Error("Keine Hälfte zum Exportieren.");
  return { bundleVersion: DUAL_BUNDLE_VERSION, sides };
}

// Liest eine importierte Datei (bereits geparstes JSON): Einzel-Config (für activeSide) oder Bündel beider Hälften.
// Prüft und normalisiert ALLE Hälften, bevor es etwas zurückgibt; ein Fehler in einer Hälfte wirft für den ganzen
// Import. Die Eingabe bleibt unverändert. Ergebnis: { kind: "single"|"bundle", configs: { <Hälfte>: normalisiert } }.
function parseConfigImport(raw, profiles, activeSide) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Konfiguration muss ein Objekt sein.");
  const clone = () => JSON.parse(JSON.stringify(raw));
  const check = (cfg, side) => {
    const profile = profiles && profiles[side];
    if (!profile) throw new Error(`Unbekannte Hälfte: ${side}`);
    try {
      validateConfigShape(cfg, profile);
      return normalizeConfig(cfg, profile);
    } catch (e) {
      throw new Error(`Hälfte ${side}: ${e.message}`);
    }
  };
  if (raw.bundleVersion === undefined && raw.sides === undefined) {
    if (!profiles || !profiles[activeSide]) throw new Error(`Unbekannte Hälfte: ${activeSide}`);
    return { kind: "single", configs: { [activeSide]: check(clone(), activeSide) } };
  }
  if (raw.bundleVersion !== DUAL_BUNDLE_VERSION) throw new Error(`Unbekannte Bündel-Version: ${raw.bundleVersion}`);
  const sides = clone().sides;
  if (!sides || typeof sides !== "object" || Array.isArray(sides)) throw new Error("'sides' muss ein Objekt sein.");
  const expected = Object.keys(profiles || {});
  const extra = Object.keys(sides).filter(side => !expected.includes(side));
  if (extra.length) throw new Error(`Unbekannte Hälfte: ${extra[0]}`);
  const configs = {};
  for (const side of expected) {
    if (!sides[side]) throw new Error(`Hälfte ${side} fehlt im Bündel.`);
    configs[side] = check(sides[side], side);
  }
  return { kind: "bundle", configs };
}

// Diagnosebericht (Button "Diagnosebericht speichern"). Nur eine feste Liste von Feldern gelangt in den Bericht
// (Whitelist, kein Kopieren von DEVICE_INFO): kein Keymap, kein Makro, kein Key Pair, keine Combo- oder
// Leader-Folge und keine Tastendaten. Neue DEVICE_INFO-Felder bleiben draußen, bis sie hier stehen.
const APP_VERSION = "1.0.0"; // gleich package.json (Test)
const SUPPORT_REPORT_VERSION = 1;
const SUPPORT_INFO_NUMBERS = ["fw", "standby_timeout", "sleep_timeout", "debounce_ms", "combo_timeout_ms", "tapping_term_ms",
  "hold_tap_mode", "quick_tap_ms", "qt", "pi", "chordal_hold", "rt", "nwl", "bl", "as", "at", "ld", "ot", "lt"];
const SUPPORT_LINK_NUMBERS = ["up", "ms", "ever", "losses", "rx_dropped", "key_dropped", "rssi", "rssi_min"];
const SUPPORT_DIAG_NUMBERS = ["uptimeS", "heapFree", "heapMin", "loopMaxUs", "sqMax", "sqDrop"];

// devices: { <Hälfte>: { info, infoAt, diag, diagAt } } (DEVICE_INFO, bereinigtes GET_DIAG, Empfangszeit in ms); fehlende Angaben werden null
function buildSupportReport({ appVersion = APP_VERSION, now = Date.now(), devices = {} } = {}) {
  const num = v => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const pick = (src, keys) => {
    const out = {};
    for (const k of keys) out[k] = src && typeof src === "object" ? num(src[k]) : null;
    return out;
  };
  const halves = {};
  for (const side of Object.keys(devices)) {
    const { info, diag, infoAt, diagAt } = devices[side] || {};
    const iso = ms => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);
    const hasInfo = !!info && typeof info === "object";
    halves[side] = {
      side: hasInfo && (info.side === "R" || info.side === "L") ? info.side : null,
      device_info: { ...pick(info, SUPPORT_INFO_NUMBERS), config_mode: hasInfo && typeof info.config_mode === "boolean" ? info.config_mode : null },
      device_info_at: iso(infoAt),
      diag_at: iso(diagAt),
      left_fw: hasInfo ? num(info.left_fw) : null,
      left_link: hasInfo && info.left_link && typeof info.left_link === "object" ? pick(info.left_link, SUPPORT_LINK_NUMBERS) : null,
      diag: diag && typeof diag === "object"
        ? { reset: typeof diag.reset === "string" && /^[a-z_]{1,24}$/.test(diag.reset) ? diag.reset : null, ...pick(diag, SUPPORT_DIAG_NUMBERS) }
        : null
    };
  }
  return { reportVersion: SUPPORT_REPORT_VERSION, appVersion: String(appVersion).slice(0, 32), createdAt: new Date(now).toISOString(), halves };
}

// Belegungsvorlagen (Dialog "Belegungsvorlagen"): Basis-Layouts der rechten Hand und Ebenen-Vorlagen.
// Eine Vorlage ersetzt die ganze Ebene; die Ebenen-Vorlagen lassen alle anderen Tasten transparent (NONE).
const presetKeyCell = (tap, label) => ({ tap, label: label === undefined ? tap.replace(/^KEY_/, "") : label, hold: "NONE", dtap: "NONE" });

// Daumen-Cluster, Shift und Pfeile wie im Preset "Deutsch QWERTZ"; nur verlötete Positionen (R2C6 und R5C5 gibt es nicht),
// darum liegt Backspace auf R4C5
function layoutPresetBaseLayer(fingerRows) {
  const layer = transparentLayer();
  fingerRows.forEach((row, r) => row.forEach((cell, c) => { layer[r][c] = cell; }));
  layer[3][5] = presetKeyCell("KEY_RIGHT_SHIFT", "Shift");
  layer[4][1] = presetKeyCell("KEY_LEFT_ARROW", "←");
  layer[4][2] = presetKeyCell("KEY_DOWN_ARROW", "↓");
  layer[4][3] = presetKeyCell("KEY_UP_ARROW", "↑");
  layer[4][4] = presetKeyCell("KEY_RIGHT_ARROW", "→");
  layer[4][5] = presetKeyCell("KEY_BACKSPACE", "Bksp");
  layer[5] = [presetKeyCell("KEY_LEFT_GUI", "Cmd"), presetKeyCell("KEY_LEFT_ALT", "Alt"), presetKeyCell("KEY_RETURN", "Enter (2U)"), presetKeyCell("KEY_SPACE", "Space (2U)"),
              presetKeyCell("KEY_TAB", "Tab"), presetKeyCell("NONE", "---"), presetKeyCell("KEY_ESC", "Esc")]; // R5C5 existiert nicht
  return layer;
}

const presetKeyRow = codes => codes.map(c => (Array.isArray(c) ? presetKeyCell(c[0], c[1]) : presetKeyCell(c)));
const LAYOUT_PRESETS = {
  qwertz: {
    kind: "base", name: "QWERTZ (macOS US-Layout)",
    build: () => layoutPresetBaseLayer([
      presetKeyRow(["KEY_6", "KEY_7", "KEY_8", "KEY_9", "KEY_0", ["UMLAUT_SZ", "ß"]]),
      presetKeyRow(["KEY_Z", "KEY_U", "KEY_I", "KEY_O", "KEY_P", ["UMLAUT_UE", "ü"]]),
      presetKeyRow(["KEY_H", "KEY_J", "KEY_K", "KEY_L", ["UMLAUT_OE", "ö"], ["UMLAUT_AE", "ä"]]),
      presetKeyRow(["KEY_N", "KEY_M", ["KEY_COMMA", ","], ["KEY_PERIOD", "."], ["KEY_MINUS", "-"]])
    ])
  },
  colemak_dh: {
    kind: "base", name: "Colemak-DH",
    build: () => layoutPresetBaseLayer([
      presetKeyRow(["KEY_6", "KEY_7", "KEY_8", "KEY_9", "KEY_0", ["KEY_MINUS", "-"]]),
      presetKeyRow(["KEY_J", "KEY_L", "KEY_U", "KEY_Y", ["KEY_SEMICOLON", ";"], ["KEY_LEFT_BRACKET", "["]]),
      presetKeyRow(["KEY_M", "KEY_N", "KEY_E", "KEY_I", "KEY_O", ["KEY_QUOTE", "'"]]),
      presetKeyRow(["KEY_K", "KEY_H", ["KEY_COMMA", ","], ["KEY_PERIOD", "."], ["KEY_SLASH", "/"]])
    ])
  },
  dvorak: {
    kind: "base", name: "Dvorak",
    build: () => layoutPresetBaseLayer([
      presetKeyRow(["KEY_6", "KEY_7", "KEY_8", "KEY_9", "KEY_0", ["KEY_LEFT_BRACKET", "["]]),
      presetKeyRow(["KEY_F", "KEY_G", "KEY_C", "KEY_R", "KEY_L", ["KEY_SLASH", "/"]]),
      presetKeyRow(["KEY_D", "KEY_H", "KEY_T", "KEY_N", "KEY_S", ["KEY_MINUS", "-"]]),
      presetKeyRow(["KEY_B", "KEY_M", "KEY_W", "KEY_V", "KEY_Z"])
    ])
  },
  numpad: {
    kind: "layer", name: "Numpad (3x3 rechts)",
    build: () => {
      const layer = transparentLayer();
      const put = (r, c, tap, label) => { layer[r][c] = presetKeyCell(tap, label); };
      ["KEY_7", "KEY_8", "KEY_9"].forEach((k, i) => put(1, 1 + i, k));
      ["KEY_4", "KEY_5", "KEY_6"].forEach((k, i) => put(2, 1 + i, k));
      ["KEY_1", "KEY_2", "KEY_3"].forEach((k, i) => put(3, 1 + i, k));
      put(4, 1, "KEY_0"); put(4, 2, "KEY_PERIOD", "."); put(4, 3, "KEY_COMMA", ","); put(4, 4, "KEY_RETURN", "Enter");
      put(1, 4, "KEY_SLASH", "/"); put(2, 4, "KEY_MINUS", "-"); put(3, 4, "+"); put(1, 5, "*"); put(2, 5, "KEY_EQUAL", "=");
      return layer;
    }
  },
  navigation: {
    kind: "layer", name: "Navigation (Pfeile, Pos 1, Ende, Bild)",
    build: () => {
      const layer = transparentLayer();
      const put = (r, c, tap, label) => { layer[r][c] = presetKeyCell(tap, label); };
      put(1, 1, "KEY_HOME", "Pos 1"); put(1, 2, "KEY_UP_ARROW", "↑"); put(1, 3, "KEY_END", "Ende"); put(1, 4, "KEY_PAGE_UP", "Bild ↑");
      put(2, 1, "KEY_LEFT_ARROW", "←"); put(2, 2, "KEY_DOWN_ARROW", "↓"); put(2, 3, "KEY_RIGHT_ARROW", "→"); put(2, 4, "KEY_PAGE_DOWN", "Bild ↓");
      return layer;
    }
  },
  symbols: {
    kind: "layer", name: "Symbole (Klammern, Mathe, Satzzeichen)",
    build: () => {
      const layer = transparentLayer();
      const rows = [["(", ")", "[", "]", "{", "}"], ["+", "-", "*", "/", "=", "%"], ["!", "?", ":", ";", "'", "\""], ["<", ">", "|", "\\", "~", "`"]];
      rows.forEach((row, r) => row.forEach((ch, c) => { layer[r][c] = presetKeyCell(ch, ch); }));
      return layer;
    }
  }
};

// Neue Config mit der Vorlage auf der Ebene targetLayer (config bleibt unverändert, so reicht ein Zurücksetzen auf das
// Original als Undo). null bei unbekannter Vorlage oder Ebene außerhalb von 0..NUM_LAYERS-1.
function applyLayoutPreset(config, presetKey, targetLayer = 0) {
  if (!config || typeof config !== "object" || !Array.isArray(config.layers)) return null;
  if (typeof presetKey !== "string" || !Object.prototype.hasOwnProperty.call(LAYOUT_PRESETS, presetKey)) return null;
  if (!isValidIndex(targetLayer, NUM_LAYERS)) return null;
  const layers = JSON.parse(JSON.stringify(config.layers));
  while (layers.length <= targetLayer) layers.push(transparentLayer());
  layers[targetLayer] = LAYOUT_PRESETS[presetKey].build();
  return { ...config, layers };
}
