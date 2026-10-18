import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

const outputDirectory = "coverage";
const lcovPath = `${outputDirectory}/lcov.info`;

mkdirSync(outputDirectory, { recursive: true });
for (const path of [lcovPath, `${outputDirectory}/scope.txt`]) {
  try {
    unlinkSync(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const args = [
  "--import",
  "tsx",
  "--experimental-test-coverage",
  "--test-coverage-include=src/**/*.ts",
  "--test-coverage-include=src/**/*.tsx",
  "--test-coverage-exclude=**/*.stories.tsx",
  "--test-coverage-lines=88",
  "--test-coverage-branches=89",
  "--test-coverage-functions=84",
  "--test-reporter=spec",
  "--test-reporter-destination=stdout",
  "--test-reporter=lcov",
  `--test-reporter-destination=${lcovPath}`,
  "--import",
  "./tests/support/register.mjs",
  "--test",
  "tests/*.test.ts",
];

const result = spawnSync(process.execPath, args, { stdio: "inherit" });

if (result.error) {
  console.error(
    `Could not start the Node coverage runner: ${result.error.message}`,
  );
  process.exitCode = 1;
} else if (result.status !== null) {
  process.exitCode = result.status;
} else {
  process.exitCode = 1;
}

try {
  const lcov = readFileSync(lcovPath, "utf8");
  if (!lcov.trim()) throw new Error("LCOV report is empty");

  const records = lcov
    .split("end_of_record")
    .filter((record) => record.includes("SF:"));
  if (records.length === 0)
    throw new Error("LCOV report contains no source files");

  const totals = {
    linesFound: 0,
    linesHit: 0,
    branchesFound: 0,
    branchesHit: 0,
    functionsFound: 0,
    functionsHit: 0,
  };
  const keys = {
    LF: "linesFound",
    LH: "linesHit",
    BRF: "branchesFound",
    BRH: "branchesHit",
    FNF: "functionsFound",
    FNH: "functionsHit",
  };

  for (const record of records) {
    for (const field of ["SF", "LF", "LH", "BRF", "BRH", "FNF", "FNH"]) {
      if (!new RegExp(`^${field}:.+$`, "m").test(record)) {
        throw new Error(`LCOV source record is missing ${field}`);
      }
    }

    for (const line of record.split("\n")) {
      const match = /^(LF|LH|BRF|BRH|FNF|FNH):(\d+)$/.exec(line);
      if (!match) continue;
      totals[keys[match[1]]] += Number(match[2]);
    }
  }

  for (const [metric, found, hit] of [
    ["lines", totals.linesFound, totals.linesHit],
    ["branches", totals.branchesFound, totals.branchesHit],
    ["functions", totals.functionsFound, totals.functionsHit],
  ]) {
    if (found <= 0 || hit < 0 || hit > found) {
      throw new Error(`LCOV ${metric} totals are invalid (${hit}/${found})`);
    }
  }

  const report = [
    `Loaded source files: ${records.length}`,
    "Scope: loaded .ts and .tsx modules under src/; Storybook *.stories.tsx files are excluded.",
    "Unloaded src/ files are absent from this report; this is not a whole-source census.",
    `Denominators (covered/total): lines ${totals.linesHit}/${totals.linesFound}; branches ${totals.branchesHit}/${totals.branchesFound}; functions ${totals.functionsHit}/${totals.functionsFound}.`,
    "Source detail and per-file counts: lcov.info.",
    "",
  ].join("\n");

  writeFileSync(`${outputDirectory}/scope.txt`, report);
  process.stdout.write(`\n${report}`);
} catch (error) {
  console.error(`Coverage report is missing or invalid: ${error.message}`);
  process.exitCode = 1;
}
