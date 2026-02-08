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
  function createIconImageData(size, color) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get canvas context");
    }
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${size * 0.6}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("S", size / 2, size / 2);
    return ctx.getImageData(0, 0, size, size);
  }
  function updateTabIcon(tabId, enabled) {
    if (enabled) {
      const icon16 = createIconImageData(16, "#35a324");
      const icon32 = createIconImageData(32, "#35a324");
      const icon48 = createIconImageData(48, "#35a324");
      chrome.action.setIcon({
        tabId,
        imageData: {
          "16": icon16,
          "32": icon32,
          "48": icon48
        }
      }).catch((err) => {
        console.error("[STR-BG] Failed to set active icon:", err);
      });
      console.log(`[STR-BG] Icon set to GREEN for tab ${tabId}`);
    } else {
      const icon16 = createIconImageData(16, "#6C757D");
      const icon32 = createIconImageData(32, "#6C757D");
      const icon48 = createIconImageData(48, "#6C757D");
      chrome.action.setIcon({
        tabId,
        imageData: {
          "16": icon16,
          "32": icon32,
          "48": icon48
        }
      }).catch((err) => {
        console.error("[STR-BG] Failed to set inactive icon:", err);
      });
      console.log(`[STR-BG] Icon set to GRAY for tab ${tabId}`);
    }
  }
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "GET_TAB_ID") {
      const tabId = sender.tab?.id ?? null;
      console.log(`[STR-BG] GET_TAB_ID request from tab ${tabId}`);
      sendResponse({ tabId });
      return true;
    }
    if (msg.type === "UPDATE_ICON") {
      const tabId = msg.tabId ?? sender.tab?.id;
      const enabled = msg.enabled ?? false;
      if (tabId) {
        updateTabIcon(tabId, enabled);
        console.log(`[STR-BG] Icon updated for tab ${tabId}: ${enabled ? "ACTIVE (green)" : "INACTIVE (gray)"}`);
      }
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
  chrome.tabs.onRemoved.addListener((tabId) => {
    console.log(`[STR-BG] Tab ${tabId} closed, cleaning up`);
    chrome.storage.local.remove(`str_enabled_tab_${tabId}`);
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
