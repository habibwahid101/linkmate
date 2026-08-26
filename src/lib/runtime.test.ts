import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { flagsFromEnv } from "./runtime.ts";

function bag(values: Record<string, string | undefined>) {
  return (key: string) => values[key];
}

describe("flagsFromEnv", () => {
  it("disables payments, sample network, simulate joins, and admin bootstrap in production", () => {
    const flags = flagsFromEnv(
      bag({
        APP_ENV: "production",
        DATABASE_URL: "postgres://x",
      }),
    );
    assert.equal(flags.isProduction, true);
    assert.equal(flags.paymentsMode, "disabled");
    assert.equal(flags.demoNetwork, false);
    assert.equal(flags.simulateJoins, false);
    assert.equal(flags.bootstrapAdmin, false);
  });

  it("never bootstraps admin in production even if ALLOW_BOOTSTRAP_ADMIN=true", () => {
    const flags = flagsFromEnv(
      bag({
        APP_ENV: "production",
        ALLOW_BOOTSTRAP_ADMIN: "true",
      }),
    );
    assert.equal(flags.bootstrapAdmin, false);
  });

  it("keeps preview sample/simulate on unless explicitly disabled", () => {
    const flags = flagsFromEnv(bag({ NODE_ENV: "development" }));
    assert.equal(flags.isProduction, false);
    assert.equal(flags.paymentsMode, "simulation");
    assert.equal(flags.demoNetwork, true);
    assert.equal(flags.simulateJoins, true);
  });

  it("treats NODE_ENV=production + DATABASE_URL as production", () => {
    const flags = flagsFromEnv(
      bag({ NODE_ENV: "production", DATABASE_URL: "postgres://x" }),
    );
    assert.equal(flags.isProduction, true);
    assert.equal(flags.paymentsMode, "disabled");
  });

  it("does not treat a production Node build without DATABASE_URL as production", () => {
    const flags = flagsFromEnv(bag({ NODE_ENV: "production" }));
    assert.equal(flags.isProduction, false);
    assert.equal(flags.demoNetwork, true);
  });
});
