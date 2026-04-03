export const STORAGE_KEYS = {
  logs: 'amcr_logs',
  logsByTab: 'amcr_logs_by_tab',
  findPageStateByTab: 'amcr_findPageStateByTab',
  findPageSelectionByQuery: 'amcr_findPageSelectionByQuery',
  localRegisterByDate: 'amcr_local_register_by_date',
  popupNavDate: 'amcr_popup_nav_date',
};

export const LOG_MAX_ENTRIES = 20;
export const LOG_MAX_TABS = 6;
export const FIND_PAGE_MAX_TABS = 6;
export const FIND_PAGE_SELECTION_MAX_QUERIES = 100;
export const FIND_PAGE_SELECTION_MAX_QUERIES_PER_PAGE = 25;
export const FIND_PAGE_SELECTION_MAX_ITEMS_PER_QUERY = 200;

export const AMCR_DEFAULTS = {
  STORAGE_KEYS,
  LOG_MAX_ENTRIES,
  LOG_MAX_TABS,
  FIND_PAGE_MAX_TABS,
  FIND_PAGE_SELECTION_MAX_QUERIES,
  FIND_PAGE_SELECTION_MAX_QUERIES_PER_PAGE,
  FIND_PAGE_SELECTION_MAX_ITEMS_PER_QUERY,
};
