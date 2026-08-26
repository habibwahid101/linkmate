import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = join(root, ".vercel/output/functions/__server.func/index.mjs");

function runScenario(env, paths) {
  const script = `
const paths = ${JSON.stringify(paths)};
const mod = await import(${JSON.stringify(serverEntry + "?boot=" + Math.random())});
const results = [];
for (const path of paths) {
  const res = await mod.default.fetch(new Request("https://dove-maple-orchid-brook.grok.me" + path, {
    headers: { accept: "text/html,application/json" },
  }));
  const text = await res.text();
  results.push({ path, status: res.status, body: text.slice(0, 280) });
}
process.stdout.write(JSON.stringify({ importOk: true, results }));
`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    env: { ...process.env, ...env },
    encoding: "utf8",
    cwd: root,
    timeout: 30000,
    maxBuffer: 2_000_000,
  });
  return result;
}

describe("built production server boot", () => {
  it("has a vercel serverless build to test", () => {
    assert.equal(existsSync(serverEntry), true, "run npm run build:app first");
  });

  it("writes a static version fingerprint proving the SSR patch ran", () => {
    const file = join(root, ".vercel/output/static/version.json");
    assert.equal(existsSync(file), true, "version.json missing — patch hook did not run");
    const info = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(info.patched, true);
    assert.equal(typeof info.commit, "string");
    const raw = JSON.stringify(info);
    assert.equal(raw.includes("DATABASE"), false);
    assert.equal(raw.includes("postgres"), false);
  });

  it("production without DATABASE_URL: import succeeds, health is 503, pages boot", () => {
    const result = runScenario(
      {
        NODE_ENV: "production",
        APP_ENV: "production",
        VERCEL_ENV: "production",
        VITE_PUBLIC_HOSTNAME: "dove-maple-orchid-brook.grok.me",
        DATABASE_URL: "",
        BETTER_AUTH_SECRET: "",
        BETTER_AUTH_URL: "",
      },
      ["/api/health", "/", "/login", "/signup"],
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.importOk, true);
    const health = payload.results.find((row) => row.path === "/api/health");
    assert.equal(health.status, 503);
    assert.match(health.body, /"ok":false/);
    assert.match(health.body, /"durable":false/);
    assert.equal(health.body.includes("postgres"), false);
    for (const path of ["/", "/login", "/signup"]) {
      const row = payload.results.find((item) => item.path === path);
      assert.equal(row.status, 200, path + " " + row.body);
      assert.match(row.body, /<!DOCTYPE html>/i);
    }
  });

  it("production with malformed DATABASE_URL does not crash import", () => {
    const result = runScenario(
      {
        NODE_ENV: "production",
        APP_ENV: "production",
        VERCEL_ENV: "production",
        DATABASE_URL: "not-postgres",
      },
      ["/api/health"],
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.results[0].status, 503);
    assert.match(payload.results[0].body, /"durable":false/);
  });

  it("production with unreachable postgres URL does not crash import", () => {
    const result = runScenario(
      {
        NODE_ENV: "production",
        APP_ENV: "production",
        VERCEL_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@127.0.0.1:1/linkmate",
      },
      ["/api/health", "/"],
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    const health = payload.results.find((row) => row.path === "/api/health");
    assert.equal(health.status, 503);
    assert.equal(JSON.parse(health.body).durable, false);
    const home = payload.results.find((row) => row.path === "/");
    assert.equal(home.status, 200);
  });
});
