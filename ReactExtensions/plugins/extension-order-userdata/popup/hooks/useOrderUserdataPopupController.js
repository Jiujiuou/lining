import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useActiveTabId, useTabLogs } from '@rext-shared/hooks/index.js';
import { OU_STORAGE_KEYS } from '@/shared/constants.js';
import { ouLogger } from '@/shared/logger.js';
import {
  getDefaultForm,
  readFormByTab,
  saveFormByTab,
} from '@/popup/utils/formStorageUtils.js';
import { getDefaultProgress } from '@/popup/utils/progressUtils.js';
import { useOrderUserdataRuntimeMessages } from '@/popup/hooks/useOrderUserdataRuntimeMessages.js';
import { useOrderUserdataFocusSync } from '@/popup/hooks/useOrderUserdataFocusSync.js';
import { useOrderUserdataStartAction } from '@/popup/hooks/useOrderUserdataStartAction.js';

export function useOrderUserdataPopupController() {
  const [form, setForm] = useState(getDefaultForm);
  const [progress, setProgress] = useState(getDefaultProgress);
  const [isStarting, setIsStarting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const lastKnownTotalPageRef = useRef(null);
  const { tabId, refresh: refreshTabId } = useActiveTabId();

  const {
    entries: logs,
    refresh: refreshLogs,
    clear: clearLogs,
  } = useTabLogs({
    tabId,
    logKey: OU_STORAGE_KEYS.logs,
    logsByTabKey: OU_STORAGE_KEYS.logsByTab,
  });

  const appendLog = useCallback((level, message) => {
    if (level === 'warn') {
      ouLogger.warn(message);
      return;
    }
    if (level === 'error') {
      ouLogger.error(message);
      return;
    }
    ouLogger.log(message);
  }, []);

  const refreshAll = useCallback(async () => {
    await refreshTabId();
    await refreshLogs();
  }, [refreshTabId, refreshLogs]);

  useEffect(() => {
    readFormByTab(tabId).then((nextForm) => {
      setForm(nextForm);
    });
  }, [tabId]);

  useOrderUserdataRuntimeMessages({
    appendLog,
    refreshLogs,
    setProgress,
    setIsRunning,
    lastKnownTotalPageRef,
  });

  useOrderUserdataFocusSync({
    tabId,
    refreshAll,
    setForm,
  });

  const setFormField = useCallback(
    (field, value) => {
      setForm((prev) => {
        const next = {
          ...prev,
          [field]: value,
        };
        saveFormByTab(tabId, next);
        return next;
      });
    },
    [tabId],
  );

  const { onStart, onStop } = useOrderUserdataStartAction({
    form,
    isRunning,
    isStarting,
    setIsRunning,
    setIsStarting,
    setProgress,
    lastKnownTotalPageRef,
    appendLog,
    refreshLogs,
  });

  const onClearLogs = useCallback(() => {
    clearLogs();
  }, [clearLogs]);

  const logsForView = useMemo(() => {
    return Array.isArray(logs) ? logs : [];
  }, [logs]);

  return {
    form,
    progress,
    logs: logsForView,
    isStarting,
    isRunning,
    setFormField,
    onStart,
    onStop,
    onClearLogs,
  };
}





