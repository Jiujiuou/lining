import { sendRuntimeMessage } from '@rext-shared/services/chrome/runtimeService.js';

function hasTabs() {
  return (
    typeof chrome !== 'undefined' &&
    chrome.tabs &&
    typeof chrome.tabs.query === 'function'
  );
}

export function getActiveTabId(callback) {
  const done = typeof callback === 'function' ? callback : () => {};
  if (!hasTabs()) {
    done(null);
    return;
  }

  try {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tabIdByFocusedWindow =
        tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
      if (tabIdByFocusedWindow != null) {
        done(tabIdByFocusedWindow);
        return;
      }

      // 兼容兜底：极端情况下退回 currentWindow
      chrome.tabs.query({ active: true, currentWindow: true }, (fallbackTabs) => {
        const tabId =
          fallbackTabs && fallbackTabs[0] && fallbackTabs[0].id != null ? fallbackTabs[0].id : null;
        done(tabId);
      });
    });
  } catch {
    done(null);
  }
}

export function getActiveTabIdAsync() {
  return new Promise((resolve) => {
    getActiveTabId((tabId) => resolve(tabId));
  });
}

export function resolveTabIdByMessage(messageType, callback) {
  const done = typeof callback === 'function' ? callback : () => {};
  if (!messageType) {
    done(null);
    return;
  }

  sendRuntimeMessage({ type: messageType }, (response, error) => {
    if (error || !response || response.tabId == null) {
      done(null);
      return;
    }
    done(response.tabId);
  });
}

export function resolveTabIdByMessageAsync(messageType) {
  return new Promise((resolve) => {
    resolveTabIdByMessage(messageType, (tabId) => resolve(tabId));
  });
}
