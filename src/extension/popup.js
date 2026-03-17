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
  var openOnesiteRecordBtn = document.getElementById('open-onesite-record');
  var openSearchRecordBtn = document.getElementById('open-search-record');
  var openContentRecordBtn = document.getElementById('open-content-record');
  var findpageListEl = document.getElementById('findpage-list');
  var findpageActionBtn = document.getElementById('findpage-action');
  var findpageRefreshBtn = document.getElementById('findpage-refresh');
  var findpageUserdataBtn = document.getElementById('findpage-userdata');

  var lastFindPageResponse = null;
  var lastFindPageRequestUrl = '';
  var lastFindPagePageUrl = '';
  var lastFindPageBizCode = '';

  /** 东八区昨天 YYYY-MM-DD，用于推广记录页链接的 startTime/endTime */
  function getYesterdayEast8() {
    var today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
    var d = new Date(today + 'T12:00:00+08:00');
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  }

  function buildPromoRecordUrl() {
    var d = getYesterdayEast8();
    return 'https://one.alimama.com/index.html#!/manage/display?mx_bizCode=onebpDisplay&bizCode=onebpDisplay&tab=campaign&startTime=' + d + '&endTime=' + d + '&offset=0&pageSize=100&searchKey=campaignNameLike&searchValue=%E6%B1%A0';
  }
  function buildOnesiteRecordUrl() {
    var d = getYesterdayEast8();
    return 'https://one.alimama.com/index.html#!/manage/onesite?mx_bizCode=onebpSite&bizCode=onebpSite&tab=campaign&startTime=' + d + '&endTime=' + d + '&effectEqual=15&unifyType=last_click_by_effect_time&offset=0&searchKey=campaignNameLike&searchValue=%E6%B1%A0&pageSize=100';
  }
  function buildSearchRecordUrl() {
    var d = getYesterdayEast8();
    return 'https://one.alimama.com/index.html#!/manage/search?mx_bizCode=onebpSearch&bizCode=onebpSearch&tab=campaign&startTime=' + d + '&endTime=' + d + '&offset=0&pageSize=100&searchKey=campaignNameLike&searchValue=%E6%B1%A0';
  }
  function buildContentRecordUrl() {
    var d = getYesterdayEast8();
    return 'https://one.alimama.com/index.html#!/manage/content?mx_bizCode=onebpShortVideo&bizCode=onebpShortVideo&tab=campaign&startTime=' + d + '&endTime=' + d + '&unifyType=video_kuan&offset=0&pageSize=100&searchKey=campaignNameLike&searchValue=%E6%B1%A0';
  }

  function openPromoRecord() {
    chrome.tabs.create({ url: buildPromoRecordUrl() });
  }
  function openOnesiteRecord() {
    chrome.tabs.create({ url: buildOnesiteRecordUrl() });
  }
  function openSearchRecord() {
    chrome.tabs.create({ url: buildSearchRecordUrl() });
  }
  function openContentRecord() {
    chrome.tabs.create({ url: buildContentRecordUrl() });
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
      el.innerHTML = '<div class="popup-logs-empty">暂无日志</div>';
      return;
    }
    el.innerHTML = entries.map(function (entry) {
      var level = entry.level || 'log';
      var time = formatLogTime(entry.t);
      var msg = (entry.msg != null ? String(entry.msg) : '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
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

  /** selectedSet: 上次登记时勾选的 displayName 列表（按 bizCode 存），用于恢复勾选 */
  function renderFindPageList(response, bizCode, selectedSet) {
    if (!findpageListEl) return;
    lastFindPageResponse = response;
    var list = (response && response.data && Array.isArray(response.data.list)) ? response.data.list : [];
    var checkedSet = (selectedSet && Array.isArray(selectedSet)) ? selectedSet : [];
    if (list.length === 0) {
      findpageListEl.innerHTML = '<div class="popup-findpage-list--empty"><span>暂无捕获数据，请先在推广记录页打开列表</span></div>';
      findpageListEl.classList.add('popup-findpage-list--empty');
      return;
    }
    findpageListEl.classList.remove('popup-findpage-list--empty');
    findpageListEl.innerHTML = list.map(function (item, index) {
      var report = item && Array.isArray(item.reportInfoList) && item.reportInfoList[0];
      var name = getCampaignNameForRegister(item, report, bizCode || '');
      var displayName = getSlicedCampaignName(name);
      var isChecked = displayName && checkedSet.indexOf(displayName) !== -1;
      var safeName = name.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      var titleAttr = name ? ' title="' + name.replace(/"/g, '&quot;') + '"' : '';
      var isEffective = item && (item.displayStatus === 'start' || item.onlineStatus === 1);
      var statusClass = isEffective ? ' popup-findpage-item--effective' : ' popup-findpage-item--paused';
      var checkedAttr = isChecked ? ' checked' : '';
      return '<div class="popup-findpage-item' + statusClass + '" role="listitem"' + titleAttr + '>' +
        '<input type="checkbox" id="findpage-cb-' + index + '" data-index="' + index + '" aria-label="勾选' + safeName + '"' + checkedAttr + '>' +
        '<label class="popup-findpage-name" for="findpage-cb-' + index + '">' + safeName + '</label>' +
        '</div>';
    }).join('');
  }

  function loadFindPageResponse() {
    try {
      chrome.storage.local.get(['findPageResponse', 'findPageRequestUrl', 'findPagePageUrl', 'findPageBizCode', 'findPageSelectedCampaigns'], function (stored) {
        var hasResponse = stored && stored.findPageResponse != null;
        var listLen = hasResponse && stored.findPageResponse.data && Array.isArray(stored.findPageResponse.data.list)
          ? stored.findPageResponse.data.list.length
          : 0;
        if (logger) {
          logger.appendLog('log', '[刷新列表] storage: findPageResponse=' + (hasResponse ? '有' : '无') +
            ', list条数=' + listLen +
            ', requestUrl=' + (stored.findPageRequestUrl ? (stored.findPageRequestUrl.slice(0, 80) + '...') : '无') +
            ', pageUrl=' + (stored.findPagePageUrl ? (stored.findPagePageUrl.slice(0, 80) + '...') : '无') +
            ', bizCode=' + (stored.findPageBizCode || '无'));
        }
        lastFindPageRequestUrl = stored.findPageRequestUrl || '';
        lastFindPagePageUrl = stored.findPagePageUrl || '';
        lastFindPageBizCode = stored.findPageBizCode || '';
        var selectedSet = (stored.findPageSelectedCampaigns && stored.findPageBizCode && stored.findPageSelectedCampaigns[stored.findPageBizCode])
          ? stored.findPageSelectedCampaigns[stored.findPageBizCode]
          : [];
        renderFindPageList(stored.findPageResponse || null, stored.findPageBizCode || '', selectedSet);
        if (logger) loadLogs();
      });
    } catch (e) {
      lastFindPageRequestUrl = '';
      lastFindPagePageUrl = '';
      lastFindPageBizCode = '';
      renderFindPageList(null, '');
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

  /** 商品名截取：格式「名称T备注」时只取 T 前部分，无 T 则原样返回 */
  function getSlicedCampaignName(name) {
    if (name == null) return '';
    var s = String(name).trim();
    var idx = s.indexOf('T');
    return idx >= 0 ? s.slice(0, idx).trim() : s;
  }

  /** 登记用商品名：货品全站仅用列表项根级 campaignName；其它页优先 reportInfoList[0].campaignName */
  function getCampaignNameForRegister(item, report, bizCode) {
    if (bizCode === 'onebpSite') {
      return (item && item.campaignName != null) ? String(item.campaignName) : '';
    }
    if (report && report.campaignName != null) return String(report.campaignName);
    return (item && item.campaignName != null) ? String(item.campaignName) : '';
  }

  /** 从 list 项取 report_date：优先 reportInfoList[0].condition.startTime，否则东八区当天 */
  function getReportDate(item) {
    var report = item && Array.isArray(item.reportInfoList) && item.reportInfoList[0];
    var cond = report && report.condition;
    var startTime = cond && cond.startTime;
    if (typeof startTime === 'string' && startTime.length >= 10) return startTime.slice(0, 10);
    return getTodayEast8();
  }

  /** 推广登记表：按 bizCode 只更新对应两列，调用 RPC campaign_register_upsert_by_biz */
  function upsertCampaignRegisterByBiz(rows, bizCode, credentials, opts) {
    var logger = opts && opts.logger;
    if (!credentials || !credentials.url || !credentials.anonKey) {
      if (logger) logger.appendLog('warn', '推广登记：未配置 SUPABASE，跳过');
      return Promise.resolve({ ok: false });
    }
    if (!Array.isArray(rows) || rows.length === 0) return Promise.resolve({ ok: true });
    var validBiz = { onebpDisplay: 1, onebpSite: 1, onebpSearch: 1, onebpShortVideo: 1 };
    if (!bizCode || !validBiz[bizCode]) {
      if (logger) logger.appendLog('warn', '推广登记：未知来源 bizCode=' + bizCode);
      return Promise.resolve({ ok: false });
    }
    var url = credentials.url.replace(/\/$/, '') + '/rest/v1/rpc/campaign_register_upsert_by_biz';
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': credentials.anonKey,
        'Authorization': 'Bearer ' + credentials.anonKey
      },
      body: JSON.stringify({ p_rows: rows, p_biz_code: bizCode })
    }).then(function (res) {
      if (res.ok) {
        if (logger) logger.appendLog('log', '推广登记：已上报 ' + rows.length + ' 条（' + bizCode + '）');
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
      var bizCode = lastFindPageBizCode;
      var rawRows = [];
      for (var i = 0; i < selected.length; i++) {
        var item = selected[i];
        var report = item && Array.isArray(item.reportInfoList) && item.reportInfoList[0];
        var campaignName = getCampaignNameForRegister(item, report, bizCode);
        var displayName = getSlicedCampaignName(campaignName);
        var charge = report && report.charge != null ? Number(report.charge) : 0;
        var alipayInshopAmt = report && report.alipayInshopAmt != null ? Number(report.alipayInshopAmt) : 0;
        if (!displayName) continue;
        rawRows.push({
          report_date: batchReportDate,
          campaign_name: displayName,
          charge: charge,
          alipay_inshop_amt: alipayInshopAmt
        });
      }
      /* 按 (report_date, campaign_name) 合并：截取后重名的多条加和后只上报一条 */
      var keyToRow = {};
      for (var j = 0; j < rawRows.length; j++) {
        var r = rawRows[j];
        var key = r.report_date + '\n' + r.campaign_name;
        if (!keyToRow[key]) {
          keyToRow[key] = {
            report_date: r.report_date,
            campaign_name: r.campaign_name,
            charge: 0,
            alipay_inshop_amt: 0
          };
        }
        keyToRow[key].charge += r.charge;
        keyToRow[key].alipay_inshop_amt += r.alipay_inshop_amt;
      }
      var rows = [];
      for (var k in keyToRow) {
        var merged = keyToRow[k];
        rows.push({
          report_date: merged.report_date,
          campaign_name: merged.campaign_name,
          charge: roundMoney(merged.charge),
          alipay_inshop_amt: roundMoney(merged.alipay_inshop_amt)
        });
      }
      if (rows.length === 0) {
        if (logger) logger.appendLog('warn', '推广登记：勾选项无有效数据');
        loadLogs();
        return;
      }
      var validBiz = { onebpDisplay: 1, onebpSite: 1, onebpSearch: 1, onebpShortVideo: 1 };
      if (!bizCode || !validBiz[bizCode]) {
        if (logger) logger.appendLog('warn', '推广登记：未识别来源，请先在对应推广记录页打开列表后再登记');
        loadLogs();
        return;
      }
      /* 按 bizCode 记住本次勾选的 displayName，下次同接口列表自动恢复勾选 */
      var selectedDisplayNames = rows.map(function (r) { return r.campaign_name; });
      chrome.storage.local.get(['findPageSelectedCampaigns'], function (s) {
        var all = (s && s.findPageSelectedCampaigns) ? s.findPageSelectedCampaigns : {};
        all[bizCode] = selectedDisplayNames;
        chrome.storage.local.set({ findPageSelectedCampaigns: all }, function () {});
      });
      var creds = typeof __SYCM_SUPABASE__ !== 'undefined' ? __SYCM_SUPABASE__ : null;
      upsertCampaignRegisterByBiz(rows, bizCode, creds, { logger: logger }).then(function () {
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
  /* 打开 popup 时从 storage 加载并渲染列表，捕获到新数据时由 onChanged 自动刷新 */
  loadFindPageResponse();

  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName !== 'local') return;
    if (changes.findPageResponse || changes.findPagePageUrl || changes.findPageBizCode) loadFindPageResponse();
  });

  if (throttleEl) {
    throttleEl.addEventListener('change', saveThrottle);
  }
  if (logsClearBtn) {
    logsClearBtn.addEventListener('click', clearLogs);
  }
  if (openPromoRecordBtn) {
    openPromoRecordBtn.addEventListener('click', openPromoRecord);
  }
  if (openOnesiteRecordBtn) {
    openOnesiteRecordBtn.addEventListener('click', openOnesiteRecord);
  }
  if (openSearchRecordBtn) {
    openSearchRecordBtn.addEventListener('click', openSearchRecord);
  }
  if (openContentRecordBtn) {
    openContentRecordBtn.addEventListener('click', openContentRecord);
  }
  if (findpageActionBtn) {
    findpageActionBtn.addEventListener('click', onFindPageAction);
  }
  if (findpageRefreshBtn) {
    findpageRefreshBtn.addEventListener('click', loadFindPageResponse);
  }

  var SOLD_PAGE_URL = 'https://qn.taobao.com/home.htm/trade-platform/tp/sold';
  var QN_OR_TRADE_REG = /^https:\/\/(qn\.taobao\.com|trade\.taobao\.com)\//;

  function onGetUserDataClick() {
    var unionSearchEl = document.getElementById('userdata-union-search');
    var buyerNickEl = document.getElementById('userdata-buyer-nick');
    var orderStatusEl = document.getElementById('userdata-order-status');
    var unionSearch = (unionSearchEl && unionSearchEl.value) ? String(unionSearchEl.value).trim() : '';
    var buyerNick = (buyerNickEl && buyerNickEl.value) ? String(buyerNickEl.value).trim() : '';
    var orderStatus = (orderStatusEl && orderStatusEl.value) ? String(orderStatusEl.value) : 'SUCCESS';

    function trySend(tabId, retryAfterInject) {
      chrome.tabs.sendMessage(tabId, { type: 'GET_USER_DATA', unionSearch: unionSearch, buyerNick: buyerNick, orderStatus: orderStatus }, function (reply) {
        if (chrome.runtime.lastError) {
          if (!retryAfterInject) {
            chrome.scripting.executeScript(
              { target: { tabId: tabId }, files: ['sold-userdata.js'] },
              function () {
                if (chrome.runtime.lastError) {
                  if (logger) logger.appendLog('warn', '获取用户数据：无法与当前页面通信，请刷新已卖出订单页面后重试');
                  loadLogs();
                  return;
                }
                setTimeout(function () { trySend(tabId, true); }, 800);
              }
            );
            return;
          }
          if (logger) logger.appendLog('warn', '获取用户数据：无法与当前页面通信，请刷新已卖出订单页面后重试');
          loadLogs();
          return;
        }
        if (logger) logger.appendLog('log', '获取用户数据：已开始，请保持该页面打开直至导出完成');
        loadLogs();
      });
    }

    /* 优先使用当前窗口正在看的标签页（用户点扩展时所在页面），避免发到别的千牛子页 */
    chrome.tabs.query({ active: true, currentWindow: true }, function (activeTabs) {
      var activeTab = (activeTabs && activeTabs.length > 0) ? activeTabs[0] : null;
      if (activeTab && activeTab.id && activeTab.url && QN_OR_TRADE_REG.test(activeTab.url)) {
        trySend(activeTab.id);
        return;
      }
      /* 当前页不是千牛/交易页时，再按 URL 找已有标签或新建 */
      chrome.tabs.query({ url: ['https://qn.taobao.com/*', 'https://trade.taobao.com/*'] }, function (tabs) {
        var tab = (tabs && tabs.length > 0) ? tabs[0] : null;
        if (tab && tab.id) {
          chrome.tabs.update(tab.id, { active: true });
          trySend(tab.id);
        } else {
          chrome.tabs.create({ url: SOLD_PAGE_URL }, function (newTab) {
            if (newTab && newTab.id && logger) logger.appendLog('log', '已打开已卖出订单页，开始获取用户数据…');
            loadLogs();
            var listener = function (id, change) {
              if (id === newTab.id && change.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                setTimeout(function () { trySend(newTab.id); }, 500);
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
          });
        }
      });
    });
  }

  if (findpageUserdataBtn) {
    findpageUserdataBtn.addEventListener('click', onGetUserDataClick);
  }

  chrome.runtime.onMessage.addListener(function (msg) {
    if (!msg) return;
    if (msg.type === 'SOLD_USER_DATA_PROGRESS') {
      if (msg.message && logger) {
        logger.appendLog('log', msg.message);
        loadLogs();
      }
      return;
    }
    if (msg.type === 'SOLD_USER_DATA_PAGE') {
      if (logger) {
        var pageNum = msg.pageNum;
        var rows = Array.isArray(msg.rows) ? msg.rows : [];
        var lines = ['第 ' + pageNum + ' 页 共 ' + rows.length + ' 条：'];
        for (var i = 0; i < rows.length; i++) {
          var r = rows[i];
          var orderId = (r.orderId != null) ? String(r.orderId) : '';
          var nick = (r.nick != null) ? String(r.nick) : '';
          lines.push('  订单ID: ' + orderId + ', 昵称: ' + nick);
        }
        logger.appendLog('log', lines.join('\n'));
        loadLogs();
      }
      return;
    }
    if (msg.type === 'SOLD_USER_DATA_DONE') {
      if (logger) {
        if (msg.error) {
          logger.appendLog('warn', '获取用户数据 结束（含错误）: ' + msg.error);
        } else {
          var rows = msg.rows || [];
          logger.appendLog('log', '获取用户数据 全部完成，共 ' + rows.length + ' 条，已导出 CSV');
        }
      }
      loadLogs();
    }
  });

  /* 打开 popup 时只刷新日志；推广列表仅在首次加载，避免重绘导致 checkbox 勾选态丢失 */
  window.addEventListener('focus', function () {
    loadLogs();
  });

  /* 定期只刷新日志（不刷新推广列表，否则每 2 秒重绘会清空勾选） */
  var refreshInterval = setInterval(loadLogs, 2000);
  window.addEventListener('blur', function () { clearInterval(refreshInterval); });
})();
