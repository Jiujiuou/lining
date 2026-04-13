export function initFindPageCaptureInject() {
  if (globalThis.__LINING_AMCR_INJECT__) {
    return;
  }
  globalThis.__LINING_AMCR_INJECT__ = true;
  var FIND_PAGE_PATTERN = /\/campaign\/horizontal\/findPage(?:\.json)?(?:[/?#]|$)/i;

  function isFindPageUrl(url) {
    if (typeof url !== 'string') return false;
    return FIND_PAGE_PATTERN.test(url);
  }

  function logResponse(data, requestUrl) {
    try {
      try {
        console.debug('[AMCR][inject] 捕获到接口响应', {
          requestUrl: requestUrl || '',
          frameUrl: typeof window.location !== 'undefined' ? window.location.href : '',
        });
      } catch (e) {}
      window.postMessage({
        type: 'FIND_PAGE_CAPTURED',
        payload: data,
        requestUrl: requestUrl,
        pageUrl: typeof window.location !== 'undefined' ? window.location.href : ''
      }, '*');
    } catch (e) {
      try {
        console.warn('[AMCR][inject] postMessage 发送失败', e);
      } catch (ignore) {}
    }
  }

  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url);
      if (isFindPageUrl(url)) {
        var requestUrl = url;
        try {
          console.debug('[AMCR][inject] 命中 findPage 请求', requestUrl);
        } catch (e) {}
        return origFetch.apply(this, arguments).then(function (response) {
          var clone = response.clone();
          clone.json().then(function (data) { logResponse(data, requestUrl); }).catch(function () {
            clone.text().then(function (text) { logResponse(text, requestUrl); }).catch(function () {});
          });
          return response;
        }).catch(function (err) {
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
}

