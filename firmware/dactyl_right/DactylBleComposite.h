#pragma once

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include <BLEHIDDevice.h>
#include <BLESecurity.h>
#include "HIDTypes.h"
#include "Print.h"
#include <BleKeyboard.h>

extern const uint8_t _asciimap[128];

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
  LOGICAL_MAXIMUM(1), 0x65,          //   LOGICAL_MAXIMUM(0x65)
  USAGE_PAGE(1),      0x07,          //   USAGE_PAGE (Kbrd/Keypad)
  USAGE_MINIMUM(1),   0x00,          //   USAGE_MINIMUM (0)
  USAGE_MAXIMUM(1),   0x65,          //   USAGE_MAXIMUM (0x65)
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

class DactylBleSecurityCallbacks : public BLESecurityCallbacks {
  bool onSecurityRequest() override { return true; }
  void onAuthenticationComplete(esp_ble_auth_cmpl_t auth_cmpl) override {
    if (auth_cmpl.success) {
      Serial.println("[BLE] Pairing successful!");
    } else {
      Serial.printf("[BLE] Pairing failed, reason: 0x%x\n", auth_cmpl.fail_reason);
    }
  }
  uint32_t onPassKeyRequest() override { return 0; }
  void onPassKeyNotify(uint32_t pass_key) override {}
  bool onConfirmPIN(uint32_t pass_key) override { return true; }
  bool onAuthorizationRequest(uint16_t connHandle, uint16_t attrHandle, bool isRead) override { return true; }
};

class DactylBleComposite : public Print, public BLEServerCallbacks, public BLECharacteristicCallbacks {
protected:
  BLEHIDDevice*       hid;
  BLECharacteristic*  inputKeyboard;
  BLECharacteristic*  outputKeyboard;
  BLECharacteristic*  inputMediaKeys;
  BLECharacteristic*  inputMouse;
  BLEAdvertising*     advertising;
  KeyReport           _keyReport;
  MediaKeyReport      _mediaKeyReport;
  uint8_t             _mouseButtons;
  std::string         deviceName;
  std::string         deviceManufacturer;
  uint8_t             batteryLevel;
  bool                connected;

  uint16_t vid;
  uint16_t pid;
  uint16_t version;

  virtual void onStarted(BLEServer *pServer) {}

public:
  DactylBleComposite(std::string name = "Dactyl Keyboard", std::string mfr = "Dactyl DIY", uint8_t batt = 100)
    : hid(nullptr)
    , inputKeyboard(nullptr)
    , outputKeyboard(nullptr)
    , inputMediaKeys(nullptr)
    , inputMouse(nullptr)
    , advertising(nullptr)
    , _mouseButtons(0)
    , deviceName(name.substr(0, 31))
    , deviceManufacturer(mfr.substr(0, 31))
    , batteryLevel(batt)
    , connected(false)
    , vid(0x05ac)
    , pid(0x820a)
    , version(0x0210)
  {
    memset(&_keyReport, 0, sizeof(KeyReport));
    memset(&_mediaKeyReport, 0, sizeof(MediaKeyReport));
  }

  void begin() {
    BLEDevice::init(String(deviceName.c_str()));
    BLEServer* pServer = BLEDevice::createServer();
    pServer->setCallbacks(this);

    hid = new BLEHIDDevice(pServer);
    inputKeyboard = hid->inputReport(KEYBOARD_ID);
    outputKeyboard = hid->outputReport(KEYBOARD_ID);
    inputMediaKeys = hid->inputReport(MEDIA_KEYS_ID);
    inputMouse = hid->inputReport(MOUSE_ID);

    outputKeyboard->setCallbacks(this);

    hid->manufacturer()->setValue(String(deviceManufacturer.c_str()));
    hid->pnp(0x02, vid, pid, version);
    hid->hidInfo(0x00, 0x01);

    BLEDevice::setSecurityCallbacks(new DactylBleSecurityCallbacks());
    BLESecurity* pSecurity = new BLESecurity();
    pSecurity->setCapability(ESP_IO_CAP_NONE);
    pSecurity->setAuthenticationMode(true, false, true);
    pSecurity->setInitEncryptionKey(ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK);
    pSecurity->setRespEncryptionKey(ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK);

    hid->reportMap((uint8_t*)_compositeReportDescriptor, sizeof(_compositeReportDescriptor));
    hid->startServices();

    onStarted(pServer);

    advertising = pServer->getAdvertising();
    advertising->setAppearance(HID_KEYBOARD);
    advertising->addServiceUUID(hid->hidService()->getUUID());
    advertising->setScanResponse(true);
    advertising->start();
    hid->setBatteryLevel(batteryLevel);

    Serial.println("[BLE] Composite HID Advertising gestartet.");
  }

