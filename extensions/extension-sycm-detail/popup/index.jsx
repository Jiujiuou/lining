import { Fragment, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createMessageTabIdResolver, queryActiveTabId } from '../../shared/chrome/runtime.js';
import { createTabbedLogger } from '../../shared/chrome/tabbed-logger.js';
import { getScopedState, saveScopedState } from '../../shared/chrome/tab-state.js';
import { safeSet } from '../../shared/chrome/storage.js';
import { formatLogTime } from '../../shared/ui/text.js';
import {
  LIVE_JSON_MAX_ITEMS,
  LIVE_JSON_MAX_TABS,
  LOG_MAX_ENTRIES,
  LOG_MAX_TABS,
  MESSAGE_TYPES,
  STORAGE_KEYS,
} from '../defaults.js';

const FILTER_META_KEY = '__meta';
const EMPTY_GOODS_TEXT = '暂无数据，请在生意参谋页面触发 live.json 后再刷新列表';

const popupBridge = {
  setLogs() {},
  setGoodsRows() {},
  setGoodsMeta() {},
  setPollMeta() {},
  setSelectedItemIds() {},
  getSelectedItemIds() {
    return [];
  },
  getGoodsRows() {
    return [];
  },
  onToggleItem() {},
};

function normalizeItemIds(itemIds) {
  const seen = new Set();
  const out = [];
  for (let i = 0; i < itemIds.length; i += 1) {
    const itemId = String(itemIds[i] || '').trim();
    if (!itemId || seen.has(itemId)) continue;
    seen.add(itemId);
    out.push(itemId);
    if (out.length >= LIVE_JSON_MAX_ITEMS) break;
  }
  return out;
}

function getItemIdsFromFilter(filter) {
  if (!filter || !Array.isArray(filter.itemIds)) return [];
  return filter.itemIds.map((itemId) => String(itemId));
}

function filterIdsToCatalog(itemIds, items) {
  const inCatalog = new Set(
    (Array.isArray(items) ? items : [])
      .filter((item) => item && item.item_id != null)
      .map((item) => String(item.item_id)),
  );
  return itemIds.filter((itemId) => inCatalog.has(String(itemId)));
}

function formatCatalogTime(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return '';
  }
}

