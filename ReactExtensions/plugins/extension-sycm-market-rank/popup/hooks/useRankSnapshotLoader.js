import { useCallback } from 'react';
import { getLocalAsync } from '@rext-shared/services/index.js';
import { SYCM_RANK_STORAGE_KEYS } from '@/shared/constants.js';
import {
  getSelectionIds,
  filterIdsToCatalog,
} from '@/popup/utils/selectionUtils.js';
import { buildMetaText } from '@/popup/utils/viewUtils.js';

export function useRankSnapshotLoader({
  tabId,
  selectedIds,
  sessionTouched,
  persistSelection,
  setSnapshot,
  setSelectedIds,
  setMetaText,
}) {
  return useCallback(() => {
    getLocalAsync([
      SYCM_RANK_STORAGE_KEYS.rankListByTab,
      SYCM_RANK_STORAGE_KEYS.rankListLatest,
      SYCM_RANK_STORAGE_KEYS.rankSelectionByTab,
      SYCM_RANK_STORAGE_KEYS.rankSelection,
    ]).then((result) => {
      const rankByTab = result[SYCM_RANK_STORAGE_KEYS.rankListByTab] || {};
      const snapshotByTab =
        tabId != null && rankByTab[String(tabId)] ? rankByTab[String(tabId)] : null;
      const nextSnapshot =
        snapshotByTab || result[SYCM_RANK_STORAGE_KEYS.rankListLatest] || { items: [] };
      const items = Array.isArray(nextSnapshot.items) ? nextSnapshot.items : [];

      const selectionByTab = result[SYCM_RANK_STORAGE_KEYS.rankSelectionByTab] || {};
      const selectionFilter =
        tabId != null && selectionByTab[String(tabId)]
          ? selectionByTab[String(tabId)]
          : result[SYCM_RANK_STORAGE_KEYS.rankSelection];
      const idsFromStorage = getSelectionIds(selectionFilter);

      const baseIds = sessionTouched ? selectedIds : idsFromStorage;
      const nextIds = filterIdsToCatalog(baseIds, items);
      setSnapshot(nextSnapshot);
      setSelectedIds(nextIds);
      setMetaText(buildMetaText(nextSnapshot));

      if (sessionTouched && nextIds.length !== baseIds.length) {
        persistSelection(nextIds);
      }
    });
  }, [
    persistSelection,
    selectedIds,
    sessionTouched,
    setMetaText,
    setSelectedIds,
    setSnapshot,
    tabId,
  ]);
}





