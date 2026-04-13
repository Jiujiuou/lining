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
  function initContentOnebpBridge() {
    if (globalThis.__LINING_SHOP_RECORD_ONEBP_BRIDGE__) return;
    globalThis.__LINING_SHOP_RECORD_ONEBP_BRIDGE__ = true;
    (function() {
      var PREFIX = "[店铺记录数据]";
      var APPEND_LOG_TYPE = typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" && __SHOP_RECORD_DEFAULTS__.RUNTIME && __SHOP_RECORD_DEFAULTS__.RUNTIME.CONTENT_APPEND_LOG_MESSAGE ? __SHOP_RECORD_DEFAULTS__.RUNTIME.CONTENT_APPEND_LOG_MESSAGE : "shopRecordAppendLog";
      var MSG = "shop-record-onebp-query";
      var localDaily = typeof __SHOP_RECORD_LOCAL_DAILY__ !== "undefined" ? __SHOP_RECORD_LOCAL_DAILY__ : null;
      function yesterdayYmd() {
        var d = /* @__PURE__ */ new Date();
        d.setDate(d.getDate() - 1);
        var y = d.getFullYear();
        var mo = String(d.getMonth() + 1);
        var da = String(d.getDate());
        return y + "-" + (mo.length < 2 ? "0" + mo : mo) + "-" + (da.length < 2 ? "0" + da : da);
      }
      function maybeMergeOnebpSearch(bizCode, payload) {
        if (bizCode !== "onebpSearch") return;
        var p = payload;
        if (typeof p === "string") {
          try {
            p = JSON.parse(p);
          } catch (e) {
            return;
          }
        }
        if (!p || typeof p !== "object") return;
        var list = p.data && p.data.list;
        var row0 = Array.isArray(list) && list[0] ? list[0] : null;
        if (!row0) return;
        var ymd = yesterdayYmd();
        if (row0.thedate && /^\d{4}-\d{2}-\d{2}$/.test(String(row0.thedate))) {
          ymd = String(row0.thedate);
        }
        function numStr(v, decimals) {
          if (v == null || v === "") return null;
          var n = Number(v);
          if (Number.isNaN(n)) return String(v);
          var d = decimals;
          return n.toFixed(d);
        }
        var charge = numStr(row0.charge, 2);
        var roi = numStr(row0.roi, 2);
        var ppc = numStr(row0.ecpc, 2);
        var cvrRaw = row0.cvr;
        var cvrStr = null;
        if (cvrRaw != null && cvrRaw !== "") {
          var cvrN = Number(cvrRaw);
          if (!Number.isNaN(cvrN)) {
            cvrStr = (cvrN * 100).toFixed(2) + "%";
          } else {
            cvrStr = String(cvrRaw);
          }
        }
        if (!charge && !cvrStr && !ppc && !roi) return;
        var row = { report_at: ymd };
        if (charge) row.ztc_charge_yuan = charge;
        if (cvrStr) row.ztc_cvr = cvrStr;
        if (ppc) row.ztc_ppc = ppc;
        if (roi) row.ztc_roi = roi;
        if (localDaily && typeof localDaily.mergeDailyRowPatch === "function") {
          localDaily.mergeDailyRowPatch(row);
        }
      }
      function maybeMergeOnebpDisplay(bizCode, payload) {
        if (bizCode !== "onebpDisplay") return;
        var p = payload;
        if (typeof p === "string") {
          try {
            p = JSON.parse(p);
          } catch (e) {
            return;
          }
        }
        if (!p || typeof p !== "object") return;
        var list = p.data && p.data.list;
        var row0 = Array.isArray(list) && list[0] ? list[0] : null;
        if (!row0) return;
        var ymd = yesterdayYmd();
        if (row0.thedate && /^\d{4}-\d{2}-\d{2}$/.test(String(row0.thedate))) {
          ymd = String(row0.thedate);
        }
        function numStr(v, decimals) {
          if (v == null || v === "") return null;
          var n = Number(v);
          if (Number.isNaN(n)) return String(v);
          var dec = decimals;
          return n.toFixed(dec);
        }
        var charge = numStr(row0.charge, 2);
        var roi = numStr(row0.roi, 2);
        var ppc = numStr(row0.ecpc, 2);
        var cvrRaw = row0.cvr;
        var cvrStr = null;
        if (cvrRaw != null && cvrRaw !== "") {
          var cvrN = Number(cvrRaw);
          if (!Number.isNaN(cvrN)) {
            cvrStr = (cvrN * 100).toFixed(2) + "%";
          } else {
            cvrStr = String(cvrRaw);
          }
        }
        if (!charge && !cvrStr && !ppc && !roi) return;
        var row = { report_at: ymd };
        if (charge) row.ylmf_charge_yuan = charge;
        if (cvrStr) row.ylmf_cvr = cvrStr;
        if (ppc) row.ylmf_ppc = ppc;
        if (roi) row.ylmf_roi = roi;
        if (localDaily && typeof localDaily.mergeDailyRowPatch === "function") {
          localDaily.mergeDailyRowPatch(row);
        }
      }
      function maybeMergeOnebpSite(bizCode, payload) {
        if (bizCode !== "onebpSite") return;
        var p = payload;
        if (typeof p === "string") {
          try {
            p = JSON.parse(p);
          } catch (e) {
            return;
          }
        }
        if (!p || typeof p !== "object") return;
        var list = p.data && p.data.list;
        var row0 = Array.isArray(list) && list[0] ? list[0] : null;
        if (!row0) return;
        var ymd = yesterdayYmd();
        if (row0.thedate && /^\d{4}-\d{2}-\d{2}$/.test(String(row0.thedate))) {
          ymd = String(row0.thedate);
        }
        function numStr(v, decimals) {
          if (v == null || v === "") return null;
          var n = Number(v);
          if (Number.isNaN(n)) return String(v);
          var dec = decimals;
          return n.toFixed(dec);
        }
        var charge = numStr(row0.charge, 2);
        var roi = numStr(row0.roi, 2);
        if (!charge && !roi) return;
        var row = { report_at: ymd };
        if (charge) row.site_wide_charge_yuan = charge;
        if (roi) row.site_wide_roi = roi;
        if (localDaily && typeof localDaily.mergeDailyRowPatch === "function") {
          localDaily.mergeDailyRowPatch(row);
        }
      }
      function maybeMergeOnebpShortVideo(bizCode, payload) {
        if (bizCode !== "onebpShortVideo") return;
        var p = payload;
        if (typeof p === "string") {
          try {
            p = JSON.parse(p);
          } catch (e) {
            return;
          }
        }
        if (!p || typeof p !== "object") return;
        var list = p.data && p.data.list;
        var row0 = Array.isArray(list) && list[0] ? list[0] : null;
        if (!row0) return;
        var ymd = yesterdayYmd();
        if (row0.thedate && /^\d{4}-\d{2}-\d{2}$/.test(String(row0.thedate))) {
          ymd = String(row0.thedate);
        }
        function numStr(v, decimals) {
          if (v == null || v === "") return null;
          var n = Number(v);
          if (Number.isNaN(n)) return String(v);
          var dec = decimals;
          return n.toFixed(dec);
        }
        var charge = numStr(row0.charge, 2);
        var roi = numStr(row0.roi, 2);
        if (!charge && !roi) return;
        var row = { report_at: ymd };
        if (charge) row.content_promo_charge_yuan = charge;
        if (roi) row.content_promo_roi = roi;
        if (localDaily && typeof localDaily.mergeDailyRowPatch === "function") {
          localDaily.mergeDailyRowPatch(row);
        }
      }
      window.addEventListener("message", function(ev) {
        if (ev.source !== window) return;
        var d = ev.data;
        if (!d || d.source !== MSG) return;
        var seq = d.seq != null ? " #" + d.seq : "";
        var tabLabel = d.label || (d.bizCode === "onebpDisplay" ? "万象台2" : d.bizCode === "onebpSite" ? "万象3" : d.bizCode === "onebpShortVideo" ? "万象4" : "万象台1");
        var text = typeof d.payload === "string" ? d.payload : JSON.stringify(d.payload, null, 2);
        var line = PREFIX + " " + tabLabel + " query.json" + seq + "\n" + text;
        if (line.length > 12e3) {
          line = line.slice(0, 12e3) + "\n…（已截断，完整见控制台）";
        }
        try {
          chrome.runtime.sendMessage({ type: APPEND_LOG_TYPE, msg: line });
        } catch (e) {
        }
        maybeMergeOnebpSearch(d.bizCode, d.payload);
        maybeMergeOnebpDisplay(d.bizCode, d.payload);
        maybeMergeOnebpSite(d.bizCode, d.payload);
        maybeMergeOnebpShortVideo(d.bizCode, d.payload);
      });
    })();
  }
  initContentOnebpBridge();
})();
//# sourceMappingURL=content-onebp-bridge.js.map
