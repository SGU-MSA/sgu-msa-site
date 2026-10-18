import { spawn } from "node:child_process";
import { resolve } from "node:path";

// Explicit opt-in, no database seeding, no secrets and no production bypass.
// Sample data needs SITE_DEMO_MODE=true and a seed time (ADR 0012); the runtime
// config also refuses sample data in production.
if (process.env.VERCEL_ENV === "production") {
  console.error("Design demo is disabled on Vercel Production.");
  process.exit(1);
}
// Pass SITE_DEMO_DATE in the shell for a repeatable run; otherwise seed "now".
const seedDate = process.env.SITE_DEMO_DATE || new Date().toISOString();
const env = {
  ...process.env,
  SITE_DEMO_MODE: "true",
  SITE_DEMO_DATE: seedDate,
};

// `review` (npm run demo:review, review fixes PR-C): a fresh production build,
// then serve it, with one seed time for both, so the sandbox is as fast as the
// live site and every start begins from the sample data again. Other modes
// (dev, build, start) pass straight to `next`.
const [mode, ...rest] = process.argv.slice(2);
const runs =
  mode === "review" ? [["build"], ["start", ...rest]] : [[mode, ...rest]];

let child = null;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => (child ? child.kill(signal) : process.exit(1)));

for (const args of runs) {
  const code = await new Promise((done) => {
    child = spawn(
      process.execPath,
      [resolve("node_modules/next/dist/bin/next"), ...args],
      { stdio: "inherit", env },
    );
    child.on("exit", (exit) => done(exit ?? 1));
  });
  if (code !== 0) process.exit(code);
}
process.exit(0);
