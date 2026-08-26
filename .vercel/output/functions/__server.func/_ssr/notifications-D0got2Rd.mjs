import { n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { o as adminListNotifications } from "./admin-eHL1f1F4.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { n as formatDateTime } from "./format-CmMzfBY6.mjs";
import { t as Badge } from "./badge-S67-CHGd.mjs";
import { t as AdminList } from "./admin-list-DTK14s8m.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/notifications-D0got2Rd.js
var import_jsx_runtime = require_jsx_runtime();
function Notes() {
	const q = useQuery({
		queryKey: ["admin", "notes"],
		queryFn: () => adminListNotifications()
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, { title: "Notifications" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminList, {
		rows: q.data,
		columns: [
			{
				key: "who",
				label: "User",
				render: (r) => r.display_name
			},
			{
				key: "title",
				label: "Title",
				render: (r) => r.title
			},
			{
				key: "kind",
				label: "Kind",
				render: (r) => r.kind
			},
			{
				key: "read",
				label: "Read",
				render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: r.read ? "locked" : "accent",
					children: r.read ? "Read" : "Unread"
				})
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
export { Notes as component };
