import { useEffect, useRef } from "react";

/**
 * Calls `fn` immediately, then repeats on `intervalMs` (default 20 s).
 * Also re-calls `fn` whenever the browser tab becomes visible again.
 * Always uses the latest `fn` reference — no stale-closure issues.
 */
export function usePolling(fn: () => void, intervalMs = 20_000) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    fnRef.current();

    const id = setInterval(() => fnRef.current(), intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") fnRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
}
