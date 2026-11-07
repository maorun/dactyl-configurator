// =============================================================================
// Eigene Alternate-Repeat-Paare: ALT_REPEAT sendet nach Taste "key" die Taste "alt" (beide Hälften)
// =============================================================================

function fillAltRepeatKeyOptions(select) {
  const keep = select.value;
  select.innerHTML = "";
  KEYCODES.forEach(group => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.group;
    group.keys.filter(k => isStandardKeyOrModifier(k.code)).forEach(k => {
      const opt = document.createElement("option");
      opt.value = k.code;
      opt.textContent = `${k.label} (${k.code})`;
      optgroup.appendChild(opt);
    });
    if (optgroup.children.length) select.appendChild(optgroup);
  });
  if (keep && [...select.options].some(o => o.value === keep)) select.value = keep;
}

function altRepeatLabel(e) {
  return `${keycodeLabel(e.key)} → ${keycodeLabel(e.alt)}`;
}

function renderAltRepeats() {
  const tbody = document.getElementById("altRepeatTableBody");
  const empty = document.getElementById("emptyAltRepeatState");
  if (!tbody || !empty) return;
  tbody.innerHTML = "";
  const list = currentConfig.altRepeats || [];
  empty.style.display = list.length ? "none" : "block";
  list.forEach((e, i) => {
    const tr = document.createElement("tr");
    [String(i), keycodeLabel(e.key), keycodeLabel(e.alt)].forEach(text => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });
    const tdDel = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-danger btn-sm";
    delBtn.textContent = "Löschen";
    delBtn.addEventListener("click", () => deleteAltRepeat(i));
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });
}

function addAltRepeat(entry) {
  if (!isValidAltRepeat(entry)) {
    showToast("Bitte zwei Tasten wählen.");
    return;
  }
  if (!currentConfig.altRepeats) currentConfig.altRepeats = [];
  if (currentConfig.altRepeats.length >= MAX_ALT_REPEATS) {
    alert(`Maximal ${MAX_ALT_REPEATS} Alt-Repeat-Paare werden von der Firmware unterstützt.`);
    return;
  }
  if (hasDuplicateAltRepeat([...currentConfig.altRepeats, entry])) {
    showToast("Für diese Taste gibt es schon ein Alt-Repeat-Paar.");
    return;
  }
  const normalized = normalizeAltRepeat(entry);
  currentConfig.altRepeats.push(normalized);
  const idx = currentConfig.altRepeats.length - 1;
  renderAltRepeats();
  saveConfigToServer();
  markPendingSync({
    type: "altrepeat",
    title: `Alt-Repeat-Paar ${idx} hinzugefügt`,
    description: altRepeatLabel(normalized),
    revert: () => {
      if (currentConfig.altRepeats.length === idx + 1) currentConfig.altRepeats.pop();
      renderAltRepeats();
      saveConfigToServer();
    }
  });
}

function deleteAltRepeat(idx) {
  const list = currentConfig.altRepeats || [];
  if (idx < 0 || idx >= list.length) return;
  const removed = list[idx];
  currentConfig.altRepeats = list.filter((_, i) => i !== idx);
  renderAltRepeats();
  saveConfigToServer();
  markPendingSync({
    type: "altrepeat",
    title: `Alt-Repeat-Paar ${idx} gelöscht`,
    description: altRepeatLabel(removed),
    revert: () => {
      if (hasDuplicateAltRepeat([...currentConfig.altRepeats, removed])) {
        showToast("Für diese Taste gibt es schon ein Alt-Repeat-Paar. Das gelöschte Paar bleibt entfernt.");
        return;
      }
      currentConfig.altRepeats.splice(Math.min(idx, currentConfig.altRepeats.length), 0, removed);
      renderAltRepeats();
      saveConfigToServer();
    }
  });
}

// Button im Panel "Fingerlast": legt aus den häufigsten Folgen eines Fingers Paare an (beide Richtungen)
function addAltRepeatsFromSameFingerPairs() {
  const added = altRepeatsFromSameFingerPairs(currentConfig, topSameFingerPairs(typingStatsFor(editSide)));
  if (!added.length) {
    showToast("Keine neuen Alt-Repeat-Paare aus den häufigsten Folgen möglich (zu wenige Daten, keine normalen Tasten oder schon vorhanden).");
    return;
  }
  if (!currentConfig.altRepeats) currentConfig.altRepeats = [];
  const firstIdx = currentConfig.altRepeats.length;
  currentConfig.altRepeats.push(...added);
  renderAltRepeats();
  saveConfigToServer();
  markPendingSync({
    type: "altrepeat",
    title: `${added.length} Alt-Repeat-Paar(e) aus Fingerlast angelegt`,
    description: added.map(altRepeatLabel).join(", "),
    revert: () => {
      if (currentConfig.altRepeats.length === firstIdx + added.length) currentConfig.altRepeats.length = firstIdx;
      renderAltRepeats();
      saveConfigToServer();
    }
  });
}

function initAltRepeatUI() {
  const keySelect = document.getElementById("altRepeatKeySelect");
  const altSelect = document.getElementById("altRepeatAltSelect");
  if (!keySelect || !altSelect) return;
  fillAltRepeatKeyOptions(keySelect);
  fillAltRepeatKeyOptions(altSelect);
  keySelect.value = "KEY_E";
  altSelect.value = "KEY_U";
  document.getElementById("btnAddAltRepeat").addEventListener("click", () => addAltRepeat({ key: keySelect.value, alt: altSelect.value }));
  const fromPairs = document.getElementById("btnAltRepeatsFromPairs");
  if (fromPairs) fromPairs.addEventListener("click", addAltRepeatsFromSameFingerPairs);
  renderAltRepeats();
}
