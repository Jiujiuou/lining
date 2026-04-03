/* global chrome */
import { safeSet } from '../../shared/chrome/storage.js';
import { saveScopedState } from '../../shared/chrome/tab-state.js';
import { FIND_PAGE_MAX_TABS, STORAGE_KEYS } from '../defaults.js';
import { MESSAGE_TYPES } from '../messages.js';

const CONTENT_GUARD = '__LINING_AMCR_CS__';

function createTabIdResolver() {
  let tabIdCache = '__pending__';
  let waiters = [];

  return function resolveTabId(callback) {
    if (typeof tabIdCache === 'number') {
      callback(tabIdCache);
      return;
    }

    if (tabIdCache === false) {
      callback(null);
      return;
    }

    waiters.push(callback);
    if (waiters.length > 1) return;

    try {
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_TAB_ID }, (response) => {
        tabIdCache =
          chrome.runtime.lastError || !response || response.tabId == null ? false : response.tabId;
        const tabId = typeof tabIdCache === 'number' ? tabIdCache : null;
        const queue = waiters.slice();
        waiters = [];
        queue.forEach((waiter) => waiter(tabId));
      });
    } catch {
      tabIdCache = false;
      const queue = waiters.slice();
      waiters = [];
      queue.forEach((waiter) => waiter(null));
    }
  };
}

const resolveTabId = createTabIdResolver();

function sendCaptureLog(tabId, message) {
  try {
    chrome.runtime.sendMessage(
      { type: MESSAGE_TYPES.CAPTURE_LOG, tabId: tabId != null ? tabId : null, msg: message },
      () => {},
    );
  } catch {
    // ignore logging failures
  }
}

function slimReportRow(row) {
  if (!row || typeof row !== 'object') return null;

  const condition = row.condition && typeof row.condition === 'object' ? row.condition : null;
  return {
    campaignName: row.campaignName,
    charge: row.charge,
    alipayInshopAmt: row.alipayInshopAmt,
    condition: condition
      ? {
          startTime: condition.startTime,
          endTime: condition.endTime,
        }
      : null,
  };
}

function slimCampaignItem(item) {
  if (!item || typeof item !== 'object') return item;

  const reports =
    Array.isArray(item.reportInfoList) && item.reportInfoList.length > 0
      ? [slimReportRow(item.reportInfoList[0])].filter(Boolean)
      : null;

  return {
    campaignId: item.campaignId,
    campaignName: item.campaignName,
    onlineStatus: item.onlineStatus,
    displayStatus: item.displayStatus,
    reportInfoList: reports,
  };
}

function slimFindPagePayload(payload) {
  if (!payload || typeof payload !== 'object' || !payload.data || !Array.isArray(payload.data.list)) {
    return payload;
  }

  try {
    return {
      data: {
        count: payload.data.count,
        list: payload.data.list.map((item) => slimCampaignItem(item)),
      },
    };
  } catch {
    return payload;
  }
}

function parseBizCodeFromUrl(url) {
  if (!url || typeof url !== 'string') return '';

  try {
    const queryIndex = url.indexOf('?');
    if (queryIndex < 0) return '';

    const params = new URLSearchParams(url.slice(queryIndex));
    const bizCode = params.get('bizCode') || params.get('mx_bizCode') || '';
    return ['onebpDisplay', 'onebpSite', 'onebpSearch', 'onebpShortVideo'].includes(bizCode)
      ? bizCode
      : '';
  } catch {
    return '';
  }
}

function onMessage(event) {
  if (
    event.source !== window ||
    !event.data ||
    event.data.type !== MESSAGE_TYPES.FIND_PAGE_CAPTURED ||
    window !== window.top
  ) {
    return;
  }

  const payload = event.data.payload;
  const list = payload && payload.data && Array.isArray(payload.data.list) ? payload.data.list : [];
  if (list.length === 0) return;

  const requestUrl = event.data.requestUrl || '';
  const pageUrl = event.data.pageUrl || '';
  const slimPayload = slimFindPagePayload(payload);
  const bizCode = parseBizCodeFromUrl(requestUrl);

  resolveTabId((tabId) => {
    if (tabId == null) {
      safeSet(
        {
          amcr_findPageResponse: slimPayload,
          amcr_findPageRequestUrl: requestUrl,
          amcr_findPagePageUrl: pageUrl,
          amcr_findPageBizCode: bizCode,
        },
        () => {
          sendCaptureLog(null, `已捕获到推广列表：${list.length} 条`);
        },
        () => {
          sendCaptureLog(null, '已捕获列表，但缓存保存失败（稍后重试）');
        },
      );
      return;
    }

    saveScopedState({
      storageKey: STORAGE_KEYS.findPageStateByTab,
      tabId,
      value: {
        findPageResponse: slimPayload,
        findPageRequestUrl: requestUrl,
        findPagePageUrl: pageUrl,
        findPageBizCode: bizCode,
        findPageSelectedCampaigns: {},
        lastTouchedAt: new Date().toISOString(),
      },
      maxTabs: FIND_PAGE_MAX_TABS,
      onDone: () => {
        sendCaptureLog(tabId, `已捕获到推广列表：${list.length} 条`);
      },
      onQuota: () => {
        sendCaptureLog(tabId, '已捕获列表，但缓存保存失败（稍后重试）');
      },
    });
  });
}

try {
  const globalObject = typeof globalThis !== 'undefined' ? globalThis : window;
  if (!globalObject[CONTENT_GUARD]) {
    globalObject[CONTENT_GUARD] = true;
    window.addEventListener('message', onMessage);
  }
} catch {
  // ignore bootstrap failures
}
