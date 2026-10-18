"use client";
import { useEffect, useId, useState } from "react";
import {
  NEW_PHOTO_PREFIX,
  newPhotoBox,
  type ListedPhoto,
} from "@/lib/media/photo-list";
import { systemText } from "@/lib/system-text";
import { SortableList } from "@/shared/ui/SortableList";
import { FieldError } from "./form-check/FieldError";
import { ImageField } from "./ImageField";

const words = systemText.pages;

type Row = ListedPhoto & { key: string };

let nextKey = 0;
const newKey = () => `${Date.now().toString(36)}${(nextKey++).toString(36)}`;

/**
 * The rows of a posted (or stored) list: new photos keep their key; stored
 * ones are keyed by place, the same on the server and in the browser.
 */
function rowsOf(list: readonly ListedPhoto[]): Row[] {
  return list.map((photo, index) => ({
    ...photo,
    key: photo.src.startsWith(NEW_PHOTO_PREFIX)
      ? photo.src.slice(NEW_PHOTO_PREFIX.length)
      : `stored${index}`,
  }));
}

/** An uploaded photo through the board-only reader (it may not be public yet). */
const boardView = (src: string) =>
  src.startsWith("/media/")
    ? `/admin/media/${src.slice("/media/".length)}`
    : src;

/**
 * An ordered list of photos with descriptions (PR5c: a season page's photos,
 * a merch item's photos; D-27 c): drag to reorder (the first is the cover),
 * remove, or add a photo, which is made smaller in the browser like every
 * photo box (`ImageField`), or chosen from the uploaded ones. Posted as JSON in `name` (stored photos by their
 * address, new ones as "new:<key>" with their file in `newPhotoBox`);
 * `photoListForm` reads it on both sides. A refused save keeps the typed
 * descriptions; a new photo's file must be chosen again.
 */
export function PhotoListField({
  name,
  label,
  initial,
  max,
  example,
  onShrinking,
}: {
  name: string;
  label: string;
  initial: readonly ListedPhoto[];
  max: number;
  /** The description box's placeholder. */
  example: string;
  onShrinking: (shrinking: boolean) => void;
}) {
  const id = useId();
  const [rows, setRows] = useState(() => rowsOf(initial));
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const shrinking = (key: string) => (on: boolean) =>
    setBusy((before) => {
      if (before.has(key) === on) return before;
      const after = new Set(before);
      if (on) after.add(key);
      else after.delete(key);
      return after;
    });
  // Save waits while any new photo is being made smaller.
  const anyBusy = busy.size > 0;
  useEffect(() => onShrinking(anyBusy), [anyBusy, onShrinking]);
  const nameOf = (index: number) => `Photo ${index + 1}`;
  const update = (key: string, alt: string) =>
    setRows((before) =>
      before.map((row) => (row.key === key ? { ...row, alt } : row)),
    );
  // "Choose from uploaded photos" on a new photo: the row names that stored
  // photo instead of a file (photo library, 2026-10-06).
  const takeStored = (key: string, stored: string) => {
    shrinking(key)(false);
    setRows((before) =>
      before.map((row) =>
        row.key === key ? { ...row, src: `/media/${stored}` } : row,
      ),
    );
  };
  const posted = JSON.stringify(rows.map(({ src, alt }) => ({ src, alt })));
  return (
    <fieldset className="page-list">
      <legend>{label}</legend>
      <input type="hidden" name={name} value={posted} />
      {rows.length ? (
        <SortableList
          items={rows}
          itemKey={(row) => row.key}
          itemName={(_, index) => nameOf(index)}
          onReorder={setRows}
          label={label}
          look="cards"
        >
          {(row, index) => {
            const isNew = row.src.startsWith(NEW_PHOTO_PREFIX);
            const altId = `${id}-${row.key}-alt`;
            const box = newPhotoBox(name, row.key);
            return (
              <div className="page-list-item page-photo">
                <p className="page-list-name">
                  {nameOf(index)}
                  {index === 0 ? " · cover" : ""}
                </p>
                {isNew ? (
                  <ImageField
                    label={words.choosePhoto}
                    name={box}
                    attached={false}
                    onShrinking={shrinking(row.key)}
                    pick={{ onPick: (stored) => takeStored(row.key, stored) }}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- a stored photo, any size
                  <img
                    className="page-photo-thumb"
                    src={boardView(row.src)}
                    alt=""
                  />
                )}
                <FieldError name={`${name}.${index}.file`} controls={[box]} />
                <div className="form-field">
                  <label htmlFor={altId}>{words.describePhoto}</label>
                  <input
                    id={altId}
                    maxLength={250}
                    placeholder={example}
                    value={row.alt}
                    onChange={(event) =>
                      update(row.key, event.currentTarget.value)
                    }
                  />
                  <FieldError
                    name={`${name}.${index}.alt`}
                    controls={[altId]}
                  />
                </div>
                <div className="admin-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    aria-label={`${words.remove}: ${nameOf(index)}`}
                    onClick={() => {
                      shrinking(row.key)(false);
                      setRows((before) =>
                        before.filter((other) => other.key !== row.key),
                      );
                    }}
                  >
                    {words.remove}
                  </button>
                </div>
              </div>
            );
          }}
        </SortableList>
      ) : (
        <p className="muted">{words.emptyList}</p>
      )}
      <FieldError name={name} controls={[`${id}-add`]} />
      {rows.length < max ? (
        <div>
          <button
            id={`${id}-add`}
            type="button"
            className="button-secondary"
            disabled={anyBusy}
            onClick={() => {
              const key = newKey();
              setRows((before) => [
                ...before,
                { key, src: `${NEW_PHOTO_PREFIX}${key}`, alt: "" },
              ]);
            }}
          >
            {words.add("photo")}
          </button>
        </div>
      ) : null}
    </fieldset>
  );
}
