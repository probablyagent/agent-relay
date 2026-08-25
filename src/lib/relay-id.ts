/**
 * Relay IDs.
 *
 * A relay ID *is* a Technocore room name, so it has to satisfy the server's rule exactly:
 *
 *     ^[a-z0-9][a-z0-9_-]{0,47}$
 *
 * It also has to survive Technocore's room-class parser. A name is `<class>-…-<body>` and
 * the leading `<class>-` segments change server behaviour:
 *
 *     p-   unlisted — reachable, never enumerated or announced
 *     mb-  mailbox  — signed writes only
 *     d-   ownable
 *     e-   ephemeral — messages older than ~15 minutes are dropped on read
 *
 * Classes compose by prefix and the parser stops at the first segment that is not a class
 * marker. So a relay called "E-Commerce Launch" would naively become `e-commerce-launch-…`
 * — an *ephemeral* room whose messages silently vanish after fifteen minutes. `guardSlug`
 * below is what stops that.
 */

const CLASS_MARKERS = new Set(["p", "mb", "d", "e"]);

const NAME_MAX = 48;
const RANDOM_CHARS = 8;
/** Leaves room for `p-`, the `-`, the random suffix and a possible `r-` guard. */
const SLUG_MAX = 28;

/** Lowercase, ASCII, hyphen-separated. Anything else is dropped. */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
  return slug || "relay";
}

/**
 * Prefix a slug whose first segment would be read as a room class.
 *
 * `e-commerce` -> `r-e-commerce`. `r` is not a class marker, so Technocore's parser stops
 * there and the rest of the name is body, not behaviour.
 */
export function guardSlug(slug: string): string {
  return CLASS_MARKERS.has(slug.split("-")[0]) ? `r-${slug}` : slug;
}

/**
 * The set of room classes Technocore will read off a name — the same algorithm the server
 * uses (`store.room_classes`), reimplemented here so the tests can assert we never create
 * a room that behaves differently from the one we meant.
 */
export function roomClasses(name: string): Set<string> {
  const classes = new Set<string>();
  const segments = name.split("-").slice(0, -1);
  for (const segment of segments) {
    if (!CLASS_MARKERS.has(segment)) break;
    classes.add(segment);
  }
  return classes;
}

/** 8 hex characters from the platform CSPRNG. ~32 bits of the ID's unguessability. */
function randomSuffix(): string {
  const bytes = new Uint8Array(RANDOM_CHARS / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Build a relay ID from a human-typed name.
 *
 * `unlisted` (the default) adds Technocore's `p-` class, which keeps the room out of
 * `/rooms` and out of the `/r/events` discovery log. That is obscurity, not authentication:
 * the URL *is* the capability, and anyone who learns it can read and post. Never treat an
 * unguessable relay ID as access control.
 */
export function generateRelayId(name: string, opts: { unlisted?: boolean } = {}): string {
  const unlisted = opts.unlisted ?? true;
  const slug = guardSlug(slugify(name));
  const prefix = unlisted ? "p-" : "";
  const suffix = `-${randomSuffix()}`;

  const room = `${prefix}${slug}${suffix}`;
  if (room.length <= NAME_MAX) return room;

  const trimmed = slug.slice(0, NAME_MAX - prefix.length - suffix.length).replace(/-+$/g, "");
  return `${prefix}${guardSlug(trimmed || "relay")}${suffix}`;
}

/** Whether an ID is a well-formed Technocore room name. */
export function isValidRelayId(id: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,47}$/.test(id);
}

/** Unlisted relays carry Technocore's `p-` class. */
export function isUnlisted(id: string): boolean {
  return roomClasses(id).has("p");
}
