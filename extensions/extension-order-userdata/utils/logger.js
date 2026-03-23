(function (global) {
  var KEYS = typeof __OU_USERDATA_DEFAULTS__ !== 'undefined' && __OU_USERDATA_DEFAULTS__.STORAGE_KEYS
    ? __OU_USERDATA_DEFAULTS__.STORAGE_KEYS
    : { logs: 'ou_userdata_logs', logsByTab: 'ou_userdata_logs_by_tab' };
  var MAX = (typeof __OU_USERDATA_DEFAULTS__ !== 'undefined' && __OU_USERDATA_DEFAULTS__.LOG_MAX_ENTRIES) ? __OU_USERDATA_DEFAULTS__.LOG_MAX_ENTRIES : 100;
  var LOG_KEY = KEYS.logs || 'ou_userdata_logs';
  var LOGS_BY_TAB_KEY = KEYS.logsByTab || 'ou_userdata_logs_by_tab';

  function resolveTabId(callback) {
    try {
      chrome.runtime.sendMessage({ type: 'OU_GET_TAB_ID' }, function (res) {
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
    log: function (msg) { appendLog('log', msg); },
    warn: function (msg) { appendLog('warn', msg); },
    error: function (msg) { appendLog('error', msg); }
  };
  (typeof globalThis !== 'undefined' ? globalThis : global).__OU_USERDATA_LOGGER__ = obj;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
