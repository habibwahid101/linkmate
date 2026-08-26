//#region node_modules/.nitro/vite/services/ssr/assets/format-CmMzfBY6.js
function formatDate(iso) {
	if (!iso) return "—";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "—";
	return d.toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric"
	});
}
function formatDateTime(iso) {
	if (!iso) return "—";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "—";
	return d.toLocaleString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit"
	});
}
function packageLabel(id) {
	if (!id) return "—";
	return id.split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}
//#endregion
export { formatDateTime as n, packageLabel as r, formatDate as t };
