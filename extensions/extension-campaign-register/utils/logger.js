(function (global) {
  var KEYS = typeof __AMCR_DEFAULTS__ !== 'undefined' && __AMCR_DEFAULTS__.STORAGE_KEYS
    ? __AMCR_DEFAULTS__.STORAGE_KEYS
    : { logs: 'amcr_logs' };
  var MAX = (typeof __AMCR_DEFAULTS__ !== 'undefined' && __AMCR_DEFAULTS__.LOG_MAX_ENTRIES) ? __AMCR_DEFAULTS__.LOG_MAX_ENTRIES : 100;
  var LOG_KEY = KEYS.logs || 'amcr_logs';

  function appendLog(level, msg) {
    var entry = { t: new Date().toISOString(), level: level || 'log', msg: String(msg) };
    chrome.storage.local.get([LOG_KEY], function (result) {
      var data = result[LOG_KEY];
      if (!data || !Array.isArray(data.entries)) data = { entries: [] };
      data.entries.push(entry);
      if (data.entries.length > MAX) data.entries = data.entries.slice(-MAX);
      chrome.storage.local.set({ [LOG_KEY]: data }, function () {});
    });
  }

  function getLogs(callback) {
    chrome.storage.local.get([LOG_KEY], function (result) {
      var data = result[LOG_KEY];
      callback(data && Array.isArray(data.entries) ? data.entries : []);
    });
  }

  function clearLogs(callback) {
    chrome.storage.local.set({ [LOG_KEY]: { entries: [] } }, callback || function () {});
  }

  (typeof globalThis !== 'undefined' ? globalThis : global).__AMCR_LOGGER__ = {
    appendLog: appendLog,
    getLogs: getLogs,
    clearLogs: clearLogs,
    log: function (msg) { appendLog('log', msg); },
    warn: function (msg) { appendLog('warn', msg); },
    error: function (msg) { appendLog('error', msg); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
