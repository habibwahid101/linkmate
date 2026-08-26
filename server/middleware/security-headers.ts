/**
 * Baseline security headers for production. CSP is report-tolerant and allows
 * the existing Grok PWA injector + Google fonts used by the app.
 */
export default async function securityHeadersMiddleware(
  _event: unknown,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const response = await next();
  if (!(response instanceof Response)) return response;
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (!headers.has("Content-Security-Policy")) {
    headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://grok.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https:",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    );
  }
  if (process.env.APP_ENV === "production") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
