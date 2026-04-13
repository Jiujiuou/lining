(function() {
  "use strict";
  (function(global) {
    var KEYS = typeof __SYCM_DEFAULTS__ !== "undefined" && __SYCM_DEFAULTS__.STORAGE_KEYS ? __SYCM_DEFAULTS__.STORAGE_KEYS : {
      throttleMinutes: "sycm_throttle_minutes",
      lastSlotPrefix: "sycm_last_slot_",
      logs: "sycm_logs",
      liveJsonCatalog: "sycm_live_json_catalog",
      liveJsonFilter: "sycm_live_json_filter",
      liveJsonFilterByTab: "sycm_live_json_filter_by_tab",
      liveJsonCatalogByTab: "sycm_live_json_catalog_by_tab"
    };
    var common = typeof __SYCM_COMMON__ !== "undefined" ? __SYCM_COMMON__ : null;
    var safeSet = common && typeof common.safeSet === "function" ? common.safeSet : function(payload, onDone, onQuota) {
      function isQuotaError(err) {
        if (!err) return false;
        return /quota|QUOTA_BYTES|Resource::kQuotaBytes/i.test(String(err.message || err));
      }
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
    };
    function getThrottleMinutes(callback) {
      chrome.storage.local.get([KEYS.throttleMinutes], function(result) {
        var val = result[KEYS.throttleMinutes];
        callback(typeof val === "number" && val > 0 ? val : null);
      });
    }
    function setLastSlot(eventName, slotKey, callback) {
      var key = KEYS.lastSlotPrefix + eventName;
      safeSet({ [key]: slotKey }, callback || function() {
      }, function(retry) {
        chrome.storage.local.remove([key], function() {
          retry();
        });
      });
    }
    function setLastSlotsForEventItems(eventName, itemIdStrings, slotKey, callback) {
      var obj2 = {};
      for (var i = 0; i < itemIdStrings.length; i++) {
        var id = itemIdStrings[i];
        if (id == null || id === "") continue;
        obj2[KEYS.lastSlotPrefix + eventName + "_" + String(id)] = slotKey;
      }
      var keys = Object.keys(obj2);
      if (keys.length === 0) {
        (callback || function() {
        })();
        return;
      }
      safeSet(obj2, callback || function() {
      }, function(retry) {
        chrome.storage.local.remove(keys, function() {
          retry();
        });
      });
    }
    var obj = {
      getThrottleMinutes,
      setLastSlot,
      setLastSlotsForEventItems,
      STORAGE_KEYS: KEYS
    };
    (typeof globalThis !== "undefined" ? globalThis : global).__SYCM_STORAGE__ = obj;
  })();
  const mod = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SYCM_DETAIL_STORAGE__ = mod;
})();
//# sourceMappingURL=storage.js.map
