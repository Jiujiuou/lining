import '@/popup/components/ProgressPanel/styles.css';

export function ProgressPanel({ progress }) {
  if (!progress.visible) {
    return null;
  }

  return (
    <div
      className={`ou-progress-wrap ${progress.indeterminate ? 'ou-progress-wrap--indeterminate' : ''}`}
      aria-hidden={!progress.visible}
    >
      <div className="ou-progress-meta">
        <span className="ou-progress-label">{progress.label}</span>
        <span className="ou-progress-pages">{progress.pages}</span>
      </div>
      <div
        className="ou-progress-track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={Math.round(progress.percent)}
      >
        <div
          className="ou-progress-fill"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}

