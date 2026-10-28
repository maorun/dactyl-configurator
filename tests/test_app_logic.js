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
             isWiredSwitch, createMatrixTest, markMatrixKeyTested, summarizeMatrixTest, parseMatrixLine,
             SIDE_PROFILES,
             applyLayerOperation, transparentLayer, isUndoBlocked,
             ACT_KEY_PAIR_BASE, MAX_KEY_PAIRS, pairIndexFromCode, isKeyPairMember, keyPairLabel,
             applyMatrixData, MATRIX_DATA_FIELDS, normalizeKeyCell,
             createDeviceSnapshot, captureMatrixData, isDeviceSnapshotComplete, diffKeymap, describeKeyActions,
             DE_MAC_CHARS, charPairCode, charPairIndexFromCode, findKeyPairIndex, deMacCharForCode,
             resolveCharPairActions, keycodeOptionMatches, isKeyPairUsed, appendResolvedPairs, revertResolvedPairs,
             removeKeyPairAt, KEYCODES, UMLAUT_LABELS, ONE_SHOT_LABELS, holdSublabel,
             planKeyPairDeletion,
             ACT_MACRO_BASE, MAX_MACROS, MAX_MACRO_STEPS, MACRO_MAX_PAUSE_MS, MACRO_STEP_TYPES, macroIndexFromCode,
             isValidMacroStep, isValidMacro, normalizeMacroStep, macroCommands, isMacroUsed, removeMacroAt,
             macroSaveIndex, restoreMacroAt, isOneShotOrCapsWordCode,
             MAX_LAYOUT_PROFILES, sanitizeLayoutProfileName, findLayoutProfileIndex, layoutProfileNameKey, upsertLayoutProfile, removeLayoutProfile,
             deMacCharGroup, keycodeOptionTree, OPTIONAL_ACTION_PREFIX, filterOptionNodes, selectFilterHint,
             ACTION_CODE_TO_EVENT_CODES, findKeyForEventCode, resolveKeyForSide, browserKeySides };`, ctx);
const api = ctx.api;
const R = api.SIDE_PROFILES.R;
const L = api.SIDE_PROFILES.L;

let passed = 0;
let skipped = 0;
// Ein Test ruft skipTest(grund) auf und kehrt zurück: er zählt als übersprungen, nicht als bestanden
let skipReason = null;
function skipTest(reason) { skipReason = reason; }
function test(name, fn) {
  skipReason = null;
  fn();
  if (skipReason) {
    skipped++;
    console.log(`[      SKIP] ${name}: ${skipReason}`);
    return;
  }
  passed++;
  console.log(`[       OK ] ${name}`);
}
// Async-Tests laufen am Ende nacheinander; ein Fehler beendet den Lauf mit Exit-Code 1
const asyncTests = [];

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

test("Matrix-Test: MATRIX:-Zeile der Firmware wird streng geprüft", () => {
  assert.deepStrictEqual({ ...api.parseMatrixLine('MATRIX:{"r":2,"c":1,"pressed":1}') }, { r: 2, c: 1, pressed: true });
  assert.deepStrictEqual({ ...api.parseMatrixLine('MATRIX:{"r":5,"c":6,"pressed":0}') }, { r: 5, c: 6, pressed: false });
  assert.strictEqual(api.parseMatrixLine('MATRIX:{"r":6,"c":0,"pressed":1}'), null);
  assert.strictEqual(api.parseMatrixLine('MATRIX:{"r":0,"c":7,"pressed":1}'), null);
  assert.strictEqual(api.parseMatrixLine('MATRIX:{"r":"1","c":0,"pressed":1}'), null);
  assert.strictEqual(api.parseMatrixLine('MATRIX:{"r":1,"c":0,"pressed":true}'), null);
  assert.strictEqual(api.parseMatrixLine('MATRIX:{"r":1,"c":0}'), null);
  assert.strictEqual(api.parseMatrixLine("MATRIX:null"), null);
  assert.strictEqual(api.parseMatrixLine("MATRIX:{kaputt"), null);
  assert.strictEqual(api.parseMatrixLine('KEY_PRESS:{"r":1,"c":0,"pressed":1}'), null);
  assert.strictEqual(api.parseMatrixLine(undefined), null);
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

// Snapshot, der genau der lokalen Belegung entspricht (wie GET_CONFIG nach einem Sync)
function snapshotOf(cfg) {
  const snap = api.createDeviceSnapshot();
  snap.names = cfg.layerNames.slice();
  for (let l = 0; l < 8; l++) {
    const m = { tap: [], hold: [], dtap: [] };
    for (let r = 0; r < 6; r++) {
      for (const f of ["tap", "hold", "dtap"]) m[f].push([]);
      for (let c = 0; c < 7; c++) {
        const a = api.keyToNumericActions((cfg.layers[l] || [])[r]?.[c]);
        m.tap[r].push(a.tapCode); m.hold[r].push(a.holdCode); m.dtap[r].push(a.dtapCode);
      }
    }
    for (const f of ["tap", "hold", "dtap"]) assert.ok(api.captureMatrixData(snap, f, { l, k: m[f] }));
  }
  return snap;
}

test("Layout-Diff: gleiche Belegung ergibt keinen Unterschied", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const snap = snapshotOf(cfg);
  assert.ok(api.isDeviceSnapshotComplete(snap));
  const diff = api.diffKeymap(cfg, snap, R);
  assert.strictEqual(diff.keys.length, 0);
  assert.strictEqual(diff.names.length, 0);
});

test("Layout-Diff: geänderte Taste und Ebenen-Name erscheinen mit Geräte- und Neuwert", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const snap = snapshotOf(cfg);
  cfg.layers[2][1][3] = { label: "J", tap: "KEY_J", hold: "KEY_LEFT_CTRL", dtap: "KEY_ESC" };
  cfg.layerNames[4] = "Neu";
  const diff = api.diffKeymap(cfg, snap, R);
  assert.strictEqual(diff.keys.length, 1);
  const k = diff.keys[0];
  assert.deepStrictEqual([k.l, k.r, k.c], [2, 1, 3]);
  assert.deepStrictEqual({ ...k.local }, { tapCode: 106, holdCode: 0x80, dtapCode: 0xB1 });
  assert.strictEqual(api.describeKeyActions(k.local), "J · Halten: LEFT_CTRL · 2×: ESC");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(diff.names)), [{ l: 4, device: snap.names[4], local: "Neu" }]);
  assert.notStrictEqual(snap.names[4], "Neu");
  assert.strictEqual(api.describeKeyActions({ tapCode: 0, holdCode: 0, dtapCode: 0 }), "—");
});

test("Layout-Diff: Beschriftung für Tastenpaare und unbekannte Codes", () => {
  const pair = api.ACT_KEY_PAIR_BASE + 3;
  assert.strictEqual(api.describeKeyActions({ tapCode: pair, holdCode: 0, dtapCode: 0 }), "Paar 3");
  assert.strictEqual(api.describeKeyActions({ tapCode: 97, holdCode: pair, dtapCode: 0 }), "A · Halten: Paar 3");
  // Unbekannter Code (z. B. neuere Firmware): Zahl statt leerer Beschriftung
  assert.strictEqual(api.describeKeyActions({ tapCode: 0x1FF, holdCode: 0, dtapCode: 0 }), "Key 511");
  assert.strictEqual(api.describeKeyActions({ tapCode: 97, holdCode: 0, dtapCode: 0x1FE }), "A · 2×: Key 510");
});

test("Layout-Diff: Halten ohne Tap auf dem Gerät gleicht einer normalen Taste", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const snap = snapshotOf(cfg);
  cfg.layers[0][0][1] = { label: "Ctrl", tap: "NONE", hold: "KEY_LEFT_CTRL", dtap: "NONE" };
  // Gerät meldet Tap 0 und Halten Ctrl: wirkt wie Tap Ctrl, kein Unterschied
  snap.tap[0][0][1] = 0; snap.hold[0][0][1] = 0x80; snap.dtap[0][0][1] = 0;
  assert.strictEqual(api.diffKeymap(cfg, snap, R).keys.length, 0);
});

test("Layout-Diff: nicht vorhandene Tasten zählen nicht, unvollständige Snapshots werden erkannt", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const snap = snapshotOf(cfg);
  snap.tap[0][4][0] = 97; // R4C0 fehlt rechts physisch
  assert.strictEqual(api.diffKeymap(cfg, snap, R).keys.length, 0);
  const partial = api.createDeviceSnapshot();
  partial.names = cfg.layerNames.slice();
  assert.strictEqual(api.isDeviceSnapshotComplete(partial), false);
  assert.strictEqual(api.captureMatrixData(partial, "names", { l: 0, k: [] }), false);
  assert.strictEqual(api.captureMatrixData(partial, "tap", { l: 8, k: [] }), false);
  api.captureMatrixData(partial, "tap", { l: 0, k: [[70000, -1, 1.5, 97]] });
  assert.deepStrictEqual([...partial.tap[0][0]], [0, 0, 0, 97, 0, 0, 0]);
});

// handleSerialLine aus js/serial.js in einem eigenen Kontext mit Stubs für DOM, Anzeige und Verbindungen.
// conn: Verbindungszustand (bleUp, bleSide, serialUp, serialSide), wie connectionState() in js/ble.js.
function serialLineHarness(conn = {}) {
  const calls = { press: [], release: [], captured: [], rendered: 0, applied: 0, stats: [], layers: [] };
  const s = {
    calls, console: { log() {}, warn() {} },
    document: { getElementById: () => null },
    conn: { bleUp: false, bleSide: null, serialUp: true, serialSide: "R", ...conn },
    snapshotActive: false,
    // Stale-Timer des SPLIT_KEY-Trackers laufen im Test nie ab
    setTimeout: () => 0, clearTimeout: () => {}
  };
  vm.createContext(s);
  vm.runInContext(`${code}
${read("js/side-routing.js")}
var editSide = "R", activeLayerIndex = 0, serialSide = null, isAutoSyncing = false, bleConfigChar = null;
const configs = { R: normalizeConfig(JSON.parse(JSON.stringify(SIDE_PROFILES.R.defaultConfig)), SIDE_PROFILES.R),
                  L: normalizeConfig(JSON.parse(JSON.stringify(SIDE_PROFILES.L.defaultConfig)), SIDE_PROFILES.L) };
