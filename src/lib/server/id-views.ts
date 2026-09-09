import { toInt } from "../money.ts";
import { LEVELS } from "../rules.ts";
import {
  MEMBERSHIP_ID_NOT_FOUND,
  NETWORK_MEMBER_CAP,
  ID_DETAIL_DIRECT_CAP,
  ID_DETAIL_TX_CAP,
  buildCurrentProgress,
  summarizeAccount,
  type CompactMembershipId,
  type CurrentProgress,
} from "../id-workspace.ts";

export type Sql = {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
};

export const ID_NOT_FOUND = MEMBERSHIP_ID_NOT_FOUND;

export async function assertOwnedMemberId(sql: Sql, userId: string, memberId: string): Promise<string> {
  const ok = await sql<{ id: string }>`
    select id from member_ids where id = ${memberId} and owner_user_id = ${userId}
  `;
  if (!ok[0]) throw new Error(ID_NOT_FOUND);
  return ok[0].id;
}

/** Silent fallback only when no ID was requested. Explicit IDs fail closed. */
export async function resolveOwnedId(sql: Sql, userId: string, preferred?: string | null): Promise<string | null> {
  if (preferred) return assertOwnedMemberId(sql, userId, preferred);
  const profile = await sql<{ active_id: string | null }>`
    select active_id from app_users where user_id = ${userId}
  `;
  if (profile[0]?.active_id) {
    const ok = await sql<{ id: string }>`
      select id from member_ids where id = ${profile[0].active_id} and owner_user_id = ${userId}
    `;
    if (ok[0]) return ok[0].id;
  }
  const first = await sql<{ id: string }>`
    select id from member_ids where owner_user_id = ${userId} order by created_at asc limit 1
  `;
  return first[0]?.id ?? null;
}

type ProgressRow = {
  member_id: string;
  level: number;
  status: string;
  completed_members: number;
  required_members: number;
  remaining_members: number;
};

function compactFromParts(
  row: {
    id: string;
    package_id: string;
    sponsor_id: string | null;
    parent_id: string | null;
    placement_status: string;
    status: string;
    is_root: boolean;
    origin_kind: string | null;
    created_at: string;
    referral_code: string | null;
    current_level: number | null;
    progression_status: string | null;
  },
  extras: {
    held: number;
    available: number;
    released: number;
    directs: number;
    progress: ProgressRow[];
  },
): CompactMembershipId {
  const currentLevel = Number(row.current_level) || 1;
  const progressionStatus = row.progression_status === "GRADUATED" ? "GRADUATED" : "ACTIVE";
  const own = extras.progress.filter((p) => p.member_id === row.id);
  const completedLevels = own.filter((p) => p.status === "RELEASED").length;
  const level9Released = own.some((p) => p.level === 9 && p.status === "RELEASED");
  const currentProgress = buildCurrentProgress({
    currentLevel,
    progressionStatus,
    progressRows: own.map((p) => ({
      level: p.level,
      status: p.status,
      completed: toInt(p.completed_members),
      required: toInt(p.required_members),
      remaining: toInt(p.remaining_members),
    })),
  });
  return {
    id: row.id,
    package_id: row.package_id,
    sponsor_id: row.sponsor_id,
    parent_id: row.parent_id,
    placement_status: row.placement_status,
    status: row.status,
    is_root: Boolean(row.is_root),
    origin_kind: row.origin_kind ?? "purchase",
    created_at: row.created_at,
    referral_code: row.referral_code,
    current_level: currentLevel,
    progression_status: progressionStatus,
    held: extras.held,
    available: extras.available,
    released: extras.released,
    directSponsors: extras.directs,
    completedLevels,
    level9Released,
    currentProgress,
  };
}

/**
 * Compact per-ID summaries for one account.
 * One grouped progress query, no generation_memberships / downline dump.
 */
