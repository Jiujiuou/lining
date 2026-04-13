import { useEffect } from 'react';
import { addRuntimeListener } from '@rext-shared/services/index.js';
import { OU_RUNTIME } from '@/shared/constants.js';
import { buildProgressState } from '@/popup/utils/progressUtils.js';

export function useOrderUserdataRuntimeMessages({
  appendLog,
  refreshLogs,
  setProgress,
  setIsRunning,
  lastKnownTotalPageRef,
}) {
  useEffect(() => {
    const removeListener = addRuntimeListener((message) => {
      if (!message) {
        return undefined;
      }

      if (message.type === OU_RUNTIME.USER_DATA_PROGRESS) {
        const total = message.totalPage != null ? Number(message.totalPage) : 0;
        if (total > 0) {
          lastKnownTotalPageRef.current = total;
        }
        setProgress(buildProgressState(message));
        if (message.message) {
          appendLog('log', String(message.message));
          refreshLogs();
        }
        return undefined;
      }

      if (message.type === OU_RUNTIME.USER_DATA_DONE) {
        setIsRunning(false);
        setProgress({
          visible: true,
          label: message.stopped ? '已停止' : message.error ? '已结束（含错误）' : '已完成',
          pages:
            lastKnownTotalPageRef.current && lastKnownTotalPageRef.current > 0
              ? `共 ${lastKnownTotalPageRef.current} 页`
              : '',
          percent: message.stopped ? 0 : 100,
          indeterminate: false,
        });

        if (message.stopped) {
          appendLog('warn', '任务已停止');
        } else if (message.error) {
          appendLog('warn', `结束（含错误）：${String(message.error)}`);
        } else {
          const rows = Array.isArray(message.rows) ? message.rows : [];
          let summary = `全部完成，共 ${rows.length} 条，已导出 CSV`;
          if (lastKnownTotalPageRef.current && lastKnownTotalPageRef.current > 0) {
            summary += `，总页数 ${lastKnownTotalPageRef.current}`;
          }
          appendLog('log', summary);
        }
        refreshLogs();
      }

      return undefined;
    });

    return () => {
      removeListener();
    };
  }, [appendLog, lastKnownTotalPageRef, refreshLogs, setIsRunning, setProgress]);
}





