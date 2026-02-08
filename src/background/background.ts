chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["targetLang"], (res) => {
    if (!res.targetLang) {
      chrome.storage.sync.set({ targetLang: "auto" });
    }
  });
});

// =====================
// Tab ID 제공 & 아이콘 업데이트
// =====================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Tab ID 요청 처리
  if (msg.type === "GET_TAB_ID") {
    const tabId = sender.tab?.id ?? null;
    console.log(`[STR-BG] GET_TAB_ID request from tab ${tabId}`);
    sendResponse({ tabId: tabId });
    return true; // async response를 위해 true 반환
  }
  
  // 아이콘 업데이트 요청 처리
  if (msg.type === "UPDATE_ICON") {
    const tabId = msg.tabId ?? sender.tab?.id;
    const enabled = msg.enabled ?? false;
    
    if (tabId) {
      updateTabIcon(tabId, enabled);
      console.log(`[STR-BG] Icon updated for tab ${tabId}: ${enabled ? 'active' : 'inactive'}`);
    }
  }
  
  // 로그 수집
  if (msg.type === "LOG") {
    const logEntry = {
      timestamp: msg.timestamp,
      tabId: msg.tabId ?? sender.tab?.id,
      url: sender.tab?.url,
      data: msg.data
    };
    
    logBuffer.push(logEntry);
    
    // 로그 크기 제한
    if (logBuffer.length > MAX_LOGS) {
      logBuffer.shift();
    }
    
    // 콘솔에도 출력 (background console)
    console.log(`[STR-BG] [Tab ${logEntry.tabId}]`, ...msg.data);
  }
});

/**
 * 탭별 아이콘 상태 업데이트
 */
function updateTabIcon(tabId: number, enabled: boolean) {
  if (enabled) {
    // Active: 파란색 배지
    chrome.action.setBadgeBackgroundColor({ 
      tabId: tabId,
      color: '#007bff' 
    });
    chrome.action.setBadgeText({ 
      tabId: tabId,
      text: '●' 
    });
  } else {
    // Inactive: 배지 제거
    chrome.action.setBadgeText({ 
      tabId: tabId,
      text: '' 
    });
  }
}

// 탭이 닫힐 때 아이콘 정리
chrome.tabs.onRemoved.addListener((tabId) => {
  console.log(`[STR-BG] Tab ${tabId} closed, cleaning up`);
  // Storage 정리
  chrome.storage.local.remove(`str_enabled_tab_${tabId}`);
});

// =====================
// Log Collection (디버깅용)
// =====================
const logBuffer: any[] = [];
const MAX_LOGS = 1000;

// 로그 내보내기 함수 (DevTools에서 호출 가능)
(globalThis as any).exportSTRLogs = () => {
  console.log("=== STR Background Logs ===");
  logBuffer.forEach(entry => {
    console.log(`[${entry.timestamp}] [Tab ${entry.tabId}]`, entry.data);
  });
  console.log("===========================");
  return logBuffer;
};
