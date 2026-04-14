import '@/popup/components/ToolbarPanel/styles.css';

export function ToolbarPanel({
  keyword,
  statusFilter,
  statusOptions,
  onKeywordChange,
  onStatusFilterChange,
  onStartCrawl,
  onStopCrawl,
  onRefresh,
  onClearList,
  onOpenRandomTen,
}) {
  return (
    <section className="dy-toolbar-panel">
      <div className="dy-toolbar-row dy-toolbar-row--actions">
        <button type="button" className="dy-btn dy-btn-primary" onClick={onStartCrawl}>
          开始采集
        </button>
        <button type="button" className="dy-btn dy-btn-secondary" onClick={onStopCrawl}>
          停止采集
        </button>
        <button type="button" className="dy-btn dy-btn-secondary" onClick={onRefresh}>
          刷新
        </button>
        <button type="button" className="dy-btn dy-btn-secondary" onClick={onClearList}>
          清空列表
        </button>
      </div>
      <div className="dy-toolbar-row dy-toolbar-row--filters">
        <input
          type="text"
          className="dy-input"
          value={keyword}
          placeholder="搜索昵称 / 简介 / uid"
          onChange={(event) => onKeywordChange(event.target.value)}
        />
        <select
          className="dy-select"
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
            {status}
          </option>
        ))}
        </select>
        <button type="button" className="dy-btn dy-btn-secondary" onClick={onOpenRandomTen}>
          随机打开 10 个
        </button>
      </div>
    </section>
  );
}
