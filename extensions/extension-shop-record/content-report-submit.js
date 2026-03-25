/* global chrome */
/**
 * 联核 OA 上报页：仅响应「自动填充」消息，从 chrome.storage.local 读合并快照并写入表单
 */
(function () {
  var PREFIX = "[店铺记录数据]";
  var DEFS = typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" ? __SHOP_RECORD_DEFAULTS__ : null;
  var APPEND_LOG_TYPE =
    DEFS && DEFS.RUNTIME && DEFS.RUNTIME.CONTENT_APPEND_LOG_MESSAGE
      ? DEFS.RUNTIME.CONTENT_APPEND_LOG_MESSAGE
      : "shopRecordAppendLog";
  var FILL_MSG =
    DEFS && DEFS.RUNTIME && DEFS.RUNTIME.CONTENT_FILL_REPORT_MESSAGE
      ? DEFS.RUNTIME.CONTENT_FILL_REPORT_MESSAGE
      : "SR_FILL_REPORT";

  function extLog(msg) {
    try {
      chrome.runtime.sendMessage({ type: APPEND_LOG_TYPE, msg: PREFIX + " " + msg });
    } catch (e) {
      /* ignore */
    }
  }

  function runFill(sendResponse) {
    var F =
      typeof __SHOP_RECORD_REPORT_PAGE_FILL__ !== "undefined"
        ? __SHOP_RECORD_REPORT_PAGE_FILL__
        : null;
    if (!F || typeof F.fillReportPageFromSnapshot !== "function") {
      extLog("上报页：填充失败，report-page-fill 未加载");
      sendResponse({ ok: false, error: "report-page-fill 未加载" });
      return;
    }
    var key = typeof F.getStorageKey === "function" ? F.getStorageKey() : "shop_record_daily_local_by_date";
    chrome.storage.local.get([key], function (result) {
      if (chrome.runtime && chrome.runtime.lastError) {
        extLog("上报页：读取本地存储失败 " + String(chrome.runtime.lastError.message));
        sendResponse({ ok: false, error: String(chrome.runtime.lastError.message) });
        return;
      }
      var bag = result[key];
      var snap = F.pickSnapshotFromBag(bag);
      if (!snap) {
        extLog("上报页：无本地合并快照，请先在各采集页写入数据");
        sendResponse({ ok: false, error: "no_snapshot" });
        return;
      }
      extLog(
        "上报页：开始填充（统计日 " + (snap.report_at || "") + "）…"
      );
      var ret = F.fillReportPageFromSnapshot(snap);
      extLog(
        "上报页：填充完成，共写入 " +
          ret.filled +
          " 个字段（统计日 " +
          (snap.report_at || "") +
          "）"
      );
      sendResponse({
        ok: true,
        filled: ret.filled,
        reportAt: snap.report_at || ""
      });
    });
  }

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (!request || request.type !== FILL_MSG) return false;
    runFill(sendResponse);
    return true;
  });
})();
