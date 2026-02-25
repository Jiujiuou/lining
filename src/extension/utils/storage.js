/**
 * chrome.storage 读写封装（节流槽、最近写入、节流粒度）
 * 供 content.js 与 popup 使用
 */
(function (global) {
  var KEYS = typeof __SYCM_DEFAULTS__ !== 'undefined' && __SYCM_DEFAULTS__.STORAGE_KEYS
    ? __SYCM_DEFAULTS__.STORAGE_KEYS
    : { throttleMinutes: 'sycm_throttle_minutes', lastSlotPrefix: 'sycm_last_slot_', lastWrite: 'sycm_last_write', logs: 'sycm_logs' };

  function getThrottleMinutes(callback) {
    chrome.storage.local.get([KEYS.throttleMinutes], function (result) {
      var val = result[KEYS.throttleMinutes];
      callback(typeof val === 'number' && val > 0 ? val : null);
    });
  }

  function setThrottleMinutes(minutes, callback) {
    chrome.storage.local.set({ [KEYS.throttleMinutes]: minutes }, callback || function () {});
  }

  function getLastSlot(eventName, callback) {
    var key = KEYS.lastSlotPrefix + eventName;
    chrome.storage.local.get([key], function (result) {
      callback(result[key] || null);
    });
  }

  function setLastSlot(eventName, slotKey, callback) {
    var key = KEYS.lastSlotPrefix + eventName;
    chrome.storage.local.set({ [key]: slotKey }, callback || function () {});
  }

  /** @param {{ at: string, slotKey: string, eventName: string }} info */
  function setLastWrite(info, callback) {
    chrome.storage.local.set({ [KEYS.lastWrite]: info }, callback || function () {});
  }

  function getLastWrite(callback) {
    chrome.storage.local.get([KEYS.lastWrite], function (result) {
      callback(result[KEYS.lastWrite] || null);
    });
  }

  var obj = {
    getThrottleMinutes: getThrottleMinutes,
    setThrottleMinutes: setThrottleMinutes,
    getLastSlot: getLastSlot,
    setLastSlot: setLastSlot,
    setLastWrite: setLastWrite,
    getLastWrite: getLastWrite,
    STORAGE_KEYS: KEYS
  };
  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_STORAGE__ = obj;
})();
