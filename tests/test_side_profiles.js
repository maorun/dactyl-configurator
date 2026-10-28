// Unit-Tests für js/side-profiles.js, js/side-right.js, js/side-left.js und js/side-state.js:
// Profile gegen die Firmware-Quellen prüfen.
// Ausführen: node tests/test_side_profiles.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

const ctx = {};
vm.createContext(ctx);
vm.runInContext(read("js/side-profiles.js"), ctx);
vm.runInContext(read("js/side-right.js"), ctx);
vm.runInContext(read("js/side-left.js"), ctx);
vm.runInContext(read("js/side-state.js"), ctx);
vm.runInContext(read("js/side-routing.js"), ctx);
const D = ctx.Dactyl;
const { L, R } = D.SIDE_PROFILES;

const leftIno = read("firmware/dactyl_left/dactyl_left.ino");
const leftLogic = read("firmware/dactyl_left/DactylLeftLogic.h");
const rightIno = read("firmware/dactyl_right/dactyl_right.ino");
const logic = read("firmware/dactyl_right/DactylLogic.h");

// Tests laufen nacheinander; async-Tests werden abgewartet, ein Fehler beendet den Lauf mit Exit-Code 1
let passed = 0;
const queue = [];
function test(name, fn) {
  queue.push({ name, fn });
}
async function runAll() {
  for (const { name, fn } of queue) {
    await fn();
    passed++;
    console.log(`[       OK ] ${name}`);
  }
  console.log(`\n${passed} Seitenprofil-Tests bestanden.`);
}

const define = (src, name) => {
  const m = src.match(new RegExp(`#define ${name}\\s+(.+)`));
  assert.ok(m, `#define ${name} fehlt`);
  return m[1].trim().replace(/^"(.*)"$/, "$1");
};
const pins = (src, name) => src.match(new RegExp(name + "\\s*\\[[^\\]]*\\]\\s*=\\s*\\{([^}]*)\\}"))[1]
  .split(",").map(v => Number(v.trim()));

test("Links: Config-Combo, BLE-Name, Gerätename und Hälfte entsprechen dactyl_left.ino", () => {
  const combo = [
    { r: Number(define(leftIno, "CONFIG_COMBO_R1")), c: Number(define(leftIno, "CONFIG_COMBO_C1")) },
    { r: Number(define(leftIno, "CONFIG_COMBO_R2")), c: Number(define(leftIno, "CONFIG_COMBO_C2")) }
  ];
  assert.deepStrictEqual(JSON.parse(JSON.stringify(L.configCombo)), combo);
  assert.strictEqual(L.bleName, define(leftIno, "CONFIG_BLE_NAME"));
  assert.strictEqual(L.deviceName, define(leftIno, "DEFAULT_DEVICE_NAME"));
  assert.strictEqual(define(leftIno, "DEVICE_SIDE"), "L");
});

test("Rechts: Standard-Makros in DactylLogic.h entsprechen dem Profil", () => {
  const block = logic.slice(logic.indexOf("#ifndef CONFIG_COMBO_R1"), logic.indexOf("#endif", logic.indexOf("#ifndef CONFIG_COMBO_R1")));
  const combo = [
    { r: Number(define(block, "CONFIG_COMBO_R1")), c: Number(define(block, "CONFIG_COMBO_C1")) },
    { r: Number(define(block, "CONFIG_COMBO_R2")), c: Number(define(block, "CONFIG_COMBO_C2")) }
  ];
  assert.deepStrictEqual(JSON.parse(JSON.stringify(R.configCombo)), combo);
  assert.strictEqual(R.bleName, define(logic, "CONFIG_BLE_NAME"));
  assert.strictEqual(R.deviceName, define(logic, "DEFAULT_DEVICE_NAME"));
  assert.strictEqual(define(logic, "DEVICE_SIDE"), "R");
});

test("Leitungen: GPIOs entsprechen den Pin-Tabellen beider Firmwares", () => {
  assert.deepStrictEqual([...L.rowWires.map(w => w.gpio)], pins(leftLogic, "LEFT_ROW_PINS"));
  assert.deepStrictEqual([...L.colWires.map(w => w.gpio)], pins(leftLogic, "LEFT_COL_PINS"));
  assert.deepStrictEqual([...R.rowWires.map(w => w.gpio)], pins(rightIno, "ROW_PINS"));
  assert.deepStrictEqual([...R.colWires.map(w => w.gpio)], pins(rightIno, "COL_PINS"));
});

test("Fehlende Tasten: rechts R4C0/R5C5, links R4C5/R5C0", () => {
  assert.ok(!D.isPhysicalKey(R, 4, 0) && !D.isPhysicalKey(R, 5, 5));
  assert.ok(D.isPhysicalKey(R, 4, 5) && D.isPhysicalKey(R, 5, 0));
  assert.ok(!D.isPhysicalKey(L, 4, 5) && !D.isPhysicalKey(L, 5, 0));
  assert.ok(D.isPhysicalKey(L, 4, 0) && D.isPhysicalKey(L, 5, 5));
  assert.ok(!D.isPhysicalKey(null, 0, 0));
});

