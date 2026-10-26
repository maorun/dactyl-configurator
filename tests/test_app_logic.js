// Unit-Tests für die DOM-freien Hilfsfunktionen der Web-App (Action-Codes, Sanitizing, Config-Validierung).
// Ausführen: node tests/test_app_logic.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const read = rel => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

// Schneidet reine Logik-Abschnitte aus einer Datei mit DOM-Zugriffen aus
function section(file, startMarker, endMarker) {
  const src = read(file);
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Abschnitt nicht gefunden: ${file}: ${startMarker}`);
  return src.slice(start, end);
}

// Reihenfolge wie im Browser (index.html); keycodes.js und config-model.js sind ganz DOM-frei
const code = [
  ...["js/side-profiles.js", "js/side-right.js", "js/side-left.js", "js/side-state.js", "js/keycodes.js",
      "js/config-model.js"].map(read),
  section("js/editor.js", "// Alte Configs speichern Modifier-Halte-Aktionen", "function appendOptionGroup"),
  section("js/editor.js", "// Sichtbarkeit der Optionen bei einer Suche", "// Auswahl-IDs, deren Suche"),
  section("js/keyboard-hooks.js", "const ACTION_CODE_TO_EVENT_CODES", "// Gehaltene MO_x-Ebene einer Hälfte"),
  section("js/keyboard-hooks.js", "// Löst einen Browser-Tastencode für eine Hälfte auf", "// Alle Treffer eines Tastendrucks")
].join("\n");

const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${code}
this.api = { keyToNumericActions, sanitizeCommandText, clampSetting, validateConfigShape,
             normalizeConfig, isPhysicalKey, findDefinitionByCode, actionCodeToNumeric, SETTINGS_RANGES,
             LEGACY_HOLD_CODES, normalizeHoldCode, holdSublabel,
             createTypingStats, recordKeyPress, computeWpm, heatLevel, maxKeyCount, WPM_WINDOW_MS, HEAT_LEVELS,
             isWiredSwitch, createMatrixTest, markMatrixKeyTested, summarizeMatrixTest,
             SIDE_PROFILES,
             applyLayerOperation, transparentLayer, isUndoBlocked,
             ACT_KEY_PAIR_BASE, MAX_KEY_PAIRS, pairIndexFromCode, isKeyPairMember, keyPairLabel,
             applyMatrixData, MATRIX_DATA_FIELDS, normalizeKeyCell,
             DE_MAC_CHARS, charPairCode, charPairIndexFromCode, findKeyPairIndex, deMacCharForCode,
             resolveCharPairActions, keycodeOptionMatches, isKeyPairUsed, appendResolvedPairs, revertResolvedPairs,
             removeKeyPairAt, KEYCODES, UMLAUT_LABELS, holdSublabel,
             planKeyPairDeletion, hasPendingPairChange, keyNeedsStagedPairs,
             deMacCharGroup, keycodeOptionTree, OPTIONAL_ACTION_PREFIX, filterOptionNodes, selectFilterHint,
             ACTION_CODE_TO_EVENT_CODES, findKeyForEventCode, resolveKeyForSide, browserKeySides };`, ctx);
const api = ctx.api;
const R = api.SIDE_PROFILES.R;
const L = api.SIDE_PROFILES.L;

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
  }, R));
});

test("Config-Validierung: Import einer rechten Config in die linke Hälfte wird abgelehnt", () => {
  const rightCfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "default_config.json"), "utf8"));
  assert.doesNotThrow(() => api.validateConfigShape(rightCfg, R));
  // Die rechte Belegung legt auf R5C0 und R4C5 Aktionen, die links nicht existieren
  assert.throws(() => api.validateConfigShape(rightCfg, L), /R5C0 \(Ebene 0\)/);
  const leftCfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "default_config_left.json"), "utf8"));
  assert.doesNotThrow(() => api.validateConfigShape(leftCfg, L));
  assert.throws(() => api.validateConfigShape({ layers: [[]], combos: [{ key1: { r: 4, c: 5 }, key2: { r: 0, c: 0 } }] }, L), /Combo 1/);
});

test("Config-Normalisierung: Namen, Einstellungen und Zellen werden bereinigt", () => {
  const n = api.normalizeConfig({
    layers: [[[{ tap: "KEY_A", label: 1 }]]],
    layerNames: ["A\nB"],
    settings: { debounceMs: 0, deviceName: "Dac\"tyl" },
    combos: [{ key1: { r: 9, c: 0 }, key2: { r: 0, c: 0 } }]
  }, R);
  assert.strictEqual(n.layerNames.length, 8);
  assert.strictEqual(n.layerNames[0], "AB");
  assert.strictEqual(n.layerNames[1], "Nav & Pfeile");
  assert.strictEqual(n.settings.debounceMs, 1);
  assert.strictEqual(n.settings.tappingTermMs, 200);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { tappingTermMs: 900 } }, R).settings.tappingTermMs, 500);
  assert.strictEqual(n.settings.deviceName, "Dactyl");
  assert.strictEqual(n.layers[0][0][0].label, "");
  assert.strictEqual(n.layers[0][0][0].hold, "NONE");
  assert.strictEqual(n.combos.length, 0);
});

test("Physische Tasten: R4C0 und R5C5 existieren nicht", () => {
  assert.ok(!api.isPhysicalKey(4, 0, R));
  assert.ok(!api.isPhysicalKey(5, 5, R));
  assert.ok(api.isPhysicalKey(5, 6, R));
  assert.ok(api.isPhysicalKey(0, 0, R));
});

test("Physische Tasten links: R4C5 und R5C0 existieren nicht (gespiegelt)", () => {
  assert.ok(!api.isPhysicalKey(4, 5, L));
  assert.ok(!api.isPhysicalKey(5, 0, L));
  assert.ok(api.isPhysicalKey(4, 0, L));
  assert.ok(api.isPhysicalKey(5, 5, L));
});

test("Gerätename ohne Eintrag hängt von der Hälfte ab", () => {
  assert.strictEqual(api.normalizeConfig({ layers: [[]] }, R).settings.deviceName, "Dactyl Keyboard");
  assert.strictEqual(api.normalizeConfig({ layers: [[]] }, L).settings.deviceName, "Dactyl Links");
});

