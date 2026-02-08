"use strict";
(() => {
  // src/background/background.ts
  chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(["targetLang"], (res) => {
      if (!res.targetLang) {
        chrome.storage.sync.set({ targetLang: "auto" });
      }
    });
  });
  var logBuffer = [];
  var MAX_LOGS = 1e3;
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.type === "LOG") {
      const logEntry = {
        timestamp: msg.timestamp,
        tabId: sender.tab?.id,
        url: sender.tab?.url,
        data: msg.data
      };
      logBuffer.push(logEntry);
      if (logBuffer.length > MAX_LOGS) {
        logBuffer.shift();
      }
      console.log(`[STR-BG] [Tab ${sender.tab?.id}]`, ...msg.data);
    }
  });
  globalThis.exportSTRLogs = () => {
    console.log("=== STR Background Logs ===");
    logBuffer.forEach((entry) => {
      console.log(`[${entry.timestamp}] [Tab ${entry.tabId}]`, entry.data);
    });
    console.log("===========================");
    return logBuffer;
  };
})();
//# sourceMappingURL=background.js.map
