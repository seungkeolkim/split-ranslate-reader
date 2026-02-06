"use strict";
(() => {
  // src/content/content.ts
  var enabled = false;
  var splitRoot = null;
  var leftPane = null;
  var rightPane = null;
  var leftIframe = null;
  var originalSnapshotBodyHTML = null;
  var originalSnapshotHeadHTML = null;
  var SPLIT_LEFT_RATIO = 0.5;
  function log(...args) {
    console.log("[STR-DBG]", ...args);
  }
  var BLOCK_SELECTOR = "p, li, h1, h2, h3, h4, h5, h6";
  function findBlockFromSelection(sel, root) {
    if (sel.rangeCount === 0) return null;
    let node = sel.getRangeAt(0).startContainer;
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
  function getBlockIndex(block, root) {
    const blocks = Array.from(
      root.querySelectorAll(BLOCK_SELECTOR)
    );
    return blocks.indexOf(block);
  }
  function getBlockByIndex(index, root) {
    const blocks = Array.from(
      root.querySelectorAll(BLOCK_SELECTOR)
    );
    return blocks[index] ?? null;
  }
  function highlightBlock(el) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const prev = el.style.outline;
    el.style.outline = "3px solid rgba(255, 120, 0, 0.8)";
    setTimeout(() => {
      el.style.outline = prev;
    }, 1200);
  }
  function captureSnapshotOnce() {
    if (originalSnapshotBodyHTML !== null) return;
    log("captureSnapshotOnce() start");
    const bodyClone = document.body.cloneNode(true);
    bodyClone.querySelectorAll("script, noscript").forEach((n) => n.remove());
    originalSnapshotBodyHTML = bodyClone.innerHTML;
    const head = document.head;
    const cssNodes = Array.from(
      head.querySelectorAll('link[rel="stylesheet"], style')
    );
    const baseHref = location.href;
    const headParts = [];
    headParts.push(`<base href="${escapeHtml(baseHref)}">`);
    headParts.push(`<meta charset="utf-8">`);
    headParts.push(`<meta name="google" content="notranslate">`);
    for (const n of cssNodes) {
      headParts.push(n.outerHTML);
    }
    originalSnapshotHeadHTML = headParts.join("\n");
    log("captureSnapshotOnce() done", {
      bodyLen: originalSnapshotBodyHTML.length,
      headLen: originalSnapshotHeadHTML.length
    });
  }
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }
  function collectBlocks(root) {
    return Array.from(
      root.querySelectorAll(BLOCK_SELECTOR)
    ).filter((el) => {
      const text = el.innerText?.trim();
      if (!text || text.length < 20) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }
  function findBlockIndexFromSelection(doc, sel) {
    if (!sel.rangeCount) return null;
    let node = sel.getRangeAt(0).startContainer;
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
      background: "#fff"
    });
    leftPane = document.createElement("div");
    leftPane.id = "str-left-pane";
    Object.assign(leftPane.style, {
      width: `${Math.round(SPLIT_LEFT_RATIO * 100)}%`,
      height: "100%",
      borderRight: "1px solid #ddd",
      background: "#fff"
    });
    leftPane.classList.add("notranslate");
    leftPane.setAttribute("translate", "no");
    leftIframe = document.createElement("iframe");
    leftIframe.id = "str-left-iframe";
    Object.assign(leftIframe.style, {
      width: "100%",
      height: "100%",
      border: "0",
      display: "block",
      background: "#fff"
    });
    const headHTML = originalSnapshotHeadHTML ?? `<meta charset="utf-8"><meta name="google" content="notranslate">`;
    const bodyHTML = originalSnapshotBodyHTML ?? "";
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
        const block = findBlockFromSelection(sel, iframeDoc.body);
        if (!block) {
          log("LEFT iframe selection but no block found");
          return;
        }
        const index = getBlockIndex(block, iframeDoc.body);
        log("LEFT iframe block detected", {
          index,
          tag: block.tagName,
          preview: block.innerText.slice(0, 80)
        });
        if (rightPane) {
          const target = getBlockByIndex(index, rightPane);
          if (target) {
            log("LEFT \u2192 RIGHT highlight", { index });
            highlightBlock(target);
          } else {
            log("LEFT \u2192 RIGHT block not found", { index });
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
    rightPane = document.createElement("div");
    rightPane.id = "str-right-pane";
    Object.assign(rightPane.style, {
      width: `${100 - Math.round(SPLIT_LEFT_RATIO * 100)}%`,
      height: "100%",
      overflow: "auto",
      background: "#fff"
    });
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
      leftIframe: !!leftIframe
    });
    setupScrollSync();
    rightPane.addEventListener("mouseup", () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (text.length === 0) return;
      const block = findBlockFromSelection(sel, rightPane);
      if (!block) {
        log("RIGHT pane selection but no block found");
        return;
      }
      const index = getBlockIndex(block, rightPane);
      log("RIGHT pane block detected", {
        index,
        tag: block.tagName,
        preview: block.innerText.slice(0, 80)
      });
      const iframeDoc = leftIframe?.contentDocument;
      if (iframeDoc) {
        const target = getBlockByIndex(index, iframeDoc.body);
        if (target) {
          log("RIGHT \u2192 LEFT highlight", { index });
          highlightBlock(target);
        } else {
          log("RIGHT \u2192 LEFT block not found", { index });
        }
      }
    });
  }
  function teardownSplitUI() {
    log("teardownSplitUI() start");
    if (!splitRoot) return;
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
  function setupScrollSync() {
    if (!rightPane || !leftIframe) {
      log("setupScrollSync() missing refs", { rightPane: !!rightPane, leftIframe: !!leftIframe });
      return;
    }
    log("setupScrollSync() attach");
    leftIframe.addEventListener("load", () => {
      log("leftIframe load");
    });
    rightPane.addEventListener("scroll", () => {
      try {
        const iframeDoc = leftIframe?.contentDocument;
        const iframeWin = leftIframe?.contentWindow;
        if (!iframeDoc || !iframeWin || !rightPane) return;
        const rightMax = rightPane.scrollHeight - rightPane.clientHeight;
        const leftMax = iframeDoc.documentElement.scrollHeight - iframeWin.innerHeight;
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
  var activeHighlights = [];
  function clearHighlights() {
    activeHighlights.forEach((el) => el.remove());
    activeHighlights = [];
  }
  chrome.runtime.onMessage.addListener((msg) => {
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
})();
//# sourceMappingURL=content.js.map
