import {
  ALIMAMA_DASHBOARD_URL,
  PREFIX,
  SHOP_RECORD_DEFAULTS,
  mergeShopRecordDailyRowPatch,
} from '../defaults.js';
import { createPrefixedRuntimeLogger } from '../../shared/chrome/ext-log.js';
import { hostEquals, isTopWindow, pathIncludes } from '../../shared/chrome/page-guard.js';
import { getLocalDateYmd } from '../../shared/time/date-key.js';

let shopMetricsBootstrapped = false;

if (isTopWindow() && !shopMetricsBootstrapped) {
  var path = location.pathname || '';
  var APPEND_LOG_TYPE = SHOP_RECORD_DEFAULTS.RUNTIME.CONTENT_APPEND_LOG_MESSAGE;
  var extLog = createPrefixedRuntimeLogger(APPEND_LOG_TYPE, PREFIX);

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  if (hostEquals('ad.alimama.com') && (pathIncludes('/portal/v2/dashboard') || pathIncludes('dashboard'))) {
    shopMetricsBootstrapped = true;
    var OVERVIEW = 'https://ad.alimama.com/openapi/param2/1/gateway.unionadv/data.home.overview.json';

    function doFetchAlimama() {
      var token = getCookie('_tb_token_');
      var ymd = getLocalDateYmd(-1);
      var qs = new URLSearchParams({
        t: String(Date.now()),
        startDate: ymd,
        endDate: ymd,
        type: 'cps',
        split: '0',
        period: '1d',
      });
      if (token) qs.set('_tb_token_', token);
      var url = OVERVIEW + '?' + qs.toString();

      fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          accept: '*/*',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'bx-v': '2.5.11',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          referer: ALIMAMA_DASHBOARD_URL,
          'x-requested-with': 'XMLHttpRequest',
        },
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var parsed = null;
            try {
              parsed = JSON.parse(text);
            } catch {
              extLog('淘宝联盟：响应非 JSON 格式，状态码 ' + res.status);
              return;
            }
            var data = parsed;
            if (data && (data.code === 601 || (data.info && data.info.message === 'nologin'))) {
              extLog('淘宝联盟：未登录或会话失效（nologin）');
              return;
            }
            var row = data && data.data && data.data.result && data.data.result[0];
            var raw = row && row.pay_ord_cfee_8;
            if (raw == null) {
              extLog('淘宝联盟：响应缺少字段（pay_ord_cfee_8）');
              return;
            }
            var n = Number(raw);
            var out = isNaN(n) ? String(raw) : n.toFixed(2);
            extLog('淘宝联盟：字段 pay_ord_cfee_8=' + out + '（元）');
            mergeShopRecordDailyRowPatch({ report_at: ymd, taobao_cps_spend_yuan: out });
            extLog('淘宝联盟：已写入本地 淘宝客花费（元） ' + ymd + ' = ' + out);
          });
        })
        .catch(function (err) {
          extLog('淘宝联盟：请求失败 ' + (err && err.message ? err.message : String(err)));
        });
    }

    extLog('淘宝联盟：脚本已注入 ' + path);
    var attemptsAlimama = 0;
    var maxAttemptsAlimama = 35;
    function waitTokenThenFetchAlimama() {
      var token = getCookie('_tb_token_');
      attemptsAlimama += 1;
      if (token || attemptsAlimama >= maxAttemptsAlimama) return doFetchAlimama();
      setTimeout(waitTokenThenFetchAlimama, 400);
    }
    waitTokenThenFetchAlimama();
  }

  if (hostEquals('sycm.taobao.com') && pathIncludes('/adm/v3/my_space')) {
    shopMetricsBootstrapped = true;
    var PREVIEW_API = 'https://sycm.taobao.com/adm/v2/execute/previewById.json';
    var PREVIEW_ID = '2267754';
    var REPORT_TYPE = '1';

    function yesterdayYmd() {
      return getLocalDateYmd(-1);
    }
    function formatYesterdayReport(parsed) {
      var ymd = yesterdayYmd();
      if (!parsed || parsed.code !== 0) {
        var msg = parsed && parsed.message ? String(parsed.message) : '响应异常';
        return { ok: false, text: '生意参谋：previewById 未成功（' + msg + '）' };
      }
      var inner = parsed.data;
      var rows = inner && inner.data;
      var titles = inner && inner.title;
      if (!Array.isArray(rows)) return { ok: false, text: '生意参谋：响应缺少 data.data' };
      var row = null;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r && r[0] === ymd) {
          row = r;
          break;
        }
      }
      if (!row) return { ok: false, text: '生意参谋：未找到昨天「' + ymd + '」的数据行（请确认报表含该日期）' };
      var parts = [];
      for (var j = 0; j < row.length; j++) {
        var label = Array.isArray(titles) && titles[j] != null ? String(titles[j]) : '列' + j;
        parts.push(label + ' ' + row[j]);
      }
      return { ok: true, text: '千牛后台 昨天「' + ymd + '」\n' + parts.join('\n'), row: row, titles: titles };
    }
    function normTitle(s) {
      return String(s || '').replace(/\s/g, '');
    }
    function colIndex(titles, name) {
      if (!Array.isArray(titles)) return -1;
      var want = normTitle(name);
      for (var i = 0; i < titles.length; i++) {
        if (normTitle(titles[i]) === want) return i;
      }
      return -1;
    }
    function cellAt(row, titles, name) {
      var ix = colIndex(titles, name);
      if (ix < 0 || !row || row[ix] == null) return '';
      return String(row[ix]).trim();
    }
    function parseMetricNum(s) {
      if (s == null || s === '') return NaN;
      return parseFloat(String(s).replace(/,/g, ''));
    }
    function maybeMergeSycmShopMetrics(row, titles) {
      if (!row || !Array.isArray(titles)) return;
      var ymd = yesterdayYmd();
      if (row[0] && /^\d{4}-\d{2}-\d{2}$/.test(String(row[0]))) ymd = String(row[0]);

      var pv = cellAt(row, titles, '浏览量');
      var uv = cellAt(row, titles, '访客数');
      var payBuyers = cellAt(row, titles, '支付买家数');
      var payItems = cellAt(row, titles, '支付件数');
      var payAmt = cellAt(row, titles, '支付金额');
      var aov = cellAt(row, titles, '客单价');
      var payCvr = cellAt(row, titles, '支付转化率');
      var oldVis = cellAt(row, titles, '老访客数');
      var stay = cellAt(row, titles, '平均停留时长');
      var depth = cellAt(row, titles, '人均浏览量');
      var bounce = cellAt(row, titles, '跳失率');

      var uvN = parseMetricNum(uv);
      var oldN = parseMetricNum(oldVis);
      var ratioStr = '';
      if (uvN > 0 && !isNaN(oldN) && oldN >= 0) ratioStr = ((oldN / uvN) * 100).toFixed(2) + '%';

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
      mergeShopRecordDailyRowPatch(payload);
      extLog('千牛后台：已写入本地 生意参谋指标 ' + ymd);
    }
    function doFetchSycm() {
      var token = getCookie('_tb_token_');
      if (!token) {
      extLog('生意参谋：未读到 _tb_token_，无法请求预览接口（previewById）');
        return;
      }
      var qs = new URLSearchParams({ id: PREVIEW_ID, reportType: REPORT_TYPE, _: String(Date.now()), token: token });
      var url = PREVIEW_API + '?' + qs.toString();
      var referer = location.href;

      fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          accept: '*/*',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'bx-v': '2.5.36',
          'onetrace-card-id': 'sycm-adm-v3-person-space.sycm-adm-v3-person-report-table.sycm-adm-report-preview',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'sycm-query': 'activeKey=common',
          'sycm-referer': '/adm/v3/my_space',
          referer: referer,
        },
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var parsed = null;
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = null;
            }
            if (parsed == null) {
              extLog('生意参谋：预览接口（previewById）响应非 JSON');
              return;
            }
            var out = formatYesterdayReport(parsed);
            if (out.ok) {
              extLog('生意参谋：预览接口（previewById）请求成功（已匹配昨日数据）');
            } else {
              extLog('生意参谋：预览接口（previewById）返回异常（' + out.text + '）');
            }
            if (out.ok && out.row && out.titles) maybeMergeSycmShopMetrics(out.row, out.titles);
          });
        })
        .catch(function (err) {
          extLog('生意参谋：预览接口（previewById）请求失败：' + (err && err.message ? err.message : String(err)));
        });
    }

    var attemptsSycm = 0;
    var maxAttemptsSycm = 40;
    function waitTokenThenFetchSycm() {
      var token = getCookie('_tb_token_');
      attemptsSycm += 1;
      if (token || attemptsSycm >= maxAttemptsSycm) return doFetchSycm();
      setTimeout(waitTokenThenFetchSycm, 400);
    }
    extLog('生意参谋：已注入 my_space 页面，即将请求预览接口（previewById）');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(waitTokenThenFetchSycm, 300);
      });
    } else {
      setTimeout(waitTokenThenFetchSycm, 300);
    }
  }
}
