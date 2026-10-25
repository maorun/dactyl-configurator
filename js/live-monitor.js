// =============================================================================
// Live Keystroke Visualizer & Combo Detection
// =============================================================================

function triggerVisualKeyPress(r, c, keyLabel, side = editSide, pressedLayer = undefined) {
  const sideConfig = configFor(side);
  const keyId = `${side}_${r}_${c}`;
  activePressedKeys.add(keyId);

  // NUR hervorheben, wenn die gedrückte Taste auch zur aktuell angezeigten Ebene gehört!
  const isCurrentLayer = (pressedLayer === undefined || pressedLayer === activeLayerIndex);

  if (isCurrentLayer) {
    const selector = side ? `.key-cap[data-row="${r}"][data-col="${c}"][data-side="${side}"]`
                          : `.key-cap[data-row="${r}"][data-col="${c}"]`;
    let keyEls = document.querySelectorAll(selector);
    if (keyEls.length === 0) {
      keyEls = document.querySelectorAll(`.key-cap[data-row="${r}"][data-col="${c}"]`);
    }

    keyEls.forEach(el => {
      el.classList.add("is-pressed");
    });
  }

  // Determine key label to show
  let displayChar = keyLabel;
  if (!displayChar || displayChar === " " || displayChar === "?") {
    const sourceLayer = (pressedLayer !== undefined && sideConfig.layers[pressedLayer])
      ? sideConfig.layers[pressedLayer]
      : (sideConfig.layers[activeLayerIndex] || sideConfig.layers[0]);
    if (sourceLayer && sourceLayer[r] && sourceLayer[r][c]) {
      displayChar = sourceLayer[r][c].label || (sourceLayer[r][c].tap ? sourceLayer[r][c].tap.replace("KEY_", "") : "");
    }
  }
  if (!displayChar) displayChar = `R${r}C${c}`;

  const isThumb = (r === 5);
  const locationLabel = isThumb ? `Daumen-Cluster [R${r}, C${c}]` : `Finger [R${r}, C${c}]`;

  // 2. Update Live Monitor HUD
  const activeKeyBadge = document.getElementById("liveActiveKey");
  const activeCoordsBadge = document.getElementById("liveActiveCoords");
  const historyContainer = document.getElementById("liveKeyHistory");

  activeKeyBadge.textContent = displayChar;

  if (isCurrentLayer) {
    activeCoordsBadge.textContent = `${SIDE_PROFILES[side].label} ${locationLabel}`;
  } else {
    const layerNames = sideConfig.layerNames || DEFAULT_LAYER_NAMES;
    const pressedName = layerNames[pressedLayer] || `Layer ${pressedLayer}`;
    activeCoordsBadge.textContent = `${SIDE_PROFILES[side].label} ${locationLabel} (Ebene ${pressedLayer}: ${pressedName}) [Ansicht: L${activeLayerIndex}]`;
  }

  // 3. Prüfe ob ein Combo / Chord aktiv ausgelöst wurde!
  checkActiveCombos();

  // 4. Add to live ticker stream
  const placeholder = historyContainer.querySelector(".placeholder");
  if (placeholder) placeholder.remove();

  const pill = document.createElement("span");
  pill.className = "stream-pill";
  if (isThumb) {
    pill.style.borderColor = "#6366f1";
    pill.style.color = "#c7d2fe";
  }
  if (!isCurrentLayer) {
    pill.style.opacity = "0.75";
    pill.style.borderStyle = "dashed";
    pill.textContent = `${displayChar} (L${pressedLayer} R${r}C${c})`;
  } else {
    pill.textContent = `${displayChar} (${side} R${r}C${c})`;
  }
  historyContainer.prepend(pill);

  while (historyContainer.children.length > 12) {
    historyContainer.removeChild(historyContainer.lastChild);
  }
}

function triggerVisualKeyRelease(r, c, side = editSide) {
  const keyId = `${side}_${r}_${c}`;
  activePressedKeys.delete(keyId);

  const selector = side ? `.key-cap[data-row="${r}"][data-col="${c}"][data-side="${side}"]`
                        : `.key-cap[data-row="${r}"][data-col="${c}"]`;
  let keyEls = document.querySelectorAll(selector);
  if (keyEls.length === 0) {
    keyEls = document.querySelectorAll(`.key-cap[data-row="${r}"][data-col="${c}"]`);
  }

  keyEls.forEach(el => {
    el.classList.remove("is-pressed");
  });

  checkActiveCombos();

  setTimeout(() => {
    if (activePressedKeys.size === 0) {
      document.getElementById("liveActiveKey").textContent = "-";
      document.getElementById("liveActiveCoords").textContent = "Bereit";
      hideComboAlert();
    }
  }, 100);
}


// Combos gelten je Hälfte; die Split-Ansicht prüft beide Hälften, die Einzelansicht die bearbeitete
function checkActiveCombos() {
  for (const side of browserKeySides(activeHandView, editSide, Dactyl.SIDE_IDS)) {
    for (const combo of configFor(side).combos) {
      const k1Id = `${side}_${combo.key1.r}_${combo.key1.c}`;
      const k2Id = `${side}_${combo.key2.r}_${combo.key2.c}`;
      if (activePressedKeys.has(k1Id) && activePressedKeys.has(k2Id)) {
        showComboAlert(combo);
        return;
      }
    }
  }
  hideComboAlert();
}

function showComboAlert(combo) {
  const alertEl = document.getElementById("comboActiveAlert");
  const textEl = document.getElementById("comboActiveText");
  if (alertEl && textEl) {
    textEl.textContent = `COMBO AKTIV: ${combo.key1.label} + ${combo.key2.label} ➔ ${combo.actionLabel || combo.action}`;
    alertEl.style.display = "inline-flex";
  }
}

function hideComboAlert() {
  const alertEl = document.getElementById("comboActiveAlert");
  if (alertEl) {
    alertEl.style.display = "none";
  }
}
