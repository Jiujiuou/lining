(function() {
  "use strict";
  function getSlotKey(recordedAtStr, throttleMinutes) {
    var s = String(recordedAtStr).trim();
    if (s.length < 19 || s[10] !== ":") return "";
    var datePart = s.slice(0, 10);
    var hour = s.slice(11, 13);
    var min = parseInt(s.slice(14, 16), 10);
    var slotMin = Math.floor(min / throttleMinutes) * throttleMinutes;
    var slotMinStr = (slotMin < 10 ? "0" : "") + slotMin;
    return datePart + ":" + hour + ":" + slotMinStr;
  }
  function toCreatedAtISO(recordedAt) {
    var s = String(recordedAt).trim();
    if (s.length >= 19 && s[10] === ":") {
      return s.slice(0, 10) + "T" + s.slice(11, 19) + "+08:00";
    }
    return s;
  }
  function getSlotTsISO(recordedAtStr, throttleMinutes) {
    var slotKey = getSlotKey(recordedAtStr, throttleMinutes);
    if (!slotKey) return "";
    return slotKey.slice(0, 10) + "T" + slotKey.slice(11) + ":00+08:00";
  }
  (function(global) {
    var obj = { getSlotKey, toCreatedAtISO, getSlotTsISO };
    (typeof globalThis !== "undefined" ? globalThis : global).__SYCM_TIME__ = obj;
  })();
  const mod = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SYCM_DETAIL_TIME__ = mod;
})();
//# sourceMappingURL=time.js.map
