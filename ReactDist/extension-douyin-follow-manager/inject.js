(function() {
  "use strict";
  const DY_FOLLOW_RUNTIME = {
    GET_TAB_ID_MESSAGE: "DY_FOLLOW_GET_TAB_ID",
    FOLLOW_CAPTURE: "DY_FOLLOW_CAPTURE",
    POST_CAPTURE: "DY_FOLLOW_POST_CAPTURE",
    START_CRAWL: "DY_FOLLOW_START_CRAWL",
    STOP_CRAWL: "DY_FOLLOW_STOP_CRAWL",
    START_POST_CRAWL: "DY_FOLLOW_START_POST_CRAWL",
    STOP_POST_CRAWL: "DY_FOLLOW_STOP_POST_CRAWL",
    SET_POST_FILTER: "DY_FOLLOW_SET_POST_FILTER",
    EXPORT_POST_IMAGE_URLS: "DY_FOLLOW_EXPORT_POST_IMAGE_URLS",
    SCROLL_TICK: "DY_FOLLOW_SCROLL_TICK",
    POST_SCROLL_TICK: "DY_FOLLOW_POST_SCROLL_TICK",
    POST_MESSAGE_SOURCE: "dy-follow-extension"
  };
  function followingListHit(url) {
    return typeof url === "string" && url.includes("/aweme/v1/web/user/following/list/");
  }
  function postListHit(url) {
    return typeof url === "string" && url.includes("/aweme/v1/web/aweme/post/");
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
      return "";
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
          source: DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE,
          requestUrl,
          data
        },
        "*"
      );
    } catch {
    }
  }
  function initFollowInterceptor() {
    if (window.__dyFollowCaptureLoaded) {
      return;
    }
    window.__dyFollowCaptureLoaded = true;
    try {
      const rawFetch = window.fetch;
      if (rawFetch) {
        window.fetch = function fetchWithCapture() {
          const url = getUrl(arguments[0]);
          return rawFetch.apply(this, arguments).then((response) => {
            try {
              if (!followingListHit(url) && !postListHit(url)) {
                return response;
              }
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
                }).catch(() => {
                });
              });
            } catch {
            }
            return response;
          });
        };
      }
      const xhrOpen = XMLHttpRequest.prototype.open;
      const xhrSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function openWithCapture(method, url) {
        this._dyFollowUrl = resolveUrl(typeof url === "string" ? url : "");
        return xhrOpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function sendWithCapture() {
        const requestUrl = this._dyFollowUrl || "";
        if (followingListHit(requestUrl) || postListHit(requestUrl)) {
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
  initFollowInterceptor();
})();
//# sourceMappingURL=inject.js.map
