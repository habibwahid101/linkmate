import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAuthConfigured } from "./auth-mode.ts";

describe("isAuthConfigured", () => {
  it("treats email/password production as configured when broker credentials are absent", () => {
    assert.equal(
      isAuthConfigured({
        viteAuthEnabled: "true",
        grokClientId: undefined,
        grokClientSecret: undefined,
        emailAndPasswordEnabled: true,
      }),
      true,
    );
  });

  it("fails closed when VITE_AUTH_ENABLED=false even if email/password is compiled in", () => {
    assert.equal(
      isAuthConfigured({
        viteAuthEnabled: "false",
        grokClientId: undefined,
        grokClientSecret: undefined,
        emailAndPasswordEnabled: true,
      }),
      false,
    );
  });

  it("requires broker credentials when email/password is off", () => {
    assert.equal(
      isAuthConfigured({
        viteAuthEnabled: undefined,
        grokClientId: undefined,
        grokClientSecret: undefined,
        emailAndPasswordEnabled: false,
      }),
      false,
    );
    assert.equal(
      isAuthConfigured({
        viteAuthEnabled: undefined,
        grokClientId: "id",
        grokClientSecret: "secret",
        emailAndPasswordEnabled: false,
      }),
      true,
    );
  });
});
