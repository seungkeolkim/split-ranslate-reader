"use strict";
(() => {
  // src/popup/popup.ts
  var select = document.getElementById("targetLang");
  var toggle = document.getElementById("toggle");
  chrome.storage.sync.get(["targetLang"], (res) => {
    select.value = res.targetLang ?? "auto";
  });
  select.addEventListener("change", () => {
    chrome.storage.sync.set({ targetLang: select.value });
  });
  toggle.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAY" });
    }
  });
})();
//# sourceMappingURL=popup.js.map
