import { ORDER_STATUS_TO_TAB } from '../defaults.js';
import { MESSAGE_TYPES } from '../messages.js';

const MAIN_GUARD = '__LINING_OU_USERDATA_MAIN__';
const API_URL =
  'https://trade.taobao.com/trade/itemlist/asyncSold.htm?event_submit_do_query=1&_input_charset=utf8';
const DELAY_MS = 500;

let capturedBody = null;
let filterUnionSearch = '';
let filterBuyerNick = '';
let filterOrderStatus = 'SUCCESS';

function emitMessage(type, payload = {}) {
  window.postMessage({ type, ...payload }, '*');
}

function captureAsyncSoldBody(url, body) {
  if (typeof url !== 'string' || typeof body !== 'string') return;
  if (!url.includes('asyncSold.htm')) return;
  capturedBody = body;
}

function patchFetch() {
  const rawFetch = window.fetch;
  if (!rawFetch) return;

  window.fetch = function patchedFetch(url, options) {
    const requestUrl = typeof url === 'string' ? url : url && url.url;
    if (options && options.method === 'POST' && typeof options.body === 'string') {
      captureAsyncSoldBody(requestUrl, options.body);
    }
    return rawFetch.apply(this, arguments);
  };
}

function buildBody(pageNum) {
  const prePageNo = Math.max(1, pageNum - 1);
  const tabCode = ORDER_STATUS_TO_TAB[filterOrderStatus] || 'success';
  const unionSearch = encodeURIComponent(filterUnionSearch);
  const buyerNick = encodeURIComponent(filterBuyerNick);

  if (capturedBody && /pageNum=\d+/.test(capturedBody)) {
    let body = capturedBody
      .replace(/pageNum=\d+/, `pageNum=${pageNum}`)
      .replace(/prePageNo=\d+/, `prePageNo=${prePageNo}`);

    if (filterUnionSearch !== '' && /unionSearch=/.test(body)) {
      body = body.replace(/unionSearch=[^&]*/, `unionSearch=${unionSearch}`);
    }
    if (/buyerNick=/.test(body)) {
      body = body.replace(/buyerNick=[^&]*/, `buyerNick=${buyerNick}`);
    }
    if (/orderStatus=/.test(body)) {
      body = body.replace(
        /orderStatus=[^&]*/,
        `orderStatus=${encodeURIComponent(filterOrderStatus)}`,
      );
    }
    if (/tabCode=/.test(body)) {
      body = body.replace(/tabCode=[^&]*/, `tabCode=${tabCode}`);
    }
    return body;
  }

  return [
    'isQnNew=true',
    'isHideNick=true',
    `prePageNo=${prePageNo}`,
    'sifg=0',
    'action=itemlist%2FSoldQueryAction',
    'close=0',
    `pageNum=${pageNum}`,
    `tabCode=${tabCode}`,
    'useCheckcode=false',
    'errorCheckcode=false',
    'payDateBegin=0',
    'rateStatus=ALL',
    `unionSearch=${unionSearch}`,
    `buyerNick=${buyerNick}`,
    `orderStatus=${filterOrderStatus}`,
    'pageSize=15',
    'dateEnd=0',
    'endTimeBegin=0',
    'endTimeEnd=0',
    'rxOldFlag=0',
    'rxSendFlag=0',
    'dateBegin=0',
    'tradeTag=0',
    'rxHasSendFlag=0',
    'auctionType=0',
    'sellerNick=',
    'notifySendGoodsType=ALL',
    'sellerMemoFlag=0',
    'useOrderInfo=false',
    'logisticsService=ALL',
    'o2oDeliveryType=ALL',
    'rxAuditFlag=0',
    'auctionId=',
    'queryOrder=desc',
    'holdStatus=0',
    'rxElectronicAuditFlag=0',
    'bizOrderId=',
    'queryMore=false',
    'payDateEnd=0',
    'rxWaitSendflag=0',
    'sellerMemo=0',
    'queryBizType=ALL',
    'rxElectronicAllFlag=0',
    'rxSuccessflag=0',
    'unionSearchTotalNum=0',
    'refund=ALL',
    'unionSearchPageNum=0',
    'yushouStatus=ALL',
    'deliveryTimeType=ALL',
    'payMethodType=ALL',
    'orderType=ALL',
    'appName=ALL',
  ].join('&');
}

function extractRows(data) {
  const mainOrders = data && data.mainOrders ? data.mainOrders : [];
  return mainOrders.map((order) => ({
    orderId: order && order.id != null ? String(order.id) : '',
    nick: order && order.buyer && order.buyer.nick != null ? String(order.buyer.nick) : '',
  }));
}

