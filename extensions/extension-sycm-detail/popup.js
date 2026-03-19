/**
 * popup：多商品加购勾选筛选 + 扩展日志
 *
 * 勾选状态：每次变更立即写入 storage（供 content 上报）；并用 sessionSelection 在 catalog 频繁刷新时避免
 * storage.set 未完成前重绘把勾选冲掉。
 */
(function () {
  var logger = typeof __SYCM_LOGGER__ !== 'undefined' ? __SYCM_LOGGER__ : null;
  var KEYS =
    typeof __SYCM_DEFAULTS__ !== 'undefined' && __SYCM_DEFAULTS__.STORAGE_KEYS
      ? __SYCM_DEFAULTS__.STORAGE_KEYS
      : { logs: 'sycm_logs', liveJsonCatalog: 'sycm_live_json_catalog', liveJsonFilter: 'sycm_live_json_filter' };

  var logsListEl = document.getElementById('logs-list');
  var logsClearBtn = document.getElementById('logs-clear');
  var goodsListEl = document.getElementById('goods-list');
  var goodsMetaEl = document.getElementById('goods-meta');
  var goodsRefreshBtn = document.getElementById('goods-refresh');
  var goodsSelectAllBtn = document.getElementById('goods-select-all');
  var goodsSelectNoneBtn = document.getElementById('goods-select-none');
  var goodsSaveBtn = document.getElementById('goods-save');

  var lastCatalogItems = [];
  /** null = 以 storage 为准；非 null = 本会话内用户已操作过，重绘时优先用此数组（同步） */
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
    logger.getLogs(renderLogs);
  }

  function clearLogs() {
    if (!logger || !logsClearBtn) return;
    logger.clearLogs(function () {
      loadLogs();
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

  function getItemIdsFromFilter(filter) {
    if (!filter || !Array.isArray(filter.itemIds)) return [];
    return filter.itemIds.map(function (id) {
      return String(id);
    });
  }

  function filterIdsToCatalog(itemIds, items) {
    var inCat = {};
    for (var i = 0; i < items.length; i++) {
      var row = items[i];
      if (row && row.item_id != null) inCat[String(row.item_id)] = true;
    }
    return itemIds.filter(function (id) {
      return inCat[id];
    });
  }

  function persistItemIds(itemIds) {
    var payload = {};
    payload[KEYS.liveJsonFilter] = { itemIds: itemIds.slice() };
    chrome.storage.local.set(payload, function () {});
  }

  /** 从当前 DOM 同步会话并写入 storage（勾选、全选、全不选） */
  function syncSelectionFromDom() {
    sessionSelection = getCheckedItemIdsFromDom();
    persistItemIds(sessionSelection);
  }

  function renderGoodsList(items, itemIds) {
    if (!goodsListEl) return;
    lastCatalogItems = Array.isArray(items) ? items.slice() : [];
    var selected = {};
    for (var s = 0; s < itemIds.length; s++) selected[String(itemIds[s])] = true;
    if (lastCatalogItems.length === 0) {
      goodsListEl.innerHTML =
        '<div class="popup-findpage-list--empty"><span>暂无数据。请在生意参谋加载商品列表（触发 live.json）后点「刷新列表」。</span></div>';
      goodsListEl.classList.add('popup-findpage-list--empty');
      if (goodsMetaEl) goodsMetaEl.textContent = '';
      return;
    }
    goodsListEl.classList.remove('popup-findpage-list--empty');
    goodsListEl.innerHTML = lastCatalogItems
      .map(function (row, index) {
        var id = row.item_id != null ? String(row.item_id) : '';
        var name = row.item_name || '（无标题）';
        var checked = !!selected[id];
        var safeId = escapeHtml(id);
        var safeName = escapeHtml(name);
        var checkedAttr = checked ? ' checked' : '';
        return (
          '<div class="popup-findpage-item" role="listitem" title="' +
          safeName +
          '">' +
          '<input type="checkbox" id="goods-cb-' +
          index +
          '" data-item-id="' +
          safeId +
          '" aria-label="上报 ' +
          safeName +
          '"' +
          checkedAttr +
          ' />' +
          '<label class="popup-findpage-name" for="goods-cb-' +
          index +
          '">' +
          safeName +
          '</label>' +
          '<span class="popup-goods-id">' +
          safeId +
          '</span>' +
          '</div>'
        );
      })
      .join('');
  }

  function loadGoodsUi() {
    var catKey = KEYS.liveJsonCatalog;
    var filKey = KEYS.liveJsonFilter;
    chrome.storage.local.get([catKey, filKey], function (result) {
      var cat = result[catKey];
      var items = cat && Array.isArray(cat.items) ? cat.items : [];
      var filter = result[filKey];
      var idsFromStorage = getItemIdsFromFilter(filter);
      var baseIds = sessionSelection !== null ? sessionSelection : idsFromStorage;
      var ids = filterIdsToCatalog(baseIds, items);
      if (sessionSelection !== null && ids.length !== sessionSelection.length) {
        sessionSelection = ids.slice();
        persistItemIds(sessionSelection);
      }
      renderGoodsList(items, ids);
      if (goodsMetaEl && cat && cat.updatedAt) {
        goodsMetaEl.textContent = '最近捕获：' + formatCatalogTime(cat.updatedAt) + ' · ' + items.length + ' 个商品';
      } else if (goodsMetaEl && items.length) {
        goodsMetaEl.textContent = items.length + ' 个商品';
      }
    });
  }

  function getCheckedItemIdsFromDom() {
    if (!goodsListEl) return [];
    var inputs = goodsListEl.querySelectorAll('input[type="checkbox"][data-item-id]');
    var out = [];
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].checked) out.push(String(inputs[i].getAttribute('data-item-id') || ''));
    }
    return out.filter(Boolean);
  }

  function setAllCheckboxes(checked) {
    if (!goodsListEl) return;
    var inputs = goodsListEl.querySelectorAll('input[type="checkbox"][data-item-id]');
    for (var i = 0; i < inputs.length; i++) inputs[i].checked = !!checked;
  }

  function saveFilterSettings() {
    syncSelectionFromDom();
    var itemIds = sessionSelection || [];
    var msg = '已保存：将上报 ' + itemIds.length + ' 个勾选商品（20 分钟时间槽）';
    if (goodsMetaEl) {
      chrome.storage.local.get([KEYS.liveJsonCatalog], function (r) {
        var cat = r[KEYS.liveJsonCatalog];
        var extra = '';
        if (cat && cat.updatedAt) extra = ' · 列表捕获于 ' + formatCatalogTime(cat.updatedAt);
        goodsMetaEl.textContent = msg + extra;
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
      if (t && t.matches && t.matches('input[type="checkbox"][data-item-id]')) {
        syncSelectionFromDom();
      }
    });
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    if (changes[KEYS.liveJsonCatalog]) scheduleLoadGoodsFromCatalog();
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
