import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { isPostgresUrl, requiresDurableDatabase } from "@/lib/runtime";
import { assertRateLimit } from "@/lib/server/rate-limit";

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function authUnavailable(): Response {
  return Response.json({ error: true, status: 503 }, { status: 503 });
}

function productionDbReady(): boolean {
  const get = (key: string) => process.env[key];
  if (!requiresDurableDatabase(get)) return true;
  return isPostgresUrl(get("DATABASE_URL"));
}

async function limited(request: Request): Promise<Response> {
  if (!productionDbReady()) return authUnavailable();
  const path = new URL(request.url).pathname.toLowerCase();
  const sql = await getSql();
  const ip = clientKey(request);
  const sensitive =
    path.includes("sign-up") ||
    path.includes("sign-in") ||
    path.includes("forget-password") ||
    path.includes("reset-password") ||
    path.includes("change-password");
  try {
    if (sensitive) await assertRateLimit(sql, `auth:${path}:${ip}`, 10, 600);
    else await assertRateLimit(sql, `auth:post:${ip}`, 60, 60);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Too many attempts";
    return Response.json({ error: message }, { status: 429 });
  }
  return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => (productionDbReady() ? auth.handler(request) : authUnavailable()),
      POST: ({ request }) => limited(request),
    },
  },
});
