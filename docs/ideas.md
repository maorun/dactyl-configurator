# Ideen-Backlog (Dactyl Configurator & Firmware)

Gesammelte Verbesserungsideen für spätere Arbeit. Erledigte Punkte verweisen auf ihren Pull Request.

## Umgesetzt

- **Tasten-Heatmap & WPM-Anzeige** im Live-Monitor — PR #2.
- **Matrix-Test (Löt- und Dioden-Tester)** als eigener Tab — PR #3.
- **Ebenen-Werkzeuge:** Ebene kopieren, tauschen, leeren (als Snapshot vorgemerkt, rückgängig machbar) — PR #4.
- **Tastenpaare (Zwei-Tasten-Aktion):** eine Taste drückt zwei frei wählbare Tasten gleichzeitig (z. B. `Shift` + `.` = `:` auf deutschem macOS) — PR #5.
- **Tap-Dance / Doppel-Tippen:** dritte Aktion pro Taste; zwei Tipps innerhalb von 200 ms lösen sie aus.
- **Linke Hälfte:** eigene Firmware (Keymap, NVS, Config-BLE, Power Management) mit ESP-NOW zum Master; die App bearbeitet, synchronisiert und flasht beide Hälften.
- **Flash-Port-Auswahl:** `server.py` flasht nur den Port, dessen Board sich per `DEVICE_INFO.side` als die gewählte Hälfte meldet.
- **Deutsche Zeichen im Keycode-Picker:** Gruppe "Deutsche Zeichen (macOS)" mit Shift-Zeichen (`:`, `+`, `*`, `?` …) als Einzelcode und Option-Zeichen (`@`, `€`, `{` …) als automatisch angelegtes Tastenpaar; Suchfeld über jeder Aktions-Auswahl.
- **Weitere deutsche Zeichen:** `<` (ISO-Taste `KEY_NON_US_BACKSLASH`, HID `0x64`), `>` (Tastenpaar Shift + ISO-Taste), `^`, `°`, `´` und `` ` `` in "Deutsche Zeichen (macOS)"; Zuordnung für den macOS-Tastaturtyp ISO.
- **macOS-Layout "U.S.":** Gruppe "Sonderzeichen (macOS US)" mit US-Zeichen, `§` über die ISO-Taste, `° € ´` als Tastenpaar; eigene Umlaut-Aktionen `UMLAUT_AE` … `UMLAUT_SZ` (Tottaste Alt + u, dann Vokal; ß = Alt + s); Preset und Vorlagen mit US-Beschriftung.

## App (Configurator)

- **Bildschirm-Tastatur als Picker:** Alternative zum `<select>` mit Suchfeld.
- **Makro-Engine (App-Seite):** Editor für Tastenfolgen mit Verzögerung; braucht Firmware-Aktionscodes und NVS-Speicher.
- **Profilverwaltung:** mehrere benannte Layouts lokal speichern und umschalten (heute nur ein `current_config.json` plus JSON-Export/Import).
- **Layout-Diff vor dem Sync:** pro Taste anzeigen, was sich gegenüber dem Gerät ändert (`GET_CONFIG` mit lokalem Stand vergleichen).
- **Ebenen-Übersicht:** alle 8 Ebenen verkleinert nebeneinander, damit transparente Tasten und Konflikte sichtbar werden.
- **Tastatur-Bedienung im Editor:** Pfeiltasten zum Wechseln der ausgewählten Taste.
- **Heatmap pro Ebene:** Zähler zusätzlich nach `layer` aus dem `KEY_PRESS`-Event trennen.
- **Heatmap-Export:** Zähler als CSV/JSON exportieren, z. B. für Layout-Optimierung.
- **Matrix-Test für leere Tasten:** im Test-Modus Ebene 0 erzwingen oder das reine Matrix-Event der Firmware nutzen.
- **Fortschritt beim Flashen:** `arduino-cli`-Ausgabe live an die App streamen statt nur am Ende melden.

## Firmware

- **Echte LiPo-Spannungsmessung:** `BAT_SENSE` (GPIO 35) mit externem Spannungsteiler auswerten und den BLE-Batteriestand setzen; die App zeigt heute keinen Akku an (`updateBatteryUI` ist deaktiviert).
- **Makros:** Aktionscode-Bereich für Tastenfolgen, Speicherung in NVS, Ausführung nicht blockierend.
- **Reines Matrix-Event für Diagnose:** eine `MATRIX:`-Zeile unabhängig von der Belegung; heute sendet `dispatchPress` kein `KEY_PRESS` für Tasten mit Aktion `0`.
- **One-Shot-Modifier / Caps Word:** häufige Komfortfunktionen ergänzend zu Mod-Tap.
- **Konfigurierbarer Tapping-Term:** `TAPPING_TERM_MS` (200 ms) als Einstellung in NVS und App.

## Split / Hardware

- **Linke Tasten im Live-Monitor über den Master:** `SPLIT_HID`-Zeilen tragen keine Matrix-Position. Heute zeigt die App linke Tasten nur über eine direkte Verbindung zur linken Hälfte (BLE im Config Mode oder USB).
- **Synchronisierter Sleep:** eine linke Taste weckt heute nur die linke Hälfte.
- ESP-NOW härten bzw. encrypten die Übertragung

## Offene LOW-Befunde aus Code-Reviews

Kleine Befunde aus Reviews, bewusst auf später verschoben. Jeder Punkt braucht beim Umsetzen einen Regressionstest.

- `tests/test_side_profiles.js:231`: Der Test der Preset-Auswahl filtert die Optionen in `index.html` mit den festen Schlüsseln `us_qwerty` und `de_qwertz`. Folge: Ein neues Preset in `R.presets` ohne Option in `index.html` fällt nicht auf. Korrektur: Die festen Schlüssel entfernen und die Optionen von `layoutPresetSelect` mit `Object.keys(R.presets)` vergleichen.
- `js/live-monitor.js:112`: `checkActiveCombos` prüft nur die Hälften der aktuellen Ansicht. Folge: Nach einem Ansichtswechsel mit gehaltener Taste bleibt der Combo-Hinweis der alten Hälfte bis zum nächsten Tastenereignis stehen. Korrektur: Den Combo-Hinweis im Handler des Ansichtswechsels ausblenden.
- `js/keyboard-hooks.js:131`: Kein Test prüft, wie `resolveKeysFromEvent` `activeHandView` und `editSide` übergibt. Folge: Eine falsche Argumentreihenfolge im Aufruf besteht die Unit-Tests. Korrektur: Einen Test ergänzen, der `resolveKeysFromEvent` mit ersetzten globalen Werten ausführt.
- Hardware-Prüfung offen: Tottaste Alt + u eines Umlauts auf der linken Hälfte am Mac testen. Der Host-Test prüft nur die Reihenfolge der `SplitHidEvent`s; der Master sendet sie ohne Abstand.


## Tooling & Qualität

- **Gemeinsame Matrix-Konstanten:** Pins, Größen und nicht vorhandene Tasten einmal definieren und in der Web-App, `server.py` und Firmware prüfen.
