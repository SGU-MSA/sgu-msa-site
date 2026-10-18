import { z } from "../validation/zod";
// Relative imports only: `next.config.ts` loads this module before path aliases exist.

/**
 * The only reader of `process.env` in `src/` (ADR 0012). Every deployment
 * setting is declared here, validated once, and has no default: a missing or
 * invalid value stops `next dev`/`build`/`start` with one message listing
 * every problem. Mirrors: `.env.example` and the owner guide's
 * "Required variables" table. No `server-only`: `next.config.ts`,
 * `src/proxy.ts` and tests import it.
 */
export type RuntimeConfig = Readonly<{
  /** VERCEL_ENV === "production" (ADR 0010: only Production publishes; pull requests get previews, ADR 0034). */
  production: boolean;
  /** SITE_DEMO_MODE: "true" | "false"; "true" is rejected in production (D-3). */
  data: "live" | "sample";
  /** SITE_DEMO_DATE: required ISO instant with sample data, rejected otherwise. */
  sampleSeed: Date | null;
  /** Required with live data; never used with sample data. */
  supabase: { url: string; publishableKey: string } | null;
  /** NODE_ENV === "production". */
  secureCookies: boolean;
  /** SITE_URL origin: https (http only outside production). */
  siteUrl: string;
  /** ENABLE_VERCEL_MEASUREMENTS: required "true" | "false" in production (D-5); false elsewhere. */
  measurements: boolean;
  /**
   * SUPABASE_SECRET_KEY: "on" with a secret key, "off" with the literal "off"
   * (refused in production). Always "off" with sample data. The key itself is
   * never on this object: only `supabaseSecretKey` returns it.
   */
  invites: "on" | "off";
  /**
   * GO2PAY_API_KEY: "live" with a g2p_live_ key (production only), "test" with
   * a g2p_test_ key (never production), "off" with the literal "off". Always
   * "off" with sample data. The key itself is never on this object: only
   * `go2payApiKey` returns it.
   */
  go2pay: "test" | "live" | "off";
  /**
   * CRON_SECRET: "on" with a secret of 32+ letters, digits, "_" or "-"; "off"
   * with the literal "off" (refused in production). Required with sample data
   * too. "off" answers every daily-check call with 401. The secret itself is
   * never on this object: only `cronSecret` returns it.
   */
  dailyCheck: "on" | "off";
  /**
   * MSA_GMAIL_ADDRESS and GMAIL_APP_PASSWORD (daily-check contract D-15): the
   * MSA Gmail that sends the warning emails to itself, or "off" when both are
   * the literal "off". Production accepts both "off" (daily-check contract
   * D-17: launch before the club Gmail is recovered) with a build warning
   * (`configurationWarnings`); one "off" is refused everywhere. Always "off"
   * with sample data. The app password is never on this object: only
   * `gmailAppPassword` returns it.
   */
  warningMail: { address: string } | "off";
}>;

/** One message listing every problem, each naming the variable and where to set it. */
export class ConfigurationError extends Error {
  declare readonly problems: readonly string[];
  constructor(problems: readonly string[]) {
    super(
      [
        `The site configuration has ${problems.length} problem${problems.length === 1 ? "" : "s"}:`,
        ...problems.map((problem) => `  - ${problem}`),
        "Variables are explained in docs/guides/owner-setup.md (Required variables).",
      ].join("\n"),
    );
    this.name = "ConfigurationError";
    // Not enumerable, so error output shows the message once.
    Object.defineProperty(this, "problems", { value: problems });
  }
}

const WHERE =
  "Set it in Vercel → Settings → Environment Variables, or .env.local on your computer.";
const REMOVE =
  "Remove it in Vercel → Settings → Environment Variables, or .env.local.";
