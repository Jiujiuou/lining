export const OU_STORAGE_KEYS = {
  logs: 'ou_userdata_logs',
  logsByTab: 'ou_userdata_logs_by_tab',
  formByTab: 'ou_userdata_form_by_tab',
};

export const OU_RUNTIME = {
  GET_TAB_ID: 'OU_GET_TAB_ID',
  GET_USER_DATA: 'OU_GET_USER_DATA',
  STOP_USER_DATA: 'OU_STOP_USER_DATA',
  USER_DATA_PROGRESS: 'OU_USER_DATA_PROGRESS',
  USER_DATA_PAGE: 'OU_USER_DATA_PAGE',
  USER_DATA_DONE: 'OU_USER_DATA_DONE',
  START_USER_DATA: 'START_OU_USER_DATA',
  STOP_USER_DATA_MAIN: 'STOP_OU_USER_DATA',
};

export const OU_LIMITS = {
  LOG_MAX_ENTRIES: 20,
  LOG_MAX_TABS: 6,
  FORM_MAX_TABS: 4,
};

export const OU_UI = {
  SOLD_PAGE_URL: 'https://qn.taobao.com/home.htm/trade-platform/tp/sold',
  QN_OR_TRADE_REG: /^https:\/\/(qn\.taobao\.com|trade\.taobao\.com)\//,
};
