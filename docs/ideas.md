# Ideen-Backlog (Dactyl Configurator & Firmware)

Gesammelte Verbesserungsideen für spätere Arbeit. Erledigte Punkte verweisen auf ihren Pull Request.

## Regeln für die Rangliste

- Die Rangliste hat keine Nummern. Der oberste Eintrag ist der wichtigste, der unterste der unwichtigste.
- Bewerte jeden neuen Eintrag und füge ihn an der passenden Stelle ein. Hänge ihn nicht einfach unten an.
- Jeder Eintrag hat die Form: **Titel** `[Bereich]` — *Nutzen: hoch|mittel|gering · Aufwand: klein|mittel|groß* — Beschreibung und Begründung der Position.
- Ordne nach diesen Kriterien, in dieser Reihenfolge:
  1. Ausfälle und Fehler, die das tägliche Tippen stören.
  2. Nutzen im Alltag (Tippen, Konfigurieren, Diagnose).
  3. Aufwand: Bei gleichem Nutzen steht der kleinere Aufwand oben.
  4. Abhängigkeiten: Eine Voraussetzung steht über dem Eintrag, der sie braucht.
- Ein langer Plan steht unter "Detailpläne". Der Eintrag in der Rangliste verweist darauf.
- Ein umgesetzter Eintrag wandert mit seiner PR-Nummer nach "Umgesetzt".
- Befunde aus Code-Reviews, auch `LOW`, werden im laufenden Review behoben (Regel in `AGENTS.md`). Offene Befunde und Hardware-Prüfungen stehen nicht in dieser Datei, auch zurückgestellte nicht.

## Rangliste

- **`GET_CONFIG` mit Combos, Tastenpaaren und Makros** `[Firmware/App]` — *Nutzen: mittel · Aufwand: mittel* — Layout-Diff und "Vom ESP32 laden" lassen diese Teile aus; der Diff zeigt "keine Änderung", obwohl die Makros abweichen können. Mit der Erweiterung ist ein Backup direkt vom Gerät vollständig. Das automatische Backup der App deckt den Hauptfall schon ab.
- **Mausbewegung (Mouse Keys)** `[Firmware/App]` — *Nutzen: mittel · Aufwand: mittel* — Report ID 3 hat X und Y, es gibt aber nur Klick und Scrollen (`0x130`..`0x134`). Neue Aktionen `MOUSE_UP/DOWN/LEFT/RIGHT` mit Beschleunigung in `processDeferredKeys()`. Die linke Hälfte braucht dafür neue Split-Ops (nur anhängen).
- **Key Overrides** `[Firmware/App]` — *Nutzen: mittel · Aufwand: mittel* — Modifier + Taste ergibt eine andere Aktion, zum Beispiel `Shift` + `Backspace` = `Delete`. Spart Tastenpaare und Ebenen. Muss `heldModifierMask` und den Zustand in `SplitArbitratedKeyboard` beachten.
- **Letzte Aktion wiederholen (Repeat)** `[Firmware/App]` — *Nutzen: mittel · Aufwand: mittel* — Eine Aktion `REPEAT` führt die zuletzt ausgeführte Aktion noch einmal aus, nicht nur den letzten Tastencode: auch Combo-Aktionen, Tastenpaare, Umlaute, Makros und Medientasten. Die Firmware merkt sich dafür die aufgelöste Aktion (inkl. Combo-Ergebnis), nicht die Matrix-Position. Gehalten wirkt sie wie die gehaltene Originalaktion. Offene Fragen: Layer-Aktionen, One-Shot und `CAPS_WORD` ausschließen; über beide Hälften wiederholen (der Master kennt nur HID-Ereignisse, nicht die Aktion der linken Hälfte).
- **OTA-Update über BLE im Config-Modus** `[Firmware/App]` — *Nutzen: mittel · Aufwand: groß* — `min_spiffs` hat zwei OTA-Slots; Flashen ohne USB-Kabel, vor allem für die linke Hälfte. Hohes Risiko: Rollback, Signatur und die unauthentifizierte Config-Characteristic. Steht deshalb unter den kleineren Einträgen.
- **Ebenen-Übersicht** `[App]` — *Nutzen: gering · Aufwand: mittel* — Alle 8 Ebenen verkleinert nebeneinander, damit transparente Tasten und Konflikte sichtbar werden.
- **Heatmap pro Ebene** `[App]` — *Nutzen: gering · Aufwand: klein* — Zähler zusätzlich nach `layer` aus dem `KEY_PRESS`-Event trennen.
- **Heatmap-Export** `[App]` — *Nutzen: gering · Aufwand: klein* — Zähler als CSV/JSON exportieren, z. B. für Layout-Optimierung. Sinnvoll erst zusammen mit oder nach der Heatmap pro Ebene.
- **Gemeinsame Matrix-Konstanten** `[Tooling]` — *Nutzen: gering · Aufwand: mittel* — Pins, Größen und nicht vorhandene Tasten einmal definieren und in Web-App, `server.py` und Firmware prüfen. `tests/test_side_profiles.js` prüft die Profile bereits gegen die Firmware-Quellen; der Rest-Nutzen ist klein.
- **Tastatur-Bedienung im Editor** `[App]` — *Nutzen: gering · Aufwand: klein* — Pfeiltasten zum Wechseln der ausgewählten Taste.
- **Bildschirm-Tastatur als Picker** `[App]` — *Nutzen: gering · Aufwand: mittel* — Alternative zum `<select>`. Das Suchfeld über jeder Aktions-Auswahl deckt den Bedarf bereits weitgehend ab.

## zurückgestellte Punkte, die vorerst nicht umgesetzt werden

- **Echte LiPo-Spannungsmessung** `[Firmware]` — *Nutzen: hoch · Aufwand: mittel* — `BAT_SENSE` (GPIO 35) mit externem Spannungsteiler auswerten und den BLE-Batteriestand setzen; die App zeigt heute keinen Akku an (`updateBatteryUI` ist deaktiviert). Ohne Anzeige fällt die Tastatur ohne Vorwarnung aus. Braucht einen Hardware-Umbau (Spannungsteiler), deshalb unter den Split-Fehlern.