test("Heatmap: nur physische Tasten der Matrix werden gezählt", () => {
  const s = api.createTypingStats(null, R);
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
  const s = api.createTypingStats(JSON.parse('{"0_0": 3, "4_0": 9, "9_9": 1, "1_1": -2, "2_2": 1.5, "__proto__": 4, "x": 1, "5_6": 2}'), R);
  assert.deepStrictEqual({ ...s.counts }, { "0_0": 3, "5_6": 2 });
  assert.ok(!Object.prototype.hasOwnProperty.call(s.counts, "__proto__"));
  assert.strictEqual(typeof Object.getPrototypeOf(s.counts).hasOwnProperty, "function");
  assert.strictEqual(s.total, 5);
  assert.strictEqual(api.createTypingStats("kaputt", R).total, 0);
  assert.strictEqual(api.createTypingStats([1, 2], R).total, 0);
});

test("Heatmap links: R4C0 zählt, R4C5 und R5C0 zählen nicht", () => {
  const s = api.createTypingStats(JSON.parse('{"4_0": 2, "4_5": 9, "5_0": 4}'), L);
  assert.deepStrictEqual({ ...s.counts }, { "4_0": 2 });
  assert.strictEqual(api.recordKeyPress(s, 4, 5, 0), false);
  assert.strictEqual(api.recordKeyPress(s, 5, 0, 0), false);
  assert.strictEqual(api.recordKeyPress(s, 5, 5, 0), true);
});

test("WPM: gleitendes 60-s-Fenster mit 5 Anschlägen pro Wort", () => {
  const s = api.createTypingStats(null, R);
  for (let i = 0; i < 50; i++) api.recordKeyPress(s, 0, 1, i * 100);
  assert.strictEqual(api.computeWpm(s, 5000), 10);
  // Anschläge älter als das Fenster fallen heraus
  assert.strictEqual(api.computeWpm(s, api.WPM_WINDOW_MS + 2400), 5);
  assert.strictEqual(api.computeWpm(s, api.WPM_WINDOW_MS + 10000), 0);
  // Gesamtzähler bleibt unabhängig vom Fenster
  assert.strictEqual(s.total, 50);
});

test("WPM: Fenstergrenze und Zeitstempel in falscher Reihenfolge", () => {
  const s = api.createTypingStats(null, R);
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
  const s = api.createTypingStats({ "0_0": 3, "1_1": 7 }, R);
  assert.strictEqual(api.maxKeyCount(s), 7);
  assert.strictEqual(api.maxKeyCount(api.createTypingStats(null, R)), 0);
});

test("Matrix-Test: 35 verlötete Schalter (29 Finger + 6 Daumen ohne R4C0/R5C5)", () => {
  let n = 0;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (api.isWiredSwitch(r, c, R)) n++;
  assert.strictEqual(n, 35);
  assert.ok(!api.isWiredSwitch(4, 0, R));
  assert.ok(!api.isWiredSwitch(5, 5, R));
  assert.ok(!api.isWiredSwitch(0, 6, R)); // Col 6 nur im Daumen-Cluster
  assert.ok(api.isWiredSwitch(5, 6, R));
  assert.strictEqual(api.summarizeMatrixTest(api.createMatrixTest(R)).total, 35);
});

test("Matrix-Test links: 35 Schalter ohne R4C5/R5C0", () => {
  let n = 0;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (api.isWiredSwitch(r, c, L)) n++;
  assert.strictEqual(n, 35);
  assert.ok(!api.isWiredSwitch(4, 5, L));
  assert.ok(!api.isWiredSwitch(5, 0, L));
  assert.ok(api.isWiredSwitch(4, 0, L));
  assert.ok(api.isWiredSwitch(5, 5, L));
  const t = api.createMatrixTest(L);
  assert.strictEqual(api.markMatrixKeyTested(t, 4, 0), true);
  assert.strictEqual(api.markMatrixKeyTested(t, 4, 5), false);
});

test("Matrix-Test: Tasten werden einmalig und nur innerhalb der Matrix gezählt", () => {
  const t = api.createMatrixTest(R);
  assert.strictEqual(api.markMatrixKeyTested(t, 2, 1), true);
  assert.strictEqual(api.markMatrixKeyTested(t, 2, 1), false);
  assert.strictEqual(api.markMatrixKeyTested(t, 4, 0), false);
  assert.strictEqual(api.markMatrixKeyTested(t, 6, 0), false);
  assert.strictEqual(api.markMatrixKeyTested(t, 1, "1"), false);
  assert.strictEqual(api.summarizeMatrixTest(t).tested, 1);
});

test("Matrix-Test: Zeilen und Spalten ohne Treffer gelten als verdächtig", () => {
  const t = api.createMatrixTest(R);
  // Ohne Tastendruck keine Verdachtsmeldung
  assert.deepStrictEqual([...api.summarizeMatrixTest(t).suspectRows], []);
  // Alle Tasten außer Row 3 drücken
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (r !== 3) api.markMatrixKeyTested(t, r, c);
  const s = api.summarizeMatrixTest(t);
  assert.deepStrictEqual([...s.suspectRows], [3]);
  assert.deepStrictEqual([...s.suspectCols], []);
  assert.strictEqual(s.tested, 35 - 6);
  // Fehlende Spalte 6 (nur R5C6) wird erkannt
  const t2 = api.createMatrixTest(R);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) api.markMatrixKeyTested(t2, r, c);
  assert.deepStrictEqual([...api.summarizeMatrixTest(t2).suspectCols], [6]);
});

test("Matrix-Test: Leitungsliste entspricht ROW_PINS/COL_PINS der Firmware", () => {
  const ino = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "dactyl_right.ino"), "utf8");
  const pins = name => ino.match(new RegExp(name + "\\s*\\[[^\\]]*\\]\\s*=\\s*\\{([^}]*)\\}"))[1].split(",").map(v => Number(v.trim()));
  assert.deepStrictEqual([...R.rowWires.map(w => w.gpio)], pins("ROW_PINS"));
  assert.deepStrictEqual([...R.colWires.map(w => w.gpio)], pins("COL_PINS"));
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
  const n = api.normalizeConfig({ layers: [[]], keyPairs: [{ first: "KEY_A", second: "KEY_B", extra: 1 }, { first: "MO_1", second: "KEY_A" }, null] }, R);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(n.keyPairs)), [{ first: "KEY_A", second: "KEY_B" }]);
  assert.deepStrictEqual([...api.normalizeConfig({ layers: [[]] }, R).keyPairs], []);
});

