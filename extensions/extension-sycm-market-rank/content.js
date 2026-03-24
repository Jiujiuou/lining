/**
 * window.postMessage 接收 inject 转发的 rank.json；每次监听到都 console 打印；汇总结果由 background 返回。
 */
(function () {
  var PREFIX =
    typeof __SYCM_RANK_DEFAULTS__ !== 'undefined' ? __SYCM_RANK_DEFAULTS__.PREFIX : '[市场排名]';
  var RUNTIME =
    typeof __SYCM_RANK_DEFAULTS__ !== 'undefined' && __SYCM_RANK_DEFAULTS__.RUNTIME
      ? __SYCM_RANK_DEFAULTS__.RUNTIME
      : { GET_TAB_ID_MESSAGE: 'SYCM_RANK_GET_TAB_ID', RANK_CAPTURE: 'SYCM_RANK_CAPTURE' };
  var MSG_SOURCE = 'sycm-rank-extension';

  function getEast8TimeStr() {
    var d = new Date();
    var pad = function (n) {
      return (n < 10 ? '0' : '') + n;
    };
    var utc = d.getTime() + d.getTimezoneOffset() * 60000;
    var east8 = new Date(utc + 8 * 60 * 60 * 1000);
    return (
      east8.getFullYear() +
      '-' +
      pad(east8.getMonth() + 1) +
      '-' +
      pad(east8.getDate()) +
      ':' +
      pad(east8.getHours()) +
      ':' +
      pad(east8.getMinutes()) +
      ':' +
      pad(east8.getSeconds())
    );
  }

  function parseKeyWordFromUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
      var q = url.indexOf('?') >= 0 ? url.slice(url.indexOf('?') + 1) : '';
      if (!q) return '';
      var parts = q.split('&');
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (p.indexOf('keyWord=') !== 0) continue;
        return decodeURIComponent(p.slice('keyWord='.length).replace(/\+/g, ' ')).trim();
      }
      return '';
    } catch (e) {
      return '';
    }
  }

  function parseRankResponse(data) {
    if (!data || data.code !== 0) return null;
    var outer = data.data && data.data.data;
    var list = outer && outer.data;
    if (!Array.isArray(list) || list.length === 0) return null;
    var updateTime = data.data && data.data.updateTime ? String(data.data.updateTime) : '';
    var items = [];
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      var itemId =
        row && row.item && row.item.itemId != null ? String(row.item.itemId) : '';
      var shopTitle =
        row && row.shop && (row.shop.title != null ? row.shop.title : row.shop.value);
      shopTitle = shopTitle != null && String(shopTitle).trim() !== '' ? String(shopTitle).trim() : '';
      var rankRaw = row && row.cateRankId && row.cateRankId.value;
      var rank = rankRaw != null && rankRaw !== '' ? Number(rankRaw) : NaN;
      if (!itemId && !shopTitle) continue;
      items.push({
        shopTitle: shopTitle,
        rank: isNaN(rank) ? null : rank,
        itemId: itemId
      });
    }
    if (items.length === 0) return null;
    items.sort(function (a, b) {
      var ar = a.rank != null ? a.rank : 999999;
      var br = b.rank != null ? b.rank : 999999;
      return ar - br;
    });
    return { updateTime: updateTime, items: items };
  }

  function injectMain() {
    try {
      var injectScript = document.createElement('script');
      injectScript.src = chrome.runtime.getURL('inject.js');
      injectScript.onload = function () {
        this.remove();
      };
      injectScript.onerror = function () {};
      (document.head || document.documentElement).appendChild(injectScript);
    } catch (e) {}
  }

  function handleRankPayload(requestUrl, data) {
    var requestUrlStr = requestUrl != null ? String(requestUrl) : '';
    console.log(PREFIX, '监听到 rank.json', requestUrlStr);

    if (!data || data._parseError) {
      var err1 = '正文无法解析为 JSON';
      console.warn(PREFIX, err1);
      chrome.runtime.sendMessage(
        {
          type: RUNTIME.RANK_CAPTURE,
          payload: null,
          meta: { requestUrl: requestUrlStr, parseError: err1 }
        },
        function (res) {
          if (chrome.runtime.lastError) return;
          if (res && res.resultLine) console.log(PREFIX, res.resultLine);
        }
      );
      return;
    }

    var parsed = parseRankResponse(data);
    if (!parsed) {
      var err2 =
        'code=' +
        (data.code != null ? data.code : '?') +
        (data.message ? ' ' + String(data.message) : '') +
        (data.code === 0 ? '（列表为空）' : '');
      console.warn(PREFIX, '解析跳过', err2);
      chrome.runtime.sendMessage(
        {
          type: RUNTIME.RANK_CAPTURE,
          payload: null,
          meta: { requestUrl: requestUrlStr, parseError: err2 }
        },
        function (res) {
          if (chrome.runtime.lastError) return;
          if (res && res.resultLine) console.log(PREFIX, res.resultLine);
        }
      );
      return;
    }

    var keyWord = parseKeyWordFromUrl(requestUrlStr);
    var recordedAtEast8 = getEast8TimeStr();

    for (var j = 0; j < parsed.items.length; j++) {
      var it = parsed.items[j];
      console.log(PREFIX, '排名', it.rank, '店铺名', it.shopTitle || '（无店名）');
    }

    var payload = {
      updatedAt: new Date().toISOString(),
      recordedAtEast8: recordedAtEast8,
      updateTime: parsed.updateTime,
      keyWord: keyWord,
      requestUrl: requestUrlStr,
      items: parsed.items
    };

    try {
      chrome.runtime.sendMessage({ type: RUNTIME.RANK_CAPTURE, payload: payload, meta: null }, function (res) {
        if (chrome.runtime.lastError) return;
        if (res && res.resultLine) console.log(PREFIX, res.resultLine);
      });
    } catch (e) {}
  }

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.source !== MSG_SOURCE) return;
    if (e.origin && e.origin.indexOf('sycm.taobao.com') < 0) return;
    handleRankPayload(e.data.requestUrl, e.data.data);
  });

  injectMain();
})();
