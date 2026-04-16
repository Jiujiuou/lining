import { DY_FOLLOW_PREFIX, DY_FOLLOW_RUNTIME, DY_FOLLOW_STORAGE_KEYS } from '@/shared/constants.js';

const state = {
  timer: null,
  ticks: 0,
  followVisibleCount: 0,
};

function parseSecUidFromHref(href) {
  const text = String(href || '');
  const m = text.match(/\/user\/([^/?#]+)/);
  return m && m[1] ? String(m[1]) : '';
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseChineseCount(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return null;
  }
  const normalized = raw.replace(/,/g, '');
  const base = parseFloat(normalized);
  if (!Number.isFinite(base)) {
    return null;
  }
  if (/[万wW]/.test(normalized)) {
    return Math.round(base * 10000);
  }
  if (/亿/.test(normalized)) {
    return Math.round(base * 100000000);
  }
  return toNumber(base);
}

function extractUrlFromCssBackground(value) {
  const text = String(value || '');
  const match = text.match(/url\((['"]?)(.*?)\1\)/i);
  return match && match[2] ? String(match[2]) : '';
}

function pickBestImageFromImg(img) {
  if (!img) {
    return '';
  }
  const candidates = [];
  if (img.currentSrc) candidates.push(String(img.currentSrc));
  if (img.src) candidates.push(String(img.src));
  const dataSrc = img.getAttribute('data-src');
  if (dataSrc) candidates.push(String(dataSrc));
  const srcset = img.getAttribute('srcset') || '';
  if (srcset) {
    const parts = String(srcset).split(',').map((item) => item.trim().split(/\s+/)[0]).filter(Boolean);
    candidates.push(...parts);
  }
  for (let i = 0; i < candidates.length; i += 1) {
    const url = String(candidates[i] || '').trim();
    if (!url || url.startsWith('data:')) {
      continue;
    }
    return url;
  }
  return '';
}

function findLikelyUserRow(anchor, container) {
  let current = anchor;
  for (let i = 0; i < 8 && current && current !== container; i += 1) {
    const imgCount = current.querySelectorAll ? current.querySelectorAll('img').length : 0;
    const text = String((current.textContent || '')).replace(/\s+/g, ' ').trim();
    if (imgCount > 0 && text.length >= 2) {
      return current;
    }
    current = current.parentElement;
  }
  return anchor.closest('li, div') || anchor;
}

function pickAvatarFromRow(row) {
  if (!row) {
    return '';
  }
  const imgs = Array.from(row.querySelectorAll('img'));
  for (let i = 0; i < imgs.length; i += 1) {
    const url = pickBestImageFromImg(imgs[i]);
    if (url) {
      return url;
    }
  }

  const nodes = [row, ...Array.from(row.querySelectorAll('*')).slice(0, 24)];
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
      // 忽略单个节点样式读取异常
    }
  }
  return '';
}

function collectVisibleFollowUsers(container) {
  if (!container) {
    return [];
  }
  const anchors = Array.from(container.querySelectorAll('a[href*="/user/"]'));
  const dedup = new Map();
  for (let i = 0; i < anchors.length; i += 1) {
    const anchor = anchors[i];
    const href = String(anchor.getAttribute('href') || '');
    const secUid = parseSecUidFromHref(href);
    if (!secUid) {
      continue;
    }
    const row = findLikelyUserRow(anchor, container);
    const rowText = String((row && row.textContent) || '').replace(/\s+/g, ' ').trim();
    const nickname = String(anchor.textContent || '').replace(/\s+/g, ' ').trim() || secUid;
    const avatar = pickAvatarFromRow(row);

    const followerMatch = rowText.match(/粉丝\s*([0-9.,]+(?:万|亿|w|W)?)/);
    const followingMatch = rowText.match(/关注\s*([0-9.,]+(?:万|亿|w|W)?)/);
    const awemeMatch = rowText.match(/作品\s*([0-9.,]+(?:万|亿|w|W)?)/);

    dedup.set(secUid, {
      uid: '',
      secUid,
      nickname,
      signature: '',
      avatar,
      followerCount: followerMatch ? parseChineseCount(followerMatch[1]) : null,
      followingCount: followingMatch ? parseChineseCount(followingMatch[1]) : null,
      awemeCount: awemeMatch ? parseChineseCount(awemeMatch[1]) : null,
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
    document.querySelector('.FjupSA6k'),
    document.querySelector('[data-e2e="user-fans-container"]'),
    document.querySelector('.i5YKH7Ag'),
    document.querySelector('body > div:nth-child(179) > div > div > div.MryVEcQW > div > div'),
    document.querySelector('[data-e2e="user-following-list"]'),
    document.querySelector('.MryVEcQW .i5YKH7Ag'),
    document.querySelector('main'),
    document.scrollingElement,
  ].filter(Boolean);

  for (let i = 0; i < candidates.length; i += 1) {
    if (isScrollable(candidates[i])) {
      return candidates[i];
    }
  }
  return candidates[0] || document.scrollingElement || document.documentElement;
}

function getCurrentSecUid() {
  const match = String(window.location.pathname || '').match(/\/user\/([^/?]+)/);
  return match && match[1] ? String(match[1]) : '';
}

function extractAwemeIdFromLi(li) {
  if (!li) {
    return '';
  }
  const anchors = Array.from(li.querySelectorAll('a[href]'));
  for (let i = 0; i < anchors.length; i += 1) {
    const href = String(anchors[i].getAttribute('href') || '');
    const m = href.match(/\/(video|note)\/(\d+)/);
    if (m && m[2]) {
      return String(m[2]);
    }
  }
  const html = li.outerHTML || '';
  const m = html.match(/"aweme_id"\s*:\s*"(\d+)"|aweme_id=(\d+)|\/(video|note)\/(\d+)/);
  return m ? String(m[1] || m[2] || m[4] || '') : '';
}

function readPostTypeMap(secUid) {
  return new Promise((resolve) => {
    if (!secUid) {
      resolve(new Map());
      return;
    }
    chrome.storage.local.get([DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid], (result) => {
      const bySecUid =
        result && result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid] &&
        typeof result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid] === 'object'
          ? result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid]
          : {};
      const snapshot = bySecUid[secUid] && typeof bySecUid[secUid] === 'object' ? bySecUid[secUid] : {};
      const posts = Array.isArray(snapshot.posts) ? snapshot.posts : [];
      const map = new Map();
      for (let i = 0; i < posts.length; i += 1) {
        const row = posts[i] || {};
        const awemeId = row.awemeId != null ? String(row.awemeId) : '';
        const type = row.postType != null ? String(row.postType) : '';
        if (awemeId && (type === 'video' || type === 'image')) {
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
    return { ok: false, reason: 'scroll_list_not_found' };
  }
  const secUid = getCurrentSecUid();
  const typeMap = await readPostTypeMap(secUid);
  const items = Array.from(list.querySelectorAll('li'));
  if (items.length === 0) {
    return { ok: false, reason: 'no_li_item' };
  }

  let show = 0;
  let hit = 0;
  for (let i = 0; i < items.length; i += 1) {
    const li = items[i];
    const awemeId = extractAwemeIdFromLi(li);
    const kind = awemeId ? typeMap.get(awemeId) : '';
    li.style.display = '';

    if (mode === 'all') {
      show += 1;
      continue;
    }

    if (kind === 'video' || kind === 'image') {
      hit += 1;
      if (kind === mode) {
        show += 1;
      } else {
        li.style.display = 'none';
      }
    } else {
      // 鏈噰闆嗗埌绫诲瀷鏃朵笉闅愯棌锛岄伩鍏嶈浼?      show += 1;
    }
  }

  return {
    ok: true,
    total: items.length,
    show,
    hit,
    secUid,
    mode,
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
      const isWindowScroller =
        container === document.scrollingElement || container === document.documentElement;
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
            requestUrl: 'dom://follow-visible',
            requestOffset: null,
            capturedAt: new Date().toISOString(),
          },
          meta: { source: 'dom_visible' },
        });
      }

      chrome.runtime.sendMessage({
        type: DY_FOLLOW_RUNTIME.SCROLL_TICK,
        payload: {
          ticks: state.ticks,
          href: window.location.href,
          sentAt: new Date().toISOString(),
        },
      });
    } catch {
      // 蹇界暐婊氬姩寮傚父
    }
  }, 900);

  console.log(DY_FOLLOW_PREFIX, '已开始自动滚动采集关注列表');
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
      sentAt: new Date().toISOString(),
      stopped: true,
    },
  });

  console.log(DY_FOLLOW_PREFIX, '已停止自动滚动采集关注列表');
}

