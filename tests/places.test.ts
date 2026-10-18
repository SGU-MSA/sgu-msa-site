import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { parseRuntimeConfig } from "../src/lib/runtime/config";
import { planWiring } from "../src/lib/runtime/wiring";
import { directionsLinks } from "../src/lib/maps/location";
import { isAppleDevice } from "../src/lib/maps/device";
import {
  GRENADA_BOUNDS,
  inGrenada,
  outsideCampus,
} from "../src/lib/maps/place";
import type { Place, PlacesProvider } from "../src/lib/maps/providers/contract";
import { createSamplePlacesProvider } from "../src/lib/maps/providers/sample";
import type { MusallahDirections } from "../src/lib/maps";
import { musallahPinSchema } from "../src/lib/community/schema";
import { demoMusallahPin } from "../src/lib/demo/fixtures";

/**
 * Test-only memory adapter shaped like the Supabase one: hands back the
 * stored pin, or the unreachable state (there is always a pin, PR7).
 */
function memoryPlacesProvider(stored: Place | "unreachable"): PlacesProvider {
  return {
    async musallahEntrance() {
      return stored === "unreachable"
        ? { place: null, unavailable: true, provenance: "live" }
        : { place: stored, unavailable: false, provenance: "live" };
    },
  };
}

/**
 * Conformance suite every non-network PlacesProvider must pass (ADR 0012):
 * results carry `unavailable` and `provenance`, a place is a coordinate pair
 * in Grenada, and the place is null exactly when the source is unavailable.
 */
function placesConformance(name: string, provider: PlacesProvider) {
  test(`${name}: carries place, unavailable and provenance`, async () => {
    const result = await provider.musallahEntrance();
    assert.equal(typeof result.unavailable, "boolean");
    assert.ok(["live", "sample"].includes(result.provenance));
    assert.equal(result.place === null, result.unavailable);
    if (result.place) assert.ok(inGrenada(result.place));
  });
}

const pin: Place = { latitude: 12.0025521, longitude: -61.7723834 };
const seed = new Date("2026-09-11T12:00:00Z");

placesConformance("memory adapter (stored)", memoryPlacesProvider(pin));
placesConformance(
  "memory adapter (unreachable)",
  memoryPlacesProvider("unreachable"),
);
placesConformance("sample adapter", createSamplePlacesProvider(seed));

test("the sandbox pin is the user's Google place, as sample data (E-9)", async () => {
  assert.deepEqual(await createSamplePlacesProvider(seed).musallahEntrance(), {
    place: pin,
    unavailable: false,
    provenance: "sample",
  });
  assert.deepEqual(demoMusallahPin, { id: 1, ...pin });
});

test("directions go to the pin only, walking, with Google's and Apple's documented URLs (D-7, D-8, E-5)", () => {
  assert.deepEqual(directionsLinks(pin), {
    google:
      "https://www.google.com/maps/dir/?api=1&destination=12.0025521%2C-61.7723834&travelmode=walking",
    apple:
      "https://maps.apple.com/directions?destination=12.0025521%2C-61.7723834&mode=walking",
  });
  const { google, apple } = directionsLinks({ latitude: 12, longitude: -61.5 });
  assert.equal(new URL(google).searchParams.get("destination"), "12,-61.5");
  assert.equal(new URL(apple).searchParams.get("destination"), "12,-61.5");
  assert.ok(!google.includes("place_id"), "no Google place link (D-8)");
});

test("Apple devices see Apple Maps too; every other device sees Google Maps only (E-6)", () => {
  const apple = {
    iPhone:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1",
    "iPad (desktop mode)":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15",
    "iPad (mobile mode)":
      "Mozilla/5.0 (iPad; CPU OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1",
    "Mac Chrome":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Chrome on iPhone":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
    "Firefox on iPhone":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15",
  };
  const others = {
    Android:
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    Windows:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Linux:
      "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
    empty: "",
  };
  for (const [name, agent] of Object.entries(apple))
    assert.equal(isAppleDevice(agent), true, name);
  for (const [name, agent] of Object.entries(others))
    assert.equal(isAppleDevice(agent), false, name);
});

