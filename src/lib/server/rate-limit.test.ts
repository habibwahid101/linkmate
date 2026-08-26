import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { assertRateLimit } from "./rate-limit.ts";
import type { Sql } from "../db.ts";

function wrap(pg: PGlite): Sql {
  const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    const result = await pg.query<T>(text, values);
    return result.rows;
  }) as Sql;
  sql.query = async <T>(text: string, params: unknown[] = []) => {
    const result = await pg.query<T>(text, params);
    return result.rows;
  };
  sql.withTransaction = async (fn) => fn(sql);
  return sql;
}

describe("assertRateLimit", () => {
  it("allows traffic under the limit and blocks over it", async () => {
    const pg = new PGlite();
    await pg.waitReady;
    await pg.exec(readFileSync("/workspace/migrations/0004_production.sql", "utf8"));
    const sql = wrap(pg);
    await assertRateLimit(sql, "t:one", 2, 60);
    await assertRateLimit(sql, "t:one", 2, 60);
    await assert.rejects(() => assertRateLimit(sql, "t:one", 2, 60), /Too many attempts/);
  });
});
