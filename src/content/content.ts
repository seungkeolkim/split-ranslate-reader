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
// LOG (삭제 금지)
// =====================
function log(...args: any[]) {
  console.log("[STR-DBG]", ...args);
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
// Split UI
// =====================
function ensureSplitUI() {
  if (splitRoot) return;

  log("ensureSplitUI() create");

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

  leftPane.appendChild(leftIframe);

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

  log("ensureSplitUI() done", {
    leftPane: !!leftPane,
    rightPane: !!rightPane,
    leftIframe: !!leftIframe,
  });

  setupScrollSync();
}

function teardownSplitUI() {
  log("teardownSplitUI() start");

  if (!splitRoot) return;

  // rightPane 안의 wrapper를 다시 body로 복원
  const wrapper = rightPane?.querySelector("#str-right-wrapper");
  if (wrapper) {
    while (wrapper.firstChild) {
      document.body.appendChild(wrapper.firstChild);
    }
  }

  splitRoot.remove();

  splitRoot = null;
  leftPane = null;
  rightPane = null;
  leftIframe = null;

  originalSnapshotBodyHTML = null;
  originalSnapshotHeadHTML = null;

  log("teardownSplitUI() done");
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
// Chrome 메시지
// =====================
chrome.runtime.onMessage.addListener((msg: Msg) => {
  log("onMessage", msg);

  if (msg.type === "START") {
    if (enabled) return;

    enabled = true;

    captureSnapshotOnce();
    ensureSplitUI();

    log("START done");
  }

  if (msg.type === "STOP") {
    enabled = false;
    teardownSplitUI();
    log("STOP done");
  }
});
