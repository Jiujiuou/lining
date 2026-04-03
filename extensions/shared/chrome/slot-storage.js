import { safeSet } from './storage.js';

export function getPositiveNumberSetting(storageKey, callback) {
  chrome.storage.local.get([storageKey], (result) => {
    const value = result[storageKey];
    callback(typeof value === 'number' && value > 0 ? value : null);
  });
}

export function setLastSlot(storageKeys, eventName, slotKey, callback) {
  const key = `${storageKeys.lastSlotPrefix}${eventName}`;
  safeSet({ [key]: slotKey }, callback || (() => {}), (retry) => {
    chrome.storage.local.remove([key], () => {
      retry();
    });
  });
}

export function setLastSlotsForItems(storageKeys, eventName, itemIdStrings, slotKey, callback) {
  const payload = {};

  for (const itemId of itemIdStrings || []) {
    if (itemId == null || itemId === '') continue;
    payload[`${storageKeys.lastSlotPrefix}${eventName}_${String(itemId)}`] = slotKey;
  }

  const keys = Object.keys(payload);
  if (keys.length === 0) {
    (callback || (() => {}))();
    return;
  }

  safeSet(payload, callback || (() => {}), (retry) => {
    chrome.storage.local.remove(keys, () => {
      retry();
    });
  });
}