test("Tastenpaar: Codebereich ist in App, Server und Firmware identisch", () => {
  // Aktionscodes und Key-Pair-Typen gelten für beide Hälften und stehen in DactylCommon.h
  const common = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "DactylCommon.h"), "utf8");
  const py = fs.readFileSync(path.join(__dirname, "..", "server.py"), "utf8");
  assert.strictEqual(Number(/#define ACT_KEY_PAIR_BASE\s+(0x[0-9A-Fa-f]+)/.exec(common)[1]), api.ACT_KEY_PAIR_BASE);
  assert.strictEqual(Number(/#define MAX_KEY_PAIRS\s+(\d+)/.exec(common)[1]), api.MAX_KEY_PAIRS);
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
  const n = api.normalizeConfig({ layers: [[[{ label: "J", tap: "KEY_J", hold: "NONE", dtap: "KEY_ESC" }]]] }, R);
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

// Zeichen, die dactylAsciiToHid (DactylKeycodes.h) in einen HID-Code übersetzt
const asciiHeader = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "DactylKeycodes.h"), "utf8");
const asciiStart = asciiHeader.indexOf("dactylAsciiToHid");
const asciiFn = asciiHeader.slice(asciiStart, asciiHeader.indexOf("0x00;", asciiStart));
const firmwareAscii = new Set([...asciiFn.matchAll(/c == '(\\.|[^'])'/g)].map(m => m[1].length === 2 ? m[1][1] : m[1]));

test("Sonderzeichen: Einzelcodes sind druckbare ASCII-Zeichen, die die Firmware sendet", () => {
  const singles = api.DE_MAC_CHARS.filter(e => e.code && e.code.length === 1);
  assert.ok(singles.length >= 21);
  for (const e of singles) {
    assert.ok(firmwareAscii.has(e.code), `${e.char}: ${e.code} fehlt in dactylAsciiToHid`);
    const n = api.actionCodeToNumeric(e.code);
    assert.ok(n >= 0x20 && n <= 0x7E, e.char);
    // macOS-Layout "U.S.": der ASCII-Code ist das Zeichen selbst
    assert.strictEqual(e.code, e.char, e.char);
    // GET_CONFIG-Rückweg ergibt denselben Zahlencode
    assert.strictEqual(api.actionCodeToNumeric(api.findDefinitionByCode(n).tap), n, e.char);
  }
  for (const ch of ["<", ">", "^", "~", "+", ":", "@", "|"]) {
    assert.ok(singles.some(e => e.char === ch), `${ch} fehlt`);
  }
  assert.strictEqual(new Set(api.DE_MAC_CHARS.map(e => e.char)).size, api.DE_MAC_CHARS.length);
});

test("Sonderzeichen: § über die ISO-Taste (HID 0x64), ° € ´ über Option-Paare", () => {
  const byChar = Object.fromEntries(api.DE_MAC_CHARS.map(e => [e.char, e]));
  assert.strictEqual(byChar["§"].code, "KEY_NON_US_BACKSLASH");
  // Firmware-Konstante: 0xEC, press() sendet code - 136 = HID 0x64
  const m = /const uint8_t KEY_NON_US_BACKSLASH = (0x[0-9A-F]+);/.exec(asciiHeader);
  assert.ok(m, "KEY_NON_US_BACKSLASH fehlt in DactylKeycodes.h");
  assert.strictEqual(api.actionCodeToNumeric("KEY_NON_US_BACKSLASH"), Number(m[1]));
  assert.strictEqual(Number(m[1]) - 136, 0x64);
  assert.deepStrictEqual({ ...api.findDefinitionByCode(0xEC) }, { label: "§", tap: "KEY_NON_US_BACKSLASH" });
  // Option-Zeichen des Layouts "U.S."
  assert.deepStrictEqual({ ...byChar["°"].pair }, { first: "KEY_LEFT_ALT", second: "*" });
  assert.deepStrictEqual({ ...byChar["€"].pair }, { first: "KEY_LEFT_ALT", second: "@" });
  assert.deepStrictEqual({ ...byChar["´"].pair }, { first: "KEY_LEFT_ALT", second: "KEY_E" });
});

test("Umlaute: Aktionscodes 0x150..0x156 wie DactylCommon.h, Labels und Rückweg", () => {
  const common = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "DactylCommon.h"), "utf8");
  const fw = name => Number(new RegExp(`#define ACT_${name}\\s+(0x[0-9A-F]+)`).exec(common)[1]);
  const expected = { UMLAUT_AE: "ä", UMLAUT_OE: "ö", UMLAUT_UE: "ü", UMLAUT_AE_UPPER: "Ä", UMLAUT_OE_UPPER: "Ö", UMLAUT_UE_UPPER: "Ü", UMLAUT_SZ: "ß" };
  assert.deepStrictEqual({ ...api.UMLAUT_LABELS }, expected);
  for (const [code, label] of Object.entries(expected)) {
    const n = api.actionCodeToNumeric(code);
    assert.strictEqual(n, fw(code), code);
    assert.deepStrictEqual({ ...api.findDefinitionByCode(n) }, { label, tap: code });
    assert.strictEqual(api.holdSublabel(code), label);
    assert.ok(!api.isKeyPairMember(code), `${code} ist kein Paar-Mitglied`);
  }
  assert.strictEqual(fw("UMLAUT_BASE"), 0x150);
  assert.strictEqual(Number(/#define NUM_UMLAUT_ACTIONS\s+(\d+)/.exec(common)[1]), Object.keys(expected).length);
  // Die Auswahl bietet die Umlaut-Aktionen an, nicht mehr die US-Tasten mit deutscher Beschriftung
  const all = api.KEYCODES.flatMap(g => g.keys);
  for (const code of Object.keys(expected)) assert.ok(all.some(k => k.code === code), code);
  assert.ok(!all.some(k => /\(Ger\)/.test(k.label)));
});

test("Preset Deutsch QWERTZ: Umlaut-Aktionen und US-Codes, keine deutschen Beschriftungen auf US-Tasten", () => {
  const usLabel = { KEY_SEMICOLON: ";", KEY_QUOTE: "'", KEY_LEFT_BRACKET: "[", KEY_RIGHT_BRACKET: "]", KEY_MINUS: "-",
                    KEY_SLASH: "/", KEY_EQUAL: "=", KEY_BACKSLASH: "\\", KEY_GRAVE: "`", KEY_Z: "Z", KEY_Y: "Y" };
  const files = { de_qwertz: R.presets.de_qwertz.layers, us_qwerty: R.presets.us_qwerty.layers,
                  default_config: JSON.parse(fs.readFileSync(path.join(__dirname, "..", "default_config.json"), "utf8")).layers,
                  default_config_left: JSON.parse(fs.readFileSync(path.join(__dirname, "..", "default_config_left.json"), "utf8")).layers };
  for (const [name, layers] of Object.entries(files)) {
    layers.forEach((layer, l) => layer.forEach((row, r) => row.forEach((cell, c) => {
      if (cell && usLabel[cell.tap] !== undefined) assert.strictEqual(cell.label, usLabel[cell.tap], `${name} L${l} R${r}C${c}`);
    })));
  }
  const base = R.presets.de_qwertz.layers[0];
  assert.deepStrictEqual([base[0][5].tap, base[1][0].tap, base[1][5].tap, base[2][4].tap, base[2][5].tap, base[3][4].tap],
                         ["UMLAUT_SZ", "KEY_Z", "UMLAUT_UE", "UMLAUT_OE", "UMLAUT_AE", "KEY_MINUS"]);
});

test("Sonderzeichen: Label aus GET_CONFIG-Codes", () => {
  assert.strictEqual(api.findDefinitionByCode(62).label, ">");
  assert.strictEqual(api.findDefinitionByCode(62).tap, ">");
  assert.strictEqual(api.findDefinitionByCode(126).label, "~");
  assert.strictEqual(api.findDefinitionByCode(43).label, "+");
  assert.strictEqual(api.findDefinitionByCode(93).label, "]"); // KEY_RIGHT_BRACKET bleibt eigener Eintrag
  assert.strictEqual(api.deMacCharForCode("&"), "&");
  assert.strictEqual(api.deMacCharForCode("KEY_NON_US_BACKSLASH"), "§");
  assert.strictEqual(api.deMacCharForCode("KEY_A"), null);
});

test("Sonderzeichen: Option-Zeichen bestehen aus Tastenpaar-Mitgliedern", () => {
  const pairs = api.DE_MAC_CHARS.filter(e => e.pair);
  assert.ok(pairs.length >= 3);
  for (const e of pairs) {
    assert.ok(api.isKeyPairMember(e.pair.first) && api.isKeyPairMember(e.pair.second), e.char);
  }
  const deg = api.DE_MAC_CHARS.findIndex(e => e.char === "°");
  assert.strictEqual(api.charPairIndexFromCode(api.charPairCode(deg)), deg);
  const colon = api.DE_MAC_CHARS.findIndex(e => e.char === ":");
  assert.strictEqual(api.charPairIndexFromCode(api.charPairCode(colon)), -1); // Einzelcode, kein Paar
  for (const bad of ["CHAR_PAIR_99", "CHAR_PAIR_x", "PAIR_0", "", undefined]) {
    assert.strictEqual(api.charPairIndexFromCode(bad), -1, String(bad));
  }
});

test("Sonderzeichen: CHAR_PAIR wird zu PAIR_<n> aufgelöst, gleiche Paare werden wiederverwendet", () => {
  const deg = api.charPairCode(api.DE_MAC_CHARS.findIndex(e => e.char === "°"));
  const euro = api.charPairCode(api.DE_MAC_CHARS.findIndex(e => e.char === "€"));
  const existing = [{ first: "KEY_LEFT_SHIFT", second: "KEY_PERIOD" }, { first: "KEY_LEFT_ALT", second: "*" }];
  // Vorhandenes Paar Alt + *
  let res = api.resolveCharPairActions({ tap: deg, hold: "NONE", dtap: "NONE" }, existing);
  assert.deepStrictEqual({ ...res.actions }, { tap: "PAIR_1", hold: "NONE", dtap: "NONE" });
  assert.strictEqual(res.added.length, 0);
  // Neues Paar, zweimal gewählt: nur einmal angehängt; Eingabe bleibt unverändert
  res = api.resolveCharPairActions({ tap: euro, hold: "KEY_A", dtap: euro }, existing);
  assert.deepStrictEqual({ ...res.actions }, { tap: "PAIR_2", hold: "KEY_A", dtap: "PAIR_2" });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(res.added)), [{ first: "KEY_LEFT_ALT", second: "@" }]);
  assert.strictEqual(existing.length, 2);
  // Ohne CHAR_PAIR keine Änderung
  res = api.resolveCharPairActions({ tap: ">", hold: "NONE", dtap: "NONE" }, []);
  assert.deepStrictEqual({ ...res.actions }, { tap: ">", hold: "NONE", dtap: "NONE" });
  // Voller Speicher: neues Paar nicht möglich, vorhandenes Paar weiterhin
  const full = Array.from({ length: api.MAX_KEY_PAIRS }, (_, i) => i === 3 ? { first: "KEY_LEFT_ALT", second: "*" } : { first: "KEY_A", second: "KEY_B" });
  assert.strictEqual(api.resolveCharPairActions({ tap: euro }, full), null);
  assert.strictEqual(api.resolveCharPairActions({ tap: deg }, full).actions.tap, "PAIR_3");
  // Vergleich über Zahlencodes: "l" und KEY_L sind dasselbe Mitglied, die Reihenfolge zählt
  assert.strictEqual(api.findKeyPairIndex([{ first: "KEY_LEFT_ALT", second: "l" }], { first: "KEY_LEFT_ALT", second: "KEY_L" }), 0);
  assert.strictEqual(api.findKeyPairIndex([{ first: "KEY_L", second: "KEY_LEFT_ALT" }], { first: "KEY_LEFT_ALT", second: "KEY_L" }), -1);
});

test("Tastenpaar: Nutzung durch Tap, Halten oder Doppel-Tipp wird erkannt", () => {
  const layers = [[[{ tap: "KEY_A", hold: "PAIR_1", dtap: "NONE" }]], [[null, { tap: "PAIR_3" }]], [[{ tap: "KEY_B", dtap: "PAIR_4" }]]];
  assert.ok(api.isKeyPairUsed(layers, 1));
  assert.ok(api.isKeyPairUsed(layers, 3));
  assert.ok(api.isKeyPairUsed(layers, 4));
  assert.ok(!api.isKeyPairUsed(layers, 0));
  assert.ok(!api.isKeyPairUsed([], 0));
  assert.ok(!api.isKeyPairUsed(undefined, 0));
});

test("Sonderzeichen: Übernehmen hängt Paare an, Rückgängig entfernt nur ungenutzte Paare am Ende", () => {
  const deg = api.charPairCode(api.DE_MAC_CHARS.findIndex(e => e.char === "°"));
  const euro = api.charPairCode(api.DE_MAC_CHARS.findIndex(e => e.char === "€"));
  const pairs = [{ first: "KEY_LEFT_SHIFT", second: "KEY_PERIOD" }];
  const layers = [[[{ label: "A", tap: "KEY_A", hold: "NONE", dtap: "NONE" }]]];
  // Taste R0C0: Tap = °, Doppel-Tipp = € -> zwei neue Paare 1 und 2
  const res = api.resolveCharPairActions({ tap: deg, hold: "NONE", dtap: euro }, pairs);
  const first = api.appendResolvedPairs(pairs, res.added);
  assert.strictEqual(first, 1);
  assert.strictEqual(pairs.length, 3);
  layers[0][0][0] = { label: "°", ...res.actions };
  assert.strictEqual(layers[0][0][0].tap, "PAIR_1");
  assert.strictEqual(layers[0][0][0].dtap, "PAIR_2");
  // Revert bei weiterhin genutzter Taste (z. B. andere Taste nutzt PAIR_2): nichts oberhalb wird entfernt
  const other = [[[{ tap: "KEY_A" }, { tap: "PAIR_2" }]]];
  assert.strictEqual(api.revertResolvedPairs([...pairs], other, first, res.added.length), 0);
  // Revert, nachdem ein weiteres Paar angehängt wurde: Paare stehen nicht mehr am Ende
  assert.strictEqual(api.revertResolvedPairs([...pairs, { first: "KEY_A", second: "KEY_B" }], [[[{ tap: "KEY_A" }]]], first, res.added.length), 0);
  // Normaler Revert: Taste wieder alt, beide Paare entfernt, vorhandenes Paar 0 bleibt
  layers[0][0][0] = { label: "A", tap: "KEY_A", hold: "NONE", dtap: "NONE" };
  assert.strictEqual(api.revertResolvedPairs(pairs, layers, first, res.added.length), 2);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(pairs)), [{ first: "KEY_LEFT_SHIFT", second: "KEY_PERIOD" }]);
  // Ohne neue Paare entfernt der Revert nichts
  assert.strictEqual(api.revertResolvedPairs(pairs, layers, 1, 0), 0);
  assert.strictEqual(pairs.length, 1);
});

