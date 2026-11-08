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
  const summary = text.length > 80 ? `${text.slice(0, 79)}…` : (text || "(leer)");
  return macro.repeat ? `↻ ${summary}` : summary;
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

    if (step.type !== "pause") {
      const stepSelect = document.createElement("select");
      stepSelect.className = "form-control macro-step-code";
      stepSelect.style.display = "none";
      stepSelect.dataset.stepIndex = String(i);
      const opt = document.createElement("option");
      opt.value = step.code;
      opt.textContent = step.code;
      stepSelect.appendChild(opt);
      stepSelect.value = step.code;
      stepSelect.addEventListener("change", () => {
        macroDraftSteps[i].code = stepSelect.value;
        renderMacroDraftSteps();
      });
      li.appendChild(stepSelect);

      const oskBtn = document.createElement("button");
      oskBtn.type = "button";
      oskBtn.className = "btn btn-secondary btn-sm action-picker-trigger";
      oskBtn.textContent = "🎹";
      oskBtn.title = "Taste per On-Screen-Tastatur ändern";
      oskBtn.addEventListener("click", () => {
        if (typeof openOnScreenPickerForSelect === "function") {
          openOnScreenPickerForSelect(stepSelect);
        }
      });
      li.appendChild(oskBtn);
    }

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
  updateMacroTextPreview();
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
  // Eine Suche ohne Treffer sperrt "+ Schritt" nicht für eine Pause
  if (isPause) clearSelectFilter("macroStepCode");
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
    showToast(type === "pause" ? `Pause: 1 bis ${MACRO_MAX_PAUSE_MS} ms.` : "Bitte eine normale Taste, einen Modifier oder eine Media-/Systemtaste wählen.");
    return;
  }
  macroDraftSteps.push(step);
  renderMacroDraftSteps();
}

// Text als Makro: Vorschau (Schrittzahl, Fehler) und Anhängen an die Schritte des Entwurfs
function macroTextStatus(result, existing) {
  if (result.unsupported.length) return { ok: false, text: `Nicht konvertierbar: ${result.unsupported.map(c => `"${c}"`).join(" ")}` };
  const total = existing + result.count;
  if (total > MAX_MACRO_STEPS) return { ok: false, text: `${result.count} Schritte (bisher ${existing}): zu lang, maximal ${MAX_MACRO_STEPS}.` };
  return { ok: true, text: `${result.count} Schritte (${total} / ${MAX_MACRO_STEPS})` };
}

function updateMacroTextPreview() {
  const input = document.getElementById("macroTextInput");
  const info = document.getElementById("macroTextInfo");
  const btn = document.getElementById("btnMacroFromText");
  if (!input || !info || !btn) return;
  if (!input.value) {
    info.textContent = "";
    btn.disabled = true;
    return;
  }
  const status = macroTextStatus(textToMacroSteps(input.value), macroDraftSteps.length);
  info.textContent = status.text;
  btn.disabled = !status.ok;
}

function addMacroFromTextUI() {
  const input = document.getElementById("macroTextInput");
  const result = textToMacroSteps(input.value);
  const status = macroTextStatus(result, macroDraftSteps.length);
  if (!status.ok || !result.count) {
    showToast(status.text);
    return;
  }
  macroDraftSteps.push(...result.steps);
  input.value = "";
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
  document.getElementById("macroRepeatInput").checked = !!(macro && macro.repeat);
  document.getElementById("macroEditorTitle").textContent = macro ? `Makro ${idx} bearbeiten` : "Neues Makro";
  document.getElementById("macroEditor").style.display = "";
  clearSelectFilter("macroStepCode");
  document.getElementById("macroTextInput").value = "";
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
  if (state.leaderSequences) {
    currentConfig.leaderSequences = state.leaderSequences;
    renderLeaderSequences();
  }
  if (state.layers) currentConfig.layers = state.layers;
  renderMacros();
  if (state.layers) renderMatrix();
  if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
  saveConfigToServer();
}

function saveMacroFromUI() {
  const name = sanitizeCommandText(document.getElementById("macroNameInput").value, `Makro ${macroEditIndex >= 0 ? macroEditIndex : currentConfig.macros.length}`);
  const macro = { name, steps: macroDraftSteps.map(normalizeMacroStep), repeat: document.getElementById("macroRepeatInput").checked };
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
  if (isMacroUsed(currentConfig.layers, idx, currentConfig.leaderSequences) &&
      !confirm(`Makro ${idx} ist noch Tasten oder Leader-Sequenzen zugewiesen. Diese Belegungen werden geleert. Trotzdem löschen?`)) return;
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
      const restored = restoreMacroAt(currentConfig, idx, removed, next.cleared, next.leaderRemoved);
      if (restored) applyMacroState(restored);
      else if (currentConfig.macros.length >= MAX_MACROS) showToast(`Makro ${idx} kann nicht zurückkommen: die Liste hat schon ${MAX_MACROS} Makros.`);
      else showToast(`Makro ${idx} kann nicht zurückkommen: die Makro-Liste hat sich geändert.`);
    }
  });
}

