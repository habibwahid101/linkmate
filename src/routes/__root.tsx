import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { queryClient } from "@/lib/query";
import { Toaster } from "sonner";
import "../styles.css";

const APP_NAME = "Link Mate";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&display=swap";

/** Unlayered canvas + @layer base resets so Tailwind utilities still win after load. */
const CRITICAL_CSS = [
  ":root{",
  "--color-bg:#f3f1ec;--color-surface:#fffcf7;--color-ink:#161513;--color-muted:#6b6560;",
  "--color-accent:#1f4d45;--color-accent-fg:#f3f1ec;--color-accent-hover:#173b35;--color-accent-soft:#e4eeeb;",
  "--color-border:#e4dfd6;--color-sidebar:#161513;--color-sidebar-fg:#f3f1ec;--color-sidebar-muted:#a8a29a;",
  "--font-sans:Manrope,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif",
  "}",
  "html{color-scheme:light;-webkit-text-size-adjust:100%}",
  "html,body{background:var(--color-bg);color:var(--color-ink);margin:0;min-height:100%}",
  "body{font-family:var(--font-sans);line-height:1.5}",
  "@layer base{",
  "a{color:inherit;text-decoration:none}",
  "button,input,select,textarea{font:inherit}",
  "button{-webkit-appearance:none;appearance:none}",
  "img,svg,video,canvas{max-width:100%;height:auto;display:block}",
  "}",
].join("");

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#161513" },
      { name: "application-name", content: APP_NAME },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      {
        name: "description",
        content: "Link Mate membership from ৳11,000. Sponsor 3 and complete Level 9 to qualify for 1 Decimal Land, subject to allocation terms.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "manifest", href: "/__grok/manifest.webmanifest?v=2" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      { rel: "preload", href: FONT_HREF, as: "style" },
    ],
  }),
  component: Root,
});

function Root() {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }} />
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{var l=document.createElement("link");l.rel="stylesheet";l.href=${JSON.stringify(FONT_HREF)};document.head.appendChild(l);})();`,
          }}
        />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <Outlet />
            <Toaster
              position="top-center"
              toastOptions={{
                className: "font-sans",
              }}
            />
          </QueryClientProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
