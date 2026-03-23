/**
 * 页面主世界：劫持 fetch/XHR，命中 rank.json 后派发事件；detail 含 requestUrl 供 content 解析 keyWord。
 */
(function () {
  function emitLog(level, msg) {
    try {
      document.dispatchEvent(new CustomEvent('sycm-rank-log', { detail: { level: level, msg: msg } }));
    } catch (err) {}
  }
  if (window.__sycmRankCaptureLoaded) {
    emitLog('warn', '[排名采集] inject 跳过：已加载过');
    return;
  }
  window.__sycmRankCaptureLoaded = true;
  emitLog('log', '[排名采集] inject 已执行，监听 rank.json');

  try {
    Object.defineProperty(document, 'hidden', { get: function () { return false; }, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: function () { return 'visible'; }, configurable: true });
  } catch (e) {
    emitLog('warn', '[排名采集] 伪造 visibility 失败: ' + String(e));
  }

  var config = typeof window !== 'undefined' && window.__SYCM_RANK_CONFIG__ ? window.__SYCM_RANK_CONFIG__ : null;
  var pipelines = config && config.pipelines && config.pipelines.length ? config.pipelines : [];

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
    var pad = function (n) {
      return (n < 10 ? '0' : '') + n;
    };
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
    return url.indexOf(urlContains) !== -1;
  }

  function handleResponse(url, data) {
    var timeStr = getEast8TimeStr();
    for (var i = 0; i < SOURCES.length; i++) {
      var src = SOURCES[i];
      if (!urlMatches(url, src.urlContains)) continue;
      if (src.urlFilter && !src.urlFilter(url)) continue;
      try {
        var value = src.extractValue(data);
        if (value === undefined) {
          var inner = data && data.data && data.data.data;
          var list = inner && inner.data;
          var listLen = Array.isArray(list) ? list.length : list ? '非数组' : '无';
          emitLog('warn', '[' + src.eventName + '] 解析无数据 code=' + (data && data.code) + ' 条数=' + listLen);
          return;
        }
        var itemId = src.mergeGoodsDetail ? null : null;
        if (src.multiValue && value && typeof value === 'object') {
          document.dispatchEvent(
            new CustomEvent(src.eventName, {
              detail: { payload: value, recordedAt: timeStr, itemId: itemId || undefined, requestUrl: url }
            })
          );
        } else {
          var num = Number(value);
          if (num !== num) num = value;
          document.dispatchEvent(
            new CustomEvent(src.eventName, {
              detail: { value: num, recordedAt: timeStr, itemId: itemId || undefined, requestUrl: url }
            })
          );
        }
      } catch (e) {
        emitLog('warn', '处理 ' + src.eventName + ' 失败 ' + String(e));
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
            return urlMatches(url, s.urlContains) && (!s.urlFilter || s.urlFilter(url));
          });
          if (hit) {
            res.clone().json().then(
              function (data) {
                handleResponse(url, data);
              },
              function (err) {
                emitLog('warn', '解析失败 ' + url + ' ' + String(err));
              }
            );
          }
        } catch (e) {
          emitLog('warn', '处理响应时出错 ' + String(e));
        }
        return res;
      });
    };

    var XhrOpen = XMLHttpRequest.prototype.open;
    var XhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this._sycmRankUrl = typeof url === 'string' ? url : '';
      return XhrOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      var xhr = this;
      var hit = SOURCES.some(function (s) {
        return urlMatches(xhr._sycmRankUrl || '', s.urlContains) && (!s.urlFilter || s.urlFilter(xhr._sycmRankUrl));
      });
      if (hit) {
        xhr.addEventListener('load', function () {
          try {
            var data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
            handleResponse(xhr._sycmRankUrl, data);
          } catch (e) {
            emitLog('warn', 'XHR 解析失败 ' + String(e));
          }
        });
      }
      return XhrSend.apply(this, arguments);
    };

    var urls = SOURCES.map(function (s) {
      return s.urlContains;
    }).join(', ');
    emitLog('log', '已注入，监听: ' + urls);
  } catch (e) {
    emitLog('warn', '注入失败 ' + String(e));
  }
})();
