type Msg =
  | { type: "START" }
  | { type: "STOP" };

let enabled = false;

let splitRoot: HTMLDivElement | null = null;
let leftPane: HTMLDivElement | null = null;
let rightPane: HTMLDivElement | null = null;

let leftIframe: HTMLIFrameElement | null = null;

let originalSnapshotBodyHTML: string | null = null;
let originalSnapshotHeadHTML: string | null = null;

const SPLIT_LEFT_RATIO = 0.5; // 좌/우 50:50

// =====================
// Strategy 3: Navigation tracking
// =====================
let currentURL = location.href;
let navigationDetector: NodeJS.Timeout | null = null;

// =====================
// Tab-specific State Management
// =====================
let currentTabId: number | null = null;

// Storage key는 탭별로 구분
function getStorageKey(): string {
  return `str_enabled_tab_${currentTabId}`;
}

// =====================
// LOG (삭제 금지)
// =====================
const logHistory: string[] = [];

function log(...args: any[]) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  const message = `[${timestamp}] [Tab ${currentTabId}] [STR-DBG] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`;
  console.log(`[STR-DBG] [Tab ${currentTabId}]`, ...args);
  
  // 로그 히스토리에 저장 (최대 500개)
  logHistory.push(message);
  if (logHistory.length > 500) {
    logHistory.shift();
  }
  
  // Background에 로그 전송 (영구 보관용)
  try {
    chrome.runtime.sendMessage({
      type: "LOG",
      timestamp: timestamp,
      tabId: currentTabId,
      data: args
    }).catch(() => {
      // Background가 없으면 무시
    });
  } catch (e) {
    // 무시
  }
}

// 로그 히스토리를 콘솔에 출력하는 함수
(window as any).showSTRLogs = () => {
  console.log("=== STR Log History ===");
  logHistory.forEach(log => console.log(log));
  console.log("======================");
};

// =====================
// State Management (탭별로 상태 유지)
// =====================

/**
 * 현재 탭의 enabled 상태를 storage에 저장
 */
async function saveEnabledState(value: boolean) {
  if (currentTabId === null) {
    log("⚠️ Cannot save state: tabId not initialized");
    return;
  }
  
  const key = getStorageKey();
  log("💾 Saving enabled state to storage:", { key, value });
  try {
    await chrome.storage.local.set({ [key]: value });
    log("✅ State saved successfully");
    
    // 아이콘 상태 업데이트
    updateIconState(value);
  } catch (e) {
    log("❌ Failed to save state:", e);
  }
}

/**
 * 아이콘 상태 업데이트 (background에 요청)
 */
function updateIconState(enabled: boolean) {
  if (currentTabId === null) {
    log("⚠️ Cannot update icon: tabId is null");
    return;
  }
  
  log("🎨 Sending icon update request to background", { 
    tabId: currentTabId, 
    enabled: enabled 
  });
  
  chrome.runtime.sendMessage({
    type: "UPDATE_ICON",
    tabId: currentTabId,
    enabled: enabled
  }).then(() => {
    log("✅ Icon update request sent successfully");
  }).catch((e) => {
    log("❌ Failed to send icon update request:", e);
  });
}

/**
 * 현재 탭의 enabled 상태를 storage에서 복원
 */
async function restoreEnabledState(): Promise<boolean> {
  if (currentTabId === null) {
    log("⚠️ Cannot restore state: tabId not initialized");
    return false;
  }
  
  const key = getStorageKey();
  log("📂 Restoring enabled state from storage...", { key });
  try {
    const result = await chrome.storage.local.get(key);
    const savedState = result[key] ?? false;
    log("✅ State restored:", savedState);
    return savedState;
  } catch (e) {
    log("❌ Failed to restore state:", e);
    return false;
  }
}

/**
 * 현재 탭 ID를 가져오기
 */
async function getCurrentTabId(): Promise<number | null> {
  try {
    // chrome.tabs.getCurrent()는 content script에서 사용 불가
    // 대신 background에 요청하거나 다른 방법 사용
    const response = await chrome.runtime.sendMessage({ type: "GET_TAB_ID" });
    return response?.tabId ?? null;
  } catch (e) {
    log("❌ Failed to get tab ID:", e);
    return null;
  }
}

// =====================
// Paragraph / Block Utils
// =====================

