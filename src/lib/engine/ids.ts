import { ID_PREFIX } from "../rules.ts";

export function formatMemberId(seq: number): string {
  return `${ID_PREFIX}${String(seq)}`;
}

const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Deterministic 6-character referral code from a seed.
 * Must not collapse sequential Membership IDs onto a tiny code set:
 * a 32-bit LCG's low bits have period 32, which previously yielded only
 * 32 distinct codes and broke uniqueness after ~32 IDs.
 */
export function makeReferralCode(seed: string): string {
  let h1 = 2166136261;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 16777619);
    h2 ^= c + i * 131;
    h2 = Math.imul(h2, 2246822519);
  }
  let out = "";
  for (let i = 0; i < 6; i++) {
    const mixed = (h1 >>> ((i * 5) % 23)) ^ Math.imul(h2, i + 3) ^ (h1 + Math.imul(i + 1, 2654435761));
    out += REFERRAL_ALPHABET[(mixed >>> 0) % REFERRAL_ALPHABET.length]!;
    h1 = Math.imul(h1 ^ h2, 1664525) + (1013904223 ^ i);
    h2 = Math.imul(h2 ^ (h1 >>> 11), 22695477) + i + 1;
    h1 >>>= 0;
    h2 >>>= 0;
  }
  return out;
}

export function uid(): string {
  return crypto.randomUUID();
}
