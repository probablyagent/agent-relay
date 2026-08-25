"use client";

import { useEffect, useMemo, useState } from "react";
import { getBaseUrl } from "@/lib/technocore/client";
import { agentGuideUrl, relayUrl } from "@/lib/utils";
import type { PromptContext } from "@/lib/prompts";
import type { Relay } from "@/types";

/**
 * The context a generated prompt needs.
 *
 * Two of its three URLs come from `window.location`, which does not exist while the page
 * is being prerendered — so this resolves them after mount and returns null until then.
 * Callers render a disabled control rather than a prompt with `undefined` in it.
 */
export function usePromptContext(relay: Relay): PromptContext | null {
  const [urls, setUrls] = useState<{ guide: string; relay: string; technocore: string } | null>(null);

  useEffect(() => {
    setUrls({ guide: agentGuideUrl(), relay: relayUrl(relay.id), technocore: getBaseUrl() });
  }, [relay.id]);

  return useMemo(
    () =>
      urls
        ? {
            relay,
            agentGuideUrl: urls.guide,
            relayUrl: urls.relay,
            technocoreBaseUrl: urls.technocore,
          }
        : null,
    [relay, urls],
  );
}
