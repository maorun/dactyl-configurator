// Unit-Tests für die DOM-freien Hilfsfunktionen in app.js (Action-Codes, Sanitizing, Config-Validierung).
// Ausführen: node tests/test_app_logic.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

// Schneidet die reinen Logik-Abschnitte aus app.js aus (ohne DOM-/Browser-Zugriffe)
function section(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Abschnitt nicht gefunden: ${startMarker}`);
  return src.slice(start, end);
}

const code = [
  section("const DEFAULT_LAYER_NAMES", "// BLE GATT"),
  section("const ACTION_TO_NUMERIC", "// Standard-Konfiguration"),
  section("// Matrix- und Firmware-Grenzen", "// State\n"),
  section("// Alte Configs speichern Modifier-Halte-Aktionen", "function fillKeycodeSelect")
].join("\n");

const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${code}
this.api = { keyToNumericActions, sanitizeCommandText, clampSetting, validateConfigShape,
             normalizeConfig, isPhysicalKey, findDefinitionByCode, actionCodeToNumeric, SETTINGS_RANGES,
             LEGACY_HOLD_CODES, normalizeHoldCode, holdSublabel,
             createTypingStats, recordKeyPress, computeWpm, heatLevel, maxKeyCount, WPM_WINDOW_MS, HEAT_LEVELS,
             isWiredSwitch, createMatrixTest, markMatrixKeyTested, summarizeMatrixTest,
             MATRIX_ROW_WIRES, MATRIX_COL_WIRES,
             applyLayerOperation, transparentLayer, isUndoBlocked,
             ACT_KEY_PAIR_BASE, MAX_KEY_PAIRS, pairIndexFromCode, isKeyPairMember, keyPairLabel,
             applyMatrixData, MATRIX_DATA_FIELDS, normalizeKeyCell };`, ctx);
const api = ctx.api;

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`[       OK ] ${name}`);
}

test("Mod-Tap: Tap und Hold werden als Zahlencodes gesendet", () => {
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_SPACE", hold: "MOD_LCTRL" }) }, { tapCode: 32, holdCode: 0x80, dtapCode: 0 });
  // Hold ohne Tap wirkt wie eine normale Taste
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "NONE", hold: "MO_1" }) }, { tapCode: 0x101, holdCode: 0, dtapCode: 0 });
  assert.deepStrictEqual({ ...api.keyToNumericActions(undefined) }, { tapCode: 0, holdCode: 0, dtapCode: 0 });
  // Beliebige Halte-Aktion: Tap A / Halten B, Media, Maus, Toggle-Layer
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_A", hold: "KEY_B" }) }, { tapCode: 97, holdCode: 98, dtapCode: 0 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_A", hold: "MEDIA_MUTE" }) }, { tapCode: 97, holdCode: 0x121, dtapCode: 0 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_A", hold: "MOUSE_LEFT" }) }, { tapCode: 97, holdCode: 0x130, dtapCode: 0 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_A", hold: "TG_2" }) }, { tapCode: 97, holdCode: 0x112, dtapCode: 0 });
});

test("Halte-Dropdown: alte MOD_*-Werte entsprechen den KEY_*-Modifiern", () => {
  for (const [legacy, code] of Object.entries(api.LEGACY_HOLD_CODES)) {
    assert.strictEqual(api.normalizeHoldCode(legacy), code);
    assert.strictEqual(api.actionCodeToNumeric(legacy), api.actionCodeToNumeric(code), legacy);
  }
  assert.strictEqual(api.normalizeHoldCode(undefined), "NONE");
  assert.strictEqual(api.normalizeHoldCode("KEY_B"), "KEY_B");
});

