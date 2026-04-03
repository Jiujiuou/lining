import { RUNTIME } from '../defaults.js';

const MAIN_GUARD = '__LINING_SYCM_RANK_CAPTURE__';

function rankJsonHit(url) {
  return typeof url === 'string' && url.includes('/mc/mq/mkt/item/live/rank.json');
}

function resolveUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (/^https?:\/\//i.test(url)) return url;

  try {
    return new URL(url, window.location.href).href;
  } catch (_error) {
    return url;
  }
}

function getUrl(input) {
  if (typeof input === 'string') return resolveUrl(input);
  if (input && typeof input.url === 'string') return resolveUrl(input.url);
  if (typeof Request !== 'undefined' && input instanceof Request) return resolveUrl(input.url);
  return '';
}

function postToExtension(requestUrl, data) {
  try {
    window.postMessage(
      {
        source: RUNTIME.MESSAGE_SOURCE,
        requestUrl,
        data,
      },
      '*',
    );
  } catch (_error) {
    // ignore bridge failures
  }
}

function bootstrapFetchBridge() {
  const rawFetch = window.fetch;
  if (!rawFetch) return;

  window.fetch = function patchedFetch(...args) {
    const url = getUrl(args[0]);

    return rawFetch.apply(this, args).then((response) => {
      try {
        if (!rankJsonHit(url)) {
          return response;
        }

        const primaryClone = response.clone();
        const fallbackClone = response.clone();

        primaryClone
          .json()
          .then((data) => {
            postToExtension(url, data);
          })
          .catch(() => {
            fallbackClone
              .text()
              .then((text) => {
                try {
                  postToExtension(url, text ? JSON.parse(text) : null);
                } catch (_error) {
                  postToExtension(url, { _parseError: true, _raw: String(text).slice(0, 500) });
                }
              })
              .catch(() => {
                postToExtension(url, { _parseError: true, _raw: '' });
              });
          });
      } catch (_error) {
        // ignore capture failures
      }

      return response;
    });
  };
}

function bootstrapXhrBridge() {
  const rawOpen = XMLHttpRequest.prototype.open;
  const rawSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    this._sycmRankUrl = typeof url === 'string' ? resolveUrl(url) : '';
    return rawOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function patchedSend(...args) {
    const requestUrl = this._sycmRankUrl || '';

    if (rankJsonHit(requestUrl)) {
      this.addEventListener('load', () => {
        try {
          const data = this.responseText ? JSON.parse(this.responseText) : null;
          postToExtension(requestUrl, data);
        } catch (_error) {
          postToExtension(requestUrl, {
            _parseError: true,
            _raw: this.responseText ? String(this.responseText).slice(0, 500) : '',
          });
        }
      });
    }

    return rawSend.apply(this, args);
  };
}

function bootstrap() {
  try {
    if (window[MAIN_GUARD]) return;
    window[MAIN_GUARD] = true;
  } catch (_error) {
    return;
  }

  bootstrapFetchBridge();
  bootstrapXhrBridge();
}

bootstrap();
