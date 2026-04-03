import { getEast8TimeString, pad2 } from '../../shared/time/east8.js';
import { dispatchPageLog } from '../../shared/chrome/page-log.js';

function emitLog(level, msg) {
  dispatchPageLog('sycm-log', level, msg);
}

if (window.__sycmFlowSourcePollerLoaded) {
  emitLog('log', '[生意参谋] flow-source-poller 已加载');
} else {
  window.__sycmFlowSourcePollerLoaded = true;

  let running = false;
  let timer = null;
  let queue = [];
  let inFlight = 0;
  let maxConcurrency = 2;
  let templateUrl = '';
  let intervalMs = 30 * 1000;
  let tickSuccess = 0;

  function parseUrl(value) {
    try {
      return new URL(value, window.location.origin);
    } catch {
      return null;
    }
  }

  function buildUrlForItem(itemId) {
    const url = parseUrl(templateUrl);
    if (!url) return '';
    url.searchParams.set('itemId', String(itemId));
    url.searchParams.set('_', String(Date.now()));
    return url.toString();
  }

  function walkByPageName(nodes, name) {
    if (!Array.isArray(nodes)) return null;

    for (const node of nodes) {
      if (node && node.pageName && node.pageName.value === name) return node;
      if (node && node.children && node.children.length) {
        const found = walkByPageName(node.children, name);
        if (found) return found;
      }
    }

    return null;
  }

  function extractFlowMetrics(data) {
    const list = data && data.data && data.data.data;
    if (!Array.isArray(list)) return null;

    const searchNode = walkByPageName(list, '搜索');
    const cartNode = walkByPageName(list, '购物车');
    if (!searchNode || !cartNode) return null;

    function getNumber(node, key) {
      const value =
        node && node[key] && typeof node[key].value !== 'undefined' ? Number(node[key].value) : null;
      return value == null || Number.isNaN(value) ? null : value;
    }

    function getRate(node, key) {
      const value =
        node && node[key] && typeof node[key].value !== 'undefined' ? Number(node[key].value) : null;
      if (value == null || Number.isNaN(value)) return null;
      return Math.round(value * 100) / 100;
    }

    return {
      search_uv: getNumber(searchNode, 'uv'),
      search_pay_rate: getRate(searchNode, 'payRate'),
      cart_uv: getNumber(cartNode, 'uv'),
      cart_pay_rate: getRate(cartNode, 'payRate'),
    };
  }

  function dispatchFlowSourceEvent(itemId, payload) {
    try {
      document.dispatchEvent(
        new CustomEvent('sycm-flow-source', {
          detail: {
            payload,
            recordedAt: getEast8TimeString(),
            itemId: String(itemId),
          },
        }),
      );
    } catch {
      // ignore dispatch failures
    }
  }

  function stopInternal(reason) {
    running = false;
    queue = [];
    inFlight = 0;
    if (timer) clearInterval(timer);
    timer = null;
    if (reason) emitLog('warn', `[Sycm][Poll] stopped: ${reason}`);
  }

  function fetchOne(itemId) {
    const url = buildUrlForItem(itemId);
    if (!url) return Promise.reject(new Error('模板 URL 无效'));

    return fetch(url, { method: 'GET', credentials: 'include' })
      .then((response) =>
        response.json().then(
          (json) => ({ ok: response.ok, status: response.status, json }),
          () => ({ ok: response.ok, status: response.status, json: null }),
        ),
      )
      .then((result) => {
        if (!result.ok || !result.json || result.json.code !== 0) {
          const code = result.json && typeof result.json.code !== 'undefined' ? result.json.code : 'N/A';
          const message =
            result.json && (result.json.message || result.json.msg || result.json.subMsg)
              ? String(result.json.message || result.json.msg || result.json.subMsg)
              : '';
          throw new Error(
            `item ${String(itemId)} request failed: HTTP ${result.status} code=${code}${message ? ` message=${message}` : ''}`,
          );
        }

        const payload = extractFlowMetrics(result.json);
        if (!payload) throw new Error('failed to extract 搜索/购物车 metrics');

        tickSuccess += 1;
        dispatchFlowSourceEvent(itemId, payload);
        return true;
      });
  }

  function drain() {
    if (!running) return;

    while (inFlight < maxConcurrency && queue.length > 0) {
      const itemId = queue.shift();
      inFlight += 1;

      fetchOne(itemId)
        .catch((error) => {
      stopInternal(`请求失败，请重新打开详情页后重试。${String(error.message || error)}`);
        })
        .finally(() => {
          inFlight -= 1;
          if (running) setTimeout(drain, 0);
        });
    }
  }

  function tick() {
    if (!running) return;
    if (!templateUrl) {
      stopInternal('缺少详情请求模板，请先打开任意商品详情页');
      return;
    }
    if (!Array.isArray(queue) || queue.length === 0) return;

    tickSuccess = 0;
    drain();
    setTimeout(() => {
      if (!running) return;
      emitLog('log', `[生意参谋][轮询] 本轮完成：队列=${queue.length}，成功=${tickSuccess}`);
    }, 1200);
  }

  function start(options = {}) {
    const ids = options.itemIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      emitLog('warn', '[生意参谋][轮询] 未选择商品，无法启动');
      return;
    }

    templateUrl = typeof options.templateUrl === 'string' ? options.templateUrl : templateUrl;
    intervalMs =
      typeof options.intervalMs === 'number' && options.intervalMs >= 5000 ? options.intervalMs : intervalMs;
    maxConcurrency =
      typeof options.maxConcurrency === 'number' && options.maxConcurrency > 0
        ? options.maxConcurrency
        : maxConcurrency;

    queue = ids.map((itemId) => String(itemId));
    running = true;

    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      queue = ids.map((itemId) => String(itemId));
      tick();
    }, intervalMs);

    emitLog(
      'log',
      `[生意参谋][轮询] 已启动：商品=${ids.length}，间隔=${Math.round(intervalMs / 1000)}秒，并发=${maxConcurrency}`,
    );
    tick();
  }

  function stop() {
    stopInternal('用户手动停止');
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;

    if (event.data.type === 'SYCM_FLOW_POLL_START') {
      start(event.data);
      return;
    }

    if (event.data.type === 'SYCM_FLOW_POLL_STOP') {
      stop();
    }
  });

  emitLog('log', `[生意参谋] flow-source-poller 已加载：${pad2(new Date().getHours())}:${pad2(new Date().getMinutes())}`);
}
