/**
 * popup.js - 生意参谋扩展日志展示与清空（万相台推广登记已迁至独立扩展）
 */
(function () {
  var logger = typeof __SYCM_LOGGER__ !== 'undefined' ? __SYCM_LOGGER__ : null;

  var logsListEl = document.getElementById('logs-list');
  var logsClearBtn = document.getElementById('logs-clear');

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
      el.innerHTML = '<div class="popup-logs-empty">暂无日志</div>';
      return;
    }
    el.innerHTML = entries.map(function (entry) {
      var level = entry.level || 'log';
      var time = formatLogTime(entry.t);
      var msg = (entry.msg != null ? String(entry.msg) : '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      return '<div class="popup-log-card popup-log-entry popup-log-entry--' + level + '"><span class="popup-log-time">' + time + '</span>' + msg + '</div>';
    }).join('');
    if (wasAtBottom) el.scrollTop = el.scrollHeight;
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

  loadLogs();

  if (logsClearBtn) logsClearBtn.addEventListener('click', clearLogs);

  window.addEventListener('focus', loadLogs);
  var refreshInterval = setInterval(loadLogs, 2000);
  window.addEventListener('blur', function () {
    clearInterval(refreshInterval);
  });
})();
