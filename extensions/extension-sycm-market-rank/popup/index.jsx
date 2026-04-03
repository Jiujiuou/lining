import { Fragment, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createMessageTabIdResolver, queryActiveTabId } from '../../shared/chrome/runtime.js';
import { createTabbedLogger } from '../../shared/chrome/tabbed-logger.js';
import { pruneByMeta, safeSet } from '../../shared/chrome/storage.js';
import { formatLogTime } from '../../shared/ui/text.js';
import {
  LOG_MAX_ENTRIES,
  LOG_MAX_TABS,
  RANK_MAX_ITEMS,
  RANK_MAX_TABS,
  RUNTIME,
  STORAGE_KEYS as KEYS,
} from '../defaults.js';

const SELECTION_META_KEY = '__meta';
const EMPTY_LIST_TEXT = '暂无数据。请在生意参谋触发 rank.json 后点击“刷新列表”。';

const popupBridge = {
  setLogs() {},
  setRankRows() {},
  setRankMeta() {},
  setSelectedKeys() {},
  getSelectedKeys() {
    return [];
  },
  getRankRows() {
    return [];
  },
  onToggleKey() {},
};

function rowKey(row, index) {
  if (row && row.itemId != null && String(row.itemId).trim() !== '') return String(row.itemId);
  return `idx-${index}`;
}

function getKeyIdsFromFilter(filter) {
  if (!filter || !Array.isArray(filter.itemIds)) return [];
  return filter.itemIds.map((key) => String(key));
}

function filterIdsToCatalog(ids, items) {
  const inCatalog = {};
  for (let i = 0; i < items.length; i += 1) {
    inCatalog[rowKey(items[i], i)] = true;
  }
  return ids.filter((id) => inCatalog[id]);
}

function normalizeKeys(keys) {
  const seen = new Set();
  const out = [];
  for (let i = 0; i < keys.length; i += 1) {
    const key = String(keys[i] || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= RANK_MAX_ITEMS) break;
  }
  return out;
}

