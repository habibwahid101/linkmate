import { o as __toESM } from "../_runtime.mjs";
import { n as initials, t as cn } from "./utils-DoUG08GZ.mjs";
import { a as require_react, n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as Wordmark } from "./logo-CGasuG15.mjs";
import { f as useRouterState, h as Outlet, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as getShell } from "./profile-DfbQm7Sx.mjs";
import { i as signOut } from "./client-B40BzJxt.mjs";
import { t as useCurrentUser } from "./use-current-user-DG6UNzh9.mjs";
import { t as RequireAuth } from "./guards-BCi79ugw.mjs";
import { d as Layers, i as UserRound, n as Wallet, o as Shield, p as House, r as Users, s as Share2, u as LogOut, w as Bell } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app-D33wIA_U.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var nav = [
	{
		to: "/app",
		label: "Home",
		icon: House
	},
	{
		to: "/app/team",
		label: "Team",
		icon: Users
	},
	{
		to: "/app/packages",
		label: "Packages",
		icon: Layers
	},
	{
		to: "/app/wallet",
		label: "Wallet",
		icon: Wallet
	},
	{
		to: "/app/profile",
		label: "Profile",
		icon: UserRound
	}
];
function isActive(pathname, to) {
	if (to === "/app") return pathname === "/app" || pathname === "/app/";
	return pathname === to || pathname.startsWith(to + "/");
}
function AppShell({ children, unread = 0, isAdmin = false }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const user = useCurrentUser();
	const [signingOut, setSigningOut] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-ink",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col bg-sidebar text-sidebar-fg lg:flex",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex h-16 items-center px-5",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/app",
							"aria-label": "Link Mate home",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, { invert: true })
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						className: "flex flex-1 flex-col gap-0.5 px-3 py-2",
						children: [
							nav.map((item) => {
								const Icon = item.icon;
								const active = isActive(pathname, item.to);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: item.to,
									className: cn("flex h-11 items-center gap-3 rounded-[12px] px-3 text-sm font-medium transition-colors", active ? "bg-white/10 text-white" : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-fg"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
										className: "size-5",
										strokeWidth: 1.75
									}), item.label]
								}, item.to);
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/app/invite",
								className: "mt-3 flex h-11 items-center gap-3 rounded-[12px] bg-white/8 px-3 text-sm font-medium text-sidebar-fg hover:bg-white/12",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, {
									className: "size-5",
									strokeWidth: 1.75
								}), "Invite"]
							}),
							isAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/admin",
								className: "mt-1 flex h-11 items-center gap-3 rounded-[12px] px-3 text-sm font-medium text-sidebar-muted hover:bg-white/5 hover:text-sidebar-fg",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, {
									className: "size-5",
									strokeWidth: 1.75
								}), "Admin"]
							}) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "border-t border-white/8 p-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "grid size-9 place-items-center rounded-full bg-white/10 text-xs font-semibold",
									children: initials(user?.displayName)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "truncate text-sm font-medium",
										children: user?.displayName ?? "Member"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "truncate text-xs text-sidebar-muted",
										children: user?.primaryEmail
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": "Sign out",
									disabled: signingOut,
									onClick: () => {
										setSigningOut(true);
										signOut("/login").catch(() => setSigningOut(false));
									},
									className: "grid size-9 place-items-center rounded-[10px] text-sidebar-muted hover:bg-white/8 hover:text-sidebar-fg",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "size-4" })
								})
							]
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "lg:pl-[240px]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur-md lg:h-16 lg:px-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "lg:hidden",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, { compact: true })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "hidden text-sm text-muted lg:block",
							children: "Membership · Generation commission"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/app/notifications",
								className: "relative grid size-11 place-items-center rounded-[12px] hover:bg-surface-2",
								"aria-label": "Notifications",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, {
									className: "size-5",
									strokeWidth: 1.75
								}), unread > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute top-2.5 right-2.5 size-2 rounded-full bg-accent" }) : null]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/app/invite",
								className: "hidden h-9 items-center rounded-full bg-accent px-3.5 text-sm font-medium text-accent-fg sm:inline-flex",
								children: "Invite"
							})]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: "safe-bottom mx-auto w-full max-w-6xl px-4 py-5 lg:px-8 lg:py-8 lg:pb-8",
					children
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden",
				style: { paddingBottom: "env(safe-area-inset-bottom)" },
				"aria-label": "Primary",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "grid grid-cols-5",
					children: nav.map((item) => {
						const Icon = item.icon;
						const active = isActive(pathname, item.to);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: item.to,
							className: cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-accent" : "text-muted"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
								className: "size-5",
								strokeWidth: active ? 2 : 1.75
							}), item.label]
						}) }, item.to);
					})
				})
			})
		]
	});
}
function AppLayout() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RequireAuth, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppFrame, {}) });
}
function AppFrame() {
	const shell = useQuery({
		queryKey: ["shell"],
		queryFn: () => getShell()
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		unread: shell.data?.unread ?? 0,
		isAdmin: shell.data?.profile.role === "admin",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
	});
}
//#endregion
export { AppLayout as component };
