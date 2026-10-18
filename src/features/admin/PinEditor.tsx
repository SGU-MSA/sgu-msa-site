"use client";
import { useActionState, useState, type ReactNode } from "react";

import { saveMusallahPinAction } from "@/features/admin/actions";
import type { DirectionsLinks } from "@/lib/maps/location";
import { nearCampus, outsideCampus } from "@/lib/maps/place";
import type { Place } from "@/lib/maps/providers/contract";
import { campusNamesPath } from "@/lib/maps/style";
import { PinMap } from "@/shared/ui/PinMap";

import { CheckedForm } from "./form-check/CheckedForm";
import { initialKeptForm } from "./form-state";

/** Six decimals: about 10 cm, finer than any drag (PR7 Design). */
const rounded = (value: number) => Number(value.toFixed(6));

/**
 * The "Musallah location" section of Prayer & iqamah (PR7 D-4, D-5): drag
 * the dot (or move it with the arrow keys) and save. Its own form, version
 * and Save, never the prayer form's. A dot dropped further than about
 * 1.5 km from the SGU campus (review fixes P4) jumps back with a plain
 * line, and nothing is posted. The "Try … directions"
 * links use the saved pin.
 */
export function PinEditor({
  pin,
  version,
  links,
  appearsOn,
}: {
  /** The saved pin. */
  pin: Place;
  version: string;
  /** Directions to the saved pin. */
  links: DirectionsLinks;
  /** "Appears on …" (`AppearsOn`), drawn by the page under the heading. */
  appearsOn?: ReactNode;
}) {
  const [state, action, pending] = useActionState(
    saveMusallahPinAction,
    initialKeptForm,
  );
  const [place, setPlace] = useState<Place>(pin);
  const [outside, setOutside] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  const move = (next: Place) => {
    if (!nearCampus(next)) {
      setOutside(true);
      return false;
    }
    setOutside(false);
    setPlace({
      latitude: rounded(next.latitude),
      longitude: rounded(next.longitude),
    });
  };

  return (
    <section
      id="musallah-location"
      className="content-card pin-editor"
      aria-labelledby="musallah-location-heading"
      data-tour="prayer-location"
    >
      <h2 id="musallah-location-heading">Musallah location</h2>
      {appearsOn}
      <p>
        Drag the dot to the musallah entrance. This one pin is used for the map
        on the website, the Apple Maps and Google Maps directions, and the
        prayer start times. On a keyboard: click the dot, then use the arrow
        keys.
      </p>
      <div className="pin-editor-map">
        {mapFailed ? (
          <p role="alert" className="form-error">
            The map can’t be shown right now.
          </p>
        ) : (
          <PinMap
            center={place}
            label="SGU Musallah"
            draggable
            onMove={move}
            onUnavailable={() => setMapFailed(true)}
            names={campusNamesPath}
            dotLabel="Musallah pin. Use the arrow keys to move it."
            movedMessage="Pin moved, not saved yet."
          />
        )}
      </div>
      {outside ? (
        <p role="alert" className="form-error">
          {outsideCampus}
        </p>
      ) : null}
      <p className="pin-editor-links">
        <a
          className="text-link"
          href={links.google}
          target="_blank"
          rel="noopener noreferrer"
        >
          Try Google Maps directions ↗
        </a>
        <a
          className="text-link"
          href={links.apple}
          target="_blank"
          rel="noopener noreferrer"
        >
          Try Apple Maps directions ↗
        </a>
      </p>
      {/* The pin has no box: a refusal is written above Save (CheckedForm). */}
      <CheckedForm action={action} state={state} className="editor-form">
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="latitude" value={place.latitude} />
        <input type="hidden" name="longitude" value={place.longitude} />
        <div>
          <button
            className="button-primary"
            disabled={pending}
            data-tour="prayer-location-save"
          >
            {pending ? "Saving…" : "Save location"}
          </button>
        </div>
      </CheckedForm>
    </section>
  );
}
