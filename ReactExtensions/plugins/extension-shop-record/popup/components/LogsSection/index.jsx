import React from 'react';

export function LogsSection() {
  return (
    <section className="popup-section popup-section--logs">
      <header className="popup-logs-header">
        <h2 className="popup-logs-title">日志</h2>
        <button type="button" id="logs-clear" className="popup-logs-clear" aria-label="清空日志">
          清空
        </button>
      </header>
      <div id="logs-list" className="popup-logs-list" role="log" aria-live="polite" />
    </section>
  );
}

