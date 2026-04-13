(function() {
  "use strict";
  (function(global) {
    var DEFS = typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" ? __SHOP_RECORD_DEFAULTS__ : null;
    var KEYS = DEFS && DEFS.STORAGE_KEYS ? DEFS.STORAGE_KEYS : { logs: "shop_record_logs", logsByTab: "shop_record_logs_by_tab" };
    var MAX = DEFS && DEFS.LOG_MAX_ENTRIES ? DEFS.LOG_MAX_ENTRIES : 20;
    var MAX_TABS = DEFS && DEFS.LOG_MAX_TABS ? DEFS.LOG_MAX_TABS : 6;
    var GET_TAB_MSG = DEFS && DEFS.RUNTIME && DEFS.RUNTIME.GET_TAB_ID_MESSAGE ? DEFS.RUNTIME.GET_TAB_ID_MESSAGE : "SR_GET_TAB_ID";
    var LOG_KEY = KEYS.logs || "shop_record_logs";
    var LOGS_BY_TAB_KEY = KEYS.logsByTab || "shop_record_logs_by_tab";
    var LOG_META_KEY = "__meta";
    function isQuotaError(err) {
      if (!err) return false;
      return /quota|QUOTA_BYTES|Resource::kQuotaBytes/i.test(String(err.message || err));
    }
    function safeSet(payload, cb) {
      chrome.storage.local.set(payload, function() {
        if (chrome.runtime && chrome.runtime.lastError && isQuotaError(chrome.runtime.lastError)) {
          return cb && cb(true);
        }
        if (cb) cb(false);
      });
    }
    function pruneByTab(byTab) {
      if (!byTab || typeof byTab !== "object") return {};
      var meta = byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === "object" ? byTab[LOG_META_KEY] : {};
      var ids = Object.keys(byTab).filter(function(k) {
        return k !== LOG_META_KEY;
      });
      if (ids.length <= MAX_TABS) {
        byTab[LOG_META_KEY] = meta;
        return byTab;
      }
      ids.sort(function(a, b) {
        var ta = meta[a] || "";
        var tb = meta[b] || "";
        return String(ta).localeCompare(String(tb));
      });
      while (ids.length > MAX_TABS) {
        var oldest = ids.shift();
        delete byTab[oldest];
        delete meta[oldest];
      }
      byTab[LOG_META_KEY] = meta;
      return byTab;
    }
    function resolveTabId(callback) {
      try {
        chrome.runtime.sendMessage({ type: GET_TAB_MSG }, function(res) {
          if (chrome.runtime.lastError || !res || res.tabId == null) {
            callback(null);
          } else {
            callback(res.tabId);
          }
        });
      } catch (e) {
        callback(null);
      }
    }
    function appendLog(level, msg) {
      var entry = { t: (/* @__PURE__ */ new Date()).toISOString(), level: level || "log", msg: String(msg) };
      resolveTabId(function(tabId) {
        if (tabId == null) {
          chrome.storage.local.get([LOG_KEY], function(result) {
            var data = result[LOG_KEY];
            if (!data || !Array.isArray(data.entries)) data = { entries: [] };
            data.entries.push(entry);
            if (data.entries.length > MAX) data.entries = data.entries.slice(-MAX);
            safeSet({ [LOG_KEY]: data }, function() {
            });
          });
          return;
        }
        chrome.storage.local.get([LOGS_BY_TAB_KEY], function(result) {
          var byTab = result[LOGS_BY_TAB_KEY] || {};
          var bucket = byTab[String(tabId)] || { entries: [] };
          if (!Array.isArray(bucket.entries)) bucket.entries = [];
          bucket.entries.push(entry);
          if (bucket.entries.length > MAX) bucket.entries = bucket.entries.slice(-MAX);
          byTab[String(tabId)] = bucket;
          var meta = byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === "object" ? byTab[LOG_META_KEY] : {};
          meta[String(tabId)] = (/* @__PURE__ */ new Date()).toISOString();
          byTab[LOG_META_KEY] = meta;
          byTab = pruneByTab(byTab);
          var o = {};
          o[LOGS_BY_TAB_KEY] = byTab;
          safeSet(o, function(quotaErr) {
            if (!quotaErr) return;
            byTab = pruneByTab(byTab);
            safeSet(o, function() {
            });
          });
        });
      });
    }
    function getLogs(callback, tabId) {
      if (tabId == null) {
        chrome.storage.local.get([LOG_KEY], function(result) {
          var data = result[LOG_KEY];
          callback(data && Array.isArray(data.entries) ? data.entries : []);
        });
        return;
      }
      chrome.storage.local.get([LOGS_BY_TAB_KEY], function(result) {
        var byTab = result[LOGS_BY_TAB_KEY] || {};
        var bucket = byTab[String(tabId)];
        var entries = bucket && Array.isArray(bucket.entries) ? bucket.entries : [];
        callback(entries);
      });
    }
    function clearLogs(callback, tabId) {
      if (tabId == null) {
        safeSet({ [LOG_KEY]: { entries: [] } }, function() {
          (callback || function() {
          })();
        });
        return;
      }
      chrome.storage.local.get([LOGS_BY_TAB_KEY], function(result) {
        var byTab = result[LOGS_BY_TAB_KEY] || {};
        delete byTab[String(tabId)];
        if (byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === "object") {
          delete byTab[LOG_META_KEY][String(tabId)];
        }
        var o = {};
        o[LOGS_BY_TAB_KEY] = byTab;
        safeSet(o, function() {
          (callback || function() {
          })();
        });
      });
    }
    var obj = {
      appendLog,
      getLogs,
      clearLogs,
      log: function(msg) {
        appendLog("log", msg);
      },
      warn: function(msg) {
        appendLog("warn", msg);
      },
      error: function(msg) {
        appendLog("error", msg);
      }
    };
    (typeof globalThis !== "undefined" ? globalThis : global).__SHOP_RECORD_LOGGER__ = obj;
  })(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
  const mod = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SHOP_LOGGER__ = mod;
  function initContentRateRefundBridge() {
    if (globalThis.__LINING_SHOP_RECORD_RATE_REFUND_BRIDGE__) return;
    globalThis.__LINING_SHOP_RECORD_RATE_REFUND_BRIDGE__ = true;
    (function() {
      var PREFIX = "[店铺记录数据]";
      var APPEND_LOG_TYPE = typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" && __SHOP_RECORD_DEFAULTS__.RUNTIME && __SHOP_RECORD_DEFAULTS__.RUNTIME.CONTENT_APPEND_LOG_MESSAGE ? __SHOP_RECORD_DEFAULTS__.RUNTIME.CONTENT_APPEND_LOG_MESSAGE : "shopRecordAppendLog";
      var MSG = "shop-record-refund-jsonp";
      window.addEventListener("message", function(ev) {
        if (ev.source !== window) return;
        var d = ev.data;
        if (!d || d.source !== MSG) return;
        var p = d.payload || {};
        var a = p.disputeRefundRate;
        var b = p.refundProFinishTime;
        var c = p.refundFinishRate;
        var line = PREFIX + " 店铺服务 纠纷退款率 " + String(a != null ? a : "—") + "；退货退款自主完结时长 " + String(b != null ? b : "—") + "；退款自主完结率 " + String(c != null ? c : "—");
        try {
          chrome.runtime.sendMessage({ type: APPEND_LOG_TYPE, msg: line });
        } catch (e) {
        }
        try {
          window.__SHOP_RECORD_RATE_REFUND_DATA__ = {
            disputeRefundRate: a,
            refundProFinishTime: b,
            refundFinishRate: c
          };
          window.dispatchEvent(
            new CustomEvent("shop-record-refund-data", {
              detail: window.__SHOP_RECORD_RATE_REFUND_DATA__
            })
          );
        } catch (e2) {
        }
      });
    })();
  }
  initContentRateRefundBridge();
})();
//# sourceMappingURL=content-rate-refund-bridge.js.map
