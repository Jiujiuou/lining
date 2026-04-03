/* global chrome */
import { createMessageTabIdResolver } from '../../shared/chrome/runtime.js';
import { createTabbedLogger } from '../../shared/chrome/tabbed-logger.js';
import { pruneByMeta, safeSet } from '../../shared/chrome/storage.js';
import { getScopedState, saveScopedState } from '../../shared/chrome/tab-state.js';
import { getPositiveNumberSetting, setLastSlot, setLastSlotsForItems } from '../../shared/chrome/slot-storage.js';
import { getSupabaseCredentials } from '../../shared/supabase/credentials.js';
import { mergeGoodsDetailSlot, mergeGoodsDetailSlotBatch } from '../../shared/supabase/rest.js';
import { getTimeSlotKey, getTimeSlotTimestampISO } from '../../shared/time/east8.js';
import { PIPELINES } from '../config.js';
import {
  DEFAULTS,
  LOG_MAX_ENTRIES,
  LOG_MAX_TABS,
  LIVE_JSON_MAX_ITEMS,
  LIVE_JSON_MAX_TABS,
  MESSAGE_TYPES,
  PREFIX,
  STORAGE_KEYS,
} from '../defaults.js';

const logger = createTabbedLogger({
  storageKeys: {
    logs: STORAGE_KEYS.logs,
    logsByTab: STORAGE_KEYS.logsByTab,
  },
  maxEntries: LOG_MAX_ENTRIES,
  maxTabs: LOG_MAX_TABS,
  resolveTabId: createMessageTabIdResolver(MESSAGE_TYPES.GET_TAB_ID),
});
const credentials = getSupabaseCredentials();
const logOpts = logger ? { prefix: PREFIX, logger } : null;
const resolveTabId = createMessageTabIdResolver(MESSAGE_TYPES.GET_TAB_ID);
const LIVE_JSON_EVENT = 'sycm-goods-live';
const META_KEY = '__meta';

function getThrottleMinutes(callback) {
  getPositiveNumberSetting(STORAGE_KEYS.throttleMinutes, callback);
}

function setLastSlotForEvent(eventName, slotKey, callback) {
  setLastSlot(STORAGE_KEYS, eventName, slotKey, callback);
}

function setLastSlotsForEventItems(eventName, itemIds, slotKey, callback) {
  setLastSlotsForItems(STORAGE_KEYS, eventName, itemIds, slotKey, callback);
}

function pickFilterForTab(result, tabId) {
  return getScopedState(result, STORAGE_KEYS.liveJsonFilterByTab, STORAGE_KEYS.liveJsonFilter, tabId) || {
    itemIds: [],
  };
}

function pickCatalogForTab(result, tabId) {
  return getScopedState(result, STORAGE_KEYS.liveJsonCatalogByTab, STORAGE_KEYS.liveJsonCatalog, tabId) || {
    items: [],
  };
}

function itemNameFromCatalog(catalog, itemId) {
  const items = catalog && Array.isArray(catalog.items) ? catalog.items : [];
  const matched = items.find((item) => item && String(item.item_id) === String(itemId));
  return matched && matched.item_name ? String(matched.item_name) : '';
}

function ensureItemName(itemId, itemName) {
  if (itemName != null && String(itemName).trim() !== '') {
    return String(itemName).trim();
  }
  return String(itemId || '');
}

function formatRate(value) {
  if (value == null) return '无';
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return String(value);
  return `${(Math.round(numberValue * 10000) / 100).toFixed(2)}%`;
}

function formatGoodsIds(items, maxShow = 16, maxChars = 500) {
  if (!items || items.length === 0) return '无';

  const parts = [];
  let length = 0;

  for (const item of items) {
    if (parts.length >= maxShow) break;
    const itemId = item && item.item_id != null ? String(item.item_id) : '';
    if (!itemId) continue;
    if (length + itemId.length + 2 > maxChars) break;
    parts.push(itemId);
    length += itemId.length + 2;
  }

  const more = items.length > parts.length ? ` ...共${items.length}` : '';
  return `${parts.join(', ')}${more}`;
}

