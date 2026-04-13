import {
  getSlotKey,
} from '@rext-shared/utils/index.js';
import {
  getLocalAsync,
  safeSet,
} from '@rext-shared/services/index.js';
import {
  SYCM_RANK_LIMITS,
  SYCM_RANK_PREFIX,
  SYCM_RANK_RUNTIME,
  SYCM_RANK_STORAGE_KEYS,
} from '@/shared/constants.js';
import { SYCM_RANK_SUPABASE } from '@/shared/supabase.js';

const LOG_META_KEY = '__meta';
const RANK_META_KEY = '__meta';
const SELECTION_META_KEY = '__meta';

function itemRowKey(item, index) {
  if (item && item.itemId != null && String(item.itemId).trim() !== '') {
    return String(item.itemId);
  }
  return `idx-${index}`;
}

function pruneByMeta(byTab, maxTabs, metaKey) {
  if (!byTab || typeof byTab !== 'object') {
    return {};
  }

  const next = { ...byTab };
  const meta =
    next[metaKey] && typeof next[metaKey] === 'object'
      ? { ...next[metaKey] }
      : {};

  const tabIds = Object.keys(next).filter((key) => key !== metaKey);
  if (tabIds.length <= maxTabs) {
    next[metaKey] = meta;
    return next;
  }

  tabIds.sort((left, right) => {
    const leftAt = meta[left] || '';
    const rightAt = meta[right] || '';
    return String(leftAt).localeCompare(String(rightAt));
  });

  while (tabIds.length > maxTabs) {
    const oldest = tabIds.shift();
    delete next[oldest];
    delete meta[oldest];
  }

  next[metaKey] = meta;
  return next;
}

function slimRankPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== 'object') {
    return null;
  }

  const sourceItems = Array.isArray(rawPayload.items) ? rawPayload.items : [];
  const nextItems = [];
  for (
    let i = 0;
    i < sourceItems.length && nextItems.length < SYCM_RANK_LIMITS.RANK_MAX_ITEMS;
    i += 1
  ) {
    const item = sourceItems[i];
    if (!item || typeof item !== 'object') {
      continue;
    }
    const itemId = item.itemId != null ? String(item.itemId) : '';
    if (!itemId) {
      continue;
    }
    nextItems.push({
      itemId,
      rank: item.rank != null ? item.rank : null,
      shopTitle: item.shopTitle != null ? String(item.shopTitle) : '',
      itemTitle: item.itemTitle != null ? String(item.itemTitle) : '',
    });
  }

  return {
    keyWord: rawPayload.keyWord != null ? String(rawPayload.keyWord) : '',
    updateTime: rawPayload.updateTime != null ? String(rawPayload.updateTime) : '',
    recordedAtEast8:
      rawPayload.recordedAtEast8 != null ? String(rawPayload.recordedAtEast8) : '',
    items: nextItems,
    lastTouchedAt: new Date().toISOString(),
  };
}

