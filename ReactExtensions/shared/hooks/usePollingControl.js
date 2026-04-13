import { useCallback, useEffect, useRef, useState } from 'react';

export function usePollingControl(options = {}) {
  const intervalMs = Number(options.intervalMs) || 0;
  const autoStart = options.autoStart === true;
  const immediate = options.immediate !== false;
  const [running, setRunning] = useState(autoStart);
  const tickRef = useRef(
    typeof options.onTick === 'function' ? options.onTick : null,
  );

  useEffect(() => {
    tickRef.current =
      typeof options.onTick === 'function' ? options.onTick : null;
  }, [options.onTick]);

  const start = useCallback(() => {
    setRunning(true);
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
  }, []);

  const toggle = useCallback(() => {
    setRunning((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!running || intervalMs <= 0 || typeof tickRef.current !== 'function') {
      return undefined;
    }

    if (immediate) {
      tickRef.current();
    }

    const timer = setInterval(() => {
      if (typeof tickRef.current === 'function') {
        tickRef.current();
      }
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [running, intervalMs, immediate]);

  return {
    running,
    setRunning,
    start,
    stop,
    toggle,
  };
}

