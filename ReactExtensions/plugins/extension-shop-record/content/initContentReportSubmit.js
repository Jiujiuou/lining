export function initContentReportSubmit() {
  if (globalThis.__LINING_SHOP_RECORD_REPORT_SUBMIT__) return;
  globalThis.__LINING_SHOP_RECORD_REPORT_SUBMIT__ = true;
/* global chrome, __SHOP_RECORD_DEFAULTS__ */
/**
 * 联核 OA 上报页：仅响应「自动填充」消息，从 chrome.storage.local 读合并快照并写入表单。
 * 快照挑选与完整性校验见 constants/defaults.js（pickSnapshotFromDailyBag / validateReportSnapshotForFill）。
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

  var FALLBACK_DAILY_BAG_KEY = "shop_record_daily_local_by_date";

  function getDailyStorageKey() {
    if (DEFS && DEFS.STORAGE_KEYS && DEFS.STORAGE_KEYS.dailyLocalByDate) {
      return DEFS.STORAGE_KEYS.dailyLocalByDate;
    }
    return FALLBACK_DAILY_BAG_KEY;
  }

  /** 与 constants/defaults.js 中 pickSnapshotFromDailyBag 一致；避免依赖 DEFS 上方法是否存在 */
  function pickSnapshotFromBagInline(bag) {
    if (!bag || typeof bag !== "object") return null;
    var d = new Date();
    d.setDate(d.getDate() - 1);
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1);
    var da = String(d.getDate());
    var ymd = y + "-" + (mo.length < 2 ? "0" + mo : mo) + "-" + (da.length < 2 ? "0" + da : da);
    if (bag[ymd]) return bag[ymd];
    var dates = Object.keys(bag).filter(function (k) {
      return /^\d{4}-\d{2}-\d{2}$/.test(k);
    });
    dates.sort();
    return dates.length ? bag[dates[dates.length - 1]] : null;
  }

  function extLog(msg) {
    try {
      chrome.runtime.sendMessage({ type: APPEND_LOG_TYPE, msg: PREFIX + " " + msg });
    } catch (e) {
      /* ignore */
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
    var validate =
      DEFS && typeof DEFS.validateReportSnapshotForFill === "function"
        ? DEFS.validateReportSnapshotForFill
        : null;
    if (validate) {
      var vr = validate(snap);
      if (!vr.ok) {
        var miss = vr.missing || [];
        miss.forEach(function (m) {
          extLog("上报页：「" + m.label + "」数据未读取到，已拦截填充");
        });
        extLog("上报页：本地数据不完整（共 " + miss.length + " 项缺失），已取消填充");
        sendResponse({ ok: false, error: "incomplete_data", missingCount: miss.length });
        return;
      }
    }
    extLog("上报页：开始填充（统计日 " + (snap.report_at || "") + "）…");

    var done = false;
    var t = setTimeout(function () {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMainDone);
      extLog("上报页：页面主世界填充超时（请刷新 OA 页后重试）");
      sendResponse({ ok: false, error: "main_world_timeout" });
    }, 15000);

    function onMainDone(ev) {
      if (ev.source !== window || !ev.data || ev.data.type !== MSG_FILL_DONE) return;
      if (done) return;
      done = true;
      clearTimeout(t);
      window.removeEventListener("message", onMainDone);
      if (ev.data.ok) {
        extLog(
          "上报页：填充完成，共写入 " +
            ev.data.filled +
            " 个字段（统计日 " +
            (ev.data.reportAt || snap.report_at || "") +
            "）"
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
    window.postMessage({ type: MSG_FILL_SNAPSHOT, snap: snap }, "*");
  }

  function runFill(sendResponse) {
    var key = getDailyStorageKey();
    chrome.storage.local.get([key], function (result) {
      if (chrome.runtime && chrome.runtime.lastError) {
        extLog("上报页：读取本地存储失败 " + String(chrome.runtime.lastError.message));
        sendResponse({ ok: false, error: String(chrome.runtime.lastError.message) });
        return;
      }
      var bag = result[key];
      if (bag !== undefined && bag !== null) {
        runFillAfterBagLoaded(bag, sendResponse);
        return;
      }
      chrome.storage.local.get(null, function (all) {
        if (chrome.runtime && chrome.runtime.lastError) {
          extLog("上报页：读取本地存储失败 " + String(chrome.runtime.lastError.message));
          sendResponse({ ok: false, error: String(chrome.runtime.lastError.message) });
          return;
        }
        var bag2 =
          (all && all[key]) ||
          (all && all[FALLBACK_DAILY_BAG_KEY]) ||
          null;
        runFillAfterBagLoaded(bag2, sendResponse);
      });
    });
  }

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (!request || request.type !== FILL_MSG) return false;
    runFill(sendResponse);
    return true;
  });
})();

}

