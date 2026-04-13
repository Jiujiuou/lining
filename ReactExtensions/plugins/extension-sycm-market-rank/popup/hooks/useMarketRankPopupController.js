import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useActiveTabId,
  useChromeStorageChange,
  useTabLogs,
} from '@rext-shared/hooks/index.js';
import { SYCM_RANK_STORAGE_KEYS } from '@/shared/constants.js';
import { rowKey } from '@/popup/utils/selectionUtils.js';
import { useRankSelectionPersistence } from '@/popup/hooks/useRankSelectionPersistence.js';
import { useRankSnapshotLoader } from '@/popup/hooks/useRankSnapshotLoader.js';
import { useRankPopupActions } from '@/popup/hooks/useRankPopupActions.js';

function useRankRowViewModels(snapshotItems, selectedIds) {
  return useMemo(() => {
    const items = Array.isArray(snapshotItems) ? snapshotItems : [];
    const checkedSet = new Set(selectedIds);
    return items.map((row, index) => {
      const id = rowKey(row, index);
      return {
        id,
        rank: row.rank != null ? String(row.rank) : '—',
        shopTitle:
          row.shopTitle != null && String(row.shopTitle).trim() !== ''
            ? String(row.shopTitle).trim()
            : '（无店名）',
        itemTitle:
          row.itemTitle != null && String(row.itemTitle).trim() !== ''
            ? String(row.itemTitle).trim()
            : '',
        checked: checkedSet.has(id),
      };
    });
  }, [selectedIds, snapshotItems]);
}

export function useMarketRankPopupController() {
  const [snapshot, setSnapshot] = useState({ items: [], keyWord: '', updateTime: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [metaText, setMetaText] = useState('');
  const [statusText, setStatusText] = useState('');
  const [sessionTouched, setSessionTouched] = useState(false);
  const saveMessageTimerRef = useRef(null);

  const { tabId } = useActiveTabId();
  const {
    entries: logs,
    refresh: refreshLogs,
    clear: clearLogs,
  } = useTabLogs({
    tabId,
    logKey: SYCM_RANK_STORAGE_KEYS.logs,
    logsByTabKey: SYCM_RANK_STORAGE_KEYS.logsByTab,
    pollMs: 2000,
  });

  const persistSelection = useRankSelectionPersistence(tabId);

  const loadRank = useRankSnapshotLoader({
    tabId,
    selectedIds,
    sessionTouched,
    persistSelection,
    setSnapshot,
    setSelectedIds,
    setMetaText,
  });

  useEffect(() => {
    loadRank();
  }, [loadRank]);

  useEffect(() => {
    return () => {
      if (saveMessageTimerRef.current) {
        clearTimeout(saveMessageTimerRef.current);
      }
    };
  }, []);

  useChromeStorageChange(
    () => {
      loadRank();
      refreshLogs();
    },
    {
      keys: [
        SYCM_RANK_STORAGE_KEYS.rankListByTab,
        SYCM_RANK_STORAGE_KEYS.rankListLatest,
        SYCM_RANK_STORAGE_KEYS.rankSelectionByTab,
        SYCM_RANK_STORAGE_KEYS.rankSelection,
        SYCM_RANK_STORAGE_KEYS.logsByTab,
        SYCM_RANK_STORAGE_KEYS.logs,
      ],
    },
  );

  const {
    onToggleRow,
    onSelectAll,
    onSelectNone,
    onSave,
    onRefresh,
    onClearLogs,
  } = useRankPopupActions({
    snapshot,
    selectedIds,
    persistSelection,
    loadRank,
    refreshLogs,
    clearLogs,
    setSessionTouched,
    setSelectedIds,
    setStatusText,
    saveMessageTimerRef,
  });

  const rowViewModels = useRankRowViewModels(snapshot.items, selectedIds);

  return {
    metaText: statusText || metaText,
    rows: rowViewModels,
    logs,
    onToggleRow,
    onSelectAll,
    onSelectNone,
    onSave,
    onRefresh,
    onClearLogs,
  };
}





