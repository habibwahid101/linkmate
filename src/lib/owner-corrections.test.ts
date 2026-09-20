import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { formatDate, formatDateTime } from "./format.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("owner corrections", () => {
  it("keeps the approved hero slides and appends the cottage photo", () => {
    const src = readFileSync(join(ROOT, "src/components/hero-project-visual.tsx"), "utf8");
    const ids = [...src.matchAll(/id: "([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids, [
      "avenue",
      "aerial",
      "path",
      "grove",
      "field",
      "slope",
      "house-porch",
      "house-field",
      "cottage",
    ]);
    assert.match(src, /site-cottage/);
    assert.match(src, /flex-nowrap/);
    assert.match(src, /Linkmate Global/);
  });

  it("formats dates in the runtime locale without rewriting the stored timestamp", () => {
    const iso = "2026-03-15T18:30:00.000Z";
    assert.notEqual(formatDate(iso), iso);
    assert.notEqual(formatDateTime(iso), iso);
    assert.equal(formatDate(null), "—");
    assert.equal(formatDateTime(""), "—");
    const src = readFileSync(join(ROOT, "src/lib/format.ts"), "utf8");
    assert.equal(src.includes("timeZone"), false);
  });

  it("adds avatar_data with a non-destructive migration", () => {
    const sql = readFileSync(join(ROOT, "migrations/0011_profile_avatar.sql"), "utf8");
    assert.match(sql, /alter table app_users add column if not exists avatar_data text/i);
    assert.equal(/\bdrop\s+table\b/i.test(sql), false);
    assert.equal(/\btruncate\b/i.test(sql), false);
  });

  it("uses a gold highlight for 1 Decimal Land and the original logo asset", () => {
    const landing = readFileSync(join(ROOT, "src/routes/index.tsx"), "utf8");
    assert.match(landing, /lm-land-highlight/);
    assert.match(landing, /hero\.toward/);
    assert.match(landing, /1 Decimal Land/);
    assert.equal(landing.includes("1 Katha Land"), false);
    assert.match(landing, /LocaleSwitch/);
    const logo = readFileSync(join(ROOT, "src/components/logo.tsx"), "utf8");
    assert.match(logo, /logo-mark\.png/);
  });
});
