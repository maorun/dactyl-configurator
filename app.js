// =============================================================================
// Dactyl Keyboard Configurator — Client Application
// =============================================================================
// Einstieg: globaler Zustand, Initialisierung, Config-Mode-Anzeige, vorgemerkte Änderungen und
// Server-Speicherung. Die übrigen Teile liegen in js/ und laden vorher (Reihenfolge in index.html).
// Alle Dateien sind klassische Skripte mit gemeinsamem globalem Scope; app.js lädt zuletzt.

// State
// Bearbeitete Hälfte ("R" oder "L"). currentConfig und pendingChanges gehören immer zu dieser Hälfte;
// der Zustand der anderen Hälfte liegt in sideStore (js/side-state.js).
let editSide = Dactyl.getMasterSide();
function activeProfile() {
  return SIDE_PROFILES[editSide];
}

function defaultConfigFor(side) {
  const profile = SIDE_PROFILES[side];
  return normalizeConfig(JSON.parse(JSON.stringify(profile.defaultConfig)), profile);
}

const sideStore = Dactyl.createSideStore(Dactyl.SIDE_IDS, side => ({
  config: defaultConfigFor(side),
  typingStats: createTypingStats(loadStoredHeatmap(SIDE_PROFILES[side].heatmapStorageKey), SIDE_PROFILES[side]),
  matrixTest: createMatrixTest(SIDE_PROFILES[side])
}));
let currentConfig = sideStore.get(editSide).config;
let pendingChanges = sideStore.get(editSide).pendingChanges;

function configFor(side) {
  return side === editSide ? currentConfig : sideStore.get(side).config;
}

function setConfigFor(side, cfg) {
  if (side === editSide) currentConfig = cfg;
  else sideStore.save(side, { config: cfg });
}

function pendingFor(side) {
  return side === editSide ? pendingChanges : sideStore.get(side).pendingChanges;
}

function setPendingFor(side, list) {
  if (side === editSide) pendingChanges = list;
  else sideStore.save(side, { pendingChanges: list });
}

function typingStatsFor(side) {
  return sideStore.get(side).typingStats;
}

function matrixTestFor(side) {
  return sideStore.get(side).matrixTest;
}

let activeLayerIndex = 0;
let activeHandView = SIDE_PROFILES[editSide].handView; // handView eines Profils oder "both"
let thumbClusterFormat = "2x3"; // "2x3" or "3x2"
let selectedKey = null; // { r, c, side, isThumb }
let serialPort = null;
let serialReader = null;
let serialReadPromise = null;
let keepReading = true;

// Hälfte am USB-Port: kommt aus DEVICE_INFO.side (null bis zur ersten Antwort auf GET_INFO)
let serialSide = null;
// Bricht die GET_INFO-Wiederholung nach dem Öffnen des USB-Ports ab
let stopSerialInfoRetry = null;

// Web Bluetooth & Auto-Sync State
let bleDevice = null;
let bleServer = null;
let bleConfigChar = null;
// Hälfte der BLE-Verbindung: kommt aus dem Config-Mode-Namen ("Dactyl Config L" = links)
let bleSide = null;
let isConfigModeActive = false;
let isAutoSyncing = false;
let isConnectingBle = false;
let pendingSyncCount = 0;
const watchedBleDevices = new Set();
const knownBleDevices = [];
let bleAutoPollTimer = null;

let lastBleDisconnectTime = 0;
let bleWriteQueue = Promise.resolve();

// Active pressed keys set: stores strings like "R_2_1"
const activePressedKeys = new Set();

// Heatmap & WPM: Zähler bleiben lokal in diesem Browser-Profil (ein Schlüssel pro Hälfte, siehe Profil).
// Annahme: genau ein App-Fenster (main.js); ein zweites Fenster überschreibt den gespeicherten Stand.
// Matrix-Test: pro Hälfte, nur für die laufende Sitzung, nicht gespeichert.
let heatmapEnabled = false;
let heatmapSaveTimer = null;

// Initialisierung
document.addEventListener("DOMContentLoaded", () => {
  initUI();
  updateSideLabels();
  populateKeycodeSelects();
  renderLayerButtons();
  renderMatrix();
  renderCombosTable();
  setupEventListeners();
  setupBrowserKeyboardHooks();
  loadSavedConfigFromServer();
  initModernBleAutoSync();
  initHeatmapUI();
  initMatrixTestUI();
  initKeyPairsUI();
  initMacrosUI();
  initLayoutProfilesUI();
});

