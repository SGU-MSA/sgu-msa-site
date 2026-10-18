"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { isAppleDevice } from "@/lib/maps/device";
import type { DirectionsLinks } from "@/lib/maps/location";
import type { Place } from "@/lib/maps/providers/contract";
import { campusNamesPath } from "@/lib/maps/style";
import { ButtonLink } from "@/shared/ui/ButtonLink";

import p from "./prayer.module.css";

// PR7 D-6: MapLibre's code is not in the page's first JavaScript; it is
// fetched only once the box comes near the screen.
const PinMap = dynamic(() => import("@/shared/ui/PinMap"), { ssr: false });

/** Nothing to subscribe to: these browser facts do not change on a page. */
const noChanges = () => () => {};
/**
 * PR7 E-6: detected in the browser only, after the page loads. The server
 * (and a browser without JavaScript) sees "not Apple": Google Maps only.
 */
const appleDevice = () => isAppleDevice(navigator.userAgent);
/** PR7 E-10: the browser asks to save data, so the map is not loaded. */
const savingData = () =>
  (navigator as { connection?: { saveData?: boolean } }).connection
    ?.saveData === true;
const onServer = () => false;

/** How far below the screen the box starts loading (D-6). */
const LOAD_MARGIN = "200px";

/**
 * The "Find us on campus" box (PR7 WP-4): the board's pin on the paper map,
 * loaded by itself when the box comes near the screen, and walking
 * directions: Apple Maps and Google Maps on Apple devices, Google Maps
 * elsewhere (D-7). The map's space is kept from the start, so nothing jumps.
 */
export function MusallahMap({
  place,
  links,
}: {
  /** The board's pin; null when it could not be read. */
  place: Place | null;
  links: DirectionsLinks | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<"waiting" | "shown" | "failed">("waiting");
  const apple = useSyncExternalStore(noChanges, appleDevice, onServer);
  const saveData = useSyncExternalStore(noChanges, savingData, onServer);

  useEffect(() => {
    const element = box.current;
    if (!element || saveData) return;
    const watch = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        watch.disconnect();
        setMap((now) => (now === "waiting" ? "shown" : now));
      },
      { rootMargin: LOAD_MARGIN },
    );
    watch.observe(element);
    return () => watch.disconnect();
  }, [saveData]);

  return (
    <div className={p.map}>
      <p className={p.mapLabel}>
        <span aria-hidden="true">↗</span>
        <strong>Find us on campus</strong>
      </p>
      {place && links ? (
        <>
          <div
            ref={box}
            className={p.mapFrame}
            role="region"
            aria-label="Map of the SGU Musallah on campus"
            data-map={saveData ? "saving-data" : map}
          >
            {saveData ? (
              <p className={p.mapMessage}>Map hidden to save data.</p>
            ) : map === "failed" ? (
              <p className={p.mapMessage}>The map can’t be shown right now.</p>
            ) : map === "shown" ? (
              <PinMap
                center={place}
                label="SGU Musallah"
                names={campusNamesPath}
                onUnavailable={() => setMap("failed")}
              />
            ) : null}
          </div>
          <div className={p.directions}>
            <p className={p.directionsLabel}>Get directions</p>
            <div className={p.directionsButtons}>
              {apple ? (
                <ButtonLink href={links.apple} variant="outline">
                  Apple Maps
                </ButtonLink>
              ) : null}
              <ButtonLink href={links.google} variant="outline">
                Google Maps
              </ButtonLink>
            </div>
          </div>
        </>
      ) : (
        <p className={p.mapNote}>
          The map can’t be loaded right now. Please use the written directions.
        </p>
      )}
    </div>
  );
}
