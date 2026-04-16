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

async function sendMessageToActiveTab(tabId, type, payload) {
  function sendToTab(targetTabId) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(targetTabId, { type, payload }, (response) => {
        const error = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError : null;
        if (error) {
          resolve({ ok: false, reason: String(error.message || error), targetTabId });
          return;
        }
        if (response && typeof response === 'object') {
          resolve({ ...response, targetTabId });
          return;
        }
        resolve({ ok: true, targetTabId });
      });
    });
  }

  const preferred = [];
  if (tabId != null) {
    preferred.push(Number(tabId));
  }
  const activeTab = await new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const first = Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null;
      resolve(first && first.id != null ? Number(first.id) : null);
    });
  });
  if (activeTab != null && !preferred.includes(activeTab)) {
    preferred.push(activeTab);
  }

  for (let i = 0; i < preferred.length; i += 1) {
    const ret = await sendToTab(preferred[i]);
    if (ret && ret.ok) {
      return ret;
    }
  }
  return { ok: false, reason: 'no_active_douyin_tab' };
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

function chooseBestImageUrl(image, useHighQualityDownload) {
  const row = image || {};
  const downloadList = Array.isArray(row.downloadUrlList) ? row.downloadUrlList : [];
  const normalList = Array.isArray(row.urlList) ? row.urlList : [];

  const cleanNormalList = normalList.filter((item) => !/water-v2/i.test(String(item || '')));
  const cleanDownloadList = downloadList.filter((item) => !/water-v2/i.test(String(item || '')));

  const highQualityMode = Boolean(useHighQualityDownload);
  const primaryPool = highQualityMode
    ? (downloadList.length > 0 ? downloadList : normalList)
    : (cleanNormalList.length > 0 ? cleanNormalList : cleanDownloadList);
  const fallbackPool = highQualityMode
    ? (normalList.length > 0 ? normalList : cleanDownloadList)
    : (normalList.length > 0 ? normalList : downloadList);
  const all = primaryPool.length > 0 ? primaryPool : fallbackPool;
  if (all.length === 0) {
    return '';
  }

  const nonQ75 = all.filter((item) => !/q75/i.test(String(item || '')));
  const targetPool = nonQ75.length > 0 ? nonQ75 : all;

  const noopJpeg = targetPool.find((item) => /~noop\.jpe?g(\?|$)/i.test(String(item || '')));
  if (noopJpeg) return String(noopJpeg);

  const jpeg = targetPool.find((item) => /\.jpe?g(\?|$)/i.test(String(item || '')));
  if (jpeg) return String(jpeg);

  const noop = targetPool.find((item) => /~noop\./i.test(String(item || '')));
  if (noop) return String(noop);

  return String(targetPool[0] || '');
}

function buildImageExportRows(snapshot, useHighQualityDownload) {
  const posts = snapshot && Array.isArray(snapshot.posts) ? snapshot.posts : [];
  const rows = [];
  let bloggerName = '';
  for (let i = 0; i < posts.length; i += 1) {
    const post = posts[i] || {};
    if (String(post.postType || '') !== 'image') {
      continue;
    }
    if (!bloggerName && post.authorNickname) {
      bloggerName = String(post.authorNickname);
    }
    const awemeId = post.awemeId != null ? String(post.awemeId) : '';
    const images = Array.isArray(post.images) ? post.images : [];
    for (let j = 0; j < images.length; j += 1) {
      const url = chooseBestImageUrl(images[j], useHighQualityDownload);
      if (!url) {
        continue;
      }
      rows.push({
        awemeId,
        imageIndex: j + 1,
        url,
      });
    }
  }
  return {
    rows,
    bloggerName: bloggerName || '',
  };
}

function parseSecUidFromUrl(url) {
  const text = String(url || '');
  const match = text.match(/\/user\/([^/?#]+)/);
  return match && match[1] ? String(match[1]) : '';
}

async function getPostSnapshotBySecUid() {
  const result = await getLocalAsync([DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid]);
  return result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid] &&
    typeof result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid] === 'object'
    ? result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid]
    : {};
}

async function getPostRecentSecUidByTab() {
  const result = await getLocalAsync([DY_FOLLOW_STORAGE_KEYS.postRecentSecUidByTab]);
  return result[DY_FOLLOW_STORAGE_KEYS.postRecentSecUidByTab] &&
    typeof result[DY_FOLLOW_STORAGE_KEYS.postRecentSecUidByTab] === 'object'
    ? result[DY_FOLLOW_STORAGE_KEYS.postRecentSecUidByTab]
    : {};
}

