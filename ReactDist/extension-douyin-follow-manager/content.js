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
  const DY_FOLLOW_PREFIX = "[抖音关注管理]";
  function injectMainScriptFallback() {
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
  function toNumber$1(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function parseOffsetFromUrl(requestUrl) {
    try {
      const url = new URL(requestUrl);
      return toNumber$1(url.searchParams.get("offset"));
    } catch {
      return null;
    }
  }
  function parseMaxCursorFromUrl(requestUrl) {
    try {
      const url = new URL(requestUrl);
      return toNumber$1(url.searchParams.get("max_cursor"));
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
  function parseSecUserIdFromLocation() {
    const match = String(window.location.pathname || "").match(/\/user\/([^/?#]+)/);
    return match && match[1] ? String(match[1]) : "";
  }
  function isFollowingListUrl(url) {
    return /\/aweme\/v1\/web\/user\/following\/list(?:\/|\?|$)/i.test(String(url || ""));
  }
  function isPostListUrl(url) {
    return /\/aweme\/v1\/web\/aweme\/post(?:\/|\?|$)/i.test(String(url || ""));
  }
  function pickPostApiUrlBySecUid(secUid) {
    const uid = String(secUid || "");
    const entries = performance.getEntriesByType("resource");
    const candidates = [];
    for (let i = 0; i < entries.length; i += 1) {
      const name = entries[i] && entries[i].name ? String(entries[i].name) : "";
      if (!isPostListUrl(name)) {
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
      if (/[?&]max_cursor=0(?:&|$)/i.test(candidates[i])) {
        return candidates[i];
      }
    }
    return candidates[candidates.length - 1];
  }
  function makePostBootstrapUrl(secUid) {
    const uid = encodeURIComponent(String(secUid || ""));
    return `https://www-hj.douyin.com/aweme/v1/web/aweme/post/?device_platform=webapp&aid=6383&channel=channel_pc_web&sec_user_id=${uid}&max_cursor=0&count=18`;
  }
  const postRequestCrawlState = {
    running: false,
    stopRequested: false,
    requestCount: 0
  };
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function buildPostPageUrl(seedUrl, secUid, cursor, isFirstPage) {
    const raw = String(seedUrl || "").trim();
    const base = raw || makePostBootstrapUrl(secUid);
    const url = new URL(base, window.location.href);
    url.searchParams.set("sec_user_id", String(secUid || ""));
    url.searchParams.set("max_cursor", String(cursor != null ? cursor : 0));
    url.searchParams.set("count", url.searchParams.get("count") || "18");
    url.searchParams.set("need_time_list", isFirstPage ? "1" : "0");
    if (!url.searchParams.has("time_list_query")) {
      url.searchParams.set("time_list_query", "0");
    }
    return url.toString();
  }
  async function bootstrapPostCaptureFallback() {
    const secUid = parseSecUserIdFromLocation();
    if (!secUid) {
      return { ok: false, reason: "sec_uid_empty" };
    }
    const requestUrl = pickPostApiUrlBySecUid(secUid) || makePostBootstrapUrl(secUid);
    try {
      const resp = await fetch(requestUrl, { credentials: "include" });
      const data = await resp.json();
      const parsed = parsePosts(data);
      if (!parsed || !Array.isArray(parsed.posts)) {
        return {
          ok: false,
          reason: `post_invalid_status_${String(data && data.status_code != null ? data.status_code : "unknown")}`
        };
      }
      sendCaptureToBackground(
        DY_FOLLOW_RUNTIME.POST_CAPTURE,
        {
          ...parsed,
          requestUrl,
          secUid: secUid || parsed.secUid || "",
          requestCursor: parseMaxCursorFromUrl(requestUrl),
          capturedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        { source: "fallback_request" }
      );
      return { ok: true, count: parsed.posts.length, secUid };
    } catch (error) {
      return { ok: false, reason: String(error || "post_bootstrap_fallback_failed") };
    }
  }
  async function startPostRequestCrawl() {
    const secUid = parseSecUserIdFromLocation();
    if (!secUid) {
      return { ok: false, reason: "sec_uid_empty" };
    }
    if (postRequestCrawlState.running) {
      return { ok: true, alreadyRunning: true };
    }
    postRequestCrawlState.running = true;
    postRequestCrawlState.stopRequested = false;
    postRequestCrawlState.requestCount = 0;
    let merged = 0;
    let hasMore = true;
    let cursor = 0;
    let page = 0;
    const seedUrl = pickPostApiUrlBySecUid(secUid) || makePostBootstrapUrl(secUid);
    try {
      while (!postRequestCrawlState.stopRequested && hasMore && page < 200) {
        const requestUrl = buildPostPageUrl(seedUrl, secUid, cursor, page === 0);
        postRequestCrawlState.requestCount += 1;
        const attempt = postRequestCrawlState.requestCount;
        let data;
        try {
          const resp = await fetch(requestUrl, { credentials: "include" });
          data = await resp.json();
        } catch (error) {
          sendCaptureToBackground(DY_FOLLOW_RUNTIME.POST_CAPTURE, null, {
            parseError: `第 ${attempt} 次请求失败：${String(error || "fetch_failed")}`,
            requestUrl
          });
          break;
        }
        const parsed = parsePosts(data);
        if (!parsed || !Array.isArray(parsed.posts)) {
          sendCaptureToBackground(DY_FOLLOW_RUNTIME.POST_CAPTURE, null, {
            parseError: `第 ${attempt} 次响应无效：status_code=${String(data && data.status_code != null ? data.status_code : "?")}`,
            requestUrl
          });
          break;
        }
        sendCaptureToBackground(
          DY_FOLLOW_RUNTIME.POST_CAPTURE,
          {
            ...parsed,
            requestUrl,
            secUid: secUid || parsed.secUid || "",
            requestCursor: parseMaxCursorFromUrl(requestUrl),
            capturedAt: (/* @__PURE__ */ new Date()).toISOString()
          },
          { source: "request_pagination", attempt }
        );
        merged += parsed.posts.length;
        hasMore = Boolean(parsed.hasMore);
        const nextCursor = parsed.maxCursor;
        const noProgress = nextCursor == null || String(nextCursor) === String(cursor);
        cursor = nextCursor != null ? nextCursor : cursor;
        page += 1;
        chrome.runtime.sendMessage({
          type: DY_FOLLOW_RUNTIME.POST_SCROLL_TICK,
          payload: {
            ticks: attempt,
            href: window.location.href,
            sentAt: (/* @__PURE__ */ new Date()).toISOString(),
            mode: "request_pagination"
          }
        });
        if (!hasMore) {
          break;
        }
        if (noProgress) {
          sendCaptureToBackground(DY_FOLLOW_RUNTIME.POST_CAPTURE, null, {
            parseError: `第 ${attempt} 次分页游标未推进，已停止：cursor=${String(cursor)}`,
            requestUrl
          });
          break;
        }
        await sleep(350);
      }
      const stoppedByUser = postRequestCrawlState.stopRequested;
      chrome.runtime.sendMessage({
        type: DY_FOLLOW_RUNTIME.POST_SCROLL_TICK,
        payload: {
          ticks: postRequestCrawlState.requestCount,
          href: window.location.href,
          sentAt: (/* @__PURE__ */ new Date()).toISOString(),
          stopped: true,
          stoppedByUser,
          mode: "request_pagination"
        }
      });
      return {
        ok: true,
        secUid,
        requestCount: postRequestCrawlState.requestCount,
        merged,
        stoppedByUser
      };
    } finally {
      postRequestCrawlState.running = false;
    }
  }
  function stopPostRequestCrawl() {
    postRequestCrawlState.stopRequested = true;
    return { ok: true };
  }
  function pickFollowingApiUrl() {
    const entries = performance.getEntriesByType("resource");
    const candidates = [];
    for (let i = 0; i < entries.length; i += 1) {
      const name = entries[i] && entries[i].name ? String(entries[i].name) : "";
      if (!isFollowingListUrl(name)) {
        continue;
      }
      candidates.push(name);
    }
    if (candidates.length === 0) {
      return "";
    }
    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      if (/[?&]offset=0(?:&|$)/i.test(candidates[i])) {
        return candidates[i];
      }
    }
    return candidates[candidates.length - 1];
  }
  async function bootstrapFollowingCapture() {
    const url = pickFollowingApiUrl();
    if (!url) {
      return { ok: false, reason: "following_api_url_not_found" };
    }
    try {
      const resp = await fetch(url, { credentials: "include" });
      const data = await resp.json();
      const parsed = parseFollowings(data);
      if (!parsed) {
        return {
          ok: false,
          reason: `following_invalid_status_${String(data && data.status_code != null ? data.status_code : "unknown")}`
        };
      }
      handleFollowingCapture(url, data);
      return { ok: true, mode: "request", count: parsed.users.length };
    } catch (error) {
      return { ok: false, reason: String(error || "following_bootstrap_failed") };
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
        followerCount: toNumber$1(row.follower_count),
        followingCount: toNumber$1(row.following_count),
        awemeCount: toNumber$1(row.aweme_count),
        totalFavorited: toNumber$1(row.total_favorited),
        isVerified: Boolean(row.is_verified),
        verificationType: toNumber$1(row.verification_type)
      });
    }
    return {
      users,
      hasMore: Boolean(data.has_more),
      total: toNumber$1(data.total),
      nextOffset: toNumber$1(data.offset)
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
    if (toNumber$1(row.aweme_type) === 68) {
      return "image";
    }
    return "unknown";
  }
  function pickImageUrlList(image) {
    const row = image || {};
    const downloadList = Array.isArray(row.download_url_list) ? row.download_url_list : [];
    const normalList = Array.isArray(row.url_list) ? row.url_list : [];
    return {
      downloadUrlList: downloadList.map((item) => String(item || "")).filter(Boolean).slice(0, 4),
      urlList: normalList.map((item) => String(item || "")).filter(Boolean).slice(0, 4)
    };
  }
  function parsePosts(data) {
    if (!data || data.status_code !== 0) {
      return null;
    }
    const list = Array.isArray(data.aweme_list) ? data.aweme_list : [];
    const posts = [];
    let parsedSecUid = "";
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
          width: toNumber$1(image && image.width),
          height: toNumber$1(image && image.height),
          ...urls
        };
      });
      posts.push({
        awemeId,
        authorNickname: row && row.author && row.author.nickname != null ? String(row.author.nickname) : "",
        postType,
        imageCount: images.length,
        images
      });
      if (!parsedSecUid) {
        const authorSecUid = row && row.author && row.author.sec_uid != null ? String(row.author.sec_uid) : "";
        if (authorSecUid) {
          parsedSecUid = authorSecUid;
        }
      }
    }
    return {
      posts,
      secUid: parsedSecUid,
      hasMore: Boolean(data.has_more),
      maxCursor: toNumber$1(data.max_cursor),
      minCursor: toNumber$1(data.min_cursor),
      total: toNumber$1(data.total)
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
        parseError: "鍏虫敞鎺ュ彛鍝嶅簲瑙ｆ瀽澶辫触",
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
      `鎹曡幏鍏虫敞鍒嗛〉锛?{parsed.users.length} 鏉★紝hasMore=${String(parsed.hasMore)}锛宯extOffset=${String(parsed.nextOffset)}`
    );
  }
  function handlePostCapture(requestUrl, data) {
    if (!data || data._parseError) {
      sendCaptureToBackground(DY_FOLLOW_RUNTIME.POST_CAPTURE, null, {
        parseError: "浣滃搧鎺ュ彛鍝嶅簲瑙ｆ瀽澶辫触",
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
    const secUidFromUrl = parseSecUserIdFromUrl(requestUrl);
    const secUidFromData = parsed && parsed.secUid ? String(parsed.secUid) : "";
    const secUidFromLocation = parseSecUserIdFromLocation();
    let finalSecUid = secUidFromLocation || secUidFromUrl || secUidFromData;
    if (!finalSecUid) {
      finalSecUid = secUidFromUrl || secUidFromData || secUidFromLocation;
    }
    if (secUidFromLocation && (secUidFromUrl && secUidFromUrl !== secUidFromLocation || secUidFromData && secUidFromData !== secUidFromLocation)) {
      console.warn(
        DY_FOLLOW_PREFIX,
        `忽略跨博主作品请求：page=${secUidFromLocation}, url=${secUidFromUrl || "-"}, data=${secUidFromData || "-"}`
      );
      return;
    }
    sendCaptureToBackground(
      DY_FOLLOW_RUNTIME.POST_CAPTURE,
      {
        ...parsed,
        requestUrl,
        secUid: finalSecUid,
        requestCursor: parseMaxCursorFromUrl(requestUrl),
        capturedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      null
    );
    console.log(
      DY_FOLLOW_PREFIX,
      `鎹曡幏浣滃搧鍒嗛〉锛?{parsed.posts.length} 鏉★紝鍥炬枃=${imageCount}锛岃棰?${videoCount}锛宧asMore=${String(parsed.hasMore)}锛宮axCursor=${String(parsed.maxCursor)}`
    );
  }
  function onWindowMessage(event) {
    if (!event.data || event.data.source !== DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE) {
      return;
    }
    const requestUrl = event.data.requestUrl ? String(event.data.requestUrl) : "";
    if (isFollowingListUrl(requestUrl)) {
      handleFollowingCapture(requestUrl, event.data.data);
      return;
    }
    if (isPostListUrl(requestUrl)) {
      handlePostCapture(requestUrl, event.data.data);
    }
  }
  function initFollowContentCapture() {
    window.addEventListener("message", onWindowMessage);
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || !message.type) {
        return false;
      }
      if (message.type === DY_FOLLOW_RUNTIME.BOOTSTRAP_FOLLOW_CAPTURE) {
        bootstrapFollowingCapture().then((ret) => sendResponse(ret));
        return true;
      }
      if (message.type === DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE_FALLBACK) {
        bootstrapPostCaptureFallback().then((ret) => sendResponse(ret));
        return true;
      }
      if (message.type === DY_FOLLOW_RUNTIME.START_POST_CRAWL) {
        startPostRequestCrawl().then((ret) => sendResponse(ret));
        return true;
      }
      if (message.type === DY_FOLLOW_RUNTIME.STOP_POST_CRAWL) {
        sendResponse(stopPostRequestCrawl());
        return true;
      }
      return false;
    });
    injectMainScriptFallback();
  }
  const state = {
    timer: null,
    ticks: 0,
    followVisibleCount: 0
  };
  function parseSecUidFromHref(href) {
    const text = String(href || "");
    const m = text.match(/\/user\/([^/?#]+)/);
    return m && m[1] ? String(m[1]) : "";
  }
  function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function parseChineseCount(text) {
    const raw = String(text || "").trim();
    if (!raw) {
      return null;
    }
    const normalized = raw.replace(/,/g, "");
    const base = parseFloat(normalized);
    if (!Number.isFinite(base)) {
      return null;
    }
    if (/[万wW]/.test(normalized)) {
      return Math.round(base * 1e4);
    }
    if (/亿/.test(normalized)) {
      return Math.round(base * 1e8);
    }
    return toNumber(base);
  }
  function extractUrlFromCssBackground(value) {
    const text = String(value || "");
    const match = text.match(/url\((['"]?)(.*?)\1\)/i);
    return match && match[2] ? String(match[2]) : "";
  }
  function pickBestImageFromImg(img) {
    if (!img) {
      return "";
    }
    const candidates = [];
    if (img.currentSrc) candidates.push(String(img.currentSrc));
    if (img.src) candidates.push(String(img.src));
    const dataSrc = img.getAttribute("data-src");
    if (dataSrc) candidates.push(String(dataSrc));
    const srcset = img.getAttribute("srcset") || "";
    if (srcset) {
      const parts = String(srcset).split(",").map((item) => item.trim().split(/\s+/)[0]).filter(Boolean);
      candidates.push(...parts);
    }
    for (let i = 0; i < candidates.length; i += 1) {
      const url = String(candidates[i] || "").trim();
      if (!url || url.startsWith("data:")) {
        continue;
      }
      return url;
    }
    return "";
  }
  function findLikelyUserRow(anchor, container) {
    let current = anchor;
    for (let i = 0; i < 8 && current && current !== container; i += 1) {
      const imgCount = current.querySelectorAll ? current.querySelectorAll("img").length : 0;
      const text = String(current.textContent || "").replace(/\s+/g, " ").trim();
      if (imgCount > 0 && text.length >= 2) {
        return current;
      }
      current = current.parentElement;
    }
    return anchor.closest("li, div") || anchor;
  }
  function pickAvatarFromRow(row) {
    if (!row) {
      return "";
    }
    const imgs = Array.from(row.querySelectorAll("img"));
    for (let i = 0; i < imgs.length; i += 1) {
      const url = pickBestImageFromImg(imgs[i]);
      if (url) {
        return url;
      }
    }
    const nodes = [row, ...Array.from(row.querySelectorAll("*")).slice(0, 24)];
    for (let i = 0; i < nodes.length; i += 1) {
      try {
        const bgInline = extractUrlFromCssBackground(nodes[i].style && nodes[i].style.backgroundImage);
        if (bgInline) {
          return bgInline;
        }
        const bgComputed = extractUrlFromCssBackground(getComputedStyle(nodes[i]).backgroundImage);
        if (bgComputed) {
          return bgComputed;
        }
      } catch {
      }
    }
    return "";
  }
  function collectVisibleFollowUsers(container) {
    if (!container) {
      return [];
    }
    const anchors = Array.from(container.querySelectorAll('a[href*="/user/"]'));
    const dedup = /* @__PURE__ */ new Map();
    for (let i = 0; i < anchors.length; i += 1) {
      const anchor = anchors[i];
      const href = String(anchor.getAttribute("href") || "");
      const secUid = parseSecUidFromHref(href);
      if (!secUid) {
        continue;
      }
      const row = findLikelyUserRow(anchor, container);
      const rowText = String(row && row.textContent || "").replace(/\s+/g, " ").trim();
      const nickname = String(anchor.textContent || "").replace(/\s+/g, " ").trim() || secUid;
      const avatar = pickAvatarFromRow(row);
      const followerMatch = rowText.match(/粉丝\s*([0-9.,]+(?:万|亿|w|W)?)/);
      const followingMatch = rowText.match(/关注\s*([0-9.,]+(?:万|亿|w|W)?)/);
      const awemeMatch = rowText.match(/作品\s*([0-9.,]+(?:万|亿|w|W)?)/);
      dedup.set(secUid, {
        uid: "",
        secUid,
        nickname,
        signature: "",
        avatar,
        followerCount: followerMatch ? parseChineseCount(followerMatch[1]) : null,
        followingCount: followingMatch ? parseChineseCount(followingMatch[1]) : null,
        awemeCount: awemeMatch ? parseChineseCount(awemeMatch[1]) : null
      });
    }
    return Array.from(dedup.values());
  }
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
  function startScroll() {
    if (state.timer) {
      return;
    }
    const container = findFollowScrollContainer();
    state.ticks = 0;
    state.followVisibleCount = 0;
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
        const visibleUsers = collectVisibleFollowUsers(container);
        if (visibleUsers.length > state.followVisibleCount) {
          state.followVisibleCount = visibleUsers.length;
          chrome.runtime.sendMessage({
            type: DY_FOLLOW_RUNTIME.FOLLOW_CAPTURE,
            payload: {
              users: visibleUsers,
              hasMore: true,
              total: null,
              nextOffset: null,
              requestUrl: "dom://follow-visible",
              requestOffset: null,
              capturedAt: (/* @__PURE__ */ new Date()).toISOString()
            },
            meta: { source: "dom_visible" }
          });
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
    console.log(DY_FOLLOW_PREFIX, "已开始自动滚动采集关注列表");
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
    console.log(DY_FOLLOW_PREFIX, "已停止自动滚动采集关注列表");
  }
  function initFollowAutoScroller() {
    window.addEventListener("message", (event) => {
      const payload = event && event.data ? event.data : null;
      if (!payload || payload.source !== DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE) {
        return;
      }
      if (payload.type !== DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE_RESULT) {
        return;
      }
      if (payload.ok) {
        console.log(DY_FOLLOW_PREFIX, "已主动补抓作品第一页接口");
        chrome.runtime.sendMessage({
          type: DY_FOLLOW_RUNTIME.POST_BOOTSTRAP_STATUS,
          payload: {
            ok: true,
            mode: payload.mode || "request",
            secUid: payload.secUid || "",
            sentAt: (/* @__PURE__ */ new Date()).toISOString(),
            href: window.location.href
          }
        });
        return;
      }
      console.warn(DY_FOLLOW_PREFIX, `补抓作品第一页失败：${String(payload.reason || "unknown")}`);
      chrome.runtime.sendMessage({
        type: DY_FOLLOW_RUNTIME.POST_BOOTSTRAP_STATUS,
        payload: {
          ok: false,
          mode: payload.mode || "request",
          secUid: payload.secUid || "",
          reason: String(payload.reason || "unknown"),
          sentAt: (/* @__PURE__ */ new Date()).toISOString(),
          href: window.location.href
        }
      });
    });
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
      if (message.type === DY_FOLLOW_RUNTIME.SET_POST_FILTER) {
        const mode = message && message.payload && typeof message.payload.mode === "string" ? String(message.payload.mode) : "all";
        const normalized = mode === "video" || mode === "image" ? mode : "all";
        applyPostFilter(normalized).then((ret) => sendResponse(ret));
        return true;
      }
      if (message.type === DY_FOLLOW_RUNTIME.GET_PAGE_CONTEXT) {
        sendResponse({
          ok: true,
          href: window.location.href,
          secUid: getCurrentSecUid()
        });
        return true;
      }
      if (message.type === DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE) {
        window.postMessage(
          {
            source: DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE,
            type: DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE
          },
          "*"
        );
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