test("Halte-Unterbeschriftung: kurze Labels für alle Halte-Aktionen", () => {
  assert.strictEqual(api.holdSublabel("MOD_LCTRL"), "Ctrl");
  assert.strictEqual(api.holdSublabel("KEY_LEFT_CTRL"), "Ctrl");
  assert.strictEqual(api.holdSublabel("MO_1"), "L1");
  assert.strictEqual(api.holdSublabel("TG_3"), "TG3");
  assert.strictEqual(api.holdSublabel("KEY_B"), "B");
  assert.strictEqual(api.holdSublabel("MEDIA_VOLUME_UP"), "VOLUME");
  assert.strictEqual(api.holdSublabel("MOUSE_LEFT"), "LEFT");
  for (const code of ["KEY_PAGE_DOWN", "MEDIA_PREVIOUS_TRACK", "MOUSE_WHEEL_DOWN", "MAC_GLOBE", "LAYER_UP"]) {
    assert.ok(api.holdSublabel(code).length <= 6, code);
  }
});

test("Action-Codes: Roundtrip Name -> Zahl -> Name", () => {
  const codes = ["KEY_A", "KEY_0", "KEY_BACKSLASH", "KEY_QUOTE", "KEY_ESC", "KEY_F1", "KEY_F24",
    "KEY_NUM_0", "MO_0", "MO_7", "TG_0", "TG_7", "LAYER_UP", "LAYER_DOWN", "MEDIA_PLAY_PAUSE",
    "MAC_GLOBE", "MOUSE_LEFT", "MOUSE_WHEEL_DOWN", "KEY_LEFT_CTRL", "KEY_RIGHT_GUI"];
  for (const name of codes) {
    const num = api.actionCodeToNumeric(name);
    assert.ok(num > 0, name);
    assert.strictEqual(api.actionCodeToNumeric(api.findDefinitionByCode(num).tap), num, name);
  }
  assert.strictEqual(api.actionCodeToNumeric("ACT_MOUSE_LEFT"), 0x130);
  assert.strictEqual(api.actionCodeToNumeric("MAC_GLOBE"), 0x127);
  assert.strictEqual(api.actionCodeToNumeric("UNBEKANNT"), 0);
});

test("Befehlstext: Steuerzeichen, Quotes und Backslashes werden entfernt", () => {
  assert.strictEqual(api.sanitizeCommandText("Nav\nSAVE_NVS\r\"x\\"), "NavSAVE_NVSx");
  assert.strictEqual(api.sanitizeCommandText("   ", "Fallback"), "Fallback");
  assert.strictEqual(api.sanitizeCommandText("x".repeat(40)).length, 31);
});

test("Einstellungen: Werte werden auf Firmware-Bereiche begrenzt", () => {
  for (const [field, [lo, hi, def]] of Object.entries(api.SETTINGS_RANGES)) {
    assert.strictEqual(api.clampSetting(field, lo - 1), lo, field);
    assert.strictEqual(api.clampSetting(field, hi + 1), hi, field);
    assert.strictEqual(api.clampSetting(field, "abc"), def, field);
  }
});

test("Config-Validierung: ungültige Struktur wird abgelehnt", () => {
  assert.throws(() => api.validateConfigShape(null));
  assert.throws(() => api.validateConfigShape({ layers: [] }));
  assert.throws(() => api.validateConfigShape({ layers: new Array(9).fill([]) }));
  assert.throws(() => api.validateConfigShape({ layers: [[[], [], [], [], [], [], []]] }));
  assert.throws(() => api.validateConfigShape({ layers: [[]], combos: [{ key1: { r: 0, c: 0 } }] }));
  assert.throws(() => api.validateConfigShape({ layers: [[]], combos: [{ key1: { r: "0", c: 0 }, key2: { r: 1, c: 1 } }] }));
  assert.throws(() => api.validateConfigShape({ layers: [[]], combos: new Array(17).fill({ key1: { r: 0, c: 0 }, key2: { r: 1, c: 1 } }) }));
  assert.doesNotThrow(() => api.validateConfigShape({
    layers: [[[{ tap: "KEY_A" }]]],
    combos: [{ key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 } }]
  }));
});

