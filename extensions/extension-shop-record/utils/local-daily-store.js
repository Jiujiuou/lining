/**
 * 将各来源采集到的每日字段合并写入 chrome.storage.local（按 report_at 分桶）
 */
(function (global) {
  function getStorageKey() {
    var d =
      typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" ? __SHOP_RECORD_DEFAULTS__ : null;
    if (d && d.STORAGE_KEYS && d.STORAGE_KEYS.dailyLocalByDate) {
      return d.STORAGE_KEYS.dailyLocalByDate;
    }
    return "shop_record_daily_local_by_date";
  }

  /**
   * @param {Object} patch 须含 report_at；其余字段与每日行一致，会合并进同日快照
   * @param {function=} done 可选回调
   */
  function mergeDailyRowPatch(patch, done) {
    if (!patch || typeof patch !== "object" || !patch.report_at) {
      if (typeof done === "function") done();
      return;
    }
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      if (typeof done === "function") done();
      return;
    }
    var storageKey = getStorageKey();
    chrome.storage.local.get([storageKey], function (result) {
      if (chrome.runtime && chrome.runtime.lastError) {
        if (typeof done === "function") done();
        return;
      }
      var bag = result[storageKey];
      if (!bag || typeof bag !== "object") bag = {};
      var date = String(patch.report_at);
      var cur = bag[date];
      if (!cur || typeof cur !== "object") cur = {};
      var next = {};
      var k;
      for (k in cur) {
        if (Object.prototype.hasOwnProperty.call(cur, k)) next[k] = cur[k];
      }
      for (k in patch) {
        if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
        if (k === "report_at") {
          next.report_at = patch.report_at;
          continue;
        }
        var v = patch[k];
        if (v !== undefined && v !== null && v !== "") next[k] = v;
      }
      next.updated_at_local = new Date().toISOString();
      bag[date] = next;
      var o = {};
      o[storageKey] = bag;
      chrome.storage.local.set(o, function () {
        if (typeof done === "function") done();
      });
    });
  }

  var api = { mergeDailyRowPatch: mergeDailyRowPatch, getStorageKey: getStorageKey };
  (typeof globalThis !== "undefined" ? globalThis : global).__SHOP_RECORD_LOCAL_DAILY__ = api;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
