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
- Befunde aus Code-Reviews, auch `LOW`, werden im laufenden Review behoben (Regel in `AGENTS.md`). In der Rangliste stehen sie nicht. Unter "Offene LOW-Befunde aus Code-Reviews" stehen nur ausdrücklich zurückgestellte Befunde und Hardware-Prüfungen.

## Rangliste

- **ESP-NOW härten bzw. verschlüsseln** `[Split]` — *Nutzen: gering · Aufwand: mittel* — Unverschlüsseltes ESP-NOW ist eine bewusst akzeptierte Designentscheidung (Latenz, `AGENTS.md` 2a). Ein Angriff braucht Nähe und die gefälschte linke MAC. Verschlüsselung mit PMK/LMK kostet Airtime; vorher die Latenz messen.
- **Fortschritt beim Flashen** `[App]` — *Nutzen: gering · Aufwand: klein* — `arduino-cli`-Ausgabe live an die App streamen statt nur am Ende melden. Flashen ist selten; der Nutzen liegt in der Fehlersuche bei einem hängenden Upload.
- **Ebenen-Übersicht** `[App]` — *Nutzen: gering · Aufwand: mittel* — Alle 8 Ebenen verkleinert nebeneinander, damit transparente Tasten und Konflikte sichtbar werden.
- **Heatmap pro Ebene** `[App]` — *Nutzen: gering · Aufwand: klein* — Zähler zusätzlich nach `layer` aus dem `KEY_PRESS`-Event trennen.
- **Heatmap-Export** `[App]` — *Nutzen: gering · Aufwand: klein* — Zähler als CSV/JSON exportieren, z. B. für Layout-Optimierung. Sinnvoll erst zusammen mit oder nach der Heatmap pro Ebene.
- **Gemeinsame Matrix-Konstanten** `[Tooling]` — *Nutzen: gering · Aufwand: mittel* — Pins, Größen und nicht vorhandene Tasten einmal definieren und in Web-App, `server.py` und Firmware prüfen. `tests/test_side_profiles.js` prüft die Profile bereits gegen die Firmware-Quellen; der Rest-Nutzen ist klein.
- **Tastatur-Bedienung im Editor** `[App]` — *Nutzen: gering · Aufwand: klein* — Pfeiltasten zum Wechseln der ausgewählten Taste.
- **Bildschirm-Tastatur als Picker** `[App]` — *Nutzen: gering · Aufwand: mittel* — Alternative zum `<select>`. Das Suchfeld über jeder Aktions-Auswahl deckt den Bedarf bereits weitgehend ab.

## zurückgestellte Punkte, die vorerst nicht umgesetzt werden

- **Echte LiPo-Spannungsmessung** `[Firmware]` — *Nutzen: hoch · Aufwand: mittel* — `BAT_SENSE` (GPIO 35) mit externem Spannungsteiler auswerten und den BLE-Batteriestand setzen; die App zeigt heute keinen Akku an (`updateBatteryUI` ist deaktiviert). Ohne Anzeige fällt die Tastatur ohne Vorwarnung aus. Braucht einen Hardware-Umbau (Spannungsteiler), deshalb unter den Split-Fehlern.

## Offene LOW-Befunde aus Code-Reviews

Befunde, die der Nutzer ausdrücklich zurückgestellt hat, und Hardware-Prüfungen, die nur an der Tastatur gehen. Jeder zurückgestellte Befund braucht beim Umsetzen einen Regressionstest.

- Hardware-Prüfung offen: Tottaste Alt + u eines Umlauts auf der linken Hälfte am Mac testen. Der Host-Test prüft nur die Reihenfolge der `SplitHidEvent`s; der Master sendet sie ohne Abstand.
- Hardware-Prüfung offen: ESP-NOW-Neustart der linken Hälfte. Den Master per Reset-Taste neu starten, während links getippt wird. Erwartet: `ESPNOW_RESTART` höchstens einmal pro Backoff (30 s, dann 60 s, 120 s ... bis 8 Min), danach `Master erreichbar=1` ohne Reset der linken Hälfte. Zusätzlich prüfen: `STATUS` meldet `ActivityRx=1`.
- Hardware-Prüfung offen: Synchronisierte Inaktivitäts-Timer. 6 Min nur rechts tippen; links darf nicht in Standby gehen (Serial `[POWER]`), und linke Tasten kommen ohne Verzögerung an. Der Host-Test prüft nur Parser und Drosselung, nicht den Funkweg Master -> links.
- Hardware-Prüfung offen: One-Shot-Shift links, dann Taste rechts (und umgekehrt); Caps Word über beide Hälften; One-Shot-Shift vor `UMLAUT_AE` ergibt `Ä`.

## Detailpläne

Derzeit kein offener Plan.

## Umgesetzt

