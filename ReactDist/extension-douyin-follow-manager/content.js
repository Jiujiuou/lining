(function() {
  "use strict";
  function hasRuntime() {
    return typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.sendMessage === "function";
  }
  function sendRuntimeMessage(message, callback) {
    const done = typeof callback === "function" ? callback : null;
    if (!hasRuntime()) {
      if (done) {
        done(null, new Error("chrome.runtime 不可用"));
      }
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const lastError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError : null;
        if (done) {
          done(response ?? null, lastError ?? null);
        }
      });
    } catch (error) {
      if (done) {
        done(null, error);
      }
    }
  }
  const DY_FOLLOW_RUNTIME = {
    GET_TAB_ID_MESSAGE: "DY_FOLLOW_GET_TAB_ID",
    FOLLOW_CAPTURE: "DY_FOLLOW_CAPTURE",
    START_CRAWL: "DY_FOLLOW_START_CRAWL",
    STOP_CRAWL: "DY_FOLLOW_STOP_CRAWL",
    SCROLL_TICK: "DY_FOLLOW_SCROLL_TICK",
    POST_MESSAGE_SOURCE: "dy-follow-extension"
  };
  const DY_FOLLOW_PREFIX = "[抖音关注管理]";
  function injectMainScript() {
    try {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("inject.js");
      script.onload = function onLoad() {
        this.remove();
      };
      (document.head || document.documentElement).appendChild(script);
    } catch {
    }
  }
  function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function parseOffsetFromUrl(requestUrl) {
    try {
      const url = new URL(requestUrl);
      return toNumber(url.searchParams.get("offset"));
    } catch {
      return null;
    }
  }
  function parseFollowings(data) {
    if (!data || data.status_code !== 0) {
      return null;
    }
    const list = Array.isArray(data.followings) ? data.followings : [];
    const users = [];
    for (let i = 0; i < list.length; i += 1) {
      const row = list[i] || {};
      const uid = row.uid != null ? String(row.uid) : "";
      const secUid = row.sec_uid != null ? String(row.sec_uid) : "";
      if (!uid && !secUid) {
        continue;
      }
      const avatar = row.avatar_168x168 && Array.isArray(row.avatar_168x168.url_list) && row.avatar_168x168.url_list[0] ? String(row.avatar_168x168.url_list[0]) : "";
      users.push({
        uid,
        secUid,
        nickname: row.nickname != null ? String(row.nickname) : "",
        signature: row.signature != null ? String(row.signature) : "",
        avatar,
        followerCount: toNumber(row.follower_count),
        awemeCount: toNumber(row.aweme_count),
        totalFavorited: toNumber(row.total_favorited),
        isVerified: Boolean(row.is_verified),
        verificationType: toNumber(row.verification_type)
      });
    }
    return {
      users,
      hasMore: Boolean(data.has_more),
      total: toNumber(data.total),
      nextOffset: toNumber(data.offset)
    };
  }
  function sendCaptureToBackground(payload, meta) {
    sendRuntimeMessage(
      {
        type: DY_FOLLOW_RUNTIME.FOLLOW_CAPTURE,
        payload,
        meta: meta || null
      },
      () => {
      }
    );
  }
  function handleCapture(requestUrl, data) {
    if (!data || data._parseError) {
      sendCaptureToBackground(null, {
        parseError: "接口响应解析失败",
        requestUrl
      });
      return;
    }
    const parsed = parseFollowings(data);
    if (!parsed) {
      sendCaptureToBackground(null, {
        parseError: `status_code=${data && data.status_code != null ? data.status_code : "?"}`,
        requestUrl
      });
      return;
    }
    sendCaptureToBackground(
      {
        ...parsed,
        requestUrl,
        requestOffset: parseOffsetFromUrl(requestUrl),
        capturedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      null
    );
    console.log(
      DY_FOLLOW_PREFIX,
      `捕获关注分页：${parsed.users.length} 条，hasMore=${String(parsed.hasMore)}，nextOffset=${String(parsed.nextOffset)}`
    );
  }
  function onWindowMessage(event) {
    if (!event.data || event.data.source !== DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE) {
      return;
    }
    const requestUrl = event.data.requestUrl ? String(event.data.requestUrl) : "";
    handleCapture(requestUrl, event.data.data);
  }
  function initFollowContentCapture() {
    window.addEventListener("message", onWindowMessage);
    injectMainScript();
  }
  const state = {
    timer: null,
    ticks: 0
  };
  function findScrollContainer() {
    function isScrollable(node) {
      if (!node) {
        return false;
      }
      try {
        return node.scrollHeight - node.clientHeight > 8;
      } catch {
        return false;
      }
    }
    const candidates = [
      document.querySelector(".FjupSA6k"),
      document.querySelector('[data-e2e="user-fans-container"]'),
      document.querySelector(".i5YKH7Ag"),
      document.querySelector("body > div:nth-child(179) > div > div > div.MryVEcQW > div > div"),
      document.querySelector('[data-e2e="user-following-list"]'),
      document.querySelector(".MryVEcQW .i5YKH7Ag"),
      document.querySelector("main"),
      document.scrollingElement
    ].filter(Boolean);
    for (let i = 0; i < candidates.length; i += 1) {
      if (isScrollable(candidates[i])) {
        return candidates[i];
      }
    }
    return candidates[0] || document.scrollingElement || document.documentElement;
  }
  function startScroll() {
    if (state.timer) {
      return;
    }
    const container = findScrollContainer();
    state.ticks = 0;
    state.timer = setInterval(() => {
      try {
        if (!container) {
          return;
        }
        state.ticks += 1;
        if (container === document.scrollingElement || container === document.documentElement) {
          window.scrollTo(0, document.body.scrollHeight);
        } else {
          container.scrollTop = container.scrollHeight;
        }
        chrome.runtime.sendMessage({
          type: DY_FOLLOW_RUNTIME.SCROLL_TICK,
          payload: {
            ticks: state.ticks,
            href: window.location.href,
            sentAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        });
      } catch {
      }
    }, 900);
    console.log(DY_FOLLOW_PREFIX, "已开始自动滚动采集");
  }
  function stopScroll() {
    if (!state.timer) {
      return;
    }
    clearInterval(state.timer);
    state.timer = null;
    chrome.runtime.sendMessage({
      type: DY_FOLLOW_RUNTIME.SCROLL_TICK,
      payload: {
        ticks: state.ticks,
        href: window.location.href,
        sentAt: (/* @__PURE__ */ new Date()).toISOString(),
        stopped: true
      }
    });
    console.log(DY_FOLLOW_PREFIX, "已停止自动滚动采集");
  }
  function initFollowAutoScroller() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || !message.type) {
        return false;
      }
      if (message.type === DY_FOLLOW_RUNTIME.START_CRAWL) {
        startScroll();
        sendResponse({ ok: true });
        return true;
      }
      if (message.type === DY_FOLLOW_RUNTIME.STOP_CRAWL) {
        stopScroll();
        sendResponse({ ok: true });
        return true;
      }
      return false;
    });
  }
  initFollowContentCapture();
  initFollowAutoScroller();
})();
//# sourceMappingURL=content.js.map
