#pragma once
/*
 * DactylConfigBleCallbacks.h — GATT-Callbacks des Config-Service beider Hälften.
 *
 * Vor DactylBleComposite.h bzw. vor dem Config-Service einbinden. Braucht die Deklarationen
 * handleConfigCommand(String, bool), isBleTransitioning und exitConfigRequested.
 */

class ConfigCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) override {
    String val = pChar->getValue().c_str();
    handleConfigCommand(val, true);
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
