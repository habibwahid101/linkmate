/** Production vs preview runtime flags. Server-only. */

function env(key: string): string | undefined {
  const value = typeof process !== "undefined" ? process.env[key]?.trim() : undefined;
  return value ? value : undefined;
}

export type PaymentsMode = "disabled" | "simulation" | "enabled";

export type RuntimeFlags = {
  appEnv: string;
  isProduction: boolean;
  paymentsMode: PaymentsMode;
  manualPayments: boolean;
  demoNetwork: boolean;
  simulateJoins: boolean;
  bootstrapAdmin: boolean;
  publicUrl: string | undefined;
};

export const PAYMENTS_DISABLED_MESSAGE = "Online payment is not available yet.";

/** Vercel production and explicit APP_ENV=production must use durable Postgres. */
export function requiresDurableDatabase(get: (key: string) => string | undefined): boolean {
  return get("APP_ENV") === "production" || get("VERCEL_ENV") === "production";
}

export function isPostgresUrl(url: string | undefined): boolean {
  return Boolean(url?.trim() && /^postgres(ql)?:\/\//i.test(url.trim()));
}

export function flagsFromEnv(get: (key: string) => string | undefined): RuntimeFlags {
  const appEnv = get("APP_ENV") || get("NODE_ENV") || "development";
  const durableRequired = requiresDurableDatabase(get);
  const isProduction =
    durableRequired ||
    (get("NODE_ENV") === "production" && Boolean(get("DATABASE_URL")?.trim()));
  const payments = get("PAYMENTS_MODE");
  const paymentsMode: PaymentsMode =
    payments === "disabled" || payments === "simulation" || payments === "enabled"
      ? payments
      : isProduction
        ? "disabled"
        : "simulation";
  const demoOff =
    isProduction ||
    get("ENABLE_DEMO_NETWORK") === "false" ||
    get("ENABLE_SAMPLE_DATA") === "false";
  return {
    appEnv,
    isProduction,
    paymentsMode: isProduction ? "disabled" : paymentsMode,
    manualPayments: get("MANUAL_PAYMENTS_ENABLED") !== "false",
    demoNetwork: !demoOff,
    simulateJoins: !isProduction && get("ENABLE_SIMULATE_JOINS") !== "false",
    bootstrapAdmin: get("ALLOW_BOOTSTRAP_ADMIN") === "true" && !isProduction,
    publicUrl: get("APP_URL") || get("BETTER_AUTH_URL") || get("PUBLIC_URL") || get("AUTH_URL"),
  };
}

/** Production must not silently fall back to ephemeral PGLite. */
export function assertDurableDatabase(get: (key: string) => string | undefined): void {
  if (!requiresDurableDatabase(get)) return;
  const url = get("DATABASE_URL")?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is required when APP_ENV=production (ephemeral storage is not allowed).",
    );
  }
  if (!isPostgresUrl(url)) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string in production.");
  }
}

/** Purchases, commissions, and wallet mutations require durable Postgres in production. */
export function assertDurableMutations(
  get: (key: string) => string | undefined,
  source: "neon" | "postgres" | "pglite",
): void {
  assertDurableDatabase(get);
  if (requiresDurableDatabase(get) && source === "pglite") {
    throw new Error(
      "DATABASE_URL is required when APP_ENV=production (ephemeral storage is not allowed).",
    );
  }
}

/** Production must not fall back to preview OAuth credentials or a random signing secret. */
export function assertProductionSecrets(get: (key: string) => string | undefined): void {
  if (!requiresDurableDatabase(get)) return;
  const secret = get("BETTER_AUTH_SECRET")?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET (32+ characters) is required when APP_ENV=production.");
  }
  const publicUrl =
    get("BETTER_AUTH_URL")?.trim() ||
    get("APP_URL")?.trim() ||
    (get("VITE_PUBLIC_HOSTNAME")?.trim()
      ? `https://${get("VITE_PUBLIC_HOSTNAME")!.trim().replace(/^https?:\/\//, "")}`
      : undefined);
  if (!publicUrl || !/^https:\/\//i.test(publicUrl)) {
    throw new Error("BETTER_AUTH_URL or APP_URL must be an https origin when APP_ENV=production.");
  }
}

export const APP_ENV = env("APP_ENV") ?? env("NODE_ENV") ?? "development";
export const isProduction = flagsFromEnv(env).isProduction;

export function runtimeFlags(): RuntimeFlags {
  return flagsFromEnv(env);
}
