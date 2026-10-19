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

- **Kabellos via Bluetooth:**
  1. Auf **„⚡ Bluetooth Live-Sync“** klicken.
  2. Im Browser-Dialog **„Dactyl Keyboard“** auswählen und verbinden.
  3. Jede Tastenänderung im GUI wird innerhalb von Millisekunden live in den NVS-Flash der Tastatur geschrieben.
- **Per USB-Kabel:**
  1. ESP32 per USB anschließen.
  2. Auf **„🔌 USB Live-Monitor“** klicken.
  3. Live-Tastendrücke werden im Visualizer sofort hervorgehoben.
- **Flashen:**
  - Mit einem Klick auf **„💾 Auf Dactyl flashen“** wird die C++-Keymap aktualisiert, kompiliert und direkt auf den ESP32 geschrieben.

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
