(function (global) {
  var root = typeof globalThis !== 'undefined' ? globalThis : global;
  root.__AMCR_DEFAULTS__ = {
    STORAGE_KEYS: {
      logs: 'amcr_logs',
      /** Record<tabIdStr, { entries }> — 按标签页隔离扩展日志 */
      logsByTab: 'amcr_logs_by_tab',
      /** Record<tabIdStr, AmcrTabState> — 多开推广页互不覆盖（弹窗只读当前活动 tab） */
      findPageStateByTab: 'amcr_findPageStateByTab',
      /** Record<dateStr, { byBiz, updated_at_local }> — 本地推广登记快照（按日、按来源） */
      localRegisterByDate: 'amcr_local_register_by_date'
    },
    LOG_MAX_ENTRIES: 100
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
