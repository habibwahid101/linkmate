import { n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { t as Card } from "./card-sZv3V7Vz.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { s as fullLevelCommission } from "./rules-D1_lUvHP.mjs";
import { t as formatBdt } from "./money-6FOdTEDf.mjs";
import { t as adminGetSettings } from "./admin-eHL1f1F4.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/levels-QZe1BaJx.js
var import_jsx_runtime = require_jsx_runtime();
function Levels() {
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
		title: "Levels",
		hint: "Locked defaults. Rates and required counts are versioned in commission_rules."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-2",
		children: q.data.rules.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "flex items-center justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm font-semibold",
				children: [
					"Level ",
					r.level,
					" · ",
					r.generation_label,
					" generation"
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-muted",
				children: [
					r.required_member_count,
					" members · ",
					Number(r.rate) * 100,
					"% · v",
					r.version,
					" · ",
					r.status
				]
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "tabular text-sm font-semibold",
				children: formatBdt(fullLevelCommission(r.level))
			})]
		}, r.level))
	})] });
}
//#endregion
export { Levels as component };
