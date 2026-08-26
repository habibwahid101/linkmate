import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/utils-DoUG08GZ.js
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function initials(name) {
	if (!name) return "LM";
	return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "LM";
}
//#endregion
export { initials as n, cn as t };
