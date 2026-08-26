import { o as __toESM } from "../_runtime.mjs";
import { a as require_react, n as useQuery, o as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as Button } from "./button-CQhsxzrh.mjs";
import { t as DashboardSkeleton } from "./skeleton-CMAyHfEH.mjs";
import { t as Card } from "./card-sZv3V7Vz.mjs";
import { S as Check, g as Copy } from "../_libs/lucide-react.mjs";
import { n as QueryError } from "./query-error-BXK5eab1.mjs";
import { t as PageHeader } from "./page-header-CknVBNRQ.mjs";
import { r as getInvite } from "./member-D11Yn6Ku.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/invite-DL6nH0sS.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CopyButton({ value, label = "Copy", variant = "outline" }) {
	const [done, setDone] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
		type: "button",
		variant,
		onClick: async () => {
			try {
				await navigator.clipboard.writeText(value);
				setDone(true);
				setTimeout(() => setDone(false), 1600);
			} catch {}
		},
		children: [done ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" }), done ? "Copied" : label]
	});
}
/** Minimal QR (byte mode, ECC M) for referral links. */
var ECC_TABLE = [
	[10, 7],
	[16, 10],
	[26, 15],
	[36, 20],
	[44, 26],
	[64, 36],
	[86, 40],
	[108, 48]
];
function gfMul(a, b) {
	if (!a || !b) return 0;
	let p = 0;
	for (let i = 0; i < 8; i++) {
		if (b & 1) p ^= a;
		const hi = a & 128;
		a = a << 1 & 255;
		if (hi) a ^= 29;
		b >>= 1;
	}
	return p;
}
function rsRemainder(data, nsym) {
	const gen = [1];
	let x = 1;
	for (let i = 0; i < nsym; i++) {
		const next = new Array(gen.length + 1).fill(0);
		for (let j = 0; j < gen.length; j++) {
			next[j] ^= gen[j];
			next[j + 1] ^= gfMul(gen[j], x);
		}
		gen.splice(0, gen.length, ...next);
		let n = x << 1;
		if (n & 256) n ^= 285;
		x = n & 255;
	}
	const res = new Array(nsym).fill(0);
	for (const b of data) {
		const factor = b ^ res[0];
		res.shift();
		res.push(0);
		for (let i = 0; i < nsym; i++) res[i] ^= gfMul(gen[i + 1] ?? 0, factor);
	}
	return res;
}
function bitPush(bits, val, len) {
	for (let i = len - 1; i >= 0; i--) bits.push(val >> i & 1);
}
function qrMatrix(text) {
	const bytes = Array.from(new TextEncoder().encode(text));
	let ver = 1;
	let dataCodewords = 16;
	let eccLen = 10;
	for (let v = 1; v <= 8; v++) {
		const [total, ecc] = ECC_TABLE[v - 1];
		const cap = total - ecc;
		if (Math.ceil((12 + bytes.length * 8 + 4) / 8) <= cap) {
			ver = v;
			dataCodewords = cap;
			eccLen = ecc;
			break;
		}
	}
	const bits = [];
	bitPush(bits, 4, 4);
	bitPush(bits, bytes.length, 8);
	for (const b of bytes) bitPush(bits, b, 8);
	bitPush(bits, 0, Math.min(4, dataCodewords * 8 - bits.length));
	while (bits.length % 8) bits.push(0);
	const data = [];
	for (let i = 0; i < bits.length; i += 8) {
		let b = 0;
		for (let j = 0; j < 8; j++) b = b << 1 | (bits[i + j] ?? 0);
		data.push(b);
	}
	const pad = [236, 17];
	let p = 0;
	while (data.length < dataCodewords) data.push(pad[p++ % 2]);
	const ecc = rsRemainder(data.slice(0, dataCodewords), eccLen);
	const code = data.slice(0, dataCodewords).concat(ecc);
	const size = 17 + 4 * ver;
	const m = Array.from({ length: size }, () => Array(size).fill(null));
	const placeFinder = (r, c) => {
		for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
			const rr = r + y;
			const cc = c + x;
			if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
			const on = x === -1 || y === -1 || x === 7 || y === 7 ? false : x === 0 || y === 0 || x === 6 || y === 6 ? true : x >= 2 && x <= 4 && y >= 2 && y <= 4;
			m[rr][cc] = on;
		}
	};
	placeFinder(0, 0);
	placeFinder(0, size - 7);
	placeFinder(size - 7, 0);
	for (let i = 8; i < size - 8; i++) {
		m[6][i] = i % 2 === 0;
		m[i][6] = i % 2 === 0;
	}
	m[size - 8][8] = true;
	let bit = 0;
	const totalBits = code.length * 8;
	const getBit = (i) => {
		return ((code[Math.floor(i / 8)] ?? 0) >> 7 - i % 8 & 1) === 1;
	};
	for (let col = size - 1; col > 0; col -= 2) {
		if (col === 6) col--;
		for (let y = 0; y < size; y++) {
			const row = (size - 1 - col) / 2 % 2 === 0 ? size - 1 - y : y;
			for (let dx = 0; dx < 2; dx++) {
				const c = col - dx;
				if (m[row][c] != null) continue;
				let dark = bit < totalBits ? getBit(bit) : false;
				bit++;
				if ((row + c) % 2 === 0) dark = !dark;
				m[row][c] = dark;
			}
		}
	}
	return m.map((row) => row.map((v) => Boolean(v)));
}
function QrCode({ value, size = 176 }) {
	const matrix = (0, import_react.useMemo)(() => qrMatrix(value), [value]);
	const n = matrix.length;
	const cell = n ? size / n : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: size,
		height: size,
		viewBox: `0 0 ${size} ${size}`,
		className: "rounded-lg bg-surface",
		role: "img",
		"aria-label": "Referral QR code",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			width: size,
			height: size,
			fill: "#FFFcf7"
		}), matrix.map((row, y) => row.map((on, x) => on ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			x: x * cell,
			y: y * cell,
			width: cell,
			height: cell,
			fill: "#161513"
		}, `${x}-${y}`) : null))]
	});
}
function Invite() {
	const q = useQuery({
		queryKey: ["invite"],
		queryFn: () => getInvite()
	});
	const origin = typeof window !== "undefined" ? window.location.origin : "";
	const [canShare, setCanShare] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
	}, []);
	const link = (0, import_react.useMemo)(() => {
		if (!q.data) return "";
		return `${origin}/signup?ref=${encodeURIComponent(q.data.referralCode)}`;
	}, [origin, q.data]);
	if (q.isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSkeleton, {});
	if (q.isError) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryError, {
		error: q.error,
		retry: () => q.refetch()
	});
	const text = `Join me on Link Mate. Referral ${q.data.referralCode}${q.data.activeId ? ` · ID ${q.data.activeId}` : ""}. ${link}`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Invite",
		hint: "Your referral attaches the new member’s first ID to you — not every ID in a multi-ID package."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "flex flex-col items-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium uppercase tracking-wider text-muted",
				children: "Referral code"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 font-mono text-3xl font-semibold tracking-tight",
				children: q.data.referralCode
			}),
			q.data.activeId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 font-mono text-xs text-muted",
				children: q.data.activeId
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-6 rounded-2xl bg-surface-2 p-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { value: link || q.data.referralCode })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 max-w-xs break-all text-center text-xs text-muted",
				children: link
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 grid w-full grid-cols-2 gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CopyButton, {
					value: link,
					label: "Copy link"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CopyButton, {
					value: q.data.referralCode,
					label: "Copy code",
					variant: "secondary"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 grid w-full grid-cols-2 gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					className: "inline-flex h-11 items-center justify-center rounded-[12px] bg-surface-2 text-sm font-medium",
					href: `https://wa.me/?text=${encodeURIComponent(text)}`,
					target: "_blank",
					rel: "noreferrer",
					children: "WhatsApp"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					className: "inline-flex h-11 items-center justify-center rounded-[12px] bg-surface-2 text-sm font-medium",
					href: `https://www.facebook.com/dialog/send?link=${encodeURIComponent(link)}&redirect_uri=${encodeURIComponent(origin || "https://linkmate.app")}`,
					target: "_blank",
					rel: "noreferrer",
					children: "Messenger"
				})]
			}),
			canShare ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "mt-2 w-full",
				variant: "outline",
				onClick: () => void navigator.share({
					title: "Link Mate",
					text,
					url: link
				}),
				children: "Share"
			}) : null
		]
	})] });
}
//#endregion
export { Invite as component };
