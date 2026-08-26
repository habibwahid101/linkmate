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
  demoNetwork: boolean;
  simulateJoins: boolean;
  bootstrapAdmin: boolean;
};

export function flagsFromEnv(get: (key: string) => string | undefined): RuntimeFlags {
  const appEnv = get("APP_ENV") || get("NODE_ENV") || "development";
  const isProduction =
    get("APP_ENV") === "production" ||
    (get("NODE_ENV") === "production" && Boolean(get("DATABASE_URL")));
  const payments = get("PAYMENTS_MODE");
  const paymentsMode: PaymentsMode =
    payments === "disabled" || payments === "simulation" || payments === "enabled"
      ? payments
      : isProduction
        ? "disabled"
        : "simulation";
  return {
    appEnv,
    isProduction,
    paymentsMode,
    demoNetwork: !isProduction && get("ENABLE_DEMO_NETWORK") !== "false",
    simulateJoins: !isProduction && get("ENABLE_SIMULATE_JOINS") !== "false",
    bootstrapAdmin: get("ALLOW_BOOTSTRAP_ADMIN") === "true" && !isProduction,
  };
}

export const APP_ENV = env("APP_ENV") ?? env("NODE_ENV") ?? "development";
export const isProduction = flagsFromEnv(env).isProduction;

export function runtimeFlags(): RuntimeFlags {
  return flagsFromEnv(env);
}
