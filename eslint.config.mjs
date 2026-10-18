import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

// Import boundaries. ESLint applies only the last matching
// `no-restricted-imports` setting to a file, so each block below lists every
// pattern that applies to its files.
const noRoutesOrFeatures = {
  group: ["@/app/*", "@/features/*"],
  message:
    "Shared UI and libraries must not depend on routes or feature implementations.",
};
const noRoutes = {
  group: ["@/app/*"],
  message:
    "Features own their workflows; routes compose them, not the reverse.",
};
const noConcreteData = {
  group: [
    "@/lib/backend/*",
    "@/lib/demo/fixtures",
    "@/lib/community/providers/*",
    "@supabase/*",
  ],
  message:
    "UI uses shared queries/actions and domain types, never a concrete data provider.",
};
// ADR 0012: only the composition point (src/lib/runtime/providers.ts) imports
// adapters. `demo/mode` stays banned so no "is this the demo?" switch returns;
// features read DeploymentProfile policies or result provenance instead.
const noAdapters = {
  group: [
    "**/providers/*",
    "!**/providers/contract",
    "**/demo/mode",
    "**/demo/store",
  ],
  message:
    "Only src/lib/runtime/providers.ts imports adapters; depend on the port in providers/contract or on a lib query function.",
};
const noRuntime = {
  group: ["@/lib/runtime/*"],
  message:
    "Feature and shared components receive data and policies from routes or lib functions, never from the runtime composition.",
};
// PR3, PR6 and daily-check contracts: each secret leaves the configuration
// through one file only. The composition point hands the Supabase secret key,
// the Go2Pay API key and the Gmail app password to their adapters; the
// nightly route alone reads the cron secret, to check Vercel Cron's header.
const configModule = ["**/config", "./config", "@/lib/runtime/config"];
const adapterSecrets = [
  "supabaseSecretKey",
  "go2payApiKey",
  "gmailAppPassword",
];
const adapterSecretMessage =
  "Only src/lib/runtime/providers.ts reads the Supabase secret key, the Go2Pay API key and the Gmail app password (to hand each to its adapter).";
const cronSecretMessage =
  "Only src/app/api/daily-check/route.ts reads the cron secret.";
const noSecretKey = {
  group: configModule,
  importNames: [...adapterSecrets, "cronSecret"],
  message: `${adapterSecretMessage} ${cronSecretMessage}`,
};
const noCronSecret = {
  group: configModule,
  importNames: ["cronSecret"],
  message: cronSecretMessage,
};
const noAdapterSecrets = {
  group: configModule,
  importNames: adapterSecrets,
  message: adapterSecretMessage,
};
// Every block lists the secret-key rule: the last matching block wins.
const restrict = (...patterns) => ({
  "no-restricted-imports": ["error", { patterns: [...patterns, noSecretKey] }],
});
const compositionFiles = ["src/lib/runtime/**", "src/**/providers/**"];
const compositionPoint = "src/lib/runtime/providers.ts";
const dailyCheckRoute = "src/app/api/daily-check/route.ts";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: compositionFiles,
    rules: restrict(noAdapters),
  },
  {
    files: ["src/shared/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
    ignores: compositionFiles,
    rules: restrict(noRoutesOrFeatures, noAdapters),
  },
  {
    files: ["src/lib/runtime/**", "src/lib/**/providers/**"],
    ignores: [compositionPoint],
    rules: restrict(noRoutesOrFeatures),
  },
  {
    files: [compositionPoint],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [noRoutesOrFeatures, noCronSecret] },
      ],
    },
  },
  {
    files: ["src/features/**/*.{ts,tsx}"],
    rules: restrict(noRoutes, noAdapters),
  },
  {
    files: ["src/features/**/*.tsx"],
    rules: restrict(noRoutes, noConcreteData, noAdapters, noRuntime),
  },
  {
    files: ["src/shared/**/*.tsx"],
    rules: restrict(noRoutesOrFeatures, noConcreteData, noAdapters, noRuntime),
  },
  {
    files: [dailyCheckRoute],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [noAdapters, noAdapterSecrets] },
      ],
    },
  },
  {
    // ADR 0012: one environment reader, validated and without defaults.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/runtime/config.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Read configuration through runtimeConfig() in src/lib/runtime/config.ts.",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Compiler output from `npm run validate:content` — not source.
    ".validate-out/**",
    // Storybook build output from `npm run build-storybook` (gitignored).
    "storybook-static/**",
    // The map library copied from node_modules by next.config.ts (gitignored).
    "public/maplibre/**",
    // Temporary worktrees of parallel agent sessions (gitignored).
    ".claude/worktrees/**",
    // Private browser profiles and local agent-only state (gitignored).
    ".agents/local/**",
    // Untracked planning drafts and generated review artifacts (gitignored).
    ".plans/**",
  ]),
]);
