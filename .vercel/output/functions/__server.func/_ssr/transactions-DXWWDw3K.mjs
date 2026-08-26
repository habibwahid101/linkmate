import { n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { n as toInt, t as formatBdt } from "./money-6FOdTEDf.mjs";
import { c as adminListTransactions } from "./admin-eHL1f1F4.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { n as formatDateTime } from "./format-CmMzfBY6.mjs";
import { t as StatusBadge } from "./status-badge-BnPZKVzI.mjs";
import { t as AdminList } from "./admin-list-DTK14s8m.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/transactions-DXWWDw3K.js
var import_jsx_runtime = require_jsx_runtime();
function Tx() {
	const q = useQuery({
		queryKey: ["admin", "tx"],
		queryFn: () => adminListTransactions()
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, { title: "Transactions" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminList, {
		rows: q.data,
		columns: [
			{
				key: "id",
				label: "Tx",
				render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs",
					children: r.id.slice(0, 8)
				})
			},
			{
				key: "mid",
				label: "ID",
				render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs",
					children: r.member_id
				})
			},
			{
				key: "type",
				label: "Type",
				render: (r) => r.type
			},
			{
				key: "amt",
				label: "Amount",
				render: (r) => formatBdt(toInt(r.amount))
			},
			{
				key: "src",
				label: "Source",
				render: (r) => r.source
			},
			{
				key: "st",
				label: "Status",
				render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: r.status })
			},
			{
				key: "date",
				label: "Date",
				render: (r) => formatDateTime(r.created_at)
			}
		]
	})] });
}
//#endregion
export { Tx as component };
