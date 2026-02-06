type Msg =
  | { type: "START" }
  | { type: "STOP" };

/* =========================
 * DEBUG LOGGER
 * ========================= */
const LOG = (...args: any[]) => {
  console.log("[STR-DBG]", ...args);
};

LOG("content.ts loaded", location.href);

let enabled = false;
let overlayRoot: HTMLDivElement | null = null;
let originalHtmlMarginRight: string | null = null;
let originalBodyOverflowX: string | null = null;
const PANEL_WIDTH = 420;

let isFlipped = false;

/**
 * 우측 오버레이 생성 (재사용)
 */
function ensureOverlay() {
  LOG("ensureOverlay()", { exists: !!overlayRoot });

  if (overlayRoot) return overlayRoot;

  LOG("creating overlay DOM");

  const root = document.createElement("div");
  root.id = "str-overlay-root";
  Object.assign(root.style, {
    position: "fixed",
    top: "0",
    right: "0",
    width: `${PANEL_WIDTH}px`,
    height: "100vh",
    background: "#fff",
    borderLeft: "1px solid #e5e5e5",
    zIndex: "2147483647",
    display: "none",
    overflow: "hidden",
    fontFamily: "system-ui, sans-serif"
  });

  /* Header */
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
    LOG("flip clicked", { isFlipped });
    applyFlip();
  };

  header.appendChild(title);
  header.appendChild(flipBtn);

  /* Body */
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

  LOG("overlay created & appended", {
    display: overlayRoot.style.display
  });

  return overlayRoot;
}

/**
 * 좌/우 컬럼 생성
 */
function createColumn(id: string, label: string) {
  LOG("createColumn()", { id, label });

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

/**
 * 좌우 컬럼 뒤집기
 */
function applyFlip() {
  LOG("applyFlip()", { isFlipped });

  const body = document.getElementById("str-body");
  if (!body) return;

  body.style.direction = isFlipped ? "rtl" : "ltr";
  body.querySelectorAll<HTMLElement>(".str-col-content").forEach((el) => {
    el.style.direction = "ltr";
  });
}

/**
 * 원문 업데이트
 */
function updateOriginal(text: string) {
  LOG("updateOriginal()", { text });

  const el = document.querySelector<HTMLDivElement>(
    "#str-col-left .str-col-content"
  );
  if (el) el.textContent = text || "Select text on the page.";
}

/**
 * 오버레이 표시
 */
function showOverlay() {
  LOG("showOverlay()", {
    enabled,
    selection: window.getSelection()?.toString()
  });

  const root = ensureOverlay();

  if (originalHtmlMarginRight === null) {
    originalHtmlMarginRight = document.documentElement.style.marginRight;
    originalBodyOverflowX = document.body.style.overflowX;

    document.documentElement.style.marginRight = `${PANEL_WIDTH}px`;
    document.body.style.overflowX = "hidden";

    LOG("page layout adjusted");
  }

  root.style.display = "block";
  LOG("overlay display = block");

  updateOriginal(window.getSelection()?.toString().trim() ?? "");
}

/**
 * 오버레이 숨김
 */
function hideOverlay() {
  LOG("hideOverlay()");

  if (!overlayRoot) return;
  overlayRoot.style.display = "none";

  if (originalHtmlMarginRight !== null) {
    document.documentElement.style.marginRight =
      originalHtmlMarginRight ?? "";
    document.body.style.overflowX =
      originalBodyOverflowX ?? "";

    originalHtmlMarginRight = null;
    originalBodyOverflowX = null;

    LOG("page layout restored");
  }
}

/**
 * 텍스트 선택 변경 감지
 */
document.addEventListener("selectionchange", () => {
  LOG("selectionchange event", { enabled });

  if (!enabled) return;
  if (!overlayRoot || overlayRoot.style.display === "none") return;

  const sel = window.getSelection();
  const text = sel?.toString().trim() ?? "";

  LOG("selection text", text);

  updateOriginal(text);

  if (text && isChromeTranslated) {
    LOG("calling updateMatchedTranslation()");
    updateMatchedTranslation(sel!);
  }
});

/* =========================
 * Chrome 번역 감지
 * ========================= */
let isChromeTranslated = false;

function checkChromeTranslateState() {
  const html = document.documentElement;
  const translated =
    html.classList.contains("translated-ltr") ||
    html.classList.contains("translated-rtl");

  LOG("checkChromeTranslateState()", {
    className: html.className,
    translated,
    prev: isChromeTranslated
  });

  if (translated !== isChromeTranslated) {
    isChromeTranslated = translated;
    onChromeTranslateStateChange(translated);
  }
}

function onChromeTranslateStateChange(translated: boolean) {
  LOG("onChromeTranslateStateChange()", translated);

  const el = document.querySelector<HTMLDivElement>(
    "#str-col-right .str-col-content"
  );
  LOG("translation column exists?", !!el);

  if (!el) return;

  if (!translated) {
    el.textContent = "Translation will appear here.";
    return;
  }

  const translatedText = collectTranslatedParagraphs();
  LOG("translated paragraphs collected", translatedText.length);

  el.textContent =
    translatedText.length > 0
      ? translatedText.join("\n\n")
      : "(Translated page detected, but no text collected)";
}

/**
 * 번역 문단 수집
 */
function collectTranslatedParagraphs(): string[] {
  const TAGS = ["P", "H1", "H2", "H3", "LI"];
  const nodes = Array.from(
    document.body.querySelectorAll<HTMLElement>(TAGS.join(","))
  );

  LOG("collectTranslatedParagraphs()", { nodeCount: nodes.length });

  const results: string[] = [];

  for (const el of nodes) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const text = el.innerText?.trim();
    if (!text || text.length < 30) continue;

    results.push(text);
    if (results.length >= 5) break;
  }

  return results;
}

/**
 * 선택 위치 기반 번역 매칭
 */
function updateMatchedTranslation(sel: Selection) {
  LOG("updateMatchedTranslation()", sel.toString());

  const el = document.querySelector<HTMLDivElement>(
    "#str-col-right .str-col-content"
  );
  if (!el) return;

  const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
  if (!range) return;

  const selRect = range.getBoundingClientRect();
  if (!selRect) return;

  const candidates = collectTranslatedParagraphElements();
  LOG("candidate paragraphs", candidates.length);

  let bestEl: HTMLElement | null = null;
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
    el.textContent = sentences.slice(0, 2).join(" ");
  }
}

function collectTranslatedParagraphElements(): HTMLElement[] {
  const TAGS = ["P", "H1", "H2", "H3", "LI"];
  return Array.from(
    document.body.querySelectorAll<HTMLElement>(TAGS.join(","))
  ).filter((el) => {
    const text = el.innerText?.trim();
    if (!text || text.length < 30) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function distanceBetweenRects(a: DOMRect, b: DOMRect): number {
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const bx = b.left + b.width / 2;
  const by = b.top + b.height / 2;
  return Math.hypot(ax - bx, ay - by);
}

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?。！？])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
}

/**
 * START / STOP 메시지
 */
chrome.runtime.onMessage.addListener((msg: Msg) => {
  LOG("onMessage()", msg);

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

/**
 * Chrome 번역 상태 observer
 */
new MutationObserver(() => {
  if (!enabled) return;
  LOG("MutationObserver triggered");
  checkChromeTranslateState();
}).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["class"]
});
