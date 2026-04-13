export function parseManualTotalInput(raw) {
  if (raw == null) return NaN;
  let s = String(raw)
    .trim()
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(/，/g, ',');
  if (s === '') return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastDot > lastComma) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(/\./g, '').replace(/,/g, '.');
    }
  } else {
    s = s.replace(/,/g, '');
  }
  return Number(s);
}

export function roundMoney(value) {
  if (value == null || typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.round(value * 100) / 100;
}

export function getDateRangeFromUrl(url) {
  const out = { startDate: null, endDate: null };
  if (!url || typeof url !== 'string') return out;
  function parseQuery(search) {
    if (!search || search.indexOf('?') < 0) return;
    const params = new URLSearchParams(search.indexOf('?') >= 0 ? search : `?${search}`);
    const startTime = params.get('startTime');
    const endTime = params.get('endTime');
    if (startTime && /^\d{4}-\d{2}-\d{2}/.test(startTime)) out.startDate = startTime.slice(0, 10);
    if (endTime && /^\d{4}-\d{2}-\d{2}/.test(endTime)) out.endDate = endTime.slice(0, 10);
  }
  try {
    const q = url.indexOf('?');
    if (q >= 0) parseQuery(url.slice(q));
    const hashIdx = url.indexOf('#');
    if ((!out.startDate || !out.endDate) && hashIdx >= 0) {
      const hashPart = url.slice(hashIdx);
      const qInHash = hashPart.indexOf('?');
      if (qInHash >= 0) parseQuery(hashPart.slice(qInHash));
    }
  } catch (error) {
    return out;
  }
  return out;
}

export function getPageTypeFromUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.indexOf('/manage/display') >= 0) return 'display';
  if (url.indexOf('/manage/onesite') >= 0) return 'onesite';
  if (url.indexOf('/manage/search') >= 0) return 'search';
  if (url.indexOf('/manage/content') >= 0) return 'content';
  return '';
}

export function parseParamsFromUrl(url) {
  const out = {};
  if (!url || typeof url !== 'string') return out;
  function parseQuery(search) {
    if (!search || search.indexOf('?') < 0) return;
    try {
      const params = new URLSearchParams(search.indexOf('?') >= 0 ? search : `?${search}`);
      params.forEach((value, key) => {
        out[String(key)] = String(value);
      });
    } catch (error) {
      // 忽略解析异常，维持旧逻辑
    }
  }
  const q = url.indexOf('?');
  if (q >= 0) parseQuery(url.slice(q));
  const hashIdx = url.indexOf('#');
  if (hashIdx >= 0) {
    const hashPart = url.slice(hashIdx);
    const qInHash = hashPart.indexOf('?');
    if (qInHash >= 0) parseQuery(hashPart.slice(qInHash));
  }
  return out;
}

export function buildFindPageQueryKey(state) {
  const requestUrl = state && state.findPageRequestUrl ? String(state.findPageRequestUrl) : '';
  const pageUrl = state && state.findPagePageUrl ? String(state.findPagePageUrl) : '';
  const bizCode = state && state.findPageBizCode ? String(state.findPageBizCode) : '';
  const req = parseParamsFromUrl(requestUrl);
  const page = parseParamsFromUrl(pageUrl);
  const pageType = getPageTypeFromUrl(pageUrl);
  const startTime = req.startTime || page.startTime || '';
  const endTime = req.endTime || page.endTime || '';
  const searchKey = req.searchKey || page.searchKey || '';
  const searchValue = req.searchValue || page.searchValue || '';
  const effectEqual = req.effectEqual || page.effectEqual || '';
  const unifyType = req.unifyType || page.unifyType || '';
  return [bizCode, pageType, startTime, endTime, searchKey, searchValue, effectEqual, unifyType].join('|');
}

export function getSlicedCampaignName(name) {
  if (name == null) return '';
  const text = String(name).trim();
  const index = text.indexOf('T');
  return index >= 0 ? text.slice(0, index).trim() : text;
}

export function pruneSelectionStore(store, limits) {
  const src = store && typeof store === 'object' ? store : {};
  const next = {};
  const maxQueries = limits && limits.maxQueries ? limits.maxQueries : 100;
  const maxQueriesPerPage = limits && limits.maxQueriesPerPage ? limits.maxQueriesPerPage : 25;
  const maxItemsPerQuery = limits && limits.maxItemsPerQuery ? limits.maxItemsPerQuery : 200;

  const keys = Object.keys(src).filter((key) => src[key] && typeof src[key] === 'object' && Array.isArray(src[key].selected));
  keys.sort((left, right) => String(src[right].lastTouchedAt || '').localeCompare(String(src[left].lastTouchedAt || '')));

  const pageCounts = {};
  let kept = 0;
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (kept >= maxQueries) continue;
    const item = src[key];
    const pageType = item.pageType || '';
    pageCounts[pageType] = pageCounts[pageType] || 0;
    if (pageCounts[pageType] >= maxQueriesPerPage) continue;
    next[key] = {
      selected: item.selected.slice(0, maxItemsPerQuery),
      bizCode: item.bizCode || '',
      pageType,
      lastTouchedAt: item.lastTouchedAt || new Date().toISOString(),
    };
    pageCounts[pageType] += 1;
    kept += 1;
  }
  return next;
}

export function getCampaignNameForRegister(item, report, bizCode) {
  if (bizCode === 'onebpSite') {
    return item && item.campaignName != null ? String(item.campaignName) : '';
  }
  if (item && item.campaignName != null && String(item.campaignName).trim() !== '') {
    return String(item.campaignName);
  }
  if (report && report.campaignName != null) return String(report.campaignName);
  return '';
}

export function getReportDate(item, todayYmd) {
  const report = item && Array.isArray(item.reportInfoList) && item.reportInfoList[0];
  const cond = report && report.condition;
  const startTime = cond && cond.startTime;
  if (typeof startTime === 'string' && startTime.length >= 10) return startTime.slice(0, 10);
  return todayYmd;
}
