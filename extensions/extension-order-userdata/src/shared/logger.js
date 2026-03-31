import { LOG_MAX_ENTRIES, LOG_MAX_TABS, STORAGE_KEYS } from './defaults.js';
import { MESSAGE_TYPES } from './messages.js';
import { pruneByMeta, safeSet } from './storage.js';

const LOG_META_KEY = '__meta';

function resolveTabId(callback) {
  try {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_TAB_ID }, (response) => {
      if (chrome.runtime.lastError || !response || response.tabId == null) {
        callback(null);
        return;
      }
      callback(response.tabId);
    });
  } catch (_error) {
    callback(null);
  }
}

export function appendLog(level, message) {
  const entry = {
    t: new Date().toISOString(),
    level: level || 'log',
    msg: String(message),
  };

  resolveTabId((tabId) => {
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

      if (!Array.isArray(bucket.entries)) bucket.entries = [];
      bucket.entries.push(entry);
      if (bucket.entries.length > LOG_MAX_ENTRIES) {
        bucket.entries = bucket.entries.slice(-LOG_MAX_ENTRIES);
      }

      byTab[String(tabId)] = bucket;
      const meta =
        byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === 'object'
          ? byTab[LOG_META_KEY]
          : {};
      meta[String(tabId)] = new Date().toISOString();
      byTab[LOG_META_KEY] = meta;

      const payload = {
        [STORAGE_KEYS.logsByTab]: pruneByMeta(byTab, LOG_META_KEY, LOG_MAX_TABS),
      };

      safeSet(payload, () => {}, () => {
        payload[STORAGE_KEYS.logsByTab] = pruneByMeta(
          payload[STORAGE_KEYS.logsByTab],
          LOG_META_KEY,
          Math.max(1, LOG_MAX_TABS - 1),
        );
        safeSet(payload, () => {});
      });
    });
  });
}

export function getLogs(callback, tabId) {
  if (tabId == null) {
    chrome.storage.local.get([STORAGE_KEYS.logs], (result) => {
      const data = result[STORAGE_KEYS.logs];
      callback(data && Array.isArray(data.entries) ? data.entries : []);
    });
    return;
  }

  chrome.storage.local.get([STORAGE_KEYS.logsByTab], (result) => {
    const byTab = result[STORAGE_KEYS.logsByTab] || {};
    const bucket = byTab[String(tabId)];
    callback(bucket && Array.isArray(bucket.entries) ? bucket.entries : []);
  });
}

export function clearLogs(callback, tabId) {
  if (tabId == null) {
    safeSet({ [STORAGE_KEYS.logs]: { entries: [] } }, () => {
      if (typeof callback === 'function') callback();
    });
    return;
  }

  chrome.storage.local.get([STORAGE_KEYS.logsByTab], (result) => {
    const byTab = result[STORAGE_KEYS.logsByTab] || {};
    delete byTab[String(tabId)];
    if (byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === 'object') {
      delete byTab[LOG_META_KEY][String(tabId)];
    }

    safeSet({ [STORAGE_KEYS.logsByTab]: byTab }, () => {
      if (typeof callback === 'function') callback();
    });
  });
}

export function log(message) {
  appendLog('log', message);
}

export function warn(message) {
  appendLog('warn', message);
}

export function error(message) {
  appendLog('error', message);
}