test("Tastenpaar: jedes Paar ist löschbar, Verweise werden neu nummeriert", () => {
  const p = (a, b) => ({ first: a, second: b });
  const config = {
    keyPairs: [p("KEY_A", "KEY_B"), p("KEY_LEFT_SHIFT", "KEY_PERIOD"), p("KEY_LEFT_ALT", "KEY_L")],
    layers: [
      [[{ label: "x", tap: "PAIR_0", hold: "PAIR_1", dtap: "PAIR_2" }, { label: "y", tap: "KEY_A", hold: "NONE", dtap: "NONE" }]],
      [["PAIR_2", null]]
    ],
    combos: [{ id: "c1", action: "PAIR_1" }, { id: "c2", action: "PAIR_2" }, { id: "c3", action: "KEY_ESC" }]
  };
  const before = JSON.stringify(config);
  // Mittleres Paar löschen: PAIR_1 wird leer, PAIR_2 rückt auf PAIR_1, PAIR_0 bleibt
  const mid = JSON.parse(JSON.stringify(api.removeKeyPairAt(config, 1)));
  assert.deepStrictEqual(mid.keyPairs, [p("KEY_A", "KEY_B"), p("KEY_LEFT_ALT", "KEY_L")]);
  assert.deepStrictEqual(mid.layers[0][0][0], { label: "x", tap: "PAIR_0", hold: "NONE", dtap: "PAIR_1" });
  assert.deepStrictEqual(mid.layers[0][0][1], { label: "y", tap: "KEY_A", hold: "NONE", dtap: "NONE" });
  assert.deepStrictEqual(mid.layers[1][0], ["PAIR_1", null]);
  assert.deepStrictEqual(mid.combos.map(c => c.action), ["NONE", "PAIR_1", "KEY_ESC"]);
  assert.strictEqual(JSON.stringify(config), before); // Eingabe unverändert (Revert nutzt den alten Stand)
  // Erstes Paar löschen: alle Verweise rücken auf
  const first = JSON.parse(JSON.stringify(api.removeKeyPairAt(config, 0)));
  assert.deepStrictEqual(first.layers[0][0][0], { label: "x", tap: "NONE", hold: "PAIR_0", dtap: "PAIR_1" });
  // Letztes Paar löschen: nur dessen Verweise werden leer
  const last = JSON.parse(JSON.stringify(api.removeKeyPairAt(config, 2)));
  assert.deepStrictEqual(last.layers[0][0][0], { label: "x", tap: "PAIR_0", hold: "PAIR_1", dtap: "NONE" });
  assert.deepStrictEqual(last.combos.map(c => c.action), ["PAIR_1", "NONE", "KEY_ESC"]);
  // Ungültiger Index
  assert.strictEqual(api.removeKeyPairAt(config, 3), null);
  assert.strictEqual(api.removeKeyPairAt(config, -1), null);
  assert.strictEqual(api.removeKeyPairAt({ layers: [] }, 0), null);
});

