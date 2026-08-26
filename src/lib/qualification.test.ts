import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLandQualification, nextActionCopy, REQUIRED_DIRECT_SPONSORS, REQUIRED_LEVEL } from "./qualification.ts";

test("land qualification uses locked sponsor 3 and level 9", () => {
  assert.equal(REQUIRED_DIRECT_SPONSORS, 3);
  assert.equal(REQUIRED_LEVEL, 9);
});

test("never marks qualified until sponsor 3 and level 9 are both complete", () => {
  assert.equal(
    evaluateLandQualification({
      hasMembership: true,
      directSponsors: 3,
      completedLevels: 8,
      level9Released: false,
    }).qualified,
    false,
  );
  assert.equal(
    evaluateLandQualification({
      hasMembership: true,
      directSponsors: 2,
      completedLevels: 9,
      level9Released: true,
    }).qualified,
    false,
  );
  assert.equal(
    evaluateLandQualification({
      hasMembership: false,
      directSponsors: 3,
      completedLevels: 9,
      level9Released: true,
    }).qualified,
    false,
  );
  const ok = evaluateLandQualification({
    hasMembership: true,
    directSponsors: 3,
    completedLevels: 9,
    level9Released: true,
  });
  assert.equal(ok.qualified, true);
  assert.equal(ok.status, "Qualified");
});

test("next action copy is operational", () => {
  assert.equal(nextActionCopy({ level: 1, remaining: 1 }), "1 more direct sponsor needed");
  assert.equal(nextActionCopy({ level: 2, remaining: 3 }), "3 more Level-2 members needed");
});
