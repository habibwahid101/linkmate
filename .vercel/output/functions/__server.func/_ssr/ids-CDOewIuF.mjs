//#region node_modules/.nitro/vite/services/ssr/assets/ids-CDOewIuF.js
function formatMemberId(seq) {
	return `LM-${String(seq)}`;
}
function makeReferralCode(seed) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let h = 2166136261;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	let out = "";
	let n = h >>> 0;
	for (let i = 0; i < 6; i++) {
		out += alphabet[n % 32];
		n = Math.imul(n, 1664525) + 1013904223;
		n >>>= 0;
	}
	return out;
}
function uid() {
	return crypto.randomUUID();
}
//#endregion
export { makeReferralCode as n, uid as r, formatMemberId as t };
