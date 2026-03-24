/**
 * 页面主世界：劫持 fetch / XHR，命中 live/rank.json 后通过 window.postMessage 传给 content（隔离环境与 CustomEvent 不可靠）。
 */
(function () {
  var MSG_SOURCE = 'sycm-rank-extension';
  function rankJsonHit(url) {
    return typeof url === 'string' && url.indexOf('/mc/mq/mkt/item/live/rank.json') !== -1;
  }
  if (window.__sycmRankCaptureLoaded) return;
  window.__sycmRankCaptureLoaded = true;

  function resolveUrl(url) {
    if (!url || typeof url !== 'string') return '';
    if (/^https?:\/\//i.test(url)) return url;
    try {
      return new URL(url, window.location.href).href;
    } catch (e) {
      return url;
    }
  }

  function getUrl(input) {
    if (typeof input === 'string') return resolveUrl(input);
    if (input && typeof input.url === 'string') return resolveUrl(input.url);
    if (typeof Request !== 'undefined' && input instanceof Request) return resolveUrl(input.url);
    return '';
  }

  function postToExtension(requestUrl, data) {
    try {
      window.postMessage(
        {
          source: MSG_SOURCE,
          requestUrl: requestUrl,
          data: data
        },
        '*'
      );
    } catch (e) {}
  }

  function handleJsonBody(requestUrl, data) {
    postToExtension(requestUrl, data);
  }

  try {
    var origFetch = window.fetch;
    window.fetch = function () {
      var url = getUrl(arguments[0]);
      return origFetch.apply(this, arguments).then(function (res) {
        try {
          if (rankJsonHit(url)) {
            var c1 = res.clone();
            var c2 = res.clone();
            c1
              .json()
              .then(function (data) {
                handleJsonBody(url, data);
              })
              .catch(function () {
                return c2.text().then(function (text) {
                  try {
                    handleJsonBody(url, text ? JSON.parse(text) : null);
                  } catch (e2) {
                    postToExtension(url, { _parseError: true, _raw: String(text).slice(0, 500) });
                  }
                });
              });
          }
        } catch (e) {}
        return res;
      });
    };

    var XhrOpen = XMLHttpRequest.prototype.open;
    var XhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      var u = typeof url === 'string' ? resolveUrl(url) : '';
      this._sycmRankUrl = u;
      return XhrOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      var xhr = this;
      var u = xhr._sycmRankUrl || '';
      if (rankJsonHit(u)) {
        xhr.addEventListener('load', function () {
          try {
            var data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
            handleJsonBody(u, data);
          } catch (e) {
            postToExtension(u, { _parseError: true, _raw: xhr.responseText ? String(xhr.responseText).slice(0, 500) : '' });
          }
        });
      }
      return XhrSend.apply(this, arguments);
    };
  } catch (e) {}
})();
