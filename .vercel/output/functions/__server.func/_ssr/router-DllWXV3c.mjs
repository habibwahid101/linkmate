import { o as __toESM, r as __exportAll } from "../_runtime.mjs";
import { a as require_react, o as require_jsx_runtime, r as QueryClientProvider } from "../_libs/react+tanstack__react-query.mjs";
import { S as useRouter, _ as createFileRoute, d as HeadContent, g as lazyRouteComponent, h as Outlet, m as createRouter, u as Scripts, v as createRootRoute } from "../_libs/@tanstack/react-router+[...].mjs";
import { bn as union, gn as object, hn as number, pn as literal, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { a as TriangleAlert } from "../_libs/lucide-react.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { t as Toaster } from "../_libs/sonner.mjs";
import { n as auth } from "./server-CGb1ErKM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-DllWXV3c.js
var router_DllWXV3c_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: error.message || "An unexpected error occurred. Try reloading the page."
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	if (typeof window === "undefined") return () => {};
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	const parentOrigin = resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		if (envelope.data.type === "hello") {
			if (!HelloSchema.safeParse(event.data).success) return;
			announce();
			return;
		}
		if (envelope.data.type === "navigate") {
			const parsed = NavigateSchema.safeParse(event.data);
			if (!parsed.success) return;
			navigate(parsed.data.path);
			queueMicrotask(reportLocation);
			return;
		}
		if (envelope.data.type === "history") {
			const parsed = HistorySchema.safeParse(event.data);
			if (!parsed.success) return;
			if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
			window.history.go(parsed.data.delta);
		}
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var queryClient = new QueryClient({ defaultOptions: { queries: {
	staleTime: 15e3,
	retry: 1,
	refetchOnWindowFocus: false
} } });
var styles_default = "/assets/styles-CUITZ6YJ.css";
var APP_NAME = "Link Mate";
var Route$35 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover"
			},
			{ title: APP_NAME },
			{
				name: "theme-color",
				content: "#161513"
			},
			{
				name: "description",
				content: "Link Mate — package membership and generation commission, held until a level completes."
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&display=swap"
			}
		]
	}),
	component: Root
});
function Root() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		className: "antialiased",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(QueryClientProvider, {
				client: queryClient,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
					position: "top-center",
					toastOptions: { className: "font-sans" }
				})]
			}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	});
}
var $$splitComponentImporter$33 = () => import("./routes-DiIPREsP.mjs");
var Route$34 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$33, "component") });
var $$splitComponentImporter$32 = () => import("../_-CP1HsTFa.mjs");
var Route$33 = createFileRoute("/$")({ component: lazyRouteComponent($$splitComponentImporter$32, "component") });
var $$splitComponentImporter$31 = () => import("./admin-D0VV8umR.mjs");
var Route$32 = createFileRoute("/admin")({ component: lazyRouteComponent($$splitComponentImporter$31, "component") });
var $$splitComponentImporter$30 = () => import("./app-D33wIA_U.mjs");
var Route$31 = createFileRoute("/app")({ component: lazyRouteComponent($$splitComponentImporter$30, "component") });
var $$splitComponentImporter$29 = () => import("./forgot-password-D9wBnbH2.mjs");
var Route$30 = createFileRoute("/forgot-password")({ component: lazyRouteComponent($$splitComponentImporter$29, "component") });
var $$splitComponentImporter$28 = () => import("./login-bUQV4syo.mjs");
var Route$29 = createFileRoute("/login")({ component: lazyRouteComponent($$splitComponentImporter$28, "component") });
var $$splitComponentImporter$27 = () => import("./signup-BxIUftU_.mjs");
var Route$28 = createFileRoute("/signup")({ component: lazyRouteComponent($$splitComponentImporter$27, "component") });
var $$splitComponentImporter$26 = () => import("./admin-DMparne8.mjs");
var Route$27 = createFileRoute("/admin/")({ component: lazyRouteComponent($$splitComponentImporter$26, "component") });
var $$splitComponentImporter$25 = () => import("./audit-BeEceAoo.mjs");
var Route$26 = createFileRoute("/admin/audit")({ component: lazyRouteComponent($$splitComponentImporter$25, "component") });
var $$splitComponentImporter$24 = () => import("./commissions-D0mVLiV3.mjs");
var Route$25 = createFileRoute("/admin/commissions")({ component: lazyRouteComponent($$splitComponentImporter$24, "component") });
var $$splitComponentImporter$23 = () => import("./held-MseQvBjm.mjs");
var Route$24 = createFileRoute("/admin/held")({ component: lazyRouteComponent($$splitComponentImporter$23, "component") });
var $$splitComponentImporter$22 = () => import("./ids-D3G785PR.mjs");
var Route$23 = createFileRoute("/admin/ids")({ component: lazyRouteComponent($$splitComponentImporter$22, "component") });
var $$splitComponentImporter$21 = () => import("./levels-QZe1BaJx.mjs");
var Route$22 = createFileRoute("/admin/levels")({ component: lazyRouteComponent($$splitComponentImporter$21, "component") });
var $$splitComponentImporter$20 = () => import("./network-BqvU_J-u.mjs");
var Route$21 = createFileRoute("/admin/network")({ component: lazyRouteComponent($$splitComponentImporter$20, "component") });
var $$splitComponentImporter$19 = () => import("./notifications-D0got2Rd.mjs");
var Route$20 = createFileRoute("/admin/notifications")({ component: lazyRouteComponent($$splitComponentImporter$19, "component") });
var $$splitComponentImporter$18 = () => import("./packages-DFAwTw60.mjs");
var Route$19 = createFileRoute("/admin/packages")({ component: lazyRouteComponent($$splitComponentImporter$18, "component") });
var $$splitComponentImporter$17 = () => import("./purchases-Be6bGTli.mjs");
var Route$18 = createFileRoute("/admin/purchases")({ component: lazyRouteComponent($$splitComponentImporter$17, "component") });
var $$splitComponentImporter$16 = () => import("./reports-DPFWch1K.mjs");
var Route$17 = createFileRoute("/admin/reports")({ component: lazyRouteComponent($$splitComponentImporter$16, "component") });
var $$splitComponentImporter$15 = () => import("./settings-CIPPf-CY.mjs");
var Route$16 = createFileRoute("/admin/settings")({ component: lazyRouteComponent($$splitComponentImporter$15, "component") });
var $$splitComponentImporter$14 = () => import("./transactions-DXWWDw3K.mjs");
var Route$15 = createFileRoute("/admin/transactions")({ component: lazyRouteComponent($$splitComponentImporter$14, "component") });
var $$splitComponentImporter$13 = () => import("./users-CpiFnYpG.mjs");
var Route$14 = createFileRoute("/admin/users")({ component: lazyRouteComponent($$splitComponentImporter$13, "component") });
var $$splitComponentImporter$12 = () => import("./wallets-B9c5WNBq.mjs");
var Route$13 = createFileRoute("/admin/wallets")({ component: lazyRouteComponent($$splitComponentImporter$12, "component") });
var $$splitComponentImporter$11 = () => import("./app-BOpr-5w_.mjs");
var Route$12 = createFileRoute("/app/")({ component: lazyRouteComponent($$splitComponentImporter$11, "component") });
var $$splitComponentImporter$10 = () => import("./earnings-D8WDz072.mjs");
var Route$11 = createFileRoute("/app/earnings")({ component: lazyRouteComponent($$splitComponentImporter$10, "component") });
var $$splitComponentImporter$9 = () => import("./ids-kM1ryMok.mjs");
var Route$10 = createFileRoute("/app/ids")({ component: lazyRouteComponent($$splitComponentImporter$9, "component") });
var $$splitComponentImporter$8 = () => import("./invite-DL6nH0sS.mjs");
var Route$9 = createFileRoute("/app/invite")({ component: lazyRouteComponent($$splitComponentImporter$8, "component") });
var $$splitComponentImporter$7 = () => import("./levels-B7Zswyrl.mjs");
var Route$8 = createFileRoute("/app/levels")({ component: lazyRouteComponent($$splitComponentImporter$7, "component") });
var $$splitComponentImporter$6 = () => import("./notifications-I2gP7nMK.mjs");
var Route$7 = createFileRoute("/app/notifications")({ component: lazyRouteComponent($$splitComponentImporter$6, "component") });
var $$splitComponentImporter$5 = () => import("./packages-C2j-En9T.mjs");
var Route$6 = createFileRoute("/app/packages")({ component: lazyRouteComponent($$splitComponentImporter$5, "component") });
var $$splitComponentImporter$4 = () => import("./profile-hHYDemO3.mjs");
var Route$5 = createFileRoute("/app/profile")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("./settings-DvSobyQ2.mjs");
var Route$4 = createFileRoute("/app/settings")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var $$splitComponentImporter$2 = () => import("./team-RTDSy1Jo.mjs");
var Route$3 = createFileRoute("/app/team")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
var $$splitComponentImporter$1 = () => import("./transactions-CJ7oW8FX.mjs");
var Route$2 = createFileRoute("/app/transactions")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./wallet-BvXgpTXH.mjs");
var Route$1 = createFileRoute("/app/wallet")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var Route = createFileRoute("/api/auth/$")({ server: { handlers: {
	GET: ({ request }) => auth.handler(request),
	POST: ({ request }) => auth.handler(request)
} } });
var IndexRoute = Route$34.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$35
});
var SplatRoute = Route$33.update({
	id: "/$",
	path: "/$",
	getParentRoute: () => Route$35
});
var AdminRoute = Route$32.update({
	id: "/admin",
	path: "/admin",
	getParentRoute: () => Route$35
});
var AppRoute = Route$31.update({
	id: "/app",
	path: "/app",
	getParentRoute: () => Route$35
});
var ForgotPasswordRoute = Route$30.update({
	id: "/forgot-password",
	path: "/forgot-password",
	getParentRoute: () => Route$35
});
var LoginRoute = Route$29.update({
	id: "/login",
	path: "/login",
	getParentRoute: () => Route$35
});
var SignupRoute = Route$28.update({
	id: "/signup",
	path: "/signup",
	getParentRoute: () => Route$35
});
var AdminIndexRoute = Route$27.update({
	id: "/",
	path: "/",
	getParentRoute: () => AdminRoute
});
var AdminAuditRoute = Route$26.update({
	id: "/audit",
	path: "/audit",
	getParentRoute: () => AdminRoute
});
var AdminCommissionsRoute = Route$25.update({
	id: "/commissions",
	path: "/commissions",
	getParentRoute: () => AdminRoute
});
var AdminHeldRoute = Route$24.update({
	id: "/held",
	path: "/held",
	getParentRoute: () => AdminRoute
});
var AdminIdsRoute = Route$23.update({
	id: "/ids",
	path: "/ids",
	getParentRoute: () => AdminRoute
});
var AdminLevelsRoute = Route$22.update({
	id: "/levels",
	path: "/levels",
	getParentRoute: () => AdminRoute
});
var AdminNetworkRoute = Route$21.update({
	id: "/network",
	path: "/network",
	getParentRoute: () => AdminRoute
});
var AdminNotificationsRoute = Route$20.update({
	id: "/notifications",
	path: "/notifications",
	getParentRoute: () => AdminRoute
});
var AdminPackagesRoute = Route$19.update({
	id: "/packages",
	path: "/packages",
	getParentRoute: () => AdminRoute
});
var AdminPurchasesRoute = Route$18.update({
	id: "/purchases",
	path: "/purchases",
	getParentRoute: () => AdminRoute
});
var AdminReportsRoute = Route$17.update({
	id: "/reports",
	path: "/reports",
	getParentRoute: () => AdminRoute
});
var AdminSettingsRoute = Route$16.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => AdminRoute
});
var AdminTransactionsRoute = Route$15.update({
	id: "/transactions",
	path: "/transactions",
	getParentRoute: () => AdminRoute
});
var AdminUsersRoute = Route$14.update({
	id: "/users",
	path: "/users",
	getParentRoute: () => AdminRoute
});
var AdminWalletsRoute = Route$13.update({
	id: "/wallets",
	path: "/wallets",
	getParentRoute: () => AdminRoute
});
var AppIndexRoute = Route$12.update({
	id: "/",
	path: "/",
	getParentRoute: () => AppRoute
});
var AppEarningsRoute = Route$11.update({
	id: "/earnings",
	path: "/earnings",
	getParentRoute: () => AppRoute
});
var AppIdsRoute = Route$10.update({
	id: "/ids",
	path: "/ids",
	getParentRoute: () => AppRoute
});
var AppInviteRoute = Route$9.update({
	id: "/invite",
	path: "/invite",
	getParentRoute: () => AppRoute
});
var AppLevelsRoute = Route$8.update({
	id: "/levels",
	path: "/levels",
	getParentRoute: () => AppRoute
});
var AppNotificationsRoute = Route$7.update({
	id: "/notifications",
	path: "/notifications",
	getParentRoute: () => AppRoute
});
var AppPackagesRoute = Route$6.update({
	id: "/packages",
	path: "/packages",
	getParentRoute: () => AppRoute
});
var AppProfileRoute = Route$5.update({
	id: "/profile",
	path: "/profile",
	getParentRoute: () => AppRoute
});
var AppSettingsRoute = Route$4.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => AppRoute
});
var AppTeamRoute = Route$3.update({
	id: "/team",
	path: "/team",
	getParentRoute: () => AppRoute
});
var AppTransactionsRoute = Route$2.update({
	id: "/transactions",
	path: "/transactions",
	getParentRoute: () => AppRoute
});
var AppWalletRoute = Route$1.update({
	id: "/wallet",
	path: "/wallet",
	getParentRoute: () => AppRoute
});
var ApiAuthSplatRoute = Route.update({
	id: "/api/auth/$",
	path: "/api/auth/$",
	getParentRoute: () => Route$35
});
var AdminRouteChildren = {
	AdminAuditRoute,
	AdminCommissionsRoute,
	AdminHeldRoute,
	AdminIdsRoute,
	AdminLevelsRoute,
	AdminNetworkRoute,
	AdminNotificationsRoute,
	AdminPackagesRoute,
	AdminPurchasesRoute,
	AdminReportsRoute,
	AdminSettingsRoute,
	AdminTransactionsRoute,
	AdminUsersRoute,
	AdminWalletsRoute,
	AdminIndexRoute
};
var AdminRouteWithChildren = AdminRoute._addFileChildren(AdminRouteChildren);
var AppRouteChildren = {
	AppEarningsRoute,
	AppIdsRoute,
	AppInviteRoute,
	AppLevelsRoute,
	AppNotificationsRoute,
	AppPackagesRoute,
	AppProfileRoute,
	AppSettingsRoute,
	AppTeamRoute,
	AppTransactionsRoute,
	AppWalletRoute,
	AppIndexRoute
};
var rootRouteChildren = {
	IndexRoute,
	SplatRoute,
	AdminRoute: AdminRouteWithChildren,
	AppRoute: AppRoute._addFileChildren(AppRouteChildren),
	ForgotPasswordRoute,
	LoginRoute,
	SignupRoute,
	ApiAuthSplatRoute
};
var routeTree = Route$35._addFileChildren(rootRouteChildren)._addFileTypes();
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { getRouter, router_DllWXV3c_exports as t };
