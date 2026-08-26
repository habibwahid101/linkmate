import { createFileRoute } from "@tanstack/react-router";
import { dbSource, getSql } from "@/lib/db";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const sql = await getSql();
          await sql`select 1 as ok`;
          return Response.json({
            ok: true,
            db: dbSource === "neon" ? "postgres" : "pglite",
          });
        } catch {
          return Response.json({ ok: false }, { status: 503 });
        }
      },
    },
  },
});
