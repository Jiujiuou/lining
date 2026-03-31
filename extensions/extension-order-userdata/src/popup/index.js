import { FORM_MAX_TABS, QN_OR_TRADE_REG, SOLD_PAGE_URL, STORAGE_KEYS } from '../shared/defaults.js';
import { MESSAGE_TYPES } from '../shared/messages.js';
import * as logger from '../shared/logger.js';
import { safeSet } from '../shared/storage.js';

const button = document.getElementById('btn-get-userdata');
const unionInput = document.getElementById('userdata-union-search');
const buyerNickInput = document.getElementById('userdata-buyer-nick');
const statusSelect = document.getElementById('userdata-order-status');
const logsList = document.getElementById('logs-list');
const logsClearButton = document.getElementById('logs-clear');
const progressWrap = document.getElementById('ou-progress-wrap');
const progressLabel = document.getElementById('ou-progress-label');
const progressPages = document.getElementById('ou-progress-pages');
const progressTrack = document.getElementById('ou-progress-track');
const progressFill = document.getElementById('ou-progress-fill');

let lastKnownTotalPage = null;

function formatLogTime(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const pad = (value) => (value < 10 ? `0${value}` : String(value));
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  } catch (_error) {
    return '';
  }
}

function renderLogs(entries) {
  if (!logsList) return;

  const wasAtBottom = logsList.scrollHeight - logsList.scrollTop - logsList.clientHeight < 20;

  if (!Array.isArray(entries) || entries.length === 0) {
    logsList.innerHTML = '<div class="ou-logs-empty">暂无日志</div>';
    return;
  }

  logsList.innerHTML = entries
    .map((entry) => {
      const level = entry.level || 'log';
      const time = formatLogTime(entry.t);
      const message = String(entry.msg != null ? entry.msg : '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

      return `<div class="ou-log-entry ou-log-entry--${level}"><span class="ou-log-time">${time}</span>${message}</div>`;
    })
    .join('');

  if (wasAtBottom) {
    logsList.scrollTop = logsList.scrollHeight;
  }
}

function getActiveTabId(callback) {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
      callback(tabId);
    });
  } catch (_error) {
    callback(null);
  }
}

function loadLogs() {
  getActiveTabId((tabId) => {
    logger.getLogs(renderLogs, tabId);
  });
}

function clearLogs() {
  getActiveTabId((tabId) => {
    logger.clearLogs(() => {
      loadLogs();
    }, tabId);
  });
}

function loadFormForCurrentTab() {
  getActiveTabId((tabId) => {
    if (tabId == null) return;

    chrome.storage.local.get([STORAGE_KEYS.formByTab], (result) => {
      const byTab = result[STORAGE_KEYS.formByTab] || {};
      const form = byTab[String(tabId)];
      if (!form || typeof form !== 'object') return;

      if (unionInput && form.unionSearch != null) {
        unionInput.value = String(form.unionSearch);
      }
      if (buyerNickInput && form.buyerNick != null) {
        buyerNickInput.value = String(form.buyerNick);
      }
      if (statusSelect && form.orderStatus != null) {
        statusSelect.value = String(form.orderStatus);
      }
    });
  });
}

