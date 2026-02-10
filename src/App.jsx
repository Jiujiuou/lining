import { useState, useCallback, useEffect } from 'react';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import { parseWorkbook } from './utils/parseWorkbook';
import ChartCell from './components/ChartCell';
import './App.css';

const SERIES_ORDER_LIMIT = 9; // 小贝壳 5 + 销量 4

function App() {
  const [view, setView] = useState('upload');
  const [parsedData, setParsedData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [enlargedIndex, setEnlargedIndex] = useState(null);
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
        setSelectedDate(data.dates[0] ?? null);
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

  if (view === 'dashboard' && parsedData && selectedDate) {
    const day = parsedData.byDate[selectedDate];
    const series = (day?.series ?? []).slice(0, SERIES_ORDER_LIMIT);
    const actions = day?.actions ?? {};

    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <h1 className="dashboard-title">小贝壳作战 · 数据看板</h1>
          <div className="dashboard-controls">
            <label className="dashboard-date-label">
              日期
              <select
                className="dashboard-date-select"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                {parsedData.dates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-ghost" onClick={() => { setView('upload'); setParsedData(null); }}>
              更换数据
            </button>
          </div>
        </header>

        <main className="dashboard-main">
          <div className="chart-grid">
            {series.map((item, i) => (
              <ChartCell
                key={`${item.category}-${item.subCategory}`}
                seriesItem={item}
                actions={actions}
                compact
                onClick={() => setEnlargedIndex(i)}
              />
            ))}
          </div>
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
            <div className="dashboard-enlarged" onClick={(e) => e.stopPropagation()}>
              {series[enlargedIndex] && (
                <ChartCell
                  seriesItem={series[enlargedIndex]}
                  actions={actions}
                  compact={false}
                />
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
