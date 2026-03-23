/**
 * 店铺记录数据：storage 键与日志前缀
 */
(function (global) {
  var STORAGE_KEYS = {
    logs: "shop_record_logs",
    logsByTab: "shop_record_logs_by_tab"
  };
  var LOG_MAX_ENTRIES = 100;
  var PREFIX = "[店铺记录数据]";
  /** 店铺半年内动态评分页（用户信用评价页） */
  var SHOP_RATE_PAGE_URL =
    "https://rate.taobao.com/user-rate-UvCIYvCxbMCcGvmHuvQTT.htm?spm=a1z10.1-b.d4918101.1.7b716fe7xfRnm3";
  /** 淘宝联盟·商家中心仪表盘 */
  var ALIMAMA_DASHBOARD_URL = "https://ad.alimama.com/portal/v2/dashboard.htm";
  /**
   * 万象台无界·关键词推广（startTime/endTime 由 popup 按「昨天」拼接）
   * 基址：https://one.alimama.com/index.html#!/manage/search?mx_bizCode=onebpSearch&bizCode=onebpSearch&tab=campaign&startTime=&endTime=
   */
  var ONE_ALIMAMA_HOST = "https://one.alimama.com";

  /** background / logger / sendMessage 共用 type，避免与 storage 键硬编码漂移（对齐 extension-template） */
  var RUNTIME = {
    GET_TAB_ID_MESSAGE: "SR_GET_TAB_ID",
    CONTENT_APPEND_LOG_MESSAGE: "shopRecordAppendLog"
  };

  var obj = {
    STORAGE_KEYS: STORAGE_KEYS,
    LOG_MAX_ENTRIES: LOG_MAX_ENTRIES,
    PREFIX: PREFIX,
    RUNTIME: RUNTIME,
    SHOP_RATE_PAGE_URL: SHOP_RATE_PAGE_URL,
    ALIMAMA_DASHBOARD_URL: ALIMAMA_DASHBOARD_URL,
    ONE_ALIMAMA_HOST: ONE_ALIMAMA_HOST
  };
  (typeof globalThis !== "undefined" ? globalThis : global).__SHOP_RECORD_DEFAULTS__ = obj;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
