import { DY_FOLLOW_PREFIX, DY_FOLLOW_RUNTIME, DY_FOLLOW_STORAGE_KEYS } from '@/shared/constants.js';

const state = {
  timer: null,
  ticks: 0,
  mode: 'follow',
  stagnantTicks: 0,
  prevScrollTop: 0,
  prevScrollHeight: 0,
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

function collectPostCandidates() {
  const scrollList = document.querySelector('[data-e2e="scroll-list"]');
  const scrollListParent = scrollList ? findScrollableAncestor(scrollList) : null;

  const allNodes = Array.from(document.querySelectorAll('div[class], ul[class], main, section'));
  const classMatched = allNodes.filter((node) => {
    const cls = String(node.className || '');
    return (
      cls.includes('pCVdP6Bb') ||
      cls.includes('T9ZSs8iN') ||
      cls.includes('route-scroll-container') ||
      cls.includes('IHrj7RhK') ||
      cls.includes('U9C7HmQ0')
    );
  });

  return [
    scrollListParent,
    scrollList,
    document.querySelector('.pCVdP6Bb.T9ZSs8iN'),
    document.querySelector('[data-e2e="user-post-list"]'),
    document.querySelector('[data-e2e="user-post-item-list"]'),
    document.querySelector('.route-scroll-container'),
    ...classMatched,
    document.querySelector('main'),
    document.scrollingElement,
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
      // 未采集到类型时不隐藏，避免误伤
      show += 1;
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

function startScroll(mode) {
  if (state.timer) {
    return;
  }
  const isPostMode = mode === 'post';
  const container = isPostMode ? findPostScrollContainer() : findFollowScrollContainer();
  state.mode = isPostMode ? 'post' : 'follow';
  state.ticks = 0;
  state.stagnantTicks = 0;
  state.prevScrollTop = 0;
  state.prevScrollHeight = 0;

  if (isPostMode) {
    const className = container && container.className ? String(container.className) : '(无 class)';
    console.log(DY_FOLLOW_PREFIX, `作品滚动容器已选定: ${className}`);
  }

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

      if (isPostMode) {
        const currentTop = isWindowScroller
          ? Number(window.scrollY || document.documentElement.scrollTop || 0)
          : Number(container.scrollTop || 0);
        const currentHeight = isWindowScroller
          ? Number(document.body.scrollHeight || document.documentElement.scrollHeight || 0)
          : Number(container.scrollHeight || 0);
        const changed =
          Math.abs(currentTop - state.prevScrollTop) > 1 || Math.abs(currentHeight - state.prevScrollHeight) > 1;
        if (changed) {
          state.stagnantTicks = 0;
        } else {
          state.stagnantTicks += 1;
        }
        state.prevScrollTop = currentTop;
        state.prevScrollHeight = currentHeight;

        if (state.stagnantTicks >= 8) {
          stopScroll('post');
          chrome.runtime.sendMessage({
            type: DY_FOLLOW_RUNTIME.POST_SCROLL_TICK,
            payload: {
              ticks: state.ticks,
              href: window.location.href,
              sentAt: new Date().toISOString(),
              autoStopped: true,
              reason: 'no_more_progress',
            },
          });
          console.log(DY_FOLLOW_PREFIX, '作品区疑似已到底，已自动停止滚动');
          return;
        }
      }

      chrome.runtime.sendMessage({
        type: isPostMode ? DY_FOLLOW_RUNTIME.POST_SCROLL_TICK : DY_FOLLOW_RUNTIME.SCROLL_TICK,
        payload: {
          ticks: state.ticks,
          href: window.location.href,
          sentAt: new Date().toISOString(),
        },
      });
    } catch {
      // 忽略滚动异常
    }
  }, 900);

  console.log(DY_FOLLOW_PREFIX, isPostMode ? '已开始自动滚动采集作品' : '已开始自动滚动采集关注列表');
}

function stopScroll(mode) {
  if (!state.timer) {
    return;
  }
  const isPostMode = mode === 'post' || state.mode === 'post';
  clearInterval(state.timer);
  state.timer = null;
  state.stagnantTicks = 0;

  chrome.runtime.sendMessage({
    type: isPostMode ? DY_FOLLOW_RUNTIME.POST_SCROLL_TICK : DY_FOLLOW_RUNTIME.SCROLL_TICK,
    payload: {
      ticks: state.ticks,
      href: window.location.href,
      sentAt: new Date().toISOString(),
      stopped: true,
    },
  });

  console.log(DY_FOLLOW_PREFIX, isPostMode ? '已停止自动滚动采集作品' : '已停止自动滚动采集关注列表');
}

export function initFollowAutoScroller() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) {
      return false;
    }

    if (message.type === DY_FOLLOW_RUNTIME.START_CRAWL) {
      startScroll('follow');
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === DY_FOLLOW_RUNTIME.STOP_CRAWL) {
      stopScroll('follow');
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === DY_FOLLOW_RUNTIME.START_POST_CRAWL) {
      startScroll('post');
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === DY_FOLLOW_RUNTIME.STOP_POST_CRAWL) {
      stopScroll('post');
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

    return false;
  });
}
