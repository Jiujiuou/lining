/**
 * tabId 供 popup/logger 使用；关闭标签时清理该标签的日志与表单缓存
 */
(function () {
  var LOGS_BY_TAB = 'ou_userdata_logs_by_tab';
  var FORM_BY_TAB = 'ou_userdata_form_by_tab';

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || msg.type !== 'OU_GET_TAB_ID') return false;
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
    chrome.storage.local.get([LOGS_BY_TAB, FORM_BY_TAB], function (r) {
      var logs = r && r[LOGS_BY_TAB] ? r[LOGS_BY_TAB] : {};
      var forms = r && r[FORM_BY_TAB] ? r[FORM_BY_TAB] : {};
      if (!Object.prototype.hasOwnProperty.call(logs, idStr) && !Object.prototype.hasOwnProperty.call(forms, idStr)) {
        return;
      }
      delete logs[idStr];
      delete forms[idStr];
      var o = {};
      o[LOGS_BY_TAB] = logs;
      o[FORM_BY_TAB] = forms;
      chrome.storage.local.set(o, function () {});
    });
  });
})();
