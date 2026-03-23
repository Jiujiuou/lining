/**
 * Service worker：为 content 提供 tabId；关闭标签时清理本扩展按 tab 分桶的 storage
 */
(function () {
  var FILTER_BY_TAB = 'sycm_live_json_filter_by_tab';
  var CATALOG_BY_TAB = 'sycm_live_json_catalog_by_tab';
  var LOGS_BY_TAB = 'sycm_logs_by_tab';

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || msg.type !== 'SYCM_GET_TAB_ID') return false;
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
