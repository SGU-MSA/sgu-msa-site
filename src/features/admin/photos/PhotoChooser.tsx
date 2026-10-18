"use client";
import { useId, useRef, useState } from "react";
import { systemText } from "@/lib/system-text";
import { photoChoicesAction, type PhotoChoice } from "./photo-actions";

const words = systemText.photos;

type Shown =
  | { state: "loading" }
  | { state: "ready"; photos: PhotoChoice[] }
  | { state: "failed"; error: string };

/**
 * "Choose from uploaded photos" (photo library, 2026-10-06): a button that
 * opens the uploaded photos, newest first, each named by where it is used.
 * Clicking one hands its stored name to the photo box; nothing is uploaded
 * or copied. The list is read when the box opens.
 */
export function PhotoChooser({
  onChoose,
}: {
  onChoose: (name: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<Shown>({ state: "loading" });
  const id = useId();
  async function open() {
    setShown({ state: "loading" });
    dialog.current?.showModal();
    try {
      const read = await photoChoicesAction();
      setShown(
        read.ok
          ? { state: "ready", photos: read.photos }
          : { state: "failed", error: read.error },
      );
    } catch {
      setShown({ state: "failed", error: words.pickerFailed });
    }
  }
  return (
    <>
      <button type="button" className="button-secondary" onClick={open}>
        {words.choose}
      </button>
      <dialog
        ref={dialog}
        className="leave-dialog photo-picker"
        aria-labelledby={`${id}-title`}
      >
        <h2 id={`${id}-title`}>{words.pickerTitle}</h2>
        <p>{words.pickerIntro}</p>
        <div aria-live="polite">
          {shown.state === "loading" ? (
            <p className="muted">{words.pickerLoading}</p>
          ) : shown.state === "failed" ? (
            <p className="form-error">{shown.error}</p>
          ) : shown.photos.length ? null : (
            <p className="muted">{words.pickerEmpty}</p>
          )}
        </div>
        {shown.state === "ready" && shown.photos.length ? (
          <ul className="photo-picker-grid">
            {shown.photos.map((photo, index) => (
              <li key={photo.name}>
                <button
                  type="button"
                  onClick={() => {
                    onChoose(photo.name);
                    dialog.current?.close();
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- a stored photo, shown as it is */}
                  <img
                    src={`/admin/media/${photo.name}`}
                    alt=""
                    loading="lazy"
                  />
                  <span>{photo.label}</span>
                  <span className="sr-only">
                    {" "}
                    ({index + 1} of {shown.photos.length})
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="admin-actions">
          <button
            type="button"
            className="button-secondary"
            autoFocus
            onClick={() => dialog.current?.close()}
          >
            {words.close}
          </button>
        </div>
      </dialog>
    </>
  );
}
