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
// Paragraph / Block Utils
// =====================

const BLOCK_SELECTOR = "p, li, h1, h2, h3, h4, h5, h6";

/**
 * selection이 속한 가장 가까운 block element 찾기
 */
function findBlockFromSelection(
  sel: Selection,
  root: ParentNode
): HTMLElement | null {
  if (sel.rangeCount === 0) return null;

  let node: Node | null = sel.getRangeAt(0).startContainer;

  while (node) {
    if (node instanceof HTMLElement) {
      if (node.matches(BLOCK_SELECTOR) && root.contains(node)) {
        return node;
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

  log("ensureSplitUI() done", {
    leftPane: !!leftPane,
    rightPane: !!rightPane,
    leftIframe: !!leftIframe,
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
