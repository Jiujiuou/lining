import { usePopupAutoRefresh as useSharedPopupAutoRefresh } from '@rext-shared/hooks/usePopupAutoRefresh.js';

export function usePopupAutoRefresh() {
  useSharedPopupAutoRefresh({ runtimeKey: '__SYCM_DETAIL_POPUP_RUNTIME__' });
}






