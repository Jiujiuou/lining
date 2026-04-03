export function createMessageTabIdResolver(messageType) {
  return function resolveTabId(callback) {
    try {
      chrome.runtime.sendMessage({ type: messageType }, (response) => {
        if (chrome.runtime.lastError || !response || response.tabId == null) {
          callback(null);
          return;
        }
        callback(response.tabId);
      });
    } catch (_error) {
      callback(null);
    }
  };
}

export function queryActiveTabId(query, callback) {
  try {
    chrome.tabs.query(query || { active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
      callback(tabId);
    });
  } catch (_error) {
    callback(null);
  }
}

export function sendRuntimeMessage(payload) {
  try {
    const pending = chrome.runtime.sendMessage(payload);
    if (pending && typeof pending.catch === 'function') {
      pending.catch(() => {});
    }
  } catch (_error) {
    // ignore runtime delivery failures
  }
}