test("Suchfeld: Teilstring ohne Groß-/Kleinschreibung", () => {
  assert.ok(api.keycodeOptionMatches(": Doppelpunkt (Shift + .)", "doppel"));
  assert.ok(api.keycodeOptionMatches(": Doppelpunkt (Shift + .)", "DOPPEL"));
  assert.ok(api.keycodeOptionMatches(": Doppelpunkt (Shift + .)", " : "));
  assert.ok(!api.keycodeOptionMatches("A (KEY_A)", "zz"));
  assert.ok(api.keycodeOptionMatches("A (KEY_A)", ""));
  assert.ok(api.keycodeOptionMatches("A (KEY_A)", undefined));
  assert.ok(!api.keycodeOptionMatches(undefined, "a"));
});

const p = (a, b) => ({ first: a, second: b });

test("Tastenpaar: alte Zellen im String-Format zählen als Nutzung", () => {
  const layers = [[["PAIR_2", "KEY_A"]], [[{ tap: "KEY_B", hold: "NONE", dtap: "NONE" }]]];
  assert.ok(api.isKeyPairUsed(layers, 2));
  assert.ok(!api.isKeyPairUsed(layers, 1));
  assert.ok(!api.isKeyPairUsed([[["PAIR_20"]]], 2));
  // deleteKeyPair fragt deshalb nach und removeKeyPairAt leert die Zelle
  const plan = api.planKeyPairDeletion({ keyPairs: [p("KEY_A", "KEY_B"), p("KEY_C", "KEY_D"), p("KEY_E", "KEY_F")], layers, combos: [] }, 2);
  assert.strictEqual(plan.used, true);
  assert.strictEqual(plan.next.layers[0][0][0], "NONE");
});

