"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { DateField } from "@/shared/ui/DateField";
import { dayRange } from "@/lib/time/field-rules";
import { dayLabel } from "@/lib/time/date-label";
import { systemText } from "@/lib/system-text";
import s from "./term-export.module.css";
import { downloadStarted, newDownloadToken } from "./download-mark";
import { TERM_NAME_MAX, termExportBoxes, untilBeforeFrom } from "./term-form";
import {
  checkFreeUpAction,
  freeUpSpaceAction,
  type FreeUpCheck,
} from "./term-export-actions";

const words = systemText.termExport;

/** How long the screen waits for the zip to start before it stops saying "Preparing". */
const WAIT_MS = 300_000;
const LOOK_EVERY_MS = 500;

type Term = { name: string; from: string; until: string };

/**
 * The Term export screen's two steps (review fixes P5). Download: the name
 * and the first and last days; the button stays off until all three are
 * filled in, and To cannot be before From. The zip downloads by itself
 * (a plain link to the route, so the browser saves it while this page stays
 * open). Free up space: offered once the zip for the same days has started
 * downloading; it says what will go and asks first.
 */
export function TermExportForm({
  start,
  problem,
}: {
  start: Term;
  /** Why the last Download came back to this screen. */
  problem: string | null;
}) {
  const [term, setTerm] = useState<Term>(start);
  const [preparing, setPreparing] = useState(false);
  const [downloaded, setDownloaded] = useState<{
    from: string;
    until: string;
  } | null>(null);
  // Sent with Download (`download-mark.ts`).
  const [token, setToken] = useState("");
  const looking = useRef<number | undefined>(undefined);
  const hintId = useId();

  const filled =
    term.name.trim() !== "" && term.from !== "" && term.until !== "";
  const ready = filled && term.until >= term.from;
  // Why Download is off: a box is empty, or To is before From.
  const hint = !filled ? words.fillFirst : !ready ? untilBeforeFrom : null;
  const sameDays =
    downloaded?.from === term.from && downloaded?.until === term.until;

  useEffect(() => () => window.clearInterval(looking.current), []);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!ready || preparing) {
      event.preventDefault();
      return;
    }
    const mark = newDownloadToken();
    const days = { from: term.from, until: term.until };
    // Drawn now, so the browser sends this click's token with the form.
    flushSync(() => {
      setToken(mark);
      setPreparing(true);
      setDownloaded(null);
    });
    const began = Date.now();
    window.clearInterval(looking.current);
    looking.current = window.setInterval(() => {
      const started = downloadStarted(document.cookie, mark);
      if (!started && Date.now() - began < WAIT_MS) return;
      window.clearInterval(looking.current);
      setPreparing(false);
      if (started) setDownloaded(days);
    }, LOOK_EVERY_MS);
  };

  const change = (key: keyof Term) => (event: { target: { value: string } }) =>
    setTerm((now) => ({ ...now, [key]: event.target.value }));

  return (
    <>
      <section className="content-card" aria-labelledby="term-download">
        <h2 id="term-download">{words.downloadTitle}</h2>
        <form
          className={`editor-form ${s.form}`}
          method="get"
          action="/admin/term-export/download"
          onSubmit={onSubmit}
        >
          {problem ? (
            <p role="alert" className="form-error">
              {problem}
            </p>
          ) : null}
          <label>
            {termExportBoxes.name}
            <span className="muted">{words.nameHint}</span>
            <input
              name="name"
              maxLength={TERM_NAME_MAX}
              autoComplete="off"
              value={term.name}
              onChange={change("name")}
            />
          </label>
          <div className="form-grid compact">
            <label>
              {termExportBoxes.from}
              <DateField
                name="from"
                rule={dayRange({ until: { box: "until" } })}
                value={term.from}
                onChange={change("from")}
              />
            </label>
            <label>
              {termExportBoxes.until}
              <DateField
                name="until"
                rule={dayRange({ from: { box: "from" } })}
                value={term.until}
                onChange={change("until")}
              />
            </label>
          </div>
          <p className="muted">{words.rangeHint}</p>
          <input type="hidden" name="token" value={token} />
          <div className={s.actions}>
            <button
              className="button-primary"
              disabled={!ready || preparing}
              aria-describedby={!ready ? hintId : undefined}
            >
              {words.download}
            </button>
            {hint ? (
              <p id={hintId} className={filled ? "field-error" : "muted"}>
                {hint}
              </p>
            ) : null}
            <p role="status" className={`muted ${s.status}`}>
              {preparing ? words.preparing : sameDays ? words.started : ""}
            </p>
          </div>
        </form>
      </section>
      <FreeUpSpace
        days={{ from: term.from, until: term.until }}
        allowed={ready && sameDays && !preparing}
      />
    </>
  );
}

