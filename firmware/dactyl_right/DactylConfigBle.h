#pragma once
/*
 * DactylConfigBle.h — isolierter BLE-Config-Server (Config Mode) beider Hälften.
 *
 * Nach DactylLogic.h und DactylConfigBleCallbacks.h einbinden. Braucht pConfigCharacteristic,
 * CONFIG_SERVICE_UUID, CONFIG_CHARACTERISTIC_UUID und CONFIG_BLE_NAME (BLE-Name im Config Mode).
 * Ohne HID-Dienst und ohne Bonding, damit ein gespeicherter macOS-Bond unangetastet bleibt.
 */

void startConfigModeBle() {
  Serial.println("=============================================");
  Serial.println("  [CONFIG MODE] Isolierter BLE-Config-Server");
  Serial.printf("  Name: '%s' (Ohne HID / Ohne SMP)\n", CONFIG_BLE_NAME);
  Serial.println("=============================================");

  BLEDevice::init(CONFIG_BLE_NAME);

  // Wichtig: Keine Verschlüsselung/Bonding im Config-Modus erzwingen!
  // Da bleKeyboard.begin() nicht aufgerufen wurde, ist m_securityEnabled ohnehin false;
  // zusätzlich deaktivieren wir ForceAuthentication explizit, damit der gespeicherte
  // macOS HID-Bond in Bluedroid unangetastet bleibt.
  BLESecurity *pSecurity = new BLESecurity();
  pSecurity->setForceAuthentication(false);
  delete pSecurity;

  esp_bd_addr_t randAddr;
  esp_read_mac(randAddr, ESP_MAC_BT);
  randAddr[0] |= 0xC0;
  randAddr[5] |= 0xC0;
  randAddr[4] ^= 0x55;

  esp_err_t errSet = esp_ble_gap_set_rand_addr(randAddr);
  Serial.printf("[CONFIG BLE] Random-MAC: %02X:%02X:%02X:%02X:%02X:%02X (rc=%d)\n",
    randAddr[0], randAddr[1], randAddr[2], randAddr[3], randAddr[4], randAddr[5], errSet);

  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ConfigServerCallbacks());

  BLEService *pConfigService = pServer->createService(CONFIG_SERVICE_UUID);
  pConfigCharacteristic = pConfigService->createCharacteristic(
    CONFIG_CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pConfigCharacteristic->setAccessPermissions(ESP_GATT_PERM_READ | ESP_GATT_PERM_WRITE);
  pConfigCharacteristic->setCallbacks(new ConfigCallbacks());
  pConfigCharacteristic->addDescriptor(new BLE2902());
  pConfigService->start();

  BLEAdvertising *pAdv = pServer->getAdvertising();
  pAdv->setDeviceAddress(randAddr, BLE_ADDR_TYPE_RANDOM);
  esp_ble_gap_set_device_name(CONFIG_BLE_NAME);

  BLEAdvertisementData advData;
  advData.setFlags(0x06);
  advData.setName(CONFIG_BLE_NAME);

  BLEAdvertisementData scanData;
  scanData.setCompleteServices(BLEUUID(CONFIG_SERVICE_UUID));

  pAdv->setAppearance(0x0000);
  pAdv->setAdvertisementData(advData);
  pAdv->setScanResponseData(scanData);
  pAdv->setScanResponse(true);
  pAdv->start();

  Serial.println("MODE:CONFIG");
  Serial.printf("[CONFIG BLE] Advertising als '%s' aktiv!\n", CONFIG_BLE_NAME);
  Serial.flush();
}
