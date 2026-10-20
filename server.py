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
    "NONE": "0",
    "": "0",
    "0": "0"
}

def code_to_cpp(code):
    if not code:
        return "0"
    if code in KEY_TO_CPP:
        return KEY_TO_CPP[code]
    if code.startswith("KEY_") or code.startswith("ACT_"):
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

def generate_keymap_cpp(layers):
    lines = [
        "// [[[START_KEYMAP]]]",
        "uint16_t KEYMAP[NUM_LAYERS][6][7] = {"
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

    for l_idx in range(8):
        lines.append(f"  // {layer_names[l_idx]}")
        lines.append("  {")
        layer_data = layers[l_idx] if l_idx < len(layers) else []
        for r in range(6):
            row_entries = []
            for c in range(7):
                val = "0"
                if r < len(layer_data) and c < len(layer_data[r]):
                    cell = layer_data[r][c]
                    if isinstance(cell, dict):
                        tap_code = cell.get("tap", "NONE")
                        hold_code = cell.get("hold", "NONE")
                        effective_code = tap_code if (tap_code and tap_code != "NONE") else (hold_code or "NONE")
                        val = code_to_cpp(effective_code)
                    elif isinstance(cell, str):
                        val = code_to_cpp(cell)
                row_entries.append(val.ljust(16 if len(val) < 16 else len(val) + 1))
            comma = "," if r < 5 else ""
            lines.append(f"    {{ {', '.join(row_entries)} }}{comma}")
        layer_comma = "," if l_idx < len(layer_names) - 1 else ""
        lines.append(f"  }}{layer_comma}\n")

    lines.append("};")
    lines.append("// [[[END_KEYMAP]]]")
    return "\n".join(lines)

def update_ino_file(keymap_cpp):
    if not os.path.exists(INO_FILE):
        raise FileNotFoundError(f"Firmware Datei nicht gefunden: {INO_FILE}")

    with open(INO_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    pattern = r"// \[\[\[START_KEYMAP\]\]\].*?// \[\[\[END_KEYMAP\]\]\]"
    if not re.search(pattern, content, re.DOTALL):
        raise ValueError("Markierungen // [[[START_KEYMAP]]] ... // [[[END_KEYMAP]]] fehlen in dactyl_right.ino!")

    new_content = re.sub(pattern, keymap_cpp, content, flags=re.DOTALL)
    with open(INO_FILE, "w", encoding="utf-8") as f:
        f.write(new_content)

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
        proc_comp = subprocess.run(compile_cmd, capture_output=True, text=True, check=False, env=os.environ)
        if proc_comp.returncode != 0:
            return {
                "success": False,
                "stage": "compile",
                "error": proc_comp.stderr or proc_comp.stdout
            }
    except FileNotFoundError:
        return {"success": False, "error": "arduino-cli wurde nicht im System-Pfad gefunden!"}

    # 2. Upload
    upload_cmd = [
        arduino_cli, "upload",
        "-p", port,
        "--fqbn", "esp32:esp32:lolin32-lite",
        "--upload-property", "upload.speed=115200",
        SKETCH_DIR
    ]
    proc_up = subprocess.run(upload_cmd, capture_output=True, text=True, check=False, env=os.environ)
    if proc_up.returncode != 0:
        return {
            "success": False,
            "stage": "upload",
            "error": proc_up.stderr or proc_up.stdout
        }

    return {"success": True, "port": port, "message": "Firmware erfolgreich kompiliert und geflasht!"}


class ConfiguratorHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path == "/api/status":
            ports = glob.glob("/dev/cu.usbserial*") + glob.glob("/dev/cu.wchusbserial*")
            data = {
                "status": "ok",
                "port": ports[0] if ports else None,
                "ports": ports,
                "has_arduino_cli": bool(find_arduino_cli())
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode("utf-8"))
            return

        if self.path == "/api/config":
            if os.path.exists(CONFIG_FILE):
                try:
                    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(content.encode("utf-8"))
                    return
                except Exception as e:
                    pass
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"exists": False}).encode("utf-8"))
            return

        if self.path == "/api/open_bluetooth_settings":
            try:
                subprocess.Popen(["open", "x-apple.systempreferences:com.apple.preference.security?Privacy_Bluetooth"])
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"success": true}')
                return
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
                return

        super().do_GET()

    def do_POST(self):
        # Validate Host / Origin to prevent CSRF from unauthorized origins
        host = self.headers.get("Host", "")
        origin = self.headers.get("Origin", "")
        allowed_hosts = {"localhost:8088", "127.0.0.1:8088"}
        if host and host not in allowed_hosts:
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b'{"error": "Forbidden host"}')
            return
        allowed_origins = {"http://localhost:8088", "http://127.0.0.1:8088"}
        if origin and origin not in allowed_origins:
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b'{"error": "Forbidden origin"}')
            return

        if self.path == "/api/open_bluetooth_settings":
            try:
                subprocess.Popen(["open", "x-apple.systempreferences:com.apple.preference.security?Privacy_Bluetooth"])
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"success": true}')
                return
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
                return

        if self.path == "/api/save_and_flash":
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_length)
            try:
                config = json.loads(post_data.decode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": f"Ungültiges JSON: {e}"}).encode("utf-8"))
                return

            try:
                # 1. Config auf Platte speichern
                with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                    json.dump(config, f, indent=2)

                # 2. C++ Keymap generieren
                layers = config.get("layers", [])
                if not layers:
                    raise ValueError("Keine Ebenen (layers) in der Konfiguration vorhanden!")

                keymap_cpp = generate_keymap_cpp(layers)
                update_ino_file(keymap_cpp)

                # 3. Flashen
                result = flash_firmware()
                status_code = 200 if result.get("success") else 500
                self.send_response(status_code)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(result).encode("utf-8"))
                return

            except Exception as err:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(err)}).encode("utf-8"))
                return

        if self.path == "/api/config":
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_length)
            try:
                config = json.loads(post_data.decode("utf-8"))
                with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                    json.dump(config, f, indent=2)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode("utf-8"))
                return
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
                return

        self.send_response(404)
        self.end_headers()


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
