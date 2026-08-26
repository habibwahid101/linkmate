import { n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { t as Card } from "./card-sZv3V7Vz.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { n as PACKAGES } from "./rules-D1_lUvHP.mjs";
import { t as formatBdt } from "./money-6FOdTEDf.mjs";
import { h as getAdminOverview } from "./admin-eHL1f1F4.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { r as packageLabel, t as formatDate } from "./format-CmMzfBY6.mjs";
import { t as Money } from "./money-BhNrqKnO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-DMparne8.js
var import_jsx_runtime = require_jsx_runtime();
function Kpi({ label, children, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "min-w-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium uppercase tracking-wider text-muted",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2",
				children
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted",
				children: hint
			}) : null
		]
	});
}
function Overview() {
	const q = useQuery({
		queryKey: ["admin", "overview"],
		queryFn: () => getAdminOverview()
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	const d = q.data;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Overview",
			hint: "Live membership, joining value, and commission liability."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-2 gap-3 lg:grid-cols-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
					label: "Users",
					children: d.totalUsers
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
					label: "Active IDs",
					children: d.activeIds
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
					label: "Joining value",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Money, {
						amount: d.joiningValue,
						size: "lg"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
					label: "Held commission",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Money, {
						amount: d.held,
						size: "lg"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
					label: "Released",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Money, {
						amount: d.released,
						size: "lg"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
					label: "Wallet liabilities",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Money, {
						amount: d.walletLiabilities,
						size: "lg"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
					label: "Accounts",
					hint: "Includes simulated members",
					children: d.totalAccounts
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mt-8 text-sm font-semibold",
			children: "Package distribution"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
			children: [
				"builder",
				"turbo",
				"super_turbo",
				"hyper_turbo"
			].map((id) => {
				const row = d.packages[id];
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: PACKAGES[id].name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 tabular text-xl font-semibold",
						children: [row?.count ?? 0, " sales"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted",
						children: formatBdt(row?.value ?? 0)
					})
				] }, id);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mt-8 text-sm font-semibold",
			children: "Level completions"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 grid grid-cols-3 gap-2 sm:grid-cols-9",
			children: d.levels.map((l) => {
				const n = d.completions.find((c) => c.level === l.level)?.n ?? 0;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-3 text-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-[11px] text-muted",
						children: ["L", l.level]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "tabular text-lg font-semibold",
						children: n
					})]
				}, l.level);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-8 flex items-center justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-sm font-semibold",
				children: "Recent purchases"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/admin/purchases",
				className: "text-sm font-medium text-accent",
				children: "All"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 space-y-2",
			children: d.recentPurchases.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "py-8 text-center text-sm text-muted",
				children: "No purchases yet."
			}) : d.recentPurchases.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-medium",
					children: packageLabel(p.package_id)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted",
					children: formatDate(p.created_at)
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "tabular text-sm font-semibold",
					children: formatBdt(p.amount_bdt)
				})]
			}, p.id))
		})
	] });
}
//#endregion
export { Overview as component };