test("Tastenpaar löschen: Nachfrage, Snapshot-Zustand und Revert", () => {
  const config = {
    keyPairs: [p("KEY_A", "KEY_B"), p("KEY_C", "KEY_D")],
    layers: [[[{ label: "x", tap: "PAIR_1", hold: "NONE", dtap: "NONE" }, { label: "y", tap: "KEY_A", hold: "NONE", dtap: "NONE" }]]],
    combos: [{ id: 1, action: "PAIR_0" }]
  };
  const before = JSON.stringify(config);
  // Paar 1 nutzt eine Taste, Paar 0 eine Combo: beide fragen nach
  assert.strictEqual(api.planKeyPairDeletion(config, 1).used, true);
  const plan0 = api.planKeyPairDeletion(config, 0);
  assert.strictEqual(plan0.used, true);
  assert.strictEqual(plan0.shiftsFollowing, true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(plan0.removed)), { first: "KEY_A", second: "KEY_B" });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(plan0.next.keyPairs)), [{ first: "KEY_C", second: "KEY_D" }]);
  assert.strictEqual(plan0.next.layers[0][0][0].tap, "PAIR_0");
  assert.strictEqual(plan0.next.combos[0].action, "NONE");
  // Revert-Zustand: Paare, Ebenen und Combos wie vorher, unabhängig vom Original
  assert.strictEqual(JSON.stringify(plan0.old), JSON.stringify({ keyPairs: config.keyPairs, layers: config.layers, combos: config.combos }));
  plan0.old.layers[0][0][0].tap = "MUTATED";
  assert.strictEqual(JSON.stringify(config), before);
  // Ungenutztes letztes Paar: keine Nachfrage, nichts rückt auf
  const unused = api.planKeyPairDeletion({ keyPairs: config.keyPairs, layers: [[[]]], combos: [] }, 1);
  assert.strictEqual(unused.used, false);
  assert.strictEqual(unused.shiftsFollowing, false);
  assert.strictEqual(api.planKeyPairDeletion(config, 5), null);
});

test("Tastenpaar: Taste mit noch nicht synchronisierter Paar-Tabelle wird nur vorgemerkt", () => {
  const pending = [{ type: "key_pair", pairs: true }];
  assert.ok(api.hasPendingPairChange(pending));
  assert.ok(!api.hasPendingPairChange([{ type: "key" }, { type: "preset", snapshot: true }]));
  assert.ok(!api.hasPendingPairChange(undefined));
  assert.ok(api.keyNeedsStagedPairs({ tap: "PAIR_0", hold: "NONE", dtap: "NONE" }, pending));
  assert.ok(api.keyNeedsStagedPairs({ tap: "KEY_A", hold: "NONE", dtap: "PAIR_3" }, pending));
  assert.ok(!api.keyNeedsStagedPairs({ tap: "KEY_A", hold: "KEY_LEFT_CTRL", dtap: "NONE" }, pending));
  // Synchronisierte Paare: Taste darf sofort per SET_KEY gesendet werden
  assert.ok(!api.keyNeedsStagedPairs({ tap: "PAIR_0", hold: "NONE", dtap: "NONE" }, [{ type: "key" }]));
});

test("Optionslisten: Gruppenposition, Präfix und Combo ohne Tastenpaar-Zeichen", () => {
  const groupLabels = tree => tree.filter(n => n.options).map(n => n.label);
  const primary = api.keycodeOptionTree({ charPairs: true });
  const labels = groupLabels(primary);
  assert.strictEqual(labels[labels.indexOf("Zahlen & Symbole") + 1], "Sonderzeichen (macOS US)");
  const values = tree => tree.flatMap(n => (n.options ? n.options.map(o => o.value) : [n.value]));
  const pairChars = api.DE_MAC_CHARS.map((e, i) => (e.pair ? api.charPairCode(i) : null)).filter(Boolean);
  assert.ok(pairChars.length > 0);
  pairChars.forEach(code => assert.ok(values(primary).includes(code)));
  // Combo: keine Option-Zeichen, die ein Tastenpaar brauchen
  const combo = api.keycodeOptionTree();
  pairChars.forEach(code => assert.ok(!values(combo).includes(code)));
  assert.ok(values(combo).includes("KEY_NON_US_BACKSLASH"));
  // Halten: "Keine" oben, Präfix vor jeder Option, kein zweites NONE
  const hold = api.keycodeOptionTree({ holdMode: true, charPairs: true });
  assert.strictEqual(hold[0].value, "NONE");
  assert.strictEqual(values(hold).filter(v => v === "NONE").length, 1);
  hold.filter(n => n.options).forEach(g => g.options.forEach(o => assert.ok(o.text.startsWith("Halten = "), o.text)));
  const dtap = api.keycodeOptionTree({ holdMode: true, prefix: api.OPTIONAL_ACTION_PREFIX.dtapActionSelect, charPairs: true });
  dtap.filter(n => n.options).forEach(g => g.options.forEach(o => assert.ok(o.text.startsWith("2× Tippen = "), o.text)));
});

