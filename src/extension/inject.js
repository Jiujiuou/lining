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
  if (window.__sycmCaptureLoaded) return;
  window.__sycmCaptureLoaded = true;

  function emitLog(level, msg) {
    try {
      document.dispatchEvent(new CustomEvent('sycm-log', { detail: { level: level, msg: msg } }));
    } catch (err) { }
  }

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
      multiRows: !!p.multiRows
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
          emitLog('log', PREFIX + ' 捕获到数据');
          document.dispatchEvent(new CustomEvent(src.eventName, {
            detail: { payload: value, recordedAt: timeStr }
          }));
        } else {
          var num = Number(value);
          if (num !== num) num = value;
          emitLog('log', PREFIX + ' 捕获到数据');
          document.dispatchEvent(new CustomEvent(src.eventName, {
            detail: { value: num, recordedAt: timeStr }
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
      return origFetch.apply(this, args).then(function (res) {
        try {
          var hit = SOURCES.some(function (s) {
            return url.indexOf(s.urlContains) !== -1 && (!s.urlFilter || s.urlFilter(url));
          });
          if (hit) {
            res.clone().json().then(
              function (data) { handleResponse(url, data); },
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
            var data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
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