test("Config-Normalisierung: Namen, Einstellungen und Zellen werden bereinigt", () => {
  const n = api.normalizeConfig({
    layers: [[[{ tap: "KEY_A", label: 1 }]]],
    layerNames: ["A\nB"],
    settings: { debounceMs: 0, deviceName: "Dac\"tyl" },
    combos: [{ key1: { r: 9, c: 0 }, key2: { r: 0, c: 0 } }]
  });
  assert.strictEqual(n.layerNames.length, 8);
  assert.strictEqual(n.layerNames[0], "AB");
  assert.strictEqual(n.layerNames[1], "Nav & Pfeile");
  assert.strictEqual(n.settings.debounceMs, 1);
  assert.strictEqual(n.settings.deviceName, "Dactyl");
  assert.strictEqual(n.layers[0][0][0].label, "");
  assert.strictEqual(n.layers[0][0][0].hold, "NONE");
  assert.strictEqual(n.combos.length, 0);
});

test("Physische Tasten: R4C0 und R5C5 existieren nicht", () => {
  assert.ok(!api.isPhysicalKey(4, 0));
  assert.ok(!api.isPhysicalKey(5, 5));
  assert.ok(api.isPhysicalKey(5, 6));
  assert.ok(api.isPhysicalKey(0, 0));
});

test("Heatmap: nur physische Tasten der Matrix werden gezählt", () => {
  const s = api.createTypingStats(null);
  assert.strictEqual(api.recordKeyPress(s, 2, 1, 0), true);
  assert.strictEqual(api.recordKeyPress(s, 2, 1, 10), true);
  assert.strictEqual(api.recordKeyPress(s, 4, 0, 20), false); // R4C0 existiert nicht
  assert.strictEqual(api.recordKeyPress(s, 5, 5, 20), false); // R5C5 existiert nicht
  assert.strictEqual(api.recordKeyPress(s, 6, 0, 20), false);
  assert.strictEqual(api.recordKeyPress(s, "2", 1, 20), false);
  assert.deepStrictEqual({ ...s.counts }, { "2_1": 2 });
  assert.strictEqual(s.total, 2);
});

test("Heatmap: gespeicherte Zähler werden validiert", () => {
  // JSON.parse erzeugt "__proto__" als eigenen Schlüssel (wie localStorage-Daten)
  const s = api.createTypingStats(JSON.parse('{"0_0": 3, "4_0": 9, "9_9": 1, "1_1": -2, "2_2": 1.5, "__proto__": 4, "x": 1, "5_6": 2}'));
  assert.deepStrictEqual({ ...s.counts }, { "0_0": 3, "5_6": 2 });
  assert.ok(!Object.prototype.hasOwnProperty.call(s.counts, "__proto__"));
  assert.strictEqual(typeof Object.getPrototypeOf(s.counts).hasOwnProperty, "function");
  assert.strictEqual(s.total, 5);
  assert.strictEqual(api.createTypingStats("kaputt").total, 0);
  assert.strictEqual(api.createTypingStats([1, 2]).total, 0);
});

test("WPM: gleitendes 60-s-Fenster mit 5 Anschlägen pro Wort", () => {
  const s = api.createTypingStats(null);
  for (let i = 0; i < 50; i++) api.recordKeyPress(s, 0, 1, i * 100);
  assert.strictEqual(api.computeWpm(s, 5000), 10);
  // Anschläge älter als das Fenster fallen heraus
  assert.strictEqual(api.computeWpm(s, api.WPM_WINDOW_MS + 2400), 5);
  assert.strictEqual(api.computeWpm(s, api.WPM_WINDOW_MS + 10000), 0);
  // Gesamtzähler bleibt unabhängig vom Fenster
  assert.strictEqual(s.total, 50);
});

