/**
 * 独立扩展「订单用户数据」：仅日志等 storage key，与主扩展隔离
 */
(function (global) {
  var STORAGE_KEYS = {
    logs: 'ou_userdata_logs',
    logsByTab: 'ou_userdata_logs_by_tab',
    /** Record<tabIdStr, { unionSearch, buyerNick, orderStatus }> — 筛选条件按标签隔离 */
    formByTab: 'ou_userdata_form_by_tab'
  };
  var LOG_MAX_ENTRIES = 100;
  var obj = {
    STORAGE_KEYS: STORAGE_KEYS,
    LOG_MAX_ENTRIES: LOG_MAX_ENTRIES,
    PREFIX: '[订单用户数据]'
  };
  (typeof globalThis !== 'undefined' ? globalThis : global).__OU_USERDATA_DEFAULTS__ = obj;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
