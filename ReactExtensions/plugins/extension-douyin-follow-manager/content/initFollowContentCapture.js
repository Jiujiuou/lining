import { sendRuntimeMessage } from '@rext-shared/services/index.js';
import { DY_FOLLOW_PREFIX, DY_FOLLOW_RUNTIME } from '@/shared/constants.js';

function injectMainScriptFallback() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = function onLoad() {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  } catch {
    // 忽略兜底注入失败
  }
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseOffsetFromUrl(requestUrl) {
  try {
    const url = new URL(requestUrl);
    return toNumber(url.searchParams.get('offset'));
  } catch {
    return null;
  }
}

function parseMaxCursorFromUrl(requestUrl) {
  try {
    const url = new URL(requestUrl);
    return toNumber(url.searchParams.get('max_cursor'));
  } catch {
    return null;
  }
}

function parseSecUserIdFromUrl(requestUrl) {
  try {
    const url = new URL(requestUrl);
    const secUid = url.searchParams.get('sec_user_id');
    return secUid ? String(secUid) : '';
  } catch {
    return '';
  }
}

function parseSecUserIdFromLocation() {
  const match = String(window.location.pathname || '').match(/\/user\/([^/?#]+)/);
  return match && match[1] ? String(match[1]) : '';
}

function isFollowingListUrl(url) {
  return /\/aweme\/v1\/web\/user\/following\/list(?:\/|\?|$)/i.test(String(url || ''));
}

function isPostListUrl(url) {
  return /\/aweme\/v1\/web\/aweme\/post(?:\/|\?|$)/i.test(String(url || ''));
}

function pickPostApiUrlBySecUid(secUid) {
  const uid = String(secUid || '');
  const entries = performance.getEntriesByType('resource');
  const candidates = [];
  for (let i = 0; i < entries.length; i += 1) {
    const name = entries[i] && entries[i].name ? String(entries[i].name) : '';
    if (!isPostListUrl(name)) {
      continue;
    }
    if (uid && !name.includes(`sec_user_id=${encodeURIComponent(uid)}`) && !name.includes(`sec_user_id=${uid}`)) {
      continue;
    }
    candidates.push(name);
  }
  if (candidates.length === 0) {
    return '';
  }
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    if (/[?&]max_cursor=0(?:&|$)/i.test(candidates[i])) {
      return candidates[i];
    }
  }
  return candidates[candidates.length - 1];
}

function makePostBootstrapUrl(secUid) {
  const uid = encodeURIComponent(String(secUid || ''));
  return `https://www-hj.douyin.com/aweme/v1/web/aweme/post/?device_platform=webapp&aid=6383&channel=channel_pc_web&sec_user_id=${uid}&max_cursor=0&count=18`;
}

const postRequestCrawlState = {
  running: false,
  stopRequested: false,
  requestCount: 0,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPostPageUrl(seedUrl, secUid, cursor, isFirstPage) {
  const raw = String(seedUrl || '').trim();
  const base = raw || makePostBootstrapUrl(secUid);
  const url = new URL(base, window.location.href);
  url.searchParams.set('sec_user_id', String(secUid || ''));
  url.searchParams.set('max_cursor', String(cursor != null ? cursor : 0));
  url.searchParams.set('count', url.searchParams.get('count') || '18');
  // 首页通常带 need_time_list=1，后续页强制置 0
  url.searchParams.set('need_time_list', isFirstPage ? '1' : '0');
  if (!url.searchParams.has('time_list_query')) {
    url.searchParams.set('time_list_query', '0');
  }
  return url.toString();
}

async function bootstrapPostCaptureFallback() {
  const secUid = parseSecUserIdFromLocation();
  if (!secUid) {
    return { ok: false, reason: 'sec_uid_empty' };
  }
  const requestUrl = pickPostApiUrlBySecUid(secUid) || makePostBootstrapUrl(secUid);
  try {
    const resp = await fetch(requestUrl, { credentials: 'include' });
    const data = await resp.json();
    const parsed = parsePosts(data);
    if (!parsed || !Array.isArray(parsed.posts)) {
      return {
        ok: false,
        reason: `post_invalid_status_${String(data && data.status_code != null ? data.status_code : 'unknown')}`,
      };
    }

    sendCaptureToBackground(
      DY_FOLLOW_RUNTIME.POST_CAPTURE,
      {
        ...parsed,
        requestUrl,
        secUid: secUid || parsed.secUid || '',
        requestCursor: parseMaxCursorFromUrl(requestUrl),
        capturedAt: new Date().toISOString(),
      },
      { source: 'fallback_request' },
    );
    return { ok: true, count: parsed.posts.length, secUid };
  } catch (error) {
    return { ok: false, reason: String(error || 'post_bootstrap_fallback_failed') };
  }
}

async function startPostRequestCrawl() {
  const secUid = parseSecUserIdFromLocation();
  if (!secUid) {
    return { ok: false, reason: 'sec_uid_empty' };
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
        const resp = await fetch(requestUrl, { credentials: 'include' });
        data = await resp.json();
      } catch (error) {
        sendCaptureToBackground(DY_FOLLOW_RUNTIME.POST_CAPTURE, null, {
          parseError: `第 ${attempt} 次请求失败：${String(error || 'fetch_failed')}`,
          requestUrl,
        });
        break;
      }

      const parsed = parsePosts(data);
      if (!parsed || !Array.isArray(parsed.posts)) {
        sendCaptureToBackground(DY_FOLLOW_RUNTIME.POST_CAPTURE, null, {
          parseError: `第 ${attempt} 次响应无效：status_code=${String(data && data.status_code != null ? data.status_code : '?')}`,
          requestUrl,
        });
        break;
      }

      sendCaptureToBackground(
        DY_FOLLOW_RUNTIME.POST_CAPTURE,
        {
          ...parsed,
          requestUrl,
          secUid: secUid || parsed.secUid || '',
          requestCursor: parseMaxCursorFromUrl(requestUrl),
          capturedAt: new Date().toISOString(),
        },
        { source: 'request_pagination', attempt },
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
          sentAt: new Date().toISOString(),
          mode: 'request_pagination',
        },
      });

      if (!hasMore) {
        break;
      }
      if (noProgress) {
        sendCaptureToBackground(DY_FOLLOW_RUNTIME.POST_CAPTURE, null, {
          parseError: `第 ${attempt} 次分页游标未推进，已停止：cursor=${String(cursor)}`,
          requestUrl,
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
        sentAt: new Date().toISOString(),
        stopped: true,
        stoppedByUser,
        mode: 'request_pagination',
      },
    });

    return {
      ok: true,
      secUid,
      requestCount: postRequestCrawlState.requestCount,
      merged,
      stoppedByUser,
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
  const entries = performance.getEntriesByType('resource');
  const candidates = [];
  for (let i = 0; i < entries.length; i += 1) {
    const name = entries[i] && entries[i].name ? String(entries[i].name) : '';
    if (!isFollowingListUrl(name)) {
      continue;
    }
    candidates.push(name);
  }
  if (candidates.length === 0) {
    return '';
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
    return { ok: false, reason: 'following_api_url_not_found' };
  }
  try {
    const resp = await fetch(url, { credentials: 'include' });
    const data = await resp.json();
    const parsed = parseFollowings(data);
    if (!parsed) {
      return {
        ok: false,
        reason: `following_invalid_status_${String(data && data.status_code != null ? data.status_code : 'unknown')}`,
      };
    }
    handleFollowingCapture(url, data);
    return { ok: true, mode: 'request', count: parsed.users.length };
  } catch (error) {
    return { ok: false, reason: String(error || 'following_bootstrap_failed') };
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
    const uid = row.uid != null ? String(row.uid) : '';
    const secUid = row.sec_uid != null ? String(row.sec_uid) : '';
    if (!uid && !secUid) {
      continue;
    }
    const avatar =
      row.avatar_168x168 &&
      Array.isArray(row.avatar_168x168.url_list) &&
      row.avatar_168x168.url_list[0]
        ? String(row.avatar_168x168.url_list[0])
        : '';
    users.push({
      uid,
      secUid,
      nickname: row.nickname != null ? String(row.nickname) : '',
      signature: row.signature != null ? String(row.signature) : '',
      avatar,
      followerCount: toNumber(row.follower_count),
      followingCount: toNumber(row.following_count),
      awemeCount: toNumber(row.aweme_count),
      totalFavorited: toNumber(row.total_favorited),
      isVerified: Boolean(row.is_verified),
      verificationType: toNumber(row.verification_type),
    });
  }
  return {
    users,
    hasMore: Boolean(data.has_more),
    total: toNumber(data.total),
    nextOffset: toNumber(data.offset),
  };
}

function resolvePostType(aweme) {
  const row = aweme || {};
  const images = Array.isArray(row.images) ? row.images : [];
  if (images.length > 0) {
    return 'image';
  }
  if (row.video && typeof row.video === 'object') {
    return 'video';
  }
  if (toNumber(row.aweme_type) === 68) {
    return 'image';
  }
  return 'unknown';
}

function pickImageUrlList(image) {
  const row = image || {};
  const downloadList = Array.isArray(row.download_url_list) ? row.download_url_list : [];
  const normalList = Array.isArray(row.url_list) ? row.url_list : [];
  return {
    downloadUrlList: downloadList.map((item) => String(item || '')).filter(Boolean).slice(0, 4),
    urlList: normalList.map((item) => String(item || '')).filter(Boolean).slice(0, 4),
  };
}

function parsePosts(data) {
  if (!data || data.status_code !== 0) {
    return null;
  }
  const list = Array.isArray(data.aweme_list) ? data.aweme_list : [];
  const posts = [];
  let parsedSecUid = '';
  for (let i = 0; i < list.length; i += 1) {
    const row = list[i] || {};
    const awemeId = row.aweme_id != null ? String(row.aweme_id) : '';
    if (!awemeId) {
      continue;
    }
    const postType = resolvePostType(row);
    const imagesRaw = Array.isArray(row.images) ? row.images : [];
    const images = imagesRaw.map((image) => {
      const urls = pickImageUrlList(image);
      return {
        uri: image && image.uri != null ? String(image.uri) : '',
        width: toNumber(image && image.width),
        height: toNumber(image && image.height),
        ...urls,
      };
    });
    posts.push({
      awemeId,
      authorNickname:
        row && row.author && row.author.nickname != null ? String(row.author.nickname) : '',
      postType,
      imageCount: images.length,
      images,
    });

    if (!parsedSecUid) {
      const authorSecUid =
        row && row.author && row.author.sec_uid != null ? String(row.author.sec_uid) : '';
      if (authorSecUid) {
        parsedSecUid = authorSecUid;
      }
    }
  }
  return {
    posts,
    secUid: parsedSecUid,
    hasMore: Boolean(data.has_more),
    maxCursor: toNumber(data.max_cursor),
    minCursor: toNumber(data.min_cursor),
    total: toNumber(data.total),
  };
}

function sendCaptureToBackground(type, payload, meta) {
  sendRuntimeMessage(
    {
      type,
      payload,
      meta: meta || null,
    },
    () => {},
  );
}

function handleFollowingCapture(requestUrl, data) {
  if (!data || data._parseError) {
    sendCaptureToBackground(DY_FOLLOW_RUNTIME.FOLLOW_CAPTURE, null, {
      parseError: '鍏虫敞鎺ュ彛鍝嶅簲瑙ｆ瀽澶辫触',
      requestUrl,
    });
    return;
  }
  const parsed = parseFollowings(data);
  if (!parsed) {
    sendCaptureToBackground(DY_FOLLOW_RUNTIME.FOLLOW_CAPTURE, null, {
      parseError: `status_code=${data && data.status_code != null ? data.status_code : '?'}`,
      requestUrl,
    });
    return;
  }
  sendCaptureToBackground(
    DY_FOLLOW_RUNTIME.FOLLOW_CAPTURE,
    {
      ...parsed,
      requestUrl,
      requestOffset: parseOffsetFromUrl(requestUrl),
      capturedAt: new Date().toISOString(),
    },
    null,
  );
  console.log(
    DY_FOLLOW_PREFIX,
    `鎹曡幏鍏虫敞鍒嗛〉锛?{parsed.users.length} 鏉★紝hasMore=${String(parsed.hasMore)}锛宯extOffset=${String(parsed.nextOffset)}`,
  );
}

function handlePostCapture(requestUrl, data) {
  if (!data || data._parseError) {
    sendCaptureToBackground(DY_FOLLOW_RUNTIME.POST_CAPTURE, null, {
      parseError: '浣滃搧鎺ュ彛鍝嶅簲瑙ｆ瀽澶辫触',
      requestUrl,
    });
    return;
  }
  const parsed = parsePosts(data);
  if (!parsed) {
    sendCaptureToBackground(DY_FOLLOW_RUNTIME.POST_CAPTURE, null, {
      parseError: `status_code=${data && data.status_code != null ? data.status_code : '?'}`,
      requestUrl,
    });
    return;
  }

  let imageCount = 0;
  let videoCount = 0;
  for (let i = 0; i < parsed.posts.length; i += 1) {
    if (parsed.posts[i].postType === 'image') {
      imageCount += 1;
    } else if (parsed.posts[i].postType === 'video') {
      videoCount += 1;
    }
  }

  const secUidFromUrl = parseSecUserIdFromUrl(requestUrl);
  const secUidFromData = parsed && parsed.secUid ? String(parsed.secUid) : '';
  const secUidFromLocation = parseSecUserIdFromLocation();
  // 以当前页面 secUid 为主，避免同页其他请求串到别的博主
  let finalSecUid = secUidFromLocation || secUidFromUrl || secUidFromData;
  if (!finalSecUid) {
    finalSecUid = secUidFromUrl || secUidFromData || secUidFromLocation;
  }

  // 当请求中的 secUid 与当前页面不一致时，丢弃本次捕获
  if (
    secUidFromLocation &&
    ((secUidFromUrl && secUidFromUrl !== secUidFromLocation) ||
      (secUidFromData && secUidFromData !== secUidFromLocation))
  ) {
    console.warn(
      DY_FOLLOW_PREFIX,
      `忽略跨博主作品请求：page=${secUidFromLocation}, url=${secUidFromUrl || '-'}, data=${secUidFromData || '-'}`,
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
      capturedAt: new Date().toISOString(),
    },
    null,
  );
  console.log(
    DY_FOLLOW_PREFIX,
    `鎹曡幏浣滃搧鍒嗛〉锛?{parsed.posts.length} 鏉★紝鍥炬枃=${imageCount}锛岃棰?${videoCount}锛宧asMore=${String(parsed.hasMore)}锛宮axCursor=${String(parsed.maxCursor)}`,
  );
}

function onWindowMessage(event) {
  if (!event.data || event.data.source !== DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE) {
    return;
  }
  const requestUrl = event.data.requestUrl ? String(event.data.requestUrl) : '';
  if (isFollowingListUrl(requestUrl)) {
    handleFollowingCapture(requestUrl, event.data.data);
    return;
  }
  if (isPostListUrl(requestUrl)) {
    handlePostCapture(requestUrl, event.data.data);
  }
}

export function initFollowContentCapture() {
  window.addEventListener('message', onWindowMessage);
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


