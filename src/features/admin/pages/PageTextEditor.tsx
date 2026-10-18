"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  pageFields,
  pageSectionTitle,
  sectionOfPath,
  type PageField,
  type PageSection,
  type PageTextKey,
} from "@/lib/content/page-fields";
import {
  bandIds,
  hiddenSections,
  isLayoutKey,
  layoutOwner,
  pageLayouts,
  pagesShowing,
  sharedTexts,
  storedSections,
  type PageLayout,
  type ShownSection,
} from "@/lib/content/page-layouts";
import type { ListName } from "@/lib/community/lists";
import { iconNameSchema } from "@/lib/content/schemas";
import { systemText } from "@/lib/system-text";
import { SortableList } from "@/shared/ui/SortableList";
import { CheckedForm } from "../form-check/CheckedForm";
import { FieldError } from "../form-check/FieldError";
import { noProblems } from "../form-check/problems";
import { initialKeptForm } from "../form-state";
import { ImageField } from "../ImageField";
import {
  chosenPhotos,
  documentField,
  pageTextsForm,
  photoBox,
  textOfPath,
  textPath,
  versionField,
  type PageTexts,
} from "./page-form";
import { EditorPreview } from "../preview/EditorPreview";
import { savePageTextAction } from "./page-actions";
import { VerseChooser } from "./VerseChooser";
import type { PreviewLive } from "./preview-live";
import {
  hasPagePreview,
  PagePreview,
  type OtherPagePreview,
  type PreviewSlots,
} from "./previews";
import { pageScreenPath } from "./pages-list";

/** A page text whose sections a page shows, as stored with every box, and its version. */
export type SharedText = {
  key: PageTextKey;
  document: unknown;
  version: string;
};

const pageEditorWords = systemText.pages;
const sectionWords = systemText.pageSections;

type Json = unknown;
type Segment = string | number;
type JsonObject = Record<string, Json>;

const isObject = (value: Json): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A dotted field path as segments ("" is the item itself). */
const segments = (path: string): Segment[] => (path ? path.split(".") : []);

function getIn(root: Json, at: readonly Segment[]): Json {
  let value = root;
  for (const segment of at) {
    if (Array.isArray(value) && typeof segment === "number")
      value = value[segment];
    else if (isObject(value)) value = value[String(segment)];
    else return undefined;
  }
  return value;
}

/**
 * Each list item keeps one React key for its whole life (moved, edited), so
 * a photo chosen in an item stays with that item when it moves. Copies made
 * while editing carry the key over.
 */
const itemKeys = new WeakMap<object, string>();
let nextKey = 0;
const keyOf = (item: Json, fallback: number) => {
  if (typeof item !== "object" || item === null) return `value-${fallback}`;
  let key = itemKeys.get(item);
  if (!key) itemKeys.set(item, (key = `item-${nextKey++}`));
  return key;
};
const carryKey = <T extends object>(from: Json, to: T): T => {
  if (typeof from === "object" && from !== null) {
    const key = itemKeys.get(from);
    if (key) itemKeys.set(to, key);
  }
  return to;
};

function setIn(root: Json, at: readonly Segment[], value: Json): Json {
  if (!at.length) return carryKey(root, value as object) ?? value;
  const [head, ...rest] = at;
  if (Array.isArray(root) && typeof head === "number") {
    const copy = [...root];
    copy[head] = setIn(root[head], rest, value);
    return carryKey(root, copy);
  }
  const object = isObject(root) ? root : {};
  return carryKey(root, {
    ...object,
    [String(head)]: setIn(object[String(head)], rest, value),
  });
}

/** A new, empty list item: every box of the item empty. */
function emptyItem(field: Extract<PageField, { kind: "list" }>): Json {
  if (field.item.length === 1 && field.item[0].path === "")
    return { src: "", alt: "", historical: false };
  let item: Json = {
    // The server gives a new item its own id (PR5b).
    id: `new-${Date.now().toString(36)}-${(nextKey++).toString(36)}`,
  };
  for (const part of field.item)
    item = setIn(
      item,
      segments(part.path),
      part.kind === "list" ||
        part.kind === "lines" ||
        part.kind === "paragraphs"
        ? []
        : part.kind === "yesno"
          ? false
          : part.kind === "image"
            ? null
            : "",
    );
  return item;
}

