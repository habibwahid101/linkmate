import { createFileRoute } from "@tanstack/react-router";
import { pingReadiness } from "@/lib/health";

export const Route = createFileRoute("/api/readiness")({
  server: {
    handlers: {
      GET: async () => {
        const result = await pingReadiness();
        return Response.json(result.body, { status: result.status });
      },
    },
  },
});
