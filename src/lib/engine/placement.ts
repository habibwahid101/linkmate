import { LEVELS, PACKAGES, type PackageId } from "../rules.ts";

export type PlannedId = {
  index: number;
  isRoot: boolean;
  parentIndex: number | null;
  sponsorIndex: number | null;
  position: number | null;
  placementStatus: "placed" | "pending_config";
};

/** Each BIN holds at most this many people on its own Level 1. */
export const DIRECT_PLACEMENT_CAP = LEVELS[0]!.requiredMembers;

/**
 * Package IDs fill level by level. Level 1 holds 2 people under the root.
 * The next ID sits on Level 2, under one of those two. No level is overfilled.
 */
export function planPackagePlacement(
  packageId: PackageId,
  idCount = PACKAGES[packageId].idCount,
): PlannedId[] {
  const ids: PlannedId[] = Array.from({ length: idCount }, (_, i) => ({
    index: i,
    isRoot: i === 0,
    parentIndex: null,
    sponsorIndex: null,
    position: null,
    placementStatus: "placed" as const,
  }));

  const children = new Map<number, number>();
  const birth: number[] = [0];
  let cursor = 0;
  for (let child = 1; child < idCount; child++) {
    while (cursor < birth.length && (children.get(birth[cursor]!) ?? 0) >= DIRECT_PLACEMENT_CAP) cursor += 1;
    if (cursor >= birth.length) {
      ids[child]!.placementStatus = "pending_config";
      continue;
    }
    const parent = birth[cursor]!;
    const taken = (children.get(parent) ?? 0) + 1;
    children.set(parent, taken);
    ids[child]!.parentIndex = parent;
    ids[child]!.sponsorIndex = parent;
    ids[child]!.position = taken;
    ids[child]!.placementStatus = "placed";
    birth.push(child);
  }
  return ids;
}
