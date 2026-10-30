#!/usr/bin/env python3
"""
Dactyl Configurator Local Server
Bietet Web-App auf Port 8088 und REST-API zum Speichern & Flashen der Firmware auf den ESP32.
"""

import http.server
import socketserver
import webbrowser
import os
import sys
import json
import glob
import re
import secrets
import shutil
import signal
import subprocess
import tempfile
import fcntl
import select
import time
import termios
from urllib.parse import parse_qs, urlsplit

# Sicherstellen, dass Standard-Binärpfade (Homebrew unter macOS Apple Silicon / Intel) im PATH vorhanden sind
EXTRA_PATHS = [
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    os.path.expanduser("~/.local/bin"),
    os.path.expanduser("~/bin"),
]
_current_paths = os.environ.get("PATH", "").split(os.pathsep)
for _p in EXTRA_PATHS:
    if _p not in _current_paths and os.path.isdir(_p):
        _current_paths.insert(0, _p)
os.environ["PATH"] = os.pathsep.join(_current_paths)

PORT = 8088
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
# Schreibbarer Laufzeitzustand. Die Desktop-App setzt DACTYL_DATA_DIR, weil ihr Paket signiert und schreibgeschützt
# ist; ohne die Variable (python3 server.py im Repository) liegt alles neben server.py.
DATA_DIR = os.path.abspath(os.environ.get("DACTYL_DATA_DIR") or DIRECTORY)
SOURCE_FIRMWARE_DIR = os.path.join(DIRECTORY, "firmware")
FIRMWARE_DIR = os.path.join(DATA_DIR, "firmware")
FIRMWARE_SKETCHES = ("dactyl_right", "dactyl_left")
# current_config*.json ist lokaler Laufzeitzustand der App (in .gitignore); default_config*.json die versionierte Vorlage.
# Jede Tastaturhälfte hat eigene Dateien und einen eigenen Sketch. Die Tests ersetzen diese Pfade.
CONFIG_FILE = os.path.join(DATA_DIR, "current_config.json")
DEFAULT_CONFIG_FILE = os.path.join(DIRECTORY, "default_config.json")
INO_FILE = os.path.join(FIRMWARE_DIR, "dactyl_right", "dactyl_right.ino")
SKETCH_DIR = os.path.join(FIRMWARE_DIR, "dactyl_right")
LEFT_CONFIG_FILE = os.path.join(DATA_DIR, "current_config_left.json")
LEFT_DEFAULT_CONFIG_FILE = os.path.join(DIRECTORY, "default_config_left.json")
LEFT_INO_FILE = os.path.join(FIRMWARE_DIR, "dactyl_left", "dactyl_left.ino")
LEFT_SKETCH_DIR = os.path.join(FIRMWARE_DIR, "dactyl_left")
# Benannte Layout-Profile je Hälfte (lokaler Laufzeitzustand wie current_config*.json)
PROFILES_FILE = os.path.join(DATA_DIR, "layout_profiles.json")
LEFT_PROFILES_FILE = os.path.join(DATA_DIR, "layout_profiles_left.json")
MAX_PROFILES = 32
# Automatische Backups je Hälfte vor jedem Sync und Flash (lokaler Laufzeitzustand, in .gitignore)
BACKUP_DIR = os.path.join(DATA_DIR, "config_backups", "right")
LEFT_BACKUP_DIR = os.path.join(DATA_DIR, "config_backups", "left")
MAX_BACKUPS = 20
# Ein Sync legt höchstens alle 10 Minuten ein Backup an (der Live-Sync läuft nach jeder Änderung); ein Flash immer
BACKUP_MIN_INTERVAL_S = 600
BACKUP_REASONS = ("sync", "flash")
# Mit eigenem Datenverzeichnis ist die .ino aus dem Paket die Vorlage; gerendert und kompiliert wird eine Kopie.
# None: die .ino wird an Ort und Stelle gerendert (Repository).
SEPARATE_FIRMWARE = FIRMWARE_DIR != SOURCE_FIRMWARE_DIR
INO_TEMPLATE_FILE = os.path.join(SOURCE_FIRMWARE_DIR, "dactyl_right", "dactyl_right.ino") if SEPARATE_FIRMWARE else None
LEFT_INO_TEMPLATE_FILE = os.path.join(SOURCE_FIRMWARE_DIR, "dactyl_left", "dactyl_left.ino") if SEPARATE_FIRMWARE else None

SIDES = ("R", "L")
# Physisch nicht vorhandene Tasten (rechts R4C0/R5C5, links gespiegelt R4C5/R5C0): dort darf keine Aktion liegen
ABSENT_KEYS = {"R": {(4, 0), (5, 5)}, "L": {(4, 5), (5, 0)}}
DEFAULT_DEVICE_NAMES = {"R": "Dactyl Keyboard", "L": "Dactyl Links"}


def side_paths(side):
    """Dateien einer Hälfte. Liest die Modulvariablen bei jedem Aufruf (Tests ersetzen sie)."""
    if side == "L":
        return {"config": LEFT_CONFIG_FILE, "default": LEFT_DEFAULT_CONFIG_FILE, "ino": LEFT_INO_FILE,
                "template": LEFT_INO_TEMPLATE_FILE or LEFT_INO_FILE, "sketch": LEFT_SKETCH_DIR,
                "profiles": LEFT_PROFILES_FILE, "backups": LEFT_BACKUP_DIR}
    return {"config": CONFIG_FILE, "default": DEFAULT_CONFIG_FILE, "ino": INO_FILE,
            "template": INO_TEMPLATE_FILE or INO_FILE, "sketch": SKETCH_DIR, "profiles": PROFILES_FILE,
            "backups": BACKUP_DIR}


def remove_tree(path):
    """Löscht ein Verzeichnis auch dann, wenn ältere Kopien die Rechte des Pakets (0555) übernommen haben."""
    if not os.path.isdir(path):
        return
    for dirpath, _, _ in os.walk(path):
        try:
            os.chmod(dirpath, 0o755)
        except OSError:
            pass
    shutil.rmtree(path, ignore_errors=True)


def sync_firmware_sources():
    """Kopiert die Firmware-Quellen des Pakets in das Datenverzeichnis (beide Sketches: links bindet
    ../dactyl_right/ ein). So kompiliert ein Flash nach einem App-Update immer die Quellen dieser Version.

    Jeder Sketch entsteht vollständig in einem Temp-Verzeichnis und ersetzt erst danach den alten: Dateien, die
    eine neuere App-Version entfernt hat, bleiben nicht liegen, und ein Fehler beim Kopieren hinterlässt keinen
    halb aktualisierten Sketch. Eine gerenderte .ino im Datenverzeichnis bleibt erhalten (ein Flash der Hälfte rendert
    sie aus der Vorlage im Paket neu); fehlt sie, kommt die Vorlage aus dem Paket."""
    if not SEPARATE_FIRMWARE:
        return
    os.makedirs(FIRMWARE_DIR, exist_ok=True)
    # Reste eines hart abgebrochenen Laufs (.<sketch>.*.new / .old) entfernen
    for entry in os.listdir(FIRMWARE_DIR):
        if entry.startswith(".") and entry.endswith((".new", ".old")) and \
                any(entry.startswith(f".{name}.") for name in FIRMWARE_SKETCHES):
            remove_tree(os.path.join(FIRMWARE_DIR, entry))
    staged = []
    try:
        for name in FIRMWARE_SKETCHES:
            target = os.path.join(FIRMWARE_DIR, name)
            stage = tempfile.mkdtemp(prefix=f".{name}.", suffix=".new", dir=FIRMWARE_DIR)
            staged.append((stage, target))
            ino = f"{name}.ino"
            source = os.path.join(SOURCE_FIRMWARE_DIR, name)
            shutil.copytree(source, stage, dirs_exist_ok=True,
                            ignore=lambda directory, names, ino=ino, source=source: [ino] if directory == source and ino in names else [])
            # copytree übernimmt die Rechte des Pakets: Verzeichnisse beschreibbar machen (Ersetzen, Löschen, .ino)
            for dirpath, _, _ in os.walk(stage):
                os.chmod(dirpath, 0o755)
            # Gerenderte .ino behalten; ohne sie (erster Abgleich) die Vorlage, damit jeder Sketch vollständig ist
            rendered = os.path.join(target, ino)
            shutil.copy2(rendered if os.path.isfile(rendered) else os.path.join(source, ino), os.path.join(stage, ino))
        # Erst alle alten Sketches zur Seite legen, dann alle neuen einsetzen. Ein Fehler stellt beide alten
        # wieder her: die Sketches bleiben ein zusammengehöriger Stand (links bindet ../dactyl_right/ ein).
        moved, placed = [], []
        try:
            for stage, target in staged:
                if os.path.exists(target):
                    old = tempfile.mkdtemp(prefix=f".{os.path.basename(target)}.", suffix=".old", dir=FIRMWARE_DIR)
                    os.rmdir(old)
                    os.replace(target, old)
                    moved.append((old, target))
                os.replace(stage, target)
                placed.append(target)
        except BaseException:
            for target in placed:
                remove_tree(target)
            for old, target in moved:
                if os.path.exists(target):
                    remove_tree(target)
                os.replace(old, target)
            raise
        for old, _ in moved:
            remove_tree(old)
    finally:
        for stage, _ in staged:
            if os.path.exists(stage):
                remove_tree(stage)


