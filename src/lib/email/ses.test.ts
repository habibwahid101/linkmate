import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sesConfigured, sendTransactionalEmail } from "./ses.ts";

describe("sesConfigured", () => {
  it("is false without SES_FROM_EMAIL", () => {
    const prev = process.env.SES_FROM_EMAIL;
    delete process.env.SES_FROM_EMAIL;
    try {
      assert.equal(sesConfigured(), false);
    } finally {
      if (prev === undefined) delete process.env.SES_FROM_EMAIL;
      else process.env.SES_FROM_EMAIL = prev;
    }
  });
});

describe("sendTransactionalEmail", () => {
  it("does not fake a send when SES is unset", async () => {
    const prev = process.env.SES_FROM_EMAIL;
    delete process.env.SES_FROM_EMAIL;
    try {
      const result = await sendTransactionalEmail({
        to: "user@example.com",
        subject: "test",
        text: "test",
      });
      assert.equal(result.sent, false);
    } finally {
      if (prev === undefined) delete process.env.SES_FROM_EMAIL;
      else process.env.SES_FROM_EMAIL = prev;
    }
  });
});