/**
 * "Free up space" (the plan's): what will go, a question, then the result.
 * "Remove files" stays off until "I opened the zip and can see the photos"
 * is ticked (the user's decision of 2026-10-07); the server checks it too.
 */
function FreeUpSpace({
  days,
  allowed,
}: {
  days: { from: string; until: string };
  allowed: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [check, setCheck] = useState<FreeUpCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [done, setDone] = useState<{ message: string; partly: boolean } | null>(
    null,
  );
  const [checking, startCheck] = useTransition();
  const [removing, startRemove] = useTransition();

  const open = () => {
    setCheck(null);
    setError(null);
    setOpened(false);
    dialog.current?.showModal();
    startCheck(async () => setCheck(await checkFreeUpAction(days)));
  };
  const remove = () =>
    startRemove(async () => {
      const result = await freeUpSpaceAction({ ...days, opened });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      dialog.current?.close();
      setDone(result);
    });

  const range =
    days.from && days.until
      ? words.days(dayLabel(days.from), dayLabel(days.until))
      : "";
  const going = check?.ok && check.files > 0 ? check : null;

  return (
    <section className="content-card" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{words.freeTitle}</h2>
      <p>{words.freeIntro}</p>
      <div className={`${s.actions} ${s.spaced}`}>
        <button
          type="button"
          className="button-secondary"
          disabled={!allowed}
          aria-describedby={!allowed ? `${id}-first` : undefined}
          onClick={open}
        >
          {words.freeButton}
        </button>
        {!allowed ? (
          <p id={`${id}-first`} className="muted">
            {words.downloadFirst}
          </p>
        ) : null}
      </div>
      {done ? (
        <>
          <p role="status" className="success-message">
            {done.message}
          </p>
          {done.partly ? (
            <p role="alert" className="form-error">
              {words.partly}
            </p>
          ) : null}
        </>
      ) : null}
      <dialog
        ref={dialog}
        className="leave-dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
      >
        <h2 id={`${id}-title`}>
          {check?.ok && !going ? words.freeTitle : words.confirmTitle}
        </h2>
        <div id={`${id}-text`} aria-live="polite">
          {checking || !check ? (
            <p>{words.checking}</p>
          ) : !check.ok ? (
            <p role="alert" className="form-error">
              {check.error}
            </p>
          ) : (
            <>
              <p>
                {going
                  ? words.confirm(going.files, going.size, going.items, range)
                  : words.nothing}
              </p>
              {check.kept ? (
                <p className="muted">{words.kept(check.kept)}</p>
              ) : null}
            </>
          )}
          {error ? (
            <p role="alert" className="form-error">
              {error}
            </p>
          ) : null}
        </div>
        {going ? (
          <label className={`check-label ${s.tick}`}>
            <input
              type="checkbox"
              checked={opened}
              disabled={removing}
              onChange={(event) => setOpened(event.target.checked)}
            />
            {words.opened}
          </label>
        ) : null}
        <div className="admin-actions">
          {going ? (
            <button
              type="button"
              className="button-primary"
              disabled={removing || !opened}
              onClick={remove}
            >
              {removing ? words.removing : words.remove}
            </button>
          ) : null}
          <button
            type="button"
            className="button-secondary"
            autoFocus
            disabled={removing}
            onClick={() => dialog.current?.close()}
          >
            {going ? words.cancel : words.close}
          </button>
        </div>
      </dialog>
    </section>
  );
}
