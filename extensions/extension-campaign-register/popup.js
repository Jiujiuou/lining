/**
 * 万相台推广登记：打开记录页、列表展示、本地登记、日志（storage 键 amcr_*）
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
  var searchKeywordInput = document.getElementById('search-keyword-input');
  var searchKeywordApplyBtn = document.getElementById('search-keyword-apply');
  var findpageListEl = document.getElementById('findpage-list');
  var findpageActionBtn = document.getElementById('findpage-action');
  var findpageRefreshBtn = document.getElementById('findpage-refresh');
  var amcrLocalExportBtn = document.getElementById('amcr-local-export');
  var amcrLocalTableWrap = document.getElementById('amcr-local-table-wrap');
  var amcrLocalClearBtn = document.getElementById('amcr-local-clear');
  var storageUsageEl = document.getElementById('storage-usage');
  var storageUsageBarEl = document.getElementById('storage-usage-bar');
  var storageUsagePercentEl = document.getElementById('storage-usage-percent');
  var storageCacheClearBtn = document.getElementById('storage-cache-clear');

  var STORAGE_LOCAL =
    typeof __AMCR_DEFAULTS__ !== 'undefined' &&
      __AMCR_DEFAULTS__.STORAGE_KEYS &&
      __AMCR_DEFAULTS__.STORAGE_KEYS.localRegisterByDate
      ? __AMCR_DEFAULTS__.STORAGE_KEYS.localRegisterByDate
      : 'amcr_local_register_by_date';
  var STORAGE_SELECTION_BY_QUERY =
    typeof __AMCR_DEFAULTS__ !== 'undefined' &&
      __AMCR_DEFAULTS__.STORAGE_KEYS &&
      __AMCR_DEFAULTS__.STORAGE_KEYS.findPageSelectionByQuery
      ? __AMCR_DEFAULTS__.STORAGE_KEYS.findPageSelectionByQuery
      : 'amcr_findPageSelectionByQuery';
  var STORAGE_LOGS =
    typeof __AMCR_DEFAULTS__ !== 'undefined' &&
      __AMCR_DEFAULTS__.STORAGE_KEYS &&
      __AMCR_DEFAULTS__.STORAGE_KEYS.logs
      ? __AMCR_DEFAULTS__.STORAGE_KEYS.logs
      : 'amcr_logs';
  var STORAGE_LOGS_BY_TAB =
    typeof __AMCR_DEFAULTS__ !== 'undefined' &&
      __AMCR_DEFAULTS__.STORAGE_KEYS &&
      __AMCR_DEFAULTS__.STORAGE_KEYS.logsByTab
      ? __AMCR_DEFAULTS__.STORAGE_KEYS.logsByTab
      : 'amcr_logs_by_tab';
  var STORAGE_FALLBACK_KEYS = [
    'amcr_findPageResponse',
    'amcr_findPageRequestUrl',
    'amcr_findPagePageUrl',
    'amcr_findPageBizCode',
    'amcr_findPageSelectedCampaigns'
  ];
  var STORAGE_SEARCH_KEYWORD = 'amcr_search_keyword';
  var SELECTION_MAX_QUERIES =
    typeof __AMCR_DEFAULTS__ !== 'undefined' && __AMCR_DEFAULTS__.FIND_PAGE_SELECTION_MAX_QUERIES
      ? __AMCR_DEFAULTS__.FIND_PAGE_SELECTION_MAX_QUERIES
      : 100;
  var SELECTION_MAX_QUERIES_PER_PAGE =
    typeof __AMCR_DEFAULTS__ !== 'undefined' && __AMCR_DEFAULTS__.FIND_PAGE_SELECTION_MAX_QUERIES_PER_PAGE
      ? __AMCR_DEFAULTS__.FIND_PAGE_SELECTION_MAX_QUERIES_PER_PAGE
      : 25;
  var SELECTION_MAX_ITEMS_PER_QUERY =
    typeof __AMCR_DEFAULTS__ !== 'undefined' && __AMCR_DEFAULTS__.FIND_PAGE_SELECTION_MAX_ITEMS_PER_QUERY
      ? __AMCR_DEFAULTS__.FIND_PAGE_SELECTION_MAX_ITEMS_PER_QUERY
      : 200;

  var BIZ_TO_KEYS = {
    onebpSearch: { c: 'charge_onebpsearch', a: 'alipay_inshop_amt_onebpsearch' },
    onebpDisplay: { c: 'charge_onebpdisplay', a: 'alipay_inshop_amt_onebpdisplay' },
    onebpSite: { c: 'charge_onebpsite', a: 'alipay_inshop_amt_onebpsite' },
    onebpShortVideo: { c: 'charge_onebpshortvideo', a: 'alipay_inshop_amt_onebpshortvideo' }
  };

  /** 与 src/App.jsx CAMPAIGN_NAME_ORDER 一致 */
  var CAMPAIGN_NAME_ORDER = [
    '池_2万小方块',
    '池_2万小云宝',
    '池_鹅卵石',
    '池_小贝壳',
    '池_小云团',
    '池_大云团'
  ];

  var lastFindPageResponse = null;
  var lastFindPageBizCode = '';
  var lastFindPageRequestUrl = '';
  var lastFindPagePageUrl = '';
  var lastFindPageQueryKey = '';
  var lastLocalRenderSignature = '';
  var lastLocalScrollState = { left: 0, top: 0 };
  var currentSearchKeyword = '池';

  function bizLabel(bizCode) {
    var m = {
      onebpDisplay: '人群推广',
      onebpSite: '货品全站推广',
      onebpSearch: '关键词推广',
      onebpShortVideo: '内容营销'
    };
    return m[bizCode] || '未知来源';
  }

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

  function getSearchKeyword() {
    var s = (currentSearchKeyword == null ? '' : String(currentSearchKeyword)).trim();
    return s || '池';
  }

  function getEncodedSearchKeyword() {
    return encodeURIComponent(getSearchKeyword());
  }

  function applySearchKeyword() {
    if (!searchKeywordInput) return;
    var next = String(searchKeywordInput.value || '').trim();
    currentSearchKeyword = next || '池';
    searchKeywordInput.value = currentSearchKeyword;
    var o = {};
    o[STORAGE_SEARCH_KEYWORD] = currentSearchKeyword;
    chrome.storage.local.set(o, function () {});
    if (logger) {
      logger.appendLog('log', '搜索词已应用：' + currentSearchKeyword);
      loadLogs();
    }
  }

  function loadSearchKeyword() {
    if (!searchKeywordInput || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get([STORAGE_SEARCH_KEYWORD], function (s) {
      var v = s && s[STORAGE_SEARCH_KEYWORD] != null ? String(s[STORAGE_SEARCH_KEYWORD]).trim() : '';
      currentSearchKeyword = v || '池';
      searchKeywordInput.value = currentSearchKeyword;
    });
  }

  function buildPromoRecordUrl() {
    var d = getYesterdayEast8();
    return 'https://one.alimama.com/index.html#!/manage/display?mx_bizCode=onebpDisplay&bizCode=onebpDisplay&tab=campaign&startTime=' + d + '&endTime=' + d + '&offset=0&pageSize=100&searchKey=campaignNameLike&searchValue=' + getEncodedSearchKeyword();
  }
  function buildOnesiteRecordUrl() {
    var d = getYesterdayEast8();
    return 'https://one.alimama.com/index.html#!/manage/onesite?mx_bizCode=onebpSite&bizCode=onebpSite&tab=campaign&startTime=' + d + '&endTime=' + d + '&effectEqual=15&unifyType=last_click_by_effect_time&offset=0&searchKey=campaignNameLike&searchValue=' + getEncodedSearchKeyword() + '&pageSize=100';
  }
  function buildSearchRecordUrl() {
    var d = getYesterdayEast8();
    return 'https://one.alimama.com/index.html#!/manage/search?mx_bizCode=onebpSearch&bizCode=onebpSearch&tab=campaign&startTime=' + d + '&endTime=' + d + '&offset=0&pageSize=100&searchKey=campaignNameLike&searchValue=' + getEncodedSearchKeyword();
  }
  function buildContentRecordUrl() {
    var d = getYesterdayEast8();
    return 'https://one.alimama.com/index.html#!/manage/content?mx_bizCode=onebpShortVideo&bizCode=onebpShortVideo&tab=campaign&startTime=' + d + '&endTime=' + d + '&unifyType=video_kuan&offset=0&pageSize=100&searchKey=campaignNameLike&searchValue=' + getEncodedSearchKeyword();
  }

  function openPromoRecord() {
    if (logger) logger.appendLog('log', '已打开「人群推广」页面（搜索词：' + getSearchKeyword() + '）');
    chrome.tabs.create({ url: buildPromoRecordUrl() });
  }
  function openOnesiteRecord() {
    if (logger) logger.appendLog('log', '已打开「货品全站推广」页面（搜索词：' + getSearchKeyword() + '）');
    chrome.tabs.create({ url: buildOnesiteRecordUrl() });
  }
  function openSearchRecord() {
    if (logger) logger.appendLog('log', '已打开「关键词推广」页面（搜索词：' + getSearchKeyword() + '）');
    chrome.tabs.create({ url: buildSearchRecordUrl() });
  }
  function openContentRecord() {
    if (logger) logger.appendLog('log', '已打开「内容营销」页面（搜索词：' + getSearchKeyword() + '）');
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

  function estimateBytes(value) {
    try {
      return JSON.stringify(value == null ? null : value).length;
    } catch (e) {
      return 0;
    }
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 KB';
    return (bytes / 1024).toFixed(1) + ' KB';
  }

  function getStorageQuotaBytes() {
    try {
      if (chrome && chrome.storage && chrome.storage.local && typeof chrome.storage.local.QUOTA_BYTES === 'number') {
        return chrome.storage.local.QUOTA_BYTES;
      }
    } catch (e) {}
    return 10 * 1024 * 1024;
  }

  function countMapEntries(mapObj) {
    if (!mapObj || typeof mapObj !== 'object') return 0;
    return Object.keys(mapObj).filter(function (k) { return k !== '__meta'; }).length;
  }

  function loadStorageUsage() {
    if (!storageUsageEl || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    var stateByTabKey = getStateByTabKey();
    var keys = [
      STORAGE_LOGS,
      STORAGE_LOGS_BY_TAB,
      STORAGE_LOCAL,
      STORAGE_SELECTION_BY_QUERY,
      stateByTabKey
    ].concat(STORAGE_FALLBACK_KEYS);
    chrome.storage.local.get(keys, function (s) {
      if (chrome.runtime && chrome.runtime.lastError) return;
      var logs = s && s[STORAGE_LOGS] ? s[STORAGE_LOGS] : {};
      var logsByTab = s && s[STORAGE_LOGS_BY_TAB] ? s[STORAGE_LOGS_BY_TAB] : {};
      var localBag = s && s[STORAGE_LOCAL] ? s[STORAGE_LOCAL] : {};
      var byQuery = s && s[STORAGE_SELECTION_BY_QUERY] ? s[STORAGE_SELECTION_BY_QUERY] : {};
      var byTab = s && s[stateByTabKey] ? s[stateByTabKey] : {};
      var summary = {
        logs: estimateBytes(logs),
        logsByTab: estimateBytes(logsByTab),
        local: estimateBytes(localBag),
        byQuery: estimateBytes(byQuery),
        byTab: estimateBytes(byTab),
        fallback: 0
      };
      for (var i = 0; i < STORAGE_FALLBACK_KEYS.length; i++) {
        summary.fallback += estimateBytes(s && s[STORAGE_FALLBACK_KEYS[i]]);
      }
      var total = summary.logs + summary.logsByTab + summary.local + summary.byQuery + summary.byTab + summary.fallback;
      var quota = getStorageQuotaBytes();
      var ratio = quota > 0 ? total / quota : 0;
      var percent = Math.max(0, Math.min(999, ratio * 100));
      var shownPercent = Math.min(100, percent);
      storageUsageEl.innerHTML = [
        '<div class="popup-storage-line"><span class="popup-storage-key">占用</span><span class="popup-storage-sep">：</span><span class="popup-storage-val">' + formatBytes(total) + ' / ' + formatBytes(quota) + '</span></div>',
        '<div class="popup-storage-line"><span class="popup-storage-key">勾选缓存</span><span class="popup-storage-sep">：</span><span class="popup-storage-val">' + countMapEntries(byQuery) + '组</span></div>',
        '<div class="popup-storage-line"><span class="popup-storage-key">tab缓存</span><span class="popup-storage-sep">：</span><span class="popup-storage-val">' + countMapEntries(byTab) + '个</span></div>',
        '<div class="popup-storage-line"><span class="popup-storage-key">日志</span><span class="popup-storage-sep">：</span><span class="popup-storage-val">' + formatBytes(summary.logs + summary.logsByTab) + '</span></div>',
        '<div class="popup-storage-line"><span class="popup-storage-key">列表缓存</span><span class="popup-storage-sep">：</span><span class="popup-storage-val">' + formatBytes(summary.byTab + summary.byQuery + summary.fallback) + '</span></div>',
        '<div class="popup-storage-line"><span class="popup-storage-key">本地登记</span><span class="popup-storage-sep">：</span><span class="popup-storage-val">' + formatBytes(summary.local) + '</span></div>'
      ].join('');
      if (storageUsagePercentEl) {
        storageUsagePercentEl.textContent = shownPercent.toFixed(1) + '%';
      }
      if (storageUsageBarEl) {
        storageUsageBarEl.style.width = shownPercent.toFixed(1) + '%';
        storageUsageBarEl.classList.remove('popup-storage-progress-bar--warn', 'popup-storage-progress-bar--danger');
        if (shownPercent >= 85) {
          storageUsageBarEl.classList.add('popup-storage-progress-bar--danger');
        } else if (shownPercent >= 65) {
          storageUsageBarEl.classList.add('popup-storage-progress-bar--warn');
        }
      }
    });
  }

  function clearUnnecessaryCaches() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    var stateByTabKey = getStateByTabKey();
    var keys = [
      STORAGE_LOGS,
      STORAGE_LOGS_BY_TAB,
      STORAGE_SELECTION_BY_QUERY,
      stateByTabKey
    ].concat(STORAGE_FALLBACK_KEYS);
    chrome.storage.local.remove(keys, function () {
      if (chrome.runtime && chrome.runtime.lastError) return;
      loadFindPageResponse();
      loadLogs();
      loadStorageUsage();
      if (logger) {
        logger.appendLog('log', '缓存清理：已清理列表与日志缓存（保留本地登记）');
        loadLogs();
      }
    });
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** 与 App 推广表一致：金额为 0 显示空 */
  function displayMoneyCell(n) {
    if (n == null || typeof n !== 'number' || isNaN(n)) return '';
    var val = Number(n);
    return val === 0 ? '' : val.toFixed(2);
  }

  /** ROI = 成交/消耗；消耗为 0 或 ROI 为 0 显示空 */
  function displayRoiCell(charge, amt) {
    var c = charge != null ? Number(charge) : 0;
    if (c === 0 || isNaN(c)) return '';
    var a = amt != null ? Number(amt) : 0;
    if (isNaN(a)) return '';
    var roi = a / c;
    return roi === 0 ? '' : roi.toFixed(2);
  }

  function formatReportDateSlash(ymd) {
    if (!ymd) return '';
    return String(ymd).slice(0, 10).replace(/-/g, '/');
  }

  function escAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function emptyWideRow() {
    return {
      charge_onebpsearch: 0,
      alipay_inshop_amt_onebpsearch: 0,
      charge_onebpdisplay: 0,
      alipay_inshop_amt_onebpdisplay: 0,
      charge_onebpsite: 0,
      alipay_inshop_amt_onebpsite: 0,
      charge_onebpshortvideo: 0,
      alipay_inshop_amt_onebpshortvideo: 0
    };
  }

  /**
   * 将当日 byBiz 窄表合并为「商品名称」宽表行（同名多行会加总）
   */
  function pivotLocalDayToWideRows(day) {
    var byName = {};
    if (!day || !day.byBiz || typeof day.byBiz !== 'object') return [];
    Object.keys(day.byBiz).forEach(function (biz) {
      var keys = BIZ_TO_KEYS[biz];
      if (!keys) return;
      var rows = day.byBiz[biz];
      if (!Array.isArray(rows)) return;
      rows.forEach(function (r) {
        var name = r && r.campaign_name != null ? String(r.campaign_name).trim() : '';
        if (!name) return;
        if (!byName[name]) byName[name] = emptyWideRow();
        var row = byName[name];
        var ch = r && r.charge != null ? Number(r.charge) : 0;
        var am = r && r.alipay_inshop_amt != null ? Number(r.alipay_inshop_amt) : 0;
        if (!isNaN(ch)) row[keys.c] = (row[keys.c] || 0) + ch;
        if (!isNaN(am)) row[keys.a] = (row[keys.a] || 0) + am;
      });
    });
    var names = Object.keys(byName);
    var orderMap = {};
    var i;
    for (i = 0; i < CAMPAIGN_NAME_ORDER.length; i++) {
      orderMap[CAMPAIGN_NAME_ORDER[i]] = i;
    }
    names.sort(function (a, b) {
      var ia = orderMap.hasOwnProperty(a) ? orderMap[a] : CAMPAIGN_NAME_ORDER.length;
      var ib = orderMap.hasOwnProperty(b) ? orderMap[b] : CAMPAIGN_NAME_ORDER.length;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b, 'zh-CN');
    });
    return names.map(function (n) {
      return { campaign_name: n, metrics: byName[n] };
    });
  }

  function pickLocalRegisterDay(bag) {
    if (!bag || typeof bag !== 'object') return { ymd: null, day: null };
    var ymdPrefer = getYesterdayEast8();
    if (bag[ymdPrefer] && typeof bag[ymdPrefer] === 'object') {
      return { ymd: ymdPrefer, day: bag[ymdPrefer] };
    }
    var dates = Object.keys(bag).filter(function (k) {
      return /^\d{4}-\d{2}-\d{2}$/.test(k);
    });
    dates.sort();
    if (!dates.length) return { ymd: null, day: null };
    var last = dates[dates.length - 1];
    return { ymd: last, day: bag[last] };
  }

  function buildLocalRenderSignature(ymd, day) {
    if (!ymd || !day || !day.byBiz || typeof day.byBiz !== 'object') return 'EMPTY';
    var byBiz = day.byBiz;
    var keys = Object.keys(byBiz).sort();
    var parts = [String(ymd), String(day.updated_at_local || '')];
    keys.forEach(function (biz) {
      var rows = byBiz[biz];
      if (!Array.isArray(rows)) return;
      parts.push(biz + ':' + String(rows.length));
      rows.forEach(function (r) {
        var n = r && r.campaign_name != null ? String(r.campaign_name).trim() : '';
        var c = r && r.charge != null ? String(r.charge) : '';
        var a = r && r.alipay_inshop_amt != null ? String(r.alipay_inshop_amt) : '';
        parts.push(n + '|' + c + '|' + a);
      });
    });
    return parts.join('||');
  }

  function snapshotLocalScroll() {
    if (!amcrLocalTableWrap) return { left: 0, top: 0 };
    var scroller = amcrLocalTableWrap.querySelector('.popup-local-table-scroll');
    if (!scroller) return { left: 0, top: 0 };
    return { left: scroller.scrollLeft || 0, top: scroller.scrollTop || 0 };
  }

  function restoreLocalScroll(state) {
    if (!amcrLocalTableWrap) return;
    var scroller = amcrLocalTableWrap.querySelector('.popup-local-table-scroll');
    if (!scroller) return;
    scroller.scrollLeft = state.left || 0;
    scroller.scrollTop = state.top || 0;
  }

  function renderLocalRegisterTable(bag) {
    if (!amcrLocalTableWrap) return;
    var prevScroll = snapshotLocalScroll();
    lastLocalScrollState = prevScroll;
    var picked = pickLocalRegisterDay(bag);
    var ymd = picked.ymd;
    var day = picked.day;
    var renderSignature = buildLocalRenderSignature(ymd, day);
    if (renderSignature === lastLocalRenderSignature) {
      return;
    }
    lastLocalRenderSignature = renderSignature;
    if (!ymd || !day || !day.byBiz || typeof day.byBiz !== 'object') {
      amcrLocalTableWrap.innerHTML =
        '<div class="popup-local-table--empty">暂无本地登记数据。</div>';
      lastLocalScrollState = { left: 0, top: 0 };
      return;
    }
    var wideRows = pivotLocalDayToWideRows(day);
    var parts = [];

    if (wideRows.length === 0) {
      amcrLocalTableWrap.innerHTML =
        parts.join('') +
        '<div class="popup-local-table--empty">该日尚无分来源行，请先在各推广页登记。</div>';
      return;
    }
    parts.push('<div class="popup-local-table-scroll">');
    parts.push(
      '<table class="popup-local-register-table" role="table" aria-label="本地推广登记宽表"><thead><tr>' +
      '<th scope="col">时间</th>' +
      '<th scope="col" class="popup-local-th-name">商品名称</th>' +
      '<th scope="col">关键词消耗</th>' +
      '<th scope="col">关键词成交</th>' +
      '<th scope="col" class="popup-local-roi">关键词ROI</th>' +
      '<th scope="col">人群消耗</th>' +
      '<th scope="col">人群成交</th>' +
      '<th scope="col" class="popup-local-roi">人群ROI</th>' +
      '<th scope="col">全站消耗</th>' +
      '<th scope="col">全站成交</th>' +
      '<th scope="col" class="popup-local-roi">全站ROI</th>' +
      '<th scope="col">内容消耗</th>' +
      '<th scope="col">内容成交</th>' +
      '<th scope="col" class="popup-local-roi">内容ROI</th>' +
      '<th scope="col">总消耗</th>' +
      '<th scope="col">总成交</th>' +
      '<th scope="col" class="popup-local-action">操作</th>' +
      '</tr></thead><tbody>'
    );
    function cellMoney(v) {
      return '<td class="popup-local-num">' + escHtml(displayMoneyCell(v)) + '</td>';
    }
    function cellRoi(c, a) {
      return '<td class="popup-local-num popup-local-roi">' + escHtml(displayRoiCell(c, a)) + '</td>';
    }
    function toNum(v) {
      var n = v != null ? Number(v) : 0;
      return isNaN(n) ? 0 : n;
    }
    wideRows.forEach(function (wr) {
      var m = wr.metrics;
      var name = wr.campaign_name;
      var payload = escAttr(JSON.stringify({ ymd: ymd, name: name }));
      var totalCharge =
        toNum(m.charge_onebpsearch) +
        toNum(m.charge_onebpdisplay) +
        toNum(m.charge_onebpsite) +
        toNum(m.charge_onebpshortvideo);
      var totalAmt =
        toNum(m.alipay_inshop_amt_onebpsearch) +
        toNum(m.alipay_inshop_amt_onebpdisplay) +
        toNum(m.alipay_inshop_amt_onebpsite) +
        toNum(m.alipay_inshop_amt_onebpshortvideo);
      parts.push(
        '<tr>' +
        '<td class="popup-local-date">' +
        escHtml(formatReportDateSlash(ymd)) +
        '</td>' +
        '<td class="popup-local-name" title="' +
        escAttr(name) +
        '">' +
        escHtml(name) +
        '</td>' +
        cellMoney(m.charge_onebpsearch) +
        cellMoney(m.alipay_inshop_amt_onebpsearch) +
        cellRoi(m.charge_onebpsearch, m.alipay_inshop_amt_onebpsearch) +
        cellMoney(m.charge_onebpdisplay) +
        cellMoney(m.alipay_inshop_amt_onebpdisplay) +
        cellRoi(m.charge_onebpdisplay, m.alipay_inshop_amt_onebpdisplay) +
        cellMoney(m.charge_onebpsite) +
        cellMoney(m.alipay_inshop_amt_onebpsite) +
        cellRoi(m.charge_onebpsite, m.alipay_inshop_amt_onebpsite) +
        cellMoney(m.charge_onebpshortvideo) +
        cellMoney(m.alipay_inshop_amt_onebpshortvideo) +
        cellRoi(m.charge_onebpshortvideo, m.alipay_inshop_amt_onebpshortvideo) +
        cellMoney(totalCharge) +
        cellMoney(totalAmt) +
        '<td class="popup-local-action">' +
        '<button type="button" class="amcr-local-delete-btn" data-payload="' +
        payload +
        '">删除</button>' +
        '</td>' +
        '</tr>'
      );
    });
    parts.push('</tbody></table></div>');
    amcrLocalTableWrap.innerHTML = parts.join('');
    restoreLocalScroll(prevScroll);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        restoreLocalScroll(lastLocalScrollState);
      });
    }
  }

  function loadLocalRegisterTable() {
    if (!amcrLocalTableWrap || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }
    chrome.storage.local.get([STORAGE_LOCAL], function (result) {
      if (chrome.runtime && chrome.runtime.lastError) return;
      renderLocalRegisterTable(result[STORAGE_LOCAL]);
    });
  }

  function clearLocalRegister() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.remove(STORAGE_LOCAL, function () {
      if (chrome.runtime && chrome.runtime.lastError) return;
      if (logger) {
        logger.appendLog('log', '已清空本地登记数据');
        loadLogs();
      }
      loadLocalRegisterTable();
    });
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function makeExportFilename() {
    var now = new Date();
    var y = now.getFullYear();
    var m = pad2(now.getMonth() + 1);
    var d = pad2(now.getDate());
    var hh = pad2(now.getHours());
    var mm = pad2(now.getMinutes());
    var ss = pad2(now.getSeconds());
    return '推广登记_' + y + m + d + '_' + hh + mm + ss + '.xls';
  }

  function tableToExcelHtml(tableEl) {
    var clone = tableEl.cloneNode(true);
    var rows = clone.querySelectorAll('tr');
    rows.forEach(function (tr) {
      var cells = tr.querySelectorAll('th,td');
      if (cells.length > 0) {
        cells[cells.length - 1].remove();
      }
    });
    return (
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
      'xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="UTF-8"></head><body>' +
      clone.outerHTML +
      '</body></html>'
    );
  }

  function exportLocalRegisterTable() {
    if (!amcrLocalTableWrap) return;
    var table = amcrLocalTableWrap.querySelector('.popup-local-register-table');
    if (!table) {
      if (logger) {
        logger.appendLog('warn', '当前没有可导出的本地登记数据');
        loadLogs();
      }
      return;
    }
    var html = tableToExcelHtml(table);
    var blob = new Blob(['\ufeff', html], {
      type: 'application/vnd.ms-excel;charset=utf-8;'
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = makeExportFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
    if (logger) {
      logger.appendLog('log', '已导出本地登记表');
      loadLogs();
    }
  }

  /** 从本地当日各 biz 中移除指定商品名（仅本地） */
  function deleteLocalCampaignRow(ymd, campaignName) {
    if (!ymd || campaignName == null || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }
    var target = String(campaignName).trim();
    if (!target) return;
    chrome.storage.local.get([STORAGE_LOCAL], function (result) {
      if (chrome.runtime && chrome.runtime.lastError) return;
      var bag = result[STORAGE_LOCAL];
      if (!bag || typeof bag !== 'object') return;
      var day = bag[ymd];
      if (!day || !day.byBiz || typeof day.byBiz !== 'object') return;
      var byBiz = day.byBiz;
      var changed = false;
      Object.keys(byBiz).forEach(function (biz) {
        var rows = byBiz[biz];
        if (!Array.isArray(rows)) return;
        var next = rows.filter(function (r) {
          var n = r && r.campaign_name != null ? String(r.campaign_name).trim() : '';
          return n !== target;
        });
        if (next.length !== rows.length) {
          byBiz[biz] = next;
          changed = true;
        }
      });
      if (!changed) return;
      day.byBiz = byBiz;
      day.updated_at_local = new Date().toISOString();
      bag[ymd] = day;
      var o = {};
      o[STORAGE_LOCAL] = bag;
      chrome.storage.local.set(o, function () {
        if (chrome.runtime && chrome.runtime.lastError) return;
        if (logger) {
          logger.appendLog('log', '已删除本地登记项：' + target + '（' + ymd + '）');
          loadLogs();
        }
        loadLocalRegisterTable();
      });
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
          STORAGE_SELECTION_BY_QUERY,
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
            lastFindPageRequestUrl = state.findPageRequestUrl || '';
            lastFindPagePageUrl = state.findPagePageUrl || '';
            var globalSelectedMap = stored && stored.amcr_findPageSelectedCampaigns
              ? stored.amcr_findPageSelectedCampaigns
              : {};
            lastFindPageBizCode = state.findPageBizCode || '';
            lastFindPageQueryKey = buildFindPageQueryKey(state);
            var selectedSet = [];
            var byQuery = stored && stored[STORAGE_SELECTION_BY_QUERY] ? stored[STORAGE_SELECTION_BY_QUERY] : {};
            if (lastFindPageQueryKey && byQuery[lastFindPageQueryKey] && Array.isArray(byQuery[lastFindPageQueryKey].selected)) {
              selectedSet = byQuery[lastFindPageQueryKey].selected;
            } else if (lastFindPageBizCode) {
              if (
                state.findPageSelectedCampaigns &&
                state.findPageSelectedCampaigns[lastFindPageBizCode]
              ) {
                selectedSet = state.findPageSelectedCampaigns[lastFindPageBizCode];
              } else if (globalSelectedMap[lastFindPageBizCode]) {
                // 兼容：分桶缺失时回退全局勾选态
                selectedSet = globalSelectedMap[lastFindPageBizCode];
              }
            }
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
    } catch (e) { }
    return out;
  }

  function getPageTypeFromUrl(url) {
    if (!url || typeof url !== 'string') return '';
    if (url.indexOf('/manage/display') >= 0) return 'display';
    if (url.indexOf('/manage/onesite') >= 0) return 'onesite';
    if (url.indexOf('/manage/search') >= 0) return 'search';
    if (url.indexOf('/manage/content') >= 0) return 'content';
    return '';
  }

  function parseParamsFromUrl(url) {
    var out = {};
    if (!url || typeof url !== 'string') return out;
    function parseQuery(search) {
      if (!search || search.indexOf('?') < 0) return;
      try {
        var params = new URLSearchParams(search.indexOf('?') >= 0 ? search : '?' + search);
        params.forEach(function (v, k) {
          out[String(k)] = String(v);
        });
      } catch (e) {}
    }
    var q = url.indexOf('?');
    if (q >= 0) parseQuery(url.slice(q));
    var hashIdx = url.indexOf('#');
    if (hashIdx >= 0) {
      var hashPart = url.slice(hashIdx);
      var qInHash = hashPart.indexOf('?');
      if (qInHash >= 0) parseQuery(hashPart.slice(qInHash));
    }
    return out;
  }

  function buildFindPageQueryKey(state) {
    var requestUrl = state && state.findPageRequestUrl ? String(state.findPageRequestUrl) : '';
    var pageUrl = state && state.findPagePageUrl ? String(state.findPagePageUrl) : '';
    var bizCode = state && state.findPageBizCode ? String(state.findPageBizCode) : '';
    var req = parseParamsFromUrl(requestUrl);
    var page = parseParamsFromUrl(pageUrl);
    var pageType = getPageTypeFromUrl(pageUrl);
    var startTime = req.startTime || page.startTime || '';
    var endTime = req.endTime || page.endTime || '';
    var searchKey = req.searchKey || page.searchKey || '';
    var searchValue = req.searchValue || page.searchValue || '';
    var effectEqual = req.effectEqual || page.effectEqual || '';
    var unifyType = req.unifyType || page.unifyType || '';
    return [
      bizCode,
      pageType,
      startTime,
      endTime,
      searchKey,
      searchValue,
      effectEqual,
      unifyType
    ].join('|');
  }

  function pruneSelectionStore(store) {
    var src = store && typeof store === 'object' ? store : {};
    var next = {};
    var keys = Object.keys(src).filter(function (k) {
      return src[k] && typeof src[k] === 'object' && Array.isArray(src[k].selected);
    });
    keys.sort(function (a, b) {
      var ta = src[a].lastTouchedAt || '';
      var tb = src[b].lastTouchedAt || '';
      return String(tb).localeCompare(String(ta));
    });
    var pageCounts = {};
    var kept = 0;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (kept >= SELECTION_MAX_QUERIES) continue;
      var item = src[key];
      var pageType = item.pageType || '';
      pageCounts[pageType] = pageCounts[pageType] || 0;
      if (pageCounts[pageType] >= SELECTION_MAX_QUERIES_PER_PAGE) continue;
      var selected = item.selected.slice(0, SELECTION_MAX_ITEMS_PER_QUERY);
      next[key] = {
        selected: selected,
        bizCode: item.bizCode || '',
        pageType: pageType,
        lastTouchedAt: item.lastTouchedAt || new Date().toISOString()
      };
      pageCounts[pageType] += 1;
      kept += 1;
    }
    return next;
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

  function onFindPageAction() {
    if (!findpageListEl || !lastFindPageResponse) return;
    var list = lastFindPageResponse.data && lastFindPageResponse.data.list ? lastFindPageResponse.data.list : [];
    var selected = [];
    list.forEach(function (_, index) {
      var cb = document.getElementById('findpage-cb-' + index);
      if (cb && cb.checked) selected.push(list[index]);
    });
    if (selected.length === 0) {
      if (logger) logger.appendLog('warn', '请先勾选要登记的商品');
      loadLogs();
      return;
    }
    chrome.tabs.query(ACTIVE_TAB_QUERY, function (tabs) {
      var t = tabs && tabs[0];
      var pageUrl = t && t.url && t.url.indexOf('one.alimama.com') !== -1 ? t.url : '';
      var dateRange = getDateRangeFromUrl(pageUrl);
      if (dateRange.startDate && dateRange.endDate && dateRange.startDate !== dateRange.endDate) {
        if (logger) logger.appendLog('warn', '登记失败：起止日期不一致，请选择同一天');
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
        if (logger) logger.appendLog('warn', '登记失败：勾选项没有有效数据');
        loadLogs();
        return;
      }
      if (!bizCode || !VALID_BIZ[bizCode]) {
        if (logger) logger.appendLog('warn', '登记失败：未识别推广来源，请先刷新列表');
        loadLogs();
        return;
      }
      if (logger) {
        logger.appendLog('log', '开始登记：' + rows.length + ' 个商品（' + bizLabel(bizCode) + '）');
        loadLogs();
      }
      var selectedDisplayNames = rows.map(function (r) { return r.campaign_name; });
      var queryState = {
        findPageRequestUrl: lastFindPageRequestUrl || '',
        findPagePageUrl: pageUrl || lastFindPagePageUrl || '',
        findPageBizCode: bizCode
      };
      var queryKey = buildFindPageQueryKey(queryState);
      lastFindPageQueryKey = queryKey;
      chrome.storage.local.get(['amcr_findPageSelectedCampaigns', STORAGE_SELECTION_BY_QUERY], function (s) {
        var globalAll = (s && s.amcr_findPageSelectedCampaigns)
          ? s.amcr_findPageSelectedCampaigns
          : {};
        globalAll[bizCode] = selectedDisplayNames;
        var byQuery = (s && s[STORAGE_SELECTION_BY_QUERY]) ? s[STORAGE_SELECTION_BY_QUERY] : {};
        var pageType = getPageTypeFromUrl(pageUrl || lastFindPagePageUrl || '');
        if (queryKey) {
          byQuery[queryKey] = {
            selected: selectedDisplayNames.slice(0, SELECTION_MAX_ITEMS_PER_QUERY),
            bizCode: bizCode,
            pageType: pageType,
            lastTouchedAt: new Date().toISOString()
          };
        }
        byQuery = pruneSelectionStore(byQuery);
        var out = {
          amcr_findPageSelectedCampaigns: globalAll
        };
        out[STORAGE_SELECTION_BY_QUERY] = byQuery;
        chrome.storage.local.set(out, function () {});
      });
      var localApi = typeof __AMCR_LOCAL_REGISTER__ !== 'undefined' ? __AMCR_LOCAL_REGISTER__ : null;
      if (localApi && typeof localApi.mergeRegisterBatch === 'function') {
        localApi.mergeRegisterBatch(
          { report_date: batchReportDate, biz_code: bizCode, rows: rows },
          function () {
            if (logger) {
              logger.appendLog('log', '本地登记已保存：' + rows.length + ' 条（' + bizLabel(bizCode) + '）');
              loadLogs();
            }
            loadLocalRegisterTable();
          }
        );
      } else {
        loadLocalRegisterTable();
      }
    });
  }

  loadLogs();
  loadSearchKeyword();
  loadFindPageResponse();
  loadLocalRegisterTable();
  loadStorageUsage();

  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName !== 'local') return;
    var sk = getStateByTabKey();
    if (
      changes.amcr_findPageResponse ||
      changes.amcr_findPagePageUrl ||
      changes.amcr_findPageBizCode ||
      changes[STORAGE_SELECTION_BY_QUERY] ||
      changes[sk]
    ) {
      loadFindPageResponse();
    }
    if (changes[STORAGE_LOCAL]) {
      loadLocalRegisterTable();
    }
    if (
      changes[STORAGE_LOGS] ||
      changes[STORAGE_LOGS_BY_TAB] ||
      changes[STORAGE_SELECTION_BY_QUERY] ||
      changes[sk] ||
      changes.amcr_findPageResponse ||
      changes.amcr_findPageRequestUrl ||
      changes.amcr_findPagePageUrl ||
      changes.amcr_findPageBizCode ||
      changes.amcr_findPageSelectedCampaigns
    ) {
      loadStorageUsage();
    }
  });

  if (logsClearBtn) logsClearBtn.addEventListener('click', clearLogs);
  if (amcrLocalClearBtn) amcrLocalClearBtn.addEventListener('click', clearLocalRegister);
  if (amcrLocalExportBtn) amcrLocalExportBtn.addEventListener('click', exportLocalRegisterTable);
  if (amcrLocalTableWrap) {
    amcrLocalTableWrap.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest('.amcr-local-delete-btn');
      if (!btn || !amcrLocalTableWrap.contains(btn)) return;
      var raw = btn.getAttribute('data-payload');
      if (!raw) return;
      try {
        var p = JSON.parse(raw);
        if (p && p.ymd && p.name != null) {
          deleteLocalCampaignRow(String(p.ymd), p.name);
        }
      } catch (err) { }
    });
  }
  if (openPromoRecordBtn) openPromoRecordBtn.addEventListener('click', openPromoRecord);
  if (openOnesiteRecordBtn) openOnesiteRecordBtn.addEventListener('click', openOnesiteRecord);
  if (openSearchRecordBtn) openSearchRecordBtn.addEventListener('click', openSearchRecord);
  if (openContentRecordBtn) openContentRecordBtn.addEventListener('click', openContentRecord);
  if (searchKeywordApplyBtn) searchKeywordApplyBtn.addEventListener('click', applySearchKeyword);
  if (searchKeywordInput) {
    searchKeywordInput.addEventListener('keydown', function (e) {
      if (e && e.key === 'Enter') {
        applySearchKeyword();
      }
    });
  }
  if (findpageActionBtn) findpageActionBtn.addEventListener('click', onFindPageAction);
  if (storageCacheClearBtn) {
    storageCacheClearBtn.addEventListener('click', clearUnnecessaryCaches);
  }
  if (findpageRefreshBtn) {
    findpageRefreshBtn.addEventListener('click', function () {
      loadFindPageResponse();
      if (!logger) return;
      var sk = getStateByTabKey();
      chrome.storage.local.get(
        [
          sk,
          STORAGE_SELECTION_BY_QUERY,
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
              n > 0
                ? '列表已刷新：' + n + ' 条（' + bizLabel(pack.state.findPageBizCode || '') + '）'
                : '暂无可用列表，请先在推广页面打开列表'
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
    loadLocalRegisterTable();
    loadStorageUsage();
    startAutoRefresh();
  });

  var refreshInterval = null;
  function startAutoRefresh() {
    if (refreshInterval != null) return;
    refreshInterval = setInterval(function () {
      loadLogs();
      loadLocalRegisterTable();
      loadStorageUsage();
    }, 2000);
  }
  function stopAutoRefresh() {
    if (refreshInterval == null) return;
    clearInterval(refreshInterval);
    refreshInterval = null;
  }

  startAutoRefresh();
  window.addEventListener('blur', stopAutoRefresh);
  window.addEventListener('beforeunload', stopAutoRefresh);
})();
