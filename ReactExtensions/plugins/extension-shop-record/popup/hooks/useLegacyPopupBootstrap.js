import { useEffect } from 'react';
import { initLegacyPopup } from '@/popup/legacy/initLegacyPopup.js';

export function useLegacyPopupBootstrap() {
  useEffect(() => {
    initLegacyPopup();
    const runtime = globalThis.__SHOP_RECORD_POPUP_RUNTIME__;
    if (runtime && typeof runtime.refreshAll === 'function') {
      runtime.refreshAll();
    }
  }, []);
}

