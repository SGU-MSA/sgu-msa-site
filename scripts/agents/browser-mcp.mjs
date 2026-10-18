#!/usr/bin/env node
// Both clients use this project profile; never use a personal Chrome profile.
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PROFILE = join(ROOT, ".agents", "local", "browser-profile");
export const SESSION_DOMAINS = ["github.com", "supabase.com", "vercel.com"];

export function browserPreferences(previous = {}) {
  const profile = previous.profile ?? {};
  return {
    ...previous,
    credentials_enable_service: false,
    profile: {
      ...profile,
      password_manager_enabled: false,
      default_content_setting_values: {
        ...profile.default_content_setting_values,
        cookies: 4,
      },
      content_settings: {
        ...profile.content_settings,
        exceptions: {
          ...profile.content_settings?.exceptions,
          cookies: Object.fromEntries(
            SESSION_DOMAINS.map((domain) => [
              `[*.]${domain},*`,
              { setting: 1 },
            ]),
          ),
        },
      },
    },
  };
}

async function main() {
  const ignored = spawnSync(
    "git",
    ["check-ignore", "--quiet", "--", ".agents/local/browser-profile"],
    { cwd: ROOT },
  );
  const tracked = spawnSync("git", ["ls-files", "--", ".agents/local"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (ignored.status !== 0 || tracked.status !== 0 || tracked.stdout.trim())
    throw new Error("Browser profile must remain ignored and untracked");
  mkdirSync(join(PROFILE, "Default"), { recursive: true, mode: 0o700 });
  chmodSync(PROFILE, 0o700);
  let browserUrl;
  const portFile = join(PROFILE, "DevToolsActivePort");
  if (existsSync(portFile)) {
    const port = Number(readFileSync(portFile, "utf8").split("\n")[0]);
    if (Number.isInteger(port) && port > 0 && port < 65536) {
      const url = `http://127.0.0.1:${port}`;
      try {
        if (
          (
            await fetch(`${url}/json/version`, {
              signal: AbortSignal.timeout(1000),
            })
          ).ok
        )
          browserUrl = url;
      } catch {
        /* Stale endpoint: the native client will launch this profile. */
      }
    }
  }
  if (!browserUrl) {
    const prefsFile = join(PROFILE, "Default", "Preferences");
    const previous = existsSync(prefsFile)
      ? JSON.parse(readFileSync(prefsFile, "utf8"))
      : {};
    writeFileSync(prefsFile, JSON.stringify(browserPreferences(previous)), {
      mode: 0o600,
    });
    chmodSync(prefsFile, 0o600);
  }
  const args = [
    "-y",
    "chrome-devtools-mcp@latest",
    browserUrl ? `--browser-url=${browserUrl}` : `--user-data-dir=${PROFILE}`,
    "--redact-network-headers",
    "--no-usage-statistics",
    "--no-performance-crux",
  ];
  const child = spawn("npx", args, { cwd: ROOT, stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
  child.on("error", () => {
    console.error("browser-mcp: failed to start the native Chrome MCP client");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  main().catch(() => {
    console.error(
      "browser-mcp: cannot prepare the private project browser profile",
    );
    process.exitCode = 1;
  });
