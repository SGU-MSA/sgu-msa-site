import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import {
  campusNamesFor,
  campusNamesFrom,
  campusNamesURL,
  noCampusNames,
  pausedAfterFailure,
} from "../src/lib/maps/campus-names";
import {
  CAMPUS_NAMES_RADIUS_M,
  CAMPUS_NAMES_RETRY_S,
  mapCredit,
  mapLibraryFiles,
  mapTokens,
  musallahMapStyle,
  openFreeMapHost,
  paperStyle,
  type MapPalette,
} from "../src/lib/maps/style";

/**
 * PR7 WP-4: the paper map style (P-4 "3 + campus names"), the campus names
 * copied from OpenStreetMap, and the CSP the map needs. The map itself is
 * drawn in the browser (tests/e2e/demo.spec.ts).
 */
const palette: MapPalette = {
  paper: "#000001",
  minor: "#000002",
  water: "#000003",
  park: "#000004",
  building: "#000005",
  road: "#000006",
  casing: "#000007",
  label: "#000008",
};

/** Layer ids and types as OpenFreeMap's Positron style has them (2026-10). */
const positron = [
  ["background", "background"],
  ["park", "fill"],
  ["water", "fill"],
  ["landcover_wood", "fill"],
  ["landuse_residential", "fill"],
  ["building", "fill"],
  ["aeroway-area", "fill"],
  ["waterway", "line"],
  ["highway_path", "line"],
  ["highway_minor", "line"],
  ["highway_major_casing", "line"],
  ["highway_major_inner", "line"],
  ["railway", "line"],
  ["boundary_2", "line"],
  ["highway-name-minor", "symbol"],
  ["label_city", "symbol"],
] as const;
const layers = positron.map(
  ([id, type]) =>
    ({
      id,
      type,
      source: "openmaptiles",
      paint: { "line-width": 2 },
    }) as unknown as LayerSpecification,
);
const paintOf = (styled: LayerSpecification[], id: string) =>
  (
    styled.find((layer) => layer.id === id) as {
      paint: Record<string, unknown>;
    }
  ).paint;

test("paperStyle recolours Positron's layers by type and id, keeping the rest of each layer", () => {
  const styled = paperStyle(layers, palette);
  assert.equal(styled.length, layers.length);
  const expected: Record<string, Record<string, string>> = {
    background: { "background-color": palette.paper },
    park: { "fill-color": palette.park },
    water: { "fill-color": palette.water },
    landcover_wood: { "fill-color": palette.park },
    landuse_residential: { "fill-color": palette.park },
    building: {
      "fill-color": palette.building,
      "fill-outline-color": palette.casing,
    },
    "aeroway-area": { "fill-color": palette.paper },
    waterway: { "line-color": palette.water },
    highway_path: { "line-color": palette.minor },
    highway_minor: { "line-color": palette.minor },
    highway_major_casing: { "line-color": palette.casing },
    highway_major_inner: { "line-color": palette.road },
    railway: { "line-color": palette.road },
    boundary_2: { "line-color": palette.casing },
    "highway-name-minor": {
      "text-color": palette.label,
      "text-halo-color": palette.paper,
    },
    label_city: {
      "text-color": palette.label,
      "text-halo-color": palette.paper,
    },
  };
  for (const [id, colours] of Object.entries(expected)) {
    const paint = paintOf(styled, id);
    for (const [property, colour] of Object.entries(colours))
      assert.equal(paint[property], colour, `${id} ${property}`);
    assert.equal(paint["line-width"], 2, `${id} keeps its other paint`);
  }
  // A layer type the paper look does not know keeps Positron's own colours.
  const raster = {
    id: "ne2_shaded",
    type: "raster",
    source: "ne2_shaded",
  } as LayerSpecification;
  assert.equal(paperStyle([raster], palette)[0], raster);
  // Pure: the input is not changed.
  assert.deepEqual((layers[0] as { paint: unknown }).paint, {
    "line-width": 2,
  });
});

