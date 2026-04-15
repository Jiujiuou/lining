import { useEffect, useRef } from 'react';
import '@/popup/components/FollowListPanel/styles.css';
import { formatCount } from '@/popup/utils/viewTextUtils.js';

function FollowRow({ row, onOpenUserHome }) {
  return (
    <div className="dy-list-row">
      <button type="button" className="dy-avatar-btn" onClick={() => onOpenUserHome(row)} title="打开主页">
        <img className="dy-avatar" src={row.avatar || ''} alt="" loading="lazy" />
      </button>

      <div className="dy-main">
        <p className="dy-name">{row.nickname}</p>
        <p className="dy-signature">{row.signature || '（无简介）'}</p>
        <p className="dy-metrics">粉丝 {formatCount(row.followerCount)} · 作品 {formatCount(row.awemeCount)}</p>
      </div>

      <span className={`dy-status dy-status--${row.viewStatus}`}>{row.viewStatus}</span>
    </div>
  );
}

export function FollowListPanel({ rows, onOpenUserHome, initialScrollTop = 0, onScrollTopChange }) {
  const listRef = useRef(null);

  useEffect(() => {
    const node = listRef.current;
    if (!node) {
      return;
    }
    const nextTop = Number(initialScrollTop);
    if (!Number.isFinite(nextTop) || nextTop < 0) {
      return;
    }
    if (Math.abs(node.scrollTop - nextTop) > 2) {
      node.scrollTop = nextTop;
    }
  }, [initialScrollTop, rows.length]);

  if (!rows || rows.length === 0) {
    return <div className="dy-list-empty">暂无可展示的关注用户</div>;
  }

  return (
    <section
      ref={listRef}
      className="dy-list-panel"
      onScroll={(event) => {
        if (typeof onScrollTopChange !== 'function') {
          return;
        }
        onScrollTopChange(event.currentTarget.scrollTop);
      }}
    >
      {rows.map((row) => (
        <FollowRow key={row.id} row={row} onOpenUserHome={onOpenUserHome} />
      ))}
    </section>
  );
}
