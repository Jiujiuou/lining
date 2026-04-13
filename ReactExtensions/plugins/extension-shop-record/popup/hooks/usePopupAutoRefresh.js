import { usePopupAutoRefresh as useSharedPopupAutoRefresh } from '@rext-shared/hooks/usePopupAutoRefresh.js';

export function usePopupAutoRefresh() {
  useSharedPopupAutoRefresh({ runtimeKey: '__SHOP_RECORD_POPUP_RUNTIME__' });
}