/** A box's id: by its path, after its page text's key when that is a shared one. */
const domId = (at: readonly Segment[], owner = "") =>
  `page-${owner ? `${owner}-` : ""}${at.join("-") || "root"}`;
const asText = (value: Json) =>
  typeof value === "string"
    ? value
    : value === null || value === undefined
      ? ""
      : String(value);

/** The words around one box: its label, "(optional)" when it may stay empty. */
const labelOf = (field: PageField) =>
  field.required || field.kind === "yesno" || field.kind === "entries"
    ? field.label
    : `${field.label} ${pageEditorWords.optional}`;

/**
 * The Pages editor (PR5b, D-6, D-22): one form for every page's text, drawn
 * from its field list (`pageFields`). A page with sections is a list of them
 * (review 3 B): the top first, then each section with "Show this section on
 * the page", a drag handle and Edit, which opens its boxes here, or the
 * screen whose content it shows. A section whose words are another page
 * text's (Jumu'ah and Musallah directions on Prayer & Musallah) opens its
 * boxes here too: that text comes along (`shared`), its words still stored
 * once, and **Save page** saves it with the page when it changed
 * (dashboard polish, 2026-10-06). Each document is posted as one JSON value
 * (the sections' order and shown state in `sections`); photos are posted
 * beside it, one file box per photo (`photoBox`). A refused save shows what
 * was typed again and opens the sections that need fixing.
 */
