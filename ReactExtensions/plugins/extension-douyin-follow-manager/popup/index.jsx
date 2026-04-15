import { ToolbarPanel } from '@/popup/components/ToolbarPanel/index.jsx';
import { FollowListPanel } from '@/popup/components/FollowListPanel/index.jsx';
import { LogPanel } from '@/popup/components/LogPanel/index.jsx';
import { useFollowPopupController } from '@/popup/hooks/useFollowPopupController.js';
import '@/popup/styles.css';

export function PopupPage() {
  const controller = useFollowPopupController();
  return (
    <div className="dy-popup-layout">
      <section className="dy-main-panel">
        <ToolbarPanel
          keyword={controller.keyword}
          statusFilter={controller.statusFilter}
          statusOptions={controller.statusOptions}
          sortField={controller.sortField}
          sortDirection={controller.sortDirection}
          openByAwemeLimit={controller.openByAwemeLimit}
          onKeywordChange={controller.setKeyword}
          onStatusFilterChange={controller.setStatusFilter}
          onSortFieldChange={controller.setSortField}
          onSortDirectionChange={controller.setSortDirection}
          onOpenByAwemeLimitChange={controller.setOpenByAwemeLimit}
          onStartCrawl={controller.onStartCrawl}
          onStartPostCrawl={controller.onStartPostCrawl}
          onStopCrawl={controller.onStopCrawl}
          onFilterPostAll={controller.onFilterPostAll}
          onFilterPostVideo={controller.onFilterPostVideo}
          onFilterPostImage={controller.onFilterPostImage}
          onRefresh={controller.onRefresh}
          onClearList={controller.onClearList}
          onOpenRandomTen={controller.onOpenRandomTen}
          onOpenRandomTwenty={controller.onOpenRandomTwenty}
          onOpenByAwemeLimit={controller.onOpenByAwemeLimit}
          onExportPostImageUrls={controller.onExportPostImageUrls}
          viewedCount={controller.viewedCount}
          totalCount={controller.totalCount}
        />
        <FollowListPanel
          rows={controller.rows}
          onOpenUserHome={controller.onOpenUserHome}
          initialScrollTop={controller.listScrollTop}
          onScrollTopChange={controller.onListScrollTopChange}
        />
      </section>
      <LogPanel logs={controller.logs} onClearLogs={controller.onClearLogs} />
    </div>
  );
}
