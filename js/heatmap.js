// =============================================================================
// Tasten-Heatmap & WPM-Anzeige
// =============================================================================

function loadStoredHeatmap(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveHeatmapNow() {
  if (heatmapSaveTimer) {
    clearTimeout(heatmapSaveTimer);
    heatmapSaveTimer = null;
  }
  try {
    for (const side of Dactyl.SIDE_IDS) {
      localStorage.setItem(SIDE_PROFILES[side].heatmapStorageKey, JSON.stringify(serializeTypingStats(typingStatsFor(side))));
    }
  } catch (e) {
    console.warn("Heatmap konnte nicht gespeichert werden:", e);
  }
}

function saveHeatmapSoon() {
  if (heatmapSaveTimer) return;
  heatmapSaveTimer = setTimeout(saveHeatmapNow, 1000);
}

// Ebene der Heatmap: null = alle Ebenen, sonst die angezeigte Ebene
function heatmapLayer() {
  return heatmapPerLayer ? activeLayerIndex : null;
}

function applyHeatClass(keyEl, counts, maxCount) {
  for (let i = 1; i <= HEAT_LEVELS; i++) keyEl.classList.remove(`heat-${i}`);
  const count = counts[`${keyEl.dataset.row}_${keyEl.dataset.col}`] || 0;
  const level = heatLevel(count, maxCount);
  if (heatmapEnabled && level) keyEl.classList.add(`heat-${level}`);
  if (heatmapEnabled && count > 0) keyEl.dataset.heatCount = String(count);
  else delete keyEl.dataset.heatCount;
}

// Stufe nach dem Anteil im Verhältnis zur Taste mit dem höchsten Anteil; die Zahl ist der Anteil in Prozent
function applyErrorClass(keyEl, shares, maxShare) {
  for (let i = 1; i <= HEAT_LEVELS; i++) keyEl.classList.remove(`heat-${i}`);
  const share = shares[`${keyEl.dataset.row}_${keyEl.dataset.col}`] || 0;
  const level = share > 0 ? heatLevel(share, maxShare) : 0;
  if (heatmapEnabled && level) keyEl.classList.add(`heat-${level}`);
  if (heatmapEnabled && share > 0) keyEl.dataset.heatCount = `${Math.round(share * 100)} %`;
  else delete keyEl.dataset.heatCount;
}

// Jede Hälfte färbt nach ihrer eigenen Statistik (alle Ebenen oder nur die angezeigte); im Modus
// Korrekturen nach dem Korrekturanteil (immer über alle Ebenen)
function applyHeatmap() {
  const layer = heatmapLayer();
  for (const side of Dactyl.SIDE_IDS) {
    const stats = typingStatsFor(side);
    if (heatmapErrors) {
      const { shares, max } = correctionShares(stats);
      document.querySelectorAll(`.key-cap[data-side="${side}"]:not(.key-cap-spacer)`).forEach(el => applyErrorClass(el, shares, max));
      continue;
    }
    const counts = heatmapCounts(stats, layer);
    const maxCount = maxKeyCount(stats, layer);
    document.querySelectorAll(`.key-cap[data-side="${side}"]:not(.key-cap-spacer)`).forEach(el => applyHeatClass(el, counts, maxCount));
  }
}

function updateHeatmapLayerButton(btn) {
  btn.classList.toggle("active", heatmapPerLayer);
  btn.textContent = heatmapPerLayer ? "Aktuelle Ebene" : "Alle Ebenen";
}

// WPM und Anschläge der bearbeiteten Hälfte
function updateTypingStatsUI() {
  const stats = typingStatsFor(editSide);
  const wpmEl = document.getElementById("liveWpm");
  const totalEl = document.getElementById("liveKeyTotal");
  if (wpmEl) wpmEl.textContent = String(computeWpm(stats, Date.now()));
  if (totalEl) totalEl.textContent = String(stats.total);
  updateFingerLoadUI();
}

function formatShare(share) {
  return `${(share * 100).toFixed(share > 0 && share < 0.1 ? 1 : 0)} %`;
}

function keyPositionLabel(id) {
  const [r, c] = id.split("_");
  return `R${r}C${c}`;
}

// Anteil je Hälfte und je Finger der bearbeiteten Hälfte, dazu die häufigsten Folgen eines Fingers
function updateFingerLoadUI() {
  const halvesEl = document.getElementById("fingerLoadHalves");
  const barsEl = document.getElementById("fingerLoadBars");
  const totalEl = document.getElementById("sameFingerTotal");
  const pairsEl = document.getElementById("sameFingerPairs");
  if (!halvesEl || !barsEl || !totalEl || !pairsEl) return;
  const sides = Dactyl.sidesInDisplayOrder();
  halvesEl.textContent = halfLoad(sides.map(side => ({ side, stats: typingStatsFor(side) })))
    .map(h => `${SIDE_PROFILES[h.side].label}: ${formatShare(h.share)}`).join(" · ");
  const stats = typingStatsFor(editSide);
  barsEl.textContent = "";
  for (const f of fingerLoad(stats)) {
    const row = document.createElement("span");
    row.className = "finger-load-row";
    row.title = `${FINGER_LABELS[f.finger]}: ${f.count} Anschläge`;
    row.textContent = `${FINGER_LABELS[f.finger]} ${formatShare(f.share)}`;
    row.style.setProperty("--finger-share", String(Math.round(f.share * 100)));
    barsEl.appendChild(row);
  }
  totalEl.textContent = String(stats.sameFingerTotal);
  pairsEl.textContent = topSameFingerPairs(stats)
    .map(p => `${keyPositionLabel(p.a)} ↔ ${keyPositionLabel(p.b)}: ${p.count}`).join(" · ");
  const topEl = document.getElementById("topCorrectedKeys");
  if (topEl) {
    topEl.textContent = topCorrectedKeys(stats)
      .map(k => `${keyPositionLabel(k.id)}: ${formatShare(k.share)} (${k.corrections}/${k.presses})`).join(" · ");
  }
  updateErgonomicSwapsUI(stats);
}

// Liste der Tausch-Vorschläge für Ebene 0; baut nur neu, wenn sich die Vorschläge ändern (der Timer ruft oft auf)
// Positionen getauschter Vorschläge je Hälfte: ihre Zähler gehören zur alten Taste, bis die Statistik zurückgesetzt wird
const ergonomicSwappedPositions = new Map();

function ergonomicSwappedFor(side) {
  if (!ergonomicSwappedPositions.has(side)) ergonomicSwappedPositions.set(side, new Set());
  return ergonomicSwappedPositions.get(side);
}

function updateErgonomicSwapsUI(stats) {
  const listEl = document.getElementById("ergonomicSwaps");
  if (!listEl) return;
  const cellLabel = pos => {
    const cell = currentConfig.layers[0][pos.r][pos.c];
    return `${keyPositionLabel(`${pos.r}_${pos.c}`)} ${(cell && cell.label) || ""}`.trim();
  };
  const swaps = suggestErgonomicSwaps(stats, currentConfig, activeProfile(), undefined, ergonomicSwappedFor(editSide)).map(s => ({
    ...s, text: `${cellLabel(s.from)} (${s.fromCount}) ⇄ ${cellLabel(s.to)} (${s.toCount}) · ${s.reason}`
  }));
  const signature = JSON.stringify(swaps);
  if (listEl.dataset.signature === signature) return;
  listEl.dataset.signature = signature;
  listEl.textContent = "";
  if (!swaps.length) {
    listEl.textContent = "Keine Vorschläge (zu wenige Anschläge oder keine freie Grundreihen-Taste).";
    return;
  }
  for (const s of swaps) {
    const row = document.createElement("div");
    row.className = "ergonomic-swap-row";
    const text = document.createElement("span");
    text.textContent = s.text;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hand-btn";
    btn.textContent = "Tauschen";
    btn.title = "Tauscht beide Tasten auf Ebene 0 (als ausstehende Änderung, mit Rückgängig)";
    btn.addEventListener("click", () => {
      const side = editSide;
      const ids = [`${s.from.r}_${s.from.c}`, `${s.to.r}_${s.to.c}`];
      const swapped = swapKeysByDrag(s.from.r, s.from.c, s.to.r, s.to.c, 0, () => {
        for (const id of ids) ergonomicSwappedFor(side).delete(id);
        updateFingerLoadUI();
      });
      if (!swapped) return;
      for (const id of ids) ergonomicSwappedFor(side).add(id);
      updateFingerLoadUI();
    });
    row.append(text, btn);
    listEl.appendChild(row);
  }
}

function onTypingStatsChanged(side = editSide) {
  saveHeatmapSoon();
  if (side === editSide) updateTypingStatsUI();
  if (heatmapEnabled) applyHeatmap();
}

function initHeatmapUI() {
  const toggle = document.getElementById("btnToggleHeatmap");
  const reset = document.getElementById("btnResetHeatmap");
  const layerBtn = document.getElementById("btnHeatmapLayer");
  if (layerBtn) {
    updateHeatmapLayerButton(layerBtn);
    layerBtn.addEventListener("click", () => {
      heatmapPerLayer = !heatmapPerLayer;
      updateHeatmapLayerButton(layerBtn);
      applyHeatmap();
    });
  }
  const errorsBtn = document.getElementById("btnHeatmapErrors");
  if (errorsBtn) {
    errorsBtn.addEventListener("click", () => {
      heatmapErrors = !heatmapErrors;
      errorsBtn.classList.toggle("active", heatmapErrors);
      if (layerBtn) layerBtn.disabled = heatmapErrors; // der Modus zählt immer über alle Ebenen
      applyHeatmap();
    });
  }
  if (toggle) {
    toggle.addEventListener("click", () => {
      heatmapEnabled = !heatmapEnabled;
      toggle.classList.toggle("active", heatmapEnabled);
      document.getElementById("matrixGrid").classList.toggle("heatmap-on", heatmapEnabled);
      applyHeatmap();
    });
  }
  if (reset) {
    reset.addEventListener("click", () => {
      const profile = activeProfile();
      if (!confirm(`Tasten-Statistik (Heatmap & Anschläge) der ${profile.label} zurücksetzen?`)) return;
      ergonomicSwappedFor(editSide).clear();
      sideStore.save(editSide, { typingStats: createTypingStats(null, profile) });
      if (heatmapSaveTimer) saveHeatmapNow();
      try { localStorage.removeItem(profile.heatmapStorageKey); } catch (e) {}
      updateTypingStatsUI();
      applyHeatmap();
    });
  }
  // Ausstehende Zähler beim Schließen der App sofort sichern
  window.addEventListener("beforeunload", () => {
    if (heatmapSaveTimer) saveHeatmapNow();
  });
  updateTypingStatsUI();
  // WPM fällt ohne neue Anschläge über das gleitende Fenster wieder ab
  setInterval(updateTypingStatsUI, 2000);
}
