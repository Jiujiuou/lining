export const DEFAULTS = {
  THROTTLE_MINUTES: 20,
};

export const MESSAGE_TYPES = {
  GET_TAB_ID: 'SYCM_GET_TAB_ID',
  FLOW_POLL_START: 'SYCM_FLOW_POLL_START',
  FLOW_POLL_STOP: 'SYCM_FLOW_POLL_STOP',
  LOG_APPENDED: 'SYCM_LOG_APPENDED',
};

export const STORAGE_KEYS = {
  throttleMinutes: 'sycm_throttle_minutes',
  lastSlotPrefix: 'sycm_last_slot_',
  logs: 'sycm_logs',
  logsByTab: 'sycm_logs_by_tab',
  liveJsonCatalog: 'sycm_live_json_catalog',
  liveJsonFilter: 'sycm_live_json_filter',
  liveJsonFilterByTab: 'sycm_live_json_filter_by_tab',
  liveJsonCatalogByTab: 'sycm_live_json_catalog_by_tab',
  flowSourceTemplateByTab: 'sycm_flow_source_template_by_tab',
  flowPollSettingsByTab: 'sycm_flow_poll_settings_by_tab',
};

export const LOG_MAX_ENTRIES = 20;
export const LOG_MAX_TABS = 6;
export const LIVE_JSON_MAX_TABS = 6;
export const LIVE_JSON_MAX_ITEMS = 200;
export const PREFIX = '';
