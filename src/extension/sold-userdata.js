/**
 * Content Script：在千牛/交易页注入 sold-userdata-main.js，转发主世界的 postMessage 与扩展消息
 *
 * 防重复执行：popup 重试会 executeScript 再注入本文件，否则会重复监听 message → 一次 DONE 导出多份 CSV。
 */
(function () {
  try {
    var g = typeof globalThis !== 'undefined' ? globalThis : window;
    if (g.__LINING_SOLD_USERDATA_CS__) return;
    g.__LINING_SOLD_USERDATA_CS__ = true;
  } catch {
    return;
  }

  function injectMainScript() {
    var script = document.createElement('script');
    script.src = chrome.runtime.getURL('sold-userdata-main.js');
    (document.documentElement || document.body).appendChild(script);
    script.onload = function () { script.remove(); };
  }

  function escapeCsvCell(s) {
    if (s == null) return '';
    var t = String(s);
    if (/[",\r\n]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
    return t;
  }

  /**
   * 订单号在 Excel 中打开时会被当数值 → 科学计数法。
   * 使用 Excel 公式 ="订单号" 强制按文本显示（WPS/部分表格软件同样兼容）。
   */
  function orderIdCellForExcelCsv(orderId) {
    var t = orderId == null ? '' : String(orderId);
    var inner = t.replace(/"/g, '""');
    return '="' + inner + '"';
  }

  /* 导出 CSV：仅订单ID、昵称两列；UTF-8 BOM 避免 Excel 打开中文乱码 */
  function downloadCsv(rows) {
    var headers = ['订单ID', '昵称'];
    var lines = [headers.join(',')];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      lines.push([
        orderIdCellForExcelCsv(r.orderId),
        escapeCsvCell(r.nick)
      ].join(','));
    }
    var csv = '\uFEFF' + lines.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    var d = new Date();
    var stamp = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    a.download = 'sold_userdata_' + stamp + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function onPageMessage(event) {
    if (event.source !== window || !event.data) return;
    var type = event.data.type;
    if (type === 'SOLD_USER_DATA_DONE') {
      var rows = event.data.rows || [];
      var err = event.data.error || null;
      if (rows.length > 0) downloadCsv(rows);
      chrome.runtime.sendMessage({
        type: 'SOLD_USER_DATA_DONE',
        rows: rows,
        error: err
      }).catch(function () {});
      return;
    }
    if (type === 'SOLD_USER_DATA_PROGRESS') {
      chrome.runtime.sendMessage({
        type: 'SOLD_USER_DATA_PROGRESS',
        totalPage: event.data.totalPage,
        currentPage: event.data.currentPage,
        message: event.data.message
      }).catch(function () {});
      return;
    }
    if (type === 'SOLD_USER_DATA_PAGE') {
      chrome.runtime.sendMessage({
        type: 'SOLD_USER_DATA_PAGE',
        pageNum: event.data.pageNum,
        rows: event.data.rows || []
      }).catch(function () {});
    }
  }

  window.addEventListener('message', onPageMessage);

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === 'GET_USER_DATA') {
      injectMainScript();
      setTimeout(function () {
        window.postMessage({
          type: 'START_GET_USER_DATA',
          unionSearch: (msg.unionSearch != null) ? String(msg.unionSearch) : '',
          buyerNick: (msg.buyerNick != null) ? String(msg.buyerNick) : '',
          orderStatus: (msg.orderStatus != null) ? String(msg.orderStatus) : 'SUCCESS'
        }, '*');
      }, 100);
      sendResponse({ ok: true });
    }
    return true;
  });

  /* 尽早注入主脚本以便拦截页面首条 asyncSold 请求（复用 unionSearch 等参数） */
  injectMainScript();
})();
