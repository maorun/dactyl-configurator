#pragma once
#include <stdint.h>

/*
 * =============================================================================
 * Dactyl Firmware — Keycodes & HID-Report-Typen
 * =============================================================================
 * Ersetzt die frühere Abhängigkeit von ESP32-BLE-Keyboard (BleKeyboard.h).
 * Die Upstream-Bibliothek kompiliert nicht gegen ESP32 Arduino Core 3.x und kennt
 * den Mac-Globe-Key nicht. Die Firmware nutzte daraus nur diese Typen und Werte;
 * die eigentliche HID-Implementierung liegt in DactylBleComposite.h.
 *
 * Werte entsprechen der Arduino-Keyboard-Konvention (0x80..0xFF = Sondertasten,
 * siehe AGENTS.md "Action Codes"), damit bestehende NVS-Keymaps gültig bleiben.
 */

const uint8_t KEY_LEFT_CTRL = 0x80;
const uint8_t KEY_LEFT_SHIFT = 0x81;
const uint8_t KEY_LEFT_ALT = 0x82;
const uint8_t KEY_LEFT_GUI = 0x83;
const uint8_t KEY_RIGHT_CTRL = 0x84;
const uint8_t KEY_RIGHT_SHIFT = 0x85;
const uint8_t KEY_RIGHT_ALT = 0x86;
const uint8_t KEY_RIGHT_GUI = 0x87;

const uint8_t KEY_UP_ARROW = 0xDA;
const uint8_t KEY_DOWN_ARROW = 0xD9;
const uint8_t KEY_LEFT_ARROW = 0xD8;
const uint8_t KEY_RIGHT_ARROW = 0xD7;
const uint8_t KEY_BACKSPACE = 0xB2;
const uint8_t KEY_TAB = 0xB3;
const uint8_t KEY_RETURN = 0xB0;
const uint8_t KEY_ESC = 0xB1;
const uint8_t KEY_INSERT = 0xD1;
const uint8_t KEY_PRTSC = 0xCE;
const uint8_t KEY_DELETE = 0xD4;
const uint8_t KEY_PAGE_UP = 0xD3;
const uint8_t KEY_PAGE_DOWN = 0xD6;
const uint8_t KEY_HOME = 0xD2;
const uint8_t KEY_END = 0xD5;
const uint8_t KEY_CAPS_LOCK = 0xC1;
const uint8_t KEY_F1 = 0xC2;
const uint8_t KEY_F2 = 0xC3;
const uint8_t KEY_F3 = 0xC4;
const uint8_t KEY_F4 = 0xC5;
const uint8_t KEY_F5 = 0xC6;
const uint8_t KEY_F6 = 0xC7;
const uint8_t KEY_F7 = 0xC8;
const uint8_t KEY_F8 = 0xC9;
const uint8_t KEY_F9 = 0xCA;
const uint8_t KEY_F10 = 0xCB;
const uint8_t KEY_F11 = 0xCC;
const uint8_t KEY_F12 = 0xCD;
const uint8_t KEY_F13 = 0xF0;
const uint8_t KEY_F14 = 0xF1;
const uint8_t KEY_F15 = 0xF2;
const uint8_t KEY_F16 = 0xF3;
const uint8_t KEY_F17 = 0xF4;
const uint8_t KEY_F18 = 0xF5;
const uint8_t KEY_F19 = 0xF6;
const uint8_t KEY_F20 = 0xF7;
const uint8_t KEY_F21 = 0xF8;
const uint8_t KEY_F22 = 0xF9;
const uint8_t KEY_F23 = 0xFA;
const uint8_t KEY_F24 = 0xFB;

const uint8_t KEY_NUM_0 = 0xEA;
const uint8_t KEY_NUM_1 = 0xE1;
const uint8_t KEY_NUM_2 = 0xE2;
const uint8_t KEY_NUM_3 = 0xE3;
const uint8_t KEY_NUM_4 = 0xE4;
const uint8_t KEY_NUM_5 = 0xE5;
const uint8_t KEY_NUM_6 = 0xE6;
const uint8_t KEY_NUM_7 = 0xE7;
const uint8_t KEY_NUM_8 = 0xE8;
const uint8_t KEY_NUM_9 = 0xE9;
const uint8_t KEY_NUM_SLASH = 0xDC;
const uint8_t KEY_NUM_ASTERISK = 0xDD;
const uint8_t KEY_NUM_MINUS = 0xDE;
const uint8_t KEY_NUM_PLUS = 0xDF;
const uint8_t KEY_NUM_ENTER = 0xE0;
const uint8_t KEY_NUM_PERIOD = 0xEB;
// ISO-Taste zwischen linkem Shift und Z (HID 0x64; deutsches macOS: < und >)
const uint8_t KEY_NON_US_BACKSLASH = 0xEC;

