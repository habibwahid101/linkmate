import { n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { n as toInt, t as formatBdt } from "./money-6FOdTEDf.mjs";
import { s as adminListPurchases } from "./admin-eHL1f1F4.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { r as packageLabel, t as formatDate } from "./format-CmMzfBY6.mjs";
import { t as StatusBadge } from "./status-badge-BnPZKVzI.mjs";
import { t as AdminList } from "./admin-list-DTK14s8m.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/purchases-Be6bGTli.js
var import_jsx_runtime = require_jsx_runtime();
function Purchases() {
	const q = useQuery({
		queryKey: ["admin", "purchases"],
		queryFn: () => adminListPurchases()
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, { title: "Purchases" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminList, {
		rows: q.data,
		columns: [
			{
				key: "pkg",
				label: "Package",
				render: (r) => packageLabel(r.package_id)
			},
			{
				key: "who",
				label: "Member",
				render: (r) => r.display_name
			},
			{
				key: "amt",
				label: "Amount",
				render: (r) => formatBdt(toInt(r.amount_bdt))
			},
			{
				key: "ids",
				label: "IDs",
				render: (r) => r.id_count
			},
			{
				key: "root",
				label: "Root",
				render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs",
					children: r.root_id ?? "—"
				})
			},
			{
				key: "st",
				label: "Payment",
				render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: r.payment_status })
			},
			{
				key: "date",
				label: "Date",
				render: (r) => formatDate(r.created_at)
			}
		]
	})] });
}
//#endregion
export { Purchases as component };
