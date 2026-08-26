import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { n as useCurrentUserState } from "./use-current-user-DG6UNzh9.mjs";
import { t as RedirectToSignIn } from "./gates-B67iQevs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/guards-BCi79ugw.js
var import_jsx_runtime = require_jsx_runtime();
function RequireAuth({ children }) {
	const { user, isPending } = useCurrentUserState();
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-dvh bg-bg p-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {})
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
//#endregion
export { RequireAuth as t };
