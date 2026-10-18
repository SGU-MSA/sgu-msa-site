import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ESLint } from "eslint";
import {
  ConfigurationError,
  configurationWarnings,
  cronSecret,
  gmailAppPassword,
  go2payApiKey,
  parseRuntimeConfig,
  supabaseSecretKey,
  type RuntimeConfig,
} from "../src/lib/runtime/config";
import { fixedClock, systemClock } from "../src/lib/runtime/clock";
import { deploymentProfileFor, planWiring } from "../src/lib/runtime/wiring";
import {
  boardNotifications,
  WARNING_EMAILS_OFF,
} from "../src/features/admin/notifications/board-notifications";

type Env = Record<string, string | undefined>;

const production: Env = {
  VERCEL_ENV: "production",
  NODE_ENV: "production",
  SITE_DEMO_MODE: "false",
  SUPABASE_URL: "https://abcd1234.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  SITE_URL: "https://sgu-msa-site.vercel.app",
  ENABLE_VERCEL_MEASUREMENTS: "false",
  SUPABASE_SECRET_KEY: "sb_secret_production_example",
  GO2PAY_API_KEY: "off",
  CRON_SECRET: "production-cron-secret-example-0123456789",
  MSA_GMAIL_ADDRESS: "sgumsa.example@gmail.com",
  GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
};
const local: Env = {
  NODE_ENV: "development",
  SITE_DEMO_MODE: "false",
  SUPABASE_URL: "https://staging1234.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_staging",
  SITE_URL: "http://localhost:3000",
  SUPABASE_SECRET_KEY: "off",
  GO2PAY_API_KEY: "off",
  CRON_SECRET: "off",
  MSA_GMAIL_ADDRESS: "off",
  GMAIL_APP_PASSWORD: "off",
};
const sample: Env = {
  NODE_ENV: "development",
  SITE_DEMO_MODE: "true",
  SITE_DEMO_DATE: "2026-09-11T12:00:00Z",
  SITE_URL: "http://localhost:3000",
  CRON_SECRET: "off",
};

function problems(env: Env): string[] {
  try {
    parseRuntimeConfig(env);
  } catch (error) {
    assert.ok(error instanceof ConfigurationError, String(error));
    return [...error.problems];
  }
  assert.fail("expected a ConfigurationError");
}
function failsNaming(env: Env, name: string) {
  const found = problems(env).filter((line) => line.includes(name));
  assert.ok(found.length > 0, `expected a problem naming ${name}`);
  for (const line of found) {
    assert.match(line, /Vercel → Settings → Environment Variables/);
    assert.match(line, /\.env\.local/);
  }
}

test("a complete production configuration parses with no defaults", () => {
  assert.deepEqual(parseRuntimeConfig(production), {
    production: true,
    data: "live",
    sampleSeed: null,
    supabase: {
      url: "https://abcd1234.supabase.co",
      publishableKey: "sb_publishable_example",
    },
    secureCookies: true,
    siteUrl: "https://sgu-msa-site.vercel.app",
    measurements: false,
    invites: "on",
    go2pay: "off",
    dailyCheck: "on",
    warningMail: { address: "sgumsa.example@gmail.com" },
  });
});

test("production refuses sample data and a sample seed (D-3)", () => {
  failsNaming({ ...production, SITE_DEMO_MODE: "true" }, "SITE_DEMO_MODE");
  failsNaming(
    { ...production, SITE_DEMO_MODE: "true", SITE_DEMO_DATE: "2026-09-11" },
    "SITE_DEMO_MODE",
  );
  failsNaming(
    { ...production, SITE_DEMO_DATE: "2026-09-11T12:00:00Z" },
    "SITE_DEMO_DATE",
  );
});

test("each missing required variable fails naming it and where to set it", () => {
  const required = {
    production: [
      "SITE_DEMO_MODE",
      "SUPABASE_URL",
      "SUPABASE_PUBLISHABLE_KEY",
      "SITE_URL",
      "ENABLE_VERCEL_MEASUREMENTS",
      "SUPABASE_SECRET_KEY",
      "GO2PAY_API_KEY",
      "CRON_SECRET",
      "MSA_GMAIL_ADDRESS",
      "GMAIL_APP_PASSWORD",
    ],
    local: [
      "SITE_DEMO_MODE",
      "SUPABASE_URL",
      "SUPABASE_PUBLISHABLE_KEY",
      "SITE_URL",
      "SUPABASE_SECRET_KEY",
      "GO2PAY_API_KEY",
      "CRON_SECRET",
      "MSA_GMAIL_ADDRESS",
      "GMAIL_APP_PASSWORD",
    ],
    sample: ["SITE_DEMO_DATE", "SITE_URL", "CRON_SECRET"],
  };
  const bases = { production, local, sample };
  for (const [mode, names] of Object.entries(required)) {
    const base = bases[mode as keyof typeof bases];
    for (const name of names) {
      failsNaming({ ...base, [name]: undefined }, name);
      // An empty value (as Vercel or a copied .env.example can leave) is missing too.
      failsNaming({ ...base, [name]: "  " }, name);
    }
  }
});

