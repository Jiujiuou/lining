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
  const DY_FOLLOW_STORAGE_KEYS = {
    postSnapshotBySecUid: "dy_follow_post_snapshot_by_sec_uid"
  };
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
  function parseMaxCursorFromUrl(requestUrl) {
    try {
      const url = new URL(requestUrl);
      return toNumber(url.searchParams.get("max_cursor"));
    } catch {
      return null;
    }
  }
  function parseSecUserIdFromUrl(requestUrl) {
    try {
      const url = new URL(requestUrl);
      const secUid = url.searchParams.get("sec_user_id");
      return secUid ? String(secUid) : "";
    } catch {
      return "";
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
        followingCount: toNumber(row.following_count),
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
  function resolvePostType(aweme) {
    const row = aweme || {};
    const images = Array.isArray(row.images) ? row.images : [];
    if (images.length > 0) {
      return "image";
    }
    if (row.video && typeof row.video === "object") {
      return "video";
    }
    if (toNumber(row.aweme_type) === 68) {
      return "image";
    }
    return "unknown";
  }
  function pickImageUrlList(image) {
    const row = image || {};
    const downloadList = Array.isArray(row.download_url_list) ? row.download_url_list : [];
    const normalList = Array.isArray(row.url_list) ? row.url_list : [];
    return {
      downloadUrlList: downloadList.map((item) => String(item || "")).filter(Boolean),
      urlList: normalList.map((item) => String(item || "")).filter(Boolean)
    };
  }
  function parsePosts(data) {
    if (!data || data.status_code !== 0) {
      return null;
    }
    const list = Array.isArray(data.aweme_list) ? data.aweme_list : [];
    const posts = [];
    for (let i = 0; i < list.length; i += 1) {
      const row = list[i] || {};
      const awemeId = row.aweme_id != null ? String(row.aweme_id) : "";
      if (!awemeId) {
        continue;
      }
      const postType = resolvePostType(row);
      const imagesRaw = Array.isArray(row.images) ? row.images : [];
      const images = imagesRaw.map((image) => {
        const urls = pickImageUrlList(image);
        return {
          uri: image && image.uri != null ? String(image.uri) : "",
          width: toNumber(image && image.width),
          height: toNumber(image && image.height),
          ...urls
        };
      });
      posts.push({
        awemeId,
        desc: row.desc != null ? String(row.desc) : "",
        authorNickname: row && row.author && row.author.nickname != null ? String(row.author.nickname) : "",
        createTime: toNumber(row.create_time),
        awemeType: toNumber(row.aweme_type),
        postType,
        imageCount: images.length,
        images,
        diggCount: toNumber(row.statistics && row.statistics.digg_count),
        commentCount: toNumber(row.statistics && row.statistics.comment_count),
        shareCount: toNumber(row.statistics && row.statistics.share_count),
        collectCount: toNumber(row.statistics && row.statistics.collect_count),
        playCount: toNumber(row.statistics && row.statistics.play_count)
      });
    }
    return {
      posts,
      hasMore: Boolean(data.has_more),
      maxCursor: toNumber(data.max_cursor),
      minCursor: toNumber(data.min_cursor),
      total: toNumber(data.total)
    };
  }
  function sendCaptureToBackground(type, payload, meta) {
    sendRuntimeMessage(
      {
        type,
        payload,
        meta: meta || null
      },
      () => {
      }
    );
  }
  function handleFollowingCapture(requestUrl, data) {
    if (!data || data._parseError) {
      sendCaptureToBackground(DY_FOLLOW_RUNTIME.FOLLOW_CAPTURE, null, {
        parseError: "关注接口响应解析失败",
        requestUrl
      });
      return;
    }
    const parsed = parseFollowings(data);
    if (!parsed) {
      sendCaptureToBackground(DY_FOLLOW_RUNTIME.FOLLOW_CAPTURE, null, {
        parseError: `status_code=${data && data.status_code != null ? data.status_code : "?"}`,
        requestUrl
      });
      return;
    }
    sendCaptureToBackground(
      DY_FOLLOW_RUNTIME.FOLLOW_CAPTURE,
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
  function handlePostCapture(requestUrl, data) {
    if (!data || data._parseError) {
      sendCaptureToBackground(DY_FOLLOW_RUNTIME.POST_CAPTURE, null, {
        parseError: "作品接口响应解析失败",
        requestUrl
      });
      return;
    }
    const parsed = parsePosts(data);
    if (!parsed) {
      sendCaptureToBackground(DY_FOLLOW_RUNTIME.POST_CAPTURE, null, {
        parseError: `status_code=${data && data.status_code != null ? data.status_code : "?"}`,
        requestUrl
      });
      return;
    }
    let imageCount = 0;
    let videoCount = 0;
    for (let i = 0; i < parsed.posts.length; i += 1) {
      if (parsed.posts[i].postType === "image") {
        imageCount += 1;
      } else if (parsed.posts[i].postType === "video") {
        videoCount += 1;
      }
    }
    sendCaptureToBackground(
      DY_FOLLOW_RUNTIME.POST_CAPTURE,
      {
        ...parsed,
        requestUrl,
        secUid: parseSecUserIdFromUrl(requestUrl),
        requestCursor: parseMaxCursorFromUrl(requestUrl),
        capturedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      null
    );
    console.log(
      DY_FOLLOW_PREFIX,
      `捕获作品分页：${parsed.posts.length} 条，图文=${imageCount}，视频=${videoCount}，hasMore=${String(parsed.hasMore)}，maxCursor=${String(parsed.maxCursor)}`
    );
  }
  function onWindowMessage(event) {
    if (!event.data || event.data.source !== DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE) {
      return;
    }
    const requestUrl = event.data.requestUrl ? String(event.data.requestUrl) : "";
    if (requestUrl.includes("/aweme/v1/web/user/following/list/")) {
      handleFollowingCapture(requestUrl, event.data.data);
      return;
    }
    if (requestUrl.includes("/aweme/v1/web/aweme/post/")) {
      handlePostCapture(requestUrl, event.data.data);
    }
  }
  function initFollowContentCapture() {
    window.addEventListener("message", onWindowMessage);
    injectMainScript();
  }
  const state = {
    timer: null,
    ticks: 0,
    mode: "follow",
    stagnantTicks: 0,
    prevScrollTop: 0,
    prevScrollHeight: 0
  };
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
  function findScrollableAncestor(startNode) {
    let current = startNode;
    while (current && current !== document.body && current !== document.documentElement) {
      if (isScrollable(current)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }
  function findFollowScrollContainer() {
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
  function collectPostCandidates() {
    const scrollList = document.querySelector('[data-e2e="scroll-list"]');
    const scrollListParent = scrollList ? findScrollableAncestor(scrollList) : null;
    const allNodes = Array.from(document.querySelectorAll("div[class], ul[class], main, section"));
    const classMatched = allNodes.filter((node) => {
      const cls = String(node.className || "");
      return cls.includes("pCVdP6Bb") || cls.includes("T9ZSs8iN") || cls.includes("route-scroll-container") || cls.includes("IHrj7RhK") || cls.includes("U9C7HmQ0");
    });
    return [
      scrollListParent,
      scrollList,
      document.querySelector(".pCVdP6Bb.T9ZSs8iN"),
      document.querySelector('[data-e2e="user-post-list"]'),
      document.querySelector('[data-e2e="user-post-item-list"]'),
      document.querySelector(".route-scroll-container"),
      ...classMatched,
      document.querySelector("main"),
      document.scrollingElement
    ].filter(Boolean);
  }
  function findPostScrollContainer() {
    const candidates = collectPostCandidates();
    for (let i = 0; i < candidates.length; i += 1) {
      if (isScrollable(candidates[i])) {
        return candidates[i];
      }
    }
    return candidates[0] || document.scrollingElement || document.documentElement;
  }
  function getCurrentSecUid() {
    const match = String(window.location.pathname || "").match(/\/user\/([^/?]+)/);
    return match && match[1] ? String(match[1]) : "";
  }
  function extractAwemeIdFromLi(li) {
    if (!li) {
      return "";
    }
    const anchors = Array.from(li.querySelectorAll("a[href]"));
    for (let i = 0; i < anchors.length; i += 1) {
      const href = String(anchors[i].getAttribute("href") || "");
      const m2 = href.match(/\/(video|note)\/(\d+)/);
      if (m2 && m2[2]) {
        return String(m2[2]);
      }
    }
    const html = li.outerHTML || "";
    const m = html.match(/"aweme_id"\s*:\s*"(\d+)"|aweme_id=(\d+)|\/(video|note)\/(\d+)/);
    return m ? String(m[1] || m[2] || m[4] || "") : "";
  }
  function readPostTypeMap(secUid) {
    return new Promise((resolve) => {
      if (!secUid) {
        resolve(/* @__PURE__ */ new Map());
        return;
      }
      chrome.storage.local.get([DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid], (result) => {
        const bySecUid = result && result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid] && typeof result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid] === "object" ? result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid] : {};
        const snapshot = bySecUid[secUid] && typeof bySecUid[secUid] === "object" ? bySecUid[secUid] : {};
        const posts = Array.isArray(snapshot.posts) ? snapshot.posts : [];
        const map = /* @__PURE__ */ new Map();
        for (let i = 0; i < posts.length; i += 1) {
          const row = posts[i] || {};
          const awemeId = row.awemeId != null ? String(row.awemeId) : "";
          const type = row.postType != null ? String(row.postType) : "";
          if (awemeId && (type === "video" || type === "image")) {
            map.set(awemeId, type);
          }
        }
        resolve(map);
      });
    });
  }
  async function applyPostFilter(mode) {
    const list = document.querySelector('[data-e2e="scroll-list"]');
    if (!list) {
      return { ok: false, reason: "scroll_list_not_found" };
    }
    const secUid = getCurrentSecUid();
    const typeMap = await readPostTypeMap(secUid);
    const items = Array.from(list.querySelectorAll("li"));
    if (items.length === 0) {
      return { ok: false, reason: "no_li_item" };
    }
    let show = 0;
    let hit = 0;
    for (let i = 0; i < items.length; i += 1) {
      const li = items[i];
      const awemeId = extractAwemeIdFromLi(li);
      const kind = awemeId ? typeMap.get(awemeId) : "";
      li.style.display = "";
      if (mode === "all") {
        show += 1;
        continue;
      }
      if (kind === "video" || kind === "image") {
        hit += 1;
        if (kind === mode) {
          show += 1;
        } else {
          li.style.display = "none";
        }
      } else {
        show += 1;
      }
    }
    return {
      ok: true,
      total: items.length,
      show,
      hit,
      secUid,
      mode
    };
  }
  function startScroll(mode) {
    if (state.timer) {
      return;
    }
    const isPostMode = mode === "post";
    const container = isPostMode ? findPostScrollContainer() : findFollowScrollContainer();
    state.mode = isPostMode ? "post" : "follow";
    state.ticks = 0;
    state.stagnantTicks = 0;
    state.prevScrollTop = 0;
    state.prevScrollHeight = 0;
    if (isPostMode) {
      const className = container && container.className ? String(container.className) : "(无 class)";
      console.log(DY_FOLLOW_PREFIX, `作品滚动容器已选定: ${className}`);
    }
    state.timer = setInterval(() => {
      try {
        if (!container) {
          return;
        }
        state.ticks += 1;
        const isWindowScroller = container === document.scrollingElement || container === document.documentElement;
        if (isWindowScroller) {
          window.scrollTo(0, document.body.scrollHeight);
        } else {
          container.scrollTop = container.scrollHeight;
        }
        if (isPostMode) {
          const currentTop = isWindowScroller ? Number(window.scrollY || document.documentElement.scrollTop || 0) : Number(container.scrollTop || 0);
          const currentHeight = isWindowScroller ? Number(document.body.scrollHeight || document.documentElement.scrollHeight || 0) : Number(container.scrollHeight || 0);
          const changed = Math.abs(currentTop - state.prevScrollTop) > 1 || Math.abs(currentHeight - state.prevScrollHeight) > 1;
          if (changed) {
            state.stagnantTicks = 0;
          } else {
            state.stagnantTicks += 1;
          }
          state.prevScrollTop = currentTop;
          state.prevScrollHeight = currentHeight;
          if (state.stagnantTicks >= 8) {
            stopScroll("post");
            chrome.runtime.sendMessage({
              type: DY_FOLLOW_RUNTIME.POST_SCROLL_TICK,
              payload: {
                ticks: state.ticks,
                href: window.location.href,
                sentAt: (/* @__PURE__ */ new Date()).toISOString(),
                autoStopped: true,
                reason: "no_more_progress"
              }
            });
            console.log(DY_FOLLOW_PREFIX, "作品区疑似已到底，已自动停止滚动");
            return;
          }
        }
        chrome.runtime.sendMessage({
          type: isPostMode ? DY_FOLLOW_RUNTIME.POST_SCROLL_TICK : DY_FOLLOW_RUNTIME.SCROLL_TICK,
          payload: {
            ticks: state.ticks,
            href: window.location.href,
            sentAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        });
      } catch {
      }
    }, 900);
    console.log(DY_FOLLOW_PREFIX, isPostMode ? "已开始自动滚动采集作品" : "已开始自动滚动采集关注列表");
  }
  function stopScroll(mode) {
    if (!state.timer) {
      return;
    }
    const isPostMode = mode === "post" || state.mode === "post";
    clearInterval(state.timer);
    state.timer = null;
    state.stagnantTicks = 0;
    chrome.runtime.sendMessage({
      type: isPostMode ? DY_FOLLOW_RUNTIME.POST_SCROLL_TICK : DY_FOLLOW_RUNTIME.SCROLL_TICK,
      payload: {
        ticks: state.ticks,
        href: window.location.href,
        sentAt: (/* @__PURE__ */ new Date()).toISOString(),
        stopped: true
      }
    });
    console.log(DY_FOLLOW_PREFIX, isPostMode ? "已停止自动滚动采集作品" : "已停止自动滚动采集关注列表");
  }
  function initFollowAutoScroller() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || !message.type) {
        return false;
      }
      if (message.type === DY_FOLLOW_RUNTIME.START_CRAWL) {
        startScroll("follow");
        sendResponse({ ok: true });
        return true;
      }
      if (message.type === DY_FOLLOW_RUNTIME.STOP_CRAWL) {
        stopScroll("follow");
        sendResponse({ ok: true });
        return true;
      }
      if (message.type === DY_FOLLOW_RUNTIME.START_POST_CRAWL) {
        startScroll("post");
        sendResponse({ ok: true });
        return true;
      }
      if (message.type === DY_FOLLOW_RUNTIME.STOP_POST_CRAWL) {
        stopScroll("post");
        sendResponse({ ok: true });
        return true;
      }
      if (message.type === DY_FOLLOW_RUNTIME.SET_POST_FILTER) {
        const mode = message && message.payload && typeof message.payload.mode === "string" ? String(message.payload.mode) : "all";
        const normalized = mode === "video" || mode === "image" ? mode : "all";
        applyPostFilter(normalized).then((ret) => sendResponse(ret));
        return true;
      }
      return false;
    });
  }
  initFollowContentCapture();
  initFollowAutoScroller();
})();
//# sourceMappingURL=content.js.map
