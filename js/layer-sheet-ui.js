// =============================================================================
// Spickzettel: Druckansicht aller benutzten Ebenen beider Hälften
// =============================================================================
// Das Datenmodell (buildLayerSheet) liegt DOM-frei in js/config-model.js. Der Dialog #layerSheetModal zeigt das
// Blatt; "Drucken" ruft den Druckdialog der App auf (@media print in style.css druckt nur das Blatt).

function sheetKeyElement(key) {
  const el = document.createElement("div");
  el.className = "sheet-key";
  if (!key.exists) {
    el.classList.add("sheet-key-spacer");
    return el;
  }
  if (key.transparent) el.classList.add("is-transparent");
  const add = (cls, text) => {
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = text;
    el.appendChild(span);
  };
  add("sheet-tap", key.transparent ? (key.tap ? `▽ ${key.tap}` : "▽") : (key.tap || "·"));
  if (key.hold) add("sheet-hold", `Halten: ${key.hold}`);
  if (key.dtap) add("sheet-dtap", `2×: ${key.dtap}`);
  return el;
}

function sheetHalfElement(half) {
  const wrap = document.createElement("div");
  wrap.className = "sheet-half";
  const title = document.createElement("h5");
  title.textContent = half.label;
  wrap.appendChild(title);
  const body = document.createElement("div");
  body.className = "sheet-half-body";
  const fingers = document.createElement("div");
  fingers.className = "sheet-fingers";
  for (const row of half.rows) {
    const rowEl = document.createElement("div");
    rowEl.className = "sheet-row";
    row.forEach(key => rowEl.appendChild(sheetKeyElement(key)));
    fingers.appendChild(rowEl);
  }
  const thumbs = document.createElement("div");
  thumbs.className = "sheet-thumbs";
  half.thumbs.filter(key => key.exists).forEach(key => thumbs.appendChild(sheetKeyElement(key)));
  body.append(fingers, thumbs);
  wrap.appendChild(body);
  return wrap;
}

function renderLayerSheet() {
  const root = document.getElementById("layerSheetContent");
  if (!root) return;
  const configs = {};
  for (const side of Dactyl.SIDE_IDS) configs[side] = configFor(side);
  const sheet = buildLayerSheet(configs, SIDE_PROFILES, keycodeLabel, Dactyl.sidesInDisplayOrder());
  root.replaceChildren();
  if (!sheet.layers.length) {
    const p = document.createElement("p");
    p.textContent = "Keine Ebene hat eigene Belegung.";
    root.appendChild(p);
    return;
  }
  for (const layer of sheet.layers) {
    const section = document.createElement("section");
    section.className = "sheet-layer";
    const h = document.createElement("h4");
    h.textContent = `Ebene ${layer.layer} · ${layer.name}`;
    section.appendChild(h);
    const halves = document.createElement("div");
    halves.className = "sheet-halves";
    layer.halves.forEach(half => halves.appendChild(sheetHalfElement(half)));
    section.appendChild(halves);
    root.appendChild(section);
  }
}

function openLayerSheetDialog() {
  const modal = document.getElementById("layerSheetModal");
  if (!modal) return;
  renderLayerSheet();
  modal.style.display = "flex";
  document.body.classList.add("layer-sheet-open");
}

function closeLayerSheetDialog() {
  const modal = document.getElementById("layerSheetModal");
  if (modal) modal.style.display = "none";
  document.body.classList.remove("layer-sheet-open");
}

function initLayerSheetUI() {
  const btn = document.getElementById("btnLayerSheet");
  if (!btn) return;
  btn.addEventListener("click", openLayerSheetDialog);
  document.getElementById("btnCloseLayerSheet").addEventListener("click", closeLayerSheetDialog);
  document.getElementById("btnCancelLayerSheet").addEventListener("click", closeLayerSheetDialog);
  document.getElementById("btnPrintLayerSheet").addEventListener("click", () => window.print());
}
