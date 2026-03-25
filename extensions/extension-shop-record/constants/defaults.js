/**
 * 店铺记录数据：storage 键与日志前缀
 */
(function (global) {
  var STORAGE_KEYS = {
    logs: "shop_record_logs",
    logsByTab: "shop_record_logs_by_tab",
    /** 按日合并的 shop_record_daily 本地快照 { [yyyy-mm-dd]: { ...columns } } */
    dailyLocalByDate: "shop_record_daily_local_by_date"
  };
  var LOG_MAX_ENTRIES = 100;
  var PREFIX = "[店铺记录数据]";
  /** 店铺半年内动态评分页（用户信用评价页） */
  var SHOP_RATE_PAGE_URL =
    "https://rate.taobao.com/user-rate-UvCIYvCxbMCcGvmHuvQTT.htm?spm=a1z10.1-b.d4918101.1.7b716fe7xfRnm3";
  /** 淘宝联盟·商家中心仪表盘 */
  var ALIMAMA_DASHBOARD_URL = "https://ad.alimama.com/portal/v2/dashboard.htm";
  /** 生意参谋·个人空间（千牛后台入口，打开后由 content-sycm 请求 previewById） */
  var SYCM_MY_SPACE_URL =
    "https://sycm.taobao.com/adm/v3/my_space?_old_module_code_=adm-eportal-order-experience-transit&_old_module_expiration_=1773970265356&activeKey=common&tab=fetch";
  /** 联核 OA 上报页（popup「上报页」按钮；须带完整参数否则会跳到其它页） */
  var REPORT_SUBMIT_PAGE_URL =
    "https://oa1.ilanhe.com:8088/spa/workflow/static4form/index.html?_rdm=1774403128141#/main/workflow/req?iscreate=1&workflowid=1663&isagent=0&beagenter=0&f_weaver_belongto_userid=&f_weaver_belongto_usertype=0&menuIds=1,12&menuPathIds=1,12&preloadkey=1774403128141&timestamp=1774403128141&_key=ldyx2e";
  /**
   * 万象台无界·关键词推广（startTime/endTime 由 popup 按「昨天」拼接）
   * 基址：https://one.alimama.com/index.html#!/manage/search?mx_bizCode=onebpSearch&bizCode=onebpSearch&tab=campaign&startTime=&endTime=
   * 万象3（全站）：#!/manage/onesite?...&effectEqual=15&unifyType=last_click_by_effect_time
   * 万象4（短视频）：#!/manage/content?...&unifyType=video_kuan
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
    ONE_ALIMAMA_HOST: ONE_ALIMAMA_HOST,
    SYCM_MY_SPACE_URL: SYCM_MY_SPACE_URL,
    REPORT_SUBMIT_PAGE_URL: REPORT_SUBMIT_PAGE_URL
  };
  (typeof globalThis !== "undefined" ? globalThis : global).__SHOP_RECORD_DEFAULTS__ = obj;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
