/* global chrome */
import { pruneByMeta, safeSet } from './storage.js';

export const DEFAULT_META_KEY = '__meta';

export function getScopedState(result, byTabKey, fallbackKey, tabId) {
  if (tabId != null) {
    const byTab = result && result[byTabKey] ? result[byTabKey] : {};
    const scoped = byTab[String(tabId)];
    if (typeof scoped !== 'undefined') {
      return scoped;
    }
  }

  return result ? result[fallbackKey] : undefined;
}

export function saveScopedState({
  storageKey,
  tabId,
  value,
  maxTabs = 6,
  metaKey = DEFAULT_META_KEY,
  onDone,
  onQuota,
}) {
  if (tabId == null) {
    safeSet({ [storageKey]: value }, onDone, onQuota);
    return;
  }

  chrome.storage.local.get([storageKey], (result) => {
    const byTab = result[storageKey] || {};
    const nextByTab = {
      ...byTab,
      [String(tabId)]: value,
    };
    const meta =
      nextByTab[metaKey] && typeof nextByTab[metaKey] === 'object' ? nextByTab[metaKey] : {};
    meta[String(tabId)] = new Date().toISOString();
    nextByTab[metaKey] = meta;

    safeSet(
      { [storageKey]: pruneByMeta(nextByTab, metaKey, maxTabs) },
      onDone,
      typeof onQuota === 'function'
        ? () => {
            const retryByTab = pruneByMeta(nextByTab, metaKey, Math.max(1, maxTabs - 1));
            onQuota(() => {
              safeSet({ [storageKey]: retryByTab }, onDone);
            });
          }
        : undefined,
    );
  });
}
