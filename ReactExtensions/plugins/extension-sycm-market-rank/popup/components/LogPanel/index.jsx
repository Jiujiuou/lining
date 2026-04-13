import { formatLogTime } from '@rext-shared/utils/index.js';
import '@/popup/components/LogPanel/styles.css';

function LogItem({ entry }) {
  const level = entry && entry.level ? entry.level : 'log';
  return (
    <div className={`rank-log-item rank-log-item--${level}`}>
      <span className="rank-log-time">{formatLogTime(entry && entry.t)}</span>
      <span className="rank-log-text">{entry && entry.msg ? String(entry.msg) : ''}</span>
    </div>
  );
}

export function LogPanel({ logs, onClearLogs }) {
  return (
    <section className="rank-log-panel">
      <header className="rank-log-header">
        <h2 className="rank-log-title">日志</h2>
        <button type="button" className="rank-log-clear" onClick={onClearLogs}>
          清空
        </button>
      </header>
      <div className="rank-log-list" role="log" aria-live="polite">
        {!logs || logs.length === 0 ? (
          <div className="rank-log-empty">暂无日志</div>
        ) : (
          logs.map((entry, index) => (
            <LogItem key={`${entry.t || 'time'}-${index}`} entry={entry} />
          ))
        )}
      </div>
    </section>
  );
}

