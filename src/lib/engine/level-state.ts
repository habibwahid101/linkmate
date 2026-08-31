import type { LevelStatus } from "../rules.ts";

export function resolveLevelStatus(opts: {
  level: number;
  qualifying: number;
  required: number;
  previousReleased: boolean;
  alreadyReleased: boolean;
}): LevelStatus {
  const { level, qualifying, required, previousReleased, alreadyReleased } = opts;
  const met = qualifying >= required;
  if (alreadyReleased) return "RELEASED";
  if (!previousReleased && level > 1) {
    return met ? "COMPLETED" : qualifying > 0 ? "IN_PROGRESS" : "LOCKED";
  }
  if (met) return "COMPLETED";
  if (qualifying > 0) return "IN_PROGRESS";
  if (previousReleased && level > 1) return "ELIGIBLE";
  if (level === 1) return "IN_PROGRESS";
  return "LOCKED";
}

export function canReleaseLevel(opts: {
  level: number;
  qualifying: number;
  required: number;
  previousReleased: boolean;
  alreadyReleased: boolean;
  directCount: number;
}): boolean {
  if (opts.alreadyReleased) return false;
  if (!opts.previousReleased) return false;
  if (opts.qualifying < opts.required) return false;
  if (opts.level === 1 && opts.directCount < 3) return false;
  return true;
}

export function heldForCount(perMember: number, completed: number): number {
  return perMember * Math.max(0, completed);
}

export function releaseTxId(memberId: string, level: number, batch = 0): string {
  return `release:${memberId}:${level}:${batch}`;
}

export function joinEventId(sourceId: string, beneficiaryId: string, level: number): string {
  return `join:${sourceId}:${beneficiaryId}:${level}`;
}

export function reversalTxId(entryId: string): string {
  return `reversal:${entryId}`;
}
