import { PACKAGES, type PackageId } from "../rules.ts";

export type PlannedId = {
  index: number;
  isRoot: boolean;
  parentIndex: number | null;
  sponsorIndex: number | null;
  position: number | null;
  placementStatus: "placed" | "pending_config";
};

/**
 * Internal package placement.
 * Turbo: root + 3 children (completes Level 1 of the root).
 * Super Turbo: 1 + 3 + 9.
 * Hyper Turbo: first 13 as Super Turbo; remaining 9 stay unplaced
 * until an approved placement version is configured.
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

  const placeUnder = (parent: number, children: number[]) => {
    children.forEach((c, i) => {
      if (!ids[c]) return;
      ids[c].parentIndex = parent;
      ids[c].sponsorIndex = parent;
      ids[c].position = i + 1;
      ids[c].placementStatus = "placed";
    });
  };

  if (idCount >= 4) {
    placeUnder(0, [1, 2, 3]);
  }
  if (idCount >= 13) {
    placeUnder(1, [4, 5, 6]);
    placeUnder(2, [7, 8, 9]);
    placeUnder(3, [10, 11, 12]);
  }
  if (idCount > 13) {
    for (let i = 13; i < idCount; i++) {
      ids[i].placementStatus = "pending_config";
      ids[i].parentIndex = null;
      ids[i].sponsorIndex = null;
      ids[i].position = null;
    }
  }
  return ids;
}
