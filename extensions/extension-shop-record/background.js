/**
 * 与 extension-template 同源：importScripts(defaults) 取键名与消息 type；内容脚本 append 带 sender.tab；
 * 串行队列；按 tab 分桶；关标签清理。业务差异：评价页 onUpdated。
 */
importScripts("constants/defaults.js");

(function () {
  var SR = self.__SHOP_RECORD_DEFAULTS__;
  if (!SR || !SR.STORAGE_KEYS || !SR.RUNTIME) return;

  var LOG_KEY = SR.STORAGE_KEYS.logs;
  var LOGS_BY_TAB = SR.STORAGE_KEYS.logsByTab;
  var MAX = SR.LOG_MAX_ENTRIES;
  var GET_TAB_MSG = SR.RUNTIME.GET_TAB_ID_MESSAGE;
  var APPEND_MSG = SR.RUNTIME.CONTENT_APPEND_LOG_MESSAGE;

  var logQueue = [];
  var logWriting = false;

  function appendLogEntry(tabId, level, msg) {
    var entry = { t: new Date().toISOString(), level: level || "log", msg: String(msg) };
    if (tabId == null) {
      chrome.storage.local.get([LOG_KEY], function (result) {
        if (chrome.runtime.lastError) {
          logWriting = false;
          flushLogQueue();
          return;
        }
        var data = result[LOG_KEY];
        if (!data || !Array.isArray(data.entries)) data = { entries: [] };
        data.entries.push(entry);
        if (data.entries.length > MAX) data.entries = data.entries.slice(-MAX);
        chrome.storage.local.set({ [LOG_KEY]: data }, function () {
          logWriting = false;
          flushLogQueue();
        });
      });
      return;
    }
    chrome.storage.local.get([LOGS_BY_TAB], function (result) {
      if (chrome.runtime.lastError) {
        logWriting = false;
        flushLogQueue();
        return;
      }
      var byTab = result[LOGS_BY_TAB] || {};
      var bucket = byTab[String(tabId)] || { entries: [] };
      if (!Array.isArray(bucket.entries)) bucket.entries = [];
      bucket.entries.push(entry);
      if (bucket.entries.length > MAX) bucket.entries = bucket.entries.slice(-MAX);
      byTab[String(tabId)] = bucket;
      var o = {};
      o[LOGS_BY_TAB] = byTab;
      chrome.storage.local.set(o, function () {
        logWriting = false;
        flushLogQueue();
      });
    });
  }

  function flushLogQueue() {
    if (logWriting || logQueue.length === 0) return;
    logWriting = true;
    var item = logQueue.shift();
    appendLogEntry(item.tabId, item.level, item.msg);
  }

  function enqueueLog(tabId, level, msg) {
    logQueue.push({ tabId: tabId, level: level, msg: msg });
    flushLogQueue();
  }

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request && request.type === GET_TAB_MSG) {
      if (sender.tab && sender.tab.id != null) {
        sendResponse({ tabId: sender.tab.id });
        return true;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var id = tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
        sendResponse({ tabId: id });
      });
      return true;
    }
    if (!request || request.type !== APPEND_MSG) return false;
    var tabId = sender.tab && sender.tab.id != null ? sender.tab.id : null;
    enqueueLog(tabId, request.level || "log", request.msg);
    sendResponse({ ok: true });
    return true;
  });

  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status !== "complete" || !tab || !tab.url) return;
    var u;
    try {
      u = new URL(tab.url);
    } catch (e) {
      return;
    }
    if (u.hostname === "rate.taobao.com" && (u.pathname || "").indexOf("/user-rate-") === 0) {
      enqueueLog(
        tabId,
        "log",
        "[店铺记录数据] 已打开评价页 " + u.pathname + (u.search ? u.search : "")
      );
    }
  });

  chrome.tabs.onRemoved.addListener(function (tabId) {
    var idStr = String(tabId);
    chrome.storage.local.get([LOGS_BY_TAB], function (r) {
      var byTab = r && r[LOGS_BY_TAB] ? r[LOGS_BY_TAB] : {};
      if (!Object.prototype.hasOwnProperty.call(byTab, idStr)) return;
      delete byTab[idStr];
      var o = {};
      o[LOGS_BY_TAB] = byTab;
      chrome.storage.local.set(o, function () {});
    });
  });
})();
