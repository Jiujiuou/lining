/**
 * Popup：扩展日志展示（按当前标签读/清，与 extension-shop-record 等同源模式）
 */
(function () {
  var logger = typeof __EXT_TEMPLATE_LOGGER__ !== "undefined" ? __EXT_TEMPLATE_LOGGER__ : null;
  var logsListEl = document.getElementById("logs-list");
  var logsClearBtn = document.getElementById("logs-clear");

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
