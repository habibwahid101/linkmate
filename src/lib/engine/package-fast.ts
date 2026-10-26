import {
  LEVELS,
  RULE_VERSION,
  STANDARD_ID_VALUE_BDT,
  commissionPerMember,
  fullLevelCommission,
  getLevel,
  type PackageId,
} from "../rules.ts";
import type { ActivationMemo, Sql } from "./activation.ts";
import {
  backfillQualifiedPlacement,
  ensureLevelRows,
  readCompanyShare,
  walkPlacementAncestry,
} from "./activation.ts";
import { makeReferralCode, uid } from "./ids.ts";
import { activationEventId, joinEventId } from "./level-state.ts";
import { planPackagePlacement } from "./placement.ts";

type ExecSql = Sql & { query?: (text: string, params?: unknown[]) => Promise<unknown[]> };

async function exec<T = Record<string, unknown>>(sql: Sql, text: string, params: unknown[] = []): Promise<T[]> {
  const query = (sql as ExecSql).query;
  if (query) return query(text, params) as Promise<T[]>;
  const parts = text.split(/\$\d+/);
  if (parts.length !== params.length + 1) {
    throw new Error(`SQL placeholder mismatch (${parts.length - 1} vs ${params.length})`);
  }
  const strings = parts as unknown as TemplateStringsArray;
  (strings as unknown as { raw: string[] }).raw = parts;
  return sql<T>(strings, ...params);
}

async function insertRows(
  sql: Sql,
  table: string,
  columns: string[],
  rows: unknown[][],
  suffix = "",
): Promise<void> {
  if (rows.length === 0) return;
  const params: unknown[] = [];
  const tuples: string[] = [];
  for (const row of rows) {
    const placeholders = row.map((value) => {
      params.push(value);
      return `$${params.length}`;
    });
    tuples.push(`(${placeholders.join(", ")})`);
  }
  await exec(
    sql,
    `insert into ${table} (${columns.join(", ")}) values ${tuples.join(", ")} ${suffix}`,
    params,
  );
}

