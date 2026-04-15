import { getLocalAsync, safeSet } from '@rext-shared/services/index.js';
import {
  DY_FOLLOW_LIMITS,
  DY_FOLLOW_RUNTIME,
  DY_FOLLOW_STORAGE_KEYS,
} from '@/shared/constants.js';

const META_KEY = '__meta';
const requestStatsByTab = new Map();
const postRequestStatsByTab = new Map();

function userKey(user, index) {
  if (user && user.uid) {
    return `uid:${user.uid}`;
  }
  if (user && user.secUid) {
    return `sec:${user.secUid}`;
  }
  return `idx:${index}`;
}

function postKey(post, index) {
  if (post && post.awemeId) {
    return `aweme:${post.awemeId}`;
  }
  return `idx:${index}`;
}

function pruneByMeta(byTab, maxTabs) {
  if (!byTab || typeof byTab !== 'object') {
    return {};
  }
  const next = { ...byTab };
  const meta = next[META_KEY] && typeof next[META_KEY] === 'object' ? { ...next[META_KEY] } : {};
  const tabIds = Object.keys(next).filter((key) => key !== META_KEY);
  tabIds.sort((left, right) => String(meta[left] || '').localeCompare(String(meta[right] || '')));
  while (tabIds.length > maxTabs) {
    const oldest = tabIds.shift();
    delete next[oldest];
    delete meta[oldest];
  }
  next[META_KEY] = meta;
  return next;
}

function buildSummaryLine(payload, mergedCount) {
  const totalText = payload.total != null ? String(payload.total) : '?';
  const offsetText = payload.requestOffset != null ? String(payload.requestOffset) : '?';
  return `关注列表分页：offset=${offsetText}，本页=${payload.users.length}，合并后=${mergedCount}/${totalText}`;
}

function buildPostSummaryLine(payload, mergedCount) {
  const totalText = payload.total != null ? String(payload.total) : '?';
  const cursorText = payload.requestCursor != null ? String(payload.requestCursor) : '?';
  let imageCount = 0;
  let videoCount = 0;
  for (let i = 0; i < payload.posts.length; i += 1) {
    const type = payload.posts[i] && payload.posts[i].postType ? String(payload.posts[i].postType) : '';
    if (type === 'image') {
      imageCount += 1;
    } else if (type === 'video') {
      videoCount += 1;
    }
  }
  return `作品列表分页：cursor=${cursorText}，本页=${payload.posts.length}（图文=${imageCount}，视频=${videoCount}），合并后=${mergedCount}/${totalText}`;
}

