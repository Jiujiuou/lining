import { Fragment, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createMessageTabIdResolver, queryActiveTabId } from '../../shared/chrome/runtime.js';
import { createTabbedLogger } from '../../shared/chrome/tabbed-logger.js';
import { safeSet } from '../../shared/chrome/storage.js';
import { formatLogTime } from '../../shared/ui/text.js';
import { FORM_MAX_TABS, QN_OR_TRADE_REG, SOLD_PAGE_URL, STORAGE_KEYS } from '../defaults.js';
import { MESSAGE_TYPES } from '../messages.js';

const INITIAL_FORM = {
  unionSearch: '',
  buyerNick: '',
  orderStatus: 'SUCCESS',
};

const INITIAL_PROGRESS = {
  visible: false,
  indeterminate: false,
  label: '准备中...',
  pagesText: '',
  percent: 0,
};
const PAGE_COMMUNICATION_ERROR = '无法与页面通信，请刷新已卖出订单页后重试';

const popupBridge = {
  setLogs() {},
  setForm() {},
  getForm() {
    return INITIAL_FORM;
  },
  setProgress() {},
  hideProgress() {},
  onFormChange() {},
};

function renderMultilineText(text) {
  const lines = String(text == null ? '' : text).split('\n');
  return lines.map((line, index) => (
    <Fragment key={`${line}-${index}`}>
      {line}
      {index < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}

function PopupShell() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(INITIAL_PROGRESS);
  const logsListRef = useRef(null);
  const formRef = useRef(INITIAL_FORM);
  const shouldStickLogsRef = useRef(true);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    const el = logsListRef.current;
    if (!el) return;
    if (shouldStickLogsRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    popupBridge.setLogs = (entries) => {
      setLogs(Array.isArray(entries) ? entries.slice() : []);
    };
    popupBridge.setForm = (nextForm) => {
      const normalized = {
        unionSearch: String(nextForm && nextForm.unionSearch ? nextForm.unionSearch : ''),
        buyerNick: String(nextForm && nextForm.buyerNick ? nextForm.buyerNick : ''),
        orderStatus:
          nextForm && nextForm.orderStatus != null && String(nextForm.orderStatus).trim() !== ''
            ? String(nextForm.orderStatus)
            : 'SUCCESS',
      };
      formRef.current = normalized;
      setForm(normalized);
    };
    popupBridge.getForm = () => ({ ...formRef.current });
    popupBridge.setProgress = (nextProgress) => {
      setProgress({
        visible: !!nextProgress.visible,
        indeterminate: !!nextProgress.indeterminate,
        label: String(nextProgress.label || ''),
        pagesText: String(nextProgress.pagesText || ''),
        percent: Math.max(0, Math.min(100, Number(nextProgress.percent || 0))),
      });
    };
    popupBridge.hideProgress = () => {
      setProgress({
        visible: false,
        indeterminate: false,
        label: INITIAL_PROGRESS.label,
        pagesText: '',
        percent: 0,
      });
    };
    popupBridge.onFormChange = (partial) => {
      const current = popupBridge.getForm();
      const next = {
        ...current,
        ...partial,
      };
      popupBridge.setForm(next);
    };

    const cleanup = initPopup();
    return () => {
      if (typeof cleanup === 'function') cleanup();
      popupBridge.setLogs = () => {};
      popupBridge.setForm = () => {};
      popupBridge.getForm = () => INITIAL_FORM;
      popupBridge.setProgress = () => {};
      popupBridge.hideProgress = () => {};
      popupBridge.onFormChange = () => {};
    };
  }, []);

  return (
    <div className="ou-popup">
      <section className="ou-section ou-section--left" aria-label="获取订单用户数据">
        <h2 className="ou-title">获取订单用户数据</h2>
        <div className="ou-filters">
          <label className="ou-label">
            <span className="ou-label-text">联盟/店铺 ID</span>
            <input
              type="text"
              id="userdata-union-search"
              className="ou-input"
              placeholder="可选，例如 1017849608938"
              value={form.unionSearch}
              onChange={(event) => {
                popupBridge.onFormChange({ unionSearch: event.target.value });
              }}
            />
          </label>
          <label className="ou-label">
            <span className="ou-label-text">搜索词</span>
            <input
              type="text"
              id="userdata-buyer-nick"
              className="ou-input"
              placeholder="可选，买家昵称或商品关键词"
              value={form.buyerNick}
              onChange={(event) => {
                popupBridge.onFormChange({ buyerNick: event.target.value });
              }}
            />
          </label>
          <label className="ou-label">
            <span className="ou-label-text">订单状态</span>
            <select
              id="userdata-order-status"
              className="ou-select"
              aria-label="订单状态"
              value={form.orderStatus}
              onChange={(event) => {
                popupBridge.onFormChange({ orderStatus: event.target.value });
              }}
            >
              <option value="SUCCESS">已成交</option>
              <option value="NOT_PAID">待付款</option>
              <option value="PAID">待发货</option>
              <option value="SEND">已发货</option>
              <option value="DROP">交易关闭</option>
              <option value="ALL">全部</option>
            </select>
          </label>
        </div>
        <button type="button" id="btn-get-userdata" className="ou-btn">
          获取用户数据
        </button>
        <div
          id="ou-progress-wrap"
          className={`ou-progress-wrap${progress.visible ? '' : ' ou-progress-wrap--hidden'}${
            progress.indeterminate ? ' ou-progress-wrap--indeterminate' : ''
          }`}
          aria-hidden={progress.visible ? 'false' : 'true'}
        >
          <div className="ou-progress-meta">
            <span id="ou-progress-label" className="ou-progress-label">
              {progress.label}
            </span>
            <span id="ou-progress-pages" className="ou-progress-pages">
              {progress.pagesText}
            </span>
          </div>
          <div
            id="ou-progress-track"
            className="ou-progress-track"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={String(Math.round(progress.percent))}
          >
            <div id="ou-progress-fill" className="ou-progress-fill" style={{ width: `${progress.percent}%` }}></div>
          </div>
        </div>
      </section>
      <section className="ou-section ou-section--logs" aria-label="日志">
        <header className="ou-logs-header">
          <h2 className="ou-logs-title">日志</h2>
          <button type="button" id="logs-clear" className="ou-logs-clear">
            清空
          </button>
        </header>
        <div
          id="logs-list"
          className="ou-logs-list"
          role="log"
          aria-live="polite"
          ref={logsListRef}
          onScroll={() => {
            const el = logsListRef.current;
            if (!el) return;
            shouldStickLogsRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
          }}
        >
          {logs.length === 0 ? (
            <div className="ou-logs-empty">暂无日志</div>
          ) : (
            logs.map((entry, index) => {
              const level = entry && entry.level ? String(entry.level) : 'log';
              const time = formatLogTime(entry ? entry.t : '');
              const message = entry && entry.msg != null ? String(entry.msg) : '';
              return (
                <div className={`ou-log-entry ou-log-entry--${level}`} key={`${time}-${index}`}>
                  <span className="ou-log-time">{time}</span>
                  {renderMultilineText(message)}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

const mountNode = document.getElementById('popup-react-root');
if (mountNode) {
  createRoot(mountNode).render(<PopupShell />);
}

let popupInitialized = false;

function initPopup() {
  if (popupInitialized) return () => {};
  popupInitialized = true;

  const button = document.getElementById('btn-get-userdata');
  const logsClearButton = document.getElementById('logs-clear');

  const logger = createTabbedLogger({
    storageKeys: { logs: STORAGE_KEYS.logs, logsByTab: STORAGE_KEYS.logsByTab },
    maxEntries: 20,
    maxTabs: 6,
    resolveTabId: createMessageTabIdResolver(MESSAGE_TYPES.GET_TAB_ID),
  });

  let isDisposed = false;
  let lastKnownTotalPage = null;
  let lastPageCommWarnAt = 0;

  function getActiveTabId(callback) {
    queryActiveTabId({ active: true, currentWindow: true }, callback);
  }

  function loadLogs() {
    getActiveTabId((tabId) => {
      logger.getLogs((entries) => {
        if (isDisposed) return;
        popupBridge.setLogs(Array.isArray(entries) ? entries : []);
      }, tabId);
    });
  }

  function clearLogs() {
    getActiveTabId((tabId) => {
      logger.clearLogs(() => {
        loadLogs();
      }, tabId);
    });
  }

  function appendLog(level, message) {
    logger.appendLog(level, message);
    loadLogs();
  }

  function appendPageCommunicationWarn() {
    const now = Date.now();
    if (now - lastPageCommWarnAt < 1200) return;
    lastPageCommWarnAt = now;
    appendLog('warn', PAGE_COMMUNICATION_ERROR);
  }

  function saveFormForCurrentTab(formValue) {
    getActiveTabId((tabId) => {
      if (tabId == null) return;
      const payload = {
        unionSearch: String(formValue.unionSearch || '').trim(),
        buyerNick: String(formValue.buyerNick || '').trim(),
        orderStatus: String(formValue.orderStatus || 'SUCCESS') || 'SUCCESS',
      };

      chrome.storage.local.get([STORAGE_KEYS.formByTab], (result) => {
        const byTab = result[STORAGE_KEYS.formByTab] || {};
        byTab[String(tabId)] = payload;
        safeSet(
          { [STORAGE_KEYS.formByTab]: byTab },
          () => {},
          (retry) => {
            const keys = Object.keys(byTab).sort();
            while (keys.length > FORM_MAX_TABS) {
              delete byTab[keys.shift()];
            }
            safeSet({ [STORAGE_KEYS.formByTab]: byTab }, retry);
          },
        );
      });
    });
  }

  function loadFormForCurrentTab() {
    getActiveTabId((tabId) => {
      if (tabId == null) return;
      chrome.storage.local.get([STORAGE_KEYS.formByTab], (result) => {
        const byTab = result[STORAGE_KEYS.formByTab] || {};
        const form = byTab[String(tabId)];
        if (!form || typeof form !== 'object') return;
        popupBridge.setForm({
          unionSearch: form.unionSearch != null ? String(form.unionSearch) : '',
          buyerNick: form.buyerNick != null ? String(form.buyerNick) : '',
          orderStatus: form.orderStatus != null ? String(form.orderStatus) : 'SUCCESS',
        });
      });
    });
  }

  function showProgress(progress) {
    popupBridge.setProgress({
      visible: true,
      indeterminate: !!progress.indeterminate,
      label: progress.label || '',
      pagesText: progress.pagesText || '',
      percent: progress.percent || 0,
    });
  }

  function updateProgressUI(message) {
    const totalPage = message.totalPage != null ? Number(message.totalPage) : NaN;
    const currentPage = message.currentPage != null ? Number(message.currentPage) : 0;
    const text = String(message.message != null ? message.message : '').trim();

    if (!(totalPage > 0) || Number.isNaN(totalPage)) {
      showProgress({
        indeterminate: true,
        label: text || '处理中...',
        pagesText: '',
        percent: 0,
      });
      return;
    }

    let percent = Math.min(100, Math.max(0, (currentPage / totalPage) * 100));
    if (text.includes('正在请求')) {
      percent = Math.max(0, (((currentPage > 0 ? currentPage : 1) - 1) / totalPage) * 100);
    }
    if (text.includes('完成')) {
      percent = Math.min(100, Math.max(0, (currentPage / totalPage) * 100));
    }

    showProgress({
      indeterminate: false,
      label: text || '处理中...',
      pagesText: `共 ${totalPage} 页`,
      percent,
    });
  }

  function setProgressComplete(success) {
    showProgress({
      indeterminate: false,
      label: success ? '已完成' : '已结束',
      pagesText: '',
      percent: 100,
    });
  }

  function trySendToTab(tabId, payload, retryAfterInject) {
    chrome.tabs.sendMessage(tabId, payload, () => {
      if (!chrome.runtime.lastError) {
        appendLog('log', '已开始获取，请保持页面打开直至完成');
        lastKnownTotalPage = null;
        showProgress({
          indeterminate: true,
          label: '正在连接页面...',
          pagesText: '',
          percent: 0,
        });
        return;
      }

      if (retryAfterInject) {
        appendPageCommunicationWarn();
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId },
          files: ['content.js'],
        },
        () => {
          if (chrome.runtime.lastError) {
            appendPageCommunicationWarn();
            return;
          }
          setTimeout(() => {
            trySendToTab(tabId, payload, true);
          }, 800);
        },
      );
    });
  }

  function onGetUserDataClick() {
    const form = popupBridge.getForm();
    saveFormForCurrentTab(form);

    const payload = {
      type: MESSAGE_TYPES.GET_USER_DATA,
      unionSearch: String(form.unionSearch || '').trim(),
      buyerNick: String(form.buyerNick || '').trim(),
      orderStatus: String(form.orderStatus || 'SUCCESS') || 'SUCCESS',
    };

    chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
      const activeTab = activeTabs && activeTabs.length > 0 ? activeTabs[0] : null;
      if (activeTab && activeTab.id && activeTab.url && QN_OR_TRADE_REG.test(activeTab.url)) {
        trySendToTab(activeTab.id, payload, false);
        return;
      }

      chrome.tabs.query({ url: ['https://qn.taobao.com/*', 'https://trade.taobao.com/*'] }, (tabs) => {
        const existingTab = tabs && tabs.length > 0 ? tabs[0] : null;
        if (existingTab && existingTab.id) {
          chrome.tabs.update(existingTab.id, { active: true });
          trySendToTab(existingTab.id, payload, false);
          return;
        }

        chrome.tabs.create({ url: SOLD_PAGE_URL }, (newTab) => {
          appendLog('log', '已打开已卖出订单页，加载完成后将自动开始');

          const listener = (updatedTabId, changeInfo) => {
            if (!newTab || updatedTabId !== newTab.id || changeInfo.status !== 'complete') return;
            chrome.tabs.onUpdated.removeListener(listener);
            setTimeout(() => {
              trySendToTab(newTab.id, payload, false);
            }, 500);
          };

          chrome.tabs.onUpdated.addListener(listener);
        });
      });
    });
  }

  function onRuntimeMessage(message) {
    if (!message) return;
    if (message.type === MESSAGE_TYPES.USER_DATA_PROGRESS) {
      const totalPage = message.totalPage != null ? Number(message.totalPage) : 0;
      if (totalPage > 0) lastKnownTotalPage = totalPage;
      updateProgressUI(message);
      if (message.message) appendLog('log', String(message.message));
      return;
    }

    if (message.type === MESSAGE_TYPES.USER_DATA_PAGE) return;

    if (message.type === MESSAGE_TYPES.USER_DATA_DONE) {
      setProgressComplete(!message.error);
      if (message.error) {
        appendLog('warn', `结束（含错误）：${message.error}`);
        return;
      }
      const rows = message.rows || [];
      let summary = `全部完成，共 ${rows.length} 条，已导出 CSV`;
      if (lastKnownTotalPage != null && lastKnownTotalPage > 0) {
        summary += `，总页数 ${lastKnownTotalPage}`;
      }
      appendLog('log', summary);
    }
  }

  function onFocus() {
    loadFormForCurrentTab();
    loadLogs();
  }

  popupBridge.onFormChange = (partial) => {
    const next = { ...popupBridge.getForm(), ...partial };
    popupBridge.setForm(next);
    saveFormForCurrentTab(next);
  };

  if (button) button.addEventListener('click', onGetUserDataClick);
  if (logsClearButton) logsClearButton.addEventListener('click', clearLogs);
  chrome.runtime.onMessage.addListener(onRuntimeMessage);
  window.addEventListener('focus', onFocus);

  popupBridge.hideProgress();
  loadFormForCurrentTab();
  loadLogs();

  return () => {
    isDisposed = true;
    popupInitialized = false;
    popupBridge.onFormChange = () => {};
    if (button) button.removeEventListener('click', onGetUserDataClick);
    if (logsClearButton) logsClearButton.removeEventListener('click', clearLogs);
    chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    window.removeEventListener('focus', onFocus);
  };
}
