import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as Button } from "./button-CQhsxzrh.mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/empty-state-B7IVxP4j.js
var import_jsx_runtime = require_jsx_runtime();
function EmptyState({ title, body, action, actionTo, icon }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col items-center justify-center rounded-2xl bg-surface px-6 py-12 text-center shadow-[var(--shadow-card)]",
		children: [
			icon ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-4 text-muted",
				children: icon
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-base font-semibold tracking-tight",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1.5 max-w-sm text-sm text-muted",
				children: body
			}),
			action && actionTo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: actionTo,
				className: "mt-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { children: action })
			}) : null
		]
	});
}
//#endregion
export { EmptyState as t };
