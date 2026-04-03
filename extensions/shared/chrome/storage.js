export function isQuotaError(error) {
  if (!error) return false;
  return /quota|QUOTA_BYTES|Resource::kQuotaBytes/i.test(String(error.message || error));
}

export function safeSet(payload, onDone, onQuota) {
  chrome.storage.local.set(payload, () => {
    if (
      chrome.runtime &&
      chrome.runtime.lastError &&
      isQuotaError(chrome.runtime.lastError) &&
      typeof onQuota === 'function'
    ) {
      onQuota(() => {
        chrome.storage.local.set(payload, () => {
          if (typeof onDone === 'function') onDone();
        });
      });
      return;
    }

    if (typeof onDone === 'function') onDone();
  });
}

export function pruneByMeta(byTab, metaKey = '__meta', maxTabs = 1) {
  if (!byTab || typeof byTab !== 'object') return {};

  const meta = byTab[metaKey] && typeof byTab[metaKey] === 'object' ? byTab[metaKey] : {};
  const ids = Object.keys(byTab).filter((key) => key !== metaKey);

  if (ids.length <= maxTabs) {
    byTab[metaKey] = meta;
    return byTab;
  }

  ids.sort((left, right) => String(meta[left] || '').localeCompare(String(meta[right] || '')));

  while (ids.length > maxTabs) {
    const oldest = ids.shift();
    delete byTab[oldest];
    delete meta[oldest];
  }

  byTab[metaKey] = meta;
  return byTab;
}
