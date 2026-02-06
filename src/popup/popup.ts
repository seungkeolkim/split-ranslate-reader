import { TargetLang } from "../shared/types";

const select = document.getElementById("targetLang") as HTMLSelectElement;
const btnStart = document.getElementById("btnStart") as HTMLButtonElement;
const btnStop = document.getElementById("btnStop") as HTMLButtonElement;

// Load stored target language
chrome.storage.sync.get(["targetLang"], (res) => {
  select.value = (res.targetLang ?? "auto") as TargetLang;
});

select.addEventListener("change", () => {
  chrome.storage.sync.set({ targetLang: select.value });
});

async function sendToActiveTab(type: "START" | "STOP") {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type });
}

btnStart.addEventListener("click", () => {
  sendToActiveTab("START");
});

btnStop.addEventListener("click", () => {
  sendToActiveTab("STOP");
});
