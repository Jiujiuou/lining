/**
 * 扩展日志：按标签页分桶；popup 只读当前标签（旧键 amcr_logs 仅作无 tabId 时回落）
 */
(function (global) {
  var KEYS = typeof __AMCR_DEFAULTS__ !== 'undefined' && __AMCR_DEFAULTS__.STORAGE_KEYS
    ? __AMCR_DEFAULTS__.STORAGE_KEYS
    : { logs: 'amcr_logs', logsByTab: 'amcr_logs_by_tab' };
  var MAX = (typeof __AMCR_DEFAULTS__ !== 'undefined' && __AMCR_DEFAULTS__.LOG_MAX_ENTRIES) ? __AMCR_DEFAULTS__.LOG_MAX_ENTRIES : 20;
  var MAX_TABS = (typeof __AMCR_DEFAULTS__ !== 'undefined' && __AMCR_DEFAULTS__.LOG_MAX_TABS) ? __AMCR_DEFAULTS__.LOG_MAX_TABS : 6;
  var LOG_KEY = KEYS.logs || 'amcr_logs';
  var LOGS_BY_TAB_KEY = KEYS.logsByTab || 'amcr_logs_by_tab';
  var LOG_META_KEY = '__meta';
  function isQuotaError(err) {
    if (!err) return false;
    return /quota|QUOTA_BYTES|Resource::kQuotaBytes/i.test(String(err.message || err));
  }
  function safeSet(payload, cb) {
    chrome.storage.local.set(payload, function () {
      if (chrome.runtime && chrome.runtime.lastError && isQuotaError(chrome.runtime.lastError)) {
        return cb && cb(true);
      }
      if (cb) cb(false);
    });
  }

  function pruneTabLogs(byTab) {
    if (!byTab || typeof byTab !== 'object') return {};
    var meta = byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === 'object' ? byTab[LOG_META_KEY] : {};
    var tabIds = Object.keys(byTab).filter(function (k) { return k !== LOG_META_KEY; });
    if (tabIds.length <= MAX_TABS) {
      byTab[LOG_META_KEY] = meta;
      return byTab;
    }
    tabIds.sort(function (a, b) {
      var ta = meta[a] || '';
      var tb = meta[b] || '';
      return String(ta).localeCompare(String(tb));
    });
    while (tabIds.length > MAX_TABS) {
      var oldest = tabIds.shift();
      delete byTab[oldest];
      delete meta[oldest];
    }
    byTab[LOG_META_KEY] = meta;
    return byTab;
  }

  function resolveTabId(callback) {
    try {
      chrome.runtime.sendMessage({ type: 'AMCR_GET_TAB_ID' }, function (res) {
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
        byTab = pruneTabLogs(byTab);
        var o = {};
        o[LOGS_BY_TAB_KEY] = byTab;
        safeSet(o, function (quotaErr) {
          if (!quotaErr) return;
          byTab = pruneTabLogs(byTab);
          safeSet(o, function () {});
        });
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

  (typeof globalThis !== 'undefined' ? globalThis : global).__AMCR_LOGGER__ = {
    appendLog: appendLog,
    getLogs: getLogs,
    clearLogs: clearLogs
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