test("Verlötete Schalter: Spalte 6 nur im Daumen, ungültige Werte abgelehnt", () => {
  for (const p of [L, R]) {
    assert.ok(!D.isWiredSwitch(p, 0, 6));
    assert.ok(D.isWiredSwitch(p, 5, 6));
    assert.ok(!D.isWiredSwitch(p, 6, 0));
    assert.ok(!D.isWiredSwitch(p, -1, 0));
    assert.ok(!D.isWiredSwitch(p, 0, -1));
    assert.ok(!D.isWiredSwitch(p, "1", 1));
  }
});

test("Daumen-Cluster: 6 Tasten in Zeile 5 ohne fehlende Position, jede einmal", () => {
  for (const p of [L, R]) {
    const ids = p.thumbDefs.map(d => `${d.r}_${d.c}`);
    assert.strictEqual(ids.length, 6);
    assert.strictEqual(new Set(ids).size, 6);
    for (const d of p.thumbDefs) {
      assert.strictEqual(d.r, 5);
      assert.ok(D.isPhysicalKey(p, d.r, d.c), `${p.id} R${d.r}C${d.c}`);
    }
  }
});

test("Config-Combo-Tasten existieren physisch", () => {
  for (const p of [L, R]) {
    for (const k of p.configCombo) {
      assert.ok(D.isPhysicalKey(p, k.r, k.c));
      assert.ok(D.isConfigComboKey(p, k.r, k.c));
    }
  }
  assert.ok(!D.isConfigComboKey(L, 0, 0));
  assert.ok(!D.isConfigComboKey(R, 0, 5));
});

test("Hälfte aus dem BLE-Namen: nur 'Dactyl Config L' ist links", () => {
  assert.strictEqual(D.sideFromBleName("Dactyl Config L"), "L");
  assert.strictEqual(D.sideFromBleName("Dactyl Config"), "R");
  assert.strictEqual(D.sideFromBleName("Dactyl Keyboard"), "R");
  assert.strictEqual(D.sideFromBleName(""), "R");
  assert.strictEqual(D.sideFromBleName("Dactyl Config LX"), "R");
});

test("Hälfte aus DEVICE_INFO: fehlendes Feld ist rechts, Unbekanntes ist null", () => {
  assert.strictEqual(D.sideFromDeviceInfo({ side: "L" }), "L");
  assert.strictEqual(D.sideFromDeviceInfo({ side: "R" }), "R");
  assert.strictEqual(D.sideFromDeviceInfo({ name: "Dactyl Keyboard" }), "R");
  assert.strictEqual(D.sideFromDeviceInfo({ side: "X" }), null);
  assert.strictEqual(D.sideFromDeviceInfo({ side: "__proto__" }), null);
  assert.strictEqual(D.sideFromDeviceInfo(null), null);
  assert.strictEqual(D.sideFromDeviceInfo("L"), null);
});

// Firmware-Codes der linken Standard-Belegung in App-Codes übersetzen
const FW_TO_APP = {
  KEY_ESC: "KEY_ESC", KEY_TAB: "KEY_TAB", KEY_CAPS_LOCK: "KEY_CAPS_LOCK", KEY_LEFT_SHIFT: "KEY_LEFT_SHIFT",
  KEY_LEFT_CTRL: "KEY_LEFT_CTRL", KEY_LEFT_ALT: "KEY_LEFT_ALT", KEY_LEFT_GUI: "KEY_LEFT_GUI",
  KEY_BACKSPACE: "KEY_BACKSPACE", KEY_DELETE: "KEY_DELETE", ACT_MO_1: "MO_1", ACT_TG_0: "TG_0",
  "' '": "KEY_SPACE", "'`'": "KEY_GRAVE", "0": "NONE"
};
const fwToApp = tok => {
  if (FW_TO_APP[tok]) return FW_TO_APP[tok];
  let m = /^'([a-z0-9])'$/.exec(tok);
  if (m) return `KEY_${m[1].toUpperCase()}`;
  m = /^KEY_F(\d+)$/.exec(tok);
  if (m) return tok;
  throw new Error(`Unbekannter Firmware-Code ${tok}`);
};

test("Linke Standard-Belegung entspricht KEYMAP in dactyl_left.ino", () => {
  const block = leftIno.slice(leftIno.indexOf("// [[[START_KEYMAP]]]"), leftIno.indexOf("// [[[END_KEYMAP]]]"));
  const rows = [...block.matchAll(/^\s*\{\s*([^{}]+?)\s*\},?\s*$/gm)].map(m => m[1].split(",").map(t => t.trim()));
  assert.strictEqual(rows.length, 12); // Layer 0 und 1 mit je 6 Zeilen, Layer 2..7 leer
  const layers = L.defaultConfig.layers;
  rows.forEach((row, i) => {
    const l = Math.floor(i / 6), r = i % 6;
    assert.deepStrictEqual([...layers[l][r].map(k => k.tap)], row.map(fwToApp), `Layer ${l} Zeile ${r}`);
  });
  for (let l = 2; l < 8; l++) assert.ok(layers[l].every(row => row.every(k => k.tap === "NONE")));
});

