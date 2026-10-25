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
      localStorage.setItem(SIDE_PROFILES[side].heatmapStorageKey, JSON.stringify(typingStatsFor(side).counts));
    }
  } catch (e) {
    console.warn("Heatmap konnte nicht gespeichert werden:", e);
  }
}

function saveHeatmapSoon() {
  if (heatmapSaveTimer) return;
  heatmapSaveTimer = setTimeout(saveHeatmapNow, 1000);
}

function applyHeatClass(keyEl, stats, maxCount) {
  for (let i = 1; i <= HEAT_LEVELS; i++) keyEl.classList.remove(`heat-${i}`);
  const count = stats.counts[`${keyEl.dataset.row}_${keyEl.dataset.col}`] || 0;
  const level = heatLevel(count, maxCount);
  if (heatmapEnabled && level) keyEl.classList.add(`heat-${level}`);
  if (heatmapEnabled && count > 0) keyEl.dataset.heatCount = String(count);
  else delete keyEl.dataset.heatCount;
}

// Jede Hälfte färbt nach ihrer eigenen Statistik
function applyHeatmap() {
  for (const side of Dactyl.SIDE_IDS) {
    const stats = typingStatsFor(side);
    const maxCount = maxKeyCount(stats);
    document.querySelectorAll(`.key-cap[data-side="${side}"]:not(.key-cap-spacer)`).forEach(el => applyHeatClass(el, stats, maxCount));
  }
}

// WPM und Anschläge der bearbeiteten Hälfte
function updateTypingStatsUI() {
  const stats = typingStatsFor(editSide);
  const wpmEl = document.getElementById("liveWpm");
  const totalEl = document.getElementById("liveKeyTotal");
  if (wpmEl) wpmEl.textContent = String(computeWpm(stats, Date.now()));
  if (totalEl) totalEl.textContent = String(stats.total);
}

function onTypingStatsChanged(side = editSide) {
  saveHeatmapSoon();
  if (side === editSide) updateTypingStatsUI();
  if (heatmapEnabled) applyHeatmap();
}

function initHeatmapUI() {
  const toggle = document.getElementById("btnToggleHeatmap");
  const reset = document.getElementById("btnResetHeatmap");
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
