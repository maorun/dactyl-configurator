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
- `LOW`-Befunde aus Code-Reviews stehen nicht in der Rangliste, sondern unter "Offene LOW-Befunde aus Code-Reviews" (Regel in `AGENTS.md`). Ein späterer, eigener Lauf behebt sie gemeinsam.

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

Kleine Befunde aus Reviews, bewusst auf später verschoben. Jeder Punkt braucht beim Umsetzen einen Regressionstest.

- Hardware-Prüfung offen: Tottaste Alt + u eines Umlauts auf der linken Hälfte am Mac testen. Der Host-Test prüft nur die Reihenfolge der `SplitHidEvent`s; der Master sendet sie ohne Abstand.
- Hardware-Prüfung offen: ESP-NOW-Neustart der linken Hälfte. Den Master per Reset-Taste neu starten, während links getippt wird. Erwartet: `ESPNOW_RESTART` höchstens einmal pro Backoff (30 s, dann 60 s, 120 s ... bis 8 Min), danach `Master erreichbar=1` ohne Reset der linken Hälfte. Zusätzlich prüfen: `STATUS` meldet `ActivityRx=1`.
- Hardware-Prüfung offen: Synchronisierte Inaktivitäts-Timer. 6 Min nur rechts tippen; links darf nicht in Standby gehen (Serial `[POWER]`), und linke Tasten kommen ohne Verzögerung an. Der Host-Test prüft nur Parser und Drosselung, nicht den Funkweg Master -> links.
- `firmware/dactyl_right/DactylLogic.h` (`dispatchPress`, Zweig One-Shot/Caps Word): Eine One-Shot- oder Caps-Word-Taste, die Combo-Kandidat ist, sendet sofort und wird nicht gepuffert. Folge: Löst die Combo aus, ruft `releaseAll()` die gehaltene One-Shot-Taste ohne Vormerken ab; ein Caps-Word-Umschalten bleibt aber bestehen. Korrektur: Caps Word als Combo-Kandidat puffern (`isComboCandidateKey`) und in `processDeferredKeys` / `activateTapHoldAsHold` nachsenden.
- `firmware/dactyl_right/DactylLogic.h` (`checkUserCombos`, `MODIFIER_HOLD`): Combo-Verhalten `MODIFIER_HOLD` mit `OSM_*` oder `CAPS_WORD` sendet nichts (Code > 0xFF). Folge: stille Fehlkonfiguration. Korrektur: In App und `server.py` diese Aktionen für `MODIFIER_HOLD` ablehnen oder sie dort als gehaltenen Modifier ausführen.
- `firmware/dactyl_right/DactylLogic.h` (`heldModifierMask`): Gehaltene One-Shot-Tasten zählen nicht. Folge: Ein Umlaut, während eine One-Shot-Taste gehalten ist, bekommt den Modifier nicht (Alt im Report blockt den Verbrauch) — gewollt, aber undokumentiert. Korrektur: Verhalten in `AGENTS.md` dokumentieren und mit Test absichern.
- Hardware-Prüfung offen: One-Shot-Shift links, dann Taste rechts (und umgekehrt); Caps Word über beide Hälften; One-Shot-Shift vor `UMLAUT_AE` ergibt `Ä`.
- `server.py:84` (`sync_firmware_sources`): `copytree(..., dirs_exist_ok=True)` löscht keine Dateien, die eine neuere App-Version entfernt hat. Folge: Eine veraltete `.h`/`.cpp` bleibt im Daten-Sketch, und `arduino-cli` kompiliert sie mit. Korrektur: Den Daten-Sketch vor dem Kopieren entfernen oder veraltete Dateien löschen.
- `server.py:221` (`sync_firmware_sources`): Der Abgleich überschreibt die gerenderte `.ino` der anderen Hälfte mit der Vorlage (ID 0). Folge: Die Datei im Datenverzeichnis zeigt bis zum nächsten Flash dieser Hälfte nicht deren Layout; ein Flash rendert sie neu. Korrektur: Die `.ino` beider Hälften beim Abgleich auslassen.
- `server.py:221` (`save_config_and_firmware`): `sync_firmware_sources` läuft vor dem atomaren Schreiben und wird nicht zurückgerollt. Folge: Ein Fehler beim Schreiben hinterlässt einen halb aktualisierten Daten-Sketch. Korrektur: Sketches in ein Temp-Verzeichnis kopieren und danach umbenennen.
- `scripts/build-app.sh:36`: Das Skript führt `rm -rf` auf dem alten App-Verzeichnis aus und danach `mv`. Folge: Ein Abbruch zwischen beiden Schritten hinterlässt ein Paket ohne App-Verzeichnis. Korrektur: Das alte Verzeichnis zur Seite umbenennen, das neue verschieben, dann das alte löschen.
- `scripts/build-app.sh:47`: `codesign` läuft nach dem Austausch ohne Rollback. Folge: Ein Signaturfehler hinterlässt ein ungültig signiertes Paket. Korrektur: Das vorherige App-Verzeichnis behalten, bis `codesign --verify` besteht.
- `tests/test_server.py:337` (`test_data_dir_keeps_bundle_unchanged_and_flashes_a_copy`): Der Test gleicht nur einmal ab; ein zweiter Flash und veraltete Dateien sind nicht abgedeckt. Folge: Ein Fehler beim Überschreiben schreibgeschützter Paketdateien bleibt unentdeckt. Korrektur: Einen zweiten Speicheraufruf und eine Prüfung auf veraltete Dateien ergänzen.

