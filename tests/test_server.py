import unittest
import json
import os
import sys
import tempfile
import urllib.request
import urllib.error

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
        self.assertIn("{ 2, 1, 2, 2, 0, KEY_ESC, false }", cpp)
        self.assertIn("{ 2, 1, 2, 3, 1, KEY_LEFT_CTRL, false }", cpp)

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

    def test_save_config_atomic_validation(self):
        # Must reject non-dict or missing layers
        with self.assertRaises(ValueError):
            server.save_config_atomic("invalid")
        with self.assertRaises(ValueError):
            server.save_config_atomic({})
        with self.assertRaises(ValueError):
            server.save_config_atomic({"layers": []})

if __name__ == "__main__":
    unittest.main()
