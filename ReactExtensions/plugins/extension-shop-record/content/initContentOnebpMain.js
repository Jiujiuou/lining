export function initContentOnebpMain() {
  if (globalThis.__LINING_SHOP_RECORD_ONEBP_MAIN__) return;
  globalThis.__LINING_SHOP_RECORD_ONEBP_MAIN__ = true;
/**
 * MAIN world：拦截 report/query.json
 * - bizCode=onebpSearch → 万象台1
 * - bizCode=onebpDisplay → 万象台2
 * - bizCode=onebpSite → 万象3（去重键忽略 csrfId）
 * - bizCode=onebpShortVideo → 万象4（同上）
 * 同一规范化请求 URL 本标签页只打印第一次（GET/POST 均看 URL query）。
 */
(function () {
  var MSG = "shop-record-onebp-query";
  var memSeen = Object.create(null);
  var memOrder = [];
  var MAX_MEM = 50;

  function getSharedStorage() {
    try {
      if (window.top && window.top.sessionStorage) return window.top.sessionStorage;
    } catch (e) {
      /* 跨域 top 不可访问 */
    }
    try {
      return window.sessionStorage;
    } catch (e2) {
      return null;
    }
  }

  function canonicalUrlKey(urlStr, optStripKeys) {
    try {
      var u = new URL(urlStr);
      var strip =
        optStripKeys && optStripKeys.length
          ? Object.create(null)
          : null;
      if (strip) {
        for (var si = 0; si < optStripKeys.length; si++) {
          strip[optStripKeys[si]] = 1;
        }
      }
      var keys = [];
      u.searchParams.forEach(function (_v, k) {
        if (strip && strip[k]) return;
        if (keys.indexOf(k) === -1) keys.push(k);
      });
      keys.sort();
      var sp = new URLSearchParams();
      keys.forEach(function (k) {
        u.searchParams.getAll(k).forEach(function (v) {
          sp.append(k, v);
        });
      });
      return u.origin + u.pathname + (sp.toString() ? "?" + sp.toString() : "");
    } catch (e) {
      return urlStr;
    }
  }

  /** 去重用：部分 biz 多次请求 URL 中 csrfId 可能不同，从键中剔除 */
  function dedupeKeyForRequest(requestUrlStr, biz) {
    if (biz === "onebpSite" || biz === "onebpShortVideo") {
      return canonicalUrlKey(requestUrlStr, ["csrfId"]);
    }
    return canonicalUrlKey(requestUrlStr);
  }

  function hashStr(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36) + "_" + (s.length >>> 0).toString(36);
  }

  function isFirstForUrl(canonicalUrlStr) {
    var st = getSharedStorage();
    var id = hashStr(canonicalUrlStr);
    if (st) {
      var sk = "sr1bp_once_" + id;
      if (st.getItem(sk)) return false;
      st.setItem(sk, "1");
      return true;
    }
    if (memSeen[canonicalUrlStr]) return false;
    memSeen[canonicalUrlStr] = 1;
    memOrder.push(canonicalUrlStr);
    if (memOrder.length > MAX_MEM) {
      var old = memOrder.shift();
      delete memSeen[old];
    }
    return true;
  }

  function nextSeqFor(bizKey) {
    var st = getSharedStorage();
    var storageKey = "sr1bp_seq_" + bizKey;
    if (st) {
      var n = parseInt(st.getItem(storageKey) || "0", 10) + 1;
      st.setItem(storageKey, String(n));
      return n;
    }
    if (!nextSeqFor._m) nextSeqFor._m = Object.create(null);
    nextSeqFor._m[bizKey] = (nextSeqFor._m[bizKey] || 0) + 1;
    return nextSeqFor._m[bizKey];
  }

  function requestUrl(input) {
    if (!input) return "";
    try {
      if (typeof input === "string") return new URL(input, location.href).href;
      if (input.url) return new URL(input.url, location.href).href;
    } catch (e) {
      return "";
    }
    return "";
  }

  /** @returns {null|'onebpSearch'|'onebpDisplay'|'onebpSite'|'onebpShortVideo'} */
  function matchBiz(urlStr) {
    try {
      var u = new URL(urlStr);
      if (u.hostname !== "one.alimama.com") return null;
      if (u.pathname !== "/report/query.json") return null;
      var bc = u.searchParams.get("bizCode");
      if (bc === "onebpSearch") return "onebpSearch";
      if (bc === "onebpDisplay") return "onebpDisplay";
      if (bc === "onebpSite") return "onebpSite";
      if (bc === "onebpShortVideo") return "onebpShortVideo";
      return null;
    } catch (e) {
      return null;
    }
  }

  function labelForBiz(biz) {
    if (biz === "onebpDisplay") return "万象台2";
    if (biz === "onebpSite") return "万象3";
    if (biz === "onebpShortVideo") return "万象4";
    return "万象台1";
  }

  function printAndEmit(requestUrlStr, bodyText, biz) {
    var c = dedupeKeyForRequest(requestUrlStr, biz);
    if (!isFirstForUrl(c)) return;
    var s = nextSeqFor(biz);
    var parsed = null;
    try {
      parsed = JSON.parse(bodyText);
    } catch (e) {
      parsed = null;
    }
    var out = parsed != null ? parsed : bodyText;
    var label = labelForBiz(biz);
    console.log("[店铺记录][" + label + "] report/query.json #" + s, out);
    try {
      window.postMessage(
        { source: MSG, seq: s, payload: out, label: label, bizCode: biz },
        "*"
      );
    } catch (e) {
      /* ignore */
    }
  }

  var origFetch = window.fetch;
  if (typeof origFetch === "function") {
    window.fetch = function (input, init) {
      var u = requestUrl(input);
      var biz = matchBiz(u);
      return origFetch.apply(this, arguments).then(function (res) {
        if (biz) {
          res
            .clone()
            .text()
            .then(function (text) {
              printAndEmit(u, text, biz);
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
    this.__onebpUrl = typeof url === "string" ? url : "";
    return XO.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    var xhr = this;
    var u = "";
    try {
      u = xhr.__onebpUrl ? new URL(xhr.__onebpUrl, location.href).href : "";
    } catch (e) {
      u = xhr.__onebpUrl || "";
    }
    var biz = matchBiz(u);
    if (biz) {
      xhr.addEventListener("load", function () {
        if (xhr.responseText != null) printAndEmit(u, xhr.responseText, biz);
      });
    }
    return XS.apply(this, arguments);
  };
})();

}

