/**
 * 扩展默认常量与 storage key 命名
 */
(function (global) {
  var DEFAULTS = {
    /** 节流粒度（分钟），同一时间槽内同一数据源只写一次；可被 chrome.storage sycm_throttle_minutes 覆盖 */
    THROTTLE_MINUTES: 20
  };

  var STORAGE_KEYS = {
    throttleMinutes: 'sycm_throttle_minutes',
    lastSlotPrefix: 'sycm_last_slot_',
    logs: 'sycm_logs',
    /** Record<tabIdStr, { entries }> — 按标签页隔离扩展日志 */
    logsByTab: 'sycm_logs_by_tab',
    /** 最近一次 foucs/live.json 或 live/view/top.json 解析出的商品列表（供 popup 展示） */
    liveJsonCatalog: 'sycm_live_json_catalog',
    /** { itemIds: string[] } — 仅上报已勾选并保存的 item_id（20 分钟时间槽不变） */
    liveJsonFilter: 'sycm_live_json_filter',
    /** Record<tabIdStr, { itemIds }> — 按标签页隔离勾选，避免多开互相覆盖 */
    liveJsonFilterByTab: 'sycm_live_json_filter_by_tab',
    /** Record<tabIdStr, { updatedAt, items }> — 按标签页隔离商品列表 */
    liveJsonCatalogByTab: 'sycm_live_json_catalog_by_tab'
  };

  var LOG_MAX_ENTRIES = 20;
  var LOG_MAX_TABS = 6;
  var LIVE_JSON_MAX_TABS = 6;
  var LIVE_JSON_MAX_ITEMS = 200;
  var PREFIX = '';

  var obj = {
    DEFAULTS: DEFAULTS,
    STORAGE_KEYS: STORAGE_KEYS,
    LOG_MAX_ENTRIES: LOG_MAX_ENTRIES,
    LOG_MAX_TABS: LOG_MAX_TABS,
    LIVE_JSON_MAX_TABS: LIVE_JSON_MAX_TABS,
    LIVE_JSON_MAX_ITEMS: LIVE_JSON_MAX_ITEMS,
    PREFIX: PREFIX
  };
  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_DEFAULTS__ = obj;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
