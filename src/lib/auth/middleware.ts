import { createMiddleware } from "@tanstack/react-start";

export const authMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("./client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    const { assertSameSiteRequest } = await import("./isolation.server");
    const { requireUserId } = await import("./verify.server");
    assertSameSiteRequest();
    const userId = await requireUserId(context.bearerToken);
    try {
      const { ensureAppUserForId } = await import("../server/app-user");
      await ensureAppUserForId(userId);
    } catch (error) {
      console.error("[auth] ensureAppUser failed", {
        userId,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
    return next({ context: { userId } });
  });
