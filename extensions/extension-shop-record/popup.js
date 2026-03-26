/**
 * Popup：扩展日志展示
 */
(function () {
  var logger = typeof __SHOP_RECORD_LOGGER__ !== "undefined" ? __SHOP_RECORD_LOGGER__ : null;
  var defaults =
    typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" ? __SHOP_RECORD_DEFAULTS__ : null;
  var shopRateUrl =
    defaults && defaults.SHOP_RATE_PAGE_URL
      ? defaults.SHOP_RATE_PAGE_URL
      : "https://rate.taobao.com/user-rate-UvCIYvCxbMCcGvmHuvQTT.htm?spm=a1z10.1-b.d4918101.1.7b716fe7xfRnm3";
  var alimamaUrl =
    defaults && defaults.ALIMAMA_DASHBOARD_URL
      ? defaults.ALIMAMA_DASHBOARD_URL
      : "https://ad.alimama.com/portal/v2/dashboard.htm";
  var sycmMySpaceUrl =
    defaults && defaults.SYCM_MY_SPACE_URL
      ? defaults.SYCM_MY_SPACE_URL
      : "https://sycm.taobao.com/adm/v3/my_space?_old_module_code_=adm-eportal-order-experience-transit&_old_module_expiration_=1773970265356&activeKey=common&tab=fetch";
  var reportSubmitPageUrl =
    defaults && defaults.REPORT_SUBMIT_PAGE_URL
      ? defaults.REPORT_SUBMIT_PAGE_URL
      : "https://oa1.ilanhe.com:8088/spa/workflow/static4form/index.html?_rdm=1774403128141#/main/workflow/req?iscreate=1&workflowid=1663&isagent=0&beagenter=0&f_weaver_belongto_userid=&f_weaver_belongto_usertype=0&menuIds=1,12&menuPathIds=1,12&preloadkey=1774403128141&timestamp=1774403128141&_key=ldyx2e";
  function yesterdayYmd() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1);
    var da = String(d.getDate());
    return (
      y +
      "-" +
      (mo.length < 2 ? "0" + mo : mo) +
      "-" +
      (da.length < 2 ? "0" + da : da)
    );
  }
  function buildOnebpSearchUrl() {
    var ymd = yesterdayYmd();
    return (
      "https://one.alimama.com/index.html#!/manage/search?mx_bizCode=onebpSearch&bizCode=onebpSearch&tab=campaign&startTime=" +
      ymd +
      "&endTime=" +
      ymd
    );
  }
  function buildOnebpDisplayUrl() {
    var ymd = yesterdayYmd();
    return (
      "https://one.alimama.com/index.html#!/manage/display?mx_bizCode=onebpDisplay&bizCode=onebpDisplay&tab=campaign&startTime=" +
      ymd +
      "&endTime=" +
      ymd
    );
  }
  /** 万象台无界·全站推广（startTime/endTime 为昨天，与万象台1/2 一致） */
  function buildOnebpSiteUrl() {
    var ymd = yesterdayYmd();
    return (
      "https://one.alimama.com/index.html#!/manage/onesite?mx_bizCode=onebpSite&bizCode=onebpSite&tab=campaign&startTime=" +
      ymd +
      "&endTime=" +
      ymd +
      "&effectEqual=15&unifyType=last_click_by_effect_time"
    );
  }
  /** 万象4·短视频（startTime/endTime 为昨天） */
  function buildOnebpShortVideoUrl() {
    var ymd = yesterdayYmd();
    return (
      "https://one.alimama.com/index.html#!/manage/content?mx_bizCode=onebpShortVideo&bizCode=onebpShortVideo&tab=campaign&startTime=" +
      ymd +
      "&endTime=" +
      ymd +
      "&unifyType=video_kuan"
    );
  }
  /** 与上方各入口一致：店铺分 → 淘宝联盟 → 万象1～4 → 千牛后台 → 上报页 */
  function getAllPageUrls() {
    return [
      shopRateUrl,
      alimamaUrl,
      buildOnebpSearchUrl(),
      buildOnebpDisplayUrl(),
      buildOnebpSiteUrl(),
      buildOnebpShortVideoUrl(),
      sycmMySpaceUrl,
      reportSubmitPageUrl
    ];
  }

  var shopRecordMainInited = false;

  function initShopRecordMain() {
    if (shopRecordMainInited) return;
    shopRecordMainInited = true;

  var logsListEl = document.getElementById("logs-list");
  var logsClearBtn = document.getElementById("logs-clear");
  var openAllPagesBtn = document.getElementById("open-all-pages");
  var shopRateOpenBtn = document.getElementById("shop-rate-open");
  var alimamaOpenBtn = document.getElementById("alimama-open");
  var onebpOpenBtn = document.getElementById("onebp-open");
  var onebpDisplayOpenBtn = document.getElementById("onebp-display-open");
  var onebpSiteOpenBtn = document.getElementById("onebp-site-open");
  var onebpShortVideoOpenBtn = document.getElementById("onebp-shortvideo-open");
  var sycmMySpaceOpenBtn = document.getElementById("sycm-my-space-open");
  var reportSubmitOpenBtn = document.getElementById("report-submit-open");
  var metricsDateEl = document.getElementById("metrics-date");
  var shopRecordBodyEl = document.getElementById("shop-record-body");
  var dailyLocalClearBtn = document.getElementById("daily-local-clear");
  var reportSubmitFillBtn = document.getElementById("report-submit-fill");
  var PREFIX =
    defaults && defaults.PREFIX ? defaults.PREFIX : "[店铺记录数据]";
  var FILL_REPORT_PAGE_MSG =
    defaults && defaults.RUNTIME && defaults.RUNTIME.FILL_REPORT_PAGE_MESSAGE
      ? defaults.RUNTIME.FILL_REPORT_PAGE_MESSAGE
      : "SR_FILL_REPORT_PAGE";
  var STORAGE_DAILY =
    defaults && defaults.STORAGE_KEYS && defaults.STORAGE_KEYS.dailyLocalByDate
      ? defaults.STORAGE_KEYS.dailyLocalByDate
      : "shop_record_daily_local_by_date";

  /**
   * 主内容两列：左（推广/店铺服务）右（流量与转化），与后台常见布局一致。
   * placeholder: zero 显示 0；dash 显示 —；无 key 且无 placeholder 视为空行占位（不渲染）
   */
  var METRIC_COL_LEFT = [
    { key: "item_desc_match_score", label: "宝贝与描述相符" },
    { key: "seller_service_score", label: "卖家服务态度" },
    { key: "seller_shipping_score", label: "卖家发货速度" },
    { key: "refund_finish_duration", label: "退款完结时长" },
    { key: "refund_finish_rate", label: "退款自主完结率" },
    { key: "dispute_refund_rate", label: "退款纠纷率" },
    { key: "taobao_cps_spend_yuan", label: "淘宝客花费（元）" },
    { key: "ztc_charge_yuan", label: "直通车花费（元）" },
    { key: "ztc_cvr", label: "直通车转化率" },
    { key: "ztc_ppc", label: "直通车PPC" },
    { key: "ztc_roi", label: "直通车ROI" },
    { key: "ylmf_charge_yuan", label: "引力魔方花费（元）" },
    { key: "ylmf_ppc", label: "引力魔方PPC" },
    { key: null, label: "抖音推广花费", placeholder: "zero" },
    { key: null, label: "超级直播花费", placeholder: "zero" },
    { key: "site_wide_charge_yuan", label: "全站推广花费（元）" },
    { key: "content_promo_charge_yuan", label: "内容推广花费（元）" },
    { key: null, label: "总推广花费", placeholder: "dash" }
  ];
  var METRIC_COL_RIGHT = [
    { key: "sycm_pv", label: "浏览量PV" },
    { key: "sycm_uv", label: "访客数UV" },
    { key: "sycm_pay_buyers", label: "支付买家数" },
    { key: "sycm_pay_items", label: "支付商品件数" },
    { key: "sycm_pay_amount", label: "支付金额（元）" },
    { key: "sycm_aov", label: "客单价（元）" },
    { key: "sycm_pay_cvr", label: "支付转化率" },
    { key: "sycm_old_visitor_ratio", label: "老访客数占比" },
    { key: "sycm_avg_stay_sec", label: "人均停留时长（秒）" },
    { key: "sycm_avg_pv_depth", label: "人均浏览量（访问深度）" },
    { key: "sycm_bounce_rate", label: "跳失率" },
    { key: "ylmf_cvr", label: "引力魔方转化率" },
    { key: "ylmf_roi", label: "引力魔方ROI" },
    { key: null, label: "品销宝花费", placeholder: "zero" },
    { key: null, label: "钻展花费", placeholder: "zero" },
    { key: "site_wide_roi", label: "全站推广ROI" },
    { key: "content_promo_roi", label: "内容推广ROI" },
    { key: null, label: "推广占比", placeholder: "dash" }
  ];

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatMetricCell(snap, item) {
    if (!item) return "—";
    if (item.placeholder === "zero") {
      return "0";
    }
    if (item.placeholder === "dash") {
      return "—";
    }
    if (!item.key) {
      return "—";
    }
    var raw = snap[item.key];
    var has =
      raw !== undefined &&
      raw !== null &&
      String(raw).replace(/\s/g, "") !== "";
    return has ? escHtml(String(raw)) : "—";
  }

  function renderDailyMetrics(snap) {
    if (!shopRecordBodyEl) return;
    var dateLabel = snap && snap.report_at ? String(snap.report_at) : yesterdayYmd();
    if (metricsDateEl) {
      metricsDateEl.textContent = dateLabel;
    }
    if (!snap || typeof snap !== "object") {
      shopRecordBodyEl.innerHTML =
        '<div class="popup-findpage-list--empty">暂无本地快照。各页采集到数据后会自动写入本地。</div>';
      return;
    }
    var n = Math.max(METRIC_COL_LEFT.length, METRIC_COL_RIGHT.length);
    var parts = [];
    var i;
    for (i = 0; i < n; i++) {
      var left = METRIC_COL_LEFT[i];
      var right = METRIC_COL_RIGHT[i];
      var zebra = i % 2 === 0 ? "popup-metric-grid-row--zebra-a" : "popup-metric-grid-row--zebra-b";
      parts.push(
        '<div class="popup-metric-grid-row ' +
        zebra +
        '">' +
        '<span class="popup-metric-cell popup-metric-cell--label">' +
        (left && left.label ? escHtml(left.label) : "") +
        "</span>" +
        '<span class="popup-metric-cell popup-metric-cell--value">' +
        formatMetricCell(snap, left) +
        "</span>" +
        '<span class="popup-metric-cell popup-metric-cell--spacer" aria-hidden="true"></span>' +
        '<span class="popup-metric-cell popup-metric-cell--label">' +
        (right && right.label ? escHtml(right.label) : "") +
        "</span>" +
        '<span class="popup-metric-cell popup-metric-cell--value">' +
        formatMetricCell(snap, right) +
        "</span>" +
        "</div>"
      );
    }
    shopRecordBodyEl.innerHTML =
      '<div class="popup-metrics-grid" role="table" aria-label="本地合并指标">' +
      parts.join("") +
      "</div>";
  }

  function loadDailySnapshot() {
    if (!shopRecordBodyEl || typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      return;
    }
    chrome.storage.local.get([STORAGE_DAILY], function (result) {
      if (chrome.runtime && chrome.runtime.lastError) return;
      var bag = result[STORAGE_DAILY];
      var ymd = yesterdayYmd();
      var snap = null;
      if (bag && typeof bag === "object" && bag[ymd]) {
        snap = bag[ymd];
      } else if (bag && typeof bag === "object") {
        var dates = Object.keys(bag).filter(function (k) {
          return /^\d{4}-\d{2}-\d{2}$/.test(k);
        });
        dates.sort();
        if (dates.length) snap = bag[dates[dates.length - 1]];
      }
      renderDailyMetrics(snap);
    });
  }

  if (openAllPagesBtn && typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
    openAllPagesBtn.addEventListener("click", function () {
      getAllPageUrls().forEach(function (url) {
        chrome.tabs.create({ url: url });
      });
    });
  }
  if (shopRateOpenBtn && typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
    shopRateOpenBtn.addEventListener("click", function () {
      chrome.tabs.create({ url: shopRateUrl });
    });
  }
  if (alimamaOpenBtn && typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
    alimamaOpenBtn.addEventListener("click", function () {
      chrome.tabs.create({ url: alimamaUrl });
    });
  }
  if (onebpOpenBtn && typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
    onebpOpenBtn.addEventListener("click", function () {
      chrome.tabs.create({ url: buildOnebpSearchUrl() });
    });
  }
  if (onebpDisplayOpenBtn && typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
    onebpDisplayOpenBtn.addEventListener("click", function () {
      chrome.tabs.create({ url: buildOnebpDisplayUrl() });
    });
  }
  if (onebpSiteOpenBtn && typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
    onebpSiteOpenBtn.addEventListener("click", function () {
      chrome.tabs.create({ url: buildOnebpSiteUrl() });
    });
  }
  if (onebpShortVideoOpenBtn && typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
    onebpShortVideoOpenBtn.addEventListener("click", function () {
      chrome.tabs.create({ url: buildOnebpShortVideoUrl() });
    });
  }
  if (sycmMySpaceOpenBtn && typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
    sycmMySpaceOpenBtn.addEventListener("click", function () {
      chrome.tabs.create({ url: sycmMySpaceUrl });
    });
  }
  if (reportSubmitOpenBtn && typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
    reportSubmitOpenBtn.addEventListener("click", function () {
      chrome.tabs.create({ url: reportSubmitPageUrl });
    });
  }
  if (reportSubmitFillBtn && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
    reportSubmitFillBtn.addEventListener("click", function () {
      runReportSubmitFillAfterPermission();
    });
  }

  function runReportSubmitFillAfterPermission() {
    if (
      !defaults ||
      typeof defaults.pickSnapshotFromDailyBag !== "function" ||
      typeof defaults.validateReportSnapshotForFill !== "function"
    ) {
      if (logger) {
        logger.warn(PREFIX + " 自动填充已取消：无法校验本地数据（defaults 未就绪）");
      }
      loadLogs();
      return;
    }
    if (!chrome.storage || !chrome.storage.local) {
      if (logger) {
        logger.warn(PREFIX + " 自动填充已取消：无法读取本地存储");
      }
      loadLogs();
      return;
    }
    chrome.storage.local.get([STORAGE_DAILY], function (result) {
        if (chrome.runtime && chrome.runtime.lastError) {
          if (logger) {
            logger.warn(
              PREFIX + " 自动填充已取消：读取本地数据失败 " + String(chrome.runtime.lastError.message)
            );
          }
          loadLogs();
          return;
        }
        var bag = result[STORAGE_DAILY];
        var snap = defaults.pickSnapshotFromDailyBag(bag);
        var vr = defaults.validateReportSnapshotForFill(snap);
        if (!vr.ok) {
          var miss = vr.missing || [];
          if (logger) {
            miss.forEach(function (m) {
              logger.warn(PREFIX + " 「" + m.label + "」数据未读取到，已拦截自动填充");
            });
            logger.warn(
              PREFIX + " 自动填充已取消：本地数据不完整（共 " + miss.length + " 项缺失）"
            );
          }
          loadLogs();
          return;
        }
        if (logger) {
          logger.log(PREFIX + " 已请求：向联核上报页自动填充本地数据…");
          loadLogs();
        }
        chrome.runtime.sendMessage({ type: FILL_REPORT_PAGE_MSG }, function (res) {
          if (chrome.runtime.lastError) {
            if (logger) {
              logger.warn(PREFIX + " 自动填充失败：" + String(chrome.runtime.lastError.message));
            }
          } else if (res && res.ok) {
            if (logger) {
              logger.log(
                PREFIX +
                " 自动填充成功：已写入 " +
                (res.filled != null ? res.filled : "?") +
                " 项（统计日 " +
                (res.reportAt || "") +
                "）"
              );
            }
          } else {
            if (logger) {
              var errMsg =
                res && res.error === "incomplete_data"
                  ? "本地数据不完整（共 " + (res.missingCount != null ? res.missingCount : "?") + " 项缺失）"
                  : res && res.error
                    ? String(res.error)
                    : "未知原因（请确认上报页已加载）";
              logger.warn(PREFIX + " 自动填充未完成：" + errMsg);
            }
          }
          loadLogs();
        });
    });
  }

  function formatLogTime(isoStr) {
    if (!isoStr) return "";
    try {
      var d = new Date(isoStr);
      var pad = function (n) {
        return (n < 10 ? "0" : "") + n;
      };
      return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    } catch (e) {
      return "";
    }
  }

  function renderLogs(entries) {
    if (!logsListEl) return;
    var el = logsListEl;
    var wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    if (!Array.isArray(entries) || entries.length === 0) {
      el.innerHTML = '<div class="popup-logs-empty">暂无日志</div>';
      return;
    }
    el.innerHTML = entries
      .map(function (entry) {
        var level = entry.level || "log";
        var time = formatLogTime(entry.t);
        var msg = (entry.msg != null ? String(entry.msg) : "")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>");
        return (
          '<div class="popup-log-card popup-log-entry popup-log-entry--' +
          level +
          '"><span class="popup-log-time">' +
          time +
          "</span>" +
          msg +
          "</div>"
        );
      })
      .join("");
    if (wasAtBottom) el.scrollTop = el.scrollHeight;
  }

  function getActiveTabId(callback) {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var id = tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
        callback(id);
      });
    } catch (e) {
      callback(null);
    }
  }

  function loadLogs() {
    if (!logger) return;
    getActiveTabId(function (tabId) {
      logger.getLogs(renderLogs, tabId);
    });
  }

  function clearLogs() {
    if (!logger || !logsClearBtn) return;
    getActiveTabId(function (tabId) {
      logger.clearLogs(function () {
        loadLogs();
      }, tabId);
    });
  }

  function clearDailyLocalSnapshot() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.remove(STORAGE_DAILY, function () {
      if (chrome.runtime && chrome.runtime.lastError) return;
      loadDailySnapshot();
    });
  }

  loadLogs();
  loadDailySnapshot();
  if (logsClearBtn) logsClearBtn.addEventListener("click", clearLogs);
  if (dailyLocalClearBtn) dailyLocalClearBtn.addEventListener("click", clearDailyLocalSnapshot);

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local" || !changes[STORAGE_DAILY]) return;
      loadDailySnapshot();
    });
  }

  var refreshInterval = null;
  function startLogPoll() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(function () {
      loadLogs();
      loadDailySnapshot();
    }, 2000);
  }
  function stopLogPoll() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = null;
  }
  window.addEventListener("focus", function () {
    loadLogs();
    loadDailySnapshot();
    startLogPoll();
  });
  window.addEventListener("blur", stopLogPoll);
  startLogPoll();

  window.__SHOP_RECORD_POPUP_REFRESH__ = function () {
    loadLogs();
    loadDailySnapshot();
  };
  }


  initShopRecordMain();
})();
