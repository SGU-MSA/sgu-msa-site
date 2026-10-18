"use client";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import {
  isHeic,
  keepShrunk,
  MAX_NEW_PHOTOS_PER_SAVE,
  newPhotosProblem,
  shrinkScale,
  shrinkTypeFor,
  UPLOAD_IMAGE_TYPES,
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_LABEL,
} from "@/lib/media/photo-limits";
import { systemText } from "@/lib/system-text";
import { heicCannotOpen } from "./fields";
import { PhotoChooser } from "./photos/PhotoChooser";

// Only real problems get a line; shrinking itself is silent (Q92, Q93,
// 2026-10-05: no size line, no hint).
const cannotShrink = `This photo could not be made smaller on this device. If it is over ${UPLOAD_MAX_LABEL}, take a screenshot of it or share it as JPEG.`;
const tooManyPhotos = systemText.pages.tooManyPhotos(MAX_NEW_PHOTOS_PER_SAVE);

/** The file name for a shrunk copy: the same name with the new type's ending. */
function renamed(name: string, type: string) {
  const ending =
    type === "image/webp" ? ".webp" : type === "image/png" ? ".png" : ".jpg";
  return name.replace(/\.[^./]*$/, "") + ending;
}

/**
 * A copy of the photo at most `PHOTO_MAX_SIDE` on its longest side, turned
 * upright, or null when this browser cannot read the file (for example HEIC
 * on Android and desktop Chrome, which then shows `heicCannotOpen`). The
 * server still checks and converts it.
 */
async function shrinkPhoto(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const canvas = document.createElement("canvas");
    try {
      const scale = shrinkScale(bitmap.width, bitmap.height);
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    } finally {
      // The full-size decoded photo can take 50-200 MB on a phone: free it
      // as soon as the smaller copy is drawn, or on any failure.
      bitmap.close();
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, shrinkTypeFor(file.type), 0.85),
    );
    return blob
      ? new File([blob], renamed(file.name, blob.type), { type: blob.type })
      : null;
  } catch {
    return null;
  }
}

/** Puts `file` in the input in place of the chosen one; false when the browser can't. */
function replaceChosen(input: HTMLInputElement, file: File) {
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    return input.files?.[0]?.size === file.size;
  } catch {
    return false;
  }
}

/**
 * The board's image upload field, the only one (PR5 D-4). A chosen photo is
 * made smaller in the browser before upload (`photo-limits.ts`), silently;
 * while that runs, `onShrinking(true)` lets the form disable its Save. The
 * server still stores it with `contentEditor().upload("image", …)` after
 * `normalizeUpload`, which checks the same limits.
 *
 * "Choose from uploaded photos" (photo library, 2026-10-06) reuses a stored
 * photo instead: its name goes to the form in the hidden `pick.field` (in
 * place of `pick.value`, the stored one), or to `pick.onPick`, which returns
 * how to put the box back; choosing a file afterwards, or Undo, drops it.
 */
