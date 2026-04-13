import { OU_RUNTIME } from '@/shared/constants.js';
import { cleanupOnTabRemoved } from '@/background/cleanupOnTabRemoved.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== OU_RUNTIME.GET_TAB_ID) {
    return false;
  }

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
  cleanupOnTabRemoved(tabId);
});






