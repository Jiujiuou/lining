import { useEffect } from 'react';
import { getPopupRuntime } from '@rext-shared/hooks/usePopupRuntime.js';

function bindEvent(element, eventName, handler, options) {
  if (!element || typeof element.addEventListener !== 'function' || typeof handler !== 'function') {
    return () => {};
  }
  element.addEventListener(eventName, handler, options);
  return () => element.removeEventListener(eventName, handler, options);
}

export function usePopupDomEvents(bindingList, options = {}) {
  const runtimeKey = options.runtimeKey || '__AMCR_POPUP_RUNTIME__';

  useEffect(() => {
    const runtime = getPopupRuntime(runtimeKey);
    if (!runtime || !Array.isArray(bindingList) || bindingList.length === 0) {
      return () => {};
    }

    const disposers = bindingList.map((binding) => {
      if (!binding || !binding.id || !binding.event || !binding.handler) {
        return () => {};
      }
      const target = document.getElementById(binding.id);
      const runtimeHandler = runtime[binding.handler];
      return bindEvent(target, binding.event, runtimeHandler, binding.options);
    });

    return () => {
      for (let i = 0; i < disposers.length; i += 1) {
        disposers[i]();
      }
    };
  }, [bindingList, runtimeKey]);
}
