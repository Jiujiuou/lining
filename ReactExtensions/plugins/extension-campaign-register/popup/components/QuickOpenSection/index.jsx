import React from 'react';

export function QuickOpenSection() {
  return (
    <section className="popup-section popup-section--quick-open">
      <div className="popup-quick-open-row" role="group" aria-label="搜索词、日期与推广页">
        <div className="popup-nav-cal-wrap dashboard-cal-inline">
          <div className="dashboard-cal-anchor" id="popup-nav-cal-anchor">
            <button
              type="button"
              id="popup-nav-date-trigger"
              className="dashboard-date-select dashboard-cal-trigger"
              aria-expanded="false"
              aria-haspopup="dialog"
              aria-label="选择打开推广页的日期"
            />
            <div
              id="popup-nav-cal-popover"
              className="dashboard-cal-popover"
              hidden
              role="dialog"
              aria-label="选择日期"
            />
          </div>
        </div>
        <input
          type="text"
          id="search-keyword-input"
          className="popup-search-keyword-input"
          placeholder="搜索词"
          defaultValue="池"
          aria-label="推广搜索词"
        />
        <button type="button" id="search-keyword-apply" className="popup-search-keyword-apply">应用</button>
        <button type="button" id="open-onesite-record" className="popup-open-sites">货品全站</button>
        <button type="button" id="open-search-record" className="popup-open-sites">关键词</button>
        <button type="button" id="open-promo-record" className="popup-open-sites">人群</button>
        <button type="button" id="open-content-record" className="popup-open-sites">内容营销</button>
      </div>
    </section>
  );
}
