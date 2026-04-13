import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getLocalAsync,
  safeSet,
} from '@rext-shared/services/chrome/storageService.js';
import { useChromeStorageChange } from '@rext-shared/hooks/useChromeStorageChange.js';

const DEFAULT_META_KEY = '__meta';

function normalizeEntries(entries) {
  return Array.isArray(entries) ? entries : [];
}

function pickEntries({ tabId, logKey, logsByTabKey, data }) {
  if (tabId == null) {
    const fallback = data[logKey];
    return normalizeEntries(fallback && fallback.entries);
  }

  const byTab = data[logsByTabKey];
  const bucket = byTab && byTab[String(tabId)];
  return normalizeEntries(bucket && bucket.entries);
}

export function useTabLogs(options = {}) {
  const tabId = options.tabId ?? null;
  const logKey = options.logKey || '';
  const logsByTabKey = options.logsByTabKey || '';
  const pollMs = Number(options.pollMs) || 0;
  const metaKey = options.metaKey || DEFAULT_META_KEY;
  const [entries, setEntries] = useState([]);

  const storageKeys = useMemo(() => {
    return [logKey, logsByTabKey].filter(Boolean);
  }, [logKey, logsByTabKey]);

  const refresh = useCallback(async () => {
    if (!logKey && !logsByTabKey) {
      setEntries([]);
      return [];
    }

    const result = await getLocalAsync(storageKeys);
    const nextEntries = pickEntries({
      tabId,
      logKey,
      logsByTabKey,
      data: result,
    });
    setEntries(nextEntries);
    return nextEntries;
  }, [storageKeys, tabId, logKey, logsByTabKey]);

  const clear = useCallback(() => {
    if (!logKey && !logsByTabKey) {
      return;
    }

    if (tabId == null) {
      if (!logKey) {
        setEntries([]);
        return;
      }
      safeSet({ [logKey]: { entries: [] } }, () => {
        setEntries([]);
      });
      return;
    }

    if (!logsByTabKey) {
      setEntries([]);
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
      safeSet({ [logsByTabKey]: byTab }, () => {
        setEntries([]);
      });
    });
  }, [tabId, logKey, logsByTabKey, metaKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useChromeStorageChange(
    () => {
      refresh();
    },
    {
      enabled: storageKeys.length > 0,
      keys: storageKeys,
    },
  );

  useEffect(() => {
    if (pollMs <= 0) {
      return undefined;
    }
    const timer = setInterval(() => {
      refresh();
    }, pollMs);
    return () => {
      clearInterval(timer);
    };
  }, [pollMs, refresh]);

  return {
    entries,
    refresh,
    clear,
  };
}
