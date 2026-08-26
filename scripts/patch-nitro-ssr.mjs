#!/usr/bin/env node
/**
 * TanStack Start + Nitro (vercel preset) currently emits a circular SSR chunk:
 *   _ssr/ssr.mjs  exports a missing `ssr_exports` binding
 *   _ssr/ssr2.mjs imports `__exportAll` from ssr.mjs before it initializes
 *
 * That compiles to: SyntaxError: Export 'ssr_exports' is not defined in module
 * and every published route — including /api/health — returns unhandled HTTP 500.
 *
 * This patch is idempotent. It must run INSIDE `vite build` via Nitro's
 * `compiled` hook (after `.vercel/output/functions` exists). A trailing
 * `node scripts/patch-nitro-ssr.mjs` is a fallback for `npm run build:app`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SSR_EXPORTS_STUB = `var ssr_exports = {
	get a() { return getServerFnById; },
	get c() { return __exportAll; },
	get default() { return server_default; },
	get i() { return TSS_SERVER_FUNCTION; },
	get n() { return createMiddleware; },
	get o() { return getRequest; },
	get r() { return createServerFn; },
	get s() { return ssr_exports; },
	get t() { return server_exports; },
};
`;

const EXPORT_ALL_HELPER = `var __exportAll$1 = (all, no_symbols) => {
	let target = {};
	for (var name in all) Object.defineProperty(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) Object.defineProperty(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
`;

export function patchSsrBarrel(source) {
  if (!source.includes("ssr_exports as s")) return { source, changed: false };
  if (source.includes("var ssr_exports =")) return { source, changed: false };
  if (!source.includes("export {") || !source.includes("server_default as default")) {
    return { source, changed: false };
  }
  const next = source.replace(
    /\/\/#endregion\nexport \{/,
    `//#endregion\n${SSR_EXPORTS_STUB}export {`,
  );
  if (next === source) {
    const fallback = `${SSR_EXPORTS_STUB}${source}`;
    return { source: fallback, changed: true };
  }
  return { source: next, changed: true };
}

export function patchSsrRuntime(source) {
  const importRe = /import \{ c as (__exportAll\$?\w*) \} from "\.\/ssr\.mjs";\n/;
  const match = source.match(importRe);
  if (!match) return { source, changed: false };
  const localName = match[1];
  let next = source.replace(importRe, "");
  if (!next.includes(`var ${localName} =`)) {
    const helper =
      localName === "__exportAll$1"
        ? EXPORT_ALL_HELPER
        : EXPORT_ALL_HELPER.replaceAll("__exportAll$1", localName);
    next = next.replace(
      /import \{ AsyncLocalStorage \} from "node:async_hooks";\n/,
      `import { AsyncLocalStorage } from "node:async_hooks";\n${helper}`,
    );
  }
  return { source: next, changed: next !== source };
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walk(p, out);
    else if (name.isFile() && name.name.endsWith(".mjs")) out.push(p);
  }
  return out;
}

function gitField(root, args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

export function buildFingerprint(root = process.cwd(), extra = {}) {
  const sha = gitField(root, ["rev-parse", "HEAD"]);
  const dirty = Boolean(gitField(root, ["status", "--porcelain"]));
  return {
    commit: sha ? sha.slice(0, 7) : "unknown",
    dirty,
    patched: Boolean(extra.patched),
    builtAt: extra.builtAt || new Date().toISOString(),
  };
}

export function ssrOutputIsPatched(root = process.cwd()) {
  const roots = [join(root, ".vercel/output/functions"), join(root, ".output")];
  for (const base of roots) {
    for (const file of walk(base)) {
      if (!file.endsWith(`${join("_ssr", "ssr.mjs")}`) && !file.endsWith("/_ssr/ssr.mjs")) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      if (source.includes("var ssr_exports =") && !source.includes('from "./ssr.mjs"')) {
        return true;
      }
      if (source.includes("var ssr_exports =") && source.includes("ssr_exports as s")) {
        return true;
      }
    }
  }
  return false;
}

export function writeVersionFile(root = process.cwd(), extra = {}) {
  const info = buildFingerprint(root, extra);
  const json = `${JSON.stringify(info, null, 2)}\n`;
  const targets = [
    join(root, ".vercel/output/static/version.json"),
    join(root, ".output/public/version.json"),
  ];
  const written = [];
  for (const target of targets) {
    const dir = dirname(target);
    if (!existsSync(dir)) continue;
    writeFileSync(target, json);
    written.push(target);
  }
  return { info, written };
}

function applyNitroSsrFix(root = process.cwd()) {
  const patched = patchNitroOutput(root);
  const already = ssrOutputIsPatched(root);
  const { info, written } = writeVersionFile(root, {
    patched: already || patched.length > 0,
  });
  if (patched.length) {
    console.log(`[patch-nitro-ssr] patched ${patched.length} file(s)`);
  } else if (already) {
    console.log("[patch-nitro-ssr] ssr barrel already patched");
  } else {
    console.log("[patch-nitro-ssr] no ssr barrel patch needed");
  }
  console.log(`[patch-nitro-ssr] version ${info.commit} patched=${info.patched}`);
  return { patched, info, written };
}

export function patchNitroSsrPlugin() {
  return {
    name: "patch-nitro-ssr",
    apply: "build",
    enforce: "post",
    sharedDuringBuild: true,
    // Nitro reads this from vite plugins and runs `compiled` AFTER
    // `.vercel/output/functions` is written. closeBundle is too early.
    nitro: {
      name: "patch-nitro-ssr",
      setup(nitro) {
        nitro.hooks.hook("compiled", () => {
          applyNitroSsrFix(nitro.options.rootDir || process.cwd());
        });
      },
    },
    closeBundle: {
      sequential: true,
      order: "post",
      handler() {
        applyNitroSsrFix(process.cwd());
      },
    },
  };
}

export function patchNitroOutput(root = process.cwd()) {
  const patched = [];
  const roots = [
    join(root, ".vercel/output/functions"),
    join(root, ".output"),
  ];
  for (const base of roots) {
    for (const file of walk(base)) {
      const original = readFileSync(file, "utf8");
      let next = original;
      if (file.endsWith(`${join("_ssr", "ssr.mjs")}`) || file.endsWith("/_ssr/ssr.mjs")) {
        next = patchSsrBarrel(next).source;
      }
      if (file.endsWith(`${join("_ssr", "ssr2.mjs")}`) || file.endsWith("/_ssr/ssr2.mjs")) {
        next = patchSsrRuntime(next).source;
      }
      if (next !== original) {
        writeFileSync(file, next);
        patched.push(file);
      }
    }
  }
  return patched;
}

const invokedDirectly = process.argv[1] && realpathSafe(process.argv[1]) === fileURLToPath(import.meta.url);

function realpathSafe(p) {
  try {
    return decodeURIComponent(new URL(`file://${p}`).pathname);
  } catch {
    return p;
  }
}

if (invokedDirectly) {
  const result = applyNitroSsrFix(join(dirname(fileURLToPath(import.meta.url)), ".."));
  for (const file of result.patched) console.log(`  ${file}`);
}
