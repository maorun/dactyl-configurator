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
      if (!panel.open) stopMatrixRawTest();
    });
  }
  renderMatrixRaw();
}
