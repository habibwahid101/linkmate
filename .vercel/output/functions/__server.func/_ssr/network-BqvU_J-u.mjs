import { o as __toESM } from "../_runtime.mjs";
import { a as require_react, n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { t as Card } from "./card-sZv3V7Vz.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { d as adminNetwork } from "./admin-eHL1f1F4.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { r as packageLabel } from "./format-CmMzfBY6.mjs";
import { t as StatusBadge } from "./status-badge-BnPZKVzI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/network-BqvU_J-u.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Network() {
	const [focus, setFocus] = (0, import_react.useState)();
	const q = useQuery({
		queryKey: [
			"admin",
			"network",
			focus
		],
		queryFn: () => adminNetwork({ data: { memberId: focus } })
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Sponsor network",
			hint: "Sponsor and placement stay separate. This view follows placement plus generation of the focused ID."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-4 flex gap-2 overflow-x-auto pb-1",
			children: q.data.roots.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setFocus(r.id),
				className: "shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium",
				children: [
					r.id,
					" · ",
					r.display_name
				]
			}, r.id))
		}),
		q.data.focus ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mb-3 text-sm text-muted",
				children: ["Focus ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-ink",
					children: q.data.focus
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-4 grid grid-cols-3 gap-2 sm:grid-cols-9",
				children: q.data.progress.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-3 text-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-[11px] text-muted",
						children: ["L", p.level]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "tabular text-sm font-semibold",
						children: [
							p.completed_members,
							"/",
							p.required_members
						]
					})]
				}, p.level))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-2",
				children: q.data.children.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "py-8 text-center text-sm text-muted",
					children: "No related members."
				}) : q.data.children.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "min-w-0 text-left",
						onClick: () => setFocus(c.child_id),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-medium",
								children: c.display_name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-mono text-xs text-muted",
								children: c.child_id
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-muted",
								children: [
									packageLabel(c.package_id),
									" · parent ",
									c.parent_id,
									c.generation ? ` · gen ${c.generation}` : ""
								]
							})
						]
					}), c.generation ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: `G${c.generation}` }) : null]
				}, c.child_id))
			})
		] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "py-10 text-center text-sm text-muted",
			children: "No root IDs yet."
		})
	] });
}
//#endregion
export { Network as component };
