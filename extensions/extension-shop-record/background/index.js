import { safeSet } from '../../shared/chrome/storage.js';
import {
  LOG_MAX_ENTRIES,
  LOG_MAX_TABS,
  MESSAGE_TYPES,
  REPORT_SUBMIT_PAGE_URL,
  STORAGE_KEYS,
} from '../defaults.js';

const LOG_META_KEY = '__meta';

function pruneByTab(byTab) {
  const meta = byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === 'object' ? byTab[LOG_META_KEY] : {};
  const ids = Object.keys(byTab).filter((key) => key !== LOG_META_KEY);

  ids.sort((left, right) => String(meta[left] || '').localeCompare(String(meta[right] || '')));

  while (ids.length > LOG_MAX_TABS) {
    const oldest = ids.shift();
    delete byTab[oldest];
    delete meta[oldest];
  }

  byTab[LOG_META_KEY] = meta;
  return byTab;
}

const logQueue = [];
let logWriting = false;

function flushLogQueue() {
  if (logWriting || logQueue.length === 0) return;

  logWriting = true;
  const item = logQueue.shift();
  appendLogEntry(item.tabId, item.level, item.msg);
}

function appendLogEntry(tabId, level, message) {
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

      safeSet({ [STORAGE_KEYS.logs]: data }, () => {
        logWriting = false;
        flushLogQueue();
      });
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
      { [STORAGE_KEYS.logsByTab]: pruneByTab(byTab) },
      () => {
        logWriting = false;
        flushLogQueue();
      },
      (retry) => {
        safeSet({ [STORAGE_KEYS.logsByTab]: pruneByTab(byTab) }, retry);
      },
    );
  });
}

function enqueueLog(tabId, level, message) {
  logQueue.push({ tabId, level, msg: message });
  flushLogQueue();
}

function deliverReportFill(tabId, sendResponse) {
  chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.CONTENT_FILL_REPORT }, (response) => {
    if (chrome.runtime.lastError) {
      sendResponse({
        ok: false,
        error: chrome.runtime.lastError.message || '发送失败',
      });
      return;
    }

    sendResponse(response && typeof response === 'object' ? response : { ok: false });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.type === MESSAGE_TYPES.GET_TAB_ID) {
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

  if (request && request.type === MESSAGE_TYPES.FILL_REPORT_PAGE) {
    if (!REPORT_SUBMIT_PAGE_URL) {
      sendResponse({ ok: false, error: 'missing_report_submit_url' });
      return true;
    }

    chrome.tabs.query({ url: 'https://oa1.ilanhe.com/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const tabId = tabs[0].id;
        chrome.tabs.update(tabId, { active: true }, () => {
          setTimeout(() => {
            deliverReportFill(tabId, sendResponse);
          }, 400);
        });
        return;
      }

      chrome.tabs.create({ url: REPORT_SUBMIT_PAGE_URL }, (tab) => {
        if (!tab || tab.id == null) {
          sendResponse({ ok: false, error: 'create_report_tab_failed' });
          return;
        }

        const createdId = tab.id;
        const listener = (tabId, changeInfo) => {
          if (tabId !== createdId || changeInfo.status !== 'complete') {
            return;
          }

          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(() => {
            deliverReportFill(createdId, sendResponse);
          }, 1000);
        };

        chrome.tabs.onUpdated.addListener(listener);
      });
    });

    return true;
  }

  if (!request || request.type !== MESSAGE_TYPES.CONTENT_APPEND_LOG) {
    return false;
  }

  const tabId = sender.tab && sender.tab.id != null ? sender.tab.id : null;
  enqueueLog(tabId, request.level || 'log', request.msg);
  sendResponse({ ok: true });
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab || !tab.url) return;

  let parsedUrl;
  try {
    parsedUrl = new URL(tab.url);
  } catch {
    return;
  }

  if (parsedUrl.hostname === 'rate.taobao.com' && (parsedUrl.pathname || '').indexOf('/user-rate-') === 0) {
    enqueueLog(tabId, 'log', `[店铺评分] 页面已加载 ${parsedUrl.pathname}${parsedUrl.search || ''}`);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const tabKey = String(tabId);

  chrome.storage.local.get([STORAGE_KEYS.logsByTab], (result) => {
    const byTab = result[STORAGE_KEYS.logsByTab] || {};
    if (!Object.prototype.hasOwnProperty.call(byTab, tabKey)) return;

    delete byTab[tabKey];
    if (byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === 'object') {
      delete byTab[LOG_META_KEY][tabKey];
    }

    safeSet({ [STORAGE_KEYS.logsByTab]: byTab }, () => {});
  });
});
