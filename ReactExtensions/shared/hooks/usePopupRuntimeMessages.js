import { useEffect } from 'react';
import { getPopupRuntime } from '@rext-shared/hooks/usePopupRuntime.js';

export function usePopupRuntimeMessages(options = {}) {
  const runtimeKey = options.runtimeKey || '__AMCR_POPUP_RUNTIME__';
  const handlerName = options.handlerName || 'handleRuntimeMessage';

  useEffect(() => {
    if (
      typeof chrome === 'undefined' ||
      !chrome.runtime ||
      !chrome.runtime.onMessage ||
      typeof chrome.runtime.onMessage.addListener !== 'function'
    ) {
      return () => {};
    }

    const runtime = getPopupRuntime(runtimeKey);
    if (!runtime || typeof runtime[handlerName] !== 'function') {
      return () => {};
    }

    const onMessage = (msg) => {
      runtime[handlerName](msg);
      return false;
    };

    chrome.runtime.onMessage.addListener(onMessage);
    return () => {
      if (typeof chrome.runtime.onMessage.removeListener === 'function') {
        chrome.runtime.onMessage.removeListener(onMessage);
      }
    };
  }, [handlerName, runtimeKey]);
}