test("Suchfeld: Filter ohne Präfix, Gruppentreffer und Trefferzahl", () => {
  const prefix = api.OPTIONAL_ACTION_PREFIX.holdActionSelect;
  const tree = api.keycodeOptionTree({ holdMode: true, charPairs: true });
  const total = tree.reduce((n, node) => n + (node.options ? node.options.length : 1), 0);
  // "halten", "tippen" und "=" treffen nicht jede Option über das Präfix
  ["halten", "=", " = "].forEach(q => {
    const r = api.filterOptionNodes(tree, q, prefix);
    assert.ok(r.matches < total / 2, `${q}: ${r.matches} von ${total}`);
  });
  const dtapTree = api.keycodeOptionTree({ holdMode: true, prefix: api.OPTIONAL_ACTION_PREFIX.dtapActionSelect });
  assert.strictEqual(api.filterOptionNodes(dtapTree, "tippen", api.OPTIONAL_ACTION_PREFIX.dtapActionSelect).matches, 0);
  // Ein echter Treffer bleibt sichtbar, leere Gruppen werden ausgeblendet
  const r = api.filterOptionNodes(tree, "doppelpunkt", prefix);
  assert.strictEqual(r.matches, 1);
  const visibleGroups = tree.filter((n, i) => n.options && r.nodes[i].visible).map(n => n.label);
  assert.deepStrictEqual(Array.from(visibleGroups), ["Sonderzeichen (macOS US)"]);
  // Passt der Gruppenname, bleibt die ganze Gruppe sichtbar
  const g = api.filterOptionNodes([{ label: "Media", options: [{ text: "Play" }, { text: "Mute" }] }], "media");
  assert.deepStrictEqual(Array.from(g.nodes[0].options), [true, true]);
  // Leere Suche zeigt alles
  assert.strictEqual(api.filterOptionNodes(tree, "", prefix).matches, total);
});

test("Suchfeld: Hinweis sperrt ohne Treffer und nennt eine ausgeblendete Auswahl", () => {
  const plain = o => JSON.parse(JSON.stringify(o));
  assert.deepStrictEqual(plain(api.selectFilterHint("", 0, true, "x")), { text: "", blocked: false });
  assert.deepStrictEqual(plain(api.selectFilterHint("zz", 0, true, "x")), { text: "Keine Treffer. Suche ändern, um zu übernehmen.", blocked: true });
  assert.deepStrictEqual(plain(api.selectFilterHint("ctrl", 3, true, "Halten = A (KEY_A)")), { text: "Gewählt bleibt: Halten = A (KEY_A)", blocked: false });
  assert.deepStrictEqual(plain(api.selectFilterHint("ctrl", 3, false, "x")), { text: "", blocked: false });
  // applySelectFilter setzt select.value nicht mehr (die Auswahl ändert nur eine explizite Wahl)
  const filterSrc = section("js/editor.js", "function applySelectFilter", "function updateFilterBlockedButton");
  assert.ok(!/select\.value\s*=/.test(filterSrc));
});

test("Live-Monitor: US-Beschriftungen und Umlaut-Zuordnung", () => {
  const m = R.scancodeMap;
  assert.deepStrictEqual([m.Minus.label, m.BracketLeft.label, m.Semicolon.label, m.Quote.label, m.Slash.label], ["-", "[", ";", "'", "/"]);
  // Keine Y/Z-Vertauschung mehr (macOS "U.S.")
  assert.deepStrictEqual(Array.from(api.ACTION_CODE_TO_EVENT_CODES.KEY_Y), ["KeyY"]);
  assert.deepStrictEqual(Array.from(api.ACTION_CODE_TO_EVENT_CODES.KEY_Z), ["KeyZ"]);
  // Jede Umlaut-Aktion hat einen Eintrag
  Object.keys(api.UMLAUT_LABELS).forEach(code => assert.ok(api.ACTION_CODE_TO_EVENT_CODES[code], code));
  const key = (tap, label) => ({ label, tap, hold: "NONE", dtap: "NONE" });
  const layer = [[], [key("KEY_U", "U"), key("UMLAUT_UE", "ü")], [key("KEY_S", "S"), key("UMLAUT_OE", "ö"), key("UMLAUT_SZ", "ß")]];
  // Tottaste Alt + u leuchtet die Umlaut-Taste auf, ein u ohne Alt die U-Taste
  assert.strictEqual(api.findKeyForEventCode(layer, "KeyU", true).key.label, "ü");
  assert.strictEqual(api.findKeyForEventCode(layer, "KeyU", false).key.label, "U");
  assert.strictEqual(api.findKeyForEventCode(layer, "KeyS", true).key.label, "ß");
  assert.strictEqual(api.findKeyForEventCode(layer, "KeyS", false).key.label, "S");
  // Mit Alt, aber ohne passende Umlaut-Taste: normale Taste
  assert.strictEqual(api.findKeyForEventCode([[key("KEY_U", "U")]], "KeyU", true).key.label, "U");
  assert.strictEqual(api.findKeyForEventCode(layer, "KeyQ", false), null);
});

