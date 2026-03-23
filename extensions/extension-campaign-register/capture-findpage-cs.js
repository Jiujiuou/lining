/**
 * 隔离世界：接收主世界 FIND_PAGE_CAPTURED，写入本扩展 storage（按 tab 分桶）
 */
(function () {
  try {
    var g = typeof globalThis !== 'undefined' ? globalThis : window;
    if (g.__LINING_AMCR_CS__) return;
    g.__LINING_AMCR_CS__ = true;
  } catch (e) {
    return;
  }

  var STATE_BY_TAB = 'amcr_findPageStateByTab';

  var tabIdCache = '__pending__';
  var tabIdWaiters = [];
  function resolveTabId(callback) {
    if (typeof tabIdCache === 'number') {
      callback(tabIdCache);
      return;
    }
    if (tabIdCache === false) {
      callback(null);
      return;
    }
    tabIdWaiters.push(callback);
    if (tabIdWaiters.length > 1) return;
    try {
      chrome.runtime.sendMessage({ type: 'AMCR_GET_TAB_ID' }, function (res) {
        if (chrome.runtime.lastError || !res || res.tabId == null) {
          tabIdCache = false;
        } else {
          tabIdCache = res.tabId;
        }
        var tid = typeof tabIdCache === 'number' ? tabIdCache : null;
        var w = tabIdWaiters.slice();
        tabIdWaiters = [];
        for (var i = 0; i < w.length; i++) w[i](tid);
      });
    } catch (err) {
      tabIdCache = false;
      var w2 = tabIdWaiters.slice();
      tabIdWaiters = [];
      for (var j = 0; j < w2.length; j++) w2[j](null);
    }
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
    } catch (e) {
      return '';
    }
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
      resolveTabId(function (tabId) {
        if (tabId == null) {
          chrome.storage.local.set({
            amcr_findPageResponse: payload,
            amcr_findPageRequestUrl: requestUrl,
            amcr_findPagePageUrl: event.data.pageUrl || '',
            amcr_findPageBizCode: biz
          }, function () {});
          return;
        }
        chrome.storage.local.get([STATE_BY_TAB], function (r) {
          var byTab = r && r[STATE_BY_TAB] ? r[STATE_BY_TAB] : {};
          var prev = byTab[String(tabId)] || {};
          var sel = prev.findPageSelectedCampaigns || {};
          byTab[String(tabId)] = {
            findPageResponse: payload,
            findPageRequestUrl: requestUrl,
            findPagePageUrl: event.data.pageUrl || '',
            findPageBizCode: biz,
            findPageSelectedCampaigns: sel
          };
          var o = {};
          o[STATE_BY_TAB] = byTab;
          chrome.storage.local.set(o, function () {});
        });
      });
    } catch (e) {}
  }
  window.addEventListener('message', onMessage);
})();
