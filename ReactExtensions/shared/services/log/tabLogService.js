import { getLocalAsync, safeSet } from '@rext-shared/services/chrome/storageService.js';
import { resolveTabIdByMessage } from '@rext-shared/services/chrome/tabService.js';

function normalizeMaxCount(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizeEntryList(list, maxEntries) {
  const entries = Array.isArray(list) ? [...list] : [];
  if (entries.length <= maxEntries) {
    return entries;
  }
  return entries.slice(-maxEntries);
}

export function pruneByTabMeta(byTab, metaKey = '__meta', maxTabs = 6) {
  if (!byTab || typeof byTab !== 'object') {
    return {};
  }

  const safeMetaKey = metaKey || '__meta';
  const safeMaxTabs = normalizeMaxCount(maxTabs, 6);
  const nextByTab = { ...byTab };
  const meta =
    nextByTab[safeMetaKey] && typeof nextByTab[safeMetaKey] === 'object'
      ? { ...nextByTab[safeMetaKey] }
      : {};

  const tabIds = Object.keys(nextByTab).filter((key) => key !== safeMetaKey);
  tabIds.sort((left, right) => {
    const leftAt = meta[left] || '';
    const rightAt = meta[right] || '';
    return String(leftAt).localeCompare(String(rightAt));
  });

  while (tabIds.length > safeMaxTabs) {
    const oldestTabId = tabIds.shift();
    delete nextByTab[oldestTabId];
    delete meta[oldestTabId];
  }

  nextByTab[safeMetaKey] = meta;
  return nextByTab;
}

export function createTabLogService(options) {
  const config = options || {};
  const logKey = config.logKey;
  const logsByTabKey = config.logsByTabKey;
  const getTabIdMessageType = config.getTabIdMessageType;
  const maxEntries = normalizeMaxCount(config.maxEntries, 20);
  const maxTabs = normalizeMaxCount(config.maxTabs, 6);
  const metaKey = config.metaKey || '__meta';
  const afterAppend =
    typeof config.afterAppend === 'function' ? config.afterAppend : null;

  if (!logKey || !logsByTabKey) {
    throw new Error('createTabLogService 缺少 logKey 或 logsByTabKey');
  }

  function resolveTabId(callback) {
    if (!getTabIdMessageType) {
      callback(null);
      return;
    }
    resolveTabIdByMessage(getTabIdMessageType, callback);
  }

  function appendLog(level, message) {
    const entry = {
      t: new Date().toISOString(),
      level: level || 'log',
      msg: String(message ?? ''),
    };

    resolveTabId(async (tabId) => {
      if (tabId == null) {
        const result = await getLocalAsync([logKey]);
        const data = result[logKey] && typeof result[logKey] === 'object' ? { ...result[logKey] } : {};
        data.entries = normalizeEntryList(data.entries, maxEntries);
        data.entries.push(entry);
        data.entries = normalizeEntryList(data.entries, maxEntries);
        safeSet({ [logKey]: data }, () => {});
        return;
      }

      const result = await getLocalAsync([logsByTabKey]);
      const byTab =
        result[logsByTabKey] && typeof result[logsByTabKey] === 'object'
          ? { ...result[logsByTabKey] }
          : {};
      const tabKey = String(tabId);
      const currentBucket =
        byTab[tabKey] && typeof byTab[tabKey] === 'object'
          ? { ...byTab[tabKey] }
          : {};

      const entries = normalizeEntryList(currentBucket.entries, maxEntries);
      entries.push(entry);
      currentBucket.entries = normalizeEntryList(entries, maxEntries);
      byTab[tabKey] = currentBucket;

      const meta =
        byTab[metaKey] && typeof byTab[metaKey] === 'object'
          ? { ...byTab[metaKey] }
          : {};
      meta[tabKey] = new Date().toISOString();
      byTab[metaKey] = meta;

      let prunedByTab = pruneByTabMeta(byTab, metaKey, maxTabs);
      const payload = { [logsByTabKey]: prunedByTab };
      safeSet(
        payload,
        () => {
          if (afterAppend) {
            afterAppend(entry, tabId);
          }
        },
        () => {
          prunedByTab = pruneByTabMeta(prunedByTab, metaKey, maxTabs);
          payload[logsByTabKey] = prunedByTab;
          safeSet(payload, () => {
            if (afterAppend) {
              afterAppend(entry, tabId);
            }
          });
        },
      );
    });
  }

  function getLogs(callback, tabId) {
    const done = typeof callback === 'function' ? callback : () => {};
    if (tabId == null) {
      getLocalAsync([logKey]).then((result) => {
        const data = result[logKey];
        const entries =
          data && Array.isArray(data.entries) ? data.entries : [];
        done(entries);
      });
      return;
    }

    getLocalAsync([logsByTabKey]).then((result) => {
      const byTab =
        result[logsByTabKey] && typeof result[logsByTabKey] === 'object'
          ? result[logsByTabKey]
          : {};
      const bucket = byTab[String(tabId)];
      const entries =
        bucket && Array.isArray(bucket.entries) ? bucket.entries : [];
      done(entries);
    });
  }

  function clearLogs(callback, tabId) {
    const done = typeof callback === 'function' ? callback : () => {};
    if (tabId == null) {
      safeSet({ [logKey]: { entries: [] } }, done);
      return;
    }

    getLocalAsync([logsByTabKey]).then((result) => {
      const byTab =
        result[logsByTabKey] && typeof result[logsByTabKey] === 'object'
          ? { ...result[logsByTabKey] }
          : {};
      const tabKey = String(tabId);
      delete byTab[tabKey];
      if (byTab[metaKey] && typeof byTab[metaKey] === 'object') {
        delete byTab[metaKey][tabKey];
      }
      safeSet({ [logsByTabKey]: byTab }, done);
    });
  }

  return {
    appendLog,
    getLogs,
    clearLogs,
    log: (message) => appendLog('log', message),
    warn: (message) => appendLog('warn', message),
    error: (message) => appendLog('error', message),
  };
}

