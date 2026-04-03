export const STORAGE_KEYS = {
  logs: 'ou_userdata_logs',
  logsByTab: 'ou_userdata_logs_by_tab',
  formByTab: 'ou_userdata_form_by_tab',
};

export const LOG_MAX_ENTRIES = 20;
export const LOG_MAX_TABS = 6;
export const FORM_MAX_TABS = 4;
export const PREFIX = '[订单用户数据导出]';
export const SOLD_PAGE_URL = 'https://qn.taobao.com/home.htm/trade-platform/tp/sold';
export const QN_OR_TRADE_REG = /^https:\/\/(qn\.taobao\.com|trade\.taobao\.com)\//;

export const ORDER_STATUS_TO_TAB = {
  SUCCESS: 'success',
  NOT_PAID: 'waitBuyerPay',
  PAID: 'waitSend',
  SEND: 'haveSendGoods',
  DROP: 'closed',
  ALL: 'success',
};
