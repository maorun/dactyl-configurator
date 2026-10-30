// =============================================================================
// Editor: Event-Listener, Combo löschen, Flashen
// =============================================================================

window.deleteCombo = function(id) {
  const deletedCombo = currentConfig.combos ? currentConfig.combos.find(c => c.id === id) : null;
  currentConfig.combos = currentConfig.combos.filter(c => c.id !== id);
  renderCombosTable();
  renderMatrix();
  saveConfigToServer();
  if (deletedCombo) {
    markPendingSync({
      type: "combo_del",
      title: `Combo-Chord gelöscht`,
      description: deletedCombo.name || "Combo",
      revert: () => {
        if (!currentConfig.combos) currentConfig.combos = [];
        if (!currentConfig.combos.some(c => c.id === deletedCombo.id) && currentConfig.combos.length < MAX_COMBOS) {
          currentConfig.combos.push(deletedCombo);
        }
        renderCombosTable();
        renderMatrix();
        saveConfigToServer();
      }
    });
  }
};

function setupEventListeners() {
  // Tasten-Inspektor zurücksetzen: Button im Header oder Esc (außerhalb von Eingabefeldern)
  document.getElementById("btnClearKeySelection").addEventListener("click", clearKeySelection);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && selectedKey && !isEditableTarget(e.target)) clearKeySelection();
  });

  // Apply key inspector changes
  document.getElementById("btnApplyKey").addEventListener("click", async () => {
    if (!selectedKey) return;
    const { r, c } = selectedKey;

    while (currentConfig.layers.length <= activeLayerIndex) {
      currentConfig.layers.push(JSON.parse(JSON.stringify(currentConfig.layers[0])));
    }

    const targetLayer = activeLayerIndex;
    const layer = currentConfig.layers[targetLayer];
    if (!layer[r]) layer[r] = [];

    const labelInput = document.getElementById("keyLabelInput");
    const primarySelect = document.getElementById("primaryActionSelect");
    const holdSelect = document.getElementById("holdActionSelect");

    const label = labelInput.value.trim() || primarySelect.options[primarySelect.selectedIndex].text.split(" ")[0];
    const side = editSide;
    if (!isPhysicalKey(r, c, activeProfile())) {
      showToast(`R${r}C${c} existiert physisch nicht.`);
      return;
    }
    // Option-Zeichen (CHAR_PAIR_<i>) als Tastenpaar auflösen: gleiches Paar wiederverwenden, sonst anhängen
    const resolved = resolveCharPairActions({
      tap: primarySelect.value,
      hold: holdSelect.value,
      dtap: document.getElementById("dtapActionSelect").value
    }, currentConfig.keyPairs);
    if (!resolved) {
      showToast(`Kein Platz für ein neues Tastenpaar: maximal ${MAX_KEY_PAIRS} Paare. Lösche zuerst ein Paar.`);
      return;
    }
    const { tap, hold, dtap } = resolved.actions;
    // Neue Paare gehören zur Tastenänderung: ein eigener Revert würde ein noch genutztes Paar entfernen
    const firstAddedIdx = appendResolvedPairs(currentConfig.keyPairs, resolved.added);
    if (resolved.added.length) renderKeyPairs();

    const oldKey = JSON.parse(JSON.stringify(layer[r][c] || { label: "---", tap: "NONE", hold: "NONE" }));
    const layerName = (currentConfig.layerNames && currentConfig.layerNames[targetLayer]) || `Layer ${targetLayer}`;
    const oldDesc = oldKey.label || (oldKey.tap && oldKey.tap !== "NONE" ? oldKey.tap : "---");
    const newDesc = label || (tap && tap !== "NONE" ? tap : (hold || "---"));

    layer[r][c] = { label, tap, hold, dtap };
    renderMatrix();

    const changeRecord = {
      type: "key",
      pairs: resolved.added.length > 0,
      title: `Taste [R${r}, C${c}] (${layerName})`,
      description: `${oldDesc} ➔ ${newDesc}`,
      revert: () => {
        if (currentConfig.layers[targetLayer] && currentConfig.layers[targetLayer][r]) {
          currentConfig.layers[targetLayer][r][c] = oldKey;
          // Mitangelegte Paare entfernen, solange sie am Ende stehen und keine andere Taste sie nutzt
          if (revertResolvedPairs(currentConfig.keyPairs, currentConfig.layers, firstAddedIdx, resolved.added.length)) renderKeyPairs();
          renderMatrix();
          if (selectedKey && selectedKey.r === r && selectedKey.c === c && activeLayerIndex === targetLayer) {
            updateInspector(r, c);
          }
          saveConfigToServer();
        }
      }
    };
    if (resolved.added.length) {
      changeRecord.description += ` (neues Tastenpaar: ${resolved.added.map(p => keyPairLabel(p, keycodeLabel)).join(", ")})`;
    }

    // Vormerken; eine verbundene Hälfte bekommt sofort die vollständige Konfiguration (mit neuen Paaren und Makros)
    markPendingSync(changeRecord, side);

    saveConfigToServer(side);
  });

  // Pending Changes Drawer Event Listeners
  const pendingBadge = document.getElementById("pendingSyncBadge");
  if (pendingBadge) {
    pendingBadge.addEventListener("click", () => {
      if (pendingChanges.length > 0) {
        togglePendingChangesDrawer();
      }
    });
  }
  const btnToggleDrawer = document.getElementById("btnTogglePendingDrawer");
  if (btnToggleDrawer) {
    btnToggleDrawer.addEventListener("click", togglePendingChangesDrawer);
  }
  const btnDiscardAll = document.getElementById("btnDiscardAllPending");
  if (btnDiscardAll) {
    btnDiscardAll.addEventListener("click", discardAllPendingChanges);
  }

  // Combo Modal Events
  const comboModal = document.getElementById("comboModal");
  document.getElementById("btnOpenAddComboModal").addEventListener("click", () => {
    populateComboKeyDropdowns();
    clearSelectFilter("comboActionSelect");
    comboModal.style.display = "flex";
  });
  document.getElementById("btnCloseComboModal").addEventListener("click", () => {
    comboModal.style.display = "none";
  });
  document.getElementById("btnCancelCombo").addEventListener("click", () => {
    comboModal.style.display = "none";
  });

  document.getElementById("btnSaveCombo").addEventListener("click", () => {
    const k1Val = document.getElementById("comboKey1Select").value.split(",");
    const k2Val = document.getElementById("comboKey2Select").value.split(",");
    const behavior = document.getElementById("comboBehaviorSelect").value;
    const actionSelect = document.getElementById("comboActionSelect");
    const action = actionSelect.value;
    const actionLabel = actionSelect.options[actionSelect.selectedIndex].text;

    if (k1Val[0] === k2Val[0] && k1Val[1] === k2Val[1]) {
      alert("Taste 1 und Taste 2 dürfen nicht identisch sein!");
      return;
    }
    if (currentConfig.combos.length >= MAX_COMBOS) {
      alert(`Maximal ${MAX_COMBOS} Combos werden von der Firmware unterstützt.`);
      return;
    }
    if (behavior === "MODIFIER_HOLD" && isOneShotOrCapsWordCode(action)) {
      alert("Modifier Hold unterstützt keine One-Shot- oder Caps-Word-Aktion. Bitte \"Einzeltaste senden\" wählen.");
      return;
    }

    const r1 = parseInt(k1Val[0], 10), c1 = parseInt(k1Val[1], 10);
    const r2 = parseInt(k2Val[0], 10), c2 = parseInt(k2Val[1], 10);

    const layer = currentConfig.layers[0];
    const lbl1 = (layer[r1] && layer[r1][c1]) ? layer[r1][c1].label : `R${r1}C${c1}`;
    const lbl2 = (layer[r2] && layer[r2][c2]) ? layer[r2][c2].label : `R${r2}C${c2}`;

    const newCombo = {
      id: "combo-" + Date.now(),
      name: `${lbl1} + ${lbl2} -> ${actionLabel}`,
      key1: { r: r1, c: c1, label: lbl1 },
      key2: { r: r2, c: c2, label: lbl2 },
      behavior,
      action,
      actionLabel
    };

    currentConfig.combos.push(newCombo);
    comboModal.style.display = "none";
    renderCombosTable();
    renderMatrix();
    saveConfigToServer();

    markPendingSync({
      type: "combo_add",
      title: `Combo-Chord hinzugefügt`,
      description: newCombo.name,
      revert: () => {
        currentConfig.combos = currentConfig.combos.filter(c => c.id !== newCombo.id);
        renderCombosTable();
        renderMatrix();
        saveConfigToServer();
      }
    });
  });

  // JSON Import & Export
  document.getElementById("btnExportJson").addEventListener("click", () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentConfig, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `dactyl_config_${activeProfile().exportPrefix}${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
  });

  document.getElementById("btnImportJson").addEventListener("click", () => {
    document.getElementById("fileInput").click();
  });

  document.getElementById("fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        // Vollständig validieren, BEVOR der Zustand ersetzt oder auf dem Server gespeichert wird
        validateConfigShape(parsed, activeProfile());
        if (!confirm(`Konfiguration aus "${file.name || "Backup"}" importieren? Die aktuelle Belegung wird ersetzt (Rückgängig über die vorgemerkten Änderungen).`)) {
          return;
        }
        const oldConfig = JSON.parse(JSON.stringify(currentConfig));
        currentConfig = normalizeConfig(parsed, activeProfile());
        renderLayerButtons();
        renderMatrix();
        renderCombosTable();
        if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
        saveConfigToServer();
        markPendingSync({
          type: "import",
          snapshot: true,
          pairs: true,
          macros: true,
          title: "JSON-Konfiguration importiert",
          description: `${file.name || "Backup"} geladen`,
          revert: () => {
            currentConfig = oldConfig;
            renderLayerButtons();
            renderMatrix();
            renderCombosTable();
            if (selectedKey) updateInspector(selectedKey.r, selectedKey.c);
            saveConfigToServer();
          }
        });
      } catch (err) {
        alert("Ungültige JSON-Datei: " + err.message);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  });

  const btnWrite = document.getElementById("btnWriteConfig");
  if (btnWrite) btnWrite.addEventListener("click", writeConfigWithDiff);
  const btnRead = document.getElementById("btnReadConfig");
  if (btnRead) btnRead.addEventListener("click", readConfigFromESP32);

  const btnSaveToDactyl = document.getElementById("btnSaveToDactyl");
  if (btnSaveToDactyl) {
    btnSaveToDactyl.addEventListener("click", saveAndFlashToDactyl);
  }

  const btnSaveSettings = document.getElementById("btnSaveSettings");
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener("click", async () => {
      // Werte auf die Firmware-Bereiche begrenzen (Firmware lehnt Werte außerhalb mit ERR ARGS ab)
      const side = editSide;
      const devName = sanitizeCommandText(document.getElementById("deviceNameInput")?.value, activeProfile().deviceName);
      const debounce = clampSetting("debounceMs", parseInt(document.getElementById("debounceInput")?.value, 10));
      const comboTimeout = clampSetting("comboTimeoutMs", parseInt(document.getElementById("comboTimeoutInput")?.value, 10));
      const tappingTerm = clampSetting("tappingTermMs", parseInt(document.getElementById("tappingTermInput")?.value, 10));
      const standbyMinutes = clampSetting("standbyTimeoutMinutes", parseInt(document.getElementById("standbyTimeoutSelect")?.value, 10));
      const sleepMinutes = clampSetting("sleepTimeoutMinutes", parseInt(document.getElementById("sleepTimeoutSelect")?.value, 10));
      const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
      setVal("deviceNameInput", devName);
      setVal("debounceInput", debounce);
      setVal("comboTimeoutInput", comboTimeout);
      setVal("tappingTermInput", tappingTerm);

      const oldSettings = JSON.parse(JSON.stringify(currentConfig.settings || {}));

      currentConfig.settings = {
        deviceName: devName,
        debounceMs: debounce,
        comboTimeoutMs: comboTimeout,
        tappingTermMs: tappingTerm,
        standbyTimeoutMinutes: standbyMinutes,
        sleepTimeoutMinutes: sleepMinutes
      };

      saveConfigToServer();

      const changeRecord = {
        type: "settings",
        snapshot: true,
        title: `Einstellungen & Timeouts`,
        description: `Standby: ${standbyMinutes}m, Sleep: ${sleepMinutes}m, Name: "${devName}"`,
        revert: () => {
          currentConfig.settings = oldSettings;
          applySettingsToInputs(oldSettings);
          saveConfigToServer();
        }
      };

      // Vormerken; eine verbundene Hälfte bekommt sofort die vollständige Konfiguration
      markPendingSync(changeRecord, side);
    });
  }
}

async function saveAndFlashToDactyl() {
  const btn = document.getElementById("btnSaveToDactyl");
  if (!btn) return;

  // Hälfte und Config beim Klick festhalten: ein Wechsel der Hälfte während des Flashens ändert nichts
  const side = editSide;
  const profile = SIDE_PROFILES[side];
  const cfg = currentConfig;
  const syncedChangeIds = new Set(pendingChanges.map(c => c.id));
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-icon">⏳</span> Flashe ${profile.label}... (ca. 15s)`;

  const hadSerial = !!serialPort;
  if (hadSerial) {
    showToast("Trenne USB-Monitor kurz fürs Flashen...");
    await disconnectSerial();
    await new Promise(r => setTimeout(r, 150));
  }

  showToast(`Kompiliere & Flashe Firmware auf die ${profile.label}... Bitte warten.`);
  const flashLog = openFlashLogDialog(profile);
  // Warnungen der Layout-Prüfung stehen im Protokoll; das Flashen läuft trotzdem
  logLayoutLintToFlashLog(flashLog);

  try {
    // Der Server wählt den USB-Port, dessen Board sich per DEVICE_INFO als diese Hälfte meldet.
    // stream=1: arduino-cli-Ausgabe kommt zeilenweise als NDJSON, das Ergebnis als letzte Zeile.
    const res = await fetch(`/api/save_and_flash?side=${side}&stream=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg)
    });

    let data = {};
    if ((res.headers.get("Content-Type") || "").includes("application/x-ndjson") && res.body) {
      data = (await readFlashStream(res.body, flashLog.onEvent)) || { success: false, error: "Verbindung zum Server vor dem Ergebnis beendet." };
    } else {
      // Validierungsfehler vor dem Start kommen als normales JSON
      try { data = await res.json(); } catch (_) {}
    }
    if (res.ok && data.success) {
      flashLog.finish(true);
      firmwareVersions.forget(side);
      updateFirmwareVersionUI();
      if (hadSerial) {
        try {
          await new Promise(r => setTimeout(r, 1200)); // ESP32 Reboot nach Flashen abwarten
          // Ohne User-Geste ist requestPort() nicht erlaubt: bereits freigegebenen Port wiederverwenden
          await connectSerial({ reuseGrantedPort: true });
          if (serialPort && serialPort.writable && await waitForSerialSide(side, 2500)) {
            if (cfg.settings) {
              const sb = cfg.settings.standbyTimeoutMinutes ?? 5;
              const sl = cfg.settings.sleepTimeoutMinutes ?? 60;
              await sendSerialCommand(`SET_STANDBY ${sb}`);
              await sendSerialCommand(`SET_SLEEP ${sl}`);
            }
            for (let l = 0; l < cfg.layerNames.length; l++) {
              await sendSerialCommand(`SET_NAME ${l} ${sanitizeCommandText(cfg.layerNames[l], DEFAULT_LAYER_NAMES[l])}`);
            }
          }
        } catch (reconnectErr) {
          console.warn("Serial reconnect nach Flashen fehlgeschlagen:", reconnectErr);
        }
      }
      // Nur die beim Klick vorgemerkten Änderungen dieser Hälfte verwerfen
      setPendingFor(side, pendingFor(side).filter(c => !syncedChangeIds.has(c.id)));
      if (side === editSide) renderPendingSyncUI();
      showToast(`✅ ${profile.label} erfolgreich geflasht!`);
      alert(`✅ Erfolgreich auf die ${profile.label} gespeichert (${data.port || "USB"})!\n\nDie Firmware wurde aktualisiert. Die Hälfte startet jetzt mit der neuen Tastenbelegung.`);
    } else {
      const errMsg = data.error || (data.stage ? `Fehler in Phase '${data.stage}'` : "Unbekannter Fehler");
      flashLog.finish(false, data.stage ? `Fehler in Phase: ${flashStageLabel(data.stage)}` : "Flashen fehlgeschlagen");
      showToast("❌ Fehler beim Flashen!");
      alert("Fehler beim Flashen auf den ESP32:\n\n" + errMsg);
    }
  } catch (err) {
    console.error("Flash error:", err);
    flashLog.finish(false, "Server nicht erreichbar");
    showToast("❌ Server nicht erreichbar!");
    alert("Netzwerkfehler: Konnte /api/save_and_flash nicht erreichen.\nLäuft python3 server.py?");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function populateComboKeyDropdowns() {
  const s1 = document.getElementById("comboKey1Select");
  const s2 = document.getElementById("comboKey2Select");
  s1.innerHTML = "";
  s2.innerHTML = "";

  const layer = currentConfig.layers[0];
  const profile = activeProfile();
  for (let r = 0; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      if (!isPhysicalKey(r, c, profile)) continue;
      const k = layer[r] && layer[r][c];
      const lbl = k ? k.label : `R${r}C${c}`;
      const isThumb = (r === 5);
      const optText = `[R${r}, C${c}] ${lbl} ${isThumb ? '(Daumen)' : ''}`;

      const o1 = document.createElement("option");
      o1.value = `${r},${c}`;
      o1.textContent = optText;
      s1.appendChild(o1);

      const o2 = document.createElement("option");
      o2.value = `${r},${c}`;
      o2.textContent = optText;
      s2.appendChild(o2);
    }
  }

  s1.value = "2,1"; // J
  s2.value = "2,2"; // K
}