const allowed = {
  SITE_DEMO_MODE: '"false" (real data) or "true" (sample data, local only)',
  SITE_DEMO_DATE:
    'an ISO date-time such as 2026-09-11T12:00:00Z, only when SITE_DEMO_MODE is "true"',
  SUPABASE_URL:
    "the Supabase project URL, such as https://abcd1234.supabase.co",
  SUPABASE_PUBLISHABLE_KEY:
    "the project's publishable key (sb_publishable_…), never a secret key",
  SITE_URL:
    "the site's https address, such as https://sgu-msa-site.vercel.app (http://localhost:3000 only for local runs)",
  ENABLE_VERCEL_MEASUREMENTS:
    '"true" (count visits on the live site) or "false" (off)',
  SUPABASE_SECRET_KEY:
    "the project's secret key (sb_secret_…), used only to send invite emails; or \"off\" on a developer's computer (no invite emails)",
  GO2PAY_API_KEY:
    'a Go2Pay "Take payments only" key (g2p_live_… only on the live site; g2p_test_… elsewhere) or "off" (no payments)',
  CRON_SECRET:
    'a random secret of at least 32 letters, digits, "_" or "-" (such as the output of `openssl rand -hex 32`), or "off" on a developer\'s computer (no daily check)',
  MSA_GMAIL_ADDRESS:
    'the MSA Gmail address (…@gmail.com) that sends the daily-check warning emails to itself, or "off" together with GMAIL_APP_PASSWORD=off (no warning emails; on the live site only until the MSA Gmail is set up)',
  GMAIL_APP_PASSWORD:
    'the 16-letter Gmail app password named "SGU MSA daily check", or "off" together with MSA_GMAIL_ADDRESS=off (no warning emails; on the live site only until the MSA Gmail is set up)',
} as const;
type Variable = keyof typeof allowed;

// Messages never echo a received value: some variables are credentials.
const missing = (name: Variable) =>
  `${name} is missing. Allowed: ${allowed[name]}. ${WHERE}`;
const invalid = (name: Variable) =>
  `${name} is not valid. Allowed: ${allowed[name]}. ${WHERE}`;

// A plain Gmail address: the MSA Gmail sends the warnings to itself (D-15).
const GMAIL_ADDRESS = /^[a-z0-9](?:[a-z0-9.+_-]{0,62}[a-z0-9])?@gmail\.com$/i;

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const variable = z.preprocess(blankToUndefined, z.string().optional());
const flag = z.enum(["true", "false"]);
const instant = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

function webOrigin(value: string, allowHttp: boolean): string | null {
  try {
    const url = new URL(value);
    const protocolOk =
      url.protocol === "https:" || (allowHttp && url.protocol === "http:");
    const originOnly = url.pathname === "/" && !url.search && !url.hash;
    return protocolOk && originOnly && !url.username ? url.origin : null;
  } catch {
    return null;
  }
}

