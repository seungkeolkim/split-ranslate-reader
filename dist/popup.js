"use strict";
(() => {
  // src/popup/popup.ts
  var btnToggle = document.getElementById("btnToggle");
  var statusText = document.getElementById("statusText");
  var currentEnabled = false;
  var currentTabId = null;
  async function checkCurrentTabState() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      updateUI(false);
      return;
    }
    currentTabId = tab.id;
    const key = `str_enabled_tab_${tab.id}`;
    chrome.storage.local.get(key, (result) => {
      const enabled = result[key] ?? false;
      currentEnabled = enabled;
      updateUI(enabled);
      updateIcon(tab.id, enabled);
    });
  }
  function updateUI(enabled) {
    if (enabled) {
      btnToggle.textContent = "Stop Split View";
      btnToggle.style.backgroundColor = "#dc3545";
      btnToggle.style.color = "#fff";
      btnToggle.style.border = "none";
      statusText.textContent = "Active";
      statusText.style.color = "#28a745";
      statusText.style.fontWeight = "bold";
    } else {
      btnToggle.textContent = "Start Split View";
      btnToggle.style.backgroundColor = "#007bff";
      btnToggle.style.color = "#fff";
      btnToggle.style.border = "none";
      statusText.textContent = "Inactive";
      statusText.style.color = "#999";
      statusText.style.fontWeight = "normal";
    }
  }
  async function toggleSplitView() {
    if (!currentTabId) return;
    const newState = !currentEnabled;
    const messageType = newState ? "START" : "STOP";
    chrome.tabs.sendMessage(currentTabId, { type: messageType });
    currentEnabled = newState;
    updateUI(newState);
    updateIcon(currentTabId, newState);
  }
  function updateIcon(tabId, enabled) {
    console.log(`[POPUP] Requesting icon update for tab ${tabId}: ${enabled ? "GREEN" : "GRAY"}`);
    chrome.runtime.sendMessage({
      type: "UPDATE_ICON",
      tabId,
      enabled
    }).then(() => {
      console.log(`[POPUP] Icon update request sent successfully`);
    }).catch((err) => {
      console.error(`[POPUP] Failed to send icon update request:`, err);
    });
  }
  btnToggle.addEventListener("click", toggleSplitView);
  checkCurrentTabState();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && currentTabId) {
      const key = `str_enabled_tab_${currentTabId}`;
      if (changes[key]) {
        currentEnabled = changes[key].newValue ?? false;
        updateUI(currentEnabled);
        updateIcon(currentTabId, currentEnabled);
      }
    }
  });
})();
//# sourceMappingURL=popup.js.map
