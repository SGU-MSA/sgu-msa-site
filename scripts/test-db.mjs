// `npm run test:db`: start the throwaway test database (compose.test.yaml), run the database suite of
// scripts/test-backend.ts against it, and always remove the database again (PR3 contract, D-18).
// Needs Docker (Docker Desktop locally; preinstalled on GitHub's ubuntu runners).
import { spawnSync } from "node:child_process";

const compose = ["compose", "--file", "compose.test.yaml"];
const run = (command, args, options = {}) =>
  spawnSync(command, args, { stdio: "inherit", ...options }).status ?? 1;

// Ctrl+C stops the suite; this script still removes the database afterwards.
process.on("SIGINT", () => {});

let status = run("docker", [...compose, "up", "--detach", "--wait"]);
if (status === 0) {
  const port = spawnSync("docker", [...compose, "port", "test-db", "5432"], {
    encoding: "utf8",
  });
  const address = port.stdout?.trim() ?? "";
  if (port.status !== 0 || !/^127\.0\.0\.1:\d+$/.test(address)) {
    console.error("Could not read the test database's local port.");
    status = 1;
  } else {
    status = run(
      process.execPath,
      [
        "--import",
        "tsx",
        "--import",
        "./tests/support/register.mjs",
        "scripts/test-backend.ts",
        "database",
      ],
      {
        env: {
          ...process.env,
          SUPABASE_TEST_DB_URL: `postgres://postgres@${address}/postgres`,
        },
      },
    );
  }
}
const removed = run("docker", [...compose, "down", "--volumes"]);
process.exit(status || removed);
