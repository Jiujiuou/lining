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
          resolve({ ok: false, reason: String(error.message || error) });
          return;
        }
        if (response && typeof response === 'object') {
          resolve(response);
          return;
        }
        resolve({ ok: true });
      });
    });
  }

  if (tabId != null) {
    const first = await sendToTab(tabId);
    if (first && first.ok) {
      return first;
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
    const ret = await sendToTab(item.id);
    if (ret && ret.ok) {
      return ret;
    }
  }
  return { ok: false, reason: 'no_tab' };
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

function chooseBestImageUrl(image) {
  const row = image || {};
  const downloadList = Array.isArray(row.downloadUrlList) ? row.downloadUrlList : [];
  const normalList = Array.isArray(row.urlList) ? row.urlList : [];
  const cleanNormalList = normalList.filter((item) => !/water-v2/i.test(String(item || '')));
  const cleanDownloadList = downloadList.filter((item) => !/water-v2/i.test(String(item || '')));

  // 无水印优先：先 normal(url_list)，再 download(download_url_list) 里非 water-v2 的兜底
  const preferred = cleanNormalList.length > 0 ? cleanNormalList : cleanDownloadList;
  const fallback = normalList.length > 0 ? normalList : downloadList;
  const all = preferred.length > 0 ? preferred : fallback;
  if (all.length === 0) {
    return '';
  }
  const noopJpeg = all.find((item) => /~noop\.jpe?g(\?|$)/i.test(String(item || '')));
  if (noopJpeg) {
    return String(noopJpeg);
  }
  const jpeg = all.find((item) => /\.jpe?g(\?|$)/i.test(String(item || '')));
  if (jpeg) {
    return String(jpeg);
  }
  return String(all[0] || '');
}

function buildImageExportRows(snapshot) {
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
      const url = chooseBestImageUrl(images[j]);
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

export function useFollowPopupActions({ tabId, rows, loadAll, markByKeys, openByAwemeLimit }) {
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
    const ret = await sendMessageToActiveTab(tabId, DY_FOLLOW_RUNTIME.START_CRAWL);
    if (ret && ret.ok) {
      appendUiLog(tabId, 'log', '已开始自动滚动采集关注列表，请保持在抖音关注页');
    } else {
      appendUiLog(tabId, 'warn', '开始采集失败：请先打开抖音主页并切到关注列表');
    }
  }, [tabId]);

  const onStartPostCrawl = useCallback(async () => {
    const ret = await sendMessageToActiveTab(tabId, DY_FOLLOW_RUNTIME.START_POST_CRAWL);
    if (ret && ret.ok) {
      appendUiLog(tabId, 'log', '已开始滚动获取作品，请保持在博主个人主页作品区');
    } else {
      appendUiLog(tabId, 'warn', '滚动获取作品失败：请先打开抖音博主主页');
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

  const onFilterPostAll = useCallback(async () => {
    const ret = await sendMessageToActiveTab(tabId, DY_FOLLOW_RUNTIME.SET_POST_FILTER, { mode: 'all' });
    if (ret && ret.ok) {
      appendUiLog(tabId, 'log', `作品筛选：全部（显示 ${ret.show || 0}/${ret.total || 0}）`);
    } else {
      appendUiLog(tabId, 'warn', '切换全部失败：请先打开博主主页作品区');
    }
  }, [tabId]);

  const onFilterPostVideo = useCallback(async () => {
    const ret = await sendMessageToActiveTab(tabId, DY_FOLLOW_RUNTIME.SET_POST_FILTER, { mode: 'video' });
    if (ret && ret.ok) {
      appendUiLog(tabId, 'log', `作品筛选：只看视频（显示 ${ret.show || 0}/${ret.total || 0}）`);
    } else {
      appendUiLog(tabId, 'warn', '切换只看视频失败：请先滚动采集作品');
    }
  }, [tabId]);

  const onFilterPostImage = useCallback(async () => {
    const ret = await sendMessageToActiveTab(tabId, DY_FOLLOW_RUNTIME.SET_POST_FILTER, { mode: 'image' });
    if (ret && ret.ok) {
      appendUiLog(tabId, 'log', `作品筛选：只看图片（显示 ${ret.show || 0}/${ret.total || 0}）`);
    } else {
      appendUiLog(tabId, 'warn', '切换只看图片失败：请先滚动采集作品');
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

  const onOpenByAwemeLimit = useCallback(async () => {
    const limit = Number(openByAwemeLimit);
    if (!Number.isFinite(limit) || limit < 0) {
      appendUiLog(tabId, 'warn', '请输入有效的作品数阈值（>=0）');
      return;
    }
    const targets = rows.filter((row) => {
      if (row.awemeCount == null || row.awemeCount === '') {
        return false;
      }
      const awemeCount = Number(row.awemeCount);
      if (!Number.isFinite(awemeCount) || awemeCount < 0) {
        return false;
      }
      return awemeCount <= limit;
    });
    if (targets.length === 0) {
      appendUiLog(tabId, 'warn', `没有作品数 <= ${limit} 的博主`);
      return;
    }
    const urls = targets.map((row) => buildUserUrl(row)).filter(Boolean);
    chrome.runtime.sendMessage({
      type: DY_FOLLOW_RUNTIME.OPEN_URLS_BATCH,
      tabId,
      urls,
    });
    appendUiLog(tabId, 'log', `已打开作品数 <= ${limit} 的博主：${targets.length} 个`);
  }, [openByAwemeLimit, rows, tabId]);

  const onExportPostImageUrls = useCallback(() => {
    getLocalAsync([DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid]).then((result) => {
      const bySecUid =
        result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid] &&
        typeof result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid] === 'object'
          ? result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid]
          : {};
      const secUids = Object.keys(bySecUid);
      if (secUids.length === 0) {
        appendUiLog(tabId, 'warn', '导出失败：暂无作品采集数据，请先滚动获取作品');
        return;
      }

      secUids.sort((left, right) => {
        const leftTime = bySecUid[left] && bySecUid[left].lastCapturedAt ? String(bySecUid[left].lastCapturedAt) : '';
        const rightTime = bySecUid[right] && bySecUid[right].lastCapturedAt ? String(bySecUid[right].lastCapturedAt) : '';
        return rightTime.localeCompare(leftTime);
      });
      const targetSecUid = secUids[0];
      const target = bySecUid[targetSecUid] && typeof bySecUid[targetSecUid] === 'object' ? bySecUid[targetSecUid] : {};
      const exportResult = buildImageExportRows(target);
      const exportRows = exportResult.rows;
      if (exportRows.length === 0) {
        appendUiLog(tabId, 'warn', '导出失败：当前博主暂无图文图片URL');
        return;
      }
      const bloggerName = exportResult.bloggerName || `secuid_${targetSecUid}`;

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
      appendUiLog(tabId, 'log', `导出成功：共 ${exportRows.length} 条图片URL`);
    });
  }, [tabId]);

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
    onOpenUserHome,
    onStartCrawl,
    onStartPostCrawl,
    onStopCrawl,
    onFilterPostAll,
    onFilterPostVideo,
    onFilterPostImage,
    onRefresh,
    onClearList,
    onOpenRandomTen,
    onOpenRandomTwenty,
    onOpenByAwemeLimit,
    onExportPostImageUrls,
    onClearLogs,
  };
}
