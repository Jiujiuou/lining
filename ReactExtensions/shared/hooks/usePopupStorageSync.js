import { useEffect } from 'react';
import { getPopupRuntime } from '@rext-shared/hooks/usePopupRuntime.js';

export function usePopupStorageSync(options = {}) {
  const runtimeKey = options.runtimeKey || '__AMCR_POPUP_RUNTIME__';

  useEffect(() => {
    if (
      typeof chrome === 'undefined' ||
      !chrome.storage ||
      !chrome.storage.onChanged ||
      typeof chrome.storage.onChanged.addListener !== 'function'
    ) {
      return () => {};
    }

    const runtime = getPopupRuntime(runtimeKey);
    if (!runtime || typeof runtime.handleStorageChanged !== 'function') {
      return () => {};
    }

    const onStorageChanged = (changes, areaName) => {
      runtime.handleStorageChanged(changes, areaName);
    };

    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => {
      if (typeof chrome.storage.onChanged.removeListener === 'function') {
        chrome.storage.onChanged.removeListener(onStorageChanged);
      }
    };
  }, [runtimeKey]);
}
