import { usePopupLogSync as useSharedPopupLogSync } from '@rext-shared/hooks/usePopupLogSync.js';

export function usePopupLogSync() {
  useSharedPopupLogSync({ runtimeKey: '__SYCM_DETAIL_POPUP_RUNTIME__' });
}






