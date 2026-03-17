/**
 * Content Script（ISOLATED）：在 document_start 监听主世界 postMessage
 * 主世界 patch 由 manifest 中 world: "MAIN" 的 capture-findpage-main.js 在 document_start 同步执行，
 * 早于页面脚本，避免首屏 findPage 请求早于 patch 导致的漏捕获
 * 将 findPage 响应写入 storage 供 popup 使用
 */
(function () {
  function parseBizCodeFromUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
      var q = url.indexOf('?');
      if (q < 0) return '';
      var params = new URLSearchParams(url.slice(q));
      var bizCode = params.get('bizCode') || params.get('mx_bizCode') || '';
      var allowed = { onebpDisplay: 1, onebpSite: 1, onebpSearch: 1, onebpShortVideo: 1 };
      return allowed[bizCode] ? bizCode : '';
    } catch (e) { return ''; }
  }
  function onMessage(event) {
    if (event.source !== window || !event.data || event.data.type !== 'FIND_PAGE_CAPTURED') return;
    var payload = event.data.payload;
    if (!payload) return;
    var list = payload.data && Array.isArray(payload.data.list) ? payload.data.list : [];
    /* 不把空列表写入 storage，避免首屏空响应覆盖后续带数据的响应，或覆盖上次会话的有效列表 */
    if (list.length === 0) return;
    var requestUrl = event.data.requestUrl || '';
    try {
      var biz = parseBizCodeFromUrl(requestUrl);
      chrome.storage.local.set({
        findPageResponse: payload,
        findPageRequestUrl: requestUrl,
        findPagePageUrl: event.data.pageUrl || '',
        findPageBizCode: biz
      }, function () {});
    } catch (e) {}
  }
  window.addEventListener('message', onMessage);
})();
