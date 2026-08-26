import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as cn } from "./utils-DoUG08GZ.mjs";
import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/button-CQhsxzrh.js
var import_jsx_runtime = require_jsx_runtime();
var buttonVariants = cva("inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent select-none", {
	variants: {
		variant: {
			primary: "bg-accent text-accent-fg hover:bg-accent-hover",
			secondary: "bg-surface-2 text-ink hover:bg-border",
			outline: "bg-transparent text-ink shadow-[0_0_0_1px_var(--color-border)] hover:bg-surface-2",
			ghost: "bg-transparent text-ink hover:bg-surface-2",
			danger: "bg-danger text-white hover:opacity-90",
			sidebar: "bg-white/8 text-sidebar-fg hover:bg-white/12"
		},
		size: {
			sm: "h-9 px-3 text-sm rounded-[10px]",
			md: "h-11 px-4 text-sm rounded-[12px]",
			lg: "h-12 px-5 text-[15px] rounded-[14px]",
			icon: "size-11 rounded-[12px]"
		}
	},
	defaultVariants: {
		variant: "primary",
		size: "md"
	}
});
function Button({ className, variant, size, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		...props
	});
}
//#endregion
export { Button as t };
