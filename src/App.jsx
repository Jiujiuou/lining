import { useState, useCallback, useEffect, useRef } from 'react';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import html2canvas from 'html2canvas';
import { parseWorkbook } from './utils/parseWorkbook';
import { getTrendData } from './utils/chartHelpers';
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
  const [parsedData, setParsedData] = useState(null);
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
  const [trendRange, setTrendRange] = useState('all'); // 'all' | '7' | '14'
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = useCallback((file) => {
    setError(null);
    if (!file || !file.name?.toLowerCase().endsWith('.xlsx')) {
      setError('请上传 .xlsx 格式的 Excel 文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = parseWorkbook(e.target.result);
        setParsedData(data);
        const first = data.dates[0] ?? null;
        setSelectedDate(first);
        setSelectedDatesPick(first ? [first] : []);
        setEnlargedIndex(null);
        setView('dashboard');
        console.log('解析结果（标准数据）：', data);
      } catch (err) {
        setError('解析失败：' + (err.message || String(err)));
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

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

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };
  const onDragOver = (e) => {
    e.preventDefault();
    setDrag(true);
  };
  const onDragLeave = () => setDrag(false);

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

    const seriesSourceDate = viewMode === 'trend' ? (trendDates[0] ?? firstDate) : selectedDates[0];
    const baseSeries = byDate[seriesSourceDate]?.series ?? [];
    const template = baseSeries.slice(0, SERIES_ORDER_LIMIT);

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

    const seriesForGrid = template.map((t) => {
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
        ? template.map((t) => ({
            key: t.category + '-' + t.subCategory,
            title: t.isRate ? `${t.category} - ${t.subCategory} %` : `${t.category} - ${t.subCategory}`,
            data: getTrendData(byDate, trendDates, t.category, t.subCategory, t.isRate),
            isRate: t.isRate,
          }))
        : [];

    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="dashboard-header-row1">
            <h1 className="dashboard-title">小贝壳作战 · 数据看板</h1>
            <div className="dashboard-header-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleExportPng}
                disabled={exporting}
              >
                {exporting ? '导出中…' : '导出 PNG'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setView('upload'); setParsedData(null); }}>
                更换数据
              </button>
            </div>
          </div>
          <div className="dashboard-header-row2">
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
        </header>

        <main className="dashboard-main">
          {viewMode === 'trend' ? (
            <div className="chart-grid" ref={chartGridRef}>
              {trendForGrid.map((cell, i) => (
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
              {seriesForGrid.map((cell, i) => (
                <ChartCell
                  key={cell.key}
                  seriesItem={cell.seriesItem}
                  seriesItems={cell.seriesItems}
                  actions={cell.actions}
                  actionsByDate={cell.actionsByDate}
                  compact
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
              onClick={(e) => { e.stopPropagation(); setEnlargedIndex((enlargedIndex + 8) % 9); }}
            >
              <HiChevronLeft />
            </button>
            <div className="dashboard-enlarged" ref={enlargedRef} onClick={(e) => e.stopPropagation()}>
              {viewMode === 'trend' ? (
                trendForGrid[enlargedIndex] && (
                  <TrendChartCell
                    title={trendForGrid[enlargedIndex].title}
                    data={trendForGrid[enlargedIndex].data}
                    isRate={trendForGrid[enlargedIndex].isRate}
                    actionCountByDate={trendActionCountByDate}
                    compact={false}
                  />
                )
              ) : (
                seriesForGrid[enlargedIndex] && (
                  <ChartCell
                    seriesItem={seriesForGrid[enlargedIndex].seriesItem}
                    seriesItems={seriesForGrid[enlargedIndex].seriesItems}
                    actions={seriesForGrid[enlargedIndex].actions}
                    actionsByDate={seriesForGrid[enlargedIndex].actionsByDate}
                    compact={false}
                  />
                )
              )}
            </div>
            <button
              type="button"
              className="dashboard-nav dashboard-nav--right"
              aria-label="下一张"
              onClick={(e) => { e.stopPropagation(); setEnlargedIndex((enlargedIndex + 1) % 9); }}
            >
              <HiChevronRight />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="upload-view">
      <div
        className={`upload-zone ${drag ? 'upload-zone--drag' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <input
          type="file"
          accept=".xlsx"
          className="upload-input"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="upload-content">
          <span className="upload-icon">📊</span>
          <p className="upload-title">上传 Excel 表格</p>
          <p className="upload-desc">拖拽文件到此处，或点击选择 .xlsx 文件</p>
        </div>
      </div>
      {error && <p className="upload-error">{error}</p>}
    </div>
  );
}

export default App;
