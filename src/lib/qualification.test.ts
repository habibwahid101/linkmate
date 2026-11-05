import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLandQualification, nextActionCopy, REQUIRED_DIRECT_SPONSORS, REQUIRED_LEVEL } from "./qualification.ts";

test("land qualification is level 9, not a sponsor count", () => {
  assert.equal(REQUIRED_DIRECT_SPONSORS, 2);
  assert.equal(REQUIRED_LEVEL, 9);
});

test("level 9 release qualifies even before every sponsor title", () => {
  assert.equal(
    evaluateLandQualification({
      hasMembership: true,
      directSponsors: 2,
      completedLevels: 8,
      level9Released: false,
    }).qualified,
    false,
  );
  assert.equal(
    evaluateLandQualification({
      hasMembership: true,
      directSponsors: 0,
      completedLevels: 9,
      level9Released: true,
    }).qualified,
    true,
  );
  assert.equal(
    evaluateLandQualification({
      hasMembership: false,
      directSponsors: 2,
      completedLevels: 9,
      level9Released: true,
    }).qualified,
    false,
  );
});

test("next action copy tells the member the money stays held", () => {
  assert.equal(nextActionCopy({ level: 1, remaining: 1 }), "1 more person needed on Level 1. Their amount stays held until the level is full.");
  assert.match(nextActionCopy({ level: 2, remaining: 3 }), /3 more people/);
  assert.match(nextActionCopy({ level: 1, remaining: 2 }), /held/);
});