const envSchema = z
  .object({
    VERCEL: variable,
    VERCEL_ENV: variable,
    NODE_ENV: variable,
    SITE_DEMO_MODE: variable,
    SITE_DEMO_DATE: variable,
    SUPABASE_URL: variable,
    SUPABASE_PUBLISHABLE_KEY: variable,
    SITE_URL: variable,
    ENABLE_VERCEL_MEASUREMENTS: variable,
    SUPABASE_SECRET_KEY: variable,
    GO2PAY_API_KEY: variable,
    CRON_SECRET: variable,
    MSA_GMAIL_ADDRESS: variable,
    GMAIL_APP_PASSWORD: variable,
  })
  .transform((env, ctx): RuntimeConfig => {
    const problem = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    const production = env.VERCEL_ENV === "production";
    // Vercel sets VERCEL and VERCEL_ENV together; without VERCEL_ENV a
    // production build could not be recognized (ADR 0010).
    if (env.VERCEL !== undefined && env.VERCEL_ENV === undefined)
      problem(
        "VERCEL_ENV missing on Vercel; system environment variables must be enabled. Turn on “Automatically expose System Environment Variables” in Vercel → Settings → Environment Variables; never add VERCEL_ENV by hand or in .env.local.",
      );

    let data: RuntimeConfig["data"] = "live";
    if (env.SITE_DEMO_MODE === undefined) problem(missing("SITE_DEMO_MODE"));
    else if (!flag.safeParse(env.SITE_DEMO_MODE).success)
      problem(invalid("SITE_DEMO_MODE"));
    else if (env.SITE_DEMO_MODE === "true") {
      if (production)
        problem(
          `SITE_DEMO_MODE must be "false" on the live site: sample data is never allowed in production. ${WHERE}`,
        );
      else data = "sample";
    }

    let sampleSeed: Date | null = null;
    if (production && env.SITE_DEMO_DATE !== undefined)
      problem(`SITE_DEMO_DATE must not be set on the live site. ${REMOVE}`);
    else if (data === "sample") {
      if (env.SITE_DEMO_DATE === undefined) problem(missing("SITE_DEMO_DATE"));
      else if (!instant.safeParse(env.SITE_DEMO_DATE).success)
        problem(invalid("SITE_DEMO_DATE"));
      else sampleSeed = new Date(env.SITE_DEMO_DATE);
    } else if (env.SITE_DEMO_DATE !== undefined && env.SITE_DEMO_MODE)
      problem(
        `SITE_DEMO_DATE is only used when SITE_DEMO_MODE is "true". ${REMOVE}`,
      );

    let supabase: RuntimeConfig["supabase"] = null;
    let invites: RuntimeConfig["invites"] = "off";
    let go2pay: RuntimeConfig["go2pay"] = "off";
    let warningMail: RuntimeConfig["warningMail"] = "off";
    const keys: Secrets = {};
    if (data === "live") {
      const url = env.SUPABASE_URL && webOrigin(env.SUPABASE_URL, !production);
      if (env.SUPABASE_URL === undefined) problem(missing("SUPABASE_URL"));
      else if (!url) problem(invalid("SUPABASE_URL"));
      const key = env.SUPABASE_PUBLISHABLE_KEY;
      if (key === undefined) problem(missing("SUPABASE_PUBLISHABLE_KEY"));
      else if (key.startsWith("sb_secret_"))
        problem(invalid("SUPABASE_PUBLISHABLE_KEY"));
      if (url && key && !key.startsWith("sb_secret_"))
        supabase = { url, publishableKey: key };

      // Ignored with sample data: the sandbox sends no email.
      const secret = env.SUPABASE_SECRET_KEY;
      if (secret === undefined) problem(missing("SUPABASE_SECRET_KEY"));
      else if (secret === "off") {
        if (production)
          problem(
            `SUPABASE_SECRET_KEY must be the secret key (sb_secret_…) on the live site: "off" is only for a developer's computer or a preview. ${WHERE}`,
          );
      } else if (/^sb_secret_\S+$/.test(secret)) {
        invites = "on";
        keys.supabase = secret;
      } else problem(invalid("SUPABASE_SECRET_KEY"));

      // Ignored with sample data: the sandbox never calls Go2Pay. Test keys
      // move no money, so they never run the live site; live keys stay in
      // Vercel Production only (PR6 D-21, D-28).
      const go2payKey = env.GO2PAY_API_KEY;
      const kind = go2payKey?.match(/^g2p_(live|test)_\S+$/)?.[1];
      if (go2payKey === undefined) problem(missing("GO2PAY_API_KEY"));
      else if (go2payKey === "off") go2pay = "off";
      else if (!kind) problem(invalid("GO2PAY_API_KEY"));
      else if (production && kind === "test")
        problem(
          `GO2PAY_API_KEY must be a live key (g2p_live_…) or "off" on the live site: a test key takes no real payments. ${WHERE}`,
        );
      else if (!production && kind === "live")
        problem(
          `GO2PAY_API_KEY must be a test key (g2p_test_…) or "off" here: a live key (real money) belongs only in Vercel Production. ${WHERE}`,
        );
      else {
        go2pay = kind === "live" ? "live" : "test";
        keys.go2pay = go2payKey;
      }

      // Ignored with sample data: the sandbox records warning emails and
      // never sends. Off production the wiring never sends either, even
      // with real values (daily-check contract WP-1). Production accepts
      // both "off" together, with a build warning (D-17).
      const address = env.MSA_GMAIL_ADDRESS;
      const password = env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
      const addressOk = address !== undefined && GMAIL_ADDRESS.test(address);
      const passwordOk =
        password !== undefined && /^[a-z]{16}$/i.test(password);
      if (address === undefined) problem(missing("MSA_GMAIL_ADDRESS"));
      else if (address !== "off" && !addressOk)
        problem(invalid("MSA_GMAIL_ADDRESS"));
      if (password === undefined) problem(missing("GMAIL_APP_PASSWORD"));
      else if (password !== "off" && !passwordOk)
        problem(invalid("GMAIL_APP_PASSWORD"));
      const offs = [address, password].filter((v) => v === "off").length;
      if (offs === 1 && (addressOk || passwordOk))
        problem(
          `MSA_GMAIL_ADDRESS and GMAIL_APP_PASSWORD go together: set both, or set both to "off". ${WHERE}`,
        );
      else if (addressOk && passwordOk && address && password) {
        warningMail = { address: address.toLowerCase() };
        keys.gmail = password;
      }
    }

    let dailyCheck: RuntimeConfig["dailyCheck"] = "off";
    const cron = env.CRON_SECRET;
    if (cron === undefined) problem(missing("CRON_SECRET"));
    else if (cron === "off") {
      if (production)
        problem(
          `CRON_SECRET must be a random secret on the live site: "off" is only for a developer's computer or a preview. ${WHERE}`,
        );
    } else if (/^[A-Za-z0-9_-]{32,}$/.test(cron)) {
      dailyCheck = "on";
      keys.cron = cron;
    } else problem(invalid("CRON_SECRET"));

    let siteUrl = "";
    if (env.SITE_URL === undefined) problem(missing("SITE_URL"));
    else siteUrl = webOrigin(env.SITE_URL, !production) ?? "";
    if (env.SITE_URL !== undefined && !siteUrl) problem(invalid("SITE_URL"));

    let measurements = false;
    const measure = env.ENABLE_VERCEL_MEASUREMENTS;
    if (measure === undefined) {
      if (production) problem(missing("ENABLE_VERCEL_MEASUREMENTS"));
    } else if (!flag.safeParse(measure).success)
      problem(invalid("ENABLE_VERCEL_MEASUREMENTS"));
    else measurements = production && measure === "true";

    const config: RuntimeConfig = Object.freeze({
      production,
      data,
      sampleSeed,
      supabase,
      secureCookies: env.NODE_ENV === "production",
      siteUrl,
      measurements,
      invites,
      go2pay,
      dailyCheck,
      warningMail,
    });
    secrets.set(config, Object.freeze(keys));
    return config;
  });