const tests = { R: createMatrixTest(SIDE_PROFILES.R), L: createMatrixTest(SIDE_PROFILES.L) };
const stats = { R: createTypingStats({}, SIDE_PROFILES.R), L: createTypingStats({}, SIDE_PROFILES.L) };
function configFor(side) { return configs[side]; }
function matrixTestFor(side) { return tests[side]; }
function typingStatsFor(side) { return stats[side]; }
function connectionState() { return conn; }
function resolveAcksForLine() {}
function resolveBleInfoWaiters() {}
function captureDeviceSnapshotLine(line, side) { calls.captured.push(side); return snapshotActive; }
function showToast() {}
function updateConfigModeUI() {}
function updateBatteryUI() {}
function switchLayerUI(l) { calls.layers.push(l); }
function renderMatrix() { calls.applied++; }
function renderMatrixTest() { calls.rendered++; }
function renderLayerButtons() {}
function saveConfigToServer() {}
function clearPendingSync() {}
function onTypingStatsChanged(side) { calls.stats.push(side); }
function triggerVisualKeyPress(r, c, label, side) { calls.press.push(side + r + c); }
function triggerVisualKeyRelease(r, c, side) { calls.release.push(side + r + c); }
${section("js/serial.js", "// Gedrückte SPLIT_KEY-Tasten", "function switchLayerUI")}
this.handle = handleSerialLine; this.tested = side => [...tests[side].tested];`, s);
  // Arrays aus dem VM-Kontext haben einen anderen Prototyp: für deepStrictEqual in einfache Werte kopieren
  const plain = v => JSON.parse(JSON.stringify(v));
  return {
    handle: (...a) => s.handle(...a), tested: side => plain(s.tested(side)),
    calls: new Proxy(calls, { get: (o, k) => plain(o[k]) }),
    set snapshotActive(v) { s.snapshotActive = v; }
  };
}

test("serial.js: GET_CONFIG-Zeilen gehen mit der aufgelösten Hälfte in den Snapshot", () => {
  const s = serialLineHarness();
  s.snapshotActive = true;
  // Ohne bekannte Hälfte gilt der Master: der Snapshot erhält "R", nicht null
  s.handle('LAYER_DATA:{"l":0,"k":[[97]]}', null, "usb");
  s.handle('LAYER_DATA:{"l":0,"k":[[97]]}', "L", "usb");
  assert.deepStrictEqual(s.calls.captured, ["R", "L"]);
  // Verbrauchte Zeilen ändern die lokale Config nicht
  assert.strictEqual(s.calls.applied, 0);
  s.snapshotActive = false;
  s.handle('LAYER_DATA:{"l":0,"k":[[98]]}', null, "usb");
  assert.strictEqual(s.calls.applied, 1);
});

test("serial.js: MATRIX: markiert nur Drücken, je nach Hälfte der Verbindung", () => {
  const s = serialLineHarness();
  s.handle('MATRIX:{"r":2,"c":1,"pressed":0}', "R", "usb");
  assert.deepStrictEqual(s.tested("R"), []);
  s.handle('MATRIX:{"r":2,"c":1,"pressed":1}', "R", "usb");
  assert.deepStrictEqual(s.tested("R"), ["2_1"]);
  assert.strictEqual(s.calls.rendered, 1);           // bearbeitete Hälfte: neu zeichnen
  // Linke Hälfte direkt an USB: MATRIX: zählt für links, ohne die Ansicht der rechten Hälfte zu zeichnen
  s.handle('MATRIX:{"r":1,"c":1,"pressed":1}', "L", "usb");
  assert.deepStrictEqual(s.tested("L"), ["1_1"]);
  assert.strictEqual(s.calls.rendered, 1);
  // Live-Monitor und Heatmap bleiben bei KEY_PRESS
  assert.deepStrictEqual(s.calls.press, []);
  assert.deepStrictEqual(s.calls.stats, []);
});

test("serial.js: SPLIT_KEY drückt und löst die Taste der linken Hälfte", () => {
  const s = serialLineHarness();
  s.handle('SPLIT_KEY:{"r":1,"c":2,"pressed":1,"layer":0}', "R", "usb");
  assert.deepStrictEqual(s.calls.press, ["L12"]);
  assert.deepStrictEqual(s.calls.stats, ["L"]);
  assert.deepStrictEqual(s.tested("L"), ["1_2"]);
  s.handle('SPLIT_KEY:{"r":1,"c":2,"pressed":0,"layer":0}', "R", "usb");
  assert.deepStrictEqual(s.calls.release, ["L12"]);
  assert.deepStrictEqual(s.calls.stats, ["L"]);       // Release zählt nicht
  // Von der linken Hälfte selbst: verworfen
  s.handle('SPLIT_KEY:{"r":1,"c":2,"pressed":1,"layer":0}', "L", "usb");
  assert.deepStrictEqual(s.calls.press, ["L12"]);
});

test("serial.js: SPLIT_KEY zählt nicht doppelt, wenn die linke Hälfte selbst verbunden ist", () => {
  // Master per BLE, linke Hälfte per USB: deren Tasten kommen als KEY_PRESS direkt
  const s = serialLineHarness({ bleUp: true, bleSide: "R", serialUp: true, serialSide: "L" });
  s.handle('SPLIT_KEY:{"r":1,"c":2,"pressed":1,"layer":0}', "R", "ble");
  assert.deepStrictEqual(s.calls.press, []);
  assert.deepStrictEqual(s.calls.stats, []);
  s.handle('KEY_PRESS:{"r":1,"c":2,"key":"q","layer":0}', "L", "usb");
  assert.deepStrictEqual(s.calls.press, ["L12"]);
  assert.deepStrictEqual(s.calls.stats, ["L"]);
});

test("serial.js: Ebenenwechsel der nicht bearbeiteten Hälfte schaltet die geteilte Ebene um", () => {
  // Rechte Hälfte bearbeitet, linke Hälfte per USB: ihr MO_2 gilt auf beiden Hälften (Layer-Abgleich)
  const s = serialLineHarness({ serialUp: true, serialSide: "L" });
  s.handle('KEY_PRESS:{"r":5,"c":0,"key":"MO_2","code":258,"layer":0,"target_layer":2}', "L", "usb");
  assert.deepStrictEqual(s.calls.layers, [2]);
  // LAYER-Zeile vom Abgleich mit der anderen Hälfte ("LAYER: SPLIT -> Layer n")
  s.handle("LAYER: SPLIT -> Layer 3", "L", "usb");
  assert.deepStrictEqual(s.calls.layers, [2, 3]);
});

// Diff-Ablauf aus js/config-sync.js mit Fake-Timern, Fake-Gerät und Fake-Dialog
function diffFlowHarness() {
  const timers = [];
  const calls = { sent: [], writes: 0, dialogs: [], confirms: 0, toasts: [] };
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const h = {
    NUM_LAYERS: 8, MATRIX_DATA_FIELDS: api.MATRIX_DATA_FIELDS, captureMatrixData: api.captureMatrixData,
    isDeviceSnapshotComplete: api.isDeviceSnapshotComplete, createDeviceSnapshot: api.createDeviceSnapshot,
    diffKeymap: api.diffKeymap, SIDE_PROFILES: api.SIDE_PROFILES, isAutoSyncing: false,
    side: "R", via: "usb", alsoBle: false, sendOk: true, confirmAnswer: false, dialogAnswer: null,
    Dactyl: { routeCommand: (side, conn) => conn.bleUp && conn.bleSide === side ? "ble"
      : (conn.serialUp && conn.serialSide === side ? "usb" : null) },
    setTimeout: (fn, ms) => { timers.push({ fn, ms, done: false }); return timers.length - 1; },
    clearTimeout: (id) => { if (timers[id]) timers[id].done = true; },
    showToast: (t) => calls.toasts.push(t), configFor: () => cfg
  };
  vm.createContext(h);
  vm.runInContext(`${section("js/config-sync.js", "const DEVICE_SNAPSHOT_TIMEOUT_MS", "// Zeigt den Diff im Dialog")}
    ${section("js/config-sync.js", '// "Auf ESP32 speichern": zuerst', "  if (bleConfigChar) {")}
    }
    ${section("js/config-sync.js", "// One-Shot-Auto-Sync (BLE-Verbindung", "// =============================================================================\n// Layout-Diff")}
    ${section("js/config-sync.js", "// Nach einer BLE- oder USB-Trennung", "// Zeigt den Diff im Dialog")}
    this.capture = captureDeviceSnapshotLine; this.write = writeConfigWithDiff; this.load = readConfigFromESP32;
    this.autoSync = runAutoSync; this.abort = abortDeviceSnapshotReadIfDisconnected;
    this.state = () => ({ read: deviceSnapshotRead, active: diffFlowActive });`, h);
  h.bleConfigChar = null; h.serialPort = null;
  h.connectedSide = () => h.side;
  // h.side über h.via ("usb"/"ble"); alsoBle = dieselbe Hälfte zusätzlich per BLE (BLE hat Vorrang)
  h.connectionState = () => ({
    bleUp: !!h.side && (h.via === "ble" || h.alsoBle), bleSide: h.side,
    serialUp: !!h.side && h.via === "usb", serialSide: h.side
  });
  h.disconnects = 0;
  h.disconnectBle = async () => { h.disconnects++; return true; };
  h.sendDeviceCommand = async (cmd, side) => { calls.sent.push(`${side}:${cmd}`); return h.sendOk; };
  h.writeConfigToESP32 = async (opts) => { calls.writes++; calls.lastWrite = opts; };
  h.confirm = () => { calls.confirms++; return h.confirmAnswer; };
  h.showSyncDiffDialog = (profile, diff) => { calls.dialogs.push(diff); return new Promise(r => { h.dialogAnswer = r; }); };
  h.alert = () => {};
  const fire = (ms) => { const t = timers.find(x => !x.done && x.ms === ms); assert.ok(t, `kein Timer ${ms}`); t.done = true; t.fn(); };
  const flush = () => new Promise(r => setImmediate(r));
  const sendDevice = (side, c) => {
    h.capture(`LAYER_NAMES:${JSON.stringify(c.layerNames)}`, side);
    for (let l = 0; l < 8; l++) {
      const m = { tap: [], hold: [], dtap: [] };
      for (let r = 0; r < 6; r++) {
        for (const f of ["tap", "hold", "dtap"]) m[f].push([]);
        for (let col = 0; col < 7; col++) {
          const a = api.keyToNumericActions(c.layers[l][r][col]);
          m.tap[r].push(a.tapCode); m.hold[r].push(a.holdCode); m.dtap[r].push(a.dtapCode);
        }
      }
      for (const [p, f] of Object.entries(api.MATRIX_DATA_FIELDS)) h.capture(`${p}${JSON.stringify({ l, k: m[f] })}`, side);
    }
    return h.capture("CONFIG_SYNC_DONE", side);
  };
  return { h, calls, cfg, fire, flush, sendDevice };
}

asyncTests.push(["Layout-Diff: Bestätigen überträgt, Abbrechen nicht; Zeilen der anderen Hälfte zählen nicht", async () => {
  const { h, calls, cfg, flush, sendDevice } = diffFlowHarness();
  const run = h.write();
  await flush();
  assert.deepStrictEqual(calls.sent, ["R:GET_CONFIG"]);
  // Zeilen der linken Hälfte verbraucht die Abfrage nicht
  assert.strictEqual(h.capture('LAYER_DATA:{"l":0,"k":[[97]]}', "L"), false);
  const device = JSON.parse(JSON.stringify(cfg));
  device.layerNames[3] = "Alt";
  assert.ok(sendDevice("R", device));
  await flush();
  assert.strictEqual(calls.dialogs.length, 1);
  assert.strictEqual(calls.dialogs[0].names.length, 1);
  assert.strictEqual(calls.dialogs[0].names[0].device, "Alt");
  // Zweiter Klick und "Vom ESP32 laden" während des offenen Dialogs: kein zweiter Ablauf, kein GET_CONFIG
  await h.write();
  await h.load();
  assert.strictEqual(calls.sent.length, 1);
  assert.strictEqual(calls.dialogs.length, 1);
  h.dialogAnswer(true);
  await run;
  assert.strictEqual(calls.writes, 1);
  // Der Sync überträgt nur die verglichene Hälfte
  assert.strictEqual(calls.lastWrite.expectedSide, "R");
  assert.strictEqual(calls.lastWrite.autoDisconnectAfter, false);
  assert.strictEqual(h.state().active, false);
  // Abbrechen
  const run2 = h.write();
  await flush();
  sendDevice("R", device);
  await flush();
  h.dialogAnswer(false);
  await run2;
  assert.strictEqual(calls.writes, 1);
}]);

asyncTests.push(["Layout-Diff: späte Zeilen nach dem Timeout ändern die lokale Config nicht", async () => {
  const { h, calls, cfg, fire, flush, sendDevice } = diffFlowHarness();
  h.confirmAnswer = false;
  const run = h.write();
  await flush();
  fire(8000);
  await run;
  assert.strictEqual(calls.confirms, 1);
  assert.strictEqual(calls.writes, 0);
  // Die Antwort kommt zu spät: alle GET_CONFIG-Zeilen werden verworfen, CONFIG_SYNC_DONE beendet das Verwerfen
  assert.ok(h.state().read && h.state().read.stale);
  assert.strictEqual(sendDevice("R", cfg), true);
  assert.strictEqual(h.state().read, null);
  assert.strictEqual(h.capture("CONFIG_SYNC_DONE", "R"), false);
  // Ohne Antwort endet das Verwerfen nach der Drain-Zeit
  const run2 = h.write();
  await flush();
  fire(8000);
  await run2;
  fire(30000);
  assert.strictEqual(h.state().read, null);
  // Rückfrage bejaht: ohne Vergleich übertragen
  h.confirmAnswer = true;
  const run3 = h.write();
  await flush();
  fire(8000);
  await run3;
  assert.strictEqual(calls.writes, 1);
}]);

asyncTests.push(["Layout-Diff: Verwerfen nach Timeout blockiert Laden und meldet einen zweiten Klick", async () => {
  const { h, calls, fire, flush } = diffFlowHarness();
  h.confirmAnswer = false;
  const run = h.write();
  await flush();
  fire(8000);
  await run;
  assert.ok(h.state().read.stale);
  // "Vom ESP32 laden" sendet während des Verwerfens kein GET_CONFIG
  await h.load();
  assert.deepStrictEqual(calls.sent, ["R:GET_CONFIG"]);
  // Zweiter Klick auf "Auf ESP32 speichern": Hinweis statt stiller Rückkehr, keine neue Abfrage
  const toastsBefore = calls.toasts.length;
  await h.write();
  assert.deepStrictEqual(calls.sent, ["R:GET_CONFIG"]);
  assert.ok(calls.toasts.slice(toastsBefore).some(t => t.includes("früheren Abfrage")));
}]);

asyncTests.push(["Layout-Diff: One-Shot-Auto-Sync überträgt nicht in eine laufende Abfrage", async () => {
  const { h, calls, flush, sendDevice, cfg } = diffFlowHarness();
  const run = h.write();
  await flush();
  // BLE-Auto-Connect während der GET_CONFIG-Abfrage: keine Übertragung
  await h.autoSync({ autoDisconnectAfter: true });
  assert.strictEqual(calls.writes, 0);
  sendDevice("R", cfg);
  await flush();
  // Dialog offen (diffFlowActive): ebenfalls keine Übertragung
  await h.autoSync({ autoDisconnectAfter: true });
  assert.strictEqual(calls.writes, 0);
  h.dialogAnswer(false);
  await run;
  // Übersprungener One-Shot-Sync per BLE: Tastatur trotzdem zurück in den Tastaturmodus
  assert.strictEqual(h.disconnects, 0);               // ohne BLE-Verbindung nichts zu trennen
  // Ohne Diff-Ablauf überträgt der Auto-Sync
  await h.autoSync({ autoDisconnectAfter: true });
  assert.strictEqual(calls.writes, 1);
  assert.strictEqual(calls.lastWrite.autoDisconnectAfter, true);
  // Mit BLE-Verbindung: übersprungen und getrennt (EXIT_CONFIG); ohne autoDisconnectAfter bleibt sie bestehen
  const b = diffFlowHarness();
  b.h.bleConfigChar = {};
  const runB = b.h.write();
  await b.flush();
  await b.h.autoSync({ autoDisconnectAfter: false });
  assert.strictEqual(b.h.disconnects, 0);
  await b.h.autoSync({ autoDisconnectAfter: true });
  assert.strictEqual(b.h.disconnects, 1);
  assert.strictEqual(b.calls.writes, 0);
  b.h.side = null;
  b.h.abort();
  b.h.confirmAnswer = false;
  await runB;
  // ble.js startet den Auto-Sync nur über runAutoSync
  const ble = read("js/ble.js");
  assert.ok(!/writeConfigToESP32\(/.test(ble));
  assert.ok(/runAutoSync\(\{ autoDisconnectAfter: true \}\)/.test(ble));
}]);

asyncTests.push(["Layout-Diff: Trennen während der Abfrage beendet sie sofort", async () => {
  const { h, calls, flush } = diffFlowHarness();
  const run = h.write();
  await flush();
  // Gleiche Hälfte noch verbunden: Abfrage läuft weiter
  h.abort();
  assert.ok(h.state().read);
  // Verbindung weg: Abfrage endet ohne Timeout, der Ablauf meldet die Unterbrechung
  h.side = null;
  h.abort();
  assert.strictEqual(h.state().read, null);
  await run;
  assert.strictEqual(calls.writes, 0);
  assert.strictEqual(calls.confirms, 0);
  assert.ok(calls.toasts.some(t => t.includes("unterbrochen")));

  // Abfrage per BLE, BLE fällt weg, USB derselben Hälfte bleibt: die Antwort kommt nicht mehr, sofort beenden
  const b = diffFlowHarness();
  b.h.via = "usb"; b.h.alsoBle = true;
  b.h.confirmAnswer = false;
  const runB = b.h.write();
  await b.flush();
  b.h.alsoBle = false;
  b.h.abort();
  assert.strictEqual(b.h.state().read, null);
  await runB;
  assert.strictEqual(b.calls.confirms, 1);           // Rückfrage ohne Vergleich statt 8 s Warten
  // Abfrage per USB, eine zusätzliche BLE-Verbindung ändert den Weg der Anfrage nicht
  const u = diffFlowHarness();
  const runU = u.h.write();
  await u.flush();
  u.h.alsoBle = true;
  u.h.abort();
  assert.ok(u.h.state().read);
  u.h.alsoBle = false;
  u.h.confirmAnswer = false;
  u.h.side = null;
  u.h.abort();
  await runU;
  // Beide Trennpfade rufen die Funktion auf
  assert.ok(section("js/ble.js", "function onBleDisconnected", "function updateBleUI").includes("abortDeviceSnapshotReadIfDisconnected()"));
  assert.ok(section("js/serial.js", "async function disconnectSerialNow", "function updateBatteryUI").includes("abortDeviceSnapshotReadIfDisconnected()"));
}]);

// Live-Sync aus js/config-sync.js: Planung, Warteschlange pro Hälfte und Sperren
function liveSyncHarness() {
  const timers = [];
  const h = {
    side: "R", pending: { R: [{ id: 1 }], L: [] }, writes: [], toasts: [], SIDE_PROFILES: api.SIDE_PROFILES,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }
  };
  h.connectedSide = () => h.side;
  h.pendingFor = side => h.pending[side];
  h.showToast = t => h.toasts.push(t);
  h.writeConfigToESP32 = async opts => { h.writes.push(opts); };
  vm.createContext(h);
  vm.runInContext(`var isAutoSyncing = false, isConnectingBle = false, deviceSnapshotRead = null, diffFlowActive = false;
    ${section("js/config-sync.js", "// Änderungen innerhalb von LIVE_SYNC_DEBOUNCE_MS", "// One-Shot-Auto-Sync (BLE-Verbindung")}
    this.request = requestLiveSync;`, h);
  const run = async () => { while (timers.length) { const t = timers.shift(); await t.fn(); } };
  return { h, timers, run, set: expr => vm.runInContext(expr, h) };
}

asyncTests.push(["Live-Sync: schnelle Änderungen einer verbundenen Hälfte starten einen vollen Sync", async () => {
  const { h, timers, run } = liveSyncHarness();
  assert.strictEqual(h.request("R"), true);
  assert.strictEqual(h.request("R"), true);
  assert.strictEqual(timers.length, 1, "mehrere Änderungen planen einen Sync");
  assert.strictEqual(timers[0].ms, vm.runInContext("LIVE_SYNC_DEBOUNCE_MS", h));
  assert.ok(timers[0].ms > 0);
  await run();
  assert.strictEqual(h.writes.length, 1);
  assert.deepStrictEqual({ ...h.writes[0] }, { autoDisconnectAfter: false, expectedSide: "R" });
  // Nicht verbundene oder andere Hälfte: nichts planen, die Änderung bleibt vorgemerkt
  assert.strictEqual(h.request("L"), false);
  h.side = null;
  assert.strictEqual(h.request("R"), false);
  assert.strictEqual(timers.length, 0);
}]);

asyncTests.push(["Live-Sync: wartet auf einen laufenden Sync, Diff und Trennung zeigen den Hinweis", async () => {
  const { h, timers, run, set } = liveSyncHarness();
  set("isAutoSyncing = true");
  h.request("R");
  await timers.shift().fn();
  assert.strictEqual(h.writes.length, 0);
  assert.strictEqual(timers.at(-1).ms, vm.runInContext("LIVE_SYNC_RETRY_MS", h));
  set("isAutoSyncing = false");
  await run();
  assert.strictEqual(h.writes.length, 1);
  // Während des Diffs nichts übertragen, aber den Vormerk-Hinweis zeigen
  set("diffFlowActive = true");
  h.request("R");
  await run();
  assert.strictEqual(h.writes.length, 1);
  assert.ok(h.toasts.at(-1).includes("bleiben vorgemerkt"));
  set("diffFlowActive = false");
  // BLE-Verbindungsaufbau läuft: erst danach senden
  set("isConnectingBle = true");
  h.request("R");
  await timers.shift().fn();
  assert.strictEqual(h.writes.length, 1);
  assert.strictEqual(timers.at(-1).ms, vm.runInContext("LIVE_SYNC_RETRY_MS", h));
  set("isConnectingBle = false");
  await run();
  assert.strictEqual(h.writes.length, 2);
  // Verbindung endet vor dem Sync (One-Shot trennt): Hinweis statt stillem Verwerfen
  h.toasts.length = 0;
  h.request("R");
  h.side = null;
  await run();
  assert.strictEqual(h.writes.length, 2);
  assert.ok(h.toasts.at(-1).includes("bleiben vorgemerkt"));
  h.side = "R";
  // Ohne vorgemerkte Änderung (inzwischen synchronisiert) kein weiterer Sync
  h.pending.R = [];
  h.request("R");
  await run();
  assert.strictEqual(h.writes.length, 2);
  // Nach Rückgängig (force): auch ohne vorgemerkte Änderung senden, ein späterer Aufruf ohne force hebt das nicht auf
  h.request("R", true);
  h.request("R");
  await run();
  assert.strictEqual(h.writes.length, 3);
}]);

// markPendingSync, undoPendingChange und discardAllPendingChanges aus app.js
function pendingHarness() {
  const w = { toasts: [], requests: [], connected: true, confirm: () => true, console: { error() {} } };
  vm.createContext(w);
  vm.runInContext(`var editSide = "R";
    var pendingChanges = [], otherPending = [], pendingSyncCount = 0;
    var document = { getElementById: () => null };
    function pendingFor(side) { return side === editSide ? pendingChanges : otherPending; }
    function setPendingFor(side, list) { if (side === editSide) pendingChanges = list; else otherPending = list; }
    function renderPendingSyncUI() {}
    function isUndoBlocked() { return false; }
    function showToast(t) { toasts.push(t); }
    function activeProfile() { return { comboLabel: "C", label: "rechte Hälfte" }; }
    function requestLiveSync(side, force) { requests.push([side, !!force]); return connected; }
    ${section("app.js", "function undoPendingChange", "// Verwirft die vorgemerkten Änderungen")}
    ${section("app.js", "// Verwirft die vorgemerkten Änderungen", "// Lädt die gespeicherte Konfiguration")}
    this.mark = markPendingSync; this.undo = undoPendingChange; this.discard = discardAllPendingChanges;
    this.list = () => pendingChanges; this.other = () => otherPending;`, w);
  return w;
}

test("Live-Sync: markPendingSync plant den Sync der Hälfte, ohne Verbindung mit Vormerk-Hinweis", () => {
  const w = pendingHarness();
  w.mark({ type: "key", title: "T" }, "R");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(w.requests)), [["R", false]]);
  assert.strictEqual(w.list().length, 1);
  assert.strictEqual(w.toasts.length, 0, "verbunden: writeConfigToESP32 meldet den Fortschritt");
  w.connected = false;
  w.mark({ type: "key", title: "U" }, "R");
  assert.ok(w.toasts.at(-1).includes("Vorgemerkt (U)"));
  // Andere Hälfte: eigene Liste, eigener Sync
  w.mark({ type: "key", title: "L" }, "L");
  assert.deepStrictEqual([...w.requests.at(-1)], ["L", false]);
  assert.strictEqual(w.other().length, 1);
  // Rückgängig und Verwerfen übertragen den Stand erneut (force)
  w.undo(w.list()[0].id);
  assert.deepStrictEqual([...w.requests.at(-1)], ["R", true]);
  w.requests.length = 0;
  w.discard();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(w.requests)), [["R", true]]);
  assert.strictEqual(w.list().length, 0);
});

asyncTests.push(["Live-Sync: Ebene umbenennen merkt vor und sendet kein SET_NAME", async () => {
  const { w, dom, log } = uiHarness(`
