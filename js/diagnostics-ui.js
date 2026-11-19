// =============================================================================
// Matrix-Test (Löttester) im Diagnose-Panel: TEST_MATRIX 1|0 und MATRIX_RAW
// =============================================================================
// Die Firmware meldet jede Schalteränderung beider Hälften als MATRIX_RAW:<Seite>,<Zeile>,<Spalte>,<1|0>, nur über
// USB-Serial. Die Zeilen parst js/serial.js (handleSerialLine); der Zustand und das Raster liegen hier.

const matrixRawState = createMatrixRawState();

function renderMatrixRaw() {
  const halves = document.getElementById("matrixRawHalves");
  const total = document.getElementById("matrixRawTotal");
  const button = document.getElementById("btnMatrixTest");
  if (button) {
    button.textContent = matrixRawState.active ? "Test stoppen" : "Test starten";
    button.setAttribute("aria-pressed", matrixRawState.active ? "true" : "false");
  }
  if (!halves) return;
  halves.textContent = "";
  let presses = 0;
  for (const id of Dactyl.sidesInDisplayOrder()) {
    const profile = SIDE_PROFILES[id];
    const half = matrixRawState.sides[id];
    presses += half.total;
    const box = document.createElement("div");
    box.className = "matrix-raw-half";
    const title = document.createElement("h5");
    title.textContent = `${profile.label} (${half.total} Drücke)`;
    box.appendChild(title);
    const grid = document.createElement("div");
    grid.className = "matrix-raw-grid";
    grid.appendChild(document.createElement("span"));
    for (let c = 0; c < NUM_COLS; c++) {
      const head = document.createElement("span");
      head.className = "matrix-test-head";
      head.textContent = `C${c}`;
      grid.appendChild(head);
    }
    for (let r = 0; r < NUM_ROWS; r++) {
      const head = document.createElement("span");
      head.className = "matrix-test-head";
      head.textContent = `R${r}`;
      grid.appendChild(head);
      for (let c = 0; c < NUM_COLS; c++) {
        const cell = document.createElement("span");
        cell.className = "matrix-raw-cell";
        if (!isWiredSwitch(r, c, profile)) {
          cell.classList.add("is-absent");
        } else {
          const key = `${r}_${c}`;
          const count = half.presses.get(key) || 0;
          if (half.down.has(key)) cell.classList.add("is-down");
          cell.textContent = `R${r}C${c}`;
          const counter = document.createElement("span");
          counter.className = "matrix-raw-count";
          counter.textContent = String(count);
          cell.appendChild(counter);
          cell.title = `${profile.label} R${r}C${c}: ${count} Drücke`;
        }
        grid.appendChild(cell);
      }
    }
    box.appendChild(grid);
    halves.appendChild(box);
  }
  if (total) total.textContent = matrixRawState.active ? `${presses} Drücke gesamt` : "";
}

// Test starten: nur mit USB-Verbindung (MATRIX_RAW läuft nie über Bluetooth). Rückgabe: true = Befehl gesendet.
async function startMatrixRawTest() {
  if (!connectionState().serialUp) {
    showToast("Der Matrix-Test braucht eine USB-Verbindung zur Tastatur.");
    return false;
  }
  resetMatrixRawState(matrixRawState);
  matrixRawState.active = true;
  renderMatrixRaw();
  const sent = await sendSerialCommand("TEST_MATRIX 1");
  if (!sent) {
    matrixRawState.active = false;
    renderMatrixRaw();
  }
  return sent;
}

// Test beenden. notify = false: nur den Zustand lösen (USB getrennt, die Firmware beendet den Test dann selbst)
function stopMatrixRawTest(notify = true) {
  if (!matrixRawState.active) return Promise.resolve(false);
  matrixRawState.active = false;
  if (typeof document !== "undefined") renderMatrixRaw();
  return notify && connectionState().serialUp ? sendSerialCommand("TEST_MATRIX 0") : Promise.resolve(false);
}

function initDiagnosticsUI() {
  const button = document.getElementById("btnMatrixTest");
  if (button) {
    button.addEventListener("click", () => (matrixRawState.active ? stopMatrixRawTest() : startMatrixRawTest()));
  }
  const clear = document.getElementById("btnMatrixTestClear");
  if (clear) {
    clear.addEventListener("click", () => {
      resetMatrixRawState(matrixRawState);
      renderMatrixRaw();
    });
  }
  // Panel schließen beendet den Test
  const panel = document.getElementById("diagPanel");
  if (panel) {
    panel.addEventListener("toggle", () => {
      if (!panel.open) { stopMatrixRawTest(); stopComboStagger(); }
    });
  }
  renderMatrixRaw();
  initComboStagger();
}

// =============================================================================
// Signalstärke der Mac-Verbindung (BLE_RSSI:<dBm>): vier Balken im Diagnose-Panel
// =============================================================================
// Die Zeile kommt nur vom Master und nur über USB-Serial; endet die USB-Verbindung, gilt der Wert nicht mehr.
let bleRssiDbm = null;

function noteBleRssi(dbm) {
  if (dbm === undefined) return;
  bleRssiDbm = dbm;
  renderBleRssi();
}

function forgetBleRssi() {
  // Der Wert kommt nur über USB vom Master: er bleibt gültig, solange diese Verbindung besteht
  if (Dactyl.splitLinkStaysValid(connectionState())) return;
  bleRssiDbm = null;
  renderBleRssi();
}

function renderBleRssi() {
  const box = document.getElementById("bleRssiMeter");
  const text = document.getElementById("bleRssiText");
  if (!box || !text) return;
  const view = Dactyl.describeBleRssi(bleRssiDbm);
  box.title = view.title;
  box.dataset.level = view.level;
  box.querySelectorAll(".ble-rssi-bar").forEach((bar, i) => bar.classList.toggle("is-on", i < view.bars));
  text.textContent = view.text;
}

