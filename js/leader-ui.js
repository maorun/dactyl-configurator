// =============================================================================
// Leader-Sequenzen: nach der Taste LEADER lösen bis zu vier Tasten eine Aktion aus (beide Hälften)
// =============================================================================

// Anzeigename einer Taste oder Aktion einer Sequenz: Paare und Makros mit ihrem Inhalt
function leaderCodeLabel(code) {
  const pairIdx = pairIndexFromCode(code);
  if (pairIdx >= 0) {
    const pair = (currentConfig.keyPairs || [])[pairIdx];
    return pair ? `Paar ${pairIdx} (${keyPairLabel(pair, keycodeLabel)})` : `Paar ${pairIdx}`;
  }
  const macroIdx = macroIndexFromCode(code);
  if (macroIdx >= 0) {
    const macro = (currentConfig.macros || [])[macroIdx];
    return macro ? `Makro ${macroIdx} (${macro.name})` : `Makro ${macroIdx}`;
  }
  return keycodeLabel(code);
}

function fillLeaderKeyOptions(select, optional) {
  const keep = select.value;
  select.innerHTML = "";
  if (optional) {
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "—";
    select.appendChild(none);
  }
  KEYCODES.forEach(group => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.group;
    group.keys.filter(k => isLeaderKey(k.code)).forEach(k => {
      const opt = document.createElement("option");
      opt.value = k.code;
      opt.textContent = `${k.label} (${k.code})`;
      optgroup.appendChild(opt);
    });
    if (optgroup.children.length) select.appendChild(optgroup);
  });
  if (keep && [...select.options].some(o => o.value === keep)) select.value = keep;
}

// Aktionsliste: Tasten, dazu die vorhandenen Tastenpaare und Makros (ändern sich mit der Config)
function fillLeaderActionOptions() {
  const select = document.getElementById("leaderActionSelect");
  if (!select) return;
  const keep = select.value;
  fillLeaderKeyOptions(select, false);
  const addGroup = (label, items) => {
    if (!items.length) return;
    const optgroup = document.createElement("optgroup");
    optgroup.label = label;
    items.forEach(([value, text]) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = text;
      optgroup.appendChild(opt);
    });
    select.appendChild(optgroup);
  };
  addGroup("Tastenpaare", (currentConfig.keyPairs || []).map((p, i) => [`PAIR_${i}`, leaderCodeLabel(`PAIR_${i}`)]));
  addGroup("Makros", (currentConfig.macros || []).map((m, i) => [`MACRO_${i}`, leaderCodeLabel(`MACRO_${i}`)]));
  // Die Auswahl erst nach allen Gruppen zurücksetzen: ein Paar oder Makro steht erst jetzt in der Liste
  if (keep && [...select.options].some(o => o.value === keep)) select.value = keep;
}

function renderLeaderSequences() {
  const tbody = document.getElementById("leaderTableBody");
  const empty = document.getElementById("emptyLeaderState");
  if (!tbody || !empty) return;
  fillLeaderActionOptions();
  tbody.innerHTML = "";
  const list = currentConfig.leaderSequences || [];
  empty.style.display = list.length ? "none" : "block";
  list.forEach((q, i) => {
    const tr = document.createElement("tr");
    [String(i), q.keys.map(leaderCodeLabel).join(", "), leaderCodeLabel(q.action)].forEach(text => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });
    const tdDel = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-danger btn-sm";
    delBtn.textContent = "Löschen";
    delBtn.addEventListener("click", () => deleteLeaderSequence(i));
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });
}

function addLeaderSequenceFromUI() {
  const keys = [0, 1, 2, 3].map(i => document.getElementById(`leaderKeySelect${i}`).value).filter(Boolean);
  const sequence = { keys, action: document.getElementById("leaderActionSelect").value };
  if (!isValidLeaderSequence(sequence)) {
    showToast("Bitte 1 bis 4 normale Tasten (keine Modifier) und eine Aktion wählen.");
    return;
  }
  if (!currentConfig.leaderSequences) currentConfig.leaderSequences = [];
  if (currentConfig.leaderSequences.length >= MAX_LEADER_SEQS) {
    alert(`Maximal ${MAX_LEADER_SEQS} Leader-Sequenzen werden von der Firmware unterstützt.`);
    return;
  }
  if (hasDuplicateLeaderSequence([...currentConfig.leaderSequences, sequence])) {
    showToast("Eine Leader-Sequenz mit denselben Tasten gibt es schon.");
    return;
  }
  const entry = normalizeLeaderSequence(sequence);
  currentConfig.leaderSequences.push(entry);
  const idx = currentConfig.leaderSequences.length - 1;
  renderLeaderSequences();
  saveConfigToServer();
  markPendingSync({
    type: "leader",
    title: `Leader-Sequenz ${idx} hinzugefügt`,
    description: leaderSequenceLabel(entry, leaderCodeLabel),
    revert: () => {
      if (currentConfig.leaderSequences.length === idx + 1) currentConfig.leaderSequences.pop();
      renderLeaderSequences();
      saveConfigToServer();
    }
  });
}

