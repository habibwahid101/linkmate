import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as Wordmark } from "./logo-CGasuG15.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth-frame-BBSJ1y-G.js
var import_jsx_runtime = require_jsx_runtime();
function AuthFrame({ title, subtitle, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg lg:grid lg:grid-cols-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-fg lg:flex",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, { invert: true }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-3xl font-semibold tracking-tight text-balance",
						children: "Membership you can read at a glance."
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-sm leading-relaxed text-sidebar-muted",
						children: "Packages, IDs, generation progress, and a wallet that only releases when a level is complete."
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-sidebar-muted",
					children: "Held until complete. Then released in full."
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "flex min-h-dvh flex-col px-5 py-8 sm:px-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "lg:hidden",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, {})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-2xl font-semibold tracking-tight",
						children: title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1.5 text-sm text-muted",
						children: subtitle
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-8",
						children
					})
				]
			})]
		})]
	});
}
//#endregion
export { AuthFrame as t };
