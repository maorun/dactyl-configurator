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

function fillLayoutLintList(list, findings) {
  list.replaceChildren();
  for (const f of findings) {
    const li = document.createElement("li");
    li.className = f.level === "warn" ? "layout-lint-warn" : "layout-lint-info";
    li.textContent = `${f.level === "warn" ? "⚠️" : "ℹ️"} ${layoutLintText(f)}`;
    list.appendChild(li);
  }
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
  fillLayoutLintList(list, findings);
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
