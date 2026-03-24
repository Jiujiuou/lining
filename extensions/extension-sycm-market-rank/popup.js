/**
 * 左侧：市场排名列表（勾选行，按 itemId）；展示店铺名；全选/全不选/保存设置/刷新列表；右侧日志（与推广一致）。
 */
(function () {
  var logger = typeof __SYCM_RANK_LOGGER__ !== 'undefined' ? __SYCM_RANK_LOGGER__ : null;
  var KEYS =
    typeof __SYCM_RANK_DEFAULTS__ !== 'undefined' && __SYCM_RANK_DEFAULTS__.STORAGE_KEYS
      ? __SYCM_RANK_DEFAULTS__.STORAGE_KEYS
      : {
          rankListByTab: 'sycm_rank_market_list_by_tab',
          rankListLatest: 'sycm_rank_market_list_latest',
          rankSelectionByTab: 'sycm_rank_selection_by_tab',
          rankSelection: 'sycm_rank_selection_global',
          logs: 'sycm_rank_only_logs',
          logsByTab: 'sycm_rank_only_logs_by_tab'
        };

  var metaEl = document.getElementById('rank-meta');
  var listEl = document.getElementById('rank-list');
  var logsListEl = document.getElementById('logs-list');
  var logsClearBtn = document.getElementById('logs-clear');
  var rankRefreshBtn = document.getElementById('rank-refresh');
  var rankSelectAllBtn = document.getElementById('rank-select-all');
  var rankSelectNoneBtn = document.getElementById('rank-select-none');
  var rankSaveBtn = document.getElementById('rank-save');

  var refreshInterval = null;
  var lastItems = [];
  var sessionSelection = null;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function rowKey(row, index) {
    if (row && row.itemId != null && String(row.itemId).trim() !== '') return String(row.itemId);
    return 'idx-' + index;
  }

  function formatLogTime(isoStr) {
    if (!isoStr) return '';
    try {
      var d = new Date(isoStr);
      var pad = function (n) {
        return (n < 10 ? '0' : '') + n;
      };
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
    el.innerHTML = entries
      .map(function (entry) {
        var level = entry.level || 'log';
        var time = formatLogTime(entry.t);
        var msg = (entry.msg != null ? String(entry.msg) : '')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>');
        return (
          '<div class="popup-log-card popup-log-entry popup-log-entry--' +
          level +
          '"><span class="popup-log-time">' +
          time +
          '</span>' +
          msg +
          '</div>'
        );
      })
      .join('');
    if (wasAtBottom) el.scrollTop = el.scrollHeight;
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

  function filterIdsToCatalog(ids, items) {
    var inCat = {};
    for (var i = 0; i < items.length; i++) {
      inCat[rowKey(items[i], i)] = true;
    }
    return ids.filter(function (id) {
      return inCat[id];
    });
  }

  function getKeyIdsFromFilter(filter) {
    if (!filter || !Array.isArray(filter.itemIds)) return [];
    return filter.itemIds.map(function (k) {
      return String(k);
    });
  }

  function renderRankList(snapshot, selectedIds) {
    if (!listEl) return;
    lastItems = snapshot && Array.isArray(snapshot.items) ? snapshot.items.slice() : [];
    var selected = {};
    for (var s = 0; s < selectedIds.length; s++) selected[String(selectedIds[s])] = true;

    if (lastItems.length === 0) {
      listEl.innerHTML =
        '<div class="popup-findpage-list--empty"><span>暂无数据。请在生意参谋触发 rank.json 后点「刷新列表」。</span></div>';
      listEl.classList.add('popup-findpage-list--empty');
      if (metaEl) metaEl.textContent = '';
      return;
    }
    listEl.classList.remove('popup-findpage-list--empty');

    var kw = snapshot.keyWord != null && String(snapshot.keyWord).trim() !== '';
    var kwText = kw ? '搜索词：「' + String(snapshot.keyWord) + '」' : '搜索词：（空，未带 keyWord）';
    var ut = snapshot.updateTime ? '接口更新：' + snapshot.updateTime : '';
    var baseMeta = [kwText, ut].filter(Boolean).join(' · ');
    if (metaEl) metaEl.textContent = baseMeta;

    listEl.innerHTML = lastItems
      .map(function (row, index) {
        var rk = rowKey(row, index);
        var r = row.rank != null ? String(row.rank) : '—';
        var t = escapeHtml(
          row.shopTitle != null && String(row.shopTitle).trim() !== ''
            ? String(row.shopTitle).trim()
            : '（无店名）'
        );
        var checked = !!selected[rk];
        var checkedAttr = checked ? ' checked' : '';
        var safeRk = escapeHtml(rk);
        return (
          '<div class="popup-findpage-item" role="listitem" title="' +
          t +
          '">' +
          '<input type="checkbox" id="rank-cb-' +
          index +
          '" data-item-key="' +
          safeRk +
          '" aria-label="勾选「' +
          t +
          '」"' +
          checkedAttr +
          ' />' +
          '<span class="popup-rank-num">' +
          escapeHtml(r) +
          '</span>' +
          '<label class="popup-findpage-name" for="rank-cb-' +
          index +
          '">' +
          t +
          '</label>' +
          '</div>'
        );
      })
      .join('');
  }

  function getCheckedKeyIdsFromDom() {
    if (!listEl) return [];
    var inputs = listEl.querySelectorAll('input[type="checkbox"][data-item-key]');
    var out = [];
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].checked) out.push(String(inputs[i].getAttribute('data-item-key') || ''));
    }
    return out.filter(Boolean);
  }

  function persistSelection() {
    var slice = getCheckedKeyIdsFromDom();
    getActiveTabId(function (tabId) {
      if (tabId == null) {
        var payload = {};
        payload[KEYS.rankSelection] = { itemIds: slice };
        chrome.storage.local.set(payload, function () {});
        return;
      }
      chrome.storage.local.get([KEYS.rankSelectionByTab], function (r) {
        var byTab = r && r[KEYS.rankSelectionByTab] ? r[KEYS.rankSelectionByTab] : {};
        byTab[String(tabId)] = { itemIds: slice };
        var o = {};
        o[KEYS.rankSelectionByTab] = byTab;
        chrome.storage.local.set(o, function () {});
      });
    });
  }

  function syncSelectionFromDom() {
    sessionSelection = getCheckedKeyIdsFromDom();
    persistSelection();
  }

  function setAllCheckboxes(checked) {
    if (!listEl) return;
    var inputs = listEl.querySelectorAll('input[type="checkbox"][data-item-key]');
    for (var i = 0; i < inputs.length; i++) inputs[i].checked = !!checked;
    syncSelectionFromDom();
  }

  function saveSettings() {
    syncSelectionFromDom();
    var kws = sessionSelection || [];
    var msg = '已保存：当前勾选 ' + kws.length + ' 个店铺';
    if (metaEl) {
      getActiveTabId(function (tabId) {
        chrome.storage.local.get([KEYS.rankListByTab, KEYS.rankListLatest], function (r) {
          var snap =
            tabId != null && r[KEYS.rankListByTab] && r[KEYS.rankListByTab][String(tabId)]
              ? r[KEYS.rankListByTab][String(tabId)]
              : r[KEYS.rankListLatest];
          var extra = '';
          if (snap && snap.updateTime) extra = ' · 列表数据：' + snap.updateTime;
          metaEl.textContent = msg + extra;
        });
      });
    }
    if (logger) {
      logger.log(msg);
      loadLogs();
    }
  }

  function loadRank() {
    chrome.storage.local.get(
      [KEYS.rankListByTab, KEYS.rankListLatest, KEYS.rankSelectionByTab, KEYS.rankSelection],
      function (result) {
        getActiveTabId(function (tabId) {
          var snap = null;
          if (tabId != null && result[KEYS.rankListByTab] && result[KEYS.rankListByTab][String(tabId)]) {
            snap = result[KEYS.rankListByTab][String(tabId)];
          } else if (result[KEYS.rankListLatest]) {
            snap = result[KEYS.rankListLatest];
          }

          var filter;
          if (tabId != null && result[KEYS.rankSelectionByTab] && result[KEYS.rankSelectionByTab][String(tabId)]) {
            filter = result[KEYS.rankSelectionByTab][String(tabId)];
          } else {
            filter = result[KEYS.rankSelection];
          }

          var items = snap && Array.isArray(snap.items) ? snap.items : [];
          var idsFromStorage = getKeyIdsFromFilter(filter);
          var baseIds = sessionSelection !== null ? sessionSelection : idsFromStorage;
          var kws = filterIdsToCatalog(baseIds, items);
          if (sessionSelection !== null && kws.length !== baseIds.length) {
            sessionSelection = kws.slice();
            persistSelection();
          }

          renderRankList(snap || { items: [], keyWord: '', updateTime: '' }, kws);
        });
      }
    );
  }

  function onRefreshClick() {
    loadRank();
    loadLogs();
    if (logger) {
      chrome.storage.local.get([KEYS.rankListByTab, KEYS.rankListLatest], function (r) {
        getActiveTabId(function (tabId) {
          var snap =
            tabId != null && r[KEYS.rankListByTab] && r[KEYS.rankListByTab][String(tabId)]
              ? r[KEYS.rankListByTab][String(tabId)]
              : r[KEYS.rankListLatest];
          var n = snap && Array.isArray(snap.items) ? snap.items.length : 0;
          logger.log('[刷新列表] 共 ' + n + ' 条');
          loadLogs();
        });
      });
    }
  }

  loadRank();
  loadLogs();

  if (rankRefreshBtn) rankRefreshBtn.addEventListener('click', onRefreshClick);
  if (rankSelectAllBtn) rankSelectAllBtn.addEventListener('click', function () {
    setAllCheckboxes(true);
  });
  if (rankSelectNoneBtn) rankSelectNoneBtn.addEventListener('click', function () {
    setAllCheckboxes(false);
  });
  if (rankSaveBtn) rankSaveBtn.addEventListener('click', saveSettings);
  if (logsClearBtn) logsClearBtn.addEventListener('click', clearLogs);

  if (listEl) {
    listEl.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.matches && t.matches('input[type="checkbox"][data-item-key]')) {
        syncSelectionFromDom();
      }
    });
  }

  var catalogTimer = null;
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    if (changes[KEYS.rankListByTab] || changes[KEYS.rankListLatest]) {
      if (catalogTimer) clearTimeout(catalogTimer);
      catalogTimer = setTimeout(function () {
        catalogTimer = null;
        loadRank();
      }, 200);
    }
    if (changes[KEYS.rankSelectionByTab] || changes[KEYS.rankSelection]) {
      if (catalogTimer) clearTimeout(catalogTimer);
      catalogTimer = setTimeout(function () {
        catalogTimer = null;
        loadRank();
      }, 200);
    }
    if (changes[KEYS.logsByTab] || (KEYS.logs && changes[KEYS.logs])) loadLogs();
  });

  function startLogPoll() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadLogs, 2000);
  }
  function stopLogPoll() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = null;
  }
  window.addEventListener('focus', function () {
    loadRank();
    loadLogs();
    startLogPoll();
  });
  window.addEventListener('blur', stopLogPoll);
  startLogPoll();
})();
