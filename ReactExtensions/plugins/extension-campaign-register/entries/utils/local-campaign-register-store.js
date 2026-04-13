import {
  getStorageKey,
  mergeRegisterBatch,
} from '@/shared/localCampaignRegisterStore.js';

globalThis.__AMCR_LOCAL_REGISTER__ = {
  mergeRegisterBatch,
  getStorageKey,
};