function upsertCrawlState(tabId, patch) {
  if (tabId == null) {
    return;
  }
  getLocalAsync([DY_FOLLOW_STORAGE_KEYS.crawlStateByTab]).then((result) => {
    const byTab =
      result[DY_FOLLOW_STORAGE_KEYS.crawlStateByTab] &&
      typeof result[DY_FOLLOW_STORAGE_KEYS.crawlStateByTab] === 'object'
        ? { ...result[DY_FOLLOW_STORAGE_KEYS.crawlStateByTab] }
        : {};
    const tabKey = String(tabId);
    const prev = byTab[tabKey] && typeof byTab[tabKey] === 'object' ? { ...byTab[tabKey] } : {};
    byTab[tabKey] = {
      ...prev,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const meta = byTab[META_KEY] && typeof byTab[META_KEY] === 'object' ? { ...byTab[META_KEY] } : {};
    meta[tabKey] = new Date().toISOString();
    byTab[META_KEY] = meta;
    safeSet({
      [DY_FOLLOW_STORAGE_KEYS.crawlStateByTab]: pruneByMeta(byTab, DY_FOLLOW_LIMITS.SNAPSHOT_MAX_TABS),
    });
  });
}

function getNextStats(map, tabId, success) {
  const key = tabId == null ? 'global' : String(tabId);
  const prev = map.get(key) || { attempt: 0, success: 0, fail: 0 };
  const next = {
    attempt: prev.attempt + 1,
    success: prev.success + (success ? 1 : 0),
    fail: prev.fail + (success ? 0 : 1),
  };
  map.set(key, next);
  return next;
}

function appendLogByTab(tabId, level, message) {
  const entry = {
    t: new Date().toISOString(),
    level: level || 'log',
    msg: String(message || ''),
  };

  if (tabId == null) {
    getLocalAsync([DY_FOLLOW_STORAGE_KEYS.logs]).then((result) => {
      const data =
        result[DY_FOLLOW_STORAGE_KEYS.logs] &&
        typeof result[DY_FOLLOW_STORAGE_KEYS.logs] === 'object'
          ? { ...result[DY_FOLLOW_STORAGE_KEYS.logs] }
          : { entries: [] };
      const entries = Array.isArray(data.entries) ? [...data.entries] : [];
      entries.push(entry);
      data.entries = entries.slice(-DY_FOLLOW_LIMITS.LOG_MAX_ENTRIES);
      safeSet({ [DY_FOLLOW_STORAGE_KEYS.logs]: data });
    });
    return;
  }

  getLocalAsync([DY_FOLLOW_STORAGE_KEYS.logsByTab]).then((result) => {
    const byTab =
      result[DY_FOLLOW_STORAGE_KEYS.logsByTab] &&
      typeof result[DY_FOLLOW_STORAGE_KEYS.logsByTab] === 'object'
        ? { ...result[DY_FOLLOW_STORAGE_KEYS.logsByTab] }
        : {};
    const tabKey = String(tabId);
    const bucket = byTab[tabKey] && typeof byTab[tabKey] === 'object' ? { ...byTab[tabKey] } : {};
    const entries = Array.isArray(bucket.entries) ? [...bucket.entries] : [];
    entries.push(entry);
    bucket.entries = entries.slice(-DY_FOLLOW_LIMITS.LOG_MAX_ENTRIES);
    byTab[tabKey] = bucket;
    const meta = byTab[META_KEY] && typeof byTab[META_KEY] === 'object' ? { ...byTab[META_KEY] } : {};
    meta[tabKey] = new Date().toISOString();
    byTab[META_KEY] = meta;
    safeSet({
      [DY_FOLLOW_STORAGE_KEYS.logsByTab]: pruneByMeta(byTab, DY_FOLLOW_LIMITS.LOG_MAX_TABS),
    });
  });
}

function mergeUsers(oldUsers, nextUsers) {
  const source = Array.isArray(oldUsers) ? oldUsers : [];
  const incoming = Array.isArray(nextUsers) ? nextUsers : [];
  const map = new Map();
  for (let i = 0; i < source.length; i += 1) {
    const row = source[i];
    map.set(userKey(row, i), row);
  }
  for (let i = 0; i < incoming.length; i += 1) {
    const row = incoming[i];
    const key = userKey(row, i);
    const prev = map.get(key) || {};
    map.set(key, {
      ...prev,
      ...row,
      firstCapturedAt: prev.firstCapturedAt || new Date().toISOString(),
      lastCapturedAt: new Date().toISOString(),
    });
  }
  return Array.from(map.values()).slice(0, DY_FOLLOW_LIMITS.USER_MAX_ITEMS);
}

function mergePosts(oldPosts, nextPosts) {
  const source = Array.isArray(oldPosts) ? oldPosts : [];
  const incoming = Array.isArray(nextPosts) ? nextPosts : [];
  const map = new Map();
  for (let i = 0; i < source.length; i += 1) {
    const row = source[i];
    map.set(postKey(row, i), row);
  }
  for (let i = 0; i < incoming.length; i += 1) {
    const row = incoming[i];
    const key = postKey(row, i);
    const prev = map.get(key) || {};
    map.set(key, {
      ...prev,
      ...row,
      firstCapturedAt: prev.firstCapturedAt || new Date().toISOString(),
      lastCapturedAt: new Date().toISOString(),
    });
  }
  return Array.from(map.values()).slice(0, DY_FOLLOW_LIMITS.POST_MAX_ITEMS);
}

async function saveSnapshot(tabId, payload) {
  const result = await getLocalAsync([
    DY_FOLLOW_STORAGE_KEYS.snapshotByTab,
    DY_FOLLOW_STORAGE_KEYS.snapshotLatest,
  ]);
  const byTab =
    result[DY_FOLLOW_STORAGE_KEYS.snapshotByTab] &&
    typeof result[DY_FOLLOW_STORAGE_KEYS.snapshotByTab] === 'object'
      ? { ...result[DY_FOLLOW_STORAGE_KEYS.snapshotByTab] }
      : {};
  const tabKey = tabId != null ? String(tabId) : null;
  const current = tabKey && byTab[tabKey] && typeof byTab[tabKey] === 'object' ? byTab[tabKey] : {};
  const mergedUsers = mergeUsers(current.users, payload.users);
  const nextSnapshot = {
    users: mergedUsers,
    total: payload.total != null ? payload.total : current.total || null,
    hasMore: Boolean(payload.hasMore),
    nextOffset: payload.nextOffset != null ? payload.nextOffset : null,
    lastRequestOffset: payload.requestOffset != null ? payload.requestOffset : null,
    requestUrl: payload.requestUrl ? String(payload.requestUrl) : '',
    lastCapturedAt: payload.capturedAt || new Date().toISOString(),
  };

  if (tabKey) {
    byTab[tabKey] = nextSnapshot;
    const meta = byTab[META_KEY] && typeof byTab[META_KEY] === 'object' ? { ...byTab[META_KEY] } : {};
    meta[tabKey] = new Date().toISOString();
    byTab[META_KEY] = meta;
  }

  safeSet({
    [DY_FOLLOW_STORAGE_KEYS.snapshotLatest]: nextSnapshot,
    [DY_FOLLOW_STORAGE_KEYS.snapshotByTab]: pruneByMeta(byTab, DY_FOLLOW_LIMITS.SNAPSHOT_MAX_TABS),
  });
  return nextSnapshot;
}

async function savePostSnapshot(payload) {
  const secUid = payload.secUid ? String(payload.secUid) : '';
  if (!secUid) {
    return { posts: [] };
  }

  const result = await getLocalAsync([DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid]);
  const bySecUid =
    result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid] &&
    typeof result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid] === 'object'
      ? { ...result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid] }
      : {};

  const current = bySecUid[secUid] && typeof bySecUid[secUid] === 'object' ? bySecUid[secUid] : {};
  const mergedPosts = mergePosts(current.posts, payload.posts);

  let imageCount = 0;
  let videoCount = 0;
  for (let i = 0; i < mergedPosts.length; i += 1) {
    if (mergedPosts[i].postType === 'image') {
      imageCount += 1;
    } else if (mergedPosts[i].postType === 'video') {
      videoCount += 1;
    }
  }

  bySecUid[secUid] = {
    secUid,
    posts: mergedPosts,
    total: payload.total != null ? payload.total : current.total || null,
    hasMore: Boolean(payload.hasMore),
    nextCursor: payload.maxCursor != null ? payload.maxCursor : null,
    requestCursor: payload.requestCursor != null ? payload.requestCursor : null,
    requestUrl: payload.requestUrl ? String(payload.requestUrl) : '',
    imageCount,
    videoCount,
    lastCapturedAt: payload.capturedAt || new Date().toISOString(),
  };

  const keys = Object.keys(bySecUid);
  if (keys.length > DY_FOLLOW_LIMITS.POST_MAX_SEC_UID) {
    keys.sort((a, b) => {
      const ta = bySecUid[a] && bySecUid[a].lastCapturedAt ? String(bySecUid[a].lastCapturedAt) : '';
      const tb = bySecUid[b] && bySecUid[b].lastCapturedAt ? String(bySecUid[b].lastCapturedAt) : '';
      return ta.localeCompare(tb);
    });
    while (keys.length > DY_FOLLOW_LIMITS.POST_MAX_SEC_UID) {
      const oldest = keys.shift();
      delete bySecUid[oldest];
    }
  }

  safeSet({ [DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid]: bySecUid });
  return bySecUid[secUid];
}

