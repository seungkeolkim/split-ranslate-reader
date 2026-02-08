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
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "GET_TAB_ID") {
      const tabId = sender.tab?.id ?? null;
      console.log(`[STR-BG] GET_TAB_ID request from tab ${tabId}`);
      sendResponse({ tabId });
      return true;
    }
    if (msg.type === "LOG") {
      const logEntry = {
        timestamp: msg.timestamp,
        tabId: msg.tabId ?? sender.tab?.id,
        url: sender.tab?.url,
        data: msg.data
      };
      logBuffer.push(logEntry);
      if (logBuffer.length > MAX_LOGS) {
        logBuffer.shift();
      }
      console.log(`[STR-BG] [Tab ${logEntry.tabId}]`, ...msg.data);
    }
  });
  var logBuffer = [];
  var MAX_LOGS = 1e3;
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