const base = {
  version: 8,
  glyphs: `${openFreeMapHost}/fonts/{fontstack}/{range}.pbf`,
  sources: {
    openmaptiles: { type: "vector", url: `${openFreeMapHost}/planet` },
    ne2_shaded: {
      type: "raster",
      tiles: [`${openFreeMapHost}/natural_earth/{z}/{x}/{y}.png`],
      attribution: "Natural Earth",
    },
  },
  layers,
} as unknown as StyleSpecification;

test("the map style: paper colours, shop names as text, campus names in italics, no source credits (P-4, D-15)", () => {
  const style = musallahMapStyle(base, palette, "/api/campus-names");
  for (const [id, source] of Object.entries(style.sources))
    assert.equal(
      (source as { attribution?: string }).attribution,
      "",
      `${id}: only the ⓘ credit names the map data`,
    );
  assert.deepEqual(style.sources["campus-names"], {
    type: "geojson",
    data: "/api/campus-names",
    attribution: "",
  });
  const added = style.layers.slice(layers.length);
  assert.deepEqual(
    added.map((layer) => [layer.id, (layer as { source: string }).source]),
    [
      ["poi-names", "openmaptiles"],
      ["campus-names", "campus-names"],
    ],
  );
  const campus = added[1] as {
    layout: Record<string, unknown>;
    paint: Record<string, unknown>;
  };
  assert.deepEqual(campus.layout["text-font"], ["Noto Sans Italic"]);
  assert.equal(campus.paint["text-color"], palette.label);
  assert.equal(style.glyphs, base.glyphs);
  // Without a names address there is no campus layer.
  const plain = musallahMapStyle(base, palette, null);
  assert.equal(plain.sources["campus-names"], undefined);
  assert.equal(plain.layers.at(-1)?.id, "poi-names");
  // The one credit: OpenStreetMap and OpenFreeMap, no library logo.
  assert.match(mapCredit, /© OpenStreetMap contributors/);
  assert.match(mapCredit, /OpenFreeMap/);
  assert.doesNotMatch(mapCredit, /MapLibre/);
});

test("every map colour is a hex token in tokens.css, light and dark", () => {
  const css = readFileSync("src/styles/tokens.css", "utf8");
  const block = (selector: string) => {
    const start = css.indexOf(`${selector} {`);
    return css.slice(start, css.indexOf("\n}", start));
  };
  for (const selector of [":root", '[data-theme="dark"]'])
    for (const token of Object.values(mapTokens)) {
      const value = block(selector).match(
        new RegExp(`\\s${token}:\\s*([^;]+);`),
      )?.[1];
      assert.match(
        value ?? "",
        /^#[0-9a-f]{6}$/i,
        `${selector} ${token}: MapLibre reads hex colours`,
      );
    }
});

const pin = { latitude: 12.0025521, longitude: -61.7723834 };

test("campus names: one Overpass request for named buildings around the pin", () => {
  const url = new URL(campusNamesURL(pin));
  assert.equal(url.origin, "https://overpass-api.de");
  const query = url.searchParams.get("data") ?? "";
  assert.ok(
    query.includes(`around:${CAMPUS_NAMES_RADIUS_M},12.00255,-61.77238`),
    query,
  );
  assert.match(query, /way\["building"\]\["name"\]/);
  assert.match(query, /out center tags;$/);
});

