chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["targetLang"], (res) => {
    if (!res.targetLang) {
      chrome.storage.sync.set({ targetLang: "auto" });
    }
  });
});

// =====================
// Log Collection (디버깅용)
// =====================
const logBuffer: any[] = [];
const MAX_LOGS = 1000;

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "LOG") {
    const logEntry = {
      timestamp: msg.timestamp,
      tabId: sender.tab?.id,
      url: sender.tab?.url,
      data: msg.data
    };
    
    logBuffer.push(logEntry);
    
    // 로그 크기 제한
    if (logBuffer.length > MAX_LOGS) {
      logBuffer.shift();
    }
    
    // 콘솔에도 출력 (background console)
    console.log(`[STR-BG] [Tab ${sender.tab?.id}]`, ...msg.data);
  }
});

// 로그 내보내기 함수 (DevTools에서 호출 가능)
(globalThis as any).exportSTRLogs = () => {
  console.log("=== STR Background Logs ===");
  logBuffer.forEach(entry => {
    console.log(`[${entry.timestamp}] [Tab ${entry.tabId}]`, entry.data);
  });
  console.log("===========================");
  return logBuffer;
};
