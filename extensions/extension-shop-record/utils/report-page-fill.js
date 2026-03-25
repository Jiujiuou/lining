/**
 * 联核 OA 上报页：将本地合并快照字段写入表单 input#fieldXXXX
 * 与 popup 指标字段名一致；不包含「总推广花费」「推广占比」
 */
(function (global) {
  /** [storageKey, fieldIdSuffix] */
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

  /** 扩展未采集时表单仍显示 0 的单元（与 popup 占位一致） */
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

  function setFieldValue(fieldIdSuffix, str) {
    var id = "field" + fieldIdSuffix;
    var el = document.getElementById(id);
    if (!el) return false;
    var v = str == null ? "" : String(str);
    el.value = v;
    try {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) {
      /* ignore */
    }
    var sp = document.getElementById(id + "span");
    if (sp && el.type === "hidden") {
      sp.textContent = v;
    }
    return true;
  }

  /**
   * @param {Object} snap 单日合并对象（与 chrome.storage 中结构一致）
   */
  function fillReportPageFromSnapshot(snap) {
    if (!snap || typeof snap !== "object") return { ok: false, filled: 0 };
    var n = 0;
    allPairs().forEach(function (pair) {
      var key = pair[0];
      var fid = pair[1];
      var raw = snap[key];
      var has =
        raw !== undefined &&
        raw !== null &&
        String(raw).replace(/\s/g, "") !== "";
      if (!has) return;
      if (setFieldValue(fid, raw)) n += 1;
    });
    DEFAULT_ZERO_FIELD_IDS.forEach(function (fid) {
      if (setFieldValue(fid, "0")) n += 1;
    });
    return { ok: true, filled: n };
  }

  function yesterdayYmd() {
    var d = new Date();
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
    var dates = Object.keys(bag).filter(function (k) {
      return /^\d{4}-\d{2}-\d{2}$/.test(k);
    });
    dates.sort();
    return dates.length ? bag[dates[dates.length - 1]] : null;
  }

  var api = {
    fillReportPageFromSnapshot: fillReportPageFromSnapshot,
    pickSnapshotFromBag: pickSnapshotFromBag,
    yesterdayYmd: yesterdayYmd,
    getStorageKey: function () {
      var d =
        typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" ? __SHOP_RECORD_DEFAULTS__ : null;
      if (d && d.STORAGE_KEYS && d.STORAGE_KEYS.dailyLocalByDate) {
        return d.STORAGE_KEYS.dailyLocalByDate;
      }
      return "shop_record_daily_local_by_date";
    }
  };

  (typeof globalThis !== "undefined" ? globalThis : global).__SHOP_RECORD_REPORT_PAGE_FILL__ =
    api;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