test("several problems are reported together in one error", () => {
  const found = problems({
    ...production,
    SITE_URL: undefined,
    SITE_DEMO_MODE: "maybe",
    SUPABASE_URL: undefined,
  });
  assert.equal(found.length, 3);
  assert.throws(
    () =>
      parseRuntimeConfig({
        ...production,
        SITE_URL: undefined,
        SUPABASE_URL: "",
      }),
    /SUPABASE_URL[\s\S]*SITE_URL/,
  );
  assert.ok(problems({}).length >= 5);
});

test("on Vercel, a missing VERCEL_ENV fails instead of passing as non-production", () => {
  const onVercel = { ...production, VERCEL: "1", VERCEL_ENV: undefined };
  failsNaming(onVercel, "VERCEL_ENV");
  assert.ok(
    problems(onVercel).some((line) =>
      line.startsWith(
        "VERCEL_ENV missing on Vercel; system environment variables must be enabled",
      ),
    ),
  );
  assert.equal(
    parseRuntimeConfig({ ...production, VERCEL: "1" }).production,
    true,
  );
  // Off Vercel (a developer's computer) VERCEL_ENV is simply absent.
  assert.equal(parseRuntimeConfig(local).production, false);
});

test("messages for a variable that must not be set say where to remove it", () => {
  for (const env of [
    { ...production, SITE_DEMO_DATE: "2026-09-11T12:00:00Z" },
    { ...local, SITE_DEMO_DATE: "2026-09-11" },
  ]) {
    const found = problems(env).filter((line) =>
      line.startsWith("SITE_DEMO_DATE"),
    );
    assert.equal(found.length, 1);
    assert.ok(
      found[0].endsWith(
        "Remove it in Vercel → Settings → Environment Variables, or .env.local.",
      ),
      found[0],
    );
  }
});

test("problem messages never echo a received value", () => {
  const secret = "sb_secret_do-not-print";
  const found = problems({
    ...production,
    SUPABASE_PUBLISHABLE_KEY: secret,
    SITE_URL: "http://pay.example",
  });
  assert.equal(found.length, 2);
  assert.ok(found.every((line) => !line.includes(secret)));
  assert.ok(found.every((line) => !line.includes("pay.example")));
});

test("the retired DONATION_URL is not needed, and a leftover value is ignored (PR6 WP-9)", () => {
  for (const env of [production, local, sample])
    assert.deepEqual(
      parseRuntimeConfig({ ...env, DONATION_URL: "https://pay.example" }),
      parseRuntimeConfig(env),
    );
});

test("the retired MUSALLAH_* settings are not needed, and leftover values are ignored (PR7)", () => {
  for (const env of [production, local, sample])
    assert.doesNotThrow(() => parseRuntimeConfig(env));
  const leftover = parseRuntimeConfig({
    ...production,
    MUSALLAH_LOCATION_CONFIRMED: "yes",
    MUSALLAH_LATITUDE: "91",
    MUSALLAH_LONGITUDE: "not a number",
  });
  assert.deepEqual(leftover, parseRuntimeConfig(production));
  assert.ok(!("musallahEntrance" in leftover));
});

test("SITE_URL has no fallback and is validated", () => {
  failsNaming({ ...production, SITE_URL: "http://example.org" }, "SITE_URL");
  failsNaming({ ...production, SITE_URL: "not a url" }, "SITE_URL");
  failsNaming(
    { ...production, SITE_URL: "https://example.org/path" },
    "SITE_URL",
  );
  assert.equal(
    parseRuntimeConfig({ ...production, SITE_URL: "https://example.org/" })
      .siteUrl,
    "https://example.org",
  );
  assert.equal(parseRuntimeConfig(local).siteUrl, "http://localhost:3000");
});

test("SITE_DESIGN is retired: no longer required, and ignored when still set (PR2)", () => {
  const config = parseRuntimeConfig(production);
  assert.equal("design" in config, false);
  assert.deepEqual(
    parseRuntimeConfig({ ...production, SITE_DESIGN: "courtyard" }),
    config,
  );
  assert.deepEqual(
    parseRuntimeConfig({ ...sample, SITE_DESIGN: "anything" }),
    parseRuntimeConfig(sample),
  );
});

