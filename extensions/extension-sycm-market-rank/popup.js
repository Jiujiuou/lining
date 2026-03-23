/**
 * popup：按 URL 关键词（keyWord）勾选后上报排名；按当前标签页分桶。
 */
(function () {
  var logger = typeof __SYCM_RANK_LOGGER__ !== 'undefined' ? __SYCM_RANK_LOGGER__ : null;
  var KEYS =
    typeof __SYCM_RANK_DEFAULTS__ !== 'undefined' && __SYCM_RANK_DEFAULTS__.STORAGE_KEYS
      ? __SYCM_RANK_DEFAULTS__.STORAGE_KEYS
      : {
          logs: 'sycm_rank_only_logs',
          rankCatalog: 'sycm_rank_only_catalog',
          rankFilter: 'sycm_rank_only_filter',
          rankFilterByTab: 'sycm_rank_only_filter_by_tab',
          rankCatalogByTab: 'sycm_rank_only_catalog_by_tab'
        };

  var logsListEl = document.getElementById('logs-list');
  var logsClearBtn = document.getElementById('logs-clear');
  var goodsListEl = document.getElementById('goods-list');
  var goodsMetaEl = document.getElementById('goods-meta');
  var goodsRefreshBtn = document.getElementById('goods-refresh');
  var goodsSelectAllBtn = document.getElementById('goods-select-all');
  var goodsSelectNoneBtn = document.getElementById('goods-select-none');
  var goodsSaveBtn = document.getElementById('goods-save');

  var lastCatalogItems = [];
  var sessionSelection = null;
  var catalogReloadTimer = null;

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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatCatalogTime(isoStr) {
    if (!isoStr) return '';
    try {
      var d = new Date(isoStr);
      return d.toLocaleString('zh-CN', { hour12: false });
    } catch (e) {
      return '';
    }
  }

  function getKeyWordsFromFilter(filter) {
    if (!filter || !Array.isArray(filter.keyWords)) return [];
    return filter.keyWords.map(function (k) {
      return String(k);
    });
  }

  function filterKeyWordsToCatalog(keyWords, items) {
    var inCat = {};
    for (var i = 0; i < items.length; i++) {
      var row = items[i];
      if (row && row.key_word != null) inCat[String(row.key_word)] = true;
    }
    return keyWords.filter(function (k) {
      return inCat[k];
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

  function persistKeyWords(keyWords) {
    getActiveTabId(function (tabId) {
      var slice = keyWords.slice();
      if (tabId == null) {
        var payload = {};
        payload[KEYS.rankFilter] = { keyWords: slice };
        chrome.storage.local.set(payload, function () {});
        return;
      }
      chrome.storage.local.get([KEYS.rankFilterByTab], function (r) {
        var byTab = r && r[KEYS.rankFilterByTab] ? r[KEYS.rankFilterByTab] : {};
        byTab[String(tabId)] = { keyWords: slice };
        var o = {};
        o[KEYS.rankFilterByTab] = byTab;
        chrome.storage.local.set(o, function () {});
      });
    });
  }

  function syncSelectionFromDom() {
    sessionSelection = getCheckedKeyWordsFromDom();
    persistKeyWords(sessionSelection);
  }

  function renderGoodsList(items, keyWords) {
    if (!goodsListEl) return;
    lastCatalogItems = Array.isArray(items) ? items.slice() : [];
    var selected = {};
    for (var s = 0; s < keyWords.length; s++) selected[String(keyWords[s])] = true;
    if (lastCatalogItems.length === 0) {
      goodsListEl.innerHTML =
        '<div class="popup-findpage-list--empty"><span>暂无数据。请在生意参谋触发市场排名 rank.json 请求后点「刷新列表」。</span></div>';
      goodsListEl.classList.add('popup-findpage-list--empty');
      if (goodsMetaEl) goodsMetaEl.textContent = '';
      return;
    }
    goodsListEl.classList.remove('popup-findpage-list--empty');
    goodsListEl.innerHTML = lastCatalogItems
      .map(function (row, index) {
        var kw = row.key_word != null ? String(row.key_word) : '';
        var name = row.item_name || kw || '（无关键词）';
        var checked = !!selected[kw];
        var safeKw = escapeHtml(kw);
        var safeName = escapeHtml(name);
        var checkedAttr = checked ? ' checked' : '';
        return (
          '<div class="popup-findpage-item" role="listitem" title="' +
          safeName +
          '">' +
          '<input type="checkbox" id="goods-cb-' +
          index +
          '" data-key-word="' +
          safeKw +
          '" aria-label="上报「' +
          safeName +
          '」排名"' +
          checkedAttr +
          ' />' +
          '<label class="popup-findpage-name" for="goods-cb-' +
          index +
          '">' +
          safeName +
          '</label>' +
          '<span class="popup-goods-id" title="' +
          safeKw +
          '">' +
          safeKw +
          '</span>' +
          '</div>'
        );
      })
      .join('');
  }

  function loadGoodsUi() {
    chrome.storage.local.get(
      [KEYS.rankCatalogByTab, KEYS.rankFilterByTab, KEYS.rankCatalog, KEYS.rankFilter],
      function (result) {
        getActiveTabId(function (tabId) {
          var byCat = result[KEYS.rankCatalogByTab] || {};
          var byFil = result[KEYS.rankFilterByTab] || {};
          var cat =
            tabId != null && Object.prototype.hasOwnProperty.call(byCat, String(tabId))
              ? byCat[String(tabId)]
              : result[KEYS.rankCatalog];
          var filter;
          if (tabId != null && Object.prototype.hasOwnProperty.call(byFil, String(tabId))) {
            filter = byFil[String(tabId)];
          } else {
            filter = result[KEYS.rankFilter];
          }
          var items = cat && Array.isArray(cat.items) ? cat.items : [];
          var kwsFromStorage = getKeyWordsFromFilter(filter);
          var baseKws = sessionSelection !== null ? sessionSelection : kwsFromStorage;
          var kws = filterKeyWordsToCatalog(baseKws, items);
          if (sessionSelection !== null && kws.length !== sessionSelection.length) {
            sessionSelection = kws.slice();
            persistKeyWords(sessionSelection);
          }
          renderGoodsList(items, kws);
          if (goodsMetaEl && cat && cat.updatedAt) {
            goodsMetaEl.textContent =
              '最近捕获：' + formatCatalogTime(cat.updatedAt) + ' · ' + items.length + ' 个搜索关键词';
          } else if (goodsMetaEl && items.length) {
            goodsMetaEl.textContent = items.length + ' 个搜索关键词';
          }
        });
      }
    );
  }

  function getCheckedKeyWordsFromDom() {
    if (!goodsListEl) return [];
    var inputs = goodsListEl.querySelectorAll('input[type="checkbox"][data-key-word]');
    var out = [];
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].checked) out.push(String(inputs[i].getAttribute('data-key-word') || ''));
    }
    return out.filter(Boolean);
  }

  function setAllCheckboxes(checked) {
    if (!goodsListEl) return;
    var inputs = goodsListEl.querySelectorAll('input[type="checkbox"][data-key-word]');
    for (var i = 0; i < inputs.length; i++) inputs[i].checked = !!checked;
  }

  function saveFilterSettings() {
    syncSelectionFromDom();
    var kws = sessionSelection || [];
    var msg = '已保存：将上报 ' + kws.length + ' 个勾选关键词的排名（按关键词独立时间槽）';
    if (goodsMetaEl) {
      getActiveTabId(function (tabId) {
        chrome.storage.local.get([KEYS.rankCatalogByTab, KEYS.rankCatalog], function (r) {
          var byCat = r[KEYS.rankCatalogByTab] || {};
          var cat =
            tabId != null && Object.prototype.hasOwnProperty.call(byCat, String(tabId))
              ? byCat[String(tabId)]
              : r[KEYS.rankCatalog];
          var extra = '';
          if (cat && cat.updatedAt) extra = ' · 列表捕获于 ' + formatCatalogTime(cat.updatedAt);
          goodsMetaEl.textContent = msg + extra;
        });
      });
    }
  }

  function scheduleLoadGoodsFromCatalog() {
    if (catalogReloadTimer) clearTimeout(catalogReloadTimer);
    catalogReloadTimer = setTimeout(function () {
      catalogReloadTimer = null;
      loadGoodsUi();
    }, 200);
  }

  loadLogs();
  loadGoodsUi();

  if (logsClearBtn) logsClearBtn.addEventListener('click', clearLogs);
  if (goodsRefreshBtn) {
    goodsRefreshBtn.addEventListener('click', function () {
      sessionSelection = null;
      loadGoodsUi();
    });
  }
  if (goodsSelectAllBtn) {
    goodsSelectAllBtn.addEventListener('click', function () {
      setAllCheckboxes(true);
      syncSelectionFromDom();
    });
  }
  if (goodsSelectNoneBtn) {
    goodsSelectNoneBtn.addEventListener('click', function () {
      setAllCheckboxes(false);
      syncSelectionFromDom();
    });
  }
  if (goodsSaveBtn) goodsSaveBtn.addEventListener('click', saveFilterSettings);

  if (goodsListEl) {
    goodsListEl.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.matches && t.matches('input[type="checkbox"][data-key-word]')) {
        syncSelectionFromDom();
      }
    });
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    if (
      changes[KEYS.rankCatalog] ||
      changes[KEYS.rankCatalogByTab] ||
      changes[KEYS.rankFilterByTab]
    ) {
      scheduleLoadGoodsFromCatalog();
    }
  });

  var refreshInterval = null;
  function startLogPoll() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadLogs, 2000);
  }
  function stopLogPoll() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = null;
  }
  window.addEventListener('focus', function () {
    loadLogs();
    loadGoodsUi();
    startLogPoll();
  });
  window.addEventListener('blur', stopLogPoll);
  startLogPoll();
})();
