import React from 'react';
import { QuickOpenSection } from '@/popup/components/QuickOpenSection/index.jsx';
import { LocalRegisterSection } from '@/popup/components/LocalRegisterSection/index.jsx';
import { FindPageSection } from '@/popup/components/FindPageSection/index.jsx';
import { RightPanelSection } from '@/popup/components/RightPanelSection/index.jsx';
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
      <div className="popup-col popup-col--left">
        <QuickOpenSection />
        <LocalRegisterSection />
        <FindPageSection />
      </div>
      <div className="popup-col popup-col--right">
        <RightPanelSection />
      </div>
    </div>
  );
}

