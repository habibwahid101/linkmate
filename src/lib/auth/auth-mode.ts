/**
 * Whether server functions should resolve a real Better Auth session.
 * Email/password production (broker off, no GROK_AUTH_CLIENT_ID) is still auth.
 */
export function isAuthConfigured(input: {
  viteAuthEnabled: string | undefined;
  grokClientId: string | undefined;
  grokClientSecret: string | undefined;
  emailAndPasswordEnabled: boolean;
}): boolean {
  if (input.viteAuthEnabled === "false") return false;
  if (input.emailAndPasswordEnabled) return true;
  return Boolean(input.grokClientId && input.grokClientSecret);
}
