import { t as cn } from "./utils-DoUG08GZ.mjs";
import { i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { t as Button } from "./button-CQhsxzrh.mjs";
import { i as listNotifications, o as markNotificationRead } from "./profile-DfbQm7Sx.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { n as formatDateTime } from "./format-CmMzfBY6.mjs";
import { t as EmptyState } from "./empty-state-B7IVxP4j.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/notifications-I2gP7nMK.js
var import_jsx_runtime = require_jsx_runtime();
function Notifications() {
	const qc = useQueryClient();
	const q = useQuery({
		queryKey: ["notifications"],
		queryFn: () => listNotifications()
	});
	const mark = useMutation({
		mutationFn: (id) => markNotificationRead({ data: { id } }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["notifications"] });
			qc.invalidateQueries({ queryKey: ["shell"] });
		}
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Notifications",
		action: q.data.some((n) => !n.read) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			size: "sm",
			variant: "ghost",
			onClick: () => mark.mutate(void 0),
			children: "Mark all read"
		}) : null
	}), q.data.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
		title: "You’re all caught up",
		body: "We’ll notify you when members join, levels complete, and commission releases to your wallet."
	}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "space-y-2",
		children: q.data.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => !n.read && mark.mutate(n.id),
			className: cn("w-full rounded-2xl bg-surface p-4 text-left shadow-[var(--shadow-card)]", !n.read && "shadow-[0_0_0_1px_var(--color-accent)]"),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-semibold",
					children: n.title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted",
					children: n.body
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-xs text-subtle",
					children: formatDateTime(n.created_at)
				})
			]
		}) }, n.id))
	})] });
}
//#endregion
export { Notifications as component };
