import { n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { t as Card } from "./card-sZv3V7Vz.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { l as ordinalGeneration } from "./rules-D1_lUvHP.mjs";
import { n as toInt, t as formatBdt } from "./money-6FOdTEDf.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { n as getEarningsByLevel } from "./member-D11Yn6Ku.mjs";
import { t as EmptyState } from "./empty-state-B7IVxP4j.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/earnings-D8WDz072.js
var import_jsx_runtime = require_jsx_runtime();
function Earnings() {
	const q = useQuery({
		queryKey: ["earnings"],
		queryFn: () => getEarningsByLevel()
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	if (q.data.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, { title: "Earnings" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
		title: "No commission yet",
		body: "Earnings by level appear as your network generates held and released commission.",
		action: "View team",
		actionTo: "/app/team"
	})] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Earnings",
		hint: "Held stays pending until the level completes. Released is in your wallet."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-2",
		children: q.data.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "flex items-center justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm font-semibold",
				children: [
					"Level ",
					row.level,
					" · ",
					ordinalGeneration(row.generation),
					" generation"
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-xs text-muted",
				children: [
					"Held ",
					formatBdt(toInt(row.held)),
					" · Released ",
					formatBdt(toInt(row.released))
				]
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "tabular text-sm font-semibold",
				children: formatBdt(toInt(row.held) + toInt(row.released))
			})]
		}, row.level))
	})] });
}
//#endregion
export { Earnings as component };
