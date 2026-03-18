/**
 * 在千牛/交易页主世界运行：分页请求 asyncSold.htm，收集订单号与买家标识（nick、encodeId）
 * 每页间隔 0.5s，通过 postMessage 把结果回传给 content script
 * 会拦截页面自己的请求以复用 unionSearch 等参数，避免总页数变成“全联盟”的 2 万多页
 *
 * 防重复注入：每次「获取用户数据」都会再插 script，若不加守卫会挂多个 listener，
 * 同一任务结束会触发多次导出 → 下载一堆同名 (1)(2)… CSV。
 */
(function () {
  try {
    if (window.__LINING_SOLD_USERDATA_MAIN__) return;
    window.__LINING_SOLD_USERDATA_MAIN__ = true;
  } catch {
    return;
  }
  var API_URL = 'https://trade.taobao.com/trade/itemlist/asyncSold.htm?event_submit_do_query=1&_input_charset=utf8';
  var DELAY_MS = 500;
  var capturedBody = null;
  var filterUnionSearch = '';
  var filterBuyerNick = '';
  var filterOrderStatus = 'SUCCESS';
  var ORDER_STATUS_TO_TAB = { SUCCESS: 'success', NOT_PAID: 'waitBuyerPay', PAID: 'waitSend', SEND: 'haveSendGoods', DROP: 'closed', ALL: 'success' };

  function captureAsyncSoldBody(url, body) {
    if (typeof url !== 'string' || typeof body !== 'string') return;
    if (url.indexOf('asyncSold.htm') === -1) return;
    capturedBody = body;
  }

  (function patchFetch() {
    var rawFetch = window.fetch;
    if (!rawFetch) return;
    window.fetch = function (url, opts) {
      var u = typeof url === 'string' ? url : (url && url.url);
      if (opts && opts.method === 'POST' && opts.body && typeof opts.body === 'string') captureAsyncSoldBody(u, opts.body);
      return rawFetch.apply(this, arguments);
    };
  })();

  function buildBody(pageNum) {
    var prePageNo = Math.max(1, pageNum - 1);
    var tabCode = ORDER_STATUS_TO_TAB[filterOrderStatus] || 'success';
    var unionSearchEnc = encodeURIComponent(filterUnionSearch);
    var buyerNickEnc = encodeURIComponent(filterBuyerNick);
    if (capturedBody && /pageNum=\d+/.test(capturedBody)) {
      var body = capturedBody
        .replace(/pageNum=\d+/, 'pageNum=' + pageNum)
        .replace(/prePageNo=\d+/, 'prePageNo=' + prePageNo);
      if (filterUnionSearch !== '' && /unionSearch=/.test(body)) body = body.replace(/unionSearch=[^&]*/, 'unionSearch=' + unionSearchEnc);
      if (/buyerNick=/.test(body)) body = body.replace(/buyerNick=[^&]*/, 'buyerNick=' + buyerNickEnc);
      if (/orderStatus=/.test(body)) body = body.replace(/orderStatus=[^&]*/, 'orderStatus=' + encodeURIComponent(filterOrderStatus));
      if (/tabCode=/.test(body)) body = body.replace(/tabCode=[^&]*/, 'tabCode=' + tabCode);
      return body;
    }
    return [
      'isQnNew=true',
      'isHideNick=true',
      'prePageNo=' + prePageNo,
      'sifg=0',
      'action=itemlist%2FSoldQueryAction',
      'close=0',
      'pageNum=' + pageNum,
      'tabCode=' + tabCode,
      'useCheckcode=false',
      'errorCheckcode=false',
      'payDateBegin=0',
      'rateStatus=ALL',
      'unionSearch=' + unionSearchEnc,
      'buyerNick=' + buyerNickEnc,
      'orderStatus=' + filterOrderStatus,
      'pageSize=15',
      'dateEnd=0',
      'endTimeBegin=0',
      'endTimeEnd=0',
      'rxOldFlag=0',
      'rxSendFlag=0',
      'dateBegin=0',
      'tradeTag=0',
      'rxHasSendFlag=0',
      'auctionType=0',
      'sellerNick=',
      'notifySendGoodsType=ALL',
      'sellerMemoFlag=0',
      'useOrderInfo=false',
      'logisticsService=ALL',
      'o2oDeliveryType=ALL',
      'rxAuditFlag=0',
      'auctionId=',
      'queryOrder=desc',
      'holdStatus=0',
      'rxElectronicAuditFlag=0',
      'bizOrderId=',
      'queryMore=false',
      'payDateEnd=0',
      'rxWaitSendflag=0',
      'sellerMemo=0',
      'queryBizType=ALL',
      'rxElectronicAllFlag=0',
      'rxSuccessflag=0',
      'unionSearchTotalNum=0',
      'refund=ALL',
      'unionSearchPageNum=0',
      'yushouStatus=ALL',
      'deliveryTimeType=ALL',
      'payMethodType=ALL',
      'orderType=ALL',
      'appName=ALL'
    ].join('&');
  }

  function extractRows(data) {
    var mainOrders = (data && data.mainOrders) ? data.mainOrders : [];
    var rows = [];
    for (var i = 0; i < mainOrders.length; i++) {
      var order = mainOrders[i];
      var orderId = (order && (order.id != null)) ? String(order.id) : '';
      var buyer = order && order.buyer ? order.buyer : {};
      var nick = (buyer.nick != null) ? String(buyer.nick) : '';
      rows.push({ orderId: orderId, nick: nick });
    }
    return rows;
  }

  function hasReplacementChar(obj) {
    if (!obj) return false;
    var orders = obj.mainOrders;
    if (!Array.isArray(orders)) return false;
    for (var i = 0; i < orders.length; i++) {
      var nick = orders[i] && orders[i].buyer && orders[i].buyer.nick;
      if (typeof nick === 'string' && nick.indexOf('\uFFFD') !== -1) return true;
    }
    return false;
  }

  function fetchPage(pageNum) {
    return fetch(API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: buildBody(pageNum),
      credentials: 'include'
    }).then(function (res) {
      return res.arrayBuffer().then(function (buffer) {
        var textUtf8 = new TextDecoder('utf-8').decode(buffer);
        var data;
        try {
          data = JSON.parse(textUtf8);
        } catch (e) {
          data = null;
        }
        if (data && !hasReplacementChar(data)) return data;
        try {
          var textGbk = new TextDecoder('gbk').decode(buffer);
          data = JSON.parse(textGbk);
          if (data) return data;
        } catch (e2) {}
        try {
          var textGb18030 = new TextDecoder('gb18030').decode(buffer);
          data = JSON.parse(textGb18030);
          if (data) return data;
        } catch (e3) {}
        if (data) return data;
        throw new Error('JSON parse error');
      });
    });
  }

  function run() {
    window.postMessage({ type: 'SOLD_USER_DATA_PROGRESS', totalPage: null, currentPage: 0, message: '正在请求第 1 页…' }, '*');
    fetchPage(1).then(function (data) {
      var page = (data && data.page) ? data.page : {};
      var pageSize = (page.pageSize != null && page.pageSize > 0) ? parseInt(page.pageSize, 10) : 15;
      var totalNumber = (page.totalNumber != null && page.totalNumber >= 0) ? parseInt(page.totalNumber, 10) : 0;
      var apiTotalPage = (page.totalPage != null && page.totalPage > 0) ? parseInt(page.totalPage, 10) : 1;
      var totalPage = totalNumber > 0 && pageSize > 0
        ? Math.ceil(totalNumber / pageSize)
        : apiTotalPage;
      if (apiTotalPage > 1000 && totalPage !== apiTotalPage) {
        totalPage = Math.ceil(totalNumber / pageSize);
      }
      var allRows = extractRows(data);
      window.postMessage({ type: 'SOLD_USER_DATA_PROGRESS', totalPage: totalPage, currentPage: 1, message: '第 1 页完成，共 ' + totalPage + ' 页' }, '*');
      window.postMessage({ type: 'SOLD_USER_DATA_PAGE', pageNum: 1, rows: allRows }, '*');

      if (totalPage <= 1) {
        window.postMessage({ type: 'SOLD_USER_DATA_DONE', rows: allRows, error: null }, '*');
        return;
      }

      var current = 1;
      function next() {
        current++;
        if (current > totalPage) {
          window.postMessage({ type: 'SOLD_USER_DATA_DONE', rows: allRows, error: null }, '*');
          return;
        }
        window.postMessage({ type: 'SOLD_USER_DATA_PROGRESS', totalPage: totalPage, currentPage: current, message: '正在请求第 ' + current + ' 页…' }, '*');
        fetchPage(current).then(function (data) {
          var pageRows = extractRows(data);
          allRows = allRows.concat(pageRows);
          window.postMessage({ type: 'SOLD_USER_DATA_PROGRESS', totalPage: totalPage, currentPage: current, message: '第 ' + current + ' 页完成，共 ' + totalPage + ' 页' }, '*');
          window.postMessage({ type: 'SOLD_USER_DATA_PAGE', pageNum: current, rows: pageRows }, '*');
          setTimeout(next, DELAY_MS);
        }).catch(function (err) {
          window.postMessage({ type: 'SOLD_USER_DATA_DONE', rows: allRows, error: String(err && err.message || err) }, '*');
        });
      }
      setTimeout(next, DELAY_MS);
    }).catch(function (err) {
      window.postMessage({ type: 'SOLD_USER_DATA_DONE', rows: [], error: String(err && err.message || err) }, '*');
    });
  }

  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data || e.data.type !== 'START_GET_USER_DATA') return;
    filterUnionSearch = (e.data.unionSearch != null) ? String(e.data.unionSearch) : '';
    filterBuyerNick = (e.data.buyerNick != null) ? String(e.data.buyerNick) : '';
    filterOrderStatus = (e.data.orderStatus != null) ? String(e.data.orderStatus) : 'SUCCESS';
    run();
  });
})();
