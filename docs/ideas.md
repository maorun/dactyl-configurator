# Ideen-Backlog (Dactyl Configurator & Firmware)

Gesammelte Verbesserungsideen für spätere Arbeit. Erledigte Punkte verweisen auf ihren Pull Request.

## Umgesetzt

- **Tasten-Heatmap & WPM-Anzeige** im Live-Monitor — PR #2.
- **Matrix-Test (Löt- und Dioden-Tester)** als eigener Tab — PR #3.
- **Ebenen-Werkzeuge:** Ebene kopieren, tauschen, leeren (als Snapshot vorgemerkt, rückgängig machbar) — PR #4.
- **Tastenpaare (Zwei-Tasten-Aktion):** eine Taste drückt zwei frei wählbare Tasten gleichzeitig (z. B. `Shift` + `.` = `:` auf deutschem macOS) — PR #5.

## Als Nächstes geplant (Reihenfolge laut Nutzer)

1. **Tap-Dance / Doppel-Tippen:** zweimal schnell tippen löst eine zweite Aktion aus.

## App (Configurator)

- **Besserer Keycode-Picker:** im Dropdown fehlen Zeichen wie `:` und `+` (deutsches Layout braucht dafür Shift-Kombinationen). Statt eines langen `<select>` eine durchsuchbare Auswahl oder eine Bildschirm-Tastatur; Tastenpaare decken die Zeichen heute schon ab, der Picker würde sie direkt anbieten (z. B. `:` legt automatisch das Paar `Shift` + `.` an).
- **Makro-Engine (App-Seite):** Editor für Tastenfolgen mit Verzögerung; braucht Firmware-Aktionscodes und NVS-Speicher.
- **Profilverwaltung:** mehrere benannte Layouts lokal speichern und umschalten (heute nur ein `current_config.json` plus JSON-Export/Import).
- **Layout-Diff vor dem Sync:** pro Taste anzeigen, was sich gegenüber dem Gerät ändert (`GET_CONFIG` mit lokalem Stand vergleichen).
- **Ebenen-Übersicht:** alle 8 Ebenen verkleinert nebeneinander, damit transparente Tasten und Konflikte sichtbar werden.
- **Tastatur-Bedienung im Editor:** Pfeiltasten zum Wechseln der ausgewählten Taste, Suchfeld im Keycode-Dropdown.
- **Heatmap pro Ebene:** Zähler zusätzlich nach `layer` aus dem `KEY_PRESS`-Event trennen.
- **Heatmap-Export:** Zähler als CSV/JSON exportieren, z. B. für Layout-Optimierung.
- **Matrix-Test für leere Tasten:** im Test-Modus Ebene 0 erzwingen oder das reine Matrix-Event der Firmware nutzen.
- **Flash-Port-Auswahl:** `server.py` nimmt heute den ersten `/dev/cu.usbserial*`-Port; bei mehreren Geräten den Port in der App wählen lassen.
- **Fortschritt beim Flashen:** `arduino-cli`-Ausgabe live an die App streamen statt nur am Ende melden.

## Firmware

- **Echte LiPo-Spannungsmessung:** `BAT_SENSE` (GPIO 35) mit externem Spannungsteiler auswerten und den BLE-Batteriestand setzen; die App zeigt heute keinen Akku an (`updateBatteryUI` ist deaktiviert).
- **Makros:** Aktionscode-Bereich für Tastenfolgen, Speicherung in NVS, Ausführung nicht blockierend.
- **Reines Matrix-Event für Diagnose:** eine `MATRIX:`-Zeile unabhängig von der Belegung; heute sendet `dispatchPress` kein `KEY_PRESS` für Tasten mit Aktion `0`.
- **One-Shot-Modifier / Caps Word:** häufige Komfortfunktionen ergänzend zu Mod-Tap.
- **Konfigurierbarer Tapping-Term:** `TAPPING_TERM_MS` (200 ms) als Einstellung in NVS und App.

## Split / Hardware

- **Linke Hand per ESP-NOW:** Empfang von `SplitKeyEvent` im Master, Spalten-Mapping und Darstellung der linken Hand im Live-Monitor (UI zeigt die linke Hand heute nur statisch).
- **Batteriestand der linken Hand:** im `flags`-Byte des Split-Events mitsenden.

## Tooling & Qualität

- **DOM-Tests für die App:** z. B. mit jsdom für Rendering, Pending-Changes und Undo (heute nur DOM-freie Logik getestet).
- **Gemeinsame Matrix-Konstanten:** Pins, Größen und nicht vorhandene Tasten einmal definieren und in `app.js`, `server.py` und Firmware prüfen.
- **`app.js` aufteilen:** Datei hat über 3.000 Zeilen; Module für BLE, Serial, Editor und Live-Monitor.
