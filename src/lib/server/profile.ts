import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { makeReferralCode, uid } from "@/lib/engine/ids";
import { runtimeFlags } from "@/lib/runtime";
import { assertRateLimit } from "@/lib/server/rate-limit";

export type AppProfile = {
  userId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
  role: "member" | "admin";
  referralCode: string;
  activeId: string | null;
  createdAt: string;
};

function mapProfile(row: {
  user_id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  phone_verified: boolean;
  role: string;
  referral_code: string;
  active_id: string | null;
  created_at: string;
}): AppProfile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    phoneVerified: row.phone_verified,
    role: row.role === "admin" ? "admin" : "member",
    referralCode: row.referral_code,
    activeId: row.active_id,
    createdAt: row.created_at,
  };
}

export async function ensureProfileRow(
  userId: string,
  displayName: string,
  email: string | null,
): Promise<AppProfile> {
  const sql = await getSql();
  const existing = await sql<{
    user_id: string;
    display_name: string;
    email: string | null;
    phone: string | null;
    phone_verified: boolean;
    role: string;
    referral_code: string;
    active_id: string | null;
    created_at: string;
  }>`select * from app_users where user_id = ${userId}`;
  if (existing[0]) return mapProfile(existing[0]);

  const authUser = await sql<{ name: string; email: string | null }>`
    select name, email from "user" where id = ${userId}
  `;
  const name = authUser[0]?.name || displayName || "Member";
  const mail = authUser[0]?.email || email;

  const admins = await sql<{ n: number }>`select count(*)::int as n from app_users where role = 'admin' and is_synthetic = false`;
  const isFirst = (admins[0]?.n ?? 0) === 0;
  // Preview (PGLite) may bootstrap the first member as admin so the demo admin
  // panel is reachable. Production never auto-promotes — use scripts/provision-admin.mjs.
  const { dbSource } = await import("@/lib/db");
  const flags = runtimeFlags();
  const allowBootstrap =
    (dbSource === "pglite" && !flags.isProduction) || flags.bootstrapAdmin;
  const role = isFirst && allowBootstrap ? "admin" : "member";
  let code = makeReferralCode(userId + Date.now());
  for (let i = 0; i < 5; i++) {
    const clash = await sql<{ c: number }>`select count(*)::int as c from app_users where referral_code = ${code}`;
    if ((clash[0]?.c ?? 0) === 0) break;
    code = makeReferralCode(userId + i + Math.random());
  }

  await sql`
    insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
    values (${userId}, ${name}, ${mail}, ${role}, ${code}, false)
    on conflict (user_id) do nothing
  `;
  const created = await sql<{
    user_id: string;
    display_name: string;
    email: string | null;
    phone: string | null;
    phone_verified: boolean;
    role: string;
    referral_code: string;
    active_id: string | null;
    created_at: string;
  }>`select * from app_users where user_id = ${userId}`;
  return mapProfile(created[0]!);
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return ensureProfileRow(context.userId, "Member", null);
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      displayName: z.string().min(1).max(80).optional(),
      phone: z.string().max(20).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfileRow(context.userId, "Member", null);
    if (data.displayName) {
      await sql`update app_users set display_name = ${data.displayName} where user_id = ${context.userId}`;
    }
    if (data.phone !== undefined) {
      await sql`update app_users set phone = ${data.phone} where user_id = ${context.userId}`;
    }
    return ensureProfileRow(context.userId, "Member", null);
  });

export const setActiveId = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ memberId: z.string().min(3).max(40) }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const owned = await sql<{ id: string }>`
      select id from member_ids where id = ${data.memberId} and owner_user_id = ${context.userId}
    `;
    if (!owned[0]) throw new Error("ID not found");
    await sql`update app_users set active_id = ${data.memberId} where user_id = ${context.userId}`;
    return { ok: true as const, activeId: data.memberId };
  });

export const lookupReferral = createServerFn({ method: "GET" })
  .validator(z.object({ code: z.string().min(1).max(40) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const code = data.code.trim().toUpperCase();
    await assertRateLimit(sql, `referral:${code.slice(0, 16)}`, 40, 60);
    const byUser = await sql<{
      user_id: string;
      display_name: string;
      referral_code: string;
      active_id: string | null;
    }>`select user_id, display_name, referral_code, active_id from app_users where referral_code = ${code}`;
    if (byUser[0]) {
      let sponsorId = byUser[0].active_id;
      if (!sponsorId) {
        const first = await sql<{ id: string }>`
          select id from member_ids where owner_user_id = ${byUser[0].user_id} and is_root = true
          order by created_at asc limit 1
        `;
        sponsorId = first[0]?.id ?? null;
      }
      return {
        valid: true as const,
        name: byUser[0].display_name,
        referralCode: byUser[0].referral_code,
        sponsorMemberId: sponsorId,
      };
    }
    const byId = await sql<{
      id: string;
      owner_user_id: string;
    }>`select id, owner_user_id from member_ids where id = ${code} or id = ${"LM-" + code}`;
    if (byId[0]) {
      const owner = await sql<{ display_name: string; referral_code: string }>`
        select display_name, referral_code from app_users where user_id = ${byId[0].owner_user_id}
      `;
      return {
        valid: true as const,
        name: owner[0]?.display_name ?? "Member",
        referralCode: owner[0]?.referral_code ?? code,
        sponsorMemberId: byId[0].id,
      };
    }
    return { valid: false as const };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().optional() }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (data.id) {
      await sql`update notifications set read = true where id = ${data.id} and user_id = ${context.userId}`;
    } else {
      await sql`update notifications set read = true where user_id = ${context.userId}`;
    }
    return { ok: true as const };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{
      id: string;
      title: string;
      body: string;
      kind: string;
      read: boolean;
      created_at: string;
    }>`
      select id, title, body, kind, read, created_at
      from notifications where user_id = ${context.userId}
      order by created_at desc limit 50
    `;
  });

export const getShell = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await ensureProfileRow(context.userId, "Member", null);
    const sql = await getSql();
    const unread = await sql<{ n: number }>`
      select count(*)::int as n from notifications where user_id = ${context.userId} and read = false
    `;
    const idCount = await sql<{ n: number }>`
      select count(*)::int as n from member_ids where owner_user_id = ${context.userId}
    `;
    return { profile, unread: unread[0]?.n ?? 0, idCount: idCount[0]?.n ?? 0, flags: runtimeFlags() };
  });

