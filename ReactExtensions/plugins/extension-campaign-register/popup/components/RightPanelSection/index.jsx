import React from 'react';

export function RightPanelSection() {
  return (
    <>
      <section className="popup-section popup-section--storage">
        <header className="popup-storage-header">
          <div className="popup-storage-progress-row">
            <div className="popup-storage-progress" aria-hidden="true">
              <div id="storage-usage-bar" className="popup-storage-progress-bar" />
            </div>
            <span id="storage-usage-percent" className="popup-storage-percent">0.0%</span>
          </div>
          <button
            type="button"
            id="storage-cache-clear"
            className="popup-storage-clear"
            aria-label="清理缓存"
            title="清理列表缓存和日志缓存，不清空本地登记表"
          >
            清理缓存
          </button>
        </header>
        <div id="storage-usage" className="popup-storage-usage">加载中...</div>
      </section>

      <section className="popup-section popup-section--logs">
        <header className="popup-logs-header">
          <h2 className="popup-logs-title">日志</h2>
          <button type="button" id="logs-clear" className="popup-logs-clear" aria-label="清空日志">清空日志</button>
        </header>
        <div id="logs-list" className="popup-logs-list" role="log" aria-live="polite" />
      </section>
    </>
  );
}
