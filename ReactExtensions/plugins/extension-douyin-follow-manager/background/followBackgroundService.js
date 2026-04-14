import { getLocalAsync, safeSet } from '@rext-shared/services/index.js';
import {
  DY_FOLLOW_LIMITS,
  DY_FOLLOW_RUNTIME,
  DY_FOLLOW_STORAGE_KEYS,
} from '@/shared/constants.js';

const META_KEY = '__meta';
const requestStatsByTab = new Map();

function userKey(user, index) {
  if (user && user.uid) {
    return `uid:${user.uid}`;
  }
  if (user && user.secUid) {
    return `sec:${user.secUid}`;
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

function getNextRequestStats(tabId, success) {
  const key = tabId == null ? 'global' : String(tabId);
  const prev = requestStatsByTab.get(key) || { attempt: 0, success: 0, fail: 0 };
  const next = {
    attempt: prev.attempt + 1,
    success: prev.success + (success ? 1 : 0),
    fail: prev.fail + (success ? 0 : 1),
  };
  requestStatsByTab.set(key, next);
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

export function initFollowBackgroundService() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) {
      return false;
    }
    if (message.type === DY_FOLLOW_RUNTIME.GET_TAB_ID_MESSAGE) {
      if (sender.tab && sender.tab.id != null) {
        sendResponse({ tabId: sender.tab.id });
      } else {
        sendResponse({ tabId: null });
      }
      return true;
    }
    if (message.type !== DY_FOLLOW_RUNTIME.FOLLOW_CAPTURE) {
      if (message.type === DY_FOLLOW_RUNTIME.SCROLL_TICK) {
        const tabId = sender.tab && sender.tab.id != null ? sender.tab.id : null;
        const payload = message.payload || {};
        upsertCrawlState(tabId, {
          running: !Boolean(payload.stopped),
          ticks: payload.ticks != null ? Number(payload.ticks) : 0,
          href: payload.href ? String(payload.href) : '',
          lastTickAt: payload.sentAt || new Date().toISOString(),
        });
        sendResponse({ ok: true });
        return true;
      }
      return false;
    }

    const tabId = sender.tab && sender.tab.id != null ? sender.tab.id : null;
    if (!message.payload || !Array.isArray(message.payload.users)) {
      const reason = message.meta && message.meta.parseError ? String(message.meta.parseError) : '无有效 payload';
      const stats = getNextRequestStats(tabId, false);
      upsertCrawlState(tabId, {
        running: true,
        requestAttempt: stats.attempt,
        requestSuccess: stats.success,
        requestFail: stats.fail,
        lastRequestAt: new Date().toISOString(),
      });
      appendLogByTab(tabId, 'warn', `第 ${stats.attempt} 次请求：失败（${reason}）`);
      appendLogByTab(tabId, 'warn', `关注列表采集失败：${reason}`);
      sendResponse({ ok: false });
      return true;
    }

    const stats = getNextRequestStats(tabId, true);
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
        });
        appendLogByTab(
          tabId,
          'log',
          `第 ${stats.attempt} 次请求：成功（offset=${message.payload.requestOffset != null ? message.payload.requestOffset : '?'}，返回 ${message.payload.users.length} 条）`,
        );
        appendLogByTab(tabId, 'log', buildSummaryLine(message.payload, snapshot.users.length));
        sendResponse({ ok: true, count: snapshot.users.length });
      })
      .catch((error) => {
        upsertCrawlState(tabId, {
          requestAttempt: stats.attempt,
          requestSuccess: stats.success,
          requestFail: stats.fail,
          lastRequestAt: new Date().toISOString(),
        });
        appendLogByTab(tabId, 'error', `第 ${stats.attempt} 次请求：失败（保存异常）`);
        appendLogByTab(tabId, 'error', `保存关注列表失败：${String(error)}`);
        sendResponse({ ok: false });
      });
    return true;
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