${section("js/editor.js", "async function renameActiveLayer", "function initUI")}`);
  dom.document.getElementById("layerNameInput").value = "Nav";
  await w.renameActiveLayer();
  assert.deepStrictEqual(log.sent, []);
  assert.strictEqual(log.pending.at(-1).type, "layer_name");
  assert.strictEqual(vm.runInContext("currentConfig.layerNames[0]", w), "Nav");
}]);

asyncTests.push(["Layout-Diff: writeConfigToESP32 überträgt nach einem Hälftenwechsel nichts", async () => {
  const toasts = [];
  let progressShown = false;
  const w = {
    bleConfigChar: {}, serialPort: null, isAutoSyncing: false, SIDE_PROFILES: api.SIDE_PROFILES,
    connectedSide: () => "L", showToast: (t) => toasts.push(t), alert: () => {},
    activeProfile: () => R, configFor: () => { throw new Error("configFor darf nicht laufen"); },
    document: { getElementById: () => { progressShown = true; return null; } }
  };
  vm.createContext(w);
  vm.runInContext(`${section("js/config-sync.js", "async function writeConfigToESP32", "  const cfg = configFor(side);")}
    }
    this.write = writeConfigToESP32;`, w);
  await w.write({ autoDisconnectAfter: false, expectedSide: "R" });
  assert.strictEqual(progressShown, false);
  assert.ok(toasts.some(t => t.includes(R.label)));
}]);

asyncTests.push(["Layout-Diff: Sendefehler und Verbindungswechsel übertragen nichts ohne Rückfrage", async () => {
  const { h, calls, flush } = diffFlowHarness();
  h.sendOk = false;
  await h.write();
  assert.strictEqual(calls.confirms, 1);
  assert.strictEqual(h.state().read, null);
  // Verbindung wechselt während der Abfrage zur anderen Hälfte
  h.sendOk = true;
  const run = h.write();
  await flush();
  h.side = "L";
  h.capture("CONFIG_SYNC_DONE", "R");
  await run;
  assert.strictEqual(calls.writes, 0);
  assert.strictEqual(calls.confirms, 1);
}]);

test("Makros: Konstanten passen zu Firmware und server.py", () => {
  const common = read("firmware/dactyl_right/DactylCommon.h");
  const py = read("server.py");
  const define = name => Number(new RegExp(`#define ${name}\\s+(0x[0-9A-Fa-f]+|\\d+)`).exec(common)[1]);
  assert.strictEqual(define("ACT_MACRO_BASE"), api.ACT_MACRO_BASE);
  assert.strictEqual(define("MAX_MACROS"), api.MAX_MACROS);
  assert.strictEqual(define("MAX_MACRO_STEPS"), api.MAX_MACRO_STEPS);
  assert.strictEqual(define("MACRO_MAX_PAUSE_MS"), api.MACRO_MAX_PAUSE_MS);
  for (const [name, value] of Object.entries(api.MACRO_STEP_TYPES)) {
    assert.strictEqual(define(`MACRO_STEP_${name.toUpperCase()}`), value);
  }
  assert.strictEqual(Number(/^MAX_MACROS = (\d+)/m.exec(py)[1]), api.MAX_MACROS);
  // Kein anderer Aktionscode (Umlaut, One-Shot, Caps Word) liegt im Makro-Bereich
  for (const m of common.matchAll(/#define (ACT_\w+)\s+(0x[0-9A-Fa-f]+)/g)) {
    if (m[1] === "ACT_MACRO_BASE") continue;
    const v = Number(m[2]);
    assert.ok(v < api.ACT_MACRO_BASE || v >= api.ACT_MACRO_BASE + api.MAX_MACROS, `${m[1]} überlappt mit Makros`);
  }
});