test("Linke Standard-Belegung: fehlende Tasten tragen keine Aktion", () => {
  for (const layer of L.defaultConfig.layers) {
    assert.strictEqual(layer[4][5].tap, "NONE");
    assert.strictEqual(layer[5][0].tap, "NONE");
  }
});

test("default_config_left.json entspricht der linken Standard-Belegung im Profil", () => {
  const file = JSON.parse(read("default_config_left.json"));
  assert.deepStrictEqual(file.layers, JSON.parse(JSON.stringify(L.defaultConfig.layers)));
  assert.strictEqual(file.settings.deviceName, L.deviceName);
});

test("Makros: Repository-Firmware beider Hälften hat leere Makros wie die Default-Configs", () => {
  for (const [ino, json] of [["firmware/dactyl_left/dactyl_left.ino", "default_config_left.json"],
                             ["firmware/dactyl_right/dactyl_right.ino", "default_config.json"]]) {
    const block = /\/\/ \[\[\[START_MACROS\]\]\]([\s\S]*?)\/\/ \[\[\[END_MACROS\]\]\]/.exec(read(ino));
    assert.ok(block, `${ino}: MACROS-Marker fehlen`);
    assert.match(block[1], /uint8_t numMacros = 0;/);
    assert.strictEqual((JSON.parse(read(json)).macros || []).length, 0, json);
  }
  assert.deepStrictEqual(JSON.parse(JSON.stringify(L.defaultConfig.macros)), []);
});

test("Fehlende Tasten: links verboten (wie server.py), rechts nur für Combos", () => {
  const layer = () => Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => ({ tap: "NONE", hold: "NONE", dtap: "NONE" })));
  const l = layer();
  l[5][0] = { tap: "KEY_LEFT_GUI", hold: "NONE", dtap: "NONE" };
  assert.deepStrictEqual([...D.absentKeyViolations(L, { layers: [l] })], ["R5C0 (Ebene 0)"]);
  const h = layer();
  h[4][5] = { tap: "NONE", hold: "MO_1", dtap: "NONE" };
  assert.deepStrictEqual([...D.absentKeyViolations(L, { layers: [layer(), h] })], ["R4C5 (Ebene 1)"]);
  assert.deepStrictEqual([...D.absentKeyViolations(L, { layers: [[[], [], [], [], [], ["KEY_A"]]] })], ["R5C0 (Ebene 0)"]);
  // Rechte Vorlage: Aktion auf R5C5 bleibt erlaubt, wie validate_config für side=R
  const r = layer();
  r[5][5] = { tap: "KEY_BACKSPACE", hold: "NONE", dtap: "NONE" };
  assert.strictEqual(D.absentKeyViolations(R, { layers: [r] }).length, 0);
  const combo = (a, b) => ({ key1: a, key2: b });
  assert.deepStrictEqual([...D.absentKeyViolations(L, { layers: [], combos: [combo({ r: 0, c: 0 }, { r: 4, c: 5 })] })], ["Combo 1 (R4C5)"]);
  assert.deepStrictEqual([...D.absentKeyViolations(R, { layers: [], combos: [combo({ r: 4, c: 0 }, { r: 0, c: 0 })] })], ["Combo 1 (R4C0)"]);
  assert.strictEqual(D.absentKeyViolations(L, { layers: [], combos: [combo({ r: 4, c: 0 }, { r: 0, c: 0 })] }).length, 0);
  assert.strictEqual(D.absentKeyViolations(L, JSON.parse(read("default_config_left.json"))).length, 0);
  assert.strictEqual(D.absentKeyViolations(R, JSON.parse(read("default_config.json"))).length, 0);
  assert.strictEqual(D.absentKeyViolations(null, { layers: [l] }).length, 0);
});

test("Fehlende Tasten: gleiche Zellregeln wie cell_actions in server.py", () => {
  // Doppel-Tipp ohne Tap hat keine Wirkung (server.py: cell_actions gibt dann nur hold weiter)
  const at = cell => { const l = Array.from({ length: 6 }, () => Array(7).fill({ tap: "NONE" })); l[5] = [...l[5]]; l[5][0] = cell; return { layers: [l] }; };
  assert.strictEqual(D.absentKeyViolations(L, at({ tap: "NONE", hold: "NONE", dtap: "KEY_A" })).length, 0);
  assert.strictEqual(D.absentKeyViolations(L, at({ tap: "", dtap: "KEY_A" })).length, 0);
  assert.strictEqual(D.absentKeyViolations(L, at({ tap: "NONE", hold: "MO_1", dtap: "KEY_A" })).length, 1);
  assert.strictEqual(D.absentKeyViolations(L, at({ tap: "KEY_A", hold: "NONE", dtap: "NONE" })).length, 1);
  assert.strictEqual(D.absentKeyViolations(L, at({ tap: "KEY_A", dtap: 5 })).length, 1);
  assert.strictEqual(D.absentKeyViolations(L, at({ tap: 7, hold: "NONE" })).length, 0); // kein String = keine Aktion
  assert.strictEqual(D.absentKeyViolations(L, at("0")).length, 0);
  assert.strictEqual(D.absentKeyViolations(L, at("KEY_A")).length, 1);
  assert.strictEqual(D.absentKeyViolations(L, at(null)).length, 0);
  // Tap "0" ist in server.py ein Tap: dann zählen hold und dtap
  assert.strictEqual(D.absentKeyViolations(L, at({ tap: "0", dtap: "KEY_A" })).length, 1);
  assert.strictEqual(D.absentKeyViolations(L, at({ tap: "0", hold: "MO_1" })).length, 1);
  assert.strictEqual(D.absentKeyViolations(L, at({ tap: "0" })).length, 0);
  assert.strictEqual(D.absentKeyViolations(L, at({ hold: "KEY_A" })).length, 1); // fehlender Tap = "NONE"
  // Gegenprobe gegen den Server-Test: dieselben Fälle in tests/test_server.py (test_absent_key_cell_rules_match_app)
  assert.ok(read("tests/test_server.py").includes("test_absent_key_cell_rules_match_app"));
});

