export const DY_FOLLOW_STORAGE_KEYS = {
  logs: 'dy_follow_logs',
  logsByTab: 'dy_follow_logs_by_tab',
  snapshotByTab: 'dy_follow_snapshot_by_tab',
  snapshotLatest: 'dy_follow_snapshot_latest',
  selectionByTab: 'dy_follow_selection_by_tab',
  selectionGlobal: 'dy_follow_selection_global',
  viewState: 'dy_follow_view_state',
  crawlStateByTab: 'dy_follow_crawl_state_by_tab',
};

export const DY_FOLLOW_RUNTIME = {
  GET_TAB_ID_MESSAGE: 'DY_FOLLOW_GET_TAB_ID',
  FOLLOW_CAPTURE: 'DY_FOLLOW_CAPTURE',
  START_CRAWL: 'DY_FOLLOW_START_CRAWL',
  STOP_CRAWL: 'DY_FOLLOW_STOP_CRAWL',
  SCROLL_TICK: 'DY_FOLLOW_SCROLL_TICK',
  POST_MESSAGE_SOURCE: 'dy-follow-extension',
};

export const DY_FOLLOW_LIMITS = {
  LOG_MAX_ENTRIES: 200,
  LOG_MAX_TABS: 10,
  SNAPSHOT_MAX_TABS: 10,
  USER_MAX_ITEMS: 1500,
  BATCH_OPEN_LIMIT: 20,
};

export const DY_FOLLOW_PREFIX = '[抖音关注管理]';