test("Makros: Aktionscode hin und zurück", () => {
  assert.strictEqual(api.actionCodeToNumeric("MACRO_0"), api.ACT_MACRO_BASE);
  assert.strictEqual(api.actionCodeToNumeric("MACRO_15"), api.ACT_MACRO_BASE + 15);
  assert.strictEqual(api.macroIndexFromCode("MACRO_16"), -1);
  assert.strictEqual(api.macroIndexFromCode("MACRO_x"), -1);
  assert.deepStrictEqual({ ...api.findDefinitionByCode(api.ACT_MACRO_BASE + 3) }, { label: "Makro 3", tap: "MACRO_3" });
  // Ein Makro ist kein Tastenpaar- oder Schritt-Mitglied
  assert.strictEqual(api.isKeyPairMember("MACRO_0"), false);
});

test("Makros: Schritte, Validierung und Normalisierung", () => {
  assert.ok(api.isValidMacroStep({ type: "tap", code: "KEY_A" }));
  assert.ok(api.isValidMacroStep({ type: "down", code: "KEY_LEFT_GUI" }));
  assert.ok(api.isValidMacroStep({ type: "pause", ms: 5000 }));
  for (const bad of [{ type: "pause", ms: 0 }, { type: "pause", ms: 5001 }, { type: "pause", ms: "100" },
                     { type: "tap", code: "MO_1" }, { type: "tap", code: "MACRO_0" }, { type: "tap", code: "PAIR_0" },
                     { type: "click", code: "KEY_A" }, null, "tap",
                     // Geerbte Objekt-Namen sind keine Schritt-Typen
                     { type: "constructor", code: "KEY_A" }, { type: "toString", code: "KEY_A" },
                     { type: "__proto__", code: "KEY_A" }]) {
    assert.strictEqual(api.isValidMacroStep(bad), false, JSON.stringify(bad));
  }
  const tooLong = { name: "x", steps: Array(api.MAX_MACRO_STEPS + 1).fill({ type: "tap", code: "KEY_A" }) };
  assert.strictEqual(api.isValidMacro(tooLong), false);
  const base = { layers: [[[]]] };
  assert.throws(() => api.validateConfigShape({ ...base, macros: [tooLong] }, R), /Makro 0/);
  assert.throws(() => api.validateConfigShape({ ...base, macros: Array(17).fill({ steps: [] }) }, R), /macros/);
  assert.throws(() => api.validateConfigShape({ ...base, combos: [{ key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 }, action: "MACRO_0" }] }, R), /Makros/);
  const cfg = api.normalizeConfig({ layers: [[[]]], macros: [
    { name: "Ok", steps: [{ type: "pause", ms: 10, code: "KEY_A" }, { type: "tap", code: "KEY_A", ms: 7 }] },
    { name: "Kaputt", steps: [{ type: "pause", ms: 0 }] }
  ] }, R);
  // Ein ungültiges Makro wird leer, nicht entfernt: spätere MACRO_<n>-Verweise behalten ihr Ziel
  assert.deepStrictEqual(JSON.parse(JSON.stringify(cfg.macros)),
    [{ name: "Ok", steps: [{ type: "pause", ms: 10 }, { type: "tap", code: "KEY_A" }] }, { name: "Kaputt", steps: [] }]);
  const shifted = api.normalizeConfig({ layers: [[[{ tap: "MACRO_1" }]]], macros: [
    { name: "Kaputt", steps: [{ type: "constructor", code: "KEY_A" }] },
    { name: "Ziel", steps: [{ type: "tap", code: "KEY_B" }] },
    null
  ] }, R);
  assert.strictEqual(shifted.macros[1].name, "Ziel");
  assert.strictEqual(shifted.macros[1].steps.length, 1);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(shifted.macros[2])), { name: "Makro 2", steps: [] });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.normalizeConfig({ layers: [[[]]] }, R).macros)), []);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.macroCommands(cfg.macros[0]))),
    ["ADD_MACRO", "ADD_MACRO_STEP 4 0 10", "ADD_MACRO_STEP 1 97 0"]);
});

test("Makros: Speicher-Index des Editors bleibt in der Liste", () => {
  const two = [{ name: "a", steps: [] }, { name: "b", steps: [] }];
  assert.strictEqual(api.macroSaveIndex(two, -1), 2);          // neues Makro wird angehängt
  assert.strictEqual(api.macroSaveIndex(two, 1), 1);           // vorhandenes Makro
  // Index aus einer längeren Liste (andere Hälfte, Import, Undo): kein Speichern, keine Lücke
  assert.strictEqual(api.macroSaveIndex(two, 2), null);
  assert.strictEqual(api.macroSaveIndex(two, 5), null);
  assert.strictEqual(api.macroSaveIndex([], 0), null);
  assert.strictEqual(api.macroSaveIndex(Array(api.MAX_MACROS).fill({ steps: [] }), -1), null);
  assert.strictEqual(api.macroSaveIndex(undefined, -1), 0);
});

test("Makros: Editor schließt beim Wechsel der Hälfte und bei geänderter Liste", () => {
  const editor = read("js/editor.js");
  const sw = editor.slice(editor.indexOf("function switchEditSide"), editor.indexOf("function updateSideLabels"));
  assert.ok(/closeMacroEditor\(\)/.test(sw), "switchEditSide schließt den Makro-Editor nicht");
  assert.ok(sw.indexOf("closeMacroEditor()") < sw.indexOf("editSide = side"), "Editor muss vor dem Wechsel schließen");
  const ui = read("js/macros-ui.js");
  const render = ui.slice(ui.indexOf("function renderMacros"), ui.indexOf("function renderMacroDraftSteps"));
  assert.ok(/macroSaveIndex\(currentConfig\.macros, macroEditIndex\) === null/.test(render));
  const save = ui.slice(ui.indexOf("function saveMacroFromUI"), ui.indexOf("function deleteMacro"));
  assert.ok(/macroSaveIndex\(currentConfig\.macros, macroEditIndex\)/.test(save));
  assert.ok(!/next\.macros\.length : macroEditIndex/.test(save), "alter ungeprüfter Index");
});

test("Makros: Löschen nummeriert Tasten neu und Staging", () => {
  const key = (tap, hold = "NONE", dtap = "NONE") => ({ label: "", tap, hold, dtap });
  const config = {
    macros: [{ name: "a", steps: [] }, { name: "b", steps: [] }, { name: "c", steps: [] }],
    layers: [[[key("MACRO_0"), key("KEY_A", "MACRO_1"), key("KEY_B", "NONE", "MACRO_2"), "MACRO_1"]]]
  };
  const next = api.removeMacroAt(config, 1);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(next.macros.map(m => m.name))), ["a", "c"]);
  const row = next.layers[0][0];
  assert.strictEqual(row[0].tap, "MACRO_0");
  assert.strictEqual(row[1].hold, "NONE");
  assert.strictEqual(row[2].dtap, "MACRO_1");
  assert.strictEqual(row[3], "NONE");
  assert.strictEqual(config.layers[0][0][1].hold, "MACRO_1");   // nicht in-place
  assert.strictEqual(api.removeMacroAt(config, 3), null);
  assert.ok(api.isMacroUsed(config.layers, 2));
  assert.ok(!api.isMacroUsed(next.layers, 2));
  // Rückgängig: das Makro kommt zurück, nur die geleerten Verweise werden wieder gesetzt
  next.layers[0][0][1].tap = "KEY_Q";                              // spätere Tastenänderung
  next.layers[0][0][3] = "KEY_W";                                  // geleerte Position später neu belegt
  const back = api.restoreMacroAt(next, 1, config.macros[1], next.cleared);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(back.macros.map(m => m.name))), ["a", "b", "c"]);
  const brow = back.layers[0][0];
  assert.strictEqual(brow[0].tap, "MACRO_0");
  assert.strictEqual(brow[1].tap, "KEY_Q");                        // spätere Änderung bleibt
  assert.strictEqual(brow[1].hold, "MACRO_1");                     // geleerter Verweis zurück
  assert.strictEqual(brow[2].dtap, "MACRO_2");                     // nachgerückter Verweis zurück
  assert.strictEqual(brow[3], "KEY_W");                            // neu belegt: bleibt
  assert.strictEqual(api.restoreMacroAt({ macros: Array(api.MAX_MACROS).fill({ steps: [] }), layers: [] }, 0, { steps: [] }, []), null);
});

