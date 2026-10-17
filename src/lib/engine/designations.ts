import type { Sql } from "./activation.ts";

/** Display-only. These thresholds do not pay commission or change Level 1. */
export const DESIGNATIONS = [
  { id: "sales_executive", label: "Sales Executive", minDirects: 3 },
  { id: "platinum_executive", label: "Platinum Executive", minDirects: 9 },
  { id: "assistant_manager", label: "Assistant Manager", minDirects: 18 },
  { id: "manager", label: "Manager", minDirects: 35 },
  { id: "general_manager", label: "General Manager", minDirects: 87 },
  { id: "project_director", label: "Project Director", minDirects: 222 },
] as const;

export type Designation = (typeof DESIGNATIONS)[number];

export function designationForCount(count: number): Designation | null {
  const n = Math.max(0, Math.floor(count));
  let best: Designation | null = null;
  for (const row of DESIGNATIONS) {
    if (n >= row.minDirects) best = row;
  }
  return best;
}

export function nextDesignation(count: number): Designation | null {
  const n = Math.max(0, Math.floor(count));
  return DESIGNATIONS.find((row) => n < row.minDirects) ?? null;
}

export function designationSummary(count: number): { label: string; detail: string } {
  const n = Math.max(0, Math.floor(count));
  const current = designationForCount(n);
  const next = nextDesignation(n);
  if (current) {
    return {
      label: current.label,
      detail: next ? `${n} personal sponsors · next ${next.label} at ${next.minDirects}` : `${n} personal sponsors`,
    };
  }
  const target = next?.minDirects ?? 3;
  const title = next?.label ?? "Sales Executive";
  return { label: "No designation yet", detail: `${n} / ${target} personal sponsors for ${title}` };
}

/** One credit per activated package ID, given to that purchase's external sponsor. */
export async function recordDesignationCredit(sql: Sql, sourceId: string): Promise<void> {
  const rows = await sql<{
    sponsor_id: string;
    sponsor_owner_user_id: string;
  }>`
    select sponsor.id as sponsor_id, sponsor.owner_user_id as sponsor_owner_user_id
    from member_ids m
    left join member_ids root
      on m.origin_kind = 'package_internal'
     and root.purchase_id = m.purchase_id
     and root.is_root
    join member_ids credited on credited.id = coalesce(root.id, m.id)
    join member_ids sponsor on sponsor.id = credited.sponsor_id
    where m.id = ${sourceId}
      and credited.sponsor_id is not null
      and (m.origin_kind <> 'package_internal' or root.id is not null)
      and (
        m.origin_kind in ('purchase_root', 'attach', 'package_internal')
        or (m.origin_kind = 'purchase' and m.is_root)
      )
  `;
  const row = rows[0];
  if (!row?.sponsor_id) return;
  await sql`
    insert into sponsor_designation_credits (
      id, sponsor_id, sponsored_id, sponsor_owner_user_id
    ) values (
      ${"desig:" + sourceId}, ${row.sponsor_id}, ${sourceId}, ${row.sponsor_owner_user_id}
    )
    on conflict (sponsored_id) do update
      set voided_at = null,
          void_reason = null
      where sponsor_designation_credits.sponsor_id = excluded.sponsor_id
        and sponsor_designation_credits.voided_at is not null
  `;
}

/** Admin reversal of the activation removes the credit. Inactivity does not call this. */
export async function voidDesignationCredit(sql: Sql, sourceId: string, reason: string): Promise<void> {
  await sql`
    update sponsor_designation_credits
    set voided_at = now(), void_reason = ${reason}
    where sponsored_id = ${sourceId} and voided_at is null
  `;
}

export async function countDesignationCredits(sql: Sql, sponsorId: string): Promise<number> {
  const rows = await sql<{ n: number }>`
    select count(*)::int as n
    from sponsor_designation_credits
    where sponsor_id = ${sponsorId} and voided_at is null
  `;
  return Number(rows[0]?.n ?? 0);
}
