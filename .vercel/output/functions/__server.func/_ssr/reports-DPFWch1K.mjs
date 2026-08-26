import { n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { t as Card } from "./card-sZv3V7Vz.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { n as toInt, t as formatBdt } from "./money-6FOdTEDf.mjs";
import { f as adminReports } from "./admin-eHL1f1F4.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { r as packageLabel } from "./format-CmMzfBY6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/reports-DPFWch1K.js
var import_jsx_runtime = require_jsx_runtime();
function Reports() {
	const q = useQuery({
		queryKey: ["admin", "reports"],
		queryFn: () => adminReports()
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	const liab = q.data.liability;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, { title: "Reports" }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-3 sm:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs uppercase tracking-wider text-muted",
					children: "Held liability"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 tabular text-xl font-semibold",
					children: formatBdt(toInt(liab?.held))
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs uppercase tracking-wider text-muted",
					children: "Released"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 tabular text-xl font-semibold",
					children: formatBdt(toInt(liab?.released))
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs uppercase tracking-wider text-muted",
					children: "Available wallets"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 tabular text-xl font-semibold",
					children: formatBdt(toInt(liab?.available))
				})] })
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mt-8 text-sm font-semibold",
			children: "Package sales"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 space-y-2",
			children: q.data.sales.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "flex justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-sm",
					children: packageLabel(s.package_id)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "tabular text-sm font-medium",
					children: [
						s.n,
						" · ",
						formatBdt(toInt(s.value))
					]
				})]
			}, s.package_id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mt-8 text-sm font-semibold",
			children: "User growth"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 space-y-1",
			children: q.data.growth.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex justify-between text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted",
					children: g.day
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "tabular",
					children: g.n
				})]
			}, g.day))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mt-8 text-sm font-semibold",
			children: "ID creation"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 space-y-1",
			children: q.data.idGrowth.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex justify-between text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted",
					children: g.day
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "tabular",
					children: g.n
				})]
			}, g.day))
		})
	] });
}
//#endregion
export { Reports as component };
