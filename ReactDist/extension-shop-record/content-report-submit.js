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
  const mod$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SHOP_LOGGER__ = mod$1;
  (function(global) {
    var FIELD_MAP = [
      ["item_desc_match_score", "7069"],
      ["sycm_pv", "7070"],
      ["seller_service_score", "7071"],
      ["sycm_uv", "7072"],
      ["seller_shipping_score", "7073"],
      ["sycm_pay_buyers", "7074"],
      ["refund_finish_duration", "7075"],
      ["sycm_pay_items", "7076"],
      ["refund_finish_rate", "7077"],
      ["sycm_pay_amount", "7078"],
      ["dispute_refund_rate", "7079"],
      ["sycm_aov", "7080"],
      ["taobao_cps_spend_yuan", "7081"],
      ["sycm_pay_cvr", "7082"],
      ["ztc_charge_yuan", "7083"],
      ["sycm_old_visitor_ratio", "7084"],
      ["ztc_cvr", "7085"],
      ["sycm_avg_stay_sec", "7086"],
      ["ztc_ppc", "7087"],
      ["sycm_avg_pv_depth", "7088"],
      ["ztc_roi", "7089"],
      ["sycm_bounce_rate", "7090"],
      ["ylmf_charge_yuan", "11452"],
      ["ylmf_cvr", "11453"],
      ["ylmf_ppc", "11454"],
      ["ylmf_roi", "11455"]
    ];
    var DEFAULT_ZERO_FIELD_IDS = ["13386", "15095", "15096", "15097"];
    var MORE_FIELDS = [
      ["site_wide_charge_yuan", "15851"],
      ["site_wide_roi", "15852"],
      ["content_promo_charge_yuan", "31083"],
      ["content_promo_roi", "31084"]
    ];
    function allPairs() {
      return FIELD_MAP.concat(MORE_FIELDS);
    }
    function setNativeInputOrTextareaValue(el, v) {
      var desc = null;
      if (el instanceof HTMLTextAreaElement) {
        desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
      } else if (el instanceof HTMLInputElement) {
        desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      }
      if (desc && desc.set) {
        desc.set.call(el, v);
      } else {
        el.value = v;
      }
    }
    function dispatchInputAndChange(el, v) {
      var isEmpty = v === "";
      var inputType = isEmpty ? "deleteContentBackward" : "insertFromPaste";
      try {
        el.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            inputType,
            data: isEmpty ? null : v
          })
        );
      } catch {
        try {
          el.dispatchEvent(new Event("input", { bubbles: true }));
        } catch {
        }
      }
      try {
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } catch {
      }
    }
    function dispatchOnFieldMarkCell(el) {
      var cell = el.closest && el.closest("[data-fieldmark]");
      if (!cell) return;
      try {
        cell.dispatchEvent(
          new InputEvent("input", { bubbles: true, cancelable: true, composed: true })
        );
      } catch {
        try {
          cell.dispatchEvent(new Event("input", { bubbles: true }));
        } catch {
        }
      }
      try {
        cell.dispatchEvent(new Event("change", { bubbles: true }));
      } catch {
      }
    }
    function getFieldControlElement(fieldIdSuffix) {
      var id = "field" + fieldIdSuffix;
      var cell = document.querySelector('[data-fieldmark="' + id + '"]');
      if (cell) {
        var inner = cell.querySelector("input.wf-input, input, textarea");
        if (inner) return inner;
      }
      var byId = document.getElementById(id);
      if (byId && (byId.tagName === "INPUT" || byId.tagName === "TEXTAREA")) return byId;
      return null;
    }
    function setFieldValue(fieldIdSuffix, str) {
      var id = "field" + fieldIdSuffix;
      var el = getFieldControlElement(fieldIdSuffix);
      if (!el) return false;
      var v = str == null ? "" : String(str);
      var tag = el.tagName && el.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea") {
        setNativeInputOrTextareaValue(el, v);
        dispatchInputAndChange(el, v);
        dispatchOnFieldMarkCell(el);
      } else {
        el.value = v;
        dispatchInputAndChange(el, v);
        dispatchOnFieldMarkCell(el);
      }
      var sp = document.getElementById(id + "span");
      if (sp && el.type === "hidden") {
        sp.textContent = v;
      }
      return true;
    }
    function fillReportPageFromSnapshot(snap) {
      if (!snap || typeof snap !== "object") return { ok: false, filled: 0 };
      var n = 0;
      allPairs().forEach(function(pair) {
        var key = pair[0];
        var fid = pair[1];
        var raw = snap[key];
        var has = raw !== void 0 && raw !== null && String(raw).replace(/\s/g, "") !== "";
        if (!has) return;
        if (setFieldValue(fid, raw)) n += 1;
      });
      DEFAULT_ZERO_FIELD_IDS.forEach(function(fid) {
        if (setFieldValue(fid, "0")) n += 1;
      });
      return { ok: true, filled: n };
    }
    function yesterdayYmd() {
      var d = /* @__PURE__ */ new Date();
      d.setDate(d.getDate() - 1);
      var y = d.getFullYear();
      var mo = String(d.getMonth() + 1);
      var da = String(d.getDate());
      return y + "-" + (mo.length < 2 ? "0" + mo : mo) + "-" + (da.length < 2 ? "0" + da : da);
    }
    function pickSnapshotFromBag(bag) {
      if (!bag || typeof bag !== "object") return null;
      var ymd = yesterdayYmd();
      if (bag[ymd]) return bag[ymd];
      var dates = Object.keys(bag).filter(function(k) {
        return /^\d{4}-\d{2}-\d{2}$/.test(k);
      });
      dates.sort();
      return dates.length ? bag[dates[dates.length - 1]] : null;
    }
    var api = {
      fillReportPageFromSnapshot,
      pickSnapshotFromBag,
      yesterdayYmd,
      getStorageKey: function() {
        var d = typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" ? __SHOP_RECORD_DEFAULTS__ : null;
        if (d && d.STORAGE_KEYS && d.STORAGE_KEYS.dailyLocalByDate) {
          return d.STORAGE_KEYS.dailyLocalByDate;
        }
        return "shop_record_daily_local_by_date";
      }
    };
    (typeof globalThis !== "undefined" ? globalThis : global).__SHOP_RECORD_REPORT_PAGE_FILL__ = api;
  })(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
  const mod = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SHOP_REPORT_PAGE_FILL__ = mod;
  function initContentReportSubmit() {
    if (globalThis.__LINING_SHOP_RECORD_REPORT_SUBMIT__) return;
    globalThis.__LINING_SHOP_RECORD_REPORT_SUBMIT__ = true;
    (function() {
      var PREFIX = "[店铺记录数据]";
      var DEFS = typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" ? __SHOP_RECORD_DEFAULTS__ : null;
      var APPEND_LOG_TYPE = DEFS && DEFS.RUNTIME && DEFS.RUNTIME.CONTENT_APPEND_LOG_MESSAGE ? DEFS.RUNTIME.CONTENT_APPEND_LOG_MESSAGE : "shopRecordAppendLog";
      var FILL_MSG = DEFS && DEFS.RUNTIME && DEFS.RUNTIME.CONTENT_FILL_REPORT_MESSAGE ? DEFS.RUNTIME.CONTENT_FILL_REPORT_MESSAGE : "SR_FILL_REPORT";
      var FALLBACK_DAILY_BAG_KEY = "shop_record_daily_local_by_date";
      function getDailyStorageKey() {
        if (DEFS && DEFS.STORAGE_KEYS && DEFS.STORAGE_KEYS.dailyLocalByDate) {
          return DEFS.STORAGE_KEYS.dailyLocalByDate;
        }
        return FALLBACK_DAILY_BAG_KEY;
      }
      function pickSnapshotFromBagInline(bag) {
        if (!bag || typeof bag !== "object") return null;
        var d = /* @__PURE__ */ new Date();
        d.setDate(d.getDate() - 1);
        var y = d.getFullYear();
        var mo = String(d.getMonth() + 1);
        var da = String(d.getDate());
        var ymd = y + "-" + (mo.length < 2 ? "0" + mo : mo) + "-" + (da.length < 2 ? "0" + da : da);
        if (bag[ymd]) return bag[ymd];
        var dates = Object.keys(bag).filter(function(k) {
          return /^\d{4}-\d{2}-\d{2}$/.test(k);
        });
        dates.sort();
        return dates.length ? bag[dates[dates.length - 1]] : null;
      }
      function extLog(msg) {
        try {
          chrome.runtime.sendMessage({ type: APPEND_LOG_TYPE, msg: PREFIX + " " + msg });
        } catch (e) {
        }
      }
      var MSG_FILL_SNAPSHOT = "SR_FILL_SNAPSHOT";
      var MSG_FILL_DONE = "SR_FILL_SNAPSHOT_DONE";
      function runFillAfterBagLoaded(bag, sendResponse) {
        var snap = null;
        if (DEFS && typeof DEFS.pickSnapshotFromDailyBag === "function") {
          snap = DEFS.pickSnapshotFromDailyBag(bag);
        }
        if (!snap) {
          snap = pickSnapshotFromBagInline(bag);
        }
        if (!snap) {
          extLog("上报页：无本地合并快照，请先在各采集页写入数据");
          sendResponse({ ok: false, error: "no_snapshot" });
          return;
        }
        var validate = DEFS && typeof DEFS.validateReportSnapshotForFill === "function" ? DEFS.validateReportSnapshotForFill : null;
        if (validate) {
          var vr = validate(snap);
          if (!vr.ok) {
            var miss = vr.missing || [];
            miss.forEach(function(m) {
              extLog("上报页：「" + m.label + "」数据未读取到，已拦截填充");
            });
            extLog("上报页：本地数据不完整（共 " + miss.length + " 项缺失），已取消填充");
            sendResponse({ ok: false, error: "incomplete_data", missingCount: miss.length });
            return;
          }
        }
        extLog("上报页：开始填充（统计日 " + (snap.report_at || "") + "）…");
        var done = false;
        var t = setTimeout(function() {
          if (done) return;
          done = true;
          window.removeEventListener("message", onMainDone);
          extLog("上报页：页面主世界填充超时（请刷新 OA 页后重试）");
          sendResponse({ ok: false, error: "main_world_timeout" });
        }, 15e3);
        function onMainDone(ev) {
          if (ev.source !== window || !ev.data || ev.data.type !== MSG_FILL_DONE) return;
          if (done) return;
          done = true;
          clearTimeout(t);
          window.removeEventListener("message", onMainDone);
          if (ev.data.ok) {
            extLog(
              "上报页：填充完成，共写入 " + ev.data.filled + " 个字段（统计日 " + (ev.data.reportAt || snap.report_at || "") + "）"
            );
            sendResponse({
              ok: true,
              filled: ev.data.filled,
              reportAt: ev.data.reportAt || snap.report_at || ""
            });
          } else {
            extLog("上报页：主世界填充失败 " + String(ev.data.error || ""));
            sendResponse({ ok: false, error: String(ev.data.error || "fill_failed") });
          }
        }
        window.addEventListener("message", onMainDone);
        window.postMessage({ type: MSG_FILL_SNAPSHOT, snap }, "*");
      }
      function runFill(sendResponse) {
        var key = getDailyStorageKey();
        chrome.storage.local.get([key], function(result) {
          if (chrome.runtime && chrome.runtime.lastError) {
            extLog("上报页：读取本地存储失败 " + String(chrome.runtime.lastError.message));
            sendResponse({ ok: false, error: String(chrome.runtime.lastError.message) });
            return;
          }
          var bag = result[key];
          if (bag !== void 0 && bag !== null) {
            runFillAfterBagLoaded(bag, sendResponse);
            return;
          }
          chrome.storage.local.get(null, function(all) {
            if (chrome.runtime && chrome.runtime.lastError) {
              extLog("上报页：读取本地存储失败 " + String(chrome.runtime.lastError.message));
              sendResponse({ ok: false, error: String(chrome.runtime.lastError.message) });
              return;
            }
            var bag2 = all && all[key] || all && all[FALLBACK_DAILY_BAG_KEY] || null;
            runFillAfterBagLoaded(bag2, sendResponse);
          });
        });
      }
      chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (!request || request.type !== FILL_MSG) return false;
        runFill(sendResponse);
        return true;
      });
    })();
  }
  initContentReportSubmit();
})();
//# sourceMappingURL=content-report-submit.js.map
