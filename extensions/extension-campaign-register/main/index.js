import { MESSAGE_TYPES } from '../messages.js';

const FIND_PAGE_PATTERN = '/campaign/horizontal/findPage.json';
const MAIN_GUARD = '__LINING_AMCR_MAIN__';

function isFindPageUrl(url) {
  return typeof url === 'string' && url.includes(FIND_PAGE_PATTERN);
}

function logResponse(data, requestUrl) {
  try {
    if (typeof window !== 'undefined' && window !== window.top) {
      return;
    }

    window.postMessage(
      {
        type: MESSAGE_TYPES.FIND_PAGE_CAPTURED,
        payload: data,
        requestUrl,
        pageUrl: typeof window.location !== 'undefined' ? window.location.href : '',
      },
      '*',
    );
  } catch (_error) {
    // ignore bridge failures
  }
}

function bootstrapFetchBridge() {
  const rawFetch = window.fetch;
  if (typeof rawFetch !== 'function') {
    return;
  }

  window.fetch = function patchedFetch(input) {
    const requestUrl = typeof input === 'string' ? input : input && input.url;

    if (!isFindPageUrl(requestUrl)) {
      return rawFetch.apply(this, arguments);
    }

    return rawFetch.apply(this, arguments).then((response) => {
      const clone = response.clone();
      clone
        .json()
        .then((data) => {
          logResponse(data, requestUrl);
        })
        .catch(() => {
          clone
            .text()
            .then((text) => {
              logResponse(text, requestUrl);
            })
            .catch(() => {});
        });

      return response;
    });
  };
}

function bootstrapXhrBridge() {
  const rawOpen = XMLHttpRequest.prototype.open;
  const rawSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    this._findPageUrl = isFindPageUrl(url);
    if (this._findPageUrl) {
      this._findPageRequestUrl = url;
    }
    return rawOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function patchedSend(...args) {
    if (this._findPageUrl) {
      this.addEventListener('load', () => {
        if (!this.responseText) return;

        try {
          logResponse(JSON.parse(this.responseText), this._findPageRequestUrl || this.responseURL);
        } catch (_error) {
          logResponse(this.responseText, this._findPageRequestUrl || this.responseURL);
        }
      });
    }

    return rawSend.apply(this, args);
  };
}

try {
  if (!window[MAIN_GUARD]) {
    window[MAIN_GUARD] = true;
    bootstrapFetchBridge();
    bootstrapXhrBridge();
  }
} catch (_error) {
  // ignore bootstrap failures
}