test("Live-Monitor Split-Ansicht: jede Hälfte mit eigener Config, gemeinsame Codes auf beiden", () => {
  const plain = o => JSON.parse(JSON.stringify(o));
  // Split-Ansicht prüft beide Hälften, die Einzelansicht nur die bearbeitete
  assert.deepStrictEqual(plain(api.browserKeySides("both", "R", ["R", "L"])), ["R", "L"]);
  assert.deepStrictEqual(plain(api.browserKeySides("left", "L", ["R", "L"])), ["L"]);
  assert.deepStrictEqual(plain(api.browserKeySides("right", "R", ["R", "L"])), ["R"]);
  const left = { layers: L.defaultConfig.layers };
  const right = { layers: R.defaultConfig.layers };
  const ev = (code, altKey = false) => ({ code, key: "", altKey });
  // Q liegt nur links, J nur rechts: jede Hälfte findet nur ihre eigene Taste
  assert.deepStrictEqual(plain(api.resolveKeyForSide(left, L, 0, ev("KeyQ"))), { r: 1, c: 1, label: "Q", layer: 0 });
  assert.strictEqual(api.resolveKeyForSide(right, R, 0, ev("KeyQ")), null);
  assert.strictEqual(api.resolveKeyForSide(left, L, 0, ev("KeyJ")), null);
  assert.deepStrictEqual(plain(api.resolveKeyForSide(right, R, 0, ev("KeyJ"))), { r: 2, c: 1, label: "J", layer: 0 });
  // Space liegt auf beiden Hälften: beide liefern einen Treffer an ihrer eigenen Position
  const spaceL = api.resolveKeyForSide(left, L, 0, ev("Space"));
  const spaceR = api.resolveKeyForSide(right, R, 0, ev("Space"));
  assert.deepStrictEqual([spaceL.r, spaceL.c], [5, 4]);
  assert.deepStrictEqual([spaceR.r, spaceR.c], [5, 3]);
  // Gehaltene Ebene der Hälfte: Treffer auf Ebene 1, sonst Rückfall auf Ebene 0
  assert.deepStrictEqual(plain(api.resolveKeyForSide(left, L, 1, ev("F1"))), null);
  assert.strictEqual(api.resolveKeyForSide(left, L, 1, ev("KeyQ")).layer, 0);
  // Scancode-Tabelle nur im rechten Profil: leere rechte Ebene fällt auf die Tabelle zurück, links nicht
  const empty = { layers: [Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => ({ tap: "NONE" })))] };
  assert.deepStrictEqual(plain(api.resolveKeyForSide(empty, R, 0, ev("KeyJ"))), { r: 2, c: 1, label: "J", layer: 0 });
  assert.strictEqual(api.resolveKeyForSide(empty, L, 0, ev("KeyJ")), null);
});

// Verdrahtung mit dem globalen Zustand: resolveKeysFromEvent und checkActiveCombos laufen in einem eigenen
// Kontext mit ersetzten Werten für activeHandView, editSide, configFor und den Combo-Hinweis.
function liveContext(handView, edited) {
  const live = { alerts: [] };
  vm.createContext(live);
  vm.runInContext(`${code}
${section("js/keyboard-hooks.js", "// Gehaltene MO_x-Ebene einer Hälfte", "// Löst einen Browser-Tastencode für eine Hälfte auf")}
${section("js/keyboard-hooks.js", "// Alle Treffer eines Tastendrucks", "// Find key on Layer 0")}
${section("js/live-monitor.js", "// Combos gelten je Hälfte", "function showComboAlert")}
var activeHandView = ${JSON.stringify(handView)};
var editSide = ${JSON.stringify(edited)};
const activePressedKeys = new Set();
const configs = { R: JSON.parse(JSON.stringify(SIDE_PROFILES.R.defaultConfig)),
                  L: JSON.parse(JSON.stringify(SIDE_PROFILES.L.defaultConfig)) };
function configFor(side) { return configs[side]; }
function showComboAlert(combo) { alerts.push(combo.id); }
function hideComboAlert() { alerts.push(null); }
this.live = { resolveKeysFromEvent, checkActiveCombos, activePressedKeys, setView: v => { activeHandView = v; } };`, live);
  return live;
}

test("Live-Monitor Split-Ansicht: Verdrahtung mit Ansicht, bearbeiteter Hälfte und Combos", () => {
  const plain = o => JSON.parse(JSON.stringify(o));
  const ev = code => ({ code, key: "", altKey: false });
  const hits = (ctx, code) => plain(ctx.live.resolveKeysFromEvent(ev(code))).map(h => `${h.side}R${h.matched.r}C${h.matched.c}`);
  // Split-Ansicht, rechts bearbeitet: Q (nur links) trifft links, Space trifft beide Hälften
  const split = liveContext("both", "R");
  assert.deepStrictEqual(hits(split, "KeyQ"), ["LR1C1"]);
  assert.deepStrictEqual(hits(split, "Space"), ["RR5C3", "LR5C4"]);
  // Einzelansicht: nur die bearbeitete Hälfte
  assert.deepStrictEqual(hits(liveContext("right", "R"), "KeyQ"), []);
  assert.deepStrictEqual(hits(liveContext("left", "L"), "KeyQ"), ["LR1C1"]);
  assert.deepStrictEqual(hits(liveContext("left", "L"), "KeyJ"), []);
  // Combo der rechten Hälfte (J + K) meldet sich in der Split-Ansicht auch bei bearbeiteter linker Hälfte
  const combo = liveContext("both", "L");
  combo.live.activePressedKeys.add("R_2_1");
  combo.live.activePressedKeys.add("R_2_2");
  combo.live.checkActiveCombos();
  assert.strictEqual(combo.alerts.at(-1), "combo-1");
  // Wechsel in die linke Einzelansicht: der rechte Combo-Hinweis erlischt
  combo.live.setView("left");
  combo.live.checkActiveCombos();
  assert.strictEqual(combo.alerts.at(-1), null);
});

test("Ansichtswechsel prüft den Combo-Hinweis neu", () => {
  const handler = section("js/editor.js", "// Hand Switcher Buttons", "// Apply Layout Preset Button");
  assert.ok(/checkActiveCombos\(\)/.test(handler));
});

console.log(`\n${passed} App-Logik-Tests bestanden.`);
