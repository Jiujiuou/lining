export function initContentReportSubmitMain() {
  if (globalThis.__LINING_SHOP_RECORD_REPORT_SUBMIT_MAIN__) return;
  globalThis.__LINING_SHOP_RECORD_REPORT_SUBMIT_MAIN__ = true;
/**
 * 页面主世界（MAIN）：与 OA 页内脚本同一 JS 环境，负责执行填充并回传结果。
 * 隔离世界通过 window.postMessage 投递快照。
 */
(function () {
  var FILL = "SR_FILL_SNAPSHOT";
  var DONE = "SR_FILL_SNAPSHOT_DONE";

  window.addEventListener("message", function (ev) {
    if (ev.source !== window || !ev.data || ev.data.type !== FILL) return;
    var F =
      typeof __SHOP_RECORD_REPORT_PAGE_FILL__ !== "undefined"
        ? __SHOP_RECORD_REPORT_PAGE_FILL__
        : null;
    if (!F || typeof F.fillReportPageFromSnapshot !== "function") {
      window.postMessage(
        { type: DONE, ok: false, error: "report-page-fill 未注入", filled: 0 },
        "*"
      );
      return;
    }
    var snap = ev.data.snap;
    var ret = F.fillReportPageFromSnapshot(snap);
    window.postMessage(
      {
        type: DONE,
        ok: !!ret.ok,
        filled: ret.filled,
        reportAt: snap && snap.report_at ? String(snap.report_at) : ""
      },
      "*"
    );
  });
})();

}

