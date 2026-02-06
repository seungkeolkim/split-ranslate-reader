"use strict";
(() => {
  // src/content/content.ts
  var enabled = false;
  var overlayRoot = null;
  var isFlipped = false;
  function ensureOverlay() {
    if (overlayRoot) return overlayRoot;
    const root = document.createElement("div");
    root.id = "str-overlay-root";
    Object.assign(root.style, {
      position: "fixed",
      top: "12px",
      right: "12px",
      width: "520px",
      maxHeight: "70vh",
      background: "#fff",
      border: "1px solid #e5e5e5",
      borderRadius: "12px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      zIndex: "2147483647",
      display: "none",
      overflow: "hidden",
      fontFamily: "system-ui, sans-serif"
    });
    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 10px",
      borderBottom: "1px solid #eee"
    });
    const title = document.createElement("div");
    title.textContent = "Split Translate Reader";
    title.style.fontWeight = "700";
    const flipBtn = document.createElement("button");
    flipBtn.textContent = "\u2194 Flip";
    Object.assign(flipBtn.style, {
      padding: "6px 10px",
      borderRadius: "8px",
      border: "1px solid #ccc",
      background: "#f7f7f7",
      cursor: "pointer"
    });
    flipBtn.onclick = () => {
      isFlipped = !isFlipped;
      applyFlip();
    };
    header.appendChild(title);
    header.appendChild(flipBtn);
    const body = document.createElement("div");
    body.id = "str-body";
    Object.assign(body.style, {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      height: "100%"
    });
    const colLeft = createColumn("str-col-left", "Original");
    const colRight = createColumn("str-col-right", "Translation");
    body.appendChild(colLeft);
    body.appendChild(colRight);
    root.appendChild(header);
    root.appendChild(body);
    document.documentElement.appendChild(root);
    overlayRoot = root;
    return overlayRoot;
  }
  function createColumn(id, label) {
    const col = document.createElement("div");
    col.id = id;
    Object.assign(col.style, {
      padding: "10px",
      overflow: "auto",
      borderRight: label === "Original" ? "1px solid #eee" : "none"
    });
    const tag = document.createElement("div");
    tag.textContent = label;
    Object.assign(tag.style, {
      fontSize: "11px",
      color: "#666",
      marginBottom: "6px"
    });
    const content = document.createElement("div");
    content.className = "str-col-content";
    Object.assign(content.style, {
      fontSize: "13px",
      color: "#111",
      whiteSpace: "pre-wrap"
    });
    content.textContent = label === "Original" ? "Select text on the page." : "Translation will appear here.";
    col.appendChild(tag);
    col.appendChild(content);
    return col;
  }
  function applyFlip() {
    const body = document.getElementById("str-body");
    if (!body) return;
    body.style.direction = isFlipped ? "rtl" : "ltr";
    body.querySelectorAll(".str-col-content").forEach((el) => {
      el.style.direction = "ltr";
    });
  }
  function updateOriginal(text) {
    const el = document.querySelector(
      "#str-col-left .str-col-content"
    );
    if (el) el.textContent = text || "Select text on the page.";
  }
  function showOverlay() {
    const root = ensureOverlay();
    root.style.display = "block";
    updateOriginal(window.getSelection()?.toString().trim() ?? "");
  }
  function hideOverlay() {
    if (!overlayRoot) return;
    overlayRoot.style.display = "none";
  }
  document.addEventListener("selectionchange", () => {
    if (!enabled) return;
    if (!overlayRoot || overlayRoot.style.display === "none") return;
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    updateOriginal(text);
    if (text && isChromeTranslated) {
      updateMatchedTranslation(sel);
    }
  });
  var isChromeTranslated = false;
  function checkChromeTranslateState() {
    const html = document.documentElement;
    const translated = html.classList.contains("translated-ltr") || html.classList.contains("translated-rtl");
    if (translated !== isChromeTranslated) {
      isChromeTranslated = translated;
      onChromeTranslateStateChange(translated);
    }
  }
  function onChromeTranslateStateChange(translated) {
    const el = document.querySelector(
      "#str-col-right .str-col-content"
    );
    if (!el) return;
    if (!translated) {
      el.textContent = "Translation will appear here.";
      return;
    }
    const translatedText = collectTranslatedParagraphs();
    el.textContent = translatedText.length > 0 ? translatedText.join("\n\n") : "(Translated page detected, but no text collected)";
  }
  function collectTranslatedParagraphs() {
    const TARGET_TAGS = ["P", "H1", "H2", "H3", "LI"];
    const nodes = Array.from(document.body.querySelectorAll(
      TARGET_TAGS.join(",")
    ));
    const results = [];
    for (const el of nodes) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const text = el.innerText?.trim();
      if (!text) continue;
      if (text.length < 30) continue;
      results.push(text);
      if (results.length >= 5) break;
    }
    return results;
  }
  function updateMatchedTranslation(sel) {
    const el = document.querySelector(
      "#str-col-right .str-col-content"
    );
    if (!el) return;
    const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    if (!range) return;
    const selRect = range.getBoundingClientRect();
    if (!selRect) return;
    const candidates = collectTranslatedParagraphElements();
    if (candidates.length === 0) {
      el.textContent = "(No translated paragraphs found)";
      return;
    }
    let bestEl = null;
    let bestDist = Infinity;
    for (const p of candidates) {
      const rect = p.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const dist = distanceBetweenRects(selRect, rect);
      if (dist < bestDist) {
        bestDist = dist;
        bestEl = p;
      }
    }
    if (bestEl) {
      const sentences = splitIntoSentences(bestEl.innerText.trim());
      const selText = sel.toString().trim();
      const sentenceCount = selText.length < 80 ? 1 : 2;
      el.textContent = sentences.slice(0, sentenceCount).join(" ");
    }
  }
  function collectTranslatedParagraphElements() {
    const TAGS = ["P", "H1", "H2", "H3", "LI"];
    const nodes = Array.from(
      document.body.querySelectorAll(TAGS.join(","))
    );
    return nodes.filter((el) => {
      const text = el.innerText?.trim();
      if (!text) return false;
      if (text.length < 30) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      return true;
    });
  }
  function distanceBetweenRects(a, b) {
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    return Math.hypot(ax - bx, ay - by);
  }
  function splitIntoSentences(text) {
    const raw = text.replace(/\n+/g, " ").split(/(?<=[.!?。！？])\s+/);
    return raw.map((s) => s.trim()).filter((s) => s.length > 10);
  }
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "START") {
      enabled = true;
      showOverlay();
      checkChromeTranslateState();
    }
    if (msg.type === "STOP") {
      enabled = false;
      hideOverlay();
    }
  });
  var htmlObserver = new MutationObserver(() => {
    if (!enabled) return;
    checkChromeTranslateState();
  });
  htmlObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"]
  });
})();
//# sourceMappingURL=content.js.map