  void end() {}

  bool isConnected() const {
    return this->connected;
  }

  void setBatteryLevel(uint8_t level) {
    this->batteryLevel = level;
    if (hid != nullptr) {
      hid->setBatteryLevel(this->batteryLevel);
    }
  }

  void sendReport(KeyReport* keys) {
    if (this->isConnected() && inputKeyboard != nullptr) {
      inputKeyboard->setValue((uint8_t*)keys, sizeof(KeyReport));
      inputKeyboard->notify();
    }
  }

  void sendReport(MediaKeyReport* keys) {
    if (this->isConnected() && inputMediaKeys != nullptr) {
      inputMediaKeys->setValue((uint8_t*)keys, sizeof(MediaKeyReport));
      inputMediaKeys->notify();
    }
  }

  void sendMouseReport(uint8_t buttons, int8_t x, int8_t y, int8_t wheel) {
    if (this->isConnected() && inputMouse != nullptr) {
      uint8_t m[4] = { buttons, (uint8_t)x, (uint8_t)y, (uint8_t)wheel };
      inputMouse->setValue(m, sizeof(m));
      inputMouse->notify();
    }
  }

  size_t press(uint8_t k) {
    uint8_t i;
    if (k >= 136) { // Non-printing key
      k = k - 136;
    } else if (k >= 128) { // Modifier key
      _keyReport.modifiers |= (1 << (k - 128));
      k = 0;
    } else { // Printing key
      k = pgm_read_byte(_asciimap + k);
      if (!k) {
        return 0;
      }
      if (k & 0x80) { // Capital letter / shifted char
        _keyReport.modifiers |= 0x02;
        k &= 0x7F;
      }
    }

    if (k != 0 && _keyReport.keys[0] != k && _keyReport.keys[1] != k &&
        _keyReport.keys[2] != k && _keyReport.keys[3] != k &&
        _keyReport.keys[4] != k && _keyReport.keys[5] != k) {
      for (i = 0; i < 6; i++) {
        if (_keyReport.keys[i] == 0x00) {
          _keyReport.keys[i] = k;
          break;
        }
      }
      if (i == 6) {
        return 0;
      }
    }
    sendReport(&_keyReport);
    return 1;
  }

  size_t release(uint8_t k) {
    uint8_t i;
    if (k >= 136) {
      k = k - 136;
    } else if (k >= 128) {
      _keyReport.modifiers &= ~(1 << (k - 128));
      k = 0;
    } else {
      k = pgm_read_byte(_asciimap + k);
      if (!k) {
        return 0;
      }
      if (k & 0x80) {
        _keyReport.modifiers &= ~(0x02);
        k &= 0x7F;
      }
    }

    if (k != 0) {
      for (i = 0; i < 6; i++) {
        if (_keyReport.keys[i] == k) {
          _keyReport.keys[i] = 0x00;
        }
      }
    }

    sendReport(&_keyReport);
    return 1;
  }

  size_t write(uint8_t c) override {
    uint8_t p = press(c);
    release(c);
    return p;
  }

  size_t write(const uint8_t *buffer, size_t size) override {
    size_t n = 0;
    while (size--) {
      if (*buffer != '\r') {
        if (write(*buffer)) {
          n++;
        } else {
          break;
        }
      }
      buffer++;
    }
    return n;
  }

