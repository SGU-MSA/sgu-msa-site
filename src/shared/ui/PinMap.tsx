"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type {
  Map as MapLibreMap,
  Marker,
  StyleSpecification,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import type { Place } from "@/lib/maps/providers/contract";
import {
  mapCredit,
  mapLibraryURL,
  mapTokens,
  musallahMapStyle,
  openFreeMapStyle,
  type MapPalette,
} from "@/lib/maps/style";
import { cn } from "./cn";
import s from "./PinMap.module.css";

export type PinMapProps = {
  /** The one point the map is centred on and the dot marks. */
  center: Place;
  /** The small tag beside the dot, or none. */
  label: string | null;
  /** The dot can be moved: dragged with a mouse or finger, or with the arrow keys once focused. */
  draggable?: boolean;
  /**
   * The dot was moved to `place` (after a drag or an arrow key). Returning
   * false puts it back where it was.
   */
  onMove?(place: Place): boolean | void;
  /** The map cannot be drawn (no WebGL, or the map service failed to load). */
  onUnavailable?(): void;
  /** Extra italic place names, as a GeoJSON address (points with a `name`). */
  names?: string | null;
  /** The draggable dot's name for screen readers. */
  dotLabel?: string;
  /** Read out by screen readers after each move the caller accepts. */
  movedMessage?: string;
  className?: string;
};

/** The zoom the map opens at: the campus buildings around the dot. */
const ZOOM = 16.5;
/** One arrow-key press moves the dot about this far; ten times with Shift (PR7 D-5). */
const STEP_M = 2;
const METRES_PER_DEGREE = 111_320;

/** The map colours from the tokens where the map is drawn (light or dark). */
function readPalette(element: Element): MapPalette {
  const computed = getComputedStyle(element);
  return Object.fromEntries(
    Object.entries(mapTokens).map(([key, token]) => [
      key,
      computed.getPropertyValue(token).trim(),
    ]),
  ) as MapPalette;
}

/** `place` moved `east` and `north` metres. */
function moved(place: Place, east: number, north: number): Place {
  const latitude = place.latitude + north / METRES_PER_DEGREE;
  const longitude =
    place.longitude +
    east / (METRES_PER_DEGREE * Math.cos((place.latitude * Math.PI) / 180));
  return { latitude, longitude };
}