function handleOpenUrlsBatch(message, sender, sendResponse) {
  const urls = Array.isArray(message.urls)
    ? message.urls.filter((item) => typeof item === 'string' && item)
    : [];
  const tabId =
    message.tabId != null
      ? Number(message.tabId)
      : sender.tab && sender.tab.id != null
        ? sender.tab.id
        : null;
  if (urls.length === 0) {
    sendResponse({ ok: false, opened: 0 });
    return true;
  }
  appendLogByTab(tabId, 'log', `开始批量打开：共 ${urls.length} 个主页`);
  let finished = 0;
  let failed = 0;
  for (let i = 0; i < urls.length; i += 1) {
    chrome.tabs.create({ url: urls[i], active: false }, () => {
      const err = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError : null;
      if (err) {
        failed += 1;
      }
      finished += 1;
      if (finished >= urls.length) {
        const okCount = urls.length - failed;
        if (failed > 0) {
          appendLogByTab(tabId, 'warn', `批量打开完成：成功 ${okCount}，失败 ${failed}`);
        } else {
          appendLogByTab(tabId, 'log', `批量打开完成：成功 ${okCount}`);
        }
      }
    });
  }
  sendResponse({ ok: true, opened: urls.length });
  return true;
}

function stopPostCrawlInTab(tabId) {
  if (tabId == null) {
    return;
  }
  chrome.tabs.sendMessage(tabId, { type: DY_FOLLOW_RUNTIME.STOP_POST_CRAWL }, () => {});
}

