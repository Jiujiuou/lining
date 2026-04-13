import { useEffect } from 'react';
import { getPopupRuntime } from '@rext-shared/hooks/usePopupRuntime.js';

export function usePopupAutoRefresh(options = {}) {
  const runtimeKey = options.runtimeKey || '__AMCR_POPUP_RUNTIME__';

  useEffect(() => {
    const runtime = getPopupRuntime(runtimeKey);
    if (!runtime) {
      return () => {};
    }

    const onFocus = () => {
      if (typeof runtime.refreshOnFocus === 'function') {
        runtime.refreshOnFocus();
      }
    };

    const onBlur = () => {
      if (typeof runtime.stopAutoRefresh === 'function') {
        runtime.stopAutoRefresh();
      }
    };

    onFocus();
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    window.addEventListener('beforeunload', onBlur);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('beforeunload', onBlur);
      onBlur();
    };
  }, [runtimeKey]);
}
