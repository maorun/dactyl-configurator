# Dactyl Configurator & True-Wireless ESP32 Firmware

Ein vollständiges Ökosystem für handverdrahtete ergonomische **Dactyl Manuform Split Keyboards** mit **ESP32** (WEMOS LOLIN32 Lite):
1. **ESP32 Firmware:** Bluetooth Low Energy (BLE HID) Tastatur mit eigenem GATT-Konfigurationsdienst, NVS-Flash-Speicherung, Layer-Navigation und voller Mac-Unterstützung (inkl. Mac Globe/Fn-Taste).
2. **Web Configurator & Live-Monitor:** Moderne Web-App (oder native macOS-App) mit Web-Bluetooth & Web-Serial für Tastenbelegung in Echtzeit (< 0,1s), Live-Keystroke-HUD und Flashen per Knopfdruck.

---

## ✨ Features

- **⚡ Kabelloses Live-Remapping (< 0,1s):** Über Web-Bluetooth GATT können Tasten und Ebenen-Namen im laufenden Betrieb geändert werden – ohne Neukompilieren oder Kabel. Alle Änderungen werden sofort dauerhaft im NVS-Flash des ESP32 gespeichert.
- **🔌 USB Live-Monitor:** Serieller Echtzeit-Stream (115.200 Baud) zur Anzeige physischer Matrix-Events (`KEY_PRESS`, `KEY_RELEASE`, `LAYER`), entprellt und mit HUD-Visualisierung.
- **💾 Flashen per Knopfdruck:** Integrierter lokaler Python-Server generiert C++-Keymaps und flasht den ESP32 automatisch per `arduino-cli`.
- **📑 Multi-Layer Engine:** 8 dynamische Ebenen mit Momentary Layer Switching (`MO_0` .. `MO_7`) und Toggle Layer Switching (`TG_0` .. `TG_7`).
- **🍎 Volle Apple macOS Unterstützung:**
  - Standard macOS Modifier (`Cmd`, `Alt/Option`, `Ctrl`, `Shift`).
  - Media Keys (Play/Pause, Mute, Volume Up/Down, Next, Prev, Stop).
  - Spezielle Apple **Globe / Fn-Taste** (`0x029D` / `KEY_MEDIA_GLOBE`) mit Press & Release Unterstützung für Chords und Emoji-Auswahl.
- **🔒 Sicherheit & Stabilität:**
  - FreeRTOS Mutex-Schutz zwischen Matrix-Scan im Arduino-Main-Loop und BLE/Serial GATT-Callbacks.
  - Server bindet an `127.0.0.1` mit strikter Host- und Origin-Validierung gegen CSRF.
  - Eingabevalidierung und Identifier-Sanitizing im C++-Codegenerator.

---

## 📐 Hardware & Matrix-Pinbelegung

Die Firmware ist für das **WEMOS LOLIN32 Lite** (ESP32-D0WDQ6-V3) Board ausgelegt.

- **Dioden:** 1N4148 (DO-35 Glas)
  - **Anode (ohne Ring):** An Schalterkontakt gelötet
  - **Kathode (mit schwarzem Ring):** An die durchgehende Zeilenleitung (Row) gelötet
- **Matrix-Prinzip:** `COL2ROW` mit internem Pullup auf den Spalten (`INPUT_PULLUP`). Die Zeilen werden zyklisch kurz als `OUTPUT` auf `LOW` gezogen.

### Pinout (Rechte Hand)

| Matrix-Leitung | GPIO Pin | Beschreibung / Position |
| :--- | :--- | :--- |
| **Row 0** | `GPIO 13` | Zahlenreihe (oben) |
| **Row 1** | `GPIO 14` | Obere Buchstabenreihe (`Z`, `U`, `I`, `O`, `P`, `Ü`) |
| **Row 2** | `GPIO 27` | Home Row (`H`, `J`, `K`, `L`, `Ö`, `Ä`, `Enter`) |
| **Row 3** | `GPIO 26` | Untere Buchstabenreihe (`N`, `M`, `,`, `.`, `-`, `Shift`) |
| **Row 4** | `GPIO 33` | Pfeiltasten & Modifier-Reihe |
| **Row 5** | `GPIO 32` | Daumen-Cluster (Row-Leitung) |
| **Col 0** | `GPIO 23` | Spalte 0 (Zeigefinger innen / `6`, `Z`, `H`, `N`) |
| **Col 1** | `GPIO 19` | Spalte 1 (`7`, `U`, `J`, `M`) |
| **Col 2** | `GPIO 18` | Spalte 2 (`8`, `I`, `K`, `,`) |
| **Col 3** | `GPIO 17` | Spalte 3 (`9`, `O`, `L`, `.`) |
| **Col 4** | `GPIO 16` | Spalte 4 (`0`, `P`, `Ö`, `-`) |
| **Col 5** | `GPIO 4`  | Spalte 5 (Außen / `ß`, `Ü`, `Ä`, `Shift`) |
| **Col 6** | `GPIO 25` | Spalte 6 (Daumen-Spalte & Delete) |

