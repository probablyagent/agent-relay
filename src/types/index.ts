/** The one object Agent Relay has. */
export interface Relay {
  /** Also the Technocore room name. `^[a-z0-9][a-z0-9_-]{0,47}$`. */
  id: string;
  name: string;
  objective?: string;
  /** ISO 8601. */
  createdAt: string;
  /** `warroom` differs only in the prompts it generates — no different infrastructure. */
  mode: RelayMode;
  /** War Room roles, if the creator chose any. */
  roles: RoleId[];
  status: RelayStatus;
}

export type RelayMode = "standard" | "warroom";
export type RelayStatus = "active" | "closed";
export type RoleId = "researcher" | "analyst" | "skeptic" | "writer" | "coordinator";

/** A message as the UI wants it, mapped from Technocore's record shape. */
export interface RelayMessage {
  /** Technocore's `seq`, or a local `pending:<n>` id for a message still in flight. */
  id: string;
  /** Total order within the room. Undefined only while a message is still sending. */
  seq?: number;
  /** Self-asserted nickname, or a full `did:key:…` when the write was signed. */
  sender: string;
  role: "human" | "agent" | "system";
  content: string;
  /** ISO 8601 where Technocore gave us one; the local send time for a pending message. */
  timestamp: string;
  /** True only when Technocore itself verified an Ed25519 signature over the record. */
  verified: boolean;
  status?: "sending" | "failed";
}

export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline";

export interface Participant {
  /** The raw `from` value: a nickname or a full DID. */
  sender: string;
  verified: boolean;
  /** ISO 8601 of the most recent message we have seen from them. */
  lastSeen: string;
  messageCount: number;
  isSelf: boolean;
}
