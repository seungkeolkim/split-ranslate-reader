type Msg =
  | { type: "START" }
  | { type: "STOP" };

let enabled = false;
let overlayRoot: HTMLDivElement | null = null;
let isFlipped = false;

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

  // Header
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
  flipBtn.textContent = "↔ Flip";
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

  // Body
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

function createColumn(id: string, label: string) {
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
  content.textContent =
    label === "Original"
      ? "Select text on the page."
      : "Translation will appear here.";

  col.appendChild(tag);
  col.appendChild(content);
  return col;
}

function applyFlip() {
  const body = document.getElementById("str-body");
  if (!body) return;

  body.style.direction = isFlipped ? "rtl" : "ltr";
  body.querySelectorAll<HTMLElement>(".str-col-content").forEach((el) => {
    el.style.direction = "ltr";
  });
}

function updateOriginal(text: string) {
  const el = document.querySelector<HTMLDivElement>(
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

  updateOriginal(window.getSelection()?.toString().trim() ?? "");
});

// --- Chrome translate detection (MVP: state only) ---
let isChromeTranslated = false;

function checkChromeTranslateState() {
  const html = document.documentElement;
  const translated =
    html.classList.contains("translated-ltr") ||
    html.classList.contains("translated-rtl");

  if (translated !== isChromeTranslated) {
    isChromeTranslated = translated;
    onChromeTranslateStateChange(translated);
  }
}

function onChromeTranslateStateChange(translated: boolean) {
  // MVP: just show state in Translation column
  const el = document.querySelector<HTMLDivElement>(
    "#str-col-right .str-col-content"
  );
  if (!el) return;

  el.textContent = translated
    ? "Chrome translation detected (page translated)."
    : "Translation will appear here.";
}


chrome.runtime.onMessage.addListener((msg: Msg) => {
  if (msg.type === "START") {
    enabled = true;
    showOverlay();
    checkChromeTranslateState(); // ← 추가
  }

  if (msg.type === "STOP") {
    enabled = false;
    hideOverlay();
  }
});

// Observe <html> class changes (Chrome Translate hook)
const htmlObserver = new MutationObserver(() => {
  if (!enabled) return;
  checkChromeTranslateState();
});

htmlObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["class"]
});

