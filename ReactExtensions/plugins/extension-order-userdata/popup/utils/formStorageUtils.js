import { getLocalAsync, safeSet } from '@rext-shared/services/index.js';
import { OU_LIMITS, OU_STORAGE_KEYS } from '@/shared/constants.js';

const DEFAULT_FORM = {
  unionSearch: '',
  buyerNick: '',
  orderStatus: 'SUCCESS',
  payDateBegin: '',
  payDateEnd: '',
};

export function getDefaultForm() {
  return { ...DEFAULT_FORM };
}

export async function readFormByTab(tabId) {
  if (tabId == null) {
    return getDefaultForm();
  }
  const result = await getLocalAsync([OU_STORAGE_KEYS.formByTab]);
  const byTab =
    result[OU_STORAGE_KEYS.formByTab] &&
    typeof result[OU_STORAGE_KEYS.formByTab] === 'object'
      ? result[OU_STORAGE_KEYS.formByTab]
      : {};
  const target = byTab[String(tabId)];
  if (!target || typeof target !== 'object') {
    return getDefaultForm();
  }
  return {
    unionSearch: target.unionSearch != null ? String(target.unionSearch) : '',
    buyerNick: target.buyerNick != null ? String(target.buyerNick) : '',
    orderStatus: target.orderStatus != null ? String(target.orderStatus) : 'SUCCESS',
    payDateBegin: target.payDateBegin != null ? String(target.payDateBegin) : '',
    payDateEnd: target.payDateEnd != null ? String(target.payDateEnd) : '',
  };
}

export async function saveFormByTab(tabId, nextForm) {
  if (tabId == null) {
    return;
  }

  const result = await getLocalAsync([OU_STORAGE_KEYS.formByTab]);
  const byTab =
    result[OU_STORAGE_KEYS.formByTab] &&
    typeof result[OU_STORAGE_KEYS.formByTab] === 'object'
      ? { ...result[OU_STORAGE_KEYS.formByTab] }
      : {};
  byTab[String(tabId)] = nextForm;

  safeSet(
    { [OU_STORAGE_KEYS.formByTab]: byTab },
    () => {},
    (retry) => {
      const keys = Object.keys(byTab).sort((a, b) => a.localeCompare(b));
      while (keys.length > OU_LIMITS.FORM_MAX_TABS) {
        const oldestKey = keys.shift();
        delete byTab[oldestKey];
      }
      safeSet({ [OU_STORAGE_KEYS.formByTab]: byTab }, retry);
    },
  );
}