async function clearPostUrlCache() {
  await new Promise((resolve) => {
    safeSet(
      {
        [DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid]: {},
        [DY_FOLLOW_STORAGE_KEYS.postRecentSecUidByTab]: {},
      },
      () => resolve(),
    );
  });
}

function getTabSecUid(tabId) {
  function fromTab(candidateTab) {
    if (!candidateTab || !candidateTab.url) {
      return '';
    }
    const url = String(candidateTab.url);
    if (!/^https:\/\/(www\.)?douyin\.com\/user\//i.test(url) && !/^https:\/\/www-hj\.douyin\.com\/user\//i.test(url)) {
      return '';
    }
    return parseSecUidFromUrl(url);
  }

  function queryTabs(queryInfo) {
    return new Promise((resolve) => {
      chrome.tabs.query(queryInfo, (tabs) => {
        resolve(Array.isArray(tabs) ? tabs : []);
      });
    });
  }

  async function pickFromLastFocusedWindow() {
    const activeTabs = await queryTabs({ active: true, lastFocusedWindow: true });
    if (activeTabs.length > 0) {
      const secUid = fromTab(activeTabs[0]);
      if (secUid) {
        return secUid;
      }
    }

    const userTabs = await queryTabs({
      lastFocusedWindow: true,
      url: ['https://www.douyin.com/user/*', 'https://www-hj.douyin.com/user/*'],
    });
    for (let i = userTabs.length - 1; i >= 0; i -= 1) {
      const secUid = fromTab(userTabs[i]);
      if (secUid) {
        return secUid;
      }
    }
    return '';
  }

  return new Promise((resolve) => {
    // 优先使用当前激活标签页，避免命中 popup 初始化时缓存的旧 tabId
    pickFromLastFocusedWindow().then((secUidFromActive) => {
      if (secUidFromActive) {
        resolve(secUidFromActive);
        return;
      }

      if (tabId != null) {
        chrome.tabs.get(tabId, (tab) => {
          const err = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError : null;
          if (!err) {
            const secUid = fromTab(tab);
            resolve(secUid || '');
            return;
          }
          resolve('');
        });
        return;
      }

      resolve('');
    });
  });
}

