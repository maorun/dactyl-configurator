// =============================================================================
// Matrix-Test (Löt- und Dioden-Tester)
// =============================================================================

function wireLabel(kind, index, profile = activeProfile()) {
  const wire = (kind === "row" ? profile.rowWires : profile.colWires)[index];
  return `${kind === "row" ? "Row" : "Col"} ${index} (GPIO ${wire.gpio}, ${wire.color})`;
}

function renderMatrixTest() {
  const grid = document.getElementById("matrixTestGrid");
  const progress = document.getElementById("matrixTestProgress");
  const suspects = document.getElementById("matrixTestSuspects");
  if (!grid || !progress || !suspects) return;
  const matrixTest = matrixTestFor(editSide);
  const profile = activeProfile();

  grid.innerHTML = "";
  grid.appendChild(document.createElement("span"));
  for (let c = 0; c < NUM_COLS; c++) {
    const head = document.createElement("span");
    head.className = "matrix-test-head";
    head.textContent = `C${c}`;
    head.title = wireLabel("col", c);
    grid.appendChild(head);
  }
  for (let r = 0; r < NUM_ROWS; r++) {
    const head = document.createElement("span");
    head.className = "matrix-test-head";
    head.textContent = `R${r}`;
    head.title = wireLabel("row", r);
    grid.appendChild(head);
    for (let c = 0; c < NUM_COLS; c++) {
      const cell = document.createElement("span");
      cell.className = "matrix-test-cell";
      if (!isWiredSwitch(r, c, profile)) {
        cell.classList.add("is-absent");
      } else {
        cell.textContent = `R${r}C${c}`;
        if (matrixTest.tested.has(`${r}_${c}`)) cell.classList.add("is-ok");
        const bounces = matrixTest.bounces.get(`${r}_${c}`);
        if (bounces) {
          cell.classList.add("is-bouncing");
          cell.title = `Prellt: ${bounces}× ein Druck innerhalb von ${MATRIX_BOUNCE_MS} ms nach dem Loslassen`;
        }
      }
      grid.appendChild(cell);
    }
  }

  const summary = summarizeMatrixTest(matrixTest);
  progress.textContent = `${summary.tested} / ${summary.total}`;
  suspects.innerHTML = "";
  const lines = [
    ...summary.suspectRows.map(r => wireLabel("row", r)),
    ...summary.suspectCols.map(c => wireLabel("col", c))
  ];
  if (summary.tested === summary.total) {
    suspects.textContent = "✅ Alle Tasten erkannt.";
  } else if (lines.length) {
    const title = document.createElement("strong");
    title.textContent = "⚠️ Noch keine Taste erkannt auf:";
    suspects.appendChild(title);
    const list = document.createElement("ul");
    lines.forEach(text => {
      const li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });
    suspects.appendChild(list);
  }
  renderMatrixBounceHint(summary.bouncingKeys);
}

// Hinweis auf prellende Tasten: Entprellzeit der bearbeiteten Hälfte erhöhen (Einstellung debounceMs)
function renderMatrixBounceHint(bouncingKeys) {
  const hint = document.getElementById("matrixTestBounce");
  if (!hint) return;
  hint.innerHTML = "";
  if (!bouncingKeys.length) return;
  const settings = configFor(editSide).settings || {};
  const current = settings.debounceMs ?? SETTINGS_RANGES.debounceMs[2];
  const title = document.createElement("strong");
  title.textContent = "⚠️ Prellende Tasten:";
  hint.appendChild(title);
  const list = document.createElement("ul");
  bouncingKeys.forEach(({ r, c, count }) => {
    const li = document.createElement("li");
    li.textContent = `R${r}C${c} (${count}× innerhalb von ${MATRIX_BOUNCE_MS} ms nach dem Loslassen)`;
    list.appendChild(li);
  });
  hint.appendChild(list);
  const advice = document.createElement("p");
  advice.className = "form-hint";
  // Die Firmware entprellt über das Scan-Intervall: ab einer Entprellzeit von MATRIX_BOUNCE_MS ms kann der
  // Test kein Prellen mehr sehen. Meldet er es trotzdem, gilt die App-Einstellung nicht auf der Tastatur
  // (nicht übertragen) oder der Schalter ist defekt.
  advice.textContent = current < MATRIX_BOUNCE_MS
    ? `Erhöhe die Entprellzeit im Tab "Firmware & Device" auf mindestens ${MATRIX_BOUNCE_MS} ms (aktuell ${current} ms).`
    : `Die Entprellzeit der App steht schon auf ${current} ms. Übertrage die Einstellung auf die Tastatur und prüfe den Schalter und die Lötstelle.`;
  hint.appendChild(advice);
}

function initMatrixTestUI() {
  const reset = document.getElementById("btnResetMatrixTest");
  if (reset) {
    reset.addEventListener("click", () => {
      sideStore.save(editSide, { matrixTest: createMatrixTest(activeProfile()) });
      renderMatrixTest();
    });
  }
  renderMatrixTest();
}
