/**
 * 扩展日志：按标签页分桶（popup 与 background 写入一致）
 */
(function (global) {
  var DEFS = typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" ? __SHOP_RECORD_DEFAULTS__ : null;
  var KEYS = DEFS && DEFS.STORAGE_KEYS ? DEFS.STORAGE_KEYS : { logs: "shop_record_logs", logsByTab: "shop_record_logs_by_tab" };
  var MAX = DEFS && DEFS.LOG_MAX_ENTRIES ? DEFS.LOG_MAX_ENTRIES : 100;
  var GET_TAB_MSG =
    DEFS && DEFS.RUNTIME && DEFS.RUNTIME.GET_TAB_ID_MESSAGE
      ? DEFS.RUNTIME.GET_TAB_ID_MESSAGE
      : "SR_GET_TAB_ID";
  var LOG_KEY = KEYS.logs || "shop_record_logs";
  var LOGS_BY_TAB_KEY = KEYS.logsByTab || "shop_record_logs_by_tab";

  function resolveTabId(callback) {
    try {
      chrome.runtime.sendMessage({ type: GET_TAB_MSG }, function (res) {
        if (chrome.runtime.lastError || !res || res.tabId == null) {
          callback(null);
        } else {
          callback(res.tabId);
        }
      });
    } catch (e) {
      callback(null);
    }
  }

  function appendLog(level, msg) {
    var entry = { t: new Date().toISOString(), level: level || "log", msg: String(msg) };
    resolveTabId(function (tabId) {
      if (tabId == null) {
        chrome.storage.local.get([LOG_KEY], function (result) {
          var data = result[LOG_KEY];
          if (!data || !Array.isArray(data.entries)) data = { entries: [] };
          data.entries.push(entry);
          if (data.entries.length > MAX) data.entries = data.entries.slice(-MAX);
          chrome.storage.local.set({ [LOG_KEY]: data }, function () {});
        });
        return;
      }
      chrome.storage.local.get([LOGS_BY_TAB_KEY], function (result) {
        var byTab = result[LOGS_BY_TAB_KEY] || {};
        var bucket = byTab[String(tabId)] || { entries: [] };
        if (!Array.isArray(bucket.entries)) bucket.entries = [];
        bucket.entries.push(entry);
        if (bucket.entries.length > MAX) bucket.entries = bucket.entries.slice(-MAX);
        byTab[String(tabId)] = bucket;
        var o = {};
        o[LOGS_BY_TAB_KEY] = byTab;
        chrome.storage.local.set(o, function () {});
      });
    });
  }

  function getLogs(callback, tabId) {
    if (tabId == null) {
      chrome.storage.local.get([LOG_KEY], function (result) {
        var data = result[LOG_KEY];
        callback(data && Array.isArray(data.entries) ? data.entries : []);
      });
      return;
    }
    chrome.storage.local.get([LOGS_BY_TAB_KEY], function (result) {
      var byTab = result[LOGS_BY_TAB_KEY] || {};
      var bucket = byTab[String(tabId)];
      var entries = bucket && Array.isArray(bucket.entries) ? bucket.entries : [];
      callback(entries);
    });
  }

  function clearLogs(callback, tabId) {
    if (tabId == null) {
      chrome.storage.local.set({ [LOG_KEY]: { entries: [] } }, callback || function () {});
      return;
    }
    chrome.storage.local.get([LOGS_BY_TAB_KEY], function (result) {
      var byTab = result[LOGS_BY_TAB_KEY] || {};
      delete byTab[String(tabId)];
      var o = {};
      o[LOGS_BY_TAB_KEY] = byTab;
      chrome.storage.local.set(o, callback || function () {});
    });
  }

  var obj = {
    appendLog: appendLog,
    getLogs: getLogs,
    clearLogs: clearLogs,
    log: function (msg) {
      appendLog("log", msg);
    },
    warn: function (msg) {
      appendLog("warn", msg);
    },
    error: function (msg) {
      appendLog("error", msg);
    }
  };
  (typeof globalThis !== "undefined" ? globalThis : global).__SHOP_RECORD_LOGGER__ = obj;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
