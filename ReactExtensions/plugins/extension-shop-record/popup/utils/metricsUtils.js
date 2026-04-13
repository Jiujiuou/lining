import { yesterdayYmd } from '@/popup/utils/urlUtils.js';

export const METRIC_COL_LEFT = [
  { key: 'item_desc_match_score', label: '宝贝与描述相符' },
  { key: 'seller_service_score', label: '卖家服务态度' },
  { key: 'seller_shipping_score', label: '卖家发货速度' },
  { key: 'refund_finish_duration', label: '退款完结时长' },
  { key: 'refund_finish_rate', label: '退款自主完结率' },
  { key: 'dispute_refund_rate', label: '退款纠纷率' },
  { key: 'taobao_cps_spend_yuan', label: '淘宝客花费（元）' },
  { key: 'ztc_charge_yuan', label: '直通车花费（元）' },
  { key: 'ztc_cvr', label: '直通车转化率' },
  { key: 'ztc_ppc', label: '直通车PPC' },
  { key: 'ztc_roi', label: '直通车ROI' },
  { key: 'ylmf_charge_yuan', label: '引力魔方花费（元）' },
  { key: 'ylmf_ppc', label: '引力魔方PPC' },
  { key: null, label: '抖音推广花费', placeholder: 'zero' },
  { key: null, label: '超级直播花费', placeholder: 'zero' },
  { key: 'site_wide_charge_yuan', label: '全站推广花费（元）' },
  { key: 'content_promo_charge_yuan', label: '内容推广花费（元）' },
  { key: null, label: '总推广花费', placeholder: 'dash' },
];

export const METRIC_COL_RIGHT = [
  { key: 'sycm_pv', label: '浏览量PV' },
  { key: 'sycm_uv', label: '访客数UV' },
  { key: 'sycm_pay_buyers', label: '支付买家数' },
  { key: 'sycm_pay_items', label: '支付商品件数' },
  { key: 'sycm_pay_amount', label: '支付金额（元）' },
  { key: 'sycm_aov', label: '客单价（元）' },
  { key: 'sycm_pay_cvr', label: '支付转化率' },
  { key: 'sycm_old_visitor_ratio', label: '老访客数占比' },
  { key: 'sycm_avg_stay_sec', label: '人均停留时长（秒）' },
  { key: 'sycm_avg_pv_depth', label: '人均浏览量（访问深度）' },
  { key: 'sycm_bounce_rate', label: '跳失率' },
  { key: 'ylmf_cvr', label: '引力魔方转化率' },
  { key: 'ylmf_roi', label: '引力魔方ROI' },
  { key: null, label: '品销宝花费', placeholder: 'zero' },
  { key: null, label: '钻展花费', placeholder: 'zero' },
  { key: 'site_wide_roi', label: '全站推广ROI' },
  { key: 'content_promo_roi', label: '内容推广ROI' },
  { key: null, label: '推广占比', placeholder: 'dash' },
];

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatMetricCell(snap, item) {
  if (!item) return '—';
  if (item.placeholder === 'zero') return '0';
  if (item.placeholder === 'dash') return '—';
  if (!item.key) return '—';
  const raw = snap[item.key];
  const has = raw !== undefined && raw !== null && String(raw).replace(/\s/g, '') !== '';
  return has ? escHtml(String(raw)) : '—';
}

export function buildDailyMetricsHtml(snap) {
  if (!snap || typeof snap !== 'object') {
    return '<div class="popup-findpage-list--empty">暂无本地快照。各页采集到数据后会自动写入本地。</div>';
  }
  const n = Math.max(METRIC_COL_LEFT.length, METRIC_COL_RIGHT.length);
  const parts = [];
  for (let i = 0; i < n; i += 1) {
    const left = METRIC_COL_LEFT[i];
    const right = METRIC_COL_RIGHT[i];
    const zebra = i % 2 === 0 ? 'popup-metric-grid-row--zebra-a' : 'popup-metric-grid-row--zebra-b';
    parts.push(
      `<div class="popup-metric-grid-row ${zebra}">`
      + `<span class="popup-metric-cell popup-metric-cell--label">${left && left.label ? escHtml(left.label) : ''}</span>`
      + `<span class="popup-metric-cell popup-metric-cell--value">${formatMetricCell(snap, left)}</span>`
      + '<span class="popup-metric-cell popup-metric-cell--spacer" aria-hidden="true"></span>'
      + `<span class="popup-metric-cell popup-metric-cell--label">${right && right.label ? escHtml(right.label) : ''}</span>`
      + `<span class="popup-metric-cell popup-metric-cell--value">${formatMetricCell(snap, right)}</span>`
      + '</div>',
    );
  }
  return `<div class="popup-metrics-grid" role="table" aria-label="本地合并指标">${parts.join('')}</div>`;
}

export function pickDailySnapshotFromBag(bag) {
  const ymd = yesterdayYmd();
  if (bag && typeof bag === 'object' && bag[ymd]) {
    return bag[ymd];
  }
  if (bag && typeof bag === 'object') {
    const dates = Object.keys(bag).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));
    dates.sort();
    if (dates.length > 0) {
      return bag[dates[dates.length - 1]];
    }
  }
  return null;
}

