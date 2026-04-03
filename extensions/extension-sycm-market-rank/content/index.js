import { sendRuntimeMessage } from '../../shared/chrome/runtime.js';
import { getEast8TimeString } from '../../shared/time/east8.js';
import { RUNTIME } from '../defaults.js';

function parseKeyWordFromUrl(url) {
  if (!url || typeof url !== 'string') return '';

  try {
    const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
    if (!query) return '';

    for (const part of query.split('&')) {
      if (!part.startsWith('keyWord=')) continue;
      return decodeURIComponent(part.slice('keyWord='.length).replace(/\+/g, ' ')).trim();
    }
  } catch (_error) {
    return '';
  }

  return '';
}

function parseRankResponse(data) {
  if (!data || data.code !== 0) return null;

  const outer = data.data && data.data.data;
  const list = outer && outer.data;
  if (!Array.isArray(list) || list.length === 0) return null;

  const updateTime = data.data && data.data.updateTime ? String(data.data.updateTime) : '';
  const items = [];

  for (const row of list) {
    const itemId = row && row.item && row.item.itemId != null ? String(row.item.itemId) : '';
    let shopTitle = row && row.shop && (row.shop.title != null ? row.shop.title : row.shop.value);
    shopTitle = shopTitle != null && String(shopTitle).trim() !== '' ? String(shopTitle).trim() : '';
    const rankRaw = row && row.cateRankId && row.cateRankId.value;
    const rank = rankRaw != null && rankRaw !== '' ? Number(rankRaw) : Number.NaN;
    const itemTitle =
      row && row.item && row.item.title != null ? String(row.item.title).trim() : '';

    if (!itemId && !shopTitle) continue;

    items.push({
      shopTitle,
      rank: Number.isNaN(rank) ? null : rank,
      itemId,
      itemTitle,
    });
  }

  if (items.length === 0) return null;

  items.sort((left, right) => {
    const leftRank = left.rank != null ? left.rank : 999999;
    const rightRank = right.rank != null ? right.rank : 999999;
    return leftRank - rightRank;
  });

  return { updateTime, items };
}

function injectMainScript() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = () => {
      script.remove();
    };
    script.onerror = () => {};
    (document.head || document.documentElement).appendChild(script);
  } catch (_error) {
    // ignore injection failures
  }
}

function handleRankPayload(requestUrl, data) {
  const requestUrlString = requestUrl != null ? String(requestUrl) : '';

  if (!data || data._parseError) {
    const parseError = '响应正文无法解析为 JSON';
    sendRuntimeMessage({
      type: RUNTIME.RANK_CAPTURE,
      payload: null,
      meta: { requestUrl: requestUrlString, parseError },
    });
    return;
  }

  const parsed = parseRankResponse(data);
  if (!parsed) {
    const parseError =
      `code=${data.code != null ? data.code : '?'}${data.message ? ` ${String(data.message)}` : ''}` +
      (data.code === 0 ? '（列表为空）' : '');
    sendRuntimeMessage({
      type: RUNTIME.RANK_CAPTURE,
      payload: null,
      meta: { requestUrl: requestUrlString, parseError },
    });
    return;
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    recordedAtEast8: getEast8TimeString(),
    updateTime: parsed.updateTime,
    keyWord: parseKeyWordFromUrl(requestUrlString),
    requestUrl: requestUrlString,
    items: parsed.items,
  };

  sendRuntimeMessage({ type: RUNTIME.RANK_CAPTURE, payload, meta: null });
}

window.addEventListener('message', (event) => {
  if (!event.data || event.data.source !== RUNTIME.MESSAGE_SOURCE) return;
  if (event.origin && event.origin.indexOf('sycm.taobao.com') < 0) return;
  handleRankPayload(event.data.requestUrl, event.data.data);
});

injectMainScript();