def parse_side(path):
    """Liest ?side=L|R aus dem Pfad. Ohne Parameter gilt R (ältere App-Versionen); ein anderer Wert ergibt None."""
    values = parse_qs(urlsplit(path).query).get("side")
    if not values:
        return "R"
    return values[0] if len(values) == 1 and values[0] in SIDES else None

KEY_TO_CPP = {
    "KEY_A": "'a'", "KEY_B": "'b'", "KEY_C": "'c'", "KEY_D": "'d'",
    "KEY_E": "'e'", "KEY_F": "'f'", "KEY_G": "'g'", "KEY_H": "'h'",
    "KEY_I": "'i'", "KEY_J": "'j'", "KEY_K": "'k'", "KEY_L": "'l'",
    "KEY_M": "'m'", "KEY_N": "'n'", "KEY_O": "'o'", "KEY_P": "'p'",
    "KEY_Q": "'q'", "KEY_R": "'r'", "KEY_S": "'s'", "KEY_T": "'t'",
    "KEY_U": "'u'", "KEY_V": "'v'", "KEY_W": "'w'", "KEY_X": "'x'",
    "KEY_Y": "'y'", "KEY_Z": "'z'",
    "KEY_1": "'1'", "KEY_2": "'2'", "KEY_3": "'3'", "KEY_4": "'4'",
    "KEY_5": "'5'", "KEY_6": "'6'", "KEY_7": "'7'", "KEY_8": "'8'",
    "KEY_9": "'9'", "KEY_0": "'0'",
    "KEY_MINUS": "'-'",
    "KEY_EQUAL": "'='",
    "KEY_LEFT_BRACKET": "'['",
    "KEY_RIGHT_BRACKET": "']'",
    "KEY_BACKSLASH": "'\\\\'",
    "KEY_SEMICOLON": "';'",
    "KEY_QUOTE": "'\\''",
    "KEY_GRAVE": "'`'",
    "KEY_COMMA": "','",
    "KEY_PERIOD": "'.'",
    "KEY_SLASH": "'/'",
    "KEY_SPACE": "' '",
    "KEY_RETURN": "KEY_RETURN",
    "KEY_ESC": "KEY_ESC",
    "KEY_BACKSPACE": "KEY_BACKSPACE",
    "KEY_TAB": "KEY_TAB",
    "KEY_DELETE": "KEY_DELETE",
    "KEY_UP_ARROW": "KEY_UP_ARROW",
    "KEY_DOWN_ARROW": "KEY_DOWN_ARROW",
    "KEY_LEFT_ARROW": "KEY_LEFT_ARROW",
    "KEY_RIGHT_ARROW": "KEY_RIGHT_ARROW",
    "KEY_PAGE_UP": "KEY_PAGE_UP",
    "KEY_PAGE_DOWN": "KEY_PAGE_DOWN",
    "KEY_HOME": "KEY_HOME",
    "KEY_END": "KEY_END",
    "KEY_LEFT_CTRL": "KEY_LEFT_CTRL",
    "KEY_LEFT_SHIFT": "KEY_LEFT_SHIFT",
    "KEY_LEFT_ALT": "KEY_LEFT_ALT",
    "KEY_LEFT_GUI": "KEY_LEFT_GUI",
    "KEY_RIGHT_CTRL": "KEY_RIGHT_CTRL",
    "KEY_RIGHT_SHIFT": "KEY_RIGHT_SHIFT",
    "KEY_RIGHT_ALT": "KEY_RIGHT_ALT",
    "KEY_RIGHT_GUI": "KEY_RIGHT_GUI",
    "MOD_LCTRL": "KEY_LEFT_CTRL",
    "MOD_LSHIFT": "KEY_LEFT_SHIFT",
    "MOD_LALT": "KEY_LEFT_ALT",
    "MOD_LGUI": "KEY_LEFT_GUI",
    "MOD_RCTRL": "KEY_RIGHT_CTRL",
    "MOD_RSHIFT": "KEY_RIGHT_SHIFT",
    "MOD_RALT": "KEY_RIGHT_ALT",
    "MOD_RGUI": "KEY_RIGHT_GUI",
    "KEY_F1": "KEY_F1", "KEY_F2": "KEY_F2", "KEY_F3": "KEY_F3", "KEY_F4": "KEY_F4",
    "KEY_F5": "KEY_F5", "KEY_F6": "KEY_F6", "KEY_F7": "KEY_F7", "KEY_F8": "KEY_F8",
    "KEY_F9": "KEY_F9", "KEY_F10": "KEY_F10", "KEY_F11": "KEY_F11", "KEY_F12": "KEY_F12",
    "KEY_F13": "KEY_F13", "KEY_F14": "KEY_F14", "KEY_F15": "KEY_F15", "KEY_F16": "KEY_F16",
    "KEY_F17": "KEY_F17", "KEY_F18": "KEY_F18", "KEY_F19": "KEY_F19", "KEY_F20": "KEY_F20",
    "KEY_F21": "KEY_F21", "KEY_F22": "KEY_F22", "KEY_F23": "KEY_F23", "KEY_F24": "KEY_F24",
    "KEY_CAPS_LOCK": "KEY_CAPS_LOCK",
    "KEY_INSERT": "KEY_INSERT",
    "KEY_PRTSC": "KEY_PRTSC",
    "KEY_NUM_0": "KEY_NUM_0", "KEY_NUM_1": "KEY_NUM_1", "KEY_NUM_2": "KEY_NUM_2", "KEY_NUM_3": "KEY_NUM_3",
    "KEY_NUM_4": "KEY_NUM_4", "KEY_NUM_5": "KEY_NUM_5", "KEY_NUM_6": "KEY_NUM_6", "KEY_NUM_7": "KEY_NUM_7",
    "KEY_NUM_8": "KEY_NUM_8", "KEY_NUM_9": "KEY_NUM_9",
    "KEY_NUM_SLASH": "KEY_NUM_SLASH",
    "KEY_NUM_ASTERISK": "KEY_NUM_ASTERISK",
    "KEY_NUM_MINUS": "KEY_NUM_MINUS",
    "KEY_NUM_PLUS": "KEY_NUM_PLUS",
    "KEY_NUM_ENTER": "KEY_NUM_ENTER",
    "KEY_NUM_PERIOD": "KEY_NUM_PERIOD",
    "KEY_NON_US_BACKSLASH": "KEY_NON_US_BACKSLASH",
    "UMLAUT_AE": "ACT_UMLAUT_AE", "UMLAUT_OE": "ACT_UMLAUT_OE", "UMLAUT_UE": "ACT_UMLAUT_UE",
    "UMLAUT_AE_UPPER": "ACT_UMLAUT_AE_UPPER", "UMLAUT_OE_UPPER": "ACT_UMLAUT_OE_UPPER",
    "UMLAUT_UE_UPPER": "ACT_UMLAUT_UE_UPPER", "UMLAUT_SZ": "ACT_UMLAUT_SZ",
    "OSM_LCTRL": "ACT_OSM_LCTRL", "OSM_LSHIFT": "ACT_OSM_LSHIFT", "OSM_LALT": "ACT_OSM_LALT",
    "OSM_LGUI": "ACT_OSM_LGUI", "OSM_RCTRL": "ACT_OSM_RCTRL", "OSM_RSHIFT": "ACT_OSM_RSHIFT",
    "OSM_RALT": "ACT_OSM_RALT", "OSM_RGUI": "ACT_OSM_RGUI", "CAPS_WORD": "ACT_CAPS_WORD", "REPEAT": "ACT_REPEAT",
    "MEDIA_PLAY_PAUSE": "ACT_MEDIA_PLAY_PAUSE",
    "MEDIA_MUTE": "ACT_MEDIA_MUTE",
    "MEDIA_VOLUME_UP": "ACT_MEDIA_VOLUME_UP",
    "MEDIA_VOLUME_DOWN": "ACT_MEDIA_VOLUME_DOWN",
    "MEDIA_NEXT_TRACK": "ACT_MEDIA_NEXT_TRACK",
    "MEDIA_PREVIOUS_TRACK": "ACT_MEDIA_PREVIOUS_TRACK",
    "MEDIA_STOP": "ACT_MEDIA_STOP",
    "MAC_GLOBE": "ACT_MAC_GLOBE",
    "MO_0": "ACT_MO_0", "MO_1": "ACT_MO_1", "MO_2": "ACT_MO_2", "MO_3": "ACT_MO_3", "MO_4": "ACT_MO_4",
    "MO_5": "ACT_MO_5", "MO_6": "ACT_MO_6", "MO_7": "ACT_MO_7",
    "TG_0": "ACT_TG_0", "TG_1": "ACT_TG_1", "TG_2": "ACT_TG_2", "TG_3": "ACT_TG_3", "TG_4": "ACT_TG_4",
    "TG_5": "ACT_TG_5", "TG_6": "ACT_TG_6", "TG_7": "ACT_TG_7",
    "LAYER_UP": "ACT_LAYER_UP",
    "LAYER_DOWN": "ACT_LAYER_DOWN",
    "MOUSE_LEFT": "ACT_MOUSE_LEFT",
    "MOUSE_RIGHT": "ACT_MOUSE_RIGHT",
    "MOUSE_MIDDLE": "ACT_MOUSE_MIDDLE",
    "MOUSE_WHEEL_UP": "ACT_MOUSE_WHEEL_UP",
    "MOUSE_WHEEL_DOWN": "ACT_MOUSE_WHEEL_DOWN",
    "ACT_MOUSE_LEFT": "ACT_MOUSE_LEFT",
    "ACT_MOUSE_RIGHT": "ACT_MOUSE_RIGHT",
    "ACT_MOUSE_MIDDLE": "ACT_MOUSE_MIDDLE",
    "ACT_MOUSE_WHEEL_UP": "ACT_MOUSE_WHEEL_UP",
    "ACT_MOUSE_WHEEL_DOWN": "ACT_MOUSE_WHEEL_DOWN",
    "NONE": "0",
    "": "0",
    "0": "0"
}

