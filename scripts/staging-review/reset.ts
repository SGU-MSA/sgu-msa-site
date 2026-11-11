// Developer-run reset of the staging review site (docs/contracts/staging-review-site.md, ADR 0035).
//
//   npm run staging:reset                  dry run: checks the input and prints the plan, writes nothing
//   npm run staging:reset -- --yes         empties and re-seeds staging, (re)creates the three logins
//   npm run staging:reset -- --input FILE  reads another input file (default below)
//
// The input file holds the staging secret key, database URL and the three passwords; it stays
// under ignored `.agents/local/` and is never printed. Only staging is ever accepted (plan.ts).
import { readFile, stat } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import { parseGo2PayLink } from "../../src/lib/community/payment-policy";
import { starterPageTexts } from "../starter-page-texts";
import { resetDatabase } from "./database";
import { ensureLogins } from "./logins";
import {
  PRESERVED_TABLES,
  RESET_TABLES,
  STAGING_PROJECT_REF,
  checkTarget,
  databaseConfig,
  redact,
  resetInputSchema,
  reviewLogins,
  stagingSeedPlan,
  type ResetInput,
} from "./plan";

const defaultInput = ".agents/local/staging-review/reset.json";
const bucket = "community";

class Stop extends Error {}

function argument(name: string) {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
}

async function readInput(file: string): Promise<ResetInput> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    throw new Stop(`Cannot read the input file ${file}.`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Stop("The input file is not valid JSON.");
  }
  const parsed = resetInputSchema.safeParse(json);
  if (!parsed.success)
    throw new Stop(
      `The input file has problems:\n${parsed.error.issues
        .map(
          (issue) =>
            `  · ${issue.path.join(".") || "(file)"}: ${issue.message}`,
        )
        .join("\n")}`,
    );
  return parsed.data;
}

function linkMap(input: ResetInput) {
  const links = new Map<string, number>();
  for (const [slug, link] of Object.entries(input.go2payTestLinks ?? {})) {
    const result = parseGo2PayLink(link);
    if (result.ok) links.set(slug, result.id);
  }
  return links;
}

