import { useMemo } from 'react';
import { usePopupDomEvents as useSharedPopupDomEvents } from '@rext-shared/hooks/usePopupDomEvents.js';

export function usePopupDomEvents() {
  const bindingList = useMemo(() => ([
    { id: 'logs-clear', event: 'click', handler: 'clearLogs' },
    { id: 'logs-export', event: 'click', handler: 'exportLogsToClipboard' },
    { id: 'goods-refresh', event: 'click', handler: 'onGoodsRefresh' },
    { id: 'goods-select-all', event: 'click', handler: 'onGoodsSelectAll' },
    { id: 'goods-select-none', event: 'click', handler: 'onGoodsSelectNone' },
    { id: 'goods-save', event: 'click', handler: 'saveFilterSettings' },
    { id: 'poll-start', event: 'click', handler: 'onPollStart' },
    { id: 'poll-stop', event: 'click', handler: 'onPollStop' },
    { id: 'goods-list', event: 'change', handler: 'onGoodsListChange' },
  ]), []);

  useSharedPopupDomEvents(bindingList, { runtimeKey: '__SYCM_DETAIL_POPUP_RUNTIME__' });
}






