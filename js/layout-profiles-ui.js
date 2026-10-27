// =============================================================================
// Layout-Profile: mehrere benannte Layouts pro Hälfte lokal speichern und laden
// (GET/POST /api/profiles?side=L|R, Datei layout_profiles*.json im Datenverzeichnis)
// =============================================================================

// Profilliste der Hälfte, für die der Dialog offen ist (null = Dialog geschlossen oder Liste nicht geladen)
let layoutProfilesSide = null;
let layoutProfiles = null;
// Revision der Profildatei beim letzten Lesen oder Schreiben: der Server lehnt einen veralteten Stand mit 409 ab
let layoutProfilesRevision = 0;
// Zählt Schreibzugriffe je Hälfte: ein Lesen, das vor einem Schreibzugriff derselben Hälfte begann, darf dessen
// Ergebnis nicht überschreiben. Ein Schreibzugriff auf die andere Hälfte verwirft das Lesen nicht.
const layoutProfilesWriteSeq = {};
// Revision, für die die Meldung über übersprungene Profile schon erschien (je Hälfte): nur einmal pro Stand
const layoutProfilesSkippedShown = {};
// Jede Schreibaktion sendet die ganze Liste: während eine läuft, startet keine zweite auf veraltetem Stand
let layoutProfilesBusy = false;

function setLayoutProfilesBusy(busy) {
  layoutProfilesBusy = busy;
  const modal = document.getElementById("layoutProfilesModal");
  if (modal) modal.querySelectorAll(".modal-body button").forEach(btn => { btn.disabled = busy; });
  if (busy) setLayoutProfilesStatus("Speichert …");
  else if (layoutProfiles) renderLayoutProfiles();
}

// Liefert { profiles, revision, skipped }; skipped nennt Profile, die der Server als ungültig übersprungen hat
async function fetchLayoutProfiles(side) {
  const res = await fetch(`/api/profiles?side=${side}`);
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
  if (!data || !Array.isArray(data.profiles)) throw new Error("Antwort des Servers enthält keine Profilliste.");
  return {
    profiles: data.profiles,
    revision: Number.isInteger(data.revision) ? data.revision : 0,
    skipped: Array.isArray(data.skipped) ? data.skipped : []
  };
}

