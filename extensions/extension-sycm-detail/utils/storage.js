/**
 * chrome.storage：节流粒度读取、各 eventName 时间槽写入（去重用）
 * 节流分钟可手动写入 key sycm_throttle_minutes（数字），未设置则用 defaults 默认 20
 */
(function (global) {
  var KEYS = typeof __SYCM_DEFAULTS__ !== 'undefined' && __SYCM_DEFAULTS__.STORAGE_KEYS
    ? __SYCM_DEFAULTS__.STORAGE_KEYS
    : { throttleMinutes: 'sycm_throttle_minutes', lastSlotPrefix: 'sycm_last_slot_', logs: 'sycm_logs' };

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

  var obj = {
    getThrottleMinutes: getThrottleMinutes,
    setLastSlot: setLastSlot,
    STORAGE_KEYS: KEYS
  };
  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_STORAGE__ = obj;
})();