// Voller Sync aus js/config-sync.js mit Fake-USB-Verbindung. reply(cmd) liefert die Antwortzeile oder null.
// holdMs: Timer mit dieser Dauer laufen nicht sofort, sondern warten in held (Ausblend-Timer des Balkens)
function fullSyncHarness(reply, holdMs = null) {
  const progress = [];
  const toasts = [];
  const sent = [];
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.combos = [{ key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 }, behavior: "KEY_PRESS", action: "KEY_ESC" }];
  cfg.keyPairs = [{ first: "KEY_LEFT_ALT", second: "*" }];
  cfg.macros = [
    { name: "Copy", steps: [{ type: "down", code: "KEY_LEFT_GUI" }, { type: "tap", code: "KEY_C" }, { type: "up", code: "KEY_LEFT_GUI" }] },
    { name: "Warten", steps: [{ type: "pause", ms: 250 }, { type: "tap", code: "a" }] }
  ];
  const delays = [];
  // Texte über dem Balken in der Reihenfolge der Anzeige; hidden = Label ausgeblendet
  const labels = [];
  const label = { style: { set display(v) { if (v === "none") labels.hidden = true; } },
                  set textContent(v) { labels.push(v); } };
  const held = [];
  const w = {
    console: { error() {}, warn() {} }, sent, reply, delays, held,
    setTimeout: (fn, ms) => {
      delays.push(ms);
      if (ms === holdMs) { held.push({ fn, cleared: false }); return held.length; }
      Promise.resolve().then(fn);
      return 0;
    },
    clearTimeout: id => { if (id > 0 && held[id - 1]) held[id - 1].cleared = true; },
    document: { getElementById: id => id === "autoSyncProgressBar"
      ? { style: { set width(v) { progress.push(parseInt(v, 10)); } } }
      : (id === "autoSyncProgressLabel" ? label : { style: {} }) }
  };
  vm.createContext(w);
  vm.runInContext(`${code}
${read("js/side-routing.js")}
var isAutoSyncing = false, isConfigModeActive = false, editSide = "R", bleConfigChar = null;
var serialPort = { writable: true };
function connectedSide() { return "R"; }
function configFor() { return cfgRef; }
function activeProfile() { return SIDE_PROFILES.R; }
function alert() {}
function showToast(t) { toastsRef.push(t); }
function updateConfigModeUI(active, syncing = false) { isAutoSyncing = syncing; }
function pendingFor() { return []; }
function clearPendingSync() {}
function setPendingFor() {}
function renderPendingSyncUI() {}
async function disconnectBle() { return true; }
async function sendBleCommand() { return false; }
const ackRegistry = Dactyl.createAckRegistry({ set: () => 0, clear: () => {} });
const waitForAck = (p, t, side, unknownOk) => ackRegistry.wait(p, t, side, unknownOk);
const resolveAcksForLine = (line, side) => ackRegistry.resolveLine(line, side);
const rejectAllPendingAcks = (reason, side) => ackRegistry.reject(reason, side);
async function sendSerialCommand(cmd) {
  sent.push(cmd);
  const line = reply(cmd);
  if (line) Promise.resolve().then(() => resolveAcksForLine(line, "R"));
  return true;
}
${read("js/config-sync.js")}
this.write = writeConfigToESP32;
this.state = () => ({ isAutoSyncing });
this.setBle = (char, disconnect) => { bleConfigChar = char; disconnectBle = disconnect; };`, Object.assign(w, { cfgRef: cfg, toastsRef: toasts }));
  return { w, progress, toasts, sent, delays, labels, held };
}

const okReply = cmd => cmd.startsWith("SET_K ") ? null : `OK ${cmd}`;

asyncTests.push(["Sync: Schrittzahl passt zu den gesendeten Schritten", async () => {
  const { w, progress, sent } = fullSyncHarness(okReply);
  await w.write();
  assert.ok(sent.includes("SAVE_PAIRS"));
  // Breite: 2 % beim Start, dann ein Wert pro Schritt, am Ende 0 % (Ausblenden). Ohne Kappung: zu viele
  // Schritte enden unter 100 %, zu wenige laufen darüber
  assert.strictEqual(progress[0], 2);
  assert.strictEqual(progress.at(-1), 0);
  const steps = progress.slice(1, -1);
  const settings = sent.filter(c => /^SET_(STANDBY|SLEEP|DEV_NAME|DEBOUNCE|COMBO_TIMEOUT|TAPPING_TERM) /.test(c)).length;
  const names = sent.filter(c => c.startsWith("SET_NAME ")).length;
  const keys = sent.filter(c => c.startsWith("SET_K ")).length;
  const combos = sent.filter(c => c.startsWith("ADD_COMBO ")).length;
  const macros = sent.filter(c => c === "ADD_MACRO").length;
  assert.strictEqual(macros, 2);
  // SAVE_NVS, SAVE_COMBOS, die Tastenpaar-Phase, je Makro ein Schritt und SAVE_MACROS
  assert.strictEqual(steps.length, settings + names + keys + 1 + combos + 1 + 1 + macros + 1);
  assert.strictEqual(steps.at(-1), 100);
  assert.ok(steps.every(p => p <= 100), `Fortschritt über 100 %: ${Math.max(...steps)}`);
}]);

test("Sync: countSyncSteps zählt jeden Einstellungs-Befehl und jede Combo", () => {
  const ctx = { NUM_LAYERS: 8, NUM_ROWS: 6, NUM_COLS: 7, clampSetting: api.clampSetting, sanitizeCommandText: api.sanitizeCommandText };
  vm.createContext(ctx);
  vm.runInContext(`${section("js/config-sync.js", "// Einstellungs-Befehle des vollen Syncs", "// One-Shot-Auto-Sync")}
    this.count = countSyncSteps; this.build = buildSettingCommands;`, ctx);
  // Eine weitere Einstellung erhöht die Schrittzahl (früher fest "+ 9")
  assert.strictEqual(ctx.count(7, 8, 2) - ctx.count(6, 8, 2), 1);
  assert.strictEqual(ctx.count(6, 8, 3) - ctx.count(6, 8, 2), 1);
  assert.strictEqual(ctx.count(6, 8, 0), 6 + 8 + 8 * 6 * 7 + 4);
  assert.strictEqual(ctx.count(6, 8, 0, 3) - ctx.count(6, 8, 0), 3);
  const cmds = ctx.build({}, R);
  assert.strictEqual(cmds.length, 6);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(cmds.filter(c => c.optional).map(c => c.ack))), ["SET_TAPPING_TERM"]);
});

asyncTests.push(["Sync: Text über dem Balken zählt die übertragenen Schritte", async () => {
  const { w, labels, progress } = fullSyncHarness(okReply);
  await w.write();
  const steps = progress.slice(1, -1).length;
  assert.strictEqual(labels[0], `Übertrage an ${R.label} …`);
  assert.strictEqual(labels[1], `Übertrage an ${R.label}: 0 / ${steps} Schritte`);
  assert.strictEqual(labels.at(-2), `Übertrage an ${R.label}: ${steps} / ${steps} Schritte`);
  assert.strictEqual(labels.at(-1), "Übertragung abgeschlossen");
  assert.strictEqual(labels.hidden, true);
  // Keine Live-Region: ein Screenreader würde jeden der etwa 400 Schritte ansagen
  const labelTag = /<div id="autoSyncProgressLabel"[^>]*>/.exec(read("index.html"));
  assert.ok(labelTag, "autoSyncProgressLabel fehlt in index.html");
  assert.ok(!/aria-live/.test(labelTag[0]));
  // Abbruch: eigener Endtext
  const bad = fullSyncHarness(cmd => cmd === "SAVE_NVS" ? "ERR NVS SAVE_NVS" : okReply(cmd));
  await bad.w.write();
  assert.strictEqual(bad.labels.at(-1), "Übertragung abgebrochen");
  assert.ok(!bad.labels.includes("Übertragung abgeschlossen"));
}]);

asyncTests.push(["Sync: Ausblend-Timer eines früheren Syncs blendet die Anzeige eines neuen Syncs nicht aus", async () => {
  const { w, labels, held } = fullSyncHarness(okReply, 600);
  await w.write();
  assert.strictEqual(held.length, 1);
  // Zweiter Sync (Live-Sync nach 300 ms) startet, bevor der erste Timer abläuft
  const second = w.write();
  assert.strictEqual(held[0].cleared, true, "neuer Sync löscht den alten Ausblend-Timer");
  await second;
  assert.strictEqual(labels.hidden, undefined);
  // Der Timer des zweiten Syncs blendet aus
  held[1].fn();
  assert.strictEqual(labels.hidden, true);
}]);

asyncTests.push(["One-Shot: Trennen ohne Wartezeit, isAutoSyncing endet auch bei einem Fehler im Trennen", async () => {
  const { w, delays } = fullSyncHarness(okReply);
  let disconnects = 0;
  w.setBle({}, async () => { disconnects++; throw new Error("GATT"); });
  // USB-Pfad für die Befehle: BLE-Senden schlägt fehl, der Sync bricht ab und trennt trotzdem
  const running = w.write({ autoDisconnectAfter: true }).catch(() => {});
  assert.strictEqual(w.state().isAutoSyncing, true);
  await running;
  assert.strictEqual(disconnects, 1);
  assert.strictEqual(w.state().isAutoSyncing, false);
  // Keine Wartezeit vor dem Trennen: nur der 600-ms-Timer zum Ausblenden des Balkens
  assert.ok(!delays.includes(150), `Wartezeiten: ${delays}`);
}]);

asyncTests.push(["Sync: Firmware ohne SET_TAPPING_TERM bricht den Sync nicht ab", async () => {
  const { w, toasts, sent } = fullSyncHarness(cmd =>
    cmd.startsWith("SET_TAPPING_TERM") ? `ERR UNKNOWN ${cmd}` : okReply(cmd));
  await w.write();
  assert.ok(sent.some(c => c.startsWith("SET_K ")));
  assert.ok(sent.includes("SAVE_PAIRS"));
  assert.ok(toasts.some(t => t.includes("SET_TAPPING_TERM") && t.includes("flashen")));
  assert.ok(toasts.some(t => t.includes("Vollständige Konfiguration")));
  // Andere Befehle bleiben Pflicht
  const strict = fullSyncHarness(cmd => cmd.startsWith("SET_DEBOUNCE") ? `ERR UNKNOWN ${cmd}` : okReply(cmd));
  await strict.w.write();
  assert.ok(!strict.sent.some(c => c.startsWith("SET_K ")));
  assert.ok(strict.toasts.some(t => t.includes("Fehler beim Übertragen")));
}]);

asyncTests.push(["Sync: Makros gehen als CLEAR_MACROS, ADD_MACRO, ADD_MACRO_STEP und SAVE_MACROS", async () => {
  const { w, sent } = fullSyncHarness(okReply);
  await w.write();
  const start = sent.indexOf("CLEAR_MACROS");
  assert.ok(start > sent.indexOf("SAVE_PAIRS"));
  assert.deepStrictEqual(sent.slice(start), [
    "CLEAR_MACROS",
    "ADD_MACRO", "ADD_MACRO_STEP 2 131 0", "ADD_MACRO_STEP 1 99 0", "ADD_MACRO_STEP 3 131 0",
    "ADD_MACRO", "ADD_MACRO_STEP 4 0 250", "ADD_MACRO_STEP 1 97 0",
    "SAVE_MACROS"
  ]);
}]);

asyncTests.push(["Sync: Firmware ohne Makros überspringt die Makro-Phase mit Hinweis", async () => {
  const { w, toasts, sent, progress } = fullSyncHarness(cmd => cmd === "CLEAR_MACROS" ? `ERR UNKNOWN ${cmd}` : okReply(cmd));
  await w.write();
  // Auch mit übersprungener Phase endet der Balken bei 100 %
  assert.strictEqual(progress.at(-2), 100);
  assert.ok(sent.includes("CLEAR_MACROS"));
  assert.ok(!sent.some(c => c.startsWith("ADD_MACRO") || c === "SAVE_MACROS"));
  assert.ok(toasts.some(t => t.includes("CLEAR_MACROS") && t.includes("flashen")));
  assert.ok(toasts.some(t => t.includes("Vollständige Konfiguration")));
  // Ein abgelehnter Schritt bricht den Sync ab (kein stilles Abschneiden)
  const bad = fullSyncHarness(cmd => cmd.startsWith("ADD_MACRO_STEP 4") ? `ERR ARGS ${cmd}` : okReply(cmd));
  await bad.w.write();
  assert.ok(!bad.sent.includes("SAVE_MACROS"));
  assert.ok(bad.toasts.some(t => t.includes("Fehler beim Übertragen")));
}]);

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

