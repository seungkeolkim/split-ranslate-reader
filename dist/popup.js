"use strict";
(() => {
  // src/popup/popup.ts
  var select = document.getElementById("targetLang");
  var btnToggle = document.getElementById("btnToggle");
  var statusText = document.getElementById("statusText");
  var currentEnabled = false;
  var currentTabId = null;
  chrome.storage.sync.get(["targetLang"], (res) => {
    select.value = res.targetLang ?? "auto";
  });
  select.addEventListener("change", () => {
    chrome.storage.sync.set({ targetLang: select.value });
  });
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
    chrome.runtime.sendMessage({
      type: "UPDATE_ICON",
      tabId,
      enabled
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
      }
    }
  });
})();
//# sourceMappingURL=popup.js.map
