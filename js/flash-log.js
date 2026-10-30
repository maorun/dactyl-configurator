// =============================================================================
// Flash-Protokoll: Live-Ausgabe von arduino-cli (NDJSON von /api/save_and_flash?stream=1)
// =============================================================================

// Höchstzahl der angezeigten Zeilen; ältere fallen weg (der Server meldet Fehler zusätzlich im Ergebnis)
const FLASH_LOG_MAX_LINES = 400;

const FLASH_STAGE_LABELS = { port: "USB-Port", compile: "Kompilieren", upload: "Upload" };

function flashStageLabel(stage) {
  return FLASH_STAGE_LABELS[stage] || "Flashen";
}

// Zerlegt Text-Stücke in JSON-Zeilen; ein Stück kann mitten in einer Zeile enden
function createNdjsonSplitter() {
  let buffer = "";
  const parse = (line, out) => {
    const text = line.trim();
    if (!text) return;
    try {
      const event = JSON.parse(text);
      if (event && typeof event === "object") out.push(event);
    } catch (_) {
      // Unvollständige oder fremde Zeile: ignorieren statt den Flash-Dialog abzubrechen
    }
  };
  return {
    push(chunk) {
      buffer += chunk;
      const parts = buffer.split("\n");
      buffer = parts.pop();
      const out = [];
      for (const part of parts) parse(part, out);
      return out;
    },
    flush() {
      const out = [];
      parse(buffer, out);
      buffer = "";
      return out;
    }
  };
}

// Hängt eine Zeile an und kürzt vorne auf max Zeilen
function appendFlashLogLine(lines, line, max = FLASH_LOG_MAX_LINES) {
  lines.push(line);
  if (lines.length > max) lines.splice(0, lines.length - max);
  return lines;
}

// Liest die NDJSON-Antwort und ruft onEvent für jedes Ereignis; liefert das Ergebnis-Ereignis oder null
async function readFlashStream(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const splitter = createNdjsonSplitter();
  let result = null;
  const handle = events => {
    for (const event of events) {
      if (event.type === "result") result = event;
      onEvent(event);
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    handle(splitter.push(decoder.decode(value, { stream: true })));
  }
  handle(splitter.push(decoder.decode()));
  handle(splitter.flush());
  return result;
}

// Dialog mit der Live-Ausgabe; schließen lässt er sich erst nach dem Ergebnis
function openFlashLogDialog(profile) {
  const modal = document.getElementById("flashLogModal");
  const title = document.getElementById("flashLogTitle");
  const stageEl = document.getElementById("flashLogStage");
  const output = document.getElementById("flashLogOutput");
  const closeBtn = document.getElementById("btnCloseFlashLog");
  const lines = [];
  if (!modal || !output) return { onEvent() {}, finish() {} };
  title.textContent = `Flashen: ${profile.label}`;
  stageEl.textContent = "Speichere die Konfiguration ...";
  output.textContent = "";
  closeBtn.disabled = true;
  closeBtn.onclick = () => { modal.style.display = "none"; };
  modal.style.display = "flex";
  return {
    onEvent(event) {
      if (event.type !== "log") return;
      // Eine Zeile ohne Phase (Layout-Prüfung vor dem Start) lässt die Phasenanzeige stehen
      if (event.stage) stageEl.textContent = `Phase: ${flashStageLabel(event.stage)}`;
      appendFlashLogLine(lines, String(event.line));
      // Nur am Ende mitscrollen, wenn der Nutzer nicht nach oben gescrollt hat
      const atBottom = output.scrollTop + output.clientHeight >= output.scrollHeight - 4;
      output.textContent = lines.join("\n");
      if (atBottom) output.scrollTop = output.scrollHeight;
    },
    finish(success, message) {
      stageEl.textContent = success ? "✅ Flashen abgeschlossen" : `❌ ${message || "Flashen fehlgeschlagen"}`;
      closeBtn.disabled = false;
    }
  };
}
