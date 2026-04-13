(function() {
  "use strict";
  (function(global) {
    var MAX_DAYS = 3;
    function isQuotaError(err) {
      if (!err) return false;
      var msg = String(err.message || err);
      return /quota|QUOTA_BYTES|Resource::kQuotaBytes/i.test(msg);
    }
    function safeSet(payload, onDone, onQuota) {
      chrome.storage.local.set(payload, function() {
        if (chrome.runtime && chrome.runtime.lastError && isQuotaError(chrome.runtime.lastError) && typeof onQuota === "function") {
          onQuota(function() {
            chrome.storage.local.set(payload, function() {
              if (typeof onDone === "function") onDone();
            });
          });
          return;
        }
        if (typeof onDone === "function") onDone();
      });
    }
    function getStorageKey() {
      var d = typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" ? __SHOP_RECORD_DEFAULTS__ : null;
      if (d && d.STORAGE_KEYS && d.STORAGE_KEYS.dailyLocalByDate) {
        return d.STORAGE_KEYS.dailyLocalByDate;
      }
      return "shop_record_daily_local_by_date";
    }
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
      chrome.storage.local.get([storageKey], function(result) {
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
          if (v !== void 0 && v !== null && v !== "") next[k] = v;
        }
        next.updated_at_local = (/* @__PURE__ */ new Date()).toISOString();
        bag[date] = next;
        var dates = Object.keys(bag).filter(function(k2) {
          return /^\d{4}-\d{2}-\d{2}$/.test(k2);
        }).sort();
        while (dates.length > MAX_DAYS) {
          delete bag[dates.shift()];
        }
        var o = {};
        o[storageKey] = bag;
        safeSet(o, function() {
          if (typeof done === "function") done();
        }, function(retry) {
          while (dates.length > 1) {
            delete bag[dates.shift()];
          }
          safeSet(o, retry);
        });
      });
    }
    var api = { mergeDailyRowPatch, getStorageKey };
    (typeof globalThis !== "undefined" ? globalThis : global).__SHOP_RECORD_LOCAL_DAILY__ = api;
  })(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
  const mod = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SHOP_LOCAL_DAILY_STORE__ = mod;
})();
//# sourceMappingURL=local-daily-store.js.map
