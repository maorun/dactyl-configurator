// =============================================================================
// Üben: Dialog "Üben" trainiert das eigene Layout
// =============================================================================
// Das Datenmodell (findCharPosition, buildPracticeSteps, practiceKeyPress, practiceSpeed) liegt DOM-frei in
// js/config-model.js. Der Dialog #practiceModal zeigt den Text und markiert die nächste Taste auf der Matrix der
// richtigen Hälfte. Die Tastendrücke kommen aus handleSerialLine (KEY_PRESS und SPLIT_KEY).

let practiceSession = null;
let practiceMissing = [];
let practiceSheet = null;

function practiceConfigs() {
  const configs = {};
  for (const side of Dactyl.SIDE_IDS) configs[side] = configFor(side);
  return configs;
}

function practiceIsOpen() {
  const modal = document.getElementById("practiceModal");
  return !!modal && modal.style.display !== "none";
}

function practicePrepare() {
  const text = document.getElementById("practiceText").value;
  const built = buildPracticeSteps(text, practiceConfigs(), SIDE_PROFILES, Dactyl.sidesInDisplayOrder());
  practiceMissing = built.missing;
  practiceSession = createPracticeSession(built.steps);
  practiceSheet = buildLayerSheet(practiceConfigs(), SIDE_PROFILES, keycodeLabel, Dactyl.sidesInDisplayOrder());
  return built;
}

// Die Tastatur ist ein HID-Gerät: Ihre Tasten erreichen auch die Seite. Ein fokussierter Knopf (Leertaste, Enter)
// würde sonst "Start" erneut auslösen. Läuft eine Übung, verwirft der Dialog Tastenereignisse außerhalb des Textfelds.
function practiceSwallowKey(e) {
  if (!practiceSession || !practiceIsOpen()) return;
  const id = e.target && e.target.id;
  if (id === "practiceText" || id === "btnClosePractice" || id === "btnCancelPractice") return;
  e.preventDefault();
}

function practiceStart(e) {
  const btn = e && e.currentTarget;
  if (btn && btn.blur) btn.blur();
  practicePrepare();
  renderPractice();
}

function practiceMatrixElement(step) {
  const wrap = document.createElement("div");
  const layer = practiceSheet.layers.find(l => l.layer === step.layer);
  const half = layer && layer.halves.find(h => h.side === step.side);
  if (!half) return wrap;
  wrap.className = "practice-half";
  const title = document.createElement("h5");
  title.textContent = `${half.label} · Ebene ${step.layer}`;
  wrap.appendChild(title);
  const mark = key => {
    const el = sheetKeyElement(key);
    if (key.exists && key.r === step.r && key.c === step.c) el.classList.add("practice-target");
    return el;
  };
  const body = document.createElement("div");
  body.className = "sheet-half-body";
  const fingers = document.createElement("div");
  fingers.className = "sheet-fingers";
  for (const row of half.rows) {
    const rowEl = document.createElement("div");
    rowEl.className = "sheet-row";
    row.forEach(key => rowEl.appendChild(mark(key)));
    fingers.appendChild(rowEl);
  }
  const thumbs = document.createElement("div");
  thumbs.className = "sheet-thumbs";
  half.thumbs.filter(key => key.exists).forEach(key => thumbs.appendChild(mark(key)));
  body.append(fingers, thumbs);
  wrap.appendChild(body);
  return wrap;
}

function practiceHelperText(step) {
  const parts = [];
  const where = k => `${SIDE_PROFILES[k.side].label} R${k.r}C${k.c}`;
  if (step.layerKey) parts.push(`Ebene ${step.layer} per ${where(step.layerKey)}`);
  if (step.shift) parts.push(step.shiftKey ? `Shift per ${where(step.shiftKey)}` : "Shift");
  return parts.length ? `Dazu: ${parts.join(", ")}` : "";
}

