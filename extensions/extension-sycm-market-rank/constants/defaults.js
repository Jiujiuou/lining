/**
 * 市场排名独立扩展：storage 键名、日志前缀、运行时消息（与 extension-sycm-detail 键名隔离）
 */
(function (global) {
  var DEFAULTS = {
    THROTTLE_MINUTES: 20
  };

  var STORAGE_KEYS = {
    throttleMinutes: 'sycm_rank_only_throttle_minutes',
    lastSlotPrefix: 'sycm_rank_only_last_slot_',
    logs: 'sycm_rank_only_logs',
    logsByTab: 'sycm_rank_only_logs_by_tab',
    /** 最近一次 rank.json 解析出的关键词列表（无 tab 时回落） */
    rankCatalog: 'sycm_rank_only_catalog',
    /** Record<tabIdStr, { updatedAt, items: { key_word, item_name }[] }> */
    rankCatalogByTab: 'sycm_rank_only_catalog_by_tab',
    /** { keyWords: string[] } */
    rankFilter: 'sycm_rank_only_filter',
    /** Record<tabIdStr, { keyWords }> */
    rankFilterByTab: 'sycm_rank_only_filter_by_tab'
  };

  var LOG_MAX_ENTRIES = 100;
  var PREFIX = '[排名采集]';

  var RUNTIME = {
    GET_TAB_ID_MESSAGE: 'SYCM_RANK_GET_TAB_ID'
  };

  var obj = {
    DEFAULTS: DEFAULTS,
    STORAGE_KEYS: STORAGE_KEYS,
    LOG_MAX_ENTRIES: LOG_MAX_ENTRIES,
    PREFIX: PREFIX,
    RUNTIME: RUNTIME
  };
  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_RANK_DEFAULTS__ = obj;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
