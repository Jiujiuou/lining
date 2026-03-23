/**
 * 时间槽（与 extension-sycm-detail 逻辑一致）
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

function toCreatedAtISO(recordedAt) {
  var s = String(recordedAt).trim();
  if (s.length >= 19 && s[10] === ':') {
    return s.slice(0, 10) + 'T' + s.slice(11, 19) + '+08:00';
  }
  return s;
}

(function (global) {
  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_RANK_TIME__ = {
    getSlotKey: getSlotKey,
    toCreatedAtISO: toCreatedAtISO
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
