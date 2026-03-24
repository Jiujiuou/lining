/**
 * 东八区时间槽（与 extension-sycm-detail/utils/time.js 算法一致）
 */
function getSlotKey(recordedAtStr, throttleMinutes) {
  var s = String(recordedAtStr).trim();
  if (s.length < 19 || s[10] !== ':') return '';
  var datePart = s.slice(0, 10);
  var hour = s.slice(11, 13);
  var min = parseInt(s.slice(14, 16), 10);
  var slotMin = Math.floor(min / throttleMinutes) * throttleMinutes;
  var slotMinStr = (slotMin < 10 ? '0' : '') + slotMin;
  return datePart + ':' + hour + ':' + slotMinStr;
}

(function (global) {
  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_RANK_TIME__ = {
    getSlotKey: getSlotKey
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
