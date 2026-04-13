import React from 'react';
import { useLegacyPopupBootstrap } from '@/popup/hooks/useLegacyPopupBootstrap.js';
import { usePopupAutoRefresh } from '@/popup/hooks/usePopupAutoRefresh.js';
import { usePopupLogSync } from '@/popup/hooks/usePopupLogSync.js';
import { usePopupStorageSync } from '@/popup/hooks/usePopupStorageSync.js';
import { usePopupDomEvents } from '@/popup/hooks/usePopupDomEvents.js';
import { usePopupRuntimeMessages } from '@/popup/hooks/usePopupRuntimeMessages.js';
import '@/popup/styles.css';

export function PopupPage() {
  useLegacyPopupBootstrap();
  usePopupAutoRefresh();
  usePopupLogSync();
  usePopupStorageSync();
  usePopupDomEvents();
  usePopupRuntimeMessages();

  return (
    <div className="popup">
      <div className="popup-left">
        <section className="popup-section popup-section--goods">
          <header className="popup-findpage-header popup-goods-actions">
            <button type="button" id="goods-refresh" className="popup-findpage-refresh">刷新列表</button>
            <button type="button" id="goods-select-all" className="popup-findpage-refresh">全选</button>
            <button type="button" id="goods-select-none" className="popup-findpage-refresh">全不选</button>
            <button type="button" id="goods-save" className="popup-open-sites">保存设置</button>
          </header>
          <p id="goods-meta" className="popup-goods-meta" aria-live="polite"></p>
          <div className="popup-poll-controls" role="group" aria-label="详情指标轮询">
            <div className="popup-poll-row">
              <label className="popup-poll-label" htmlFor="poll-interval-value">轮询间隔</label>
              <div className="popup-poll-interval">
                <input
                  id="poll-interval-value"
                  className="popup-poll-input"
                  type="number"
                  min="1"
                  max="999"
                  step="1"
                  defaultValue="5"
                  inputMode="numeric"
                />
                <select id="poll-interval-unit" className="popup-poll-select" aria-label="轮询间隔单位" defaultValue="min">
                  <option value="sec">秒</option>
                  <option value="min">分</option>
                  <option value="hour">时</option>
                </select>
              </div>
            </div>
            <div className="popup-poll-row">
              <label className="popup-poll-label">并发</label>
              <div className="popup-poll-readonly" aria-label="并发固定为 1">1（固定）</div>
            </div>
            <div className="popup-poll-actions">
              <button type="button" id="poll-start" className="popup-open-sites">开始采集详情</button>
              <button type="button" id="poll-stop" className="popup-findpage-refresh">停止</button>
            </div>
            <p id="poll-meta" className="popup-goods-meta" aria-live="polite"></p>
          </div>
          <div id="goods-list" className="popup-findpage-list" role="list"></div>
        </section>
      </div>
      <section className="popup-section popup-section--logs">
        <header className="popup-logs-header">
          <h2 className="popup-logs-title">扩展日志</h2>
          <button type="button" id="logs-export" className="popup-logs-clear" aria-label="复制扩展日志到剪贴板">复制</button>
          <button type="button" id="logs-clear" className="popup-logs-clear" aria-label="清空扩展日志">清空</button>
        </header>
        <div id="logs-list" className="popup-logs-list" role="log" aria-live="polite"></div>
      </section>
    </div>
  );
}

