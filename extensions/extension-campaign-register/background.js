/**
 * Service worker：content 获取 tabId；关闭标签时清理按 tab 的推广列表缓存；捕获 findPage 日志写入与 popup 同结构的按 tab 日志
 */
(function () {
  var STATE_BY_TAB = 'amcr_findPageStateByTab';
  var LOGS_BY_TAB = 'amcr_logs_by_tab';
  var LOG_KEY = 'amcr_logs';
  var MAX_LOG_ENTRIES = 20;
  var MAX_LOG_TABS = 6;
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

  function pruneTabMapByMeta(byTab, maxTabs, metaKey) {
    if (!byTab || typeof byTab !== 'object') return {};
    var meta = byTab[metaKey] && typeof byTab[metaKey] === 'object' ? byTab[metaKey] : {};
    var tabIds = Object.keys(byTab).filter(function (k) { return k !== metaKey; });
    if (tabIds.length <= maxTabs) {
      byTab[metaKey] = meta;
      return byTab;
    }
    tabIds.sort(function (a, b) {
      var ta = meta[a] || '';
      var tb = meta[b] || '';
      return String(ta).localeCompare(String(tb));
    });
    while (tabIds.length > maxTabs) {
      var oldest = tabIds.shift();
      delete byTab[oldest];
      delete meta[oldest];
    }
    byTab[metaKey] = meta;
    return byTab;
  }

  function appendCaptureLogEntry(tabId, msg) {
    var entry = { t: new Date().toISOString(), level: 'log', msg: String(msg) };
    if (tabId == null) {
      chrome.storage.local.get([LOG_KEY], function (r) {
        var data = r[LOG_KEY];
        if (!data || !Array.isArray(data.entries)) data = { entries: [] };
        data.entries.push(entry);
        if (data.entries.length > MAX_LOG_ENTRIES) data.entries = data.entries.slice(-MAX_LOG_ENTRIES);
        var o = {};
        o[LOG_KEY] = data;
        safeSet(o, function () {});
      });
      return;
    }
    chrome.storage.local.get([LOGS_BY_TAB], function (r) {
      var byTab = r[LOGS_BY_TAB] || {};
      var bucket = byTab[String(tabId)] || { entries: [] };
      if (!Array.isArray(bucket.entries)) bucket.entries = [];
      bucket.entries.push(entry);
      if (bucket.entries.length > MAX_LOG_ENTRIES) bucket.entries = bucket.entries.slice(-MAX_LOG_ENTRIES);
      byTab[String(tabId)] = bucket;
      var meta = byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === 'object' ? byTab[LOG_META_KEY] : {};
      meta[String(tabId)] = new Date().toISOString();
      byTab[LOG_META_KEY] = meta;
      byTab = pruneTabMapByMeta(byTab, MAX_LOG_TABS, LOG_META_KEY);
      var o = {};
      o[LOGS_BY_TAB] = byTab;
      safeSet(o, function (quotaErr) {
        if (!quotaErr) return;
        byTab = pruneTabMapByMeta(byTab, Math.max(1, MAX_LOG_TABS - 1), LOG_META_KEY);
        o[LOGS_BY_TAB] = byTab;
        safeSet(o, function () {});
      });
    });
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === 'AMCR_CAPTURE_LOG') {
      appendCaptureLogEntry(msg.tabId != null ? msg.tabId : null, msg.msg || '');
      sendResponse({ ok: true });
      return true;
    }
    if (!msg || msg.type !== 'AMCR_GET_TAB_ID') return false;
    if (sender.tab && sender.tab.id != null) {
      sendResponse({ tabId: sender.tab.id });
      return true;
    }
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
      var id = tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
      sendResponse({ tabId: id });
    });
    return true;
  });

  chrome.tabs.onRemoved.addListener(function (tabId) {
    chrome.storage.local.get([STATE_BY_TAB, LOGS_BY_TAB], function (r) {
      var byTab = r && r[STATE_BY_TAB] ? r[STATE_BY_TAB] : {};
      var logs = r && r[LOGS_BY_TAB] ? r[LOGS_BY_TAB] : {};
      var hasState = Object.prototype.hasOwnProperty.call(byTab, String(tabId));
      var hasLogs = Object.prototype.hasOwnProperty.call(logs, String(tabId));
      if (!hasState && !hasLogs) return;
      delete byTab[String(tabId)];
      delete logs[String(tabId)];
      if (logs[LOG_META_KEY] && typeof logs[LOG_META_KEY] === 'object') {
        delete logs[LOG_META_KEY][String(tabId)];
      }
      var o = {};
      o[STATE_BY_TAB] = byTab;
      o[LOGS_BY_TAB] = logs;
      safeSet(o, function () {});
    });
  });
})();
