import {
  LEVELS,
  STANDARD_ID_VALUE_BDT,
  RULE_VERSION,
  commissionPerMember,
  fullLevelCommission,
  type PackageId,
  type LevelStatus,
} from "../rules.ts";
import { planPackagePlacement } from "./placement.ts";
import { formatMemberId, uid } from "./ids.ts";
import {
  canReleaseLevel,
  crossesPackageBoundary,
  joinEventId,
  resolveLevelStatus,
  reversalTxId,
} from "./level-state.ts";

type Sql = {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
};

type MemberRow = {
  id: string;
  owner_user_id: string;
  parent_id: string | null;
  sponsor_id: string | null;
  joining_amount_bdt: number | string;
  purchase_id: string | null;
  is_root: boolean;
};

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

async function nextMemberCode(sql: Sql): Promise<string> {
  const rows = await sql<{ n: number }>`select nextval('member_id_seq')::int as n`;
  return formatMemberId(rows[0]!.n);
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

async function ensureLevelRows(sql: Sql, memberId: string) {
  for (const level of LEVELS) {
    const expected = fullLevelCommission(level.level);
    const status: LevelStatus = level.level === 1 ? "IN_PROGRESS" : "LOCKED";
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

async function ensureWallet(sql: Sql, memberId: string, ownerUserId: string) {
  await sql`
    insert into wallets (member_id, owner_user_id, available_balance, total_released)
    values (${memberId}, ${ownerUserId}, 0, 0)
    on conflict (member_id) do nothing
  `;
}

async function parentOf(sql: Sql, memberId: string): Promise<string | null> {
  const rows = await sql<{ parent_id: string | null }>`
    select parent_id from member_ids where id = ${memberId}
  `;
  return rows[0]?.parent_id ?? null;
}

async function loadMember(sql: Sql, id: string): Promise<MemberRow | null> {
  const rows = await sql<MemberRow>`
    select id, owner_user_id, parent_id, sponsor_id, joining_amount_bdt, purchase_id, is_root
    from member_ids where id = ${id}
  `;
  return rows[0] ?? null;
}

export async function reconcileWallet(sql: Sql, memberId: string) {
  const rows = await sql<{ available: number; released: number }>`
    select
      coalesce(sum(amount), 0)::int as available,
      coalesce(sum(case when type in ('RELEASE', 'REVERSAL') then amount else 0 end), 0)::int as released
    from wallet_transactions
    where member_id = ${memberId} and status = 'posted'
  `;
  await sql`
    update wallets set
      available_balance = ${rows[0]?.available ?? 0},
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

async function creditCommission(
  sql: Sql,
  opts: {
    beneficiary: MemberRow;
    source: MemberRow;
    generation: number;
    joiningAmount: number;
  },
): Promise<{ created: boolean; amount: number }> {
  const level = LEVELS.find((l) => l.generation === opts.generation);
  if (!level) return { created: false, amount: 0 };
  const amount = commissionPerMember(opts.joiningAmount, level.rate);
  const eventId = joinEventId(opts.source.id, opts.beneficiary.id, level.level);

  const inserted = await sql<{ id: string }>`
    insert into commission_entries (
      id, event_id, beneficiary_user_id, beneficiary_id, source_user_id, source_id,
      source_joining_amount, generation, level, commission_rate, commission_amount,
      status, rule_version
    ) values (
      ${uid()}, ${eventId}, ${opts.beneficiary.owner_user_id}, ${opts.beneficiary.id},
      ${opts.source.owner_user_id}, ${opts.source.id}, ${opts.joiningAmount},
      ${level.generation}, ${level.level}, ${level.rate}, ${amount},
      'HELD', ${RULE_VERSION}
    )
    on conflict (event_id) do nothing
    returning id
  `;
  if (inserted.length === 0) return { created: false, amount };

  await sql`
    insert into held_commissions (member_id, owner_user_id, level, amount)
    values (${opts.beneficiary.id}, ${opts.beneficiary.owner_user_id}, ${level.level}, ${amount})
    on conflict (member_id, level) do update
      set amount = held_commissions.amount + excluded.amount
  `;

  await notify(
    sql,
    opts.beneficiary.owner_user_id,
    "held",
    "Held commission increased",
    `${opts.source.id} added ৳${amount.toLocaleString("en-US")} held commission on Level ${level.level}.`,
  );

  return { created: true, amount };
}

async function recountAndMaybeRelease(sql: Sql, beneficiaryId: string) {
  return withMemberLock(beneficiaryId, () => recountAndMaybeReleaseUnlocked(sql, beneficiaryId));
}

async function recountAndMaybeReleaseUnlocked(sql: Sql, beneficiaryId: string) {
  const member = await loadMember(sql, beneficiaryId);
  if (!member) return;

  const directRows = await sql<{ n: number }>`
    select count(*)::int as n from sponsor_relationships where sponsor_id = ${beneficiaryId}
  `;
  const directCount = directRows[0]?.n ?? 0;

  const genCounts = await sql<{ generation: number; n: number }>`
    select generation, count(*)::int as n
    from generation_memberships
    where beneficiary_id = ${beneficiaryId}
    group by generation
  `;
  const byGen = new Map<number, number>();
  for (const row of genCounts) byGen.set(row.generation, row.n);

  const progress = await sql<{
    level: number;
    status: string;
    accumulated_commission: number;
  }>`
    select level, status, accumulated_commission from level_progress
    where member_id = ${beneficiaryId} order by level
  `;

  const ledger = await sql<{ level: number; status: string; amount: number }>`
    select level, status, coalesce(sum(commission_amount), 0)::int as amount
    from commission_entries
    where beneficiary_id = ${beneficiaryId} and status in ('HELD', 'RELEASED')
    group by level, status
  `;
  const heldByLevel = new Map<number, number>();
  const releasedByLevel = new Map<number, number>();
  for (const row of ledger) {
    if (row.status === "HELD") heldByLevel.set(row.level, Number(row.amount));
    if (row.status === "RELEASED") releasedByLevel.set(row.level, Number(row.amount));
  }

  let previousReleased = true;
  for (const level of LEVELS) {
    const qualifying =
      level.level === 1 ? directCount : (byGen.get(level.generation) ?? 0);

    const held = heldByLevel.get(level.level) ?? 0;
    const releasedAmt = releasedByLevel.get(level.level) ?? 0;
    const accumulated = held + releasedAmt;
    const remaining = Math.max(0, level.requiredMembers - qualifying);

    const row = progress.find((p) => p.level === level.level);
    const stillComplete = qualifying >= level.requiredMembers;
    const alreadyReleased = row?.status === "RELEASED" && stillComplete;
    const status = resolveLevelStatus({
      level: level.level,
      qualifying,
      required: level.requiredMembers,
      previousReleased,
      alreadyReleased,
    });

    const completedAt = qualifying >= level.requiredMembers && !alreadyReleased ? new Date().toISOString() : null;

    await sql`
      update level_progress set
        completed_members = ${qualifying},
        remaining_members = ${remaining},
        accumulated_commission = ${accumulated},
        status = ${alreadyReleased ? "RELEASED" : status},
        completed_at = coalesce(completed_at, ${completedAt}::timestamptz)
      where member_id = ${beneficiaryId} and level = ${level.level}
    `;

    if (alreadyReleased) {
      if (held > 0) await releaseLevel(sql, member, level.level, level.generation);
      previousReleased = true;
      continue;
    }

    const shouldRelease = canReleaseLevel({
      level: level.level,
      qualifying,
      required: level.requiredMembers,
      previousReleased,
      alreadyReleased: false,
      directCount,
    });

    if (shouldRelease) {
      await releaseLevel(sql, member, level.level, level.generation);
      previousReleased = true;
    } else {
      previousReleased = false;
    }
  }
}

async function releaseLevel(
  sql: Sql,
  beneficiary: MemberRow,
  level: number,
  generation: number,
) {
  const prior = await sql<{ n: number }>`
    select count(*)::int as n from wallet_transactions
    where member_id = ${beneficiary.id} and level = ${level} and type = 'RELEASE'
  `;
  const txId = `release:${beneficiary.id}:${level}:${prior[0]?.n ?? 0}`;
  const claimed = await sql<{ commission_amount: number }>`
    update commission_entries
    set status = 'RELEASED', released_at = now(), wallet_transaction_id = ${txId}
    where beneficiary_id = ${beneficiary.id} and level = ${level} and status = 'HELD'
    returning commission_amount
  `;
  if (claimed.length === 0) {
    await sql`
      update level_progress
      set status = 'RELEASED', released_at = coalesce(released_at, now())
      where member_id = ${beneficiary.id} and level = ${level}
    `;
    return;
  }

  const total = claimed.reduce((s, r) => s + Number(r.commission_amount), 0);

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

  await sql`
    insert into held_commissions (member_id, owner_user_id, level, amount)
    values (${beneficiary.id}, ${beneficiary.owner_user_id}, ${level}, 0)
    on conflict (member_id, level) do update set amount = 0
  `;

  await sql`
    update level_progress
    set status = 'RELEASED', released_at = coalesce(released_at, now())
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
}

export async function processNewId(sql: Sql, newId: string) {
  const source = await loadMember(sql, newId);
  if (!source) return;
  const joiningAmount = Number(source.joining_amount_bdt) || STANDARD_ID_VALUE_BDT;

  const affected = new Set<string>();

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
        joiningAmount,
      });
      affected.add(sponsor.id);

      await notify(
        sql,
        sponsor.owner_user_id,
        "direct",
        "New direct member",
        `${source.id} joined under ${sponsor.id}.`,
      );
    }
  }

  let nodeId = source.parent_id;
  let dist = 1;
  while (nodeId && dist <= 9) {
    const ancestor = await loadMember(sql, nodeId);
    if (!ancestor) break;

    if (crossesPackageBoundary(source, ancestor)) break;

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
          joiningAmount,
        });
        await notify(
          sql,
          ancestor.owner_user_id,
          "generation",
          `${dist === 2 ? "2nd" : dist === 3 ? "3rd" : dist + "th"} generation member counted`,
          `${source.id} is now in generation ${dist} of ${ancestor.id}.`,
        );
      }
    }

    affected.add(ancestor.id);
    nodeId = await parentOf(sql, ancestor.id);
    dist += 1;
  }

  for (const id of affected) {
    await recountAndMaybeRelease(sql, id);
  }
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

  await sql`delete from generation_memberships where member_id = ${opts.sourceId}`;
  await sql`delete from sponsor_relationships where sponsored_id = ${opts.sourceId}`;

  for (const id of affected) {
    const member = await loadMember(sql, id);
    if (!member) continue;
    await rebuildHeld(sql, id, member.owner_user_id);
    await reconcileWallet(sql, id);
    await recountAndMaybeRelease(sql, id);
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

export async function createIdsForPurchase(
  sql: Sql,
  opts: {
    userId: string;
    packageId: PackageId;
    purchaseId: string;
    externalSponsorId: string | null;
  },
): Promise<{ rootId: string; ids: string[] }> {
  const plan = planPackagePlacement(opts.packageId);
  const codes: string[] = [];
  for (let i = 0; i < plan.length; i++) {
    codes.push(await nextMemberCode(sql));
  }

  for (let i = 0; i < plan.length; i++) {
    const p = plan[i]!;
    const id = codes[i]!;
    const parentId = p.isRoot
      ? opts.externalSponsorId
      : p.parentIndex != null
        ? codes[p.parentIndex]!
        : null;
    const internalSponsor = p.sponsorIndex != null ? codes[p.sponsorIndex]! : null;
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

    if (sponsorId) {
      await sql`
        insert into sponsor_relationships (id, sponsor_id, sponsored_id)
        values (${uid()}, ${sponsorId}, ${id})
        on conflict (sponsored_id) do nothing
      `;
    }
    if (parentId && p.placementStatus === "placed") {
      await sql`
        insert into placement_relationships (id, parent_id, child_id, position)
        values (${uid()}, ${parentId}, ${id}, ${p.position})
        on conflict (child_id) do nothing
      `;
    }
  }

  for (let i = 0; i < plan.length; i++) {
    const p = plan[i]!;
    if (p.placementStatus === "pending_config" && !p.isRoot && p.sponsorIndex == null && p.parentIndex == null) {
      continue;
    }
    await processNewId(sql, codes[i]!);
  }

  const rootId = codes[0]!;
  await sql`update package_purchases set root_id = ${rootId} where id = ${opts.purchaseId}`;

  await notify(
    sql,
    opts.userId,
    "ids",
    "New IDs created",
    `${codes.length} ID${codes.length === 1 ? "" : "s"} issued for your ${opts.packageId.replace("_", " ")} package. Root: ${rootId}.`,
  );

  return { rootId, ids: codes };
}

export async function attachExternalMember(
  sql: Sql,
  opts: {
    ownerUserId: string;
    displayName: string;
    email: string | null;
    packageId: PackageId;
    sponsorMemberId: string;
    parentMemberId: string;
  },
): Promise<string> {
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
