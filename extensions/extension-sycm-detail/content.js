/**
 * content.js - Content Script（内容脚本）
 *
 * 运行环境：sycm.taobao.com 页面内、与页面 JS 隔离（Content Script 隔离世界）。
 * 职责：
 * 1. 通过 <script> 先注入 constants/config.js，再注入 inject.js，使 inject 在页面主世界执行并读取 __SYCM_CONFIG__
 * 2. 监听各 pipeline 的 eventName，按可配置节流粒度去重后 merge 写入 Supabase（商品加购、流量来源等）
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
  var mergeGoodsDetailSlot = supabaseUtil.mergeGoodsDetailSlot;
  var mergeGoodsDetailSlotBatch = supabaseUtil.mergeGoodsDetailSlotBatch;
  var getThrottleMinutes = storageUtil.getThrottleMinutes;
  var setLastSlot = storageUtil.setLastSlot;
  var setLastSlotsForEventItems = storageUtil.setLastSlotsForEventItems;
  var STORAGE_KEYS = storageUtil.STORAGE_KEYS;
  var MAX_LIVE_JSON_ITEMS =
    typeof __SYCM_DEFAULTS__ !== 'undefined' && __SYCM_DEFAULTS__.LIVE_JSON_MAX_ITEMS
      ? __SYCM_DEFAULTS__.LIVE_JSON_MAX_ITEMS
      : 200;
  var MAX_LIVE_JSON_TABS =
    typeof __SYCM_DEFAULTS__ !== 'undefined' && __SYCM_DEFAULTS__.LIVE_JSON_MAX_TABS
      ? __SYCM_DEFAULTS__.LIVE_JSON_MAX_TABS
      : 6;
  var CATALOG_META_KEY = '__meta';
  var common = typeof __SYCM_COMMON__ !== 'undefined' ? __SYCM_COMMON__ : null;

  var safeSet =
    common && typeof common.safeSet === 'function'
      ? common.safeSet
      : function (payload, onDone, onQuota) {
          // 兜底：common.js 没加载时保持原行为
          function isQuotaError(err) {
            if (!err) return false;
            var msg = String(err.message || err);
            return /quota|QUOTA_BYTES|Resource::kQuotaBytes/i.test(msg);
          }
          try {
            chrome.storage.local.set(payload, function () {
              if (
                chrome.runtime &&
                chrome.runtime.lastError &&
                isQuotaError(chrome.runtime.lastError) &&
                typeof onQuota === 'function'
              ) {
                onQuota(function () {
                  chrome.storage.local.set(payload, function () {
                    if (typeof onDone === 'function') onDone();
                  });
                });
                return;
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
        };
  var LIVE_JSON_EVENT = 'sycm-goods-live';

  /** 使用统一的 resolveTabId（来自 __SYCM_COMMON__） */
  function resolveTabId(callback) {
    if (common && typeof common.resolveTabIdByMessage === 'function') {
      try { common.resolveTabIdByMessage(callback); } catch (e) { callback(null); }
      return;
    }
    // 兜底：直接询问 background
    try {
      chrome.runtime.sendMessage({ type: 'SYCM_GET_TAB_ID' }, function (res) {
        if (chrome.runtime.lastError || !res || res.tabId == null) callback(null);
        else callback(res.tabId);
      });
    } catch (e) { callback(null); }
  }
  var safeSet = (common && typeof common.safeSet === 'function')
    ? common.safeSet
    : function (payload, onDone, onQuota) {
        // minimal fallback
        try {
          chrome.storage.local.set(payload, function () { if (typeof onDone === 'function') onDone(); });
        } catch (e) { if (typeof onDone === 'function') onDone(); }
      };
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
    for (var i = 0; i < rawItems.length && list.length < MAX_LIVE_JSON_ITEMS; i++) {
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
            safeSet({ [STORAGE_KEYS.liveJsonCatalog]: payload }, function () {}, function (retry) {
              chrome.storage.local.remove([STORAGE_KEYS.liveJsonCatalog], function () {
                retry();
              });
            });
          } catch (e2) {}
          return;
        }
        chrome.storage.local.get([STORAGE_KEYS.liveJsonCatalogByTab], function (r) {
          var byTab = (r && r[STORAGE_KEYS.liveJsonCatalogByTab]) ? r[STORAGE_KEYS.liveJsonCatalogByTab] : {};
          byTab[String(tabId)] = payload;
          var meta = byTab[CATALOG_META_KEY] && typeof byTab[CATALOG_META_KEY] === 'object' ? byTab[CATALOG_META_KEY] : {};
          meta[String(tabId)] = new Date().toISOString();
          byTab[CATALOG_META_KEY] = meta;
          var ids = Object.keys(byTab).filter(function (k) { return k !== CATALOG_META_KEY; });
          ids.sort(function (a, b) {
            var ta = meta[a] || '';
            var tb = meta[b] || '';
            return String(ta).localeCompare(String(tb));
          });
          while (ids.length > MAX_LIVE_JSON_TABS) {
            var oldest = ids.shift();
            delete byTab[oldest];
            delete meta[oldest];
          }
          var obj = {};
          obj[STORAGE_KEYS.liveJsonCatalogByTab] = byTab;
          safeSet(obj, function () {}, function (retry) {
            byTab =
              common && typeof common.pruneByTabWithMeta === 'function'
                ? common.pruneByTabWithMeta(byTab, CATALOG_META_KEY, Math.max(1, MAX_LIVE_JSON_TABS - 1))
                : byTab;
            safeSet(obj, retry);
          });
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
            if (logger) {
              var toPct2 = function (v) {
                if (v == null) return '—';
                var n = Number(v);
                if (n !== n) return String(v);
                return (Math.round(n * 10000) / 100).toFixed(2) + '%';
              };
              var p = d.payload || {};
              logger.log(
                PREFIX +
                  ' [详情] item ' +
                  d.itemId +
                  ' │ 搜索UV=' +
                  (p.search_uv != null ? p.search_uv : '—') +
                  ' 搜索支付转化率=' +
                  toPct2(p.search_pay_rate) +
                  ' │ 购物车UV=' +
                  (p.cart_uv != null ? p.cart_uv : '—') +
                  ' 购物车支付转化率=' +
                  toPct2(p.cart_pay_rate) +
                  ' │ 本' +
                  throttleMinutes +
                  '分钟槽已上报过 → 跳过'
              );
            }
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
              if (logger) {
                var toPct = function (v) {
                  if (v == null) return '—';
                  var n = Number(v);
                  if (n !== n) return String(v);
                  return (Math.round(n * 10000) / 100).toFixed(2) + '%';
                };
                logger.log(
                  PREFIX +
                    ' 已捕获 [详情]，已 merge item ' +
                    d.itemId +
                    ' │ 搜索UV=' +
                    (row.search_uv != null ? row.search_uv : '—') +
                    ' 搜索支付转化率=' +
                    toPct(row.search_pay_rate) +
                    ' │ 购物车UV=' +
                    (row.cart_uv != null ? row.cart_uv : '—') +
                    ' 购物车支付转化率=' +
                    toPct(row.cart_pay_rate)
                );
              }
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
  }

  function registerListeners() {
    var throttleMinutes = DEFAULTS.THROTTLE_MINUTES;
    // 监听节流粒度变更，避免每次事件都读 storage
    try {
      chrome.storage.onChanged.addListener(function (changes, areaName) {
        if (areaName !== 'local') return;
        var ch = changes && changes[STORAGE_KEYS.throttleMinutes];
        if (ch && typeof ch.newValue === 'number' && ch.newValue > 0) throttleMinutes = ch.newValue;
      });
    } catch (e) { }

    // 先挂事件监听，读取到 storage 后再更新 throttleMinutes 变量
    PIPELINES.forEach(function (sink) {
      document.addEventListener(sink.eventName, function (e) {
        var d = e.detail;
        if (!d || !d.recordedAt) return;
        handleEvent(sink, d, throttleMinutes);
      });
    });

    getThrottleMinutes(function (stored) {
      if (stored != null) throttleMinutes = stored;
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

  // ========== 捕获详情 flow-source 模板 URL（用于列表页批量重放） ==========
  try {
    document.addEventListener('sycm-flow-source-template', function (e) {
      var d = e && e.detail ? e.detail : null;
      var url = d && d.url ? String(d.url) : '';
      if (!url || url.indexOf('/flow/v6/live/item/source/v4.json') === -1) return;
      function normalizeTemplateUrl(raw) {
        try {
          var u = new URL(raw, document.location.origin);
          // 轮询会不断变化的参数：_（时间戳）、itemId（具体商品）
          u.searchParams.delete('_');
          u.searchParams.set('itemId', '{itemId}');
          return u.toString();
        } catch (err) {
          return raw;
        }
      }
      var normalized = normalizeTemplateUrl(url);
      resolveTabId(function (tabId) {
        if (tabId == null) return;
        chrome.storage.local.get([STORAGE_KEYS.flowSourceTemplateByTab], function (r) {
          var byTab = (r && r[STORAGE_KEYS.flowSourceTemplateByTab]) ? r[STORAGE_KEYS.flowSourceTemplateByTab] : {};
          var key = String(tabId);
          var prev = byTab[key];
          // 去重：模板没变就不刷屏（轮询会频繁命中同一接口）
          if (prev && prev.url && String(prev.url) === normalized) return;
          byTab[key] = { url: normalized, capturedAt: new Date().toISOString() };
          var o = {};
          o[STORAGE_KEYS.flowSourceTemplateByTab] = byTab;
          safeSet(o, function () {
            if (logger) logger.log(PREFIX + ' 已捕获 flow-source 模板（可用于列表页轮询）');
          });
        });
      });
    });
  } catch (e) { }

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

      // 轮询器：用于列表页批量拉取 flow-source（方案 A）
      var poller = document.createElement('script');
      poller.src = chrome.runtime.getURL('flow-source-poller.js');
      poller.onload = function () { this.remove(); };
      poller.onerror = function () { if (logger) logger.warn(PREFIX + ' flow-source-poller.js 加载失败'); };
      (document.head || document.documentElement).appendChild(poller);
    };
    configScript.onerror = function () { if (logger) logger.warn(PREFIX + ' constants/config.js 加载失败'); };
    (document.head || document.documentElement).appendChild(configScript);
  } catch (e) {
    if (logger) logger.warn(PREFIX + ' 注入出错 ' + String(e));
  }

  // ========== popup 控制：开始/停止 flow-source 轮询 ==========
  try {
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (!msg || !msg.type) return false;
      if (msg.type === 'SYCM_FLOW_POLL_START') {
        var intervalSec = typeof msg.intervalSec === 'number' ? msg.intervalSec : 30;
        var concurrency = 1;
        intervalSec = Math.max(5, Math.min(600, intervalSec));
        concurrency = 1;
        resolveTabId(function (tabId) {
          chrome.storage.local.get(
            [
              STORAGE_KEYS.liveJsonFilter,
              STORAGE_KEYS.liveJsonFilterByTab,
              STORAGE_KEYS.flowSourceTemplateByTab
            ],
            function (r) {
              var filt = pickFilterForTab(r, tabId);
              var ids = filt && Array.isArray(filt.itemIds) ? filt.itemIds.map(function (x) { return String(x); }) : [];
              if (ids.length === 0) {
                if (logger) logger.warn(PREFIX + ' 未勾选任何商品，无法开始轮询');
                sendResponse({ ok: false, error: 'no_items' });
                return;
              }
              var byTab = r[STORAGE_KEYS.flowSourceTemplateByTab] || {};
              var tpl = tabId != null ? byTab[String(tabId)] : null;
              var tplUrl = tpl && tpl.url ? String(tpl.url) : '';
              if (!tplUrl) {
                // 回落：取最近一次捕获的模板（可能在别的 tab 打开的详情页）
                var best = null;
                Object.keys(byTab).forEach(function (k) {
                  var v = byTab[k];
                  if (!v || !v.url) return;
                  if (!best) best = v;
                  else {
                    var ta = best.capturedAt || '';
                    var tb = v.capturedAt || '';
                    if (String(ta).localeCompare(String(tb)) < 0) best = v;
                  }
                });
                if (best && best.url) tplUrl = String(best.url);
              }
              if (!tplUrl) {
                if (logger) logger.warn(PREFIX + ' 未捕获详情接口模板：请先打开任意商品详情页触发一次接口');
                sendResponse({ ok: false, error: 'no_template' });
                return;
              }
              window.postMessage(
                {
                  type: 'SYCM_FLOW_POLL_START',
                  itemIds: ids,
                  templateUrl: tplUrl,
                  intervalMs: intervalSec * 1000,
                  maxConcurrency: concurrency
                },
                '*'
              );
              sendResponse({ ok: true, itemCount: ids.length });
            }
          );
        });
        return true;
      }
      if (msg.type === 'SYCM_FLOW_POLL_STOP') {
        window.postMessage({ type: 'SYCM_FLOW_POLL_STOP' }, '*');
        sendResponse({ ok: true });
        return true;
      }
      return false;
    });
  } catch (e) { }
})();