test("sample data needs a valid seed; live data rejects one", () => {
  const config = parseRuntimeConfig(sample);
  assert.equal(config.data, "sample");
  assert.equal(config.sampleSeed?.toISOString(), "2026-09-11T12:00:00.000Z");
  assert.equal(config.supabase, null);
  failsNaming({ ...sample, SITE_DEMO_DATE: "next tuesday" }, "SITE_DEMO_DATE");
  failsNaming({ ...local, SITE_DEMO_DATE: "2026-09-11" }, "SITE_DEMO_DATE");
  failsNaming({ ...local, SITE_DEMO_MODE: "yes" }, "SITE_DEMO_MODE");
});

test("a Supabase secret key is refused", () => {
  failsNaming(
    { ...local, SUPABASE_PUBLISHABLE_KEY: "sb_secret_abc" },
    "SUPABASE_PUBLISHABLE_KEY",
  );
});

test("measurements follow D-5: required in production, on only with true", () => {
  failsNaming(
    { ...production, ENABLE_VERCEL_MEASUREMENTS: undefined },
    "ENABLE_VERCEL_MEASUREMENTS",
  );
  failsNaming(
    { ...production, ENABLE_VERCEL_MEASUREMENTS: "yes" },
    "ENABLE_VERCEL_MEASUREMENTS",
  );
  const on = parseRuntimeConfig({
    ...production,
    ENABLE_VERCEL_MEASUREMENTS: "true",
  });
  assert.equal(on.measurements, true);
  assert.equal(deploymentProfileFor(on).measurements, true);
  const off = parseRuntimeConfig(production);
  assert.equal(off.measurements, false);
  assert.equal(deploymentProfileFor(off).measurements, false);
  // Never outside production: local, preview and sample runs.
  for (const env of [
    { ...local, ENABLE_VERCEL_MEASUREMENTS: "true" },
    { ...local, VERCEL_ENV: "preview", ENABLE_VERCEL_MEASUREMENTS: "true" },
    { ...sample, ENABLE_VERCEL_MEASUREMENTS: "true" },
    local,
  ]) {
    const config = parseRuntimeConfig(env);
    assert.equal(config.measurements, false);
    assert.equal(deploymentProfileFor(config).measurements, false);
  }
});

test("planWiring never selects a sample adapter in production", () => {
  const values = {
    VERCEL_ENV: ["production", "preview", "development", undefined],
    SITE_DEMO_MODE: ["true", "false", undefined, "TRUE"],
    SITE_DEMO_DATE: ["2026-09-11T12:00:00Z", "invalid", undefined],
    SUPABASE_URL: ["https://abcd1234.supabase.co", undefined],
    ENABLE_VERCEL_MEASUREMENTS: ["true", "false", undefined],
    SUPABASE_SECRET_KEY: [
      "sb_secret_example",
      "off",
      "sb_publishable_x",
      undefined,
    ],
    GO2PAY_API_KEY: ["g2p_live_example", "g2p_test_example", "off", undefined],
    CRON_SECRET: ["c".repeat(32), "off", "short", undefined],
    GMAIL_APP_PASSWORD: ["abcdefghijklmnop", "off", undefined],
  };
  let parsedProduction = 0;
  const combine = (entries: [string, (string | undefined)[]][]): Env[] =>
    entries.length === 0
      ? [{}]
      : combine(entries.slice(1)).flatMap((rest) =>
          entries[0][1].map((value) => ({ ...rest, [entries[0][0]]: value })),
        );
  for (const overrides of combine(Object.entries(values))) {
    let config: RuntimeConfig;
    try {
      config = parseRuntimeConfig({ ...production, ...overrides });
    } catch (error) {
      assert.ok(error instanceof ConfigurationError);
      continue;
    }
    const wiring = planWiring(config);
    if (config.production) {
      parsedProduction++;
      assert.equal(config.data, "live");
      assert.ok(!JSON.stringify(wiring).includes("sample"));
      assert.equal(wiring.clock, "system");
      assert.equal(wiring.editor, "supabase");
      // Page text comes from the database (PR5b).
      assert.equal(wiring.editorial, "supabase");
      assert.equal(wiring.auth, "supabase");
      assert.equal(wiring.people, "supabase");
      assert.equal(wiring.activity, "supabase");
      assert.equal(wiring.places, "supabase");
      assert.equal(wiring.inviter, "supabase");
      // PR6: production never gets the sample payments, seasons or fake gateway.
      assert.equal(wiring.payments, "supabase");
      assert.equal(wiring.seasons, "supabase");
      assert.equal(config.invites, "on");
      assert.notEqual(config.go2pay, "test");
      assert.notEqual(wiring.gateway, "fake");
      // Gmail whenever it is set; both "off" is the one exception (D-17).
      assert.equal(
        wiring.mailer,
        config.warningMail === "off" ? "off" : "gmail",
      );
      assert.equal(wiring.ledger, "supabase");
      assert.equal(config.dailyCheck, "on");
    } else {
      // Real email only from Vercel Production (daily-check contract WP-1).
      assert.notEqual(wiring.mailer, "gmail");
    }
  }
  assert.ok(parsedProduction > 0);
  // Even a hand-built configuration cannot wire sample data in production.
  const forged = { ...parseRuntimeConfig(sample), production: true };
  assert.throws(() => planWiring(forged), /never allowed in production/);
  // Nor can it wire invites off in production.
  const noInvites = { ...parseRuntimeConfig(local), production: true };
  assert.throws(() => planWiring(noInvites), /Invite emails must be on/);
  // Nor the daily check off in production (its emails may be, D-17).
  const live = parseRuntimeConfig({
    ...local,
    SUPABASE_SECRET_KEY: "sb_secret_example",
  });
  for (const forgedOff of [
    { ...live, production: true },
    { ...parseRuntimeConfig(production), dailyCheck: "off" as const },
  ])
    assert.throws(() => planWiring(forgedOff), /daily check must be on/);
});