test("WPM: Fenstergrenze und Zeitstempel in falscher Reihenfolge", () => {
  const s = api.createTypingStats(null);
  for (let i = 0; i < 5; i++) api.recordKeyPress(s, 1, 1, 1000);
  // Genau WPM_WINDOW_MS alt: Anschlag liegt außerhalb des Fensters
  assert.strictEqual(api.computeWpm(s, 1000 + api.WPM_WINDOW_MS - 1), 1);
  assert.strictEqual(api.computeWpm(s, 1000 + api.WPM_WINDOW_MS), 0);
  assert.strictEqual(s.recent.length, 0);
  // Ein älterer Zeitstempel verwirft keine neueren Anschläge
  for (let i = 0; i < 5; i++) api.recordKeyPress(s, 1, 1, 200000);
  assert.strictEqual(api.computeWpm(s, 150000), 1);
  // recordKeyPress kürzt das Fenster selbst
  api.recordKeyPress(s, 1, 1, 200000 + api.WPM_WINDOW_MS);
  assert.strictEqual(s.recent.length, 1);
});

test("Heatmap: Stufen skalieren relativ zur häufigsten Taste", () => {
  assert.strictEqual(api.heatLevel(0, 10), 0);
  assert.strictEqual(api.heatLevel(5, 0), 0);
  assert.strictEqual(api.heatLevel(1, 100), 1);
  assert.strictEqual(api.heatLevel(50, 100), 3);
  assert.strictEqual(api.heatLevel(100, 100), api.HEAT_LEVELS);
  const s = api.createTypingStats({ "0_0": 3, "1_1": 7 });
  assert.strictEqual(api.maxKeyCount(s), 7);
  assert.strictEqual(api.maxKeyCount(api.createTypingStats(null)), 0);
});

test("Matrix-Test: 35 verlötete Schalter (29 Finger + 6 Daumen ohne R4C0/R5C5)", () => {
  let n = 0;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (api.isWiredSwitch(r, c)) n++;
  assert.strictEqual(n, 35);
  assert.ok(!api.isWiredSwitch(4, 0));
  assert.ok(!api.isWiredSwitch(5, 5));
  assert.ok(!api.isWiredSwitch(0, 6)); // Col 6 nur im Daumen-Cluster
  assert.ok(api.isWiredSwitch(5, 6));
  assert.strictEqual(api.summarizeMatrixTest(api.createMatrixTest()).total, 35);
});

test("Matrix-Test: Tasten werden einmalig und nur innerhalb der Matrix gezählt", () => {
  const t = api.createMatrixTest();
  assert.strictEqual(api.markMatrixKeyTested(t, 2, 1), true);
  assert.strictEqual(api.markMatrixKeyTested(t, 2, 1), false);
  assert.strictEqual(api.markMatrixKeyTested(t, 4, 0), false);
  assert.strictEqual(api.markMatrixKeyTested(t, 6, 0), false);
  assert.strictEqual(api.markMatrixKeyTested(t, 1, "1"), false);
  assert.strictEqual(api.summarizeMatrixTest(t).tested, 1);
});

test("Matrix-Test: Zeilen und Spalten ohne Treffer gelten als verdächtig", () => {
  const t = api.createMatrixTest();
  // Ohne Tastendruck keine Verdachtsmeldung
  assert.deepStrictEqual([...api.summarizeMatrixTest(t).suspectRows], []);
  // Alle Tasten außer Row 3 drücken
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (r !== 3) api.markMatrixKeyTested(t, r, c);
  const s = api.summarizeMatrixTest(t);
  assert.deepStrictEqual([...s.suspectRows], [3]);
  assert.deepStrictEqual([...s.suspectCols], []);
  assert.strictEqual(s.tested, 35 - 6);
  // Fehlende Spalte 6 (nur R5C6) wird erkannt
  const t2 = api.createMatrixTest();
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) api.markMatrixKeyTested(t2, r, c);
  assert.deepStrictEqual([...api.summarizeMatrixTest(t2).suspectCols], [6]);
});

