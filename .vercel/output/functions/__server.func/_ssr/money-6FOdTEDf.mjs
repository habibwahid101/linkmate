//#region node_modules/.nitro/vite/services/ssr/assets/money-6FOdTEDf.js
/** Dominant UI convention: ৳11,000 */
function formatBdt(amount) {
	const n = typeof amount === "string" ? Number(amount) : amount ?? 0;
	if (!Number.isFinite(n)) return "৳0";
	const rounded = Math.round(n);
	const abs = Math.abs(rounded).toLocaleString("en-US");
	return rounded < 0 ? `−৳${abs}` : `৳${abs}`;
}
function toInt(value) {
	if (value == null) return 0;
	const n = typeof value === "string" ? Number(value) : value;
	return Number.isFinite(n) ? Math.round(n) : 0;
}
//#endregion
export { toInt as n, formatBdt as t };
