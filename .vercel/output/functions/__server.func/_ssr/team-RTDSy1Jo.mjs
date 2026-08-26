import { o as __toESM } from "../_runtime.mjs";
import { a as require_react, i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { t as Button } from "./button-CQhsxzrh.mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { b as ChevronRight, x as ChevronDown } from "../_libs/lucide-react.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { l as ordinalGeneration } from "./rules-D1_lUvHP.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { r as packageLabel, t as formatDate } from "./format-CmMzfBY6.mjs";
import { t as StatusBadge } from "./status-badge-BnPZKVzI.mjs";
import { a as getTeam, s as listMyIds, u as simulateDirectJoin } from "./member-D11Yn6Ku.mjs";
import { t as EmptyState } from "./empty-state-B7IVxP4j.mjs";
import { t as ProgressBar } from "./progress-bar-QyQB3OUv.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as Label, t as Input } from "./input-b2DQ3LwD.mjs";
import { t as Modal } from "./modal-BkVPnIn5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/team-RTDSy1Jo.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Team() {
	const qc = useQueryClient();
	const team = useQuery({
		queryKey: ["team"],
		queryFn: () => getTeam()
	});
	const ids = useQuery({
		queryKey: ["ids"],
		queryFn: () => listMyIds()
	});
	const [openGen, setOpenGen] = (0, import_react.useState)(1);
	const [sheet, setSheet] = (0, import_react.useState)(false);
	const [name, setName] = (0, import_react.useState)("");
	const [sponsor, setSponsor] = (0, import_react.useState)("");
	const join = useMutation({
		mutationFn: () => simulateDirectJoin({ data: {
			sponsorMemberId: sponsor,
			name
		} }),
		onSuccess: (res) => {
			qc.invalidateQueries();
			toast.success(`${res.memberId} joined under ${sponsor}`);
			setSheet(false);
			setName("");
		},
		onError: (e) => toast.error(e.message)
	});
	if (team.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (team.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: team.error,
		retry: () => team.refetch()
	});
	if (!team.data.activeId) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, { title: "Team" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
		title: "No network yet",
		body: "Your Level 2 progress will appear here as your network grows.",
		action: "View packages",
		actionTo: "/app/packages"
	})] });
	const membersByGen = /* @__PURE__ */ new Map();
	for (const m of team.data.members) {
		const list = membersByGen.get(m.generation) ?? [];
		list.push(m);
		membersByGen.set(m.generation, list);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Team",
			hint: `Active ${team.data.activeId}. Generations stay in their true position.`,
			action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "sm",
				onClick: () => {
					setSponsor(team.data.activeId ?? "");
					setSheet(true);
				},
				children: "Simulate join"
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "space-y-2",
			children: team.data.levels.map((lvl) => {
				const members = membersByGen.get(lvl.generation) ?? [];
				const open = openGen === lvl.generation;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "flex w-full items-center gap-3 p-4 text-left",
						onClick: () => setOpenGen(open ? null : lvl.generation),
						children: [open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4 text-muted" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4 text-muted" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-sm font-semibold",
										children: [
											"Level ",
											lvl.level,
											" · ",
											ordinalGeneration(lvl.generation),
											" generation"
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: lvl.status })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 tabular text-sm text-muted",
									children: [
										lvl.completed_members,
										" / ",
										lvl.required_members
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProgressBar, {
									className: "mt-2",
									value: lvl.completed_members,
									max: lvl.required_members
								})
							]
						})]
					}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "border-t border-border px-4 py-3",
						children: members.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "py-4 text-sm text-muted",
							children: lvl.generation === 2 ? "Your Level 2 progress will appear here as your network grows." : "No members in this generation yet."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "divide-y divide-border",
							children: members.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-start justify-between gap-3 py-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "truncate text-sm font-medium",
											children: m.display_name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-mono text-xs text-muted",
											children: m.member_id
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "mt-0.5 text-xs text-muted",
											children: [
												packageLabel(m.package_id),
												" · ",
												formatDate(m.created_at),
												" · Sponsor ",
												m.sponsor_id ?? "—"
											]
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: m.status })]
							}, m.member_id))
						})
					}) : null]
				}, lvl.level);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-center text-sm",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/app/levels",
				className: "font-medium text-accent",
				children: "Open level progress"
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Modal, {
			open: sheet,
			onClose: () => setSheet(false),
			title: "Simulate a member join",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-4 text-sm text-muted",
				children: "Creates a Builder ID under one of your IDs so you can test commission, hold, and release."
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "sp",
						children: "Sponsor ID"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						id: "sp",
						className: "h-11 w-full rounded-[12px] bg-surface px-3.5 text-sm shadow-[0_0_0_1px_var(--color-border)]",
						value: sponsor,
						onChange: (e) => setSponsor(e.target.value),
						children: (ids.data ?? []).map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: id.id,
							children: id.id
						}, id.id))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "nm",
						children: "Member name"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "nm",
						value: name,
						onChange: (e) => setName(e.target.value),
						placeholder: "e.g. Rafi Ahmed"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "w-full",
						disabled: join.isPending || name.trim().length < 2,
						onClick: () => join.mutate(),
						children: join.isPending ? "Adding…" : "Add member"
					})
				]
			})]
		})
	] });
}
//#endregion
export { Team as component };