// Legt eine Vorlage als neue Sequenz an (Snapshot-Änderung mit Undo)
function applyLeaderPresetFromUI(presetKey) {
  const result = applyLeaderPreset(presetKey, currentConfig.leaderSequences || []);
  if (result.error) {
    showToast(result.error);
    return false;
  }
  const old = JSON.parse(JSON.stringify(currentConfig.leaderSequences || []));
  currentConfig.leaderSequences = result.sequences;
  renderLeaderSequences();
  saveConfigToServer();
  markPendingSync({
    type: "leader",
    snapshot: true,
    title: `Leader-Sequenz ${result.sequences.length - 1} aus Vorlage`,
    description: leaderSequenceLabel(result.sequence, leaderCodeLabel),
    revert: () => {
      currentConfig.leaderSequences = old;
      renderLeaderSequences();
      saveConfigToServer();
    }
  });
  return true;
}

function deleteLeaderSequence(idx) {
  const list = currentConfig.leaderSequences || [];
  if (idx < 0 || idx >= list.length) return;
  const removed = list[idx];
  currentConfig.leaderSequences = list.filter((_, i) => i !== idx);
  renderLeaderSequences();
  saveConfigToServer();
  markPendingSync({
    type: "leader",
    title: `Leader-Sequenz ${idx} gelöscht`,
    description: leaderSequenceLabel(removed, leaderCodeLabel),
    revert: () => {
      // Dieselben Tasten können inzwischen neu belegt sein: die Config wäre ungültig und das Gerät lehnte sie ab
      if (hasDuplicateLeaderSequence([...currentConfig.leaderSequences, removed])) {
        showToast("Eine Leader-Sequenz mit denselben Tasten gibt es schon. Die gelöschte Sequenz bleibt entfernt.");
        return;
      }
      currentConfig.leaderSequences.splice(Math.min(idx, currentConfig.leaderSequences.length), 0, removed);
      renderLeaderSequences();
      saveConfigToServer();
    }
  });
}

// Tastenaufnahme: Die Taste auf der Ebene 0 der bearbeiteten Hälfte füllt den nächsten Platz der Sequenz.
// Dieselbe Taste darf mehrmals folgen (nach dem Loslassen); eine Taste ohne Leader-Code zählt nicht.
function leaderCaptureKeyCode(r, c) {
  const cell = currentConfig.layers[0] && currentConfig.layers[0][r] && currentConfig.layers[0][r][c];
  return cell && isLeaderKey(cell.tap) ? cell.tap : null;
}

function toggleLeaderCapture() {
  const button = document.getElementById("btnCaptureLeader");
  if (button.getAttribute("aria-pressed") === "true") { stopKeyCapture(); return; }
  // Ein neuer Aufnahmelauf ersetzt die Folge: alle Plätze leeren
  for (let i = 0; i < LEADER_MAX_KEYS; i++) document.getElementById(`leaderKeySelect${i}`).value = "";
  startKeyCapture(
    { max: LEADER_MAX_KEYS, allowRepeat: true, resolve: leaderCaptureKeyCode },
    (index, value) => { document.getElementById(`leaderKeySelect${index}`).value = value; },
    () => setCaptureButton(button, false)
  );
  setCaptureButton(button, true);
}

function initLeaderUI() {
  for (let i = 0; i < LEADER_MAX_KEYS; i++) {
    const select = document.getElementById(`leaderKeySelect${i}`);
    if (!select) return;
    fillLeaderKeyOptions(select, i > 0);
  }
  document.getElementById("leaderKeySelect0").value = "KEY_A";
  document.getElementById("btnAddLeader").addEventListener("click", () => {
    stopKeyCapture();
    addLeaderSequenceFromUI();
  });
  document.getElementById("btnCaptureLeader").addEventListener("click", toggleLeaderCapture);
  const presetSel = document.getElementById("leaderPresetSelect");
  Object.keys(LEADER_PRESETS).forEach(key => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = LEADER_PRESETS[key].name;
    presetSel.appendChild(opt);
  });
  presetSel.addEventListener("change", () => {
    if (presetSel.value) applyLeaderPresetFromUI(presetSel.value);
    presetSel.value = "";
  });
  renderLeaderSequences();
}
