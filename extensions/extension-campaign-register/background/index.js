import { pruneByMeta, safeSet } from '../../shared/chrome/storage.js';
import { LOG_MAX_ENTRIES, LOG_MAX_TABS, STORAGE_KEYS } from '../defaults.js';
import { MESSAGE_TYPES } from '../messages.js';

const LOG_META_KEY = '__meta';

function appendCaptureLogEntry(tabId, message) {
  const entry = {
    t: new Date().toISOString(),
    level: 'log',
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
      { [STORAGE_KEYS.logsByTab]: pruneByMeta(byTab, LOG_META_KEY, LOG_MAX_TABS) },
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === MESSAGE_TYPES.CAPTURE_LOG) {
    appendCaptureLogEntry(message.tabId != null ? message.tabId : null, message.msg || '');
    sendResponse({ ok: true });
    return true;
  }

  if (!message || message.type !== MESSAGE_TYPES.GET_TAB_ID) {
    return false;
  }

  if (sender.tab && sender.tab.id != null) {
    sendResponse({ tabId: sender.tab.id });
    return true;
  }

  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tabId = tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
    sendResponse({ tabId });
  });

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const tabKey = String(tabId);

  chrome.storage.local.get([STORAGE_KEYS.findPageStateByTab, STORAGE_KEYS.logsByTab], (result) => {
    const stateByTab = result[STORAGE_KEYS.findPageStateByTab] || {};
    const logsByTab = result[STORAGE_KEYS.logsByTab] || {};

    const hasState = Object.prototype.hasOwnProperty.call(stateByTab, tabKey);
    const hasLogs = Object.prototype.hasOwnProperty.call(logsByTab, tabKey);

    if (!hasState && !hasLogs) {
      return;
    }

    delete stateByTab[tabKey];
    delete logsByTab[tabKey];

    if (logsByTab[LOG_META_KEY] && typeof logsByTab[LOG_META_KEY] === 'object') {
      delete logsByTab[LOG_META_KEY][tabKey];
    }

    safeSet(
      {
        [STORAGE_KEYS.findPageStateByTab]: stateByTab,
        [STORAGE_KEYS.logsByTab]: logsByTab,
      },
      () => {},
    );
  });
});