test("Layout-Presets und Scancode-Tabelle nur im rechten Profil", () => {
  assert.deepStrictEqual(Object.keys(R.presets), ["de_qwertz", "us_qwerty"]);
  assert.strictEqual(L.presets, null);
  assert.strictEqual(R.scancodeMap.KeyJ.r, 2);
  assert.strictEqual(L.scancodeMap, null);
  // Die Preset-Auswahl in index.html bietet genau die Presets des Profils an
  const html = read("index.html");
  const start = html.indexOf('<select id="layoutPresetSelect"');
  assert.ok(start >= 0, "layoutPresetSelect fehlt in index.html");
  const select = html.slice(start, html.indexOf("</select>", start));
  const options = [...select.matchAll(/<option value="([^"]+)">/g)].map(m => m[1]);
  assert.deepStrictEqual(options, Object.keys(R.presets));
});

test("Profile: Registrierung, Master, Ansicht und Export pro Hälfte", () => {
  assert.deepStrictEqual([...D.SIDE_IDS], ["R", "L"]);
  assert.strictEqual(D.getMasterSide(), "R");
  assert.strictEqual(R.master, true);
  assert.ok(!L.master);
  assert.deepStrictEqual([...D.sidesInDisplayOrder()], ["L", "R"]);
  assert.strictEqual(D.sideFromHandView("right"), "R");
  assert.strictEqual(D.sideFromHandView("left"), "L");
  assert.strictEqual(D.sideFromHandView("both"), null);
  // Knöpfe data-hand in index.html passen zu den Profilen
  const views = [...read("index.html").matchAll(/data-hand="([a-z]+)"/g)].map(m => m[1]);
  assert.deepStrictEqual(views.filter(v => v !== "both"), [R.handView, L.handView]);
  assert.deepStrictEqual([R.cssClass, L.cssClass], ["right-half", "left-half"]);
  assert.ok(read("style.css").includes(".right-half") && read("style.css").includes(".left-half"));
  assert.deepStrictEqual([R.exportPrefix, L.exportPrefix], ["", "left_"]);
  // Doppelte Hälfte und zweiter Master werden abgelehnt
  assert.throws(() => D.registerSideProfile({ id: "R" }), /doppeltes/);
  assert.throws(() => D.registerSideProfile({ id: "X", master: true }), /Master/);
  assert.ok(!D.SIDE_IDS.includes("X"));
});

test("Rechte Standard-Config: Preset Deutsch QWERTZ, zwei Combos, Name des Profils", () => {
  // Gleicher Inhalt, aber eigene Objekte: eine Änderung der Standard-Config ändert das Preset nicht
  assert.deepStrictEqual(R.defaultConfig.layers, R.presets.de_qwertz.layers);
  assert.notStrictEqual(R.defaultConfig.layers, R.presets.de_qwertz.layers);
  assert.notStrictEqual(R.defaultConfig.layers[0][0][0], R.presets.de_qwertz.layers[0][0][0]);
  assert.deepStrictEqual([...R.defaultConfig.combos.map(c => c.id)], ["combo-1", "combo-2"]);
  assert.strictEqual(R.defaultConfig.settings.deviceName, R.deviceName);
  assert.strictEqual(L.defaultConfig.settings.deviceName, L.deviceName);
});

test("Zustand pro Hälfte: getrennte Configs und Änderungen, nur bekannte Felder", () => {
  const store = D.createSideStore(["R", "L"], side => ({ config: { side } }));
  assert.strictEqual(store.get("L").config.side, "L");
  store.get("L").pendingChanges.push({ id: "a" });
  assert.strictEqual(store.get("R").pendingChanges.length, 0);
  assert.notStrictEqual(store.get("R").pendingChanges, store.get("L").pendingChanges);
  store.save("R", { config: { v: 2 }, unknown: 1, side: "L" });
  assert.strictEqual(store.get("R").config.v, 2);
  assert.strictEqual(store.get("R").side, "R");
  assert.ok(!("unknown" in store.get("R")));
  assert.ok(store.has("L") && !store.has("X") && !store.has("__proto__"));
  assert.throws(() => store.get("X"), /Unbekannte Tastaturhälfte/);
});