def code_to_cpp(code):
    if not code:
        return "0"
    if code in KEY_TO_CPP:
        return KEY_TO_CPP[code]
    # Tastenpaar PAIR_<n> -> ACT_KEY_PAIR_BASE + n (Index in userKeyPairs)
    m = re.match(r"^PAIR_(\d{1,2})$", code)
    if m and int(m.group(1)) < MAX_KEY_PAIRS:
        return f"(ACT_KEY_PAIR_BASE + {int(m.group(1))})"
    # Makro MACRO_<n> -> ACT_MACRO_BASE + n (Index in userMacros)
    m = re.match(r"^MACRO_(\d{1,2})$", code)
    if m and int(m.group(1)) < MAX_MACROS:
        return f"(ACT_MACRO_BASE + {int(m.group(1))})"
    if code.startswith("KEY_"):
        m = re.match(r"^KEY_(\d+)$", code)
        if m:
            return m.group(1)
        if re.match(r"^[A-Z0-9_]{1,32}$", code):
            return code
        return "0"
    if code.startswith("ACT_"):
        if re.match(r"^[A-Z0-9_]{1,32}$", code):
            return code
        return "0"
    if len(code) == 1:
        ascii_val = ord(code)
        if 32 <= ascii_val <= 126:
            if code == "'":
                return "'\\''"
            if code == "\\":
                return "'\\\\'"
            return f"'{code}'"
        return "0"
    return "0"

NUM_LAYERS = 8
NUM_ROWS = 6
NUM_COLS = 7
MAX_COMBOS = 16
MAX_KEY_PAIRS = 16
MAX_MACROS = 16
MAX_MACRO_STEPS = 32
MACRO_MAX_PAUSE_MS = 5000
# Schritt-Typen identisch zu MACRO_STEP_* in DactylCommon.h
MACRO_STEP_TYPES = {"tap": 1, "down": 2, "up": 3, "pause": 4}
MAX_BODY_BYTES = 2 * 1024 * 1024
COMPILE_TIMEOUT_S = 300
UPLOAD_TIMEOUT_S = 180
REQUEST_SOCKET_TIMEOUT_S = 10
ALLOWED_HOSTS = {"localhost:8088", "127.0.0.1:8088"}
ALLOWED_ORIGINS = {"http://localhost:8088", "http://127.0.0.1:8088"}
# Nur diese Web-Assets werden statisch ausgeliefert (kein .git, server.py, Firmware-Quelltext)
STATIC_ALLOWLIST = {
    "/": "index.html", "/index.html": "index.html", "/app.js": "app.js", "/style.css": "style.css",
    "/js/side-profiles.js": "js/side-profiles.js", "/js/side-state.js": "js/side-state.js",
    "/js/side-routing.js": "js/side-routing.js",
    "/js/side-right.js": "js/side-right.js", "/js/side-left.js": "js/side-left.js",
}
# Module der Web-App (Reihenfolge in index.html)
APP_MODULES = ("keycodes", "config-model", "editor", "key-pairs-ui", "macros-ui", "layout-profiles-ui", "flash-log", "editor-events", "ble", "serial",
               "live-monitor", "heatmap", "matrix-test", "layout-lint-ui", "keyboard-hooks", "config-sync")
STATIC_ALLOWLIST.update({f"/js/{name}.js": f"js/{name}.js" for name in APP_MODULES})

# Wertebereiche identisch zur Firmware (handleConfigCommand)
SETTINGS_RANGES = {
    "debounceMs": (1, 50, 5),
    "comboTimeoutMs": (10, 200, 40),
    "tappingTermMs": (100, 500, 200),
    "standbyTimeoutMinutes": (0, 120, 5),
    "sleepTimeoutMinutes": (0, 240, 60),
}


def sanitize_name(value, default):
    if not isinstance(value, str):
        return default
    # Anführungszeichen, Backslashes und Steuerzeichen entfernen (C++-String-Literal & Serial-Protokoll)
    cleaned = "".join(ch for ch in value if ch not in '"\\' and ch.isprintable()).strip()[:31]
    return cleaned or default


def validate_int(value, lo, hi, field):
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"Ungültiger Wert für '{field}': Ganzzahl erwartet.")
    if not (lo <= value <= hi):
        raise ValueError(f"Wert für '{field}' außerhalb des Bereichs {lo}..{hi}: {value}")
    return value


def cell_actions(cell):
    """Liefert (tap, hold, dtap) eines Matrix-Eintrags. Hold ohne Tap wirkt wie eine normale Taste,
    Doppel-Tipp ohne Tap bleibt ohne Wirkung (wie in der Firmware)."""
    if isinstance(cell, dict):
        tap = cell.get("tap", "NONE")
        hold = cell.get("hold", "NONE")
        dtap = cell.get("dtap", "NONE")
        tap = tap if isinstance(tap, str) else "NONE"
        hold = hold if isinstance(hold, str) else "NONE"
        dtap = dtap if isinstance(dtap, str) else "NONE"
        if tap in ("", "NONE"):
            return (hold or "NONE"), "NONE", "NONE"
        return tap, hold, dtap
    if isinstance(cell, str):
        return cell, "NONE", "NONE"
    return "NONE", "NONE", "NONE"


def generate_matrix_cpp(layers, marker, var_name, pick):
    lines = [
        f"// [[[START_{marker}]]]",
        f"uint16_t {var_name}[NUM_LAYERS][6][7] = {{"
    ]
    layer_names = [
        "Layer 0 (Base)",
        "Layer 1 (Nav & Arrows)",
        "Layer 2 (Symbols & Numbers)",
        "Layer 3 (Numpad)",
        "Layer 4 (Function / Media)",
        "Layer 5 (Media & Sound)",
        "Layer 6 (Shortcuts)",
        "Layer 7 (Custom / Gaming)"
    ]

    for l_idx in range(NUM_LAYERS):
        lines.append(f"  // {layer_names[l_idx]}")
        lines.append("  {")
        layer_data = layers[l_idx] if l_idx < len(layers) and isinstance(layers[l_idx], list) else []
        for r in range(NUM_ROWS):
            row_entries = []
            row = layer_data[r] if r < len(layer_data) and isinstance(layer_data[r], list) else []
            for c in range(NUM_COLS):
                val = code_to_cpp(pick(cell_actions(row[c]))) if c < len(row) else "0"
                row_entries.append(val.ljust(16 if len(val) < 16 else len(val) + 1))
            comma = "," if r < NUM_ROWS - 1 else ""
            lines.append(f"    {{ {', '.join(row_entries)} }}{comma}")
        layer_comma = "," if l_idx < NUM_LAYERS - 1 else ""
        lines.append(f"  }}{layer_comma}\n")

    lines.append("};")
    lines.append(f"// [[[END_{marker}]]]")
    return "\n".join(lines)


def generate_holdmap_cpp(layers):
    return generate_matrix_cpp(layers, "HOLDMAP", "HOLDMAP", lambda a: a[1])


def generate_dtapmap_cpp(layers):
    return generate_matrix_cpp(layers, "DTAPMAP", "DTAPMAP", lambda a: a[2])


def generate_keymap_cpp(layers):
    return generate_matrix_cpp(layers, "KEYMAP", "KEYMAP", lambda a: a[0])


def generate_layer_names_cpp(layer_names):
    names = list(layer_names)[:NUM_LAYERS] if isinstance(layer_names, list) else []
    default_names = ["Base", "Nav & Pfeile", "Symbole", "Numpad", "Function", "Media", "Shortcuts", "Custom"]
    while len(names) < NUM_LAYERS:
        names.append(default_names[len(names)])
    escaped = [sanitize_name(n, default_names[i]) for i, n in enumerate(names)]
    lines = [
        "// [[[START_LAYER_NAMES]]]",
        "String layerNames[NUM_LAYERS] = {",
        f'  "{escaped[0]}", "{escaped[1]}", "{escaped[2]}", "{escaped[3]}",',
        f'  "{escaped[4]}", "{escaped[5]}", "{escaped[6]}", "{escaped[7]}"',
        "};",
        "// [[[END_LAYER_NAMES]]]"
    ]
    return "\n".join(lines)

