/**
 * popup.js - 弹窗逻辑：节流粒度配置、扩展日志展示与清空
 */
(function () {
  var storage = typeof __SYCM_STORAGE__ !== 'undefined' ? __SYCM_STORAGE__ : null;
  var logger = typeof __SYCM_LOGGER__ !== 'undefined' ? __SYCM_LOGGER__ : null;
  var defaults = typeof __SYCM_DEFAULTS__ !== 'undefined' ? __SYCM_DEFAULTS__ : null;
  var throttleOptions = (defaults && defaults.DEFAULTS && defaults.DEFAULTS.THROTTLE_OPTIONS) ? defaults.DEFAULTS.THROTTLE_OPTIONS : [10, 20, 30, 60];
  var defaultThrottle = (defaults && defaults.DEFAULTS && defaults.DEFAULTS.THROTTLE_MINUTES) ? defaults.DEFAULTS.THROTTLE_MINUTES : 20;

  var throttleEl = document.getElementById('throttle');
  var logsListEl = document.getElementById('logs-list');
  var logsClearBtn = document.getElementById('logs-clear');
  var openSitesBtn = document.getElementById('open-sites');

  /** 东八区今天 YYYY-MM-DD */
  function getTodayEast8() {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  }

  function getSycmLinks() {
    var today = getTodayEast8();
    var dateRange = encodeURIComponent(today + '|' + today);
    return [
      'https://sycm.taobao.com/cc/item_rank?dateRange=' + dateRange + '&dateType=today',
      'https://sycm.taobao.com/cc/item_archives?activeKey=flow&dateRange=' + dateRange + '&dateType=today&itemId=1017849608938&spm=a21ag.23983127.0.4.62aa50a5f6Rd1C',
      'https://sycm.taobao.com/mc/free/market_rank?activeKey=item&dateRange=' + dateRange + '&dateType=today&parentCateId=201272600&cateId=50009211'
    ];
  }

  function openSites() {
    getSycmLinks().forEach(function (url) {
      chrome.tabs.create({ url: url });
    });
  }

  function formatLogTime(isoStr) {
    if (!isoStr) return '';
    try {
      var d = new Date(isoStr);
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    } catch (e) {
      return '';
    }
  }

  function renderLogs(entries) {
    if (!logsListEl) return;
    var el = logsListEl;
    var wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    if (!Array.isArray(entries) || entries.length === 0) {
      el.innerHTML = '<div class="popup-log-card popup-log-card--empty popup-log-entry popup-log-entry--log">暂无日志</div>';
      return;
    }
    el.innerHTML = entries.map(function (entry) {
      var level = entry.level || 'log';
      var time = formatLogTime(entry.t);
      var msg = (entry.msg != null ? String(entry.msg) : '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return '<div class="popup-log-card popup-log-entry popup-log-entry--' + level + '"><span class="popup-log-time">' + time + '</span>' + msg + '</div>';
    }).join('');
    if (wasAtBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }

  function loadLogs() {
    if (!logger) return;
    logger.getLogs(renderLogs);
  }

  function clearLogs() {
    if (!logger || !logsClearBtn) return;
    logger.clearLogs(function () {
      loadLogs();
    });
  }

  function loadThrottle() {
    if (!storage || !throttleEl) return;
    storage.getThrottleMinutes(function (val) {
      if (val != null && throttleOptions.indexOf(val) !== -1) {
        throttleEl.value = String(val);
      } else {
        throttleEl.value = String(defaultThrottle);
      }
    });
  }

  function saveThrottle() {
    if (!storage || !throttleEl) return;
    var minutes = parseInt(throttleEl.value, 10);
    if (minutes > 0) {
      storage.setThrottleMinutes(minutes, function () { });
    }
  }

  loadThrottle();
  loadLogs();

  if (throttleEl) {
    throttleEl.addEventListener('change', saveThrottle);
  }
  if (logsClearBtn) {
    logsClearBtn.addEventListener('click', clearLogs);
  }
  if (openSitesBtn) {
    openSitesBtn.addEventListener('click', openSites);
  }

  /* 打开 popup 时刷新日志 */
  window.addEventListener('focus', loadLogs);

  /* 定期刷新日志（popup 打开时） */
  var logsInterval = setInterval(loadLogs, 2000);
  window.addEventListener('blur', function () { clearInterval(logsInterval); });
})();