const arrows: Record<string, [number, number]> = {
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/**
 * One MapLibre map centred on one point, in the site's paper colours (PR7
 * "3 + campus names"), with a small dot and an optional small tag. Light and
 * dark follow the theme switch. The only credit is the collapsed ⓘ button
 * (D-15); no library logo, no compass. MapLibre's code is fetched only when
 * this component first renders, so pages load it only where it is shown.
 * Feature-free: the caller decides what a move means (`onMove`).
 */
export function PinMap({
  center,
  label,
  draggable = false,
  onMove,
  onUnavailable,
  names = null,
  dotLabel,
  movedMessage,
  className,
}: PinMapProps) {
  // The live region's text; the count makes a repeated message read again.
  const [moves, setMoves] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const marker = useRef<Marker | null>(null);
  // Where the dot last settled: a refused move goes back here.
  const last = useRef<Place>(center);
  // The latest callbacks, without re-creating the map when they change.
  const callbacks = useRef({ onMove, onUnavailable });
  useEffect(() => {
    callbacks.current = { onMove, onUnavailable };
  });
  // The map is created once; a new `center` only moves the dot.
  const start = useRef({ center, label, draggable, names, dotLabel });

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const { center, label, draggable, names, dotLabel } = start.current;
    let map: MapLibreMap | null = null;
    let themeWatch: MutationObserver | null = null;
    let cancelled = false;
    let loaded = false;
    const unavailable = () => {
      if (cancelled || loaded) return;
      cancelled = true;
      map?.remove();
      callbacks.current.onUnavailable?.();
    };

    (async () => {
      try {
        const [maplibre, base] = await Promise.all([
          // Not bundled: the copy in public/maplibre, shared with its worker.
          import(
            /* webpackIgnore: true */ /* @vite-ignore */ mapLibraryURL
          ) as Promise<typeof import("maplibre-gl")>,
          fetch(openFreeMapStyle).then((response) => {
            if (!response.ok) throw new Error(`style ${response.status}`);
            return response.json() as Promise<StyleSpecification>;
          }),
        ]);
        if (cancelled) return;
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const style = () => musallahMapStyle(base, readPalette(element), names);
        map = new maplibre.Map({
          container: element,
          style: style(),
          center: [center.longitude, center.latitude],
          zoom: ZOOM,
          attributionControl: false,
          // PR7 E-7: on the public site a finger scrolls the page and two
          // fingers move the map; the editor moves the map with one.
          cooperativeGestures: !draggable,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          fadeDuration: reduced ? 0 : 300,
        });
        map.touchZoomRotate.disableRotation();
        map.keyboard.disableRotation();
        map.addControl(
          new maplibre.NavigationControl({ showCompass: false }),
          "top-right",
        );
        map.addControl(
          new maplibre.AttributionControl({
            compact: true,
            customAttribution: mapCredit,
          }),
          "bottom-right",
        );
        // D-15: the ⓘ credit starts closed (MapLibre opens it on wide maps);
        // a tap opens it.
        const closeCredit = () =>
          element
            .querySelector(".maplibregl-ctrl-attrib")
            ?.classList.remove("maplibregl-compact-show");
        closeCredit();
        map.on("error", (event) => {
          // The extra names are optional: the map shows without them.
          const source = (event as { sourceId?: string }).sourceId;
          if (source !== "campus-names") unavailable();
        });
        // Drawn for the first time: tests and help pictures wait for this.
        map.once("idle", () => element.setAttribute("data-map-ready", ""));
        map.once("load", () => {
          loaded = true;
          // MapLibre re-checks the credit's width once the map has loaded.
          closeCredit();
        });

        const pin = document.createElement("div");
        pin.className = s.pin;
        const dot = document.createElement("span");
        dot.className = s.dot;
        pin.append(dot);
        if (label) {
          const tag = document.createElement("span");
          tag.className = s.tag;
          tag.textContent = label;
          pin.append(tag);
        }
        const dropped = new maplibre.Marker({
          element: pin,
          anchor: "center",
          draggable,
        })
          .setLngLat([center.longitude, center.latitude])
          .addTo(map);
        marker.current = dropped;

        if (draggable) {
          const place = () => {
            const { lat, lng } = dropped.getLngLat();
            return { latitude: lat, longitude: lng };
          };
          const settle = (next: Place) => {
            if (callbacks.current.onMove?.(next) === false) {
              const back = last.current;
              dropped.setLngLat([back.longitude, back.latitude]);
              return;
            }
            last.current = next;
            dropped.setLngLat([next.longitude, next.latitude]);
            setMoves((count) => count + 1);
            if (!map?.getBounds().contains([next.longitude, next.latitude]))
              map?.panTo([next.longitude, next.latitude]);
          };
          dropped.on("dragend", () => settle(place()));
          pin.tabIndex = 0;
          // MapLibre stops a press from focusing the dot; a click focuses it
          // so the arrow keys work next.
          pin.addEventListener("click", () => pin.focus());
          // Its own arrow keys, no Enter or Space action: an application
          // region, so screen readers pass the arrow keys through.
          pin.setAttribute("role", "application");
          pin.setAttribute("aria-roledescription", "draggable pin");
          if (dotLabel) pin.setAttribute("aria-label", dotLabel);
          pin.addEventListener("keydown", (event) => {
            const arrow = arrows[event.key];
            if (!arrow) return;
            // The map's own arrow keys would pan it instead.
            event.preventDefault();
            event.stopPropagation();
            const metres = STEP_M * (event.shiftKey ? 10 : 1);
            settle(moved(last.current, arrow[0] * metres, arrow[1] * metres));
          });
        } else {
          // The buttons and written directions carry the information.
          pin.setAttribute("aria-hidden", "true");
        }

        // The theme switch recolours the map (the style is diffed, the dot stays).
        themeWatch = new MutationObserver(() => map?.setStyle(style()));
        themeWatch.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["data-theme"],
        });
      } catch {
        unavailable();
      }
    })();

    return () => {
      cancelled = true;
      themeWatch?.disconnect();
      marker.current = null;
      map?.remove();
    };
  }, []);

  // A saved or reset pin moves the dot without re-creating the map.
  const { latitude, longitude } = center;
  useEffect(() => {
    last.current = { latitude, longitude };
    marker.current?.setLngLat([longitude, latitude]);
  }, [latitude, longitude]);

  return (
    <>
      <div ref={container} className={cn(s.map, className)} />
      {draggable && movedMessage ? (
        <p className="sr-only" aria-live="polite">
          {moves > 0 ? `${movedMessage}${moves % 2 ? "" : "\u00a0"}` : ""}
        </p>
      ) : null}
    </>
  );
}

export default PinMap;
