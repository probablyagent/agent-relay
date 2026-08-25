"use client";

import { useEffect, useState } from "react";

/**
 * A clock that ticks, for "recently active" style rendering.
 *
 * Reading `Date.now()` during render would make the render impure — and in a static export
 * it would also differ between the prerendered HTML and the first client render. This
 * starts at 0 (nothing is "recent" yet), then updates on an interval once mounted.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
