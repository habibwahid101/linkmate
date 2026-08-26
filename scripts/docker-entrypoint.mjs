#!/usr/bin/env node
/**
 * App Runner entry: migrate RDS, then start the Node server.
 * Fails closed if DATABASE_URL is missing in production.
 */
import { spawn } from "node:child_process";

const appEnv = process.env.APP_ENV || process.env.NODE_ENV;
if ((appEnv === "production") && !process.env.DATABASE_URL?.trim()) {
  console.error("[entrypoint] DATABASE_URL is required in production");
  process.exit(1);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

await run(process.execPath, ["scripts/migrate.mjs"]);
await run(process.execPath, [".output/server/index.mjs"]);
