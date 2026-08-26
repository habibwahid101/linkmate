import { ID_PREFIX } from "../rules.ts";

export function formatMemberId(seq: number): string {
  return `${ID_PREFIX}${String(seq)}`;
}

export function makeReferralCode(seed: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  let n = h >>> 0;
  for (let i = 0; i < 6; i++) {
    out += alphabet[n % alphabet.length];
    n = Math.imul(n, 1664525) + 1013904223;
    n >>>= 0;
  }
  return out;
}

export function uid(): string {
  return crypto.randomUUID();
}
