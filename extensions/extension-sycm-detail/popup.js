/**
 * popup：多商品加购勾选筛选 + 扩展日志
 *
 * 勾选状态：按当前标签页写入分桶 storage（多开互不覆盖）；sessionSelection 在 catalog 频繁刷新时避免重绘冲掉勾选。
 */
(function () {
  var logger = typeof __SYCM_LOGGER__ !== "undefined" ? __SYCM_LOGGER__ : null;
  var common = typeof __SYCM_COMMON__ !== "undefined" ? __SYCM_COMMON__ : null;
  var KEYS =
    typeof __SYCM_DEFAULTS__ !== "undefined" && __SYCM_DEFAULTS__.STORAGE_KEYS
      ? __SYCM_DEFAULTS__.STORAGE_KEYS
      : {
          logs: "sycm_logs",
          liveJsonCatalog: "sycm_live_json_catalog",
          liveJsonFilter: "sycm_live_json_filter",
          liveJsonFilterByTab: "sycm_live_json_filter_by_tab",
          liveJsonCatalogByTab: "sycm_live_json_catalog_by_tab",
        };
  var MAX_LIVE_JSON_TABS =
    typeof __SYCM_DEFAULTS__ !== "undefined" &&
    __SYCM_DEFAULTS__.LIVE_JSON_MAX_TABS
      ? __SYCM_DEFAULTS__.LIVE_JSON_MAX_TABS
      : 6;
  var MAX_LIVE_JSON_ITEMS =
    typeof __SYCM_DEFAULTS__ !== "undefined" &&
    __SYCM_DEFAULTS__.LIVE_JSON_MAX_ITEMS
      ? __SYCM_DEFAULTS__.LIVE_JSON_MAX_ITEMS
      : 200;
  var FILTER_META_KEY = "__meta";
  var safeSet =
    common && typeof common.safeSet === "function"
      ? common.safeSet
      : function (payload, onDone, onQuota) {
          chrome.storage.local.set(payload, function () {
            if (typeof onDone === "function") onDone();
          });
        };

  var logsListEl = document.getElementById("logs-list");
  var logsClearBtn = document.getElementById("logs-clear");
  var logsExportBtn = document.getElementById("logs-export");
  var goodsListEl = document.getElementById("goods-list");
  var goodsMetaEl = document.getElementById("goods-meta");
  var goodsRefreshBtn = document.getElementById("goods-refresh");
  var goodsSelectAllBtn = document.getElementById("goods-select-all");
  var goodsSelectNoneBtn = document.getElementById("goods-select-none");
  var goodsSaveBtn = document.getElementById("goods-save");
  var pollIntervalValueEl = document.getElementById("poll-interval-value");
  var pollIntervalUnitEl = document.getElementById("poll-interval-unit");
  var pollStartBtn = document.getElementById("poll-start");
  var pollStopBtn = document.getElementById("poll-stop");
  var pollMetaEl = document.getElementById("poll-meta");

  var lastCatalogItems = [];
  /** null = 以 storage 为准；非 null = 本会话内用户已操作过，重绘时优先用此数组（同步） */
  var sessionSelection = null;
  var catalogReloadTimer = null;

  function formatLogTime(isoStr) {
    if (!isoStr) return "";
    try {
      var d = new Date(isoStr);
      var pad = function (n) {
        return (n < 10 ? "0" : "") + n;
      };
      return (
        pad(d.getHours()) +
        ":" +
        pad(d.getMinutes()) +
        ":" +
        pad(d.getSeconds())
      );
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

  function copyTextToClipboard(text, onDone) {
    if (!text) text = "";
    if (
      navigator &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          if (typeof onDone === "function") onDone(true);
        })
        .catch(function () {
          fallbackCopy(text, onDone);
        });
      return;
    }
    fallbackCopy(text, onDone);
  }

  function fallbackCopy(text, onDone) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {}
      document.body.removeChild(ta);
      if (typeof onDone === "function") onDone(ok);
    } catch (e2) {
      if (typeof onDone === "function") onDone(false);
    }
  }

  function exportLogsToClipboard() {
    if (!logger) return;
    getActiveTabId(function (tabId) {
      logger.getLogs(function (entries) {
        var lines = [];
        if (Array.isArray(entries)) {
          for (var i = 0; i < entries.length; i++) {
            var it = entries[i] || {};
            var t = it.t ? String(it.t) : "";
            var level = it.level ? String(it.level) : "log";
            var msg = it.msg != null ? String(it.msg) : "";
            lines.push("[" + level + "] " + t + " " + msg);
          }
        }
        var text = lines.join("\n");
        copyTextToClipboard(text, function (ok) {
          if (ok)
            setPollMeta("日志已复制到剪贴板（共 " + lines.length + " 条）");
          else setPollMeta("复制失败：请检查浏览器剪贴板权限");
        });
      }, tabId);
    });
  }

  function escapeHtml(s) {
    if (common && typeof common.escapeHtml === "function")
      return common.escapeHtml(s);
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatCatalogTime(isoStr) {
    if (!isoStr) return "";
    try {
      var d = new Date(isoStr);
      return d.toLocaleString("zh-CN", { hour12: false });
    } catch (e) {
      return "";
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

  function persistItemIds(itemIds) {
    getActiveTabId(function (tabId) {
      var slice = itemIds.slice(0, MAX_LIVE_JSON_ITEMS);
      if (tabId == null) {
        var payload = {};
        payload[KEYS.liveJsonFilter] = { itemIds: slice };
        safeSet(
          payload,
          function () {},
          function (retry) {
            chrome.storage.local.remove([KEYS.liveJsonFilter], function () {
              retry();
            });
          },
        );
        return;
      }
      chrome.storage.local.get([KEYS.liveJsonFilterByTab], function (r) {
        var byTab =
          r && r[KEYS.liveJsonFilterByTab] ? r[KEYS.liveJsonFilterByTab] : {};
        byTab[String(tabId)] = { itemIds: slice };
        var meta =
          byTab[FILTER_META_KEY] && typeof byTab[FILTER_META_KEY] === "object"
            ? byTab[FILTER_META_KEY]
            : {};
        meta[String(tabId)] = new Date().toISOString();
        byTab[FILTER_META_KEY] = meta;
        var ids = Object.keys(byTab).filter(function (k) {
          return k !== FILTER_META_KEY;
        });
        ids.sort(function (a, b) {
          var ta = meta[a] || "";
          var tb = meta[b] || "";
          return String(ta).localeCompare(String(tb));
        });
        while (ids.length > MAX_LIVE_JSON_TABS) {
          var oldest = ids.shift();
          delete byTab[oldest];
          delete meta[oldest];
        }
        var o = {};
        o[KEYS.liveJsonFilterByTab] = byTab;
        safeSet(
          o,
          function () {},
          function (retry) {
            byTab =
              common && typeof common.pruneByTabWithMeta === "function"
                ? common.pruneByTabWithMeta(
                    byTab,
                    FILTER_META_KEY,
                    Math.max(1, MAX_LIVE_JSON_TABS - 1),
                  )
                : byTab;
            var o2 = {};
            o2[KEYS.liveJsonFilterByTab] = byTab;
            safeSet(o2, retry);
          },
        );
      });
    });
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
    for (var s = 0; s < itemIds.length; s++)
      selected[String(itemIds[s])] = true;
    if (lastCatalogItems.length === 0) {
      goodsListEl.innerHTML =
        '<div class="popup-findpage-list--empty"><span>暂无数据。请在生意参谋加载商品列表（触发 live.json）后点「刷新列表」。</span></div>';
      goodsListEl.classList.add("popup-findpage-list--empty");
      if (goodsMetaEl) goodsMetaEl.textContent = "";
      return;
    }
    goodsListEl.classList.remove("popup-findpage-list--empty");
    goodsListEl.innerHTML = lastCatalogItems
      .map(function (row, index) {
        var id = row.item_id != null ? String(row.item_id) : "";
        var name = row.item_name || "（无标题）";
        var checked = !!selected[id];
        var safeId = escapeHtml(id);
        var safeName = escapeHtml(name);
        var checkedAttr = checked ? " checked" : "";
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
          " />" +
          '<label class="popup-findpage-name" for="goods-cb-' +
          index +
          '">' +
          safeName +
          "</label>" +
          '<span class="popup-goods-id">' +
          safeId +
          "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  function loadGoodsUi() {
    chrome.storage.local.get(
      [
        KEYS.liveJsonCatalogByTab,
        KEYS.liveJsonFilterByTab,
        KEYS.liveJsonCatalog,
        KEYS.liveJsonFilter,
      ],
      function (result) {
        getActiveTabId(function (tabId) {
          var byCat = result[KEYS.liveJsonCatalogByTab] || {};
          var byFil = result[KEYS.liveJsonFilterByTab] || {};
          var cat =
            tabId != null &&
            Object.prototype.hasOwnProperty.call(byCat, String(tabId))
              ? byCat[String(tabId)]
              : result[KEYS.liveJsonCatalog];
          var filter;
          if (
            tabId != null &&
            Object.prototype.hasOwnProperty.call(byFil, String(tabId))
          ) {
            filter = byFil[String(tabId)];
          } else {
            filter = result[KEYS.liveJsonFilter];
          }
          var items = cat && Array.isArray(cat.items) ? cat.items : [];
          var idsFromStorage = getItemIdsFromFilter(filter);
          var baseIds =
            sessionSelection !== null ? sessionSelection : idsFromStorage;
          var ids = filterIdsToCatalog(baseIds, items);
          if (
            sessionSelection !== null &&
            ids.length !== sessionSelection.length
          ) {
            sessionSelection = ids.slice();
            persistItemIds(sessionSelection);
          }
          renderGoodsList(items, ids);
          if (goodsMetaEl && cat && cat.updatedAt) {
            goodsMetaEl.textContent =
              "最近捕获：" +
              formatCatalogTime(cat.updatedAt) +
              " · " +
              items.length +
              " 个商品";
          } else if (goodsMetaEl && items.length) {
            goodsMetaEl.textContent = items.length + " 个商品";
          }
        });
      },
    );
  }

  function getCheckedItemIdsFromDom() {
    if (!goodsListEl) return [];
    var inputs = goodsListEl.querySelectorAll(
      'input[type="checkbox"][data-item-id]',
    );
    var out = [];
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].checked)
        out.push(String(inputs[i].getAttribute("data-item-id") || ""));
    }
    return out.filter(Boolean);
  }

  function setAllCheckboxes(checked) {
    if (!goodsListEl) return;
    var inputs = goodsListEl.querySelectorAll(
      'input[type="checkbox"][data-item-id]',
    );
    for (var i = 0; i < inputs.length; i++) inputs[i].checked = !!checked;
  }

  function saveFilterSettings() {
    syncSelectionFromDom();
    var itemIds = sessionSelection || [];
    var msg =
      "已保存：将上报 " + itemIds.length + " 个勾选商品（20 分钟时间槽）";
    if (goodsMetaEl) {
      getActiveTabId(function (tabId) {
        chrome.storage.local.get(
          [KEYS.liveJsonCatalogByTab, KEYS.liveJsonCatalog],
          function (r) {
            var byCat = r[KEYS.liveJsonCatalogByTab] || {};
            var cat =
              tabId != null &&
              Object.prototype.hasOwnProperty.call(byCat, String(tabId))
                ? byCat[String(tabId)]
                : r[KEYS.liveJsonCatalog];
            var extra = "";
            if (cat && cat.updatedAt)
              extra = " · 列表捕获于 " + formatCatalogTime(cat.updatedAt);
            goodsMetaEl.textContent = msg + extra;
          },
        );
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

  function getNumberInput(el, fallback, min, max) {
    if (!el) return fallback;
    var v = Number(el.value);
    if (v !== v) return fallback;
    if (typeof min === "number") v = Math.max(min, v);
    if (typeof max === "number") v = Math.min(max, v);
    return v;
  }

  function calcIntervalSec() {
    var v = getNumberInput(pollIntervalValueEl, 5, 1, 999);
    var unit = pollIntervalUnitEl
      ? String(pollIntervalUnitEl.value || "min")
      : "min";
    if (unit === "sec") return Math.max(5, Math.floor(v));
    if (unit === "hour") return Math.max(5, Math.floor(v * 3600));
    // default min
    return Math.max(5, Math.floor(v * 60));
  }

  function setPollMeta(msg) {
    if (!pollMetaEl) return;
    pollMetaEl.textContent = msg ? String(msg) : "";
  }

  function sendToActiveSycmTab(message, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0] ? tabs[0] : null;
      if (!tab || !tab.id) {
        callback && callback({ ok: false, error: "no_tab" });
        return;
      }
      chrome.tabs.sendMessage(tab.id, message, function (res) {
        if (chrome.runtime.lastError) {
          callback && callback({ ok: false, error: "no_content" });
          return;
        }
        callback && callback(res || { ok: true });
      });
    });
  }

  function onPollStart() {
    var intervalSec = calcIntervalSec();
    var maxConcurrency = 1;
    setPollMeta("正在启动…请保持该生意参谋页面打开");
    sendToActiveSycmTab(
      {
        type: "SYCM_FLOW_POLL_START",
        intervalSec: intervalSec,
        maxConcurrency: maxConcurrency,
      },
      function (res) {
        if (!res || !res.ok) {
          if (res && res.error === "no_items") {
            setPollMeta("未勾选商品：请先在列表中勾选并保存设置");
          } else if (res && res.error === "no_template") {
            setPollMeta(
              "未捕获详情接口模板：请先打开任意商品详情页触发一次详情接口",
            );
          } else {
            setPollMeta("无法启动：请在 sycm.taobao.com 页面打开扩展后重试");
          }
          return;
        }
        setPollMeta("已启动：当前勾选 " + (res.itemCount || 0) + " 个商品");
      },
    );
  }

  function onPollStop() {
    setPollMeta("正在停止…");
    sendToActiveSycmTab({ type: "SYCM_FLOW_POLL_STOP" }, function () {
      setPollMeta("已停止");
    });
  }

  loadLogs();
  loadGoodsUi();

  if (logsClearBtn) logsClearBtn.addEventListener("click", clearLogs);
  if (logsExportBtn)
    logsExportBtn.addEventListener("click", exportLogsToClipboard);
  if (goodsRefreshBtn) {
    goodsRefreshBtn.addEventListener("click", function () {
      sessionSelection = null;
      loadGoodsUi();
    });
  }
  if (goodsSelectAllBtn) {
    goodsSelectAllBtn.addEventListener("click", function () {
      setAllCheckboxes(true);
      syncSelectionFromDom();
    });
  }
  if (goodsSelectNoneBtn) {
    goodsSelectNoneBtn.addEventListener("click", function () {
      setAllCheckboxes(false);
      syncSelectionFromDom();
    });
  }
  if (goodsSaveBtn) goodsSaveBtn.addEventListener("click", saveFilterSettings);
  if (pollStartBtn) pollStartBtn.addEventListener("click", onPollStart);
  if (pollStopBtn) pollStopBtn.addEventListener("click", onPollStop);

  if (goodsListEl) {
    goodsListEl.addEventListener("change", function (e) {
      var t = e.target;
      if (t && t.matches && t.matches('input[type="checkbox"][data-item-id]')) {
        syncSelectionFromDom();
      }
    });
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    if (
      changes[KEYS.liveJsonCatalog] ||
      changes[KEYS.liveJsonCatalogByTab] ||
      changes[KEYS.liveJsonFilterByTab]
    ) {
      scheduleLoadGoodsFromCatalog();
    }
  });

  var refreshInterval = null;
  // 使用消息驱动替代高频轮询，作为回退每 30s 拉取一次
  function startLogPoll() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadLogs, 30000);
  }
  function stopLogPoll() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = null;
  }
  // 当 popup 获得焦点时加载并开启低频回退轮询
  window.addEventListener("focus", function () {
    loadLogs();
    loadGoodsUi();
    startLogPoll();
  });
  window.addEventListener("blur", stopLogPoll);
  startLogPoll();

  // 实时更新：监听 background/logger 的消息推送
  try {
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (!msg || msg.type !== "SYCM_LOG_APPENDED") return false;
      // 若消息携带 tabId，则只在与当前 tabId 相同的情形下刷新
      getActiveTabId(function (tabId) {
        if (
          msg.tabId == null ||
          tabId == null ||
          String(msg.tabId) === String(tabId)
        ) {
          loadLogs();
        }
      });
      return false;
    });
  } catch (e) {}
})();
