import { useCallback } from 'react';
import {
  startOrderUserdataJob,
  stopOrderUserdataJob,
} from '@/popup/services/startOrderUserdataJob.js';

export function useOrderUserdataStartAction({
  form,
  isRunning,
  isStarting,
  setIsRunning,
  setIsStarting,
  setProgress,
  lastKnownTotalPageRef,
  appendLog,
  refreshLogs,
}) {
  const onStart = useCallback(async () => {
    if (isStarting) {
      return;
    }

    const begin = String(form.payDateBegin || '').trim();
    const end = String(form.payDateEnd || '').trim();
    if (begin && end && begin > end) {
      appendLog('warn', '日期范围无效：开始日期不能晚于结束日期');
      await refreshLogs();
      return;
    }

    setIsStarting(true);
    lastKnownTotalPageRef.current = null;
    setProgress({
      visible: true,
      label: '正在连接页面...',
      pages: '',
      percent: 0,
      indeterminate: true,
    });

    const payload = {
      unionSearch: String(form.unionSearch || '').trim(),
      buyerNick: String(form.buyerNick || '').trim(),
      orderStatus: String(form.orderStatus || 'SUCCESS'),
      payDateBegin: begin,
      payDateEnd: end,
    };

    const result = await startOrderUserdataJob(payload, {
      onInfo: (text) => appendLog('log', text),
      onError: (text) => appendLog('warn', text),
    });

    if (result.ok) {
      appendLog('log', '已开始获取，请保持页面打开直至完成');
      setIsRunning(true);
    } else if (!result.error) {
      appendLog('warn', '启动失败，请刷新页面后重试');
    }

    await refreshLogs();
    setIsStarting(false);
  }, [
    appendLog,
    form,
    isStarting,
    lastKnownTotalPageRef,
    refreshLogs,
    setIsRunning,
    setIsStarting,
    setProgress,
  ]);

  const onStop = useCallback(async () => {
    if (!isRunning || isStarting) return;
    const result = await stopOrderUserdataJob();
    if (result.ok) {
      appendLog('log', '已发送停止请求');
    } else {
      appendLog('warn', '停止失败：请切回订单页面后重试');
    }
    await refreshLogs();
  }, [appendLog, isRunning, isStarting, refreshLogs]);

  return { onStart, onStop };
}
