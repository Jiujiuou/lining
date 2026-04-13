import React from 'react';

export function FindPageSection() {
  return (
    <div className="popup-findpage-split">
      <section className="popup-section popup-section--findpage-list" aria-label="推广捕获列表">
        <div id="findpage-list" className="popup-findpage-list" role="list" />
      </section>
      <section className="popup-section popup-section--findpage-toolbar" aria-label="列表操作">
        <aside className="popup-findpage-actions" role="toolbar" aria-label="列表操作">
          <button type="button" id="findpage-action" className="popup-action-btn">登记</button>
          <button type="button" id="findpage-refresh" className="popup-action-btn" aria-label="刷新列表">刷新列表</button>
          <button type="button" id="amcr-local-export" className="popup-action-btn" aria-label="导出表格">导出表格</button>
          <button
            type="button"
            id="amcr-local-clear"
            className="popup-action-btn"
            title="清除本地已保存的推广登记快照（不影响云端）"
          >
            清空本地数据
          </button>
        </aside>
      </section>
    </div>
  );
}
