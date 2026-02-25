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
  var toCreatedAtISO = timeUtil.toCreatedAtISO;
  var sendToSupabase = supabaseUtil.sendToSupabase;
  var batchSendToSupabase = supabaseUtil.batchSendToSupabase;
  var getThrottleMinutes = storageUtil.getThrottleMinutes;
  var setLastSlot = storageUtil.setLastSlot;
  var setLastWrite = storageUtil.setLastWrite;
  var STORAGE_KEYS = storageUtil.STORAGE_KEYS;

  function handleEvent(sink, d, throttleMinutes) {
    var recordedAt = String(d.recordedAt);
    var slotKey = getSlotKey(recordedAt, throttleMinutes);
    if (!slotKey) return;
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
            setLastWrite({ at: new Date().toISOString(), slotKey: slotKey, eventName: sink.eventName }, function () { });
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
            setLastWrite({ at: new Date().toISOString(), slotKey: slotKey, eventName: sink.eventName }, function () { });
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
    if (logger) logger.log(PREFIX + ' content script 已加载，已注册 ' + PIPELINES.length + ' 个上报');
    var configScript = document.createElement('script');
    configScript.src = chrome.runtime.getURL('constants/config.js');
    configScript.onload = function () {
      this.remove();
      var injectScript = document.createElement('script');
      injectScript.src = chrome.runtime.getURL('inject.js');
      injectScript.onload = function () { this.remove(); };
      injectScript.onerror = function () { if (logger) logger.warn(PREFIX + ' inject.js 加载失败'); };
      (document.head || document.documentElement).appendChild(injectScript);
    };
    configScript.onerror = function () { if (logger) logger.warn(PREFIX + ' constants/config.js 加载失败'); };
    (document.head || document.documentElement).appendChild(configScript);
  } catch (e) {
    if (logger) logger.warn(PREFIX + ' 注入出错 ' + String(e));
  }
})();
