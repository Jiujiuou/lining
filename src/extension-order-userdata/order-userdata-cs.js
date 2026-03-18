/**
 * Content Script：注入 order-userdata-main.js，仅处理 OU_USER_DATA_* / START_OU_USER_DATA，
 * 与主扩展其它逻辑隔离命名空间，可与「数据获取」扩展同时安装。
 */
(function () {
  try {
    var g = typeof globalThis !== 'undefined' ? globalThis : window;
    if (g.__LINING_OU_USERDATA_CS__) return;
    g.__LINING_OU_USERDATA_CS__ = true;
  } catch {
    return;
  }

  function injectMainScript() {
    var script = document.createElement('script');
    script.src = chrome.runtime.getURL('order-userdata-main.js');
    (document.documentElement || document.body).appendChild(script);
    script.onload = function () { script.remove(); };
  }

  function escapeCsvCell(s) {
    if (s == null) return '';
    var t = String(s);
    if (/[",\r\n]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
    return t;
  }

  function orderIdCellForExcelCsv(orderId) {
    var t = orderId == null ? '' : String(orderId);
    var inner = t.replace(/"/g, '""');
    return '="' + inner + '"';
  }

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
    a.download = 'sold_userdata_ou_' + stamp + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function onPageMessage(event) {
    if (event.source !== window || !event.data) return;
    var type = event.data.type;
    if (type === 'OU_USER_DATA_DONE') {
      var rows = event.data.rows || [];
      var err = event.data.error || null;
      if (rows.length > 0) downloadCsv(rows);
      chrome.runtime.sendMessage({
        type: 'OU_USER_DATA_DONE',
        rows: rows,
        error: err
      }).catch(function () {});
      return;
    }
    if (type === 'OU_USER_DATA_PROGRESS') {
      chrome.runtime.sendMessage({
        type: 'OU_USER_DATA_PROGRESS',
        totalPage: event.data.totalPage,
        currentPage: event.data.currentPage,
        message: event.data.message
      }).catch(function () {});
      return;
    }
    if (type === 'OU_USER_DATA_PAGE') {
      chrome.runtime.sendMessage({
        type: 'OU_USER_DATA_PAGE',
        pageNum: event.data.pageNum,
        rows: event.data.rows || []
      }).catch(function () {});
    }
  }

  window.addEventListener('message', onPageMessage);

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === 'OU_GET_USER_DATA') {
      injectMainScript();
      setTimeout(function () {
        window.postMessage({
          type: 'START_OU_USER_DATA',
          unionSearch: (msg.unionSearch != null) ? String(msg.unionSearch) : '',
          buyerNick: (msg.buyerNick != null) ? String(msg.buyerNick) : '',
          orderStatus: (msg.orderStatus != null) ? String(msg.orderStatus) : 'SUCCESS'
        }, '*');
      }, 100);
      sendResponse({ ok: true });
    }
    return true;
  });

  injectMainScript();
})();
