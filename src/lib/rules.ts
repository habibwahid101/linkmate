/**
 * Centralized Link Mate business rules.
 * Locked values — do not duplicate these numbers in UI components.
 */

export const STANDARD_ID_VALUE_BDT = 11_000;
export const RULE_VERSION = 1;
export const ID_PREFIX = "LM-";
export const ID_SEQ_START = 100_001;

export const PACKAGE_IDS = ["builder", "turbo", "super_turbo", "hyper_turbo"] as const;
export type PackageId = (typeof PACKAGE_IDS)[number];

export type PackageRule = {
  id: PackageId;
  name: string;
  amountBdt: number;
  idCount: number;
  placementRuleVersion: string;
  structureSummary: string;
  receives: string;
  locked: boolean;
};

export const PACKAGES: Record<PackageId, PackageRule> = {
  builder: {
    id: "builder",
    name: "Builder",
    amountBdt: 11_000,
    idCount: 1,
    placementRuleVersion: "v1",
    structureSummary: "1 ID. You are the root. Level 1 requires 3 personal sponsors.",
    receives: "One membership ID. Invite 3 direct members to complete Level 1.",
    locked: true,
  },
  turbo: {
    id: "turbo",
    name: "Turbo",
    amountBdt: 44_000,
    idCount: 4,
    placementRuleVersion: "v1",
    structureSummary: "4 IDs — 1 root ID + 3 internal Level-1 IDs.",
    receives:
      "Four IDs. Your first ID internally sponsors the other three, which can complete its Level 1.",
    locked: true,
  },
  super_turbo: {
    id: "super_turbo",
    name: "Super Turbo",
    amountBdt: 143_000,
    idCount: 13,
    placementRuleVersion: "v1",
    structureSummary: "13 IDs — 1 root + 3 first generation + 9 second generation.",
    receives:
      "Thirteen IDs placed as 1 root, 3 under the root, and 9 under those positions.",
    locked: true,
  },
  hyper_turbo: {
    id: "hyper_turbo",
    name: "Hyper Turbo",
    amountBdt: 242_000,
    idCount: 22,
    placementRuleVersion: "v2-middle-sponsors-final-9",
    structureSummary:
      "22 IDs — 1 root + 3 + 9, then the middle ID of each gen-2 group sponsors 3 of the final 9.",
    receives:
      "Twenty-two IDs. All are placed: 1 root, 3 under the root, 9 under those, and 9 under the middle ID of each trio.",
    locked: true,
  },
};

export const PACKAGE_LIST: PackageRule[] = PACKAGE_IDS.map((id) => PACKAGES[id]);

export type LevelRule = {
  level: number;
  generation: number;
  generationLabel: string;
  requiredMembers: number;
  rate: number;
  rateLabel: string;
};

export const LEVELS: readonly LevelRule[] = [
  { level: 1, generation: 1, generationLabel: "1st", requiredMembers: 3, rate: 0.08, rateLabel: "8%" },
  { level: 2, generation: 2, generationLabel: "2nd", requiredMembers: 9, rate: 0.06, rateLabel: "6%" },
  { level: 3, generation: 3, generationLabel: "3rd", requiredMembers: 27, rate: 0.03, rateLabel: "3%" },
  { level: 4, generation: 4, generationLabel: "4th", requiredMembers: 54, rate: 0.02, rateLabel: "2%" },
  { level: 5, generation: 5, generationLabel: "5th", requiredMembers: 108, rate: 0.012, rateLabel: "1.2%" },
  { level: 6, generation: 6, generationLabel: "6th", requiredMembers: 162, rate: 0.01, rateLabel: "1%" },
  { level: 7, generation: 7, generationLabel: "7th", requiredMembers: 216, rate: 0.01, rateLabel: "1%" },
  { level: 8, generation: 8, generationLabel: "8th", requiredMembers: 270, rate: 0.01, rateLabel: "1%" },
  { level: 9, generation: 9, generationLabel: "9th", requiredMembers: 324, rate: 0.01, rateLabel: "1%" },
] as const;

export const MAX_GENERATION = 9;

export function getLevel(level: number): LevelRule {
  const rule = LEVELS.find((l) => l.level === level);
  if (!rule) throw new Error(`Unknown level ${level}`);
  return rule;
}

export function getLevelByGeneration(generation: number): LevelRule {
  const rule = LEVELS.find((l) => l.generation === generation);
  if (!rule) throw new Error(`Unknown generation ${generation}`);
  return rule;
}

/** Integer BDT. Locked examples: 8% × 11,000 = 880. */
export function commissionPerMember(
  joiningAmountBdt: number = STANDARD_ID_VALUE_BDT,
  rate: number,
): number {
  return Math.round(joiningAmountBdt * rate);
}

export function fullLevelCommission(
  level: number,
  joiningAmountBdt: number = STANDARD_ID_VALUE_BDT,
): number {
  const rule = getLevel(level);
  return commissionPerMember(joiningAmountBdt, rule.rate) * rule.requiredMembers;
}

export function ordinalGeneration(n: number): string {
  const labels = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
  return labels[n] ?? `${n}th`;
}

export type LevelStatus = "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "RELEASED" | "ELIGIBLE";

export const LEVEL_STATUS_LABEL: Record<LevelStatus, string> = {
  LOCKED: "Locked",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  RELEASED: "Released",
  ELIGIBLE: "Eligible",
};
