"use client";
import {
  createContext,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type FormHTMLAttributes,
  type ReactNode,
} from "react";
import { boxesNeedFixing } from "@/lib/system-text";
import { SaveStatus } from "../save-state/SaveStatus";
import { hasProblems, type FieldProblems } from "./problems";
import { cancelLeaveAfterSave, guardForm } from "./unsaved";

/** What a board form's server action answers (`EditorState`, `KeptFormState`). */
export type CheckedState = {
  error: string | null;
  notice?: string | null;
  /** The server's problems by box (the final check). */
  fields?: FieldProblems;
  /** Changes on every refused save. */
  attempt?: number;
  /** The typed values of a refused save. */
  values?: Record<string, string> | null;
};

export type FormCheck = {
  /** The problem a box shows now, or null. */
  problem: (key: string) => string | null;
  /** The id of a box's problem line. */
  errorId: (key: string) => string;
  /** A box's problem line is on screen, for these controls (names or ids). */
  register: (key: string, controls: readonly string[]) => () => void;
};

export const FormCheckContext = createContext<FormCheck | null>(null);

/**
 * The form's controls a box key stands for: by `name`, by `id`, or by
 * `data-control` (the drop-downs of a `TimeField`, which posts from a
 * hidden input, list its name and id there).
 */
function controlsOf(form: HTMLFormElement, controls: readonly string[]) {
  const found = new Set<HTMLElement>();
  for (const control of controls) {
    const escaped = CSS.escape(control);
    for (const element of form.querySelectorAll<HTMLElement>(
      `[name="${escaped}"]:not([type="hidden"]), #${escaped}, [data-control~="${escaped}"]`,
    ))
      found.add(element);
  }
  return [...found];
}

/** The form as posted, for "anything changed?" (a chosen file counts). */
function posted(form: HTMLFormElement) {
  const parts: string[] = [];
  for (const [name, value] of new FormData(form))
    parts.push(
      `${name}=${typeof value === "string" ? value : `file:${value.name}:${value.size}`}`,
    );
  return parts.join("&");
}

/** A box that can be wrong (a button only points to the line). */
const isField = (element: HTMLElement) =>
  element instanceof HTMLInputElement ||
  element instanceof HTMLSelectElement ||
  element instanceof HTMLTextAreaElement;

const isChoice = (element: HTMLElement) =>
  element instanceof HTMLInputElement &&
  (element.type === "radio" || element.type === "checkbox");

/**
 * Every board form (review 2, 2026-10-05; `.plans/review2-plan.md` PR-A 3,
 * 4). The boxes are checked in the browser by `check`, the same pure rules
 * the server action runs: a box is checked as you type once you have
 * started on it, and when you leave it; a wrong box gets a red outline and
 * one line under it (`FieldError`). Save with a red box shows "Some boxes
 * need fixing." at the top, moves to the first red box and posts nothing.
 * The server stays the final check: its problems show on the same boxes, and
 * a problem with no box on screen (or a refusal such as "someone else saved
 * first") is written in the same top slot. While anything differs from what
 * the form started with, the unsaved-changes guard asks before leaving and
 * the bar at the bottom of the screen says "Unsaved changes" with a Save
 * button (`SaveStatus`).
 */
