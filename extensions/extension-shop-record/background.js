/**
 * 统一写入日志（与 utils/logger.js 相同 storage 结构），供内容脚本通过 sendMessage 写入。
 */
(function () {
  var LOG_KEY = "shop_record_logs";
  var MAX = 100;
  /** 串行写入，避免多条日志几乎同时 append 时 get→set 竞态导致中间条目丢失 */
  var logQueue = [];
  var logWriting = false;

  function appendLog(level, msg) {
    logQueue.push({ level: level || "log", msg: String(msg) });
    flushLogQueue();
  }

  function flushLogQueue() {
    if (logWriting || logQueue.length === 0) return;
    logWriting = true;
    var item = logQueue.shift();
    var entry = { t: new Date().toISOString(), level: item.level, msg: item.msg };
    chrome.storage.local.get([LOG_KEY], function (result) {
      if (chrome.runtime.lastError) {
        logWriting = false;
        flushLogQueue();
        return;
      }
      var data = result[LOG_KEY];
      if (!data || !Array.isArray(data.entries)) data = { entries: [] };
      data.entries.push(entry);
      if (data.entries.length > MAX) data.entries = data.entries.slice(-MAX);
      chrome.storage.local.set({ [LOG_KEY]: data }, function () {
        logWriting = false;
        flushLogQueue();
        if (chrome.runtime.lastError) {
          /* ignore */
        }
      });
    });
  }

  chrome.runtime.onMessage.addListener(function (request, _sender, sendResponse) {
    if (!request || request.type !== "shopRecordAppendLog") return;
    appendLog(request.level || "log", request.msg);
    sendResponse({ ok: true });
    return true;
  });

  /** 标签页加载完成时记一条，便于确认扩展已跟到对应站点 */
  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status !== "complete" || !tab || !tab.url) return;
    var u;
    try {
      u = new URL(tab.url);
    } catch (e) {
      return;
    }
    if (u.hostname === "rate.taobao.com" && (u.pathname || "").indexOf("/user-rate-") === 0) {
      appendLog(
        "log",
        "[店铺记录数据] 已打开评价页 " + u.pathname + (u.search ? u.search : "")
      );
    }
  });
})();
