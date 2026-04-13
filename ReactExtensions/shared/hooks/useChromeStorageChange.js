import { useEffect, useMemo } from 'react';
import { addStorageChangeListener } from '@rext-shared/services/chrome/storageService.js';

function normalizeKeys(keys) {
  if (!keys) {
    return null;
  }
  if (Array.isArray(keys)) {
    return keys.filter(Boolean).map((key) => String(key));
  }
  return [String(keys)];
}

export function useChromeStorageChange(onChange, options = {}) {
  const areaName = options.areaName || 'local';
  const enabled = options.enabled !== false;
  const keyList = useMemo(() => normalizeKeys(options.keys), [options.keys]);
  const keyToken = keyList ? keyList.join('|') : '__all_keys__';

  useEffect(() => {
    if (!enabled || typeof onChange !== 'function') {
      return undefined;
    }

    const keySet = keyList ? new Set(keyList) : null;
    return addStorageChangeListener((changes, changedAreaName) => {
      if (keySet) {
        const hit = Object.keys(changes || {}).some((key) => keySet.has(key));
        if (!hit) {
          return;
        }
      }
      onChange(changes, changedAreaName);
    }, areaName);
  }, [enabled, onChange, areaName, keyToken, keyList]);
}

