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
  const mod$3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SHOP_DEFAULTS__ = mod$3;
  globalThis.__AMCR_DEFAULTS__ = mod$3;
  (function(global) {
    var SUPABASE_URL = "https://ijfzeummbriivdmnhpsi.supabase.co";
    var SUPABASE_ANON_KEY = "sb_publishable_JLdtAikiQsgtXeKPJ_Gfrg_bkeBNHh_";
    (typeof globalThis !== "undefined" ? globalThis : global).__SHOP_RECORD_SUPABASE__ = {
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY
    };
  })(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
  const mod$2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SHOP_SUPABASE__ = mod$2;
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
  function initContentAlimama() {
    if (globalThis.__LINING_SHOP_RECORD_CONTENT_ALIMAMA__) return;
    globalThis.__LINING_SHOP_RECORD_CONTENT_ALIMAMA__ = true;
    (function() {
      if (window !== window.top) return;
      if (location.hostname !== "ad.alimama.com") return;
      var path = location.pathname || "";
      if (path.indexOf("/portal/v2/dashboard") === -1 && path.indexOf("dashboard") === -1) return;
      if (window.__shopRecordAlimamaFetchOnce__) return;
      window.__shopRecordAlimamaFetchOnce__ = true;
      var PREFIX = "[店铺记录数据]";
      var APPEND_LOG_TYPE = typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" && __SHOP_RECORD_DEFAULTS__.RUNTIME && __SHOP_RECORD_DEFAULTS__.RUNTIME.CONTENT_APPEND_LOG_MESSAGE ? __SHOP_RECORD_DEFAULTS__.RUNTIME.CONTENT_APPEND_LOG_MESSAGE : "shopRecordAppendLog";
      var OVERVIEW = "https://ad.alimama.com/openapi/param2/1/gateway.unionadv/data.home.overview.json";
      var localDaily = typeof __SHOP_RECORD_LOCAL_DAILY__ !== "undefined" ? __SHOP_RECORD_LOCAL_DAILY__ : null;
      function extLog(msg) {
        try {
          chrome.runtime.sendMessage({ type: APPEND_LOG_TYPE, msg: PREFIX + " " + msg });
        } catch {
        }
      }
      function getCookie(name) {
        var m = document.cookie.match(
          new RegExp("(?:^|;\\s*)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
        );
        return m ? decodeURIComponent(m[1]) : "";
      }
      function localYmd() {
        var d = /* @__PURE__ */ new Date();
        d.setDate(d.getDate() - 1);
        var y = d.getFullYear();
        var mo = String(d.getMonth() + 1);
        var da = String(d.getDate());
        return y + "-" + (mo.length < 2 ? "0" + mo : mo) + "-" + (da.length < 2 ? "0" + da : da);
      }
      function doFetch() {
        var token = getCookie("_tb_token_");
        var ymd = localYmd();
        var qs = new URLSearchParams({
          t: String(Date.now()),
          startDate: ymd,
          endDate: ymd,
          type: "cps",
          split: "0",
          period: "1d"
        });
        if (token) qs.set("_tb_token_", token);
        var url = OVERVIEW + "?" + qs.toString();
        var reqHeaders = {
          accept: "*/*",
          "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
          "bx-v": "2.5.11",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          referer: "https://ad.alimama.com/portal/v2/dashboard.htm",
          "x-requested-with": "XMLHttpRequest"
        };
        fetch(url, {
          method: "GET",
          credentials: "include",
          headers: reqHeaders
        }).then(function(res) {
          return res.text().then(function(text) {
            var parsed = null;
            try {
              parsed = JSON.parse(text);
            } catch {
              extLog("淘宝联盟：响应非 JSON HTTP " + res.status);
              return;
            }
            var data = parsed;
            if (data && (data.code === 601 || data.info && data.info.message === "nologin")) {
              extLog("淘宝联盟：未登录或会话失效（nologin）");
              return;
            }
            var row = data && data.data && data.data.result && data.data.result[0];
            var raw = row && row.pay_ord_cfee_8;
            if (raw == null) {
              extLog("淘宝联盟：响应无 pay_ord_cfee_8");
              return;
            }
            var n = Number(raw);
            var out = isNaN(n) ? String(raw) : n.toFixed(2);
            extLog("淘宝联盟：pay_ord_cfee_8 = " + out + "（元）");
            console.log("pay_ord_cfee_8", out);
            var rowCps = {
              report_at: ymd,
              taobao_cps_spend_yuan: out
            };
            if (localDaily && typeof localDaily.mergeDailyRowPatch === "function") {
              localDaily.mergeDailyRowPatch(rowCps);
            }
            extLog("淘宝联盟：已写入本地 淘宝客花费（元） " + ymd + " = " + out);
          });
        }).catch(function(err) {
          extLog("淘宝联盟：请求失败 " + (err && err.message ? err.message : String(err)));
          console.error("data.home.overview.json", err);
        });
      }
      extLog("淘宝联盟：脚本已注入 " + path);
      var attempts = 0;
      var maxAttempts = 35;
      function waitTokenThenFetch() {
        var token = getCookie("_tb_token_");
        attempts += 1;
        if (token || attempts >= maxAttempts) {
          doFetch();
          return;
        }
        setTimeout(waitTokenThenFetch, 400);
      }
      waitTokenThenFetch();
    })();
  }
  initContentAlimama();
})();
//# sourceMappingURL=content-alimama.js.map
