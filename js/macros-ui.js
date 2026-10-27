// =============================================================================
// Makros (1 Taste = Folge aus Tippen, Drücken, Loslassen und Pausen)
// =============================================================================

const MACRO_STEP_LABELS = { tap: "Tippen", down: "Drücken", up: "Loslassen", pause: "Pause" };

// Editor-Zustand: Index des bearbeiteten Makros (-1 = neues Makro) und Arbeitskopie der Schritte
let macroEditIndex = -1;
let macroDraftSteps = [];
// Hälfte des offenen Entwurfs (null = Editor geschlossen)
let macroEditSide = null;

function macroStepLabel(step) {
  if (step.type === "pause") return `${MACRO_STEP_LABELS.pause} ${step.ms} ms`;
  return `${MACRO_STEP_LABELS[step.type]} ${keycodeLabel(step.code)}`;
}

function macroSummary(macro) {
  const text = macro.steps.map(macroStepLabel).join(" → ");
  return text.length > 80 ? `${text.slice(0, 79)}…` : (text || "(leer)");
}

// Tap-, Halte- und Doppel-Tipp-Auswahl im Inspektor: Gruppe "Makros". Combos unterstützen keine Makros.
function refreshMacroOptions() {
  ["primaryActionSelect", "holdActionSelect", "dtapActionSelect"].forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    const prefix = OPTIONAL_ACTION_PREFIX[id] || "";
    const previous = select.value;
    select.querySelectorAll("optgroup[data-macros]").forEach(g => g.remove());
    const group = document.createElement("optgroup");
    group.label = "Makros (Tastenfolge)";
    group.dataset.macros = "true";
    currentConfig.macros.forEach((macro, i) => {
      const opt = document.createElement("option");
      opt.value = `MACRO_${i}`;
      opt.textContent = `${prefix}Makro ${i}: ${macro.name}`;
      group.appendChild(opt);
    });
    if (group.children.length) select.appendChild(group);
    select.value = previous;
    applySelectFilter(id);
  });
}

function renderMacros() {
  // Laden, Import, Undo oder Wechsel der Hälfte: ein Entwurf zu einer anderen Liste darf nicht stehen bleiben
  if (macroEditSide !== null && (macroEditSide !== editSide || macroSaveIndex(currentConfig.macros, macroEditIndex) === null)) {
    closeMacroEditor();
  }
  const tbody = document.getElementById("macrosTableBody");
  const empty = document.getElementById("emptyMacrosState");
  if (!tbody || !empty) return;
  tbody.innerHTML = "";
  empty.style.display = currentConfig.macros.length ? "none" : "block";
  currentConfig.macros.forEach((macro, i) => {
    const tr = document.createElement("tr");
    [String(i), macro.name, macroSummary(macro), `MACRO_${i}`].forEach(text => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });
    const tdActions = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-secondary btn-sm";
    editBtn.textContent = "Bearbeiten";
    editBtn.addEventListener("click", () => openMacroEditor(i));
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-danger btn-sm";
    delBtn.textContent = "Löschen";
    delBtn.addEventListener("click", () => deleteMacro(i));
    tdActions.append(editBtn, " ", delBtn);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
  refreshMacroOptions();
}

function renderMacroDraftSteps() {
  const list = document.getElementById("macroStepsList");
  const count = document.getElementById("macroStepCount");
  if (!list) return;
  list.innerHTML = "";
  macroDraftSteps.forEach((step, i) => {
    const li = document.createElement("li");
    li.className = "macro-step";
    const text = document.createElement("span");
    text.textContent = `${i + 1}. ${macroStepLabel(step)}`;
    li.appendChild(text);
    const buttons = [
      ["↑", "Nach oben", i > 0, () => moveMacroStep(i, -1)],
      ["↓", "Nach unten", i < macroDraftSteps.length - 1, () => moveMacroStep(i, 1)],
      ["✕", "Schritt entfernen", true, () => { macroDraftSteps.splice(i, 1); renderMacroDraftSteps(); }]
    ];
    buttons.forEach(([label, title, enabled, onClick]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-secondary btn-sm";
      btn.textContent = label;
      btn.title = title;
      btn.disabled = !enabled;
      btn.addEventListener("click", onClick);
      li.appendChild(btn);
    });
    list.appendChild(li);
  });
  if (count) count.textContent = `${macroDraftSteps.length} / ${MAX_MACRO_STEPS} Schritte`;
}

function moveMacroStep(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= macroDraftSteps.length) return;
  [macroDraftSteps[i], macroDraftSteps[j]] = [macroDraftSteps[j], macroDraftSteps[i]];
  renderMacroDraftSteps();
}

function updateMacroStepInputs() {
  const isPause = document.getElementById("macroStepType").value === "pause";
  document.getElementById("macroStepCodeWrap").style.display = isPause ? "none" : "";
  document.getElementById("macroStepMsWrap").style.display = isPause ? "" : "none";
}

function addMacroStepFromUI() {
  if (macroDraftSteps.length >= MAX_MACRO_STEPS) {
    showToast(`Ein Makro hat maximal ${MAX_MACRO_STEPS} Schritte.`);
    return;
  }
  const type = document.getElementById("macroStepType").value;
  const step = type === "pause"
    ? { type, ms: Number(document.getElementById("macroStepMs").value) }
    : { type, code: document.getElementById("macroStepCode").value };
  if (!isValidMacroStep(step)) {
    showToast(type === "pause" ? `Pause: 1 bis ${MACRO_MAX_PAUSE_MS} ms.` : "Bitte eine normale Taste oder einen Modifier wählen.");
    return;
  }
  macroDraftSteps.push(step);
  renderMacroDraftSteps();
}

