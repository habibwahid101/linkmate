import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPACT_LIST_THRESHOLD,
  DASHBOARD_ID_PREVIEW,
  filterAndSortIds,
  fixtureId,
  isGraduated,
  journeyState,
  levelRequirementCopy,
  memberFacingGenerationCopyForbidden,
  originLabel,
  parseMemberIdSearch,
  progressNoun,
  remainingCopy,
  summarizeAccount,
  usesCompactList,
} from "./id-workspace.ts";

function hyperSet() {
  return Array.from({ length: 22 }, (_, i) =>
    fixtureId({
      id: `LM-${100101 + i}`,
      package_id: "hyper_turbo",
      is_root: i === 0,
      origin_kind: i === 0 ? "purchase_root" : "purchase_internal",
      current_level: i === 0 ? 4 : i === 21 ? 9 : i % 3 === 0 ? 2 : 1,
      progression_status: i === 21 ? "GRADUATED" : "ACTIVE",
      level9Released: i === 21,
      held: i === 3 ? 2640 : i === 7 ? 880 : 0,
      released: i === 0 ? 2640 : 0,
      available: i === 0 ? 2640 : 0,
      created_at: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      currentProgress:
        i === 21
          ? { level: 9, completed: 324, required: 324, remaining: 0, status: "RELEASED" }
          : i === 0
            ? { level: 4, completed: 10, required: 54, remaining: 44, status: "IN_PROGRESS" }
            : { level: i % 3 === 0 ? 2 : 1, completed: 1, required: i % 3 === 0 ? 9 : 3, remaining: i % 3 === 0 ? 8 : 2, status: "IN_PROGRESS" },
    }),
  );
}

test("A. builder: one ID account summary", () => {
  const ids = [fixtureId({ id: "LM-100101", package_id: "builder", current_level: 1, held: 0, released: 0 })];
  const s = summarizeAccount(ids);
  assert.equal(s.idCount, 1);
  assert.equal(s.idsInProgress, 1);
  assert.equal(s.graduatedCount, 0);
  assert.equal(s.highestActiveLevel, 1);
  assert.equal(usesCompactList(1), false);
});

test("B. turbo: four independent IDs keep own referral and progress", () => {
  const ids = [
    fixtureId({ id: "LM-100201", package_id: "turbo", is_root: true, current_level: 2, released: 2640, referral_code: "ROOT01" }),
    fixtureId({ id: "LM-100202", package_id: "turbo", is_root: false, current_level: 1, referral_code: "INTA02" }),
    fixtureId({ id: "LM-100203", package_id: "turbo", is_root: false, current_level: 1, referral_code: "INTB03" }),
    fixtureId({ id: "LM-100204", package_id: "turbo", is_root: false, current_level: 1, referral_code: "INTC04" }),
  ];
  assert.equal(new Set(ids.map((i) => i.referral_code)).size, 4);
  assert.equal(ids[0]!.current_level, 2);
  assert.ok(ids.slice(1).every((i) => i.current_level === 1));
  assert.equal(summarizeAccount(ids).released, 2640);
  assert.equal(summarizeAccount(ids).idCount, 4);
});

test("C. super turbo: 13 IDs search filter sort isolate", () => {
  const ids = Array.from({ length: 13 }, (_, i) =>
    fixtureId({
      id: `LM-${100301 + i}`,
      package_id: "super_turbo",
      is_root: i === 0,
      current_level: i === 0 ? 3 : 1,
      held: i === 2 ? 880 : 0,
      referral_code: `S${String(i).padStart(5, "0")}`,
    }),
  );
  assert.equal(ids.length, 13);
  const found = filterAndSortIds(ids, { query: "LM-100305" });
  assert.equal(found.length, 1);
  assert.equal(found[0]!.id, "LM-100305");
  const held = filterAndSortIds(ids, { filter: "held" });
  assert.equal(held.length, 1);
  assert.equal(held[0]!.id, "LM-100303");
  const byLevel = filterAndSortIds(ids, { sort: "level" });
  assert.equal(byLevel[0]!.id, "LM-100301");
});

test("D. hyper turbo: 22 IDs stay compact and switchable", () => {
  const ids = hyperSet();
  assert.equal(ids.length, 22);
  assert.equal(usesCompactList(22), true);
  assert.ok(DASHBOARD_ID_PREVIEW < 22);
  const preview = ids.slice(0, DASHBOARD_ID_PREVIEW);
  assert.equal(preview.length, 8);
  const graduated = filterAndSortIds(ids, { filter: "graduated" });
  assert.equal(graduated.length, 1);
  assert.equal(graduated[0]!.id, "LM-100122");
  const l2 = filterAndSortIds(ids, { filter: "level2plus" });
  assert.ok(l2.every((r) => r.current_level >= 2 && !isGraduated(r)));
});

