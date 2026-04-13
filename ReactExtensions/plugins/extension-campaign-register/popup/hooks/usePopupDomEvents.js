import { useMemo } from 'react';
import { usePopupDomEvents as useSharedPopupDomEvents } from '@rext-shared/hooks/usePopupDomEvents.js';

export function usePopupDomEvents() {
  const bindingList = useMemo(() => ([
    { id: 'logs-clear', event: 'click', handler: 'clearLogs' },
    { id: 'amcr-local-clear', event: 'click', handler: 'clearLocalRegister' },
    { id: 'amcr-local-export', event: 'click', handler: 'exportLocalRegisterTable' },
    { id: 'open-promo-record', event: 'click', handler: 'openPromoRecord' },
    { id: 'open-onesite-record', event: 'click', handler: 'openOnesiteRecord' },
    { id: 'open-search-record', event: 'click', handler: 'openSearchRecord' },
    { id: 'open-content-record', event: 'click', handler: 'openContentRecord' },
    { id: 'search-keyword-apply', event: 'click', handler: 'applySearchKeyword' },
    { id: 'findpage-action', event: 'click', handler: 'onFindPageAction' },
    { id: 'storage-cache-clear', event: 'click', handler: 'clearUnnecessaryCaches' },
    { id: 'findpage-refresh', event: 'click', handler: 'handleFindPageRefreshClick' },
    { id: 'search-keyword-input', event: 'keydown', handler: 'handleSearchKeywordKeydown' },
    { id: 'amcr-local-table-wrap', event: 'click', handler: 'handleLocalTableClick' },
    { id: 'amcr-local-table-wrap', event: 'blur', handler: 'handleLocalTableBlur', options: true },
    { id: 'popup-nav-date-trigger', event: 'click', handler: 'handleNavDateTriggerClick' },
    { id: 'popup-nav-cal-popover', event: 'click', handler: 'handleNavCalendarClick' },
  ]), []);

  useSharedPopupDomEvents(bindingList, { runtimeKey: '__AMCR_POPUP_RUNTIME__' });
}






