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
  assert.equal(PACKAGES.hyper_turbo.placementRuleVersion, "v3-level-caps");
});

test("locked commissions on standard ID", () => {
  assert.equal(STANDARD_ID_VALUE_BDT, 11000);
  assert.equal(commissionPerMember(11000, 0.09), 990);
  assert.equal(fullLevelCommission(1), 1980);
  assert.equal(fullLevelCommission(2), 3520);
  assert.equal(fullLevelCommission(3), 6160);
  assert.equal(fullLevelCommission(4), 10560);
  assert.equal(fullLevelCommission(5), 17600);
  assert.equal(fullLevelCommission(6), 28160);
  assert.equal(fullLevelCommission(7), 42240);
  assert.equal(fullLevelCommission(8), 56320);
  assert.equal(fullLevelCommission(9), 56320);
});

test("level table", () => {
  assert.deepEqual(
    LEVELS.map((l) => l.requiredMembers),
    [2, 4, 8, 16, 32, 64, 128, 256, 512],
  );
});
