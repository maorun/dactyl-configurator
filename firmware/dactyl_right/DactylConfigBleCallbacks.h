#pragma once
/*
 * DactylConfigBleCallbacks.h — GATT-Callbacks des Config-Service beider Hälften.
 *
 * Vor DactylBleComposite.h bzw. vor dem Config-Service einbinden. Braucht die Deklarationen
 * handleConfigCommand(String, bool), isBleTransitioning und exitConfigRequested.
 */

void handleConfigCommand(String cmd, bool fromBle);
void handleOtaChunk(const uint8_t *data, size_t len);

class ConfigCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) override {
    String val = pChar->getValue().c_str();
    handleConfigCommand(val, true);
  }
};

class OtaCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) override {
    size_t len = pChar->getLength();
    const uint8_t *data = pChar->getData();
    handleOtaChunk(data, len);
  }
};

class ConfigServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) override {
    Serial.println("[CONFIG BLE] Web-App verbunden!");
  }
  void onDisconnect(BLEServer *pServer) override {
    Serial.println("[CONFIG BLE] Web-App getrennt.");
    if (!isBleTransitioning && !exitConfigRequested) {
      pServer->getAdvertising()->start();
    }
  }
};
