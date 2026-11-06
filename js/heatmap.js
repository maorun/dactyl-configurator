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

// Jede Hälfte färbt nach ihrer eigenen Statistik (alle Ebenen oder nur die angezeigte)
function applyHeatmap() {
  const layer = heatmapLayer();
  for (const side of Dactyl.SIDE_IDS) {
    const stats = typingStatsFor(side);
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
