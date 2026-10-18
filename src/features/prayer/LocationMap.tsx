import { MusallahMap } from "./MusallahMap";
import { musallahDirections } from "@/lib/maps";

/**
 * The "Find us on campus" box with the map and directions to the board's
 * pin (PR7), on the home page, /prayer and /contact. The pin is read on the
 * server; the map and the device's buttons are drawn in the browser.
 */
export async function LocationMap() {
  const { place, links } = await musallahDirections();
  return <MusallahMap place={place} links={links} />;
}
