import { i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { t as Button } from "./button-CQhsxzrh.mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { n as CardTitle, t as Card } from "./card-sZv3V7Vz.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { n as PACKAGES } from "./rules-D1_lUvHP.mjs";
import { t as formatBdt } from "./money-6FOdTEDf.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { r as packageLabel, t as formatDate } from "./format-CmMzfBY6.mjs";
import { t as Money } from "./money-BhNrqKnO.mjs";
import { t as StatusBadge } from "./status-badge-BnPZKVzI.mjs";
import { c as loadSampleNetwork, t as getDashboard } from "./member-D11Yn6Ku.mjs";
import { t as EmptyState } from "./empty-state-B7IVxP4j.mjs";
import { t as ProgressBar } from "./progress-bar-QyQB3OUv.mjs";
import { n as LevelKpi, t as LevelCard } from "./level-card-DYPMSosc.mjs";
import { n as toast } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app-BOpr-5w_.js
var import_jsx_runtime = require_jsx_runtime();
function Home() {
	const qc = useQueryClient();
	const dash = useQuery({
		queryKey: ["dashboard"],
		queryFn: () => getDashboard()
	});
	const sample = useMutation({
		mutationFn: () => loadSampleNetwork(),
		onSuccess: () => {
			qc.invalidateQueries();
			toast.success("Turbo sample network loaded");
		},
		onError: (e) => toast.error(e.message)
	});
	if (dash.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (dash.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: dash.error,
		retry: () => dash.refetch()
	});
	const d = dash.data;
	const pkg = d.latestPackage ? PACKAGES[d.latestPackage] : null;
	const next = d.nextMilestone;
	if (!d.activeId) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: `Hello, ${d.profile.displayName.split(" ")[0]}`,
			hint: "Choose a package to receive your first ID."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
			title: "No membership yet",
			body: "Buy a package to create IDs, or load a Turbo sample to see Level 1 released and Level 2 in progress.",
			action: "View packages",
			actionTo: "/app/packages"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			className: "mt-4 w-full sm:w-auto",
			variant: "outline",
			disabled: sample.isPending,
			onClick: () => sample.mutate(),
			children: sample.isPending ? "Loading sample…" : "Load Turbo sample network"
		})
	] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: d.profile.displayName,
			hint: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
				d.activeId,
				" · ",
				pkg?.name ?? "Member"
			] })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-2 gap-3 lg:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LevelKpi, {
					label: "My package",
					value: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-2xl font-semibold tracking-tight",
						children: pkg?.name ?? "—"
					}),
					hint: pkg ? `${pkg.idCount} IDs` : void 0
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LevelKpi, {
					label: "My IDs",
					value: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-2xl font-semibold tracking-tight tabular",
						children: d.ids.length
					}),
					hint: d.activeId
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LevelKpi, {
					label: "Current level",
					value: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-2xl font-semibold tracking-tight",
						children: ["Level ", d.currentLevel]
					}),
					hint: `${d.directSponsors} / 3 direct`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LevelKpi, {
					label: "Held commission",
					value: d.wallet.held,
					hint: "Not withdrawable"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LevelKpi, {
					label: "Available wallet",
					value: d.wallet.available,
					hint: "Released after completion"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LevelKpi, {
					label: "Total earnings",
					value: d.wallet.released,
					hint: "Lifetime released"
				})
			]
		}),
		next ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mt-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-medium uppercase tracking-wider text-muted",
						children: "Next milestone"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 font-semibold",
						children: [
							"Level ",
							next.level,
							" · ",
							next.completed,
							" / ",
							next.required,
							" members"
						]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: next.status })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProgressBar, {
						value: next.completed,
						max: next.required
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-3 text-sm text-muted",
					children: [
						next.remaining,
						" remaining · next release ",
						formatBdt(next.nextRelease)
					]
				})
			]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 grid gap-4 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Level progress" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/app/levels",
					className: "text-sm font-medium text-accent",
					children: "All levels"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3",
				children: d.levelProgress.filter((l) => l.status !== "LOCKED").slice(0, 3).map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LevelCard, { row }, row.level))
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-3 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Network snapshot" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/app/team",
						className: "text-sm font-medium text-accent",
						children: "Team"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-muted",
					children: [
						d.generationTotal,
						" generation members · ",
						d.directSponsors,
						" personal sponsors"
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 space-y-3",
					children: d.recentMembers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "Your team will appear here as members join."
					}) : d.recentMembers.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-sm font-medium",
								children: m.display_name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-mono text-xs text-muted",
								children: [
									m.member_id,
									" · Gen ",
									m.generation
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted",
							children: packageLabel(m.package_id)
						})]
					}, m.member_id))
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3 flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardTitle, { children: "Recent earnings" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/app/wallet",
							className: "text-sm font-medium text-accent",
							children: "Wallet"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: d.recentTx.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "Released earnings will show here after a level completes."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-3",
						children: d.recentTx.map((tx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate text-sm font-medium",
									children: tx.source
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted",
									children: formatDate(tx.created_at)
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Money, {
								amount: tx.amount,
								size: "sm"
							})]
						}, tx.id))
					}) })]
				})
			] })]
		})
	] });
}
//#endregion
export { Home as component };
