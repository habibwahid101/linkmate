import { r as createServerFn } from "./ssr.mjs";
import { r as getSql } from "./db-D3Vz1JrQ.mjs";
import { t as authMiddleware } from "./middleware-Bb4nqKHv.mjs";
import { n as makeReferralCode, r as uid, t as formatMemberId } from "./ids-CDOewIuF.mjs";
import { cn as _enum, gn as object, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { t as ensureProfileRow } from "./profile-DfbQm7Sx.mjs";
import { a as STANDARD_ID_VALUE_BDT, n as PACKAGES, o as commissionPerMember, r as PACKAGE_IDS, s as fullLevelCommission, t as LEVELS } from "./rules-D1_lUvHP.mjs";
import { n as toInt } from "./money-6FOdTEDf.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/member-DboREsXb.js
/**
* Internal package placement.
* Turbo: root + 3 children (completes Level 1 of the root).
* Super Turbo: 1 + 3 + 9.
* Hyper Turbo: first 13 as Super Turbo; remaining 9 stay unplaced
* until an approved placement version is configured.
*/
function planPackagePlacement(packageId, idCount = PACKAGES[packageId].idCount) {
	const ids = Array.from({ length: idCount }, (_, i) => ({
		index: i,
		isRoot: i === 0,
		parentIndex: null,
		sponsorIndex: null,
		position: null,
		placementStatus: "placed"
	}));
	const placeUnder = (parent, children) => {
		children.forEach((c, i) => {
			if (!ids[c]) return;
			ids[c].parentIndex = parent;
			ids[c].sponsorIndex = parent;
			ids[c].position = i + 1;
			ids[c].placementStatus = "placed";
		});
	};
	if (idCount >= 4) placeUnder(0, [
		1,
		2,
		3
	]);
	if (idCount >= 13) {
		placeUnder(1, [
			4,
			5,
			6
		]);
		placeUnder(2, [
			7,
			8,
			9
		]);
		placeUnder(3, [
			10,
			11,
			12
		]);
	}
	if (idCount > 13) for (let i = 13; i < idCount; i++) {
		ids[i].placementStatus = "pending_config";
		ids[i].parentIndex = null;
		ids[i].sponsorIndex = null;
		ids[i].position = null;
	}
	return ids;
}
async function nextMemberCode(sql) {
	const rows = await sql`select nextval('member_id_seq')::int as n`;
	return formatMemberId(rows[0].n);
}
async function notify(sql, userId, kind, title, body) {
	await sql`insert into notifications (id, user_id, title, body, kind)
    values (${uid()}, ${userId}, ${title}, ${body}, ${kind})`;
}
async function audit(sql, actor, action, entityType, entityId, detail) {
	await sql`insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
    values (${uid()}, ${actor}, ${action}, ${entityType}, ${entityId}, ${detail})`;
}
async function ensureLevelRows(sql, memberId) {
	for (const level of LEVELS) {
		const expected = fullLevelCommission(level.level);
		const status = level.level === 1 ? "IN_PROGRESS" : "LOCKED";
		await sql`
      insert into level_progress (
        id, member_id, level, generation, required_members, completed_members,
        remaining_members, accumulated_commission, expected_full_commission, status
      ) values (
        ${uid()}, ${memberId}, ${level.level}, ${level.generation}, ${level.requiredMembers},
        0, ${level.requiredMembers}, 0, ${expected}, ${status}
      )
      on conflict (member_id, level) do nothing
    `;
	}
}
async function ensureWallet(sql, memberId, ownerUserId) {
	await sql`
    insert into wallets (member_id, owner_user_id, available_balance, total_released)
    values (${memberId}, ${ownerUserId}, 0, 0)
    on conflict (member_id) do nothing
  `;
}
async function parentOf(sql, memberId) {
	return (await sql`
    select parent_id from member_ids where id = ${memberId}
  `)[0]?.parent_id ?? null;
}
async function loadMember(sql, id) {
	return (await sql`
    select id, owner_user_id, parent_id, sponsor_id, joining_amount_bdt
    from member_ids where id = ${id}
  `)[0] ?? null;
}
/**
* Credit one generation of commission to a beneficiary for a source join.
* Idempotent via unique event_id.
*/
async function creditCommission(sql, opts) {
	const level = LEVELS.find((l) => l.generation === opts.generation);
	if (!level) return {
		created: false,
		amount: 0
	};
	const amount = commissionPerMember(opts.joiningAmount, level.rate);
	const eventId = `join:${opts.source.id}:${opts.beneficiary.id}:${level.level}`;
	if ((await sql`
    insert into commission_entries (
      id, event_id, beneficiary_user_id, beneficiary_id, source_user_id, source_id,
      source_joining_amount, generation, level, commission_rate, commission_amount,
      status, rule_version
    ) values (
      ${uid()}, ${eventId}, ${opts.beneficiary.owner_user_id}, ${opts.beneficiary.id},
      ${opts.source.owner_user_id}, ${opts.source.id}, ${opts.joiningAmount},
      ${level.generation}, ${level.level}, ${level.rate}, ${amount},
      'HELD', ${1}
    )
    on conflict (event_id) do nothing
    returning id
  `).length === 0) return {
		created: false,
		amount
	};
	await sql`
    insert into held_commissions (member_id, owner_user_id, level, amount)
    values (${opts.beneficiary.id}, ${opts.beneficiary.owner_user_id}, ${level.level}, ${amount})
    on conflict (member_id, level) do update
      set amount = held_commissions.amount + excluded.amount
  `;
	await notify(sql, opts.beneficiary.owner_user_id, "held", "Held commission increased", `${opts.source.id} added ৳${amount.toLocaleString("en-US")} held commission on Level ${level.level}.`);
	return {
		created: true,
		amount
	};
}
async function recountAndMaybeRelease(sql, beneficiaryId) {
	const member = await loadMember(sql, beneficiaryId);
	if (!member) return;
	const directCount = (await sql`
    select count(*)::int as n from sponsor_relationships where sponsor_id = ${beneficiaryId}
  `)[0]?.n ?? 0;
	const genCounts = await sql`
    select generation, count(*)::int as n
    from generation_memberships
    where beneficiary_id = ${beneficiaryId}
    group by generation
  `;
	const byGen = /* @__PURE__ */ new Map();
	for (const row of genCounts) byGen.set(row.generation, row.n);
	const progress = await sql`
    select level, status, accumulated_commission from level_progress
    where member_id = ${beneficiaryId} order by level
  `;
	let previousReleased = true;
	for (const level of LEVELS) {
		const qualifying = level.level === 1 ? directCount : byGen.get(level.generation) ?? 0;
		const heldRows = await sql`
      select coalesce(sum(commission_amount), 0)::int as amount
      from commission_entries
      where beneficiary_id = ${beneficiaryId}
        and level = ${level.level}
        and status = 'HELD'
    `;
		const releasedRows = await sql`
      select coalesce(sum(commission_amount), 0)::int as amount
      from commission_entries
      where beneficiary_id = ${beneficiaryId}
        and level = ${level.level}
        and status = 'RELEASED'
    `;
		const accumulated = (heldRows[0]?.amount ?? 0) + (releasedRows[0]?.amount ?? 0);
		const remaining = Math.max(0, level.requiredMembers - qualifying);
		const met = qualifying >= level.requiredMembers;
		const row = progress.find((p) => p.level === level.level);
		const alreadyReleased = row?.status === "RELEASED";
		let status;
		if (alreadyReleased) status = "RELEASED";
		else if (!previousReleased && level.level > 1) status = met ? "COMPLETED" : qualifying > 0 ? "IN_PROGRESS" : "LOCKED";
		else if (met) status = "COMPLETED";
		else if (qualifying > 0) status = "IN_PROGRESS";
		else if (previousReleased && level.level > 1) status = "ELIGIBLE";
		else if (level.level === 1) status = "IN_PROGRESS";
		else status = "LOCKED";
		const completedAt = met && row?.status !== "RELEASED" ? (/* @__PURE__ */ new Date()).toISOString() : null;
		await sql`
      update level_progress set
        completed_members = ${qualifying},
        remaining_members = ${remaining},
        accumulated_commission = ${accumulated},
        status = ${alreadyReleased ? "RELEASED" : status},
        completed_at = coalesce(completed_at, ${completedAt}::timestamptz)
      where member_id = ${beneficiaryId} and level = ${level.level}
    `;
		if (met && previousReleased && !alreadyReleased && (level.level !== 1 || directCount >= 3)) {
			await releaseLevel(sql, member, level.level, level.generation);
			previousReleased = true;
		} else previousReleased = alreadyReleased || false;
	}
}
async function releaseLevel(sql, beneficiary, level, generation) {
	const held = await sql`
    select id, commission_amount, source_id from commission_entries
    where beneficiary_id = ${beneficiary.id} and level = ${level} and status = 'HELD'
    order by held_at
  `;
	if (held.length === 0) {
		await sql`
      update level_progress
      set status = 'RELEASED', released_at = now()
      where member_id = ${beneficiary.id} and level = ${level}
    `;
		return;
	}
	const total = held.reduce((s, r) => s + Number(r.commission_amount), 0);
	const txId = uid();
	await sql`
    insert into wallet_transactions (
      id, member_id, owner_user_id, type, amount, source, level, generation, status
    ) values (
      ${txId}, ${beneficiary.id}, ${beneficiary.owner_user_id},
      'RELEASE', ${total}, ${"Level " + level + " completion"}, ${level}, ${generation}, 'posted'
    )
  `;
	for (const entry of held) await sql`
      update commission_entries
      set status = 'RELEASED', released_at = now(), wallet_transaction_id = ${txId}
      where id = ${entry.id} and status = 'HELD'
    `;
	await sql`
    insert into wallets (member_id, owner_user_id, available_balance, total_released, updated_at)
    values (${beneficiary.id}, ${beneficiary.owner_user_id}, ${total}, ${total}, now())
    on conflict (member_id) do update set
      available_balance = wallets.available_balance + ${total},
      total_released = wallets.total_released + ${total},
      updated_at = now()
  `;
	await sql`
    insert into held_commissions (member_id, owner_user_id, level, amount)
    values (${beneficiary.id}, ${beneficiary.owner_user_id}, ${level}, 0)
    on conflict (member_id, level) do update set amount = 0
  `;
	await sql`
    update level_progress
    set status = 'RELEASED', released_at = now(), accumulated_commission = ${total}
    where member_id = ${beneficiary.id} and level = ${level}
  `;
	await notify(sql, beneficiary.owner_user_id, "release", `Level ${level} released to wallet`, `৳${total.toLocaleString("en-US")} from Level ${level} is now available in ${beneficiary.id}.`);
	await audit(sql, "system", "commission.release", "level_progress", beneficiary.id, `Released ${total} BDT for ${beneficiary.id} level ${level}`);
}
/**
* Process a newly placed ID: generation memberships, commissions, progress, releases.
*/
async function processNewId(sql, newId) {
	const source = await loadMember(sql, newId);
	if (!source) return;
	const joiningAmount = Number(source.joining_amount_bdt) || 11e3;
	const affected = /* @__PURE__ */ new Set();
	if (source.sponsor_id) {
		const sponsor = await loadMember(sql, source.sponsor_id);
		if (sponsor) {
			await sql`
        insert into generation_memberships (id, beneficiary_id, member_id, generation)
        values (${uid()}, ${sponsor.id}, ${source.id}, 1)
        on conflict (beneficiary_id, member_id) do nothing
      `;
			await creditCommission(sql, {
				beneficiary: sponsor,
				source,
				generation: 1,
				joiningAmount
			});
			affected.add(sponsor.id);
			await notify(sql, sponsor.owner_user_id, "direct", "New direct member", `${source.id} joined under ${sponsor.id}.`);
		}
	}
	let nodeId = source.parent_id;
	let dist = 1;
	while (nodeId && dist <= 9) {
		const ancestor = await loadMember(sql, nodeId);
		if (!ancestor) break;
		await sql`
      insert into generation_memberships (id, beneficiary_id, member_id, generation)
      values (${uid()}, ${ancestor.id}, ${source.id}, ${dist})
      on conflict (beneficiary_id, member_id) do nothing
    `;
		if (!(dist === 1 && source.sponsor_id === ancestor.id)) {
			if (dist >= 2) {
				await creditCommission(sql, {
					beneficiary: ancestor,
					source,
					generation: dist,
					joiningAmount
				});
				await notify(sql, ancestor.owner_user_id, "generation", `${dist === 2 ? "2nd" : dist === 3 ? "3rd" : dist + "th"} generation member counted`, `${source.id} is now in generation ${dist} of ${ancestor.id}.`);
			}
		}
		affected.add(ancestor.id);
		nodeId = await parentOf(sql, ancestor.id);
		dist += 1;
	}
	for (const id of affected) await recountAndMaybeRelease(sql, id);
}
async function createIdsForPurchase(sql, opts) {
	const plan = planPackagePlacement(opts.packageId);
	const codes = [];
	for (let i = 0; i < plan.length; i++) codes.push(await nextMemberCode(sql));
	for (let i = 0; i < plan.length; i++) {
		const p = plan[i];
		const id = codes[i];
		const parentId = p.isRoot ? opts.externalSponsorId : p.parentIndex != null ? codes[p.parentIndex] : null;
		const internalSponsor = p.sponsorIndex != null ? codes[p.sponsorIndex] : null;
		const sponsorId = p.isRoot ? opts.externalSponsorId : internalSponsor;
		await sql`
      insert into member_ids (
        id, owner_user_id, package_id, purchase_id, is_root, sponsor_id, parent_id,
        placement_status, status, joining_amount_bdt
      ) values (
        ${id}, ${opts.userId}, ${opts.packageId}, ${opts.purchaseId}, ${p.isRoot},
        ${sponsorId}, ${parentId}, ${p.placementStatus}, 'active', ${STANDARD_ID_VALUE_BDT}
      )
    `;
		await ensureWallet(sql, id, opts.userId);
		await ensureLevelRows(sql, id);
		if (sponsorId) await sql`
        insert into sponsor_relationships (id, sponsor_id, sponsored_id)
        values (${uid()}, ${sponsorId}, ${id})
        on conflict (sponsored_id) do nothing
      `;
		if (parentId && p.placementStatus === "placed") await sql`
        insert into placement_relationships (id, parent_id, child_id, position)
        values (${uid()}, ${parentId}, ${id}, ${p.position})
        on conflict (child_id) do nothing
      `;
	}
	for (let i = 0; i < plan.length; i++) {
		const p = plan[i];
		if (p.placementStatus === "pending_config" && !p.isRoot && !plan[i].sponsorIndex && !plan[i].parentIndex) continue;
		await processNewId(sql, codes[i]);
	}
	const rootId = codes[0];
	await sql`update package_purchases set root_id = ${rootId} where id = ${opts.purchaseId}`;
	await notify(sql, opts.userId, "ids", "New IDs created", `${codes.length} ID${codes.length === 1 ? "" : "s"} issued for your ${opts.packageId.replace("_", " ")} package. Root: ${rootId}.`);
	return {
		rootId,
		ids: codes
	};
}
async function attachExternalMember(sql, opts) {
	const newId = await nextMemberCode(sql);
	await sql`
    insert into member_ids (
      id, owner_user_id, package_id, is_root, sponsor_id, parent_id,
      placement_status, status, joining_amount_bdt
    ) values (
      ${newId}, ${opts.ownerUserId}, ${opts.packageId}, true,
      ${opts.sponsorMemberId}, ${opts.parentMemberId}, 'placed', 'active', ${STANDARD_ID_VALUE_BDT}
    )
  `;
	await ensureWallet(sql, newId, opts.ownerUserId);
	await ensureLevelRows(sql, newId);
	await sql`
    insert into sponsor_relationships (id, sponsor_id, sponsored_id)
    values (${uid()}, ${opts.sponsorMemberId}, ${newId})
    on conflict (sponsored_id) do nothing
  `;
	await sql`
    insert into placement_relationships (id, parent_id, child_id, position)
    values (${uid()}, ${opts.parentMemberId}, ${newId}, 0)
    on conflict (child_id) do nothing
  `;
	await processNewId(sql, newId);
	return newId;
}
var packageIdSchema = _enum(PACKAGE_IDS);
async function resolveActiveId(userId, preferred) {
	const sql = await getSql();
	if (preferred) {
		const ok = await sql`
      select id from member_ids where id = ${preferred} and owner_user_id = ${userId}
    `;
		if (ok[0]) return ok[0].id;
	}
	const profile = await sql`
    select active_id from app_users where user_id = ${userId}
  `;
	if (profile[0]?.active_id) {
		const ok = await sql`
      select id from member_ids where id = ${profile[0].active_id} and owner_user_id = ${userId}
    `;
		if (ok[0]) return ok[0].id;
	}
	return (await sql`
    select id from member_ids where owner_user_id = ${userId} order by created_at asc limit 1
  `)[0]?.id ?? null;
}
var getDashboard_createServerFn_handler = createServerRpc({
	id: "86db50d1f2d24e1ff6c686f959d1deeded490f33a3712d88f1aca56f39609483",
	name: "getDashboard",
	filename: "src/lib/server/member.ts"
}, (opts) => getDashboard.__executeServer(opts));
var getDashboard = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getDashboard_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	const profile = await ensureProfileRow(context.userId, "Member", null);
	const activeId = await resolveActiveId(context.userId, profile.activeId);
	const ids = await sql`
      select id, package_id, is_root, sponsor_id, parent_id, placement_status, status, created_at
      from member_ids where owner_user_id = ${context.userId}
      order by created_at asc
    `;
	const latestPackage = (await sql`
      select id, package_id, amount_bdt, created_at from package_purchases
      where user_id = ${context.userId} order by created_at desc
    `)[0]?.package_id ?? null;
	const walletAgg = await sql`
      select coalesce(sum(available_balance),0)::int as available,
             coalesce(sum(total_released),0)::int as released
      from wallets where owner_user_id = ${context.userId}
    `;
	const heldAgg = await sql`
      select coalesce(sum(amount),0)::int as held
      from held_commissions where owner_user_id = ${context.userId}
    `;
	let currentLevel = 0;
	let levelProgress = [];
	let directSponsors = 0;
	let generationTotal = 0;
	let idWallet = {
		available: 0,
		held: 0,
		released: 0
	};
	let activeMeta = null;
	if (activeId) {
		activeMeta = ids.find((i) => i.id === activeId) ?? null;
		levelProgress = await sql`
        select level, generation, required_members, completed_members, remaining_members,
               accumulated_commission, expected_full_commission, status
        from level_progress where member_id = ${activeId} order by level
      `;
		const inPlay = [...levelProgress].reverse().find((l) => l.status === "IN_PROGRESS" || l.status === "ELIGIBLE");
		const released = [...levelProgress].reverse().find((l) => l.status === "RELEASED");
		currentLevel = inPlay?.level ?? released?.level ?? 1;
		directSponsors = (await sql`
        select count(*)::int as n from sponsor_relationships where sponsor_id = ${activeId}
      `)[0]?.n ?? 0;
		generationTotal = (await sql`
        select count(*)::int as n from generation_memberships where beneficiary_id = ${activeId}
      `)[0]?.n ?? 0;
		const w = await sql`
        select available_balance, total_released from wallets where member_id = ${activeId}
      `;
		const h = await sql`
        select coalesce(sum(amount),0)::int as held from held_commissions where member_id = ${activeId}
      `;
		idWallet = {
			available: toInt(w[0]?.available_balance),
			released: toInt(w[0]?.total_released),
			held: toInt(h[0]?.held)
		};
	}
	const recentTx = await sql`
      select id, amount, source, level, generation, status, created_at, member_id
      from wallet_transactions where owner_user_id = ${context.userId}
      order by created_at desc limit 6
    `;
	const recentMembers = activeId ? await sql`
          select gm.member_id, gm.generation, u.display_name, m.package_id, m.created_at
          from generation_memberships gm
          join member_ids m on m.id = gm.member_id
          join app_users u on u.user_id = m.owner_user_id
          where gm.beneficiary_id = ${activeId}
          order by m.created_at desc limit 6
        ` : [];
	const unread = await sql`
      select count(*)::int as n from notifications where user_id = ${context.userId} and read = false
    `;
	const next = levelProgress.find((l) => l.status === "IN_PROGRESS" || l.status === "ELIGIBLE") ?? levelProgress.find((l) => l.status === "LOCKED");
	return {
		profile,
		activeId,
		activeMeta,
		ids,
		latestPackage,
		currentLevel,
		directSponsors,
		generationTotal,
		wallet: {
			available: toInt(walletAgg[0]?.available),
			held: toInt(heldAgg[0]?.held),
			released: toInt(walletAgg[0]?.released)
		},
		idWallet,
		levelProgress,
		nextMilestone: next ? {
			level: next.level,
			remaining: next.remaining_members,
			required: next.required_members,
			completed: next.completed_members,
			nextRelease: next.expected_full_commission,
			status: next.status
		} : null,
		recentTx,
		recentMembers,
		unread: unread[0]?.n ?? 0
	};
});
var listMyIds_createServerFn_handler = createServerRpc({
	id: "68de69563b849c9d25bb2c4a24227101c06b46785ce60316f294fde0e2ba340b",
	name: "listMyIds",
	filename: "src/lib/server/member.ts"
}, (opts) => listMyIds.__executeServer(opts));
var listMyIds = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listMyIds_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	await ensureProfileRow(context.userId, "Member", null);
	const rows = await sql`
      select id, package_id, sponsor_id, parent_id, placement_status, status, is_root, created_at
      from member_ids where owner_user_id = ${context.userId} order by created_at asc
    `;
	const out = [];
	for (const row of rows) {
		const w = await sql`
        select available_balance, total_released from wallets where member_id = ${row.id}
      `;
		const h = await sql`
        select coalesce(sum(amount),0)::int as held from held_commissions where member_id = ${row.id}
      `;
		const lvl = await sql`
        select level, status from level_progress
        where member_id = ${row.id} and status in ('IN_PROGRESS','ELIGIBLE')
        order by level asc limit 1
      `;
		const last = await sql`
        select level from level_progress where member_id = ${row.id} and status = 'RELEASED'
        order by level desc limit 1
      `;
		out.push({
			...row,
			held: toInt(h[0]?.held),
			available: toInt(w[0]?.available_balance),
			released: toInt(w[0]?.total_released),
			currentLevel: lvl[0]?.level ?? last[0]?.level ?? 1
		});
	}
	return out;
});
var getTeam_createServerFn_handler = createServerRpc({
	id: "3a00cf749df67a8fed37e98aca9a4be897f1469682e52f43b0ce230aeb738c81",
	name: "getTeam",
	filename: "src/lib/server/member.ts"
}, (opts) => getTeam.__executeServer(opts));
var getTeam = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(object({ memberId: string().optional() }).optional()).handler(getTeam_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const activeId = await resolveActiveId(context.userId, data?.memberId ?? null);
	if (!activeId) return {
		activeId: null,
		levels: [],
		members: []
	};
	return {
		activeId,
		levels: await sql`
      select level, generation, required_members, completed_members, remaining_members, status
      from level_progress where member_id = ${activeId} order by level
    `,
		members: await sql`
      select gm.member_id, gm.generation, u.display_name, m.package_id, m.created_at,
             m.status, m.sponsor_id, m.owner_user_id
      from generation_memberships gm
      join member_ids m on m.id = gm.member_id
      join app_users u on u.user_id = m.owner_user_id
      where gm.beneficiary_id = ${activeId}
      order by gm.generation, m.created_at
    `
	};
});
var getWallet_createServerFn_handler = createServerRpc({
	id: "abc933f88cf98a8fd67497082515ff86cc247120ac480162193e88ae7e13c129",
	name: "getWallet",
	filename: "src/lib/server/member.ts"
}, (opts) => getWallet.__executeServer(opts));
var getWallet = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getWallet_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	await ensureProfileRow(context.userId, "Member", null);
	const wallets = await sql`select member_id, available_balance, total_released from wallets where owner_user_id = ${context.userId}`;
	const held = await sql`
      select member_id, level, amount from held_commissions
      where owner_user_id = ${context.userId} and amount > 0
    `;
	const tx = await sql`
      select id, member_id, type, amount, source, level, generation, related_member_id, status, created_at
      from wallet_transactions where owner_user_id = ${context.userId}
      order by created_at desc limit 100
    `;
	const entries = await sql`
      select id, beneficiary_id, source_id, generation, level, commission_amount, status, held_at, released_at
      from commission_entries where beneficiary_user_id = ${context.userId}
      order by held_at desc limit 100
    `;
	return {
		wallets: wallets.map((w) => ({
			memberId: w.member_id,
			available: toInt(w.available_balance),
			released: toInt(w.total_released)
		})),
		held: held.map((h) => ({
			memberId: h.member_id,
			level: h.level,
			amount: toInt(h.amount)
		})),
		transactions: tx,
		commissions: entries
	};
});
var getLevels_createServerFn_handler = createServerRpc({
	id: "8dfa7b2718dcddc6017608d5413d0401c3def42514777e9bb42aa711c308e4c9",
	name: "getLevels",
	filename: "src/lib/server/member.ts"
}, (opts) => getLevels.__executeServer(opts));
var getLevels = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator(object({ memberId: string().optional() }).optional()).handler(getLevels_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const activeId = await resolveActiveId(context.userId, data?.memberId ?? null);
	if (!activeId) return {
		activeId: null,
		levels: []
	};
	return {
		activeId,
		levels: await sql`
      select level, generation, required_members, completed_members, remaining_members,
             accumulated_commission, expected_full_commission, status, completed_at, released_at
      from level_progress where member_id = ${activeId} order by level
    `
	};
});
var purchasePackage_createServerFn_handler = createServerRpc({
	id: "76fa4f17d3221cc5d8699b50df864f96ecf1d24850958f1514eb92c9cd4c3f95",
	name: "purchasePackage",
	filename: "src/lib/server/member.ts"
}, (opts) => purchasePackage.__executeServer(opts));
var purchasePackage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	packageId: packageIdSchema,
	referralCode: string().optional()
})).handler(purchasePackage_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const profile = await ensureProfileRow(context.userId, "Member", null);
	const pkg = PACKAGES[data.packageId];
	let sponsorMemberId = null;
	const code = data.referralCode?.trim().toUpperCase();
	if (code) {
		const byUser = await sql`
        select user_id, active_id from app_users where referral_code = ${code}
      `;
		if (byUser[0]) {
			sponsorMemberId = byUser[0].active_id;
			if (!sponsorMemberId) sponsorMemberId = (await sql`
            select id from member_ids where owner_user_id = ${byUser[0].user_id}
            order by created_at asc limit 1
          `)[0]?.id ?? null;
		} else sponsorMemberId = (await sql`
          select id from member_ids where id = ${code}
        `)[0]?.id ?? null;
		if (!sponsorMemberId) throw new Error("Invalid referral code");
	}
	const purchaseId = uid();
	const paymentId = uid();
	await sql`
      insert into package_purchases (
        id, user_id, package_id, amount_bdt, id_count, referral_code, sponsor_member_id, payment_status
      ) values (
        ${purchaseId}, ${context.userId}, ${pkg.id}, ${pkg.amountBdt}, ${pkg.idCount},
        ${code ?? null}, ${sponsorMemberId}, 'completed'
      )
    `;
	await sql`
      insert into payments (id, purchase_id, amount_bdt, method, status)
      values (${paymentId}, ${purchaseId}, ${pkg.amountBdt}, 'simulated', 'completed')
    `;
	await sql`
      insert into user_packages (id, user_id, package_id, purchase_id)
      values (${uid()}, ${context.userId}, ${pkg.id}, ${purchaseId})
    `;
	const created = await createIdsForPurchase(sql, {
		userId: context.userId,
		packageId: data.packageId,
		purchaseId,
		externalSponsorId: sponsorMemberId
	});
	if (!profile.activeId) await sql`update app_users set active_id = ${created.rootId} where user_id = ${context.userId}`;
	await sql`
      insert into notifications (id, user_id, title, body, kind)
      values (
        ${uid()}, ${context.userId}, ${"Package purchase successful"},
        ${pkg.name + " is active. " + created.ids.length + " ID(s) issued. Root " + created.rootId + "."},
        'purchase'
      )
    `;
	await sql`
      insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
      values (
        ${uid()}, ${context.userId}, 'package.purchase', 'package_purchases', ${purchaseId},
        ${pkg.id + " " + pkg.amountBdt}
      )
    `;
	return {
		purchaseId,
		rootId: created.rootId,
		ids: created.ids
	};
});
var SAMPLE_NAMES = [
	"Rafi Ahmed",
	"Nusrat Jahan",
	"Tanvir Hasan",
	"Farhana Akter",
	"Imran Hossain",
	"Sadia Rahman",
	"Mehedi Hasan",
	"Ayesha Siddique",
	"Shakib Khan",
	"Lamia Chowdhury",
	"Arif Rahman",
	"Nabila Islam"
];
var loadSampleNetwork_createServerFn_handler = createServerRpc({
	id: "819b48561282beef1f60deb000118bd3d5ba4b763cd4d6aee6f7aedb1480ab66",
	name: "loadSampleNetwork",
	filename: "src/lib/server/member.ts"
}, (opts) => loadSampleNetwork.__executeServer(opts));
var loadSampleNetwork = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(loadSampleNetwork_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	await ensureProfileRow(context.userId, "Member", null);
	if (((await sql`
      select count(*)::int as n from member_ids where owner_user_id = ${context.userId}
    `)[0]?.n ?? 0) > 0) throw new Error("Sample data is only available on a fresh account");
	const purchaseId = uid();
	await sql`
      insert into package_purchases (id, user_id, package_id, amount_bdt, id_count, payment_status)
      values (${purchaseId}, ${context.userId}, 'turbo', 44000, 4, 'completed')
    `;
	await sql`
      insert into payments (id, purchase_id, amount_bdt, method, status)
      values (${uid()}, ${purchaseId}, 44000, 'simulated', 'completed')
    `;
	await sql`
      insert into user_packages (id, user_id, package_id, purchase_id)
      values (${uid()}, ${context.userId}, 'turbo', ${purchaseId})
    `;
	const purchased = await createIdsForPurchase(sql, {
		userId: context.userId,
		packageId: "turbo",
		purchaseId,
		externalSponsorId: null
	});
	const internals = purchased.ids.slice(1);
	for (let i = 0; i < 6; i++) {
		const parent = internals[i % 3];
		const name = SAMPLE_NAMES[i];
		const synthId = `synth-${uid()}`;
		await sql`
        insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
        values (${synthId}, ${name}, ${null}, 'member', ${makeReferralCode(synthId)}, true)
        on conflict (user_id) do nothing
      `;
		await attachExternalMember(sql, {
			ownerUserId: synthId,
			displayName: name,
			email: null,
			packageId: "builder",
			sponsorMemberId: parent,
			parentMemberId: parent
		});
	}
	await sql`update app_users set active_id = ${purchased.rootId} where user_id = ${context.userId}`;
	return {
		rootId: purchased.rootId,
		ids: purchased.ids
	};
});
var simulateDirectJoin_createServerFn_handler = createServerRpc({
	id: "6c3320491b52342635bf4ec32b09d0fc66af52e5aea56dbe2ef2f80c6cc21a8a",
	name: "simulateDirectJoin",
	filename: "src/lib/server/member.ts"
}, (opts) => simulateDirectJoin.__executeServer(opts));
var simulateDirectJoin = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	sponsorMemberId: string(),
	name: string().min(2).max(80),
	packageId: packageIdSchema.optional()
})).handler(simulateDirectJoin_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	if (!(await sql`
      select id from member_ids where id = ${data.sponsorMemberId} and owner_user_id = ${context.userId}
    `)[0]) throw new Error("You can only simulate joins under your own IDs");
	const synthId = `synth-${uid()}`;
	const code = makeReferralCode(synthId + data.name);
	await sql`
      insert into app_users (user_id, display_name, role, referral_code, is_synthetic)
      values (${synthId}, ${data.name}, 'member', ${code}, true)
    `;
	return { memberId: await attachExternalMember(sql, {
		ownerUserId: synthId,
		displayName: data.name,
		email: null,
		packageId: data.packageId ?? "builder",
		sponsorMemberId: data.sponsorMemberId,
		parentMemberId: data.sponsorMemberId
	}) };
});
var getInvite_createServerFn_handler = createServerRpc({
	id: "d545ed3b52c29245e3b31c383075eaf80f9cf3072fcfc5f9d87dd4f0311eeafb",
	name: "getInvite",
	filename: "src/lib/server/member.ts"
}, (opts) => getInvite.__executeServer(opts));
var getInvite = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getInvite_createServerFn_handler, async ({ context }) => {
	const profile = await ensureProfileRow(context.userId, "Member", null);
	const activeId = await resolveActiveId(context.userId, profile.activeId);
	return {
		referralCode: profile.referralCode,
		activeId,
		displayName: profile.displayName
	};
});
var getEarningsByLevel_createServerFn_handler = createServerRpc({
	id: "6bb56d8abc3a4b00b19941d7d54c71d85943c5a2dca1fd14b8dfc8eaf50c426d",
	name: "getEarningsByLevel",
	filename: "src/lib/server/member.ts"
}, (opts) => getEarningsByLevel.__executeServer(opts));
var getEarningsByLevel = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getEarningsByLevel_createServerFn_handler, async ({ context }) => {
	return await (await getSql())`
      select level, generation,
        coalesce(sum(case when status = 'HELD' then commission_amount else 0 end),0)::int as held,
        coalesce(sum(case when status = 'RELEASED' then commission_amount else 0 end),0)::int as released
      from commission_entries
      where beneficiary_user_id = ${context.userId}
      group by level, generation
      order by level
    `;
});
//#endregion
export { getDashboard_createServerFn_handler, getEarningsByLevel_createServerFn_handler, getInvite_createServerFn_handler, getLevels_createServerFn_handler, getTeam_createServerFn_handler, getWallet_createServerFn_handler, listMyIds_createServerFn_handler, loadSampleNetwork_createServerFn_handler, purchasePackage_createServerFn_handler, simulateDirectJoin_createServerFn_handler };
