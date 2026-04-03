import { PREFIX, SHOP_RECORD_DEFAULTS, mergeShopRecordDailyRowPatch } from '../defaults.js';
import { getLocalDateYmd } from '../../shared/time/date-key.js';

var APPEND_LOG_TYPE = SHOP_RECORD_DEFAULTS.RUNTIME.CONTENT_APPEND_LOG_MESSAGE;

function sendLog(msg) {
  try {
    chrome.runtime.sendMessage({ type: APPEND_LOG_TYPE, msg: String(msg) });
  } catch {
    /* ignore */
  }
}

function isUserRatePage() {
  return location.hostname === 'rate.taobao.com' && (location.pathname || '').indexOf('/user-rate-') === 0;
}

function normalizeLabel(text) {
  return String(text || '').replace(/\s/g, '').replace(/：/g, '').replace(/:/g, '');
}

var dsrData = null;
var refundData = null;
var savedLocal = false;
var scoresLogged = false;

function tryLogShopScores() {
  if (!isUserRatePage()) return;
  var root = document.getElementById('dsr') || document.querySelector('ul.dsr-info');
  if (!root) return;

  var want = {
    宝贝与描述相符: null,
    卖家的服务态度: null,
    物流服务的质量: null,
  };

  var items = root.querySelectorAll('li.dsr-item');
  for (var i = 0; i < items.length; i++) {
    var li = items[i];
    var titleEl = li.querySelector('.item-scrib span.tb-title');
    var countEl = li.querySelector('.item-scrib em.count');
    if (!titleEl || !countEl) continue;
    var key = normalizeLabel(titleEl.textContent);
    if (key.indexOf('宝贝与描述相符') !== -1) want.宝贝与描述相符 = (countEl.textContent || '').trim();
    else if (key.indexOf('卖家的服务态度') !== -1) want.卖家的服务态度 = (countEl.textContent || '').trim();
    else if (key.indexOf('物流服务的质量') !== -1) want.物流服务的质量 = (countEl.textContent || '').trim();
  }

  if (!want.宝贝与描述相符 || !want.卖家的服务态度 || !want.物流服务的质量) return;

  dsrData = {
    item_desc_match_score: want.宝贝与描述相符,
    seller_service_score: want.卖家的服务态度,
    seller_shipping_score: want.物流服务的质量,
  };
  if (!scoresLogged) {
    scoresLogged = true;
    sendLog(
      PREFIX +
        ' 店铺评分（' +
        location.pathname +
        '）宝贝与描述相符 ' +
        want.宝贝与描述相符 +
        ' 分；卖家服务态度 ' +
        want.卖家的服务态度 +
        ' 分；物流服务质量 ' +
        want.物流服务的质量 +
        ' 分',
    );
  }
  maybeSaveDailyRowLocal();
  return true;
}

function handleRefundDataFromBridge(data) {
  if (!data || typeof data !== 'object') return;
  if (!data.disputeRefundRate || !data.refundProFinishTime || !data.refundFinishRate) return;
  refundData = {
    refund_finish_duration: String(data.refundProFinishTime),
    refund_finish_rate: String(data.refundFinishRate),
    dispute_refund_rate: String(data.disputeRefundRate),
  };
  maybeSaveDailyRowLocal();
}

function maybeSaveDailyRowLocal() {
  if (savedLocal || !dsrData || !refundData) return;
  var row = {
    report_at: getLocalDateYmd(-1),
    item_desc_match_score: dsrData.item_desc_match_score,
    seller_service_score: dsrData.seller_service_score,
    seller_shipping_score: dsrData.seller_shipping_score,
    refund_finish_duration: refundData.refund_finish_duration,
    refund_finish_rate: refundData.refund_finish_rate,
    dispute_refund_rate: refundData.dispute_refund_rate,
  };
  mergeShopRecordDailyRowPatch(row);
  savedLocal = true;
  sendLog(PREFIX + ' 已写入本地 ' + row.report_at + '：店铺评分 + 退款指标');
}

if (isUserRatePage()) {
  window.addEventListener('shop-record-refund-data', function (ev) {
    handleRefundDataFromBridge(ev && ev.detail ? ev.detail : null);
  });

  var extracted = false;
  function tick() {
    if (!extracted && tryLogShopScores()) extracted = true;
  }
  tick();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick);
  var poll = setInterval(function () {
    tick();
    if (extracted) clearInterval(poll);
  }, 400);
  try {
    var obs = new MutationObserver(tick);
    obs.observe(document.documentElement, { childList: true, subtree: true });
  } catch {
    /* ignore */
  }
}