function updateConfigModeUI(active, syncing = false) {
  isConfigModeActive = active;
  isAutoSyncing = syncing;

  const pill = document.getElementById("configModeStatusPill");
  const pillIcon = document.getElementById("configModeIcon");
  const pillText = document.getElementById("configModeText");
  const card = document.getElementById("configModeGuideCard");
  const badge = document.getElementById("configModeStateBadge");
  const btnExit = document.getElementById("btnExitConfigBanner");

  if (pill) {
    pill.className = "config-mode-pill " + (syncing ? "mode-syncing" : (active ? "mode-config" : "mode-normal"));
  }
  if (pillIcon) {
    pillIcon.textContent = syncing ? "🔄" : (active ? "⚡" : "⌨️");
  }
  if (pillText) {
    pillText.textContent = syncing
      ? "Übertrage auf Dactyl..."
      : (active ? "KONFIG-MODUS AKTIV" : "Mac-Tastatur");
  }

  if (card) {
    card.classList.toggle("is-config-active", active || syncing);
    card.classList.toggle("has-pending-sync", !active && !syncing && pendingSyncCount > 0);
  }
  if (badge) {
    if (syncing) {
      badge.className = "config-state-badge state-syncing";
      badge.textContent = "🔄 Übertrage auf ESP32...";
    } else if (active) {
      badge.className = "config-state-badge state-config";
      badge.textContent = "⚡ KONFIG-MODUS AKTIV";
    } else {
      badge.className = "config-state-badge state-normal";
      badge.textContent = "⌨️ Mac-Tastaturmodus aktiv";
    }
  }
  if (btnExit) {
    btnExit.style.display = (active && !syncing) ? "inline-flex" : "none";
  }
}

function renderPendingSyncUI() {
  pendingSyncCount = pendingChanges.length;
  const badge = document.getElementById("pendingSyncBadge");
  const card = document.getElementById("configModeGuideCard");
  const toggleBtn = document.getElementById("btnTogglePendingDrawer");
  const drawer = document.getElementById("pendingChangesDrawer");
  const list = document.getElementById("pendingChangesList");
  const countBadge = document.getElementById("pendingChangesCountBadge");

  if (card && !isConfigModeActive) {
    card.classList.toggle("has-pending-sync", pendingSyncCount > 0);
  }

  if (badge) {
    if (pendingSyncCount > 0) {
      badge.className = "pending-sync-badge pending";
      badge.textContent = `⏳ ${pendingSyncCount} Änderung${pendingSyncCount === 1 ? "" : "en"} vorgemerkt (warte auf Combo)`;
      badge.title = "Klicken, um die Details der vorgemerkten Änderungen anzuzeigen.";
      badge.style.display = "inline-flex";
      badge.style.cursor = "pointer";
    } else {
      badge.className = "pending-sync-badge synced";
      badge.textContent = "✓ Alle Einstellungen synchron";
      badge.title = "Alle Einstellungen sind synchron.";
      badge.style.display = "inline-flex";
      badge.style.cursor = "default";
    }
  }

  if (toggleBtn) {
    if (pendingSyncCount > 0) {
      toggleBtn.style.display = "inline-flex";
      const isExpanded = drawer && drawer.style.display !== "none";
      toggleBtn.textContent = isExpanded ? "📋 Details verbergen ▴" : "📋 Details anzeigen ▾";
    } else {
      toggleBtn.style.display = "none";
    }
  }

  if (countBadge) {
    countBadge.textContent = String(pendingSyncCount);
  }

  if (drawer && pendingSyncCount === 0) {
    drawer.style.display = "none";
  }

  if (list) {
    list.innerHTML = "";
    if (pendingSyncCount === 0) {
      const emptyLi = document.createElement("li");
      emptyLi.className = "pending-change-item empty";
      emptyLi.textContent = "Keine ausstehenden Änderungen.";
      list.appendChild(emptyLi);
    } else {
      pendingChanges.forEach((chg) => {
        const li = document.createElement("li");
        li.className = "pending-change-item";

        const iconMap = {
          key: "⌨️",
          layer_name: "✏️",
          layer_tool: "🗂️",
          preset: "🎨",
          settings: "⚙️",
          combo_add: "⚡",
          combo_del: "🗑️",
          key_pair: "➕",
          import: "📁"
        };
        const icon = iconMap[chg.type] || "📝";

        const mainDiv = document.createElement("div");
        mainDiv.className = "pending-change-main";

        const titleDiv = document.createElement("div");
        titleDiv.className = "pending-change-title";

        const iconSpan = document.createElement("span");
        iconSpan.textContent = icon;
        const textSpan = document.createElement("span");
        textSpan.textContent = chg.title || "Änderung";
        const timeSpan = document.createElement("span");
        timeSpan.className = "pending-change-time";
        timeSpan.textContent = chg.time || "";

        titleDiv.appendChild(iconSpan);
        titleDiv.appendChild(textSpan);
        titleDiv.appendChild(timeSpan);
        mainDiv.appendChild(titleDiv);

        if (chg.description) {
          const descDiv = document.createElement("div");
          descDiv.className = "pending-change-desc";
          descDiv.textContent = chg.description;
          mainDiv.appendChild(descDiv);
        }

        li.appendChild(mainDiv);

        if (typeof chg.revert === "function") {
          const undoBtn = document.createElement("button");
          undoBtn.className = "btn btn-outline btn-xs btn-undo-change";
          undoBtn.textContent = "↩️ Rückgängig";
          undoBtn.title = "Diese Änderung rückgängig machen";
          undoBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            undoPendingChange(chg.id);
          });
          li.appendChild(undoBtn);
        }

        list.appendChild(li);
      });
    }
  }
}