function hasReplacementChar(payload) {
  if (!payload || !Array.isArray(payload.mainOrders)) return false;
  return payload.mainOrders.some((order) => {
    const nick = order && order.buyer && order.buyer.nick;
    return typeof nick === 'string' && nick.includes('\uFFFD');
  });
}

async function decodeJsonResponse(response) {
  const buffer = await response.arrayBuffer();

  try {
    const utf8 = JSON.parse(new TextDecoder('utf-8').decode(buffer));
    if (!hasReplacementChar(utf8)) return utf8;
  } catch (_error) {
    // fall through to legacy decoders
  }

  try {
    return JSON.parse(new TextDecoder('gbk').decode(buffer));
  } catch (_error) {
    // keep trying
  }

  try {
    return JSON.parse(new TextDecoder('gb18030').decode(buffer));
  } catch (_error) {
    throw new Error('JSON parse error');
  }
}

function fetchPage(pageNum) {
  return fetch(API_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: buildBody(pageNum),
    credentials: 'include',
  }).then(decodeJsonResponse);
}

async function run() {
  emitMessage(MESSAGE_TYPES.USER_DATA_PROGRESS, {
    totalPage: null,
    currentPage: 0,
    message: '正在请求第 1 页…',
  });

  try {
    const firstPageData = await fetchPage(1);
    const page = firstPageData && firstPageData.page ? firstPageData.page : {};
    const pageSize = page.pageSize != null && page.pageSize > 0 ? parseInt(page.pageSize, 10) : 15;
    const totalNumber =
      page.totalNumber != null && page.totalNumber >= 0 ? parseInt(page.totalNumber, 10) : 0;
    const apiTotalPage =
      page.totalPage != null && page.totalPage > 0 ? parseInt(page.totalPage, 10) : 1;
    let totalPage = totalNumber > 0 && pageSize > 0 ? Math.ceil(totalNumber / pageSize) : apiTotalPage;

    if (apiTotalPage > 1000 && totalPage !== apiTotalPage) {
      totalPage = Math.ceil(totalNumber / pageSize);
    }

    let allRows = extractRows(firstPageData);

    emitMessage(MESSAGE_TYPES.USER_DATA_PROGRESS, {
      totalPage,
      currentPage: 1,
      message: `第 1 页完成，共 ${totalPage} 页`,
    });
    emitMessage(MESSAGE_TYPES.USER_DATA_PAGE, { pageNum: 1, rows: allRows });

    if (totalPage <= 1) {
      emitMessage(MESSAGE_TYPES.USER_DATA_DONE, { rows: allRows, error: null });
      return;
    }

    for (let currentPage = 2; currentPage <= totalPage; currentPage += 1) {
      emitMessage(MESSAGE_TYPES.USER_DATA_PROGRESS, {
        totalPage,
        currentPage,
        message: `正在请求第 ${currentPage} 页…`,
      });

      const pageData = await fetchPage(currentPage);
      const pageRows = extractRows(pageData);
      allRows = allRows.concat(pageRows);

      emitMessage(MESSAGE_TYPES.USER_DATA_PROGRESS, {
        totalPage,
        currentPage,
        message: `第 ${currentPage} 页完成，共 ${totalPage} 页`,
      });
      emitMessage(MESSAGE_TYPES.USER_DATA_PAGE, { pageNum: currentPage, rows: pageRows });

      if (currentPage < totalPage) {
        await new Promise((resolve) => {
          setTimeout(resolve, DELAY_MS);
        });
      }
    }

    emitMessage(MESSAGE_TYPES.USER_DATA_DONE, { rows: allRows, error: null });
  } catch (error) {
    emitMessage(MESSAGE_TYPES.USER_DATA_DONE, {
      rows: [],
      error: String((error && error.message) || error),
    });
  }
}

function bootstrap() {
  try {
    if (window[MAIN_GUARD]) return;
    window[MAIN_GUARD] = true;
  } catch (_error) {
    return;
  }

  patchFetch();

  window.addEventListener('message', (event) => {
    if (!event.data || event.source !== window || event.data.type !== MESSAGE_TYPES.START_USER_DATA) {
      return;
    }

    filterUnionSearch = event.data.unionSearch != null ? String(event.data.unionSearch) : '';
    filterBuyerNick = event.data.buyerNick != null ? String(event.data.buyerNick) : '';
    filterOrderStatus = event.data.orderStatus != null ? String(event.data.orderStatus) : 'SUCCESS';
    void run();
  });
}

bootstrap();