function valuesSql(rows: unknown[][], casts: string[]): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const tuples = rows.map((row) => {
    const placeholders = row.map((value, index) => {
      params.push(value);
      return `$${params.length}::${casts[index]}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  return { sql: tuples.join(", "), params };
}

async function referralCodes(sql: Sql, ids: string[]): Promise<string[]> {
  const used = new Set<string>();
  const chosen = ids.map((id) => {
    for (let i = 0; i < 8; i++) {
      const candidate = makeReferralCode(i === 0 ? id : `${id}:${i}`);
      if (used.has(candidate)) continue;
      used.add(candidate);
      return candidate;
    }
    const fallback = makeReferralCode(`${id}:${uid()}`);
    used.add(fallback);
    return fallback;
  });
  const hit = await exec<{ referral_code: string }>(
    sql,
    `select referral_code from member_ids where referral_code = any(string_to_array($1, ',')::text[])`,
    [chosen.join(",")],
  );
  const taken = new Set(hit.map((row) => row.referral_code));
  for (let i = 0; i < chosen.length; i++) {
    if (!taken.has(chosen[i]!)) continue;
    for (let n = 1; n < 12; n++) {
      const candidate = makeReferralCode(`${ids[i]}:${n}:${uid()}`);
      if (used.has(candidate) || taken.has(candidate)) continue;
      used.add(candidate);
      taken.add(candidate);
      chosen[i] = candidate;
      break;
    }
  }
  return chosen;
}

type LevelSnap = {
  required: number;
  placement: number;
  accumulated: number;
  status: string;
  dirty: boolean;
};

type SimNode = {
  id: string;
  ownerUserId: string;
  parentId: string | null;
  currentLevel: number;
  progression: string;
  sponsorCount: number;
  levels: Map<number, LevelSnap>;
};

type PlacedId = {
  id: string;
  ownerUserId: string;
  parentId: string | null;
  sponsorId: string | null;
};

function blankLevels(): Map<number, LevelSnap> {
  const levels = new Map<number, LevelSnap>();
  for (const level of LEVELS) {
    levels.set(level.level, {
      required: level.requiredMembers,
      placement: 0,
      accumulated: 0,
      status: level.level === 1 ? "IN_PROGRESS" : "LOCKED",
      dirty: false,
    });
  }
  return levels;
}

export async function issuePlacedPackage(
  sql: Sql,
  opts: {
    userId: string;
    packageId: PackageId;
    purchaseId: string;
    rootParent: string | null;
    externalSponsorId: string | null;
    codes: string[];
    memo: ActivationMemo;
  },
): Promise<void> {
  const plan = planPackagePlacement(opts.packageId);
  if (opts.codes.length !== plan.length) throw new Error("Package ID count does not match the plan");
  const codes = await referralCodes(sql, opts.codes);
  const fresh = plan.map((p, i) => {
    const id = opts.codes[i]!;
    const parentId = p.isRoot ? opts.rootParent : p.parentIndex != null ? opts.codes[p.parentIndex]! : null;
    const sponsorId = p.isRoot ? opts.externalSponsorId : p.sponsorIndex != null ? opts.codes[p.sponsorIndex]! : null;
    return { p, id, parentId, sponsorId, referral: codes[i]! };
  });
  await insertRows(
    sql,
    "member_ids",
    [
      "id", "owner_user_id", "package_id", "purchase_id", "is_root", "sponsor_id", "parent_id",
      "placement_status", "status", "joining_amount_bdt", "referral_code", "current_level",
      "progression_status", "origin_kind",
    ],
    fresh.map((row) => [
      row.id,
      opts.userId,
      opts.packageId,
      opts.purchaseId,
      row.p.isRoot,
      row.sponsorId,
      row.parentId,
      row.p.placementStatus,
      "active",
      STANDARD_ID_VALUE_BDT,
      row.referral,
      1,
      "ACTIVE",
      row.p.isRoot ? "purchase_root" : "package_internal",
    ]),
  );
  await sql`
    update member_ids set activated_at = now()
    where purchase_id = ${opts.purchaseId}
  `;
  await insertRows(
    sql,
    "sponsor_relationships",
    ["id", "sponsor_id", "sponsored_id"],
    fresh.filter((row) => row.sponsorId).map((row) => [uid(), row.sponsorId, row.id]),
    "on conflict (sponsored_id) do nothing",
  );
  await insertRows(
    sql,
    "placement_relationships",
    ["id", "parent_id", "child_id", "position"],
    fresh.filter((row) => row.parentId && row.p.placementStatus === "placed").map((row) => [
      uid(), row.parentId, row.id, row.p.position,
    ]),
    "on conflict (child_id) do nothing",
  );
  const placed = fresh.filter((row) => row.p.placementStatus === "placed");
  await insertRows(
    sql,
    "wallets",
    ["member_id", "owner_user_id", "available_balance", "total_released"],
    placed.map((row) => [row.id, opts.userId, 0, 0]),
    "on conflict (member_id) do nothing",
  );
  const levelRows: unknown[][] = [];
  for (const row of placed) {
    for (const level of LEVELS) {
      levelRows.push([
        uid(),
        row.id,
        level.level,
        level.generation,
        level.requiredMembers,
        0,
        level.requiredMembers,
        0,
        fullLevelCommission(level.level),
        level.level === 1 ? "IN_PROGRESS" : "LOCKED",
      ]);
    }
  }
  await insertRows(
    sql,
    "level_progress",
    [
      "id", "member_id", "level", "generation", "required_members", "completed_members",
      "remaining_members", "accumulated_commission", "expected_full_commission", "status",
    ],
    levelRows,
    "on conflict (member_id, level) do nothing",
  );
  await activatePlacedPackage(
    sql,
    placed.map((row) => ({
      id: row.id,
      ownerUserId: opts.userId,
      parentId: row.parentId,
      sponsorId: row.sponsorId,
    })),
    opts.memo,
  );
}

async function activatePlacedPackage(sql: Sql, placed: PlacedId[], memo: ActivationMemo): Promise<void> {
  if (placed.length === 0) return;
  const root = placed[0]!;
  const share = await readCompanyShare(sql, memo);
  const rootAncestors = root.parentId ? await walkPlacementAncestry(sql, root.id) : [];
  const seenAncestors = new Set<string>();
  for (const hop of rootAncestors) {
    if (share.exempt.has(hop.ancestorId) || seenAncestors.has(hop.ancestorId)) continue;
    seenAncestors.add(hop.ancestorId);
    await backfillQualifiedPlacement(sql, hop.ancestorId, root.id, memo);
  }
  if (root.sponsorId && !seenAncestors.has(root.sponsorId) && !share.exempt.has(root.sponsorId)) {
    await backfillQualifiedPlacement(sql, root.sponsorId, root.id, memo);
  }

  const packageIds = new Set(placed.map((row) => row.id));
  const packageParent = new Map<string, string>();
  for (const row of placed) {
    if (row.parentId && packageIds.has(row.parentId)) packageParent.set(row.id, row.parentId);
  }
  const externalIds = rootAncestors.map((hop) => hop.ancestorId);
  const nodes = new Map<string, SimNode>();
  for (const row of placed) {
    nodes.set(row.id, {
      id: row.id,
      ownerUserId: row.ownerUserId,
      parentId: row.parentId,
      currentLevel: 1,
      progression: "ACTIVE",
      sponsorCount: 0,
      levels: blankLevels(),
    });
  }
  if (externalIds.length > 0) {
    const list = externalIds.join(",");
    const members = await exec<{
      id: string;
      owner_user_id: string;
      parent_id: string | null;
      current_level: number | string;
      progression_status: string;
    }>(
      sql,
      `select id, owner_user_id, parent_id, current_level, progression_status
       from member_ids
       where id = any(string_to_array($1, ',')::text[])
       for update`,
      [list],
    );
    const progress = await exec<{
      member_id: string;
      level: number | string;
      required_members: number | string;
      placement_completed_members: number | string;
      accumulated_commission: number | string;
      status: string;
    }>(
      sql,
      `select member_id, level, required_members, placement_completed_members, accumulated_commission, status
       from level_progress
       where member_id = any(string_to_array($1, ',')::text[])`,
      [list],
    );
    const progressByMember = new Map<string, typeof progress>();
    for (const row of progress) {
      const bucket = progressByMember.get(row.member_id) ?? [];
      bucket.push(row);
      progressByMember.set(row.member_id, bucket);
    }
    for (const member of members) {
      const rows = progressByMember.get(member.id) ?? [];
      if (rows.length < LEVELS.length) {
        await ensureLevelRows(sql, member.id, memo);
        const again = await sql<{
          member_id: string;
          level: number | string;
          required_members: number | string;
          placement_completed_members: number | string;
          accumulated_commission: number | string;
          status: string;
        }>`
          select member_id, level, required_members, placement_completed_members, accumulated_commission, status
          from level_progress where member_id = ${member.id}
        `;
        progressByMember.set(member.id, again);
      }
      const levels = blankLevels();
      for (const row of progressByMember.get(member.id) ?? []) {
        const level = Number(row.level);
        const snap = levels.get(level);
        if (!snap) continue;
        snap.required = Number(row.required_members);
        snap.placement = Number(row.placement_completed_members);
        snap.accumulated = Number(row.accumulated_commission);
        snap.status = row.status;
      }
      nodes.set(member.id, {
        id: member.id,
        ownerUserId: member.owner_user_id,
        parentId: member.parent_id,
        currentLevel: Number(member.current_level ?? 1),
        progression: member.progression_status || "ACTIVE",
        sponsorCount: 0,
        levels,
      });
    }
  }

  const countIds = [...nodes.keys()];
  if (countIds.length > 0) {
    const counts = await exec<{ sponsor_id: string; n: number | string }>(
      sql,
      `select sponsor_id, count(*)::int as n
       from sponsor_relationships
       where sponsor_id = any(string_to_array($1, ',')::text[])
       group by sponsor_id`,
      [countIds.join(",")],
    );
    for (const row of counts) {
      const node = nodes.get(row.sponsor_id);
      if (node) node.sponsorCount = Number(row.n);
    }
  }

  const events: unknown[][] = [];
  const comms: unknown[][] = [];
  const impacts: unknown[][] = [];
  const gens: unknown[][] = [];
  const heldAdd = new Map<string, { memberId: string; ownerUserId: string; level: number; amount: number }>();
  const completed: { memberId: string; ownerUserId: string; level: number }[] = [];
  const completedKey = new Set<string>();

  const hopsFor = (id: string) => {
    const out: { ancestorId: string; generation: number }[] = [];
    const seen = new Set<string>([id]);
    let cur = id;
    while (packageParent.has(cur)) {
      const parent = packageParent.get(cur)!;
      if (seen.has(parent)) break;
      seen.add(parent);
      out.push({ ancestorId: parent, generation: out.length + 1 });
      cur = parent;
    }
    const offset = out.length;
    for (const hop of rootAncestors) {
      if (seen.has(hop.ancestorId)) break;
      seen.add(hop.ancestorId);
      out.push({ ancestorId: hop.ancestorId, generation: hop.generation + offset });
    }
    return out;
  };

  for (const source of placed) {
    const eventId = activationEventId(source.id);
    events.push([eventId, source.id, source.ownerUserId, source.sponsorId, STANDARD_ID_VALUE_BDT, "placement"]);
    for (const hop of hopsFor(source.id)) {
      if (share.exempt.has(hop.ancestorId)) continue;
      const beneficiary = nodes.get(hop.ancestorId);
      if (!beneficiary) continue;
      gens.push([uid(), beneficiary.id, source.id, hop.generation]);
      if (beneficiary.progression === "GRADUATED") continue;
      if (beneficiary.sponsorCount < 3) continue;
      const level = beneficiary.currentLevel;
      if (level < 1 || level > 9) continue;
      const rule = getLevel(level);
      const amount = commissionPerMember(STANDARD_ID_VALUE_BDT, rule.rate);
      const commId = uid();
      const kind = source.parentId === beneficiary.id ? "L1_DIRECT" : "DOWNLINE";
      comms.push([
        commId,
        joinEventId(source.id, beneficiary.id),
        beneficiary.ownerUserId,
        beneficiary.id,
        source.ownerUserId,
        source.id,
        STANDARD_ID_VALUE_BDT,
        hop.generation,
        level,
        rule.rate,
        amount,
        "HELD",
        RULE_VERSION,
        "placement",
      ]);
      impacts.push([
        uid(),
        eventId,
        beneficiary.id,
        beneficiary.ownerUserId,
        level,
        kind,
        commId,
      ]);
      const heldKey = `${beneficiary.id}:${level}`;
      const held = heldAdd.get(heldKey) ?? {
        memberId: beneficiary.id,
        ownerUserId: beneficiary.ownerUserId,
        level,
        amount: 0,
      };
      held.amount += amount;
      heldAdd.set(heldKey, held);
      const snap = beneficiary.levels.get(level);
      if (!snap || snap.status === "RELEASED") continue;
      snap.placement += 1;
      snap.accumulated += amount;
      snap.status = "IN_PROGRESS";
      snap.dirty = true;
      if (snap.placement >= snap.required && !completedKey.has(heldKey)) {
        completedKey.add(heldKey);
        completed.push({
          memberId: beneficiary.id,
          ownerUserId: beneficiary.ownerUserId,
          level,
        });
        if (level >= 9) {
          beneficiary.progression = "GRADUATED";
          beneficiary.currentLevel = 9;
        } else {
          beneficiary.currentLevel = level + 1;
        }
      }
    }
  }

  await insertRows(
    sql,
    "membership_activation_events",
    ["id", "member_id", "owner_user_id", "sponsor_id", "joining_amount_bdt", "ancestry_model"],
    events,
  );
  await insertRows(
    sql,
    "commission_entries",
    [
      "id", "event_id", "beneficiary_user_id", "beneficiary_id", "source_user_id", "source_id",
      "source_joining_amount", "generation", "level", "commission_rate", "commission_amount",
      "status", "rule_version", "ancestry_model",
    ],
    comms,
  );
  await insertRows(
    sql,
    "membership_activation_impacts",
    ["id", "event_id", "beneficiary_id", "beneficiary_owner_user_id", "level", "kind", "commission_entry_id"],
    impacts,
  );
  await insertRows(
    sql,
    "generation_memberships",
    ["id", "beneficiary_id", "member_id", "generation"],
    gens,
    "on conflict (beneficiary_id, member_id) do nothing",
  );

  const dirty: unknown[][] = [];
  for (const node of nodes.values()) {
    for (const [level, snap] of node.levels) {
      if (!snap.dirty) continue;
      dirty.push([
        node.id,
        level,
        snap.placement,
        Math.max(0, snap.required - snap.placement),
        snap.accumulated,
        "IN_PROGRESS",
      ]);
    }
  }
  if (dirty.length > 0) {
    const built = valuesSql(dirty, ["text", "int", "int", "int", "int", "text"]);
    await exec(
      sql,
      `update level_progress lp set
         placement_completed_members = v.placed,
         remaining_members = v.remaining,
         accumulated_commission = v.accumulated,
         status = v.status
       from (values ${built.sql}) as v(member_id, level, placed, remaining, accumulated, status)
       where lp.member_id = v.member_id and lp.level = v.level`,
      built.params,
    );
  }

  const openHeld = [...heldAdd.values()].filter((row) => !completedKey.has(`${row.memberId}:${row.level}`));
  if (openHeld.length > 0) {
    await insertRows(
      sql,
      "held_commissions",
      ["member_id", "owner_user_id", "level", "amount"],
      openHeld.map((row) => [row.memberId, row.ownerUserId, row.level, row.amount]),
      `on conflict (member_id, level) do update set amount = held_commissions.amount + excluded.amount`,
    );
  }

  await releaseCompletedLevels(sql, completed);
  await creditDesignations(sql, placed.map((row) => row.id));
  await creditCompanyShare(sql, placed, share);
}

async function releaseCompletedLevels(
  sql: Sql,
  completed: { memberId: string; ownerUserId: string; level: number }[],
): Promise<void> {
  if (completed.length === 0) return;
  const pairs = valuesSql(
    completed.map((row) => [row.memberId, row.level]),
    ["text", "int"],
  );
  const claimed = await exec<{
    beneficiary_id: string;
    beneficiary_user_id: string;
    level: number | string;
    commission_amount: number | string;
    ancestry_model: string;
  }>(
    sql,
    `update commission_entries c
     set status = 'RELEASED',
         released_at = now(),
         wallet_transaction_id = case
           when c.ancestry_model = 'placement' then 'release:' || c.beneficiary_id || ':' || c.level::text || ':placement'
           else 'legacy-release:' || c.beneficiary_id || ':' || c.level::text
         end
     from (values ${pairs.sql}) as v(member_id, level)
     where c.beneficiary_id = v.member_id
       and c.level = v.level
       and c.status = 'HELD'
     returning c.beneficiary_id, c.beneficiary_user_id, c.level, c.commission_amount, c.ancestry_model`,
    pairs.params,
  );
  const sums = new Map<string, {
    memberId: string;
    ownerUserId: string;
    level: number;
    model: string;
    amount: number;
  }>();
  for (const row of claimed) {
    const level = Number(row.level);
    const model = row.ancestry_model === "placement" ? "placement" : "sponsor";
    const key = `${row.beneficiary_id}:${level}:${model}`;
    const bucket = sums.get(key) ?? {
      memberId: row.beneficiary_id,
      ownerUserId: row.beneficiary_user_id,
      level,
      model,
      amount: 0,
    };
    bucket.amount += Number(row.commission_amount);
    sums.set(key, bucket);
  }
  const txs = [...sums.values()].map((row) => {
    const placement = row.model === "placement";
    return [
      placement ? `release:${row.memberId}:${row.level}:placement` : `legacy-release:${row.memberId}:${row.level}`,
      row.memberId,
      row.ownerUserId,
      "RELEASE",
      row.amount,
      placement ? `Level ${row.level} placement completion` : `Level ${row.level} legacy sponsor hold`,
      row.level,
      getLevel(row.level).generation,
      "posted",
    ];
  });
  await insertRows(
    sql,
    "wallet_transactions",
    ["id", "member_id", "owner_user_id", "type", "amount", "source", "level", "generation", "status"],
    txs,
    "on conflict (id) do nothing",
  );
  await insertRows(
    sql,
    "held_commissions",
    ["member_id", "owner_user_id", "level", "amount"],
    completed.map((row) => [row.memberId, row.ownerUserId, row.level, 0]),
    "on conflict (member_id, level) do update set amount = excluded.amount",
  );
  const released = valuesSql(
    completed.map((row) => [row.memberId, row.level]),
    ["text", "int"],
  );
  await exec(
    sql,
    `update level_progress lp
     set status = 'RELEASED',
         released_at = coalesce(released_at, now()),
         completed_at = coalesce(completed_at, now())
     from (values ${released.sql}) as v(member_id, level)
     where lp.member_id = v.member_id and lp.level = v.level
       and lp.status not in ('RELEASED', 'LOCKED')`,
    released.params,
  );

  const highest = new Map<string, number>();
  for (const row of completed) {
    highest.set(row.memberId, Math.max(highest.get(row.memberId) ?? 0, row.level));
  }
  const graduates: string[] = [];
  const advance: unknown[][] = [];
  const openNext: unknown[][] = [];
  for (const [memberId, level] of highest) {
    if (level >= 9) {
      graduates.push(memberId);
      continue;
    }
    advance.push([memberId, level + 1]);
    openNext.push([memberId, level + 1]);
  }
  if (openNext.length > 0) {
    const built = valuesSql(openNext, ["text", "int"]);
    await exec(
      sql,
      `update level_progress lp
       set status = 'IN_PROGRESS',
           completed_members = 0,
           remaining_members = lp.required_members
       from (values ${built.sql}) as v(member_id, level)
       where lp.member_id = v.member_id and lp.level = v.level and lp.status = 'LOCKED'`,
      built.params,
    );
  }
  if (advance.length > 0) {
    const built = valuesSql(advance, ["text", "int"]);
    await exec(
      sql,
      `update member_ids m
       set current_level = v.next_level, progression_status = 'ACTIVE'
       from (values ${built.sql}) as v(id, next_level)
       where m.id = v.id and m.progression_status = 'ACTIVE'`,
      built.params,
    );
  }
  if (graduates.length > 0) {
    await exec(
      sql,
      `update member_ids
       set progression_status = 'GRADUATED', current_level = 9
       where id = any(string_to_array($1, ',')::text[])`,
      [graduates.join(",")],
    );
  }
  const releasedIds = [...new Set(completed.map((row) => row.memberId))];
  await exec(
    sql,
    `update wallets w set
       available_balance = s.available,
       total_released = s.released,
       updated_at = now()
     from (
       select member_id,
         coalesce(sum(amount), 0)::int as available,
         coalesce(sum(case when type in ('RELEASE', 'REVERSAL') then amount else 0 end), 0)::int as released
       from wallet_transactions
       where status = 'posted'
         and member_id = any(string_to_array($1, ',')::text[])
       group by member_id
     ) s
     where w.member_id = s.member_id`,
    [releasedIds.join(",")],
  );
  await insertRows(
    sql,
    "audit_logs",
    ["id", "actor_user_id", "action", "entity_type", "entity_id", "detail"],
    completed.map((row) => [
      uid(),
      "system",
      "commission.release.placement",
      "level_progress",
      row.memberId,
      `Placement settlement for ${row.memberId} level ${row.level}`,
    ]),
  );
}

async function creditDesignations(sql: Sql, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await exec(
    sql,
    `insert into sponsor_designation_credits (id, sponsor_id, sponsored_id, sponsor_owner_user_id)
     select 'desig:' || m.id, m.sponsor_id, m.id, s.owner_user_id
     from member_ids m
     join member_ids s on s.id = m.sponsor_id
     where m.id = any(string_to_array($1, ',')::text[])
       and m.sponsor_id is not null
       and (
         m.origin_kind in ('purchase_root', 'attach', 'package_internal')
         or (m.origin_kind = 'purchase' and m.is_root)
       )
     on conflict (sponsored_id) do update
       set voided_at = null, void_reason = null
       where sponsor_designation_credits.sponsor_id = excluded.sponsor_id
         and sponsor_designation_credits.voided_at is not null`,
    [ids.join(",")],
  );
}

async function creditCompanyShare(
  sql: Sql,
  placed: PlacedId[],
  share: { percent: number; beneficiaries: string[]; exempt: Set<string> },
): Promise<void> {
  if (share.percent <= 0 || share.beneficiaries.length === 0) return;
  const amount = Math.round((STANDARD_ID_VALUE_BDT * share.percent) / 100);
  if (amount <= 0) return;
  const known = await exec<{ id: string; owner_user_id: string }>(
    sql,
    `select id, owner_user_id from member_ids where id = any(string_to_array($1, ',')::text[])`,
    [share.beneficiaries.join(",")],
  );
  if (known.length === 0) return;
  await insertRows(
    sql,
    "wallets",
    ["member_id", "owner_user_id", "available_balance", "total_released"],
    known.map((row) => [row.id, row.owner_user_id, 0, 0]),
    "on conflict (member_id) do nothing",
  );
  const owners = new Map(known.map((row) => [row.id, row.owner_user_id]));
  const txs: unknown[][] = [];
  for (const source of placed) {
    if (share.beneficiaries.includes(source.id)) continue;
    for (const beneficiaryId of share.beneficiaries) {
      const owner = owners.get(beneficiaryId);
      if (!owner) continue;
      txs.push([
        `company:${source.id}:${beneficiaryId}`,
        beneficiaryId,
        owner,
        "COMPANY_SHARE",
        amount,
        `Company share ${share.percent}%`,
        source.id,
        "posted",
      ]);
    }
  }
  if (txs.length === 0) return;
  const params = txs.flat();
  const width = txs[0]!.length;
  const tuples = txs.map((row, rowIndex) => {
    const placeholders = row.map((_, index) => `$${rowIndex * width + index + 1}`);
    return `(${placeholders.join(", ")})`;
  });
  const posted = await exec<{ member_id: string; amount: number | string }>(
    sql,
    `insert into wallet_transactions (
       id, member_id, owner_user_id, type, amount, source, related_member_id, status
     ) values ${tuples.join(", ")}
     on conflict (id) do nothing
     returning member_id, amount`,
    params,
  );
  const totals = new Map<string, number>();
  for (const row of posted) totals.set(row.member_id, (totals.get(row.member_id) ?? 0) + Number(row.amount));
  if (totals.size === 0) return;
  const built = valuesSql([...totals].map(([id, amt]) => [id, amt]), ["text", "int"]);
  await exec(
    sql,
    `update wallets w
     set available_balance = available_balance + v.amount, updated_at = now()
     from (values ${built.sql}) as v(member_id, amount)
     where w.member_id = v.member_id`,
    built.params,
  );
}
