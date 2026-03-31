import { STORAGE_KEYS } from '../shared/defaults.js';
import { MESSAGE_TYPES } from '../shared/messages.js';
import { safeSet } from '../shared/storage.js';

const LOG_META_KEY = '__meta';

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
  const tabIdKey = String(tabId);

  chrome.storage.local.get([STORAGE_KEYS.logsByTab, STORAGE_KEYS.formByTab], (result) => {
    const logsByTab = result[STORAGE_KEYS.logsByTab] || {};
    const formByTab = result[STORAGE_KEYS.formByTab] || {};

    if (
      !Object.prototype.hasOwnProperty.call(logsByTab, tabIdKey) &&
      !Object.prototype.hasOwnProperty.call(formByTab, tabIdKey)
    ) {
      return;
    }

    delete logsByTab[tabIdKey];
    delete formByTab[tabIdKey];

    if (logsByTab[LOG_META_KEY] && typeof logsByTab[LOG_META_KEY] === 'object') {
      delete logsByTab[LOG_META_KEY][tabIdKey];
    }

    safeSet(
      {
        [STORAGE_KEYS.logsByTab]: logsByTab,
        [STORAGE_KEYS.formByTab]: formByTab,
      },
      () => {},
    );
  });
});