function renderMultilineText(text) {
  const lines = String(text == null ? '' : text).split('\n');
  return lines.map((line, index) => (
    <Fragment key={`${line}-${index}`}>
      {line}
      {index < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}

function PopupShell() {
  const [logs, setLogs] = useState([]);
  const [goodsRows, setGoodsRows] = useState([]);
  const [goodsMeta, setGoodsMeta] = useState('');
  const [pollMeta, setPollMeta] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const logsListRef = useRef(null);
  const goodsRowsRef = useRef([]);
  const selectedItemIdsRef = useRef([]);
  const shouldStickLogsRef = useRef(true);

  useEffect(() => {
    goodsRowsRef.current = goodsRows;
  }, [goodsRows]);

  useEffect(() => {
    selectedItemIdsRef.current = selectedItemIds;
  }, [selectedItemIds]);

  useEffect(() => {
    const el = logsListRef.current;
    if (!el) return;
    if (shouldStickLogsRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    popupBridge.setLogs = (entries) => {
      setLogs(Array.isArray(entries) ? entries.slice() : []);
    };
    popupBridge.setGoodsRows = (rows) => {
      setGoodsRows(Array.isArray(rows) ? rows.slice() : []);
    };
    popupBridge.setGoodsMeta = (text) => {
      setGoodsMeta(String(text || ''));
    };
    popupBridge.setPollMeta = (text) => {
      setPollMeta(String(text || ''));
    };
    popupBridge.setSelectedItemIds = (itemIds) => {
      const normalized = normalizeItemIds(Array.isArray(itemIds) ? itemIds : []);
      selectedItemIdsRef.current = normalized;
      setSelectedItemIds(normalized);
    };
    popupBridge.getSelectedItemIds = () => selectedItemIdsRef.current.slice();
    popupBridge.getGoodsRows = () => goodsRowsRef.current.slice();

    const cleanup = initPopup();
    return () => {
      if (typeof cleanup === 'function') cleanup();
      popupBridge.setLogs = () => {};
      popupBridge.setGoodsRows = () => {};
      popupBridge.setGoodsMeta = () => {};
      popupBridge.setPollMeta = () => {};
      popupBridge.setSelectedItemIds = () => {};
      popupBridge.getSelectedItemIds = () => [];
      popupBridge.getGoodsRows = () => [];
      popupBridge.onToggleItem = () => {};
    };
  }, []);

  const selectedSet = new Set(selectedItemIds);
  const hasRows = goodsRows.length > 0;

  return (
    <div className="popup">
      <div className="popup-left">
        <section className="popup-section popup-section--goods">
          <header className="popup-findpage-header popup-goods-actions">
            <button type="button" id="goods-refresh" className="popup-findpage-refresh">
              刷新列表
            </button>
            <button type="button" id="goods-select-all" className="popup-findpage-refresh">
              全选
            </button>
            <button type="button" id="goods-select-none" className="popup-findpage-refresh">
              全不选
            </button>
            <button type="button" id="goods-save" className="popup-open-sites">
              保存设置
            </button>
          </header>
          <p id="goods-meta" className="popup-goods-meta" aria-live="polite">
            {goodsMeta}
          </p>
          <div className="popup-poll-controls" role="group" aria-label="详情指标轮询">
            <div className="popup-poll-row">
              <label className="popup-poll-label" htmlFor="poll-interval-value">
                轮询间隔
              </label>
              <div className="popup-poll-interval">
                <input
                  id="poll-interval-value"
                  className="popup-poll-input"
                  type="number"
                  min="1"
                  max="999"
                  step="1"
                  defaultValue="5"
                  inputMode="numeric"
                />
                <select id="poll-interval-unit" className="popup-poll-select" aria-label="轮询间隔单位" defaultValue="min">
                  <option value="sec">秒</option>
                  <option value="min">分</option>
                  <option value="hour">时</option>
                </select>
              </div>
            </div>
            <div className="popup-poll-row">
              <label className="popup-poll-label">并发</label>
              <div className="popup-poll-readonly" aria-label="并发固定为 1">
                1（固定）
              </div>
            </div>
            <div className="popup-poll-actions">
              <button type="button" id="poll-start" className="popup-open-sites">
                开始采集详情
              </button>
              <button type="button" id="poll-stop" className="popup-findpage-refresh">
                停止
              </button>
            </div>
            <p id="poll-meta" className="popup-goods-meta" aria-live="polite">
              {pollMeta}
            </p>
          </div>
          <div
            id="goods-list"
            className={`popup-findpage-list${hasRows ? '' : ' popup-findpage-list--empty'}`}
            role="list"
          >
            {!hasRows ? (
              <div className="popup-findpage-list--empty">
                <span>{EMPTY_GOODS_TEXT}</span>
              </div>
            ) : (
              goodsRows.map((row, index) => (
                <div className="popup-findpage-item" role="listitem" title={row.name} key={`${row.itemId}-${index}`}>
                  <input
                    type="checkbox"
                    id={`goods-cb-${index}`}
                    data-item-id={row.itemId}
                    aria-label={`上报 ${row.name}`}
                    checked={selectedSet.has(row.itemId)}
                    onChange={(event) => {
                      popupBridge.onToggleItem(row.itemId, event.target.checked);
                    }}
                  />
                  <label className="popup-findpage-name" htmlFor={`goods-cb-${index}`}>
                    {row.name}
                  </label>
                  <span className="popup-goods-id">{row.itemId}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
      <section className="popup-section popup-section--logs">
        <header className="popup-logs-header">
          <h2 className="popup-logs-title">扩展日志</h2>
          <button type="button" id="logs-export" className="popup-logs-clear" aria-label="复制扩展日志到剪贴板">
            复制
          </button>
          <button type="button" id="logs-clear" className="popup-logs-clear" aria-label="清空扩展日志">
            清空
          </button>
        </header>
        <div
          id="logs-list"
          className="popup-logs-list"
          role="log"
          aria-live="polite"
          ref={logsListRef}
          onScroll={() => {
            const el = logsListRef.current;
            if (!el) return;
            shouldStickLogsRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
          }}
        >
          {logs.length === 0 ? (
            <div className="popup-logs-empty">暂无日志</div>
          ) : (
            logs.map((entry, index) => {
              const level = entry && entry.level ? String(entry.level) : 'log';
              const time = formatLogTime(entry ? entry.t : '');
              const message = entry && entry.msg != null ? String(entry.msg) : '';
              return (
                <div className={`popup-log-card popup-log-entry popup-log-entry--${level}`} key={`${time}-${index}`}>
                  <span className="popup-log-time">{time}</span>
                  {renderMultilineText(message)}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

const mountNode = document.getElementById('popup-react-root');
if (mountNode) {
  createRoot(mountNode).render(<PopupShell />);
}

let popupInitialized = false;

function initPopup() {
  if (popupInitialized) return () => {};
  popupInitialized = true;

  const logger = createTabbedLogger({
    storageKeys: {
      logs: STORAGE_KEYS.logs,
      logsByTab: STORAGE_KEYS.logsByTab,
    },
    maxEntries: LOG_MAX_ENTRIES,
    maxTabs: LOG_MAX_TABS,
    resolveTabId: createMessageTabIdResolver(MESSAGE_TYPES.GET_TAB_ID),
  });

  const logsClearBtn = document.getElementById('logs-clear');
  const logsExportBtn = document.getElementById('logs-export');
  const goodsRefreshBtn = document.getElementById('goods-refresh');
  const goodsSelectAllBtn = document.getElementById('goods-select-all');
  const goodsSelectNoneBtn = document.getElementById('goods-select-none');
  const goodsSaveBtn = document.getElementById('goods-save');
  const pollIntervalValueEl = document.getElementById('poll-interval-value');
  const pollIntervalUnitEl = document.getElementById('poll-interval-unit');
  const pollStartBtn = document.getElementById('poll-start');
  const pollStopBtn = document.getElementById('poll-stop');

  let isDisposed = false;
  let refreshInterval = null;
  let catalogReloadTimer = null;
  let sessionSelection = null;

  function getActiveTabId(callback) {
    queryActiveTabId({ active: true, currentWindow: true }, callback);
  }

  function renderLogs(entries) {
    if (isDisposed) return;
    popupBridge.setLogs(Array.isArray(entries) ? entries : []);
  }

  function loadLogs() {
    getActiveTabId((tabId) => {
      logger.getLogs(renderLogs, tabId);
    });
  }

  function clearLogs() {
    getActiveTabId((tabId) => {
      logger.clearLogs(() => {
        loadLogs();
      }, tabId);
    });
  }

  function fallbackCopy(text, onDone) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      onDone(ok);
    } catch {
      onDone(false);
    }
  }

  function copyTextToClipboard(text, onDone) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(
        () => onDone(true),
        () => fallbackCopy(text, onDone),
      );
      return;
    }
    fallbackCopy(text, onDone);
  }

  function exportLogsToClipboard() {
    getActiveTabId((tabId) => {
      logger.getLogs((entries) => {
        const lines = (Array.isArray(entries) ? entries : []).map((entry) => {
          const time = entry && entry.t ? String(entry.t) : '';
          const level = entry && entry.level ? String(entry.level) : 'log';
          const message = entry && entry.msg != null ? String(entry.msg) : '';
          return `[${level}] ${time} ${message}`;
        });
        copyTextToClipboard(lines.join('\n'), (ok) => {
          popupBridge.setPollMeta(ok ? `日志已复制到剪贴板，共 ${lines.length} 条` : '复制失败，请检查剪贴板权限');
        });
      }, tabId);
    });
  }

  function persistItemIds(itemIds) {
    const slice = normalizeItemIds(Array.isArray(itemIds) ? itemIds : []);
    getActiveTabId((tabId) => {
      if (tabId == null) {
        safeSet(
          { [STORAGE_KEYS.liveJsonFilter]: { itemIds: slice } },
          () => {},
          (retry) => {
            chrome.storage.local.remove([STORAGE_KEYS.liveJsonFilter], retry);
          },
        );
        return;
      }

      saveScopedState({
        storageKey: STORAGE_KEYS.liveJsonFilterByTab,
        tabId,
        value: { itemIds: slice },
        maxTabs: LIVE_JSON_MAX_TABS,
        metaKey: FILTER_META_KEY,
        onDone: () => {},
      });
    });
  }

  function syncSelection(itemIds) {
    const normalized = normalizeItemIds(Array.isArray(itemIds) ? itemIds : []);
    sessionSelection = normalized.slice();
    popupBridge.setSelectedItemIds(normalized);
    persistItemIds(normalized);
  }

  function renderGoodsList(items, itemIds) {
    const rows = (Array.isArray(items) ? items : []).map((row) => ({
      itemId: row && row.item_id != null ? String(row.item_id) : '',
      name:
        row && row.item_name != null && String(row.item_name).trim() !== ''
          ? String(row.item_name).trim()
          : '（无标题）',
    }));
    popupBridge.setGoodsRows(rows);
    popupBridge.setSelectedItemIds(itemIds);
  }

  function loadGoodsUi() {
    chrome.storage.local.get(
      [
        STORAGE_KEYS.liveJsonCatalogByTab,
        STORAGE_KEYS.liveJsonFilterByTab,
        STORAGE_KEYS.liveJsonCatalog,
        STORAGE_KEYS.liveJsonFilter,
      ],
      (result) => {
        getActiveTabId((tabId) => {
          if (isDisposed) return;

          const catalog = getScopedState(
            result,
            STORAGE_KEYS.liveJsonCatalogByTab,
            STORAGE_KEYS.liveJsonCatalog,
            tabId,
          );
          const filter = getScopedState(
            result,
            STORAGE_KEYS.liveJsonFilterByTab,
            STORAGE_KEYS.liveJsonFilter,
            tabId,
          );

          const items = catalog && Array.isArray(catalog.items) ? catalog.items : [];
          const idsFromStorage = getItemIdsFromFilter(filter);
          const baseIds = sessionSelection !== null ? sessionSelection : idsFromStorage;
          const selected = normalizeItemIds(filterIdsToCatalog(baseIds, items));

          if (sessionSelection !== null && selected.length !== baseIds.length) {
            sessionSelection = selected.slice();
            persistItemIds(selected);
          }

          renderGoodsList(items, selected);

          if (catalog && catalog.updatedAt) {
            popupBridge.setGoodsMeta(`最近捕获：${formatCatalogTime(catalog.updatedAt)} | ${items.length} 个商品`);
          } else if (items.length > 0) {
            popupBridge.setGoodsMeta(`${items.length} 个商品`);
          } else {
            popupBridge.setGoodsMeta('');
          }
        });
      },
    );
  }

  function scheduleLoadGoodsFromCatalog() {
    if (catalogReloadTimer) clearTimeout(catalogReloadTimer);
    catalogReloadTimer = setTimeout(() => {
      catalogReloadTimer = null;
      loadGoodsUi();
    }, 200);
  }

  function getNumberInput(element, fallback, min, max) {
    if (!element) return fallback;
    let value = Number(element.value);
    if (Number.isNaN(value)) return fallback;
    if (typeof min === 'number') value = Math.max(min, value);
    if (typeof max === 'number') value = Math.min(max, value);
    return value;
  }

  function calcIntervalSec() {
    const value = getNumberInput(pollIntervalValueEl, 5, 1, 999);
    const unit = pollIntervalUnitEl ? String(pollIntervalUnitEl.value || 'min') : 'min';
    if (unit === 'sec') return Math.max(5, Math.floor(value));
    if (unit === 'hour') return Math.max(5, Math.floor(value * 3600));
    return Math.max(5, Math.floor(value * 60));
  }

  function sendToActiveSycmTab(message, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0] ? tabs[0] : null;
      if (!tab || !tab.id) {
        callback({ ok: false, error: 'no_tab' });
        return;
      }
      chrome.tabs.sendMessage(tab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          callback({ ok: false, error: 'no_content' });
          return;
        }
        callback(response || { ok: true });
      });
    });
  }

  function onPollStart() {
    popupBridge.setPollMeta('正在启动，请保持生意参谋页面打开');
    sendToActiveSycmTab(
      {
        type: MESSAGE_TYPES.FLOW_POLL_START,
        intervalSec: calcIntervalSec(),
        maxConcurrency: 1,
      },
      (response) => {
        if (!response || !response.ok) {
          if (response && response.error === 'no_items') {
            popupBridge.setPollMeta('未选择商品，请先保存筛选');
            return;
          }
          if (response && response.error === 'no_template') {
            popupBridge.setPollMeta('未捕获详情模板，请先打开任意商品详情页');
            return;
          }
          popupBridge.setPollMeta('启动失败，请在 sycm.taobao.com 页面重试');
          return;
        }
        popupBridge.setPollMeta(`已启动，当前选中 ${response.itemCount || 0} 个商品`);
      },
    );
  }

  function onPollStop() {
    popupBridge.setPollMeta('正在停止...');
    sendToActiveSycmTab({ type: MESSAGE_TYPES.FLOW_POLL_STOP }, () => {
      popupBridge.setPollMeta('已停止');
    });
  }

  function onSelectAll() {
    const rows = popupBridge.getGoodsRows();
    syncSelection(rows.map((row) => row.itemId));
  }

  function onSelectNone() {
    syncSelection([]);
  }

  function onSaveFilter() {
    const selected = popupBridge.getSelectedItemIds();
    syncSelection(selected);
    popupBridge.setGoodsMeta(`已保存：将上报 ${selected.length} 个勾选商品`);
  }

  function onRefreshGoods() {
    sessionSelection = null;
    loadGoodsUi();
  }

  function startLogPoll() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadLogs, 30000);
  }

  function stopLogPoll() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = null;
  }

  function onFocus() {
    loadLogs();
    loadGoodsUi();
    startLogPoll();
  }

  function onBlur() {
    stopLogPoll();
  }

  function onStorageChanged(changes, areaName) {
    if (areaName !== 'local') return;
    if (
      changes[STORAGE_KEYS.liveJsonCatalog] ||
      changes[STORAGE_KEYS.liveJsonCatalogByTab] ||
      changes[STORAGE_KEYS.liveJsonFilterByTab]
    ) {
      scheduleLoadGoodsFromCatalog();
    }
  }

  function onRuntimeMessage(message) {
    if (!message || message.type !== 'SYCM_LOG_APPENDED') return false;
    getActiveTabId((tabId) => {
      if (message.tabId == null || tabId == null || String(message.tabId) === String(tabId)) {
        loadLogs();
      }
    });
    return false;
  }

  popupBridge.onToggleItem = (itemId, checked) => {
    const set = new Set(popupBridge.getSelectedItemIds());
    const key = String(itemId || '').trim();
    if (!key) return;
    if (checked) {
      if (set.size >= LIVE_JSON_MAX_ITEMS) return;
      set.add(key);
    } else {
      set.delete(key);
    }
    syncSelection(Array.from(set));
  };

  loadLogs();
  loadGoodsUi();
  startLogPoll();

  if (logsClearBtn) logsClearBtn.addEventListener('click', clearLogs);
  if (logsExportBtn) logsExportBtn.addEventListener('click', exportLogsToClipboard);
  if (goodsRefreshBtn) goodsRefreshBtn.addEventListener('click', onRefreshGoods);
  if (goodsSelectAllBtn) goodsSelectAllBtn.addEventListener('click', onSelectAll);
  if (goodsSelectNoneBtn) goodsSelectNoneBtn.addEventListener('click', onSelectNone);
  if (goodsSaveBtn) goodsSaveBtn.addEventListener('click', onSaveFilter);
  if (pollStartBtn) pollStartBtn.addEventListener('click', onPollStart);
  if (pollStopBtn) pollStopBtn.addEventListener('click', onPollStop);

  chrome.storage.onChanged.addListener(onStorageChanged);
  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onBlur);
  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  return () => {
    isDisposed = true;
    popupInitialized = false;
    popupBridge.onToggleItem = () => {};
    if (catalogReloadTimer) clearTimeout(catalogReloadTimer);
    stopLogPoll();
    if (logsClearBtn) logsClearBtn.removeEventListener('click', clearLogs);
    if (logsExportBtn) logsExportBtn.removeEventListener('click', exportLogsToClipboard);
    if (goodsRefreshBtn) goodsRefreshBtn.removeEventListener('click', onRefreshGoods);
    if (goodsSelectAllBtn) goodsSelectAllBtn.removeEventListener('click', onSelectAll);
    if (goodsSelectNoneBtn) goodsSelectNoneBtn.removeEventListener('click', onSelectNone);
    if (goodsSaveBtn) goodsSaveBtn.removeEventListener('click', onSaveFilter);
    if (pollStartBtn) pollStartBtn.removeEventListener('click', onPollStart);
    if (pollStopBtn) pollStopBtn.removeEventListener('click', onPollStop);
    chrome.storage.onChanged.removeListener(onStorageChanged);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('blur', onBlur);
    chrome.runtime.onMessage.removeListener(onRuntimeMessage);
  };
}