function togglePendingChangesDrawer() {
  const drawer = document.getElementById("pendingChangesDrawer");
  const toggleBtn = document.getElementById("btnTogglePendingDrawer");
  if (!drawer) return;
  const isHidden = (drawer.style.display === "none" || !drawer.style.display);
  drawer.style.display = isHidden ? "block" : "none";
  if (toggleBtn) {
    toggleBtn.textContent = isHidden ? "📋 Details verbergen ▴" : "📋 Details anzeigen ▾";
  }
}

function undoPendingChange(id) {
  const idx = pendingChanges.findIndex(c => c.id === id);
  if (idx === -1) return;
  const change = pendingChanges[idx];
  // Snapshot-Reverts (Import, Preset, Einstellungen, Ebenen-Werkzeug) stellen ganze Bereiche wieder her und würden
  // spätere Änderungen überschreiben; ältere Reverts würden in vom Snapshot ersetzte Ebenen schreiben.
  if (isUndoBlocked(pendingChanges, idx)) {
    showToast("↩️ Bitte zuerst die neueren Änderungen rückgängig machen.", 5000);
    return;
  }
  if (typeof change.revert === "function") {
    try {
      change.revert();
    } catch (err) {
      console.error("Fehler beim Rückgängigmachen der Änderung:", err);
    }
  }
  pendingChanges.splice(idx, 1);
  if (pendingChanges.length === 0) {
    clearPendingSync();
  } else {
    renderPendingSyncUI();
  }
  showToast(`↩️ Änderung rückgängig gemacht: ${change.title}`);
  // Ein laufender oder fehlgeschlagener Sync kann die Änderung schon gesendet haben: Stand erneut übertragen
  requestLiveSync(editSide, true);
}

function discardAllPendingChanges() {
  if (pendingChanges.length === 0) return;
  const count = pendingChanges.length;
  if (!confirm(`Möchtest du wirklich alle ${count} vorgemerkten Änderungen verwerfen und rückgängig machen?`)) {
    return;
  }
  for (let i = pendingChanges.length - 1; i >= 0; i--) {
    const chg = pendingChanges[i];
    if (typeof chg.revert === "function") {
      try {
        chg.revert();
      } catch (err) {
        console.error("Fehler beim Verwerfen der Änderung:", err);
      }
    }
  }
  clearPendingSync();
  showToast(`🗑️ ${count} vorgemerkte Änderung${count === 1 ? "" : "en"} verworfen.`);
  requestLiveSync(editSide, true);
}

