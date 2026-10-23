import unittest
import json
import os
import re
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
            "standbyTimeoutMinutes": 15,
            "sleepTimeoutMinutes": 90
        }
        cpp = server.generate_settings_cpp(settings)
        self.assertIn('String deviceName = "Test Dactyl";', cpp)
        self.assertIn("uint8_t debounceMs = 8;", cpp)
        self.assertIn("uint16_t comboTimeoutMs = 65;", cpp)
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
        for bad in ("MO_1", "MEDIA_MUTE", "MOUSE_LEFT", "PAIR_0", "NONE", "", None, 5, "KEY_A; evil",
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


class TestServerHttp(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.old_cfg = server.CONFIG_FILE
        server.CONFIG_FILE = os.path.join(cls.tmp.name, "current_config.json")
        cls.httpd = socketserver.TCPServer(("127.0.0.1", 0), server.ConfiguratorHandler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        server.CONFIG_FILE = cls.old_cfg
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
