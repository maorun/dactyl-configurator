import unittest
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import http.client
import socketserver
import threading

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import server

class TestServerAndCodegen(unittest.TestCase):

    def test_code_to_cpp(self):
        self.assertEqual(server.code_to_cpp("KEY_A"), "'a'")
        self.assertEqual(server.code_to_cpp("KEY_Z"), "'z'")
        self.assertEqual(server.code_to_cpp("KEY_ESC"), "KEY_ESC")
        self.assertEqual(server.code_to_cpp("KEY_RETURN"), "KEY_RETURN")
        self.assertEqual(server.code_to_cpp("KEY_UP_ARROW"), "KEY_UP_ARROW")
        self.assertEqual(server.code_to_cpp("ACT_LAYER_UP"), "ACT_LAYER_UP")
        self.assertEqual(server.code_to_cpp("ACT_LAYER_DOWN"), "ACT_LAYER_DOWN")
        self.assertEqual(server.code_to_cpp("MOUSE_LEFT"), "ACT_MOUSE_LEFT")
        self.assertEqual(server.code_to_cpp("MOUSE_RIGHT"), "ACT_MOUSE_RIGHT")
        self.assertEqual(server.code_to_cpp("MOUSE_MIDDLE"), "ACT_MOUSE_MIDDLE")
        self.assertEqual(server.code_to_cpp("MOUSE_WHEEL_UP"), "ACT_MOUSE_WHEEL_UP")
        self.assertEqual(server.code_to_cpp("MOUSE_WHEEL_DOWN"), "ACT_MOUSE_WHEEL_DOWN")
        self.assertEqual(server.code_to_cpp("KEY_126"), "126") # Numeric literal (Finding #15)
        self.assertEqual(server.code_to_cpp("~"), "'~'")
        self.assertEqual(server.code_to_cpp("'"), "'\\''")
        self.assertEqual(server.code_to_cpp("\\"), "'\\\\'")
        self.assertEqual(server.code_to_cpp("KEY_NON_US_BACKSLASH"), "KEY_NON_US_BACKSLASH")
        self.assertEqual(server.code_to_cpp("UMLAUT_OE"), "ACT_UMLAUT_OE")
        self.assertEqual(server.code_to_cpp("UMLAUT_SZ"), "ACT_UMLAUT_SZ")
        self.assertEqual(server.code_to_cpp("OSM_LSHIFT"), "ACT_OSM_LSHIFT")
        self.assertEqual(server.code_to_cpp("OSM_RGUI"), "ACT_OSM_RGUI")
        self.assertEqual(server.code_to_cpp("CAPS_WORD"), "ACT_CAPS_WORD")
        self.assertEqual(server.code_to_cpp("NONE"), "0")
        self.assertEqual(server.code_to_cpp(""), "0")

    def test_generate_combos_cpp(self):
        combos = [
            {
                "id": "c1",
                "key1": {"r": 2, "c": 1},
                "key2": {"r": 2, "c": 2},
                "behavior": "KEY_PRESS",
                "action": "KEY_ESC"
            },
            {
                "id": "c2",
                "key1": {"r": 2, "c": 1},
                "key2": {"r": 2, "c": 3},
                "behavior": "MODIFIER_HOLD",
                "action": "KEY_LEFT_CTRL"
            }
        ]
        cpp = server.generate_combos_cpp(combos)
        self.assertIn("uint8_t numCombos = 2;", cpp)
        # KeyCombo in der Firmware hat genau 6 Felder (kein Runtime-Flag)
        self.assertIn("{ 2, 1, 2, 2, 0, KEY_ESC }", cpp)
        self.assertIn("{ 2, 1, 2, 3, 1, KEY_LEFT_CTRL }", cpp)
        self.assertNotIn("false", cpp)

    def test_generate_settings_cpp(self):
        settings = {
            "deviceName": "Test Dactyl",
            "debounceMs": 8,
            "comboTimeoutMs": 65,
            "tappingTermMs": 250,
            "standbyTimeoutMinutes": 15,
            "sleepTimeoutMinutes": 90
        }
        cpp = server.generate_settings_cpp(settings)
        self.assertIn('String deviceName = "Test Dactyl";', cpp)
        self.assertIn("uint8_t debounceMs = 8;", cpp)
        self.assertIn("uint16_t comboTimeoutMs = 65;", cpp)
        self.assertIn("uint16_t tappingTermMs = 250;", cpp)
        self.assertIn("uint16_t tappingTermMs = 200;", server.generate_settings_cpp({}))
        with self.assertRaises(ValueError):
            server.generate_settings_cpp({"tappingTermMs": 99})
        self.assertIn("uint32_t standbyTimeoutMinutes = 15;", cpp)
        self.assertIn("uint32_t deepSleepTimeoutMinutes = 90;", cpp)

    def test_code_to_cpp_backslash_survives_ino_substitution(self):
        # Regression: re.sub-Ersatztext darf '\\\\' nicht zu '\\' (ungültiges C++ '\') machen
        layers = [[[{"tap": "KEY_BACKSLASH", "hold": "NONE"}]]]
        content = "a\n// [[[START_KEYMAP]]]\nold\n// [[[END_KEYMAP]]]\n// [[[START_HOLDMAP]]]\n// [[[END_HOLDMAP]]]\n// [[[START_DTAPMAP]]]\n// [[[END_DTAPMAP]]]\nb"
        out = server.render_ino_content(content, {"layers": layers})
        self.assertIn("'\\\\'", out)
        self.assertNotIn("'\\'", out.replace("'\\\\'", ""))

    def test_render_ino_requires_holdmap_marker(self):
        content = "// [[[START_KEYMAP]]]\n// [[[END_KEYMAP]]]"
        with self.assertRaises(ValueError):
            server.render_ino_content(content, {"layers": [[]]})

    def test_holdmap_codegen(self):
        layers = [[[{"tap": "KEY_SPACE", "hold": "MOD_LCTRL"}, {"tap": "NONE", "hold": "MO_1"}]]]
        keymap = server.generate_keymap_cpp(layers)
        holdmap = server.generate_holdmap_cpp(layers)
        self.assertIn("uint16_t HOLDMAP[NUM_LAYERS][6][7]", holdmap)
        self.assertIn("KEY_LEFT_CTRL", holdmap)
        # Hold ohne Tap wirkt wie eine normale Taste und landet in KEYMAP
        self.assertIn("ACT_MO_1", keymap)
        self.assertNotIn("ACT_MO_1", holdmap)

    def test_dtapmap_codegen(self):
        layers = [[[{"tap": "KEY_J", "hold": "MOD_LCTRL", "dtap": "KEY_ESC"},
                    {"tap": "NONE", "hold": "NONE", "dtap": "KEY_TAB"},
                    {"tap": "KEY_K", "dtap": 5},
                    "KEY_L"]]]
        dtapmap = server.generate_dtapmap_cpp(layers)
        self.assertIn("uint16_t DTAPMAP[NUM_LAYERS][6][7]", dtapmap)
        self.assertIn("KEY_ESC", dtapmap)
        # Doppel-Tipp ohne Tap-Aktion bleibt ohne Wirkung, ungültige Typen werden 0
        self.assertNotIn("KEY_TAB", dtapmap)
        self.assertEqual(server.cell_actions({"tap": "KEY_K", "dtap": 5}), ("KEY_K", "NONE", "NONE"))
        self.assertEqual(server.cell_actions("KEY_L"), ("KEY_L", "NONE", "NONE"))
        self.assertNotIn("KEY_ESC", server.generate_keymap_cpp(layers))
        self.assertNotIn("KEY_ESC", server.generate_holdmap_cpp(layers))

    def test_render_ino_requires_dtapmap_marker(self):
        content = "// [[[START_KEYMAP]]]\n// [[[END_KEYMAP]]]\n// [[[START_HOLDMAP]]]\n// [[[END_HOLDMAP]]]"
        with self.assertRaises(ValueError):
            server.render_ino_content(content, {"layers": [[]]})

    def test_combo_injection_rejected(self):
        bad = [{"key1": {"r": "0}; system(\"x\"); //", "c": 1}, "key2": {"r": 2, "c": 2}, "action": "KEY_ESC"}]
        with self.assertRaises(ValueError):
            server.generate_combos_cpp(bad)
        with self.assertRaises(ValueError):
            server.generate_combos_cpp([{"key1": {"r": 6, "c": 0}, "key2": {"r": 2, "c": 2}}])
        with self.assertRaises(ValueError):
            server.generate_combos_cpp([{"key1": {"r": True, "c": 0}, "key2": {"r": 2, "c": 2}}])
        with self.assertRaises(ValueError):
            server.generate_combos_cpp([{"key1": {"r": 1, "c": 0}, "key2": {"r": 2, "c": 2}}] * 17)

    def test_settings_validation_and_name_sanitizing(self):
        with self.assertRaises(ValueError):
            server.generate_settings_cpp({"debounceMs": 0})
        with self.assertRaises(ValueError):
            server.generate_settings_cpp({"comboTimeoutMs": "40"})
        with self.assertRaises(ValueError):
            server.generate_settings_cpp({"sleepTimeoutMinutes": 999})
        cpp = server.generate_settings_cpp({"deviceName": 'Evil"\\\nName'})
        self.assertIn('String deviceName = "EvilName";', cpp)
        names = server.generate_layer_names_cpp(['A"B\\C', 42])
        self.assertIn('"ABC"', names)
        self.assertIn('"Nav & Pfeile"', names)

    def test_save_and_flash_validates_before_writing(self):
        with tempfile.TemporaryDirectory() as d:
            cfg_path = os.path.join(d, "current_config.json")
            ino_path = os.path.join(d, "dactyl_right.ino")
            original_ino = "// [[[START_KEYMAP]]]\nx\n// [[[END_KEYMAP]]]\n// [[[START_HOLDMAP]]]\n// [[[END_HOLDMAP]]]\n// [[[START_DTAPMAP]]]\n// [[[END_DTAPMAP]]]\n// [[[START_DEFAULTS_ID]]]\n// [[[END_DEFAULTS_ID]]]\n"
            with open(ino_path, "w") as f:
                f.write(original_ino)
            with open(cfg_path, "w") as f:
                f.write('{"layers": [[]]}')
            old_cfg, old_ino = server.CONFIG_FILE, server.INO_FILE
            server.CONFIG_FILE, server.INO_FILE = cfg_path, ino_path
            try:
                with self.assertRaises(ValueError):
                    server.save_config_and_firmware({"layers": [[]], "settings": {"debounceMs": 500}})
                with open(ino_path) as f:
                    self.assertEqual(f.read(), original_ino)
                with open(cfg_path) as f:
                    self.assertEqual(f.read(), '{"layers": [[]]}')
                server.save_config_and_firmware({"layers": [[[{"tap": "KEY_A"}]]]})
                with open(ino_path) as f:
                    self.assertIn("'a'", f.read())
                self.assertEqual(sorted(os.listdir(d)), ["current_config.json", "dactyl_right.ino"])
            finally:
                server.CONFIG_FILE, server.INO_FILE = old_cfg, old_ino

    def test_save_and_flash_keeps_both_files_on_second_write_failure(self):
        with tempfile.TemporaryDirectory() as d:
            cfg_path = os.path.join(d, "current_config.json")
            ino_path = os.path.join(d, "dactyl_right.ino")
            original_ino = "// [[[START_KEYMAP]]]\nx\n// [[[END_KEYMAP]]]\n// [[[START_HOLDMAP]]]\n// [[[END_HOLDMAP]]]\n// [[[START_DTAPMAP]]]\n// [[[END_DTAPMAP]]]\n// [[[START_DEFAULTS_ID]]]\n// [[[END_DEFAULTS_ID]]]\n"
            with open(ino_path, "w") as f:
                f.write(original_ino)
            with open(cfg_path, "w") as f:
                f.write('{"layers": [[]]}')
            old_cfg, old_ino, old_write = server.CONFIG_FILE, server.INO_FILE, server.write_temp_file
            server.CONFIG_FILE, server.INO_FILE = cfg_path, ino_path
            calls = []

            def failing_second_write(path, text):
                calls.append(path)
                if len(calls) == 2:
                    raise OSError("disk full")
                return old_write(path, text)

            server.write_temp_file = failing_second_write
            try:
                with self.assertRaises(OSError):
                    server.save_config_and_firmware({"layers": [[[{"tap": "KEY_A"}]]]})
                with open(ino_path) as f:
                    self.assertEqual(f.read(), original_ino)
                with open(cfg_path) as f:
                    self.assertEqual(f.read(), '{"layers": [[]]}')
                self.assertEqual(sorted(os.listdir(d)), ["current_config.json", "dactyl_right.ino"])
            finally:
                server.CONFIG_FILE, server.INO_FILE, server.write_temp_file = old_cfg, old_ino, old_write

    def test_write_files_atomic_rolls_back_on_second_replace_failure(self):
        with tempfile.TemporaryDirectory() as d:
            a, b = os.path.join(d, "a.txt"), os.path.join(d, "b.txt")
            for p, t in ((a, "old-a"), (b, "old-b")):
                with open(p, "w") as f:
                    f.write(t)
            real_replace = server.os.replace
            state = {"n": 0}

            def failing_replace(src, dst):
                state["n"] += 1
                if state["n"] == 2:
                    raise OSError("replace failed")
                return real_replace(src, dst)

            server.os.replace = failing_replace
            try:
                with self.assertRaises(OSError):
                    server.write_files_atomic([(a, "new-a"), (b, "new-b")])
            finally:
                server.os.replace = real_replace
            with open(a) as f:
                self.assertEqual(f.read(), "old-a")
            with open(b) as f:
                self.assertEqual(f.read(), "old-b")
            self.assertEqual(sorted(os.listdir(d)), ["a.txt", "b.txt"])

    def test_write_files_atomic_keeps_original_error_when_rollback_fails(self):
        with tempfile.TemporaryDirectory() as d:
            a, b = os.path.join(d, "a.txt"), os.path.join(d, "b.txt")
            for p, t in ((a, "old-a"), (b, "old-b")):
                with open(p, "w") as f:
                    f.write(t)
            real_replace = server.os.replace
            state = {"n": 0}

            def failing_replace(src, dst):
                state["n"] += 1
                if state["n"] >= 2:  # zweites Ersetzen UND Rollback schlagen fehl
                    raise OSError(f"replace failed #{state['n']}")
                return real_replace(src, dst)

            server.os.replace = failing_replace
            try:
                with self.assertRaises(OSError) as ctx:
                    server.write_files_atomic([(a, "new-a"), (b, "new-b")])
            finally:
                server.os.replace = real_replace
            self.assertEqual(str(ctx.exception), "replace failed #2")
            self.assertEqual(sorted(os.listdir(d)), ["a.txt", "b.txt"])

    def test_validate_config_rejects_malformed_matrix(self):
        bad_configs = [
            {"layers": [None]},
            {"layers": [[[]] * 7]},                       # 7 Zeilen
            {"layers": [[[{"tap": "KEY_A"}] * 8]]},       # 8 Spalten
            {"layers": [["not-a-row"]]},
            {"layers": [[[42]]]},                         # Taste weder Objekt noch Code
        ]
        for cfg in bad_configs:
            with self.assertRaises(ValueError, msg=str(cfg)[:60]):
                server.validate_config(cfg)
        # Kürzere Matrizen bleiben erlaubt
        server.validate_config({"layers": [[], [[{"tap": "KEY_A"}]], [["KEY_B"] * 7] * 6]})

    def test_handler_has_socket_timeout(self):
        self.assertGreater(server.ConfiguratorHandler.timeout or 0, 0)

    def test_key_pairs_codegen_and_validation(self):
        cpp = server.generate_key_pairs_cpp([
            {"first": "KEY_LEFT_SHIFT", "second": "KEY_PERIOD"},
            {"first": "KEY_A", "second": "KEY_S"}
        ])
        self.assertIn("uint8_t numKeyPairs = 2;", cpp)
        self.assertIn("{ KEY_LEFT_SHIFT, '.' }", cpp)
        self.assertIn("{ 'a', 's' }", cpp)
        self.assertIn("{ 0, 0 }", server.generate_key_pairs_cpp([]))
        self.assertIn("{ 0, 0 }", server.generate_key_pairs_cpp(None))
        # Nur normale Tasten und Modifier: keine Layer-, Media-, Maus- oder Paar-Codes
        self.assertIn("{ 'a', 200 }", server.generate_key_pairs_cpp([{"first": "KEY_A", "second": "KEY_200"}]))
        self.assertIn("{ ':', 'a' }", server.generate_key_pairs_cpp([{"first": ":", "second": "KEY_A"}]))
        self.assertIn("{ KEY_LEFT_SHIFT, KEY_NON_US_BACKSLASH }",
                      server.generate_key_pairs_cpp([{"first": "KEY_LEFT_SHIFT", "second": "KEY_NON_US_BACKSLASH"}]))
        for bad in ("MO_1", "MEDIA_MUTE", "UMLAUT_AE", "OSM_LSHIFT", "CAPS_WORD", "MOUSE_LEFT", "PAIR_0", "NONE", "", None, 5, "KEY_A; evil",
                    "KEY_0256", "KEY_256", "KEY_300", "KEY_FOO", "\x01"):
            with self.assertRaises(ValueError, msg=repr(bad)):
                server.generate_key_pairs_cpp([{"first": "KEY_A", "second": bad}])
        with self.assertRaises(ValueError):
            server.generate_key_pairs_cpp([{"first": "KEY_A", "second": "KEY_B"}] * 17)
        with self.assertRaises(ValueError):
            server.generate_key_pairs_cpp("kaputt")
        with self.assertRaises(ValueError):
            server.validate_config({"layers": [[]], "keyPairs": [{"first": "MO_1", "second": "KEY_A"}]})

    def test_pair_action_code_maps_to_firmware_constant(self):
        self.assertEqual(server.code_to_cpp("PAIR_0"), "(ACT_KEY_PAIR_BASE + 0)")
        self.assertEqual(server.code_to_cpp("PAIR_15"), "(ACT_KEY_PAIR_BASE + 15)")
        self.assertEqual(server.code_to_cpp("PAIR_16"), "0")
        self.assertEqual(server.code_to_cpp("PAIR_x"), "0")
        cpp = server.generate_keymap_cpp([[[{"tap": "PAIR_3", "hold": "PAIR_4"}]]])
        self.assertIn("(ACT_KEY_PAIR_BASE + 3)", cpp)
        self.assertIn("(ACT_KEY_PAIR_BASE + 4)", server.generate_holdmap_cpp([[[{"tap": "KEY_A", "hold": "PAIR_4"}]]]))

    def test_real_ino_renders_with_all_markers(self):
        with open(server.INO_FILE, encoding="utf-8") as f:
            content = f.read()
        # Versionierte Vorlage (current_config.json ist lokaler Laufzeitzustand und fehlt in CI)
        with open(server.DEFAULT_CONFIG_FILE, encoding="utf-8") as f:
            cfg = json.load(f)
        server.validate_config(cfg)
        out = server.render_ino_content(content, cfg)
        for marker in ("KEYMAP", "HOLDMAP", "DTAPMAP", "LAYER_NAMES", "COMBOS", "KEY_PAIRS", "SETTINGS"):
            self.assertEqual(out.count(f"// [[[START_{marker}]]]"), 1)
        out = server.render_ino_content(content, dict(cfg, keyPairs=[{"first": "KEY_LEFT_SHIFT", "second": "KEY_PERIOD"}]))
        self.assertIn("uint8_t numKeyPairs = 1;", out)

    def test_app_flash_sets_new_nonzero_defaults_id(self):
        with tempfile.TemporaryDirectory() as d:
            cfg_path, ino_path = os.path.join(d, "current_config.json"), os.path.join(d, "dactyl_right.ino")
            with open(server.INO_FILE, encoding="utf-8") as f:
                real_ino = f.read()
            # Fixture mit Repository-Stand (ID 0); die echte .ino trägt nach einem App-Flash lokal eine andere ID
            fixture_ino, n = re.subn(r"#define KEYMAP_DEFAULTS_ID \d+UL", "#define KEYMAP_DEFAULTS_ID 0UL", real_ino)
            self.assertEqual(n, 1)
            with open(ino_path, "w", encoding="utf-8") as f:
                f.write(fixture_ino)
            old_cfg, old_ino = server.CONFIG_FILE, server.INO_FILE
            server.CONFIG_FILE, server.INO_FILE = cfg_path, ino_path
            try:
                ids = []
                for _ in range(2):
                    server.save_config_and_firmware({"layers": [[[{"tap": "KEY_A"}]]]})
                    with open(ino_path, encoding="utf-8") as f:
                        m = re.search(r"#define KEYMAP_DEFAULTS_ID (\d+)UL", f.read())
                    self.assertIsNotNone(m)
                    ids.append(int(m.group(1)))
                self.assertTrue(all(0 < i <= 0xFFFFFFFF for i in ids))
                self.assertNotEqual(ids[0], ids[1])  # jeder App-Flash überschreibt die Geräte-Belegung
            finally:
                server.CONFIG_FILE, server.INO_FILE = old_cfg, old_ino

    def test_load_config_falls_back_to_default_template(self):
        with tempfile.TemporaryDirectory() as d:
            user, default = os.path.join(d, "current_config.json"), os.path.join(d, "default_config.json")
            with open(default, "w") as f:
                f.write('{"layers": [[]], "tag": "default-file"}')
            old_cfg, old_default = server.CONFIG_FILE, server.DEFAULT_CONFIG_FILE
            server.CONFIG_FILE, server.DEFAULT_CONFIG_FILE = user, default
            try:
                cfg = server.load_config_for_app()                                   # keine Nutzer-Config
                self.assertEqual((cfg["tag"], cfg["source"]), ("default-file", "default"))
                with open(user, "w") as f:
                    f.write('{"layers": [[]], "tag": "user-file"}')
                cfg = server.load_config_for_app()                                   # Nutzer-Config gewinnt
                self.assertEqual((cfg["tag"], cfg["source"]), ("user-file", "user"))
                with open(user, "w") as f:
                    f.write("null")
                self.assertEqual(server.load_config_for_app(), {"exists": False})     # kein Objekt
                os.remove(user)
                os.mkdir(user)                                                        # unlesbar (IsADirectoryError)
                self.assertEqual(server.load_config_for_app(), {"exists": False})
                os.rmdir(user)
                with open(user, "w") as f:
                    f.write("{kaputt")
                self.assertEqual(server.load_config_for_app(), {"exists": False})     # kein stiller Fallback
                os.remove(user)
                os.remove(default)
                self.assertEqual(server.load_config_for_app(), {"exists": False})
            finally:
                server.CONFIG_FILE, server.DEFAULT_CONFIG_FILE = old_cfg, old_default

    def test_user_config_is_not_versioned(self):
        root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
        with open(os.path.join(root, ".gitignore"), encoding="utf-8") as f:
            ignored = [line.strip() for line in f]
        self.assertIn("current_config.json", ignored)
        self.assertTrue(os.path.exists(os.path.join(root, "default_config.json")))

    def test_flash_uses_min_spiffs_partition_for_compile_and_upload(self):
        calls = []

        class Done:
            returncode = 0
            stdout = ""
            stderr = ""

        def fake_run(cmd, **kwargs):
            calls.append(cmd)
            return Done()

        old = (server.find_arduino_cli, server.find_serial_port, server.query_device_side, server.subprocess.run)
        server.find_arduino_cli = lambda: "/opt/homebrew/bin/arduino-cli"
        server.find_serial_port = lambda side="R": "/dev/cu.usbserial-test"
        server.query_device_side = lambda port: "R"
        server.subprocess.run = fake_run
        try:
            server.flash_firmware()
        finally:
            server.find_arduino_cli, server.find_serial_port, server.query_device_side, server.subprocess.run = old
        self.assertEqual([c[1] for c in calls], ["compile", "upload"])
        for cmd in calls:
            self.assertEqual(cmd[cmd.index("--fqbn") + 1], "esp32:esp32:lolin32-lite:PartitionScheme=min_spiffs")

    def run_flash(self, side, port_for, side_before_upload=None):
        """Führt flash_firmware(side) mit gefälschtem arduino-cli aus; port_for(side) ersetzt die Port-Erkennung.
        side_before_upload: Antwort der Nachprüfung vor dem Upload (Standard: die angefragte Hälfte)."""
        calls = []
        probes = []

        class Done:
            returncode = 0
            stdout = ""
            stderr = ""

        def fake_run(cmd, **kwargs):
            calls.append(cmd)
            return Done()

        def fake_query(port):
            probes.append((port, len(calls)))
            return side if side_before_upload is None else side_before_upload

        old = (server.find_arduino_cli, server.find_serial_port, server.query_device_side, server.subprocess.run)
        server.find_arduino_cli = lambda: "/opt/homebrew/bin/arduino-cli"
        server.find_serial_port = port_for
        server.query_device_side = fake_query
        server.subprocess.run = fake_run
        try:
            result = server.flash_firmware(side)
        finally:
            server.find_arduino_cli, server.find_serial_port, server.query_device_side, server.subprocess.run = old
        self.last_probes = probes
        return result, calls

    def test_flash_rechecks_port_side_before_upload(self):
        # Kompilieren dauert lange: wurde umgesteckt, darf der Upload nicht auf die andere Hälfte gehen
        result, calls = self.run_flash("L", lambda s: "/dev/cu.usbserial-a", side_before_upload="R")
        self.assertFalse(result["success"])
        self.assertEqual(result["stage"], "port")
        self.assertEqual([c[1] for c in calls], ["compile"])          # kein Upload
        self.assertEqual(self.last_probes, [("/dev/cu.usbserial-a", 1)])  # geprüft nach dem Compile
        result, calls = self.run_flash("L", lambda s: "/dev/cu.usbserial-a", side_before_upload=None)
        self.assertTrue(result["success"])
        self.assertEqual([c[1] for c in calls], ["compile", "upload"])

    def test_flash_uses_sketch_and_port_of_the_side(self):
        ports = {"L": "/dev/cu.usbserial-left", "R": "/dev/cu.usbserial-right"}
        for side, sketch in (("L", server.LEFT_SKETCH_DIR), ("R", server.SKETCH_DIR)):
            result, calls = self.run_flash(side, lambda s: ports[s])
            self.assertTrue(result["success"])
            self.assertEqual(result["side"], side)
            self.assertEqual([c[-1] for c in calls], [sketch, sketch])
            self.assertEqual(calls[1][calls[1].index("-p") + 1], ports[side])

    def test_flash_without_matching_side_does_not_compile_or_upload(self):
        result, calls = self.run_flash("L", lambda s: None)
        self.assertFalse(result["success"])
        self.assertEqual(result["stage"], "port")
        self.assertIn("linke", result["error"])
        self.assertEqual(calls, [])

    def test_find_serial_port_picks_only_the_reporting_side(self):
        old = (server.list_serial_ports, server.query_device_side)
        answers = {"/dev/cu.usbserial-a": "R", "/dev/cu.usbserial-b": "L", "/dev/cu.usbserial-c": None}
        server.list_serial_ports = lambda: list(answers)
        server.query_device_side = lambda port: answers[port]
        try:
            self.assertEqual(server.find_serial_port("L"), "/dev/cu.usbserial-b")
            self.assertEqual(server.find_serial_port("R"), "/dev/cu.usbserial-a")
            answers["/dev/cu.usbserial-b"] = None
            self.assertIsNone(server.find_serial_port("L"))       # nie auf die rechte Hälfte ausweichen
            server.list_serial_ports = lambda: []
            self.assertIsNone(server.find_serial_port("R"))
        finally:
            server.list_serial_ports, server.query_device_side = old

    def test_parse_device_side(self):
        info = 'DEVICE_INFO:{"name":"Dactyl Links","side":"L","mac":"x"}\n'
        self.assertEqual(server.parse_device_side("boot\n" + info), "L")
        self.assertEqual(server.parse_device_side('DEVICE_INFO:{"name":"Dactyl Keyboard"}\n'), "R")  # alte Firmware
        self.assertIsNone(server.parse_device_side('DEVICE_INFO:{"side":"X"}\n'))
        self.assertIsNone(server.parse_device_side(info[:-1]))                                     # Zeile unvollständig
        self.assertIsNone(server.parse_device_side('DEVICE_INFO:{kaputt\n'))
        self.assertIsNone(server.parse_device_side('DEVICE_INFO:["L"]\n'))
        self.assertIsNone(server.parse_device_side("STATUS: ok\n"))

    def test_parse_side(self):
        self.assertEqual(server.parse_side("/api/config"), "R")
        self.assertEqual(server.parse_side("/api/config?side=L"), "L")
        self.assertEqual(server.parse_side("/api/config?side=R"), "R")
        self.assertIsNone(server.parse_side("/api/config?side=X"))
        self.assertIsNone(server.parse_side("/api/config?side=l"))
        self.assertIsNone(server.parse_side("/api/config?side=L&side=R"))

    def test_left_absent_keys_and_combos_are_rejected(self):
        for r, c in ((4, 5), (5, 0)):
            layer = [[{"tap": "NONE"}] * 7 for _ in range(6)]
            layer[r] = list(layer[r])
            layer[r][c] = {"tap": "KEY_A"}
            with self.assertRaises(ValueError):
                server.validate_config({"layers": [layer]}, "L")
            server.validate_config({"layers": [layer]}, "R")  # rechts existiert die Taste
        combo = {"key1": {"r": 0, "c": 0}, "key2": {"r": 4, "c": 5}, "behavior": "KEY_PRESS", "action": "KEY_ESC"}
        with self.assertRaises(ValueError):
            server.validate_config({"layers": [[]], "combos": [combo]}, "L")
        combo_r = dict(combo, key2={"r": 4, "c": 0})
        with self.assertRaises(ValueError):
            server.validate_config({"layers": [[]], "combos": [combo_r]}, "R")
        server.validate_config({"layers": [[]], "combos": [combo_r]}, "L")

    def test_absent_key_cell_rules_match_app(self):
        # Dieselben Fälle wie in tests/test_side_profiles.js: Doppel-Tipp ohne Tap ist keine Aktion
        def layer_with(cell):
            layer = [[{"tap": "NONE"}] * 7 for _ in range(6)]
            layer[5] = list(layer[5])
            layer[5][0] = cell
            return {"layers": [layer]}
        allowed = [{"tap": "NONE", "hold": "NONE", "dtap": "KEY_A"}, {"tap": "", "dtap": "KEY_A"},
                   {"tap": 7, "hold": "NONE"}, "0", {"tap": "0"}]
        rejected = [{"tap": "NONE", "hold": "MO_1", "dtap": "KEY_A"}, {"tap": "KEY_A", "hold": "NONE", "dtap": "NONE"},
                    {"tap": "KEY_A", "dtap": 5}, "KEY_A", {"tap": "0", "dtap": "KEY_A"}, {"tap": "0", "hold": "MO_1"},
                    {"hold": "KEY_A"}]
        for cell in allowed:
            server.validate_config(layer_with(cell), "L")
        for cell in rejected:
            with self.assertRaises(ValueError, msg=str(cell)):
                server.validate_config(layer_with(cell), "L")

    def test_left_default_name_in_settings(self):
        self.assertIn('String deviceName = "Dactyl Links";', server.generate_settings_cpp({}, "L"))
        self.assertIn('String deviceName = "Dactyl Keyboard";', server.generate_settings_cpp({}, "R"))

    def test_real_left_ino_renders_with_all_markers(self):
        with open(server.LEFT_INO_FILE, encoding="utf-8") as f:
            content = f.read()
        with open(server.LEFT_DEFAULT_CONFIG_FILE, encoding="utf-8") as f:
            cfg = json.load(f)
        server.validate_config(cfg, "L")
        out = server.render_ino_content(content, cfg, defaults_id=7, side="L")
        for marker in ("KEYMAP", "HOLDMAP", "DTAPMAP", "DEFAULTS_ID", "LAYER_NAMES", "COMBOS", "KEY_PAIRS", "SETTINGS"):
            self.assertEqual(out.count(f"// [[[START_{marker}]]]"), 1, marker)
        self.assertIn("#define KEYMAP_DEFAULTS_ID 7UL", out)
        self.assertIn('#define DEVICE_SIDE "L"', out)  # außerhalb der Marker, bleibt erhalten
        self.assertIn("'q'", out)

    def test_left_flash_writes_only_left_files(self):
        with tempfile.TemporaryDirectory() as d:
            paths = {name: os.path.join(d, name) for name in
                     ("current_config.json", "dactyl_right.ino", "current_config_left.json", "dactyl_left.ino")}
            with open(server.LEFT_INO_FILE, encoding="utf-8") as f:
                left_ino = f.read()
            with open(paths["dactyl_left.ino"], "w", encoding="utf-8") as f:
                f.write(left_ino)
            with open(paths["dactyl_right.ino"], "w", encoding="utf-8") as f:
                f.write("rechts unverändert")
            old = (server.CONFIG_FILE, server.INO_FILE, server.LEFT_CONFIG_FILE, server.LEFT_INO_FILE)
            server.CONFIG_FILE, server.INO_FILE = paths["current_config.json"], paths["dactyl_right.ino"]
            server.LEFT_CONFIG_FILE, server.LEFT_INO_FILE = paths["current_config_left.json"], paths["dactyl_left.ino"]
            try:
                server.save_config_and_firmware({"layers": [[[{"tap": "KEY_Z"}]]]}, "L")
                with open(paths["dactyl_left.ino"], encoding="utf-8") as f:
                    rendered = f.read()
                self.assertIn("'z'", rendered)
                self.assertNotIn("#define KEYMAP_DEFAULTS_ID 0UL", rendered)
                with open(paths["dactyl_right.ino"], encoding="utf-8") as f:
                    self.assertEqual(f.read(), "rechts unverändert")
                self.assertFalse(os.path.exists(paths["current_config.json"]))
                self.assertTrue(os.path.exists(paths["current_config_left.json"]))
            finally:
                server.CONFIG_FILE, server.INO_FILE, server.LEFT_CONFIG_FILE, server.LEFT_INO_FILE = old

    def test_build_app_script_copies_main_js_and_resigns(self):
        root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
        with open(os.path.join(root, "package.json"), encoding="utf-8") as f:
            pkg = json.load(f)
        self.assertEqual(pkg["main"], "main.js")
        self.assertEqual(pkg["scripts"]["build:app"], "bash scripts/build-app.sh")
        with open(os.path.join(root, "scripts", "build-app.sh"), encoding="utf-8") as f:
            script = f.read()
        self.assertIn("set -euo pipefail", script)
        self.assertIn('cp "$REPO_DIR/main.js" "$REPO_DIR/package.json" "$APP_DIR/"', script)
        self.assertIn('codesign --force --deep --sign - "$APP"', script)
        self.assertIn("pgrep", script)  # baut nicht in eine laufende App

    def test_rebuild_app_script_quits_builds_and_restarts(self):
        root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
        with open(os.path.join(root, "package.json"), encoding="utf-8") as f:
            pkg = json.load(f)
        self.assertEqual(pkg["scripts"]["rebuild:app"], "bash scripts/rebuild-app.sh")
        with open(os.path.join(root, "scripts", "rebuild-app.sh"), encoding="utf-8") as f:
            script = f.read()
        self.assertIn("set -euo pipefail", script)
        # Sauber beenden (before-quit stoppt server.py), nie per kill
        quit_at = script.index('to quit"')
        build_at = script.index('bash "$REPO_DIR/scripts/build-app.sh"')
        open_at = script.index('open -a "$APP"')
        self.assertLess(quit_at, build_at)
        self.assertLess(build_at, open_at)
        code = "\n".join(line for line in script.splitlines() if not line.lstrip().startswith("#"))
        self.assertNotRegex(code, r"\b(kill|pkill|killall)\b")
        # Erfolg erst mit neuer server.py-PID und HTTP 200
        self.assertIn('[ "$pid" != "$OLD_PID" ]', script)
        self.assertIn('-H "Host: localhost:$PORT"', script)

    def test_rebuild_app_script_paths_with_stubbed_commands(self):
        # Führt rebuild-app.sh mit Stub-Befehlen aus: Zustand (App läuft, Server-PID) liegt in Dateien
        root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
        with tempfile.TemporaryDirectory() as tmp:
            repo = os.path.join(tmp, "repo")
            os.makedirs(os.path.join(repo, "scripts"))
            shutil.copy(os.path.join(root, "scripts", "rebuild-app.sh"), os.path.join(repo, "scripts"))
            state = os.path.join(tmp, "state")
            os.makedirs(state)
            with open(os.path.join(repo, "scripts", "build-app.sh"), "w", encoding="utf-8") as f:
                f.write(f'echo build >> "{state}/log"\n[ ! -e "{state}/build_fails" ]\n')
            bin_dir = os.path.join(tmp, "bin")
            os.makedirs(bin_dir)
            stubs = {
                # Muster mitschreiben: pgrep -f bekommt einen Regex
                "pgrep": f'echo "$2" > "{state}/pattern"; [ -e "{state}/app" ]',
                "lsof": f'[ -e "{state}/pid" ] && cat "{state}/pid"; true',
                # Sauberes Beenden: App und ihr Server enden (außer quit_hangs); quit_denied = fehlende Berechtigung
                "osascript": f'[ -e "{state}/quit_denied" ] && exit 1; echo quit >> "{state}/log"; '
                             f'[ -e "{state}/quit_hangs" ] || rm -f "{state}/app" "{state}/pid"',
                "open": f'echo open >> "{state}/log"; touch "{state}/app"; echo 2222 > "{state}/pid"',
                "curl": "printf 200",
                "sleep": "true",
            }
            for name, body in stubs.items():
                path = os.path.join(bin_dir, name)
                with open(path, "w", encoding="utf-8") as f:
                    f.write(f"#!/bin/bash\n{body}\n")
                os.chmod(path, 0o755)
            app_path = os.path.join(tmp, "Dactyl.app")
            env = {**os.environ, "PATH": f"{bin_dir}:/usr/bin:/bin", "DACTYL_APP": app_path,
                   "DACTYL_QUIT_TIMEOUT": "1", "DACTYL_START_TIMEOUT": "1"}

            def run(*present, app=None):
                env["DACTYL_APP"] = app or app_path
                for name in ("app", "pid", "log", "quit_hangs", "quit_denied", "build_fails"):
                    p = os.path.join(state, name)
                    if os.path.exists(p):
                        os.remove(p)
                for name in present:
                    with open(os.path.join(state, name), "w", encoding="utf-8") as f:
                        f.write("1111\n" if name == "pid" else "")
                proc = subprocess.run(["bash", os.path.join(repo, "scripts", "rebuild-app.sh")], env=env,
                                      capture_output=True, text=True, timeout=30)
                log_path = os.path.join(state, "log")
                log = open(log_path, encoding="utf-8").read().split() if os.path.exists(log_path) else []
                return proc, log

            # App läuft: beenden, bauen, starten, neue PID
            proc, log = run("app", "pid")
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertEqual(log, ["quit", "build", "open"])
            self.assertIn("1111 -> 2222", proc.stdout)
            # pgrep erhält den Pfad als wörtlichen Regex ("." escaped)
            with open(os.path.join(state, "pattern"), encoding="utf-8") as f:
                pattern = f.read().strip()
            self.assertTrue(pattern.endswith("/Dactyl\\.app/Contents/MacOS/"), pattern)
            self.assertIsNotNone(re.fullmatch(pattern, app_path + "/Contents/MacOS/"))
            # App läuft nicht, Port frei: bauen und starten ohne Quit; ohne alte PID meldet es "keine"
            proc, log = run()
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertEqual(log, ["build", "open"])
            self.assertIn("keine -> 2222", proc.stdout)
            # Schrägstrich am Ende von DACTYL_APP: die laufende App wird trotzdem erkannt und beendet
            proc, log = run("app", "pid", app=app_path + "//")
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertEqual(log, ["quit", "build", "open"])
            with open(os.path.join(state, "pattern"), encoding="utf-8") as f:
                self.assertNotIn("//", f.read())
            # osascript scheitert (Automation-Berechtigung verweigert): Meldung mit App-Pfad, nichts bauen
            proc, log = run("app", "pid", "quit_denied")
            self.assertNotEqual(proc.returncode, 0)
            self.assertEqual(log, [])
            self.assertIn("osascript", proc.stderr)
            self.assertIn(app_path, proc.stderr)
            # Kein Worktree (kein .git): keine Warnung
            self.assertNotIn("Worktree", proc.stderr)
            # Fremder Server auf dem Port ohne App: nichts bauen, nichts starten
            proc, log = run("pid")
            self.assertNotEqual(proc.returncode, 0)
            self.assertEqual(log, [])
            self.assertIn("Port 8088", proc.stderr)
            # App lässt sich nicht beenden: nichts bauen
            proc, log = run("app", "pid", "quit_hangs")
            self.assertNotEqual(proc.returncode, 0)
            self.assertEqual(log, ["quit"])
            # Build scheitert: nicht starten
            proc, log = run("build_fails")
            self.assertNotEqual(proc.returncode, 0)
            self.assertEqual(log, ["build"])
            self.assertIn("rebuild:app", proc.stderr)
            # DACTYL_APP=/ ergibt nach dem Kürzen einen leeren Pfad: abbrechen, nichts beenden oder bauen
            proc, log = run("app", "pid", app="/")
            self.assertNotEqual(proc.returncode, 0)
            self.assertEqual(log, [])
            self.assertIn("DACTYL_APP", proc.stderr)
            # Aufruf aus einem Worktree (.git ist eine Datei): Warnung, der Ablauf läuft weiter
            with open(os.path.join(repo, ".git"), "w", encoding="utf-8") as f:
                f.write("gitdir: /tmp/elsewhere\n")
            proc, log = run()
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertIn("Worktree", proc.stderr)
            self.assertEqual(log, ["build", "open"])

    def test_left_user_config_is_not_versioned(self):
        root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
        with open(os.path.join(root, ".gitignore"), encoding="utf-8") as f:
            ignored = [line.strip() for line in f]
        self.assertIn("current_config_left.json", ignored)
        self.assertTrue(os.path.exists(os.path.join(root, "default_config_left.json")))


