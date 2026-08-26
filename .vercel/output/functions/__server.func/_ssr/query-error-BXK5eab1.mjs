import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as Button } from "./button-CQhsxzrh.mjs";
import { t as Card } from "./card-sZv3V7Vz.mjs";
import { t as WifiOff } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/query-error-BXK5eab1.js
var import_jsx_runtime = require_jsx_runtime();
function QueryError({ error, retry }) {
	const message = error instanceof Error ? error.message : "Something went wrong";
	const offline = typeof navigator !== "undefined" && !navigator.onLine;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "flex flex-col items-center py-10 text-center",
		children: [
			offline ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WifiOff, { className: "mb-3 size-6 text-muted" }) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-semibold",
				children: offline ? "You’re offline" : "Couldn’t load this"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-sm text-sm text-muted",
				children: offline ? "Reconnect to refresh live balances and progress." : message
			}),
			retry ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "mt-5",
				variant: "outline",
				onClick: retry,
				children: "Try again"
			}) : null
		]
	});
}
function NoAccess() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "py-12 text-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-semibold",
			children: "No access"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-sm text-muted",
			children: "This area is limited to administrators."
		})]
	});
}
//#endregion
export { QueryError as n, NoAccess as t };