  size_t press(const MediaKeyReport k) {
    uint16_t k_16 = k[1] | (k[0] << 8);
    uint16_t mediaKeyReport_16 = _mediaKeyReport[1] | (_mediaKeyReport[0] << 8);
    mediaKeyReport_16 |= k_16;
    _mediaKeyReport[0] = (uint8_t)((mediaKeyReport_16 & 0xFF00) >> 8);
    _mediaKeyReport[1] = (uint8_t)(mediaKeyReport_16 & 0x00FF);
    sendReport(&_mediaKeyReport);
    return 1;
  }

  size_t release(const MediaKeyReport k) {
    uint16_t k_16 = k[1] | (k[0] << 8);
    uint16_t mediaKeyReport_16 = _mediaKeyReport[1] | (_mediaKeyReport[0] << 8);
    mediaKeyReport_16 &= ~k_16;
    _mediaKeyReport[0] = (uint8_t)((mediaKeyReport_16 & 0xFF00) >> 8);
    _mediaKeyReport[1] = (uint8_t)(mediaKeyReport_16 & 0x00FF);
    sendReport(&_mediaKeyReport);
    return 1;
  }

  size_t write(const MediaKeyReport c) {
    size_t p = press(c);
    release(c);
    return p;
  }

  // --- Mouse Methods ---
  void mousePress(uint8_t button) {
    _mouseButtons |= button;
    sendMouseReport(_mouseButtons, 0, 0, 0);
  }

  void mouseRelease(uint8_t button) {
    _mouseButtons &= ~button;
    sendMouseReport(_mouseButtons, 0, 0, 0);
  }

  void mouseClick(uint8_t button) {
    mousePress(button);
    delay(10);
    mouseRelease(button);
  }

  void mouseScroll(int8_t wheel) {
    sendMouseReport(_mouseButtons, 0, 0, wheel);
  }

  void mouseMove(int8_t x, int8_t y, int8_t wheel = 0) {
    sendMouseReport(_mouseButtons, x, y, wheel);
  }

  void releaseAll() {
    for (int i = 0; i < 6; i++) {
      _keyReport.keys[i] = 0;
    }
    _keyReport.modifiers = 0;
    _keyReport.reserved = 0;
    _mediaKeyReport[0] = 0;
    _mediaKeyReport[1] = 0;
    _mouseButtons = 0;
    sendReport(&_keyReport);
    sendReport(&_mediaKeyReport);
    sendMouseReport(0, 0, 0, 0);
  }

  void onConnect(BLEServer* pServer) override {
    this->connected = true;
    if (inputKeyboard != nullptr) {
      BLE2902* desc = (BLE2902*)inputKeyboard->getDescriptorByUUID(BLEUUID((uint16_t)0x2902));
      if (desc) desc->setNotifications(true);
    }
    if (inputMediaKeys != nullptr) {
      BLE2902* desc = (BLE2902*)inputMediaKeys->getDescriptorByUUID(BLEUUID((uint16_t)0x2902));
      if (desc) desc->setNotifications(true);
    }
    if (inputMouse != nullptr) {
      BLE2902* desc = (BLE2902*)inputMouse->getDescriptorByUUID(BLEUUID((uint16_t)0x2902));
      if (desc) desc->setNotifications(true);
    }
  }

  void onDisconnect(BLEServer* pServer) override {
    this->connected = false;
    if (inputKeyboard != nullptr) {
      BLE2902* desc = (BLE2902*)inputKeyboard->getDescriptorByUUID(BLEUUID((uint16_t)0x2902));
      if (desc) desc->setNotifications(false);
    }
    if (inputMediaKeys != nullptr) {
      BLE2902* desc = (BLE2902*)inputMediaKeys->getDescriptorByUUID(BLEUUID((uint16_t)0x2902));
      if (desc) desc->setNotifications(false);
    }
    if (inputMouse != nullptr) {
      BLE2902* desc = (BLE2902*)inputMouse->getDescriptorByUUID(BLEUUID((uint16_t)0x2902));
      if (desc) desc->setNotifications(false);
    }
    if (advertising) {
      advertising->start();
    }
  }

  void onWrite(BLECharacteristic* me) override {}
};
