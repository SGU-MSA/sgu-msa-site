// The pure core of the staging review-site reset (contract: docs/contracts/staging-review-site.md).
// No file, environment, network or clock access here: the CLI (reset.ts) supplies every input and
// database.ts applies the plan. Fixtures and row mappers stay owned by src/lib; this file only
// decides which rows go to which table.
import { passwordSchema } from "../../src/lib/backend/password";
import { parseGo2PayLink } from "../../src/lib/community/payment-policy";
import { paymentItemToRow } from "../../src/lib/community/payments";
import { seasonToRow } from "../../src/lib/community/seasons";
import { stepToRow, loginToRow } from "../../src/lib/community/handover";
import { collections, recordToRow } from "../../src/lib/community/schema";
import {
  demoHandoverSteps,
  demoListOptions,
  demoMerch,
  demoMusallahPin,
  demoPaymentItems,
  demoPeople,
  demoPrayer,
  demoRecords,
  demoSeasons,
  demoSections,
  demoSharedLogins,
} from "../../src/lib/demo/fixtures";
import { z } from "../../src/lib/validation/zod";

export const STAGING_PROJECT_REF = "qglftmxfjvxmrzppkxks";
export const PRODUCTION_PROJECT_REF = "thhpkztmjoiaiuscdmdh";

/** Emptied and re-seeded by a reset, in seed/insert order; the activity log is emptied, not seeded. */
export const RESET_TABLES = [
  "list_options",
  "people_sections",
  "people",
  "admins",
  "seasons",
  "merch_collections",
  "merch_items",
  "payment_items",
  "payment_item_links",
  "events",
  "announcements",
  "news_posts",
  "newsletters",
  "handover_steps",
  "shared_logins",
  "prayer_settings",
  "musallah_location",
  "page_texts",
  "activity_log",
] as const;
export type ResetTable = (typeof RESET_TABLES)[number];

/** Never touched by a reset: the fixed Qur'an library (ADR 0026) and the daily check's ledger. */
export const PRESERVED_TABLES = [
  "quran_verses",
  "warning_emails_sent",
] as const;

/** The fund, ticket and size slugs of the fixtures: the only keys `go2payTestLinks` may use. */
const fixtureSlugs = new Set(
  demoPaymentItems(new Date(0)).map(({ item }) => item.slug),
);

const productionRef = new RegExp(PRODUCTION_PROJECT_REF);

export const resetInputSchema = z.strictObject({
  supabaseUrl: z.string().min(1),
  secretKey: z.string().startsWith("sb_secret_"),
  databaseUrl: z.string().min(1),
  databaseCaFile: z.string().min(1),
  loginDomain: z
    .string()
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.invalid$/,
      "Use a domain ending in .invalid, so the logins have no inbox.",
    ),
  passwords: z
    .strictObject({
      president: passwordSchema,
      treasurer: passwordSchema,
      board: passwordSchema,
    })
    .refine(
      (value) =>
        new Set([value.president, value.treasurer, value.board]).size === 3,
      "The three passwords must all be different.",
    ),
  go2payTestLinks: z
    .record(z.string(), z.string())
    .optional()
    .superRefine((links, ctx) => {
      const seen = new Set<number>();
      for (const [slug, link] of Object.entries(links ?? {})) {
        if (!fixtureSlugs.has(slug))
          ctx.addIssue({ code: "custom", message: `Unknown fund: ${slug}.` });
        const parsed = parseGo2PayLink(link);
        if (!parsed.ok) {
          ctx.addIssue({
            code: "custom",
            message: `${slug}: ${parsed.error}`,
          });
          continue;
        }
        if (seen.has(parsed.id))
          ctx.addIssue({
            code: "custom",
            message: `${slug}: a Go2Pay product can be used once.`,
          });
        seen.add(parsed.id);
      }
    }),
  reviewDeployHook: z
    .url()
    .startsWith("https://api.vercel.com/v1/integrations/deploy/")
    .optional(),
});
export type ResetInput = z.infer<typeof resetInputSchema>;

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Refuses anything but the staging project, before any connection. Problems never carry secrets. */
export function checkTarget(
  input: ResetInput,
  env: { VERCEL_ENV?: string },
): { ok: true } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  if (env.VERCEL_ENV === "production")
    problems.push(
      "This is a production environment; a reset never runs there.",
    );
  if (productionRef.test(input.supabaseUrl))
    problems.push("The Supabase URL names the production project.");
  if (productionRef.test(input.databaseUrl))
    problems.push("The database URL names the production project.");
  if (
    input.supabaseUrl.replace(/\/$/, "") !==
    `https://${STAGING_PROJECT_REF}.supabase.co`
  )
    problems.push("The Supabase URL is not the staging project's address.");
  let database: URL | null = null;
  try {
    database = new URL(input.databaseUrl);
  } catch {
    problems.push("The database URL is not a valid address.");
  }
  if (database) {
    const host = database.hostname.toLowerCase();
    const user = decodeURIComponent(database.username);
    if (database.search || database.hash)
      problems.push(
        "The database URL must have no ? options or # part; the reset sets them itself.",
      );
    if (!["postgres:", "postgresql:"].includes(database.protocol))
      problems.push("The database URL must be a postgres address.");
    if (localHosts.has(host))
      problems.push(
        "The database is on this computer; a reset targets staging only.",
      );
    const pooled =
      user === `postgres.${STAGING_PROJECT_REF}` &&
      host.endsWith(".pooler.supabase.com");
    const direct =
      user === "postgres" && host === `db.${STAGING_PROJECT_REF}.supabase.co`;
    if (!pooled && !direct)
      problems.push("The database URL is not the staging project's database.");
  }
  return problems.length ? { ok: false, problems } : { ok: true };
}

