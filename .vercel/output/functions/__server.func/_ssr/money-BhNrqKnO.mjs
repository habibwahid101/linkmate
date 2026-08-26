import { t as cn } from "./utils-DoUG08GZ.mjs";
import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as formatBdt } from "./money-6FOdTEDf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/money-BhNrqKnO.js
var import_jsx_runtime = require_jsx_runtime();
function Money({ amount, className, size = "md" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("tabular font-semibold tracking-tight", {
			sm: "text-sm",
			md: "text-lg",
			lg: "text-2xl",
			xl: "text-[1.75rem] leading-none sm:text-3xl"
		}[size], className),
		children: formatBdt(amount)
	});
}
//#endregion
export { Money as t };
