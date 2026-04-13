(function() {
  "use strict";
  function hasRuntime() {
    return typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.sendMessage === "function";
  }
  function sendRuntimeMessage(message, callback) {
    const done = null;
    if (!hasRuntime()) {
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const lastError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError : null;
        if (done) ;
      });
    } catch (error) {
    }
  }
  const OU_RUNTIME = {
    GET_USER_DATA: "OU_GET_USER_DATA",
    STOP_USER_DATA: "OU_STOP_USER_DATA",
    USER_DATA_PROGRESS: "OU_USER_DATA_PROGRESS",
    USER_DATA_PAGE: "OU_USER_DATA_PAGE",
    USER_DATA_DONE: "OU_USER_DATA_DONE",
    START_USER_DATA: "START_OU_USER_DATA",
    STOP_USER_DATA_MAIN: "STOP_OU_USER_DATA"
  };
  function escapeCsvCell(value) {
    if (value == null) {
      return "";
    }
    const text = String(value);
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }
  function orderIdCellForExcelCsv(orderId) {
    const text = orderId == null ? "" : String(orderId);
    return `="${text.replace(/"/g, '""')}"`;
  }
  function createTimestamp() {
    const now = /* @__PURE__ */ new Date();
    const pad = (num) => num < 10 ? `0${num}` : String(num);
    return [
      now.getFullYear(),
      "-",
      pad(now.getMonth() + 1),
      "-",
      pad(now.getDate()),
      "_",
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds())
    ].join("");
  }
  function downloadCsv(rows) {
    const headers = ["订单ID", "昵称"];
    const lines = [headers.join(",")];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || {};
      lines.push(
        [orderIdCellForExcelCsv(row.orderId), escapeCsvCell(row.nick)].join(",")
      );
    }
    const csv = `\uFEFF${lines.join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sold_userdata_ou_${createTimestamp()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  const CONTENT_GUARD_KEY = "__LINING_OU_USERDATA_CS__";
  function injectMainScript() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("order-userdata-main.js");
    (document.documentElement || document.body).appendChild(script);
    script.onload = () => {
      script.remove();
    };
  }
  function relayPageMessage(event) {
    if (event.source !== window || !event.data) {
      return;
    }
    if (event.data.type === OU_RUNTIME.USER_DATA_DONE) {
      const rows = event.data.rows || [];
      const error = event.data.error || null;
      const stopped = Boolean(event.data.stopped);
      if (rows.length > 0 && !stopped) {
        downloadCsv(rows);
      }
      sendRuntimeMessage({
        type: OU_RUNTIME.USER_DATA_DONE,
        rows,
        error,
        stopped
      });
      return;
    }
    if (event.data.type === OU_RUNTIME.USER_DATA_PROGRESS) {
      sendRuntimeMessage({
        type: OU_RUNTIME.USER_DATA_PROGRESS,
        totalPage: event.data.totalPage,
        currentPage: event.data.currentPage,
        message: event.data.message
      });
      return;
    }
    if (event.data.type === OU_RUNTIME.USER_DATA_PAGE) {
      sendRuntimeMessage({
        type: OU_RUNTIME.USER_DATA_PAGE,
        pageNum: event.data.pageNum,
        rows: event.data.rows || []
      });
    }
  }
  function handleRuntimeMessage(message, _sender, sendResponse) {
    if (!message || message.type !== OU_RUNTIME.GET_USER_DATA) {
      if (!message || message.type !== OU_RUNTIME.STOP_USER_DATA) {
        return false;
      }
      window.postMessage({ type: OU_RUNTIME.STOP_USER_DATA_MAIN }, "*");
      sendResponse({ ok: true });
      return true;
    }
    injectMainScript();
    setTimeout(() => {
      window.postMessage(
        {
          type: OU_RUNTIME.START_USER_DATA,
          unionSearch: message.unionSearch != null ? String(message.unionSearch) : "",
          buyerNick: message.buyerNick != null ? String(message.buyerNick) : "",
          orderStatus: message.orderStatus != null ? String(message.orderStatus) : "SUCCESS",
          payDateBegin: message.payDateBegin != null ? String(message.payDateBegin) : "",
          payDateEnd: message.payDateEnd != null ? String(message.payDateEnd) : ""
        },
        "*"
      );
    }, 100);
    sendResponse({ ok: true });
    return true;
  }
  function initContentScript() {
    try {
      if (globalThis[CONTENT_GUARD_KEY]) {
        return;
      }
      globalThis[CONTENT_GUARD_KEY] = true;
    } catch {
      return;
    }
    window.addEventListener("message", relayPageMessage);
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    injectMainScript();
  }
  initContentScript();
})();
//# sourceMappingURL=order-userdata-cs.js.map
