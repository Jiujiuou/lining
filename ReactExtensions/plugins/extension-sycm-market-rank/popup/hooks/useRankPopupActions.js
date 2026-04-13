import { useCallback, useMemo } from 'react';
import { SYCM_RANK_LIMITS } from '@/shared/constants.js';
import { rankLogger } from '@/shared/logger.js';
import { rowKey } from '@/popup/utils/selectionUtils.js';

export function useRankPopupActions({
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
}) {
  const onToggleRow = useCallback(
    (rowId, checked) => {
      setSessionTouched(true);
      setSelectedIds((prev) => {
        const set = new Set(prev);
        if (checked) {
          set.add(rowId);
        } else {
          set.delete(rowId);
        }
        const next = Array.from(set).slice(0, SYCM_RANK_LIMITS.RANK_MAX_ITEMS);
        persistSelection(next);
        return next;
      });
    },
    [persistSelection, setSelectedIds, setSessionTouched],
  );

  const onSelectAll = useCallback(() => {
    const items = Array.isArray(snapshot.items) ? snapshot.items : [];
    const next = items
      .map((row, index) => rowKey(row, index))
      .slice(0, SYCM_RANK_LIMITS.RANK_MAX_ITEMS);
    setSessionTouched(true);
    setSelectedIds(next);
    persistSelection(next);
  }, [persistSelection, setSelectedIds, setSessionTouched, snapshot.items]);

  const onSelectNone = useCallback(() => {
    setSessionTouched(true);
    setSelectedIds([]);
    persistSelection([]);
  }, [persistSelection, setSelectedIds, setSessionTouched]);

  const onSave = useCallback(() => {
    const selectedCount = selectedIds.length;
    const text = `已保存：当前勾选 ${selectedCount} 个店铺`;
    setSessionTouched(true);
    persistSelection(selectedIds);
    rankLogger.log(text);
    refreshLogs();
    setStatusText(text);

    if (saveMessageTimerRef.current) {
      clearTimeout(saveMessageTimerRef.current);
    }
    saveMessageTimerRef.current = setTimeout(() => {
      setStatusText('');
      saveMessageTimerRef.current = null;
    }, 3000);
  }, [
    persistSelection,
    refreshLogs,
    saveMessageTimerRef,
    selectedIds,
    setSessionTouched,
    setStatusText,
  ]);

  const onRefresh = useCallback(() => {
    loadRank();
    refreshLogs();
    const itemCount = Array.isArray(snapshot.items) ? snapshot.items.length : 0;
    rankLogger.log(`[刷新列表] 共 ${itemCount} 条`);
    refreshLogs();
  }, [loadRank, refreshLogs, snapshot.items]);

  const onClearLogs = useCallback(() => {
    clearLogs();
  }, [clearLogs]);

  return useMemo(
    () => ({
      onToggleRow,
      onSelectAll,
      onSelectNone,
      onSave,
      onRefresh,
      onClearLogs,
    }),
    [onClearLogs, onRefresh, onSave, onSelectAll, onSelectNone, onToggleRow],
  );
}





