/**
 * 万相台推广登记：打开记录页、列表展示、登记 RPC、日志（storage 键 amcr_*）
 */
(function () {
  var logger = typeof __AMCR_LOGGER__ !== 'undefined' ? __AMCR_LOGGER__ : null;

  /** 弹窗脚本里 currentWindow 会指向弹窗自身，拿不到背后网页标签；应用 lastFocusedWindow 取刚点图标前的活动标签 */
  var ACTIVE_TAB_QUERY = { active: true, lastFocusedWindow: true };

  var VALID_BIZ = { onebpDisplay: 1, onebpSite: 1, onebpSearch: 1, onebpShortVideo: 1 };

  var logsListEl = document.getElementById('logs-list');
  var logsClearBtn = document.getElementById('logs-clear');
  var openPromoRecordBtn = document.getElementById('open-promo-record');
  var openOnesiteRecordBtn = document.getElementById('open-onesite-record');
  var openSearchRecordBtn = document.getElementById('open-search-record');
  var openContentRecordBtn = document.getElementById('open-content-record');
  var findpageListEl = document.getElementById('findpage-list');
  var findpageActionBtn = document.getElementById('findpage-action');
  var findpageRefreshBtn = document.getElementById('findpage-refresh');

  var lastFindPageResponse = null;
  var lastFindPageBizCode = '';

  function getStateByTabKey() {
    return typeof __AMCR_DEFAULTS__ !== 'undefined' &&
      __AMCR_DEFAULTS__.STORAGE_KEYS &&
      __AMCR_DEFAULTS__.STORAGE_KEYS.findPageStateByTab
      ? __AMCR_DEFAULTS__.STORAGE_KEYS.findPageStateByTab
      : 'amcr_findPageStateByTab';
  }

  function listLenFromFindPage(resp) {
    if (!resp || !resp.data || !Array.isArray(resp.data.list)) return 0;
    return resp.data.list.length;
  }

  /**
   * 仅当前活动 tab 的分桶；无分桶时回落全局（捕获时 tabId 未解析等）。
   */
  function pickFindPageState(stored, tabId) {
    var sk = getStateByTabKey();
    var byTab = stored[sk] || {};
    var bucket = tabId != null ? byTab[String(tabId)] : null;
    if (bucket && bucket.findPageResponse) {
      return {
        pickSource: sk + ':' + String(tabId),
        state: {
          findPageResponse: bucket.findPageResponse,
          findPageRequestUrl: bucket.findPageRequestUrl,
          findPagePageUrl: bucket.findPagePageUrl,
          findPageBizCode: bucket.findPageBizCode,
          findPageSelectedCampaigns: bucket.findPageSelectedCampaigns || {}
        }
      };
    }
    return {
      pickSource: 'amcr_findPageResponse(全局)',
      state: {
        findPageResponse: stored.amcr_findPageResponse,
        findPageRequestUrl: stored.amcr_findPageRequestUrl,
        findPagePageUrl: stored.amcr_findPagePageUrl,
        findPageBizCode: stored.amcr_findPageBizCode,
        findPageSelectedCampaigns: stored.amcr_findPageSelectedCampaigns || {}
      }
    };
  }

  function queryActiveTabId(callback) {
    try {
      chrome.tabs.query(ACTIVE_TAB_QUERY, function (tabs) {
        var id = tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
        callback(id);
      });
    } catch (e) {
      callback(null);
    }
  }

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
    if (wasAtBottom) el.scrollTop = el.scrollHeight;
  }

  function loadLogs() {
    if (!logger) return;
    queryActiveTabId(function (tabId) {
      logger.getLogs(renderLogs, tabId);
    });
  }

  function clearLogs() {
    if (!logger || !logsClearBtn) return;
    queryActiveTabId(function (tabId) {
      logger.clearLogs(function () {
        loadLogs();
      }, tabId);
    });
  }

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
      var sk = getStateByTabKey();
      chrome.storage.local.get(
        [
          sk,
          'amcr_findPageResponse',
          'amcr_findPageRequestUrl',
          'amcr_findPagePageUrl',
          'amcr_findPageBizCode',
          'amcr_findPageSelectedCampaigns'
        ],
        function (stored) {
          queryActiveTabId(function (tabId) {
            var pack = pickFindPageState(stored, tabId);
            var state = pack.state;
            lastFindPageBizCode = state.findPageBizCode || '';
            var selectedSet =
              state.findPageSelectedCampaigns && state.findPageBizCode && state.findPageSelectedCampaigns[state.findPageBizCode]
                ? state.findPageSelectedCampaigns[state.findPageBizCode]
                : [];
            renderFindPageList(state.findPageResponse || null, state.findPageBizCode || '', selectedSet);
          });
        }
      );
    } catch (e) {
      lastFindPageBizCode = '';
      renderFindPageList(null, '');
    }
  }

  function roundMoney(val) {
    if (val == null || typeof val !== 'number' || isNaN(val)) return null;
    return Math.round(val * 100) / 100;
  }

  function getTodayEast8() {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  }

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

  function getSlicedCampaignName(name) {
    if (name == null) return '';
    var s = String(name).trim();
    var idx = s.indexOf('T');
    return idx >= 0 ? s.slice(0, idx).trim() : s;
  }

  function getCampaignNameForRegister(item, report, bizCode) {
    if (bizCode === 'onebpSite') {
      return (item && item.campaignName != null) ? String(item.campaignName) : '';
    }
    if (item && item.campaignName != null && String(item.campaignName).trim() !== '') {
      return String(item.campaignName);
    }
    if (report && report.campaignName != null) return String(report.campaignName);
    return '';
  }

  function getReportDate(item) {
    var report = item && Array.isArray(item.reportInfoList) && item.reportInfoList[0];
    var cond = report && report.condition;
    var startTime = cond && cond.startTime;
    if (typeof startTime === 'string' && startTime.length >= 10) return startTime.slice(0, 10);
    return getTodayEast8();
  }

  function upsertCampaignRegisterByBiz(rows, bizCode, credentials, opts) {
    var log = opts && opts.logger;
    if (!credentials || !credentials.url || !credentials.anonKey) {
      if (log) log.appendLog('warn', '推广登记：未配置 SUPABASE，跳过');
      return Promise.resolve({ ok: false });
    }
    if (!Array.isArray(rows) || rows.length === 0) return Promise.resolve({ ok: true });
    if (!bizCode || !VALID_BIZ[bizCode]) {
      if (log) log.appendLog('warn', '推广登记：未知来源 bizCode=' + bizCode);
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
        if (log) log.appendLog('log', '推广登记：已上报 ' + rows.length + ' 条（' + bizCode + '）');
        return { ok: true };
      }
      return res.text().then(function (t) {
        if (log) log.appendLog('warn', '推广登记 失败 ' + res.status + ' ' + t);
        return { ok: false };
      });
    }).catch(function (err) {
      if (log) log.appendLog('warn', '推广登记 请求异常 ' + String(err));
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
    chrome.tabs.query(ACTIVE_TAB_QUERY, function (tabs) {
      var t = tabs && tabs[0];
      var tabId = t && t.id != null ? t.id : null;
      var pageUrl = t && t.url && t.url.indexOf('one.alimama.com') !== -1 ? t.url : '';
      var dateRange = getDateRangeFromUrl(pageUrl);
      if (logger) logger.appendLog('log', '推广登记 startTime=' + (dateRange.startDate || '') + ' endTime=' + (dateRange.endDate || '') + ' pageUrl=' + (pageUrl ? pageUrl.slice(0, 100) + (pageUrl.length > 100 ? '...' : '') : ''));
      if (dateRange.startDate && dateRange.endDate && dateRange.startDate !== dateRange.endDate) {
        if (logger) logger.appendLog('warn', '推广登记：起止日期不一致，请选择同一天后再登记');
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
      if (!bizCode || !VALID_BIZ[bizCode]) {
        if (logger) logger.appendLog('warn', '推广登记：未识别来源，请先在对应推广记录页打开列表后再登记');
        loadLogs();
        return;
      }
      var selectedDisplayNames = rows.map(function (r) { return r.campaign_name; });
      var sk = getStateByTabKey();
      if (tabId == null) {
        chrome.storage.local.get(['amcr_findPageSelectedCampaigns'], function (s) {
          var all = (s && s.amcr_findPageSelectedCampaigns) ? s.amcr_findPageSelectedCampaigns : {};
          all[bizCode] = selectedDisplayNames;
          chrome.storage.local.set({ amcr_findPageSelectedCampaigns: all }, function () {});
        });
      } else {
        chrome.storage.local.get([sk], function (s) {
          var byTab = (s && s[sk]) ? s[sk] : {};
          var st = byTab[String(tabId)] || {};
          var all = st.findPageSelectedCampaigns || {};
          all[bizCode] = selectedDisplayNames;
          st.findPageSelectedCampaigns = all;
          byTab[String(tabId)] = st;
          var o = {};
          o[sk] = byTab;
          chrome.storage.local.set(o, function () {});
        });
      }
      var creds = typeof __AMCR_SUPABASE__ !== 'undefined' ? __AMCR_SUPABASE__ : null;
      upsertCampaignRegisterByBiz(rows, bizCode, creds, { logger: logger }).then(function () {
        loadLogs();
      });
    });
  }

  loadLogs();
  loadFindPageResponse();

  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName !== 'local') return;
    var sk = getStateByTabKey();
    if (
      changes.amcr_findPageResponse ||
      changes.amcr_findPagePageUrl ||
      changes.amcr_findPageBizCode ||
      changes[sk]
    ) {
      loadFindPageResponse();
    }
  });

  if (logsClearBtn) logsClearBtn.addEventListener('click', clearLogs);
  if (openPromoRecordBtn) openPromoRecordBtn.addEventListener('click', openPromoRecord);
  if (openOnesiteRecordBtn) openOnesiteRecordBtn.addEventListener('click', openOnesiteRecord);
  if (openSearchRecordBtn) openSearchRecordBtn.addEventListener('click', openSearchRecord);
  if (openContentRecordBtn) openContentRecordBtn.addEventListener('click', openContentRecord);
  if (findpageActionBtn) findpageActionBtn.addEventListener('click', onFindPageAction);
  if (findpageRefreshBtn) {
    findpageRefreshBtn.addEventListener('click', function () {
      loadFindPageResponse();
      if (!logger) return;
      var sk = getStateByTabKey();
      chrome.storage.local.get(
        [
          sk,
          'amcr_findPageResponse',
          'amcr_findPageRequestUrl',
          'amcr_findPagePageUrl',
          'amcr_findPageBizCode',
          'amcr_findPageSelectedCampaigns'
        ],
        function (s) {
          queryActiveTabId(function (tabId) {
            var pack = pickFindPageState(s, tabId);
            var n = listLenFromFindPage(pack.state.findPageResponse);
            logger.appendLog(
              'log',
              '[刷新列表] 共 ' + n + ' 条 pick=' + pack.pickSource + ' biz=' + (pack.state.findPageBizCode || '无')
            );
            loadLogs();
          });
        }
      );
    });
  }

  window.addEventListener('focus', function () {
    loadLogs();
    loadFindPageResponse();
  });
  var refreshInterval = setInterval(loadLogs, 2000);
  window.addEventListener('blur', function () { clearInterval(refreshInterval); });
})();
