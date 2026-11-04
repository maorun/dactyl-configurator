#!/usr/bin/env python3
"""Flasht eine Hälfte mit der Firmware aus dem Repository, ohne die App: npm run flash -- L|R

Nutzt flash_firmware aus server.py: Hälfte per GET_INFO finden, kompilieren, Port erneut prüfen, NVS sichern,
mit 115200 Baud hochladen. Anders als "Auf Dactyl flashen" rendert das Skript kein Layout in die .ino; mit
KEYMAP_DEFAULTS_ID 0 bleibt die Keymap im NVS erhalten. Die NVS-Abbilder landen im Datenordner der App
(DACTYL_DATA_DIR, sonst wie build-app.sh), damit /api/nvs_backups und /api/nvs_restore sie finden.
"""
import os
import re
import sys

REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_APP_DATA_DIR = os.path.expanduser("~/Library/Application Support/dactyl-configurator/data")
USAGE = "Aufruf: npm run flash -- L|R"
SKETCHES = {"R": "dactyl_right", "L": "dactyl_left"}
NEW_DEFAULTS_MARKER = "NVS: Neue Default-Belegung"
KEPT_KEYMAP_MARKER = "NVS: Gespeicherte Keymap geladen"
ERROR_MARKER = "NVS: FEHLER"
DEFAULTS_ID_RE = re.compile(r"^#define KEYMAP_DEFAULTS_ID (\S+)$", re.MULTILINE)


def app_data_dir(environ=None):
    environ = os.environ if environ is None else environ
    return os.path.abspath(environ.get("DACTYL_DATA_DIR") or DEFAULT_APP_DATA_DIR)


def sketch_dir(side):
    return os.path.join(REPO_DIR, "firmware", SKETCHES[side])


def load_server(environ=None):
    """server.py mit dem Sketch aus dem Checkout und den Backups im Datenordner der App."""
    sys.path.insert(0, REPO_DIR)
    try:
        import server
    finally:
        sys.path.remove(REPO_DIR)
    # Pfade fest setzen: server.py leitet sie beim Import aus DACTYL_DATA_DIR ab (App: Kopie im Datenordner)
    server.SKETCH_DIR = sketch_dir("R")
    server.LEFT_SKETCH_DIR = sketch_dir("L")
    data_dir = app_data_dir(environ)
    server.BACKUP_DIR = os.path.join(data_dir, "config_backups", "right")
    server.LEFT_BACKUP_DIR = os.path.join(data_dir, "config_backups", "left")
    return server


def defaults_id(side):
    """KEYMAP_DEFAULTS_ID der .ino im Checkout, None ohne die Zeile."""
    name = SKETCHES[side]
    with open(os.path.join(sketch_dir(side), f"{name}.ino"), encoding="utf-8") as f:
        match = DEFAULTS_ID_RE.search(f.read())
    return match.group(1) if match else None


def report_new_defaults(boot_log, side, backup_path, out):
    """Meldet den Stand der Keymap nach dem Start. Gibt True zurück, wenn der Backup-Pfad und der Restore-Weg
    erschienen (Marker "Neue Default-Belegung")."""
    if NEW_DEFAULTS_MARKER not in boot_log:
        if KEPT_KEYMAP_MARKER in boot_log:
            print("Die gespeicherte Keymap blieb erhalten.", file=out)
        elif ERROR_MARKER in boot_log:
            print("⚠️ Der Start meldet einen NVS-Fehler beim Schreiben der Defaults; der nächste Start wiederholt es.",
                  file=out)
        else:
            print("Start-Log nicht gelesen (kein NVS-Marker): Prüfe die Keymap selbst, Sicherung siehe oben.", file=out)
        return False
    print("⚠️ Der erste Start hat die Default-Belegung der Firmware in den NVS geschrieben (leerer NVS, "
          "RESET_CONFIG oder neue ID). Eine vorher gespeicherte Keymap ist dadurch ersetzt.", file=out)
    if backup_path:
        print(f"Die vorherige Belegung steht in der NVS-Sicherung: {backup_path}", file=out)
    else:
        print("Es gibt keine NVS-Sicherung dieses Flashs; ältere Sicherungen listet /api/nvs_backups.", file=out)
    print(f"Wiederherstellen: POST /api/nvs_restore?side={side} mit {{\"id\": \"<Name ohne .bin>\"}} "
          "oder im Dialog \"Profile\" der App unter \"NVS-Sicherungen (USB)\".", file=out)
    return True


def main(argv, environ=None, out=None, read_boot_log=None):
    out = sys.stdout if out is None else out
    side = argv[0].upper() if len(argv) == 1 else ""
    if side not in SKETCHES:
        print(USAGE, file=sys.stderr)
        return 2
    # Eine von "python3 server.py" gerenderte .ino trägt eine neue ID: sie würde die Keymap im NVS überschreiben
    current_id = defaults_id(side)
    if current_id != "0UL":
        print(f"KEYMAP_DEFAULTS_ID ist {current_id} statt 0UL: die .ino im Checkout ist gerendert. "
              f"Erst 'git restore firmware/{SKETCHES[side]}' ausführen, sonst überschreibt der Flash die Keymap.",
              file=sys.stderr)
        return 1
    server = load_server(environ)

    def on_output(stage, line):
        print(f"[{stage}] {line}", file=out, flush=True)

    result = server.flash_firmware(side, on_output=on_output)
    if not result.get("success"):
        stage = f" (Phase {result['stage']})" if result.get("stage") else ""
        print(f"Flashen fehlgeschlagen{stage}: {result.get('error', '')}", file=sys.stderr)
        return 1
    folder = server.side_paths(side)["backups"]
    backup_path = os.path.join(folder, result["nvsBackup"]) if result.get("nvsBackup") else None
    if backup_path:
        print(f"NVS-Sicherung: {backup_path}", file=out)
    else:
        print("⚠️ Geflasht, aber keine NVS-Sicherung angelegt (siehe Ausgabe [nvs]).", file=sys.stderr)
    print(f"{result['message']} Port {result['port']}", file=out)
    # Start-Log prüfen: ID 0 ersetzt nie eine Keymap; "Neue Default-Belegung" meldet den ersten Start oder einen Fehler
    reader = read_boot_log or (lambda port: server.read_boot_log(port, markers=(NEW_DEFAULTS_MARKER, KEPT_KEYMAP_MARKER, ERROR_MARKER), reset=True))
    report_new_defaults(reader(result["port"]), side, backup_path, out)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