def validate_combo_key(key, field):
    if not isinstance(key, dict):
        raise ValueError(f"Combo-Feld '{field}' fehlt oder ist ungültig.")
    r = validate_int(key.get("r"), 0, NUM_ROWS - 1, f"{field}.r")
    c = validate_int(key.get("c"), 0, NUM_COLS - 1, f"{field}.c")
    return r, c

# One-Shot-, Caps-Word- und Repeat-Aktionen (Codes > 0xFF): als Combo nur mit KEY_PRESS
ONE_SHOT_CPP = {f"ACT_OSM_{m}" for m in ("LCTRL", "LSHIFT", "LALT", "LGUI", "RCTRL", "RSHIFT", "RALT", "RGUI")} | {"ACT_CAPS_WORD", "ACT_REPEAT"}

def generate_combos_cpp(combos):
    if combos is None:
        combos = []
    if not isinstance(combos, list):
        raise ValueError("Ungültige Combos: Liste erwartet.")
    if len(combos) > MAX_COMBOS:
        raise ValueError(f"Zu viele Combos: maximal {MAX_COMBOS} erlaubt.")
    beh_map = {"KEY_PRESS": 0, "MODIFIER_HOLD": 1, "LAYER_TOGGLE": 2}
    cb_entries = []
    for cb in combos:
        if not isinstance(cb, dict):
            raise ValueError("Ungültiger Combo-Eintrag.")
        r1, c1 = validate_combo_key(cb.get("key1"), "key1")
        r2, c2 = validate_combo_key(cb.get("key2"), "key2")
        beh = beh_map.get(cb.get("behavior"), 0)
        action = cb.get("action", "0")
        act = code_to_cpp(action if isinstance(action, str) else "0")
        if act.startswith("(ACT_MACRO_BASE"):
            raise ValueError("Combos unterstützen keine Makros.")
        # MODIFIER_HOLD hält einen Code 1..255; One-Shot, Caps Word und Repeat (> 0xFF) senden dort nichts
        if beh == 1 and act in ONE_SHOT_CPP:
            raise ValueError("Modifier Hold unterstützt keine One-Shot-, Caps-Word- oder Repeat-Aktion.")
        # KeyCombo hat exakt 6 Felder (r1, c1, r2, c2, behavior, action)
        cb_entries.append(f"  {{ {r1}, {c1}, {r2}, {c2}, {beh}, {act} }}")
    lines = [
        "// [[[START_COMBOS]]]",
        f"uint8_t numCombos = {len(cb_entries)};",
        "KeyCombo userCombos[MAX_COMBOS] = {",
        ",\n".join(cb_entries) if cb_entries else "  { 0, 0, 0, 0, 0, 0 }",
        "};",
        "// [[[END_COMBOS]]]"
    ]
    return "\n".join(lines)

def key_pair_member_cpp(code, field):
    """Ein Tastenpaar-Mitglied muss ein Tastatur-Code 1..255 sein (kein Layer-, Media-, Maus- oder Paar-Code)."""
    if not isinstance(code, str) or code in ("", "NONE", "0"):
        raise ValueError(f"Tastenpaar-Feld '{field}' fehlt.")
    invalid = ValueError(f"Tastenpaar-Feld '{field}' muss eine normale Taste oder ein Modifier sein.")
    # Nur bekannte Namen, ein druckbares Zeichen oder KEY_<n> mit n in 1..255 (uint8_t in KeyPair)
    m = re.match(r"^KEY_(\d+)$", code)
    if m:
        if not 1 <= int(m.group(1)) <= 0xFF:
            raise invalid
        return m.group(1)
    if code not in KEY_TO_CPP and len(code) != 1:
        raise invalid
    cpp = code_to_cpp(code)
    if cpp == "0" or cpp.startswith("ACT_") or cpp.startswith("(ACT_"):
        raise invalid
    return cpp

def generate_key_pairs_cpp(pairs):
    if pairs is None:
        pairs = []
    if not isinstance(pairs, list):
        raise ValueError("Ungültige Tastenpaare: Liste erwartet.")
    if len(pairs) > MAX_KEY_PAIRS:
        raise ValueError(f"Zu viele Tastenpaare: maximal {MAX_KEY_PAIRS} erlaubt.")
    entries = []
    for p in pairs:
        if not isinstance(p, dict):
            raise ValueError("Ungültiger Tastenpaar-Eintrag.")
        entries.append(f"  {{ {key_pair_member_cpp(p.get('first'), 'first')}, {key_pair_member_cpp(p.get('second'), 'second')} }}")
    lines = [
        "// [[[START_KEY_PAIRS]]]",
        f"uint8_t numKeyPairs = {len(entries)};",
        "KeyPair userKeyPairs[MAX_KEY_PAIRS] = {",
        ",\n".join(entries) if entries else "  { 0, 0 }",
        "};",
        "// [[[END_KEY_PAIRS]]]"
    ]
    return "\n".join(lines)

def macro_step_cpp(step, label):
    """Ein Makro-Schritt: tap/down/up mit Tastatur-Code 1..255, pause mit ms 1..MACRO_MAX_PAUSE_MS."""
    if not isinstance(step, dict) or step.get("type") not in MACRO_STEP_TYPES:
        raise ValueError(f"{label}: Typ tap, down, up oder pause erwartet.")
    step_type = step["type"]
    if step_type == "pause":
        ms = validate_int(step.get("ms"), 1, MACRO_MAX_PAUSE_MS, f"{label} ms")
        return f"{{ {MACRO_STEP_TYPES[step_type]}, 0, {ms} }}"
    return f"{{ {MACRO_STEP_TYPES[step_type]}, {key_pair_member_cpp(step.get('code'), f'{label} code')}, 0 }}"

def generate_macros_cpp(macros):
    if macros is None:
        macros = []
    if not isinstance(macros, list):
        raise ValueError("Ungültige Makros: Liste erwartet.")
    if len(macros) > MAX_MACROS:
        raise ValueError(f"Zu viele Makros: maximal {MAX_MACROS} erlaubt.")
    lengths = []
    rows = []
    for m_idx, macro in enumerate(macros):
        if not isinstance(macro, dict) or not isinstance(macro.get("steps"), list):
            raise ValueError(f"Ungültiges Makro {m_idx}: Objekt mit 'steps'-Liste erwartet.")
        steps = macro["steps"]
        if len(steps) > MAX_MACRO_STEPS:
            raise ValueError(f"Makro {m_idx}: maximal {MAX_MACRO_STEPS} Schritte erlaubt.")
        lengths.append(str(len(steps)))
        cells = [macro_step_cpp(st, f"Makro {m_idx} Schritt {s_idx}") for s_idx, st in enumerate(steps)]
        rows.append("  { " + (", ".join(cells) if cells else "{ 0, 0, 0 }") + " }")
    lines = [
        "// [[[START_MACROS]]]",
        f"uint8_t numMacros = {len(macros)};",
        "uint8_t macroLengths[MAX_MACROS] = { " + (", ".join(lengths) if lengths else "0") + " };",
        "MacroStep userMacros[MAX_MACROS][MAX_MACRO_STEPS] = {",
        ",\n".join(rows) if rows else "  { { 0, 0, 0 } }",
        "};",
        "// [[[END_MACROS]]]"
    ]
    return "\n".join(lines)

def generate_settings_cpp(settings, side="R"):
    if settings is None:
        settings = {}
    if not isinstance(settings, dict):
        raise ValueError("Ungültige Einstellungen: Objekt erwartet.")
    default_name = DEFAULT_DEVICE_NAMES[side]
    dev_name = sanitize_name(settings.get("deviceName", default_name), default_name)
    values = {}
    for field, (lo, hi, default) in SETTINGS_RANGES.items():
        values[field] = validate_int(settings.get(field, default), lo, hi, field)
    lines = [
        "// [[[START_SETTINGS]]]",
        f'String deviceName = "{dev_name}";',
        f'uint8_t debounceMs = {values["debounceMs"]};',
        f'uint16_t comboTimeoutMs = {values["comboTimeoutMs"]};',
        f'uint16_t tappingTermMs = {values["tappingTermMs"]};',
        f'uint32_t standbyTimeoutMinutes = {values["standbyTimeoutMinutes"]};',
        f'uint32_t deepSleepTimeoutMinutes = {values["sleepTimeoutMinutes"]};',
        "// [[[END_SETTINGS]]]"
    ]
    return "\n".join(lines)

def replace_marked_block(content, marker, replacement, required=False):
    pattern = rf"// \[\[\[START_{marker}\]\]\].*?// \[\[\[END_{marker}\]\]\]"
    if not re.search(pattern, content, re.DOTALL):
        if required:
            raise ValueError(f"Markierungen // [[[START_{marker}]]] ... // [[[END_{marker}]]] fehlen in der Firmware-Datei!")
        return content
    # Lambda statt Ersatz-String: re.sub würde sonst Backslash-Sequenzen ('\\\\' -> '\\') interpretieren
    return re.sub(pattern, lambda _m: replacement, content, count=1, flags=re.DOTALL)

