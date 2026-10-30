// =============================================================================
// Layout-Prüfung: Liste im Tab "Tasten-Matrix & Ebenen", Warnungen im Layout-Diff und beim Flashen
// =============================================================================
// Die Prüfung selbst (lintLayouts) liegt DOM-frei in js/config-model.js. Sie blockiert nichts.

// Prüft die Konfigurationen beider Hälften gemeinsam (sie teilen die aktive Ebene).
// Die Prüfung ist eine Hilfe: ein Fehler darin (z. B. durch eine fremde Konfiguration) darf weder die Matrix noch
// den Diff noch das Flashen stoppen. Dann gibt es keinen Befund.
function currentLayoutLint() {
  try {
    const configs = {};
    for (const side of Dactyl.SIDE_IDS) configs[side] = configFor(side);
    return lintLayouts(configs, SIDE_PROFILES, keycodeLabel);
  } catch (e) {
    console.warn("Layout-Prüfung fehlgeschlagen:", e);
    return [];
  }
}

// "Rechte Hand: ..." oder, für Befunde über beide Hälften, "Beide Hälften: ..."
function layoutLintText(finding) {
  const where = finding.side && SIDE_PROFILES[finding.side] ? SIDE_PROFILES[finding.side].label : "Beide Hälften";
  return `${where}: ${finding.message}`;
}

// withActions: Befunde mit einer Korrektur bekommen einen Knopf (nur im Matrix-Tab; im Diff-Dialog bleibt die
// Konfiguration während der Übertragung unverändert)
function fillLayoutLintList(list, findings, withActions = false) {
  list.replaceChildren();
  for (const f of findings) {
    const li = document.createElement("li");
    li.className = f.level === "warn" ? "layout-lint-warn" : "layout-lint-info";
    const text = document.createElement("span");
    text.textContent = `${f.level === "warn" ? "⚠️" : "ℹ️"} ${layoutLintText(f)}`;
    li.appendChild(text);
    if (withActions && f.code === "absent-key-action") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-outline btn-sm layout-lint-fix";
      btn.textContent = "Entfernen";
      btn.title = `Löscht die Aktionen von R${f.r}C${f.c} auf ${f.layers.length === 1 ? "Ebene" : "den Ebenen"} ${f.layers.join(", ")}. Rückgängig machbar.`;
      btn.addEventListener("click", () => removeAbsentKeyActions(f));
      li.appendChild(btn);
    }
    list.appendChild(li);
  }
}

// Knopf "Entfernen" am Befund "Taste gibt es nicht": löscht die toten Aktionen als vorgemerkte, rückgängig
// machbare Änderung (wie eine Tastenänderung im Inspektor). Die Matrix zeigt die Position nicht, sie wird also
// nur hier bereinigt.
function removeAbsentKeyActions(finding) {
  const side = finding.side;
  if (!side || !SIDE_PROFILES[side]) return;
  // Wie ein Klick auf eine Taste der anderen Hälfte: zuerst die bearbeitete Hälfte wechseln
  if (side !== editSide) switchEditSide(side);
  const cfg = configFor(side);
  const result = clearAbsentKeyActions(cfg, SIDE_PROFILES[side], finding.r, finding.c, finding.layers);
  if (!result) {
    showToast(`R${finding.r}C${finding.c}: nichts zu entfernen (schon entfernt oder die Belegung hat sich geändert).`);
    renderLayoutLint();
    return;
  }
  const { r, c } = finding;
  for (const { l } of result.old) cfg.layers[l][r][c] = result.layers[l][r][c];
  const layerList = result.old.map(o => o.l);
  renderMatrix();
  markPendingSync({
    type: "key",
    title: `Taste [R${r}, C${c}] entfernt`,
    description: `${result.old.length} Aktion${result.old.length === 1 ? "" : "en"} auf einer Taste, die es nicht gibt (${layerList.length === 1 ? "Ebene" : "Ebenen"} ${layerList.join(", ")})`,
    revert: () => {
      // Die Konfiguration zum Zeitpunkt des Rückgängig: ein Lesen vom Gerät oder ein Profil ersetzt das Objekt
      const live = configFor(side);
      if (!live || !Array.isArray(live.layers)) return;
      for (const { l, cell } of result.old) {
        if (live.layers[l] && live.layers[l][r]) live.layers[l][r][c] = cell;
      }
      renderMatrix();
      saveConfigToServer(side);
    }
  }, side);
  saveConfigToServer(side);
}

// Kurztext der Anzahl, z. B. "2 Warnungen, 1 Hinweis"
function layoutLintCounts(findings) {
  const warn = findings.filter(f => f.level === "warn").length;
  const info = findings.length - warn;
  const parts = [];
  if (warn) parts.push(`${warn} ${warn === 1 ? "Warnung" : "Warnungen"}`);
  if (info) parts.push(`${info} ${info === 1 ? "Hinweis" : "Hinweise"}`);
  return parts.join(", ");
}

// Zeichnet die Liste im Matrix-Tab neu (aufgerufen am Ende von renderMatrix); ohne Befund bleibt sie verborgen
function renderLayoutLint() {
  const panel = document.getElementById("layoutLintPanel");
  const summary = document.getElementById("layoutLintSummary");
  const list = document.getElementById("layoutLintList");
  if (!panel || !summary || !list) return;
  const findings = currentLayoutLint();
  panel.style.display = findings.length ? "" : "none";
  if (!findings.length) return;
  const hasWarning = findings.some(f => f.level === "warn");
  summary.textContent = `${hasWarning ? "⚠️" : "ℹ️"} Layout-Prüfung: ${layoutLintCounts(findings)}`;
  fillLayoutLintList(list, findings, true);
}

// Warnungen (ohne Hinweise) für den Layout-Diff-Dialog; leer blendet den Abschnitt aus
function renderSyncDiffLint() {
  const section = document.getElementById("syncDiffLintSection");
  const list = document.getElementById("syncDiffLint");
  if (!section || !list) return;
  const warnings = currentLayoutLint().filter(f => f.level === "warn");
  section.style.display = warnings.length ? "" : "none";
  fillLayoutLintList(list, warnings);
}

// Warnungen in das Flash-Protokoll schreiben (das Flashen läuft trotzdem)
function logLayoutLintToFlashLog(flashLog) {
  for (const f of currentLayoutLint().filter(item => item.level === "warn")) {
    // Ohne stage: die Phasenanzeige bleibt bei "Speichere die Konfiguration", bis der Server die erste Phase meldet
    flashLog.onEvent({ type: "log", line: `Layout-Prüfung: ${layoutLintText(f)}` });
  }
}
