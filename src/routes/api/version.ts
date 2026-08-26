import { createFileRoute } from "@tanstack/react-router";
import { publicBuildFingerprint } from "@/lib/version";

export const Route = createFileRoute("/api/version")({
  server: {
    handlers: {
      GET: () => Response.json(publicBuildFingerprint()),
    },
  },
});
