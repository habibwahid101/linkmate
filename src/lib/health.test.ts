import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { healthBody, liveBody, pingHealth, pingLive } from "./health.ts";

describe("healthBody", () => {
  it("reports connected without exposing the backend", () => {
    assert.deepEqual(healthBody(true, true), {
      ok: true,
      db: "connected",
      durable: true,
    });
    assert.equal(JSON.stringify(healthBody(true, true)).includes("postgres"), false);
    assert.equal(JSON.stringify(healthBody(true, true)).includes("neon"), false);
  });

  it("reports unavailable on database failure", () => {
    assert.deepEqual(healthBody(false, false), {
      ok: false,
      db: "unavailable",
      durable: false,
    });
  });

  it("marks preview storage as not durable", () => {
    assert.equal(healthBody(true, false).durable, false);
  });
});

describe("pingLive", () => {
  it("is 200 without reading the database", () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const result = pingLive();
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, liveBody());
      assert.equal(JSON.stringify(result.body).includes("DATABASE"), false);
    } finally {
      if (prev === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prev;
    }
  });
});

describe("pingHealth", () => {
  it("returns controlled 503 without a postgres URL", async () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const result = await pingHealth();
      assert.equal(result.status, 503);
      assert.deepEqual(result.body, { ok: false, db: "unavailable", durable: false });
    } finally {
      if (prev === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prev;
    }
  });

  it("returns controlled 503 for a malformed URL", async () => {
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "mysql://example";
    try {
      const result = await pingHealth();
      assert.equal(result.status, 503);
      assert.equal(result.body.durable, false);
    } finally {
      if (prev === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prev;
    }
  });
});
