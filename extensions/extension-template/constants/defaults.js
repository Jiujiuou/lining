/**
 * 扩展模板：storage 键名与日志前缀。复制后请整体替换 EXT_TEMPLATE 相关命名。
 */
(function (global) {
  var STORAGE_KEYS = {
    logs: "ext_template_logs"
  };
  var LOG_MAX_ENTRIES = 100;
  var PREFIX = "[扩展模板]";

  var obj = {
    STORAGE_KEYS: STORAGE_KEYS,
    LOG_MAX_ENTRIES: LOG_MAX_ENTRIES,
    PREFIX: PREFIX
  };
  (typeof globalThis !== "undefined" ? globalThis : global).__EXT_TEMPLATE_DEFAULTS__ = obj;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
