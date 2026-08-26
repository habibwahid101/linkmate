import { n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { r as adminListAudit } from "./admin-eHL1f1F4.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { n as formatDateTime } from "./format-CmMzfBY6.mjs";
import { t as AdminList } from "./admin-list-DTK14s8m.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/audit-BeEceAoo.js
var import_jsx_runtime = require_jsx_runtime();
function Audit() {
	const q = useQuery({
		queryKey: ["admin", "audit"],
		queryFn: () => adminListAudit()
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, { title: "Audit logs" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminList, {
		rows: q.data,
		columns: [
			{
				key: "act",
				label: "Action",
				render: (r) => r.action
			},
			{
				key: "who",
				label: "Actor",
				render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs",
					children: r.actor_user_id ?? "system"
				})
			},
			{
				key: "ent",
				label: "Entity",
				render: (r) => `${r.entity_type} ${r.entity_id ?? ""}`
			},
			{
				key: "det",
				label: "Detail",
				render: (r) => r.detail ?? "—"
			},
			{
				key: "date",
				label: "When",
				render: (r) => formatDateTime(r.created_at)
			}
		]
	})] });
}
//#endregion
export { Audit as component };
