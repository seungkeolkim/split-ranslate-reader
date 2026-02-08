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
  var currentURL = location.href;
  var navigationDetector = null;
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
    if (splitRoot) {
      log("\u26A0\uFE0F ensureSplitUI() - splitRoot already exists");
      return;
    }
    log("\u{1F3D7}\uFE0F ensureSplitUI() CREATE START");
    log("\u{1F4CA} Snapshot status:", {
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
    log("\u2705 ensureSplitUI() DONE", {
      leftPane: !!leftPane,
      rightPane: !!rightPane,
      leftIframe: !!leftIframe,
      splitRootInDOM: document.body.contains(splitRoot)
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
    log("\u{1F9F9} teardownSplitUI() START", {
      splitRoot: !!splitRoot,
      leftPane: !!leftPane,
      rightPane: !!rightPane
    });
    if (!splitRoot) {
      log("\u26A0\uFE0F teardownSplitUI() - splitRoot not found, nothing to teardown");
      return;
    }
    const wrapper = rightPane?.querySelector("#str-right-wrapper");
    if (wrapper) {
      log("\u{1F4E6} Restoring wrapper children to body", {
        childCount: wrapper.children.length
      });
      while (wrapper.firstChild) {
        document.body.appendChild(wrapper.firstChild);
      }
      log("\u2705 Wrapper children restored");
    } else {
      log("\u26A0\uFE0F Wrapper not found in rightPane");
    }
    splitRoot.remove();
    log("\u{1F5D1}\uFE0F splitRoot removed from DOM");
    splitRoot = null;
    leftPane = null;
    rightPane = null;
    leftIframe = null;
    log("\u2705 teardownSplitUI() DONE", {
      splitRoot: !!splitRoot,
      leftPane: !!leftPane,
      rightPane: !!rightPane
    });
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
  function hookHistoryAPI() {
    log("\u{1F527} hookHistoryAPI() called");
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function(...args) {
      log("\u{1F500} history.pushState INTERCEPTED", {
        url: location.href,
        args,
        enabled
      });
      originalPushState.apply(this, args);
      log("\u{1F500} history.pushState AFTER apply", location.href);
      onNavigationDetected();
    };
    history.replaceState = function(...args) {
      log("\u{1F500} history.replaceState INTERCEPTED", {
        url: location.href,
        args,
        enabled
      });
      originalReplaceState.apply(this, args);
      log("\u{1F500} history.replaceState AFTER apply", location.href);
      onNavigationDetected();
    };
    window.addEventListener("popstate", (e) => {
      log("\u2B05\uFE0F popstate EVENT", {
        url: location.href,
        state: e.state,
        enabled
      });
      onNavigationDetected();
    });
    log("\u2705 History API hooked successfully");
  }
  function startNavigationDetector() {
    if (navigationDetector) {
      log("\u26A0\uFE0F startNavigationDetector() already running");
      return;
    }
    log("\u{1F680} startNavigationDetector() starting...");
    log("\u{1F4CD} Initial URL:", currentURL);
    navigationDetector = setInterval(() => {
      if (location.href !== currentURL) {
        log("\u{1F504} URL CHANGE detected (polling)", {
          from: currentURL,
          to: location.href,
          enabled,
          splitRoot: !!splitRoot
        });
        currentURL = location.href;
        onNavigationDetected();
      }
    }, 500);
    log("\u2705 Navigation detector started (polling every 500ms)");
  }
  function stopNavigationDetector() {
    if (navigationDetector) {
      clearInterval(navigationDetector);
      navigationDetector = null;
      log("\u{1F6D1} Navigation detector stopped");
    } else {
      log("\u26A0\uFE0F stopNavigationDetector() but detector was not running");
    }
  }
  function onNavigationDetected() {
    log("\u{1F3AF} onNavigationDetected() CALLED", {
      url: location.href,
      enabled,
      splitRoot: !!splitRoot,
      leftPane: !!leftPane,
      rightPane: !!rightPane
    });
    if (!enabled) {
      log("\u274C onNavigationDetected() - ABORTED: enabled=false");
      return;
    }
    log("\u2705 onNavigationDetected() - proceeding (enabled=true)");
    log("\u{1F9F9} Starting teardown...");
    teardownSplitUI();
    log("\u23F1\uFE0F Waiting 300ms for DOM stabilization...");
    setTimeout(() => {
      log("\u{1F504} Re-capturing snapshot for new page", {
        url: location.href,
        enabled,
        bodyChildren: document.body.children.length
      });
      originalSnapshotBodyHTML = null;
      originalSnapshotHeadHTML = null;
      log("\u{1F4F8} Calling captureSnapshotOnce()...");
      captureSnapshotOnce();
      log("\u{1F3D7}\uFE0F Calling ensureSplitUI()...");
      ensureSplitUI();
      log("\u2705 Split view reconstruction complete", {
        splitRoot: !!splitRoot,
        leftPane: !!leftPane,
        rightPane: !!rightPane,
        leftIframe: !!leftIframe
      });
    }, 300);
  }
  chrome.runtime.onMessage.addListener((msg) => {
    log("\u{1F4E8} onMessage received", msg);
    if (msg.type === "START") {
      if (enabled) {
        log("\u26A0\uFE0F START message but already enabled");
        return;
      }
      log("\u{1F680} START message - enabling split view");
      enabled = true;
      log("\u{1F4CD} Current URL:", location.href);
      currentURL = location.href;
      log("\u{1F527} Hooking History API...");
      hookHistoryAPI();
      log("\u{1F527} Starting Navigation Detector...");
      startNavigationDetector();
      log("\u{1F4F8} Capturing initial snapshot...");
      captureSnapshotOnce();
      log("\u{1F3D7}\uFE0F Creating split UI...");
      ensureSplitUI();
      log("\u2705 START complete", {
        enabled,
        splitRoot: !!splitRoot,
        currentURL
      });
    }
    if (msg.type === "STOP") {
      log("\u{1F6D1} STOP message received");
      if (!enabled) {
        log("\u26A0\uFE0F STOP message but already disabled");
        return;
      }
      enabled = false;
      log("\u{1F527} enabled set to false");
      log("\u{1F6D1} Stopping navigation detector...");
      stopNavigationDetector();
      log("\u{1F9F9} Tearing down split UI...");
      teardownSplitUI();
      log("\u2705 STOP complete", {
        enabled,
        splitRoot: !!splitRoot
      });
    }
  });
})();
//# sourceMappingURL=content.js.map
