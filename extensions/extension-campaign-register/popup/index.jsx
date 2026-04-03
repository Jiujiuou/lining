import { Fragment, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createMessageTabIdResolver, queryActiveTabId } from '../../shared/chrome/runtime.js';
import { createTabbedLogger } from '../../shared/chrome/tabbed-logger.js';
import { safeSet } from '../../shared/chrome/storage.js';
import { mergeRegisterBatch } from '../local-register-store.js';
import { MESSAGE_TYPES } from '../messages.js';
import { LOG_MAX_ENTRIES, LOG_MAX_TABS, STORAGE_KEYS } from '../defaults.js';

const ACTIVE_TAB_QUERY = { active: true, lastFocusedWindow: true };
const STORAGE_SEARCH_KEYWORD = 'amcr_search_keyword';
const STORAGE_NAV_DATE = STORAGE_KEYS.popupNavDate;
const STORAGE_FALLBACK_KEYS = [
  'amcr_findPageResponse',
  'amcr_findPageRequestUrl',
  'amcr_findPagePageUrl',
  'amcr_findPageBizCode',
  'amcr_findPageSelectedCampaigns',
];
const VALID_BIZ = { onebpDisplay: 1, onebpSite: 1, onebpSearch: 1, onebpShortVideo: 1 };
const BIZ_TO_KEYS = {
  onebpSearch: { c: 'charge_onebpsearch', a: 'alipay_inshop_amt_onebpsearch' },
  onebpDisplay: { c: 'charge_onebpdisplay', a: 'alipay_inshop_amt_onebpdisplay' },
  onebpSite: { c: 'charge_onebpsite', a: 'alipay_inshop_amt_onebpsite' },
  onebpShortVideo: { c: 'charge_onebpshortvideo', a: 'alipay_inshop_amt_onebpshortvideo' },
};

function getTodayEast8() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

function getYesterdayEast8() {
  const today = getTodayEast8();
  const date = new Date(`${today}T12:00:00+08:00`);
  date.setDate(date.getDate() - 1);
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

function formatLogTime(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const pad = (n) => (n < 10 ? `0${n}` : String(n));
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  } catch {
    return '';
  }
}

function renderMultilineText(text) {
  const lines = String(text == null ? '' : text).split('\n');
  return lines.map((line, index) => (
    <Fragment key={`${line}-${index}`}>
      {line}
      {index < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}

function parseManualTotalInput(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/[\s\u00a0\u202f]/g, '').replace(/，/g, ',');
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastDot > lastComma) s = s.replace(/,/g, '');
    else s = s.replace(/\./g, '').replace(/,/g, '.');
  } else {
    s = s.replace(/,/g, '');
  }
  return Number(s);
}

function getSlicedCampaignName(name) {
  const s = String(name == null ? '' : name).trim();
  const i = s.indexOf('T');
  return i >= 0 ? s.slice(0, i).trim() : s;
}

function getCampaignNameForRegister(item, report, bizCode) {
  if (bizCode === 'onebpSite') return item && item.campaignName != null ? String(item.campaignName) : '';
  if (item && item.campaignName != null && String(item.campaignName).trim()) return String(item.campaignName);
  if (report && report.campaignName != null) return String(report.campaignName);
  return '';
}

function parseParamsFromUrl(url) {
  const out = {};
  if (!url || typeof url !== 'string') return out;
  const parseQuery = (search) => {
    if (!search || search.indexOf('?') < 0) return;
    const params = new URLSearchParams(search.indexOf('?') >= 0 ? search : `?${search}`);
    params.forEach((value, key) => {
      out[String(key)] = String(value);
    });
  };
  const q = url.indexOf('?');
  if (q >= 0) parseQuery(url.slice(q));
  const h = url.indexOf('#');
  if (h >= 0) {
    const hash = url.slice(h);
    const qh = hash.indexOf('?');
    if (qh >= 0) parseQuery(hash.slice(qh));
  }
  return out;
}

