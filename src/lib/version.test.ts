import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicBuildFingerprint } from "./version.ts";

describe("publicBuildFingerprint", () => {
  it("does not expose secrets or database details", () => {
    const prev = {
      DATABASE_URL: process.env.DATABASE_URL,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
      LINKMATE_BUILD_COMMIT: process.env.LINKMATE_BUILD_COMMIT,
    };
    process.env.DATABASE_URL = "postgresql://user:pass@hidden-host:5432/db";
    process.env.BETTER_AUTH_SECRET = "super-secret";
    process.env.LINKMATE_BUILD_COMMIT = "a5bdc50e153cc424a91c7b0f3d6c1106addaa047";
    try {
      const info = publicBuildFingerprint();
      const raw = JSON.stringify(info);
      assert.equal(info.commit, "a5bdc50");
      assert.equal(raw.includes("hidden-host"), false);
      assert.equal(raw.includes("super-secret"), false);
      assert.equal(raw.includes("postgresql"), false);
    } finally {
      for (const [key, value] of Object.entries(prev)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
