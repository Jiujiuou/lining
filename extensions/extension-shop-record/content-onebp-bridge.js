/* global chrome */
/**
 * 隔离世界：接收 MAIN 世界 postMessage，将 query.json 结果写入扩展日志（每次调用一条）。
 */
(function () {
  var PREFIX = "[店铺记录数据]";
  var APPEND_LOG_TYPE =
    typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" &&
    __SHOP_RECORD_DEFAULTS__.RUNTIME &&
    __SHOP_RECORD_DEFAULTS__.RUNTIME.CONTENT_APPEND_LOG_MESSAGE
      ? __SHOP_RECORD_DEFAULTS__.RUNTIME.CONTENT_APPEND_LOG_MESSAGE
      : "shopRecordAppendLog";
  var MSG = "shop-record-onebp-query";
  var localDaily =
    typeof __SHOP_RECORD_LOCAL_DAILY__ !== "undefined" ? __SHOP_RECORD_LOCAL_DAILY__ : null;

  /** 本机日历「昨天」YYYY-MM-DD */
  function yesterdayYmd() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1);
    var da = String(d.getDate());
    return y + "-" + (mo.length < 2 ? "0" + mo : mo) + "-" + (da.length < 2 ? "0" + da : da);
  }

  /**
   * 万象1 onebpSearch：data.list[0] 的 charge/cvr/ecpc/roi → shop_record_daily
   */
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
      var d = decimals != null ? decimals : 2;
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

  /**
   * 万象2 onebpDisplay：data.list[0] 同结构 → 引力魔方四项
   */
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
      var dec = decimals != null ? decimals : 2;
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

  /**
   * 万象3 onebpSite：data.list[0] 的 charge、roi → 全站推广花费 / 全站推广ROI
   */
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
      var dec = decimals != null ? decimals : 2;
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

  /**
   * 万象4 onebpShortVideo：data.list[0] 的 charge、roi → 内容推广花费 / 内容推广ROI
   */
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
      var dec = decimals != null ? decimals : 2;
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

  window.addEventListener("message", function (ev) {
    if (ev.source !== window) return;
    var d = ev.data;
    if (!d || d.source !== MSG) return;
    var seq = d.seq != null ? " #" + d.seq : "";
    var tabLabel =
      d.label ||
      (d.bizCode === "onebpDisplay"
        ? "万象台2"
        : d.bizCode === "onebpSite"
          ? "万象3"
          : d.bizCode === "onebpShortVideo"
            ? "万象4"
            : "万象台1");
    var text =
      typeof d.payload === "string"
        ? d.payload
        : JSON.stringify(d.payload, null, 2);
    var line = PREFIX + " " + tabLabel + " query.json" + seq + "\n" + text;
    if (line.length > 12000) {
      line = line.slice(0, 12000) + "\n…（已截断，完整见控制台）";
    }
    try {
      chrome.runtime.sendMessage({ type: APPEND_LOG_TYPE, msg: line });
    } catch (e) {
      /* ignore */
    }

    maybeMergeOnebpSearch(d.bizCode, d.payload);
    maybeMergeOnebpDisplay(d.bizCode, d.payload);
    maybeMergeOnebpSite(d.bizCode, d.payload);
    maybeMergeOnebpShortVideo(d.bizCode, d.payload);
  });
})();
