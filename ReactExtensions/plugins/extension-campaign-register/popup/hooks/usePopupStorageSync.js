import { usePopupStorageSync as useSharedPopupStorageSync } from '@rext-shared/hooks/usePopupStorageSync.js';

export function usePopupStorageSync() {
  useSharedPopupStorageSync({ runtimeKey: '__AMCR_POPUP_RUNTIME__' });
}






