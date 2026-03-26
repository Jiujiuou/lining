/**
 * 市场排名扩展：storage 键、运行时消息（与 extension-sycm-detail 隔离）
 */
(function (global) {
  var STORAGE_KEYS = {
    logs: 'sycm_rank_only_logs',
    logsByTab: 'sycm_rank_only_logs_by_tab',
    /** Record<tabIdStr, RankSnapshot> */
    rankListByTab: 'sycm_rank_market_list_by_tab',
    /** 无 tab 上下文时的最近一次 */
    rankListLatest: 'sycm_rank_market_list_latest',
    /** Record<tabIdStr, { itemIds: string[] }> 勾选行（itemId 或 idx-行号，与列表行对应） */
    rankSelectionByTab: 'sycm_rank_selection_by_tab',
    /** 无 tab 时的勾选 */
    rankSelection: 'sycm_rank_selection_global',
    /** 时间槽节流粒度（分钟），默认 20 */
    throttleMinutes: 'sycm_rank_only_throttle_minutes',
    /** 与 lastSlotPrefix 拼成 sycm_rank_only_last_slot_sycm-market-rank_<encodeURIComponent(keyWord)> */
    lastSlotPrefix: 'sycm_rank_only_last_slot_'
  };

  var DEFAULTS = {
    THROTTLE_MINUTES: 20
  };

  var LOG_MAX_ENTRIES = 20;
  var LOG_MAX_TABS = 6;
  var RANK_MAX_TABS = 6;
  var RANK_MAX_ITEMS = 200;
  var PREFIX = '[市场排名]';

  var RUNTIME = {
    GET_TAB_ID_MESSAGE: 'SYCM_RANK_GET_TAB_ID',
    RANK_CAPTURE: 'SYCM_RANK_CAPTURE'
  };

  var obj = {
    DEFAULTS: DEFAULTS,
    STORAGE_KEYS: STORAGE_KEYS,
    LOG_MAX_ENTRIES: LOG_MAX_ENTRIES,
    LOG_MAX_TABS: LOG_MAX_TABS,
    RANK_MAX_TABS: RANK_MAX_TABS,
    RANK_MAX_ITEMS: RANK_MAX_ITEMS,
    PREFIX: PREFIX,
    RUNTIME: RUNTIME
  };
  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_RANK_DEFAULTS__ = obj;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
