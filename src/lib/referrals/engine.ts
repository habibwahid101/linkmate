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

export async function resolveSponsorMember(
  sql: Sql,
  raw: string,
): Promise<{
  memberId: string;
  ownerUserId: string;
  referralCode: string;
  displayName: string;
} | null> {
  const code = raw.trim().toUpperCase();
  if (!code) return null;
  const byMemberCode = await sql<{
    id: string;
    owner_user_id: string;
    referral_code: string;
  }>`select id, owner_user_id, referral_code from member_ids where upper(referral_code) = ${code}`;
  if (byMemberCode[0]?.referral_code) {
    const owner = await sql<{ display_name: string }>`
      select display_name from app_users where user_id = ${byMemberCode[0].owner_user_id}
    `;
    return {
      memberId: byMemberCode[0].id,
      ownerUserId: byMemberCode[0].owner_user_id,
      referralCode: byMemberCode[0].referral_code,
      displayName: owner[0]?.display_name ?? "Member",
    };
  }
  const byId = await sql<{
    id: string;
    owner_user_id: string;
    referral_code: string | null;
  }>`select id, owner_user_id, referral_code from member_ids where id = ${code} or id = ${"LM-" + code}`;
  if (byId[0]) {
    const owner = await sql<{ display_name: string; referral_code: string }>`
      select display_name, referral_code from app_users where user_id = ${byId[0].owner_user_id}
    `;
    return {
      memberId: byId[0].id,
      ownerUserId: byId[0].owner_user_id,
      referralCode: byId[0].referral_code ?? owner[0]?.referral_code ?? code,
      displayName: owner[0]?.display_name ?? "Member",
    };
  }
  const byUser = await sql<{
    user_id: string;
    display_name: string;
    referral_code: string;
    active_id: string | null;
  }>`select user_id, display_name, referral_code, active_id from app_users where upper(referral_code) = ${code}`;
  if (!byUser[0]) return null;
  let memberId = byUser[0].active_id;
  if (!memberId) {
    const first = await sql<{ id: string }>`
      select id from member_ids where owner_user_id = ${byUser[0].user_id} and is_root = true
      order by created_at asc limit 1
    `;
    memberId = first[0]?.id ?? null;
  }
  if (!memberId) {
    const any = await sql<{ id: string }>`
      select id from member_ids where owner_user_id = ${byUser[0].user_id}
      order by created_at asc limit 1
    `;
    memberId = any[0]?.id ?? null;
  }
  if (!memberId) return null;
  const member = await sql<{ referral_code: string | null }>`
    select referral_code from member_ids where id = ${memberId}
  `;
  return {
    memberId,
    ownerUserId: byUser[0].user_id,
    referralCode: member[0]?.referral_code ?? byUser[0].referral_code,
    displayName: byUser[0].display_name,
  };
}

async function resolveSponsorUser(sql: Sql, raw: string) {
  const member = await resolveSponsorMember(sql, raw);
  if (member) return { user_id: member.ownerUserId, referral_code: member.referralCode };
  const code = raw.trim().toUpperCase();
  if (!code) return null;
  const byUser = await sql<{ user_id: string; referral_code: string }>`
    select user_id, referral_code from app_users where upper(referral_code) = ${code}
  `;
  return byUser[0] ?? null;
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
