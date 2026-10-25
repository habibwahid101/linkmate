import {
  LEVELS,
  STANDARD_ID_VALUE_BDT,
  RULE_VERSION,
  commissionPerMember,
  fullLevelCommission,
  getLevel,
} from "../rules.ts";
import { uid } from "./ids.ts";
import { recordDesignationCredit, voidDesignationCredit } from "./designations.ts";
import {
  activationEventId,
  joinEventId,
  reversalTxId,
} from "./level-state.ts";

export type Sql = {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
  withTransaction?: <T>(fn: (sql: Sql) => Promise<T>) => Promise<T>;
};

export type MemberRow = {
  id: string;
  owner_user_id: string;
  parent_id: string | null;
  sponsor_id: string | null;
  joining_amount_bdt: number | string;
  purchase_id: string | null;
  is_root: boolean;
  current_level?: number | string;
  progression_status?: string;
};

export type SponsorHop = { ancestorId: string; generation: number };

const ANCESTRY_HOP_GUARD = 10_000;

const memberLocks: Map<string, Promise<unknown>> =
  ((globalThis as typeof globalThis & { __lmMemberLocks?: Map<string, Promise<unknown>> }).__lmMemberLocks ??=
    new Map());

async function withMemberLock<T>(memberId: string, fn: () => Promise<T>): Promise<T> {
  const prev = memberLocks.get(memberId);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  memberLocks.set(memberId, gate);
  if (prev) await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (memberLocks.get(memberId) === gate) memberLocks.delete(memberId);
  }
}

async function notify(
  sql: Sql,
  userId: string,
  kind: string,
  title: string,
  body: string,
) {
  await sql`insert into notifications (id, user_id, title, body, kind)
    values (${uid()}, ${userId}, ${title}, ${body}, ${kind})`;
}

async function audit(
  sql: Sql,
  actor: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  detail: string,
) {
  await sql`insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
    values (${uid()}, ${actor}, ${action}, ${entityType}, ${entityId}, ${detail})`;
}

export async function loadMember(sql: Sql, id: string): Promise<MemberRow | null> {
  const rows = await sql<MemberRow>`
    select id, owner_user_id, parent_id, sponsor_id, joining_amount_bdt, purchase_id, is_root,
           current_level, progression_status
    from member_ids where id = ${id}
  `;
  return rows[0] ?? null;
}

export async function wouldCreateSponsorCycle(
  sql: Sql,
  childId: string,
  sponsorId: string | null,
): Promise<boolean> {
  if (!sponsorId) return false;
  if (sponsorId === childId) return true;
  const rows = await sql<{ id: string }>`
    with recursive chain as (
      select ${sponsorId}::text as id, array[${sponsorId}::text] as seen, false as looped
      union all
      select m.sponsor_id, c.seen || m.sponsor_id, m.sponsor_id = any(c.seen)
      from chain c
      join member_ids m on m.id = c.id
      where m.sponsor_id is not null
        and not c.looped
        and cardinality(c.seen) < ${ANCESTRY_HOP_GUARD}
    )
    select id from chain where looped or id = ${childId} limit 1
  `;
  return rows.length > 0;
}

export async function assertAcyclicSponsor(
  sql: Sql,
  childId: string,
  sponsorId: string | null,
): Promise<void> {
  if (await wouldCreateSponsorCycle(sql, childId, sponsorId)) {
    throw new Error("Sponsor cycle not allowed");
  }
}

export async function wouldCreatePlacementCycle(
  sql: Sql,
  childId: string,
  parentId: string | null,
): Promise<boolean> {
  if (!parentId) return false;
  if (parentId === childId) return true;
  const rows = await sql<{ id: string }>`
    with recursive chain as (
      select ${parentId}::text as id, array[${parentId}::text] as seen, false as looped
      union all
      select m.parent_id, c.seen || m.parent_id, m.parent_id = any(c.seen)
      from chain c
      join member_ids m on m.id = c.id
      where m.parent_id is not null
        and not c.looped
        and cardinality(c.seen) < ${ANCESTRY_HOP_GUARD}
    )
    select id from chain where looped or id = ${childId} limit 1
  `;
  return rows.length > 0;
}

type CompanyShare = {
  percent: number;
  beneficiaries: string[];
  exempt: Set<string>;
};

/** One purchase. Settings and sponsor counts do not change while its IDs activate. */
export type ActivationMemo = {
  cutover: boolean | null;
  share: CompanyShare | null;
  sponsorCount: Map<string, number>;
  backfilled: Set<string>;
  levelsReady: Set<string>;
  members: Map<string, MemberRow>;
  walletsReady: Set<string>;
};

export function createActivationMemo(): ActivationMemo {
  return {
    cutover: null,
    share: null,
    sponsorCount: new Map(),
    backfilled: new Set(),
    levelsReady: new Set(),
    members: new Map(),
    walletsReady: new Set(),
  };
}

