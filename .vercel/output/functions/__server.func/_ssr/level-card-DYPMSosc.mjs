import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as Card } from "./card-sZv3V7Vz.mjs";
import { c as getLevel, l as ordinalGeneration } from "./rules-D1_lUvHP.mjs";
import { t as formatBdt } from "./money-6FOdTEDf.mjs";
import { t as Money } from "./money-BhNrqKnO.mjs";
import { t as StatusBadge } from "./status-badge-BnPZKVzI.mjs";
import { t as ProgressBar } from "./progress-bar-QyQB3OUv.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/level-card-DYPMSosc.js
var import_jsx_runtime = require_jsx_runtime();
function LevelCard({ row, compact = false }) {
	const rule = getLevel(row.level);
	const release = row.status === "RELEASED" ? `${formatBdt(row.expected_full_commission)} Released` : row.status === "COMPLETED" ? "Ready to release" : "Pending";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "flex flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs font-medium uppercase tracking-wider text-muted",
					children: ["Level ", row.level]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-0.5 text-sm text-ink",
					children: [
						ordinalGeneration(row.generation),
						" Generation · ",
						rule.rateLabel
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: row.status })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-1.5 flex items-baseline justify-between text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "tabular font-medium",
					children: [
						row.completed_members,
						" / ",
						row.required_members,
						" Members"
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-muted",
					children: [row.remaining_members, " remaining"]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProgressBar, {
				value: row.completed_members,
				max: row.required_members
			})] }),
			compact ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-end justify-between border-t border-border pt-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted",
					children: "Commission"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "tabular text-sm font-medium",
					children: [
						formatBdt(row.accumulated_commission),
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted",
							children: ["/ ", formatBdt(row.expected_full_commission)]
						})
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-right",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "Wallet release"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: release
					})]
				})]
			})
		]
	});
}
function LevelKpi({ label, value, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "min-w-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium uppercase tracking-wider text-muted",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 min-w-0 truncate",
				children: typeof value === "number" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Money, {
					amount: value,
					size: "lg"
				}) : value
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 truncate text-xs text-muted",
				children: hint
			}) : null
		]
	});
}
//#endregion
export { LevelKpi as n, LevelCard as t };