def generate_defaults_id_cpp(defaults_id):
    return "\n".join([
        "// [[[START_DEFAULTS_ID]]]",
        f"#define KEYMAP_DEFAULTS_ID {int(defaults_id)}UL",
        "// [[[END_DEFAULTS_ID]]]",
    ])

def new_defaults_id():
    """Neue, nie 0 werdende Kennung pro Flash aus der App (0 ist für den Repository-Stand reserviert)."""
    return secrets.randbelow(0xFFFFFFFF) + 1

def render_ino_content(content, config, defaults_id=None, side="R"):
    """Erzeugt den neuen .ino-Inhalt vollständig im Speicher (wirft ValueError bei ungültiger Konfiguration)."""
    layers = config.get("layers")
    content = replace_marked_block(content, "KEYMAP", generate_keymap_cpp(layers), required=True)
    content = replace_marked_block(content, "HOLDMAP", generate_holdmap_cpp(layers), required=True)
    content = replace_marked_block(content, "DTAPMAP", generate_dtapmap_cpp(layers), required=True)
    if defaults_id is not None:
        content = replace_marked_block(content, "DEFAULTS_ID", generate_defaults_id_cpp(defaults_id), required=True)
    if config.get("layerNames"):
        content = replace_marked_block(content, "LAYER_NAMES", generate_layer_names_cpp(config.get("layerNames")))
    if "combos" in config:
        content = replace_marked_block(content, "COMBOS", generate_combos_cpp(config.get("combos")))
    if "keyPairs" in config:
        content = replace_marked_block(content, "KEY_PAIRS", generate_key_pairs_cpp(config.get("keyPairs")))
    if "macros" in config:
        content = replace_marked_block(content, "MACROS", generate_macros_cpp(config.get("macros")))
    if "settings" in config:
        content = replace_marked_block(content, "SETTINGS", generate_settings_cpp(config.get("settings"), side))
    return content

def write_temp_file(path, text):
    """Schreibt text vollständig (fsync) in eine Temp-Datei neben path und gibt deren Namen zurück."""
    dir_name = os.path.dirname(os.path.abspath(path))
    fd, temp_name = tempfile.mkstemp(dir=dir_name, prefix=".tmp_", text=True)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as tf:
            tf.write(text)
            tf.flush()
            os.fsync(tf.fileno())
    except BaseException:
        remove_quietly(temp_name)
        raise
    return temp_name

def remove_quietly(path):
    try:
        os.unlink(path)
    except FileNotFoundError:
        pass

def write_files_atomic(files):
    """Schreibt alle Dateien zuerst als Temp-Dateien und ersetzt sie erst danach (kein halbes Update bei Schreibfehlern)."""
    temps = []
    try:
        for path, text in files:
            temps.append((write_temp_file(path, text), path))
        # Originale sichern, damit ein Fehler beim zweiten os.replace das erste zurückrollen kann
        originals = {}
        for _, path in temps:
            try:
                with open(path, "r", encoding="utf-8") as f:
                    originals[path] = f.read()
            except FileNotFoundError:
                originals[path] = None
        replaced = []
        try:
            for temp_name, path in temps:
                os.replace(temp_name, path)
                replaced.append(path)
        except BaseException:
            # Jeden Rollback-Schritt einzeln absichern, damit der ursprüngliche Fehler erhalten bleibt
            for path in replaced:
                rollback_temp = None
                try:
                    if originals[path] is None:
                        remove_quietly(path)
                    else:
                        rollback_temp = write_temp_file(path, originals[path])
                        os.replace(rollback_temp, path)
                        rollback_temp = None
                except OSError as rollback_err:
                    print(f"WARN: Rollback von {path} fehlgeschlagen: {rollback_err}", file=sys.stderr)
                finally:
                    if rollback_temp and os.path.exists(rollback_temp):
                        remove_quietly(rollback_temp)
            raise
    finally:
        for temp_name, _ in temps:
            if os.path.exists(temp_name):
                remove_quietly(temp_name)

def write_file_atomic(path, text):
    write_files_atomic([(path, text)])

def validate_config(config, side="R"):
    if not isinstance(config, dict) or not isinstance(config.get("layers"), list) or len(config["layers"]) == 0:
        raise ValueError("Ungültige Konfiguration: Muss ein Objekt mit einer nicht-leeren 'layers'-Liste sein.")
    if len(config["layers"]) > NUM_LAYERS:
        raise ValueError(f"Ungültige Konfiguration: maximal {NUM_LAYERS} Ebenen erlaubt.")
    # Jede Ebene muss eine Liste mit höchstens 6 Zeilen à höchstens 7 Spalten sein (kürzer ist erlaubt).
    # Sonst würde der Codegen fehlerhafte Ebenen still durch Nullen ersetzen oder Tasten abschneiden.
    for l_idx, layer in enumerate(config["layers"]):
        if not isinstance(layer, list) or len(layer) > NUM_ROWS:
            raise ValueError(f"Ungültige Ebene {l_idx}: Liste mit maximal {NUM_ROWS} Zeilen erwartet.")
        for r_idx, row in enumerate(layer):
            if not isinstance(row, list) or len(row) > NUM_COLS:
                raise ValueError(f"Ungültige Zeile {r_idx} in Ebene {l_idx}: Liste mit maximal {NUM_COLS} Tasten erwartet.")
            for c_idx, cell in enumerate(row):
                if not isinstance(cell, (dict, str)):
                    raise ValueError(f"Ungültige Taste R{r_idx}C{c_idx} in Ebene {l_idx}: Objekt oder Code erwartet.")
                # Linke Hälfte: fehlende Tasten tragen keine Aktion (die rechte Vorlage hat dort historisch Werte)
                if side == "L" and (r_idx, c_idx) in ABSENT_KEYS["L"] and any(a not in ("", "NONE", "0") for a in cell_actions(cell)):
                    raise ValueError(f"Taste R{r_idx}C{c_idx} existiert auf der linken Hälfte nicht (Ebene {l_idx}).")
    # Codegen prüft Combos und Einstellungen vollständig (Bereiche identisch zur Firmware)
    generate_combos_cpp(config.get("combos"))
    generate_key_pairs_cpp(config.get("keyPairs"))
    generate_macros_cpp(config.get("macros"))
    generate_settings_cpp(config.get("settings"), side)
    for cb in config.get("combos") or []:
        for field in ("key1", "key2"):
            key = (cb[field]["r"], cb[field]["c"])
            if key in ABSENT_KEYS[side]:
                raise ValueError(f"Combo-Taste R{key[0]}C{key[1]} existiert auf dieser Hälfte nicht.")

def load_config_for_app(side="R"):
    """Lokale Nutzer-Config (nicht versioniert) oder, falls nicht vorhanden, die versionierte Vorlage."""
    paths = side_paths(side)
    for path, source in ((paths["config"], "user"), (paths["default"], "default")):
        try:
            with open(path, "r", encoding="utf-8") as f:
                config = json.load(f)
        except FileNotFoundError:
            continue
        except (OSError, ValueError):
            # Beschädigte/unlesbare Nutzer-Config nicht still durch die Vorlage ersetzen: App zeigt Standard
            return {"exists": False}
        if not isinstance(config, dict):
            return {"exists": False}
        config = migrate_config(config)
        config["source"] = source
        return config
    return {"exists": False}

def strip_response_metadata(config):
    """Entfernt das von GET /api/config ergänzte Metadatum "source", damit es nicht in der Nutzer-Config landet."""
    if isinstance(config, dict) and "source" in config:
        config = {k: v for k, v in config.items() if k != "source"}
    return config

def save_config_atomic(config, side="R"):
    config = strip_response_metadata(config)
    validate_config(config, side)
    write_file_atomic(side_paths(side)["config"], json.dumps(config, indent=2))

def save_config_and_firmware(config, side="R"):
    """Validiert und rendert alles im Speicher, bevor eine Datei geschrieben wird."""
    config = strip_response_metadata(config)
    validate_config(config, side)
    paths = side_paths(side)
    if not os.path.exists(paths["template"]):
        raise FileNotFoundError(f"Firmware Datei nicht gefunden: {paths['template']}")
    with open(paths["template"], "r", encoding="utf-8") as f:
        # Neue Kennung: ein Flash aus der App überschreibt die Belegung auf der Tastatur immer
        new_ino = render_ino_content(f.read(), config, defaults_id=new_defaults_id(), side=side)
    sync_firmware_sources()
    write_files_atomic([(paths["ino"], new_ino), (paths["config"], json.dumps(config, indent=2))])

class ProfileConflict(Exception):
    """Die Profildatei hat sich seit dem Lesen geändert (anderes App-Fenster): HTTP 409."""


def migrate_config(config):
    """Ältere Configs: Combos mit MODIFIER_HOLD und One-Shot- oder Caps-Word-Aktion sandten nie etwas.
    Sie werden zu KEY_PRESS (One-Shot = tippen), statt die ganze Config oder das Profil ungültig zu machen."""
    if not isinstance(config, dict) or not isinstance(config.get("combos"), list):
        return config
    combos = []
    for cb in config["combos"]:
        if (isinstance(cb, dict) and cb.get("behavior") == "MODIFIER_HOLD" and isinstance(cb.get("action"), str)
                and code_to_cpp(cb["action"]) in ONE_SHOT_CPP):
            cb = {**cb, "behavior": "KEY_PRESS"}
        combos.append(cb)
    return {**config, "combos": combos}


