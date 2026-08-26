import { createFileRoute } from "@tanstack/react-router";
import { pingHealth } from "@/lib/health";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const result = await pingHealth();
        return Response.json(result.body, { status: result.status });
      },
    },
  },
});