test("the Grenada box covers the main island, Carriacou and Petite Martinique, not St. Vincent's islands (D-9)", () => {
  const { south, north, west, east } = GRENADA_BOUNDS;
  for (const place of [
    pin,
    { latitude: 12.48, longitude: -61.45 }, // Carriacou
    { latitude: 12.52, longitude: -61.385 }, // Petite Martinique
    { latitude: 12.0, longitude: -61.8 }, // Point Salines
    { latitude: south, longitude: west },
    { latitude: north, longitude: east },
  ])
    assert.ok(inGrenada(place), JSON.stringify(place));
  for (const place of [
    { latitude: 12.536, longitude: -61.384 }, // Petit St. Vincent
    { latitude: 12.6, longitude: -61.43 }, // Union Island
    { latitude: 10.65, longitude: -61.5 }, // Trinidad
    { latitude: south - 0.0001, longitude: -61.7 },
    { latitude: 12.1, longitude: east + 0.0001 },
  ])
    assert.ok(!inGrenada(place), JSON.stringify(place));
});

test("musallahPinSchema refuses out-of-range, off-campus and missing values by name (review fixes P4)", () => {
  const refusal = (value: unknown) => {
    const parsed = musallahPinSchema.safeParse(value);
    assert.ok(!parsed.success, JSON.stringify(value));
    return [...new Set(parsed.error.issues.map((issue) => issue.message))];
  };
  assert.deepEqual(refusal({ id: 1, latitude: 12.536, longitude: -61.384 }), [
    outsideCampus,
  ]);
  // In Grenada but about 6 km from campus (St. George's).
  assert.deepEqual(refusal({ id: 1, latitude: 12.0561, longitude: -61.7488 }), [
    outsideCampus,
  ]);
  assert.deepEqual(refusal({ id: 1, latitude: 91, longitude: -61.75 }), [
    "Latitude: enter a number from -90 to 90.",
  ]);
  assert.deepEqual(refusal({ id: 1 }), [
    "Musallah location: drag the dot to set the pin.",
  ]);
  assert.deepEqual(refusal({ id: 2, ...pin }).length, 1);
  assert.deepEqual(
    musallahPinSchema.parse({ id: 1, ...pin, updated_at: "2026-10-05" }),
    { id: 1, ...pin },
  );
});

const local = {
  NODE_ENV: "development" as const,
  SITE_URL: "http://localhost:3000",
  CRON_SECRET: "off",
};
const live = {
  ...local,
  SITE_DEMO_MODE: "false",
  // Nothing listens here: the live adapter fails fast, as with no network.
  SUPABASE_URL: "http://127.0.0.1:9",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_staging",
  SUPABASE_SECRET_KEY: "off",
  GO2PAY_API_KEY: "off",
  MSA_GMAIL_ADDRESS: "off",
  GMAIL_APP_PASSWORD: "off",
};
const sample = {
  ...local,
  SITE_DEMO_MODE: "true",
  SITE_DEMO_DATE: "2026-09-11T12:00:00Z",
};

test("wiring: the pin comes from the database with live data and the sandbox with sample data", () => {
  const production = {
    ...live,
    VERCEL_ENV: "production",
    NODE_ENV: "production",
    SUPABASE_URL: "https://abcd1234.supabase.co",
    SITE_URL: "https://sgu-msa-site.vercel.app",
    ENABLE_VERCEL_MEASUREMENTS: "false",
    SUPABASE_SECRET_KEY: "sb_secret_example",
    CRON_SECRET: "c".repeat(40),
    MSA_GMAIL_ADDRESS: "sgumsa.example@gmail.com",
    GMAIL_APP_PASSWORD: "abcdefghijklmnop",
  };
  assert.equal(planWiring(parseRuntimeConfig(live)).places, "supabase");
  assert.equal(planWiring(parseRuntimeConfig(production)).places, "supabase");
  assert.equal(planWiring(parseRuntimeConfig(sample)).places, "sample");
});

/**
 * `musallahDirections()` through the composition point. `runtimeConfig()`
 * parses the environment once per process, so each configuration runs in a
 * fresh Node process with only the variables given here.
 */
function musallahDirectionsUnder(env: typeof local & Record<string, string>) {
  const run = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--import",
      "./tests/support/register.mjs",
      "--eval",
      'require("./src/lib/maps/index.ts").musallahDirections()' +
        ".then((result) => process.stdout.write(JSON.stringify(result)));",
    ],
    { env: { PATH: process.env.PATH ?? "", ...env }, encoding: "utf8" },
  );
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout) as MusallahDirections;
}

test("musallahDirections points at exactly the stored pin", () => {
  assert.deepEqual(musallahDirectionsUnder(sample), {
    place: pin,
    links: directionsLinks(pin),
    unavailable: false,
    provenance: "sample",
  });
});

test("musallahDirections never invents a place when the database cannot be reached", () => {
  assert.deepEqual(musallahDirectionsUnder(live), {
    place: null,
    links: null,
    unavailable: true,
    provenance: "live",
  });
});