// Consumer-Control-Report (Report ID 2): 16 Bit, Bitposition = Reihenfolge im Report-Descriptor
typedef uint8_t MediaKeyReport[2];

const MediaKeyReport KEY_MEDIA_NEXT_TRACK = {1, 0};
const MediaKeyReport KEY_MEDIA_PREVIOUS_TRACK = {2, 0};
const MediaKeyReport KEY_MEDIA_STOP = {4, 0};
const MediaKeyReport KEY_MEDIA_PLAY_PAUSE = {8, 0};
const MediaKeyReport KEY_MEDIA_MUTE = {16, 0};
const MediaKeyReport KEY_MEDIA_VOLUME_UP = {32, 0};
const MediaKeyReport KEY_MEDIA_VOLUME_DOWN = {64, 0};
const MediaKeyReport KEY_MEDIA_GLOBE = {0, 4}; // Mac Globe (Fn) / AC Next Keyboard Layout Select (0x029D)

// Keyboard-Report (Report ID 1): Modifier-Bitmaske, reserviert, 6 Scancodes
typedef struct {
  uint8_t modifiers;
  uint8_t reserved;
  uint8_t keys[6];
} KeyReport;

// ASCII (0..127) -> HID Usage ID (US-Layout). Bit 7 (DACTYL_ASCII_SHIFT) = Shift erforderlich.
#define DACTYL_ASCII_SHIFT 0x80

constexpr uint8_t dactylAsciiToHid(uint8_t c) {
  return
    (c >= 'a' && c <= 'z') ? (uint8_t)(0x04 + (c - 'a')) :
    (c >= 'A' && c <= 'Z') ? (uint8_t)((0x04 + (c - 'A')) | DACTYL_ASCII_SHIFT) :
    (c >= '1' && c <= '9') ? (uint8_t)(0x1E + (c - '1')) :
    c == '0'  ? 0x27 :
    c == '\b' ? 0x2A :
    c == '\t' ? 0x2B :
    c == '\n' ? 0x28 :
    c == ' '  ? 0x2C :
    c == '-'  ? 0x2D : c == '_' ? (0x2D | DACTYL_ASCII_SHIFT) :
    c == '='  ? 0x2E : c == '+' ? (0x2E | DACTYL_ASCII_SHIFT) :
    c == '['  ? 0x2F : c == '{' ? (0x2F | DACTYL_ASCII_SHIFT) :
    c == ']'  ? 0x30 : c == '}' ? (0x30 | DACTYL_ASCII_SHIFT) :
    c == '\\' ? 0x31 : c == '|' ? (0x31 | DACTYL_ASCII_SHIFT) :
    c == ';'  ? 0x33 : c == ':' ? (0x33 | DACTYL_ASCII_SHIFT) :
    c == '\'' ? 0x34 : c == '"' ? (0x34 | DACTYL_ASCII_SHIFT) :
    c == '`'  ? 0x35 : c == '~' ? (0x35 | DACTYL_ASCII_SHIFT) :
    c == ','  ? 0x36 : c == '<' ? (0x36 | DACTYL_ASCII_SHIFT) :
    c == '.'  ? 0x37 : c == '>' ? (0x37 | DACTYL_ASCII_SHIFT) :
    c == '/'  ? 0x38 : c == '?' ? (0x38 | DACTYL_ASCII_SHIFT) :
    c == '!'  ? (0x1E | DACTYL_ASCII_SHIFT) :
    c == '@'  ? (0x1F | DACTYL_ASCII_SHIFT) :
    c == '#'  ? (0x20 | DACTYL_ASCII_SHIFT) :
    c == '$'  ? (0x21 | DACTYL_ASCII_SHIFT) :
    c == '%'  ? (0x22 | DACTYL_ASCII_SHIFT) :
    c == '^'  ? (0x23 | DACTYL_ASCII_SHIFT) :
    c == '&'  ? (0x24 | DACTYL_ASCII_SHIFT) :
    c == '*'  ? (0x25 | DACTYL_ASCII_SHIFT) :
    c == '('  ? (0x26 | DACTYL_ASCII_SHIFT) :
    c == ')'  ? (0x27 | DACTYL_ASCII_SHIFT) :
    0x00;
}
