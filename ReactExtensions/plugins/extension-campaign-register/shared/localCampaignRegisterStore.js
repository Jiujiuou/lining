import { getLocalAsync, safeSet } from '@rext-shared/services/index.js';
import { AMCR_STORAGE_KEYS } from '@/shared/constants.js';

const MAX_DAYS = 1;

export function mergeRegisterBatch(batch, done) {
  const callback = typeof done === 'function' ? done : () => {};
  if (
    !batch ||
    typeof batch !== 'object' ||
    !batch.report_date ||
    !batch.biz_code ||
    !Array.isArray(batch.rows)
  ) {
    callback();
    return;
  }

  getLocalAsync([AMCR_STORAGE_KEYS.localRegisterByDate]).then((result) => {
    const bag =
      result[AMCR_STORAGE_KEYS.localRegisterByDate] &&
      typeof result[AMCR_STORAGE_KEYS.localRegisterByDate] === 'object'
        ? { ...result[AMCR_STORAGE_KEYS.localRegisterByDate] }
        : {};
    const date = String(batch.report_date);
    const keys = Object.keys(bag).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key));
    for (let i = 0; i < keys.length; i += 1) {
      if (keys[i] !== date) {
        delete bag[keys[i]];
      }
    }

    const current = bag[date] && typeof bag[date] === 'object' ? { ...bag[date] } : {};
    const byBiz = current.byBiz && typeof current.byBiz === 'object' ? { ...current.byBiz } : {};
    byBiz[batch.biz_code] = batch.rows.map((row) => ({
      campaign_name: row && row.campaign_name != null ? String(row.campaign_name) : '',
      charge: row && row.charge != null ? Number(row.charge) : 0,
      alipay_inshop_amt:
        row && row.alipay_inshop_amt != null ? Number(row.alipay_inshop_amt) : 0,
    }));
    current.byBiz = byBiz;
    current.updated_at_local = new Date().toISOString();
    bag[date] = current;

    const finalDates = Object.keys(bag)
      .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
      .sort((left, right) => left.localeCompare(right));
    while (finalDates.length > MAX_DAYS) {
      delete bag[finalDates.shift()];
    }

    safeSet(
      { [AMCR_STORAGE_KEYS.localRegisterByDate]: bag },
      callback,
      () => {
        while (finalDates.length > 0) {
          delete bag[finalDates.shift()];
        }
        safeSet({ [AMCR_STORAGE_KEYS.localRegisterByDate]: bag }, callback);
      },
    );
  });
}

export function getStorageKey() {
  return AMCR_STORAGE_KEYS.localRegisterByDate;
}

