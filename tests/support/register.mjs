// Test-only: `server-only` exists only inside Next's bundler, so plain Node test
// runs resolve it to an empty module and server modules can be unit-tested.
// Production builds keep the real guard (data-providers contract D-7).
import { registerHooks } from "node:module";

// The same for Cache Components (review fixes PR-C): `next/cache`'s tags and
// lifetimes and `next/server`'s `connection()` only work inside a Next server.
const stubs = {
  "next/cache": "./next-cache-stub.cjs",
  "next/server": "./next-server-stub.cjs",
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: new URL("./server-only-stub.cjs", import.meta.url).href,
        format: "commonjs",
        shortCircuit: true,
      };
    }
    if (specifier in stubs) {
      return {
        url: new URL(stubs[specifier], import.meta.url).href,
        format: "commonjs",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
