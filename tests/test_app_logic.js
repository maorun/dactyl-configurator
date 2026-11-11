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
  ...["js/matrix-constants.js", "js/side-profiles.js", "js/side-right.js", "js/side-left.js", "js/side-state.js", "js/keycodes.js",
      "js/config-model.js", "js/flash-log.js"].map(read),
  section("js/editor.js", "// Alte Configs speichern Modifier-Halte-Aktionen", "function appendOptionGroup"),
  section("js/editor.js", "// Sichtbarkeit der Optionen bei einer Suche", "// Auswahl-IDs, deren Suche"),
  section("js/keyboard-hooks.js", "const ACTION_CODE_TO_EVENT_CODES", "// Gehaltene MO_x-Ebene einer Hälfte"),
  section("js/keyboard-hooks.js", "// Löst einen Browser-Tastencode für eine Hälfte auf", "// Alle Treffer eines Tastendrucks")
].join("\n");

const ctx = { TextDecoder };
vm.createContext(ctx);
vm.runInContext(`${code}
this.api = { keyToNumericActions, sanitizeCommandText, clampSetting, normalizeTriLayers, validateConfigShape,
             normalizeConfig, isPhysicalKey, findDefinitionByCode, actionCodeToNumeric, SETTINGS_RANGES,
             LEGACY_HOLD_CODES, normalizeHoldCode, holdSublabel,
             createTypingStats, recordKeyPress, correctionShares, topCorrectedKeys, keyPressRole, CORRECTION_WINDOW_MS, CORRECTION_MIN_PRESSES, fingerOfKey, fingerLoad, halfLoad, topSameFingerPairs, sameFingerPairKey, FINGER_IDS, SAME_FINGER_MAX_GAP_MS, computeWpm, suggestErgonomicSwaps, suggestCombos, heatLevel, maxKeyCount, serializeTypingStats, heatmapCounts, buildHeatmapCsv, WPM_WINDOW_MS, HEAT_LEVELS,
             isWiredSwitch, createMatrixTest, markMatrixKeyTested, summarizeMatrixTest, parseMatrixLine,
             parseMatrixRawLine, createMatrixRawState, applyMatrixRaw, resetMatrixRawState,
             recordMatrixBounce, MATRIX_BOUNCE_MS, lintLayouts, findActionUsages, findActionUsagesForSides, charPairIndexFromCode, clearAbsentKeyActions,
             COMBO_ALL_LAYERS, comboKeys, comboWindowMs, comboThirdKey, comboLayerMask, comboMaskLayers, comboAppliesOnLayer, isValidComboLayerMask, describeComboTuple, localComboTuples,
             SIDE_PROFILES,
             applyLayerOperation, swapLayersWithRefs, transparentLayer, isUndoBlocked, swapLayerKeys, mirrorLayerAcrossSides, swappedSelectionPosition, parseKeyDragPayload,
             ACT_KEY_PAIR_BASE, MAX_KEY_PAIRS, pairIndexFromCode, isKeyPairMember, isStandardKeyOrModifier, keyPairLabel,
             applyMatrixData, MATRIX_DATA_FIELDS, chordalExNormalize, chordalExHas, chordalExSet, chordalExList, captureChordalExLine, normalizeKeyCell, keyTapTerm, keyHoldFlavor, HOLD_FLAVOR_MAX, keyQuickTap,
             createDeviceSnapshot, captureListLine, buildConfigFromSnapshot, settingsFromDeviceInfo, deviceNameFromInfo, diffSettings, snapshotListsKnown, snapshotListsState, captureMatrixData, isDeviceSnapshotComplete, diffKeymap, staleLayoutState, describeKeyActions,
             DE_MAC_CHARS, charPairCode, charPairIndexFromCode, findKeyPairIndex, deMacCharForCode,
             resolveCharPairActions, keycodeOptionMatches, isKeyPairUsed, appendResolvedPairs, revertResolvedPairs,
             removeKeyPairAt, KEYCODES, UMLAUT_LABELS, ONE_SHOT_LABELS, holdSublabel,
             planKeyPairDeletion,
             ACT_MACRO_BASE, MAX_MACROS, MAX_MACRO_STEPS, MACRO_MAX_PAUSE_MS, MACRO_STEP_TYPES, macroIndexFromCode,
             MAX_KEY_OVERRIDES, KEY_OVERRIDE_MODS, isValidKeyOverride, isKeyOverrideMember, keyOverrideModsValue,
             normalizeKeyOverride, keyOverrideLayerMask, keyOverrideLabel, localOverrideTuples, describeOverrideTuple,
             MAX_ALT_REPEATS, isValidAltRepeat, hasDuplicateAltRepeat, normalizeAltRepeat, altRepeatsFromSameFingerPairs, localAltRepeatTuples, describeAltRepeatTuple,
             MAX_LEADER_SEQS, LEADER_MAX_KEYS, isLeaderCode, isLeaderKey, isLeaderAction, isValidLeaderSequence, normalizeLeaderSequence, hasDuplicateLeaderSequence,
             leaderSequenceLabel, localLeaderTuples, describeLeaderTuple, remapLeaderSequences, isLeaderActionUsed, leaderKeyNumbers,
             computeTimingRecommendations, computePerKeyTimingSuggestions, applyPerKeyTimingSuggestions, revertPerKeyTimingSuggestions, percentile, createKeyCapture, keyCaptureStart, KEY_CAPTURE_HELD_MS, keyCaptureStop, keyCaptureFeed,
             isValidMacroStep, isValidMacro, macroStepTuple, normalizeMacroStep, textToMacroSteps, macroCommands, isMacroUsed, removeMacroAt,
             macroSaveIndex, COMBO_PRESETS, LEADER_PRESETS, applyComboPreset, applyLeaderPreset, MACRO_PRESETS, applyMacroPreset, buildMacroExport, parseMacroImport, restoreMacroAt, isOneShotOrCapsWordCode, isMouseMoveCode, isOslCode, isTapToggleCode, isDynamicMacroCode, isKeyLockCode, isSwapHandsCode, isNumWordCode, isTtCode, isKeepAwakeCode, isDeepSleepCode, isClearStateCode, isBleHostCode,
             MAX_LAYOUT_PROFILES, sanitizeLayoutProfileName, findLayoutProfileIndex, layoutProfileNameKey, upsertLayoutProfile, removeLayoutProfile,
             deMacCharGroup, keycodeOptionTree, OPTIONAL_ACTION_PREFIX, filterOptionNodes, selectFilterHint,
             ACTION_CODE_TO_EVENT_CODES, findKeyForEventCode, resolveKeyForSide, browserKeySides,
             moveKeySelection, ARROW_KEY_DIRECTIONS,
             createNdjsonSplitter, appendFlashLogLine, readFlashStream, flashStageLabel, FLASH_LOG_MAX_LINES,
             LAYOUT_PRESETS, applyLayoutPreset, buildLayerOverview, buildLayerSheet, buildDualSideBundle, parseConfigImport,
             findCharPosition, buildPracticeSteps, createPracticeSession, practiceKeyPress, practiceSpeed, practiceTextFromHeatmap, practiceCharForCode, practiceDrillText, PRACTICE_FIXED_TEXT, buildSupportReport, APP_VERSION,
             ON_SCREEN_KEYBOARD_ROWS: typeof ON_SCREEN_KEYBOARD_ROWS !== "undefined" ? ON_SCREEN_KEYBOARD_ROWS : undefined,
             KEYCODE_OPTIONS: typeof KEYCODE_OPTIONS !== "undefined" ? KEYCODE_OPTIONS : undefined,
             pickActionFromOnScreenKey: typeof pickActionFromOnScreenKey !== "undefined" ? pickActionFromOnScreenKey : undefined };`, ctx);
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

test("Auto-Mouse-Ebene: Normalisierung, DEVICE_INFO-Rundreise, Ebenentausch und UI-Verdrahtung", () => {
  const norm = s => api.normalizeConfig({ layers: [[]], settings: s }, R).settings;
  assert.strictEqual(norm({}).autoMouseLayer, 255);
  assert.strictEqual(norm({}).mouseTimeoutMs, 500);
  assert.strictEqual(norm({ autoMouseLayer: 0 }).autoMouseLayer, 0);
  assert.strictEqual(norm({ autoMouseLayer: 7 }).autoMouseLayer, 7);
  assert.strictEqual(norm({ autoMouseLayer: 8 }).autoMouseLayer, 255);
  assert.strictEqual(norm({ autoMouseLayer: -3 }).autoMouseLayer, 0);
  assert.strictEqual(norm({ mouseTimeoutMs: 5 }).mouseTimeoutMs, 100);
  assert.strictEqual(norm({ mouseTimeoutMs: 9999 }).mouseTimeoutMs, 2000);
  const info = api.settingsFromDeviceInfo({ aml: 3, amt: 750 }, {});
  assert.strictEqual(info.autoMouseLayer, 3);
  assert.strictEqual(info.mouseTimeoutMs, 750);
  assert.strictEqual(api.settingsFromDeviceInfo({}, { autoMouseLayer: 2 }).autoMouseLayer, 2);
  // Ebenentausch führt die Auto-Mouse-Ebene mit, 255 (aus) bleibt
  const swapped = JSON.parse(JSON.stringify(api.swapLayersWithRefs({ layers: Array.from({ length: 8 }, () => [[]]), layerNames: [], combos: [], settings: { autoMouseLayer: 1 } }, 1, 2)));
  assert.strictEqual(swapped.settings.autoMouseLayer, 2);
  const kept = JSON.parse(JSON.stringify(api.swapLayersWithRefs({ layers: Array.from({ length: 8 }, () => [[]]), layerNames: [], combos: [], settings: { autoMouseLayer: 255 } }, 1, 2)));
  assert.strictEqual(kept.settings.autoMouseLayer, 255);
  const zero = JSON.parse(JSON.stringify(api.swapLayersWithRefs({ layers: Array.from({ length: 8 }, () => [[]]), layerNames: [], combos: [], settings: { autoMouseLayer: 0 } }, 0, 2)));
  assert.strictEqual(zero.settings.autoMouseLayer, 0, "Ebene 0 (ohne Wirkung) wandert beim Tausch nicht auf eine echte Ebene");
  // UI: Auswahl (Aus, Ebene 1..7), Zahlenfeld, Laden, Speichern und AUTO_MOUSE-Zeile der Firmware
  const html = read("index.html");
  const sel = html.slice(html.indexOf('id="autoMouseLayerSelect"'), html.indexOf("</select>", html.indexOf('id="autoMouseLayerSelect"')));
  assert.deepStrictEqual([...sel.matchAll(/<option value="(\d+)"/g)].map(m => m[1]), ["255", "1", "2", "3", "4", "5", "6", "7"]);
  assert.match(html, /id="mouseTimeoutInput"[^>]*min="100"[^>]*max="2000"/);
  assert.ok(read("app.js").includes('setVal("autoMouseLayerSelect"') && read("app.js").includes('setVal("mouseTimeoutInput"'));
  assert.ok(read("js/editor-events.js").includes("autoMouseLayer: autoMouseLayer") && read("js/editor-events.js").includes("mouseTimeoutMs: mouseTimeout"));
  const serial = read("js/serial.js");
  assert.ok(serial.includes('line.startsWith("AUTO_MOUSE:")') && serial.includes("am.aml") && serial.includes("am.amt"));
  assert.ok(read("js/config-sync.js").includes('prefix === "AUTO_MOUSE:"'), "Snapshot muss die AUTO_MOUSE-Zeile übernehmen");
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
  assert.strictEqual(n.settings.holdTapMode, 0);
  assert.strictEqual(n.settings.quickTapMs, 0);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { quickTapMs: 120 } }, R).settings.quickTapMs, 120);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { quickTapMs: 900 } }, R).settings.quickTapMs, 500);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { quickTapMs: -5 } }, R).settings.quickTapMs, 0);
  assert.strictEqual(n.settings.requirePriorIdleMs, 0);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { requirePriorIdleMs: 120 } }, R).settings.requirePriorIdleMs, 120);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { requirePriorIdleMs: 900 } }, R).settings.requirePriorIdleMs, 500);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { requirePriorIdleMs: -5 } }, R).settings.requirePriorIdleMs, 0);
  assert.strictEqual(n.settings.chordalHold, 0);
  assert.strictEqual(n.settings.retroTap, 0);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { retroTap: 1 } }, R).settings.retroTap, 1);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { retroTap: 5 } }, R).settings.retroTap, 1);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { retroTap: -1 } }, R).settings.retroTap, 0);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { chordalHold: 1 } }, R).settings.chordalHold, 1);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { chordalHold: 5 } }, R).settings.chordalHold, 1);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { chordalHold: -1 } }, R).settings.chordalHold, 0);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { chordalHold: "x" } }, R).settings.chordalHold, 0);
  // Auto Shift: Standard aus und 175 ms; Werte außerhalb des Bereichs werden begrenzt
  assert.strictEqual(n.settings.autoShift, 0);
  assert.strictEqual(n.settings.autoShiftMs, 175);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { autoShift: 1, autoShiftMs: 220 } }, R).settings.autoShift, 1);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { autoShift: 1, autoShiftMs: 220 } }, R).settings.autoShiftMs, 220);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { autoShift: 5 } }, R).settings.autoShift, 4);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { autoShift: 3 } }, R).settings.autoShift, 3);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { autoShift: "x", autoShiftMs: "x" } }, R).settings.autoShift, 0);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { autoShiftMs: 10 } }, R).settings.autoShiftMs, 50);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { autoShiftMs: 9999 } }, R).settings.autoShiftMs, 500);
  // DEVICE_INFO-Rundreise
  const asInfo = api.settingsFromDeviceInfo({ as: 1, at: 200 }, {});
  assert.strictEqual(asInfo.autoShift, 1);
  assert.strictEqual(asInfo.autoShiftMs, 200);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { holdTapMode: 1 } }, R).settings.holdTapMode, 1);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { holdTapMode: 2 } }, R).settings.holdTapMode, 2);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { holdTapMode: 99 } }, R).settings.holdTapMode, 2);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { holdTapMode: -1 } }, R).settings.holdTapMode, 0);
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

test("Heatmap pro Ebene: Drücke auf zwei Ebenen ergeben getrennte Zähler", () => {
  const s = api.createTypingStats(null, R);
  api.recordKeyPress(s, 2, 1, 0, 0);
  api.recordKeyPress(s, 2, 1, 10, 0);
  api.recordKeyPress(s, 2, 1, 20, 3);
  api.recordKeyPress(s, 1, 1, 30, 3);
  api.recordKeyPress(s, 1, 1, 40); // ohne Ebene: nur gesamt
  api.recordKeyPress(s, 1, 1, 50, 8); // ungültige Ebene: nur gesamt
  assert.deepStrictEqual({ ...api.heatmapCounts(s, 0) }, { "2_1": 2 });
  assert.deepStrictEqual({ ...api.heatmapCounts(s, 3) }, { "2_1": 1, "1_1": 1 });
  assert.deepStrictEqual({ ...api.heatmapCounts(s, 5) }, {});
  assert.deepStrictEqual({ ...api.heatmapCounts(s, null) }, { "2_1": 3, "1_1": 3 });
  assert.strictEqual(s.total, 6);
  assert.strictEqual(api.maxKeyCount(s, 0), 2);
  assert.strictEqual(api.maxKeyCount(s, 3), 1);
  assert.strictEqual(api.maxKeyCount(s), 3);
});

test("Heatmap pro Ebene: Speicherform übersteht Laden, alte Form bleibt lesbar", () => {
  const s = api.createTypingStats(null, R);
  api.recordKeyPress(s, 0, 1, 0, 2);
  api.recordKeyPress(s, 0, 1, 0, 2);
  api.recordKeyPress(s, 3, 3, 0, 0);
  const stored = JSON.parse(JSON.stringify(api.serializeTypingStats(s)));
  assert.deepStrictEqual(stored, { "0_1": 2, "3_3": 1, layers: { 0: { "3_3": 1 }, 2: { "0_1": 2 } } });
  // Eine ältere App-Version liest die Gesamtzähler weiter (ihre Prüfung der Schlüssel verwirft "layers")
  assert.deepStrictEqual(Object.keys(stored).filter(k => /^(\d+)_(\d+)$/.test(k)).sort(), ["0_1", "3_3"]);
  const back = api.createTypingStats(stored, R);
  assert.strictEqual(back.total, 3);
  assert.deepStrictEqual({ ...api.heatmapCounts(back, 2) }, { "0_1": 2 });
  assert.deepStrictEqual({ ...api.heatmapCounts(back, 0) }, { "3_3": 1 });
  // Alte Speicherform ohne Ebenen: Gesamtzähler bleiben, Ebenen sind leer
  const legacy = api.createTypingStats({ "0_1": 4 }, R);
  assert.strictEqual(legacy.total, 4);
  assert.deepStrictEqual({ ...api.heatmapCounts(legacy, 0) }, {});
  // Ungültige Ebenen und Zähler werden verworfen
  const bad = api.createTypingStats(JSON.parse('{"0_1": 1, "layers": {"9": {"0_1": 1}, "x": {"0_1": 1}, "1": {"4_0": 3, "0_1": 2}, "__proto__": {"0_1": 5}}}'), R);
  assert.deepStrictEqual({ ...api.heatmapCounts(bad, 1) }, { "0_1": 2 });
  assert.deepStrictEqual({ ...bad.counts }, { "0_1": 1 });
  assert.strictEqual(bad.layerCounts.length, 8);
  const broken = api.createTypingStats({ layers: [1] }, R);
  assert.strictEqual(broken.total, 0);
  assert.deepStrictEqual({ ...api.heatmapCounts(broken, 0) }, {});
});

test("Fingerlast: jede Spalte beider Hälften gehört zu einem Finger, der Daumen zur Daumenzeile", () => {
  assert.deepStrictEqual(Array.from(R.fingerCols), ["index", "index", "middle", "ring", "pinky", "pinky"]);
  assert.deepStrictEqual(Array.from(L.fingerCols), Array.from(R.fingerCols).reverse());
  assert.strictEqual(api.fingerOfKey(0, 0, R), "index");
  assert.strictEqual(api.fingerOfKey(3, 5, R), "pinky");
  assert.strictEqual(api.fingerOfKey(0, 0, L), "pinky");
  assert.strictEqual(api.fingerOfKey(3, 5, L), "index");
  assert.strictEqual(api.fingerOfKey(5, 3, R), "thumb");
  assert.strictEqual(api.fingerOfKey(2, 6, R), "thumb");
  assert.strictEqual(api.fingerOfKey(4, 0, R), null); // fehlende Taste
  assert.strictEqual(api.fingerOfKey(9, 0, R), null);
});

test("Fingerlast: Anteile je Finger und je Hälfte", () => {
  const r = api.createTypingStats(null, R);
  const l = api.createTypingStats(null, L);
  for (const [row, col] of [[2, 1], [2, 0], [1, 2], [1, 4], [5, 3], [5, 3]]) api.recordKeyPress(r, row, col, 0, 0);
  api.recordKeyPress(l, 2, 1, 0, 0);
  const share = Object.fromEntries(api.fingerLoad(r).map(f => [f.finger, f]));
  assert.deepStrictEqual(Array.from(api.fingerLoad(r).map(f => f.finger)), Array.from(api.FINGER_IDS));
  assert.strictEqual(share.index.count, 2);
  assert.strictEqual(share.middle.count, 1);
  assert.strictEqual(share.pinky.count, 1);
  assert.strictEqual(share.thumb.count, 2);
  assert.strictEqual(share.ring.count, 0);
  assert.ok(Math.abs(share.thumb.share - 2 / 6) < 1e-9);
  assert.ok(Math.abs(api.fingerLoad(r).reduce((a, f) => a + f.share, 0) - 1) < 1e-9);
  assert.strictEqual(api.fingerLoad(api.createTypingStats(null, R)).every(f => f.share === 0), true);
  const halves = api.halfLoad([{ side: "L", stats: l }, { side: "R", stats: r }]);
  assert.deepStrictEqual(Array.from(halves.map(h => h.side)), ["L", "R"]);
  assert.ok(Math.abs(halves[0].share - 1 / 7) < 1e-9 && Math.abs(halves[1].share - 6 / 7) < 1e-9);
  assert.strictEqual(api.halfLoad([{ side: "R", stats: api.createTypingStats(null, R) }])[0].share, 0);
});

test("Fingerlast: gleicher Finger nacheinander zählt nur verschiedene Tasten ohne Daumen", () => {
  const s = api.createTypingStats(null, R);
  api.recordKeyPress(s, 1, 1, 0); // erste Taste: keine Folge
  api.recordKeyPress(s, 2, 1, 1); // Zeigefinger, andere Taste: 1
  api.recordKeyPress(s, 1, 1, 2); // Rückrichtung zählt als dasselbe Paar: 2
  api.recordKeyPress(s, 1, 1, 3); // dieselbe Taste zweimal: keine Folge
  api.recordKeyPress(s, 1, 2, 4); // anderer Finger: keine Folge
  api.recordKeyPress(s, 5, 3, 5); // Daumen
  api.recordKeyPress(s, 5, 2, 6); // Daumen nacheinander: keine Folge
  api.recordKeyPress(s, 4, 0, 7); // fehlende Taste ändert die Folge nicht
  api.recordKeyPress(s, 1, 2, 8); // vorher 5_2, anderer Finger
  assert.strictEqual(s.sameFingerTotal, 2);
  assert.deepStrictEqual({ ...s.sameFingerPairs }, { "1_1|2_1": 2 });
  assert.strictEqual(api.sameFingerPairKey("2_1", "1_1", R), "1_1|2_1");
  assert.strictEqual(api.sameFingerPairKey("1_1", "1_1", R), null);
  assert.strictEqual(api.sameFingerPairKey("5_3", "5_2", R), null);
  // Die fünf häufigsten Paare, absteigend, bei Gleichstand nach Schlüssel
  const t = api.createTypingStats(null, R);
  const seq = [[0, 4], [1, 4], [0, 4], [1, 4], [0, 4], [2, 4], [0, 4], [3, 4], [0, 4], [0, 5], [1, 5], [0, 5], [2, 5], [0, 5], [3, 5]];
  for (const [row, col] of seq) api.recordKeyPress(t, row, col, 0);
  const top = api.topSameFingerPairs(t);
  assert.strictEqual(top.length, 5);
  assert.deepStrictEqual({ ...top[0] }, { a: "0_4", b: "1_4", count: 4 });
  assert.ok(top.every((p, i) => i === 0 || top[i - 1].count >= p.count));
  assert.strictEqual(api.topSameFingerPairs(t, 2).length, 2);
});

test("Fingerlast: Speicherform enthält die Folgen und übersteht Laden", () => {
  const s = api.createTypingStats(null, R);
  for (const [row, col] of [[1, 1], [2, 1], [1, 1], [0, 2]]) api.recordKeyPress(s, row, col, 0, 0);
  const stored = JSON.parse(JSON.stringify(api.serializeTypingStats(s)));
  assert.deepStrictEqual(stored.sameFinger, { pairs: { "1_1|2_1": 2 } }); // JSON-Kopie: gleicher Realm
  // Eine ältere App-Version liest die Gesamtzähler weiter
  assert.deepStrictEqual(Object.keys(stored).filter(k => /^(\d+)_(\d+)$/.test(k)).sort(), ["0_2", "1_1", "2_1"]);
  const back = api.createTypingStats(stored, R);
  assert.strictEqual(back.sameFingerTotal, 2);
  assert.deepStrictEqual({ ...back.sameFingerPairs }, { "1_1|2_1": 2 });
  assert.strictEqual(back.lastKeyId, null);
  // Ungültige Einträge fallen heraus: anderer Finger, Daumen, falsche Ordnung, fehlende Taste, schlechte Zähler
  const bad = api.createTypingStats(JSON.parse('{"1_1": 1, "sameFinger": {"pairs": {"1_1|2_1": 3, "2_1|1_1": 1, "1_1|1_2": 2, "5_3|5_2": 4, "4_0|3_0": 1, "1_1|2_1x": 1, "0_0|1_0": -1, "0_1|1_1": 1.5, "__proto__": 2}}}'), R);
  assert.deepStrictEqual({ ...bad.sameFingerPairs }, { "1_1|2_1": 3 });
  assert.strictEqual(bad.sameFingerTotal, 3);
  for (const junk of [{ sameFinger: 5 }, { sameFinger: [] }, { sameFinger: { pairs: [1] } }, { sameFinger: null }]) {
    assert.strictEqual(api.createTypingStats(junk, R).sameFingerTotal, 0);
  }
});

test("Fingerlast: ältere gespeicherte Statistik ohne Folgen lädt sauber", () => {
  // Form vor der Fingerlast und Form vor der Heatmap pro Ebene
  for (const legacy of [{ "0_1": 4, "5_3": 2 }, { "0_1": 4, "5_3": 2, layers: { 0: { "0_1": 4 } } }]) {
    const s = api.createTypingStats(JSON.parse(JSON.stringify(legacy)), R);
    assert.strictEqual(s.total, 6);
    assert.strictEqual(s.sameFingerTotal, 0);
    assert.deepStrictEqual({ ...s.sameFingerPairs }, {});
    assert.strictEqual(api.topSameFingerPairs(s).length, 0);
    assert.strictEqual(api.fingerLoad(s).find(f => f.finger === "thumb").count, 2);
    // Danach zählt die Statistik weiter und wird in der neuen Form gespeichert
    api.recordKeyPress(s, 0, 1, 0);
    api.recordKeyPress(s, 1, 1, 1);
    assert.strictEqual(s.sameFingerTotal, 1);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(api.serializeTypingStats(s).sameFinger)), { pairs: { "0_1|1_1": 1 } });
  }
});

test("Fingerlast: nach einer Pause beginnt eine neue Folge", () => {
  const s = api.createTypingStats(null, R);
  api.recordKeyPress(s, 1, 1, 0);
  api.recordKeyPress(s, 2, 1, 1000); // genau an der Grenze: zählt
  api.recordKeyPress(s, 1, 1, 2001); // 1001 ms nach der letzten Taste: zählt nicht
  api.recordKeyPress(s, 2, 1, 2500); // wieder innerhalb der Grenze: zählt
  assert.strictEqual(s.sameFingerTotal, 2);
  assert.strictEqual(api.SAME_FINGER_MAX_GAP_MS, 1000);
});

test("Fingerlast: Anzeige füllt Hälften, Finger, Summe und Paarliste", () => {
  const { w, dom } = uiHarness(`${section("js/heatmap.js", "function formatShare", "function onTypingStatsChanged")}
var typingStatsBySide = { R: createTypingStats(null, SIDE_PROFILES.R), L: createTypingStats(null, SIDE_PROFILES.L) };
function typingStatsFor(side) { return typingStatsBySide[side]; }`);
  vm.runInContext(`recordKeyPress(typingStatsBySide.R, 1, 1, 0); recordKeyPress(typingStatsBySide.R, 2, 1, 10);
    recordKeyPress(typingStatsBySide.R, 5, 3, 20); recordKeyPress(typingStatsBySide.L, 2, 1, 0); updateFingerLoadUI();`, w);
  const el = id => dom.document.getElementById(id);
  assert.strictEqual(el("fingerLoadHalves").textContent, "Linke Hand: 25 % · Rechte Hand: 75 %");
  assert.strictEqual(el("fingerLoadBars").children.length, 5);
  assert.ok(/Zeigefinger 67 %/.test(el("fingerLoadBars").children[3].textContent));
  assert.strictEqual(el("sameFingerTotal").textContent, "1");
  assert.strictEqual(el("sameFingerPairs").textContent, "R1C1 ↔ R2C1: 1");
});

test("Fingerlast: index.html enthält alle Elemente der Anzeige", () => {
  const html = read("index.html");
  for (const id of ["fingerLoad", "fingerLoadHalves", "fingerLoadBars", "sameFingerTotal", "sameFingerPairs"]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
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

test("Matrix-Test: MATRIX:-Zeile liefert die Scan-Zeit t, eine ungültige Zeit nur ohne t", () => {
  assert.deepStrictEqual({ ...api.parseMatrixLine('MATRIX:{"r":2,"c":1,"pressed":1,"t":1000}') }, { r: 2, c: 1, pressed: true, t: 1000 });
  assert.strictEqual(api.parseMatrixLine('MATRIX:{"r":5,"c":6,"pressed":1,"t":4294967295}').t, 4294967295);
  // Ältere Firmware ohne t, und ungültige Zeiten: Zeile gilt, aber ohne Zeit
  for (const bad of ['"t":-1', '"t":4294967296', '"t":"5"', '"t":1.5', '"t":null']) {
    const evt = api.parseMatrixLine(`MATRIX:{"r":2,"c":1,"pressed":0,${bad}}`);
    assert.deepStrictEqual({ ...evt }, { r: 2, c: 1, pressed: false });
  }
});

test("Matrix-Test: Druck kurz nach dem Loslassen zählt als Prellen, später nicht", () => {
  const t = api.createMatrixTest(R);
  assert.strictEqual(api.MATRIX_BOUNCE_MS, 30);
  // Erster Druck ohne vorheriges Loslassen: kein Prellen
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 1000), false);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, false, 1100), false);
  // 10 ms nach dem Loslassen: Prellen
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 1110), true);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, false, 1200), false);
  // 200 ms nach dem Loslassen: normales Tippen
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 1400), false);
  // Arrays aus dem VM-Kontext haben einen anderen Prototyp: in einfache Werte kopieren
  assert.deepStrictEqual([...api.summarizeMatrixTest(t).bouncingKeys].map(k => ({ ...k })), [{ r: 2, c: 1, count: 1 }]);
});

test("Matrix-Test: Prell-Grenze ist 30 ms, gilt je Taste und jedes Loslassen zählt einmal", () => {
  const t = api.createMatrixTest(R);
  api.recordMatrixBounce(t, 2, 1, false, 1000);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 1030), true);   // genau 30 ms
  api.recordMatrixBounce(t, 2, 1, false, 2000);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 2031), false);  // 31 ms
  // Eine andere Taste beeinflusst die Zeit nicht
  api.recordMatrixBounce(t, 2, 2, false, 3000);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 3005), false);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 2, true, 3005), true);
  // Ein Loslassen erlaubt nur einen Prell-Treffer: der zweite Druck ohne neues Loslassen ist keiner
  api.recordMatrixBounce(t, 3, 3, false, 4000);
  assert.strictEqual(api.recordMatrixBounce(t, 3, 3, true, 4005), true);
  assert.strictEqual(api.recordMatrixBounce(t, 3, 3, true, 4010), false);
  const keys = [...api.summarizeMatrixTest(t).bouncingKeys].map(k => `${k.r}${k.c}:${k.count}`);
  assert.deepStrictEqual(keys, ["21:1", "22:1", "33:1"]);
});

test("Matrix-Test: Prell-Grenze von unten: 0 ms und 29 ms zählen, 31 ms nicht", () => {
  const t = api.createMatrixTest(R);
  api.recordMatrixBounce(t, 2, 1, false, 1000);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 1000), true);   // 0 ms
  api.recordMatrixBounce(t, 2, 1, false, 2000);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 2029), true);   // 29 ms
  api.recordMatrixBounce(t, 2, 1, false, 3000);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 3031), false);  // 31 ms
  assert.strictEqual(api.summarizeMatrixTest(t).bouncingKeys[0].count, 2);
});

test("Matrix-Test: Neustart der Tastatur verwirft gemerkte Loslass-Zeiten, kein falsches Prellen", () => {
  const t = api.createMatrixTest(R);
  api.recordMatrixBounce(t, 2, 1, false, 600000);           // altes Loslassen nach 10 Minuten Laufzeit
  // Neustart: millis() beginnt bei 0. Ein Druck 20 ms nach dem Start läge vor der alten Zeit (Rücksprung)
  assert.strictEqual(api.recordMatrixBounce(t, 3, 3, false, 5), false);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 20), false);
  assert.strictEqual(api.summarizeMatrixTest(t).bouncingKeys.length, 0);
  // Nach dem Neustart arbeitet die Erkennung normal weiter
  api.recordMatrixBounce(t, 2, 1, false, 100);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 110), true);
  // Ein Überlauf nach 2^32 ms ist ein Schritt vorwärts und löscht nichts (siehe der nächste Test)
});

test("Matrix-Test: Prellen übersteht den Überlauf von millis() nach 2^32 ms", () => {
  const t = api.createMatrixTest(R);
  api.recordMatrixBounce(t, 2, 1, false, 4294967290);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 5), true);       // 11 ms über den Überlauf
  api.recordMatrixBounce(t, 2, 1, false, 4294967290);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, 100), false);    // 106 ms
});

test("Matrix-Test: Prellen ignoriert ungültige Tasten, fehlende Tasten und Ereignisse ohne Zeit", () => {
  const t = api.createMatrixTest(R);
  api.recordMatrixBounce(t, 4, 0, false, 1000);                              // R4C0 gibt es rechts nicht
  assert.strictEqual(api.recordMatrixBounce(t, 4, 0, true, 1001), false);
  assert.strictEqual(api.recordMatrixBounce(t, 6, 0, true, 1001), false);
  assert.strictEqual(api.recordMatrixBounce(t, 0, 7, true, 1001), false);
  api.recordMatrixBounce(t, 2, 1, false, 1000);
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, undefined), false); // ältere Firmware: keine Zeit
  assert.strictEqual(api.recordMatrixBounce(t, 2, 1, true, "1001"), false);
  assert.strictEqual(api.summarizeMatrixTest(t).bouncingKeys.length, 0);
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
  const matrixH = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "DactylMatrixConstants.h"), "utf8");
  const pins = name => {
    const m = ino.match(new RegExp(name + "\\s*\\[[^\\]]*\\]\\s*=\\s*([A-Za-z0-9_{} ,]+);"));
    assert.ok(m, `${name} in dactyl_right.ino fehlt`);
    const val = m[1].trim();
    const raw = val.startsWith("{") ? val : matrixH.match(new RegExp(`#define\\s+${val}\\s*\\{([^}]*)\\}`))[1];
    return raw.replace(/[{}]/g, "").split(",").map(v => Number(v.trim()));
  };
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

test("Tastenpaar: Standardtasten, Modifier, Globe, Media und Maus sind erlaubt", () => {
  for (const ok of ["KEY_LEFT_SHIFT", "KEY_PERIOD", "KEY_A", "KEY_F13", "KEY_RETURN", "KEY_RIGHT_GUI",
                    "MAC_GLOBE", "MEDIA_MUTE", "MEDIA_PLAY_PAUSE", "MOUSE_LEFT", "MOUSE_RIGHT", "MOUSE_MIDDLE",
                    "MOUSE_WHEEL_UP", "MOUSE_WHEEL_DOWN"]) {
    assert.ok(api.isKeyPairMember(ok), ok);
  }
  for (const bad of ["NONE", "", undefined, 5, "MO_1", "TG_2", "PAIR_0", "LAYER_UP", "UMLAUT_AE", "OSM_LSHIFT", "CAPS_WORD", "REPEAT", "ALT_REPEAT", "MOUSE_UP", "MACRO_0"]) {
    assert.ok(!api.isKeyPairMember(bad), String(bad));
  }
  assert.strictEqual(api.keyPairLabel({ first: "A", second: "B" }, c => c.toLowerCase()), "a + b");

  // isStandardKeyOrModifier beschränkt Makroschritte und Überschreibungen auf 1..255
  for (const ok of ["KEY_LEFT_SHIFT", "KEY_PERIOD", "KEY_A", "KEY_F13", "KEY_RETURN", "KEY_RIGHT_GUI"]) {
    assert.ok(api.isStandardKeyOrModifier(ok), ok);
  }
  for (const notStd of ["MAC_GLOBE", "MEDIA_MUTE", "MOUSE_LEFT", "MO_1", "PAIR_0", "NONE"]) {
    assert.ok(!api.isStandardKeyOrModifier(notStd), notStd);
  }
});

test("Tastenpaar: Config-Validierung und Normalisierung", () => {
  const good = { layers: [[]], keyPairs: [
    { first: "KEY_LEFT_SHIFT", second: "KEY_PERIOD" },
    { first: "MAC_GLOBE", second: "KEY_LEFT_SHIFT" },
    { first: "MEDIA_MUTE", second: "KEY_A" },
    { first: "MOUSE_LEFT", second: "KEY_LEFT_SHIFT" }
  ] };
  api.validateConfigShape(good);
  assert.throws(() => api.validateConfigShape({ layers: [[]], keyPairs: "x" }));
  assert.throws(() => api.validateConfigShape({ layers: [[]], keyPairs: [{ first: "MO_1", second: "KEY_A" }] }));
  assert.throws(() => api.validateConfigShape({ layers: [[]], keyPairs: [{ first: "PAIR_0", second: "KEY_A" }] }));
  assert.throws(() => api.validateConfigShape({ layers: [[]], keyPairs: new Array(17).fill({ first: "KEY_A", second: "KEY_B" }) }));
  const n = api.normalizeConfig({ layers: [[]], keyPairs: [{ first: "KEY_A", second: "KEY_B", extra: 1 }, { first: "MAC_GLOBE", second: "KEY_LEFT_SHIFT" }, { first: "MO_1", second: "KEY_A" }, null] }, R);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(n.keyPairs)), [
    { first: "KEY_A", second: "KEY_B" },
    { first: "MAC_GLOBE", second: "KEY_LEFT_SHIFT" }
  ]);
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

test("Ebenen tauschen mit Verweisen: Tasten, Combos, Masken, Einstellungen; zweimal tauschen stellt her", () => {
  const layers = sampleLayers();
  layers[0][0][0] = { label: "a", tap: "MO_1", hold: "ACT_TG_2", dtap: "OSL_1" };
  layers[0][0][1] = "MO_2";
  layers[3][0][0] = { label: "b", tap: "OSL_2", hold: "MO_3", dtap: "NONE" };
  const cfg = {
    layers,
    layerNames: ["B", "One", "Two", "C", "D", "E", "F", "G"],
    combos: [{ key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 }, behavior: "LAYER_TOGGLE", action: "TG_1", layerMask: 0b00000110 },
             { key1: { r: 0, c: 0 }, key2: { r: 0, c: 2 }, behavior: "KEY_PRESS", action: "KEY_A", layerMask: 0b00000010 },
             { key1: { r: 1, c: 0 }, key2: { r: 1, c: 1 }, behavior: "KEY_PRESS", action: "KEY_B" }],
    keyOverrides: [{ mods: ["LCTRL"], key: "KEY_A", replacement: "KEY_B", layerMask: 0b00000100 }],
    settings: { bootLayer: 1, numWordLayer: 2, triLayers: [{ a: 1, b: 3, target: 2 }] }
  };
  const before = JSON.parse(JSON.stringify(cfg));
  const plain = v => (v === null ? v : JSON.parse(JSON.stringify(v)));
  const out = plain(api.swapLayersWithRefs(cfg, 1, 2));
  assert.deepStrictEqual(cfg, before);
  assert.strictEqual(out.layers[1][0][0].tap, "KEY_2");
  assert.strictEqual(out.layers[2][0][0].tap, "KEY_1");
  assert.deepStrictEqual(out.layerNames.slice(0, 3), ["B", "Two", "One"]);
  assert.deepStrictEqual(out.layers[0][0][0], { label: "a", tap: "MO_2", hold: "ACT_TG_1", dtap: "OSL_2" });
  assert.strictEqual(out.layers[0][0][1], "MO_1");
  assert.deepStrictEqual(out.layers[3][0][0], { label: "b", tap: "OSL_1", hold: "MO_3", dtap: "NONE" });
  assert.strictEqual(out.combos[0].action, "TG_2");
  assert.strictEqual(out.combos[0].layerMask, 0b00000110);
  assert.strictEqual(out.combos[1].layerMask, 0b00000100);
  assert.strictEqual(out.combos[2].layerMask, undefined);
  assert.strictEqual(out.keyOverrides[0].layerMask, 0b00000010);
  assert.strictEqual(out.settings.bootLayer, 2);
  assert.strictEqual(out.settings.numWordLayer, 1);
  assert.deepStrictEqual(out.settings.triLayers, [{ a: 2, b: 3, target: 1 }]);
  assert.deepStrictEqual(plain(api.swapLayersWithRefs(out, 1, 2)), before);
  assert.strictEqual(api.swapLayersWithRefs(cfg, 1, 1), null);
  assert.strictEqual(api.swapLayersWithRefs(cfg, 1, 8), null);
  assert.strictEqual(api.swapLayersWithRefs(null, 1, 2), null);
});

test("Ebenen tauschen mit Verweisen: Ebene 0, ACT_-Combos, volle Maske, kurze Namen", () => {
  const plain = v => JSON.parse(JSON.stringify(v));
  const cfg = {
    layers: sampleLayers(),
    layerNames: ["Base", "Eins"],
    combos: [{ key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 }, behavior: "LAYER_TOGGLE", action: "ACT_TG_3", layerMask: 0xFF },
             { key1: { r: 1, c: 0 }, key2: { r: 1, c: 1 }, behavior: "KEY_PRESS", action: "ACT_OSL_0", layerMask: 0b00000001 }],
    keyOverrides: [{ mods: ["LCTRL"], key: "KEY_A", replacement: "KEY_B" }],
    settings: { bootLayer: 0, numWordLayer: 3, triLayers: [{ a: 1, b: 2, target: 3 }, { a: 2, b: 3, target: 4 }] }
  };
  const out = plain(api.swapLayersWithRefs(cfg, 0, 3));
  assert.strictEqual(out.combos[0].action, "ACT_TG_0");
  assert.strictEqual(out.combos[0].layerMask, 0xFF);
  assert.strictEqual(out.combos[1].action, "ACT_OSL_3");
  assert.strictEqual(out.combos[1].layerMask, 0b00001000);
  assert.strictEqual(out.keyOverrides[0].layerMask, undefined);
  assert.strictEqual(out.settings.bootLayer, 3);
  assert.strictEqual(out.settings.numWordLayer, 0);
  // Beide Regeln fielen auf Ebene 0 (Ziel bzw. b) und entfallen
  assert.deepStrictEqual(out.settings.triLayers, []);
  assert.strictEqual(out.layerNames.length, 8);
  assert.strictEqual(out.layerNames[1], "Eins");
  assert.strictEqual(out.layerNames[3], "Base");
  assert.ok(out.layerNames.every(n => typeof n === "string"));
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

test("Tasten tauschen: tauscht zwei Zellen, Eingabe bleibt unverändert, Undo-Snapshot stellt wieder her", () => {
  const layer = api.transparentLayer();
  layer[1][2] = { label: "A", tap: "KEY_A", hold: "NONE", dtap: "NONE" };
  layer[3][4] = { label: "B", tap: "KEY_B", hold: "KEY_LEFT_SHIFT", dtap: "NONE" };
  const swapped = api.swapLayerKeys(layer, 1, 2, 3, 4);
  assert.strictEqual(swapped[1][2].tap, "KEY_B");
  assert.strictEqual(swapped[1][2].hold, "KEY_LEFT_SHIFT");
  assert.strictEqual(swapped[3][4].tap, "KEY_A");
  assert.strictEqual(layer[1][2].tap, "KEY_A");
  // Undo: der gespeicherte alte Stand ist unabhängig vom neuen und tauscht man erneut, kommt das Original zurück
  const oldLayer = layer;
  assert.strictEqual(JSON.stringify(api.swapLayerKeys(swapped, 1, 2, 3, 4)), JSON.stringify(oldLayer));
  swapped[1][2].tap = "KEY_X";
  assert.strictEqual(oldLayer[1][2].tap, "KEY_A");
  assert.strictEqual(api.swapLayerKeys(layer, 1, 2, 1, 2), null);
  assert.strictEqual(api.swapLayerKeys(layer, 6, 0, 0, 0), null);
  assert.strictEqual(api.swapLayerKeys(layer, 0, 0, 0, 7), null);
  assert.strictEqual(api.swapLayerKeys(null, 0, 0, 0, 1), null);
});

test("Ebene spiegeln: Modifier und Pfeile wechseln die Seite, Positionen werden gespiegelt", () => {
  const R = api.SIDE_PROFILES.R, L = api.SIDE_PROFILES.L;
  const layer = api.transparentLayer();
  layer[2][0] = { label: "Shift", tap: "KEY_LEFT_SHIFT", hold: "NONE", dtap: "NONE" };
  layer[2][5] = { label: "←", tap: "KEY_LEFT_ARROW", hold: "KEY_RIGHT_ALT", dtap: "NONE" };
  layer[1][1] = { label: "Q", tap: "KEY_Q", hold: "NONE", dtap: "NONE" };
  const out = api.mirrorLayerAcrossSides(layer, R, L);
  assert.strictEqual(out[2][5].tap, "KEY_RIGHT_SHIFT");
  assert.strictEqual(out[2][0].tap, "KEY_RIGHT_ARROW");
  assert.strictEqual(out[2][0].hold, "KEY_LEFT_ALT");
  assert.strictEqual(out[1][4].tap, "KEY_Q");
  assert.strictEqual(layer[2][0].tap, "KEY_LEFT_SHIFT");
  // Daumen: rechts Space (R5C3, 2U Mitte) ↔ links Del (R5C2, 2U Mitte); Enter (R5C2) ↔ Ctrl (R5C3)
  layer[5][3] = { label: "Sp", tap: "KEY_SPACE", hold: "NONE", dtap: "NONE" };
  layer[5][2] = { label: "En", tap: "KEY_RETURN", hold: "NONE", dtap: "NONE" };
  const thumbs = api.mirrorLayerAcrossSides(layer, R, L);
  assert.strictEqual(thumbs[5][2].tap, "KEY_SPACE");
  assert.strictEqual(thumbs[5][3].tap, "KEY_RETURN");
  // Rück-Spiegelung ergibt wieder die Ausgangstasten
  const back = api.mirrorLayerAcrossSides(thumbs, L, R);
  assert.strictEqual(back[2][0].tap, "KEY_LEFT_SHIFT");
  assert.strictEqual(back[5][3].tap, "KEY_SPACE");
  assert.strictEqual(api.mirrorLayerAcrossSides(layer, R, R), null);
  assert.strictEqual(api.mirrorLayerAcrossSides(null, R, L), null);
});

test("Tasten tauschen: nur die beiden getauschten Zellen verschieben die Auswahl", () => {
  const sel = { r: 3, c: 4, side: "R", isThumb: false };
  assert.strictEqual(api.swappedSelectionPosition(sel, 1, 2, 3, 4).r, 1);
  assert.strictEqual(api.swappedSelectionPosition(sel, 1, 2, 3, 4).c, 2);
  const src = { r: 1, c: 2, side: "R", isThumb: false };
  assert.strictEqual(api.swappedSelectionPosition(src, 1, 2, 3, 4).r, 3);
  const other = { r: 0, c: 0, side: "R", isThumb: false };
  assert.strictEqual(api.swappedSelectionPosition(other, 1, 2, 3, 4), other);
  assert.strictEqual(api.swappedSelectionPosition(null, 1, 2, 3, 4), null);
});

test("Tasten tauschen: erneutes Tauschen auf der aktuellen Ebene erhält spätere Änderungen", () => {
  const layer = api.transparentLayer();
  layer[0][0] = { label: "A", tap: "KEY_A", hold: "NONE", dtap: "NONE" };
  layer[0][1] = { label: "B", tap: "KEY_B", hold: "NONE", dtap: "NONE" };
  const swapped = api.swapLayerKeys(layer, 0, 0, 0, 1);
  swapped[2][2] = { label: "Z", tap: "KEY_Z", hold: "NONE", dtap: "NONE" };
  const reverted = api.swapLayerKeys(swapped, 0, 0, 0, 1);
  assert.strictEqual(reverted[0][0].tap, "KEY_A");
  assert.strictEqual(reverted[0][1].tap, "KEY_B");
  assert.strictEqual(reverted[2][2].tap, "KEY_Z");
});

test("Ebene spiegeln: eigenes Label und Tapping-Term bleiben, solange der Tap gleich bleibt", () => {
  const R = api.SIDE_PROFILES.R, L = api.SIDE_PROFILES.L;
  const layer = api.transparentLayer();
  layer[1][1] = { label: "Mein Q", tap: "KEY_Q", hold: "KEY_LEFT_ALT", dtap: "NONE", tapTerm: 200 };
  const out = api.mirrorLayerAcrossSides(layer, R, L);
  assert.strictEqual(out[1][4].label, "Mein Q");
  assert.strictEqual(out[1][4].hold, "KEY_RIGHT_ALT");
  assert.strictEqual(out[1][4].tapTerm, 200);
});

test("Ebene spiegeln: Master-Aktionen entfallen auf der Hälfte ohne Master", () => {
  const R = api.SIDE_PROFILES.R, L = api.SIDE_PROFILES.L;
  const layer = api.transparentLayer();
  layer[1][1] = { label: "H", tap: "HOST_1", hold: "DM_REC", dtap: "DM_PLAY" };
  layer[1][2] = { label: "Q", tap: "KEY_Q", hold: "NONE", dtap: "NONE" };
  const toLeft = api.mirrorLayerAcrossSides(layer, R, L);
  assert.strictEqual(toLeft[1][4].tap, "NONE");
  assert.strictEqual(toLeft[1][4].hold, "NONE");
  assert.strictEqual(toLeft[1][4].dtap, "NONE");
  assert.strictEqual(toLeft[1][3].tap, "KEY_Q");
  // Zum Master bleiben sie erhalten
  const left = api.transparentLayer();
  left[1][4] = { label: "H", tap: "HOST_2", hold: "NONE", dtap: "NONE" };
  assert.strictEqual(api.mirrorLayerAcrossSides(left, L, R)[1][1].tap, "HOST_2");
});

test("markPendingSync: nur ein Revert mit sideRevert bleibt für die nicht bearbeitete Hälfte erhalten", () => {
  const src = read("app.js");
  const start = src.indexOf("function markPendingSync(");
  const end = src.indexOf("  let changeObj;", start);
  assert.ok(start >= 0 && end > start);
  const sandbox = { editSide: "R", store: [], synced: [], Date, Math };
  vm.createContext(sandbox);
  vm.runInContext(`${src.slice(start, end)}}
    function pendingFor() { return store; }
    function requestLiveSync(side) { synced.push(side); }`, sandbox);
  const closure = () => {};
  vm.runInContext("markPendingSync", sandbox)({ type: "layer_mirror", snapshot: true, sideRevert: true, revert: closure }, "L");
  vm.runInContext("markPendingSync", sandbox)({ type: "key", revert: closure }, "L");
  assert.strictEqual(sandbox.store.length, 2);
  assert.strictEqual(sandbox.store[0].revert, closure);
  assert.strictEqual(sandbox.store[1].revert, null);
  assert.deepStrictEqual(Array.from(sandbox.synced), ["L", "L"]);
});

test("Ebene spiegeln: PAIR_n und MACRO_n entfallen, weil die Listen je Hälfte gelten", () => {
  const R = api.SIDE_PROFILES.R, L = api.SIDE_PROFILES.L;
  const layer = api.transparentLayer();
  layer[1][1] = { label: "P", tap: "PAIR_0", hold: "MACRO_1", dtap: "NONE" };
  const out = api.mirrorLayerAcrossSides(layer, R, L);
  assert.strictEqual(out[1][4].tap, "NONE");
  assert.strictEqual(out[1][4].hold, "NONE");
});

test("Tasten ziehen: nur eine gültige Nutzlast löst einen Tausch aus", () => {
  assert.strictEqual(api.parseKeyDragPayload("R:2:3").side, "R");
  assert.strictEqual(api.parseKeyDragPayload("R:2:3").c, 3);
  assert.strictEqual(api.parseKeyDragPayload("R::"), null);
  assert.strictEqual(api.parseKeyDragPayload("hallo"), null);
  assert.strictEqual(api.parseKeyDragPayload(""), null);
  assert.strictEqual(api.parseKeyDragPayload(null), null);
});

test("Editor: Revert von Tausch und Spiegeln stellt den alten Stand wieder her", () => {
  const src = read("js/editor.js");
  const body = src.slice(src.indexOf("function mirrorActiveLayerToOtherSide"), src.indexOf("function updateLayerNameInput"));
  assert.ok(body.includes("swapKeysByDrag"));
  const R = api.SIDE_PROFILES.R, L = api.SIDE_PROFILES.L;
  const mk = tap => {
    const layers = Array.from({ length: 8 }, () => api.transparentLayer());
    layers[0][1][1] = { label: "Q", tap, hold: "NONE", dtap: "NONE" };
    return layers;
  };
  const configs = { R: { layers: mk("KEY_LEFT_SHIFT"), layerNames: [] }, L: { layers: mk("KEY_A"), layerNames: [] } };
  const changes = [];
  const box = {
    Dactyl: { SIDE_IDS: ["L", "R"] }, SIDE_PROFILES: { R, L }, editSide: "R", activeLayerIndex: 0, selectedKey: null,
    DEFAULT_LAYER_NAMES: [], currentConfig: configs.R,
    configFor: s => configs[s], setConfigFor: (s, c) => { configs[s] = c; if (s === "R") box.currentConfig = c; },
    mirrorLayerAcrossSides: api.mirrorLayerAcrossSides, swapLayerKeys: api.swapLayerKeys, transparentLayer: api.transparentLayer,
    swappedSelectionPosition: api.swappedSelectionPosition,
    confirm: () => true, showToast() {}, saveConfigToServer() {}, renderMatrix() {}, updateInspector() {},
    markPendingSync: change => changes.push(change), JSON
  };
  vm.createContext(box);
  vm.runInContext(body, box);
  // Spiegeln R -> L ersetzt die Ebene links; der Revert bringt die alte linke Ebene zurück
  const oldLeft = configs.L.layers;
  vm.runInContext("mirrorActiveLayerToOtherSide()", box);
  assert.strictEqual(configs.L.layers[0][1][4].tap, "KEY_RIGHT_SHIFT");
  assert.strictEqual(changes[0].type, "layer_mirror");
  changes[0].revert();
  assert.strictEqual(configs.L.layers, oldLeft);
  // Tauschen: Revert tauscht erneut und erhält spätere Änderungen
  configs.R.layers[0][2][2] = { label: "A", tap: "KEY_A", hold: "NONE", dtap: "NONE" };
  vm.runInContext("swapKeysByDrag(1, 1, 2, 2)", box);
  assert.strictEqual(box.currentConfig.layers[0][2][2].tap, "KEY_LEFT_SHIFT");
  box.currentConfig.layers[0][3][3] = { label: "Z", tap: "KEY_Z", hold: "NONE", dtap: "NONE" };
  changes[1].revert();
  assert.strictEqual(box.currentConfig.layers[0][1][1].tap, "KEY_LEFT_SHIFT");
  assert.strictEqual(box.currentConfig.layers[0][2][2].tap, "KEY_A");
  assert.strictEqual(box.currentConfig.layers[0][3][3].tap, "KEY_Z");
  // Ebene 0 tauschen, während Ebene 3 aktiv ist: Rückgabe true, Auswahl bleibt, onRevert läuft nach dem Revert
  box.activeLayerIndex = 3;
  box.selectedKey = { side: "R", r: 1, c: 1 };
  let reverted = 0;
  box.onRevert = () => { reverted++; };
  box.currentConfig.layers[0][1][1] = { label: "Q", tap: "KEY_Q", hold: "NONE", dtap: "NONE" };
  assert.strictEqual(vm.runInContext("swapKeysByDrag(1, 1, 2, 2, 0, onRevert)", box), true);
  assert.strictEqual(box.currentConfig.layers[0][2][2].tap, "KEY_Q");
  assert.deepStrictEqual({ ...box.selectedKey }, { side: "R", r: 1, c: 1 });
  changes[changes.length - 1].revert();
  assert.strictEqual(reverted, 1);
  assert.strictEqual(box.currentConfig.layers[0][1][1].tap, "KEY_Q");
  // Fehlende Ebene und gleiche Zelle ändern nichts und melden false
  const before = changes.length;
  assert.strictEqual(vm.runInContext("swapKeysByDrag(1, 1, 2, 2, 9)", box), false);
  assert.strictEqual(vm.runInContext("swapKeysByDrag(1, 1, 1, 1, 0)", box), false);
  assert.strictEqual(changes.length, before);
});

test("Ebene spiegeln: fehlende Tasten werden übersprungen", () => {
  const R = api.SIDE_PROFILES.R, L = api.SIDE_PROFILES.L;
  const layer = api.transparentLayer();
  // Rechts fehlt R4C0; gespiegelt wäre das links R4C5 (fehlt dort ebenfalls)
  layer[4][0] = { label: "X", tap: "KEY_X", hold: "NONE", dtap: "NONE" };
  // Links fehlt R5C0: Rückrichtung darf dort nichts eintragen
  const toLeft = api.mirrorLayerAcrossSides(layer, R, L);
  assert.ok(toLeft.every((row, r) => row.every((k, c) => !L.absentKeys.includes(`${r}_${c}`) || k.tap === "NONE")));
  const full = api.transparentLayer();
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) full[r][c] = { label: "K", tap: "KEY_K", hold: "NONE", dtap: "NONE" };
  const mirroredLeft = api.mirrorLayerAcrossSides(full, R, L);
  for (const key of L.absentKeys) {
    const [r, c] = key.split("_").map(Number);
    assert.strictEqual(mirroredLeft[r][c].tap, "NONE", `fehlende Taste ${key} bleibt leer`);
  }
  const mirroredRight = api.mirrorLayerAcrossSides(full, L, R);
  for (const key of R.absentKeys) {
    const [r, c] = key.split("_").map(Number);
    assert.strictEqual(mirroredRight[r][c].tap, "NONE", `fehlende Taste ${key} bleibt leer`);
  }
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

test("Veraltete Belegung: eine geänderte Taste zeigt das Banner mit einem Unterschied", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const snap = snapshotOf(cfg);
  cfg.layers[2][1][3] = { label: "J", tap: "KEY_J" };
  const state = api.staleLayoutState(cfg, snap, R, 0);
  assert.strictEqual(state.show, true);
  assert.strictEqual(state.count, 1);
});

test("Veraltete Belegung: Ebenen-Name und Taste zählen zusammen", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const snap = snapshotOf(cfg);
  cfg.layerNames[4] = "Neu";
  cfg.layers[2][1][3] = { label: "J", tap: "KEY_J" };
  const state = api.staleLayoutState(cfg, snap, R, 0);
  assert.strictEqual(state.count, 2);
});

// Banner-Ablauf aus js/config-sync.js mit Fake-Banner und Fake-Lesen
function staleBannerHarness() {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const banner = { hidden: true, dataset: {} };
  const text = { textContent: "" };
  const els = { staleLayoutBanner: banner, staleLayoutText: text };
  const h = {
    SIDE_PROFILES: api.SIDE_PROFILES, staleLayoutState: api.staleLayoutState, configFor: () => cfg,
    isAutoSyncing: false, isConnectingBle: false, diffFlowActive: false, deviceSnapshotRead: null,
    DEVICE_SNAPSHOT_TIMEOUT_MS: 50, side: "R", pending: { R: [], L: [] }, reads: [], snap: snapshotOf(cfg),
    document: { getElementById: id => els[id] || null }, Date,
    setTimeout
  };
  h.connectedSide = () => h.side;
  h.pendingFor = side => h.pending[side];
  h.readDeviceSnapshot = (side, withInfo, silent) => new Promise(resolve => {
    h.deviceSnapshotRead = { silent, stale: false };
    h.reads.push({ side, silent, finish: snap => { h.deviceSnapshotRead = null; resolve(snap); } });
  });
  vm.createContext(h);
  vm.runInContext(`${section("js/config-sync.js", "// Nach dem Verbinden: liest die Belegung", "function setupStaleLayoutBanner")}
    this.check = checkStaleLayout; this.hide = hideStaleLayoutBanner; this.wait = waitForStaleLayoutRead;
    this.ignored = staleLayoutIgnored;`, h);
  return { h, cfg, banner, flush: () => new Promise(r => setImmediate(r)) };
}

asyncTests.push(["Banner: Abweichung zeigt das Banner nur nach dem stillen Lesen", async () => {
  const { h, cfg, banner, flush } = staleBannerHarness();
  cfg.layers[2][1][3] = { label: "J", tap: "KEY_J" };
  const p = h.check("R");
  assert.strictEqual(h.reads[0].silent, true);
  assert.strictEqual(banner.hidden, true);
  h.reads[0].finish(h.snap);
  await p;
  assert.strictEqual(banner.hidden, false);
  assert.strictEqual(banner.dataset.side, "R");
  await flush();
}]);

asyncTests.push(["Banner: Trennen oder Vorgemerktes während des Lesens verwirft das Ergebnis", async () => {
  const { h, cfg, banner } = staleBannerHarness();
  cfg.layers[2][1][3] = { label: "J", tap: "KEY_J" };
  const p = h.check("R");
  h.hide("R", true);
  h.reads[0].finish(h.snap);
  await p;
  assert.strictEqual(banner.hidden, true);
}]);

asyncTests.push(["Banner: Ignorieren gilt je Hälfte und endet mit dem Trennen", async () => {
  const { h, cfg } = staleBannerHarness();
  cfg.layers[2][1][3] = { label: "J", tap: "KEY_J" };
  h.ignored.add("R");
  await h.check("R");
  assert.strictEqual(h.reads.length, 0);
  h.hide("L", true);
  assert.ok(h.ignored.has("R"));
  h.hide("R", true);
  assert.ok(!h.ignored.has("R"));
}]);

asyncTests.push(["Banner: Speichern wartet auf die stille Abfrage", async () => {
  const { h, flush } = staleBannerHarness();
  const p = h.check("R");
  let waited = false;
  h.wait().then(() => { waited = true; });
  await flush();
  assert.strictEqual(waited, false);
  h.reads[0].finish(null);
  await p;
  await new Promise(r => setTimeout(r, 120));
  assert.strictEqual(waited, true);
}]);

test("Veraltete Belegung: gleiche Belegung und vorgemerkte Änderungen zeigen kein Banner", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const snap = snapshotOf(cfg);
  assert.strictEqual(api.staleLayoutState(cfg, snap, R, 0).show, false);
  cfg.layers[2][1][3] = { label: "J", tap: "KEY_J" };
  assert.strictEqual(api.staleLayoutState(cfg, snap, R, 1).show, false);
  assert.strictEqual(api.staleLayoutState(cfg, null, R, 0).show, false);
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

// Zeilen wie die Firmware ab Stand 5 sie sendet (kurze Blöcke mit Offset)
function listLines(cfg) {
  const lines = [];
  const combos = (cfg.combos || []).map(cb => [cb.key1.r, cb.key1.c, cb.key2.r, cb.key2.c,
    { KEY_PRESS: 0, MODIFIER_HOLD: 1, LAYER_TOGGLE: 2 }[cb.behavior], api.actionCodeToNumeric(cb.action)]);
  lines.push("COMBO_COUNT:" + combos.length);
  for (let o = 0; o < combos.length; o += 4) lines.push("COMBO_DATA:" + JSON.stringify({ o, e: combos.slice(o, o + 4) }));
  const pairs = (cfg.keyPairs || []).map(p => [api.actionCodeToNumeric(p.first), api.actionCodeToNumeric(p.second)]);
  lines.push("PAIR_COUNT:" + pairs.length);
  for (let o = 0; o < pairs.length; o += 8) lines.push("PAIR_DATA:" + JSON.stringify({ o, e: pairs.slice(o, o + 8) }));
  if (cfg.keyOverrides) {
    const overrides = cfg.keyOverrides.map(o => [api.keyOverrideModsValue(o.mods), api.actionCodeToNumeric(o.key), api.actionCodeToNumeric(o.replacement)]);
    lines.push("OVERRIDE_COUNT:" + overrides.length);
    for (let o = 0; o < overrides.length; o += 6) lines.push("OVERRIDE_DATA:" + JSON.stringify({ o, e: overrides.slice(o, o + 6) }));
  }
  if (cfg.leaderSequences) {
    const leader = cfg.leaderSequences.map(q => [api.actionCodeToNumeric(q.action), ...api.leaderKeyNumbers(q.keys)]);
    lines.push("LEADER_COUNT:" + leader.length);
    for (let o = 0; o < leader.length; o += 4) lines.push("LEADER_DATA:" + JSON.stringify({ o, e: leader.slice(o, o + 4) }));
  }
  if (cfg.altRepeats) {
    const alt = cfg.altRepeats.map(e => [api.actionCodeToNumeric(e.key), api.actionCodeToNumeric(e.alt)]);
    lines.push("ALTREP_COUNT:" + alt.length);
    for (let o = 0; o < alt.length; o += 8) lines.push("ALTREP_DATA:" + JSON.stringify({ o, e: alt.slice(o, o + 8) }));
  }
  const macros = cfg.macros || [];
  lines.push("MACRO_COUNT:" + macros.length);
  macros.forEach((m, i) => {
    const steps = m.steps.map(st => api.macroStepTuple(st));
    for (let o = 0; o === 0 || o < steps.length; o += 8) lines.push("MACRO_DATA:" + JSON.stringify({ i, n: steps.length, o, s: steps.slice(o, o + 8) }));
  });
  return lines;
}

function snapshotWithLists(cfg) {
  const snap = snapshotOf(cfg);
  for (const line of listLines(cfg)) assert.ok(api.captureListLine(snap, line), line);
  return snap;
}

test("Layout-Diff: ein Unterschied nur im Wiederholen-Flag eines Makros wird gemeldet", () => {
  const cfg = api.normalizeConfig({ layers: [[[]]], macros: [{ name: "D", steps: [{ type: "tap", code: "KEY_A" }], repeat: true }] }, R);
  const snap = snapshotWithLists({ ...cfg, macros: [{ name: "D", steps: cfg.macros[0].steps }] });
  const dl = api.diffKeymap(cfg, snap, R).lists;
  assert.strictEqual(dl.macros.length, 1);
  assert.ok(dl.macros[0].local.startsWith("↻"));
  assert.ok(!dl.macros[0].device.startsWith("↻"));
  const same = api.diffKeymap(cfg, (() => { const s = snapshotWithLists(cfg); s.macroRep[0] = true; return s; })(), R).lists;
  assert.strictEqual(same.macros.length, 0);
});

test("Layout-Diff: gleiche Combos, Tastenpaare und Makros ergeben keinen Unterschied", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.keyPairs = [{ first: "KEY_LEFT_ALT", second: "KEY_A" }];
  // 20 Schritte: das Gerät sendet sie in drei Blöcken
  cfg.macros = [{ name: "M", steps: Array.from({ length: 20 }, (_, i) => i % 2 ? { type: "pause", ms: 100 } : { type: "tap", code: "KEY_A" }) }, { name: "E", steps: [] }];
  const snap = snapshotWithLists(cfg);
  assert.strictEqual(api.snapshotListsState(snap), "complete");
  const d = api.diffKeymap(cfg, snap, R).lists;
  assert.strictEqual(d.known, true);
  assert.strictEqual(d.combos.length + d.pairs.length + d.macros.length, 0);
});

test("Alt-Repeat-Paare: Validierung, Duplikate und Normalisierung", () => {
  assert.strictEqual(api.MAX_ALT_REPEATS, 16);
  assert.ok(api.isValidAltRepeat({ key: "KEY_E", alt: "KEY_U" }));
  assert.ok(api.isValidAltRepeat({ key: "KEY_LEFT_SHIFT", alt: "KEY_U" }));       // Modifier sind 1..255
  assert.ok(!api.isValidAltRepeat({ key: "KEY_E", alt: "PAIR_0" }));
  assert.ok(!api.isValidAltRepeat({ key: "KEY_E", alt: "MACRO_0" }));
  assert.ok(!api.isValidAltRepeat({ key: "NONE", alt: "KEY_U" }));
  assert.ok(!api.isValidAltRepeat({ key: "KEY_E" }));
  assert.ok(!api.isValidAltRepeat({ key: "KEY_E", alt: "e" }));                      // gleiche Taste
  assert.ok(api.hasDuplicateAltRepeat([{ key: "KEY_E", alt: "KEY_U" }, { key: "e", alt: "KEY_I" }]));
  assert.ok(!api.hasDuplicateAltRepeat([{ key: "KEY_E", alt: "KEY_U" }, { key: "KEY_U", alt: "KEY_E" }]));
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  assert.strictEqual(JSON.stringify(cfg.altRepeats), JSON.stringify([]));
  const raw = JSON.parse(JSON.stringify(R.defaultConfig));
  raw.altRepeats = [{ key: "KEY_E", alt: "KEY_U", extra: 1 }, { key: "KEY_E", alt: "KEY_I" }, { key: "KEY_A", alt: "PAIR_0" }, null];
  assert.strictEqual(JSON.stringify(api.normalizeConfig(raw, R).altRepeats), JSON.stringify([{ key: "KEY_E", alt: "KEY_U" }]));
  raw.altRepeats = Array.from({ length: 17 }, (_, i) => ({ key: `KEY_${33 + i}`, alt: "KEY_U" }));
  assert.throws(() => api.validateConfigShape(raw, R), /altRepeats/);
  raw.altRepeats = [{ key: "KEY_E", alt: "KEY_U" }, { key: "KEY_E", alt: "KEY_I" }];
  assert.throws(() => api.validateConfigShape(raw, R), /dieselbe Taste/);
});

test("Alt-Repeat-Paare: Fingerlast-Button leitet beide Richtungen aus den häufigsten Folgen ab", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.layers[0][2][1] = { tap: "KEY_E", hold: "NONE", dtap: "NONE" };
  cfg.layers[0][3][1] = { tap: "KEY_U", hold: "NONE", dtap: "NONE" };
  cfg.layers[0][2][2] = { tap: "KEY_I", hold: "NONE", dtap: "NONE" };
  const added = api.altRepeatsFromSameFingerPairs(cfg, [{ a: "2_1", b: "3_1", count: 9 }]);
  assert.strictEqual(JSON.stringify(added), JSON.stringify([{ key: "KEY_E", alt: "KEY_U" }, { key: "KEY_U", alt: "KEY_E" }]));
  // Vorhandener Auslöser bleibt, nur die fehlende Richtung kommt dazu
  cfg.altRepeats = [{ key: "KEY_E", alt: "KEY_I" }];
  assert.strictEqual(JSON.stringify(api.altRepeatsFromSameFingerPairs(cfg, [{ a: "2_1", b: "3_1", count: 9 }])), JSON.stringify([{ key: "KEY_U", alt: "KEY_E" }]));
  // Leere Taste, ungültige Position und gleiche Tasten ergeben nichts
  cfg.altRepeats = [];
  cfg.layers[0][3][1] = { tap: "NONE", hold: "NONE", dtap: "NONE" };
  assert.strictEqual(JSON.stringify(api.altRepeatsFromSameFingerPairs(cfg, [{ a: "2_1", b: "3_1", count: 9 }, { a: "99_1", b: "2_1", count: 1 }])), JSON.stringify([]));
  // Eine Mod-Tap-Taste ohne Tap-Aktion liefert ihre Halte-Aktion nicht als Alt-Repeat-Taste
  cfg.layers[0][3][1] = { tap: "NONE", hold: "KEY_LEFT_SHIFT", dtap: "NONE" };
  assert.strictEqual(api.altRepeatsFromSameFingerPairs(cfg, [{ a: "2_1", b: "3_1", count: 9 }]).length, 0);
  // Obergrenze
  cfg.layers[0][3][1] = { tap: "KEY_U", hold: "NONE", dtap: "NONE" };
  cfg.altRepeats = Array.from({ length: 15 }, (_, i) => ({ key: `KEY_${33 + i}`, alt: "KEY_U" }));
  assert.strictEqual(api.altRepeatsFromSameFingerPairs(cfg, [{ a: "2_1", b: "3_1", count: 9 }]).length, 1);
});

test("Alt-Repeat-Paare: GET_CONFIG-Zeilen laufen durch Snapshot, Diff und Config", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.altRepeats = [{ key: "KEY_E", alt: "KEY_U" }, { key: "KEY_I", alt: "KEY_O" }];
  const snap = snapshotWithLists(cfg);
  assert.strictEqual(snap.counts.altrep, 2);
  assert.strictEqual(api.snapshotListsState(snap), "complete");
  assert.strictEqual(JSON.stringify(snap.altrep), JSON.stringify(api.localAltRepeatTuples(cfg)));
  assert.strictEqual(api.diffKeymap(cfg, snap, R).lists.altrep.length, 0);
  const changed = JSON.parse(JSON.stringify(cfg));
  changed.altRepeats[1].alt = "KEY_P";
  const d = api.diffKeymap(changed, snap, R).lists.altrep;
  assert.strictEqual(d.length, 1);
  assert.strictEqual(d[0].where, "Alt-Repeat 1");
  // Ungültige Zeilen machen den Snapshot unvollständig
  const bad = snapshotOf(cfg);
  assert.ok(api.captureListLine(bad, "ALTREP_COUNT:1"));
  api.captureListLine(bad, 'ALTREP_DATA:{"o":0,"e":[[0,5]]}');
  assert.strictEqual(bad.listsBroken, true);
  const tooMany = snapshotOf(cfg);
  api.captureListLine(tooMany, "ALTREP_COUNT:17");
  assert.strictEqual(tooMany.listsBroken, true);
  // buildConfigFromSnapshot: Geräteliste ersetzt die lokale; ohne ALTREP_COUNT (Firmware vor Stand 34) bleiben die lokalen Paare
  const info = { name: "X", debounce_ms: 5, combo_timeout_ms: 50, tapping_term_ms: 200, hold_tap_mode: 0, quick_tap_ms: 0, require_prior_idle_ms: 0,
    chordal_hold: 0, caps_led: 0, standby_timeout: 5, sleep_timeout: 60, tri_layer: [] };
  const local = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  local.altRepeats = [{ key: "KEY_A", alt: "KEY_B" }];
  const plain = v => JSON.parse(JSON.stringify(v));
  const fromDevice = api.buildConfigFromSnapshot(deviceSnapshotFor(cfg, info), local, R);
  assert.strictEqual(fromDevice.error, undefined);
  assert.strictEqual(JSON.stringify(plain(fromDevice.config.altRepeats)), JSON.stringify([{ key: "KEY_E", alt: "KEY_U" }, { key: "KEY_I", alt: "KEY_O" }]));
  const noAlt = JSON.parse(JSON.stringify(cfg));
  delete noAlt.altRepeats;
  const fromOld = api.buildConfigFromSnapshot(deviceSnapshotFor(noAlt, info), local, R);
  assert.strictEqual(fromOld.error, undefined);
  assert.strictEqual(JSON.stringify(plain(fromOld.config.altRepeats)), JSON.stringify([{ key: "KEY_A", alt: "KEY_B" }]));
});

test("Layout-Diff: geändertes Makro, Tastenpaar und Combo erscheinen", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.keyPairs = [{ first: "KEY_LEFT_ALT", second: "KEY_A" }];
  cfg.macros = [{ name: "M", steps: [{ type: "tap", code: "KEY_A" }] }];
  const snap = snapshotWithLists(cfg);
  cfg.macros[0].steps.push({ type: "tap", code: "KEY_B" });
  cfg.keyPairs[0].second = "KEY_B";
  cfg.combos = cfg.combos.slice(1);
  const d = api.diffKeymap(cfg, snap, R).lists;
  assert.strictEqual(d.macros.length, 1);
  assert.strictEqual(d.macros[0].where, "Makro 0");
  assert.strictEqual(d.pairs.length, 1);
  assert.ok(d.combos.length >= 1);
});

test("Layout-Diff: Combos mit anderer Reihenfolge oder doppelt zeigen einen Unterschied", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  assert.ok(cfg.combos.length >= 2);
  const snap = snapshotWithLists(cfg);
  [cfg.combos[0], cfg.combos[1]] = [cfg.combos[1], cfg.combos[0]];
  assert.ok(api.diffKeymap(cfg, snap, R).lists.combos.length > 0);
  const dup = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const snap2 = snapshotWithLists(dup);
  dup.combos.push(JSON.parse(JSON.stringify(dup.combos[0])));
  assert.strictEqual(api.diffKeymap(dup, snap2, R).lists.combos.length, 1);
});

test("Tasten-Überschreibungen: Prüfung, Normalisierung und Anzeige", () => {
  const ok = { mods: ["shift"], key: "KEY_BACKSPACE", replacement: "KEY_DELETE" };
  assert.ok(api.isValidKeyOverride(ok));
  assert.ok(api.isValidKeyOverride({ mods: ["gui", "ctrl"], key: "a", replacement: "KEY_B" }));
  const bad = [
    { ...ok, mods: [] }, { ...ok, mods: ["foo"] }, { ...ok, mods: ["shift", "shift"] }, { ...ok, mods: "shift" },
    { ...ok, key: "KEY_LEFT_SHIFT" }, { ...ok, replacement: "KEY_RIGHT_GUI" },
    { ...ok, key: "MO_1" }, { ...ok, key: "PAIR_0" }, { ...ok, replacement: "MACRO_0" }, { ...ok, key: "NONE" },
    { ...ok, key: undefined }, null, "x"
  ];
  for (const b of bad) assert.ok(!api.isValidKeyOverride(b), JSON.stringify(b));
  // Feste Reihenfolge der Modifier und Bitmaske wie KEY_OVERRIDE_MOD_* in der Firmware
  const n = api.normalizeKeyOverride({ mods: ["gui", "shift", "ctrl"], key: "KEY_A", replacement: "KEY_B" });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(n.mods)), ["ctrl", "shift", "gui"]);
  assert.strictEqual(api.keyOverrideModsValue(["ctrl", "shift", "gui"]), 11);
  assert.strictEqual(api.keyOverrideModsValue(["shift"]), 2);
  assert.strictEqual(api.keyOverrideLabel(n, c => c), "Ctrl + Shift + Cmd + KEY_A → KEY_B");
  assert.strictEqual(api.MAX_KEY_OVERRIDES, 16);
});

test("Tasten-Überschreibungen: Ebenenmaske (Prüfung, Normalisierung, Anzeige)", () => {
  const base = { mods: ["shift"], key: "KEY_BACKSPACE", replacement: "KEY_DELETE" };
  assert.ok(api.isValidKeyOverride({ ...base, layerMask: 1 }));
  for (const m of [0, 256, 1.5, "1"]) assert.ok(!api.isValidKeyOverride({ ...base, layerMask: m }), String(m));
  // null gilt wie bei server.py als alle Ebenen und fällt bei der Normalisierung weg
  assert.ok(api.isValidKeyOverride({ ...base, layerMask: null }));
  assert.ok(!("layerMask" in api.normalizeKeyOverride({ ...base, layerMask: null })));
  // Alle Ebenen ist der Standard und steht nicht in der Datei
  assert.ok(!("layerMask" in api.normalizeKeyOverride({ ...base, layerMask: 255 })));
  assert.strictEqual(api.normalizeKeyOverride({ ...base, layerMask: 5 }).layerMask, 5);
  assert.strictEqual(api.keyOverrideLayerMask(base), 255);
  assert.strictEqual(api.keyOverrideLabel({ ...base, layerMask: 5 }, c => c), "Shift + KEY_BACKSPACE → KEY_DELETE (Ebene 0, 2)");
});

test("Tasten-Überschreibungen: nur der Master trägt sie (normalizeConfig und Validierung)", () => {
  const ov = [{ mods: ["shift"], key: "KEY_BACKSPACE", replacement: "KEY_DELETE" }];
  const copy = o => JSON.parse(JSON.stringify(o));
  const right = api.normalizeConfig({ ...copy(R.defaultConfig), keyOverrides: ov }, R);
  assert.strictEqual(right.keyOverrides.length, 1);
  const left = api.normalizeConfig({ ...copy(L.defaultConfig), keyOverrides: ov }, L);
  assert.strictEqual(left.keyOverrides.length, 0);
  // Ungültige Einträge fallen beim Normalisieren weg, die Obergrenze gilt
  const many = Array.from({ length: 20 }, () => ov[0]).concat([{ mods: [], key: "KEY_A", replacement: "KEY_B" }]);
  assert.strictEqual(api.normalizeConfig({ ...copy(R.defaultConfig), keyOverrides: many }, R).keyOverrides.length, 16);
  // Import: Master akzeptiert, ungültig und andere Hälfte lehnen ab
  api.validateConfigShape({ ...copy(R.defaultConfig), keyOverrides: ov }, R);
  assert.throws(() => api.validateConfigShape({ ...copy(R.defaultConfig), keyOverrides: [{ mods: [], key: "KEY_A", replacement: "KEY_B" }] }, R), /Überschreibung 0/);
  assert.throws(() => api.validateConfigShape({ ...copy(L.defaultConfig), keyOverrides: ov }, L), /nur für die/);
  assert.throws(() => api.validateConfigShape({ ...copy(R.defaultConfig), keyOverrides: "x" }, R), /keyOverrides/);
  api.validateConfigShape({ ...copy(L.defaultConfig), keyOverrides: [] }, L);
});

test("Layout-Diff: Überschreibungen des Masters werden verglichen, ohne Zähler nicht", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.keyOverrides = [{ mods: ["shift"], key: "KEY_BACKSPACE", replacement: "KEY_DELETE" }];
  const snap = snapshotWithLists(cfg);
  assert.strictEqual(api.snapshotListsState(snap), "complete");
  assert.strictEqual(api.diffKeymap(cfg, snap, R).lists.overrides.length, 0);
  // Lokal geändert und ein zusätzlicher Eintrag
  cfg.keyOverrides[0].replacement = "KEY_TAB";
  cfg.keyOverrides.push({ mods: ["alt"], key: "KEY_A", replacement: "KEY_B" });
  const d = api.diffKeymap(cfg, snap, R).lists;
  assert.strictEqual(d.overrides.length, 2);
  assert.strictEqual(d.overrides[0].where, "Überschreibung 0");
  assert.strictEqual(d.overrides[1].device, "—");
  assert.ok(d.overrides[0].device.includes("Shift"));
  // Firmware ohne Überschreibungen (linke Hälfte oder Stand 5/6): kein Zähler, nichts zu vergleichen
  const noOv = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  delete noOv.keyOverrides;
  const snapOld = snapshotWithLists(noOv);
  assert.strictEqual(api.snapshotListsState(snapOld), "complete");
  assert.strictEqual(api.diffKeymap(cfg, snapOld, R).lists.overrides.length, 0);
  // Begonnener Block ohne alle Daten: unvollständig
  const lost = snapshotOf(noOv);
  for (const line of listLines(noOv)) api.captureListLine(lost, line);
  api.captureListLine(lost, "OVERRIDE_COUNT:2");
  api.captureListLine(lost, 'OVERRIDE_DATA:{"o":0,"e":[[2,178,212]]}');
  assert.strictEqual(api.snapshotListsState(lost), "incomplete");
  // Ungültige Zeilen: Klasse 0, Klasse 16, falsche Länge
  for (const bad of ['OVERRIDE_DATA:{"o":0,"e":[[0,178,212]]}', 'OVERRIDE_DATA:{"o":0,"e":[[16,178,212]]}', 'OVERRIDE_DATA:{"o":0,"e":[[2,178]]}']) {
    const s2 = snapshotOf(noOv);
    api.captureListLine(s2, "OVERRIDE_COUNT:1");
    assert.ok(api.captureListLine(s2, bad));
    assert.strictEqual(api.snapshotListsState(s2), "incomplete", bad);
  }
  api.captureListLine(snapOld, "OVERRIDE_COUNT:17");
  assert.strictEqual(api.snapshotListsState(snapOld), "incomplete");
});

// Komplettes Laden vom Gerät: GET_CONFIG-Zeilen (mit Ebenenmaske) und DEVICE_INFO ergeben dieselbe Config
function deviceLinesFor(cfg) {
  const lines = [];
  const combos = cfg.combos.map(cb => [cb.key1.r, cb.key1.c, cb.key2.r, cb.key2.c,
    { KEY_PRESS: 0, MODIFIER_HOLD: 1, LAYER_TOGGLE: 2 }[cb.behavior], api.actionCodeToNumeric(cb.action), api.comboLayerMask(cb)]);
  lines.push("COMBO_COUNT:" + combos.length);
  for (let o = 0; o < combos.length; o += 4) lines.push("COMBO_DATA:" + JSON.stringify({ o, e: combos.slice(o, o + 4) }));
  return [...lines, ...listLines({ ...cfg, combos: [] }).filter(l => !l.startsWith("COMBO"))];
}

function deviceSnapshotFor(cfg, info) {
  const snap = snapshotOf(cfg);
  for (const line of deviceLinesFor(cfg)) assert.ok(api.captureListLine(snap, line), line);
  snap.info = info || null;
  return snap;
}

test("Komplettes Laden: vollständige GET_CONFIG-Ausgabe ergibt dieselbe Config wie die Quelle", () => {
  const source = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  source.layerNames[3] = "Spiele";
  source.layers[1][2][3] = { label: "J", tap: "KEY_J", hold: "KEY_LEFT_CTRL", dtap: "KEY_ESC", tapTerm: 250 };
  source.keyPairs = [{ first: "KEY_LEFT_ALT", second: "KEY_A" }, { first: "KEY_B", second: "KEY_C" }];
  source.keyOverrides = [{ mods: ["shift"], key: "KEY_BACKSPACE", replacement: "KEY_DELETE" }];
  source.macros = [{ name: "Makro 0", steps: [{ type: "tap", code: "KEY_A" }, { type: "pause", ms: 100 }, { type: "down", code: "KEY_LEFT_SHIFT" }] },
                   { name: "Makro 1", steps: [] }];
  source.combos = [
    { id: "combo-1", name: "x", key1: { r: 2, c: 1, label: "J" }, key2: { r: 2, c: 2, label: "K" }, behavior: "KEY_PRESS", action: "KEY_ESC", actionLabel: "ESC" },
    { id: "combo-2", name: "y", key1: { r: 1, c: 1, label: "U" }, key2: { r: 1, c: 2, label: "I" }, behavior: "LAYER_TOGGLE", action: "TG_2", actionLabel: "TG2", layerMask: 0b101 }
  ];
  source.settings = { ...source.settings, debounceMs: 7, comboTimeoutMs: 55, tappingTermMs: 180, holdTapMode: 1, quickTapMs: 120,
    requirePriorIdleMs: 90, chordalHold: 1, capsLed: 1, standbyTimeoutMinutes: 10, sleepTimeoutMinutes: 90, deviceName: "Mein Dactyl",
    triLayers: [{ a: 1, b: 2, target: 3 }] };
  const snap = deviceSnapshotFor(source, {
    name: "Mein Dactyl", debounce_ms: 7, combo_timeout_ms: 55, tapping_term_ms: 180, hold_tap_mode: 1, quick_tap_ms: 120,
    require_prior_idle_ms: 90, chordal_hold: 1, caps_led: 1, standby_timeout: 10, sleep_timeout: 90, tri_layer: [[1, 2, 3]]
  });
  // TERM_DATA (eigener Tapping-Term) kommt wie bei der Firmware in snapshot.term
  const term = Array.from({ length: 6 }, () => Array(7).fill(0));
  term[2][3] = 250;
  api.captureMatrixData(snap, "term", { l: 1, k: term });
  const local = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const built = api.buildConfigFromSnapshot(snap, local, R);
  assert.strictEqual(built.error, undefined);
  const plain = v => JSON.parse(JSON.stringify(v));
  const got = plain(built.config);
  const want = plain(source);
  assert.deepStrictEqual(got.layerNames, want.layerNames);
  assert.deepStrictEqual(got.keyPairs, want.keyPairs);
  assert.deepStrictEqual(got.keyOverrides, want.keyOverrides);
  assert.deepStrictEqual(got.macros, want.macros);
  assert.deepStrictEqual(got.settings, want.settings);
  assert.deepStrictEqual(got.combos.map(c => [c.key1.r, c.key1.c, c.key2.r, c.key2.c, c.behavior, c.action, c.layerMask]),
    want.combos.map(c => [c.key1.r, c.key1.c, c.key2.r, c.key2.c, c.behavior, c.action, c.layerMask]));
  for (let l = 0; l < 8; l++) for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
    if (!api.isPhysicalKey(r, c, R)) continue;
    assert.deepStrictEqual(plain(api.keyToNumericActions(got.layers[l][r][c])), plain(api.keyToNumericActions(want.layers[l][r][c])), `L${l}R${r}C${c}`);
    assert.strictEqual(api.keyTapTerm(got.layers[l][r][c]), api.keyTapTerm(want.layers[l][r][c]), `Term L${l}R${r}C${c}`);
  }
  // Die gelesene Config ist gültig und liefert gegen das Gerät keinen Unterschied
  api.validateConfigShape(plain(built.config), R);
  const d = api.diffKeymap(built.config, snap, R);
  assert.strictEqual(d.keys.length + d.names.length + d.lists.combos.length + d.lists.pairs.length + d.lists.overrides.length + d.lists.macros.length, 0);
});

test("deviceNameFromInfo: gleiche Namensregel für Laden und DEVICE_INFO-Handler", () => {
  assert.strictEqual(api.deviceNameFromInfo({ name: "My Config Board", config_mode: 0 }), "My Config Board");
  assert.strictEqual(api.deviceNameFromInfo({ name: "Dactyl Config", config_mode: 1 }), "");
  assert.strictEqual(api.deviceNameFromInfo({ name: "Dactyl Config" }), "");
  assert.strictEqual(api.deviceNameFromInfo({ name: "Dactyl" }), "Dactyl");
  assert.strictEqual(api.deviceNameFromInfo({}), "");
  assert.ok(/deviceNameFromInfo\(info\)/.test(require("fs").readFileSync(require("path").join(__dirname, "..", "js", "serial.js"), "utf8")),
    "js/serial.js nutzt deviceNameFromInfo");
});

test("Komplettes Laden: eine ungültige Listenzeile ergibt keine Config", () => {
  const local = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const before = JSON.stringify(local);
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.keyPairs = [{ first: "KEY_A", second: "KEY_B" }];
  for (const bad of ['PAIR_DATA:{"o":0,"e":[[1]]}', "PAIR_COUNT:99", 'MACRO_DATA:{"i":0,"n":1,"o":0,"s":[[9,1,0]]}',
                     'COMBO_DATA:{"o":0,"e":[[0,0,0,1,3,4,255]]}', 'OVERRIDE_DATA:nonsense']) {
    const snap = deviceSnapshotFor(cfg, null);
    assert.strictEqual(api.captureListLine(snap, bad), true, bad);
    const built = api.buildConfigFromSnapshot(snap, local, R);
    assert.ok(built.error, bad);
    assert.strictEqual(built.config, undefined, bad);
  }
  // Fehlende Zeile, ältere Firmware ohne Listen und unvollständige Matrix
  const lost = snapshotOf(cfg);
  for (const line of deviceLinesFor(cfg).filter(l => !l.startsWith("PAIR_DATA"))) api.captureListLine(lost, line);
  assert.ok(api.buildConfigFromSnapshot(lost, local, R).error);
  assert.ok(api.buildConfigFromSnapshot(snapshotOf(cfg), local, R).error.includes("flashen"));
  const noMatrix = api.createDeviceSnapshot();
  assert.ok(api.buildConfigFromSnapshot(noMatrix, local, R).error);
  assert.strictEqual(JSON.stringify(local), before);
});

test("Komplettes Laden: Einstellungen ohne DEVICE_INFO-Feld bleiben, die linke Hälfte trägt keine Überschreibungen", () => {
  const base = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  base.settings.debounceMs = 9;
  const s = api.settingsFromDeviceInfo({ combo_timeout_ms: 60, name: "Dactyl Config" }, base.settings);
  assert.strictEqual(s.debounceMs, 9);
  assert.strictEqual(s.comboTimeoutMs, 60);
  assert.strictEqual(s.deviceName, base.settings.deviceName);
  // Ein Name mit "Config" im Tastaturmodus bleibt erhalten; im Config-Modus gilt der Config-Name nicht
  assert.strictEqual(api.settingsFromDeviceInfo({ name: "My Config Board", config_mode: 0 }, base.settings).deviceName, "My Config Board");
  assert.strictEqual(api.settingsFromDeviceInfo({ name: "Dactyl Config", config_mode: 1 }, base.settings).deviceName, base.settings.deviceName);
  const L = api.SIDE_PROFILES.L;
  const leftCfg = api.normalizeConfig(JSON.parse(JSON.stringify(L.defaultConfig)), L);
  const built = api.buildConfigFromSnapshot(deviceSnapshotFor(leftCfg, {}), leftCfg, L);
  assert.strictEqual(built.error, undefined);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(built.config.keyOverrides)), []);
});

test("Layout-Diff: ein zusätzliches Makro auf dem Gerät erscheint", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.macros = [];
  const snap = snapshotOf(cfg);
  for (const line of listLines(cfg).filter(l => !l.startsWith("MACRO"))) api.captureListLine(snap, line);
  api.captureListLine(snap, "MACRO_COUNT:1");
  api.captureListLine(snap, 'MACRO_DATA:{"i":0,"n":1,"o":0,"s":[[1,97,0]]}');
  const d = api.diffKeymap(cfg, snap, R).lists;
  assert.strictEqual(d.macros.length, 1);
  assert.strictEqual(d.macros[0].local, "—");
});

test("Layout-Diff: ältere Firmware (keine Listen) ist 'absent', fehlende oder ungültige Zeilen sind 'incomplete'", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const old = snapshotOf(cfg);
  assert.strictEqual(api.snapshotListsState(old), "absent");
  const dOld = api.diffKeymap(cfg, old, R).lists;
  assert.strictEqual(dOld.known, false);
  assert.strictEqual(dOld.state, "absent");

  // Eine verlorene Zeile: unvollständig, nicht "ältere Firmware"
  cfg.macros = [{ name: "M", steps: [{ type: "tap", code: "KEY_A" }] }];
  const lost = snapshotOf(cfg);
  for (const line of listLines(cfg).filter(l => !l.startsWith("MACRO_DATA"))) api.captureListLine(lost, line);
  assert.strictEqual(api.snapshotListsState(lost), "incomplete");
  assert.strictEqual(api.diffKeymap(cfg, lost, R).lists.state, "incomplete");

  // Ungültige Zeilen werden verbraucht, verfälschen nichts und machen den Snapshot unvollständig
  for (const bad of ["MACRO_COUNT:", "MACRO_COUNT:0x5", "MACRO_COUNT:99", "COMBO_COUNT:17", "COMBO_DATA:nonsense"]) {
    const snap = snapshotOf(cfg);
    assert.strictEqual(api.captureListLine(snap, bad), true, bad);
    assert.strictEqual(api.snapshotListsState(snap), "incomplete", bad);
  }
  const range = snapshotOf(cfg);
  api.captureListLine(range, "COMBO_COUNT:1");
  api.captureListLine(range, 'COMBO_DATA:{"o":0,"e":[[0,0,0,1,3,4]]}');   // Verhalten 3 gibt es nicht
  assert.strictEqual(range.combos.length, 0);
  assert.strictEqual(api.snapshotListsState(range), "incomplete");
  const step = snapshotOf(cfg);
  api.captureListLine(step, "MACRO_COUNT:1");
  api.captureListLine(step, 'MACRO_DATA:{"i":0,"n":1,"o":0,"s":[[9,1,0]]}'); // Schritt-Typ 9 gibt es nicht
  assert.strictEqual(api.snapshotListsState(step), "incomplete");
  // Falscher Offset (doppelter oder übersprungener Block)
  const off = snapshotOf(cfg);
  api.captureListLine(off, "PAIR_COUNT:2");
  api.captureListLine(off, 'PAIR_DATA:{"o":1,"e":[[1,2]]}');
  assert.strictEqual(api.snapshotListsState(off), "incomplete");
  assert.strictEqual(api.captureListLine(snapshotOf(cfg), "LAYER_DATA:{}"), false);
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
  const calls = { capture: [], press: [], release: [], captured: [], rendered: 0, rawRendered: 0, applied: 0, stats: [], practice: [], layers: [], tri: [], warns: [] };
  const s = {
    calls, console: { log() {}, warn(...a) { calls.warns.push(a.map(String).join(' ')); } },
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
var deviceLoadSide = null, deviceSnapshotRead = null;
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
function updateBleHostUI(slot) { calls.bleHost = slot; }
function switchLayerUI(l) { calls.layers.push(l); }
function renderMatrix() { calls.applied++; }
function renderMatrixTest() { calls.rendered++; }
const matrixRawState = createMatrixRawState();
function renderMatrixRaw() { calls.rawRendered++; }
function renderLayerButtons() {}
const firmwareVersions = { noteDeviceInfo() {} };
const deviceInfoByRole = {};
const splitLinkStatus = { noteDeviceInfo() {} };
function updateFirmwareVersionUI() {}
function updateSplitLinkUI() {}
function applyTriLayersToInputs(rules) { calls.tri.push(JSON.stringify(rules)); }
function saveConfigToServer() {}
function clearPendingSync() {}
function onTypingStatsChanged(side) { calls.stats.push(side); }
function practiceHandleKeyPress(side, r, c, layer) { calls.practice.push([side, r, c, layer]); }
function feedKeyCapture(side, r, c, pressed) { calls.capture.push(side + r + c + (pressed ? "+" : "-")); }
function feedTimingAssistant(side, evt) { calls.timing = (calls.timing || 0) + 1; }
function triggerVisualKeyPress(r, c, label, side) { calls.press.push(side + r + c); }
function triggerVisualKeyRelease(r, c, side) { calls.release.push(side + r + c); }
${section("js/live-monitor.js", "// Rolle der gedrückten Taste", "function triggerVisualKeyPress")}
${section("js/serial.js", "// LED-Zustand des Hosts:", "function switchLayerUI")}
this.setTap = (side, l, r, c, tap) => { configs[side].layers[l][r][c].tap = tap; };
this.corrections = side => ({ ...stats[side].corrections });
this.hostCaps = () => hostLedsState && hostLedsState.caps;
this.dmRec = () => dmRecording; this.parse = Dactyl.parseDmRecLine; this.modes = () => modeState; this.describeModes = () => Dactyl.describeModeState(modeState); this.forgetModes = forgetModeState;
this.handle = handleSerialLine; this.settingOf = (side, k) => configs[side].settings[k]; this.triOf = side => JSON.stringify(configs[side].settings.triLayers); this.tested = side => [...tests[side].tested];
this.bounces = side => [...tests[side].bounces].map(([id, n]) => id + ':' + n);
this.rawState = () => ({ active: matrixRawState.active, R: [[...matrixRawState.sides.R.down], [...matrixRawState.sides.R.presses], matrixRawState.sides.R.total],
                         L: [[...matrixRawState.sides.L.down], [...matrixRawState.sides.L.presses], matrixRawState.sides.L.total] });
this.setRawActive = v => { matrixRawState.active = v; };
this.layerCounts = (side, l) => ({ ...stats[side].layerCounts[l] });`, s);
  // Arrays aus dem VM-Kontext haben einen anderen Prototyp: für deepStrictEqual in einfache Werte kopieren
  const plain = v => JSON.parse(JSON.stringify(v));
  return {
    rawState: () => plain(s.rawState()), setRawActive: v => s.setRawActive(v),
    warns: calls.warns, handle: (...a) => s.handle(...a), settingOf: (side, k) => s.settingOf(side, k), triOf: side => s.triOf(side), tested: side => plain(s.tested(side)), bounces: side => plain(s.bounces(side)),
    setTap: (...a) => s.setTap(...a), layerCounts: (side, l) => plain(s.layerCounts(side, l)), corrections: side => plain(s.corrections(side)), hostCaps: () => s.hostCaps(), dmRec: () => s.dmRec(), modes: () => plain(s.modes()), describeModes: () => plain(s.describeModes()), forgetModes: () => s.forgetModes(), parse: (...a) => s.parse(...a),
    calls: new Proxy(calls, { get: (o, k) => plain(o[k]) }),
    set snapshotActive(v) { s.snapshotActive = v; },
    setLoadSide(v) { vm.runInContext("deviceLoadSide = " + JSON.stringify(v), s); },
    setStaleRead(v) { vm.runInContext("deviceSnapshotRead = " + JSON.stringify(v), s); }
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
  assert.strictEqual(s.calls.timing, 3);             // jede gültige MATRIX:-Zeile geht an den Tapping-Term-Assistenten
});

test("serial.js: MATRIX: mit t erkennt Prellen je Hälfte, ohne t nicht", () => {
  const s = serialLineHarness();
  s.handle('MATRIX:{"r":2,"c":1,"pressed":1,"t":1000}', "R", "usb");
  s.handle('MATRIX:{"r":2,"c":1,"pressed":0,"t":1050}', "R", "usb");
  assert.strictEqual(s.calls.rendered, 1);                                    // nur der erste Druck markiert die Taste
  s.handle('MATRIX:{"r":2,"c":1,"pressed":1,"t":1060}', "R", "usb");          // 10 ms nach dem Loslassen
  assert.strictEqual(s.calls.rendered, 2);                                    // Prellen zeichnet die Ansicht neu
  assert.deepStrictEqual(s.bounces("R"), ["2_1:1"]);
  assert.deepStrictEqual(s.bounces("L"), []);
  // Ältere Firmware ohne t: kein Prell-Ergebnis, auch bei schnellem Druck
  s.handle('MATRIX:{"r":3,"c":1,"pressed":0}', "R", "usb");
  s.handle('MATRIX:{"r":3,"c":1,"pressed":1}', "R", "usb");
  assert.deepStrictEqual(s.bounces("R"), ["2_1:1"]);
  // Linke Hälfte direkt an USB: eigener Zähler, die Ansicht der rechten Hälfte bleibt
  s.handle('MATRIX:{"r":1,"c":1,"pressed":0,"t":500}', "L", "usb");
  s.handle('MATRIX:{"r":1,"c":1,"pressed":1,"t":505}', "L", "usb");
  assert.deepStrictEqual(s.bounces("L"), ["1_1:1"]);
  assert.deepStrictEqual(s.bounces("R"), ["2_1:1"]);
});

test("serial.js: DEVICE_INFO und MODE: vergessen die Loslass-Zeiten, die Treffer bleiben", () => {
  const s = serialLineHarness();
  for (const marker of ['DEVICE_INFO:{"side":"R","fw":2}', "MODE:CONFIG", "MODE:KEYBOARD"]) {
    s.handle('MATRIX:{"r":2,"c":1,"pressed":0,"t":1000}', "R", "usb");
    s.handle(marker, "R", "usb");                                             // Neustart oder Moduswechsel
    s.handle('MATRIX:{"r":2,"c":1,"pressed":1,"t":1010}', "R", "usb");        // läge 10 ms nach dem alten Loslassen
    assert.deepStrictEqual(s.bounces("R"), [], marker);
  }
  // Ein Treffer vor dem Neustart bleibt erhalten
  s.handle('MATRIX:{"r":3,"c":1,"pressed":0,"t":2000}', "R", "usb");
  s.handle('MATRIX:{"r":3,"c":1,"pressed":1,"t":2010}', "R", "usb");
  s.handle("MODE:KEYBOARD", "R", "usb");
  assert.deepStrictEqual(s.bounces("R"), ["3_1:1"]);
  // Die andere Hälfte behält ihre Zeiten
  s.handle('MATRIX:{"r":1,"c":1,"pressed":0,"t":500}', "L", "usb");
  s.handle("MODE:KEYBOARD", "R", "usb");
  s.handle('MATRIX:{"r":1,"c":1,"pressed":1,"t":505}', "L", "usb");
  assert.deepStrictEqual(s.bounces("L"), ["1_1:1"]);
});

test("serial.js: DEVICE_INFO der nicht bearbeiteten Hälfte ändert die Tri-Layer-Felder nicht", () => {
  const s = serialLineHarness();
  s.warns.length = 0;
  const info = side => `DEVICE_INFO:{"side":"${side}","fw":14,"tri_layer":[[1,2,3]]}`;
  s.handle(info("L"), "L", "usb");
  assert.deepStrictEqual(s.calls.tri, []);
  assert.deepStrictEqual([...s.warns], [], s.warns.join('|'));
  assert.strictEqual(s.triOf("L"), '[{"a":1,"b":2,"target":3}]');
  assert.strictEqual(s.triOf("R"), "[]");
  s.handle(info("R"), "R", "usb");
  assert.deepStrictEqual(s.calls.tri, ['[{"a":1,"b":2,"target":3}]']);
  assert.strictEqual(s.triOf("R"), '[{"a":1,"b":2,"target":3}]');
});

test("serial.js: DEVICE_INFO ändert während des kompletten Ladens die lokalen Einstellungen nicht", () => {
  const s = serialLineHarness();
  s.setLoadSide("R");
  s.handle('DEVICE_INFO:{"side":"R","fw":22,"chordal_hold":1,"debounce_ms":9,"tri_layer":[[1,2,3]]}', "R", "usb");
  assert.strictEqual(s.settingOf("R", "chordalHold"), 0);
  assert.strictEqual(s.settingOf("R", "debounceMs"), 5);
  assert.strictEqual(s.triOf("R"), "[]");
  assert.deepStrictEqual(s.calls.tri, []);
  // Das Laden der anderen Hälfte hält diese Hälfte nicht zurück
  s.setLoadSide("L");
  s.handle('DEVICE_INFO:{"side":"R","fw":22,"chordal_hold":1}', "R", "usb");
  assert.strictEqual(s.settingOf("R", "chordalHold"), 1);
  s.setLoadSide(null);
  // Späte Antwort nach dem Timeout (Abfrage besteht noch und verwirft Zeilen): Einstellungen bleiben unverändert
  s.setStaleRead({ side: "R", withInfo: true, stale: true });
  s.handle('DEVICE_INFO:{"side":"R","fw":22,"debounce_ms":9}', "R", "usb");
  assert.strictEqual(s.settingOf("R", "debounceMs"), 5);
  s.setStaleRead(null);
  s.handle('DEVICE_INFO:{"side":"R","fw":22,"debounce_ms":9}', "R", "usb");
  assert.strictEqual(s.settingOf("R", "debounceMs"), 9);
});

test("serial.js: chordal_hold in DEVICE_INFO setzt die Einstellung der gemeldeten Hälfte", () => {
  const s = serialLineHarness();
  assert.strictEqual(s.settingOf("R", "chordalHold"), 0);
  s.handle('DEVICE_INFO:{"side":"R","fw":20,"chordal_hold":1}', "R", "usb");
  assert.strictEqual(s.settingOf("R", "chordalHold"), 1);
  assert.strictEqual(s.settingOf("L", "chordalHold"), 0);
  s.handle('DEVICE_INFO:{"side":"L","fw":20,"chordal_hold":1}', "L", "usb");
  assert.strictEqual(s.settingOf("L", "chordalHold"), 1);
  // Firmware ohne das Feld ändert nichts
  s.handle('DEVICE_INFO:{"side":"R","fw":19}', "R", "usb");
  assert.strictEqual(s.settingOf("R", "chordalHold"), 1);
});

test("serial.js: pi und rt in DEVICE_INFO setzen requirePriorIdleMs und retroTap", () => {
  const s = serialLineHarness();
  s.handle('DEVICE_INFO:{"side":"R","fw":31,"pi":70,"rt":1}', "R", "usb");
  assert.strictEqual(s.settingOf("R", "requirePriorIdleMs"), 70);
  assert.strictEqual(s.settingOf("R", "retroTap"), 1);
});

test("serial.js: require_prior_idle_ms in DEVICE_INFO setzt die Einstellung der gemeldeten Hälfte", () => {
  const s = serialLineHarness();
  assert.strictEqual(s.settingOf("R", "requirePriorIdleMs"), 0);
  s.handle('DEVICE_INFO:{"side":"R","fw":22,"require_prior_idle_ms":120}', "R", "usb");
  assert.strictEqual(s.settingOf("R", "requirePriorIdleMs"), 120);
  assert.strictEqual(s.settingOf("L", "requirePriorIdleMs"), 0);
  s.handle('DEVICE_INFO:{"side":"L","fw":22,"require_prior_idle_ms":80}', "L", "usb");
  assert.strictEqual(s.settingOf("L", "requirePriorIdleMs"), 80);
  // Firmware ohne das Feld ändert nichts
  s.handle('DEVICE_INFO:{"side":"R","fw":21}', "R", "usb");
  assert.strictEqual(s.settingOf("R", "requirePriorIdleMs"), 120);
});

test("serial.js: host_leds in DEVICE_INFO der linken Hälfte ändert den Stand nicht", () => {
  const s = serialLineHarness();
  s.handle('DEVICE_INFO:{"side":"L","fw":15,"host_leds":{"num":0,"caps":1,"scroll":0}}', "L", "usb");
  assert.strictEqual(!!s.hostCaps(), false);
});

test("serial.js: BLE_HOST: meldet nur Slots 1 bis 3 und die Trennung blendet die Anzeige aus", () => {
  const s = serialLineHarness();
  s.handle("BLE_HOST:2", "R", "usb");
  assert.strictEqual(s.calls.bleHost, 2);
  s.handle("BLE_HOST:0", "R", "usb");
  assert.strictEqual(s.calls.bleHost, 0);
  s.handle("BLE_HOST:9", "R", "usb");
  assert.strictEqual(s.calls.bleHost, 9);
});

test("serial.js: HOST_LEDS zeigt Caps Lock nur vom Master über USB", () => {
  const s = serialLineHarness();
  s.handle('HOST_LEDS:{"num":0,"caps":1,"scroll":0}', "R", "usb");
  assert.strictEqual(s.hostCaps(), true);
  s.handle('HOST_LEDS:{"num":0,"caps":0,"scroll":0}', "R", "usb");
  assert.strictEqual(s.hostCaps(), false);
  // Linke Hälfte, BLE, kaputte Zeile und falsche Typen ändern den Stand nicht
  s.handle('HOST_LEDS:{"num":0,"caps":1,"scroll":0}', "L", "usb");
  s.handle('HOST_LEDS:{"num":0,"caps":1,"scroll":0}', "R", "ble");
  s.handle('HOST_LEDS:{"num":0,"caps":2,"scroll":0}', "R", "usb");
  s.handle('HOST_LEDS:kaputt', "R", "usb");
  assert.strictEqual(s.hostCaps(), false);
  // DEVICE_INFO trägt denselben Stand
  s.handle('DEVICE_INFO:{"side":"R","fw":15,"host_leds":{"num":0,"caps":1,"scroll":0},"caps_led":1}', "R", "usb");
  assert.strictEqual(s.hostCaps(), true);
});

test("Split-Link: Signalstärke aus rssi/rssi_min, Tooltip und gelbe Pill unter -80 dBm", () => {
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(`${read("js/matrix-constants.js")}\n${read("js/side-profiles.js")}\n${read("js/side-right.js")}\n${read("js/side-left.js")}\n${read("js/side-routing.js")}`, ctx);
  const D = ctx.Dactyl || vm.runInContext("Dactyl", ctx);
  const plain = v => JSON.parse(JSON.stringify(v));
  const line = extra => `SPLIT_LINK:{"up":1,"ms":10,"ever":1,"losses":0,"rx_dropped":0,"key_dropped":0${extra}}`;
  const fmt = ms => `T${ms}`;
  const view = extra => D.describeSplitLink({ ...D.parseSplitLinkLine(line(extra), "R"), since: 1 }, "Links", fmt);
  // Mit Werten: beide im Tooltip, über der Schwelle nicht gelb
  const ok = D.parseSplitLinkLine(line(',"rssi":-60,"rssi_min":-75'), "R");
  assert.deepStrictEqual([ok.rssi, ok.rssiMin], [-60, -75]);
  const good = view(',"rssi":-60,"rssi_min":-75');
  assert.ok(good.title.includes("-60 dBm") && good.title.includes("-75 dBm"));
  assert.strictEqual(good.weak, false);
  assert.strictEqual(good.text, "Links: verbunden");
  // Genau -80 ist noch nicht gelb, -81 ist gelb
  assert.strictEqual(view(',"rssi":-80,"rssi_min":-90').weak, false);
  const weak = view(',"rssi":-81,"rssi_min":-90');
  assert.strictEqual(weak.weak, true);
  assert.ok(weak.text.includes("schwaches Signal"));
  // Ohne rssi (ältere Firmware) und mit null (noch kein Paket): kein Signaltext, nie gelb
  for (const extra of ["", ',"rssi":null,"rssi_min":null']) {
    const v = view(extra);
    assert.strictEqual(v.weak, false);
    assert.ok(!v.title.includes("dBm"));
  }
  assert.strictEqual(plain(D.parseSplitLinkLine(line(',"rssi":null,"rssi_min":null'), "R")).rssi, null);
  // Ungültige Werte verwerfen die Zeile
  for (const extra of [',"rssi":-60', ',"rssi":5,"rssi_min":-70', ',"rssi":"x","rssi_min":-70', ',"rssi":-60.5,"rssi_min":-70',
                       ',"rssi":null,"rssi_min":-70', ',"rssi":-200,"rssi_min":-70']) {
    assert.strictEqual(D.parseSplitLinkLine(line(extra), "R"), undefined, extra);
  }
  // Ein getrennter Link ist nie gelb, auch mit schwachem letzten Wert
  const down = D.describeSplitLink({ ...plain(ok), up: false, rssi: -95, since: 1 }, "Links", fmt);
  assert.strictEqual(down.weak, false);
  // Pill in serial.js setzt die Klasse link-weak, das Stylesheet färbt sie gelb
  assert.ok(read("js/serial.js").includes('pill.classList.toggle("link-weak", !!view && view.weak === true);'));
  assert.ok(/\.split-link-pill\.link-weak\s*\{[^}]*var\(--warning\)/.test(read("style.css")));
});

test("Host-LEDs: Parser, Anzeige, Kopfzeile und Setting", () => {
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(`${read("js/matrix-constants.js")}\n${read("js/side-profiles.js")}\n${read("js/side-right.js")}\n${read("js/side-left.js")}\n${read("js/side-routing.js")}`, ctx);
  const D = ctx.Dactyl || vm.runInContext("Dactyl", ctx);
  const plain = v => JSON.parse(JSON.stringify(v));
  assert.deepStrictEqual(plain(D.parseHostLeds({ num: 1, caps: 0, scroll: 1 })), { num: true, caps: false, scroll: true });
  assert.strictEqual(D.parseHostLeds({ num: 1, caps: 0 }), undefined);
  assert.strictEqual(D.parseHostLeds(null), undefined);
  assert.strictEqual(D.describeHostLeds(null).capsOn, false);
  assert.strictEqual(D.describeHostLeds({ num: false, caps: true, scroll: false }).capsOn, true);
  assert.strictEqual(D.describeHostLeds({ num: true, caps: false, scroll: false }).capsOn, false);
  const html = read("index.html");
  assert.ok(/id="capsLockPill"[^>]*\bhidden\b/.test(html) && html.includes('id="capsLedCheckbox"'));
  assert.strictEqual(api.clampSetting("capsLed", 7), 1);
  assert.strictEqual(api.clampSetting("capsLed", "x"), 0);
  assert.strictEqual(api.normalizeConfig({ layers: [[]] }, R).settings.capsLed, 0);
  assert.ok(read("js/ble.js").slice(read("js/ble.js").indexOf("function onBleDisconnected")).includes("forgetHostLeds();"));
  // Eine BLE-Trennung löscht den USB-Stand nicht, solange USB zum Master besteht
  const fh = read("js/serial.js");
  const body = fh.slice(fh.indexOf("function forgetHostLeds"), fh.indexOf("// Gedrückte SPLIT_KEY-Tasten"));
  assert.ok(body.includes("Dactyl.splitLinkStaysValid(connectionState())"));
  assert.ok(read("js/serial.js").slice(read("js/serial.js").indexOf("async function disconnectSerialNow")).includes("forgetHostLeds();"));
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

test("serial.js: MATRIX, KEY_PRESS, KEY_RELEASE und SPLIT_KEY speisen die Tastenaufnahme", () => {
  const s = serialLineHarness();
  s.handle('MATRIX:{"r":2,"c":1,"pressed":1}', "R", "usb");
  s.handle('MATRIX:{"r":2,"c":1,"pressed":0}', "R", "usb");
  s.handle('KEY_PRESS:{"r":3,"c":2,"layer":0,"key":"x"}', "R", "ble");
  s.handle('KEY_RELEASE:{"r":3,"c":2}', "R", "ble");
  // SPLIT_KEY trägt die Hälfte der Sender-Seite (links), nicht die der Zeile
  s.handle('SPLIT_KEY:{"r":1,"c":2,"pressed":1,"layer":0}', "R", "usb");
  assert.deepStrictEqual(s.calls.capture, ["R21+", "R21-", "R32+", "R32-", "L12+"]);
});

test("serial.js: ein geprellter MATRIX-Druck füllt keinen Platz der Tastenaufnahme", () => {
  const s = serialLineHarness();
  s.handle('MATRIX:{"r":2,"c":1,"pressed":1,"t":1000}', "R", "usb");
  s.handle('MATRIX:{"r":2,"c":1,"pressed":0,"t":1100}', "R", "usb");
  s.handle('MATRIX:{"r":2,"c":1,"pressed":1,"t":1103}', "R", "usb");   // Prellen: 3 ms nach dem Loslassen
  assert.deepStrictEqual(s.calls.capture, ["R21+", "R21-"]);
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

test("serial.js: KEY_PRESS und SPLIT_KEY zählen die Heatmap nach ihrer Ebene", () => {
  const s = serialLineHarness();
  s.handle('KEY_PRESS:{"r":1,"c":2,"key":"q","layer":0}', "R", "usb");
  s.handle('KEY_PRESS:{"r":1,"c":2,"key":"!","layer":3}', "R", "usb");
  s.handle('SPLIT_KEY:{"r":2,"c":2,"pressed":1,"layer":3}', "R", "usb");
  assert.deepStrictEqual(s.layerCounts("R", 0), { "1_2": 1 });
  assert.deepStrictEqual(s.layerCounts("R", 3), { "1_2": 1 });
  assert.deepStrictEqual(s.layerCounts("L", 3), { "2_2": 1 });
});

test("Korrekturen: Backspace korrigiert die Taste davor, nicht die davor davor", () => {
  const s = api.createTypingStats(null, R);
  api.recordKeyPress(s, 2, 1, 0); // a
  api.recordKeyPress(s, 2, 2, 100); // s
  api.recordKeyPress(s, 0, 5, 200, undefined, "backspace"); // Backspace
  assert.deepStrictEqual({ ...s.corrections }, { "2_2": 1 });
  assert.strictEqual(s.corrections["2_1"], undefined);
  api.recordKeyPress(s, 0, 5, 300, undefined, "backspace"); // zweiter Backspace: keine Taste mehr davor
  assert.deepStrictEqual({ ...s.corrections }, { "2_2": 1 });
});

test("Korrekturen: ein Backspace nach dem Fenster von 1500 ms zählt nicht", () => {
  const s = api.createTypingStats(null, R);
  api.recordKeyPress(s, 2, 2, 0);
  api.recordKeyPress(s, 0, 5, api.CORRECTION_WINDOW_MS + 1, undefined, "backspace");
  assert.deepStrictEqual({ ...s.corrections }, {});
  api.recordKeyPress(s, 2, 2, 5000);
  api.recordKeyPress(s, 0, 5, 5000 + api.CORRECTION_WINDOW_MS, undefined, "backspace"); // genau am Rand: zählt
  assert.deepStrictEqual({ ...s.corrections }, { "2_2": 1 });
});

test("Korrekturen: Anteil, Rangliste, Speicherform und ungültige Daten", () => {
  const s = api.createTypingStats(null, R);
  for (let i = 0; i < 10; i++) { // s: 10 Anschläge, 4 Korrekturen
    api.recordKeyPress(s, 2, 2, i * 10000);
    if (i < 4) api.recordKeyPress(s, 0, 5, i * 10000 + 10, undefined, "backspace");
  }
  api.recordKeyPress(s, 2, 1, 200000); // a: 1 Anschlag, 1 Korrektur, unter der Mindestzahl
  api.recordKeyPress(s, 0, 5, 200010, undefined, "backspace");
  const top = api.topCorrectedKeys(s);
  assert.strictEqual(top.length, 1);
  assert.strictEqual(top[0].id, "2_2");
  assert.strictEqual(top[0].corrections, 4);
  assert.strictEqual(top[0].presses, 10);
  assert.ok(Math.abs(top[0].share - 0.4) < 1e-9);
  const stored = JSON.parse(JSON.stringify(api.serializeTypingStats(s)));
  assert.deepStrictEqual(stored.corrections, { "2_2": 4, "2_1": 1 });
  assert.deepStrictEqual({ ...api.createTypingStats(stored, R).corrections }, { "2_2": 4, "2_1": 1 });
  const bad = api.createTypingStats({ corrections: { "2_2": 3, "9_9": 2, "4_0": 1, "2_1": -1 } }, R);
  assert.deepStrictEqual({ ...bad.corrections }, { "2_2": 3 });
  assert.deepStrictEqual({ ...api.createTypingStats({ "2_2": 3 }, R).corrections }, {});
  assert.strictEqual("corrections" in api.serializeTypingStats(api.createTypingStats(null, R)), false);
});

test("Korrekturen: Modifier dazwischen ändern die Taste davor nicht, Rollen der Aktionen", () => {
  const s = api.createTypingStats(null, R);
  api.recordKeyPress(s, 2, 2, 0, undefined, api.keyPressRole("KEY_S"));
  api.recordKeyPress(s, 4, 5, 10, undefined, api.keyPressRole("KEY_LEFT_SHIFT"));
  api.recordKeyPress(s, 0, 5, 20, undefined, api.keyPressRole("KEY_BACKSPACE"));
  assert.deepStrictEqual({ ...s.corrections }, { "2_2": 1 });
  assert.strictEqual(api.keyPressRole("KEY_BACKSPACE"), "backspace");
  for (const t of ["NONE", "KEY_LEFT_GUI", "MO_1", "TG_2", "LAYER_UP", "OSL_1", "OSM_LSHIFT", "HOST_1"]) {
    assert.strictEqual(api.keyPressRole(t), "silent", t);
  }
  for (const t of ["KEY_A", "KEY_SPACE", "KEY_RETURN", "PAIR_0", "MACRO_0"]) assert.strictEqual(api.keyPressRole(t), "typed", t);
});

test("Korrekturen: gespeicherter Wert über der Anschlagzahl wird auf 100 % begrenzt", () => {
  const s = api.createTypingStats({ "2_2": 5, corrections: { "2_2": 9 } }, R);
  assert.strictEqual(api.correctionShares(s).shares["2_2"], 1);
});

test("serial.js: Backspace nach KEY_PRESS und SPLIT_KEY zählt als Korrektur der Taste davor", () => {
  const s = serialLineHarness();
  s.setTap("R", 0, 0, 5, "KEY_BACKSPACE");
  s.setTap("L", 0, 0, 5, "KEY_BACKSPACE");
  s.handle('KEY_PRESS:{"r":2,"c":1,"key":"a","layer":0}', "R", "usb");
  s.handle('KEY_PRESS:{"r":2,"c":2,"key":"s","layer":0}', "R", "usb");
  s.handle('KEY_PRESS:{"r":0,"c":5,"key":"Backspace","layer":0}', "R", "usb");
  assert.deepStrictEqual({ ...s.corrections("R") }, { "2_2": 1 });
  // Ebene 3 ohne Belegung an R0C5 fällt auf Backspace der Ebene 0 zurück
  s.setTap("R", 3, 0, 5, "NONE");
  s.handle('KEY_PRESS:{"r":2,"c":3,"key":"d","layer":0}', "R", "usb");
  s.handle('KEY_PRESS:{"r":0,"c":5,"key":"","layer":3}', "R", "usb");
  assert.deepStrictEqual({ ...s.corrections("R") }, { "2_2": 1, "2_3": 1 });
  s.handle('SPLIT_KEY:{"r":2,"c":1,"pressed":1,"layer":0}', "R", "usb");
  s.handle('SPLIT_KEY:{"r":0,"c":5,"pressed":1,"layer":0}', "R", "usb");
  assert.deepStrictEqual({ ...s.corrections("L") }, { "2_1": 1 });
  assert.deepStrictEqual({ ...s.corrections("R") }, { "2_2": 1, "2_3": 1 });
});

test("heatmap.js: heatmapLayer folgt der angezeigten Ebene nur im Modus pro Ebene", () => {
  const h = {};
  vm.createContext(h);
  vm.runInContext(`var heatmapPerLayer = false, activeLayerIndex = 4;
${section("js/heatmap.js", "// Ebene der Heatmap", "function applyHeatClass")}
this.layer = () => heatmapLayer();
this.set = (p, l) => { heatmapPerLayer = p; activeLayerIndex = l; };`, h);
  assert.strictEqual(h.layer(), null);
  h.set(true, 4);
  assert.strictEqual(h.layer(), 4);
  h.set(true, 0);
  assert.strictEqual(h.layer(), 0);
});

// Diff-Ablauf aus js/config-sync.js mit Fake-Timern, Fake-Gerät und Fake-Dialog
function diffFlowHarness() {
  const timers = [];
  const calls = { sent: [], writes: 0, dialogs: [], confirms: 0, toasts: [] };
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const h = {
    NUM_LAYERS: 8, MATRIX_DATA_FIELDS: api.MATRIX_DATA_FIELDS, captureMatrixData: api.captureMatrixData,
    diffSettings: api.diffSettings, isDeviceSnapshotComplete: api.isDeviceSnapshotComplete, createDeviceSnapshot: api.createDeviceSnapshot, captureListLine: api.captureListLine, captureChordalExLine: api.captureChordalExLine,
    diffKeymap: api.diffKeymap, SIDE_PROFILES: api.SIDE_PROFILES, isAutoSyncing: false,
    isConnectingBle: false, side: "R", via: "usb", alsoBle: false, sendOk: true, confirmAnswer: false, dialogAnswer: null,
    Dactyl: { routeCommand: (side, conn) => conn.bleUp && conn.bleSide === side ? "ble"
      : (conn.serialUp && conn.serialSide === side ? "usb" : null) },
    setTimeout: (fn, ms) => { timers.push({ fn, ms, done: false }); return timers.length - 1; },
    clearTimeout: (id) => { if (timers[id]) timers[id].done = true; },
    showToast: (t) => calls.toasts.push(t), configFor: () => cfg
  };
  vm.createContext(h);
  vm.runInContext(`function waitForStaleLayoutRead() { return Promise.resolve(); }
    function hideStaleLayoutBanner() {}
    ${section("js/config-sync.js", "const DEVICE_SNAPSHOT_TIMEOUT_MS", "// Zeigt den Diff im Dialog")}
    ${section("js/config-sync.js", '// "Auf ESP32 speichern": zuerst', "// Ersetzt die Config der bearbeiteten Hälfte durch die vom Gerät gelesene")}
    ${section("js/config-sync.js", "// One-Shot-Auto-Sync (BLE-Verbindung", "// =============================================================================\n// Layout-Diff")}
    ${section("js/config-sync.js", "// Nach einer BLE- oder USB-Trennung", "// Zeigt den Diff im Dialog")}
    this.capture = captureDeviceSnapshotLine; this.write = writeConfigWithDiff; this.load = readConfigFromESP32;
    this.autoSync = runAutoSync; this.abort = abortDeviceSnapshotReadIfDisconnected;
    this.state = () => ({ read: deviceSnapshotRead, active: diffFlowActive });`, h);
  h.bleConfigChar = null; h.serialPort = null;
  h.editSide = "R"; h.applied = []; h.buildConfigFromSnapshot = api.buildConfigFromSnapshot; h.applyDeviceConfig = (config) => h.applied.push(config);
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
  h.showSyncDiffDialog = (profile, diff, options) => { calls.dialogs.push(diff); calls.options = options; return new Promise(r => { h.dialogAnswer = r; }); };
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
    for (const line of listLines(c)) h.capture(line, side);
    return h.capture("CONFIG_SYNC_DONE", side);
  };
  return { h, calls, cfg, fire, flush, sendDevice };
}

asyncTests.push(["Layout-Diff: Listenzeilen gehen in den Snapshot; späte Listenzeilen nach dem Timeout werden verworfen", async () => {
  const { h, calls, cfg, flush, sendDevice } = diffFlowHarness();
  cfg.macros = [{ name: "M", steps: [{ type: "tap", code: "KEY_A" }] }];
  const run = h.write();
  await flush();
  assert.strictEqual(sendDevice("R", cfg), true);
  await flush();
  assert.strictEqual(calls.dialogs.length, 1);
  assert.strictEqual(calls.dialogs[0].lists.state, "complete");
  h.dialogAnswer(false);
  await run;

  // Zweiter Ablauf: Timeout, dann kommen Listenzeilen verspätet. Sie werden verbraucht und ändern nichts.
  const second = diffFlowHarness();
  const run2 = second.h.write();
  await second.flush();
  second.fire(8000);
  await second.flush();
  assert.strictEqual(second.h.capture("COMBO_COUNT:1", "R"), true);
  assert.strictEqual(second.h.capture('COMBO_DATA:{"o":0,"e":[[0,0,0,1,0,4]]}', "R"), true);
  assert.strictEqual(second.h.capture("MACRO_DATA:{}", "R"), true);
  assert.strictEqual(second.h.capture("CONFIG_SYNC_DONE", "R"), true);
  await run2;
  assert.strictEqual(second.calls.writes, 0);
}]);

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

asyncTests.push(["Komplettes Laden: Wechsel der bearbeiteten Hälfte bei offenem Dialog übernimmt nichts", async () => {
  const { h, calls, cfg, flush, sendDevice } = diffFlowHarness();
  const run = h.load();
  await flush();
  h.capture('DEVICE_INFO:{"side":"R"}', "R");
  sendDevice("R", JSON.parse(JSON.stringify(cfg)));
  await flush();
  assert.strictEqual(calls.dialogs.length, 1);
  h.editSide = "L";
  h.dialogAnswer(true);
  await run;
  assert.strictEqual(h.applied.length, 0);
  assert.ok(calls.toasts.some(t => t.includes("Hälfte hat gewechselt")));
  assert.strictEqual(h.state().active, false);
}]);

asyncTests.push(["Komplettes Laden: Diff, Bestätigung übernimmt die Gerätedaten; Abbrechen ändert nichts", async () => {
  const { h, calls, cfg, flush, sendDevice } = diffFlowHarness();
  const device = JSON.parse(JSON.stringify(cfg));
  device.keyPairs = [{ first: "KEY_A", second: "KEY_B" }];
  device.layerNames[1] = "Gerät";
  const run = h.load();
  await flush();
  assert.deepStrictEqual(calls.sent, ["R:GET_INFO", "R:GET_CONFIG"]);
  // DEVICE_INFO geht in den Snapshot und weiter an den normalen Handler (false = nicht verbraucht)
  assert.strictEqual(h.capture('DEVICE_INFO:{"side":"R","debounce_ms":11}', "R"), false);
  sendDevice("R", device);
  await flush();
  assert.strictEqual(calls.dialogs.length, 1);
  assert.strictEqual(calls.dialogs[0].lists.pairs.length, 1);
  assert.strictEqual(calls.dialogs[0].names.length, 1);
  assert.strictEqual(h.applied.length, 0);
  // Der Dialog zeigt auch die geänderte Einstellung (Gerät 11 ms, lokal Standard)
  assert.ok(calls.options.settingsRows.some(r => r.where.includes("debounceMs") && r.device === "11"));
  h.dialogAnswer(true);
  await run;
  assert.strictEqual(h.applied.length, 1);
  assert.strictEqual(h.applied[0].layerNames[1], "Gerät");
  assert.strictEqual(h.applied[0].settings.debounceMs, 11);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(h.applied[0].keyPairs)), device.keyPairs);
  assert.strictEqual(calls.writes, 0);
  assert.strictEqual(h.state().active, false);

  const second = diffFlowHarness();
  const run2 = second.h.load();
  await second.flush();
  second.h.capture('DEVICE_INFO:{"side":"R"}', "R");
  second.sendDevice("R", device);
  await second.flush();
  second.h.dialogAnswer(false);
  await run2;
  assert.strictEqual(second.h.applied.length, 0);
}]);

asyncTests.push(["Komplettes Laden: eine wiederholte DEVICE_INFO-Zeile ersetzt die erste; eine späte nach dem Timeout verändert nichts", async () => {
  const { h, cfg, flush, sendDevice, fire, calls } = diffFlowHarness();
  const run = h.load();
  await flush();
  h.capture('DEVICE_INFO:{"side":"R","debounce_ms":11}', "R");
  h.capture('DEVICE_INFO:{"side":"R","debounce_ms":13}', "R");
  sendDevice("R", cfg);
  await flush();
  assert.ok(calls.options.settingsRows.some(r => r.where.includes("debounceMs") && r.device === "13"));
  h.dialogAnswer(false);
  await run;

  const t = diffFlowHarness();
  const run2 = t.h.load();
  await t.flush();
  t.fire(8000);
  await run2;
  // Späte Zeile: verbraucht wird nur die Datenzeile, die DEVICE_INFO geht an den Handler (serial.js hält sie zurück)
  assert.strictEqual(t.h.capture('DEVICE_INFO:{"side":"R","debounce_ms":15}', "R"), false);
  assert.strictEqual(t.h.applied.length, 0);
}]);

asyncTests.push(["Komplettes Laden: ohne DEVICE_INFO, bei Sendefehler von GET_INFO und beim Wechsel der Hälfte wird nichts übernommen", async () => {
  // Gültiger GET_CONFIG-Strom, aber keine DEVICE_INFO-Antwort
  const a = diffFlowHarness();
  const alerts = [];
  a.h.alert = (m) => alerts.push(m);
  const runA = a.h.load();
  await a.flush();
  a.sendDevice("R", a.cfg);
  await a.flush();
  await runA;
  assert.strictEqual(a.calls.dialogs.length, 0);
  assert.strictEqual(a.h.applied.length, 0);
  assert.ok(alerts[0].includes("DEVICE_INFO"));

  // GET_INFO lässt sich nicht senden: kein GET_CONFIG, nichts übernommen
  const b = diffFlowHarness();
  const balerts = [];
  b.h.alert = (m) => balerts.push(m);
  b.h.sendOk = false;
  await b.h.load();
  assert.deepStrictEqual(b.calls.sent, ["R:GET_INFO"]);
  assert.strictEqual(b.h.applied.length, 0);
  assert.strictEqual(balerts.length, 1);
  assert.strictEqual(b.h.state().active, false);

  // Verbunden ist die andere Hälfte: keine Abfrage
  const c = diffFlowHarness();
  c.h.side = "L";
  await c.h.load();
  assert.deepStrictEqual(c.calls.sent, []);
  assert.strictEqual(c.h.applied.length, 0);

  // Wechsel der bearbeiteten Hälfte im offenen Dialog: nichts übernommen, eigener Hinweis
  const d = diffFlowHarness();
  const runD = d.h.load();
  await d.flush();
  d.h.capture('DEVICE_INFO:{"side":"R"}', "R");
  d.sendDevice("R", d.cfg);
  await d.flush();
  d.h.editSide = "L";
  d.h.dialogAnswer(true);
  await runD;
  assert.strictEqual(d.h.applied.length, 0);
  assert.ok(d.calls.toasts.some(x => x.includes("gewechselt")));
}]);

test("Komplettes Laden: applyDeviceConfig ersetzt die Config, merkt sie als Snapshot vor und macht sie rückgängig", () => {
  const cfgOld = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const cfgNew = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfgNew.layerNames[2] = "Gerät";
  const changes = [];
  const env = { JSON, currentConfig: cfgOld, selectedKey: null, changes, SIDE_PROFILES: api.SIDE_PROFILES,
    applySettingsToInputs() {}, renderLayerButtons() {}, renderMatrix() {}, renderCombosTable() {}, updateInspector() {}, saveConfigToServer() {},
    markPendingSync: (c) => changes.push(c) };
  vm.createContext(env);
  vm.runInContext(`${section("js/config-sync.js", "// Ersetzt die Config der bearbeiteten Hälfte", "\n}\n") }\n}
    this.apply = applyDeviceConfig; this.cur = () => currentConfig;`, env);
  env.apply(cfgNew, R);
  assert.strictEqual(env.cur().layerNames[2], "Gerät");
  assert.strictEqual(changes.length, 1);
  assert.strictEqual(changes[0].snapshot, true);
  assert.strictEqual(changes[0].pairs, true);
  assert.strictEqual(changes[0].macros, true);
  changes[0].revert();
  assert.notStrictEqual(env.cur().layerNames[2], "Gerät");
});

test("Komplettes Laden: diffSettings listet geänderte Einstellungen und Tri-Layer-Regeln", () => {
  const a = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R).settings;
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.diffSettings(a, { ...a }))), []);
  const b = { ...a, debounceMs: a.debounceMs + 1, capsLed: 1, triLayers: [{ a: 1, b: 2, target: 3 }] };
  const rows = JSON.parse(JSON.stringify(api.diffSettings(b, a)));
  assert.deepStrictEqual(rows.map(r => r.where), ["Einstellung debounceMs:", "Einstellung triLayers:", "Einstellung capsLed:"].sort((x, y) => rows.findIndex(r => r.where === x) - rows.findIndex(r => r.where === y)));
  assert.strictEqual(rows.length, 3);
  assert.strictEqual(rows.find(r => r.where.includes("debounceMs")).device, String(b.debounceMs));
});

test("Komplettes Laden: Überschreibungen und Combo-Namen bleiben lokal, wenn das Gerät sie nicht meldet oder gleich hat", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.keyOverrides = [{ mods: ["shift"], key: "KEY_BACKSPACE", replacement: "KEY_DELETE" }];
  const device = JSON.parse(JSON.stringify(cfg));
  delete device.keyOverrides;           // Master vor Stand 7: kein OVERRIDE_COUNT
  const built = api.buildConfigFromSnapshot(deviceSnapshotFor(device, { side: "R" }), cfg, R);
  assert.strictEqual(built.error, undefined);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(built.config.keyOverrides)), JSON.parse(JSON.stringify(cfg.keyOverrides)));
  // Gleiche Combo: Id und Name bleiben; geänderte Combo: neuer Name
  cfg.combos[0].name = "Mein Combo";
  const same = api.buildConfigFromSnapshot(deviceSnapshotFor(cfg, { side: "R" }), cfg, R);
  assert.strictEqual(same.config.combos[0].name, "Mein Combo");
  assert.strictEqual(same.config.combos[0].id, cfg.combos[0].id);
  const other = JSON.parse(JSON.stringify(cfg));
  other.combos[0].action = "KEY_Q";
  const changed = api.buildConfigFromSnapshot(deviceSnapshotFor(other, { side: "R" }), cfg, R);
  assert.notStrictEqual(changed.config.combos[0].name, "Mein Combo");
});

asyncTests.push(["Komplettes Laden: während einer Übertragung startet keine Abfrage", async () => {
  const { h, calls } = diffFlowHarness();
  h.isAutoSyncing = true;
  await h.load();
  assert.deepStrictEqual(calls.sent, []);
  assert.strictEqual(h.state().active, false);
}]);

test("Komplettes Laden: ein lokaler Makro-Name bleibt bei gleichen Schritten, sonst gilt der Standardname", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.macros = [{ name: "Gruß", steps: [{ type: "tap", code: "KEY_A" }] }, { name: "Alt", steps: [{ type: "tap", code: "KEY_B" }] }];
  const device = JSON.parse(JSON.stringify(cfg));
  device.macros[1].steps = [{ type: "tap", code: "KEY_C" }];
  const built = api.buildConfigFromSnapshot(deviceSnapshotFor(device, { side: "R" }), cfg, R);
  assert.strictEqual(built.error, undefined);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(built.config.macros.map(m => m.name))), ["Gruß", "Makro 1"]);
});

asyncTests.push(["Komplettes Laden: ungültige Listenzeile oder Timeout übernimmt nichts", async () => {
  const { h, calls, cfg, flush, sendDevice } = diffFlowHarness();
  const alerts = [];
  h.alert = (m) => alerts.push(m);
  const device = JSON.parse(JSON.stringify(cfg));
  device.keyPairs = [{ first: "KEY_A", second: "KEY_B" }];
  const run = h.load();
  await flush();
  // Eine ungültige Paar-Zeile mitten im Strom: der Snapshot ist unvollständig
  h.capture("PAIR_COUNT:1", "R");
  h.capture('PAIR_DATA:{"o":0,"e":[[1]]}', "R");
  sendDevice("R", device);
  await flush();
  await run;
  assert.strictEqual(calls.dialogs.length, 0);
  assert.strictEqual(h.applied.length, 0);
  assert.strictEqual(alerts.length, 1);
  assert.ok(alerts[0].includes("Nichts geändert"));
  assert.strictEqual(h.state().active, false);

  // Timeout: nichts übernommen, späte Zeilen werden verworfen
  const t = diffFlowHarness();
  const talerts = [];
  t.h.alert = (m) => talerts.push(m);
  const run2 = t.h.load();
  await t.flush();
  t.fire(8000);
  await run2;
  assert.strictEqual(t.h.applied.length, 0);
  assert.strictEqual(talerts.length, 1);
  assert.strictEqual(t.h.capture("CONFIG_SYNC_DONE", "R"), true);
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
    function waitForStaleLayoutRead() { return Promise.resolve(); }
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
  vm.runInContext(`function waitForStaleLayoutRead() { return Promise.resolve(); }
    function hideStaleLayoutBanner() {}
    ${section("js/config-sync.js", "async function writeConfigToESP32", "  const cfg = configFor(side);")}
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
  // Wiederholen, solange die Taste gehalten wird: ADD_MACRO 1, normalizeConfig behält das Flag
  const rep = api.normalizeConfig({ layers: [[[]]], macros: [
    { name: "R", steps: [{ type: "tap", code: "a" }], repeat: true },
    { name: "S", steps: [{ type: "tap", code: "a" }], repeat: "ja" }] }, R);
  assert.strictEqual(rep.macros[0].repeat, true);
  assert.ok(!("repeat" in rep.macros[1]));
  assert.strictEqual(api.macroCommands(rep.macros[0])[0], "ADD_MACRO 1");
  assert.strictEqual(api.macroCommands(rep.macros[1])[0], "ADD_MACRO");
  // Ein ungültiger Flag-Wert gilt als "kein Wiederholen" und lässt die Schritte stehen
  assert.strictEqual(api.isValidMacro({ steps: [], repeat: 1 }), true);
  assert.strictEqual(rep.macros[1].steps.length, 1);
  // Das Gerät meldet das Flag in MACRO_DATA ("r":1)
  const snapRep = api.createDeviceSnapshot();
  api.captureListLine(snapRep, "MACRO_COUNT:1");
  assert.ok(api.captureListLine(snapRep, 'MACRO_DATA:{"i":0,"n":1,"o":0,"r":1,"s":[[1,97,0]]}'));
  assert.strictEqual(snapRep.listsBroken, false);
  assert.strictEqual(snapRep.macroRep[0], true);
  const snapBad = api.createDeviceSnapshot();
  api.captureListLine(snapBad, "MACRO_COUNT:1");
  api.captureListLine(snapBad, 'MACRO_DATA:{"i":0,"n":1,"o":0,"r":2,"s":[[1,97,0]]}');
  assert.strictEqual(snapBad.listsBroken, true);
});

test("Systemtasten und Rad links/rechts: Codes passen zur Firmware", () => {
  const common = read("firmware/dactyl_right/DactylCommon.h");
  const fw = name => Number(new RegExp(`#define ACT_${name}\\s+(0x[0-9A-F]+)`).exec(common)[1]);
  const expected = {
    MEDIA_BRIGHTNESS_UP: 0x128, MEDIA_BRIGHTNESS_DOWN: 0x129, MEDIA_MISSION_CONTROL: 0x12A, MEDIA_LAUNCHPAD: 0x12B,
    MOUSE_WHEEL_LEFT: 0x139, MOUSE_WHEEL_RIGHT: 0x13A
  };
  for (const [code, num] of Object.entries(expected)) {
    assert.strictEqual(api.actionCodeToNumeric(code), num, code);
    assert.strictEqual(fw(code), num, code);
    assert.strictEqual(api.findDefinitionByCode(num).tap, code, code);
    assert.ok(api.KEYCODES.flatMap(g => g.keys).some(k => k.code === code), `${code} fehlt in der Auswahl`);
    assert.strictEqual(api.actionCodeToNumeric(`ACT_${code}`), code.startsWith("MOUSE") ? num : 0);
  }
  // Die Tasten kommen in der Server-Tabelle vor (Codegen)
  const py = read("server.py");
  for (const code of Object.keys(expected)) assert.ok(py.includes(`"${code}": "ACT_${code}"`), code);
  // Die Rad-Tasten liegen im Pan-Bereich der Firmware, die Systemtasten im Consumer-Bereich
  assert.strictEqual(api.isMouseMoveCode("MOUSE_WHEEL_LEFT"), false);
});

test("Tastenpaar: Systemtasten und Pan sind erlaubte Mitglieder", () => {
  for (const ok of ["MEDIA_BRIGHTNESS_UP", "MEDIA_BRIGHTNESS_DOWN", "MEDIA_MISSION_CONTROL", "MEDIA_LAUNCHPAD",
                    "MOUSE_WHEEL_LEFT", "MOUSE_WHEEL_RIGHT"]) {
    assert.ok(api.isKeyPairMember(ok), ok);
  }
  assert.ok(!api.isKeyPairMember("MOUSE_UP"));
  const cfg = api.normalizeConfig({ layers: [[[{ tap: "PAIR_0" }]]], keyPairs: [
    { first: "KEY_LEFT_SHIFT", second: "MEDIA_MISSION_CONTROL" }, { first: "MEDIA_LAUNCHPAD", second: "MOUSE_WHEEL_RIGHT" }
  ] }, R);
  assert.strictEqual(cfg.keyPairs.length, 2);
  assert.strictEqual(cfg.keyPairs[1].second, "MOUSE_WHEEL_RIGHT");
});

test("Makros: Systemtasten sind Schritte (code 0, Aktion in ms), Maus und Pan nicht", () => {
  for (const code of ["MEDIA_BRIGHTNESS_UP", "MEDIA_MISSION_CONTROL", "MEDIA_LAUNCHPAD", "MAC_GLOBE", "MEDIA_MUTE"]) {
    for (const type of ["tap", "down", "up"]) assert.ok(api.isValidMacroStep({ type, code }), `${type} ${code}`);
  }
  for (const code of ["MOUSE_LEFT", "MOUSE_WHEEL_LEFT", "MOUSE_WHEEL_UP", "MOUSE_UP", "PAIR_0", "MACRO_0", "MO_1", "NONE"]) {
    assert.ok(!api.isValidMacroStep({ type: "tap", code }), code);
  }
  const macro = { name: "m", steps: [
    { type: "tap", code: "MEDIA_MISSION_CONTROL" }, { type: "down", code: "MEDIA_BRIGHTNESS_UP" },
    { type: "pause", ms: 20 }, { type: "up", code: "MEDIA_BRIGHTNESS_UP" }, { type: "tap", code: "KEY_A" }] };
  assert.ok(api.isValidMacro(macro));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.macroCommands(macro))), [
    "ADD_MACRO", "ADD_MACRO_STEP 1 0 298", "ADD_MACRO_STEP 2 0 296", "ADD_MACRO_STEP 4 0 20",
    "ADD_MACRO_STEP 3 0 296", "ADD_MACRO_STEP 1 97 0"]);
  // Rücklesen: aus code 0 und ms wird wieder die Taste (Hin- und Rückweg über GET_CONFIG)
  const source = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  source.macros = [macro];
  const snap = deviceSnapshotFor(source, {
    name: "Dactyl", debounce_ms: 5, combo_timeout_ms: 50, tapping_term_ms: 200, hold_tap_mode: 0, quick_tap_ms: 0,
    require_prior_idle_ms: 0, chordal_hold: 0, caps_led: 0, standby_timeout: 5, sleep_timeout: 60, tri_layer: []
  });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(snap.macros[0])),
    [[1, 0, 298], [2, 0, 296], [4, 0, 20], [3, 0, 296], [1, 97, 0]]);
  const built = api.buildConfigFromSnapshot(snap, source, R);
  assert.strictEqual(built.error, undefined);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(built.config.macros[0].steps)), macro.steps);
  // Die Gerätezeile MACRO_DATA mit code 0 und einer Aktion in ms ist gültig
  const one = api.createDeviceSnapshot();
  assert.ok(api.captureListLine(one, "MACRO_COUNT:1"));
  assert.ok(api.captureListLine(one, 'MACRO_DATA:{"i":0,"n":1,"o":0,"s":[[1,0,298]]}'));
  assert.strictEqual(one.listsBroken, false);
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
  cfg.keyOverrides = [
    { mods: ["shift"], key: "KEY_BACKSPACE", replacement: "KEY_DELETE" },
    { mods: ["ctrl", "alt"], key: "KEY_A", replacement: "KEY_B", layerMask: 1 }
  ];
  cfg.leaderSequences = [
    { keys: ["KEY_A", "KEY_B"], action: "MACRO_0" }, { keys: ["KEY_C"], action: "PAIR_0" }, { keys: ["KEY_D"], action: "KEY_Z" }
  ];
  cfg.altRepeats = [{ key: "KEY_E", alt: "KEY_U" }, { key: "KEY_I", alt: "KEY_O" }];
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
    console: { error() {}, warn() {} }, sent, reply, delays, held, AbortController,
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

asyncTests.push(["Sync: eigene Tapping-Terme gehen als SET_KT nach den Tasten, alte Firmware wird übersprungen", async () => {
  const setTerm = w => { w.cfgRef.layers[0][2][1] = { label: "J", tap: "KEY_J", hold: "KEY_LEFT_CTRL", dtap: "NONE", tapTerm: 300 }; };
  const a = fullSyncHarness(okReply);
  setTerm(a.w);
  await a.w.write();
  const kt = a.sent.filter(c => c.startsWith("SET_KT "));
  assert.deepStrictEqual(kt, ["SET_KT 0 2 1 300"]);
  assert.ok(a.sent.indexOf("CLEAR_TAP_TERMS") < a.sent.indexOf("SET_KT 0 2 1 300"));
  assert.ok(a.sent.indexOf("SET_KT 0 2 1 300") < a.sent.indexOf("SAVE_NVS"));
  assert.ok(a.sent.indexOf("SET_K 0 2 1 106 128 0") < a.sent.indexOf("SET_KT 0 2 1 300"));

  // Ohne eigene Werte: CLEAR_TAP_TERMS (löscht alte Werte des Geräts), kein SET_KT
  const b = fullSyncHarness(okReply);
  await b.w.write();
  assert.ok(b.sent.includes("CLEAR_TAP_TERMS"));
  assert.strictEqual(b.sent.filter(c => c.startsWith("SET_KT ")).length, 0);

  // Firmware davor: ERR UNKNOWN. Mit Werten erscheint der Flash-Hinweis, ohne Werte bleibt der Sync still.
  const oldFw = cmd => cmd.startsWith("SET_K ") ? null : (cmd === "CLEAR_TAP_TERMS" ? `ERR UNKNOWN ${cmd}` : `OK ${cmd}`);
  const c = fullSyncHarness(oldFw);
  setTerm(c.w);
  await c.w.write();
  assert.strictEqual(c.sent.filter(x => x.startsWith("SET_KT ")).length, 0);
  assert.ok(c.toasts.some(t => t.includes("CLEAR_TAP_TERMS")));
  assert.ok(c.sent.includes("SAVE_MACROS"));
  const d = fullSyncHarness(oldFw);
  await d.w.write();
  assert.ok(!d.toasts.some(t => t.includes("CLEAR_TAP_TERMS")));
  assert.ok(d.sent.includes("SAVE_MACROS"));
}]);

asyncTests.push(["Sync: legt vor dem ersten Befehl ein Backup an, ein Fehler hält den Sync nicht auf", async () => {
  for (const failure of [null, "http", "network"]) {
    const { w, sent, toasts } = fullSyncHarness(okReply);
    const backups = [];
    w.fetch = async (url, opts) => {
      backups.push({ url, sentBefore: sent.length, body: JSON.parse(opts.body), method: opts.method });
      if (failure === "network") throw new Error("offline");
      return failure === "http"
        ? { ok: false, status: 500, json: async () => ({ error: "Platte voll" }) }
        : { ok: true, status: 200, json: async () => ({ success: true, created: true }) };
    };
    await w.write();
    assert.strictEqual(backups.length, 1);
    assert.strictEqual(backups[0].url, "/api/backups?side=R");
    assert.strictEqual(backups[0].method, "POST");
    assert.strictEqual(backups[0].sentBefore, 0, "Backup vor dem ersten Befehl");
    assert.ok(Array.isArray(backups[0].body.layers));
    assert.ok(sent.includes("SAVE_MACROS"), "der Sync läuft weiter");
    if (failure) assert.ok(toasts.some(t => t.includes("Backup vor dem Sync fehlgeschlagen")), failure);
    else assert.ok(!toasts.some(t => t.includes("Backup")));
  }
}]);

asyncTests.push(["Sync: Backup-Warnung einmal pro Fehlerserie, hängender Server bricht ab", async () => {
  const { w, sent, toasts, delays } = fullSyncHarness(okReply);
  let mode = "fail";
  const signals = [];
  w.fetch = async (url, opts) => {
    signals.push(opts.signal);
    if (mode === "ok") return { ok: true, status: 200, json: async () => ({ success: true }) };
    throw new Error("offline");
  };
  const warnings = () => toasts.filter(t => t.includes("Backup vor dem Sync fehlgeschlagen")).length;
  await w.write();
  await w.write();
  assert.strictEqual(warnings(), 1, "zweiter Fehler in Folge: keine weitere Warnung");
  mode = "ok";
  await w.write();
  mode = "fail";
  await w.write();
  assert.strictEqual(warnings(), 2, "nach einem Erfolg warnt der nächste Fehler wieder");
  // Jeder Aufruf trägt ein Abbruchsignal mit Zeitlimit
  assert.ok(signals.every(sig => sig && typeof sig.aborted === "boolean"));
  assert.ok(delays.includes(vm.runInContext("BACKUP_TIMEOUT_MS", w)));
  // Abbruch nach dem Zeitlimit: der Sync läuft weiter
  const hung = fullSyncHarness(okReply, vm.runInContext("BACKUP_TIMEOUT_MS", w));
  hung.w.fetch = (url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
  const run = hung.w.write();
  await new Promise(r => setImmediate(r));
  assert.strictEqual(hung.sent.length, 0, "wartet auf das Backup");
  assert.strictEqual(hung.held.length, 1);
  hung.held[0].fn();
  await run;
  assert.ok(hung.toasts.some(t => t.includes("Server antwortet nicht")));
  assert.ok(hung.sent.includes("SAVE_MACROS"));
}]);

asyncTests.push(["Sync: Schrittzahl passt zu den gesendeten Schritten", async () => {
  const { w, progress, sent } = fullSyncHarness(okReply);
  await w.write();
  assert.ok(sent.includes("SAVE_PAIRS"));
  // Breite: 2 % beim Start, dann ein Wert pro Schritt, am Ende 0 % (Ausblenden). Ohne Kappung: zu viele
  // Schritte enden unter 100 %, zu wenige laufen darüber
  assert.strictEqual(progress[0], 2);
  assert.strictEqual(progress.at(-1), 0);
  const steps = progress.slice(1, -1);
  const settings = sent.filter(c => /^(SET_(STANDBY|SLEEP|DEV_NAME|DEBOUNCE|COMBO_TIMEOUT|TAPPING_TERM|HOLD_MODE|QUICK_TAP|PRIOR_IDLE|CHORDAL_HOLD|CHORDAL_EX|TRI_LAYER|CAPS_LED|LEADER_TIMEOUT|LAYER_TIMEOUT|AUTO_MOUSE_LAYER|MOUSE_TIMEOUT|ONESHOT_TIMEOUT|AUTO_SHIFT|AUTO_SHIFT_TERM|RETRO_TAP|NUM_WORD_LAYER|BOOT_LAYER) |CLEAR_TAP_TERMS$|CLEAR_HOLD_FLAVORS$|CLEAR_QUICK_TAPS$)/.test(c)).length;
  const names = sent.filter(c => c.startsWith("SET_NAME ")).length;
  const keys = sent.filter(c => c.startsWith("SET_K ")).length;
  const combos = sent.filter(c => c.startsWith("ADD_COMBO ")).length;
  const macros = sent.filter(c => c === "ADD_MACRO").length;
  const overrides = sent.filter(c => c.startsWith("ADD_OVERRIDE ")).length;
  assert.strictEqual(macros, 2);
  assert.strictEqual(overrides, 2);
  const leader = sent.filter(c => c.startsWith("ADD_LEADER ")).length;
  assert.strictEqual(leader, 3);
  assert.ok(sent.includes("CLEAR_LEADER") && sent.includes("SAVE_LEADER") && sent.includes("ADD_LEADER 368 97 98") && sent.includes("ADD_LEADER 320 99"));
  assert.ok(sent.some(c => c === "SET_LEADER_TIMEOUT 1000"));
  const altRepeats = sent.filter(c => c.startsWith("ADD_ALT_REPEAT ")).length;
  assert.strictEqual(altRepeats, 2);
  assert.ok(sent.includes("CLEAR_ALT_REPEATS") && sent.includes("SAVE_ALT_REPEATS") && sent.includes("ADD_ALT_REPEAT 101 117") && sent.includes("ADD_ALT_REPEAT 105 111"));
  // SAVE_NVS, SAVE_COMBOS, die Tastenpaar-Phase, je Überschreibung ein Schritt und SAVE_OVERRIDES,
  // je Makro ein Schritt und SAVE_MACROS, Leader-Phase, Alt-Repeat-Phase
  assert.strictEqual(steps.length, settings + names + keys + 1 + combos + 1 + 1 + overrides + 1 + macros + 1 + leader + 1 + altRepeats + 1);
  assert.strictEqual(steps.at(-1), 100);
  assert.ok(steps.every(p => p <= 100), `Fortschritt über 100 %: ${Math.max(...steps)}`);
}]);

test("Tapping-Term je Taste: keyTapTerm, normalizeKeyCell, GET_CONFIG-Zeile und Diff", () => {
  // Nur mit Halte- oder Doppel-Tipp-Aktion (mit Tap) und im Bereich 100..500 wirksam
  assert.strictEqual(api.keyTapTerm({ tap: "KEY_J", hold: "KEY_LEFT_CTRL", tapTerm: 300 }), 300);
  assert.strictEqual(api.keyTapTerm({ tap: "KEY_J", dtap: "KEY_ESC", tapTerm: 100 }), 100);
  assert.strictEqual(api.keyTapTerm({ tap: "KEY_J", tapTerm: 300 }), 0);
  assert.strictEqual(api.keyTapTerm({ tap: "KEY_J", hold: "KEY_LEFT_CTRL", tapTerm: 99 }), 0);
  assert.strictEqual(api.keyTapTerm({ tap: "KEY_J", hold: "KEY_LEFT_CTRL", tapTerm: 501 }), 0);
  assert.strictEqual(api.keyTapTerm({ tap: "KEY_J", hold: "KEY_LEFT_CTRL", tapTerm: "300" }), 0);
  assert.strictEqual(api.keyTapTerm("KEY_J"), 0);
  assert.strictEqual(api.normalizeKeyCell({ label: "J", tap: "KEY_J", hold: "KEY_LEFT_CTRL", tapTerm: 300 }).tapTerm, 300);
  assert.ok(!("tapTerm" in api.normalizeKeyCell({ label: "J", tap: "KEY_J", tapTerm: 5000 })));
  assert.ok(!("tapTerm" in api.normalizeKeyCell({ label: "J", tap: "KEY_J" })));

  // TERM_DATA setzt das Feld und löscht es bei 0 oder ungültigem Wert
  assert.strictEqual(api.MATRIX_DATA_FIELDS["TERM_DATA:"], "term");
  const layers = [[[{ label: "J", tap: "KEY_J", hold: "KEY_LEFT_CTRL", dtap: "NONE" }, { label: "K", tap: "KEY_K", hold: "NONE", dtap: "NONE", tapTerm: 400 }]]];
  assert.ok(api.applyMatrixData(layers, "term", { l: 0, k: [[250, 0]] }));
  assert.strictEqual(layers[0][0][0].tapTerm, 250);
  assert.ok(!("tapTerm" in layers[0][0][1]));

  // Diff: gleiche Belegung, nur der Term unterscheidet sich
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.layers[0][2][1] = { label: "J", tap: "KEY_J", hold: "KEY_LEFT_CTRL", dtap: "NONE", tapTerm: 300 };
  const snap = snapshotOf(cfg);
  assert.strictEqual(api.diffKeymap(cfg, snap, R).keys.length, 0);   // ohne TERM_DATA kein Vergleich (Firmware davor)
  const zero = Array.from({ length: 6 }, () => Array(7).fill(0));
  for (let l = 0; l < 8; l++) assert.ok(api.captureMatrixData(snap, "term", { l, k: zero }));
  const diff = api.diffKeymap(cfg, snap, R);
  assert.strictEqual(diff.keys.length, 1);
  assert.deepStrictEqual([diff.keys[0].l, diff.keys[0].r, diff.keys[0].c], [0, 2, 1]);
  assert.ok(api.describeKeyActions(diff.keys[0].local).endsWith("· Term: 300 ms"));
  const same = zero.map(row => row.slice());
  same[2][1] = 300;
  assert.ok(api.captureMatrixData(snap, "term", { l: 0, k: same }));
  assert.strictEqual(api.diffKeymap(cfg, snap, R).keys.length, 0);
});

test("Sync: CLEAR_TAP_TERMS ist optional, hasKeyTapTerms erkennt eigene Werte", () => {
  const ctx = { NUM_LAYERS: 8, NUM_ROWS: 6, NUM_COLS: 7, clampSetting: api.clampSetting, normalizeTriLayers: api.normalizeTriLayers, sanitizeCommandText: api.sanitizeCommandText, chordalExNormalize: api.chordalExNormalize, keyTapTerm: api.keyTapTerm };
  vm.createContext(ctx);
  vm.runInContext(`${section("js/config-sync.js", "// Einstellungs-Befehle des vollen Syncs", "// One-Shot-Auto-Sync")}
    this.build = buildSettingCommands; this.has = hasKeyTapTerms;`, ctx);
  const cmds = JSON.parse(JSON.stringify(ctx.build({}, R)));
  assert.deepStrictEqual(cmds.at(-3), { cmd: "CLEAR_TAP_TERMS", ack: "CLEAR_TAP_TERMS", optional: true, quietUnknown: true });
  assert.strictEqual(ctx.has([[[{ tap: "KEY_J", hold: "KEY_B", tapTerm: 300 }]]]), true);
  assert.strictEqual(ctx.has([[[{ tap: "KEY_J", hold: "KEY_B" }]]]), false);
  assert.strictEqual(ctx.has([[[{ tap: "KEY_J", tapTerm: 300 }]]]), false);
  assert.strictEqual(ctx.has(undefined), false);
});

test("Hold-Tap-Variante je Taste: keyHoldFlavor, normalizeKeyCell, GET_CONFIG-Zeile, Diff und Sync-Befehl", () => {
  // Nur mit Halte- oder Doppel-Tipp-Aktion (mit Tap) und im Bereich 1..3 wirksam
  assert.strictEqual(api.HOLD_FLAVOR_MAX, 3);
  assert.strictEqual(api.keyHoldFlavor({ tap: "KEY_J", hold: "KEY_LEFT_CTRL", holdFlavor: 2 }), 2);
  assert.strictEqual(api.keyHoldFlavor({ tap: "KEY_J", dtap: "KEY_ESC", holdFlavor: 3 }), 3);
  assert.strictEqual(api.keyHoldFlavor({ tap: "KEY_J", holdFlavor: 2 }), 0);
  assert.strictEqual(api.keyHoldFlavor({ tap: "KEY_J", hold: "KEY_LEFT_CTRL", holdFlavor: 0 }), 0);
  assert.strictEqual(api.keyHoldFlavor({ tap: "KEY_J", hold: "KEY_LEFT_CTRL", holdFlavor: 4 }), 0);
  assert.strictEqual(api.keyHoldFlavor({ tap: "KEY_J", hold: "KEY_LEFT_CTRL", holdFlavor: "2" }), 0);
  assert.strictEqual(api.keyHoldFlavor("KEY_J"), 0);
  assert.strictEqual(api.normalizeKeyCell({ label: "J", tap: "KEY_J", hold: "KEY_LEFT_CTRL", holdFlavor: 2 }).holdFlavor, 2);
  assert.ok(!("holdFlavor" in api.normalizeKeyCell({ label: "J", tap: "KEY_J", holdFlavor: 9 })));
  assert.ok(!("holdFlavor" in api.normalizeKeyCell({ label: "J", tap: "KEY_J" })));

  // FLAVOR_DATA setzt das Feld und löscht es bei 0 oder ungültigem Wert
  assert.strictEqual(api.MATRIX_DATA_FIELDS["FLAVOR_DATA:"], "flavor");
  const layers = [[[{ label: "J", tap: "KEY_J", hold: "KEY_LEFT_CTRL", dtap: "NONE" }, { label: "K", tap: "KEY_K", hold: "NONE", dtap: "NONE", holdFlavor: 3 }]]];
  assert.ok(api.applyMatrixData(layers, "flavor", { l: 0, k: [[2, 0]] }));
  assert.strictEqual(layers[0][0][0].holdFlavor, 2);
  assert.ok(!("holdFlavor" in layers[0][0][1]));

  // Diff: gleiche Belegung, nur die Variante unterscheidet sich
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.layers[0][2][1] = { label: "J", tap: "KEY_J", hold: "KEY_LEFT_CTRL", dtap: "NONE", holdFlavor: 2 };
  const snap = snapshotOf(cfg);
  assert.strictEqual(api.diffKeymap(cfg, snap, R).keys.length, 0);   // ohne FLAVOR_DATA kein Vergleich (Firmware davor)
  const zero = Array.from({ length: 6 }, () => Array(7).fill(0));
  for (let l = 0; l < 8; l++) assert.ok(api.captureMatrixData(snap, "flavor", { l, k: zero }));
  const diff = api.diffKeymap(cfg, snap, R);
  assert.strictEqual(diff.keys.length, 1);
  assert.deepStrictEqual([diff.keys[0].l, diff.keys[0].r, diff.keys[0].c], [0, 2, 1]);
  assert.ok(api.describeKeyActions(diff.keys[0].local).endsWith("· Variante: Permissive Hold"));
  const same = zero.map(row => row.slice());
  same[2][1] = 2;
  assert.ok(api.captureMatrixData(snap, "flavor", { l: 0, k: same }));
  assert.strictEqual(api.diffKeymap(cfg, snap, R).keys.length, 0);

  // Sync-Befehl: optional "args", still bei fehlender Firmware-Unterstützung, hasKeyHoldFlavors erkennt eigene Werte
  const ctx = { NUM_LAYERS: 8, NUM_ROWS: 6, NUM_COLS: 7, clampSetting: api.clampSetting, normalizeTriLayers: api.normalizeTriLayers, sanitizeCommandText: api.sanitizeCommandText, chordalExNormalize: api.chordalExNormalize, keyHoldFlavor: api.keyHoldFlavor, keyTapTerm: api.keyTapTerm };
  vm.createContext(ctx);
  vm.runInContext(`${section("js/config-sync.js", "// Einstellungs-Befehle des vollen Syncs", "// One-Shot-Auto-Sync")}
    this.build = buildSettingCommands; this.has = hasKeyHoldFlavors;`, ctx);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.build({}, R).at(-2))), { cmd: "CLEAR_HOLD_FLAVORS", ack: "CLEAR_HOLD_FLAVORS", optional: "args", quietUnknown: true });
  assert.strictEqual(ctx.has([[[{ tap: "KEY_J", hold: "KEY_B", holdFlavor: 2 }]]]), true);
  assert.strictEqual(ctx.has([[[{ tap: "KEY_J", hold: "KEY_B" }]]]), false);
  assert.strictEqual(ctx.has([[[{ tap: "KEY_J", holdFlavor: 2 }]]]), false);
  assert.strictEqual(ctx.has(undefined), false);
});

test("Quick-Tap je Taste: keyQuickTap, normalizeKeyCell, QTAP_DATA, Diff und Sync-Befehl", () => {
  const hold = { tap: "KEY_J", hold: "KEY_LEFT_CTRL" };
  assert.strictEqual(api.keyQuickTap({ ...hold, quickTap: 150 }), 150);
  assert.strictEqual(api.keyQuickTap({ ...hold, quickTap: 0 }), 1);          // 0 = aus -> Firmwarewert 1
  assert.strictEqual(api.keyQuickTap({ ...hold, quickTap: 9 }), 0);
  assert.strictEqual(api.keyQuickTap({ ...hold, quickTap: 501 }), 0);
  assert.strictEqual(api.keyQuickTap({ ...hold, quickTap: "150" }), 0);
  assert.strictEqual(api.keyQuickTap({ ...hold }), 0);
  assert.strictEqual(api.keyQuickTap({ tap: "KEY_J", quickTap: 150 }), 0);   // ohne Halten ohne Wirkung
  assert.strictEqual(api.keyQuickTap({ ...hold, dtap: "KEY_ESC", quickTap: 150 }), 0);
  assert.strictEqual(api.keyQuickTap("KEY_J"), 0);
  assert.strictEqual(api.normalizeKeyCell({ label: "J", ...hold, quickTap: 0 }).quickTap, 0);
  assert.strictEqual(api.normalizeKeyCell({ label: "J", ...hold, quickTap: 150 }).quickTap, 150);
  assert.ok(!("quickTap" in api.normalizeKeyCell({ label: "J", ...hold, quickTap: 5 })));
  assert.ok(!("quickTap" in api.normalizeKeyCell({ label: "J", ...hold })));

  // QTAP_DATA: 1 = aus (quickTap 0), 10..500 = ms, sonst Feld löschen
  assert.strictEqual(api.MATRIX_DATA_FIELDS["QTAP_DATA:"], "qtap");
  const layers = [[[{ label: "J", ...hold, dtap: "NONE" }, { label: "K", ...hold, dtap: "NONE", quickTap: 90 }, { label: "L", ...hold, dtap: "NONE" }]]];
  assert.ok(api.applyMatrixData(layers, "qtap", { l: 0, k: [[1, 0, 150]] }));
  assert.strictEqual(layers[0][0][0].quickTap, 0);
  assert.ok(!("quickTap" in layers[0][0][1]));
  assert.strictEqual(layers[0][0][2].quickTap, 150);

  // Diff: nur mit QTAP_DATA, Anzeige im Kurztext
  const snap = api.createDeviceSnapshot();
  assert.ok("qtap" in snap);
  assert.strictEqual(api.describeKeyActions({ tapCode: 106, holdCode: 128, dtapCode: 0, quickTap: 1 }).endsWith("· Quick-Tap: aus"), true);
  assert.strictEqual(api.describeKeyActions({ tapCode: 106, holdCode: 128, dtapCode: 0, quickTap: 150 }).endsWith("· Quick-Tap: 150 ms"), true);

  // Sync-Befehl: optional "args", still bei fehlender Firmware-Unterstützung
  const ctx = { NUM_LAYERS: 8, NUM_ROWS: 6, NUM_COLS: 7, clampSetting: api.clampSetting, normalizeTriLayers: api.normalizeTriLayers, sanitizeCommandText: api.sanitizeCommandText, chordalExNormalize: api.chordalExNormalize, keyQuickTap: api.keyQuickTap };
  vm.createContext(ctx);
  vm.runInContext(`${section("js/config-sync.js", "// Einstellungs-Befehle des vollen Syncs", "// One-Shot-Auto-Sync")}
    this.build = buildSettingCommands; this.has = hasKeyQuickTaps;`, ctx);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.build({}, R).at(-1))), { cmd: "CLEAR_QUICK_TAPS", ack: "CLEAR_QUICK_TAPS", optional: "args", quietUnknown: true });
  assert.strictEqual(ctx.has([[[{ tap: "KEY_J", hold: "KEY_B", quickTap: 0 }]]]), true);
  assert.strictEqual(ctx.has([[[{ tap: "KEY_J", hold: "KEY_B" }]]]), false);
  assert.strictEqual(ctx.has(undefined), false);
});

asyncTests.push(["Sync: eigene Hold-Tap-Varianten gehen als SET_KF nach den Tasten, alte Firmware wird übersprungen", async () => {
  const setFlavor = w => { w.cfgRef.layers[0][2][1] = { label: "J", tap: "KEY_J", hold: "KEY_LEFT_CTRL", dtap: "NONE", holdFlavor: 2 }; };
  const a = fullSyncHarness(okReply);
  setFlavor(a.w);
  await a.w.write();
  assert.deepStrictEqual(a.sent.filter(c => c.startsWith("SET_KF ")), ["SET_KF 0 2 1 2"]);
  assert.ok(a.sent.indexOf("CLEAR_HOLD_FLAVORS") < a.sent.indexOf("SET_KF 0 2 1 2"));
  assert.ok(a.sent.indexOf("SET_K 0 2 1 106 128 0") < a.sent.indexOf("SET_KF 0 2 1 2"));
  assert.ok(a.sent.indexOf("SET_KF 0 2 1 2") < a.sent.indexOf("SAVE_NVS"));

  // Ohne eigene Werte: CLEAR_HOLD_FLAVORS löscht alte Werte des Geräts, kein SET_KF
  const b = fullSyncHarness(okReply);
  await b.w.write();
  assert.ok(b.sent.includes("CLEAR_HOLD_FLAVORS"));
  assert.strictEqual(b.sent.filter(c => c.startsWith("SET_KF ")).length, 0);

  // Firmware davor: ERR UNKNOWN. Mit Werten erscheint der Flash-Hinweis, ohne Werte bleibt der Sync still.
  const oldFw = cmd => cmd.startsWith("SET_K ") ? null : (cmd === "CLEAR_HOLD_FLAVORS" ? `ERR UNKNOWN ${cmd}` : `OK ${cmd}`);
  const c = fullSyncHarness(oldFw);
  setFlavor(c.w);
  await c.w.write();
  assert.strictEqual(c.sent.filter(x => x.startsWith("SET_KF ")).length, 0);
  assert.ok(c.toasts.some(t => t.includes("CLEAR_HOLD_FLAVORS")));
  assert.ok(c.sent.includes("SAVE_MACROS"));
  const d = fullSyncHarness(oldFw);
  await d.w.write();
  assert.ok(!d.toasts.some(t => t.includes("CLEAR_HOLD_FLAVORS")));
  assert.ok(d.sent.includes("SAVE_MACROS"));
}]);

test("Sync: countSyncSteps zählt jeden Einstellungs-Befehl und jede Combo", () => {
  const ctx = { NUM_LAYERS: 8, NUM_ROWS: 6, NUM_COLS: 7, clampSetting: api.clampSetting, normalizeTriLayers: api.normalizeTriLayers, sanitizeCommandText: api.sanitizeCommandText, chordalExNormalize: api.chordalExNormalize };
  vm.createContext(ctx);
  vm.runInContext(`${section("js/config-sync.js", "// Einstellungs-Befehle des vollen Syncs", "// One-Shot-Auto-Sync")}
    this.count = countSyncSteps; this.build = buildSettingCommands;`, ctx);
  // Eine weitere Einstellung erhöht die Schrittzahl (früher fest "+ 9")
  assert.strictEqual(ctx.count(7, 8, 2) - ctx.count(6, 8, 2), 1);
  assert.strictEqual(ctx.count(6, 8, 3) - ctx.count(6, 8, 2), 1);
  assert.strictEqual(ctx.count(6, 8, 0), 6 + 8 + 8 * 6 * 7 + 6);
  assert.strictEqual(ctx.count(6, 8, 0, 3) - ctx.count(6, 8, 0), 3);
  // Alt-Repeat-Paare: je Paar ein Schritt plus die Phase (CLEAR/SAVE)
  assert.strictEqual(ctx.count(6, 8, 0, 0, -1, 0, 2) - ctx.count(6, 8, 0), 2);
  // Überschreibungen des Masters: je Eintrag ein Schritt plus die Phase (CLEAR/SAVE); die andere Hälfte hat keine
  assert.strictEqual(ctx.count(6, 8, 0, 0, 0) - ctx.count(6, 8, 0), 1);
  assert.strictEqual(ctx.count(6, 8, 0, 0, 3) - ctx.count(6, 8, 0, 0, 0), 3);
  const cmds = ctx.build({}, R);
  assert.strictEqual(cmds.length, 26);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(cmds.filter(c => c.optional).map(c => c.ack))), ["SET_TAPPING_TERM", "SET_HOLD_MODE", "SET_QUICK_TAP", "SET_PRIOR_IDLE", "SET_CHORDAL_HOLD", "SET_TRI_LAYER", "SET_CAPS_LED", "SET_LEADER_TIMEOUT", "SET_LAYER_TIMEOUT", "SET_AUTO_MOUSE_LAYER", "SET_MOUSE_TIMEOUT", "SET_ONESHOT_TIMEOUT", "SET_AUTO_SHIFT", "SET_AUTO_SHIFT_TERM", "SET_RETRO_TAP", "SET_NUM_WORD_LAYER", "SET_BOOT_LAYER", "SET_CHORDAL_EX", "CLEAR_TAP_TERMS", "CLEAR_HOLD_FLAVORS", "CLEAR_QUICK_TAPS"]);
  assert.strictEqual(cmds[7].cmd, "SET_QUICK_TAP 0");
  assert.strictEqual(ctx.build({ quickTapMs: 120 }, R)[7].cmd, "SET_QUICK_TAP 120");
  assert.strictEqual(ctx.build({ quickTapMs: 900 }, R)[7].cmd, "SET_QUICK_TAP 500");
  assert.strictEqual(cmds[8].cmd, "SET_PRIOR_IDLE 0");
  assert.strictEqual(ctx.build({ requirePriorIdleMs: 120 }, R)[8].cmd, "SET_PRIOR_IDLE 120");
  assert.strictEqual(ctx.build({ requirePriorIdleMs: 900 }, R)[8].cmd, "SET_PRIOR_IDLE 500");
  assert.strictEqual(ctx.build({ requirePriorIdleMs: -4 }, R)[8].cmd, "SET_PRIOR_IDLE 0");
  assert.strictEqual(cmds[9].cmd, "SET_CHORDAL_HOLD 0");
  assert.strictEqual(ctx.build({ chordalHold: 1 }, R)[9].cmd, "SET_CHORDAL_HOLD 1");
  assert.strictEqual(ctx.build({ chordalHold: 7 }, R)[9].cmd, "SET_CHORDAL_HOLD 1");
  assert.strictEqual(ctx.build({ chordalHold: -3 }, R)[9].cmd, "SET_CHORDAL_HOLD 0");
  assert.strictEqual(cmds[10].cmd, "SET_TRI_LAYER -");
  assert.strictEqual(ctx.build({ triLayers: [{ a: 1, b: 2, target: 3 }, { a: 4, b: 5, target: 6 }] }, R)[10].cmd, "SET_TRI_LAYER 1 2 3 4 5 6");
  assert.strictEqual(ctx.build({ triLayers: [{ a: 1, b: 1, target: 3 }] }, R)[10].cmd, "SET_TRI_LAYER -");
  assert.strictEqual(cmds[11].cmd, "SET_CAPS_LED 0");
  assert.strictEqual(ctx.build({ capsLed: 1 }, R)[11].cmd, "SET_CAPS_LED 1");
  // Die linke Hälfte hat keinen Host: kein Befehl
  assert.strictEqual(ctx.build({ capsLed: 1 }, L).length, 25);
  // Auto Shift: Modus 0..4, Zeitlimit 50..500 (Standard 175); beide Befehle sind optional (ältere Firmware)
  const asCmd = (c, a) => c.find(x => x.ack === a);
  assert.strictEqual(asCmd(cmds, "SET_AUTO_SHIFT").cmd, "SET_AUTO_SHIFT 0");
  assert.strictEqual(asCmd(cmds, "SET_AUTO_SHIFT").optional, "args");
  assert.strictEqual(asCmd(cmds, "SET_AUTO_SHIFT_TERM").cmd, "SET_AUTO_SHIFT_TERM 175");
  assert.strictEqual(asCmd(cmds, "SET_AUTO_SHIFT_TERM").optional, true);
  assert.strictEqual(asCmd(cmds, "SET_RETRO_TAP").cmd, "SET_RETRO_TAP 0");
  assert.strictEqual(asCmd(ctx.build({ retroTap: 1 }, R), "SET_RETRO_TAP").cmd, "SET_RETRO_TAP 1");
  assert.strictEqual(asCmd(ctx.build({ retroTap: 9 }, R), "SET_RETRO_TAP").cmd, "SET_RETRO_TAP 1");
  assert.strictEqual(asCmd(cmds, "SET_RETRO_TAP").optional, true);
  assert.strictEqual(asCmd(cmds, "SET_NUM_WORD_LAYER").cmd, "SET_NUM_WORD_LAYER 1");
  assert.strictEqual(asCmd(ctx.build({ numWordLayer: 4 }, R), "SET_NUM_WORD_LAYER").cmd, "SET_NUM_WORD_LAYER 4");
  assert.strictEqual(asCmd(ctx.build({ numWordLayer: 9 }, R), "SET_NUM_WORD_LAYER").cmd, "SET_NUM_WORD_LAYER 7");
  assert.strictEqual(asCmd(cmds, "SET_NUM_WORD_LAYER").optional, "args");
  assert.strictEqual(asCmd(cmds, "SET_BOOT_LAYER").cmd, "SET_BOOT_LAYER 0");
  assert.strictEqual(asCmd(ctx.build({ bootLayer: 3 }, R), "SET_BOOT_LAYER").cmd, "SET_BOOT_LAYER 3");
  assert.strictEqual(asCmd(ctx.build({ bootLayer: 9 }, R), "SET_BOOT_LAYER").cmd, "SET_BOOT_LAYER 7");
  assert.strictEqual(asCmd(cmds, "SET_BOOT_LAYER").optional, "args");
  assert.strictEqual(asCmd(ctx.build({ autoShift: 1 }, R), "SET_AUTO_SHIFT").cmd, "SET_AUTO_SHIFT 1");
  assert.strictEqual(asCmd(ctx.build({ autoShift: 7 }, L), "SET_AUTO_SHIFT").cmd, "SET_AUTO_SHIFT 4");
  assert.strictEqual(asCmd(ctx.build({ autoShift: 3 }, R), "SET_AUTO_SHIFT").cmd, "SET_AUTO_SHIFT 3");
  assert.strictEqual(asCmd(ctx.build({ autoShift: -2 }, R), "SET_AUTO_SHIFT").cmd, "SET_AUTO_SHIFT 0");
  assert.strictEqual(asCmd(ctx.build({ autoShiftMs: 220 }, R), "SET_AUTO_SHIFT_TERM").cmd, "SET_AUTO_SHIFT_TERM 220");
  assert.strictEqual(asCmd(ctx.build({ autoShiftMs: 5 }, R), "SET_AUTO_SHIFT_TERM").cmd, "SET_AUTO_SHIFT_TERM 50");
  assert.strictEqual(asCmd(ctx.build({ autoShiftMs: 9999 }, L), "SET_AUTO_SHIFT_TERM").cmd, "SET_AUTO_SHIFT_TERM 500");
  // Leader-Wartezeit: Standard 1000, Bereich 100..5000
  const leaderCmd = c => c.find(x => x.ack === "SET_LEADER_TIMEOUT");
  assert.strictEqual(leaderCmd(cmds).cmd, "SET_LEADER_TIMEOUT 1000");
  assert.strictEqual(leaderCmd(cmds).optional, true);
  assert.strictEqual(leaderCmd(ctx.build({ leaderTimeoutMs: 700 }, R)).cmd, "SET_LEADER_TIMEOUT 700");
  assert.strictEqual(leaderCmd(ctx.build({ leaderTimeoutMs: 9 }, R)).cmd, "SET_LEADER_TIMEOUT 100");
  assert.strictEqual(leaderCmd(ctx.build({ leaderTimeoutMs: 99999 }, L)).cmd, "SET_LEADER_TIMEOUT 5000");
  // One-Shot-Zeitlimit: 0 = aus, sonst 500..10000
  const otCmd = c => c.find(x => x.ack === "SET_ONESHOT_TIMEOUT");
  assert.strictEqual(otCmd(cmds).cmd, "SET_ONESHOT_TIMEOUT 0");
  assert.strictEqual(otCmd(cmds).optional, "args");
  assert.strictEqual(otCmd(ctx.build({ oneShotTimeoutMs: 1500 }, R)).cmd, "SET_ONESHOT_TIMEOUT 1500");
  assert.strictEqual(otCmd(ctx.build({ oneShotTimeoutMs: 9 }, R)).cmd, "SET_ONESHOT_TIMEOUT 500");
  assert.strictEqual(otCmd(ctx.build({ oneShotTimeoutMs: 99999 }, L)).cmd, "SET_ONESHOT_TIMEOUT 10000");
  // Ebenen-Rückfall: 0 = aus, sonst 1000..60000, optional bei älterer Firmware
  const ltCmd = c => c.find(x => x.ack === "SET_LAYER_TIMEOUT");
  assert.strictEqual(ltCmd(cmds).cmd, "SET_LAYER_TIMEOUT 0");
  assert.strictEqual(ltCmd(cmds).optional, "args");
  assert.strictEqual(ltCmd(ctx.build({ layerTimeoutMs: 5000 }, R)).cmd, "SET_LAYER_TIMEOUT 5000");
  assert.strictEqual(ltCmd(ctx.build({ layerTimeoutMs: 9 }, R)).cmd, "SET_LAYER_TIMEOUT 1000");
  assert.strictEqual(ltCmd(ctx.build({ layerTimeoutMs: 99999 }, L)).cmd, "SET_LAYER_TIMEOUT 60000");
  // Auto-Mouse-Ebene: 0..7 oder 255 (aus), Zeitlimit 100..2000; beide Befehle sind optional (ältere Firmware)
  const amlCmd = c => c.find(x => x.ack === "SET_AUTO_MOUSE_LAYER");
  const amtCmd = c => c.find(x => x.ack === "SET_MOUSE_TIMEOUT");
  assert.strictEqual(amlCmd(cmds).cmd, "SET_AUTO_MOUSE_LAYER 255");
  assert.strictEqual(amlCmd(cmds).optional, "args");
  assert.strictEqual(amtCmd(cmds).cmd, "SET_MOUSE_TIMEOUT 500");
  assert.strictEqual(amtCmd(cmds).optional, "args");
  assert.strictEqual(amlCmd(ctx.build({ autoMouseLayer: 3 }, R)).cmd, "SET_AUTO_MOUSE_LAYER 3");
  assert.strictEqual(amlCmd(ctx.build({ autoMouseLayer: 0 }, L)).cmd, "SET_AUTO_MOUSE_LAYER 0");
  assert.strictEqual(amlCmd(ctx.build({ autoMouseLayer: 8 }, R)).cmd, "SET_AUTO_MOUSE_LAYER 255");
  assert.strictEqual(amlCmd(ctx.build({ autoMouseLayer: 300 }, R)).cmd, "SET_AUTO_MOUSE_LAYER 255");
  assert.strictEqual(amtCmd(ctx.build({ mouseTimeoutMs: 800 }, R)).cmd, "SET_MOUSE_TIMEOUT 800");
  assert.strictEqual(amtCmd(ctx.build({ mouseTimeoutMs: 5 }, R)).cmd, "SET_MOUSE_TIMEOUT 100");
  assert.strictEqual(amtCmd(ctx.build({ mouseTimeoutMs: 99999 }, L)).cmd, "SET_MOUSE_TIMEOUT 2000");
  // Leader-Phase: je Sequenz ein Schritt plus die Phase (CLEAR/SAVE), auf beiden Hälften
  assert.strictEqual(ctx.count(6, 8, 0, 0, -1, 3) - ctx.count(6, 8, 0, 0, -1, 0), 3);
  // Auch ohne Sequenzen läuft die Phase (CLEAR_LEADER und SAVE_LEADER): 2 Schritte minus 1 für die Zählung je Sequenz
  assert.strictEqual(ctx.count(6, 8, 0, 0, -1, 0), ctx.count(6, 8, 0));
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

asyncTests.push(["Sync: Firmware vor Version 36 lehnt einen neuen Auto-Shift-Modus mit ERR ARGS ab, der Sync läuft weiter", async () => {
  const { w, toasts, sent } = fullSyncHarness(cmd =>
    cmd.startsWith("SET_AUTO_SHIFT ") ? `ERR ARGS ${cmd}` : okReply(cmd));
  await w.write();
  assert.ok(sent.some(c => c.startsWith("SET_AUTO_SHIFT ")));
  assert.ok(sent.some(c => c.startsWith("SET_K ")));
  assert.ok(toasts.some(t => t.includes("SET_AUTO_SHIFT") && t.includes("flashen")));
  assert.ok(toasts.some(t => t.includes("Vollständige Konfiguration")));
}]);

asyncTests.push(["Sync: ERR ARGS bricht den Sync bei einem Befehl ohne args-Toleranz weiter ab", async () => {
  const { w, toasts, sent } = fullSyncHarness(cmd =>
    cmd.startsWith("SET_AUTO_SHIFT_TERM") ? `ERR ARGS ${cmd}` : okReply(cmd));
  await w.write();
  assert.ok(!sent.some(c => c.startsWith("SET_K ")));
  assert.ok(toasts.some(t => t.includes("Fehler beim Übertragen")));
}]);

asyncTests.push(["Sync: Firmware ohne SET_TRI_LAYER bricht den Sync nicht ab", async () => {
  const { w, toasts, sent } = fullSyncHarness(cmd =>
    cmd.startsWith("SET_TRI_LAYER") ? `ERR UNKNOWN ${cmd}` : okReply(cmd));
  await w.write();
  assert.ok(sent.some(c => c.startsWith("SET_TRI_LAYER")));
  assert.ok(sent.some(c => c.startsWith("SET_K ")));
  assert.ok(toasts.some(t => t.includes("SET_TRI_LAYER") && t.includes("flashen")));
  assert.ok(toasts.some(t => t.includes("Vollständige Konfiguration")));
}]);

asyncTests.push(["Sync: Firmware ohne SET_HOLD_MODE bricht den Sync nicht ab", async () => {
  const { w, toasts, sent } = fullSyncHarness(cmd =>
    cmd.startsWith("SET_HOLD_MODE") ? `ERR UNKNOWN ${cmd}` : okReply(cmd));
  await w.write();
  assert.ok(sent.some(c => c.startsWith("SET_K ")));
  assert.ok(sent.includes("SAVE_PAIRS"));
  assert.ok(toasts.some(t => t.includes("SET_HOLD_MODE") && t.includes("flashen")));
  assert.ok(toasts.some(t => t.includes("Vollständige Konfiguration")));
}]);

asyncTests.push(["Sync: Makros gehen als CLEAR_MACROS, ADD_MACRO, ADD_MACRO_STEP und SAVE_MACROS", async () => {
  const { w, sent } = fullSyncHarness(okReply);
  await w.write();
  const start = sent.indexOf("CLEAR_MACROS");
  assert.ok(start > sent.indexOf("SAVE_PAIRS"));
  assert.deepStrictEqual(sent.slice(start, sent.indexOf("SAVE_MACROS") + 1), [
    "CLEAR_MACROS",
    "ADD_MACRO", "ADD_MACRO_STEP 2 131 0", "ADD_MACRO_STEP 1 99 0", "ADD_MACRO_STEP 3 131 0",
    "ADD_MACRO", "ADD_MACRO_STEP 4 0 250", "ADD_MACRO_STEP 1 97 0",
    "SAVE_MACROS"
  ]);
  // Danach folgen die Leader-Phase und die Alt-Repeat-Phase
  assert.deepStrictEqual(sent.slice(sent.indexOf("SAVE_MACROS") + 1), [
    "CLEAR_LEADER", "ADD_LEADER 368 97 98", "ADD_LEADER 320 99", "ADD_LEADER 122 100", "SAVE_LEADER",
    "CLEAR_ALT_REPEATS", "ADD_ALT_REPEAT 101 117", "ADD_ALT_REPEAT 105 111", "SAVE_ALT_REPEATS"
  ]);
}]);

asyncTests.push(["Sync: Firmware ohne Leader überspringt die Leader-Phase mit Hinweis und endet bei 100 %", async () => {
  const { w, toasts, sent, progress } = fullSyncHarness(cmd => cmd === "CLEAR_LEADER" ? `ERR UNKNOWN ${cmd}` : okReply(cmd));
  await w.write();
  assert.strictEqual(progress.at(-2), 100);
  assert.ok(sent.includes("CLEAR_LEADER"));
  assert.ok(!sent.some(c => c.startsWith("ADD_LEADER") || c === "SAVE_LEADER"));
  assert.ok(toasts.some(t => t.includes("CLEAR_LEADER") && t.includes("flashen")));
  assert.ok(toasts.some(t => t.includes("Vollständige Konfiguration")));
}]);

asyncTests.push(["Sync: Fehler bei ADD_LEADER nach CLEAR_LEADER zeigt einen Hinweis und bricht ab", async () => {
  const { w, toasts, sent } = fullSyncHarness(cmd => cmd.startsWith("ADD_LEADER 320") ? `ERR ARGS ${cmd}` : okReply(cmd));
  let failed = false;
  try { await w.write(); } catch (e) { failed = true; }
  assert.ok(sent.includes("CLEAR_LEADER"));
  assert.ok(!sent.includes("SAVE_LEADER"));
  assert.ok(toasts.some(t => t.includes("Leader-Folgen") && t.includes("teilweise")));
  assert.ok(failed || toasts.some(t => /abgebrochen|nicht bestätigt/.test(t)));
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

asyncTests.push(["Sync: Überschreibungen gehen als CLEAR_OVERRIDES, ADD_OVERRIDE und SAVE_OVERRIDES", async () => {
  const { w, sent } = fullSyncHarness(okReply);
  await w.write();
  const clear = sent.indexOf("CLEAR_OVERRIDES");
  const save = sent.indexOf("SAVE_OVERRIDES");
  assert.ok(clear > sent.indexOf("SAVE_PAIRS") && save > clear, "nach den Tastenpaaren, vor den Makros");
  assert.ok(save < sent.indexOf("CLEAR_MACROS"));
  assert.deepStrictEqual(sent.filter(c => c.startsWith("ADD_OVERRIDE ")), [
    "ADD_OVERRIDE 2 178 212",  // Shift + Backspace -> Delete
    "ADD_OVERRIDE 5 97 98 1"   // Ctrl + Alt + a -> b, nur Ebene 0 (vierter Wert; ohne Maske entfällt er)
  ]);
}]);

asyncTests.push(["Sync: Firmware ohne Überschreibungen überspringt die Phase mit Hinweis", async () => {
  const { w, toasts, sent, progress } = fullSyncHarness(cmd => cmd === "CLEAR_OVERRIDES" ? `ERR UNKNOWN ${cmd}` : okReply(cmd));
  await w.write();
  // Auch mit übersprungener Phase endet der Balken bei 100 %
  assert.strictEqual(progress.at(-2), 100);
  assert.ok(sent.includes("CLEAR_OVERRIDES"));
  assert.ok(!sent.some(c => c.startsWith("ADD_OVERRIDE") || c === "SAVE_OVERRIDES"));
  assert.ok(sent.includes("SAVE_MACROS"), "die übrigen Phasen laufen weiter");
  assert.ok(toasts.some(t => t.includes("CLEAR_OVERRIDES") && t.includes("flashen")));
  // Ein abgelehnter Eintrag bricht den Sync ab (kein stilles Abschneiden)
  const bad = fullSyncHarness(cmd => cmd.startsWith("ADD_OVERRIDE 5") ? `ERR ARGS ${cmd}` : okReply(cmd));
  await bad.w.write();
  assert.ok(!bad.sent.includes("SAVE_OVERRIDES"));
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
  for (const code of [...codes, "CAPS_WORD", "REPEAT", "ALT_REPEAT"]) {
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
  // Repeat liegt direkt hinter Caps Word, in keinem anderen Bereich (Makros 0x170, Umlaute 0x150)
  assert.strictEqual(fw("REPEAT"), 0x169);
  // Alt Repeat liegt hinter Layer Lock (0x16A), vor den Makros (0x170)
  assert.strictEqual(fw("ALT_REPEAT"), 0x16B);
  assert.strictEqual(api.actionCodeToNumeric("ALT_REPEAT"), 0x16B);
  assert.strictEqual(api.holdSublabel("ALT_REPEAT"), "AltRep");
});

test("Dynamisches Makro: DM_REC und DM_PLAY wie DactylCommon.h, Auswahl, Rückweg und kein Combo-Ziel", () => {
  const common = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "DactylCommon.h"), "utf8");
  const fw = name => Number(new RegExp(`#define ACT_${name}\\s+(0x[0-9A-F]+)`).exec(common)[1]);
  assert.strictEqual(fw("DM_REC"), 0x16C);
  assert.strictEqual(fw("DM_PLAY"), 0x16D);
  const all = api.KEYCODES.flatMap(g => g.keys);
  for (const code of ["DM_REC", "DM_PLAY"]) {
    assert.strictEqual(api.actionCodeToNumeric(code), fw(code), code);
    assert.ok(all.some(k => k.code === code), `${code} in der Auswahl`);
    const label = api.ONE_SHOT_LABELS[code];
    assert.ok(label && label.length <= 8, code);
    assert.deepStrictEqual({ ...api.findDefinitionByCode(fw(code)) }, { label, tap: code });
    assert.ok(!api.isKeyPairMember(code), `${code} ist kein Paar-Mitglied`);
    assert.ok(api.isDynamicMacroCode(code) && api.isDynamicMacroCode(`ACT_${code}`));
  }
  assert.ok(!api.isDynamicMacroCode("REPEAT") && !api.isDynamicMacroCode("MACRO_0") && !api.isDynamicMacroCode("DM_RECX"));
  // Die Codes dürfen mit keinem anderen Bereich kollidieren
  assert.ok(fw("DM_PLAY") < fw("MACRO_BASE"));
  // Combos führen sie nicht aus
  const cfg = JSON.parse(JSON.stringify(api.SIDE_PROFILES.R.defaultConfig));
  cfg.combos = [{ key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 }, behavior: "KEY_PRESS", action: "DM_REC", layerMask: 255 }];
  let message = "";
  try { api.validateConfigShape(cfg, api.SIDE_PROFILES.R); } catch (err) { message = String(err && err.message); }
  assert.match(message, /keine dynamischen Makros/);
  cfg.combos[0].action = "KEY_A";
  api.validateConfigShape(cfg, api.SIDE_PROFILES.R);
  // Den Slot hat nur der Master: links wird DM_REC/DM_PLAY als Tap, Halten oder Doppel-Tipp abgelehnt
  const withDm = (profile, where) => {
    const c = JSON.parse(JSON.stringify(profile.defaultConfig));
    c.combos = [];
    c.layers[0][2][1] = where === "tap" ? "DM_REC" : { tap: "KEY_A", [where]: "DM_PLAY" };
    return c;
  };
  for (const where of ["tap", "hold", "dtap"]) {
    api.validateConfigShape(withDm(api.SIDE_PROFILES.R, where), api.SIDE_PROFILES.R);
    let msg = "";
    try { api.validateConfigShape(withDm(api.SIDE_PROFILES.L, where), api.SIDE_PROFILES.L); } catch (err) { msg = String(err && err.message); }
    assert.match(msg, /nur für die/, where);
  }
});

test("serial.js: DM_REC zeigt die Aufnahme nur vom Master über USB", () => {
  const s = serialLineHarness();
  assert.strictEqual(s.dmRec(), false);
  s.handle("DM_REC:1", "R", "usb");
  assert.strictEqual(s.dmRec(), true);
  s.handle("DM_REC:0", "R", "usb");
  assert.strictEqual(s.dmRec(), false);
  // Linke Hälfte, BLE und ungültige Zeilen ändern den Stand nicht
  s.handle("DM_REC:1", "L", "usb");
  s.handle("DM_REC:1", "R", "ble");
  assert.strictEqual(s.dmRec(), false);
  s.handle("DM_REC:1", "R", "usb");
  for (const bad of ["DM_REC:2", "DM_REC:", "DM_REC:x", "DM_REC:11"]) s.handle(bad, "R", "usb");
  assert.strictEqual(s.dmRec(), true);
  assert.strictEqual(s.parse("DM_REC:1", "R"), true);
  assert.strictEqual(s.parse("DM_REC:0", "R"), false);
  assert.strictEqual(s.parse("DM_REC:1", "L"), undefined);
  assert.strictEqual(s.parse("DM_REC:9", "R"), undefined);
  assert.strictEqual(s.parse(null, "R"), undefined);
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(/id="dmRecPill"[^>]*\bhidden\b/.test(html));
});

test("serial.js: MODE_STATE zeigt die Modi nur vom Master über USB und endet mit der USB-Verbindung", () => {
  const s = serialLineHarness();
  assert.strictEqual(s.modes(), null);
  s.handle('MODE_STATE:{"cw":1,"nw":0,"sc":0,"sh":0,"ka":1}', "R", "usb");
  assert.deepStrictEqual(s.modes(), { cw: true, nw: false, sc: false, sh: false, ka: true, ll: false, lli: 0 });
  // Linke Hälfte, BLE und ungültige Zeilen ändern den Stand nicht
  s.handle('MODE_STATE:{"cw":0,"nw":0,"sc":0,"sh":0,"ka":0}', "L", "usb");
  s.handle('MODE_STATE:{"cw":0,"nw":0,"sc":0,"sh":0,"ka":0}', "R", "ble");
  for (const bad of ['MODE_STATE:{"cw":2,"nw":0,"sc":0,"sh":0,"ka":0}', 'MODE_STATE:{"cw":1}', "MODE_STATE:kaputt", "MODE_STATE:null"]) s.handle(bad, "R", "usb");
  assert.deepStrictEqual(s.modes(), { cw: true, nw: false, sc: false, sh: false, ka: true, ll: false, lli: 0 });
  // Ohne USB zum Master gilt der Stand nicht mehr
  const gone = serialLineHarness({ serialUp: false, serialSide: null });
  gone.handle('MODE_STATE:{"cw":1,"nw":0,"sc":0,"sh":0,"ka":0}', "R", "usb");
  gone.forgetModes();
  assert.strictEqual(gone.modes(), null);
  // Besteht USB zum Master weiter (BLE-Trennung), bleibt der Stand
  const kept = serialLineHarness();
  kept.handle('MODE_STATE:{"cw":1,"nw":0,"sc":0,"sh":0,"ka":0}', "R", "usb");
  kept.forgetModes();
  assert.strictEqual(kept.modes().cw, true);
  // Layer Lock: ll und lli, Pill mit Ebenennummer, Ende mit ll 0
  s.handle('MODE_STATE:{"cw":0,"nw":0,"sc":0,"sh":0,"ka":0,"ll":1,"lli":2}', "R", "usb");
  assert.deepStrictEqual(s.modes(), { cw: false, nw: false, sc: false, sh: false, ka: false, ll: true, lli: 2 });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s.describeModes())), [{ key: "ll", label: "Layer Lock (Ebene 2)" }]);
  s.handle('MODE_STATE:{"cw":0,"nw":0,"sc":0,"sh":0,"ka":0,"ll":1,"lli":9}', "R", "usb");
  assert.strictEqual(s.modes().lli, 2);
  s.handle('MODE_STATE:{"cw":0,"nw":0,"sc":0,"sh":0,"ka":0,"ll":0,"lli":0}', "R", "usb");
  assert.deepStrictEqual(s.describeModes(), []);
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(/id="pillLayerLock"[^>]*\bhidden\b/.test(html));
  assert.ok(/id="modeStatePills"[^>]*\bhidden\b/.test(html));
  for (const k of ["cw", "nw", "sc", "sh", "ka"]) assert.ok(new RegExp(`data-mode="${k}"[^>]*\\bhidden\\b`).test(html), k);
  for (const f of ["js/serial.js", "js/ble.js"]) assert.ok(fs.readFileSync(path.join(__dirname, "..", f), "utf8").includes("forgetModeState();"), f);
});

test("Mausbewegung: Aktionscodes wie DactylCommon.h, Auswahl, Rückweg und kein Combo-Ziel", () => {
  const common = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "DactylCommon.h"), "utf8");
  const fw = name => Number(new RegExp(`#define ACT_${name}\\s+(0x[0-9A-F]+)`).exec(common)[1]);
  const all = api.KEYCODES.flatMap(g => g.keys);
  const names = { MOUSE_UP: "MOUSE_UP", MOUSE_DOWN: "MOUSE_DOWN", MOUSE_LEFT_MOVE: "MOUSE_LEFT_MOVE", MOUSE_RIGHT_MOVE: "MOUSE_RIGHT_MOVE" };
  for (const code of Object.keys(names)) {
    const n = api.actionCodeToNumeric(code);
    assert.strictEqual(n, fw(code), code);
    assert.strictEqual(api.actionCodeToNumeric(`ACT_${code}`), n, code);
    assert.strictEqual(api.findDefinitionByCode(n).tap, code);
    assert.ok(all.some(k => k.code === code), `${code} in der Auswahl`);
    assert.ok(api.isMouseMoveCode(code) && api.isMouseMoveCode(`ACT_${code}`), code);
  }
  assert.ok(!api.isMouseMoveCode("MOUSE_LEFT") && !api.isMouseMoveCode("MOUSE_WHEEL_UP") && !api.isMouseMoveCode(""));
  // Vier Codes direkt hinter dem Mausrad, vor den Tastenpaaren
  assert.deepStrictEqual(["MOUSE_UP", "MOUSE_DOWN", "MOUSE_LEFT_MOVE", "MOUSE_RIGHT_MOVE"].map(c => api.actionCodeToNumeric(c)), [0x135, 0x136, 0x137, 0x138]);
  assert.ok(api.ACT_KEY_PAIR_BASE > 0x138);
  // Import: ein Combo mit Mausbewegung ist ungültig, ein Combo mit Mausrad bleibt gültig
  const combo = action => ({ key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 }, behavior: "KEY_PRESS", action });
  const layers = [[[{ tap: "KEY_A" }]]];
  assert.throws(() => api.validateConfigShape({ layers, combos: [combo("MOUSE_UP")] }), /Mausbewegung/);
  assert.throws(() => api.validateConfigShape({ layers, combos: [combo("ACT_MOUSE_RIGHT_MOVE")] }), /Mausbewegung/);
});

test("Mauspräzision: MOUSE_SLOW und MOUSE_FAST wie DactylCommon.h, Auswahl und kein Combo-Ziel", () => {
  const common = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "DactylCommon.h"), "utf8");
  const all = api.KEYCODES.flatMap(g => g.keys);
  for (const code of ["MOUSE_SLOW", "MOUSE_FAST"]) {
    const fw = Number(new RegExp(`#define ACT_${code}\\s+(0x[0-9A-F]+)`).exec(common)[1]);
    assert.strictEqual(api.actionCodeToNumeric(code), fw, code);
    assert.strictEqual(api.actionCodeToNumeric(`ACT_${code}`), fw, code);
    assert.strictEqual(api.findDefinitionByCode(fw).tap, code);
    assert.ok(all.some(k => k.code === code), `${code} in der Auswahl`);
    assert.ok(api.isMouseMoveCode(code) && api.isMouseMoveCode(`ACT_${code}`), code);
  }
  assert.deepStrictEqual(["MOUSE_SLOW", "MOUSE_FAST"].map(c => api.actionCodeToNumeric(c)), [0x13B, 0x13C]);
  assert.ok(api.ACT_KEY_PAIR_BASE > 0x13C);
  const combo = action => ({ key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 }, behavior: "KEY_PRESS", action });
  assert.throws(() => api.validateConfigShape({ layers: [[[{ tap: "KEY_A" }]]], combos: [combo("MOUSE_SLOW")] }), /Mausbewegung/);
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

test("Belegungsvorlagen: jede Basis-Vorlage liefert gültige Codes für alle Matrix-Positionen", () => {
  const base = Object.keys(api.LAYOUT_PRESETS).filter(k => api.LAYOUT_PRESETS[k].kind === "base");
  assert.deepStrictEqual(base.sort(), ["colemak_dh", "dvorak", "qwertz"]);
  for (const key of Object.keys(api.LAYOUT_PRESETS)) {
    const out = api.applyLayoutPreset({ layers: [] }, key, 0);
    assert.ok(out, key);
    const layer = out.layers[0];
    assert.strictEqual(layer.length, 6, key);
    layer.forEach((row, r) => {
      assert.strictEqual(row.length, 7, `${key} R${r}`);
      row.forEach((cell, c) => {
        const num = api.actionCodeToNumeric(cell.tap);
        assert.ok(cell.tap === "NONE" || num > 0, `${key} R${r}C${c}: ${cell.tap}`);
        assert.ok(typeof cell.label === "string" && cell.hold === "NONE", `${key} R${r}C${c}`);
      });
    });
    // Die Vorlage übersteht die Prüfung des Imports
    const cfg = { layers: out.layers };
    api.validateConfigShape(cfg, R);
  }
  for (const key of base) {
    const layer = api.applyLayoutPreset({ layers: [] }, key, 0).layers[0];
    const letters = new Set();
    layer.forEach(row => row.forEach(cell => { if (/^KEY_[A-Z]$/.test(cell.tap)) letters.add(cell.tap); }));
    assert.ok(letters.size >= 10, `${key}: ${letters.size} Buchstaben`);
    assert.strictEqual(layer[5][3].tap, "KEY_SPACE", key);
  }
  // Auf R4C0 und R5C5 liegt bei keiner Vorlage eine Aktion (die Positionen existieren nicht)
  for (const key of Object.keys(api.LAYOUT_PRESETS)) {
    const layer = api.applyLayoutPreset({ layers: [] }, key, 0).layers[0];
    assert.strictEqual(layer[4][0].tap, "NONE", `${key}: R4C0 existiert nicht`);
    layer.forEach((row, r) => row.forEach((cell, c) => {
      if (!api.isWiredSwitch(r, c, R)) assert.strictEqual(cell.tap, "NONE", `${key}: R${r}C${c} ist nicht verlötet`);
    }));
    if (api.LAYOUT_PRESETS[key].kind === "base") {
      assert.ok(layer.some(row => row.some(cell => cell.tap === "KEY_BACKSPACE")), `${key}: Backspace fehlt`);
    }
  }
  assert.strictEqual(api.applyLayoutPreset({ layers: [] }, "colemak_dh").layers[0][2][2].tap, "KEY_E");
  assert.strictEqual(api.applyLayoutPreset({ layers: [] }, "dvorak").layers[0][2][2].tap, "KEY_T");
});

test("Belegungsvorlagen: Ebenen-Vorlage ändert nur die Ziel-Ebene", () => {
  const cfg = { layers: [0, 1, 2].map(l => api.applyLayoutPreset({ layers: [] }, l === 2 ? "dvorak" : "qwertz", 0).layers[0]) };
  const plain = x => JSON.parse(JSON.stringify(x)); // Objekte aus dem vm-Kontext haben einen anderen Prototype
  const before = plain(cfg);
  for (const key of ["numpad", "navigation", "symbols"]) {
    const out = api.applyLayoutPreset(cfg, key, 1);
    assert.deepStrictEqual(plain(out.layers[0]), before.layers[0], key);
    assert.deepStrictEqual(plain(out.layers[2]), before.layers[2], key);
    assert.notDeepStrictEqual(plain(out.layers[1]), before.layers[1], key);
    assert.deepStrictEqual(plain(out.layers[1]), plain(api.applyLayoutPreset({ layers: [] }, key, 1).layers[1]), key);
  }
  assert.strictEqual(api.applyLayoutPreset(cfg, "numpad", 1).layers[1][2][2].tap, "KEY_5");
  assert.strictEqual(api.applyLayoutPreset(cfg, "navigation", 1).layers[1][1][2].tap, "KEY_UP_ARROW");
  // Eine Ebene hinter dem Ende füllt die Lücken transparent
  const far = api.applyLayoutPreset(cfg, "symbols", 5);
  assert.strictEqual(far.layers.length, 6);
  assert.deepStrictEqual(plain(far.layers[4]), plain(api.transparentLayer()));
});

test("Belegungsvorlagen: Undo stellt den vorherigen Zustand wieder her", () => {
  const cfg = { layers: [api.applyLayoutPreset({ layers: [] }, "qwertz", 0).layers[0]], layerNames: ["A"] };
  const plain = x => JSON.parse(JSON.stringify(x));
  const snapshot = plain(cfg);
  const oldLayers = cfg.layers;
  const next = api.applyLayoutPreset(cfg, "colemak_dh", 0);
  // Die Eingabe bleibt unverändert; der Revert setzt die alten Ebenen zurück
  assert.deepStrictEqual(plain(cfg), snapshot);
  assert.notStrictEqual(next.layers, oldLayers);
  const state = { ...next };
  state.layers = oldLayers;
  assert.deepStrictEqual(plain(state.layers), snapshot.layers);
  assert.strictEqual(next.layerNames, cfg.layerNames);
  // Der Snapshot blockiert ältere Änderungen, nur der letzte Eintrag ist rückgängig machbar
  assert.strictEqual(api.isUndoBlocked([{ snapshot: true }], 0), false);
  assert.strictEqual(api.isUndoBlocked([{ snapshot: true }, {}], 0), true);
});

test("Belegungsvorlagen: Dialog und Revert in editor.js (DOM-Stub)", () => {
  const src = section("js/editor.js", "function openLayoutTemplatesDialog", "// Hälfte, von der gerade eine Taste gezogen wird");
  const els = {};
  const el = id => (els[id] = els[id] || { id, value: "", style: {}, children: [], innerHTML: "", appendChild(c) { this.children.push(c); } });
  const sandbox = {
    document: { getElementById: el, createElement: () => ({ children: [], appendChild(c) { this.children.push(c); } }) },
    LAYOUT_PRESETS: api.LAYOUT_PRESETS, applyLayoutPreset: api.applyLayoutPreset, NUM_LAYERS: 8, DEFAULT_LAYER_NAMES: [],
    activeLayerIndex: 3, selectedKey: null, toasts: [], pending: [], confirms: [], renders: 0, saves: 0, confirmAnswer: true,
    activeProfile: () => ({ label: "rechte Hälfte", presets: {} }),
    showToast(m) { sandbox.toasts.push(m); }, confirm(m) { sandbox.confirms.push(m); return sandbox.confirmAnswer; },
    renderMatrix() { sandbox.renders++; }, saveConfigToServer() { sandbox.saves++; }, updateInspector() {},
    markPendingSync(c) { sandbox.pending.push(c); },
    currentConfig: { layers: [api.transparentLayer(), api.transparentLayer()], layerNames: ["Base"] }
  };
  const vmCtx = vm.createContext(sandbox);
  vm.runInContext(src, vmCtx);
  const run = code => vm.runInContext(code, vmCtx);
  run("openLayoutTemplatesDialog()");
  assert.strictEqual(els.layoutTemplatesModal.style.display, "flex");
  assert.strictEqual(els.layoutTemplateLayer.value, "3", "Ziel-Ebene ist die angezeigte Ebene");
  assert.strictEqual(els.layoutTemplateLayer.children.length, 8);
  assert.strictEqual(els.layoutTemplateSelect.children.length, 2);
  assert.strictEqual(els.layoutTemplateSelect.children.reduce((n, g) => n + g.children.length, 0), Object.keys(api.LAYOUT_PRESETS).length);
  // Abbrechen im confirm ändert nichts
  els.layoutTemplateSelect.value = "numpad";
  els.layoutTemplateLayer.value = "1";
  sandbox.confirmAnswer = false;
  const before = JSON.stringify(sandbox.currentConfig.layers);
  run("applyLayoutTemplateFromUI()");
  assert.strictEqual(JSON.stringify(sandbox.currentConfig.layers), before);
  assert.strictEqual(sandbox.pending.length, 0);
  assert.match(sandbox.confirms[0], /Halte-/);
  // Anwenden: Snapshot-Änderung, nur Ebene 1 ändert sich
  sandbox.confirmAnswer = true;
  const oldLayers = sandbox.currentConfig.layers;
  run("applyLayoutTemplateFromUI()");
  assert.strictEqual(sandbox.pending.length, 1);
  assert.strictEqual(sandbox.pending[0].snapshot, true);
  assert.strictEqual(sandbox.pending[0].type, "layout_template");
  assert.strictEqual(sandbox.currentConfig.layers[1][2][2].tap, "KEY_5");
  assert.strictEqual(JSON.stringify(sandbox.currentConfig.layers[0]), JSON.stringify(oldLayers[0]), "Ebene 0 bleibt");
  assert.strictEqual(els.layoutTemplatesModal.style.display, "none");
  // Der echte Revert stellt die alten Ebenen wieder her
  sandbox.pending[0].revert();
  assert.strictEqual(sandbox.currentConfig.layers, oldLayers);
  // Ungültige Eingabe: Hinweis, keine Änderung
  els.layoutTemplateLayer.value = "9";
  run("applyLayoutTemplateFromUI()");
  assert.strictEqual(sandbox.pending.length, 1);
  assert.ok(sandbox.toasts.length >= 1);
  // Linke Hälfte ohne Presets öffnet den Dialog nicht
  els.layoutTemplatesModal.style.display = "none";
  sandbox.activeProfile = () => ({ label: "linke Hälfte", presets: null });
  run("openLayoutTemplatesDialog()");
  assert.strictEqual(els.layoutTemplatesModal.style.display, "none");
});

test("Belegungsvorlagen: ungültige Vorlage oder Ebene wird abgelehnt", () => {
  const cfg = { layers: [api.transparentLayer()] };
  for (const key of ["", "nope", "__proto__", "constructor", "toString", undefined, null, 5]) {
    assert.strictEqual(api.applyLayoutPreset(cfg, key, 0), null, String(key));
  }
  for (const layer of [-1, 8, 1.5, NaN, "1", null]) {
    assert.strictEqual(api.applyLayoutPreset(cfg, "qwertz", layer), null, String(layer));
  }
  assert.strictEqual(api.applyLayoutPreset(null, "qwertz", 0), null);
  assert.strictEqual(api.applyLayoutPreset({}, "qwertz", 0), null);
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
  assert.strictEqual(JSON.stringify(plan0.old), JSON.stringify({ keyPairs: config.keyPairs, layers: config.layers, combos: config.combos, leaderSequences: [] }));
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

test("Suche: Tastenpaare und Makro-Schritt haben ein Suchfeld", () => {
  const html = read("index.html");
  ["keyPairFirstSelect", "keyPairSecondSelect", "macroStepCode"].forEach(id => {
    assert.ok(html.includes(`data-filter-for="${id}"`), `Suchfeld fehlt für ${id}`);
  });
  const table = section("js/editor.js", "const FILTER_BLOCKS_BUTTON", "};");
  assert.ok(/keyPairFirstSelect:\s*"btnAddKeyPair"/.test(table));
  assert.ok(/keyPairSecondSelect:\s*"btnAddKeyPair"/.test(table));
  assert.ok(/macroStepCode:\s*"btnAddMacroStep"/.test(table));
  assert.ok(/Object\.keys\(FILTER_BLOCKS_BUTTON\)/.test(section("js/editor.js", "function populateKeycodeSelects", "function filterOptionNodes")));
  // Jeder Aufruf steht im Körper seiner eigenen Funktion (nicht im Körper der anderen)
  const stepInputs = section("js/macros-ui.js", "function updateMacroStepInputs", "function addMacroStepFromUI");
  const openEditor = section("js/macros-ui.js", "function openMacroEditor", "function closeMacroEditor");
  assert.ok(stepInputs.includes('clearSelectFilter("macroStepCode")'));
  assert.ok(openEditor.includes('clearSelectFilter("macroStepCode")'));
});

test("Suche: Tastenpaar- und Makro-Auswahl sperren ihren Knopf ohne Treffer, die Auswahl bleibt", () => {
  const els = {};
  const mkSelect = (id, texts) => {
    const hintHolder = { el: null };
    const opts = texts.map(t => ({ textContent: t, hidden: false, value: t }));
    const group = { tagName: "OPTGROUP", label: "Buchstaben", hidden: false, children: opts };
    opts.forEach(o => { o.parentElement = group; });
    const select = {
      id, children: [group], options: opts, selectedIndex: 0, dataset: {},
      get value() { return opts[this.selectedIndex].value; },
      parentElement: { querySelector: () => hintHolder.el },
      insertAdjacentElement(_pos, el) { hintHolder.el = el; }
    };
    group.parentElement = select;
    els[id] = select;
    els[`filter:${id}`] = { value: "" };
    return select;
  };
  mkSelect("keyPairFirstSelect", ["Shift (KEY_LEFT_SHIFT)", "A (KEY_A)"]);
  mkSelect("keyPairSecondSelect", ["Punkt (KEY_PERIOD)", "B (KEY_B)"]);
  mkSelect("macroStepCode", ["A (KEY_A)", "B (KEY_B)"]);
  ["btnAddKeyPair", "btnAddMacroStep"].forEach(id => { els[id] = { disabled: false, title: "" }; });
  const ctx = {
    document: {
      getElementById: id => els[id] || null,
      querySelector: sel => { const m = /data-filter-for="([^"]+)"/.exec(sel); return m ? els[`filter:${m[1]}`] || null : null; },
      createElement: () => ({ style: {}, dataset: {}, className: "", textContent: "" })
    }
  };
  vm.createContext(ctx);
  vm.runInContext(`${section("js/keycodes.js", "function keycodeOptionMatches", "\n}\n")}
}
const OPTIONAL_ACTION_PREFIX = {};
${section("js/editor.js", "function filterOptionNodes", "function switchEditSide")}`, ctx);
  const run = src => vm.runInContext(src, ctx);
  const query = (id, text) => { els[`filter:${id}`].value = text; run(`applySelectFilter("${id}")`); };

  query("macroStepCode", "zzzz");
  assert.strictEqual(els.btnAddMacroStep.disabled, true);
  assert.strictEqual(els.macroStepCode.selectedIndex, 0);
  assert.ok(els.macroStepCode.dataset.filterBlocked === "true");
  // Ein Treffer gibt den Knopf frei, eine Pause leert die Suche
  query("macroStepCode", "zzzz");
  run('clearSelectFilter("macroStepCode")');
  assert.strictEqual(els.btnAddMacroStep.disabled, false);
  assert.strictEqual(els.macroStepCode.options.every(o => !o.hidden), true);

  // Zwei Auswahlen teilen einen Knopf: er bleibt gesperrt, bis beide Suchen Treffer haben
  query("keyPairFirstSelect", "zzzz");
  query("keyPairSecondSelect", "zzzz");
  assert.strictEqual(els.btnAddKeyPair.disabled, true);
  run('clearSelectFilter("keyPairFirstSelect")');
  assert.strictEqual(els.btnAddKeyPair.disabled, true);
  run('clearSelectFilter("keyPairSecondSelect")');
  assert.strictEqual(els.btnAddKeyPair.disabled, false);
  // Eine Suche mit Treffer blendet nur Nicht-Treffer aus und ändert die Auswahl nicht
  query("keyPairSecondSelect", "punkt");
  assert.deepStrictEqual(els.keyPairSecondSelect.options.map(o => o.hidden), [false, true]);
  assert.strictEqual(els.keyPairSecondSelect.selectedIndex, 0);
  assert.strictEqual(els.btnAddKeyPair.disabled, false);
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
  for (const action of ["OSM_LSHIFT", "OSM_RGUI", "CAPS_WORD", "REPEAT", "ALT_REPEAT"]) {
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
  assert.ok(api.isOneShotOrCapsWordCode("ACT_REPEAT") && api.isOneShotOrCapsWordCode("ACT_ALT_REPEAT"));
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
      tagName: tag.toUpperCase(), children: [], listeners: {}, style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, disabled: false,
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
  // Acht Ebenen-Checkboxen des Combo-Dialogs (alle gewählt)
  const layerChecks = Array.from({ length: 8 }, (_, l) => ({ value: String(l), checked: true }));
  const document = {
    getElementById: id => byId[id] || (byId[id] = make()),
    createElement: tag => make(tag),
    querySelectorAll: sel => (sel === ".combo-layer-check" ? layerChecks : []),
    addEventListener() {}
  };
  return { document, byId, make, layerChecks };
}

// Kontext mit dem gemeinsamen Kern (code), einer Config der rechten Hälfte und Stubs für Anzeige und Server
function uiHarness(extra = "") {
  const dom = fakeDom();
  const log = { pending: [], toasts: [], alerts: [], saved: 0, sent: [], fetches: [], confirm: true };
  const w = {
    console: { log() {}, warn() {}, error() {} }, document: dom.document, log,
    setTimeout: fn => { Promise.resolve().then(fn); return 0; }, clearTimeout() {}
  };
  w.addEventListener = () => {};
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
var otherConfigs = { L: normalizeConfig(JSON.parse(JSON.stringify(SIDE_PROFILES.L.defaultConfig)), SIDE_PROFILES.L) };
function configFor(side) { return side === editSide ? currentConfig : otherConfigs[side]; }
function setConfigFor(side, cfg) { if (side === editSide) currentConfig = cfg; else otherConfigs[side] = cfg; }
function showToast(t) { log.toasts.push(t); }
function saveConfigToServer() { log.saved++; }
function renderMatrix() {} function renderLayerButtons() {} function renderCombosTable() {} function renderKeyPairs() {} function renderLeaderSequences() {}
function updateInspector() {} function applySettingsToInputs() {} function applySelectFilter() {} function clearSelectFilter() {}
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

test("Makro-UI: Import legt das Makro in den ersten freien Slot, Rückgängig entfernt es", () => {
  const { w, log } = uiHarness();
  vm.runInContext(`currentConfig.macros = [{ name: "a", steps: [{ type: "tap", code: "KEY_A" }] }];`, w);
  const text = JSON.stringify({ format: "dactyl-macro", version: 1, name: "Neu", steps: [{ type: "tap", code: "KEY_B" }] });
  assert.strictEqual(w.importMacroText(text), true);
  assert.strictEqual(vm.runInContext("currentConfig.macros.length", w), 2);
  assert.strictEqual(vm.runInContext("currentConfig.macros[1].name", w), "Neu");
  const change = log.pending.at(-1);
  assert.ok(change.snapshot && change.macros);
  assert.strictEqual(change.title, "Makro 1 importiert");
  change.revert();
  assert.strictEqual(vm.runInContext("currentConfig.macros.length", w), 1);
  const before = log.pending.length;
  assert.strictEqual(w.importMacroText("{kaputt"), false);
  assert.strictEqual(log.pending.length, before);
  assert.ok(log.toasts.at(-1).startsWith("Makro-Import abgelehnt"));
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

test("Leader-UI: die gewählte Aktion bleibt nach dem Neuzeichnen erhalten, auch ein Paar oder Makro", () => {
  const { w, dom } = uiHarness(read("js/leader-ui.js"));
  vm.runInContext(`currentConfig.macros = [{ name: "a", steps: [] }, { name: "b", steps: [] }];
    currentConfig.keyPairs = [{ first: "KEY_A", second: "KEY_B" }];
    currentConfig.leaderSequences = [];`, w);
  const select = dom.document.getElementById("leaderActionSelect");
  // Wie ein echtes select: options listet die Einträge aller Gruppen; ein Wert ohne Eintrag wird beim Setzen verworfen
  Object.defineProperty(select, "options", { get() { return this.children.flatMap(c => (c.tagName === "OPTGROUP" ? c.children : [c])); } });
  let value = "";
  Object.defineProperty(select, "value", {
    get() { return value; },
    set(v) { value = this.options.some(o => o.value === v) ? v : ""; }
  });
  Object.defineProperty(select, "innerHTML", { get() { return ""; }, set(_) { this.children = []; value = ""; } });
  w.renderLeaderSequences();
  select.value = "MACRO_1";
  assert.strictEqual(select.value, "MACRO_1");
  w.renderLeaderSequences();
  assert.strictEqual(select.value, "MACRO_1");
  select.value = "PAIR_0";
  w.renderLeaderSequences();
  assert.strictEqual(select.value, "PAIR_0");
});

test("Leader-UI: Makro und Paar löschen entfernt Sequenzen, Rückgängig stellt sie wieder her", () => {
  const { w, log } = uiHarness(section("js/key-pairs-ui.js", "// Löscht ein beliebiges Paar.", "function initKeyPairsUI"));
  vm.runInContext(`currentConfig.macros = [{ name: "a", steps: [] }, { name: "b", steps: [] }];
    currentConfig.keyPairs = [{ first: "KEY_A", second: "KEY_B" }, { first: "KEY_C", second: "KEY_D" }];
    currentConfig.leaderSequences = [{ keys: ["KEY_A"], action: "MACRO_0" }, { keys: ["KEY_B"], action: "MACRO_1" }, { keys: ["KEY_C"], action: "PAIR_1" }];`, w);
  const actions = () => JSON.parse(vm.runInContext("JSON.stringify(currentConfig.leaderSequences.map(q => q.action))", w));
  w.deleteMacro(0);
  assert.deepStrictEqual(actions(), ["MACRO_0", "PAIR_1"]);
  log.pending.at(-1).revert();
  assert.deepStrictEqual(actions(), ["MACRO_0", "MACRO_1", "PAIR_1"]);
  w.deleteKeyPair(0);
  assert.deepStrictEqual(actions(), ["MACRO_0", "MACRO_1", "PAIR_0"]);
  log.pending.at(-1).revert();
  assert.deepStrictEqual(actions(), ["MACRO_0", "MACRO_1", "PAIR_1"]);
});

test("Leader-UI: Rückgängig nach Löschen stellt keine Sequenz mit doppelten Tasten wieder her", () => {
  const { w, log } = uiHarness(read("js/leader-ui.js"));
  vm.runInContext(`currentConfig.leaderSequences = [{ keys: ["KEY_A"], action: "KEY_Z" }];`, w);
  const count = () => vm.runInContext("currentConfig.leaderSequences.length", w);
  w.deleteLeaderSequence(0);
  assert.strictEqual(count(), 0);
  vm.runInContext(`currentConfig.leaderSequences.push({ keys: ["KEY_A"], action: "KEY_Y" });`, w);
  log.pending.at(-1).revert();
  assert.strictEqual(count(), 1);
  assert.ok(log.toasts.at(-1).includes("denselben Tasten"));
});

test("Layout-Prüfung: Leader-Sequenz mit nicht definiertem Paar oder Makro", () => {
  const cfg = lintCfg();
  cfg.keyPairs = [{ first: "KEY_A", second: "KEY_B" }];
  cfg.macros = [{ name: "m", steps: [] }];
  cfg.leaderSequences = [
    { keys: ["KEY_A"], action: "PAIR_0" }, { keys: ["KEY_B"], action: "PAIR_1" },
    { keys: ["KEY_C"], action: "MACRO_0" }, { keys: ["KEY_D"], action: "MACRO_2" }, { keys: ["KEY_E"], action: "KEY_Z" }
  ];
  const found = lintCodes(lintBoth(cfg), "leader-undefined-target");
  assert.strictEqual(found.length, 2);
  assert.ok(found[0].message.includes("Leader-Sequenz 1") && found[0].message.includes("PAIR_1"));
  assert.ok(found[1].message.includes("Leader-Sequenz 3") && found[1].message.includes("MACRO_2"));
});

test("Pfeiltasten: Auswahl bewegt sich in der Finger-Matrix und überspringt fehlende Tasten", () => {
  const mv = (r, c, d, p = R) => { const n = api.moveKeySelection(r, c, d, p); return [n.r, n.c, n.isThumb]; };
  assert.deepStrictEqual(mv(2, 2, "up"), [1, 2, false]);
  assert.deepStrictEqual(mv(2, 2, "down"), [3, 2, false]);
  assert.deepStrictEqual(mv(2, 2, "left"), [2, 1, false]);
  assert.deepStrictEqual(mv(2, 2, "right"), [2, 3, false]);
  // Rechts fehlt R4C0: von R4C1 nach links bleibt die Auswahl, von R3C0 nach unten auch
  assert.deepStrictEqual(mv(4, 1, "left"), [4, 1, false]);
  assert.deepStrictEqual(mv(3, 0, "down"), [3, 0, false]);
  // Links fehlt R4C5
  assert.deepStrictEqual(mv(3, 5, "down", L), [3, 5, false]);
  assert.deepStrictEqual(mv(4, 4, "right", L), [4, 4, false]);
  assert.deepStrictEqual(mv(4, 5, "down"), [4, 5, false]);
});

test("Pfeiltasten: Auswahl stoppt am Rand der Matrix", () => {
  for (const [r, c, d] of [[0, 3, "up"], [4, 3, "down"], [2, 0, "left"], [2, 5, "right"], [0, 0, "up"], [0, 0, "left"]]) {
    const n = api.moveKeySelection(r, c, d, R);
    assert.deepStrictEqual([n.r, n.c], [r, c], `${r},${c} ${d}`);
  }
  // Unbekannte Richtung oder kein Profil: keine Bewegung
  assert.deepStrictEqual([api.moveKeySelection(2, 2, "diagonal", R).r, api.moveKeySelection(2, 2, "up", null).r], [2, 2]);
});

test("Pfeiltasten: Daumen-Cluster folgt seinem Raster und stoppt am Rand", () => {
  const mv = (c, d, p = R) => { const n = api.moveKeySelection(5, c, d, p); return [n.r, n.c, n.isThumb]; };
  // Rechts: Esc(5,6) | Cmd(5,0) oben; Alt(5,1), Tab(5,4) links; Space(5,3) und Enter(5,2) 2U
  assert.deepStrictEqual(mv(6, "right"), [5, 0, true]);
  assert.deepStrictEqual(mv(6, "down"), [5, 1, true]);
  assert.deepStrictEqual(mv(1, "down"), [5, 4, true]);
  assert.deepStrictEqual(mv(1, "right"), [5, 3, true]);
  assert.deepStrictEqual(mv(4, "right"), [5, 3, true]);
  assert.deepStrictEqual(mv(3, "right"), [5, 2, true]);
  assert.deepStrictEqual(mv(3, "up"), [5, 0, true]);
  assert.deepStrictEqual(mv(3, "left"), [5, 1, true]);
  assert.deepStrictEqual(mv(0, "down"), [5, 3, true]);
  for (const [c, d] of [[6, "up"], [6, "left"], [4, "down"], [2, "right"], [2, "up"], [2, "down"], [0, "right"]]) {
    assert.deepStrictEqual(mv(c, d), [5, c, true], `R5C${c} ${d}`);
  }
  // Links (gespiegelt): Cmd(5,5) | Alt(5,6) oben
  assert.deepStrictEqual(mv(5, "right", L), [5, 6, true]);
  assert.deepStrictEqual(mv(6, "down", L), [5, 4, true]);
  assert.deepStrictEqual(mv(3, "right", L), [5, 2, true]);
  assert.deepStrictEqual(mv(3, "left", L), [5, 3, true]);
  // Links: Ctrl(5,3) | Del(5,2) 2U, Space(5,4) und Bksp(5,1) rechts
  assert.deepStrictEqual(mv(2, "up", L), [5, 5, true]);
  assert.deepStrictEqual(mv(5, "left", L), [5, 5, true]);
  assert.deepStrictEqual(mv(5, "down", L), [5, 2, true]);
  assert.deepStrictEqual(mv(3, "up", L), [5, 3, true]);
  assert.deepStrictEqual(mv(2, "right", L), [5, 4, true]);
  assert.deepStrictEqual(mv(4, "down", L), [5, 1, true]);
  assert.deepStrictEqual(mv(1, "up", L), [5, 4, true]);
  assert.deepStrictEqual(mv(1, "left", L), [5, 2, true]);
  assert.deepStrictEqual(mv(6, "right", L), [5, 6, true]);
  // Gegenrichtung führt zurück, wo das Raster eindeutig ist (beide Hälften)
  const back = { up: "down", down: "up", left: "right", right: "left" };
  for (const [p, pairs] of [[R, [[6, "right"], [6, "down"], [1, "down"], [3, "right"]]],
                            [L, [[5, "right"], [6, "down"], [4, "down"], [3, "right"]]]]) {
    for (const [c, d] of pairs) {
      const n = api.moveKeySelection(5, c, d, p);
      assert.strictEqual(api.moveKeySelection(n.r, n.c, back[d], p).c, c, `R5C${c} ${d}`);
    }
  }
});

// Taste über den Inspektor übernehmen (setupEventListeners aus js/editor-events.js)
function applyKeyHarness() {
  const h = uiHarness(`var pendingChanges = [];
function togglePendingChangesDrawer() {} function discardAllPendingChanges() {} function populateComboKeyDropdowns() {}
function renderPendingSyncUI() {} function setPendingFor() {} function setupActionSearch() {}
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

asyncTests.push(["Pfeiltasten: keydown bewegt die Auswahl, nicht in Eingabefeldern und nicht mit Modifier", async () => {
  const docListeners = [];
  const h = uiHarness(`var pendingChanges = [], selected = [];
function togglePendingChangesDrawer() {} function discardAllPendingChanges() {} function populateComboKeyDropdowns() {}
function renderPendingSyncUI() {} function setPendingFor() {} function setupActionSearch() {}
function writeConfigWithDiff() {} function saveAndFlashToDactyl() {} function readConfigFromESP32() {}
function selectKey(r, c, side, isThumb) { selectedKey = { r, c, side, isThumb }; selected.push([r, c, side, isThumb]); }
${read("js/editor-events.js")}`);
  const { w } = h;
  w.document.addEventListener = (type, fn) => type === "keydown" && docListeners.push(fn);
  const modals = [{ style: { display: "none" } }, { style: { display: "none" } }];
  w.document.querySelectorAll = sel => (sel === ".modal-backdrop" ? modals : []);
  w.setupEventListeners();
  const press = (key, ev = {}) => {
    let prevented = false;
    for (const fn of docListeners) fn({ key, target: {}, preventDefault: () => { prevented = true; }, ...ev });
    return prevented;
  };
  // Ohne Auswahl: keine Wirkung, Seite scrollt normal
  assert.strictEqual(press("ArrowDown"), false);
  vm.runInContext(`selectedKey = { r: 2, c: 2, side: "R", isThumb: false };`, w);
  assert.strictEqual(press("ArrowDown"), true);
  assert.strictEqual(vm.runInContext("JSON.stringify(selected.at(-1))", w), JSON.stringify([3, 2, "R", false]));
  press("ArrowRight");
  assert.strictEqual(vm.runInContext("`${selectedKey.r},${selectedKey.c}`", w), "3,3");
  // Am Rand: keine neue Auswahl
  vm.runInContext(`selectedKey = { r: 0, c: 0, side: "R", isThumb: false }; selected = [];`, w);
  press("ArrowUp");
  press("ArrowLeft");
  assert.strictEqual(vm.runInContext("selected.length", w), 0);
  // Eingabefeld und Modifier: keine Bewegung
  vm.runInContext(`isEditableTarget = () => true;`, w);
  assert.strictEqual(press("ArrowDown"), false);
  vm.runInContext(`isEditableTarget = () => false;`, w);
  for (const mod of ["metaKey", "ctrlKey", "altKey", "shiftKey"]) assert.strictEqual(press("ArrowDown", { [mod]: true }), false);
  assert.strictEqual(vm.runInContext("selected.length", w), 0);
  // Schon behandelter Tastendruck und offener Dialog: keine Bewegung
  vm.runInContext(`selectedKey = { r: 2, c: 2, side: "R", isThumb: false };`, w);
  assert.strictEqual(press("ArrowDown", { defaultPrevented: true }), false);
  modals[1].style.display = "flex";
  assert.strictEqual(press("ArrowDown"), false);
  assert.strictEqual(vm.runInContext("selected.length", w), 0);
  modals[1].style.display = "none";
  // Daumen-Cluster: der Handler gibt isThumb weiter
  vm.runInContext(`selectedKey = { r: 5, c: 6, side: "R", isThumb: true };`, w);
  press("ArrowRight");
  assert.strictEqual(vm.runInContext("JSON.stringify(selected.at(-1))", w), JSON.stringify([5, 0, "R", true]));
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
  for (const action of ["OSM_LSHIFT", "CAPS_WORD", "REPEAT", "ALT_REPEAT"]) {
    await save("MODIFIER_HOLD", action);
    assert.strictEqual(count(), before);
    assert.ok(log.alerts.at(-1).includes("Modifier Hold"));
  }
  // Gegenprobe: KEY_PRESS mit One-Shot und MODIFIER_HOLD mit Shift werden gespeichert
  await save("KEY_PRESS", "OSM_LSHIFT");
  await save("MODIFIER_HOLD", "KEY_LEFT_SHIFT");
  assert.strictEqual(count(), before + 2);
}]);

asyncTests.push(["Combo-Dialog: Ebenenmaske wird gespeichert, alle Ebenen bleiben ohne Feld, keine Ebene wird abgelehnt", async () => {
  const { w, dom, log } = applyKeyHarness();
  const el = id => dom.document.getElementById(id);
  const save = async (layers) => {
    dom.layerChecks.forEach((c, l) => { c.checked = layers.includes(l); });
    el("comboKey1Select").value = "2,1";
    el("comboKey2Select").value = "2,2";
    el("comboBehaviorSelect").value = "KEY_PRESS";
    const sel = el("comboActionSelect");
    sel.value = "KEY_ESC";
    sel.options = [{ text: "KEY_ESC" }];
    sel.selectedIndex = 0;
    await el("btnSaveCombo").click();
  };
  const count = () => vm.runInContext("currentConfig.combos.length", w);
  const last = () => JSON.parse(vm.runInContext("JSON.stringify(currentConfig.combos.at(-1))", w));
  const before = count();
  await save([]);
  assert.strictEqual(count(), before, "ohne Ebene wird nichts gespeichert");
  assert.ok(log.alerts.at(-1).includes("Ebene"));
  await save([0, 2]);
  assert.strictEqual(count(), before + 1);
  assert.strictEqual(last().layerMask, 0b101);
  await save([0, 1, 2, 3, 4, 5, 6, 7]);
  assert.strictEqual(count(), before + 2);
  assert.ok(!("layerMask" in last()), "alle Ebenen ist der Standard und steht nicht in der Datei");
}]);

asyncTests.push(["Import: Bündel ersetzt beide Hälften, ungültige Hälfte ändert nichts", async () => {
  const { w, dom, log } = applyKeyHarness();
  const run = async cfg => {
    w.FileReader = function () {
      this.readAsText = () => Promise.resolve().then(() => this.onload({ target: { result: JSON.stringify(cfg) } }));
    };
    await dom.document.getElementById("fileInput").fire("change", { target: { files: [{ name: "b.json" }], value: "" } });
    await new Promise(r => setImmediate(r));
  };
  const cell = t => ({ tap: t, hold: "NONE", dtap: "NONE", label: t });
  const mk = side => {
    const c = JSON.parse(JSON.stringify(api.SIDE_PROFILES[side].defaultConfig));
    c.layers[0][0][1] = cell("KEY_F5");
    return c;
  };
  const tap = expr => vm.runInContext(expr, w);
  const bad = mk("L");
  bad.layers = "kaputt";
  await run({ bundleVersion: 1, sides: { R: mk("R"), L: bad } });
  assert.strictEqual(log.alerts.length, 1);
  assert.strictEqual(log.pending.length, 0);
  assert.notStrictEqual(tap("currentConfig.layers[0][0][1].tap"), "KEY_F5");
  assert.notStrictEqual(tap("otherConfigs.L.layers[0][0][1].tap"), "KEY_F5");
  await run({ bundleVersion: 1, sides: { R: mk("R"), L: mk("L") } });
  assert.strictEqual(tap("currentConfig.layers[0][0][1].tap"), "KEY_F5");
  assert.strictEqual(tap("otherConfigs.L.layers[0][0][1].tap"), "KEY_F5");
  assert.deepStrictEqual(log.pending.map(c => c.type), ["import", "import"]);
  log.pending[1].revert();
  assert.notStrictEqual(tap("otherConfigs.L.layers[0][0][1].tap"), "KEY_F5");
  assert.strictEqual(tap("currentConfig.layers[0][0][1].tap"), "KEY_F5");
}]);

asyncTests.push(["Import: Einzel-Config merkt genau eine Änderung der gewählten Hälfte vor", async () => {
  const { w, dom, log } = applyKeyHarness();
  const cfg = JSON.parse(JSON.stringify(api.SIDE_PROFILES.R.defaultConfig));
  cfg.layers[0][0][1] = { tap: "KEY_F5", hold: "NONE", dtap: "NONE", label: "F5" };
  w.FileReader = function () {
    this.readAsText = () => {
      // Hälfte wechselt, bevor das Lesen endet: das Ziel bleibt die beim Auswählen bearbeitete Hälfte
      // (Die Harness hält die nicht bearbeitete Hälfte in otherConfigs: R wandert dorthin, L wird bearbeitet.)
      vm.runInContext('otherConfigs.R = currentConfig; currentConfig = otherConfigs.L; editSide = "L";', w);
      Promise.resolve().then(() => this.onload({ target: { result: JSON.stringify(cfg) } }));
    };
  };
  await dom.document.getElementById("fileInput").fire("change", { target: { files: [{ name: "s.json" }], value: "" } });
  await new Promise(r => setImmediate(r));
  assert.deepStrictEqual(log.alerts, []);
  assert.strictEqual(log.pending.length, 1);
  assert.strictEqual(vm.runInContext("otherConfigs.R.layers[0][0][1].tap", w), "KEY_F5");
  assert.notStrictEqual(vm.runInContext("currentConfig.layers[0][0][1].tap", w), "KEY_F5");
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
  h.backups = { body: { backups: [], skipped: 0 } };
  h.nvsBackups = { body: { backups: [] } };
  h.nvsRestore = { status: 200, body: { success: true, port: "/dev/cu.usbserial-a", side: "R", id: "nvs-000001-20261103-120000-000" } };
  h.w.fetch = async (url, opts = {}) => {
    // Backups haben eine eigene Antwort; die Warteschlange gilt nur für /api/profiles
    if (url.startsWith("/api/backups")) {
      h.log.backupFetches = (h.log.backupFetches || 0) + 1;
      const { status = 200, body } = h.backups;
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    }
    if (url.startsWith("/api/nvs_backups")) {
      h.log.nvsBackupFetches = (h.log.nvsBackupFetches || 0) + 1;
      const { status = 200, body } = h.nvsBackups;
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    }
    if (url.startsWith("/api/nvs_restore")) {
      h.log.nvsRestoreCalls = (h.log.nvsRestoreCalls || 0) + 1;
      h.log.fetches.push({ url, method: opts.method || "POST", body: opts.body ? JSON.parse(opts.body) : null });
      const { status = 200, body } = h.nvsRestore;
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    }
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

asyncTests.push(["Backups: Dialog listet Backups der Hälfte und lädt eines mit Rückgängig", async () => {
  const h = profilesHarness([{ body: { profiles: [], revision: 0, skipped: [] } }]);
  const backupCfg = { layers: [[[{ tap: "KEY_W" }]]] };
  h.backups = { body: { backups: [
    { id: "backup-000002-20261029-120000-000", savedAt: "2026-10-29T12:00:00+0100", reason: "flash", config: backupCfg },
    { id: "backup-000001-20261029-110000-000", savedAt: "", reason: "sync", config: { layers: [[[{ tap: "KEY_V" }]]] } }
  ], skipped: 1 } };
  await h.w.openLayoutProfilesDialog();
  const list = h.dom.document.getElementById("layoutBackupsList");
  assert.strictEqual(list.children.length, 2);
  assert.strictEqual(list.children[0].children[1].textContent, "vor Flash");
  // Ohne gültigen Zeitstempel zeigt die Zeile die ID
  assert.strictEqual(list.children[1].children[0].textContent, "backup-000001-20261029-110000-000");
  assert.ok(h.dom.document.getElementById("layoutBackupsStatus").textContent.includes("1 unlesbare"));
  const before = vm.runInContext("JSON.stringify(currentConfig.layers[0][0][0])", h.w);
  // Abbruch in der Rückfrage: nichts ändert sich
  h.log.confirm = false;
  await list.children[0].children[2].click();
  assert.strictEqual(h.log.pending.length, 0);
  h.log.confirm = true;
  await list.children[0].children[2].click();
  const change = h.log.pending.at(-1);
  assert.ok(change.snapshot && change.pairs && change.macros && change.type === "backup_load");
  assert.strictEqual(vm.runInContext("currentConfig.layers[0][0][0].tap", h.w), "KEY_W");
  assert.ok(h.log.saved > 0);
  change.revert();
  assert.strictEqual(vm.runInContext("JSON.stringify(currentConfig.layers[0][0][0])", h.w), before);
  // Andere Hälfte bearbeitet: Laden tut nichts
  await h.w.openLayoutProfilesDialog();
  vm.runInContext(`editSide = "L";`, h.w);
  h.w.loadLayoutBackup("backup-000002-20261029-120000-000");
  assert.strictEqual(h.log.pending.length, 1);
}]);

asyncTests.push(["Backups: Fehler und leere Liste zeigen einen Hinweis", async () => {
  const h = profilesHarness([{ body: { profiles: [], revision: 0, skipped: [] } }, { body: { profiles: [], revision: 0, skipped: [] } }]);
  h.backups = { status: 500, body: { success: false, error: "kaputt" } };
  await h.w.openLayoutProfilesDialog();
  assert.ok(h.dom.document.getElementById("layoutBackupsStatus").textContent.includes("kaputt"));
  h.backups = { body: { backups: [], skipped: 0 } };
  await h.w.openLayoutProfilesDialog();
  assert.ok(h.dom.document.getElementById("layoutBackupsStatus").textContent.includes("Noch kein Backup"));
  assert.strictEqual(h.dom.document.getElementById("layoutBackupsList").children.length, 0);
}]);

asyncTests.push(["NVS-Sicherungen: Dialog listet NVS-Abbilder der Hälfte und stellt eines nach Bestätigung wieder her", async () => {
  const h = profilesHarness([{ body: { profiles: [], revision: 0, skipped: [] } }]);
  h.nvsBackups = { body: { backups: [
    { id: "nvs-000002-20261103-120000-000", savedAt: "2026-11-03T12:00:00+0100" },
    { id: "nvs-000001-20261103-110000-000", savedAt: "" }
  ] } };
  await h.w.openLayoutProfilesDialog();
  const list = h.dom.document.getElementById("nvsBackupsList");
  assert.strictEqual(list.children.length, 2);
  assert.ok(h.dom.document.getElementById("nvsBackupsStatus").textContent.includes("2 NVS-Sicherungen"));
  // Zeile 1 hat formatiertes Datum
  assert.notStrictEqual(list.children[0].children[0].textContent, "nvs-000002-20261103-120000-000");
  assert.strictEqual(list.children[0].children[1].textContent, "nvs-000002-20261103-120000-000");
  // Zeile 2 ohne gültiges savedAt zeigt die ID als Name
  assert.strictEqual(list.children[1].children[0].textContent, "nvs-000001-20261103-110000-000");

  // Abbruch in der Rückfrage
  h.log.confirm = false;
  await list.children[0].children[2].click();
  assert.strictEqual(h.log.nvsRestoreCalls || 0, 0);

  // Bestätigt
  h.log.confirm = true;
  await list.children[0].children[2].click();
  assert.strictEqual(h.log.nvsRestoreCalls, 1);
  const post = h.log.fetches.find(f => f.url.startsWith("/api/nvs_restore"));
  assert.strictEqual(post.url, "/api/nvs_restore?side=R");
  assert.deepStrictEqual(post.body, { id: "nvs-000002-20261103-120000-000" });
  assert.ok(h.log.toasts.some(t => t.includes("NVS-Sicherung") && t.includes("zurückgeschrieben")));
  // Nach dem Restore wurden die NVS-Backups neu geladen
  assert.ok((h.log.nvsBackupFetches || 0) >= 2);

  // Klick bei abweichender Hälfte tut nichts
  vm.runInContext(`editSide = "L";`, h.w);
  h.w.restoreNvsBackup("nvs-000002-20261103-120000-000");
  assert.strictEqual(h.log.nvsRestoreCalls, 1);
}]);

asyncTests.push(["NVS-Sicherungen: Fehler und leere Liste zeigen einen Hinweis; Restore-Fehler meldet Alert", async () => {
  const h = profilesHarness([{ body: { profiles: [], revision: 0, skipped: [] } }, { body: { profiles: [], revision: 0, skipped: [] } }]);
  h.nvsBackups = { status: 500, body: { success: false, error: "NVS nicht lesbar" } };
  await h.w.openLayoutProfilesDialog();
  assert.ok(h.dom.document.getElementById("nvsBackupsStatus").textContent.includes("NVS nicht lesbar"));

  h.nvsBackups = { body: { backups: [] } };
  await h.w.openLayoutProfilesDialog();
  assert.ok(h.dom.document.getElementById("nvsBackupsStatus").textContent.includes("Noch keine NVS-Sicherung"));
  assert.strictEqual(h.dom.document.getElementById("nvsBackupsList").children.length, 0);

  // Fehlgeschlagener Restore
  h.nvsBackups = { body: { backups: [{ id: "nvs-000001", savedAt: "" }] } };
  h.nvsRestore = { status: 500, body: { success: false, error: "Kein USB-Port gefunden" } };
  await h.w.openLayoutProfilesDialog();
  h.log.confirm = true;
  await h.dom.document.getElementById("nvsBackupsList").children[0].children[2].click();
  assert.ok(h.log.alerts.some(a => a.includes("Kein USB-Port gefunden")));
  assert.strictEqual(vm.runInContext("layoutProfilesBusy", h.w), false);
}]);

asyncTests.push(["NVS-Sicherungen: restoreNvsBackup trennt aktiven Serial-Port und verbindet ihn wieder", async () => {
  const h = profilesHarness([{ body: { profiles: [], revision: 0, skipped: [] } }]);
  h.nvsBackups = { body: { backups: [{ id: "nvs-000001", savedAt: "" }] } };
  vm.runInContext(`
    serialPort = { dummy: true };
    window.serialPort = serialPort;
    disconnectSerial = async () => { log.disconnected = (log.disconnected || 0) + 1; serialPort = null; window.serialPort = null; };
    window.disconnectSerial = disconnectSerial;
    connectSerial = async (opts) => { log.reconnected = (log.reconnected || 0) + 1; serialPort = { dummy: true }; window.serialPort = serialPort; };
    window.connectSerial = connectSerial;
  `, h.w);
  await h.w.openLayoutProfilesDialog();
  h.log.confirm = true;
  await h.dom.document.getElementById("nvsBackupsList").children[0].children[2].click();
  assert.strictEqual(h.log.disconnected, 1);
  assert.strictEqual(h.log.reconnected, 1);
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

test("Flash-Protokoll: NDJSON-Zeilen über Stückgrenzen hinweg", () => {
  const sp = api.createNdjsonSplitter();
  assert.strictEqual(sp.push('{"type":"log","li').length, 0);
  const out = sp.push('ne":"a"}\n{"type":"log","line":"b"}\n{"type":"res');
  assert.deepStrictEqual([...out.map(e => e.line)], ["a", "b"]);
  // Kaputte Zeilen und Nicht-Objekte werden übersprungen, der Rest bleibt erhalten
  assert.deepStrictEqual([...sp.push('ult","success":true}\nkaputt\n42\n\n').map(e => ({ ...e }))], [{ type: "result", success: true }]);
  assert.strictEqual(sp.push('{"type":"log","line":"ohne Zeilenende"}').length, 0);
  assert.deepStrictEqual([...sp.flush().map(e => e.line)], ["ohne Zeilenende"]);
  assert.strictEqual(sp.flush().length, 0);
});

test("Flash-Protokoll: Zeilenliste kürzt die ältesten Zeilen", () => {
  const lines = [];
  for (let i = 0; i < api.FLASH_LOG_MAX_LINES + 5; i++) api.appendFlashLogLine(lines, `z${i}`);
  assert.strictEqual(lines.length, api.FLASH_LOG_MAX_LINES);
  assert.strictEqual(lines[0], "z5");
  assert.strictEqual(lines[lines.length - 1], `z${api.FLASH_LOG_MAX_LINES + 4}`);
  assert.deepStrictEqual([...api.appendFlashLogLine(["a", "b"], "c", 2)], ["b", "c"]);
});

test("Flash-Protokoll: Phasen-Namen", () => {
  assert.strictEqual(api.flashStageLabel("compile"), "Kompilieren");
  assert.strictEqual(api.flashStageLabel("upload"), "Upload");
  assert.strictEqual(api.flashStageLabel("port"), "USB-Port");
  assert.strictEqual(api.flashStageLabel("nvs"), "NVS-Sicherung");
  assert.strictEqual(api.flashStageLabel(undefined), "Flashen");
});

// =============================================================================
// Layout-Prüfung (lintLayouts, js/config-model.js)
// =============================================================================
// Leere Konfiguration mit transparenten Ebenen; set() belegt eine Taste, combo() fügt eine Combo hinzu
function lintCfg() {
  return { layers: Array.from({ length: 8 }, () => api.transparentLayer()), combos: [], keyPairs: [], macros: [] };
}
function lintSet(cfg, l, r, c, tap, hold = "NONE", dtap = "NONE") {
  cfg.layers[l][r][c] = { label: "x", tap, hold, dtap };
}
function lintCombo(cfg, k1, k2, behavior = "KEY_PRESS", action = "KEY_A") {
  cfg.combos.push({ key1: { r: k1[0], c: k1[1] }, key2: { r: k2[0], c: k2[1] }, behavior, action });
}
// Beide Hälften mit einem Weg in und aus Ebene 1 (MO_1 auf Ebene 0, rechts), damit nur der geprüfte Fall auffällt
function lintBoth(right, left = lintCfg()) {
  return api.lintLayouts({ R: right, L: left }, api.SIDE_PROFILES);
}
function lintCodes(findings, code) {
  return [...findings].filter(f => f.code === code).map(f => ({ ...f }));
}

test("Layout-Prüfung: leeres Layout ohne Befund, ohne Konfiguration kein Absturz", () => {
  assert.deepStrictEqual([...lintBoth(lintCfg())], []);
  assert.deepStrictEqual([...api.lintLayouts({}, api.SIDE_PROFILES)], []);
  assert.deepStrictEqual([...api.lintLayouts(undefined, undefined)], []);
  // Eine Hälfte ohne Profil oder Konfiguration wird übersprungen
  assert.deepStrictEqual([...api.lintLayouts({ R: lintCfg(), X: lintCfg(), L: null }, api.SIDE_PROFILES)], []);
});

test("Layout-Prüfung: Aktion auf einer fehlenden Taste (R5C5 rechts, R2C6 außerhalb der Matrix)", () => {
  const cfg = lintCfg();
  for (let l = 0; l < 8; l++) lintSet(cfg, l, 5, 5, "KEY_BACKSPACE");
  lintSet(cfg, 0, 2, 6, "KEY_DELETE");
  lintSet(cfg, 3, 2, 6, "KEY_DELETE");
  lintSet(cfg, 0, 4, 0, "KEY_A", "KEY_B");               // R4C0 fehlt rechts
  const found = lintCodes(lintBoth(cfg), "absent-key-action");
  assert.deepStrictEqual(found.map(f => f.side), ["R", "R", "R"]);
  const text = found.map(f => f.message).join("\n");
  assert.ok(text.includes("R5C5 hat auf allen Ebenen"), text);
  assert.ok(text.includes("R2C6 hat auf Ebenen 0, 3"), text);
  assert.ok(text.includes("R4C0 hat auf Ebene 0"), text);
  assert.ok(found.every(f => f.level === "warn"));
  // Dieselben Positionen sind links echte Tasten (R5C5) oder fehlen auch (R4C0 ist links vorhanden)
  const left = lintCfg();
  lintSet(left, 0, 5, 5, "KEY_UP_ARROW");
  lintSet(left, 0, 4, 0, "KEY_LEFT_CTRL");
  assert.deepStrictEqual(lintCodes(lintBoth(lintCfg(), left), "absent-key-action"), []);
  // Links fehlen R4C5 und R5C0
  const left2 = lintCfg();
  lintSet(left2, 1, 5, 0, "KEY_A");
  const f2 = lintCodes(lintBoth(lintCfg(), left2), "absent-key-action");
  assert.strictEqual(f2.length, 1);
  assert.strictEqual(f2[0].side, "L");
  assert.ok(f2[0].message.includes("R5C0 hat auf Ebene 1"));
});

test("Layout-Prüfung: nur eine Halte- oder Doppel-Tipp-Aktion auf einer fehlenden Taste zählt auch", () => {
  const holdOnly = lintCfg();
  lintSet(holdOnly, 0, 5, 5, "NONE", "KEY_LEFT_CTRL");
  assert.strictEqual(lintCodes(lintBoth(holdOnly), "absent-key-action").length, 1);
  const dtapOnly = lintCfg();
  lintSet(dtapOnly, 0, 5, 5, "NONE", "NONE", "KEY_A");
  assert.strictEqual(lintCodes(lintBoth(dtapOnly), "absent-key-action").length, 1);
  // Eine Zelle als reiner Code-String (älteres Format) und "0" als leere Aktion
  const stringCell = lintCfg();
  stringCell.layers[0][5][5] = "KEY_A";
  assert.strictEqual(lintCodes(lintBoth(stringCell), "absent-key-action").length, 1);
  const zero = lintCfg();
  zero.layers[0][5][5] = { tap: "0", hold: "", dtap: "NONE" };
  assert.strictEqual(lintCodes(lintBoth(zero), "absent-key-action").length, 0);
});

test("Tri-Layer: Einstellung wird bereinigt (Normalisierung)", () => {
  const n = rules => JSON.parse(JSON.stringify(api.normalizeConfig({ layers: [[]], settings: { triLayers: rules } }, R).settings.triLayers));
  assert.deepStrictEqual(n(undefined), []);
  assert.deepStrictEqual(n("x"), []);
  assert.deepStrictEqual(n([{ a: 1, b: 2, target: 3 }]), [{ a: 1, b: 2, target: 3 }]);
  assert.deepStrictEqual(n([{ a: 1, b: 1, target: 3 }, { a: 1, b: 2, target: 2 }, { a: 0, b: 2, target: 3 }, { a: 1, b: 2, target: 8 }, null]), []);
  assert.strictEqual(n([{ a: 1, b: 2, target: 3 }, { a: 4, b: 5, target: 6 }, { a: 1, b: 3, target: 7 }]).length, 2);
});

test("Layout-Prüfung: Tri-Layer-Ziel ist erreichbar", () => {
  // Ebene 3 hat eigene Belegung; MO_1 rechts und MO_2 links führen mit der Regel (1, 2) -> 3 dorthin
  const right = lintCfg();
  lintSet(right, 3, 1, 1, "KEY_A");
  lintSet(right, 0, 5, 0, "MO_1");
  const left = lintCfg();
  lintSet(left, 0, 5, 1, "MO_2");
  assert.strictEqual(lintCodes(lintBoth(right, left), "layer-unreachable").length, 1);
  right.settings = { triLayers: [{ a: 1, b: 2, target: 3 }] };
  assert.deepStrictEqual(lintCodes(lintBoth(right, left), "layer-unreachable"), []);
  // Die Regel der linken Hälfte zählt ebenso
  right.settings = {};
  left.settings = { triLayers: [{ a: 1, b: 2, target: 3 }] };
  assert.deepStrictEqual(lintCodes(lintBoth(right, left), "layer-unreachable"), []);
  // a unerreichbar: Ziel bleibt unerreichbar
  const noA = lintCfg();
  lintSet(noA, 3, 1, 1, "KEY_A");
  lintSet(noA, 0, 5, 0, "MO_2");
  noA.settings = { triLayers: [{ a: 1, b: 2, target: 3 }] };
  assert.strictEqual(lintCodes(lintBoth(noA), "layer-unreachable").length, 1);
});

test("Layout-Prüfung: Ebene ohne Weg hinein ist unerreichbar, mit MO, TG, Combo oder der anderen Hälfte nicht", () => {
  const unreachable = lintCfg();
  lintSet(unreachable, 2, 1, 1, "KEY_A");
  let found = lintCodes(lintBoth(unreachable), "layer-unreachable");
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].side, null);
  assert.ok(found[0].message.startsWith("Ebene 2 hat eigene Belegung"), found[0].message);

  // MO_2 auf Ebene 0 der rechten Hälfte
  const mo = lintCfg();
  lintSet(mo, 2, 1, 1, "KEY_A");
  lintSet(mo, 0, 5, 0, "MO_2");
  assert.deepStrictEqual(lintCodes(lintBoth(mo), "layer-unreachable"), []);
  // Als Halte-Aktion (Layer-Tap)
  const hold = lintCfg();
  lintSet(hold, 2, 1, 1, "KEY_A");
  lintSet(hold, 0, 5, 0, "KEY_DELETE", "MO_2");
  assert.deepStrictEqual(lintCodes(lintBoth(hold), "layer-unreachable"), []);
  // Der Weg liegt auf der anderen Hälfte: die Ebene gilt für beide
  const left = lintCfg();
  lintSet(left, 0, 5, 1, "TG_2");
  assert.deepStrictEqual(lintCodes(lintBoth(unreachable, left), "layer-unreachable"), []);
  // Eine Combo "Layer umschalten" (Aktion & 7 = Ebene)
  const combo = lintCfg();
  lintSet(combo, 2, 1, 1, "KEY_A");
  lintCombo(combo, [2, 1], [2, 2], "LAYER_TOGGLE", "TG_2");
  assert.deepStrictEqual(lintCodes(lintBoth(combo), "layer-unreachable"), []);
  // Eine Ebene ohne eigene Belegung (nur Kopie von Ebene 0) ist nicht unerreichbar
  const copy = lintCfg();
  lintSet(copy, 0, 1, 1, "KEY_A");
  lintSet(copy, 4, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(copy), "layer-unreachable"), []);
});

test("Layout-Prüfung: erreichbar nur über eine unerreichbare Ebene bleibt unerreichbar, über LAYER_UP/DOWN nicht", () => {
  // Ebene 3 hat MO_4, aber Ebene 3 selbst ist nicht erreichbar: Ebene 4 auch nicht
  const chain = lintCfg();
  lintSet(chain, 3, 0, 0, "MO_4");
  lintSet(chain, 4, 1, 1, "KEY_A");
  const found = lintCodes(lintBoth(chain), "layer-unreachable");
  assert.strictEqual(found.length, 1);
  assert.ok(found[0].message.startsWith("Ebenen 3, 4 haben eigene Belegung"), found[0].message);
  // Ketten über erreichbare Ebenen: 0 -> 1 -> 2
  const ok = lintCfg();
  lintSet(ok, 0, 5, 0, "MO_1");
  lintSet(ok, 1, 0, 0, "MO_2");
  lintSet(ok, 2, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(ok), "layer-unreachable"), []);
  // LAYER_UP von Ebene 0 führt nach Ebene 1, LAYER_DOWN von Ebene 0 nach Ebene 7 (Umlauf)
  const up = lintCfg();
  lintSet(up, 0, 5, 0, "LAYER_UP");
  lintSet(up, 1, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(up), "layer-unreachable"), []);
  const down = lintCfg();
  lintSet(down, 0, 5, 0, "LAYER_DOWN");
  lintSet(down, 7, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(down), "layer-unreachable"), []);
  // Die Firmware-Schreibweise ACT_MO_n zählt wie MO_n
  const act = lintCfg();
  lintSet(act, 0, 5, 0, "ACT_MO_5");
  lintSet(act, 5, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(act), "layer-unreachable"), []);
});

test("Layout-Prüfung: Aktionen auf einer fehlenden Taste öffnen keinen Weg in eine Ebene", () => {
  // MO_2 liegt auf R5C5 (rechts nicht vorhanden): kein Weg
  const cfg = lintCfg();
  lintSet(cfg, 0, 5, 5, "MO_2");
  lintSet(cfg, 2, 1, 1, "KEY_A");
  assert.strictEqual(lintCodes(lintBoth(cfg), "layer-unreachable").length, 1);
});

test("Layout-Prüfung: eingerastete Ebene ohne Weg zurück ist eine Falle, mit Rückweg nicht", () => {
  // TG_1 auf Ebene 0; auf Ebene 1 belegt eine andere Taste die TG_1-Taste, es gibt keine Taste zurück
  const trap = lintCfg();
  lintSet(trap, 0, 0, 0, "TG_1");
  lintSet(trap, 1, 0, 0, "KEY_A");
  const found = lintCodes(lintBoth(trap), "layer-trap");
  assert.strictEqual(found.length, 1);
  assert.ok(found[0].message.startsWith("Ebene 1 lässt sich einrasten"), found[0].message);
  // Ist die TG_1-Taste auf Ebene 1 transparent, gilt dort wie in der Firmware der Rückfall auf Ebene 0:
  // dieselbe Taste schaltet die Ebene wieder aus. Das ist ein Rückweg.
  const fallback = lintCfg();
  lintSet(fallback, 0, 0, 0, "TG_1");
  assert.deepStrictEqual(lintCodes(lintBoth(fallback), "layer-trap"), []);
  // Eigene TG-Taste auf Ebene 1
  const own = lintCfg();
  lintSet(own, 0, 0, 0, "TG_1");
  lintSet(own, 1, 0, 0, "TG_1");
  lintSet(own, 1, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(own), "layer-trap"), []);
  // TG_0 auf Ebene 1 löscht alle eingerasteten Ebenen
  const tg0 = lintCfg();
  lintSet(tg0, 0, 0, 0, "TG_1");
  lintSet(tg0, 1, 0, 0, "TG_0");
  assert.deepStrictEqual(lintCodes(lintBoth(tg0), "layer-trap"), []);
  // LAYER_UP/DOWN auf Ebene 1 führt ebenfalls weiter
  const step = lintCfg();
  lintSet(step, 0, 0, 0, "TG_1");
  lintSet(step, 1, 0, 0, "LAYER_DOWN");
  assert.deepStrictEqual(lintCodes(lintBoth(step), "layer-trap"), []);
  // Der Rückweg liegt auf der anderen Hälfte
  const left = lintCfg();
  lintSet(left, 1, 0, 0, "TG_1");
  const keepBack = lintCfg();
  lintSet(keepBack, 0, 0, 0, "TG_1");
  lintSet(keepBack, 1, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(keepBack, left), "layer-trap"), []);
  // MO_n rastet nicht ein: eine Ebene nur über MO braucht keinen Rückweg
  const mo = lintCfg();
  lintSet(mo, 0, 5, 0, "MO_1");
  lintSet(mo, 1, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(mo), "layer-trap"), []);
});

test("Layout-Prüfung: Falle durch LAYER_UP und durch Combo", () => {
  // LAYER_UP von Ebene 0 rastet Ebene 1 ein; Ebene 1 hat selbst LAYER_UP/DOWN nur auf R5C5 (fehlt)
  const up = lintCfg();
  lintSet(up, 0, 0, 0, "LAYER_UP");
  lintSet(up, 1, 0, 0, "KEY_B");
  lintSet(up, 1, 5, 5, "LAYER_DOWN");
  const found = lintCodes(lintBoth(up), "layer-trap");
  assert.strictEqual(found.length, 1);
  // Eine Combo "Layer umschalten" auf Ebene 2 ist der Weg hinein und zurück
  const combo = lintCfg();
  lintSet(combo, 2, 1, 1, "KEY_A");
  lintCombo(combo, [2, 1], [2, 2], "LAYER_TOGGLE", "TG_2");
  assert.deepStrictEqual(lintCodes(lintBoth(combo), "layer-trap"), []);
  // Combo mit TG_0 löscht alle eingerasteten Ebenen und ist ein Rückweg
  const reset = lintCfg();
  lintSet(reset, 0, 0, 0, "TG_3");
  lintSet(reset, 3, 1, 1, "KEY_A");
  lintCombo(reset, [2, 1], [2, 2], "LAYER_TOGGLE", "TG_0");
  assert.deepStrictEqual(lintCodes(lintBoth(reset), "layer-trap"), []);
});

test("Layout-Prüfung: ungenutzte Tastenpaare und Makros, belegte nicht", () => {
  const cfg = lintCfg();
  cfg.keyPairs = [{ first: "KEY_LEFT_SHIFT", second: "KEY_PERIOD" }, { first: "KEY_TAB", second: "KEY_SLASH" }, { first: "KEY_A", second: "KEY_B" }];
  cfg.macros = [{ name: "Copy", steps: [] }, { name: "Paste", steps: [] }];
  lintSet(cfg, 0, 1, 1, "PAIR_1");
  lintSet(cfg, 2, 3, 3, "KEY_X", "MACRO_0");             // als Halte-Aktion
  lintCombo(cfg, [2, 1], [2, 2], "KEY_PRESS", "PAIR_2"); // in einer Combo
  const findings = lintBoth(cfg);
  const pairs = lintCodes(findings, "pair-unused");
  assert.deepStrictEqual(pairs.map(f => f.message), ["Tastenpaar 0 (KEY_LEFT_SHIFT + KEY_PERIOD) wird nirgends verwendet."]);
  const macros = lintCodes(findings, "macro-unused");
  assert.deepStrictEqual(macros.map(f => f.message), ["Makro 1 (Paste) wird nirgends verwendet."]);
  assert.ok([...pairs, ...macros].every(f => f.level === "info" && f.side === "R"));
  // Das Etikett eines Tastenpaars kommt aus labelFor
  const labelled = api.lintLayouts({ R: cfg, L: lintCfg() }, api.SIDE_PROFILES, code => `<${code}>`);
  assert.ok(lintCodes(labelled, "pair-unused")[0].message.includes("<KEY_LEFT_SHIFT> + <KEY_PERIOD>"));
  // Die Belegung der anderen Hälfte nutzt das Paar dieser Hälfte nicht: jede Hälfte hat ihre eigene Liste
  const left = lintCfg();
  lintSet(left, 0, 1, 1, "PAIR_0");
  assert.strictEqual(lintCodes(lintBoth(cfg, left), "pair-unused").length, 1);
});

test("Layout-Prüfung: doppelte Combo über dieselben zwei Tasten, auch in anderer Reihenfolge", () => {
  const cfg = lintCfg();
  lintCombo(cfg, [2, 1], [2, 2], "KEY_PRESS", "KEY_ESC");
  lintCombo(cfg, [2, 2], [2, 1], "MODIFIER_HOLD", "KEY_LEFT_CTRL");
  lintCombo(cfg, [2, 1], [2, 3], "KEY_PRESS", "KEY_B");
  const found = lintCodes(lintBoth(cfg), "combo-duplicate");
  assert.strictEqual(found.length, 1);
  assert.ok(found[0].message.startsWith("Combo 1 und Combo 2 "), found[0].message);
  assert.strictEqual(found[0].level, "warn");
  // Keine Doppelung ohne gleiches Paar
  const other = lintCfg();
  lintCombo(other, [2, 1], [2, 2]);
  lintCombo(other, [2, 1], [2, 3]);
  assert.deepStrictEqual(lintCodes(lintBoth(other), "combo-duplicate"), []);
  // Kaputte Einträge stürzen nicht ab
  const broken = lintCfg();
  broken.combos = [null, { key1: { r: 1, c: 1 } }, { key1: { r: 1, c: 1 }, key2: { r: 1, c: 2 } }];
  assert.doesNotThrow(() => lintBoth(broken));
});

// =============================================================================
// Combos je Ebene (Ebenenmaske)
// =============================================================================
test("Combo-Ebenenmaske: Hilfsfunktionen und Standard", () => {
  assert.strictEqual(api.COMBO_ALL_LAYERS, 0xFF);
  assert.strictEqual(api.comboLayerMask({}), 0xFF);
  assert.strictEqual(api.comboLayerMask({ layerMask: 5 }), 5);
  for (const bad of [0, 256, -1, 1.5, "3", null, true]) assert.strictEqual(api.comboLayerMask({ layerMask: bad }), 0xFF, String(bad));
  assert.deepStrictEqual([...api.comboMaskLayers(0b101)], [0, 2]);
  assert.strictEqual(api.comboAppliesOnLayer({ layerMask: 1 }, 0), true);
  assert.strictEqual(api.comboAppliesOnLayer({ layerMask: 1 }, 2), false);
  assert.strictEqual(api.comboAppliesOnLayer({}, 7), true);
});

test("Combo-Ebenenmaske: Validierung und Normalisierung", () => {
  const base = () => ({ layers: [[]], combos: [{ key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 }, behavior: "KEY_PRESS", action: "KEY_ESC" }] });
  const ok = base();
  ok.combos[0].layerMask = 3;
  assert.doesNotThrow(() => api.validateConfigShape(ok));
  for (const bad of [0, 256, "1", 1.5]) {
    const cfg = base();
    cfg.combos[0].layerMask = bad;
    assert.throws(() => api.validateConfigShape(cfg), /Ebenenmaske/, String(bad));
  }
  // null gilt wie ein fehlendes Feld (der Server nimmt es ebenfalls an)
  const withNull = base();
  withNull.combos[0].layerMask = null;
  assert.doesNotThrow(() => api.validateConfigShape(withNull));
  const n = api.normalizeConfig({ layers: [[]], combos: [
    { ...base().combos[0], layerMask: 3 }, { ...base().combos[0], layerMask: 255 }, { ...base().combos[0], layerMask: 0 }
  ] }, R);
  assert.strictEqual(n.combos[0].layerMask, 3);
  assert.ok(!("layerMask" in n.combos[1]), "alle Ebenen steht nicht in der Datei");
  assert.ok(!("layerMask" in n.combos[2]), "ungültige Maske wird zu alle Ebenen");
});

test("Combo-Ebenenmaske: Geräte-Snapshot liest 6 Werte (alte Firmware) und 7 Werte", () => {
  const snap = api.createDeviceSnapshot();
  assert.ok(api.captureListLine(snap, "COMBO_COUNT:2"));
  assert.ok(api.captureListLine(snap, 'COMBO_DATA:{"o":0,"e":[[2,1,2,2,0,177],[3,1,3,2,1,128,6]]}'));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(snap.combos)), [[2, 1, 2, 2, 0, 177, 255, 255, 255, 0], [3, 1, 3, 2, 1, 128, 6, 255, 255, 0]]);
  for (const bad of ['[[2,1,2,2,0,177,0]]', '[[2,1,2,2,0,177,256]]', '[[2,1,2,2,0,177,1,1]]']) {
    const s2 = api.createDeviceSnapshot();
    api.captureListLine(s2, "COMBO_COUNT:1");
    api.captureListLine(s2, `COMBO_DATA:{"o":0,"e":${bad}}`);
    assert.strictEqual(api.snapshotListsState(s2), "incomplete", bad);
  }
});

test("Combo-Ebenenmaske: Layout-Diff zeigt eine abweichende Maske", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const snap = snapshotWithLists(cfg);
  assert.strictEqual(api.diffKeymap(cfg, snap, R).lists.combos.length, 0);
  cfg.combos[0].layerMask = 1;
  const d = api.diffKeymap(cfg, snap, R).lists;
  assert.strictEqual(d.combos.length, 1);
  assert.ok(d.combos[0].local.includes("Ebene 0"), d.combos[0].local);
  assert.ok(!d.combos[0].device.includes("Ebene"), d.combos[0].device);
});

asyncTests.push(["Combo-Ebenenmaske: Sync hängt die Maske an ADD_COMBO, nur wenn sie abweicht", async () => {
  const { w, sent } = fullSyncHarness(okReply);
  w.cfgRef.combos = [
    { key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 }, behavior: "KEY_PRESS", action: "KEY_ESC" },
    { key1: { r: 1, c: 0 }, key2: { r: 1, c: 1 }, behavior: "KEY_PRESS", action: "KEY_ESC", layerMask: 5 }
  ];
  await w.write();
  const adds = sent.filter(c => c.startsWith("ADD_COMBO "));
  assert.strictEqual(adds.length, 2);
  assert.strictEqual(adds[0].split(" ").length, 7, adds[0]);   // ohne Maske: altes Format
  assert.ok(adds[1].endsWith(" 5"), adds[1]);
  assert.strictEqual(adds[1].split(" ").length, 8, adds[1]);
}]);

test("Combo mit dritter Taste und Fenster: Normalisierung behält gültige Werte und verwirft ungültige", () => {
  const cfg = JSON.parse(JSON.stringify(R.defaultConfig));
  const base = { behavior: "KEY_PRESS", action: "KEY_ESC", key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 } };
  cfg.combos = [
    { ...base },                                                           // zwei Tasten, globales Fenster
    { ...base, key3: { r: 2, c: 3, label: "L" }, windowMs: 90 },           // drei Tasten, eigenes Fenster
    { ...base, windowMs: 120 },                                            // zwei Tasten, eigenes Fenster
    { ...base, key3: { r: 2, c: 1 }, windowMs: 5 },                        // dritte Taste doppelt, Fenster zu klein
    { ...base, key3: { r: 9, c: 0 }, windowMs: 501 },                      // dritte Taste außerhalb, Fenster zu groß
    { ...base, key3: "x", windowMs: "40" }                                 // falsche Typen
  ];
  const n = api.normalizeConfig(cfg, R);
  assert.ok(!("key3" in n.combos[0]) && !("windowMs" in n.combos[0]));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(n.combos[1].key3)), { r: 2, c: 3, label: "L" });
  assert.strictEqual(n.combos[1].windowMs, 90);
  assert.ok(!("key3" in n.combos[2]) && n.combos[2].windowMs === 120);
  for (const i of [3, 4, 5]) assert.ok(!("key3" in n.combos[i]) && !("windowMs" in n.combos[i]), `Combo ${i}`);
});

test("Combo mit dritter Taste und Fenster: Config-Prüfung weist ungültige Werte ab", () => {
  const make = extra => {
    const cfg = JSON.parse(JSON.stringify(R.defaultConfig));
    cfg.combos = [{ behavior: "KEY_PRESS", action: "KEY_ESC", key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 }, ...extra }];
    return cfg;
  };
  for (const ok of [{}, { key3: { r: 2, c: 3 } }, { windowMs: 10 }, { windowMs: 500 }, { key3: { r: 2, c: 3 }, windowMs: 60 }, { key3: null, windowMs: null }]) {
    api.validateConfigShape(make(ok));
  }
  for (const bad of [{ key3: { r: 2, c: 1 } }, { key3: { r: 2, c: 2 } }, { key3: { r: 6, c: 0 } }, { key3: { r: 0, c: 7 } },
    { key3: "x" }, { windowMs: 9 }, { windowMs: 501 }, { windowMs: "40" }, { windowMs: 40.5 }]) {
    assert.throws(() => api.validateConfigShape(make(bad)), /Combo 1/, JSON.stringify(bad));
  }
});

test("Combo mit dritter Taste und Fenster: Geräte-Snapshot liest 6, 7 und 10 Werte", () => {
  const snap = api.createDeviceSnapshot();
  assert.ok(api.captureListLine(snap, "COMBO_COUNT:3"));
  assert.ok(api.captureListLine(snap, 'COMBO_DATA:{"o":0,"e":[[2,1,2,2,0,177],[3,1,3,2,1,128,6],[4,1,4,2,0,97,255,4,3,90]]}'));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(snap.combos)), [
    [2, 1, 2, 2, 0, 177, 255, 255, 255, 0], [3, 1, 3, 2, 1, 128, 6, 255, 255, 0], [4, 1, 4, 2, 0, 97, 255, 4, 3, 90]]);
  for (const bad of ['[[2,1,2,2,0,177,255,2,3]]', '[[2,1,2,2,0,177,255,9,3,0]]', '[[2,1,2,2,0,177,255,2,9,0]]',
    '[[2,1,2,2,0,177,255,2,3,501]]', '[[2,1,2,2,0,177,255,255,3,0]]', '[[2,1,2,2,0,177,255,2,3,0,1]]']) {
    const s2 = api.createDeviceSnapshot();
    api.captureListLine(s2, "COMBO_COUNT:1");
    api.captureListLine(s2, `COMBO_DATA:{"o":0,"e":${bad}}`);
    assert.strictEqual(api.snapshotListsState(s2), "incomplete", bad);
  }
});

test("Combo mit dritter Taste und Fenster: Layout-Diff vergleicht dritte Taste und Fenster", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const snap = snapshotWithLists(cfg);
  assert.strictEqual(api.diffKeymap(cfg, snap, R).lists.combos.length, 0);
  cfg.combos[0].key3 = { r: 2, c: 4, label: "x" };
  cfg.combos[0].windowMs = 80;
  const d = api.diffKeymap(cfg, snap, R).lists;
  assert.strictEqual(d.combos.length, 1);
  assert.ok(d.combos[0].local.includes("R2C4") && d.combos[0].local.includes("80 ms"), d.combos[0].local);
  assert.ok(!d.combos[0].device.includes("80 ms"), d.combos[0].device);
  // Nur das Fenster ändert sich
  const cfg2 = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  const snap2 = snapshotWithLists(cfg2);
  cfg2.combos[0].windowMs = 60;
  assert.strictEqual(api.diffKeymap(cfg2, snap2, R).lists.combos.length, 1);
});

asyncTests.push(["Combo mit dritter Taste und Fenster: Sync sendet r3 c3 und Fenster nur bei Bedarf", async () => {
  const { w, sent } = fullSyncHarness(okReply);
  const base = { behavior: "KEY_PRESS", action: "KEY_ESC" };
  w.cfgRef.combos = [
    { ...base, key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 } },                                              // wie bisher
    { ...base, key1: { r: 1, c: 0 }, key2: { r: 1, c: 1 }, key3: { r: 1, c: 2 } },                        // drei Tasten
    { ...base, key1: { r: 2, c: 0 }, key2: { r: 2, c: 1 }, windowMs: 120 },                               // eigenes Fenster
    { ...base, key1: { r: 3, c: 0 }, key2: { r: 3, c: 1 }, key3: { r: 3, c: 2 }, windowMs: 90, layerMask: 5 }
  ];
  await w.write();
  const adds = sent.filter(c => c.startsWith("ADD_COMBO "));
  assert.strictEqual(adds.length, 4);
  assert.ok(adds[0].endsWith(" 0 177") || adds[0].split(" ").length === 7, adds[0]);
  assert.ok(adds[1].endsWith(" 255 1 2 0"), adds[1]);
  assert.ok(adds[2].endsWith(" 255 255 255 120"), adds[2]);
  assert.ok(adds[3].endsWith(" 5 3 2 90"), adds[3]);
}]);

test("Combo mit dritter Taste: Layout-Prüfung erkennt Dopplungen über drei Tasten und Maske der Taste", () => {
  const cfg = lintCfg();
  lintCombo(cfg, [2, 1], [2, 2], "KEY_PRESS", "KEY_ESC");
  lintCombo(cfg, [2, 1], [2, 2], "KEY_PRESS", "KEY_B");
  cfg.combos[1].key3 = { r: 2, c: 3 };
  // Zwei Tasten und drei Tasten sind verschiedene Combos
  assert.deepStrictEqual(lintCodes(lintBoth(cfg), "combo-duplicate"), []);
  lintCombo(cfg, [2, 3], [2, 1], "KEY_PRESS", "KEY_C");
  cfg.combos[2].key3 = { r: 2, c: 2 };                       // dieselben drei Tasten in anderer Reihenfolge
  assert.strictEqual(lintCodes(lintBoth(cfg), "combo-duplicate").length, 1);
});

test("Combo mit dritter Taste: Layout-Prüfung warnt, wenn eine Zwei-Tasten-Combo in einer Drei-Tasten-Combo steckt", () => {
  const cfg = lintCfg();
  lintCombo(cfg, [2, 1], [2, 2], "KEY_PRESS", "KEY_ESC");
  lintCombo(cfg, [2, 1], [2, 2], "KEY_PRESS", "KEY_B");
  cfg.combos[1].key3 = { r: 2, c: 3 };
  const found = lintCodes(lintBoth(cfg), "combo-subset");
  assert.strictEqual(found.length, 1);
  assert.ok(found[0].message.startsWith("Combo 1 nutzt zwei Tasten von Combo 2"), found[0].message);
  assert.strictEqual(found[0].level, "warn");
  // Getrennte Ebenenmasken: keine gemeinsame Ebene, keine Warnung
  cfg.combos[0].layerMask = 0b0001;
  cfg.combos[1].layerMask = 0b0010;
  assert.deepStrictEqual(lintCodes(lintBoth(cfg), "combo-subset"), []);
  // Nur ein Teil der Tasten gemeinsam
  const other = lintCfg();
  lintCombo(other, [2, 1], [2, 5], "KEY_PRESS", "KEY_ESC");
  lintCombo(other, [2, 1], [2, 2], "KEY_PRESS", "KEY_B");
  other.combos[1].key3 = { r: 2, c: 3 };
  assert.deepStrictEqual(lintCodes(lintBoth(other), "combo-subset"), []);
});

test("Combo mit dritter Taste: comboKeys liefert zwei oder drei Tasten", () => {
  const two = { key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 } };
  assert.strictEqual(api.comboKeys(two).length, 2);
  assert.strictEqual(api.comboKeys({ ...two, key3: { r: 0, c: 2 } }).length, 3);
  assert.strictEqual(api.comboKeys({ ...two, key3: { r: 9, c: 2 } }).length, 2);
  assert.strictEqual(api.comboWindowMs({ ...two, windowMs: 70 }), 70);
  assert.strictEqual(api.comboWindowMs({ ...two, windowMs: 5 }), 0);
  assert.strictEqual(api.comboWindowMs(two), 0);
});

test("Layout-Prüfung: Combos über dieselben Tasten mit getrennten Ebenen sind keine Dopplung", () => {
  const cfg = lintCfg();
  lintCombo(cfg, [2, 1], [2, 2], "KEY_PRESS", "KEY_ESC");
  lintCombo(cfg, [2, 1], [2, 2], "KEY_PRESS", "KEY_B");
  cfg.combos[0].layerMask = 0b0001;
  cfg.combos[1].layerMask = 0b0100;
  assert.deepStrictEqual(lintCodes(lintBoth(cfg), "combo-duplicate"), []);
  cfg.combos[1].layerMask = 0b0101;                          // überlappt auf Ebene 0
  assert.strictEqual(lintCodes(lintBoth(cfg), "combo-duplicate").length, 1);
  // Ohne Maske gilt die Combo überall und überlappt mit jeder anderen
  const all = lintCfg();
  lintCombo(all, [2, 1], [2, 2]);
  lintCombo(all, [2, 1], [2, 2]);
  all.combos[1].layerMask = 0b0010;
  assert.strictEqual(lintCodes(lintBoth(all), "combo-duplicate").length, 1);
});

test("Layout-Prüfung: Einrast-Combo zählt nur auf den Ebenen ihrer Maske als Weg", () => {
  // Ebene 1 hat eigene Belegung; nur eine Einrast-Combo führt hinein
  const make = mask => {
    const cfg = lintCfg();
    lintSet(cfg, 1, 2, 3, "KEY_X");
    lintCombo(cfg, [2, 1], [2, 2], "LAYER_TOGGLE", "TG_1");
    if (mask !== undefined) cfg.combos[0].layerMask = mask;
    return cfg;
  };
  assert.deepStrictEqual(lintCodes(lintBoth(make()), "layer-unreachable"), []);
  assert.deepStrictEqual(lintCodes(lintBoth(make(0b0001)), "layer-unreachable"), []);   // gilt auf Ebene 0
  // Die Combo gilt nur auf Ebene 2, die niemand erreicht: Ebene 1 bleibt unerreichbar
  assert.strictEqual(lintCodes(lintBoth(make(0b0100)), "layer-unreachable").length, 1);
  // Rückweg: die Combo gilt auf Ebene 0, aber nicht auf Ebene 1 -> Ebene 1 lässt sich einrasten, ohne Rückweg
  const trapped = lintCodes(lintBoth(make(0b0001)), "layer-trap");
  assert.strictEqual(trapped.length, 1);
  assert.deepStrictEqual(lintCodes(lintBoth(make(0b0011)), "layer-trap"), []);
  assert.deepStrictEqual(lintCodes(lintBoth(make()), "layer-trap"), []);
});

test("Layout-Prüfung: Combo-Hinweis zu Halte-Aktionen nennt nur Ebenen der Maske", () => {
  const cfg = lintCfg();
  lintSet(cfg, 0, 2, 1, "KEY_J");
  lintSet(cfg, 3, 2, 1, "KEY_J", "KEY_LEFT_CTRL");
  lintSet(cfg, 0, 2, 2, "KEY_K");
  lintCombo(cfg, [2, 1], [2, 2], "KEY_PRESS", "KEY_ESC");
  assert.strictEqual(lintCodes(lintBoth(cfg), "combo-hold-cancelled").length, 1);
  cfg.combos[0].layerMask = 0b0001;                          // Ebene 3 liegt außerhalb: die Halte-Aktion bleibt unberührt
  assert.deepStrictEqual(lintCodes(lintBoth(cfg), "combo-hold-cancelled"), []);
});

test("Layout-Prüfung: Combo-Taste mit Halte- oder Doppel-Tipp-Aktion ist ein Hinweis", () => {
  const cfg = lintCfg();
  lintSet(cfg, 0, 2, 1, "KEY_J", "KEY_LEFT_CTRL");
  lintSet(cfg, 3, 2, 1, "KEY_J", "NONE", "KEY_U");
  lintSet(cfg, 0, 2, 2, "KEY_K");
  lintCombo(cfg, [2, 1], [2, 2], "KEY_PRESS", "KEY_ESC");
  const found = lintCodes(lintBoth(cfg), "combo-hold-cancelled");
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].level, "warn");
  assert.strictEqual(found[0].combo, 0);
  // Ebene 3 hat eine eigene Belegung ohne Halten, aber mit Doppel-Tipp; die übrigen Ebenen sind transparent und erben
  // wie in der Firmware die Halte-Aktion von Ebene 0
  assert.ok(found[0].message.startsWith("Taste R2C1 ist Teil von Combo 1 und hat auf allen Ebenen "), found[0].message);
  // Ohne Halte- oder Doppel-Tipp-Aktion kein Hinweis
  const plain = lintCfg();
  lintSet(plain, 0, 2, 1, "KEY_J");
  lintSet(plain, 0, 2, 2, "KEY_K");
  lintCombo(plain, [2, 1], [2, 2]);
  assert.deepStrictEqual(lintCodes(lintBoth(plain), "combo-hold-cancelled"), []);
  // Taste ohne Combo: kein Hinweis
  const noCombo = lintCfg();
  lintSet(noCombo, 0, 2, 1, "KEY_J", "KEY_LEFT_CTRL");
  assert.deepStrictEqual(lintCodes(lintBoth(noCombo), "combo-hold-cancelled"), []);
});

// Regeln für Combos und Überschreibungen: je Regel ein Layout mit genau einem Befund, dazu ein sauberes Layout
const LINT_COMBO_OVERRIDE_CODES = ["combo-hold-cancelled", "combo-duplicate", "override-key-unmapped"];
function lintOverrideCfg(key = "KEY_BACKSPACE", layerMask) {
  const cfg = lintCfg();
  lintSet(cfg, 0, 2, 1, "KEY_BACKSPACE");
  cfg.keyOverrides = [{ mods: ["shift"], key, replacement: "KEY_DELETE", ...(layerMask === undefined ? {} : { layerMask }) }];
  return cfg;
}
function lintRuleFindings(cfg) {
  return [...lintBoth(cfg)].filter(f => LINT_COMBO_OVERRIDE_CODES.includes(f.code));
}

test("Layout-Prüfung: Combo-Taste mit Halte-Aktion ist eine Warnung (combo-hold-cancelled)", () => {
  const cfg = lintCfg();
  lintSet(cfg, 0, 2, 1, "KEY_J", "KEY_LEFT_CTRL");
  lintSet(cfg, 0, 2, 2, "KEY_K");
  lintCombo(cfg, [2, 1], [2, 2], "KEY_PRESS", "KEY_ESC");
  const found = lintRuleFindings(cfg);
  assert.deepStrictEqual(found.map(f => [f.code, f.level, f.side, f.combo]), [["combo-hold-cancelled", "warn", "R", 0]]);
  // Nur ein Doppel-Tipp bleibt ein Hinweis
  const dtap = lintCfg();
  lintSet(dtap, 0, 2, 1, "KEY_J", "NONE", "KEY_U");
  lintSet(dtap, 0, 2, 2, "KEY_K");
  lintCombo(dtap, [2, 1], [2, 2], "KEY_PRESS", "KEY_ESC");
  assert.deepStrictEqual(lintRuleFindings(dtap).map(f => [f.code, f.level]), [["combo-hold-cancelled", "info"]]);
});

test("Layout-Prüfung: zwei Combos mit gleichen Tasten und überlappender Maske (combo-duplicate)", () => {
  const cfg = lintCfg();
  lintSet(cfg, 0, 2, 1, "KEY_J");
  lintSet(cfg, 0, 2, 2, "KEY_K");
  lintCombo(cfg, [2, 1], [2, 2], "KEY_PRESS", "KEY_ESC");
  lintCombo(cfg, [2, 2], [2, 1], "KEY_PRESS", "KEY_TAB");
  const found = lintRuleFindings(cfg);
  assert.deepStrictEqual(found.map(f => [f.code, f.level, f.side, f.combo]), [["combo-duplicate", "warn", "R", 1]]);
  cfg.combos[0].layerMask = 0b01;
  cfg.combos[1].layerMask = 0b10;                            // Masken ohne Überlappung: kein Befund
  assert.deepStrictEqual(lintRuleFindings(cfg), []);
});

test("Layout-Prüfung: Überschreibung ohne Taste auf ihrer Ebenenmaske (override-key-unmapped)", () => {
  const found = lintRuleFindings(lintOverrideCfg("KEY_X"));
  assert.deepStrictEqual(found.map(f => [f.code, f.level, f.side, f.override]), [["override-key-unmapped", "warn", "R", 0]]);
  // Ebene 2 belegt die Position mit einer anderen Taste: die Maske nennt nur Ebene 2, also kein Weg zum Auslösen
  const masked = lintOverrideCfg("KEY_BACKSPACE", 0b100);
  lintSet(masked, 2, 2, 1, "KEY_Q");
  assert.deepStrictEqual(lintRuleFindings(masked).map(f => f.code), ["override-key-unmapped"]);
  masked.keyOverrides[0].layerMask = 0b101;                  // Ebene 0 sendet die Taste
  assert.deepStrictEqual(lintRuleFindings(masked), []);
  // Eine transparente Ebene erbt die Taste von Ebene 0
  assert.deepStrictEqual(lintRuleFindings(lintOverrideCfg()), []);
});

test("Layout-Prüfung: Überschreibung zählt Tasten der anderen Hälfte, Doppel-Tipp, Tastenpaar, Makro und Combo", () => {
  const sendersOf = cfgs => [...api.lintLayouts(cfgs, api.SIDE_PROFILES)].filter(f => f.code === "override-key-unmapped").length;
  // Taste nur auf der linken Hälfte
  const withLeft = lintOverrideCfg("KEY_X");
  const left = lintCfg();
  lintSet(left, 0, 2, 1, "KEY_X");
  assert.strictEqual(sendersOf({ R: withLeft, L: left }), 0);
  // Doppel-Tipp
  const dtap = lintOverrideCfg("KEY_X");
  lintSet(dtap, 0, 2, 2, "KEY_A", "NONE", "KEY_X");
  assert.strictEqual(sendersOf({ R: dtap, L: lintCfg() }), 0);
  // Tastenpaar
  const pair = lintOverrideCfg("KEY_X");
  pair.keyPairs = [{ first: "KEY_LEFT_ALT", second: "KEY_X" }];
  lintSet(pair, 0, 2, 2, "PAIR_0");
  assert.strictEqual(sendersOf({ R: pair, L: lintCfg() }), 0);
  // Makro
  const macro = lintOverrideCfg("KEY_X");
  macro.macros = [{ name: "m", steps: [{ type: "tap", code: "KEY_X" }] }];
  lintSet(macro, 0, 2, 2, "MACRO_0");
  assert.strictEqual(sendersOf({ R: macro, L: lintCfg() }), 0);
  // Combo
  const combo = lintOverrideCfg("KEY_X");
  lintSet(combo, 0, 2, 2, "KEY_K");
  lintSet(combo, 0, 2, 3, "KEY_L");
  lintCombo(combo, [2, 2], [2, 3], "KEY_PRESS", "KEY_X");
  assert.strictEqual(sendersOf({ R: combo, L: lintCfg() }), 0);
  // Umlaut-Taste sendet Alt + u und den Vokal
  const umlaut = lintOverrideCfg("KEY_O");
  lintSet(umlaut, 0, 2, 2, "UMLAUT_OE");
  assert.strictEqual(sendersOf({ R: umlaut, L: lintCfg() }), 0);
  // Andere Schreibweise derselben Taste ("x" statt KEY_X) in Taste, Tastenpaar und Makro-Schritt
  const spelled = lintOverrideCfg("KEY_X");
  lintSet(spelled, 0, 2, 2, "x");
  assert.strictEqual(sendersOf({ R: spelled, L: lintCfg() }), 0);
  const spelledPair = lintOverrideCfg("KEY_X");
  spelledPair.keyPairs = [{ first: "KEY_LEFT_ALT", second: "x" }];
  lintSet(spelledPair, 0, 2, 2, "PAIR_0");
  assert.strictEqual(sendersOf({ R: spelledPair, L: lintCfg() }), 0);
  const spelledMacro = lintOverrideCfg("KEY_X");
  spelledMacro.macros = [{ name: "m", steps: [{ type: "tap", code: "x" }] }];
  lintSet(spelledMacro, 0, 2, 2, "MACRO_0");
  assert.strictEqual(sendersOf({ R: spelledMacro, L: lintCfg() }), 0);
  // Ohne jede Quelle bleibt die Warnung
  assert.strictEqual(sendersOf({ R: lintOverrideCfg("KEY_X"), L: lintCfg() }), 1);
});

test("Layout-Prüfung: Halte-Aktion nur auf einer Ebene der Combo-Maske ist eine Warnung", () => {
  const cfg = lintCfg();
  lintSet(cfg, 0, 2, 1, "KEY_J");
  lintSet(cfg, 3, 2, 1, "KEY_J", "KEY_LEFT_CTRL");
  lintSet(cfg, 0, 2, 2, "KEY_K");
  lintCombo(cfg, [2, 1], [2, 2], "KEY_PRESS", "KEY_ESC");
  assert.deepStrictEqual(lintRuleFindings(cfg).map(f => f.level), ["warn"]);
  cfg.combos[0].layerMask = 0b0111;                          // Ebene 3 liegt außerhalb der Maske: kein Befund
  assert.deepStrictEqual(lintRuleFindings(cfg), []);
});

test("Layout-Prüfung (Anzeige): Knopf \"Zum Eintrag\" springt zur Überschreibung", () => {
  const { w, dom } = lintUiHarness(lintOverrideCfg("KEY_X"), lintCfg());
  const calls = [];
  const row = { classList: { add: c => calls.push("add:" + c), remove() {} }, scrollIntoView: () => calls.push("scroll") };
  w.document.querySelector = sel => (sel.includes("combos-tab") ? { click: () => calls.push("tab") }
    : sel.includes('#keyOverridesTableBody tr[data-override-index="0"]') ? row : null);
  w.editSide = "R";
  w.switchEditSide = () => calls.push("side");
  w.setTimeout = () => 1; w.clearTimeout = () => {};
  w.renderLayoutLint();
  const li = dom.document.getElementById("layoutLintList").children[0];
  li.children.find(ch => ch.textContent === "Zum Eintrag").listeners.click[0]();
  assert.deepStrictEqual(calls, ["tab", "scroll", "add:lint-jump-highlight"]);
});

test("Combo- und Überschreibungstabelle setzen die Index-Attribute für den Sprung der Layout-Prüfung", () => {
  const src = read("js/editor.js") + read("js/key-overrides-ui.js");
  assert.ok(src.includes("dataset.comboIndex = String(comboIndex)"));
  assert.ok(src.includes("dataset.overrideIndex = String(i)"));
  // Die Layout-Prüfung folgt der Liste: Hinzufügen, Löschen und Rückgängig zeichnen die Matrix neu
  const ui = read("js/key-overrides-ui.js");
  assert.strictEqual((ui.match(/renderKeyOverrides\(\);\n\s*(\/\/[^\n]*\n\s*)?renderMatrix\(\);/g) || []).length, 4);
});

test("Layout-Prüfung (Anzeige): Knopf \"Zum Eintrag\" wechselt die Hälfte, den Tab und hebt die Zeile hervor", () => {
  const right = lintCfg();
  lintSet(right, 0, 2, 1, "KEY_J", "KEY_LEFT_CTRL");
  lintSet(right, 0, 2, 2, "KEY_K");
  lintCombo(right, [2, 1], [2, 2], "KEY_PRESS", "KEY_ESC");
  const { w, dom } = lintUiHarness(right, lintCfg());
  const calls = [];
  const row = { classList: { add: c => calls.push("add:" + c), remove: c => calls.push("remove:" + c) }, scrollIntoView: () => calls.push("scroll") };
  const tab = { click: () => calls.push("tab") };
  w.document.querySelector = sel => (sel.includes("combos-tab") ? tab : sel.includes('data-combo-index="0"') ? row : null);
  w.editSide = "L";
  w.switchEditSide = side => { calls.push("side:" + side); w.editSide = side; };
  w.showToast = t => calls.push("toast:" + t);
  w.setTimeout = () => 1; w.clearTimeout = () => {};
  w.renderLayoutLint();
  const li = dom.document.getElementById("layoutLintList").children[0];
  const btn = li.children.find(ch => ch.textContent === "Zum Eintrag");
  assert.ok(btn, "Knopf fehlt");
  btn.listeners.click[0]();
  assert.deepStrictEqual(calls, ["side:R", "tab", "scroll", "add:lint-jump-highlight"]);
  // Zeile fehlt: Hinweis statt Absturz
  calls.length = 0;
  w.document.querySelector = () => null;
  btn.listeners.click[0]();
  assert.ok(calls.some(c => c.startsWith("toast:")), calls.join(","));
});

test("Layout-Prüfung: sauberes Layout ohne Befund zu Combos und Überschreibungen", () => {
  const cfg = lintOverrideCfg();
  lintSet(cfg, 0, 2, 1, "KEY_BACKSPACE");
  lintSet(cfg, 0, 2, 2, "KEY_K");
  lintSet(cfg, 0, 2, 3, "KEY_L");
  lintCombo(cfg, [2, 2], [2, 3], "KEY_PRESS", "KEY_ESC");
  assert.deepStrictEqual([...lintBoth(cfg)], []);
});

test("Layout-Prüfung: Warnungen stehen vor Hinweisen, jede Hälfte wird zugeordnet", () => {
  const right = lintCfg();
  right.keyPairs = [{ first: "KEY_A", second: "KEY_B" }];
  lintSet(right, 0, 5, 5, "KEY_A");
  const left = lintCfg();
  lintSet(left, 0, 5, 0, "KEY_A");
  const findings = [...lintBoth(right, left)];
  const levels = findings.map(f => f.level);
  assert.deepStrictEqual(levels, ["warn", "warn", "info"]);
  assert.deepStrictEqual(findings.map(f => f.side), ["R", "L", "R"]);
  // Die Prüfung ändert die Konfiguration nicht
  const before = JSON.stringify(right);
  lintBoth(right, left);
  assert.strictEqual(JSON.stringify(right), before);
});

test("Layout-Prüfung: das gespeicherte Layout des Nutzers hat die Aktionen auf R5C5 und R2C6 rechts", () => {
  // Gleiche Form wie current_config.json: Backspace auf R5C5 und Delete auf R2C6 in allen Ebenen der rechten Hälfte
  const cfg = lintCfg();
  for (let l = 0; l < 8; l++) { lintSet(cfg, l, 5, 5, "KEY_BACKSPACE"); lintSet(cfg, l, 2, 6, "KEY_DELETE"); }
  lintSet(cfg, 0, 5, 0, "KEY_DELETE", "MO_1");
  lintSet(cfg, 1, 0, 0, "TG_1");
  const found = lintBoth(cfg);
  const absent = lintCodes(found, "absent-key-action").map(f => f.message);
  assert.strictEqual(absent.length, 2);
  assert.ok(absent[0].startsWith("Taste R2C6 hat auf allen Ebenen"), absent[0]);
  assert.ok(absent[1].startsWith("Taste R5C5 hat auf allen Ebenen"), absent[1]);
  assert.deepStrictEqual(lintCodes(found, "layer-unreachable"), []);
  assert.deepStrictEqual(lintCodes(found, "layer-trap"), []);
});

// -----------------------------------------------------------------------------
// js/layout-lint-ui.js: Liste im Matrix-Tab, Diff-Dialog und Flash-Protokoll (DOM-Stub)
// -----------------------------------------------------------------------------
// Text eines Listeneintrags: der Stub setzt textContent nicht aus Kindern zusammen
function lintItemText(el) {
  return (el.textContent || "") + (el.children || []).map(lintItemText).join("");
}

function lintUiHarness(rightCfg, leftCfg) {
  const dom = fakeDom();
  const w = { console: { log() {}, warn() {}, error() {} }, document: dom.document };
  vm.createContext(w);
  vm.runInContext(`${code}
var configsBySide = {};
function configFor(side) { return configsBySide[side]; }
function keycodeLabel(c) { return c; }
${read("js/layout-lint-ui.js")}`, w);
  w.configsBySide = { R: rightCfg, L: leftCfg };
  return { w, dom };
}

test("Layout-Prüfung (Anzeige): ohne Befund bleibt das Panel verborgen", () => {
  const { w, dom } = lintUiHarness(lintCfg(), lintCfg());
  w.renderLayoutLint();
  assert.strictEqual(dom.document.getElementById("layoutLintPanel").style.display, "none");
  w.renderSyncDiffLint();
  assert.strictEqual(dom.document.getElementById("syncDiffLintSection").style.display, "none");
});

test("Layout-Prüfung (Anzeige): Panel zeigt Zähler und Befunde, der Diff nur Warnungen", () => {
  const right = lintCfg();
  lintSet(right, 0, 5, 5, "KEY_A");
  right.keyPairs = [{ first: "KEY_A", second: "KEY_B" }];
  const { w, dom } = lintUiHarness(right, lintCfg());
  w.renderLayoutLint();
  const panel = dom.document.getElementById("layoutLintPanel");
  assert.strictEqual(panel.style.display, "");
  assert.strictEqual(dom.document.getElementById("layoutLintSummary").textContent, "⚠️ Layout-Prüfung: 1 Warnung, 1 Hinweis");
  const items = dom.document.getElementById("layoutLintList").children;
  assert.strictEqual(items.length, 2);
  assert.ok(lintItemText(items[0]).startsWith("⚠️ Rechte Hand: Taste R5C5"), lintItemText(items[0]));
  assert.strictEqual(items[0].className, "layout-lint-warn");
  assert.ok(lintItemText(items[1]).startsWith("ℹ️ Rechte Hand: Tastenpaar 0"), lintItemText(items[1]));
  assert.strictEqual(items[1].className, "layout-lint-info");
  // Diff-Dialog: nur die Warnung
  w.renderSyncDiffLint();
  assert.strictEqual(dom.document.getElementById("syncDiffLintSection").style.display, "");
  assert.strictEqual(dom.document.getElementById("syncDiffLint").children.length, 1);
});

test("Layout-Prüfung (Anzeige): nur Hinweise zeigen kein Warnzeichen, der Diff bleibt verborgen", () => {
  const right = lintCfg();
  right.keyPairs = [{ first: "KEY_A", second: "KEY_B" }];
  const { w, dom } = lintUiHarness(right, lintCfg());
  w.renderLayoutLint();
  assert.strictEqual(dom.document.getElementById("layoutLintSummary").textContent, "ℹ️ Layout-Prüfung: 1 Hinweis");
  w.renderSyncDiffLint();
  assert.strictEqual(dom.document.getElementById("syncDiffLintSection").style.display, "none");
});

test("Layout-Prüfung (Anzeige): Befund über beide Hälften nennt keine einzelne Hälfte", () => {
  const right = lintCfg();
  lintSet(right, 2, 1, 1, "KEY_A");
  const { w, dom } = lintUiHarness(right, lintCfg());
  w.renderLayoutLint();
  const text = lintItemText(dom.document.getElementById("layoutLintList").children[0]);
  assert.ok(text.startsWith("⚠️ Beide Hälften: Ebene 2 hat eigene Belegung"), text);
});

test("Layout-Prüfung (Anzeige): Warnungen gehen ins Flash-Protokoll, Hinweise nicht", () => {
  const right = lintCfg();
  lintSet(right, 0, 5, 5, "KEY_A");
  right.keyPairs = [{ first: "KEY_A", second: "KEY_B" }];
  const { w } = lintUiHarness(right, lintCfg());
  const events = [];
  w.logLayoutLintToFlashLog({ onEvent: e => events.push(JSON.parse(JSON.stringify(e))) });
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, "log");
  assert.ok(events[0].line.startsWith("Layout-Prüfung: Rechte Hand: Taste R5C5"), events[0].line);
  // Ohne Warnung bleibt das Protokoll leer
  const clean = lintUiHarness(lintCfg(), lintCfg());
  const none = [];
  clean.w.logLayoutLintToFlashLog({ onEvent: e => none.push(e) });
  assert.deepStrictEqual(none, []);
});

test("Layout-Prüfung (Anzeige): fehlende Elemente stürzen nicht ab", () => {
  const { w } = lintUiHarness(lintCfg(), lintCfg());
  w.document = { getElementById: () => null, createElement: () => ({}) };
  assert.doesNotThrow(() => { w.renderLayoutLint(); w.renderSyncDiffLint(); });
});

test("Layout-Prüfung: fehlerhafte Combos (Import) stürzen nicht ab und zählen nicht als Weg", () => {
  // Aktion kein String, Combos kein Array, Tasten fehlen oder sind keine Zahlen
  const bad = lintCfg();
  bad.combos = [
    { key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 }, behavior: "LAYER_TOGGLE", action: 5 },
    { key1: { r: 2, c: 1 }, key2: { r: 2, c: 3 }, behavior: "LAYER_TOGGLE", action: { x: 1 } },
    { key1: { r: "2", c: 1 }, key2: { r: 2, c: 4 }, behavior: "LAYER_TOGGLE", action: "TG_2" },
    { key1: null, key2: { r: 2, c: 4 }, behavior: "LAYER_TOGGLE", action: "TG_2" },
    "kaputt", 7, null
  ];
  lintSet(bad, 2, 1, 1, "KEY_A");
  assert.doesNotThrow(() => lintBoth(bad));
  assert.strictEqual(lintCodes(lintBoth(bad), "layer-unreachable").length, 1);
  const notArray = lintCfg();
  notArray.combos = { length: 3 };
  notArray.keyPairs = "x";
  notArray.macros = 5;
  assert.doesNotThrow(() => lintBoth(notArray));
  // Eine fehlende Konfiguration der Ebenen bricht die Prüfung nicht
  assert.doesNotThrow(() => api.lintLayouts({ R: { combos: [] }, L: {} }, api.SIDE_PROFILES));
});

test("Layout-Prüfung: eine Combo auf einer fehlenden Taste ist kein Weg und kein Hinweis", () => {
  // R5C5 gibt es rechts nicht: die Combo löst nie aus, Ebene 2 bleibt unerreichbar
  const cfg = lintCfg();
  lintSet(cfg, 2, 1, 1, "KEY_A");
  lintCombo(cfg, [5, 5], [2, 2], "LAYER_TOGGLE", "TG_2");
  assert.strictEqual(lintCodes(lintBoth(cfg), "layer-unreachable").length, 1);
  // Mit zwei vorhandenen Tasten ist dieselbe Combo ein Weg
  const ok = lintCfg();
  lintSet(ok, 2, 1, 1, "KEY_A");
  lintCombo(ok, [2, 1], [2, 2], "LAYER_TOGGLE", "TG_2");
  assert.deepStrictEqual(lintCodes(lintBoth(ok), "layer-unreachable"), []);
  // Hinweis "combo-hold-cancelled" nur für Combos, die auslösen können
  const hint = lintCfg();
  lintSet(hint, 0, 5, 5, "KEY_A", "KEY_B");
  lintCombo(hint, [5, 5], [2, 2]);
  assert.deepStrictEqual(lintCodes(lintBoth(hint), "combo-hold-cancelled"), []);
  const real = lintCfg();
  lintSet(real, 0, 2, 1, "KEY_A", "KEY_B");
  lintCombo(real, [2, 1], [2, 2]);
  assert.strictEqual(lintCodes(lintBoth(real), "combo-hold-cancelled").length, 1);
});

test("Layout-Prüfung: Hinweis zur Combo-Taste folgt dem Rückfall auf Ebene 0 und nennt nur eigene Ebenen", () => {
  // Nur Ebene 0 hat Halten; Ebene 2 belegt die Taste ohne Halten. Die transparenten Ebenen erben Halten von Ebene 0.
  const cfg = lintCfg();
  lintSet(cfg, 0, 2, 1, "KEY_J", "KEY_LEFT_CTRL");
  lintSet(cfg, 2, 2, 1, "KEY_J");
  lintCombo(cfg, [2, 1], [2, 2]);
  const msg = lintCodes(lintBoth(cfg), "combo-hold-cancelled")[0].message;
  assert.ok(msg.includes("auf Ebenen 0, 1, 3, 4, 5, 6, 7 eine"), msg);
  assert.ok(!msg.includes("2, "), msg);
});

test("Layout-Prüfung: Firmware-Schreibweise ACT_TG_n in einer Combo ist ein Weg in die Ebene", () => {
  for (const action of ["ACT_TG_2", "TG_2"]) {
    const cfg = lintCfg();
    lintSet(cfg, 2, 1, 1, "KEY_A");
    lintCombo(cfg, [2, 1], [2, 2], "LAYER_TOGGLE", action);
    assert.deepStrictEqual(lintCodes(lintBoth(cfg), "layer-unreachable"), [], action);
    // Dieselbe Combo schaltet auf jeder Ebene zurück: keine Falle
    assert.deepStrictEqual(lintCodes(lintBoth(cfg), "layer-trap"), [], action);
  }
});

test("Layout-Prüfung: Koordinaten als Text sind keine doppelte Combo und lösen nie aus", () => {
  const cfg = lintCfg();
  lintCombo(cfg, [2, 1], [2, 2]);
  cfg.combos.push({ key1: { r: "2", c: "1" }, key2: { r: "2", c: "2" }, behavior: "KEY_PRESS", action: "KEY_B" });
  assert.deepStrictEqual(lintCodes(lintBoth(cfg), "combo-duplicate"), []);
  // Zwei gültige Combos mit denselben Tasten bleiben eine Dopplung
  lintCombo(cfg, [2, 2], [2, 1]);
  assert.strictEqual(lintCodes(lintBoth(cfg), "combo-duplicate").length, 1);
});

test("Layout-Prüfung: ein Makro mit Namen aus Nicht-Text zeigt kein [object Object]", () => {
  const cfg = lintCfg();
  cfg.macros = [{ name: { x: 1 }, steps: [] }, { name: "", steps: [] }, null, { name: "Copy", steps: [] }];
  const texts = lintCodes(lintBoth(cfg), "macro-unused").map(f => f.message);
  assert.strictEqual(texts.length, 4);
  assert.ok(texts.every(t => !t.includes("[object Object]")), texts.join("\n"));
  assert.strictEqual(texts[0], "Makro 0 (ohne Name) wird nirgends verwendet.");
  assert.strictEqual(texts[3], "Makro 3 (Copy) wird nirgends verwendet.");
});

test("Flash-Protokoll: eine Zeile ohne Phase lässt die Phasenanzeige stehen", () => {
  const dom = fakeDom();
  const w = { console: { log() {}, warn() {}, error() {} }, document: dom.document };
  vm.createContext(w);
  // code enthält flash-log.js schon (openFlashLogDialog liegt dort)
  vm.runInContext(code, w);
  const profile = api.SIDE_PROFILES.R;
  const log = w.openFlashLogDialog(profile);
  const stage = dom.document.getElementById("flashLogStage");
  assert.strictEqual(stage.textContent, "Speichere die Konfiguration ...");
  log.onEvent({ type: "log", line: "Layout-Prüfung: Warnung" });
  assert.strictEqual(stage.textContent, "Speichere die Konfiguration ...");
  assert.ok(dom.document.getElementById("flashLogOutput").textContent.includes("Layout-Prüfung: Warnung"));
  // Mit Phase wie bisher
  log.onEvent({ type: "log", stage: "compile", line: "x" });
  assert.strictEqual(stage.textContent, "Phase: Kompilieren");
});

test("Layout-Prüfung: LAYER_DOWN von Ebene 0 rastet Ebene 7 ein (Umlauf) und braucht einen Weg zurück", () => {
  const cfg = lintCfg();
  lintSet(cfg, 0, 0, 0, "LAYER_DOWN");
  lintSet(cfg, 7, 0, 0, "KEY_B");
  lintSet(cfg, 7, 1, 1, "KEY_A");
  const trap = lintCodes(lintBoth(cfg), "layer-trap");
  assert.strictEqual(trap.length, 1);
  assert.ok(trap[0].message.startsWith("Ebene 7 lässt sich einrasten"), trap[0].message);
  // Mit LAYER_UP auf Ebene 7 (Umlauf nach Ebene 0) gibt es einen Weg zurück
  lintSet(cfg, 7, 2, 2, "LAYER_UP");
  assert.deepStrictEqual(lintCodes(lintBoth(cfg), "layer-trap"), []);
});

test("Layout-Prüfung: LAYER_LOCK zählt als Rückweg und rastet die Ebene ein", () => {
  // Ebene 1 lässt sich per TG_1 einrasten, hat aber keine Taste zurück: Befund
  const cfg = lintCfg();
  lintSet(cfg, 0, 0, 0, "TG_1");
  lintSet(cfg, 1, 0, 0, "KEY_B");
  lintSet(cfg, 1, 1, 1, "KEY_A");
  const trap = lintCodes(lintBoth(cfg), "layer-trap");
  assert.strictEqual(trap.length, 1);
  assert.ok(trap[0].message.startsWith("Ebene 1 lässt sich einrasten"), trap[0].message);
  // LAYER_LOCK auf Ebene 1 löst die Einrastung ohne gehaltene MO-Ebene: das ist der Weg zurück
  lintSet(cfg, 1, 2, 2, "LAYER_LOCK");
  assert.deepStrictEqual(lintCodes(lintBoth(cfg), "layer-trap"), []);
  // LAYER_LOCK mit einer MO-Ebene rastet sie ein, die Ebene bleibt erreichbar
  const mo = lintCfg();
  lintSet(mo, 0, 0, 0, "MO_2");
  lintSet(mo, 2, 1, 1, "LAYER_LOCK");
  lintSet(mo, 2, 2, 2, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(mo), "layer-trap"), []);
  assert.deepStrictEqual(lintCodes(lintBoth(mo), "layer-unreachable"), []);
  const common = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "DactylCommon.h"), "utf8");
  assert.match(common, /#define ACT_LAYER_LOCK\s+0x16A/);
  assert.strictEqual(api.keyToNumericActions({ tap: "LAYER_LOCK" }).tapCode, 0x16A);
});

test("Key Lock: Code passt zur Firmware, Tastenpalette, Label und Rundlauf über die Konfiguration", () => {
  const common = fs.readFileSync(path.join(__dirname, "..", "firmware", "dactyl_right", "DactylCommon.h"), "utf8");
  assert.match(common, /#define ACT_KEY_LOCK\s+0x16F/);
  assert.strictEqual(api.actionCodeToNumeric("KEY_LOCK"), 0x16F);
  assert.strictEqual(api.keyToNumericActions({ tap: "KEY_LOCK" }).tapCode, 0x16F);
  assert.ok(api.isKeyLockCode("KEY_LOCK") && api.isKeyLockCode("ACT_KEY_LOCK") && !api.isKeyLockCode("LEADER") && !api.isKeyLockCode(""));
  assert.ok(api.KEYCODES.some(g => g.keys.some(k => k.code === "KEY_LOCK")));
  assert.strictEqual(api.ONE_SHOT_LABELS.KEY_LOCK, "KeyLock");
  assert.ok(api.isOneShotOrCapsWordCode("KEY_LOCK"));
  // Rundlauf: eine Taste mit KEY_LOCK übersteht normalizeConfig und die Validierung beider Hälften
  const copy = o => JSON.parse(JSON.stringify(o));
  for (const profile of [R, L]) {
    const cfg = copy(profile.defaultConfig);
    cfg.layers[0][2][1] = { tap: "KEY_LOCK" };
    const norm = api.normalizeConfig(cfg, profile);
    assert.strictEqual(norm.layers[0][2][1].tap, "KEY_LOCK");
    api.validateConfigShape(norm, profile);
  }
});

test("Key Lock: Combos lehnen die Aktion ab", () => {
  const copy = o => JSON.parse(JSON.stringify(o));
  const cfg = copy(R.defaultConfig);
  cfg.combos = [{ key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 }, behavior: "KEY_PRESS", action: "KEY_LOCK" }];
  assert.throws(() => api.validateConfigShape(cfg, R), /Key Lock/);
});

test("Swap Hands: Code passt zur Firmware, Tastenpalette, Label und Rundlauf; Combos lehnen die Aktion ab", () => {
  const common = read("firmware/dactyl_right/DactylCommon.h");
  assert.match(common, /#define ACT_SWAP_HANDS\s+0x18B/);
  assert.strictEqual(api.actionCodeToNumeric("SWAP_HANDS"), 0x18B);
  assert.strictEqual(api.keyToNumericActions({ tap: "SWAP_HANDS" }).tapCode, 0x18B);
  assert.ok(api.isSwapHandsCode("SWAP_HANDS") && api.isSwapHandsCode("ACT_SWAP_HANDS") && !api.isSwapHandsCode("KEY_LOCK") && !api.isSwapHandsCode(""));
  assert.ok(api.KEYCODES.some(g => g.keys.some(k => k.code === "SWAP_HANDS")));
  assert.strictEqual(api.ONE_SHOT_LABELS.SWAP_HANDS, "Swap");
  const copy = o => JSON.parse(JSON.stringify(o));
  for (const profile of [R, L]) {
    const cfg = copy(profile.defaultConfig);
    cfg.layers[0][2][1] = { tap: "SWAP_HANDS" };
    const norm = api.normalizeConfig(cfg, profile);
    assert.strictEqual(norm.layers[0][2][1].tap, "SWAP_HANDS");
    api.validateConfigShape(norm, profile);
  }
  const cfg = copy(R.defaultConfig);
  cfg.combos = [{ key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 }, behavior: "KEY_PRESS", action: "SWAP_HANDS" }];
  assert.throws(() => api.validateConfigShape(cfg, R), /Swap Hands/);
});

test("Num Word: Code passt zur Firmware, Tastenpalette, Label und Rundlauf; Combos lehnen die Aktion ab", () => {
  const common = read("firmware/dactyl_right/DactylCommon.h");
  assert.match(common, /#define ACT_NUM_WORD\s+0x18D/);
  assert.strictEqual(api.actionCodeToNumeric("NUM_WORD"), 0x18D);
  assert.strictEqual(api.keyToNumericActions({ tap: "NUM_WORD" }).tapCode, 0x18D);
  assert.ok(api.isNumWordCode("NUM_WORD") && api.isNumWordCode("ACT_NUM_WORD") && !api.isNumWordCode("SWAP_HANDS") && !api.isNumWordCode(""));
  assert.ok(api.KEYCODES.some(g => g.keys.some(k => k.code === "NUM_WORD")));
  assert.strictEqual(api.ONE_SHOT_LABELS.NUM_WORD, "NumWd");
  assert.strictEqual(api.keyPressRole("NUM_WORD"), "silent");
  const copy = o => JSON.parse(JSON.stringify(o));
  for (const profile of [R, L]) {
    const cfg = copy(profile.defaultConfig);
    cfg.layers[0][2][1] = { tap: "NUM_WORD" };
    const norm = api.normalizeConfig(cfg, profile);
    assert.strictEqual(norm.layers[0][2][1].tap, "NUM_WORD");
    api.validateConfigShape(norm, profile);
  }
  const cfg = copy(R.defaultConfig);
  cfg.combos = [{ key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 }, behavior: "KEY_PRESS", action: "NUM_WORD" }];
  assert.throws(() => api.validateConfigShape(cfg, R), /Num Word/);
});

test("Tap-Toggle-Ebenen: Codes passen zur Firmware, Palette, Label, Tausch und Combo-Ablehnung", () => {
  const common = read("firmware/dactyl_right/DactylCommon.h");
  assert.match(common, /#define ACT_TT_BASE\s+0x193/);
  assert.match(common, /#define NUM_TT_ACTIONS\s+8/);
  assert.ok(Number(/DACTYL_FW_VERSION (\d+)/.exec(read("firmware/dactyl_right/DactylVersion.h"))[1]) >= 50);
  for (let n = 0; n < 8; n++) {
    const name = `TT_${n}`;
    assert.strictEqual(api.actionCodeToNumeric(name), 0x193 + n);
    assert.strictEqual(api.keyToNumericActions({ tap: name }).tapCode, 0x193 + n);
    assert.ok(api.isTapToggleCode(name) && api.isTapToggleCode("ACT_" + name));
    assert.ok(api.KEYCODES.some(g => g.group === "Layer Umschalter" && g.keys.some(k => k.code === name)));
    assert.strictEqual(api.keyPressRole(name), "silent");
  }
  assert.ok(!api.isTapToggleCode("TT_8") && !api.isTapToggleCode("TT_UP") && !api.isTapToggleCode(""));
  assert.ok(api.isTtCode("TT_UP") && !api.isTtCode("TT_1"));
  const cfg = JSON.parse(JSON.stringify(R.defaultConfig));
  cfg.combos = [{ key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 }, behavior: "KEY_PRESS", action: "TT_1" }];
  assert.throws(() => api.validateConfigShape(cfg, R), /Tap-Toggle/);
  // Eine TT_n auf der eigenen Ebene rastet aus: kein Layer-Trap
  assert.strictEqual(api.holdSublabel("TT_3"), "T3");
  // Ebenen tauschen: TT_n folgt wie MO_n und TG_n
  const sw = JSON.parse(JSON.stringify(R.defaultConfig));
  sw.layers[0][2][1] = { tap: "TT_1", hold: "ACT_TT_2" };
  const out = JSON.parse(JSON.stringify(api.swapLayersWithRefs(sw, 1, 2)));
  assert.strictEqual(out.layers[0][2][1].tap, "TT_2");
  assert.strictEqual(out.layers[0][2][1].hold, "ACT_TT_1");
});

test("Tapping-Term-Tasten: Codes passen zur Firmware, Palette, Label und Rundlauf; Combos lehnen sie ab", () => {
  const common = read("firmware/dactyl_right/DactylCommon.h");
  assert.match(common, /#define ACT_TT_UP\s+0x18E/);
  assert.match(common, /#define ACT_TT_DOWN\s+0x18F/);
  assert.match(read("firmware/dactyl_right/DactylVersion.h"), /DACTYL_FW_VERSION \d+/);
  for (const [name, n] of [["TT_UP", 0x18E], ["TT_DOWN", 0x18F]]) {
    assert.strictEqual(api.actionCodeToNumeric(name), n);
    assert.strictEqual(api.keyToNumericActions({ tap: name }).tapCode, n);
    assert.ok(api.isTtCode(name) && api.isTtCode("ACT_" + name));
    assert.ok(api.KEYCODES.some(g => g.keys.some(k => k.code === name)));
    assert.strictEqual(api.keyPressRole(name), "silent");
    const cfg = JSON.parse(JSON.stringify(R.defaultConfig));
    cfg.combos = [{ key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 }, behavior: "KEY_PRESS", action: name }];
    assert.throws(() => api.validateConfigShape(cfg, R), /Tapping-Term/);
  }
  assert.ok(!api.isTtCode("NUM_WORD") && !api.isTtCode(""));
  assert.strictEqual(api.ONE_SHOT_LABELS.TT_UP, "TT+");
  assert.strictEqual(api.ONE_SHOT_LABELS.TT_DOWN, "TT-");
  const cfg = JSON.parse(JSON.stringify(R.defaultConfig));
  cfg.layers[0][2][1] = { tap: "TT_UP" };
  const norm = api.normalizeConfig(cfg, R);
  assert.strictEqual(norm.layers[0][2][1].tap, "TT_UP");
  api.validateConfigShape(norm, R);
});

test("Keep-awake: Code passt zur Firmware, Palette, Label und Rundlauf; Combos und linke Hälfte lehnen ihn ab", () => {
  const common = read("firmware/dactyl_right/DactylCommon.h");
  assert.match(common, /#define ACT_KEEP_AWAKE\s+0x190/);
  assert.match(common, /#define KEEP_AWAKE_INTERVAL_MS\s+60000/);
  assert.strictEqual(api.actionCodeToNumeric("KEEP_AWAKE"), 0x190);
  assert.strictEqual(api.keyToNumericActions({ tap: "KEEP_AWAKE" }).tapCode, 0x190);
  assert.ok(api.isKeepAwakeCode("KEEP_AWAKE") && api.isKeepAwakeCode("ACT_KEEP_AWAKE"));
  assert.ok(!api.isKeepAwakeCode("TT_UP") && !api.isKeepAwakeCode(""));
  assert.ok(api.KEYCODES.some(g => g.keys.some(k => k.code === "KEEP_AWAKE")));
  assert.strictEqual(api.keyPressRole("KEEP_AWAKE"), "silent");
  assert.strictEqual(api.ONE_SHOT_LABELS.KEEP_AWAKE, "Awake");
  const copy = o => JSON.parse(JSON.stringify(o));
  const cfg = copy(R.defaultConfig);
  cfg.layers[0][2][1] = { tap: "KEEP_AWAKE" };
  const norm = api.normalizeConfig(cfg, R);
  assert.strictEqual(norm.layers[0][2][1].tap, "KEEP_AWAKE");
  api.validateConfigShape(norm, R);
  const combo = copy(R.defaultConfig);
  combo.combos = [{ key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 }, behavior: "KEY_PRESS", action: "KEEP_AWAKE" }];
  assert.throws(() => api.validateConfigShape(combo, R), /Keep-awake/);
  const left = copy(L.defaultConfig);
  left.layers[0][2][1] = { tap: "KEEP_AWAKE" };
  assert.throws(() => api.validateConfigShape(left, L), /Keep-awake/);
});

test("Deep Sleep: Code passt zur Firmware, Palette, Label und Rundlauf; Combos lehnen ihn ab, beide Hälften erlauben ihn", () => {
  const common = read("firmware/dactyl_right/DactylCommon.h");
  assert.match(common, /#define ACT_DEEP_SLEEP\s+0x191/);
  assert.match(read("firmware/dactyl_right/DactylVersion.h"), /#define DACTYL_FW_VERSION \d+\b/);
  assert.strictEqual(api.actionCodeToNumeric("DEEP_SLEEP"), 0x191);
  assert.strictEqual(api.keyToNumericActions({ tap: "DEEP_SLEEP" }).tapCode, 0x191);
  assert.ok(api.isDeepSleepCode("DEEP_SLEEP") && api.isDeepSleepCode("ACT_DEEP_SLEEP"));
  assert.ok(!api.isDeepSleepCode("KEEP_AWAKE") && !api.isDeepSleepCode(""));
  assert.ok(api.KEYCODES.some(g => g.keys.some(k => k.code === "DEEP_SLEEP")));
  assert.strictEqual(api.keyPressRole("DEEP_SLEEP"), "silent");
  assert.strictEqual(api.ONE_SHOT_LABELS.DEEP_SLEEP, "Sleep");
  const copy = o => JSON.parse(JSON.stringify(o));
  for (const [profile, base] of [[R, R.defaultConfig], [L, L.defaultConfig]]) {
    const cfg = copy(base);
    cfg.layers[0][2][1] = { tap: "DEEP_SLEEP" };
    const norm = api.normalizeConfig(cfg, profile);
    assert.strictEqual(norm.layers[0][2][1].tap, "DEEP_SLEEP");
    api.validateConfigShape(norm, profile);
  }
  const combo = copy(R.defaultConfig);
  combo.combos = [{ key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 }, behavior: "KEY_PRESS", action: "DEEP_SLEEP" }];
  assert.throws(() => api.validateConfigShape(combo, R), /Deep Sleep/);
});

test("Clear State: Code passt zur Firmware, Palette, Label und Rundlauf; Combos lehnen ihn ab, beide Hälften erlauben ihn", () => {
  assert.match(read("firmware/dactyl_right/DactylCommon.h"), /#define ACT_CLEAR_STATE\s+0x192/);
  assert.ok(Number(/DACTYL_FW_VERSION (\d+)/.exec(read("firmware/dactyl_right/DactylVersion.h"))[1]) >= 50);
  assert.strictEqual(api.actionCodeToNumeric("CLEAR_STATE"), 0x192);
  assert.strictEqual(api.keyToNumericActions({ tap: "CLEAR_STATE" }).tapCode, 0x192);
  assert.ok(api.isClearStateCode("CLEAR_STATE") && api.isClearStateCode("ACT_CLEAR_STATE"));
  assert.ok(!api.isClearStateCode("DEEP_SLEEP") && !api.isClearStateCode(""));
  assert.ok(api.KEYCODES.some(g => g.keys.some(k => k.code === "CLEAR_STATE")));
  assert.strictEqual(api.keyPressRole("CLEAR_STATE"), "silent");
  assert.strictEqual(api.ONE_SHOT_LABELS.CLEAR_STATE, "Clear");
  const copy = o => JSON.parse(JSON.stringify(o));
  for (const [profile, base] of [[R, R.defaultConfig], [L, L.defaultConfig]]) {
    const cfg = copy(base);
    cfg.layers[0][2][1] = { tap: "CLEAR_STATE" };
    const norm = api.normalizeConfig(cfg, profile);
    assert.strictEqual(norm.layers[0][2][1].tap, "CLEAR_STATE");
    api.validateConfigShape(norm, profile);
  }
  const combo = copy(R.defaultConfig);
  combo.combos = [{ key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 }, behavior: "KEY_PRESS", action: "CLEAR_STATE" }];
  assert.throws(() => api.validateConfigShape(combo, R), /Clear State/);
});

test("Einstellung numWordLayer: Standard 1, Bereich 0..7, Sync-Befehl optional, nwl aus DEVICE_INFO", () => {
  const n = api.normalizeConfig({ layers: [[]], settings: {} }, R);
  assert.strictEqual(n.settings.numWordLayer, 1);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { numWordLayer: 0 } }, R).settings.numWordLayer, 0);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { numWordLayer: 7 } }, R).settings.numWordLayer, 7);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { numWordLayer: 9 } }, R).settings.numWordLayer, 7);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { numWordLayer: -2 } }, R).settings.numWordLayer, 0);
  assert.ok(read("js/serial.js").includes("info.nwl"));
  assert.ok(read("js/config-sync.js").includes('ack: "SET_NUM_WORD_LAYER", optional: "args"'));
});

test("Einstellung bootLayer: Standard 0, Bereich 0..7, bl aus DEVICE_INFO, Eingabefeld vorhanden", () => {
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: {} }, R).settings.bootLayer, 0);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { bootLayer: 3 } }, R).settings.bootLayer, 3);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { bootLayer: 9 } }, R).settings.bootLayer, 7);
  assert.strictEqual(api.normalizeConfig({ layers: [[]], settings: { bootLayer: -2 } }, R).settings.bootLayer, 0);
  assert.strictEqual(api.settingsFromDeviceInfo({ bl: 4 }, {}).bootLayer, 4);
  assert.ok(read("js/serial.js").includes("info.bl"));
  assert.ok(read("index.html").includes('id="bootLayerSelect"'));
  assert.ok(read("js/editor-events.js").includes('bootLayerSelect'));
  assert.ok(read("js/config-sync.js").includes('ack: "SET_BOOT_LAYER", optional: "args"'));
});

test("Sentence Case: Code passt zur Firmware, Tastenpalette, Label und Rundlauf; MODIFIER_HOLD-Combo wird abgelehnt", () => {
  const common = read("firmware/dactyl_right/DactylCommon.h");
  assert.match(common, /#define ACT_SENTENCE_CASE\s+0x18C/);
  assert.strictEqual(api.actionCodeToNumeric("SENTENCE_CASE"), 0x18C);
  assert.strictEqual(api.keyToNumericActions({ tap: "SENTENCE_CASE" }).tapCode, 0x18C);
  assert.ok(api.KEYCODES.some(g => g.keys.some(k => k.code === "SENTENCE_CASE")));
  assert.strictEqual(api.ONE_SHOT_LABELS.SENTENCE_CASE, "Sentence");
  assert.ok(api.isOneShotOrCapsWordCode("SENTENCE_CASE") && api.isOneShotOrCapsWordCode("ACT_SENTENCE_CASE"));
  const copy = o => JSON.parse(JSON.stringify(o));
  for (const profile of [R, L]) {
    const cfg = copy(profile.defaultConfig);
    cfg.layers[0][2][1] = { tap: "SENTENCE_CASE" };
    const norm = api.normalizeConfig(cfg, profile);
    assert.strictEqual(norm.layers[0][2][1].tap, "SENTENCE_CASE");
    api.validateConfigShape(norm, profile);
  }
});

test("BLE-Host-Slots: Codes passen zu Firmware, Tastenpalette, Label und Rundlauf; Combos und linke Hälfte lehnen sie ab", () => {
  const common = read("firmware/dactyl_right/DactylCommon.h");
  assert.match(common, /#define ACT_HOST_BASE\s+0x188/);
  assert.match(common, /#define NUM_HOST_ACTIONS\s+3/);
  for (let n = 1; n <= 3; n++) {
    assert.strictEqual(api.actionCodeToNumeric(`HOST_${n}`), 0x188 + n - 1);
    assert.strictEqual(api.keyToNumericActions({ tap: `HOST_${n}` }).tapCode, 0x188 + n - 1);
    assert.ok(api.isBleHostCode(`HOST_${n}`) && api.isBleHostCode(`ACT_HOST_${n}`));
    assert.ok(api.KEYCODES.some(g => g.keys.some(k => k.code === `HOST_${n}`)));
    assert.strictEqual(api.ONE_SHOT_LABELS[`HOST_${n}`], `Host ${n}`);
  }
  assert.ok(!api.isBleHostCode("HOST_0") && !api.isBleHostCode("HOST_4") && !api.isBleHostCode("KEY_LOCK") && !api.isBleHostCode(""));
  const copy = o => JSON.parse(JSON.stringify(o));
  const cfg = copy(R.defaultConfig);
  cfg.layers[0][2][1] = { tap: "HOST_2" };
  const norm = api.normalizeConfig(cfg, R);
  assert.strictEqual(norm.layers[0][2][1].tap, "HOST_2");
  api.validateConfigShape(norm, R);
  const combo = copy(R.defaultConfig);
  combo.combos = [{ key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 }, behavior: "KEY_PRESS", action: "HOST_1" }];
  assert.throws(() => api.validateConfigShape(combo, R), /BLE-Host/);
  const left = copy(L.defaultConfig);
  left.layers[0][2][1] = { tap: "HOST_3" };
  assert.throws(() => api.validateConfigShape(left, L), /BLE-Host/);
});

test("One-Shot-Ebene: Codes passen zu Firmware und server.py, Combos lehnen sie ab", () => {
  const common = read("firmware/dactyl_right/DactylCommon.h");
  assert.match(common, /#define ACT_OSL_BASE\s+0x180/);
  assert.match(common, /#define NUM_OSL_ACTIONS\s+8/);
  for (let n = 0; n < 8; n++) {
    assert.strictEqual(api.actionCodeToNumeric(`OSL_${n}`), 0x180 + n);
    assert.strictEqual(api.keyToNumericActions({ tap: `OSL_${n}` }).tapCode, 0x180 + n);
    assert.strictEqual(api.findDefinitionByCode(0x180 + n).tap, `OSL_${n}`);
  }
  assert.strictEqual(api.isOslCode("OSL_3"), true);
  assert.strictEqual(api.isOslCode("ACT_OSL_3"), true);
  assert.strictEqual(api.isOslCode("OSL_8"), false);
  assert.strictEqual(api.isOslCode("MO_3"), false);
  const base = { layers: [[[]]], combos: [], keyPairs: [], macros: [] };
  assert.throws(() => api.validateConfigShape({ ...base, combos: [{ key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 }, action: "OSL_2" }] }, R), /One-Shot-Ebene/);
});

test("Layout-Prüfung: OSL_n macht die Ebene erreichbar, ohne sie einzurasten", () => {
  // Ebene 2 hat Belegung und ist nur über OSL_2 erreichbar: kein Befund "unerreichbar"
  const cfg = lintCfg();
  lintSet(cfg, 0, 0, 0, "OSL_2");
  lintSet(cfg, 2, 1, 1, "KEY_A");
  assert.deepStrictEqual(lintCodes(lintBoth(cfg), "layer-unreachable"), []);
  // OSL rastet nicht ein: auch ohne Taste zurück gibt es keine Falle
  assert.deepStrictEqual(lintCodes(lintBoth(cfg), "layer-trap"), []);
  // Auch die Firmware-Schreibweise und die Halte-Aktion zählen
  const hold = lintCfg();
  lintSet(hold, 0, 0, 0, "KEY_A", "ACT_OSL_3");
  lintSet(hold, 3, 1, 1, "KEY_B");
  assert.deepStrictEqual(lintCodes(lintBoth(hold), "layer-unreachable"), []);
  // Ohne OSL bleibt dieselbe Belegung unerreichbar (der Test schlägt ohne die Umsetzung fehl)
  const none = lintCfg();
  lintSet(none, 2, 1, 1, "KEY_A");
  assert.strictEqual(lintCodes(lintBoth(none), "layer-unreachable").length, 1);
  // OSL auf der anderen Hälfte führt die Ebene dieser Hälfte nicht ein: die Hälfte mit eigener Belegung braucht einen Weg
  assert.strictEqual(api.lintLayouts({ R: cfg, L: lintCfg() }, api.SIDE_PROFILES).length, 0);
});

test("Layout-Prüfung (Anzeige): ein Fehler in der Prüfung gibt keinen Befund und stoppt nichts", () => {
  const { w, dom } = lintUiHarness(lintCfg(), lintCfg());
  // configFor liefert für eine Hälfte eine Konfiguration, die lintLayouts zum Absturz bringt
  Object.defineProperty(w.configsBySide, "R", { get() { throw new Error("kaputt"); } });
  assert.doesNotThrow(() => { w.renderLayoutLint(); w.renderSyncDiffLint(); });
  assert.strictEqual(dom.document.getElementById("layoutLintPanel").style.display, "none");
  assert.strictEqual(dom.document.getElementById("syncDiffLintSection").style.display, "none");
  const events = [];
  assert.doesNotThrow(() => w.logLayoutLintToFlashLog({ onEvent: e => events.push(e) }));
  assert.deepStrictEqual(events, []);
});

// Die Aufrufe sitzen an den drei Stellen aus dem Auftrag (Matrix, Diff, Flashen); ohne sie bliebe jeder andere Test grün
test("Layout-Prüfung: renderMatrix, Diff-Dialog und Flashen rufen die Anzeige auf", () => {
  const between = (file, start, end) => section(file, start, end);
  assert.ok(between("js/editor.js", "function renderMatrix()", "function createHalfMatrix").includes("renderLayoutLint();"),
    "renderMatrix ruft renderLayoutLint nicht auf");
  assert.ok(between("js/config-sync.js", "function showSyncDiffDialog", "async function writeConfigWithDiff").includes("renderSyncDiffLint();"),
    "showSyncDiffDialog ruft renderSyncDiffLint nicht auf");
  const flash = between("js/editor-events.js", "async function saveAndFlashToDactyl", "function populateComboKeyDropdowns");
  const open = flash.indexOf("openFlashLogDialog(profile)");
  const lint = flash.indexOf("logLayoutLintToFlashLog(flashLog)");
  assert.ok(open >= 0 && lint > open, "saveAndFlashToDactyl schreibt die Warnungen nicht ins Flash-Protokoll");
  // Der Index.html lädt das Modul vor app.js, und der Server liefert es aus
  const html = read("index.html");
  assert.ok(html.indexOf("js/layout-lint-ui.js") > html.indexOf("js/matrix-test.js") &&
    html.indexOf("js/layout-lint-ui.js") < html.indexOf('src="app.js'), "Skript-Tag fehlt oder steht an der falschen Stelle");
  for (const id of ["layoutLintPanel", "layoutLintSummary", "layoutLintList", "syncDiffLintSection", "syncDiffLint"]) {
    assert.ok(html.includes(`id="${id}"`), `index.html ohne ${id}`);
  }
});

// -----------------------------------------------------------------------------
// Tote Tasten entfernen (clearAbsentKeyActions, Knopf "Entfernen" in der Layout-Prüfung)
// -----------------------------------------------------------------------------
test("Tote Tasten: Befund trägt Position und Ebenen für den Knopf", () => {
  const cfg = lintCfg();
  lintSet(cfg, 0, 5, 5, "KEY_BACKSPACE");
  lintSet(cfg, 3, 5, 5, "KEY_BACKSPACE");
  lintSet(cfg, 1, 2, 6, "KEY_DELETE");
  const found = lintCodes(lintBoth(cfg), "absent-key-action");
  assert.strictEqual(found.length, 2);
  const byPos = {};
  for (const f of found) byPos[`R${f.r}C${f.c}`] = [...f.layers];
  assert.deepStrictEqual(byPos, { R2C6: [1], R5C5: [0, 3] });
});

test("Tote Tasten: clearAbsentKeyActions leert nur die genannten Ebenen und liefert die alten Zellen", () => {
  const cfg = lintCfg();
  lintSet(cfg, 0, 5, 5, "KEY_BACKSPACE", "KEY_A");
  lintSet(cfg, 2, 5, 5, "KEY_BACKSPACE");
  lintSet(cfg, 4, 5, 5, "KEY_BACKSPACE");
  const before = JSON.stringify(cfg);
  const res = api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.R, 5, 5, [0, 2]);
  assert.strictEqual(JSON.stringify(cfg), before, "ändert die Konfiguration nicht");
  assert.deepStrictEqual([...res.old].map(o => o.l), [0, 2]);
  assert.strictEqual(res.old[0].cell.hold, "KEY_A");
  assert.strictEqual(res.layers[0][5][5].tap, "NONE");
  assert.strictEqual(res.layers[0][5][5].hold, "NONE");
  assert.strictEqual(res.layers[2][5][5].tap, "NONE");
  assert.strictEqual(res.layers[4][5][5].tap, "KEY_BACKSPACE", "nicht genannte Ebene bleibt");
  // Nach dem Entfernen meldet die Prüfung nur noch Ebene 4
  const next = { ...cfg, layers: res.layers };
  assert.deepStrictEqual([...lintCodes(lintBoth(next), "absent-key-action")[0].layers], [4]);
});

test("Tote Tasten: clearAbsentKeyActions löscht nie eine echte Taste und prüft die Eingaben", () => {
  const cfg = lintCfg();
  lintSet(cfg, 0, 2, 1, "KEY_J");
  lintSet(cfg, 0, 5, 5, "KEY_A");
  // R2C1 gibt es rechts: nichts löschen
  assert.strictEqual(api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.R, 2, 1, [0]), null);
  // R5C5 gibt es links (dort echte Taste), rechts nicht
  assert.strictEqual(api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.L, 5, 5, [0]), null);
  assert.notStrictEqual(api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.R, 5, 5, [0]), null);
  // Ungültige Position, Ebene, Liste, Konfiguration
  assert.strictEqual(api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.R, 6, 5, [0]), null);
  assert.strictEqual(api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.R, 5, "5", [0]), null);
  assert.strictEqual(api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.R, 5, 5, [9, -1, "0"]), null);
  assert.strictEqual(api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.R, 5, 5, "0"), null);
  assert.strictEqual(api.clearAbsentKeyActions(null, api.SIDE_PROFILES.R, 5, 5, [0]), null);
  assert.strictEqual(api.clearAbsentKeyActions({ layers: "x" }, api.SIDE_PROFILES.R, 5, 5, [0]), null);
  // Ebene ohne Aktion auf der Position: nichts zu entfernen
  assert.strictEqual(api.clearAbsentKeyActions(cfg, api.SIDE_PROFILES.R, 5, 5, [3]), null);
});

// Knopf in der Layout-Prüfung: vormerken, rückgängig machen, Hälfte wechseln
function removeButtonHarness(rightCfg, leftCfg, editSide = "R") {
  const dom = fakeDom();
  const log = { pending: [], toasts: [], saved: [], switched: [], matrix: 0 };
  const w = { console: { log() {}, warn() {}, error() {} }, document: dom.document };
  vm.createContext(w);
  vm.runInContext(`${code}
var configsBySide = {}, editSide = ${JSON.stringify(editSide)};
function configFor(side) { return configsBySide[side]; }
function keycodeLabel(c) { return c; }
function showToast(t) { log.toasts.push(t); }
function renderMatrix() { log.matrix++; }
function saveConfigToServer(side) { log.saved.push(side); }
function switchEditSide(side) { log.switched.push(side); editSide = side; }
function markPendingSync(change, side) { change.side = side; log.pending.push(change); }
${read("js/layout-lint-ui.js")}`, w);
  w.log = log;
  w.configsBySide = { R: rightCfg, L: leftCfg };
  return { w, dom, log };
}

function findRemoveButton(dom) {
  const out = [];
  const walk = n => { (n.children || []).forEach(c => { if (c.tagName === "BUTTON") out.push(c); walk(c); }); };
  walk(dom.document.getElementById("layoutLintList"));
  return out;
}

test("Tote Tasten (Anzeige): Knopf steht nur am Befund und nicht im Diff-Dialog", () => {
  const right = lintCfg();
  lintSet(right, 0, 5, 5, "KEY_BACKSPACE");
  right.keyPairs = [{ first: "KEY_A", second: "KEY_B" }];
  const { w, dom } = removeButtonHarness(right, lintCfg());
  w.renderLayoutLint();
  const buttons = findRemoveButton(dom);
  assert.strictEqual(buttons.length, 1, "genau ein Knopf: nur der Befund 'Taste gibt es nicht'");
  assert.strictEqual(buttons[0].textContent, "Entfernen");
  assert.ok(buttons[0].title.includes("R5C5") && buttons[0].title.includes("Ebene 0"), buttons[0].title);
  // Im Diff-Dialog bleibt die Konfiguration während der Übertragung unverändert: kein Knopf
  w.renderSyncDiffLint();
  const diffButtons = [];
  const walk = n => { (n.children || []).forEach(c => { if (c.tagName === "BUTTON") diffButtons.push(c); walk(c); }); };
  walk(dom.document.getElementById("syncDiffLint"));
  assert.strictEqual(diffButtons.length, 0);
});

test("Tote Tasten (Anzeige): Entfernen leert die Aktionen, merkt vor und macht sich rückgängig", async () => {
  const right = lintCfg();
  for (const l of [0, 1, 4]) lintSet(right, l, 5, 5, "KEY_BACKSPACE");
  lintSet(right, 0, 2, 1, "KEY_J");
  const { w, dom, log } = removeButtonHarness(right, lintCfg());
  w.renderLayoutLint();
  await findRemoveButton(dom)[0].click();
  for (const l of [0, 1, 4]) assert.strictEqual(right.layers[l][5][5].tap, "NONE", `Ebene ${l}`);
  assert.strictEqual(right.layers[0][2][1].tap, "KEY_J", "echte Taste bleibt");
  assert.strictEqual(log.pending.length, 1);
  assert.strictEqual(log.pending[0].type, "key");
  assert.strictEqual(log.pending[0].side, "R");
  assert.strictEqual(log.pending[0].title, "Taste [R5, C5] entfernt");   // Stil der Tastenänderungen im Inspektor
  assert.ok(log.pending[0].description.includes("Ebenen 0, 1, 4"), log.pending[0].description);
  assert.deepStrictEqual(log.saved, ["R"]);
  assert.ok(log.matrix >= 1);
  // Die Prüfung meldet nichts mehr
  assert.deepStrictEqual(lintCodes(lintBoth(right), "absent-key-action"), []);
  // Rückgängig stellt die alten Zellen wieder her und speichert
  log.pending[0].revert();
  for (const l of [0, 1, 4]) assert.strictEqual(right.layers[l][5][5].tap, "KEY_BACKSPACE", `Ebene ${l}`);
  assert.deepStrictEqual(log.saved, ["R", "R"]);
});

test("Tote Tasten (Anzeige): Befund der anderen Hälfte wechselt zuerst die bearbeitete Hälfte", async () => {
  const left = lintCfg();
  lintSet(left, 2, 5, 0, "KEY_A");                  // R5C0 gibt es links nicht
  const { w, dom, log } = removeButtonHarness(lintCfg(), left, "R");
  w.renderLayoutLint();
  await findRemoveButton(dom)[0].click();
  assert.deepStrictEqual(log.switched, ["L"]);
  assert.strictEqual(left.layers[2][5][0].tap, "NONE");
  assert.strictEqual(log.pending[0].side, "L");
  assert.deepStrictEqual(log.saved, ["L"]);
});

test("Tote Tasten (Anzeige): geänderte Belegung seit der Anzeige meldet nichts zu entfernen", async () => {
  const right = lintCfg();
  lintSet(right, 0, 5, 5, "KEY_BACKSPACE");
  const { w, dom, log } = removeButtonHarness(right, lintCfg());
  w.renderLayoutLint();
  const button = findRemoveButton(dom)[0];
  // Die Aktion verschwindet, bevor der Knopf gedrückt wird (z. B. durch Rückgängig oder ein Profil)
  right.layers[0][5][5] = { label: "---", tap: "NONE", hold: "NONE", dtap: "NONE" };
  await button.click();
  assert.strictEqual(log.pending.length, 0);
  assert.deepStrictEqual(log.saved, []);
  assert.ok(log.toasts.at(-1).includes("nichts zu entfernen"), log.toasts.at(-1));
});

test("Tote Tasten (Anzeige): Rückgängig schreibt in die aktuelle Konfiguration, nicht in ein ersetztes Objekt", async () => {
  const right = lintCfg();
  lintSet(right, 0, 5, 5, "KEY_BACKSPACE");
  const { w, dom, log } = removeButtonHarness(right, lintCfg());
  w.renderLayoutLint();
  await findRemoveButton(dom)[0].click();
  // Ein Lesen vom Gerät oder ein Profil ersetzt das Konfigurationsobjekt der Hälfte
  const replaced = lintCfg();
  w.configsBySide.R = replaced;
  log.pending[0].revert();
  assert.strictEqual(replaced.layers[0][5][5].tap, "KEY_BACKSPACE", "die aktuelle Konfiguration bekommt die Zelle zurück");
  assert.strictEqual(right.layers[0][5][5].tap, "NONE", "das alte Objekt bleibt unberührt");
  assert.deepStrictEqual(log.saved, ["R", "R"]);
  // Ohne Konfiguration der Hälfte bricht das Rückgängig nicht ab und speichert nichts
  w.configsBySide.R = undefined;
  assert.doesNotThrow(() => log.pending[0].revert());
  assert.deepStrictEqual(log.saved, ["R", "R"]);
});

test("Tote Tasten (Anzeige): ein zweiter Klick auf denselben Knopf entfernt nichts doppelt", async () => {
  const right = lintCfg();
  lintSet(right, 0, 5, 5, "KEY_BACKSPACE");
  const { w, dom, log } = removeButtonHarness(right, lintCfg());
  w.renderLayoutLint();
  const button = findRemoveButton(dom)[0];
  await button.click();
  await button.click();
  assert.strictEqual(log.pending.length, 1);
  assert.deepStrictEqual(log.saved, ["R"]);
  assert.ok(log.toasts.at(-1).includes("schon entfernt"), log.toasts.at(-1));
});

// Body mit getReader() aus Byte-Stücken
function fakeFlashBody(chunks) {
  let i = 0;
  return { getReader: () => ({ read: async () => (i < chunks.length ? { value: chunks[i++], done: false } : { value: undefined, done: true }) }) };
}

asyncTests.push(["Flash-Protokoll: Stream meldet jede Zeile und liefert das Ergebnis", async () => {
  const bytes = Buffer.from('{"type":"log","stage":"compile","line":"Größe"}\n{"type":"result","success":false,"stage":"upload","error":"x"}\n', "utf8");
  const cut = bytes.indexOf(Buffer.from("ö")) + 1;          // mitten im UTF-8-Zeichen
  const events = [];
  const result = await api.readFlashStream(fakeFlashBody([bytes.subarray(0, cut), bytes.subarray(cut)]), e => events.push(e));
  assert.strictEqual(events[0].line, "Größe");
  assert.strictEqual(events.length, 2);
  assert.deepStrictEqual({ ...result }, { type: "result", success: false, stage: "upload", error: "x" });
  // Ohne Ergebnis-Zeile (Server abgestürzt) liefert der Stream null
  const none = await api.readFlashStream(fakeFlashBody([Buffer.from('{"type":"log","line":"a"}\n')]), () => {});
  assert.strictEqual(none, null);
}]);

// Test für die WebSerial-Auswahllogik in Electron (main.js)
test("main.js: matchSerialPort erkennt ESP32-Seriellports und filtert andere", () => {
  const mainJs = read("main.js");
  const fnMatch = mainJs.match(/function matchSerialPort\(p\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(fnMatch, "matchSerialPort muss in main.js definiert sein");
  const matchFn = new Function("p", fnMatch[0] + "\nreturn matchSerialPort(p);");

  assert.strictEqual(matchFn({ portName: "/dev/cu.usbserial-1320" }), true);
  assert.strictEqual(matchFn({ displayName: "USB Single Serial" }), true);
  assert.strictEqual(matchFn({ portName: "cu.wchusbserial1420" }), true);
  assert.strictEqual(matchFn({ portName: "/dev/cu.Bluetooth-Incoming-Port" }), false);
  assert.strictEqual(matchFn(null), false);
  assert.strictEqual(matchFn({}), false);
});

test("main.js: select-serial-port wartet auf serial-port-added statt sofort abzubrechen", async () => {
  const mainJs = read("main.js");
  assert.ok(mainJs.includes("serial-port-added"), "main.js muss auf serial-port-added lauschen");
  assert.ok(mainJs.includes("handleSerialPortAdded"), "main.js muss handleSerialPortAdded definieren");
  // Darf nicht sofort callback('') bei leerer portList aufrufen
  assert.ok(!/else\s*\{\s*callback\(''\);\s*\}/.test(mainJs), "Darf bei leerer portList nicht sofort abbrechen");
  // Darf bei nicht-passenden Ports nicht sofort den ersten Port wählen
  assert.ok(!/else if\s*\(portList\.length > 0\)\s*\{\s*callback\(portList\[0\]\.portId\)/.test(mainJs), "Darf fremde Ports nicht vor Ablauf des Timeouts wählen");
  assert.ok(mainJs.includes("disable-serial-blocklist"), "main.js muss disable-serial-blocklist setzen");
});

test("main.js: isAllowedOrigin akzeptiert localhost und 127.0.0.1 mit oder ohne Pfad", () => {
  const mainJs = read("main.js");
  const fnMatch = mainJs.match(/const ALLOWED_ORIGINS[\s\S]*?function isAllowedOrigin\(rawUrl\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(fnMatch, "isAllowedOrigin muss in main.js definiert sein");
  const checkFn = new Function("rawUrl", fnMatch[0] + "\nreturn isAllowedOrigin(rawUrl);");

  assert.strictEqual(checkFn("http://localhost:8088"), true);
  assert.strictEqual(checkFn("http://localhost:8088/"), true);
  assert.strictEqual(checkFn("http://localhost:8088/api/status"), true);
  assert.strictEqual(checkFn("http://127.0.0.1:8088"), true);
  assert.strictEqual(checkFn("http://127.0.0.1:8088/index.html"), true);
  assert.strictEqual(checkFn("http://localhost:8088.evil.com"), false);
  assert.strictEqual(checkFn("https://evil.com"), false);
  assert.strictEqual(checkFn(""), false);
  assert.strictEqual(checkFn(null), false);
});

test("main.js: isAllowedWebContents weist ungültige fallbackUrl sofort ab", () => {
  const mainJs = read("main.js");
  const fnMatch = mainJs.match(/const ALLOWED_ORIGINS[\s\S]*?function isAllowedWebContents\(wc, fallbackUrl\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(fnMatch, "isAllowedWebContents muss in main.js definiert sein");
  const checkFn = new Function("wc", "fallbackUrl", fnMatch[0] + "\nreturn isAllowedWebContents(wc, fallbackUrl);");

  const localWc = { getURL: () => "http://localhost:8088" };
  // Sicherheitsprüfung: Ein fremder Ursprung als fallbackUrl darf nicht durch die lokale Fenster-URL gerettet werden
  assert.strictEqual(checkFn(localWc, "https://evil.com"), false);
  assert.strictEqual(checkFn(localWc, "http://localhost:8088.evil.com"), false);
  // Gültige fallbackUrl wird akzeptiert
  assert.strictEqual(checkFn(localWc, "http://localhost:8088/"), true);
  assert.strictEqual(checkFn(null, "http://127.0.0.1:8088/api"), true);
  // Leere fallbackUrl fällt auf wc.getURL() zurück
  assert.strictEqual(checkFn(localWc, ""), true);
  assert.strictEqual(checkFn(localWc, null), true);
  assert.strictEqual(checkFn({ getURL: () => "https://evil.com" }, ""), false);
  assert.strictEqual(checkFn(null, null), false);
});

asyncTests.push(["js/serial.js: connectSerialNow fällt bei fehlerhaftem vor-berechtigten Port auf requestPort zurück", async () => {
  // Simulierte Umgebung
  let requestedPortOpened = false;
  let requestPortCalled = false;
  let brokenPortOpenAttempts = 0;

  const mockBrokenPort = {
    open: async () => {
      brokenPortOpenAttempts++;
      throw new Error("Port busy");
    }
  };
  const mockWorkingPort = {
    open: async () => {
      requestedPortOpened = true;
    },
    addEventListener: () => {}
  };

  // Port-Auswahl-Algorithmus aus js/serial.js isoliert testen
  async function selectPort(getPorts, requestPort, options = {}) {
    let port = null;
    let portAlreadyOpen = false;
    if (typeof getPorts === "function") {
      const granted = await getPorts();
      if (options.reuseGrantedPort) {
        port = granted[0] || null;
        if (!port) throw new Error("Kein Port");
      } else if (granted && granted.length > 0) {
        for (const candidate of granted) {
          try {
            await candidate.open({ baudRate: 115200 });
            port = candidate;
            portAlreadyOpen = true;
            break;
          } catch (_) {}
        }
      }
    }
    if (!port) {
      port = await requestPort();
    }
    if (!portAlreadyOpen) {
      await port.open({ baudRate: 115200 });
    }
    return port;
  }

  const selected = await selectPort(
    async () => [mockBrokenPort],
    async () => {
      requestPortCalled = true;
      return mockWorkingPort;
    }
  );

  assert.strictEqual(brokenPortOpenAttempts, 1, "Muss defekten Port versucht haben");
  assert.strictEqual(requestPortCalled, true, "Muss auf requestPort zurückgefallen sein");
  assert.strictEqual(requestedPortOpened, true, "Muss den neu angeforderten Port geöffnet haben");
  assert.strictEqual(selected, mockWorkingPort, "Ausgewählter Port muss der funktionierende Port sein");
}]);

asyncTests.push(["js/serial.js: connectSerialNow nutzt funktionierenden vor-berechtigten Port direkt", async () => {
  let workingPortOpened = false;
  let requestPortCalled = false;

  const mockWorkingPort = {
    open: async () => { workingPortOpened = true; }
  };

  async function selectPort(getPorts, requestPort) {
    let port = null;
    let portAlreadyOpen = false;
    if (typeof getPorts === "function") {
      const granted = await getPorts();
      if (granted && granted.length > 0) {
        for (const candidate of granted) {
          try {
            await candidate.open({ baudRate: 115200 });
            port = candidate;
            portAlreadyOpen = true;
            break;
          } catch (_) {}
        }
      }
    }
    if (!port) {
      port = await requestPort();
    }
    if (!portAlreadyOpen) {
      await port.open({ baudRate: 115200 });
    }
    return port;
  }

  const selected = await selectPort(
    async () => [mockWorkingPort],
    async () => {
      requestPortCalled = true;
      return null;
    }
  );

  assert.strictEqual(workingPortOpened, true, "Muss vor-berechtigten Port öffnen");
  assert.strictEqual(requestPortCalled, false, "Darf requestPort nicht aufrufen wenn vor-berechtigter Port funktioniert");
  assert.strictEqual(selected, mockWorkingPort);
}]);

test("UI-Restrukturierung: Neuer Tab Flashen & Sync enthält Verschiebe-Buttons, nicht im Header", () => {
  const html = read("index.html");
  assert.ok(html.includes('data-tab="flash-sync-tab"'), "Tab-Button flash-sync-tab fehlt");

  const tabStart = html.indexOf('id="flash-sync-tab"');
  assert.ok(tabStart >= 0, "Tab-Content flash-sync-tab fehlt");
  const tabEnd = html.indexOf('</main>', tabStart);
  const tabContent = html.slice(tabStart, tabEnd);

  const expectedButtons = [
    "btnSaveToDactyl",
    "btnReadConfig",
    "btnWriteConfig",
    "btnLayoutProfiles",
    "btnExportJson",
    "btnImportJson",
    "fileInput"
  ];
  for (const id of expectedButtons) {
    assert.ok(tabContent.includes(`id="${id}"`), `${id} fehlt im Tab flash-sync-tab`);
  }

  const header = html.slice(html.indexOf('<header class="app-header">'), html.indexOf('</header>'));
  for (const id of expectedButtons) {
    assert.ok(!header.includes(`id="${id}"`), `${id} darf nicht mehr im Header liegen`);
  }
});

test("UI-Restrukturierung: USB-Live-Monitor und Connect-Button liegen im Tab Matrix-Test", () => {
  const html = read("index.html");
  const matrixTestStart = html.indexOf('id="matrix-test-tab"');
  assert.ok(matrixTestStart >= 0, "matrix-test-tab fehlt in index.html");
  const matrixTestEnd = html.indexOf('</main>', matrixTestStart);
  const matrixTestContent = html.slice(matrixTestStart, matrixTestEnd);

  assert.ok(matrixTestContent.includes('id="liveMonitorCard"'), "liveMonitorCard fehlt in matrix-test-tab");
  assert.ok(matrixTestContent.includes('id="btnConnect"'), "btnConnect fehlt in matrix-test-tab");

  const matrixTabStart = html.indexOf('id="matrix-tab"');
  const matrixTabEnd = html.indexOf('</main>', matrixTabStart);
  const matrixTabContent = html.slice(matrixTabStart, matrixTabEnd);
  assert.ok(!matrixTabContent.includes('id="liveMonitorCard"'), "liveMonitorCard darf nicht in matrix-tab liegen");
});

test("UI-Restrukturierung: Drahtloser Konfig-Modus steht oberhalb der Tabs mit einklappbarer Erklärung", () => {
  const html = read("index.html");
  const configCardPos = html.indexOf('id="configModeGuideCard"');
  const navTabsPos = html.indexOf('class="nav-tabs"');
  assert.ok(configCardPos >= 0, "configModeGuideCard fehlt");
  assert.ok(navTabsPos >= 0, "nav-tabs fehlt");
  assert.ok(configCardPos < navTabsPos, "configModeGuideCard muss oberhalb von nav-tabs stehen");

  const detailsMatch = /<details[^>]*id="configGuideDetails"[^>]*>([\s\S]*?)<\/details>/.exec(html);
  assert.ok(detailsMatch, "configGuideDetails <details>-Element fehlt");
  assert.ok(!detailsMatch[0].includes(" open"), "configGuideDetails darf nicht standardmäßig open sein");
  assert.ok(detailsMatch[1].includes('id="configGuideDesc"'), "configGuideDesc muss in configGuideDetails liegen");
});

test("UI-Restrukturierung: Split-View aktiviert nebeneinander stehende Tastaturen und Inspektor darunter", () => {
  const editorJs = read("js/editor.js");
  assert.ok(editorJs.includes('.classList.toggle("split-view", activeHandView === "both")'), "split-view Klasse muss getoggled werden");
  assert.ok(editorJs.includes('splitWrapper.style.flexWrap = "nowrap"'), "Split-Tastaturen müssen flexWrap nowrap haben");
  assert.ok(editorJs.includes('split-keyboard-col'), "Split-Keyboard Spalten müssen als Panes gerendert werden");
  assert.ok(editorJs.includes('split-pane-header'), "Panes müssen Header mit Beschriftung haben");
  assert.ok(editorJs.includes('is-active-pane'), "Aktive Pane muss hervorgehoben werden");

  const css = read("style.css");
  assert.ok(css.includes(".editor-workspace.split-view"), "CSS muss .editor-workspace.split-view definieren");
  assert.ok(css.includes(".split-keyboards-row"), "CSS muss .split-keyboards-row definieren");
  assert.ok(css.includes(".split-keyboard-col"), "CSS muss .split-keyboard-col Pane-Stile definieren");
  assert.ok(css.includes("flex: 1 1 0"), "Panes müssen flex: 1 1 0 für gleichmäßiges Vergrößern haben");
  assert.ok(css.includes("max-width: 1800px"), ".app-container muss breitere Bildschirme unterstützen");
});

test("Layer overview: buildLayerOverview markiert transparente Tasten auf Ebene 1..7", () => {
  const profile = api.SIDE_PROFILES.R;
  const cfg = JSON.parse(JSON.stringify(profile.defaultConfig));
  // Layer 0 R0C1 hat Taste '7' (KEY_7)
  // Auf Layer 1 setzen wir R0C1 auf NONE (Transparent)
  cfg.layers[1][0][1] = { tap: "NONE", hold: "NONE", dtap: "NONE", label: "" };
  // Und R0C2 auf Layer 1 mit eigener Aktion KEY_F1
  cfg.layers[1][0][2] = { tap: "KEY_F1", hold: "NONE", dtap: "NONE", label: "F1" };

  const overview = api.buildLayerOverview(cfg, profile);
  assert.strictEqual(overview.length, 8, "Overview muss 8 Layer enthalten");

  // Layer 0: keine Taste darf als transparent markiert sein, ownCount muss > 0 sein
  const l0 = overview[0];
  assert.strictEqual(l0.layer, 0);
  assert.strictEqual(l0.transparentCount, 0, "Layer 0 darf keine transparenten Tasten zählen");
  assert.ok(l0.ownCount > 0, "Layer 0 muss eigene Tasten zählen");
  const l0Key1 = l0.rows[0][1];
  assert.ok(l0Key1, "R0C1 auf Layer 0 existiert");
  assert.strictEqual(l0Key1.transparent, false, "Layer 0 Tasten sind nie transparent");

  // Layer 1: R0C1 muss als transparent markiert sein und inheritedLabel von Layer 0 tragen
  const l1 = overview[1];
  assert.strictEqual(l1.layer, 1);
  const l1Key1 = l1.rows[0][1];
  assert.ok(l1Key1, "R0C1 auf Layer 1 existiert");
  assert.strictEqual(l1Key1.transparent, true, "R0C1 auf Layer 1 muss als transparent markiert sein");
  assert.ok(l1Key1.inheritedLabel, "R0C1 muss inheritedLabel von Layer 0 besitzen");

  // R0C2 auf Layer 1 hat eigene Aktion -> nicht transparent
  const l1Key2 = l1.rows[0][2];
  assert.ok(l1Key2, "R0C2 auf Layer 1 existiert");
  assert.strictEqual(l1Key2.transparent, false, "R0C2 mit eigener Aktion darf nicht transparent sein");
  assert.strictEqual(l1Key2.hasOwn, true);
});

test("Layer overview: buildLayerOverview erkennt physisch fehlende Tasten je Seite", () => {
  const rightProfile = api.SIDE_PROFILES.R;
  const leftProfile = api.SIDE_PROFILES.L;
  const rightCfg = JSON.parse(JSON.stringify(rightProfile.defaultConfig));
  const leftCfg = JSON.parse(JSON.stringify(leftProfile.defaultConfig));

  const rightOverview = api.buildLayerOverview(rightCfg, rightProfile);
  const leftOverview = api.buildLayerOverview(leftCfg, leftProfile);

  // Rechte Hand: R4C0 existiert nicht (Finger-Matrix)
  const r0 = rightOverview[0];
  const r4c0 = r0.rows[4][0];
  assert.strictEqual(r4c0.exists, false, "Rechts R4C0 darf nicht existieren");

  // Linke Hand: R4C5 existiert nicht (Finger-Matrix)
  const l0 = leftOverview[0];
  const l4c5 = l0.rows[4][5];
  assert.strictEqual(l4c5.exists, false, "Links R4C5 darf nicht existieren");
});

test("Layer overview: buildLayerOverview erkennt Konflikte (trigger-shadowed und duplicate-action)", () => {
  const profile = api.SIDE_PROFILES.R;
  const cfg = JSON.parse(JSON.stringify(profile.defaultConfig));

  // Layer 0: Taste R0C3 triggert MO_1
  cfg.layers[0][0][3] = { tap: "MO_1", hold: "NONE", dtap: "NONE", label: "MO 1" };
  // Auf Layer 1: Taste R0C3 hat eine eigene Aktion -> trigger-shadowed
  cfg.layers[1][0][3] = { tap: "KEY_1", hold: "NONE", dtap: "NONE", label: "1" };

  // Auf Layer 2: Zwei Tasten mit gleicher Aktion (nicht Modifikator) -> duplicate-action
  cfg.layers[2][0][1] = { tap: "KEY_5", hold: "NONE", dtap: "NONE", label: "5" };
  cfg.layers[2][0][2] = { tap: "KEY_5", hold: "NONE", dtap: "NONE", label: "5" };

  const overview = api.buildLayerOverview(cfg, profile);

  const l1Key3 = overview[1].rows[0][3];
  assert.strictEqual(l1Key3.conflict, true, "Trigger-shadowed Konflikt muss conflict=true sein");
  assert.ok(l1Key3.conflictReason.includes("schaltet per MO_1"), "Trigger-shadowed Konflikt muss in conflictReason stehen");

  const l2Key1 = overview[2].rows[0][1];
  const l2Key2 = overview[2].rows[0][2];
  assert.strictEqual(l2Key1.conflict, true, "Duplicate-action Konflikt auf Taste 1");
  assert.strictEqual(l2Key2.conflict, true, "Duplicate-action Konflikt auf Taste 2");
  assert.ok(l2Key1.conflictReason.includes("Doppelte Belegung"), "Duplicate-action Begründung auf Taste 1");
});

test("Layer overview: UI-Elemente und CSS-Klassen sind in HTML, CSS und editor.js vorhanden", () => {
  const html = read("index.html");
  assert.ok(html.includes('id="btnToggleLayerOverview"'), "Toggle-Button btnToggleLayerOverview fehlt in index.html");
  assert.ok(html.includes('id="layerOverviewPanel"'), "layerOverviewPanel fehlt in index.html");

  const css = read("style.css");
  assert.ok(css.includes(".layer-overview-panel"), "CSS muss .layer-overview-panel definieren");
  assert.ok(css.includes(".layer-overview-grid"), "CSS muss .layer-overview-grid definieren");
  assert.ok(css.includes(".layer-overview-card"), "CSS muss .layer-overview-card definieren");
  assert.ok(css.includes(".overview-key.is-transparent"), "CSS muss .overview-key.is-transparent definieren");
  assert.ok(css.includes(".overview-key.is-conflict"), "CSS muss .overview-key.is-conflict definieren");

  const editorJs = read("js/editor.js");
  assert.ok(editorJs.includes("toggleLayerOverview"), "toggleLayerOverview Funktion fehlt in editor.js");
  assert.ok(editorJs.includes("renderLayerOverview"), "renderLayerOverview Funktion fehlt in editor.js");
  assert.ok(editorJs.includes("createOverviewKeyElement"), "createOverviewKeyElement Funktion fehlt in editor.js");
  assert.ok(editorJs.includes("btnToggleLayerOverview"), "Event-Listener für btnToggleLayerOverview fehlt in editor.js");
});

test("Layer overview: buildLayerOverview wirft keinen Fehler bei null oder undefined cfg", () => {
  assert.doesNotThrow(() => api.buildLayerOverview(null));
  assert.doesNotThrow(() => api.buildLayerOverview(undefined));
  const res = api.buildLayerOverview(null, api.SIDE_PROFILES.R);
  assert.strictEqual(res.length, 8);
});

test("On-Screen-Keyboard: Alle Action-Codes in ON_SCREEN_KEYBOARD_ROWS existieren in KEYCODE_OPTIONS", () => {
  assert.ok(Array.isArray(api.ON_SCREEN_KEYBOARD_ROWS), "ON_SCREEN_KEYBOARD_ROWS muss ein Array sein");
  assert.ok(api.ON_SCREEN_KEYBOARD_ROWS.length > 0, "ON_SCREEN_KEYBOARD_ROWS darf nicht leer sein");
  assert.ok(Array.isArray(api.KEYCODE_OPTIONS), "KEYCODE_OPTIONS muss ein Array sein");
  assert.ok(api.KEYCODE_OPTIONS.length > 0, "KEYCODE_OPTIONS darf nicht leer sein");

  const validCodes = new Set(api.KEYCODE_OPTIONS.map(opt => typeof opt === "string" ? opt : opt.value));
  let totalKeys = 0;
  for (let r = 0; r < api.ON_SCREEN_KEYBOARD_ROWS.length; r++) {
    const row = api.ON_SCREEN_KEYBOARD_ROWS[r];
    assert.ok(Array.isArray(row), `Zeile ${r} in ON_SCREEN_KEYBOARD_ROWS muss ein Array sein`);
    for (const key of row) {
      assert.ok(key && typeof key.code === "string", `Ungültiger Tasteneintrag in Zeile ${r}: ${JSON.stringify(key)}`);
      assert.ok(validCodes.has(key.code), `Aktions-Code "${key.code}" (${key.label}) existiert nicht in KEYCODE_OPTIONS`);
      totalKeys++;
    }
  }
  assert.ok(totalKeys >= 50, `Mindestens 50 On-Screen-Tasten erwartet, gefunden: ${totalKeys}`);
});

test("On-Screen-Keyboard: Klick auf Taste setzt denselben Action-Code in primaryActionSelect, holdActionSelect, comboActionSelect, macroStepCode", () => {
  assert.strictEqual(typeof api.pickActionFromOnScreenKey, "function", "pickActionFromOnScreenKey muss eine Funktion sein");

  const targets = ["primaryActionSelect", "holdActionSelect", "comboActionSelect", "macroStepCode"];
  for (const targetId of targets) {
    const select = {
      id: targetId,
      value: "NONE",
      listeners: {},
      dataset: {},
      addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
      dispatchEvent(ev) { (this.listeners[ev.type] || []).forEach(fn => fn(ev)); },
      fire(type, ev = {}) { (this.listeners[type] || []).forEach(fn => fn({ target: this, ...ev })); }
    };

    let changeFired = false;
    select.addEventListener("change", () => { changeFired = true; });

    select.dataset.filterBlocked = "true";
    const filterInput = { value: "filterQuery" };
    const fakeDoc = {
      querySelector: sel => sel.includes(targetId) ? filterInput : null,
      getElementById: id => id === targetId ? select : null
    };

    api.pickActionFromOnScreenKey(select, "KEY_C", { document: fakeDoc });

    assert.strictEqual(select.value, "KEY_C", `${targetId}: select.value muss KEY_C sein`);
    assert.strictEqual(changeFired, true, `${targetId}: change-Event muss ausgelöst werden`);
    assert.strictEqual(filterInput.value, "", `${targetId}: Suchfilter muss zurückgesetzt werden`);
  }

  // Dynamisches Makro-Schritt-Select (.macro-step-code ohne feste ID)
  const dynamicSelect = {
    className: "form-control macro-step-code",
    value: "NONE",
    listeners: {},
    dataset: { filterFor: "macroStepCode" },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    dispatchEvent(ev) { (this.listeners[ev.type] || []).forEach(fn => fn(ev)); }
  };
  let dynamicChangeFired = false;
  dynamicSelect.addEventListener("change", () => { dynamicChangeFired = true; });
  api.pickActionFromOnScreenKey(dynamicSelect, "KEY_ENTER");
  assert.strictEqual(dynamicSelect.value, "KEY_ENTER", "dynamischer macro-step-code muss KEY_ENTER erhalten");
  assert.strictEqual(dynamicChangeFired, true, "dynamischer macro-step-code muss change auslösen");
});

test("On-Screen-Keyboard: pickActionFromOnScreenKey ergänzt fehlende Option bei dynamischen Selects", () => {
  // Simuliere HTMLSelectElement-Verhalten: ohne passende Option bleibt value leer
  const opts = [{ value: "KEY_A", textContent: "KEY_A" }];
  const select = {
    tagName: "SELECT",
    options: opts,
    _val: "KEY_A",
    get value() { return this._val; },
    set value(v) {
      const match = this.options.find(o => o.value === v);
      this._val = match ? match.value : "";
    },
    appendChild(opt) { this.options.push(opt); return opt; },
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    dispatchEvent(ev) { (this.listeners[ev.type] || []).forEach(fn => fn(ev)); }
  };

  // Vor dem Fix würde pickActionFromOnScreenKey die Option nicht anfügen und select.value würde ""
  api.pickActionFromOnScreenKey(select, "KEY_X");
  assert.strictEqual(select.value, "KEY_X", "select.value muss KEY_X sein, nicht leer");
  assert.ok(select.options.some(o => o.value === "KEY_X"), "Option für KEY_X muss vorhanden sein");
});

test("On-Screen-Keyboard: Suchhinweis wird nach select-picker-row eingefügt", () => {
  let insertedAfter = null;
  const pickerRow = {
    tagName: "DIV",
    className: "select-picker-row",
    parentElement: { querySelector: () => null },
    insertAdjacentElement(pos, el) { insertedAfter = this; }
  };
  const select = {
    id: "primaryActionSelect",
    closest: sel => (sel === ".select-picker-row" ? pickerRow : null),
    parentElement: pickerRow,
    options: [{ value: "KEY_A", textContent: "A", hidden: false }],
    children: [],
    dataset: {},
    selectedIndex: 0,
    insertAdjacentElement(pos, el) { insertedAfter = this; }
  };
  const input = { value: "filterQuery" };
  const fakeDoc = {
    querySelector: sel => sel.includes("primaryActionSelect") ? input : null,
    getElementById: id => (id === "primaryActionSelect" ? select : null),
    createElement: () => ({ className: "", dataset: {}, style: {} })
  };

  const fn = section("js/editor.js", "function applySelectFilter", "function updateFilterBlockedButton");
  const ctx = {
    document: fakeDoc,
    selectFilterHint: api.selectFilterHint,
    filterOptionNodes: api.filterOptionNodes,
    OPTIONAL_ACTION_PREFIX: api.OPTIONAL_ACTION_PREFIX,
    FILTER_BLOCKS_BUTTON: { primaryActionSelect: "btnApplyKey" },
    updateFilterBlockedButton: () => {}
  };
  vm.createContext(ctx);
  vm.runInContext(fn, ctx);
  ctx.applySelectFilter("primaryActionSelect");
  assert.strictEqual(insertedAfter, pickerRow, "Hint muss nach pickerRow eingefügt werden");
});

test("Text als Makro: Hallo, Wörld! wird in tap-, Shift- und Dead-Key-Schritte umgesetzt", () => {
  const r = api.textToMacroSteps("Hallo, Wörld!");
  const short = r.steps.map(st => `${st.type}:${st.code.replace("KEY_", "").replace("LEFT_", "")}`);
  assert.deepStrictEqual(Array.from(short), [
    "down:SHIFT", "tap:H", "up:SHIFT", "tap:A", "tap:L", "tap:L", "tap:O", "tap:COMMA", "tap:SPACE",
    "down:SHIFT", "tap:W", "up:SHIFT",
    "down:ALT", "tap:U", "up:ALT", "tap:O",
    "tap:R", "tap:L", "tap:D",
    "down:SHIFT", "tap:1", "up:SHIFT"
  ]);
  assert.strictEqual(r.count, 22);
  assert.deepStrictEqual(Array.from(r.unsupported), []);
  assert.strictEqual(r.tooLong, false);
  assert.ok(api.isValidMacro({ name: "t", steps: r.steps }));
});

test("Text als Makro: ß, Großumlaut und gemeinsames Shift-Paar", () => {
  assert.deepStrictEqual(Array.from(api.textToMacroSteps("ß").steps.map(s => `${s.type}:${s.code}`)),
    ["down:KEY_LEFT_ALT", "tap:KEY_S", "up:KEY_LEFT_ALT"]);
  // Shift wird vor der Dead-Key-Folge losgelassen; der große Vokal bekommt eigenes Shift
  assert.deepStrictEqual(Array.from(api.textToMacroSteps("AÄ").steps.map(s => `${s.type}:${s.code}`)), [
    "down:KEY_LEFT_SHIFT", "tap:KEY_A", "up:KEY_LEFT_SHIFT",
    "down:KEY_LEFT_ALT", "tap:KEY_U", "up:KEY_LEFT_ALT",
    "down:KEY_LEFT_SHIFT", "tap:KEY_A", "up:KEY_LEFT_SHIFT"]);
  assert.strictEqual(api.textToMacroSteps("AB").count, 4, "zwei Großbuchstaben teilen ein Shift-Paar");
});

test("Text als Makro: Limit von MAX_MACRO_STEPS und nicht konvertierbare Zeichen", () => {
  assert.strictEqual(api.textToMacroSteps("a".repeat(api.MAX_MACRO_STEPS)).tooLong, false);
  const over = api.textToMacroSteps("a".repeat(api.MAX_MACRO_STEPS + 1));
  assert.strictEqual(over.tooLong, true);
  assert.strictEqual(over.count, api.MAX_MACRO_STEPS + 1);
  const bad = api.textToMacroSteps("5€ 7€ ☃");
  assert.deepStrictEqual(Array.from(bad.unsupported), ["€", "☃"], "jedes Zeichen nur einmal benennen");
  assert.deepStrictEqual(Array.from(api.textToMacroSteps("").steps), []);
});

test("Text als Makro: Status zählt die vorhandenen Schritte mit und nennt Zeichen", () => {
  const ctx2 = { MAX_MACRO_STEPS: api.MAX_MACRO_STEPS };
  vm.createContext(ctx2);
  vm.runInContext(section("js/macros-ui.js", "function macroTextStatus", "function updateMacroTextPreview"), ctx2);
  const mk = (count, unsupported = []) => ({ count, unsupported });
  assert.strictEqual(ctx2.macroTextStatus(mk(10), 22).ok, true);
  assert.strictEqual(ctx2.macroTextStatus(mk(10), 23).ok, false, "bestehende Schritte zählen zum Limit");
  const bad = ctx2.macroTextStatus(mk(1, ["€"]), 0);
  assert.strictEqual(bad.ok, false);
  assert.ok(bad.text.includes("€"));
});

test("Text als Makro: index.html und macros-ui.js nutzen dieselben Element-IDs", () => {
  const html = read("index.html");
  const ui = read("js/macros-ui.js");
  for (const id of ["macroTextInput", "btnMacroFromText", "macroTextInfo"]) {
    assert.ok(html.includes(`id="${id}"`), `index.html ohne ${id}`);
    assert.ok(ui.includes(`"${id}"`), `macros-ui.js ohne ${id}`);
  }
});

test("Spickzettel: buildLayerSheet listet nur Ebenen mit eigenem Inhalt, mit Halten, Doppel-Tipp und Transparenz", () => {
  const cfgs = {};
  for (const side of ["R", "L"]) {
    const cfg = JSON.parse(JSON.stringify(api.SIDE_PROFILES[side].defaultConfig));
    for (let l = 1; l < 8; l++) for (const row of cfg.layers[l]) for (let c = 0; c < row.length; c++) row[c] = { tap: "NONE", hold: "NONE", dtap: "NONE", label: "" };
    cfgs[side] = cfg;
  }
  cfgs.R.layers[0][0][1] = { tap: "KEY_A", hold: "KEY_LEFT_SHIFT", dtap: "KEY_B", label: "" };
  cfgs.R.layers[3][0][2] = { tap: "KEY_F1", hold: "NONE", dtap: "NONE", label: "" };
  cfgs.L.layers[5][1][1] = { tap: "KEY_C", hold: "NONE", dtap: "NONE", label: "" };
  const sheet = api.buildLayerSheet(cfgs, api.SIDE_PROFILES, code => `<${code}>`, ["L", "R"]);
  assert.deepStrictEqual(Array.from(sheet.layers.map(x => x.layer)), [0, 3, 5], "nur Ebenen mit eigenem Inhalt, auch nur einer Hälfte");
  assert.deepStrictEqual(Array.from(sheet.sides), ["L", "R"]);
  const l0 = sheet.layers[0].halves.find(h => h.side === "R");
  const key = l0.rows[0][1];
  assert.strictEqual(key.tap, "<KEY_A>");
  assert.strictEqual(key.hold, "<KEY_LEFT_SHIFT>", "Halten-Beschriftung");
  assert.strictEqual(key.dtap, "<KEY_B>", "Doppel-Tipp-Beschriftung");
  assert.strictEqual(key.transparent, false);
  const l3 = sheet.layers[1].halves.find(h => h.side === "R");
  assert.strictEqual(l3.rows[0][2].tap, "<KEY_F1>");
  assert.strictEqual(l3.rows[0][1].transparent, true, "Taste ohne eigene Aktion ist transparent");
  assert.strictEqual(l3.rows[0][1].hold, "", "transparente Taste trägt kein Halten");
  const l5L = sheet.layers[2].halves.find(h => h.side === "L");
  assert.strictEqual(l5L.rows[1][1].tap, "<KEY_C>");
  assert.doesNotThrow(() => api.buildLayerSheet(null, null));
  assert.strictEqual(api.buildLayerSheet({}, {}).layers.length, 0);
});

test("Spickzettel: Kanten (fehlende Config, Daumen, Platzhalter, Code-Beschriftung, eigenes Label)", () => {
  const cfg = JSON.parse(JSON.stringify(api.SIDE_PROFILES.R.defaultConfig));
  for (let l = 1; l < 8; l++) for (const row of cfg.layers[l]) for (let c = 0; c < row.length; c++) row[c] = { tap: "NONE", hold: "NONE", dtap: "NONE", label: "" };
  cfg.layers[2][0][1] = { tap: "MO_1", hold: "NONE", dtap: "NONE", label: "" };
  cfg.layers[2][0][2] = { tap: "KEY_A", hold: "NONE", dtap: "NONE", label: "Mein" };
  const sheet = api.buildLayerSheet({ R: cfg, L: null }, api.SIDE_PROFILES, code => `<${code}>`, ["L", "R"]);
  assert.strictEqual(Array.from(sheet.sides).join(), "R", "Hälfte ohne Config fehlt");
  const half = sheet.layers.find(x => x.layer === 2).halves[0];
  assert.strictEqual(half.rows[0][1].tap, "<MO_1>", "Code-Beschriftung wie bei Halten");
  assert.strictEqual(half.rows[0][2].tap, "Mein", "eigenes Label gewinnt");
  assert.ok(half.thumbs.length > 0 && half.thumbs.every(k => k.exists), "Daumentasten vorhanden");
  const spacer = half.rows.flat().find(k => !k.exists);
  assert.ok(spacer, "R4C0 fehlt physisch und ist ein Platzhalter");
});

test("Spickzettel: Druck-CSS gilt nur bei geöffnetem Dialog", () => {
  const css = read("style.css");
  const printPart = css.slice(css.lastIndexOf("@media print"));
  assert.ok(printPart.includes("body.layer-sheet-open"));
  assert.ok(printPart.includes("body.layer-sheet-open .app-container > :not(#layerSheetModal)"), "Rest der App im Druck ausblenden");
  const html = read("index.html");
  const container = html.indexOf('<div class="app-container">');
  assert.ok(container >= 0 && html.indexOf('id="layerSheetModal"') > container, "Dialog liegt im .app-container");
  assert.ok(!/body \*\s*\{\s*visibility/.test(printPart), "kein globales Ausblenden ohne offenen Dialog");
  const ui = read("js/layer-sheet-ui.js");
  assert.ok(ui.includes('classList.add("layer-sheet-open")') && ui.includes('classList.remove("layer-sheet-open")'));
});

test("Spickzettel: Knopf, Dialog, Skript-Tag, APP_MODULES und Druck-CSS sind verdrahtet", () => {
  const html = read("index.html");
  assert.ok(html.includes('id="btnLayerSheet"') && html.includes('id="layerSheetModal"') && html.includes('id="layerSheetContent"'));
  assert.ok(html.indexOf("js/layer-sheet-ui.js") > html.indexOf("js/config-model.js") && html.indexOf("js/layer-sheet-ui.js") < html.indexOf('src="app.js'));
  assert.ok(read("server.py").includes('"layer-sheet-ui"'), "APP_MODULES braucht layer-sheet-ui");
  assert.ok(read("app.js").includes("initLayerSheetUI()"));
  const ui = read("js/layer-sheet-ui.js");
  assert.ok(ui.includes("window.print()") && ui.includes("buildLayerSheet("));
  assert.ok(!/["']R["']|["']L["']/.test(ui), "keine Seitenliterale im Modul");
  assert.ok(/@media print[\s\S]*#layerSheetModal/.test(read("style.css")), "@media print für den Spickzettel");
});


// ---- Übungsmodus ----
function practiceConfigs(setup) {
  const cell = (tap = "NONE", hold = "NONE") => ({ label: "", tap, hold, dtap: "NONE" });
  const make = () => ({
    layers: Array.from({ length: 8 }, () => Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => cell()))),
    keyPairs: []
  });
  const configs = { R: make(), L: make() };
  setup(configs, cell);
  return configs;
}
const practiceSides = ["R", "L"];

test("Übungsmodus: Rückwärtssuche findet Buchstaben, Shift-Zeichen, Zeichen auf Ebene und Zeichen ohne Position", () => {
  const configs = practiceConfigs((c, cell) => {
    c.R.layers[0][2][1] = cell("KEY_A");
    c.L.layers[0][1][1] = cell("KEY_LEFT_SHIFT");
    c.R.layers[0][5][3] = cell("MO_1");
    c.L.layers[0][0][0] = cell("KEY_1");
    c.R.layers[1][1][2] = cell("KEY_Z");
    c.R.layers[0][0][5] = cell("KEY_SEMICOLON");
  });
  const find = ch => api.findCharPosition(ch, configs, { R, L }, practiceSides);
  const a = find("a");
  assert.deepStrictEqual([a.side, a.r, a.c, a.layer, a.shift], ["R", 2, 1, 0, false], "Buchstabe");
  const big = find("A");
  assert.deepStrictEqual([big.side, big.r, big.c, big.shift], ["R", 2, 1, true], "Großbuchstabe braucht Shift");
  assert.deepStrictEqual([big.shiftKey.side, big.shiftKey.r, big.shiftKey.c], ["L", 1, 1], "Shift-Taste benannt");
  const bang = find("!");
  assert.deepStrictEqual([bang.side, bang.r, bang.c, bang.shift], ["L", 0, 0, true], "! ist Shift + 1");
  const colon = find(":");
  assert.ok(colon && colon.shift && colon.r === 0 && colon.c === 5, ": ist Shift + ;");
  const z = find("z");
  assert.deepStrictEqual([z.side, z.r, z.c, z.layer], ["R", 1, 2, 1], "Zeichen auf Ebene 1");
  assert.deepStrictEqual([z.layerKey.side, z.layerKey.r, z.layerKey.c], ["R", 5, 3], "Ebenentaste MO_1");
  assert.strictEqual(find("q"), null, "Zeichen ohne Position");
  assert.strictEqual(find("€"), null, "Option-Zeichen ohne Tastenpaar");
});

test("Übungsmodus: Ebene ohne Ebenentaste und Tastenpaar", () => {
  const configs = practiceConfigs((c, cell) => {
    c.R.layers[2][1][1] = cell("KEY_Q");
    c.R.keyPairs = [{ first: "KEY_LEFT_ALT", second: "@" }];
    c.R.layers[0][3][3] = cell("PAIR_0");
  });
  assert.strictEqual(api.findCharPosition("q", configs, { R, L }, practiceSides), null, "Ebene 2 ohne MO_2 ist nicht erreichbar");
  const euro = api.findCharPosition("€", configs, { R, L }, practiceSides);
  assert.deepStrictEqual([euro.side, euro.r, euro.c], ["R", 3, 3], "Tastenpaar liefert €");
});

test("Übungsmodus: Schritte sammeln fehlende Zeichen einmalig", () => {
  const configs = practiceConfigs((c, cell) => { c.R.layers[0][2][1] = cell("KEY_A"); });
  const built = api.buildPracticeSteps("a q\n a q", configs, { R, L }, practiceSides);
  assert.strictEqual(JSON.stringify(built.missing), JSON.stringify([" ", "q"]), "Leertaste und q ohne Position, je einmal");
  assert.strictEqual(built.steps.filter(x => x.char === "a").length, 2);
});

test("Übungsmodus: Tastendrücke zählen Fehler je Taste und das Tempo", () => {
  const configs = practiceConfigs((c, cell) => {
    c.R.layers[0][2][1] = cell("KEY_A");
    c.R.layers[0][2][2] = cell("KEY_B");
  });
  const { steps } = api.buildPracticeSteps("abab", configs, { R, L }, practiceSides);
  assert.strictEqual(steps.length, 4);
  const s = api.createPracticeSession(steps);
  assert.strictEqual(api.practiceKeyPress(s, "R", 2, 1, 0, 1000), "correct");
  assert.strictEqual(api.practiceKeyPress(s, "R", 2, 1, 0, 2000), "error", "falsche Taste für b");
  assert.strictEqual(api.practiceKeyPress(s, "R", 0, 0, 0, 3000), "error");
  assert.strictEqual(JSON.stringify(s.errors), JSON.stringify({ R_2_2: 2 }), "Fehler zählen auf der erwarteten Taste");
  assert.strictEqual(api.practiceKeyPress(s, "R", 2, 2, 0, 4000), "correct");
  assert.strictEqual(api.practiceKeyPress(s, "R", 2, 1, 0, 5000), "correct");
  assert.strictEqual(s.finished, false);
  assert.strictEqual(api.practiceKeyPress(s, "R", 2, 2, 0, 61000), "correct");
  assert.strictEqual(s.finished, true);
  assert.strictEqual(api.practiceKeyPress(s, "R", 2, 2, 0, 62000), "ignored");
  const speed = api.practiceSpeed(s);
  assert.strictEqual(speed.elapsedMs, 60000);
  assert.strictEqual(speed.wpm, 1, "4 Zeichen in 60 s = 0,8 Wörter, gerundet 1");
  assert.strictEqual(speed.accuracy, 67, "4 richtig, 2 Fehler");
});

test("Übungsmodus: falsche Ebene ist ein Fehler, Hilfstasten zählen nicht", () => {
  const configs = practiceConfigs((c, cell) => {
    c.R.layers[0][5][3] = cell("MO_1");
    c.R.layers[1][1][2] = cell("KEY_Z");
    c.R.layers[0][1][2] = cell("KEY_Y");
  });
  const { steps } = api.buildPracticeSteps("z", configs, { R, L }, practiceSides);
  const s = api.createPracticeSession(steps);
  assert.strictEqual(api.practiceKeyPress(s, "R", 5, 3, 0, 100), "helper");
  assert.strictEqual(s.errorTotal, 0);
  assert.strictEqual(api.practiceKeyPress(s, "R", 1, 2, 0, 200), "error", "gleiche Taste auf Ebene 0");
  assert.strictEqual(api.practiceKeyPress(s, "R", 1, 2, 1, 300), "correct");
});

test("Übungsmodus: Wortliste aus den häufigsten Tasten der Heatmap", () => {
  const configs = practiceConfigs((c, cell) => {
    c.R.layers[0][2][1] = cell("KEY_A");
    c.R.layers[0][2][2] = cell("KEY_B");
    c.R.layers[0][2][3] = cell("KEY_C");
  });
  const stats = api.createTypingStats(null, R);
  for (let i = 0; i < 5; i++) api.recordKeyPress(stats, 2, 1, 1000 + i, 0);
  for (let i = 0; i < 3; i++) api.recordKeyPress(stats, 2, 2, 1000 + i, 0);
  api.recordKeyPress(stats, 2, 3, 1000, 0);
  const text = api.practiceTextFromHeatmap([{ config: configs.R, stats }], 2, 4);
  assert.ok(text.length > 0 && /^[ab ]+$/.test(text), `nur die zwei häufigsten Zeichen: ${text}`);
  assert.strictEqual(text, api.practiceTextFromHeatmap([{ config: configs.R, stats }], 2, 4), "deterministisch");
  assert.strictEqual(api.practiceTextFromHeatmap([], 2, 4), "", "ohne Daten leer");
});

test("Übungsmodus: Schwache-Tasten-Übung nutzt die Taste mit dem höchsten Korrekturanteil am häufigsten", () => {
  const configs = practiceConfigs((c, cell) => {
    c.R.layers[0][2][1] = cell("KEY_A");
    c.R.layers[0][2][2] = cell("KEY_S");
    c.R.layers[0][2][3] = cell("KEY_D");
  });
  const stats = api.createTypingStats(null, R);
  stats.counts["2_1"] = 10; stats.corrections["2_1"] = 2;
  stats.counts["2_2"] = 10; stats.corrections["2_2"] = 8;
  stats.counts["2_3"] = 10; stats.corrections["2_3"] = 4;
  stats.counts["9_9"] = 10; stats.corrections["9_9"] = 9;
  const text = api.practiceDrillText([{ config: configs.R, stats }]);
  const freq = {};
  for (const ch of text.replace(/ /g, "")) freq[ch] = (freq[ch] || 0) + 1;
  const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  assert.strictEqual(best, "s", `s hat den höchsten Anteil: ${JSON.stringify(freq)}`);
  assert.ok(freq.s > freq.d && freq.d > freq.a, "Rangfolge nach Korrekturanteil");
  assert.strictEqual(text, api.practiceDrillText([{ config: configs.R, stats }]), "deterministisch");
  assert.ok(text.length <= 500);
});

test("Übungsmodus: Schwache-Tasten-Übung ohne Statistik oder ohne Zeichen liefert den festen Text", () => {
  const configs = practiceConfigs(() => {});
  const empty = api.createTypingStats(null, R);
  assert.strictEqual(api.practiceDrillText([{ config: configs.R, stats: empty }]), api.PRACTICE_FIXED_TEXT);
  assert.strictEqual(api.practiceDrillText([]), api.PRACTICE_FIXED_TEXT);
  const stats = api.createTypingStats(null, R);
  stats.counts["2_2"] = 10; stats.corrections["2_2"] = 8;
  assert.strictEqual(api.practiceDrillText([{ config: configs.R, stats }], "x"), "x", "Taste ohne Zeichen");
});

test("Übungsmodus: Schwache-Tasten-Übung ergänzt Folgen desselben Fingers", () => {
  const configs = practiceConfigs((c, cell) => {
    c.R.layers[0][2][1] = cell("KEY_A");
    c.R.layers[0][2][2] = cell("KEY_S");
    c.R.layers[0][3][2] = cell("KEY_X");
    c.R.layers[0][4][2] = cell("KEY_Z");
  });
  const stats = api.createTypingStats(null, R);
  stats.counts["2_1"] = 10; stats.corrections["2_1"] = 5;
  stats.sameFingerPairs[api.sameFingerPairKey("3_2", "4_2", R)] = 4;
  const words = api.practiceDrillText([{ config: configs.R, stats }]).split(" ");
  assert.ok(words.includes("xz") && words.includes("zx"), words.join(" "));
});

test("Übungsmodus: Schwache-Tasten-Übung bleibt unter dem Limit und behält die Paar-Wörter", () => {
  const configs = practiceConfigs((c, cell) => {
    "ABCDE".split("").forEach((ch, i) => { c.R.layers[0][2][i] = cell(`KEY_${ch}`); });
    c.L.layers[0][1][0] = cell("KEY_F"); c.L.layers[0][1][1] = cell("KEY_G"); c.L.layers[0][1][2] = cell("KEY_H");
    c.L.layers[0][1][3] = cell("KEY_I"); c.L.layers[0][1][4] = cell("KEY_J");
    c.R.layers[0][3][2] = cell("KEY_X"); c.R.layers[0][4][2] = cell("KEY_Z");
  });
  const mk = (side, ids) => {
    const stats = api.createTypingStats(null, side === "R" ? R : L);
    ids.forEach((id, i) => { stats.counts[id] = 10; stats.corrections[id] = 9 - i; });
    return stats;
  };
  const right = mk("R", ["2_0", "2_1", "2_2", "2_3", "2_4"]);
  right.sameFingerPairs[api.sameFingerPairKey("3_2", "4_2", R)] = 4;
  const left = mk("L", ["1_0", "1_1", "1_2", "1_3", "1_4"]);
  const text = api.practiceDrillText([{ config: configs.R, stats: right }, { config: configs.L, stats: left }]);
  assert.ok(text.length <= 500, `Länge ${text.length}`);
  assert.ok(text.endsWith("xz zx"), "Paar-Wörter bleiben am Ende ganz");
  assert.ok(!text.endsWith(" "), "kein Leerzeichen am Ende");
});

test("Übungsmodus: Ziel an der Position der Ebenentaste bleibt das Ziel", () => {
  const configs = practiceConfigs((c, cell) => {
    c.R.layers[0][5][3] = cell("MO_1");
    c.R.layers[1][5][3] = cell("KEY_Z");
  });
  const { steps } = api.buildPracticeSteps("z", configs, { R, L }, practiceSides);
  const s = api.createPracticeSession(steps);
  assert.strictEqual(api.practiceKeyPress(s, "R", 5, 3, 0, 100), "helper", "Ebene 0: Ebenentaste");
  assert.strictEqual(api.practiceKeyPress(s, "R", 5, 3, 1, 200), "correct", "Ebene 1: dieselbe Position ist z");
});

test("Übungsmodus: TG_n gilt nicht als Ebenentaste", () => {
  const configs = practiceConfigs((c, cell) => {
    c.R.layers[0][5][3] = cell("TG_1");
    c.R.layers[1][1][2] = cell("KEY_Z");
  });
  assert.strictEqual(api.findCharPosition("z", configs, { R, L }, practiceSides), null);
});

test("Übungsmodus: KEY_PRESS und SPLIT_KEY melden Hälfte, Position und Ebene", () => {
  const s = serialLineHarness();
  s.handle('KEY_PRESS:{"r":2,"c":3,"layer":1,"key":"a"}', "R", "usb");
  s.handle('SPLIT_KEY:{"r":1,"c":2,"pressed":1,"layer":3}', "R", "usb");
  s.handle('SPLIT_KEY:{"r":1,"c":2,"pressed":0,"layer":3}', "R", "usb");
  assert.strictEqual(JSON.stringify(s.calls.practice), JSON.stringify([["R", 2, 3, 1], ["L", 1, 2, 3]]), "nur Drücken zählt");
});

test("Übungsmodus: Dialog, Skript-Tag, APP_MODULES und Tasten-Anbindung sind verdrahtet", () => {
  const html = read("index.html");
  assert.ok(html.includes('id="btnPractice"') && html.includes('id="practiceModal"'));
  assert.ok(html.indexOf("js/practice-ui.js") > html.indexOf("js/layer-sheet-ui.js") && html.indexOf("js/practice-ui.js") < html.indexOf('src="app.js'));
  assert.ok(read("server.py").includes('"practice-ui"'), "APP_MODULES braucht practice-ui");
  assert.ok(read("app.js").includes("initPracticeUI()"));
  const serial = read("js/serial.js");
  assert.strictEqual((serial.match(/practiceHandleKeyPress\(/g) || []).length, 2, "KEY_PRESS und SPLIT_KEY");
  assert.ok(!/["']R["']|["']L["']/.test(read("js/practice-ui.js")), "keine Seitenliterale im Modul");
});


test("Übungsmodus: Zeichen auf Ebene mit Shift nennt Ebenen- und Shift-Taste", () => {
  const configs = practiceConfigs((c, cell) => {
    c.R.layers[0][5][3] = cell("MO_1");
    c.L.layers[0][1][1] = cell("KEY_LEFT_SHIFT");
    c.L.layers[1][1][1] = cell("KEY_LEFT_SHIFT");
    c.R.layers[1][1][2] = cell("KEY_Z");
  });
  const z = api.findCharPosition("Z", configs, { R, L }, practiceSides);
  assert.deepStrictEqual([z.layer, z.shift, z.layerKey.r, z.layerKey.c], [1, true, 5, 3]);
  assert.deepStrictEqual([z.shiftKey.side, z.shiftKey.r, z.shiftKey.c], ["L", 1, 1], "Shift-Taste der Ebene 1");
});

test("Übungsmodus: Dialog zeigt Ziel, Ende und leeren Zustand; Start verwirft Tasten", () => {
  const { w, dom } = uiHarness(`
    var Dactyl = { SIDE_IDS: ["R", "L"], sidesInDisplayOrder: () => ["R", "L"] };
    function configFor() { return {}; }
    function typingStatsFor() { return null; }
    function sheetKeyElement() { return { classList: { add() {} } }; }
    var practiceBuilt = [];
    function buildPracticeSteps() { return practiceBuilt.pop(); }
    function createPracticeSession(steps) { return { steps, index: 0, finished: false, errors: {}, errorTotal: 0 }; }
    function practiceSpeed() { return { wpm: 0, accuracy: 100, elapsedMs: 0 }; }
    function buildLayerSheet() { return { layers: [{ layer: 0, halves: [{ side: "R", label: "Rechts", rows: [[]], thumbs: [] }] }] }; }
  `);
  const ctx = vm.runInContext("this", w);
  vm.runInContext(read("js/practice-ui.js"), w);
  const modal = dom.document.getElementById("practiceModal");
  modal.style.display = "flex";
  const run = src => vm.runInContext(src, w);
  run("renderPractice()");
  assert.ok(dom.document.getElementById("practiceStatus").textContent.includes("Start"), "leerer Zustand");
  run(`practiceBuilt.push({ steps: [{ char: "a", side: "R", r: 2, c: 1, layer: 0, shift: false, layerKey: null, shiftKey: null }], missing: [] });
       practiceSheet = null; practicePrepare(); renderPractice();`);
  assert.ok(dom.document.getElementById("practiceStatus").textContent.includes("Nächste Taste: a"));
  assert.strictEqual(dom.document.getElementById("practiceMatrix").children.length, 1, "Matrix mit Ziel");
  let prevented = 0;
  run("practiceSwallowKey")({ target: { id: "btnStartPractice" }, preventDefault: () => prevented++ });
  run("practiceSwallowKey")({ target: { id: "practiceText" }, preventDefault: () => prevented++ });
  assert.strictEqual(prevented, 1, "Knopf verwirft die Taste, das Textfeld nicht");
  run(`practiceSession.finished = true; renderPractice();`);
  assert.strictEqual(dom.document.getElementById("practiceStatus").textContent, "Fertig!");
  run(`practiceSession = createPracticeSession([]); renderPractice();`);
  assert.ok(dom.document.getElementById("practiceStatus").textContent.includes("Kein Zeichen"));
  void ctx;
});


test("Übungsmodus: überdeckte Shift-Taste, fehlende Shift-Taste, Mod-Tap-Shift und niedrigste Ebene", () => {
  const shadow = practiceConfigs((c, cell) => {
    c.R.layers[0][5][3] = cell("MO_1");
    c.L.layers[0][1][1] = cell("KEY_LEFT_SHIFT");
    c.L.layers[1][1][1] = cell("KEY_X");
    c.L.layers[0][2][2] = cell("KEY_RIGHT_SHIFT");
    c.R.layers[1][1][2] = cell("KEY_Z");
  });
  const z = api.findCharPosition("Z", shadow, { R, L }, practiceSides);
  assert.deepStrictEqual([z.shiftKey.r, z.shiftKey.c], [2, 2], "überdeckte Shift-Taste wird übersprungen");
  const none = practiceConfigs((c, cell) => { c.R.layers[0][2][1] = cell("KEY_A"); });
  assert.strictEqual(api.findCharPosition("A", none, { R, L }, practiceSides), null, "ohne Shift-Taste keine Position");
  const modTap = practiceConfigs((c, cell) => {
    c.R.layers[0][2][1] = cell("KEY_A");
    c.L.layers[0][3][1] = cell("KEY_D", "KEY_LEFT_SHIFT");
  });
  const big = api.findCharPosition("A", modTap, { R, L }, practiceSides);
  assert.deepStrictEqual([big.shiftKey.side, big.shiftKey.r, big.shiftKey.c], ["L", 3, 1], "Mod-Tap-Halten gilt als Shift");
  const low = practiceConfigs((c, cell) => {
    c.R.layers[0][5][3] = cell("MO_2");
    c.R.layers[0][1][1] = cell("KEY_A");
    c.R.layers[2][2][2] = cell("KEY_A");
  });
  assert.strictEqual(api.findCharPosition("a", low, { R, L }, practiceSides).layer, 0, "niedrigste Ebene gewinnt");
});

test("Übungsmodus: practiceHandleKeyPress zählt nur bei offenem Dialog mit laufender Übung", () => {
  const { w, dom } = uiHarness(`
    var Dactyl = { SIDE_IDS: ["R", "L"], sidesInDisplayOrder: () => ["R", "L"] };
    var counted = 0;
  `);
  vm.runInContext(read("js/practice-ui.js"), w);
  const run = src => vm.runInContext(src, w);
  run(`practiceKeyPress = () => { counted++; return "correct"; }; renderPractice = () => {};`);
  const modal = dom.document.getElementById("practiceModal");
  run(`practiceSession = { steps: [] }`);
  modal.style.display = "none";
  run(`practiceHandleKeyPress("R", 0, 0, 0)`);
  assert.strictEqual(run("counted"), 0, "Dialog zu: kein Zählen");
  modal.style.display = "flex";
  run(`practiceHandleKeyPress("R", 0, 0, 0)`);
  assert.strictEqual(run("counted"), 1, "Dialog offen: Zählen");
  run(`practiceSession = null; practiceHandleKeyPress("R", 0, 0, 0)`);
  assert.strictEqual(run("counted"), 1, "ohne Übung: kein Zählen");
  let prevented = 0;
  run("practiceSession = { steps: [] }");
  run("practiceSwallowKey")({ target: { id: "btnClosePractice" }, preventDefault: () => prevented++ });
  assert.strictEqual(prevented, 0, "Schließen-Knopf bleibt per Tastatur bedienbar");
});


test("Übungsmodus: transparente Shift-Taste gilt, zweite Shift-Taste und unbekannte Ebene sind keine Fehler", () => {
  const configs = practiceConfigs((c, cell) => {
    c.R.layers[0][5][3] = cell("MO_1");
    c.L.layers[0][1][1] = cell("KEY_LEFT_SHIFT");
    c.R.layers[0][4][4] = cell("KEY_RIGHT_SHIFT");
    c.R.layers[1][1][2] = cell("KEY_Z");
  });
  const z = api.findCharPosition("Z", configs, { R, L }, practiceSides);
  assert.deepStrictEqual([z.shiftKey.side, z.shiftKey.r, z.shiftKey.c], ["R", 4, 4], "transparente Zelle auf Ebene 1 lässt Shift gelten");
  const s = api.createPracticeSession([z]);
  assert.strictEqual(api.practiceKeyPress(s, "L", 1, 1, 0, 100), "helper", "zweite Shift-Taste ist eine Hilfstaste");
  assert.strictEqual(s.errorTotal, 0);
  assert.strictEqual(api.practiceKeyPress(s, "R", 1, 2, undefined, 200), "correct", "unbekannte Ebene wird akzeptiert");
  assert.strictEqual(api.practiceSpeed(s).wpm, 0, "ein Zeichen ohne Dauer");
});


test("findActionUsages: findet Tap, Halten, Combo, Tastenpaar, Überschreibung und Makro-Schritt", () => {
  const cell = (tap, hold = "NONE", dtap = "NONE") => ({ label: "", tap, hold, dtap });
  const layers = Array.from({ length: 8 }, () => Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => cell("NONE"))));
  layers[0][1][2] = cell("KEY_ESC");
  layers[3][4][1] = cell("KEY_A", "KEY_ESC");
  const config = {
    layers,
    combos: [{ id: 7, name: "Raus", key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 }, action: "KEY_ESC" }],
    keyPairs: [{ first: "KEY_LEFT_ALT", second: "KEY_ESC" }],
    keyOverrides: [{ mods: ["shift"], key: "KEY_BACKSPACE", replacement: "KEY_ESC" }],
    macros: [{ steps: [{ type: "pause", ms: 5 }, { type: "tap", code: "KEY_ESC" }] }]
  };
  const hits = api.findActionUsages(config, "KEY_ESC", "R");
  assert.strictEqual(hits.length, 6);
  assert.strictEqual(JSON.stringify(hits.filter(h => h.kind === "key").map(h => [h.layer, h.r, h.c, h.slot])), JSON.stringify([[0, 1, 2, "tap"], [3, 4, 1, "hold"]]));
  assert.ok(hits.some(h => h.kind === "combo" && h.id === 7));
  assert.ok(hits.some(h => h.kind === "pair" && h.index === 0 && h.member === "second"));
  assert.ok(hits.some(h => h.kind === "override" && h.role === "replacement"));
  assert.ok(hits.some(h => h.kind === "macro" && h.macro === 0 && h.step === 1));
  assert.ok(hits.every(h => h.side === "R"));
});

test("findActionUsages: transparente Tasten und leere Codes geben keinen Treffer", () => {
  const layers = Array.from({ length: 8 }, () => Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => ({ label: "", tap: "NONE", hold: "NONE", dtap: "NONE" }))));
  const config = { layers, combos: [{ key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 }, action: "NONE" }], keyPairs: [], keyOverrides: [], macros: [] };
  for (const code of ["NONE", "", "0", undefined, null]) assert.strictEqual(api.findActionUsages(config, code).length, 0);
  assert.strictEqual(api.findActionUsages(null, "KEY_A").length, 0);
});

test("findActionUsagesForSides: wertet beide Hälften aus", () => {
  const mk = tap => ({ layers: [[[{ tap, hold: "NONE", dtap: "NONE" }]]] });
  const hits = api.findActionUsagesForSides({ R: mk("MO_3"), L: mk("MO_3") }, "MO_3", ["R", "L"]);
  assert.strictEqual(hits.map(h => h.side).join(), "R,L");
});

test("findActionUsages: eine Pause mit Code zählt nicht, Daumentasten der linken Hälfte treffen", () => {
  const layers = Array.from({ length: 8 }, () => Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => ({ label: "", tap: "NONE", hold: "NONE", dtap: "NONE" }))));
  layers[2][5][4] = { label: "", tap: "KEY_SPACE", hold: "NONE", dtap: "NONE" };
  const hits = api.findActionUsages({ layers, macros: [{ steps: [{ type: "pause", ms: 5, code: "KEY_SPACE" }] }] }, "KEY_SPACE", "L");
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(`${hits[0].layer},${hits[0].r},${hits[0].c},${hits[0].side}`, "2,5,4,L");
});

test("Aktion suchen: Feld ist verdrahtet, Klick auf einen Treffer wählt Hälfte, Ebene und Taste", () => {
  const html = read("index.html");
  assert.ok(html.includes('id="actionSearchSelect"') && html.includes('data-filter-for="actionSearchSelect"') && html.includes('id="actionSearchList"'));
  assert.ok(read("js/editor-events.js").includes("setupActionSearch()"));
  const h = uiHarness(`${section("js/editor.js", "// Text eines Treffers von findActionUsages", "function setupActionSearch")}
var calls = [];
var sideStore = Dactyl.createSideStore(Dactyl.SIDE_IDS);
function switchEditSide(side) { editSide = side; calls.push("side:" + side); }
function selectKey(r, c, side, isThumb) { selectedKey = { r, c, side, isThumb }; }`);
  const { w } = h;
  vm.runInContext(`gotoActionUsage({ kind: "key", side: "L", layer: 3, r: 5, c: 4, slot: "tap" });`, w);
  assert.strictEqual(vm.runInContext(`calls.join() + "|" + activeLayerIndex + "|" + JSON.stringify(selectedKey)`, w),
    'side:L|3|{"r":5,"c":4,"side":"L","isThumb":true}');
  vm.runInContext(`calls = []; gotoActionUsage({ kind: "combo", side: "R", index: 0 });`, w);
  assert.strictEqual(vm.runInContext(`calls.join() + "|" + activeLayerIndex`, w), "side:R|3");
  vm.runInContext(`calls = []; gotoActionUsage({ kind: "key", side: "X", layer: 6, r: 0, c: 0, slot: "tap" });`, w);
  assert.strictEqual(vm.runInContext(`calls.length + "|" + activeLayerIndex`, w), "0|3", "unbekannte Hälfte ändert nichts");
});

test("Aktion suchen: Trefferliste wird bei jeder Matrix- und Combo-Aktualisierung neu gebaut", () => {
  const editor = read("js/editor.js");
  const body = name => { const i = editor.indexOf(`function ${name}(`); return editor.slice(i, editor.indexOf("\nfunction ", i + 1)); };
  assert.ok(body("renderMatrix").includes("renderActionSearch();"), "renderMatrix ruft renderActionSearch");
  assert.ok(body("renderCombosTable").includes("renderActionSearch();"), "renderCombosTable ruft renderActionSearch");
  assert.ok(/function gotoActionUsage[\s\S]*?sideStore\.has\(hit\.side\)[\s\S]*?switchEditSide/.test(editor), "unbekannte Hälfte ändert nichts");
});

test("findActionUsagesForSides: CHAR_PAIR und alte MOD_*-Halte-Codes finden ihre gespeicherten Aktionen", () => {
  const idx = Array.from({ length: 40 }, (_, i) => i).find(i => api.charPairIndexFromCode(`CHAR_PAIR_${i}`) >= 0);
  assert.ok(idx !== undefined, "DE_MAC_CHARS hat ein Zeichen mit Tastenpaar");
  const entry = vm.runInContext(`DE_MAC_CHARS[${idx}].pair`, ctx);
  const cfg = { layers: [[[{ tap: "PAIR_0", hold: "MOD_LSHIFT", dtap: "NONE" }]]], keyPairs: [{ first: entry.first, second: entry.second }] };
  const viaChar = api.findActionUsagesForSides({ R: cfg }, `CHAR_PAIR_${idx}`, ["R"]);
  assert.strictEqual(viaChar.length, 1);
  assert.strictEqual(viaChar[0].slot, "tap");
  assert.strictEqual(api.findActionUsagesForSides({ R: { ...cfg, keyPairs: [] } }, `CHAR_PAIR_${idx}`, ["R"]).length, 0);
  const viaHold = api.findActionUsagesForSides({ R: cfg }, "KEY_LEFT_SHIFT", ["R"]);
  assert.strictEqual(viaHold.length, 1);
  assert.strictEqual(viaHold[0].slot, "hold");
  const dtapCfg = { layers: [[[{ tap: "NONE", hold: "NONE", dtap: "MOD_LGUI" }]]] };
  assert.strictEqual(api.findActionUsages(dtapCfg, "KEY_LEFT_GUI")[0].slot, "dtap");
  const twice = { ...cfg, keyPairs: [{ first: entry.first, second: entry.second }, { first: entry.first, second: entry.second }],
    layers: [[[{ tap: "PAIR_0", hold: "PAIR_1", dtap: "NONE" }]]] };
  assert.strictEqual(api.findActionUsagesForSides({ R: twice }, `CHAR_PAIR_${idx}`, ["R"]).length, 2);
});

test("renderActionSearch: baut die Liste, lässt sie bei gleichem Ergebnis stehen und überlebt fehlende Elemente", () => {
  const h = uiHarness(`${section("js/editor.js", "// Text eines Treffers von findActionUsages", "// Wählt Hälfte, Ebene und Taste eines Treffers")}
function configFor(side) { return side === "R" ? currentConfig : null; }`);
  const { w, dom } = h;
  const select = dom.document.getElementById("actionSearchSelect");
  const list = dom.document.getElementById("actionSearchList");
  select.value = "NONE";
  vm.runInContext("renderActionSearch()", w);
  assert.strictEqual(list.children.length, 0);
  select.value = "KEY_NONEXISTENT";
  vm.runInContext("renderActionSearch()", w);
  assert.strictEqual(list.children.length, 1);
  assert.ok(/Keine Fundstelle/.test(list.children[0].textContent));
  const first = list.children[0];
  vm.runInContext("renderActionSearch()", w);
  assert.strictEqual(list.children[0], first, "gleiches Ergebnis baut die Liste nicht neu");
  select.value = vm.runInContext("currentConfig.layers[0].flat().map(r => r.tap).concat(currentConfig.layers[0].flatMap(r => r.map(k => k.tap))).find(t => t && t !== 'NONE')", w);
  vm.runInContext("renderActionSearch()", w);
  assert.ok(list.children.length >= 1 && list.children.every(li => li.children[0].tagName === "BUTTON"));
  // Fehlende Elemente werfen nicht
  const bare = uiHarness(`${section("js/editor.js", "// Text eines Treffers von findActionUsages", "// Wählt Hälfte, Ebene und Taste eines Treffers")}
function configFor() { return null; }
document.getElementById = () => null;`);
  vm.runInContext("renderActionSearch()", bare.w);
});


test("Leader: Sequenz-Prüfung, Normalisierung und Anzeige", () => {
  const ok = { keys: ["KEY_A", "KEY_B"], action: "MACRO_0" };
  assert.ok(api.isValidLeaderSequence(ok));
  assert.ok(api.isValidLeaderSequence({ keys: ["KEY_A"], action: "PAIR_3" }));
  assert.ok(api.isValidLeaderSequence({ keys: ["KEY_A", "KEY_B", "KEY_C", "KEY_D"], action: "KEY_Z" }));
  const bad = [
    { ...ok, keys: [] }, { ...ok, keys: ["KEY_A", "KEY_B", "KEY_C", "KEY_D", "KEY_E"] }, { ...ok, keys: "KEY_A" },
    { ...ok, keys: ["KEY_LEFT_SHIFT"] }, { ...ok, keys: ["PAIR_0"] }, { ...ok, keys: ["MO_1"] }, { ...ok, keys: ["NONE"] },
    { ...ok, action: "KEY_LEFT_CTRL" }, { ...ok, action: "MO_1" }, { ...ok, action: "NONE" }, { ...ok, action: "LEADER" },
    { ...ok, action: undefined }, { keys: ["KEY_A"] }, null, "x"
  ];
  for (const b of bad) assert.ok(!api.isValidLeaderSequence(b), JSON.stringify(b));
  assert.ok(api.hasDuplicateLeaderSequence([ok, { keys: ["KEY_A", "KEY_B"], action: "KEY_Z" }]));
  assert.ok(!api.hasDuplicateLeaderSequence([ok, { keys: ["KEY_A"], action: "KEY_Z" }, { keys: ["KEY_B", "KEY_A"], action: "KEY_Z" }]));
  assert.strictEqual(api.MAX_LEADER_SEQS, 16);
  assert.strictEqual(api.LEADER_MAX_KEYS, 4);
  assert.strictEqual(api.leaderSequenceLabel(ok, c => c), "KEY_A, KEY_B → MACRO_0");
  assert.ok(api.isLeaderCode("LEADER") && api.isLeaderCode("ACT_LEADER") && !api.isLeaderCode("DM_REC"));
  assert.strictEqual(api.actionCodeToNumeric("LEADER"), 0x16E);
  assert.ok(api.KEYCODES.some(g => g.keys.some(k => k.code === "LEADER")));
});

test("Leader: Tupel für die Firmware und Anzeige", () => {
  const cfg = { leaderSequences: [{ keys: ["KEY_A", "KEY_B"], action: "MACRO_1" }, { keys: ["KEY_C"], action: "PAIR_2" }] };
  const tuples = JSON.parse(JSON.stringify(api.localLeaderTuples(cfg)));
  assert.deepStrictEqual(tuples, [[0x171, 97, 98, 0, 0], [0x142, 99, 0, 0, 0]]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.leaderKeyNumbers(["KEY_A"]))), [97, 0, 0, 0]);
  assert.ok(api.describeLeaderTuple(tuples[0]).includes("→"));
});

test("Leader: normalizeConfig und Validierung gelten für beide Hälften", () => {
  const copy = o => JSON.parse(JSON.stringify(o));
  const seqs = [{ keys: ["KEY_A", "KEY_B"], action: "KEY_Z" }];
  for (const profile of [R, L]) {
    const norm = api.normalizeConfig({ ...copy(profile.defaultConfig), leaderSequences: seqs }, profile);
    assert.strictEqual(norm.leaderSequences.length, 1);
    api.validateConfigShape({ ...copy(profile.defaultConfig), leaderSequences: seqs }, profile);
    assert.throws(() => api.validateConfigShape({ ...copy(profile.defaultConfig), leaderSequences: [{ keys: [], action: "KEY_Z" }] }, profile), /Leader-Sequenz 0/);
    assert.throws(() => api.validateConfigShape({ ...copy(profile.defaultConfig), leaderSequences: "x" }, profile), /leaderSequences/);
    assert.throws(() => api.validateConfigShape({ ...copy(profile.defaultConfig), leaderSequences: [seqs[0], { keys: ["KEY_A", "KEY_B"], action: "KEY_Y" }] }, profile), /dieselben Tasten/);
    assert.throws(() => api.validateConfigShape({ ...copy(profile.defaultConfig), leaderSequences: Array.from({ length: 17 }, (_, i) => ({ keys: [`KEY_${i + 4}`], action: "KEY_Z" })) }, profile), /leaderSequences/);
  }
  // Ungültige und doppelte Einträge fallen beim Normalisieren weg, die Obergrenze gilt, fehlendes Feld ergibt eine leere Liste
  const mixed = [seqs[0], { keys: [], action: "KEY_Z" }, { keys: ["KEY_A", "KEY_B"], action: "KEY_Y" }, { keys: ["KEY_C"], action: "NONE" }];
  assert.strictEqual(api.normalizeConfig({ ...copy(R.defaultConfig), leaderSequences: mixed }, R).leaderSequences.length, 1);
  const many = Array.from({ length: 20 }, (_, i) => ({ keys: [`KEY_${i + 4}`], action: "KEY_Z" }));
  assert.strictEqual(api.normalizeConfig({ ...copy(R.defaultConfig), leaderSequences: many }, R).leaderSequences.length, 16);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.normalizeConfig(copy(R.defaultConfig), R).leaderSequences)), []);
});

test("Leader: Combos lehnen die Leader-Taste ab, die Wartezeit wird begrenzt", () => {
  const cfg = JSON.parse(JSON.stringify(R.defaultConfig));
  cfg.combos = [{ id: "c1", name: "x", key1: { r: 2, c: 1 }, key2: { r: 2, c: 2 }, behavior: "KEY_PRESS", action: "LEADER" }];
  assert.throws(() => api.validateConfigShape(cfg, R), /kein Leader/);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.SETTINGS_RANGES.leaderTimeoutMs)), [100, 5000, 1000]);
  assert.strictEqual(api.clampSetting("leaderTimeoutMs", 10), 100);
  assert.strictEqual(api.clampSetting("leaderTimeoutMs", 9999), 5000);
  assert.strictEqual(api.clampSetting("leaderTimeoutMs", "x"), 1000);
  assert.strictEqual(api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R).settings.leaderTimeoutMs, 1000);
  assert.strictEqual(api.settingsFromDeviceInfo({ leader_timeout_ms: 750 }, {}).leaderTimeoutMs, 750);
  assert.strictEqual(api.settingsFromDeviceInfo({ ld: 800 }, {}).leaderTimeoutMs, 800);
});

test("Einstellung layerTimeoutMs: Bereich, Normalisierung und DEVICE_INFO-Feld lt", () => {
  assert.strictEqual(api.clampSetting("layerTimeoutMs", 0), 0);
  assert.strictEqual(api.clampSetting("layerTimeoutMs", 5), 1000);
  assert.strictEqual(api.clampSetting("layerTimeoutMs", 999999), 60000);
  assert.strictEqual(api.clampSetting("layerTimeoutMs", "x"), 0);
  assert.strictEqual(api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R).settings.layerTimeoutMs, 0);
  assert.strictEqual(api.settingsFromDeviceInfo({ lt: 4000 }, {}).layerTimeoutMs, 4000);
});

test("Leader: Gerätedaten (GET_CONFIG) ergeben dieselbe Config, kaputte Zeilen machen den Snapshot unvollständig", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.keyPairs = [{ first: "KEY_LEFT_SHIFT", second: "KEY_PERIOD" }];
  cfg.macros = [{ name: "M", steps: [{ type: "tap", code: "KEY_A" }] }];
  cfg.leaderSequences = [
    { keys: ["KEY_A", "KEY_B"], action: "MACRO_0" }, { keys: ["KEY_C"], action: "PAIR_0" },
    { keys: ["KEY_D", "KEY_E", "KEY_F", "KEY_G"], action: "KEY_Z" }, { keys: ["KEY_H"], action: "KEY_Y" }, { keys: ["KEY_I"], action: "KEY_X" }
  ];
  const snap = snapshotWithLists(cfg);
  assert.strictEqual(api.snapshotListsState(snap), "complete");
  assert.strictEqual(snap.counts.leader, 5);
  snap.info = { name: "Dactyl", side: "R" };
  const built = api.buildConfigFromSnapshot(snap, cfg, R);
  assert.ok(built.config, built.error);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(built.config.leaderSequences)), JSON.parse(JSON.stringify(cfg.leaderSequences)));
  // Ohne LEADER_COUNT (alte Firmware) bleiben die lokalen Sequenzen
  const old = snapshotOf(cfg);
  for (const line of listLines(cfg).filter(l => !l.startsWith("LEADER_"))) api.captureListLine(old, line);
  old.info = snap.info;
  assert.strictEqual(api.snapshotListsState(old), "complete");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.buildConfigFromSnapshot(old, cfg, R).config.leaderSequences)), JSON.parse(JSON.stringify(cfg.leaderSequences)));
  // Kaputte Zeilen
  const broken = [
    "LEADER_COUNT:17", "LEADER_COUNT:x",
    "LEADER_COUNT:1\nLEADER_DATA:{\"o\":0,\"e\":[[97,97,0,0]]}",
  ];
  for (const text of broken) {
    const s2 = api.createDeviceSnapshot();
    for (const line of text.split("\n")) api.captureListLine(s2, line);
    assert.ok(s2.listsBroken || api.snapshotListsState(s2) === "incomplete", text);
  }
  const badData = [
    [[97, 0, 98, 0, 0]],        // Lücke in den Tasten
    [[97, 131, 0, 0, 0]],       // Modifier als Taste
    [[131, 97, 0, 0, 0]],       // Modifier als Aktion
    [[0, 97, 0, 0, 0]],         // keine Aktion
    [[97, 0, 0, 0, 0]],         // keine erste Taste
    [[0x144 + 12, 97, 0, 0, 0]] // Paar-Index außerhalb
  ];
  for (const e of badData) {
    const s3 = api.createDeviceSnapshot();
    api.captureListLine(s3, "LEADER_COUNT:1");
    api.captureListLine(s3, "LEADER_DATA:" + JSON.stringify({ o: 0, e }));
    assert.ok(s3.listsBroken, JSON.stringify(e));
  }
  // Zähler ohne alle Einträge: unvollständig
  const partial = api.createDeviceSnapshot();
  for (const line of listLines({ ...cfg, leaderSequences: [] })) api.captureListLine(partial, line);
  api.captureListLine(partial, "LEADER_COUNT:2");
  assert.strictEqual(api.snapshotListsState(partial), "incomplete");
});

test("Layout-Diff: Leader-Sequenzen werden verglichen, ohne Zähler nicht", () => {
  const cfg = api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R);
  cfg.leaderSequences = [{ keys: ["KEY_A", "KEY_B"], action: "KEY_Z" }];
  const snap = snapshotWithLists(cfg);
  assert.strictEqual(api.diffKeymap(cfg, snap, R).lists.leader.length, 0);
  cfg.leaderSequences[0].action = "KEY_Y";
  cfg.leaderSequences.push({ keys: ["KEY_C"], action: "KEY_X" });
  const d = api.diffKeymap(cfg, snap, R).lists;
  assert.deepStrictEqual(JSON.parse(JSON.stringify(d.leader.map(r => r.where))), ["Leader 0", "Leader 1"]);
  assert.strictEqual(d.leader[1].device, "—");
  // Gerät ohne Leader-Zähler: nichts zu vergleichen, die Zeilen fehlen
  const old = snapshotOf(cfg);
  for (const line of listLines(cfg).filter(l => !l.startsWith("LEADER_"))) api.captureListLine(old, line);
  assert.strictEqual(api.diffKeymap(cfg, old, R).lists.leader.length, 0);
});

test("Leader: Tastenpaar oder Makro löschen entfernt Sequenzen und rückt Verweise auf, Revert stellt sie her", () => {
  const seqs = [
    { keys: ["KEY_A"], action: "MACRO_0" }, { keys: ["KEY_B"], action: "MACRO_1" }, { keys: ["KEY_C"], action: "MACRO_2" },
    { keys: ["KEY_D"], action: "PAIR_1" }, { keys: ["KEY_E"], action: "PAIR_2" }, { keys: ["KEY_F"], action: "KEY_Z" }
  ];
  const macros = [{ name: "a", steps: [] }, { name: "b", steps: [] }, { name: "c", steps: [] }];
  const config = { macros, keyPairs: [p("KEY_A", "KEY_B"), p("KEY_C", "KEY_D"), p("KEY_E", "KEY_F")], layers: [[["KEY_A"]]], combos: [], leaderSequences: seqs };
  const before = JSON.stringify(config);
  assert.ok(api.isMacroUsed([], 1, seqs) && !api.isMacroUsed([], 1, []));
  const next = api.removeMacroAt(config, 1);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(next.leaderSequences.map(q => q.action))), ["MACRO_0", "MACRO_1", "PAIR_1", "PAIR_2", "KEY_Z"]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(next.leaderRemoved.map(r => r.index))), [1]);
  assert.strictEqual(JSON.stringify(config), before);
  const back = api.restoreMacroAt({ ...config, macros: next.macros, layers: next.layers, leaderSequences: next.leaderSequences }, 1, macros[1], next.cleared, next.leaderRemoved);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(back.leaderSequences)), JSON.parse(JSON.stringify(seqs)));
  // Tastenpaar
  const plan = api.planKeyPairDeletion(config, 1);
  assert.strictEqual(plan.used, true);   // nur die Sequenz nutzt PAIR_1
  assert.deepStrictEqual(JSON.parse(JSON.stringify(plan.next.leaderSequences.map(q => q.action))), ["MACRO_0", "MACRO_1", "MACRO_2", "PAIR_1", "KEY_Z"]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(plan.old.leaderSequences)), JSON.parse(JSON.stringify(seqs)));
  // Ein Paar, das nur eine Sequenz nutzt, bleibt beim Revert einer Tastenänderung stehen
  assert.strictEqual(api.revertResolvedPairs([p("KEY_A", "KEY_B")], [[["KEY_A"]]], 0, 1, [{ keys: ["KEY_A"], action: "PAIR_0" }]), 0);
  assert.strictEqual(api.revertResolvedPairs([p("KEY_A", "KEY_B")], [[["KEY_A"]]], 0, 1, []), 1);
});

test("Leader: findActionUsages meldet Sequenz-Tasten und Aktionen, die Layout-Prüfung zählt sie als Nutzung", () => {
  const cfg = lintCfg();
  cfg.keyPairs = [{ first: "KEY_A", second: "KEY_B" }];
  cfg.macros = [{ name: "M", steps: [] }];
  cfg.leaderSequences = [{ keys: ["KEY_Q", "KEY_W"], action: "PAIR_0" }, { keys: ["KEY_E"], action: "MACRO_0" }];
  const findings = lintBoth(cfg);
  assert.strictEqual(lintCodes(findings, "pair-unused").length, 0);
  assert.strictEqual(lintCodes(findings, "macro-unused").length, 0);
  cfg.leaderSequences = [];
  assert.strictEqual(lintCodes(lintBoth(cfg), "pair-unused").length, 1);
  assert.strictEqual(lintCodes(lintBoth(cfg), "macro-unused").length, 1);
  const hits = JSON.parse(JSON.stringify(api.findActionUsages({ layers: [], leaderSequences: [{ keys: ["KEY_Q", "KEY_W"], action: "KEY_Q" }] }, "KEY_Q", "R")));
  assert.deepStrictEqual(hits, [{ kind: "leader", side: "R", index: 0, role: "key" }, { kind: "leader", side: "R", index: 0, role: "action" }]);
});

test("Sync: Leader-Phase sendet CLEAR_LEADER, ADD_LEADER und SAVE_LEADER und zählt ihre Schritte", () => {
  const src = read("js/config-sync.js");
  assert.ok(src.includes('"CLEAR_LEADER", "CLEAR_LEADER", 3000, true'));
  assert.ok(src.includes("`ADD_LEADER ${actionCodeToNumeric(q.action)} ${keys}`"));
  assert.ok(src.includes('"SAVE_LEADER", "SAVE_LEADER", 5000'));
  // Zahl der updateProgress()-Aufrufe der Leader-Phase: je Sequenz einer (gesendet oder übersprungen) plus einer für die Phase
  const phase = src.slice(src.indexOf("CLEAR_LEADER"), src.indexOf("Eigene Alt-Repeat-Paare synchronisieren"));
  assert.strictEqual((phase.match(/updateProgress\(\)/g) || []).length, 3);
  // Alt-Repeat-Phase: gleiche Zählung (je Paar einer, gesendet oder übersprungen, plus einer für die Phase)
  assert.ok(src.includes('"CLEAR_ALT_REPEATS", "CLEAR_ALT_REPEATS", 3000, true'));
  assert.ok(src.includes("`ADD_ALT_REPEAT ${actionCodeToNumeric(e.key)} ${actionCodeToNumeric(e.alt)}`"));
  assert.ok(src.includes('"SAVE_ALT_REPEATS", "SAVE_ALT_REPEATS", 5000'));
  const altPhase = src.slice(src.indexOf("CLEAR_ALT_REPEATS"), src.indexOf("Nur die tatsächlich übertragenen"));
  assert.strictEqual((altPhase.match(/updateProgress\(\)/g) || []).length, 3);
});

test("Beide Hälften: Export und Import eines Bündels ergibt dieselben Configs", () => {
  const profiles = { R, L };
  const configs = { R: api.normalizeConfig(JSON.parse(JSON.stringify(R.defaultConfig)), R), L: api.normalizeConfig(JSON.parse(JSON.stringify(L.defaultConfig)), L) };
  configs.R.layers[0][0][1] = { tap: "KEY_F5", hold: "NONE", dtap: "NONE", label: "F5" };
  const bundle = api.buildDualSideBundle(configs, profiles);
  assert.strictEqual(bundle.bundleVersion, 1);
  assert.deepStrictEqual(Object.keys(bundle.sides).sort(), ["L", "R"]);
  bundle.sides.R.layers[0][0][1].tap = "KEY_F6";
  assert.strictEqual(configs.R.layers[0][0][1].tap, "KEY_F5", "Export kopiert die Config");
  bundle.sides.R.layers[0][0][1].tap = "KEY_F5";
  const parsed = api.parseConfigImport(JSON.parse(JSON.stringify(bundle)), profiles, "R");
  assert.strictEqual(parsed.kind, "bundle");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(parsed.configs)), JSON.parse(JSON.stringify(configs)));
  assert.throws(() => api.buildDualSideBundle({ R: configs.R }, profiles), /fehlt/);
});

test("Beide Hälften: Einzel-Config wird für die bearbeitete Hälfte gelesen", () => {
  const profiles = { R, L };
  const single = JSON.parse(JSON.stringify(L.defaultConfig));
  const parsed = api.parseConfigImport(single, profiles, "L");
  assert.strictEqual(parsed.kind, "single");
  assert.deepStrictEqual(Object.keys(parsed.configs), ["L"]);
});

test("Beide Hälften: ungültige Hälfte bricht den ganzen Import ab, ohne Eingabe zu ändern", () => {
  const profiles = { R, L };
  const good = JSON.parse(JSON.stringify(R.defaultConfig));
  const bad = JSON.parse(JSON.stringify(L.defaultConfig));
  bad.layers = "kaputt";
  const raw = { bundleVersion: 1, sides: { R: good, L: bad } };
  const before = JSON.stringify(raw);
  assert.throws(() => api.parseConfigImport(raw, profiles, "R"), /Hälfte L/);
  assert.strictEqual(JSON.stringify(raw), before);
  assert.throws(() => api.parseConfigImport({ bundleVersion: 1, sides: { R: good } }, profiles, "R"), /L fehlt/);
  assert.throws(() => api.parseConfigImport({ bundleVersion: 2, sides: {} }, profiles, "R"), /Version/);
  assert.throws(() => api.parseConfigImport({ bundleVersion: 1, sides: { R: good, L: good, X: good } }, profiles, "R"), /Unbekannte/);
});

// ---- Tastenaufnahme (Combo- und Leader-Editor) ----
function captureFor(side, opts) {
  return api.keyCaptureStart(api.createKeyCapture(), { side, max: 3, ...opts });
}
const press = (side, r, c) => ({ side, r, c, pressed: true });
const release = (side, r, c) => ({ side, r, c, pressed: false });

test("Tastenaufnahme: Druck füllt die Plätze der Reihe nach", () => {
  const cap = captureFor("R");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.keyCaptureFeed(cap, press("R", 2, 1)))), { accepted: true, index: 0, value: "2,1" });
  assert.strictEqual(api.keyCaptureFeed(cap, press("R", 2, 2)).index, 1);
  assert.deepStrictEqual([...cap.slots.map(s => s.value)], ["2,1", "2,2"]);
});

test("Tastenaufnahme: inaktiv und andere Hälfte ändern nichts", () => {
  const idle = api.createKeyCapture();
  assert.strictEqual(api.keyCaptureFeed(idle, press("R", 2, 1)).reason, "inactive");
  const cap = captureFor("R");
  assert.strictEqual(api.keyCaptureFeed(cap, press("L", 2, 1)).reason, "wrong-side");
  assert.strictEqual(cap.slots.length, 0);
  // der Druck der anderen Hälfte merkt sich keine gehaltene Taste: derselbe Platz gilt danach auf der eigenen Hälfte
  assert.strictEqual(api.keyCaptureFeed(cap, press("R", 2, 1)).accepted, true);
});

test("Tastenaufnahme: MATRIX, KEY_PRESS und SPLIT_KEY derselben Taste zählen einmal", () => {
  const cap = captureFor("R");
  assert.strictEqual(api.keyCaptureFeed(cap, press("R", 2, 1)).accepted, true);
  assert.strictEqual(api.keyCaptureFeed(cap, press("R", 2, 1)).reason, "held");
  // Ein verlorenes Loslassen sperrt die Taste nicht dauerhaft
  const lost = captureFor("R", { allowRepeat: true });
  api.keyCaptureFeed(lost, { ...press("R", 2, 1), at: 0 });
  assert.strictEqual(api.keyCaptureFeed(lost, { ...press("R", 2, 1), at: 500 }).reason, "held");
  assert.strictEqual(api.keyCaptureFeed(lost, { ...press("R", 2, 1), at: 1000 }).accepted, true);
  assert.strictEqual(cap.slots.length, 1);
});

test("Tastenaufnahme: doppelte Koordinate wird nach dem Loslassen abgelehnt", () => {
  const cap = captureFor("R");
  api.keyCaptureFeed(cap, press("R", 2, 1));
  api.keyCaptureFeed(cap, release("R", 2, 1));
  assert.strictEqual(api.keyCaptureFeed(cap, press("R", 2, 1)).reason, "duplicate");
  assert.strictEqual(cap.slots.length, 1);
});

test("Tastenaufnahme: Leader-Folge erlaubt dieselbe Taste nach dem Loslassen", () => {
  const cap = captureFor("R", { allowRepeat: true, max: 4, resolve: () => "KEY_A" });
  api.keyCaptureFeed(cap, press("R", 2, 1));
  api.keyCaptureFeed(cap, release("R", 2, 1));
  assert.strictEqual(api.keyCaptureFeed(cap, press("R", 2, 1)).accepted, true);
  assert.deepStrictEqual([...cap.slots.map(s => s.value)], ["KEY_A", "KEY_A"]);
});

test("Tastenaufnahme: fehlende Taste, unbrauchbare Taste und volle Plätze", () => {
  const cap = captureFor("R", { max: 1, resolve: (r, c) => (r === 0 ? null : `${r},${c}`) });
  assert.strictEqual(api.keyCaptureFeed(cap, press("R", 4, 0)).reason, "not-physical"); // R4C0 gibt es rechts nicht
  assert.strictEqual(api.keyCaptureFeed(cap, press("R", 0, 0)).reason, "unusable");
  assert.strictEqual(api.keyCaptureFeed(cap, press("R", 1, 0)).accepted, true);
  assert.strictEqual(api.keyCaptureFeed(cap, press("R", 1, 1)).reason, "full");
  api.keyCaptureStop(cap);
  assert.strictEqual(api.keyCaptureFeed(cap, press("R", 1, 2)).reason, "inactive");
});

test("Tastenaufnahme: linke Hälfte kennt R4C5 und R5C0 nicht", () => {
  const cap = captureFor("L");
  assert.strictEqual(api.keyCaptureFeed(cap, press("L", 4, 5)).reason, "not-physical");
  assert.strictEqual(api.keyCaptureFeed(cap, press("R", 1, 1)).reason, "wrong-side");
});

// Klebecode aus js/editor-events.js (feedKeyCapture, startKeyCapture, stopKeyCapture) mit Stubs für DOM und Hälfte
function captureGlueHarness() {
  const listeners = {};
  const toasts = [];
  const timers = [];
  const s = { console: { warn() {} }, document: { activeElement: null }, listeners, toasts, timers, setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout: id => { if (id) timers[id - 1] = null; } };
  vm.createContext(s);
  vm.runInContext(`${code}
${read("js/side-routing.js")}
var editSide = "R";
function isEditableTarget(t) { return !!(t && t.editable); }
function showToast(msg) { toasts.push(msg); }
${section("js/editor-events.js", "// Tastenaufnahme (Combo-Dialog", "function setCaptureButton")}
this.api2 = { startKeyCapture, stopKeyCapture, feedKeyCapture, setSide: v => { editSide = v; }, block: blockKeysDuringCapture, active: () => keyCapture.active };`, s);
  return s;
}

test("Tastenaufnahme: Klebecode füllt Plätze, stoppt bei voller Aufnahme und meldet onStop", () => {
  const s = captureGlueHarness(), g = s.api2, filled = [];
  let stops = 0;
  g.startKeyCapture({ max: 2 }, (i, v) => filled.push([i, v]), () => { stops++; });
  g.feedKeyCapture("R", 2, 1, true);
  g.feedKeyCapture("L", 2, 2, true);   // andere Hälfte
  g.feedKeyCapture("R", 2, 2, true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(filled)), [[0, "2,1"], [1, "2,2"]]);
  assert.strictEqual(g.active(), false);
  assert.strictEqual(stops, 1);
});

test("Tastenaufnahme: Wechsel der bearbeiteten Hälfte beendet die Aufnahme", () => {
  const s = captureGlueHarness(), g = s.api2, filled = [];
  let stops = 0;
  g.startKeyCapture({ max: 3 }, (i, v) => filled.push(v), () => { stops++; });
  g.setSide("L");
  g.feedKeyCapture("L", 1, 1, true);
  assert.deepStrictEqual(filled, []);
  assert.strictEqual(g.active(), false);
  assert.strictEqual(stops, 1);
  assert.ok(section("js/editor.js", "function switchEditSide", "editSide = side;").includes("stopKeyCapture();"));
});

function timingGlueHarness() {
  const s = captureGlueHarness();
  s.document.getElementById = () => null;
  vm.runInContext(`
${section("js/editor-events.js", "const TIMING_MAX_SAMPLES", "function setupTimingAssistant")}
this.api3 = { feed: feedTimingAssistant, ta: timingAssistant, setSide: v => { editSide = v; } };`, s);
  return s;
}

test("Tapping-Term-Assistent: Aufnahme gilt nur für die bearbeitete Hälfte und endet an der Obergrenze", () => {
  const s = timingGlueHarness(), g = s.api3;
  const evt = t => ({ r: 0, c: 0, pressed: true, t });
  g.feed("R", evt(1));                                  // keine Aufnahme: ignoriert
  assert.strictEqual(g.ta.samples.length, 0);
  g.ta.recording = true; g.ta.side = "R";
  g.feed("L", evt(2));                                  // andere Hälfte: ignoriert
  g.feed("R", { r: 0, c: 0, pressed: true });           // ohne Scan-Zeit: ignoriert
  assert.strictEqual(g.ta.samples.length, 0);
  g.feed("R", evt(3));
  assert.strictEqual(g.ta.samples.length, 1);
  g.setSide("L");                                       // Wechsel der bearbeiteten Hälfte beendet und leert
  g.feed("R", evt(4));
  assert.strictEqual(g.ta.recording, false);
  assert.strictEqual(g.ta.samples.length, 0);
  g.setSide("R");
  g.ta.recording = true; g.ta.side = "R";
  g.ta.samples = new Array(19999).fill({ r: 0, c: 0, pressed: true, t: 0 });
  g.feed("R", evt(5));
  assert.strictEqual(g.ta.recording, false);
  assert.strictEqual(s.toasts.length, 1);
});

test("Tastenaufnahme: Browser-Tasten bleiben während der Aufnahme wirkungslos", () => {
  const s = captureGlueHarness(), g = s.api2;
  const evt = () => { const e = { prevented: false, stopped: false, preventDefault() { e.prevented = true; }, stopImmediatePropagation() { e.stopped = true; } }; return e; };
  const idle = evt();
  g.block(idle);
  assert.strictEqual(idle.prevented, false);
  g.startKeyCapture({ max: 1 }, () => {}, () => {});
  const down = evt(), up = evt();
  g.block(down);
  g.block(up);
  assert.deepStrictEqual([down.prevented, down.stopped, up.prevented, up.stopped], [true, true, true, true]);
  // Beide Ereignisse hängen in der Aufnahmephase am Fenster
  const setup = section("js/editor-events.js", "function setupEventListeners", "// Diagnose (GET_DIAG)");
  assert.ok(setup.includes('window.addEventListener("keydown", blockKeysDuringCapture, true)'));
  assert.ok(setup.includes('window.addEventListener("keyup", blockKeysDuringCapture, true)'));
});

test("Tastenaufnahme: Fehler im Füll-Rückruf beendet die Aufnahme ohne Ausnahme", () => {
  const s = captureGlueHarness(), g = s.api2;
  g.startKeyCapture({ max: 2 }, () => { throw new Error("kaputt"); }, () => {});
  assert.doesNotThrow(() => g.feedKeyCapture("R", 2, 1, true));
  assert.strictEqual(g.active(), false);
});

test("Tastenaufnahme: Tab und Eingabefelder bleiben frei, Esc beendet die Aufnahme, abgelehnte Taste zeigt einen Hinweis", () => {
  const s = captureGlueHarness(), g = s.api2;
  const evt = (extra) => { const e = { type: "keydown", key: "a", target: {}, prevented: false, preventDefault() { e.prevented = true; }, stopImmediatePropagation() {}, ...extra }; return e; };
  g.startKeyCapture({ max: 2, resolve: () => null }, () => {}, () => {});
  const tab = evt({ key: "Tab" }), field = evt({ target: { editable: true } });
  g.block(tab);
  g.block(field);
  assert.deepStrictEqual([tab.prevented, field.prevented], [false, false]);
  g.feedKeyCapture("R", 2, 1, true);
  assert.strictEqual(s.toasts.length, 1);
  const esc = evt({ key: "Escape" });
  g.block(esc);
  assert.strictEqual(esc.prevented, true);
  assert.strictEqual(g.active(), false);
});

test("Tastenaufnahme: Leerlauf beendet die Aufnahme, ein Druck setzt die Frist zurück", () => {
  const s = captureGlueHarness(), g = s.api2;
  g.startKeyCapture({ max: 3 }, () => {}, () => {});
  g.feedKeyCapture("R", 2, 1, true);
  const live = s.timers.filter(Boolean);
  assert.strictEqual(live.length, 1);
  assert.strictEqual(live[0].ms, 30000);
  live[0].fn();
  assert.strictEqual(g.active(), false);
});

test("Tastenaufnahme: Verbindungsabbruch beendet die Aufnahme", () => {
  assert.ok(section("js/ble.js", "function onBleDisconnected", "if (!bleDevice").includes("stopKeyCapture();"));
  assert.ok(section("js/serial.js", "async function disconnectSerialNow", "keepReading = false").includes("stopKeyCapture();"));
});

test("Tastenaufnahme: Leader-Knopf leert alle Plätze, Combo-Knopf leert Taste 3", () => {
  const values = {};
  const buttons = { btnCaptureLeader: { attrs: {}, getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; }, classList: { toggle() {} } } };
  const s = { LEADER_MAX_KEYS: 4, buttons, values, started: null };
  vm.createContext(s);
  vm.runInContext(`
    const document = { getElementById: id => buttons[id] || (values[id] || (values[id] = { value: "KEY_A" })) };
    function startKeyCapture(o) { started = o; }
    function stopKeyCapture() {}
    function setCaptureButton() {}
    var currentConfig = { layers: [[[{ tap: "KEY_B" }]]] };
    function isLeaderKey(c) { return c === "KEY_B"; }
    ${section("js/leader-ui.js", "function leaderCaptureKeyCode", "function initLeaderUI")}
    toggleLeaderCapture();
    this.keyOf = leaderCaptureKeyCode;`, s);
  for (let i = 0; i < 4; i++) assert.strictEqual(values[`leaderKeySelect${i}`].value, "");
  assert.strictEqual(s.started.allowRepeat, true);
  assert.strictEqual(s.keyOf(0, 0), "KEY_B");
  assert.strictEqual(s.keyOf(1, 1), null);
  assert.ok(section("js/editor-events.js", 'btnCaptureCombo.addEventListener("click"', "startKeyCapture(").includes('comboKey3Select").value = ""'));
});

test("Tapping-Term-Assistent: Perzentil, Klemmung und unvollständige Paare", () => {
  assert.strictEqual(api.percentile([], 0.5), null);
  assert.strictEqual(api.percentile([10, 20, 30, 40, 50], 0.5), 30);
  assert.strictEqual(api.percentile([10, 20], 0.5), 15);
  assert.strictEqual(api.percentile([5, 1, 9], 1), 9);
  const ev = (r, c, pressed, t) => ({ r, c, pressed, t });
  // 30 Tipps mit 90 ms Haltezeit, 400 ms Abstand: Tapping-Term = p95 + 30 = 120 -> 120
  const taps = [];
  for (let i = 0; i < 30; i++) taps.push(ev(2, 1, true, i * 350), ev(2, 1, false, i * 350 + 90));
  let rec = api.computeTimingRecommendations(taps);
  assert.strictEqual(rec.enough, true);
  assert.strictEqual(rec.stats.holds, 30);
  assert.strictEqual(rec.settings.tappingTermMs, 120);
  assert.strictEqual(rec.settings.requirePriorIdleMs, 350);
  assert.strictEqual(rec.settings.quickTapMs, 260);   // p5 der gleichen Abstände (alle 260 ms)
  // Klemmung auf SETTINGS_RANGES: kurze Tipps -> Untergrenze 100; lange -> Obergrenze 500
  const fast = [];
  for (let i = 0; i < 25; i++) fast.push(ev(0, 0, true, i * 300), ev(0, 0, false, i * 300 + 20));
  assert.strictEqual(api.computeTimingRecommendations(fast).settings.tappingTermMs, api.SETTINGS_RANGES.tappingTermMs[0]);
  const slow = [];
  for (let i = 0; i < 25; i++) slow.push(ev(0, 0, true, i * 2000), ev(0, 0, false, i * 2000 + 480));
  assert.strictEqual(api.computeTimingRecommendations(slow).settings.tappingTermMs, api.SETTINGS_RANGES.tappingTermMs[1]);
  // Rolls: Taste B wird 40 ms nach A gedrückt, bevor A losgelassen wird -> Combo-Fenster = 20 ms
  const rolls = [];
  for (let i = 0; i < 25; i++) rolls.push(ev(1, 0, true, i * 500), ev(1, 1, true, i * 500 + 40), ev(1, 0, false, i * 500 + 90), ev(1, 1, false, i * 500 + 120));
  rec = api.computeTimingRecommendations(rolls);
  assert.strictEqual(rec.stats.rolls, 25);
  assert.strictEqual(rec.settings.comboTimeoutMs, 20);
  // Unvollständige Paare: Loslassen ohne Druck, Druck ohne Loslassen, ungültige Ereignisse
  rec = api.computeTimingRecommendations([ev(0, 0, false, 5), ev(0, 1, true, 10), ev(0, 1, true, 50), ev(0, 1, false, 90), ev(9, 9, true, 5), { r: 0, c: 0, pressed: true }, ev(3, 3, true, 200)]);
  assert.strictEqual(rec.stats.holds, 1);
  assert.strictEqual(rec.stats.incomplete, 5);
  assert.strictEqual(rec.enough, false);
  assert.deepStrictEqual({ ...rec.settings }, {});
  // Zu wenige Tipps und Nicht-Liste
  assert.strictEqual(api.computeTimingRecommendations(taps.slice(0, 10)).enough, false);
  assert.strictEqual(api.computeTimingRecommendations(null).enough, false);
  // Prellen (Druck 10 ms nach dem Loslassen) setzt die Haltezeit fort: eine Haltezeit von 100 ms, kein Paar aus 40 und 50 ms
  const bounce = [];
  for (let i = 0; i < 25; i++) bounce.push(ev(0, 0, true, i * 400), ev(0, 0, false, i * 400 + 40), ev(0, 0, true, i * 400 + 50), ev(0, 0, false, i * 400 + 100));
  rec = api.computeTimingRecommendations(bounce);
  assert.strictEqual(rec.stats.holds, 25);
  assert.strictEqual(rec.stats.holdP95, 100);
  assert.strictEqual(rec.stats.incomplete, 0);
  // Zu lange Haltezeit (> 500 ms) zählt nicht; lange gehaltene Taste liefert keine Überlappung
  const longHold = [];
  for (let i = 0; i < 25; i++) longHold.push(ev(0, 0, true, i * 5000), ev(0, 0, false, i * 5000 + 90));
  longHold.push(ev(4, 4, true, 200000), ev(4, 4, false, 200600));
  rec = api.computeTimingRecommendations(longHold);
  assert.strictEqual(rec.stats.holds, 25);
  assert.strictEqual(rec.stats.incomplete, 1);
  const shift = [ev(5, 0, true, 0)];
  for (let i = 0; i < 25; i++) shift.push(ev(1, 1, true, 1000 + i * 100), ev(1, 1, false, 1050 + i * 100));
  shift.push(ev(5, 0, false, 5000));
  assert.strictEqual(api.computeTimingRecommendations(shift).stats.rolls, 0);
  // Wenige Messwerte außer den Haltezeiten ergeben keine Einstellung
  rec = api.computeTimingRecommendations(taps.slice(0, 40).concat([ev(1, 0, true, 100000), ev(1, 1, true, 100040), ev(1, 0, false, 100090), ev(1, 1, false, 100120)]));
  assert.strictEqual(rec.stats.rolls, 1);
  assert.strictEqual(rec.settings.comboTimeoutMs, undefined);
  // Rücksprung der Scan-Zeit (Neustart) verwirft offene Drücke
  rec = api.computeTimingRecommendations([ev(0, 0, true, 2000000000), ev(0, 0, false, 100)]);
  assert.strictEqual(rec.stats.holds, 0);
  assert.strictEqual(rec.stats.incomplete, 2);
  // Überlauf von millis(): Haltezeit bleibt 90 ms
  const wrap = [];
  for (let i = 0; i < 25; i++) wrap.push(ev(0, 0, true, (0xFFFFFFFF - 2000 + i * 400) >>> 0), ev(0, 0, false, (0xFFFFFFFF - 2000 + i * 400 + 90) >>> 0));
  assert.strictEqual(api.computeTimingRecommendations(wrap).stats.holdP95, 90);
});

function perKeyTimingFixture() {
  const cfg = ergoConfig({ "2_1": { tap: "KEY_A", hold: "KEY_LEFT_SHIFT" }, "2_2": { tap: "KEY_S", hold: "KEY_LEFT_CTRL" }, "2_3": { tap: "KEY_D", hold: "KEY_LEFT_ALT" } });
  cfg.settings = { tappingTermMs: 200 };
  const samples = [];
  // R2C1 hält 90 ms (p95 + 30 = 120, Unterschied 80 ms), R2C2 hält 150 ms (180, Unterschied 20 ms), R2C3 nur 5 Tipps
  for (let i = 0; i < 12; i++) samples.push({ r: 2, c: 1, pressed: true, t: i * 400 }, { r: 2, c: 1, pressed: false, t: i * 400 + 90 });
  for (let i = 0; i < 12; i++) samples.push({ r: 2, c: 2, pressed: true, t: 10000 + i * 400 }, { r: 2, c: 2, pressed: false, t: 10000 + i * 400 + 150 });
  for (let i = 0; i < 5; i++) samples.push({ r: 2, c: 3, pressed: true, t: 20000 + i * 400 }, { r: 2, c: 3, pressed: false, t: 20000 + i * 400 + 90 });
  return { cfg, samples };
}

test("Tapping-Term je Taste: nur die abweichende Mod-Tap-Taste bekommt einen Vorschlag", () => {
  const { cfg, samples } = perKeyTimingFixture();
  const sug = api.computePerKeyTimingSuggestions(samples, cfg, api.SIDE_PROFILES.R);
  assert.strictEqual(sug.length, 1);
  assert.strictEqual(sug[0].r, 2); assert.strictEqual(sug[0].c, 1);
  assert.strictEqual(sug[0].recommended, 120);
  assert.strictEqual(sug[0].current, 200);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(sug[0].layers)), [0]);
  // Taste ohne Halte-Aktion: kein Vorschlag, auch bei Abweichung
  cfg.layers[0][2][1].hold = "NONE";
  assert.strictEqual(api.computePerKeyTimingSuggestions(samples, cfg, api.SIDE_PROFILES.R).length, 0);
  // Ein Tapping-Term der Hälfte nahe 120 ms macht den Vorschlag für R2C1 überflüssig; nun weicht R2C2 (180 ms) ab
  cfg.layers[0][2][1].hold = "KEY_LEFT_SHIFT";
  cfg.settings.tappingTermMs = 140;
  const near = api.computePerKeyTimingSuggestions(samples, cfg, api.SIDE_PROFILES.R);
  assert.deepStrictEqual([...near.map(x => x.c)], [2]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.computePerKeyTimingSuggestions(null, cfg, null))), []);
});

test("Tapping-Term je Taste: Profilfilter, Layer-Tap und mehrere Ebenen", () => {
  const { cfg, samples } = perKeyTimingFixture();
  // Zweite Ebene mit Layer-Tap (MO_1) auf derselben Taste: beide Ebenen bekommen den Wert
  cfg.layers.push(JSON.parse(JSON.stringify(cfg.layers[0])));
  cfg.layers[1][2][1] = { label: "L", tap: "KEY_A", hold: "MO_1", dtap: "NONE" };
  let sug = api.computePerKeyTimingSuggestions(samples, cfg, api.SIDE_PROFILES.R);
  assert.deepStrictEqual([...sug[0].layers], [0, 1]);
  api.applyPerKeyTimingSuggestions(cfg, sug);
  assert.strictEqual(cfg.layers[1][2][1].tapTerm, 120);
  // R2C1 fehlt auf keiner Hälfte, R4C0 fehlt rechts: eine Taste außerhalb des Profils bekommt keinen Vorschlag
  const miss = [];
  for (let i = 0; i < 12; i++) miss.push({ r: 4, c: 0, pressed: true, t: i * 400 }, { r: 4, c: 0, pressed: false, t: i * 400 + 90 });
  const cfg2 = ergoConfig({ "4_0": { tap: "KEY_A", hold: "KEY_LEFT_SHIFT" } });
  cfg2.settings = { tappingTermMs: 200 };
  assert.strictEqual(api.computePerKeyTimingSuggestions(miss, cfg2, api.SIDE_PROFILES.R).length, 0);
  assert.strictEqual(api.computePerKeyTimingSuggestions(miss, cfg2, null).length, 1);
});

test("Tapping-Term je Taste: Übernehmen und Rückgängig", () => {
  const { cfg, samples } = perKeyTimingFixture();
  cfg.layers[0][2][1].tapTerm = 250;
  const sug = api.computePerKeyTimingSuggestions(samples, cfg, api.SIDE_PROFILES.R);
  const changed = api.applyPerKeyTimingSuggestions(cfg, sug);
  assert.strictEqual(cfg.layers[0][2][1].tapTerm, 120);
  assert.strictEqual(api.computePerKeyTimingSuggestions(samples, cfg, api.SIDE_PROFILES.R).length, 0, "ist schon gesetzt");
  api.revertPerKeyTimingSuggestions(cfg, changed);
  assert.strictEqual(cfg.layers[0][2][1].tapTerm, 250);
  delete cfg.layers[0][2][1].tapTerm;
  const changed2 = api.applyPerKeyTimingSuggestions(cfg, sug);
  api.revertPerKeyTimingSuggestions(cfg, changed2);
  assert.ok(!("tapTerm" in cfg.layers[0][2][1]));
});

test("Tapping-Term je Taste in der UI: Snapshot-Änderung mit Undo", () => {
  const { cfg, samples } = perKeyTimingFixture();
  const u = presetUiContext("js/editor-events.js", "// Trägt die Vorschläge je Taste als Snapshot-Änderung", "function setupTimingAssistant", { config: cfg });
  u.editSide = "R";
  u.applyPerKeyTimingSuggestions = api.applyPerKeyTimingSuggestions;
  u.revertPerKeyTimingSuggestions = api.revertPerKeyTimingSuggestions;
  u.timingAssistant = { perKey: api.computePerKeyTimingSuggestions(samples, cfg, api.SIDE_PROFILES.R), resultSide: "R" };
  assert.strictEqual(u.applyPerKeyTimingFromUI(), true);
  assert.strictEqual(u.currentConfig.layers[0][2][1].tapTerm, 120);
  assert.strictEqual(u.calls.pending[0].snapshot, true);
  assert.strictEqual(u.calls.saved, 1);
  u.calls.pending[0].revert();
  assert.ok(!("tapTerm" in u.currentConfig.layers[0][2][1]));
  // andere Hälfte: nichts ändert sich
  u.editSide = "L";
  assert.strictEqual(u.applyPerKeyTimingFromUI(), false);
  assert.strictEqual(u.calls.pending.length, 1);
});

function ergoConfig(overrides = {}) {
  const layer = [];
  for (let r = 0; r < 6; r++) layer.push(Array.from({ length: 7 }, (_, c) => ({ label: "k", tap: (r < 5 && c < 6) ? "KEY_A" : "NONE", hold: "NONE", dtap: "NONE" })));
  for (const [id, cell] of Object.entries(overrides)) { const [r, c] = id.split("_").map(Number); layer[r][c] = { hold: "NONE", dtap: "NONE", ...cell }; }
  return { layers: [layer] };
}
function ergoStats(counts) {
  const s = api.createTypingStats(null, R);
  for (const [id, n] of Object.entries(counts)) { const [r, c] = id.split("_").map(Number); for (let i = 0; i < n; i++) api.recordKeyPress(s, r, c, 0); }
  return s;
}

test("Tausch-Vorschläge: häufige Außentasten tauschen mit seltenen Grundreihen-Tasten", () => {
  // Rechts: Spalte 5 und 4 = kleiner Finger, Spalten 0..1 Zeigefinger, Zeile 2 = Grundreihe
  const stats = ergoStats({ "1_5": 50, "0_2": 30, "2_0": 5, "2_2": 1, "2_3": 2 });
  const swaps = api.suggestErgonomicSwaps(stats, ergoConfig(), R);
  const pairs = JSON.parse(JSON.stringify(swaps.slice(0, 2).map(s => [s.from, s.to])));
  assert.deepStrictEqual(pairs, [[{ r: 1, c: 5 }, { r: 2, c: 1 }], [{ r: 0, c: 2 }, { r: 2, c: 2 }]]);
  assert.strictEqual(swaps[0].fromCount, 50);
  assert.ok(swaps.every(s => s.to.r === 2 && s.fromCount > s.toCount));
  assert.strictEqual(new Set(swaps.flatMap(s => [`${s.from.r}_${s.from.c}`, `${s.to.r}_${s.to.c}`])).size, swaps.length * 2);
});

test("Tausch-Vorschläge: Modifier, Layer-Tasten, Hold-Tasten und fehlende Tasten bleiben außen vor", () => {
  const stats = ergoStats({ "1_5": 50, "0_5": 40, "0_4": 30, "3_4": 20, "4_0": 99, "5_3": 99 });
  const cfg = ergoConfig({
    "1_5": { tap: "KEY_LEFT_SHIFT" }, "0_5": { tap: "MO_1" }, "0_4": { tap: "KEY_A", hold: "KEY_LEFT_CTRL" },
    "2_1": { tap: "MO_1" }, "2_0": { tap: "NONE" }
  });
  const swaps = api.suggestErgonomicSwaps(stats, cfg, R);
  const ids = Array.from(swaps.flatMap(s => [`${s.from.r}_${s.from.c}`, `${s.to.r}_${s.to.c}`]));
  for (const bad of ["1_5", "0_5", "0_4", "2_1", "2_0", "4_0", "5_3"]) assert.ok(!ids.includes(bad), bad);
  assert.strictEqual(ids[0], "3_4");
  assert.strictEqual(api.suggestErgonomicSwaps(ergoStats({}), ergoConfig(), R).length, 0);
});

test("Tausch-Vorschläge: Obergrenze, links gilt das Profil der linken Hälfte", () => {
  const counts = {};
  for (let c = 0; c < 6; c++) { counts[`0_${c}`] = 100 + c; counts[`2_${c}`] = c; }
  const swaps = api.suggestErgonomicSwaps(ergoStats(counts), ergoConfig(), R);
  // Die Grundreihe hat rechts vier Ziele (Zeige-, Mittel-, Ringfinger); die Obergrenze 5 gilt zusätzlich
  assert.strictEqual(swaps.length, 4);
  assert.strictEqual(api.suggestErgonomicSwaps(ergoStats(counts), ergoConfig(), R, 2).length, 2);
  assert.strictEqual(api.suggestErgonomicSwaps(ergoStats(counts), ergoConfig(), R, 99).length, 4);
  assert.ok(swaps.every(s => s.from.r === 0));
  assert.ok(swaps.every((s, i) => i === 0 || swaps[i - 1].fromCount >= s.fromCount));
  // Links ist Spalte 0 der kleine Finger und Spalte 4 ein Zeigefinger
  const ls = api.createTypingStats(null, L);
  for (let i = 0; i < 9; i++) api.recordKeyPress(ls, 3, 0, 0);
  const left = api.suggestErgonomicSwaps(ls, ergoConfig({ "3_6": { tap: "NONE" } }), L);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(left[0].from)), { r: 3, c: 0 });
  assert.ok(["index", "middle", "ring"].includes(api.fingerOfKey(left[0].to.r, left[0].to.c, L)));
});

test("Tausch-Vorschläge: Grenze fünf, Folgen-Grund, Ausschluss und Zähler 0", () => {
  // Grundreihe hat vier Ziele (zweimal Zeigefinger, Mittel-, Ringfinger); die Obergrenze 5 bleibt eine Schranke
  const counts = {};
  for (let c = 0; c < 6; c++) { counts[`0_${c}`] = 100 + c; counts[`2_${c}`] = c; }
  const s = ergoStats(counts);
  const cfg = ergoConfig();
  const wide = api.suggestErgonomicSwaps(s, cfg, R, 99);
  assert.ok(wide.length <= 5);
  assert.ok(wide.every(x => x.reason === "Obere Reihe" || x.reason === "Kleiner Finger"));
  // Ausgeschlossene Positionen tauchen nicht auf
  const first = wide[0];
  const ex = new Set([`${first.from.r}_${first.from.c}`, `${first.to.r}_${first.to.c}`]);
  const again = api.suggestErgonomicSwaps(s, cfg, R, 5, ex);
  assert.ok(again.every(x => !ex.has(`${x.from.r}_${x.from.c}`) && !ex.has(`${x.to.r}_${x.to.c}`)));
  // Folge desselben Fingers: 3_1 und 3_0 (Zeigefinger) abwechselnd, 3_1 häufiger
  const t = api.createTypingStats(null, R);
  let ms = 0;
  for (let i = 0; i < 6; i++) { api.recordKeyPress(t, 3, 1, ms += 10); api.recordKeyPress(t, 3, 0, ms += 10); api.recordKeyPress(t, 3, 1, ms += 10); }
  const seq = api.suggestErgonomicSwaps(t, cfg, R);
  assert.strictEqual(seq[0].reason, "Häufige Folge desselben Fingers");
  assert.strictEqual(seq[0].from.r, 3);
  // Taste mit Zähler 0 ist keine Quelle; Grundreihen-Taste unter dem Zeigefinger ist keine Quelle
  assert.strictEqual(api.suggestErgonomicSwaps(ergoStats({ "2_0": 50 }), cfg, R).length, 0);
  assert.strictEqual(api.suggestErgonomicSwaps(ergoStats({ "1_0": 0 }), cfg, R).length, 0);
});

test("Tausch-Vorschläge: Zähler der Ebene 0 zählen, Gesamtzähler nur als Rückfall", () => {
  const s = api.createTypingStats(null, R);
  for (let i = 0; i < 30; i++) api.recordKeyPress(s, 1, 5, i, 3); // Ebene 3 zählt nicht für Ebene 0
  for (let i = 0; i < 10; i++) api.recordKeyPress(s, 0, 4, 100 + i, 0);
  const swaps = api.suggestErgonomicSwaps(s, ergoConfig(), R);
  assert.strictEqual(swaps.length > 0, true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(swaps[0].from)), { r: 0, c: 4 });
  assert.strictEqual(swaps[0].fromCount, 10);
  // Ohne Ebenenzähler (ältere Daten) gelten die Gesamtzähler
  const legacy = api.createTypingStats({ "1_5": 30 }, R);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.suggestErgonomicSwaps(legacy, ergoConfig(), R)[0].from)), { r: 1, c: 5 });
});

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

function bigramStats(seq) {
  const s = api.createTypingStats(null, R);
  let t = 0;
  for (const id of seq) { const [r, c] = id.split("_").map(Number); api.recordKeyPress(s, r, c, t); t += 100; }
  return s;
}

test("Combo-Vorschläge: häufigstes benachbartes Paar steht vorn", () => {
  // t/h = 2_1 / 2_2 (Nachbarn) 4x, 1_1 / 2_1 2x, 0_0 / 2_4 (nicht benachbart) 9x
  const seq = [];
  for (let i = 0; i < 4; i++) seq.push("2_1", "2_2", "3_5");
  for (let i = 0; i < 2; i++) seq.push("1_1", "2_1", "4_4");
  for (let i = 0; i < 9; i++) seq.push("0_0", "2_4", "5_3");
  const out = JSON.parse(JSON.stringify(api.suggestCombos(bigramStats(seq), ergoConfig(), R)));
  assert.deepStrictEqual(out[0], { a: { r: 2, c: 1 }, b: { r: 2, c: 2 }, count: 4 });
  assert.ok(out.length <= 5);
  assert.ok(!out.some(p => p.a.r === 0 && p.a.c === 0)); // 0_0 / 2_4 nicht benachbart
  assert.ok(!out.some(p => p.a.r === 5 || p.b.r === 5)); // Daumen zählt nicht
});

test("Combo-Vorschläge: Paar mit vorhandener Combo fehlt, Reihenfolge der Tasten egal", () => {
  const seq = [];
  for (let i = 0; i < 4; i++) seq.push("2_1", "2_2", "3_5");
  for (let i = 0; i < 2; i++) seq.push("1_1", "2_1", "4_4");
  const cfg = ergoConfig();
  cfg.combos = [{ key1: { r: 2, c: 2 }, key2: { r: 2, c: 1 }, behavior: "KEY_PRESS", action: "KEY_ESC" }];
  const out = JSON.parse(JSON.stringify(api.suggestCombos(bigramStats(seq), cfg, R)));
  assert.ok(!out.some(p => p.a.r === 2 && p.a.c === 1 && p.b.r === 2 && p.b.c === 2));
  assert.deepStrictEqual(out[0].count, 2);
  assert.strictEqual(api.suggestCombos(api.createTypingStats(null, R), ergoConfig(), R).length, 0);
});

test("Combo-Vorschläge: Bigramme werden gespeichert, ungültige Einträge entfallen, Pause trennt", () => {
  const s = bigramStats(["2_1", "2_2", "2_1"]);
  assert.deepStrictEqual({ ...s.bigrams }, { "2_1|2_2": 2 });
  const back = api.createTypingStats(JSON.parse(JSON.stringify(api.serializeTypingStats(s))), R);
  assert.deepStrictEqual({ ...back.bigrams }, { "2_1|2_2": 2 });
  const bad = api.createTypingStats(JSON.parse('{"bigrams": {"2_1|2_2": 1, "2_2|2_1": 1, "4_0|4_1": 1, "2_1|2_1": 1, "2_1|2_2x": 1, "1_1|1_2": -1}}'), R);
  assert.deepStrictEqual({ ...bad.bigrams }, { "2_1|2_2": 1 });
  const gap = api.createTypingStats(null, R);
  api.recordKeyPress(gap, 2, 1, 0);
  api.recordKeyPress(gap, 2, 2, 5000);
  assert.deepStrictEqual({ ...gap.bigrams }, {});
});

test("Combo-Vorschläge: Rollen, Ebenen, Filter, Drei-Tasten-Combo, Limit und alte Speicherform", () => {
  const typed = (seq, extra) => {
    const st = api.createTypingStats(null, R);
    seq.forEach(([id, role, layer], i) => { const [r, c] = id.split("_").map(Number); api.recordKeyPress(st, r, c, i * 100, layer, role); });
    return st;
  };
  // Modifier (silent), Backspace und Ebene 1 bilden kein Bigramm; Backspace trennt die Folge
  const st = typed([["2_1", "typed", 0], ["2_2", "silent", 0], ["2_1", "typed", 0], ["2_2", "backspace", 0], ["2_1", "typed", 0],
    ["2_2", "typed", 1], ["2_1", "typed", 0]]);
  assert.deepStrictEqual({ ...st.bigrams }, {});
  // Diagonale Nachbarn zählen, Tasten ohne Aktion auf Ebene 0 nicht
  const diag = typed([["1_1", "typed", 0], ["2_2", "typed", 0], ["1_3", "typed", 0], ["2_4", "typed", 0]]);
  const none = ergoConfig({ "1_3": { tap: "NONE" } });
  const out = JSON.parse(JSON.stringify(api.suggestCombos(diag, none, R)));
  assert.deepStrictEqual(out.map(p => [p.a.r, p.a.c, p.b.r, p.b.c]), [[1, 1, 2, 2]]);
  // Drei-Tasten-Combo belegt alle drei Paare
  const cfg3 = ergoConfig();
  cfg3.combos = [{ key1: { r: 1, c: 1 }, key2: { r: 2, c: 2 }, key3: { r: 1, c: 2 }, behavior: "KEY_PRESS", action: "KEY_ESC" }];
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.suggestCombos(diag, cfg3, R))).map(p => [p.a.r, p.a.c]), [[1, 3], [1, 3]]); // 1_3/2_2 und 1_3/2_4 bleiben
  assert.strictEqual(api.suggestCombos(typed([["1_1", "typed", 0], ["1_2", "typed", 0], ["2_2", "typed", 0]]), cfg3, R).length, 0);
  // Limit fünf
  const many = [];
  for (let c = 0; c < 5; c++) many.push(["1_" + c, "typed", 0], ["2_" + c, "typed", 0], ["3_" + c, "typed", 0]);
  assert.strictEqual(api.suggestCombos(typed(many), ergoConfig(), R, 99).length, 5);
  // Alte Speicherform mit Zählern, aber ohne bigrams
  assert.deepStrictEqual({ ...api.createTypingStats({ "2_1": 3, layers: {} }, R).bigrams }, {});
});

test("Combo-Vorschläge: Anzeige zeigt Paare und ruft den Combo-Dialog mit dem Paar", async () => {
  const { w, dom } = uiHarness(`${section("js/heatmap.js", "function keyPositionLabel", "function updateFingerLoadUI")}
${section("js/heatmap.js", "function updateComboSuggestionsUI", "function onTypingStatsChanged")}
var typingStatsBySide = { R: createTypingStats(null, SIDE_PROFILES.R) };
var openedPair = null;
function openComboModal(pair) { openedPair = pair; }`);
  vm.runInContext(`recordKeyPress(typingStatsBySide.R, 1, 1, 0); recordKeyPress(typingStatsBySide.R, 1, 2, 10);
    updateComboSuggestionsUI(typingStatsBySide.R);`, w);
  const list = dom.document.getElementById("comboSuggestions");
  assert.strictEqual(list.children.length, 1);
  assert.ok(/R1C1.*\+.*R1C2.*\(1×\)/.test(list.children[0].children[0].textContent));
  await list.children[0].children[1].click();
  assert.deepStrictEqual(JSON.parse(vm.runInContext("JSON.stringify(openedPair)", w)), { a: { r: 1, c: 1 }, b: { r: 1, c: 2 } });
});


test("Diagnosebericht: enthält alle Felder aus den Beispieldaten", () => {
  const info = { side: "R", fw: 12, name: "Dactyl", standby_timeout: 5, sleep_timeout: 30, debounce_ms: 5, combo_timeout_ms: 50,
    tapping_term_ms: 200, hold_tap_mode: 1, quick_tap_ms: 120, pi: 100, chordal_hold: 1, rt: 1, nwl: 2, bl: 3, qt: 120, as: 1, at: 175, ld: 2, ot: 3, lt: 4,
    config_mode: false, left_fw: 11,
    left_link: { up: 1, ms: 5000, ever: 1, losses: 2, rx_dropped: 0, key_dropped: 1, rssi: -60, rssi_min: -80 } };
  const diag = { reset: "power_on", uptimeS: 90, heapFree: 1000, heapMin: 800, loopMaxUs: 400, abnormal: false, at: 5 };
  const rep = JSON.parse(JSON.stringify(api.buildSupportReport({ now: 0, devices: { R: { info, diag } } })));
  assert.strictEqual(rep.appVersion, api.APP_VERSION);
  assert.strictEqual(rep.appVersion, JSON.parse(read("package.json")).version);
  assert.strictEqual(rep.createdAt, "1970-01-01T00:00:00.000Z");
  const h = rep.halves.R;
  assert.strictEqual(h.side, "R");
  const expected = { ...info };
  for (const k of ["side", "name", "left_fw", "left_link", "config_mode"]) delete expected[k];
  assert.deepStrictEqual({ ...h.device_info, config_mode: undefined }, { ...expected, config_mode: undefined });
  assert.strictEqual(h.device_info.config_mode, false);
  assert.strictEqual(h.left_fw, 11);
  assert.deepStrictEqual(h.left_link, { up: 1, ms: 5000, ever: 1, losses: 2, rx_dropped: 0, key_dropped: 1, rssi: -60, rssi_min: -80 });
  assert.deepStrictEqual(h.diag, { reset: "power_on", uptimeS: 90, heapFree: 1000, heapMin: 800, loopMaxUs: 400, sqMax: null, sqDrop: null });
  // Sendewarteschlange der linken Hälfte gelangt in den Bericht, fehlt sie, wird sie null
  const repQ = JSON.parse(JSON.stringify(api.buildSupportReport({ devices: { L: { diag: { ...diag, sqMax: 7, sqDrop: 2 } } } }))).halves.L;
  assert.strictEqual(repQ.diag.sqMax, 7);
  assert.strictEqual(repQ.diag.sqDrop, 2);
  assert.strictEqual(h.diag.sqMax, null);
  // Fehlende Hälfte-Daten werden null
  const empty = JSON.parse(JSON.stringify(api.buildSupportReport({ devices: { L: {} } }))).halves.L;
  assert.strictEqual(empty.diag, null);
  assert.strictEqual(empty.left_link, null);
  assert.strictEqual(empty.device_info.fw, null);
});

test("Diagnosebericht: Keymap, Makros, Key Pairs, Combos und Tastendaten fehlen vollständig", () => {
  const secret = "GEHEIM-PASSWORT-4711";
  const info = { side: "R", fw: 12, name: secret + "-name", mac: "AA:BB", keymap: [[secret]], layers: [[secret]],
    macros: [{ name: secret, steps: [[1, 65]] }], pairs: [[secret]], combos: [[secret]], leader: [[secret]],
    tri_layer: [[1, 2, 3]], host_leds: { caps: 1 }, key_press: { r: 1, c: 2 }, typing_stats: { "1_1": 99 },
    left_fw: 11, left_link: { up: 1, ms: 1, ever: 1, losses: 0, rx_dropped: 0, key_dropped: 0, keymap: secret } };
  const diag = { reset: "software", uptimeS: 1, heapFree: 2, heapMin: 3, loopMaxUs: 4, abnormal: false, at: 9, keys: secret };
  const text = JSON.stringify(api.buildSupportReport({ devices: { R: { info, diag } } }));
  assert.ok(!text.includes(secret), "Geheimnis im Bericht");
  for (const word of ["keymap", "layers", "macros", "pairs", "combos", "leader", "key_press", "typing_stats", "tri_layer", "host_leds", "mac", "name"]) {
    assert.ok(!text.includes(`"${word}"`), `Feld ${word} im Bericht`);
  }
});

test("Diagnosebericht: Button speichert die Datei, ohne Werte nur ein Hinweis", () => {
  const { w } = uiHarness(`${section("js/serial.js", "// Diagnosebericht als JSON-Datei", "function requestDiag")}
var Dactyl = { SIDE_IDS: ["R", "L"] };
var diagByRole = {}, deviceInfoByRole = {};
var saved = [];
var Blob = function (parts) { this.text = parts.join(""); };
var URL = { createObjectURL: b => { saved.push(b.text); return "blob:x"; }, revokeObjectURL() {} };
document.createElement = () => ({ click() { saved.push("click"); } });`);
  vm.runInContext("saveSupportReport()", w);
  assert.strictEqual(vm.runInContext("saved.length", w), 0);
  assert.strictEqual(vm.runInContext("log.toasts.length", w), 1);
  vm.runInContext(`deviceInfoByRole.R = { info: { side: "R", fw: 7, keymap: "GEHEIM" }, at: 1000 };
    diagByRole.R = { reset: "software", uptimeS: 1, heapFree: 2, heapMin: 3, loopMaxUs: 4, at: 2000 };
    saveSupportReport();`, w);
  const report = JSON.parse(vm.runInContext("saved[0]", w));
  assert.strictEqual(report.halves.R.device_info.fw, 7);
  assert.strictEqual(report.halves.R.device_info_at, "1970-01-01T00:00:01.000Z");
  assert.strictEqual(report.halves.R.diag_at, "1970-01-01T00:00:02.000Z");
  assert.ok(!vm.runInContext("saved[0]", w).includes("GEHEIM"));
  assert.strictEqual(vm.runInContext("saved[1]", w), "click");
});

// Makro-Vorlagen
test("Makro-Vorlagen: jede Vorlage hat 1..32 gültige Schritte", () => {
  const keys = Object.keys(api.MACRO_PRESETS);
  assert.ok(keys.length >= 6);
  for (const key of keys) {
    const r = api.applyMacroPreset(key, 0, []);
    assert.ok(r, key);
    assert.ok(r[0].steps.length >= 1 && r[0].steps.length <= api.MAX_MACRO_STEPS, key);
    assert.ok(r[0].steps.every(api.isValidMacroStep), key);
    assert.ok(api.isValidMacro(r[0]), key);
  }
});

test("Makro-Vorlagen: Anwenden setzt Schritte, ersetzt einen Slot und ändert die Eingabe nicht", () => {
  const old = [{ name: "a", steps: [{ type: "tap", code: "KEY_A" }] }];
  const before = JSON.stringify(old);
  const r = api.applyMacroPreset("console_log", 0, old);
  assert.strictEqual(JSON.stringify(old), before);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].name, "console.log");
  assert.strictEqual(api.applyMacroPreset("git_status", 1, old).length, 2);
  const rep = api.applyMacroPreset("git_status", 0, [{ name: "r", repeat: true, steps: [{ type: "tap", code: "KEY_A" }] }]);
  assert.strictEqual(rep[0].repeat, undefined);
  assert.strictEqual(JSON.stringify(r[0].steps.at(-1)), JSON.stringify({ type: "tap", code: "KEY_LEFT_ARROW" }));
});

test("Makro-Vorlagen: ungültige Vorlage oder ungültiger Slot werden abgelehnt", () => {
  const m = [{ name: "a", steps: [{ type: "tap", code: "KEY_A" }] }];
  for (const key of ["", "nope", "__proto__", "constructor", null, 3]) assert.strictEqual(api.applyMacroPreset(key, 0, m), null, String(key));
  for (const slot of [-1, 2, 1.5, NaN, "0", null]) assert.strictEqual(api.applyMacroPreset("git_status", slot, m), null, String(slot));
  const full = Array.from({ length: api.MAX_MACROS }, () => m[0]);
  assert.strictEqual(api.applyMacroPreset("git_status", api.MAX_MACROS, full), null);
  assert.ok(api.applyMacroPreset("git_status", api.MAX_MACROS - 1, full));
  assert.strictEqual(api.applyMacroPreset("git_status", 0, null), null);
});

test("Makro-UI: Vorlage ist eine Snapshot-Änderung, Rückgängig stellt die Schritte wieder her", () => {
  const { w, log } = uiHarness();
  vm.runInContext(`currentConfig.macros = [{ name: "a", steps: [{ type: "tap", code: "KEY_A" }] }];`, w);
  w.openMacroEditor(0);
  assert.strictEqual(w.applyMacroPresetFromUI("git_status"), true);
  assert.strictEqual(vm.runInContext("currentConfig.macros.length", w), 1);
  assert.strictEqual(vm.runInContext("currentConfig.macros[0].name", w), "git status");
  const change = log.pending.at(-1);
  assert.ok(change.snapshot && change.macros);
  change.revert();
  assert.strictEqual(vm.runInContext("currentConfig.macros[0].name", w), "a");
  assert.strictEqual(vm.runInContext("currentConfig.macros[0].steps.length", w), 1);
  // ohne offenen Editor: erster freier Platz
  assert.strictEqual(w.applyMacroPresetFromUI("code_block"), true);
  assert.strictEqual(vm.runInContext("currentConfig.macros.length", w), 2);
  assert.ok(log.toasts.at(-1).startsWith("Der offene Entwurf"));
  assert.strictEqual(w.applyMacroPresetFromUI("nope"), false);
  vm.runInContext(`currentConfig.macros = Array.from({ length: MAX_MACROS }, () => ({ name: "x", steps: [{ type: "tap", code: "KEY_A" }] }));`, w);
  const pendingBefore = log.pending.length;
  assert.strictEqual(w.applyMacroPresetFromUI("git_status"), false);
  assert.strictEqual(log.pending.length, pendingBefore);
  assert.ok(log.toasts.at(-1).startsWith("Alle"));
  w.openMacroEditor(0);
  assert.strictEqual(w.applyMacroPresetFromUI("git_push"), true);
  assert.ok(log.toasts.at(-1).startsWith("Der offene Entwurf"));
});

// Makro-Bibliothek: Export und Import eines einzelnen Makros
const libMacro = { name: "Kopieren", repeat: true, steps: [{ type: "down", code: "KEY_LEFT_GUI" }, { type: "tap", code: "KEY_C" },
  { type: "pause", ms: 50 }, { type: "up", code: "KEY_LEFT_GUI" }] };

test("Makro-Bibliothek: Export und Import in leere Liste liefert gleichen Namen und Schritte", () => {
  const json = JSON.stringify(api.buildMacroExport(libMacro));
  const r = api.parseMacroImport(json, []);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.index, 0);
  assert.strictEqual(r.macro.name, libMacro.name);
  assert.strictEqual(JSON.stringify(r.macro.steps), JSON.stringify(libMacro.steps));
  assert.strictEqual(r.macro.repeat, true);
  assert.ok(api.isValidMacro(r.macro));
});

test("Makro-Bibliothek: Import nutzt den ersten freien Slot", () => {
  const r = api.parseMacroImport(JSON.stringify(api.buildMacroExport(libMacro)), [{ name: "A", steps: [{ type: "tap", code: "KEY_A" }] }]);
  assert.strictEqual(r.index, 1);
});

test("Makro-Bibliothek: Import mit mehr als 32 Schritten wird abgelehnt", () => {
  const data = api.buildMacroExport(libMacro);
  data.steps = Array.from({ length: api.MAX_MACRO_STEPS + 1 }, () => ({ type: "tap", code: "KEY_A" }));
  assert.strictEqual(api.parseMacroImport(JSON.stringify(data), []).ok, false);
  data.steps.pop();
  assert.strictEqual(api.parseMacroImport(JSON.stringify(data), []).ok, true);
});

test("Makro-Bibliothek: Import ohne freien Slot wird abgelehnt", () => {
  const full = Array.from({ length: api.MAX_MACROS }, () => ({ name: "X", steps: [{ type: "tap", code: "KEY_A" }] }));
  const r = api.parseMacroImport(JSON.stringify(api.buildMacroExport(libMacro)), full);
  assert.strictEqual(r.ok, false);
  assert.ok(/belegt/.test(r.error));
});

test("Makro-Bibliothek: ungültiges JSON und fehlerhafte Schritte werden abgelehnt", () => {
  const base = api.buildMacroExport(libMacro);
  const bad = [
    "{kein json", "null", "[]", JSON.stringify({ ...base, format: "anderes" }), JSON.stringify({ ...base, version: 2 }),
    JSON.stringify({ ...base, steps: "tap" }), JSON.stringify({ ...base, steps: [] }),
    JSON.stringify({ ...base, steps: [null] }), JSON.stringify({ ...base, steps: [{ type: "tap" }] }),
    JSON.stringify({ ...base, steps: [{ type: "tap", code: "MO_1" }] }),
    JSON.stringify({ ...base, steps: [{ type: "jump", code: "KEY_A" }] }),
    JSON.stringify({ ...base, steps: [{ type: "pause", ms: 0 }] }),
    JSON.stringify({ ...base, steps: [{ type: "pause", ms: api.MACRO_MAX_PAUSE_MS + 1 }] })
  ];
  for (const text of bad) assert.strictEqual(api.parseMacroImport(text, []).ok, false, text);
});

test("Makro-Bibliothek: index.html, Buttons und Import als Snapshot-Änderung", () => {
  const html = read("index.html");
  const ui = read("js/macros-ui.js");
  for (const id of ["btnExportMacro", "btnImportMacro", "macroImportInput"]) {
    assert.ok(html.includes(`id="${id}"`) && ui.includes(`"${id}"`), id);
  }
  assert.ok(html.includes("Makro exportieren") && html.includes("Makro importieren"));
  const imp = section("js/macros-ui.js", "function importMacroText", "function importMacroFromFile");
  assert.ok(/snapshot: true/.test(imp) && /macros: true/.test(imp) && /parseMacroImport\(/.test(imp));
});

const csvConfig = side => ({ [side]: { layers: [[[{ label: "a" }, { label: 'Q"x,y' }], [{ label: "=SUM(A1)" }]]] } });
const parseCsv = text => text.split("\r\n").filter(Boolean);

test("Heatmap-CSV: Kopfzeile, eine Zeile je gezählter Taste und genaue Zähler", () => {
  const s = api.createTypingStats(null, R);
  api.recordKeyPress(s, 0, 0, 0, 0);
  api.recordKeyPress(s, 0, 0, 5000, 2);
  api.recordKeyPress(s, 0, 1, 10000, 0);
  api.recordKeyPress(s, 0, 1, 10100, 0, "backspace"); // Korrektur von 0_1; Backspace-Taste selbst bleibt eine Taste (0_1)
  const lines = parseCsv(api.buildHeatmapCsv([{ side: "R", stats: s }], csvConfig("R")));
  assert.strictEqual(lines[0], "half,row,column,layer_0_label,total,layer_0,layer_1,layer_2,layer_3,layer_4,layer_5,layer_6,layer_7,corrections");
  assert.strictEqual(lines.length, 3);
  assert.strictEqual(lines[1], "R,0,0,a,2,1,0,1,0,0,0,0,0,0");
  assert.strictEqual(lines[2], 'R,0,1,"Q""x,y",2,2,0,0,0,0,0,0,0,1');
  assert.strictEqual(s.total, 4); // 2 + 2 Zähler der Zeilen
});

test("Heatmap-CSV: beide Hälften und Formel-Schutz im Label", () => {
  const r = api.createTypingStats(null, R), l = api.createTypingStats(null, api.SIDE_PROFILES.L);
  api.recordKeyPress(r, 1, 0, 0, 0);
  api.recordKeyPress(l, 1, 0, 0, 0);
  const lines = parseCsv(api.buildHeatmapCsv([{ side: "R", stats: r }, { side: "L", stats: l }], { ...csvConfig("R"), ...csvConfig("L") }));
  assert.strictEqual(lines.length, 3);
  assert.ok(lines[1].startsWith("R,1,0,'=SUM(A1),1,1"));
  assert.ok(lines[2].startsWith("L,1,0,'=SUM(A1),1,1"));
});

test("Heatmap-CSV: Formel-Schutz für jeden Anfang, einzelne Zeichen bleiben", () => {
  const cfg = label => ({ R: { layers: [[[{ label }]]] } });
  const label = text => {
    const s = api.createTypingStats(null, R);
    api.recordKeyPress(s, 0, 0, 0, 0);
    const line = parseCsv(api.buildHeatmapCsv([{ side: "R", stats: s }], cfg(text)))[1];
    return line.split(",").slice(3, -10).join(",");
  };
  for (const t of ["=1+1", "+1", "-1", "@SUM", "\tx"]) assert.strictEqual(label(t), `'${t}`, JSON.stringify(t));
  for (const t of ["=", "+", "-", "@", "a"]) assert.strictEqual(label(t), t, t);
  assert.strictEqual(label("a\nb"), "a b");
});

test("Heatmap-CSV: kein Text, keine Zeiten, keine Folgen", () => {
  const s = api.createTypingStats(null, R);
  for (let i = 0; i < 6; i++) api.recordKeyPress(s, 2, 1 + (i % 2), 1700000000000 + i * 100, 0);
  assert.ok(Object.keys(s.bigrams).length > 0);
  const csv = api.buildHeatmapCsv([{ side: "R", stats: s }], csvConfig("R"));
  assert.ok(!csv.includes("|"), "kein Bigramm oder Tastenpaar");
  assert.ok(!/1700000000/.test(csv), "kein Zeitstempel");
  assert.ok(!/(bigram|recent|sameFinger|timestamp)/i.test(csv));
  for (const line of parseCsv(csv).slice(1)) assert.strictEqual(line.split(",").length, 14);
});

test("Heatmap-CSV: leere und ungültige Eingabe gibt null", () => {
  for (const bad of [undefined, null, [], "x", 5, {}, [null], [{}], [{ side: "R" }], [{ side: "R", stats: {} }],
    [{ side: 1, stats: api.createTypingStats(null, R) }]]) {
    assert.strictEqual(api.buildHeatmapCsv(bad, {}), null, JSON.stringify(bad));
  }
  const s = api.createTypingStats(null, R);
  assert.strictEqual(api.buildHeatmapCsv([{ side: "R", stats: s }], null).split("\r\n").length, 2); // nur Kopf, kein Absturz
});

test("Heatmap-CSV: Button in index.html und Download in js/heatmap.js", () => {
  assert.ok(read("index.html").includes('id="btnHeatmapCsv"') && read("index.html").includes("Als CSV speichern"));
  assert.ok(/buildHeatmapCsv\(/.test(read("js/heatmap.js")) && read("js/heatmap.js").includes('"btnHeatmapCsv"'));
  assert.ok(read("js/heatmap.js").includes("\\uFEFF") && read("js/heatmap.js").includes("showToast("));
});

// Combo- und Leader-Vorlagen
function presetConfig(keys) {
  const cfg = ergoConfig();
  keys.forEach((code, i) => { cfg.layers[0][1 + Math.floor(i / 6)][i % 6] = { label: code.slice(4), tap: code, hold: "NONE", dtap: "NONE" }; });
  cfg.combos = [];
  return cfg;
}
const PRESET_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => `KEY_${l}`);

test("Combo-Vorlagen: jede Vorlage ergibt auf leerer Config eine gültige Combo", () => {
  const keys = Object.keys(api.COMBO_PRESETS);
  assert.ok(keys.length >= 4);
  for (const key of keys) {
    const cfg = presetConfig(PRESET_ALPHABET);
    const r = api.applyComboPreset(key, cfg);
    assert.ok(!r.error, `${key}: ${r.error}`);
    assert.strictEqual(r.combos.length, 1);
    const cb = r.combos[0];
    assert.strictEqual(cb.behavior, "KEY_PRESS");
    assert.strictEqual(cb.action, api.COMBO_PRESETS[key].action);
    assert.ok(cb.key1.r !== cb.key2.r || cb.key1.c !== cb.key2.c);
    assert.strictEqual(cfg.layers[0][cb.key1.r][cb.key1.c].tap, api.COMBO_PRESETS[key].keys[0]);
    assert.strictEqual(cfg.layers[0][cb.key2.r][cb.key2.c].tap, api.COMBO_PRESETS[key].keys[1]);
    assert.strictEqual(cfg.combos.length, 0, "ändert die Config nicht");
    assert.ok(api.validateConfigShape({ ...cfg, combos: r.combos }) !== false);
  }
});

test("Combo-Vorlagen: Duplikat, volle Liste, fehlende Taste und ungültiger Schlüssel werden abgelehnt", () => {
  const cfg = presetConfig(PRESET_ALPHABET);
  const first = api.applyComboPreset("esc_jk", cfg);
  const dup = api.applyComboPreset("esc_jk", { ...cfg, combos: first.combos });
  assert.ok(dup.error && !dup.combos);
  // Dieselben Tasten mit anderer Aktion zählen auch als Duplikat
  const swapped = { ...cfg, combos: [{ ...first.combos[0], key1: first.combos[0].key2, key2: first.combos[0].key1, action: "KEY_A" }] };
  assert.ok(api.applyComboPreset("esc_jk", swapped).error);
  const full = Array.from({ length: 16 }, (_, i) => ({ id: `c${i}`, key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 }, action: "KEY_A" }));
  assert.ok(api.applyComboPreset("backspace_ui", { ...cfg, combos: full }).error);
  assert.ok(api.applyComboPreset("esc_jk", presetConfig(["KEY_J"])).error); // K fehlt
  const held = presetConfig(PRESET_ALPHABET);
  const pos = JSON.parse(JSON.stringify(first.combos[0].key1));
  held.layers[0][pos.r][pos.c].hold = "KEY_LEFT_CTRL";
  assert.ok(api.applyComboPreset("esc_jk", held).error);
  for (const bad of ["", "nope", "__proto__", "constructor", null, 3]) assert.ok(api.applyComboPreset(bad, cfg).error, String(bad));
});

test("Leader-Vorlagen: jede Vorlage ergibt auf leerer Liste eine gültige Sequenz", () => {
  const keys = Object.keys(api.LEADER_PRESETS);
  assert.ok(keys.length >= 4);
  for (const key of keys) {
    const empty = [];
    const r = api.applyLeaderPreset(key, empty);
    assert.ok(!r.error, key);
    assert.strictEqual(r.sequences.length, 1);
    assert.ok(api.isValidLeaderSequence(r.sequences[0]), key);
    assert.ok(!api.hasDuplicateLeaderSequence(r.sequences), key);
    assert.strictEqual(empty.length, 0);
  }
  const all = Object.keys(api.LEADER_PRESETS).reduce((list, key) => api.applyLeaderPreset(key, list).sequences, []);
  assert.strictEqual(all.length, Object.keys(api.LEADER_PRESETS).length);
});

test("Leader-Vorlagen: Duplikat, volle Liste und ungültiger Schlüssel werden abgelehnt", () => {
  const one = api.applyLeaderPreset("escape_e", []).sequences;
  assert.ok(api.applyLeaderPreset("escape_e", one).error);
  const full = Array.from({ length: api.MAX_LEADER_SEQS }, (_, i) => ({ keys: [PRESET_ALPHABET[i % 26], PRESET_ALPHABET[(i + 7) % 26]], action: "KEY_A" }));
  assert.ok(api.applyLeaderPreset("tab_t", full).error);
  for (const bad of ["", "nope", "__proto__", null, 3]) assert.ok(api.applyLeaderPreset(bad, []).error, String(bad));
  assert.ok(api.applyLeaderPreset("tab_t", null).error);
});

test("Combo- und Leader-Vorlagen: Auswahlfelder in index.html und Anwendung in der UI", () => {
  const html = read("index.html");
  assert.ok(html.includes('id="comboPresetSelect"') && html.includes('id="leaderPresetSelect"'));
  assert.ok(/applyComboPreset\(/.test(read("js/editor-events.js")) && read("js/editor-events.js").includes("snapshot: true"));
  assert.ok(/applyLeaderPreset\(/.test(read("js/leader-ui.js")) && read("js/leader-ui.js").includes("snapshot: true"));
});

test("Combo-Vorlagen: ein ungültiger Eintrag in der Liste wirft nicht", () => {
  const cfg = presetConfig(PRESET_ALPHABET);
  cfg.combos = [null, 5, "x"];
  const r = api.applyComboPreset("esc_jk", cfg);
  assert.ok(!r.error && r.combos.length === 4);
});

// Verhalten der UI-Funktionen mit Stubs: Einfügen, Undo und unveränderter Zustand bei Fehler
function presetUiContext(file, startMarker, endMarker, extra) {
  const calls = { toasts: [], pending: [], saved: 0 };
  const c = {
    calls, currentConfig: extra.config,
    showToast: m => calls.toasts.push(m), saveConfigToServer: () => { calls.saved++; },
    markPendingSync: ch => calls.pending.push(ch), renderLeaderSequences() {}, renderCombosTable() {}, renderMatrix() {},
    leaderCodeLabel: x => x,
    applyComboPreset: api.applyComboPreset, applyLeaderPreset: api.applyLeaderPreset, leaderSequenceLabel: api.leaderSequenceLabel
  };
  vm.createContext(c);
  vm.runInContext(section(file, startMarker, endMarker), c);
  return c;
}

test("Leader-Vorlage in der UI: Einfügen mit Undo, Fehler ändern nichts", () => {
  const u = presetUiContext("js/leader-ui.js", "// Legt eine Vorlage als neue Sequenz an", "function deleteLeaderSequence",
    { config: { leaderSequences: [] } });
  assert.strictEqual(u.applyLeaderPresetFromUI("tab_t"), true);
  assert.strictEqual(u.currentConfig.leaderSequences.length, 1);
  assert.strictEqual(u.calls.pending[0].snapshot, true);
  u.calls.pending[0].revert();
  assert.strictEqual(u.currentConfig.leaderSequences.length, 0);
  u.applyLeaderPresetFromUI("tab_t");
  const saved = u.calls.saved, pend = u.calls.pending.length;
  assert.strictEqual(u.applyLeaderPresetFromUI("tab_t"), false); // Duplikat
  assert.strictEqual(u.applyLeaderPresetFromUI("nope"), false);
  assert.strictEqual(u.currentConfig.leaderSequences.length, 1);
  assert.strictEqual(u.calls.saved, saved);
  assert.strictEqual(u.calls.pending.length, pend);
  assert.strictEqual(u.calls.toasts.length, 2);
});

test("Combo-Vorlage in der UI: Einfügen mit Undo, volle Liste ändert nichts", () => {
  const cfg = presetConfig(PRESET_ALPHABET);
  const u = presetUiContext("js/editor-events.js", "// Legt eine Vorlage als neue Combo an", "window.deleteCombo", { config: cfg });
  assert.strictEqual(u.applyComboPresetFromUI("esc_jk"), true);
  assert.strictEqual(u.currentConfig.combos.length, 1);
  assert.strictEqual(u.calls.pending[0].snapshot, true);
  u.calls.pending[0].revert();
  assert.strictEqual(u.currentConfig.combos.length, 0);
  u.currentConfig.combos = Array.from({ length: 16 }, (_, i) => ({ id: `c${i}`, key1: { r: 0, c: 0 }, key2: { r: 0, c: 1 }, action: "KEY_A" }));
  const pend = u.calls.pending.length, saved = u.calls.saved;
  assert.strictEqual(u.applyComboPresetFromUI("tab_df"), false);
  assert.strictEqual(u.currentConfig.combos.length, 16);
  assert.strictEqual(u.calls.pending.length, pend);
  assert.strictEqual(u.calls.saved, saved);
});

// -----------------------------------------------------------------------------
// Matrix-Diagnose und Löttester (TEST_MATRIX, MATRIX_RAW, js/diagnostics-ui.js)
// -----------------------------------------------------------------------------
test("parseMatrixRawLine: gültige Zeilen beider Hälften", () => {
  assert.deepStrictEqual({ ...api.parseMatrixRawLine("MATRIX_RAW:R,2,3,1") }, { side: "R", r: 2, c: 3, down: true });
  assert.deepStrictEqual({ ...api.parseMatrixRawLine("MATRIX_RAW:L,1,4,0") }, { side: "L", r: 1, c: 4, down: false });
  assert.deepStrictEqual({ ...api.parseMatrixRawLine("MATRIX_RAW:R,5,6,1\r") }, { side: "R", r: 5, c: 6, down: true });
});

test("parseMatrixRawLine: ungültige Zeilen ergeben null", () => {
  for (const bad of ["MATRIX_RAW:X,1,1,1", "MATRIX_RAW:R,6,0,1", "MATRIX_RAW:R,0,7,1", "MATRIX_RAW:R,1,1,2", "MATRIX_RAW:R,-1,1,1",
                     "MATRIX_RAW:R,1,1", "MATRIX_RAW:R,1,1,1,1", "MATRIX_RAW: R,1,1,1", "MATRIX:{\"r\":1,\"c\":1,\"pressed\":1}", "", null, undefined, 5]) {
    assert.strictEqual(api.parseMatrixRawLine(bad), null, String(bad));
  }
});

test("applyMatrixRaw: Druck markiert den Schalter und zählt, Loslassen löscht die Markierung", () => {
  const st = api.createMatrixRawState();
  assert.strictEqual(api.applyMatrixRaw(st, { side: "R", r: 2, c: 3, down: true }), true);
  assert.deepStrictEqual([...st.sides.R.down], ["2_3"]);
  assert.strictEqual(st.sides.R.presses.get("2_3"), 1);
  assert.strictEqual(api.applyMatrixRaw(st, { side: "R", r: 2, c: 3, down: false }), true);
  assert.strictEqual(st.sides.R.down.size, 0);
  assert.strictEqual(st.sides.R.presses.get("2_3"), 1);
  api.applyMatrixRaw(st, { side: "R", r: 2, c: 3, down: true });
  assert.strictEqual(st.sides.R.presses.get("2_3"), 2);
  assert.strictEqual(st.sides.R.total, 2);
});

test("applyMatrixRaw: beide Hälften getrennt, Duplikate und nicht verlötete Schalter ändern nichts", () => {
  const st = api.createMatrixRawState();
  api.applyMatrixRaw(st, { side: "L", r: 1, c: 4, down: true });
  api.applyMatrixRaw(st, { side: "R", r: 1, c: 4, down: true });
  assert.strictEqual(st.sides.L.total, 1);
  assert.strictEqual(st.sides.R.total, 1);
  // doppelt gemeldeter Druck zählt nicht erneut
  assert.strictEqual(api.applyMatrixRaw(st, { side: "L", r: 1, c: 4, down: true }), false);
  assert.strictEqual(st.sides.L.total, 1);
  // Loslassen ohne Druck
  assert.strictEqual(api.applyMatrixRaw(st, { side: "L", r: 0, c: 0, down: false }), false);
  // R4C5 existiert links nicht (R4C5 ist ein Config-Combo-Platz ohne Schalter), Spalte 6 in Fingerzeilen ebenfalls nicht
  assert.strictEqual(api.applyMatrixRaw(st, { side: "R", r: 0, c: 6, down: true }), false);
  assert.strictEqual(api.applyMatrixRaw(st, { side: "Q", r: 0, c: 0, down: true }), false);
  assert.strictEqual(api.applyMatrixRaw(null, { side: "R", r: 0, c: 0, down: true }), false);
});

test("resetMatrixRawState leert Markierungen und Zähler", () => {
  const st = api.createMatrixRawState();
  st.active = true;
  api.applyMatrixRaw(st, { side: "R", r: 0, c: 0, down: true });
  api.resetMatrixRawState(st);
  assert.strictEqual(st.sides.R.down.size, 0);
  assert.strictEqual(st.sides.R.presses.size, 0);
  assert.strictEqual(st.sides.R.total, 0);
  assert.strictEqual(st.active, true);
});

test("handleSerialLine: MATRIX_RAW aktualisiert nur bei laufendem Test, nur per Zeile (kein Tastendruck, kein Matrix-Test)", () => {
  const h = serialLineHarness();
  h.handle("MATRIX_RAW:R,2,3,1", "R", "usb");
  assert.strictEqual(h.rawState().R[2], 0, "ohne laufenden Test wird die Zeile verworfen");
  h.setRawActive(true);
  h.handle("MATRIX_RAW:R,2,3,1", "R", "usb");
  h.handle("MATRIX_RAW:L,1,4,1", "R", "usb");   // die Seite steht in der Zeile, nicht im Absender
  h.handle("MATRIX_RAW:L,1,4,0", "R", "usb");
  const st = h.rawState();
  assert.deepStrictEqual(st.R[0], ["2_3"]);
  assert.strictEqual(st.R[2], 1);
  assert.deepStrictEqual(st.L[0], []);
  assert.deepStrictEqual(st.L[1], [["1_4", 1]]);
  assert.strictEqual(h.calls.rawRendered, 3);
  // Der Matrix-Test (grün) und die Tastenzähler bleiben unberührt
  assert.deepStrictEqual(h.tested("R"), []);
  assert.strictEqual(h.calls.rendered, 0);
  assert.deepStrictEqual(h.calls.press, []);
  // Ungültige Zeilen ändern nichts
  h.handle("MATRIX_RAW:R,9,9,1", "R", "usb");
  assert.strictEqual(h.calls.rawRendered, 3);
});

test("handleSerialLine: ERR zu TEST_MATRIX und MATRIX_TEST:OFF beenden den Test in der App", () => {
  for (const line of ["ERR UNKNOWN TEST_MATRIX 1", "ERR FORBIDDEN TEST_MATRIX", "MATRIX_TEST:OFF"]) {
    const h = serialLineHarness();
    h.setRawActive(true);
    h.handle(line, "R", "usb");
    assert.strictEqual(h.rawState().active, false, line);
    assert.strictEqual(h.calls.rawRendered, 1, line);
  }
  // Ohne laufenden Test ändert die Zeile nichts
  const idle = serialLineHarness();
  idle.handle("MATRIX_TEST:OFF", "R", "usb");
  assert.strictEqual(idle.calls.rawRendered, 0);
});

test("handleSerialLine: MATRIX_RAW und MATRIX_TEST:OFF zählen nur über USB, nie über BLE", () => {
  const h = serialLineHarness();
  h.setRawActive(true);
  h.handle("MATRIX_RAW:R,2,3,1", "R", "ble");
  h.handle("MATRIX_TEST:OFF", "R", "ble");
  assert.strictEqual(h.rawState().R[2], 0);
  assert.strictEqual(h.rawState().active, true);
  h.handle("MATRIX_RAW:R,2,3,1", "R", "usb");
  assert.strictEqual(h.rawState().R[2], 1);
});

// diagnostics-ui.js mit Stubs: Start/Stopp sendet TEST_MATRIX 1/0 und braucht USB
function diagnosticsHarness(serialUp = true) {
  const sent = [];
  const s = { sent, toasts: [], document: { getElementById: () => null }, conn: { serialUp } };
  vm.createContext(s);
  vm.runInContext(`${code}
const SIDE_PROFILES_ = SIDE_PROFILES;
function connectionState() { return conn; }
function showToast(m) { toasts.push(m); }
function sendSerialCommand(c) { sent.push(c); return Promise.resolve(true); }
${read("js/diagnostics-ui.js")}
this.state = matrixRawState; this.start = startMatrixRawTest; this.stop = stopMatrixRawTest;`, s);
  return s;
}

asyncTests.push(["Matrix-Test starten sendet TEST_MATRIX 1, Stoppen sendet TEST_MATRIX 0", async () => {
  const d = diagnosticsHarness();
  assert.strictEqual(await d.start(), true);
  assert.deepStrictEqual([...d.sent], ["TEST_MATRIX 1"]);
  assert.strictEqual(d.state.active, true);
  api.applyMatrixRaw(d.state, { side: "R", r: 0, c: 0, down: true });
  await d.stop();
  assert.deepStrictEqual([...d.sent], ["TEST_MATRIX 1", "TEST_MATRIX 0"]);
  assert.strictEqual(d.state.active, false);
  // ein zweites Stoppen sendet nichts mehr
  await d.stop();
  assert.strictEqual(d.sent.length, 2);
}]);

asyncTests.push(["Matrix-Test ohne USB startet nicht (nie über Bluetooth)", async () => {
  const d = diagnosticsHarness(false);
  assert.strictEqual(await d.start(), false);
  assert.deepStrictEqual([...d.sent], []);
  assert.strictEqual(d.state.active, false);
  assert.strictEqual(d.toasts.length, 1);
}]);

asyncTests.push(["Matrix-Test: Trennen sendet TEST_MATRIX 0 vor dem Schließen, gezogenes Kabel sendet nichts", async () => {
  const d = diagnosticsHarness();
  await d.start();
  await d.stop(true);   // wie disconnectSerialNow bei offenem Port
  assert.deepStrictEqual([...d.sent], ["TEST_MATRIX 1", "TEST_MATRIX 0"]);
  const unplugged = diagnosticsHarness();
  await unplugged.start();
  unplugged.conn.serialUp = false;   // Kabel gezogen: kein Schreibzugriff mehr
  await unplugged.stop(true);
  assert.strictEqual(unplugged.state.active, false);
  assert.deepStrictEqual([...unplugged.sent], ["TEST_MATRIX 1"]);
}]);

asyncTests.push(["Matrix-Test: USB getrennt löst den Zustand ohne Befehl, Neustart leert die Zähler", async () => {
  const d = diagnosticsHarness();
  await d.start();
  api.applyMatrixRaw(d.state, { side: "L", r: 0, c: 0, down: true });
  await d.stop(false);
  assert.strictEqual(d.state.active, false);
  assert.deepStrictEqual([...d.sent], ["TEST_MATRIX 1"]);
  await d.start();
  assert.strictEqual(d.state.sides.L.total, 0);
}]);

test("index.html, Server und serial.js binden den Matrix-Test (Löttester) ein", () => {
  const html = read("index.html");
  for (const id of ["btnMatrixTest", "matrixRawHalves", "btnMatrixTestClear"]) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.includes("Matrix-Test (Löttester)"));
  assert.ok(html.indexOf("js/diagnostics-ui.js") > html.indexOf("js/serial.js") && html.indexOf("js/diagnostics-ui.js") < html.indexOf('src="app.js'));
  assert.ok(read("server.py").includes('"diagnostics-ui"'));
  assert.ok(read("app.js").includes("initDiagnosticsUI()"));
  // serial.js stoppt den Test beim Trennen der USB-Verbindung
  assert.ok(section("js/serial.js", "async function disconnectSerialNow", "// Serielle Schreibvorgänge").includes("await stopMatrixRawTest(true)"));
});

test("Chordal-Hold-Ausnahmen: Maske, Normalisierung, Config, GET_CONFIG-Zeile, Diff und Sync-Befehl", () => {
  // Bit (r * 7 + c): R0C1 = 2, R5C6 = Bit 41
  assert.strictEqual(api.chordalExNormalize(undefined), "0000000000000000");
  assert.strictEqual(api.chordalExNormalize("zz"), "0000000000000000");
  assert.strictEqual(api.chordalExNormalize("6"), "0000000000000006");
  assert.strictEqual(api.chordalExNormalize("FFFFFFFFFFFFFFFF"), "000003FFFFFFFFFF", "Bits außerhalb der 42 Tasten entfallen");
  assert.strictEqual(api.chordalExHas("2", 0, 1), true);
  assert.strictEqual(api.chordalExHas("2", 0, 0), false);
  assert.strictEqual(api.chordalExHas("2", 6, 0), false);
  let mask = api.chordalExSet("0", 2, 3, true);
  assert.strictEqual(mask, "0000000000020000"); // Bit 17 = 2 * 7 + 3
  assert.strictEqual(api.chordalExHas(mask, 2, 3), true);
  assert.strictEqual(api.chordalExSet(mask, 2, 3, false), "0000000000000000");
  assert.strictEqual(api.chordalExSet(mask, 9, 9, true), mask, "Position außerhalb der Matrix ändert nichts");
  assert.deepStrictEqual(Array.from(api.chordalExList(api.chordalExSet(api.chordalExSet("0", 0, 0, true), 5, 6, true))), ["R0C0", "R5C6"]);
  // Config: normalizeConfig übernimmt die Maske und bereinigt ungültige Werte
  const cfg = JSON.parse(JSON.stringify(api.normalizeConfig({ layers: [], settings: { chordalHoldExclusions: "6" } }, R)));
  assert.strictEqual(cfg.settings.chordalHoldExclusions, "0000000000000006");
  assert.strictEqual(api.normalizeConfig({ layers: [] }, R).settings.chordalHoldExclusions, "0000000000000000");
  // GET_CONFIG-Zeile CHORDAL_EX
  const snap = api.createDeviceSnapshot();
  assert.strictEqual(snap.chordalEx, null);
  assert.strictEqual(api.captureChordalExLine(snap, "CHORDAL_EX:0000000000000006"), true);
  assert.strictEqual(snap.chordalEx, "0000000000000006");
  assert.strictEqual(api.captureChordalExLine(snap, "CHORDAL_EX:nope"), true);
  assert.strictEqual(snap.chordalEx, null, "ungültige Zeile: nicht vergleichen");
  assert.strictEqual(api.captureChordalExLine(snap, "LAYER_NAMES:[]"), false);
  // Diff: nur mit CHORDAL_EX vom Gerät; nur physische Tasten
  const zero = Array.from({ length: 6 }, () => Array(7).fill(0));
  const full = api.createDeviceSnapshot();
  full.names = Array(8).fill("x");
  for (const f of ["tap", "hold", "dtap"]) for (let l = 0; l < 8; l++) full[f][l] = zero.map(r => r.slice());
  const local = JSON.parse(JSON.stringify(api.normalizeConfig({ layers: [], settings: { chordalHoldExclusions: "2" } }, R)));
  local.layers = Array.from({ length: 8 }, () => api.transparentLayer());
  assert.deepStrictEqual(Array.from(api.diffKeymap(local, full, R).chordal), [], "ohne CHORDAL_EX kein Vergleich");
  full.chordalEx = "0000000000000000";
  const diff = api.diffKeymap(local, full, R);
  assert.strictEqual(diff.chordal.length, 1);
  assert.strictEqual(diff.chordal[0].where, "Chordal-Hold-Ausnahme R0C1:");
  assert.strictEqual(diff.chordal[0].device, "nein");
  assert.strictEqual(diff.chordal[0].local, "ja");
  full.chordalEx = "0000000000000002";
  assert.strictEqual(api.diffKeymap(local, full, R).chordal.length, 0);
  // Laden vom Gerät übernimmt die Ausnahmen
  full.info = {};
  full.counts = { combos: 0, pairs: 0, macros: 0, overrides: null, leader: null, altrep: null };
  const built = api.buildConfigFromSnapshot(full, local, R);
  assert.strictEqual(built.config.settings.chordalHoldExclusions, "0000000000000002");
  // Voller Sync: SET_CHORDAL_EX nach SET_BOOT_LAYER, optional (ältere Firmware: ERR UNKNOWN)
  const sctx = { NUM_LAYERS: 8, NUM_ROWS: 6, NUM_COLS: 7, clampSetting: api.clampSetting, normalizeTriLayers: api.normalizeTriLayers, sanitizeCommandText: api.sanitizeCommandText, chordalExNormalize: api.chordalExNormalize };
  vm.createContext(sctx);
  vm.runInContext(`${section("js/config-sync.js", "// Einstellungs-Befehle des vollen Syncs", "// One-Shot-Auto-Sync")}
    this.build = buildSettingCommands;`, sctx);
  const cmds = JSON.parse(JSON.stringify(sctx.build({ chordalHoldExclusions: "6" }, R)));
  const idx = cmds.findIndex(c => c.ack === "SET_CHORDAL_EX");
  assert.ok(idx > 0 && cmds[idx].optional === true);
  assert.strictEqual(cmds[idx - 1].ack, "SET_BOOT_LAYER");
  assert.strictEqual(cmds[idx].cmd, "SET_CHORDAL_EX 0000000000000006");
  assert.strictEqual(cmds[idx + 1].ack, "CLEAR_TAP_TERMS");
  assert.strictEqual(JSON.parse(JSON.stringify(sctx.build({}, R)))[idx].cmd, "SET_CHORDAL_EX 0000000000000000");
  // Key-Inspector: Checkbox, Anzeige und Übernahme
  assert.ok(read("index.html").includes('id="keyChordalExCheckbox"') && read("index.html").includes("Chordal-Hold-Ausnahme"));
  assert.ok(read("js/editor.js").includes("chordalExHas(") && read("js/editor.js").includes("updateChordalExVisibility"));
  assert.ok(read("js/editor-events.js").includes("chordalExSet(oldChordalEx"));
});