function buildFindPageQueryKey(state) {
  const requestUrl = state && state.findPageRequestUrl ? String(state.findPageRequestUrl) : '';
  const pageUrl = state && state.findPagePageUrl ? String(state.findPagePageUrl) : '';
  const bizCode = state && state.findPageBizCode ? String(state.findPageBizCode) : '';
  const req = parseParamsFromUrl(requestUrl);
  const page = parseParamsFromUrl(pageUrl);
  return [
    bizCode,
    req.startTime || page.startTime || '',
    req.endTime || page.endTime || '',
    req.searchValue || page.searchValue || '',
    req.effectEqual || page.effectEqual || '',
    req.unifyType || page.unifyType || '',
  ].join('|');
}

function pruneSelectionStore(store) {
  const src = store && typeof store === 'object' ? store : {};
  const keys = Object.keys(src).filter((k) => src[k] && Array.isArray(src[k].selected));
  keys.sort((a, b) => String(src[b].lastTouchedAt || '').localeCompare(String(src[a].lastTouchedAt || '')));
  const next = {};
  const pageCounts = {};
  let kept = 0;
  keys.forEach((key) => {
    if (kept >= 100) return;
    const item = src[key];
    const pageType = item.pageType || '';
    pageCounts[pageType] = pageCounts[pageType] || 0;
    if (pageCounts[pageType] >= 25) return;
    next[key] = {
      selected: item.selected.slice(0, 200),
      bizCode: item.bizCode || '',
      pageType,
      lastTouchedAt: item.lastTouchedAt || new Date().toISOString(),
    };
    pageCounts[pageType] += 1;
    kept += 1;
  });
  return next;
}

function bizLabel(bizCode) {
  const map = {
    onebpDisplay: '人群',
    onebpSite: '货品全站',
    onebpSearch: '关键词',
    onebpShortVideo: '内容营销',
  };
  return map[bizCode] || '未知来源';
}

