"use strict";
(() => {
  // src/background/background.ts
  function updateTabIcon(tabId, enabled) {
    console.log(`[STR-BG] updateTabIcon() called - tabId: ${tabId}, enabled: ${enabled}`);
    if (enabled) {
      const iconPath = {
        "16": "icons/icon-active-16.png",
        "32": "icons/icon-active-32.png",
        "48": "icons/icon-active-48.png",
        "128": "icons/icon-active-128.png"
      };
      console.log(`[STR-BG] Setting GREEN icon for tab ${tabId}`, iconPath);
      chrome.action.setIcon({
        tabId,
        path: iconPath
      }).then(() => {
        console.log(`[STR-BG] \u2705 GREEN icon set successfully for tab ${tabId}`);
      }).catch((err) => {
        console.error(`[STR-BG] \u274C Failed to set active icon for tab ${tabId}:`, err);
      });
    } else {
      const iconPath = {
        "16": "icons/icon-inactive-16.png",
        "32": "icons/icon-inactive-32.png",
        "48": "icons/icon-inactive-48.png",
        "128": "icons/icon-inactive-128.png"
      };
      console.log(`[STR-BG] Setting GRAY icon for tab ${tabId}`, iconPath);
      chrome.action.setIcon({
        tabId,
        path: iconPath
      }).then(() => {
        console.log(`[STR-BG] \u2705 GRAY icon set successfully for tab ${tabId}`);
      }).catch((err) => {
        console.error(`[STR-BG] \u274C Failed to set inactive icon for tab ${tabId}:`, err);
      });
    }
  }
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log(`[STR-BG] Message received:`, msg, `from tab:`, sender.tab?.id);
    if (msg.type === "GET_TAB_ID") {
      const tabId = sender.tab?.id ?? null;
      console.log(`[STR-BG] GET_TAB_ID request from tab ${tabId}`);
      sendResponse({ tabId });
      return true;
    }
    if (msg.type === "UPDATE_ICON") {
      const tabId = msg.tabId ?? sender.tab?.id;
      const enabled = msg.enabled ?? false;
      console.log(`[STR-BG] \u{1F4E8} UPDATE_ICON received - tabId: ${tabId}, enabled: ${enabled}`);
      if (tabId) {
        updateTabIcon(tabId, enabled);
        console.log(`[STR-BG] Icon update processed for tab ${tabId}: ${enabled ? "ACTIVE (green)" : "INACTIVE (gray)"}`);
      } else {
        console.error(`[STR-BG] \u274C Cannot update icon: tabId is null`);
      }
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
