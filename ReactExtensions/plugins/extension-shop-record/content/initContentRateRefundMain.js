export function initContentRateRefundMain() {
  if (globalThis.__LINING_SHOP_RECORD_RATE_REFUND_MAIN__) return;
  globalThis.__LINING_SHOP_RECORD_RATE_REFUND_MAIN__ = true;
/**
 * MAIN world：拦截 rate.taobao.com/refund/refundIndex.htm（JSONP），解析后 postMessage 给桥接脚本。
 * 覆盖 fetch / XHR；并对 script.src 指向该接口的情况用 fetch 代请求，避免漏网。
 */
(function () {
  var MSG = "shop-record-refund-jsonp";
  var memSeen = Object.create(null);

  function isRefundIndexUrl(urlStr) {
    if (!urlStr) return false;
    try {
      var u = new URL(urlStr, location.href);
      if (u.hostname !== "rate.taobao.com") return false;
      return (u.pathname || "").indexOf("/refund/refundIndex.htm") !== -1;
    } catch (e) {
      return String(urlStr).indexOf("refund/refundIndex.htm") !== -1;
    }
  }

  function parseJsonpBody(text) {
    if (!text || typeof text !== "string") return null;
    var m = text.match(/jsonp\d+\s*\(/);
    if (!m) return null;
    var start = text.indexOf("{", m.index);
    if (start < 0) return null;
    var depth = 0;
    for (var i = start; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1));
          } catch (e) {
            return null;
          }
        }
      }
    }
    return null;
  }

  function dedupeKey(urlStr) {
    try {
      var u = new URL(urlStr, location.href);
      u.searchParams.delete("_ksTS");
      u.searchParams.delete("callback");
      return u.href;
    } catch (e) {
      return urlStr;
    }
  }

  function emitOnce(urlStr, data) {
    if (!data || data.success !== true) return;
    var k = dedupeKey(urlStr);
    if (memSeen[k]) return;
    memSeen[k] = 1;

    var dispute = data.disputeRefundRate && data.disputeRefundRate.shopValue;
    var proFinish = data.refundProFinishTime && data.refundProFinishTime.shopValue;
    var finishRate = data.refundFinishRate && data.refundFinishRate.shopValue;

    try {
      window.postMessage(
        {
          source: MSG,
          payload: {
            disputeRefundRate: dispute,
            refundProFinishTime: proFinish,
            refundFinishRate: finishRate
          }
        },
        "*"
      );
    } catch (e) {
      /* ignore */
    }
    console.log("[店铺记录数据] refundIndex", dispute, proFinish, finishRate);
  }

  function handleText(urlStr, text) {
    var obj = parseJsonpBody(text);
    if (obj) emitOnce(urlStr, obj);
  }

  function fetchInputUrl(input) {
    if (!input) return "";
    if (typeof input === "string") return input;
    try {
      if (typeof Request !== "undefined" && input instanceof Request) return input.url;
    } catch (e) {
      /* ignore */
    }
    return input.url || "";
  }

  var origFetch = window.fetch;
  if (typeof origFetch === "function") {
    window.fetch = function (input, init) {
      var u = fetchInputUrl(input);
      return origFetch.apply(this, arguments).then(function (res) {
        if (isRefundIndexUrl(u)) {
          res
            .clone()
            .text()
            .then(function (t) {
              handleText(u, t);
            })
            .catch(function () {});
        }
        return res;
      });
    };
  }

  var XO = XMLHttpRequest.prototype.open;
  var XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__srRefundUrl = typeof url === "string" ? url : "";
    return XO.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    var xhr = this;
    var u = xhr.__srRefundUrl || "";
    if (isRefundIndexUrl(u)) {
      xhr.addEventListener("load", function () {
        if (xhr.responseText != null) handleText(u, xhr.responseText);
      });
    }
    return XS.apply(this, arguments);
  }

  function fetchRefundScript(urlStr) {
    if (memSeen[dedupeKey(urlStr)]) return;
    fetch(urlStr, { method: "GET", credentials: "include" })
      .then(function (r) {
        return r.text();
      })
      .then(function (t) {
        handleText(urlStr, t);
      })
      .catch(function () {});
  }

  var origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (
      this.tagName === "SCRIPT" &&
      String(name).toLowerCase() === "src" &&
      isRefundIndexUrl(value)
    ) {
      fetchRefundScript(value);
      return;
    }
    return origSetAttr.apply(this, arguments);
  };

  var origCreate = document.createElement;
  document.createElement = function (tag) {
    var el = origCreate.apply(document, arguments);
    if (String(tag).toLowerCase() !== "script") return el;
    try {
      var desc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, "src");
      if (!desc || !desc.set) return el;
      var _src = "";
      Object.defineProperty(el, "src", {
        configurable: true,
        enumerable: true,
        get: function () {
          return _src;
        },
        set: function (v) {
          _src = v || "";
          if (isRefundIndexUrl(_src)) {
            fetchRefundScript(_src);
            return;
          }
          desc.set.call(el, v);
        }
      });
    } catch (e) {
      /* ignore */
    }
    return el;
  };
})();

}