// 확장된 블록 셀렉터: 텍스트를 포함할 수 있는 모든 요소
const BLOCK_SELECTOR = [
  // 기본 텍스트 블록
  "p", "li", "h1", "h2", "h3", "h4", "h5", "h6",
  // 테이블 관련
  "td", "th", "caption",
  // 코드 블록
  "pre", "code",
  // 인용
  "blockquote", "q",
  // 정의 리스트
  "dd", "dt",
  // 기타 텍스트 컨테이너
  "figcaption", "summary", "label",
  // div, span은 텍스트가 직접 있는 경우만
  "div", "span", "a",
  // 기사/섹션
  "article", "section", "aside", "nav", "header", "footer"
].join(", ");

/**
 * 텍스트 노드가 있는 실제 블록 요소인지 확인
 */
function isValidTextBlock(element: HTMLElement): boolean {
  // innerText가 충분히 긴지 확인 (최소 20자 - collectBlocks와 일관성)
  const text = element.innerText?.trim();
  if (!text || text.length < 20) return false;
  
  // 화면에 보이는지 확인
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  
  // 너무 큰 컨테이너는 제외 (전체 페이지 wrapper 등)
  // 대신 자식 요소를 찾도록
  if (rect.height > 10000) return false;
  
  return true;
}

/**
 * selection이 속한 가장 가까운 block element 찾기 (개선됨)
 */
function findBlockFromSelection(
  sel: Selection,
  root: ParentNode
): HTMLElement | null {
  if (sel.rangeCount === 0) return null;

  let node: Node | null = sel.getRangeAt(0).startContainer;

  // 텍스트 노드에서 시작하면 부모부터 탐색
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }

  // 부모로 올라가면서 적합한 블록 찾기
  while (node && node !== root) {
    if (node instanceof HTMLElement) {
      // BLOCK_SELECTOR에 매치되고 유효한 텍스트 블록이면 반환
      if (node.matches(BLOCK_SELECTOR) && root.contains(node)) {
        // 너무 큰 컨테이너면 계속 탐색
        const rect = node.getBoundingClientRect();
        if (rect.height < 10000) {
          return node;
        }
      }
    }
    node = node.parentNode;
  }

  return null;
}

/**
 * block element의 index 계산
 */
function getBlockIndex(block: HTMLElement, root: ParentNode): number {
  const blocks = Array.from(
    root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)
  );
  return blocks.indexOf(block);
}

/**
 * index로 block 찾기
 */
function getBlockByIndex(
  index: number,
  root: ParentNode
): HTMLElement | null {
  const blocks = Array.from(
    root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)
  );
  return blocks[index] ?? null;
}

/**
 * block 하이라이트 (임시)
 */
function highlightBlock(el: HTMLElement) {
  el.scrollIntoView({ block: "center", behavior: "smooth" });

  const prev = el.style.outline;
  el.style.outline = "3px solid rgba(255, 120, 0, 0.8)";

  setTimeout(() => {
    el.style.outline = prev;
  }, 1200);
}