export function PageTextEditor({
  pageKey,
  document: stored,
  version,
  formKeys,
  listChoices = {},
  live,
  slots = {},
  hiddenElsewhere = [],
  openSection = null,
  saveLabel = pageEditorWords.save,
  shared = [],
  otherPreviews = [],
}: {
  pageKey: PageTextKey;
  /** The stored text with every box present (`withEveryField`). */
  document: Json;
  version: string;
  /** The sign-up forms a "Sign-up form" box offers, by key and name. */
  formKeys: readonly (readonly [key: string, label: string])[];
  /** The Lists' options a list box offers, by slug and name (review fixes P3). */
  listChoices?: Partial<
    Record<ListName, readonly (readonly [slug: string, name: string])[]>
  >;
  /** What the page shows besides this text, for Preview (WP4). */
  live: PreviewLive;
  /** The parts of the page only the server draws, for Preview. */
  slots?: PreviewSlots;
  /** This document's sections another page hides (`hiddenSections`). */
  hiddenElsewhere?: readonly string[];
  /** A section to open at first (Edit on the page that shows it). */
  openSection?: string | null;
  /** The save button's name ("Save page" unless the screen has its own). */
  saveLabel?: string;
  /** The other page texts whose sections the page shows (`sharedTexts`), as stored with every box. */
  shared?: readonly SharedText[];
  /**
   * The other pages that show words edited here (`previewPages`), for the
   * Preview's page switcher (shared text, option A, 2026-10-06).
   */
  otherPreviews?: readonly OtherPagePreview[];
}) {
  const [state, action, pending] = useActionState(
    savePageTextAction,
    initialKeptForm,
  );
  // The fixed verse library, for the "verse" boxes (only "Verse on each page" has them).
  const library = live.key === "reminder-places" ? live.data.verses : [];
  // What a refused save posted, else the stored text.
  const typedOr = (owner: PageTextKey, fallback: Json): Json => {
    const typed = state.values?.[documentField(owner, pageKey)];
    if (!typed) return fallback;
    try {
      return JSON.parse(typed) as Json;
    } catch {
      return fallback;
    }
  };
  const [document, setDocument] = useState<Json>(() =>
    typedOr(pageKey, stored),
  );
  const [sharedDocs, setSharedDocs] = useState<PageTexts>(() =>
    Object.fromEntries(
      shared.map((text) => [text.key, typedOr(text.key, text.document)]),
    ),
  );
  const texts = [pageKey, ...sharedTexts(pageKey)];
  const storedTexts: PageTexts = {
    [pageKey]: stored,
    ...Object.fromEntries(shared.map((text) => [text.key, text.document])),
  };
  const docOf = (owner: PageTextKey) =>
    owner === pageKey ? document : sharedDocs[owner];
  // Save waits, quietly disabled, while a chosen photo is made smaller.
  const shrinking = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  const shrinkingIn = (id: string) => (on: boolean) => {
    if (on) shrinking.current.add(id);
    else shrinking.current.delete(id);
    setBusy(shrinking.current.size > 0);
  };
  // The save rules of the page and the texts it shows (`pageTextsForm`), as you type.
  const check = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const posted: PageTexts = {};
    try {
      for (const owner of texts)
        posted[owner] = JSON.parse(
          String(data.get(documentField(owner, pageKey))),
        );
    } catch {
      return noProblems;
    }
    const result = pageTextsForm(
      pageKey,
      storedTexts,
      posted,
      (owner) => chosenPhotos(data, pageKey, owner).map((photo) => photo.path),
      hiddenElsewhere,
    );
    return result.ok || !("fields" in result) ? noProblems : result.fields;
  };
  // The page's own sections, and this document's sections another page shows.
  const layoutKey = isLayoutKey(pageKey) ? pageKey : null;
  const layout: PageLayout | null = layoutKey ? pageLayouts[layoutKey] : null;
  /** The row a section's boxes are drawn in: a section drawn inside another (`with`) opens with it. */
  const rowOf = (id: string) =>
    layout?.sections.find((entry) => entry.with?.includes(id))?.id ?? id;
  /** The row a problem's box is in (`textPath` keys name a shared text). */
  const sectionOfKey = (key: string) => {
    const { owner, path } = textOfPath(pageKey, key);
    const id = sectionOfPath(owner, path);
    return id ? rowOf(id) : id;
  };

  const { sections } = pageFields[pageKey];
  // The sections whose boxes are open, and the one opened last (the
  // Preview scrolls to it). One section is always open.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => {
    const first = new Set<string>();
    if (sections.length === 1) first.add(sections[0].id);
    if (
      openSection &&
      (sections.some(({ id }) => id === openSection) ||
        shared.some(({ key }) =>
          pageFields[key].sections.some(({ id }) => id === openSection),
        ))
    )
      first.add(rowOf(openSection));
    for (const key of Object.keys(state.fields ?? {})) {
      const id = sectionOfKey(key);
      if (id) first.add(id);
    }
    return first;
  });
  const [editing, setEditing] = useState<string | null>(
    openSection && rowOf(openSection),
  );
  // The page Preview shows: this one, or another that shows its shared words.
  const [previewing, setPreviewing] = useState<PageTextKey>(pageKey);
  // The sections with a problem on screen ("Needs fixing"); a closed one
  // opens, and the first wrong box takes the focus (`CheckedForm` focused it
  // while it was folded away).
  const [wrong, setWrong] = useState<ReadonlySet<string>>(new Set());
  const [reveal, setReveal] = useState(0);
  const formArea = useRef<HTMLDivElement>(null);
  const onProblems = (keys: readonly string[]) => {
    const ids = new Set(
      keys.map(sectionOfKey).filter((id): id is string => Boolean(id)),
    );
    setWrong(ids);
    if ([...ids].some((id) => !open.has(id))) {
      setOpen((before) => new Set([...before, ...ids]));
      setReveal((count) => count + 1);
    }
  };
  useEffect(() => {
    if (!reveal) return;
    const active = globalThis.document.activeElement;
    if (active?.getAttribute("aria-invalid") === "true") return;
    formArea.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [reveal]);
  const toggle = (id: string) => {
    const opening = !open.has(id);
    setOpen((before) => {
      const after = new Set(before);
      if (opening) after.add(id);
      else after.delete(id);
      return after;
    });
    if (opening) setEditing(id);
  };

  const update = (
    at: readonly Segment[],
    value: Json,
    owner: PageTextKey = pageKey,
  ) => {
    if (owner === pageKey)
      setDocument((current: Json) => setIn(current, at, value));
    else
      setSharedDocs((current) => ({
        ...current,
        [owner]: setIn(current[owner], at, value),
      }));
  };

  /**
   * One box of the field list at `at` in a page text (`owner`: the page's
   * own, or a shared one); `inPhotoList`: a photo inside a photo list
   * (removed with Remove).
   */
  function box(
    field: PageField,
    at: readonly Segment[],
    inPhotoList = false,
    owner: PageTextKey = pageKey,
  ): React.ReactNode {
    const id = domId(at, owner === pageKey ? "" : owner);
    const value = getIn(docOf(owner), at);
    const boxKey = textPath(owner, pageKey, at.join("."));
    const put = (next: Json) => update(at, next, owner);
    const hintId = field.hint ? `${id}-hint` : undefined;
    const hint = field.hint ? (
      <span id={hintId} className="muted">
        {field.hint}
      </span>
    ) : null;
    const common = {
      id,
      "aria-describedby": hintId,
      placeholder: field.example,
    };
    // The box's problem, by its path (`pageTextsForm`).
    const problem = <FieldError name={boxKey} controls={[id]} />;
    switch (field.kind) {
      case "line":
      case "link":
      case "email":
      case "google-form":
        return (
          <div className="form-field" key={id}>
            <label htmlFor={id}>{labelOf(field)}</label>
            <input
              {...common}
              inputMode={
                field.kind === "email"
                  ? "email"
                  : field.kind === "line"
                    ? undefined
                    : "url"
              }
              maxLength={field.kind === "line" ? (field.max ?? 160) : 500}
              value={asText(value)}
              onChange={(event) => put(event.currentTarget.value)}
            />
            {problem}
            {hint}
          </div>
        );
      case "text":
        return (
          <div className="form-field" key={id}>
            <label htmlFor={id}>{labelOf(field)}</label>
            <textarea
              {...common}
              rows={field.rows ?? 3}
              maxLength={field.max ?? 2000}
              value={asText(value)}
              onChange={(event) => put(event.currentTarget.value)}
            />
            {problem}
            {hint}
          </div>
        );
      case "paragraphs":
      case "lines": {
        const joiner = field.kind === "paragraphs" ? "\n\n" : "\n";
        const splitter = field.kind === "paragraphs" ? /\n[^\S\n]*\n/ : /\n/;
        return (
          <div className="form-field" key={id}>
            <label htmlFor={id}>{labelOf(field)}</label>
            <textarea
              {...common}
              rows={field.kind === "paragraphs" ? 6 : 8}
              value={(Array.isArray(value) ? value : [])
                .map(asText)
                .join(joiner)}
              onChange={(event) =>
                put(event.currentTarget.value.split(splitter))
              }
            />
            {problem}
            {hint}
          </div>
        );
      }
      case "yesno":
        return (
          <div className="form-field" key={id}>
            <label className="check-label">
              <input
                type="checkbox"
                id={id}
                aria-describedby={hintId}
                checked={value === true}
                onChange={(event) => put(event.currentTarget.checked)}
              />
              {field.label}
            </label>
            {hint}
          </div>
        );
      case "verse":
        return (
          <VerseChooser
            key={id}
            id={id}
            label={labelOf(field)}
            value={asText(value)}
            library={library}
            onChange={(reference) => put(reference)}
            after={
              <>
                {problem}
                {hint}
              </>
            }
          />
        );
      case "icon":
      case "form":
      case "list-option":
      case "choice": {
        const options: readonly (readonly [string, string])[] =
          field.kind === "icon"
            ? iconNameSchema.options.map((name) => [name, name] as const)
            : field.kind === "form"
              ? formKeys
              : field.kind === "list-option"
                ? (listChoices[field.list] ?? [])
                : field.options;
        const current = asText(value);
        // A stored choice that is no longer offered stays visible, named as such.
        const missing =
          current && !options.some(([option]) => option === current);
        return (
          <div className="form-field" key={id}>
            <label htmlFor={id}>{labelOf(field)}</label>
            <select
              id={id}
              aria-describedby={hintId}
              value={current}
              onChange={(event) => put(event.currentTarget.value)}
            >
              {field.required && current ? null : (
                <option value="">{pageEditorWords.choose}</option>
              )}
              {missing ? (
                <option value={current}>
                  {pageEditorWords.notOffered(current)}
                </option>
              ) : null}
              {options.map(([option, label]) => (
                <option key={option} value={option}>
                  {label}
                </option>
              ))}
            </select>
            {problem}
            {hint}
          </div>
        );
      }
      case "image": {
        const photo = isObject(value) ? value : null;
        const src = asText(photo?.src);
        const setPhoto = (key: string, next: Json) =>
          put({
            ...(photo ?? { src: "", alt: "", historical: false }),
            [key]: next,
          });
        return (
          <fieldset key={id} className="page-photo">
            <legend>{labelOf(field)}</legend>
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element -- a stored photo, any size
              <img
                className="page-photo-thumb"
                // An uploaded photo through the board's own address: it may
                // not be on the website yet (photo library).
                src={src.startsWith("/media/") ? `/admin${src}` : src}
                alt=""
              />
            ) : null}
            <ImageField
              label={
                src ? pageEditorWords.replacePhoto : pageEditorWords.choosePhoto
              }
              name={photoBox(owner, pageKey, at.join("."))}
              attached={Boolean(src)}
              onShrinking={shrinkingIn(id)}
              // A photo chosen from the uploaded ones (photo library): the
              // box names it; Undo puts the box back.
              pick={{
                onPick: (stored) => {
                  put({
                    ...(photo ?? { src: "", alt: "", historical: false }),
                    src: `/media/${stored}`,
                  });
                  return () => put(value);
                },
              }}
            />
            <div className="form-field">
              <label htmlFor={`${id}-alt`}>
                {pageEditorWords.describePhoto}
              </label>
              <input
                id={`${id}-alt`}
                maxLength={250}
                placeholder={field.example}
                value={asText(photo?.alt)}
                onChange={(event) => setPhoto("alt", event.currentTarget.value)}
              />
            </div>
            <FieldError
              name={boxKey}
              controls={[photoBox(owner, pageKey, at.join(".")), `${id}-alt`]}
            />
            <label className="check-label">
              <input
                type="checkbox"
                checked={photo?.historical === true}
                onChange={(event) =>
                  setPhoto("historical", event.currentTarget.checked)
                }
              />
              {pageEditorWords.oldPhoto}
            </label>
            {src && !field.required && !inPhotoList ? (
              <button
                type="button"
                className="button-secondary"
                onClick={() => put(null)}
              >
                {pageEditorWords.removePhoto}
              </button>
            ) : null}
          </fieldset>
        );
      }
      case "list": {
        const items = Array.isArray(value) ? value : [];
        const photosOnly = field.item.length === 1 && field.item[0].path === "";
        const nameOf = (index: number) => `${field.itemName} ${index + 1}`;
        return (
          <fieldset key={id} className="page-list">
            <legend>{labelOf(field)}</legend>
            {items.length ? (
              <SortableList
                items={items}
                itemKey={(item) => keyOf(item, items.indexOf(item))}
                itemName={(_, index) => nameOf(index)}
                onReorder={(next) => put(next)}
                label={field.label}
                look="cards"
              >
                {(item, index) => {
                  const name = nameOf(index);
                  return (
                    <div className="page-list-item">
                      <p className="page-list-name">{name}</p>
                      {photosOnly
                        ? box(
                            { ...field.item[0], label: name },
                            [...at, index],
                            true,
                            owner,
                          )
                        : field.item.map((part) =>
                            box(
                              part,
                              [...at, index, ...segments(part.path)],
                              false,
                              owner,
                            ),
                          )}
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="button-secondary"
                          aria-label={`${pageEditorWords.remove}: ${name}`}
                          onClick={() =>
                            put(items.filter((_, other) => other !== index))
                          }
                        >
                          {pageEditorWords.remove}
                        </button>
                      </div>
                    </div>
                  );
                }}
              </SortableList>
            ) : (
              <p className="muted">{pageEditorWords.emptyList}</p>
            )}
            <FieldError name={boxKey} controls={[`${id}-add`]} />
            {items.length < field.maxItems ? (
              <div>
                <button
                  id={`${id}-add`}
                  type="button"
                  className="button-secondary"
                  onClick={() => put([...items, emptyItem(field)])}
                >
                  {pageEditorWords.add(field.itemName)}
                </button>
              </div>
            ) : null}
          </fieldset>
        );
      }
      case "entries": {
        const entries = isObject(value) ? Object.keys(value) : [];
        return (
          <div key={id} className="page-entries">
            {entries.map((key) => {
              const entry = (value as JsonObject)[key];
              const name = asText(isObject(entry) ? entry.label : "") || key;
              return (
                <fieldset key={key} className="page-entry">
                  <legend>{name}</legend>
                  {field.where[key] ? (
                    <p className="muted">
                      {pageEditorWords.shownOn(field.where[key])}
                    </p>
                  ) : null}
                  {field.item.map((part) =>
                    box(
                      part,
                      [...at, key, ...segments(part.path)],
                      false,
                      owner,
                    ),
                  )}
                </fieldset>
              );
            })}
          </div>
        );
      }
    }
  }

  const shownState: readonly ShownSection[] = layout
    ? storedSections(document)
    : [];
  // The band sections (About's Contact) are last and never dragged (review fixes P3).
  const bandSet = new Set(layoutKey ? bandIds(layoutKey) : []);
  const moved = shownState.filter((entry) => !bandSet.has(entry.id));
  const bands = shownState.filter((entry) => bandSet.has(entry.id));
  const hidden = new Set([
    ...hiddenSections(pageKey, document),
    ...hiddenElsewhere,
  ]);
  const ownSection = (id: string) =>
    sections.find((section) => section.id === id);
  const setSections = (next: readonly ShownSection[]) =>
    update(["sections"], next as Json);

  /**
   * A section's boxes, of the page's text or a shared one, folded away until
   * Edit opens its row (kept in the form).
   */
  const boxes = (
    section: PageSection,
    owner: PageTextKey = pageKey,
    row = section.id,
  ) => (
    <div
      key={section.id}
      id={`page-section-${section.id}`}
      className="page-section-boxes"
      hidden={!open.has(row)}
    >
      {section.note ? <p className="muted">{section.note}</p> : null}
      {section.fields.map((field) =>
        box(field, segments(field.path), false, owner),
      )}
    </div>
  );
  /** Edit: opens the section's boxes here (and those drawn inside it, `inside`). */
  const editButton = (
    section: PageSection,
    title = section.title,
    inside: readonly string[] = [],
  ) => (
    <button
      type="button"
      className="button-secondary"
      aria-expanded={open.has(section.id)}
      aria-controls={[section.id, ...inside]
        .map((id) => `page-section-${id}`)
        .join(" ")}
      onClick={() => toggle(section.id)}
    >
      {open.has(section.id) ? sectionWords.close : sectionWords.edit}
      <span className="sr-only"> {title}</span>
    </button>
  );
  /**
   * The other pages that show the words of these sections of `owner`
   * (shared text, option A): "Shared · also on …", or nothing.
   */
  const sharedBadge = (owner: PageTextKey, ids: readonly string[]) => {
    const others = [
      ...new Set(ids.flatMap((id) => pagesShowing(owner, id))),
    ].filter((page) => page !== pageKey);
    return others.length ? (
      <span className="admin-badge page-section-shared">
        {sectionWords.shared(others.map((page) => pageFields[page].title))}
      </span>
    ) : null;
  };
  const badges = (
    id: string,
    isHidden: boolean,
    shared: React.ReactNode = null,
  ) => (
    <>
      {shared}
      {isHidden ? (
        <span className="admin-badge">{sectionWords.hidden}</span>
      ) : null}
      {wrong.has(id) ? (
        <span className="admin-badge page-section-wrong">
          {sectionWords.needsFixing}
        </span>
      ) : null}
    </>
  );

  /**
   * A row for a section that is not moved here: of this document, or of a
   * shared one the page draws inside its own parts (`owner`, `inside`).
   */
  const fixedRow = (
    section: PageSection,
    note: React.ReactNode,
    owner: PageTextKey = pageKey,
  ) => (
    <section
      key={`${owner}-${section.id}`}
      className="page-section-row"
      aria-labelledby={`page-section-${section.id}-title`}
    >
      <div className="page-section-head">
        <div className="page-section-name">
          <h2
            id={`page-section-${section.id}-title`}
            className="page-section-title"
          >
            {section.title}
          </h2>
          <p className="admin-badges">
            {badges(
              section.id,
              owner === pageKey && hidden.has(section.id),
              owner === pageKey ? null : sharedBadge(owner, [section.id]),
            )}
          </p>
        </div>
        {note}
        <div className="page-section-controls">{editButton(section)}</div>
      </div>
      {boxes(section, owner)}
    </section>
  );

  /** The note under a section another page shows, with a link there. */
  const elsewhere = (id: string) => {
    const owner = layoutOwner(pageKey, id);
    if (!owner) return null;
    const page = pageFields[owner].title;
    return (
      <p className="muted page-section-note">
        {sectionWords.onPage(page, !hidden.has(id))}{" "}
        <Link
          className="text-link"
          href={`${pageScreenPath(owner)}?section=${encodeURIComponent(id)}`}
        >
          {sectionWords.moveThere(page)}
        </Link>
      </p>
    );
  };

  /** One section of this page in the dragged list. */
  const layoutRow = (entry: ShownSection, index: number) => {
    const info = layout?.sections.find((section) => section.id === entry.id);
    if (!info || !layoutKey) return null;
    const source = info.source;
    // The page text whose boxes this section is: the page's own or a shared one.
    const owner = source.from === "text" ? source.key : null;
    const own = owner
      ? pageFields[owner].sections.find((section) => section.id === entry.id)
      : undefined;
    // Sections of the same text drawn inside this one (`with`).
    const inside = owner
      ? (info.with ?? []).flatMap((id) =>
          pageFields[owner].sections.filter((section) => section.id === id),
        )
      : [];
    const title = pageSectionTitle(layoutKey, entry.id);
    const switchId = `page-section-${entry.id}-shown`;
    const note = [
      info.band ? sectionWords.band : null,
      source.from === "screen"
        ? sectionWords.fromScreen(source.screen)
        : source.from === "fixed"
          ? sectionWords.fixed
          : null,
    ]
      .filter(Boolean)
      .join(" ");
    const href = source.from === "screen" ? source.href : null;
    return (
      <section aria-labelledby={`page-section-${entry.id}-title`}>
        <div className="page-section-head">
          <div className="page-section-name">
            <h2
              id={`page-section-${entry.id}-title`}
              className="page-section-title"
            >
              {title}
            </h2>
            <p className="admin-badges">
              {badges(
                entry.id,
                !entry.shown,
                owner
                  ? sharedBadge(owner, [
                      entry.id,
                      ...inside.map((section) => section.id),
                    ])
                  : null,
              )}
            </p>
          </div>
          {note ? <p className="muted page-section-note">{note}</p> : null}
          <div className="page-section-controls with-switch">
            <div className="page-section-switch">
              <label className="check-label">
                <input
                  type="checkbox"
                  id={switchId}
                  checked={entry.shown}
                  onChange={(event) => {
                    const shown = event.currentTarget.checked;
                    setSections(
                      shownState.map((other, at) =>
                        at === index ? { ...other, shown } : other,
                      ),
                    );
                  }}
                />
                {sectionWords.show}
                <span className="sr-only">: {title}</span>
              </label>
              <FieldError name={`sections.${entry.id}`} controls={[switchId]} />
            </div>
            {own ? (
              editButton(
                own,
                title,
                inside.map((section) => section.id),
              )
            ) : href ? (
              <Link className="button-secondary" href={href}>
                {sectionWords.edit}
                <span className="sr-only"> {title}</span>
              </Link>
            ) : (
              // Keeps the switches of all rows in one column.
              <span aria-hidden="true" />
            )}
          </div>
        </div>
        {own && owner ? boxes(own, owner) : null}
        {owner
          ? inside.map((section) => boxes(section, owner, entry.id))
          : null}
      </section>
    );
  };

  const rows = () => {
    const settings = layout?.settings ?? [];
    const placed = new Set<string>([
      ...(layout ? [layout.top] : []),
      ...settings,
      ...(layout?.sections
        .filter(
          (section) =>
            section.source.from === "text" && section.source.key === pageKey,
        )
        .flatMap((section) => [section.id, ...(section.with ?? [])]) ?? []),
    ]);
    return (
      <>
        {settings.map((id) => {
          const section = ownSection(id);
          return section
            ? fixedRow(
                section,
                <p className="muted page-section-note">
                  {sectionWords.settings}
                </p>,
              )
            : null;
        })}
        {layout
          ? (() => {
              const top = ownSection(layout.top);
              return top
                ? fixedRow(
                    top,
                    <p className="muted page-section-note">
                      {sectionWords.top}
                    </p>,
                  )
                : null;
            })()
          : null}
        {(layout?.inside ?? []).map(({ key, section: id }) => {
          // A shared text's section drawn inside the page's own parts
          // (the Jumu'ah heading on Home): edited here, never moved.
          const section = pageFields[key].sections.find(
            (entry) => entry.id === id,
          );
          return section ? fixedRow(section, null, key) : null;
        })}
        {layout ? (
          <div className="page-section-list">
            <p className="muted">{sectionWords.hint}</p>
            <SortableList
              items={moved}
              itemKey={(entry) => entry.id}
              itemName={(entry) =>
                layoutKey ? pageSectionTitle(layoutKey, entry.id) : entry.id
              }
              // A band stays last (review fixes P3): only the others move.
              onReorder={(next) => setSections([...next, ...bands])}
              label={sectionWords.listLabel}
              look="cards"
            >
              {(entry) => layoutRow(entry, shownState.indexOf(entry))}
            </SortableList>
            {bands.map((entry) => (
              <div
                key={entry.id}
                className="page-section-row page-section-band"
              >
                {layoutRow(entry, shownState.indexOf(entry))}
              </div>
            ))}
          </div>
        ) : null}
        {sections
          .filter((section) => !placed.has(section.id))
          .map((section) => fixedRow(section, elsewhere(section.id)))}
      </>
    );
  };

  // One section without a page of its own: its boxes, as one form.
  const single = sections.length === 1 && !layout;
  // Verse choices are picked, never typed: the save hint is about typed boxes.
  const typesNothing = sections.every((section) =>
    section.fields.every((field) => field.kind === "verse"),
  );
  const form = (
    <CheckedForm
      action={action}
      state={state}
      check={check}
      className="editor-form"
      key={state.attempt}
      onProblems={onProblems}
    >
      <input type="hidden" name="key" value={pageKey} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="document" value={JSON.stringify(document)} />
      {shared.flatMap((text) => [
        <input
          key={`version-${text.key}`}
          type="hidden"
          name={versionField(text.key, pageKey)}
          value={text.version}
        />,
        <input
          key={`document-${text.key}`}
          type="hidden"
          name={documentField(text.key, pageKey)}
          value={JSON.stringify(sharedDocs[text.key])}
        />,
      ])}
      <div
        ref={formArea}
        className={layout ? "page-sections with-list" : "page-sections"}
      >
        {single ? (
          <fieldset className="page-section">
            <legend>{sections[0].title}</legend>
            {elsewhere(sections[0].id)}
            {sections[0].note ? (
              <p className="muted">{sections[0].note}</p>
            ) : null}
            {sections[0].fields.map((field) =>
              box(field, segments(field.path)),
            )}
          </fieldset>
        ) : (
          rows()
        )}
      </div>
      <div className="admin-actions">
        <button className="button-primary" disabled={pending || busy}>
          {pending ? systemText.buttons.saving : saveLabel}
        </button>
        {typesNothing ? null : (
          <span className="muted">{pageEditorWords.saveHint}</span>
        )}
      </div>
    </CheckedForm>
  );
  if (!hasPagePreview(pageKey)) return form;
  // Preview's page switcher (shared text, option A, 2026-10-06): this page,
  // and each other page that shows words edited here, drawn with the words
  // as typed.
  const other = otherPreviews.find((entry) => entry.key === previewing);
  const switcher = otherPreviews.length ? (
    <div
      role="group"
      aria-label={sectionWords.previewPage}
      className="admin-actions preview-pages"
    >
      <span className="muted">{sectionWords.previewPage}:</span>
      {[pageKey, ...otherPreviews.map((entry) => entry.key)].map((key) => (
        <button
          key={key}
          type="button"
          className="button-secondary"
          aria-pressed={previewing === key}
          onClick={() => setPreviewing(key)}
        >
          {pageFields[key].title}
        </button>
      ))}
    </div>
  ) : null;
  return (
    <EditorPreview
      form={form}
      previewControls={switcher}
      preview={() =>
        other ? (
          <PagePreview
            key={other.key}
            // That page's own words: typed here when they are a shared text.
            document={sharedDocs[other.key] ?? other.document}
            shared={{ ...sharedDocs, [pageKey]: document }}
            live={other.live}
            slots={other.slots}
            hidden={new Set(other.hidden)}
            focus={editing}
          />
        ) : (
          <PagePreview
            document={document}
            shared={sharedDocs}
            live={live}
            slots={slots}
            hidden={new Set(hiddenElsewhere)}
            focus={editing}
          />
        )
      }
    />
  );
}
