/** Platform operators that always keep admin access. */

const DEFAULT_LOCKED_ADMIN_EMAILS = [
  "hello.habibwahid@gmail.com",
  "linkmateglobal@gmail.com",
] as const;

type EnvGet = (key: string) => string | undefined;

function readEnv(key: string): string | undefined {
  const value = typeof process !== "undefined" ? process.env[key]?.trim() : undefined;
  return value ? value : undefined;
}

export function lockedAdminEmails(getEnv: EnvGet = readEnv): Set<string> {
  const extra = (getEnv("LOCKED_ADMIN_EMAILS") ?? "")
    .split(/[,\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_LOCKED_ADMIN_EMAILS, ...extra]);
}

export function isLockedAdminEmail(
  email: string | null | undefined,
  getEnv: EnvGet = readEnv,
): boolean {
  if (!email) return false;
  return lockedAdminEmails(getEnv).has(email.trim().toLowerCase());
}

export function effectiveRole(
  email: string | null | undefined,
  role: string | null | undefined,
  getEnv: EnvGet = readEnv,
): "admin" | "member" {
  if (isLockedAdminEmail(email, getEnv) || role === "admin") return "admin";
  return "member";
}

export function assertCanDemoteAdmin(
  email: string | null | undefined,
  getEnv: EnvGet = readEnv,
): void {
  if (isLockedAdminEmail(email, getEnv)) {
    throw new Error("Cannot demote a platform administrator");
  }
}
