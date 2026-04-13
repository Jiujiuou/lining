import { useCallback, useEffect, useState } from 'react';
import {
  getLocalAsync,
  setLocalAsync,
} from '@rext-shared/services/chrome/storageService.js';
import { useChromeStorageChange } from '@rext-shared/hooks/useChromeStorageChange.js';

function hasOwnKey(data, key) {
  return data && Object.prototype.hasOwnProperty.call(data, key);
}

export function useStorageState(storageKey, initialValue, options = {}) {
  const listen = options.listen !== false;
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(Boolean(storageKey));

  const refresh = useCallback(async () => {
    if (!storageKey) {
      setLoading(false);
      return initialValue;
    }

    const result = await getLocalAsync([storageKey]);
    const nextValue = hasOwnKey(result, storageKey)
      ? result[storageKey]
      : initialValue;
    setValue(nextValue);
    setLoading(false);
    return nextValue;
  }, [storageKey, initialValue]);

  const updateValue = useCallback(
    async (updater) => {
      let nextValue = initialValue;
      setValue((prevValue) => {
        nextValue =
          typeof updater === 'function' ? updater(prevValue) : updater;
        return nextValue;
      });

      if (storageKey) {
        await setLocalAsync({ [storageKey]: nextValue });
      }
      return nextValue;
    },
    [storageKey, initialValue],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useChromeStorageChange(
    (changes) => {
      if (!storageKey || !changes || !changes[storageKey]) {
        return;
      }
      const nextValue = changes[storageKey].newValue;
      setValue(nextValue === undefined ? initialValue : nextValue);
    },
    {
      enabled: listen && Boolean(storageKey),
      keys: storageKey ? [storageKey] : [],
    },
  );

  return {
    value,
    loading,
    refresh,
    setValue: updateValue,
  };
}

