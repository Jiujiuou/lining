import '@/popup/components/ToolbarPanel/styles.css';

export function ToolbarPanel({
  keyword,
  statusFilter,
  statusOptions,
  sortField,
  sortDirection,
  useHighQualityDownload,
  onKeywordChange,
  onStatusFilterChange,
  onSortFieldChange,
  onSortDirectionChange,
  onUseHighQualityDownloadChange,
  onStartCrawl,
  onStartPostCrawl,
  onStopCrawl,
  onRefresh,
  onClearList,
  onOpenRandomTen,
  onOpenRandomTwenty,
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
            <button type="button" className="dy-btn dy-btn-secondary" onClick={onRefresh}>
              刷新
            </button>
            <button type="button" className="dy-btn dy-btn-secondary" onClick={onClearList}>
              清空
            </button>
            <button type="button" className="dy-btn dy-btn-secondary" onClick={onExportPostImageUrls}>
              导出URL
            </button>
            <label className="dy-url-mode-switch" title="开启后优先导出最高清 down_url（可能有水印）">
              <input
                type="checkbox"
                className="dy-url-mode-switch__input"
                checked={useHighQualityDownload}
                onChange={(event) => onUseHighQualityDownloadChange(Boolean(event.target.checked))}
              />
              <span className="dy-url-mode-switch__track" />
              <span className="dy-url-mode-switch__label">{useHighQualityDownload ? '高清URL' : '无水印'}</span>
            </label>
            <span className="dy-random-group">
              <button type="button" className="dy-btn dy-btn-secondary" onClick={onOpenRandomTen}>
                随机10
              </button>
              <button type="button" className="dy-btn dy-btn-secondary" onClick={onOpenRandomTwenty}>
                随机20
              </button>
            </span>
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
      </div>
    </section>
  );
}
