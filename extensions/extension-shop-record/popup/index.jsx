import { Fragment, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createMessageTabIdResolver } from '../../shared/chrome/runtime.js';
import { createTabbedLogger } from '../../shared/chrome/tabbed-logger.js';
import { formatLogTime } from '../../shared/ui/text.js';
import { getLocalDateYmd } from '../../shared/time/date-key.js';
import { MESSAGE_TYPES, SHOP_RECORD_DEFAULTS } from '../defaults.js';

const METRIC_COL_LEFT = [
  { key: 'item_desc_match_score', label: '宝贝与描述相符' },
  { key: 'seller_service_score', label: '卖家服务态度' },
  { key: 'seller_shipping_score', label: '卖家发货速度' },
  { key: 'refund_finish_duration', label: '退款完结时长' },
  { key: 'refund_finish_rate', label: '退款自主完结率' },
  { key: 'dispute_refund_rate', label: '退款纠纷率' },
  { key: 'taobao_cps_spend_yuan', label: '淘宝客花费（元）' },
  { key: 'ztc_charge_yuan', label: '直通车花费（元）' },
  { key: 'ztc_cvr', label: '直通车转化率' },
  { key: 'ztc_ppc', label: '直通车PPC' },
  { key: 'ztc_roi', label: '直通车ROI' },
  { key: 'ylmf_charge_yuan', label: '引力魔方花费（元）' },
  { key: 'ylmf_ppc', label: '引力魔方PPC' },
  { key: null, label: '抖音推广花费', placeholder: 'zero' },
  { key: null, label: '超级直播花费', placeholder: 'zero' },
  { key: 'site_wide_charge_yuan', label: '全站推广花费（元）' },
  { key: 'content_promo_charge_yuan', label: '内容推广花费（元）' },
  { key: null, label: '总推广花费', placeholder: 'dash' },
];

const METRIC_COL_RIGHT = [
  { key: 'sycm_pv', label: '浏览量PV' },
  { key: 'sycm_uv', label: '访客数UV' },
  { key: 'sycm_pay_buyers', label: '支付买家数' },
  { key: 'sycm_pay_items', label: '支付商品件数' },
  { key: 'sycm_pay_amount', label: '支付金额（元）' },
  { key: 'sycm_aov', label: '客单价（元）' },
  { key: 'sycm_pay_cvr', label: '支付转化率' },
  { key: 'sycm_old_visitor_ratio', label: '老访客数占比' },
  { key: 'sycm_avg_stay_sec', label: '人均停留时长（秒）' },
  { key: 'sycm_avg_pv_depth', label: '人均浏览量（访问深度）' },
  { key: 'sycm_bounce_rate', label: '跳失率' },
  { key: 'ylmf_cvr', label: '引力魔方转化率' },
  { key: 'ylmf_roi', label: '引力魔方ROI' },
  { key: null, label: '品销宝花费', placeholder: 'zero' },
  { key: null, label: '钻展花费', placeholder: 'zero' },
  { key: 'site_wide_roi', label: '全站推广ROI' },
  { key: 'content_promo_roi', label: '内容推广ROI' },
  { key: null, label: '推广占比', placeholder: 'dash' },
];

const popupBridge = {
  setLogs() {},
  setDailySnapshot() {},
  setMetricsDate() {},
};

function yesterdayYmd() {
  return getLocalDateYmd(-1);
}

