import { OU_STORAGE_KEYS } from '@/shared/constants.js';

const LOG_META_KEY = '__meta';

function getStorageValue(result, key) {
  const value = result && result[key];
  return value && typeof value === 'object' ? { ...value } : {};
}

export function cleanupOnTabRemoved(tabId) {
  const tabIdKey = String(tabId);
  chrome.storage.local.get(
    [OU_STORAGE_KEYS.logsByTab, OU_STORAGE_KEYS.formByTab],
    (result) => {
      const logsByTab = getStorageValue(result, OU_STORAGE_KEYS.logsByTab);
      const formByTab = getStorageValue(result, OU_STORAGE_KEYS.formByTab);

      const hasLogs = Object.prototype.hasOwnProperty.call(logsByTab, tabIdKey);
      const hasForm = Object.prototype.hasOwnProperty.call(formByTab, tabIdKey);
      if (!hasLogs && !hasForm) {
        return;
      }

      delete logsByTab[tabIdKey];
      delete formByTab[tabIdKey];
      if (logsByTab[LOG_META_KEY] && typeof logsByTab[LOG_META_KEY] === 'object') {
        delete logsByTab[LOG_META_KEY][tabIdKey];
      }

      chrome.storage.local.set({
        [OU_STORAGE_KEYS.logsByTab]: logsByTab,
        [OU_STORAGE_KEYS.formByTab]: formByTab,
      });
    },
  );
}




