import '@/popup/components/ToolbarPanel/styles.css';

export function ToolbarPanel({
  metaText,
  onRefresh,
  onSelectAll,
  onSelectNone,
  onSave,
}) {
  return (
    <section className="rank-toolbar-panel">
      <header className="rank-toolbar-header">
        <h2 className="rank-toolbar-title">市场排名</h2>
        <div className="rank-toolbar-actions">
          <button type="button" className="rank-btn rank-btn-secondary" onClick={onRefresh}>
            刷新列表
          </button>
          <button type="button" className="rank-btn rank-btn-secondary" onClick={onSelectAll}>
            全选
          </button>
          <button type="button" className="rank-btn rank-btn-secondary" onClick={onSelectNone}>
            全不选
          </button>
          <button type="button" className="rank-btn rank-btn-primary" onClick={onSave}>
            保存设置
          </button>
        </div>
      </header>
      <p className="rank-toolbar-meta" aria-live="polite">
        {metaText}
      </p>
    </section>
  );
}

