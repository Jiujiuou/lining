/**
 * rank 快照；按勾选 + 20 分钟时间槽（按 keyWord）上报 Supabase。
 */
importScripts('constants/defaults.js', 'constants/supabase.js', 'utils/time.js');

(function () {
  var defs = self.__SYCM_RANK_DEFAULTS__;
  if (!defs || !defs.STORAGE_KEYS || !defs.RUNTIME) return;
  var KEYS = defs.STORAGE_KEYS;
  var RUNTIME = defs.RUNTIME;
  var GET_TAB_MSG = RUNTIME.GET_TAB_ID_MESSAGE || 'SYCM_RANK_GET_TAB_ID';
  var MAX =
    typeof defs.LOG_MAX_ENTRIES === 'number' ? defs.LOG_MAX_ENTRIES : 20;
  var MAX_LOG_TABS = typeof defs.LOG_MAX_TABS === 'number' ? defs.LOG_MAX_TABS : 6;
  var MAX_RANK_TABS = typeof defs.RANK_MAX_TABS === 'number' ? defs.RANK_MAX_TABS : 6;
  var MAX_RANK_ITEMS = typeof defs.RANK_MAX_ITEMS === 'number' ? defs.RANK_MAX_ITEMS : 200;
  var DEFAULT_THROTTLE =
    defs.DEFAULTS && typeof defs.DEFAULTS.THROTTLE_MINUTES === 'number'
      ? defs.DEFAULTS.THROTTLE_MINUTES
      : 20;
  var timeUtil = self.__SYCM_RANK_TIME__;
  var getSlotKey = timeUtil && timeUtil.getSlotKey ? timeUtil.getSlotKey : function () { return ''; };
  var LOG_META_KEY = '__meta';
  var RANK_META_KEY = '__meta';
  var SELECTION_META_KEY = '__meta';

  function pruneByMeta(byTab, maxTabs, metaKey) {
    if (!byTab || typeof byTab !== 'object') return {};
    var meta = byTab[metaKey] && typeof byTab[metaKey] === 'object' ? byTab[metaKey] : {};
    var ids = Object.keys(byTab).filter(function (k) { return k !== metaKey; });
    if (ids.length <= maxTabs) {
      byTab[metaKey] = meta;
      return byTab;
    }
    ids.sort(function (a, b) {
      var ta = meta[a] || '';
      var tb = meta[b] || '';
      return String(ta).localeCompare(String(tb));
    });
    while (ids.length > maxTabs) {
      var oldest = ids.shift();
      delete byTab[oldest];
      delete meta[oldest];
    }
    byTab[metaKey] = meta;
    return byTab;
  }

  function slimRankPayload(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var srcItems = Array.isArray(raw.items) ? raw.items : [];
    var outItems = [];
    for (var i = 0; i < srcItems.length && outItems.length < MAX_RANK_ITEMS; i++) {
      var it = srcItems[i];
      if (!it || typeof it !== 'object') continue;
      var itemId = it.itemId != null ? String(it.itemId) : '';
      if (!itemId) continue;
      outItems.push({
        itemId: itemId,
        rank: it.rank != null ? it.rank : null,
        shopTitle: it.shopTitle != null ? String(it.shopTitle) : '',
        itemTitle: it.itemTitle != null ? String(it.itemTitle) : ''
      });
    }
    return {
      keyWord: raw.keyWord != null ? String(raw.keyWord) : '',
      updateTime: raw.updateTime != null ? String(raw.updateTime) : '',
      recordedAtEast8: raw.recordedAtEast8 != null ? String(raw.recordedAtEast8) : '',
      items: outItems,
      lastTouchedAt: new Date().toISOString()
    };
  }

  function isQuotaError(err) {
    if (!err) return false;
    var msg = String(err.message || err);
    return /quota|QUOTA_BYTES|Resource::kQuotaBytes/i.test(msg);
  }

  function safeSet(payload, onDone, onQuota) {
    try {
      chrome.storage.local.set(payload, function () {
        if (chrome.runtime && chrome.runtime.lastError && isQuotaError(chrome.runtime.lastError)) {
          if (typeof onQuota === 'function') {
            onQuota(function () {
              chrome.storage.local.set(payload, function () {
                if (typeof onDone === 'function') onDone();
              });
            });
            return;
          }
        }
        if (typeof onDone === 'function') onDone();
      });
    } catch (e) {
      if (isQuotaError(e) && typeof onQuota === 'function') {
        onQuota(function () {
          chrome.storage.local.set(payload, function () {
            if (typeof onDone === 'function') onDone();
          });
        });
        return;
      }
      if (typeof onDone === 'function') onDone();
    }
  }

  function itemRowKey(item, index) {
    if (item && item.itemId != null && String(item.itemId).trim() !== '') return String(item.itemId);
    return 'idx-' + index;
  }

  function appendLogAny(tabId, level, msg) {
    var entry = { t: new Date().toISOString(), level: level || 'log', msg: String(msg) };
    if (tabId == null) {
      chrome.storage.local.get([KEYS.logs], function (r) {
        var data = r && r[KEYS.logs] ? r[KEYS.logs] : { entries: [] };
        if (!Array.isArray(data.entries)) data.entries = [];
        data.entries.push(entry);
        if (data.entries.length > MAX) data.entries = data.entries.slice(-MAX);
        safeSet({ [KEYS.logs]: data });
      });
      return;
    }
    chrome.storage.local.get([KEYS.logsByTab], function (r) {
      var byTab = r && r[KEYS.logsByTab] ? r[KEYS.logsByTab] : {};
      var bucket = byTab[String(tabId)] || { entries: [] };
      if (!Array.isArray(bucket.entries)) bucket.entries = [];
      bucket.entries.push(entry);
      if (bucket.entries.length > MAX) bucket.entries = bucket.entries.slice(-MAX);
      byTab[String(tabId)] = bucket;
      var meta = byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === 'object' ? byTab[LOG_META_KEY] : {};
      meta[String(tabId)] = new Date().toISOString();
      byTab[LOG_META_KEY] = meta;
      byTab = pruneByMeta(byTab, MAX_LOG_TABS, LOG_META_KEY);
      var o = {};
      o[KEYS.logsByTab] = byTab;
      safeSet(o, null, function (retry) {
        chrome.storage.local.get([KEYS.logsByTab], function (fresh) {
          var byTab2 = fresh && fresh[KEYS.logsByTab] ? fresh[KEYS.logsByTab] : {};
          byTab2 = pruneByMeta(byTab2, Math.max(1, MAX_LOG_TABS - 1), LOG_META_KEY);
          safeSet({ [KEYS.logsByTab]: byTab2 }, retry);
        });
      });
    });
  }

  function rankSummaryLine(payload, itemCount) {
    var kw = payload.keyWord != null ? String(payload.keyWord) : '';
    return 'rank.json（' + itemCount + ' 条，搜索词「' + (kw || '空') + '」）';
  }

  function uploadRankToSupabase(tabId, payload, done) {
    var creds = self.__SYCM_RANK_SUPABASE__;
    var itemCount = (payload.items && payload.items.length) || 0;
    var summary = rankSummaryLine(payload, itemCount);
    var recordedAtEast8 = payload.recordedAtEast8 || '';
    var keyWord = payload.keyWord != null ? String(payload.keyWord) : '';

    chrome.storage.local.get(
      [KEYS.rankSelectionByTab, KEYS.rankSelection, KEYS.throttleMinutes],
      function (r) {
        var throttleMin = r[KEYS.throttleMinutes];
        var minutes =
          throttleMin != null && Number(throttleMin) > 0 ? Number(throttleMin) : DEFAULT_THROTTLE;

        var filter =
          tabId != null && r[KEYS.rankSelectionByTab] && r[KEYS.rankSelectionByTab][String(tabId)]
            ? r[KEYS.rankSelectionByTab][String(tabId)]
            : r[KEYS.rankSelection];
        var ids = filter && Array.isArray(filter.itemIds) ? filter.itemIds.map(String) : [];
        var items = (payload && payload.items) || [];
        var rows = [];
        for (var i = 0; i < items.length; i++) {
          var row = items[i];
          var k = itemRowKey(row, i);
          if (ids.indexOf(k) === -1) continue;
          rows.push({
            shop_title:
              row.shopTitle != null && String(row.shopTitle).trim() !== ''
                ? String(row.shopTitle).trim()
                : '（无店名）',
            rank: row.rank != null ? Number(row.rank) : 0,
            item_title:
              row.itemTitle != null && String(row.itemTitle).trim() !== ''
                ? String(row.itemTitle).trim()
                : null
          });
        }

        function finish(resultLine) {
          appendLogAny(tabId, 'log', summary + ' · ' + resultLine);
          if (done) done(resultLine);
        }

        if (rows.length === 0) {
          finish('Supabase：未写入（无勾选或勾选与列表无交集，请先勾选并保存设置）');
          return;
        }

        if (!creds || !creds.url || !creds.anonKey) {
          finish('Supabase：未写入（未配置密钥）');
          return;
        }

        var slotKey = getSlotKey(recordedAtEast8, minutes);
        if (!slotKey) {
          finish('Supabase：未写入（时间槽计算失败，检查 recordedAtEast8）');
          return;
        }

        var slotStorageKey =
          KEYS.lastSlotPrefix + 'sycm-market-rank_' + encodeURIComponent(keyWord || '_empty');

        chrome.storage.local.get([slotStorageKey], function (r2) {
          var lastSlot = r2[slotStorageKey];
          if (lastSlot === slotKey) {
            finish(
              'Supabase：未写入（本 ' +
                minutes +
                ' 分钟时间槽已上报过，槽键 ' +
                slotKey +
                '，keyWord「' +
                (keyWord || '空') +
                '」）'
            );
            return;
          }

          var url = creds.url.replace(/\/$/, '') + '/rest/v1/sycm_market_rank_log';
          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: creds.anonKey,
              Authorization: 'Bearer ' + creds.anonKey,
              Prefer: 'return=minimal'
            },
            body: JSON.stringify(rows)
          })
            .then(function (res) {
              if (res.ok) {
                var o = {};
                o[slotStorageKey] = slotKey;
                safeSet(o, function () {
                  finish(
                    'Supabase：已写入 ' +
                      rows.length +
                      ' 条（表 sycm_market_rank_log，时间槽 ' +
                      slotKey +
                      '）'
                  );
                });
              } else {
                return res.text().then(function (t) {
                  finish('Supabase：未写入（HTTP ' + res.status + ' ' + t.slice(0, 120) + '）');
                });
              }
            })
            .catch(function (err) {
              finish('Supabase：未写入（请求异常 ' + String(err) + '）');
            });
        });
      }
    );
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg) return false;

    if (msg.type === GET_TAB_MSG) {
      if (sender.tab && sender.tab.id != null) {
        sendResponse({ tabId: sender.tab.id });
        return true;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var id = tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
        sendResponse({ tabId: id });
      });
      return true;
    }

    if (msg.type === RUNTIME.RANK_CAPTURE) {
      var tabId = sender.tab && sender.tab.id != null ? sender.tab.id : null;

      if (!msg.payload || !Array.isArray(msg.payload.items) || msg.payload.items.length === 0) {
        var reason =
          msg.meta && msg.meta.parseError
            ? String(msg.meta.parseError)
            : '无有效数据';
        var line = 'rank.json 监听 · 未解析 · Supabase：未写入（' + reason + '）';
        appendLogAny(tabId, 'warn', line);
        sendResponse({ resultLine: 'Supabase：未写入（' + reason + '）' });
        return true;
      }

      var finishUpload = function (resultLine) {
        sendResponse({ resultLine: resultLine });
      };

      var payload = slimRankPayload(msg.payload);
      if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
        appendLogAny(tabId, 'warn', 'rank.json 已捕获，但无可保存的有效数据');
        sendResponse({ resultLine: 'Supabase：未写入（无有效数据）' });
        return true;
      }
      var afterSave = function () {
        uploadRankToSupabase(tabId, payload, finishUpload);
      };

      if (tabId != null) {
        chrome.storage.local.get([KEYS.rankListByTab], function (r) {
          var byTab = r && r[KEYS.rankListByTab] ? r[KEYS.rankListByTab] : {};
          byTab[String(tabId)] = payload;
          var meta = byTab[RANK_META_KEY] && typeof byTab[RANK_META_KEY] === 'object' ? byTab[RANK_META_KEY] : {};
          meta[String(tabId)] = new Date().toISOString();
          byTab[RANK_META_KEY] = meta;
          byTab = pruneByMeta(byTab, MAX_RANK_TABS, RANK_META_KEY);
          var o = {};
          o[KEYS.rankListByTab] = byTab;
          safeSet(o, afterSave, function (retry) {
            chrome.storage.local.get([KEYS.rankListByTab], function (fresh) {
              var byTab2 = fresh && fresh[KEYS.rankListByTab] ? fresh[KEYS.rankListByTab] : {};
              byTab2 = pruneByMeta(byTab2, Math.max(1, MAX_RANK_TABS - 1), RANK_META_KEY);
              safeSet({ [KEYS.rankListByTab]: byTab2 }, retry);
            });
          });
        });
      } else {
        safeSet({ [KEYS.rankListLatest]: payload }, afterSave, function (retry) {
          chrome.storage.local.remove([KEYS.rankListLatest], function () {
            retry();
          });
        });
      }
      return true;
    }

    return false;
  });

  chrome.tabs.onRemoved.addListener(function (tabId) {
    var idStr = String(tabId);
    chrome.storage.local.get([KEYS.rankListByTab, KEYS.logsByTab, KEYS.rankSelectionByTab], function (r) {
      var byRank = r && r[KEYS.rankListByTab] ? r[KEYS.rankListByTab] : {};
      var byLogs = r && r[KEYS.logsByTab] ? r[KEYS.logsByTab] : {};
      var bySel = r && r[KEYS.rankSelectionByTab] ? r[KEYS.rankSelectionByTab] : {};
      if (!byRank[idStr] && !byLogs[idStr] && !bySel[idStr]) return;
      delete byRank[idStr];
      delete byLogs[idStr];
      delete bySel[idStr];
      if (byLogs[LOG_META_KEY] && typeof byLogs[LOG_META_KEY] === 'object') delete byLogs[LOG_META_KEY][idStr];
      if (byRank[RANK_META_KEY] && typeof byRank[RANK_META_KEY] === 'object') delete byRank[RANK_META_KEY][idStr];
      if (bySel[SELECTION_META_KEY] && typeof bySel[SELECTION_META_KEY] === 'object') delete bySel[SELECTION_META_KEY][idStr];
      var o = {};
      o[KEYS.rankListByTab] = byRank;
      o[KEYS.logsByTab] = byLogs;
      o[KEYS.rankSelectionByTab] = bySel;
      safeSet(o);
    });
  });
})();
