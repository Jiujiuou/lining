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
          onKeywordChange={controller.setKeyword}
          onStatusFilterChange={controller.setStatusFilter}
          onStartCrawl={controller.onStartCrawl}
          onStopCrawl={controller.onStopCrawl}
          onRefresh={controller.onRefresh}
          onClearList={controller.onClearList}
          onOpenRandomTen={controller.onOpenRandomTen}
        />
        <FollowListPanel rows={controller.rows} />
      </section>
      <LogPanel logs={controller.logs} onClearLogs={controller.onClearLogs} />
    </div>
  );
}
