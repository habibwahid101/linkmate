import { n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { a as adminListIds } from "./admin-eHL1f1F4.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { r as packageLabel, t as formatDate } from "./format-CmMzfBY6.mjs";
import { t as StatusBadge } from "./status-badge-BnPZKVzI.mjs";
import { t as AdminList } from "./admin-list-DTK14s8m.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ids-D3G785PR.js
var import_jsx_runtime = require_jsx_runtime();
function Ids() {
	const q = useQuery({
		queryKey: ["admin", "ids"],
		queryFn: () => adminListIds()
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, { title: "IDs" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminList, {
		rows: q.data,
		columns: [
			{
				key: "id",
				label: "ID",
				render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs",
					children: r.id
				})
			},
			{
				key: "owner",
				label: "Owner",
				render: (r) => r.display_name
			},
			{
				key: "pkg",
				label: "Package",
				render: (r) => packageLabel(r.package_id)
			},
			{
				key: "sp",
				label: "Sponsor",
				render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs",
					children: r.sponsor_id ?? "—"
				})
			},
			{
				key: "parent",
				label: "Parent",
				render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs",
					children: r.parent_id ?? "—"
				})
			},
			{
				key: "place",
				label: "Placement",
				render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: r.placement_status })
			},
			{
				key: "st",
				label: "Status",
				render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: r.status })
			},
			{
				key: "date",
				label: "Created",
				render: (r) => formatDate(r.created_at)
			}
		]
	})] });
}
//#endregion
export { Ids as component };