test("Matrix-Test: Leitungsliste entspricht ROW_PINS/COL_PINS der Firmware", () => {
  const ino = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "dactyl_right.ino"), "utf8");
  const pins = name => ino.match(new RegExp(name + "\\s*\\[[^\\]]*\\]\\s*=\\s*\\{([^}]*)\\}"))[1].split(",").map(v => Number(v.trim()));
  assert.deepStrictEqual([...api.MATRIX_ROW_WIRES.map(w => w.gpio)], pins("ROW_PINS"));
  assert.deepStrictEqual([...api.MATRIX_COL_WIRES.map(w => w.gpio)], pins("COL_PINS"));
});

test("Tastenpaar: PAIR_<n> wird zu ACT_KEY_PAIR_BASE + n und zurück", () => {
  assert.strictEqual(api.actionCodeToNumeric("PAIR_0"), 0x140);
  assert.strictEqual(api.actionCodeToNumeric("PAIR_15"), 0x14F);
  assert.strictEqual(api.actionCodeToNumeric("PAIR_16"), 0);
  assert.strictEqual(api.pairIndexFromCode("PAIR_x"), -1);
  assert.strictEqual(api.findDefinitionByCode(0x143).tap, "PAIR_3");
  assert.strictEqual(api.findDefinitionByCode(0x143).label, "Paar 3");
  // Als Tap- und als Halte-Aktion für SET_K
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "PAIR_2", hold: "PAIR_5" }) }, { tapCode: 0x142, holdCode: 0x145, dtapCode: 0 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_A", hold: "PAIR_1" }) }, { tapCode: 97, holdCode: 0x141, dtapCode: 0 });
});

test("Tastenpaar: nur normale Tasten und Modifier sind erlaubt", () => {
  for (const ok of ["KEY_LEFT_SHIFT", "KEY_PERIOD", "KEY_A", "KEY_F13", "KEY_RETURN", "KEY_RIGHT_GUI"]) {
    assert.ok(api.isKeyPairMember(ok), ok);
  }
  for (const bad of ["NONE", "", undefined, 5, "MO_1", "TG_2", "MEDIA_MUTE", "MAC_GLOBE", "MOUSE_LEFT", "PAIR_0", "LAYER_UP"]) {
    assert.ok(!api.isKeyPairMember(bad), String(bad));
  }
  assert.strictEqual(api.keyPairLabel({ first: "A", second: "B" }, c => c.toLowerCase()), "a + b");
});

test("Tastenpaar: Config-Validierung und Normalisierung", () => {
  const good = { layers: [[]], keyPairs: [{ first: "KEY_LEFT_SHIFT", second: "KEY_PERIOD" }] };
  api.validateConfigShape(good);
  assert.throws(() => api.validateConfigShape({ layers: [[]], keyPairs: "x" }));
  assert.throws(() => api.validateConfigShape({ layers: [[]], keyPairs: [{ first: "MO_1", second: "KEY_A" }] }));
  assert.throws(() => api.validateConfigShape({ layers: [[]], keyPairs: new Array(17).fill({ first: "KEY_A", second: "KEY_B" }) }));
  const n = api.normalizeConfig({ layers: [[]], keyPairs: [{ first: "KEY_A", second: "KEY_B", extra: 1 }, { first: "MO_1", second: "KEY_A" }, null] });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(n.keyPairs)), [{ first: "KEY_A", second: "KEY_B" }]);
  assert.deepStrictEqual([...api.normalizeConfig({ layers: [[]] }).keyPairs], []);
});

