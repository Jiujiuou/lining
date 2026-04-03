import { pruneByMeta, safeSet } from '../../shared/chrome/storage.js';
import {
  DEFAULTS,
  LOG_MAX_ENTRIES,
  LOG_MAX_TABS,
  RANK_MAX_ITEMS,
  RANK_MAX_TABS,
  RUNTIME,
  STORAGE_KEYS,
} from '../defaults.js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../shared/supabase/credentials.js';
import { getTimeSlotKey as getSlotKey } from '../../shared/time/east8.js';

const GET_TAB_MESSAGE = RUNTIME.GET_TAB_ID_MESSAGE;
const LOG_META_KEY = '__meta';
const RANK_META_KEY = '__meta';
const SELECTION_META_KEY = '__meta';

function slimRankPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const sourceItems = Array.isArray(raw.items) ? raw.items : [];
  const items = [];

  for (const item of sourceItems) {
    if (!item || typeof item !== 'object') continue;

    const itemId = item.itemId != null ? String(item.itemId) : '';
    if (!itemId) continue;

    items.push({
      itemId,
      rank: item.rank != null ? item.rank : null,
      shopTitle: item.shopTitle != null ? String(item.shopTitle) : '',
      itemTitle: item.itemTitle != null ? String(item.itemTitle) : '',
    });

    if (items.length >= RANK_MAX_ITEMS) {
      break;
    }
  }

  return {
    keyWord: raw.keyWord != null ? String(raw.keyWord) : '',
    updateTime: raw.updateTime != null ? String(raw.updateTime) : '',
    recordedAtEast8: raw.recordedAtEast8 != null ? String(raw.recordedAtEast8) : '',
    items,
    lastTouchedAt: new Date().toISOString(),
  };
}

function itemRowKey(item, index) {
  if (item && item.itemId != null && String(item.itemId).trim() !== '') {
    return String(item.itemId);
  }

  return `idx-${index}`;
}

function appendLogForTab(tabId, level, message) {
  const entry = {
    t: new Date().toISOString(),
    level: level || 'log',
    msg: String(message),
  };

  if (tabId == null) {
    chrome.storage.local.get([STORAGE_KEYS.logs], (result) => {
      const data =
        result[STORAGE_KEYS.logs] && Array.isArray(result[STORAGE_KEYS.logs].entries)
          ? result[STORAGE_KEYS.logs]
          : { entries: [] };

      data.entries.push(entry);
      if (data.entries.length > LOG_MAX_ENTRIES) {
        data.entries = data.entries.slice(-LOG_MAX_ENTRIES);
      }

      safeSet({ [STORAGE_KEYS.logs]: data }, () => {});
    });
    return;
  }

  chrome.storage.local.get([STORAGE_KEYS.logsByTab], (result) => {
    const byTab = result[STORAGE_KEYS.logsByTab] || {};
    const bucket = byTab[String(tabId)] || { entries: [] };

    if (!Array.isArray(bucket.entries)) {
      bucket.entries = [];
    }

    bucket.entries.push(entry);
    if (bucket.entries.length > LOG_MAX_ENTRIES) {
      bucket.entries = bucket.entries.slice(-LOG_MAX_ENTRIES);
    }

    byTab[String(tabId)] = bucket;

    const meta =
      byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === 'object' ? byTab[LOG_META_KEY] : {};
    meta[String(tabId)] = new Date().toISOString();
    byTab[LOG_META_KEY] = meta;

    safeSet(
      {
        [STORAGE_KEYS.logsByTab]: pruneByMeta(byTab, LOG_META_KEY, LOG_MAX_TABS),
      },
      () => {},
      (retry) => {
        safeSet(
          {
            [STORAGE_KEYS.logsByTab]: pruneByMeta(byTab, LOG_META_KEY, Math.max(1, LOG_MAX_TABS - 1)),
          },
          retry,
        );
      },
    );
  });
}

