import { LEVELS, getLevel } from "./rules.ts";

export const MEMBERSHIP_ID_NOT_FOUND = "Membership ID not found";
export const COMPACT_LIST_THRESHOLD = 5;
export const DASHBOARD_ID_PREVIEW = 8;
export const NETWORK_MEMBER_CAP = 400;
export const ID_DETAIL_DIRECT_CAP = 50;
export const ID_DETAIL_TX_CAP = 20;

export type CurrentProgress = {
  level: number;
  completed: number;
  required: number;
  remaining: number;
  status: string;
};

export type CompactMembershipId = {
  id: string;
  package_id: string;
  sponsor_id: string | null;
  parent_id: string | null;
  placement_status: string;
  status: string;
  is_root: boolean;
  origin_kind: string;
  created_at: string;
  referral_code: string | null;
  current_level: number;
  progression_status: string;
  held: number;
  available: number;
  released: number;
  directSponsors: number;
  completedLevels: number;
  level9Released: boolean;
  currentProgress: CurrentProgress;
};

export type IdFilter = "all" | "active" | "level1" | "level2plus" | "held" | "graduated";
export type IdSort = "id" | "level" | "progress" | "held" | "released" | "newest";

export type MemberIdSearch = { id?: string };

export const ID_FILTERS: { id: IdFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "level1", label: "Level 1" },
  { id: "level2plus", label: "Level 2+" },
  { id: "held", label: "Held earnings" },
  { id: "graduated", label: "Graduated" },
];

export const ID_SORTS: { id: IdSort; label: string }[] = [
  { id: "id", label: "Membership ID" },
  { id: "level", label: "Highest level" },
  { id: "progress", label: "Progress" },
  { id: "held", label: "Held earnings" },
  { id: "released", label: "Released earnings" },
  { id: "newest", label: "Newest" },
];

export function isGraduated(row: { progression_status: string; level9Released?: boolean }): boolean {
  return row.progression_status === "GRADUATED" || Boolean(row.level9Released);
}

export function usesCompactList(count: number): boolean {
  return count >= COMPACT_LIST_THRESHOLD;
}

export function originLabel(row: { is_root: boolean; origin_kind?: string | null }): string {
  if (row.is_root) return "Root";
  const kind = row.origin_kind ?? "";
  if (kind.includes("internal") || kind.includes("package")) return "Internal";
  return "Internal";
}

export function idStatusLabel(row: { progression_status: string; placement_status: string }): string {
  if (row.placement_status === "pending_config") return "Unplaced";
  if (row.progression_status === "GRADUATED") return "Graduated";
  return "Active";
}

export function progressNoun(level: number): string {
  return level <= 1 ? "Direct Sponsored IDs" : "Eligible Downline IDs";
}

export function progressNounShort(level: number): string {
  return level <= 1 ? "Direct IDs" : "Eligible Downline IDs";
}

export function levelRequirementCopy(level: number): string {
  const rule = getLevel(level);
  if (level === 1) return `${rule.requiredMembers} Direct Sponsored IDs`;
  return `${rule.requiredMembers} Eligible Downline IDs`;
}

export function progressFraction(p: CurrentProgress): string {
  return `${p.completed} / ${p.required}`;
}

export function remainingCopy(p: CurrentProgress): string {
  if (p.status === "RELEASED" || p.remaining <= 0) return "Complete";
  const noun = p.level <= 1 ? (p.remaining === 1 ? "ID" : "IDs") : (p.remaining === 1 ? "ID" : "IDs");
  return `${p.remaining} ${noun} remaining`;
}

export function journeyState(
  row: { level: number; status: string },
  graduated: boolean,
): "completed" | "current" | "locked" | "graduated" {
  if (graduated && row.level === 9 && (row.status === "RELEASED" || row.status === "COMPLETED")) {
    return "graduated";
  }
  if (row.status === "RELEASED" || row.status === "COMPLETED") return "completed";
  if (row.status === "IN_PROGRESS" || row.status === "ELIGIBLE") return "current";
  return "locked";
}

export function parseMemberIdSearch(search: Record<string, unknown>): MemberIdSearch {
  const raw = search.id;
  if (typeof raw !== "string") return {};
  const id = raw.trim();
  return id ? { id } : {};
}

export function matchesIdQuery(row: CompactMembershipId, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    row.id.toLowerCase().includes(q) ||
    (row.referral_code ?? "").toLowerCase().includes(q) ||
    row.package_id.toLowerCase().includes(q) ||
    originLabel(row).toLowerCase().includes(q)
  );
}

export function matchesIdFilter(row: CompactMembershipId, filter: IdFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "active":
      return !isGraduated(row) && row.placement_status !== "pending_config";
    case "level1":
      return !isGraduated(row) && row.current_level === 1;
    case "level2plus":
      return !isGraduated(row) && row.current_level >= 2;
    case "held":
      return row.held > 0;
    case "graduated":
      return isGraduated(row);
    default:
      return true;
  }
}

export function progressRatio(row: CompactMembershipId): number {
  const req = row.currentProgress.required || 1;
  const base = (row.completedLevels + row.currentProgress.completed / req) / 9;
  return isGraduated(row) ? 1 : Math.min(1, base);
}