function appendLogByTab(tabId, level, message) {
  const entry = {
    t: new Date().toISOString(),
    level: level || 'log',
    msg: String(message || ''),
  };

  if (tabId == null) {
    getLocalAsync([SYCM_RANK_STORAGE_KEYS.logs]).then((result) => {
      const data =
        result[SYCM_RANK_STORAGE_KEYS.logs] &&
        typeof result[SYCM_RANK_STORAGE_KEYS.logs] === 'object'
          ? { ...result[SYCM_RANK_STORAGE_KEYS.logs] }
          : { entries: [] };
      const entries = Array.isArray(data.entries) ? [...data.entries] : [];
      entries.push(entry);
      data.entries = entries.slice(-SYCM_RANK_LIMITS.LOG_MAX_ENTRIES);
      safeSet({ [SYCM_RANK_STORAGE_KEYS.logs]: data });
    });
    return;
  }

  getLocalAsync([SYCM_RANK_STORAGE_KEYS.logsByTab]).then((result) => {
    const byTab =
      result[SYCM_RANK_STORAGE_KEYS.logsByTab] &&
      typeof result[SYCM_RANK_STORAGE_KEYS.logsByTab] === 'object'
        ? { ...result[SYCM_RANK_STORAGE_KEYS.logsByTab] }
        : {};
    const tabKey = String(tabId);
    const bucket =
      byTab[tabKey] && typeof byTab[tabKey] === 'object'
        ? { ...byTab[tabKey] }
        : {};
    const entries = Array.isArray(bucket.entries) ? [...bucket.entries] : [];
    entries.push(entry);
    bucket.entries = entries.slice(-SYCM_RANK_LIMITS.LOG_MAX_ENTRIES);
    byTab[tabKey] = bucket;

    const meta =
      byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === 'object'
        ? { ...byTab[LOG_META_KEY] }
        : {};
    meta[tabKey] = new Date().toISOString();
    byTab[LOG_META_KEY] = meta;

    let pruned = pruneByMeta(
      byTab,
      SYCM_RANK_LIMITS.LOG_MAX_TABS,
      LOG_META_KEY,
    );
    safeSet(
      { [SYCM_RANK_STORAGE_KEYS.logsByTab]: pruned },
      () => {},
      (retry) => {
        pruned = pruneByMeta(
          pruned,
          Math.max(1, SYCM_RANK_LIMITS.LOG_MAX_TABS - 1),
          LOG_META_KEY,
        );
        safeSet({ [SYCM_RANK_STORAGE_KEYS.logsByTab]: pruned }, retry);
      },
    );
  });
}

function rankSummaryLine(payload, itemCount) {
  const keyWord = payload.keyWord != null ? String(payload.keyWord) : '';
  return `rank.json：${itemCount} 条（搜索词「${keyWord || '空'}」）`;
}

function buildSupabaseRows(payload, selectedIds) {
  const rows = [];
  const source = Array.isArray(payload.items) ? payload.items : [];
  for (let i = 0; i < source.length; i += 1) {
    const row = source[i];
    const key = itemRowKey(row, i);
    if (!selectedIds.includes(key)) {
      continue;
    }
    rows.push({
      shop_title:
        row.shopTitle != null && String(row.shopTitle).trim() !== ''
          ? String(row.shopTitle).trim()
          : '（无店名）',
      rank: row.rank != null ? Number(row.rank) : 0,
      item_title:
        row.itemTitle != null && String(row.itemTitle).trim() !== ''
          ? String(row.itemTitle).trim()
          : null,
    });
  }
  return rows;
}

