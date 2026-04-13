import { usePopupRuntimeMessages as useSharedPopupRuntimeMessages } from '@rext-shared/hooks/usePopupRuntimeMessages.js';

export function usePopupRuntimeMessages() {
  useSharedPopupRuntimeMessages({ runtimeKey: '__AMCR_POPUP_RUNTIME__' });
}