// -----------------------------------------------------------------------------
// js/side-routing.js: Befehle und Bestätigungen gehören zu einer Hälfte
// -----------------------------------------------------------------------------
const conn = (o) => Object.assign({ bleUp: false, bleSide: null, serialUp: false, serialSide: null }, o);

test("Routing: Befehle gehen nur an eine Verbindung der passenden Hälfte, BLE zuerst", () => {
  assert.strictEqual(D.routeCommand("L", conn({ bleUp: true, bleSide: "L" })), "ble");
  assert.strictEqual(D.routeCommand("R", conn({ bleUp: true, bleSide: "L" })), null);
  assert.strictEqual(D.routeCommand("L", conn({ serialUp: true, serialSide: "L" })), "usb");
  assert.strictEqual(D.routeCommand("L", conn({ serialUp: true, serialSide: null })), null); // Hälfte unbekannt
  assert.strictEqual(D.routeCommand("R", conn({ bleUp: true, bleSide: "L", serialUp: true, serialSide: "R" })), "usb");
  assert.strictEqual(D.routeCommand("L", conn({ bleUp: true, bleSide: "L", serialUp: true, serialSide: "L" })), "ble");
  assert.strictEqual(D.routeCommand(null, conn({ bleUp: true, bleSide: "L" })), null);
  assert.strictEqual(D.routeCommand("L", conn({ serialUp: false, serialSide: "L" })), null);
});

test("Routing: verbundene Hälfte bevorzugt BLE", () => {
  assert.strictEqual(D.connectedSide(conn({})), null);
  assert.strictEqual(D.connectedSide(conn({ bleUp: true, bleSide: "L", serialUp: true, serialSide: "R" })), "L");
  assert.strictEqual(D.connectedSide(conn({ serialUp: true, serialSide: "R" })), "R");
  assert.strictEqual(D.connectedSide(conn({ serialUp: true })), null);
});

test("USB trennen: ein laufender BLE-Sync derselben Hälfte bleibt bestehen", () => {
  assert.deepStrictEqual({ ...D.usbDisconnectAckScope(conn({ serialSide: "L" })) }, { reject: true, side: "L" });
  assert.deepStrictEqual({ ...D.usbDisconnectAckScope(conn({ serialSide: null })) }, { reject: true, side: null });
  assert.deepStrictEqual({ ...D.usbDisconnectAckScope(conn({ bleUp: true, bleSide: "L", serialSide: "L" })) }, { reject: false });
  assert.deepStrictEqual({ ...D.usbDisconnectAckScope(conn({ bleUp: true, bleSide: "L", serialSide: null })) }, { reject: false });
  assert.deepStrictEqual({ ...D.usbDisconnectAckScope(conn({ bleUp: true, bleSide: "L", serialSide: "R" })) }, { reject: true, side: "R" });
});

// Steuerbare Timer für die Bestätigungen
function fakeTimers() {
  let id = 0;
  const pending = new Map();
  return {
    set: (fn, ms) => { pending.set(++id, fn); return id; },
    clear: (i) => { pending.delete(i); },
    fireAll: () => { const fns = [...pending.values()]; pending.clear(); fns.forEach(f => f()); },
    count: () => pending.size
  };
}

test("Bestätigungen: Antwort der anderen Hälfte bestätigt nichts", async () => {
  const t = fakeTimers();
  const acks = D.createAckRegistry(t);
  const left = acks.wait("SAVE_NVS", 1000, "L");
  acks.resolveLine("OK SAVE_NVS", "R");          // rechte Hälfte über USB
  assert.strictEqual(acks.size(), 1);
  acks.resolveLine("OK SAVE_NVS", "L");
  assert.strictEqual(await left, true);
  assert.strictEqual(t.count(), 0);
  const any = acks.wait("SET_NAME 3", 1000, null);
  acks.resolveLine("ERR NVS SET_NAME 3", "R");   // Bestätigung ohne Hälfte nimmt jede Antwort
  assert.strictEqual(await any, false);
  const unknownLine = acks.wait("ADD_PAIR", 1000, "L");
  acks.resolveLine("OK ADD_PAIR 0", null);       // Zeile ohne bekannte Hälfte (USB vor DEVICE_INFO)
  assert.strictEqual(await unknownLine, true);
  acks.resolveLine("STATUS: ok", "L");           // keine OK/ERR-Zeile
});

test("Bestätigungen: Verwerfen pro Hälfte und Timeout", async () => {
  const t = fakeTimers();
  const acks = D.createAckRegistry(t);
  const l = acks.wait("SAVE_NVS", 1000, "L");
  const r = acks.wait("SAVE_NVS", 1000, "R");
  const n = acks.wait("EXIT_CONFIG", 1000, null);
  acks.reject("USB getrennt", "R");
  assert.strictEqual(await r, false);
  assert.strictEqual(await n, false);            // ohne Hälfte: wird mit verworfen
  assert.strictEqual(acks.size(), 1);
  t.fireAll();
  assert.strictEqual(await l, null);             // Timeout
  assert.strictEqual(acks.size(), 0);
});

