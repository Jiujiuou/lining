/* global chrome */
/**
 * 隔离世界：接收 MAIN 世界 postMessage，将 query.json 结果写入扩展日志（每次调用一条）。
 */
(function () {
  var PREFIX = "[店铺记录数据]";
  var MSG = "shop-record-onebp-query";

  window.addEventListener("message", function (ev) {
    if (ev.source !== window) return;
    var d = ev.data;
    if (!d || d.source !== MSG) return;
    var seq = d.seq != null ? " #" + d.seq : "";
    var tabLabel = d.label || (d.bizCode === "onebpDisplay" ? "万象台2" : "万象台1");
    var text =
      typeof d.payload === "string"
        ? d.payload
        : JSON.stringify(d.payload, null, 2);
    var line = PREFIX + " " + tabLabel + " query.json" + seq + "\n" + text;
    if (line.length > 12000) {
      line = line.slice(0, 12000) + "\n…（已截断，完整见控制台）";
    }
    try {
      chrome.runtime.sendMessage({ type: "shopRecordAppendLog", msg: line });
    } catch (e) {
      /* ignore */
    }
  });
})();
