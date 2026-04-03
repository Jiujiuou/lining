import { PREFIX, SHOP_RECORD_DEFAULTS, mergeShopRecordDailyRowPatch } from '../defaults.js';
import { getLocalDateYmd } from '../../shared/time/date-key.js';

{
  var APPEND_LOG_TYPE = SHOP_RECORD_DEFAULTS.RUNTIME.CONTENT_APPEND_LOG_MESSAGE;
  var MSG = 'shop-record-onebp-query';

  function toPayload(payload) {
    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload);
      } catch {
        return null;
      }
    }
    return payload && typeof payload === 'object' ? payload : null;
  }
  function detectYmd(row0) {
    var ymd = getLocalDateYmd(-1);
    if (row0 && row0.thedate && /^\d{4}-\d{2}-\d{2}$/.test(String(row0.thedate))) ymd = String(row0.thedate);
    return ymd;
  }
  function numStr(v, decimals) {
    if (v == null || v === '') return null;
    var n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return n.toFixed(decimals != null ? decimals : 2);
  }
  function cvrPercent(v) {
    if (v == null || v === '') return null;
    var n = Number(v);
    return Number.isNaN(n) ? String(v) : (n * 100).toFixed(2) + '%';
  }

  var ONEBP_METRIC_MAP = {
    onebpSearch: [
      { read: 'charge', write: 'ztc_charge_yuan', normalize: function (v) { return numStr(v, 2); } },
      { read: 'cvr', write: 'ztc_cvr', normalize: cvrPercent },
      { read: 'ecpc', write: 'ztc_ppc', normalize: function (v) { return numStr(v, 2); } },
      { read: 'roi', write: 'ztc_roi', normalize: function (v) { return numStr(v, 2); } },
    ],
    onebpDisplay: [
      { read: 'charge', write: 'ylmf_charge_yuan', normalize: function (v) { return numStr(v, 2); } },
      { read: 'cvr', write: 'ylmf_cvr', normalize: cvrPercent },
      { read: 'ecpc', write: 'ylmf_ppc', normalize: function (v) { return numStr(v, 2); } },
      { read: 'roi', write: 'ylmf_roi', normalize: function (v) { return numStr(v, 2); } },
    ],
    onebpSite: [
      { read: 'charge', write: 'site_wide_charge_yuan', normalize: function (v) { return numStr(v, 2); } },
      { read: 'roi', write: 'site_wide_roi', normalize: function (v) { return numStr(v, 2); } },
    ],
    onebpShortVideo: [
      { read: 'charge', write: 'content_promo_charge_yuan', normalize: function (v) { return numStr(v, 2); } },
      { read: 'roi', write: 'content_promo_roi', normalize: function (v) { return numStr(v, 2); } },
    ],
  };

  function maybeMergeOnebpMetrics(bizCode, payload) {
    var fieldMap = ONEBP_METRIC_MAP[bizCode];
    if (!fieldMap || fieldMap.length === 0) return;

    var parsed = toPayload(payload);
    if (!parsed) return;
    var row0 = Array.isArray(parsed.data && parsed.data.list) ? parsed.data.list[0] : null;
    if (!row0) return;

    var row = { report_at: detectYmd(row0) };
    var hasAnyMetric = false;
    fieldMap.forEach(function (entry) {
      var value = entry.normalize(row0[entry.read]);
      if (!value) return;
      row[entry.write] = value;
      hasAnyMetric = true;
    });

    if (!hasAnyMetric) return;
    mergeShopRecordDailyRowPatch(row);
  }

  function summarizePayload(payload) {
    var parsed = toPayload(payload);
    if (!parsed || !parsed.data || !Array.isArray(parsed.data.list)) {
      return 'invalid payload';
    }
    var list = parsed.data.list;
    var row0 = list[0] || {};
    var ymd = detectYmd(row0);
    return 'rows=' + list.length + ', report_at=' + ymd;
  }

  window.addEventListener('message', function (ev) {
    if (ev.source !== window) return;
    var d = ev.data;
    if (!d || d.source !== MSG) return;

    var seq = d.seq != null ? ' #' + d.seq : '';
    var tabLabel =
      d.label ||
      (d.bizCode === 'onebpDisplay'
        ? 'onebpDisplay'
        : d.bizCode === 'onebpSite'
          ? 'onebpSite'
          : d.bizCode === 'onebpShortVideo'
            ? 'onebpShortVideo'
            : 'onebpSearch');
    var line =
      PREFIX +
      ' ' +
      tabLabel +
      ' query.json' +
      seq +
      ' captured: ' +
      summarizePayload(d.payload);
    try {
      chrome.runtime.sendMessage({ type: APPEND_LOG_TYPE, msg: line });
    } catch {
      /* ignore */
    }

    maybeMergeOnebpMetrics(d.bizCode, d.payload);
  });
}
