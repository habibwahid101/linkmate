import { i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { t as Button } from "./button-CQhsxzrh.mjs";
import { s as setActiveId } from "./profile-DfbQm7Sx.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { t as Card } from "./card-sZv3V7Vz.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { r as packageLabel, t as formatDate } from "./format-CmMzfBY6.mjs";
import { t as Money } from "./money-BhNrqKnO.mjs";
import { t as StatusBadge } from "./status-badge-BnPZKVzI.mjs";
import { s as listMyIds, t as getDashboard } from "./member-D11Yn6Ku.mjs";
import { t as EmptyState } from "./empty-state-B7IVxP4j.mjs";
import { n as toast } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ids-kM1ryMok.js
var import_jsx_runtime = require_jsx_runtime();
function Ids() {
	const qc = useQueryClient();
	const ids = useQuery({
		queryKey: ["ids"],
		queryFn: () => listMyIds()
	});
	const dash = useQuery({
		queryKey: ["dashboard"],
		queryFn: () => getDashboard()
	});
	const activate = useMutation({
		mutationFn: (memberId) => setActiveId({ data: { memberId } }),
		onSuccess: () => {
			qc.invalidateQueries();
			toast.success("Active ID updated");
		},
		onError: (e) => toast.error(e.message)
	});
	if (ids.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (ids.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: ids.error,
		retry: () => ids.refetch()
	});
	if (ids.data.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "My IDs",
		hint: "IDs are created when you buy a package."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
		title: "No IDs yet",
		body: "Choose a package to issue your first membership ID.",
		action: "View packages",
		actionTo: "/app/packages"
	})] });
	const active = dash.data?.activeId;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "My IDs",
		hint: "Switch the active ID to see its level, team, and commission."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid gap-3 lg:grid-cols-2",
		children: ids.data.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: row.id === active ? "shadow-[0_0_0_2px_var(--color-accent)]" : void 0,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-sm font-semibold",
						children: row.id
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-0.5 text-sm text-muted",
						children: [packageLabel(row.package_id), row.is_root ? " · Root" : ""]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: row.placement_status === "pending_config" ? "pending_config" : row.status })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
					className: "mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-xs text-muted",
							children: "Sponsor"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
							className: "font-mono text-xs",
							children: row.sponsor_id ?? "—"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-xs text-muted",
							children: "Parent"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
							className: "font-mono text-xs",
							children: row.parent_id ?? "—"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-xs text-muted",
							children: "Created"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: formatDate(row.created_at) })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-xs text-muted",
							children: "Level"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", { children: ["Level ", row.currentLevel] })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-xs text-muted",
							children: "Held"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Money, {
							amount: row.held,
							size: "sm"
						}) })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-xs text-muted",
							children: "Available"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Money, {
							amount: row.available,
							size: "sm"
						}) })] })
					]
				}),
				row.placement_status === "pending_config" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-xs text-warning",
					children: "Internal placement is configurable. This ID is owned but not yet placed in the generation tree."
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "mt-4 w-full",
					variant: row.id === active ? "secondary" : "primary",
					disabled: row.id === active || activate.isPending,
					onClick: () => activate.mutate(row.id),
					children: row.id === active ? "Active ID" : "Make active"
				})
			]
		}, row.id))
	})] });
}
//#endregion
export { Ids as component };
