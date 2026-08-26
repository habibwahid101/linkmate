export type HealthBody = {
  ok: boolean;
  db: "connected" | "unavailable";
  durable: boolean;
};

export function healthBody(dbReachable: boolean, durable = false): HealthBody {
  return {
    ok: dbReachable,
    db: dbReachable ? "connected" : "unavailable",
    durable,
  };
}

export type HealthPing = { status: number; body: HealthBody };

function isPostgresUrl(url: string | undefined): boolean {
  return Boolean(url?.trim() && /^postgres(ql)?:\/\//i.test(url.trim()));
}

/**
 * Isolated production health probe. Never imports Better Auth, db.ts, or PGLite.
 * `durable` is true only when a PostgreSQL URL exists AND select 1 succeeds.
 */
export async function pingHealth(): Promise<HealthPing> {
  const url = process.env.DATABASE_URL?.trim();
  if (!isPostgresUrl(url)) {
    return { status: 503, body: healthBody(false, false) };
  }
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: url,
      max: 1,
      connectionTimeoutMillis: 4000,
    });
    try {
      await pool.query("select 1 as ok");
    } finally {
      await pool.end();
    }
    return { status: 200, body: healthBody(true, true) };
  } catch {
    return { status: 503, body: healthBody(false, false) };
  }
}
