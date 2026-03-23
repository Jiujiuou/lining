/**
 * 仅处理 market rank：popup 勾选关键词（URL keyWord）后上报；按关键词 + 时间槽节流。
 */
(function () {
  var PREFIX = typeof __SYCM_RANK_DEFAULTS__ !== 'undefined' ? __SYCM_RANK_DEFAULTS__.PREFIX : '';
  var DEFAULTS =
    typeof __SYCM_RANK_DEFAULTS__ !== 'undefined' ? __SYCM_RANK_DEFAULTS__.DEFAULTS : { THROTTLE_MINUTES: 20 };
  var PIPELINES =
    typeof __SYCM_RANK_CONFIG__ !== 'undefined' && __SYCM_RANK_CONFIG__.pipelines ? __SYCM_RANK_CONFIG__.pipelines : [];
  var credentials =
    typeof __SYCM_RANK_SUPABASE__ !== 'undefined'
      ? { url: __SYCM_RANK_SUPABASE__.url, anonKey: __SYCM_RANK_SUPABASE__.anonKey }
      : null;
  var timeUtil = typeof __SYCM_RANK_TIME__ !== 'undefined' ? __SYCM_RANK_TIME__ : null;
  var supabaseUtil = typeof __SYCM_RANK_SUPABASE_UTIL__ !== 'undefined' ? __SYCM_RANK_SUPABASE_UTIL__ : null;
  var storageUtil = typeof __SYCM_RANK_STORAGE__ !== 'undefined' ? __SYCM_RANK_STORAGE__ : null;
  var logger = typeof __SYCM_RANK_LOGGER__ !== 'undefined' ? __SYCM_RANK_LOGGER__ : null;

  if (!timeUtil || !supabaseUtil || !storageUtil) {
    if (logger) logger.warn(PREFIX + ' 缺少 utils');
    return;
  }

  var logOpts = logger ? { prefix: PREFIX, logger: logger } : null;
  var getSlotKey = timeUtil.getSlotKey;
  var toCreatedAtISO = timeUtil.toCreatedAtISO;
  var batchSendToSupabase = supabaseUtil.batchSendToSupabase;
  var getThrottleMinutes = storageUtil.getThrottleMinutes;
  var setLastSlot = storageUtil.setLastSlot;
  var STORAGE_KEYS = storageUtil.STORAGE_KEYS;
  var RANK_EVENT = 'sycm-market-rank';

  var tabIdCache = '__pending__';
  var tabIdWaiters = [];
  function resolveTabId(callback) {
    if (typeof tabIdCache === 'number') {
      callback(tabIdCache);
      return;
    }
    if (tabIdCache === false) {
      callback(null);
      return;
    }
    tabIdWaiters.push(callback);
    if (tabIdWaiters.length > 1) return;
    try {
      var GET_TAB_MSG =
        typeof __SYCM_RANK_DEFAULTS__ !== 'undefined' &&
        __SYCM_RANK_DEFAULTS__.RUNTIME &&
        __SYCM_RANK_DEFAULTS__.RUNTIME.GET_TAB_ID_MESSAGE
          ? __SYCM_RANK_DEFAULTS__.RUNTIME.GET_TAB_ID_MESSAGE
          : 'SYCM_RANK_GET_TAB_ID';
      chrome.runtime.sendMessage({ type: GET_TAB_MSG }, function (res) {
        if (chrome.runtime.lastError || !res || res.tabId == null) {
          tabIdCache = false;
        } else {
          tabIdCache = res.tabId;
        }
        var tid = typeof tabIdCache === 'number' ? tabIdCache : null;
        var w = tabIdWaiters.slice();
        tabIdWaiters = [];
        for (var wi = 0; wi < w.length; wi++) w[wi](tid);
      });
    } catch (e) {
      tabIdCache = false;
      var w2 = tabIdWaiters.slice();
      tabIdWaiters = [];
      for (var wj = 0; wj < w2.length; wj++) w2[wj](null);
    }
  }

  /** 与接口 URL 中 keyWord= 一致（decode 后比较） */
  function parseKeyWordFromUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
      var q = url.indexOf('?') >= 0 ? url.slice(url.indexOf('?') + 1) : '';
      if (!q) return '';
      var parts = q.split('&');
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (p.indexOf('keyWord=') !== 0) continue;
        var raw = decodeURIComponent(p.slice('keyWord='.length).replace(/\+/g, ' '));
        return raw.trim();
      }
      return '';
    } catch (e) {
      return '';
    }
  }

  function pickFilterForTab(result, tabId) {
    var byTab = result[STORAGE_KEYS.rankFilterByTab] || {};
    if (tabId != null && Object.prototype.hasOwnProperty.call(byTab, String(tabId))) {
      return byTab[String(tabId)];
    }
    return result[STORAGE_KEYS.rankFilter];
  }

  /**
   * 将本次请求中的关键词加入 popup 列表（按 tab）
   */
  function saveRankCatalog(keyWord) {
    if (!keyWord) return;
    var payload = {
      updatedAt: new Date().toISOString(),
      items: []
    };
    try {
      resolveTabId(function (tabId) {
        function mergeItems(prevItems) {
          var list = Array.isArray(prevItems) ? prevItems.slice() : [];
          var found = false;
          for (var j = 0; j < list.length; j++) {
            if (list[j] && String(list[j].key_word) === keyWord) {
              found = true;
              break;
            }
          }
          if (!found) list.push({ key_word: keyWord, item_name: keyWord });
          payload.items = list;
        }
        if (tabId == null) {
          chrome.storage.local.get([STORAGE_KEYS.rankCatalog], function (r) {
            var prev = r && r[STORAGE_KEYS.rankCatalog] ? r[STORAGE_KEYS.rankCatalog] : {};
            mergeItems(prev.items);
            var o = {};
            o[STORAGE_KEYS.rankCatalog] = payload;
            chrome.storage.local.set(o, function () {});
          });
          return;
        }
        chrome.storage.local.get([STORAGE_KEYS.rankCatalogByTab], function (r) {
          var byTab = r && r[STORAGE_KEYS.rankCatalogByTab] ? r[STORAGE_KEYS.rankCatalogByTab] : {};
          var prev = byTab[String(tabId)] || {};
          mergeItems(prev.items);
          byTab[String(tabId)] = payload;
          var obj = {};
          obj[STORAGE_KEYS.rankCatalogByTab] = byTab;
          chrome.storage.local.set(obj, function () {});
        });
      });
    } catch (e) {}
  }

  function getKeyWordsFromFilter(filter) {
    if (!filter || !Array.isArray(filter.keyWords)) return [];
    return filter.keyWords.map(function (k) {
      return String(k);
    });
  }

  function handleRankEvent(sink, d, throttleMinutes) {
    var recordedAt = String(d.recordedAt);
    var slotKey = getSlotKey(recordedAt, throttleMinutes);
    if (!slotKey) return;

    var requestUrl = d.requestUrl != null ? String(d.requestUrl) : '';
    var keyWord = parseKeyWordFromUrl(requestUrl);
    if (keyWord) saveRankCatalog(keyWord);

    if (!d.payload || !Array.isArray(d.payload.items)) {
      if (logger) logger.warn(PREFIX + ' 排名数据无 items');
      return;
    }

    var createdAt = toCreatedAtISO(recordedAt);
    var slotKeyStorage = RANK_EVENT + '_' + encodeURIComponent(keyWord);

    function afterFilter(result, tabId) {
      var filt = pickFilterForTab(result, tabId);
      var allowed = getKeyWordsFromFilter(filt);
      var allowSet = {};
      for (var a = 0; a < allowed.length; a++) allowSet[String(allowed[a])] = true;

      if (!keyWord) {
        if (logger) logger.warn(PREFIX + ' 请求无 keyWord 参数，跳过上报（' + (requestUrl.slice(0, 80) || '') + '）');
        return;
      }

      if (allowed.length === 0) {
        if (logger) logger.log(PREFIX + ' 关键词「' + keyWord + '」│ 弹窗未勾选任何关键词（或列表为空）→ 跳过');
        return;
      }
      if (!allowSet[keyWord]) {
        if (logger) logger.log(PREFIX + ' 关键词「' + keyWord + '」│ 未勾选 → 跳过');
        return;
      }

      var lastSlotKey = STORAGE_KEYS.lastSlotPrefix + slotKeyStorage;
      var lastSlot = result[lastSlotKey];
      if (lastSlot === slotKey) {
        if (logger) logger.log(PREFIX + ' 关键词「' + keyWord + '」│ 本' + throttleMinutes + '分钟槽已上报过 → 跳过');
        return;
      }

      var records = d.payload.items.map(function (item) {
        return {
          shop_title: item.shop_title,
          rank: item.rank,
          created_at: createdAt
        };
      });
      batchSendToSupabase(sink.table, records, credentials, logOpts).then(function (res) {
        if (res && res.ok) {
          setLastSlot(slotKeyStorage, slotKey, function () {});
          if (logger) {
            logger.log(
              PREFIX + ' 关键词「' + keyWord + '」│ 已写入 ' + records.length + ' 行（店铺排名）'
            );
          }
        }
      });
    }

    resolveTabId(function (tabId) {
      var lastSlotKey = STORAGE_KEYS.lastSlotPrefix + slotKeyStorage;
      chrome.storage.local.get(
        [lastSlotKey, STORAGE_KEYS.rankFilter, STORAGE_KEYS.rankFilterByTab],
        function (result) {
          afterFilter(result, tabId);
        }
      );
    });
  }

  function registerListeners() {
    var throttleMinutes = DEFAULTS.THROTTLE_MINUTES;
    getThrottleMinutes(function (stored) {
      if (stored != null) throttleMinutes = stored;
      var sink = PIPELINES[0];
      if (!sink || sink.eventName !== RANK_EVENT) {
        if (logger) logger.warn(PREFIX + ' config 中缺少 sycm-market-rank');
        return;
      }
      document.addEventListener(sink.eventName, function (e) {
        var d = e.detail;
        if (!d || !d.recordedAt) return;
        getThrottleMinutes(function (current) {
          handleRankEvent(sink, d, current != null && current > 0 ? current : throttleMinutes);
        });
      });
    });
  }

  registerListeners();

  if (logger) {
    document.addEventListener('sycm-rank-log', function (e) {
      var d = e.detail;
      if (d && d.level != null && d.msg != null) logger.appendLog(d.level, d.msg);
    });
  }

  try {
    var pageUrl = typeof document !== 'undefined' && document.location ? document.location.href : '';
    if (logger) logger.log(PREFIX + ' content 已加载：' + (pageUrl.slice(0, 60) || '') + (pageUrl.length > 60 ? '...' : ''));
    var configScript = document.createElement('script');
    configScript.src = chrome.runtime.getURL('constants/config.js');
    configScript.onload = function () {
      this.remove();
      var injectScript = document.createElement('script');
      injectScript.src = chrome.runtime.getURL('inject.js');
      injectScript.onload = function () {
        this.remove();
      };
      injectScript.onerror = function () {
        if (logger) logger.warn(PREFIX + ' inject.js 加载失败');
      };
      (document.head || document.documentElement).appendChild(injectScript);
    };
    configScript.onerror = function () {
      if (logger) logger.warn(PREFIX + ' config.js 加载失败');
    };
    (document.head || document.documentElement).appendChild(configScript);
  } catch (e) {
    if (logger) logger.warn(PREFIX + ' 注入出错 ' + String(e));
  }
})();
