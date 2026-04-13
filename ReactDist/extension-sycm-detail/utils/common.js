(function() {
  "use strict";
  (function(global) {
    function isQuotaError(err) {
      if (!err) return false;
      var msg = String(err.message || err);
      return /quota|QUOTA_BYTES|Resource::kQuotaBytes/i.test(msg);
    }
    function safeSet(payload, onDone, onQuota) {
      try {
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
      } catch (e) {
        if (isQuotaError(e) && typeof onQuota === "function") {
          onQuota(function() {
            chrome.storage.local.set(payload, function() {
              if (typeof onDone === "function") onDone();
            });
          });
          return;
        }
        if (typeof onDone === "function") onDone();
      }
    }
    function pruneByTabWithMeta(byTab, metaKey, maxTabs) {
      if (!byTab || typeof byTab !== "object") return {};
      if (!metaKey) metaKey = "__meta";
      if (typeof maxTabs !== "number") maxTabs = 1;
      var meta = byTab[metaKey] && typeof byTab[metaKey] === "object" ? byTab[metaKey] : {};
      var ids = Object.keys(byTab).filter(function(k) {
        return k !== metaKey;
      });
      ids.sort(function(a, b) {
        var ta = meta[a] || "";
        var tb = meta[b] || "";
        return String(ta).localeCompare(String(tb));
      });
      while (ids.length > maxTabs) {
        var oldest = ids.shift();
        delete byTab[oldest];
        delete meta[oldest];
      }
      byTab[metaKey] = meta;
      return byTab;
    }
    function escapeHtml(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function resolveTabIdByMessage(callback) {
      try {
        chrome.runtime.sendMessage({ type: "SYCM_GET_TAB_ID" }, function(res) {
          if (chrome.runtime.lastError || !res || res.tabId == null) callback(null);
          else callback(res.tabId);
        });
      } catch (e) {
        callback(null);
      }
    }
    var obj = {
      isQuotaError,
      safeSet,
      pruneByTabWithMeta,
      escapeHtml,
      resolveTabIdByMessage
    };
    global.__SYCM_COMMON__ = obj;
  })(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
  const mod = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SYCM_DETAIL_COMMON__ = mod;
})();
//# sourceMappingURL=common.js.map
