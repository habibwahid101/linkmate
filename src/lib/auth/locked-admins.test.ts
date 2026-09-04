import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCanDemoteAdmin,
  effectiveRole,
  isLockedAdminEmail,
  lockedAdminEmails,
} from "./locked-admins.ts";

describe("locked platform admins", () => {
  it("includes both live operator emails by default", () => {
    const emails = lockedAdminEmails(() => undefined);
    assert.equal(emails.has("hello.habibwahid@gmail.com"), true);
    assert.equal(emails.has("linkmateglobal@gmail.com"), true);
  });

  it("merges extra emails from env", () => {
    const emails = lockedAdminEmails((key) =>
      key === "LOCKED_ADMIN_EMAILS" ? "ops@lm.test, Second@LM.test" : undefined,
    );
    assert.equal(emails.has("ops@lm.test"), true);
    assert.equal(emails.has("second@lm.test"), true);
  });

  it("treats locked emails as admin even if the stored role is member", () => {
    assert.equal(isLockedAdminEmail("LinkMateGlobal@gmail.com", () => undefined), true);
    assert.equal(effectiveRole("linkmateglobal@gmail.com", "member", () => undefined), "admin");
    assert.equal(effectiveRole("member@lm.test", "member", () => undefined), "member");
    assert.equal(effectiveRole("member@lm.test", "admin", () => undefined), "admin");
  });

  it("blocks demotion of a locked operator", () => {
    assert.throws(
      () => assertCanDemoteAdmin("linkmateglobal@gmail.com", () => undefined),
      /Cannot demote a platform administrator/,
    );
    assertCanDemoteAdmin("member@lm.test", () => undefined);
  });
});
