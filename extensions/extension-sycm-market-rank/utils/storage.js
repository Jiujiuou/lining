/**
 * chrome.storage：节流、按 eventName+关键词 的时间槽
 */
(function (global) {
  var KEYS =
    typeof __SYCM_RANK_DEFAULTS__ !== 'undefined' && __SYCM_RANK_DEFAULTS__.STORAGE_KEYS
      ? __SYCM_RANK_DEFAULTS__.STORAGE_KEYS
      : {
          throttleMinutes: 'sycm_rank_only_throttle_minutes',
          lastSlotPrefix: 'sycm_rank_only_last_slot_',
          logs: 'sycm_rank_only_logs',
          rankCatalog: 'sycm_rank_only_catalog',
          rankFilter: 'sycm_rank_only_filter',
          rankFilterByTab: 'sycm_rank_only_filter_by_tab',
          rankCatalogByTab: 'sycm_rank_only_catalog_by_tab'
        };

  function getThrottleMinutes(callback) {
    chrome.storage.local.get([KEYS.throttleMinutes], function (result) {
      var val = result[KEYS.throttleMinutes];
      callback(typeof val === 'number' && val > 0 ? val : null);
    });
  }

  function setLastSlot(eventSuffix, slotKey, callback) {
    var key = KEYS.lastSlotPrefix + eventSuffix;
    chrome.storage.local.set({ [key]: slotKey }, callback || function () {});
  }

  var obj = {
    getThrottleMinutes: getThrottleMinutes,
    setLastSlot: setLastSlot,
    STORAGE_KEYS: KEYS
  };
  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_RANK_STORAGE__ = obj;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
