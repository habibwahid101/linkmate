import { o as __toESM } from "../_runtime.mjs";
import { a as require_react, i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { t as Button } from "./button-CQhsxzrh.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { n as toInt, t as formatBdt } from "./money-6FOdTEDf.mjs";
import { n as adminLedgerAdjustment, u as adminListWallets } from "./admin-eHL1f1F4.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as AdminList } from "./admin-list-DTK14s8m.mjs";
import { n as Label, t as Input } from "./input-b2DQ3LwD.mjs";
import { t as Modal } from "./modal-BkVPnIn5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/wallets-B9c5WNBq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Wallets() {
	const qc = useQueryClient();
	const q = useQuery({
		queryKey: ["admin", "wallets"],
		queryFn: () => adminListWallets()
	});
	const [target, setTarget] = (0, import_react.useState)(null);
	const [amount, setAmount] = (0, import_react.useState)("0");
	const [reason, setReason] = (0, import_react.useState)("");
	const adj = useMutation({
		mutationFn: () => adminLedgerAdjustment({ data: {
			memberId: target,
			amount: Number(amount),
			reason,
			confirm: true
		} }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["admin"] });
			toast.success("Ledger adjustment posted");
			setTarget(null);
			setReason("");
		},
		onError: (e) => toast.error(e.message)
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Wallets",
			hint: "Do not edit balances silently. Use a ledger adjustment with a reason."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminList, {
			rows: q.data.map((w) => ({
				...w,
				id: w.member_id
			})),
			onRow: (r) => setTarget(r.member_id),
			columns: [
				{
					key: "id",
					label: "ID",
					render: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-xs",
						children: r.member_id
					})
				},
				{
					key: "who",
					label: "Owner",
					render: (r) => r.display_name
				},
				{
					key: "av",
					label: "Available",
					render: (r) => formatBdt(toInt(r.available_balance))
				},
				{
					key: "rel",
					label: "Released",
					render: (r) => formatBdt(toInt(r.total_released))
				}
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Modal, {
			open: !!target,
			onClose: () => setTarget(null),
			title: "Ledger adjustment",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mb-3 text-sm text-muted",
				children: [
					"Posts a signed amount to ",
					target,
					". Positive credits, negative debits."
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "amt",
						children: "Amount (BDT integer)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "amt",
						type: "number",
						value: amount,
						onChange: (e) => setAmount(e.target.value)
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "rs",
						children: "Reason"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "rs",
						value: reason,
						onChange: (e) => setReason(e.target.value)
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "w-full",
						disabled: adj.isPending || reason.trim().length < 3,
						onClick: () => adj.mutate(),
						children: adj.isPending ? "Posting…" : "Confirm adjustment"
					})
				]
			})]
		})
	] });
}
//#endregion
export { Wallets as component };
