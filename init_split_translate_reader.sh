#!/usr/bin/env bash
set -euo pipefail

echo "▶ Initializing Split Translate Reader (MVP scaffold)"

# directory structure
mkdir -p \
  src/content \
  src/background \
  src/popup \
  src/shared \
  scripts \
  dist

# package.json
cat > package.json <<'JSON'
{
  "name": "split-translate-reader",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build.mjs",
    "watch": "node scripts/build.mjs --watch"
  },
  "devDependencies": {
    "esbuild": "^0.24.0",
    "typescript": "^5.5.4",
    "@types/chrome": "^0.0.268"
  }
}
JSON

# tsconfig.json
cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["chrome"]
  },
  "include": ["src/**/*"]
}
JSON

# manifest.json (MV3)
cat > manifest.json <<'JSON'
{
  "manifest_version": 3,
  "name": "Split Translate Reader",
  "version": "0.1.0",
  "description": "Split view: original and translated text side-by-side (MVP).",
  "action": {
    "default_popup": "dist/popup.html"
  },
  "background": {
    "service_worker": "dist/background.js",
    "type": "module"
  },
  "permissions": ["storage"],
  "host_permissions": ["<all_urls>"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["dist/content.js"],
      "run_at": "document_idle"
    }
  ]
}
JSON

# build script
cat > scripts/build.mjs <<'JS'
import esbuild from "esbuild";
import fs from "node:fs";

const watch = process.argv.includes("--watch");

function copyStatic() {
  fs.copyFileSync("src/popup/popup.html", "dist/popup.html");
  fs.copyFileSync("src/popup/popup.css", "dist/popup.css");
}

const config = {
  bundle: true,
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  outdir: "dist",
  entryPoints: {
    content: "src/content/content.ts",
    background: "src/background/background.ts",
    popup: "src/popup/popup.ts"
  }
};

if (watch) {
  copyStatic();
  const ctx = await esbuild.context(config);
  await ctx.watch();
  fs.watch("src/popup", { recursive: true }, copyStatic);
  console.log("▶ Watching (esbuild + static assets)");
} else {
  copyStatic();
  await esbuild.build(config);
}
JS

# shared types
cat > src/shared/types.ts <<'TS'
export type TargetLang = "auto" | "ko" | "en" | "ja" | "zh-CN" | "zh-TW";

export interface StorageSchema {
  targetLang?: TargetLang;
}
TS

# background
cat > src/background/background.ts <<'TS'
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["targetLang"], (res) => {
    if (!res.targetLang) {
      chrome.storage.sync.set({ targetLang: "auto" });
    }
  });
});
TS

# popup.html
cat > src/popup/popup.html <<'HTML'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="stylesheet" href="./popup.css" />
  <title>Split Translate Reader</title>
</head>
<body>
  <h1>Split Translate Reader</h1>

  <label>
    Target language
    <select id="targetLang">
      <option value="auto">Auto</option>
      <option value="ko">Korean</option>
      <option value="en">English</option>
      <option value="ja">Japanese</option>
      <option value="zh-CN">Chinese (CN)</option>
      <option value="zh-TW">Chinese (TW)</option>
    </select>
  </label>

  <button id="toggle">Toggle Overlay</button>

  <script type="module" src="./popup.js"></script>
</body>
</html>
HTML

# popup.css
cat > src/popup/popup.css <<'CSS'
body {
  font-family: system-ui, sans-serif;
  width: 300px;
  padding: 12px;
}

h1 {
  font-size: 16px;
  margin-bottom: 12px;
}

select, button {
  width: 100%;
  margin-top: 8px;
  padding: 8px;
}
CSS

# popup.ts
cat > src/popup/popup.ts <<'TS'
import { TargetLang } from "../shared/types";

const select = document.getElementById("targetLang") as HTMLSelectElement;
const toggle = document.getElementById("toggle") as HTMLButtonElement;

chrome.storage.sync.get(["targetLang"], (res) => {
  select.value = (res.targetLang ?? "auto") as TargetLang;
});

select.addEventListener("change", () => {
  chrome.storage.sync.set({ targetLang: select.value });
});

toggle.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAY" });
  }
});
TS

# content script
cat > src/content/content.ts <<'TS'
let overlay: HTMLDivElement | null = null;

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

  overlay.style.display =
    overlay.style.display === "none" ? "block" : "none";
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
TS

# install deps
npm install

echo "✅ Init complete."
echo "Next:"
echo "  npm run build"
echo "  chrome://extensions → Load unpacked → this folder"