export function useFollowPopupActions({
  tabId,
  rows,
  loadAll,
  markByKeys,
  useHighQualityDownload,
}) {
  const onOpenUserHome = useCallback(
    async (row) => {
      if (!row) {
        return;
      }
      const url = buildUserUrl(row);
      if (!url) {
        appendUiLog(tabId, 'warn', '打开主页失败：无有效链接');
        return;
      }
      await markByKeys([row.id], '已查看');
      chrome.tabs.create({ url, active: true });
      appendUiLog(tabId, 'log', `已打开主页：${row.nickname || row.id}`);
      loadAll();
    },
    [loadAll, markByKeys, tabId],
  );

  const onStartCrawl = useCallback(async () => {
    const bootstrap = await sendMessageToActiveTab(tabId, DY_FOLLOW_RUNTIME.BOOTSTRAP_FOLLOW_CAPTURE);
    if (bootstrap && bootstrap.ok) {
      appendUiLog(tabId, 'log', `关注首页补抓成功：本页 ${Number(bootstrap.count || 0)} 条`);
    } else {
      const reason = bootstrap && bootstrap.reason ? String(bootstrap.reason) : 'unknown';
      appendUiLog(tabId, 'warn', `关注首页补抓未命中：${reason}（将继续滚动采集）`);
    }

    const ret = await sendMessageToActiveTab(tabId, DY_FOLLOW_RUNTIME.START_CRAWL);
    if (ret && ret.ok) {
      appendUiLog(tabId, 'log', '已开始自动滚动采集关注列表，请保持在抖音关注页');
    } else {
      appendUiLog(tabId, 'warn', '开始采集失败：请先打开抖音主页并切到关注列表');
    }
  }, [tabId]);

  const onStartPostCrawl = useCallback(async () => {
    const ctx = await sendMessageToActiveTab(tabId, DY_FOLLOW_RUNTIME.GET_PAGE_CONTEXT);
    if (!ctx || !ctx.ok || !ctx.secUid) {
      appendUiLog(tabId, 'warn', '滚动获取作品失败：请先打开抖音博主主页');
      return;
    }

    await clearPostUrlCache();
    appendUiLog(tabId, 'log', '已清空历史作品URL缓存，将采集当前博主新数据');

    const ret = await sendMessageToActiveTab(
      ctx && ctx.targetTabId != null ? ctx.targetTabId : tabId,
      DY_FOLLOW_RUNTIME.START_POST_CRAWL,
    );
    if (ret && ret.ok) {
      const secUidText = ctx && ctx.secUid ? `，secUid=${ctx.secUid}` : '';
      appendUiLog(tabId, 'log', `已开始接口分页采集作品，请保持在博主个人主页作品区${secUidText}`);
      if (ret.alreadyRunning) {
        appendUiLog(tabId, 'log', '作品采集任务已在运行中，无需重复启动');
      }
    } else {
      appendUiLog(tabId, 'warn', '接口分页采集作品失败：请先打开抖音博主主页');
    }
  }, [tabId]);

  const onStopCrawl = useCallback(async () => {
    const follow = await sendMessageToActiveTab(tabId, DY_FOLLOW_RUNTIME.STOP_CRAWL);
    const post = await sendMessageToActiveTab(tabId, DY_FOLLOW_RUNTIME.STOP_POST_CRAWL);
    if ((follow && follow.ok) || (post && post.ok)) {
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
        result[DY_FOLLOW_STORAGE_KEYS.snapshotByTab] && typeof result[DY_FOLLOW_STORAGE_KEYS.snapshotByTab] === 'object'
          ? { ...result[DY_FOLLOW_STORAGE_KEYS.snapshotByTab] }
          : {};
      const crawlByTab =
        result[DY_FOLLOW_STORAGE_KEYS.crawlStateByTab] && typeof result[DY_FOLLOW_STORAGE_KEYS.crawlStateByTab] === 'object'
          ? { ...result[DY_FOLLOW_STORAGE_KEYS.crawlStateByTab] }
          : {};
      const selectionByTab =
        result[DY_FOLLOW_STORAGE_KEYS.selectionByTab] && typeof result[DY_FOLLOW_STORAGE_KEYS.selectionByTab] === 'object'
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
        [DY_FOLLOW_STORAGE_KEYS.viewState]: {},
        [DY_FOLLOW_STORAGE_KEYS.popupViewStateByTab]: {},
        [DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid]: {},
      });
      appendUiLog(tabId, 'log', '已清空列表缓存与查看状态，可重新开始采集');
      loadAll();
    });
  }, [loadAll, tabId]);

  const onOpenRandomTen = useCallback(async () => {
    const candidates = rows.filter((row) => row.viewStatus !== '已查看');
    const pool = candidates.length > 0 ? candidates : rows;
    const targets = pickRandomRows(pool, 10);
    const urls = targets.map((row) => buildUserUrl(row)).filter(Boolean);
    const targetIds = targets.map((row) => row.id);
    await markByKeys(targetIds, '已查看');
    chrome.runtime.sendMessage({
      type: DY_FOLLOW_RUNTIME.OPEN_URLS_BATCH,
      tabId,
      urls,
    });
    appendUiLog(tabId, 'log', `已随机打开 ${targets.length} 个主页`);
    loadAll();
  }, [loadAll, markByKeys, rows, tabId]);

  const onOpenRandomTwenty = useCallback(async () => {
    const candidates = rows.filter((row) => row.viewStatus !== '已查看');
    const pool = candidates.length > 0 ? candidates : rows;
    const targets = pickRandomRows(pool, 20);
    const urls = targets.map((row) => buildUserUrl(row)).filter(Boolean);
    const targetIds = targets.map((row) => row.id);
    await markByKeys(targetIds, '已查看');
    chrome.runtime.sendMessage({
      type: DY_FOLLOW_RUNTIME.OPEN_URLS_BATCH,
      tabId,
      urls,
    });
    appendUiLog(tabId, 'log', `已随机打开 ${targets.length} 个主页`);
    loadAll();
  }, [loadAll, markByKeys, rows, tabId]);

  const onExportPostImageUrls = useCallback(async () => {
    const pageContext = await sendMessageToActiveTab(tabId, DY_FOLLOW_RUNTIME.GET_PAGE_CONTEXT);
    const pageSecUid =
      pageContext && pageContext.ok && pageContext.secUid ? String(pageContext.secUid) : '';
    const currentSecUid = pageSecUid || (await getTabSecUid(tabId));
    const targetTabId =
      pageContext && pageContext.targetTabId != null ? Number(pageContext.targetTabId) : tabId;

    if (!currentSecUid) {
      appendUiLog(tabId, 'warn', '导出失败：当前激活页不是博主主页（未识别到 secUid）');
      return;
    }

    let bySecUid = await getPostSnapshotBySecUid();
    let finalSecUid = currentSecUid;
    if (!bySecUid[finalSecUid] && targetTabId != null) {
      const byTab = await getPostRecentSecUidByTab();
      const hit = byTab[String(targetTabId)] && byTab[String(targetTabId)].secUid
        ? String(byTab[String(targetTabId)].secUid)
        : '';
      if (hit && bySecUid[hit]) {
        finalSecUid = hit;
        appendUiLog(tabId, 'log', `导出路由修正：当前页=${currentSecUid}，最近捕获=${hit}`);
      }
    }

    if (!bySecUid[finalSecUid]) {
      appendUiLog(tabId, 'log', '当前博主暂无作品快照，正在尝试补抓第一页...');
      await sendMessageToActiveTab(targetTabId, DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE);
      await sendMessageToActiveTab(targetTabId, DY_FOLLOW_RUNTIME.BOOTSTRAP_POST_CAPTURE_FALLBACK);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      bySecUid = await getPostSnapshotBySecUid();
      if (!bySecUid[finalSecUid] && targetTabId != null) {
        const byTab = await getPostRecentSecUidByTab();
        const hit = byTab[String(targetTabId)] && byTab[String(targetTabId)].secUid
          ? String(byTab[String(targetTabId)].secUid)
          : '';
        if (hit && bySecUid[hit]) {
          finalSecUid = hit;
          appendUiLog(tabId, 'log', `补抓后路由修正：当前页=${currentSecUid}，最近捕获=${hit}`);
        }
      }
    }

    if (!bySecUid[finalSecUid]) {
      const keys = Object.keys(bySecUid);
      appendUiLog(
        tabId,
        'warn',
        `导出失败：当前博主无快照（page=${currentSecUid}，tab=${String(targetTabId ?? '-') }，已存=${keys.length}）`,
      );
      return;
    }

    const targetSecUid = finalSecUid;
    const target = bySecUid[targetSecUid] && typeof bySecUid[targetSecUid] === 'object' ? bySecUid[targetSecUid] : {};
    const exportResult = buildImageExportRows(target, useHighQualityDownload);
    const exportRows = exportResult.rows;
    if (exportRows.length === 0) {
      appendUiLog(tabId, 'warn', '导出失败：当前博主暂无图文图片URL');
      return;
    }
    const bloggerName = exportResult.bloggerName || `secuid_${targetSecUid}`;
    const exportMode = useHighQualityDownload ? '最高清down_url（可能有水印）' : '无水印优先';

    const payload = JSON.stringify(
      {
        bloggerName,
        secUid: targetSecUid,
        count: exportRows.length,
        rows: exportRows,
      },
      null,
      2,
    );
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = 'images.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(href), 8000);
    appendUiLog(tabId, 'log', `导出成功：${bloggerName}（${targetSecUid}），共 ${exportRows.length} 条图片URL，模式=${exportMode}`);
  }, [tabId, useHighQualityDownload]);

  const onClearLogs = useCallback(() => {
    if (tabId == null) {
      safeSet({ [DY_FOLLOW_STORAGE_KEYS.logs]: { entries: [] } });
      return;
    }
    getLocalAsync([DY_FOLLOW_STORAGE_KEYS.logsByTab]).then((result) => {
      const byTab =
        result[DY_FOLLOW_STORAGE_KEYS.logsByTab] && typeof result[DY_FOLLOW_STORAGE_KEYS.logsByTab] === 'object'
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
    onOpenUserHome,
    onStartCrawl,
    onStartPostCrawl,
    onStopCrawl,
    onRefresh,
    onClearList,
    onOpenRandomTen,
    onOpenRandomTwenty,
    onExportPostImageUrls,
    onClearLogs,
  };
}
