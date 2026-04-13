import { parseManualTotalInput, roundMoney, getDateRangeFromUrl, buildFindPageQueryKey, getSlicedCampaignName, getCampaignNameForRegister, getReportDate, pruneSelectionStore } from '@/popup/utils/legacyDataUtils.js';
import { estimateBytes, formatBytes, countMapEntries, displayMoneyCell, displayRoiCell, makeExportFilename } from '@/popup/utils/legacyViewUtils.js';
import { escHtml, escAttr, formatReportDateSlash, toNum, manualToInputValue } from '@/popup/utils/legacyTableUtils.js';
export function initLegacyPopup() {
  if (globalThis.__LINING_AMCR_POPUP__) {
    return;
  }
  globalThis.__LINING_AMCR_POPUP__ = true;
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
  var popupNavDateTrigger = document.getElementById('popup-nav-date-trigger');
  var popupNavCalPopover = document.getElementById('popup-nav-cal-popover');
  var popupNavCalAnchor = document.getElementById('popup-nav-cal-anchor');
  var navCalView = { y: 2025, m0: 0 };
  var navCalOpen = false;
  var navCalOutsideHandler = null;
  var navCalDatesWithData = new Set();
  var currentNavDateYmd = '';

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
  var STORAGE_NAV_DATE =
    typeof __AMCR_DEFAULTS__ !== 'undefined' &&
      __AMCR_DEFAULTS__.STORAGE_KEYS &&
      __AMCR_DEFAULTS__.STORAGE_KEYS.popupNavDate
      ? __AMCR_DEFAULTS__.STORAGE_KEYS.popupNavDate
      : 'amcr_popup_nav_date';
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

  function isQuotaError(err) {
    if (!err) return false;
    return /quota|QUOTA_BYTES|Resource::kQuotaBytes/i.test(String(err.message || err));
  }

  function safeSet(payload, onDone, onQuota) {
    chrome.storage.local.set(payload, function () {
      if (chrome.runtime && chrome.runtime.lastError && isQuotaError(chrome.runtime.lastError) && typeof onQuota === 'function') {
        onQuota(function () {
          chrome.storage.local.set(payload, function () {
            if (typeof onDone === 'function') onDone();
          });
        });
        return;
      }
      if (typeof onDone === 'function') onDone();
    });
  }

  function bizLabel(bizCode) {
    var m = {
      onebpDisplay: '人群',
      onebpSite: '货品全站',
      onebpSearch: '关键词',
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

  function getNavDateYmd() {
    var d = currentNavDateYmd;
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return getYesterdayEast8();
  }

  function syncNavCalendarTriggerLabel() {
    if (!popupNavDateTrigger) return;
    var ymd = getNavDateYmd();
    popupNavDateTrigger.textContent = ymd.replace(/-/g, '/');
  }

  /** 与 src/lib/dashboardCalendarUtils.js 一致（单日） */
  function ymdPartsNav(ymd) {
    var parts = String(ymd).split('-');
    return { y: Number(parts[0]), m0: Number(parts[1]) - 1, d: Number(parts[2]) };
  }

  function weekdayFirstOfMonthNav(y, m0) {
    return new Date(y, m0, 1).getDay();
  }

  function daysInMonthNav(y, m0) {
    return new Date(y, m0 + 1, 0).getDate();
  }

  function buildNavCalendarCells(calView, dataSet, selection) {
    var calYear = calView.y;
    var calMonth0 = calView.m0;
    var firstWd = weekdayFirstOfMonthNav(calYear, calMonth0);
    var dim = daysInMonthNav(calYear, calMonth0);
    var pad = (firstWd + 6) % 7;
    var cells = [];
    var i;
    for (i = 0; i < pad; i++) cells.push({ type: 'pad' });
    for (var d = 1; d <= dim; d++) {
      var mm = String(calMonth0 + 1);
      if (mm.length < 2) mm = '0' + mm;
      var dd = String(d);
      if (dd.length < 2) dd = '0' + dd;
      var ymdStr = calYear + '-' + mm + '-' + dd;
      var isSelected = selection.value === ymdStr;
      var hasData = dataSet && typeof dataSet.has === 'function' && dataSet.has(ymdStr);
      cells.push({
        type: 'day',
        ymd: ymdStr,
        hasData: hasData,
        isSelected: isSelected,
        disabled: false
      });
    }
    return cells;
  }

  function goNavMonth(delta) {
    var m0 = navCalView.m0 + delta;
    var y = navCalView.y;
    while (m0 < 0) {
      m0 += 12;
      y -= 1;
    }
    while (m0 > 11) {
      m0 -= 12;
      y += 1;
    }
    navCalView = { y: y, m0: m0 };
    if (popupNavCalPopover && !popupNavCalPopover.hidden) {
      popupNavCalPopover.innerHTML = renderNavCalendarPopoverInnerHTML();
    }
  }

  function renderNavCalendarPopoverInnerHTML() {
    var cells = buildNavCalendarCells(navCalView, navCalDatesWithData, {
      mode: 'single',
      value: getNavDateYmd()
    });
    var parts = [];
    parts.push('<div class="dashboard-cal-head">');
    parts.push(
      '<button type="button" class="dashboard-cal-nav" data-nav-month="-1" aria-label="上一月">‹</button>'
    );
    parts.push(
      '<span class="dashboard-cal-title">' +
      navCalView.y +
      ' 年 ' +
      (navCalView.m0 + 1) +
      ' 月</span>'
    );
    parts.push(
      '<button type="button" class="dashboard-cal-nav" data-nav-month="1" aria-label="下一月">›</button>'
    );
    parts.push('</div>');
    parts.push('<div class="dashboard-cal-weekdays">');
    var wds = ['一', '二', '三', '四', '五', '六', '日'];
    wds.forEach(function (w) {
      parts.push('<span class="dashboard-cal-wd">' + w + '</span>');
    });
    parts.push('</div>');
    parts.push('<div class="dashboard-cal-grid">');
    cells.forEach(function (cell, idx) {
      if (cell.type === 'pad') {
        parts.push('<span class="dashboard-cal-cell dashboard-cal-cell--empty"></span>');
        return;
      }
      var c = cell;
      var cls = 'dashboard-cal-cell';
      if (c.isSelected) cls += ' dashboard-cal-cell--selected';
      if (c.hasData) cls += ' dashboard-cal-cell--has-data';
      if (c.disabled) cls += ' dashboard-cal-cell--disabled';
      var dayNum = Number(String(c.ymd).slice(8));
      parts.push(
        '<button type="button" class="' +
        cls +
        '" data-nav-cal-day="' +
        escAttr(c.ymd) +
        '"' +
        (c.disabled ? ' disabled' : '') +
        '>' +
        '<span class="dashboard-cal-cell-num">' +
        dayNum +
        '</span>' +
        (c.hasData ? '<span class="dashboard-cal-cell-dot" aria-hidden="true"></span>' : '') +
        '</button>'
      );
    });
    parts.push('</div>');

    return parts.join('');
  }

  function refreshNavCalDatesWithData(callback) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      navCalDatesWithData = new Set();
      if (callback) callback();
      return;
    }
    chrome.storage.local.get([STORAGE_LOCAL], function (r) {
      if (chrome.runtime && chrome.runtime.lastError) {
        navCalDatesWithData = new Set();
        if (callback) callback();
        return;
      }
      var s = new Set();
      var bag = r && r[STORAGE_LOCAL];
      if (bag && typeof bag === 'object') {
        Object.keys(bag).forEach(function (k) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(k)) s.add(k);
        });
      }
      navCalDatesWithData = s;
      if (callback) callback();
    });
  }

  function loadNavDate() {
    if (!popupNavDateTrigger || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      if (popupNavDateTrigger && !currentNavDateYmd) {
        currentNavDateYmd = getYesterdayEast8();
        syncNavCalendarTriggerLabel();
      }
      return;
    }
    chrome.storage.local.get([STORAGE_NAV_DATE], function (s) {
      if (chrome.runtime && chrome.runtime.lastError) return;
      var v = s && s[STORAGE_NAV_DATE] != null ? String(s[STORAGE_NAV_DATE]).trim() : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) v = getYesterdayEast8();
      currentNavDateYmd = v;
      syncNavCalendarTriggerLabel();
    });
  }

  function persistNavDate(ymd) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
    currentNavDateYmd = ymd;
    syncNavCalendarTriggerLabel();
    var o = {};
    o[STORAGE_NAV_DATE] = ymd;
    safeSet(o, function () { }, function (retry) {
      chrome.storage.local.remove([STORAGE_NAV_DATE], function () {
        retry();
      });
    });
  }

  function closeNavCalendar() {
    if (!popupNavCalPopover || !popupNavDateTrigger) return;
    navCalOpen = false;
    popupNavCalPopover.hidden = true;
    popupNavCalPopover.setAttribute('hidden', '');
    popupNavDateTrigger.setAttribute('aria-expanded', 'false');
    if (navCalOutsideHandler) {
      document.removeEventListener('mousedown', navCalOutsideHandler, true);
      navCalOutsideHandler = null;
    }
  }

  function openNavCalendar() {
    if (!popupNavCalPopover || !popupNavDateTrigger) return;
    var ymd = getNavDateYmd();
    var pv = ymdPartsNav(ymd);
    navCalView = { y: pv.y, m0: pv.m0 };
    refreshNavCalDatesWithData(function () {
      popupNavCalPopover.innerHTML = renderNavCalendarPopoverInnerHTML();
      navCalOpen = true;
      popupNavCalPopover.hidden = false;
      popupNavCalPopover.removeAttribute('hidden');
      popupNavDateTrigger.setAttribute('aria-expanded', 'true');
      if (navCalOutsideHandler) {
        document.removeEventListener('mousedown', navCalOutsideHandler, true);
      }
      navCalOutsideHandler = function (e) {
        if (!popupNavCalAnchor || !popupNavCalPopover) return;
        if (popupNavCalAnchor.contains(e.target)) return;
        closeNavCalendar();
      };
      document.addEventListener('mousedown', navCalOutsideHandler, true);
    });
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
    var navYmd = getNavDateYmd();
    currentNavDateYmd = navYmd;
    syncNavCalendarTriggerLabel();
    var o = {};
    o[STORAGE_SEARCH_KEYWORD] = currentSearchKeyword;
    o[STORAGE_NAV_DATE] = navYmd;
    safeSet(o, function () { }, function (retry) {
      chrome.storage.local.remove([STORAGE_SEARCH_KEYWORD, STORAGE_NAV_DATE], function () {
        retry();
      });
    });
    if (logger) {
      logger.appendLog(
        'log',
        '已应用：搜索词「' + currentSearchKeyword + '」；打开推广页日期 ' + navYmd.replace(/-/g, '/')
      );
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
    var d = getNavDateYmd();
    return 'https://one.alimama.com/index.html#!/manage/display?mx_bizCode=onebpDisplay&bizCode=onebpDisplay&tab=campaign&startTime=' + d + '&endTime=' + d + '&offset=0&pageSize=100&searchKey=campaignNameLike&searchValue=' + getEncodedSearchKeyword();
  }
  function buildOnesiteRecordUrl() {
    var d = getNavDateYmd();
    return 'https://one.alimama.com/index.html#!/manage/onesite?mx_bizCode=onebpSite&bizCode=onebpSite&tab=campaign&startTime=' + d + '&endTime=' + d + '&effectEqual=15&unifyType=last_click_by_effect_time&offset=0&searchKey=campaignNameLike&searchValue=' + getEncodedSearchKeyword() + '&pageSize=100';
  }
  function buildSearchRecordUrl() {
    var d = getNavDateYmd();
    return 'https://one.alimama.com/index.html#!/manage/search?mx_bizCode=onebpSearch&bizCode=onebpSearch&tab=campaign&startTime=' + d + '&endTime=' + d + '&offset=0&pageSize=100&searchKey=campaignNameLike&searchValue=' + getEncodedSearchKeyword();
  }
  function buildContentRecordUrl() {
    var d = getNavDateYmd();
    return 'https://one.alimama.com/index.html#!/manage/content?mx_bizCode=onebpShortVideo&bizCode=onebpShortVideo&tab=campaign&startTime=' + d + '&endTime=' + d + '&unifyType=video_kuan&offset=0&pageSize=100&searchKey=campaignNameLike&searchValue=' + getEncodedSearchKeyword();
  }

  function openPromoRecord() {
    if (logger) logger.appendLog('log', '已打开「人群」页面（搜索词：' + getSearchKeyword() + '）');
    chrome.tabs.create({ url: buildPromoRecordUrl() });
  }
  function openOnesiteRecord() {
    if (logger) logger.appendLog('log', '已打开「货品全站」页面（搜索词：' + getSearchKeyword() + '）');
    chrome.tabs.create({ url: buildOnesiteRecordUrl() });
  }
  function openSearchRecord() {
    if (logger) logger.appendLog('log', '已打开「关键词」页面（搜索词：' + getSearchKeyword() + '）');
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

  function getStorageQuotaBytes() {
    try {
      if (chrome && chrome.storage && chrome.storage.local && typeof chrome.storage.local.QUOTA_BYTES === 'number') {
        return chrome.storage.local.QUOTA_BYTES;
      }
    } catch (e) { }
    return 10 * 1024 * 1024;
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

  function renderFindPageList(response, bizCode, selectedSet) {
    if (!findpageListEl) return;
    lastFindPageResponse = response;
    var list =
      response && response.data && Array.isArray(response.data.list)
        ? response.data.list
        : [];
    var checkedSet = Array.isArray(selectedSet) ? selectedSet : [];
    if (list.length === 0) {
      findpageListEl.innerHTML =
        '<div class="popup-findpage-list--empty"><span>暂无捕获数据，请先在推广页面打开列表</span></div>';
      findpageListEl.classList.add('popup-findpage-list--empty');
      return;
    }
    findpageListEl.classList.remove('popup-findpage-list--empty');
    findpageListEl.innerHTML = list
      .map(function (item, index) {
        var report = item && Array.isArray(item.reportInfoList) && item.reportInfoList[0];
        var name = getCampaignNameForRegister(item, report, bizCode || '');
        var displayName = getSlicedCampaignName(name);
        var isChecked = displayName && checkedSet.indexOf(displayName) !== -1;
        var safeName = escHtml(name || '');
        var titleAttr = name ? ' title="' + escAttr(name) + '"' : '';
        var isEffective =
          item && (item.displayStatus === 'start' || item.onlineStatus === 1);
        var statusClass = isEffective
          ? ' popup-findpage-item--effective'
          : ' popup-findpage-item--paused';
        var checkedAttr = isChecked ? ' checked' : '';
        return (
          '<div class="popup-findpage-item' +
          statusClass +
          '" role="listitem"' +
          titleAttr +
          '>' +
          '<input type="checkbox" id="findpage-cb-' +
          index +
          '" data-index="' +
          index +
          '" aria-label="勾选 ' +
          safeName +
          '"' +
          checkedAttr +
          '>' +
          '<label class="popup-findpage-name" for="findpage-cb-' +
          index +
          '">' +
          safeName +
          '</label>' +
          '</div>'
        );
      })
      .join('');
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
          'amcr_findPageSelectedCampaigns',
        ],
        function (stored) {
          queryActiveTabId(function (tabId) {
            var pack = pickFindPageState(stored || {}, tabId);
            var state = pack.state || {};
            lastFindPageRequestUrl = state.findPageRequestUrl || '';
            lastFindPagePageUrl = state.findPagePageUrl || '';
            lastFindPageBizCode = state.findPageBizCode || '';
            lastFindPageQueryKey = buildFindPageQueryKey(state);
            var selectedSet = [];
            var byQuery = stored && stored[STORAGE_SELECTION_BY_QUERY] ? stored[STORAGE_SELECTION_BY_QUERY] : {};
            if (
              lastFindPageQueryKey &&
              byQuery[lastFindPageQueryKey] &&
              Array.isArray(byQuery[lastFindPageQueryKey].selected)
            ) {
              selectedSet = byQuery[lastFindPageQueryKey].selected;
            }
            renderFindPageList(state.findPageResponse || null, lastFindPageBizCode, selectedSet);
          });
        }
      );
    } catch (e) {
      lastFindPageBizCode = '';
      renderFindPageList(null, '');
    }
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
      alipay_inshop_amt_onebpshortvideo: 0,
    };
  }

  function displayRatioChargeManual(totalCharge, manualAmt) {
    if (manualAmt == null || manualAmt === '') return '';
    var m =
      typeof manualAmt === 'number' && !Number.isNaN(manualAmt)
        ? manualAmt
        : parseManualTotalInput(String(manualAmt));
    if (Number.isNaN(m) || m <= 0) return '';
    var c = totalCharge != null ? Number(totalCharge) : NaN;
    if (Number.isNaN(c) || c === 0) return '';
    var r = c / m;
    if (Number.isNaN(r)) return '';
    var pct = r * 100;
    return pct.toFixed(2).replace(/\.?0+$/, '') + '%';
  }

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
        if (!Number.isNaN(ch)) row[keys.c] = (row[keys.c] || 0) + ch;
        if (!Number.isNaN(am)) row[keys.a] = (row[keys.a] || 0) + am;
      });
    });
    var names = Object.keys(byName);
    var orderMap = {};
    for (var i = 0; i < CAMPAIGN_NAME_ORDER.length; i += 1) {
      orderMap[CAMPAIGN_NAME_ORDER[i]] = i;
    }
    names.sort(function (a, b) {
      var ia = Object.prototype.hasOwnProperty.call(orderMap, a) ? orderMap[a] : CAMPAIGN_NAME_ORDER.length;
      var ib = Object.prototype.hasOwnProperty.call(orderMap, b) ? orderMap[b] : CAMPAIGN_NAME_ORDER.length;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b, 'zh-CN');
    });
    return names.map(function (n) {
      return { campaign_name: n, metrics: byName[n] };
    });
  }

  function pickLocalRegisterDay(bag, ymd) {
    if (!bag || typeof bag !== 'object') return { ymd: null, day: null };
    if (ymd && bag[ymd] && typeof bag[ymd] === 'object') return { ymd: ymd, day: bag[ymd] };
    var keys = Object.keys(bag).filter(function (k) {
      return /^\d{4}-\d{2}-\d{2}$/.test(k);
    });
    if (!keys.length) return { ymd: null, day: null };
    keys.sort();
    var last = keys[keys.length - 1];
    return { ymd: last, day: bag[last] };
  }

  function renderLocalRegisterTable(bag) {
    if (!amcrLocalTableWrap) return;
    var picked = pickLocalRegisterDay(bag, getNavDateYmd());
    var ymd = picked.ymd;
    var day = picked.day;
    if (!ymd || !day || !day.byBiz || typeof day.byBiz !== 'object') {
      amcrLocalTableWrap.innerHTML =
        '<div class="popup-local-table--empty">暂无本地登记数据</div>';
      return;
    }
    var wideRows = pivotLocalDayToWideRows(day);
    var manualMap =
      day.manual_total_amt_by_name && typeof day.manual_total_amt_by_name === 'object'
        ? day.manual_total_amt_by_name
        : {};
    if (!wideRows.length) {
      amcrLocalTableWrap.innerHTML =
        '<div class="popup-local-table--empty">暂无本地登记数据</div>';
      return;
    }
    var parts = [];
    parts.push('<div class="popup-local-table-scroll"><table class="popup-local-register-table"><thead><tr>');
    parts.push(
      '<th>日期</th>' +
      '<th>推广名称</th>' +
      '<th>关键词消耗</th><th>关键词成交</th><th>关键词ROI</th>' +
      '<th>人群消耗</th><th>人群成交</th><th>人群ROI</th>' +
      '<th>全站消耗</th><th>全站成交</th><th>全站ROI</th>' +
      '<th>内容消耗</th><th>内容成交</th><th>内容ROI</th>' +
      '<th>总消耗</th><th>总推广成交</th>' +
      '<th>总成交金额</th><th>比例</th><th>操作</th>'
    );
    parts.push('</tr></thead><tbody>');
    function cellMoney(v) {
      return '<td class="popup-local-num">' + escHtml(displayMoneyCell(v)) + '</td>';
    }
    function cellRoi(c, a) {
      return '<td class="popup-local-num popup-local-roi">' + escHtml(displayRoiCell(c, a)) + '</td>';
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
      var manualStored = manualMap[name];
      var ratioText = displayRatioChargeManual(totalCharge, manualStored);
      parts.push('<tr>');
      parts.push('<td>' + escHtml(formatReportDateSlash(ymd)) + '</td>');
      parts.push('<td class="popup-local-name">' + escHtml(name) + '</td>');
      parts.push(cellMoney(m.charge_onebpsearch));
      parts.push(cellMoney(m.alipay_inshop_amt_onebpsearch));
      parts.push(cellRoi(m.charge_onebpsearch, m.alipay_inshop_amt_onebpsearch));
      parts.push(cellMoney(m.charge_onebpdisplay));
      parts.push(cellMoney(m.alipay_inshop_amt_onebpdisplay));
      parts.push(cellRoi(m.charge_onebpdisplay, m.alipay_inshop_amt_onebpdisplay));
      parts.push(cellMoney(m.charge_onebpsite));
      parts.push(cellMoney(m.alipay_inshop_amt_onebpsite));
      parts.push(cellRoi(m.charge_onebpsite, m.alipay_inshop_amt_onebpsite));
      parts.push(cellMoney(m.charge_onebpshortvideo));
      parts.push(cellMoney(m.alipay_inshop_amt_onebpshortvideo));
      parts.push(cellRoi(m.charge_onebpshortvideo, m.alipay_inshop_amt_onebpshortvideo));
      parts.push(cellMoney(totalCharge));
      parts.push(cellMoney(totalAmt));
      parts.push(
        '<td class="popup-local-num popup-local-cell-edit popup-local-cell-total-amt">' +
        '<input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" size="10" class="popup-local-total-amt-input" data-ymd="' +
        escAttr(ymd) +
        '" data-name="' +
        escAttr(name) +
        '" value="' +
        escAttr(manualToInputValue(manualStored)) +
        '" />' +
        '</td>'
      );
      parts.push('<td class="popup-local-num popup-local-ratio">' + escHtml(ratioText) + '</td>');
      parts.push('<td class="popup-local-action"><button type="button" class="amcr-local-delete-btn" data-payload="' + payload + '">删除</button></td>');
      parts.push('</tr>');
    });
    parts.push('</tbody></table></div>');
    amcrLocalTableWrap.innerHTML = parts.join('');
  }

  function loadLocalRegisterTable() {
    if (!amcrLocalTableWrap || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }
    chrome.storage.local.get([STORAGE_LOCAL], function (result) {
      if (chrome.runtime && chrome.runtime.lastError) return;
      renderLocalRegisterTable(result ? result[STORAGE_LOCAL] : null);
    });
  }

  function saveManualTotalAmt(ymd, campaignName, raw) {
    if (!ymd || campaignName == null || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }
    var target = String(campaignName).trim();
    if (!target) return;
    var trimmed = raw == null ? '' : String(raw).trim();
    chrome.storage.local.get([STORAGE_LOCAL], function (result) {
      if (chrome.runtime && chrome.runtime.lastError) return;
      var bag = result && result[STORAGE_LOCAL] ? result[STORAGE_LOCAL] : {};
      if (!bag || typeof bag !== 'object') return;
      var day = bag[ymd];
      if (!day || !day.byBiz || typeof day.byBiz !== 'object') return;
      if (!day.manual_total_amt_by_name || typeof day.manual_total_amt_by_name !== 'object') {
        day.manual_total_amt_by_name = {};
      }
      var manual = day.manual_total_amt_by_name;
      if (trimmed === '') {
        delete manual[target];
      } else {
        var n = parseManualTotalInput(trimmed);
        if (Number.isNaN(n) || n < 0) {
          delete manual[target];
        } else {
          manual[target] = roundMoney(n);
        }
      }
      if (Object.keys(manual).length === 0) {
        delete day.manual_total_amt_by_name;
      }
      day.updated_at_local = new Date().toISOString();
      bag[ymd] = day;
      var out = {};
      out[STORAGE_LOCAL] = bag;
      safeSet(out, function () {
        loadLocalRegisterTable();
      }, function (retry) {
        chrome.storage.local.remove([STORAGE_LOCAL], function () {
          retry();
        });
      });
    });
  }

  function toFiniteNumber(value) {
    if (value == null || value === '') return null;
    var num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function pickReportMetricsFromMap(reportInfoMap) {
    if (!reportInfoMap || typeof reportInfoMap !== 'object') return null;
    var keys = Object.keys(reportInfoMap);
    for (var i = 0; i < keys.length; i += 1) {
      var row = reportInfoMap[keys[i]];
      if (!row || typeof row !== 'object') continue;
      var charge = toFiniteNumber(row.charge);
      var alipayInshopAmt = toFiniteNumber(row.alipayInshopAmt);
      if (charge != null || alipayInshopAmt != null) {
        return {
          charge: charge != null ? charge : 0,
          alipayInshopAmt: alipayInshopAmt != null ? alipayInshopAmt : 0,
          report: row,
          source: 'reportInfoMap',
        };
      }
    }
    return null;
  }

  function getCampaignMetrics(item) {
    var report = item && Array.isArray(item.reportInfoList) ? item.reportInfoList[0] : null;
    var reportCharge = toFiniteNumber(report && report.charge);
    var reportAmt = toFiniteNumber(report && report.alipayInshopAmt);
    if (reportCharge != null || reportAmt != null) {
      return {
        report: report,
        charge: reportCharge != null ? reportCharge : 0,
        alipayInshopAmt: reportAmt != null ? reportAmt : 0,
        source: 'reportInfoList[0]',
      };
    }

    var mapMetrics = pickReportMetricsFromMap(item && item.reportInfoMap);
    if (mapMetrics) return mapMetrics;

    var itemCharge = toFiniteNumber(item && item.charge);
    var itemAmt = toFiniteNumber(item && item.alipayInshopAmt);
    return {
      report: report,
      charge: itemCharge != null ? itemCharge : 0,
      alipayInshopAmt: itemAmt != null ? itemAmt : 0,
      source: itemCharge != null || itemAmt != null ? 'campaign_item' : 'default_zero',
    };
  }

  function deleteLocalCampaignRow(ymd, campaignName) {
    if (!ymd || campaignName == null || typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }
    var target = String(campaignName).trim();
    if (!target) return;
    chrome.storage.local.get([STORAGE_LOCAL], function (result) {
      if (chrome.runtime && chrome.runtime.lastError) return;
      var bag = result && result[STORAGE_LOCAL] ? result[STORAGE_LOCAL] : {};
      if (!bag || typeof bag !== 'object' || !bag[ymd] || !bag[ymd].byBiz) return;
      var byBiz = bag[ymd].byBiz;
      var changed = false;
      Object.keys(byBiz).forEach(function (biz) {
        var list = Array.isArray(byBiz[biz]) ? byBiz[biz] : [];
        var next = list.filter(function (r) {
          return String((r && r.campaign_name) || '').trim() !== target;
        });
        if (next.length !== list.length) {
          byBiz[biz] = next;
          changed = true;
        }
      });
      if (!changed) return;
      if (bag[ymd].manual_total_amt_by_name && typeof bag[ymd].manual_total_amt_by_name === 'object') {
        delete bag[ymd].manual_total_amt_by_name[target];
        if (Object.keys(bag[ymd].manual_total_amt_by_name).length === 0) {
          delete bag[ymd].manual_total_amt_by_name;
        }
      }
      var out = {};
      out[STORAGE_LOCAL] = bag;
      safeSet(out, function () {
        loadLocalRegisterTable();
        if (logger) {
          logger.appendLog('log', '已删除本地登记项：' + target);
          loadLogs();
        }
      });
    });
  }

  function clearLocalRegister() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.remove(STORAGE_LOCAL, function () {
      if (chrome.runtime && chrome.runtime.lastError) return;
      loadLocalRegisterTable();
      if (logger) {
        logger.appendLog('log', '已清空本地登记数据');
        loadLogs();
      }
    });
  }

  function tableToExcelHtml(tableEl) {
    var clone = tableEl.cloneNode(true);
    clone.querySelectorAll('.popup-local-total-amt-input').forEach(function (inp) {
      var td = inp.parentElement;
      if (!td) return;
      var v = inp.value != null ? String(inp.value).trim() : '';
      td.textContent = v;
    });
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
      type: 'application/vnd.ms-excel;charset=utf-8;',
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
      for (var i = 0; i < selected.length; i += 1) {
        var item = selected[i];
        var metrics = getCampaignMetrics(item);
        var report = metrics.report;
        var campaignName = getCampaignNameForRegister(item, report, bizCode);
        var displayName = getSlicedCampaignName(campaignName);
        var charge = metrics.charge;
        var alipayInshopAmt = metrics.alipayInshopAmt;
        if (!displayName) continue;
        rawRows.push({
          report_date: batchReportDate,
          campaign_name: displayName,
          charge: charge,
          alipay_inshop_amt: alipayInshopAmt,
        });
      }
      if (!bizCode || !VALID_BIZ[bizCode]) {
        if (logger) logger.appendLog('warn', '登记失败：未识别推广来源，请先刷新列表');
        loadLogs();
        return;
      }
      var keyToRow = {};
      for (var j = 0; j < rawRows.length; j += 1) {
        var r = rawRows[j];
        var key = r.report_date + '\n' + r.campaign_name;
        if (!keyToRow[key]) {
          keyToRow[key] = {
            report_date: r.report_date,
            campaign_name: r.campaign_name,
            charge: 0,
            alipay_inshop_amt: 0,
          };
        }
        keyToRow[key].charge += r.charge;
        keyToRow[key].alipay_inshop_amt += r.alipay_inshop_amt;
      }
      var rows = [];
      Object.keys(keyToRow).forEach(function (k) {
        var merged = keyToRow[k];
        rows.push({
          report_date: merged.report_date,
          campaign_name: merged.campaign_name,
          charge: roundMoney(merged.charge),
          alipay_inshop_amt: roundMoney(merged.alipay_inshop_amt),
        });
      });
      if (!rows.length) {
        if (logger) logger.appendLog('warn', '登记失败：勾选项没有有效数据');
        loadLogs();
        return;
      }
      var selectedDisplayNames = rows.map(function (r) {
        return r.campaign_name;
      });
      var queryState = {
        findPageRequestUrl: lastFindPageRequestUrl || '',
        findPagePageUrl: pageUrl || lastFindPagePageUrl || '',
        findPageBizCode: bizCode,
      };
      var queryKey = buildFindPageQueryKey(queryState);
      lastFindPageQueryKey = queryKey;
      chrome.storage.local.get(['amcr_findPageSelectedCampaigns', STORAGE_SELECTION_BY_QUERY], function (s) {
        var globalAll = s && s.amcr_findPageSelectedCampaigns ? s.amcr_findPageSelectedCampaigns : {};
        globalAll[bizCode] = selectedDisplayNames;
        var byQuery = s && s[STORAGE_SELECTION_BY_QUERY] ? s[STORAGE_SELECTION_BY_QUERY] : {};
        if (queryKey) {
          byQuery[queryKey] = {
            selected: selectedDisplayNames.slice(0, SELECTION_MAX_ITEMS_PER_QUERY),
            bizCode: bizCode,
            pageType: '',
            lastTouchedAt: new Date().toISOString(),
          };
        }
        var out = { amcr_findPageSelectedCampaigns: globalAll };
        out[STORAGE_SELECTION_BY_QUERY] = pruneSelectionStore(byQuery);
        safeSet(out);
      });
      var localApi = typeof __AMCR_LOCAL_REGISTER__ !== 'undefined' ? __AMCR_LOCAL_REGISTER__ : null;
      if (localApi && typeof localApi.mergeRegisterBatch === 'function') {
        localApi.mergeRegisterBatch(
          { report_date: batchReportDate, biz_code: bizCode, rows: rows },
          function () {
            loadLocalRegisterTable();
            if (logger) {
              logger.appendLog('log', '本地登记已保存：' + rows.length + ' 条（' + bizLabel(bizCode) + '）');
              loadLogs();
            }
          }
        );
      } else {
        loadLocalRegisterTable();
      }
    });
  }

  function handleLocalTableClick(e) {
    if (!amcrLocalTableWrap) return;
    var t = e && e.target;
    if (!t || !t.closest) return;
    var editTd = t.closest('td.popup-local-cell-edit');
    if (editTd && amcrLocalTableWrap.contains(editTd) && !t.closest('.popup-local-total-amt-input')) {
      var focusInp = editTd.querySelector('.popup-local-total-amt-input');
      if (focusInp) focusInp.focus();
      return;
    }
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
  }

  function handleLocalTableBlur(e) {
    if (!amcrLocalTableWrap) return;
    var inp = e && e.target;
    if (!inp || !inp.classList || !inp.classList.contains('popup-local-total-amt-input')) return;
    if (!amcrLocalTableWrap.contains(inp)) return;
    var ymd = inp.getAttribute('data-ymd');
    var name = inp.getAttribute('data-name');
    if (!ymd || name == null) return;
    saveManualTotalAmt(ymd, name, inp.value);
  }

  function handleNavDateTriggerClick(e) {
    if (!popupNavDateTrigger) return;
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (popupNavCalPopover && !popupNavCalPopover.hidden) {
      closeNavCalendar();
    } else {
      openNavCalendar();
    }
  }

  function handleNavCalendarClick(e) {
    if (!popupNavCalPopover || !e || !e.target || !e.target.closest) return;
    var navBtn = e.target.closest('[data-nav-month]');
    if (navBtn) {
      var delta = parseInt(navBtn.getAttribute('data-nav-month'), 10);
      if (!isNaN(delta)) goNavMonth(delta);
      if (typeof e.preventDefault === 'function') e.preventDefault();
      return;
    }
    var dayBtn = e.target.closest('[data-nav-cal-day]');
    if (dayBtn && !dayBtn.disabled) {
      var ymd = dayBtn.getAttribute('data-nav-cal-day');
      if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
        persistNavDate(ymd);
        closeNavCalendar();
      }
    }
  }

  function handleSearchKeywordKeydown(e) {
    if (e && e.key === 'Enter') {
      applySearchKeyword();
    }
  }

  function handleFindPageRefreshClick() {
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
  }

  function handleStorageChanged(changes, areaName) {
    if (areaName !== 'local' || !changes) return;
    if (
      changes[STORAGE_LOCAL] ||
      changes[STORAGE_LOGS] ||
      changes[STORAGE_LOGS_BY_TAB] ||
      changes[STORAGE_SELECTION_BY_QUERY] ||
      changes.amcr_findPageResponse ||
      changes.amcr_findPageRequestUrl ||
      changes.amcr_findPagePageUrl ||
      changes.amcr_findPageBizCode ||
      changes.amcr_findPageSelectedCampaigns
    ) {
      refreshAll();
    }
  }

  function refreshOnFocus() {
    loadLogs();
    loadNavDate();
    loadFindPageResponse();
    loadLocalRegisterTable();
    loadStorageUsage();
    startAutoRefresh();
  }

  function refreshAll() {
    loadLogs();
    loadNavDate();
    loadFindPageResponse();
    loadLocalRegisterTable();
    loadStorageUsage();
  }

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

  globalThis.__AMCR_POPUP_RUNTIME__ = {
    refreshAll: refreshAll,
    refreshLogs: loadLogs,
    handleStorageChanged: handleStorageChanged,
    clearLogs: clearLogs,
    clearLocalRegister: clearLocalRegister,
    exportLocalRegisterTable: exportLocalRegisterTable,
    openPromoRecord: openPromoRecord,
    openOnesiteRecord: openOnesiteRecord,
    openSearchRecord: openSearchRecord,
    openContentRecord: openContentRecord,
    applySearchKeyword: applySearchKeyword,
    onFindPageAction: onFindPageAction,
    clearUnnecessaryCaches: clearUnnecessaryCaches,
    handleFindPageRefreshClick: handleFindPageRefreshClick,
    handleSearchKeywordKeydown: handleSearchKeywordKeydown,
    handleLocalTableClick: handleLocalTableClick,
    handleLocalTableBlur: handleLocalTableBlur,
    handleNavDateTriggerClick: handleNavDateTriggerClick,
    handleNavCalendarClick: handleNavCalendarClick,
    refreshOnFocus: refreshOnFocus,
    startAutoRefresh: startAutoRefresh,
    stopAutoRefresh: stopAutoRefresh
  };
}








