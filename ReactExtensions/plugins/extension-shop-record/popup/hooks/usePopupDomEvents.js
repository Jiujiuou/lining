import { useMemo } from 'react';
import { usePopupDomEvents as useSharedPopupDomEvents } from '@rext-shared/hooks/usePopupDomEvents.js';

export function usePopupDomEvents() {
  const bindingList = useMemo(() => ([
    { id: 'logs-clear', event: 'click', handler: 'clearLogs' },
    { id: 'daily-local-clear', event: 'click', handler: 'clearDailyLocalSnapshot' },
    { id: 'open-all-pages', event: 'click', handler: 'openAllPages' },
    { id: 'shop-rate-open', event: 'click', handler: 'openShopRate' },
    { id: 'alimama-open', event: 'click', handler: 'openAlimama' },
    { id: 'onebp-open', event: 'click', handler: 'openOnebpSearch' },
    { id: 'onebp-display-open', event: 'click', handler: 'openOnebpDisplay' },
    { id: 'onebp-site-open', event: 'click', handler: 'openOnebpSite' },
    { id: 'onebp-shortvideo-open', event: 'click', handler: 'openOnebpShortVideo' },
    { id: 'sycm-my-space-open', event: 'click', handler: 'openSycmMySpace' },
    { id: 'report-submit-open', event: 'click', handler: 'openReportSubmit' },
    { id: 'report-submit-fill', event: 'click', handler: 'fillReportSubmit' },
  ]), []);

  useSharedPopupDomEvents(bindingList, { runtimeKey: '__SHOP_RECORD_POPUP_RUNTIME__' });
}






