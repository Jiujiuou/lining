import { useState, useCallback } from 'react';
import { parseWorkbook } from './utils/parseWorkbook';
import './App.css';

function App() {
  const [view, setView] = useState('upload');
  const [parsedData, setParsedData] = useState(null);
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
        setView('data');
        console.log('解析结果（标准数据）：', data);
      } catch (err) {
        setError('解析失败：' + (err.message || String(err)));
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

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

  if (view === 'data') {
    return (
      <div className="data-view">
        <div className="data-card">
          <h1 className="data-title">解析成功</h1>
          <p className="data-meta">
            共解析出 <strong>{parsedData.dates.length}</strong> 个日期：
            {parsedData.dates.join('、')}
          </p>
          <p className="data-hint">请打开控制台查看完整解析结果（标准数据结构）。</p>
          <button type="button" className="btn btn-primary" onClick={() => { setView('upload'); setParsedData(null); }}>
            重新上传
          </button>
        </div>
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
