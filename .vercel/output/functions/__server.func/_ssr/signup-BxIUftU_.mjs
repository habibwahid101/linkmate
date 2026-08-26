import { o as __toESM } from "../_runtime.mjs";
import { a as require_react, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as Button } from "./button-CQhsxzrh.mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as signIn, t as authClient } from "./client-B40BzJxt.mjs";
import { n as Label, t as Input } from "./input-b2DQ3LwD.mjs";
import { t as AuthFrame } from "./auth-frame-BBSJ1y-G.mjs";
import { t as GROK_PROVIDERS } from "./server-CGb1ErKM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/signup-BxIUftU_.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Signup() {
	const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
	const [name, setName] = (0, import_react.useState)("");
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [referral, setReferral] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const fromUrl = search?.get("ref");
		const stored = window.localStorage.getItem("lm-ref");
		setReferral((fromUrl || stored || "").toUpperCase());
	}, []);
	async function onSubmit(e) {
		e.preventDefault();
		setError(null);
		setBusy(true);
		try {
			if (referral) window.localStorage.setItem("lm-ref", referral.toUpperCase());
			const { error: err } = await authClient.signUp.email({
				email,
				password,
				name,
				callbackURL: "/app"
			});
			if (err) throw new Error(err.message ?? "Could not create account");
			window.location.href = "/app";
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not create account");
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AuthFrame, {
		title: "Create account",
		subtitle: "Your sponsor is stored with the referral code. No KYC required to start.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit,
				className: "space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "name",
						children: "Full name"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "name",
						required: true,
						value: name,
						onChange: (e) => setName(e.target.value),
						autoComplete: "name"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "email",
						children: "Email"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "email",
						type: "email",
						required: true,
						value: email,
						onChange: (e) => setEmail(e.target.value),
						autoComplete: "email"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "password",
						children: "Password"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "password",
						type: "password",
						required: true,
						minLength: 8,
						value: password,
						onChange: (e) => setPassword(e.target.value),
						autoComplete: "new-password"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "ref",
						children: "Referral code (optional)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "ref",
						value: referral,
						onChange: (e) => setReferral(e.target.value.toUpperCase()),
						placeholder: "e.g. RAFI4K",
						autoCapitalize: "characters"
					})] }),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-danger",
						children: error
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						className: "w-full",
						disabled: busy,
						children: busy ? "Creating…" : "Create account"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "my-6 flex items-center gap-3 text-xs text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px flex-1 bg-border" }),
					"or",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px flex-1 bg-border" })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-2",
				children: GROK_PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					variant: "outline",
					className: "w-full",
					onClick: () => {
						if (referral) window.localStorage.setItem("lm-ref", referral.toUpperCase());
						signIn(p.providerId, { callbackURL: "/app" });
					},
					children: ["Continue with ", p.label]
				}, p.providerId))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-6 text-center text-sm text-muted",
				children: [
					"Already have an account?",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/login",
						className: "font-medium text-ink underline-offset-4 hover:underline",
						children: "Sign in"
					})
				]
			})
		]
	});
}
//#endregion
export { Signup as component };
