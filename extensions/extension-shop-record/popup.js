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
  var logsListEl = document.getElementById("logs-list");
  var logsClearBtn = document.getElementById("logs-clear");
  var shopRateOpenBtn = document.getElementById("shop-rate-open");
  var alimamaOpenBtn = document.getElementById("alimama-open");
  var onebpOpenBtn = document.getElementById("onebp-open");
  var onebpDisplayOpenBtn = document.getElementById("onebp-display-open");

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

  loadLogs();
  if (logsClearBtn) logsClearBtn.addEventListener("click", clearLogs);

  var refreshInterval = null;
  function startLogPoll() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadLogs, 2000);
  }
  function stopLogPoll() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = null;
  }
  window.addEventListener("focus", function () {
    loadLogs();
    startLogPoll();
  });
  window.addEventListener("blur", stopLogPoll);
  startLogPoll();
})();
