import { o as __toESM } from "../_runtime.mjs";
import { t as cn } from "./utils-DoUG08GZ.mjs";
import { a as require_react, i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { t as Button } from "./button-CQhsxzrh.mjs";
import { x as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as lookupReferral } from "./profile-DfbQm7Sx.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { t as Card } from "./card-sZv3V7Vz.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { i as PACKAGE_LIST, n as PACKAGES } from "./rules-D1_lUvHP.mjs";
import { t as formatBdt } from "./money-6FOdTEDf.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { t as Badge } from "./badge-S67-CHGd.mjs";
import { l as purchasePackage, t as getDashboard } from "./member-D11Yn6Ku.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as Label, t as Input } from "./input-b2DQ3LwD.mjs";
import { t as Modal } from "./modal-BkVPnIn5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/packages-C2j-En9T.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function PackageCard({ pkg, current, onSelect, cta = "Choose", busy = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: cn("flex h-full flex-col gap-4", current && "shadow-[0_0_0_2px_var(--color-accent)]"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium uppercase tracking-wider text-muted",
					children: "Package"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "mt-0.5 text-lg font-semibold tracking-tight",
					children: pkg.name
				})] }), current ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: "accent",
					children: "Current"
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "tabular text-2xl font-semibold tracking-tight",
				children: formatBdt(pkg.amountBdt)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted",
				children: [
					pkg.idCount,
					" ID",
					pkg.idCount === 1 ? "" : "s"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm leading-relaxed text-ink",
				children: pkg.structureSummary
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: pkg.receives
			}),
			onSelect ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "mt-auto w-full",
				onClick: onSelect,
				disabled: busy,
				children: busy ? "Working…" : cta
			}) : null
		]
	});
}
function Packages() {
	const nav = useNavigate();
	const qc = useQueryClient();
	const dash = useQuery({
		queryKey: ["dashboard"],
		queryFn: () => getDashboard()
	});
	const [pick, setPick] = (0, import_react.useState)(null);
	const [code, setCode] = (0, import_react.useState)("");
	const [sponsorName, setSponsorName] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const stored = window.localStorage.getItem("lm-ref");
		if (stored) setCode(stored.toUpperCase());
	}, []);
	(0, import_react.useEffect)(() => {
		const c = code.trim();
		if (c.length < 4) {
			setSponsorName(null);
			return;
		}
		const t = setTimeout(() => {
			lookupReferral({ data: { code: c } }).then((r) => {
				setSponsorName(r.valid ? r.name : null);
			});
		}, 250);
		return () => clearTimeout(t);
	}, [code]);
	const buy = useMutation({
		mutationFn: () => purchasePackage({ data: {
			packageId: pick,
			referralCode: code.trim() || void 0
		} }),
		onSuccess: (res) => {
			if (code.trim()) window.localStorage.setItem("lm-ref", code.trim().toUpperCase());
			qc.invalidateQueries();
			toast.success(`${res.ids.length} ID${res.ids.length === 1 ? "" : "s"} issued. Root ${res.rootId}.`);
			setPick(null);
			nav({ to: "/app/ids" });
		},
		onError: (e) => toast.error(e.message)
	});
	if (dash.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (dash.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: dash.error,
		retry: () => dash.refetch()
	});
	const current = dash.data.latestPackage;
	const selected = pick ? PACKAGES[pick] : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Packages",
			hint: "Each ID is valued at ৳11,000 for commission. External sponsors attach to your first ID only."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-3 sm:grid-cols-2",
			children: PACKAGE_LIST.map((pkg) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PackageCard, {
				pkg,
				current: current === pkg.id,
				cta: current === pkg.id ? "Buy again" : "Select",
				onSelect: () => setPick(pkg.id)
			}, pkg.id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Modal, {
			open: !!pick,
			onClose: () => !buy.isPending && setPick(null),
			title: selected ? `Confirm ${selected.name}` : "Confirm",
			children: selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [
							formatBdt(selected.amountBdt),
							" · ",
							selected.idCount,
							" ID",
							selected.idCount === 1 ? "" : "s",
							". Payment is simulated for this MVP."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm",
						children: selected.structureSummary
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "ref",
							children: "Referral code or sponsor ID"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "ref",
							value: code,
							onChange: (e) => setCode(e.target.value.toUpperCase()),
							placeholder: "Optional",
							autoCapitalize: "characters"
						}),
						sponsorName ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1.5 text-xs text-success",
							children: [
								"Sponsor: ",
								sponsorName,
								". They earn from your first ID only."
							]
						}) : code.trim().length >= 4 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1.5 text-xs text-muted",
							children: "We’ll validate this code on purchase."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1.5 text-xs text-muted",
							children: "Leave blank if you have no sponsor."
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "w-full",
						disabled: buy.isPending,
						onClick: () => buy.mutate(),
						children: buy.isPending ? "Issuing IDs…" : `Pay ${formatBdt(selected.amountBdt)}`
					})
				]
			}) : null
		})
	] });
}
//#endregion
export { Packages as component };
