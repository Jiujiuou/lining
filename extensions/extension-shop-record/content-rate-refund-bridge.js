/* global chrome */
/**
 * 隔离世界：接收 MAIN 世界 postMessage（refundIndex JSONP 解析结果），写入扩展日志。
 */
(function () {
  var PREFIX = "[店铺记录数据]";
  var APPEND_LOG_TYPE =
    typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" &&
    __SHOP_RECORD_DEFAULTS__.RUNTIME &&
    __SHOP_RECORD_DEFAULTS__.RUNTIME.CONTENT_APPEND_LOG_MESSAGE
      ? __SHOP_RECORD_DEFAULTS__.RUNTIME.CONTENT_APPEND_LOG_MESSAGE
      : "shopRecordAppendLog";
  var MSG = "shop-record-refund-jsonp";

  window.addEventListener("message", function (ev) {
    if (ev.source !== window) return;
    var d = ev.data;
    if (!d || d.source !== MSG) return;
    var p = d.payload || {};
    var a = p.disputeRefundRate;
    var b = p.refundProFinishTime;
    var c = p.refundFinishRate;
    var line =
      PREFIX +
      " 店铺服务 纠纷退款率 " +
      String(a != null ? a : "—") +
      "；退货退款自主完结时长 " +
      String(b != null ? b : "—") +
      "；退款自主完结率 " +
      String(c != null ? c : "—");
    try {
      chrome.runtime.sendMessage({ type: APPEND_LOG_TYPE, msg: line });
    } catch (e) {
      /* ignore */
    }

    // 同步给同一隔离世界下的 content.js，便于与 DSR 三项汇总后上报 Supabase
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
      /* ignore */
    }
  });
})();
