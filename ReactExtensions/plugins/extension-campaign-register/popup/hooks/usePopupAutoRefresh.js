import { usePopupAutoRefresh as useSharedPopupAutoRefresh } from '@rext-shared/hooks/usePopupAutoRefresh.js';

export function usePopupAutoRefresh() {
  useSharedPopupAutoRefresh({ runtimeKey: '__AMCR_POPUP_RUNTIME__' });
}






