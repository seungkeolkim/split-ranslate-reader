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
    leftPane.appendChild(leftIframe);
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
