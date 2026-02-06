"use strict";
(() => {
  // src/popup/popup.ts
  var select = document.getElementById("targetLang");
  var btnStart = document.getElementById("btnStart");
  var btnStop = document.getElementById("btnStop");
  chrome.storage.sync.get(["targetLang"], (res) => {
    select.value = res.targetLang ?? "auto";
  });
  select.addEventListener("change", () => {
    chrome.storage.sync.set({ targetLang: select.value });
  });
  async function sendToActiveTab(type) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type });
  }
  btnStart.addEventListener("click", () => {
    sendToActiveTab("START");
  });
  btnStop.addEventListener("click", () => {
    sendToActiveTab("STOP");
  });
})();
//# sourceMappingURL=popup.js.map
