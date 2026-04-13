(function() {
  "use strict";
  const SYCM_RANK_STORAGE_KEYS = {
    logs: "sycm_rank_only_logs",
    logsByTab: "sycm_rank_only_logs_by_tab",
    rankListByTab: "sycm_rank_market_list_by_tab",
    rankListLatest: "sycm_rank_market_list_latest",
    rankSelectionByTab: "sycm_rank_selection_by_tab",
    rankSelection: "sycm_rank_selection_global",
    throttleMinutes: "sycm_rank_only_throttle_minutes",
    lastSlotPrefix: "sycm_rank_only_last_slot_"
  };
  const SYCM_RANK_RUNTIME = {
    GET_TAB_ID_MESSAGE: "SYCM_RANK_GET_TAB_ID",
    RANK_CAPTURE: "SYCM_RANK_CAPTURE"
  };
  const SYCM_RANK_LIMITS = {
    LOG_MAX_ENTRIES: 20,
    LOG_MAX_TABS: 6,
    RANK_MAX_TABS: 6,
    RANK_MAX_ITEMS: 200,
    DEFAULT_THROTTLE_MINUTES: 20
  };
  const SYCM_RANK_PREFIX = "[市场排名]";
  const defaultsPayload = {
    DEFAULTS: {
      THROTTLE_MINUTES: SYCM_RANK_LIMITS.DEFAULT_THROTTLE_MINUTES
    },
    STORAGE_KEYS: SYCM_RANK_STORAGE_KEYS,
    LOG_MAX_ENTRIES: SYCM_RANK_LIMITS.LOG_MAX_ENTRIES,
    LOG_MAX_TABS: SYCM_RANK_LIMITS.LOG_MAX_TABS,
    RANK_MAX_TABS: SYCM_RANK_LIMITS.RANK_MAX_TABS,
    RANK_MAX_ITEMS: SYCM_RANK_LIMITS.RANK_MAX_ITEMS,
    PREFIX: SYCM_RANK_PREFIX,
    RUNTIME: {
      GET_TAB_ID_MESSAGE: SYCM_RANK_RUNTIME.GET_TAB_ID_MESSAGE,
      RANK_CAPTURE: SYCM_RANK_RUNTIME.RANK_CAPTURE
    }
  };
  globalThis.__SYCM_RANK_DEFAULTS__ = defaultsPayload;
})();
//# sourceMappingURL=defaults.js.map
