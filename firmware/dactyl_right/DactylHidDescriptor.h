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

// -----------------------------------------------------------------------------
// BLE Connection Parameters (Apple Accessory Design Guidelines & Power Saving)
// Connection interval is in units of 1.25 ms. Supervision timeout is in units of 10 ms.
// -----------------------------------------------------------------------------
#define BLE_CONN_ACTIVE_MIN_INT       0x0006  // 7.5 ms (6 * 1.25 ms)
#define BLE_CONN_ACTIVE_MAX_INT       0x0012  // 22.5 ms (18 * 1.25 ms, min + 15 ms <= max for Apple guidelines)
#define BLE_CONN_ACTIVE_LATENCY       0       // Immediate transmission on every event
#define BLE_CONN_STANDBY_MIN_INT      0x000C  // 15 ms  (12 * 1.25 ms)
#define BLE_CONN_STANDBY_MAX_INT      0x0018  // 30 ms  (24 * 1.25 ms)
#define BLE_CONN_STANDBY_LATENCY      20      // Skip up to 20 empty events (~315..630 ms wakeup)
#define BLE_CONN_SUPERVISION_TIMEOUT  400     // 4000 ms (400 * 10 ms)

struct BleConnParams {
  uint16_t min_int;
  uint16_t max_int;
  uint16_t latency;
  uint16_t timeout;
};

struct BleConnParamTracker {
  uint8_t peerBda[6];
  bool hasPeer;
  bool inStandby;
  bool appliedValid;
  BleConnParams applied;
};

inline BleConnParams bleConnParamsForStandby(bool standby) {
  BleConnParams p;
  if (standby) {
    p.min_int = BLE_CONN_STANDBY_MIN_INT;
    p.max_int = BLE_CONN_STANDBY_MAX_INT;
    p.latency = BLE_CONN_STANDBY_LATENCY;
  } else {
    p.min_int = BLE_CONN_ACTIVE_MIN_INT;
    p.max_int = BLE_CONN_ACTIVE_MAX_INT;
    p.latency = BLE_CONN_ACTIVE_LATENCY;
  }
  p.timeout = BLE_CONN_SUPERVISION_TIMEOUT;
  return p;
}

inline bool bleConnParamsEqual(const BleConnParams &a, const BleConnParams &b) {
  return a.min_int == b.min_int && a.max_int == b.max_int &&
         a.latency == b.latency && a.timeout == b.timeout;
}

inline void bleConnInitTracker(BleConnParamTracker &t) {
  for (int i = 0; i < 6; i++) t.peerBda[i] = 0;
  t.hasPeer = false;
  t.inStandby = false;
  t.appliedValid = false;
  t.applied = {0, 0, 0, 0};
}

inline bool bleConnTrackConnect(BleConnParamTracker &t, const uint8_t *bda, BleConnParams &out) {
  if (bda) {
    for (int i = 0; i < 6; i++) t.peerBda[i] = bda[i];
    t.hasPeer = true;
  } else {
    t.hasPeer = false;
  }
  t.appliedValid = false;
  out = bleConnParamsForStandby(t.inStandby);
  return t.hasPeer;
}

inline void bleConnTrackDisconnect(BleConnParamTracker &t) {
  t.hasPeer = false;
  t.appliedValid = false;
}

inline bool bleConnTrackStandby(BleConnParamTracker &t, bool standby, BleConnParams &out) {
  t.inStandby = standby;
  if (!t.hasPeer) return false;
  BleConnParams target = bleConnParamsForStandby(standby);
  if (t.appliedValid && bleConnParamsEqual(t.applied, target)) return false;
  out = target;
  return true;
}

inline void bleConnTrackResult(BleConnParamTracker &t, const BleConnParams &requested, bool ok) {
  if (ok) {
    t.applied = requested;
    t.appliedValid = true;
  }
}
