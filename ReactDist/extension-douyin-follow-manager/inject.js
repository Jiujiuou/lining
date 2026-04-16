(function() {
  "use strict";
  const DY_FOLLOW_RUNTIME = {
    GET_TAB_ID_MESSAGE: "DY_FOLLOW_GET_TAB_ID",
    FOLLOW_CAPTURE: "DY_FOLLOW_CAPTURE",
    POST_CAPTURE: "DY_FOLLOW_POST_CAPTURE",
    START_CRAWL: "DY_FOLLOW_START_CRAWL",
    STOP_CRAWL: "DY_FOLLOW_STOP_CRAWL",
    BOOTSTRAP_FOLLOW_CAPTURE: "DY_FOLLOW_BOOTSTRAP_FOLLOW_CAPTURE",
    START_POST_CRAWL: "DY_FOLLOW_START_POST_CRAWL",
    STOP_POST_CRAWL: "DY_FOLLOW_STOP_POST_CRAWL",
    SET_POST_FILTER: "DY_FOLLOW_SET_POST_FILTER",
    EXPORT_POST_IMAGE_URLS: "DY_FOLLOW_EXPORT_POST_IMAGE_URLS",
    SCROLL_TICK: "DY_FOLLOW_SCROLL_TICK",
    POST_SCROLL_TICK: "DY_FOLLOW_POST_SCROLL_TICK",
    BOOTSTRAP_POST_CAPTURE: "DY_FOLLOW_BOOTSTRAP_POST_CAPTURE",
    BOOTSTRAP_POST_CAPTURE_FALLBACK: "DY_FOLLOW_BOOTSTRAP_POST_CAPTURE_FALLBACK",
    BOOTSTRAP_POST_CAPTURE_RESULT: "DY_FOLLOW_BOOTSTRAP_POST_CAPTURE_RESULT",
    POST_BOOTSTRAP_STATUS: "DY_FOLLOW_POST_BOOTSTRAP_STATUS",
    GET_PAGE_CONTEXT: "DY_FOLLOW_GET_PAGE_CONTEXT",
    POST_MESSAGE_SOURCE: "dy-follow-extension"
  };
  function followingListHit(url) {
    if (typeof url !== "string") {
      return false;
    }
    return /\/aweme\/v1\/web\/user\/following\/list(?:\/|\?|$)/i.test(url);
  }
  function postListHit(url) {
    if (typeof url !== "string") {
      return false;
    }
    return /\/aweme\/v1\/web\/aweme\/post(?:\/|\?|$)/i.test(url);
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
  function isValidPostResponse(data) {
    if (!data || typeof data !== "object") {
      return false;
    }
    if (Number(data.status_code) !== 0) {
      return false;
    }
    return Array.isArray(data.aweme_list);
  }
  function getSecUidFromPath() {
    const match = String(window.location.pathname || "").match(/\/user\/([^/?#]+)/);
    return match && match[1] ? String(match[1]) : "";
  }
  function pickPostApiUrl(secUid) {
    const uid = String(secUid || "").trim();
    const entries = performance.getEntriesByType("resource");
    const candidates = [];
    for (let i = 0; i < entries.length; i += 1) {
      const name = entries[i] && entries[i].name ? String(entries[i].name) : "";
      if (!name.includes("/aweme/v1/web/aweme/post/")) {
        continue;
      }
      if (uid && !name.includes(`sec_user_id=${encodeURIComponent(uid)}`) && !name.includes(`sec_user_id=${uid}`)) {
        continue;
      }
      candidates.push(name);
    }
    if (candidates.length === 0) {
      return "";
    }
    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      if (candidates[i].includes("max_cursor=0")) {
        return candidates[i];
      }
    }
    return candidates[candidates.length - 1];
  }
  function makeBootstrapPostUrl(secUid) {
    const sid = encodeURIComponent(String(secUid || ""));
    return `https://www-hj.douyin.com/aweme/v1/web/aweme/post/?sec_user_id=${sid}&max_cursor=0&count=18`;
  }
  function findAwemeStateInObject(root) {
    if (!root || typeof root !== "object") {
      return null;
    }
    const queue = [{ node: root, depth: 0 }];
    const seen = /* @__PURE__ */ new WeakSet();
    while (queue.length > 0) {
      const item = queue.shift();
      const node = item.node;
      const depth = item.depth;
      if (!node || typeof node !== "object") {
        continue;
      }
      if (seen.has(node)) {
        continue;
      }
      seen.add(node);
      try {
        const awemeList = Array.isArray(node.aweme_list) ? node.aweme_list : null;
        if (awemeList && awemeList.length > 0) {
          const first = awemeList[0] || {};
          if (first.aweme_id != null || first.images || first.video) {
            return {
              aweme_list: awemeList,
              has_more: node.has_more != null ? node.has_more : false,
              max_cursor: node.max_cursor != null ? node.max_cursor : 0,
              min_cursor: node.min_cursor != null ? node.min_cursor : 0,
              total: node.total != null ? node.total : awemeList.length
            };
          }
        }
      } catch {
      }
      if (depth >= 3) {
        continue;
      }
      let keys = [];
      try {
        keys = Object.keys(node);
      } catch {
        keys = [];
      }
      for (let i = 0; i < keys.length && i < 80; i += 1) {
        const key = keys[i];
        if (!key) {
          continue;
        }
        let value;
        try {
          value = node[key];
        } catch {
          continue;
        }
        if (value && typeof value === "object") {
          queue.push({ node: value, depth: depth + 1 });
        }
      }
    }
    return null;
  }
  function bootstrapPostCaptureFromWindowState(secUid) {
    const roots = [
      window.__INITIAL_STATE__,
      window.__NEXT_DATA__,
      window.SIGI_STATE,
      window.__ROUTER_DATA__,
      window
    ];
    for (let i = 0; i < roots.length; i += 1) {
      const picked = findAwemeStateInObject(roots[i]);
      if (!picked) {
        continue;
      }
      postToExtension(makeBootstrapPostUrl(secUid), {
        status_code: 0,
        ...picked
      });
      return true;
    }
    return false;
  }
  function bootstrapPostCapture() {
    const secUid = getSecUidFromPath();
    const url = pickPostApiUrl(secUid);
    if (!url) {
      const ok = bootstrapPostCaptureFromWindowState(secUid);
      if (ok) {
        window.postMessage(
          {
            source: DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE,
            type: DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE_RESULT,
            ok: true,
            secUid,
            mode: "window_state"
          },
          "*"
        );
        return;
      }
      window.postMessage(
        {
          source: DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE,
          type: DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE_RESULT,
          ok: false,
          reason: "post_api_url_not_found"
        },
        "*"
      );
      return;
    }
    fetch(url, { credentials: "include" }).then((resp) => resp.json()).then((data) => {
      if (!isValidPostResponse(data)) {
        const ok = bootstrapPostCaptureFromWindowState(secUid);
        if (ok) {
          window.postMessage(
            {
              source: DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE,
              type: DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE_RESULT,
              ok: true,
              secUid,
              mode: "window_state"
            },
            "*"
          );
          return;
        }
        window.postMessage(
          {
            source: DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE,
            type: DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE_RESULT,
            ok: false,
            reason: `invalid_post_response_status_${String(data && data.status_code != null ? data.status_code : "unknown")}`,
            secUid,
            mode: "request"
          },
          "*"
        );
        return;
      }
      postToExtension(url, data);
      window.postMessage(
        {
          source: DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE,
          type: DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE_RESULT,
          ok: true,
          secUid
        },
        "*"
      );
    }).catch((error) => {
      const ok = bootstrapPostCaptureFromWindowState(secUid);
      if (ok) {
        window.postMessage(
          {
            source: DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE,
            type: DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE_RESULT,
            ok: true,
            secUid,
            mode: "window_state"
          },
          "*"
        );
        return;
      }
      window.postMessage(
        {
          source: DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE,
          type: DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE_RESULT,
          ok: false,
          reason: String(error || "bootstrap_fetch_failed"),
          secUid
        },
        "*"
      );
    });
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
      window.addEventListener("message", (event) => {
        const payload = event && event.data ? event.data : null;
        if (!payload || payload.source !== DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE) {
          return;
        }
        if (payload.type === DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE) {
          bootstrapPostCapture();
        }
      });
    } catch {
    }
  }
  initFollowInterceptor();
})();
//# sourceMappingURL=inject.js.map
