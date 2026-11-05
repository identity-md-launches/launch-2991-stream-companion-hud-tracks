import { useCallback, useEffect, useRef, useState } from "react";
import { DataError, errorMessage } from "./data";

export type Resource<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  updatedAt: number | null;
};

// Serial polling, abort on configuration change/unmount, with bounded error backoff.
// Data survives a transient failure and is always marked as the last successful read.
export function usePolling<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  interval: number,
  paused: boolean,
) {
  const [resource, setResource] = useState<Resource<T>>({
    data: null,
    error: null,
    loading: true,
    updatedAt: null,
  });
  const refreshRef = useRef<() => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);
  useEffect(() => {
    setResource({ data: null, error: null, loading: true, updatedAt: null });
  }, [loader]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let busy = false;
    let failures = 0;
    let retryAfter = 0;
    if (paused) setResource((r) => ({ ...r, loading: false }));
    const run = async () => {
      if (busy || !active) return;
      clearTimeout(timer);
      busy = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 18_000);
      setResource((r) => ({ ...r, loading: true }));
      try {
        const data = await loader(controller.signal);
        if (active)
          setResource({
            data,
            error: null,
            loading: false,
            updatedAt: Date.now(),
          });
        failures = 0;
        retryAfter = 0;
      } catch (error) {
        failures++;
        retryAfter = error instanceof DataError ? error.retryAfterSeconds : 0;
        if (active)
          setResource((r) => ({
            ...r,
            loading: false,
            error: controller?.signal.aborted
              ? "The source timed out. Try again or choose another source in Settings."
              : errorMessage(error),
          }));
      } finally {
        clearTimeout(timeout);
        controller?.abort();
        busy = false;
        if (active && !paused)
          timer = setTimeout(
            run,
            Math.max(interval * Math.min(5, 2 ** failures), retryAfter) * 1000,
          );
      }
    };
    refreshRef.current = () => {
      void run();
    };
    if (!paused) void run();
    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [loader, interval, paused]);
  return { ...resource, refresh };
}

export function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
