import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { DURABLE_TABLES, sqlTable } from "./durable-tables.mjs";

describe("durable tables", () => {
  it("quotes reserved auth table names", () => {
    assert.equal(sqlTable("user"), '"user"');
    assert.equal(sqlTable("commission_entries"), '"commission_entries"');
    assert.throws(() => sqlTable("user; drop table wallets"), /unsafe table name/);
  });

  it("covers the financial ledger", () => {
    assert.ok(DURABLE_TABLES.includes("commission_entries"));
    assert.ok(DURABLE_TABLES.includes("held_commissions"));
    assert.ok(DURABLE_TABLES.includes("wallet_transactions"));
    assert.ok(DURABLE_TABLES.includes("audit_logs"));
  });
});

describe("migrate fail-closed", () => {
  it("exits non-zero in production without DATABASE_URL", () => {
    const result = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, APP_ENV: "production", DATABASE_URL: "" },
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DATABASE_URL is required/);
  });

  it("skips when DATABASE_URL is unset outside production", () => {
    const result = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, APP_ENV: "development", DATABASE_URL: "" },
      encoding: "utf8",
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout + result.stderr, /skipping/);
  });
});

describe("db-restore fail-closed", () => {
  it("refuses a production-flagged process", () => {
    const result = spawnSync(process.execPath, ["scripts/db-restore.mjs", "/tmp/x.json"], {
      env: {
        ...process.env,
        APP_ENV: "production",
        DATABASE_URL: "postgres://localhost/isolated",
        RESTORE_CONFIRM: "ISOLATED_RESTORE_ONLY",
      },
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /production-flagged/);
  });

  it("refuses without RESTORE_CONFIRM", () => {
    const result = spawnSync(process.execPath, ["scripts/db-restore.mjs", "/tmp/x.json"], {
      env: { ...process.env, APP_ENV: "development", DATABASE_URL: "postgres://localhost/isolated" },
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /RESTORE_CONFIRM/);
  });
});
