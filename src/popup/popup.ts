// 변수 선언
const btnToggle = document.getElementById("btnToggle") as HTMLButtonElement;
const statusText = document.getElementById("statusText") as HTMLSpanElement;

// 현재 탭의 상태 저장
let currentEnabled = false;
let currentTabId: number | null = null;

// 현재 탭의 활성화 상태 확인
async function checkCurrentTabState() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    updateUI(false);
    return;
  }

  currentTabId = tab.id;
  
  // Storage에서 현재 탭의 상태 확인
  const key = `str_enabled_tab_${tab.id}`;
  chrome.storage.local.get(key, (result) => {
    const enabled = result[key] ?? false;
    currentEnabled = enabled;
    updateUI(enabled);
    
    // 아이콘도 현재 상태로 업데이트
    updateIcon(tab.id, enabled);
  });
}

// UI 업데이트
function updateUI(enabled: boolean) {
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

// 토글 버튼 클릭
async function toggleSplitView() {
  if (!currentTabId) return;
  
  const newState = !currentEnabled;
  const messageType = newState ? "START" : "STOP";
  
  // Content script에 메시지 전송
  chrome.tabs.sendMessage(currentTabId, { type: messageType });
  
  // UI 즉시 업데이트
  currentEnabled = newState;
  updateUI(newState);
  
  // Icon 업데이트 (가능한 경우)
  updateIcon(currentTabId, newState);
}

// Icon 상태 업데이트
function updateIcon(tabId: number, enabled: boolean) {
  console.log(`[POPUP] Requesting icon update for tab ${tabId}: ${enabled ? 'GREEN' : 'GRAY'}`);
  
  // Background에 아이콘 업데이트 요청
  chrome.runtime.sendMessage({
    type: "UPDATE_ICON",
    tabId: tabId,
    enabled: enabled
  }).then(() => {
    console.log(`[POPUP] Icon update request sent successfully`);
  }).catch(err => {
    console.error(`[POPUP] Failed to send icon update request:`, err);
  });
}

btnToggle.addEventListener("click", toggleSplitView);

// Popup이 열릴 때 상태 확인
checkCurrentTabState();

// Storage 변경 감지 (다른 곳에서 상태가 변경되면 UI 업데이트)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && currentTabId) {
    const key = `str_enabled_tab_${currentTabId}`;
    if (changes[key]) {
      currentEnabled = changes[key].newValue ?? false;
      updateUI(currentEnabled);
      // 아이콘도 업데이트
      updateIcon(currentTabId, currentEnabled);
    }
  }
});