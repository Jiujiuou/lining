import { mergeDatePatch } from '../shared/chrome/date-bag.js';

export const MESSAGE_TYPES = {
  GET_TAB_ID: 'SR_GET_TAB_ID',
  CONTENT_APPEND_LOG: 'shopRecordAppendLog',
  FILL_REPORT_PAGE: 'SR_FILL_REPORT_PAGE',
  CONTENT_FILL_REPORT: 'SR_FILL_REPORT',
};

export const STORAGE_KEYS = {
  logs: 'shop_record_logs',
  logsByTab: 'shop_record_logs_by_tab',
  dailyLocalByDate: 'shop_record_daily_local_by_date',
};

export const LOG_MAX_ENTRIES = 20;
export const LOG_MAX_TABS = 6;
export const PREFIX = '[店铺记录数据]';
export const SHOP_RATE_PAGE_URL =
  'https://rate.taobao.com/user-rate-UvCIYvCxbMCcGvmHuvQTT.htm?spm=a1z10.1-b.d4918101.1.7b716fe7xfRnm3';
export const ALIMAMA_DASHBOARD_URL = 'https://ad.alimama.com/portal/v2/dashboard.htm';
export const ONE_ALIMAMA_HOST = 'https://one.alimama.com';
export const SYCM_MY_SPACE_URL =
  'https://sycm.taobao.com/adm/v3/my_space?_old_module_code_=adm-eportal-order-experience-transit&_old_module_expiration_=1773970265356&activeKey=common&tab=fetch';
export const REPORT_SUBMIT_PAGE_URL =
  'https://oa1.ilanhe.com:8088/spa/workflow/static4form/index.html?_rdm=1774403128141#/main/workflow/req?iscreate=1&workflowid=1663&isagent=0&beagenter=0&f_weaver_belongto_userid=&f_weaver_belongto_usertype=0&menuIds=1,12&menuPathIds=1,12&preloadkey=1774403128141&timestamp=1774403128141&_key=ldyx2e';

export const REPORT_FILL_REQUIRED = [
  { key: 'item_desc_match_score', label: '宝贝与描述相符' },
  { key: 'sycm_pv', label: '浏览量PV' },
  { key: 'seller_service_score', label: '卖家服务态度' },
  { key: 'sycm_uv', label: '访客数UV' },
  { key: 'seller_shipping_score', label: '卖家发货速度' },
  { key: 'sycm_pay_buyers', label: '支付买家数' },
  { key: 'refund_finish_duration', label: '退款完结时长' },
  { key: 'sycm_pay_items', label: '支付商品件数' },
  { key: 'refund_finish_rate', label: '退款自主完结率' },
  { key: 'sycm_pay_amount', label: '支付金额（元）' },
  { key: 'dispute_refund_rate', label: '退款纠纷率' },
  { key: 'sycm_aov', label: '客单价（元）' },
  { key: 'taobao_cps_spend_yuan', label: '淘宝客花费（元）' },
  { key: 'sycm_pay_cvr', label: '支付转化率' },
  { key: 'ztc_charge_yuan', label: '直通车花费（元）' },
  { key: 'sycm_old_visitor_ratio', label: '老访客数占比' },
  { key: 'ztc_cvr', label: '直通车转化率' },
  { key: 'sycm_avg_stay_sec', label: '人均停留时长（秒）' },
  { key: 'ztc_ppc', label: '直通车PPC' },
  { key: 'sycm_avg_pv_depth', label: '人均浏览量（访问深度）' },
  { key: 'ztc_roi', label: '直通车ROI' },
  { key: 'sycm_bounce_rate', label: '跳失率' },
  { key: 'ylmf_charge_yuan', label: '引力魔方花费（元）' },
  { key: 'ylmf_cvr', label: '引力魔方转化率' },
  { key: 'ylmf_ppc', label: '引力魔方PPC' },
  { key: 'ylmf_roi', label: '引力魔方ROI' },
  { key: 'site_wide_charge_yuan', label: '全站推广花费（元）' },
  { key: 'site_wide_roi', label: '全站推广ROI' },
  { key: 'content_promo_charge_yuan', label: '内容推广花费（元）' },
  { key: 'content_promo_roi', label: '内容推广ROI' },
];

const LOCAL_DAILY_MAX_DAYS = 3;

export function mergeShopRecordDailyRowPatch(patch, done) {
  if (!patch || typeof patch !== 'object' || !patch.report_at) {
    if (typeof done === 'function') done();
    return;
  }

  mergeDatePatch(STORAGE_KEYS.dailyLocalByDate, String(patch.report_at), patch, {
    maxDays: LOCAL_DAILY_MAX_DAYS,
    done,
  });
}

export function pickSnapshotFromDailyBag(bag) {
  if (!bag || typeof bag !== 'object') return null;
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const target = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  if (bag[target]) return bag[target];
  const dates = Object.keys(bag).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)).sort();
  return dates.length > 0 ? bag[dates[dates.length - 1]] : null;
}

export function validateReportSnapshotForFill(snapshot) {
  const missing = [];

  if (!snapshot || typeof snapshot !== 'object') {
    return {
      ok: false,
      missing: REPORT_FILL_REQUIRED.map((item) => ({ key: item.key, label: item.label })),
    };
  }

  for (const item of REPORT_FILL_REQUIRED) {
    const rawValue = snapshot[item.key];
    if (rawValue === undefined || rawValue === null || String(rawValue).replace(/\s/g, '') === '') {
      missing.push({ key: item.key, label: item.label });
    }
  }

  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

export const SHOP_RECORD_DEFAULTS = {
  STORAGE_KEYS,
  LOG_MAX_ENTRIES,
  LOG_MAX_TABS,
  PREFIX,
  SHOP_RATE_PAGE_URL,
  ALIMAMA_DASHBOARD_URL,
  ONE_ALIMAMA_HOST,
  SYCM_MY_SPACE_URL,
  REPORT_SUBMIT_PAGE_URL,
  REPORT_FILL_REQUIRED,
  mergeShopRecordDailyRowPatch,
  pickSnapshotFromDailyBag,
  validateReportSnapshotForFill,
  RUNTIME: {
    GET_TAB_ID_MESSAGE: MESSAGE_TYPES.GET_TAB_ID,
    CONTENT_APPEND_LOG_MESSAGE: MESSAGE_TYPES.CONTENT_APPEND_LOG,
    FILL_REPORT_PAGE_MESSAGE: MESSAGE_TYPES.FILL_REPORT_PAGE,
    CONTENT_FILL_REPORT_MESSAGE: MESSAGE_TYPES.CONTENT_FILL_REPORT,
  },
};
