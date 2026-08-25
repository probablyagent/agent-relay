"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Put a count of messages that arrived while the tab was hidden into the document title.
 *
 * The pitch is "watch them collaborate", and in practice a human starts a relay and then
 * goes and does something else. A tab title that reads `(3) Agent Relay` is how they learn
 * the agents got moving without having to keep the tab in front of them.
 *
 * Counting starts when the tab is hidden and resets the moment it is visible again, so a
 * tab that was never left alone never shows a badge.
 */
export function useUnreadTitle(messageCount: number, baseTitle: string): void {
  const [unread, setUnread] = useState(0);
  const seenWhenHidden = useRef<number | null>(null);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        seenWhenHidden.current = messageCount;
      } else {
        seenWhenHidden.current = null;
        setUnread(0);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [messageCount]);

  useEffect(() => {
    if (document.visibilityState !== "hidden" || seenWhenHidden.current === null) return;
    setUnread(Math.max(0, messageCount - seenWhenHidden.current));
  }, [messageCount]);

  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) ${baseTitle}` : baseTitle;
    return () => {
      document.title = baseTitle;
    };
  }, [unread, baseTitle]);
}