test("GET_INFO-Wiederholung: bis die Hälfte bekannt ist, höchstens bis zum Timeout", () => {
  const t = fakeTimers();
  let sent = 0;
  let side = null;
  D.retryUntil(() => side !== null, () => sent++, 500, 5000, t);
  assert.strictEqual(sent, 1);                   // erster Versuch sofort
  t.fireAll();
  t.fireAll();
  assert.strictEqual(sent, 3);
  side = "L";
  t.fireAll();
  assert.strictEqual(sent, 3);                   // DEVICE_INFO kam: keine weitere Anfrage
  assert.strictEqual(t.count(), 0);
  sent = 0;
  D.retryUntil(() => false, () => sent++, 500, 5000, t);
  for (let i = 0; i < 20; i++) t.fireAll();
  assert.strictEqual(sent, 11);                  // 0 .. 5000 ms in 500-ms-Schritten
  sent = 0;
  const stop = D.retryUntil(() => false, () => sent++, 500, 5000, t);
  stop();
  t.fireAll();
  assert.strictEqual(sent, 1);
  assert.strictEqual(t.count(), 0);
});

test("Split-Diagnose: SPLIT_KEY vom Master gehört zur linken Hälfte", () => {
  assert.strictEqual(D.getSplitSenderSide(), "L");
  const evt = D.parseSplitKeyLine('SPLIT_KEY:{"r":5,"c":6,"pressed":1,"layer":2}', "R");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(evt)), { side: "L", r: 5, c: 6, pressed: true, layer: 2 });
  const up = D.parseSplitKeyLine('SPLIT_KEY:{"r":0,"c":5,"pressed":0,"layer":0}', "R");
  assert.strictEqual(up.pressed, false);
});

test("Split-Diagnose: SPLIT_KEY von der linken Hälfte, fehlende Tasten und ungültige Werte werden verworfen", () => {
  const ok = '{"r":1,"c":1,"pressed":1,"layer":0}';
  assert.strictEqual(D.parseSplitKeyLine(`SPLIT_KEY:${ok}`, "L"), null); // nur der Master empfängt ESP-NOW
  assert.strictEqual(D.parseSplitKeyLine(`KEY_PRESS:${ok}`, "R"), null);
  assert.strictEqual(D.parseSplitKeyLine('SPLIT_KEY:{"r":4,"c":5,"pressed":1,"layer":0}', "R"), null); // fehlt links
  assert.strictEqual(D.parseSplitKeyLine('SPLIT_KEY:{"r":5,"c":0,"pressed":1,"layer":0}', "R"), null); // fehlt links
  assert.strictEqual(D.parseSplitKeyLine('SPLIT_KEY:{"r":0,"c":6,"pressed":1,"layer":0}', "R"), null); // C6 nur Daumen
  assert.strictEqual(D.parseSplitKeyLine('SPLIT_KEY:{"r":1,"c":1,"pressed":1,"layer":8}', "R"), null);
  assert.strictEqual(D.parseSplitKeyLine('SPLIT_KEY:{"r":1,"c":1,"pressed":2,"layer":0}', "R"), null);
  assert.strictEqual(D.parseSplitKeyLine('SPLIT_KEY:{"r":1,"c":1}', "R"), null);
  assert.strictEqual(D.parseSplitKeyLine("SPLIT_KEY:kaputt", "R"), null);
  assert.strictEqual(D.parseSplitKeyLine("SPLIT_KEY:null", "R"), null);
});

test("Split-Diagnose: eine Taste ohne SPLIT_KEY-Release gilt nach dem Timeout als losgelassen", () => {
  const pending = new Map();
  let nextId = 1;
  const timers = {
    set: (fn, ms) => { const id = nextId++; pending.set(id, { fn, ms }); return id; },
    clear: id => pending.delete(id)
  };
  const stale = [];
  const tr = D.createSplitKeyTracker(id => stale.push(id), 5000, timers);
  tr.press("L_1_1");
  tr.press("L_2_2");
  assert.strictEqual(tr.size(), 2);
  // Normales Release: kein Timeout mehr
  assert.strictEqual(tr.release("L_1_1"), true);
  assert.strictEqual(tr.release("L_1_1"), false);
  // Erneuter Druck ersetzt den alten Timer
  tr.press("L_2_2");
  assert.strictEqual(pending.size, 1);
  const [{ fn, ms }] = pending.values();
  assert.strictEqual(ms, 5000);
  fn();
  assert.deepStrictEqual(stale, ["L_2_2"]);
  assert.strictEqual(tr.size(), 0);
  assert.strictEqual(D.SPLIT_KEY_STALE_MS, 5000);
});

