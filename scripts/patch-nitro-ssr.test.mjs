import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { patchSsrBarrel, patchSsrRuntime } from "./patch-nitro-ssr.mjs";

describe("patchSsrBarrel", () => {
  it("defines the missing ssr_exports binding", () => {
    const source = `//#endregion
export { getServerFnById as a, __exportAll as c, createServerEntry, server_default as default, TSS_SERVER_FUNCTION as i, createMiddleware as n, getRequest as o, createServerFn as r, ssr_exports as s, server_exports as t };
`;
    const { source: next, changed } = patchSsrBarrel(source);
    assert.equal(changed, true);
    assert.match(next, /var ssr_exports =/);
    assert.match(next, /ssr_exports as s/);
  });

  it("is idempotent", () => {
    const source = `var ssr_exports = { get t() { return server_exports; } };
export { ssr_exports as s, server_default as default };
`;
    const { changed } = patchSsrBarrel(source);
    assert.equal(changed, false);
  });
});

describe("patchSsrRuntime", () => {
  it("inlines __exportAll and drops the circular ssr.mjs import", () => {
    const source = `import { c as __exportAll$1 } from "./ssr.mjs";
import { AsyncLocalStorage } from "node:async_hooks";
var server_exports = __exportAll$1({ setCookie: () => setCookie$1 });
`;
    const { source: next, changed } = patchSsrRuntime(source);
    assert.equal(changed, true);
    assert.equal(next.includes('from "./ssr.mjs"'), false);
    assert.match(next, /var __exportAll\$1 = /);
    assert.match(next, /server_exports = __exportAll\$1/);
  });
});
