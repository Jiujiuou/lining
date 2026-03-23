/**
 * Service worker：content 获取 tabId；关闭标签时清理按 tab 的推广列表缓存
 */
(function () {
  var STATE_BY_TAB = 'amcr_findPageStateByTab';
  var LOGS_BY_TAB = 'amcr_logs_by_tab';

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || msg.type !== 'AMCR_GET_TAB_ID') return false;
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
    chrome.storage.local.get([STATE_BY_TAB, LOGS_BY_TAB], function (r) {
      var byTab = r && r[STATE_BY_TAB] ? r[STATE_BY_TAB] : {};
      var logs = r && r[LOGS_BY_TAB] ? r[LOGS_BY_TAB] : {};
      var hasState = Object.prototype.hasOwnProperty.call(byTab, String(tabId));
      var hasLogs = Object.prototype.hasOwnProperty.call(logs, String(tabId));
      if (!hasState && !hasLogs) return;
      delete byTab[String(tabId)];
      delete logs[String(tabId)];
      var o = {};
      o[STATE_BY_TAB] = byTab;
      o[LOGS_BY_TAB] = logs;
      chrome.storage.local.set(o, function () {});
    });
  });
})();