test("Split-Diagnose: Bitlayout von splitKeyEventCode und SPLIT_KEY-Ausgabe passen zur App", () => {
  const hid = read("firmware/dactyl_right/DactylSplitHid.h");
  assert.match(hid, /SPLIT_OP_KEY_EVENT = 13,/);
  assert.match(hid, /#define SPLIT_KEY_EVENT_ROWS 6/);
  assert.match(hid, /#define SPLIT_KEY_EVENT_COLS 7/);
  assert.match(rightIno, /SPLIT_KEY:\{\\"r\\":%u,\\"c\\":%u,\\"pressed\\":%d,\\"layer\\":%u\}/);
  // Die Einreih-Bedingung (Link, Warteschlangen-Grenze, Zählung) liegt in queueKeyEventDiagnostic
  // (DactylLeftLogic.h, Host-Test test_key_event_diagnostic_needs_link_and_counts_drops)
  assert.match(leftIno, /queueKeyEventDiagnostic\(sendQueue, bleKeyboard\.isConnected\(\), makeSplitHidEvent\(SPLIT_OP_KEY_EVENT/);
});

test("Links: Standby ändert den CPU-Takt nicht (Taktwechsel bei laufendem Wi-Fi stört ESP-NOW)", () => {
  // Hardware-Befund: nach setCpuFrequencyMhz() scheiterte jeder Versand bis zum ESPNOW_RESTART,
  // die ersten Tasten nach dem Aufwachen gingen verloren
  for (const fn of ["enterStandby", "exitStandby"]) {
    const m = leftIno.match(new RegExp(`void ${fn}\\(\\) \\{([\\s\\S]*?)\\n\\}`));
    assert.ok(m, `${fn}() fehlt in dactyl_left.ino`);
    assert.doesNotMatch(m[1], /setCpuFrequencyMhz/, `${fn}() darf den CPU-Takt nicht ändern`);
  }
});

test("Standby-Hinweise: pro Hälfte passend zum CPU-Takt der Firmware", () => {
  // Rechts drosselt enterStandby() auf 80 MHz, links bleibt der Takt (Test oben)
  const rightStandby = rightIno.match(/void enterStandby\(\) \{([\s\S]*?)\n\}/);
  assert.ok(rightStandby && /setCpuFrequencyMhz\(80\)/.test(rightStandby[1]), "rechts: enterStandby() drosselt nicht auf 80 MHz");
  assert.match(R.standbyHint, /80 MHz/);
  // Die mA-Werte sind Datenblattwerte der CPU ohne Funk und tragen diesen Vorbehalt in App und README
  assert.match(R.standbyHint, /CPU ohne Funk/);
  assert.match(R.standbyHint, /nicht gemessen/);
  assert.match(read("README.md"), /Datenblattwerte gelten für die CPU \*\*ohne Funk\*\*/);
  assert.match(L.standbyHint, /240 MHz/);
  assert.doesNotMatch(L.standbyHint, /80 MHz|70\s?%/);
  // Kein fester Text für beide Hälften im HTML; updateSideLabels setzt den Hinweis aus dem Profil
  const html = read("index.html");
  const hint = html.match(/<small[^>]*id="standbyTimeoutHint"[^>]*>([^<]*)<\/small>/);
  assert.ok(hint, "standbyTimeoutHint fehlt");
  assert.doesNotMatch(hint[1], /80 MHz|70\s?%/);
  // updateSideLabels aus js/editor.js mit DOM-Stub ausführen: der Hinweis folgt der bearbeiteten Hälfte
  const editor = read("js/editor.js");
  const fn = editor.slice(editor.indexOf("function updateSideLabels"), editor.indexOf("function renderMatrix"));
  const els = {};
  const ui = { SIDE_PROFILES: D.SIDE_PROFILES, side: "R",
    document: { getElementById: id => (els[id] = els[id] || { textContent: "", title: "", disabled: false }) } };
  vm.createContext(ui);
  vm.runInContext(`function activeProfile() { return SIDE_PROFILES[side]; }\n${fn}\nthis.update = updateSideLabels;`, ui);
  ui.update();
  assert.strictEqual(els.standbyTimeoutHint.textContent, `${R.label}: ${R.standbyHint}`);
  ui.side = "L";
  ui.update();
  assert.strictEqual(els.standbyTimeoutHint.textContent, `${L.label}: ${L.standbyHint}`);
  // README und Diagramm nennen 80 MHz nur für die rechte Hälfte
  const readme = read("README.md");
  assert.doesNotMatch(readme, /Spart ca\. 70% Energie/);
  assert.doesNotMatch(readme, /weckt die CPU sofort wieder auf 240 MHz/);
  const svg = read("docs/lolin32_lite_wiring.svg");
  assert.doesNotMatch(svg, /80 MHz Standby/);
  assert.match(svg, /rechts 80 MHz, links 240 MHz/);
});

test("ESP-NOW: beide Hälften verschlüsseln die Strecke mit dem nicht versionierten Schlüssel", () => {
  for (const [label, ino, setup] of [["links", leftIno, "static bool setupEspNow()"],
                                     ["rechts", rightIno, "void setupSplitReceiver()"]]) {
    assert.match(ino, /#include "(\.\.\/dactyl_right\/)?DactylSplitCrypto\.h"/, `${label}: DactylSplitCrypto.h fehlt`);
    const start = ino.indexOf(setup);
    assert.ok(start >= 0, `${label}: ${setup} fehlt`);
    const body = ino.slice(start, ino.indexOf("\n}\n", start));
    assert.doesNotMatch(body, /\.encrypt\s*=\s*false/, `${label}: unverschlüsselter Peer`);
    const pmk = body.indexOf("esp_now_set_pmk(SPLIT_ESPNOW_PMK)");
    const enc = body.indexOf("splitPeerSetEncryption(peer.encrypt, peer.lmk)");
    const add = body.indexOf("esp_now_add_peer(&peer)");
    assert.ok(pmk >= 0 && enc >= 0 && add >= 0, `${label}: PMK, LMK oder Peer fehlt`);
    assert.ok(pmk < add && enc < add, `${label}: PMK und LMK müssen vor esp_now_add_peer gesetzt sein`);
  }
  // Ohne verschlüsselten Peer verarbeitet der Master keine Pakete von links
  const right = rightIno.slice(rightIno.indexOf("void setupSplitReceiver()"));
  assert.ok(right.indexOf("splitRxReady = true") > right.indexOf("esp_now_add_peer(&peer)"),
    "rechts: splitRxReady erst nach dem verschlüsselten Peer");
  const crypto = read("firmware/dactyl_right/DactylSplitCrypto.h");
  assert.match(crypto, /#error "ESP-NOW-Schlüssel fehlt/);
  // Das Muster deckt auch die Temp-Datei von generate-split-key.sh (DactylSplitKey.h.XXXXXX) ab
  assert.match(read(".gitignore"), /^firmware\/dactyl_right\/DactylSplitKey\.h\*$/m);
  assert.match(read("scripts/generate-split-key.sh"), /mktemp "\$KEY_FILE\.XXXXXX"/);
  // Ohne ESP-NOW beim Start sendet links nichts: begrenzte Board-Neustarts (espNowBootRetryAllowed, Host-Test
  // test_espnow_boot_retry_stops_after_limit), danach ohne Funk weiter
  const leftSetup = leftIno.slice(leftIno.indexOf("void setup()"));
  const boot = leftSetup.match(/if \(setupEspNow\(\)\) \{([\s\S]*?)\} else if \(espNowBootRetryAllowed\(rtcEspNowBootRetry, resetReason == ESP_RST_SW\)\) \{([\s\S]*?)\} else \{([\s\S]*?)\n    \}/);
  assert.ok(boot, "links: Rückgabe von setupEspNow() beim Start prüfen");
  assert.match(boot[1], /rtcEspNowBootRetry = 0;/, "links: Erfolg setzt den Zähler zurück");
  assert.match(boot[2], /ESP\.restart\(\);/, "links: begrenzter Neustart fehlt");
  assert.match(boot[3], /wiederholt fehlgeschlagen/);
  assert.doesNotMatch(boot[3], /ESP\.restart/, "links: nach der Grenze kein Neustart");
  // Config Mode (Software-Reset hinein und hinaus) verbraucht keinen Versuch
  assert.match(leftSetup, /if \(isConfigMode\) \{[^}]*rtcEspNowBootRetry = 0;[^}]*startConfigModeBle\(\);/,
    "links: Config Mode setzt den Neustart-Zähler zurück");
  // Rechts: jeder Fehler nach esp_now_init beendet ESP-NOW, damit kein Paket in den Ring kommt. Jeder Fehlerzweig
  // beginnt mit einer [SPLIT] ERR-Zeile und endet mit return.
  const rightBody = right.slice(0, right.indexOf("\n}\n"));
  // Ohne erfolgreiches esp_now_init gibt es nichts zu beenden: erst die Zweige danach prüfen
  const afterInit = rightBody.slice(rightBody.indexOf("ERR ESPNOW_INIT") + "ERR ESPNOW_INIT".length);
  const branches = [...afterInit.matchAll(/Serial\.println\("\[SPLIT\] (ERR [A-Z_]+)[^"]*"\);([\s\S]*?)return;/g)];
  assert.deepStrictEqual(branches.map(b => b[1]), ["ERR ESPNOW_RECV_CB", "ERR ESPNOW_PMK", "ERR ESPNOW_PEER"],
    "rechts: Fehlerzweige nach esp_now_init");
  for (const [, marker, body] of branches) {
    assert.match(body, /esp_now_deinit\(\);/, `rechts: ${marker} ohne esp_now_deinit`);
  }
  const ci = read(".github/workflows/tests.yml");
  assert.ok(ci.indexOf("bash scripts/generate-split-key.sh") >= 0
    && ci.indexOf("bash scripts/generate-split-key.sh") < ci.indexOf("arduino-cli compile"),
    "CI: Schlüssel vor dem Compile erzeugen");
});

test("README: Aktionscode-Tabelle nennt den Makro-Bereich", () => {
  const common = read("firmware/dactyl_right/DactylCommon.h");
  assert.match(common, /#define ACT_MACRO_BASE\s+0x170/);
  assert.match(read("README.md"), /\| `0x170` \.\. `0x17F` \| Makro \|/);
});

runAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
