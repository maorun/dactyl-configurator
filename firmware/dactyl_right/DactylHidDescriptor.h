#pragma once
#include <stdint.h>
#include "HIDTypes.h"

/*
 * Composite BLE HID Report-Descriptor (Keyboard ID 1, Consumer ID 2, Mouse ID 3).
 * Separater Header ohne BLE-Stack-Abhängigkeit, damit die Unit-Tests den Descriptor prüfen können.
 */

#define KEYBOARD_ID    0x01
#define MEDIA_KEYS_ID  0x02
#define MOUSE_ID       0x03

#define MOUSE_BUTTON_LEFT   0x01
#define MOUSE_BUTTON_RIGHT  0x02
#define MOUSE_BUTTON_MIDDLE 0x04

static const uint8_t _compositeReportDescriptor[] = {
  // ------------------------------------------------- Keyboard (Report ID 1)
  USAGE_PAGE(1),      0x01,          // USAGE_PAGE (Generic Desktop Ctrls)
  USAGE(1),           0x06,          // USAGE (Keyboard)
  COLLECTION(1),      0x01,          // COLLECTION (Application)
  REPORT_ID(1),       KEYBOARD_ID,   //   REPORT_ID (1)
  USAGE_PAGE(1),      0x07,          //   USAGE_PAGE (Kbrd/Keypad)
  USAGE_MINIMUM(1),   0xE0,          //   USAGE_MINIMUM (0xE0)
  USAGE_MAXIMUM(1),   0xE7,          //   USAGE_MAXIMUM (0xE7)
  LOGICAL_MINIMUM(1), 0x00,          //   LOGICAL_MINIMUM (0)
  LOGICAL_MAXIMUM(1), 0x01,          //   LOGICAL_MAXIMUM (1)
  REPORT_SIZE(1),     0x01,          //   REPORT_SIZE (1)
  REPORT_COUNT(1),    0x08,          //   REPORT_COUNT (8)
  HIDINPUT(1),        0x02,          //   INPUT (Data,Var,Abs)
  REPORT_COUNT(1),    0x01,          //   REPORT_COUNT (1) ; 1 byte (Reserved)
  REPORT_SIZE(1),     0x08,          //   REPORT_SIZE (8)
  HIDINPUT(1),        0x01,          //   INPUT (Const,Array,Abs)
  REPORT_COUNT(1),    0x05,          //   REPORT_COUNT (5) ; 5 bits (LEDs)
  REPORT_SIZE(1),     0x01,          //   REPORT_SIZE (1)
  USAGE_PAGE(1),      0x08,          //   USAGE_PAGE (LEDs)
  USAGE_MINIMUM(1),   0x01,          //   USAGE_MINIMUM (1)
  USAGE_MAXIMUM(1),   0x05,          //   USAGE_MAXIMUM (5)
  HIDOUTPUT(1),       0x02,          //   OUTPUT (Data,Var,Abs)
  REPORT_COUNT(1),    0x01,          //   REPORT_COUNT (1) ; 3 bits (Padding)
  REPORT_SIZE(1),     0x03,          //   REPORT_SIZE (3)
  HIDOUTPUT(1),       0x01,          //   OUTPUT (Const,Array,Abs)
  REPORT_COUNT(1),    0x06,          //   REPORT_COUNT (6) ; 6 bytes (Keys)
  REPORT_SIZE(1),     0x08,          //   REPORT_SIZE(8)
  LOGICAL_MINIMUM(1), 0x00,          //   LOGICAL_MINIMUM(0)
  LOGICAL_MAXIMUM(1), 0x73,          //   LOGICAL_MAXIMUM(0x73) ; inkl. F13..F24 (0x68..0x73)
  USAGE_PAGE(1),      0x07,          //   USAGE_PAGE (Kbrd/Keypad)
  USAGE_MINIMUM(1),   0x00,          //   USAGE_MINIMUM (0)
  USAGE_MAXIMUM(1),   0x73,          //   USAGE_MAXIMUM (0x73)
  HIDINPUT(1),        0x00,          //   INPUT (Data,Array,Abs)
  END_COLLECTION(0),                 // END_COLLECTION

  // ------------------------------------------------- Media Keys (Report ID 2)
  USAGE_PAGE(1),      0x0C,          // USAGE_PAGE (Consumer)
  USAGE(1),           0x01,          // USAGE (Consumer Control)
  COLLECTION(1),      0x01,          // COLLECTION (Application)
  REPORT_ID(1),       MEDIA_KEYS_ID, //   REPORT_ID (2)
  USAGE_PAGE(1),      0x0C,          //   USAGE_PAGE (Consumer)
  LOGICAL_MINIMUM(1), 0x00,          //   LOGICAL_MINIMUM (0)
  LOGICAL_MAXIMUM(1), 0x01,          //   LOGICAL_MAXIMUM (1)
  REPORT_SIZE(1),     0x01,          //   REPORT_SIZE (1)
  REPORT_COUNT(1),    0x10,          //   REPORT_COUNT (16)
  USAGE(1),           0xB5,          //   Next Track
  USAGE(1),           0xB6,          //   Previous Track
  USAGE(1),           0xB7,          //   Stop
  USAGE(1),           0xCD,          //   Play/Pause
  USAGE(1),           0xE2,          //   Mute
  USAGE(1),           0xE9,          //   Volume Increment
  USAGE(1),           0xEA,          //   Volume Decrement
  USAGE(2),           0x23, 0x02,    //   WWW Home
  USAGE(2),           0x94, 0x01,    //   My Computer
  USAGE(2),           0x92, 0x01,    //   Calculator
  USAGE(2),           0x9D, 0x02,    //   Mac Globe / AC Next Keyboard Layout Select
  USAGE(2),           0x21, 0x02,    //   WWW search
  USAGE(2),           0x26, 0x02,    //   WWW stop
  USAGE(2),           0x24, 0x02,    //   WWW back
  USAGE(2),           0x83, 0x01,    //   Media sel
  USAGE(2),           0x8A, 0x01,    //   Mail
  HIDINPUT(1),        0x02,          //   INPUT (Data,Var,Abs)
  END_COLLECTION(0),                 // END_COLLECTION

  // ------------------------------------------------- Mouse (Report ID 3)
  USAGE_PAGE(1),      0x01,          // USAGE_PAGE (Generic Desktop)
  USAGE(1),           0x02,          // USAGE (Mouse)
  COLLECTION(1),      0x01,          // COLLECTION (Application)
  USAGE(1),           0x01,          //   USAGE (Pointer)
  COLLECTION(1),      0x00,          //   COLLECTION (Physical)
  REPORT_ID(1),       MOUSE_ID,      //     REPORT_ID (3)
  USAGE_PAGE(1),      0x09,          //     USAGE_PAGE (Buttons)
  USAGE_MINIMUM(1),   0x01,          //     USAGE_MINIMUM (1)
  USAGE_MAXIMUM(1),   0x03,          //     USAGE_MAXIMUM (3)
  LOGICAL_MINIMUM(1), 0x00,          //     LOGICAL_MINIMUM (0)
  LOGICAL_MAXIMUM(1), 0x01,          //     LOGICAL_MAXIMUM (1)
  REPORT_COUNT(1),    0x03,          //     REPORT_COUNT (3)
  REPORT_SIZE(1),     0x01,          //     REPORT_SIZE (1)
  HIDINPUT(1),        0x02,          //     INPUT (Data, Var, Abs)
  REPORT_COUNT(1),    0x01,          //     REPORT_COUNT (1) ; 5 bits padding
  REPORT_SIZE(1),     0x05,          //     REPORT_SIZE (5)
  HIDINPUT(1),        0x01,          //     INPUT (Const, Var, Abs)
  USAGE_PAGE(1),      0x01,          //     USAGE_PAGE (Generic Desktop)
  USAGE(1),           0x30,          //     USAGE (X)
  USAGE(1),           0x31,          //     USAGE (Y)
  USAGE(1),           0x38,          //     USAGE (Wheel)
  LOGICAL_MINIMUM(1), 0x81,          //     LOGICAL_MINIMUM (-127)
  LOGICAL_MAXIMUM(1), 0x7F,          //     LOGICAL_MAXIMUM (127)
  REPORT_SIZE(1),     0x08,          //     REPORT_SIZE (8)
  REPORT_COUNT(1),    0x03,          //     REPORT_COUNT (3)
  HIDINPUT(1),        0x06,          //     INPUT (Data, Var, Rel)
  END_COLLECTION(0),                 //   END_COLLECTION (Physical)
  END_COLLECTION(0)                  // END_COLLECTION (Application)
};
