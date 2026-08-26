import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicErrorMessage } from "./public-error.ts";

describe("publicErrorMessage", () => {
  it("keeps known purchase and rate-limit messages", () => {
    assert.equal(
      publicErrorMessage(new Error("Online payment is not available yet.")),
      "Online payment is not available yet.",
    );
    assert.equal(
      publicErrorMessage(new Error("Too many attempts. Try again in a few minutes.")),
      "Too many attempts. Try again in a few minutes.",
    );
    assert.equal(publicErrorMessage(new Error("Invalid referral code")), "Invalid referral code.");
    assert.equal(
      publicErrorMessage(new Error("Amount does not match the locked package price.")),
      "Amount does not match the locked package price.",
    );
    assert.equal(publicErrorMessage(new Error("Payment request not found")), "Payment request not found");
    assert.equal(publicErrorMessage(new Error("Forbidden")), "You do not have access to that.");
  });

  it("hides stack traces and database errors", () => {
    assert.equal(
      publicErrorMessage(new Error("DATABASE_URL is required when APP_ENV=production (ephemeral storage is not allowed).")),
      "The service is temporarily unavailable. Try again shortly.",
    );
    assert.equal(
      publicErrorMessage(new Error("connect ECONNREFUSED 127.0.0.1:5432")),
      "The service is temporarily unavailable. Try again shortly.",
    );
    assert.match(
      publicErrorMessage(new Error("Error\n    at Object.<anonymous> (/workspace/src/lib/db.ts:12:3)")),
      /Something went wrong/,
    );
  });

  it("maps credential failures without enumerating accounts", () => {
    assert.equal(publicErrorMessage(new Error("Invalid email or password")), "Email or password is incorrect.");
  });
});
