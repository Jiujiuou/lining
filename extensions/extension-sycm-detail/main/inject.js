import { PIPELINES } from '../config.js';
import { getEast8TimeString } from '../../shared/time/east8.js';
import { dispatchPageLog } from '../../shared/chrome/page-log.js';

function emitLog(level, msg) {
  dispatchPageLog('sycm-log', level, msg);
}

if (window.__sycmCaptureLoaded) {
  emitLog('warn', '[生意参谋] inject.js 已加载，跳过重复注入');
} else {
  window.__sycmCaptureLoaded = true;
  emitLog('log', '[生意参谋] inject.js 已在页面主世界加载');

  try {
    Object.defineProperty(document, 'hidden', {
      get() {
        return false;
      },
      configurable: true,
    });
    Object.defineProperty(document, 'visibilityState', {
      get() {
        return 'visible';
      },
      configurable: true,
    });
  } catch (error) {
    emitLog('warn', `[生意参谋数据采集] 覆写页面可见性失败：${String(error)}`);
  }

  const sources = PIPELINES.map((pipeline) => ({
    urlContains: pipeline.urlContains,
    urlFilter: pipeline.urlFilter || null,
    eventName: pipeline.eventName,
    extractValue: pipeline.extractValue,
    multiValue: Boolean(pipeline.multiValue),
    mergeGoodsDetail: Boolean(pipeline.mergeGoodsDetail),
  }));

  function getUrl(input) {
    if (typeof input === 'string') return input;
    if (input && input.url) return input.url;
    if (input && typeof input === 'object' && 'url' in input) return input.url;
    return '';
  }

  function urlMatches(url, urlContains) {
    if (!url || typeof url !== 'string') return false;
    return url.includes(urlContains) || (url.includes('live.json') && urlContains.includes('live.json'));
  }

  function getItemIdFromLocation() {
    try {
      const params = new URLSearchParams(window.location.search);
      const itemId = params.get('itemId');
      return itemId ? String(itemId) : null;
    } catch {
      return null;
    }
  }

  function getItemIdFromUrl(url) {
    if (!url || typeof url !== 'string') return null;

    try {
      const parsed = new URL(url, window.location.origin);
      const itemId = parsed.searchParams.get('itemId');
      return itemId ? String(itemId) : null;
    } catch {
      try {
        const params = new URLSearchParams(url.split('?')[1] || '');
        const itemId = params.get('itemId');
        return itemId ? String(itemId) : null;
      } catch {
        return null;
      }
    }
  }

  function handleResponse(url, data) {
    const recordedAt = getEast8TimeString();

    for (const source of sources) {
      if (!urlMatches(url, source.urlContains)) continue;
      if (source.urlFilter && !source.urlFilter(url)) continue;

      try {
        if (source.eventName === 'sycm-flow-source') {
          document.dispatchEvent(
            new CustomEvent('sycm-flow-source-template', { detail: { url, t: Date.now() } }),
          );
        }

        const value = source.extractValue(data);
        if (typeof value === 'undefined') {
          const inner = data && data.data && data.data.data;
          const list = inner && inner.data;
          const listLen = Array.isArray(list) ? list.length : list ? 'non-array' : 'empty';
          emitLog(
            'warn',
            `[${source.eventName}] 解析结果为空，code=${data && data.code}，items=${listLen}`,
          );
          return;
        }

        const itemId = source.mergeGoodsDetail ? getItemIdFromUrl(url) || getItemIdFromLocation() : null;
        const detail = source.multiValue && value && typeof value === 'object' ? { payload: value } : { value };

        document.dispatchEvent(
          new CustomEvent(source.eventName, {
            detail: {
              ...detail,
              recordedAt,
              itemId: itemId || undefined,
            },
          }),
        );
      } catch (error) {
        emitLog('warn', `处理 ${source.eventName} 失败：${String(error)}`);
      }

      return;
    }
  }

  try {
    const originalFetch = window.fetch;
    window.fetch = function patchedFetch(...args) {
      const url = getUrl(args[0]);
      return originalFetch.apply(this, args).then((response) => {
        try {
          const hit = sources.some(
            (source) => urlMatches(url, source.urlContains) && (!source.urlFilter || source.urlFilter(url)),
          );

          if (hit) {
            response
              .clone()
              .json()
              .then(
                (data) => {
                  handleResponse(url, data);
                },
                (error) => {
                  emitLog('warn', `解析响应失败 ${url}：${String(error)}`);
                },
              );
          }
        } catch (error) {
          emitLog('warn', `检查 fetch 响应失败：${String(error)}`);
        }

        return response;
      });
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
      this._sycmUrl = typeof url === 'string' ? url : '';
      return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function patchedSend(...args) {
      const hit = sources.some(
        (source) =>
          urlMatches(this._sycmUrl || '', source.urlContains) &&
          (!source.urlFilter || source.urlFilter(this._sycmUrl)),
      );

      if (hit) {
        this.addEventListener('load', () => {
          try {
            const data = this.responseText ? JSON.parse(this.responseText) : null;
            handleResponse(this._sycmUrl, data);
          } catch (error) {
            emitLog('warn', `解析 XHR 响应失败：${String(error)}`);
          }
        });
      }

      return originalSend.apply(this, args);
    };

    emitLog('log', `[生意参谋] 已挂载监听：${sources.map((source) => source.urlContains).join(', ')}`);
  } catch (error) {
    emitLog('warn', `初始化 inject.js 失败：${String(error)}`);
  }
}