// Gibt die neue Revision zurück. HTTP 409: ein anderes Fenster hat die Liste inzwischen geändert.
async function storeLayoutProfiles(side, profiles, revision) {
  const res = await fetch(`/api/profiles?side=${side}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profiles, revision })
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  layoutProfilesWriteSeq[side] = (layoutProfilesWriteSeq[side] || 0) + 1;
  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.conflict = res.status === 409;
    throw err;
  }
  return data && Number.isInteger(data.revision) ? data.revision : revision + 1;
}

function setLayoutProfilesStatus(text) {
  const el = document.getElementById("layoutProfilesStatus");
  if (el) el.textContent = text;
}

function renderLayoutProfiles() {
  const list = document.getElementById("layoutProfilesList");
  if (!list) return;
  list.replaceChildren();
  if (!layoutProfiles) {
    if (layoutProfilesBusy) setLayoutProfilesBusy(true);
    return;
  }
  if (layoutProfiles.length === 0) {
    setLayoutProfilesStatus(`Noch kein Profil für die ${SIDE_PROFILES[layoutProfilesSide].label} gespeichert.`);
    if (layoutProfilesBusy) setLayoutProfilesBusy(true);
    return;
  }
  setLayoutProfilesStatus(`${layoutProfiles.length} von ${MAX_LAYOUT_PROFILES} Profilen der ${SIDE_PROFILES[layoutProfilesSide].label}.`);
  layoutProfiles.forEach(entry => {
    const li = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = entry.name;
    const time = document.createElement("span");
    time.className = "layout-profile-time";
    const date = new Date(entry.savedAt);
    time.textContent = Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
    const btnLoad = document.createElement("button");
    btnLoad.className = "btn btn-outline btn-sm";
    btnLoad.textContent = "Laden";
    btnLoad.addEventListener("click", () => loadLayoutProfile(entry.name));
    const btnDelete = document.createElement("button");
    btnDelete.className = "btn btn-danger btn-sm";
    btnDelete.textContent = "Löschen";
    btnDelete.addEventListener("click", () => deleteLayoutProfile(entry.name));
    li.append(name, time, btnLoad, btnDelete);
    list.appendChild(li);
  });
  // Neu gerenderte Knöpfe übernehmen eine laufende Sperre (Dialog während eines Schreibzugriffs neu geöffnet)
  if (layoutProfilesBusy) setLayoutProfilesBusy(true);
}

async function openLayoutProfilesDialog() {
  const modal = document.getElementById("layoutProfilesModal");
  if (!modal) return;
  const side = editSide;
  layoutProfilesSide = side;
  layoutProfiles = null;
  document.getElementById("layoutProfilesTitle").textContent = `Layout-Profile · ${activeProfile().label}`;
  document.getElementById("layoutProfileNameInput").value = "";
  renderLayoutProfiles();
  if (!layoutProfilesBusy) setLayoutProfilesStatus("Profile werden geladen …");
  modal.style.display = "flex";
  await reloadLayoutProfiles(side);
}

// Liest die Liste der Hälfte (neu) vom Server, z. B. nach dem Öffnen oder nach einem Konflikt (HTTP 409)
async function reloadLayoutProfiles(side) {
  const seq = layoutProfilesWriteSeq[side] || 0;
  const stale = () => layoutProfilesSide !== side || seq !== (layoutProfilesWriteSeq[side] || 0);
  try {
    const loaded = await fetchLayoutProfiles(side);
    if (stale()) return;
    layoutProfiles = loaded.profiles;
    layoutProfilesRevision = loaded.revision;
    renderLayoutProfiles();
    const shownKey = `${loaded.revision}:${loaded.skipped.length}`;
    if (loaded.skipped.length && layoutProfilesSkippedShown[side] !== shownKey) {
      layoutProfilesSkippedShown[side] = shownKey;
      alert(`Ungültige Profile übersprungen (das nächste Speichern entfernt sie):\n${loaded.skipped.join("\n")}`);
    }
  } catch (e) {
    if (stale()) return;
    setLayoutProfilesStatus(`⚠️ Profile konnten nicht geladen werden: ${e.message}`);
  }
}

function closeLayoutProfilesDialog() {
  const modal = document.getElementById("layoutProfilesModal");
  if (modal) modal.style.display = "none";
  layoutProfilesSide = null;
  layoutProfiles = null;
}

// Speichert die aktuelle Config der Hälfte unter dem eingegebenen Namen (gleicher Name: Rückfrage, dann ersetzen)
async function saveLayoutProfileFromUI() {
  const side = layoutProfilesSide;
  if (!layoutProfiles || layoutProfilesBusy || side !== editSide) return;
  const input = document.getElementById("layoutProfileNameInput");
  let result;
  try {
    result = upsertLayoutProfile(layoutProfiles, input.value, currentConfig, new Date().toISOString());
  } catch (e) {
    alert(e.message);
    return;
  }
  const name = sanitizeLayoutProfileName(input.value);
  if (result.replaced && !confirm(`Profil "${name}" überschreiben?`)) return;
  setLayoutProfilesBusy(true);
  let revision;
  try {
    revision = await storeLayoutProfiles(side, result.profiles, layoutProfilesRevision);
    // Neue Liste vor dem Entsperren übernehmen: setLayoutProfilesBusy(false) rendert sonst die alte Liste
    if (layoutProfilesSide === side) {
      layoutProfiles = result.profiles;
      layoutProfilesRevision = revision;
    }
  } catch (e) {
    alert(`Profil konnte nicht gespeichert werden: ${e.message}`);
    // Konflikt, oder der Dialog wurde während des Schreibens neu geöffnet (sein Lesen wurde verworfen)
    if ((e.conflict || !layoutProfiles) && layoutProfilesSide === side) await reloadLayoutProfiles(side);
    return;
  } finally {
    setLayoutProfilesBusy(false);
  }
  if (layoutProfilesSide !== side) return;
  input.value = "";
  showToast(`💾 Profil "${name}" gespeichert.`);
}

// Ersetzt die Belegung der Hälfte durch das Profil. Wie ein Import: vorgemerkte Snapshot-Änderung mit Rückgängig.
function loadLayoutProfile(name) {
  const side = layoutProfilesSide;
  if (!layoutProfiles || layoutProfilesBusy || side !== editSide) return;
  const entry = layoutProfiles[findLayoutProfileIndex(layoutProfiles, name)];
  if (!entry) return;
  try {
    validateConfigShape(entry.config, activeProfile());
  } catch (e) {
    alert(`Profil "${entry.name}" ist ungültig: ${e.message}`);
    return;
  }
  if (!confirm(`Profil "${entry.name}" laden? Die aktuelle Belegung wird ersetzt (Rückgängig über die vorgemerkten Änderungen).`)) return;
  const oldConfig = JSON.parse(JSON.stringify(currentConfig));
  const rerender = () => {
    applySettingsToInputs(currentConfig.settings);
    renderLayerButtons();
    renderMatrix();
    renderCombosTable();
    if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
    saveConfigToServer();
  };
  currentConfig = normalizeConfig(JSON.parse(JSON.stringify(entry.config)), activeProfile());
  rerender();
  markPendingSync({
    type: "profile_load",
    snapshot: true,
    pairs: true,
    macros: true,
    title: "Layout-Profil geladen",
    description: entry.name,
    revert: () => {
      currentConfig = oldConfig;
      rerender();
    }
  });
  closeLayoutProfilesDialog();
}

async function deleteLayoutProfile(name) {
  const side = layoutProfilesSide;
  if (!layoutProfiles || layoutProfilesBusy) return;
  if (!confirm(`Profil "${name}" löschen?`)) return;
  const profiles = removeLayoutProfile(layoutProfiles, name);
  setLayoutProfilesBusy(true);
  let revision;
  try {
    revision = await storeLayoutProfiles(side, profiles, layoutProfilesRevision);
    if (layoutProfilesSide === side) {
      layoutProfiles = profiles;
      layoutProfilesRevision = revision;
    }
  } catch (e) {
    alert(`Profil konnte nicht gelöscht werden: ${e.message}`);
    if ((e.conflict || !layoutProfiles) && layoutProfilesSide === side) await reloadLayoutProfiles(side);
    return;
  } finally {
    setLayoutProfilesBusy(false);
  }
}

function initLayoutProfilesUI() {
  const btnOpen = document.getElementById("btnLayoutProfiles");
  if (!btnOpen) return;
  btnOpen.addEventListener("click", openLayoutProfilesDialog);
  document.getElementById("btnCloseLayoutProfiles").addEventListener("click", closeLayoutProfilesDialog);
  document.getElementById("btnSaveLayoutProfile").addEventListener("click", saveLayoutProfileFromUI);
  document.getElementById("layoutProfileNameInput").addEventListener("keydown", e => {
    if (e.key === "Enter") saveLayoutProfileFromUI();
  });
}
