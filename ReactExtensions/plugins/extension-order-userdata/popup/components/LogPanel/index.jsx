import { formatLogTime } from '@rext-shared/utils/index.js';
import '@/popup/components/LogPanel/styles.css';

function LogItem({ entry }) {
  const level = entry && entry.level ? entry.level : 'log';
  const message = entry && entry.msg != null ? String(entry.msg) : '';
  const time = formatLogTime(entry && entry.t);

  return (
    <div className={`ou-log-entry ou-log-entry--${level}`}>
      <span className="ou-log-time">{time}</span>
      <span className="ou-log-message">{message}</span>
    </div>
  );
}

export function LogPanel({ logs, onClear }) {
  return (
    <section className="ou-log-panel" aria-label="日志">
      <header className="ou-log-header">
        <h2 className="ou-log-title">日志</h2>
        <button type="button" className="ou-log-clear" onClick={onClear}>
          清空
        </button>
      </header>
      <div className="ou-log-list" role="log" aria-live="polite">
        {logs.length === 0 ? (
          <div className="ou-log-empty">暂无日志</div>
        ) : (
          logs.map((entry, index) => (
            <LogItem
              // 历史日志没有稳定 id，使用时间+索引保证渲染稳定
              key={`${entry.t || 'time'}-${index}`}
              entry={entry}
            />
          ))
        )}
      </div>
    </section>
  );
}

