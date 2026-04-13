import { usePopupLogSync as useSharedPopupLogSync } from '@rext-shared/hooks/usePopupLogSync.js';

export function usePopupLogSync() {
  useSharedPopupLogSync({ runtimeKey: '__SHOP_RECORD_POPUP_RUNTIME__' });
}