function formatMetricCell(snapshot, item) {
  if (!item) return '—';
  if (item.placeholder === 'zero') return '0';
  if (item.placeholder === 'dash') return '—';
  if (!item.key) return '—';
  const raw = snapshot ? snapshot[item.key] : null;
  const hasValue = raw !== undefined && raw !== null && String(raw).replace(/\s/g, '') !== '';
  return hasValue ? String(raw) : '—';
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
  const [dailySnapshot, setDailySnapshot] = useState(null);
  const [metricsDate, setMetricsDate] = useState('--');
  const logsListRef = useRef(null);
  const shouldStickLogsRef = useRef(true);

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
    popupBridge.setDailySnapshot = (snapshot) => {
      setDailySnapshot(snapshot && typeof snapshot === 'object' ? { ...snapshot } : null);
    };
    popupBridge.setMetricsDate = (dateText) => {
      setMetricsDate(String(dateText || '--'));
    };

    const cleanup = initPopup();
    return () => {
      if (typeof cleanup === 'function') cleanup();
      popupBridge.setLogs = () => {};
      popupBridge.setDailySnapshot = () => {};
      popupBridge.setMetricsDate = () => {};
    };
  }, []);

  const rowCount = Math.max(METRIC_COL_LEFT.length, METRIC_COL_RIGHT.length);

  return (
    <div id="app-main" className="popup">
      <div className="popup-left">
        <section className="popup-section popup-section--controls" aria-label="控制区">
          <div className="popup-controls-page-row">
            <button type="button" id="shop-rate-open" className="popup-open-sites">
              店铺评分
            </button>
            <button type="button" id="alimama-open" className="popup-open-sites">
              淘宝联盟
            </button>
            <button type="button" id="onebp-open" className="popup-open-sites">
              万相台搜索
            </button>
            <button type="button" id="onebp-display-open" className="popup-open-sites">
              万相台展示
            </button>
            <button type="button" id="onebp-site-open" className="popup-open-sites">
              万相台全站
            </button>
            <button type="button" id="onebp-shortvideo-open" className="popup-open-sites">
              万相台短视频
            </button>
            <button type="button" id="sycm-my-space-open" className="popup-open-sites">
              千牛后台
            </button>
            <button type="button" id="report-submit-open" className="popup-open-sites">
              上报页
            </button>
          </div>
          <div className="popup-controls-action-row">
            <button type="button" id="open-all-pages" className="popup-open-sites popup-open-all">
              一键打开所有页面
            </button>
            <button
              type="button"
              id="report-submit-fill"
              className="popup-open-sites popup-open-sites--fill"
              title="将本地合并数据填入联核 OA 上报页（需已打开或自动打开上报页）"
            >
              自动填充数据
            </button>
            <div id="metrics-date" className="popup-metrics-inline-date">
              {metricsDate}
            </div>
            <button
              type="button"
              id="daily-local-clear"
              className="popup-open-sites popup-open-sites--clear"
              title="清除合并后的每日指标快照（不影响云端）"
            >
              清空本地数据
            </button>
          </div>
        </section>
        <section
          className="popup-section popup-section--findpage popup-section--findpage-tight"
          id="shop-record-findpage-section"
        >
          <div
            id="shop-record-body"
            className="popup-findpage-list popup-findpage-list--metrics"
            role="region"
            aria-label="主内容区"
          >
            {!dailySnapshot ? (
              <div className="popup-findpage-list--empty">暂无本地快照。各页面采集后会自动写入。</div>
            ) : (
              <div className="popup-metrics-grid" role="table" aria-label="本地合并指标">
                {Array.from({ length: rowCount }).map((_, index) => {
                  const left = METRIC_COL_LEFT[index];
                  const right = METRIC_COL_RIGHT[index];
                  const zebra =
                    index % 2 === 0 ? 'popup-metric-grid-row--zebra-a' : 'popup-metric-grid-row--zebra-b';
                  return (
                    <div className={`popup-metric-grid-row ${zebra}`} key={`metric-row-${index}`}>
                      <span className="popup-metric-cell popup-metric-cell--label">{left ? left.label : ''}</span>
                      <span className="popup-metric-cell popup-metric-cell--value">
                        {formatMetricCell(dailySnapshot, left)}
                      </span>
                      <span className="popup-metric-cell popup-metric-cell--spacer" aria-hidden="true"></span>
                      <span className="popup-metric-cell popup-metric-cell--label">{right ? right.label : ''}</span>
                      <span className="popup-metric-cell popup-metric-cell--value">
                        {formatMetricCell(dailySnapshot, right)}
                      </span>
                    </div>
                  );
                })}
              </div>
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

  const defaults = SHOP_RECORD_DEFAULTS;
  const logger = createTabbedLogger({
    storageKeys: {
      logs: defaults.STORAGE_KEYS.logs,
      logsByTab: defaults.STORAGE_KEYS.logsByTab,
    },
    maxEntries: defaults.LOG_MAX_ENTRIES,
    maxTabs: defaults.LOG_MAX_TABS,
    resolveTabId: createMessageTabIdResolver(MESSAGE_TYPES.GET_TAB_ID),
  });

  const logsClearBtn = document.getElementById('logs-clear');
  const openAllPagesBtn = document.getElementById('open-all-pages');
  const shopRateOpenBtn = document.getElementById('shop-rate-open');
  const alimamaOpenBtn = document.getElementById('alimama-open');
  const onebpOpenBtn = document.getElementById('onebp-open');
  const onebpDisplayOpenBtn = document.getElementById('onebp-display-open');
  const onebpSiteOpenBtn = document.getElementById('onebp-site-open');
  const onebpShortVideoOpenBtn = document.getElementById('onebp-shortvideo-open');
  const sycmMySpaceOpenBtn = document.getElementById('sycm-my-space-open');
  const reportSubmitOpenBtn = document.getElementById('report-submit-open');
  const dailyLocalClearBtn = document.getElementById('daily-local-clear');
  const reportSubmitFillBtn = document.getElementById('report-submit-fill');

  let refreshInterval = null;
  let isDisposed = false;
  const STORAGE_DAILY = defaults.STORAGE_KEYS.dailyLocalByDate || 'shop_record_daily_local_by_date';
  const PREFIX = defaults.PREFIX || '[店铺记录数据]';
  const FILL_REPORT_PAGE_MSG = defaults.RUNTIME.FILL_REPORT_PAGE_MESSAGE;

  function buildOnebpSearchUrl() {
    const ymd = yesterdayYmd();
    return `https://one.alimama.com/index.html#!/manage/search?mx_bizCode=onebpSearch&bizCode=onebpSearch&tab=campaign&startTime=${ymd}&endTime=${ymd}`;
  }
  function buildOnebpDisplayUrl() {
    const ymd = yesterdayYmd();
    return `https://one.alimama.com/index.html#!/manage/display?mx_bizCode=onebpDisplay&bizCode=onebpDisplay&tab=campaign&startTime=${ymd}&endTime=${ymd}`;
  }
  function buildOnebpSiteUrl() {
    const ymd = yesterdayYmd();
    return `https://one.alimama.com/index.html#!/manage/onesite?mx_bizCode=onebpSite&bizCode=onebpSite&tab=campaign&startTime=${ymd}&endTime=${ymd}&effectEqual=15&unifyType=last_click_by_effect_time`;
  }
  function buildOnebpShortVideoUrl() {
    const ymd = yesterdayYmd();
    return `https://one.alimama.com/index.html#!/manage/content?mx_bizCode=onebpShortVideo&bizCode=onebpShortVideo&tab=campaign&startTime=${ymd}&endTime=${ymd}&unifyType=video_kuan`;
  }

  function getAllPageUrls() {
    return [
      defaults.SHOP_RATE_PAGE_URL,
      defaults.ALIMAMA_DASHBOARD_URL,
      buildOnebpSearchUrl(),
      buildOnebpDisplayUrl(),
      buildOnebpSiteUrl(),
      buildOnebpShortVideoUrl(),
      defaults.SYCM_MY_SPACE_URL,
      defaults.REPORT_SUBMIT_PAGE_URL,
    ];
  }

  function getActiveTabId(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const id = tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
      callback(id);
    });
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

  function renderDailyMetrics(snapshot) {
    const dateLabel = snapshot && snapshot.report_at ? String(snapshot.report_at) : yesterdayYmd();
    popupBridge.setMetricsDate(dateLabel);
    popupBridge.setDailySnapshot(snapshot && typeof snapshot === 'object' ? snapshot : null);
  }

  function loadDailySnapshot() {
    if (!chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get([STORAGE_DAILY], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) return;
      const bag = result[STORAGE_DAILY];
      const ymd = yesterdayYmd();
      let snapshot = null;
      if (bag && typeof bag === 'object' && bag[ymd]) {
        snapshot = bag[ymd];
      } else if (bag && typeof bag === 'object') {
        const dates = Object.keys(bag).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key));
        dates.sort();
        if (dates.length) snapshot = bag[dates[dates.length - 1]];
      }
      renderDailyMetrics(snapshot);
    });
  }

  function bindOpen(btn, urlOrBuilder) {
    if (!btn || !chrome.tabs || !chrome.tabs.create) return;
    btn.addEventListener('click', () => {
      const url = typeof urlOrBuilder === 'function' ? urlOrBuilder() : urlOrBuilder;
      chrome.tabs.create({ url });
    });
  }

  function runReportSubmitFillAfterPermission() {
    if (!chrome.storage || !chrome.storage.local) {
      logger.warn(`${PREFIX} 自动填充已取消：无法读取本地存储`);
      loadLogs();
      return;
    }
    chrome.storage.local.get([STORAGE_DAILY], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        logger.warn(`${PREFIX} 自动填充已取消：读取本地数据失败 ${String(chrome.runtime.lastError.message)}`);
        loadLogs();
        return;
      }
      const bag = result[STORAGE_DAILY];
      const snap = defaults.pickSnapshotFromDailyBag(bag);
      const validation = defaults.validateReportSnapshotForFill(snap);
      if (!validation.ok) {
        const missing = validation.missing || [];
        missing.slice(0, 3).forEach((item) => {
          logger.warn(`${PREFIX} 「${item.label}」数据未读取到，已拦截自动填入`);
        });
        if (missing.length > 3) {
          logger.warn(`${PREFIX} 其余缺失字段 ${missing.length - 3} 项已省略展示`);
        }
        logger.warn(`${PREFIX} 自动填充已取消：本地数据不完整（共 ${missing.length} 项缺失）`);
        loadLogs();
        return;
      }
      logger.log(`${PREFIX} 已请求：向联核上报页自动填充本地数据`);
      chrome.runtime.sendMessage({ type: FILL_REPORT_PAGE_MSG }, (response) => {
        if (chrome.runtime.lastError) {
          logger.warn(`${PREFIX} 自动填充失败：${String(chrome.runtime.lastError.message)}`);
        } else if (response && response.ok) {
          logger.log(
            `${PREFIX} 自动填充成功：已写入 ${response.filled != null ? response.filled : '?'} 项（统计日期 ${
              response.reportAt || ''
            }）`,
          );
        } else {
          const errMsg =
            response && response.error === 'incomplete_data'
              ? `本地数据不完整（共 ${response.missingCount != null ? response.missingCount : '?'} 项缺失）`
              : response && response.error
                ? String(response.error)
                : '未知原因（请确认上报页已加载）';
          logger.warn(`${PREFIX} 自动填充未完成：${errMsg}`);
        }
        loadLogs();
      });
    });
  }

  function clearDailyLocalSnapshot() {
    chrome.storage.local.remove(STORAGE_DAILY, () => {
      if (chrome.runtime && chrome.runtime.lastError) return;
      loadDailySnapshot();
    });
  }

  function startLogPoll() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
      loadLogs();
      loadDailySnapshot();
    }, 2000);
  }

  function stopLogPoll() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = null;
  }

  function onFocus() {
    loadLogs();
    loadDailySnapshot();
    startLogPoll();
  }

  function onBlur() {
    stopLogPoll();
  }

  function onStorageChanged(changes, area) {
    if (area !== 'local' || !changes[STORAGE_DAILY]) return;
    loadDailySnapshot();
  }

  if (openAllPagesBtn && chrome.tabs && chrome.tabs.create) {
    openAllPagesBtn.addEventListener('click', () => {
      getAllPageUrls().forEach((url) => {
        chrome.tabs.create({ url });
      });
    });
  }
  bindOpen(shopRateOpenBtn, defaults.SHOP_RATE_PAGE_URL);
  bindOpen(alimamaOpenBtn, defaults.ALIMAMA_DASHBOARD_URL);
  bindOpen(onebpOpenBtn, buildOnebpSearchUrl);
  bindOpen(onebpDisplayOpenBtn, buildOnebpDisplayUrl);
  bindOpen(onebpSiteOpenBtn, buildOnebpSiteUrl);
  bindOpen(onebpShortVideoOpenBtn, buildOnebpShortVideoUrl);
  bindOpen(sycmMySpaceOpenBtn, defaults.SYCM_MY_SPACE_URL);
  bindOpen(reportSubmitOpenBtn, defaults.REPORT_SUBMIT_PAGE_URL);

  if (logsClearBtn) logsClearBtn.addEventListener('click', clearLogs);
  if (dailyLocalClearBtn) dailyLocalClearBtn.addEventListener('click', clearDailyLocalSnapshot);
  if (reportSubmitFillBtn) reportSubmitFillBtn.addEventListener('click', runReportSubmitFillAfterPermission);

  chrome.storage.onChanged.addListener(onStorageChanged);
  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onBlur);

  loadLogs();
  loadDailySnapshot();
  startLogPoll();

  return () => {
    isDisposed = true;
    popupInitialized = false;
    stopLogPoll();
    if (logsClearBtn) logsClearBtn.removeEventListener('click', clearLogs);
    if (dailyLocalClearBtn) dailyLocalClearBtn.removeEventListener('click', clearDailyLocalSnapshot);
    if (reportSubmitFillBtn) reportSubmitFillBtn.removeEventListener('click', runReportSubmitFillAfterPermission);
    chrome.storage.onChanged.removeListener(onStorageChanged);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('blur', onBlur);
  };
}
