import { describe, expect, it } from "vitest";
import {
  generateRelayId,
  guardSlug,
  isUnlisted,
  isValidRelayId,
  roomClasses,
  slugify,
} from "@/lib/relay-id";

/** Technocore's own rule, restated here so a regression is caught against the source of truth. */
const TECHNOCORE_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Stablecoin Treasury Review")).toBe("stablecoin-treasury-review");
  });

  it("strips accents and punctuation", () => {
    expect(slugify("Café & Crème — Q3!")).toBe("cafe-creme-q3");
  });

  it("falls back when nothing usable is left", () => {
    expect(slugify("!!!")).toBe("relay");
    expect(slugify("")).toBe("relay");
  });

  it("never ends in a hyphen after truncation", () => {
    expect(slugify("a".repeat(27) + " bcd")).not.toMatch(/-$/);
  });
});

describe("roomClasses", () => {
  // Mirrors store.room_classes in technocore-chat.
  it("reads leading class markers and stops at the first non-marker", () => {
    expect([...roomClasses("p-x")]).toEqual(["p"]);
    expect([...roomClasses("mb-p-x")].sort()).toEqual(["mb", "p"]);
    expect([...roomClasses("pastel")]).toEqual([]);
    expect([...roomClasses("relay-e-thing")]).toEqual([]);
  });

  it("treats the last segment as body, never as a class", () => {
    expect([...roomClasses("p-e")]).toEqual(["p"]);
  });
});

describe("guardSlug", () => {
  it("protects a slug whose first segment is a room class", () => {
    expect(guardSlug("e-commerce")).toBe("r-e-commerce");
    expect(guardSlug("d-day-planning")).toBe("r-d-day-planning");
    expect(guardSlug("mb-strategy")).toBe("r-mb-strategy");
  });

  it("leaves an ordinary slug alone", () => {
    expect(guardSlug("stablecoin-treasury")).toBe("stablecoin-treasury");
  });
});

describe("generateRelayId", () => {
  it("produces a valid Technocore room name", () => {
    for (const name of ["Stablecoin Treasury Review", "x", "!!!", "Ω≈ç√"]) {
      const id = generateRelayId(name);
      expect(id).toMatch(TECHNOCORE_NAME_RE);
    }
  });

  it("stays within 48 characters for a very long name", () => {
    const id = generateRelayId("A".repeat(300));
    expect(id.length).toBeLessThanOrEqual(48);
    expect(id).toMatch(TECHNOCORE_NAME_RE);
  });

  it("includes a random component", () => {
    const a = generateRelayId("Stablecoin Treasury Review");
    const b = generateRelayId("Stablecoin Treasury Review");
    expect(a).not.toBe(b);
    expect(a).toMatch(/-[0-9a-f]{8}$/);
  });

  it("marks unlisted relays with the p- class by default", () => {
    const id = generateRelayId("Stablecoin Treasury Review");
    expect(id.startsWith("p-")).toBe(true);
    expect(isUnlisted(id)).toBe(true);
  });

  it("can create a listed relay", () => {
    const id = generateRelayId("Stablecoin Treasury Review", { unlisted: false });
    expect(isUnlisted(id)).toBe(false);
    expect(roomClasses(id).size).toBe(0);
  });

  it("never accidentally creates an ephemeral or mailbox room", () => {
    // The trap: "E-Commerce Launch" would naively slugify to e-commerce-launch-<hex>,
    // which Technocore reads as an EPHEMERAL room whose messages vanish after 15 minutes.
    for (const name of ["E-Commerce Launch", "D Day Planning", "MB Strategy", "P Hacking Review"]) {
      for (const unlisted of [true, false]) {
        const classes = roomClasses(generateRelayId(name, { unlisted }));
        expect([...classes].sort()).toEqual(unlisted ? ["p"] : []);
      }
    }
  });

  it("round-trips through the ID validator", () => {
    expect(isValidRelayId(generateRelayId("Anything at all"))).toBe(true);
    expect(isValidRelayId("Stablecoin-Treasury")).toBe(false); // uppercase
    expect(isValidRelayId("-leading-hyphen")).toBe(false);
    expect(isValidRelayId("a".repeat(49))).toBe(false);
    expect(isValidRelayId("")).toBe(false);
  });
});
