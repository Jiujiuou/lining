export const DY_FOLLOW_STORAGE_KEYS = {
  logs: 'dy_follow_logs',
  logsByTab: 'dy_follow_logs_by_tab',
  snapshotByTab: 'dy_follow_snapshot_by_tab',
  snapshotLatest: 'dy_follow_snapshot_latest',
  selectionByTab: 'dy_follow_selection_by_tab',
  selectionGlobal: 'dy_follow_selection_global',
  viewState: 'dy_follow_view_state',
  crawlStateByTab: 'dy_follow_crawl_state_by_tab',
  popupViewStateByTab: 'dy_follow_popup_view_state_by_tab',
  postSnapshotBySecUid: 'dy_follow_post_snapshot_by_sec_uid',
};

export const DY_FOLLOW_RUNTIME = {
  GET_TAB_ID_MESSAGE: 'DY_FOLLOW_GET_TAB_ID',
  FOLLOW_CAPTURE: 'DY_FOLLOW_CAPTURE',
  POST_CAPTURE: 'DY_FOLLOW_POST_CAPTURE',
  START_CRAWL: 'DY_FOLLOW_START_CRAWL',
  STOP_CRAWL: 'DY_FOLLOW_STOP_CRAWL',
  START_POST_CRAWL: 'DY_FOLLOW_START_POST_CRAWL',
  STOP_POST_CRAWL: 'DY_FOLLOW_STOP_POST_CRAWL',
  SET_POST_FILTER: 'DY_FOLLOW_SET_POST_FILTER',
  EXPORT_POST_IMAGE_URLS: 'DY_FOLLOW_EXPORT_POST_IMAGE_URLS',
  SCROLL_TICK: 'DY_FOLLOW_SCROLL_TICK',
  POST_SCROLL_TICK: 'DY_FOLLOW_POST_SCROLL_TICK',
  POST_MESSAGE_SOURCE: 'dy-follow-extension',
};

export const DY_FOLLOW_LIMITS = {
  LOG_MAX_ENTRIES: 200,
  LOG_MAX_TABS: 10,
  SNAPSHOT_MAX_TABS: 10,
  USER_MAX_ITEMS: 1500,
  BATCH_OPEN_LIMIT: 20,
  POST_MAX_ITEMS: 300,
  POST_MAX_SEC_UID: 50,
};

export const DY_FOLLOW_PREFIX = '[抖音关注管理]';
