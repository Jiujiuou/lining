import { useCallback } from 'react';
import {
  getLocalAsync,
  removeLocal,
  safeSet,
} from '@rext-shared/services/index.js';
import {
  SYCM_RANK_LIMITS,
  SYCM_RANK_STORAGE_KEYS,
} from '@/shared/constants.js';
import { pruneSelectionByTab } from '@/popup/utils/selectionUtils.js';

const SELECTION_META_KEY = '__meta';

export function useRankSelectionPersistence(tabId) {
  return useCallback(
    (ids) => {
      const normalized = ids.slice(0, SYCM_RANK_LIMITS.RANK_MAX_ITEMS);
      if (tabId == null) {
        safeSet(
          {
            [SYCM_RANK_STORAGE_KEYS.rankSelection]: {
              itemIds: normalized,
            },
          },
          () => {},
          (retry) => {
            removeLocal([SYCM_RANK_STORAGE_KEYS.rankSelection], () => {
              retry();
            });
          },
        );
        return;
      }

      getLocalAsync([SYCM_RANK_STORAGE_KEYS.rankSelectionByTab]).then((result) => {
        const byTab =
          result[SYCM_RANK_STORAGE_KEYS.rankSelectionByTab] &&
          typeof result[SYCM_RANK_STORAGE_KEYS.rankSelectionByTab] === 'object'
            ? { ...result[SYCM_RANK_STORAGE_KEYS.rankSelectionByTab] }
            : {};

        const tabKey = String(tabId);
        byTab[tabKey] = { itemIds: normalized };
        const meta =
          byTab[SELECTION_META_KEY] && typeof byTab[SELECTION_META_KEY] === 'object'
            ? { ...byTab[SELECTION_META_KEY] }
            : {};
        meta[tabKey] = new Date().toISOString();
        byTab[SELECTION_META_KEY] = meta;

        let pruned = pruneSelectionByTab(byTab);
        safeSet(
          { [SYCM_RANK_STORAGE_KEYS.rankSelectionByTab]: pruned },
          () => {},
          (retry) => {
            pruned = pruneSelectionByTab(pruned);
            safeSet({ [SYCM_RANK_STORAGE_KEYS.rankSelectionByTab]: pruned }, retry);
          },
        );
      });
    },
    [tabId],
  );
}





