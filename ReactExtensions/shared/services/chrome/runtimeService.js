function hasRuntime() {
  return (
    typeof chrome !== 'undefined' &&
    chrome.runtime &&
    typeof chrome.runtime.sendMessage === 'function'
  );
}

export function sendRuntimeMessage(message, callback) {
  const done = typeof callback === 'function' ? callback : null;

  if (!hasRuntime()) {
    if (done) {
      done(null, new Error('chrome.runtime 不可用'));
    }
    return;
  }

  try {
    chrome.runtime.sendMessage(message, (response) => {
      const lastError =
        chrome.runtime && chrome.runtime.lastError
          ? chrome.runtime.lastError
          : null;
      if (done) {
        done(response ?? null, lastError ?? null);
      }
    });
  } catch (error) {
    if (done) {
      done(null, error);
    }
  }
}

export function sendRuntimeMessageAsync(message) {
  return new Promise((resolve) => {
    sendRuntimeMessage(message, (response, error) => {
      if (error) {
        resolve({ response: null, error });
        return;
      }
      resolve({ response, error: null });
    });
  });
}

export function addRuntimeListener(handler) {
  if (
    !hasRuntime() ||
    !chrome.runtime.onMessage ||
    typeof chrome.runtime.onMessage.addListener !== 'function' ||
    typeof handler !== 'function'
  ) {
    return () => {};
  }

  const wrapped = (message, sender, sendResponse) => {
    try {
      const result = handler(message, sender);
      if (result && typeof result.then === 'function') {
        result
          .then((data) => {
            sendResponse(data);
          })
          .catch((error) => {
            sendResponse({
              ok: false,
              error: String(error && error.message ? error.message : error),
            });
          });
        return true;
      }

      if (result !== undefined) {
        sendResponse(result);
      }
      return false;
    } catch (error) {
      sendResponse({
        ok: false,
        error: String(error && error.message ? error.message : error),
      });
      return false;
    }
  };

  chrome.runtime.onMessage.addListener(wrapped);
  return () => {
    try {
      chrome.runtime.onMessage.removeListener(wrapped);
    } catch {
      // 忽略移除监听失败
    }
  };
}

