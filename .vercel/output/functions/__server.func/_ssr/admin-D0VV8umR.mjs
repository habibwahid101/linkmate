import { t as cn } from "./utils-DoUG08GZ.mjs";
import { n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as Wordmark } from "./logo-CGasuG15.mjs";
import { f as useRouterState, h as Outlet, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as getShell } from "./profile-DfbQm7Sx.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { t as RequireAuth } from "./guards-BCi79ugw.mjs";
import { C as ChartColumn, T as ArrowLeft, _ as ClipboardList, c as Settings, d as Layers, f as IdCard, h as Gauge, l as Receipt, m as GitFork, n as Wallet, o as Shield, r as Users, v as CirclePause, w as Bell, y as CircleDollarSign } from "../_libs/lucide-react.mjs";
import { t as NoAccess } from "./query-error-BXK5eab1.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-D0VV8umR.js
var import_jsx_runtime = require_jsx_runtime();
var items = [
	{
		to: "/admin",
		label: "Overview",
		icon: Gauge
	},
	{
		to: "/admin/users",
		label: "Users",
		icon: Users
	},
	{
		to: "/admin/ids",
		label: "IDs",
		icon: IdCard
	},
	{
		to: "/admin/packages",
		label: "Packages",
		icon: Layers
	},
	{
		to: "/admin/purchases",
		label: "Purchases",
		icon: Receipt
	},
	{
		to: "/admin/network",
		label: "Network",
		icon: GitFork
	},
	{
		to: "/admin/levels",
		label: "Levels",
		icon: Shield
	},
	{
		to: "/admin/commissions",
		label: "Commissions",
		icon: CircleDollarSign
	},
	{
		to: "/admin/held",
		label: "Held",
		icon: CirclePause
	},
	{
		to: "/admin/wallets",
		label: "Wallets",
		icon: Wallet
	},
	{
		to: "/admin/transactions",
		label: "Transactions",
		icon: ClipboardList
	},
	{
		to: "/admin/reports",
		label: "Reports",
		icon: ChartColumn
	},
	{
		to: "/admin/notifications",
		label: "Notifications",
		icon: Bell
	},
	{
		to: "/admin/settings",
		label: "Settings",
		icon: Settings
	},
	{
		to: "/admin/audit",
		label: "Audit logs",
		icon: ClipboardList
	}
];
function AdminShell({ children }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-ink",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col border-r border-border bg-surface lg:flex",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex h-16 items-center px-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted",
					children: "Administration"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "flex-1 overflow-y-auto px-2 pb-4",
					children: items.map((item) => {
						const Icon = item.icon;
						const active = item.to === "/admin" ? pathname === "/admin" || pathname === "/admin/" : pathname === item.to || pathname.startsWith(item.to + "/");
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: item.to,
							className: cn("mb-0.5 flex h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-medium", active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-ink"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
								className: "size-4",
								strokeWidth: 1.75
							}), item.label]
						}, item.to);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/app",
					className: "m-3 flex h-10 items-center gap-2 rounded-[10px] px-2.5 text-sm text-muted hover:bg-surface-2 hover:text-ink",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" }), "Member app"]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "lg:pl-[220px]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur-md lg:px-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: "Admin"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/app",
						className: "text-sm text-muted hover:text-ink",
						children: "Back to app"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "lg:hidden overflow-x-auto border-b border-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex min-w-max gap-1 px-3 py-2",
						children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: item.to,
							className: cn("rounded-full px-3 py-1.5 text-xs font-medium", pathname === item.to ? "bg-ink text-bg" : "bg-surface-2 text-muted"),
							children: item.label
						}, item.to))
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: "mx-auto w-full max-w-6xl px-4 py-5 lg:px-8 lg:py-8",
					children
				})
			]
		})]
	});
}
function AdminLayout() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RequireAuth, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminFrame, {}) });
}
function AdminFrame() {
	const shell = useQuery({
		queryKey: ["shell"],
		queryFn: () => getShell()
	});
	if (shell.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-dvh bg-bg p-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {})
	});
	if (shell.data?.profile.role !== "admin") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-md px-4 py-16",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoAccess, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-center",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/app",
				className: "text-sm font-medium text-accent underline-offset-4 hover:underline",
				children: "Back to app"
			})
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) });
}
//#endregion
export { AdminLayout as component };
