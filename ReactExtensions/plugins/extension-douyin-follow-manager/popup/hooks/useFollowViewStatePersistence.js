import { useCallback } from 'react';
import { getLocalAsync, safeSet } from '@rext-shared/services/index.js';
import { DY_FOLLOW_STORAGE_KEYS } from '@/shared/constants.js';

export function useFollowViewStatePersistence() {
  return useCallback(async (rowKeys, status) => {
    if (!Array.isArray(rowKeys) || rowKeys.length === 0) {
      return;
    }
    const result = await getLocalAsync([DY_FOLLOW_STORAGE_KEYS.viewState]);
    const current =
      result[DY_FOLLOW_STORAGE_KEYS.viewState] &&
      typeof result[DY_FOLLOW_STORAGE_KEYS.viewState] === 'object'
        ? { ...result[DY_FOLLOW_STORAGE_KEYS.viewState] }
        : {};
    const now = new Date().toISOString();
    for (let i = 0; i < rowKeys.length; i += 1) {
      const key = rowKeys[i];
      const prev = current[key] && typeof current[key] === 'object' ? { ...current[key] } : {};
      current[key] = {
        ...prev,
        status,
        viewedAt: now,
      };
    }
    safeSet({ [DY_FOLLOW_STORAGE_KEYS.viewState]: current });
  }, []);
}

