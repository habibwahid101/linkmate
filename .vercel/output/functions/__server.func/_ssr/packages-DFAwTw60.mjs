import { n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { t as Card } from "./card-sZv3V7Vz.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { t as formatBdt } from "./money-6FOdTEDf.mjs";
import { t as adminGetSettings } from "./admin-eHL1f1F4.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { t as Badge } from "./badge-S67-CHGd.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/packages-DFAwTw60.js
var import_jsx_runtime = require_jsx_runtime();
function Packages() {
	const q = useQuery({
		queryKey: ["admin", "settings"],
		queryFn: () => adminGetSettings()
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Packages",
		hint: "Locked amounts and ID counts cannot be edited casually. Changes require versioning and an audit log."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid gap-3 sm:grid-cols-2",
		children: q.data.packages.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-semibold",
					children: p.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: p.locked ? "locked" : "accent",
					children: p.locked ? "Locked" : "Editable"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 tabular text-2xl font-semibold",
				children: formatBdt(p.amount_bdt)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-sm text-muted",
				children: [
					p.id_count,
					" IDs · placement ",
					p.placement_rule_version,
					" · ",
					p.active ? "Active" : "Inactive"
				]
			})
		] }, p.id))
	})] });
}
//#endregion
export { Packages as component };