export function initFollowBackgroundService() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) {
      return false;
    }

    if (message.type === DY_FOLLOW_RUNTIME.GET_TAB_ID_MESSAGE) {
      sendResponse({ tabId: sender.tab && sender.tab.id != null ? sender.tab.id : null });
      return true;
    }

    if (message.type === DY_FOLLOW_RUNTIME.OPEN_URLS_BATCH) {
      return handleOpenUrlsBatch(message, sender, sendResponse);
    }

    if (message.type === DY_FOLLOW_RUNTIME.SCROLL_TICK || message.type === DY_FOLLOW_RUNTIME.POST_SCROLL_TICK) {
      const tabId = sender.tab && sender.tab.id != null ? sender.tab.id : null;
      const payload = message.payload || {};
      const isPostTick = message.type === DY_FOLLOW_RUNTIME.POST_SCROLL_TICK;
      upsertCrawlState(tabId, {
        running: !Boolean(payload.stopped),
        ticks: payload.ticks != null ? Number(payload.ticks) : 0,
        href: payload.href ? String(payload.href) : '',
        lastTickAt: payload.sentAt || new Date().toISOString(),
        mode: isPostTick ? 'post' : 'follow',
      });
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === DY_FOLLOW_RUNTIME.FOLLOW_CAPTURE) {
      const tabId = sender.tab && sender.tab.id != null ? sender.tab.id : null;
      if (!message.payload || !Array.isArray(message.payload.users)) {
        const reason = message.meta && message.meta.parseError ? String(message.meta.parseError) : '无有效 payload';
        const stats = getNextStats(requestStatsByTab, tabId, false);
        upsertCrawlState(tabId, {
          running: true,
          requestAttempt: stats.attempt,
          requestSuccess: stats.success,
          requestFail: stats.fail,
          lastRequestAt: new Date().toISOString(),
          mode: 'follow',
        });
        appendLogByTab(tabId, 'warn', `第 ${stats.attempt} 次关注请求失败：${reason}`);
        sendResponse({ ok: false });
        return true;
      }

      const stats = getNextStats(requestStatsByTab, tabId, true);
      saveSnapshot(tabId, message.payload)
        .then((snapshot) => {
          upsertCrawlState(tabId, {
            running: snapshot.hasMore,
            capturedCount: Array.isArray(snapshot.users) ? snapshot.users.length : 0,
            total: snapshot.total != null ? snapshot.total : null,
            hasMore: Boolean(snapshot.hasMore),
            nextOffset: snapshot.nextOffset != null ? snapshot.nextOffset : null,
            requestAttempt: stats.attempt,
            requestSuccess: stats.success,
            requestFail: stats.fail,
            lastRequestAt: new Date().toISOString(),
            lastCaptureAt: new Date().toISOString(),
            mode: 'follow',
          });
          appendLogByTab(tabId, 'log', buildSummaryLine(message.payload, snapshot.users.length));
          sendResponse({ ok: true, count: snapshot.users.length });
        })
        .catch((error) => {
          upsertCrawlState(tabId, {
            requestAttempt: stats.attempt,
            requestSuccess: stats.success,
            requestFail: stats.fail,
            lastRequestAt: new Date().toISOString(),
            mode: 'follow',
          });
          appendLogByTab(tabId, 'error', `保存关注列表失败：${String(error)}`);
          sendResponse({ ok: false });
        });
      return true;
    }

    if (message.type === DY_FOLLOW_RUNTIME.POST_CAPTURE) {
      const tabId = sender.tab && sender.tab.id != null ? sender.tab.id : null;
      if (!message.payload || !Array.isArray(message.payload.posts)) {
        const reason = message.meta && message.meta.parseError ? String(message.meta.parseError) : '无有效 payload';
        const stats = getNextStats(postRequestStatsByTab, tabId, false);
        upsertCrawlState(tabId, {
          postRequestAttempt: stats.attempt,
          postRequestSuccess: stats.success,
          postRequestFail: stats.fail,
          postLastRequestAt: new Date().toISOString(),
          mode: 'post',
        });
        appendLogByTab(tabId, 'warn', `第 ${stats.attempt} 次作品请求失败：${reason}`);
        sendResponse({ ok: false });
        return true;
      }

      const stats = getNextStats(postRequestStatsByTab, tabId, true);
      savePostSnapshot(message.payload)
        .then((snapshot) => {
          upsertCrawlState(tabId, {
            mode: 'post',
            postCapturedCount: Array.isArray(snapshot.posts) ? snapshot.posts.length : 0,
            postTotal: snapshot.total != null ? snapshot.total : null,
            postHasMore: Boolean(snapshot.hasMore),
            postNextCursor: snapshot.nextCursor != null ? snapshot.nextCursor : null,
            postImageCount: snapshot.imageCount != null ? snapshot.imageCount : 0,
            postVideoCount: snapshot.videoCount != null ? snapshot.videoCount : 0,
            postRequestAttempt: stats.attempt,
            postRequestSuccess: stats.success,
            postRequestFail: stats.fail,
            postLastRequestAt: new Date().toISOString(),
            postLastCaptureAt: new Date().toISOString(),
          });
          appendLogByTab(tabId, 'log', buildPostSummaryLine(message.payload, snapshot.posts.length));
          if (!snapshot.hasMore) {
            stopPostCrawlInTab(tabId);
            appendLogByTab(tabId, 'log', '作品分页已到末页，已自动停止滚动');
          }
          sendResponse({ ok: true, count: snapshot.posts.length });
        })
        .catch((error) => {
          upsertCrawlState(tabId, {
            mode: 'post',
            postRequestAttempt: stats.attempt,
            postRequestSuccess: stats.success,
            postRequestFail: stats.fail,
            postLastRequestAt: new Date().toISOString(),
          });
          appendLogByTab(tabId, 'error', `保存作品列表失败：${String(error)}`);
          sendResponse({ ok: false });
        });
      return true;
    }

    return false;
  });

  chrome.tabs.onRemoved.addListener(async (tabId) => {
    const tabKey = String(tabId);
    const result = await getLocalAsync([
      DY_FOLLOW_STORAGE_KEYS.snapshotByTab,
      DY_FOLLOW_STORAGE_KEYS.logsByTab,
      DY_FOLLOW_STORAGE_KEYS.selectionByTab,
      DY_FOLLOW_STORAGE_KEYS.crawlStateByTab,
    ]);
    const snapshotByTab =
      result[DY_FOLLOW_STORAGE_KEYS.snapshotByTab] &&
      typeof result[DY_FOLLOW_STORAGE_KEYS.snapshotByTab] === 'object'
        ? { ...result[DY_FOLLOW_STORAGE_KEYS.snapshotByTab] }
        : {};
    const logsByTab =
      result[DY_FOLLOW_STORAGE_KEYS.logsByTab] &&
      typeof result[DY_FOLLOW_STORAGE_KEYS.logsByTab] === 'object'
        ? { ...result[DY_FOLLOW_STORAGE_KEYS.logsByTab] }
        : {};
    const selectionByTab =
      result[DY_FOLLOW_STORAGE_KEYS.selectionByTab] &&
      typeof result[DY_FOLLOW_STORAGE_KEYS.selectionByTab] === 'object'
        ? { ...result[DY_FOLLOW_STORAGE_KEYS.selectionByTab] }
        : {};
    const crawlStateByTab =
      result[DY_FOLLOW_STORAGE_KEYS.crawlStateByTab] &&
      typeof result[DY_FOLLOW_STORAGE_KEYS.crawlStateByTab] === 'object'
        ? { ...result[DY_FOLLOW_STORAGE_KEYS.crawlStateByTab] }
        : {};

    delete snapshotByTab[tabKey];
    delete logsByTab[tabKey];
    delete selectionByTab[tabKey];
    delete crawlStateByTab[tabKey];
    if (snapshotByTab[META_KEY]) {
      delete snapshotByTab[META_KEY][tabKey];
    }
    if (logsByTab[META_KEY]) {
      delete logsByTab[META_KEY][tabKey];
    }
    if (selectionByTab[META_KEY]) {
      delete selectionByTab[META_KEY][tabKey];
    }
    if (crawlStateByTab[META_KEY]) {
      delete crawlStateByTab[META_KEY][tabKey];
    }
    safeSet({
      [DY_FOLLOW_STORAGE_KEYS.snapshotByTab]: snapshotByTab,
      [DY_FOLLOW_STORAGE_KEYS.logsByTab]: logsByTab,
      [DY_FOLLOW_STORAGE_KEYS.selectionByTab]: selectionByTab,
      [DY_FOLLOW_STORAGE_KEYS.crawlStateByTab]: crawlStateByTab,
    });
  });
}
