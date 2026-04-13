import { SYCM_RANK_LIMITS } from '@/shared/constants.js';

const SELECTION_META_KEY = '__meta';

export function rowKey(row, index) {
  if (row && row.itemId != null && String(row.itemId).trim() !== '') {
    return String(row.itemId);
  }
  return `idx-${index}`;
}

export function getSelectionIds(filter) {
  if (!filter || !Array.isArray(filter.itemIds)) {
    return [];
  }
  return filter.itemIds.map((id) => String(id));
}

export function filterIdsToCatalog(ids, items) {
  const catalogSet = new Set();
  for (let i = 0; i < items.length; i += 1) {
    catalogSet.add(rowKey(items[i], i));
  }
  return ids.filter((id) => catalogSet.has(id));
}

export function pruneSelectionByTab(byTab) {
  if (!byTab || typeof byTab !== 'object') {
    return {};
  }
  const next = { ...byTab };
  const meta =
    next[SELECTION_META_KEY] && typeof next[SELECTION_META_KEY] === 'object'
      ? { ...next[SELECTION_META_KEY] }
      : {};

  const tabIds = Object.keys(next).filter((key) => key !== SELECTION_META_KEY);
  if (tabIds.length <= SYCM_RANK_LIMITS.RANK_MAX_TABS) {
    next[SELECTION_META_KEY] = meta;
    return next;
  }

  tabIds.sort((left, right) => {
    const leftAt = meta[left] || '';
    const rightAt = meta[right] || '';
    return String(leftAt).localeCompare(String(rightAt));
  });

  while (tabIds.length > SYCM_RANK_LIMITS.RANK_MAX_TABS) {
    const oldest = tabIds.shift();
    delete next[oldest];
    delete meta[oldest];
  }
  next[SELECTION_META_KEY] = meta;
  return next;
}





