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

Kleine Befunde aus dem Review der linken Hälfte, bewusst auf später verschoben. Jeder Punkt braucht beim Umsetzen einen Regressionstest.

- `app.js` `applySelectFilter`: das Suchfeld wählt still die erste sichtbare Option, wenn die gewählte ausgeblendet wird; nach dem Leeren bleibt diese Wahl. Folge: Tippen in das Suchfeld ändert Halte- oder Doppel-Tipp-Aktion. Korrektur: Auswahl nur bei expliziter Wahl ändern, beim Leeren die vorherige Wahl wiederherstellen.
- `app.js` `applySelectFilter`: ohne Treffer bleibt eine ausgeblendete Option gewählt. Folge: "Änderung übernehmen" speichert eine unsichtbare Aktion. Korrektur: ohne Treffer den Übernehmen-Knopf sperren oder einen Hinweis zeigen.
- `app.js` `applySelectFilter`: der Filter vergleicht auch das Präfix "Halten = " bzw. "2× Tippen = ". Folge: eine Suche nach "halten", "tippen" oder "=" trifft jede Option der Halte- und Doppel-Tipp-Auswahl. Korrektur: die Suche ohne das Präfix vergleichen.
- `app.js` Apply-Handler (`btnApplyKey`): ein wiederverwendetes Tastenpaar, das selbst noch vorgemerkt ist, löst trotzdem ein sofortiges `SET_KEY` aus. Folge: das Gerät kennt das Paar noch nicht, die Taste sendet bis zum nächsten Sync nichts. Korrektur: die Taste nur vormerken, wenn ein genutztes Paar noch nicht synchronisiert ist.
- `app.js` `isKeyPairUsed`: die Prüfung ignoriert alte Zellen im String-Format (`"PAIR_2"` statt Objekt). Folge: `deleteKeyPair` fragt nicht nach, `removeKeyPairAt` leert diese Zellen trotzdem. Korrektur: String-Zellen gleich `PAIR_<idx>` in `isKeyPairUsed` erkennen.
- `tests/test_app_logic.js`: kein Test prüft `deleteKeyPair` (Nachfrage bei Nutzung, Snapshot-Flag, Revert stellt Paare, Ebenen und Combos wieder her). Folge: ein Fehler im Ablauf bleibt unentdeckt. Korrektur: den Ablauf als reine Funktion herauslösen und testen.
- `tests/test_app_logic.js`: kein Test prüft die Optionslisten (Combo ohne Tastenpaar-Zeichen, Gruppenposition, Ausblenden durch das Suchfeld). Folge: diese Annahmen haben keinen Regressionsschutz. Korrektur: Listenaufbau und Filter als reine Funktionen herauslösen und testen.
- `app.js:3924` `SCANCODE_MAP_RIGHT`: die Ersatztabelle des Live-Monitors beschriftet `Minus`, `BracketLeft`, `Semicolon`, `Quote` und `Slash` mit `ß`, `Ü`, `Ö`, `Ä` und `-`. Folge: mit dem macOS-Layout "U.S." zeigt der Live-Monitor deutsche Beschriftungen. Korrektur: die US-Zeichen als Beschriftung nutzen.
- `app.js:3982` `ACTION_CODE_TO_EVENT_CODES`: die Tabelle hat keine `UMLAUT_*`-Einträge und vertauscht `KEY_Y`/`KEY_Z` noch für das deutsche Layout. Folge: eine Taste mit Umlaut-Aktion leuchtet im Live-Monitor nicht auf. Korrektur: `UMLAUT_*` auf `KeyU`/`KeyS` abbilden und die Y/Z-Vertauschung entfernen.
- `firmware/dactyl_right/DactylLogic.h:146` `sendUmlaut`: die Folge beachtet kein physisch gehaltenes Shift oder Alt. Folge: gehaltenes Shift macht aus Alt + u die Folge Alt + Shift + u; das Alt-Release löst ein gehaltenes Alt. Korrektur: gehaltene Modifier vor der Folge lösen und danach wiederherstellen.
- `firmware/dactyl_right/DactylLogic.h:150` `sendUmlaut` auf der linken Hälfte: `delay(5)` verzögert nur das Einreihen in die ESP-NOW-Warteschlange. Folge: der Master sendet Alt, u und Vokal ohne Abstand an macOS. Korrektur: einen Test für die linke Hälfte ergänzen und die Tottaste auf der Hardware prüfen.
- `firmware/tests/test_firmware_logic.cpp:1710`: kein Test prüft einen Umlaut als Doppel-Tipp-Aktion oder als Halten, das ein Tastendruck einer anderen Taste erzwingt. Folge: ein Fehler in diesen Pfaden bleibt unentdeckt. Korrektur: Tests für den Doppel-Tipp-Pfad und das erzwungene Halten ergänzen.
- `AGENTS.md` (Abschnitt "macOS layout U.S."): der Text nennt `§` auf HID `0x64` ohne den Hinweis auf den macOS-Tastaturtyp. Folge: mit Tastaturtyp ANSI vertauscht macOS HID `0x35` und `0x64`, dann erscheint `§` nicht. Korrektur: den ISO/ANSI-Hinweis für `KEY_NON_US_BACKSLASH` wieder aufnehmen.


## Tooling & Qualität

- **Gemeinsame Matrix-Konstanten:** Pins, Größen und nicht vorhandene Tasten einmal definieren und in `app.js`, `server.py` und Firmware prüfen.
- **`app.js` aufteilen:** Datei hat über 3.000 Zeilen; Module für BLE, Serial, Editor und Live-Monitor.