export async function loadCompactIds(sql: Sql, userId: string): Promise<CompactMembershipId[]> {
  const rows = await sql<{
    id: string;
    package_id: string;
    sponsor_id: string | null;
    parent_id: string | null;
    placement_status: string;
    status: string;
    is_root: boolean;
    origin_kind: string | null;
    created_at: string;
    referral_code: string | null;
    current_level: number | null;
    progression_status: string | null;
  }>`
    select id, package_id, sponsor_id, parent_id, placement_status, status, is_root,
           origin_kind, created_at, referral_code, current_level, progression_status
    from member_ids where owner_user_id = ${userId}
    order by created_at asc
  `;
  if (rows.length === 0) return [];

  const wallets = await sql<{ member_id: string; available_balance: number; total_released: number }>`
    select member_id, available_balance, total_released from wallets where owner_user_id = ${userId}
  `;
  const heldRows = await sql<{ member_id: string; held: number }>`
    select member_id, coalesce(sum(amount),0)::int as held
    from held_commissions where owner_user_id = ${userId}
    group by member_id
  `;
  const progress = await sql<ProgressRow>`
    select lp.member_id, lp.level, lp.status, lp.completed_members, lp.required_members, lp.remaining_members
    from level_progress lp
    join member_ids m on m.id = lp.member_id
    where m.owner_user_id = ${userId}
  `;
  const directs = await sql<{ sponsor_id: string; n: number }>`
    select sponsor_id, count(*)::int as n
    from sponsor_relationships
    where sponsor_id in (select id from member_ids where owner_user_id = ${userId})
    group by sponsor_id
  `;

  const walletBy = new Map(wallets.map((w) => [w.member_id, w]));
  const heldBy = new Map(heldRows.map((h) => [h.member_id, toInt(h.held)]));
  const directBy = new Map(directs.map((d) => [d.sponsor_id, d.n]));
  const progressBy = new Map<string, ProgressRow[]>();
  for (const row of progress) {
    const list = progressBy.get(row.member_id) ?? [];
    list.push(row);
    progressBy.set(row.member_id, list);
  }

  return rows.map((row) =>
    compactFromParts(row, {
      held: heldBy.get(row.id) ?? 0,
      available: toInt(walletBy.get(row.id)?.available_balance),
      released: toInt(walletBy.get(row.id)?.total_released),
      directs: directBy.get(row.id) ?? 0,
      progress: progressBy.get(row.id) ?? [],
    }),
  );
}

export type LevelJourneyRow = {
  level: number;
  generation: number;
  required_members: number;
  completed_members: number;
  remaining_members: number;
  accumulated_commission: number;
  expected_full_commission: number;
  status: string;
  completed_at: string | null;
  released_at: string | null;
};

export type DirectSponsored = {
  member_id: string;
  display_name: string;
  package_id: string;
  created_at: string;
  status: string;
  owner_user_id: string;
};

export type IdActivityTx = {
  id: string;
  amount: number;
  source: string;
  type: string;
  level: number | null;
  status: string;
  created_at: string;
  related_member_id: string | null;
};

export type IdCommission = {
  id: string;
  source_id: string;
  level: number;
  commission_amount: number;
  status: string;
  held_at: string;
  released_at: string | null;
};

export type MembershipIdDetail = {
  id: string;
  package_id: string;
  is_root: boolean;
  origin_kind: string;
  sponsor_id: string | null;
  parent_id: string | null;
  placement_status: string;
  status: string;
  current_level: number;
  progression_status: string;
  referral_code: string | null;
  created_at: string;
  currentProgress: CurrentProgress;
  journey: LevelJourneyRow[];
  directs: { count: number; required: number; members: DirectSponsored[]; hasMore: boolean };
  wallet: { held: number; available: number; released: number };
  recentTx: IdActivityTx[];
  commissions: IdCommission[];
};