// =====================
// Snapshot (전략2 핵심)
// =====================
function captureSnapshotOnce() {
  if (originalSnapshotBodyHTML !== null) return;

  log("captureSnapshotOnce() start");

  // body는 통째로 복사 (script 포함 시 번잡해질 수 있으니 제거)
  const bodyClone = document.body.cloneNode(true) as HTMLBodyElement;
  bodyClone.querySelectorAll("script, noscript").forEach((n) => n.remove());

  originalSnapshotBodyHTML = bodyClone.innerHTML;

  // head에서는 스타일만 가져오는 게 목적 (CSS/link/style)
  const head = document.head;
  const cssNodes = Array.from(
    head.querySelectorAll('link[rel="stylesheet"], style')
  );

  // 그대로 outerHTML로 넣는다 (상대경로 깨짐 방지 위해 base도 추가)
  const baseHref = location.href;
  const headParts: string[] = [];
  headParts.push(`<base href="${escapeHtml(baseHref)}">`);
  headParts.push(`<meta charset="utf-8">`);

  // 번역 방지 힌트 (Chrome/Google Translate)
  headParts.push(`<meta name="google" content="notranslate">`);

  for (const n of cssNodes) {
    headParts.push(n.outerHTML);
  }

  originalSnapshotHeadHTML = headParts.join("\n");

  log("captureSnapshotOnce() done", {
    bodyLen: originalSnapshotBodyHTML.length,
    headLen: originalSnapshotHeadHTML.length,
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// =====================
// Block utilities
// =====================

function collectBlocks(root: Document | HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)
  ).filter(el => {
    const text = el.innerText?.trim();
    if (!text || text.length < 20) return false;

    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function findBlockIndexFromSelection(
  doc: Document,
  sel: Selection
): number | null {
  if (!sel.rangeCount) return null;

  let node: Node | null = sel.getRangeAt(0).startContainer;

  while (node && node !== doc.body) {
    if (node instanceof HTMLElement && node.matches(BLOCK_SELECTOR)) {
      const blocks = collectBlocks(doc);
      const idx = blocks.indexOf(node);
      log("findBlockIndexFromSelection", idx);
      return idx >= 0 ? idx : null;
    }
    node = node.parentNode;
  }
  return null;
}



// =====================
// Split UI
// =====================
function ensureSplitUI() {
  if (splitRoot) {
    log("⚠️ ensureSplitUI() - splitRoot already exists");
    return;
  }

  log("🏗️ ensureSplitUI() CREATE START");
  log("📊 Snapshot status:", {
    bodyHTML: originalSnapshotBodyHTML ? `${originalSnapshotBodyHTML.length} chars` : "null",
    headHTML: originalSnapshotHeadHTML ? `${originalSnapshotHeadHTML.length} chars` : "null"
  });

  splitRoot = document.createElement("div");
  splitRoot.id = "str-split-root";
  Object.assign(splitRoot.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    display: "flex",
    background: "#fff",
  });

  // Left pane (원문 스냅샷 iframe)
  leftPane = document.createElement("div");
  leftPane.id = "str-left-pane";
  Object.assign(leftPane.style, {
    width: `${Math.round(SPLIT_LEFT_RATIO * 100)}%`,
    height: "100%",
    borderRight: "1px solid #ddd",
    background: "#fff",
  });

  // 번역 제외 힌트 (Chrome 번역이 100% 보장하진 않지만 도움 됨)
  leftPane.classList.add("notranslate");
  leftPane.setAttribute("translate", "no");

  leftIframe = document.createElement("iframe");
  leftIframe.id = "str-left-iframe";
  Object.assign(leftIframe.style, {
    width: "100%",
    height: "100%",
    border: "0",
    display: "block",
    background: "#fff",
  });

  // srcdoc 구성: head+body
  const headHTML = originalSnapshotHeadHTML ?? `<meta charset="utf-8"><meta name="google" content="notranslate">`;
  const bodyHTML = originalSnapshotBodyHTML ?? "";

  // body 쪽에도 translate 방지 힌트
  const srcdoc = `<!doctype html>
<html translate="no" class="notranslate">
<head>
${headHTML}
</head>
<body translate="no" class="notranslate">
${bodyHTML}
</body>
</html>`;

  leftIframe.srcdoc = srcdoc;

  // =====================
  // LEFT iframe drag detect (원문)
  // =====================
  leftIframe.addEventListener("load", () => {
    const iframeDoc = leftIframe?.contentDocument;
    if (!iframeDoc) {
      log("left iframe load but no document");
      return;
    }

    log("left iframe document ready, attach selection listener");

    iframeDoc.addEventListener("selectionchange", () => {
      const sel = iframeDoc.getSelection();
      const text = sel?.toString().trim() ?? "";

      if (text.length === 0) return;

      const block = findBlockFromSelection(sel!, iframeDoc.body);

      if (!block) {
        log("LEFT iframe selection but no block found");
        return;
      }

      const index = getBlockIndex(block, iframeDoc.body);

      log("LEFT iframe block detected", {
        index,
        tag: block.tagName,
        preview: block.innerText.slice(0, 80),
      });

      // 반대편(RIGHT)으로 반영
      if (rightPane) {
        const target = getBlockByIndex(index, rightPane);
        if (target) {
          log("LEFT → RIGHT highlight", { index });
          highlightBlock(target);
        } else {
          log("LEFT → RIGHT block not found", { index });
        }
      }


    });
  });


  leftPane.appendChild(leftIframe);

  leftIframe.addEventListener("load", () => {
    const iframeDoc = leftIframe?.contentDocument;
    if (!iframeDoc) return;

    log("leftIframe selection listener attached");

    iframeDoc.addEventListener("selectionchange", () => {
      const sel = iframeDoc.getSelection();
      if (!sel || sel.isCollapsed) return;

      clearHighlights();

      const leftBlocks = collectBlocks(iframeDoc);
      const rightDoc = document;
      const rightBlocks = collectBlocks(rightDoc);

      const idx = findBlockIndexFromSelection(iframeDoc, sel);
      if (idx === null) return;

      log("block match index", idx);

      if (leftBlocks[idx]) {
        highlightBlock(leftBlocks[idx], "rgba(255,200,120,0.5)");
      }

      if (rightBlocks[idx]) {
        highlightBlock(rightBlocks[idx], "rgba(180,220,255,0.45)");
        rightBlocks[idx].scrollIntoView({ block: "center" });
      }
    });
  });


  // Right pane (라이브 페이지, Chrome 번역 대상)
  rightPane = document.createElement("div");
  rightPane.id = "str-right-pane";
  Object.assign(rightPane.style, {
    width: `${100 - Math.round(SPLIT_LEFT_RATIO * 100)}%`,
    height: "100%",
    overflow: "auto",
    background: "#fff",
  });

  // 기존 body 자식들을 rightPane로 이동
  const wrapper = document.createElement("div");
  wrapper.id = "str-right-wrapper";
  while (document.body.firstChild) {
    wrapper.appendChild(document.body.firstChild);
  }
  rightPane.appendChild(wrapper);

  splitRoot.appendChild(leftPane);
  splitRoot.appendChild(rightPane);

  document.body.appendChild(splitRoot);

  log("✅ ensureSplitUI() DONE", {
    leftPane: !!leftPane,
    rightPane: !!rightPane,
    leftIframe: !!leftIframe,
    splitRootInDOM: document.body.contains(splitRoot)
  });

  setupScrollSync();

  // =====================
  // RIGHT pane drag detect (번역/live DOM)
  // =====================
  rightPane.addEventListener("mouseup", () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";

    if (text.length === 0) return;

    const block = findBlockFromSelection(sel!, rightPane!);

    if (!block) {
      log("RIGHT pane selection but no block found");
      return;
    }

    const index = getBlockIndex(block, rightPane!);

    log("RIGHT pane block detected", {
      index,
      tag: block.tagName,
      preview: block.innerText.slice(0, 80),
    });

    // 반대편(LEFT iframe)으로 반영
    const iframeDoc = leftIframe?.contentDocument;
    if (iframeDoc) {
      const target = getBlockByIndex(index, iframeDoc.body);
      if (target) {
        log("RIGHT → LEFT highlight", { index });
        highlightBlock(target);
      } else {
        log("RIGHT → LEFT block not found", { index });
      }
    }

  });

}

function teardownSplitUI() {
  log("🧹 teardownSplitUI() START", {
    splitRoot: !!splitRoot,
    leftPane: !!leftPane,
    rightPane: !!rightPane
  });

  if (!splitRoot) {
    log("⚠️ teardownSplitUI() - splitRoot not found, nothing to teardown");
    return;
  }

  // rightPane 안의 wrapper를 다시 body로 복원
  const wrapper = rightPane?.querySelector("#str-right-wrapper");
  if (wrapper) {
    log("📦 Restoring wrapper children to body", {
      childCount: wrapper.children.length
    });
    while (wrapper.firstChild) {
      document.body.appendChild(wrapper.firstChild);
    }
    log("✅ Wrapper children restored");
  } else {
    log("⚠️ Wrapper not found in rightPane");
  }

  splitRoot.remove();
  log("🗑️ splitRoot removed from DOM");

  splitRoot = null;
  leftPane = null;
  rightPane = null;
  leftIframe = null;

  // Strategy 3: 스냅샷은 유지 (다음 재구성에 재사용 가능)
  // originalSnapshotBodyHTML = null;
  // originalSnapshotHeadHTML = null;

  log("✅ teardownSplitUI() DONE", {
    splitRoot: !!splitRoot,
    leftPane: !!leftPane,
    rightPane: !!rightPane
  });
}

// =====================
// Scroll Sync (우->좌) 비율 기반
// =====================
function setupScrollSync() {
  if (!rightPane || !leftIframe) {
    log("setupScrollSync() missing refs", { rightPane: !!rightPane, leftIframe: !!leftIframe });
    return;
  }

  log("setupScrollSync() attach");

  // iframe 로딩 이후 scrollHeight 계산 가능
  leftIframe.addEventListener("load", () => {
    log("leftIframe load");
  });

  rightPane.addEventListener("scroll", () => {
    try {
      const iframeDoc = leftIframe?.contentDocument;
      const iframeWin = leftIframe?.contentWindow;
      if (!iframeDoc || !iframeWin || !rightPane) return;

      const rightMax = rightPane.scrollHeight - rightPane.clientHeight;
      const leftMax =
        iframeDoc.documentElement.scrollHeight - iframeWin.innerHeight;

      if (rightMax <= 0 || leftMax <= 0) return;

      const ratio = rightPane.scrollTop / rightMax;
      const target = ratio * leftMax;

      iframeWin.scrollTo(0, target);

      log("scrollSync", { ratio, rightTop: rightPane.scrollTop, leftTarget: target });
    } catch (e) {
      log("scrollSync error", e);
    }
  });
}

// =====================
// Highlight overlay
// =====================
let activeHighlights: HTMLElement[] = [];

function clearHighlights() {
  activeHighlights.forEach(el => el.remove());
  activeHighlights = [];
}

// function highlightBlock(el: HTMLElement, color = "rgba(255,230,150,0.6)") {
//   const rect = el.getBoundingClientRect();
//   const overlay = document.createElement("div");

//   Object.assign(overlay.style, {
//     position: "fixed",
//     left: `${rect.left}px`,
//     top: `${rect.top}px`,
//     width: `${rect.width}px`,
//     height: `${rect.height}px`,
//     background: color,
//     pointerEvents: "none",
//     zIndex: "2147483646",
//   });

//   document.body.appendChild(overlay);
//   activeHighlights.push(overlay);
// }


// =====================
// Strategy 3: Navigation Detection
// =====================

/**
 * History API 후킹: SPA 라우팅 감지
 */
function hookHistoryAPI() {
  log("🔧 hookHistoryAPI() called");
  
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    log("🔀 history.pushState INTERCEPTED", {
      url: location.href,
      args: args,
      enabled: enabled
    });
    originalPushState.apply(this, args);
    log("🔀 history.pushState AFTER apply", location.href);
    onNavigationDetected();
  };

  history.replaceState = function(...args) {
    log("🔀 history.replaceState INTERCEPTED", {
      url: location.href,
      args: args,
      enabled: enabled
    });
    originalReplaceState.apply(this, args);
    log("🔀 history.replaceState AFTER apply", location.href);
    onNavigationDetected();
  };

  // popstate: 브라우저 뒤로/앞으로
  window.addEventListener("popstate", (e) => {
    log("⬅️ popstate EVENT", {
      url: location.href,
      state: e.state,
      enabled: enabled
    });
    onNavigationDetected();
  });

  log("✅ History API hooked successfully");
}

/**
 * URL 변경 폴링 (SPA fallback)
 */
function startNavigationDetector() {
  if (navigationDetector) {
    log("⚠️ startNavigationDetector() already running");
    return;
  }

  log("🚀 startNavigationDetector() starting...");
  log("📍 Initial URL:", currentURL);

  navigationDetector = setInterval(() => {
    if (location.href !== currentURL) {
      log("🔄 URL CHANGE detected (polling)", {
        from: currentURL,
        to: location.href,
        enabled: enabled,
        splitRoot: !!splitRoot
      });
      currentURL = location.href;
      onNavigationDetected();
    }
  }, 500);

  log("✅ Navigation detector started (polling every 500ms)");
}

function stopNavigationDetector() {
  if (navigationDetector) {
    clearInterval(navigationDetector);
    navigationDetector = null;
    log("🛑 Navigation detector stopped");
  } else {
    log("⚠️ stopNavigationDetector() but detector was not running");
  }
}

/**
 * Navigation 감지 시 호출
 */
function onNavigationDetected() {
  log("🎯 onNavigationDetected() CALLED", {
    url: location.href,
    enabled: enabled,
    splitRoot: !!splitRoot,
    leftPane: !!leftPane,
    rightPane: !!rightPane
  });

  if (!enabled) {
    log("❌ onNavigationDetected() - ABORTED: enabled=false");
    return;
  }

  log("✅ onNavigationDetected() - proceeding (enabled=true)");
  log("🧹 Starting teardown...");

  // 기존 split 정리
  teardownSplitUI();

  log("⏱️ Waiting 300ms for DOM stabilization...");

  // 새 페이지 스냅샷 캡처 대기 (DOM이 안정화될 때까지)
  setTimeout(() => {
    log("🔄 Re-capturing snapshot for new page", {
      url: location.href,
      enabled: enabled,
      bodyChildren: document.body.children.length
    });
    
    // 스냅샷 초기화 후 재캡처
    originalSnapshotBodyHTML = null;
    originalSnapshotHeadHTML = null;
    
    log("📸 Calling captureSnapshotOnce()...");
    captureSnapshotOnce();
    
    log("🏗️ Calling ensureSplitUI()...");
    ensureSplitUI();

    log("✅ Split view reconstruction complete", {
      splitRoot: !!splitRoot,
      leftPane: !!leftPane,
      rightPane: !!rightPane,
      leftIframe: !!leftIframe
    });
  }, 300); // DOM 안정화 대기
}

// =====================
// Chrome 메시지
// =====================
chrome.runtime.onMessage.addListener((msg: Msg) => {
  log("📨 onMessage received", msg);

  if (msg.type === "START") {
    if (enabled) {
      log("⚠️ START message but already enabled");
      return;
    }

    log("🚀 START message - enabling split view");
    enabled = true;
    saveEnabledState(true); // 상태 저장

    log("📍 Current URL:", location.href);
    currentURL = location.href;

    // Navigation 감지 시작
    log("🔧 Hooking History API...");
    hookHistoryAPI();
    
    log("🔧 Starting Navigation Detector...");
    startNavigationDetector();

    log("📸 Capturing initial snapshot...");
    captureSnapshotOnce();
    
    log("🏗️ Creating split UI...");
    ensureSplitUI();

    log("✅ START complete", {
      enabled: enabled,
      splitRoot: !!splitRoot,
      currentURL: currentURL
    });
  }

  if (msg.type === "STOP") {
    log("🛑 STOP message received");
    
    if (!enabled) {
      log("⚠️ STOP message but already disabled");
      return;
    }

    enabled = false;
    saveEnabledState(false); // 상태 저장
    log("🔧 enabled set to false");
    
    // Navigation 감지 중지
    log("🛑 Stopping navigation detector...");
    stopNavigationDetector();
    
    log("🧹 Tearing down split UI...");
    teardownSplitUI();
    
    log("✅ STOP complete", {
      enabled: enabled,
      splitRoot: !!splitRoot
    });
  }
});

// =====================
// Page Load: 탭 ID 초기화 및 상태 복원
// =====================
(async function initOnPageLoad() {
  // 먼저 탭 ID 가져오기
  log("🔍 Getting current tab ID...");
  currentTabId = await getCurrentTabId();
  
  if (currentTabId === null) {
    log("❌ Failed to get tab ID - split view will not work");
    return;
  }
  
  log("✅ Tab ID initialized", { tabId: currentTabId });
  log("🌍 Page loaded", {
    url: location.href,
    readyState: document.readyState,
    tabId: currentTabId
  });

  // Storage에서 이전 상태 복원
  const wasEnabled = await restoreEnabledState();
  
  log("🔍 Checking previous state", {
    wasEnabled: wasEnabled,
    currentEnabled: enabled
  });

  if (wasEnabled) {
    log("🔄 Previous session was enabled - auto-restarting split view");
    
    enabled = true;
    currentURL = location.href;
    
    // 아이콘 상태 복원
    updateIconState(true);

    // DOM이 준비될 때까지 대기
    if (document.readyState === 'loading') {
      log("⏱️ Document still loading, waiting for DOMContentLoaded...");
      document.addEventListener('DOMContentLoaded', () => {
        log("✅ DOMContentLoaded fired");
        restartSplitView();
      });
    } else {
      log("✅ Document already loaded");
      restartSplitView();
    }
  } else {
    log("ℹ️ Previous session was disabled - waiting for START message");
    // 아이콘을 inactive 상태로 설정
    updateIconState(false);
  }
})();

function restartSplitView() {
  log("🔄 Restarting split view after page load");
  
  // Navigation 감지 시작
  hookHistoryAPI();
  startNavigationDetector();
  
  // 약간의 지연 후 UI 생성 (번역 적용 전에 캡처하기 위해)
  setTimeout(() => {
    log("📸 Capturing snapshot for restarted session");
    captureSnapshotOnce();
    
    log("🏗️ Creating split UI for restarted session");
    ensureSplitUI();
    
    log("✅ Split view restarted successfully");
  }, 100);
}
