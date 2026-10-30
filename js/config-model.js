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
const SETTINGS_RANGES = {
  debounceMs: [1, 50, 5],
  comboTimeoutMs: [10, 200, 40],
  tappingTermMs: [100, 500, 200],
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

// Ein Tastenpaar-Mitglied ist eine normale Taste oder ein Modifier (Code 1..255, wie in server.py/Firmware)
function isKeyPairMember(code) {
  if (typeof code !== "string" || pairIndexFromCode(code) >= 0 || macroIndexFromCode(code) >= 0) return false;
  const n = actionCodeToNumeric(code);
  return n >= 1 && n <= 0xFF;
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
  return isKeyPairMember(step.code);
}

function isValidMacro(macro) {
  return !!macro && typeof macro === "object" && Array.isArray(macro.steps) &&
    macro.steps.length <= MAX_MACRO_STEPS && macro.steps.every(isValidMacroStep);
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
        throw new Error(`Tastenpaar ${i} braucht zwei normale Tasten oder Modifier (first/second).`);
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
    standbyTimeoutMinutes: clampSetting("standbyTimeoutMinutes", s.standbyTimeoutMinutes ?? 5),
    sleepTimeoutMinutes: clampSetting("sleepTimeoutMinutes", s.sleepTimeoutMinutes ?? 60)
  };
  return cfg;
}

// Tipp-Statistik für Heatmap & WPM (DOM-frei, Zählung nur physischer Tasten der Hälfte aus profile)
const WPM_WINDOW_MS = 60000;
const CHARS_PER_WORD = 5;
const HEAT_LEVELS = 5;

function createTypingStats(counts, profile) {
  const stats = { counts: {}, total: 0, recent: [], profile };
  if (counts && typeof counts === "object") {
    for (const [id, n] of Object.entries(counts)) {
      const m = /^(\d+)_(\d+)$/.exec(id);
      if (!m || !Number.isSafeInteger(n) || n <= 0) continue;
      const r = Number(m[1]), c = Number(m[2]);
      if (!isValidIndex(r, NUM_ROWS) || !isValidIndex(c, NUM_COLS) || !isPhysicalKey(r, c, profile)) continue;
      stats.counts[`${r}_${c}`] = n;
      stats.total += n;
    }
  }
  return stats;
}

function recordKeyPress(stats, r, c, nowMs) {
  if (!isValidIndex(r, NUM_ROWS) || !isValidIndex(c, NUM_COLS) || !isPhysicalKey(r, c, stats.profile)) return false;
  const id = `${r}_${c}`;
  stats.counts[id] = (stats.counts[id] || 0) + 1;
  stats.total++;
  stats.recent.push(nowMs);
  pruneRecentPresses(stats, nowMs);
  return true;
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

function maxKeyCount(stats) {
  let max = 0;
  for (const n of Object.values(stats.counts)) if (n > max) max = n;
  return max;
}

// =============================================================================
// Layout-Diff vor dem Sync (lokale Belegung gegen GET_CONFIG des Geräts)
// =============================================================================
// GET_CONFIG liefert Ebenen-Namen und Tasten (Tap, Halten, Doppel-Tipp), keine Combos und Tastenpaare.

function createDeviceSnapshot() {
  return { names: null, tap: [], hold: [], dtap: [] };
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
  return { keys, names };
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
