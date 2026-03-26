/**
 * 与业务扩展同源：GET_TAB_ID（content/popup）、按 tab 清理日志分桶。
 * 键名取自 constants/defaults.js，避免与硬编码漂移。
 */
importScripts("constants/defaults.js");

(function () {
  var defs = self.__EXT_TEMPLATE_DEFAULTS__;
  if (!defs || !defs.STORAGE_KEYS) return;
  var LOGS_BY_TAB = defs.STORAGE_KEYS.logsByTab || "ext_template_logs_by_tab";
  var LOG_META_KEY = "__meta";
  function safeSet(payload, cb) {
    chrome.storage.local.set(payload, function () {
      if (cb) cb();
    });
  }
  var GET_TAB_MSG =
    defs.RUNTIME && defs.RUNTIME.GET_TAB_ID_MESSAGE ? defs.RUNTIME.GET_TAB_ID_MESSAGE : "EXT_TEMPLATE_GET_TAB_ID";

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || msg.type !== GET_TAB_MSG) return false;
    if (sender.tab && sender.tab.id != null) {
      sendResponse({ tabId: sender.tab.id });
      return true;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var id = tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
      sendResponse({ tabId: id });
    });
    return true;
  });

  chrome.tabs.onRemoved.addListener(function (tabId) {
    var idStr = String(tabId);
    chrome.storage.local.get([LOGS_BY_TAB], function (r) {
      var byTab = r && r[LOGS_BY_TAB] ? r[LOGS_BY_TAB] : {};
      if (!Object.prototype.hasOwnProperty.call(byTab, idStr)) return;
      delete byTab[idStr];
      if (byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === "object") {
        delete byTab[LOG_META_KEY][idStr];
      }
      var o = {};
      o[LOGS_BY_TAB] = byTab;
      safeSet(o, function () {});
    });
  });
})();