test("wiring and deployment profile per mode", () => {
  const live = parseRuntimeConfig(local);
  assert.deepEqual(planWiring(live), {
    clock: "system",
    content: "supabase",
    editorial: "supabase",
    payments: "supabase",
    seasons: "supabase",
    places: "supabase",
    editor: "supabase",
    auth: "supabase",
    people: "supabase",
    activity: "supabase",
    handover: "supabase",
    order: "supabase",
    inviter: "off",
    gateway: "off",
    mailer: "off",
    ledger: "off",
  });
  assert.deepEqual(deploymentProfileFor(live), {
    indexable: true,
    measurements: false,
    adminPortal: "ready",
    warningEmailsOff: false,
  });

  const demo = parseRuntimeConfig(sample);
  const wiring = planWiring(demo);
  assert.deepEqual(wiring.clock, { fixed: demo.sampleSeed });
  assert.equal(wiring.content, "sample");
  assert.equal(wiring.editorial, "sample");
  assert.equal(wiring.editor, "sample");
  assert.equal(wiring.auth, "sample");
  assert.equal(wiring.people, "sample");
  assert.equal(wiring.activity, "sample");
  assert.equal(wiring.handover, "sample");
  assert.equal(wiring.order, "sample");
  assert.equal(wiring.places, "sample");
  assert.equal(wiring.inviter, "sample");
  assert.equal(wiring.gateway, "fake");
  assert.equal(wiring.payments, "sample");
  assert.equal(wiring.seasons, "sample");
  assert.equal(wiring.mailer, "sample");
  assert.equal(wiring.ledger, "sample");
  const profile = deploymentProfileFor(demo);
  assert.equal(profile.indexable, false);
  assert.equal(profile.adminPortal, "sample");
  assert.equal("sampleBanner" in profile, false);
});

test("clocks: the fixed clock is frozen and owns its instant", () => {
  const seed = new Date("2026-09-11T12:00:00Z");
  const clock = fixedClock(seed);
  seed.setUTCFullYear(2040);
  assert.equal(clock.now().toISOString(), "2026-09-11T12:00:00.000Z");
  clock.now().setUTCFullYear(2041);
  assert.equal(clock.now().toISOString(), "2026-09-11T12:00:00.000Z");
  assert.ok(Math.abs(systemClock.now().getTime() - Date.now()) < 1000);
});

test("SUPABASE_SECRET_KEY: a secret key or off, off refused in production, value never echoed", () => {
  const secret = "sb_secret_do-not-print-1234";
  const on = parseRuntimeConfig({ ...local, SUPABASE_SECRET_KEY: secret });
  assert.equal(on.invites, "on");
  assert.equal(planWiring(on).inviter, "supabase");
  assert.equal(supabaseSecretKey(on), secret);
  // The key is not a property of the configuration and never serialized.
  assert.ok(!JSON.stringify(on).includes(secret));
  assert.ok(!Object.values(on).includes(secret));

  const off = parseRuntimeConfig(local);
  assert.equal(off.invites, "off");
  assert.equal(planWiring(off).inviter, "off");
  assert.throws(() => supabaseSecretKey(off), /invites are off/);

  failsNaming(
    { ...production, SUPABASE_SECRET_KEY: "off" },
    "SUPABASE_SECRET_KEY",
  );
  for (const value of [
    "sb_publishable_abc",
    "sb_secret_",
    "OFF",
    "eyJhbGciOiJIUzI1NiJ9.service_role",
  ])
    failsNaming(
      { ...local, SUPABASE_SECRET_KEY: value },
      "SUPABASE_SECRET_KEY",
    );
  const leaked = "sb_publishable_do-not-print-5678";
  for (const env of [
    { ...production, SUPABASE_SECRET_KEY: leaked },
    { ...local, SUPABASE_SECRET_KEY: leaked },
  ])
    assert.ok(problems(env).every((line) => !line.includes(leaked)));
});

