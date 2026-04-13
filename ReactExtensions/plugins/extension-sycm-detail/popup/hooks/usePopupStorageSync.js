import { usePopupStorageSync as useSharedPopupStorageSync } from '@rext-shared/hooks/usePopupStorageSync.js';

export function usePopupStorageSync() {
  useSharedPopupStorageSync({ runtimeKey: '__SYCM_DETAIL_POPUP_RUNTIME__' });
}






