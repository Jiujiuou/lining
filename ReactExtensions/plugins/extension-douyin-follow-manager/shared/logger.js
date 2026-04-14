import { createTabLogService } from '@rext-shared/services/index.js';
import {
  DY_FOLLOW_LIMITS,
  DY_FOLLOW_RUNTIME,
  DY_FOLLOW_STORAGE_KEYS,
} from '@/shared/constants.js';

export const followLogger = createTabLogService({
  logKey: DY_FOLLOW_STORAGE_KEYS.logs,
  logsByTabKey: DY_FOLLOW_STORAGE_KEYS.logsByTab,
  getTabIdMessageType: DY_FOLLOW_RUNTIME.GET_TAB_ID_MESSAGE,
  maxEntries: DY_FOLLOW_LIMITS.LOG_MAX_ENTRIES,
  maxTabs: DY_FOLLOW_LIMITS.LOG_MAX_TABS,
});

