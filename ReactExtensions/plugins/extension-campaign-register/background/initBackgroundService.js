import { getLocalAsync, safeSet } from '@rext-shared/services/index.js';
import {
  AMCR_LIMITS,
  AMCR_RUNTIME,
  AMCR_STORAGE_KEYS,
} from '@/shared/constants.js';

const LOG_META_KEY = '__meta';

function pruneTabMapByMeta(byTab, maxTabs, metaKey) {
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

function appendCaptureLogEntry(tabId, message) {
  const entry = { t: new Date().toISOString(), level: 'log', msg: String(message || '') };
  if (tabId == null) {
    getLocalAsync([AMCR_STORAGE_KEYS.logs]).then((result) => {
      const data =
        result[AMCR_STORAGE_KEYS.logs] && typeof result[AMCR_STORAGE_KEYS.logs] === 'object'
          ? { ...result[AMCR_STORAGE_KEYS.logs] }
          : { entries: [] };
      const entries = Array.isArray(data.entries) ? [...data.entries] : [];
      entries.push(entry);
      data.entries = entries.slice(-AMCR_LIMITS.LOG_MAX_ENTRIES);
      safeSet({ [AMCR_STORAGE_KEYS.logs]: data });
    });
    return;
  }

  getLocalAsync([AMCR_STORAGE_KEYS.logsByTab]).then((result) => {
    const byTab =
      result[AMCR_STORAGE_KEYS.logsByTab] &&
      typeof result[AMCR_STORAGE_KEYS.logsByTab] === 'object'
        ? { ...result[AMCR_STORAGE_KEYS.logsByTab] }
        : {};
    const tabKey = String(tabId);
    const bucket =
      byTab[tabKey] && typeof byTab[tabKey] === 'object'
        ? { ...byTab[tabKey] }
        : { entries: [] };
    const entries = Array.isArray(bucket.entries) ? [...bucket.entries] : [];
    entries.push(entry);
    bucket.entries = entries.slice(-AMCR_LIMITS.LOG_MAX_ENTRIES);
    byTab[tabKey] = bucket;

    const meta =
      byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === 'object'
        ? { ...byTab[LOG_META_KEY] }
        : {};
    meta[tabKey] = new Date().toISOString();
    byTab[LOG_META_KEY] = meta;

    let pruned = pruneTabMapByMeta(byTab, AMCR_LIMITS.LOG_MAX_TABS, LOG_META_KEY);
    safeSet(
      { [AMCR_STORAGE_KEYS.logsByTab]: pruned },
      () => {},
      (retry) => {
        pruned = pruneTabMapByMeta(
          pruned,
          Math.max(1, AMCR_LIMITS.LOG_MAX_TABS - 1),
          LOG_META_KEY,
        );
        safeSet({ [AMCR_STORAGE_KEYS.logsByTab]: pruned }, retry);
      },
    );
  });
}

export function initBackgroundService() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === AMCR_RUNTIME.CAPTURE_LOG) {
      appendCaptureLogEntry(message.tabId != null ? message.tabId : null, message.msg || '');
      sendResponse({ ok: true });
      return true;
    }
    if (!message || message.type !== AMCR_RUNTIME.GET_TAB_ID) {
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
    getLocalAsync([AMCR_STORAGE_KEYS.findPageStateByTab, AMCR_STORAGE_KEYS.logsByTab]).then(
      (result) => {
        const tabKey = String(tabId);
        const byState =
          result[AMCR_STORAGE_KEYS.findPageStateByTab] &&
          typeof result[AMCR_STORAGE_KEYS.findPageStateByTab] === 'object'
            ? { ...result[AMCR_STORAGE_KEYS.findPageStateByTab] }
            : {};
        const byLogs =
          result[AMCR_STORAGE_KEYS.logsByTab] &&
          typeof result[AMCR_STORAGE_KEYS.logsByTab] === 'object'
            ? { ...result[AMCR_STORAGE_KEYS.logsByTab] }
            : {};

        const hasState = Object.prototype.hasOwnProperty.call(byState, tabKey);
        const hasLogs = Object.prototype.hasOwnProperty.call(byLogs, tabKey);
        if (!hasState && !hasLogs) {
          return;
        }
        delete byState[tabKey];
        delete byLogs[tabKey];
        if (byLogs[LOG_META_KEY] && typeof byLogs[LOG_META_KEY] === 'object') {
          delete byLogs[LOG_META_KEY][tabKey];
        }
        safeSet({
          [AMCR_STORAGE_KEYS.findPageStateByTab]: byState,
          [AMCR_STORAGE_KEYS.logsByTab]: byLogs,
        });
      },
    );
  });
}




