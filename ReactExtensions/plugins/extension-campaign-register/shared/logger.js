import { createTabLogService } from '@rext-shared/services/index.js';
import { AMCR_LIMITS, AMCR_RUNTIME, AMCR_STORAGE_KEYS } from '@/shared/constants.js';

export const amcrLogger = createTabLogService({
  logKey: AMCR_STORAGE_KEYS.logs,
  logsByTabKey: AMCR_STORAGE_KEYS.logsByTab,
  getTabIdMessageType: AMCR_RUNTIME.GET_TAB_ID,
  maxEntries: AMCR_LIMITS.LOG_MAX_ENTRIES,
  maxTabs: AMCR_LIMITS.LOG_MAX_TABS,
});

