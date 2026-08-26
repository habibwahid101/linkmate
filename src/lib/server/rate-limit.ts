import type { Sql } from "@/lib/db";

export async function assertRateLimit(
  sql: Sql,
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const rows = await sql<{ hits: number }>`
    insert into rate_limits (key, hits, window_start)
    values (${key}, 1, now())
    on conflict (key) do update set
      hits = case
        when extract(epoch from (now() - rate_limits.window_start)) > ${windowSeconds}
        then 1
        else rate_limits.hits + 1
      end,
      window_start = case
        when extract(epoch from (now() - rate_limits.window_start)) > ${windowSeconds}
        then now()
        else rate_limits.window_start
      end
    returning hits
  `;
  if (Number(rows[0]?.hits ?? 0) > limit) {
    throw new Error("Too many attempts. Try again in a few minutes.");
  }
}
