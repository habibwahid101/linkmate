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
    placementRuleVersion: "v3-level-caps",
    structureSummary: "1 ID. You are the root. Level 1 holds 2 people.",
    receives: "One membership ID. Two people on Level 1 complete that level and release its commission.",
    locked: true,
  },
  turbo: {
    id: "turbo",
    name: "Turbo",
    amountBdt: 44_000,
    idCount: 4,
    placementRuleVersion: "v3-level-caps",
    structureSummary: "4 IDs — 1 root, 2 on Level 1, and the 3rd internal ID on Level 2.",
    receives: "Four IDs. Level 1 holds only 2 people. The extra ID sits on the next level.",
    locked: true,
  },
  super_turbo: {
    id: "super_turbo",
    name: "Super Turbo",
    amountBdt: 143_000,
    idCount: 13,
    placementRuleVersion: "v3-level-caps",
    structureSummary: "13 IDs. Each level holds its own people: 2, then 4, then the rest on the next level.",
    receives: "Thirteen IDs. No level holds more people than its cap. Extra IDs move to the next level.",
    locked: true,
  },
  hyper_turbo: {
    id: "hyper_turbo",
    name: "Hyper Turbo",
    amountBdt: 242_000,
    idCount: 22,
    placementRuleVersion: "v3-level-caps",
    structureSummary: "22 IDs. Filled in level order: 2, 4, 8, then the rest on the next level.",
    receives: "Twenty-two IDs. A level never holds more than its cap. The extra ID moves down.",
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
  { level: 1, generation: 1, generationLabel: "1st", requiredMembers: 2, rate: 0.09, rateLabel: "9%" },
  { level: 2, generation: 2, generationLabel: "2nd", requiredMembers: 4, rate: 0.08, rateLabel: "8%" },
  { level: 3, generation: 3, generationLabel: "3rd", requiredMembers: 8, rate: 0.07, rateLabel: "7%" },
  { level: 4, generation: 4, generationLabel: "4th", requiredMembers: 16, rate: 0.06, rateLabel: "6%" },
  { level: 5, generation: 5, generationLabel: "5th", requiredMembers: 32, rate: 0.05, rateLabel: "5%" },
  { level: 6, generation: 6, generationLabel: "6th", requiredMembers: 64, rate: 0.04, rateLabel: "4%" },
  { level: 7, generation: 7, generationLabel: "7th", requiredMembers: 128, rate: 0.03, rateLabel: "3%" },
  { level: 8, generation: 8, generationLabel: "8th", requiredMembers: 256, rate: 0.02, rateLabel: "2%" },
  { level: 9, generation: 9, generationLabel: "9th", requiredMembers: 512, rate: 0.01, rateLabel: "1%" },
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

/** Integer BDT. Level 1 is 9% × 11,000 = 990. */
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