async function allAuthUserIds(client: SupabaseClient) {
  const users: { id: string; email?: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`Listing logins failed: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 200) return users;
  }
}

async function emptyBucket(client: SupabaseClient) {
  const files: string[] = [];
  const walk = async (folder: string) => {
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client.storage
        .from(bucket)
        .list(folder, { limit: 100, offset });
      if (error) throw new Error(`Listing storage failed: ${error.message}`);
      for (const entry of data) {
        const path = folder ? `${folder}/${entry.name}` : entry.name;
        if (entry.id) files.push(path);
        else await walk(path);
      }
      if (data.length < 100) return;
    }
  };
  await walk("");
  for (let at = 0; at < files.length; at += 100) {
    const { error } = await client.storage
      .from(bucket)
      .remove(files.slice(at, at + 100));
    if (error)
      throw new Error(`Removing storage files failed: ${error.message}`);
  }
  return files.length;
}

async function main(secrets: string[]) {
  const confirmed = process.argv.includes("--yes");
  const input = await readInput(argument("--input") ?? defaultInput);
  secrets.push(
    input.secretKey,
    input.databaseUrl,
    ...Object.values(input.passwords),
    ...(input.reviewDeployHook ? [input.reviewDeployHook] : []),
  );
  const guard = checkTarget(input, { VERCEL_ENV: process.env.VERCEL_ENV });
  if (!guard.ok)
    throw new Stop(
      `Refused, nothing was contacted:\n${guard.problems.map((p) => `  · ${p}`).join("\n")}`,
    );

  const links = linkMap(input);
  const pageTexts = starterPageTexts();
  const logins = reviewLogins(input.loginDomain);
  const preview = stagingSeedPlan(
    new Date(),
    { president: "-", treasurer: "-", board: "-" },
    links,
    pageTexts,
  );
  let ca: string;
  try {
    ca = await readFile(input.databaseCaFile, "utf8");
  } catch {
    throw new Stop("Cannot read the CA certificate file named in the input.");
  }
  if (!confirmed) {
    const mode = (await stat(argument("--input") ?? defaultInput)).mode;
    if (mode & 0o077)
      console.log(
        "Warning: the input file can be read by other users; run chmod 600 on it.",
      );
    console.log(
      `Dry run: nothing is written. Target: staging (${STAGING_PROJECT_REF}).`,
    );
    console.log("Logins:");
    for (const login of logins) console.log(`  ${login.role}: ${login.email}`);
    console.log(
      `Emptied: ${RESET_TABLES.join(", ")}, and the ${bucket} storage bucket.`,
    );
    console.log(`Kept: ${PRESERVED_TABLES.join(", ")}.`);
    console.log("Seeded rows:");
    for (const step of preview)
      console.log(`  ${step.table}: ${step.rows.length}`);
    console.log(
      `Funds with a Go2Pay test link: ${links.size ? [...links.keys()].join(", ") : "none"}.`,
    );
    console.log("Run again with --yes to write.");
    return;
  }

  const supabase = createClient(input.supabaseUrl, input.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const database = new pg.Client(databaseConfig(input.databaseUrl, ca));
  database.on("error", (error) =>
    console.error(
      redact(`Database connection problem: ${error.message}`, secrets),
    ),
  );
  await database.connect();
  try {
    const owner = await database.query("select current_user as name");
    if (owner.rows[0]?.name !== "postgres")
      throw new Stop("Refused: the database login is not postgres.");
    const users = await allAuthUserIds(supabase);
    const stored = await database.query("select id from auth.users");
    const here = new Set(users.map((user) => user.id));
    const there = new Set(stored.rows.map((row) => String(row.id)));
    if (
      here.size === 0 ||
      here.size !== there.size ||
      [...here].some((id) => !there.has(id))
    )
      throw new Stop(
        "Refused: the secret key and the database belong to different projects. Nothing was written.",
      );

    const ids = await ensureLogins(supabase, users, input);
    await database.query("begin");
    let counts;
    try {
      counts = await resetDatabase(
        database,
        stagingSeedPlan(new Date(), ids, links, pageTexts),
      );
      await database.query("commit");
    } catch (error) {
      try {
        await database.query("rollback");
      } catch {
        // report the original error, not the rollback failure
      }
      throw error;
    }
    let storageFailed = false;
    let removed = 0;
    try {
      removed = await emptyBucket(supabase);
    } catch (error) {
      storageFailed = true;
      console.error(
        redact(
          `The database was reset; run again to remove the remaining files. (${error instanceof Error ? error.message : "storage error"})`,
          secrets,
        ),
      );
    }

    console.log("Staging reset done. Rows per table:");
    for (const table of RESET_TABLES)
      console.log(`  ${table}: ${counts[table]}`);
    if (!storageFailed) console.log(`Storage files removed: ${removed}.`);
    console.log("Logins (passwords: in your local input file):");
    for (const login of logins) console.log(`  ${login.role}: ${login.email}`);

    if (input.reviewDeployHook) {
      try {
        const response = await fetch(input.reviewDeployHook, {
          method: "POST",
        });
        console.log(
          response.ok
            ? "Review deployment started."
            : `Warning: the deploy hook answered ${response.status}; redeploy the review branch in Vercel.`,
        );
      } catch {
        console.log(
          "Warning: the deploy hook could not be reached; redeploy the review branch in Vercel.",
        );
      }
    } else {
      console.log(
        "Next: redeploy the review branch in Vercel so cached page text refreshes, then open the review link.",
      );
    }
    if (storageFailed) process.exitCode = 1;
  } finally {
    await database.end();
  }
}

const secrets: string[] = [];
main(secrets).catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error instanceof Stop
        ? error.message
        : `${error.message}${"code" in error ? ` (code ${String((error as { code?: unknown }).code)})` : ""}`
      : "Unexpected failure.";
  console.error(redact(message, secrets));
  process.exit(1);
});
