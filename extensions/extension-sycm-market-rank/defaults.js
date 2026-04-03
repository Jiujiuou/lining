export const STORAGE_KEYS = {
  logs: 'sycm_rank_only_logs',
  logsByTab: 'sycm_rank_only_logs_by_tab',
  rankListByTab: 'sycm_rank_market_list_by_tab',
  rankListLatest: 'sycm_rank_market_list_latest',
  rankSelectionByTab: 'sycm_rank_selection_by_tab',
  rankSelection: 'sycm_rank_selection_global',
  throttleMinutes: 'sycm_rank_only_throttle_minutes',
  lastSlotPrefix: 'sycm_rank_only_last_slot_',
};

export const DEFAULTS = {
  THROTTLE_MINUTES: 20,
};

export const LOG_MAX_ENTRIES = 20;
export const LOG_MAX_TABS = 6;
export const RANK_MAX_TABS = 6;
export const RANK_MAX_ITEMS = 200;
export const PREFIX = '[市场排名]';

export const RUNTIME = {
  GET_TAB_ID_MESSAGE: 'SYCM_RANK_GET_TAB_ID',
  RANK_CAPTURE: 'SYCM_RANK_CAPTURE',
  MESSAGE_SOURCE: 'sycm-rank-extension',
};
