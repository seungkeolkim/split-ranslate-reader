chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["targetLang"], (res) => {
    if (!res.targetLang) {
      chrome.storage.sync.set({ targetLang: "auto" });
    }
  });
});
