import { DY_FOLLOW_PREFIX, DY_FOLLOW_RUNTIME } from '@/shared/constants.js';

const state = {
  timer: null,
  ticks: 0,
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
          sentAt: new Date().toISOString(),
        },
      });
    } catch {
      // 忽略滚动异常
    }
  }, 900);
  console.log(DY_FOLLOW_PREFIX, '已开始自动滚动采集');
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
  console.log(DY_FOLLOW_PREFIX, '已停止自动滚动采集');
}

export function initFollowAutoScroller() {
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
