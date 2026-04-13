import { ToolbarPanel } from '@/popup/components/ToolbarPanel/index.jsx';
import { RankListPanel } from '@/popup/components/RankListPanel/index.jsx';
import { LogPanel } from '@/popup/components/LogPanel/index.jsx';
import { useMarketRankPopupController } from '@/popup/hooks/useMarketRankPopupController.js';
import '@/popup/styles.css';

export function PopupPage() {
  const {
    metaText,
    rows,
    logs,
    onToggleRow,
    onSelectAll,
    onSelectNone,
    onSave,
    onRefresh,
    onClearLogs,
  } = useMarketRankPopupController();

  return (
    <div className="rank-popup-layout">
      <section className="rank-main-panel">
        <ToolbarPanel
          metaText={metaText}
          onRefresh={onRefresh}
          onSelectAll={onSelectAll}
          onSelectNone={onSelectNone}
          onSave={onSave}
        />
        <RankListPanel rows={rows} onToggleRow={onToggleRow} />
      </section>
      <LogPanel logs={logs} onClearLogs={onClearLogs} />
    </div>
  );
}


