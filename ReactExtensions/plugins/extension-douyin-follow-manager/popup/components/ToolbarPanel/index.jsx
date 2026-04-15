import '@/popup/components/ToolbarPanel/styles.css';

export function ToolbarPanel({
  keyword,
  statusFilter,
  statusOptions,
  sortField,
  sortDirection,
  openByAwemeLimit,
  onKeywordChange,
  onStatusFilterChange,
  onSortFieldChange,
  onSortDirectionChange,
  onOpenByAwemeLimitChange,
  onStartCrawl,
  onStartPostCrawl,
  onStopCrawl,
  onFilterPostAll,
  onFilterPostVideo,
  onFilterPostImage,
  onRefresh,
  onClearList,
  onOpenRandomTen,
  onOpenRandomTwenty,
  onOpenByAwemeLimit,
  onExportPostImageUrls,
  viewedCount,
  totalCount,
}) {
  return (
    <section className="dy-toolbar-panel">
      <div className="dy-toolbar-row dy-toolbar-row--actions">
        <div className="dy-action-groups">
          <div className="dy-action-group">
            <button type="button" className="dy-btn dy-btn-primary" onClick={onStartCrawl}>
              开始采集
            </button>
            <button type="button" className="dy-btn dy-btn-secondary" onClick={onStartPostCrawl}>
              滚动作品
            </button>
            <button type="button" className="dy-btn dy-btn-secondary" onClick={onStopCrawl}>
              停止
            </button>
          </div>

          <div className="dy-action-group">
            <button type="button" className="dy-btn dy-btn-secondary" onClick={onFilterPostAll}>
              全部
            </button>
            <button type="button" className="dy-btn dy-btn-secondary" onClick={onFilterPostVideo}>
              视频
            </button>
            <button type="button" className="dy-btn dy-btn-secondary" onClick={onFilterPostImage}>
              图文
            </button>
            <button type="button" className="dy-btn dy-btn-secondary" onClick={onRefresh}>
              刷新
            </button>
            <button type="button" className="dy-btn dy-btn-secondary" onClick={onClearList}>
              清空
            </button>
            <button type="button" className="dy-btn dy-btn-secondary" onClick={onExportPostImageUrls}>
              导出URL
            </button>
          </div>
        </div>

        <span className="dy-toolbar-counter" title="已查看 / 总关注数">
          {`${viewedCount}/${totalCount}`}
        </span>
      </div>

      <div className="dy-toolbar-row dy-toolbar-row--filters">
        <div className="dy-filter-main">
          <input
            type="text"
            className="dy-input"
            value={keyword}
            placeholder="搜索昵称 / 简介 / uid"
            onChange={(event) => onKeywordChange(event.target.value)}
          />

          <select
            className="dy-select dy-select--status"
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select className="dy-select dy-select--sort" value={sortField} onChange={(event) => onSortFieldChange(event.target.value)}>
            <option value="default">默认顺序</option>
            <option value="followerCount">粉丝数</option>
            <option value="followingCount">关注数</option>
            <option value="awemeCount">作品数</option>
          </select>

          <select
            className="dy-select dy-select--short"
            value={sortDirection}
            onChange={(event) => onSortDirectionChange(event.target.value)}
          >
            <option value="desc">降序</option>
            <option value="asc">升序</option>
          </select>
        </div>

        <div className="dy-batch-main">
          <button type="button" className="dy-btn dy-btn-secondary" onClick={onOpenRandomTen}>
            随机10
          </button>
          <button type="button" className="dy-btn dy-btn-secondary" onClick={onOpenRandomTwenty}>
            随机20
          </button>
          <label className="dy-inline-limit">
            <span>作品≤</span>
            <input
              type="number"
              min="0"
              step="1"
              className="dy-limit-input"
              value={openByAwemeLimit}
              onChange={(event) => onOpenByAwemeLimitChange(event.target.value)}
            />
          </label>
          <button type="button" className="dy-btn dy-btn-secondary" onClick={onOpenByAwemeLimit}>
            一键打开
          </button>
        </div>
      </div>
    </section>
  );
}
