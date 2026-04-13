import '@/popup/components/RankListPanel/styles.css';

function RankRow({ row, onToggleRow }) {
  return (
    <div className="rank-list-row" role="listitem" title={`${row.shopTitle} ${row.itemTitle || ''}`}>
      <input
        type="checkbox"
        checked={row.checked}
        onChange={(event) => onToggleRow(row.id, event.target.checked)}
        aria-label={`勾选 ${row.shopTitle}`}
      />
      <span className="rank-list-num">{row.rank}</span>
      <div className="rank-list-text">
        <span className="rank-list-shop">{row.shopTitle}</span>
        {row.itemTitle ? <span className="rank-list-item">{row.itemTitle}</span> : null}
      </div>
    </div>
  );
}

export function RankListPanel({ rows, onToggleRow }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="rank-list-empty">
        暂无数据。请在生意参谋触发 rank.json 后点击“刷新列表”。
      </div>
    );
  }

  return (
    <div className="rank-list-panel" role="list">
      {rows.map((row) => (
        <RankRow key={row.id} row={row} onToggleRow={onToggleRow} />
      ))}
    </div>
  );
}

