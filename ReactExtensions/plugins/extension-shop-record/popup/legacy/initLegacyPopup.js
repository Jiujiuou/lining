import {
  yesterdayYmd as sharedYesterdayYmd,
  buildOnebpSearchUrl as sharedBuildOnebpSearchUrl,
  buildOnebpDisplayUrl as sharedBuildOnebpDisplayUrl,
  buildOnebpSiteUrl as sharedBuildOnebpSiteUrl,
  buildOnebpShortVideoUrl as sharedBuildOnebpShortVideoUrl,
  getAllPageUrls as sharedGetAllPageUrls,
} from '@/popup/utils/urlUtils.js';
import { buildDailyMetricsHtml, pickDailySnapshotFromBag } from '@/popup/utils/metricsUtils.js';

export function initLegacyPopup() {
  if (globalThis.__LINING_SHOP_RECORD_POPUP__) return;
  globalThis.__LINING_SHOP_RECORD_POPUP__ = true;
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
  /** 与上方各入口一致：店铺分 → 淘宝联盟 → 万象1～4 → 千牛后台 → 上报页 */
  function getAllPageUrls() {
    return sharedGetAllPageUrls({
      shopRateUrl: shopRateUrl,
      alimamaUrl: alimamaUrl,
      sycmMySpaceUrl: sycmMySpaceUrl,
      reportSubmitPageUrl: reportSubmitPageUrl
    });
  }

  var shopRecordMainInited = false;

  function initShopRecordMain() {
    if (shopRecordMainInited) return;
    shopRecordMainInited = true;

  var logsListEl = document.getElementById("logs-list");
  var metricsDateEl = document.getElementById("metrics-date");
  var shopRecordBodyEl = document.getElementById("shop-record-body");
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

  function renderDailyMetrics(snap) {
    if (!shopRecordBodyEl) return;
    var dateLabel = snap && snap.report_at ? String(snap.report_at) : sharedYesterdayYmd();
    if (metricsDateEl) {
      metricsDateEl.textContent = dateLabel;
    }
    shopRecordBodyEl.innerHTML = buildDailyMetricsHtml(snap);
  }

  function loadDailySnapshot() {
    if (!shopRecordBodyEl || typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      return;
    }
    chrome.storage.local.get([STORAGE_DAILY], function (result) {
      if (chrome.runtime && chrome.runtime.lastError) return;
      var bag = result[STORAGE_DAILY];
      var snap = pickDailySnapshotFromBag(bag);
      renderDailyMetrics(snap);
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
    if (!logger) return;
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

  function handleStorageChanged(changes, area) {
    if (area !== "local" || !changes || !changes[STORAGE_DAILY]) return;
    loadDailySnapshot();
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

  function refreshOnFocus() {
    loadLogs();
    loadDailySnapshot();
    startLogPoll();
  }

  function refreshAll() {
    loadLogs();
    loadDailySnapshot();
  }

  function openAllPages() {
    getAllPageUrls().forEach(function (url) {
      chrome.tabs.create({ url: url });
    });
  }

  function openShopRate() {
    chrome.tabs.create({ url: shopRateUrl });
  }

  function openAlimama() {
    chrome.tabs.create({ url: alimamaUrl });
  }

  function openOnebpSearch() {
    chrome.tabs.create({ url: sharedBuildOnebpSearchUrl() });
  }

  function openOnebpDisplay() {
    chrome.tabs.create({ url: sharedBuildOnebpDisplayUrl() });
  }

  function openOnebpSite() {
    chrome.tabs.create({ url: sharedBuildOnebpSiteUrl() });
  }

  function openOnebpShortVideo() {
    chrome.tabs.create({ url: sharedBuildOnebpShortVideoUrl() });
  }

  function openSycmMySpace() {
    chrome.tabs.create({ url: sycmMySpaceUrl });
  }

  function openReportSubmit() {
    chrome.tabs.create({ url: reportSubmitPageUrl });
  }

  function fillReportSubmit() {
    runReportSubmitFillAfterPermission();
  }

  globalThis.__SHOP_RECORD_POPUP_RUNTIME__ = {
    refreshAll: refreshAll,
    refreshLogs: loadLogs,
    handleStorageChanged: handleStorageChanged,
    clearLogs: clearLogs,
    clearDailyLocalSnapshot: clearDailyLocalSnapshot,
    openAllPages: openAllPages,
    openShopRate: openShopRate,
    openAlimama: openAlimama,
    openOnebpSearch: openOnebpSearch,
    openOnebpDisplay: openOnebpDisplay,
    openOnebpSite: openOnebpSite,
    openOnebpShortVideo: openOnebpShortVideo,
    openSycmMySpace: openSycmMySpace,
    openReportSubmit: openReportSubmit,
    fillReportSubmit: fillReportSubmit,
    refreshOnFocus: refreshOnFocus,
    startAutoRefresh: startLogPoll,
    stopAutoRefresh: stopLogPoll,
  };

  }


  initShopRecordMain();
})();

}