- **Tasten-Heatmap & WPM-Anzeige** im Live-Monitor — PR #2.
- **Matrix-Test (Löt- und Dioden-Tester)** als eigener Tab — PR #3.
- **Ebenen-Werkzeuge:** Ebene kopieren, tauschen, leeren (als Snapshot vorgemerkt, rückgängig machbar) — PR #4.
- **Tastenpaare (Zwei-Tasten-Aktion):** eine Taste drückt zwei frei wählbare Tasten gleichzeitig (z. B. `Shift` + `.` = `:` auf deutschem macOS) — PR #5.
- **Tap-Dance / Doppel-Tippen:** dritte Aktion pro Taste; zwei Tipps innerhalb von 200 ms lösen sie aus.
- **Linke Hälfte:** eigene Firmware (Keymap, NVS, Config-BLE, Power Management) mit ESP-NOW zum Master; die App bearbeitet, synchronisiert und flasht beide Hälften.
- **Flash-Port-Auswahl:** `server.py` flasht nur den Port, dessen Board sich per `DEVICE_INFO.side` als die gewählte Hälfte meldet.
- **Profilverwaltung:** Dialog "Profile" speichert, lädt und löscht benannte Layouts pro Hälfte (`/api/profiles`, `layout_profiles*.json`) — PR #30.
- **Deutsche Zeichen im Keycode-Picker:** Gruppe "Deutsche Zeichen (macOS)" mit Shift-Zeichen (`:`, `+`, `*`, `?` …) als Einzelcode und Option-Zeichen (`@`, `€`, `{` …) als automatisch angelegtes Tastenpaar; Suchfeld über jeder Aktions-Auswahl.
- **Weitere deutsche Zeichen:** `<` (ISO-Taste `KEY_NON_US_BACKSLASH`, HID `0x64`), `>` (Tastenpaar Shift + ISO-Taste), `^`, `°`, `´` und `` ` `` in "Deutsche Zeichen (macOS)"; Zuordnung für den macOS-Tastaturtyp ISO.
- **macOS-Layout "U.S.":** Gruppe "Sonderzeichen (macOS US)" mit US-Zeichen, `§` über die ISO-Taste, `° € ´` als Tastenpaar; eigene Umlaut-Aktionen `UMLAUT_AE` … `UMLAUT_SZ` (Tottaste Alt + u, dann Vokal; ß = Alt + s); Preset und Vorlagen mit US-Beschriftung.
- **Konfigurierbarer Tapping-Term:** `tappingTermMs` (100–500 ms, Standard 200) pro Hälfte in NVS und App; steuert Mod-Tap und Tap-Dance — PR #19.
- **ESP-NOW-Neustart nach wiederholten Sendefehlern (linke Hälfte):** Nach 5 verworfenen Ereignissen in Folge und 5 s ohne Zustellung startet die linke Hälfte ESP-NOW neu (`ESPNOW_RESTART`; Backoff 30 s, verdoppelt je Neustart ohne Zustellung bis 8 Min). Scheitert der Neustart, startet das Board neu. Offen: Reaktion des Masters auf einen langen Link-Ausfall — PR #17.
- **Layout-Diff vor dem Sync:** "Auf ESP32 speichern" liest die Gerätebelegung mit `GET_CONFIG` und zeigt pro Taste und Ebenen-Name, was sich ändert; erst nach Bestätigung wird übertragen.
- **Synchronisierte Inaktivitäts-Timer:** Tippen am Master meldet `SPLIT_OP_ACTIVITY` (höchstens alle 10 s) an die linke Hälfte; sie geht nicht mehr in Standby oder Deep Sleep, solange rechts getippt wird.
- **Linke Tasten im Live-Monitor über den Master:** Die linke Hälfte meldet jede Matrix-Änderung als Diagnose-Op `SPLIT_OP_KEY_EVENT` (ohne HID-Wirkung, ohne Retry, höchstens halbe Sendewarteschlange); der Master gibt sie per USB als `SPLIT_KEY:` aus, und die App zeigt sie im Live-Monitor, in der Heatmap und im Matrix-Test der linken Hälfte.
- **LOW-Befunde aus Code-Reviews (Sammellauf):** 36 Befunde aus PR #17 bis #24 behoben, jeder mit Regressionstest (App-Sync, Layout-Diff, Split-Diagnose, ESP-NOW-Neustart, Inaktivitäts-Timer, `rebuild-app.sh`).
- **Matrix-Test für leere Tasten:** Jede Matrix-Änderung erzeugt eine `MATRIX:`-Zeile auf USB-Serial, unabhängig von Belegung, Ebene und Tap-Hold; der Matrix-Test zählt damit auch Tasten mit Aktion `0`. Die Zeile geht nur über USB, nie über BLE (Keylogger-Schutz, keine Last neben den Sync-Acks).
- **One-Shot-Modifier und Caps Word:** Aktionen `OSM_*` (`0x160`..`0x167`) und `CAPS_WORD` (`0x168`). Der Master führt den Zustand für beide Hälften (neue Split-Ops `ONE_SHOT_PRESS/RELEASE`, `CAPS_WORD_TOGGLE`); One-Shot-Shift links wirkt auf die nächste Taste rechts.
- **Makros:** Aktionen `MACRO_0`..`MACRO_15` (`0x170`..`0x17F`) mit bis zu 32 Schritten (Tippen, Drücken, Loslassen, Pause 1..5000 ms), nicht blockierend in `processDeferredKeys()`; links warten die Schritte auf freien Platz in der Sendewarteschlange. NVS kompakt (`num_macros`, `macro_lens`, `macros_data`), Editor im Combos-Tab, Sync nach den Tastenpaaren. Hardware-Prüfung offen: Makro mit `Cmd` + Taste auf beiden Hälften.
- **LOW-Befunde aus Code-Reviews (zweiter Sammellauf):** 33 Befunde aus PR #26 bis #30 behoben, jeder mit Regressionstest (Makro-Ablauf und NVS, Caps Word als Combo-Kandidat, `MODIFIER_HOLD`-Prüfung, Makro-Undo, Layout-Profile mit Revision und HTTP 409, Firmware-Abgleich im Datenverzeichnis, `build-app.sh`-Rollback, Standby-Hinweise pro Hälfte). Die Hardware-Prüfungen bleiben offen.