class TestServerHttp(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.old_cfg = (server.CONFIG_FILE, server.LEFT_CONFIG_FILE)
        server.CONFIG_FILE = os.path.join(cls.tmp.name, "current_config.json")
        server.LEFT_CONFIG_FILE = os.path.join(cls.tmp.name, "current_config_left.json")
        cls.httpd = socketserver.TCPServer(("127.0.0.1", 0), server.ConfiguratorHandler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        server.CONFIG_FILE, server.LEFT_CONFIG_FILE = cls.old_cfg
        cls.tmp.cleanup()

    def request(self, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        hdrs = {"Host": "localhost:8088"}
        hdrs.update(headers or {})
        conn.request(method, path, body=body, headers=hdrs)
        resp = conn.getresponse()
        data = resp.read()
        conn.close()
        return resp.status, data

    def test_get_rejects_foreign_host(self):
        status, _ = self.request("GET", "/api/config", headers={"Host": "evil.example:8088"})
        self.assertEqual(status, 403)

    def test_static_allowlist(self):
        self.assertEqual(self.request("GET", "/index.html")[0], 200)
        self.assertEqual(self.request("GET", "/app.js?v=30")[0], 200)
        self.assertEqual(self.request("GET", "/server.py")[0], 404)
        self.assertEqual(self.request("GET", "/.git/config")[0], 404)
        self.assertEqual(self.request("GET", "/firmware/dactyl_right/dactyl_right.ino")[0], 404)
        self.assertEqual(self.request("GET", "/js/side-profiles.js?v=1")[0], 200)
        self.assertEqual(self.request("GET", "/js/side-state.js")[0], 200)
        self.assertEqual(self.request("GET", "/js/side-routing.js")[0], 200)
        self.assertEqual(self.request("GET", "/js/")[0], 404)
        # Jedes Skript aus index.html muss ausgeliefert werden, sonst fehlt der App ein Modul
        with open(os.path.join(os.path.dirname(server.__file__), "index.html"), encoding="utf-8") as f:
            scripts = re.findall(r'<script src="([^"]+)"', f.read())
        self.assertGreater(len(scripts), 3)
        for src in scripts:
            self.assertEqual(self.request("GET", "/" + src)[0], 200, src)
        self.assertEqual(self.request("GET", "/js/../server.py")[0], 404)

    def test_config_per_side_roundtrip_and_invalid_side(self):
        origin = {"Origin": "http://localhost:8088"}
        left = {"layers": [[[{"tap": "KEY_Q"}]]]}
        right = {"layers": [[[{"tap": "KEY_P"}]]]}
        self.assertEqual(self.request("POST", "/api/config?side=L", body=json.dumps(left), headers=origin)[0], 200)
        self.assertEqual(self.request("POST", "/api/config?side=R", body=json.dumps(right), headers=origin)[0], 200)
        self.assertEqual(json.loads(self.request("GET", "/api/config?side=L")[1]), dict(left, source="user"))
        self.assertEqual(json.loads(self.request("GET", "/api/config?side=R")[1]), dict(right, source="user"))
        self.assertEqual(json.loads(self.request("GET", "/api/config")[1]), dict(right, source="user"))  # ohne side = rechts
        for method, path in (("GET", "/api/config?side=X"), ("POST", "/api/config?side=X"), ("POST", "/api/save_and_flash?side=X")):
            status, data = self.request(method, path, body=json.dumps(left) if method == "POST" else None, headers=origin)
            self.assertEqual(status, 400, path)
            self.assertFalse(json.loads(data)["success"])
        bad_left = {"layers": [[[], [], [], [], [], [{"tap": "KEY_A"}]]]}  # R5C0 existiert links nicht
        self.assertEqual(self.request("POST", "/api/config?side=L", body=json.dumps(bad_left), headers=origin)[0], 400)

    def test_post_rejects_foreign_origin_and_missing_host(self):
        body = json.dumps({"layers": [[]]})
        status, _ = self.request("POST", "/api/config", body=body, headers={"Origin": "http://evil.example"})
        self.assertEqual(status, 403)
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.putrequest("POST", "/api/config", skip_host=True)
        conn.putheader("Content-Length", str(len(body)))
        conn.endheaders(body.encode())
        self.assertEqual(conn.getresponse().status, 403)
        conn.close()

    def test_post_content_length_validation(self):
        status, _ = self.request("POST", "/api/config", body="{}", headers={"Content-Length": "abc"})
        self.assertEqual(status, 400)
        status, _ = self.request("POST", "/api/config", body="{}", headers={"Content-Length": str(server.MAX_BODY_BYTES + 1)})
        self.assertEqual(status, 413)

    def test_post_json_null_returns_400(self):
        for path in ("/api/config", "/api/save_and_flash"):
            status, data = self.request("POST", path, body="null", headers={"Origin": "http://localhost:8088"})
            self.assertEqual(status, 400, path)
            self.assertFalse(json.loads(data)["success"])

    def test_post_config_roundtrip_and_invalid(self):
        status, _ = self.request("POST", "/api/config", body=json.dumps({"layers": []}),
                                 headers={"Origin": "http://localhost:8088"})
        self.assertEqual(status, 400)
        cfg = {"layers": [[[{"tap": "KEY_A"}]]], "settings": {"debounceMs": 7}}
        status, _ = self.request("POST", "/api/config", body=json.dumps(cfg), headers={"Origin": "http://localhost:8088"})
        self.assertEqual(status, 200)
        status, data = self.request("GET", "/api/config")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(data), dict(cfg, source="user"))

    def test_post_config_does_not_persist_source_metadata(self):
        cfg = {"layers": [[[{"tap": "KEY_B"}]]], "source": "default"}
        status, _ = self.request("POST", "/api/config", body=json.dumps(cfg), headers={"Origin": "http://localhost:8088"})
        self.assertEqual(status, 200)
        with open(server.CONFIG_FILE, encoding="utf-8") as f:
            self.assertNotIn("source", json.load(f))
        self.assertEqual(json.loads(self.request("GET", "/api/config")[1])["source"], "user")

    def test_save_config_atomic_validation(self):
        # Must reject non-dict or missing layers
        with self.assertRaises(ValueError):
            server.save_config_atomic("invalid")
        with self.assertRaises(ValueError):
            server.save_config_atomic({})
        with self.assertRaises(ValueError):
            server.save_config_atomic({"layers": []})
        with self.assertRaises(ValueError):
            server.save_config_atomic({"layers": [[]] * 9})

if __name__ == "__main__":
    unittest.main()
