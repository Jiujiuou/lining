/**
 * content.js - Content Script（内容脚本）
 *
 * 运行环境：sycm.taobao.com 页面内、与页面 JS 隔离（Content Script 隔离世界）。
 * 职责：
 * 1. 通过 <script> 先注入 constants/config.js，再注入 inject.js，使 inject 在页面主世界执行并读取 __SYCM_CONFIG__
 * 2. 监听各 pipeline 的 eventName，按可配置节流粒度去重后写入 Supabase（单条或批量）
 *
 * 依赖（由 manifest content_scripts 顺序加载）：constants/defaults.js, constants/config.js, constants/supabase.js,
 * utils/time.js, utils/supabase.js, utils/storage.js, utils/logger.js → content.js
 */
(function () {
  var PREFIX = typeof __SYCM_DEFAULTS__ !== 'undefined' ? __SYCM_DEFAULTS__.PREFIX : '';
  var DEFAULTS = typeof __SYCM_DEFAULTS__ !== 'undefined' ? __SYCM_DEFAULTS__.DEFAULTS : { THROTTLE_MINUTES: 20 };
  var PIPELINES = (typeof __SYCM_CONFIG__ !== 'undefined' && __SYCM_CONFIG__.pipelines) ? __SYCM_CONFIG__.pipelines : [];
  var credentials = typeof __SYCM_SUPABASE__ !== 'undefined' ? { url: __SYCM_SUPABASE__.url, anonKey: __SYCM_SUPABASE__.anonKey } : null;
  var timeUtil = typeof __SYCM_TIME__ !== 'undefined' ? __SYCM_TIME__ : null;
  var supabaseUtil = typeof __SYCM_SUPABASE_UTIL__ !== 'undefined' ? __SYCM_SUPABASE_UTIL__ : null;
  var storageUtil = typeof __SYCM_STORAGE__ !== 'undefined' ? __SYCM_STORAGE__ : null;
  var logger = typeof __SYCM_LOGGER__ !== 'undefined' ? __SYCM_LOGGER__ : null;

  if (!timeUtil || !supabaseUtil || !storageUtil) {
    if (logger) logger.warn(PREFIX + ' 缺少 utils，请检查 manifest content_scripts 顺序');
    return;
  }

  var logOpts = logger ? { prefix: PREFIX, logger: logger } : null;

  var getSlotKey = timeUtil.getSlotKey;
  var getSlotTsISO = timeUtil.getSlotTsISO;
  var toCreatedAtISO = timeUtil.toCreatedAtISO;
  var sendToSupabase = supabaseUtil.sendToSupabase;
  var batchSendToSupabase = supabaseUtil.batchSendToSupabase;
  var mergeGoodsDetailSlot = supabaseUtil.mergeGoodsDetailSlot;
  var mergeGoodsDetailSlotBatch = supabaseUtil.mergeGoodsDetailSlotBatch;
  var getThrottleMinutes = storageUtil.getThrottleMinutes;
  var setLastSlot = storageUtil.setLastSlot;
  var setLastSlotsForEventItems = storageUtil.setLastSlotsForEventItems;
  var STORAGE_KEYS = storageUtil.STORAGE_KEYS;
  var LIVE_JSON_EVENT = 'sycm-goods-live';

  /** 解析当前标签 id（content 无 tabs API，经 background 回复；结果缓存） */
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
      chrome.runtime.sendMessage({ type: 'SYCM_GET_TAB_ID' }, function (res) {
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

  function pickFilterForTab(result, tabId) {
    var byTab = result[STORAGE_KEYS.liveJsonFilterByTab] || {};
    if (tabId != null && Object.prototype.hasOwnProperty.call(byTab, String(tabId))) {
      return byTab[String(tabId)];
    }
    return result[STORAGE_KEYS.liveJsonFilter];
  }

  function pickCatalogForTab(result, tabId) {
    var byTab = result[STORAGE_KEYS.liveJsonCatalogByTab] || {};
    if (tabId != null && Object.prototype.hasOwnProperty.call(byTab, String(tabId))) {
      return byTab[String(tabId)];
    }
    return result[STORAGE_KEYS.liveJsonCatalog];
  }

  /**
   * 上报用商品名：trim 后非空用名称，否则用 item_id，与 RPC 回落一致，满足 item_name NOT NULL
   */
  function ensureItemName(itemId, rawName) {
    var id = itemId != null ? String(itemId).trim() : '';
    if (!id) return '';
    var n = rawName != null ? String(rawName).trim() : '';
    return n || id;
  }

  /** 从 popup 同步的 live 列表缓存中解析标题（详情页 merge 用） */
  function itemNameFromCatalog(catalog, itemId) {
    var items = catalog && catalog.items;
    if (!Array.isArray(items) || itemId == null) return null;
    var id = String(itemId);
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || String(it.item_id) !== id) continue;
      var n = it.item_name;
      if (n != null && String(n).trim() !== '') return String(n).trim();
    }
    return null;
  }

  /** 日志只展示 item_id，避免标题过长撑爆弹窗 */
  function formatGoodsIds(items, maxShow, maxChars) {
    maxShow = maxShow || 16;
    maxChars = maxChars || 500;
    if (!items || items.length === 0) return '—';
    var parts = [];
    var len = 0;
    for (var i = 0; i < items.length && parts.length < maxShow; i++) {
      var id = items[i] && items[i].item_id != null ? String(items[i].item_id) : '';
      if (!id) continue;
      if (len + id.length + 2 > maxChars) break;
      parts.push(id);
      len += id.length + 2;
    }
    var more = items.length > parts.length ? ' …共' + items.length + '件' : '';
    return parts.join('，') + more;
  }

  /**
   * 一条日志说清：接口有哪些商品、勾选白名单命中哪些、结果（时间槽跳过 / 未写 / 已写）
   */
  function buildLiveJsonLogLine(opts) {
    var batch = opts.batchItems || [];
    var allowed = opts.allowedRows || [];
    var wl = typeof opts.whitelistLen === 'number' ? opts.whitelistLen : 0;
    var tm = opts.throttleMinutes != null ? opts.throttleMinutes : 20;
    var head = PREFIX + '[多商品加购] 接口 ' + batch.length + ' 件：' + formatGoodsIds(batch, 16, 500);
    var allowBrief =
      allowed.length > 0
        ? formatGoodsIds(
            allowed.map(function (r) {
              return { item_id: r.item_id };
            }),
            16,
            400
          )
        : wl === 0
          ? '（弹窗白名单为空）'
          : '（与本批无交集）';
    var mid = ' │ 勾选可报 ' + allowed.length + ' 件：' + allowBrief;
    var tail;
    if (opts.outcome === 'throttle') tail = ' │ 本' + tm + '分钟槽内所选商品均已上报过 → 跳过';
    else if (opts.outcome === 'none') tail = ' │ 未写入';
    else if (opts.outcome === 'written') {
      tail = ' │ 已写入 Supabase';
      if (opts.skippedInSlot > 0) {
        tail +=
          '（新写入 ' +
          (opts.writtenCount != null ? opts.writtenCount : '') +
          ' 件，本槽已跳过 ' +
          opts.skippedInSlot +
          ' 件）';
      }
    }
    else tail = ' │ 写入失败：' + (opts.errMsg ? String(opts.errMsg) : '未知');
    return head + mid + tail;
  }

  /**
   * 将最近一次 live.json 商品列表写入 storage，供 popup 展示（按 tab 分桶，避免多开覆盖）
   */
  function saveLiveJsonCatalog(rawItems) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) return;
    var list = [];
    for (var i = 0; i < rawItems.length; i++) {
      var it = rawItems[i];
      if (!it || it.item_id == null) continue;
      list.push({ item_id: String(it.item_id), item_name: it.item_name ? String(it.item_name) : '' });
    }
    if (list.length === 0) return;
    var payload = { updatedAt: new Date().toISOString(), items: list };
    try {
      resolveTabId(function (tabId) {
        if (tabId == null) {
          try {
            chrome.storage.local.set({ [STORAGE_KEYS.liveJsonCatalog]: payload }, function () {});
          } catch (e2) {}
          return;
        }
        chrome.storage.local.get([STORAGE_KEYS.liveJsonCatalogByTab], function (r) {
          var byTab = (r && r[STORAGE_KEYS.liveJsonCatalogByTab]) ? r[STORAGE_KEYS.liveJsonCatalogByTab] : {};
          byTab[String(tabId)] = payload;
          var obj = {};
          obj[STORAGE_KEYS.liveJsonCatalogByTab] = byTab;
          chrome.storage.local.set(obj, function () {});
        });
      });
    } catch (e) { }
  }

  function handleEvent(sink, d, throttleMinutes) {
    var recordedAt = String(d.recordedAt);
    var slotKey = getSlotKey(recordedAt, throttleMinutes);
    if (!slotKey) return;

    if (sink.mergeGoodsDetail) {
      var slotTs = getSlotTsISO(recordedAt, throttleMinutes);
      if (!slotTs) return;
      if (sink.eventName === LIVE_JSON_EVENT && sink.multiRows && d.payload && Array.isArray(d.payload.items)) {
        saveLiveJsonCatalog(d.payload.items);
      }
      /** 详情单商品 merge 用；多商品分支不用此键（按 item_id 分键） */
      var detailLastSlotKey = null;
      var keysToRead;

      function mergeGoodsDetailStorageCallback(result, tabId) {
        if (sink.multiRows && d.payload && Array.isArray(d.payload.items)) {
          var rawList = d.payload.items;
          var batchItems = [];
          for (var bi = 0; bi < rawList.length; bi++) {
            var raw = rawList[bi];
            if (!raw || raw.item_id == null) continue;
            batchItems.push({ item_id: String(raw.item_id), item_name: raw.item_name ? String(raw.item_name) : '' });
          }
          var filt = pickFilterForTab(result, tabId);
          var idList = filt && Array.isArray(filt.itemIds) ? filt.itemIds : [];
          var allow = {};
          for (var a = 0; a < idList.length; a++) {
            allow[String(idList[a])] = true;
          }
          var rows = rawList.map(function (item) {
            return {
              item_id: item.item_id,
              slot_ts: slotTs,
              item_name: ensureItemName(item.item_id, item.item_name),
              item_cart_cnt: item.item_cart_cnt != null ? item.item_cart_cnt : null
            };
          });
          rows = rows.filter(function (r) {
            return r.item_id != null && allow[String(r.item_id)];
          });
          var rowsToWrite = rows.filter(function (r) {
            var k = STORAGE_KEYS.lastSlotPrefix + sink.eventName + '_' + String(r.item_id);
            return result[k] !== slotKey;
          });
          var skippedInSlot = rows.length - rowsToWrite.length;
          var logBase = {
            batchItems: batchItems,
            allowedRows: rows,
            whitelistLen: idList.length,
            throttleMinutes: throttleMinutes
          };
          if (rowsToWrite.length === 0) {
            if (rows.length > 0) {
              if (logger) logger.log(buildLiveJsonLogLine(Object.assign({ outcome: 'throttle' }, logBase)));
            } else if (logger) {
              logger.log(buildLiveJsonLogLine(Object.assign({ outcome: 'none' }, logBase)));
            }
            return;
          }
          mergeGoodsDetailSlotBatch(rowsToWrite, credentials, logOpts).then(function (res) {
            if (res && res.ok) {
              var ids = rowsToWrite.map(function (r) {
                return String(r.item_id);
              });
              setLastSlotsForEventItems(sink.eventName, ids, slotKey, function () { });
              if (logger) {
                logger.log(
                  buildLiveJsonLogLine(
                    Object.assign(
                      {
                        outcome: 'written',
                        skippedInSlot: skippedInSlot,
                        writtenCount: rowsToWrite.length
                      },
                      logBase
                    )
                  )
                );
              }
            } else if (logger) {
              logger.warn(
                buildLiveJsonLogLine(
                  Object.assign({ outcome: 'fail', errMsg: (res && res.error) || JSON.stringify(res) }, logBase)
                )
              );
            }
          });
        } else {
          var lastSlotDetail = result[detailLastSlotKey];
          if (lastSlotDetail === slotKey) {
            if (logger) logger.log(PREFIX + ' [详情] item ' + d.itemId + ' │ 本' + throttleMinutes + '分钟槽已上报过 → 跳过');
            return;
          }
          if (!d.itemId) {
            if (logger) logger.warn(PREFIX + ' 详情数据缺少 itemId，跳过');
            return;
          }
          var cat = pickCatalogForTab(result, tabId);
          var row = {
            item_id: d.itemId,
            slot_ts: slotTs,
            item_name: ensureItemName(d.itemId, itemNameFromCatalog(cat, d.itemId)),
            search_uv: d.payload && d.payload.search_uv != null ? d.payload.search_uv : null,
            search_pay_rate: d.payload && d.payload.search_pay_rate != null ? d.payload.search_pay_rate : null,
            cart_uv: d.payload && d.payload.cart_uv != null ? d.payload.cart_uv : null,
            cart_pay_rate: d.payload && d.payload.cart_pay_rate != null ? d.payload.cart_pay_rate : null
          };
          mergeGoodsDetailSlot(row, credentials, logOpts).then(function (res) {
            if (res && res.ok) {
              setLastSlot(sink.eventName + '_' + d.itemId, slotKey, function () { });
              if (logger) logger.log(PREFIX + ' 已捕获 [详情]，已 merge item ' + d.itemId);
            }
          });
        }
      }

      resolveTabId(function (tabId) {
        if (sink.multiRows && d.payload && Array.isArray(d.payload.items)) {
          keysToRead = [STORAGE_KEYS.liveJsonFilter, STORAGE_KEYS.liveJsonFilterByTab];
          var rawForKeys = d.payload.items;
          for (var ki = 0; ki < rawForKeys.length; ki++) {
            var rawK = rawForKeys[ki];
            if (!rawK || rawK.item_id == null) continue;
            keysToRead.push(STORAGE_KEYS.lastSlotPrefix + sink.eventName + '_' + String(rawK.item_id));
          }
        } else {
          detailLastSlotKey = STORAGE_KEYS.lastSlotPrefix + sink.eventName + (d.itemId ? '_' + d.itemId : '');
          keysToRead = [detailLastSlotKey, STORAGE_KEYS.liveJsonCatalog, STORAGE_KEYS.liveJsonCatalogByTab];
        }
        chrome.storage.local.get(keysToRead, function (result) {
          mergeGoodsDetailStorageCallback(result, tabId);
        });
      });
      return;
    }

    var storageKey = STORAGE_KEYS.lastSlotPrefix + sink.eventName;
    chrome.storage.local.get([storageKey], function (result) {
      var lastSlot = result[storageKey];
      if (lastSlot === slotKey) {
        if (logger) logger.log(PREFIX + ' 已捕获 [' + sink.eventName + ']，未写入（本时段已写入过）');
        return;
      }

      var createdAt = toCreatedAtISO(recordedAt);

      if (sink.multiRows && d.payload && Array.isArray(d.payload.items)) {
        var records = d.payload.items.map(function (item) {
          return {
            shop_title: item.shop_title,
            rank: item.rank,
            created_at: createdAt
          };
        });
        batchSendToSupabase(sink.table, records, credentials, logOpts).then(function (res) {
          if (res && res.ok) {
            setLastSlot(sink.eventName, slotKey, function () { });
            if (logger) logger.log(PREFIX + ' 已捕获 [' + sink.eventName + ']，已批量写入 Supabase');
          }
        });
      } else {
        var record;
        if (sink.fullRecord && d.payload && typeof d.payload === 'object') {
          record = {};
          for (var k in d.payload) record[k] = d.payload[k];
          record.created_at = createdAt;
        } else {
          if (typeof d.value === 'undefined') return;
          record = {};
          record[sink.valueKey] = d.value;
          record.created_at = createdAt;
        }
        sendToSupabase(sink.table, record, credentials, logOpts).then(function (res) {
          if (res && res.ok) {
            setLastSlot(sink.eventName, slotKey, function () { });
            if (logger) logger.log(PREFIX + ' 已捕获 [' + sink.eventName + ']，已写入 Supabase');
          }
        });
      }
    });
  }

  function registerListeners() {
    var throttleMinutes = DEFAULTS.THROTTLE_MINUTES;
    getThrottleMinutes(function (stored) {
      if (stored != null) throttleMinutes = stored;
      PIPELINES.forEach(function (sink) {
        document.addEventListener(sink.eventName, function (e) {
          var d = e.detail;
          if (!d || !d.recordedAt) return;
          getThrottleMinutes(function (current) {
            handleEvent(sink, d, (current != null && current > 0) ? current : throttleMinutes);
          });
        });
      });
    });
  }

  registerListeners();

  // ========== 监听 inject 发来的日志，写入 storage ==========
  if (logger) {
    document.addEventListener('sycm-log', function (e) {
      var d = e.detail;
      if (d && d.level != null && d.msg != null) logger.appendLog(d.level, d.msg);
    });
  }

  // ========== 仅通过 script 注入：先 config 再 inject ==========
  try {
    var pageUrl = typeof document !== 'undefined' && document.location ? document.location.href : '';
    if (logger) logger.log(PREFIX + ' content 已加载，当前页: ' + (pageUrl.slice(0, 60) || '') + (pageUrl.length > 60 ? '...' : '') + '，将注入 config + inject');
    var configScript = document.createElement('script');
    configScript.src = chrome.runtime.getURL('constants/config.js');
    configScript.onload = function () {
      this.remove();
      if (logger) logger.log(PREFIX + ' config.js 已加载，正在注入 inject.js 到页面主世界');
      var injectScript = document.createElement('script');
      injectScript.src = chrome.runtime.getURL('inject.js');
      injectScript.onload = function () { this.remove(); };
      injectScript.onerror = function () { if (logger) logger.warn(PREFIX + ' inject.js 加载失败，请检查扩展资源'); };
      (document.head || document.documentElement).appendChild(injectScript);
    };
    configScript.onerror = function () { if (logger) logger.warn(PREFIX + ' constants/config.js 加载失败'); };
    (document.head || document.documentElement).appendChild(configScript);
  } catch (e) {
    if (logger) logger.warn(PREFIX + ' 注入出错 ' + String(e));
  }
})();
