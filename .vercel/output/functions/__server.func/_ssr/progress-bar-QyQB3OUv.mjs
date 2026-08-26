import { t as cn } from "./utils-DoUG08GZ.mjs";
import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/progress-bar-QyQB3OUv.js
var import_jsx_runtime = require_jsx_runtime();
function ProgressBar({ value, max, className }) {
	const pct = max <= 0 ? 0 : Math.min(100, Math.round(value / max * 100));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className),
		role: "progressbar",
		"aria-valuenow": value,
		"aria-valuemin": 0,
		"aria-valuemax": max,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "h-full rounded-full bg-accent transition-[width] duration-300",
			style: { width: `${pct}%` }
		})
	});
}
//#endregion
export { ProgressBar as t };
