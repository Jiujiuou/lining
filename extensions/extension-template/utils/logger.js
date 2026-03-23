/**
 * 扩展日志：写入 chrome.storage，供 popup 展示（业务脚本请优先用此模块而非 console）
 */
(function (global) {
  var KEYS =
    typeof __EXT_TEMPLATE_DEFAULTS__ !== "undefined" && __EXT_TEMPLATE_DEFAULTS__.STORAGE_KEYS
      ? __EXT_TEMPLATE_DEFAULTS__.STORAGE_KEYS
      : { logs: "ext_template_logs" };
  var MAX =
    typeof __EXT_TEMPLATE_DEFAULTS__ !== "undefined" && __EXT_TEMPLATE_DEFAULTS__.LOG_MAX_ENTRIES
      ? __EXT_TEMPLATE_DEFAULTS__.LOG_MAX_ENTRIES
      : 100;
  var LOG_KEY = KEYS.logs || "ext_template_logs";

  function appendLog(level, msg) {
    var entry = { t: new Date().toISOString(), level: level || "log", msg: String(msg) };
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
  (typeof globalThis !== "undefined" ? globalThis : global).__EXT_TEMPLATE_LOGGER__ = obj;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