/**
 * The pg connection settings, built only from the parts `checkTarget` validated (never the raw
 * URL, so a query string cannot redirect the connection or weaken TLS).
 */
export function databaseConfig(databaseUrl: string, ca: string) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres",
    ssl: { ca, rejectUnauthorized: true },
  };
}

export type ReviewRole = "president" | "treasurer" | "board";

/** The three review logins and the fixture person each one is (E-4). */
export function reviewLogins(loginDomain: string): {
  role: ReviewRole;
  email: string;
  personId: string;
  can_manage_people: boolean;
  can_manage_money: boolean;
}[] {
  const address = (role: string) => `${role}@${loginDomain}`;
  const person = (n: string) => `00000000-0000-4000-8000-00000000${n}`;
  return [
    {
      role: "president",
      email: address("president"),
      personId: person("a001"),
      can_manage_people: true,
      can_manage_money: true,
    },
    {
      role: "treasurer",
      email: address("treasurer"),
      personId: person("a011"),
      can_manage_people: false,
      can_manage_money: true,
    },
    {
      role: "board",
      email: address("board"),
      personId: person("a012"),
      can_manage_people: false,
      can_manage_money: false,
    },
  ];
}

export type SeedStep = { table: ResetTable; rows: Record<string, unknown>[] };

/**
 * What a reset writes, table by table in insert order. `links` maps a fixture payment-item slug
 * to a Go2Pay test payment request (D-11); the fixtures' own product numbers are never used (E-3).
 */
export function stagingSeedPlan(
  now: Date,
  accounts: Record<ReviewRole, string>,
  links: ReadonlyMap<string, number>,
  pageTexts: readonly { key: string; document: unknown }[],
): SeedStep[] {
  const payments = demoPaymentItems(now);
  for (const slug of links.keys())
    if (!payments.some(({ item }) => item.slug === slug))
      throw new Error(`Unknown fund: ${slug}.`);
  const merch = demoMerch();
  const records = Object.fromEntries(
    collections.map((kind) => [
      kind,
      demoRecords(kind, now).map((record) => recordToRow(kind, record)),
    ]),
  );
  const rows = (value: readonly unknown[]) =>
    value as Record<string, unknown>[];
  return [
    { table: "list_options", rows: rows(demoListOptions()) },
    { table: "people_sections", rows: rows(demoSections()) },
    { table: "people", rows: rows(demoPeople()) },
    {
      table: "admins",
      rows: reviewLogins("example.invalid").map((login) => ({
        user_id: accounts[login.role],
        person_id: login.personId,
        can_manage_people: login.can_manage_people,
        can_manage_money: login.can_manage_money,
      })),
    },
    { table: "seasons", rows: demoSeasons(now).map(seasonToRow) },
    { table: "merch_collections", rows: rows(merch.collections) },
    { table: "merch_items", rows: rows(merch.items) },
    {
      table: "payment_items",
      rows: payments.map(({ item, archived }) => ({
        ...paymentItemToRow(item),
        ...(archived ? { archived_at: now.toISOString() } : {}),
      })),
    },
    {
      table: "payment_item_links",
      rows: payments.flatMap(({ item }) => {
        const product = links.get(item.slug);
        return product === undefined
          ? []
          : [{ go2pay_product_id: product, payment_item_id: item.id }];
      }),
    },
    { table: "events", rows: records.events },
    { table: "announcements", rows: records.announcements },
    { table: "news_posts", rows: records.news_posts },
    { table: "newsletters", rows: records.newsletters },
    { table: "handover_steps", rows: demoHandoverSteps(now).map(stepToRow) },
    { table: "shared_logins", rows: demoSharedLogins(now).map(loginToRow) },
    { table: "prayer_settings", rows: rows([demoPrayer(now)]) },
    { table: "musallah_location", rows: rows([demoMusallahPin]) },
    {
      table: "page_texts",
      rows: pageTexts.map(({ key, document }) => ({ key, document })),
    },
  ];
}

/** Hides every secret, and a database URL's password, in text meant for the screen. */
export function redact(text: string, secrets: readonly string[]): string {
  const hidden = new Set<string>();
  for (const secret of secrets) {
    if (!secret) continue;
    hidden.add(secret);
    try {
      const url = new URL(secret);
      if (url.password) {
        hidden.add(url.password);
        hidden.add(decodeURIComponent(url.password));
      }
    } catch {
      // not a URL: the whole text is the secret
    }
  }
  let result = text;
  for (const secret of [...hidden].sort((a, b) => b.length - a.length))
    if (secret) result = result.split(secret).join("[hidden]");
  return result;
}
