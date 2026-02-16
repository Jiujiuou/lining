/**
 * 在页面上下文执行，劫持 fetch/XHR 监听配置的接口。可被 content script 或 background 注入。
 * 同时伪造「页面始终可见」，使切到其他标签时页面仍可能继续请求。
 *
 * 新增数据源：在 SOURCES 中增加一项，指定 url 片段、事件名、以及从响应 data 中取 value 的函数即可。
 */
(function () {
  if (window.__sycmCaptureLoaded) return;
  window.__sycmCaptureLoaded = true;

  try {
    Object.defineProperty(document, 'hidden', { get: function () { return false; }, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: function () { return 'visible'; }, configurable: true });
  } catch (e) {
    console.warn('[Sycm Data Capture] 伪造 visibility 失败（部分浏览器可能不允许）:', e);
  }

  var PREFIX = '[Sycm Data Capture]';

  function getEast8TimeStr() {
    var d = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var utc = d.getTime() + d.getTimezoneOffset() * 60000;
    var east8 = new Date(utc + 8 * 60 * 60 * 1000);
    var y8 = east8.getFullYear();
    var m8 = pad(east8.getMonth() + 1);
    var d8 = pad(east8.getDate());
    var h8 = pad(east8.getHours());
    var min8 = pad(east8.getMinutes());
    var s8 = pad(east8.getSeconds());
    return y8 + '-' + m8 + '-' + d8 + ':' + h8 + ':' + min8 + ':' + s8;
  }

  /**
   * 在 data.data.data 树中按 pageName.value 查找节点
   */
  function walkByPageName(nodes, name) {
    if (!Array.isArray(nodes)) return null;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.pageName && n.pageName.value === name) return n;
      if (n.children && n.children.length) {
        var found = walkByPageName(n.children, name);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * 数据源配置：每个接口对应一个事件，上报时由 content.js 的 SINKS 决定写入哪张表。
   * - urlContains: 请求 URL 包含该字符串时命中
   * - urlFilter: 可选，function(url) => boolean，为 false 时不处理（如 rank 仅在有关键词时上报）
   * - eventName: 派发的自定义事件名（content.js 里用同名做表映射）
   * - extractValue: function(data) => value，从接口 JSON 里取出要上报的数值（或对象）
   * - multiValue: 若为 true，detail 为 { payload: value, recordedAt }，用于多列写入一张表
   */
  var SOURCES = [
    {
      urlContains: '/cc/item/live/view/top.json',
      eventName: 'sycm-cart-log',
      extractValue: function (data) {
        var list = data && data.data && data.data.data && data.data.data.data;
        if (!Array.isArray(list) || list.length !== 1) return undefined;
        var row = list[0];
        var cnt = row && row.itemCartCnt;
        return cnt && typeof cnt.value !== 'undefined' ? cnt.value : cnt;
      }
    },
    {
      urlContains: '/flow/v6/live/item/source/v4.json',
      eventName: 'sycm-flow-source',
      multiValue: true,
      extractValue: function (data) {
        var list = data && data.data && data.data.data;
        if (!Array.isArray(list)) return undefined;
        var searchNode = walkByPageName(list, '搜索');
        var cartNode = walkByPageName(list, '购物车');
        if (!searchNode || !cartNode) return undefined;
        var searchUv = searchNode.uv && typeof searchNode.uv.value !== 'undefined' ? Number(searchNode.uv.value) : 0;
        var searchPayRate = searchNode.payRate && typeof searchNode.payRate.value !== 'undefined' ? Number(searchNode.payRate.value) : 0;
        var cartUv = cartNode.uv && typeof cartNode.uv.value !== 'undefined' ? Number(cartNode.uv.value) : 0;
        var cartPayRateRaw = cartNode.payRate && typeof cartNode.payRate.value !== 'undefined' ? Number(cartNode.payRate.value) : 0;
        var cartPayRate = Math.round(cartPayRateRaw * 100) / 100;
        return {
          search_uv: searchUv,
          search_pay_rate: searchPayRate,
          cart_uv: cartUv,
          cart_pay_rate: cartPayRate
        };
      }
    },
    {
      urlContains: '/mc/mq/mkt/item/live/rank.json',
      urlFilter: function (url) { return url.indexOf('keyWord=%E5%B0%8F%E8%B4%9D%E5%A3%B3') !== -1; },
      eventName: 'sycm-market-rank',
      multiValue: true,
      multiRows: true,
      extractValue: function (data) {
        var inner = data && data.data && data.data.data;
        var list = inner && inner.data;
        if (!Array.isArray(list) || list.length === 0) return undefined;
        var items = [];
        for (var i = 0; i < list.length; i++) {
          var row = list[i];
          var shopTitle = (row.shop && (row.shop.title != null ? row.shop.title : row.shop.value)) || '';
          var rankVal = row.cateRankId && (typeof row.cateRankId.value !== 'undefined' ? row.cateRankId.value : row.cateRankId);
          var rank = rankVal != null ? Number(rankVal) : 0;
          if (shopTitle === '' && !rank) continue;
          items.push({ shop_title: String(shopTitle), rank: rank });
        }
        return items.length ? { items: items } : undefined;
      }
    }
  ];

  function getUrl(input) {
    if (typeof input === 'string') return input;
    if (input && input.url) return input.url;
    return '';
  }

  function handleResponse(url, data) {
    var timeStr = getEast8TimeStr();
    for (var i = 0; i < SOURCES.length; i++) {
      var src = SOURCES[i];
      if (url.indexOf(src.urlContains) === -1) continue;
      if (src.urlFilter && !src.urlFilter(url)) continue;
      try {
        var value = src.extractValue(data);
        if (value === undefined) return;
        if (src.multiValue && value && typeof value === 'object') {
          console.log(PREFIX + ' [' + src.eventName + '] payload:', value, timeStr);
          document.dispatchEvent(new CustomEvent(src.eventName, {
            detail: { payload: value, recordedAt: timeStr }
          }));
        } else {
          var num = Number(value);
          if (num !== num) num = value;
          console.log(PREFIX + ' [' + src.eventName + '] value:', num, timeStr);
          document.dispatchEvent(new CustomEvent(src.eventName, {
            detail: { value: num, recordedAt: timeStr }
          }));
        }
      } catch (e) {
        console.warn(PREFIX + ' 处理 ' + src.eventName + ' 失败', e);
      }
      return;
    }
  }

  try {
    var origFetch = window.fetch;
    window.fetch = function () {
      var url = getUrl(arguments[0]);
      var args = arguments;
      return origFetch.apply(this, args).then(function (res) {
        try {
          var hit = SOURCES.some(function (s) {
            return url.indexOf(s.urlContains) !== -1 && (!s.urlFilter || s.urlFilter(url));
          });
          if (hit) {
            res.clone().json().then(
              function (data) {
                console.log(PREFIX + ' 收到数据:', url, data);
                handleResponse(url, data);
              },
              function (err) {
                console.warn(PREFIX + ' 解析失败', url, err);
              }
            );
          }
        } catch (e) {
          console.warn(PREFIX + ' 处理响应时出错:', e);
        }
        return res;
      });
    };

    var XhrOpen = XMLHttpRequest.prototype.open;
    var XhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this._sycmUrl = typeof url === 'string' ? url : '';
      return XhrOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      var xhr = this;
      var hit = SOURCES.some(function (s) {
            return (xhr._sycmUrl || '').indexOf(s.urlContains) !== -1 && (!s.urlFilter || s.urlFilter(xhr._sycmUrl));
          });
      if (hit) {
        xhr.addEventListener('load', function () {
          try {
            var text = xhr.responseText;
            var data = text ? JSON.parse(text) : null;
            console.log(PREFIX + ' 收到数据 (XHR):', xhr._sycmUrl, data);
            handleResponse(xhr._sycmUrl, data);
          } catch (e) {
            console.warn(PREFIX + ' XHR 解析失败', e);
          }
        });
      }
      return XhrSend.apply(this, arguments);
    };

    var urls = SOURCES.map(function (s) { return s.urlContains; }).join(', ');
    console.log(PREFIX + ' 已注入，监听:', urls);
  } catch (e) {
    console.warn(PREFIX + ' 注入失败:', e);
  }
})();
