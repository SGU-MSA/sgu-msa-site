"use client";
import { Eye, Monitor, Smartphone, Tablet, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { PreviewFrame } from "./PreviewFrame";
import s from "./preview.module.css";
import { useTypedValues } from "./useTypedValues";

/** The widths Preview can show the page at, in CSS pixels. */
const devices = [
  ["desktop", "Desktop", 1280, Monitor],
  ["tablet", "Tablet", 768, Tablet],
  ["phone", "Phone", 390, Smartphone],
] as const;
type Device = (typeof devices)[number][0];

/**
 * An editor with its full-page Preview (review fixes P1, item 8; replaces
 * the Edit | Preview tabs of PR5a D-11, D-23). The eye button opens a
 * dialog over the whole screen with the real public page drawn from the
 * form's values as typed (read when it opens; nothing is saved or stored),
 * at Desktop, Tablet or Phone width: each width lays the page out as that
 * screen would (its own page, `PreviewFrame`), shrunk to fit when the
 * screen is smaller. Escape or Close returns to the form, with focus back
 * on the eye button and everything typed kept.
 */
export function EditorPreview({
  form,
  preview,
  previewControls = null,
}: {
  form: ReactNode;
  preview: (values: Record<string, string>) => ReactNode;
  /** Controls above the page (the Pages editor's page switcher). */
  previewControls?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [device, setDevice] = useState<Device>("desktop");
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const formArea = useRef<HTMLDivElement>(null);
  const formElement = useRef<HTMLFormElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const stageArea = useRef<HTMLDivElement>(null);
  const id = useId();
  // The form re-mounts after a refused save (`attempt`): find it again.
  useEffect(() => {
    formElement.current = formArea.current?.querySelector("form") ?? null;
  });
  const typed = useTypedValues(formElement);

  // The space the page has inside the dialog, kept up to date.
  useEffect(() => {
    const area = stageArea.current;
    if (!open || !area) return;
    const measure = () =>
      setStage({ width: area.clientWidth, height: area.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, [open]);

  const show = () => {
    setValues(typed());
    // Starts at the kind of screen in use: a phone shows Phone.
    const screen = window.innerWidth;
    setDevice(screen >= 1024 ? "desktop" : screen >= 700 ? "tablet" : "phone");
    setOpen(true);
    dialog.current?.showModal();
  };
  const chosen = devices.find(([key]) => key === device) ?? devices[0];
  // Desktop fills a wide screen; every width shrinks to fit a smaller one.
  const width =
    device === "desktop" ? Math.max(chosen[2], stage.width) : chosen[2];
  const scale = stage.width ? Math.min(1, stage.width / width) : 1;

  return (
    <div>
      <div className="admin-actions" data-tour="content-preview">
        <button
          ref={opener}
          type="button"
          className={`button-secondary ${s.open}`}
          aria-haspopup="dialog"
          onClick={show}
        >
          <Eye aria-hidden="true" size={20} strokeWidth={1.75} />
          Preview
        </button>
      </div>
      <div ref={formArea}>{form}</div>
      <dialog
        ref={dialog}
        className={s.dialog}
        aria-labelledby={`${id}-title`}
        onClose={() => {
          setOpen(false);
          opener.current?.focus();
        }}
      >
        <div className={s.bar}>
          <h2 id={`${id}-title`} className={s.title}>
            Preview (not saved)
          </h2>
          <div role="group" aria-label="Screen width" className={s.widths}>
            {devices.map(([key, label, , Icon]) => (
              <button
                key={key}
                type="button"
                className={`button-secondary ${s.width}`}
                aria-pressed={device === key}
                onClick={() => setDevice(key)}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`button-secondary ${s.close}`}
            onClick={() => dialog.current?.close()}
          >
            <X aria-hidden="true" size={18} />
            Close
          </button>
        </div>
        {previewControls ? (
          <div className={s.controls}>{previewControls}</div>
        ) : null}
        <div ref={stageArea} className={s.stage}>
          {open && stage.width ? (
            <div
              className={s.frame}
              style={{ width: width * scale, height: stage.height }}
            >
              <PreviewFrame
                width={width}
                scale={scale}
                height={stage.height}
                title="Preview (not saved)"
              >
                <div className="editor-preview-body">{preview(values)}</div>
              </PreviewFrame>
            </div>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}