- `firmware/dactyl_right/DactylLogic.h` (`macroTick`, letzter Schritt): Ein `PAUSE` als letzter Schritt beendet das Makro sofort. Folge: Die Pause wirkt nicht, ein neuer Druck startet das Makro ohne Wartezeit. Korrektur: Makro bis zum Ende der letzten Pause aktiv halten oder eine Pause am Ende im Editor ablehnen.
- `firmware/dactyl_right/DactylLogic.h` (`macroTick`), `dactyl_right.ino` / `dactyl_left.ino` (`loop`): Ein laufendes Makro setzt `lastActivityTime` nicht zurück. Folge: Ein langes Makro (bis 160 s) überdauert einen kurzen Standby-Timeout; der Scan läuft dann mit 40 ms, die Schritte verzögern sich. Korrektur: `lastActivityTime` in `macroTick` setzen, solange ein Makro läuft.
- `firmware/dactyl_right/DactylLogic.h` (`saveMacrosToNVS`): `num_macros` wird vor `macro_lens` und `macros_data` geschrieben. Folge: Nach einem Stromausfall mitten im Schreiben lädt ein gemischter Makro-Satz, wenn Anzahl und Gesamtlänge zufällig passen. Korrektur: `num_macros` zuletzt schreiben oder eine Prüfsumme speichern und beim Laden prüfen.
- `js/config-sync.js` (`writeConfigToESP32`, Makro-Phase): `countSyncSteps` zählt je Makro einen Schritt, die übersprungene Phase (`ERR UNKNOWN CLEAR_MACROS`) ruft dafür kein `updateProgress` auf. Folge: Der Fortschrittsbalken endet bei alter Firmware unter 100 %. Korrektur: Pro übersprungenem Makro `updateProgress()` aufrufen.
- `js/macros-ui.js` (`deleteMacro`): Der Revert ersetzt alle Ebenen durch den Stand vor dem Löschen. Folge: Tastenänderungen nach dem Löschen gehen bei "Rückgängig" verloren. Korrektur: Nur die geleerten Verweise zurücksetzen oder Rückgängig bei späteren Ebenen-Änderungen sperren (wie `isUndoBlocked`).
- `firmware/tests/test_firmware_logic.cpp`: Kein Test für eine Makro-Taste als gepufferter Combo-Kandidat (`processDeferredKeys`) und für ungültige NVS-Formen (`macro_lens` falsch lang, Länge > 32). Folge: Diese Zweige sind ohne Regressionsschutz. Korrektur: Tests für beide Fälle ergänzen.
- `tests/test_app_logic.js`: Kein Test für `js/macros-ui.js` (Speichern, Löschen, Revert) und für den Staging-Zweig `keyNeedsStagedMacros` in `js/editor-events.js`. Folge: Diese Pfade prüft nur ein manueller Headless-Lauf. Korrektur: DOM-Stub-Test für `saveMacroFromUI`, `deleteMacro`, Revert und den Staging-Zweig ergänzen.
- `firmware/dactyl_right/DactylLogic.h` (`handleConfigCommand`, `ADD_MACRO_STEP`): Ein Schritt an das gerade laufende Makro verlängert den Lauf; nur `CLEAR_MACROS` stoppt ihn. Folge: Ein Live-Edit ändert ein laufendes Makro mitten im Ablauf. Korrektur: Laufendes Makro in `ADD_MACRO` / `ADD_MACRO_STEP` stoppen und mit Test absichern.
- `js/config-model.js` (`normalizeConfig`, `macros`): Ungültige Makros werden vor der Indizierung entfernt. Folge: Spätere `MACRO_n`-Verweise zeigen still auf ein anderes Makro. Korrektur: Ein ungültiges Makro durch ein leeres ersetzen oder die ganze Liste ablehnen.
- `js/config-sync.js` (Layout-Diff), `AGENTS.md`: `GET_CONFIG` und der Layout-Diff enthalten keine Makros; `AGENTS.md` nennt diese Grenze nicht. Folge: Der Diff zeigt "keine Änderung", obwohl die Makros auf dem Gerät abweichen. Korrektur: In `AGENTS.md` dokumentieren, dass Makros wie Combos und Tastenpaare nicht im Diff stehen.
- `firmware/tests/test_firmware_logic.cpp`: Kein Test für ein Makro mit `up` eines Modifiers, den der User physisch hält. Folge: Die dokumentierte Grenze hat keinen Regressionstest. Korrektur: Test ergänzen, der das dokumentierte Loslassen festschreibt.
- `js/config-model.js` (`isValidMacroStep`): Der Operator `in` akzeptiert geerbte Namen wie `"constructor"` als Schritt-Typ. Folge: Eine importierte Datei besteht die Prüfung; der Sync sendet dann einen ungültigen Befehl und bricht ab. Korrektur: `Object.hasOwn(MACRO_STEP_TYPES, step.type)` verwenden und einen Test für `"constructor"` ergänzen.
- `js/editor-events.js` (Import, `markPendingSync`): Die Import-Änderung setzt `pairs: true`, aber nicht `macros: true`. Folge: Nach einem Import geht eine Taste mit `MACRO_n` live, bevor die Makros synchronisiert sind. Korrektur: `macros: true` in der Import-Änderung setzen und einen Staging-Test ergänzen.
- `README.md` (Aktionscode-Tabelle): Die Tabelle nennt One-Shot und Caps Word, aber nicht `0x170`..`0x17F`. Folge: Leser der README finden den Makro-Bereich nicht. Korrektur: Zeile für Makros ergänzen.
- `js/config-model.js` (`findLayoutProfileIndex`): Die App vergleicht Profilnamen mit `toLowerCase`, `server.py` mit `casefold`. Folge: "Straße" und "STRASSE" gelten in der App als verschieden; der Server lehnt die Liste als Duplikat ab. Korrektur: In JS einen `casefold`-gleichen Vergleich verwenden und testen.
- `server.py` (`load_profiles`): Ein einziges ungültiges Profil macht die ganze Datei ungültig (HTTP 500). Folge: Nach einer strengeren Validierungsregel kann der Nutzer seine Profile in der App weder laden noch löschen. Korrektur: Ungültige Einträge beim Laden überspringen und melden oder einen Reparaturweg anbieten.
- `js/layout-profiles-ui.js` (`fetchLayoutProfiles`): `data.profiles` wird ohne Formprüfung gelesen. Folge: Eine Antwort ohne Liste wirft einen `TypeError` mit unklarer Meldung. Korrektur: `Array.isArray(data.profiles)` prüfen und einen klaren Fehler werfen.
- `server.py` (`POST /api/profiles`): Der POST ersetzt die ganze Datei ohne Version. Folge: Zwei App-Fenster überschreiben sich gegenseitig (last write wins), ein Profil geht verloren. Korrektur: Ein Revisionsfeld speichern und einen veralteten Schreibzugriff mit HTTP 409 ablehnen.
- `tests/test_app_logic.js` (Layout-Profile laden): Der Test prüft nur den Quelltext per Regex. Folge: Revert, Seitenprüfung und Busy-Sperre von `loadLayoutProfile` sind ohne Verhaltenstest. Korrektur: `js/layout-profiles-ui.js` mit DOM-Stubs ausführen und Pending Change, Revert und Seitenprüfung prüfen.
- `js/layout-profiles-ui.js` (`openLayoutProfilesDialog`): Wird der Dialog während eines laufenden Schreibzugriffs neu geöffnet, sind die Knöpfe aktiv, reagieren aber nicht (`layoutProfilesBusy` ist noch gesetzt). Folge: Klicks auf Speichern, Laden und Löschen bleiben ohne Meldung. Korrektur: Nach jedem Rendern `setLayoutProfilesBusy(layoutProfilesBusy)` aufrufen und einen Status "Speichert …" zeigen.
- `tests/test_server.py` (Layout-Profile): Kein Test für Namen, die App und Server unterschiedlich normalisieren (Leerzeichen nach dem Kürzen, `casefold`-Duplikate). Folge: Ein Auseinanderlaufen der Regeln bleibt unentdeckt. Korrektur: Server-Fälle für beide Namen ergänzen.

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
- **Profilverwaltung:** Dialog "Profile" speichert, lädt und löscht benannte Layouts pro Hälfte (`/api/profiles`, `layout_profiles*.json`).
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
