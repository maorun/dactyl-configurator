// =============================================================================
// Tastenpaare (1 Taste = 2 Tasten gleichzeitig)
// =============================================================================

function keycodeLabel(code) {
  for (const group of KEYCODES) {
    const k = group.keys.find(key => key.code === code);
    if (k) return k.label;
  }
  return deMacCharForCode(code) || code;
}

// Tap- und Halte-Auswahl im Inspektor: Gruppe "Tastenpaare" mit den aktuell definierten Paaren
function refreshKeyPairOptions() {
  ["primaryActionSelect", "holdActionSelect", "dtapActionSelect"].forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    const prefix = OPTIONAL_ACTION_PREFIX[id] || "";
    const previous = select.value;
    select.querySelectorAll("optgroup[data-key-pairs]").forEach(g => g.remove());
    const group = document.createElement("optgroup");
    group.label = "Tastenpaare (2 Tasten gleichzeitig)";
    group.dataset.keyPairs = "true";
    currentConfig.keyPairs.forEach((pair, i) => {
      const opt = document.createElement("option");
      opt.value = `PAIR_${i}`;
      const text = `Paar ${i}: ${keyPairLabel(pair, keycodeLabel)}`;
      opt.textContent = `${prefix}${text}`;
      group.appendChild(opt);
    });
    if (group.children.length) select.appendChild(group);
    select.value = previous;
    applySelectFilter(id);
  });
}

function renderKeyPairs() {
  const tbody = document.getElementById("keyPairsTableBody");
  const empty = document.getElementById("emptyKeyPairsState");
  if (!tbody || !empty) return;
  tbody.innerHTML = "";
  empty.style.display = currentConfig.keyPairs.length ? "none" : "block";
  currentConfig.keyPairs.forEach((pair, i) => {
    const tr = document.createElement("tr");
    const cells = [String(i), keyPairLabel(pair, keycodeLabel), `PAIR_${i}`];
    cells.forEach(text => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });
    const tdDel = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-danger btn-sm";
    delBtn.textContent = "Löschen";
    delBtn.addEventListener("click", () => deleteKeyPair(i));
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });
  refreshKeyPairOptions();
}

function addKeyPairFromUI() {
  const first = document.getElementById("keyPairFirstSelect").value;
  const second = document.getElementById("keyPairSecondSelect").value;
  if (!isKeyPairMember(first) || !isKeyPairMember(second)) {
    showToast("Bitte zwei normale Tasten oder Modifier wählen.");
    return;
  }
  if (currentConfig.keyPairs.length >= MAX_KEY_PAIRS) {
    alert(`Maximal ${MAX_KEY_PAIRS} Tastenpaare werden von der Firmware unterstützt.`);
    return;
  }
  const pair = { first, second };
  currentConfig.keyPairs.push(pair);
  const idx = currentConfig.keyPairs.length - 1;
  renderKeyPairs();
  saveConfigToServer();
  markPendingSync({
    type: "key_pair",
    pairs: true,
    title: `Tastenpaar ${idx} hinzugefügt`,
    description: keyPairLabel(pair, keycodeLabel),
    revert: () => {
      if (currentConfig.keyPairs.length === idx + 1) currentConfig.keyPairs.pop();
      renderKeyPairs();
      saveConfigToServer();
    }
  });
}

// Löscht ein beliebiges Paar. Tasten verweisen per Index: removeKeyPairAt nummeriert die Verweise neu,
// Tasten des gelöschten Paars werden leer. Snapshot, weil Ebenen und Combos ersetzt werden.
function deleteKeyPair(idx) {
  const plan = planKeyPairDeletion(currentConfig, idx);
  if (!plan) return;
  if (plan.used && !confirm(`Tastenpaar ${idx} ist noch Tasten oder Combos zugewiesen. Diese Belegungen werden geleert. Trotzdem löschen?`)) return;
  const apply = state => {
    currentConfig.keyPairs = state.keyPairs;
    currentConfig.layers = state.layers;
    currentConfig.combos = state.combos;
    renderMatrix();
    renderCombosTable();
    if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
    saveConfigToServer();
  };
  apply(plan.next);
  markPendingSync({
    type: "key_pair",
    snapshot: true,
    pairs: true,
    title: `Tastenpaar ${idx} gelöscht`,
    description: `${keyPairLabel(plan.removed, keycodeLabel)}${plan.shiftsFollowing ? "; folgende Paare rücken auf" : ""}`,
    revert: () => apply(plan.old)
  });
}

function initKeyPairsUI() {
  const firstSel = document.getElementById("keyPairFirstSelect");
  const secondSel = document.getElementById("keyPairSecondSelect");
  if (!firstSel || !secondSel) return;
  // Nur Tasten mit Code 1..255 (normale Tasten und Modifier)
  [firstSel, secondSel].forEach(select => {
    select.innerHTML = "";
    KEYCODES.forEach(group => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.group;
      group.keys.filter(k => isKeyPairMember(k.code)).forEach(k => {
        const opt = document.createElement("option");
        opt.value = k.code;
        opt.textContent = `${k.label} (${k.code})`;
        optgroup.appendChild(opt);
      });
      if (optgroup.children.length) select.appendChild(optgroup);
      if (group.group === "Zahlen & Symbole") appendDeMacCharGroup(select);
    });
  });
  firstSel.value = "KEY_LEFT_SHIFT";
  secondSel.value = "KEY_PERIOD";
  document.getElementById("btnAddKeyPair").addEventListener("click", addKeyPairFromUI);
  renderKeyPairs();
}