test("SUPABASE_SECRET_KEY is ignored with sample data", () => {
  for (const value of [undefined, "off", "sb_secret_example", "nonsense"]) {
    const config = parseRuntimeConfig({
      ...sample,
      SUPABASE_SECRET_KEY: value,
    });
    assert.equal(config.invites, "off");
    assert.equal(planWiring(config).inviter, "sample");
    assert.throws(() => supabaseSecretKey(config));
  }
});

test("GO2PAY_API_KEY: live only in production, test only elsewhere, or off; never echoed (PR6 D-21, D-28)", () => {
  const live = "g2p_live_do-not-print-1234";
  const testKey = "g2p_test_do-not-print-5678";

  const onLive = parseRuntimeConfig({ ...production, GO2PAY_API_KEY: live });
  assert.equal(onLive.go2pay, "live");
  assert.equal(planWiring(onLive).gateway, "go2pay");
  assert.equal(go2payApiKey(onLive), live);
  const onTest = parseRuntimeConfig({ ...local, GO2PAY_API_KEY: testKey });
  assert.equal(onTest.go2pay, "test");
  assert.equal(planWiring(onTest).gateway, "go2pay");
  assert.equal(go2payApiKey(onTest), testKey);
  // A preview deployment is not production: test keys only.
  const preview = { ...local, VERCEL: "1", VERCEL_ENV: "preview" };
  assert.equal(
    parseRuntimeConfig({ ...preview, GO2PAY_API_KEY: testKey }).go2pay,
    "test",
  );
  // The key is not a property of the configuration and never serialized.
  for (const [config, key] of [
    [onLive, live],
    [onTest, testKey],
  ] as const) {
    assert.ok(!JSON.stringify(config).includes(key));
    assert.ok(!Object.values(config).includes(key));
  }

  for (const env of [production, local]) {
    const off = parseRuntimeConfig(env);
    assert.equal(off.go2pay, "off");
    assert.equal(planWiring(off).gateway, "off");
    assert.throws(() => go2payApiKey(off), /Go2Pay is off/);
  }
  // Both keys present (Supabase and Go2Pay) stay separate.
  assert.equal(supabaseSecretKey(onLive), production.SUPABASE_SECRET_KEY);
  assert.throws(() => supabaseSecretKey(onTest), /invites are off/);

  // The wrong kind of key for the place is refused, with a reason.
  const wrongKind = [
    [{ ...production, GO2PAY_API_KEY: testKey }, /must be a live key/],
    [{ ...local, GO2PAY_API_KEY: live }, /must be a test key/],
    [{ ...preview, GO2PAY_API_KEY: live }, /must be a test key/],
  ] as const;
  for (const [env, reason] of wrongKind) {
    failsNaming(env, "GO2PAY_API_KEY");
    assert.ok(problems(env).some((line) => reason.test(line)));
  }
  for (const value of [
    "OFF",
    "g2p_live_",
    "g2p_test_",
    "g2p_prod_abc",
    "sk_live_abc",
    "g2p_test_has space",
  ])
    for (const env of [production, local])
      failsNaming({ ...env, GO2PAY_API_KEY: value }, "GO2PAY_API_KEY");

  for (const [env, key] of [
    [{ ...production, GO2PAY_API_KEY: testKey }, testKey],
    [{ ...local, GO2PAY_API_KEY: live }, live],
    [{ ...local, GO2PAY_API_KEY: "g2p_prod_do-not-print" }, "do-not-print"],
  ] as const)
    assert.ok(problems(env).every((line) => !line.includes(key)));
});

test("GO2PAY_API_KEY is ignored with sample data", () => {
  for (const value of [undefined, "off", "g2p_test_example", "nonsense"]) {
    const config = parseRuntimeConfig({ ...sample, GO2PAY_API_KEY: value });
    assert.equal(config.go2pay, "off");
    assert.equal(planWiring(config).gateway, "fake");
    assert.throws(() => go2payApiKey(config));
  }
});

