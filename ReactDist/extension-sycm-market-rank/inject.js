(function() {
  "use strict";
  const SYCM_RANK_RUNTIME = {
    GET_TAB_ID_MESSAGE: "SYCM_RANK_GET_TAB_ID",
    RANK_CAPTURE: "SYCM_RANK_CAPTURE",
    POST_MESSAGE_SOURCE: "sycm-rank-extension"
  };
  function rankJsonHit(url) {
    return typeof url === "string" && url.includes("/mc/mq/mkt/item/live/rank.json");
  }
  function resolveUrl(url) {
    if (!url || typeof url !== "string") {
      return "";
    }
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    try {
      return new URL(url, window.location.href).href;
    } catch {
      return url;
    }
  }
  function getUrl(input) {
    if (typeof input === "string") {
      return resolveUrl(input);
    }
    if (input && typeof input.url === "string") {
      return resolveUrl(input.url);
    }
    if (typeof Request !== "undefined" && input instanceof Request) {
      return resolveUrl(input.url);
    }
    return "";
  }
  function postToExtension(requestUrl, data) {
    try {
      window.postMessage(
        {
          source: SYCM_RANK_RUNTIME.POST_MESSAGE_SOURCE,
          requestUrl,
          data
        },
        "*"
      );
    } catch {
    }
  }
  function initRankInterceptor() {
    if (window.__sycmRankCaptureLoaded) {
      return;
    }
    window.__sycmRankCaptureLoaded = true;
    try {
      const rawFetch = window.fetch;
      if (rawFetch) {
        window.fetch = function fetchWithCapture() {
          const url = getUrl(arguments[0]);
          return rawFetch.apply(this, arguments).then((response) => {
            try {
              if (rankJsonHit(url)) {
                const clone1 = response.clone();
                const clone2 = response.clone();
                clone1.json().then((data) => {
                  postToExtension(url, data);
                }).catch(() => {
                  clone2.text().then((text) => {
                    try {
                      postToExtension(url, text ? JSON.parse(text) : null);
                    } catch {
                      postToExtension(url, {
                        _parseError: true,
                        _raw: String(text || "").slice(0, 500)
                      });
                    }
                  });
                });
              }
            } catch {
            }
            return response;
          });
        };
      }
      const xhrOpen = XMLHttpRequest.prototype.open;
      const xhrSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function openWithCapture(method, url) {
        this._sycmRankUrl = typeof url === "string" ? resolveUrl(url) : "";
        return xhrOpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function sendWithCapture() {
        const requestUrl = this._sycmRankUrl || "";
        if (rankJsonHit(requestUrl)) {
          this.addEventListener("load", () => {
            try {
              const data = this.responseText ? JSON.parse(this.responseText) : null;
              postToExtension(requestUrl, data);
            } catch {
              postToExtension(requestUrl, {
                _parseError: true,
                _raw: this.responseText ? String(this.responseText).slice(0, 500) : ""
              });
            }
          });
        }
        return xhrSend.apply(this, arguments);
      };
    } catch {
    }
  }
  initRankInterceptor();
})();
//# sourceMappingURL=inject.js.map