async function uploadRankToSupabase(tabId, payload, done) {
  const itemCount = (payload.items && payload.items.length) || 0;
  const summary = rankSummaryLine(payload, itemCount);
  const recordedAtEast8 = payload.recordedAtEast8 || '';
  const keyWord = payload.keyWord != null ? String(payload.keyWord) : '';

  const store = await getLocalAsync([
    SYCM_RANK_STORAGE_KEYS.rankSelectionByTab,
    SYCM_RANK_STORAGE_KEYS.rankSelection,
    SYCM_RANK_STORAGE_KEYS.throttleMinutes,
  ]);

  const minutes =
    store[SYCM_RANK_STORAGE_KEYS.throttleMinutes] != null &&
    Number(store[SYCM_RANK_STORAGE_KEYS.throttleMinutes]) > 0
      ? Number(store[SYCM_RANK_STORAGE_KEYS.throttleMinutes])
      : SYCM_RANK_LIMITS.DEFAULT_THROTTLE_MINUTES;

  const selectedFilter =
    tabId != null &&
    store[SYCM_RANK_STORAGE_KEYS.rankSelectionByTab] &&
    store[SYCM_RANK_STORAGE_KEYS.rankSelectionByTab][String(tabId)]
      ? store[SYCM_RANK_STORAGE_KEYS.rankSelectionByTab][String(tabId)]
      : store[SYCM_RANK_STORAGE_KEYS.rankSelection];
  const selectedIds =
    selectedFilter && Array.isArray(selectedFilter.itemIds)
      ? selectedFilter.itemIds.map((id) => String(id))
      : [];
  const rows = buildSupabaseRows(payload, selectedIds);

  const finish = (resultLine) => {
    appendLogByTab(tabId, 'log', `${summary} 路 ${resultLine}`);
    if (typeof done === 'function') {
      done(resultLine);
    }
  };

  if (rows.length === 0) {
    finish('Supabase：未写入（无勾选或勾选与列表无交集，请先勾选并保存设置）');
    return;
  }

  if (!SYCM_RANK_SUPABASE.url || !SYCM_RANK_SUPABASE.anonKey) {
    finish('Supabase：未写入（未配置密钥）');
    return;
  }

  const slotKey = getSlotKey(recordedAtEast8, minutes);
  if (!slotKey) {
    finish('Supabase：未写入（时间槽计算失败，请检查 recordedAtEast8）');
    return;
  }

  const slotStorageKey =
    SYCM_RANK_STORAGE_KEYS.lastSlotPrefix +
    `sycm-market-rank_${encodeURIComponent(keyWord || '_empty')}`;

  const slotStore = await getLocalAsync([slotStorageKey]);
  if (slotStore[slotStorageKey] === slotKey) {
    finish(
      `Supabase：未写入（本 ${minutes} 分钟时间槽已上报，槽键 ${slotKey}，keyWord「${
        keyWord || '空'
      }」）`,
    );
    return;
  }

  const apiUrl = `${SYCM_RANK_SUPABASE.url.replace(/\/$/, '')}/rest/v1/sycm_market_rank_log`;
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SYCM_RANK_SUPABASE.anonKey,
        Authorization: `Bearer ${SYCM_RANK_SUPABASE.anonKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    });

    if (!response.ok) {
      const text = await response.text();
      finish(`Supabase：未写入（HTTP ${response.status} ${text.slice(0, 120)}）`);
      return;
    }

    safeSet(
      { [slotStorageKey]: slotKey },
      () => {
        finish(`Supabase：已写入 ${rows.length} 条（表 sycm_market_rank_log，时间槽 ${slotKey}）`);
      },
      (retry) => {
        chrome.storage.local.remove([slotStorageKey], () => {
          retry();
        });
      },
    );
  } catch (error) {
    finish(`Supabase：未写入（请求异常：${String(error)}）`);
  }
}

async function saveRankSnapshot(tabId, payload, done) {
  if (tabId == null) {
    safeSet(
      {
        [SYCM_RANK_STORAGE_KEYS.rankListLatest]: payload,
      },
      () => done(),
      (retry) => {
        chrome.storage.local.remove([SYCM_RANK_STORAGE_KEYS.rankListLatest], () => {
          retry();
        });
      },
    );
    return;
  }

  const result = await getLocalAsync([SYCM_RANK_STORAGE_KEYS.rankListByTab]);
  const byTab =
    result[SYCM_RANK_STORAGE_KEYS.rankListByTab] &&
    typeof result[SYCM_RANK_STORAGE_KEYS.rankListByTab] === 'object'
      ? { ...result[SYCM_RANK_STORAGE_KEYS.rankListByTab] }
      : {};
  const tabKey = String(tabId);
  byTab[tabKey] = payload;
  const meta =
    byTab[RANK_META_KEY] && typeof byTab[RANK_META_KEY] === 'object'
      ? { ...byTab[RANK_META_KEY] }
      : {};
  meta[tabKey] = new Date().toISOString();
  byTab[RANK_META_KEY] = meta;

  let pruned = pruneByMeta(
    byTab,
    SYCM_RANK_LIMITS.RANK_MAX_TABS,
    RANK_META_KEY,
  );
  safeSet(
    { [SYCM_RANK_STORAGE_KEYS.rankListByTab]: pruned },
    () => done(),
    (retry) => {
      pruned = pruneByMeta(
        pruned,
        Math.max(1, SYCM_RANK_LIMITS.RANK_MAX_TABS - 1),
        RANK_META_KEY,
      );
      safeSet({ [SYCM_RANK_STORAGE_KEYS.rankListByTab]: pruned }, retry);
    },
  );
}

export function initRankBackgroundService() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) {
      return false;
    }

    if (message.type === SYCM_RANK_RUNTIME.GET_TAB_ID_MESSAGE) {
      if (sender.tab && sender.tab.id != null) {
        sendResponse({ tabId: sender.tab.id });
        return true;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId =
          tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
        sendResponse({ tabId });
      });
      return true;
    }

    if (message.type !== SYCM_RANK_RUNTIME.RANK_CAPTURE) {
      return false;
    }

    const tabId = sender.tab && sender.tab.id != null ? sender.tab.id : null;
    if (
      !message.payload ||
      !Array.isArray(message.payload.items) ||
      message.payload.items.length === 0
    ) {
      const reason =
        message.meta && message.meta.parseError
          ? String(message.meta.parseError)
          : '无有效数据';
      const line = `rank.json 监听 | 未解析 | Supabase：未写入（${reason}）`;
      appendLogByTab(tabId, 'warn', line);
      sendResponse({ resultLine: `Supabase：未写入（${reason}）` });
      return true;
    }

    const slim = slimRankPayload(message.payload);
    if (!slim || !Array.isArray(slim.items) || slim.items.length === 0) {
      appendLogByTab(tabId, 'warn', 'rank.json 已捕获，但无可保存的有效数据');
      sendResponse({ resultLine: 'Supabase：未写入（无有效数据）' });
      return true;
    }

    saveRankSnapshot(tabId, slim, () => {
      uploadRankToSupabase(tabId, slim, (resultLine) => {
        sendResponse({ resultLine });
      });
    });
    return true;
  });

  chrome.tabs.onRemoved.addListener(async (tabId) => {
    const tabKey = String(tabId);
    const result = await getLocalAsync([
      SYCM_RANK_STORAGE_KEYS.rankListByTab,
      SYCM_RANK_STORAGE_KEYS.logsByTab,
      SYCM_RANK_STORAGE_KEYS.rankSelectionByTab,
    ]);

    const byRank =
      result[SYCM_RANK_STORAGE_KEYS.rankListByTab] &&
      typeof result[SYCM_RANK_STORAGE_KEYS.rankListByTab] === 'object'
        ? { ...result[SYCM_RANK_STORAGE_KEYS.rankListByTab] }
        : {};
    const byLogs =
      result[SYCM_RANK_STORAGE_KEYS.logsByTab] &&
      typeof result[SYCM_RANK_STORAGE_KEYS.logsByTab] === 'object'
        ? { ...result[SYCM_RANK_STORAGE_KEYS.logsByTab] }
        : {};
    const bySelection =
      result[SYCM_RANK_STORAGE_KEYS.rankSelectionByTab] &&
      typeof result[SYCM_RANK_STORAGE_KEYS.rankSelectionByTab] === 'object'
        ? { ...result[SYCM_RANK_STORAGE_KEYS.rankSelectionByTab] }
        : {};

    if (!byRank[tabKey] && !byLogs[tabKey] && !bySelection[tabKey]) {
      return;
    }

    delete byRank[tabKey];
    delete byLogs[tabKey];
    delete bySelection[tabKey];
    if (byLogs[LOG_META_KEY] && typeof byLogs[LOG_META_KEY] === 'object') {
      delete byLogs[LOG_META_KEY][tabKey];
    }
    if (byRank[RANK_META_KEY] && typeof byRank[RANK_META_KEY] === 'object') {
      delete byRank[RANK_META_KEY][tabKey];
    }
    if (
      bySelection[SELECTION_META_KEY] &&
      typeof bySelection[SELECTION_META_KEY] === 'object'
    ) {
      delete bySelection[SELECTION_META_KEY][tabKey];
    }

    safeSet({
      [SYCM_RANK_STORAGE_KEYS.rankListByTab]: byRank,
      [SYCM_RANK_STORAGE_KEYS.logsByTab]: byLogs,
      [SYCM_RANK_STORAGE_KEYS.rankSelectionByTab]: bySelection,
    });
  });

  console.log(SYCM_RANK_PREFIX, 'background 已启动');
}




