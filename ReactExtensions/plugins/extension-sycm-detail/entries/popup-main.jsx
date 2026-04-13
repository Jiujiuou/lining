import '@/entries/constants/defaults.js';
import '@/entries/constants/config.js';
import '@/entries/constants/supabase.js';
import '@/entries/constants/time.js';
import '@/entries/utils/common.js';
import '@/entries/utils/time.js';
import '@/entries/utils/storage.js';
import '@/entries/utils/supabase.js';
import '@/entries/utils/logger.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PopupPage } from '@/popup/index.jsx';

function mountPopup() {
  const container = document.getElementById('root');
  if (!container) {
    console.error('[Rext][extension-sycm-detail] 未找到 #root，Popup 挂载失败');
    return;
  }
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <PopupPage />
    </React.StrictMode>,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountPopup, { once: true });
} else {
  mountPopup();
}
