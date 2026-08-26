import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { assertRateLimit } from "@/lib/server/rate-limit";

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

async function limited(request: Request): Promise<Response> {
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
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => limited(request),
    },
  },
});