def validate_profile_entry(entry, idx, names, side="R"):
    """Prüft ein Profil und gibt es bereinigt zurück. names: bisher vergebene Namen (casefold), wird ergänzt."""
    if not isinstance(entry, dict):
        raise ValueError(f"Ungültiges Profil {idx}: Objekt erwartet.")
    name = sanitize_name(entry.get("name"), "")
    if not name or name != entry.get("name"):
        raise ValueError(f"Ungültiger Profilname in Profil {idx}.")
    if name.casefold() in names:
        raise ValueError(f"Profilname doppelt: {name}")
    saved_at = entry.get("savedAt", "")
    if not isinstance(saved_at, str) or len(saved_at) > 40:
        raise ValueError(f"Ungültiger Zeitstempel in Profil '{name}'.")
    config = strip_response_metadata(entry.get("config"))
    try:
        validate_config(config, side)
    except ValueError as err:
        raise ValueError(f"Profil '{name}': {err}") from err
    names.add(name.casefold())
    return {"name": name, "savedAt": saved_at, "config": config}

def profile_revision(data):
    rev = data.get("revision", 0) if isinstance(data, dict) else 0
    return rev if isinstance(rev, int) and not isinstance(rev, bool) and rev >= 0 else 0

def validate_profiles(data, side="R"):
    """Prüft die Profilliste einer Hälfte: eindeutige Namen, höchstens MAX_PROFILES, jede Config wie /api/config."""
    if not isinstance(data, dict) or not isinstance(data.get("profiles"), list):
        raise ValueError("Ungültige Profile: Objekt mit einer Liste 'profiles' erwartet.")
    profiles = data["profiles"]
    if len(profiles) > MAX_PROFILES:
        raise ValueError(f"Ungültige Profile: maximal {MAX_PROFILES} Profile erlaubt.")
    names = set()
    return {"profiles": [validate_profile_entry(entry, idx, names, side) for idx, entry in enumerate(profiles)]}

def load_profiles(side="R"):
    """Profilliste einer Hälfte mit Revision. Fehlt die Datei, ist die Liste leer; eine unlesbare Datei liefert None.
    Ein ungültiges Profil (z. B. nach einer strengeren Regel) macht nicht die ganze Liste unbrauchbar: es wird
    übersprungen und unter "skipped" gemeldet. Das nächste Speichern entfernt es aus der Datei."""
    try:
        with open(side_paths(side)["profiles"], "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return {"profiles": [], "revision": 0, "skipped": []}
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict) or not isinstance(data.get("profiles"), list):
        return None
    result, names, skipped = [], set(), []
    for idx, entry in enumerate(data["profiles"]):
        if len(result) >= MAX_PROFILES:
            skipped.append(f"Profil {idx}: maximal {MAX_PROFILES} Profile erlaubt.")
            continue
        # Nur beim Laden migrieren; ein POST mit der alten Form wird abgelehnt (wie /api/config)
        if isinstance(entry, dict):
            entry = {**entry, "config": migrate_config(strip_response_metadata(entry.get("config")))}
        try:
            result.append(validate_profile_entry(entry, idx, names, side))
        except ValueError as err:
            skipped.append(str(err))
    return {"profiles": result, "revision": profile_revision(data), "skipped": skipped}

def save_profiles_atomic(data, side="R"):
    """Speichert die Liste, wenn "revision" dem gespeicherten Stand entspricht; sonst ProfileConflict.
    Gibt die neue Revision zurück."""
    if not isinstance(data, dict):
        raise ValueError("Ungültige Profile: Objekt mit einer Liste 'profiles' erwartet.")
    expected = data.get("revision")
    if not isinstance(expected, int) or isinstance(expected, bool) or expected < 0:
        raise ValueError("Ungültige Profile: Zahl 'revision' (Stand beim Lesen) erwartet.")
    clean = validate_profiles(data, side)
    path = side_paths(side)["profiles"]
    # Prüfen und Schreiben unter einer Dateisperre: zwei gleichzeitige POSTs gewinnen nicht beide
    with open(path + ".lock", "a", encoding="utf-8") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        current = load_profiles(side)
        if current is None:
            raise OSError("Profildatei ist beschädigt oder unlesbar.")
        if current["revision"] != expected:
            raise ProfileConflict("Die Profile wurden inzwischen in einem anderen Fenster geändert. Bitte neu laden.")
        clean["revision"] = expected + 1
        # Ungültige Profile verschwinden mit diesem Speichern: die alte Datei vorher als Backup behalten
        if current["skipped"]:
            backup = f"{path}.{time.strftime('%Y%m%d-%H%M%S')}.bak"
            shutil.copy2(path, backup)
        write_file_atomic(path, json.dumps(clean, indent=2))
    return clean["revision"]

# backup-<laufende Nummer>-<UTC-Zeitstempel>.json. Die Nummer legt die Reihenfolge fest, nicht die Uhr:
# eine zurückgestellte Uhr sortiert ein neues Backup sonst als alt, und das Aufräumen löscht es.
BACKUP_FILE_RE = re.compile(r"^backup-(\d{6,})-\d{8}-\d{6}-\d{3}\.json$")


def backup_file_names(folder):
    """Backup-Dateien eines Ordners, neueste (höchste Nummer) zuerst."""
    try:
        names = os.listdir(folder)
    except FileNotFoundError:
        return []
    matches = [(BACKUP_FILE_RE.match(n), n) for n in names]
    return [n for _, n in sorted(((int(m.group(1)), n) for m, n in matches if m), reverse=True)]

def backup_sequence(name):
    return int(BACKUP_FILE_RE.match(name).group(1))

