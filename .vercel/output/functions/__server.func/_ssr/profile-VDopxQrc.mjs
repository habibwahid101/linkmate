import { r as createServerFn } from "./ssr.mjs";
import { r as getSql } from "./db-D3Vz1JrQ.mjs";
import { t as authMiddleware } from "./middleware-Bb4nqKHv.mjs";
import { n as makeReferralCode } from "./ids-CDOewIuF.mjs";
import { gn as object, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/profile-VDopxQrc.js
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
var getMyProfile_createServerFn_handler = createServerRpc({
	id: "43089abf67b0d2fc04dd8ee11c57f4f4a6f26a675e0ebab772a5634a77d97f36",
	name: "getMyProfile",
	filename: "src/lib/server/profile.ts"
}, (opts) => getMyProfile.__executeServer(opts));
var getMyProfile = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getMyProfile_createServerFn_handler, async ({ context }) => {
	return ensureProfileRow(context.userId, "Member", null);
});
var updateMyProfile_createServerFn_handler = createServerRpc({
	id: "2516a54386004386c896f1a0ac5bdf163cb6fe80f8ce05136f7c7b30edbcc98d",
	name: "updateMyProfile",
	filename: "src/lib/server/profile.ts"
}, (opts) => updateMyProfile.__executeServer(opts));
var updateMyProfile = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	displayName: string().min(1).max(80).optional(),
	phone: string().max(20).optional()
})).handler(updateMyProfile_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	await ensureProfileRow(context.userId, "Member", null);
	if (data.displayName) await sql`update app_users set display_name = ${data.displayName} where user_id = ${context.userId}`;
	if (data.phone !== void 0) await sql`update app_users set phone = ${data.phone} where user_id = ${context.userId}`;
	return ensureProfileRow(context.userId, "Member", null);
});
var setActiveId_createServerFn_handler = createServerRpc({
	id: "e54c9306c1284a092cfa15249d17d09d570b4e537b3c2bcdb6120c31e71cf26c",
	name: "setActiveId",
	filename: "src/lib/server/profile.ts"
}, (opts) => setActiveId.__executeServer(opts));
var setActiveId = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({ memberId: string() })).handler(setActiveId_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	if (!(await sql`
      select id from member_ids where id = ${data.memberId} and owner_user_id = ${context.userId}
    `)[0]) throw new Error("ID not found");
	await sql`update app_users set active_id = ${data.memberId} where user_id = ${context.userId}`;
	return {
		ok: true,
		activeId: data.memberId
	};
});
var lookupReferral_createServerFn_handler = createServerRpc({
	id: "f3e7ae608e4dbc79a7623bd586dda06e857d221fda4bb4237971fcb6806a500a",
	name: "lookupReferral",
	filename: "src/lib/server/profile.ts"
}, (opts) => lookupReferral.__executeServer(opts));
var lookupReferral = createServerFn({ method: "GET" }).validator(object({ code: string() })).handler(lookupReferral_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	const code = data.code.trim().toUpperCase();
	const byUser = await sql`select user_id, display_name, referral_code, active_id from app_users where referral_code = ${code}`;
	if (byUser[0]) {
		let sponsorId = byUser[0].active_id;
		if (!sponsorId) sponsorId = (await sql`
          select id from member_ids where owner_user_id = ${byUser[0].user_id} and is_root = true
          order by created_at asc limit 1
        `)[0]?.id ?? null;
		return {
			valid: true,
			name: byUser[0].display_name,
			referralCode: byUser[0].referral_code,
			sponsorMemberId: sponsorId
		};
	}
	const byId = await sql`select id, owner_user_id from member_ids where id = ${code} or id = ${"LM-" + code}`;
	if (byId[0]) {
		const owner = await sql`
        select display_name, referral_code from app_users where user_id = ${byId[0].owner_user_id}
      `;
		return {
			valid: true,
			name: owner[0]?.display_name ?? "Member",
			referralCode: owner[0]?.referral_code ?? code,
			sponsorMemberId: byId[0].id
		};
	}
	return { valid: false };
});
var markNotificationRead_createServerFn_handler = createServerRpc({
	id: "15bf94bd76e8c392fcf27f2f8c3920357e3f48f84a3e78f089a4754d26e3e699",
	name: "markNotificationRead",
	filename: "src/lib/server/profile.ts"
}, (opts) => markNotificationRead.__executeServer(opts));
var markNotificationRead = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({ id: string().optional() })).handler(markNotificationRead_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	if (data.id) await sql`update notifications set read = true where id = ${data.id} and user_id = ${context.userId}`;
	else await sql`update notifications set read = true where user_id = ${context.userId}`;
	return { ok: true };
});
var listNotifications_createServerFn_handler = createServerRpc({
	id: "86f38247329951960eea54954c1f8a433b29652b8b4265d9284835c12dd9e899",
	name: "listNotifications",
	filename: "src/lib/server/profile.ts"
}, (opts) => listNotifications.__executeServer(opts));
var listNotifications = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listNotifications_createServerFn_handler, async ({ context }) => {
	return (await getSql())`
      select id, title, body, kind, read, created_at
      from notifications where user_id = ${context.userId}
      order by created_at desc limit 50
    `;
});
var getShell_createServerFn_handler = createServerRpc({
	id: "9a0d6e591bd539339ea41ab4ec04a3d96671365e2750990f14dc11afe4acad05",
	name: "getShell",
	filename: "src/lib/server/profile.ts"
}, (opts) => getShell.__executeServer(opts));
var getShell = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getShell_createServerFn_handler, async ({ context }) => {
	const profile = await ensureProfileRow(context.userId, "Member", null);
	const sql = await getSql();
	const unread = await sql`
      select count(*)::int as n from notifications where user_id = ${context.userId} and read = false
    `;
	const idCount = await sql`
      select count(*)::int as n from member_ids where owner_user_id = ${context.userId}
    `;
	return {
		profile,
		unread: unread[0]?.n ?? 0,
		idCount: idCount[0]?.n ?? 0
	};
});
//#endregion
export { getMyProfile_createServerFn_handler, getShell_createServerFn_handler, listNotifications_createServerFn_handler, lookupReferral_createServerFn_handler, markNotificationRead_createServerFn_handler, setActiveId_createServerFn_handler, updateMyProfile_createServerFn_handler };
