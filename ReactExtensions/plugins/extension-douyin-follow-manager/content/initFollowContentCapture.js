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

function sendCaptureToBackground(payload, meta) {
  sendRuntimeMessage(
    {
      type: DY_FOLLOW_RUNTIME.FOLLOW_CAPTURE,
      payload,
      meta: meta || null,
    },
    () => {},
  );
}

function handleCapture(requestUrl, data) {
  if (!data || data._parseError) {
    sendCaptureToBackground(null, {
      parseError: '接口响应解析失败',
      requestUrl,
    });
    return;
  }
  const parsed = parseFollowings(data);
  if (!parsed) {
    sendCaptureToBackground(null, {
      parseError: `status_code=${data && data.status_code != null ? data.status_code : '?'}`,
      requestUrl,
    });
    return;
  }
  sendCaptureToBackground(
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

function onWindowMessage(event) {
  if (!event.data || event.data.source !== DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE) {
    return;
  }
  const requestUrl = event.data.requestUrl ? String(event.data.requestUrl) : '';
  handleCapture(requestUrl, event.data.data);
}

export function initFollowContentCapture() {
  window.addEventListener('message', onWindowMessage);
  injectMainScript();
}

