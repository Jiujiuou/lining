(function() {
  "use strict";
  const OU_STORAGE_KEYS = {
    logsByTab: "ou_userdata_logs_by_tab",
    formByTab: "ou_userdata_form_by_tab"
  };
  const OU_RUNTIME = {
    GET_TAB_ID: "OU_GET_TAB_ID"
  };
  const LOG_META_KEY = "__meta";
  function getStorageValue(result, key) {
    const value = result && result[key];
    return value && typeof value === "object" ? { ...value } : {};
  }
  function cleanupOnTabRemoved(tabId) {
    const tabIdKey = String(tabId);
    chrome.storage.local.get(
      [OU_STORAGE_KEYS.logsByTab, OU_STORAGE_KEYS.formByTab],
      (result) => {
        const logsByTab = getStorageValue(result, OU_STORAGE_KEYS.logsByTab);
        const formByTab = getStorageValue(result, OU_STORAGE_KEYS.formByTab);
        const hasLogs = Object.prototype.hasOwnProperty.call(logsByTab, tabIdKey);
        const hasForm = Object.prototype.hasOwnProperty.call(formByTab, tabIdKey);
        if (!hasLogs && !hasForm) {
          return;
        }
        delete logsByTab[tabIdKey];
        delete formByTab[tabIdKey];
        if (logsByTab[LOG_META_KEY] && typeof logsByTab[LOG_META_KEY] === "object") {
          delete logsByTab[LOG_META_KEY][tabIdKey];
        }
        chrome.storage.local.set({
          [OU_STORAGE_KEYS.logsByTab]: logsByTab,
          [OU_STORAGE_KEYS.formByTab]: formByTab
        });
      }
    );
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== OU_RUNTIME.GET_TAB_ID) {
      return false;
    }
    if (sender.tab && sender.tab.id != null) {
      sendResponse({ tabId: sender.tab.id });
      return true;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
      sendResponse({ tabId });
    });
    return true;
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    cleanupOnTabRemoved(tabId);
  });
})();
//# sourceMappingURL=background.js.map
