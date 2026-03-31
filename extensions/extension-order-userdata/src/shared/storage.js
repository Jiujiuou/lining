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

export function pruneByMeta(byTab, metaKey, maxTabs) {
  if (!byTab || typeof byTab !== 'object') return {};

  const resolvedMetaKey = metaKey || '__meta';
  const limit = typeof maxTabs === 'number' ? maxTabs : 1;
  const meta =
    byTab[resolvedMetaKey] && typeof byTab[resolvedMetaKey] === 'object'
      ? byTab[resolvedMetaKey]
      : {};
  const ids = Object.keys(byTab).filter((key) => key !== resolvedMetaKey);

  if (ids.length <= limit) {
    byTab[resolvedMetaKey] = meta;
    return byTab;
  }

  ids.sort((left, right) => String(meta[left] || '').localeCompare(String(meta[right] || '')));

  while (ids.length > limit) {
    const oldest = ids.shift();
    delete byTab[oldest];
    delete meta[oldest];
  }

  byTab[resolvedMetaKey] = meta;
  return byTab;
}
