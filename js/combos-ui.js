// =============================================================================
// Hälften-Combos: eine Taste je Hälfte (side1/side2), beide Hälften führen denselben Eintrag
// =============================================================================

// Die Hälfte, die nicht bearbeitet wird (das Gegenstück der bearbeiteten Hälfte)
function otherComboSide() {
  return Dactyl.SIDE_IDS.find(id => id !== editSide) || null;
}

function comboBilateralChecked() {
  const box = document.getElementById("comboBilateralCheck");
  return !!box && box.checked;
}

// Beschriftung einer Taste aus Ebene 0 der Config der Hälfte
function comboKeyLabelOnSide(side, r, c) {
  const layer = configFor(side).layers[0];
  const cell = layer && layer[r] && layer[r][c];
  return cell && cell.label ? cell.label : `R${r}C${c}`;
}

// Taste 2 listet die Tasten der gewählten Hälfte: der anderen bei einer Hälften-Combo, sonst der bearbeiteten
function fillComboKey2Options(side) {
  const select = document.getElementById("comboKey2Select");
  if (!select) return;
  select.innerHTML = "";
  const profile = SIDE_PROFILES[side];
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      if (!isPhysicalKey(r, c, profile)) continue;
      const opt = document.createElement("option");
      opt.value = `${r},${c}`;
      opt.textContent = `[R${r}, C${c}] ${comboKeyLabelOnSide(side, r, c)} ${r === 5 ? "(Daumen)" : ""}`;
      select.appendChild(opt);
    }
  }
  select.value = "2,2";
}

// Dritte Taste und Tastenaufnahme gelten nur für Combos auf einer Hälfte
function updateComboBilateralControls() {
  const bilateral = comboBilateralChecked();
  const other = otherComboSide();
  fillComboKey2Options(bilateral && other ? other : editSide);
  const key3 = document.getElementById("comboKey3Select");
  const capture = document.getElementById("btnCaptureComboKeys");
  if (key3) {
    if (bilateral) key3.value = "";
    key3.disabled = bilateral;
  }
  if (capture) {
    if (bilateral && typeof stopKeyCapture === "function") stopKeyCapture();
    capture.disabled = bilateral;
  }
  const label = document.getElementById("comboKey2SideLabel");
  if (label) label.textContent = bilateral && other ? ` (${SIDE_PROFILES[other].label})` : "";
}

// Dialog öffnen: Standard ist eine Combo auf einer Hälfte
function resetComboBilateralUI() {
  const box = document.getElementById("comboBilateralCheck");
  if (!box) return;
  box.checked = false;
  box.disabled = !otherComboSide();
  updateComboBilateralControls();
}

// Grund, warum die Hälften-Combo nicht gespeichert werden kann, sonst null
function bilateralComboBlockReason() {
  const other = otherComboSide();
  if (!other) return "Es gibt keine zweite Hälfte.";
  if (configFor(other).combos.length >= MAX_COMBOS) {
    return `Maximal ${MAX_COMBOS} Combos je Hälfte: ${SIDE_PROFILES[other].label} ist voll.`;
  }
  return null;
}

// Felder einer neuen Hälften-Combo: Taste 1 auf der bearbeiteten, Taste 2 auf der anderen Hälfte
function bilateralComboFields() {
  return { side1: editSide, side2: otherComboSide() };
}

// Spiegelt eine Hälften-Combo in die andere Hälfte (gleiche id, gleicher Name). Liefert eine Funktion, die sie dort entfernt.
function mirrorBilateralCombo(combo, title) {
  const other = comboIsBilateral(combo) ? Dactyl.SIDE_IDS.find(id => id !== editSide) : null;
  if (!other) return null;
  const cfg = configFor(other);
  const copy = JSON.parse(JSON.stringify(combo));
  cfg.combos = cfg.combos.filter(c => c.id !== copy.id).concat([copy]);
  saveConfigToServer(other);
  const undo = () => {
    configFor(other).combos = configFor(other).combos.filter(c => c.id !== copy.id);
    saveConfigToServer(other);
  };
  markPendingSync({
    type: "combo_add",
    title: title || "Hälften-Combo gespiegelt",
    description: copy.name,
    sideRevert: true,
    revert: undo
  }, other);
  return undo;
}

// Entfernt das Gegenstück einer gelöschten Hälften-Combo. Liefert eine Funktion, die es wieder einsetzt.
function removeBilateralMirror(combo) {
  const other = comboIsBilateral(combo) ? Dactyl.SIDE_IDS.find(id => id !== editSide) : null;
  if (!other) return null;
  const cfg = configFor(other);
  const mirror = cfg.combos.find(c => c.id === combo.id);
  if (!mirror) return null;
  cfg.combos = cfg.combos.filter(c => c.id !== combo.id);
  saveConfigToServer(other);
  const restore = () => {
    const target = configFor(other);
    if (!target.combos.some(c => c.id === mirror.id) && target.combos.length < MAX_COMBOS) target.combos.push(mirror);
    saveConfigToServer(other);
  };
  markPendingSync({
    type: "combo_del",
    title: "Hälften-Combo gelöscht",
    description: mirror.name || "Combo",
    sideRevert: true,
    revert: restore
  }, other);
  return restore;
}

// Anzeige in der Tabelle: bei einer Hälften-Combo trägt jede Taste ihre Hälfte
function comboKeyBadgeText(combo, index, fallback) {
  if (!comboIsBilateral(combo)) return fallback;
  const side = index === 0 ? combo.side1 : combo.side2;
  return `${side}: ${fallback}`;
}

function initCombosUI() {
  const box = document.getElementById("comboBilateralCheck");
  if (box) box.addEventListener("change", updateComboBilateralControls);
}
