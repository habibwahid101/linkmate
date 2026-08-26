import { o as require_jsx_runtime } from "./_libs/react+tanstack__react-query.mjs";
import { t as Wordmark } from "./_ssr/logo-CGasuG15.mjs";
import { t as Button } from "./_ssr/button-CQhsxzrh.mjs";
import { y as Link } from "./_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_-CP1HsTFa.js
var import_jsx_runtime = require_jsx_runtime();
function NotFound() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-8 text-xl font-semibold tracking-tight",
				children: "Page not found"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 max-w-sm text-sm text-muted",
				children: "That link doesn’t exist. Head back to the app or the home page."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 flex gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						children: "Home"
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/app",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { children: "Open app" })
				})]
			})
		]
	});
}
//#endregion
export { NotFound as component };
