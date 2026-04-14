import { useEffect, useMemo, useState } from 'react';
import { useActiveTabId, useChromeStorageChange, useTabLogs } from '@rext-shared/hooks/index.js';
import { DY_FOLLOW_STORAGE_KEYS } from '@/shared/constants.js';
import { useFollowSnapshotLoader } from '@/popup/hooks/useFollowSnapshotLoader.js';
import { useFollowViewStatePersistence } from '@/popup/hooks/useFollowViewStatePersistence.js';
import { useFollowPopupActions } from '@/popup/hooks/useFollowPopupActions.js';
import { rowKey } from '@/popup/utils/followRowUtils.js';
import { includesKeyword } from '@/popup/utils/filterUtils.js';

const STATUS_OPTIONS = ['全部', '未查看', '已查看'];

function normalizeStatus(viewState, id) {
  if (!viewState || !viewState[id] || !viewState[id].status) {
    return '未查看';
  }
  const raw = String(viewState[id].status);
  if (raw === '已查看') {
    return '已查看';
  }
  return '未查看';
}

export function useFollowPopupController() {
  const [snapshot, setSnapshot] = useState({ users: [] });
  const [viewState, setViewState] = useState({});
  const [crawlState, setCrawlState] = useState({});
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');

  const { tabId } = useActiveTabId();
  const { entries: logs, refresh: refreshLogs } = useTabLogs({
    tabId,
    logKey: DY_FOLLOW_STORAGE_KEYS.logs,
    logsByTabKey: DY_FOLLOW_STORAGE_KEYS.logsByTab,
    pollMs: 2000,
  });

  const loadAll = useFollowSnapshotLoader({
    tabId,
    setSnapshot,
    setSelection: () => {},
    setViewState,
    setCrawlState,
  });
  const markByKeys = useFollowViewStatePersistence();

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useChromeStorageChange(
    () => {
      loadAll();
      refreshLogs();
    },
    {
      keys: [
        DY_FOLLOW_STORAGE_KEYS.snapshotByTab,
        DY_FOLLOW_STORAGE_KEYS.snapshotLatest,
        DY_FOLLOW_STORAGE_KEYS.selectionByTab,
        DY_FOLLOW_STORAGE_KEYS.selectionGlobal,
        DY_FOLLOW_STORAGE_KEYS.viewState,
        DY_FOLLOW_STORAGE_KEYS.logsByTab,
        DY_FOLLOW_STORAGE_KEYS.crawlStateByTab,
      ],
    },
  );

  const rows = useMemo(() => {
    const users = Array.isArray(snapshot.users) ? snapshot.users : [];
    const list = [];
    for (let i = 0; i < users.length; i += 1) {
      const user = users[i] || {};
      const id = rowKey(user, i);
      const viewStatus = normalizeStatus(viewState, id);
      if (!includesKeyword(user, keyword)) {
        continue;
      }
      if (statusFilter !== '全部' && viewStatus !== statusFilter) {
        continue;
      }
      list.push({
        id,
        uid: user.uid || '',
        secUid: user.secUid || '',
        nickname: user.nickname || '（无昵称）',
        signature: user.signature || '',
        avatar: user.avatar || '',
        viewStatus,
      });
    }
    return list;
  }, [keyword, snapshot.users, statusFilter, viewState]);

  const actions = useFollowPopupActions({
    tabId,
    rows,
    loadAll,
    markByKeys,
  });

  return {
    rows,
    logs,
    crawlState,
    statusOptions: STATUS_OPTIONS,
    keyword,
    statusFilter,
    setKeyword,
    setStatusFilter,
    ...actions,
  };
}
