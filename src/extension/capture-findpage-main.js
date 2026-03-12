/**
 * 在「页面主世界」执行的 findPage 拦截逻辑（由 capture-findpage.js 注入）
 * 必须与页面共享同一 window 才能拦到 merge.js / XHR
 */
(function () {
  var FIND_PAGE_PATTERN = '/campaign/horizontal/findPage.json';
  var LOG_PREFIX = '[扩展] findPage.json';

  function isFindPageUrl(url) {
    if (typeof url !== 'string') return false;
    return url.indexOf(FIND_PAGE_PATTERN) !== -1 || url.indexOf('findPage.json') !== -1;
  }

  function logResponse(data, requestUrl) {
    try {
      if (requestUrl) console.log(LOG_PREFIX + ' 请求:', requestUrl);
      console.log(LOG_PREFIX + ' 响应:', data);
      if (data && typeof data === 'object') {
        console.log(LOG_PREFIX + ' 响应 JSON:', JSON.stringify(data, null, 2));
      }
      try {
        window.postMessage({
          type: 'FIND_PAGE_CAPTURED',
          payload: data,
          requestUrl: requestUrl,
          pageUrl: typeof window.location !== 'undefined' ? window.location.href : ''
        }, '*');
      } catch (e) { /* ignore */ }
    } catch (e) {
      console.warn(LOG_PREFIX + ' 打印失败', e);
    }
  }

  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url);
      if (isFindPageUrl(url)) {
        var requestUrl = url;
        console.log(LOG_PREFIX + ' 拦截到请求 (fetch):', requestUrl);
        return origFetch.apply(this, arguments).then(function (response) {
          var clone = response.clone();
          clone.json().then(function (data) { logResponse(data, requestUrl); }).catch(function () {
            clone.text().then(function (text) { logResponse(text, requestUrl); }).catch(function () {});
          });
          return response;
        }).catch(function (err) {
          console.warn(LOG_PREFIX + ' 请求失败', err);
          throw err;
        });
      }
      return origFetch.apply(this, arguments);
    };
  }

  var OrigXHR = window.XMLHttpRequest;
  if (OrigXHR) {
    var origOpen = OrigXHR.prototype.open;
    OrigXHR.prototype.open = function (method, url) {
      this._findPageUrl = isFindPageUrl(url);
      if (this._findPageUrl) {
        this._findPageRequestUrl = url;
        console.log(LOG_PREFIX + ' 拦截到请求 (XHR):', url);
      }
      return origOpen.apply(this, arguments);
    };
    var origSend = OrigXHR.prototype.send;
    OrigXHR.prototype.send = function () {
      var xhr = this;
      if (xhr._findPageUrl) {
        xhr.addEventListener('load', function () {
          if (xhr.responseText) {
            try {
              var data = JSON.parse(xhr.responseText);
              logResponse(data, xhr._findPageRequestUrl || xhr.responseURL || undefined);
            } catch (e) {
              logResponse(xhr.responseText, xhr._findPageRequestUrl || xhr.responseURL);
            }
          }
        });
      }
      return origSend.apply(this, arguments);
    };
  }
  console.log(LOG_PREFIX + ' 监听已注入（主世界）');
})();