// side: Hälfte, zu der die Änderung gehört. Asynchrone Aufrufer übergeben die beim Start erfasste Hälfte,
// damit ein Wechsel der Hälfte während des Wartens die Änderung nicht der falschen Hälfte zuordnet.
function markPendingSync(changeOrSummary = "", side = editSide) {
  if (side !== editSide) {
    if (changeOrSummary && typeof changeOrSummary === "object") {
      pendingFor(side).push({
        id: "chg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: changeOrSummary.type || "general",
        title: changeOrSummary.title || "Änderung",
        description: changeOrSummary.description || "",
        // Revert-Closures schreiben in currentConfig und gelten nur für die bearbeitete Hälfte
        revert: null,
        snapshot: !!changeOrSummary.snapshot,
        pairs: !!changeOrSummary.pairs,
        macros: !!changeOrSummary.macros
      });
      requestLiveSync(side);
    }
    return;
  }
  let changeObj;
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (typeof changeOrSummary === "string") {
    changeObj = {
      id: "chg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      time: nowStr,
      type: "general",
      title: changeOrSummary || "Änderung",
      description: "",
      revert: null
    };
  } else if (typeof changeOrSummary === "object" && changeOrSummary !== null) {
    changeObj = {
      id: changeOrSummary.id || ("chg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5)),
      time: nowStr,
      type: changeOrSummary.type || "general",
      title: changeOrSummary.title || "Änderung",
      description: changeOrSummary.description || "",
      revert: changeOrSummary.revert || null,
      snapshot: !!changeOrSummary.snapshot,
      pairs: !!changeOrSummary.pairs,
      macros: !!changeOrSummary.macros
    };
  }
  if (changeObj) {
    pendingChanges.push(changeObj);
  }
  renderPendingSyncUI();
  // Verbundene Hälfte: sofort die vollständige Konfiguration übertragen (writeConfigToESP32 meldet den Fortschritt)
  if (changeObj && requestLiveSync(side)) return;

  const titleText = changeObj ? changeObj.title : "";
  const suffix = titleText ? ` (${titleText})` : "";
  const profile = activeProfile();
  showToast(`💾 Vorgemerkt${suffix}! Halte ${profile.comboLabel} (0.5s) an der ${profile.label} zum automatischen Übertragen.`);
}

// Verwirft die vorgemerkten Änderungen einer Hälfte (Standard: bearbeitete Hälfte)
function clearPendingSync(side = editSide) {
  setPendingFor(side, []);
  if (side !== editSide) return;
  pendingSyncCount = 0;
  renderPendingSyncUI();
  const drawer = document.getElementById("pendingChangesDrawer");
  if (drawer) drawer.style.display = "none";
  const card = document.getElementById("configModeGuideCard");
  if (card) card.classList.remove("has-pending-sync");
}

// Lädt die gespeicherte Konfiguration beider Hälften (GET /api/config?side=L|R)
async function loadSavedConfigFromServer() {
  for (const side of Dactyl.SIDE_IDS) {
    const profile = SIDE_PROFILES[side];
    try {
      const res = await fetch(`/api/config?side=${side}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (!data || !data.layers || data.layers.length === 0) continue;
      try {
        validateConfigShape(data, profile);
      } catch (validationErr) {
        showToast(`⚠️ Gespeicherte Konfiguration der ${profile.label} ungültig (${validationErr.message}). Standard wird verwendet.`, 7000);
        continue;
      }
      // "source" ist Server-Metadatum ("user" = lokale Config, "default" = versionierte Vorlage), kein Config-Feld
      const { source, ...cfg } = data;
      setConfigFor(side, normalizeConfig(cfg, profile));
      if (side === editSide) {
        applySettingsToInputs(currentConfig.settings);
        renderLayerButtons();
        renderCombosTable();
        showToast(source === "default" ? "Standard-Vorlage geladen (noch keine eigene Konfiguration gespeichert)." : "Gespeicherte Konfiguration geladen!");
      }
      renderMatrix();
    } catch (e) {
      console.warn(`Could not load config (${side}) from server:`, e);
    }
  }
}

function applySettingsToInputs(settings) {
  if (!settings) return;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = String(v); };
  setVal("deviceNameInput", settings.deviceName);
  setVal("debounceInput", settings.debounceMs);
  setVal("comboTimeoutInput", settings.comboTimeoutMs);
  setVal("tappingTermInput", settings.tappingTermMs);
  setVal("standbyTimeoutSelect", settings.standbyTimeoutMinutes);
  setVal("sleepTimeoutSelect", settings.sleepTimeoutMinutes);
}

// Saves werden seriell ausgeführt: ein später eintreffender älterer POST kann neuere Daten nicht überschreiben.
// Jede Hälfte speichert in ihre eigene Datei (POST /api/config?side=L|R).
let serverSaveQueue = Promise.resolve(true);
function saveConfigToServer(side = editSide) {
  const snapshot = JSON.stringify(configFor(side));
  const run = async () => {
    try {
      const res = await fetch(`/api/config?side=${side}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: snapshot
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { msg = (await res.json()).error || msg; } catch (_) {}
        showToast(`⚠️ Konfiguration konnte nicht gespeichert werden: ${msg}`, 6000);
        return false;
      }
      return true;
    } catch (e) {
      console.warn("Could not auto-save config to server:", e);
      showToast("⚠️ Server nicht erreichbar: Konfiguration nicht gespeichert.", 6000);
      return false;
    }
  };
  serverSaveQueue = serverSaveQueue.then(run, run);
  return serverSaveQueue;
}


let toastTimer = null;
function showToast(msg, durationMs = 2800) {
  const toast = document.getElementById("toastNotification");
  if (!toast) return;
  toast.textContent = msg;
  toast.className = "toast show";
  // Älteren Timer verwerfen, damit er die neue Meldung nicht vorzeitig ausblendet
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = "toast";
    toastTimer = null;
  }, durationMs);
}
