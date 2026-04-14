import { useCallback } from 'react';
import { getLocalAsync, safeSet } from '@rext-shared/services/index.js';
import {
  DY_FOLLOW_LIMITS,
  DY_FOLLOW_RUNTIME,
  DY_FOLLOW_STORAGE_KEYS,
} from '@/shared/constants.js';
import { buildUserUrl } from '@/popup/utils/followRowUtils.js';

const META_KEY = '__meta';

function appendUiLog(tabId, level, message) {
  const entry = {
    t: new Date().toISOString(),
    level: level || 'log',
    msg: String(message || ''),
  };
  const key = DY_FOLLOW_STORAGE_KEYS.logsByTab;
  getLocalAsync([key]).then((result) => {
    const byTab = result[key] && typeof result[key] === 'object' ? { ...result[key] } : {};
    const tabKey = tabId != null ? String(tabId) : 'global';
    const bucket = byTab[tabKey] && typeof byTab[tabKey] === 'object' ? { ...byTab[tabKey] } : {};
    const entries = Array.isArray(bucket.entries) ? [...bucket.entries] : [];
    entries.push(entry);
    bucket.entries = entries.slice(-DY_FOLLOW_LIMITS.LOG_MAX_ENTRIES);
    byTab[tabKey] = bucket;
    const meta = byTab[META_KEY] && typeof byTab[META_KEY] === 'object' ? { ...byTab[META_KEY] } : {};
    meta[tabKey] = new Date().toISOString();
    byTab[META_KEY] = meta;
    safeSet({ [key]: byTab });
  });
}

async function sendMessageToActiveTab(tabId, type) {
  function sendToTab(targetTabId) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(targetTabId, { type }, () => {
        const error = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError : null;
        resolve(!error);
      });
    });
  }

  if (tabId != null) {
    const ok = await sendToTab(tabId);
    if (ok) {
      return true;
    }
  }

  const tabs = await new Promise((resolve) => {
    chrome.tabs.query(
      {
        url: ['https://www.douyin.com/*', 'https://www-hj.douyin.com/*'],
      },
      (foundTabs) => {
        resolve(Array.isArray(foundTabs) ? foundTabs : []);
      },
    );
  });

  for (let i = 0; i < tabs.length; i += 1) {
    const item = tabs[i];
    if (!item || item.id == null) {
      continue;
    }
    const ok = await sendToTab(item.id);
    if (ok) {
      return true;
    }
  }
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTabInactive(url) {
  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, () => {
      resolve();
    });
  });
}

function pickRandomRows(rows, size) {
  const list = Array.isArray(rows) ? [...rows] : [];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = list[i];
    list[i] = list[j];
    list[j] = temp;
  }
  return list.slice(0, size);
}

