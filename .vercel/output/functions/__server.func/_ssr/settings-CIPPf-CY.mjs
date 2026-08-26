import { o as __toESM } from "../_runtime.mjs";
import { a as require_react, i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { t as Button } from "./button-CQhsxzrh.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { t as Card } from "./card-sZv3V7Vz.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { m as adminUpdateSetting, t as adminGetSettings } from "./admin-eHL1f1F4.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Input } from "./input-b2DQ3LwD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-CIPPf-CY.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Settings() {
	const qc = useQueryClient();
	const q = useQuery({
		queryKey: ["admin", "settings"],
		queryFn: () => adminGetSettings()
	});
	const [draft, setDraft] = (0, import_react.useState)({});
	const save = useMutation({
		mutationFn: (p) => adminUpdateSetting({ data: {
			key: p.key,
			value: p.value,
			confirm: true
		} }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["admin", "settings"] });
			toast.success("Setting updated");
		},
		onError: (e) => toast.error(e.message)
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Settings",
		hint: "standard_id_value_bdt is locked. Hyper Turbo placement version can be updated when rules are finalized."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-3",
		children: q.data.settings.map((s) => {
			const locked = s.key === "standard_id_value_bdt";
			const value = draft[s.key] ?? s.value;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-mono text-xs text-muted",
				children: s.key
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value,
					disabled: locked,
					onChange: (e) => setDraft((d) => ({
						...d,
						[s.key]: e.target.value
					}))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					disabled: locked || save.isPending || value === s.value,
					onClick: () => save.mutate({
						key: s.key,
						value
					}),
					children: "Save"
				})]
			})] }, s.key);
		})
	})] });
}
//#endregion
export { Settings as component };
