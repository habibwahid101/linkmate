import { t as cn } from "./utils-DoUG08GZ.mjs";
import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/input-b2DQ3LwD.js
var import_jsx_runtime = require_jsx_runtime();
function Input({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		className: cn("h-11 w-full rounded-[12px] bg-surface px-3.5 text-sm text-ink shadow-[0_0_0_1px_var(--color-border)] placeholder:text-subtle", "transition-[box-shadow] duration-150", "focus:shadow-[0_0_0_2px_var(--color-accent)] focus:outline-none", "disabled:opacity-50", className),
		...props
	});
}
function Label({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
		className: cn("mb-1.5 block text-xs font-medium tracking-wide text-muted", className),
		...props
	});
}
//#endregion
export { Label as n, Input as t };
