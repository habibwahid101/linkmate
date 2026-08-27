export type Sql = {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
};

export type ClaimResult = {
  locked: boolean;
  referralCode: string | null;
  sponsorUserId: string | null;
  reason?: string;
};

async function resolveSponsorUser(sql: Sql, raw: string) {
  const code = raw.trim().toUpperCase();
  if (!code) return null;
  const byUser = await sql<{ user_id: string; referral_code: string }>`
    select user_id, referral_code from app_users where upper(referral_code) = ${code}
  `;
  if (byUser[0]) return byUser[0];
  const byId = await sql<{ owner_user_id: string }>`
    select owner_user_id from member_ids where id = ${code} or id = ${"LM-" + code}
  `;
  if (!byId[0]) return null;
  const owner = await sql<{ user_id: string; referral_code: string }>`
    select user_id, referral_code from app_users where user_id = ${byId[0].owner_user_id}
  `;
  return owner[0] ?? null;
}

/** First valid referral wins. Later client values cannot replace it. */
export async function claimIntendedReferral(
  sql: Sql,
  userId: string,
  rawCode: string | undefined,
): Promise<ClaimResult> {
  const existing = await sql<{
    intended_referral_code: string | null;
    intended_sponsor_user_id: string | null;
    referral_code: string;
  }>`
    select intended_referral_code, intended_sponsor_user_id, referral_code
    from app_users where user_id = ${userId}
  `;
  if (!existing[0]) throw new Error("Profile not found");
  if (existing[0].intended_referral_code) {
    return {
      locked: true,
      referralCode: existing[0].intended_referral_code,
      sponsorUserId: existing[0].intended_sponsor_user_id,
    };
  }
  const code = rawCode?.trim().toUpperCase();
  if (!code) {
    return { locked: false, referralCode: null, sponsorUserId: null, reason: "empty" };
  }
  const sponsor = await resolveSponsorUser(sql, code);
  if (!sponsor) throw new Error("Invalid referral code");
  if (sponsor.user_id === userId) throw new Error("You cannot refer yourself");
  await sql`
    update app_users
    set intended_referral_code = ${sponsor.referral_code},
        intended_sponsor_user_id = ${sponsor.user_id}
    where user_id = ${userId} and intended_referral_code is null
  `;
  return { locked: true, referralCode: sponsor.referral_code, sponsorUserId: sponsor.user_id };
}

export async function authoritativeReferralCode(
  sql: Sql,
  userId: string,
  clientCode?: string,
): Promise<string | undefined> {
  const claimed = await claimIntendedReferral(sql, userId, clientCode);
  return claimed.referralCode ?? undefined;
}
