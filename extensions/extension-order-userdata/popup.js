(function () {
  var logger = typeof __OU_USERDATA_LOGGER__ !== 'undefined' ? __OU_USERDATA_LOGGER__ : null;
  var FORM_KEY =
    typeof __OU_USERDATA_DEFAULTS__ !== 'undefined' &&
    __OU_USERDATA_DEFAULTS__.STORAGE_KEYS &&
    __OU_USERDATA_DEFAULTS__.STORAGE_KEYS.formByTab
      ? __OU_USERDATA_DEFAULTS__.STORAGE_KEYS.formByTab
      : 'ou_userdata_form_by_tab';

  var btn = document.getElementById('btn-get-userdata');
  var unionEl = document.getElementById('userdata-union-search');
  var nickEl = document.getElementById('userdata-buyer-nick');
  var statusEl = document.getElementById('userdata-order-status');
  var logsListEl = document.getElementById('logs-list');
  var logsClearBtn = document.getElementById('logs-clear');
  var progressWrap = document.getElementById('ou-progress-wrap');
  var progressLabel = document.getElementById('ou-progress-label');
  var progressPages = document.getElementById('ou-progress-pages');
  var progressTrack = document.getElementById('ou-progress-track');
  var progressFill = document.getElementById('ou-progress-fill');

  var SOLD_PAGE_URL = 'https://qn.taobao.com/home.htm/trade-platform/tp/sold';
  var QN_OR_TRADE_REG = /^https:\/\/(qn\.taobao\.com|trade\.taobao\.com)\//;
  var lastKnownTotalPage = null;

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
      el.innerHTML = '<div class="ou-logs-empty">暂无日志</div>';
      return;
    }
    el.innerHTML = entries.map(function (entry) {
      var level = entry.level || 'log';
      var time = formatLogTime(entry.t);
      var msg = (entry.msg != null ? String(entry.msg) : '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      return '<div class="ou-log-entry ou-log-entry--' + level + '"><span class="ou-log-time">' + time + '</span>' + msg + '</div>';
    }).join('');
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

  function loadFormForCurrentTab() {
    if (!unionEl && !nickEl && !statusEl) return;
    getActiveTabId(function (tabId) {
      if (tabId == null) return;
      chrome.storage.local.get([FORM_KEY], function (r) {
        var byTab = r[FORM_KEY] || {};
        var f = byTab[String(tabId)];
        if (!f || typeof f !== 'object') return;
        if (unionEl && f.unionSearch != null) unionEl.value = String(f.unionSearch);
        if (nickEl && f.buyerNick != null) nickEl.value = String(f.buyerNick);
        if (statusEl && f.orderStatus != null) statusEl.value = String(f.orderStatus);
      });
    });
  }

  function saveFormForCurrentTab() {
    getActiveTabId(function (tabId) {
      if (tabId == null) return;
      var payload = {
        unionSearch: unionEl ? String(unionEl.value || '').trim() : '',
        buyerNick: nickEl ? String(nickEl.value || '').trim() : '',
        orderStatus: statusEl ? String(statusEl.value || 'SUCCESS') : 'SUCCESS'
      };
      chrome.storage.local.get([FORM_KEY], function (r) {
        var byTab = r[FORM_KEY] || {};
        byTab[String(tabId)] = payload;
        var o = {};
        o[FORM_KEY] = byTab;
        chrome.storage.local.set(o, function () {});
      });
    });
  }

  function bindFormPersistence() {
    function onFormChange() {
      saveFormForCurrentTab();
    }
    if (unionEl) unionEl.addEventListener('input', onFormChange);
    if (nickEl) nickEl.addEventListener('input', onFormChange);
    if (statusEl) statusEl.addEventListener('change', onFormChange);
  }

  function setProgressIndeterminate(on) {
    if (!progressWrap) return;
    if (on) progressWrap.classList.add('ou-progress-wrap--indeterminate');
    else progressWrap.classList.remove('ou-progress-wrap--indeterminate');
  }

  function showProgressArea() {
    if (!progressWrap) return;
    progressWrap.classList.remove('ou-progress-wrap--hidden');
    progressWrap.setAttribute('aria-hidden', 'false');
  }

  function hideProgressArea() {
    if (!progressWrap) return;
    progressWrap.classList.add('ou-progress-wrap--hidden');
    progressWrap.setAttribute('aria-hidden', 'true');
    setProgressIndeterminate(false);
    if (progressFill) progressFill.style.width = '0%';
    if (progressTrack) progressTrack.setAttribute('aria-valuenow', '0');
  }

  function updateProgressUI(msg) {
    if (!progressWrap || !progressLabel || !progressFill || !progressTrack) return;
    showProgressArea();
    var total = msg.totalPage != null ? Number(msg.totalPage) : NaN;
    var cur = msg.currentPage != null ? Number(msg.currentPage) : 0;
    var text = (msg.message != null ? String(msg.message) : '').trim();

    if (progressPages) {
      if (total > 0 && !isNaN(total)) {
        progressPages.textContent = '共 ' + total + ' 页';
      } else {
        progressPages.textContent = '';
      }
    }

    progressLabel.textContent = text || '处理中…';

    if (!(total > 0) || isNaN(total)) {
      setProgressIndeterminate(true);
      progressTrack.setAttribute('aria-valuenow', '0');
      return;
    }
    setProgressIndeterminate(false);
    var pct;
    if (text.indexOf('正在请求') !== -1) {
      pct = Math.max(0, ((cur > 0 ? cur : 1) - 1) / total * 100);
    } else if (text.indexOf('完成') !== -1) {
      pct = Math.min(100, Math.max(0, cur / total * 100));
    } else {
      pct = Math.min(100, Math.max(0, cur / total * 100));
    }
    progressFill.style.width = pct + '%';
    progressTrack.setAttribute('aria-valuenow', String(Math.round(pct)));
  }

  function setProgressComplete(ok) {
    if (!progressFill || !progressTrack || !progressLabel) return;
    showProgressArea();
    setProgressIndeterminate(false);
    progressFill.style.width = '100%';
    progressTrack.setAttribute('aria-valuenow', '100');
    progressLabel.textContent = ok ? '已完成' : '已结束';
  }

  function onGetUserDataClick() {
    var unionSearch = (unionEl && unionEl.value) ? String(unionEl.value).trim() : '';
    var buyerNick = (nickEl && nickEl.value) ? String(nickEl.value).trim() : '';
    var orderStatus = (statusEl && statusEl.value) ? String(statusEl.value) : 'SUCCESS';

    function trySend(tabId, retryAfterInject) {
      chrome.tabs.sendMessage(tabId, {
        type: 'OU_GET_USER_DATA',
        unionSearch: unionSearch,
        buyerNick: buyerNick,
        orderStatus: orderStatus
      }, function (reply) {
        if (chrome.runtime.lastError) {
          if (!retryAfterInject) {
            chrome.scripting.executeScript(
              { target: { tabId: tabId }, files: ['order-userdata-cs.js'] },
              function () {
                if (chrome.runtime.lastError) {
                  if (logger) logger.appendLog('warn', '无法与页面通信，请刷新已卖出订单页后重试');
                  loadLogs();
                  return;
                }
                setTimeout(function () { trySend(tabId, true); }, 800);
              }
            );
            return;
          }
          if (logger) logger.appendLog('warn', '无法与页面通信，请刷新已卖出订单页后重试');
          loadLogs();
          return;
        }
        if (logger) logger.appendLog('log', '已开始获取，请保持页面打开直至完成');
        lastKnownTotalPage = null;
        showProgressArea();
        setProgressIndeterminate(true);
        if (progressLabel) progressLabel.textContent = '正在连接页面…';
        if (progressPages) progressPages.textContent = '';
        if (progressFill) progressFill.style.width = '0%';
        loadLogs();
      });
    }

    chrome.tabs.query({ active: true, currentWindow: true }, function (activeTabs) {
      var activeTab = (activeTabs && activeTabs.length > 0) ? activeTabs[0] : null;
      if (activeTab && activeTab.id && activeTab.url && QN_OR_TRADE_REG.test(activeTab.url)) {
        trySend(activeTab.id);
        return;
      }
      chrome.tabs.query({ url: ['https://qn.taobao.com/*', 'https://trade.taobao.com/*'] }, function (tabs) {
        var tab = (tabs && tabs.length > 0) ? tabs[0] : null;
        if (tab && tab.id) {
          chrome.tabs.update(tab.id, { active: true });
          trySend(tab.id);
        } else {
          chrome.tabs.create({ url: SOLD_PAGE_URL }, function (newTab) {
            if (logger) logger.appendLog('log', '已打开已卖出订单页，加载完成后将自动开始…');
            loadLogs();
            var listener = function (id, change) {
              if (id === newTab.id && change.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                setTimeout(function () { trySend(newTab.id); }, 500);
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
          });
        }
      });
    });
  }

  chrome.runtime.onMessage.addListener(function (msg) {
    if (!msg) return;
    if (msg.type === 'OU_USER_DATA_PROGRESS') {
      var tp = msg.totalPage != null ? Number(msg.totalPage) : 0;
      if (tp > 0) lastKnownTotalPage = tp;
      updateProgressUI(msg);
      if (msg.message && logger) {
        logger.appendLog('log', String(msg.message));
        loadLogs();
      }
      return;
    }
    if (msg.type === 'OU_USER_DATA_PAGE') {
      return;
    }
    if (msg.type === 'OU_USER_DATA_DONE') {
      setProgressComplete(!msg.error);
      if (logger) {
        if (msg.error) {
          logger.appendLog('warn', '结束（含错误）: ' + msg.error);
        } else {
          var rows = msg.rows || [];
          var summary = '全部完成，共 ' + rows.length + ' 条，已导出 CSV';
          if (lastKnownTotalPage != null && lastKnownTotalPage > 0) {
            summary += '，总页数 ' + lastKnownTotalPage;
          }
          logger.appendLog('log', summary);
        }
      }
      loadLogs();
    }
  });

  if (btn) btn.addEventListener('click', onGetUserDataClick);
  if (logsClearBtn) logsClearBtn.addEventListener('click', clearLogs);
  bindFormPersistence();
  loadFormForCurrentTab();
  loadLogs();
  window.addEventListener('focus', function () {
    loadFormForCurrentTab();
    loadLogs();
  });
})();
