/**
 * inject.js - 页面上下文脚本（Main World）
 *
 * 由 content.js 注入到 sycm.taobao.com 的页面主世界（先注入 constants/config.js 再本文件），
 * 与页面 JS 共享同一 window，故可重写 window.fetch 和 XMLHttpRequest.prototype。
 *
 * 职责：
 * 1. 从 window.__SYCM_CONFIG__.pipelines 得到 SOURCES，劫持 fetch/XHR，命中时 extractValue 并派发 CustomEvent
 * 2. 伪造 document.hidden / visibilityState 为始终可见，避免生意参谋切标签时停轮询
 */
(function () {
  function emitLog(level, msg) {
    try {
      document.dispatchEvent(new CustomEvent('sycm-log', { detail: { level: level, msg: msg } }));
    } catch (err) { }
  }
  if (window.__sycmCaptureLoaded) {
    emitLog('warn', '[Sycm] inject.js 跳过：已加载过（可能重复注入）');
    return;
  }
  window.__sycmCaptureLoaded = true;
  emitLog('log', '[Sycm] inject.js 已在页面主世界执行，准备劫持 fetch/XHR');

  try {
    Object.defineProperty(document, 'hidden', { get: function () { return false; }, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: function () { return 'visible'; }, configurable: true });
  } catch (e) {
    emitLog('warn', '[Sycm Data Capture] 伪造 visibility 失败: ' + String(e));
  }

  var PREFIX = '';
  var config = (typeof window !== 'undefined' && window.__SYCM_CONFIG__) ? window.__SYCM_CONFIG__ : null;
  var pipelines = (config && config.pipelines && config.pipelines.length) ? config.pipelines : [];

  var SOURCES = pipelines.map(function (p) {
    return {
      urlContains: p.urlContains,
      urlFilter: p.urlFilter || null,
      eventName: p.eventName,
      extractValue: p.extractValue,
      multiValue: !!p.multiValue,
      multiRows: !!p.multiRows,
      mergeGoodsDetail: !!p.mergeGoodsDetail
    };
  });

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

  function getUrl(input) {
    if (typeof input === 'string') return input;
    if (input && input.url) return input.url;
    if (input && typeof input === 'object' && 'url' in input) return input.url;
    return '';
  }
  function urlMatches(url, urlContains) {
    if (!url || typeof url !== 'string') return false;
    return url.indexOf(urlContains) !== -1 || (url.indexOf('live.json') !== -1 && urlContains.indexOf('live.json') !== -1);
  }

  function getItemIdFromLocation() {
    try {
      var q = typeof window.location !== 'undefined' && window.location.search;
      if (!q) return null;
      var m = q.slice(1).split('&').filter(function (p) { return p.indexOf('itemId=') === 0; })[0];
      return m ? decodeURIComponent(m.split('=')[1] || '') : null;
    } catch (e) { return null; }
  }

  function handleResponse(url, data) {
    var timeStr = getEast8TimeStr();
    for (var i = 0; i < SOURCES.length; i++) {
      var src = SOURCES[i];
      if (!urlMatches(url, src.urlContains)) continue;
      if (src.urlFilter && !src.urlFilter(url)) continue;
      emitLog('log', PREFIX + '[调试] 命中 pipeline: ' + src.eventName);
      try {
        var value = src.extractValue(data);
        if (value === undefined) {
          var inner = data && data.data && data.data.data;
          var list = inner && inner.data;
          var listLen = Array.isArray(list) ? list.length : (list ? '非数组' : '无');
          emitLog('warn', PREFIX + '[调试] extractValue 返回 undefined，eventName=' + src.eventName + ', code=' + (data && data.code) + ', data.data.data.data 长度=' + listLen);
          return;
        }
        var itemId = src.mergeGoodsDetail ? getItemIdFromLocation() : null;
        if (src.multiValue && value && typeof value === 'object') {
          emitLog('log', PREFIX + ' 捕获到数据');
          document.dispatchEvent(new CustomEvent(src.eventName, {
            detail: { payload: value, recordedAt: timeStr, itemId: itemId || undefined }
          }));
        } else {
          var num = Number(value);
          if (num !== num) num = value;
          emitLog('log', PREFIX + ' 捕获到数据');
          document.dispatchEvent(new CustomEvent(src.eventName, {
            detail: { value: num, recordedAt: timeStr, itemId: itemId || undefined }
          }));
        }
      } catch (e) {
        emitLog('warn', PREFIX + ' 处理 ' + src.eventName + ' 失败 ' + String(e));
      }
      return;
    }
  }

  try {
    var origFetch = window.fetch;
    window.fetch = function () {
      var url = getUrl(arguments[0]);
      var args = arguments;
      if (url && url.indexOf('live') !== -1) {
        emitLog('log', '[Sycm] [调试] fetch 被调用，URL 含 live: ' + (url.length > 80 ? url.slice(0, 80) + '...' : url));
      }
      return origFetch.apply(this, args).then(function (res) {
        try {
          var hit = SOURCES.some(function (s) {
            return urlMatches(url, s.urlContains) && (!s.urlFilter || s.urlFilter(url));
          });
          if (hit) {
            emitLog('log', PREFIX + '[调试] 截获到 fetch 请求: ' + (url.indexOf('live.json') !== -1 ? 'live.json' : url.slice(0, 60)) + '...');
            res.clone().json().then(
              function (data) {
                var code = data && data.code;
                var inner = data && data.data && data.data.data;
                var list = inner && inner.data;
                var listLen = Array.isArray(list) ? list.length : (list ? '非数组' : '无');
                emitLog('log', PREFIX + '[调试] 响应解析完成 code=' + code + ', data.data.data.data 长度=' + listLen);
                handleResponse(url, data);
              },
              function (err) { emitLog('warn', PREFIX + ' 解析失败 ' + url + ' ' + String(err)); }
            );
          }
        } catch (e) { emitLog('warn', PREFIX + ' 处理响应时出错 ' + String(e)); }
        return res;
      });
    };

    var XhrOpen = XMLHttpRequest.prototype.open;
    var XhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this._sycmUrl = typeof url === 'string' ? url : '';
      if (this._sycmUrl && this._sycmUrl.indexOf('live') !== -1) {
        emitLog('log', '[Sycm] [调试] XHR open，URL 含 live: ' + (this._sycmUrl.length > 80 ? this._sycmUrl.slice(0, 80) + '...' : this._sycmUrl));
      }
      return XhrOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      var xhr = this;
      var hit = SOURCES.some(function (s) {
        return urlMatches(xhr._sycmUrl || '', s.urlContains) && (!s.urlFilter || s.urlFilter(xhr._sycmUrl));
      });
      if (hit) {
        emitLog('log', PREFIX + '[调试] 截获到 XHR 请求: ' + (xhr._sycmUrl.indexOf('live.json') !== -1 ? 'live.json' : xhr._sycmUrl.slice(0, 60)) + '...');
        xhr.addEventListener('load', function () {
          try {
            var data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
            var code = data && data.code;
            var inner = data && data.data && data.data.data;
            var list = inner && inner.data;
            var listLen = Array.isArray(list) ? list.length : (list ? '非数组' : '无');
            emitLog('log', PREFIX + '[调试] XHR 响应解析完成 code=' + code + ', data.data.data.data 长度=' + listLen);
            handleResponse(xhr._sycmUrl, data);
          } catch (e) { emitLog('warn', PREFIX + ' XHR 解析失败 ' + String(e)); }
        });
      }
      return XhrSend.apply(this, arguments);
    };

    var urls = SOURCES.map(function (s) { return s.urlContains; }).join(', ');
    emitLog('log', PREFIX + ' 已注入，监听: ' + urls);
  } catch (e) {
    emitLog('warn', PREFIX + ' 注入失败 ' + String(e));
  }
})();
