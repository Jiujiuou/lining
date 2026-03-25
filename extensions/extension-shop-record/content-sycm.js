/* global chrome */
/**
 * 生意参谋 my_space：打开后请求 adm/v2/execute/previewById.json，结果写入扩展日志 + 控制台。
 * token 使用 document.cookie 中的 _tb_token_（与页面会话一致）。
 */
(function () {
  if (window !== window.top) return;
  if (location.hostname !== "sycm.taobao.com") return;
  if ((location.pathname || "").indexOf("/adm/v3/my_space") === -1) return;
  if (window.__shopRecordSycmPreviewOnce__) return;
  window.__shopRecordSycmPreviewOnce__ = true;

  var PREFIX = "[店铺记录数据]";
  var APPEND_LOG_TYPE =
    typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" &&
    __SHOP_RECORD_DEFAULTS__.RUNTIME &&
    __SHOP_RECORD_DEFAULTS__.RUNTIME.CONTENT_APPEND_LOG_MESSAGE
      ? __SHOP_RECORD_DEFAULTS__.RUNTIME.CONTENT_APPEND_LOG_MESSAGE
      : "shopRecordAppendLog";

  var PREVIEW_API = "https://sycm.taobao.com/adm/v2/execute/previewById.json";
  var PREVIEW_ID = "2267754";
  var REPORT_TYPE = "1";
  var localDaily =
    typeof __SHOP_RECORD_LOCAL_DAILY__ !== "undefined" ? __SHOP_RECORD_LOCAL_DAILY__ : null;

  function extLog(msg) {
    try {
      chrome.runtime.sendMessage({ type: APPEND_LOG_TYPE, msg: PREFIX + " " + msg });
    } catch (e) {
      /* ignore */
    }
  }

  function getCookie(name) {
    var m = document.cookie.match(
      new RegExp("(?:^|;\\s*)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
    );
    return m ? decodeURIComponent(m[1]) : "";
  }

  /** 本机日历「昨天」YYYY-MM-DD */
  function yesterdayYmd() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1);
    var da = String(d.getDate());
    return y + "-" + (mo.length < 2 ? "0" + mo : mo) + "-" + (da.length < 2 ? "0" + da : da);
  }

  /**
   * 从 previewById 响应中取「统计日期 === 昨日」的那一行，与 title 拼成可读文本。
   * 结构见 response.json：data.data 为行二维数组，data.title 为表头，首列为统计日期。
   */
  function formatYesterdayReport(parsed) {
    var ymd = yesterdayYmd();
    if (!parsed || parsed.code !== 0) {
      var msg = parsed && parsed.message ? String(parsed.message) : "响应异常";
      return { ok: false, text: "生意参谋：previewById 未成功（" + msg + "）" };
    }
    var inner = parsed.data;
    var rows = inner && inner.data;
    var titles = inner && inner.title;
    if (!Array.isArray(rows)) {
      return { ok: false, text: "生意参谋：响应无 data.data" };
    }
    var row = null;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r && r[0] === ymd) {
        row = r;
        break;
      }
    }
    if (!row) {
      return {
        ok: false,
        text: "生意参谋：未找到昨日「" + ymd + "」行（请确认报表含该日）"
      };
    }
    var parts = [];
    for (var j = 0; j < row.length; j++) {
      var label = Array.isArray(titles) && titles[j] != null ? String(titles[j]) : "列" + j;
      parts.push(label + " " + row[j]);
    }
    return {
      ok: true,
      text: "千牛后台 昨日「" + ymd + "」\n" + parts.join("\n"),
      row: row,
      titles: titles
    };
  }

  function normTitle(s) {
    return String(s || "").replace(/\s/g, "");
  }

  function colIndex(titles, name) {
    if (!Array.isArray(titles)) return -1;
    var w = normTitle(name);
    for (var i = 0; i < titles.length; i++) {
      if (normTitle(titles[i]) === w) return i;
    }
    return -1;
  }

  function cellAt(row, titles, name) {
    var ix = colIndex(titles, name);
    if (ix < 0 || !row || row[ix] == null) return "";
    return String(row[ix]).trim();
  }

  function parseMetricNum(s) {
    if (s == null || s === "") return NaN;
    return parseFloat(String(s).replace(/,/g, ""));
  }

  /** 千牛后台昨日行 → 本地合并 流量列（含老访客占比=老访客数/访客数） */
  function maybeMergeSycmShopMetrics(row, titles) {
    if (!row || !Array.isArray(titles)) return;

    var ymd = yesterdayYmd();
    if (row[0] && /^\d{4}-\d{2}-\d{2}$/.test(String(row[0]))) {
      ymd = String(row[0]);
    }

    var pv = cellAt(row, titles, "浏览量");
    var uv = cellAt(row, titles, "访客数");
    var payBuyers = cellAt(row, titles, "支付买家数");
    var payItems = cellAt(row, titles, "支付件数");
    var payAmt = cellAt(row, titles, "支付金额");
    var aov = cellAt(row, titles, "客单价");
    var payCvr = cellAt(row, titles, "支付转化率");
    var oldVis = cellAt(row, titles, "老访客数");
    var stay = cellAt(row, titles, "平均停留时长");
    var depth = cellAt(row, titles, "人均浏览量");
    var bounce = cellAt(row, titles, "跳失率");

    var uvN = parseMetricNum(uv);
    var oldN = parseMetricNum(oldVis);
    var ratioStr = "";
    if (uvN > 0 && !isNaN(oldN) && oldN >= 0) {
      ratioStr = ((oldN / uvN) * 100).toFixed(2) + "%";
    }

    var payload = { report_at: ymd };
    if (pv) payload.sycm_pv = pv;
    if (uv) payload.sycm_uv = uv;
    if (payBuyers) payload.sycm_pay_buyers = payBuyers;
    if (payItems) payload.sycm_pay_items = payItems;
    if (payAmt) payload.sycm_pay_amount = payAmt;
    if (aov) payload.sycm_aov = aov;
    if (payCvr) payload.sycm_pay_cvr = payCvr;
    if (ratioStr) payload.sycm_old_visitor_ratio = ratioStr;
    if (stay) payload.sycm_avg_stay_sec = stay;
    if (depth) payload.sycm_avg_pv_depth = depth;
    if (bounce) payload.sycm_bounce_rate = bounce;

    if (Object.keys(payload).length <= 1) return;

    if (localDaily && typeof localDaily.mergeDailyRowPatch === "function") {
      localDaily.mergeDailyRowPatch(payload);
    }
    extLog("千牛后台：已写入本地 生意参谋指标 " + ymd);
  }

  function doFetch() {
    var token = getCookie("_tb_token_");
    if (!token) {
      extLog("生意参谋：未读到 _tb_token_，无法请求 previewById");
      return;
    }
    var qs = new URLSearchParams({
      id: PREVIEW_ID,
      reportType: REPORT_TYPE,
      _: String(Date.now()),
      token: token
    });
    var url = PREVIEW_API + "?" + qs.toString();
    var referer = location.href;

    fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        accept: "*/*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "bx-v": "2.5.36",
        "onetrace-card-id":
          "sycm-adm-v3-person-space.sycm-adm-v3-person-report-table.sycm-adm-report-preview",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "sycm-query": "activeKey=common",
        "sycm-referer": "/adm/v3/my_space",
        referer: referer
      }
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var parsed = null;
          try {
            parsed = JSON.parse(text);
          } catch (e) {
            parsed = null;
          }
          if (parsed == null) {
            extLog("生意参谋：previewById 响应非 JSON");
            console.log(PREFIX + " previewById 原始", text);
            return;
          }
          var out = formatYesterdayReport(parsed);
          var line = PREFIX + " " + out.text;
          if (line.length > 12000) {
            line = line.slice(0, 12000) + "\n…（已截断）";
          }
          try {
            chrome.runtime.sendMessage({ type: APPEND_LOG_TYPE, msg: line });
          } catch (e2) {
            /* ignore */
          }
          if (out.ok) {
            console.log(PREFIX + " 千牛后台 昨日行", out.row);
            if (out.row && out.titles) {
              maybeMergeSycmShopMetrics(out.row, out.titles);
            }
          } else {
            console.warn(PREFIX, out.text, parsed);
          }
        });
      })
      .catch(function (err) {
        extLog(
          "生意参谋：previewById 请求失败 " + (err && err.message ? err.message : String(err))
        );
        console.error("previewById.json", err);
      });
  }

  var attempts = 0;
  var maxAttempts = 40;
  function waitTokenThenFetch() {
    var token = getCookie("_tb_token_");
    attempts += 1;
    if (token || attempts >= maxAttempts) {
      doFetch();
      return;
    }
    setTimeout(waitTokenThenFetch, 400);
  }

  extLog("生意参谋：已注入 my_space，将请求 previewById");
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(waitTokenThenFetch, 300);
    });
  } else {
    setTimeout(waitTokenThenFetch, 300);
  }
})();
