/**
 * 扩展日志：按标签页分桶（消息类型见 defaults RUNTIME.GET_TAB_ID_MESSAGE）
 */
(function (global) {
  var KEYS =
    typeof __SYCM_RANK_DEFAULTS__ !== 'undefined' && __SYCM_RANK_DEFAULTS__.STORAGE_KEYS
      ? __SYCM_RANK_DEFAULTS__.STORAGE_KEYS
      : { logs: 'sycm_rank_only_logs', logsByTab: 'sycm_rank_only_logs_by_tab' };
  var MAX =
    typeof __SYCM_RANK_DEFAULTS__ !== 'undefined' && __SYCM_RANK_DEFAULTS__.LOG_MAX_ENTRIES
      ? __SYCM_RANK_DEFAULTS__.LOG_MAX_ENTRIES
      : 20;
  var MAX_TABS =
    typeof __SYCM_RANK_DEFAULTS__ !== 'undefined' && __SYCM_RANK_DEFAULTS__.LOG_MAX_TABS
      ? __SYCM_RANK_DEFAULTS__.LOG_MAX_TABS
      : 6;
  var GET_TAB_MSG =
    typeof __SYCM_RANK_DEFAULTS__ !== 'undefined' &&
    __SYCM_RANK_DEFAULTS__.RUNTIME &&
    __SYCM_RANK_DEFAULTS__.RUNTIME.GET_TAB_ID_MESSAGE
      ? __SYCM_RANK_DEFAULTS__.RUNTIME.GET_TAB_ID_MESSAGE
      : 'SYCM_RANK_GET_TAB_ID';
  var LOG_KEY = KEYS.logs || 'sycm_rank_only_logs';
  var LOGS_BY_TAB_KEY = KEYS.logsByTab || 'sycm_rank_only_logs_by_tab';
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

  function pruneByTab(byTab) {
    if (!byTab || typeof byTab !== 'object') return {};
    var meta = byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === 'object' ? byTab[LOG_META_KEY] : {};
    var ids = Object.keys(byTab).filter(function (k) { return k !== LOG_META_KEY; });
    if (ids.length <= MAX_TABS) {
      byTab[LOG_META_KEY] = meta;
      return byTab;
    }
    ids.sort(function (a, b) {
      var ta = meta[a] || '';
      var tb = meta[b] || '';
      return String(ta).localeCompare(String(tb));
    });
    while (ids.length > MAX_TABS) {
      var oldest = ids.shift();
      delete byTab[oldest];
      delete meta[oldest];
    }
    byTab[LOG_META_KEY] = meta;
    return byTab;
  }

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
        safeSet(o, function (quotaErr) {
          if (!quotaErr) return;
          byTab = pruneByTab(byTab);
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

  var obj = {
    appendLog: appendLog,
    getLogs: getLogs,
    clearLogs: clearLogs,
    log: function (msg) {
      appendLog('log', msg);
    },
    warn: function (msg) {
      appendLog('warn', msg);
    },
    error: function (msg) {
      appendLog('error', msg);
    }
  };
  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_RANK_LOGGER__ = obj;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