function saveFormForCurrentTab() {
  getActiveTabId((tabId) => {
    if (tabId == null) return;

    const payload = {
      unionSearch: unionInput ? String(unionInput.value || '').trim() : '',
      buyerNick: buyerNickInput ? String(buyerNickInput.value || '').trim() : '',
      orderStatus: statusSelect ? String(statusSelect.value || 'SUCCESS') : 'SUCCESS',
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

function bindFormPersistence() {
  const onFormChange = () => {
    saveFormForCurrentTab();
  };

  if (unionInput) unionInput.addEventListener('input', onFormChange);
  if (buyerNickInput) buyerNickInput.addEventListener('input', onFormChange);
  if (statusSelect) statusSelect.addEventListener('change', onFormChange);
}

function setProgressIndeterminate(enabled) {
  if (!progressWrap) return;
  progressWrap.classList.toggle('ou-progress-wrap--indeterminate', enabled);
}

function showProgressArea() {
  if (!progressWrap) return;
  progressWrap.classList.remove('ou-progress-wrap--hidden');
  progressWrap.setAttribute('aria-hidden', 'false');
}

function setProgressLabel(text) {
  if (progressLabel) {
    progressLabel.textContent = text;
  }
}

function hideProgressArea() {
  if (!progressWrap) return;
  progressWrap.classList.add('ou-progress-wrap--hidden');
  progressWrap.setAttribute('aria-hidden', 'true');
  setProgressIndeterminate(false);
  if (progressFill) progressFill.style.width = '0%';
  if (progressTrack) progressTrack.setAttribute('aria-valuenow', '0');
}

function updateProgressUI(message) {
  if (!progressWrap || !progressLabel || !progressFill || !progressTrack) return;

  showProgressArea();

  const totalPage = message.totalPage != null ? Number(message.totalPage) : NaN;
  const currentPage = message.currentPage != null ? Number(message.currentPage) : 0;
  const text = String(message.message != null ? message.message : '').trim();

  if (progressPages) {
    progressPages.textContent =
      totalPage > 0 && !Number.isNaN(totalPage) ? `共 ${totalPage} 页` : '';
  }

  setProgressLabel(text || '处理中…');

  if (!(totalPage > 0) || Number.isNaN(totalPage)) {
    setProgressIndeterminate(true);
    progressTrack.setAttribute('aria-valuenow', '0');
    return;
  }

  setProgressIndeterminate(false);

  let percent = Math.min(100, Math.max(0, (currentPage / totalPage) * 100));
  if (text.includes('正在请求')) {
    percent = Math.max(0, (((currentPage > 0 ? currentPage : 1) - 1) / totalPage) * 100);
  }
  if (text.includes('完成')) {
    percent = Math.min(100, Math.max(0, (currentPage / totalPage) * 100));
  }

  progressFill.style.width = `${percent}%`;
  progressTrack.setAttribute('aria-valuenow', String(Math.round(percent)));
}

function setProgressComplete(success) {
  if (!progressFill || !progressTrack) return;

  showProgressArea();
  setProgressIndeterminate(false);
  progressFill.style.width = '100%';
  progressTrack.setAttribute('aria-valuenow', '100');
  setProgressLabel(success ? '已完成' : '已结束');
}

function appendLog(level, message) {
  logger.appendLog(level, message);
  loadLogs();
}

function trySendToTab(tabId, payload, retryAfterInject) {
  chrome.tabs.sendMessage(tabId, payload, () => {
    if (!chrome.runtime.lastError) {
      appendLog('log', '已开始获取，请保持页面打开直至完成');
      lastKnownTotalPage = null;
      showProgressArea();
      setProgressIndeterminate(true);
      setProgressLabel('正在连接页面…');
      if (progressPages) progressPages.textContent = '';
      if (progressFill) progressFill.style.width = '0%';
      return;
    }

    if (retryAfterInject) {
      appendLog('warn', '无法与页面通信，请刷新已卖出订单页后重试');
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ['content.js'],
      },
      () => {
        if (chrome.runtime.lastError) {
          appendLog('warn', '无法与页面通信，请刷新已卖出订单页后重试');
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
  const payload = {
    type: MESSAGE_TYPES.GET_USER_DATA,
    unionSearch: unionInput ? String(unionInput.value || '').trim() : '',
    buyerNick: buyerNickInput ? String(buyerNickInput.value || '').trim() : '',
    orderStatus: statusSelect ? String(statusSelect.value || 'SUCCESS') : 'SUCCESS',
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
          if (!newTab || updatedTabId !== newTab.id || changeInfo.status !== 'complete') {
            return;
          }

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

chrome.runtime.onMessage.addListener((message) => {
  if (!message) return;

  if (message.type === MESSAGE_TYPES.USER_DATA_PROGRESS) {
    const totalPage = message.totalPage != null ? Number(message.totalPage) : 0;
    if (totalPage > 0) lastKnownTotalPage = totalPage;

    updateProgressUI(message);
    if (message.message) {
      appendLog('log', String(message.message));
    }
    return;
  }

  if (message.type === MESSAGE_TYPES.USER_DATA_PAGE) {
    return;
  }

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
});

if (button) button.addEventListener('click', onGetUserDataClick);
if (logsClearButton) logsClearButton.addEventListener('click', clearLogs);

bindFormPersistence();
loadFormForCurrentTab();
loadLogs();
hideProgressArea();

window.addEventListener('focus', () => {
  loadFormForCurrentTab();
  loadLogs();
});
