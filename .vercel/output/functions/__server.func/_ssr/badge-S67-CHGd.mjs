import { t as cn } from "./utils-DoUG08GZ.mjs";
import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/badge-S67-CHGd.js
var import_jsx_runtime = require_jsx_runtime();
var tones = {
	neutral: "bg-surface-2 text-ink",
	accent: "bg-accent-soft text-accent",
	success: "bg-success-soft text-success",
	warning: "bg-warning-soft text-warning",
	held: "bg-held-soft text-held",
	danger: "bg-danger-soft text-danger",
	locked: "bg-surface-2 text-muted"
};
function Badge({ tone = "neutral", className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide", tones[tone], className),
		...props
	});
}
//#endregion
export { Badge as t };
