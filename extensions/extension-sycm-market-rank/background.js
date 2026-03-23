/**
 * tabId 查询；关闭标签时清理本扩展按 tab 分桶的 storage（与 extension-sycm-detail 键隔离）
 */
importScripts('constants/defaults.js');

(function () {
  var defs = self.__SYCM_RANK_DEFAULTS__;
  if (!defs || !defs.STORAGE_KEYS) return;
  var KEYS = defs.STORAGE_KEYS;
  var LOGS_BY_TAB = KEYS.logsByTab;
  var CATALOG_BY_TAB = KEYS.rankCatalogByTab;
  var FILTER_BY_TAB = KEYS.rankFilterByTab;
  var GET_TAB_MSG =
    defs.RUNTIME && defs.RUNTIME.GET_TAB_ID_MESSAGE ? defs.RUNTIME.GET_TAB_ID_MESSAGE : 'SYCM_RANK_GET_TAB_ID';

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
    chrome.storage.local.get([FILTER_BY_TAB, CATALOG_BY_TAB, LOGS_BY_TAB], function (r) {
      var f = r && r[FILTER_BY_TAB] ? r[FILTER_BY_TAB] : {};
      var c = r && r[CATALOG_BY_TAB] ? r[CATALOG_BY_TAB] : {};
      var logs = r && r[LOGS_BY_TAB] ? r[LOGS_BY_TAB] : {};
      if (!f[idStr] && !c[idStr] && !logs[idStr]) return;
      delete f[idStr];
      delete c[idStr];
      delete logs[idStr];
      var payload = {};
      payload[FILTER_BY_TAB] = f;
      payload[CATALOG_BY_TAB] = c;
      payload[LOGS_BY_TAB] = logs;
      chrome.storage.local.set(payload, function () {});
    });
  });
})();
