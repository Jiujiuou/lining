import { useEffect } from 'react';
import { readFormByTab } from '@/popup/utils/formStorageUtils.js';

export function useOrderUserdataFocusSync({ tabId, refreshAll, setForm }) {
  useEffect(() => {
    const onFocus = () => {
      refreshAll();
      readFormByTab(tabId).then((nextForm) => {
        setForm(nextForm);
      });
    };

    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshAll, setForm, tabId]);
}