function buildRankSummary(payload, itemCount) {
  const keyWord = payload.keyWord != null ? String(payload.keyWord) : '';
  return `rank.json（${itemCount} 条，关键词 "${keyWord || '空'}"）`;
}

function uploadRankToSupabase(tabId, payload, done) {
  const itemCount = Array.isArray(payload.items) ? payload.items.length : 0;
  const summary = buildRankSummary(payload, itemCount);
  const recordedAtEast8 = payload.recordedAtEast8 || '';
  const keyWord = payload.keyWord != null ? String(payload.keyWord) : '';

  chrome.storage.local.get(
    [STORAGE_KEYS.rankSelectionByTab, STORAGE_KEYS.rankSelection, STORAGE_KEYS.throttleMinutes],
    (result) => {
      const throttleMinutes =
        result[STORAGE_KEYS.throttleMinutes] != null && Number(result[STORAGE_KEYS.throttleMinutes]) > 0
          ? Number(result[STORAGE_KEYS.throttleMinutes])
          : DEFAULTS.THROTTLE_MINUTES;

      const filter =
        tabId != null &&
        result[STORAGE_KEYS.rankSelectionByTab] &&
        result[STORAGE_KEYS.rankSelectionByTab][String(tabId)]
          ? result[STORAGE_KEYS.rankSelectionByTab][String(tabId)]
          : result[STORAGE_KEYS.rankSelection];

      const selectedIds =
        filter && Array.isArray(filter.itemIds) ? filter.itemIds.map((value) => String(value)) : [];
      const rows = [];

      for (let index = 0; index < payload.items.length; index += 1) {
        const row = payload.items[index];
        if (selectedIds.indexOf(itemRowKey(row, index)) === -1) continue;

        rows.push({
          shop_title:
            row.shopTitle != null && String(row.shopTitle).trim() !== ''
              ? String(row.shopTitle).trim()
              : 'N/A',
          rank: row.rank != null ? Number(row.rank) : 0,
          item_title:
            row.itemTitle != null && String(row.itemTitle).trim() !== ''
              ? String(row.itemTitle).trim()
              : null,
        });
      }

      function finish(resultLine) {
        appendLogForTab(tabId, 'log', `${summary} | ${resultLine}`);
        if (typeof done === 'function') {
          done(resultLine);
        }
      }

      if (rows.length === 0) {
        finish('Supabase：已跳过（未命中选中行）');
        return;
      }

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        finish('Supabase：未写入（缺少配置）');
        return;
      }

      const slotKey = getSlotKey(recordedAtEast8, throttleMinutes);
      if (!slotKey) {
        finish('Supabase：已跳过（时间槽计算失败）');
        return;
      }

      const slotStorageKey =
        `${STORAGE_KEYS.lastSlotPrefix}sycm-market-rank_${encodeURIComponent(keyWord || '_empty')}`;

      chrome.storage.local.get([slotStorageKey], (slotResult) => {
        if (slotResult[slotStorageKey] === slotKey) {
          finish(`Supabase：未写入（${throttleMinutes} 分钟时间槽 ${slotKey} 已上报）`);
          return;
        }

        fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/sycm_market_rank_log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(rows),
        })
          .then((response) => {
            if (!response.ok) {
              return response.text().then((text) => {
                finish(`Supabase：未写入（HTTP ${response.status} ${text.slice(0, 120)}）`);
              });
            }

            safeSet({ [slotStorageKey]: slotKey }, () => {
              finish(`Supabase：已写入 ${rows.length} 条（时间槽 ${slotKey}）`);
            });
          })
          .catch((error) => {
            finish(`Supabase：未写入（请求异常 ${String(error)}）`);
          });
      });
    },
  );
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;

  if (message.type === GET_TAB_MESSAGE) {
    if (sender.tab && sender.tab.id != null) {
      sendResponse({ tabId: sender.tab.id });
      return true;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
      sendResponse({ tabId });
    });

    return true;
  }

  if (message.type !== RUNTIME.RANK_CAPTURE) {
    return false;
  }

  const tabId = sender.tab && sender.tab.id != null ? sender.tab.id : null;

  if (!message.payload || !Array.isArray(message.payload.items) || message.payload.items.length === 0) {
    const reason =
      message.meta && message.meta.parseError ? String(message.meta.parseError) : 'invalid payload';
    appendLogForTab(tabId, 'warn', `rank.json 解析失败：${reason}`);
    sendResponse({ resultLine: `Supabase：已跳过（${reason}）` });
    return true;
  }

  const payload = slimRankPayload(message.payload);
  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
    appendLogForTab(tabId, 'warn', 'rank.json 已捕获，但无有效数据行');
    sendResponse({ resultLine: 'Supabase：已跳过（无有效数据）' });
    return true;
  }

  const afterSave = () => {
    uploadRankToSupabase(tabId, payload, (resultLine) => {
      sendResponse({ resultLine });
    });
  };

  if (tabId == null) {
    safeSet({ [STORAGE_KEYS.rankListLatest]: payload }, afterSave, (retry) => {
      chrome.storage.local.remove([STORAGE_KEYS.rankListLatest], () => {
        retry();
      });
    });
    return true;
  }

  chrome.storage.local.get([STORAGE_KEYS.rankListByTab], (result) => {
    const byTab = result[STORAGE_KEYS.rankListByTab] || {};

    byTab[String(tabId)] = payload;

    const meta =
      byTab[RANK_META_KEY] && typeof byTab[RANK_META_KEY] === 'object' ? byTab[RANK_META_KEY] : {};
    meta[String(tabId)] = new Date().toISOString();
    byTab[RANK_META_KEY] = meta;

    safeSet(
      {
        [STORAGE_KEYS.rankListByTab]: pruneByMeta(byTab, RANK_META_KEY, RANK_MAX_TABS),
      },
      afterSave,
      (retry) => {
        safeSet(
          {
            [STORAGE_KEYS.rankListByTab]: pruneByMeta(byTab, RANK_META_KEY, Math.max(1, RANK_MAX_TABS - 1)),
          },
          retry,
        );
      },
    );
  });

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const tabKey = String(tabId);

  chrome.storage.local.get(
    [STORAGE_KEYS.rankListByTab, STORAGE_KEYS.logsByTab, STORAGE_KEYS.rankSelectionByTab],
    (result) => {
      const rankByTab = result[STORAGE_KEYS.rankListByTab] || {};
      const logsByTab = result[STORAGE_KEYS.logsByTab] || {};
      const selectionByTab = result[STORAGE_KEYS.rankSelectionByTab] || {};

      if (!rankByTab[tabKey] && !logsByTab[tabKey] && !selectionByTab[tabKey]) {
        return;
      }

      delete rankByTab[tabKey];
      delete logsByTab[tabKey];
      delete selectionByTab[tabKey];

      if (logsByTab[LOG_META_KEY] && typeof logsByTab[LOG_META_KEY] === 'object') {
        delete logsByTab[LOG_META_KEY][tabKey];
      }
      if (rankByTab[RANK_META_KEY] && typeof rankByTab[RANK_META_KEY] === 'object') {
        delete rankByTab[RANK_META_KEY][tabKey];
      }
      if (selectionByTab[SELECTION_META_KEY] && typeof selectionByTab[SELECTION_META_KEY] === 'object') {
        delete selectionByTab[SELECTION_META_KEY][tabKey];
      }

      safeSet(
        {
          [STORAGE_KEYS.rankListByTab]: rankByTab,
          [STORAGE_KEYS.logsByTab]: logsByTab,
          [STORAGE_KEYS.rankSelectionByTab]: selectionByTab,
        },
        () => {},
      );
    },
  );
});