test("lint: only the composition point may import the secret accessors", async () => {
  const eslint = new ESLint();
  const code = (name: string) =>
    `import { ${name} } from "@/lib/runtime/config";\nexport const key = ${name};\n`;
  for (const name of ["go2payApiKey", "supabaseSecretKey"]) {
    for (const filePath of [
      "src/features/admin/example.ts",
      "src/lib/integrations/payments/providers/example.ts",
      "src/app/example/page.tsx",
    ]) {
      const [result] = await eslint.lintText(code(name), { filePath });
      assert.ok(
        result.messages.some(
          (message) => message.ruleId === "no-restricted-imports",
        ),
        `${name} must be refused in ${filePath}`,
      );
    }
    const [allowed] = await eslint.lintText(code(name), {
      filePath: "src/lib/runtime/providers.ts",
    });
    assert.ok(
      allowed.messages.every(
        (message) => message.ruleId !== "no-restricted-imports",
      ),
      `${name} is allowed in providers.ts`,
    );
  }
});

test("the secret key stays inside its four files", () => {
  // ADR 0022: the daily check's ledger is the key's one other use.
  const allowed = new Set([
    "src/lib/runtime/config.ts",
    "src/lib/runtime/providers.ts",
    "src/lib/backend/providers/supabase-inviter.ts",
    "src/lib/backend/providers/supabase-ledger.ts",
  ]);
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });
  const found = files("src").filter(
    (path) =>
      /\.(ts|tsx|js|mjs)$/.test(path) &&
      /sb_secret|supabaseSecretKey|auth\.admin/.test(
        readFileSync(path, "utf8"),
      ),
  );
  assert.ok(found.length > 0);
  for (const path of found)
    assert.ok(allowed.has(path.replaceAll("\\", "/")), path);
  // And the configuration never hands it to the browser bundle.
  assert.ok(
    !/SUPABASE_SECRET_KEY/.test(readFileSync("next.config.ts", "utf8")),
  );
});

test("the Go2Pay key stays inside the configuration and the composition point", () => {
  // The Go2Pay adapter (PR6 WP-4) is the only other holder.
  const allowed = new Set([
    "src/lib/runtime/config.ts",
    "src/lib/runtime/providers.ts",
    "src/lib/integrations/payments/providers/go2pay.ts",
  ]);
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });
  const found = files("src").filter(
    (path) =>
      /\.(ts|tsx|js|mjs)$/.test(path) &&
      /g2p_|go2payApiKey|GO2PAY_API_KEY/.test(readFileSync(path, "utf8")),
  );
  assert.ok(found.includes(join("src", "lib", "runtime", "config.ts")));
  for (const path of found)
    assert.ok(allowed.has(path.replaceAll("\\", "/")), path);
  assert.ok(!/GO2PAY|g2p_/.test(readFileSync("next.config.ts", "utf8")));
  // Never a public (browser) variable.
  for (const path of [...files("src"), "next.config.ts", ".env.example"])
    assert.ok(
      !/NEXT_PUBLIC_GO2PAY/.test(readFileSync(path, "utf8")),
      `${path} must not expose the Go2Pay key to browsers`,
    );
});

test("CRON_SECRET: 32+ safe characters or off, off refused in production, never echoed (daily check WP-1)", () => {
  const secret = "do-not-print_" + "a1".repeat(16);
  for (const env of [production, local, sample]) {
    const on = parseRuntimeConfig({ ...env, CRON_SECRET: secret });
    assert.equal(on.dailyCheck, "on");
    assert.equal(cronSecret(on), secret);
    assert.ok(!JSON.stringify(on).includes(secret));
    assert.ok(!Object.values(on).includes(secret));
  }
  for (const env of [local, sample]) {
    const off = parseRuntimeConfig({ ...env, CRON_SECRET: "off" });
    assert.equal(off.dailyCheck, "off");
    assert.throws(() => cronSecret(off), /daily check off/);
  }
  failsNaming({ ...production, CRON_SECRET: "off" }, "CRON_SECRET");
  for (const value of [
    "a".repeat(31),
    "OFF",
    "has space " + "a".repeat(32),
    "a".repeat(31) + "!",
  ])
    for (const env of [production, local, sample]) {
      failsNaming({ ...env, CRON_SECRET: value }, "CRON_SECRET");
      assert.ok(
        problems({ ...env, CRON_SECRET: value }).every(
          (line) => !line.includes(value),
        ),
      );
    }
});

