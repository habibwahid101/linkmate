import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { remainingHoldMs, shouldShowQueryError } from "./min-pending.ts";

describe("remainingHoldMs", () => {
  it("does not delay when data was already ready", () => {
    assert.equal(remainingHoldMs(null, 1_000, false, 180), 0);
  });

  it("holds while pending", () => {
    assert.equal(remainingHoldMs(900, 1_000, true, 180), 180);
  });

  it("holds only the unused remainder after a short load", () => {
    assert.equal(remainingHoldMs(1_000, 1_050, false, 180), 130);
  });

  it("releases immediately after the minimum duration", () => {
    assert.equal(remainingHoldMs(1_000, 1_200, false, 180), 0);
  });
});

describe("shouldShowQueryError", () => {
  it("hides error UI while a request is in flight", () => {
    assert.equal(shouldShowQueryError({ isPending: false, isFetching: true, isError: true }), false);
    assert.equal(shouldShowQueryError({ isPending: true, isFetching: true, isError: false }), false);
  });

  it("shows error UI only after a settled failure", () => {
    assert.equal(shouldShowQueryError({ isPending: false, isFetching: false, isError: true }), true);
  });
});
