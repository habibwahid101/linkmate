import { o as __toESM } from "../_runtime.mjs";
import { a as require_react, i as useQueryClient, n as useQuery, o as require_jsx_runtime, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { t as Button } from "./button-CQhsxzrh.mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as updateMyProfile, n as getMyProfile } from "./profile-DfbQm7Sx.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { i as signOut } from "./client-B40BzJxt.mjs";
import { t as Card } from "./card-sZv3V7Vz.mjs";
import { c as Settings, d as Layers, f as IdCard, o as Shield, s as Share2, w as Bell } from "../_libs/lucide-react.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as Label, t as Input } from "./input-b2DQ3LwD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/profile-hHYDemO3.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Profile() {
	const qc = useQueryClient();
	const q = useQuery({
		queryKey: ["profile"],
		queryFn: () => getMyProfile()
	});
	const [name, setName] = (0, import_react.useState)(null);
	const [phone, setPhone] = (0, import_react.useState)(null);
	const save = useMutation({
		mutationFn: () => updateMyProfile({ data: {
			displayName: name ?? q.data?.displayName,
			phone: phone ?? q.data?.phone ?? ""
		} }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["profile"] });
			qc.invalidateQueries({ queryKey: ["shell"] });
			toast.success("Profile updated");
		},
		onError: (e) => toast.error(e.message)
	});
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	const p = q.data;
	const links = [
		{
			to: "/app/ids",
			label: "My IDs",
			icon: IdCard
		},
		{
			to: "/app/packages",
			label: "My package",
			icon: Layers
		},
		{
			to: "/app/invite",
			label: "Invite",
			icon: Share2
		},
		{
			to: "/app/notifications",
			label: "Notifications",
			icon: Bell
		},
		{
			to: "/app/settings",
			label: "Settings",
			icon: Settings
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Profile",
			hint: p.role === "admin" ? "Administrator" : "Member"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "space-y-3",
			onSubmit: (e) => {
				e.preventDefault();
				save.mutate();
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "name",
					children: "Full name"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "name",
					value: name ?? p.displayName,
					onChange: (e) => setName(e.target.value)
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
					htmlFor: "email",
					children: "Email"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					id: "email",
					value: p.email ?? "",
					disabled: true
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "phone",
						children: "Mobile"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "phone",
						value: phone ?? p.phone ?? "",
						onChange: (e) => setPhone(e.target.value),
						placeholder: "OTP-ready — not required yet"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted",
						children: p.phoneVerified ? "Verified" : "Mobile verification is prepared, not required."
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted",
					children: ["Referral code ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono font-medium text-ink",
						children: p.referralCode
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					type: "submit",
					disabled: save.isPending,
					children: save.isPending ? "Saving…" : "Save"
				})
			]
		}) }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)]",
			children: [links.map((l) => {
				const Icon = l.icon;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: l.to,
					className: "flex h-12 items-center gap-3 border-b border-border px-4 text-sm last:border-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
						className: "size-4 text-muted",
						strokeWidth: 1.75
					}), l.label]
				}, l.to);
			}), p.role === "admin" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/admin",
				className: "flex h-12 items-center gap-3 px-4 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, {
					className: "size-4 text-muted",
					strokeWidth: 1.75
				}), "Admin"]
			}) : null]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			className: "mt-6 w-full",
			variant: "outline",
			onClick: () => void signOut("/login"),
			children: "Sign out"
		})
	] });
}
//#endregion
export { Profile as component };
