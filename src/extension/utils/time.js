/**
 * 时间槽与东八区时间工具（content 使用）
 */

/**
 * 从 recordedAt（东八区 "YYYY-MM-DD:HH:mm:ss"）算出所属时间槽的 key
 * @param {string} recordedAtStr
 * @param {number} throttleMinutes - 节流粒度（分钟）
 * @returns {string} 如 "2025-02-24:09:20"
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

/**
 * 东八区时间字符串 → ISO 格式（Supabase timestamptz）
 * @param {string} recordedAt - "YYYY-MM-DD:HH:mm:ss"
 * @returns {string} "YYYY-MM-DDTHH:mm:ss+08:00"
 */
function toCreatedAtISO(recordedAt) {
  var s = String(recordedAt).trim();
  if (s.length >= 19 && s[10] === ':') {
    return s.slice(0, 10) + 'T' + s.slice(11, 19) + '+08:00';
  }
  return s;
}

(function (global) {
  var obj = { getSlotKey: getSlotKey, toCreatedAtISO: toCreatedAtISO };
  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_TIME__ = obj;
})();