// Das gespeicherte Makro als JSON-Datei speichern: das im Editor geöffnete (ohne ungespeicherte Änderungen), sonst das letzte der Liste
function exportMacroFromUI() {
  const idx = macroEditSide === editSide && macroEditIndex >= 0 ? macroEditIndex : currentConfig.macros.length - 1;
  const macro = currentConfig.macros[idx];
  if (!macro) {
    showToast("Kein Makro zum Exportieren vorhanden.");
    return;
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(buildMacroExport(macro), null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `dactyl_makro_${sanitizeCommandText(macro.name, "makro").replace(/[^A-Za-z0-9_-]+/g, "_")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Eine Makro-Datei mit 32 Schritten ist weit unter 64 KB
const MACRO_IMPORT_MAX_BYTES = 64 * 1024;

// Importiert den Text einer Makro-Datei in den ersten freien Slot als Snapshot-Änderung
function importMacroText(text) {
  const result = parseMacroImport(text, currentConfig.macros);
  if (!result.ok) {
    showToast(`Makro-Import abgelehnt: ${result.error}`);
    return false;
  }
  const old = { macros: JSON.parse(JSON.stringify(currentConfig.macros)) };
  const next = { macros: JSON.parse(JSON.stringify(currentConfig.macros)) };
  next.macros[result.index] = result.macro;
  applyMacroState(next);
  markPendingSync({
    type: "macro",
    snapshot: true,
    macros: true,
    title: `Makro ${result.index} importiert`,
    description: `${result.macro.name}: ${macroSummary(result.macro)}`,
    revert: () => applyMacroState(old)
  });
  showToast(`Makro ${result.index} importiert.`);
  return true;
}

// Lädt eine Vorlage in den Slot des geöffneten Makros, sonst in den ersten freien Platz (Snapshot-Änderung mit Undo)
function applyMacroPresetFromUI(presetKey) {
  const editing = macroEditSide === editSide && macroEditIndex >= 0;
  const idx = editing ? macroEditIndex : currentConfig.macros.length;
  const macros = applyMacroPreset(presetKey, idx, currentConfig.macros);
  if (!macros) {
    showToast(idx >= MAX_MACROS ? `Alle ${MAX_MACROS} Makro-Plätze sind belegt.` : "Die Makro-Vorlage ist ungültig.");
    return false;
  }
  const old = { macros: JSON.parse(JSON.stringify(currentConfig.macros)) };
  const hadDraft = macroEditSide !== null;
  if (hadDraft) closeMacroEditor();
  applyMacroState({ macros });
  if (hadDraft) showToast(`Der offene Entwurf wurde durch die Vorlage "${macros[idx].name}" ersetzt.`);
  markPendingSync({
    type: "macro",
    snapshot: true,
    macros: true,
    title: `Makro ${idx} aus Vorlage`,
    description: `${macros[idx].name}: ${macroSummary(macros[idx])}`,
    revert: () => applyMacroState(old)
  });
  return true;
}

function importMacroFromFile(file) {
  if (file.size > MACRO_IMPORT_MAX_BYTES) {
    showToast("Makro-Import abgelehnt: Die Datei ist zu groß.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => importMacroText(String(reader.result));
  reader.onerror = () => showToast("Die Makro-Datei konnte nicht gelesen werden.");
  reader.readAsText(file);
}

function initMacrosUI() {
  const codeSel = document.getElementById("macroStepCode");
  if (!codeSel) return;
  // Makroschritte: Tasten mit Code 1..255 (normale Tasten und Modifier) und Consumer-Tasten (Media, Globe, Systemtasten)
  codeSel.innerHTML = "";
  KEYCODES.forEach(group => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.group;
    group.keys.filter(k => isStandardKeyOrModifier(k.code) || isMacroConsumerCode(k.code)).forEach(k => {
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
  document.getElementById("macroTextInput").addEventListener("input", updateMacroTextPreview);
  document.getElementById("btnMacroFromText").addEventListener("click", addMacroFromTextUI);
  document.getElementById("btnNewMacro").addEventListener("click", () => openMacroEditor(-1));
  const presetSel = document.getElementById("macroPresetSelect");
  Object.keys(MACRO_PRESETS).forEach(key => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = MACRO_PRESETS[key].name;
    presetSel.appendChild(opt);
  });
  presetSel.addEventListener("change", () => {
    if (presetSel.value) applyMacroPresetFromUI(presetSel.value);
    presetSel.value = "";
  });
  document.getElementById("btnExportMacro").addEventListener("click", exportMacroFromUI);
  const macroFileInput = document.getElementById("macroImportInput");
  document.getElementById("btnImportMacro").addEventListener("click", () => macroFileInput.click());
  macroFileInput.addEventListener("change", e => {
    const file = e.target.files && e.target.files[0];
    if (file) importMacroFromFile(file);
    e.target.value = "";
  });
  document.getElementById("btnSaveMacro").addEventListener("click", saveMacroFromUI);
  document.getElementById("btnCancelMacro").addEventListener("click", closeMacroEditor);
  updateMacroStepInputs();
  renderMacros();
}
