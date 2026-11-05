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

test("turbo: 2 internals on level 1, the 3rd moves to level 2", () => {
  const plan = planPackagePlacement("turbo");
  assert.equal(plan.length, 4);
  assert.deepEqual(
    plan.slice(1).map((p) => ({ parent: p.parentIndex, sponsor: p.sponsorIndex, status: p.placementStatus })),
    [
      { parent: 0, sponsor: 0, status: "placed" },
      { parent: 0, sponsor: 0, status: "placed" },
      { parent: 1, sponsor: 1, status: "placed" },
    ],
  );
});

test("no parent is given a 3rd direct child", () => {
  for (const id of ["turbo", "super_turbo", "hyper_turbo"] as const) {
    const plan = planPackagePlacement(id);
    const counts = new Map<number, number>();
    for (const row of plan) {
      if (row.parentIndex == null) continue;
      counts.set(row.parentIndex, (counts.get(row.parentIndex) ?? 0) + 1);
    }
    for (const n of counts.values()) assert.ok(n <= 2, id);
    assert.equal(plan.every((p) => p.placementStatus === "placed"), true);
  }
});

test("super turbo fills 2 then 4 then the rest deeper", () => {
  const plan = planPackagePlacement("super_turbo");
  assert.equal(plan.length, 13);
  assert.deepEqual(
    plan.filter((p) => p.parentIndex === 0).map((p) => p.index),
    [1, 2],
  );
  assert.equal(plan.filter((p) => p.parentIndex === 1 || p.parentIndex === 2).length, 4);
});

test("hyper turbo places all 22 without a third child on one ID", () => {
  const plan = planPackagePlacement("hyper_turbo");
  assert.equal(plan.length, 22);
  assert.equal(plan.every((p) => p.placementStatus === "placed"), true);
  assert.equal(plan.filter((p) => p.parentIndex === 0).length, 2);
});