test("MSA_GMAIL_ADDRESS and GMAIL_APP_PASSWORD: required together, never echoed (D-15)", () => {
  const config = parseRuntimeConfig({
    ...production,
    MSA_GMAIL_ADDRESS: "SGUMSA.Example@gmail.com",
    GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
  });
  assert.deepEqual(config.warningMail, { address: "sgumsa.example@gmail.com" });
  // Spaces as Google shows them are ignored.
  assert.equal(gmailAppPassword(config), "abcdefghijklmnop");
  assert.ok(!JSON.stringify(config).includes("abcdefghijklmnop"));

  const off = parseRuntimeConfig(local);
  assert.equal(off.warningMail, "off");
  assert.throws(() => gmailAppPassword(off), /warning emails are off/);
  // Real values on a developer's computer still never send.
  const realLocal = parseRuntimeConfig({
    ...local,
    MSA_GMAIL_ADDRESS: "sgumsa.example@gmail.com",
    GMAIL_APP_PASSWORD: "abcdefghijklmnop",
  });
  assert.deepEqual(realLocal.warningMail, {
    address: "sgumsa.example@gmail.com",
  });
  assert.equal(planWiring(realLocal).mailer, "off");
  const preview = { ...local, VERCEL: "1", VERCEL_ENV: "preview" };
  assert.equal(planWiring(parseRuntimeConfig(preview)).mailer, "off");

  // One "off" and one real value: set both or neither, production included.
  for (const name of ["MSA_GMAIL_ADDRESS", "GMAIL_APP_PASSWORD"]) {
    failsNaming({ ...production, [name]: "off" }, name);
    assert.ok(
      problems({ ...production, [name]: "off" }).some((line) =>
        line.includes("go together"),
      ),
    );
  }
  failsNaming(
    { ...local, MSA_GMAIL_ADDRESS: "sgumsa.example@gmail.com" },
    "MSA_GMAIL_ADDRESS",
  );
  failsNaming(
    { ...local, GMAIL_APP_PASSWORD: "abcdefghijklmnop" },
    "GMAIL_APP_PASSWORD",
  );
  for (const value of ["sgumsa@sgu.edu", "not an address", "@gmail.com", "OFF"])
    failsNaming(
      { ...production, MSA_GMAIL_ADDRESS: value },
      "MSA_GMAIL_ADDRESS",
    );
  const leaked = "zyxwvutsrqponmlkj";
  for (const value of [
    "abcdefghijklmno",
    leaked,
    "abcd-efgh-ijkl-mnop",
    "1234567890123456",
  ]) {
    failsNaming(
      { ...production, GMAIL_APP_PASSWORD: value },
      "GMAIL_APP_PASSWORD",
    );
    assert.ok(
      problems({ ...production, GMAIL_APP_PASSWORD: value }).every(
        (line) => !line.includes(value),
      ),
    );
  }
  // A production configuration without the three settings: one error listing all three.
  const missing = problems({
    ...production,
    CRON_SECRET: undefined,
    MSA_GMAIL_ADDRESS: undefined,
    GMAIL_APP_PASSWORD: undefined,
  });
  assert.equal(missing.length, 3);
  for (const name of ["CRON_SECRET", "MSA_GMAIL_ADDRESS", "GMAIL_APP_PASSWORD"])
    assert.ok(
      missing.some((line) => line.startsWith(`${name} is missing`)),
      name,
    );
});

