import { o as __toESM } from "../_runtime.mjs";
import { a as require_react, n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { n as toInt, t as formatBdt } from "./money-6FOdTEDf.mjs";
import { i as adminListCommissions } from "./admin-eHL1f1F4.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { n as formatDateTime } from "./format-CmMzfBY6.mjs";
import { t as StatusBadge } from "./status-badge-BnPZKVzI.mjs";
import { t as AdminList } from "./admin-list-DTK14s8m.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/commissions-D0mVLiV3.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Commissions() {
	const [status, setStatus] = (0, import_react.useState)();
	const q = useQuery({
		queryKey: [
			"admin",
			"commissions",
			status
		],
		queryFn: () => adminListCommissions({ data: { status } })
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Commissions",
			hint: "Ledger entries. Duplicate join events are rejected by event_id."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-4 flex gap-2",
			children: [
				"",
				"HELD",
				"RELEASED",
				"REVERSED"
			].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => setStatus(s || void 0),
				className: "rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium",
				children: s || "All"
			}, s || "all"))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminList, {
			rows: q.data,
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
					render: (r) => `L${r.level} G${r.generation}`
				},
				{
					key: "amt",
					label: "Amount",
					render: (r) => formatBdt(toInt(r.commission_amount))
				},
				{
					key: "st",
					label: "Status",
					render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: r.status })
				},
				{
					key: "date",
					label: "Held",
					render: (r) => formatDateTime(r.held_at)
				}
			]
		})
	] });
}
//#endregion
export { Commissions as component };
