// Test-only (review fixes PR-C): outside a Next request `connection()` (which
// marks a read as per visit) has nothing to mark, so it resolves at once in
// unit tests. Everything else is Next's own.
module.exports = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS test stub
  ...require("next/server.js"),
  async connection() {},
};