export function useFollowPopupActions({ tabId, rows, loadAll, markByKeys }) {
  const onStartCrawl = useCallback(async () => {
    const ok = await sendMessageToActiveTab(tabId, DY_FOLLOW_RUNTIME.START_CRAWL);
    if (ok) {
      appendUiLog(tabId, 'log', '已开始自动滚动采集，请保持在抖音关注页');
    } else {
      appendUiLog(tabId, 'warn', '开始采集失败：请先打开抖音主页并切到关注列表');
    }
  }, [tabId]);

  const onStopCrawl = useCallback(async () => {
    const ok = await sendMessageToActiveTab(tabId, DY_FOLLOW_RUNTIME.STOP_CRAWL);
    if (ok) {
      appendUiLog(tabId, 'log', '已停止自动滚动采集');
    } else {
      appendUiLog(tabId, 'warn', '停止采集失败：当前标签页不可通信');
    }
  }, [tabId]);

  const onRefresh = useCallback(() => {
    loadAll();
    appendUiLog(tabId, 'log', '已刷新 popup 数据');
  }, [loadAll, tabId]);

  const onClearList = useCallback(() => {
    getLocalAsync([
      DY_FOLLOW_STORAGE_KEYS.snapshotByTab,
      DY_FOLLOW_STORAGE_KEYS.crawlStateByTab,
      DY_FOLLOW_STORAGE_KEYS.selectionByTab,
    ]).then((result) => {
      const snapshotByTab =
        result[DY_FOLLOW_STORAGE_KEYS.snapshotByTab] &&
        typeof result[DY_FOLLOW_STORAGE_KEYS.snapshotByTab] === 'object'
          ? { ...result[DY_FOLLOW_STORAGE_KEYS.snapshotByTab] }
          : {};
      const crawlByTab =
        result[DY_FOLLOW_STORAGE_KEYS.crawlStateByTab] &&
        typeof result[DY_FOLLOW_STORAGE_KEYS.crawlStateByTab] === 'object'
          ? { ...result[DY_FOLLOW_STORAGE_KEYS.crawlStateByTab] }
          : {};
      const selectionByTab =
        result[DY_FOLLOW_STORAGE_KEYS.selectionByTab] &&
        typeof result[DY_FOLLOW_STORAGE_KEYS.selectionByTab] === 'object'
          ? { ...result[DY_FOLLOW_STORAGE_KEYS.selectionByTab] }
          : {};

      if (tabId != null) {
        const tabKey = String(tabId);
        delete snapshotByTab[tabKey];
        delete crawlByTab[tabKey];
        delete selectionByTab[tabKey];
        if (snapshotByTab[META_KEY]) {
          delete snapshotByTab[META_KEY][tabKey];
        }
        if (crawlByTab[META_KEY]) {
          delete crawlByTab[META_KEY][tabKey];
        }
        if (selectionByTab[META_KEY]) {
          delete selectionByTab[META_KEY][tabKey];
        }
      }

      safeSet({
        [DY_FOLLOW_STORAGE_KEYS.snapshotByTab]: snapshotByTab,
        [DY_FOLLOW_STORAGE_KEYS.snapshotLatest]: { users: [] },
        [DY_FOLLOW_STORAGE_KEYS.crawlStateByTab]: crawlByTab,
        [DY_FOLLOW_STORAGE_KEYS.selectionByTab]: selectionByTab,
        [DY_FOLLOW_STORAGE_KEYS.selectionGlobal]: { ids: [] },
      });
      appendUiLog(tabId, 'log', '已清空列表缓存，可重新开始采集');
      loadAll();
    });
  }, [loadAll, tabId]);

  const onOpenRandomTen = useCallback(async () => {
    const candidates = rows.filter((row) => row.viewStatus !== '已查看');
    const pool = candidates.length > 0 ? candidates : rows;
    const targets = pickRandomRows(pool, 10);
    const targetIds = targets.map((row) => row.id);
    await markByKeys(targetIds, '已查看');
    for (let i = 0; i < targets.length; i += 1) {
      const url = buildUserUrl(targets[i]);
      if (!url) {
        continue;
      }
      await createTabInactive(url);
      await sleep(280);
    }
    appendUiLog(tabId, 'log', `已随机打开 ${targets.length} 个主页`);
    loadAll();
  }, [loadAll, markByKeys, rows, tabId]);

  const onClearLogs = useCallback(() => {
    if (tabId == null) {
      safeSet({ [DY_FOLLOW_STORAGE_KEYS.logs]: { entries: [] } });
      return;
    }
    getLocalAsync([DY_FOLLOW_STORAGE_KEYS.logsByTab]).then((result) => {
      const byTab =
        result[DY_FOLLOW_STORAGE_KEYS.logsByTab] &&
        typeof result[DY_FOLLOW_STORAGE_KEYS.logsByTab] === 'object'
          ? { ...result[DY_FOLLOW_STORAGE_KEYS.logsByTab] }
          : {};
      const tabKey = String(tabId);
      delete byTab[tabKey];
      if (byTab[META_KEY] && typeof byTab[META_KEY] === 'object') {
        delete byTab[META_KEY][tabKey];
      }
      safeSet({ [DY_FOLLOW_STORAGE_KEYS.logsByTab]: byTab });
    });
  }, [tabId]);

  return {
    onStartCrawl,
    onStopCrawl,
    onRefresh,
    onClearList,
    onOpenRandomTen,
    onClearLogs,
  };
}
