chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["targetLang"], (res) => {
    if (!res.targetLang) {
      chrome.storage.sync.set({ targetLang: "auto" });
    }
  });
});

// =====================
// Icon Generation
// =====================

/**
 * Canvas를 사용해 동적으로 아이콘 생성
 */
function createIconImageData(size: number, color: string): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  // 배경을 투명하게
  ctx.clearRect(0, 0, size, size);
  
  // 원형 배경
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  
  // 'S' 글자
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${size * 0.6}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S', size / 2, size / 2);
  
  return ctx.getImageData(0, 0, size, size);
}

/**
 * 탭별 아이콘 상태 업데이트
 */
function updateTabIcon(tabId: number, enabled: boolean) {
  if (enabled) {
    // Active: 녹색 아이콘 (#75FA61)
    const icon16 = createIconImageData(16, '#75FA61');
    const icon32 = createIconImageData(32, '#75FA61');
    const icon48 = createIconImageData(48, '#75FA61');
    
    chrome.action.setIcon({
      tabId: tabId,
      imageData: {
        '16': icon16,
        '32': icon32,
        '48': icon48
      }
    }).catch(err => {
      console.error('[STR-BG] Failed to set active icon:', err);
    });
    
    console.log(`[STR-BG] Icon set to GREEN for tab ${tabId}`);
  } else {
    // Inactive: 회색 아이콘 (기본 상태)
    const icon16 = createIconImageData(16, '#6C757D');
    const icon32 = createIconImageData(32, '#6C757D');
    const icon48 = createIconImageData(48, '#6C757D');
    
    chrome.action.setIcon({
      tabId: tabId,
      imageData: {
        '16': icon16,
        '32': icon32,
        '48': icon48
      }
    }).catch(err => {
      console.error('[STR-BG] Failed to set inactive icon:', err);
    });
    
    console.log(`[STR-BG] Icon set to GRAY for tab ${tabId}`);
  }
}

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
      console.log(`[STR-BG] Icon updated for tab ${tabId}: ${enabled ? 'ACTIVE (green)' : 'INACTIVE (gray)'}`);
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
