import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = join(root, ".output/server/index.mjs");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("AWS node-server artifact", () => {
  it("exists after npm run build:aws", () => {
    assert.equal(existsSync(serverEntry), true, "run npm run build:aws first");
  });

  it("serves live health, 503 readiness, and pages without DATABASE_URL", async () => {
    const port = 18099;
    const child = spawn(process.execPath, [serverEntry], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: "production",
        APP_ENV: "production",
        AUTH_BROKER: "off",
        PAYMENTS_MODE: "disabled",
        HOST: "127.0.0.1",
        PORT: String(port),
        DATABASE_URL: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let ready = false;
    child.stdout.on("data", (buf) => {
      if (String(buf).includes("Listening")) ready = true;
    });
    const started = Date.now();
    while (!ready && Date.now() - started < 8000) await wait(100);
    try {
      assert.equal(ready, true, "server did not listen");
      const health = await fetch(`http://127.0.0.1:${port}/api/health`);
      const healthBody = await health.json();
      assert.equal(health.status, 200);
      assert.equal(healthBody.ok, true);
      assert.equal(healthBody.status, "live");
      const readiness = await fetch(`http://127.0.0.1:${port}/api/readiness`);
      const readyBody = await readiness.json();
      assert.equal(readiness.status, 503);
      assert.equal(readyBody.durable, false);
      assert.equal(JSON.stringify(readyBody).includes("postgres"), false);
      const version = await fetch(`http://127.0.0.1:${port}/api/version`);
      const versionBody = await version.json();
      assert.equal(version.status, 200);
      assert.equal(JSON.stringify(versionBody).includes("DATABASE"), false);
      const home = await fetch(`http://127.0.0.1:${port}/`);
      assert.equal(home.status, 200);
    } finally {
      child.kill("SIGTERM");
      await wait(300);
    }
  });
});
