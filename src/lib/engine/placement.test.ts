import assert from "node:assert/strict";
import test from "node:test";
import { planPackagePlacement } from "./placement.ts";

test("builder is a single root ID", () => {
  const plan = planPackagePlacement("builder");
  assert.equal(plan.length, 1);
  assert.equal(plan[0]!.isRoot, true);
  assert.equal(plan[0]!.parentIndex, null);
  assert.equal(plan[0]!.sponsorIndex, null);
});

test("turbo: external sponsor hits root only; 3 internals under root", () => {
  const plan = planPackagePlacement("turbo");
  assert.equal(plan.length, 4);
  assert.equal(plan[0]!.isRoot, true);
  assert.deepEqual(
    plan.slice(1).map((p) => ({ parent: p.parentIndex, sponsor: p.sponsorIndex, status: p.placementStatus })),
    [
      { parent: 0, sponsor: 0, status: "placed" },
      { parent: 0, sponsor: 0, status: "placed" },
      { parent: 0, sponsor: 0, status: "placed" },
    ],
  );
});

test("super turbo: 1 + 3 + 9", () => {
  const plan = planPackagePlacement("super_turbo");
  assert.equal(plan.length, 13);
  assert.deepEqual(
    plan.filter((p) => p.parentIndex === 0).map((p) => p.index),
    [1, 2, 3],
  );
  assert.deepEqual(
    plan.filter((p) => p.parentIndex === 1).map((p) => p.index),
    [4, 5, 6],
  );
  assert.deepEqual(
    plan.filter((p) => p.parentIndex === 2).map((p) => p.index),
    [7, 8, 9],
  );
  assert.deepEqual(
    plan.filter((p) => p.parentIndex === 3).map((p) => p.index),
    [10, 11, 12],
  );
  assert.equal(plan.every((p) => p.placementStatus === "placed"), true);
});

test("hyper turbo: first 13 placed, remaining 9 pending_config", () => {
  const plan = planPackagePlacement("hyper_turbo");
  assert.equal(plan.length, 22);
  const placed = plan.filter((p) => p.placementStatus === "placed");
  const pending = plan.filter((p) => p.placementStatus === "pending_config");
  assert.equal(placed.length, 13);
  assert.equal(pending.length, 9);
  assert.equal(pending.every((p) => p.parentIndex == null && p.sponsorIndex == null), true);
});
