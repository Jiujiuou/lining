import { safeSet } from './storage.js';

export function pruneDateBag(bag, maxDays) {
  const nextBag = bag && typeof bag === 'object' ? bag : {};
  const dates = Object.keys(nextBag)
    .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
    .sort();

  while (dates.length > maxDays) {
    delete nextBag[dates.shift()];
  }

  return nextBag;
}

export function mergeDatePatch(storageKey, dateKey, patch, options = {}) {
  const { maxDays = 1, done } = options;

  chrome.storage.local.get([storageKey], (result) => {
    const bag = result[storageKey] && typeof result[storageKey] === 'object' ? result[storageKey] : {};
    const current = bag[dateKey] && typeof bag[dateKey] === 'object' ? bag[dateKey] : {};
    const next = { ...current };

    for (const [key, value] of Object.entries(patch || {})) {
      if (key === 'report_at') {
        next.report_at = value;
        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        next[key] = value;
      }
    }

    next.updated_at_local = new Date().toISOString();
    bag[dateKey] = next;
    pruneDateBag(bag, maxDays);

    safeSet(
      { [storageKey]: bag },
      () => {
        if (typeof done === 'function') done();
      },
      (retry) => {
        pruneDateBag(bag, Math.max(1, maxDays - 1));
        safeSet({ [storageKey]: bag }, retry);
      },
    );
  });
}

export function mergeDateBizRows(storageKey, dateKey, bizCode, rows, options = {}) {
  const { maxDays = 1, done } = options;

  chrome.storage.local.get([storageKey], (result) => {
    const bag = result[storageKey] && typeof result[storageKey] === 'object' ? result[storageKey] : {};
    const current = bag[dateKey] && typeof bag[dateKey] === 'object' ? bag[dateKey] : {};

    current.byBiz = current.byBiz && typeof current.byBiz === 'object' ? current.byBiz : {};
    current.byBiz[bizCode] = Array.isArray(rows) ? rows.slice() : [];
    current.updated_at_local = new Date().toISOString();

    bag[dateKey] = current;
    pruneDateBag(bag, maxDays);

    safeSet(
      { [storageKey]: bag },
      () => {
        if (typeof done === 'function') done();
      },
      (retry) => {
        pruneDateBag(bag, Math.max(1, maxDays - 1));
        safeSet({ [storageKey]: bag }, retry);
      },
    );
  });
}
