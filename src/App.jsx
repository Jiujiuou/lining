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
import { fetchChartNotes, upsertChartNote } from './lib/chartNotes';
import ChartCell from './components/ChartCell';
import TrendChartCell from './components/TrendChartCell';
import NoteModal from './components/NoteModal';
import './App.css';

const SERIES_ORDER_LIMIT = 9;
const RANGE_DAY_OPTIONS = [2, 3, 5, 7];
const TREND_RANGE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: '7', label: '最近 7 天' },
  { value: '14', label: '最近 14 天' },
];

/** 东八区当天日期 YYYY-MM-DD */
function getTodayEast8() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

function App() {
  const [view, setView] = useState('dashboard');
  const [dataSource, setDataSource] = useState(null); // 'supabase' | null
  const [rawCartLogRows, setRawCartLogRows] = useState([]);
  const [rawFlowSourceRows, setRawFlowSourceRows] = useState([]);
  const [rawMarketRankRows, setRawMarketRankRows] = useState([]);
  const [viewMode, setViewMode] = useState('single');
  const [selectedDate, setSelectedDate] = useState(getTodayEast8);
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
  const [noteModal, setNoteModal] = useState(null);
  const [chartNotes, setChartNotes] = useState({});

  useEffect(() => {
    const today = getTodayEast8();
    console.log('今天日期（东八区）:', today);
  }, []);

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

  const loadFromSupabase = useCallback(async (overrideDate) => {
    if (!supabase) {
      setError('未配置 Supabase，请在 .env 中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY');
      return;
    }
    setError(null);
    setSupabaseLoading(true);
    const day =
      (overrideDate && /^\d{4}-\d{2}-\d{2}$/.test(overrideDate))
        ? overrideDate
        : selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
          ? selectedDate
          : getTodayEast8();
    const dayStart = `${day}T00:00:00+08:00`;
    const dayEnd = `${day}T23:59:59.999+08:00`;
    try {
      const [cartRes, flowRes, rankRes] = await Promise.all([
        supabase.from('sycm_cart_log').select('item_cart_cnt, created_at').gte('created_at', dayStart).lte('created_at', dayEnd).order('created_at', { ascending: true }),
        supabase.from('sycm_flow_source_log').select('created_at, search_uv, search_pay_rate, cart_uv, cart_pay_rate').gte('created_at', dayStart).lte('created_at', dayEnd).order('created_at', { ascending: true }),
        supabase.from('sycm_market_rank_log').select('created_at, shop_title, rank').gte('created_at', dayStart).lte('created_at', dayEnd).order('created_at', { ascending: true }),
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
          const dateToSelect = merged.dates.includes(day) ? day : merged.dates[0];
          setSelectedDate(dateToSelect);
          setSelectedDatesPick([dateToSelect]);
        }
        setView('dashboard');
      } else {
        setError(null);
        setSelectedDate(day);
        setSelectedDatesPick([day]);
        setView('dashboard');
      }
    } catch (err) {
      setError('加载失败：' + (err.message || String(err)));
    } finally {
      setSupabaseLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!supabase || dataSource !== 'supabase') return;
    const channel = supabase
      .channel('sycm_supabase_inserts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sycm_cart_log' }, (payload) => {
        const row = payload.new;
        if (row && typeof row.item_cart_cnt !== 'undefined' && (row.created_at ?? row.recorded_at)) {
          setRawCartLogRows((prev) => [...prev, { item_cart_cnt: row.item_cart_cnt, created_at: row.created_at ?? row.recorded_at }]);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sycm_flow_source_log' }, (payload) => {
        const row = payload.new;
        if (row && (row.created_at ?? row.recorded_at)) {
          setRawFlowSourceRows((prev) => [
            ...prev,
            {
              created_at: row.created_at ?? row.recorded_at,
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
        const created_at = row.created_at ?? row.recorded_at ?? row.recordedAt;
        const shop_title = row.shop_title ?? row.shopTitle;
        const rank = row.rank;
        if (created_at && shop_title != null) {
          setRawMarketRankRows((prev) => [...prev, { created_at, shop_title, rank }]);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [dataSource]);

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadFromSupabase();
  }, [loadFromSupabase]);

  const noteFetchScope = useMemo(() => {
    if (dataSource !== 'supabase') return { chartKeys: [], pointDates: [] };
    const { dates = [], byDate = {} } = parsedData || {};
    const marketChart = marketRankChart || {};
    const shopNames = marketChart.shopNames || [];
    let pointDates = [];
    if (viewMode === 'single') {
      pointDates = selectedDate ? [selectedDate] : dates.length ? [dates[0]] : [];
    } else if (viewMode === 'multiRange') {
      const base = selectedDate ?? dates[dates.length - 1];
      if (base) {
        const i = dates.indexOf(base);
        pointDates = i >= 0 ? dates.slice(Math.max(0, i - rangeDays + 1), i + 1) : dates.slice(-rangeDays);
      }
    } else if (viewMode === 'multiPick') {
      pointDates = selectedDatesPick.length > 0 ? [...selectedDatesPick].sort() : (dates.length ? [dates[0]] : []);
    }
    if (viewMode === 'trend') {
      pointDates = trendRange === 'all' ? dates : dates.slice(-Number(trendRange));
    }
    const seenKeys = new Set();
    for (const d of dates) {
      for (const s of byDate[d]?.series ?? []) {
        const key = `${s.category}-${s.subCategory}`;
        if (!seenKeys.has(key)) seenKeys.add(key);
      }
    }
    const templateKeys = Array.from(seenKeys).slice(0, SERIES_ORDER_LIMIT);
    const marketKeys = shopNames.map((name) => 'market-rank-' + name);
    return { chartKeys: [...templateKeys, ...marketKeys], pointDates };
  }, [
    dataSource,
    parsedData,
    marketRankChart,
    viewMode,
    selectedDate,
    rangeDays,
    selectedDatesPick,
    trendRange,
  ]);

  const noteFetchChartKeys = noteFetchScope.chartKeys.join(',');
  const noteFetchPointDates = noteFetchScope.pointDates.join(',');
  useEffect(() => {
    if (!supabase || !noteFetchChartKeys || !noteFetchPointDates) return;
    const chartKeys = noteFetchScope.chartKeys;
    const pointDates = noteFetchScope.pointDates;
    let cancelled = false;
    (async () => {
      const next = await fetchChartNotes(supabase, chartKeys, pointDates);
      if (!cancelled) setChartNotes(next);
    })();
    return () => { cancelled = true; };
  }, [noteFetchChartKeys, noteFetchPointDates]);

  useEffect(() => {
    if (enlargedIndex == null) return;
    const onEsc = (e) => {
      if (e.key !== 'Escape') return;
      if (noteModal) return;
      setEnlargedIndex(null);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [enlargedIndex, noteModal]);

  useEffect(() => {
    if (!pickOpen) return;
    const onDoc = (e) => {
      if (pickRef.current && !pickRef.current.contains(e.target)) setPickOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pickOpen]);

  if (view === 'dashboard') {
    const { dates, byDate } = parsedData || { dates: [], byDate: {} };
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
      ...marketRankForGrid
        .filter((m) => m.seriesItem)
        .map((m) => ({ type: 'series', key: m.key, seriesItem: m.seriesItem, seriesItems: null, actions: null, actionsByDate: null })),
    ];
    const totalGridCells = viewMode === 'trend' ? trendGridItems.length : seriesGridItems.length;
    const hasNoDataForSelection = totalGridCells === 0;
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
                <input
                  type="date"
                  className="dashboard-date-select"
                  value={selectedDate ?? ''}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSelectedDate(next);
                    if (dataSource === 'supabase' && view === 'dashboard') {
                      loadFromSupabase(next);
                    }
                  }}
                />
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
            {supabaseLoading ? (
              <span className="dashboard-loading-hint">加载中…</span>
            ) : dataSource === 'supabase' && (rawCartLogRows.length > 0 || rawFlowSourceRows.length > 0) ? (
              <>
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
                    setDataSource(null);
                    setRawCartLogRows([]);
                    setRawFlowSourceRows([]);
                    setRawMarketRankRows([]);
                    setError(null);
                  }}
                >
                  更换数据
                </button>
              </>
            ) : null}
            {error && <span className="dashboard-header-error">{error}</span>}
          </div>
        </header>

        <NoteModal
          open={noteModal != null}
          chartKey={noteModal?.chartKey ?? ''}
          pointDate={noteModal?.pointDate ?? ''}
          pointSlot={noteModal?.pointSlot ?? ''}
          initialNote={noteModal?.initialNote ?? ''}
          onClose={() => setNoteModal(null)}
          onSave={async (note) => {
            if (!noteModal || !supabase) return;
            await upsertChartNote(
              supabase,
              noteModal.chartKey,
              noteModal.pointDate,
              noteModal.pointSlot,
              note
            );
            const key = `${noteModal.pointDate}|${noteModal.pointSlot ?? ''}`;
            setChartNotes((prev) => ({
              ...prev,
              [noteModal.chartKey]: { ...(prev[noteModal.chartKey] ?? {}), [key]: note },
            }));
          }}
        />

        <main className="dashboard-main">
          {hasNoDataForSelection ? (
            <p className="dashboard-empty-hint">当前日期暂无数据，请切换日期后查看</p>
          ) : viewMode === 'trend' ? (
            <div className="chart-grid" ref={chartGridRef}>
              {trendGridItems.map((cell, i) => (
                <TrendChartCell
                  key={cell.key}
                  title={cell.title}
                  data={cell.data}
                  isRate={cell.isRate}
                  actionCountByDate={trendActionCountByDate}
                  compact
                  chartKey={cell.key}
                  notesMap={chartNotes[cell.key] ?? {}}
                  onClick={() => setEnlargedIndex(i)}
                />
              ))}
            </div>
          ) : (
            <div className="chart-grid" ref={chartGridRef}>
              {seriesGridItems.map((cell, i) => (
                <ChartCell
                  key={cell.key}
                  seriesItem={cell.seriesItem}
                  seriesItems={cell.seriesItems}
                  actions={cell.actions}
                  actionsByDate={cell.actionsByDate}
                  compact
                  chartKey={cell.key}
                  currentDate={selectedDates[0]}
                  notesMap={chartNotes[cell.key] ?? {}}
                  detailPoints20m={
                    dataSource === 'supabase' && cell.key === '小贝壳-商品加购件数' && selectedDates[0]
                      ? getCartLog20MinPointsForDate(rawCartLogRows, selectedDates[0])
                      : null
                  }
                  onClick={() => setEnlargedIndex(i)}
                />
              ))}
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
                    chartKey={trendGridItems[enlargedIndex].key}
                    onDotClick={(ctx) => setNoteModal(ctx)}
                    notesMap={chartNotes[trendGridItems[enlargedIndex].key] ?? {}}
                  />
                )
              ) : (
                seriesGridItems[enlargedIndex] && (
                  <ChartCell
                    seriesItem={seriesGridItems[enlargedIndex].seriesItem}
                    seriesItems={seriesGridItems[enlargedIndex].seriesItems}
                    actions={seriesGridItems[enlargedIndex].actions}
                    actionsByDate={seriesGridItems[enlargedIndex].actionsByDate}
                    compact={false}
                    chartKey={seriesGridItems[enlargedIndex].key}
                    currentDate={selectedDates[0]}
                    onDotClick={(ctx) => setNoteModal(ctx)}
                    notesMap={chartNotes[seriesGridItems[enlargedIndex].key] ?? {}}
                    detailPoints20m={
                      dataSource === 'supabase' &&
                      seriesGridItems[enlargedIndex].key === '小贝壳-商品加购件数' &&
                      selectedDates[0]
                        ? getCartLog20MinPointsForDate(rawCartLogRows, selectedDates[0])
                        : null
                    }
                  />
                )
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

  return null;
}

export default App;
