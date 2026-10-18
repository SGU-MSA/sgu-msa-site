"use client";
import { useRef, useState, type ReactNode } from "react";
import { VERSE_SEARCH_WORDS_MAX } from "@/lib/quran/reference";
import { searchVerses } from "@/lib/quran/search";
import type { QuranVerse } from "@/lib/quran/verse";
import { systemText } from "@/lib/system-text";

const words = systemText.versePicker;

/** What the search found, as the line under the box. */
function summary(found: ReturnType<typeof searchVerses>) {
  switch (found.kind) {
    case "empty":
      return null;
    case "invalid":
      return { text: words.invalid(found.typed), error: true };
    case "not_in_library":
      return { text: words.notInLibrary(found.reference), error: true };
    case "none":
      return { text: words.none, error: false };
    case "found":
      return {
        text: words.found(found.verses.length, found.total),
        error: false,
      };
  }
}

/**
 * One place's verse in "Verse on each page" (Review 3 E, 2026-10-06): the
 * verse chosen now (Arabic, meaning and name), "Change verse" to find
 * another in the fixed verse library by verse number, surah number or word,
 * and "No verse". Searching happens here, over the library the screen was
 * given; "Use this verse" only sets the place's reference, saved with
 * "Save verse choices". Nothing here can type Qur'an text.
 */
export function VerseChooser({
  id,
  label,
  value,
  library,
  onChange,
  after,
}: {
  /** The box's id: the first button carries it, so a red box can be jumped to. */
  id: string;
  label: string;
  /** The chosen reference ("94:5"), or "" for no verse. */
  value: string;
  library: readonly QuranVerse[];
  onChange: (reference: string) => void;
  /** The box's problem and hint, under it. */
  after?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const opener = useRef<HTMLButtonElement>(null);
  const chosen = value
    ? library.find((verse) => verse.reference === value)
    : undefined;
  const found = open
    ? searchVerses(library, typed)
    : { kind: "empty" as const };
  const said = summary(found);
  const close = () => {
    setOpen(false);
    setTyped("");
    opener.current?.focus();
  };
  return (
    <fieldset className="verse-choice">
      <legend>{label}</legend>
      {chosen ? (
        <div className="verse-chosen">
          <p lang="ar" dir="rtl" className="verse-arabic">
            {chosen.arabic}
          </p>
          <p className="verse-meaning">{chosen.meaning}</p>
          <p className="muted">
            {words.name(chosen.reference, chosen.surahName)}
          </p>
        </div>
      ) : (
        <p className="muted">
          {value ? words.notInLibrary(value) : systemText.pages.noVerse}
        </p>
      )}
      <div className="verse-choice-actions">
        <button
          type="button"
          id={id}
          ref={opener}
          className="button-secondary"
          aria-expanded={open}
          aria-controls={`${id}-find`}
          onClick={() => (open ? close() : setOpen(true))}
        >
          {value ? words.change : words.choose}
        </button>
        {value ? (
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              onChange("");
              // This button goes away with the verse: keep the place's focus.
              if (open) close();
              else opener.current?.focus();
            }}
          >
            {words.noVerse}
          </button>
        ) : null}
      </div>
      {/* Always on the page (hidden while closed) so its live line is
          already there when the first count is announced. */}
      <div id={`${id}-find`} className={open ? "verse-find" : "sr-only"}>
        {open ? (
          <div className="form-field">
            <label htmlFor={`${id}-search`}>{words.searchLabel}</label>
            <span id={`${id}-search-hint`} className="muted">
              {words.searchHint}
            </span>
            <input
              id={`${id}-search`}
              type="search"
              value={typed}
              placeholder={words.searchExample}
              maxLength={VERSE_SEARCH_WORDS_MAX}
              autoComplete="off"
              autoFocus
              aria-describedby={`${id}-search-hint ${id}-search-found`}
              onChange={(event) => setTyped(event.currentTarget.value)}
              onKeyDown={(event) => {
                // Enter searches as you type already; it must not save the page.
                if (event.key === "Enter") event.preventDefault();
                if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                }
              }}
            />
          </div>
        ) : null}
        <p
          id={`${id}-search-found`}
          aria-live="polite"
          className={said?.error ? "form-error" : "muted"}
        >
          {said?.text}
        </p>
        {found.kind === "found" ? (
          <ol className="verse-results">
            {found.verses.map((verse) => {
              const name = words.name(verse.reference, verse.surahName);
              return (
                <li key={verse.reference} className="verse-result">
                  <p lang="ar" dir="rtl" className="verse-arabic">
                    {verse.arabic}
                  </p>
                  <p className="verse-meaning">{verse.meaning}</p>
                  <div className="verse-result-foot">
                    <span className="muted">{name}</span>
                    <button
                      type="button"
                      className="button-primary"
                      aria-label={`${words.useVerse} ${name}`}
                      onClick={() => {
                        onChange(verse.reference);
                        close();
                      }}
                    >
                      {words.useVerse}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}
        {open ? (
          <button type="button" className="button-secondary" onClick={close}>
            {words.cancel}
          </button>
        ) : null}
      </div>
      {after}
    </fieldset>
  );
}