def read_backup_file(path):
    """Inhalt einer Backup-Datei oder None, wenn sie unlesbar ist."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None

def config_fingerprint(config):
    return json.dumps(config, sort_keys=True, separators=(",", ":"))

def create_backup(config, side="R", reason="sync", now=None):
    """Speichert die Config einer Hälfte als Backup und behält die letzten MAX_BACKUPS.
    Kein neues Backup, wenn das letzte dieselbe Config enthält oder (nur reason "sync") jünger als
    BACKUP_MIN_INTERVAL_S ist. Gibt den Dateinamen zurück, sonst None. Eine ungültige Config ergibt ValueError."""
    if reason not in BACKUP_REASONS:
        raise ValueError(f"Ungültiger Backup-Grund: {reason}")
    config = strip_response_metadata(config)
    validate_config(config, side)
    now = time.time() if now is None else now
    folder = side_paths(side)["backups"]
    os.makedirs(folder, exist_ok=True)
    # Prüfen, Schreiben und Aufräumen unter einer Sperre: zwei Fenster oder Sync und Flash gleichzeitig
    with open(os.path.join(folder, ".lock"), "a", encoding="utf-8") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        names = backup_file_names(folder)
        latest = read_backup_file(os.path.join(folder, names[0])) if names else None
        if latest is not None:
            if config_fingerprint(latest.get("config")) == config_fingerprint(config):
                return None
            created = latest.get("created")
            # Eine zurückgestellte Uhr (created in der Zukunft) sperrt keine Backups
            if (reason == "sync" and isinstance(created, (int, float)) and not isinstance(created, bool)
                    and 0 <= now - created < BACKUP_MIN_INTERVAL_S):
                return None
        stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime(now)) + f"-{int(now * 1000) % 1000:03d}"
        # Unter der Sperre ist die nächste Nummer eindeutig
        sequence = backup_sequence(names[0]) + 1 if names else 1
        name = f"backup-{sequence:06d}-{stamp}.json"
        saved_at = time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(now))
        write_file_atomic(os.path.join(folder, name),
                          json.dumps({"created": now, "savedAt": saved_at, "reason": reason, "config": config}, indent=2))
        for old in backup_file_names(folder)[MAX_BACKUPS:]:
            try:
                os.remove(os.path.join(folder, old))
            except FileNotFoundError:
                pass
    return name

def load_backups(side="R"):
    """Backups einer Hälfte, neueste zuerst: { backups: [{ id, savedAt, reason, config }], skipped }.
    Ein unlesbares oder ungültiges Backup wird übersprungen und nur gezählt."""
    folder = side_paths(side)["backups"]
    backups, skipped = [], 0
    for name in backup_file_names(folder):
        data = read_backup_file(os.path.join(folder, name))
        try:
            if data is None:
                raise ValueError("unlesbar")
            config = migrate_config(strip_response_metadata(data.get("config")))
            validate_config(config, side)
        except ValueError:
            skipped += 1
            continue
        reason = data.get("reason") if data.get("reason") in BACKUP_REASONS else "sync"
        saved_at = data.get("savedAt") if isinstance(data.get("savedAt"), str) else ""
        backups.append({"id": name[:-len(".json")], "savedAt": saved_at, "reason": reason, "config": config})
    return {"backups": backups, "skipped": skipped}

def find_arduino_cli():
    cli = shutil.which("arduino-cli")
    if cli:
        return cli
    candidates = [
        "/opt/homebrew/bin/arduino-cli",
        "/opt/homebrew/sbin/arduino-cli",
        "/usr/local/bin/arduino-cli",
        os.path.expanduser("~/bin/arduino-cli"),
        os.path.expanduser("~/.local/bin/arduino-cli"),
    ]
    for c in candidates:
        if os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return None

def list_serial_ports():
    return sorted(glob.glob("/dev/cu.usbserial*") + glob.glob("/dev/cu.wchusbserial*"))


DEVICE_INFO_TIMEOUT_S = 5.0
DEVICE_INFO_RETRY_S = 0.5


def query_device_side(port, timeout_s=DEVICE_INFO_TIMEOUT_S):
    """Sendet GET_INFO und liefert DEVICE_INFO.side ("R" ohne Feld = Firmware vor der Erkennung), sonst None.
    DTR und RTS werden gelöscht: auf dem LOLIN32 Lite lösen sie sonst Reset bzw. Bootloader aus."""
    try:
        fd = os.open(port, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
    except OSError:
        return None
    try:
        # Rohmodus wie pyserial: blockierender Deskriptor, VMIN/VTIME 0, gelesen wird nur nach select()
        fcntl.fcntl(fd, fcntl.F_SETFL, 0)
        attrs = termios.tcgetattr(fd)
        attrs[0] &= ~(termios.IGNBRK | termios.BRKINT | termios.PARMRK | termios.ISTRIP | termios.INLCR
                      | termios.IGNCR | termios.ICRNL | termios.IXON | termios.IXOFF | termios.IXANY | termios.INPCK)
        attrs[1] &= ~termios.OPOST
        attrs[2] &= ~(termios.CSIZE | termios.PARENB | termios.CSTOPB | termios.CRTSCTS)
        attrs[2] |= termios.CS8 | termios.CREAD | termios.CLOCAL
        attrs[3] &= ~(termios.ECHO | termios.ECHONL | termios.ICANON | termios.ISIG | termios.IEXTEN)
        attrs[4] = attrs[5] = termios.B115200
        attrs[6][termios.VMIN] = 0
        attrs[6][termios.VTIME] = 0
        termios.tcsetattr(fd, termios.TCSANOW, attrs)
        fcntl.ioctl(fd, termios.TIOCMBIC, (termios.TIOCM_DTR | termios.TIOCM_RTS).to_bytes(4, "little"))
        time.sleep(0.3)
        termios.tcflush(fd, termios.TCIFLUSH)
        # Das Öffnen des Ports kann das Board neu starten (der Master braucht für BLE über 1 s bis loop()):
        # GET_INFO wiederholen, bis DEVICE_INFO kommt
        buf = b""
        next_send = 0.0
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            if time.monotonic() >= next_send:
                os.write(fd, b"GET_INFO\n")
                next_send = time.monotonic() + DEVICE_INFO_RETRY_S
            ready, _, _ = select.select([fd], [], [], 0.05)
            if not ready:
                continue
            buf += os.read(fd, 512)
            side = parse_device_side(buf.decode("utf-8", "replace"))
            if side is not None:
                return side
        return None
    except (OSError, termios.error):
        return None
    finally:
        os.close(fd)


def parse_device_side(text):
    """Hälfte aus der ersten vollständigen DEVICE_INFO-Zeile, None ohne solche Zeile oder bei unbekanntem Wert."""
    # Nur vollständige Zeilen auswerten: die letzte Zeile ohne Zeilenende kann noch abgeschnitten sein
    complete = text.split("\n")[:-1]
    for line in complete:
        line = line.strip()
        if not line.startswith("DEVICE_INFO:"):
            continue
        try:
            info = json.loads(line[len("DEVICE_INFO:"):])
        except ValueError:
            continue
        if not isinstance(info, dict):
            continue
        side = info.get("side", "R")
        return side if side in SIDES else None
    return None


def find_serial_port(side="R"):
    """Port, dessen Board sich per DEVICE_INFO als diese Hälfte meldet. Nie raten: kein Treffer ergibt None."""
    for port in list_serial_ports():
        if query_device_side(port) == side:
            return port
    return None

# BLE + ESP-NOW (Split-Empfang) passen nicht in die Standard-App-Partition (1,25 MB).
# min_spiffs: 1,875 MB App, NVS-Offset unverändert (0x9000), damit Keymap und macOS-Bond erhalten bleiben.
FIRMWARE_FQBN = "esp32:esp32:lolin32-lite:PartitionScheme=min_spiffs"


# Höchstlänge des Fehlertexts: die ganze Ausgabe ging bereits zeilenweise an die App
FLASH_ERROR_TAIL_CHARS = 8000
# Terminal-Steuerfolgen von esptool (z. B. ESC[1A ESC[2K für Zeile hoch und Zeile löschen): CSI- und OSC-Folgen
# sowie ein einzelnes ESC (ohne das Folgezeichen), dazu übrige Steuerzeichen außer Tab, auch C1 (U+0080..U+009F)
CLI_CONTROL_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|[\x00-\x08\x0b-\x1f\x7f-\x9f]")


def strip_terminal_controls(text):
    """Entfernt Terminal-Steuerfolgen, damit die App nur lesbaren Text zeigt."""
    return CLI_CONTROL_RE.sub("", text)


def run_cli(cmd, timeout_s, on_line=None):
    """Startet arduino-cli und meldet jede Ausgabezeile (stdout und stderr) sofort an on_line.
    Liefert (returncode, ausgabe). Nach timeout_s wird die ganze Prozessgruppe beendet und TimeoutExpired ausgelöst."""
    # Eigene Prozessgruppe: arduino-cli startet esptool als Kindprozess, der sonst nach dem Abbruch weiterflasht
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=os.environ, start_new_session=True)
    fd = proc.stdout.fileno()
    deadline = time.monotonic() + timeout_s
    output = []
    pending = b""

    def emit(raw):
        # Leere Zeilen entfallen (auch ein \r\n, das auf zwei Stücke verteilt ankommt, und reine Steuerfolgen)
        line = strip_terminal_controls(raw.decode("utf-8", "replace")).rstrip()
        if not line:
            return
        output.append(line)
        if on_line:
            on_line(line)

    try:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise subprocess.TimeoutExpired(cmd, timeout_s)
            ready, _, _ = select.select([fd], [], [], min(remaining, 0.5))
            if not ready:
                continue
            chunk = os.read(fd, 4096)
            if not chunk:
                break
            # esptool meldet den Upload-Fortschritt mit \r statt \n
            pending += chunk.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
            *lines, pending = pending.split(b"\n")
            for raw in lines:
                emit(raw)
        if pending:
            emit(pending)
        returncode = proc.wait(timeout=max(deadline - time.monotonic(), 1))
    except BaseException:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            proc.kill()
        proc.wait()
        raise
    finally:
        proc.stdout.close()
    return returncode, "\n".join(output)


def flash_firmware(side="R", on_output=None):
    """on_output(stage, line) erhält jede Zeile von Kompilieren und Upload, sobald arduino-cli sie ausgibt."""
    arduino_cli = find_arduino_cli()
    if not arduino_cli:
        return {"success": False, "error": "arduino-cli wurde nicht im System-Pfad gefunden! Bitte über 'brew install arduino-cli' installieren."}

    def output_for(stage):
        if on_output is None:
            return None
        return lambda line: on_output(stage, line)

    def status(stage, text):
        if on_output is not None:
            on_output(stage, text)

    label = "linke" if side == "L" else "rechte"
    status("port", f"Suche die {label} Hälfte am USB ...")
    port = find_serial_port(side)
    if not port:
        return {"success": False, "stage": "port", "error": f"Keine {label} Hälfte am USB gefunden. Bitte die {label} Hälfte per USB anschließen (andere Programme mit offenem USB-Monitor schließen)."}
    sketch = side_paths(side)["sketch"]

    # 1. Compile
    compile_cmd = [
        arduino_cli, "compile",
        "--fqbn", FIRMWARE_FQBN,
        sketch
    ]
    status("compile", f"Kompiliere die Firmware der {label}n Hälfte (Port {port}) ...")
    try:
        code, output = run_cli(compile_cmd, COMPILE_TIMEOUT_S, output_for("compile"))
        if code != 0:
            return {
                "success": False,
                "stage": "compile",
                "error": output[-FLASH_ERROR_TAIL_CHARS:]
            }
    except FileNotFoundError:
        return {"success": False, "error": "arduino-cli wurde nicht im System-Pfad gefunden!"}
    except subprocess.TimeoutExpired:
        return {"success": False, "stage": "compile", "error": f"Kompilieren abgebrochen (Timeout nach {COMPILE_TIMEOUT_S}s)."}

    # 2. Upload: Das Kompilieren dauert bis zu 300 s. Wurde in der Zeit umgesteckt, kann der Port jetzt die
    # andere Hälfte sein. Deshalb direkt vor dem Upload erneut prüfen.
    status("port", f"Prüfe den Port {port} vor dem Upload ...")
    if query_device_side(port) != side:
        return {"success": False, "stage": "port", "error": f"Am Port {port} hängt nicht mehr die {label} Hälfte. Nichts geflasht; bitte erneut starten."}
    upload_cmd = [
        arduino_cli, "upload",
        "-p", port,
        "--fqbn", FIRMWARE_FQBN,
        "--upload-property", "upload.speed=115200",
        sketch
    ]
    status("upload", f"Lade die Firmware auf {port} hoch ...")
    try:
        code, output = run_cli(upload_cmd, UPLOAD_TIMEOUT_S, output_for("upload"))
    except FileNotFoundError:
        return {"success": False, "error": "arduino-cli wurde nicht im System-Pfad gefunden!"}
    except subprocess.TimeoutExpired:
        return {"success": False, "stage": "upload", "error": f"Upload abgebrochen (Timeout nach {UPLOAD_TIMEOUT_S}s)."}
    if code != 0:
        return {
            "success": False,
            "stage": "upload",
            "error": output[-FLASH_ERROR_TAIL_CHARS:]
        }

    return {"success": True, "port": port, "side": side, "message": "Firmware erfolgreich kompiliert und geflasht!"}


class ConfiguratorHandler(http.server.SimpleHTTPRequestHandler):
    # Der Server bleibt bewusst single-threaded (Flash-Vorgänge laufen nie parallel).
    # Ein Client, der nach den Headern stockt, darf ihn daher nicht dauerhaft blockieren.
    timeout = REQUEST_SOCKET_TIMEOUT_S

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def check_host(self):
        # Schutz gegen DNS-Rebinding: nur exakte lokale Host-Header akzeptieren (auch bei GET)
        if self.headers.get("Host", "") not in ALLOWED_HOSTS:
            self.send_json(403, {"error": "Forbidden host"})
            return False
        return True

    def check_origin(self):
        # Browser senden Origin bei Cross-Origin-POSTs immer; ein fehlender Origin stammt von lokalen Clients
        origin = self.headers.get("Origin")
        if origin is not None and origin not in ALLOWED_ORIGINS:
            self.send_json(403, {"error": "Forbidden origin"})
            return False
        return True

    def stream_flash(self, side):
        """Sendet die arduino-cli-Ausgabe als NDJSON (eine JSON-Zeile pro Ereignis), zuletzt das Ergebnis.
        Ohne Content-Length: die Antwort endet mit dem Schließen der Verbindung (HTTP/1.0)."""
        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson")
        self.end_headers()
        client_gone = False

        def write_event(event):
            nonlocal client_gone
            if client_gone:
                return
            try:
                self.wfile.write((json.dumps(event) + "\n").encode("utf-8"))
                self.wfile.flush()
            except OSError:
                # Geschlossenes App-Fenster bricht den Upload nicht ab: ein halber Flash wäre schlimmer
                client_gone = True

        try:
            result = flash_firmware(side, on_output=lambda stage, line: write_event({"type": "log", "stage": stage, "line": line}))
        except Exception as err:
            # Die Header sind gesendet: der Fehler muss als Ergebnis-Zeile kommen, sonst sieht die App nur einen Abbruch
            result = {"success": False, "error": f"Flashen fehlgeschlagen: {err}"}
        write_event(dict(result, type="result"))
        self.close_connection = True

    def read_json_body(self):
        raw_len = self.headers.get("Content-Length")
        try:
            length = int(raw_len)
        except (TypeError, ValueError):
            self.send_json(400, {"success": False, "error": "Ungültiger Content-Length-Header."})
            return None
        if length < 0:
            self.send_json(400, {"success": False, "error": "Ungültiger Content-Length-Header."})
            return None
        if length > MAX_BODY_BYTES:
            self.send_json(413, {"success": False, "error": "Anfrage zu groß."})
            return None
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            self.send_json(400, {"success": False, "error": f"Ungültiges JSON: {e}"})
            return None
        # None signalisiert den Aufrufern "Fehlerantwort bereits gesendet": JSON null daher hier ablehnen
        if body is None:
            self.send_json(400, {"success": False, "error": "Ungültige Konfiguration: JSON null ist nicht erlaubt."})
            return None
        return body

    def do_GET(self):
        if not self.check_host():
            return
        path = self.path.split("?", 1)[0]

        if path == "/api/status":
            ports = list_serial_ports()
            self.send_json(200, {
                "status": "ok",
                "app": "dactyl-configurator",
                "port": ports[0] if ports else None,
                "ports": ports,
                "has_arduino_cli": bool(find_arduino_cli())
            })
            return

        if path == "/api/config":
            side = parse_side(self.path)
            if side is None:
                self.send_json(400, {"success": False, "error": "Ungültiger Parameter 'side' (L oder R)."})
                return
            self.send_json(200, load_config_for_app(side))
            return

        if path == "/api/profiles":
            side = parse_side(self.path)
            if side is None:
                self.send_json(400, {"success": False, "error": "Ungültiger Parameter 'side' (L oder R)."})
                return
            data = load_profiles(side)
            if data is None:
                # Beschädigte Datei nicht still durch eine leere Liste ersetzen: ein Speichern würde sie überschreiben
                self.send_json(500, {"success": False, "error": "Profildatei ist beschädigt oder unlesbar."})
                return
            self.send_json(200, data)
            return

        if path == "/api/backups":
            side = parse_side(self.path)
            if side is None:
                self.send_json(400, {"success": False, "error": "Ungültiger Parameter 'side' (L oder R)."})
                return
            self.send_json(200, load_backups(side))
            return

        if path in STATIC_ALLOWLIST:
            self.path = "/" + STATIC_ALLOWLIST[path]
            super().do_GET()
            return

        self.send_error(404)

    def do_HEAD(self):
        if not self.check_host():
            return
        path = self.path.split("?", 1)[0]
        if path in STATIC_ALLOWLIST:
            self.path = "/" + STATIC_ALLOWLIST[path]
            super().do_HEAD()
            return
        self.send_error(404)

    def do_POST(self):
        if not self.check_host() or not self.check_origin():
            return
        path = urlsplit(self.path).path

        if path in ("/api/save_and_flash", "/api/config", "/api/profiles", "/api/backups"):
            side = parse_side(self.path)
            if side is None:
                self.send_json(400, {"success": False, "error": "Ungültiger Parameter 'side' (L oder R)."})
                return

        if path == "/api/open_bluetooth_settings":
            try:
                subprocess.Popen(["open", "x-apple.systempreferences:com.apple.preference.security?Privacy_Bluetooth"])
                self.send_json(200, {"success": True})
            except Exception as e:
                self.send_json(500, {"success": False, "error": str(e)})
            return

        if path == "/api/save_and_flash":
            config = self.read_json_body()
            if config is None:
                return
            try:
                # 1. Validieren, C++ rendern und erst danach Config & .ino der Hälfte atomar schreiben
                save_config_and_firmware(config, side)
            except ValueError as err:
                self.send_json(400, {"success": False, "error": str(err)})
                return
            except Exception as err:
                self.send_json(500, {"success": False, "error": str(err)})
                return
            # Backup vor dem Flash; ein Fehler dabei hält den Flash nicht auf
            try:
                create_backup(config, side, "flash")
            except (OSError, ValueError) as err:
                print(f"[BACKUP] Backup vor dem Flash fehlgeschlagen: {err}", file=sys.stderr)

            # 2. Flashen (nur auf den Port, der sich als diese Hälfte meldet)
            if parse_qs(urlsplit(self.path).query).get("stream") == ["1"]:
                self.stream_flash(side)
                return
            result = flash_firmware(side)
            self.send_json(200 if result.get("success") else 500, result)
            return

        if path == "/api/config":
            config = self.read_json_body()
            if config is None:
                return
            try:
                save_config_atomic(config, side)
            except ValueError as e:
                self.send_json(400, {"success": False, "error": str(e)})
                return
            except OSError as e:
                self.send_json(500, {"success": False, "error": str(e)})
                return
            self.send_json(200, {"success": True})
            return

        if path == "/api/backups":
            config = self.read_json_body()
            if config is None:
                return
            try:
                name = create_backup(config, side, "sync")
            except ValueError as e:
                self.send_json(400, {"success": False, "error": str(e)})
                return
            except OSError as e:
                self.send_json(500, {"success": False, "error": str(e)})
                return
            self.send_json(200, {"success": True, "created": name is not None})
            return

        if path == "/api/profiles":
            data = self.read_json_body()
            if data is None:
                return
            try:
                revision = save_profiles_atomic(data, side)
            except ValueError as e:
                self.send_json(400, {"success": False, "error": str(e)})
                return
            except ProfileConflict as e:
                self.send_json(409, {"success": False, "error": str(e)})
                return
            except OSError as e:
                self.send_json(500, {"success": False, "error": str(e)})
                return
            self.send_json(200, {"success": True, "revision": revision})
            return

        self.send_json(404, {"error": "Not found"})


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.chdir(DIRECTORY)
    # Allow port reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), ConfiguratorHandler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 60)
        print("  Dactyl Keyboard Configurator Server (with Save & Flash API)")
        print(f"  Web-App läuft unter: {url}")
        print("  (Drücke Strg+C zum Beenden)")
        print("=" * 60)
        sys.stdout.flush()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer beendet.")

if __name__ == "__main__":
    main()
