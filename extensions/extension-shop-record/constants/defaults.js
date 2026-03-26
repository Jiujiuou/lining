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
  var LOG_MAX_ENTRIES = 20;
  var LOG_MAX_TABS = 6;
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
    CONTENT_APPEND_LOG_MESSAGE: "shopRecordAppendLog",
    /** popup → background：请求向联核 OA 上报页填充本地快照 */
    FILL_REPORT_PAGE_MESSAGE: "SR_FILL_REPORT_PAGE",
    /** background → content-report-submit：执行填充 */
    CONTENT_FILL_REPORT_MESSAGE: "SR_FILL_REPORT"
  };

  /**
   * 联核上报「自动填充」必填：与 utils/report-page-fill.js 中 FIELD_MAP + MORE_FIELDS 一致，每项须非空才允许填充。
   */
  var REPORT_FILL_REQUIRED = [
    { key: "item_desc_match_score", label: "宝贝与描述相符" },
    { key: "sycm_pv", label: "浏览量PV" },
    { key: "seller_service_score", label: "卖家服务态度" },
    { key: "sycm_uv", label: "访客数UV" },
    { key: "seller_shipping_score", label: "卖家发货速度" },
    { key: "sycm_pay_buyers", label: "支付买家数" },
    { key: "refund_finish_duration", label: "退款完结时长" },
    { key: "sycm_pay_items", label: "支付商品件数" },
    { key: "refund_finish_rate", label: "退款自主完结率" },
    { key: "sycm_pay_amount", label: "支付金额（元）" },
    { key: "dispute_refund_rate", label: "退款纠纷率" },
    { key: "sycm_aov", label: "客单价（元）" },
    { key: "taobao_cps_spend_yuan", label: "淘宝客花费（元）" },
    { key: "sycm_pay_cvr", label: "支付转化率" },
    { key: "ztc_charge_yuan", label: "直通车花费（元）" },
    { key: "sycm_old_visitor_ratio", label: "老访客数占比" },
    { key: "ztc_cvr", label: "直通车转化率" },
    { key: "sycm_avg_stay_sec", label: "人均停留时长（秒）" },
    { key: "ztc_ppc", label: "直通车PPC" },
    { key: "sycm_avg_pv_depth", label: "人均浏览量（访问深度）" },
    { key: "ztc_roi", label: "直通车ROI" },
    { key: "sycm_bounce_rate", label: "跳失率" },
    { key: "ylmf_charge_yuan", label: "引力魔方花费（元）" },
    { key: "ylmf_cvr", label: "引力魔方转化率" },
    { key: "ylmf_ppc", label: "引力魔方PPC" },
    { key: "ylmf_roi", label: "引力魔方ROI" },
    { key: "site_wide_charge_yuan", label: "全站推广花费（元）" },
    { key: "site_wide_roi", label: "全站推广ROI" },
    { key: "content_promo_charge_yuan", label: "内容推广花费（元）" },
    { key: "content_promo_roi", label: "内容推广ROI" }
  ];

  function yesterdayYmdForSnapshot() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1);
    var da = String(d.getDate());
    return y + "-" + (mo.length < 2 ? "0" + mo : mo) + "-" + (da.length < 2 ? "0" + da : da);
  }

  function pickSnapshotFromDailyBag(bag) {
    if (!bag || typeof bag !== "object") return null;
    var ymd = yesterdayYmdForSnapshot();
    if (bag[ymd]) return bag[ymd];
    var dates = Object.keys(bag).filter(function (k) {
      return /^\d{4}-\d{2}-\d{2}$/.test(k);
    });
    dates.sort();
    return dates.length ? bag[dates[dates.length - 1]] : null;
  }

  /**
   * @param {Object|null} snap 单日合并快照
   * @returns {{ ok: true } | { ok: false, missing: Array<{ key: string, label: string }> }}
   */
  function validateReportSnapshotForFill(snap) {
    var missing = [];
    if (!snap || typeof snap !== "object") {
      for (var j = 0; j < REPORT_FILL_REQUIRED.length; j++) {
        missing.push({
          key: REPORT_FILL_REQUIRED[j].key,
          label: REPORT_FILL_REQUIRED[j].label
        });
      }
      return { ok: false, missing: missing };
    }
    for (var i = 0; i < REPORT_FILL_REQUIRED.length; i++) {
      var row = REPORT_FILL_REQUIRED[i];
      var raw = snap[row.key];
      var has =
        raw !== undefined &&
        raw !== null &&
        String(raw).replace(/\s/g, "") !== "";
      if (!has) {
        missing.push({ key: row.key, label: row.label });
      }
    }
    if (missing.length === 0) return { ok: true };
    return { ok: false, missing: missing };
  }

  var obj = {
    STORAGE_KEYS: STORAGE_KEYS,
    LOG_MAX_ENTRIES: LOG_MAX_ENTRIES,
    LOG_MAX_TABS: LOG_MAX_TABS,
    PREFIX: PREFIX,
    RUNTIME: RUNTIME,
    SHOP_RATE_PAGE_URL: SHOP_RATE_PAGE_URL,
    ALIMAMA_DASHBOARD_URL: ALIMAMA_DASHBOARD_URL,
    ONE_ALIMAMA_HOST: ONE_ALIMAMA_HOST,
    SYCM_MY_SPACE_URL: SYCM_MY_SPACE_URL,
    REPORT_SUBMIT_PAGE_URL: REPORT_SUBMIT_PAGE_URL,
    REPORT_FILL_REQUIRED: REPORT_FILL_REQUIRED,
    pickSnapshotFromDailyBag: pickSnapshotFromDailyBag,
    validateReportSnapshotForFill: validateReportSnapshotForFill
  };
  (typeof globalThis !== "undefined" ? globalThis : global).__SHOP_RECORD_DEFAULTS__ = obj;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
