import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dockerfile = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "Dockerfile"),
  "utf8",
);

describe("production Dockerfile", () => {
  it("uses node-server, not Vercel output, and does not bake secrets", () => {
    assert.match(dockerfile, /NITRO_PRESET=node-server/);
    assert.match(dockerfile, /USER linkmate/);
    assert.match(dockerfile, /AUTH_BROKER=off/);
    assert.match(dockerfile, /PAYMENTS_MODE=disabled/);
    assert.match(dockerfile, /ALLOW_BOOTSTRAP_ADMIN=false/);
    assert.match(dockerfile, /EXPOSE 8080/);
    assert.equal(dockerfile.includes(".vercel/output"), false);
    assert.equal(dockerfile.includes("DATABASE_URL="), false);
    assert.equal(dockerfile.includes("BETTER_AUTH_SECRET="), false);
    assert.equal(dockerfile.includes("GROK_AUTH_CLIENT"), false);
  });
});
