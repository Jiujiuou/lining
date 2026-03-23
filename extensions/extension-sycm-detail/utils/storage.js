/**
 * chrome.storage：节流粒度读取、各 eventName 时间槽写入（去重用）
 * 节流分钟可手动写入 key sycm_throttle_minutes（数字），未设置则用 defaults 默认 20
 */
(function (global) {
  var KEYS =
    typeof __SYCM_DEFAULTS__ !== 'undefined' && __SYCM_DEFAULTS__.STORAGE_KEYS
      ? __SYCM_DEFAULTS__.STORAGE_KEYS
      : {
          throttleMinutes: 'sycm_throttle_minutes',
          lastSlotPrefix: 'sycm_last_slot_',
          logs: 'sycm_logs',
          liveJsonCatalog: 'sycm_live_json_catalog',
          liveJsonFilter: 'sycm_live_json_filter',
          liveJsonFilterByTab: 'sycm_live_json_filter_by_tab',
          liveJsonCatalogByTab: 'sycm_live_json_catalog_by_tab'
        };

  function getThrottleMinutes(callback) {
    chrome.storage.local.get([KEYS.throttleMinutes], function (result) {
      var val = result[KEYS.throttleMinutes];
      callback(typeof val === 'number' && val > 0 ? val : null);
    });
  }

  function setLastSlot(eventName, slotKey, callback) {
    var key = KEYS.lastSlotPrefix + eventName;
    chrome.storage.local.set({ [key]: slotKey }, callback || function () {});
  }

  /**
   * 多商品加购：按「eventName + item_id」分别记录本槽已写入，与 DB 唯一键 (item_id, slot_ts) 一致
   * @param {string} eventName 如 sycm-goods-live
   * @param {string[]} itemIdStrings
   * @param {string} slotKey 与 getSlotKey 一致
   */
  function setLastSlotsForEventItems(eventName, itemIdStrings, slotKey, callback) {
    var obj = {};
    for (var i = 0; i < itemIdStrings.length; i++) {
      var id = itemIdStrings[i];
      if (id == null || id === '') continue;
      obj[KEYS.lastSlotPrefix + eventName + '_' + String(id)] = slotKey;
    }
    var keys = Object.keys(obj);
    if (keys.length === 0) {
      (callback || function () {})();
      return;
    }
    chrome.storage.local.set(obj, callback || function () {});
  }

  var obj = {
    getThrottleMinutes: getThrottleMinutes,
    setLastSlot: setLastSlot,
    setLastSlotsForEventItems: setLastSlotsForEventItems,
    STORAGE_KEYS: KEYS
  };
  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_STORAGE__ = obj;
})();
