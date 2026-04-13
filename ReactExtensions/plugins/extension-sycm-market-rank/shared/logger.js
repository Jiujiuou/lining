import { createTabLogService } from '@rext-shared/services/index.js';
import {
  SYCM_RANK_LIMITS,
  SYCM_RANK_RUNTIME,
  SYCM_RANK_STORAGE_KEYS,
} from '@/shared/constants.js';

export const rankLogger = createTabLogService({
  logKey: SYCM_RANK_STORAGE_KEYS.logs,
  logsByTabKey: SYCM_RANK_STORAGE_KEYS.logsByTab,
  getTabIdMessageType: SYCM_RANK_RUNTIME.GET_TAB_ID_MESSAGE,
  maxEntries: SYCM_RANK_LIMITS.LOG_MAX_ENTRIES,
  maxTabs: SYCM_RANK_LIMITS.LOG_MAX_TABS,
});

