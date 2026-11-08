import { useCallback, useEffect, useState, type SetStateAction } from "react";

// Storage is optional: private browsing and disabled storage retain a usable HUD.
export function useBrowserState<T>(key: string, initial: T, parse: (value: unknown) => T) {
  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? parse(JSON.parse(saved)) : initial;
    } catch { return initial; }
  });
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
      setSaved(true);
    } catch { setSaved(false); }
  }, [key, state]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== key && event.key !== null) return;
      try { setState(event.newValue ? parse(JSON.parse(event.newValue)) : initial); }
      catch { /* Ignore corrupt writes from another tab. */ }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key, initial, parse]);
  const update = useCallback((next: SetStateAction<T>) => setState(next), []);
  return [state, update, saved] as const;
}
