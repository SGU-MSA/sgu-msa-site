// Test-only (review fixes PR-C): outside a Next server there is no cache to
// tag or time, so `cacheTag` and `cacheLife` do nothing in unit tests and a
// "use cache" function simply runs. Everything else is Next's own.
module.exports = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS test stub
  ...require("next/cache.js"),
  cacheTag() {},
  cacheLife() {},
};