function buildLiveJsonLogLine(options) {
  const batchItems = options.batchItems || [];
  const allowedRows = options.allowedRows || [];
  const whitelistLength = typeof options.whitelistLen === 'number' ? options.whitelistLen : 0;
  const throttleMinutes = options.throttleMinutes != null ? options.throttleMinutes : 20;
  const allowBrief =
    allowedRows.length > 0
      ? formatGoodsIds(
          allowedRows.map((row) => ({ item_id: row.item_id })),
          16,
          400,
        )
      : whitelistLength === 0
        ? '（未选择商品）'
        : '（与当前批次无交集）';

  if (options.outcome === 'throttle') {
    return `${PREFIX}[实时] 批次${batchItems.length}项 ${formatGoodsIds(batchItems)} | 命中${allowedRows.length}项：${allowBrief} | 在${throttleMinutes}分钟时间槽内已跳过`;
  }

  if (options.outcome === 'none') {
    return `${PREFIX}[实时] 批次${batchItems.length}项 ${formatGoodsIds(batchItems)} | 无可写入数据`;
  }

  if (options.outcome === 'written') {
    return `${PREFIX}[实时] 已写入 ${options.writtenCount || 0} 条，时间槽跳过 ${options.skippedInSlot || 0} 条`;
  }

  return `${PREFIX}[实时] 写入失败：${options.errMsg ? String(options.errMsg) : '未知错误'}`;
}

function saveLiveJsonCatalog(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return;

  const items = [];
  for (const item of rawItems) {
    if (items.length >= LIVE_JSON_MAX_ITEMS) break;
    if (!item || item.item_id == null) continue;
    items.push({
      item_id: String(item.item_id),
      item_name: item.item_name ? String(item.item_name) : '',
    });
  }

  if (items.length === 0) return;

  const payload = {
    updatedAt: new Date().toISOString(),
    items,
  };

  resolveTabId((tabId) => {
    if (tabId == null) {
      safeSet(
        { [STORAGE_KEYS.liveJsonCatalog]: payload },
        () => {},
        (retry) => {
          chrome.storage.local.remove([STORAGE_KEYS.liveJsonCatalog], retry);
        },
      );
      return;
    }

    saveScopedState({
      storageKey: STORAGE_KEYS.liveJsonCatalogByTab,
      tabId,
      value: payload,
      maxTabs: LIVE_JSON_MAX_TABS,
      metaKey: META_KEY,
      onDone: () => {},
      onQuota: (retry) => {
        chrome.storage.local.get([STORAGE_KEYS.liveJsonCatalogByTab], (result) => {
          const byTab = result[STORAGE_KEYS.liveJsonCatalogByTab] || {};
          const trimmed = pruneByMeta(byTab, META_KEY, Math.max(1, LIVE_JSON_MAX_TABS - 1));
          safeSet({ [STORAGE_KEYS.liveJsonCatalogByTab]: trimmed }, retry);
        });
      },
    });
  });
}

function buildDetailRow(detail, slotTs, catalog) {
  return {
    item_id: detail.itemId,
    slot_ts: slotTs,
    item_name: ensureItemName(detail.itemId, itemNameFromCatalog(catalog, detail.itemId)),
    search_uv: detail.payload && detail.payload.search_uv != null ? detail.payload.search_uv : null,
    search_pay_rate:
      detail.payload && detail.payload.search_pay_rate != null ? detail.payload.search_pay_rate : null,
    cart_uv: detail.payload && detail.payload.cart_uv != null ? detail.payload.cart_uv : null,
    cart_pay_rate:
      detail.payload && detail.payload.cart_pay_rate != null ? detail.payload.cart_pay_rate : null,
  };
}

function logDetailSkip(detail, throttleMinutes) {
  if (!logger) return;

  const payload = detail.payload || {};
  logger.log(
    `${PREFIX}[详情] 商品 ${detail.itemId} | 搜索UV=${payload.search_uv ?? '无'} 搜索支付转化率=${formatRate(payload.search_pay_rate)} | 购物车UV=${payload.cart_uv ?? '无'} 购物车支付转化率=${formatRate(payload.cart_pay_rate)} | 在${throttleMinutes}分钟时间槽内已跳过`,
  );
}

function logDetailWrite(row, itemId) {
  if (!logger) return;

  logger.log(
    `${PREFIX}[详情] 已合并商品 ${itemId} | 搜索UV=${row.search_uv ?? '无'} 搜索支付转化率=${formatRate(row.search_pay_rate)} | 购物车UV=${row.cart_uv ?? '无'} 购物车支付转化率=${formatRate(row.cart_pay_rate)}`,
  );
}

