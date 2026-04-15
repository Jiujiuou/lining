import { sendRuntimeMessage } from '@rext-shared/services/index.js';
import { DY_FOLLOW_PREFIX, DY_FOLLOW_RUNTIME } from '@/shared/constants.js';

function injectMainScript() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = function onLoad() {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  } catch {
    // 忽略注入失败
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
    downloadUrlList: downloadList.map((item) => String(item || '')).filter(Boolean),
    urlList: normalList.map((item) => String(item || '')).filter(Boolean),
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
      desc: row.desc != null ? String(row.desc) : '',
      authorNickname:
        row && row.author && row.author.nickname != null ? String(row.author.nickname) : '',
      createTime: toNumber(row.create_time),
      awemeType: toNumber(row.aweme_type),
      postType,
      imageCount: images.length,
      images,
      diggCount: toNumber(row.statistics && row.statistics.digg_count),
      commentCount: toNumber(row.statistics && row.statistics.comment_count),
      shareCount: toNumber(row.statistics && row.statistics.share_count),
      collectCount: toNumber(row.statistics && row.statistics.collect_count),
      playCount: toNumber(row.statistics && row.statistics.play_count),
    });
  }
  return {
    posts,
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
      parseError: '关注接口响应解析失败',
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
    `捕获关注分页：${parsed.users.length} 条，hasMore=${String(parsed.hasMore)}，nextOffset=${String(parsed.nextOffset)}`,
  );
}

function handlePostCapture(requestUrl, data) {
  if (!data || data._parseError) {
    sendCaptureToBackground(DY_FOLLOW_RUNTIME.POST_CAPTURE, null, {
      parseError: '作品接口响应解析失败',
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

  sendCaptureToBackground(
    DY_FOLLOW_RUNTIME.POST_CAPTURE,
    {
      ...parsed,
      requestUrl,
      secUid: parseSecUserIdFromUrl(requestUrl),
      requestCursor: parseMaxCursorFromUrl(requestUrl),
      capturedAt: new Date().toISOString(),
    },
    null,
  );
  console.log(
    DY_FOLLOW_PREFIX,
    `捕获作品分页：${parsed.posts.length} 条，图文=${imageCount}，视频=${videoCount}，hasMore=${String(parsed.hasMore)}，maxCursor=${String(parsed.maxCursor)}`,
  );
}

function onWindowMessage(event) {
  if (!event.data || event.data.source !== DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE) {
    return;
  }
  const requestUrl = event.data.requestUrl ? String(event.data.requestUrl) : '';
  if (requestUrl.includes('/aweme/v1/web/user/following/list/')) {
    handleFollowingCapture(requestUrl, event.data.data);
    return;
  }
  if (requestUrl.includes('/aweme/v1/web/aweme/post/')) {
    handlePostCapture(requestUrl, event.data.data);
  }
}

export function initFollowContentCapture() {
  window.addEventListener('message', onWindowMessage);
  injectMainScript();
}
