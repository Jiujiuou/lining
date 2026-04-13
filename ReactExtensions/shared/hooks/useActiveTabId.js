import { useCallback, useEffect, useState } from 'react';
import { getActiveTabIdAsync } from '@rext-shared/services/chrome/tabService.js';

export function useActiveTabId(options = {}) {
  const autoLoad = options.autoLoad !== false;
  const refreshOnWindowFocus = options.refreshOnWindowFocus !== false;
  const [tabId, setTabId] = useState(null);
  const [loading, setLoading] = useState(Boolean(autoLoad));

  const refresh = useCallback(async () => {
    const nextTabId = await getActiveTabIdAsync();
    setTabId(nextTabId);
    setLoading(false);
    return nextTabId;
  }, []);

  useEffect(() => {
    if (!autoLoad) {
      setLoading(false);
      return;
    }
    refresh();
  }, [autoLoad, refresh]);

  useEffect(() => {
    if (!refreshOnWindowFocus || typeof window === 'undefined') {
      return undefined;
    }

    const onFocus = () => {
      refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshOnWindowFocus, refresh]);

  return {
    tabId,
    loading,
    refresh,
    setTabId,
  };
}

