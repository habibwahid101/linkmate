import assert from "node:assert/strict";
import test from "node:test";
import {
  crossesPackageBoundary,
  resolveLevelStatus,
  canReleaseLevel,
  heldForCount,
} from "./level-state.ts";
import { commissionPerMember, fullLevelCommission } from "../rules.ts";

test("package-internal IDs do not walk into the external sponsor", () => {
  const internal = { purchase_id: "p-turbo", is_root: false };
  const root = { purchase_id: "p-turbo" };
  const external = { purchase_id: "p-other" };
  const externalNoPurchase = { purchase_id: null };
  assert.equal(crossesPackageBoundary(internal, root), false);
  assert.equal(crossesPackageBoundary(internal, external), true);
  assert.equal(crossesPackageBoundary(internal, externalNoPurchase), true);
  const rootId = { purchase_id: "p-turbo", is_root: true };
  assert.equal(crossesPackageBoundary(rootId, external), false);
});

test("an external join (no purchase) walks the full upline", () => {
  const join = { purchase_id: null, is_root: true };
  assert.equal(crossesPackageBoundary(join, { purchase_id: "p-x" }), false);
});

test("Level 1 stays in progress until 3 directs, then can release", () => {
  for (const n of [0, 1, 2]) {
    const status = resolveLevelStatus({
      level: 1,
      qualifying: n,
      required: 3,
      previousReleased: true,
      alreadyReleased: false,
    });
    assert.equal(status, "IN_PROGRESS");
    assert.equal(
      canReleaseLevel({
        level: 1,
        qualifying: n,
        required: 3,
        previousReleased: true,
        alreadyReleased: false,
        directCount: n,
      }),
      false,
    );
  }
  assert.equal(
    canReleaseLevel({
      level: 1,
      qualifying: 3,
      required: 3,
      previousReleased: true,
      alreadyReleased: false,
      directCount: 3,
    }),
    true,
  );
});

test("Level 1 held amounts 0/1/2/3", () => {
  const per = commissionPerMember(11000, 0.08);
  assert.equal(per, 880);
  assert.equal(heldForCount(per, 1), 880);
  assert.equal(heldForCount(per, 2), 1760);
  assert.equal(heldForCount(per, 3), 2640);
  assert.equal(fullLevelCommission(1), 2640);
});

test("Level 2 does not release at 6/9", () => {
  const per = commissionPerMember(11000, 0.06);
  assert.equal(per, 660);
  assert.equal(heldForCount(per, 6), 3960);
  assert.equal(fullLevelCommission(2), 5940);
  assert.equal(
    canReleaseLevel({
      level: 2,
      qualifying: 6,
      required: 9,
      previousReleased: true,
      alreadyReleased: false,
      directCount: 3,
    }),
    false,
  );
  assert.equal(
    resolveLevelStatus({
      level: 2,
      qualifying: 6,
      required: 9,
      previousReleased: true,
      alreadyReleased: false,
    }),
    "IN_PROGRESS",
  );
});

test("Level 2 releases once at 9/9 after Level 1 released", () => {
  assert.equal(
    canReleaseLevel({
      level: 2,
      qualifying: 9,
      required: 9,
      previousReleased: true,
      alreadyReleased: false,
      directCount: 3,
    }),
    true,
  );
  assert.equal(
    canReleaseLevel({
      level: 2,
      qualifying: 9,
      required: 9,
      previousReleased: true,
      alreadyReleased: true,
      directCount: 3,
    }),
    false,
  );
});

test("later level stays locked until previous is released", () => {
  assert.equal(
    resolveLevelStatus({
      level: 2,
      qualifying: 9,
      required: 9,
      previousReleased: false,
      alreadyReleased: false,
    }),
    "COMPLETED",
  );
  assert.equal(
    canReleaseLevel({
      level: 2,
      qualifying: 9,
      required: 9,
      previousReleased: false,
      alreadyReleased: false,
      directCount: 3,
    }),
    false,
  );
});

test("released level reopens in status helper when qualifying drops", () => {
  assert.equal(
    resolveLevelStatus({
      level: 2,
      qualifying: 8,
      required: 9,
      previousReleased: true,
      alreadyReleased: false,
    }),
    "IN_PROGRESS",
  );
  assert.equal(
    resolveLevelStatus({
      level: 2,
      qualifying: 9,
      required: 9,
      previousReleased: true,
      alreadyReleased: true,
    }),
    "RELEASED",
  );
});

test("all nine locked level totals", () => {
  const expected = [2640, 5940, 8910, 11880, 14256, 17820, 23760, 29700, 35640];
  expected.forEach((total, i) => {
    assert.equal(fullLevelCommission(i + 1), total);
  });
});
