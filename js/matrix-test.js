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
