import { sendRuntimeMessage } from '@rext-shared/services/index.js';
import { OU_RUNTIME } from '@/shared/constants.js';
import { downloadCsv } from '@/content/downloadCsv.js';

const CONTENT_GUARD_KEY = '__LINING_OU_USERDATA_CS__';

function injectMainScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('order-userdata-main.js');
  (document.documentElement || document.body).appendChild(script);
  script.onload = () => {
    script.remove();
  };
}

function relayPageMessage(event) {
  if (event.source !== window || !event.data) {
    return;
  }

  if (event.data.type === OU_RUNTIME.USER_DATA_DONE) {
    const rows = event.data.rows || [];
    const error = event.data.error || null;
    const stopped = Boolean(event.data.stopped);
    if (rows.length > 0 && !stopped) {
      downloadCsv(rows);
    }
    sendRuntimeMessage({
      type: OU_RUNTIME.USER_DATA_DONE,
      rows,
      error,
      stopped,
    });
    return;
  }

  if (event.data.type === OU_RUNTIME.USER_DATA_PROGRESS) {
    sendRuntimeMessage({
      type: OU_RUNTIME.USER_DATA_PROGRESS,
      totalPage: event.data.totalPage,
      currentPage: event.data.currentPage,
      message: event.data.message,
    });
    return;
  }

  if (event.data.type === OU_RUNTIME.USER_DATA_PAGE) {
    sendRuntimeMessage({
      type: OU_RUNTIME.USER_DATA_PAGE,
      pageNum: event.data.pageNum,
      rows: event.data.rows || [],
    });
  }
}

function handleRuntimeMessage(message, _sender, sendResponse) {
  if (!message || message.type !== OU_RUNTIME.GET_USER_DATA) {
    if (!message || message.type !== OU_RUNTIME.STOP_USER_DATA) {
      return false;
    }
    window.postMessage({ type: OU_RUNTIME.STOP_USER_DATA_MAIN }, '*');
    sendResponse({ ok: true });
    return true;
  }

  injectMainScript();
  setTimeout(() => {
    window.postMessage(
      {
        type: OU_RUNTIME.START_USER_DATA,
        unionSearch:
          message.unionSearch != null ? String(message.unionSearch) : '',
        buyerNick: message.buyerNick != null ? String(message.buyerNick) : '',
        orderStatus:
          message.orderStatus != null ? String(message.orderStatus) : 'SUCCESS',
        payDateBegin:
          message.payDateBegin != null ? String(message.payDateBegin) : '',
        payDateEnd:
          message.payDateEnd != null ? String(message.payDateEnd) : '',
      },
      '*',
    );
  }, 100);

  sendResponse({ ok: true });
  return true;
}

export function initContentScript() {
  try {
    if (globalThis[CONTENT_GUARD_KEY]) {
      return;
    }
    globalThis[CONTENT_GUARD_KEY] = true;
  } catch {
    return;
  }

  window.addEventListener('message', relayPageMessage);
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  injectMainScript();
}




