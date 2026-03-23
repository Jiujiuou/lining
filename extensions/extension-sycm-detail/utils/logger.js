/**
 * 扩展日志：按标签页分桶写入 chrome.storage，popup 只读当前标签（旧键 sycm_logs 仅作无 tabId 时回落）
 */
(function (global) {
  var KEYS = typeof __SYCM_DEFAULTS__ !== 'undefined' && __SYCM_DEFAULTS__.STORAGE_KEYS
    ? __SYCM_DEFAULTS__.STORAGE_KEYS
    : { logs: 'sycm_logs', logsByTab: 'sycm_logs_by_tab' };
  var MAX = (typeof __SYCM_DEFAULTS__ !== 'undefined' && __SYCM_DEFAULTS__.LOG_MAX_ENTRIES) ? __SYCM_DEFAULTS__.LOG_MAX_ENTRIES : 100;
  var LOG_KEY = KEYS.logs || 'sycm_logs';
  var LOGS_BY_TAB_KEY = KEYS.logsByTab || 'sycm_logs_by_tab';

  function resolveTabId(callback) {
    try {
      chrome.runtime.sendMessage({ type: 'SYCM_GET_TAB_ID' }, function (res) {
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

  /**
   * @param {string} level - 'log' | 'warn' | 'error'
   * @param {string} msg
   */
  function appendLog(level, msg) {
    var entry = { t: new Date().toISOString(), level: level || 'log', msg: String(msg) };
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

  /**
   * @param {function(Array)} callback
   * @param {number|null|undefined} tabId - 当前标签；缺省或 null 时读旧全局 sycm_logs
   */
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

  /**
   * @param {function()} callback
   * @param {number|null|undefined} tabId
   */
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
    log: function (msg) { appendLog('log', msg); },
    warn: function (msg) { appendLog('warn', msg); },
    error: function (msg) { appendLog('error', msg); }
  };
  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_LOGGER__ = obj;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
