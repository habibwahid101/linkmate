import { n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { n as toInt, t as formatBdt } from "./money-6FOdTEDf.mjs";
import { i as adminListCommissions } from "./admin-eHL1f1F4.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { n as formatDateTime } from "./format-CmMzfBY6.mjs";
import { t as AdminList } from "./admin-list-DTK14s8m.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/held-MseQvBjm.js
var import_jsx_runtime = require_jsx_runtime();
function Held() {
	const q = useQuery({
		queryKey: [
			"admin",
			"commissions",
			"HELD"
		],
		queryFn: () => adminListCommissions({ data: { status: "HELD" } })
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	const total = q.data.reduce((s, r) => s + toInt(r.commission_amount), 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Held commissions",
		hint: `Liability ${formatBdt(total)}. Nothing here is in a member wallet yet.`
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminList, {
		rows: q.data,
		empty: "No held commission.",
		columns: [
			{
				key: "ben",
				label: "Beneficiary",
				render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs",
					children: r.beneficiary_id
				})
			},
			{
				key: "src",
				label: "Source",
				render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs",
					children: r.source_id
				})
			},
			{
				key: "lv",
				label: "Level",
				render: (r) => `L${r.level}`
			},
			{
				key: "amt",
				label: "Amount",
				render: (r) => formatBdt(toInt(r.commission_amount))
			},
			{
				key: "date",
				label: "Held at",
				render: (r) => formatDateTime(r.held_at)
			}
		]
	})] });
}
//#endregion
export { Held as component };
