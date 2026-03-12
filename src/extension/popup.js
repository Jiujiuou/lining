/**
 * popup.js - 弹窗逻辑：节流粒度配置、扩展日志展示与清空
 */
(function () {
  var storage = typeof __SYCM_STORAGE__ !== 'undefined' ? __SYCM_STORAGE__ : null;
  var logger = typeof __SYCM_LOGGER__ !== 'undefined' ? __SYCM_LOGGER__ : null;
  var defaults = typeof __SYCM_DEFAULTS__ !== 'undefined' ? __SYCM_DEFAULTS__ : null;
  var throttleOptions = (defaults && defaults.DEFAULTS && defaults.DEFAULTS.THROTTLE_OPTIONS) ? defaults.DEFAULTS.THROTTLE_OPTIONS : [10, 20, 30, 60];
  var defaultThrottle = (defaults && defaults.DEFAULTS && defaults.DEFAULTS.THROTTLE_MINUTES) ? defaults.DEFAULTS.THROTTLE_MINUTES : 20;

  var throttleEl = document.getElementById('throttle');
  var logsListEl = document.getElementById('logs-list');
  var logsClearBtn = document.getElementById('logs-clear');
  var openPromoRecordBtn = document.getElementById('open-promo-record');
  var findpageListEl = document.getElementById('findpage-list');
  var findpageActionBtn = document.getElementById('findpage-action');

  var lastFindPageResponse = null;
  var lastFindPageRequestUrl = '';
  var lastFindPagePageUrl = '';

  var PROMO_RECORD_URL = 'https://one.alimama.com/index.html#!/manage/display?mx_bizCode=onebpDisplay&bizCode=onebpDisplay&tab=campaign&startTime=2026-03-11&endTime=2026-03-11&offset=0&searchKey=campaignNameLike&searchValue=%E6%B1%A0&pageSize=100';

  function openPromoRecord() {
    chrome.tabs.create({ url: PROMO_RECORD_URL });
  }

  function formatLogTime(isoStr) {
    if (!isoStr) return '';
    try {
      var d = new Date(isoStr);
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    } catch (e) {
      return '';
    }
  }

  function renderLogs(entries) {
    if (!logsListEl) return;
    var el = logsListEl;
    var wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    if (!Array.isArray(entries) || entries.length === 0) {
      el.innerHTML = '<div class="popup-log-card popup-log-card--empty popup-log-entry popup-log-entry--log">暂无日志</div>';
      return;
    }
    el.innerHTML = entries.map(function (entry) {
      var level = entry.level || 'log';
      var time = formatLogTime(entry.t);
      var msg = (entry.msg != null ? String(entry.msg) : '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return '<div class="popup-log-card popup-log-entry popup-log-entry--' + level + '"><span class="popup-log-time">' + time + '</span>' + msg + '</div>';
    }).join('');
    if (wasAtBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }

  function loadLogs() {
    if (!logger) return;
    logger.getLogs(renderLogs);
  }

  function clearLogs() {
    if (!logger || !logsClearBtn) return;
    logger.clearLogs(function () {
      loadLogs();
    });
  }

  function renderFindPageList(response) {
    if (!findpageListEl) return;
    lastFindPageResponse = response;
    var list = (response && response.data && Array.isArray(response.data.list)) ? response.data.list : [];
    if (list.length === 0) {
      findpageListEl.innerHTML = '<div class="popup-findpage-list--empty">暂无捕获数据，请先在推广记录页打开列表</div>';
      findpageListEl.classList.add('popup-findpage-list--empty');
      return;
    }
    findpageListEl.classList.remove('popup-findpage-list--empty');
    findpageListEl.innerHTML = list.map(function (item, index) {
      var name = (item && item.campaignName != null) ? String(item.campaignName) : '';
      var safeName = name.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      return '<div class="popup-findpage-item" role="listitem">' +
        '<input type="checkbox" id="findpage-cb-' + index + '" data-index="' + index + '" aria-label="勾选' + safeName + '">' +
        '<label class="popup-findpage-name" for="findpage-cb-' + index + '">' + safeName + '</label>' +
        '</div>';
    }).join('');
  }

  function loadFindPageResponse() {
    try {
      chrome.storage.local.get(['findPageResponse', 'findPageRequestUrl', 'findPagePageUrl'], function (stored) {
        lastFindPageRequestUrl = stored.findPageRequestUrl || '';
        lastFindPagePageUrl = stored.findPagePageUrl || '';
        renderFindPageList(stored.findPageResponse || null);
      });
    } catch (e) {
      lastFindPageRequestUrl = '';
      lastFindPagePageUrl = '';
      renderFindPageList(null);
    }
  }

  /** 金额保留两位小数，避免浮点 499.99999999999994 写入库；与页面展示一致 */
  function roundMoney(val) {
    if (val == null || typeof val !== 'number' || isNaN(val)) return null;
    return Math.round(val * 100) / 100;
  }

  /** 东八区当天 YYYY-MM-DD，与 App.jsx / 其它上报一致 */
  function getTodayEast8() {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  }

  /** 从 URL 解析 startTime/endTime，支持普通 query 和 hash 内 query（如 index.html#!/manage/display?startTime=...） */
  function getDateRangeFromUrl(url) {
    var out = { startDate: null, endDate: null };
    if (!url || typeof url !== 'string') return out;
    function parseQuery(search) {
      if (!search || search.indexOf('?') < 0) return;
      var params = new URLSearchParams(search.indexOf('?') >= 0 ? search : '?' + search);
      var startTime = params.get('startTime');
      var endTime = params.get('endTime');
      if (startTime && /^\d{4}-\d{2}-\d{2}/.test(startTime)) out.startDate = startTime.slice(0, 10);
      if (endTime && /^\d{4}-\d{2}-\d{2}/.test(endTime)) out.endDate = endTime.slice(0, 10);
    }
    try {
      var q = url.indexOf('?');
      if (q >= 0) parseQuery(url.slice(q));
      var hashIdx = url.indexOf('#');
      if ((!out.startDate || !out.endDate) && hashIdx >= 0) {
        var hashPart = url.slice(hashIdx);
        var qInHash = hashPart.indexOf('?');
        if (qInHash >= 0) parseQuery(hashPart.slice(qInHash));
      }
    } catch (e) {}
    return out;
  }

  /** 登记时使用的日期来源：优先页面 URL（含 hash 内 startTime），否则请求 URL，返回 { startDate, endDate } */
  function getDateRangeForRegister() {
    var fromPage = getDateRangeFromUrl(lastFindPagePageUrl);
    if (fromPage.startDate || fromPage.endDate) return fromPage;
    return getDateRangeFromUrl(lastFindPageRequestUrl);
  }

  /** 单日日期（登记用）：优先页面 URL 的 startTime，否则请求 URL，否则 null */
  function getReportDateFromUrl() {
    return getDateRangeForRegister().startDate;
  }

  /** 从 list 项取 report_date：优先 reportInfoList[0].condition.startTime，否则东八区当天 */
  function getReportDate(item) {
    var report = item && Array.isArray(item.reportInfoList) && item.reportInfoList[0];
    var cond = report && report.condition;
    var startTime = cond && cond.startTime;
    if (typeof startTime === 'string' && startTime.length >= 10) return startTime.slice(0, 10);
    return getTodayEast8();
  }

  /** 推广登记表 upsert：按 (report_date, campaign_name) 覆盖 */
  function upsertCampaignRegister(rows, credentials, opts) {
    var logger = opts && opts.logger;
    if (!credentials || !credentials.url || !credentials.anonKey) {
      if (logger) logger.appendLog('warn', '推广登记：未配置 SUPABASE，跳过');
      return Promise.resolve({ ok: false });
    }
    if (!Array.isArray(rows) || rows.length === 0) return Promise.resolve({ ok: true });
    var url = credentials.url.replace(/\/$/, '') + '/rest/v1/campaign_register?on_conflict=report_date,campaign_name';
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': credentials.anonKey,
        'Authorization': 'Bearer ' + credentials.anonKey,
        'Prefer': 'return=minimal,resolution=merge-duplicates'
      },
      body: JSON.stringify(rows)
    }).then(function (res) {
      if (res.ok) {
        if (logger) logger.appendLog('log', '推广登记：已上报 ' + rows.length + ' 条');
        return { ok: true };
      }
      return res.text().then(function (t) {
        if (logger) logger.appendLog('warn', '推广登记 失败 ' + res.status + ' ' + t);
        return { ok: false };
      });
    }).catch(function (err) {
      if (logger) logger.appendLog('warn', '推广登记 请求异常 ' + String(err));
      return { ok: false };
    });
  }

  function onFindPageAction() {
    if (!findpageListEl || !lastFindPageResponse) return;
    var list = lastFindPageResponse.data && lastFindPageResponse.data.list ? lastFindPageResponse.data.list : [];
    var selected = [];
    list.forEach(function (_, index) {
      var cb = document.getElementById('findpage-cb-' + index);
      if (cb && cb.checked) selected.push(list[index]);
    });
    if (selected.length === 0) {
      if (logger) logger.appendLog('warn', '推广登记：请先勾选要登记的商品');
      loadLogs();
      return;
    }
    /* 点击登记时再获取万相台当前页 URL，从中解析 startTime/endTime */
    chrome.tabs.query({ url: 'https://one.alimama.com/*' }, function (tabs) {
      var pageUrl = (tabs && tabs.length > 0) ? tabs[0].url : '';
      var dateRange = getDateRangeFromUrl(pageUrl);
      if (logger) logger.appendLog('log', '推广登记 startTime=' + (dateRange.startDate || '') + ' endTime=' + (dateRange.endDate || '') + ' pageUrl=' + (pageUrl ? pageUrl.slice(0, 100) + (pageUrl.length > 100 ? '...' : '') : ''));
      if (dateRange.startDate && dateRange.endDate && dateRange.startDate !== dateRange.endDate) {
        if (logger) logger.appendLog('warn', '推广登记：起止日期不一致（' + dateRange.startDate + ' ~ ' + dateRange.endDate + '），请选择同一天后再登记');
        loadLogs();
        return;
      }
      var batchReportDate = dateRange.startDate || getReportDate(selected[0]);
      var rows = [];
      for (var i = 0; i < selected.length; i++) {
        var item = selected[i];
        var report = item && Array.isArray(item.reportInfoList) && item.reportInfoList[0];
        var campaignName = (item && item.campaignName != null) ? String(item.campaignName) : '';
        var charge = report && report.charge != null ? roundMoney(Number(report.charge)) : null;
        var alipayInshopAmt = report && report.alipayInshopAmt != null ? roundMoney(Number(report.alipayInshopAmt)) : null;
        if (!campaignName) continue;
        rows.push({
          report_date: batchReportDate,
          campaign_name: campaignName,
          charge: charge,
          alipay_inshop_amt: alipayInshopAmt
        });
      }
      if (rows.length === 0) {
        if (logger) logger.appendLog('warn', '推广登记：勾选项无有效数据');
        loadLogs();
        return;
      }
      var creds = typeof __SYCM_SUPABASE__ !== 'undefined' ? __SYCM_SUPABASE__ : null;
      upsertCampaignRegister(rows, creds, { logger: logger }).then(function () {
        loadLogs();
      });
    });
  }

  function loadThrottle() {
    if (!storage || !throttleEl) return;
    storage.getThrottleMinutes(function (val) {
      if (val != null && throttleOptions.indexOf(val) !== -1) {
        throttleEl.value = String(val);
      } else {
        throttleEl.value = String(defaultThrottle);
      }
    });
  }

  function saveThrottle() {
    if (!storage || !throttleEl) return;
    var minutes = parseInt(throttleEl.value, 10);
    if (minutes > 0) {
      storage.setThrottleMinutes(minutes, function () { });
    }
  }

  loadThrottle();
  loadLogs();
  loadFindPageResponse();

  if (throttleEl) {
    throttleEl.addEventListener('change', saveThrottle);
  }
  if (logsClearBtn) {
    logsClearBtn.addEventListener('click', clearLogs);
  }
  if (openPromoRecordBtn) {
    openPromoRecordBtn.addEventListener('click', openPromoRecord);
  }
  if (findpageActionBtn) {
    findpageActionBtn.addEventListener('click', onFindPageAction);
  }

  /* 打开 popup 时只刷新日志；推广列表仅在首次加载，避免重绘导致 checkbox 勾选态丢失 */
  window.addEventListener('focus', function () {
    loadLogs();
  });

  /* 定期只刷新日志（不刷新推广列表，否则每 2 秒重绘会清空勾选） */
  var refreshInterval = setInterval(loadLogs, 2000);
  window.addEventListener('blur', function () { clearInterval(refreshInterval); });
})();
