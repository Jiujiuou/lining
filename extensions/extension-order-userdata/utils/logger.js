(function (global) {
  var KEYS = typeof __OU_USERDATA_DEFAULTS__ !== 'undefined' && __OU_USERDATA_DEFAULTS__.STORAGE_KEYS
    ? __OU_USERDATA_DEFAULTS__.STORAGE_KEYS
    : { logs: 'ou_userdata_logs' };
  var MAX = (typeof __OU_USERDATA_DEFAULTS__ !== 'undefined' && __OU_USERDATA_DEFAULTS__.LOG_MAX_ENTRIES) ? __OU_USERDATA_DEFAULTS__.LOG_MAX_ENTRIES : 100;
  var LOG_KEY = KEYS.logs || 'ou_userdata_logs';

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
