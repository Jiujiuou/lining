/* global chrome */
/**
 * 淘宝联盟：GET data.home.overview.json（与 curl 同结构），
 * 结果写入扩展「日志」+ 页面 Console。
 * _tb_token_ 若为 HttpOnly 则 document.cookie 读不到，仍发起请求（依赖 credentials 携带 Cookie）。
 */
(function () {
  if (window !== window.top) return;
  if (location.hostname !== "ad.alimama.com") return;
  var path = location.pathname || "";
  if (path.indexOf("/portal/v2/dashboard") === -1 && path.indexOf("dashboard") === -1) return;
  if (window.__shopRecordAlimamaFetchOnce__) return;
  window.__shopRecordAlimamaFetchOnce__ = true;

  var PREFIX = "[店铺记录数据]";
  var OVERVIEW =
    "https://ad.alimama.com/openapi/param2/1/gateway.unionadv/data.home.overview.json";

  function extLog(msg) {
    try {
      chrome.runtime.sendMessage({ type: "shopRecordAppendLog", msg: PREFIX + " " + msg });
    } catch {
      /* ignore */
    }
  }

  function getCookie(name) {
    var m = document.cookie.match(
      new RegExp("(?:^|;\\s*)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
    );
    return m ? decodeURIComponent(m[1]) : "";
  }

  /** 本机日历「昨天」YYYY-MM-DD（startDate / endDate 均用此值） */
  function localYmd() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1);
    var da = String(d.getDate());
    return y + "-" + (mo.length < 2 ? "0" + mo : mo) + "-" + (da.length < 2 ? "0" + da : da);
  }

  function doFetch() {
    var token = getCookie("_tb_token_");
    var ymd = localYmd();
    var qs = new URLSearchParams({
      t: String(Date.now()),
      startDate: ymd,
      endDate: ymd,
      type: "cps",
      split: "0",
      period: "1d"
    });
    if (token) qs.set("_tb_token_", token);
    var url = OVERVIEW + "?" + qs.toString();

    var reqHeaders = {
      accept: "*/*",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      "bx-v": "2.5.11",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      referer: "https://ad.alimama.com/portal/v2/dashboard.htm",
      "x-requested-with": "XMLHttpRequest"
    };

    fetch(url, {
      method: "GET",
      credentials: "include",
      headers: reqHeaders
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var parsed = null;
          try {
            parsed = JSON.parse(text);
          } catch {
            extLog("淘宝联盟：响应非 JSON HTTP " + res.status);
            return;
          }
          var data = parsed;
          if (data && (data.code === 601 || (data.info && data.info.message === "nologin"))) {
            extLog("淘宝联盟：未登录或会话失效（nologin）");
            return;
          }
          var row = data && data.data && data.data.result && data.data.result[0];
          var raw = row && row.pay_ord_cfee_8;
          if (raw == null) {
            extLog("淘宝联盟：响应无 pay_ord_cfee_8");
            return;
          }
          var n = Number(raw);
          var out = isNaN(n) ? String(raw) : n.toFixed(2);
          extLog("淘宝联盟：pay_ord_cfee_8 = " + out + "（元）");
          console.log("pay_ord_cfee_8", out);
        });
      })
      .catch(function (err) {
        extLog("淘宝联盟：请求失败 " + (err && err.message ? err.message : String(err)));
        console.error("data.home.overview.json", err);
      });
  }

  extLog("淘宝联盟：脚本已注入 " + path);

  var attempts = 0;
  var maxAttempts = 35;
  function waitTokenThenFetch() {
    var token = getCookie("_tb_token_");
    attempts += 1;
    if (token || attempts >= maxAttempts) {
      doFetch();
      return;
    }
    setTimeout(waitTokenThenFetch, 400);
  }

  waitTokenThenFetch();
})();
