(function (global) {
  var root = typeof globalThis !== 'undefined' ? globalThis : global;
  root.__AMCR_DEFAULTS__ = {
    STORAGE_KEYS: { logs: 'amcr_logs' },
    LOG_MAX_ENTRIES: 100
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
