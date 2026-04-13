(function() {
  "use strict";
  (function(global) {
    var STORAGE_KEYS = {
      logs: "shop_record_logs",
      logsByTab: "shop_record_logs_by_tab",
      /** 按日合并的 shop_record_daily 本地快照 { [yyyy-mm-dd]: { ...columns } } */
      dailyLocalByDate: "shop_record_daily_local_by_date"
    };
    var LOG_MAX_ENTRIES = 20;
    var LOG_MAX_TABS = 6;
    var PREFIX = "[店铺记录数据]";
    var SHOP_RATE_PAGE_URL = "https://rate.taobao.com/user-rate-UvCIYvCxbMCcGvmHuvQTT.htm?spm=a1z10.1-b.d4918101.1.7b716fe7xfRnm3";
    var ALIMAMA_DASHBOARD_URL = "https://ad.alimama.com/portal/v2/dashboard.htm";
    var SYCM_MY_SPACE_URL = "https://sycm.taobao.com/adm/v3/my_space?_old_module_code_=adm-eportal-order-experience-transit&_old_module_expiration_=1773970265356&activeKey=common&tab=fetch";
    var REPORT_SUBMIT_PAGE_URL = "https://oa1.ilanhe.com:8088/spa/workflow/static4form/index.html?_rdm=1774403128141#/main/workflow/req?iscreate=1&workflowid=1663&isagent=0&beagenter=0&f_weaver_belongto_userid=&f_weaver_belongto_usertype=0&menuIds=1,12&menuPathIds=1,12&preloadkey=1774403128141&timestamp=1774403128141&_key=ldyx2e";
    var ONE_ALIMAMA_HOST = "https://one.alimama.com";
    var RUNTIME = {
      GET_TAB_ID_MESSAGE: "SR_GET_TAB_ID",
      CONTENT_APPEND_LOG_MESSAGE: "shopRecordAppendLog",
      /** popup → background：请求向联核 OA 上报页填充本地快照 */
      FILL_REPORT_PAGE_MESSAGE: "SR_FILL_REPORT_PAGE",
      /** background → content-report-submit：执行填充 */
      CONTENT_FILL_REPORT_MESSAGE: "SR_FILL_REPORT"
    };
    var REPORT_FILL_REQUIRED = [
      { key: "item_desc_match_score", label: "宝贝与描述相符" },
      { key: "sycm_pv", label: "浏览量PV" },
      { key: "seller_service_score", label: "卖家服务态度" },
      { key: "sycm_uv", label: "访客数UV" },
      { key: "seller_shipping_score", label: "卖家发货速度" },
      { key: "sycm_pay_buyers", label: "支付买家数" },
      { key: "refund_finish_duration", label: "退款完结时长" },
      { key: "sycm_pay_items", label: "支付商品件数" },
      { key: "refund_finish_rate", label: "退款自主完结率" },
      { key: "sycm_pay_amount", label: "支付金额（元）" },
      { key: "dispute_refund_rate", label: "退款纠纷率" },
      { key: "sycm_aov", label: "客单价（元）" },
      { key: "taobao_cps_spend_yuan", label: "淘宝客花费（元）" },
      { key: "sycm_pay_cvr", label: "支付转化率" },
      { key: "ztc_charge_yuan", label: "直通车花费（元）" },
      { key: "sycm_old_visitor_ratio", label: "老访客数占比" },
      { key: "ztc_cvr", label: "直通车转化率" },
      { key: "sycm_avg_stay_sec", label: "人均停留时长（秒）" },
      { key: "ztc_ppc", label: "直通车PPC" },
      { key: "sycm_avg_pv_depth", label: "人均浏览量（访问深度）" },
      { key: "ztc_roi", label: "直通车ROI" },
      { key: "sycm_bounce_rate", label: "跳失率" },
      { key: "ylmf_charge_yuan", label: "引力魔方花费（元）" },
      { key: "ylmf_cvr", label: "引力魔方转化率" },
      { key: "ylmf_ppc", label: "引力魔方PPC" },
      { key: "ylmf_roi", label: "引力魔方ROI" },
      { key: "site_wide_charge_yuan", label: "全站推广花费（元）" },
      { key: "site_wide_roi", label: "全站推广ROI" },
      { key: "content_promo_charge_yuan", label: "内容推广花费（元）" },
      { key: "content_promo_roi", label: "内容推广ROI" }
    ];
    function yesterdayYmdForSnapshot() {
      var d = /* @__PURE__ */ new Date();
      d.setDate(d.getDate() - 1);
      var y = d.getFullYear();
      var mo = String(d.getMonth() + 1);
      var da = String(d.getDate());
      return y + "-" + (mo.length < 2 ? "0" + mo : mo) + "-" + (da.length < 2 ? "0" + da : da);
    }
    function pickSnapshotFromDailyBag(bag) {
      if (!bag || typeof bag !== "object") return null;
      var ymd = yesterdayYmdForSnapshot();
      if (bag[ymd]) return bag[ymd];
      var dates = Object.keys(bag).filter(function(k) {
        return /^\d{4}-\d{2}-\d{2}$/.test(k);
      });
      dates.sort();
      return dates.length ? bag[dates[dates.length - 1]] : null;
    }
    function validateReportSnapshotForFill(snap) {
      var missing = [];
      if (!snap || typeof snap !== "object") {
        for (var j = 0; j < REPORT_FILL_REQUIRED.length; j++) {
          missing.push({
            key: REPORT_FILL_REQUIRED[j].key,
            label: REPORT_FILL_REQUIRED[j].label
          });
        }
        return { ok: false, missing };
      }
      for (var i = 0; i < REPORT_FILL_REQUIRED.length; i++) {
        var row = REPORT_FILL_REQUIRED[i];
        var raw = snap[row.key];
        var has = raw !== void 0 && raw !== null && String(raw).replace(/\s/g, "") !== "";
        if (!has) {
          missing.push({ key: row.key, label: row.label });
        }
      }
      if (missing.length === 0) return { ok: true };
      return { ok: false, missing };
    }
    var obj = {
      STORAGE_KEYS,
      LOG_MAX_ENTRIES,
      LOG_MAX_TABS,
      PREFIX,
      RUNTIME,
      SHOP_RATE_PAGE_URL,
      ALIMAMA_DASHBOARD_URL,
      ONE_ALIMAMA_HOST,
      SYCM_MY_SPACE_URL,
      REPORT_SUBMIT_PAGE_URL,
      REPORT_FILL_REQUIRED,
      pickSnapshotFromDailyBag,
      validateReportSnapshotForFill
    };
    (typeof globalThis !== "undefined" ? globalThis : global).__SHOP_RECORD_DEFAULTS__ = obj;
  })(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
  const mod$4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SHOP_DEFAULTS__ = mod$4;
  globalThis.__AMCR_DEFAULTS__ = mod$4;
  (function(global) {
    var SUPABASE_URL = "https://ijfzeummbriivdmnhpsi.supabase.co";
    var SUPABASE_ANON_KEY = "sb_publishable_JLdtAikiQsgtXeKPJ_Gfrg_bkeBNHh_";
    (typeof globalThis !== "undefined" ? globalThis : global).__SHOP_RECORD_SUPABASE__ = {
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY
    };
  })(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
  const mod$3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SHOP_SUPABASE__ = mod$3;
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
  const mod$2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SHOP_LOGGER__ = mod$2;
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
  const mod$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SHOP_LOCAL_DAILY_STORE__ = mod$1;
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
  function initContent() {
    if (globalThis.__LINING_SHOP_RECORD_CONTENT__) return;
    globalThis.__LINING_SHOP_RECORD_CONTENT__ = true;
    (function() {
      var PREFIX = typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" && __SHOP_RECORD_DEFAULTS__.PREFIX ? __SHOP_RECORD_DEFAULTS__.PREFIX : "";
      var APPEND_LOG_TYPE = typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" && __SHOP_RECORD_DEFAULTS__.RUNTIME && __SHOP_RECORD_DEFAULTS__.RUNTIME.CONTENT_APPEND_LOG_MESSAGE ? __SHOP_RECORD_DEFAULTS__.RUNTIME.CONTENT_APPEND_LOG_MESSAGE : "shopRecordAppendLog";
      var localDaily = typeof __SHOP_RECORD_LOCAL_DAILY__ !== "undefined" ? __SHOP_RECORD_LOCAL_DAILY__ : null;
      function sendLog(msg) {
        try {
          chrome.runtime.sendMessage({ type: APPEND_LOG_TYPE, msg: String(msg) });
        } catch (e) {
        }
      }
      function isUserRatePage() {
        if (location.hostname !== "rate.taobao.com") return false;
        return (location.pathname || "").indexOf("/user-rate-") === 0;
      }
      function normalizeLabel(text) {
        return String(text || "").replace(/\s/g, "").replace(/：/g, "").replace(/:/g, "");
      }
      function yesterdayYmd() {
        var d = /* @__PURE__ */ new Date();
        d.setDate(d.getDate() - 1);
        var y = d.getFullYear();
        var mo = String(d.getMonth() + 1);
        var da = String(d.getDate());
        return y + "-" + (mo.length < 2 ? "0" + mo : mo) + "-" + (da.length < 2 ? "0" + da : da);
      }
      var dsrData = null;
      var refundData = null;
      var savedLocal = false;
      var scoresLogged = false;
      function tryLogShopScores() {
        if (!isUserRatePage()) return;
        var root = document.getElementById("dsr") || document.querySelector("ul.dsr-info");
        if (!root) return;
        var want = {
          宝贝与描述相符: null,
          卖家的服务态度: null,
          物流服务的质量: null
        };
        var items = root.querySelectorAll("li.dsr-item");
        for (var i = 0; i < items.length; i++) {
          var li = items[i];
          var titleEl = li.querySelector(".item-scrib span.tb-title");
          var countEl = li.querySelector(".item-scrib em.count");
          if (!titleEl || !countEl) continue;
          var key = normalizeLabel(titleEl.textContent);
          if (key.indexOf("宝贝与描述相符") !== -1) {
            want["宝贝与描述相符"] = (countEl.textContent || "").trim();
          } else if (key.indexOf("卖家的服务态度") !== -1) {
            want["卖家的服务态度"] = (countEl.textContent || "").trim();
          } else if (key.indexOf("物流服务的质量") !== -1) {
            want["物流服务的质量"] = (countEl.textContent || "").trim();
          }
        }
        if (!want["宝贝与描述相符"] || !want["卖家的服务态度"] || !want["物流服务的质量"]) {
          return;
        }
        dsrData = {
          item_desc_match_score: want["宝贝与描述相符"],
          seller_service_score: want["卖家的服务态度"],
          seller_shipping_score: want["物流服务的质量"]
        };
        if (!scoresLogged) {
          var msg = PREFIX + " 店铺分（" + location.pathname + "）宝贝与描述相符 " + want["宝贝与描述相符"] + " 分；卖家服务态度 " + want["卖家的服务态度"] + " 分；物流服务质量 " + want["物流服务的质量"] + " 分";
          scoresLogged = true;
          sendLog(msg);
        }
        maybeSaveDailyRowLocal();
        return true;
      }
      function handleRefundDataFromBridge(data) {
        if (!data || typeof data !== "object") return;
        if (!data.disputeRefundRate || !data.refundProFinishTime || !data.refundFinishRate) return;
        refundData = {
          refund_finish_duration: String(data.refundProFinishTime),
          refund_finish_rate: String(data.refundFinishRate),
          dispute_refund_rate: String(data.disputeRefundRate)
        };
        maybeSaveDailyRowLocal();
      }
      function maybeSaveDailyRowLocal() {
        if (savedLocal) return;
        if (!dsrData || !refundData) return;
        var row = {
          report_at: yesterdayYmd(),
          item_desc_match_score: dsrData.item_desc_match_score,
          seller_service_score: dsrData.seller_service_score,
          seller_shipping_score: dsrData.seller_shipping_score,
          refund_finish_duration: refundData.refund_finish_duration,
          refund_finish_rate: refundData.refund_finish_rate,
          dispute_refund_rate: refundData.dispute_refund_rate
        };
        if (localDaily && typeof localDaily.mergeDailyRowPatch === "function") {
          localDaily.mergeDailyRowPatch(row);
        }
        savedLocal = true;
        sendLog(PREFIX + " 已写入本地 " + row.report_at + "（6 项店铺分）");
      }
      if (!isUserRatePage()) return;
      try {
        if (window.__SHOP_RECORD_RATE_REFUND_DATA__) {
          handleRefundDataFromBridge(window.__SHOP_RECORD_RATE_REFUND_DATA__);
        }
      } catch (e0) {
      }
      window.addEventListener("shop-record-refund-data", function(ev) {
        handleRefundDataFromBridge(ev && ev.detail ? ev.detail : null);
      });
      var extracted = false;
      function tick() {
        if (extracted) return;
        if (tryLogShopScores()) extracted = true;
      }
      tick();
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", tick);
      }
      var poll = setInterval(function() {
        tick();
        if (extracted) clearInterval(poll);
      }, 400);
      try {
        var obs = new MutationObserver(tick);
        obs.observe(document.documentElement, { childList: true, subtree: true });
      } catch (e) {
      }
    })();
  }
  initContent();
})();
//# sourceMappingURL=content.js.map