export function initFollowAutoScroller() {
  window.addEventListener('message', (event) => {
    const payload = event && event.data ? event.data : null;
    if (!payload || payload.source !== DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE) {
      return;
    }
    if (payload.type !== DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE_RESULT) {
      return;
    }
    if (payload.ok) {
      console.log(DY_FOLLOW_PREFIX, '已主动补抓作品第一页接口');
      chrome.runtime.sendMessage({
        type: DY_FOLLOW_RUNTIME.POST_BOOTSTRAP_STATUS,
        payload: {
          ok: true,
          mode: payload.mode || 'request',
          secUid: payload.secUid || '',
          sentAt: new Date().toISOString(),
          href: window.location.href,
        },
      });
      return;
    }
    console.warn(DY_FOLLOW_PREFIX, `补抓作品第一页失败：${String(payload.reason || 'unknown')}`);
    chrome.runtime.sendMessage({
      type: DY_FOLLOW_RUNTIME.POST_BOOTSTRAP_STATUS,
      payload: {
        ok: false,
        mode: payload.mode || 'request',
        secUid: payload.secUid || '',
        reason: String(payload.reason || 'unknown'),
        sentAt: new Date().toISOString(),
        href: window.location.href,
      },
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
      const mode =
        message && message.payload && typeof message.payload.mode === 'string'
          ? String(message.payload.mode)
          : 'all';
      const normalized = mode === 'video' || mode === 'image' ? mode : 'all';
      applyPostFilter(normalized).then((ret) => sendResponse(ret));
      return true;
    }

    if (message.type === DY_FOLLOW_RUNTIME.GET_PAGE_CONTEXT) {
      sendResponse({
        ok: true,
        href: window.location.href,
        secUid: getCurrentSecUid(),
      });
      return true;
    }

    if (message.type === DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE) {
      window.postMessage(
        {
          source: DY_FOLLOW_RUNTIME.POST_MESSAGE_SOURCE,
          type: DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE,
        },
        '*',
      );
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });
}
