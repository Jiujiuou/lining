function hasStorageLocal() {
  return (
    typeof chrome !== 'undefined' &&
    chrome.storage &&
    chrome.storage.local
  );
}

function hasStorageChange() {
  return (
    typeof chrome !== 'undefined' &&
    chrome.storage &&
    chrome.storage.onChanged &&
    typeof chrome.storage.onChanged.addListener === 'function'
  );
}

export function isQuotaError(error) {
  if (!error) {
    return false;
  }
  return /quota|QUOTA_BYTES|Resource::kQuotaBytes/i.test(
    String(error.message || error),
  );
}

export function safeSet(payload, onDone, onQuota) {
  const done = typeof onDone === 'function' ? onDone : null;
  const quotaHandler = typeof onQuota === 'function' ? onQuota : null;

  if (!hasStorageLocal()) {
    if (done) {
      done();
    }
    return;
  }

  try {
    chrome.storage.local.set(payload, () => {
      const lastError =
        chrome.runtime && chrome.runtime.lastError
          ? chrome.runtime.lastError
          : null;

      if (lastError && isQuotaError(lastError) && quotaHandler) {
        quotaHandler(() => {
          chrome.storage.local.set(payload, () => {
            if (done) {
              done();
            }
          });
        });
        return;
      }

      if (done) {
        done();
      }
    });
  } catch (error) {
    if (isQuotaError(error) && quotaHandler) {
      quotaHandler(() => {
        chrome.storage.local.set(payload, () => {
          if (done) {
            done();
          }
        });
      });
      return;
    }

    if (done) {
      done();
    }
  }
}

export function getLocal(keys, callback) {
  const done = typeof callback === 'function' ? callback : () => {};
  if (!hasStorageLocal()) {
    done({});
    return;
  }

  try {
    chrome.storage.local.get(keys, (result) => {
      done(result || {});
    });
  } catch {
    done({});
  }
}

export function setLocal(payload, callback) {
  safeSet(payload, callback);
}

export function removeLocal(keys, callback) {
  const done = typeof callback === 'function' ? callback : () => {};
  if (!hasStorageLocal()) {
    done();
    return;
  }
  try {
    chrome.storage.local.remove(keys, () => {
      done();
    });
  } catch {
    done();
  }
}

export function getLocalAsync(keys) {
  return new Promise((resolve) => {
    getLocal(keys, (result) => resolve(result || {}));
  });
}

export function setLocalAsync(payload) {
  return new Promise((resolve) => {
    safeSet(payload, () => resolve());
  });
}

export function removeLocalAsync(keys) {
  return new Promise((resolve) => {
    removeLocal(keys, () => resolve());
  });
}

export function addStorageChangeListener(listener, areaName = 'local') {
  if (!hasStorageChange() || typeof listener !== 'function') {
    return () => {};
  }

  const wrapped = (changes, changedAreaName) => {
    if (areaName && changedAreaName !== areaName) {
      return;
    }
    listener(changes, changedAreaName);
  };

  chrome.storage.onChanged.addListener(wrapped);
  return () => {
    try {
      chrome.storage.onChanged.removeListener(wrapped);
    } catch {
      // 忽略移除监听失败
    }
  };
}