function openMacroEditor(idx) {
  const macro = idx >= 0 ? currentConfig.macros[idx] : null;
  if (idx < 0 && currentConfig.macros.length >= MAX_MACROS) {
    alert(`Maximal ${MAX_MACROS} Makros werden von der Firmware unterstützt.`);
    return;
  }
  macroEditIndex = macro ? idx : -1;
  macroEditSide = editSide;
  macroDraftSteps = macro ? macro.steps.map(st => ({ ...st })) : [];
  document.getElementById("macroNameInput").value = macro ? macro.name : `Makro ${currentConfig.macros.length}`;
  document.getElementById("macroEditorTitle").textContent = macro ? `Makro ${idx} bearbeiten` : "Neues Makro";
  document.getElementById("macroEditor").style.display = "";
  renderMacroDraftSteps();
}

function closeMacroEditor() {
  const editor = document.getElementById("macroEditor");
  if (editor) editor.style.display = "none";
  macroEditIndex = -1;
  macroEditSide = null;
  macroDraftSteps = [];
}

// Snapshot-Änderung: Makros und Ebenen (beim Löschen) werden als Ganzes ersetzt und zurückgesetzt
function applyMacroState(state) {
  currentConfig.macros = state.macros;
  if (state.layers) currentConfig.layers = state.layers;
  renderMacros();
  if (state.layers) renderMatrix();
  if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
  saveConfigToServer();
}

function saveMacroFromUI() {
  const name = sanitizeCommandText(document.getElementById("macroNameInput").value, `Makro ${macroEditIndex >= 0 ? macroEditIndex : currentConfig.macros.length}`);
  const macro = { name, steps: macroDraftSteps.map(normalizeMacroStep) };
  if (!macro.steps.length) {
    showToast("Ein Makro braucht mindestens einen Schritt.");
    return;
  }
  if (!isValidMacro(macro)) {
    showToast("Das Makro enthält ungültige Schritte.");
    return;
  }
  const isNew = macroEditIndex < 0;
  const idx = macroEditSide === editSide ? macroSaveIndex(currentConfig.macros, macroEditIndex) : null;
  if (idx === null) {
    showToast("Die Makro-Liste hat sich geändert. Bitte das Makro neu öffnen.");
    closeMacroEditor();
    return;
  }
  const old = { macros: JSON.parse(JSON.stringify(currentConfig.macros)) };
  const next = { macros: JSON.parse(JSON.stringify(currentConfig.macros)) };
  next.macros[idx] = macro;
  applyMacroState(next);
  closeMacroEditor();
  markPendingSync({
    type: "macro",
    snapshot: true,
    macros: true,
    title: isNew ? `Makro ${idx} hinzugefügt` : `Makro ${idx} geändert`,
    description: `${macro.name}: ${macroSummary(macro)}`,
    revert: () => applyMacroState(old)
  });
}

// Löscht ein Makro. Tasten verweisen per Index: removeMacroAt nummeriert die Verweise neu,
// Tasten des gelöschten Makros werden leer.
function deleteMacro(idx) {
  const next = removeMacroAt(currentConfig, idx);
  if (!next) return;
  if (isMacroUsed(currentConfig.layers, idx) &&
      !confirm(`Makro ${idx} ist noch Tasten zugewiesen. Diese Belegungen werden geleert. Trotzdem löschen?`)) return;
  const removed = JSON.parse(JSON.stringify(currentConfig.macros[idx]));
  const hadFollowers = idx < currentConfig.macros.length - 1;
  if (macroEditIndex >= 0) closeMacroEditor();
  applyMacroState(next);
  markPendingSync({
    type: "macro",
    snapshot: true,
    macros: true,
    title: `Makro ${idx} gelöscht`,
    description: `${removed.name}${hadFollowers ? "; folgende Makros rücken auf" : ""}`,
    // Nur die geleerten Verweise zurücksetzen: Tastenänderungen nach dem Löschen bleiben erhalten
    revert: () => {
      const restored = restoreMacroAt(currentConfig, idx, removed, next.cleared);
      if (restored) applyMacroState(restored);
      else if (currentConfig.macros.length >= MAX_MACROS) showToast(`Makro ${idx} kann nicht zurückkommen: die Liste hat schon ${MAX_MACROS} Makros.`);
      else showToast(`Makro ${idx} kann nicht zurückkommen: die Makro-Liste hat sich geändert.`);
    }
  });
}

function initMacrosUI() {
  const codeSel = document.getElementById("macroStepCode");
  if (!codeSel) return;
  // Wie bei Tastenpaaren: nur Tasten mit Code 1..255 (normale Tasten und Modifier)
  codeSel.innerHTML = "";
  KEYCODES.forEach(group => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.group;
    group.keys.filter(k => isKeyPairMember(k.code)).forEach(k => {
      const opt = document.createElement("option");
      opt.value = k.code;
      opt.textContent = `${k.label} (${k.code})`;
      optgroup.appendChild(opt);
    });
    if (optgroup.children.length) codeSel.appendChild(optgroup);
    if (group.group === "Zahlen & Symbole") appendDeMacCharGroup(codeSel);
  });
  codeSel.value = "KEY_A";
  document.getElementById("macroStepMs").max = String(MACRO_MAX_PAUSE_MS);
  document.getElementById("macroStepType").addEventListener("change", updateMacroStepInputs);
  document.getElementById("btnAddMacroStep").addEventListener("click", addMacroStepFromUI);
  document.getElementById("btnNewMacro").addEventListener("click", () => openMacroEditor(-1));
  document.getElementById("btnSaveMacro").addEventListener("click", saveMacroFromUI);
  document.getElementById("btnCancelMacro").addEventListener("click", closeMacroEditor);
  updateMacroStepInputs();
  renderMacros();
}