type Secrets = {
  supabase?: string;
  go2pay?: string;
  cron?: string;
  gmail?: string;
};
// The secret keys per parsed configuration, kept off the object so they are
// never serialized, logged or passed along with the configuration.
const secrets = new WeakMap<RuntimeConfig, Readonly<Secrets>>();

/**
 * The Supabase secret key of a configuration with `invites: "on"`. Only
 * `src/lib/runtime/providers.ts` may import this (lint), to hand the key to
 * the invite adapter; it is never logged or echoed.
 */
export function supabaseSecretKey(config: RuntimeConfig): string {
  const key = secrets.get(config)?.supabase;
  if (!key)
    throw new Error(
      "This configuration has no SUPABASE_SECRET_KEY (invites are off).",
    );
  return key;
}

/**
 * The Go2Pay API key of a configuration with `go2pay: "test" | "live"`. Only
 * `src/lib/runtime/providers.ts` may import this (lint), to hand the key to
 * the Go2Pay adapter (PR6); it is never logged or echoed.
 */
export function go2payApiKey(config: RuntimeConfig): string {
  const key = secrets.get(config)?.go2pay;
  if (!key)
    throw new Error(
      "This configuration has no GO2PAY_API_KEY (Go2Pay is off).",
    );
  return key;
}

/**
 * The daily-check secret of a configuration with `dailyCheck: "on"`. Only
 * `src/app/api/daily-check/route.ts` may import this (lint), to check Vercel
 * Cron's `Authorization` header; it is never logged or echoed.
 */
export function cronSecret(config: RuntimeConfig): string {
  const key = secrets.get(config)?.cron;
  if (!key)
    throw new Error("This configuration has no CRON_SECRET (daily check off).");
  return key;
}

/**
 * The Gmail app password of a configuration with `warningMail` set. Only
 * `src/lib/runtime/providers.ts` may import this (lint), to hand it to the
 * Gmail warning mailer; it is never logged or echoed.
 */
export function gmailAppPassword(config: RuntimeConfig): string {
  const key = secrets.get(config)?.gmail;
  if (!key)
    throw new Error(
      "This configuration has no GMAIL_APP_PASSWORD (warning emails are off).",
    );
  return key;
}

/**
 * Accepted settings that leave something off on the live site, as warnings
 * (never errors): `next.config.ts` prints them in the build log. Today only
 * the warning emails, when both Gmail variables are "off" (daily-check
 * contract D-17). Messages never echo a value.
 */
export function configurationWarnings(config: RuntimeConfig): string[] {
  return config.production && config.warningMail === "off"
    ? [
        'MSA_GMAIL_ADDRESS and GMAIL_APP_PASSWORD are "off": warning emails are off. The nightly check still runs and the dashboard\'s Needs attention box still lists problems, but nothing is emailed. Set both (docs/guides/owner-setup.md §10, "The daily check") and redeploy.',
      ]
    : [];
}

/** Validates an environment; throws one `ConfigurationError` listing every problem. */
export function parseRuntimeConfig(
  env: Record<string, string | undefined>,
): RuntimeConfig {
  const result = envSchema.safeParse(env);
  if (!result.success)
    throw new ConfigurationError(
      result.error.issues.map((issue) => issue.message),
    );
  return result.data;
}

let parsed: RuntimeConfig | undefined;
/** The process configuration, parsed once. */
export function runtimeConfig(): RuntimeConfig {
  parsed ??= parseRuntimeConfig(process.env);
  return parsed;
}