test("campus names keep only a name and a centre per building, each name once", () => {
  const names = campusNamesFrom({
    elements: [
      {
        type: "way",
        id: 1,
        center: { lat: 12.0019, lon: -61.7729 },
        tags: { name: "Superdorm 3", building: "dormitory", phone: "123" },
      },
      { type: "node", id: 2, lat: 12.0, lon: -61.77, tags: { name: "Kiosk" } },
      { type: "way", id: 3, center: { lat: 12.1, lon: -61.7 }, tags: {} },
      { type: "way", id: 4, tags: { name: "No centre" } },
      {
        type: "way",
        id: 5,
        center: { lat: 12.2, lon: -61.6 },
        tags: { name: "Superdorm 3" },
      },
    ],
  });
  assert.deepEqual(names, {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Superdorm 3" },
        geometry: { type: "Point", coordinates: [-61.7729, 12.0019] },
      },
      {
        type: "Feature",
        properties: { name: "Kiosk" },
        geometry: { type: "Point", coordinates: [-61.77, 12.0] },
      },
    ],
  });
  assert.equal(campusNamesFrom({ remark: "runtime error" }), null);
  assert.equal(campusNamesFrom("<html>"), null);
});

test("campus names never fail the map: no pin, an error or a bad reply give no names", async () => {
  const reply = {
    elements: [{ center: { lat: 12, lon: -61.77 }, tags: { name: "Hall" } }],
  };
  const asked: string[] = [];
  const ok = await campusNamesFor(pin, async (url) => {
    asked.push(url);
    return Response.json(reply);
  });
  assert.equal(ok.features[0].properties.name, "Hall");
  assert.deepEqual(asked, [campusNamesURL(pin)]);

  let called = false;
  const none = await campusNamesFor(null, async () => {
    called = true;
    return Response.json(reply);
  });
  assert.deepEqual(none, noCampusNames);
  assert.equal(called, false, "no pin: OpenStreetMap is not asked");

  for (const failing of [
    async () => new Response("Too Many Requests", { status: 429 }),
    async () => new Response("<html>", { status: 200 }),
    async () => Response.json({ remark: "timeout" }),
    async () => {
      throw new Error("network down");
    },
  ])
    assert.deepEqual(await campusNamesFor(pin, failing), noCampusNames);
});

test("campus names: after a failure OpenStreetMap is not asked again for an hour", async () => {
  let now = 0;
  let calls = 0;
  let status = 504;
  const request = pausedAfterFailure(
    async () => {
      calls += 1;
      return new Response("Gateway Timeout", { status });
    },
    () => now,
  );
  const url = campusNamesURL(pin);
  assert.deepEqual(await campusNamesFor(pin, request), noCampusNames);
  assert.equal(calls, 1);
  now += (CAMPUS_NAMES_RETRY_S - 1) * 1000;
  assert.deepEqual(await campusNamesFor(pin, request), noCampusNames);
  assert.equal(calls, 1, "paused: no second call");
  now += 2000;
  status = 200;
  assert.equal((await request(url)).status, 200);
  assert.equal(calls, 2, "asked again after the pause");
  assert.equal((await request(url)).status, 200);
  assert.equal(calls, 3, "a good reply sets no pause");

  const throwing = pausedAfterFailure(
    async () => {
      calls += 1;
      throw new Error("timeout");
    },
    () => now,
  );
  await assert.rejects(throwing(url));
  await assert.rejects(throwing(url), /paused/);
  assert.equal(calls, 4);
});

test("CSP: the map's own host, a same-site worker, no frames (PR7 WP-4)", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(config, /`connect-src 'self' \$\{openFreeMapHost\}`/);
  assert.equal(openFreeMapHost, "https://tiles.openfreemap.org");
  assert.match(config, /"worker-src 'self'"/);
  assert.match(config, /"frame-src 'none'"/);
  assert.doesNotMatch(config, /openstreetmap/i);
  assert.match(config, /"img-src 'self' data: blob:"/);
  // The library and its worker come from public/maplibre, never a blob.
  assert.deepEqual([...mapLibraryFiles].sort(), [
    "maplibre-gl-shared.mjs",
    "maplibre-gl-worker.mjs",
    "maplibre-gl.mjs",
  ]);
  assert.match(readFileSync(".gitignore", "utf8"), /^\/public\/maplibre\/$/m);
});