test("production accepts both Gmail variables off, with a build warning and the dashboard line (D-17)", () => {
  const gmailOff = {
    ...production,
    MSA_GMAIL_ADDRESS: "off",
    GMAIL_APP_PASSWORD: "off",
  };
  const config = parseRuntimeConfig(gmailOff);
  assert.equal(config.production, true);
  assert.equal(config.warningMail, "off");
  // The daily check and the invite key stay required.
  assert.equal(config.dailyCheck, "on");
  assert.equal(config.invites, "on");
  failsNaming({ ...gmailOff, CRON_SECRET: "off" }, "CRON_SECRET");
  failsNaming(
    { ...gmailOff, SUPABASE_SECRET_KEY: "off" },
    "SUPABASE_SECRET_KEY",
  );
  // Off must be typed: missing values still stop the deploy.
  failsNaming(
    { ...gmailOff, MSA_GMAIL_ADDRESS: undefined },
    "MSA_GMAIL_ADDRESS",
  );
  failsNaming(
    { ...gmailOff, GMAIL_APP_PASSWORD: undefined },
    "GMAIL_APP_PASSWORD",
  );

  // The build log's warning names both variables.
  const [warning, ...rest] = configurationWarnings(config);
  assert.equal(rest.length, 0);
  assert.match(warning, /MSA_GMAIL_ADDRESS and GMAIL_APP_PASSWORD/);
  assert.match(warning, /warning emails are off/);
  // No warning with Gmail set, or off production.
  for (const env of [production, local, sample])
    assert.deepEqual(configurationWarnings(parseRuntimeConfig(env)), []);

  // The nightly check still runs, with the off mailer.
  const wiring = planWiring(config);
  assert.equal(wiring.mailer, "off");
  assert.equal(wiring.ledger, "supabase");
  assert.equal(planWiring(parseRuntimeConfig(production)).mailer, "gmail");

  // The dashboard's notifications say so, until both are set.
  assert.equal(deploymentProfileFor(config).warningEmailsOff, true);
  for (const env of [production, local, sample])
    assert.equal(
      deploymentProfileFor(parseRuntimeConfig(env)).warningEmailsOff,
      false,
    );
  assert.equal(
    WARNING_EMAILS_OFF,
    "Warning emails are off: set up the MSA Gmail",
  );
  const lines = (warningEmailsOff: boolean) =>
    boardNotifications({
      attention: [],
      warningEmailsOff,
      managers: null,
      nobodyEditsPages: false,
      canManagePeople: false,
      prayerChange: null,
    });
  // A problem: it cannot be closed, only fixed.
  assert.deepEqual(
    lines(true).map(({ title, level }) => ({ title, level })),
    [{ title: WARNING_EMAILS_OFF, level: "problem" }],
  );
  assert.deepEqual(lines(false), []);
});

test("MSA_GMAIL_ADDRESS and GMAIL_APP_PASSWORD are ignored with sample data", () => {
  for (const value of [undefined, "off", "nonsense"]) {
    const config = parseRuntimeConfig({
      ...sample,
      MSA_GMAIL_ADDRESS: value,
      GMAIL_APP_PASSWORD: value,
    });
    assert.equal(config.warningMail, "off");
    assert.equal(planWiring(config).mailer, "sample");
    assert.throws(() => gmailAppPassword(config));
  }
});

test("lint: only the nightly route reads the cron secret; only the composition point the Gmail password", async () => {
  const eslint = new ESLint();
  const code = (name: string) =>
    `import { ${name} } from "@/lib/runtime/config";\nexport const key = ${name};\n`;
  const refused = async (name: string, filePath: string) => {
    const [result] = await eslint.lintText(code(name), { filePath });
    return result.messages.some(
      (message) => message.ruleId === "no-restricted-imports",
    );
  };
  const route = "src/app/api/daily-check/route.ts";
  const providers = "src/lib/runtime/providers.ts";
  for (const filePath of [
    providers,
    "src/app/admin/dashboard/page.tsx",
    "src/lib/backend/daily-check.ts",
    "src/features/admin/example.ts",
  ])
    assert.ok(
      await refused("cronSecret", filePath),
      `cronSecret refused in ${filePath}`,
    );
  assert.equal(await refused("cronSecret", route), false);
  for (const name of [
    "gmailAppPassword",
    "supabaseSecretKey",
    "go2payApiKey",
  ]) {
    assert.ok(await refused(name, route), `${name} refused in the route`);
    assert.ok(
      await refused(name, "src/lib/backend/providers/gmail-mailer.ts"),
      name,
    );
    assert.equal(
      await refused(name, providers),
      false,
      `${name} allowed in providers.ts`,
    );
  }
});

test("the Gmail app password and cron secret never reach a public variable or the browser config", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });
  for (const path of [...files("src"), "next.config.ts", ".env.example"])
    assert.ok(
      !/NEXT_PUBLIC_(CRON|MSA_GMAIL|GMAIL)/.test(readFileSync(path, "utf8")),
      path,
    );
  const found = files("src").filter((path) =>
    /gmailAppPassword|GMAIL_APP_PASSWORD/.test(readFileSync(path, "utf8")),
  );
  assert.deepEqual(found.map((path) => path.replaceAll("\\", "/")).sort(), [
    "src/lib/runtime/config.ts",
    "src/lib/runtime/providers.ts",
  ]);
});

test("every board page starts over when opened by a link (review 2 PR-C, kept pages)", () => {
  const pages = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return pages(path);
      return name === "page.tsx" ? [path] : [];
    });
  const found = pages("src/app/admin").filter(
    // Only redirects to /admin: nothing on it to keep.
    (path) => !path.endsWith(join("login", "page.tsx")),
  );
  assert.ok(found.length > 20);
  for (const path of found)
    assert.match(
      readFileSync(path, "utf8"),
      /^export default boardPage\(\w+\);$/m,
      `${path} must export its page through boardPage`,
    );
});
