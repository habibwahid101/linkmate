import type { Sql } from "@/lib/db";

export async function assertRateLimit(
  sql: Sql,
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const rows = await sql<{ hits: number; window_start: string }>`
    select hits, window_start from rate_limits where key = ${key}
  `;
  const now = Date.now();
  const start = rows[0]?.window_start ? new Date(rows[0].window_start).getTime() : 0;
  if (!rows[0] || now - start > windowSeconds * 1000) {
    await sql`
      insert into rate_limits (key, hits, window_start)
      values (${key}, 1, now())
      on conflict (key) do update set hits = 1, window_start = now()
    `;
    return;
  }
  if (Number(rows[0].hits) >= limit) {
    throw new Error("Too many attempts. Try again in a few minutes.");
  }
  await sql`update rate_limits set hits = hits + 1 where key = ${key}`;
}
