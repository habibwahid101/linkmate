import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveLevelStatus,
  canReleaseLevel,
  heldForCount,
} from "./level-state.ts";
import { commissionPerMember, fullLevelCommission } from "../rules.ts";

test("Level 1 stays in progress until 2 people, then can release", () => {
  for (const n of [0, 1]) {
    const status = resolveLevelStatus({
      level: 1,
      qualifying: n,
      required: 2,
      previousReleased: true,
      alreadyReleased: false,
    });
    assert.equal(status, n === 0 ? "IN_PROGRESS" : "IN_PROGRESS");
    assert.equal(
      canReleaseLevel({
        level: 1,
        qualifying: n,
        required: 2,
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
      qualifying: 2,
      required: 2,
      previousReleased: true,
      alreadyReleased: false,
      directCount: 2,
    }),
    true,
  );
});

test("Level 1 held amounts 0/1/2", () => {
  const per = commissionPerMember(11000, 0.09);
  assert.equal(per, 990);
  assert.equal(heldForCount(per, 1), 990);
  assert.equal(heldForCount(per, 2), 1980);
  assert.equal(fullLevelCommission(1), 1980);
});

test("Level 2 does not release at 3/4", () => {
  const per = commissionPerMember(11000, 0.08);
  assert.equal(per, 880);
  assert.equal(heldForCount(per, 3), 2640);
  assert.equal(fullLevelCommission(2), 3520);
  assert.equal(
    canReleaseLevel({
      level: 2,
      qualifying: 3,
      required: 4,
      previousReleased: true,
      alreadyReleased: false,
      directCount: 2,
    }),
    false,
  );
});

test("Level 2 releases once at 4/4 after Level 1 released", () => {
  assert.equal(
    canReleaseLevel({
      level: 2,
      qualifying: 4,
      required: 4,
      previousReleased: true,
      alreadyReleased: false,
      directCount: 2,
    }),
    true,
  );
  assert.equal(
    canReleaseLevel({
      level: 2,
      qualifying: 4,
      required: 4,
      previousReleased: false,
      alreadyReleased: false,
      directCount: 2,
    }),
    false,
  );
});

test("later level stays locked until previous is released", () => {
  assert.equal(
    resolveLevelStatus({
      level: 2,
      qualifying: 4,
      required: 4,
      previousReleased: false,
      alreadyReleased: false,
    }),
    "COMPLETED",
  );
  assert.equal(
    canReleaseLevel({
      level: 2,
      qualifying: 4,
      required: 4,
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
      qualifying: 3,
      required: 4,
      previousReleased: true,
      alreadyReleased: false,
    }),
    "IN_PROGRESS",
  );
  assert.equal(
    resolveLevelStatus({
      level: 2,
      qualifying: 3,
      required: 4,
      previousReleased: true,
      alreadyReleased: true,
    }),
    "RELEASED",
  );
});

test("all nine locked level totals", () => {
  const expected = [1980, 3520, 6160, 10560, 17600, 28160, 42240, 56320, 56320];
  expected.forEach((total, i) => {
    assert.equal(fullLevelCommission(i + 1), total);
  });
});
