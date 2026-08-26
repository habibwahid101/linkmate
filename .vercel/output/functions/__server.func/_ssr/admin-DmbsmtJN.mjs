import { r as createServerFn } from "./ssr.mjs";
import { r as getSql } from "./db-D3Vz1JrQ.mjs";
import { t as authMiddleware } from "./middleware-Bb4nqKHv.mjs";
import { r as uid } from "./ids-CDOewIuF.mjs";
import { cn as _enum, gn as object, hn as number, pn as literal, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { t as ensureProfileRow } from "./profile-DfbQm7Sx.mjs";
import { t as LEVELS } from "./rules-D1_lUvHP.mjs";
import { n as toInt } from "./money-6FOdTEDf.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-DmbsmtJN.js
async function requireAdmin(userId) {
	const profile = await ensureProfileRow(userId, "Member", null);
	if (profile.role !== "admin") throw new Error("Forbidden");
	return profile;
}
var getAdminOverview_createServerFn_handler = createServerRpc({
	id: "e5bf6ef5ca6f7c26de29c1c6b19ec76887c31a9570882199379930e50283a51d",
	name: "getAdminOverview",
	filename: "src/lib/server/admin.ts"
}, (opts) => getAdminOverview.__executeServer(opts));
var getAdminOverview = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getAdminOverview_createServerFn_handler, async ({ context }) => {
	await requireAdmin(context.userId);
	const sql = await getSql();
	const users = await sql`select count(*)::int as n from app_users where is_synthetic = false`;
	const allUsers = await sql`select count(*)::int as n from app_users`;
	const ids = await sql`select count(*)::int as n from member_ids where status = 'active'`;
	const dist = await sql`
      select package_id, count(*)::int as n, coalesce(sum(amount_bdt),0)::int as value
      from package_purchases group by package_id
    `;
	const joining = await sql`select coalesce(sum(amount_bdt),0)::int as v from package_purchases`;
	const held = await sql`select coalesce(sum(amount),0)::int as v from held_commissions`;
	const released = await sql`select coalesce(sum(total_released),0)::int as v from wallets`;
	const available = await sql`select coalesce(sum(available_balance),0)::int as v from wallets`;
	const completions = await sql`
      select level, count(*)::int as n from level_progress
      where status in ('COMPLETED','RELEASED') group by level order by level
    `;
	const recentPurchases = await sql`
      select id, user_id, package_id, amount_bdt, created_at
      from package_purchases order by created_at desc limit 8
    `;
	const byPkg = {
		builder: {
			count: 0,
			value: 0
		},
		turbo: {
			count: 0,
			value: 0
		},
		super_turbo: {
			count: 0,
			value: 0
		},
		hyper_turbo: {
			count: 0,
			value: 0
		}
	};
	for (const row of dist) byPkg[row.package_id] = {
		count: row.n,
		value: toInt(row.value)
	};
	return {
		totalUsers: users[0]?.n ?? 0,
		totalAccounts: allUsers[0]?.n ?? 0,
		activeIds: ids[0]?.n ?? 0,
		packages: byPkg,
		joiningValue: toInt(joining[0]?.v),
		held: toInt(held[0]?.v),
		released: toInt(released[0]?.v),
		walletLiabilities: toInt(available[0]?.v),
		completions,
		recentPurchases,
		levels: LEVELS
	};
});
var adminListUsers_createServerFn_handler = createServerRpc({
	id: "9cd091d0a1b175bd96dcf2adffc8f997cf0f77ac2515ad72b0b8464750ecd0f5",
	name: "adminListUsers",
	filename: "src/lib/server/admin.ts"
}, (opts) => adminListUsers.__executeServer(opts));
var adminListUsers = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(adminListUsers_createServerFn_handler, async ({ context }) => {
	await requireAdmin(context.userId);
	return (await getSql())`
      select u.user_id, u.display_name, u.email, u.role, u.referral_code, u.is_synthetic, u.created_at,
             (select count(*)::int from member_ids m where m.owner_user_id = u.user_id) as id_count
      from app_users u
      order by u.created_at desc
      limit 200
    `;
});
var adminListIds_createServerFn_handler = createServerRpc({
	id: "e9d13511ffe3d08ccb74d51a894757c5c0fc79d8ccf4279b99852eb7eccae2b5",
	name: "adminListIds",
	filename: "src/lib/server/admin.ts"
}, (opts) => adminListIds.__executeServer(opts));
var adminListIds = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(adminListIds_createServerFn_handler, async ({ context }) => {
	await requireAdmin(context.userId);
	return (await getSql())`
      select m.id, m.owner_user_id, u.display_name, m.package_id, m.sponsor_id, m.parent_id,
             m.placement_status, m.status, m.created_at
      from member_ids m
      join app_users u on u.user_id = m.owner_user_id
      order by m.created_at desc
      limit 300
    `;
});
var adminListPurchases_createServerFn_handler = createServerRpc({
	id: "1ec5ee082bc6465673c72d432e01df1c4c0d885374ba899e2a9681986d64dba3",
	name: "adminListPurchases",
	filename: "src/lib/server/admin.ts"
}, (opts) => adminListPurchases.__executeServer(opts));
var adminListPurchases = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(adminListPurchases_createServerFn_handler, async ({ context }) => {
	await requireAdmin(context.userId);
	return (await getSql())`
      select p.id, p.user_id, u.display_name, p.package_id, p.amount_bdt, p.id_count,
             p.root_id, p.payment_status, p.created_at
      from package_purchases p
      join app_users u on u.user_id = p.user_id
      order by p.created_at desc
      limit 200
    `;
});
var adminListCommissions_createServerFn_handler = createServerRpc({
	id: "78f596f95c34f3b694d47191581af232a78717850eeaf43d47d7227c6723320f",
	name: "adminListCommissions",
	filename: "src/lib/server/admin.ts"
}, (opts) => adminListCommissions.__executeServer(opts));
var adminListCommissions = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(object({ status: string().optional() }).optional()).handler(adminListCommissions_createServerFn_handler, async ({ context, data }) => {
	await requireAdmin(context.userId);
	const sql = await getSql();
	if (data?.status) return sql`
        select id, beneficiary_id, source_id, level, generation, commission_amount, status, held_at, released_at
        from commission_entries where status = ${data.status}
        order by held_at desc limit 300
      `;
	return sql`
      select id, beneficiary_id, source_id, level, generation, commission_amount, status, held_at, released_at
      from commission_entries
      order by held_at desc limit 300
    `;
});
var adminListWallets_createServerFn_handler = createServerRpc({
	id: "e21c08ccc1fc399eda27c4fa5ab0247c905ac9b85163060db5dd0df9d33d5dbe",
	name: "adminListWallets",
	filename: "src/lib/server/admin.ts"
}, (opts) => adminListWallets.__executeServer(opts));
var adminListWallets = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(adminListWallets_createServerFn_handler, async ({ context }) => {
	await requireAdmin(context.userId);
	return (await getSql())`
      select w.member_id, w.owner_user_id, u.display_name, w.available_balance, w.total_released
      from wallets w
      join app_users u on u.user_id = w.owner_user_id
      order by w.available_balance desc
      limit 300
    `;
});
var adminListTransactions_createServerFn_handler = createServerRpc({
	id: "b290c3ecb384acb9c608cac762eee5cf2f9526835e95a8ec7775920fe1d2dc9f",
	name: "adminListTransactions",
	filename: "src/lib/server/admin.ts"
}, (opts) => adminListTransactions.__executeServer(opts));
var adminListTransactions = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(adminListTransactions_createServerFn_handler, async ({ context }) => {
	await requireAdmin(context.userId);
	return (await getSql())`
      select id, member_id, owner_user_id, type, amount, source, level, status, created_at
      from wallet_transactions order by created_at desc limit 300
    `;
});
var adminListAudit_createServerFn_handler = createServerRpc({
	id: "37c92527c9884f78c60f96e106fcb0e9cd450184c2c311caf257fe5d3b43a814",
	name: "adminListAudit",
	filename: "src/lib/server/admin.ts"
}, (opts) => adminListAudit.__executeServer(opts));
var adminListAudit = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(adminListAudit_createServerFn_handler, async ({ context }) => {
	await requireAdmin(context.userId);
	return (await getSql())`
      select id, actor_user_id, action, entity_type, entity_id, detail, created_at
      from audit_logs order by created_at desc limit 200
    `;
});
var adminGetSettings_createServerFn_handler = createServerRpc({
	id: "7c6b82e0ce0bba37c904ef67f1d4882c6dde8ee39f59dcea6d97c8935c479940",
	name: "adminGetSettings",
	filename: "src/lib/server/admin.ts"
}, (opts) => adminGetSettings.__executeServer(opts));
var adminGetSettings = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(adminGetSettings_createServerFn_handler, async ({ context }) => {
	await requireAdmin(context.userId);
	const sql = await getSql();
	return {
		settings: await sql`
      select key, value, updated_at from app_settings order by key
    `,
		packages: await sql`select id, name, amount_bdt, id_count, placement_rule_version, active, locked from packages order by amount_bdt`,
		rules: await sql`select level, generation, generation_label, required_member_count, rate::text, status, version from commission_rules order by level`
	};
});
var adminUpdateSetting_createServerFn_handler = createServerRpc({
	id: "298d982d6fd8f17cccca62dc2ec1c725a519509f0b532d1034a89249eddcd4b5",
	name: "adminUpdateSetting",
	filename: "src/lib/server/admin.ts"
}, (opts) => adminUpdateSetting.__executeServer(opts));
var adminUpdateSetting = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	key: string(),
	value: string(),
	confirm: literal(true)
})).handler(adminUpdateSetting_createServerFn_handler, async ({ context, data }) => {
	await requireAdmin(context.userId);
	const sql = await getSql();
	if (["standard_id_value_bdt"].includes(data.key)) throw new Error("This setting is locked");
	await sql`
      insert into app_settings (key, value, updated_by, updated_at)
      values (${data.key}, ${data.value}, ${context.userId}, now())
      on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()
    `;
	await sql`
      insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
      values (${uid()}, ${context.userId}, 'settings.update', 'app_settings', ${data.key}, ${data.value})
    `;
	return { ok: true };
});
var adminSetRole_createServerFn_handler = createServerRpc({
	id: "ad071b116bb6bfd69b4fa28ecbf96275a634abb71cb7bcc43cb484d3985c37e0",
	name: "adminSetRole",
	filename: "src/lib/server/admin.ts"
}, (opts) => adminSetRole.__executeServer(opts));
var adminSetRole = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	userId: string(),
	role: _enum(["member", "admin"])
})).handler(adminSetRole_createServerFn_handler, async ({ context, data }) => {
	await requireAdmin(context.userId);
	const sql = await getSql();
	await sql`update app_users set role = ${data.role} where user_id = ${data.userId}`;
	await sql`
      insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
      values (${uid()}, ${context.userId}, 'user.role', 'app_users', ${data.userId}, ${data.role})
    `;
	return { ok: true };
});
var adminLedgerAdjustment_createServerFn_handler = createServerRpc({
	id: "16f22eeafed779aa9ebfc81e71141a091ba1e5aca9e54abb59917473c344ffe6",
	name: "adminLedgerAdjustment",
	filename: "src/lib/server/admin.ts"
}, (opts) => adminLedgerAdjustment.__executeServer(opts));
var adminLedgerAdjustment = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	memberId: string(),
	amount: number().int(),
	reason: string().min(3).max(200),
	confirm: literal(true)
})).handler(adminLedgerAdjustment_createServerFn_handler, async ({ context, data }) => {
	await requireAdmin(context.userId);
	const sql = await getSql();
	const wallet = await sql`
      select owner_user_id, available_balance from wallets where member_id = ${data.memberId}
    `;
	if (!wallet[0]) throw new Error("Wallet not found");
	const txId = uid();
	await sql`
      insert into wallet_transactions (
        id, member_id, owner_user_id, type, amount, source, status
      ) values (
        ${txId}, ${data.memberId}, ${wallet[0].owner_user_id}, 'ADJUSTMENT', ${data.amount}, ${data.reason}, 'posted'
      )
    `;
	await sql`
      update wallets set
        available_balance = available_balance + ${data.amount},
        updated_at = now()
      where member_id = ${data.memberId}
    `;
	await sql`
      insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
      values (${uid()}, ${context.userId}, 'wallet.adjustment', 'wallets', ${data.memberId}, ${data.reason + " " + data.amount})
    `;
	return {
		ok: true,
		txId
	};
});
var adminNetwork_createServerFn_handler = createServerRpc({
	id: "0e80bf548162b554218c68b6e881693310a8c22de11b0df003d2c1290b890a16",
	name: "adminNetwork",
	filename: "src/lib/server/admin.ts"
}, (opts) => adminNetwork.__executeServer(opts));
var adminNetwork = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(object({ memberId: string().optional() }).optional()).handler(adminNetwork_createServerFn_handler, async ({ context, data }) => {
	await requireAdmin(context.userId);
	const sql = await getSql();
	const roots = await sql`
      select m.id, u.display_name, m.package_id, m.owner_user_id
      from member_ids m
      join app_users u on u.user_id = m.owner_user_id
      where m.is_root = true
      order by m.created_at desc
      limit 50
    `;
	const focus = data?.memberId ?? roots[0]?.id ?? null;
	if (!focus) return {
		roots,
		focus: null,
		children: [],
		progress: []
	};
	return {
		roots,
		focus,
		children: await sql`
      select p.child_id, p.parent_id, u.display_name, m.package_id, gm.generation
      from placement_relationships p
      join member_ids m on m.id = p.child_id
      join app_users u on u.user_id = m.owner_user_id
      left join generation_memberships gm on gm.member_id = p.child_id and gm.beneficiary_id = ${focus}
      where p.parent_id = ${focus} or gm.beneficiary_id = ${focus}
      order by coalesce(gm.generation, 1), m.created_at
      limit 200
    `,
		progress: await sql`
      select level, completed_members, required_members, status
      from level_progress where member_id = ${focus} order by level
    `
	};
});
var adminReports_createServerFn_handler = createServerRpc({
	id: "775544cd4797e6667cb2288df4214dbe8b6899e0d473eb91c8dfb6631a4a4fe5",
	name: "adminReports",
	filename: "src/lib/server/admin.ts"
}, (opts) => adminReports.__executeServer(opts));
var adminReports = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(adminReports_createServerFn_handler, async ({ context }) => {
	await requireAdmin(context.userId);
	const sql = await getSql();
	const sales = await sql`
      select package_id, count(*)::int as n, coalesce(sum(amount_bdt),0)::int as value
      from package_purchases group by package_id
    `;
	const liability = await sql`
      select
        (select coalesce(sum(amount),0)::int from held_commissions) as held,
        (select coalesce(sum(total_released),0)::int from wallets) as released,
        (select coalesce(sum(available_balance),0)::int from wallets) as available
    `;
	const growth = await sql`
      select to_char(created_at, 'YYYY-MM-DD') as day, count(*)::int as n
      from app_users
      group by 1
      order by 1 desc
      limit 14
    `;
	const idGrowth = await sql`
      select to_char(created_at, 'YYYY-MM-DD') as day, count(*)::int as n
      from member_ids
      group by 1
      order by 1 desc
      limit 14
    `;
	return {
		sales,
		liability: liability[0],
		growth,
		idGrowth
	};
});
var adminListNotifications_createServerFn_handler = createServerRpc({
	id: "15a27df3bcbac659a77bb61500dcfb9b1e62eb397a492d579be8c3048a9872a5",
	name: "adminListNotifications",
	filename: "src/lib/server/admin.ts"
}, (opts) => adminListNotifications.__executeServer(opts));
var adminListNotifications = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(adminListNotifications_createServerFn_handler, async ({ context }) => {
	await requireAdmin(context.userId);
	return (await getSql())`
      select n.id, n.user_id, u.display_name, n.title, n.body, n.kind, n.read, n.created_at
      from notifications n
      join app_users u on u.user_id = n.user_id
      order by n.created_at desc
      limit 200
    `;
});
//#endregion
export { adminGetSettings_createServerFn_handler, adminLedgerAdjustment_createServerFn_handler, adminListAudit_createServerFn_handler, adminListCommissions_createServerFn_handler, adminListIds_createServerFn_handler, adminListNotifications_createServerFn_handler, adminListPurchases_createServerFn_handler, adminListTransactions_createServerFn_handler, adminListUsers_createServerFn_handler, adminListWallets_createServerFn_handler, adminNetwork_createServerFn_handler, adminReports_createServerFn_handler, adminSetRole_createServerFn_handler, adminUpdateSetting_createServerFn_handler, getAdminOverview_createServerFn_handler };
