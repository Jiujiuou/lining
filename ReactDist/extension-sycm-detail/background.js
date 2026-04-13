(function() {
  "use strict";
  function initBackground() {
    if (globalThis.__LINING_SYCM_DETAIL_BG__) return;
    globalThis.__LINING_SYCM_DETAIL_BG__ = true;
    (function() {
      var FILTER_BY_TAB = "sycm_live_json_filter_by_tab";
      var CATALOG_BY_TAB = "sycm_live_json_catalog_by_tab";
      var LOGS_BY_TAB = "sycm_logs_by_tab";
      var META_KEY = "__meta";
      var LOG_META_KEY = "__meta";
      function safeSet(payload, cb) {
        chrome.storage.local.set(payload, function() {
        });
      }
      chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
        if (!msg || msg.type !== "SYCM_GET_TAB_ID") return false;
        if (sender.tab && sender.tab.id != null) {
          sendResponse({ tabId: sender.tab.id });
          return true;
        }
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          var id = tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
          sendResponse({ tabId: id });
        });
        return true;
      });
      chrome.tabs.onRemoved.addListener(function(tabId) {
        var idStr = String(tabId);
        chrome.storage.local.get([FILTER_BY_TAB, CATALOG_BY_TAB, LOGS_BY_TAB], function(r) {
          var f = r && r[FILTER_BY_TAB] ? r[FILTER_BY_TAB] : {};
          var c = r && r[CATALOG_BY_TAB] ? r[CATALOG_BY_TAB] : {};
          var logs = r && r[LOGS_BY_TAB] ? r[LOGS_BY_TAB] : {};
          if (!f[idStr] && !c[idStr] && !logs[idStr]) return;
          delete f[idStr];
          delete c[idStr];
          delete logs[idStr];
          if (f[META_KEY] && typeof f[META_KEY] === "object") delete f[META_KEY][idStr];
          if (c[META_KEY] && typeof c[META_KEY] === "object") delete c[META_KEY][idStr];
          if (logs[LOG_META_KEY] && typeof logs[LOG_META_KEY] === "object") {
            delete logs[LOG_META_KEY][idStr];
          }
          var payload = {};
          payload[FILTER_BY_TAB] = f;
          payload[CATALOG_BY_TAB] = c;
          payload[LOGS_BY_TAB] = logs;
          safeSet(payload);
        });
      });
    })();
  }
  initBackground();
})();
//# sourceMappingURL=background.js.map
