import React from 'react';
import { ControlsSection } from '@/popup/components/ControlsSection/index.jsx';
import { LogsSection } from '@/popup/components/LogsSection/index.jsx';
import { useLegacyPopupBootstrap } from '@/popup/hooks/useLegacyPopupBootstrap.js';
import { usePopupAutoRefresh } from '@/popup/hooks/usePopupAutoRefresh.js';
import { usePopupLogSync } from '@/popup/hooks/usePopupLogSync.js';
import { usePopupStorageSync } from '@/popup/hooks/usePopupStorageSync.js';
import { usePopupDomEvents } from '@/popup/hooks/usePopupDomEvents.js';
import '@/popup/styles.css';

export function PopupPage() {
  useLegacyPopupBootstrap();
  usePopupAutoRefresh();
  usePopupLogSync();
  usePopupStorageSync();
  usePopupDomEvents();

  return (
    <div id="app-main" className="popup">
      <ControlsSection />
      <div className="popup-right">
        <LogsSection />
      </div>
    </div>
  );
}

