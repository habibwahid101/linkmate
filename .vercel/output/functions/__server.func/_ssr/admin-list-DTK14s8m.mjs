import { t as cn } from "./utils-DoUG08GZ.mjs";
import { o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as Card } from "./card-sZv3V7Vz.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-list-DTK14s8m.js
var import_jsx_runtime = require_jsx_runtime();
function AdminList({ columns, rows, empty = "Nothing here yet.", onRow }) {
	if (rows.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		className: "py-10 text-center text-sm text-muted",
		children: empty
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-2 lg:hidden",
		children: rows.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			disabled: !onRow,
			onClick: () => onRow?.(row),
			className: "block w-full rounded-2xl bg-surface p-4 text-left shadow-[var(--shadow-card)]",
			children: columns.slice(0, 4).map((col) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-baseline justify-between gap-3 py-0.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[11px] uppercase tracking-wider text-muted",
					children: col.label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "min-w-0 truncate text-sm",
					children: col.render(row)
				})]
			}, col.key))
		}, row.id ?? i))
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "hidden overflow-x-auto rounded-2xl bg-surface shadow-[var(--shadow-card)] lg:block",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
				className: "border-b border-border text-left text-xs uppercase tracking-wider text-muted",
				children: columns.map((col) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
					className: cn("px-4 py-3 font-medium", col.className),
					children: col.label
				}, col.key))
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
				className: cn("border-b border-border last:border-0", onRow && "cursor-pointer hover:bg-surface-2"),
				onClick: () => onRow?.(row),
				children: columns.map((col) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					className: cn("px-4 py-3 align-middle", col.className),
					children: col.render(row)
				}, col.key))
			}, row.id ?? i)) })]
		})
	})] });
}
//#endregion
export { AdminList as t };