function formatRankMeta(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return '';
  const segments = [];
  if (snapshot.keyWord != null && String(snapshot.keyWord).trim() !== '') {
    segments.push(`搜索词：${String(snapshot.keyWord).trim()}`);
  } else {
    segments.push('搜索词：（空，未传 keyWord）');
  }
  if (snapshot.updateTime) {
    segments.push(`接口更新：${snapshot.updateTime}`);
  }
  return segments.join(' · ');
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
  const [rankRows, setRankRows] = useState([]);
  const [rankMeta, setRankMeta] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const logsListRef = useRef(null);
  const selectedKeysRef = useRef([]);
  const rankRowsRef = useRef([]);
  const shouldStickLogsRef = useRef(true);

  useEffect(() => {
    selectedKeysRef.current = selectedKeys;
  }, [selectedKeys]);

  useEffect(() => {
    rankRowsRef.current = rankRows;
  }, [rankRows]);

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
    popupBridge.setRankRows = (rows) => {
      setRankRows(Array.isArray(rows) ? rows.slice() : []);
    };
    popupBridge.setRankMeta = (text) => {
      setRankMeta(String(text || ''));
    };
    popupBridge.setSelectedKeys = (keys) => {
      const next = normalizeKeys(Array.isArray(keys) ? keys : []);
      selectedKeysRef.current = next;
      setSelectedKeys(next);
    };
    popupBridge.getSelectedKeys = () => selectedKeysRef.current.slice();
    popupBridge.getRankRows = () => rankRowsRef.current.slice();

    const cleanup = initPopup();
    return () => {
      if (typeof cleanup === 'function') cleanup();
      popupBridge.setLogs = () => {};
      popupBridge.setRankRows = () => {};
      popupBridge.setRankMeta = () => {};
      popupBridge.setSelectedKeys = () => {};
      popupBridge.getSelectedKeys = () => [];
      popupBridge.getRankRows = () => [];
      popupBridge.onToggleKey = () => {};
    };
  }, []);

  const selectedSet = new Set(selectedKeys);
  const hasRows = rankRows.length > 0;

  return (
    <div className="popup">
      <div className="popup-left">
        <section className="popup-section popup-section--findpage">
          <header className="popup-findpage-header popup-goods-actions">
            <h2 className="popup-findpage-title">市场排名</h2>
            <button type="button" id="rank-refresh" className="popup-findpage-refresh" aria-label="刷新列表">
              刷新列表
            </button>
            <button type="button" id="rank-select-all" className="popup-findpage-refresh">
              全选
            </button>
            <button type="button" id="rank-select-none" className="popup-findpage-refresh">
              全不选
            </button>
            <button type="button" id="rank-save" className="popup-open-sites">
              保存设置
            </button>
          </header>
          <p id="rank-meta" className="popup-rank-meta popup-goods-meta" aria-live="polite">
            {rankMeta}
          </p>
          <div
            id="rank-list"
            className={`popup-findpage-list${hasRows ? '' : ' popup-findpage-list--empty'}`}
            role="list"
          >
            {!hasRows ? (
              <div className="popup-findpage-list--empty">
                <span>{EMPTY_LIST_TEXT}</span>
              </div>
            ) : (
              rankRows.map((row, index) => (
                <div className="popup-findpage-item" role="listitem" title={row.titleAttr} key={`${row.key}-${index}`}>
                  <input
                    type="checkbox"
                    id={`rank-cb-${index}`}
                    data-item-key={row.key}
                    aria-label={`勾选 ${row.shopLabel}`}
                    checked={selectedSet.has(row.key)}
                    onChange={(event) => {
                      popupBridge.onToggleKey(row.key, event.target.checked);
                    }}
                  />
                  <span className="popup-rank-num">{row.rankText}</span>
                  <label className="popup-findpage-name popup-findpage-name--stack" htmlFor={`rank-cb-${index}`}>
                    <span className="popup-findpage-shop">{row.shopLabel}</span>
                    {row.itemTitle ? <span className="popup-rank-item-title">{row.itemTitle}</span> : null}
                  </label>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
      <section className="popup-section popup-section--logs">
        <header className="popup-logs-header">
          <h2 className="popup-logs-title">日志</h2>
          <button type="button" id="logs-clear" className="popup-logs-clear" aria-label="清空日志">
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
    storageKeys: { logs: KEYS.logs, logsByTab: KEYS.logsByTab },
    maxEntries: LOG_MAX_ENTRIES,
    maxTabs: LOG_MAX_TABS,
    resolveTabId: createMessageTabIdResolver(RUNTIME.GET_TAB_ID_MESSAGE),
  });

  const logsClearBtn = document.getElementById('logs-clear');
  const rankRefreshBtn = document.getElementById('rank-refresh');
  const rankSelectAllBtn = document.getElementById('rank-select-all');
  const rankSelectNoneBtn = document.getElementById('rank-select-none');
  const rankSaveBtn = document.getElementById('rank-save');

  let refreshInterval = null;
  let catalogTimer = null;
  let isDisposed = false;
  let sessionSelection = null;

  function getActiveTabId(callback) {
    queryActiveTabId({ active: true, currentWindow: true }, callback);
  }

  function pruneSelectionByTab(byTab) {
    return pruneByMeta(byTab, SELECTION_META_KEY, RANK_MAX_TABS);
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

  function persistSelection(nextKeys) {
    const slice = normalizeKeys(Array.isArray(nextKeys) ? nextKeys : []);
    getActiveTabId((tabId) => {
      if (tabId == null) {
        safeSet(
          { [KEYS.rankSelection]: { itemIds: slice } },
          () => {},
          (retry) => {
            chrome.storage.local.remove([KEYS.rankSelection], () => {
              retry();
            });
          },
        );
        return;
      }

      chrome.storage.local.get([KEYS.rankSelectionByTab], (result) => {
        let byTab = result && result[KEYS.rankSelectionByTab] ? result[KEYS.rankSelectionByTab] : {};
        byTab[String(tabId)] = { itemIds: slice };

        const meta =
          byTab[SELECTION_META_KEY] && typeof byTab[SELECTION_META_KEY] === 'object'
            ? byTab[SELECTION_META_KEY]
            : {};
        meta[String(tabId)] = new Date().toISOString();
        byTab[SELECTION_META_KEY] = meta;
        byTab = pruneSelectionByTab(byTab);

        safeSet(
          { [KEYS.rankSelectionByTab]: byTab },
          () => {},
          (retry) => {
            const pruned = pruneSelectionByTab(byTab);
            safeSet({ [KEYS.rankSelectionByTab]: pruned }, retry);
          },
        );
      });
    });
  }

  function syncSelection(nextKeys) {
    const normalized = normalizeKeys(Array.isArray(nextKeys) ? nextKeys : []);
    sessionSelection = normalized.slice();
    popupBridge.setSelectedKeys(normalized);
    persistSelection(normalized);
  }

  function buildRows(snapshot) {
    const items = snapshot && Array.isArray(snapshot.items) ? snapshot.items : [];
    return items.map((row, index) => {
      const key = rowKey(row, index);
      const rankText = row && row.rank != null ? String(row.rank) : '—';
      const shopLabel =
        row && row.shopTitle != null && String(row.shopTitle).trim() !== ''
          ? String(row.shopTitle).trim()
          : '（无店铺名）';
      const itemTitle =
        row && row.itemTitle != null && String(row.itemTitle).trim() !== ''
          ? String(row.itemTitle).trim()
          : '';
      const titleAttr = itemTitle ? `${shopLabel} · ${itemTitle}` : shopLabel;
      return { key, rankText, shopLabel, itemTitle, titleAttr };
    });
  }

  function loadRank() {
    chrome.storage.local.get(
      [KEYS.rankListByTab, KEYS.rankListLatest, KEYS.rankSelectionByTab, KEYS.rankSelection],
      (result) => {
        getActiveTabId((tabId) => {
          if (isDisposed) return;

          let snapshot = null;
          if (tabId != null && result[KEYS.rankListByTab] && result[KEYS.rankListByTab][String(tabId)]) {
            snapshot = result[KEYS.rankListByTab][String(tabId)];
          } else if (result[KEYS.rankListLatest]) {
            snapshot = result[KEYS.rankListLatest];
          }

          let filter;
          if (tabId != null && result[KEYS.rankSelectionByTab] && result[KEYS.rankSelectionByTab][String(tabId)]) {
            filter = result[KEYS.rankSelectionByTab][String(tabId)];
          } else {
            filter = result[KEYS.rankSelection];
          }

          const items = snapshot && Array.isArray(snapshot.items) ? snapshot.items : [];
          const idsFromStorage = getKeyIdsFromFilter(filter);
          const baseIds = sessionSelection !== null ? sessionSelection : idsFromStorage;
          const selected = normalizeKeys(filterIdsToCatalog(baseIds, items));

          if (sessionSelection !== null && selected.length !== baseIds.length) {
            sessionSelection = selected.slice();
            persistSelection(selected);
          }

          popupBridge.setRankRows(buildRows(snapshot || { items: [] }));
          popupBridge.setSelectedKeys(selected);
          popupBridge.setRankMeta(formatRankMeta(snapshot));
        });
      },
    );
  }

  function onRefreshClick() {
    loadRank();
    loadLogs();
    chrome.storage.local.get([KEYS.rankListByTab, KEYS.rankListLatest], (result) => {
      getActiveTabId((tabId) => {
        const snapshot =
          tabId != null && result[KEYS.rankListByTab] && result[KEYS.rankListByTab][String(tabId)]
            ? result[KEYS.rankListByTab][String(tabId)]
            : result[KEYS.rankListLatest];
        const count = snapshot && Array.isArray(snapshot.items) ? snapshot.items.length : 0;
        logger.log(`[市场排名] 刷新列表：${count} 条`);
        loadLogs();
      });
    });
  }

  function onSelectAll() {
    const rows = popupBridge.getRankRows();
    syncSelection(rows.map((row) => row.key));
  }

  function onSelectNone() {
    syncSelection([]);
  }

  function onSaveSettings() {
    const selected = popupBridge.getSelectedKeys();
    syncSelection(selected);
    const message = `[市场排名] 保存筛选：已选 ${selected.length} 个店铺`;
    logger.log(message);
    loadLogs();
    popupBridge.setRankMeta(message);
  }

  popupBridge.onToggleKey = (key, checked) => {
    const set = new Set(popupBridge.getSelectedKeys());
    if (checked) {
      if (set.size >= RANK_MAX_ITEMS) return;
      set.add(String(key));
    } else {
      set.delete(String(key));
    }
    syncSelection(Array.from(set));
  };

  function onStorageChanged(changes, area) {
    if (area !== 'local') return;
    if (
      changes[KEYS.rankListByTab] ||
      changes[KEYS.rankListLatest] ||
      changes[KEYS.rankSelectionByTab] ||
      changes[KEYS.rankSelection]
    ) {
      if (catalogTimer) clearTimeout(catalogTimer);
      catalogTimer = setTimeout(() => {
        catalogTimer = null;
        loadRank();
      }, 200);
    }
    if (changes[KEYS.logsByTab] || (KEYS.logs && changes[KEYS.logs])) {
      loadLogs();
    }
  }

  function startLogPoll() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadLogs, 2000);
  }

  function stopLogPoll() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = null;
  }

  function onFocus() {
    loadRank();
    loadLogs();
    startLogPoll();
  }

  function onBlur() {
    stopLogPoll();
  }

  loadRank();
  loadLogs();
  startLogPoll();

  if (rankRefreshBtn) rankRefreshBtn.addEventListener('click', onRefreshClick);
  if (rankSelectAllBtn) rankSelectAllBtn.addEventListener('click', onSelectAll);
  if (rankSelectNoneBtn) rankSelectNoneBtn.addEventListener('click', onSelectNone);
  if (rankSaveBtn) rankSaveBtn.addEventListener('click', onSaveSettings);
  if (logsClearBtn) logsClearBtn.addEventListener('click', clearLogs);

  chrome.storage.onChanged.addListener(onStorageChanged);
  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onBlur);

  return () => {
    isDisposed = true;
    popupInitialized = false;
    popupBridge.onToggleKey = () => {};
    if (catalogTimer) clearTimeout(catalogTimer);
    stopLogPoll();
    if (rankRefreshBtn) rankRefreshBtn.removeEventListener('click', onRefreshClick);
    if (rankSelectAllBtn) rankSelectAllBtn.removeEventListener('click', onSelectAll);
    if (rankSelectNoneBtn) rankSelectNoneBtn.removeEventListener('click', onSelectNone);
    if (rankSaveBtn) rankSaveBtn.removeEventListener('click', onSaveSettings);
    if (logsClearBtn) logsClearBtn.removeEventListener('click', clearLogs);
    chrome.storage.onChanged.removeListener(onStorageChanged);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('blur', onBlur);
  };
}
