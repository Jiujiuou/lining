import { useCallback } from 'react';
import { getLocalAsync } from '@rext-shared/services/index.js';
import { DY_FOLLOW_STORAGE_KEYS } from '@/shared/constants.js';

export function useFollowSnapshotLoader({ tabId, setSnapshot, setSelection, setViewState, setCrawlState }) {
  return useCallback(async () => {
    const result = await getLocalAsync([
      DY_FOLLOW_STORAGE_KEYS.snapshotByTab,
      DY_FOLLOW_STORAGE_KEYS.snapshotLatest,
      DY_FOLLOW_STORAGE_KEYS.selectionByTab,
      DY_FOLLOW_STORAGE_KEYS.selectionGlobal,
      DY_FOLLOW_STORAGE_KEYS.viewState,
      DY_FOLLOW_STORAGE_KEYS.crawlStateByTab,
      DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid,
    ]);
    const byTab = result[DY_FOLLOW_STORAGE_KEYS.snapshotByTab] || {};
    const selectedByTab = result[DY_FOLLOW_STORAGE_KEYS.selectionByTab] || {};
    const tabKey = tabId != null ? String(tabId) : null;
    const snapshot = (tabKey && byTab[tabKey]) || result[DY_FOLLOW_STORAGE_KEYS.snapshotLatest] || { users: [] };
    const selection =
      (tabKey && selectedByTab[tabKey] && selectedByTab[tabKey].ids) ||
      (result[DY_FOLLOW_STORAGE_KEYS.selectionGlobal] &&
        result[DY_FOLLOW_STORAGE_KEYS.selectionGlobal].ids) ||
      [];
    const viewState = result[DY_FOLLOW_STORAGE_KEYS.viewState] || {};
    const crawlByTab = result[DY_FOLLOW_STORAGE_KEYS.crawlStateByTab] || {};
    const crawlState = (tabKey && crawlByTab[tabKey]) || {};
    const postBySecUid =
      result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid] &&
      typeof result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid] === 'object'
        ? result[DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid]
        : {};
    const users = Array.isArray(snapshot && snapshot.users) ? snapshot.users : [];
    const mergedUsers = users.map((user) => {
      const secUid = user && user.secUid ? String(user.secUid) : '';
      if (!secUid) {
        return user;
      }
      const postSnapshot = postBySecUid[secUid] && typeof postBySecUid[secUid] === 'object' ? postBySecUid[secUid] : null;
      const postTotal = postSnapshot && postSnapshot.total != null ? Number(postSnapshot.total) : null;
      if (!Number.isFinite(postTotal) || postTotal < 0) {
        return user;
      }
      return {
        ...user,
        awemeCount: postTotal,
      };
    });
    setSnapshot({
      ...(snapshot && typeof snapshot === 'object' ? snapshot : { users: [] }),
      users: mergedUsers,
    });
    setSelection(Array.isArray(selection) ? selection : []);
    setViewState(viewState && typeof viewState === 'object' ? viewState : {});
    setCrawlState(crawlState && typeof crawlState === 'object' ? crawlState : {});
  }, [setCrawlState, setSelection, setSnapshot, setViewState, tabId]);
}
