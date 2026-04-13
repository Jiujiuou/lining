import React from 'react';

export function ControlsSection() {
  return (
    <div className="popup-left">
      <section className="popup-section popup-section--controls" aria-label="控制区">
        <div className="popup-controls-page-row">
          <button type="button" id="shop-rate-open" className="popup-open-sites">店铺分</button>
          <button type="button" id="alimama-open" className="popup-open-sites">淘宝联盟</button>
          <button type="button" id="onebp-open" className="popup-open-sites">万象台1</button>
          <button type="button" id="onebp-display-open" className="popup-open-sites">万象台2</button>
          <button type="button" id="onebp-site-open" className="popup-open-sites">万象3</button>
          <button type="button" id="onebp-shortvideo-open" className="popup-open-sites">万象4</button>
          <button type="button" id="sycm-my-space-open" className="popup-open-sites">千牛后台</button>
          <button type="button" id="report-submit-open" className="popup-open-sites">上报页</button>
        </div>
        <div className="popup-controls-action-row">
          <button type="button" id="open-all-pages" className="popup-open-sites popup-open-all">
            一键打开所有页面
          </button>
          <button
            type="button"
            id="report-submit-fill"
            className="popup-open-sites popup-open-sites--fill"
            title="将本地合并数据填入联核 OA 上报页（需已打开或自动打开上报页）"
          >
            自动填充数据
          </button>
          <div id="metrics-date" className="popup-metrics-inline-date">--</div>
          <button
            type="button"
            id="daily-local-clear"
            className="popup-open-sites popup-open-sites--clear"
            title="清除合并后的每日指标快照（不影响云端）"
          >
            清空本地数据
          </button>
        </div>
      </section>
      <section
        className="popup-section popup-section--findpage popup-section--findpage-tight"
        id="shop-record-findpage-section"
      >
        <div
          id="shop-record-body"
          className="popup-findpage-list popup-findpage-list--metrics"
          role="region"
          aria-label="主内容区"
        />
      </section>
    </div>
  );
}

