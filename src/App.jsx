import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import html2canvas from 'html2canvas';
import { getTrendData } from './utils/chartHelpers';
import {
  cartLogRowsToChartData,
  getCartLog20MinPointsForDate,
  flowSourceRowsToChartData,
  mergeCartAndFlowChartData,
} from './utils/supabaseCartLogToChart';
import { marketRankRowsToChartData, marketRankChartToGridItems } from './utils/supabaseMarketRankToChart';
import { supabase } from './lib/supabase';
import ChartCell from './components/ChartCell';
import TrendChartCell from './components/TrendChartCell';
import './App.css';

const SERIES_ORDER_LIMIT = 9;
const RANGE_DAY_OPTIONS = [2, 3, 5, 7];
const TREND_RANGE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: '7', label: '最近 7 天' },
  { value: '14', label: '最近 14 天' },
];

function App() {
  const [view, setView] = useState('upload');
  const [dataSource, setDataSource] = useState(null); // 'supabase' | null
  const [rawCartLogRows, setRawCartLogRows] = useState([]);
  const [rawFlowSourceRows, setRawFlowSourceRows] = useState([]);
  const [rawMarketRankRows, setRawMarketRankRows] = useState([]);
  const [viewMode, setViewMode] = useState('single');
  const [selectedDate, setSelectedDate] = useState(null);
  const [rangeDays, setRangeDays] = useState(3);
  const [selectedDatesPick, setSelectedDatesPick] = useState([]);
  const [enlargedIndex, setEnlargedIndex] = useState(null);
  const [pickOpen, setPickOpen] = useState(false);
  const pickRef = useRef(null);
  const chartGridRef = useRef(null);
  const enlargedRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [trendRange, setTrendRange] = useState('all');
  const [error, setError] = useState(null);
  const [supabaseLoading, setSupabaseLoading] = useState(false);

  const parsedData = useMemo(() => {
    if (dataSource !== 'supabase') return null;
    const hasCart = rawCartLogRows.length > 0;
    const hasFlow = rawFlowSourceRows.length > 0;
    if (!hasCart && !hasFlow) return null;
    const cartData = cartLogRowsToChartData(rawCartLogRows);
    const flowData = flowSourceRowsToChartData(rawFlowSourceRows);
    return mergeCartAndFlowChartData(cartData, flowData);
  }, [dataSource, rawCartLogRows, rawFlowSourceRows]);

  const marketRankChart = useMemo(
    () => marketRankRowsToChartData(rawMarketRankRows),
    [rawMarketRankRows]
  );

  const loadFromSupabase = useCallback(async () => {
    if (!supabase) {
      setError('未配置 Supabase，请在 .env 中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
      return;
    }
    setError(null);
    setSupabaseLoading(true);
    try {
      const [cartRes, flowRes, rankRes] = await Promise.all([
        supabase.from('sycm_cart_log').select('item_cart_cnt, recorded_at').order('recorded_at', { ascending: true }),
        supabase.from('sycm_flow_source_log').select('recorded_at, search_uv, search_pay_rate, cart_uv, cart_pay_rate').order('recorded_at', { ascending: true }),
        supabase.from('sycm_market_rank_log').select('recorded_at, shop_title, rank').order('recorded_at', { ascending: true }),
      ]);
      if (cartRes.error) throw cartRes.error;
      if (flowRes.error) throw flowRes.error;
      if (rankRes.error) throw rankRes.error;
      setRawCartLogRows(cartRes.data ?? []);
      setRawFlowSourceRows(flowRes.data ?? []);
      setRawMarketRankRows(rankRes.data ?? []);
      setDataSource('supabase');
      const cartData = cartLogRowsToChartData(cartRes.data ?? []);
      const flowData = flowSourceRowsToChartData(flowRes.data ?? []);
      const merged = mergeCartAndFlowChartData(cartData, flowData);
      const rankChart = marketRankRowsToChartData(rankRes.data ?? []);
      const hasMain = merged.dates?.length > 0;
      const hasRank = rankChart.shopNames?.length > 0 && Object.keys(rankChart.byDateSlot || {}).length > 0;
      if (hasMain || hasRank) {
        if (hasMain) {
          setSelectedDate(merged.dates[0]);
          setSelectedDatesPick([merged.dates[0]]);
        }
        setView('dashboard');
      } else {
        setError('未查到数据。请确认 sycm_cart_log、sycm_flow_source_log 或 sycm_market_rank_log 已有数据，且 anon 具备 SELECT 策略。');
      }
    } catch (err) {
      setError('加载失败：' + (err.message || String(err)));
    } finally {
      setSupabaseLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase || dataSource !== 'supabase') return;
    const channel = supabase
      .channel('sycm_supabase_inserts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sycm_cart_log' }, (payload) => {
        const row = payload.new;
        if (row && typeof row.item_cart_cnt !== 'undefined' && row.recorded_at) {
          setRawCartLogRows((prev) => [...prev, { item_cart_cnt: row.item_cart_cnt, recorded_at: row.recorded_at }]);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sycm_flow_source_log' }, (payload) => {
        const row = payload.new;
        if (row && row.recorded_at) {
          setRawFlowSourceRows((prev) => [
            ...prev,
            {
              recorded_at: row.recorded_at,
              search_uv: row.search_uv,
              search_pay_rate: row.search_pay_rate,
              cart_uv: row.cart_uv,
              cart_pay_rate: row.cart_pay_rate,
            },
          ]);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sycm_market_rank_log' }, (payload) => {
        const row = payload.new;
        if (!row) return;
        const recorded_at = row.recorded_at ?? row.recordedAt;
        const shop_title = row.shop_title ?? row.shopTitle;
        const rank = row.rank;
        if (recorded_at && shop_title != null) {
          setRawMarketRankRows((prev) => [...prev, { recorded_at, shop_title, rank }]);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [dataSource]);

  useEffect(() => {
    if (view === 'upload' && supabase) loadFromSupabase();
  }, [view, loadFromSupabase]);

  useEffect(() => {
    if (enlargedIndex == null) return;
    const onEsc = (e) => {
      if (e.key === 'Escape') setEnlargedIndex(null);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [enlargedIndex]);

  useEffect(() => {
    if (!pickOpen) return;
    const onDoc = (e) => {
      if (pickRef.current && !pickRef.current.contains(e.target)) setPickOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pickOpen]);

  if (view === 'dashboard' && parsedData) {
    const { dates, byDate } = parsedData;
    const firstDate = dates[0];

    let selectedDates = [];
    if (viewMode === 'single') {
      selectedDates = selectedDate ? [selectedDate] : firstDate ? [firstDate] : [];
    } else if (viewMode === 'multiRange') {
      const base = selectedDate ?? dates[dates.length - 1];
      if (base) {
        const i = dates.indexOf(base);
        if (i >= 0) {
          const start = Math.max(0, i - rangeDays + 1);
          selectedDates = dates.slice(start, i + 1);
        } else {
          selectedDates = dates.slice(-rangeDays);
        }
      }
    } else if (viewMode === 'multiPick') {
      selectedDates = selectedDatesPick.length > 0 ? [...selectedDatesPick].sort() : (firstDate ? [firstDate] : []);
    }

    const trendDates =
      viewMode === 'trend'
        ? trendRange === 'all'
          ? dates
          : dates.slice(-Number(trendRange))
        : [];
    const trendActionCountByDate = trendDates.reduce((acc, d) => {
      const actions = byDate[d]?.actions ?? {};
      acc[d] = Object.values(actions).reduce((sum, arr) => sum + (arr?.length ?? 0), 0);
      return acc;
    }, {});

    const seenKeys = new Set();
    const template = [];
    for (const d of dates) {
      for (const s of byDate[d]?.series ?? []) {
        const key = `${s.category}-${s.subCategory}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          template.push(s);
        }
      }
    }
    const templateLimited = template.slice(0, SERIES_ORDER_LIMIT);

    const togglePickDate = (d) => {
      setSelectedDatesPick((prev) =>
        prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
      );
    };

    const handleExportPng = async () => {
      const el = enlargedIndex != null ? enlargedRef.current : chartGridRef.current;
      if (!el) return;
      setExporting(true);
      try {
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        });
        const datesForName = viewMode === 'trend' ? trendDates : selectedDates;
        const name =
          enlargedIndex != null
            ? `小贝壳作战-详情-${datesForName[0] ?? 'export'}.png`
            : `小贝壳作战-${datesForName[0] ?? 'export'}${datesForName.length > 1 ? `-${datesForName.length}天` : ''}.png`;
        const link = document.createElement('a');
        link.download = name;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.error('导出失败', err);
      } finally {
        setExporting(false);
      }
    };

    const seriesForGrid = templateLimited.map((t) => {
      const seriesItems = selectedDates
        .map((date) => {
          const day = byDate[date];
          const s = day?.series?.find(
            (x) => x.category === t.category && x.subCategory === t.subCategory
          );
          return s ? { date, ...s } : null;
        })
        .filter(Boolean);
      const actionsByDate = selectedDates.reduce(
        (acc, d) => ({ ...acc, [d]: byDate[d]?.actions ?? {} }),
        {}
      );
      return {
        key: `${t.category}-${t.subCategory}`,
        seriesItem: seriesItems.length === 1 ? seriesItems[0] : null,
        seriesItems: seriesItems.length > 1 ? seriesItems : null,
        actions: seriesItems.length === 1 ? actionsByDate[selectedDates[0]] : null,
        actionsByDate: seriesItems.length > 1 ? actionsByDate : null,
      };
    });

    const trendForGrid =
      viewMode === 'trend' && trendDates.length > 0
        ? templateLimited.map((t) => ({
            key: t.category + '-' + t.subCategory,
            title: t.isRate ? `${t.category} - ${t.subCategory} %` : `${t.category} - ${t.subCategory}`,
            data: getTrendData(byDate, trendDates, t.category, t.subCategory, t.isRate),
            isRate: t.isRate,
          }))
        : [];

    const marketRankForGrid = marketRankChartToGridItems(marketRankChart, {
      viewMode,
      selectedDate: selectedDate ?? null,
      selectedDates,
      trendDates,
    });

    const trendGridItems = [...trendForGrid, ...marketRankForGrid];
    const seriesGridItems = [
      ...seriesForGrid.map((s) => ({ type: 'series', ...s })),
      ...marketRankForGrid.map((m) => ({ type: 'rank', key: m.key, title: m.title, data: m.data, isRate: m.isRate })),
    ];
    const totalGridCells = viewMode === 'trend' ? trendGridItems.length : seriesGridItems.length;

    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="dashboard-header-inner">
            <div className="dashboard-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'single'}
                className={`dashboard-tab ${viewMode === 'single' ? 'dashboard-tab--active' : ''}`}
                onClick={() => setViewMode('single')}
              >
                单日
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'multiRange' || viewMode === 'multiPick'}
                className={`dashboard-tab ${viewMode === 'multiRange' || viewMode === 'multiPick' ? 'dashboard-tab--active' : ''}`}
                onClick={() => setViewMode('multiRange')}
              >
                多日
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'trend'}
                className={`dashboard-tab ${viewMode === 'trend' ? 'dashboard-tab--active' : ''}`}
                onClick={() => setViewMode('trend')}
              >
                趋势
              </button>
            </div>

            {viewMode === 'single' && (
              <label className="dashboard-date-label">
                日期
                <select
                  className="dashboard-date-select"
                  value={selectedDate ?? ''}
                  onChange={(e) => setSelectedDate(e.target.value)}
                >
                  {dates.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(viewMode === 'multiRange' || viewMode === 'multiPick') && (
              <>
                <div className="dashboard-subtabs">
                  <button
                    type="button"
                    className={`dashboard-subtab ${viewMode === 'multiRange' ? 'dashboard-subtab--active' : ''}`}
                    onClick={() => setViewMode('multiRange')}
                  >
                    连续
                  </button>
                  <button
                    type="button"
                    className={`dashboard-subtab ${viewMode === 'multiPick' ? 'dashboard-subtab--active' : ''}`}
                    onClick={() => setViewMode('multiPick')}
                  >
                    自选
                  </button>
                </div>
                {viewMode === 'multiRange' && (
                  <>
                    <label className="dashboard-date-label">
                      日期
                      <select
                        className="dashboard-date-select"
                        value={selectedDate ?? ''}
                        onChange={(e) => setSelectedDate(e.target.value)}
                      >
                        {dates.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="dashboard-date-label">
                      共
                      <select
                        className="dashboard-date-select dashboard-date-select--narrow"
                        value={rangeDays}
                        onChange={(e) => setRangeDays(Number(e.target.value))}
                      >
                        {RANGE_DAY_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n} 天
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {viewMode === 'multiPick' && (
                  <div className="dashboard-pick-wrap" ref={pickRef}>
                    <button
                      type="button"
                      className="dashboard-pick-trigger"
                      onClick={() => setPickOpen((o) => !o)}
                      aria-expanded={pickOpen}
                    >
                      选日期{selectedDatesPick.length > 0 ? `（${selectedDatesPick.length} 天）` : ''}
                    </button>
                    {pickOpen && (
                      <div className="dashboard-pick-dropdown">
                        {dates.map((d) => (
                          <label key={d} className="dashboard-pick-option">
                            <input
                              type="checkbox"
                              checked={selectedDatesPick.includes(d)}
                              onChange={() => togglePickDate(d)}
                            />
                            <span>{d}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {viewMode === 'trend' && (
              <label className="dashboard-date-label">
                范围
                <select
                  className="dashboard-date-select"
                  value={trendRange}
                  onChange={(e) => setTrendRange(e.target.value)}
                >
                  {TREND_RANGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="dashboard-header-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleExportPng}
              disabled={exporting}
            >
              {exporting ? '导出中…' : '导出 PNG'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setView('upload');
                setDataSource(null);
                setRawCartLogRows([]);
                setRawFlowSourceRows([]);
                setRawMarketRankRows([]);
              }}
            >
              更换数据
            </button>
          </div>
        </header>

        <main className="dashboard-main">
          {viewMode === 'trend' ? (
            <div className="chart-grid" ref={chartGridRef}>
              {trendGridItems.map((cell, i) => (
                <TrendChartCell
                  key={cell.key}
                  title={cell.title}
                  data={cell.data}
                  isRate={cell.isRate}
                  actionCountByDate={trendActionCountByDate}
                  compact
                  onClick={() => setEnlargedIndex(i)}
                />
              ))}
            </div>
          ) : (
            <div className="chart-grid" ref={chartGridRef}>
              {seriesGridItems.map((cell, i) =>
                cell.type === 'rank' ? (
                  <TrendChartCell
                    key={cell.key}
                    title={cell.title}
                    data={cell.data}
                    isRate={cell.isRate}
                    compact
                    onClick={() => setEnlargedIndex(i)}
                  />
                ) : (
                  <ChartCell
                    key={cell.key}
                    seriesItem={cell.seriesItem}
                    seriesItems={cell.seriesItems}
                    actions={cell.actions}
                    actionsByDate={cell.actionsByDate}
                    compact
                    onClick={() => setEnlargedIndex(i)}
                  />
                )
              )}
            </div>
          )}
        </main>

        {enlargedIndex != null && (
          <div
            className="dashboard-overlay"
            role="presentation"
            onClick={(e) => e.target === e.currentTarget && setEnlargedIndex(null)}
          >
            <button
              type="button"
              className="dashboard-nav dashboard-nav--left"
              aria-label="上一张"
              onClick={(e) => { e.stopPropagation(); setEnlargedIndex((enlargedIndex + totalGridCells - 1) % totalGridCells); }}
            >
              <HiChevronLeft />
            </button>
            <div className="dashboard-enlarged" ref={enlargedRef} onClick={(e) => e.stopPropagation()}>
              {viewMode === 'trend' ? (
                trendGridItems[enlargedIndex] && (
                  <TrendChartCell
                    title={trendGridItems[enlargedIndex].title}
                    data={trendGridItems[enlargedIndex].data}
                    isRate={trendGridItems[enlargedIndex].isRate}
                    actionCountByDate={trendActionCountByDate}
                    compact={false}
                  />
                )
              ) : (
                seriesGridItems[enlargedIndex] &&
                (seriesGridItems[enlargedIndex].type === 'rank' ? (
                  <TrendChartCell
                    title={seriesGridItems[enlargedIndex].title}
                    data={seriesGridItems[enlargedIndex].data}
                    isRate={seriesGridItems[enlargedIndex].isRate}
                    compact={false}
                  />
                ) : (
                  <ChartCell
                    seriesItem={seriesGridItems[enlargedIndex].seriesItem}
                    seriesItems={seriesGridItems[enlargedIndex].seriesItems}
                    actions={seriesGridItems[enlargedIndex].actions}
                    actionsByDate={seriesGridItems[enlargedIndex].actionsByDate}
                    compact={false}
                    detailPoints20m={
                      dataSource === 'supabase' &&
                      seriesGridItems[enlargedIndex]?.key === '小贝壳-商品加购件数' &&
                      selectedDates[0]
                        ? getCartLog20MinPointsForDate(rawCartLogRows, selectedDates[0])
                        : null
                    }
                  />
                ))
              )}
            </div>
            <button
              type="button"
              className="dashboard-nav dashboard-nav--right"
              aria-label="下一张"
              onClick={(e) => { e.stopPropagation(); setEnlargedIndex((enlargedIndex + 1) % totalGridCells); }}
            >
              <HiChevronRight />
            </button>
          </div>
        )}
      </div>
    );
  }

  if (supabaseLoading) {
    return (
      <div className="upload-view upload-view--loading">
        <p className="upload-loading-text">加载中…</p>
      </div>
    );
  }

  return (
    <div className="upload-view">
      <p className="upload-datasource-hint">数据来源：Supabase（商品加购件数、流量来源 4 指标、市场排名，9～24 点）</p>
      <div className="upload-actions">
        <button
          type="button"
          className="btn btn-primary upload-btn-supabase"
          onClick={loadFromSupabase}
          disabled={!supabase}
        >
          从 Supabase 加载
        </button>
      </div>
      {error && <p className="upload-error">{error}</p>}
    </div>
  );
}

export default App;