export function ImageField({
  label,
  name = "image",
  attached,
  onChoose,
  onShrinking,
  pick = {},
}: {
  label: string;
  /** The form field's name: "image" for a content item; page text names each photo box (PR5b). */
  name?: string;
  /** An image is already stored for this item. */
  attached: boolean;
  /** Called with whether a file is now chosen. */
  onChoose?: (chosen: boolean) => void;
  /** Called with true while the chosen photo is being made smaller, then false. */
  onShrinking: (shrinking: boolean) => void;
  /** Where a photo chosen from the uploaded ones goes (null: dropped again). */
  pick?: {
    /** The hidden form field that posts its stored name. */
    field?: string;
    /** That field's value while none is chosen (the stored photo's name). */
    value?: string;
    /** Uses the photo; returns what puts the box back as it was (Undo). */
    onPick?: (name: string) => (() => void) | void;
  };
}) {
  const input = useRef<HTMLInputElement>(null);
  const lineId = useId();
  const [line, setLine] = useState<string | null>(null);
  // The latest choice; an older shrink that finishes late is ignored.
  const choice = useRef(0);
  const busy = useRef(false);
  // A HEIC photo this browser cannot open: the save stops (D-29).
  const heic = useRef(false);
  // A photo chosen from the uploaded ones (its stored name).
  const [picked, setPicked] = useState<string | null>(null);
  const undoPick = useRef<(() => void) | null>(null);
  const choosePicked = (next: string | null) => {
    if (next) {
      const undo = pick.onPick?.(next);
      // Undo goes back to the box before the first photo was chosen.
      undoPick.current ??= undo || null;
    } else {
      undoPick.current?.();
      undoPick.current = null;
    }
    setPicked(next);
  };

  // Before the form is sent: wait for the shrinking, then check the new
  // files against the limits (the server checks each file again).
  useEffect(() => {
    const own = input.current;
    const form = own?.form;
    if (!own || !form) return;
    const stop = (event: SubmitEvent, text: string) => {
      event.preventDefault();
      setLine(text);
      own.focus();
    };
    const guard = (event: SubmitEvent) => {
      // Save is disabled while shrinking; this also stops any other way of
      // sending the form, quietly.
      if (busy.current) return event.preventDefault();
      // The server never accepts HEIC: stop before anything is uploaded.
      if (heic.current) return stop(event, heicCannotOpen);
      // Photo boxes only: a PDF box in the same form is checked by the
      // server alone, so the photo wording never describes a PDF.
      const files = [
        ...form.querySelectorAll<HTMLInputElement>(
          'input[type="file"][data-shrinks]',
        ),
      ];
      // One check per form: the first photo box does it.
      if (files[0] !== own) return;
      const problem = newPhotosProblem(
        files.flatMap((field) =>
          [...(field.files ?? [])].map((file) => file.size),
        ),
      );
      if (problem)
        stop(event, problem === "too_big" ? cannotShrink : tooManyPhotos);
    };
    form.addEventListener("submit", guard);
    return () => form.removeEventListener("submit", guard);
  }, []);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const field = event.currentTarget;
    const file = field.files?.[0];
    onChoose?.(Boolean(file));
    // A new file replaces a photo chosen from the uploaded ones.
    if (file && picked) choosePicked(null);
    const current = ++choice.current;
    busy.current = Boolean(file);
    heic.current = false;
    onShrinking(busy.current);
    setLine(null);
    if (!file) return;
    const shrunk = await shrinkPhoto(file);
    if (current !== choice.current) return;
    busy.current = false;
    onShrinking(false);
    const replaced =
      shrunk && keepShrunk(file, shrunk) && replaceChosen(field, shrunk);
    if (!replaced && isHeic(file)) {
      heic.current = true;
      setLine(heicCannotOpen);
    } else if (!replaced && (!shrunk || file.size > UPLOAD_MAX_BYTES))
      setLine(cannotShrink);
  }

  /** Uses an uploaded photo: any chosen file and its line are dropped. */
  function reuse(stored: string) {
    if (input.current) input.current.value = "";
    ++choice.current;
    busy.current = false;
    heic.current = false;
    onShrinking(false);
    onChoose?.(false);
    setLine(null);
    choosePicked(stored);
  }

  return (
    <div className="form-field">
      <label>
        {label}
        <input
          ref={input}
          name={name}
          type="file"
          accept={UPLOAD_IMAGE_TYPES.join(",")}
          data-shrinks="true"
          aria-describedby={lineId}
          onChange={choose}
        />
        <span className="muted">
          JPEG, PNG, or WebP; maximum {UPLOAD_MAX_LABEL}.{" "}
          {attached ? "An image is attached; choose a file to replace it." : ""}
        </span>
      </label>
      {/* Always present, so screen readers announce the line when it appears. */}
      <div id={lineId} aria-live="polite">
        {line ? <p className="form-error">{line}</p> : null}
      </div>
      <div className="photo-choose">
        <PhotoChooser onChoose={reuse} />
        <div aria-live="polite">
          {picked ? (
            <div className="photo-chosen">
              {/* eslint-disable-next-line @next/next/no-img-element -- a stored photo, shown as it is */}
              <img src={`/admin/media/${picked}`} alt="" />
              <span className="photo-chosen-line">
                <span>{systemText.photos.chosen}</span>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => choosePicked(null)}
                >
                  {systemText.photos.undo}
                </button>
              </span>
            </div>
          ) : null}
        </div>
      </div>
      {pick.field ? (
        <input
          type="hidden"
          name={pick.field}
          value={picked ?? pick.value ?? ""}
        />
      ) : null}
    </div>
  );
}
