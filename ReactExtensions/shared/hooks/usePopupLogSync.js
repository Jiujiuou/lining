import { useEffect } from 'react';
import { getPopupRuntime } from '@rext-shared/hooks/usePopupRuntime.js';

export function usePopupLogSync(options = {}) {
  const runtimeKey = options.runtimeKey || '__AMCR_POPUP_RUNTIME__';

  useEffect(() => {
    const runtime = getPopupRuntime(runtimeKey);
    if (!runtime || typeof runtime.refreshLogs !== 'function') {
      return () => {};
    }

    const refreshLogs = () => {
      runtime.refreshLogs();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshLogs();
      }
    };

    refreshLogs();
    const timer = setInterval(refreshLogs, 15000);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [runtimeKey]);
}
