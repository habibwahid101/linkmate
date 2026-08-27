import { LEVELS } from "./rules.ts";

/** Presentation copy for the land benefit — not a commission-engine value. */
export const LAND_BENEFIT_KATHA = 1;
export const LAND_OPERATIONAL_STATUS =
  "Qualification Track Active — Transfer subject to final documentation/allocation terms.";

/** Level 1 required members (locked table). */
export const REQUIRED_DIRECT_SPONSORS = LEVELS[0]!.requiredMembers;

/** Final qualification level (locked table). */
export const REQUIRED_LEVEL = LEVELS[LEVELS.length - 1]!.level;

export type LandQualification = {
  hasMembership: boolean;
  sponsorProgress: number;
  sponsorRequired: number;
  sponsorMet: boolean;
  completedLevels: number;
  levelsRequired: number;
  level9Released: boolean;
  qualified: boolean;
  status: "Qualified" | "Not Yet Qualified";
};

export function evaluateLandQualification(input: {
  hasMembership: boolean;
  directSponsors: number;
  completedLevels: number;
  level9Released: boolean;
}): LandQualification {
  const sponsorProgress = Math.min(Math.max(0, input.directSponsors), REQUIRED_DIRECT_SPONSORS);
  const sponsorMet = input.directSponsors >= REQUIRED_DIRECT_SPONSORS;
  const qualified = Boolean(input.hasMembership && sponsorMet && input.level9Released);
  return {
    hasMembership: input.hasMembership,
    sponsorProgress,
    sponsorRequired: REQUIRED_DIRECT_SPONSORS,
    sponsorMet,
    completedLevels: input.completedLevels,
    levelsRequired: REQUIRED_LEVEL,
    level9Released: input.level9Released,
    qualified,
    status: qualified ? "Qualified" : "Not Yet Qualified",
  };
}

export function nextActionCopy(next: { level: number; remaining: number } | null): string {
  if (!next) return "No further member milestone on this ID.";
  if (next.level === 1) {
    return next.remaining === 1
      ? "1 more direct sponsor needed"
      : `${next.remaining} more direct sponsors needed`;
  }
  return next.remaining === 1
    ? `1 more Level-${next.level} member needed`
    : `${next.remaining} more Level-${next.level} members needed`;
}
