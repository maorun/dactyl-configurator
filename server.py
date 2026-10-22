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
import shutil
import subprocess
import tempfile

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
CONFIG_FILE = os.path.join(DIRECTORY, "current_config.json")
INO_FILE = os.path.join(DIRECTORY, "firmware", "dactyl_right", "dactyl_right.ino")
SKETCH_DIR = os.path.join(DIRECTORY, "firmware", "dactyl_right")

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
MAX_BODY_BYTES = 2 * 1024 * 1024
COMPILE_TIMEOUT_S = 300
UPLOAD_TIMEOUT_S = 180
REQUEST_SOCKET_TIMEOUT_S = 10
ALLOWED_HOSTS = {"localhost:8088", "127.0.0.1:8088"}
ALLOWED_ORIGINS = {"http://localhost:8088", "http://127.0.0.1:8088"}
# Nur diese Web-Assets werden statisch ausgeliefert (kein .git, server.py, Firmware-Quelltext)
STATIC_ALLOWLIST = {"/": "index.html", "/index.html": "index.html", "/app.js": "app.js", "/style.css": "style.css"}

# Wertebereiche identisch zur Firmware (handleConfigCommand)
SETTINGS_RANGES = {
    "debounceMs": (1, 50, 5),
    "comboTimeoutMs": (10, 200, 40),
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
    """Liefert (tap, hold) eines Matrix-Eintrags. Hold ohne Tap wirkt wie eine normale Taste."""
    if isinstance(cell, dict):
        tap = cell.get("tap", "NONE")
        hold = cell.get("hold", "NONE")
        tap = tap if isinstance(tap, str) else "NONE"
        hold = hold if isinstance(hold, str) else "NONE"
        if tap in ("", "NONE"):
            return (hold or "NONE"), "NONE"
        return tap, hold
    if isinstance(cell, str):
        return cell, "NONE"
    return "NONE", "NONE"


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

def generate_settings_cpp(settings):
    if settings is None:
        settings = {}
    if not isinstance(settings, dict):
        raise ValueError("Ungültige Einstellungen: Objekt erwartet.")
    dev_name = sanitize_name(settings.get("deviceName", "Dactyl Keyboard"), "Dactyl Keyboard")
    values = {}
    for field, (lo, hi, default) in SETTINGS_RANGES.items():
        values[field] = validate_int(settings.get(field, default), lo, hi, field)
    lines = [
        "// [[[START_SETTINGS]]]",
        f'String deviceName = "{dev_name}";',
        f'uint8_t debounceMs = {values["debounceMs"]};',
        f'uint16_t comboTimeoutMs = {values["comboTimeoutMs"]};',
        f'uint32_t standbyTimeoutMinutes = {values["standbyTimeoutMinutes"]};',
        f'uint32_t deepSleepTimeoutMinutes = {values["sleepTimeoutMinutes"]};',
        "// [[[END_SETTINGS]]]"
    ]
    return "\n".join(lines)

def replace_marked_block(content, marker, replacement, required=False):
    pattern = rf"// \[\[\[START_{marker}\]\]\].*?// \[\[\[END_{marker}\]\]\]"
    if not re.search(pattern, content, re.DOTALL):
        if required:
            raise ValueError(f"Markierungen // [[[START_{marker}]]] ... // [[[END_{marker}]]] fehlen in dactyl_right.ino!")
        return content
    # Lambda statt Ersatz-String: re.sub würde sonst Backslash-Sequenzen ('\\\\' -> '\\') interpretieren
    return re.sub(pattern, lambda _m: replacement, content, count=1, flags=re.DOTALL)

def render_ino_content(content, config):
    """Erzeugt den neuen .ino-Inhalt vollständig im Speicher (wirft ValueError bei ungültiger Konfiguration)."""
    layers = config.get("layers")
    content = replace_marked_block(content, "KEYMAP", generate_keymap_cpp(layers), required=True)
    content = replace_marked_block(content, "HOLDMAP", generate_holdmap_cpp(layers), required=True)
    if config.get("layerNames"):
        content = replace_marked_block(content, "LAYER_NAMES", generate_layer_names_cpp(config.get("layerNames")))
    if "combos" in config:
        content = replace_marked_block(content, "COMBOS", generate_combos_cpp(config.get("combos")))
    if "settings" in config:
        content = replace_marked_block(content, "SETTINGS", generate_settings_cpp(config.get("settings")))
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

def validate_config(config):
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
    # Codegen prüft Combos und Einstellungen vollständig (Bereiche identisch zur Firmware)
    generate_combos_cpp(config.get("combos"))
    generate_settings_cpp(config.get("settings"))

def save_config_atomic(config):
    validate_config(config)
    write_file_atomic(CONFIG_FILE, json.dumps(config, indent=2))

def save_config_and_firmware(config):
    """Validiert und rendert alles im Speicher, bevor eine Datei geschrieben wird."""
    validate_config(config)
    if not os.path.exists(INO_FILE):
        raise FileNotFoundError(f"Firmware Datei nicht gefunden: {INO_FILE}")
    with open(INO_FILE, "r", encoding="utf-8") as f:
        new_ino = render_ino_content(f.read(), config)
    write_files_atomic([(INO_FILE, new_ino), (CONFIG_FILE, json.dumps(config, indent=2))])

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

def find_serial_port():
    ports = glob.glob("/dev/cu.usbserial*") + glob.glob("/dev/cu.wchusbserial*")
    return ports[0] if ports else None

def flash_firmware():
    arduino_cli = find_arduino_cli()
    if not arduino_cli:
        return {"success": False, "error": "arduino-cli wurde nicht im System-Pfad gefunden! Bitte über 'brew install arduino-cli' installieren."}

    port = find_serial_port()
    if not port:
        return {"success": False, "error": "Kein ESP32 USB-Port gefunden (/dev/cu.usbserial*). Bitte sicherstellen, dass die Tastatur per USB angeschlossen ist."}

    # 1. Compile
    compile_cmd = [
        arduino_cli, "compile",
        "--fqbn", "esp32:esp32:lolin32-lite",
        SKETCH_DIR
    ]
    try:
        proc_comp = subprocess.run(compile_cmd, capture_output=True, text=True, check=False, env=os.environ, timeout=COMPILE_TIMEOUT_S)
        if proc_comp.returncode != 0:
            return {
                "success": False,
                "stage": "compile",
                "error": proc_comp.stderr or proc_comp.stdout
            }
    except FileNotFoundError:
        return {"success": False, "error": "arduino-cli wurde nicht im System-Pfad gefunden!"}
    except subprocess.TimeoutExpired:
        return {"success": False, "stage": "compile", "error": f"Kompilieren abgebrochen (Timeout nach {COMPILE_TIMEOUT_S}s)."}

    # 2. Upload
    upload_cmd = [
        arduino_cli, "upload",
        "-p", port,
        "--fqbn", "esp32:esp32:lolin32-lite",
        "--upload-property", "upload.speed=115200",
        SKETCH_DIR
    ]
    try:
        proc_up = subprocess.run(upload_cmd, capture_output=True, text=True, check=False, env=os.environ, timeout=UPLOAD_TIMEOUT_S)
    except subprocess.TimeoutExpired:
        return {"success": False, "stage": "upload", "error": f"Upload abgebrochen (Timeout nach {UPLOAD_TIMEOUT_S}s)."}
    if proc_up.returncode != 0:
        return {
            "success": False,
            "stage": "upload",
            "error": proc_up.stderr or proc_up.stdout
        }

    return {"success": True, "port": port, "message": "Firmware erfolgreich kompiliert und geflasht!"}


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
            ports = glob.glob("/dev/cu.usbserial*") + glob.glob("/dev/cu.wchusbserial*")
            self.send_json(200, {
                "status": "ok",
                "app": "dactyl-configurator",
                "port": ports[0] if ports else None,
                "ports": ports,
                "has_arduino_cli": bool(find_arduino_cli())
            })
            return

        if path == "/api/config":
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    content = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError):
                content = {"exists": False}
            self.send_json(200, content)
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

        if self.path == "/api/open_bluetooth_settings":
            try:
                subprocess.Popen(["open", "x-apple.systempreferences:com.apple.preference.security?Privacy_Bluetooth"])
                self.send_json(200, {"success": True})
            except Exception as e:
                self.send_json(500, {"success": False, "error": str(e)})
            return

        if self.path == "/api/save_and_flash":
            config = self.read_json_body()
            if config is None:
                return
            try:
                # 1. Validieren, C++ rendern und erst danach Config & .ino atomar schreiben
                save_config_and_firmware(config)
            except ValueError as err:
                self.send_json(400, {"success": False, "error": str(err)})
                return
            except Exception as err:
                self.send_json(500, {"success": False, "error": str(err)})
                return

            # 2. Flashen
            result = flash_firmware()
            self.send_json(200 if result.get("success") else 500, result)
            return

        if self.path == "/api/config":
            config = self.read_json_body()
            if config is None:
                return
            try:
                save_config_atomic(config)
            except ValueError as e:
                self.send_json(400, {"success": False, "error": str(e)})
                return
            except OSError as e:
                self.send_json(500, {"success": False, "error": str(e)})
                return
            self.send_json(200, {"success": True})
            return

        self.send_json(404, {"error": "Not found"})


def main():
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
