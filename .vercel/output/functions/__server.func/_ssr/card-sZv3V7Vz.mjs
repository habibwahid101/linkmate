import { t as cn } from "./utils-DoUG08GZ.mjs";
import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/card-sZv3V7Vz.js
var import_jsx_runtime = require_jsx_runtime();
function Card({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5", className),
		...props
	});
}
function CardTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
		className: cn("text-base font-semibold tracking-tight text-ink", className),
		...props
	});
}
//#endregion
export { CardTitle as n, Card as t };