function parseIdList(value: string | undefined): string[] {
  return String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function readCompanyShare(sql: Sql, memo?: ActivationMemo): Promise<CompanyShare> {
  if (memo?.share) return memo.share;
  const rows = await sql<{ key: string; value: string | null }>`
    select key, value from app_settings
    where key in (
      'company_share_percent',
      'company_share_member_ids',
      'company_level_exempt_member_ids'
    )
  `;
  const map = new Map(rows.map((row) => [row.key, String(row.value ?? "").trim()]));
  const percent = Number(map.get("company_share_percent") || "0");
  const safePercent = Number.isFinite(percent) && percent > 0 && percent <= 100 ? percent : 0;
  const share: CompanyShare = {
    percent: safePercent,
    beneficiaries: parseIdList(map.get("company_share_member_ids")),
    exempt: new Set(parseIdList(map.get("company_level_exempt_member_ids"))),
  };
  if (memo) memo.share = share;
  return share;
}

/** Immediate wallet credit. Not held, and not a level release. */
export async function applyCompanyShare(
  sql: Sql,
  sourceId: string,
  joiningAmount: number,
  share: CompanyShare,
  memo?: ActivationMemo,
): Promise<void> {
  if (share.percent <= 0 || share.beneficiaries.length === 0) return;
  if (share.beneficiaries.includes(sourceId)) return;
  const amount = Math.round((joiningAmount * share.percent) / 100);
  if (amount <= 0) return;
  for (const beneficiaryId of share.beneficiaries) {
    let beneficiary = memo?.members.get(beneficiaryId) ?? null;
    if (!beneficiary) {
      beneficiary = await loadMember(sql, beneficiaryId);
      if (beneficiary) memo?.members.set(beneficiaryId, beneficiary);
    }
    if (!beneficiary) continue;
    if (!memo?.walletsReady.has(beneficiary.id)) {
      await ensureWallet(sql, beneficiary.id, beneficiary.owner_user_id);
      memo?.walletsReady.add(beneficiary.id);
    }
    const inserted = await sql<{ id: string }>`
      insert into wallet_transactions (
        id, member_id, owner_user_id, type, amount, source, related_member_id, status
      ) values (
        ${"company:" + sourceId + ":" + beneficiary.id},
        ${beneficiary.id},
        ${beneficiary.owner_user_id},
        'COMPANY_SHARE',
        ${amount},
        ${"Company share " + share.percent + "%"},
        ${sourceId},
        'posted'
      )
      on conflict (id) do nothing
      returning id
    `;
    if (inserted.length === 0) continue;
    await sql`
      update wallets set
        available_balance = available_balance + ${amount},
        updated_at = now()
      where member_id = ${beneficiary.id}
    `;
  }
}

export async function placementCutoverActive(sql: Sql, memo?: ActivationMemo): Promise<boolean> {
  if (memo?.cutover != null) return memo.cutover;
  const rows = await sql<{ value: string | null }>`
    select value from app_settings where key = 'placement_rules_cutover_at'
  `;
  const raw = String(rows[0]?.value ?? "").trim();
  if (!raw) {
    if (memo) memo.cutover = false;
    return false;
  }
  const at = Date.parse(raw);
  const active = !Number.isNaN(at) && at <= Date.now();
  if (memo) memo.cutover = active;
  return active;
}

/** Before cutover, sponsor and placement parent must be the same ID. */
export function assertPlacementParentAllowed(
  sponsorId: string | null,
  parentId: string | null,
  cutoverActive: boolean,
): void {
  if (cutoverActive) return;
  if ((sponsorId ?? null) !== (parentId ?? null)) {
    throw new Error("Placement parent must match the sponsor until cutover");
  }
}

/** After cutover, a new external ID can be placed under an ID that has fewer than 3 direct children. */
export async function assertPlacementParentIsLeaf(
  sql: Sql,
  parentId: string | null,
  cutoverActive: boolean,
): Promise<void> {
  if (!cutoverActive || !parentId) return;
  await sql`select id from member_ids where id = ${parentId} for update`;
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from member_ids where parent_id = ${parentId}
  `;
  if (Number(rows[0]?.n ?? 0) >= 3) {
    throw new Error("This ID already has 3 people under it. Place under an ID that has fewer than 3.");
  }
}

export async function assertAcyclicPlacement(
  sql: Sql,
  childId: string,
  parentId: string | null,
): Promise<void> {
  if (await wouldCreatePlacementCycle(sql, childId, parentId)) {
    throw new Error("Placement cycle not allowed");
  }
}

/** Sponsor-tree walk. Depth is informational; not a level. No 9-hop cap. */
export async function walkSponsorAncestry(sql: Sql, memberId: string): Promise<SponsorHop[]> {
  const rows = await sql<{ ancestor_id: string; generation: number }>`
    with recursive chain as (
      select m.sponsor_id as ancestor_id, 1 as generation, array[m.id, m.sponsor_id] as seen
      from member_ids m
      where m.id = ${memberId} and m.sponsor_id is not null
      union all
      select p.sponsor_id, c.generation + 1, c.seen || p.sponsor_id
      from chain c
      join member_ids p on p.id = c.ancestor_id
      where p.sponsor_id is not null
        and not (p.sponsor_id = any(c.seen))
        and c.generation < ${ANCESTRY_HOP_GUARD}
    )
    select ancestor_id, generation from chain order by generation
  `;
  return rows.map((row) => ({ ancestorId: row.ancestor_id, generation: Number(row.generation) }));
}

/** Placement-tree walk. Used only for activations stamped placement. */
export async function walkPlacementAncestry(sql: Sql, memberId: string): Promise<SponsorHop[]> {
  const rows = await sql<{ ancestor_id: string; generation: number }>`
    with recursive chain as (
      select m.parent_id as ancestor_id, 1 as generation, array[m.id, m.parent_id] as seen
      from member_ids m
      where m.id = ${memberId} and m.parent_id is not null
      union all
      select p.parent_id, c.generation + 1, c.seen || p.parent_id
      from chain c
      join member_ids p on p.id = c.ancestor_id
      where p.parent_id is not null
        and not (p.parent_id = any(c.seen))
        and c.generation < ${ANCESTRY_HOP_GUARD}
    )
    select ancestor_id, generation from chain order by generation
  `;
  return rows.map((row) => ({ ancestorId: row.ancestor_id, generation: Number(row.generation) }));
}

export async function reconcileWallet(sql: Sql, memberId: string) {
  const rows = await sql<{ available: number; released: number }>`
    select
      coalesce(sum(amount), 0)::int as available,
      coalesce(sum(case when type in ('RELEASE', 'REVERSAL') then amount else 0 end), 0)::int as released
    from wallet_transactions
    where member_id = ${memberId} and status = 'posted'
  `;
  const available = Number(rows[0]?.available ?? 0);
  await sql`
    update wallets set
      available_balance = ${available},
      total_released = ${rows[0]?.released ?? 0},
      updated_at = now()
    where member_id = ${memberId}
  `;
}

async function rebuildHeld(sql: Sql, memberId: string, ownerUserId: string) {
  await sql`delete from held_commissions where member_id = ${memberId}`;
  await sql`
    insert into held_commissions (member_id, owner_user_id, level, amount)
    select ${memberId}, ${ownerUserId}, level, coalesce(sum(commission_amount), 0)::int
    from commission_entries
    where beneficiary_id = ${memberId} and status = 'HELD'
    group by level
  `;
}

export async function ensureLevelRows(sql: Sql, memberId: string, memo?: ActivationMemo) {
  if (memo?.levelsReady.has(memberId)) return;
  const rows = LEVELS.map((level) => ({
    id: uid(),
    level: level.level,
    generation: level.generation,
    required: level.requiredMembers,
    expected: fullLevelCommission(level.level),
    status: level.level === 1 ? "IN_PROGRESS" : "LOCKED",
  }));
  const r = rows;
  await sql`
    insert into level_progress (
      id, member_id, level, generation, required_members, completed_members,
      remaining_members, accumulated_commission, expected_full_commission, status
    ) values
      (${r[0]!.id}, ${memberId}, ${r[0]!.level}, ${r[0]!.generation}, ${r[0]!.required}, 0, ${r[0]!.required}, 0, ${r[0]!.expected}, ${r[0]!.status}),
      (${r[1]!.id}, ${memberId}, ${r[1]!.level}, ${r[1]!.generation}, ${r[1]!.required}, 0, ${r[1]!.required}, 0, ${r[1]!.expected}, ${r[1]!.status}),
      (${r[2]!.id}, ${memberId}, ${r[2]!.level}, ${r[2]!.generation}, ${r[2]!.required}, 0, ${r[2]!.required}, 0, ${r[2]!.expected}, ${r[2]!.status}),
      (${r[3]!.id}, ${memberId}, ${r[3]!.level}, ${r[3]!.generation}, ${r[3]!.required}, 0, ${r[3]!.required}, 0, ${r[3]!.expected}, ${r[3]!.status}),
      (${r[4]!.id}, ${memberId}, ${r[4]!.level}, ${r[4]!.generation}, ${r[4]!.required}, 0, ${r[4]!.required}, 0, ${r[4]!.expected}, ${r[4]!.status}),
      (${r[5]!.id}, ${memberId}, ${r[5]!.level}, ${r[5]!.generation}, ${r[5]!.required}, 0, ${r[5]!.required}, 0, ${r[5]!.expected}, ${r[5]!.status}),
      (${r[6]!.id}, ${memberId}, ${r[6]!.level}, ${r[6]!.generation}, ${r[6]!.required}, 0, ${r[6]!.required}, 0, ${r[6]!.expected}, ${r[6]!.status}),
      (${r[7]!.id}, ${memberId}, ${r[7]!.level}, ${r[7]!.generation}, ${r[7]!.required}, 0, ${r[7]!.required}, 0, ${r[7]!.expected}, ${r[7]!.status}),
      (${r[8]!.id}, ${memberId}, ${r[8]!.level}, ${r[8]!.generation}, ${r[8]!.required}, 0, ${r[8]!.required}, 0, ${r[8]!.expected}, ${r[8]!.status})
    on conflict (member_id, level) do nothing
  `;
  memo?.levelsReady.add(memberId);
}

export async function ensureWallet(sql: Sql, memberId: string, ownerUserId: string) {
  await sql`
    insert into wallets (member_id, owner_user_id, available_balance, total_released)
    values (${memberId}, ${ownerUserId}, 0, 0)
    on conflict (member_id) do update
      set owner_user_id = excluded.owner_user_id
      where wallets.owner_user_id is distinct from excluded.owner_user_id
  `;
}

async function releaseLevel(sql: Sql, beneficiary: MemberRow, level: number) {
  const prior = await sql<{ n: number }>`
    select count(*)::int as n from wallet_transactions
    where member_id = ${beneficiary.id} and level = ${level} and type = 'RELEASE'
  `;
  const txId = `release:${beneficiary.id}:${level}:${prior[0]?.n ?? 0}`;
  const claimed = await sql<{ id: string; commission_amount: number }>`
    update commission_entries
    set status = 'RELEASED', released_at = now(), wallet_transaction_id = ${txId}
    where beneficiary_id = ${beneficiary.id} and level = ${level} and status = 'HELD'
      and ancestry_model = 'sponsor'
    returning id, commission_amount
  `;
  if (claimed.length === 0) {
    const pending = await sql<{ n: number }>`
      select count(*)::int as n from commission_entries
      where beneficiary_id = ${beneficiary.id} and level = ${level} and status = 'HELD'
    `;
    if (Number(pending[0]?.n ?? 0) > 0) return 0;
    await sql`
      update level_progress
      set status = 'RELEASED', released_at = coalesce(released_at, now())
      where member_id = ${beneficiary.id} and level = ${level}
    `;
    return 0;
  }

  const total = claimed.reduce((s, r) => s + Number(r.commission_amount), 0);
  const generation = getLevel(level).generation;

  await sql`
    insert into wallet_transactions (
      id, member_id, owner_user_id, type, amount, source, level, generation, status
    ) values (
      ${txId}, ${beneficiary.id}, ${beneficiary.owner_user_id},
      'RELEASE', ${total}, ${"Level " + level + " completion"}, ${level}, ${generation}, 'posted'
    )
    on conflict (id) do nothing
  `;

  await reconcileWallet(sql, beneficiary.id);

  const left = await sql<{ amount: number }>`
    select coalesce(sum(commission_amount), 0)::int as amount
    from commission_entries
    where beneficiary_id = ${beneficiary.id} and level = ${level} and status = 'HELD'
  `;
  await sql`
    insert into held_commissions (member_id, owner_user_id, level, amount)
    values (${beneficiary.id}, ${beneficiary.owner_user_id}, ${level}, ${Number(left[0]?.amount ?? 0)})
    on conflict (member_id, level) do update set amount = excluded.amount
  `;

  await sql`
    update level_progress
    set status = 'RELEASED',
        released_at = coalesce(released_at, now()),
        completed_at = coalesce(completed_at, now())
    where member_id = ${beneficiary.id} and level = ${level}
  `;

  await notify(
    sql,
    beneficiary.owner_user_id,
    "release",
    `Level ${level} released to wallet`,
    `৳${total.toLocaleString("en-US")} from Level ${level} is now available in ${beneficiary.id}.`,
  );

  await audit(
    sql,
    "system",
    "commission.release",
    "level_progress",
    beneficiary.id,
    `Released ${total} BDT for ${beneficiary.id} level ${level}`,
  );
  return total;
}

async function advanceAfterCompletion(sql: Sql, beneficiary: MemberRow, completedLevel: number) {
  if (completedLevel >= 9) {
    await sql`
      update member_ids
      set progression_status = 'GRADUATED', current_level = 9
      where id = ${beneficiary.id}
    `;
    return;
  }
  const nextLevel = completedLevel + 1;
  await sql`
    update member_ids
    set current_level = ${nextLevel}, progression_status = 'ACTIVE'
    where id = ${beneficiary.id} and progression_status = 'ACTIVE'
  `;
  await sql`
    update level_progress
    set status = 'IN_PROGRESS',
        completed_members = 0,
        remaining_members = required_members
    where member_id = ${beneficiary.id} and level = ${nextLevel} and status = 'LOCKED'
  `;
}

export type PlacementReleaseFailAt =
  | "before-placement-claim"
  | "after-placement-claim"
  | "after-placement-wallet"
  | "before-legacy-wallet"
  | "reconcile"
  | "advance";

/**
 * S-Wait settlement. Runs only after cutover, and only when the placement
 * counter has already reached the level requirement. Sponsor-tree completion
 * still uses releaseLevel. One database transaction posts both wallet rows
 * or neither.
 */
export async function settleOpenPlacementLevel(
  sql: Sql,
  memberId: string,
  level: number,
  opts: { failAt?: PlacementReleaseFailAt; memo?: ActivationMemo } = {},
): Promise<{ released: boolean }> {
  if (!(await placementCutoverActive(sql, opts.memo))) return { released: false };
  const ready = await sql<{
    placement_completed_members: number;
    required_members: number;
    status: string;
  }>`
    select placement_completed_members, required_members, status
    from level_progress where member_id = ${memberId} and level = ${level}
  `;
  const gate = ready[0];
  if (!gate || gate.status === "RELEASED" || gate.status === "LOCKED") return { released: false };
  if (Number(gate.placement_completed_members) < Number(gate.required_members)) return { released: false };
  if (typeof sql.withTransaction !== "function") {
    throw new Error("Placement release requires a database transaction");
  }
  return sql.withTransaction((tx) => settleOpenPlacementLevelTx(tx, memberId, level, opts));
}

async function settleOpenPlacementLevelTx(
  sql: Sql,
  memberId: string,
  level: number,
  opts: { failAt?: PlacementReleaseFailAt; memo?: ActivationMemo },
): Promise<{ released: boolean }> {
  if (!(await placementCutoverActive(sql, opts.memo))) return { released: false };
  const fail = (at: PlacementReleaseFailAt) => {
    if (opts.failAt === at) throw new Error("RELEASE_TEST_FAILURE");
  };

  const locked = await sql<MemberRow>`
    select id, owner_user_id, parent_id, sponsor_id, joining_amount_bdt, purchase_id, is_root,
           current_level, progression_status
    from member_ids where id = ${memberId}
    for update
  `;
  const beneficiary = locked[0];
  if (!beneficiary) return { released: false };

  const prog = await sql<{
    placement_completed_members: number;
    required_members: number;
    completed_members: number;
    status: string;
  }>`
    select placement_completed_members, required_members, completed_members, status
    from level_progress
    where member_id = ${memberId} and level = ${level}
    for update
  `;
  const row = prog[0];
  if (!row) return { released: false };
  if (row.status === "RELEASED" || row.status === "LOCKED") return { released: false };
  if (Number(row.placement_completed_members) < Number(row.required_members)) return { released: false };

  fail("before-placement-claim");

  const placementTxId = `release:${memberId}:${level}:placement`;
  const legacyTxId = `legacy-release:${memberId}:${level}`;
  const generation = getLevel(level).generation;

  const placementClaimed = await sql<{ id: string; commission_amount: number }>`
    update commission_entries
    set status = 'RELEASED', released_at = now(), wallet_transaction_id = ${placementTxId}
    where beneficiary_id = ${memberId} and level = ${level}
      and status = 'HELD' and ancestry_model = 'placement'
    returning id, commission_amount
  `;
  fail("after-placement-claim");

  if (placementClaimed.length > 0) {
    const placementTotal = placementClaimed.reduce((s, r) => s + Number(r.commission_amount), 0);
    await sql`
      insert into wallet_transactions (
        id, member_id, owner_user_id, type, amount, source, level, generation, status
      ) values (
        ${placementTxId}, ${beneficiary.id}, ${beneficiary.owner_user_id},
        'RELEASE', ${placementTotal}, ${"Level " + level + " placement completion"},
        ${level}, ${generation}, 'posted'
      )
      on conflict (id) do nothing
    `;
  }
  fail("after-placement-wallet");

  const legacyClaimed = await sql<{ id: string; commission_amount: number }>`
    update commission_entries
    set status = 'RELEASED', released_at = now(), wallet_transaction_id = ${legacyTxId}
    where beneficiary_id = ${memberId} and level = ${level}
      and status = 'HELD' and ancestry_model = 'sponsor'
    returning id, commission_amount
  `;
  if (legacyClaimed.length > 0) {
    const legacyTotal = legacyClaimed.reduce((s, r) => s + Number(r.commission_amount), 0);
    fail("before-legacy-wallet");
    await sql`
      insert into wallet_transactions (
        id, member_id, owner_user_id, type, amount, source, level, generation, status
      ) values (
        ${legacyTxId}, ${beneficiary.id}, ${beneficiary.owner_user_id},
        'RELEASE', ${legacyTotal}, ${"Level " + level + " legacy sponsor hold"},
        ${level}, ${generation}, 'posted'
      )
      on conflict (id) do nothing
    `;
  }

  const held = await sql<{ amount: number }>`
    select coalesce(sum(commission_amount), 0)::int as amount
    from commission_entries
    where beneficiary_id = ${memberId} and level = ${level} and status = 'HELD'
  `;
  const heldLeft = Number(held[0]?.amount ?? 0);
  await sql`
    insert into held_commissions (member_id, owner_user_id, level, amount)
    values (${memberId}, ${beneficiary.owner_user_id}, ${level}, ${heldLeft})
    on conflict (member_id, level) do update set amount = excluded.amount
  `;

  fail("reconcile");
  await reconcileWallet(sql, memberId);

  const claimed = placementClaimed.length + legacyClaimed.length;
  if (claimed === 0) return { released: false };

  fail("advance");
  await sql`
    update level_progress
    set status = 'RELEASED',
        released_at = coalesce(released_at, now()),
        completed_at = coalesce(completed_at, now())
    where member_id = ${memberId} and level = ${level}
  `;
  await advanceAfterCompletion(sql, beneficiary, level);
  await audit(
    sql,
    "system",
    "commission.release.placement",
    "level_progress",
    memberId,
    `Placement settlement for ${memberId} level ${level}`,
  );
  return { released: true };
}

type ImpactResult = { applied: boolean; completedLevel: number | null };

async function applyActivationImpact(
  sql: Sql,
  source: MemberRow,
  joiningAmount: number,
  hop: SponsorHop,
  failAfter: number | undefined,
  appliedCount: { n: number } | undefined,
  model: "sponsor" | "placement",
  memo: ActivationMemo,
): Promise<ImpactResult> {
  return withMemberLock(hop.ancestorId, async () => {
    const locked = await sql<MemberRow>`
      select id, owner_user_id, parent_id, sponsor_id, joining_amount_bdt, purchase_id, is_root,
             current_level, progression_status
      from member_ids where id = ${hop.ancestorId}
      for update
    `;
    const beneficiary = locked[0];
    if (!beneficiary) return { applied: false, completedLevel: null };
    if (beneficiary.progression_status === "GRADUATED") return { applied: false, completedLevel: null };
    if (model === "placement" && await directSponsorCount(sql, beneficiary.id, memo) < 3) {
      return { applied: false, completedLevel: null };
    }

    const currentLevel = Number(beneficiary.current_level ?? 1);
    if (currentLevel < 1 || currentLevel > 9) return { applied: false, completedLevel: null };
    const isDirect =
      model === "placement" ? source.parent_id === beneficiary.id : source.sponsor_id === beneficiary.id;
    // Placement level 1 counts every ID in the genealogy, not only direct children.
    // Sponsor-stamped history stays direct-only.
    if (model !== "placement" && currentLevel === 1 && !isDirect) return { applied: false, completedLevel: null };

    const eventPk = activationEventId(source.id);
    const kind = currentLevel === 1 && isDirect ? "L1_DIRECT" : "DOWNLINE";
    const levelRule = getLevel(currentLevel);
    const amount = commissionPerMember(joiningAmount, levelRule.rate);
    const commEventId = joinEventId(source.id, beneficiary.id);
    const insertedComm = await sql<{ id: string }>`
      insert into commission_entries (
        id, event_id, beneficiary_user_id, beneficiary_id, source_user_id, source_id,
        source_joining_amount, generation, level, commission_rate, commission_amount,
        status, rule_version, ancestry_model
      ) values (
        ${uid()}, ${commEventId}, ${beneficiary.owner_user_id}, ${beneficiary.id},
        ${source.owner_user_id}, ${source.id}, ${joiningAmount},
        ${hop.generation}, ${currentLevel}, ${levelRule.rate}, ${amount},
        'HELD', ${RULE_VERSION}, ${model}
      )
      on conflict (event_id) do nothing
      returning id
    `;
    if (insertedComm.length === 0) return { applied: false, completedLevel: null };

    const impactInsert = await sql<{ id: string }>`
      insert into membership_activation_impacts (
        id, event_id, beneficiary_id, beneficiary_owner_user_id, level, kind, commission_entry_id
      ) values (
        ${uid()}, ${eventPk}, ${beneficiary.id}, ${beneficiary.owner_user_id}, ${currentLevel}, ${kind},
        ${insertedComm[0]!.id}
      )
      on conflict (event_id, beneficiary_id) do nothing
      returning id
    `;
    if (impactInsert.length === 0) return { applied: false, completedLevel: null };

    await sql`
      insert into held_commissions (member_id, owner_user_id, level, amount)
      values (${beneficiary.id}, ${beneficiary.owner_user_id}, ${currentLevel}, ${amount})
      on conflict (member_id, level) do update
        set amount = held_commissions.amount + excluded.amount
    `;

    const prog = await sql<{
      completed_members: number;
      placement_completed_members: number;
      required_members: number;
      accumulated_commission: number;
      status: string;
    }>`
      select completed_members, placement_completed_members, required_members,
             accumulated_commission, status
      from level_progress
      where member_id = ${beneficiary.id} and level = ${currentLevel}
      for update
    `;
    const row = prog[0];
    if (!row || row.status === "RELEASED") return { applied: true, completedLevel: null };

    const required = Number(row.required_members);
    const priorCount =
      model === "placement" ? Number(row.placement_completed_members) : Number(row.completed_members);
    const nextCount = priorCount + 1;
    const remaining = Math.max(0, required - nextCount);
    const accumulated = Number(row.accumulated_commission) + amount;

    if (model === "placement") {
      await sql`
        update level_progress set
          placement_completed_members = ${nextCount},
          remaining_members = ${remaining},
          accumulated_commission = ${accumulated},
          status = 'IN_PROGRESS'
        where member_id = ${beneficiary.id} and level = ${currentLevel}
      `;
      if (appliedCount) appliedCount.n += 1;
      if (failAfter != null && appliedCount && appliedCount.n >= failAfter) {
        throw new Error("ACTIVATION_TEST_FAILURE");
      }
      if (nextCount >= required) {
        await settleOpenPlacementLevel(sql, beneficiary.id, currentLevel, { memo });
      }
      return { applied: true, completedLevel: nextCount >= required ? currentLevel : null };
    }

    if (nextCount < required) {
      await sql`
        update level_progress set
          completed_members = ${nextCount},
          remaining_members = ${remaining},
          accumulated_commission = ${accumulated},
          status = 'IN_PROGRESS'
        where member_id = ${beneficiary.id} and level = ${currentLevel}
      `;
      if (appliedCount) appliedCount.n += 1;
      if (failAfter != null && appliedCount && appliedCount.n >= failAfter) {
        throw new Error("ACTIVATION_TEST_FAILURE");
      }
      if (currentLevel === 1) {
        await notify(
          sql,
          beneficiary.owner_user_id,
          "direct",
          "New direct member",
          `${source.id} joined under ${beneficiary.id}.`,
        );
      }
      return { applied: true, completedLevel: null };
    }

    await sql`
      update level_progress set
        completed_members = ${nextCount},
        remaining_members = 0,
        accumulated_commission = ${accumulated},
        status = 'COMPLETED',
        completed_at = coalesce(completed_at, now())
      where member_id = ${beneficiary.id} and level = ${currentLevel}
    `;
    if (!(await placementCutoverActive(sql, memo))) {
      await releaseLevel(sql, beneficiary, currentLevel);
      await advanceAfterCompletion(sql, beneficiary, currentLevel);
    }
    if (appliedCount) appliedCount.n += 1;
    if (failAfter != null && appliedCount && appliedCount.n >= failAfter) {
      throw new Error("ACTIVATION_TEST_FAILURE");
    }
    return { applied: true, completedLevel: currentLevel };
  });
}

export type ActivationResult = {
  sourceId: string;
  replay: boolean;
  impacts: number;
};

async function directSponsorCount(sql: Sql, memberId: string, memo?: ActivationMemo): Promise<number> {
  const cached = memo?.sponsorCount.get(memberId);
  if (cached != null) return cached;
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from sponsor_relationships where sponsor_id = ${memberId}
  `;
  const n = Number(rows[0]?.n ?? 0);
  memo?.sponsorCount.set(memberId, n);
  return n;
}

/** After an ID has 3 sponsors, older placement descendants that were skipped start counting. */
async function backfillQualifiedPlacement(
  sql: Sql,
  ancestorId: string,
  exceptId: string,
  memo: ActivationMemo,
): Promise<void> {
  if (memo.backfilled.has(ancestorId)) return;
  if (await directSponsorCount(sql, ancestorId, memo) < 3) return;
  memo.backfilled.add(ancestorId);
  const pending = await sql<{ id: string }>`
    with recursive down as (
      select id, created_at, 1 as depth, array[id] as seen
      from member_ids where parent_id = ${ancestorId}
      union all
      select m.id, m.created_at, d.depth + 1, d.seen || m.id
      from member_ids m
      join down d on m.parent_id = d.id
      where d.depth < ${ANCESTRY_HOP_GUARD}
        and not (m.id = any(d.seen))
    )
    select d.id
    from down d
    join membership_activation_events e on e.member_id = d.id
    where d.id <> ${exceptId}
      and not exists (
        select 1 from commission_entries c
        where c.beneficiary_id = ${ancestorId}
          and c.source_id = d.id
          and c.status in ('HELD', 'RELEASED')
      )
    order by d.created_at, d.id
  `;
  for (const row of pending) {
    await processMembershipIdActivation(sql, row.id, { skipBackfill: true, memo });
  }
}

export async function processMembershipIdActivation(
  sql: Sql,
  newId: string,
  opts: { failAfter?: number; skipBackfill?: boolean; memo?: ActivationMemo } = {},
): Promise<ActivationResult> {
  const memo = opts.memo ?? createActivationMemo();
  const source = await loadMember(sql, newId);
  if (!source) return { sourceId: newId, replay: false, impacts: 0 };
  if (!memo.walletsReady.has(source.id)) {
    await ensureWallet(sql, source.id, source.owner_user_id);
    memo.walletsReady.add(source.id);
  }
  await ensureLevelRows(sql, source.id, memo);
  const joiningAmount = Number(source.joining_amount_bdt) || STANDARD_ID_VALUE_BDT;
  const eventPk = activationEventId(source.id);

  await sql`
    update member_ids
    set activated_at = coalesce(activated_at, now())
    where id = ${source.id}
  `;

  const cutover = await placementCutoverActive(sql, memo);
  const claimed = await sql<{ id: string }>`
    insert into membership_activation_events (
      id, member_id, owner_user_id, sponsor_id, joining_amount_bdt, ancestry_model
    ) values (
      ${eventPk}, ${source.id}, ${source.owner_user_id}, ${source.sponsor_id}, ${joiningAmount},
      ${cutover ? "placement" : "sponsor"}
    )
    on conflict (member_id) do nothing
    returning id
  `;
  const replay = claimed.length === 0;
  let model: "sponsor" | "placement" = cutover ? "placement" : "sponsor";
  if (replay) {
    const stored = await sql<{ ancestry_model: string | null }>`
      select ancestry_model from membership_activation_events where member_id = ${source.id}
    `;
    model = stored[0]?.ancestry_model === "placement" ? "placement" : "sponsor";
  }

  const hops =
    model === "placement" ? await walkPlacementAncestry(sql, newId) : await walkSponsorAncestry(sql, newId);
  const share = await readCompanyShare(sql, memo);
  if (model === "placement" && !opts.skipBackfill) {
    const seen = new Set<string>();
    for (const hop of hops) {
      if (share.exempt.has(hop.ancestorId)) continue;
      seen.add(hop.ancestorId);
      await backfillQualifiedPlacement(sql, hop.ancestorId, source.id, memo);
    }
    if (source.sponsor_id && !seen.has(source.sponsor_id) && !share.exempt.has(source.sponsor_id)) {
      await backfillQualifiedPlacement(sql, source.sponsor_id, source.id, memo);
    }
  }
  const appliedCount = { n: 0 };
  for (const hop of hops) {
    if (share.exempt.has(hop.ancestorId)) continue;
    await sql`
      insert into generation_memberships (id, beneficiary_id, member_id, generation)
      values (${uid()}, ${hop.ancestorId}, ${source.id}, ${hop.generation})
      on conflict (beneficiary_id, member_id) do nothing
    `;
    await applyActivationImpact(sql, source, joiningAmount, hop, opts.failAfter, appliedCount, model, memo);
  }
  if (model === "placement" && replay) {
    for (const hop of hops) {
      if (share.exempt.has(hop.ancestorId)) continue;
      const ancestor = memo.members.get(hop.ancestorId) ?? await loadMember(sql, hop.ancestorId);
      const level = Number(ancestor?.current_level ?? 1);
      if (ancestor && ancestor.progression_status !== "GRADUATED" && level >= 1 && level <= 9) {
        await settleOpenPlacementLevel(sql, hop.ancestorId, level, { memo });
      }
    }
  }
  await recordDesignationCredit(sql, source.id);
  await applyCompanyShare(sql, source.id, joiningAmount, share, memo);
  return { sourceId: newId, replay, impacts: appliedCount.n };
}

/** Back-compat alias used by package/payment callers. */
export async function processNewId(sql: Sql, newId: string, memo?: ActivationMemo) {
  await processMembershipIdActivation(sql, newId, { memo });
}

export type GenerationReconcileReport = {
  dryRun: boolean;
  membersScanned: number;
  missingMemberships: number;
  missingCommissions: number;
  affectedBeneficiaries: string[];
  wouldRelease: { memberId: string; level: number; qualifying: number; required: number }[];
};

/**
 * Informational sponsor-distance backfill only.
 * Does not create commissions or change level progress (generation is not V2 source of truth).
 */
export async function reconcileGenerationAncestry(
  sql: Sql,
  opts: { dryRun?: boolean } = {},
): Promise<GenerationReconcileReport> {
  const dryRun = Boolean(opts.dryRun);
  const members = await sql<{ id: string }>`
    select id from member_ids where status = 'active' order by created_at, id
  `;
  const affected = new Set<string>();
  let missingMemberships = 0;

  for (const row of members) {
    const hops = await walkSponsorAncestry(sql, row.id);
    for (const hop of hops) {
      const existingMem = await sql<{ n: number }>`
        select count(*)::int as n from generation_memberships
        where beneficiary_id = ${hop.ancestorId} and member_id = ${row.id}
      `;
      if ((existingMem[0]?.n ?? 0) === 0) {
        missingMemberships += 1;
        affected.add(hop.ancestorId);
        if (!dryRun) {
          await sql`
            insert into generation_memberships (id, beneficiary_id, member_id, generation)
            values (${uid()}, ${hop.ancestorId}, ${row.id}, ${hop.generation})
            on conflict (beneficiary_id, member_id) do nothing
          `;
        }
      }
    }
  }

  return {
    dryRun,
    membersScanned: members.length,
    missingMemberships,
    missingCommissions: 0,
    affectedBeneficiaries: [...affected].sort(),
    wouldRelease: [],
  };
}

async function recountFromImpacts(sql: Sql, beneficiaryId: string) {
  const member = await loadMember(sql, beneficiaryId);
  if (!member) return;
  const counts = await sql<{ level: number; n: number }>`
    select i.level, count(*)::int as n
    from membership_activation_impacts i
    join commission_entries c on c.id = i.commission_entry_id
    where i.beneficiary_id = ${beneficiaryId}
      and c.status in ('HELD', 'RELEASED')
    group by i.level
  `;
  const byLevel = new Map<number, number>();
  for (const row of counts) byLevel.set(Number(row.level), Number(row.n));

  let liveLevel = 1;
  let graduated = false;
  for (const level of LEVELS) {
    const qualifying = byLevel.get(level.level) ?? 0;
    const remaining = Math.max(0, level.requiredMembers - qualifying);
    const row = await sql<{ status: string }>`
      select status from level_progress where member_id = ${beneficiaryId} and level = ${level.level}
    `;
    const alreadyReleased = row[0]?.status === "RELEASED";
    const met = qualifying >= level.requiredMembers;
    let status = row[0]?.status ?? "LOCKED";
    if (alreadyReleased) {
      status = "RELEASED";
      liveLevel = Math.min(9, level.level + 1);
      if (level.level === 9) graduated = true;
    } else if (met) {
      status = "COMPLETED";
    } else if (qualifying > 0) {
      status = "IN_PROGRESS";
      liveLevel = level.level;
      break;
    } else if (level.level === 1) {
      status = "IN_PROGRESS";
      liveLevel = 1;
      break;
    } else {
      status = "LOCKED";
    }
    await sql`
      update level_progress set
        completed_members = ${qualifying},
        remaining_members = ${remaining},
        status = ${status}
      where member_id = ${beneficiaryId} and level = ${level.level}
    `;
    if (!alreadyReleased && !met) break;
  }
  await sql`
    update member_ids set
      current_level = ${graduated ? 9 : liveLevel},
      progression_status = ${graduated ? "GRADUATED" : "ACTIVE"}
    where id = ${beneficiaryId}
  `;
  await rebuildHeld(sql, beneficiaryId, member.owner_user_id);
}

export async function reverseJoin(
  sql: Sql,
  opts: { sourceId: string; actorUserId: string; reason: string },
): Promise<{ reversed: number }> {
  const entries = await sql<{
    id: string;
    beneficiary_id: string;
    beneficiary_user_id: string;
    commission_amount: number;
    status: string;
    level: number;
    generation: number;
  }>`
    select id, beneficiary_id, beneficiary_user_id, commission_amount, status, level, generation
    from commission_entries
    where source_id = ${opts.sourceId} and status in ('HELD', 'RELEASED')
  `;

  const affected = new Set<string>();
  let reversed = 0;

  for (const entry of entries) {
    const flipped = await sql<{ id: string }>`
      update commission_entries
      set status = 'REVERSED'
      where id = ${entry.id} and status = ${entry.status}
      returning id
    `;
    if (flipped.length === 0) continue;
    reversed += 1;
    affected.add(entry.beneficiary_id);
    await sql`
      update level_progress
      set accumulated_commission = greatest(0, accumulated_commission - ${Number(entry.commission_amount)})
      where member_id = ${entry.beneficiary_id} and level = ${entry.level}
    `;

    if (entry.status === "RELEASED") {
      const txId = reversalTxId(entry.id);
      await sql`
        insert into wallet_transactions (
          id, member_id, owner_user_id, type, amount, source, level, generation,
          related_member_id, commission_entry_id, status
        ) values (
          ${txId}, ${entry.beneficiary_id}, ${entry.beneficiary_user_id},
          'REVERSAL', ${-Number(entry.commission_amount)}, ${opts.reason},
          ${entry.level}, ${entry.generation}, ${opts.sourceId}, ${entry.id}, 'posted'
        )
        on conflict (id) do nothing
      `;
    }
  }

  await sql`delete from membership_activation_impacts where event_id = ${activationEventId(opts.sourceId)}`;
  await sql`delete from membership_activation_events where member_id = ${opts.sourceId}`;
  await sql`delete from generation_memberships where member_id = ${opts.sourceId}`;
  await sql`delete from sponsor_relationships where sponsored_id = ${opts.sourceId}`;
  await voidDesignationCredit(sql, opts.sourceId, opts.reason);

  for (const id of affected) {
    const member = await loadMember(sql, id);
    if (!member) continue;
    await rebuildHeld(sql, id, member.owner_user_id);
    await reconcileWallet(sql, id);
    await recountFromImpacts(sql, id);
  }

  await audit(
    sql,
    opts.actorUserId,
    "commission.reverse",
    "member_ids",
    opts.sourceId,
    `${opts.reason} · ${reversed} ledger rows`,
  );

  return { reversed };
}
