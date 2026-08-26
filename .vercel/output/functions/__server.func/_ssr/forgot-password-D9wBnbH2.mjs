import { o as __toESM } from "../_runtime.mjs";
import { a as require_react, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as Button } from "./button-CQhsxzrh.mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Label, t as Input } from "./input-b2DQ3LwD.mjs";
import { t as AuthFrame } from "./auth-frame-BBSJ1y-G.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/forgot-password-D9wBnbH2.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Forgot() {
	const [email, setEmail] = (0, import_react.useState)("");
	const [done, setDone] = (0, import_react.useState)(false);
	function onSubmit(e) {
		e.preventDefault();
		setDone(true);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthFrame, {
		title: "Reset password",
		subtitle: "Password reset email is prepared. On this environment we log the request and you can sign in again after creating a new account if needed.",
		children: done ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "text-sm text-muted",
			children: [
				"If an account exists for ",
				email,
				", a reset will be issued when mail is configured.",
				" ",
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/login",
					className: "font-medium text-ink underline",
					children: "Back to sign in"
				})
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			onSubmit,
			className: "space-y-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "email",
					children: "Email"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "email",
					type: "email",
					required: true,
					value: email,
					onChange: (e) => setEmail(e.target.value)
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					className: "w-full",
					children: "Request reset"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-center text-sm text-muted",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/login",
						className: "underline-offset-4 hover:underline",
						children: "Back to sign in"
					})
				})
			]
		})
	});
}
//#endregion
export { Forgot as component };
