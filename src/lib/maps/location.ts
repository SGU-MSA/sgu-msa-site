import type { Place } from "./providers/contract";

/** Walking directions to one point (PR7 D-7, D-8: the pin only, no Google place link). */
export type DirectionsLinks = {
  /** Google Maps directions; opens the app where installed, the website elsewhere. */
  google: string;
  /** Apple Maps unified directions URL (E-5); shown on Apple devices only. */
  apple: string;
};

/**
 * Pure URL building for one point. Coordinates come validated from the
 * places port and are never inferred; which buttons a device shows is
 * `isAppleDevice` (`./device`).
 */
export function directionsLinks(point: Place): DirectionsLinks {
  const destination = `${point.latitude},${point.longitude}`;
  const google = new URL("https://www.google.com/maps/dir/");
  google.search = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "walking",
  }).toString();
  const apple = new URL("https://maps.apple.com/directions");
  apple.search = new URLSearchParams({
    destination,
    mode: "walking",
  }).toString();
  return { google: google.href, apple: apple.href };
}