test("Tastenpaar: Codebereich ist in App, Server und Firmware identisch", () => {
  const ino = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "dactyl_right.ino"), "utf8");
  const py = fs.readFileSync(path.join(__dirname, "..", "server.py"), "utf8");
  assert.strictEqual(Number(/#define ACT_KEY_PAIR_BASE\s+(0x[0-9A-Fa-f]+)/.exec(ino)[1]), api.ACT_KEY_PAIR_BASE);
  assert.strictEqual(Number(/#define MAX_KEY_PAIRS\s+(\d+)/.exec(ino)[1]), api.MAX_KEY_PAIRS);
  assert.strictEqual(Number(/^MAX_KEY_PAIRS = (\d+)/m.exec(py)[1]), api.MAX_KEY_PAIRS);
  // Der Paarbereich überschneidet sich nicht mit Maus-Aktionen (0x130..0x134)
  assert.ok(api.ACT_KEY_PAIR_BASE > 0x134);
});

function sampleLayers() {
  return Array.from({ length: 8 }, (_, l) => [[{ label: `L${l}`, tap: `KEY_${l}`, hold: "NONE" }]]);
}

test("Ebenen-Werkzeug: Kopieren ersetzt nur das Ziel und teilt keine Objekte", () => {
  const layers = sampleLayers();
  const next = api.applyLayerOperation(layers, "copy", 1, 3);
  assert.strictEqual(next[3][0][0].tap, "KEY_1");
  assert.strictEqual(next[1][0][0].tap, "KEY_1");
  assert.strictEqual(next[2][0][0].tap, "KEY_2");
  next[3][0][0].tap = "KEY_X";
  assert.strictEqual(next[1][0][0].tap, "KEY_1");
  // Eingabe bleibt unverändert
  assert.strictEqual(layers[3][0][0].tap, "KEY_3");
});

test("Ebenen-Werkzeug: Tauschen und Leeren", () => {
  const layers = sampleLayers();
  const swapped = api.applyLayerOperation(layers, "swap", 0, 7);
  assert.strictEqual(swapped[0][0][0].tap, "KEY_7");
  assert.strictEqual(swapped[7][0][0].tap, "KEY_0");
  const cleared = api.applyLayerOperation(layers, "clear", 2);
  assert.strictEqual(cleared[2].length, 6);
  assert.ok(cleared[2].every(row => row.length === 7 && row.every(k => k.tap === "NONE" && k.hold === "NONE")));
  assert.strictEqual(cleared[1][0][0].tap, "KEY_1");
  assert.strictEqual(layers[2][0][0].tap, "KEY_2");
});

test("Ebenen-Werkzeug: ungültige Aufrufe ändern nichts", () => {
  const layers = sampleLayers();
  assert.strictEqual(api.applyLayerOperation(layers, "copy", 1, 1), null);
  assert.strictEqual(api.applyLayerOperation(layers, "copy", 1, 8), null);
  assert.strictEqual(api.applyLayerOperation(layers, "swap", -1, 2), null);
  assert.strictEqual(api.applyLayerOperation(layers, "move", 1, 2), null);
  assert.strictEqual(api.applyLayerOperation(null, "clear", 1), null);
  // Fehlende Ebenen werden transparent ergänzt
  const short = api.applyLayerOperation([[[{ tap: "KEY_A" }]]], "copy", 0, 5);
  assert.strictEqual(short.length, 8);
  assert.strictEqual(short[5][0][0].tap, "KEY_A");
  assert.strictEqual(short[3][0][0].tap, "NONE");
});

test("Rückgängig: Änderungen vor einem neueren Snapshot sind gesperrt", () => {
  const key = { snapshot: false }, snap = { snapshot: true };
  // Taste geändert, danach Ebene getauscht: die Tastenänderung darf nicht mehr einzeln zurück
  assert.strictEqual(api.isUndoBlocked([key, snap], 0), true);
  assert.strictEqual(api.isUndoBlocked([key, snap], 1), false);
  // Snapshot mit neueren Änderungen ist gesperrt, neuere Tastenänderung nicht
  assert.strictEqual(api.isUndoBlocked([snap, key], 0), true);
  assert.strictEqual(api.isUndoBlocked([snap, key], 1), false);
  // Ohne Snapshot ist jede Änderung einzeln rückgängig machbar
  assert.strictEqual(api.isUndoBlocked([key, key, key], 0), false);
  assert.strictEqual(api.isUndoBlocked([key], 5), true);
  // Ebene tauschen: Rückgängig stellt den Stand vor dem Tausch exakt wieder her
  const layers = sampleLayers();
  const before = JSON.stringify(layers);
  const swapped = api.applyLayerOperation(layers, "swap", 2, 5);
  assert.strictEqual(JSON.stringify(layers), before);
  assert.notStrictEqual(JSON.stringify(swapped), before);
});

test("Doppel-Tipp: Code wird mitgesendet, ohne Tap-Aktion ist er 0", () => {
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_J", hold: "KEY_LEFT_CTRL", dtap: "KEY_ESC" }) },
    { tapCode: 106, holdCode: 0x80, dtapCode: 0xB1 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "KEY_J", hold: "NONE", dtap: "PAIR_3" }) },
    { tapCode: 106, holdCode: 0, dtapCode: 0x143 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "NONE", hold: "NONE", dtap: "KEY_ESC" }) },
    { tapCode: 0, holdCode: 0, dtapCode: 0 });
  assert.deepStrictEqual({ ...api.keyToNumericActions({ tap: "NONE", hold: "MO_1", dtap: "KEY_ESC" }) },
    { tapCode: 0x101, holdCode: 0, dtapCode: 0 });
});

