import { r as createServerFn } from "./ssr.mjs";
import { r as getSql } from "./db-D3Vz1JrQ.mjs";
import { t as authMiddleware } from "./middleware-Bb4nqKHv.mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
import { n as makeReferralCode } from "./ids-CDOewIuF.mjs";
import { gn as object, yn as string } from "../_libs/@better-auth/core+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/profile-DfbQm7Sx.js
function mapProfile(row) {
	return {
		userId: row.user_id,
		displayName: row.display_name,
		email: row.email,
		phone: row.phone,
		phoneVerified: row.phone_verified,
		role: row.role === "admin" ? "admin" : "member",
		referralCode: row.referral_code,
		activeId: row.active_id,
		createdAt: row.created_at
	};
}
async function ensureProfileRow(userId, displayName, email) {
	const sql = await getSql();
	const existing = await sql`select * from app_users where user_id = ${userId}`;
	if (existing[0]) return mapProfile(existing[0]);
	const authUser = await sql`
    select name, email from "user" where id = ${userId}
  `;
	const name = authUser[0]?.name || displayName || "Member";
	const mail = authUser[0]?.email || email;
	const role = ((await sql`select count(*)::int as n from app_users where role = 'admin' and is_synthetic = false`)[0]?.n ?? 0) === 0 || (mail ?? "").toLowerCase().includes("admin") ? "admin" : "member";
	let code = makeReferralCode(userId + Date.now());
	for (let i = 0; i < 5; i++) {
		if (((await sql`select count(*)::int as c from app_users where referral_code = ${code}`)[0]?.c ?? 0) === 0) break;
		code = makeReferralCode(userId + i + Math.random());
	}
	await sql`
    insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
    values (${userId}, ${name}, ${mail}, ${role}, ${code}, false)
    on conflict (user_id) do nothing
  `;
	return mapProfile((await sql`select * from app_users where user_id = ${userId}`)[0]);
}
var getMyProfile = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("43089abf67b0d2fc04dd8ee11c57f4f4a6f26a675e0ebab772a5634a77d97f36"));
var updateMyProfile = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	displayName: string().min(1).max(80).optional(),
	phone: string().max(20).optional()
})).handler(createSsrRpc("2516a54386004386c896f1a0ac5bdf163cb6fe80f8ce05136f7c7b30edbcc98d"));
var setActiveId = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({ memberId: string() })).handler(createSsrRpc("e54c9306c1284a092cfa15249d17d09d570b4e537b3c2bcdb6120c31e71cf26c"));
var lookupReferral = createServerFn({ method: "GET" }).validator(object({ code: string() })).handler(createSsrRpc("f3e7ae608e4dbc79a7623bd586dda06e857d221fda4bb4237971fcb6806a500a"));
var markNotificationRead = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({ id: string().optional() })).handler(createSsrRpc("15bf94bd76e8c392fcf27f2f8c3920357e3f48f84a3e78f089a4754d26e3e699"));
var listNotifications = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("86f38247329951960eea54954c1f8a433b29652b8b4265d9284835c12dd9e899"));
var getShell = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("9a0d6e591bd539339ea41ab4ec04a3d96671365e2750990f14dc11afe4acad05"));
//#endregion
export { lookupReferral as a, updateMyProfile as c, listNotifications as i, getMyProfile as n, markNotificationRead as o, getShell as r, setActiveId as s, ensureProfileRow as t };
