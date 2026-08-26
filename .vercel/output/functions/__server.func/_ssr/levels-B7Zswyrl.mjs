import { n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { i as getLevels } from "./member-D11Yn6Ku.mjs";
import { t as EmptyState } from "./empty-state-B7IVxP4j.mjs";
import { t as LevelCard } from "./level-card-DYPMSosc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/levels-B7Zswyrl.js
var import_jsx_runtime = require_jsx_runtime();
function Levels() {
	const q = useQuery({
		queryKey: ["levels"],
		queryFn: () => getLevels()
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	if (!q.data.activeId) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, { title: "Level progress" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
		title: "No levels yet",
		body: "Level progress appears after you have a membership ID.",
		action: "View packages",
		actionTo: "/app/packages"
	})] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Level progress",
		hint: `Tracked on ${q.data.activeId}. Held until the full member count is met.`
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid gap-3 lg:grid-cols-2",
		children: q.data.levels.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LevelCard, { row }, row.level))
	})] });
}
//#endregion
export { Levels as component };