// =============================================================================
// Combo-Stagger-Assistent: misst die Spanne der Akkord-Tasten und schlägt comboTimeoutMs vor
// =============================================================================
// Die Druckzeiten kommen aus den MATRIX:-Zeilen (Scan-Zeit t der Firmware, nur USB) der bearbeiteten Hälfte. Die
// Rechnung liegt DOM-frei in js/config-model.js (computeComboStaggerSuggestion). Übernehmen trägt nur das Eingabefeld
// ein; gespeichert wird mit "Einstellungen in Config übernehmen".
const COMBO_STAGGER_MAX_SAMPLES = 5000;
const comboStagger = { recording: false, side: null, presses: [], result: null };

// bounced = true: ein geprellter Druck ist kein Tastendruck des Akkords (siehe recordMatrixBounce)
function feedComboStagger(side, evt, bounced = false, transport = "usb") {
  // MATRIX: kommt nur über USB; eine BLE-Zeile zählt nicht
  if (transport !== "usb") return;
  if (!comboStagger.recording || !evt.pressed || evt.t === undefined) return;
  if (side !== comboStagger.side) return;
  // Die bearbeitete Hälfte hat gewechselt: die Messung gehört nicht mehr zur Ansicht
  if (comboStagger.side !== editSide) { stopComboStagger(); return; }
  if (bounced) return;
  const presses = comboStagger.presses;
  // Die Scan-Zeit springt zurück, wenn die Firmware neu gestartet ist: alte und neue Zeiten passen nicht zusammen
  if (presses.length > 0 && evt.t < presses[presses.length - 1]) presses.length = 0;
  presses.push(evt.t);
  if (presses.length >= COMBO_STAGGER_MAX_SAMPLES) {
    comboStagger.recording = false;
    showToast("Die Combo-Messung ist voll und wurde beendet.");
    renderComboStagger();
    return;
  }
  // Während der Messung nur die Zahl zeigen; die Auswertung läuft beim Beenden (sonst Sortieren bei jedem Druck)
  renderComboStaggerCount();
}

// Messung beenden (Schließen des Panels, Seitenwechsel, USB getrennt) und auswerten
function stopComboStagger() {
  comboStagger.recording = false;
  renderComboStagger();
}

function renderComboStaggerCount() {
  const status = document.getElementById("comboStaggerStatus");
  if (status) status.textContent = `Messung läuft: ${comboStagger.presses.length} Drücke.`;
}

function renderComboStagger() {
  const toggle = document.getElementById("btnComboStagger");
  const apply = document.getElementById("btnComboStaggerApply");
  const status = document.getElementById("comboStaggerStatus");
  // Das Ergebnis hängt nicht vom DOM ab: applyComboStagger liest es auch ohne Panel
  comboStagger.result = computeComboStaggerSuggestion(comboStagger.presses);
  const r = comboStagger.result;
  if (!toggle || !status) return;
  toggle.textContent = comboStagger.recording ? "Messung beenden" : "Messung starten";
  toggle.setAttribute("aria-pressed", comboStagger.recording ? "true" : "false");
  if (apply) apply.disabled = comboStagger.recording || !r.enough;
  if (comboStagger.recording) status.textContent = `Messung läuft: ${comboStagger.presses.length} Drücke.`;
  else if (r.enough) status.textContent = `Vorschlag: ${r.comboTimeoutMs} ms (95. Perzentil der Spannen von ${r.chords} Akkorden).`;
  else status.textContent = `Zu wenig Daten: ${r.chords} von ${COMBO_STAGGER_MIN_CHORDS} Akkorden. Drücke Tasten einer Hälfte zusammen, mit Pause dazwischen.`;
}

function toggleComboStagger() {
  if (comboStagger.recording) {
    comboStagger.recording = false;
  } else {
    if (!connectionState().serialUp) {
      showToast("Die Combo-Messung braucht eine USB-Verbindung zur Tastatur.");
      return;
    }
    // MATRIX: kommt von der verbundenen Hälfte: gehört sie nicht zur bearbeiteten, kommt kein Druck an
    const wired = connectionState().serialSide;
    if (wired && wired !== editSide) {
      showToast("Die USB-Verbindung gehört zur anderen Hälfte. Wechsle die Hälfte oder verbinde die richtige.");
      return;
    }
    // Jede Messung beginnt leer: Scan-Zeiten verschiedener Verbindungen passen nicht zusammen
    comboStagger.presses = [];
    comboStagger.side = editSide;
    comboStagger.recording = true;
  }
  renderComboStagger();
}

// Trägt den Vorschlag in das Feld "Combo-Zeitfenster" ein. Rückgabe: true = eingetragen.
function applyComboStagger() {
  const r = comboStagger.result;
  if (!r || !r.enough || comboStagger.recording) return false;
  if (comboStagger.side !== editSide) {
    showToast("Die Messung gehört zur anderen Hälfte. Starte sie neu.");
    return false;
  }
  const input = document.getElementById("comboTimeoutInput");
  if (input) input.value = String(r.comboTimeoutMs);
  showToast(`Combo-Zeitfenster ${r.comboTimeoutMs} ms eingetragen. Mit "Einstellungen in Config übernehmen" speichern.`);
  return true;
}

function initComboStagger() {
  document.getElementById("btnComboStagger")?.addEventListener("click", toggleComboStagger);
  document.getElementById("btnComboStaggerApply")?.addEventListener("click", applyComboStagger);
  document.getElementById("btnComboStaggerReset")?.addEventListener("click", () => {
    comboStagger.presses = [];
    renderComboStagger();
  });
  renderComboStagger();
}