function handleMultiRowEvent(sink, detail, slotKey, slotTs, throttleMinutes, result, tabId) {
  const rawList = Array.isArray(detail.payload && detail.payload.items) ? detail.payload.items : [];
  const batchItems = rawList
    .filter((item) => item && item.item_id != null)
    .map((item) => ({
      item_id: String(item.item_id),
      item_name: item.item_name ? String(item.item_name) : '',
    }));

  const filter = pickFilterForTab(result, tabId);
  const selectedIds = filter && Array.isArray(filter.itemIds) ? filter.itemIds : [];
  const allow = new Set(selectedIds.map((itemId) => String(itemId)));

  const rows = rawList
    .map((item) => ({
      item_id: item.item_id,
      slot_ts: slotTs,
      item_name: ensureItemName(item.item_id, item.item_name),
      item_cart_cnt: item.item_cart_cnt != null ? item.item_cart_cnt : null,
    }))
    .filter((row) => row.item_id != null && allow.has(String(row.item_id)));

  const rowsToWrite = rows.filter((row) => {
    const key = `${STORAGE_KEYS.lastSlotPrefix}${sink.eventName}_${String(row.item_id)}`;
    return result[key] !== slotKey;
  });

  const logBase = {
    batchItems,
    allowedRows: rows,
    whitelistLen: selectedIds.length,
    throttleMinutes,
  };

  if (rowsToWrite.length === 0) {
    logger.log(buildLiveJsonLogLine({ ...logBase, outcome: rows.length > 0 ? 'throttle' : 'none' }));
    return;
  }

  mergeGoodsDetailSlotBatch(rowsToWrite, credentials, logOpts).then((response) => {
    if (response && response.ok) {
      setLastSlotsForEventItems(
        sink.eventName,
        rowsToWrite.map((row) => String(row.item_id)),
        slotKey,
        () => {},
      );
      logger.log(
        buildLiveJsonLogLine({
          ...logBase,
          outcome: 'written',
          skippedInSlot: rows.length - rowsToWrite.length,
          writtenCount: rowsToWrite.length,
        }),
      );
      return;
    }

    logger.warn(
      buildLiveJsonLogLine({
        ...logBase,
        outcome: 'fail',
        errMsg: (response && response.error) || JSON.stringify(response),
      }),
    );
  });
}

function handleDetailEvent(sink, detail, slotKey, slotTs, throttleMinutes, result, tabId, detailSlotKey) {
  if (result[detailSlotKey] === slotKey) {
    logDetailSkip(detail, throttleMinutes);
    return;
  }

  if (!detail.itemId) {
    logger.warn(PREFIX + ' 缺少 itemId，已跳过');
    return;
  }
  const catalog = pickCatalogForTab(result, tabId);
  const row = buildDetailRow(detail, slotTs, catalog);

  mergeGoodsDetailSlot(row, credentials, logOpts).then((response) => {
    if (!response || !response.ok) return;
    setLastSlotForEvent(`${sink.eventName}_${detail.itemId}`, slotKey, () => {});
    logDetailWrite(row, detail.itemId);
  });
}

function handleEvent(sink, detail, throttleMinutes) {
  const recordedAt = String(detail.recordedAt);
  const slotKey = getTimeSlotKey(recordedAt, throttleMinutes);
  if (!slotKey || !sink.mergeGoodsDetail) return;

  const slotTs = getTimeSlotTimestampISO(recordedAt, throttleMinutes);
  if (!slotTs) return;

  if (sink.eventName === LIVE_JSON_EVENT && sink.multiRows && detail.payload && Array.isArray(detail.payload.items)) {
    saveLiveJsonCatalog(detail.payload.items);
  }

  resolveTabId((tabId) => {
    const keysToRead = [];
    let detailSlotKey = '';

    if (sink.multiRows && detail.payload && Array.isArray(detail.payload.items)) {
      keysToRead.push(STORAGE_KEYS.liveJsonFilter, STORAGE_KEYS.liveJsonFilterByTab);
      for (const item of detail.payload.items) {
        if (!item || item.item_id == null) continue;
        keysToRead.push(`${STORAGE_KEYS.lastSlotPrefix}${sink.eventName}_${String(item.item_id)}`);
      }
    } else {
      detailSlotKey = `${STORAGE_KEYS.lastSlotPrefix}${sink.eventName}${detail.itemId ? `_${detail.itemId}` : ''}`;
      keysToRead.push(detailSlotKey, STORAGE_KEYS.liveJsonCatalog, STORAGE_KEYS.liveJsonCatalogByTab);
    }

    chrome.storage.local.get(keysToRead, (result) => {
      if (sink.multiRows && detail.payload && Array.isArray(detail.payload.items)) {
        handleMultiRowEvent(sink, detail, slotKey, slotTs, throttleMinutes, result, tabId);
        return;
      }

      handleDetailEvent(sink, detail, slotKey, slotTs, throttleMinutes, result, tabId, detailSlotKey);
    });
  });
}

