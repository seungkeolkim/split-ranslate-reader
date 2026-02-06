"use strict";
(() => {
  // src/content/content.ts
  var overlay = null;
  function toggleOverlay() {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.top = "12px";
      overlay.style.right = "12px";
      overlay.style.width = "400px";
      overlay.style.maxHeight = "70vh";
      overlay.style.background = "#fff";
      overlay.style.border = "1px solid #ccc";
      overlay.style.padding = "10px";
      overlay.style.zIndex = "2147483647";
      overlay.textContent = "Selected text will appear here.";
      document.body.appendChild(overlay);
    }
    overlay.style.display = overlay.style.display === "none" ? "block" : "none";
  }
  document.addEventListener("selectionchange", () => {
    if (!overlay || overlay.style.display === "none") return;
    overlay.textContent = window.getSelection()?.toString() || "";
  });
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "TOGGLE_OVERLAY") {
      toggleOverlay();
    }
  });
})();
//# sourceMappingURL=content.js.map
