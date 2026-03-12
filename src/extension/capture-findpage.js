/**
 * Content Script：在 document_start 把拦截逻辑注入到「页面主世界」
 * 页面脚本（merge.js / boot.js / XHR）跑在主世界，只有主世界里的 patch 才能拦到请求
 * 监听主世界 postMessage，将 findPage 响应写入 storage 供 popup 使用
 */
(function () {
  function onMessage(event) {
    if (event.source !== window || !event.data || event.data.type !== 'FIND_PAGE_CAPTURED') return;
    var payload = event.data.payload;
    if (!payload) return;
    try {
      chrome.storage.local.set({
        findPageResponse: payload,
        findPageRequestUrl: event.data.requestUrl || '',
        findPagePageUrl: event.data.pageUrl || ''
      }, function () {});
    } catch (e) {}
  }
  window.addEventListener('message', onMessage);

  var script = document.createElement('script');
  script.src = chrome.runtime.getURL('capture-findpage-main.js');
  (document.documentElement || document.head).appendChild(script);
  script.onload = function () { script.remove(); };
})();