test("Doppel-Tipp: normalizeKeyCell und transparentLayer führen das Feld dtap", () => {
  assert.strictEqual(api.normalizeKeyCell({ tap: "KEY_J", dtap: "KEY_ESC" }).dtap, "KEY_ESC");
  assert.strictEqual(api.normalizeKeyCell({ tap: "KEY_J", dtap: 5 }).dtap, "NONE");
  assert.strictEqual(api.normalizeKeyCell({ tap: "KEY_J" }).dtap, "NONE");
  assert.strictEqual(api.normalizeKeyCell(null).dtap, "NONE");
  assert.strictEqual(api.transparentLayer()[0][0].dtap, "NONE");
  const n = api.normalizeConfig({ layers: [[[{ label: "J", tap: "KEY_J", hold: "NONE", dtap: "KEY_ESC" }]]] });
  assert.strictEqual(n.layers[0][0][0].dtap, "KEY_ESC");
});

test("Doppel-Tipp: GET_CONFIG-Matrizen setzen Tap, Halten und Doppel-Tipp", () => {
  const layers = [];
  const row = (v) => [v, 0, 0, 0, 0, 0, 0];
  assert.ok(api.applyMatrixData(layers, api.MATRIX_DATA_FIELDS["LAYER_DATA:"], { l: 1, k: [row(106)] }));
  assert.ok(api.applyMatrixData(layers, api.MATRIX_DATA_FIELDS["HOLD_DATA:"], { l: 1, k: [row(0x80)] }));
  assert.ok(api.applyMatrixData(layers, api.MATRIX_DATA_FIELDS["DTAP_DATA:"], { l: 1, k: [row(0xB1)] }));
  const key = layers[1][0][0];
  assert.strictEqual(key.tap, "KEY_J");
  assert.strictEqual(api.actionCodeToNumeric(key.hold), 0x80);
  assert.strictEqual(key.dtap, "KEY_ESC");
  assert.strictEqual(layers[1][0][1].dtap, "NONE");
  // Neues LAYER_DATA setzt Halten und Doppel-Tipp zurück (sie folgen danach erneut)
  api.applyMatrixData(layers, "tap", { l: 1, k: [row(107)] });
  assert.strictEqual(layers[1][0][0].dtap, "NONE");
  // Ungültige Daten werden abgelehnt
  assert.strictEqual(api.applyMatrixData(layers, "dtap", { l: 8, k: [] }), false);
  assert.strictEqual(api.applyMatrixData(layers, undefined, { l: 0, k: [] }), false);
  api.applyMatrixData(layers, "dtap", { l: 1, k: [[70000, -1, 1.5]] });
  assert.strictEqual(layers[1][0][0].dtap, "NONE");
});

console.log(`\n${passed} app.js-Tests bestanden.`);
