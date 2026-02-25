/**
 * 扩展默认常量与 storage key 命名
 * 供 content.js、popup 等使用
 */
(function (global) {
  var DEFAULTS = {
    /** 节流粒度（分钟），同一时间槽内同一数据源只写一次 */
    THROTTLE_MINUTES: 20,
    /** 节流粒度可选值（供 popup 选择） */
    THROTTLE_OPTIONS: [10, 20, 30, 60]
  };

  var STORAGE_KEYS = {
    throttleMinutes: 'sycm_throttle_minutes',
    /** 每个 eventName 对应 lastSlot 的 key 前缀，完整 key: sycm_last_slot_<eventName> */
    lastSlotPrefix: 'sycm_last_slot_',
    /** 最近一次写入信息，用于 popup 展示 */
    lastWrite: 'sycm_last_write',
    /** 扩展日志列表，供 popup 展示 */
    logs: 'sycm_logs'
  };

  /** 日志列表最大条数 */
  var LOG_MAX_ENTRIES = 100;

  var PREFIX = '';

  var obj = {
    DEFAULTS: DEFAULTS,
    STORAGE_KEYS: STORAGE_KEYS,
    LOG_MAX_ENTRIES: LOG_MAX_ENTRIES,
    PREFIX: PREFIX
  };
  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_DEFAULTS__ = obj;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
