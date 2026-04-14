import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useActiveTabId, useTabLogs } from '@rext-shared/hooks/index.js';
import { IC_STORAGE_KEYS } from '@/shared/constants.js';
import { icLogger } from '@/shared/logger.js';
import { getDefaultForm, readFormByTab, saveFormByTab } from '@/popup/utils/formStorageUtils.js';
import { getDefaultProgress } from '@/popup/utils/progressUtils.js';
import { readLatestResult, readResultByItem, saveResultByItem } from '@/popup/utils/resultStorageUtils.js';
import { useItemCommentsRuntimeMessages } from '@/popup/hooks/useItemCommentsRuntimeMessages.js';
import { useItemCommentsStartAction } from '@/popup/hooks/useItemCommentsStartAction.js';

function normalizeComments(input) {
  if (!Array.isArray(input)) return [];
  const list = input
    .map((item) => ({
      commentId: item && item.commentId != null ? String(item.commentId) : '',
      userName: item && item.userName ? String(item.userName) : '匿名用户',
      dateTime: item && item.dateTime ? String(item.dateTime) : '',
      content: item && item.content ? String(item.content) : '',
    }))
    .filter((item) => item.content.trim());

  return list.sort((a, b) => {
    const ad = a.dateTime || '';
    const bd = b.dateTime || '';
    if (ad && bd && ad !== bd) return bd.localeCompare(ad, 'zh-CN');
    const aid = a.commentId || '';
    const bid = b.commentId || '';
    if (aid && bid && aid !== bid) return bid.localeCompare(aid, 'zh-CN');
    return 0;
  });
}

function normalizeAskQuestions(input) {
  if (!Array.isArray(input)) return [];
  const list = input
    .map((item) => ({
      questionId: item && item.questionId != null ? String(item.questionId) : '',
      title: item && item.title ? String(item.title) : '',
      userName: item && item.userName ? String(item.userName) : '匿名提问者',
      gmtCreate: item && item.gmtCreate ? String(item.gmtCreate) : '',
      answers: Array.isArray(item && item.answers)
        ? item.answers
            .map((ans) => ({
              answerId: ans && ans.answerId != null ? String(ans.answerId) : '',
              content: ans && ans.content ? String(ans.content) : '',
              userName: ans && ans.userName ? String(ans.userName) : '匿名回答者',
              gmtCreateStr: ans && ans.gmtCreateStr ? String(ans.gmtCreateStr) : '',
              gmtCreate: ans && ans.gmtCreate ? String(ans.gmtCreate) : '',
            }))
            .filter((ans) => ans.content.trim())
        : [],
    }))
    .filter((item) => item.questionId || item.title.trim());

  return list.sort((a, b) => {
    const ad = a.gmtCreate || '';
    const bd = b.gmtCreate || '';
    if (ad && bd && ad !== bd) return bd.localeCompare(ad, 'zh-CN');
    return (b.questionId || '').localeCompare(a.questionId || '', 'zh-CN');
  });
}

