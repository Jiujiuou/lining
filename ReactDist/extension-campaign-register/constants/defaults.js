(function() {
  "use strict";
  const AMCR_STORAGE_KEYS = {
    logs: "amcr_logs",
    logsByTab: "amcr_logs_by_tab",
    findPageStateByTab: "amcr_findPageStateByTab",
    findPageSelectionByQuery: "amcr_findPageSelectionByQuery",
    localRegisterByDate: "amcr_local_register_by_date",
    popupNavDate: "amcr_popup_nav_date"
  };
  const AMCR_LIMITS = {
    LOG_MAX_ENTRIES: 20,
    LOG_MAX_TABS: 6,
    FIND_PAGE_MAX_TABS: 6,
    FIND_PAGE_SELECTION_MAX_QUERIES: 100,
    FIND_PAGE_SELECTION_MAX_QUERIES_PER_PAGE: 25,
    FIND_PAGE_SELECTION_MAX_ITEMS_PER_QUERY: 200
  };
  globalThis.__AMCR_DEFAULTS__ = {
    STORAGE_KEYS: AMCR_STORAGE_KEYS,
    LOG_MAX_ENTRIES: AMCR_LIMITS.LOG_MAX_ENTRIES,
    LOG_MAX_TABS: AMCR_LIMITS.LOG_MAX_TABS,
    FIND_PAGE_MAX_TABS: AMCR_LIMITS.FIND_PAGE_MAX_TABS,
    FIND_PAGE_SELECTION_MAX_QUERIES: AMCR_LIMITS.FIND_PAGE_SELECTION_MAX_QUERIES,
    FIND_PAGE_SELECTION_MAX_QUERIES_PER_PAGE: AMCR_LIMITS.FIND_PAGE_SELECTION_MAX_QUERIES_PER_PAGE,
    FIND_PAGE_SELECTION_MAX_ITEMS_PER_QUERY: AMCR_LIMITS.FIND_PAGE_SELECTION_MAX_ITEMS_PER_QUERY
  };
})();
//# sourceMappingURL=defaults.js.map