export function CheckedForm({
  action,
  state,
  check,
  children,
  guard = true,
  onProblems,
  ...form
}: Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  action: (data: FormData) => void;
  state: CheckedState;
  /** The form's rules, run in the browser; nothing when the server alone checks. */
  check?: (form: HTMLFormElement) => FieldProblems;
  children: ReactNode;
  /** False for a form that saves at once (nothing is left unsaved). */
  guard?: boolean;
  /**
   * The boxes whose problem is on screen, by key, each time they change: a
   * form that folds its boxes away (Pages, review 3 B) opens the ones that
   * need fixing.
   */
  onProblems?: (keys: readonly string[]) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const prefix = `${useId()}-problem-`;
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [showAll, setShowAll] = useState(Boolean(state.fields));
  const [client, setClient] = useState<FieldProblems>({});
  const [server, setServer] = useState<FieldProblems>(state.fields ?? {});
  const [focusRequest, setFocusRequest] = useState(state.fields ? 1 : 0);
  // A form that is not re-mounted by its refusal hears the new answer here.
  const [answer, setAnswer] = useState(state);
  // A refused save's typed values count as unsaved until saved.
  const [carried, setCarried] = useState(Boolean(state.values));
  const [dirty, setDirty] = useState(carried);
  if (answer !== state) {
    setAnswer(state);
    setCarried(Boolean(state.values));
    if (state.values) setDirty(true);
    setServer(state.fields ?? {});
    if (state.fields) {
      setShowAll(true);
      setFocusRequest((request) => request + 1);
    }
  }
  // The problem lines on screen, each with the controls it explains.
  const [registry, setRegistry] = useState<
    ReadonlyMap<string, readonly string[]>
  >(() => new Map());
  // The same, for the event handlers below.
  const registryRef = useRef(registry);
  const checkRef = useRef(check);
  useLayoutEffect(() => {
    checkRef.current = check;
    registryRef.current = registry;
  });

  // "Unsaved changes" (`SaveStatus`) is the guard's own test, run again
  // after each change: what the form posts now differs from what it
  // started with (`startRef`, set once mounted), or it carries a refused
  // save's typed values.
  const startRef = useRef<string | null>(null);
  const carriedRef = useRef(carried);
  useLayoutEffect(() => {
    carriedRef.current = carried;
  });
  const isDirty = useCallback(() => {
    const element = formRef.current;
    if (!element || startRef.current === null) return carriedRef.current;
    return carriedRef.current || posted(element) !== startRef.current;
  }, []);

  // Changes typed or chosen: the form changed last owns the "Unsaved
  // changes" bar (`SaveStatus`).
  const [edits, setEdits] = useState(0);
  const recheck = useCallback(() => {
    const element = formRef.current;
    if (!element) return;
    if (checkRef.current) setClient(checkRef.current(element));
    setDirty(isDirty());
  }, [isDirty]);

  // The problems on screen: the browser's, once the box was started on (or
  // after Save), else the server's until the box is changed.
  const visible = useMemo(() => {
    const shown: FieldProblems = {};
    for (const [key, message] of Object.entries(client)) {
      const controls = registry.get(key) ?? [key];
      if (showAll || controls.some((control) => touched.has(control)))
        shown[key] = message;
    }
    for (const [key, message] of Object.entries(server)) shown[key] ??= message;
    return shown;
  }, [client, server, showAll, touched, registry]);

  // The keys of the problems on screen, for `onProblems`.
  const onProblemsRef = useRef(onProblems);
  useLayoutEffect(() => {
    onProblemsRef.current = onProblems;
  });
  const shownKeys = Object.keys(visible).join("\n");
  useEffect(() => {
    onProblemsRef.current?.(shownKeys ? shownKeys.split("\n") : []);
  }, [shownKeys]);

  const errorId = useCallback(
    (key: string) => prefix + key.replace(/[^\w-]/g, "-"),
    [prefix],
  );
  // Stable, so a problem line registers once while it is on screen.
  const register = useCallback((key: string, controls: readonly string[]) => {
    setRegistry((before) => new Map(before).set(key, controls));
    return () =>
      setRegistry((before) => {
        if (before.get(key) !== controls) return before;
        const after = new Map(before);
        after.delete(key);
        return after;
      });
  }, []);
  const context = useMemo<FormCheck>(
    () => ({ problem: (key) => visible[key] ?? null, errorId, register }),
    [visible, errorId, register],
  );

  // Typing, choosing and leaving a box: it counts as started on, a server
  // problem on it is cleared, and the rules run again once React has drawn
  // the change (some forms keep their values in state, posted from hidden
  // boxes).
  useEffect(() => {
    const element = formRef.current;
    if (!element) return;
    let timer: number | undefined;
    const onEvent = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const names = [
        target.getAttribute("name"),
        target.id,
        ...(target.dataset.control?.split(" ") ?? []),
      ].filter((name): name is string => Boolean(name));
      if (!names.length) return;
      // A time box (`TimeField`) is three drop-downs: it counts as started
      // on once the focus leaves all three, not while they are being picked.
      const group = target.dataset.control;
      const next = event instanceof FocusEvent ? event.relatedTarget : null;
      const leftGroup =
        event.type === "focusout" &&
        !(next instanceof HTMLElement && next.dataset.control === group);
      if (!group || leftGroup)
        setTouched((before) => {
          if (names.every((name) => before.has(name))) return before;
          return new Set([...before, ...names]);
        });
      if (event.type !== "focusout")
        setServer((before) => {
          const keys = Object.keys(before).filter((key) =>
            (registryRef.current.get(key) ?? [key]).some((control) =>
              names.includes(control),
            ),
          );
          if (!keys.length) return before;
          const after = { ...before };
          for (const key of keys) delete after[key];
          return after;
        });
      if (event.type !== "focusout") setEdits((count) => count + 1);
      window.clearTimeout(timer);
      timer = window.setTimeout(recheck, 0);
    };
    const events = ["input", "change", "focusout"] as const;
    for (const type of events) element.addEventListener(type, onEvent);
    return () => {
      window.clearTimeout(timer);
      for (const type of events) element.removeEventListener(type, onEvent);
    };
  }, [recheck]);

  // Each box's controls say whether they are wrong and which line explains it.
  useLayoutEffect(() => {
    const element = formRef.current;
    if (!element) return;
    for (const [key, controls] of registry) {
      const message = visible[key];
      for (const control of controlsOf(element, controls)) {
        const described = (control.getAttribute("aria-describedby") ?? "")
          .split(/\s+/)
          .filter((token) => token && !token.startsWith(prefix));
        if (message) described.push(errorId(key));
        if (described.length)
          control.setAttribute("aria-describedby", described.join(" "));
        else control.removeAttribute("aria-describedby");
        if (isChoice(control)) {
          const group = control.closest("fieldset");
          if (message) group?.setAttribute("data-invalid", "true");
          else group?.removeAttribute("data-invalid");
        } else if (!isField(control)) continue;
        else if (message) control.setAttribute("aria-invalid", "true");
        else control.removeAttribute("aria-invalid");
      }
    }
  }, [visible, registry, prefix, errorId]);

  const top = useRef<HTMLDivElement>(null);
  // After a refused Save: the first red box, top to bottom, takes the focus;
  // with none on screen, the message at the top does.
  useEffect(() => {
    if (!focusRequest) return;
    const element = formRef.current;
    if (!element) return;
    const wrong = [...registryRef.current]
      .filter(([key]) => visible[key])
      .flatMap(([, controls]) => controlsOf(element, controls))
      .sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
      );
    // A control that takes the focus (a time box's group does not; its
    // drop-downs do).
    const first = wrong.find(
      (control) =>
        control.tabIndex >= 0 &&
        !(control instanceof HTMLInputElement && control.disabled),
    );
    if (first) first.focus();
    else top.current?.focus();
    // Only a new request moves the focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  // A refused save stays on this page.
  useEffect(() => {
    if (state.attempt) cancelLeaveAfterSave();
  }, [state.attempt]);

  /** The browser check before posting; false when a box is red. */
  const ready = useCallback(() => {
    const element = formRef.current;
    const problems = element && check ? check(element) : {};
    setClient(problems);
    setShowAll(true);
    if (!hasProblems(problems)) return true;
    setFocusRequest((request) => request + 1);
    return false;
  }, [check]);

  // The unsaved-changes guard: what the form started with, kept from mount
  // (a re-render, such as a live preview, never moves it, and neither does
  // coming Back to this page while the browser kept it with typed text).
  const readyRef = useRef(ready);
  useLayoutEffect(() => {
    readyRef.current = ready;
  });
  useEffect(() => {
    const element = formRef.current;
    if (!guard || !element) return;
    startRef.current ??= posted(element);
    return guardForm({
      dirty: isDirty,
      save: () => {
        if (!readyRef.current()) return false;
        element.requestSubmit();
        return true;
      },
    });
  }, [guard, isDirty]);

  // The answer on screen when a save was posted: a save that opens a page
  // (or reopens this one) brings no new answer.
  const postedWith = useRef<CheckedState | null>(null);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!ready()) {
      event.preventDefault();
      cancelLeaveAfterSave();
      return;
    }
    postedWith.current = state;
  };
  // Saved and still on screen (the save reopened this page): what is in the
  // boxes now is what is saved.
  const onSettled = useCallback(() => {
    const element = formRef.current;
    if (!element || postedWith.current !== answer) return;
    postedWith.current = null;
    startRef.current = posted(element);
    carriedRef.current = false;
    setCarried(false);
    setDirty(false);
  }, [answer]);

  const unplaced = Object.entries(visible).filter(
    ([key]) => !registry.has(key),
  );
  // "Some boxes need fixing." only when a box on screen is red; a problem
  // with no box is written out on its own.
  const needsFixing =
    Object.keys(visible).some((key) => registry.has(key)) &&
    (showAll || hasProblems(server));
  const message = needsFixing || unplaced.length || state.error;

  return (
    <FormCheckContext.Provider value={context}>
      <form
        {...form}
        ref={formRef}
        action={action}
        onSubmit={onSubmit}
        noValidate
      >
        {message || state.notice ? (
          <div ref={top} tabIndex={-1} className="form-top-message">
            {message ? (
              <div role="alert" className="form-error">
                {needsFixing ? (
                  <p>
                    <strong>{boxesNeedFixing}</strong>
                  </p>
                ) : null}
                {unplaced.map(([key, text]) => (
                  <p key={key}>{text}</p>
                ))}
                {state.error ? <p>{state.error}</p> : null}
              </div>
            ) : null}
            {state.notice ? (
              <p role="status" className="success-message">
                {state.notice}
              </p>
            ) : null}
          </div>
        ) : null}
        {children}
        <SaveStatus
          form={formRef}
          dirty={guard && dirty}
          edits={edits}
          onSettled={onSettled}
        />
      </form>
    </FormCheckContext.Provider>
  );
}
