import {
  parseKeyWordFromUrl,
  getEast8TimeStr,
} from '@rext-shared/utils/index.js';
import { sendRuntimeMessage } from '@rext-shared/services/index.js';
import {
  SYCM_RANK_PREFIX,
  SYCM_RANK_RUNTIME,
} from '@/shared/constants.js';

function parseRankResponse(data) {
  if (!data || data.code !== 0) {
    return null;
  }
  const outer = data.data && data.data.data;
  const list = outer && outer.data;
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }

  const updateTime =
    data.data && data.data.updateTime ? String(data.data.updateTime) : '';
  const items = [];

  for (let i = 0; i < list.length; i += 1) {
    const row = list[i] || {};
    const itemId =
      row.item && row.item.itemId != null ? String(row.item.itemId) : '';
    const shopTitleRaw =
      row.shop && (row.shop.title != null ? row.shop.title : row.shop.value);
    const shopTitle =
      shopTitleRaw != null && String(shopTitleRaw).trim() !== ''
        ? String(shopTitleRaw).trim()
        : '';
    const rankRaw = row.cateRankId && row.cateRankId.value;
    const rank = rankRaw != null && rankRaw !== '' ? Number(rankRaw) : Number.NaN;
    const itemTitle =
      row.item && row.item.title != null ? String(row.item.title).trim() : '';

    if (!itemId && !shopTitle) {
      continue;
    }

    items.push({
      shopTitle,
      rank: Number.isNaN(rank) ? null : rank,
      itemId,
      itemTitle,
    });
  }

  if (items.length === 0) {
    return null;
  }

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
    script.onload = function onLoad() {
      this.remove();
    };
    script.onerror = function onError() {};
    (document.head || document.documentElement).appendChild(script);
  } catch {
    // 忽略注入失败
  }
}

function sendCaptureToBackground(payload, meta) {
  sendRuntimeMessage(
    {
      type: SYCM_RANK_RUNTIME.RANK_CAPTURE,
      payload,
      meta: meta || null,
    },
    (response) => {
      if (response && response.resultLine) {
        console.log(SYCM_RANK_PREFIX, response.resultLine);
      }
    },
  );
}

function handleRankPayload(requestUrl, data) {
  const requestUrlText = requestUrl != null ? String(requestUrl) : '';
  console.log(SYCM_RANK_PREFIX, '监听到 rank.json', requestUrlText);

  if (!data || data._parseError) {
    const parseError = '正文无法解析为 JSON';
    console.warn(SYCM_RANK_PREFIX, parseError);
    sendCaptureToBackground(null, {
      requestUrl: requestUrlText,
      parseError,
    });
    return;
  }

  const parsed = parseRankResponse(data);
  if (!parsed) {
    const parseError = `code=${data.code != null ? data.code : '?'}${
      data.message ? ` ${String(data.message)}` : ''
    }${data.code === 0 ? '（列表为空）' : ''}`;
    console.warn(SYCM_RANK_PREFIX, '解析跳过', parseError);
    sendCaptureToBackground(null, {
      requestUrl: requestUrlText,
      parseError,
    });
    return;
  }

  const keyWord = parseKeyWordFromUrl(requestUrlText);
  const recordedAtEast8 = getEast8TimeStr();
  for (let i = 0; i < parsed.items.length; i += 1) {
    const item = parsed.items[i];
    console.log(
      SYCM_RANK_PREFIX,
      '排名',
      item.rank,
      '店铺名',
      item.shopTitle || '（无店铺名）',
    );
  }

  sendCaptureToBackground(
    {
      updatedAt: new Date().toISOString(),
      recordedAtEast8,
      updateTime: parsed.updateTime,
      keyWord,
      requestUrl: requestUrlText,
      items: parsed.items,
    },
    null,
  );
}

function onWindowMessage(event) {
  if (!event.data || event.data.source !== SYCM_RANK_RUNTIME.POST_MESSAGE_SOURCE) {
    return;
  }
  if (event.origin && !event.origin.includes('sycm.taobao.com')) {
    return;
  }
  handleRankPayload(event.data.requestUrl, event.data.data);
}

export function initRankContentCapture() {
  window.addEventListener('message', onWindowMessage);
  injectMainScript();
}




