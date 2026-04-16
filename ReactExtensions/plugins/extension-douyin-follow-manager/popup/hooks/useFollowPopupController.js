import { useCallback, useEffect, useMemo, useState } from 'react';
import { useActiveTabId, useChromeStorageChange, useTabLogs } from '@rext-shared/hooks/index.js';
import { getLocalAsync, safeSet } from '@rext-shared/services/index.js';
import { DY_FOLLOW_STORAGE_KEYS } from '@/shared/constants.js';
import { useFollowSnapshotLoader } from '@/popup/hooks/useFollowSnapshotLoader.js';
import { useFollowViewStatePersistence } from '@/popup/hooks/useFollowViewStatePersistence.js';
import { useFollowPopupActions } from '@/popup/hooks/useFollowPopupActions.js';
import { rowKey } from '@/popup/utils/followRowUtils.js';
import { includesKeyword } from '@/popup/utils/filterUtils.js';

const STATUS_OPTIONS = ['全部', '未查看', '已查看'];
const POPUP_VIEW_GLOBAL_KEY = '__global';

function normalizeStatus(viewState, id) {
  if (!viewState || !viewState[id] || !viewState[id].status) {
    return '未查看';
  }
  return String(viewState[id].status) === '已查看' ? '已查看' : '未查看';
}

function normalizeStatusFilter(value) {
  return STATUS_OPTIONS.includes(value) ? value : '全部';
}

function pickGlobalPopupView(rawValue) {
  if (!rawValue || typeof rawValue !== 'object') {
    return {};
  }
  if (rawValue[POPUP_VIEW_GLOBAL_KEY] && typeof rawValue[POPUP_VIEW_GLOBAL_KEY] === 'object') {
    return rawValue[POPUP_VIEW_GLOBAL_KEY];
  }
  return {};
}

export function useFollowPopupController() {
  const [snapshot, setSnapshot] = useState({ users: [] });
  const [viewState, setViewState] = useState({});
  const [crawlState, setCrawlState] = useState({});
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [sortField, setSortField] = useState('default');
  const [sortDirection, setSortDirection] = useState('desc');
  const [useHighQualityDownload, setUseHighQualityDownload] = useState(false);
  const [listScrollTop, setListScrollTop] = useState(0);
  const [viewStateLoaded, setViewStateLoaded] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    getLocalAsync([DY_FOLLOW_STORAGE_KEYS.popupViewStateByTab]).then((result) => {
      if (cancelled) {
        return;
      }
      const allView = result[DY_FOLLOW_STORAGE_KEYS.popupViewStateByTab];
      const globalView = pickGlobalPopupView(allView);

      if (typeof globalView.sortField === 'string') {
        setSortField(globalView.sortField);
      }
      if (globalView.sortDirection === 'asc' || globalView.sortDirection === 'desc') {
        setSortDirection(globalView.sortDirection);
      }
      setStatusFilter(normalizeStatusFilter(String(globalView.statusFilter || '全部')));
      if (Number.isFinite(Number(globalView.listScrollTop)) && Number(globalView.listScrollTop) >= 0) {
        setListScrollTop(Number(globalView.listScrollTop));
      }
      setUseHighQualityDownload(Boolean(globalView.useHighQualityDownload));
      setViewStateLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const updatePopupViewState = useCallback((patch) => {
    getLocalAsync([DY_FOLLOW_STORAGE_KEYS.popupViewStateByTab]).then((result) => {
      const byTab =
        result[DY_FOLLOW_STORAGE_KEYS.popupViewStateByTab] &&
        typeof result[DY_FOLLOW_STORAGE_KEYS.popupViewStateByTab] === 'object'
          ? { ...result[DY_FOLLOW_STORAGE_KEYS.popupViewStateByTab] }
          : {};

      const prevGlobal =
        byTab[POPUP_VIEW_GLOBAL_KEY] && typeof byTab[POPUP_VIEW_GLOBAL_KEY] === 'object'
          ? { ...byTab[POPUP_VIEW_GLOBAL_KEY] }
          : {};

      byTab[POPUP_VIEW_GLOBAL_KEY] = {
        ...prevGlobal,
        ...patch,
        updatedAt: Date.now(),
      };

      safeSet({ [DY_FOLLOW_STORAGE_KEYS.popupViewStateByTab]: byTab });
    });
  }, []);

  useEffect(() => {
    if (!viewStateLoaded) {
      return;
    }
    updatePopupViewState({
      statusFilter,
      sortField,
      sortDirection,
      useHighQualityDownload,
    });
  }, [
    statusFilter,
    sortDirection,
    sortField,
    updatePopupViewState,
    useHighQualityDownload,
    viewStateLoaded,
  ]);

  const onListScrollTopChange = useCallback(
    (scrollTop) => {
      const next = Number(scrollTop);
      if (!Number.isFinite(next) || next < 0) {
        return;
      }
      setListScrollTop(next);
      updatePopupViewState({ listScrollTop: next });
    },
    [updatePopupViewState],
  );

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
        DY_FOLLOW_STORAGE_KEYS.postSnapshotBySecUid,
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
        followerCount: user.followerCount != null ? Number(user.followerCount) : null,
        followingCount: user.followingCount != null ? Number(user.followingCount) : null,
        awemeCount: user.awemeCount != null ? Number(user.awemeCount) : null,
        viewStatus,
      });
    }

    if (sortField === 'default') {
      return list;
    }

    const next = [...list];
    next.sort((left, right) => {
      const lv = Number(left[sortField]);
      const rv = Number(right[sortField]);
      const l = Number.isFinite(lv) ? lv : -1;
      const r = Number.isFinite(rv) ? rv : -1;
      return sortDirection === 'asc' ? l - r : r - l;
    });
    return next;
  }, [keyword, snapshot.users, sortDirection, sortField, statusFilter, viewState]);

  const totalCount = useMemo(() => {
    const users = Array.isArray(snapshot.users) ? snapshot.users : [];
    return users.length;
  }, [snapshot.users]);

  const viewedCount = useMemo(() => {
    const users = Array.isArray(snapshot.users) ? snapshot.users : [];
    let count = 0;
    for (let i = 0; i < users.length; i += 1) {
      const id = rowKey(users[i], i);
      if (normalizeStatus(viewState, id) === '已查看') {
        count += 1;
      }
    }
    return count;
  }, [snapshot.users, viewState]);

  const actions = useFollowPopupActions({
    tabId,
    rows,
    loadAll,
    markByKeys,
    useHighQualityDownload,
  });

  return {
    rows,
    logs,
    crawlState,
    totalCount,
    viewedCount,
    statusOptions: STATUS_OPTIONS,
    keyword,
    statusFilter,
    sortField,
    sortDirection,
    useHighQualityDownload,
    listScrollTop,
    setKeyword,
    setStatusFilter,
    setSortField,
    setSortDirection,
    setUseHighQualityDownload,
    onListScrollTopChange,
    ...actions,
  };
}
