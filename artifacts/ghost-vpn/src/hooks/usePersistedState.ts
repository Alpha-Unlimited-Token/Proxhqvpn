// Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC — legal@alphauntechnologies.com
// Multitasking persistence: sessionStorage-backed useState replacement.
// State survives navigation (component unmount/remount) for the lifetime of the browser tab.
import { useState, useEffect, useCallback } from "react";

export function usePersistedState<T>(key: string, defaultValue: T): [T, (val: T | ((prev: T) => T)) => void, () => void] {
  const storageKey = `proxhq_persist_${key}`;

  const read = (): T => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw === null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  };

  const [state, setStateRaw] = useState<T>(read);

  const setState = useCallback((val: T | ((prev: T) => T)) => {
    setStateRaw(prev => {
      const next = typeof val === "function" ? (val as (p: T) => T)(prev) : val;
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* quota exceeded — continue without persisting */
      }
      return next;
    });
  }, [storageKey]);

  const clearState = useCallback(() => {
    sessionStorage.removeItem(storageKey);
    setStateRaw(defaultValue);
  }, [storageKey]);

  // Sync from storage on focus (if another tab updated it)
  useEffect(() => {
    const onFocus = () => setStateRaw(read());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [storageKey]);

  return [state, setState, clearState];
}
