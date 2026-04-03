import { MESSAGE_TYPES } from '../messages.js';

const CONTENT_GUARD = '__LINING_OU_USERDATA_CS__';

function sendRuntimeMessage(payload) {
  try {
    const pending = chrome.runtime.sendMessage(payload);
    if (pending && typeof pending.catch === 'function') {
      pending.catch(() => {});
    }
  } catch (_error) {
    // ignore runtime delivery failures
  }
}

function injectMainScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('order-userdata-main.js');
  script.dataset.ouUserdataMain = 'true';
  (document.documentElement || document.body).appendChild(script);
  script.onload = () => {
    script.remove();
  };
}

function escapeCsvCell(value) {
  if (value == null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function orderIdCellForExcelCsv(orderId) {
  const text = orderId == null ? '' : String(orderId);
  return `="${text.replace(/"/g, '""')}"`;
}

function downloadCsv(rows) {
  const headers = ['订单ID', '昵称'];
  const lines = [headers.join(',')];

  for (const row of rows) {
    lines.push([orderIdCellForExcelCsv(row.orderId), escapeCsvCell(row.nick)].join(','));
  }

  const csv = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const now = new Date();
  const pad = (value) => (value < 10 ? `0${value}` : String(value));
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  anchor.href = url;
  anchor.download = `sold_userdata_ou_${stamp}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function onPageMessage(event) {
  if (event.source !== window || !event.data) return;

  const { type } = event.data;

  if (type === MESSAGE_TYPES.USER_DATA_DONE) {
    const rows = event.data.rows || [];
    const error = event.data.error || null;

    if (rows.length > 0) {
      downloadCsv(rows);
    }

    sendRuntimeMessage({
      type: MESSAGE_TYPES.USER_DATA_DONE,
      rows,
      error,
    });
    return;
  }

  if (type === MESSAGE_TYPES.USER_DATA_PROGRESS) {
    sendRuntimeMessage({
      type: MESSAGE_TYPES.USER_DATA_PROGRESS,
      totalPage: event.data.totalPage,
      currentPage: event.data.currentPage,
      message: event.data.message,
    });
    return;
  }

  if (type === MESSAGE_TYPES.USER_DATA_PAGE) {
    sendRuntimeMessage({
      type: MESSAGE_TYPES.USER_DATA_PAGE,
      pageNum: event.data.pageNum,
      rows: event.data.rows || [],
    });
  }
}

function bootstrap() {
  try {
    const globalObject = typeof globalThis !== 'undefined' ? globalThis : window;
    if (globalObject[CONTENT_GUARD]) return;
    globalObject[CONTENT_GUARD] = true;
  } catch (_error) {
    return;
  }

  window.addEventListener('message', onPageMessage);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== MESSAGE_TYPES.GET_USER_DATA) return true;

    injectMainScript();

    setTimeout(() => {
      window.postMessage(
        {
          type: MESSAGE_TYPES.START_USER_DATA,
          unionSearch: message.unionSearch != null ? String(message.unionSearch) : '',
          buyerNick: message.buyerNick != null ? String(message.buyerNick) : '',
          orderStatus: message.orderStatus != null ? String(message.orderStatus) : 'SUCCESS',
        },
        '*',
      );
    }, 100);

    sendResponse({ ok: true });
    return true;
  });

  injectMainScript();
}

bootstrap();
