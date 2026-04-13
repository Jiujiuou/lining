import { usePopupStorageSync as useSharedPopupStorageSync } from '@rext-shared/hooks/usePopupStorageSync.js';

export function usePopupStorageSync() {
  useSharedPopupStorageSync({ runtimeKey: '__SHOP_RECORD_POPUP_RUNTIME__' });
}