test("E. same owner independent presentation", () => {
  const ids = [
    fixtureId({ id: "LM-A", current_level: 1, currentProgress: { level: 1, completed: 1, required: 3, remaining: 2, status: "IN_PROGRESS" } }),
    fixtureId({ id: "LM-B", current_level: 2, currentProgress: { level: 2, completed: 4, required: 9, remaining: 5, status: "IN_PROGRESS" } }),
    fixtureId({ id: "LM-C", current_level: 4, currentProgress: { level: 4, completed: 20, required: 54, remaining: 34, status: "IN_PROGRESS" } }),
    fixtureId({
      id: "LM-D",
      current_level: 9,
      progression_status: "GRADUATED",
      level9Released: true,
      currentProgress: { level: 9, completed: 324, required: 324, remaining: 0, status: "RELEASED" },
    }),
  ];
  assert.equal(ids[0]!.currentProgress.completed, 1);
  assert.equal(ids[1]!.current_level, 2);
  assert.equal(ids[2]!.current_level, 4);
  assert.equal(isGraduated(ids[3]!), true);
  assert.equal(journeyState({ level: 9, status: "RELEASED" }, true), "graduated");
  const s = summarizeAccount(ids);
  assert.equal(s.graduatedCount, 1);
  assert.equal(s.idsInProgress, 3);
  assert.equal(s.highestActiveLevel, 9);
});

test("F. earnings aggregates without mixing IDs", () => {
  const ids = [
    fixtureId({ id: "LM-A", held: 880, released: 0, available: 0 }),
    fixtureId({ id: "LM-B", held: 0, released: 2640, available: 2640 }),
  ];
  const s = summarizeAccount(ids);
  assert.equal(s.held, 880);
  assert.equal(s.released, 2640);
  assert.equal(s.available, 2640);
  assert.equal(ids[0]!.released, 0);
  assert.equal(ids[1]!.held, 0);
});

test("G. referral copy is per ID", () => {
  const ids = [
    fixtureId({ id: "LM-1", referral_code: "AAAA11" }),
    fixtureId({ id: "LM-2", referral_code: "BBBB22" }),
  ];
  assert.notEqual(ids[0]!.referral_code, ids[1]!.referral_code);
});

test("H. parseMemberIdSearch never invents an ID", () => {
  assert.deepEqual(parseMemberIdSearch({}), {});
  assert.deepEqual(parseMemberIdSearch({ id: "LM-100101" }), { id: "LM-100101" });
  assert.deepEqual(parseMemberIdSearch({ id: 12 }), {});
});

test("I. empty account summary", () => {
  const s = summarizeAccount([]);
  assert.equal(s.idCount, 0);
  assert.equal(s.available, 0);
  assert.equal(s.held, 0);
  assert.equal(s.released, 0);
  assert.equal(s.highestActiveLevel, 0);
});

test("J. compact list kicks in for 13/22, not for 1 or 4", () => {
  assert.equal(usesCompactList(1), false);
  assert.equal(usesCompactList(4), false);
  assert.equal(usesCompactList(COMPACT_LIST_THRESHOLD), true);
  assert.equal(usesCompactList(13), true);
  assert.equal(usesCompactList(22), true);
});

test("K. member dashboard copy never teaches generation = level", () => {
  assert.equal(levelRequirementCopy(1), "3 Direct Sponsored IDs");
  assert.equal(levelRequirementCopy(2), "9 Eligible Downline IDs");
  assert.equal(levelRequirementCopy(3), "27 Eligible Downline IDs");
  assert.equal(levelRequirementCopy(9), "324 Eligible Downline IDs");
  assert.equal(progressNoun(1), "Direct Sponsored IDs");
  assert.equal(progressNoun(5), "Eligible Downline IDs");
  assert.equal(remainingCopy({ level: 2, completed: 17, required: 27, remaining: 10, status: "IN_PROGRESS" }), "10 IDs remaining");
  for (const phrase of memberFacingGenerationCopyForbidden()) {
    assert.equal(/generation/i.test(levelRequirementCopy(2)), false, phrase);
  }
  assert.equal(originLabel({ is_root: true }), "Root");
  assert.equal(originLabel({ is_root: false, origin_kind: "purchase_internal" }), "Internal");
});
