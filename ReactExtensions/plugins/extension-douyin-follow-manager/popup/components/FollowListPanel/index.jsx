import '@/popup/components/FollowListPanel/styles.css';

function FollowRow({ row }) {
  return (
    <div className="dy-list-row">
      <img className="dy-avatar" src={row.avatar || ''} alt="" loading="lazy" />
      <div className="dy-main">
        <p className="dy-name">{row.nickname}</p>
        <p className="dy-signature">{row.signature || '（无简介）'}</p>
      </div>
      <span className={`dy-status dy-status--${row.viewStatus}`}>{row.viewStatus}</span>
    </div>
  );
}

export function FollowListPanel({ rows }) {
  if (!rows || rows.length === 0) {
    return <div className="dy-list-empty">暂无可展示的关注用户</div>;
  }
  return (
    <section className="dy-list-panel">
      {rows.map((row) => <FollowRow key={row.id} row={row} />)}
    </section>
  );
}
