(function() {
  "use strict";
  const OU_RUNTIME = {
    USER_DATA_PROGRESS: "OU_USER_DATA_PROGRESS",
    USER_DATA_PAGE: "OU_USER_DATA_PAGE",
    USER_DATA_DONE: "OU_USER_DATA_DONE",
    START_USER_DATA: "START_OU_USER_DATA",
    STOP_USER_DATA_MAIN: "STOP_OU_USER_DATA"
  };
  const MAIN_GUARD_KEY = "__LINING_OU_USERDATA_MAIN__";
  const API_URL = "https://trade.taobao.com/trade/itemlist/asyncSold.htm?event_submit_do_query=1&_input_charset=utf8";
  const REQUEST_INTERVAL_MS = 500;
  const ORDER_STATUS_TO_TAB = {
    SUCCESS: "success",
    NOT_PAID: "waitBuyerPay",
    PAID: "waitSend",
    SEND: "haveSendGoods",
    DROP: "closed",
    ALL: "latest3Months"
  };
  let capturedBody = null;
  let filterUnionSearch = "";
  let filterBuyerNick = "";
  let filterOrderStatus = "SUCCESS";
  let filterPayDateBegin = "";
  let filterPayDateEnd = "";
  let runToken = 0;
  let runStopped = false;
  let nextPageTimer = null;
  let activeAbortController = null;
  function captureAsyncSoldBody(url, body) {
    if (typeof url !== "string" || typeof body !== "string") {
      return;
    }
    if (!url.includes("asyncSold.htm")) {
      return;
    }
    capturedBody = body;
  }
  function patchFetchForBodyCapture() {
    const rawFetch = window.fetch;
    if (!rawFetch) {
      return;
    }
    window.fetch = function fetchWithCapture(url, options) {
      const targetUrl = typeof url === "string" ? url : url && url.url;
      if (options && options.method === "POST" && typeof options.body === "string") {
        captureAsyncSoldBody(targetUrl, options.body);
      }
      return rawFetch.apply(this, arguments);
    };
  }
  function toPayDateTimestamp(dateYmd) {
    if (!dateYmd || typeof dateYmd !== "string") return "0";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return "0";
    const ms = (/* @__PURE__ */ new Date(`${dateYmd}T00:00:00`)).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return "0";
    return String(ms);
  }
  function buildBody(pageNum) {
    const prePageNo = Math.max(1, pageNum - 1);
    const tabCode = ORDER_STATUS_TO_TAB[filterOrderStatus] || "success";
    const unionSearchEncoded = encodeURIComponent(filterUnionSearch);
    const buyerNickEncoded = encodeURIComponent(filterBuyerNick);
    const payDateBegin = toPayDateTimestamp(filterPayDateBegin);
    const payDateEnd = toPayDateTimestamp(filterPayDateEnd);
    if (capturedBody && /pageNum=\d+/.test(capturedBody)) {
      let body = capturedBody.replace(/pageNum=\d+/, `pageNum=${pageNum}`).replace(/prePageNo=\d+/, `prePageNo=${prePageNo}`);
      if (/unionSearch=/.test(body)) {
        body = body.replace(/unionSearch=[^&]*/, `unionSearch=${unionSearchEncoded}`);
      }
      if (/buyerNick=/.test(body)) {
        body = body.replace(/buyerNick=[^&]*/, `buyerNick=${buyerNickEncoded}`);
      }
      if (/orderStatus=/.test(body)) {
        body = body.replace(
          /orderStatus=[^&]*/,
          `orderStatus=${encodeURIComponent(filterOrderStatus)}`
        );
      }
      if (/tabCode=/.test(body)) {
        body = body.replace(/tabCode=[^&]*/, `tabCode=${tabCode}`);
      }
      if (/payDateBegin=/.test(body)) {
        body = body.replace(/payDateBegin=[^&]*/, `payDateBegin=${payDateBegin}`);
      }
      if (/payDateEnd=/.test(body)) {
        body = body.replace(/payDateEnd=[^&]*/, `payDateEnd=${payDateEnd}`);
      }
      return body;
    }
    return [
      "isQnNew=true",
      "isHideNick=true",
      `prePageNo=${prePageNo}`,
      "sifg=0",
      "action=itemlist%2FSoldQueryAction",
      "close=0",
      `pageNum=${pageNum}`,
      `tabCode=${tabCode}`,
      "useCheckcode=false",
      "errorCheckcode=false",
      `payDateBegin=${payDateBegin}`,
      "rateStatus=ALL",
      `unionSearch=${unionSearchEncoded}`,
      `buyerNick=${buyerNickEncoded}`,
      `orderStatus=${filterOrderStatus}`,
      "pageSize=15",
      "dateEnd=0",
      "endTimeBegin=0",
      "endTimeEnd=0",
      "rxOldFlag=0",
      "rxSendFlag=0",
      "dateBegin=0",
      "tradeTag=0",
      "rxHasSendFlag=0",
      "auctionType=0",
      "sellerNick=",
      "notifySendGoodsType=ALL",
      "sellerMemoFlag=0",
      "useOrderInfo=false",
      "logisticsService=ALL",
      "o2oDeliveryType=ALL",
      "rxAuditFlag=0",
      "auctionId=",
      "queryOrder=desc",
      "holdStatus=0",
      "rxElectronicAuditFlag=0",
      "bizOrderId=",
      "queryMore=false",
      `payDateEnd=${payDateEnd}`,
      "rxWaitSendflag=0",
      "sellerMemo=0",
      "queryBizType=ALL",
      "rxElectronicAllFlag=0",
      "rxSuccessflag=0",
      "unionSearchTotalNum=0",
      "refund=ALL",
      "unionSearchPageNum=0",
      "yushouStatus=ALL",
      "deliveryTimeType=ALL",
      "payMethodType=ALL",
      "orderType=ALL",
      "appName=ALL"
    ].join("&");
  }
  function extractRows(data) {
    const mainOrders = data && Array.isArray(data.mainOrders) ? data.mainOrders : [];
    const rows = [];
    for (let i = 0; i < mainOrders.length; i += 1) {
      const order = mainOrders[i] || {};
      const orderId = order.id != null ? String(order.id) : "";
      const buyer = order.buyer || {};
      const nick = buyer.nick != null ? String(buyer.nick) : "";
      rows.push({ orderId, nick });
    }
    return rows;
  }
  function hasReplacementChar(data) {
    if (!data || !Array.isArray(data.mainOrders)) {
      return false;
    }
    for (let i = 0; i < data.mainOrders.length; i += 1) {
      const nick = data.mainOrders[i]?.buyer?.nick;
      if (typeof nick === "string" && nick.includes("�")) {
        return true;
      }
    }
    return false;
  }
  function parseJsonFromBuffer(buffer) {
    const utf8Text = new TextDecoder("utf-8").decode(buffer);
    let parsed = null;
    try {
      parsed = JSON.parse(utf8Text);
    } catch {
      parsed = null;
    }
    if (parsed && !hasReplacementChar(parsed)) {
      return parsed;
    }
    try {
      const gbkText = new TextDecoder("gbk").decode(buffer);
      parsed = JSON.parse(gbkText);
      if (parsed) {
        return parsed;
      }
    } catch {
    }
    try {
      const gb18030Text = new TextDecoder("gb18030").decode(buffer);
      parsed = JSON.parse(gb18030Text);
      if (parsed) {
        return parsed;
      }
    } catch {
    }
    if (parsed) {
      return parsed;
    }
    throw new Error("JSON parse error");
  }
  async function fetchPage(pageNum, signal) {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        accept: "application/json, text/plain, */*",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8"
      },
      body: buildBody(pageNum),
      credentials: "include",
      signal
    });
    const buffer = await response.arrayBuffer();
    return parseJsonFromBuffer(buffer);
  }
  function emitProgress(totalPage, currentPage, message) {
    window.postMessage(
      {
        type: OU_RUNTIME.USER_DATA_PROGRESS,
        totalPage,
        currentPage,
        message
      },
      "*"
    );
  }
  function emitPage(pageNum, rows) {
    window.postMessage(
      {
        type: OU_RUNTIME.USER_DATA_PAGE,
        pageNum,
        rows
      },
      "*"
    );
  }
  function emitDone(rows, error, stopped = false) {
    window.postMessage(
      {
        type: OU_RUNTIME.USER_DATA_DONE,
        rows,
        error,
        stopped
      },
      "*"
    );
  }
  function stopCollection() {
    runStopped = true;
    runToken += 1;
    if (nextPageTimer != null) {
      clearTimeout(nextPageTimer);
      nextPageTimer = null;
    }
    if (activeAbortController) {
      try {
        activeAbortController.abort();
      } catch {
      }
      activeAbortController = null;
    }
  }
  async function runCollection() {
    stopCollection();
    runStopped = false;
    const token = runToken;
    const isActive = () => token === runToken && !runStopped;
    emitProgress(null, 0, "正在请求第 1 页...");
    try {
      activeAbortController = new AbortController();
      const firstPageData = await fetchPage(1, activeAbortController.signal);
      if (!isActive()) {
        emitDone([], "用户已停止", true);
        return;
      }
      const page = firstPageData && firstPageData.page ? firstPageData.page : {};
      const pageSize = page.pageSize != null && Number(page.pageSize) > 0 ? Number.parseInt(page.pageSize, 10) : 15;
      const totalNumber = page.totalNumber != null && Number(page.totalNumber) >= 0 ? Number.parseInt(page.totalNumber, 10) : 0;
      const apiTotalPage = page.totalPage != null && Number(page.totalPage) > 0 ? Number.parseInt(page.totalPage, 10) : 1;
      let totalPage = totalNumber > 0 && pageSize > 0 ? Math.ceil(totalNumber / pageSize) : apiTotalPage;
      if (apiTotalPage > 1e3 && totalPage !== apiTotalPage) {
        totalPage = Math.ceil(totalNumber / pageSize);
      }
      let allRows = extractRows(firstPageData);
      emitProgress(totalPage, 1, `第 1 页完成，共 ${totalPage} 页`);
      emitPage(1, allRows);
      if (totalPage <= 1) {
        emitDone(allRows, null, false);
        return;
      }
      let currentPage = 1;
      const runNext = async () => {
        if (!isActive()) {
          emitDone(allRows, "用户已停止", true);
          return;
        }
        currentPage += 1;
        if (currentPage > totalPage) {
          emitDone(allRows, null, false);
          return;
        }
        emitProgress(totalPage, currentPage, `正在请求第 ${currentPage} 页...`);
        try {
          activeAbortController = new AbortController();
          const pageData = await fetchPage(currentPage, activeAbortController.signal);
          if (!isActive()) {
            emitDone(allRows, "用户已停止", true);
            return;
          }
          const pageRows = extractRows(pageData);
          allRows = allRows.concat(pageRows);
          emitProgress(totalPage, currentPage, `第 ${currentPage} 页完成，共 ${totalPage} 页`);
          emitPage(currentPage, pageRows);
          nextPageTimer = window.setTimeout(runNext, REQUEST_INTERVAL_MS);
        } catch (error) {
          if (!isActive()) {
            emitDone(allRows, "用户已停止", true);
            return;
          }
          emitDone(
            allRows,
            String(error && error.message ? error.message : error),
            false
          );
        }
      };
      nextPageTimer = window.setTimeout(runNext, REQUEST_INTERVAL_MS);
    } catch (error) {
      if (!isActive()) {
        emitDone([], "用户已停止", true);
        return;
      }
      emitDone([], String(error && error.message ? error.message : error), false);
    }
  }
  function handleStartMessage(event) {
    if (event.source !== window || !event.data) {
      return;
    }
    if (event.data.type === OU_RUNTIME.STOP_USER_DATA_MAIN) {
      stopCollection();
      emitDone([], "用户已停止", true);
      return;
    }
    if (event.data.type !== OU_RUNTIME.START_USER_DATA) {
      return;
    }
    filterUnionSearch = event.data.unionSearch != null ? String(event.data.unionSearch) : "";
    filterBuyerNick = event.data.buyerNick != null ? String(event.data.buyerNick) : "";
    filterOrderStatus = event.data.orderStatus != null ? String(event.data.orderStatus) : "SUCCESS";
    filterPayDateBegin = event.data.payDateBegin != null ? String(event.data.payDateBegin) : "";
    filterPayDateEnd = event.data.payDateEnd != null ? String(event.data.payDateEnd) : "";
    runCollection();
  }
  function initMainWorldCollector() {
    try {
      if (window[MAIN_GUARD_KEY]) {
        return;
      }
      window[MAIN_GUARD_KEY] = true;
    } catch {
      return;
    }
    patchFetchForBodyCapture();
    window.addEventListener("message", handleStartMessage);
  }
  initMainWorldCollector();
})();
//# sourceMappingURL=order-userdata-main.js.map
