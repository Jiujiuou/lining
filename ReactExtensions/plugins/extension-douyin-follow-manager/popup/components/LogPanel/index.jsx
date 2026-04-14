import { formatLogTime } from '@rext-shared/utils/index.js';
import '@/popup/components/LogPanel/styles.css';

function LogItem({ entry }) {
  const level = entry && entry.level ? entry.level : 'log';
  return (
    <div className={`dy-log-item dy-log-item--${level}`}>
      <span className="dy-log-time">{formatLogTime(entry && entry.t)}</span>
      <span className="dy-log-text">{entry && entry.msg ? String(entry.msg) : ''}</span>
    </div>
  );
}

export function LogPanel({ logs, onClearLogs }) {
  return (
    <section className="dy-log-panel">
      <header className="dy-log-header">
        <h2 className="dy-log-title">日志</h2>
        <button type="button" className="dy-btn dy-btn-secondary" onClick={onClearLogs}>
          清空
        </button>
      </header>
      <div className="dy-log-list" role="log" aria-live="polite">
        {!logs || logs.length === 0 ? (
          <div className="dy-log-empty">暂无日志</div>
        ) : (
          logs.map((entry, index) => <LogItem key={`${entry.t || 'time'}-${index}`} entry={entry} />)
        )}
      </div>
    </section>
  );
}

