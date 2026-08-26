/**
 * Public, non-sensitive build fingerprint. Never reads DATABASE_URL, auth
 * secrets, or host internals. Used by /api/version.
 */
export type BuildFingerprint = {
  commit: string;
  dirty: boolean;
  patched: boolean;
  builtAt: string;
};

function env(key: string): string | undefined {
  const value = typeof process !== "undefined" ? process.env[key]?.trim() : undefined;
  return value ? value : undefined;
}

export function publicBuildFingerprint(): BuildFingerprint {
  const sha =
    env("GITHUB_SHA") ||
    env("VERCEL_GIT_COMMIT_SHA") ||
    env("LINKMATE_BUILD_COMMIT") ||
    "unknown";
  return {
    commit: sha.slice(0, 7),
    dirty: env("LINKMATE_BUILD_DIRTY") === "1",
    patched: env("LINKMATE_SSR_PATCHED") === "1",
    builtAt: env("LINKMATE_BUILD_TIME") || "unknown",
  };
}
