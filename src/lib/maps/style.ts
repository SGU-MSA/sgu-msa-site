import type {
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";

/**
 * The map's tile source (PR7 D-2, D-14, P-4): OpenFreeMap, free, with no key
 * or account. The map starts from its Positron style and recolours it in the
 * site's paper colours ("3 + campus names"). The CSP's `connect-src` lists
 * exactly this host (next.config.ts) and the privacy page names it.
 */
export const openFreeMapHost = "https://tiles.openfreemap.org";
export const openFreeMapStyle = `${openFreeMapHost}/styles/positron`;

/**
 * The map library (`maplibre-gl`, D-12), served from this site: next.config.ts
 * copies these files from the installed package into `public/maplibre/`.
 * The page imports the library from there only when a map is shown (D-6);
 * the library then starts its worker from the same folder.
 */
export const mapLibraryFolder = "/maplibre";
export const mapLibraryFiles = [
  "maplibre-gl.mjs",
  "maplibre-gl-shared.mjs",
  "maplibre-gl-worker.mjs",
] as const;
export const mapLibraryURL = `${mapLibraryFolder}/${mapLibraryFiles[0]}`;

/**
 * The only map credit (D-15): shown when the collapsed ⓘ button is tapped.
 * OpenStreetMap's licence and OpenFreeMap ask for it; no library logo.
 */
export const mapCredit =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> · <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>';

/** Campus building names (P-4): named buildings this far from the pin. */
export const CAMPUS_NAMES_RADIUS_M = 600;
/** …copied from OpenStreetMap at most once a day (seconds). */
export const CAMPUS_NAMES_REFRESH_S = 86_400;
/** …and after a failed copy with none kept, asked again only after this long (seconds). */
export const CAMPUS_NAMES_RETRY_S = 3_600;
/** The longest our server waits for OpenStreetMap (milliseconds). */
export const CAMPUS_NAMES_TIMEOUT_MS = 5_000;
/** Where the map reads them: our own route, so OpenStreetMap never sees visitors. */
export const campusNamesPath = "/api/campus-names";

/**
 * The map colours, read in the browser from the `--map-*` tokens (and
 * `--paper`, `--paper-light`) in src/styles/tokens.css: the only home of
 * their values, light and dark.
 */
export type MapPalette = Readonly<{
  paper: string;
  minor: string;
  water: string;
  park: string;
  building: string;
  road: string;
  casing: string;
  label: string;
}>;

/** Each palette colour's token. */
export const mapTokens: Record<keyof MapPalette, string> = {
  paper: "--paper",
  minor: "--paper-light",
  water: "--map-water",
  park: "--map-park",
  building: "--map-building",
  road: "--map-road",
  casing: "--map-casing",
  label: "--map-label",
};

type Paint = Record<string, unknown>;

/** The paper colours for one layer, by its type and id; null keeps the layer's own. */
function paperPaint(layer: LayerSpecification, c: MapPalette): Paint | null {
  const id = layer.id;
  switch (layer.type) {
    case "background":
      return { "background-color": c.paper };
    case "fill":
      if (/water/.test(id)) return { "fill-color": c.water };
      if (/park|wood|grass|landcover|landuse/.test(id))
        return { "fill-color": c.park };
      if (/building/.test(id))
        return { "fill-color": c.building, "fill-outline-color": c.casing };
      return { "fill-color": c.paper };
    case "line":
      if (/water/.test(id)) return { "line-color": c.water };
      if (/casing|boundary/.test(id)) return { "line-color": c.casing };
      if (/minor|service|path|track|pier/.test(id))
        return { "line-color": c.minor };
      if (/road|highway|bridge|tunnel|motorway|street|rail|aeroway/.test(id))
        return { "line-color": c.road };
      return null;
    case "symbol":
      return { "text-color": c.label, "text-halo-color": c.paper };
    default:
      return null;
  }
}

/**
 * Quiet Paper (P-4): OpenFreeMap's Positron layers in the site's colours,
 * set by layer type and id pattern. A layer no pattern matches keeps
 * Positron's own grey, which stays readable.
 */
export function paperStyle(
  layers: readonly LayerSpecification[],
  palette: MapPalette,
): LayerSpecification[] {
  return layers.map((layer) => {
    const paint = paperPaint(layer, palette);
    return paint
      ? ({
          ...layer,
          paint: { ...(layer as { paint?: Paint }).paint, ...paint },
        } as LayerSpecification)
      : layer;
  });
}

/** A text label layer in the paper colours (no icons). */
const labelLayer = (
  id: string,
  source: string,
  font: string,
  palette: MapPalette,
  extra: Partial<{ "source-layer": string; minzoom: number }> = {},
): LayerSpecification => ({
  id,
  type: "symbol",
  source,
  ...extra,
  filter: ["has", "name"],
  layout: {
    "text-field": ["get", "name"],
    "text-font": [font],
    "text-size": 11.5,
    "text-max-width": 8,
    "text-padding": 2,
  },
  paint: {
    "text-color": palette.label,
    "text-halo-color": palette.paper,
    "text-halo-width": 1.4,
  },
});

/**
 * The whole map style ("3 + campus names"): Positron recoloured
 * (`paperStyle`), shop and café names as text, and the campus building names
 * from `namesURL` in italics. Every source's own credit line is dropped: the
 * one credit is `mapCredit` behind the ⓘ button (D-15).
 */
export function musallahMapStyle(
  base: StyleSpecification,
  palette: MapPalette,
  namesURL: string | null,
): StyleSpecification {
  // An empty credit also replaces the one the tile service sends with its
  // tile list (MapLibre lets the style's value win).
  const sources: Record<string, SourceSpecification> = {};
  for (const [id, source] of Object.entries(base.sources))
    sources[id] = { ...source, attribution: "" } as SourceSpecification;
  const layers = [
    ...paperStyle(base.layers, palette),
    labelLayer("poi-names", "openmaptiles", "Noto Sans Regular", palette, {
      "source-layer": "poi",
      minzoom: 15,
    }),
  ];
  if (namesURL) {
    sources["campus-names"] = {
      type: "geojson",
      data: namesURL,
      attribution: "",
    };
    layers.push(
      labelLayer("campus-names", "campus-names", "Noto Sans Italic", palette),
    );
  }
  return { ...base, sources, layers };
}
