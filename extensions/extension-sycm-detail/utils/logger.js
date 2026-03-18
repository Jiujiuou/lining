/**
 * 扩展日志：写入 chrome.storage，供 popup 展示（不写 console）
 * content 与 inject（经 content 转发）的日志统一汇聚到此
 */
(function (global) {
  var KEYS = typeof __SYCM_DEFAULTS__ !== 'undefined' && __SYCM_DEFAULTS__.STORAGE_KEYS
    ? __SYCM_DEFAULTS__.STORAGE_KEYS
    : { logs: 'sycm_logs' };
  var MAX = (typeof __SYCM_DEFAULTS__ !== 'undefined' && __SYCM_DEFAULTS__.LOG_MAX_ENTRIES) ? __SYCM_DEFAULTS__.LOG_MAX_ENTRIES : 100;
  var LOG_KEY = KEYS.logs || 'sycm_logs';

  /**
   * 追加一条日志
   * @param {string} level - 'log' | 'warn' | 'error'
   * @param {string} msg
   */
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

  /**
   * 获取日志列表（从旧到新）
   * @param {function({ entries: Array<{t,level,msg}> })} callback
   */
  function getLogs(callback) {
    chrome.storage.local.get([LOG_KEY], function (result) {
      var data = result[LOG_KEY];
      callback(data && Array.isArray(data.entries) ? data.entries : []);
    });
  }

  /**
   * 清空日志
   * @param {function()} callback
   */
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
  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_LOGGER__ = obj;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
