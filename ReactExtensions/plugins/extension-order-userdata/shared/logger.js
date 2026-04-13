import { createTabLogService } from '@rext-shared/services/index.js';
import { OU_LIMITS, OU_RUNTIME, OU_STORAGE_KEYS } from '@/shared/constants.js';

export const ouLogger = createTabLogService({
  logKey: OU_STORAGE_KEYS.logs,
  logsByTabKey: OU_STORAGE_KEYS.logsByTab,
  getTabIdMessageType: OU_RUNTIME.GET_TAB_ID,
  maxEntries: OU_LIMITS.LOG_MAX_ENTRIES,
  maxTabs: OU_LIMITS.LOG_MAX_TABS,
});

