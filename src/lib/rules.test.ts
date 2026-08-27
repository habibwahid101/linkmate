import assert from "node:assert/strict";
import test from "node:test";
import {
  PACKAGES,
  commissionPerMember,
  fullLevelCommission,
  STANDARD_ID_VALUE_BDT,
  LEVELS,
} from "./rules.ts";

test("locked packages", () => {
  assert.equal(PACKAGES.builder.amountBdt, 11000);
  assert.equal(PACKAGES.builder.idCount, 1);
  assert.equal(PACKAGES.turbo.amountBdt, 44000);
  assert.equal(PACKAGES.turbo.idCount, 4);
  assert.equal(PACKAGES.super_turbo.amountBdt, 143000);
  assert.equal(PACKAGES.super_turbo.idCount, 13);
  assert.equal(PACKAGES.hyper_turbo.amountBdt, 242000);
  assert.equal(PACKAGES.hyper_turbo.idCount, 22);
  assert.equal(PACKAGES.hyper_turbo.placementRuleVersion, "v2-middle-sponsors-final-9");
});

test("locked commissions on standard ID", () => {
  assert.equal(STANDARD_ID_VALUE_BDT, 11000);
  assert.equal(commissionPerMember(11000, 0.08), 880);
  assert.equal(fullLevelCommission(1), 2640);
  assert.equal(fullLevelCommission(2), 5940);
  assert.equal(fullLevelCommission(3), 8910);
  assert.equal(fullLevelCommission(4), 11880);
  assert.equal(fullLevelCommission(5), 14256);
  assert.equal(fullLevelCommission(6), 17820);
  assert.equal(fullLevelCommission(7), 23760);
  assert.equal(fullLevelCommission(8), 29700);
  assert.equal(fullLevelCommission(9), 35640);
});

test("level table", () => {
  assert.deepEqual(
    LEVELS.map((l) => l.requiredMembers),
    [3, 9, 27, 54, 108, 162, 216, 270, 324],
  );
});
