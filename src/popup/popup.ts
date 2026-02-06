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
