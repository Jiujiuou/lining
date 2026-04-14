import '@/popup/components/BatchActionPanel/styles.css';

export function BatchActionPanel({
  selectedCount,
  onSelectAll,
  onSelectNone,
  onOpenSelected,
  onOpenUncheckedTopN,
  onMarkSelected,
}) {
  return (
    <section className="dy-batch-panel">
      <span className="dy-batch-count">已选 {selectedCount} 人</span>
      <button type="button" className="dy-btn dy-btn-secondary" onClick={onSelectAll}>
        全选
      </button>
      <button type="button" className="dy-btn dy-btn-secondary" onClick={onSelectNone}>
        取消全选
      </button>
      <button type="button" className="dy-btn dy-btn-primary" onClick={onOpenSelected}>
        打开已勾选
      </button>
      <button type="button" className="dy-btn dy-btn-secondary" onClick={() => onOpenUncheckedTopN(10)}>
        打开未查看前10
      </button>
      <button type="button" className="dy-btn dy-btn-secondary" onClick={() => onMarkSelected('已查看')}>
        标记已查看
      </button>
      <button type="button" className="dy-btn dy-btn-secondary" onClick={() => onMarkSelected('候选取关')}>
        标记候选取关
      </button>
    </section>
  );
}

