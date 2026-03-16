/**
 * Content Script：在千牛/交易页注入 sold-userdata-main.js，转发主世界的 postMessage 与扩展消息
 */
(function () {
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

  /* 导出 CSV：仅订单ID、昵称两列；UTF-8 BOM 避免 Excel 打开中文乱码，确认无误后再启用调用 */
  function downloadCsv(rows) {
    var headers = ['订单ID', '昵称'];
    var lines = [headers.join(',')];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      lines.push([
        escapeCsvCell(r.orderId),
        escapeCsvCell(r.nick)
      ].join(','));
    }
    var csv = '\uFEFF' + lines.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'sold_userdata_' + (new Date().toISOString().slice(0, 10)) + '.csv';
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
