/* global chrome */
import { safeSet } from '../../shared/chrome/storage.js';
import { MESSAGE_TYPES, STORAGE_KEYS } from '../defaults.js';

const META_KEY = '__meta';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== MESSAGE_TYPES.GET_TAB_ID) return false;

  if (sender.tab && sender.tab.id != null) {
    sendResponse({ tabId: sender.tab.id });
    return true;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
    sendResponse({ tabId });
  });

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const tabKey = String(tabId);

  chrome.storage.local.get(
    [STORAGE_KEYS.liveJsonFilterByTab, STORAGE_KEYS.liveJsonCatalogByTab, STORAGE_KEYS.logsByTab],
    (result) => {
      const filterByTab = result[STORAGE_KEYS.liveJsonFilterByTab] || {};
      const catalogByTab = result[STORAGE_KEYS.liveJsonCatalogByTab] || {};
      const logsByTab = result[STORAGE_KEYS.logsByTab] || {};

      if (!filterByTab[tabKey] && !catalogByTab[tabKey] && !logsByTab[tabKey]) {
        return;
      }

      delete filterByTab[tabKey];
      delete catalogByTab[tabKey];
      delete logsByTab[tabKey];

      if (filterByTab[META_KEY] && typeof filterByTab[META_KEY] === 'object') {
        delete filterByTab[META_KEY][tabKey];
      }
      if (catalogByTab[META_KEY] && typeof catalogByTab[META_KEY] === 'object') {
        delete catalogByTab[META_KEY][tabKey];
      }
      if (logsByTab[META_KEY] && typeof logsByTab[META_KEY] === 'object') {
        delete logsByTab[META_KEY][tabKey];
      }

      safeSet(
        {
          [STORAGE_KEYS.liveJsonFilterByTab]: filterByTab,
          [STORAGE_KEYS.liveJsonCatalogByTab]: catalogByTab,
          [STORAGE_KEYS.logsByTab]: logsByTab,
        },
        () => {},
      );
    },
  );
});