function renderPractice() {
  const root = document.getElementById("practiceStatus");
  const textEl = document.getElementById("practiceProgress");
  const matrix = document.getElementById("practiceMatrix");
  const stats = document.getElementById("practiceStats");
  const errorsEl = document.getElementById("practiceErrors");
  const missingEl = document.getElementById("practiceMissing");
  if (!root) return;
  missingEl.textContent = practiceMissing.length ? `Ohne Tastenposition (übersprungen): ${practiceMissing.join(" ")}` : "";
  matrix.replaceChildren();
  textEl.replaceChildren();
  const s = practiceSession;
  if (!s) {
    root.textContent = "Text eingeben und \"Start\" wählen.";
    stats.textContent = "";
    errorsEl.textContent = "";
    return;
  }
  s.steps.forEach((step, i) => {
    const span = document.createElement("span");
    span.textContent = step.char === " " ? "␣" : step.char;
    if (i < s.index) span.className = "practice-done";
    else if (i === s.index) span.className = "practice-current";
    textEl.appendChild(span);
  });
  if (s.finished) root.textContent = "Fertig!";
  else if (!s.steps.length) root.textContent = "Kein Zeichen mit Tastenposition.";
  else {
    const step = s.steps[s.index];
    const pos = `${SIDE_PROFILES[step.side].label} R${step.r}C${step.c}`;
    root.textContent = `Nächste Taste: ${step.char === " " ? "Leertaste" : step.char} (${pos}). ${practiceHelperText(step)}`;
    matrix.appendChild(practiceMatrixElement(step));
  }
  const speed = practiceSpeed(s);
  stats.textContent = `${speed.elapsedMs > 0 ? speed.wpm : "–"} WPM · Genauigkeit ${speed.accuracy} % · Fehler ${s.errorTotal}`;
  const worst = Object.entries(s.errors).sort((a, b) => b[1] - a[1]).slice(0, 5);
  errorsEl.textContent = worst.length
    ? `Fehler je Taste: ${worst.map(([id, n]) => { const [side, r, c] = id.split("_"); return `${SIDE_PROFILES[side].label} R${r}C${c}: ${n}`; }).join(" · ")}`
    : "";
}

// Aufruf aus handleSerialLine (KEY_PRESS und SPLIT_KEY)
function practiceHandleKeyPress(side, r, c, layer) {
  if (!practiceSession || !practiceIsOpen()) return;
  if (practiceKeyPress(practiceSession, side, r, c, layer, Date.now()) !== "ignored") renderPractice();
}

function practiceUseHeatmapText() {
  const sources = Dactyl.SIDE_IDS.map(side => ({ config: configFor(side), stats: typingStatsFor(side) }));
  const text = practiceTextFromHeatmap(sources);
  document.getElementById("practiceText").value = text || "";
  if (!text) showToast("Die Heatmap hat noch keine Daten.");
}

function openPracticeDialog() {
  const modal = document.getElementById("practiceModal");
  if (!modal) return;
  practiceSession = null;
  practiceSheet = null;
  practiceMissing = [];
  renderPractice();
  modal.style.display = "flex";
}

function closePracticeDialog() {
  const modal = document.getElementById("practiceModal");
  if (modal) modal.style.display = "none";
  practiceSession = null;
  practiceSheet = null;
}

function initPracticeUI() {
  const btn = document.getElementById("btnPractice");
  if (!btn) return;
  btn.addEventListener("click", openPracticeDialog);
  document.getElementById("btnClosePractice").addEventListener("click", closePracticeDialog);
  document.getElementById("btnCancelPractice").addEventListener("click", closePracticeDialog);
  document.getElementById("btnStartPractice").addEventListener("click", practiceStart);
  const modal = document.getElementById("practiceModal");
  modal.addEventListener("keydown", practiceSwallowKey);
  modal.addEventListener("keyup", practiceSwallowKey);
  document.getElementById("btnPracticeHeatmap").addEventListener("click", practiceUseHeatmapText);
}