export function useItemCommentsPopupController() {
  const [form, setForm] = useState(getDefaultForm);
  const [progress, setProgress] = useState(getDefaultProgress);
  const [isStarting, setIsStarting] = useState(false);
  const [comments, setComments] = useState([]);
  const [askQuestions, setAskQuestions] = useState([]);
  const [currentItemId, setCurrentItemId] = useState('');
  const commentsRef = useRef([]);
  const askQuestionsRef = useRef([]);
  const { tabId, refresh: refreshTabId } = useActiveTabId();

  const { entries: logs, refresh: refreshLogs, clear: clearLogs } = useTabLogs({
    tabId,
    logKey: IC_STORAGE_KEYS.logs,
    logsByTabKey: IC_STORAGE_KEYS.logsByTab,
  });

  const appendLog = useCallback((level, message) => {
    if (level === 'warn') {
      icLogger.warn(message);
      return;
    }
    if (level === 'error') {
      icLogger.error(message);
      return;
    }
    icLogger.log(message);
  }, []);

  useEffect(() => {
    readFormByTab(tabId).then((nextForm) => setForm(nextForm));
  }, [tabId]);

  useEffect(() => {
    commentsRef.current = Array.isArray(comments) ? comments : [];
  }, [comments]);

  useEffect(() => {
    askQuestionsRef.current = Array.isArray(askQuestions) ? askQuestions : [];
  }, [askQuestions]);

  const resolveTargetItemId = useCallback(
    (payloadItemId) => {
      const fromPayload = payloadItemId != null ? String(payloadItemId).trim() : '';
      if (fromPayload) return fromPayload;
      const fromForm = form.itemId != null ? String(form.itemId).trim() : '';
      if (fromForm) return fromForm;
      return currentItemId != null ? String(currentItemId).trim() : '';
    },
    [currentItemId, form.itemId],
  );

  const applyCaptureResult = useCallback(
    (payload = {}) => {
      const itemId = resolveTargetItemId(payload.itemId);
      const captureType = String(payload.captureType || form.captureType || 'comments').trim() || 'comments';
      const preferNonEmpty = payload.preferNonEmpty === true;

      const hasComments = Array.isArray(payload.comments);
      const hasAskQuestions = Array.isArray(payload.askQuestions);

      let nextComments = Array.isArray(commentsRef.current) ? commentsRef.current : [];
      let nextAskQuestions = Array.isArray(askQuestionsRef.current) ? askQuestionsRef.current : [];

      if (hasComments) {
        const normalized = normalizeComments(payload.comments);
        const shouldApply = !preferNonEmpty || normalized.length > 0 || nextComments.length === 0;
        if (shouldApply) {
          commentsRef.current = normalized;
          nextComments = normalized;
          setComments(normalized);
        }
      }

      if (hasAskQuestions) {
        const normalized = normalizeAskQuestions(payload.askQuestions);
        const shouldApply = !preferNonEmpty || normalized.length > 0 || nextAskQuestions.length === 0;
        if (shouldApply) {
          askQuestionsRef.current = normalized;
          nextAskQuestions = normalized;
          setAskQuestions(normalized);
        }
      }

      if (itemId && (hasComments || hasAskQuestions)) {
        setCurrentItemId(itemId);
        saveResultByItem(itemId, {
          itemId,
          captureType,
          comments: hasComments ? nextComments : commentsRef.current,
          askQuestions: hasAskQuestions ? nextAskQuestions : askQuestionsRef.current,
          updatedAt: Date.now(),
        });
      }
    },
    [form.captureType, resolveTargetItemId],
  );

  useItemCommentsRuntimeMessages({
    appendLog,
    refreshLogs,
    setProgress,
    applyCaptureResult,
  });

  const setFormField = useCallback(
    (field, value) => {
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        saveFormByTab(tabId, next);
        return next;
      });
    },
    [tabId],
  );

  const onStart = useItemCommentsStartAction({
    form,
    isStarting,
    setIsStarting,
    setProgress,
    appendLog,
    refreshLogs,
    applyCaptureResult,
  });

  const onClearLogs = useCallback(() => {
    clearLogs();
  }, [clearLogs]);

  const onRefresh = useCallback(async () => {
    await refreshTabId();
    await refreshLogs();
  }, [refreshLogs, refreshTabId]);

  useEffect(() => {
    let cancelled = false;

    const hydrateResult = async () => {
      const targetItemId = form.itemId != null ? String(form.itemId).trim() : '';
      const cached = targetItemId ? await readResultByItem(targetItemId) : await readLatestResult();
      if (cancelled || !cached) return;

      const cachedComments = normalizeComments(cached.comments);
      const cachedAskQuestions = normalizeAskQuestions(cached.askQuestions);
      if (cachedComments.length === 0 && cachedAskQuestions.length === 0) return;

      commentsRef.current = cachedComments;
      askQuestionsRef.current = cachedAskQuestions;
      setComments(cachedComments);
      setAskQuestions(cachedAskQuestions);
      setCurrentItemId(cached.itemId || targetItemId || '');
      icLogger.log(
        `[结果缓存] 已恢复：商品ID=${cached.itemId || targetItemId || '-'}，评论=${cachedComments.length}，问题=${cachedAskQuestions.length}`,
      );
    };

    hydrateResult();
    return () => {
      cancelled = true;
    };
  }, [form.itemId, tabId]);

  useEffect(() => {
    icLogger.log(`[状态监控] 当前评论条数=${comments.length}`);
  }, [comments]);

  useEffect(() => {
    const answerTotal = askQuestions.reduce((sum, q) => sum + (Array.isArray(q.answers) ? q.answers.length : 0), 0);
    icLogger.log(`[状态监控] 当前问大家问题数=${askQuestions.length}，回答数=${answerTotal}`);
  }, [askQuestions]);

  return {
    form,
    progress,
    logs: useMemo(() => (Array.isArray(logs) ? logs : []), [logs]),
    comments,
    askQuestions,
    isStarting,
    setFormField,
    onStart,
    onClearLogs,
    onRefresh,
  };
}
