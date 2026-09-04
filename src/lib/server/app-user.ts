import { makeReferralCode } from "../engine/ids.ts";
import { runtimeFlags } from "../runtime.ts";
import { isLockedAdminEmail } from "../auth/locked-admins.ts";

export type Sql = {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
};

export type AppUserRow = {
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

export type AuthIdentity = {
  id: string;
  name?: string | null;
  email?: string | null;
};

function mapRow(row: {
  user_id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  phone_verified: boolean;
  role: string;
  referral_code: string;
  active_id: string | null;
  created_at: string;
}): AppUserRow {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    phoneVerified: Boolean(row.phone_verified),
    role: row.role === "admin" ? "admin" : "member",
    referralCode: row.referral_code,
    activeId: row.active_id,
    createdAt: row.created_at,
  };
}

async function loadAppUser(sql: Sql, userId: string): Promise<AppUserRow | null> {
  const rows = await sql<{
    user_id: string;
    display_name: string;
    email: string | null;
    phone: string | null;
    phone_verified: boolean;
    role: string;
    referral_code: string;
    active_id: string | null;
    created_at: string;
  }>`
    select user_id, display_name, email, phone, phone_verified, role, referral_code, active_id, created_at
    from app_users where user_id = ${userId}
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

function uniqueViolation(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return code === "23505" || /duplicate key|unique constraint/i.test(message);
}

async function persistLockedAdmin(sql: Sql, row: AppUserRow): Promise<AppUserRow> {
  if (!isLockedAdminEmail(row.email)) return row;
  await sql`update app_users set role = 'admin' where user_id = ${row.userId} and role <> 'admin'`;
  return { ...row, role: "admin" };
}

/**
 * Idempotent application profile for a Better Auth identity.
 * Never grants admin in production except locked platform operator emails.
 * Never demotes an existing admin. Restores locked operators if their role was toggled off.
 */
export async function ensureAppUser(
  sql: Sql,
  identity: AuthIdentity,
  opts?: { allowBootstrapAdmin?: boolean },
): Promise<AppUserRow> {
  if (!identity.id) throw new Error("Authenticated user id is required");
  const existing = await loadAppUser(sql, identity.id);
  if (existing) {
    if (identity.email && !existing.email) {
      await sql`update app_users set email = ${identity.email} where user_id = ${identity.id} and email is null`;
      const updated = (await loadAppUser(sql, identity.id)) ?? existing;
      return persistLockedAdmin(sql, updated);
    }
    return persistLockedAdmin(sql, existing);
  }

  const authRows = await sql<{ name: string | null; email: string | null }>`
    select name, email from "user" where id = ${identity.id}
  `;
  const name = (authRows[0]?.name || identity.name || "Member").trim() || "Member";
  const email = authRows[0]?.email || identity.email || null;

  const flags = runtimeFlags();
  const allowBootstrap = opts?.allowBootstrapAdmin ?? flags.bootstrapAdmin;
  let role: "member" | "admin" = isLockedAdminEmail(email) ? "admin" : "member";
  if (role === "member" && allowBootstrap && !flags.isProduction) {
    const admins = await sql<{ n: number }>`
      select count(*)::int as n from app_users where role = 'admin' and is_synthetic = false
    `;
    if ((admins[0]?.n ?? 0) === 0) role = "admin";
  }

  for (let i = 0; i < 8; i++) {
    const code = makeReferralCode(`${identity.id}:${i}:${Date.now()}:${Math.random()}`);
    try {
      await sql`
        insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
        values (${identity.id}, ${name}, ${email}, ${role}, ${code}, false)
        on conflict (user_id) do nothing
      `;
    } catch (error) {
      if (uniqueViolation(error)) {
        const recovered = await loadAppUser(sql, identity.id);
        if (recovered) return persistLockedAdmin(sql, recovered);
        continue;
      }
      throw error;
    }
    const created = await loadAppUser(sql, identity.id);
    if (created) return persistLockedAdmin(sql, created);
  }

  const last = await loadAppUser(sql, identity.id);
  if (last) return persistLockedAdmin(sql, last);
  throw new Error("Could not create application profile");
}

export async function ensureAppUserForId(userId: string, identity?: Partial<AuthIdentity>) {
  const { getSql } = await import("../db");
  const sql = await getSql();
  return ensureAppUser(sql, { id: userId, name: identity?.name, email: identity?.email });
}
