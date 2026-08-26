import { t as cn } from "./utils-DoUG08GZ.mjs";
import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/logo-CGasuG15.js
var import_jsx_runtime = require_jsx_runtime();
function LogoMark({ className, invert = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 32 32",
		className: cn("size-8", className),
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				width: "32",
				height: "32",
				rx: "8",
				fill: invert ? "#F3F1EC" : "#1F4D45"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "10",
				cy: "16",
				r: "2.2",
				fill: invert ? "#1F4D45" : "#F3F1EC"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "22",
				cy: "10",
				r: "2.2",
				fill: invert ? "#1F4D45" : "#F3F1EC"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "22",
				cy: "22",
				r: "2.2",
				fill: invert ? "#1F4D45" : "#F3F1EC"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M12 16h8M20.2 11.6l-8.4 3.6M20.2 20.4l-8.4-3.6",
				stroke: invert ? "#1F4D45" : "#F3F1EC",
				strokeWidth: "1.6",
				strokeLinecap: "round"
			})
		]
	});
}
function Wordmark({ invert = false, compact = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogoMark, {
			invert,
			className: "size-8 shrink-0"
		}), compact ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: cn("text-[15px] font-semibold tracking-tight", invert ? "text-sidebar-fg" : "text-ink"),
			children: "Link Mate"
		})]
	});
}
//#endregion
export { Wordmark as t };
