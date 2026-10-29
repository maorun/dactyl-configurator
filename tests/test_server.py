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
import time
from unittest import mock

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
        for marker in ("KEYMAP", "HOLDMAP", "DTAPMAP", "LAYER_NAMES", "COMBOS", "KEY_PAIRS", "MACROS", "SETTINGS"):
            self.assertEqual(out.count(f"// [[[START_{marker}]]]"), 1)
        out = server.render_ino_content(content, dict(cfg, keyPairs=[{"first": "KEY_LEFT_SHIFT", "second": "KEY_PERIOD"}]))
        self.assertIn("uint8_t numKeyPairs = 1;", out)
        out = server.render_ino_content(content, dict(cfg, macros=[{"name": "x", "steps": [{"type": "tap", "code": "KEY_A"}]}]))
        self.assertIn("uint8_t numMacros = 1;", out)
        self.assertIn("{ { 1, 'a', 0 } }", out)

    def test_macros_codegen_and_validation(self):
        cpp = server.generate_macros_cpp([
            {"name": "Copy", "steps": [
                {"type": "down", "code": "KEY_LEFT_GUI"}, {"type": "tap", "code": "KEY_C"},
                {"type": "up", "code": "KEY_LEFT_GUI"}, {"type": "pause", "ms": 100}]},
            {"name": "leer", "steps": []},
        ])
        self.assertIn("uint8_t numMacros = 2;", cpp)
        self.assertIn("uint8_t macroLengths[MAX_MACROS] = { 4, 0 };", cpp)
        self.assertIn("{ { 2, KEY_LEFT_GUI, 0 }, { 1, 'c', 0 }, { 3, KEY_LEFT_GUI, 0 }, { 4, 0, 100 } }", cpp)
        self.assertIn("{ { 0, 0, 0 } }", cpp)
        self.assertIn("uint8_t numMacros = 0;", server.generate_macros_cpp(None))
        self.assertIn("{ { 0, 0, 0 } }", server.generate_macros_cpp([]))
        bad_steps = [
            {"type": "tap", "code": "MO_1"}, {"type": "tap", "code": "MACRO_0"}, {"type": "tap", "code": "PAIR_0"},
            {"type": "tap", "code": "UMLAUT_AE"}, {"type": "tap"}, {"type": "down", "code": "KEY_256"},
            {"type": "pause", "ms": 0}, {"type": "pause", "ms": 5001}, {"type": "pause", "ms": "100"},
            {"type": "pause", "ms": True}, {"type": "pause"}, {"type": "click", "code": "KEY_A"}, "tap", None,
        ]
        for bad in bad_steps:
            with self.assertRaises(ValueError, msg=repr(bad)):
                server.generate_macros_cpp([{"steps": [bad]}])
        with self.assertRaises(ValueError):
            server.generate_macros_cpp([{"steps": [{"type": "tap", "code": "KEY_A"}] * 33}])
        server.generate_macros_cpp([{"steps": [{"type": "tap", "code": "KEY_A"}] * 32}])
        with self.assertRaises(ValueError):
            server.generate_macros_cpp([{"steps": []}] * 17)
        for bad in ("kaputt", [None], [{"steps": "x"}], [{}]):
            with self.assertRaises(ValueError, msg=repr(bad)):
                server.generate_macros_cpp(bad)
        with self.assertRaises(ValueError):
            server.validate_config({"layers": [[]], "macros": [{"steps": [{"type": "pause", "ms": 0}]}]})

    def test_macro_action_code_and_combo_rejection(self):
        self.assertEqual(server.code_to_cpp("MACRO_0"), "(ACT_MACRO_BASE + 0)")
        self.assertEqual(server.code_to_cpp("MACRO_15"), "(ACT_MACRO_BASE + 15)")
        self.assertEqual(server.code_to_cpp("MACRO_16"), "0")
        cpp = server.generate_keymap_cpp([[[{"tap": "MACRO_2"}]]])
        self.assertIn("(ACT_MACRO_BASE + 2)", cpp)
        self.assertIn("(ACT_MACRO_BASE + 4)", server.generate_holdmap_cpp([[[{"tap": "KEY_A", "hold": "MACRO_4"}]]]))
        self.assertIn("(ACT_MACRO_BASE + 5)", server.generate_dtapmap_cpp([[[{"tap": "KEY_A", "dtap": "MACRO_5"}]]]))
        # Combos unterstützen keine Makros (die Firmware lehnt ADD_COMBO mit Makro-Code ab)
        combo = {"key1": {"r": 2, "c": 1}, "key2": {"r": 2, "c": 2}, "behavior": "KEY_PRESS", "action": "MACRO_0"}
        with self.assertRaises(ValueError):
            server.generate_combos_cpp([combo])

    def test_modifier_hold_combo_rejects_one_shot_and_caps_word(self):
        # MODIFIER_HOLD hält nur Codes 1..255; One-Shot und Caps Word sendeten dort nichts (stille Fehlkonfiguration)
        for action in ("OSM_LSHIFT", "OSM_RGUI", "CAPS_WORD"):
            combo = {"key1": {"r": 2, "c": 1}, "key2": {"r": 2, "c": 2}, "behavior": "MODIFIER_HOLD", "action": action}
            with self.subTest(action=action), self.assertRaises(ValueError):
                server.generate_combos_cpp([combo])
            # Mit KEY_PRESS bleibt die Aktion erlaubt (One-Shot = tippen)
            self.assertIn("ACT_", server.generate_combos_cpp([{**combo, "behavior": "KEY_PRESS"}]))
        self.assertIn("KEY_LEFT_SHIFT", server.generate_combos_cpp([
            {"key1": {"r": 2, "c": 1}, "key2": {"r": 2, "c": 2}, "behavior": "MODIFIER_HOLD", "action": "KEY_LEFT_SHIFT"}]))

    def test_macro_constants_match_firmware(self):
        with open(os.path.join(os.path.dirname(server.INO_FILE), "DactylCommon.h"), encoding="utf-8") as f:
            common = f.read()
        def define(name):
            return int(re.search(rf"#define {name}\s+(0x[0-9A-Fa-f]+|\d+)", common).group(1), 0)
        self.assertEqual(define("MAX_MACROS"), server.MAX_MACROS)
        self.assertEqual(define("MAX_MACRO_STEPS"), server.MAX_MACRO_STEPS)
        self.assertEqual(define("MACRO_MAX_PAUSE_MS"), server.MACRO_MAX_PAUSE_MS)
        for name, value in server.MACRO_STEP_TYPES.items():
            self.assertEqual(define(f"MACRO_STEP_{name.upper()}"), value)

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

        def fake_run(cmd, timeout_s, on_line=None):
            calls.append(cmd)
            return 0, ""

        old = (server.find_arduino_cli, server.find_serial_port, server.query_device_side, server.run_cli)
        server.find_arduino_cli = lambda: "/opt/homebrew/bin/arduino-cli"
        server.find_serial_port = lambda side="R": "/dev/cu.usbserial-test"
        server.query_device_side = lambda port: "R"
        server.run_cli = fake_run
        try:
            server.flash_firmware()
        finally:
            server.find_arduino_cli, server.find_serial_port, server.query_device_side, server.run_cli = old
        self.assertEqual([c[1] for c in calls], ["compile", "upload"])
        for cmd in calls:
            self.assertEqual(cmd[cmd.index("--fqbn") + 1], "esp32:esp32:lolin32-lite:PartitionScheme=min_spiffs")

    def run_flash(self, side, port_for, side_before_upload=None, cli_lines=None, cli_code=0, on_output=None):
        """Führt flash_firmware(side) mit gefälschtem arduino-cli aus; port_for(side) ersetzt die Port-Erkennung.
        side_before_upload: Antwort der Nachprüfung vor dem Upload (Standard: die angefragte Hälfte).
        cli_lines(cmd): Ausgabezeilen des gefälschten Aufrufs; cli_code: sein Exit-Code."""
        calls = []
        probes = []

        def fake_run(cmd, timeout_s, on_line=None):
            calls.append(cmd)
            lines = cli_lines(cmd) if cli_lines else []
            for line in lines:
                if on_line:
                    on_line(line)
            return cli_code, "\n".join(lines)

        def fake_query(port):
            probes.append((port, len(calls)))
            return side if side_before_upload is None else side_before_upload

        old = (server.find_arduino_cli, server.find_serial_port, server.query_device_side, server.run_cli)
        server.find_arduino_cli = lambda: "/opt/homebrew/bin/arduino-cli"
        server.find_serial_port = port_for
        server.query_device_side = fake_query
        server.run_cli = fake_run
        try:
            result = server.flash_firmware(side, on_output=on_output)
        finally:
            server.find_arduino_cli, server.find_serial_port, server.query_device_side, server.run_cli = old
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

    def test_flash_reports_each_cli_line_with_its_stage(self):
        events = []
        result, calls = self.run_flash("R", lambda s: "/dev/cu.usbserial-a",
                                       cli_lines=lambda cmd: [f"{cmd[1]} 1", f"{cmd[1]} 2"],
                                       on_output=lambda stage, line: events.append((stage, line)))
        self.assertTrue(result["success"])
        cli_events = [e for e in events if e[1].startswith(("compile ", "upload "))]
        self.assertEqual(cli_events, [("compile", "compile 1"), ("compile", "compile 2"),
                                      ("upload", "upload 1"), ("upload", "upload 2")])
        # Statuszeilen vor jeder Phase: Port-Suche, Kompilieren, Port-Prüfung, Upload
        self.assertEqual([e[0] for e in events if e not in cli_events], ["port", "compile", "port", "upload"])

    def test_flash_error_keeps_only_the_tail_of_the_output(self):
        long_lines = [f"zeile {i:05d}" for i in range(2000)]
        result, calls = self.run_flash("R", lambda s: "/dev/cu.usbserial-a", cli_lines=lambda cmd: long_lines, cli_code=1)
        self.assertFalse(result["success"])
        self.assertEqual(result["stage"], "compile")
        self.assertEqual(len(result["error"]), server.FLASH_ERROR_TAIL_CHARS)
        self.assertTrue(result["error"].endswith("zeile 01999"))
        self.assertEqual([c[1] for c in calls], ["compile"])

    def test_run_cli_streams_lines_and_splits_carriage_returns(self):
        lines = []
        script = "import sys,time\nprint('a', flush=True)\nsys.stderr.write('b\\r\\nc\\rd')\nsys.stderr.flush()\nsys.exit(3)"
        code, output = server.run_cli([sys.executable, "-c", script], 10, lines.append)
        self.assertEqual(code, 3)
        self.assertEqual(lines, ["a", "b", "c", "d"])   # stderr zählt mit, \r trennt Fortschrittszeilen
        self.assertEqual(output, "a\nb\nc\nd")

    def test_run_cli_reports_lines_before_the_process_ends(self):
        seen_at = []
        script = "import time\nprint('erste', flush=True)\ntime.sleep(1.0)\nprint('zweite', flush=True)"
        start = time.monotonic()
        server.run_cli([sys.executable, "-c", script], 10, lambda line: seen_at.append((line, time.monotonic() - start)))
        self.assertEqual([l for l, _ in seen_at], ["erste", "zweite"])
        self.assertLess(seen_at[0][1], 0.8)    # live, nicht erst am Ende

    def test_run_cli_kills_the_process_group_on_timeout(self):
        # Wie arduino-cli -> esptool: ein Kindprozess hält die Pipe offen und muss mit beendet werden
        script = ("import subprocess,sys,time\n"
                  "c = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(30)'])\n"
                  "print(c.pid, flush=True)\n"
                  "time.sleep(30)")
        lines = []
        start = time.monotonic()
        with self.assertRaises(subprocess.TimeoutExpired):
            server.run_cli([sys.executable, "-c", script], 1.5, lines.append)
        self.assertLess(time.monotonic() - start, 10)
        child = int(lines[0])
        deadline = time.monotonic() + 5
        alive = True
        while alive and time.monotonic() < deadline:
            try:
                os.kill(child, 0)
                time.sleep(0.05)
            except ProcessLookupError:
                alive = False
        self.assertFalse(alive, "Kindprozess läuft nach dem Timeout weiter")

    def test_strip_terminal_controls(self):
        # Ausgabe von esptool beim echten Flash (2026-10-28)
        self.assertEqual(server.strip_terminal_controls("\x1b[1A\x1b[2KHash of data verified."), "Hash of data verified.")
        self.assertEqual(server.strip_terminal_controls("\x1b[KWriting at 0x00010000 [===]  100.0%"),
                         "Writing at 0x00010000 [===]  100.0%")
        self.assertEqual(server.strip_terminal_controls("\x1b[1;32mOK\x1b[0m"), "OK")
        self.assertEqual(server.strip_terminal_controls("\x1b]0;Titel\x07Text"), "Text")
        self.assertEqual(server.strip_terminal_controls("a\x08b\x00c\x1b"), "abc")
        self.assertEqual(server.strip_terminal_controls("Tab\tbleibt, Ümlaut auch [1A ohne ESC"), "Tab\tbleibt, Ümlaut auch [1A ohne ESC")
        # OSC mit ESC-Backslash als Abschluss, unvollständiges CSI am Zeilenende
        self.assertEqual(server.strip_terminal_controls("\x1b]0;T\x1b\\X"), "X")
        self.assertEqual(server.strip_terminal_controls("a\x1b["), "a[")
        # 8-Bit-CSI (U+009B) und andere C1-Zeichen, ohne Umlaute (U+00C4 ...) zu treffen
        self.assertEqual(server.strip_terminal_controls("\u009b2KÄ\u0085ö"), "2KÄö")
        # Ein einzelnes ESC verschluckt das Folgezeichen nicht
        self.assertEqual(server.strip_terminal_controls("\x1bAbc"), "Abc")

    def test_run_cli_removes_terminal_controls_from_lines(self):
        lines = []
        # Die Folge ESC[2K und der Umlaut kommen in zwei getrennten, geleerten Teilen (Chunk-Grenze mitten im Zeichen)
        script = ("import sys,time\nw = sys.stdout.buffer\n"
                  "w.write(b'\\x1b[1A\\x1b[2KHash of data verified.\\n\\x1b[2K\\n\\x1b[KSch\\xc3'); w.flush(); time.sleep(0.3)\n"
                  "w.write(b'\\xb6n 100%\\r'); w.flush()")
        code, output = server.run_cli([sys.executable, "-c", script], 10, lines.append)
        self.assertEqual(lines, ["Hash of data verified.", "Schön 100%"])   # reine Steuerzeile entfällt
        self.assertEqual(output, "Hash of data verified.\nSchön 100%")

    def test_run_cli_skips_empty_lines_from_split_crlf(self):
        lines = []
        script = "import sys,time\nsys.stdout.write('a\\r'); sys.stdout.flush(); time.sleep(0.3)\nsys.stdout.write('\\nb\\n')"
        code, output = server.run_cli([sys.executable, "-c", script], 10, lines.append)
        self.assertEqual(lines, ["a", "b"])
        self.assertEqual(output, "a\nb")

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
        for marker in ("KEYMAP", "HOLDMAP", "DTAPMAP", "DEFAULTS_ID", "LAYER_NAMES", "COMBOS", "KEY_PAIRS", "MACROS", "SETTINGS"):
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

    def test_generate_split_key_writes_private_header_once(self):
        root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
        script = os.path.join(root, "scripts", "generate-split-key.sh")
        with tempfile.TemporaryDirectory() as tmp:
            key = os.path.join(tmp, "DactylSplitKey.h")
            env = {**os.environ, "DACTYL_SPLIT_KEY_FILE": key}

            def run(*args):
                return subprocess.run(["bash", script, *args], env=env, capture_output=True, text=True, timeout=30)

            proc = run()
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertEqual(os.stat(key).st_mode & 0o777, 0o600)
            with open(key, encoding="utf-8") as f:
                header = f.read()
            self.assertIn("#define DACTYL_SPLIT_KEY_PRESENT 1", header)
            keys = {}
            for name in ("SPLIT_ESPNOW_PMK", "SPLIT_ESPNOW_LMK"):
                m = re.search(r"static const uint8_t " + name + r"\[16\] = \{([^}]*)\};", header)
                self.assertIsNotNone(m, name)
                values = [v.strip() for v in m.group(1).split(",")]
                self.assertEqual(len(values), 16, name)
                self.assertTrue(all(re.fullmatch(r"0x[0-9a-f]{2}", v) for v in values), name)
                keys[name] = values
            self.assertNotEqual(keys["SPLIT_ESPNOW_PMK"], keys["SPLIT_ESPNOW_LMK"])
            # Keine Schlüsselwerte in der Ausgabe
            for values in keys.values():
                self.assertNotIn(values[0] + ", " + values[1], proc.stdout + proc.stderr)
            # Ein vorhandener Schlüssel bleibt ohne --force unverändert (sonst verstehen sich die Hälften nicht mehr)
            proc = run()
            self.assertNotEqual(proc.returncode, 0)
            with open(key, encoding="utf-8") as f:
                self.assertEqual(f.read(), header)
            # --if-missing (npm run build:app / rebuild:app) behält den Schlüssel und endet ohne Fehler
            proc = run("--if-missing")
            self.assertEqual(proc.returncode, 0, proc.stderr)
            with open(key, encoding="utf-8") as f:
                self.assertEqual(f.read(), header)
            proc = run("--force")
            self.assertEqual(proc.returncode, 0, proc.stderr)
            with open(key, encoding="utf-8") as f:
                self.assertNotEqual(f.read(), header)
            self.assertEqual(sorted(os.listdir(tmp)), ["DactylSplitKey.h"])
            # Ohne Schlüssel erzeugt --if-missing einen neuen
            os.remove(key)
            proc = run("--if-missing")
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertEqual(os.stat(key).st_mode & 0o777, 0o600)
            with open(key, encoding="utf-8") as f:
                header = f.read()
            # Zu weite Rechte: --if-missing setzt 0600 und lässt den Inhalt unverändert
            os.chmod(key, 0o644)
            proc = run("--if-missing")
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertEqual(os.stat(key).st_mode & 0o777, 0o600)
            with open(key, encoding="utf-8") as f:
                self.assertEqual(f.read(), header)
            # Beschädigte Datei (leer, ein Byte zu wenig): Abbruch statt eines Pakets mit kaputtem Schlüssel
            for broken in ("", header.rsplit(", ", 1)[0] + "};\n"):
                with open(key, "w", encoding="utf-8") as f:
                    f.write(broken)
                proc = run("--if-missing")
                self.assertEqual(proc.returncode, 1, broken[:40])
                self.assertIn("beschädigt", proc.stderr)
                with open(key, encoding="utf-8") as f:
                    self.assertEqual(f.read(), broken)
            # Unbekanntes Argument (Tippfehler) und zu viele Argumente: Aufrufhinweis, Datei unverändert
            for args in (("--if-mising",), ("--force", "--if-missing")):
                proc = run(*args)
                self.assertEqual(proc.returncode, 2, args)
                self.assertIn("Aufruf:", proc.stderr)
                with open(key, encoding="utf-8") as f:
                    self.assertEqual(f.read(), broken)

    def test_build_app_script_bundles_server_ui_and_firmware(self):
        root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
        with open(os.path.join(root, "package.json"), encoding="utf-8") as f:
            pkg = json.load(f)
        self.assertEqual(pkg["main"], "main.js")
        # Der ESP-NOW-Schlüssel entsteht vor dem Bau, sonst kompiliert "Auf Dactyl flashen" in der App nicht
        self.assertEqual(pkg["scripts"]["build:app"],
                         "bash scripts/generate-split-key.sh --if-missing && bash scripts/build-app.sh")
        with tempfile.TemporaryDirectory() as tmp:
            # Repository-Kopie mit einer Nutzer-Config, Electron-Paket mit einer veralteten Datei
            repo = os.path.join(tmp, "repo")
            os.makedirs(os.path.join(repo, "scripts"))
            shutil.copy(os.path.join(root, "scripts", "build-app.sh"), os.path.join(repo, "scripts"))
            for name in ("main.js", "package.json", "server.py", "index.html", "app.js", "style.css",
                         "default_config.json", "default_config_left.json"):
                shutil.copy(os.path.join(root, name), repo)
            shutil.copytree(os.path.join(root, "js"), os.path.join(repo, "js"))
            for name in ("dactyl_right", "dactyl_left"):
                shutil.copytree(os.path.join(root, "firmware", name), os.path.join(repo, "firmware", name))
            with open(os.path.join(repo, "current_config.json"), "w", encoding="utf-8") as f:
                f.write('{"layers": "repo"}')
            # Testschlüssel mit zu weiten Rechten: das Paket bekommt ihn nur für den Nutzer lesbar (0600)
            repo_key = os.path.join(repo, "firmware", "dactyl_right", "DactylSplitKey.h")
            with open(repo_key, "w", encoding="utf-8") as f:
                f.write("#define DACTYL_SPLIT_KEY_PRESENT 1\n")
            os.chmod(repo_key, 0o644)
            # Rest eines abgebrochenen generate-split-key.sh: kommt nie ins Paket
            with open(repo_key + ".AbC123", "w", encoding="utf-8") as f:
                f.write("rest")
            app_path = os.path.join(tmp, "Dactyl.app")
            os.makedirs(os.path.join(app_path, "Contents", "Frameworks", "Electron Framework.framework"))
            app_dir = os.path.join(app_path, "Contents", "Resources", "app")
            os.makedirs(app_dir)
            with open(os.path.join(app_dir, "veraltet.js"), "w", encoding="utf-8") as f:
                f.write("alt")
            data_dir = os.path.join(tmp, "data")
            bin_dir = os.path.join(tmp, "bin")
            os.makedirs(bin_dir)

            def stub(name, body):
                path = os.path.join(bin_dir, name)
                with open(path, "w", encoding="utf-8") as f:
                    f.write(f"#!/bin/bash\n{body}\n")
                os.chmod(path, 0o755)

            stub("pgrep", "exit 1")
            stub("codesign", f'echo "$@" >> "{tmp}/codesign"')
            env = {**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}", "DACTYL_APP": app_path,
                   "DACTYL_DATA_DIR": data_dir}

            def build():
                return subprocess.run(["bash", os.path.join(repo, "scripts", "build-app.sh")], env=env,
                                      capture_output=True, text=True, timeout=60)

            proc = build()
            self.assertEqual(proc.returncode, 0, proc.stderr)
            for rel in ("main.js", "package.json", "server.py", "index.html", "app.js", "style.css",
                        "default_config.json", "default_config_left.json", "js/side-profiles.js",
                        "js/config-sync.js", "firmware/dactyl_right/dactyl_right.ino",
                        "firmware/dactyl_right/DactylLogic.h", "firmware/dactyl_left/dactyl_left.ino"):
                self.assertTrue(os.path.isfile(os.path.join(app_dir, rel)), rel)
            bundle_key = os.path.join(app_dir, "firmware", "dactyl_right", "DactylSplitKey.h")
            self.assertEqual(os.stat(bundle_key).st_mode & 0o777, 0o600)
            self.assertEqual(sorted(n for n in os.listdir(os.path.dirname(bundle_key)) if n.startswith("DactylSplitKey")),
                             ["DactylSplitKey.h"])
            self.assertNotIn("Kein ESP-NOW-Schlüssel", proc.stderr)
            # Kein Laufzeitzustand und keine Altlasten im signierten Paket
            self.assertFalse(os.path.exists(os.path.join(app_dir, "current_config.json")))
            self.assertFalse(os.path.exists(os.path.join(app_dir, "veraltet.js")))
            self.assertFalse(os.path.exists(app_dir + ".new"))
            with open(os.path.join(tmp, "codesign"), encoding="utf-8") as f:
                self.assertIn(f"--force --deep --sign - {app_path}", f.read())
            # Nutzer-Config wird einmalig übernommen, eine vorhandene nie überschrieben
            with open(os.path.join(data_dir, "current_config.json"), encoding="utf-8") as f:
                self.assertEqual(f.read(), '{"layers": "repo"}')
            self.assertFalse(os.path.exists(os.path.join(data_dir, "current_config_left.json")))
            with open(os.path.join(data_dir, "current_config.json"), "w", encoding="utf-8") as f:
                f.write('{"layers": "app"}')
            proc = build()
            self.assertEqual(proc.returncode, 0, proc.stderr)
            with open(os.path.join(data_dir, "current_config.json"), encoding="utf-8") as f:
                self.assertEqual(f.read(), '{"layers": "app"}')
            # Ohne Schlüssel baut das Paket weiter, warnt aber: "Auf Dactyl flashen" bricht dann ab
            os.remove(repo_key)
            proc = build()
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertIn("Kein ESP-NOW-Schlüssel", proc.stderr)
            self.assertFalse(os.path.exists(bundle_key))
            # Das Backup liegt neben dem Paket, nicht darin: codesign versiegelt es sonst mit
            backup = os.path.join(tmp, ".Dactyl.app.app-dir.old")
            # Ein früherer Lauf wurde nach dem Verschieben ins Backup hart beendet: der nächste Lauf stellt es wieder her
            os.rename(app_dir, backup)
            proc = build()
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertIn("Abgebrochener Lauf erkannt", proc.stderr)
            self.assertTrue(os.path.isfile(os.path.join(app_dir, "main.js")))
            self.assertFalse(os.path.exists(backup))
            # Lauf nach dem Einsetzen der neuen App vor der Signaturprüfung beendet: Backup und App-Verzeichnis
            # existieren beide. Ist das Paket nicht gültig signiert, bleibt das Backup die gültige App.
            shutil.copytree(app_dir, backup)
            with open(os.path.join(backup, "marker.txt"), "w", encoding="utf-8") as f:
                f.write("gueltig-alt")
            with open(os.path.join(app_dir, "marker.txt"), "w", encoding="utf-8") as f:
                f.write("kaputt-neu")
            stub("codesign", 'if [ "$1" = "--verify" ]; then exit 1; fi')
            proc = build()
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("Abgebrochener Lauf erkannt", proc.stderr)
            with open(os.path.join(app_dir, "marker.txt"), encoding="utf-8") as f:
                self.assertEqual(f.read(), "gueltig-alt")
            self.assertFalse(os.path.exists(backup))
            # Ist das vorhandene Paket gültig signiert, wird das Backup nur gelöscht
            shutil.copytree(app_dir, backup)
            stub("codesign", "exit 0")
            proc = build()
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertNotIn("Abgebrochener Lauf erkannt", proc.stderr)
            self.assertFalse(os.path.exists(backup))
            # Während codesign läuft, liegt kein Backup im Paket (sein späteres Löschen bräche die Signatur)
            stub("codesign", 'if [ "$1" = "--force" ]; then find "' + app_path + '" -name "*.old" >> "' + tmp + '/inside"; fi; exit 0')
            proc = build()
            self.assertEqual(proc.returncode, 0, proc.stderr)
            with open(os.path.join(tmp, "inside"), encoding="utf-8") as f:
                self.assertEqual(f.read().strip(), "")
            # SIGTERM während des Signierens: die vorherige App kommt zurück
            with open(os.path.join(app_dir, "marker.txt"), "w", encoding="utf-8") as f:
                f.write("vorher")
            stub("codesign", 'if [ "$1" = "--force" ] && [ ! -f "' + tmp + '/sigterm-done" ]; then '
                             'touch "' + tmp + '/sigterm-done"; kill -TERM $PPID; fi; exit 0')
            proc = build()
            self.assertEqual(proc.returncode, 143, proc.stderr)
            with open(os.path.join(app_dir, "marker.txt"), encoding="utf-8") as f:
                self.assertEqual(f.read(), "vorher")
            self.assertFalse(os.path.exists(backup))
            # Signaturprüfung scheitert: die vorherige App bleibt vollständig, kein .old oder .new bleibt liegen
            with open(os.path.join(app_dir, "marker.txt"), "w", encoding="utf-8") as f:
                f.write("vorher")
            stub("codesign", 'if [ "$1" = "--verify" ]; then exit 1; fi')
            proc = build()
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("wiederhergestellt", proc.stderr)
            # Scheitert auch die Prüfung der wiederhergestellten App, bleibt das nicht stumm
            self.assertIn("WARNUNG", proc.stderr)
            with open(os.path.join(app_dir, "marker.txt"), encoding="utf-8") as f:
                self.assertEqual(f.read(), "vorher")
            self.assertFalse(os.path.exists(backup))
            self.assertFalse(os.path.exists(app_dir + ".new"))
            stub("codesign", "exit 0")
            # Läuft die App, baut das Skript nicht
            stub("pgrep", "exit 0")
            proc = build()
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("läuft noch", proc.stderr)

    def test_sync_firmware_sources_rolls_back_both_sketches(self):
        # Scheitert das Einsetzen des zweiten Sketches, kommen beide alten Sketches zurück
        with tempfile.TemporaryDirectory() as tmp:
            source = os.path.join(tmp, "bundle")
            data = os.path.join(tmp, "data")
            for name in server.FIRMWARE_SKETCHES:
                os.makedirs(os.path.join(source, name))
                with open(os.path.join(source, name, "Neu.h"), "w", encoding="utf-8") as f:
                    f.write("neu")
                os.makedirs(os.path.join(data, name))
                with open(os.path.join(data, name, "Alt.h"), "w", encoding="utf-8") as f:
                    f.write("alt")
            old = (server.SOURCE_FIRMWARE_DIR, server.FIRMWARE_DIR, server.SEPARATE_FIRMWARE)
            real_replace = os.replace
            calls = []

            def failing_replace(src, dst):
                calls.append(dst)
                # Der vierte Aufruf setzt den zweiten neuen Sketch ein
                if len(calls) == 4:
                    raise OSError("Platte voll")
                return real_replace(src, dst)

            server.SOURCE_FIRMWARE_DIR, server.FIRMWARE_DIR, server.SEPARATE_FIRMWARE = source, data, True
            try:
                with mock.patch.object(server.os, "replace", failing_replace):
                    with self.assertRaises(OSError):
                        server.sync_firmware_sources()
            finally:
                server.SOURCE_FIRMWARE_DIR, server.FIRMWARE_DIR, server.SEPARATE_FIRMWARE = old
            for name in server.FIRMWARE_SKETCHES:
                self.assertEqual(sorted(os.listdir(os.path.join(data, name))), ["Alt.h"], name)
            self.assertEqual(sorted(os.listdir(data)), sorted(server.FIRMWARE_SKETCHES))

    def test_sync_firmware_sources_keeps_private_split_key(self):
        # "Auf Dactyl flashen" kompiliert im Datenverzeichnis: der ESP-NOW-Schlüssel muss dort ankommen, mit 0600
        with tempfile.TemporaryDirectory() as tmp:
            source = os.path.join(tmp, "bundle")
            data = os.path.join(tmp, "data")
            for name in server.FIRMWARE_SKETCHES:
                os.makedirs(os.path.join(source, name))
                with open(os.path.join(source, name, f"{name}.ino"), "w", encoding="utf-8") as f:
                    f.write(name)
            key = os.path.join(source, "dactyl_right", "DactylSplitKey.h")
            with open(key, "w", encoding="utf-8") as f:
                f.write("#define DACTYL_SPLIT_KEY_PRESENT 1\n")
            os.chmod(key, 0o600)
            old = (server.SOURCE_FIRMWARE_DIR, server.FIRMWARE_DIR, server.SEPARATE_FIRMWARE)
            server.SOURCE_FIRMWARE_DIR, server.FIRMWARE_DIR, server.SEPARATE_FIRMWARE = source, data, True
            try:
                server.sync_firmware_sources()
            finally:
                server.SOURCE_FIRMWARE_DIR, server.FIRMWARE_DIR, server.SEPARATE_FIRMWARE = old
            copied = os.path.join(data, "dactyl_right", "DactylSplitKey.h")
            with open(copied, encoding="utf-8") as f:
                self.assertEqual(f.read(), "#define DACTYL_SPLIT_KEY_PRESENT 1\n")
            self.assertEqual(os.stat(copied).st_mode & 0o777, 0o600)

    def test_sync_firmware_sources_handles_readonly_dirs_orphans_and_missing_ino(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = os.path.join(tmp, "bundle")
            data = os.path.join(tmp, "data")
            for name in server.FIRMWARE_SKETCHES:
                os.makedirs(os.path.join(source, name, "sub"))
                for rel in ("Neu.h", f"{name}.ino", "sub/x.h", f"sub/{name}.ino"):
                    with open(os.path.join(source, name, rel), "w", encoding="utf-8") as f:
                        f.write(rel)
            # Gerenderte rechte .ino im Datenverzeichnis, links noch keine; ein Rest eines abgebrochenen Laufs
            os.makedirs(os.path.join(data, "dactyl_right", "alt"))
            with open(os.path.join(data, "dactyl_right", "dactyl_right.ino"), "w", encoding="utf-8") as f:
                f.write("gerendert")
            os.makedirs(os.path.join(data, ".dactyl_left.abc.new", "sub"))
            os.makedirs(os.path.join(data, ".fremd.old"))
            # Kopien älterer App-Versionen haben schreibgeschützte Verzeichnisse (0555)
            for d in (os.path.join(data, "dactyl_right", "alt"), os.path.join(data, ".dactyl_left.abc.new", "sub"),
                      os.path.join(data, ".dactyl_left.abc.new")):
                os.chmod(d, 0o555)
            # Signiertes Paket: Dateien und Verzeichnisse schreibgeschützt
            for dirpath, dirs, files in os.walk(source, topdown=False):
                for f in files:
                    os.chmod(os.path.join(dirpath, f), 0o444)
                os.chmod(dirpath, 0o555)
            old = (server.SOURCE_FIRMWARE_DIR, server.FIRMWARE_DIR, server.SEPARATE_FIRMWARE)
            server.SOURCE_FIRMWARE_DIR, server.FIRMWARE_DIR, server.SEPARATE_FIRMWARE = source, data, True
            try:
                server.sync_firmware_sources()
                server.sync_firmware_sources()   # zweiter Lauf ersetzt die kopierten Verzeichnisse
            finally:
                server.SOURCE_FIRMWARE_DIR, server.FIRMWARE_DIR, server.SEPARATE_FIRMWARE = old
                for dirpath, _, _ in os.walk(source):
                    os.chmod(dirpath, 0o755)
            with open(os.path.join(data, "dactyl_right", "dactyl_right.ino"), encoding="utf-8") as f:
                self.assertEqual(f.read(), "gerendert")
            with open(os.path.join(data, "dactyl_left", "dactyl_left.ino"), encoding="utf-8") as f:
                self.assertEqual(f.read(), "dactyl_left.ino")    # Vorlage, weil noch nichts gerendert ist
            self.assertTrue(os.path.isfile(os.path.join(data, "dactyl_left", "sub", "x.h")))
            # Nur die .ino im Wurzelverzeichnis wird ausgelassen, eine gleichnamige Datei in einem Unterordner nicht
            self.assertTrue(os.path.isfile(os.path.join(data, "dactyl_left", "sub", "dactyl_left.ino")))
            # Nur Reste der eigenen Sketches werden entfernt, auch schreibgeschützte
            self.assertEqual(sorted(os.listdir(data)), [".fremd.old", "dactyl_left", "dactyl_right"])
            self.assertFalse(os.path.exists(os.path.join(data, "dactyl_right", "alt")))

    def test_migrate_config_converts_modifier_hold_one_shot_combos(self):
        cb = {"key1": {"r": 2, "c": 1}, "key2": {"r": 2, "c": 2}, "behavior": "MODIFIER_HOLD", "action": "OSM_LSHIFT"}
        keep = {**cb, "action": "KEY_LEFT_SHIFT"}
        cfg = {"layers": [[[{"tap": "KEY_A"}]]], "combos": [cb, keep]}
        migrated = server.migrate_config(cfg)
        self.assertEqual([c["behavior"] for c in migrated["combos"]], ["KEY_PRESS", "MODIFIER_HOLD"])
        self.assertEqual(cfg["combos"][0]["behavior"], "MODIFIER_HOLD")     # nicht in-place
        server.validate_config(migrated)
        self.assertEqual(server.migrate_config({"layers": []}), {"layers": []})
        # Firmware-Namen (ACT_OSM_*, ACT_CAPS_WORD) gelten wie die App-Namen
        for action in ("ACT_OSM_LSHIFT", "ACT_CAPS_WORD"):
            raw = {**cb, "action": action}
            with self.subTest(action=action):
                with self.assertRaises(ValueError):
                    server.generate_combos_cpp([raw])
                self.assertEqual(server.migrate_config({"layers": [], "combos": [raw]})["combos"][0]["behavior"], "KEY_PRESS")
        self.assertIsNone(server.migrate_config(None))
        # Gespeicherte Config und Profil mit der alten Form bleiben ladbar
        with tempfile.TemporaryDirectory() as tmp:
            old = (server.CONFIG_FILE, server.PROFILES_FILE)
            server.CONFIG_FILE = os.path.join(tmp, "c.json")
            server.PROFILES_FILE = os.path.join(tmp, "p.json")
            try:
                with open(server.CONFIG_FILE, "w", encoding="utf-8") as f:
                    json.dump(cfg, f)
                with open(server.PROFILES_FILE, "w", encoding="utf-8") as f:
                    json.dump({"profiles": [{"name": "Alt", "savedAt": "", "config": cfg}]}, f)
                self.assertEqual(server.load_config_for_app("R")["combos"][0]["behavior"], "KEY_PRESS")
                loaded = server.load_profiles("R")
                self.assertEqual(loaded["skipped"], [])
                self.assertEqual(loaded["profiles"][0]["config"]["combos"][0]["behavior"], "KEY_PRESS")
                # Speichern mit der alten Form: abgelehnt wie bei /api/config, nicht still umgewandelt
                with self.assertRaises(ValueError):
                    server.save_profiles_atomic({"revision": 0, "profiles": [{"name": "Neu", "savedAt": "", "config": cfg}]})
                with self.assertRaises(ValueError):
                    server.save_config_atomic(cfg)
            finally:
                server.CONFIG_FILE, server.PROFILES_FILE = old

    def test_main_js_starts_bundled_server_with_data_dir(self):
        root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
        with open(os.path.join(root, "main.js"), encoding="utf-8") as f:
            main_js = f.read()
        # Kein fest eingetragener Checkout-Pfad: server.py liegt im Paket neben main.js
        self.assertNotIn("/Users/", main_js)
        self.assertNotIn("REPO_DIR", main_js)
        self.assertIn("const SERVER_DIR = __dirname;", main_js)
        self.assertIn("path.join(SERVER_DIR, 'server.py')", main_js)
        self.assertIn("DACTYL_DATA_DIR: DATA_DIR", main_js)
        # build-app.sh nutzt denselben Datenpfad wie main.js (userData = Name aus package.json)
        with open(os.path.join(root, "package.json"), encoding="utf-8") as f:
            name = json.load(f)["name"]
        self.assertIn("path.join(app.getPath('userData'), 'data')", main_js)
        with open(os.path.join(root, "scripts", "build-app.sh"), encoding="utf-8") as f:
            self.assertIn(f"$HOME/Library/Application Support/{name}/data", f.read())

    def test_data_dir_keeps_bundle_unchanged_and_flashes_a_copy(self):
        # server.py mit DACTYL_DATA_DIR wie in der App: Configs und gerenderte .ino nur im Datenverzeichnis
        root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
        with tempfile.TemporaryDirectory() as tmp:
            bundle = os.path.join(tmp, "bundle")
            os.makedirs(bundle)
            for name in ("server.py", "default_config.json", "default_config_left.json"):
                shutil.copy(os.path.join(root, name), bundle)
            for name in ("dactyl_right", "dactyl_left"):
                shutil.copytree(os.path.join(root, "firmware", name), os.path.join(bundle, "firmware", name))
            data = os.path.join(tmp, "data")
            # Das Paket ist signiert und schreibgeschützt: Kopien im Datenverzeichnis müssen trotzdem ersetzbar sein
            for dirpath, _, files in os.walk(os.path.join(bundle, "firmware")):
                for name in files:
                    os.chmod(os.path.join(dirpath, name), 0o444)
            stale = os.path.join(data, "firmware", "dactyl_right", "Veraltet.h")
            script = "\n".join([
                "import json, os, sys",
                f"sys.path.insert(0, {bundle!r})",
                "import server",
                "server.save_config_and_firmware({'layers': [[[{'tap': 'KEY_Z'}]]]}, 'L')",
                # Eine ältere App-Version hat eine Datei hinterlassen, die das Paket nicht mehr enthält
                f"open({stale!r}, 'w').write('alt')",
                "server.save_config_and_firmware({'layers': [[[{'tap': 'KEY_Y'}]]]}, 'R')",
                "server.save_config_atomic({'layers': [[[{'tap': 'KEY_Q'}]]]}, 'R')",
                "print(json.dumps({'sketch': server.side_paths('L')['sketch'],"
                " 'user': server.load_config_for_app('R').get('source')}))",
            ])
            env = {**os.environ, "DACTYL_DATA_DIR": data}
            proc = subprocess.run([sys.executable, "-c", script], env=env, capture_output=True, text=True,
                                  timeout=30, cwd=tmp)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            result = json.loads(proc.stdout.strip().splitlines()[-1])
            self.assertEqual(result["sketch"], os.path.join(data, "firmware", "dactyl_left"))
            self.assertEqual(result["user"], "user")
            # Gerenderte linke .ino im Datenverzeichnis; der spätere Flash der rechten Hälfte lässt sie stehen
            with open(os.path.join(data, "firmware", "dactyl_left", "dactyl_left.ino"), encoding="utf-8") as f:
                rendered = f.read()
            self.assertIn("'z'", rendered)
            self.assertNotIn("#define KEYMAP_DEFAULTS_ID 0UL", rendered)
            with open(os.path.join(data, "firmware", "dactyl_right", "dactyl_right.ino"), encoding="utf-8") as f:
                self.assertIn("'y'", f.read())
            # Der zweite Abgleich entfernt die veraltete Datei und lässt keine Temp-Verzeichnisse zurück
            self.assertFalse(os.path.exists(stale))
            self.assertEqual(sorted(os.listdir(os.path.join(data, "firmware"))), ["dactyl_left", "dactyl_right"])
            for name in ("dactyl_left/dactyl_left.ino", "dactyl_right/dactyl_right.ino"):
                with open(os.path.join(bundle, "firmware", name), encoding="utf-8") as f, \
                        open(os.path.join(root, "firmware", name), encoding="utf-8") as g:
                    self.assertEqual(f.read(), g.read(), name)
            # Der linke Sketch bindet ../dactyl_right/ ein: beide Sketches liegen im Datenverzeichnis
            self.assertTrue(os.path.isfile(os.path.join(data, "firmware", "dactyl_right", "DactylLogic.h")))
            self.assertTrue(os.path.isfile(os.path.join(data, "current_config_left.json")))
            self.assertTrue(os.path.isfile(os.path.join(data, "current_config.json")))
            self.assertFalse(os.path.exists(os.path.join(bundle, "current_config.json")))
            self.assertFalse(os.path.exists(os.path.join(bundle, "current_config_left.json")))

    def test_rebuild_app_script_quits_builds_and_restarts(self):
        root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
        with open(os.path.join(root, "package.json"), encoding="utf-8") as f:
            pkg = json.load(f)
        self.assertEqual(pkg["scripts"]["rebuild:app"],
                         "bash scripts/generate-split-key.sh --if-missing && bash scripts/rebuild-app.sh")
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
        cls.old_cfg = (server.CONFIG_FILE, server.LEFT_CONFIG_FILE, server.PROFILES_FILE, server.LEFT_PROFILES_FILE)
        server.CONFIG_FILE = os.path.join(cls.tmp.name, "current_config.json")
        server.LEFT_CONFIG_FILE = os.path.join(cls.tmp.name, "current_config_left.json")
        server.PROFILES_FILE = os.path.join(cls.tmp.name, "layout_profiles.json")
        server.LEFT_PROFILES_FILE = os.path.join(cls.tmp.name, "layout_profiles_left.json")
        cls.httpd = socketserver.TCPServer(("127.0.0.1", 0), server.ConfiguratorHandler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        server.CONFIG_FILE, server.LEFT_CONFIG_FILE, server.PROFILES_FILE, server.LEFT_PROFILES_FILE = cls.old_cfg
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

    def test_save_and_flash_stream_sends_ndjson_lines_and_result(self):
        old = (server.save_config_and_firmware, server.flash_firmware)
        seen = {}

        def fake_flash(side, on_output=None):
            seen["side"] = side
            on_output("compile", "Sketch uses 1 bytes")
            on_output("upload", "Writing at 0x00010000 (50 %)")
            return {"success": True, "port": "/dev/cu.usbserial-a", "side": side}

        server.save_config_and_firmware = lambda cfg, side: None
        server.flash_firmware = fake_flash
        try:
            status, data = self.request("POST", "/api/save_and_flash?side=L&stream=1", body=json.dumps({"layers": [[]]}),
                                        headers={"Origin": "http://localhost:8088"})
        finally:
            server.save_config_and_firmware, server.flash_firmware = old
        self.assertEqual(status, 200)
        events = [json.loads(line) for line in data.decode("utf-8").splitlines()]
        self.assertEqual(seen["side"], "L")
        self.assertEqual(events[0], {"type": "log", "stage": "compile", "line": "Sketch uses 1 bytes"})
        self.assertEqual(events[1]["stage"], "upload")
        self.assertEqual(events[-1], {"type": "result", "success": True, "port": "/dev/cu.usbserial-a", "side": "L"})

    def test_save_and_flash_stream_reports_an_exception_as_result(self):
        old = (server.save_config_and_firmware, server.flash_firmware)

        def broken_flash(side, on_output=None):
            on_output("compile", "erste Zeile")
            raise PermissionError("arduino-cli nicht ausführbar")

        server.save_config_and_firmware = lambda cfg, side: None
        server.flash_firmware = broken_flash
        try:
            status, data = self.request("POST", "/api/save_and_flash?stream=1", body=json.dumps({"layers": [[]]}),
                                        headers={"Origin": "http://localhost:8088"})
        finally:
            server.save_config_and_firmware, server.flash_firmware = old
        events = [json.loads(line) for line in data.decode("utf-8").splitlines()]
        self.assertEqual(events[0]["line"], "erste Zeile")
        self.assertEqual(events[-1]["type"], "result")
        self.assertFalse(events[-1]["success"])
        self.assertIn("arduino-cli nicht ausführbar", events[-1]["error"])

    def test_save_and_flash_stream_continues_after_the_client_disconnects(self):
        # Ein geschlossenes App-Fenster darf den Upload nicht abbrechen: ein halber Flash wäre schlimmer
        writes = []

        class BrokenPipeFile:
            def write(self, data):
                writes.append(data)
                if len(writes) > 1:
                    raise BrokenPipeError()

            def flush(self):
                pass

        handler = server.ConfiguratorHandler.__new__(server.ConfiguratorHandler)
        handler.wfile = BrokenPipeFile()
        handler.request_version = "HTTP/1.0"
        handler.send_response = lambda code: None
        handler.send_header = lambda *a: None
        handler.end_headers = lambda: None
        finished = []

        def fake_flash(side, on_output=None):
            for i in range(5):
                on_output("upload", f"Writing {i}")
            finished.append(side)
            return {"success": True, "side": side}

        old = server.flash_firmware
        server.flash_firmware = fake_flash
        try:
            handler.stream_flash("R")
        finally:
            server.flash_firmware = old
        self.assertEqual(finished, ["R"])        # Flash lief bis zum Ende
        self.assertEqual(len(writes), 2)          # nach dem Fehler kein weiterer Schreibversuch
        self.assertTrue(handler.close_connection)

    def test_save_and_flash_stream_validation_error_stays_plain_json(self):
        # Eine ungültige Config scheitert vor dem Stream: normale 400-Antwort, nichts geflasht
        old = server.flash_firmware
        server.flash_firmware = lambda *a, **k: self.fail("darf nicht flashen")
        try:
            status, data = self.request("POST", "/api/save_and_flash?stream=1", body=json.dumps({"layers": []}),
                                        headers={"Origin": "http://localhost:8088"})
        finally:
            server.flash_firmware = old
        self.assertEqual(status, 400)
        self.assertFalse(json.loads(data)["success"])

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

    def test_layout_profiles_per_side_roundtrip(self):
        origin = {"Origin": "http://localhost:8088"}
        old = (server.PROFILES_FILE, server.LEFT_PROFILES_FILE)
        server.PROFILES_FILE = os.path.join(self.tmp.name, "roundtrip_profiles.json")
        server.LEFT_PROFILES_FILE = os.path.join(self.tmp.name, "roundtrip_profiles_left.json")
        try:
            # Ohne Datei: leere Liste mit Revision 0
            self.assertEqual(json.loads(self.request("GET", "/api/profiles?side=R")[1]),
                             {"profiles": [], "revision": 0, "skipped": []})
            right = {"revision": 0, "profiles": [{"name": "Gaming", "savedAt": "2026-10-27T10:00:00Z",
                                                  "config": {"layers": [[[{"tap": "KEY_P"}]]], "source": "user"}}]}
            left = {"revision": 0, "profiles": [{"name": "Code", "savedAt": "", "config": {"layers": [[[{"tap": "KEY_Q"}]]]}}]}
            status, body = self.request("POST", "/api/profiles?side=R", body=json.dumps(right), headers=origin)
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(body)["revision"], 1)
            self.assertEqual(self.request("POST", "/api/profiles?side=L", body=json.dumps(left), headers=origin)[0], 200)
            got = json.loads(self.request("GET", "/api/profiles?side=R")[1])
            # "source" ist Server-Metadatum und wird nicht im Profil gespeichert
            self.assertEqual(got["profiles"][0]["config"], {"layers": [[[{"tap": "KEY_P"}]]]})
            self.assertEqual(got["revision"], 1)
            self.assertEqual(json.loads(self.request("GET", "/api/profiles?side=L")[1])["profiles"], left["profiles"])
            # Zweites Fenster mit veraltetem Stand (Revision 0): HTTP 409, die gespeicherte Liste bleibt
            stale = {"revision": 0, "profiles": []}
            self.assertEqual(self.request("POST", "/api/profiles?side=R", body=json.dumps(stale), headers=origin)[0], 409)
            self.assertEqual(len(json.loads(self.request("GET", "/api/profiles?side=R")[1])["profiles"]), 1)
            # Ohne Revision: HTTP 400
            self.assertEqual(self.request("POST", "/api/profiles?side=R", body=json.dumps({"profiles": []}), headers=origin)[0], 400)
            self.assertEqual(self.request("GET", "/api/profiles?side=X")[0], 400)
            self.assertEqual(self.request("POST", "/api/profiles?side=X", body=json.dumps(left), headers=origin)[0], 400)
        finally:
            server.PROFILES_FILE, server.LEFT_PROFILES_FILE = old

    def test_layout_profiles_validation(self):
        origin = {"Origin": "http://localhost:8088"}
        cfg = {"layers": [[[{"tap": "KEY_A"}]]]}
        bad_bodies = [
            {"revision": 0, "profiles": "x"},
            {"revision": 0, "profiles": [{"name": "", "config": cfg}]},
            {"revision": 0, "profiles": [{"name": 'A"B', "config": cfg}]},
            {"revision": 0, "profiles": [{"name": "A", "config": cfg}, {"name": "a", "config": cfg}]},
            {"revision": 0, "profiles": [{"name": "A", "config": {"layers": []}}]},
            {"revision": 0, "profiles": [{"name": "A", "savedAt": 5, "config": cfg}]},
            {"revision": 0, "profiles": [{"name": f"P{i}", "config": cfg} for i in range(server.MAX_PROFILES + 1)]},
            {"revision": "0", "profiles": []},
            {"revision": True, "profiles": []},
        ]
        for body in bad_bodies:
            with self.subTest(body=str(body)[:60]):
                self.assertEqual(self.request("POST", "/api/profiles?side=R", body=json.dumps(body), headers=origin)[0], 400)
        # Links gelten die Regeln der fehlenden Tasten (R5C0 trägt keine Aktion)
        bad_left = {"revision": 0, "profiles": [{"name": "A", "config": {"layers": [[[], [], [], [], [], [{"tap": "KEY_A"}]]]}}]}
        self.assertEqual(self.request("POST", "/api/profiles?side=L", body=json.dumps(bad_left), headers=origin)[0], 400)
        self.assertEqual(self.request("POST", "/api/profiles?side=R", body=json.dumps(bad_left), headers=origin)[0], 200)

    def test_layout_profiles_names_normalized_like_app(self):
        origin = {"Origin": "http://localhost:8088"}
        old = server.PROFILES_FILE
        server.PROFILES_FILE = os.path.join(self.tmp.name, "names_profiles.json")
        cfg = {"layers": [[[{"tap": "KEY_A"}]]]}
        try:
            # casefold: "Straße" und "STRASSE" sind derselbe Name (die App vergleicht ebenso)
            dup = {"revision": 0, "profiles": [{"name": "Straße", "config": cfg}, {"name": "STRASSE", "config": cfg}]}
            self.assertEqual(self.request("POST", "/api/profiles?side=R", body=json.dumps(dup), headers=origin)[0], 400)
            # Ein Leerzeichen am Ende ist nach sanitize_name nicht unverändert: abgelehnt
            trailing = {"revision": 0, "profiles": [{"name": "Gaming ", "config": cfg}]}
            self.assertEqual(self.request("POST", "/api/profiles?side=R", body=json.dumps(trailing), headers=origin)[0], 400)
            # 31 Zeichen nach dem Kürzen ohne Leerzeichen am Ende: gültig
            ok = {"revision": 0, "profiles": [{"name": "a" * 30 + "b", "config": cfg}]}
            self.assertEqual(self.request("POST", "/api/profiles?side=R", body=json.dumps(ok), headers=origin)[0], 200)
        finally:
            server.PROFILES_FILE = old

    def test_layout_profiles_skip_invalid_entries_on_load(self):
        old = server.PROFILES_FILE
        server.PROFILES_FILE = os.path.join(self.tmp.name, "partly_invalid_profiles.json")
        try:
            with open(server.PROFILES_FILE, "w", encoding="utf-8") as f:
                json.dump({"revision": 4, "profiles": [
                    {"name": "Gut", "savedAt": "", "config": {"layers": [[[{"tap": "KEY_A"}]]]}},
                    {"name": "Kaputt", "savedAt": "", "config": {"layers": []}},
                ]}, f)
            status, data = self.request("GET", "/api/profiles?side=R")
            self.assertEqual(status, 200)
            data = json.loads(data)
            self.assertEqual([p["name"] for p in data["profiles"]], ["Gut"])
            self.assertEqual(data["revision"], 4)
            self.assertEqual(len(data["skipped"]), 1)
            self.assertIn("Kaputt", data["skipped"][0])
            # Speichern mit der gelesenen Revision repariert die Datei und behält die alte als Backup
            body = json.dumps({"revision": 4, "profiles": data["profiles"]})
            status, _ = self.request("POST", "/api/profiles?side=R", body=body, headers={"Origin": "http://localhost:8088"})
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(self.request("GET", "/api/profiles?side=R")[1])["skipped"], [])
            folder, base = os.path.split(server.PROFILES_FILE)
            backups = [n for n in os.listdir(folder) if n.startswith(base + ".") and n.endswith(".bak")]
            self.assertEqual(len(backups), 1)
            with open(os.path.join(folder, backups[0]), encoding="utf-8") as f:
                self.assertIn("Kaputt", f.read())
            # Ohne übersprungene Profile entsteht kein weiteres Backup
            body = json.dumps({"revision": 5, "profiles": data["profiles"]})
            self.request("POST", "/api/profiles?side=R", body=body, headers={"Origin": "http://localhost:8088"})
            self.assertEqual(len([n for n in os.listdir(folder) if n.startswith(base + ".") and n.endswith(".bak")]), 1)
            # Doppelte Namen, zu viele Profile und eine ungültige Revision in der Datei
            cfg = {"layers": [[[{"tap": "KEY_A"}]]]}
            with open(server.PROFILES_FILE, "w", encoding="utf-8") as f:
                json.dump({"revision": "x", "profiles": [{"name": "A", "config": cfg}, {"name": "a", "config": cfg}] +
                           [{"name": f"P{i}", "config": cfg} for i in range(server.MAX_PROFILES)]}, f)
            data = json.loads(self.request("GET", "/api/profiles?side=R")[1])
            self.assertEqual(len(data["profiles"]), server.MAX_PROFILES)
            self.assertEqual(data["revision"], 0)
            self.assertTrue(any("doppelt" in s for s in data["skipped"]))
            self.assertTrue(any("maximal" in s for s in data["skipped"]))
        finally:
            server.PROFILES_FILE = old

    def test_layout_profiles_corrupt_file_is_not_replaced(self):
        old = server.PROFILES_FILE
        server.PROFILES_FILE = os.path.join(self.tmp.name, "corrupt_profiles.json")
        try:
            with open(server.PROFILES_FILE, "w", encoding="utf-8") as f:
                f.write("{kaputt")
            status, data = self.request("GET", "/api/profiles?side=R")
            self.assertEqual(status, 500)
            self.assertFalse(json.loads(data)["success"])
        finally:
            server.PROFILES_FILE = old

    def with_backup_dirs(self):
        """Eigene Backup-Ordner je Test; gibt eine Funktion zum Zurücksetzen zurück."""
        old = (server.BACKUP_DIR, server.LEFT_BACKUP_DIR)
        folder = tempfile.mkdtemp(dir=self.tmp.name)
        server.BACKUP_DIR = os.path.join(folder, "right")
        server.LEFT_BACKUP_DIR = os.path.join(folder, "left")

        def restore():
            server.BACKUP_DIR, server.LEFT_BACKUP_DIR = old
        return restore

    def test_backup_skips_same_config_and_limits_sync_rate(self):
        restore = self.with_backup_dirs()
        try:
            a = {"layers": [[[{"tap": "KEY_A"}]]], "source": "user"}
            b = {"layers": [[[{"tap": "KEY_B"}]]]}
            c = {"layers": [[[{"tap": "KEY_C"}]]]}
            t = 1_800_000_000.0
            first = server.create_backup(a, "R", "sync", now=t)
            self.assertIsNotNone(first)
            # Gleicher Inhalt: kein neues Backup, auch nach dem Intervall und beim Flash
            self.assertIsNone(server.create_backup(a, "R", "flash", now=t + 5000))
            # Anderer Inhalt innerhalb von 10 Minuten: ein Sync legt keins an, ein Flash schon
            self.assertIsNone(server.create_backup(b, "R", "sync", now=t + server.BACKUP_MIN_INTERVAL_S - 1))
            self.assertIsNotNone(server.create_backup(b, "R", "flash", now=t + 10))
            self.assertIsNotNone(server.create_backup(c, "R", "sync", now=t + 10 + server.BACKUP_MIN_INTERVAL_S))
            data = server.load_backups("R")
            self.assertEqual([x["config"]["layers"][0][0][0]["tap"] for x in data["backups"]], ["KEY_C", "KEY_B", "KEY_A"])
            self.assertEqual([x["reason"] for x in data["backups"]], ["sync", "flash", "sync"])
            # "source" ist Server-Metadatum und landet nicht im Backup
            self.assertNotIn("source", data["backups"][-1]["config"])
            self.assertEqual(data["skipped"], 0)
            # Die linke Hälfte hat eigene Backups
            self.assertEqual(server.load_backups("L"), {"backups": [], "skipped": 0})
            # Eine zurückgestellte Uhr sperrt keine Backups, und das neue Backup bleibt das neueste
            self.assertIsNotNone(server.create_backup(a, "R", "sync", now=t))
            self.assertEqual(server.load_backups("R")["backups"][0]["config"], {"layers": [[[{"tap": "KEY_A"}]]]})
            with self.assertRaises(ValueError):
                server.create_backup({"layers": []}, "R", "sync", now=t)
            with self.assertRaises(ValueError):
                server.create_backup(a, "R", "export", now=t)
        finally:
            restore()

    def test_backup_keeps_only_the_newest(self):
        restore = self.with_backup_dirs()
        try:
            t = 1_800_000_000.0
            for i in range(server.MAX_BACKUPS + 3):
                # Gleiche Millisekunde für die letzten: die Nummer im Namen trennt sie und hält die Reihenfolge
                now = t + i if i < server.MAX_BACKUPS else t + server.MAX_BACKUPS
                cfg = {"layers": [[[{"tap": "KEY_A"}]]], "layerNames": [f"v{i}"]}
                self.assertIsNotNone(server.create_backup(cfg, "R", "flash", now=now))
            names = server.backup_file_names(server.BACKUP_DIR)
            self.assertEqual(len(names), server.MAX_BACKUPS)
            got = [b["config"]["layerNames"][0] for b in server.load_backups("R")["backups"]]
            self.assertEqual(got[0], f"v{server.MAX_BACKUPS + 2}")
            self.assertEqual(got[-1], "v3")
            # Fremde Dateien im Ordner bleiben unberührt und erscheinen nicht in der Liste
            self.assertTrue(os.path.exists(os.path.join(server.BACKUP_DIR, ".lock")))
        finally:
            restore()

    def test_backup_order_survives_a_clock_set_back(self):
        restore = self.with_backup_dirs()
        try:
            t = 1_800_000_000.0
            for i in range(server.MAX_BACKUPS):
                server.create_backup({"layers": [[[{"tap": "KEY_A"}]]], "layerNames": [f"v{i}"]}, "R", "flash", now=t + i)
            # Uhr um einen Tag zurück: das neue Backup bleibt erhalten, das älteste fällt weg
            server.create_backup({"layers": [[[{"tap": "KEY_A"}]]], "layerNames": ["neu"]}, "R", "flash", now=t - 86400)
            got = [b["config"]["layerNames"][0] for b in server.load_backups("R")["backups"]]
            self.assertEqual(len(got), server.MAX_BACKUPS)
            self.assertEqual(got[0], "neu")
            self.assertNotIn("v0", got)
            self.assertIn("v1", got)
        finally:
            restore()

    def test_backup_list_skips_invalid_files(self):
        restore = self.with_backup_dirs()
        try:
            os.makedirs(server.LEFT_BACKUP_DIR)
            with open(os.path.join(server.LEFT_BACKUP_DIR, "backup-000001-20270101-000000-000.json"), "w", encoding="utf-8") as f:
                f.write("{kaputt")
            # R5C0 existiert links nicht: ungültiges Backup
            bad = {"created": 1, "savedAt": "", "reason": "sync", "config": {"layers": [[[], [], [], [], [], [{"tap": "KEY_A"}]]]}}
            with open(os.path.join(server.LEFT_BACKUP_DIR, "backup-000002-20270101-000001-000.json"), "w", encoding="utf-8") as f:
                json.dump(bad, f)
            self.assertIsNotNone(server.create_backup({"layers": [[[{"tap": "KEY_Q"}]]]}, "L", "sync", now=1_800_000_000.0))
            data = json.loads(self.request("GET", "/api/backups?side=L")[1])
            self.assertEqual(len(data["backups"]), 1)
            self.assertEqual(data["skipped"], 2)
            self.assertEqual(data["backups"][0]["config"], {"layers": [[[{"tap": "KEY_Q"}]]]})
        finally:
            restore()

    def test_backups_http_roundtrip(self):
        restore = self.with_backup_dirs()
        origin = {"Origin": "http://localhost:8088"}
        try:
            self.assertEqual(json.loads(self.request("GET", "/api/backups?side=R")[1]), {"backups": [], "skipped": 0})
            cfg = {"layers": [[[{"tap": "KEY_P"}]]]}
            status, body = self.request("POST", "/api/backups?side=R", body=json.dumps(cfg), headers=origin)
            self.assertEqual((status, json.loads(body)), (200, {"success": True, "created": True}))
            # Zweiter Sync direkt danach: kein neues Backup
            status, body = self.request("POST", "/api/backups?side=R", body=json.dumps({"layers": [[[{"tap": "KEY_O"}]]]}), headers=origin)
            self.assertEqual((status, json.loads(body)), (200, {"success": True, "created": False}))
            backups = json.loads(self.request("GET", "/api/backups?side=R")[1])["backups"]
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0]["config"], cfg)
            self.assertEqual(backups[0]["reason"], "sync")
            self.assertTrue(backups[0]["id"].startswith("backup-"))
            self.assertEqual(self.request("POST", "/api/backups?side=R", body=json.dumps({"layers": []}), headers=origin)[0], 400)
            self.assertEqual(self.request("POST", "/api/backups?side=X", body=json.dumps(cfg), headers=origin)[0], 400)
            self.assertEqual(self.request("GET", "/api/backups?side=X")[0], 400)
            self.assertEqual(self.request("POST", "/api/backups?side=R", body=json.dumps(cfg),
                                          headers={"Origin": "http://evil.example"})[0], 403)
        finally:
            restore()

    def test_save_and_flash_creates_a_backup_before_flashing(self):
        restore = self.with_backup_dirs()
        old = (server.save_config_and_firmware, server.flash_firmware)
        seen = {}

        def fake_flash(side, on_output=None):
            seen["backups"] = len(server.load_backups(side)["backups"])
            return {"success": True, "port": "/dev/cu.usbserial-a", "side": side}

        server.save_config_and_firmware = lambda cfg, side: None
        server.flash_firmware = fake_flash
        try:
            cfg = {"layers": [[[{"tap": "KEY_F"}]]]}
            status, _ = self.request("POST", "/api/save_and_flash?side=L", body=json.dumps(cfg),
                                     headers={"Origin": "http://localhost:8088"})
            self.assertEqual(status, 200)
            self.assertEqual(seen["backups"], 1)
            backup = server.load_backups("L")["backups"][0]
            self.assertEqual((backup["reason"], backup["config"]), ("flash", cfg))
            # Ein fehlgeschlagenes Backup hält den Flash nicht auf
            with mock.patch.object(server, "create_backup", side_effect=OSError("Platte voll")):
                status, _ = self.request("POST", "/api/save_and_flash?side=L", body=json.dumps(cfg),
                                         headers={"Origin": "http://localhost:8088"})
            self.assertEqual(status, 200)
        finally:
            server.save_config_and_firmware, server.flash_firmware = old
            restore()

    def test_layout_profiles_are_not_versioned(self):
        root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
        with open(os.path.join(root, ".gitignore"), encoding="utf-8") as f:
            ignored = [line.strip() for line in f]
        self.assertIn("layout_profiles.json", ignored)
        self.assertIn("layout_profiles_left.json", ignored)
        # Sperr- und Backup-Dateien von save_profiles_atomic
        for name in ("layout_profiles.json.lock", "layout_profiles_left.json.lock"):
            self.assertIn(name, ignored)
        self.assertIn("layout_profiles*.json.*.bak", ignored)
        # Automatische Backups vor Sync und Flash
        self.assertIn("config_backups/", ignored)

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
