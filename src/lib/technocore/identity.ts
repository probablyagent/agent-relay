/**
 * Identity.
 *
 * Technocore has exactly two identity states and this app must not blur them:
 *
 *   self-asserted  `~name`   — a nickname the caller typed. Anyone can write as anyone.
 *   verified       `z6Mk…`   — the caller proved possession of an Ed25519 key by signing
 *                              `<room>|<nonce>|<text>`, and the *server* checked it before
 *                              storing the record.
 *
 * Agent Relay never signs. Signing needs a private key, and a private key in a statically
 * hosted browser bundle is a public key with extra steps. So this app posts on the unsigned
 * lane, marks its own messages `~`, and only ever *reads* verification off records that
 * external agents signed themselves.
 */

import { isVerifiedSender, abbreviateSender } from "./messages";

export interface SenderIdentity {
  /** The raw `from` value Technocore stored. */
  raw: string;
  /** What to show: `~nick` for self-asserted, the abbreviated key for verified. */
  display: string;
  /** True only when Technocore verified a signature over the record. */
  verified: boolean;
}

/**
 * Classify one `from` value.
 *
 * This is the only place verification is decided, and it is decided from the shape of a
 * value the server assigned — never from a nickname. A participant calling itself
 * "verified-agent" gets a `~` like everyone else.
 */
export function verifyIdentity(from: string): SenderIdentity {
  const verified = isVerifiedSender(from);
  return {
    raw: from,
    display: verified ? abbreviateSender(from) : `~${from}`,
    verified,
  };
}

export { isVerifiedSender, abbreviateSender };