export function sortMembershipIds(rows: CompactMembershipId[], sort: IdSort): CompactMembershipId[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (sort) {
      case "level":
        return b.current_level - a.current_level || a.id.localeCompare(b.id);
      case "progress":
        return progressRatio(b) - progressRatio(a) || a.id.localeCompare(b.id);
      case "held":
        return b.held - a.held || a.id.localeCompare(b.id);
      case "released":
        return b.released - a.released || a.id.localeCompare(b.id);
      case "newest":
        return (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0) || a.id.localeCompare(b.id);
      case "id":
      default:
        return a.id.localeCompare(b.id);
    }
  });
  return copy;
}

export function filterAndSortIds(
  rows: CompactMembershipId[],
  opts: { query?: string; filter?: IdFilter; sort?: IdSort },
): CompactMembershipId[] {
  const filtered = rows.filter(
    (row) => matchesIdQuery(row, opts.query ?? "") && matchesIdFilter(row, opts.filter ?? "all"),
  );
  return sortMembershipIds(filtered, opts.sort ?? "id");
}

export type AccountIdSummary = {
  idCount: number;
  available: number;
  held: number;
  released: number;
  highestActiveLevel: number;
  idsInProgress: number;
  graduatedCount: number;
};

export function summarizeAccount(ids: CompactMembershipId[]): AccountIdSummary {
  let available = 0;
  let held = 0;
  let released = 0;
  let highestActiveLevel = 0;
  let idsInProgress = 0;
  let graduatedCount = 0;
  for (const id of ids) {
    available += id.available;
    held += id.held;
    released += id.released;
    if (isGraduated(id)) {
      graduatedCount += 1;
      highestActiveLevel = Math.max(highestActiveLevel, 9);
    } else {
      highestActiveLevel = Math.max(highestActiveLevel, id.current_level);
      idsInProgress += 1;
    }
  }
  return {
    idCount: ids.length,
    available,
    held,
    released,
    highestActiveLevel,
    idsInProgress,
    graduatedCount,
  };
}

export function earningsById(ids: CompactMembershipId[]): {
  memberId: string;
  packageId: string;
  held: number;
  released: number;
  available: number;
  currentLevel: number;
  progressionStatus: string;
}[] {
  return ids.map((id) => ({
    memberId: id.id,
    packageId: id.package_id,
    held: id.held,
    released: id.released,
    available: id.available,
    currentLevel: id.current_level,
    progressionStatus: id.progression_status,
  }));
}

export function buildCurrentProgress(input: {
  currentLevel: number;
  progressionStatus: string;
  progressRows: { level: number; status: string; completed: number; required: number; remaining: number }[];
}): CurrentProgress {
  const graduated = input.progressionStatus === "GRADUATED";
  const level = graduated ? 9 : Math.min(9, Math.max(1, input.currentLevel || 1));
  const row = input.progressRows.find((p) => p.level === level);
  const rule = LEVELS.find((l) => l.level === level) ?? LEVELS[0]!;
  if (row) {
    return {
      level: row.level,
      completed: row.completed,
      required: row.required,
      remaining: row.remaining,
      status: row.status,
    };
  }
  return {
    level,
    completed: graduated ? rule.requiredMembers : 0,
    required: rule.requiredMembers,
    remaining: graduated ? 0 : rule.requiredMembers,
    status: graduated ? "RELEASED" : "IN_PROGRESS",
  };
}

/** Copy for member dashboard — never "Nth generation required". */
export function memberFacingGenerationCopyForbidden(): readonly string[] {
  return [
    "generation required",
    "nth generation",
    "2nd generation to complete level 2",
    "generation 2 -> level 2",
  ];
}

export function fixtureId(overrides: Partial<CompactMembershipId> & { id: string }): CompactMembershipId {
  const currentLevel = overrides.current_level ?? 1;
  const rule = getLevel(Math.min(9, Math.max(1, currentLevel)));
  const graduated = overrides.progression_status === "GRADUATED" || Boolean(overrides.level9Released);
  const completed = overrides.currentProgress?.completed ?? (graduated ? rule.requiredMembers : 0);
  const required = overrides.currentProgress?.required ?? rule.requiredMembers;
  return {
    package_id: "builder",
    sponsor_id: null,
    parent_id: null,
    placement_status: "placed",
    status: "active",
    is_root: true,
    origin_kind: "purchase_root",
    created_at: "2026-01-01T00:00:00.000Z",
    referral_code: overrides.id.replace("LM-", "R"),
    current_level: currentLevel,
    progression_status: graduated ? "GRADUATED" : "ACTIVE",
    held: 0,
    available: 0,
    released: 0,
    directSponsors: 0,
    completedLevels: graduated ? 9 : Math.max(0, currentLevel - 1),
    level9Released: graduated,
    currentProgress: {
      level: graduated ? 9 : currentLevel,
      completed,
      required,
      remaining: Math.max(0, required - completed),
      status: graduated ? "RELEASED" : "IN_PROGRESS",
    },
    ...overrides,
  };
}