export async function loadMembershipIdDetail(
  sql: Sql,
  userId: string,
  memberId: string,
): Promise<MembershipIdDetail> {
  await assertOwnedMemberId(sql, userId, memberId);

  const rows = await sql<{
    id: string;
    package_id: string;
    is_root: boolean;
    origin_kind: string | null;
    sponsor_id: string | null;
    parent_id: string | null;
    placement_status: string;
    status: string;
    current_level: number | null;
    progression_status: string | null;
    referral_code: string | null;
    created_at: string;
  }>`
    select id, package_id, is_root, origin_kind, sponsor_id, parent_id, placement_status, status,
           current_level, progression_status, referral_code, created_at
    from member_ids where id = ${memberId} and owner_user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) throw new Error(ID_NOT_FOUND);

  const journey = await sql<LevelJourneyRow>`
    select level, generation, required_members, completed_members, remaining_members,
           accumulated_commission, expected_full_commission, status, completed_at, released_at
    from level_progress where member_id = ${memberId} order by level
  `;

  const directCount = await sql<{ n: number }>`
    select count(*)::int as n from sponsor_relationships where sponsor_id = ${memberId}
  `;
  const directs = await sql<DirectSponsored>`
    select m.id as member_id, u.display_name, m.package_id, m.created_at, m.status, m.owner_user_id
    from sponsor_relationships sr
    join member_ids m on m.id = sr.sponsored_id
    join app_users u on u.user_id = m.owner_user_id
    where sr.sponsor_id = ${memberId}
    order by m.created_at
    limit ${ID_DETAIL_DIRECT_CAP}
  `;

  const w = await sql<{ available_balance: number; total_released: number }>`
    select available_balance, total_released from wallets where member_id = ${memberId}
  `;
  const h = await sql<{ held: number }>`
    select coalesce(sum(amount),0)::int as held from held_commissions where member_id = ${memberId}
  `;

  const recentTx = await sql<IdActivityTx>`
    select id, amount, source, type, level, status, created_at, related_member_id
    from wallet_transactions where member_id = ${memberId}
    order by created_at desc limit ${ID_DETAIL_TX_CAP}
  `;
  const commissions = await sql<IdCommission>`
    select id, source_id, level, commission_amount, status, held_at, released_at
    from commission_entries where beneficiary_id = ${memberId}
    order by held_at desc limit ${ID_DETAIL_TX_CAP}
  `;

  const currentLevel = Number(row.current_level) || 1;
  const progressionStatus = row.progression_status === "GRADUATED" ? "GRADUATED" : "ACTIVE";
  const currentProgress = buildCurrentProgress({
    currentLevel,
    progressionStatus,
    progressRows: journey.map((p) => ({
      level: p.level,
      status: p.status,
      completed: toInt(p.completed_members),
      required: toInt(p.required_members),
      remaining: toInt(p.remaining_members),
    })),
  });

  return {
    id: row.id,
    package_id: row.package_id,
    is_root: Boolean(row.is_root),
    origin_kind: row.origin_kind ?? "purchase",
    sponsor_id: row.sponsor_id,
    parent_id: row.parent_id,
    placement_status: row.placement_status,
    status: row.status,
    current_level: currentLevel,
    progression_status: progressionStatus,
    referral_code: row.referral_code,
    created_at: row.created_at,
    currentProgress,
    journey,
    directs: {
      count: directCount[0]?.n ?? directs.length,
      required: LEVELS[0]!.requiredMembers,
      members: directs,
      hasMore: (directCount[0]?.n ?? 0) > directs.length,
    },
    wallet: {
      held: toInt(h[0]?.held),
      available: toInt(w[0]?.available_balance),
      released: toInt(w[0]?.total_released),
    },
    recentTx,
    commissions,
  };
}

export type NetworkMember = {
  member_id: string;
  generation: number;
  display_name: string;
  package_id: string;
  created_at: string;
  status: string;
  sponsor_id: string | null;
  owner_user_id: string;
};

export async function loadIdNetwork(
  sql: Sql,
  userId: string,
  memberId: string,
): Promise<{
  activeId: string;
  levels: LevelJourneyRow[];
  directs: DirectSponsored[];
  members: NetworkMember[];
  hasMore: boolean;
}> {
  await assertOwnedMemberId(sql, userId, memberId);
  const levels = await sql<LevelJourneyRow>`
    select level, generation, required_members, completed_members, remaining_members,
           accumulated_commission, expected_full_commission, status, completed_at, released_at
    from level_progress where member_id = ${memberId} order by level
  `;
  const directs = await sql<DirectSponsored>`
    select m.id as member_id, u.display_name, m.package_id, m.created_at, m.status, m.owner_user_id
    from sponsor_relationships sr
    join member_ids m on m.id = sr.sponsored_id
    join app_users u on u.user_id = m.owner_user_id
    where sr.sponsor_id = ${memberId}
    order by m.created_at
    limit ${ID_DETAIL_DIRECT_CAP}
  `;
  const members = await sql<NetworkMember>`
    select gm.member_id, gm.generation, u.display_name, m.package_id, m.created_at,
           m.status, m.sponsor_id, m.owner_user_id
    from generation_memberships gm
    join member_ids m on m.id = gm.member_id
    join app_users u on u.user_id = m.owner_user_id
    where gm.beneficiary_id = ${memberId}
    order by gm.generation, m.created_at
    limit ${NETWORK_MEMBER_CAP + 1}
  `;
  const hasMore = members.length > NETWORK_MEMBER_CAP;
  return {
    activeId: memberId,
    levels,
    directs,
    members: hasMore ? members.slice(0, NETWORK_MEMBER_CAP) : members,
    hasMore,
  };
}

export type InviteForId = {
  memberId: string;
  referralCode: string;
  displayName: string;
  packageId: string;
  isRoot: boolean;
  currentLevel: number;
  progressionStatus: string;
};

export async function loadInviteForId(
  sql: Sql,
  userId: string,
  memberId: string,
): Promise<InviteForId> {
  await assertOwnedMemberId(sql, userId, memberId);
  const rows = await sql<{
    id: string;
    referral_code: string | null;
    package_id: string;
    is_root: boolean;
    current_level: number | null;
    progression_status: string | null;
  }>`
    select id, referral_code, package_id, is_root, current_level, progression_status
    from member_ids where id = ${memberId} and owner_user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) throw new Error(ID_NOT_FOUND);
  if (!row.referral_code) throw new Error(ID_NOT_FOUND);
  const owner = await sql<{ display_name: string }>`
    select display_name from app_users where user_id = ${userId}
  `;
  return {
    memberId: row.id,
    referralCode: row.referral_code,
    displayName: owner[0]?.display_name ?? "Member",
    packageId: row.package_id,
    isRoot: Boolean(row.is_root),
    currentLevel: Number(row.current_level) || 1,
    progressionStatus: row.progression_status === "GRADUATED" ? "GRADUATED" : "ACTIVE",
  };
}

export function accountFromCompact(ids: CompactMembershipId[]) {
  return summarizeAccount(ids);
}