test("One-Shot-Modifier und Caps Word: Aktionscodes wie DactylCommon.h, Labels und Rückweg", () => {
  const common = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "DactylCommon.h"), "utf8");
  const fw = name => Number(new RegExp(`#define ACT_${name}\\s+(0x[0-9A-F]+)`).exec(common)[1]);
  const codes = ["OSM_LCTRL", "OSM_LSHIFT", "OSM_LALT", "OSM_LGUI", "OSM_RCTRL", "OSM_RSHIFT", "OSM_RALT", "OSM_RGUI"];
  assert.strictEqual(Number(/#define NUM_ONE_SHOT_ACTIONS\s+(\d+)/.exec(common)[1]), codes.length);
  // Reihenfolge = Modifier-Bit (KEY_LEFT_CTRL + i), wie oneShotMaskForAction in der Firmware
  codes.forEach((code, i) => assert.strictEqual(api.actionCodeToNumeric(code), fw("ONE_SHOT_BASE") + i, code));
  const all = api.KEYCODES.flatMap(g => g.keys);
  for (const code of [...codes, "CAPS_WORD"]) {
    const n = api.actionCodeToNumeric(code);
    assert.strictEqual(n, fw(code), code);
    const label = api.ONE_SHOT_LABELS[code];
    assert.ok(label && label.length <= 8, code);
    assert.deepStrictEqual({ ...api.findDefinitionByCode(n) }, { label, tap: code });
    assert.strictEqual(api.holdSublabel(code), label);
    assert.ok(!api.isKeyPairMember(code), `${code} ist kein Paar-Mitglied`);
    assert.ok(all.some(k => k.code === code), `${code} in der Auswahl`);
  }
  assert.strictEqual(fw("CAPS_WORD"), 0x168);
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
var Dactyl = { SIDE_IDS: ["R", "L"] };
${section("js/live-monitor.js", "// Combos gelten je Hälfte", "function showComboAlert")}
var activeHandView = ${JSON.stringify(handView)};
var editSide = ${JSON.stringify(edited)};
const activePressedKeys = new Set();
const configs = { R: JSON.parse(JSON.stringify(SIDE_PROFILES.R.defaultConfig)),
                  L: JSON.parse(JSON.stringify(SIDE_PROFILES.L.defaultConfig)) };
function configFor(side) { return configs[side]; }
function showComboAlert(combo) { alerts.push(combo.id); }
function hideComboAlert() { alerts.push(null); }
this.live = { resolveKeysFromEvent, checkActiveCombos, activePressedKeys, getSharedHeldLayer, configs,
  setView: v => { activeHandView = v; } };`, live);
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

test("Live-Monitor Einzelansicht: ein MO der ausgeblendeten Hälfte gilt für die bearbeitete", () => {
  // triggerVisualKeyPress markiert jede Taste mit ihrer Hälfte, unabhängig von der Ansicht (SPLIT_KEY, USB)
  const ctx = liveContext("right", "R");
  const { configs, activePressedKeys } = ctx.live;
  configs.L.layers[0][5][0] = { tap: "MO_2", label: "MO2" };
  configs.R.layers[2][2][1] = { tap: "KEY_PAGE_UP", label: "PgUp" };
  activePressedKeys.add("L_5_0");
  assert.strictEqual(ctx.live.getSharedHeldLayer(), 2);
  const hit = JSON.parse(JSON.stringify(ctx.live.resolveKeysFromEvent({ code: "PageUp", key: "", altKey: false })));
  assert.deepStrictEqual(hit.map(h => `${h.side}R${h.matched.r}C${h.matched.c}L${h.matched.layer}`), ["RR2C1L2"]);
});

test("Live-Monitor: ein gehaltenes MO einer Hälfte gilt auf beiden Hälften", () => {
  const ctx = liveContext("both", "R");
  const { configs, activePressedKeys } = ctx.live;
  configs.L.layers[0][5][0] = { tap: "MO_2", label: "MO2" };
  configs.R.layers[0][5][6] = { tap: "MO_1", label: "MO1" };
  assert.strictEqual(ctx.live.getSharedHeldLayer(), 0);
  activePressedKeys.add("L_5_0");
  assert.strictEqual(ctx.live.getSharedHeldLayer(), 2);
  // Höchste Ebene gewinnt, wie getActiveLayer() der Firmware
  activePressedKeys.add("R_5_6");
  assert.strictEqual(ctx.live.getSharedHeldLayer(), 2);
  activePressedKeys.delete("L_5_0");
  assert.strictEqual(ctx.live.getSharedHeldLayer(), 1);
  // Die rechte Hälfte löst mit der Ebene auf, die links gehalten wird
  activePressedKeys.delete("R_5_6");
  activePressedKeys.add("L_5_0");
  configs.R.layers[2][2][1] = { tap: "KEY_PAGE_UP", label: "PgUp" };
  const hit = ctx.live.resolveKeysFromEvent({ code: "PageUp", key: "", altKey: false });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(hit)).map(h => `${h.side}R${h.matched.r}C${h.matched.c}L${h.matched.layer}`), ["RR2C1L2"]);
});

test("Ansichtswechsel prüft den Combo-Hinweis neu", () => {
  const handler = section("js/editor.js", "// Hand Switcher Buttons", "// Apply Layout Preset Button");
  assert.ok(/checkActiveCombos\(\)/.test(handler));
});

test("Layout-Profile: Speichern, Ersetzen, Löschen und Grenzen", () => {
  const cfgA = { layers: [[[{ tap: "KEY_A" }]]] };
  const cfgB = { layers: [[[{ tap: "KEY_B" }]]] };
  let res = api.upsertLayoutProfile([], "  Gaming\n", cfgA, "t1");
  assert.strictEqual(res.replaced, false);
  assert.strictEqual(res.profiles[0].name, "Gaming");
  // Kopie: spätere Änderungen an der Config verändern das Profil nicht
  cfgA.layers[0][0][0].tap = "KEY_Z";
  assert.strictEqual(res.profiles[0].config.layers[0][0][0].tap, "KEY_A");
  const first = res.profiles;
  res = api.upsertLayoutProfile(first, "Code", cfgB, "t2");
  assert.deepStrictEqual([...res.profiles.map(p => p.name)], ["Gaming", "Code"]);
  // Gleicher Name ohne Groß-/Kleinschreibung ersetzt an derselben Stelle; die alte Liste bleibt unverändert
  res = api.upsertLayoutProfile(res.profiles, "gaming", cfgB, "t3");
  assert.strictEqual(res.replaced, true);
  assert.deepStrictEqual([...res.profiles.map(p => p.name)], ["gaming", "Code"]);
  assert.strictEqual(res.profiles[0].savedAt, "t3");
  assert.strictEqual(first[0].savedAt, "t1");
  assert.strictEqual(api.findLayoutProfileIndex(res.profiles, "CODE"), 1);
  assert.throws(() => api.upsertLayoutProfile([], ' "\\ ', cfgA, "t"), /Profilname fehlt/);
  const full = Array.from({ length: api.MAX_LAYOUT_PROFILES }, (_, i) => ({ name: `P${i}`, savedAt: "", config: cfgA }));
  assert.throws(() => api.upsertLayoutProfile(full, "Neu", cfgA, "t"), /Maximal/);
  assert.strictEqual(api.upsertLayoutProfile(full, "p3", cfgB, "t").replaced, true);
  assert.deepStrictEqual([...api.removeLayoutProfile(res.profiles, "code").map(p => p.name)], ["gaming"]);
  assert.strictEqual(api.removeLayoutProfile(res.profiles, "fehlt"), res.profiles);
});

test("Layout-Profile: Namen werden wie str.casefold() in server.py verglichen", () => {
  const list = [{ name: "Straße", savedAt: "", config: {} }];
  assert.strictEqual(api.findLayoutProfileIndex(list, "STRASSE"), 0);
  assert.strictEqual(api.findLayoutProfileIndex(list, "strasse"), 0);
  assert.strictEqual(api.upsertLayoutProfile(list, "STRASSE", { layers: [] }, "t").replaced, true);
  assert.strictEqual(api.findLayoutProfileIndex([{ name: "Σ" }], "ς"), 0);
  // Großes ẞ: casefold ergibt "ss", toUpperCase allein ließe es stehen
  assert.strictEqual(api.findLayoutProfileIndex(list, "STRAẞE"), 0);
  assert.strictEqual(api.findLayoutProfileIndex([{ name: "ẞ" }], "ss"), 0);
  // ı ist für casefold nicht gleich i
  assert.strictEqual(api.findLayoutProfileIndex([{ name: "ı" }], "i"), -1);
  assert.strictEqual(api.findLayoutProfileIndex([{ name: "ı" }], "I"), -1);
  // End-Sigma im Wort: zeichenweise gleich wie casefold
  assert.strictEqual(api.findLayoutProfileIndex([{ name: "ΑΣ" }], "ασ"), 0);
  assert.strictEqual(api.findLayoutProfileIndex(list, "Strase"), -1);
});

test("Combos: Modifier Hold mit One-Shot und Caps Word wird abgelehnt oder migriert", () => {
  const combo = (behavior, action) => ({ layers: [[[]]], combos: [{ key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 }, behavior, action }] });
  for (const action of ["OSM_LSHIFT", "OSM_RGUI", "CAPS_WORD"]) {
    assert.ok(api.isOneShotOrCapsWordCode(action));
    const migrated = combo("MODIFIER_HOLD", action);
    api.validateConfigShape(migrated, R);
    assert.strictEqual(migrated.combos[0].behavior, "KEY_PRESS");
    api.validateConfigShape(combo("KEY_PRESS", action), R);
  }
  assert.ok(!api.isOneShotOrCapsWordCode("KEY_LEFT_SHIFT"));
  assert.ok(!api.isOneShotOrCapsWordCode("constructor"));
  // Firmware-Namen, die server.py ebenfalls annimmt
  assert.ok(api.isOneShotOrCapsWordCode("ACT_OSM_LSHIFT") && api.isOneShotOrCapsWordCode("ACT_CAPS_WORD"));
  assert.ok(!api.isOneShotOrCapsWordCode("ACT_MOUSE_LEFT"));
  // Gespeicherte Configs mit der alten Form: validateConfigShape wandelt die Combo in KEY_PRESS um, statt abzulehnen
  const legacy = combo("MODIFIER_HOLD", "CAPS_WORD");
  api.validateConfigShape(legacy, R);
  assert.strictEqual(legacy.combos[0].behavior, "KEY_PRESS");
  api.validateConfigShape(combo("MODIFIER_HOLD", "KEY_LEFT_SHIFT"), R);
});

test("Layout-Profile: Namensvergleich entspricht str.casefold() für jedes Unicode-Zeichen", () => {
  // Unicode-Tabellen von Python und Node können sich unterscheiden: nur bei gleicher Version vergleichen
  const py = require("child_process").spawnSync("python3", ["-I", "-c",
    // Zeichen, deren casefold, upper oder lower abweicht, plus alle Faltungen: jedes andere Zeichen bildet auf sich selbst ab
    "import json,sys,unicodedata\n"
    + "s={chr(i) for i in range(0x110000) if not 0xD800<=i<=0xDFFF and (chr(i).casefold()!=chr(i) or chr(i).upper()!=chr(i) or chr(i).lower()!=chr(i))}\n"
    + "t=set(s)\n"
    + "for c in s: t.update(c.casefold())\n"
    + "json.dump({'v': unicodedata.unidata_version, 'p': [[c, c.casefold()] for c in sorted(t)]}, sys.stdout)"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  assert.strictEqual(py.status, 0, py.stderr);
  const { v, p: pairs } = JSON.parse(py.stdout);
  if (v.split(".")[0] !== process.versions.unicode.split(".")[0]) {
    skipTest(`Unicode ${v} (Python) und ${process.versions.unicode} (Node) unterscheiden sich`);
    return;
  }
  // Beide Richtungen: gleiche App-Klasse bedeutet gleichen casefold, und umgekehrt
  const foldOfKey = new Map(), keyOfFold = new Map(), mismatches = [];
  for (const [ch, fold] of pairs) {
    const key = api.layoutProfileNameKey(ch);
    // Mehrzeichen-Faltungen (ß → ss, ﬃ → ffi): der Schlüssel des Zeichens entspricht dem Schlüssel seiner Faltung
    if (api.layoutProfileNameKey(fold) !== key) mismatches.push(`${ch}: Schlüssel von Zeichen und Faltung verschieden`);
    if (foldOfKey.has(key) && foldOfKey.get(key) !== fold) mismatches.push(`${ch} und ${foldOfKey.get(key)} haben gleichen Schlüssel, aber verschiedenen casefold`);
    foldOfKey.set(key, fold);
    if (keyOfFold.has(fold) && keyOfFold.get(fold) !== key) mismatches.push(`${ch}: gleicher casefold, aber verschiedener Schlüssel`);
    keyOfFold.set(fold, key);
  }
  assert.deepStrictEqual(mismatches.slice(0, 10), []);
  // Namen aus mehreren Zeichen: gleiche Schlüssel genau dann, wenn die casefold-Ergebnisse gleich sind
  const foldOf = new Map(pairs);
  const foldName = name => Array.from(name, c => foldOf.get(c) ?? c).join("");
  for (const [a, b] of [["Straße", "STRASSE"], ["FFI", "ffi"], ["Mein ẞ", "mein ss"], ["Ωmega", "ωMEGA"], ["Ab ı", "AB I"]]) {
    assert.strictEqual(api.layoutProfileNameKey(a) === api.layoutProfileNameKey(b), foldName(a) === foldName(b), `${a} / ${b}`);
  }
});

test("Layout-Profile: Namen wie sanitize_name in server.py (unverändert gültig)", () => {
  // Kürzen auf 31 Zeichen darf kein Leerzeichen am Ende lassen
  assert.strictEqual(api.sanitizeLayoutProfileName(`${"a".repeat(30)} b`), "a".repeat(30));
  assert.strictEqual(api.sanitizeLayoutProfileName(' Mein "Layout"\t\\ '), "Mein Layout");
  // Nicht druckbare Zeichen (Python str.isprintable) fallen weg, Umlaute bleiben
  assert.strictEqual(api.sanitizeLayoutProfileName("Grün ​Ä "), "GrünÄ");
  assert.strictEqual(Array.from(api.sanitizeLayoutProfileName("😀".repeat(40))).length, 31);
});


// =============================================================================
// DOM-Stub-Tests: js/macros-ui.js, Staging in js/editor-events.js und js/layout-profiles-ui.js
// =============================================================================
// Minimales DOM: Elemente nach ID, Listener, Kinder; nur was die getesteten Module nutzen
function fakeDom() {
  const byId = {};
  const make = (tag = "div") => {
    const el = {
      tagName: tag.toUpperCase(), children: [], listeners: {}, style: {}, dataset: {}, disabled: false,
      value: "", textContent: "", className: "", title: "", type: "", options: [], selectedIndex: 0,
      get innerHTML() { return ""; }, set innerHTML(_) { this.children = []; },
      appendChild(child) { this.children.push(child); return child; },
      append(...nodes) { nodes.forEach(n => this.children.push(n)); },
      replaceChildren() { this.children = []; },
      remove() {},
      addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
      async fire(type, ev = {}) { for (const fn of this.listeners[type] || []) await fn({ target: this, ...ev }); },
      querySelectorAll(sel) {
        if (sel !== ".modal-body button") return [];
        const out = [];
        const walk = n => { (n.children || []).forEach(c => { if (c.tagName === "BUTTON") out.push(c); walk(c); }); };
        walk(this);
        // Statische Knöpfe des Dialogs (Speichern) liegen nicht im Baum der Stubs
        return out.concat(this.staticButtons || []);
      },
      click() { return this.fire("click"); }
    };
    return el;
  };
  const document = {
    getElementById: id => byId[id] || (byId[id] = make()),
    createElement: tag => make(tag),
    addEventListener() {}
  };
  return { document, byId, make };
}

// Kontext mit dem gemeinsamen Kern (code), einer Config der rechten Hälfte und Stubs für Anzeige und Server
function uiHarness(extra = "") {
  const dom = fakeDom();
  const log = { pending: [], toasts: [], alerts: [], saved: 0, sent: [], fetches: [], confirm: true };
  const w = {
    console: { log() {}, warn() {}, error() {} }, document: dom.document, log,
    setTimeout: fn => { Promise.resolve().then(fn); return 0; }, clearTimeout() {}
  };
  w.confirm = () => log.confirm;
  w.alert = msg => log.alerts.push(msg);
  vm.createContext(w);
  vm.runInContext(`${code}
var editSide = "R", activeLayerIndex = 0, selectedKey = null;
var currentConfig = normalizeConfig(JSON.parse(JSON.stringify(SIDE_PROFILES.R.defaultConfig)), SIDE_PROFILES.R);
var pendingBySide = { R: [], L: [] };
function activeProfile() { return SIDE_PROFILES[editSide]; }
function markPendingSync(change, side = editSide) { change.id = pendingBySide[side].length + 1; pendingBySide[side].push(change); log.pending.push(change); }
function pendingFor(side) { return pendingBySide[side]; }
function showToast(t) { log.toasts.push(t); }
function saveConfigToServer() { log.saved++; }
function renderMatrix() {} function renderLayerButtons() {} function renderCombosTable() {} function renderKeyPairs() {}
function updateInspector() {} function applySettingsToInputs() {} function applySelectFilter() {}
function clearKeySelection() {} function isEditableTarget() { return false; }
async function sendDeviceCommand(cmd, side) { log.sent.push(cmd); return true; }
${section("js/key-pairs-ui.js", "function keycodeLabel", "\n}\n")}
}
var window = this;
${extra}
${read("js/macros-ui.js")}
${read("js/layout-profiles-ui.js")}
`, w);
  return { w, dom, log };
}

test("Makro-UI: Speichern und Rückgängig ersetzen nur die Makro-Liste", () => {
  const { w, dom, log } = uiHarness();
  vm.runInContext("currentConfig.macros = [];", w);
  w.openMacroEditor(-1);
  dom.document.getElementById("macroNameInput").value = "Copy";
  dom.document.getElementById("macroStepType").value = "tap";
  dom.document.getElementById("macroStepCode").value = "KEY_C";
  w.addMacroStepFromUI();
  w.saveMacroFromUI();
  assert.strictEqual(vm.runInContext("currentConfig.macros.length", w), 1);
  const change = log.pending.at(-1);
  assert.ok(change.snapshot && change.macros);
  assert.strictEqual(change.title, "Makro 0 hinzugefügt");
  change.revert();
  assert.strictEqual(vm.runInContext("currentConfig.macros.length", w), 0);
});

test("Makro-UI: Löschen und Rückgängig behalten spätere Tastenänderungen", () => {
  const { w, log } = uiHarness();
  vm.runInContext(`currentConfig.macros = [{ name: "a", steps: [{ type: "tap", code: "KEY_A" }] },
                                           { name: "b", steps: [{ type: "tap", code: "KEY_B" }] }];
    currentConfig.layers[0][2][1] = { label: "M0", tap: "MACRO_0", hold: "NONE", dtap: "NONE" };
    currentConfig.layers[0][2][2] = { label: "M1", tap: "MACRO_1", hold: "NONE", dtap: "NONE" };`, w);
  w.deleteMacro(0);
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][2][1].tap", w), "NONE");
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][2][2].tap", w), "MACRO_0");
  // Spätere Änderung an einer anderen Taste
  vm.runInContext(`currentConfig.layers[0][3][1] = { label: "X", tap: "KEY_X", hold: "NONE", dtap: "NONE" };`, w);
  log.pending.at(-1).revert();
  assert.deepStrictEqual(JSON.parse(vm.runInContext("JSON.stringify(currentConfig.macros.map(m => m.name))", w)), ["a", "b"]);
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][2][1].tap", w), "MACRO_0");
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][2][2].tap", w), "MACRO_1");
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][3][1].tap", w), "KEY_X");
  // Rückgängig nicht möglich: die Meldung nennt die Ursache
  w.deleteMacro(0);
  const revert = log.pending.at(-1).revert;
  vm.runInContext(`currentConfig.macros = Array.from({ length: MAX_MACROS }, (_, i) => ({ name: "m" + i, steps: [] }));`, w);
  revert();
  assert.ok(log.toasts.at(-1).includes(`schon ${api.MAX_MACROS} Makros`));
  // Liste inzwischen kürzer als der Index: andere Ursache
  vm.runInContext(`currentConfig.macros = [{ name: "x", steps: [] }, { name: "y", steps: [] }];`, w);
  w.deleteMacro(1);
  const second = log.pending.at(-1).revert;
  vm.runInContext(`currentConfig.macros = [];`, w);
  second();
  assert.ok(log.toasts.at(-1).includes("Makro-Liste hat sich geändert"));
});

// Taste über den Inspektor übernehmen (setupEventListeners aus js/editor-events.js)
function applyKeyHarness() {
  const h = uiHarness(`var pendingChanges = [];
function togglePendingChangesDrawer() {} function discardAllPendingChanges() {} function populateComboKeyDropdowns() {}
function clearSelectFilter() {} function renderPendingSyncUI() {} function setPendingFor() {}
function writeConfigWithDiff() {} function saveAndFlashToDactyl() {} function readConfigFromESP32() {}
${read("js/editor-events.js")}`);
  const { w, dom } = h;
  // Selects: options/selectedIndex für das Label der Taste
  ["primaryActionSelect", "holdActionSelect", "dtapActionSelect"].forEach(id => {
    const el = dom.document.getElementById(id);
    el.options = [{ text: "M" }];
    el.value = "NONE";
  });
  w.setupEventListeners();
  return h;
}

asyncTests.push(["Live-Sync: Taste übernehmen merkt vor und sendet keinen Einzelbefehl", async () => {
  const { w, dom, log } = applyKeyHarness();
  vm.runInContext(`currentConfig.macros = [{ name: "a", steps: [{ type: "tap", code: "KEY_A" }] }];
    selectedKey = { r: 2, c: 1 };`, w);
  dom.document.getElementById("primaryActionSelect").value = "MACRO_0";
  await dom.document.getElementById("btnApplyKey").click();
  // Kein SET_KEY: markPendingSync startet bei verbundener Hälfte den vollen Sync
  assert.deepStrictEqual(log.sent, []);
  assert.strictEqual(log.pending.at(-1).type, "key");
  // markPendingSync (Stub) bekam die Hälfte R: dort plant requestLiveSync den Sync
  assert.strictEqual(vm.runInContext("pendingFor('R').at(-1).type", w), "key");
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][2][1].tap", w), "MACRO_0");
  // Einstellungen speichern: ebenfalls vormerken statt SET_*-Einzelbefehle
  await dom.document.getElementById("btnSaveSettings").click();
  assert.deepStrictEqual(log.sent, []);
  assert.strictEqual(log.pending.at(-1).type, "settings");
}]);

asyncTests.push(["Combo-Dialog: Modifier Hold mit One-Shot oder Caps Word wird nicht gespeichert", async () => {
  const { w, dom, log } = applyKeyHarness();
  const el = id => dom.document.getElementById(id);
  const save = async (behavior, action) => {
    el("comboKey1Select").value = "2,1";
    el("comboKey2Select").value = "2,2";
    el("comboBehaviorSelect").value = behavior;
    const sel = el("comboActionSelect");
    sel.value = action;
    sel.options = [{ text: action }];
    sel.selectedIndex = 0;
    await el("btnSaveCombo").click();
  };
  const count = () => vm.runInContext("currentConfig.combos.length", w);
  const before = count();
  for (const action of ["OSM_LSHIFT", "CAPS_WORD"]) {
    await save("MODIFIER_HOLD", action);
    assert.strictEqual(count(), before);
    assert.ok(log.alerts.at(-1).includes("Modifier Hold"));
  }
  // Gegenprobe: KEY_PRESS mit One-Shot und MODIFIER_HOLD mit Shift werden gespeichert
  await save("KEY_PRESS", "OSM_LSHIFT");
  await save("MODIFIER_HOLD", "KEY_LEFT_SHIFT");
  assert.strictEqual(count(), before + 2);
}]);

asyncTests.push(["Import: vorgemerkte Änderung trägt pairs und macros", async () => {
  const { w, dom, log } = applyKeyHarness();
  const cfg = { layers: [[[{ tap: "MACRO_0" }]]], macros: [{ name: "a", steps: [{ type: "tap", code: "KEY_A" }] }] };
  w.FileReader = function () {
    this.readAsText = () => Promise.resolve().then(() => this.onload({ target: { result: JSON.stringify(cfg) } }));
  };
  await dom.document.getElementById("fileInput").fire("change", { target: { files: [{ name: "x.json" }], value: "" } });
  await new Promise(r => setImmediate(r));
  const change = log.pending.at(-1);
  assert.strictEqual(change.type, "import");
  assert.ok(change.pairs && change.macros);
}]);

// Fetch-Stub für /api/profiles: Antworten in der Reihenfolge der Aufrufe
function profilesHarness(responses) {
  const h = uiHarness();
  const queue = responses.slice();
  h.w.fetch = async (url, opts = {}) => {
    h.log.fetches.push({ url, method: opts.method || "GET", body: opts.body ? JSON.parse(opts.body) : null });
    const next = queue.shift();
    if (next && next.gate) await next.gate;
    const { status = 200, body } = next || {};
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  vm.runInContext(`SIDE_PROFILES.R.label = "rechte Hälfte";`, h.w);
  return h;
}

asyncTests.push(["Layout-Profile: Laden, Seitenprüfung, Revert und Revision beim Speichern", async () => {
  const profileCfg = { layers: [[[{ tap: "KEY_Q" }]]] };
  const { w, dom, log } = profilesHarness([
    { body: { profiles: [{ name: "Gaming", savedAt: "", config: profileCfg }], revision: 3, skipped: [] } },
    { body: { profiles: [{ name: "Gaming", savedAt: "", config: profileCfg }], revision: 3, skipped: [] } },
    { body: { success: true, revision: 4 } }
  ]);
  await w.openLayoutProfilesDialog();
  const before = vm.runInContext("JSON.stringify(currentConfig.layers[0][0][0])", w);
  // Hälfte gewechselt: Laden tut nichts
  vm.runInContext(`editSide = "L";`, w);
  w.loadLayoutProfile("gaming");
  assert.strictEqual(log.pending.length, 0);
  vm.runInContext(`editSide = "R";`, w);
  w.loadLayoutProfile("gaming");
  const change = log.pending.at(-1);
  assert.ok(change.snapshot && change.pairs && change.macros && change.type === "profile_load");
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][0][0].tap", w), "KEY_Q");
  change.revert();
  assert.strictEqual(vm.runInContext("JSON.stringify(currentConfig.layers[0][0][0])", w), before);
  // Speichern sendet die gelesene Revision und übernimmt die neue
  await w.openLayoutProfilesDialog();
  dom.document.getElementById("layoutProfileNameInput").value = "Neu";
  await w.saveLayoutProfileFromUI();
  const post = log.fetches.find(f => f.method === "POST");
  assert.strictEqual(post.body.revision, 3);
  assert.deepStrictEqual(post.body.profiles.map(p => p.name), ["Gaming", "Neu"]);
  assert.strictEqual(vm.runInContext("layoutProfilesRevision", w), 4);
}]);

asyncTests.push(["Layout-Profile: Antwort ohne Liste, übersprungene Profile und Konflikt", async () => {
  // Antwort ohne Liste: klarer Fehler statt TypeError
  let h = profilesHarness([{ body: { nichts: true } }]);
  await h.w.openLayoutProfilesDialog();
  assert.ok(h.dom.document.getElementById("layoutProfilesStatus").textContent.includes("keine Profilliste"), h.dom.document.getElementById("layoutProfilesStatus").textContent);
  // Übersprungene Profile werden gemeldet
  h = profilesHarness([{ body: { profiles: [], revision: 1, skipped: ["Profil 'Alt': kaputt"] } }]);
  await h.w.openLayoutProfilesDialog();
  assert.ok(h.log.alerts.some(a => a.includes("Profil 'Alt'")));
  // Konflikt (409): Meldung und Neuladen der Liste mit neuer Revision
  h = profilesHarness([
    { body: { profiles: [], revision: 1, skipped: [] } },
    { status: 409, body: { success: false, error: "anderes Fenster" } },
    { body: { profiles: [{ name: "Fremd", savedAt: "", config: { layers: [[[]]] } }], revision: 2, skipped: [] } }
  ]);
  await h.w.openLayoutProfilesDialog();
  h.dom.document.getElementById("layoutProfileNameInput").value = "Mein";
  await h.w.saveLayoutProfileFromUI();
  const post = h.log.fetches.find(f => f.method === "POST");
  assert.strictEqual(post.body.revision, 1);
  assert.ok(h.log.alerts.some(a => a.includes("anderes Fenster")));
  assert.strictEqual(h.log.fetches.at(-1).method, "GET");
  assert.deepStrictEqual(JSON.parse(vm.runInContext("JSON.stringify(layoutProfiles.map(p => p.name))", h.w)), ["Fremd"]);
  assert.strictEqual(vm.runInContext("layoutProfilesRevision", h.w), 2);
}]);

asyncTests.push(["Layout-Profile: ein Lesen, das vor einem Schreibzugriff begann, überschreibt die Revision nicht", async () => {
  let releaseGet;
  const slowGet = new Promise(r => { releaseGet = r; });
  const h = profilesHarness([
    { body: { profiles: [], revision: 1, skipped: [] } },
    { gate: slowGet, body: { profiles: [], revision: 1, skipped: [] } },   // langsames Lesen mit altem Stand
    { body: { success: true, revision: 2 } }
  ]);
  await h.w.openLayoutProfilesDialog();
  const reading = h.w.reloadLayoutProfiles("R");
  h.dom.document.getElementById("layoutProfileNameInput").value = "Neu";
  await h.w.saveLayoutProfileFromUI();
  assert.strictEqual(vm.runInContext("layoutProfilesRevision", h.w), 2);
  releaseGet();
  await reading;
  assert.strictEqual(vm.runInContext("layoutProfilesRevision", h.w), 2);
  assert.deepStrictEqual(JSON.parse(vm.runInContext("JSON.stringify(layoutProfiles.map(p => p.name))", h.w)), ["Neu"]);
}]);

asyncTests.push(["Layout-Profile: Schreiben auf einer Hälfte verwirft das Lesen der anderen Hälfte nicht", async () => {
  let releaseWrite, releaseRead;
  const writeGate = new Promise(r => { releaseWrite = r; });
  const readGate = new Promise(r => { releaseRead = r; });
  const h = profilesHarness([
    { body: { profiles: [], revision: 0, skipped: [] } },                                   // Öffnen rechts
    { gate: writeGate, body: { success: true, revision: 1 } },                               // Schreiben rechts, hängt
    { gate: readGate, body: { profiles: [{ name: "Links", savedAt: "", config: { layers: [[[]]] } }], revision: 7, skipped: [] } }
  ]);
  await h.w.openLayoutProfilesDialog();
  h.dom.document.getElementById("layoutProfileNameInput").value = "Rechts";
  const saving = h.w.saveLayoutProfileFromUI();
  await Promise.resolve();
  h.w.closeLayoutProfilesDialog();
  vm.runInContext(`editSide = "L";`, h.w);
  const opening = h.w.openLayoutProfilesDialog();         // Lesen links beginnt vor dem Ende des Schreibens rechts
  releaseWrite();
  await saving;
  releaseRead();                                           // Lesen links endet nach dem Schreiben rechts
  await opening;
  assert.deepStrictEqual(JSON.parse(vm.runInContext("JSON.stringify(layoutProfiles && layoutProfiles.map(p => p.name))", h.w)), ["Links"]);
  assert.strictEqual(vm.runInContext("layoutProfilesRevision", h.w), 7);
}]);

asyncTests.push(["Layout-Profile: nach dem Schreiben rendert der Dialog nie die alte Liste", async () => {
  const cfg = { layers: [[[]]] };
  const h = profilesHarness([
    { body: { profiles: [{ name: "A", savedAt: "", config: cfg }], revision: 0, skipped: [] } },
    { body: { success: true, revision: 1 } },
    { body: { success: true, revision: 2 } }
  ]);
  await h.w.openLayoutProfilesDialog();
  const status = h.dom.document.getElementById("layoutProfilesStatus");
  const seen = [];
  Object.defineProperty(status, "textContent", { get() { return this._t; }, set(v) { this._t = v; seen.push(v); } });
  h.dom.document.getElementById("layoutProfileNameInput").value = "B";
  await h.w.saveLayoutProfileFromUI();
  assert.ok(!seen.some(t => t.startsWith("1 von")), `Dialog zeigte kurz die alte Liste: ${seen.join(" | ")}`);
  assert.strictEqual(seen.at(-1).split(" ")[0], "2");
  seen.length = 0;
  await h.w.deleteLayoutProfile("B");
  assert.ok(!seen.some(t => t.startsWith("2 von")), `Dialog zeigte kurz die alte Liste: ${seen.join(" | ")}`);
  assert.strictEqual(seen.at(-1).split(" ")[0], "1");
}]);

asyncTests.push(["Layout-Profile: Meldung über übersprungene Profile erscheint einmal pro Stand", async () => {
  const body = { profiles: [], revision: 3, skipped: ["Profil 'Alt': kaputt"] };
  const h = profilesHarness([{ body }, { body }, { body: { ...body, revision: 4 } }]);
  await h.w.openLayoutProfilesDialog();
  await h.w.openLayoutProfilesDialog();
  assert.strictEqual(h.log.alerts.filter(a => a.includes("Profil 'Alt'")).length, 1);
  await h.w.openLayoutProfilesDialog();                    // neuer Stand: erneut melden
  assert.strictEqual(h.log.alerts.filter(a => a.includes("Profil 'Alt'")).length, 2);
}]);

asyncTests.push(["Layout-Profile: Laden ist während eines Schreibzugriffs gesperrt", async () => {
  const { w, log } = profilesHarness([{ body: { profiles: [{ name: "Gaming", savedAt: "", config: { layers: [[[{ tap: "KEY_Q" }]]] } }], revision: 0, skipped: [] } }]);
  await w.openLayoutProfilesDialog();
  vm.runInContext("layoutProfilesBusy = true;", w);
  w.loadLayoutProfile("Gaming");
  assert.strictEqual(log.pending.length, 0);
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][0][0].tap !== 'KEY_Q'", w), true);
  vm.runInContext("layoutProfilesBusy = false;", w);
  w.loadLayoutProfile("Gaming");
  assert.strictEqual(log.pending.length, 1);
}]);

asyncTests.push(["Layout-Profile: fehlgeschlagener Schreibzugriff nach erneutem Öffnen lädt die Liste neu", async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const h = profilesHarness([
    { body: { profiles: [{ name: "A", savedAt: "", config: { layers: [[[]]] } }], revision: 0, skipped: [] } },
    { gate, status: 500, body: { success: false, error: "Platte voll" } },
    { body: { profiles: [{ name: "A", savedAt: "", config: { layers: [[[]]] } }], revision: 0, skipped: [] } },
    { body: { profiles: [{ name: "A", savedAt: "", config: { layers: [[[]]] } }], revision: 0, skipped: [] } }
  ]);
  await h.w.openLayoutProfilesDialog();
  h.dom.document.getElementById("layoutProfileNameInput").value = "B";
  const saving = h.w.saveLayoutProfileFromUI();
  await Promise.resolve();
  h.w.closeLayoutProfilesDialog();
  const reopening = h.w.openLayoutProfilesDialog();   // Lesen beginnt vor dem Ende des Schreibens
  release();
  await saving;
  await reopening;
  assert.ok(h.log.alerts.some(a => a.includes("Platte voll")));
  assert.deepStrictEqual(JSON.parse(vm.runInContext("JSON.stringify(layoutProfiles && layoutProfiles.map(p => p.name))", h.w)), ["A"]);
  assert.notStrictEqual(h.dom.document.getElementById("layoutProfilesStatus").textContent, "Speichert …");
}]);

asyncTests.push(["Layout-Profile: neu geöffneter Dialog übernimmt die Sperre eines laufenden Schreibzugriffs", async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const h = profilesHarness([
    { body: { profiles: [{ name: "A", savedAt: "", config: { layers: [[[]]] } }], revision: 0, skipped: [] } },
    { gate, body: { success: true, revision: 1 } },
    { body: { profiles: [{ name: "A", savedAt: "", config: { layers: [[[]]] } }], revision: 0, skipped: [] } }
  ]);
  await h.w.openLayoutProfilesDialog();
  h.dom.document.getElementById("layoutProfileNameInput").value = "B";
  const saving = h.w.saveLayoutProfileFromUI();
  await Promise.resolve();
  assert.strictEqual(vm.runInContext("layoutProfilesBusy", h.w), true);
  // Dialog schließen und während des Schreibens neu öffnen
  h.w.closeLayoutProfilesDialog();
  await h.w.openLayoutProfilesDialog();
  const modal = h.dom.document.getElementById("layoutProfilesModal");
  modal.children = [h.dom.document.getElementById("layoutProfilesList")];
  vm.runInContext("renderLayoutProfiles()", h.w);
  const buttons = modal.querySelectorAll(".modal-body button");
  assert.ok(buttons.length > 0 && buttons.every(b => b.disabled), "Knöpfe sind während des Schreibens aktiv");
  assert.strictEqual(h.dom.document.getElementById("layoutProfilesStatus").textContent, "Speichert …");
  release();
  await saving;
  assert.strictEqual(vm.runInContext("layoutProfilesBusy", h.w), false);
}]);

(async () => {
  for (const [name, fn] of asyncTests) {
    await fn();
    passed++;
    console.log(`[       OK ] ${name}`);
  }
  console.log(`\n${passed} App-Logik-Tests bestanden${skipped ? `, ${skipped} übersprungen` : ""}.`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
