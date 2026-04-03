import { safeSet } from '../shared/chrome/storage.js';
import { STORAGE_KEYS } from './defaults.js';

const MAX_DAYS = 1;

export function getStorageKey() {
  return STORAGE_KEYS.localRegisterByDate;
}

export function mergeRegisterBatch(batch, done) {
  if (
    !batch ||
    typeof batch !== 'object' ||
    !batch.report_date ||
    !batch.biz_code ||
    !Array.isArray(batch.rows)
  ) {
    if (typeof done === 'function') done();
    return;
  }

  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    if (typeof done === 'function') done();
    return;
  }

  const storageKey = getStorageKey();

  chrome.storage.local.get([storageKey], (result) => {
    if (chrome.runtime && chrome.runtime.lastError) {
      if (typeof done === 'function') done();
      return;
    }

    const bag = result[storageKey] && typeof result[storageKey] === 'object' ? result[storageKey] : {};
    const reportDate = String(batch.report_date);

    Object.keys(bag).forEach((key) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && key !== reportDate) {
        delete bag[key];
      }
    });

    const current = bag[reportDate] && typeof bag[reportDate] === 'object' ? bag[reportDate] : {};
    current.byBiz = current.byBiz && typeof current.byBiz === 'object' ? current.byBiz : {};
    current.byBiz[batch.biz_code] = batch.rows.map((row) => ({
      campaign_name: row && row.campaign_name != null ? String(row.campaign_name) : '',
      charge: row && row.charge != null ? Number(row.charge) : 0,
      alipay_inshop_amt: row && row.alipay_inshop_amt != null ? Number(row.alipay_inshop_amt) : 0,
    }));
    current.updated_at_local = new Date().toISOString();
    bag[reportDate] = current;

    const dateKeys = Object.keys(bag)
      .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
      .sort();

    while (dateKeys.length > MAX_DAYS) {
      delete bag[dateKeys.shift()];
    }

    safeSet(
      { [storageKey]: bag },
      () => {
        if (typeof done === 'function') done();
      },
      (retry) => {
        while (dateKeys.length > 0) {
          delete bag[dateKeys.shift()];
        }
        safeSet({ [storageKey]: bag }, retry);
      },
    );
  });
}