function normalizeTemplateUrl(rawUrl) {
  try {
    const url = new URL(rawUrl, document.location.origin);
    url.searchParams.delete('_');
    url.searchParams.set('itemId', '{itemId}');
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function injectPageModule(fileName) {
  const script = document.createElement('script');
  script.type = 'module';
  script.src = chrome.runtime.getURL(fileName);
  script.onload = function onload() {
    this.remove();
  };
  script.onerror = () => {
    logger.warn(`${PREFIX}${fileName} 加载失败`);
  };
  (document.head || document.documentElement).appendChild(script);
}

function registerPipelineListeners() {
  let throttleMinutes = DEFAULTS.THROTTLE_MINUTES;

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    const changed = changes && changes[STORAGE_KEYS.throttleMinutes];
    if (changed && typeof changed.newValue === 'number' && changed.newValue > 0) {
      throttleMinutes = changed.newValue;
    }
  });

  PIPELINES.forEach((sink) => {
    document.addEventListener(sink.eventName, (event) => {
      const detail = event.detail;
      if (!detail || !detail.recordedAt) return;
      handleEvent(sink, detail, throttleMinutes);
    });
  });

  getThrottleMinutes((stored) => {
    if (stored != null) throttleMinutes = stored;
  });
}

function registerLogListener() {
  document.addEventListener('sycm-log', (event) => {
    const detail = event.detail;
    if (detail && detail.level != null && detail.msg != null) {
      logger.appendLog(detail.level, detail.msg);
    }
  });
}

function registerTemplateCapture() {
  document.addEventListener('sycm-flow-source-template', (event) => {
    const detail = event && event.detail ? event.detail : null;
    const url = detail && detail.url ? String(detail.url) : '';
    if (!url || !url.includes('/flow/v6/live/item/source/v4.json')) return;

    const normalized = normalizeTemplateUrl(url);
    resolveTabId((tabId) => {
      if (tabId == null) return;

      saveScopedState({
        storageKey: STORAGE_KEYS.flowSourceTemplateByTab,
        tabId,
        value: { url: normalized, capturedAt: new Date().toISOString() },
        maxTabs: LIVE_JSON_MAX_TABS,
        metaKey: META_KEY,
        onDone: () => {
          logger.log(`${PREFIX}已捕获流量来源模板`);
        },
        onQuota: (retry) => retry(),
      });
    });
  });
}

function getBestTemplateUrl(byTab, tabId) {
  if (tabId != null && byTab[String(tabId)] && byTab[String(tabId)].url) {
    return String(byTab[String(tabId)].url);
  }

  let best = null;
  for (const key of Object.keys(byTab)) {
    const candidate = byTab[key];
    if (!candidate || !candidate.url) continue;
    if (!best || String(best.capturedAt || '').localeCompare(String(candidate.capturedAt || '')) < 0) {
      best = candidate;
    }
  }

  return best && best.url ? String(best.url) : '';
}

function registerPopupMessageBridge() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return false;

    if (message.type === MESSAGE_TYPES.FLOW_POLL_START) {
      const intervalSec =
        typeof message.intervalSec === 'number' ? Math.max(5, Math.min(600, message.intervalSec)) : 30;

      resolveTabId((tabId) => {
        chrome.storage.local.get(
          [
            STORAGE_KEYS.liveJsonFilter,
            STORAGE_KEYS.liveJsonFilterByTab,
            STORAGE_KEYS.flowSourceTemplateByTab,
          ],
          (result) => {
            const filter = pickFilterForTab(result, tabId);
            const itemIds =
              filter && Array.isArray(filter.itemIds)
                ? filter.itemIds.map((itemId) => String(itemId))
                : [];
            if (itemIds.length === 0) {
              logger.warn(PREFIX + ' 未选择商品，无法启动轮询');
              sendResponse({ ok: false, error: 'no_items' });
              return;
            }

            const byTab = result[STORAGE_KEYS.flowSourceTemplateByTab] || {};
            const templateUrl = getBestTemplateUrl(byTab, tabId);
            if (!templateUrl) {
              logger.warn(PREFIX + ' 未捕获详情模板 URL，请先打开任意商品详情页');
              sendResponse({ ok: false, error: 'no_template' });
              return;
            }

            window.postMessage(
              {
                type: MESSAGE_TYPES.FLOW_POLL_START,
                itemIds,
                templateUrl,
                intervalMs: intervalSec * 1000,
                maxConcurrency: 1,
              },
              '*',
            );
            sendResponse({ ok: true, itemCount: itemIds.length });
          },
        );
      });

      return true;
    }

    if (message.type === MESSAGE_TYPES.FLOW_POLL_STOP) {
      window.postMessage({ type: MESSAGE_TYPES.FLOW_POLL_STOP }, '*');
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });
}

registerPipelineListeners();
registerLogListener();
registerTemplateCapture();
registerPopupMessageBridge();

try {
  const pageUrl = document.location ? document.location.href : '';
  logger.log(
    `${PREFIX}内容脚本已加载：${(pageUrl.slice(0, 60) || '')}${pageUrl.length > 60 ? '...' : ''}`,
  );
  injectPageModule('inject.js');
  injectPageModule('flow-source-poller.js');
} catch (error) {
  logger.warn(`${PREFIX}注入页面模块失败 ${String(error)}`);
}
