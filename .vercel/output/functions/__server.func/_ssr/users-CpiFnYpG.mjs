import { i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { l as adminListUsers, p as adminSetRole } from "./admin-eHL1f1F4.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { t as formatDate } from "./format-CmMzfBY6.mjs";
import { t as Badge } from "./badge-S67-CHGd.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as AdminList } from "./admin-list-DTK14s8m.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/users-CpiFnYpG.js
var import_jsx_runtime = require_jsx_runtime();
function Users() {
	const qc = useQueryClient();
	const q = useQuery({
		queryKey: ["admin", "users"],
		queryFn: () => adminListUsers()
	});
	const role = useMutation({
		mutationFn: (p) => adminSetRole({ data: p }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["admin", "users"] });
			toast.success("Role updated");
		},
		onError: (e) => toast.error(e.message)
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Users",
		hint: "First real account is granted admin. Role changes are audited."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminList, {
		rows: q.data.map((u) => ({
			...u,
			id: u.user_id
		})),
		columns: [
			{
				key: "name",
				label: "Name",
				render: (r) => r.display_name
			},
			{
				key: "email",
				label: "Email",
				render: (r) => r.email ?? "—"
			},
			{
				key: "role",
				label: "Role",
				render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "underline-offset-2 hover:underline",
					onClick: () => role.mutate({
						userId: r.user_id,
						role: r.role === "admin" ? "member" : "admin"
					}),
					children: r.role
				})
			},
			{
				key: "ids",
				label: "IDs",
				render: (r) => r.id_count
			},
			{
				key: "ref",
				label: "Referral",
				render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs",
					children: r.referral_code
				})
			},
			{
				key: "syn",
				label: "Type",
				render: (r) => r.is_synthetic ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: "locked",
					children: "Simulated"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: "accent",
					children: "Member"
				})
			},
			{
				key: "date",
				label: "Joined",
				hideOnMobile: true,
				render: (r) => formatDate(r.created_at)
			}
		]
	})] });
}
//#endregion
export { Users as component };
