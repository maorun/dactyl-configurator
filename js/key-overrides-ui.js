// =============================================================================
// Tasten-Überschreibungen (Modifier + Taste ergibt eine andere Taste), nur auf dem Master
// =============================================================================

// Karte nur für die Hälfte mit HID-Dienst: die andere Hälfte hat keine Liste
function keyOverridesAvailable() {
  return !!activeProfile().master;
}

function selectedOverrideMods() {
  return Object.keys(KEY_OVERRIDE_MODS).filter(m => {
    const box = document.getElementById(`keyOverrideMod_${m}`);
    return box && box.checked;
  });
}

function renderKeyOverrides() {
  const card = document.getElementById("keyOverridesSection");
  const tbody = document.getElementById("keyOverridesTableBody");
  const empty = document.getElementById("emptyKeyOverridesState");
  if (!card || !tbody || !empty) return;
  card.style.display = keyOverridesAvailable() ? "" : "none";
  tbody.innerHTML = "";
  const list = currentConfig.keyOverrides || [];
  empty.style.display = list.length ? "none" : "block";
  list.forEach((o, i) => {
    const tr = document.createElement("tr");
    [String(i), keyOverrideLabel(o, keycodeLabel)].forEach(text => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });
    const tdDel = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-danger btn-sm";
    delBtn.textContent = "Löschen";
    delBtn.addEventListener("click", () => deleteKeyOverride(i));
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });
}

function addKeyOverrideFromUI() {
  const override = {
    mods: selectedOverrideMods(),
    key: document.getElementById("keyOverrideKeySelect").value,
    replacement: document.getElementById("keyOverrideReplacementSelect").value
  };
  if (!isValidKeyOverride(override)) {
    showToast("Bitte mindestens einen Modifier und zwei normale Tasten (keine Modifier) wählen.");
    return;
  }
  if (!currentConfig.keyOverrides) currentConfig.keyOverrides = [];
  if (currentConfig.keyOverrides.length >= MAX_KEY_OVERRIDES) {
    alert(`Maximal ${MAX_KEY_OVERRIDES} Überschreibungen werden von der Firmware unterstützt.`);
    return;
  }
  const entry = normalizeKeyOverride(override);
  currentConfig.keyOverrides.push(entry);
  const idx = currentConfig.keyOverrides.length - 1;
  renderKeyOverrides();
  saveConfigToServer();
  markPendingSync({
    type: "key_override",
    title: `Überschreibung ${idx} hinzugefügt`,
    description: keyOverrideLabel(entry, keycodeLabel),
    revert: () => {
      if (currentConfig.keyOverrides.length === idx + 1) currentConfig.keyOverrides.pop();
      renderKeyOverrides();
      saveConfigToServer();
    }
  });
}

function deleteKeyOverride(idx) {
  const list = currentConfig.keyOverrides || [];
  if (idx < 0 || idx >= list.length) return;
  const removed = list[idx];
  currentConfig.keyOverrides = list.filter((_, i) => i !== idx);
  renderKeyOverrides();
  saveConfigToServer();
  markPendingSync({
    type: "key_override",
    title: `Überschreibung ${idx} gelöscht`,
    description: keyOverrideLabel(removed, keycodeLabel),
    revert: () => {
      currentConfig.keyOverrides.splice(Math.min(idx, currentConfig.keyOverrides.length), 0, removed);
      renderKeyOverrides();
      saveConfigToServer();
    }
  });
}

function initKeyOverridesUI() {
  const keySel = document.getElementById("keyOverrideKeySelect");
  const replSel = document.getElementById("keyOverrideReplacementSelect");
  if (!keySel || !replSel) return;
  // Nur normale Tasten: keine Modifier, Layer-, Paar- oder Makro-Codes
  [keySel, replSel].forEach(select => {
    select.innerHTML = "";
    KEYCODES.forEach(group => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.group;
      group.keys.filter(k => isKeyOverrideMember(k.code)).forEach(k => {
        const opt = document.createElement("option");
        opt.value = k.code;
        opt.textContent = `${k.label} (${k.code})`;
        optgroup.appendChild(opt);
      });
      if (optgroup.children.length) select.appendChild(optgroup);
    });
  });
  keySel.value = "KEY_BACKSPACE";
  replSel.value = "KEY_DELETE";
  document.getElementById("keyOverrideMod_shift").checked = true;
  document.getElementById("btnAddKeyOverride").addEventListener("click", addKeyOverrideFromUI);
  renderKeyOverrides();
}