---

## 🚀 Schnellstart

### 1. Voraussetzungen

- **Python 3:** Für den lokalen Server (`server.py`).
- **Arduino CLI (optional fürs Flashen):**
  ```bash
  brew install arduino-cli
  arduino-cli core install esp32:esp32
  ```
- **Arduino Library:** [`ESP32-BLE-Keyboard`](https://github.com/T-vK/ESP32-BLE-Keyboard).
- **Browser:** Chromium-basierter Browser (Google Chrome, Arc, Brave, Edge, Opera) mit aktivierter Web-Bluetooth- und Web-Serial-Unterstützung.

### 2. Server starten

```bash
cd dactyl_configurator
python3 server.py
```

Der Server startet unter `http://localhost:8088`.

### 3. Tastatur verbinden

- **Kabellos via Bluetooth (Live-Sync & Remapping):**
  1. Auf der Tastatur die Hardware-Kombination **`R4C5 + R0C0`** für **0,5 Sekunden** gedrückt halten.
  2. Die Tastatur trennt macOS kurz und meldet sich als reines Konfigurationsgerät **„Dactyl Config“**.
  3. In der Web-App (oder der nativen macOS Desktop-App) auf **„⚡ Bluetooth Live-Sync“** klicken.
  4. Im Dialog **„Dactyl Config“** auswählen und verbinden.
  5. Tastenbelegungen und Ebenen-Namen werden in Echtzeit (< 0,1s) übertragen und dauerhaft im ESP32 NVS gespeichert!
  6. Zum Beenden: In der App auf **„Trennen“** klicken oder erneut **`R4C5 + R0C0`** drücken.
- **Per USB-Kabel (Live-Monitor):**
  1. ESP32 per USB-Kabel an den Rechner anschließen.
  2. Auf **„🔌 USB Live-Monitor“** klicken und den seriellen Port auswählen.
  3. Physische Tastendrücke und Layer-Wechsel werden im Visualizer sofort hervorgehoben.
- **Flashen per USB:**
  - Mit einem Klick auf **„💾 Auf Dactyl flashen“** kompiliert der lokale Server die C++-Keymap und flasht die Firmware per `arduino-cli` direkt auf den ESP32.

---

## ⚡ Drahtlose Bluetooth-Live-Konfiguration (Config Mode)

### Das macOS CoreBluetooth HID Exklusivitätsproblem
Unter macOS (sowohl in Google Chrome als auch in nativen Electron-Apps) sperrt das Betriebssystem aktive BLE-HID-Tastaturen (`HID Service 0x1812` / `Appearance 0x03C1`) für generische GATT-Dienste wie den Web-Bluetooth Config-Service. Trennt man die Tastatur über die macOS-Bluetooth-Einstellungen, verbindet macOS sie innerhalb von Millisekunden automatisch wieder.

### Die Lösung: Der Firmware Config-Modus
Die Firmware löst dieses Problem elegant und ohne physischen Ein/Aus-Schalter:

1. **Hardware-Auslöser `R4C5 + R0C0`:**
   - **`R0C0`**: Zeile 0, Spalte 0 (Taste `6` ganz links oben in der Zahlenreihe).
   - **`R4C5`**: Zeile 4, Spalte 5 (unterste rechte Randtaste neben den Pfeiltasten).
   - Werden beide Tasten für **0,5 Sekunden gleichzeitig gehalten**, wechselt die Firmware sofort in den Konfigurationsmodus.
   - **100% Layer-unabhängig:** Die Abfrage erfolgt direkt auf den GPIO-Pins der Hardware-Matrix. Es spielt keine Rolle, welcher Layer aktiv ist oder welche logische Taste darauf gemappt ist.
   - Funktioniert im laufenden Akkubetrieb ohne Neustart des ESP32.

2. **Verhalten im Config-Modus:**
   - Der ESP32 trennt aktiv alle HID-Peers (macOS).
   - Das BLE-Advertising wird gestoppt und als **`"Dactyl Config"`** neu gestartet – mit `Appearance 0x0000` (Generic) und **ausschließlich** dem `CONFIG_SERVICE_UUID` (ohne HID 0x1812!).
   - macOS ignoriert das Gerät nun vollständig, sodass Web-Bluetooth (Chrome oder Electron) sofort verbinden kann.
   - Der Matrix-Scan bleibt aktiv und streamt `KEY_PRESS`-Events in den App-Live-Monitor, unterdrückt aber lokale Keystroke-Injektionen in macOS (verhindert Fehlbedienung während des Mappings).

3. **Config-Modus beenden:**
   - **In der App:** Auf den Button **„Trennen“** klicken (sendet den GATT-Befehl `EXIT_CONFIG`).
   - **Auf der Tastatur:** Erneut **`R4C5 + R0C0`** für 0,5s gedrückt halten.
   - **Automatisch:** Bei 3 Minuten Inaktivität im Config-Modus kehrt die Tastatur automatisch in den Normalbetrieb zurück.
   - Nach dem Beenden startet die Tastatur wieder das reguläre HID-Advertising als **`"Dactyl Keyboard"`** und verbindet sich nahtlos wieder mit macOS.

---

## 🔋 Power Management & Akkubetrieb (Two-Stage Sleep)

Für den echten kabellosen LiPo-Akkubetrieb verfügt die Firmware über eine intelligente, zweistufige Stromspararchitektur:

1. **Stufe 1: Standby / Light Sleep (Standard: 5 Minuten)**
   - Drosselt die ESP32-CPU von 240 MHz auf **80 MHz** und senkt den Matrix-Scan von 100 Hz auf 20 Hz.
   - Die BLE-Verbindung zu macOS bleibt **vollständig aktiv** (kein Reconnect nötig).
   - **0 ms Latenz:** Der erste Tastenanschlag weckt die CPU sofort wieder auf 240 MHz auf.
   - Spart ca. 70% Energie bei kurzen Tipp-Pausen.

2. **Stufe 2: Deep Sleep (Standard: 60 Minuten)**
   - Schaltet den ESP32 bei längerer Abwesenheit in den tiefen Tiefschlaf (**~10–15 µA Stromaufnahme**).
   - Alle 6 Matrix-Zeilen (`GPIO 13, 14, 27, 26, 33, 32`) sind RTC-Pins und werden als **`EXT1 ANY_HIGH` Wakeup-Quellen** konfiguriert.
   - Die Spalten-Pins werden im Schlaf per Hardware-Hold auf `HIGH` gehalten.
   - **Aufwecken:** Ein Druck auf **jede beliebige Taste** der Tastatur weckt den ESP32 innerhalb von ~150 ms auf und verbindet ihn automatisch wieder mit dem Mac.

3. **Akkuüberwachung (GPIO 35):**
   - Der ADC liest die Batteriespannung ein und meldet den Ladestand in Prozent sowohl über den Standard **BLE Battery Service (`0x180F`)** an macOS als auch über `DEVICE_INFO` an die Web-App.
   - *Hardware-Hinweis für WEMOS LOLIN32 Lite:* Im Gegensatz zu Boards wie dem D32 Pro hat das LOLIN32 Lite **keinen internen Spannungsteiler** an GPIO 35. Für eine echte VBAT-Messung wird ein externer 1:2 Teiler (z.B. zwei 100 kΩ Widerstände zwischen VBAT, GPIO 35 und GND) empfohlen; ohne diesen liest der freie GPIO 35 0 V.

---


## 📁 Projektstruktur

```
dactyl_configurator/
├── firmware/
│   └── dactyl_right/
│       └── dactyl_right.ino      # ESP32 Arduino Firmware (BLE HID & GATT Config)
├── AGENTS.md                     # Vollständige Architektur- & Schnittstellendokumentation
├── app.js                        # Configurator UI-Logik, Web-Bluetooth & Web-Serial
├── index.html                    # Single-Page-App Dashboard
├── style.css                     # Modernes Dark-Mode CSS Layout
├── server.py                     # Lokaler Python Backend-Server (Flash & Sync API)
├── current_config.json           # Persistierte Keymaps, Combos & Einstellungen
├── .gitignore                    # Git Ignore Definitionen
└── README.md                     # Diese Dokumentation
```

---

## ⌨️ Action Codes & Keycode-Spezifikation

| Bereich | Typ | Beispiele | Verhalten |
| :--- | :--- | :--- | :--- |
| `0x00` | Keystroke leer | `0` (`NONE`) | Transparent (fällt auf Layer 0 zurück) |
| `0x20` .. `0x7E` | ASCII Zeichen | `'a'`, `'1'`, `' '` | Normaler Tastenanschlag |
| `0x80` .. `0x87` | HID Modifier | `KEY_LEFT_GUI`, `KEY_LEFT_ALT` | Modifier-Hold |
| `0x100` .. `0x107` | Momentary Layer | `ACT_MO_0` .. `ACT_MO_7` | Ebene aktiv, solange Taste gehalten wird |
| `0x110` .. `0x117` | Toggle Layer | `ACT_TG_0` .. `ACT_TG_7` | Einrastende Ebene; `TG_0` setzt auf Base zurück |
| `0x120` .. `0x126` | Media Keys | `Play/Pause`, `Mute`, `Vol+`, `Vol-` | Consumer Control HID |
| `0x127` | Apple Mac Globe | `ACT_MAC_GLOBE` (`0x029D`) | Emojis / Fn-Tastenkombinationen |

---

## 📄 Lizenz

MIT License. Frei verwendbar für DIY-Keyboard-Enthusiasten und Maker.
