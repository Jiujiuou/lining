import { pruneByMeta, safeSet } from './storage.js';

const LOG_META_KEY = '__meta';

export function createTabbedLogger(options) {
  const {
    storageKeys,
    maxEntries = 20,
    maxTabs = 6,
    resolveTabId,
  } = options;

  function appendLogForTab(tabId, level, message) {
    const entry = {
      t: new Date().toISOString(),
      level: level || 'log',
      msg: String(message),
    };

    if (tabId == null) {
      chrome.storage.local.get([storageKeys.logs], (result) => {
        const data =
          result[storageKeys.logs] && Array.isArray(result[storageKeys.logs].entries)
            ? result[storageKeys.logs]
            : { entries: [] };

        data.entries.push(entry);
        if (data.entries.length > maxEntries) {
          data.entries = data.entries.slice(-maxEntries);
        }

        safeSet({ [storageKeys.logs]: data }, () => {});
      });
      return;
    }

    chrome.storage.local.get([storageKeys.logsByTab], (result) => {
      const byTab = result[storageKeys.logsByTab] || {};
      const bucket = byTab[String(tabId)] || { entries: [] };

      if (!Array.isArray(bucket.entries)) bucket.entries = [];
      bucket.entries.push(entry);
      if (bucket.entries.length > maxEntries) {
        bucket.entries = bucket.entries.slice(-maxEntries);
      }

      byTab[String(tabId)] = bucket;
      const meta =
        byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === 'object'
          ? byTab[LOG_META_KEY]
          : {};
      meta[String(tabId)] = new Date().toISOString();
      byTab[LOG_META_KEY] = meta;

      const payload = {
        [storageKeys.logsByTab]: pruneByMeta(byTab, LOG_META_KEY, maxTabs),
      };

      safeSet(payload, () => {}, () => {
        payload[storageKeys.logsByTab] = pruneByMeta(
          payload[storageKeys.logsByTab],
          LOG_META_KEY,
          Math.max(1, maxTabs - 1),
        );
        safeSet(payload, () => {});
      });
    });
  }

  function appendLog(level, message) {
    if (typeof resolveTabId !== 'function') {
      appendLogForTab(null, level, message);
      return;
    }

    resolveTabId((tabId) => {
      appendLogForTab(tabId, level, message);
    });
  }

  function getLogs(callback, tabId) {
    if (tabId == null) {
      chrome.storage.local.get([storageKeys.logs], (result) => {
        const data = result[storageKeys.logs];
        callback(data && Array.isArray(data.entries) ? data.entries : []);
      });
      return;
    }

    chrome.storage.local.get([storageKeys.logsByTab], (result) => {
      const byTab = result[storageKeys.logsByTab] || {};
      const bucket = byTab[String(tabId)];
      callback(bucket && Array.isArray(bucket.entries) ? bucket.entries : []);
    });
  }

  function clearLogs(callback, tabId) {
    if (tabId == null) {
      safeSet({ [storageKeys.logs]: { entries: [] } }, () => {
        if (typeof callback === 'function') callback();
      });
      return;
    }

    chrome.storage.local.get([storageKeys.logsByTab], (result) => {
      const byTab = result[storageKeys.logsByTab] || {};
      delete byTab[String(tabId)];
      if (byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === 'object') {
        delete byTab[LOG_META_KEY][String(tabId)];
      }

      safeSet({ [storageKeys.logsByTab]: byTab }, () => {
        if (typeof callback === 'function') callback();
      });
    });
  }

  return {
    appendLog,
    appendLogForTab,
    getLogs,
    clearLogs,
    log(message) {
      appendLog('log', message);
    },
    warn(message) {
      appendLog('warn', message);
    },
    error(message) {
      appendLog('error', message);
    },
  };
}
