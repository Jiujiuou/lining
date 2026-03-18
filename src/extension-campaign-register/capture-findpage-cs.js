/**
 * 隔离世界：接收主世界 FIND_PAGE_CAPTURED，写入本扩展独立 storage（amcr_*），不与「数据获取」共用 findPage*
 */
(function () {
  try {
    var g = typeof globalThis !== 'undefined' ? globalThis : window;
    if (g.__LINING_AMCR_CS__) return;
    g.__LINING_AMCR_CS__ = true;
  } catch (e) {
    return;
  }

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
    if (list.length === 0) return;
    var requestUrl = event.data.requestUrl || '';
    try {
      var biz = parseBizCodeFromUrl(requestUrl);
      chrome.storage.local.set({
        amcr_findPageResponse: payload,
        amcr_findPageRequestUrl: requestUrl,
        amcr_findPagePageUrl: event.data.pageUrl || '',
        amcr_findPageBizCode: biz
      }, function () {});
    } catch (e) {}
  }
  window.addEventListener('message', onMessage);
})();
