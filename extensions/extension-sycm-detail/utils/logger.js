/**
 * 扩展日志：按标签页分桶写入 chrome.storage，popup 只读当前标签（旧键 sycm_logs 仅作无 tabId 时回落）
 */
(function (global) {
  var KEYS = typeof __SYCM_DEFAULTS__ !== 'undefined' && __SYCM_DEFAULTS__.STORAGE_KEYS
    ? __SYCM_DEFAULTS__.STORAGE_KEYS
    : { logs: 'sycm_logs', logsByTab: 'sycm_logs_by_tab' };
  var MAX = (typeof __SYCM_DEFAULTS__ !== 'undefined' && __SYCM_DEFAULTS__.LOG_MAX_ENTRIES) ? __SYCM_DEFAULTS__.LOG_MAX_ENTRIES : 20;
  var MAX_TABS = (typeof __SYCM_DEFAULTS__ !== 'undefined' && __SYCM_DEFAULTS__.LOG_MAX_TABS) ? __SYCM_DEFAULTS__.LOG_MAX_TABS : 6;
  var LOG_KEY = KEYS.logs || 'sycm_logs';
  var LOGS_BY_TAB_KEY = KEYS.logsByTab || 'sycm_logs_by_tab';
  var LOG_META_KEY = '__meta';
  var common = typeof __SYCM_COMMON__ !== 'undefined' ? __SYCM_COMMON__ : null;

  function safeSet(payload, onDone, onQuota) {
    if (common && typeof common.safeSet === 'function') return common.safeSet(payload, onDone, onQuota);
    // 兜底：common.js 未加载时的极简 set
    chrome.storage.local.set(payload, function () {
      if (typeof onDone === 'function') onDone();
    });
  }

  function pruneByTab(byTab) {
    if (common && typeof common.pruneByTabWithMeta === 'function') return common.pruneByTabWithMeta(byTab, LOG_META_KEY, MAX_TABS);
    return byTab || {};
  }

  function resolveTabId(callback) {
    if (common && typeof common.resolveTabIdByMessage === 'function') return common.resolveTabIdByMessage(callback);
    try {
      chrome.runtime.sendMessage({ type: 'SYCM_GET_TAB_ID' }, function (res) {
        if (chrome.runtime.lastError || !res || res.tabId == null) callback(null);
        else callback(res.tabId);
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
          safeSet({ [LOG_KEY]: data }, function () {});
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
        var meta = byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === 'object' ? byTab[LOG_META_KEY] : {};
        meta[String(tabId)] = new Date().toISOString();
        byTab[LOG_META_KEY] = meta;
        byTab = pruneByTab(byTab);
        var o = {};
        o[LOGS_BY_TAB_KEY] = byTab;
        safeSet(o, function () {}, function (retry) {
          // storage quota 时裁剪后重试
          byTab = pruneByTab(byTab);
          safeSet(o, function () {}, function () {
            // 第二次仍 quota：忽略
          });
        });
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
      safeSet({ [LOG_KEY]: { entries: [] } }, function () {
        (callback || function () {})();
      });
      return;
    }
    chrome.storage.local.get([LOGS_BY_TAB_KEY], function (result) {
      var byTab = result[LOGS_BY_TAB_KEY] || {};
      delete byTab[String(tabId)];
      if (byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === 'object') {
        delete byTab[LOG_META_KEY][String(tabId)];
      }
      var o = {};
      o[LOGS_BY_TAB_KEY] = byTab;
      safeSet(o, function () {
        (callback || function () {})();
      });
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