function PopupShell() {
  const loggerRef = useRef(null);
  const lastFindPageResponseRef = useRef(null);
  const lastFindPageBizCodeRef = useRef('');
  const lastFindPageRequestUrlRef = useRef('');
  const lastFindPagePageUrlRef = useRef('');

  const [searchKeyword, setSearchKeyword] = useState('池');
  const [navDate, setNavDate] = useState(getYesterdayEast8());
  const [logs, setLogs] = useState([]);
  const [findPageRows, setFindPageRows] = useState([]);
  const [findPageEmptyText, setFindPageEmptyText] = useState('暂无捕获数据，请先在推广记录页打开列表');
  const [localRows, setLocalRows] = useState([]);
  const [localEmptyText, setLocalEmptyText] = useState('暂无本地登记数据。');
  const [storageLines, setStorageLines] = useState([]);

  function loadLogs() {
    if (!loggerRef.current) return;
    queryActiveTabId(ACTIVE_TAB_QUERY, (tabId) => {
      loggerRef.current.getLogs((entries) => {
        const next = Array.isArray(entries)
          ? entries.map((entry) => ({
              t: entry.t,
              time: formatLogTime(entry.t),
              level: entry.level || 'log',
              msg: String(entry.msg != null ? entry.msg : ''),
            }))
          : [];
        setLogs(next);
      }, tabId);
    });
  }

  function appendLog(level, message) {
    if (!loggerRef.current) return;
    loggerRef.current.appendLog(level, message);
    loadLogs();
  }

  function loadSearchState() {
    chrome.storage.local.get([STORAGE_SEARCH_KEYWORD, STORAGE_NAV_DATE], (stored) => {
      const keyword =
        stored && stored[STORAGE_SEARCH_KEYWORD] != null ? String(stored[STORAGE_SEARCH_KEYWORD]).trim() : '';
      const date = stored && stored[STORAGE_NAV_DATE] != null ? String(stored[STORAGE_NAV_DATE]).trim() : '';
      setSearchKeyword(keyword || '池');
      setNavDate(/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : getYesterdayEast8());
    });
  }

  function applySettings() {
    const keyword = String(searchKeyword || '').trim() || '池';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(navDate) ? navDate : getYesterdayEast8();
    setSearchKeyword(keyword);
    setNavDate(date);
    safeSet(
      { [STORAGE_SEARCH_KEYWORD]: keyword, [STORAGE_NAV_DATE]: date },
      () => {},
      (retry) => chrome.storage.local.remove([STORAGE_SEARCH_KEYWORD, STORAGE_NAV_DATE], retry),
    );
    appendLog('log', `已应用：搜索词「${keyword}」；推广页日期 ${date.replace(/-/g, '/')}`);
  }

  function buildUrl(kind) {
    const date = navDate;
    const kw = encodeURIComponent(searchKeyword || '池');
    const map = {
      display: `https://one.alimama.com/index.html#!/manage/display?mx_bizCode=onebpDisplay&bizCode=onebpDisplay&tab=campaign&startTime=${date}&endTime=${date}&offset=0&pageSize=100&searchKey=campaignNameLike&searchValue=${kw}`,
      onesite: `https://one.alimama.com/index.html#!/manage/onesite?mx_bizCode=onebpSite&bizCode=onebpSite&tab=campaign&startTime=${date}&endTime=${date}&effectEqual=15&unifyType=last_click_by_effect_time&offset=0&pageSize=100&searchKey=campaignNameLike&searchValue=${kw}`,
      search: `https://one.alimama.com/index.html#!/manage/search?mx_bizCode=onebpSearch&bizCode=onebpSearch&tab=campaign&startTime=${date}&endTime=${date}&offset=0&pageSize=100&searchKey=campaignNameLike&searchValue=${kw}`,
      content: `https://one.alimama.com/index.html#!/manage/content?mx_bizCode=onebpShortVideo&bizCode=onebpShortVideo&tab=campaign&startTime=${date}&endTime=${date}&unifyType=video_kuan&offset=0&pageSize=100&searchKey=campaignNameLike&searchValue=${kw}`,
    };
    return map[kind] || '';
  }

  function openPage(kind) {
    const url = buildUrl(kind);
    if (!url) return;
    chrome.tabs.create({ url });
    appendLog('log', `已打开「${bizLabel(kind === 'display' ? 'onebpDisplay' : kind === 'onesite' ? 'onebpSite' : kind === 'search' ? 'onebpSearch' : 'onebpShortVideo')}」页面`);
  }

  function loadFindPageResponse() {
    chrome.storage.local.get([STORAGE_KEYS.findPageStateByTab, STORAGE_KEYS.findPageSelectionByQuery].concat(STORAGE_FALLBACK_KEYS), (stored) => {
      queryActiveTabId(ACTIVE_TAB_QUERY, (tabId) => {
        const byTab = stored[STORAGE_KEYS.findPageStateByTab] || {};
        const bucket = tabId != null ? byTab[String(tabId)] : null;
        const state = bucket && bucket.findPageResponse
          ? {
              findPageResponse: bucket.findPageResponse,
              findPageRequestUrl: bucket.findPageRequestUrl,
              findPagePageUrl: bucket.findPagePageUrl,
              findPageBizCode: bucket.findPageBizCode,
              findPageSelectedCampaigns: bucket.findPageSelectedCampaigns || {},
            }
          : {
              findPageResponse: stored.amcr_findPageResponse,
              findPageRequestUrl: stored.amcr_findPageRequestUrl,
              findPagePageUrl: stored.amcr_findPagePageUrl,
              findPageBizCode: stored.amcr_findPageBizCode,
              findPageSelectedCampaigns: stored.amcr_findPageSelectedCampaigns || {},
            };

        lastFindPageResponseRef.current = state.findPageResponse || null;
        lastFindPageBizCodeRef.current = state.findPageBizCode || '';
        lastFindPageRequestUrlRef.current = state.findPageRequestUrl || '';
        lastFindPagePageUrlRef.current = state.findPagePageUrl || '';

        const queryKey = buildFindPageQueryKey(state);
        const byQuery = stored[STORAGE_KEYS.findPageSelectionByQuery] || {};
        const globalSelected = stored.amcr_findPageSelectedCampaigns || {};
        const selected =
          (queryKey && byQuery[queryKey] && Array.isArray(byQuery[queryKey].selected) ? byQuery[queryKey].selected : null) ||
          (state.findPageSelectedCampaigns && state.findPageSelectedCampaigns[state.findPageBizCode]) ||
          globalSelected[state.findPageBizCode] ||
          [];

        const list = state.findPageResponse && state.findPageResponse.data && Array.isArray(state.findPageResponse.data.list)
          ? state.findPageResponse.data.list
          : [];
        if (list.length === 0) {
          setFindPageRows([]);
          setFindPageEmptyText('暂无捕获数据，请先在推广记录页打开列表');
          return;
        }

        setFindPageRows(
          list.map((item, index) => {
            const report = item && Array.isArray(item.reportInfoList) ? item.reportInfoList[0] : null;
            const name = getCampaignNameForRegister(item, report, state.findPageBizCode || '');
            const display = getSlicedCampaignName(name);
            return {
              index,
              name: name || `未命名计划${index + 1}`,
              checked: !!(display && selected.indexOf(display) >= 0),
              effective: !!(item && (item.displayStatus === 'start' || item.onlineStatus === 1)),
            };
          }),
        );
      });
    });
  }

  function loadLocalRows() {
    chrome.storage.local.get([STORAGE_KEYS.localRegisterByDate], (result) => {
      const bag = result[STORAGE_KEYS.localRegisterByDate];
      if (!bag || typeof bag !== 'object') {
        setLocalRows([]);
        setLocalEmptyText('暂无本地登记数据。');
        return;
      }
      const prefer = getYesterdayEast8();
      const ymd = bag[prefer] ? prefer : Object.keys(bag).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-1)[0];
      if (!ymd || !bag[ymd] || !bag[ymd].byBiz) {
        setLocalRows([]);
        setLocalEmptyText('暂无本地登记数据。');
        return;
      }
      const day = bag[ymd];
      const byName = {};
      Object.keys(day.byBiz).forEach((biz) => {
        const keys = BIZ_TO_KEYS[biz];
        if (!keys || !Array.isArray(day.byBiz[biz])) return;
        day.byBiz[biz].forEach((row) => {
          const name = row && row.campaign_name ? String(row.campaign_name).trim() : '';
          if (!name) return;
          if (!byName[name]) byName[name] = { ...Object.fromEntries(Object.values(BIZ_TO_KEYS).flatMap((v) => [[v.c, 0], [v.a, 0]])) };
          byName[name][keys.c] += Number(row.charge || 0);
          byName[name][keys.a] += Number(row.alipay_inshop_amt || 0);
        });
      });
      const manualMap = day.manual_total_amt_by_name && typeof day.manual_total_amt_by_name === 'object' ? day.manual_total_amt_by_name : {};
      const rows = Object.keys(byName).sort((a, b) => a.localeCompare(b, 'zh-CN')).map((name) => {
        const m = byName[name];
        const totalCharge = Number(m.charge_onebpsearch || 0) + Number(m.charge_onebpdisplay || 0) + Number(m.charge_onebpsite || 0) + Number(m.charge_onebpshortvideo || 0);
        const totalAmt = Number(m.alipay_inshop_amt_onebpsearch || 0) + Number(m.alipay_inshop_amt_onebpdisplay || 0) + Number(m.alipay_inshop_amt_onebpsite || 0) + Number(m.alipay_inshop_amt_onebpshortvideo || 0);
        const manualRaw = manualMap[name];
        return {
          ymd,
          name,
          charge: totalCharge,
          amount: totalAmt,
          ratio: manualRaw == null ? '' : `${((totalCharge / Number(manualRaw || 0)) * 100 || 0).toFixed(2).replace(/\.?0+$/, '')}%`,
          manualInput: manualRaw == null ? '' : String(manualRaw),
        };
      });
      setLocalRows(rows);
      setLocalEmptyText(rows.length ? '' : '该日尚无分来源行，请先在各推广页登记。');
    });
  }

  function saveManualValue(ymd, name, raw) {
    chrome.storage.local.get([STORAGE_KEYS.localRegisterByDate], (result) => {
      const bag = result[STORAGE_KEYS.localRegisterByDate] && typeof result[STORAGE_KEYS.localRegisterByDate] === 'object' ? result[STORAGE_KEYS.localRegisterByDate] : {};
      const day = bag[ymd] && typeof bag[ymd] === 'object' ? bag[ymd] : {};
      day.manual_total_amt_by_name = day.manual_total_amt_by_name && typeof day.manual_total_amt_by_name === 'object' ? day.manual_total_amt_by_name : {};
      const num = parseManualTotalInput(raw);
      if (!Number.isFinite(num) || num <= 0) delete day.manual_total_amt_by_name[name];
      else day.manual_total_amt_by_name[name] = Math.round(num * 100) / 100;
      day.updated_at_local = new Date().toISOString();
      bag[ymd] = day;
      safeSet({ [STORAGE_KEYS.localRegisterByDate]: bag }, () => loadLocalRows(), (retry) => chrome.storage.local.remove([STORAGE_KEYS.localRegisterByDate], retry));
    });
  }

  function deleteLocalRow(ymd, name) {
    const target = getSlicedCampaignName(name);
    chrome.storage.local.get([STORAGE_KEYS.localRegisterByDate], (result) => {
      const bag = result[STORAGE_KEYS.localRegisterByDate] && typeof result[STORAGE_KEYS.localRegisterByDate] === 'object' ? result[STORAGE_KEYS.localRegisterByDate] : {};
      const day = bag[ymd];
      if (!day || !day.byBiz) return;
      Object.keys(day.byBiz).forEach((biz) => {
        if (!Array.isArray(day.byBiz[biz])) return;
        day.byBiz[biz] = day.byBiz[biz].filter((row) => getSlicedCampaignName(row.campaign_name) !== target);
      });
      if (day.manual_total_amt_by_name) delete day.manual_total_amt_by_name[target];
      day.updated_at_local = new Date().toISOString();
      bag[ymd] = day;
      safeSet({ [STORAGE_KEYS.localRegisterByDate]: bag }, () => loadLocalRows(), (retry) => chrome.storage.local.remove([STORAGE_KEYS.localRegisterByDate], retry));
    });
  }

  function exportLocalRows() {
    if (localRows.length === 0) {
      appendLog('warn', '暂无可导出的本地登记数据');
      return;
    }
    const headers = ['时间', '商品名称', '总消耗', '总推广成交', '总成交金额', '比例'];
    const body = localRows
      .map(
        (row) =>
          `<tr><td>${row.ymd}</td><td>${row.name}</td><td>${row.charge}</td><td>${row.amount}</td><td>${row.manualInput}</td><td>${row.ratio}</td></tr>`,
      )
      .join('');
    const html =
      `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${headers
        .map((header) => `<th>${header}</th>`)
        .join('')}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    const blob = new Blob([`\ufeff${html}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const now = new Date();
    const pad = (n) => (n < 10 ? `0${n}` : String(n));
    link.download = `推广登记_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
      now.getHours(),
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    appendLog('log', '已导出本地登记表');
  }

  function loadStorageUsage() {
    const keys = [STORAGE_KEYS.logs, STORAGE_KEYS.logsByTab, STORAGE_KEYS.localRegisterByDate, STORAGE_KEYS.findPageSelectionByQuery, STORAGE_KEYS.findPageStateByTab].concat(STORAGE_FALLBACK_KEYS);
    chrome.storage.local.get(keys, (stored) => {
      const logsBytes = JSON.stringify(stored[STORAGE_KEYS.logs] || {}).length;
      const logsByTabBytes = JSON.stringify(stored[STORAGE_KEYS.logsByTab] || {}).length;
      const localBytes = JSON.stringify(stored[STORAGE_KEYS.localRegisterByDate] || {}).length;
      const byQuery = stored[STORAGE_KEYS.findPageSelectionByQuery] || {};
      const byTab = stored[STORAGE_KEYS.findPageStateByTab] || {};
      const listCacheBytes =
        JSON.stringify(byQuery).length +
        JSON.stringify(byTab).length +
        STORAGE_FALLBACK_KEYS.reduce((sum, key) => sum + JSON.stringify(stored[key] || null).length, 0);
      const total = logsBytes + logsByTabBytes + localBytes + listCacheBytes;
      const quota = chrome.storage.local.QUOTA_BYTES || 10 * 1024 * 1024;
      setStorageLines([
        { key: '占用', value: `${(total / 1024).toFixed(1)} KB / ${(quota / 1024).toFixed(1)} KB` },
        { key: '勾选缓存', value: `${Object.keys(byQuery).filter((k) => k !== '__meta').length} 组` },
        { key: 'tab缓存', value: `${Object.keys(byTab).filter((k) => k !== '__meta').length} 个` },
        { key: '日志', value: `${((logsBytes + logsByTabBytes) / 1024).toFixed(1)} KB` },
        { key: '列表缓存', value: `${(listCacheBytes / 1024).toFixed(1)} KB` },
        { key: '本地登记', value: `${(localBytes / 1024).toFixed(1)} KB` },
      ]);
    });
  }

  function onRegisterSelected() {
    const response = lastFindPageResponseRef.current;
    if (!response || !response.data || !Array.isArray(response.data.list)) {
      appendLog('warn', '暂无可登记的数据');
      return;
    }
    const selectedIndex = findPageRows.filter((row) => row.checked).map((row) => row.index);
    if (selectedIndex.length === 0) {
      appendLog('warn', '请先勾选要登记的商品');
      return;
    }
    const bizCode = lastFindPageBizCodeRef.current;
    if (!bizCode || !VALID_BIZ[bizCode]) {
      appendLog('warn', '登记失败：未识别推广来源，请先刷新列表');
      return;
    }
    const selectedItems = selectedIndex.map((index) => response.data.list[index]).filter(Boolean);
    chrome.tabs.query(ACTIVE_TAB_QUERY, (tabs) => {
      const pageUrl = tabs && tabs[0] && tabs[0].url && tabs[0].url.includes('one.alimama.com') ? tabs[0].url : '';
      const dateRange = (() => {
        const out = { startDate: null, endDate: null };
        try {
          const params = parseParamsFromUrl(pageUrl);
          if (params.startTime && /^\d{4}-\d{2}-\d{2}/.test(params.startTime)) out.startDate = params.startTime.slice(0, 10);
          if (params.endTime && /^\d{4}-\d{2}-\d{2}/.test(params.endTime)) out.endDate = params.endTime.slice(0, 10);
        } catch {
          return out;
        }
        return out;
      })();
      if (dateRange.startDate && dateRange.endDate && dateRange.startDate !== dateRange.endDate) {
        appendLog('warn', '登记失败：起止日期不一致，请选择同一天');
        return;
      }
      const reportDate = dateRange.startDate || getTodayEast8();
      const rawRows = [];
      selectedItems.forEach((item) => {
        const report = item && Array.isArray(item.reportInfoList) ? item.reportInfoList[0] : null;
        const campaignName = getSlicedCampaignName(getCampaignNameForRegister(item, report, bizCode));
        if (!campaignName) return;
        rawRows.push({
          report_date: reportDate,
          campaign_name: campaignName,
          charge: Number(report && report.charge != null ? report.charge : 0),
          alipay_inshop_amt: Number(report && report.alipayInshopAmt != null ? report.alipayInshopAmt : 0),
        });
      });
      const merged = {};
      rawRows.forEach((row) => {
        const key = `${row.report_date}\n${row.campaign_name}`;
        if (!merged[key]) merged[key] = { ...row, charge: 0, alipay_inshop_amt: 0 };
        merged[key].charge += Number.isFinite(row.charge) ? row.charge : 0;
        merged[key].alipay_inshop_amt += Number.isFinite(row.alipay_inshop_amt) ? row.alipay_inshop_amt : 0;
      });
      const rows = Object.keys(merged).map((key) => ({
        report_date: merged[key].report_date,
        campaign_name: merged[key].campaign_name,
        charge: Math.round(merged[key].charge * 100) / 100,
        alipay_inshop_amt: Math.round(merged[key].alipay_inshop_amt * 100) / 100,
      }));
      if (rows.length === 0) {
        appendLog('warn', '登记失败：勾选项没有有效数据');
        return;
      }
      appendLog('log', `开始登记：${rows.length} 个商品（${bizLabel(bizCode)}）`);
      const selectedDisplayNames = rows.map((row) => row.campaign_name);
      const queryKey = buildFindPageQueryKey({
        findPageRequestUrl: lastFindPageRequestUrlRef.current || '',
        findPagePageUrl: pageUrl || lastFindPagePageUrlRef.current || '',
        findPageBizCode: bizCode,
      });
      chrome.storage.local.get(['amcr_findPageSelectedCampaigns', STORAGE_KEYS.findPageSelectionByQuery], (stored) => {
        const globalAll = stored && stored.amcr_findPageSelectedCampaigns ? stored.amcr_findPageSelectedCampaigns : {};
        globalAll[bizCode] = selectedDisplayNames;
        let byQuery = stored && stored[STORAGE_KEYS.findPageSelectionByQuery] ? stored[STORAGE_KEYS.findPageSelectionByQuery] : {};
        if (queryKey) {
          byQuery[queryKey] = {
            selected: selectedDisplayNames.slice(0, 200),
            bizCode,
            pageType: '',
            lastTouchedAt: new Date().toISOString(),
          };
        }
        byQuery = pruneSelectionStore(byQuery);
        safeSet({ amcr_findPageSelectedCampaigns: globalAll, [STORAGE_KEYS.findPageSelectionByQuery]: byQuery }, () => {}, (retry) => safeSet({ amcr_findPageSelectedCampaigns: globalAll, [STORAGE_KEYS.findPageSelectionByQuery]: pruneSelectionStore(byQuery) }, retry));
      });
      mergeRegisterBatch({ report_date: reportDate, biz_code: bizCode, rows }, () => {
        appendLog('log', `本地登记已保存：${rows.length} 条（${bizLabel(bizCode)}）`);
        loadLocalRows();
      });
    });
  }

  useEffect(() => {
    loggerRef.current = createTabbedLogger({
      storageKeys: { logs: STORAGE_KEYS.logs, logsByTab: STORAGE_KEYS.logsByTab },
      maxEntries: LOG_MAX_ENTRIES,
      maxTabs: LOG_MAX_TABS,
      resolveTabId: createMessageTabIdResolver(MESSAGE_TYPES.GET_TAB_ID),
    });
    loadSearchState();
    loadLogs();
    loadFindPageResponse();
    loadLocalRows();
    loadStorageUsage();
    const timer = setInterval(() => {
      loadLogs();
      loadLocalRows();
      loadStorageUsage();
    }, 2000);
    const onStorageChanged = (changes, area) => {
      if (area !== 'local') return;
      if (changes[STORAGE_KEYS.localRegisterByDate]) loadLocalRows();
      if (changes[STORAGE_KEYS.findPageStateByTab] || changes.amcr_findPageResponse || changes[STORAGE_KEYS.findPageSelectionByQuery]) {
        loadFindPageResponse();
      }
      if (changes[STORAGE_KEYS.logs] || changes[STORAGE_KEYS.logsByTab]) loadLogs();
      loadStorageUsage();
    };
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => {
      clearInterval(timer);
      chrome.storage.onChanged.removeListener(onStorageChanged);
    };
  }, []);

  return (
    <div className="popup">
      <div className="popup-col popup-col--left">
        <section className="popup-section popup-section--quick-open">
          <div className="popup-quick-open-row" role="group" aria-label="搜索词、日期与推广页">
            <input type="date" className="popup-search-keyword-input" value={navDate} onChange={(e) => setNavDate(e.target.value)} />
            <input
              type="text"
              id="search-keyword-input"
              className="popup-search-keyword-input"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySettings()}
            />
            <button type="button" id="search-keyword-apply" className="popup-search-keyword-apply" onClick={applySettings}>应用</button>
            <button type="button" id="open-onesite-record" className="popup-open-sites" onClick={() => openPage('onesite')}>货品全站</button>
            <button type="button" id="open-search-record" className="popup-open-sites" onClick={() => openPage('search')}>关键词</button>
            <button type="button" id="open-promo-record" className="popup-open-sites" onClick={() => openPage('display')}>人群</button>
            <button type="button" id="open-content-record" className="popup-open-sites" onClick={() => openPage('content')}>内容营销</button>
          </div>
        </section>

        <section className="popup-section popup-section--local-register" id="amcr-local-register-section">
          <div id="amcr-local-table-wrap" className="popup-local-table-wrap" role="region" aria-label="本地推广登记表">
            {localRows.length === 0 ? (
              <div className="popup-local-table--empty">{localEmptyText}</div>
            ) : (
              <div className="popup-local-table-scroll">
                {localRows.map((row) => (
                  <div key={`${row.ymd}-${row.name}`} className="popup-findpage-item">
                    <span className="popup-findpage-name">{row.name}</span>
                    <input
                      type="text"
                      className="popup-local-total-amt-input"
                      value={row.manualInput}
                      onChange={(e) =>
                        setLocalRows((prev) =>
                          prev.map((item) => (item.ymd === row.ymd && item.name === row.name ? { ...item, manualInput: e.target.value } : item)),
                        )
                      }
                      onBlur={(e) => saveManualValue(row.ymd, row.name, e.target.value)}
                    />
                    <button type="button" className="amcr-local-delete-btn" onClick={() => deleteLocalRow(row.ymd, row.name)}>删除</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="popup-findpage-split">
          <section className="popup-section popup-section--findpage-list" aria-label="推广捕获列表">
            <div id="findpage-list" className={`popup-findpage-list${findPageRows.length ? '' : ' popup-findpage-list--empty'}`} role="list">
              {findPageRows.length === 0 ? (
                <div className="popup-findpage-list--empty"><span>{findPageEmptyText}</span></div>
              ) : (
                findPageRows.map((row) => (
                  <div className={`popup-findpage-item${row.effective ? ' popup-findpage-item--effective' : ' popup-findpage-item--paused'}`} role="listitem" key={row.index}>
                    <input
                      type="checkbox"
                      id={`findpage-cb-${row.index}`}
                      checked={row.checked}
                      onChange={(e) =>
                        setFindPageRows((prev) => prev.map((item) => (item.index === row.index ? { ...item, checked: e.target.checked } : item)))
                      }
                    />
                    <label className="popup-findpage-name" htmlFor={`findpage-cb-${row.index}`}>{row.name}</label>
                  </div>
                ))
              )}
            </div>
          </section>
          <section className="popup-section popup-section--findpage-toolbar" aria-label="列表操作">
            <aside className="popup-findpage-actions" role="toolbar" aria-label="列表操作">
              <button type="button" id="findpage-action" className="popup-action-btn" onClick={onRegisterSelected}>登记</button>
              <button type="button" id="findpage-refresh" className="popup-action-btn" onClick={loadFindPageResponse}>刷新列表</button>
              <button type="button" id="amcr-local-export" className="popup-action-btn" onClick={exportLocalRows}>导出表格</button>
              <button type="button" id="amcr-local-clear" className="popup-action-btn" onClick={() => chrome.storage.local.remove(STORAGE_KEYS.localRegisterByDate, () => loadLocalRows())}>清空本地数据</button>
            </aside>
          </section>
        </div>
      </div>

      <div className="popup-col popup-col--right">
        <section className="popup-section popup-section--storage">
          <header className="popup-storage-header">
            <button type="button" id="storage-cache-clear" className="popup-storage-clear" onClick={() => chrome.storage.local.remove([STORAGE_KEYS.logs, STORAGE_KEYS.logsByTab, STORAGE_KEYS.findPageSelectionByQuery, STORAGE_KEYS.findPageStateByTab].concat(STORAGE_FALLBACK_KEYS), () => { loadFindPageResponse(); loadLogs(); loadStorageUsage(); })}>清理缓存</button>
          </header>
          <div id="storage-usage" className="popup-storage-usage">
            {storageLines.map((line) => (
              <div className="popup-storage-line" key={line.key}>
                <span className="popup-storage-key">{line.key}</span>
                <span className="popup-storage-sep">：</span>
                <span className="popup-storage-val">{line.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="popup-section popup-section--logs">
          <header className="popup-logs-header">
            <h2 className="popup-logs-title">日志</h2>
            <button type="button" id="logs-clear" className="popup-logs-clear" onClick={() => queryActiveTabId(ACTIVE_TAB_QUERY, (tabId) => loggerRef.current && loggerRef.current.clearLogs(loadLogs, tabId))}>清空日志</button>
          </header>
          <div id="logs-list" className="popup-logs-list" role="log" aria-live="polite">
            {logs.length === 0 ? (
              <div className="popup-logs-empty">暂无日志</div>
            ) : (
              logs.map((entry, index) => (
                <div className={`popup-log-card popup-log-entry popup-log-entry--${entry.level}`} key={`${entry.t || index}-${index}`}>
                  <span className="popup-log-time">{entry.time}</span>
                  {renderMultilineText(entry.msg)}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const mountNode = document.getElementById('popup-react-root');
if (mountNode) {
  createRoot(mountNode).render(<PopupShell />);
}
