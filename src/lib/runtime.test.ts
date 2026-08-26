import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  flagsFromEnv,
  assertDurableDatabase,
  assertProductionSecrets,
  requiresDurableDatabase,
  isPostgresUrl,
  assertDurableMutations,
} from "./runtime.ts";

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

  it("keeps manual payments available in production while gateway stays disabled", () => {
    const flags = flagsFromEnv(
      bag({ APP_ENV: "production", DATABASE_URL: "postgres://x" }),
    );
    assert.equal(flags.paymentsMode, "disabled");
    assert.equal(flags.manualPayments, true);
  });

  it("can disable manual payments with MANUAL_PAYMENTS_ENABLED=false", () => {
    const flags = flagsFromEnv(bag({ MANUAL_PAYMENTS_ENABLED: "false" }));
    assert.equal(flags.manualPayments, false);
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

  it("treats Vercel production as production even before DATABASE_URL is read", () => {
    const flags = flagsFromEnv(bag({ VERCEL_ENV: "production" }));
    assert.equal(flags.isProduction, true);
    assert.equal(flags.paymentsMode, "disabled");
    assert.equal(flags.demoNetwork, false);
    assert.equal(flags.simulateJoins, false);
  });

  it("forces payments disabled in production even if PAYMENTS_MODE=enabled", () => {
    const flags = flagsFromEnv(
      bag({ APP_ENV: "production", DATABASE_URL: "postgres://x", PAYMENTS_MODE: "enabled" }),
    );
    assert.equal(flags.paymentsMode, "disabled");
  });

  it("forces payments disabled in production even if PAYMENTS_MODE=simulation", () => {
    const flags = flagsFromEnv(
      bag({ APP_ENV: "production", DATABASE_URL: "postgres://x", PAYMENTS_MODE: "simulation" }),
    );
    assert.equal(flags.paymentsMode, "disabled");
  });

  it("disables sample/demo when ENABLE_SAMPLE_DATA=false", () => {
    const flags = flagsFromEnv(bag({ ENABLE_SAMPLE_DATA: "false" }));
    assert.equal(flags.demoNetwork, false);
  });

  it("disables sample/demo when ENABLE_DEMO_NETWORK=false", () => {
    const flags = flagsFromEnv(bag({ ENABLE_DEMO_NETWORK: "false" }));
    assert.equal(flags.demoNetwork, false);
  });

  it("reads public URL from APP_URL then BETTER_AUTH_URL", () => {
    assert.equal(flagsFromEnv(bag({ APP_URL: "https://app.example" })).publicUrl, "https://app.example");
    assert.equal(
      flagsFromEnv(bag({ BETTER_AUTH_URL: "https://auth.example" })).publicUrl,
      "https://auth.example",
    );
  });
});

describe("assertDurableDatabase", () => {
  it("throws when APP_ENV=production and DATABASE_URL is missing", () => {
    assert.throws(
      () => assertDurableDatabase(bag({ APP_ENV: "production" })),
      /DATABASE_URL is required/,
    );
  });

  it("throws when Vercel production is missing DATABASE_URL", () => {
    assert.throws(
      () => assertDurableDatabase(bag({ VERCEL_ENV: "production" })),
      /DATABASE_URL is required/,
    );
  });

  it("throws when production DATABASE_URL is not PostgreSQL", () => {
    assert.throws(
      () =>
        assertDurableDatabase(
          bag({ APP_ENV: "production", DATABASE_URL: "sqlite:///tmp/app.db" }),
        ),
      /PostgreSQL/,
    );
  });

  it("allows preview without DATABASE_URL", () => {
    assert.doesNotThrow(() => assertDurableDatabase(bag({ NODE_ENV: "development" })));
  });

  it("allows a production Node build without DATABASE_URL (vite compile)", () => {
    assert.doesNotThrow(() => assertDurableDatabase(bag({ NODE_ENV: "production" })));
  });

  it("allows production when DATABASE_URL is set", () => {
    assert.doesNotThrow(() =>
      assertDurableDatabase(bag({ APP_ENV: "production", DATABASE_URL: "postgres://x" })),
    );
  });

  it("accepts postgresql:// URLs", () => {
    assert.equal(isPostgresUrl("postgresql://user:pass@host/db?sslmode=require"), true);
    assert.equal(isPostgresUrl("postgres://host/db"), true);
    assert.equal(isPostgresUrl("sqlite://x"), false);
    assert.equal(requiresDurableDatabase(bag({ VERCEL_ENV: "production" })), true);
    assert.equal(requiresDurableDatabase(bag({ NODE_ENV: "production" })), false);
  });
});

describe("assertProductionSecrets", () => {
  it("throws without a 32+ character BETTER_AUTH_SECRET in production", () => {
    assert.throws(
      () =>
        assertProductionSecrets(
          bag({ APP_ENV: "production", BETTER_AUTH_URL: "https://app.example" }),
        ),
      /BETTER_AUTH_SECRET/,
    );
  });

  it("throws without an https public origin in production", () => {
    assert.throws(
      () =>
        assertProductionSecrets(
          bag({
            APP_ENV: "production",
            BETTER_AUTH_SECRET: "x".repeat(32),
            BETTER_AUTH_URL: "http://localhost:8080",
          }),
        ),
      /https origin/,
    );
  });

  it("allows production when secret and https origin are set", () => {
    assert.doesNotThrow(() =>
      assertProductionSecrets(
        bag({
          APP_ENV: "production",
          BETTER_AUTH_SECRET: "x".repeat(32),
          BETTER_AUTH_URL: "https://app.example",
        }),
      ),
    );
  });

  it("accepts VITE_PUBLIC_HOSTNAME as the https origin", () => {
    assert.doesNotThrow(() =>
      assertProductionSecrets(
        bag({
          VERCEL_ENV: "production",
          BETTER_AUTH_SECRET: "x".repeat(32),
          VITE_PUBLIC_HOSTNAME: "dove-maple-orchid-brook.grok.me",
        }),
      ),
    );
  });

  it("does not require secrets in preview", () => {
    assert.doesNotThrow(() => assertProductionSecrets(bag({ NODE_ENV: "development" })));
  });
});

describe("assertDurableMutations", () => {
  it("rejects PGLite fallback for purchases and commissions in production", () => {
    assert.throws(
      () =>
        assertDurableMutations(
          bag({ APP_ENV: "production", DATABASE_URL: "postgres://x" }),
          "pglite",
        ),
      /ephemeral storage is not allowed/,
    );
  });

  it("rejects production without DATABASE_URL so mutations cannot run", () => {
    assert.throws(
      () => assertDurableMutations(bag({ APP_ENV: "production" }), "pglite"),
      /DATABASE_URL is required/,
    );
    assert.throws(
      () => assertDurableMutations(bag({ VERCEL_ENV: "production" }), "pglite"),
      /DATABASE_URL is required/,
    );
  });

  it("allows durable Postgres mutations in production", () => {
    assert.doesNotThrow(() =>
      assertDurableMutations(
        bag({ APP_ENV: "production", DATABASE_URL: "postgres://x" }),
        "postgres",
      ),
    );
  });

  it("allows PGLite mutations in preview", () => {
    assert.doesNotThrow(() =>
      assertDurableMutations(bag({ NODE_ENV: "development" }), "pglite"),
    );
  });
});
