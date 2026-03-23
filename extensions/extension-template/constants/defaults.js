/**
 * 扩展模板：storage 键名、日志前缀、运行时消息类型。复制后请整体替换 EXT_TEMPLATE 相关命名。
 */
(function (global) {
  var STORAGE_KEYS = {
    logs: "ext_template_logs",
    /** Record<tabIdStr, { entries }> — 多标签日志隔离 */
    logsByTab: "ext_template_logs_by_tab"
  };
  var LOG_MAX_ENTRIES = 100;
  var PREFIX = "[扩展模板]";
  /** background / logger 共用的 chrome.runtime 消息 type */
  var RUNTIME = {
    GET_TAB_ID_MESSAGE: "EXT_TEMPLATE_GET_TAB_ID"
  };

  var obj = {
    STORAGE_KEYS: STORAGE_KEYS,
    LOG_MAX_ENTRIES: LOG_MAX_ENTRIES,
    PREFIX: PREFIX,
    RUNTIME: RUNTIME
  };
  (typeof globalThis !== "undefined" ? globalThis : global).__EXT_TEMPLATE_DEFAULTS__ = obj;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
